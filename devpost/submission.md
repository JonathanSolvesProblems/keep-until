# Submission, #BuildHybridAI 2026

Final values only. One field per block. `[X]` marks a value still to come.

## Project name

```
Keep Until
```

## Tagline

```
A food bank volunteer holds up a donated item and it says keep until when. Gemini Nano watches the camera on the laptop: 31 checks on the laptop, 2 calls to the cloud.
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

A volunteer at a food bank sort table picks up a donated carton of broth. The top says `2027 FE 14 02146`. Is that a date? Is it past? Food Banks Canada publishes a chart of how long each kind of food stays good past its best-before date, and nobody looks a row up in it with an item in each hand. A 2019 guest post on Food Banks Canada's blog says what people tend to do with a date instead: "Many people incorrectly say food has 'expired' if it reaches its best before date, so they throw it out."

[X: one sentence from the sort lead, with their name and role]

## What it does

The volunteer holds the item up to a laptop camera and does not touch anything.

- **The laptop watches.** Gemini Nano runs in Chrome on the laptop and checks the camera every couple of seconds: is a package in view, is its date facing the camera, does it need the fridge. It says "turn it" itself, and it calls the cloud only when a date or a fridge item faces the camera. Watching all the time is something only the on-device model can afford. In the cloud it would be a paid call, and a picture of the sort table leaving the building, every few seconds.
- **The cloud reads.** Gemini reads the stamp exactly as printed (Canadian stamps put the year first and use bilingual months: `2027 FE 14`) and names the kind of food.
- **The chart decides.** Code looks up Food Banks Canada's row for that kind of food and answers **keep until** a date, **set aside** for the sort lead, or **discard**. A discard needs a second, independent read that finds the same date; the second read is never told what the first one found.
- **One item is often two photos.** The front shows the name and no date, the top shows the date and no name. Keep Until asks for the side it is missing and settles from both.
- **It lands where the food bank works.** Every item becomes a row in the food bank's own Google Sheet, and in Firestore.
- **It keeps working after the shift.** Every morning a Cloud Function pulls the Government of Canada recall feed and lists kept items that share a brand with a food recall. At the next shift start Gemini settles each one: pull it, check the lot code, or no match.

Without Gemini Nano (another browser, or the Android app on a phone that cannot run it) the volunteer presses **Read item**, every read goes to the cloud, and the screen says so.

## How I built it on Firebase

A new project: the first commit is from November 14, 2026.

- **Firebase AI Logic, one mode per job.** Watching the camera is `InferenceMode.ONLY_ON_DEVICE` (Gemini Nano through Chrome's Prompt API, with a JSON schema), and the code refuses any answer whose `inferenceSource` is not `on_device`, so a camera frame can never fall through to the cloud by accident. Reading the date is cloud only (`gemini-3.5-flash-lite`, minimal thinking, `responseJsonSchema`). The recall check is `PREFER_IN_CLOUD`. Every answer records `inferenceSource`, and the screen says where each read happened and how long it took.
- **I chose the split by measuring it.** My first design read everything on Nano. On real Gemini Nano that handled 4 of 15 photos. As a checker (is a package in view, is a date facing the camera) Nano was right on 10 of 15. So Nano checks and the cloud reads.
- **App Check** (reCAPTCHA Enterprise on web, debug provider on Android), **Authentication** (anonymous for volunteers, Google with Drive file access for the coordinator's sheet), **Firestore** (offline persistence, append-only rules), **Remote Config** (the cloud model and each food bank's own policy over the chart), **Performance Monitoring** (a trace around every read, tagged on-device or cloud), **Cloud Functions with Cloud Scheduler** (the daily recall pull), **Crashlytics** on Android and **Hosting**.
- **Android** (Kotlin, `firebase-ai` with `firebase-ai-ondevice`) has the same read loop and the same chart gate, with a Read item button and no hands-free. The two gates agree on 294 date stamps and 2,580 chart decisions written by the TypeScript and replayed by a Kotlin test.

## Results

**Hands-free on real Gemini Nano.** A 70-second clip of my pantry photos played in the camera's place (an empty table, a carton's front, its top, a yogurt lid) and nobody touched the laptop: 31 checks on the laptop, 2 calls to the cloud, both items answered right. The laptop told me to turn the carton by itself, with nothing sent. Watch that run, check by check, in any browser: https://keep-until-hybrid.web.app/?replay=1

**Routing, against cloud only.** Sixteen pantry photos, labelled by hand before any run:

| How items are read | Handled right | Cloud calls for 16 photos |
|---|---|---|
| Nano checks every photo, the cloud reads | 13 of 15 | 6 |
| Cloud only | 14 of 15 | 16 |
| Gemini Nano alone on the laptop | 4 of 15 | 0 |

The hybrid gives up one photo, and neither of its misses is a wrong keep or discard: each asks for the item to be turned once more. This set mostly tests routing (an app that always said "turn it" would score 9 of 15), so date reading has its own test.

**Date reading, on outside photos.** 100 products sold in Canada whose expiry date an Open Food Facts volunteer confirmed, registered before the run: the app read the same date on 71 of 100. A reviewer then looked at each of the 29 misses. On 14 the package prints two dates and the app read the best-before while the confirmed one was the packed-on date; 2 were clear misreads by the app.

**Recalls.** 16 pairs of a real Government of Canada recall notice and a same-brand item, expected answers committed before each run: Gemini 16 of 16, brand plus a product word 11 of 16, brand alone 6 of 16. The second set of 8 is the hard cases on purpose (chocolate chip cookies against a recall of the same brand's gingersnaps).

Every figure above is read from a file in `results/`, and a script in CI fails when one of them no longer matches.

## Limits

- **Nobody at a food bank has used it yet.** Everything here was measured on my own pantry and on public photos.
- **Hands-free has run on a clip of still photos, on one laptop, plugged in.** On battery my laptop throttles its GPU, a check takes 6 to 10 seconds, and hands-free switches itself off and says to plug it in. Gemini Nano's first start after Chrome opens has taken about 8 minutes (458 and 503 seconds on two days), during which items are read in the cloud.
- **No Android phone has run Gemini Nano for this app.** My Galaxy S24, the emulators and Firebase Test Lab's phones have no working on-device model, so Android has only run its cloud path, and says so on the screen.
- **The model picks the chart row, and nothing grades that choice yet.** The broth carton is filed under canned prepared foods, because the chart has no row for cartons.
- **Lot codes are not read,** so a recall limited to certain lots always goes to the sort lead. All 16 recall cases ran in the cloud; the on-device fallback is not measured.

## What's next

Between November 15 and 22 I wrote to Food Banks Canada, Feed Ontario, North York Harvest Food Bank, Food Banks Mississauga and Daily Bread Food Bank, asking how their volunteers decide what to keep past the date and whether I could try this at a sort shift. No shift happened before the deadline.

- **A sort shift.** One morning at a real table gives the number this page does not have: how many items the chart says to keep that would otherwise have been binned.
- **Canadian stamps at scale.** The 100-photo test is numeric dates. Year-first stamps like `2027 FE 14` need their own set.
- **A phone that runs Gemini Nano,** to check the Android app's on-device path on real hardware.

## Why it fits

- **Technological implementation.** Three Firebase AI Logic modes, one per job, with the on-device job picked by measurement (`results/ablation-inference-mode.md`) and guarded so it cannot fall through to the cloud.
- **Design.** Open the live link and press "Try a sample photo", or "Watch a hands-free run". The answer fills the screen in its colour with the word, and the stamp is shown large, as it is printed on the package.
- **Potential impact.** A sort table decides, item by item, whether a donation is food or waste. Keep Until gives the volunteer Food Banks Canada's own answer and logs it where the food bank already works.
- **Quality of the idea.** The laptop watches because watching has to cost nothing and stay in the building, and the cloud is asked only when there is a date to read. The model reads; a published chart, in code, makes the call.
```
