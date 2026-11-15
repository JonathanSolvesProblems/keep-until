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
