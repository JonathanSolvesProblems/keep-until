// Writes shared/gate-vectors.json: what the web app's date parser and chart gate (TypeScript,
// web/src/chart) answer for a broad set of stamps, categories and sort dates. The Android app's
// Kotlin port of the same gate is tested against every line of that file, so the two platforms
// cannot quietly disagree about what to keep.
//
// Run from the repo root:  node scripts/export_gate_vectors.mjs
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "web", "package.json"));
const { rolldown } = require("rolldown");

// Bundle the two TypeScript modules (and the chart JSON they import) into one file Node can load.
const entry = join(root, "tmp", "gate-vectors-entry.ts");
mkdirSync(dirname(entry), { recursive: true });
writeFileSync(
  entry,
  'export { parseDateText } from "../web/src/chart/dates";\nexport { gate, CHART } from "../web/src/chart/chart";\n',
);
const bundle = await rolldown({ input: entry, logLevel: "silent" });
const out = join(root, "tmp", "gate-vectors-bundle.mjs");
await bundle.write({ file: out, format: "esm" });
const { parseDateText, gate, CHART } = await import(pathToFileURL(out).href);

const TODAY = "2026-11-14";

// Stamps: every one in web/src/chart/chart.test.ts, then more of each shape.
const STAMPS = [
  "BB/MA 5037 MA", "2097 FE 14", "1999 FE 14", "2027 FE 14", "2019 JA 05",
  "BB/MA 2025 JA 14", "17 JN 28", "26JA14", "BB MA 2026 JA 14", "MEILLEUR AVANT 2027 FE 03",
  "2027 MA 09", "L2345 26 JA 14", "DE 02", "JN 28", "BEST BY JAN 14 2026", "14 JAN 2026",
  "EXP MAR 2027", "03/04/2026", "25/04/2026", "260114", "2026 MR 14", "2025 JA 14",
  "2026 FE 01", "2025 AU 01", "EXP 2026 NO 01", "2027 JA 01", "10/11/2026",
  // CFIA symbols, every month
  "2027 JA 31", "2027 FE 28", "2028 FE 29", "2027 FE 29", "2027 MR 01", "2027 AL 30", "2027 AL 31",
  "2027 MA 15", "2027 JN 30", "2027 JL 04", "2027 AU 19", "2027 SE 07", "2027 OC 31", "2027 NO 11", "2027 DE 25",
  "27 MA 15", "27MA15", "BB/MA 27 SE 07", "BB/MA 2027 MA", "BB MA 14", "MA 14", "BB/MA MA 14",
  // Prefixes, accents and separators
  "Best before / Meilleur avant 2026 DE 07", "MEILLEUR AVANT / BEST BEFORE 2026 NO 30", "BEST BEFORE: 2027-03-15",
  "EXPIRY DATE 2027/06/30", "EXP 2026 NO 01", "USE BY 12 DEC 2026", "PACKAGED ON 2026 OC 01", "Empaqueté le 2026 OC 01",
  "BBD 2027.01.09", "bb/ma 2027 fe 14", "  2027  FE  14  ", "2027 FE 14 02146", "Meilleur avant 14 févr 2027",
  "14 AOÛT 2027", "DÉC 2026", "2027 DEC", "MARCH 2027", "JUIN 12 27", "12 JUIN 27", "SEPT 3 2026",
  // No year
  "NO 20", "JA 05", "MR 30", "OC 01", "AU 15", "FE 30",
  // Numeric
  "2026-12-01", "01-12-2026", "12/01/26", "31/12/26", "13/13/2026", "2026/13/01", "06 2027", "2027 06", "2026 14",
  // Not dates
  "", "LOT 4471", "66EBGW16SK", "25 OC 2029FYFY", "5666009287", "N/A", "2019", "450 g", "A1B2",
  // Implausible years at the edges of the window (15 behind, 7 ahead of the sort)
  "2011 JA 01", "2010 DE 31", "2033 DE 31", "2034 JA 01", "2012/05/06",
];
const TODAYS = [TODAY, "2026-03-01", "2030-01-01"];

const dates = [];
for (const today of TODAYS) for (const raw of STAMPS) dates.push({ raw, today, expect: parseDateText(raw, today) });

// Gate: every chart row against stamps on each side of its limit, each date kind, and damage.
const GATE_STAMPS = ["2027 FE 14", "2026 MR 14", "2025 JA 14", "2024 JN 30", "2026 NO 14", "2026 NO 13", "03/04/2026", "10/11/2026", "EXP MAR 2027", "DE 02", "66EBGW16SK", ""];
const POLICIES = [undefined, { bound: "max" }, { bound: "min", overrides: { canned_fruit_veg: { rule: "months", value: 18 }, boxed_cereal: { rule: "days", value: 30 } } }];
const gates = [];
const push = (input) => {
  const date = input.dateText ? parseDateText(input.dateText, input.today) : null;
  const verdict = gate({ categoryId: input.categoryId, date, dateKind: input.dateKind, damage: input.damage, today: input.today, policy: input.policy });
  gates.push({ ...input, expect: verdict });
};
for (const row of [...CHART.categories, { id: "unclear" }, { id: "not_a_row" }]) {
  for (const dateText of GATE_STAMPS) {
    const dateKind = dateText === "" ? "none_visible" : dateText.startsWith("EXP") ? "expiry" : "best_before";
    // The two non-default policies run on the first three stamps only, to keep the file small.
    for (const policy of GATE_STAMPS.indexOf(dateText) < 3 ? POLICIES : [undefined]) push({ categoryId: row.id, dateText, dateKind, damage: "none", today: TODAY, policy });
  }
  push({ categoryId: row.id, dateText: "2026 OC 01", dateKind: "packaged_on", damage: "none", today: TODAY });
  push({ categoryId: row.id, dateText: "2026 NO 01", dateKind: "expiry", damage: "none", today: TODAY });
  push({ categoryId: row.id, dateText: "2027 FE 14", dateKind: "none_visible", damage: "none", today: TODAY });
  for (const damage of ["dent", "bulge", "rust", "leak", "open", "unsure"]) push({ categoryId: row.id, dateText: "2027 FE 14", dateKind: "best_before", damage, today: TODAY });
  push({ categoryId: row.id, dateText: "2027 FE 14", dateKind: "best_before", damage: "none", today: "2030-01-01" });
  push({ categoryId: row.id, dateText: "2027 FE 14", dateKind: "best_before", damage: "none", today: "2028-02-14" });
  push({ categoryId: row.id, dateText: "2027 FE 14", dateKind: "best_before", damage: "none", today: "2027-08-14" });
}

const file = join(root, "shared", "gate-vectors.json");
const body = {
  note: "Generated by scripts/export_gate_vectors.mjs from web/src/chart (TypeScript). The Android Kotlin gate must give exactly these answers (android/app/src/test/.../GateVectorsTest.kt). Do not edit by hand.",
  chart: CHART.source,
  dates,
  gates,
};
// One vector per line, so a diff shows exactly which answers changed.
const lines = (xs) => xs.map((x) => "    " + JSON.stringify(x)).join(",\n");
writeFileSync(
  file,
  `{\n  "note": ${JSON.stringify(body.note)},\n  "chart": ${JSON.stringify(body.chart)},\n  "dates": [\n${lines(dates)}\n  ],\n  "gates": [\n${lines(gates)}\n  ]\n}\n`,
);
console.log(`wrote ${file}: ${dates.length} date vectors, ${gates.length} gate vectors`);
