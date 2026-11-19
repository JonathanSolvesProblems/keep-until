"""Captures the app's real states for the gallery, from the running app reading real pantry
photos (web/public/testset/pantry-2026-11-15). Run with the dev server up:
    npm --prefix web run dev
    python scripts/gallery/capture.py
Writes devpost/gallery/src/*.png. Nothing here is staged: every answer on screen is the app's."""
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "devpost" / "gallery" / "src"
URL = "http://localhost:5173/"
PHOTOS = ROOT / "web" / "public" / "testset" / "pantry-2026-11-15"
# The sort screen itself: header, the item and the answer; the shift list and footer stay out.
TOP = {"x": 0, "y": 0, "width": 1280, "height": 720}


def start(pg, today="2026-11-19"):
    pg.goto(URL)
    pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelector('details.tools').open = true")
    pg.select_option("#mode", "only_in_cloud")
    pg.fill("#today", today)
    pg.evaluate("document.querySelector('details.tools').open = false")


def sample(pg):
    pg.evaluate("document.title = 'waiting'")
    pg.click("#sample")
    pg.wait_for_function("document.title.startsWith('Keep Until: ')", timeout=180000)
    pg.evaluate("window.scrollTo(0, 0)")
    pg.wait_for_timeout(700)


def batch(pg, photo):
    pg.evaluate("document.querySelector('details.tools').open = true; document.getElementById('toolStatus').textContent = 'waiting'")
    pg.set_input_files("#files", [str(PHOTOS / photo)])
    pg.click("#batch")
    pg.wait_for_function("document.getElementById('toolStatus').textContent.startsWith('Done')", timeout=300000)
    pg.evaluate("document.querySelector('details.tools').open = false; window.scrollTo(0, 0)")
    pg.wait_for_timeout(700)


with sync_playwright() as p:
    OUT.mkdir(parents=True, exist_ok=True)
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1280, "height": 800}, color_scheme="light", device_scale_factor=2)
    pg = ctx.new_page()

    # One carton, two photos: the front (name, no date), then the top (date, no name).
    start(pg)
    sample(pg)
    pg.screenshot(path=str(OUT / "turn-for-date.png"), clip=TOP)
    sample(pg)
    pg.screenshot(path=str(OUT / "keep.png"), clip=TOP)
    sample(pg)
    pg.screenshot(path=str(OUT / "aside.png"), clip=TOP)

    # The same carton on a sort day past the chart's limit: a discard, confirmed by a second read.
    pg = ctx.new_page()
    start(pg, today="2030-01-01")
    sample(pg)
    sample(pg)
    pg.screenshot(path=str(OUT / "discard.png"), clip=TOP)

    # The waiting screen, before a shift.
    pg = ctx.new_page()
    pg.goto(URL)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=str(OUT / "waiting.png"), clip=TOP)

    # Phone width, dark, after a read.
    ph = b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark", device_scale_factor=3).new_page()
    start(ph)
    sample(ph)
    sample(ph)
    ph.evaluate("document.getElementById('answer').scrollIntoView({block: 'start'})")
    ph.wait_for_timeout(500)
    ph.screenshot(path=str(OUT / "phone-keep.png"))
    b.close()
print("captured", sorted(x.name for x in OUT.glob("*.png")))
