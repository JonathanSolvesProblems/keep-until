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


def w(d):
    return {"no_match": "clear", "check_lot": "check lot"}.get(d, d)


def recall():
    t = read("results/recall-control-2026-11-22.md")
    m = re.search(r"Model: (\d+ of \d+)\. Brand plus a product word: (\d+ of \d+)\. Brand alone: (\d+ of \d+)", t)
    second = t[t.index("## Second set"):t.index("## Both sets")]
    rows = re.findall(r"^\| (d\d) \| ([^|]+) \| ([^|]+) \| (\w+) \| (\w+) (.) \| (\w+) (.) \| (\w+) (.) \|", second, re.M)
    return {"model": m[1], "keyword": m[2], "rule": m[3], "rows": rows}


def quote():
    t = read("devpost/sources.md")
    return re.search(r'"(Many people incorrectly[^"]+)"', t)[1]


def img(name):
    return (SRC / name).as_uri()


def gate():
    import json
    v = json.loads(read("shared/gate-vectors.json"))
    return {"stamps": f"{len(v['dates']):,}", "decisions": f"{len(v['gates']):,}"}


def handsfree():
    t = read("results/handsfree-clip-2026-11-20.md")
    m = re.search(r"\*\*(\d+) looks on the laptop \(median ([\d.]+) s each\), (\d+) calls to the cloud", t)
    line = re.search(r"```\n(0s clear.*?)\n```", t, re.S)[1].replace("\n", " ")
    looks = [(float(a), b) for a, b in re.findall(r"([\d.]+)s (\w+)", line)]
    return {"looks": m[1], "median": m[2], "calls": m[3], "timeline": looks}


def claims_output():
    import subprocess, sys
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "check_claims.py")], capture_output=True, text=True)
    return r.stdout.strip().splitlines()


A = ablation()
R = recall()
GATE = gate()
H = handsfree()
CLAIMS_OUT = claims_output()

# The clip's scenes, as committed in results/handsfree-clip-2026-11-20.md.
SCENES = [(0, 6, "empty table", None), (6, 20, "carton front", "clip-13.png"), (20, 36, "carton top", "clip-28.png"),
          (36, 46, "empty table", None), (46, 62, "yogurt lid", "clip-54.png"), (62, 70, "empty table", None)]
LOOK_COLOUR = {"clear": "#8a8780", "turn": "#151515", "next": "#5a5955", "read": "#2553c6"}


def timeline_html():
    px = 1360 / 70
    scenes = "".join(
        f'<div class="scene" style="left:{a * px}px;width:{(b - a) * px}px">'
        + (f'<img src="{img(f)}">' if f else "")
        + f"<span>{html.escape(n)}</span></div>"
        for a, b, n, f in SCENES
    )
    marks = "".join(
        f'<div class="look" style="left:{t * px - 9}px;background:{LOOK_COLOUR[k]}" title="{k}"></div>' for t, k in H["timeline"]
    )
    key = " ".join(f'<span class="key"><i style="background:{c}"></i>{k}</span>' for k, c in LOOK_COLOUR.items())
    return f'<div class="tl"><div class="scenes">{scenes}</div><div class="marks">{marks}</div><div class="axis"><span>0 s</span><span>70 s</span></div><p class="keys">{key} <span class="keynote">Each dot is one Gemini Nano look on the laptop. Blue dots went to the cloud.</span></p></div>'

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
        "caption": "A guest post on Food Banks Canada's blog: people throw out good food once it reaches its best-before date. Sort tables decide item by item.",
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
        "headline": "One misread would have binned good chocolate chips",
        "badge": "results/pantry-2026-11-15-cloud-repeatability.md, a real bag from my pantry",
        "body": f'''<div class="stack"><img class="cap" src="{img("chipits-stamp.png")}" style="width:620px">
<p class="small-note">The stamp, turned the right way up here. The model saw it upside down, with the day cut off.</p></div>
<table class="small"><tr><th></th><th>Read</th><th>App said</th></tr>
<tr><td>Run 1</td><td><code>26MA14</code>, 14 May 2026, already past</td><td><b>Discard</b> (wrong)</td></tr>
<tr><td>Run 2</td><td><code>2027 MA 17</code></td><td>Keep</td></tr>
<tr><td>On the bag</td><td><code>BB/MA 2027 MA</code></td><td>Best before May 2027</td></tr>
<tr class="hi"><td>Now</td><td colspan="2">A discard needs a second, independent read of the same date. If they disagree, the sort lead checks it.</td></tr>
</table>''',
        "caption": "One cloud read took a 2027 stamp for May 2026 and said discard. Now nothing is binned unless a second, independent read agrees.",
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
        "headline": "Same brand, same kind of food, not the same product",
        "badge": "Government of Canada recall notices; expected answers committed before each run",
        "body": "<div class=\"stack\" style=\"width:100%\"><table class=\"tiny\"><tr><th>Recalled</th><th>Item on the shelf</th><th>Brand alone</th><th>+ product word</th><th>Gemini</th></tr>"
        + "".join(
            f"<tr><td>{html.escape(n.split(' recalled')[0].replace(' brand', '').strip())}</td><td>{html.escape(i.strip())}</td><td>{w(rb)} {okb}</td><td>{w(rk)} {okk}</td><td><b>{w(dm)} {okm}</b></td></tr>"
            for _, n, i, exp, rb, okb, rk, okk, dm, okm in R["rows"]
        )
        + f"</table><p class=\"bigline\">Both sets, 16 cases: Gemini {R['model']}. Brand plus a product word {R['keyword']}. Brand alone {R['rule']}.</p></div>",
        "caption": f"Recalls are checked against stock every morning. Gemini {R['model']}; brand plus a product word {R['keyword']}; brand alone {R['rule']}.",
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
        "body": f'<img class="phone" src="{img("android-s24-turn.png")}"><img class="phone" src="{img("android-s24-keep.png")}">'
        f'<div class="note">Same loop, same chart. The two gates agree on {GATE["stamps"]} date stamps and {GATE["decisions"]} chart decisions. On this Galaxy S24, with no on-device model, it reads in the cloud and says so: the front of the carton, then the top.</div>',
        "caption": f"The Android app runs the same loop and chart, matching the web on {GATE['decisions']} decisions. On a phone without Nano it says it reads in the cloud.",
    },
    {
        "name": "hands-free",
        "headline": f"Hands-free: {H['looks']} looks on the laptop, {H['calls']} calls to the cloud",
        "badge": "results/handsfree-clip-2026-11-20.md, real Gemini Nano in Chrome",
        "body": timeline_html(),
        "caption": f"Nobody touched the laptop. Gemini Nano watched a 70-second clip: {H['looks']} looks on the laptop, {H['calls']} calls to the cloud, 3 items right.",
    },
    {
        "name": "offline",
        "headline": "No connection? The phone says so in plain words",
        "badge": "Android 8 emulator, airplane mode; results/android-emulator-2026-11-20.md",
        "body": f'<img class="phone" src="{img("emu-a8-airplane.png")}"><img class="phone" src="{img("emu-a8-airplane-fixed.png")}">'
        '<div class="note">Before: "Hold the item steady." After: the app asks the phone whether it is online, and says the date read waits for Wi-Fi.</div>',
        "caption": "Found on an Android 8 emulator: offline, the app told volunteers to hold still. Now it asks the phone and says the read waits for Wi-Fi.",
    },
    {
        "name": "honesty",
        "headline": "A script fails the build when a number drifts",
        "badge": "scripts/check_claims.py, run in GitHub Actions on every push",
        "body": '<pre class="term">$ python scripts/check_claims.py\n' + html.escape("\n".join(CLAIMS_OUT)) + "</pre>"
        '<div class="note">Every number on the project page, the README and these captions is read from its results file at run time. A retired claim coming back fails it too.</div>',
        "caption": "Every number on the page is checked against the results file it came from, on every push. A stale or retired claim fails the build.",
    },
    {
        "name": "built",
        "headline": "Which job runs where, and why",
        "badge": "Firebase AI Logic on Web and Android; one Firebase project",
        "body": """<div class="flow">
<div class="lane"><h3>On the laptop</h3><p><b>Gemini Nano</b>, ONLY_ON_DEVICE</p><p>Watches the camera: item in view? date facing? fridge?</p><p class="why">A look every few seconds. No cloud cost, and the sort table never leaves the building.</p></div>
<div class="arrow">date faces the camera</div>
<div class="lane"><h3>In the cloud</h3><p><b>Gemini Flash-Lite</b>, JSON schema</p><p>Reads the stamp exactly as printed: <code>2027 FE 14</code></p><p class="why">Only for photos worth reading. A discard needs a second, independent read.</p></div>
<div class="arrow">date and food type</div>
<div class="lane"><h3>In code</h3><p><b>Food Banks Canada's chart</b></p><p>Keep until, set aside, or discard</p><p class="why">The model reads; the chart decides. Same gate on Web and Android.</p></div>
</div>
<p class="strip"><b>Lands in:</b> the food bank's Google Sheet and Firestore &nbsp; <b>Every morning:</b> Cloud Functions + Scheduler check recalls; Gemini (PREFER_IN_CLOUD) settles them at shift start &nbsp; <b>Also:</b> App Check, Auth, Remote Config, Performance Monitoring, Crashlytics, Hosting</p>""",
        "caption": "Nano watches on the laptop, the cloud reads dates, Food Banks Canada's chart decides in code, and a daily function checks recalls.",
    },
    {
        "name": "limits",
        "headline": "What it does not do yet",
        "badge": "Stated on the project page and, where it applies, on the screen",
        "body": """<ul class="limits">
<li><b>No Android phone has run Gemini Nano for it yet.</b> Test Lab phones and emulators have no working on-device model, and my Galaxy S24 is not on Google's list. On those phones it reads in the cloud and says so.</li>
<li><b>Lot codes are not read.</b> A recall limited to certain lots always goes to the sort lead as "check the lot code".</li>
<li><b>Date reading is measured on too few dated photos.</b> The 16-photo set mostly tests routing; a larger dated set is next.</li>
<li><b>Hands-free needs Nano on the laptop.</b> Elsewhere the volunteer presses Read item, and the app says why.</li>
<li><b>A store-brand short form not on the matcher's list is missed</b> before the model sees it.</li>
</ul>""",
        "caption": "No Android Nano run yet, no lot codes, a small dated test set, and hands-free only with Nano. Each limit is stated where it applies.",
    },
    {
        "name": "sources",
        "headline": "Where every rule and number comes from",
        "badge": "devpost/sources.md",
        "body": """<table class="small">
<tr><th>Used for</th><th>Source</th></tr>
<tr><td>How long each food keeps past best before</td><td>Food Banks Canada, Guidelines for Food Shelf Life, July 2018</td></tr>
<tr><td>How Canadian date stamps are printed</td><td>CFIA, Date markings and storage instructions</td></tr>
<tr><td>Food recalls checked every morning</td><td>Government of Canada, Recalls and Safety Alerts open data</td></tr>
<tr><td>Why good food gets binned</td><td>Brita Ball, PhD, guest post on Food Banks Canada's blog, 2019</td></tr>
<tr><td>A food bank's own longer limit (Remote Config)</td><td>Calgary Food Bank, Best Before Date</td></tr>
<tr><td>Every score on this page</td><td>results/, graded by script against hand labels made before the runs</td></tr>
</table>""",
        "caption": "The chart, the stamp format, the recalls and the quote are all published sources. Every score comes from a results file in the repo.",
    },
]

# Upload order: the hero, then the on-device moment, then the story.
ORDER = ["keep", "hands-free", "problem", "two-photos", "hybrid", "built", "refusal", "aside", "recall", "offline", "android", "phone", "honesty", "limits", "sources"]
SLIDES = sorted(SLIDES, key=lambda s: ORDER.index(s["name"]))
for old in OUT.glob("[0-9][0-9]-*.png"):
    old.unlink()

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
.stack {{ display: flex; flex-direction: column; gap: 10px; flex: none; }}
.small-note {{ margin: 0; font-size: 20px; color: #3a3936; max-width: 32ch; }}
code {{ font-family: D; font-weight: 800; letter-spacing: .03em; }}
.tl {{ width: 1372px; }}
.scenes {{ position: relative; height: 420px; }}
.scene {{ position: absolute; top: 0; height: 420px; border-left: 2px solid #f2f2ef; background: #8a8780; overflow: hidden; display: flex; align-items: flex-end; }}
.scene img {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
.scene span {{ position: relative; margin: 10px; background: #151515; color: #f2f2ef; font-size: 18px; font-weight: 700; padding: 4px 8px; border-radius: 4px; }}
.marks {{ position: relative; height: 40px; margin-top: 14px; border-bottom: 2px solid #151515; }}
.look {{ position: absolute; top: 4px; width: 18px; height: 18px; border-radius: 50%; }}
.axis {{ display: flex; justify-content: space-between; font-size: 18px; color: #3a3936; margin-top: 4px; }}
.keys {{ font-size: 22px; margin: 14px 0 0; }} .key {{ margin-right: 22px; }} .key i {{ display: inline-block; width: 14px; height: 14px; border-radius: 50%; margin-right: 6px; }}
.keynote {{ color: #3a3936; }}
.tiny {{ font-size: 19px; }} table.tiny td, table.tiny th {{ padding: 8px 14px; }}
.bigline {{ margin: 0; align-self: flex-end; font-size: 28px; font-weight: 800; background: #151515; color: #f2f2ef; padding: 10px 18px; border-radius: 8px; }}
.flow {{ display: grid; grid-template-columns: 1fr 150px 1fr 150px 1fr; gap: 0; align-items: stretch; width: 100%; }}
.lane {{ background: #f2f2ef; border-radius: 8px; padding: 22px 24px; font-size: 22px; line-height: 1.35; }}
.lane h3 {{ margin: 0 0 10px; font-size: 18px; letter-spacing: .06em; text-transform: uppercase; color: #3a3936; }}
.lane p {{ margin: 0 0 10px; }} .lane .why {{ color: #3a3936; font-size: 19px; }}
.arrow {{ align-self: center; text-align: center; font-size: 18px; font-weight: 700; color: #2553c6; padding: 0 8px; }}
.arrow::after {{ content: "→"; display: block; font-size: 44px; line-height: 1; }}
.strip {{ position: absolute; left: 0; right: 0; bottom: 0; margin: 0; font-size: 21px; line-height: 1.45; background: #151515; color: #f2f2ef; padding: 16px 22px; border-radius: 8px; }}
.limits {{ margin: 0; padding: 0 0 0 28px; font-size: 27px; line-height: 1.4; max-width: 1250px; }} .limits li {{ margin-bottom: 16px; }}
.term {{ margin: 0; background: #151515; color: #f2f2ef; font-family: D; font-size: 26px; line-height: 1.5; padding: 28px 32px; border-radius: 8px; white-space: pre-wrap; max-width: 820px; }}
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
