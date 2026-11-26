# Hands-free on real Gemini Nano, rewritten rules, laptop plugged in: the 70-second clip, 2026-11-26

The app at `http://localhost:5173/?clip=1` in my own Chrome 158 on my laptop, plugged in, on-device model available, cloud model `gemini-3.5-flash-lite`, recorded 2026-11-26T09:40:05.118Z, with the hands-free rules as rewritten on 2026-11-24 (`watchStep` and `afterRead` in `web/src/ai/loop.ts`). The clip (`web/public/testset/handsfree-clip.webm`) plays real photos from my pantry in the camera's place: the empty table (0 to 6 s), a broth carton's front with no date (6 to 20 s), the same carton's top with `2027 FE 14` (20 to 36 s), the table (36 to 46 s), a yogurt lid (46 to 62 s), the table (62 to 70 s).

Nobody touched the laptop. Each check is one Gemini Nano call on the laptop (`InferenceMode.ONLY_ON_DEVICE`); the cloud is called only when a check says a date faces the camera (or the item needs the fridge).

The full record, every check and every answer as the app made them, is `results/handsfree-run-2026-11-26-plugged.json`. The live app replays it at `?replay=1`, in any browser.

## Result

**31 checks on the laptop (median 2.2 s each), 2 calls to the cloud, both items answered right:** the carton's front got "turn it" from the laptop itself, with nothing sent; its top "keep until 14 FEB 2029" (read `2027-02-14`, Food Banks Canada chart page 8) from one cloud read; the yogurt "set aside" because it needs the fridge, from one more. 29 of the 31 frames never left the laptop. The slowest check took 2.8 s.

Each check, as the app recorded it (clip time when the check finished, then what it decided):

```
2s clear, 4.1s clear, 6s clear, 7.9s clear, 9.8s turn, 11.8s turn, 13.8s turn, 15.7s turn, 17.8s turn, 19.8s turn, 21.7s turn, 23.9s read, 27.6s next, 29.8s next, 32.6s next, 35.2s next, 37.5s next, 39.8s clear, 42.3s clear, 44.6s clear, 46.8s clear, 49s read, 52.5s next, 55.2s next, 57.6s next, 60s next, 62.4s next, 64.6s clear, 66.8s clear, 68.9s clear, 70s clear
```

- `clear`: no package in view; the next item may be read.
- `turn`: the item needs turning; nothing sent.
- `read`: a date faces the camera (or the item needs the fridge), so the frame went to the cloud.
- `next`: this item is answered; nothing is sent until the table is clear.

## Against the earlier run

The 2026-11-22 run (`results/handsfree-clip-2026-11-22.md`, the rules before the rewrite) made 36 checks and 3 cloud calls on the same clip: Gemini Nano mistook the carton's front for a fridge item and sent it. In this run the laptop answered the front itself, so the carton cost one cloud call.

## Plugged in or on battery

The run just before this one (`results/handsfree-run-2026-11-26-c.json`) started on battery, and the laptop was plugged in partway through. Time per check, in order:

```
6s clear (5.9 s), 11.8s clear (5.8 s), 18.6s read (6.7 s), 28.8s slow (8.4 s), 38.6s slow (9.7 s), 45s clear (6.4 s), 47.3s clear (2.2 s), 49.5s read (2.2 s), 53.5s next (2.2 s), 55.8s next (2.3 s), 58.2s next (2.4 s), 60.5s next (2.3 s), 62.7s next (2.2 s), 65.6s clear (2.9 s), 67.6s clear (1.9 s), 69.5s clear (1.9 s), 70s clear (1.9 s)
```

The checks took 5.8 to 9.7 s until the laptop was plugged in, and 1.9 to 2.9 s from then on, in the same tab, with nothing else changed. That confirms what `results/handsfree-clip-2026-11-26.md` measured: on battery this laptop's GPU is throttled and hands-free is too slow to use. In that run the carton's top passed during two late checks and was not read.

## What it shows, and what it does not

- One run, two items (three answers: the carton needed turning), from a clip of still photos. It shows the loop working on the real on-device model; accuracy needs many more dated items, and a hand-held item moves in ways a still photo does not.
