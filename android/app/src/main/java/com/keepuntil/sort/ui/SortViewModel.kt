// The shift: sign in, load the food bank's settings, get this phone's reader ready in the
// background, then one item at a time through the loop. The screen only draws this state.

package com.keepuntil.sort.ui

import android.app.Application
import android.graphics.Bitmap
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
    val status: String = "Getting ready",
    val started: Boolean = false,
    val reading: Boolean = false,
    val answer: Answer? = null,
    val readBy: String = "",
    val prompt: String = "",
    val log: List<LoggedRow> = emptyList(),
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

    fun readItem(photo: Bitmap, small: Bitmap) {
        val l = loop ?: return
        val s = settings ?: return
        if (_state.value.reading) return
        _state.update { it.copy(reading = true, prompt = "") }
        viewModelScope.launch {
            try {
                val previous = (pendingTurn as? Step.NeedDatePhoto)?.reads ?: emptyList()
                val step = l.processItem(photo, small, LocalDate.now().toString(), s.policy, previous)
                pendingTurn = if (step is Step.NeedDatePhoto) step else null
                val answer = answerOf(step)
                val phoneHasModel = readers?.onDevice?.ready == true
                var log = _state.value.log
                if (step is Step.Decided) {
                    val shift = shiftId ?: backend.startShift(s, uid!!, readers?.onDevice?.status ?: "unknown").also { shiftId = it }
                    backend.logItem(s, shift, uid!!, step)
                    log = listOf(LoggedRow(itemName(step), answer)) + log
                }
                _state.update { it.copy(answer = answer, readBy = readBy(step, phoneHasModel), log = log) }
            } catch (e: Exception) {
                _state.update { it.copy(prompt = readFailure(e)) }
            } finally {
                _state.update { it.copy(reading = false) }
            }
        }
    }

    fun cameraFailed() = _state.update { it.copy(prompt = "No camera picture. Allow the camera for Keep Until in the phone's settings.") }
}

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
