// One item through the loop, as on the web (web/src/ai/loop.ts is the spec, and LoopTest
// mirrors web/src/ai/loop.test.ts). The model's next_action picks the branch; code adds only
// objective checks (the date it copied must parse, the category must exist) and the chart
// gate, which decides keep or discard.
//
// On a phone the split is: Gemini Nano checks every photo on the device (is there a package,
// is a date in view, does it need the fridge) and answers "nothing in view" and "turn it"
// itself; only photos worth reading go to the cloud model for the full read. On a phone with
// no on-device model the check is skipped and the read goes to the cloud, and the screen says so.

package com.keepuntil.sort.loop

import com.keepuntil.sort.gate.Chart
import com.keepuntil.sort.gate.ParsedDate
import com.keepuntil.sort.gate.Policy
import com.keepuntil.sort.gate.Verdict
import com.keepuntil.sort.gate.parseDateText
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout

sealed interface Step {
    val reads: List<ReadResult>
    val route: String

    data class Decided(override val reads: List<ReadResult>, val parsed: ParsedDate?, val verdict: Verdict, override val route: String) : Step

    /** "Turn it": the date is not in view, or (wantName) the date is read and the name is not. */
    data class NeedDatePhoto(override val reads: List<ReadResult>, override val route: String, val wantName: Boolean = false) : Step
    data class NoItem(override val reads: List<ReadResult>, override val route: String) : Step
}

/** The two model calls the loop makes. P is the photo: a Bitmap in the app, a label in tests. */
interface Readers<P> {
    /** On-device check. Null when this phone has no on-device model. Throws on any failure. */
    val triage: (suspend (photo: P) -> TriageResult)?

    /** The full read in the cloud. */
    suspend fun read(photo: P, secondLook: Boolean, seen: String?): ReadResult
}

private val WORSE_THAN_NONE = setOf("dent", "bulge", "rust", "leak", "open")

/**
 * One item is often two photos: the front shows the name and no date, the top shows the date
 * and no name. This is the item as all its photos together show it: for each fact, the latest
 * photo that shows it. Nothing is filled in that no photo showed.
 */
fun itemFacts(reads: List<ReadResult>): ItemRead {
    val last = reads.last().read
    fun latest(has: (ItemRead) -> Boolean): ItemRead? = reads.asReversed().firstOrNull { has(it.read) }?.read
    val named = latest { it.product.isNotEmpty() || it.brand.isNotEmpty() }
    val rowed = latest { it.category != "unclear" }
    val dated = latest { it.dateText.isNotEmpty() }
    val damaged = latest { it.damage in WORSE_THAN_NONE }
    return last.copy(
        product = named?.product ?: "",
        brand = named?.brand ?: "",
        category = rowed?.category ?: "unclear",
        dateText = dated?.dateText ?: "",
        dateKind = dated?.dateKind ?: last.dateKind,
        damage = damaged?.damage ?: last.damage,
    )
}

/** What earlier photos showed, as one line for the next read's prompt. */
fun seenSoFar(reads: List<ReadResult>): String? {
    if (reads.isEmpty()) return null
    val f = itemFacts(reads)
    val parts = listOfNotNull(
        if (f.product.isNotEmpty() || f.brand.isNotEmpty()) "name \"${listOf(f.brand, f.product).filter { it.isNotEmpty() }.joinToString(" ")}\"" else null,
        if (f.category != "unclear") "chart row ${f.category}" else null,
        if (f.dateText.isNotEmpty()) "date \"${f.dateText}\"" else null,
    )
    return parts.joinToString(", ").ifEmpty { null }
}

class SortLoop<P>(private val chart: Chart, private val readers: Readers<P>) {

    private fun settle(reads: List<ReadResult>, today: String, policy: Policy, route: String): Step.Decided {
        val last = itemFacts(reads)
        val parsed = if (last.dateText.isNotEmpty()) parseDateText(last.dateText, today) else null
        val verdict = chart.gate(last.category, parsed, last.dateKind, last.damage, today, policy)
        return Step.Decided(reads, parsed, verdict, route)
    }

    /** Keeps the on-device check in the item's record, next to the reads it led to. */
    private fun triageAsRead(tr: TriageResult): ReadResult {
        val t = tr.triage
        val next = if (!t.packageInView) "no_item" else if (!t.dateInView && !t.needsRefrigeration) "show_me_the_date" else "ask_cloud"
        fun yn(b: Boolean) = if (b) "yes" else "no"
        return ReadResult(
            ItemRead(
                t.product, "", "unclear", "", "none_visible", "none", "low", next,
                "triage: package ${yn(t.packageInView)}, date in view ${yn(t.dateInView)}, fridge ${yn(t.needsRefrigeration)}",
            ),
            source = "on_device", ms = tr.ms, mode = "only_on_device", valid = true,
        )
    }

    private fun dateKey(p: ParsedDate?): String = when (p) {
        null -> "no date"
        is ParsedDate.Exact -> p.iso
        is ParsedDate.Ambiguous -> p.candidates.joinToString(" or ")
        is ParsedDate.Unreadable -> "unreadable"
    }

    /**
     * Binning edible food is the failure this app exists to prevent, and one read can misread a
     * stamp. So a DISCARD is never decided on one read: a second read must find the same date,
     * or the item goes to a person.
     */
    private suspend fun confirmDiscard(step: Step.Decided, photo: P, secondLook: Boolean, seen: String?, today: String): Step {
        if (step.verdict.decision != "DISCARD") return step
        val check = try {
            // Never told what the first read found, so it cannot copy the date and "confirm" it.
            readers.read(photo, secondLook, null)
        } catch (e: Exception) {
            return step.copy(
                verdict = step.verdict.copy(decision = "SET_ASIDE", reason = "would discard, but the confirming read failed (${e.message}); a person checks it"),
                route = step.route + " → confirming read failed → set aside",
            )
        }
        val reads = step.reads + check
        val second = if (check.read.dateText.isNotEmpty()) parseDateText(check.read.dateText, today) else null
        if (dateKey(second) == dateKey(step.parsed) && step.parsed is ParsedDate.Exact) {
            return step.copy(reads = reads, route = step.route + " → discard confirmed by a second read (${check.source})")
        }
        return Step.Decided(
            reads, step.parsed,
            Verdict(
                "SET_ASIDE", null, false,
                "two reads disagree on the date (${dateKey(step.parsed)} vs ${dateKey(second)}), so a person checks it before anything is binned",
                step.verdict.chart,
            ),
            step.route + " → second read (${check.source}) disagreed → set aside",
        )
    }

    private fun setAside(reads: List<ReadResult>, route: String, reason: String): Step =
        Step.Decided(reads, null, Verdict("SET_ASIDE", null, false, reason), route)

    /** Why a "log" answer cannot be trusted as-is, tested against facts rather than the model's own confidence. */
    private fun objectiveProblem(read: ItemRead, today: String): String? {
        if (read.category == "unclear") return "no chart category"
        if (read.dateKind != "none_visible") {
            if (read.dateText.isEmpty()) return "date kind given but no date characters"
            val p = parseDateText(read.dateText, today)
            if (p is ParsedDate.Unreadable) return "date \"${read.dateText}\" does not parse (${p.why})"
        }
        return null
    }

    /**
     * @param small the same photo at a smaller size; the on-device check retries with it when
     *   the model refuses the first as too large (seen on the web on 2026-11-16).
     * @param previous reads already made for this item, before the volunteer turned it.
     * @param triageBudgetMs how long the on-device check may take before the item goes to the
     *   cloud without it (a first Gemini Nano call can take minutes while the model loads).
     */
    suspend fun processItem(
        photo: P,
        small: P?,
        today: String,
        policy: Policy = Policy(),
        previous: List<ReadResult> = emptyList(),
        triageBudgetMs: Long = 20_000,
    ): Step {
        val reads = previous.toMutableList()
        val secondLook = reads.isNotEmpty()
        val seen = seenSoFar(reads)
        var fallback = ""

        val triage = readers.triage
        if (triage != null && !secondLook) {
            try {
                suspend fun budgeted(p: P): TriageResult = try {
                    withTimeout(triageBudgetMs) { triage(p) }
                } catch (e: TimeoutCancellationException) {
                    throw IllegalStateException("took over ${triageBudgetMs / 1000} s")
                }
                val tr = try {
                    budgeted(photo)
                } catch (e: Exception) {
                    if (small == null || e.message?.contains("too large", ignoreCase = true) != true) throw e
                    fallback = "on_device triage: photo too large, retried smaller → "
                    budgeted(small)
                }
                val tread = triageAsRead(tr)
                if (!tr.triage.packageInView) {
                    return Step.NoItem(reads + tread, "on_device triage: no package in view; no cloud call")
                }
                if (!tr.triage.dateInView && !tr.triage.needsRefrigeration) {
                    return Step.NeedDatePhoto(reads + tread, "on_device triage: no date in view; no cloud call")
                }
                reads.add(tread)
                fallback += "on_device triage: ${if (tr.triage.dateInView) "date in view" else "may need the fridge"} → "
            } catch (e: Exception) {
                fallback = "on-device triage failed (${e.message}) → "
            }
        }

        val first = readers.read(photo, secondLook, seen)
        reads.add(first)
        fun routed(route: String) = fallback + route

        // After a turn, the item is everything its photos showed together. When that is enough
        // for the chart (a row, and a date that parses), it is settled here, whatever this one
        // photo lacks.
        if (secondLook && first.read.nextAction != "no_item" && first.read.nextAction != "set_aside") {
            val facts = itemFacts(reads)
            if (facts.dateText.isNotEmpty() && objectiveProblem(facts, today) == null) {
                return confirmDiscard(settle(reads, today, policy, routed("${first.source}: photos together give the row and the date")), photo, secondLook, seen, today)
            }
        }

        // The full read already ran in the cloud, so there is nowhere further to hand it.
        fun cannotSettle(why: String): Step =
            setAside(reads, routed("${first.source}: $why; already in the cloud"), "the cloud model could not settle it: $why")

        return when (first.read.nextAction) {
            // Nothing to log, and the next item is a new item, not the back of this one.
            "no_item" -> Step.NoItem(reads, routed("${first.source}: model saw no item"))
            "set_aside" -> setAside(reads, routed("${first.source}: model chose set_aside"), first.read.why.ifEmpty { "the model set it aside for the lead" })
            "show_me_the_date" ->
                if (secondLook) cannotSettle("still no date after turning the item")
                else Step.NeedDatePhoto(reads, routed("${first.source}: model asked to see the date"))
            "ask_cloud" -> cannotSettle(first.read.why.ifEmpty { "model asked for the cloud" })
            else -> {
                val problem = objectiveProblem(first.read, today)
                when {
                    // The date is read and the name is not in view (a carton top, a can lid): ask
                    // for the front rather than guess the chart row or give up on the item.
                    problem == "no chart category" && !secondLook && first.source == "in_cloud" && first.read.dateText.isNotEmpty() ->
                        Step.NeedDatePhoto(reads, routed("in_cloud: date read, no name in view; asked for the front"), wantName = true)
                    problem != null -> cannotSettle(problem)
                    else -> confirmDiscard(settle(reads, today, policy, routed("${first.source}: model chose log")), photo, secondLook, seen, today)
                }
            }
        }
    }
}
