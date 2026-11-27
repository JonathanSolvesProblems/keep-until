// Were the discards right? For every item the 100-photo date run (results/date-control-off-ca-2026-11-22.json)
// discarded, this runs the app's own chart gate again with the date the Open Food Facts volunteer
// confirmed instead of the date the app read, on the same day, and reports whether the call stays a
// discard. It also counts the items where the second, independent read disagreed, so the item went to
// the sort lead instead.
//   npx tsx scripts/discard_check.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gate } from "../web/src/chart/chart";
import { parseDateText } from "../web/src/chart/dates";

const root = join(import.meta.dirname, "..");
const run = JSON.parse(readFileSync(join(root, "results/date-control-off-ca-2026-11-22.json"), "utf8"));
const control = JSON.parse(readFileSync(join(root, "shared/date-control-off-ca.json"), "utf8"));
const truth = new Map<string, { printed: string }>(control.items.map((i: { file: string; printed: string }) => [i.file, i]));

let discards = 0;
let stillDiscard = 0;
let sameDate = 0;
let secondReadDisagreed = 0;
const changed: string[] = [];
let caughtButRight = 0;
const caughtWrong: string[] = [];
for (const r of run.results) {
  const s = r.step;
  if (String(s.route ?? "").includes("disagreed")) {
    // The first read alone said discard. With the confirmed date, would that have been right?
    secondReadDisagreed++;
    const today = r.at.slice(0, 10);
    const v = gate({ categoryId: s.reads[0].read.category, date: parseDateText(truth.get(r.file)!.printed, today), dateKind: "best_before", damage: "none", today });
    if (v.decision === "DISCARD") caughtButRight++;
    else caughtWrong.push(`${r.file}: first read ${s.reads[0].read.date_text}, confirmed ${truth.get(r.file)!.printed}: ${v.decision}`);
  }
  if (s.kind !== "verdict" || s.verdict.decision !== "DISCARD") continue;
  discards++;
  const today = r.at.slice(0, 10);
  const confirmed = parseDateText(truth.get(r.file)!.printed, today);
  if (confirmed.kind === "exact" && confirmed.iso === s.parsed.iso) sameDate++;
  const v = gate({ categoryId: s.reads[0].read.category, date: confirmed, dateKind: "best_before", damage: "none", today });
  if (v.decision === "DISCARD") stillDiscard++;
  else changed.push(`${r.file}: read ${s.parsed.iso}, confirmed ${truth.get(r.file)!.printed}: ${v.decision} (${v.reason})`);
}
console.log(JSON.stringify({ photos: run.results.length, discards, sameDate, stillDiscard, wrongDiscards: discards - stillDiscard, secondReadDisagreed, firstReadAloneWouldHaveBeenRight: caughtButRight, firstReadAloneWouldHaveBeenWrong: caughtWrong.length, changed, caughtWrong }, null, 1));
