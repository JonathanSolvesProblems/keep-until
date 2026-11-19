"""Turns a Firebase Test Lab run of OnDevicePantryTest into results files.

Usage: python scripts/android_testlab_results.py <logcat file> <out stem>
   e.g. ... tmp/testlab/logcat results/android-testlab-2026-11-19

The test writes one JSON object per logcat line under the tag KeepUntilResult. This keeps those
lines as <stem>.json and writes <stem>.md: the device, whether Gemini Nano ran, and per photo what
the phone's check said and what the whole loop decided, scored against the hand labels the web
measurements use (results/labels/pantry-2026-11-15.json). Standard library only.
"""
import json
import re
import sys


def main(logcat_path, stem):
    lines = []
    for raw in open(logcat_path, encoding="utf-8", errors="replace"):
        m = re.search(r"KeepUntilResult\s*:\s*(\{.*\})\s*$", raw)
        if m:
            lines.append(json.loads(m.group(1)))
    device = next((x for x in lines if x["kind"] == "device"), None)
    photos = [x for x in lines if x["kind"] == "photo"]
    errors = [x for x in lines if x["kind"] == "error"]
    done = any(x["kind"] == "done" for x in lines)
    json.dump({"source": logcat_path, "device": device, "photos": photos, "errors": errors, "finished": done}, open(stem + ".json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    def loop_outcome(p):
        if p.get("step") == "verdict":
            return {"KEEP": "log", "DISCARD": "log", "SET_ASIDE": "set_aside"}[p["decision"]]
        return {"turn_it": "turn_it", "turn_for_name": "turn_it", "no_item": "no_item"}.get(p.get("step"), "error")

    def triage_outcome(t):
        if not t.get("ok"):
            return "error"
        if not t["packageInView"]:
            return "no_item"
        if t["needsRefrigeration"]:
            return "set_aside"
        return "log" if t["dateInView"] else "turn_it"

    scored = [p for p in photos if p["expected"] not in ("", "unverified")]
    on_device_ok = [p for p in photos if p["triage"].get("ok")]
    # The phone's check is right when it sends a photo the right way: a date to the cloud
    # ("log" or "set_aside" both go on), no date back to the volunteer.
    def triage_right(p):
        t = triage_outcome(p["triage"])
        if t == "error":
            return False
        if p["expected"] == "turn_it":
            return t == "turn_it"
        return t in ("log", "set_aside")

    def loop_right(p):
        o = loop_outcome(p)
        if o != p["expected"]:
            return False
        if o == "log" and p.get("labelDate"):
            return p.get("parsedDate", "").startswith(p["labelDate"])
        return True

    out = [f"# Android on a real phone: {device['manufacturer']} {device['model']}" if device else "# Android on a real phone: no device line in the log", ""]
    out.append(f"Run: Firebase Test Lab, `OnDevicePantryTest`, results kept in `{stem.split('/')[-1]}.json`.")
    if device:
        out.append(
            f"Device {device['model']} ({device['device']}), Android API {device['sdk']}. "
            f"On-device model: {'ready' if device['onDeviceReady'] else 'not ready'} ({device['onDeviceStatus']}"
            f"{', ' + device['onDeviceModel'] if device.get('onDeviceModel') else ''}), prepared in {device['prepareMs'] / 1000:.0f} s. "
            f"Cloud model {device['cloudModel']}."
        )
    out += ["", "| photo | expected | phone's check (on-device) | ms | loop decided | where it ran | right |", "|---|---|---|---|---|---|---|"]
    for p in photos:
        t = p["triage"]
        check = (
            f"package {'yes' if t['packageInView'] else 'no'}, date {'yes' if t['dateInView'] else 'no'}, fridge {'yes' if t['needsRefrigeration'] else 'no'}"
            if t.get("ok") else f"did not run: {t.get('error', '')[:80]}"
        )
        decided = p.get("decision") or p.get("step", "error")
        if p.get("parsedDate"):
            decided += f" {p['parsedDate']}"
        right = "" if p["expected"] in ("", "unverified") else ("yes" if loop_right(p) else "NO")
        out.append(f"| {p['file']} | {p['expected']} | {check} | {t.get('ms', '')} | {decided} | {p.get('sources', '')} | {right} |")
    out += [""]
    out.append(f"On-device check ran on {len(on_device_ok)} of {len(photos)} photos.")
    if on_device_ok:
        ms = sorted(p["triage"]["ms"] for p in on_device_ok)
        out.append(f"On-device check sent {sum(triage_right(p) for p in scored)} of {len(scored)} scored photos the right way (median {ms[len(ms) // 2]} ms).")
    out.append(f"Whole loop handled {sum(loop_right(p) for p in scored)} of {len(scored)} scored photos as a careful volunteer would.")
    cloud_calls = sum(p.get("sources", "").split(",").count("in_cloud") for p in photos)
    out.append(f"Cloud reads: {cloud_calls} for {len(photos)} photos.")
    if errors:
        out.append(f"Errors: {len(errors)}; first: {errors[0]['error']}")
    if not done:
        out.append("The run did not reach its last line: the log ends before every photo was read.")
    open(stem + ".md", "w", encoding="utf-8").write("\n".join(out) + "\n")
    print("\n".join(out[-6:]))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
