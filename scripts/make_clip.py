"""Builds the long hands-free clip from shared/handsfree-control.json.

Each photo is fitted into a 1280x960 frame on the same grey as the blank frames that stand in for
the empty table, and held for the seconds the control file gives it. Needs ffmpeg.

    python scripts/make_clip.py            writes the clip and prints its timeline
    python scripts/make_clip.py --timeline prints the timeline only
"""
import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
GREY = "0x89847c"
SIZE = (1280, 960)
FPS = 10


def timeline(control):
    """[(start, end, what, item index or None)] in clip seconds."""
    t = float(control["table_seconds"]["start"])
    rows = [(0.0, t, "table", None)]
    items = control["items"]
    for i, item in enumerate(items):
        for face in item["faces"]:
            rows.append((t, t + face["seconds"], face["file"], i))
            t += face["seconds"]
        gap = control["table_seconds"]["end" if i == len(items) - 1 else "between"]
        rows.append((t, t + gap, "table", None))
        t += gap
    return rows


def main():
    control = json.loads((ROOT / "shared/handsfree-control.json").read_text(encoding="utf-8"))
    rows = timeline(control)
    for start, end, what, i in rows:
        print(f"{start:6.0f} to {end:4.0f} s  {what}" + (f"  ({control['items'][i]['item']})" if i is not None else ""))
    if "--timeline" in sys.argv:
        return
    photos = ROOT / control["photos"]
    out = ROOT / control["clip"]
    w, h = SIZE
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for n, (start, end, what, _) in enumerate(rows):
            part = pathlib.Path(tmp) / f"{n:02d}.webm"
            seconds = end - start
            if what == "table":
                source = ["-f", "lavfi", "-i", f"color=c={GREY}:s={w}x{h}:r={FPS}"]
                fit = "format=yuv420p"
            else:
                source = ["-loop", "1", "-framerate", str(FPS), "-i", str(photos / what)]
                fit = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color={GREY},format=yuv420p"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *source, "-t", str(seconds), "-vf", fit, "-r", str(FPS), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-g", "600", str(part)], check=True)
            parts.append(part)
        listing = pathlib.Path(tmp) / "parts.txt"
        listing.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(out)], check=True)
    print(f"wrote {out.relative_to(ROOT)}, {rows[-1][1]:.0f} s")


if __name__ == "__main__":
    main()
