# Submission, #BuildHybridAI 2026

Final values only. One field per block. `[X]` marks a value still to come.

## Project name

```
Keep Until
```

## Tagline

```
Hold up a donated can and it says keep until when. Gemini Nano checks each photo on the laptop; 10 of 16 never left it.
```

## Platforms

```
Web (Chrome), Android
```

## Try it

```
https://keep-until-hybrid.web.app
```

## Repository

```
https://github.com/JonathanSolvesProblems/keep-until
```

## Video

```
[X]
```

## Story

```markdown
## Inspiration

A volunteer on a first shift at a food bank sort table picks up a carton of broth. The top says `2027 FE 14 02146`. Is that a date? Is it past? A 2019 guest post on Food Banks Canada's blog names what often happens next: "Many people incorrectly say food has 'expired' if it reaches its best before date, so they throw it out." Food Banks Canada publishes a chart of how long each kind of food stays good past its best-before date, and nobody looks a row up in it with a can in each hand.

[X: one sentence from the sort lead, with their name and role]

## What it does

The volunteer holds the item up to a laptop or phone camera.

- **Hands-free on the laptop.** Gemini Nano runs in Chrome on the laptop and looks at the camera whenever it is free: is a package in view, is its date facing the camera, does it need the fridge. It says "turn it" itself, and it calls the cloud only when a date faces the camera. Watching all the time is something only the on-device model can afford: in the cloud it would be a paid call, and a picture of the sort table leaving the building, every second or two. Without Nano (another browser, or the phone) the volunteer presses **Read item** instead.
- The cloud model reads the stamp exactly as printed (Canadian stamps put the year first and use bilingual months: `2027 FE 14`).
- Food Banks Canada's chart decides, in code: **keep until** a date, **set aside** for the sort lead (fridge items, damage, two reads that disagree), or **discard**. A discard needs a second, independent read that finds the same date; the second read is never told what the first one found.
- One item is often two photos. The front shows the name and no date; the top shows the date and no name. Keep Until asks for the side it is missing and settles from both.
- Every item lands as a row in the food bank's own Google Sheet, and in Firestore. With no connection, items already read are kept and their rows wait until the Wi-Fi is back; new date reads wait too, because they happen in the cloud.
- After the shift it keeps working. Every morning a Cloud Function pulls the Government of Canada recall feed and lists kept items that share a brand with a food recall. At the next shift start Gemini settles each one: pull it, check the lot code, or no match. Pulls appear at the top of the screen and in the sheet.

The screen is built to be read from a metre away with an item in your hand: the decision floods the panel in its colour with the word, and the stamp is re-printed large in a dot-matrix face, the way the coder printed it.

## How I built it on Firebase

- **Firebase AI Logic, hybrid inference, chosen per feature.** The photo check runs on-device (Gemini Nano in Chrome, the Prompt API through `InferenceMode.ONLY_ON_DEVICE` with a JSON schema); the date read runs in the cloud (`gemini-3.5-flash-lite`, minimal thinking, `responseJsonSchema`); the recall check uses `PREFER_IN_CLOUD` with Nano as the offline fallback. Every answer records `inferenceSource`, and the screen says where each read happened and how long it took.
- **I chose the split by measuring it.** My first design read everything on Nano. On real Gemini Nano it handled 4 of 15 photos; as a checker it handled 10 of 15. So Nano checks and the cloud reads dates.
- **App Check** (reCAPTCHA Enterprise on web, debug provider on Android), **Authentication** (anonymous for volunteers, Google with Drive file access for the coordinator's sheet), **Firestore** (offline persistence, append-only rules), **Remote Config** (the cloud model and each food bank's own policy over the chart), **Performance Monitoring** (a trace around every read, tagged on-device or cloud), **Cloud Functions with Cloud Scheduler** (the daily recall pull) and **Hosting**.
- **Android** runs the same loop and the same chart gate in Kotlin (`firebase-ai` with `firebase-ai-ondevice`, on-device first). The two gates are proven identical on 294 date stamps and 2,580 chart decisions written by the TypeScript and replayed by a Kotlin test. I ran it on a Galaxy S24 and on Android 8 and Android 16 emulators: same answers, and on each it says it reads in the cloud because the phone has no on-device model.
- Every decision, with the measurement behind it, is in `devpost/build-log.md`.

## Results

Sixteen photos of eight real products from my pantry, labelled by hand before any model run, graded by a script:

| How items are read | Handled right | Cloud calls for 16 photos |
|---|---|---|
| Nano checks every photo, the cloud reads dates | 13 of 15 | 6 |
| Cloud only | 14 of 15 | 16 |
| Gemini Nano alone on the laptop | 4 of 15 | 0 |

The hybrid gives up one photo against cloud only, and neither of its misses is a wrong keep or discard: each asks the volunteer to turn the item once more. In exchange 10 of 16 photos never leave the laptop.

This set mostly tests routing. Nine of the 15 scored photos should get "turn it", so an app that always said "turn it" would score 9 of 15, and only two photos show a date that should be logged (both modes read one of them right). Date reading needs a larger set of dated items, which is the next measurement.

Why a discard needs two reads: in one run the cloud model read the Chipits bag as `26MA14`, a date already past, and the app said discard. The bag says May 2027. In the next run the same photo read `2027 MA 17` (`results/pantry-2026-11-15-cloud-repeatability.md`). Since then a discard needs a second, independent read that finds the same date, and when the two disagree the item goes to the sort lead.

The recall check, on 8 real Government of Canada notices with the expected answers committed before the run: Gemini 8 of 8, brand alone 3 of 8. Brand matching alone would have pulled five items that were never recalled, among them Hershey's Chipits against the August 2026 Hershey's Kisses almond recall.

A script fails the build if any number on this page or in the README stops matching its results file.

## Limits

- It does not read lot codes, so a recall limited to certain lots is always "check the lot code" for the lead.
- Gemini Nano's first call after Chrome starts can take minutes; the laptop check warms up in the background and items go to the cloud until it is ready.
- No Android phone has run Gemini Nano for this app yet. Firebase Test Lab's Pixel 10, Pixel 11 and Galaxy S26 carry a stub AICore, Android emulators have no AICore at all, and my own phone is a Galaxy S24, which is not on Google's list. On those phones the app takes the cloud path and says so on the screen.
- Hands-free needs Gemini Nano, so it is on the laptop in Chrome only. Everywhere else the volunteer presses Read item, and the app says why.

## What's next

[X: the sort shift at North York Harvest, and what the lead said to change]

## How to check each judging criterion

- **Technological implementation.** Three Firebase AI Logic modes, one per job: `ONLY_ON_DEVICE` for watching the camera, the cloud for reading dates, `PREFER_IN_CLOUD` for recalls. The ablation behind the split is in `results/ablation-inference-mode.md`, and the same loop runs on Web and Android.
- **Design.** Open the live link and press "Try a sample photo": the answer fills the panel in its colour with the word, and the stamp is re-printed the way the coder printed it. On the phone, try it with Wi-Fi off.
- **Potential impact.** The chart and the quote are Food Banks Canada's, the recall notices are the Government of Canada's, and every number on this page is checked against its results file by `scripts/check_claims.py` in CI.
- **Quality of the idea.** The model reads and the chart decides. A discard needs two independent reads, and the app keeps checking kept items against new recalls after the shift ends.
```
