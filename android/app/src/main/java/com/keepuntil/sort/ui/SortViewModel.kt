// The shift: sign in, load the food bank's settings, get this phone's reader ready in the
// background, then one item at a time through the loop. The screen only draws this state.

package com.keepuntil.sort.ui

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.keepuntil.sort.scaledTo
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.keepuntil.sort.ai.OnDeviceState
import com.keepuntil.sort.ai.PhoneReaders
import com.keepuntil.sort.data.Backend
import com.keepuntil.sort.data.Settings
import com.keepuntil.sort.gate.Chart
import com.keepuntil.sort.loop.SortLoop
import com.keepuntil.sort.loop.Step
import java.time.LocalDate
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoggedRow(val name: String, val answer: Answer)

data class SortState(
    /** One line at the top: the food bank, the day, and how items are being read. */
    val status: String = "Ready. Press Start shift to turn on the camera.",
    val started: Boolean = false,
    val reading: Boolean = false,
    val answer: Answer? = null,
    val readBy: String = "",
    val prompt: String = "",
    val log: List<LoggedRow> = emptyList(),
    /** A sample photo being read, shown in the camera's place. */
    val still: ImageBitmap? = null,
    val sampleLabel: String = "Try a sample photo",
    val sampleNote: String = "No item to hand? This reads a real photo from my pantry, the same way.",
)

class SortViewModel(app: Application) : AndroidViewModel(app) {
    private val chart = Chart(app.assets.open("fbc-shelf-life-2018.json").bufferedReader().use { it.readText() })
    private val backend = Backend()
    private val _state = MutableStateFlow(SortState())
    val state: StateFlow<SortState> = _state

    private var settings: Settings? = null
    private var readers: PhoneReaders? = null
    private var loop: SortLoop<Bitmap>? = null
    private var uid: String? = null
    private var shiftId: String? = null
    private var pendingTurn: Step? = null
    private var warmUp: Job? = null

    private fun setStatus(s: String) = _state.update { it.copy(status = s) }

    private fun online(): Boolean {
        val cm = getApplication<Application>().getSystemService(android.net.ConnectivityManager::class.java) ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        // VALIDATED: the phone has actually reached the internet. A router with no uplink, or a
        // sign-in page, has INTERNET and still cannot read a date.
        return caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    // The first two are one item: a broth carton's front (name, no date), then its top (date, no
    // name). The third is a yogurt lid.
    private val samples = listOf("samples/carton-front.jpg", "samples/carton-top.jpg", "samples/yogurt-lid.jpg")
    private var nextSample = 0

    fun readSample() {
        if (loop == null || _state.value.reading) return
        val photo = getApplication<Application>().assets.open(samples[nextSample++ % samples.size]).use { BitmapFactory.decodeStream(it) }
        _state.update { it.copy(still = photo.asImageBitmap()) }
        readItem(photo.scaledTo(1024), photo.scaledTo(512), sample = true)
    }

    fun startShift() {
        if (_state.value.started) return
        viewModelScope.launch {
            setStatus("Starting the shift")
            try {
                uid = backend.signIn()
                val s = backend.loadSettings()
                settings = s
                val r = PhoneReaders(chart, s.cloudModel)
                readers = r
                loop = SortLoop(chart, r)
                _state.update { it.copy(started = true) }
                setStatus("${s.foodBankName}. Getting this phone's reader ready.")
                // The first Gemini Nano call can take minutes while the model loads, so it gets
                // ready in the background; items read meanwhile go to the cloud and say so.
                warmUp = viewModelScope.launch {
                    val on = r.prepare { progress -> setStatus("${s.foodBankName}. $progress.") }
                    shiftId = backend.startShift(s, uid!!, on.status)
                    setStatus(statusLine(s, on))
                }
            } catch (e: Exception) {
                setStatus("Could not start the shift: ${e.message ?: "no connection"}. Check the Wi-Fi and try again.")
                _state.update { it.copy(started = false) }
            }
        }
    }

    private fun statusLine(s: Settings, on: OnDeviceState): String {
        val day = LocalDate.now().let { "${it.dayOfWeek.name.lowercase().replaceFirstChar(Char::uppercase)}, ${longDate(it.toString())}" }
        val how = if (on.ready) "Checking each item on this phone first, dates read in the cloud." else "Reading in the cloud: this phone has no on-device model."
        return "${s.foodBankName}, sorting $day. $how"
    }

    fun readItem(photo: Bitmap, small: Bitmap, sample: Boolean = false) {
        val l = loop ?: return
        val s = settings ?: return
        if (_state.value.reading) return
        _state.update { it.copy(reading = true, prompt = "", still = if (sample) it.still else null) }
        viewModelScope.launch {
            try {
                val previous = (pendingTurn as? Step.NeedDatePhoto)?.reads ?: emptyList()
                val step = l.processItem(photo, small, LocalDate.now().toString(), s.policy, previous)
                pendingTurn = if (step is Step.NeedDatePhoto) step else null
                val answer = answerOf(step)
                val phoneHasModel = readers?.onDevice?.ready == true
                var log = _state.value.log
                if (step is Step.Decided) {
                    // A sample is shown in this shift's list but never written to the food bank's log.
                    if (!sample) {
                        val shift = shiftId ?: backend.startShift(s, uid!!, readers?.onDevice?.status ?: "unknown").also { shiftId = it }
                        backend.logItem(s, shift, uid!!, step)
                    }
                    log = listOf(LoggedRow(if (sample) "${itemName(step)} (sample)" else itemName(step), answer)) + log
                }
                val turnSample = sample && step is Step.NeedDatePhoto
                _state.update {
                    it.copy(
                        answer = answer,
                        readBy = readBy(step, phoneHasModel),
                        log = log,
                        sampleLabel = if (turnSample) "Turn the sample item" else if (sample) "Try another sample photo" else it.sampleLabel,
                        sampleNote = if (turnSample) "The next sample is the same carton, turned." else if (sample) "Real photos from my pantry. Samples are never added to a food bank's log." else it.sampleNote,
                    )
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e // the screen was closed mid-read: not a failed read, and not reported as one
            } catch (e: Exception) {
                android.util.Log.w("KeepUntil", "read failed", e)
                // A failed read is not a crash, but it is the failure a volunteer meets, so it is
                // reported to Crashlytics with whether the phone was online and could read on-device.
                com.google.firebase.crashlytics.FirebaseCrashlytics.getInstance().apply {
                    setCustomKey("online", online())
                    setCustomKey("on_device", readers?.onDevice?.status ?: "unknown")
                    recordException(e)
                }
                // Asked of the phone, not guessed from the error text: in airplane mode the SDK's
                // message named no network (Android 8 emulator, 2026-11-20), and the volunteer was
                // told to hold the item steady.
                _state.update { it.copy(prompt = if (!online()) OFFLINE else readFailure(e)) }
            } finally {
                _state.update { it.copy(reading = false) }
            }
        }
    }

    fun cameraFailed() = _state.update { it.copy(prompt = "No camera picture. Allow the camera for Keep Until in the phone's settings.") }
}

const val OFFLINE = "No connection. This phone reads dates in the cloud, so reading waits for Wi-Fi. Items already read stay in this shift's list."

/** Why a read failed, in the volunteer's words. */
fun readFailure(e: Exception): String {
    val m = e.message ?: ""
    return when {
        Regex("app ?check|attestation|PERMISSION_DENIED", RegexOption.IGNORE_CASE).containsMatchIn(m) ->
            "Google could not verify this phone, so it will not read items here. Use the laptop for this shift."
        Regex("prepayment|RESOURCE_EXHAUSTED|429").containsMatchIn(m) -> "The cloud reader is busy. Wait a minute and press Read item again."
        Regex("Unable to resolve host|timeout|network", RegexOption.IGNORE_CASE).containsMatchIn(m) -> "No connection. Dates are read in the cloud, so this needs Wi-Fi."
        else -> "That read did not go through. Hold the item steady and press Read item again."
    }
}
