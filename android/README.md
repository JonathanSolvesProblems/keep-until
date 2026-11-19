# Keep Until for Android

The sort table on a phone. A volunteer holds a donated item up to the phone's camera and presses
Read item. Gemini Nano on the phone checks the photo first (is there a package, is a date in view,
does it need the fridge) and answers "nothing in view" and "turn it" itself, with nothing sent
anywhere. Only a photo with a date worth reading goes to the cloud model for the full read. The
Food Banks Canada chart then decides: keep until a date, set aside for the lead, or discard (only
after two reads agree on the date). Every answer says where it was read.

It is the same product as the web app in `web/`, on the same Firebase project, and it writes the
same item log. The Google Sheet stays the coordinator's tool on the laptop.

## How to run it

Needs Android Studio (or JDK 17 and the Android SDK 36) and a phone on Android 8 or later.

```
cd android
./gradlew testDebugUnitTest     # the gate and the loop, offline
./gradlew assembleDebug         # app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug          # onto a phone plugged in with USB debugging on
```

Two files are not in the repo and the build needs them:

- `app/google-services.json`: `npx -y firebase-tools@latest apps:sdkconfig ANDROID <app id> --out app/google-services.json`
- `local.properties`: `sdk.dir=...` and `appcheck.debug.token=<uuid>`. The token must be
  registered for the Android app under App Check, Manage debug tokens. Firebase AI Logic
  requires App Check; a release build uses Play Integrity instead.

## What runs where

| Step | Where | How |
|---|---|---|
| Check the photo (package? date in view? fridge?) | On the phone, Gemini Nano through AICore | Firebase AI Logic, `InferenceMode.ONLY_ON_DEVICE`, structured output from a `@Generable` class |
| Read the date, product and chart row | Cloud, `cloud_model` from Remote Config | Firebase AI Logic, `InferenceMode.ONLY_IN_CLOUD`, JSON schema, minimal thinking |
| Keep, set aside or discard | On the phone, in code | `gate/Chart.kt`, the chart's row and page on every answer |

On a phone that is not on the ML Kit Prompt API device list (a Galaxy S24, for one), the check is
skipped and the screen says "Read in the cloud, this phone has no on-device model". The first
Gemini Nano call can take minutes while the model loads, so it is prepared in the background when
the shift starts, and items read meanwhile go to the cloud and say so. A check that takes over
20 seconds is given up for that item.

## The gate is the web app's gate

`gate/Dates.kt` and `gate/Chart.kt` port `web/src/chart/dates.ts` and `chart.ts`, and read the same
`shared/fbc-shelf-life-2018.json`. `GateVectorsTest` replays `shared/gate-vectors.json`, which
`node scripts/export_gate_vectors.mjs` writes from the TypeScript: 294 date stamps on three sort
dates and 2,580 chart decisions across all 84 rows. The two must give exactly the same answer to
every one, or the test fails. `LoopTest` mirrors `web/src/ai/loop.test.ts` with fake models.

## Fonts

Doto and Atkinson Hyperlegible Next, both under the SIL Open Font License 1.1 (`licenses/`).
