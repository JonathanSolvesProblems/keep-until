// Sign-in, settings and the item log. Writes go to Firestore in exactly the shape
// firestore.rules allows, the same record the web app writes (web/src/store.ts), with
// platform "android". Firestore's offline cache is on by default on Android, so a logged item
// lands on the phone at once and syncs when the warehouse Wi-Fi comes back.
//
// The food bank's Google Sheet is the coordinator's side and stays in the web app: a phone at
// the sort table logs to the same item log, and the sheet is filled from the laptop.

package com.keepuntil.sort.data

import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.firestore
import com.google.firebase.remoteconfig.remoteConfig
import com.google.firebase.remoteconfig.remoteConfigSettings
import com.keepuntil.sort.gate.ParsedDate
import com.keepuntil.sort.gate.Policy
import com.keepuntil.sort.loop.Step
import com.keepuntil.sort.loop.itemFacts
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

data class Settings(val cloudModel: String, val policy: Policy, val foodBankId: String, val foodBankName: String)

/** Must match remoteconfig.template.json, so the app behaves the same before the first fetch. */
private val DEFAULTS = mapOf(
    "cloud_model" to "gemini-3.5-flash-lite",
    "chart_bound" to "min",
    "chart_overrides" to "{}",
    "food_bank_id" to "demo",
    "food_bank_name" to "Demo food bank",
)

class Backend {
    private val auth = Firebase.auth
    private val db = Firebase.firestore
    private val config = Firebase.remoteConfig

    /** Volunteers sign in anonymously: nothing about a person is collected at the sort table. */
    suspend fun signIn(): String = (auth.currentUser ?: auth.signInAnonymously().await().user!!).uid

    suspend fun loadSettings(): Settings {
        config.setConfigSettingsAsync(remoteConfigSettings { minimumFetchIntervalInSeconds = 3600 }).await()
        config.setDefaultsAsync(DEFAULTS).await()
        try {
            config.fetchAndActivate().await()
        } catch (e: Exception) {
            // Offline or blocked: the defaults above apply.
        }
        val overrides = try {
            Json.decodeFromString(MapSerializer(String.serializer(), com.keepuntil.sort.gate.Override.serializer()), config.getString("chart_overrides").ifEmpty { "{}" })
        } catch (e: Exception) {
            emptyMap()
        }
        return Settings(
            cloudModel = config.getString("cloud_model"),
            policy = Policy(bound = if (config.getString("chart_bound") == "max") "max" else "min", overrides = overrides),
            foodBankId = config.getString("food_bank_id"),
            foodBankName = config.getString("food_bank_name"),
        )
    }

    /** The shift id is made on the phone, so a shift can start with no network at all. */
    fun startShift(settings: Settings, uid: String, onDevice: String): String {
        val ref = db.collection("foodBanks").document(settings.foodBankId).collection("shifts").document()
        ref.set(
            mapOf(
                "startedBy" to uid,
                "startedAt" to FieldValue.serverTimestamp(),
                "mode" to "prefer_on_device",
                "platform" to "android",
                "onDevice" to onDevice,
                "cloudModel" to settings.cloudModel,
            ),
        )
        return ref.id
    }

    fun logItem(settings: Settings, shiftId: String, uid: String, step: Step.Decided): String {
        // The item as all its photos showed it (the name from the front, the date from the top).
        val last = if (step.reads.isEmpty()) null else itemFacts(step.reads)
        val override = settings.policy.overrides[last?.category ?: ""]
        val record = mapOf(
            "createdBy" to uid,
            "createdAt" to FieldValue.serverTimestamp(),
            "shiftId" to shiftId,
            "platform" to "android",
            "product" to (last?.product ?: ""),
            "brand" to (last?.brand ?: ""),
            "category" to (last?.category ?: ""),
            "dateText" to (last?.dateText ?: ""),
            "dateKind" to (last?.dateKind ?: "none_visible"),
            "parsedDate" to when (val p = step.parsed) {
                is ParsedDate.Exact -> p.iso
                is ParsedDate.Ambiguous -> p.candidates.joinToString(" | ")
                else -> null
            },
            "damage" to (last?.damage ?: "unsure"),
            "decision" to step.verdict.decision,
            "keepUntil" to step.verdict.keepUntil,
            "pastPrintedDate" to step.verdict.pastPrintedDate,
            "reason" to step.verdict.reason,
            "chartPage" to step.verdict.chart?.page,
            "policy" to if (override != null) "food bank policy: ${override.value} ${override.rule}" else "chart ${settings.policy.bound} bound",
            "route" to step.route,
            // What the model chose at each read and where it ran: the loop, kept with the record.
            "reads" to step.reads.map {
                mapOf(
                    "source" to it.source,
                    "ms" to it.ms,
                    "mode" to it.mode,
                    "nextAction" to it.read.nextAction,
                    "confidence" to it.read.confidence,
                    "why" to it.read.why,
                )
            },
            "barcode" to null,
        )
        val ref = db.collection("foodBanks").document(settings.foodBankId).collection("items").document()
        ref.set(record)
        return ref.id
    }
}
