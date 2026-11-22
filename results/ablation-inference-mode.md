# Ablation: on-device, hybrid and cloud on the same photos

Same 16 photos of 8 real products from my pantry (`web/public/testset/pantry-2026-11-15/`),
hand-labelled before any model run (`results/labels/pantry-2026-11-15.json`), graded by
`scripts/grade_run.py`. "Correct" means handled the way a careful volunteer would: logged with
the right date, asked to turn the item when no date is in view, or set aside when chilled. One
photo (two corn can lids with smudged dot-matrix stamps) is labelled unverified and not scored.

Run on my laptop in Chrome 157 with Gemini Nano (Gemma 4 for Built-in AI), 2026-11-15, cloud
model `gemini-3.5-flash-lite`, from the app's **Run comparison** button.

| Mode | Correct | Cloud calls for 16 photos | Median read time | Run file |
|---|---|---|---|---|
| On-device only (Gemini Nano does the full read) | 4 of 15 | 0 | 8.5 s | `pantry-2026-11-15-comparison-triage.md` |
| **Hybrid: Gemini Nano triages, the cloud reads dates** | **13 of 15** | **6** | 5.1 s on-device, 2.0 s cloud | `pantry-2026-11-15-comparison-triage.md` |
| Cloud only | 14 of 15 | 16 | 1.4 s | `pantry-2026-11-15-comparison-triage.md` |

What the hybrid gives up against cloud only: one photo. Both of its misses are "turn it" where
the label says otherwise (a date at the very edge of the Chipits photo, and the back of the
parmesan bag where triage missed that it needs the fridge). Neither is a wrong keep or discard;
each costs the volunteer one more photo.

What it gains: 10 of 16 photos never leave the laptop. The free cloud tier allows 15 requests a
minute for this model (the API's own 429, `devpost/sources.md`), and one volunteer reading an
item every 4 seconds already uses all of it in cloud-only mode. (Correction, 2026-11-22: on
2026-11-16 the project moved to pay-as-you-go billing for the recall function, so that free-tier
limit no longer applies here. What the laptop saves now is paid cloud calls, and photos of the sort
table leaving the building.)

## How the hybrid was chosen

The first design read everything on-device first. On real Gemini Nano it handled 4 of 15
(`pantry-2026-11-15-comparison-chrome.md`): it chose "log" for 14 of 16 photos and copied the
prompt's example date into its answers. An experiment then tested three narrower on-device jobs
(`ondevice-experiment-2026-11-15.md`): the full read 4 of 15, triage 10 of 15, date-only 3 of 4
real dates right but an invented date for 10 of the 11 photos showing none. Triage is the job
it does well, so it became the on-device job.

## Known limits of this measurement

- 16 photos of 8 products from one pantry, none past its best-before date. It measures reading
  and routing, not the kept-food headline, which needs a real sort.
- It is mostly a routing test. By expected answer (`scripts/grade_run.py`, re-graded
  2026-11-20): turn it 9 of 9 for hybrid and cloud, set aside 3 of 4 (hybrid) and 4 of 4 (cloud),
  and logged with the right date only 1 of 2 for both, because only 2 scored photos show a
  readable date. An app that always said "turn it" would score 9 of 15 and never log an item.
  Date reading needs its own, larger set of dated photos.
- The first on-device read after loading the page took 503 s in this run (later reads 5 to 10 s).
- The cloud model gave different readings of the same Chipits photo across runs (see
  `pantry-2026-11-15-cloud-repeatability.md`), which is why every discard needs a second read.
