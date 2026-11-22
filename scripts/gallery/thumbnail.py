"""The Devpost thumbnail: a 3:2 card that reads at 250 px wide. The name, the answer the app
gives, and one line. Separate from the gallery, which carries too much to read at card size.
    python scripts/gallery/thumbnail.py   # devpost/gallery/thumbnail.png"""
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
FONTS = (ROOT / "web" / "public" / "fonts").as_uri()
ART = (ROOT / "web" / "public" / "brand" / "art").as_uri()

PAGE = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: A; src: url({FONTS}/atkinson-normal-latin.woff2); font-weight: 200 800; }}
@font-face {{ font-family: D; src: url({FONTS}/doto-normal-latin.woff2); font-weight: 100 900; }}
body {{ margin: 0; width: 1500px; height: 1000px; background: #d0cec8; font-family: A; color: #151515; overflow: hidden; position: relative; }}
.mark {{ position: absolute; left: 80px; top: 70px; font-family: D; font-weight: 900; font-size: 120px; letter-spacing: .04em; line-height: 1; }}
.band {{ position: absolute; left: 80px; top: 260px; width: 900px; background: #1d7a46; color: #fff; border-radius: 14px; padding: 46px 56px; }}
.word {{ font-size: 170px; font-weight: 800; line-height: .9; letter-spacing: -.03em; }}
.until {{ font-size: 64px; font-weight: 700; margin-top: 18px; white-space: nowrap; }}
.bb {{ font-size: 34px; margin-top: 14px; opacity: .92; }} .bb span {{ font-family: D; font-weight: 900; }}
.until span {{ font-family: D; font-weight: 900; font-size: 84px; margin-left: 28px; }}
.line {{ position: absolute; left: 80px; bottom: 80px; font-size: 52px; font-weight: 700; max-width: 22ch; line-height: 1.12; }}
.art {{ position: absolute; right: -10px; bottom: -6px; width: 560px; }}
</style></head><body>
<div class="mark">KEEP UNTIL</div>
<div class="band"><div class="word">Keep</div><div class="until">until<span>14 FEB 2029</span></div><div class="bb">Best before <span>2027 FE 14</span> &middot; Food Banks Canada chart</div></div>
<div class="line">Hold up donated food. It says how long it stays good.</div>
<img class="art" src="{ART}/hands-can.webp">
</body></html>"""

out = ROOT / "devpost" / "gallery" / "thumbnail.png"
tmp = out.with_suffix(".html")
tmp.write_text(PAGE, encoding="utf-8")
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1500, "height": 1000})
    pg.goto(tmp.as_uri())
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(out))
    b.close()
tmp.unlink()
print("saved", out.relative_to(ROOT))
