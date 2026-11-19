package com.keepuntil.sort

import com.keepuntil.sort.gate.Chart
import com.keepuntil.sort.loop.ReadResult
import com.keepuntil.sort.loop.Readers
import com.keepuntil.sort.loop.SortLoop
import com.keepuntil.sort.loop.Step
import com.keepuntil.sort.loop.Triage
import com.keepuntil.sort.loop.TriageResult
import com.keepuntil.sort.loop.itemFacts
import com.keepuntil.sort.loop.toItemRead
import com.keepuntil.sort.ui.Kind
import com.keepuntil.sort.ui.answerOf
import com.keepuntil.sort.ui.readBy
import java.io.File
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The loop with fake models, mirroring web/src/ai/loop.test.ts: these run offline and never
 * call a model. Each fake answers from a queue, as the web tests' fakes do.
 */
class LoopTest {
    private val chart = Chart(File(System.getProperty("shared.dir"), "fbc-shelf-life-2018.json").readText())
    private val today = "2026-11-15"

    private fun read(vararg fields: Pair<String, String>): String {
        val base = linkedMapOf(
            "product" to "Chicken broth 900 mL", "brand" to "Campbell's", "category" to "canned_prepared_meals",
            "date_text" to "2027 FE 14", "date_kind" to "best_before", "damage" to "none",
            "confidence" to "high", "next_action" to "log", "why" to "date readable",
        )
        fields.forEach { base[it.first] = it.second }
        return Json.encodeToString(kotlinx.serialization.json.JsonObject.serializer(), buildJsonObject { base.forEach { (k, v) -> put(k, JsonPrimitive(v)) } })
    }

    /** A queued answer: JSON text from the cloud, or an exception. */
    private sealed interface Reply {
        data class Text(val text: String, val source: String = "in_cloud") : Reply
        data class Fail(val message: String) : Reply
    }

    private inner class Fakes(cloud: List<Reply>, triage: List<Any>? = null) : Readers<String> {
        private val cloudQueue = ArrayDeque(cloud)
        private val triageQueue = triage?.let { ArrayDeque(it) }
        var cloudCalls = 0
        var triageCalls = 0
        val photosRead = mutableListOf<String>()
        val seenLines = mutableListOf<String?>()

        override val triage: (suspend (String) -> TriageResult)? = triageQueue?.let { q ->
            { photo ->
                triageCalls++
                photosRead.add("triage:$photo")
                when (val r = q.removeFirstOrNull() ?: error("no more fake triage replies")) {
                    is Triage -> TriageResult(r, 5)
                    "stall" -> awaitCancellation()
                    else -> throw IllegalStateException(r.toString())
                }
            }
        }

        override suspend fun read(photo: String, secondLook: Boolean, seen: String?): ReadResult {
            cloudCalls++
            photosRead.add("cloud:$photo")
            seenLines.add(seen)
            return when (val r = cloudQueue.removeFirstOrNull() ?: error("no more fake replies")) {
                is Reply.Fail -> throw IllegalStateException(r.message)
                is Reply.Text -> {
                    val (item, valid) = toItemRead(r.text, chart)
                    ReadResult(item, r.source, 10, "only_in_cloud", valid)
                }
            }
        }
    }

    private fun triage(packageInView: Boolean = true, dateInView: Boolean = false, fridge: Boolean = false) =
        Triage(packageInView, dateInView, fridge, "Corn")

    @Test
    fun `logs a cloud read that the chart gate can settle`() = runTest {
        val f = Fakes(listOf(Reply.Text(read())))
        val step = SortLoop(chart, f).processItem("img", null, today)
        step as Step.Decided
        assertEquals("KEEP", step.verdict.decision)
        assertEquals("in_cloud: model chose log", step.route)
        assertEquals("2029-02-14", step.verdict.keepUntil)
    }

    @Test
    fun `sets aside a log whose date does not parse, instead of logging it`() = runTest {
        val f = Fakes(listOf(Reply.Text(read("date_text" to "L23 0419"))))
        val step = SortLoop(chart, f).processItem("img", null, today) as Step.Decided
        assertEquals("SET_ASIDE", step.verdict.decision)
        assertTrue(step.route, step.route.contains("does not parse"))
    }

    @Test
    fun `keeps a discard only when a second read finds the same date`() = runTest {
        val cereal = arrayOf("category" to "boxed_cereal", "product" to "Corn flakes", "date_text" to "2026 FE 01")
        val f = Fakes(listOf(Reply.Text(read(*cereal)), Reply.Text(read(*cereal))))
        val step = SortLoop(chart, f).processItem("img", null, today) as Step.Decided
        assertEquals(2, f.cloudCalls)
        assertEquals("DISCARD", step.verdict.decision)
        assertTrue(step.route.endsWith("discard confirmed by a second read (in_cloud)"))
        assertTrue(answerOf(step).reason.endsWith("Two reads agreed on the date."))
    }

    @Test
    fun `sets an item aside instead of binning it when the two reads disagree on the date`() = runTest {
        // The real case: one read of a Chipits bag gave "26MA14" (May 2026), another "BB/MA 2027 MA 17".
        val f = Fakes(
            listOf(
                Reply.Text(read("category" to "general_grocery_boxed", "date_text" to "26MA14")),
                Reply.Text(read("category" to "general_grocery_boxed", "date_text" to "BB/MA 2027 MA 17")),
            ),
        )
        val step = SortLoop(chart, f).processItem("img", null, today) as Step.Decided
        assertEquals("SET_ASIDE", step.verdict.decision)
        assertTrue(step.verdict.reason, step.verdict.reason.contains("2026-05-14 vs 2027-05-17"))
    }

    @Test
    fun `refuses a misread year rather than keeping the item`() = runTest {
        // A cut-off "2027" read as "5037" (2026-11-15); the gate must not say keep.
        val f = Fakes(listOf(Reply.Text(read("category" to "general_grocery_boxed", "date_text" to "BB/MA 5037 MA"))))
        val step = SortLoop(chart, f).processItem("img", null, today) as Step.Decided
        assertEquals("SET_ASIDE", step.verdict.decision)
    }

    @Test
    fun `treats an empty frame as no item, so the next item starts fresh`() = runTest {
        val f = Fakes(listOf(Reply.Text(read("next_action" to "no_item", "product" to "", "category" to "unclear", "date_text" to "", "date_kind" to "none_visible"))))
        assertTrue(SortLoop(chart, f).processItem("img", null, today) is Step.NoItem)
    }

    @Test
    fun `answers turn it on the phone when no date is in view, with no cloud call`() = runTest {
        val f = Fakes(listOf(Reply.Text(read())), triage = listOf(triage()))
        val step = SortLoop(chart, f).processItem("img", null, today)
        assertTrue(step is Step.NeedDatePhoto)
        assertEquals("on_device triage: no date in view; no cloud call", step.route)
        assertEquals(0, f.cloudCalls)
        assertEquals(Kind.TURN, answerOf(step).kind)
        assertEquals("Checked on this phone in 0.0 s, nothing sent to the cloud", readBy(step, phoneHasModel = true))
    }

    @Test
    fun `answers nothing in view on the phone, with no cloud call`() = runTest {
        val f = Fakes(listOf(), triage = listOf(triage(packageInView = false)))
        val step = SortLoop(chart, f).processItem("img", null, today)
        assertTrue(step is Step.NoItem)
        assertEquals(0, f.cloudCalls)
    }

    @Test
    fun `sends the photo to the cloud for the date when the phone sees one`() = runTest {
        val f = Fakes(listOf(Reply.Text(read())), triage = listOf(triage(dateInView = true)))
        val step = SortLoop(chart, f).processItem("img", null, today) as Step.Decided
        assertEquals("KEEP", step.verdict.decision)
        assertEquals("on_device triage: date in view → in_cloud: model chose log", step.route)
        assertEquals(listOf("on_device", "in_cloud"), step.reads.map { it.source })
        assertEquals(1, f.cloudCalls)
        assertEquals("Checked on this phone, date read in the cloud in 0.0 s", readBy(step, phoneHasModel = true))
    }

    @Test
    fun `reads in the cloud when the phone's check fails, so no item is lost`() = runTest {
        val f = Fakes(listOf(Reply.Text(read())), triage = listOf("model crashed"))
        val step = SortLoop(chart, f).processItem("img", null, today)
        assertTrue(step is Step.Decided)
        assertTrue(step.route, step.route.startsWith("on-device triage failed (model crashed) → "))
        assertEquals(1, f.cloudCalls)
        assertEquals("Read in the cloud in 0.0 s, this phone could not check it", readBy(step, phoneHasModel = true))
    }

    @Test
    fun `retries the phone's check with the smaller photo when the model says the input is too large`() = runTest {
        val f = Fakes(listOf(Reply.Text(read())), triage = listOf("The input is too large.", triage(dateInView = true)))
        val step = SortLoop(chart, f).processItem("img", "small", today)
        assertEquals(2, f.triageCalls)
        assertEquals(listOf("triage:img", "triage:small", "cloud:img"), f.photosRead)
        assertEquals("on_device triage: photo too large, retried smaller → on_device triage: date in view → in_cloud: model chose log", step.route)
    }

    @Test
    fun `gives up on a phone check that stalls and reads in the cloud`() = runTest {
        val f = Fakes(listOf(Reply.Text(read())), triage = listOf("stall"))
        val step = SortLoop(chart, f).processItem("img", null, today, triageBudgetMs = 30)
        assertTrue(step is Step.Decided)
        assertTrue(step.route, step.route.startsWith("on-device triage failed (took over 0 s) → "))
        assertEquals(1, f.cloudCalls)
    }

    @Test
    fun `says plainly when this phone has no on-device model`() = runTest {
        val f = Fakes(listOf(Reply.Text(read())))
        val step = SortLoop(chart, f).processItem("img", null, today)
        assertEquals("Read in the cloud in 0.0 s, this phone has no on-device model", readBy(step, phoneHasModel = false))
    }

    // One item, two photos (front for the name, top for the date), as in loop.test.ts.
    private val front = read("product" to "Chicken broth 900 mL", "brand" to "Campbell's", "category" to "canned_prepared_meals", "date_text" to "", "date_kind" to "none_visible", "next_action" to "show_me_the_date")
    private val top = read("product" to "", "brand" to "", "category" to "unclear", "date_text" to "2027 FE 14", "date_kind" to "best_before", "next_action" to "log")

    @Test
    fun `asks for the name when the cloud reads a date but cannot tell the chart row`() = runTest {
        val step = SortLoop(chart, Fakes(listOf(Reply.Text(top)))).processItem("img", null, today)
        assertTrue(step is Step.NeedDatePhoto && step.wantName)
        assertEquals("so the name faces the camera", answerOf(step).sub)
    }

    @Test
    fun `settles from the front's name and row plus the top's date`() = runTest {
        val f = Fakes(listOf(Reply.Text(front), Reply.Text(top)))
        val loop = SortLoop(chart, f)
        val first = loop.processItem("front", null, today)
        assertTrue(first is Step.NeedDatePhoto)
        val second = loop.processItem("top", null, today, previous = first.reads) as Step.Decided
        assertEquals("KEEP", second.verdict.decision)
        assertEquals("canned_prepared_meals", second.verdict.chart?.id)
        assertEquals("in_cloud: photos together give the row and the date", second.route)
        // The second read was told what the first photo showed.
        assertEquals(listOf(null, "name \"Campbell's Chicken broth 900 mL\", chart row canned_prepared_meals"), f.seenLines)
    }

    @Test
    fun `never fills in a fact no photo showed`() {
        val (item, _) = toItemRead(top, chart)
        val facts = itemFacts(listOf(ReadResult(item, "in_cloud", 1, "only_in_cloud", true)))
        assertEquals("unclear", facts.category)
        assertEquals("", facts.product)
    }

    @Test
    fun `turns a malformed answer into a set-aside, never a guess`() {
        val (item, valid) = toItemRead("On-device model is not available, echoing input", chart)
        assertEquals(false, valid)
        assertEquals("set_aside", item.nextAction)
    }

    @Test
    fun `never shows the word expired or an internal id on screen`() = runTest {
        val replies = listOf(
            read(), read("category" to "infant_formula", "date_text" to "EXP 2026 NO 01", "date_kind" to "expiry"),
            read("category" to "infant_formula", "date_text" to "EXP 2026 NO 01", "date_kind" to "expiry"),
            read("category" to "chilled_or_frozen"), read("damage" to "dent"),
        )
        val words = mutableListOf<String>()
        for (r in replies.distinct()) {
            val f = Fakes(listOf(Reply.Text(r), Reply.Text(r)))
            val a = answerOf(SortLoop(chart, f).processItem("img", null, today))
            words += listOfNotNull(a.word, a.sub, a.reason, a.source, a.stampPlain)
        }
        val text = words.joinToString(" | ")
        assertTrue(text, !text.contains("expired", ignoreCase = true))
        assertTrue(text, chart.categoryIds.none { text.contains(it) })
        assertTrue(text, !text.contains("on_device") && !text.contains("in_cloud"))
    }
}
