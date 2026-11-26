# Hands-free on battery: why the checks were slow, 2026-11-26

On 2026-11-24 two hands-free runs slowed down badly and I put it down to other programs using the
laptop's GPU (`results/handsfree-clip-2026-11-24.md`). On 2026-11-26 the same slowness came back
with the GPU idle, so I measured where the time goes. The laptop was running on battery, and that
is the most likely cause; the plugged-in run that would confirm it is still to be made.

## What was measured

All in my own Chrome (158.0.8127.37; the fast runs of 2026-11-22 were on Chrome 157, which updated
itself on 2026-11-23), Gemini Nano loaded (about 2.9 GB of GPU memory, nothing else on the GPU),
Windows reporting the laptop on battery at 88% (`PowerOnline: False`).

| Run | Checks | Time per check | Page visible | Result |
|---|---|---|---|---|
| A, `results/handsfree-run-2026-11-26-a.json` | 10 | 3.0 to 11.1 s, median 6.7 s | not recorded | carton answered right with **1** cloud call; yogurt skipped (its checks were late) |
| B, `results/handsfree-run-2026-11-26-b.json` | 9 | 7.8 to 10.0 s, median 8.7 s | hidden for all 9 | every check after the first was late; nothing read |
| C (window brought to the front) | 9 | 7.8 to 9.3 s, median 8.8 s | visible for the first 6 | same as B, so a hidden window is not the cause |

During a run `nvidia-smi` showed the GPU drawing 5 to 21 W, mostly under 11% busy.

A probe page (`web/nano-probe.html`, the Prompt API called directly, no app code) then timed
Gemini Nano's steps one by one:

| Step | Time |
|---|---|
| Creating a session | 0.0 to 0.15 s (once 5 s) |
| One image, a yes or no answer | 1.1 to 3.5 s (once 7.4 s) |
| One image, the check's JSON answer (114 characters, schema enforced) | 6.2 s |
| The same without the schema (152 characters) | 9.7 s |
| Three sentences of text (262 characters) | 13.8 s |

That is about 4.5 tokens a second. The check's answer is about 30 tokens, which is the 6 to 9
seconds a check takes. On 2026-11-22 the same check took a median of 1.8 s.

## What it means

- The laptop was on battery in every run measured today, its GPU drew little power, and Gemini
  Nano wrote its answer about four times slower than on 2026-11-22. Hands-free needs a check every
  2 to 3 seconds, so in this state it does not work on this laptop. The power state on 2026-11-22
  was not recorded. Whether the Chrome 157 to 158 update also plays a part cannot be told from these runs;
  the plugged-in run that would tell is still to be made.
- The rewritten hands-free rules did their job in run A: the laptop answered "turn it" for the
  carton's front by itself, and the carton was settled with one cloud call (the 2026-11-22 run
  needed two, because Gemini Nano mistook the front for a fridge item and sent it).
- My explanation on 2026-11-24 (other programs on the GPU) was not checked at the time and may
  have been wrong or only part of it. That file is left as written, with a pointer here.

## What changed in the product

- When checks come back late and the laptop reports it is on battery, hands-free says so:
  "This laptop is on battery, which slows its reader too much for hands-free. Plug it in and press
  Hands-free again, or press Read item." It also says it when hands-free is switched on.
- A late check (over 8 s) is still never acted on, whatever the cause.
