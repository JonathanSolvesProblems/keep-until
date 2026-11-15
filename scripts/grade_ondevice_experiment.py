"""Grades the on-device job experiment (web/src/dev/ondevice-experiment.ts) against hand labels.

Usage: python scripts/grade_ondevice_experiment.py <experiment.json> <labels.json>

A_full_read_no_example  the app's full read, scored with the app's own rules and no cloud
B_triage                three yes/no answers mapped to an outcome: no package -> no item,
                        fridge -> set aside, no date in view -> turn it, date in view -> log
                        (in the app, the cloud would then read the date)
C_date_only             the date characters alone: right if they parse to the labelled date,
                        an invention if it returns a date for a photo that shows none
Standard library only. The date parser here is a small mirror of web/src/chart/dates.ts for
the CFIA year-month-day stamps in this set.
"""
import json
import re
import statistics
import sys

MONTHS = {"JA": 1, "FE": 2, "MR": 3, "AL": 4, "MA": 5, "JN": 6, "JL": 7, "AU": 8, "SE": 9, "OC": 10, "NO": 11, "DE": 12}
CHILLED = {"chilled_or_frozen", "fresh_produce"}


def parse_cfia(text):
    t = re.sub(r"^(BEST\s*BEFORE\s*/?\s*MEILLEUR\s*AVANT|MEILLEUR\s*AVANT\s*/?\s*BEST\s*BEFORE|BB\s*/\s*MA|EXP)\W*", "", text.upper().strip())
    m = re.search(r"(\d{2,4})\s*([A-Z]{2})\s*(\d{1,2})?", t)
    if not m or m.group(2) not in MONTHS:
        return None
    y = int(m.group(1)) if len(m.group(1)) == 4 else 2000 + int(m.group(1)[-2:])
    if not 2015 <= y <= 2035:
        return None
    mo = MONTHS[m.group(2)]
    return f"{y:04d}-{mo:02d}" + (f"-{int(m.group(3)):02d}" if m.group(3) else "")


def date_matches(parsed, label):
    return bool(parsed) and (parsed.startswith(label) or label.startswith(parsed[:7]) and len(label) == 7)


def outcome_full(o):
    na, cat = o.get("next_action"), o.get("category")
    if na == "no_item":
        return "no_item"
    if na in ("set_aside", "ask_cloud") or cat in CHILLED:
        return "set_aside"
    if na == "show_me_the_date":
        return "turn_it"
    if cat == "unclear":
        return "set_aside"
    if o.get("date_kind") != "none_visible" and not parse_cfia(o.get("date_text", "")):
        return "set_aside"
    if not o.get("date_text"):
        return "set_aside"  # logged with no date: the gate sets it aside
    return "log"


def outcome_triage(o):
    if not o.get("package_in_view"):
        return "no_item"
    if o.get("needs_refrigeration"):
        return "set_aside"
    return "log" if o.get("date_in_view") else "turn_it"


def main(path, labels_path):
    run = json.load(open(path, encoding="utf-8"))
    labels = {i["file"]: i for i in json.load(open(labels_path, encoding="utf-8"))["items"]}
    print(f"On-device status: {run.get('onDevice')} | exported {run.get('exported')}\n")
    for variant in [v["id"] for v in run["variants"]]:
        rows = [r for r in run["rows"] if r["variant"] == variant]
        ms = [r["ms"] for r in rows if r["source"] != "error"]
        errors = sum(r["source"] == "error" for r in rows)
        sources = {r["source"] for r in rows}
        print(f"### {variant}")
        print(f"sources {sorted(sources)}; errors {errors}; median {statistics.median(ms):.0f} ms" if ms else f"errors {errors}")
        scored = correct = 0
        dates_right = dates_wrong = invented = blank_ok = 0
        for r in rows:
            lab = labels[r["file"]]
            try:
                o = json.loads(r["text"]) if r["text"] else {}
            except json.JSONDecodeError:
                o = {}
            if variant.startswith("C_"):
                got = parse_cfia(o.get("date_text", "")) if o.get("date_text") else None
                if lab.get("best_before"):
                    if date_matches(got, lab["best_before"]):
                        dates_right += 1
                    else:
                        dates_wrong += 1
                        print(f"  {r['file']}: label {lab['best_before']}, read {o.get('date_text')!r}")
                elif lab["expected"] != "unverified":
                    if o.get("date_text"):
                        invented += 1
                        print(f"  {r['file']}: no date on this side, but it returned {o.get('date_text')!r}")
                    else:
                        blank_ok += 1
                continue
            exp = lab["expected"]
            if exp == "unverified":
                continue
            got = outcome_full(o) if variant.startswith("A_") else outcome_triage(o)
            hit = got == exp
            if hit and exp == "log" and variant.startswith("A_"):
                hit = date_matches(parse_cfia(o.get("date_text", "")), lab["best_before"])
            scored += 1
            correct += hit
            if not hit:
                print(f"  {r['file']}: expected {exp}, got {got}  {json.dumps(o)[:150]}")
        if variant.startswith("C_"):
            print(f"Dated photos read right: {dates_right} of {dates_right + dates_wrong}. "
                  f"Photos with no date on that side: {blank_ok} left blank, {invented} given an invented date.\n")
        else:
            print(f"Scored photos handled correctly: {correct} of {scored}\n")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
