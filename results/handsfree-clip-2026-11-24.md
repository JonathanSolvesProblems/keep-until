# Hands-free after the code review: two runs on a busy laptop, 2026-11-24

Correction, 2026-11-26: the slow checks below were measured again with the GPU idle and traced to the
laptop running on battery (`results/handsfree-clip-2026-11-26.md`). Whether it was on battery during
these two runs was not recorded, so the explanation given below (other programs on the GPU) is unproven.

A code review on 2026-11-24 found that the hands-free rules could leave an item unread, read one
twice, or carry a half-turned item's name to the next one. The rules were rewritten as a small
state machine (`watchStep` and `afterRead` in `web/src/ai/loop.ts`, with tests for each case), and
the 70-second clip was run again twice on real Gemini Nano in my Chrome, with the new code.

During both runs the laptop's GPU was shared with other work of mine (an image generator and a 3D
editor were open; `nvidia-smi` showed 4.3 of 8 GB in use by them). That was not planned, and it
is what these runs ended up measuring.

## Run A

18 checks (median 2.5 s), 3 calls to the cloud, both items answered right: the carton's front
"turn it", its top "keep until 14 FEB 2029", the yogurt "set aside". Timeline:

```
2.2s clear, 4.3s clear, 6.4s clear, 8.6s read, 13.3s turn, 16.4s turn, 18.7s turn, 21.6s turn,
25.3s read, 29.1s next, 31.1s next, 33.6s next, 35.8s next, 40.8s next, 46s clear, 50.9s clear,
70s read, 70s next
```

From 40 s the checks slowed (5 s, 6 s, 5 s), and the check that found the yogurt took 23.7 s; the
cloud read after it took 20.8 s. The yogurt was answered only because the clip's last frame stays
on screen: at a real table it would have been gone.

## Run B

16 checks (median 2.3 s, slowest 52.4 s), 2 calls to the cloud: the carton was answered right
(turn it, then keep until 14 FEB 2029), and **the yogurt was missed**. After the carton, checks
took 10 s, 15 s and 52 s, and the yogurt's 16 seconds on screen fell between them. Record:
`results/handsfree-run-2026-11-24-busy.json`.

```
2.1s clear, 4.1s clear, 6.2s clear, 8.5s read, 12.3s turn, 14.5s turn, 16.9s turn, 19.1s turn,
21.3s turn, 24.3s read, 34.3s next, 49.6s next, 55s clear, 60.1s next, 70s next, 70s next
```

## What changed because of these runs

- A check that takes more than 8 seconds is now ignored: it describes a table that has moved on.
- After two such checks in a row, hands-free switches itself off and the screen says "This laptop
  is too busy to watch the camera right now, so hands-free is off. Press Read item."
- The limit is stated on the project page: hands-free needs the laptop's GPU to itself.

## What stands

- With the rewritten rules, the decisions on the clip up to the slowdown follow the same pattern
  as in the 2026-11-22 run (`results/handsfree-clip-2026-11-22.md`): clear, read, turn, read,
  next. That run (36 checks, median 1.8 s) remains the one the page quotes and `?replay=1` plays,
  and it was made with the rules as they were before the rewrite.
- A clean run with the rewritten rules on an idle laptop is still to be recorded.
