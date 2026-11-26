# Hands-free on real Gemini Nano: the 70-second clip, 2026-11-22

The app at `http://localhost:5173/?clip=1` in my own Chrome 157 on my laptop, on-device model available, cloud model `gemini-3.5-flash-lite`, recorded 2026-11-22T19:12:25.833Z. The clip (`web/public/testset/handsfree-clip.webm`) plays real photos from my pantry in the camera's place: the empty table (0 to 6 s), a broth carton's front with no date (6 to 20 s), the same carton's top with `2027 FE 14` (20 to 36 s), the table (36 to 46 s), a yogurt lid (46 to 62 s), the table (62 to 70 s).

Nobody touched the laptop. Each check is one Gemini Nano call on the laptop (`InferenceMode.ONLY_ON_DEVICE`); the cloud is called only when a check says a date faces the camera (or the item needs the fridge) and the view has changed since the last read.

The full record, every check and every answer as the app made them, is `results/handsfree-run-2026-11-22.json`. (Until 2026-11-26 the live app replayed this run at `?replay=1`; it now replays the run in `results/handsfree-clip-2026-11-26-plugged.md`, made with the rewritten rules.)

## Result

**36 checks on the laptop (median 1.8 s each), 3 calls to the cloud, both items answered right:** the carton's front got "turn it", its top "keep until 14 FEB 2029" (read `2027-02-14`, Food Banks Canada chart page 8), the yogurt "set aside" because it needs the fridge. 33 of the 36 frames never left the laptop.

Each check, as the app recorded it (clip time when the check finished, then what it decided):

```
3.4s clear, 5.1s clear, 6.8s clear, 8.7s read, 12.5s turn, 14.3s turn, 16.1s turn, 17.9s turn, 19.8s turn, 21.7s turn, 23.6s read, 27.1s next, 29.1s next, 31.1s next, 33.2s next, 35.1s next, 37.2s next, 38.8s clear, 40.5s clear, 42.1s clear, 43.8s clear, 45.4s clear, 47s clear, 48.8s read, 52s next, 53.9s next, 55.7s next, 57.4s next, 59.1s next, 60.9s next, 62.6s next, 64.2s clear, 66s clear, 67.6s clear, 69.2s clear, 70s clear
```

- `clear`: no package in view; the next item may be read.
- `read`: a date faces the camera (or the item needs the fridge), so the frame went to the cloud.
- `turn`: the item needs turning; nothing sent.
- `next`: this item is answered; nothing is sent until the table is clear.

## What it shows, and what it does not

- On the carton's front Nano thought the item might need the fridge, so that frame went to the cloud, which found no date and asked for the item to be turned: one extra cloud call and no wrong answer. Nano's check is a filter for the cloud; the cloud read still decides.
- While each answered item stayed in view, the laptop kept checking and sent nothing (`next`). Without the wait-for-a-clear-table rule, the same item would have gone to the cloud again and again.
- One run, two items (three answers: the carton needed turning), from a clip rather than a live camera. It shows the loop working on the real on-device model; accuracy needs many more dated items.
- An earlier run on 2026-11-20 (`results/handsfree-clip-2026-11-20.md`), while the model was still warming up, made 18 checks (median 3.8 s) with the same 3 cloud calls and the same answers.
