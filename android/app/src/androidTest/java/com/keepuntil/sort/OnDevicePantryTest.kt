package com.keepuntil.sort

import android.graphics.BitmapFactory
import android.os.Build
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.firebase.Firebase
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.OnDeviceModelOption
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import com.keepuntil.sort.ai.PhoneReaders
import com.keepuntil.sort.data.Backend
import com.keepuntil.sort.gate.Chart
import com.keepuntil.sort.gate.ParsedDate
import com.keepuntil.sort.loop.SortLoop
import com.keepuntil.sort.loop.Step
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The phone's half of the hybrid, on a real phone: the 16 pantry photos the web measurements
 * used, each through the on-device check (Gemini Nano through AICore) and then the whole loop
 * (the check, the cloud read when there is a date, the chart gate). Run on Firebase Test Lab on
 * a phone from the ML Kit Prompt API list. It records what happened, whatever happened: every
 * line goes to logcat with the tag KeepUntilResult, which Test Lab keeps, and nothing here
 * claims on-device ran unless the SDK's own inferenceSource said so.
 */
@OptIn(PublicPreviewAPI::class)
@RunWith(AndroidJUnit4::class)
class OnDevicePantryTest {
    private val ctx = InstrumentationRegistry.getInstrumentation().targetContext
    private val testAssets = InstrumentationRegistry.getInstrumentation().context.assets

    private fun emit(o: JsonObject) {
        // One JSON object per logcat line, so the run's logcat is the results file.
        Log.i("KeepUntilResult", o.toString())
    }

    @Test
    fun pantryPhotosOnThisPhone() = runBlocking {
        val chart = Chart(ctx.assets.open("fbc-shelf-life-2018.json").bufferedReader().use { it.readText() })
        val labels = Json.parseToJsonElement(testAssets.open("pantry/pantry-2026-11-15.json").bufferedReader().use { it.readText() })
            .jsonObject["items"]!!.jsonArray.associateBy { it.jsonObject["file"]!!.jsonPrimitive.content }
        val settings = Backend().run { signIn(); loadSettings() }
        val readers = PhoneReaders(chart, settings.cloudModel)

        // What the phone itself offers, before the app asks: the AICore service and, for each
        // model category the SDK can ask for, what AICore says about it.
        val aicore = try {
            val info = ctx.packageManager.getPackageInfo("com.google.android.aicore", 0)
            "${info.versionName} (enabled ${info.applicationInfo?.enabled})"
        } catch (e: Exception) {
            "not installed"
        }
        val categories = buildJsonObject {
            for ((name, option) in listOf("STABLE" to OnDeviceModelOption.STABLE, "PREVIEW" to OnDeviceModelOption.PREVIEW, "PREVIEW_FAST" to OnDeviceModelOption.PREVIEW_FAST)) {
                val probe = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
                    modelName = settings.cloudModel,
                    onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_ON_DEVICE, modelOption = option),
                )
                put(name, try { probe.onDeviceExtension?.checkStatus()?.toString() ?: "no on-device extension" } catch (e: Exception) { "${e.javaClass.simpleName}: ${e.message}" })
            }
        }
        emit(buildJsonObject { put("kind", "aicore"); put("package", aicore); put("categories", categories) })

        // AICore may need to download the model first; give it up to 25 minutes, and say what it did.
        val t0 = System.currentTimeMillis()
        val progress = mutableListOf<String>()
        val on = withTimeoutOrNull(25 * 60_000L) { readers.prepare { if (progress.lastOrNull() != it) progress += it } }
        emit(
            buildJsonObject {
                put("kind", "device")
                put("manufacturer", Build.MANUFACTURER)
                put("model", Build.MODEL)
                put("device", Build.DEVICE)
                put("sdk", Build.VERSION.SDK_INT)
                put("onDeviceReady", on?.ready ?: false)
                put("onDeviceStatus", on?.status ?: "prepare timed out after 25 minutes")
                put("onDeviceModel", on?.modelName ?: "")
                put("prepareMs", System.currentTimeMillis() - t0)
                put("progress", progress.takeLast(3).joinToString(" | "))
                put("cloudModel", settings.cloudModel)
            },
        )

        val files = testAssets.list("pantry")!!.filter { it.endsWith(".jpg") }.sorted()
        val loop = SortLoop(chart, readers)
        for (file in files) {
            val full = testAssets.open("pantry/$file").use { BitmapFactory.decodeStream(it) }
            val photo = full.scaledTo(1024)
            val small = full.scaledTo(512)
            val label = labels[file]?.jsonObject

            // 1. The on-device check alone, so its answers are recorded even when the loop
            //    would not need them.
            val triage = if (on?.ready == true) {
                try {
                    val tr = readers.triageOnDevice(photo)
                    buildJsonObject {
                        put("ok", true)
                        put("ms", tr.ms)
                        put("packageInView", tr.triage.packageInView)
                        put("dateInView", tr.triage.dateInView)
                        put("needsRefrigeration", tr.triage.needsRefrigeration)
                        put("product", tr.triage.product)
                    }
                } catch (e: Exception) {
                    buildJsonObject { put("ok", false); put("error", "${e.javaClass.simpleName}: ${e.message}") }
                }
            } else {
                buildJsonObject { put("ok", false); put("error", "no on-device model on this phone") }
            }

            // 2. The whole loop, as the app runs it at the sort table.
            val step = try {
                loop.processItem(photo, small, "2026-11-15", settings.policy)
            } catch (e: Exception) {
                null.also { emit(buildJsonObject { put("kind", "error"); put("file", file); put("error", "${e.javaClass.simpleName}: ${e.message}") }) }
            }
            emit(
                buildJsonObject {
                    put("kind", "photo")
                    put("file", file)
                    put("expected", label?.get("expected") ?: JsonPrimitive(""))
                    put("labelDate", label?.get("best_before") ?: JsonPrimitive(""))
                    put("triage", triage)
                    if (step != null) {
                        put("step", when (step) { is Step.Decided -> "verdict"; is Step.NeedDatePhoto -> if (step.wantName) "turn_for_name" else "turn_it"; is Step.NoItem -> "no_item" })
                        put("decision", (step as? Step.Decided)?.verdict?.decision ?: "")
                        put("parsedDate", ((step as? Step.Decided)?.parsed as? ParsedDate.Exact)?.iso ?: "")
                        put("route", step.route)
                        put("sources", step.reads.joinToString(",") { it.source })
                        put("ms", step.reads.sumOf { it.ms })
                    }
                },
            )
        }
        emit(buildJsonObject { put("kind", "done"); put("photos", files.size) })
    }
}
