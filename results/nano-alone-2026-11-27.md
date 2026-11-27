# Could Gemini Nano do the whole read? Re-measured 2026-11-27

**No. Reading alone on the laptop, Gemini Nano read 13 of 100 dates right (the cloud: 71 of 100) and
handled 4 of 15 pantry photos (the cloud: 14 of 15). It set 94 of the 100 outside items aside for the
sort lead.** So Nano keeps the job it does well, watching the camera, and the cloud reads the date.

Why measure again: the first measurement (2026-11-15, `results/ablation-inference-mode.md`) was on
Chrome 157. Chrome has since updated to 158, my laptop's Chrome runs the newer on-device model, and a
Nano check now takes about 2 s instead of 5. A judge reading "Nano alone 4 of 15" would fairly ask
whether that is still true.

How: my own Chrome on my laptop, plugged in, the app's measurement batch in **On-device only** mode
(`InferenceMode.ONLY_ON_DEVICE`, no cloud model at all, so nothing left the laptop), started by the
dev-server hook `?batch=<list>&mode=only_on_device&today=<date>` in `web/src/main.ts`. The same photos,
dates and graders as the cloud runs.

| Set | Gemini Nano alone, 2026-11-27 | Cloud, earlier run | Grader |
|---|---|---|---|
| 16 pantry photos, labelled by hand (today 2026-11-15) | 4 of 15 handled right (median read 3.2 s) | 14 of 15 | `scripts/grade_run.py`, `results/labels/pantry-2026-11-15.json` |
| 100 outside photos, dates confirmed by Open Food Facts volunteers (today 2026-11-22) | 13 of 100 dates read right; no date read on 36 | 71 of 100 | `scripts/grade_dates.py`, `shared/date-control-off-ca.json` |

Records: `results/nano-alone-pantry-2026-11-27.json`, `results/nano-alone-offca-2026-11-27.json`.

## What Nano did

- **Pantry.** It answered "log" on photos with no date, named the Chipits bag "Chipotle_chips", filed
  the yogurt under canned prepared meals (with a date in view, that would have been a keep for a
  fridge item), and put the broth carton's stamp in the product name field while reading the date as
  `2027 FE 1444402214`. Its 4 right answers were all "set aside", which it said for everything.
- **Outside photos.** It repeats digits (`12/07/2222`, `15FEB202222`, `06/10/202021`), so most dates do
  not parse and the item goes to the lead: 94 set aside, 4 discarded, 1 turn it, 1 nothing in view.
  All 4 discards were right by the confirmed date: the two-read rule held with Nano reading too.

## Why not "Nano reads, the cloud only when unsure"

Nano almost never says it is unsure: on the pantry set it chose "log" on 14 of 16 photos, most with
no date. Routing on its own confidence would pass garbled dates on; routing on whether its date parses
would call the cloud for nearly every item, which is the cloud-only cost with an extra on-device step.
Watching is where Nano earns its place: in the 8-item hands-free run it settled 94 of 100 frames itself.
