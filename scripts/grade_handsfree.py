"""Grades a hands-free run of the long clip against shared/handsfree-control.json.

    python scripts/grade_handsfree.py results/handsfree-run-2026-11-26-long-2.json

The rule is the one written in the control file before the first run: an item's answer is the
last answer the app gave between its first face appearing and the next item's first face
appearing. Prints a markdown table and a summary line; --json prints the same as JSON.
"""
import json
import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from make_clip import timeline  # noqa: E402


def answer_of(step):
    if step["kind"] == "verdict":
        return {"KEEP": "keep", "SET_ASIDE": "set_aside", "DISCARD": "discard"}[step["verdict"]["decision"]]
    return "turn_it" if step["kind"] == "need_date_photo" else "no_item"


def grade(run, control):
    rows = timeline(control)
    starts = {}
    for start, _end, _what, i in rows:
        if i is not None and i not in starts:
            starts[i] = start
    end_of_clip = rows[-1][1]
    out = []
    for i, item in enumerate(control["items"]):
        lo = starts[i]
        hi = starts.get(i + 1, end_of_clip + 1)
        steps = [s for s in run["steps"] if lo <= s["at"] < hi]
        checks = [c for c in run["checks"] if lo < c["at"] <= hi]
        answers = [answer_of(s["step"]) for s in steps]
        last = steps[-1]["step"] if steps else None
        got = answers[-1] if answers else "no answer"
        until = last["verdict"].get("keepUntil") if last and last["kind"] == "verdict" else None
        cloud = sum(1 for c in checks if c["saw"] == "read")
        expected = item["expected"]
        if expected == "not graded":
            right = None
        else:
            right = got == expected and (expected != "keep" or "keep_until" not in item or until == item["keep_until"])
        out.append({"item": item["item"], "faces": len(item["faces"]), "expected": expected + (f" until {item['keep_until']}" if item.get("keep_until") else ""), "answers": answers, "got": got + (f" until {until}" if until else ""), "checks": len(checks), "cloud_calls": cloud, "right": right})
    return out


def main():
    run_path = pathlib.Path(sys.argv[1])
    run = json.loads(run_path.read_text(encoding="utf-8"))
    control = json.loads((ROOT / "shared/handsfree-control.json").read_text(encoding="utf-8"))
    graded = grade(run, control)
    scored = [g for g in graded if g["right"] is not None]
    right = sum(1 for g in scored if g["right"])
    ms = sorted(c["ms"] for c in run["checks"])
    summary = {
        "run": run_path.name,
        "recorded": run["recorded"],
        "checks": len(run["checks"]),
        "median_check_s": round(ms[len(ms) // 2] / 1000, 1),
        "slowest_check_s": round(ms[-1] / 1000, 1),
        "late_checks": sum(1 for c in run["checks"] if c["saw"] == "slow"),
        "cloud_calls": sum(1 for c in run["checks"] if c["saw"] == "read"),
        "items_right": right,
        "items_graded": len(scored),
        "items": graded,
    }
    if "--json" in sys.argv:
        print(json.dumps(summary, indent=1))
        return
    print("| Item | Faces shown | Expected | The app's answers, in order | Final | Checks | Cloud calls | Right |")
    print("|---|---|---|---|---|---|---|---|")
    for g in graded:
        mark = "not graded" if g["right"] is None else ("yes" if g["right"] else "**no**")
        print(f"| {g['item']} | {g['faces']} | {g['expected'].replace('_', ' ')} | {', '.join(a.replace('_', ' ') for a in g['answers']) or 'none'} | {g['got'].replace('_', ' ')} | {g['checks']} | {g['cloud_calls']} | {mark} |")
    print()
    print(f"{summary['checks']} checks on the laptop (median {summary['median_check_s']} s each, slowest {summary['slowest_check_s']} s, {summary['late_checks']} too late to act on), {summary['cloud_calls']} calls to the cloud, {right} of {len(scored)} graded items right.")


if __name__ == "__main__":
    main()
