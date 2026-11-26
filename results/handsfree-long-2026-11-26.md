# Hands-free on real Gemini Nano, 8 items and 16 photos, expected answers registered first: 2026-11-26

The app at `http://localhost:5173/?clip=long` in my own Chrome 158 on my laptop, plugged in, on-device model available, cloud model `gemini-3.5-flash-lite`, recorded 2026-11-26T16:26:01Z. The clip (`web/public/testset/handsfree-clip-long.webm`, 243 s) plays all 16 photos of the pantry set in the camera's place, item by item, each face for 10 to 14 s, with a blank grey frame standing in for the empty table between items. Nobody touched the laptop.

**Registered before the run.** The order, the seconds per face, the expected answer for each of the 8 items and the grading rule are in `shared/handsfree-control.json`, committed at 2026-11-26T15:30:44Z (commit `840d412`), before the clip was first played to the app. The photos and their hand labels are from 2026-11-15, made before any model run. `scripts/make_clip.py` builds the clip from that file and `scripts/grade_handsfree.py` grades a run against it.

## Result

**100 checks on the laptop (median 2.2 s each), 6 calls to the cloud, 6 of 7 graded items right.** 94 of the 100 frames the laptop checked never left it. The slowest check took 5.0 s and none came too late to act on.

| Item | Faces shown | Expected | The app's answers, in order | Final | Checks | Cloud calls | Right |
|---|---|---|---|---|---|---|---|
| Campbell's chicken broth, 900 mL carton | 3 | keep until 2029-02-14 | turn it, keep | keep until 2029-02-14 | 12 | 1 | yes |
| Green Giant cream style corn, two cans | 2 | not graded | turn it, turn it | turn it | 13 | 1 | not graded |
| Liberte Greek yogurt tub | 2 | set aside | turn it, set aside | set aside | 13 | 1 | yes |
| Hershey's Chipits milk chocolate chips | 2 | keep | turn it, turn it | turn it | 14 | 1 | **no** |
| Gallo extra virgin olive oil | 2 | turn it | turn it, turn it | turn it | 11 | 1 | yes |
| No Name baking powder | 2 | turn it | turn it | turn it | 13 | 0 | yes |
| PC shredded parmesan | 2 | set aside | turn it, set aside | set aside | 13 | 1 | yes |
| Arm & Hammer baking soda | 1 | turn it | turn it | turn it | 9 | 0 | yes |

The corn is not graded: I could not read the stamps on its lids by hand from the photo, so there is no label to grade against.

The full record, every check and every answer as the app made them, is `results/handsfree-run-2026-11-26-long-2.json`. Each check also records what the laptop said about the frame.

## The miss

**The chocolate chips were never kept.** The stamp on the bag (`BB/MA 2027 MA`) is small, upside down and cut off at the top edge of the photo. Gemini Nano saw no date on that face for five checks. On the sixth it flagged the face, the frame went to the cloud, and the cloud read answered "No date is visible on this side of the package." The app kept asking for the item to be turned. That is the safe side (nothing was kept or discarded on a date nobody read), and it is still a miss: a volunteer would be left holding the bag.

## What the six cloud calls were

| Clip time | Face | What came back |
|---|---|---|
| 31.9 s | broth carton, top | `2027 FE 14 02146`, keep until 2029-02-14 (chart page 8) |
| 72.2 s | corn, lids | `25 OC 2029FYF`; the date parser does not take that stamp, so the item waited |
| 91.7 s | yogurt, lid | `2026 DE 07`, set aside: needs the fridge |
| 133.6 s | chocolate chips, back | no date found (the miss above) |
| 157.3 s | olive oil, back label | no date on this side; the laptop had flagged it as a fridge item, wrongly |
| 207.1 s | parmesan, front | `2026 NO 30`, set aside: needs the fridge |

Three calls settled an item, one read a stamp the parser refused, and two found no date. Reading all 16 faces in the cloud would have been 16 calls.

## What the laptop saw at each check

Clip time when the check finished, the decision, and what Gemini Nano said about the frame (`p` a package is in view, `d` a date faces the camera, `f` it needs the fridge, `-` nothing in view):

```
2.2s clear (-), 4.3s clear (-), 6.4s clear (-), 8.9s turn (p), 12.8s turn (pf), 17.2s turn (p),
20.7s turn (p), 24.2s turn (p), 28.1s turn (p), 31.9s read (pd), 35.9s next (pd), 38.1s next (p),
43.1s next (pd), 47s clear (-), 49.1s clear (-), 51.3s turn (p), 53.5s turn (pf), 55.6s turn (p),
57.8s turn (p), 59.8s turn (p), 61.8s turn (p), 63.8s turn (p), 65.8s turn (p), 67.9s turn (p),
70.1s turn (p), 72.2s read (pf), 76.1s clear (-), 78.4s clear (-), 80.7s turn (p), 82.7s turn (p),
84.8s turn (p), 86.9s turn (p), 89.2s turn (p), 91.7s read (pd), 95.7s next (pdf), 98.1s next (pd),
100.5s next (pdf), 102.6s next (pd), 104.9s clear (-), 107.2s clear (-), 109.2s clear (-),
111.5s turn (p), 113.6s turn (p), 115.8s turn (p), 118s turn (p), 120.2s turn (p), 122.4s turn (p),
124.6s turn (p), 127s turn (p), 129.4s turn (p), 131.5s turn (p), 133.6s read (pdf),
137.4s clear (-), 139.5s clear (-), 141.6s clear (-), 144s turn (p), 146.3s turn (pf),
148.6s turn (pf), 150.8s turn (p), 152.9s turn (p), 155.1s turn (p), 157.3s read (pf),
161.2s turn (p), 163.3s clear (-), 165.5s clear (-), 167.7s clear (-), 170s turn (p),
172.2s turn (p), 174.4s turn (pd), 176.7s turn (p), 179s turn (p), 181.1s turn (p),
183.1s turn (p), 185.1s turn (p), 187.1s turn (p), 189.2s clear (-), 191.4s clear (-),
193.8s clear (-), 196s clear (-), 198.4s turn (p), 200.4s turn (p), 202.4s turn (p),
204.6s turn (p), 207.1s read (pf), 211.6s next (pf), 214s next (pf), 216.3s next (pf),
218.6s next (pf), 220.6s clear (-), 222.8s clear (-), 224.8s clear (-), 226.9s clear (-),
229s turn (p), 231.2s turn (p), 233.2s turn (p), 235.3s turn (p), 237.3s clear (-),
239.5s clear (-), 241.6s clear (-), 243s clear (-)
```

- `clear`: no package in view; the next item may be read.
- `turn`: the item needs turning; nothing sent.
- `read`: a date or a fridge item faces the camera, so this frame went to the cloud.
- `next`: this item is answered; nothing is sent until the table is clear.

All 28 checks of the blank frame said nothing was in view. On the first face of every item the laptop said "turn it" by itself, with nothing sent.

## The first attempt, which does not count, and why

1. **The first build of the clip did not play in Chrome.** I had joined separately encoded segments without re-encoding, and the video never advanced past its opening blank frame. The app checked that blank frame 122 times and sent nothing to the cloud. I rebuilt the clip in one encode from the same control file; the timeline and the expected answers did not change.
2. **Then two tabs played the clip at the same time.** A tab I had opened earlier woke up and ran alongside the one I was watching. Both shared the laptop's one Gemini Nano, each check took about twice as long (median 4.3 s in both), and one check stalled for 44 s in both tabs at the same moment. They scored 3 of 7 and 4 of 7: the broth's date was on screen for too few checks to be read, and the olive oil or the baking powder went past during the stall. Their records are kept as `results/handsfree-run-2026-11-26-long-1a.json` and `-1b.json`.

What changed in the app because of it: the clip now starts only in a tab that is in view, and only in one tab at a time (`navigator.locks`), and every check records what the laptop said about its frame. No rule about what is read or kept changed between the attempts.

What it shows about the product: hands-free needs its checks to come every 2 s or so. With checks at 4 s, a face held for 10 s gets two looks, and the laptop missed dates it found at full speed. Two tabs watching at once are enough to cause that.

## Limits of this run

- It is one run, on one laptop, of still photos played as video. Nothing moves, no hand shakes, and the light does not change.
- Each face is held 10 to 14 s. A volunteer in a hurry holds an item for less.
- No item in my pantry was past its keep-until date, so no discard appears.
- Gemini Nano's answers vary from run to run: on the 70-second clip the same morning it found the broth's date on the first look (`results/handsfree-clip-2026-11-26-plugged.md`), and in the two-tab attempt it did not.
