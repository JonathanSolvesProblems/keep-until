# The public path, five times in a row on the deployed build, 2026-11-26

The path a judge takes with no camera and no sign-in: the three sample photos, read in turn
(the broth carton's front, its top, a yogurt lid). Run from `https://keep-until-hybrid.web.app/?sample=all`
in my own Chrome 158 (App Check refuses automated browsers, so this check needs a real one), five
times in a row, reading the answers from the window title the page sets when the three are done.

| Run | Front | Top | Yogurt | Time for all three |
|---|---|---|---|---|
| 1 | Turn it so the date faces the camera | Keep until 14 FEB 2029 | Set aside for the lead | 43 s |
| 2 | Turn it so the date faces the camera | Keep until 14 FEB 2029 | Set aside for the lead | 7 s |
| 3 | Turn it so the date faces the camera | Keep until 14 FEB 2029 | Set aside for the lead | 6 s |
| 4 | Turn it so the date faces the camera | Keep until 14 FEB 2029 | Set aside for the lead | 6 s |
| 5 | Turn it so the date faces the camera | Keep until 14 FEB 2029 | Set aside for the lead | 7 s |

5 of 5. Times are from opening the tab, to the nearest 2 s; the first run includes loading the new build.

## What this check found first

Before this result, the same check on the first sample alone answered "Set aside" five times out
of five, in 21 to 34 seconds. While the laptop's check was still warming up in a new tab, the read
went to Gemini Nano's own full read (the job it does badly, 4 of 15 in `ablation-inference-mode.md`)
although the screen said items were being read in the cloud. A visitor whose Chrome has Gemini Nano
would have met that on the first click. Fixed the same day (`readInCloud` in `web/src/ai/loop.ts`,
with a test): the full read is always the cloud's. After the fix the first sample answered
"Turn it" five times out of five in 4 to 8 seconds.
