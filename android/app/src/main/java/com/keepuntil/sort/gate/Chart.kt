// The chart gate. The model reads the package; this code, not the model, decides what the
// Food Banks Canada chart says about it. Every decision carries the chart row and page so a
// sort lead can check it against the printed guideline.
//
// A port of web/src/chart/chart.ts, reading the same shared/fbc-shelf-life-2018.json, and
// checked against the web version's own answers in shared/gate-vectors.json (GateVectorsTest).

package com.keepuntil.sort.gate

import java.time.LocalDate
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class ChartRow(
    val id: String,
    val label: String,
    val examples: String = "",
    val page: Int,
    val rule: String,
    val min: Int? = null,
    val max: Int? = null,
    val note: String? = null,
)

@Serializable
data class ChartFile(val source: String, val source_url: String, val categories: List<ChartRow>)

@Serializable
data class Override(val rule: String, val value: Int)

/** A food bank's own policy over the chart, delivered through Remote Config. */
@Serializable
data class Policy(
    /** Which end of the chart's printed range to use. The default is the cautious one. */
    val bound: String = "min",
    /** Per-category limits that replace the chart's. */
    val overrides: Map<String, Override> = emptyMap(),
)

@Serializable
data class ChartRef(val id: String, val label: String, val page: Int)

data class Verdict(
    val decision: String,
    /** Last day the item can go out, when the chart gives one. */
    val keepUntil: String? = null,
    /** True when the printed best-before date is already behind us. */
    val pastPrintedDate: Boolean,
    val reason: String,
    val chart: ChartRef? = null,
)

private val lenient = Json { ignoreUnknownKeys = true }

class Chart(json: String) {
    val file: ChartFile = lenient.decodeFromString(ChartFile.serializer(), json)
    val categoryIds: List<String> = file.categories.map { it.id }
    private val byId = file.categories.associateBy { it.id }

    fun row(id: String): ChartRow? = byId[id]

    private data class Limit(val rule: String, val value: Int, val from: String)

    private fun limitFor(row: ChartRow, policy: Policy): Limit? {
        policy.overrides[row.id]?.let { return Limit(it.rule, it.value, "food bank policy") }
        if (row.rule != "months" && row.rule != "days") return null
        val value = if (policy.bound == "max") row.max!! else row.min!!
        return Limit(row.rule, value, "chart p.${row.page}")
    }

    private fun verdictForDate(row: ChartRow, iso: String, kind: String, today: String, policy: Policy): Verdict {
        val chart = ChartRef(row.id, row.label, row.page)
        val pastPrintedDate = today > iso

        if (row.rule == "never_past_expiry") {
            return if (today <= iso) {
                Verdict("KEEP", iso, pastPrintedDate, "expiry-dated product, good until the printed date (chart p.${row.page})", chart)
            } else {
                Verdict("DISCARD", iso, pastPrintedDate, "expiry-dated product past its date; never shared past expiry (chart p.${row.page})", chart)
            }
        }
        if (kind == "packaged_on") {
            return Verdict("SET_ASIDE", null, false, "packaged-on date: the chart counts from best-before dates, so the lead decides", chart)
        }
        val limit = limitFor(row, policy)!!
        val printed = LocalDate.parse(iso)
        // plusMonths keeps the day and falls back to the month's last day, as the web version does.
        val keepUntil = (if (limit.rule == "months") printed.plusMonths(limit.value.toLong()) else printed.plusDays(limit.value.toLong())).toString()
        val span = "${limit.value} ${limit.rule} past best before (${limit.from})"
        return if (today <= keepUntil) {
            Verdict("KEEP", keepUntil, pastPrintedDate, "${row.label}: $span", chart)
        } else {
            Verdict("DISCARD", keepUntil, pastPrintedDate, "${row.label}: more than $span", chart)
        }
    }

    fun gate(categoryId: String, date: ParsedDate?, dateKind: String, damage: String, today: String, policy: Policy = Policy()): Verdict {
        val row = row(categoryId) ?: return Verdict("SET_ASIDE", null, false, "unknown category \"$categoryId\"")
        val chart = ChartRef(row.id, row.label, row.page)

        if (row.rule == "set_aside") {
            return Verdict("SET_ASIDE", null, false, row.note ?: "${row.label}: needs a cold-chain or quality check by the lead", chart)
        }
        if (damage != "none") {
            return Verdict(
                "SET_ASIDE", null, false,
                "packaging ($damage) goes to the lead: the chart says to assess packaging integrity under Food Banks Canada's Safe Food Handling Standards (p.3)",
                chart,
            )
        }
        if (row.rule == "indefinite") {
            return Verdict("KEEP", null, false, "${row.label}: no limit in the chart (p.${row.page})", chart)
        }
        if (row.rule == "no_value") {
            return Verdict("SET_ASIDE", null, false, "${row.label}: the chart prints no room-temperature value (p.${row.page})", chart)
        }

        if (date == null || dateKind == "none_visible" || date is ParsedDate.Unreadable) {
            val reason = if (row.note != null) "no readable date; ${row.note}" else "no readable date, so the chart cannot be applied"
            return Verdict("SET_ASIDE", null, false, reason, chart)
        }
        if (date is ParsedDate.Exact) return verdictForDate(row, date.iso, dateKind, today, policy)

        // Ambiguous: decide only if every reading of the stamp leads to the same call.
        date as ParsedDate.Ambiguous
        val verdicts = date.candidates.map { verdictForDate(row, it, dateKind, today, policy) }
        if (verdicts.all { it.decision == verdicts[0].decision }) {
            val earliest = verdicts.reduce { a, b -> if ((a.keepUntil ?: "") <= (b.keepUntil ?: "")) a else b }
            return earliest.copy(reason = "${earliest.reason}; the stamp reads ${date.candidates.joinToString(" or ")} and both give the same call")
        }
        return Verdict(
            "SET_ASIDE", null, false,
            "the stamp reads ${date.candidates.joinToString(" or ")} (${date.why}) and the two readings disagree",
            chart,
        )
    }
}
