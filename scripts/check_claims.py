"""Fails when a number the README, the gallery captions or the submission text states no longer
matches the results file it came from, or when a retired claim comes back.

    python scripts/check_claims.py          # exit 1 on any mismatch

Each claim is read from its results file at run time, never typed here, so the check follows the
data. Standard library only."""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCS = ["README.md", "android/README.md", "devpost/gallery/captions.md", "devpost/submission.md"]


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def ablation():
    t = read("results/ablation-inference-mode.md")
    row = lambda label: re.search(rf"\| \**{label}[^|]*\| \**(\d+ of \d+)\** \| \**(\d+)\**", t)
    return {"device": row("On-device only")[1], "hybrid": row("Hybrid")[1], "hybrid_calls": row("Hybrid")[2],
            "cloud": row("Cloud only")[1], "cloud_calls": row("Cloud only")[2]}


def recall():
    m = re.search(r"Model: (\d+ of \d+)\. Brand rule alone: (\d+ of \d+)", read("results/recall-control-2026-11-19.md"))
    return {"model": m[1], "rule": m[2]}


A, R = ablation(), recall()

# (pattern with one group, expected value, what it is). Every match in every document must equal it.
CLAIMS = [
    (r"Gemini (\d+ of \d+)", R["model"], "recall control, model"),
    (r"[Bb]rand alone:? (\d+ of \d+)", R["rule"], "recall control, brand rule"),
    (r"(\d+ of \d+) handled right, \d+ cloud calls", A["hybrid"], "hybrid score"),
    (r"\d+ of \d+ handled right, (\d+) cloud calls", A["hybrid_calls"], "hybrid cloud calls"),
    (r"Cloud only \| (\d+ of \d+)", A["cloud"], "cloud-only score"),
    (r"Nano alone on the laptop \| (\d+ of \d+)", A["device"], "on-device-only score"),
    (r"(\d+) of 16 photos never left the laptop", str(16 - int(A["hybrid_calls"])), "photos kept on the laptop"),
]

# Claims that were true once and are not now. Each entry says why it was retired.
RETIRED = [
    (r"[Bb]rand (?:rule )?alone:? 4 of 8", "the control set has 3 recalled cases, not 4 (corrected 2026-11-19)"),
    (r"Broccoli", "a made-up product name from a required schema field (fixed 2026-11-15)"),
    (r"\bexpired\b(?![\"'])", "best-before food is never 'expired' (charter law 17); quote it only"),
    (r"on-device (?:works|runs) on Android", "no Android phone has run Gemini Nano for this app yet"),
]

failures = []
checked = 0
for rel in DOCS:
    path = ROOT / rel
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    for pattern, expected, what in CLAIMS:
        for m in re.finditer(pattern, text):
            checked += 1
            if m[1] != expected:
                failures.append(f"{rel}: {what} says {m[1]!r}, results say {expected!r}")
    for pattern, why in RETIRED:
        for m in re.finditer(pattern, text):
            line = text[: m.start()].count("\n") + 1
            context = text[max(0, m.start() - 40): m.end() + 10].replace("\n", " ")
            if "Many people incorrectly" in text[max(0, m.start() - 200): m.end()]:
                continue  # the Food Banks Canada quote that names the mistake
            failures.append(f"{rel}:{line}: retired claim ({why}): ...{context}...")

print(f"{checked} claims checked across {len([d for d in DOCS if (ROOT / d).exists()])} documents")
if failures:
    print("\n".join(failures))
    sys.exit(1)
print("all claims match the results files")
