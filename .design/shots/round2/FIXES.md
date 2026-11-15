# Round 2

Blind critic (fresh agent, screenshots only): **7 / 10**. Control (the build before the redesign,
same prompt, fresh agent): **7 / 10**. The control passed the 6+ test, so the critic can tell
generated work apart; the redesign at round 2 did not yet pass.

Critic's list and what was done:

| Hit | Fix |
|---|---|
| The black camera box is the largest object and shows nothing | Start shift moved inside it, on the coder's dot screen; after a read without a live camera the photo just read stays there |
| Status line reads as debug output; "1 photos" | Batch and comparison progress moved to a status line inside the tools drawer; plural fixed |
| Concentric arcs run through "FE 14" and the Keep band | Lid only in the waiting state; charter law 7 amended |
| Dot-grid canvas reads as a dev-tool texture | Removed from the canvas; it lives only in the camera box before the camera is on |
| Dot-matrix digits mixed into the tally line jitter | Counts in Atkinson bold (charter law 1 already said dates only; this was a breach) |
| "Turn it" in an outlined box reads as an empty input | Turn it and Nothing in view are an ink band |
| Disabled Read item looks like a hover state | Disabled is a grey well, not faded cobalt |
| Native select | Dot-V arrow; hidden when there is one camera |
| "No camera found" is the loudest text | Body size, muted |
| Result card height jumps between states | Panel min-height 620 px on desktop |
| Log: dead space after the chip; right column has two meanings; "Name not in this photo" as a title | Chip column 7rem; right column is only "keep until"; no-name rows are titled by the chart row the gate used, with "No name in this photo" in the detail |
| "keep 1 months" | Fixed (a heredoc had turned the regex's word boundaries into backspaces); tests added |
| Same photo Keep then Discard in the log | Capture artefact (sort date moved for the discard shot); discard now captured in its own shift |
| Phone: verdict below the fold | Camera box 36vh at phone width, and the answer scrolls into view after each read |

Answered with a reason, not changed:

- Read-by badge shows seconds: where and how fast each read happened is the hybrid evidence the
  product exists to show (charter law 12).
- The cobalt tittle on the wordmark: it is the can lid seen from above, and the same mark is the
  favicon; kept.
- Halftone hands: kept as the illustration system; the "Turn it" picture does not show turning,
  noted for the next generation pass.

Also found by me in this round (not by the critic): the read schema forced a product name, so a
carton top with no name was logged as "Broccoli Soup". Name is now optional; recorded in
devpost/build-log.md with the cloud re-run, which also exposed the year-5037 parser bug.
