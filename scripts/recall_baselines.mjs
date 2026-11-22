// The two rules the model is measured against, on both pre-registered recall control sets:
// brand alone (what the daily function proposes) and brand plus a shared product word.
//     node scripts/recall_baselines.mjs
// Prints one line per case and a JSON summary. Uses the product's own matcher (functions/match.js).
import { readFileSync } from "node:fs";
import { candidatesFor, keywordRule } from "../functions/match.js";

const sets = ["shared/recall-control.json", "shared/recall-control-2.json"];
const out = {};
for (const path of sets) {
  const set = JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf-8"));
  const rows = [];
  for (const c of set.cases) {
    const notice = { Title: c.recall.title, Product: c.recall.product };
    const brand = candidatesFor(notice, [{ id: "x", ...c.item }]).length ? "pull" : "no_match";
    const keyword = keywordRule(notice, c.item);
    const right = (d) => (c.expected === "recalled" ? d === "pull" : d === "no_match");
    rows.push({ id: c.id, expected: c.expected, brand, brandRight: right(brand), keyword, keywordRight: right(keyword) });
    console.log(`${c.id} expected ${c.expected.padEnd(8)} brand ${brand.padEnd(8)} ${right(brand) ? "ok" : "WRONG"}  keyword ${keyword.padEnd(8)} ${right(keyword) ? "ok" : "WRONG"}`);
  }
  out[path] = {
    cases: rows.length,
    brandRight: rows.filter((r) => r.brandRight).length,
    keywordRight: rows.filter((r) => r.keywordRight).length,
    rows,
  };
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { cases: v.cases, brand: v.brandRight, keyword: v.keywordRight }]))));
