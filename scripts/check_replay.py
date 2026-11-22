"""Plays the hands-free replay (?replay=1, live site by default) in headless Chromium and checks it ends with both answers and no page errors: it needs no on-device model and no sign-in.
    python scripts/check_replay.py [url]"""
import sys
from playwright.sync_api import sync_playwright
url = sys.argv[1] if len(sys.argv) > 1 else "https://keep-until-hybrid.web.app/?replay=1"
with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1400, "height": 1000})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url)
    pg.wait_for_function("document.querySelector('#prompt').textContent.includes('Replay finished')", timeout=120000)
    print("prompt:", pg.inner_text("#prompt"))
    print("watching:", pg.inner_text("#watching"))
    print("answer:", pg.inner_text("#answer")[:200].replace("\n", " | "))
    print("log rows:", pg.locator("#log > *").count(), "| errors:", errs)
    assert not errs and pg.locator("#log > *").count() == 2, "replay did not end with both answers"
    b.close()
