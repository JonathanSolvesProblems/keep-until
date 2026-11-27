# Hands-free, 8 items and 16 photos, run again with the voice on: 2026-11-27

The same registered test as `results/handsfree-long-2026-11-26.md`, run a second time: the same clip
(`?clip=long`, built from `shared/handsfree-control.json`, committed before either run in `840d412`),
graded by the same script against the same expected answers. My own Chrome on my laptop, plugged in,
on-device model available, cloud model `gemini-3.5-flash-lite`, recorded 2026-11-27T13:58:59Z.
Nobody touched the laptop after one click on a blank part of the page, which is what lets Chrome play
the app's voice. The screen and the app's voice were recorded for the demo video during this run.

## Result

**104 checks on the laptop (median 2.0 s each), 6 calls to the cloud, 6 of 7 graded items right.**
The slowest check took 3.1 s and none came too late to act on. The same item was missed as on
2026-11-26: the chocolate chips' small, upside-down date was never found, and the app kept asking for
the bag to be turned.

| Item | Faces shown | Expected | The app's answers, in order | Final | Checks | Cloud calls | Right |
|---|---|---|---|---|---|---|---|
| Campbell's chicken broth, 900 mL carton | 3 | keep until 2029-02-14 | turn it, keep | keep until 2029-02-14 | 18 | 1 | yes |
| Green Giant cream style corn, two cans | 2 | not graded | turn it | turn it | 15 | 0 | not graded |
| Liberte Greek yogurt tub | 2 | set aside | turn it, set aside | set aside | 14 | 1 | yes |
| Hershey's Chipits milk chocolate chips | 2 | keep | turn it, turn it | turn it | 14 | 1 | **no** |
| Gallo extra virgin olive oil | 2 | turn it | turn it | turn it | 12 | 1 | yes |
| No Name baking powder | 2 | turn it | turn it | turn it | 7 | 1 | yes |
| PC shredded parmesan | 2 | set aside | turn it, set aside | set aside | 12 | 1 | yes |
| Arm & Hammer baking soda | 1 | turn it | turn it | turn it | 9 | 0 | yes |

Record: `results/handsfree-run-2026-11-27-long-voice.json`. Graded with
`python scripts/grade_handsfree.py results/handsfree-run-2026-11-27-long-voice.json`.

## Two runs

| Run | Checks on the laptop | Median check | Cloud calls | Graded items right |
|---|---|---|---|---|
| 2026-11-26 | 100 | 2.2 s | 6 | 6 of 7 |
| 2026-11-27, voice on | 104 | 2.0 s | 6 | 6 of 7 |

The 70-second clip was also run again the same morning with the voice on, for the video:
31 checks on the laptop (median 2.1 s), 2 calls to the cloud, both items right, the same as the run of
2026-11-26 the replay plays (`results/handsfree-run-2026-11-27-clip-voice.json`).
