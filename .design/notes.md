# Keep Until design notes

## Phase 0

- Platform: a web app (a tool, not a marketing site). One primary screen used standing at a sort
  table on a laptop, and at phone width. Judges see it mostly as a 1280x720 frame in a demo video,
  then the hosted URL for a minute.
- Domain: a volunteer holds a donated item to the camera; the app reads the date stamp, applies
  Food Banks Canada's shelf-life chart, says KEEP (until a date), DISCARD (only after two reads
  agree), SET ASIDE (for the lead), TURN IT (show the date) or NO ITEM, and lands the row in the
  food bank's own sheet. Gemini Nano triages on the laptop; the cloud reads dates.
- The one screen that matters: the verdict, the moment after Read item. It must read from about a
  metre away while the volunteer holds the can, and in a compressed video frame.
- Constraints: plain HTML, CSS and TypeScript on Vite; every id in main.ts keeps working; Chrome
  desktop first, also 390 px; developer controls (batch, export, experiment, inference mode) stay
  available but leave the volunteer's path.
- Locked inputs: the verdict vocabulary (KEEP, DISCARD, SET ASIDE, TURN IT, NO ITEM); the chart
  row and page shown as the reason; the read-by badge (on this laptop or in the cloud). No Food
  Banks Canada branding or logo (third-party marks are against the rules).
- Audience temperature: volunteers of any age, often on their first shift, hands full, standing;
  a sort lead who wants the record; Firebase judges who reward a complete product. Register: warm
  and plain, never severe. Big, calm, certain.
- Tools: local ComfyUI installed (server down, start it for Phase 2.5).

## Preservation inventory (redesign)

Keeping: every id and behaviour; the verdict words; the on-device or cloud badge with its time;
the reason with the chart page; the honesty messages (the note when the browser has no on-device
model, the cloud-limit wait, "two reads disagree"); the camera picker; the sort date; newest-first
item log; Run comparison for judges.

Fixing: it reads as a developer harness (browser-default buttons, a run-on status line, export and
batch controls on the volunteer's screen); no hierarchy (the verdict is the same size as
everything else); nothing readable from a metre; raw internal strings on screen ("only_in_cloud",
"in_cloud: model chose log"); no brand; no empty state; no shift summary; the hybrid split is
invisible unless you read a badge.

## Category convention scan

Food bank and pantry software (client intake and inventory tools) ships a white canvas under a
trust-blue or leafy-green header bar, Bootstrap tables and forms, an apple-or-heart logo, rounded
cards, and stock photos of smiling volunteers holding cardboard boxes. AI scanner apps ship a
near-black camera viewfinder with four white corner brackets, a scan line, and a green check or red
cross in a frosted-glass bottom sheet. Keep Until must look like neither.
