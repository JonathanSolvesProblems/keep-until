# Hands-free on real Gemini Nano: the 70-second clip, 2026-11-20

The app at `http://localhost:5173/?clip=1` in my own Chrome 157 on my laptop, with the on-device
model (Gemma 4 for Built-in AI), cloud model `gemini-3.5-flash-lite`. The clip
(`web/public/testset/handsfree-clip.webm`) plays real photos from my pantry in the camera's place:

| Clip time | In front of the camera |
|---|---|
| 0 to 6 s | the empty table |
| 6 to 20 s | the broth carton's front (name, no date) |
| 20 to 36 s | the same carton's top (date `2027 FE 14`, no name) |
| 36 to 46 s | the empty table |
| 46 to 62 s | a yogurt tub lid |
| 62 to 70 s | the empty table |

Nobody touched the laptop. Each "look" is one Gemini Nano call on the laptop
(`InferenceMode.ONLY_ON_DEVICE`); the cloud is called only when a look says a date faces the
camera (or the item needs the fridge) and the view has changed since the last read.

## Result

**18 checks on the laptop (median 3.8 s each), 3 calls to the cloud, every item handled right:**
the carton front got "turn it", the carton top "keep", the yogurt "set aside" for the fridge.
15 of the 18 frames never left the laptop.

What the laptop saw at each look, as the app recorded it (clip time, then the decision):

```
0s clear, 4.7s clear, 7.8s clear, 11.3s read, 17.5s turn, 21.3s turn, 25.7s read, 31.8s next,
36s next, 40.4s next, 44s clear, 47.4s clear, 51.2s read, 56.5s next, 60.4s next, 63.8s next,
67.1s clear, 70s clear
```

Each time is when the look finished; its frame was taken when the look started, about 4 s earlier
(so the 7.8 s look still saw the empty table).

- `clear`: no package in view; the next item may be read.
- `read`: a date faces the camera, so the frame went to the cloud.
- `turn`: the item needs turning; nothing sent.
- `next`: this item is answered; nothing is sent until the table is clear.

Raw record: the browser window title at the end of the run, which the app sets to the summary and
this timeline (`Keep Until clip: 18 looks on this laptop (median 3.8 s), 3 sent to the cloud: need
date photo, keep, set aside | ...`). The app called each check a "look" at the time.

## What it shows, and what it does not

- At 11.3 s Nano said a date was in view on the carton's front, which shows none. The cloud read
  found no date and asked for the item to be turned, so this cost one extra cloud call and no wrong answer.
  Nano's triage is a filter for the cloud, and the cloud read still decides.
- After the carton was answered, three looks (31.8 to 40.4 s) saw the same item and sent nothing.
  Without the "wait for a clear table" rule the same carton would have gone to the cloud again.
- One run, two items (three answers: the carton needed turning), from a clip rather than a live camera. It shows the loop works on the real
  on-device model. It does not measure accuracy, which needs many more dated items.
- The first run of the earlier 31-second clip fit only 6 looks (about 5 s each while the model
  warmed up), so items went by unseen. The clip now holds each item for 14 to 16 s, about as long
  as a volunteer holds it up while waiting for the answer.
