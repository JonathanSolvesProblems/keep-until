package com.keepuntil.sort

import com.keepuntil.sort.gate.Chart
import com.keepuntil.sort.gate.ParsedDate
import com.keepuntil.sort.gate.Policy
import com.keepuntil.sort.gate.Verdict
import com.keepuntil.sort.gate.parseDateText
import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The cross-platform check: the Kotlin gate must answer exactly what the web app's TypeScript
 * gate answers. shared/gate-vectors.json is written by scripts/export_gate_vectors.mjs from the
 * web code; this test replays every line of it. If the two ever differ, a phone and a laptop
 * would tell a volunteer different things about the same can, and this fails first.
 */
class GateVectorsTest {
    private val shared = File(System.getProperty("shared.dir") ?: error("shared.dir is not set"))
    private val chart = Chart(File(shared, "fbc-shelf-life-2018.json").readText())
    private val vectors = Json.parseToJsonElement(File(shared, "gate-vectors.json").readText()).jsonObject

    private fun ParsedDate.toJson(): JsonObject = buildJsonObject {
        when (val p = this@toJson) {
            is ParsedDate.Exact -> { put("kind", "exact"); put("iso", p.iso); put("precision", p.precision) }
            is ParsedDate.Ambiguous -> { put("kind", "ambiguous"); put("candidates", JsonArray(p.candidates.map { JsonPrimitive(it) })); put("why", p.why) }
            is ParsedDate.Unreadable -> { put("kind", "unreadable"); put("why", p.why) }
        }
    }

    private fun Verdict.toJson(): JsonObject = buildJsonObject {
        put("decision", decision)
        keepUntil?.let { put("keepUntil", it) }
        put("pastPrintedDate", pastPrintedDate)
        put("reason", reason)
        chart?.let { put("chart", buildJsonObject { put("id", it.id); put("label", it.label); put("page", it.page) }) }
    }

    @Test
    fun `every date stamp parses as the web app parses it`() {
        val cases = vectors["dates"]!!.jsonArray
        assertTrue("expected a broad set of stamps", cases.size > 250)
        val wrong = cases.mapNotNull { c ->
            val o = c.jsonObject
            val raw = o["raw"]!!.jsonPrimitive.content
            val today = o["today"]!!.jsonPrimitive.content
            val got = parseDateText(raw, today).toJson()
            if (got == o["expect"]) null else "\"$raw\" on $today: web ${o["expect"]} / kotlin $got"
        }
        assertEquals("date vectors that differ from the web app:\n" + wrong.joinToString("\n"), 0, wrong.size)
    }

    @Test
    fun `every gate decision matches the web app's`() {
        val cases = vectors["gates"]!!.jsonArray
        assertTrue("expected every chart row many times over", cases.size > 2000)
        val wrong = cases.mapNotNull { c ->
            val o = c.jsonObject
            val today = o["today"]!!.jsonPrimitive.content
            val dateText = o["dateText"]!!.jsonPrimitive.content
            val policy = o["policy"]?.takeIf { it !is JsonNull }?.let { Json.decodeFromJsonElement<Policy>(it) } ?: Policy()
            val got = chart.gate(
                categoryId = o["categoryId"]!!.jsonPrimitive.content,
                date = if (dateText.isNotEmpty()) parseDateText(dateText, today) else null,
                dateKind = o["dateKind"]!!.jsonPrimitive.content,
                damage = o["damage"]!!.jsonPrimitive.content,
                today = today,
                policy = policy,
            ).toJson()
            if (got == o["expect"]) null else "$o\n   kotlin $got"
        }
        assertEquals("gate vectors that differ from the web app:\n" + wrong.take(20).joinToString("\n"), 0, wrong.size)
    }

    @Test
    fun `the vectors cover every row of the chart`() {
        val seen = vectors["gates"]!!.jsonArray.map { it.jsonObject["categoryId"]!!.jsonPrimitive.content }.toSet()
        assertEquals(emptyList<String>(), chart.categoryIds.filter { it !in seen })
        // And the answers are not all one kind: keeps, discards and set-asides are all in there.
        val decisions = vectors["gates"]!!.jsonArray.map { it.jsonObject["expect"]!!.jsonObject["decision"]!!.jsonPrimitive.content }.toSet()
        assertEquals(setOf("KEEP", "DISCARD", "SET_ASIDE"), decisions)
        assertTrue(vectors["gates"]!!.jsonArray.any { it.jsonObject["expect"]!!.jsonObject["pastPrintedDate"]!!.jsonPrimitive.boolean })
    }
}
