"""Grades a batch run of the Open Food Facts date control set against the dates its volunteers
confirmed, by the rule registered in shared/date-control-off-ca.json: same digits, same order,
separators ignored.
    python scripts/grade_dates.py results/date-control-off-ca-2026-11-22.json"""
import json
import pathlib
import re
import statistics
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def digits(text):
    """The registered rule, literally: the date's digits in order, separators ignored. A date
    written with a two-digit year ("100223") does not match the same date with four ("10/02/2023");
    such photos are counted and reported separately, never added to the score."""
    return re.sub(r"\D", "", text or "")


def short_year(text):
    """The same digits with every four-digit 20xx year cut to two, to spot same-date-short-year reads."""
    return "".join(x[2:] if len(x) == 4 and x.startswith("20") else x for x in re.findall(r"\d+", text or ""))


def date_read(step):
    """The last date characters any read of this item produced."""
    for r in reversed(step.get("reads", [])):
        t = (r.get("read") or {}).get("date_text") or ""
        if t.strip():
            return t
    return ""


def main(run_path):
    labels = {i["file"]: i for i in json.loads((ROOT / "shared/date-control-off-ca.json").read_text(encoding="utf-8"))["items"]}
    run = json.loads(pathlib.Path(run_path).read_text(encoding="utf-8"))
    rows, right, no_date, errors, ms, same_date_short_year = [], 0, 0, 0, [], 0
    for r in run["results"]:
        lab = labels.get(r.get("file"))
        if not lab:
            continue
        step = r["step"]
        if step.get("route", "").startswith("error") or not step.get("reads"):
            errors += 1
            rows.append((lab["file"], lab["printed"], "(read failed)", "", "NO"))
            continue
        ms += [x["ms"] for x in step["reads"] if x.get("source") == "in_cloud"]
        read = date_read(step)
        ok = bool(read) and digits(read) == lab["digits"]
        right += ok
        same_date_short_year += bool(read) and not ok and short_year(read) == short_year(lab["printed"])
        no_date += not read
        what = step["kind"] if step["kind"] != "verdict" else step["verdict"]["decision"]
        rows.append((lab["file"], lab["printed"], read or "(no date read)", what, "yes" if ok else "NO"))
    n = len(rows)
    print(f"Run: {run_path} | cloud model {run.get('cloudModel')} | {n} photos")
    print()
    print("| photo | date confirmed on Open Food Facts | date the app read | app's answer | same date |")
    print("|---|---|---|---|---|")
    for row in rows:
        print("| " + " | ".join(str(c).replace("|", "/") for c in row) + " |")
    print()
    print(f"Dates read right: {right} of {n}. No date read: {no_date}. Read failed: {errors}.")
    print(f"Not counted: {same_date_short_year} more read the same date with a two-digit year.")
    if ms:
        print(f"Cloud read time: median {statistics.median(ms) / 1000:.1f} s over {len(ms)} reads.")


if __name__ == "__main__":
    main(sys.argv[1])
