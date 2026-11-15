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

## Measurements

Filled as each `results/` file is produced.

| Number | File | Date |
|---|---|---|
