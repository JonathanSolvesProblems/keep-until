# Were the discards right? 100 outside photos, 2026-11-27

**0 wrong discards. 32 items discarded, and each one is still a discard when the chart is given the
date an Open Food Facts volunteer confirmed instead of the date the app read.**

Made by `npx tsx scripts/discard_check.ts` from the 100-photo date run of 2026-11-22
(`results/date-control-off-ca-2026-11-22.json`, set registered in `shared/date-control-off-ca.json`
before that run). No new model call: this re-runs the app's own chart gate (`web/src/chart/chart.ts`)
on the dates already read.

| | Items |
|---|---|
| Photos | 100 |
| Discarded (two independent cloud reads agreed on the date) | 32 |
| of which the date read was the confirmed date | 26 |
| still a discard with the confirmed date | **32** |
| wrong discards | **0** |
| The second read disagreed, so the item went to the sort lead | 26 |
| of which the first read alone would have been a right discard | 26 |
| Still good by the chart with the confirmed date | 1 |
| of which the app kept | 1 |

The chart row is the one the model chose, and the date kind (best-before or expiry) is the one it
read, so the confirmed date is the only thing changed.

## What it shows

- Every photo is a real package sold in Canada, photographed by an Open Food Facts contributor, most
  of them years ago. So most dates are long past, which is what makes this a test of discards.
- On 6 of the 32 discards the app read a different date from the confirmed one (most of these
  packages print two dates). The call did not change: by either date, the item is past what the
  chart allows.
- The rule that a discard needs a second, independent read has a cost here and no catch: 26 times the
  second read did not find the same date, the item went to the sort lead, and in all 26 the first
  read alone would have been right. The wrong discard the rule exists for happened on my own pantry
  photos (a 2027 stamp read as 2026 on a bag of chocolate chips, `devpost/gallery/08-refusal.png`).
  The rule trades a person's check for the chance of good food binned on one read.

## Limits

- **This set tests discards, not keeps.** Only 1 of the 100 items is still good by the chart with the
  confirmed date (the app kept it), so it cannot show whether the app would bin good food. That side
  is the pantry set (the broth kept until 2029, the chocolate chips misread in
  `results/pantry-2026-11-15-cloud-repeatability.md`) and the hands-free runs.
- 26 of the 58 items whose first read pointed to a discard went to the sort lead instead. That is
  work for the lead, and it is the rule's price.
- The grader is the date an Open Food Facts volunteer confirmed for the product, not a person at a
  sort table. The model picked the chart row (the kind of food), and nothing grades that choice.
- One run, cloud reads only (`gemini-3.5-flash-lite`), as in the 2026-11-22 run.
