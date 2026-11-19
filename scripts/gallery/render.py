"""Renders the Devpost gallery: one composed 1500x1000 slide per beat, in the product's own
brand, each with a headline, a badge naming where the image or number comes from, a capture
or a result, and a caption under 140 characters. Every number is read from a results file at
render time, so a changed result re-renders the slide.
    python scripts/gallery/capture.py   # the app's real states (dev server running)
    python scripts/gallery/render.py    # devpost/gallery/NN-name.png and captions.md"""
import html
import pathlib
import re
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "devpost" / "gallery" / "src"
OUT = ROOT / "devpost" / "gallery"
FONTS = (ROOT / "web" / "public" / "fonts").as_uri()
ART = (ROOT / "web" / "public" / "brand" / "art").as_uri()


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def ablation():
    t = read("results/ablation-inference-mode.md")
    row = lambda label: re.search(rf"\| \**{label}[^|]*\| \**(\d+) of (\d+)\** \| \**(\d+)\**", t)
    dev, hyb, cloud = row("On-device only"), row("Hybrid"), row("Cloud only")
    return {
        "device": f"{dev[1]} of {dev[2]}", "hybrid": f"{hyb[1]} of {hyb[2]}", "cloud": f"{cloud[1]} of {cloud[2]}",
        "hybrid_calls": int(hyb[3]), "cloud_calls": int(cloud[3]), "photos": 16,
    }


def recall():
    t = read("results/recall-control-2026-11-19.md")
    m = re.search(r"Model: (\d+) of (\d+)\. Brand rule alone: (\d+) of (\d+)", t)
    rows = re.findall(r"^\| c\d \| ([^|]+) \| ([^|]+) \| (\w+) \| pull (.) \| (\w+) (.) \|", t, re.M)
    return {"model": f"{m[1]} of {m[2]}", "rule": f"{m[3]} of {m[4]}", "false_pulls": int(m[2]) - int(m[3]), "rows": rows}


def quote():
    t = read("devpost/sources.md")
    return re.search(r'"(Many people incorrectly[^"]+)"', t)[1]


def img(name):
    return (SRC / name).as_uri()


def gate():
    import json
    v = json.loads(read("shared/gate-vectors.json"))
    return {"stamps": f"{len(v['dates']):,}", "decisions": f"{len(v['gates']):,}"}


A = ablation()
R = recall()
GATE = gate()

SLIDES = [
    {
        "name": "keep",
        "headline": "Hold up a can. It says how long the food stays good.",
        "badge": "The live app reading a real carton from my pantry",
        "body": f'<img class="cap" src="{img("keep.png")}">',
        "caption": "A volunteer holds up a donation. Keep Until reads the date stamp and says keep it, and until when, from Food Banks Canada's chart.",
    },
    {
        "name": "problem",
        "headline": "Good food gets binned because of the date on it",
        "badge": "Brita Ball, PhD, Food Banks Canada guest blog, May 2019",
        "body": f'<blockquote>&ldquo;{html.escape(quote())}&rdquo;</blockquote><img class="art" src="{ART}/hands-can.webp">',
        "caption": "Food Banks Canada's own blog: people throw out good food once it reaches its best-before date. Sort tables face that with every item.",
    },
    {
        "name": "two-photos",
        "headline": "Front for the name, top for the date: one item",
        "badge": "Real photos, the same carton turned",
        "body": f'<div class="pair"><img class="cap" src="{img("turn-for-date.png")}"><img class="cap" src="{img("keep.png")}"></div>',
        "caption": "The front shows the name and no date, so it asks to turn the item. The top shows the date. Both photos settle it together.",
    },
    {
        "name": "hybrid",
        "headline": f"{A['photos'] - A['hybrid_calls']} of {A['photos']} photos never left the laptop",
        "badge": "results/ablation-inference-mode.md, graded against hand labels",
        "body": f"""<table>
<tr><th>How items are read</th><th>Handled right</th><th>Cloud calls</th></tr>
<tr><td>Gemini Nano on the laptop only</td><td>{A['device']}</td><td>0</td></tr>
<tr class="hi"><td>Nano checks every photo, the cloud reads dates</td><td>{A['hybrid']}</td><td>{A['hybrid_calls']}</td></tr>
<tr><td>Cloud only</td><td>{A['cloud']}</td><td>{A['cloud_calls']}</td></tr>
</table>""",
        "caption": f"Gemini Nano checks each photo on the laptop; only photos with a date go to the cloud. {A['hybrid']} handled right with {A['hybrid_calls']} cloud calls.",
    },
    {
        "name": "refusal",
        "headline": "Nothing is binned on one read",
        "badge": "The live app, same carton, sort date set to 2030",
        "body": f'<img class="cap" src="{img("discard.png")}">',
        "caption": "A discard needs a second read that finds the same date. If the reads disagree, the item goes to the sort lead instead.",
    },
    {
        "name": "aside",
        "headline": "Chilled food goes to the lead, not the shelf",
        "badge": "The live app reading a real yogurt lid",
        "body": f'<img class="cap" src="{img("aside.png")}">',
        "caption": "Fridge items, damaged packages and dates two reads disagree on are set aside for the sort lead, in plain words.",
    },
    {
        "name": "recall",
        "headline": "Same brand is not the same product",
        "badge": "Government of Canada recall notices; expected answers committed before the run",
        "body": "<table class=\"small\"><tr><th>Recall notice</th><th>Item on the shelf</th><th>Brand alone</th><th>Gemini</th></tr>"
        + "".join(
            f"<tr><td>{html.escape(n.strip()[:58])}</td><td>{html.escape(i.strip())}</td><td>{'pull ' + ok_rule}</td><td>{dec} {ok_m}</td></tr>"
            for n, i, exp, ok_rule, dec, ok_m in R["rows"]
        )
        + f"</table><p class=\"big\">Gemini {R['model']}. Brand alone {R['rule']}.</p>",
        "caption": f"Each morning a Firebase function checks food recalls against stock. Gemini clears same-brand items: {R['model']}, brand alone {R['rule']}.",
    },
    {
        "name": "phone",
        "headline": "Read from a metre away, on a laptop or a phone",
        "badge": "The live app at phone width, dark",
        "body": f'<img class="phone" src="{img("phone-keep.png")}"><div class="note">The verdict fills the panel in its colour, with the word. Dates print in the coder\'s dot matrix, the way they are stamped on the can.</div>',
        "caption": "The decision fills the screen in its colour and always carries the word. Dates are re-printed the way the coder stamped them.",
    },
    {
        "name": "android",
        "headline": "The same sort table on Android",
        "badge": "Galaxy S24, a real phone; results/android-testlab-2026-11-19.md",
        "body": f'<img class="phone" src="{img("android-s24-live.png")}"><img class="phone" src="{img("android-s24-read.png")}">'
        f'<div class="note">Same loop, same chart. The two gates agree on {GATE["stamps"]} date stamps and {GATE["decisions"]} chart decisions. This phone has no on-device model, so it reads in the cloud and says so.</div>',
        "caption": f"The Android app runs the same loop and chart, matching the web on {GATE['decisions']} decisions. On a phone without Nano it says it reads in the cloud.",
    },
]

CSS = f"""
@font-face {{ font-family: A; src: url({FONTS}/atkinson-normal-latin.woff2); font-weight: 200 800; }}
@font-face {{ font-family: D; src: url({FONTS}/doto-normal-latin.woff2); font-weight: 100 900; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; width: 1500px; height: 1000px; background: #d0cec8; font-family: A; color: #151515; overflow: hidden; }}
.slide {{ position: absolute; inset: 0; padding: 56px 64px; display: grid; grid-template-rows: auto auto 1fr; gap: 18px; }}
.top {{ display: flex; justify-content: space-between; align-items: baseline; }}
.mark {{ font-family: D; font-weight: 900; font-size: 34px; letter-spacing: .04em; }}
.badge {{ font-size: 18px; color: #3a3936; border: 1.5px solid rgb(21 21 21 / .25); border-radius: 6px; padding: 6px 12px; }}
h1 {{ margin: 0; font-size: 62px; line-height: 1.02; font-weight: 800; letter-spacing: -.02em; max-width: 24ch; }}
.body {{ position: relative; min-height: 0; display: flex; gap: 28px; align-items: flex-start; }}
.cap {{ max-width: 100%; max-height: 640px; border-radius: 8px; border: 1px solid rgb(21 21 21 / .14); box-shadow: 0 1px 0 rgb(21 21 21 / .06); }}
.pair {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }} .pair .cap {{ width: 100%; }}
blockquote {{ margin: 0; font-size: 48px; line-height: 1.2; max-width: 22ch; background: #f2f2ef; padding: 36px 40px; border-radius: 8px; }}
.art {{ width: 440px; margin-left: auto; align-self: flex-end; }}
table {{ border-collapse: collapse; font-size: 30px; background: #f2f2ef; border-radius: 8px; overflow: hidden; width: 100%; }}
th, td {{ text-align: left; padding: 18px 24px; border-bottom: 1px solid rgb(21 21 21 / .12); }}
th {{ font-size: 20px; color: #3a3936; }}
tr.hi td {{ background: #1d7a46; color: #fff; font-weight: 800; }}
table.small {{ font-size: 21px; }} table.small td, table.small th {{ padding: 10px 16px; }}
.big {{ position: absolute; right: 0; bottom: 0; margin: 0; font-size: 34px; font-weight: 800; background: #151515; color: #f2f2ef; padding: 12px 20px; border-radius: 8px; }}
.phone {{ height: 660px; border-radius: 22px; border: 1px solid rgb(21 21 21 / .2); }}
.note {{ font-size: 30px; line-height: 1.35; max-width: 26ch; }}
"""


def page(s):
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="slide"><div class="top"><span class="mark">KEEP UNTIL</span><span class="badge">{html.escape(s['badge'])}</span></div>
<h1>{html.escape(s['headline'])}</h1><div class="body">{s['body']}</div></div></body></html>"""


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1500, "height": 1000})
    caps = []
    for i, s in enumerate(SLIDES, 1):
        assert len(s["caption"]) <= 140, f"caption over 140 for {s['name']}: {len(s['caption'])}"
        assert "—" not in s["caption"] + s["headline"], "no em dashes"
        f = OUT / f"_{s['name']}.html"
        f.write_text(page(s), encoding="utf-8")
        pg.goto(f.as_uri())
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(300)
        out = OUT / f"{i:02d}-{s['name']}.png"
        pg.screenshot(path=str(out))
        f.unlink()
        caps.append(f"## {i:02d}-{s['name']}.png\n\n```\n{s['caption']}\n```\n")
        print(f"ok {out.name} caption {len(s['caption'])} chars")
    b.close()
(OUT / "captions.md").write_text("# Gallery captions, in upload order\n\n" + "\n".join(caps), encoding="utf-8")
