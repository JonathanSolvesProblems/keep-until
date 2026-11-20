"""Checks a judge can run against the live project, with no account and no key:

    python scripts/check_live.py

1. The live site serves the current build.
2. The recall feed the daily function reads is up, and the eight real notices in the recall
   control set are still published in it.
3. The item log really is append-only from outside: an unsigned write is refused.

Writes the run to results/live-check-<date>.json. Standard library only."""
import datetime
import json
import pathlib
import re
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = "https://keep-until-hybrid.web.app/"
FEED = "https://recalls-rappels.canada.ca/sites/default/files/opendata-donneesouvertes/HCRSAMOpenData.json"
FIRESTORE = "https://firestore.googleapis.com/v1/projects/keep-until-hybrid/databases/(default)/documents/foodBanks/demo/items"
UA = {"User-Agent": "keep-until-check/1.0"}

results = []


def check(name, ok, detail):
    results.append({"check": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + ": " + detail)


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.status, r.read()


status, body = get(SITE)
html = body.decode("utf-8", "replace")
check("live site serves the current build", status == 200 and "wordmark-dots" in html and "Try a sample photo" in html,
      f"HTTP {status}, {'current' if 'Try a sample photo' in html else 'older'} build")

# Until 2026-11-20 an alias of import.meta.env made Vite inline every VITE_ variable, and the
# dev-only App Check debug token shipped in the live bundle (revoked the same day). No VITE_ name
# may appear in what the site serves.
bundles = re.findall(r'/assets/[^"]+\.js', html)
leaks = [js for js in bundles if b"VITE_" in get(SITE.rstrip("/") + js)[1]]
check("no build-time secrets in the served bundle", bundles and not leaks,
      f"{len(bundles)} script(s) checked, VITE_ variables found in: {leaks or 'none'}")

status, body = get(FEED)
feed = json.loads(body)
control = json.loads((ROOT / "shared/recall-control.json").read_text(encoding="utf-8"))
nids = {c["recall"]["nid"] for c in control["cases"]}
published = {str(r.get("NID")) for r in feed}
missing = sorted(nids - published)
food = sum(1 for r in feed if r.get("Organization") == "CFIA")
check("recall feed up, control notices still published", status == 200 and not missing,
      f"{len(feed):,} notices, {food:,} from the CFIA; control notices missing: {missing or 'none'}")

req = urllib.request.Request(FIRESTORE, data=json.dumps({"fields": {"decision": {"stringValue": "KEEP"}}}).encode(),
                             headers={**UA, "Content-Type": "application/json"}, method="POST")
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        check("item log refuses an unsigned write", False, f"write accepted, HTTP {r.status}")
except urllib.error.HTTPError as e:
    reason = json.loads(e.read() or b"{}").get("error", {}).get("status", "")
    check("item log refuses an unsigned write", e.code in (401, 403), f"HTTP {e.code} {reason}")

out = ROOT / "results" / f"live-check-{datetime.date.today().isoformat()}.json"
out.write_text(json.dumps({"ran": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), "results": results}, indent=2), encoding="utf-8")
print(f"saved {out.relative_to(ROOT)}")
raise SystemExit(0 if all(r["ok"] for r in results) else 1)
