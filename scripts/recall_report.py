"""Writes results/recall-control-2026-11-22.md from the model's run file and the two rules
(scripts/recall_baselines.mjs, which uses the product's own matcher in functions/match.js).
    python scripts/recall_report.py"""
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
RUN = ROOT / "results" / "recall-control-2026-11-22.json"
OUT = ROOT / "results" / "recall-control-2026-11-22.md"
SETS = ["shared/recall-control.json", "shared/recall-control-2.json"]

run = json.loads(RUN.read_text(encoding="utf-8"))
model = {r["id"]: r for r in run["runs"]}
rules = {}
for line in subprocess.run(["node", "scripts/recall_baselines.mjs"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.splitlines()[:-1]:
    p = line.split()
    rules[p[0]] = {"brand": p[4], "keyword": p[7]}


def ok(expected, decision):
    return decision in ("pull", "check_lot") if expected == "recalled" else decision == "no_match"


lines = [
    "# Recall control sets, 2026-11-22: the model against two rules",
    "",
    f"Model run: `results/recall-control-2026-11-22.json`, cloud model {run['cloudModel']}, through Firebase AI Logic (PREFER_IN_CLOUD), from the app's recall control runner on localhost.",
    "Rules: `scripts/recall_baselines.mjs`, using the product's own matcher (`functions/match.js`). This file: `scripts/recall_report.py`.",
    "",
    "Two rules stand in for the model. **Brand alone** is what the daily function proposes. **Brand plus a product word** pulls only when the brand is in the notice and the kept item shares a product word (four letters or more, singular) with the recalled product: the rule a careful programmer would write without a model.",
    "",
]
totals = [0, 0, 0]
for path in SETS:
    s = json.loads((ROOT / path).read_text(encoding="utf-8"))
    title = "First set, registered 2026-11-19" if "2.json" not in path else "Second set, registered 2026-11-22 (commit 02cd1d2), harder: same brand and mostly the same kind of food"
    lines += [f"## {title}", "", "| case | recall notice | kept item | expected | brand alone | brand + product word | Gemini | Gemini's reason |", "|---|---|---|---|---|---|---|---|"]
    m = k = b = 0
    for c in s["cases"]:
        r, rb = model[c["id"]], rules[c["id"]]
        bo, ko, mo = ok(c["expected"], rb["brand"]), ok(c["expected"], rb["keyword"]), ok(c["expected"], r.get("model", ""))
        b, k, m = b + bo, k + ko, m + mo
        why = (r.get("why") or "").replace("|", "/")
        lines.append(f"| {c['id']} | {c['recall']['title'][:90]} | {c['item']['brand']} {c['item']['product']} | {c['expected']} | {rb['brand']} {'✓' if bo else '✗'} | {rb['keyword']} {'✓' if ko else '✗'} | {r.get('model')} {'✓' if mo else '✗'} | {why} |")
    lines += ["", f"Gemini {m} of 8. Brand plus a product word {k} of 8. Brand alone {b} of 8.", ""]
    totals = [totals[0] + m, totals[1] + k, totals[2] + b]
lines += [
    "## Both sets",
    "",
    f"**Model: {totals[0]} of 16. Brand plus a product word: {totals[1]} of 16. Brand alone: {totals[2]} of 16.**",
    "",
    "## Limits",
    "",
    "- Found by this set, fixed the same day: d2's brand is printed as \"PC\", and the daily function's brand match needed three letters, so in the product that item was never proposed and the model never saw it. The matcher now spells out the short forms the store brands print (`BRAND_ALIASES` in `functions/match.js`), and both rules above are scored with that fix. A short form not on that list is still missed before the model.",
    "- The second set was chosen to be the hard part of recall matching (variants of the same product, an abbreviation, a French label), so it favours a reader of meaning over a word rule by design. Its expected answers were committed before either the rules or the model ran on it.",
    "- 16 cases, all decided from text. A recall limited to certain lot codes (check_lot) is not in either set yet.",
    "- The first set's model answers here are a second run; they match the 2026-11-19 run case for case (`results/recall-control-2026-11-19.md`).",
]
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"model {totals[0]}/16, keyword {totals[1]}/16, brand {totals[2]}/16")
