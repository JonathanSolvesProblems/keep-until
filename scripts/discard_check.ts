// Were the discards right? For every photo in the 100-photo date run
// (results/date-control-off-ca-2026-11-22.json) this runs the app's own chart gate again with the date
// the Open Food Facts volunteer confirmed instead of the date the app read, on the same day, the same
// chart row the model chose and the date kind it read. That gives what the app should have said if it
// had read the date perfectly, set beside what it did say.
//   npx tsx scripts/discard_check.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gate, type DateKind } from "../web/src/chart/chart";
import { parseDateText } from "../web/src/chart/dates";

const root = join(import.meta.dirname, "..");
const run = JSON.parse(readFileSync(join(root, "results/date-control-off-ca-2026-11-22.json"), "utf8"));
const control = JSON.parse(readFileSync(join(root, "shared/date-control-off-ca.json"), "utf8"));
const truth = new Map<string, { printed: string }>(control.items.map((i: { file: string; printed: string }) => [i.file, i]));

const said = (s: { kind: string; verdict?: { decision: string } }) => (s.kind === "verdict" ? s.verdict!.decision : s.kind);
let discards = 0;
let stillDiscard = 0;
let sameDate = 0;
let secondReadDisagreed = 0;
let firstReadAloneRight = 0;
// Items the chart says are still good by the confirmed date, and what the app did with them.
let shouldKeep = 0;
const keptGoodFoodAs: Record<string, number> = {};
const changed: string[] = [];
for (const r of run.results) {
  const s = r.step;
  const today = r.at.slice(0, 10);
  const confirmed = parseDateText(truth.get(r.file)!.printed, today);
  const read = s.reads?.[0]?.read;
  const expected = read
    ? gate({ categoryId: read.category, date: confirmed, dateKind: (read.date_kind === "none_visible" ? "best_before" : read.date_kind) as DateKind, damage: read.damage ?? "none", today }).decision
    : "no read";
  if (expected === "KEEP") {
    shouldKeep++;
    keptGoodFoodAs[said(s)] = (keptGoodFoodAs[said(s)] ?? 0) + 1;
  }
  if (String(s.route ?? "").includes("disagreed")) {
    secondReadDisagreed++;
    if (expected === "DISCARD") firstReadAloneRight++;
  }
  if (said(s) !== "DISCARD") continue;
  discards++;
  if (confirmed.kind === "exact" && confirmed.iso === s.parsed.iso) sameDate++;
  if (expected === "DISCARD") stillDiscard++;
  else changed.push(`${r.file}: read ${s.parsed.iso}, confirmed ${truth.get(r.file)!.printed}: ${expected}`);
}
console.log(
  JSON.stringify(
    { photos: run.results.length, discards, sameDate, stillDiscard, wrongDiscards: discards - stillDiscard, secondReadDisagreed, firstReadAloneRight, shouldKeep, keptGoodFoodAs, changed },
    null,
    1,
  ),
);
