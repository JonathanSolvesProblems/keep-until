# Demo video: script and shot list

Target 75 to 90 seconds. Narration recorded first (one take, plain voice), b-roll cut to it
afterwards with the `demo-video` skill. Raw footage goes in `broll/` (gitignored).
The last shot is the made thing landing where the food bank already works: the row in its sheet.

## Narration

```
A donated carton of broth. The top says 2027 FE 14. Is that a date? Is it past?

At a food bank sort table, a volunteer has seconds to decide, and good food gets binned because of the date on it.

This is Keep Until. I hold the carton up. Gemini Nano, running on the laptop, sees there's no date on this side and asks me to turn it. Nothing has left the laptop.

I turn it. Now the date faces the camera, so that one photo goes to Gemini in the cloud, which reads the stamp exactly as printed. Food Banks Canada's chart decides: keep it, until February 2029.

Nothing gets binned on one read. A cloud read once took a 2027 stamp for 2026 and said discard. So now a discard needs a second, independent read, and if the two disagree, a person checks it.

Yogurt needs the fridge, so it goes to the sort lead.

Every morning, a Firebase function checks recalls against what was kept.

And each item lands as a row in the food bank's own sheet.
```

About 150 words, roughly 70 seconds at a normal pace.

## Shots

| # | Narration line | Shot | Source | Status |
|---|---|---|---|---|
| 1 | "A donated carton of broth..." | Close-up of the carton top, `2027 FE 14 02146`, in a hand | film: phone, 4K, the real carton | needs Jonathan |
| 2 | "At a food bank sort table..." | Sort table with donations (no people's faces) | film at the sort shift; fallback: a kitchen table of donations | needs a shift, or fallback |
| 3 | "I hold the carton up..." | Screen: hands-free on, carton front, "Turn it", badge "Checked on this laptop" | screen recording, `?clip=1` | recorded 2026-11-22: `broll/handsfree-chrome-2026-11-22-1607.mp4` (turn it at about 20 s, keep at 35 s) |
| 4 | "I turn it..." | Screen: carton top, Keep until 14 FEB 2029, chart page 8 | same recording | recorded |
| 5 | "Nothing gets binned on one read..." | Slide 07 (the Chipits misread) | `devpost/gallery/07-refusal.png`, slow push-in | ready |
| 6 | "Yogurt needs the fridge..." | Screen: yogurt lid, Set aside | same recording | recorded (about 55 s) |
| 7 | "Every morning..." | Slide 09 (recall table), then the shift-start recall line | `devpost/gallery/09-recall.png` | ready |
| 8 | "And each item lands..." | The food bank's Google Sheet with the new row appearing | screen recording of the sheet in Chrome | needs Jonathan's Google sign-in |

Optional, if there is time: the same carton read on the Galaxy S24 (Android), 3 seconds, after shot 4.

## Rules for the cut

- Every number on screen matches its results file (the claims check covers the page; check the video by eye).
- No faces of clients or volunteers who did not agree to be filmed.
- No AI or Claude credit anywhere in the video.
- Ends on shot 8, not on a number.
