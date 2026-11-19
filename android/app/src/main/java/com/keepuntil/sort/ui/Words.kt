// What the volunteer reads: the answer, its reason and where it was read, in plain words.
// The same wording as the web app (web/src/view.ts). Internal names never reach the screen.

package com.keepuntil.sort.ui

import com.keepuntil.sort.gate.ParsedDate
import com.keepuntil.sort.loop.ReadResult
import com.keepuntil.sort.loop.Step
import com.keepuntil.sort.loop.itemFacts
import java.util.Locale

private val MONTHS = listOf("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")

fun longDate(iso: String): String {
    val (y, m, d) = iso.split("-").map { it.toInt() }
    return "$d ${MONTHS[m - 1]} $y"
}

/** Upper case, the way a date coder prints it. */
fun shortDate(iso: String): String {
    val (y, m, d) = iso.split("-").map { it.toInt() }
    return "$d ${MONTHS[m - 1].take(3).uppercase(Locale.ROOT)} $y"
}

enum class Kind { KEEP, SET_ASIDE, DISCARD, TURN, NONE }

data class Answer(
    val kind: Kind,
    val word: String,
    /** The keep-until date, when the item is kept. */
    val until: String? = null,
    /** The second line under the word when there is no date ("for the lead"). */
    val sub: String? = null,
    val reason: String,
    val source: String? = null,
    /** The stamp as printed on the package, and the same date in words. */
    val stampCode: String? = null,
    val stampPlain: String? = null,
)

data class Reason(val reason: String, val source: String?)

private val CHART_PAGE = Regex("\\s*\\(chart p\\.(\\d+)\\)")
private val ISO = Regex("\\d{4}-\\d{2}-\\d{2}")
private val KEEPS = Regex("^(.*?): (\\d+ (?:months|days)) past best before$")
private val OLDER = Regex("^(.*?): more than (\\d+ (?:months|days)) past best before$")

/** Turns the gate's and the loop's reasons into the sort lead's words. */
fun plainReason(text: String): Reason {
    var t = text.trim()
    var source: String? = null
    CHART_PAGE.find(t)?.let {
        source = "Food Banks Canada chart, page ${it.groupValues[1]}"
        t = t.replaceFirst(it.value, "")
    }
    if (t.contains("(food bank policy)")) {
        source = "This food bank's own policy"
        t = t.replaceFirst(Regex("\\s*\\(food bank policy\\)"), "")
    }
    t = t
        .replaceFirst(Regex("^the cloud model could not settle it: ", RegexOption.IGNORE_CASE), "")
        .replaceFirst(Regex("date \"[^\"]*\" does not parse \\([^)]*\\)", RegexOption.IGNORE_CASE), "the date stamp could not be read clearly")
        .replaceFirst(Regex("^no readable date, so the chart cannot be applied$", RegexOption.IGNORE_CASE), "No date could be read, so the chart cannot be applied")
    t = ISO.replace(t) { longDate(it.value) }
    KEEPS.find(t)?.let { t = "${it.groupValues[1]} keep ${it.groupValues[2]} past best before." }
    OLDER.find(t)?.let { t = "${it.groupValues[1]} keep ${it.groupValues[2]} past best before, and this one is older than that." }
    if (t.startsWith("expiry-dated product, good until", ignoreCase = true)) t = "Good until its expiry date. Formula and meal replacements never go out after it."
    if (t.startsWith("expiry-dated product past its date", ignoreCase = true)) t = "Past its expiry date. Formula and meal replacements never go out after it."
    t = t.replace(Regex("(?<!\\d)1 (month|day)s\\b"), "1 $1")
    t = t.replaceFirstChar { it.uppercase(Locale.ROOT) }
    if (t.isNotEmpty() && t.last() !in ".?!") t += "."
    return Reason(t, source)
}

private val DAMAGE_WORDS = mapOf("dent" to "dented", "bulge" to "bulging", "rust" to "rusted", "leak" to "leaking", "open" to "open")

/** A set-aside reason built from the read's own fields, so a model's sentence is never the reason on screen. */
private fun asideReason(step: Step.Decided, fallback: String): String {
    if (step.reads.isEmpty()) return fallback
    val last = itemFacts(step.reads)
    if (last.category == "chilled_or_frozen") return "Needs the fridge. The lead checks the cold chain."
    DAMAGE_WORDS[last.damage]?.let { return "The package is $it. The lead decides." }
    return fallback
}

private val STAMP_PREFIX = Regex("^(BB/MA|BEST BEFORE|MEILLEUR AVANT|EXP)\\s*", RegexOption.IGNORE_CASE)
private val STAMP_DATE = Regex("\\d{2,4}\\s?[A-Z]{2}\\s?\\d{1,2}(?!\\d)", RegexOption.IGNORE_CASE)

fun answerOf(step: Step): Answer = when (step) {
    is Step.NoItem -> Answer(Kind.NONE, "Nothing in view", reason = "Hold the item closer, date side toward the camera.")
    is Step.NeedDatePhoto ->
        if (step.wantName) {
            Answer(Kind.TURN, "Turn it", sub = "so the name faces the camera", reason = "The date is read. Show the front of the package, then press Read item again.")
        } else {
            Answer(Kind.TURN, "Turn it", sub = "so the date faces the camera", reason = "Show the side with the date stamp, then press Read item again.")
        }
    is Step.Decided -> {
        val (reason, source) = plainReason(step.verdict.reason)
        var code: String? = null
        var plain: String? = null
        val exact = step.parsed as? ParsedDate.Exact
        val read = step.reads.lastOrNull { it.read.dateText.isNotEmpty() }
        if (exact != null && read != null) {
            val kind = when (read.read.dateKind) { "expiry" -> "Expiry"; "packaged_on" -> "Packaged on"; else -> "Best before" }
            // Only the date itself is re-printed: a lot code on the same line is not.
            val raw = STAMP_PREFIX.replaceFirst(read.read.dateText, "")
            code = (STAMP_DATE.find(raw)?.value ?: raw).uppercase(Locale.ROOT)
            plain = "$kind ${longDate(exact.iso)}"
        }
        when (step.verdict.decision) {
            "KEEP" -> Answer(Kind.KEEP, "Keep", until = step.verdict.keepUntil, reason = reason, source = source, stampCode = code, stampPlain = plain)
            // A discard only happens after a second read agreed on the date.
            "DISCARD" -> Answer(
                Kind.DISCARD, "Discard",
                reason = reason + if (step.reads.count { it.source == "in_cloud" } > 1) " Two reads agreed on the date." else "",
                source = source, stampCode = code, stampPlain = plain,
            )
            else -> Answer(Kind.SET_ASIDE, "Set aside", sub = "for the lead", reason = asideReason(step, reason), source = source, stampCode = code, stampPlain = plain)
        }
    }
}

/** Where the answer was read, and how long it took. Shown beside every answer. */
fun readBy(step: Step, phoneHasModel: Boolean): String {
    val reads = step.reads
    if (reads.isEmpty()) return ""
    val device = reads.any { it.source == "on_device" }
    val cloudReads = reads.count { it.source == "in_cloud" }
    val seconds = String.format(Locale.ROOT, "%.1f s", reads.sumOf { it.ms } / 1000.0)
    val where = if (cloudReads > 1) "read twice in the cloud" else "read in the cloud"
    return when {
        device && cloudReads > 0 -> "Checked on this phone, date $where in $seconds"
        device -> "Checked on this phone in $seconds, nothing sent to the cloud"
        !phoneHasModel -> "${where.replaceFirstChar { it.uppercase(Locale.ROOT) }} in $seconds, this phone has no on-device model"
        step.route.contains("on-device triage failed") -> "${where.replaceFirstChar { it.uppercase(Locale.ROOT) }} in $seconds, this phone could not check it"
        else -> "${where.replaceFirstChar { it.uppercase(Locale.ROOT) }} in $seconds"
    }
}

/** The name shown in the shift list: brand and product as printed, or the chart row the gate used. */
fun itemName(step: Step.Decided): String {
    val last = if (step.reads.isEmpty()) null else itemFacts(step.reads)
    val brand = last?.brand?.trim().orEmpty()
    val product = last?.product?.trim().orEmpty()
    val name = if (brand.isNotEmpty() && product.lowercase(Locale.ROOT).startsWith(brand.lowercase(Locale.ROOT))) product else listOf(brand, product).filter { it.isNotEmpty() }.joinToString(" ")
    return name.ifEmpty { step.verdict.chart?.label ?: "Item with no name in view" }
}
