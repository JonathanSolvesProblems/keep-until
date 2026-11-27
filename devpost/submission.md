# Submission, #BuildHybridAI 2026

Final values only. One field per block. `[X]` marks a value still to come.

## Project name

```
Keep Until
```

## Tagline

```
Hold up a donated item and it says keep until when, set aside or discard, by Food Banks Canada's chart. Gemini Nano watches on the laptop: 6 of 100 frames went to the cloud.
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
**Try it, no install:** https://keep-until-hybrid.web.app. Press **Try a sample photo** four times (a carton that has to be turned, its top, a yogurt, a jar of peanut butter dated 2021), or **Watch a hands-free run**.

## Inspiration

A volunteer at a food bank sort table picks up a donated carton of broth. The top says `2027 FE 14 02146`. Is that a date? Is it past? Food Banks Canada publishes a chart of how long each kind of food stays good past its best-before date, but a volunteer with an item in each hand has no time to look a row up. A 2019 guest post on Food Banks Canada's blog, written about households, says what people tend to do with a date instead: "Many people incorrectly say food has 'expired' if it reaches its best before date, so they throw it out." A sort table makes that call on every donated item.

[X: one sentence from the sort lead, with their name and role]

## What it does

The volunteer holds the item up to a laptop camera and does not touch anything.

- **Gemini Nano watches, on the laptop.** It runs in Chrome and checks the camera every couple of seconds: is a package in view, is its date facing the camera, does it need the fridge. It says "turn it" itself, aloud. It calls the cloud only when there is something to read: a date, a fridge item, or the name once the date is known. Watching all the time costs nothing on the laptop's own model. In the cloud it would be a paid call every couple of seconds, and a picture of the sort table leaving the building each time.
- **The date is read in the cloud, and a published chart makes the call.** That one frame goes to Gemini, which is asked to copy the stamp as printed (Canadian stamps put the year first and use bilingual months: `2027 FE 14`) and to name the kind of food. Code parses the stamp, looks up Food Banks Canada's row and answers **keep until** a date, **set aside** for the sort lead, or **discard**. A discard needs a second, independent read that finds the same date; the second read is never told what the first one found.
- **One item is often two photos.** The front shows the name and no date, the top shows the date and no name. Keep Until asks for the side it is missing and settles from both.
- **It lands where the food bank works.** Every item becomes a row in the Google Sheet the coordinator connects (Drive file access only), and in Firestore.
- **It keeps working after the shift.** Every morning a Cloud Function pulls the Government of Canada recall feed and lists kept items that share a brand with a food recall. At the next shift start Gemini settles each one: pull it, check the lot code, or no match.

Without Gemini Nano (another browser, or the Android app on a phone that cannot run it) the volunteer presses **Read item**, every read goes to the cloud, and the screen says so.

## How I built it on Firebase

A new project: the first commit is from November 14, 2026.

- **Firebase AI Logic, one mode per job.** Watching the camera is `InferenceMode.ONLY_ON_DEVICE` (Gemini Nano through Chrome's Prompt API, with a JSON schema), Before each check the code confirms the browser has an on-device model, and it throws away any answer whose `inferenceSource` is not `on_device`. Reading the date is cloud only (`gemini-3.5-flash-lite`, minimal thinking, `responseJsonSchema`). The recall check is `PREFER_IN_CLOUD`. Every answer records `inferenceSource`, and the screen says where each read happened and how long it took.
- **I chose the split by measuring it.** My first design read everything on Nano. On real Gemini Nano that handled 4 of 15 photos. As a checker (is a package in view, is a date facing the camera) Nano was right on 10 of 15. So Nano checks and the cloud reads. On November 27, with Chrome's newer on-device model, I tried again to give Nano the whole job: reading alone it got 13 of 100 outside dates right (the cloud: 71) and sent 94 of the 100 items to the sort lead, repeating digits it could not make out (`12/07/2222`). Each of the 4 items it did discard was right, so the two-read rule held. Watching is where Nano earns its place.
- **App Check** (reCAPTCHA Enterprise on web, debug provider on Android), **Authentication** (anonymous for volunteers, Google with Drive file access for the coordinator's sheet), **Firestore** (offline persistence, append-only rules), **Remote Config** (the cloud model and each food bank's own policy over the chart), **Performance Monitoring** (a trace around every read, tagged on-device or cloud), **Cloud Functions with Cloud Scheduler** (the daily recall pull), **Crashlytics** on Android and **Hosting**.
- **Android** (Kotlin, `firebase-ai` with `firebase-ai-ondevice`) has the same read loop and the same chart gate, with a Read item button and no hands-free. The two gates agree on 294 date stamps and 2,580 chart decisions written by the TypeScript and replayed by a Kotlin test.
- **The voice** is 124 short recordings made once with ElevenLabs and shipped with the app, so it cannot say a sentence that is not on the list. Only if a recording cannot play (the first use, offline) does Chrome's own voice say the same words.

## Results

**Hands-free on real Gemini Nano.** A clip of all 16 of my pantry photos played in the camera's place: 8 items, held up face by face, with the expected answer for each committed before the run. 100 checks on the laptop, 6 calls to the cloud, 6 of 7 graded items right. Nano settled 94 of the 100 frames by itself ("turn it", "put it down", nothing in view). Of the 4 items with a date to read, 3 were settled right (the broth kept until February 2029, the yogurt and the parmesan set aside for the fridge). The 3 with no date in any photo were asked to be turned, which is right. The miss: it never found the small, upside-down date on a bag of chocolate chips, and kept asking for it to be turned. Run again the next morning with the voice on, for the video: 104 checks on the laptop, 6 calls to the cloud, the same 6 of 7 and the same miss. A shorter run (31 checks on the laptop, 2 calls to the cloud) replays check by check in any browser: https://keep-until-hybrid.web.app/?replay=1

**Routing, against cloud only.** Sixteen pantry photos, labelled by hand before any run:

| How items are read | Handled right | Cloud calls for 16 photos |
|---|---|---|
| Nano checks every photo, the cloud reads | 13 of 15 | 6 |
| Cloud only | 14 of 15 | 16 |
| Gemini Nano alone on the laptop | 4 of 15 | 0 |

The hybrid gives up one photo, and neither of its misses is a wrong keep or discard: each asks for the item to be turned once more. This set mostly tests routing (an app that always said "turn it" would score 9 of 15), so date reading has its own test.

**Date reading, on outside photos.** 100 products sold in Canada whose expiry date an Open Food Facts volunteer confirmed, registered before the run: the app read the same date on 71 of 100. A reviewer then looked at each of the 29 misses. On 14 the package prints two dates and the app read the best-before while the confirmed one was the packed-on date; 2 were clear misreads by the app.

**Discards: 32, and none wrong.** Most of those photos are years old, so most dates are long past. The app discarded 32 items, each after two independent reads found the same date, and every one is still a discard when the chart is given the date the Open Food Facts volunteer confirmed (`scripts/discard_check.ts`). The second-read rule has a cost: 26 times the second read did not find the same date, so the item went to the sort lead, and the first read alone would have been right. That set cannot test the other side, binning good food, because only 1 of its 100 items is still good by the chart (the app kept it). That side is the chocolate chips: one cloud read took their 2027 stamp for 2026 and said discard, which is why the second read exists.

**Recalls.** 16 pairs of a real Government of Canada recall notice and a same-brand item, expected answers committed before each run: Gemini 16 of 16, brand plus a product word 11 of 16, brand alone 6 of 16. The second set of 8 is the hard cases on purpose (chocolate chip cookies against a recall of the same brand's gingersnaps).

Every figure above is read from a file in `results/`, and a script in CI fails when one of them no longer matches.

## Limits

- **Nobody at a food bank has used it yet.** Everything here was measured on my own pantry and on public photos.
- **Hands-free has run on clips of still photos, on one laptop, plugged in.** On battery my laptop throttles its GPU, a check takes 6 to 10 seconds, and hands-free switches itself off and says to plug it in. Gemini Nano's first start after Chrome opens has taken about 8 minutes (458 and 503 seconds on two days), during which items are read in the cloud.
- **No Android phone has run Gemini Nano for this app.** My Galaxy S24, the emulators and Firebase Test Lab's phones have no working on-device model, so Android has only run its cloud path, and says so on the screen.
- **The model picks the chart row, and nothing grades that choice yet.** The broth carton is filed under canned prepared foods, because the chart has no row for cartons.
- **Lot codes are not read,** so a recall limited to certain lots always goes to the sort lead. All 16 recall cases ran in the cloud; the on-device fallback is not measured.

## What's next

Between November 15 and 22 I wrote to Food Banks Canada, Feed Ontario, North York Harvest Food Bank, Food Banks Mississauga and Daily Bread Food Bank, asking how their volunteers decide what to keep past the date and whether I could try this at a sort shift. No shift happened before the deadline.

- **A sort shift.** One morning at a real table gives the number this page does not have: how many items the chart says to keep that would otherwise have been binned.
- **Canadian stamps at scale.** The 100-photo test is numeric dates. Year-first stamps like `2027 FE 14` need their own set.
- **A phone that runs Gemini Nano,** to check the Android app's on-device path on real hardware.

## Why it fits

- **Technological implementation.** Three Firebase AI Logic modes, one per job, chosen by measuring them (`results/ablation-inference-mode.md`): Gemini Nano settles 94 of 100 frames on the laptop, and the cloud reads the 6 that have a date.
- **Design.** A volunteer with full hands gets the answer three ways at once: the word and its colour fill the screen, the stamp is shown large as it is printed, and the answer is said aloud. The same flow runs on Android and with no camera at all, from sample photos.
- **Potential impact.** A sort table decides, item by item, whether a donation is food or waste. Keep Until gives the volunteer Food Banks Canada's own answer, and on 100 outside photos none of its 32 discards was wrong.
- **Quality of the idea.** Watching a sort table all day only makes sense on the laptop's own model, and a best-before date only means something next to a published chart. Keep Until joins the two: the model reads, the chart decides in code, and a second read stands between any item and the bin.
```
