// What the models are asked and what they must answer. The same fields, prompts and choices as
// the web app (web/src/ai/schema.ts), so an item read on a phone and one read on a laptop are
// the same record.

package com.keepuntil.sort.loop

import com.keepuntil.sort.gate.Chart
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

val DATE_KINDS = listOf("best_before", "expiry", "packaged_on", "none_visible")
val DAMAGE = listOf("none", "dent", "bulge", "rust", "leak", "open", "unsure")
val CONFIDENCE = listOf("high", "medium", "low")

/**
 * The model's own choice of what happens next. This is the branch point of the loop: log it,
 * ask the volunteer to turn the package, hand it up, or set it aside for the sort lead.
 */
val NEXT_ACTIONS = listOf("log", "show_me_the_date", "ask_cloud", "set_aside", "no_item")

data class ItemRead(
    val product: String,
    val brand: String,
    val category: String,
    val dateText: String,
    val dateKind: String,
    val damage: String,
    // Recorded for the results only. Self-reported confidence never routes anything.
    val confidence: String,
    val nextAction: String,
    val why: String,
)

/** The on-device job, chosen by measurement on the web: the small model decides whether a photo is worth a cloud call. */
data class Triage(val packageInView: Boolean, val dateInView: Boolean, val needsRefrigeration: Boolean, val product: String)

data class TriageResult(val triage: Triage, val ms: Long)

data class ReadResult(
    val read: ItemRead,
    /** "on_device" or "in_cloud", as the SDK reported it. */
    val source: String,
    val ms: Long,
    val mode: String,
    /** False when the model's answer was not the JSON the schema asks for. */
    val valid: Boolean,
)

fun readPrompt(chart: Chart, secondLook: Boolean, seen: String? = null): String = listOf(
    "You are reading one donated food item held up to a camera at a food bank sort table in Canada.",
    "Read only what is printed on the package. Never invent a date.",
    "",
    // No concrete example date here: a small model copied one into its answers for packages
    // that carry no such date (devpost/build-log.md, 2026-11-15).
    "Canadian date stamps put the year first, then a two-letter bilingual month code, then the day.",
    "Month codes: JA FE MR AL MA JN JL AU SE OC NO DE.",
    "'BB/MA' means best before. 'EXP' means expiry (infant formula, Ensure, Boost and other meal replacements).",
    "Copy the date characters exactly into date_text; do not convert them. Lot codes are not dates.",
    "",
    "Choose next_action:",
    "- log: you can tell which category the product is and read the full date (or the product has no date by design, like vinegar or honey).",
    "- show_me_the_date: no date is in view (for a can it is usually on the top or bottom). The volunteer will turn the item.",
    "- ask_cloud: a date is visible but you cannot read every character, the label is in a language you cannot read, or the product is unfamiliar.",
    "- set_aside: the package is dented, bulging, rusted, leaking or open, or it needs refrigeration.",
    "- no_item: there is no food package in view at all (an empty table, a wall, a hand with nothing in it).",
    if (secondLook) "This is another photo of the same item, taken after the volunteer turned it." else "",
    if (seen != null) {
        "Earlier photos of this same item showed: $seen. Report only what this photo shows for the date; " +
            "for the product, brand and category, keep what the earlier photos showed when this photo does not show the name."
    } else {
        ""
    },
    "",
    "Pick category from this list of Food Banks Canada chart rows (id: label):",
    chart.file.categories.joinToString("\n") { "${it.id}: ${it.label} (e.g. ${it.examples})" },
).filter { it != "" }.joinToString("\n")

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

private fun oneOf(value: String?, allowed: List<String>, fallback: String): String = if (value != null && value in allowed) value else fallback

/** Validates the model's JSON. Anything malformed becomes a set-aside, never a guess. */
fun toItemRead(text: String, chart: Chart): Pair<ItemRead, Boolean> {
    val raw: JsonObject = try {
        json.parseToJsonElement(text) as JsonObject
    } catch (e: Exception) {
        return ItemRead("", "", "", "", "none_visible", "unsure", "low", "set_aside", "the model's answer was not valid JSON") to false
    }
    fun s(key: String): String? = try {
        raw[key]?.jsonPrimitive?.contentOrNull
    } catch (e: Exception) {
        null
    }
    return ItemRead(
        product = s("product") ?: "",
        brand = s("brand") ?: "",
        category = oneOf(s("category"), chart.categoryIds + "unclear", "unclear"),
        dateText = s("date_text") ?: "",
        dateKind = oneOf(s("date_kind"), DATE_KINDS, "none_visible"),
        damage = oneOf(s("damage"), DAMAGE, "unsure"),
        confidence = oneOf(s("confidence"), CONFIDENCE, "low"),
        nextAction = oneOf(s("next_action"), NEXT_ACTIONS, "set_aside"),
        why = s("why") ?: "",
    ) to true
}
