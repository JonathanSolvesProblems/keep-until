# Submission, #BuildHybridAI 2026

Final values only. One field per block. `[X]` marks a value still to come.

## Project name

```
Keep Until
```

## Tagline

```
Hold up a donated item and it says keep until when. Gemini Nano watches the camera on the laptop at no cost and calls the cloud only for dates: 36 checks on the laptop, 3 calls to the cloud.
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

- **Hands-free on the laptop.** Gemini Nano runs in Chrome on the laptop and looks at the camera whenever it is free: is a package in view, is its date facing the camera, does it need the fridge. It says "turn it" itself, and it calls the cloud only when a date faces the camera. Watching all the time is something only the on-device model can afford: in the cloud it would be a paid call, and a picture of the sort table leaving the building, every few seconds. It says each answer aloud ("Keep. Until 14 February 2029."), so the volunteer can look at the item and not the screen; the spoken sentence is built only from what the screen shows. Without Nano (another browser, or the phone) the volunteer presses **Read item** instead.
- The cloud model reads the stamp exactly as printed (Canadian stamps put the year first and use bilingual months: `2027 FE 14`).
- Food Banks Canada's chart decides, in code: **keep until** a date, **set aside** for the sort lead (fridge items, damage, two reads that disagree), or **discard**. A discard needs a second, independent read that finds the same date; the second read is never told what the first one found.
- One item is often two photos. The front shows the name and no date; the top shows the date and no name. Keep Until asks for the side it is missing and settles from both.
- Every item lands as a row in the food bank's own Google Sheet, and in Firestore. With no connection, items already read are kept and their rows wait until the Wi-Fi is back; new date reads wait too, because they happen in the cloud.
- After the shift it keeps working. Every morning a Cloud Function pulls the Government of Canada recall feed and lists kept items that share a brand with a food recall. At the next shift start Gemini settles each one: pull it, check the lot code, or no match. Pulls appear at the top of the screen and in the sheet.

The screen is built to be read from a metre away with an item in your hand: the decision floods the panel in its colour with the word, and the stamp is re-printed large in a dot-matrix face, the way the coder printed it.

## How I built it on Firebase

- **Firebase AI Logic, hybrid inference, chosen per feature.** The photo check runs on-device (Gemini Nano in Chrome, the Prompt API through `InferenceMode.ONLY_ON_DEVICE` with a JSON schema); the date read runs in the cloud (`gemini-3.5-flash-lite`, minimal thinking, `responseJsonSchema`); the recall check uses `PREFER_IN_CLOUD` with Nano as the offline fallback. Every answer records `inferenceSource`, and the screen says where each read happened and how long it took.
- **I chose the split by measuring it.** My first design read everything on Nano. On real Gemini Nano it handled 4 of 15 photos; as a checker (is a package in view, is a date facing the camera) it was right on 10 of 15. So Nano checks and the cloud reads dates.
- **App Check** (reCAPTCHA Enterprise on web, debug provider on Android), **Authentication** (anonymous for volunteers, Google with Drive file access for the coordinator's sheet), **Firestore** (offline persistence, append-only rules), **Remote Config** (the cloud model and each food bank's own policy over the chart), **Performance Monitoring** (a trace around every read, tagged on-device or cloud), **Cloud Functions with Cloud Scheduler** (the daily recall pull, retried when the feed download drops), **Crashlytics** on Android (a failed read is reported with whether the phone was online and could read on-device) and **Hosting**.
- **Android** runs the same loop and the same chart gate in Kotlin (`firebase-ai` with `firebase-ai-ondevice`, on-device first). The two gates are proven identical on 294 date stamps and 2,580 chart decisions written by the TypeScript and replayed by a Kotlin test. I ran it on a Galaxy S24 and on Android 8 and Android 16 emulators: same answers, and on each it says it reads in the cloud because the phone has no on-device model.
- Every decision, with the measurement behind it, is in `devpost/build-log.md`.

## Results

Hands-free, on real Gemini Nano in my Chrome: a 70-second clip of pantry photos (empty table, a carton's front, its top, the table, a yogurt lid) played in the camera's place, and nobody touched the laptop. 36 checks on the laptop, 3 calls to the cloud, and both items got the right answers: turn it, then keep, for the carton; set aside for the yogurt. Once an item was answered, the laptop kept checking and sent nothing until the table was clear (`results/handsfree-clip-2026-11-22.md`). You can watch the recorded run, every check and answer as the app made them, at https://keep-until-hybrid.web.app/?replay=1 in any browser. One run of two items shows the loop working on the real model; accuracy needs many more dated items.

Sixteen photos of eight real products from my pantry, labelled by hand before any model run, graded by a script:

| How items are read | Handled right | Cloud calls for 16 photos |
|---|---|---|
| Nano checks every photo, the cloud reads dates | 13 of 15 | 6 |
| Cloud only | 14 of 15 | 16 |
| Gemini Nano alone on the laptop | 4 of 15 | 0 |

The hybrid gives up one photo against cloud only, and neither of its misses is a wrong keep or discard: each asks the volunteer to turn the item once more. In exchange 10 of 16 photos never leave the laptop.

This set mostly tests routing. Nine of the 15 scored photos should get "turn it", so an app that always said "turn it" would score 9 of 15, and only two photos show a date that should be logged (both modes read one of them right). So date reading has its own test, on photos that are not mine: 100 products sold in Canada whose expiry date an Open Food Facts volunteer confirmed, registered before the run. The app read the same date on 71 of 100. A reviewer who looked at the 29 misses found that on 14 the package prints two dates and the app read the best-before or expiry while the confirmed date was the packed-on date; 5 confirmed dates were not food dates; 6 were not legible; 1 was the same date written with a two-digit year; 2 were clear misreads by the app (`results/date-control-off-ca-2026-11-22.md`). These are numeric dates; the year-first Canadian stamps are only in my own pantry set.

Why a discard needs two reads: in one run the cloud model read the Chipits bag as `26MA14`, a date already past, and the app said discard. The bag says May 2027. In the next run the same photo read `2027 MA 17` (`results/pantry-2026-11-15-cloud-repeatability.md`). Since then a discard needs a second, independent read that finds the same date, and when the two disagree the item goes to the sort lead.

The recall check, on 16 pairs of a real Government of Canada recall notice and a same-brand item, in two sets whose expected answers were committed before each run: Gemini 16 of 16, brand plus a product word 11 of 16, brand alone 6 of 16. The second set is the hard part on purpose: Gemini cleared President's Choice chocolate chip cookies against a recall of its gingersnaps, and Great Value apple juice against a recall of its grape juice, and matched Amy's lentil soup read from the French side of the label. The set also found a gap of mine: the daily function proposes candidates by brand, and a brand printed as "PC" was too short for it, so that item would never have reached the model. The matcher now spells out store-brand short forms; one not on its list is still missed.

A script fails the build if any number on this page or in the README stops matching its results file.

## Limits

- It does not read lot codes, so a recall limited to certain lots is always "check the lot code" for the lead.
- Gemini Nano's first call after Chrome starts can take minutes (6.5 on 2026-11-22; on 2026-11-24 it had not answered after 15). The laptop check warms up in the background, items go to the cloud with Read item until it is ready, and hands-free starts by itself when it is.
- No Android phone has run Gemini Nano for this app yet. Firebase Test Lab's Pixel 10, Pixel 11 and Galaxy S26 carry a stub AICore, Android emulators have no AICore at all, and my own phone is a Galaxy S24, which is not on Google's list. On those phones the app takes the cloud path and says so on the screen.
- Hands-free needs Gemini Nano, so it is on the laptop in Chrome only. Everywhere else the volunteer presses Read item, and the app says why.
- Hands-free does not work on battery on my laptop. On battery its GPU drew 5 to 21 watts, Gemini Nano wrote about 4.5 tokens a second, and a check took 8 to 9 seconds, where it took about 2 on 2026-11-22 (`results/handsfree-clip-2026-11-26.md`). A check slower than 8 seconds is never acted on, and after two in a row hands-free switches itself off and says to plug the laptop in or press Read item.
- The run the page quotes and the replay plays was recorded on 2026-11-22. On 2026-11-24 a code review led me to rewrite the hands-free rules (an item could be read twice, or left unread). In the re-runs since, the rewritten rules answered the carton right each time it was read, once with a single cloud call where the old rules needed two; the yogurt was answered in one run and missed in the others, because those checks came late on battery. A full recording with the rewritten rules and the laptop plugged in is still to be made.

## What's next

Nobody at a food bank has used Keep Until yet, and that is the first thing to change. Between November 15 and 22 I wrote to Food Banks Canada, Feed Ontario, North York Harvest Food Bank, Food Banks Mississauga and Daily Bread Food Bank, asking how their volunteers decide what to keep past the date and whether I could try this at a sort shift. No shift happened before the deadline, so everything on this page was measured on my own pantry and on public photos.

- **A sort shift.** One morning at a real table gives the number this page does not have: how many items the chart says to keep that would otherwise have been binned.
- **Canadian stamps at scale.** The 100-photo test is numeric dates. Year-first stamps like `2027 FE 14` need their own set of a few hundred.
- **Lot codes,** so a recall limited to certain lots can be settled without the sort lead.
- **A phone that runs Gemini Nano,** to check the Android app's on-device path on real hardware.

## How to check each judging criterion

- **Technological implementation.** Three Firebase AI Logic modes, one per job: `ONLY_ON_DEVICE` for watching the camera, the cloud for reading dates, `PREFER_IN_CLOUD` for recalls. The ablation behind the split is in `results/ablation-inference-mode.md`, and the same loop runs on Web and Android.
- **Design.** Open the live link and press "Try a sample photo": the answer fills the panel in its colour with the word, and the stamp is re-printed the way the coder printed it. On the phone, try it with Wi-Fi off.
- **Potential impact.** A sort table decides on every donated item whether it is food or waste, and the volunteer deciding is often on a first shift. Keep Until gives that volunteer Food Banks Canada's own answer, logs it where the food bank already works, and keeps checking kept stock against recalls. The chart, the quote and the recall notices are published sources, and every number here is checked against its results file in CI.
- **Quality of the idea.** Gemini reads the stamp and Food Banks Canada's chart makes the call, in code. A discard needs two independent reads, and the app keeps checking kept items against new recalls after the shift ends.
```
