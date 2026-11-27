# Demo video: script and shot list

Target 80 to 95 seconds (the rules allow 3 minutes). Narration recorded first (one take, plain
voice), b-roll cut to it afterwards with the `demo-video` skill. Raw footage goes in `broll/`
(gitignored). The last shot is the made thing landing where the food bank already works: the row
in its sheet.

## Narration

```
A donated carton of broth. The top says 2027 FE 14. Is that a date? Is it past?

At a food bank sort table, a volunteer has seconds to decide, and good food gets binned because of the date on it.

This is Keep Until. I hold the carton up. Gemini Nano, running on the laptop, sees there's no date on this side.

(the app, aloud: "Turn it, so the date faces the camera.")

Nothing has left the laptop. I turn it. Now the date faces the camera, so that one photo goes to Gemini in the cloud, which copies the stamp as it is printed. Food Banks Canada's chart decides.

(the app, aloud: "Keep. Until February 2029.")

Yogurt needs the fridge, so it goes to the sort lead.

Nothing gets binned on one read. A discard needs two independent reads of the same date. On a hundred outside photos it discarded thirty-two items, and none of them was wrong.

(the app, aloud: "Discard. Two reads agreed it is past its keep-until date.")

The same read runs on Android.

Every morning, a Firebase function checks recalls against what was kept.

And each item lands as a row in the food bank's own sheet.
```

About 170 words of narration, roughly 85 seconds with the app's three spoken lines. The lines in
brackets are the app's own voice, already in the footage (recorded from the laptop's sound): leave a
gap for each, do not narrate over them.

**The narration must match the footage.** "I hold the carton up" and "I turn it" are true only over
the live take (shots 3L to 5L below: your hands, the real carton, the laptop's webcam). Every
hands-free recording so far played a clip of still photos in the camera's place. If the live take
is not filmed, record these lines instead for shots 3 to 4:

```
This is Keep Until. Here a clip of my own pantry photos plays in the camera's place. Gemini Nano, running on the laptop, sees there's no date on the carton's front.

(the app, aloud: "Turn it, so the date faces the camera.")

Nothing has left the laptop. The top comes next. The date faces the camera, so that one frame goes to Gemini in the cloud, which copies the stamp as it is printed. Food Banks Canada's chart decides.
```

### The live take (about 15 minutes, the highest-value shot left)

1. Laptop plugged in, Chrome, `https://keep-until-hybrid.web.app` (or `http://localhost:5173`).
   Press **Start shift**, allow the camera, wait for "Reading on this laptop first", press
   **Hands-free**. The sound on, at a normal volume.
2. Film over your shoulder with the phone, so the item in your hand, the screen and the app's voice
   are all in one shot. The laptop's own sound is also recorded by
   `bash tmp/scripts/record_web.sh` if you want a clean screen capture as well (tell me and I start it).
3. Hold up the broth carton, front first, about 40 cm from the webcam. Wait for "Turn it". Turn it
   to the top (`2027 FE 14`). Wait for "Keep. Until February 2029." Put it down.
4. The yogurt tub, lid to the camera: "Set aside for the lead."
5. Two or three more items from the pantry the app has never seen (a can, a box of pasta). Whatever
   it says, keep it: a real answer on an unseen item is worth more than a perfect one.

## Shots

| # | Narration line | Shot | Source | Status |
|---|---|---|---|---|
| 1 | "A donated carton of broth..." | Close-up of the carton top, `2027 FE 14 02146`, in a hand | film: phone, 4K, the real carton | needs Jonathan |
| 2 | "At a food bank sort table..." | Sort table with donations (no people's faces) | film at the sort shift; fallback: a kitchen table of donations | needs Jonathan (fallback is fine) |
| 3L to 5L | "I hold the carton up...", "I turn it...", "Yogurt..." | The live take above: hands, items, screen and voice in one shot | film: phone over the shoulder | needs Jonathan, laptop plugged in. Replaces 3 to 5 |
| 3 | "I hold the carton up..." + the app's "Turn it" | Screen: hands-free on, carton front, "Turn it", badge "Checked on this laptop" | `broll/handsfree-voice-1-2026-11-27-0844.mp4`, 0 to 6 s (the voice is at 3.5 s) | recorded 2026-11-27, voice on |
| 4 | "I turn it..." + the app's "Keep. Until February 2029." | Screen: carton top, Keep until 14 FEB 2029, chart page 8 | same file, 13 to 23 s (the voice is at 19 s) | recorded |
| 5 | "Yogurt needs the fridge..." | Screen: yogurt lid, Set aside, the app says why | same file, 40 to 50 s (the voice is at 44.8 s) | recorded |
| 6 | "Nothing gets binned on one read..." + the app's "Discard..." | Screen: the peanut butter jar dated 2021, red Discard, "Two reads agreed on the date", chart page 12; then slide 09 (32 discards, 0 wrong) | `broll/voice-sample-all-2026-11-27-0907.mp4`, 13 to 19 s (the voice is at 14.1 s); `devpost/gallery/09-discard.png` | recorded |
| 7 | "The same read runs on Android." | The Galaxy S24: Start shift, the carton front (Turn it), its top (Keep until 14 FEB 2029), the yogurt (Set aside) | `broll/android-s24-2026-11-27-0840.mp4` (portrait, 71 s; use 20 to 45 s, sped up) | recorded. The Android discard sample is built but not yet filmed |
| 8 | "Every morning..." | Slide 11 (recall table), then the shift-start recall line on the app's banner | `devpost/gallery/11-recall.png`; the banner is in every web recording ("Recall check: nothing to pull. 238 food recalls...") | ready |
| 9 | "And each item lands..." | The food bank's Google Sheet with the new row appearing | screen recording of the sheet in Chrome | needs Jonathan's Google sign-in |

Longer cut, if there is room: `broll/handsfree-voice-long-2026-11-27-0854.mp4` is the full 8-item
run with the voice (275 s, 13 spoken answers). Sped up 8x under the line about hands-free, it shows
all 16 photos and the "104 checks on the laptop, 6 calls to the cloud" title at the end.

## Rules for the cut

- Every number on screen matches its results file (the claims check covers the page; check the video by eye).
- No faces of clients or volunteers who did not agree to be filmed.
- Crop the screen recordings to the page (drop the tab strip and the taskbar) and zoom in: the text is small at full screen.
- No credit to the tools used to build it, in the video or the description.
- Ends on shot 9, not on a number.
