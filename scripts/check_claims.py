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
    m = re.search(r"Model: (\d+ of \d+)\. Brand plus a product word: (\d+ of \d+)\. Brand alone: (\d+ of \d+)", read("results/recall-control-2026-11-22.md"))
    return {"model": m[1], "keyword": m[2], "rule": m[3]}


def handsfree(rel):
    m = re.search(r"\*\*(\d+) checks on the laptop \(median ([\d.]+) s each\), (\d+) calls to the cloud(?:, (\d+ of \d+) graded items right)?", read(rel))
    return {"looks": m[1], "median": m[2], "calls": m[3], "items": m[4]}


def date_reading():
    return re.search(r"\*\*Dates read right: (\d+ of \d+)\.\*\*", read("results/date-control-off-ca-2026-11-22.md"))[1]


def discards():
    t = read("results/discard-check-2026-11-27.md")
    row = lambda label: re.search(rf"\| {label}[^|]*\| \**(\d+)\** \|", t)[1]
    return {"discarded": row("Discarded"), "wrong": row("wrong discards"), "disagreed": row("The second read disagreed")}


A, R, D, X = ablation(), recall(), date_reading(), discards()
# Two hands-free runs are quoted: the 70-second clip the replay plays, and the 8-item run.
H = handsfree("results/handsfree-clip-2026-11-26-plugged.md")
L = handsfree("results/handsfree-long-2026-11-26.md")
# The 8-item test run a second time, with the voice on, for the video.
L2 = handsfree("results/handsfree-long-2026-11-27.md")
RUNS = {f"{r['looks']} checks, {r['calls']} calls" for r in (H, L, L2)}
if L2["items"] != L["items"]:
    sys.exit(f"the two 8-item runs differ ({L['items']} and {L2['items']}): say both, not 'the same'")

# (pattern with one group, expected value, what it is). Every match in every document must equal it.
CLAIMS = [
    (r"Gemini (\d+ of \d+)", R["model"], "recall control, model"),
    (r"[Bb]rand alone:? (\d+ of \d+)", R["rule"], "recall control, brand rule"),
    (r"product word:? (\d+ of \d+)", R["keyword"], "recall control, brand plus product word rule"),
    (r"(\d+ of \d+) handled right, \d+ cloud calls", A["hybrid"], "hybrid score"),
    (r"\d+ of \d+ handled right, (\d+) cloud calls", A["hybrid_calls"], "hybrid cloud calls"),
    (r"Cloud only \| (\d+ of \d+)", A["cloud"], "cloud-only score"),
    (r"Nano alone on the laptop \| (\d+ of \d+)", A["device"], "on-device-only score"),
    (r"(\d+) of 16 photos never left the laptop", str(16 - int(A["hybrid_calls"])), "photos kept on the laptop"),
    (r"read (?:the same date on |right on )?(\d+ of 100)", D, "date reading on the outside set"),
    (r"(\d+ of \d+) (?:graded )?items (?:answered )?right", L["items"], "hands-free items right, 8-item run"),
    (r"(\d+) of the 100 frames", str(int(L["looks"]) - int(L["calls"])), "frames that never left the laptop, 8-item run"),
    (r"Discards: (\d+)", X["discarded"], "discards on the outside set"),
    (r"app discarded (\d+) items", X["discarded"], "discards on the outside set"),
    (r"(\d+) wrong discards", X["wrong"], "wrong discards on the outside set"),
    (r"(\d+) times the second read", X["disagreed"], "second read disagreed, outside set"),
]
# "none wrong" is a claim too: it holds only while the results file says 0.
if X["wrong"] != "0":
    CLAIMS.append((r"(none) wrong", X["wrong"], "wrong discards on the outside set"))

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
    # A hands-free figure must be one of the two runs, checks and cloud calls together.
    for m in re.finditer(r"(\d+) checks on the laptop(?: \([^)]*\))?(?:,| and) (\d+) (?:calls to|sent to) the cloud", text):
        checked += 1
        if f"{m[1]} checks, {m[2]} calls" not in RUNS:
            failures.append(f"{rel}: hands-free says {m[1]} checks and {m[2]} cloud calls, results say one of {sorted(RUNS)}")
    for m in re.finditer(r"(\d+) checks on the laptop", text):
        checked += 1
        if m[1] not in (H["looks"], L["looks"], L2["looks"]):
            failures.append(f"{rel}: hands-free says {m[1]} checks, results say {H['looks']}, {L['looks']} or {L2['looks']}")
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
