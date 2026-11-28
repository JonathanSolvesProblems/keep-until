// The two model calls, through Firebase AI Logic's hybrid SDK.
//
// The check runs on the phone only (InferenceMode.ONLY_ON_DEVICE, Gemini Nano through AICore):
// nothing about a photo leaves the phone until the check says there is a date worth reading.
// The full read runs in the cloud only (InferenceMode.ONLY_IN_CLOUD). Each result records which
// one answered, from the SDK's own inferenceSource, never from an assumption.

@file:OptIn(PublicPreviewAPI::class)

package com.keepuntil.sort.ai

import android.graphics.Bitmap
import android.os.SystemClock
import com.google.firebase.Firebase
import com.google.firebase.ai.DownloadStatus
import com.google.firebase.ai.GenerativeModel
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.InferenceSource
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.OnDeviceModelStatus
import com.google.firebase.ai.ai
import com.google.firebase.ai.annotations.Generable
import com.google.firebase.ai.annotations.Guide
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.JsonSchema
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.RequestOptions
import com.google.firebase.ai.type.ThinkingLevel
import com.google.firebase.ai.type.content
import com.google.firebase.ai.type.generationConfig
import com.google.firebase.ai.type.thinkingConfig
import com.keepuntil.sort.gate.Chart
import com.keepuntil.sort.loop.CONFIDENCE
import com.keepuntil.sort.loop.DAMAGE
import com.keepuntil.sort.loop.DATE_KINDS
import com.keepuntil.sort.loop.NEXT_ACTIONS
import com.keepuntil.sort.loop.ReadResult
import com.keepuntil.sort.loop.Readers
import com.keepuntil.sort.loop.Triage
import com.keepuntil.sort.loop.TriageResult
import com.keepuntil.sort.loop.readPrompt
import com.keepuntil.sort.loop.toItemRead
import kotlinx.coroutines.delay
import kotlinx.serialization.Serializable

/**
 * What the on-device model answers. On-device structured output needs a @Generable data
 * class (the SDK turns it into constraints for Gemini Nano), so this is one, and nothing more.
 */
@Serializable
@Generable(description = "What is visible in one photo from a food bank sort table")
data class TriageAnswer(
    @Guide(description = "A food or grocery package is in the photo.")
    val packageInView: Boolean,
    @Guide(description = "Printed or stamped date characters are visible in this photo. Nutrition panels, barcodes and lot codes are not dates.")
    val dateInView: Boolean,
    @Guide(description = "The product is kept in a fridge or freezer (yogurt, cheese, milk, meat, frozen food).")
    val needsRefrigeration: Boolean,
    @Guide(description = "Product name exactly as printed in this photo, or empty if none is in view.")
    val product: String = "",
) {
    companion object
}

private const val TRIAGE_PROMPT =
    "Look at this photo from a food bank sort table. Answer only what you can see. " +
        "packageInView: is a food or grocery package in the photo? " +
        "dateInView: can you see printed or stamped date characters (a best before or expiry date)? Nutrition panels, barcodes and lot codes are not dates. " +
        "needsRefrigeration: is this a product kept in a fridge or freezer? " +
        "product: the product name as printed, or empty if no name is in view."

/** What this phone can do on its own, in words for the screen and the shift record. */
data class OnDeviceState(val ready: Boolean, val status: String, val modelName: String? = null)

class PhoneReaders(private val chart: Chart, cloudModelName: String) : Readers<Bitmap> {
    private val ai = Firebase.ai(backend = GenerativeBackend.googleAI())

    private val triageModel: GenerativeModel = ai.generativeModel(
        modelName = cloudModelName,
        onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_ON_DEVICE, temperature = 0f),
    )

    private val readSchema = JsonSchema.obj(
        mapOf(
            "product" to JsonSchema.string("Product name exactly as printed in this photo, e.g. 'Chickpeas 540 mL'. Empty if no name is printed in view; never guess it from the package."),
            "brand" to JsonSchema.string("Brand as printed, or empty if none is visible."),
            "category" to JsonSchema.enumeration(chart.categoryIds + "unclear", "The chart row this product belongs to, or 'unclear' if none fits or you cannot tell."),
            "date_text" to JsonSchema.string("The date characters exactly as printed, including any BB/MA or EXP prefix. Empty if no date is visible."),
            "date_kind" to JsonSchema.enumeration(DATE_KINDS),
            "damage" to JsonSchema.enumeration(DAMAGE, "Visible packaging condition."),
            "confidence" to JsonSchema.enumeration(CONFIDENCE, "How sure you are of the date characters."),
            "next_action" to JsonSchema.enumeration(NEXT_ACTIONS),
            "why" to JsonSchema.string("One short sentence explaining next_action."),
        ),
    )

    private val cloudModel: GenerativeModel = ai.generativeModel(
        modelName = cloudModelName,
        generationConfig = generationConfig {
            temperature = 0f
            // Reading a label is perception, not reasoning. Minimal thinking took the cloud read
            // from minutes to about two seconds on the web (devpost/build-log.md, 2026-11-15).
            thinkingConfig = thinkingConfig { thinkingLevel = ThinkingLevel.MINIMAL }
            // A read is about 150 tokens. A model stuck repeating digits once ran for 100 seconds
            // on the Galaxy S24 before its JSON broke (2026-11-27); capped, it fails in seconds.
            maxOutputTokens = READ_MAX_TOKENS
        },
        requestOptions = RequestOptions(timeoutInMillis = READ_TIMEOUT_MS),
        onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_IN_CLOUD),
    )

    @Volatile
    var onDevice: OnDeviceState = OnDeviceState(false, "not checked yet")
        private set

    /**
     * Finds out whether this phone has Gemini Nano, downloads it if AICore offers it, and warms
     * it up so the first item is not the slow one. Never throws: a phone without the model is a
     * normal case, and the read then goes to the cloud.
     */
    suspend fun prepare(onProgress: (String) -> Unit = {}): OnDeviceState {
        val ext = triageModel.onDeviceExtension
        if (ext == null) {
            onDevice = OnDeviceState(false, "no on-device support in this build")
            return onDevice
        }
        onDevice = try {
            var status = ext.checkStatus()
            if (status == OnDeviceModelStatus.DOWNLOADABLE || status == OnDeviceModelStatus.DOWNLOADING) {
                var total = 0L
                ext.download().collect { s ->
                    when (s) {
                        is DownloadStatus.DownloadStarted -> { total = s.bytesToDownload; onProgress("Downloading this phone's reader") }
                        is DownloadStatus.DownloadInProgress ->
                            onProgress(if (total > 0) "Downloading this phone's reader, ${s.totalBytesDownloaded * 100 / total}%" else "Downloading this phone's reader")
                        is DownloadStatus.DownloadFailed -> throw s.exception
                        else -> {}
                    }
                }
                status = ext.checkStatus()
            }
            if (status == OnDeviceModelStatus.AVAILABLE) {
                onProgress("Getting this phone's reader ready")
                ext.warmUp()
                OnDeviceState(true, "available", runCatching { ext.getModelName() }.getOrNull())
            } else {
                OnDeviceState(false, status.toString().lowercase())
            }
        } catch (e: Exception) {
            OnDeviceState(false, "unavailable: ${e.message ?: e.javaClass.simpleName}")
        }
        return onDevice
    }

    override val triage: (suspend (Bitmap) -> TriageResult)?
        get() = if (onDevice.ready) ::triageOnDevice else null

    /** Throws on any failure or answer from anywhere but the phone, so the loop falls back to the cloud read. */
    suspend fun triageOnDevice(photo: Bitmap): TriageResult {
        val t0 = SystemClock.elapsedRealtime()
        val response = triageModel.generateObject(
            TriageAnswer.firebaseAISchema(),
            content {
                image(photo)
                text(TRIAGE_PROMPT)
            },
        )
        check(response.response.inferenceSource == InferenceSource.ON_DEVICE) { "triage did not run on-device" }
        val a = response.getObject() ?: error("triage answer is missing its yes/no fields")
        return TriageResult(Triage(a.packageInView, a.dateInView, a.needsRefrigeration, a.product), SystemClock.elapsedRealtime() - t0)
    }

    override suspend fun read(photo: Bitmap, secondLook: Boolean, seen: String?): ReadResult {
        val t0 = SystemClock.elapsedRealtime()
        var attempt = 0
        while (true) {
            try {
                val response = cloudModel.generateObject(
                    readSchema,
                    content {
                        image(photo)
                        text(readPrompt(chart, secondLook, seen))
                    },
                )
                val (read, valid) = toItemRead(response.response.text ?: "", chart)
                val source = if (response.response.inferenceSource == InferenceSource.ON_DEVICE) "on_device" else "in_cloud"
                return ReadResult(read, source, SystemClock.elapsedRealtime() - t0, "only_in_cloud", valid)
            } catch (e: Exception) {
                android.util.Log.w("KeepUntil", "cloud read failed after ${SystemClock.elapsedRealtime() - t0} ms", e)
                // A rate limit says how long to wait; one sort table can hit it, so wait it out twice.
                val wait = retryDelayMs(e.message) ?: throw e
                if (attempt++ >= 2) throw e
                delay(wait)
            }
        }
    }
}

/** Shared with the web reader (web/src/ai/reader.ts). */
const val READ_MAX_TOKENS = 1024
const val READ_TIMEOUT_MS = 30_000L

private val RETRY_IN =Regex("retry in ([\\d.]+)s", RegexOption.IGNORE_CASE)

fun retryDelayMs(message: String?): Long? {
    if (message == null || !message.contains("429")) return null
    val s = RETRY_IN.find(message)?.groupValues?.get(1)?.toDoubleOrNull() ?: 20.0
    return minOf(60_000L, (s * 1000).toLong() + 250)
}
