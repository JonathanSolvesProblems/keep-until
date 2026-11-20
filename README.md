# Keep Until

A volunteer at a food bank sort table holds up a donated carton. Keep Until reads the date
stamped on it, checks Food Banks Canada's shelf-life chart, and says what to do: keep it until a
date, set it aside for the sort lead, or discard it, and only after two reads agree on the date.
Every item lands in the food bank's own Google Sheet, and every morning the app checks what was
kept against new Government of Canada food recalls.

Gemini Nano checks each photo on the laptop first. Only photos with a date worth reading go to
the cloud. With **Hands-free** on, Nano watches the camera itself and calls the cloud only when a
date faces it, so the volunteer never touches the keyboard. Built for #BuildHybridAI 2026 with
Firebase AI Logic, on Web (Chrome) and Android.

To watch hands-free with no item and no webcam, open the app with `?clip=1` in Chrome with Gemini
Nano: a 31-second clip of real pantry photos plays in the camera's place, and nothing from it is
logged.

**Try it:** https://keep-until-hybrid.web.app. No item to hand or no webcam? Press **Try a sample
photo**: it reads a real carton from my pantry the same way, front first, then the top.

## How to run it

You need Node.js 20 or newer. For on-device reads, desktop Chrome with these turned on in
`chrome://flags`: **Gemma 4 for Built-in AI**, **Prompt API for Gemini Nano** and **Prompt API
for Gemini Nano with Multimodal Input**. Without them the app still works and says every read
went to the cloud.

```bash
git clone https://github.com/JonathanSolvesProblems/keep-until.git
cd keep-until
npm --prefix web install
npm --prefix web test                     # the chart gate, the date parser, the loop, the sheet
npm --prefix functions install
npm --prefix functions test               # the recall matcher, on real recall notices
cp web/.env.example web/.env.local        # then fill in your own Firebase project (below)
npm --prefix web run dev                  # http://localhost:5173
```

The tests need nothing else. Reading items needs a Firebase project of your own in
`web/.env.local`: register a web app, run `npx -y firebase-tools@latest init ailogic`, and set up
App Check (a reCAPTCHA Enterprise key for `localhost` and a debug token). The Android app is in
[android/](android/README.md) (`./gradlew testDebugUnitTest assembleDebug`).

To check the reads yourself, open **Testing tools** after **Start shift**: **Run comparison** reads
the 16 pantry photos three ways and downloads one file; grade it with
`python scripts/grade_run.py <that file> results/labels/pantry-2026-11-15.json`.

## What it does

- **Reads the stamp the way it is printed.** Canadian date stamps put the year first and use
  bilingual two-letter months ("2027 FE 14"). The app re-prints the stamp large, then the date in
  words, then the decision and the chart row and page it came from.
- **One item, two photos.** A carton's front shows the name and no date; its top shows the date
  and no name. The app asks for the side it is missing and settles from both photos.
- **Nothing is binned on one read.** A discard needs a second read that finds the same date. A
  year far from today (a cut-off "2027" read as "5037") is refused, and the item goes to the lead.
- **Lands where the food bank already works.** Each item becomes a row in the food bank's own
  Google Sheet (Drive file access only, queued while offline), and in Firestore.
- **Keeps watching after the shift.** A scheduled Cloud Function pulls the Government of Canada
  recall feed every morning and lists kept items that share a brand with a food recall. At the
  next shift start Gemini settles each one: pull it, check the lot code, or no match.
- **Says what it could not do.** "This laptop could not check it", "Google could not verify this
  browser", "No name in this photo": limits are stated on the screen, not in a footnote.

## Results

| What | Result | File |
|---|---|---|
| Hybrid: Nano checks every photo on the laptop, the cloud reads dates | 13 of 15 handled right, 6 cloud calls for 16 photos | [ablation](results/ablation-inference-mode.md) |
| Cloud only | 14 of 15, 16 cloud calls | [ablation](results/ablation-inference-mode.md) |
| Gemini Nano alone on the laptop | 4 of 15 | [ablation](results/ablation-inference-mode.md) |
| Recall check, 8 real notices, answers registered before the run | Gemini 8 of 8, brand alone 3 of 8 | [recall control](results/recall-control-2026-11-19.md) |
| Android gate against the web gate | identical on 294 stamps and 2,580 chart decisions | `shared/gate-vectors.json` |
| Android on Firebase Test Lab (Pixel 10, Pixel 11, Galaxy S26) | 14 of 15 on the cloud path; on-device unavailable (stub AICore) | [Test Lab](results/android-testlab-2026-11-19.md) |
| Android 8 and Android 16 emulators, no on-device model | same answers on the sample carton; offline message fixed | [emulators](results/android-emulator-2026-11-20.md) |

"Handled right" means what a careful volunteer would do: logged with the right date, asked to
turn the item when no date is in view, or set aside when it needs the fridge. One photo whose
stamp I could not read by hand either is not scored. The set mostly tests routing: 9 of the 15
scored photos should get "turn it", so an app that always said "turn it" would score 9 of 15, and
only 2 show a date to log (both modes read 1 of them right). Date reading needs a larger set.

What it cannot do yet: read lot codes, so a recall limited to certain lots is always "check the
lot code" for the lead. An Android on-device result needs a phone on Google's Nano list (Pixel 9
or later, Galaxy S25 or later); Test Lab's phones and my own Galaxy S24 run the cloud path and
say so.

## Built on Firebase

Firebase AI Logic (hybrid inference on web and Android: the photo check on-device with the
cloud taking over when it cannot run, the date read in the cloud, and PREFER_IN_CLOUD for the
recall check), App Check, Authentication (anonymous for volunteers,
Google for the coordinator's sheet), Firestore (offline, append-only rules), Remote Config (the
cloud model and each food bank's own policy over the chart), Performance Monitoring (a trace per
read, tagged on-device or cloud), Cloud Functions with Cloud Scheduler (the daily recall pull),
and Hosting.

## Sources

Every number the app uses or this page states is traced in [devpost/sources.md](devpost/sources.md).
The build, decision by decision, is in [devpost/build-log.md](devpost/build-log.md).

## License

Apache-2.0. See [LICENSE](LICENSE).

Built by Jonathan Andrei for food bank sort tables. More of what I build at
[jonathansolvesproblems.com](https://jonathansolvesproblems.com).
