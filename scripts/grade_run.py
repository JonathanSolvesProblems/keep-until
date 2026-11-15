"""Grades an exported Keep Until batch run against hand labels.

Usage: python scripts/grade_run.py <results.json> <labels.json>

For each photo it compares what the app did with what a careful volunteer should do:
  log       the date is readable: the app should log it, with the same date as the label
  turn_it   no date in frame: the app should ask for the item to be turned (TURN IT)
  set_aside chilled or unreadable: the app should set it aside for the lead
  unverified the hand label could not read the stamp either; reported, not scored
Prints a markdown table and a summary. Uses only the standard library.
"""
import json
import statistics
import sys


def outcome(step):
    if step["kind"] == "need_date_photo":
        return "turn_it", None, None
    if step["kind"] == "no_item":
        return "no_item", None, None
    v = step["verdict"]
    parsed = step.get("parsed") or {}
    date = parsed.get("iso") if parsed.get("kind") == "exact" else ("|".join(parsed.get("candidates", [])) or None)
    return {"KEEP": "log", "DISCARD": "log", "SET_ASIDE": "set_aside"}[v["decision"]], v["decision"], date


def main(results_path, labels_path):
    run = json.load(open(results_path, encoding="utf-8"))
    labels = {i["file"]: i for i in json.load(open(labels_path, encoding="utf-8"))["items"]}
    modes = []
    for r in run["results"]:
        if r["mode"] not in modes:
            modes.append(r["mode"])
    for mode in modes:
        grade_mode(results_path, run, labels, mode, [r for r in run["results"] if r["mode"] == mode])
        print()


def grade_mode(results_path, run, labels, mode, results):
    rows, scored, correct, date_checks, date_ok = [], 0, 0, 0, 0
    lat = {"on_device": [], "in_cloud": []}
    for r in results:
        lab = labels.get(r.get("file"))
        if not lab or not r["step"].get("reads"):
            rows.append((r.get("file"), lab["expected"] if lab else "?", r["step"].get("route", "error"), "", "", "", "NO" if lab and lab["expected"] != "unverified" else ""))
            if lab and lab["expected"] != "unverified":
                scored += 1
            continue
        for rd in r["step"]["reads"]:
            lat[rd["source"]].append(rd["ms"])
        got, decision, date = outcome(r["step"])
        read = r["step"]["reads"][-1]["read"]
        exp = lab["expected"]
        ok = ""
        if exp != "unverified":
            scored += 1
            hit = got == exp
            correct += hit
            ok = "yes" if hit else "NO"
        dcheck = ""
        if lab.get("best_before") and date:
            date_checks += 1
            good = date.startswith(lab["best_before"]) or lab["best_before"].startswith(date[:7]) and len(lab["best_before"]) == 7
            date_ok += good
            dcheck = "date ok" if good else f"date WRONG (label {lab['best_before']})"
        sources = " > ".join(f"{x['source']} {x['ms']} ms" for x in r["step"]["reads"])
        rows.append((r["file"], exp, f"{got} {decision or ''}".strip(), read.get("date_text", ""), date or "", sources, f"{ok} {dcheck}".strip()))

    print(f"### {mode}")
    print()
    print(f"Run: {results_path} | cloud model {run.get('cloudModel')} | on-device status: {run.get('onDevice', 'not recorded')}")
    print()
    print("| photo | expected | app did | date text read | parsed | path | match |")
    print("|---|---|---|---|---|---|---|")
    for row in rows:
        print("| " + " | ".join(str(c) for c in row) + " |")
    print(f"\nScored photos: {correct} of {scored} handled as a careful volunteer would.")
    print(f"Dates checked against the label: {date_ok} of {date_checks} correct.")
    for k, v in lat.items():
        if v:
            print(f"{k}: {len(v)} reads, median {statistics.median(v):.0f} ms, max {max(v)} ms")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
