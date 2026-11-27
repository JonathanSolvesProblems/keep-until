# Sources

Every number the product uses or the project page states traces to a row here: a named
published source, or the measurement in `results/` that produced it.

## Published sources

| Used for | Source | Read |
|---|---|---|
| Keep-until limit per food category (every value in the app's chart table) | Food Banks Canada, "Guidelines for Food Shelf Life", updated July 2018. Copy hosted by Harvest Manitoba: https://www.harvestmanitoba.ca/wp-content/uploads/2021/01/FBC-Food-Shelf-Life-En.pdf | 2026-11-14 |
| Expiry-dated products (infant formula, meal replacements) never shared past the date | Same document, "Baby Food & Meal Replacements" page and the expiry-date note | 2026-11-14 |
| "Many people incorrectly say food has 'expired' if it reaches its best before date, so they throw it out." | Brita Ball, PhD, "Best Before or Expired? Food Banks' Questions Answered", Food Banks Canada guest blog, May 21, 2019: https://foodbankscanada.ca/best-before-or-expired-food-banks-questions-answered/ | 2026-11-14 |
| A food bank's own, longer policy (canned goods up to 18 months past best-before), the example for per-food-bank Remote Config | Calgary Food Bank, "Best Before Date": https://calgaryfoodbank.com/resources/best-before-date | 2026-11-14 |
| Recall notices (34,383 notices, 4,280 in the Food category, last updated 2026-11-13 at download) | Government of Canada, Recalls and Safety Alerts open data (JSON): https://recalls-rappels.canada.ca/sites/default/files/opendata-donneesouvertes/HCRSAMOpenData.json | 2026-11-14 |
| On-device limits (single turn, one image, 9,216 tokens on web, 4,000 on Android, no tools on-device) | Firebase AI Logic hybrid docs: https://firebase.google.com/docs/ai-logic/hybrid | 2026-11-14 |
| Galaxy S24 not on the on-device list (Samsung support starts at the S25) | ML Kit GenAI device support: https://developers.google.com/ml-kit/genai | 2026-11-14 |
| The cloud free tier allows 15 requests a minute for gemini-3.5-flash-lite | The API's own 429 response on this project, 2026-11-15: "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 15, model: gemini-3.5-flash-lite"; limits documented at https://aistudio.google.com/docs/rate-limits | 2026-11-15 |
| Canadian date stamps: year first, bilingual month symbols, year optional when clear; expiry dates required on formula and meal replacements | CFIA, "Date markings and storage instructions": https://inspection.canada.ca/en/food-labels/labelling/industry/date-markings-and-storage-instructions | 2026-11-14 |
| Date-reading test set: 100 photos of products sold in Canada and the expiry date an Open Food Facts volunteer confirmed on each | Open Food Facts, Robotoff `expiration_date` insights with `annotation = 1`, country `ca`: https://robotoff.openfoodfacts.org/api/v1/insights?insight_types=expiration_date&annotation=1&countries=ca ; images by Open Food Facts contributors, CC BY-SA 4.0 | 2026-11-22 |
| The fourth sample photo, a jar of peanut butter dated 14/03/2021 (the app's discard example) | Open Food Facts, product 0056664013115, image 2, by Open Food Facts contributors, CC BY-SA 4.0: https://world.openfoodfacts.org/product/0056664013115 ; one of the 100 photos above | 2026-11-27 |

## Measurements

Every number on the project page, the README and the gallery comes from one of these files. `scripts/check_claims.py` reads the figures from them and fails in CI when a page disagrees.

| Number | File | Date |
|---|---|---|
| Routing on 16 pantry photos: hybrid 13 of 15 with 6 cloud calls, cloud only 14 of 15, Gemini Nano alone 4 of 15; the always-turn-it baseline, 9 of 15 | `results/ablation-inference-mode.md`, graded by `scripts/grade_run.py` against `results/labels/pantry-2026-11-15.json` | 2026-11-15, re-graded 2026-11-20 |
| Gemini Nano reading alone, re-measured: 4 of 15 pantry photos, 13 of 100 outside dates (the cloud: 71) | `results/nano-alone-2026-11-27.md`, records `results/nano-alone-pantry-2026-11-27.json` and `results/nano-alone-offca-2026-11-27.json` | 2026-11-27 |
| Gemini Nano as a checker, 10 of 15 | `results/ondevice-experiment-2026-11-15.md` | 2026-11-15 |
| Hands-free, 8 items and 16 photos: 100 checks on the laptop, 6 calls to the cloud, 6 of 7 graded items right | `results/handsfree-long-2026-11-26.md`; expected answers in `shared/handsfree-control.json`, committed before the run (`840d412`); graded by `scripts/grade_handsfree.py`; record in `results/handsfree-run-2026-11-26-long-2.json` | 2026-11-26 |
| The same 8-item test run again with the voice on: 104 checks on the laptop, 6 calls to the cloud, the same 6 of 7 | `results/handsfree-long-2026-11-27.md`, record in `results/handsfree-run-2026-11-27-long-voice.json` | 2026-11-27 |
| Discards on the 100 outside photos: 32, 0 wrong with the volunteer-confirmed date; 26 sent to the lead when the second read disagreed | `results/discard-check-2026-11-27.md`, made by `scripts/discard_check.ts` from `results/date-control-off-ca-2026-11-22.json` | 2026-11-27 |
| Hands-free, the 70-second clip: 31 checks on the laptop, 2 calls to the cloud, both items right | `results/handsfree-clip-2026-11-26-plugged.md`, record in `results/handsfree-run-2026-11-26-plugged.json` | 2026-11-26 |
| On battery a check takes 6 to 10 seconds; Gemini Nano at about 4.5 tokens a second | `results/handsfree-clip-2026-11-26.md`, `results/handsfree-clip-2026-11-26-plugged.md` | 2026-11-26 |
| Gemini Nano's first start, 458 and 503 seconds | `results/ablation-inference-mode.md` (503 s), `devpost/build-log.md` (457.9 s on the live site) | 2026-11-15, 2026-11-19 |
| Date reading, 71 of 100 outside photos; the 29 misses one by one | `results/date-control-off-ca-2026-11-22.md`, `results/date-control-off-ca-2026-11-22-audit.md`, graded by `scripts/grade_dates.py` | 2026-11-22, corrected 2026-11-24 |
| The Chipits bag read as `26MA14` in one run and `2027 MA 17` in the next | `results/pantry-2026-11-15-cloud-repeatability.md` | 2026-11-15 |
| Recalls: Gemini 16 of 16, brand plus a product word 11 of 16, brand alone 6 of 16 | `results/recall-control-2026-11-22.md`, written by `scripts/recall_report.py` | 2026-11-22 |
| The Android and web gates agree on 294 date stamps and 2,580 chart decisions | `shared/gate-vectors.json`, replayed by the Kotlin test `GateVectorsTest` | 2026-11-19 |
| Android on a Galaxy S24, and on Android 8 and 16 emulators | `results/android-s24-2026-11-19.md`, `results/android-emulator-2026-11-20.md`, `results/android-testlab-2026-11-19.md` | 2026-11-19 to 2026-11-24 |
| The public sample path, 5 of 5 on the deployed build | `results/public-path-2026-11-26.md` | 2026-11-26 |

## Voice

The spoken answers are 124 recordings made on 2026-11-26 with ElevenLabs text to speech (voice Sarah, model `eleven_flash_v2_5`), on a paid plan that licenses the output for commercial use. `scripts/make_voice.mjs` made them from the lines in `web/src/voice.ts`, and `web/public/voice/lines.json` lists each one word for word. The app plays the files. It does not call ElevenLabs, and it cannot say a sentence that is not on the list in that voice. If a recording cannot play, Chrome's own voice says the same words.
