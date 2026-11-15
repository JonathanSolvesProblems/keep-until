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
