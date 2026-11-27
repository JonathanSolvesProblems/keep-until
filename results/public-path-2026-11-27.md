# The public sample path on the deployed build: 2026-11-27

`https://keep-until-hybrid.web.app/?sample=all` in my own Chrome, five times in a row, after the
deploy of commit `24b3a98` (the fourth sample, a jar of peanut butter dated 2021, added). Each run reads
the four sample photos in turn through the live models (the broth carton's front, its top, a yogurt
lid, the peanut butter) and puts the four answers in the window title.

| Run | Time | Answers |
|---|---|---|
| 1 | not timed | Turn it, Keep until 14 FEB 2029, Set aside for the lead, Discard |
| 2 | 13 s | Turn it, Keep until 14 FEB 2029, Set aside for the lead, Discard |
| 3 | 11 s | Turn it, Keep until 14 FEB 2029, Set aside for the lead, Discard |
| 4 | 11 s | Turn it, Keep until 14 FEB 2029, Set aside for the lead, Discard |
| 5 | 11 s | Turn it, Keep until 14 FEB 2029, Set aside for the lead, Discard |

5 of 5. Times are from opening the page to the fourth answer, to the nearest 2 s. The same morning
`python scripts/check_live.py` passed (`results/live-check-2026-11-27.json`).
