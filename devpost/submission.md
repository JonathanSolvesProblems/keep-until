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

A volunteer on a first shift at a food bank sort table picks up a carton of broth. The top says `2027 FE 14 02146`. Is that a date? Is it past? Food Banks Canada's own blog names what happens next: "Many people incorrectly say food has 'expired' if it reaches its best before date, so they throw it out." Food Banks Canada publishes a chart of how long each kind of food stays good past its best-before date, but nobody reads a 12-page chart with a can in each hand.

[X: one sentence from the sort lead, with their name and role]

## What it does

The volunteer holds the item up to a laptop or phone camera and presses **Read item**.

- Gemini Nano checks the photo on the laptop first: is a package in view, is a date in view, does it need the fridge. "Nothing in view" and "turn it" are answered right there, and the photo goes nowhere.
- Only a photo with a date worth reading goes to the cloud model, which reads the stamp exactly as printed (Canadian stamps put the year first and use bilingual months: `2027 FE 14`).
- Food Banks Canada's chart decides, in code: **keep until** a date, **set aside** for the sort lead (fridge items, damage, two reads that disagree), or **discard**. A discard needs a second read that finds the same date. Nothing is binned on one read.
- One item is often two photos. The front shows the name and no date; the top shows the date and no name. Keep Until asks for the side it is missing and settles from both.
- Every item lands as a row in the food bank's own Google Sheet, and in Firestore. It works offline and catches up.
- After the shift it keeps working. Every morning a Cloud Function pulls the Government of Canada recall feed and lists kept items that share a brand with a food recall. At the next shift start Gemini settles each one: pull it, check the lot code, or no match. Pulls appear at the top of the screen and in the sheet.

The screen is built to be read from a metre away with an item in your hand: the decision floods the panel in its colour with the word, and the stamp is re-printed large in a dot-matrix face, the way the coder printed it.

## How I built it on Firebase

- **Firebase AI Logic, hybrid inference, chosen per feature.** The photo check runs on-device (Gemini Nano in Chrome, the Prompt API through `InferenceMode.ONLY_ON_DEVICE` with a JSON schema); the date read runs in the cloud (`gemini-3.5-flash-lite`, minimal thinking, `responseJsonSchema`); the recall check uses `PREFER_IN_CLOUD` with Nano as the offline fallback. Every answer records `inferenceSource`, and the screen says where each read happened and how long it took.
- **The split was decided by measurement, not by plan.** My first design read everything on Nano. On real Gemini Nano it handled 4 of 15 photos; as a checker it handled 10 of 15. So Nano checks and the cloud reads dates.
- **App Check** (reCAPTCHA Enterprise on web, debug provider on Android), **Authentication** (anonymous for volunteers, Google with Drive file access for the coordinator's sheet), **Firestore** (offline persistence, append-only rules), **Remote Config** (the cloud model and each food bank's own policy over the chart), **Performance Monitoring** (a trace around every read, tagged on-device or cloud), **Cloud Functions with Cloud Scheduler** (the daily recall pull) and **Hosting**.
- **Android** runs the same loop and the same chart gate in Kotlin. The two gates are proven identical on 294 date stamps and 2,580 chart decisions written by the TypeScript and replayed by a Kotlin test.
- Every decision, with the measurement behind it, is in `devpost/build-log.md`.

## Results

Sixteen photos of eight real products from my pantry, labelled by hand before any model run, graded by a script:

| How items are read | Handled right | Cloud calls for 16 photos |
|---|---|---|
| Nano checks every photo, the cloud reads dates | 13 of 15 | 6 |
| Cloud only | 14 of 15 | 16 |
| Gemini Nano alone on the laptop | 4 of 15 | 0 |

The hybrid gives up one photo against cloud only, and neither of its misses is a wrong keep or discard: each asks the volunteer to turn the item once more. In exchange 10 of 16 photos never leave the laptop.

The recall check, on 8 real Government of Canada notices with the expected answers committed before the run: Gemini 8 of 8, brand alone 3 of 8. Brand matching alone would have pulled five items that were never recalled, among them Hershey's Chipits against the August 2026 Hershey's Kisses almond recall.

A script fails the build if any number on this page or in the README stops matching its results file.

## Limits

- It does not read lot codes, so a recall limited to certain lots is always "check the lot code" for the lead.
- Gemini Nano's first call after Chrome starts can take minutes; the laptop check warms up in the background and items go to the cloud until it is ready.
- No Android phone has run Gemini Nano for this app yet. Firebase Test Lab's Pixel 10, Pixel 11 and Galaxy S26 carry a stub AICore, and my own phone is a Galaxy S24, which is not on Google's list. On those phones the app takes the cloud path and says so on the screen.

## What's next

[X: the sort shift at North York Harvest, and what the lead said to change]

## Why it fits the Grand Prize and Best Web/Chrome

"Does the project deliver a complete, coherent product experience, not just a technical proof of concept?"

- **Technological implementation:** three Firebase AI Logic policies chosen per feature, with the on-device job picked by measurement and a published ablation.
- **Design:** one screen, read from a metre away, every limit said in words on it.
- **Potential impact:** Food Banks Canada's own chart and its own blog name the problem; every number traces to a source.
- **Quality of the idea:** the model reads, the chart decides, nothing is binned on one read, and the app keeps watching for recalls after the shift ends.
```
