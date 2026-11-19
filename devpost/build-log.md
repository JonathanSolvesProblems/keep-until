# Build log

Dated decisions and the measurement behind each. Plumbing checks run on a synthetic label are
marked as such and never feed `results/`.

## 2026-11-14

- Firebase project `keep-until-hybrid` created from the command line (gcloud and the Firebase
  Management REST API): web app registered, Firestore in `northamerica-northeast2` (Toronto),
  reCAPTCHA Enterprise key registered with App Check, one App Check debug token for local work
  (kept in the gitignored `web/.env.local`).
- Firebase agent skills installed in the project with `npx skills add firebase/agent-skills`
  (14 skills, pinned in `skills-lock.json`). `firebase-ai-logic-basics` set the provisioning order used the next day.
- Food Banks Canada's "Guidelines for Food Shelf Life" (July 2018) encoded row by row in
  `shared/fbc-shelf-life-2018.json`, each row with its page. The CFIA date-marking rules (year
  first, bilingual month symbols) went into `web/src/chart/dates.ts`. 16 tests.
- Writing the tests caught a wrong example in my own notes: a can stamped 2025 JA 14 is already
  past the chart's 12-month lower bound for canned vegetables on this date, so the gate says
  DISCARD. The opening example now uses a 2026 MR 14 can.

## 2026-11-15

- Firebase AI Logic provisioned with `firebase init ailogic` (the step the skill marks as
  required). Before it, every cloud call returned 403 PERMISSION_DENIED even with App Check
  passing.
- First cloud read through Firebase AI Logic worked, but took 113 seconds. Timed four settings on
  the same synthetic plumbing label (not data), two rounds each, through the dev server:

  | Cloud model | Thinking | Round 1 | Round 2 | Read |
  |---|---|---|---|---|
  | gemini-3.8-flash | default | 179,111 ms, failed | 178,802 ms, failed | none |
  | gemini-3.8-flash | MINIMAL | 400: "Thinking level MINIMAL is not supported for this model" | same | none |
  | gemini-3.5-flash-lite | default | 8,958 ms | 1,736 ms | correct |
  | gemini-3.5-flash-lite | MINIMAL | 2,113 ms | 1,676 ms | correct |

  Decision: the cloud fallback uses `gemini-3.5-flash-lite` with minimal thinking. The app's own
  path then read the same label in 1,673 ms. Reading a label is perception, not reasoning; the
  slow model also had to decode an 86-value category enum. Remote Config will carry the model
  name so a food bank can switch it without a release.
- On-device in Chrome needed three flags, not one: Gemma 4 for Built-in AI, Prompt API for Gemini
  Nano, and its multimodal input. With only the first, `LanguageModel` is absent from the page
  and every read silently takes the cloud path; the sort screen says so on its status line.
- Anonymous sign-in enabled from `firebase.json` (`firebase deploy --only auth`, no console),
  Firestore rules deployed (signed-in users only; the item log is append-only from clients),
  Remote Config template deployed (cloud model, chart bound, per-category overrides, food bank).
- The app now signs in, loads the food bank's Remote Config, opens a shift, and logs every
  camera read to Firestore with a persistent offline cache. Each read is a Performance
  Monitoring trace tagged on_device or in_cloud, the way Firebase's own Friendly Meals sample
  measures its hybrid calls.
- Plumbing check (synthetic label through a fake camera, not data): Remote Config fetched from
  the server, read in 2,138 ms in the cloud, KEEP until 2027-03-14 (chart p.4), item and shift
  documents written and accepted by the rules, then deleted so no test row sits in a food bank's
  log.
- First real data: 16 photos of 8 products from my own pantry (Galaxy S24), saved without EXIF in
  `web/public/testset/pantry-2026-11-15/`, hand-labelled before any model run in
  `results/labels/pantry-2026-11-15.json`, graded by `scripts/grade_run.py`. Cloud path: 14 of 15
  scored photos handled the way a careful volunteer would (median 2.2 s); the broth carton's
  "2027 FE 14" read exactly; all four chilled photos set aside. The miss: a "BB/MA 2027 MA" stamp
  cut off at the photo's edge, where it asked to turn the bag.
- Validation pass on the phone over USB (`adb reverse tcp:5173 tcp:5173`) found and fixed:
  the dev server listened on IPv6 only, so the phone got an empty response; phones opened the
  selfie camera; the camera view pushed Read item off screen; an empty frame said "turn it" and
  merged the next item into it (the model now has a `no_item` choice).
- Found and fixed the most important gap so far: PREFER_ON_DEVICE falls back to the cloud only
  when the on-device model is unavailable. When an on-device call fails or returns something that
  is not the schema's JSON, the read failed. The loop now hands the photo to the cloud and the
  route records why. Found through headless Chromium, whose stand-in on-device API (1,000-token
  quota, it echoes input) rejected the prompt with "The input is too large."; whether the full
  prompt fits real Gemini Nano in Chrome is still to be measured on the laptop.
- The free cloud tier allows 15 requests a minute for gemini-3.5-flash-lite; a comparison run hit
  it (429) after about 30 calls. Cloud reads now wait out a 429 for the time it states and the
  sort screen says why it is waiting. This is also the plainest case for on-device: one sort table
  reading an item every 4 seconds already uses the whole free cloud quota.
- A comparison run in Edge (my default browser) came back all cloud, even the on-device-only
  pass: with no `LanguageModel` in the browser the SDK builds no on-device adapter and sends
  every request to the cloud whatever the mode. On-device-only reads are now refused in code
  before any request in such a browser, and the page says to open Chrome. The same run was a
  repeatability test: one Chipits photo read as "turn it", "26MR14" (a wrong DISCARD) and
  "BB/MA 2027 MA 17" across three cloud passes. A DISCARD now needs a second read that finds
  the same date, otherwise the item goes to a person. The grader now counts a logged item only
  when its date is right.
- First real Gemini Nano run, in Chrome on this laptop: on-device only 4 of 15 (median 7.5 s),
  hybrid 4 of 15, cloud only 14 of 15 (median 1.7 s). The prompt fits the on-device context, but
  the small model chose "log" for 14 of 16 photos, copied the prompt's example date "26MR14" into
  answers for packages that carry no such date, and filed refrigerated parmesan under the
  shelf-stable grated parmesan row. The example date is gone from the prompt. Next: a one-click
  experiment testing three narrower on-device jobs (the full read without the example, triage
  only, date only) to decide what Gemini Nano does in this app, by measurement.
- The experiment (`results/ondevice-experiment-2026-11-15.md`), real Gemini Nano: the full read
  without the example date still handled 4 of 15 (8.6 s); triage (package? date in view?
  fridge?) handled 10 of 15 (5.2 s); date-only read 3 of the 4 real dates right but invented a
  "date" for 10 of the 11 photos showing none ("10/2018", "11/25/23", "450 g"). Combining the
  measured triage answers with the measured cloud reads of the same photos gave 11 of 15 with 1
  cloud call in 16, against 14 of 15 with 16 calls for cloud only. Decision: Gemini Nano
  triages every photo on the laptop and answers "no item" and "turn it" itself; only photos with
  a date in view, or that may need the fridge, go to the cloud for the full read. Fridge
  detection was wrong both ways on-device (broth called chilled, parmesan not), so a "fridge"
  answer sends the photo to the cloud rather than setting it aside. The full on-device read stays
  as the "on-device only" mode so the comparison keeps measuring it.
- Design pass screenshots (round 1) showed "Broccoli Soup" in the shift log for a chicken broth
  carton top that prints no name. The read schema required a product name with no way to say
  "absent", so the model supplied one. The name is now "exactly as printed in this photo, empty
  if none is in view", the prompt no longer asks for the product before logging, and the log
  says "Name not in this photo". Re-running the 16 photos in the cloud after that change
  (`results/pantry-2026-11-15-cloud-only-name-optional.md`): 13 of 15, against 14 of 15 before.
  The one difference is the chocolate chips photo whose stamp is cut off at the top edge, which
  has given a different answer on every run so far (turn it, discard, keep 2027-05-17, and now
  keep). This time the cloud read "BB/MA 5037 MA" and the parser accepted year 5037, so the gate
  said keep. Fixed in the gate, not the prompt: a stamp year more than 15 years behind or 7 ahead
  of the sort date is refused as unreadable, which sends the item to a second look and then to
  the lead. Ambiguous stamps stay ambiguous; the window never narrows them to one date.
- Same design-pass run: with the made-up name gone, the broth carton's top (a date and no name)
  was filed under three different chart rows on three reads of the same photo (mixed prepared
  foods 24 months, canned vegetables 12 months, shelf-stable UHT drinks 1 month). The date was
  right every time; the row was a guess every time, and so was the keep-until date. The product
  shows the row it used in the reason, so a volunteer can see it, but the honest behaviour is to
  ask for the front of the package when no name is in view and the row is not certain. Not yet
  built; it changes the measured photo set, so it goes in with a re-run of all three modes.
- Nov 19. Live site on Firebase Hosting (keep-until-hybrid.web.app). Automated browsers get
  "App attestation failed" from App Check (reCAPTCHA scores them low) and Google then answers
  the read with a misleading "genai config not found"; the app now says in words that the
  browser could not be verified, and the score threshold is 0.3 so judges' real browsers pass.
- Nov 19. The Nov 16 sheet test showed a read marked only "Read in the cloud" in on-laptop-first
  mode. The item's record said why: Gemini Nano refused the webcam frame with "The input is too
  large", and the read went to the cloud unnoticed. The laptop check now retries a 512 px copy,
  and the badge says when the laptop could not check.
- Nov 19. Recall watch. A scheduled Cloud Function pulls the Government of Canada recall feed
  daily (241 food recalls in the past year at the first run) and lists kept items sharing a
  brand with one; at shift start Gemini settles each through AI Logic with PREFER_IN_CLOUD (the
  app's second inference policy, text only, Nano as the offline fallback). Pre-registered control
  set of 8 real notices (3 true recalls, 5 brand collisions): model 8 of 8, brand rule alone 3 of 8
  (`results/recall-control-2026-11-19.md`). The real collisions came from my own pantry photos:
  Hershey's Chipits against the August 2026 Hershey's Kisses recall, Campbell's broth against a
  Campbell's frozen soup recall, No Name baking powder against No Name walnuts and beef burgers.
