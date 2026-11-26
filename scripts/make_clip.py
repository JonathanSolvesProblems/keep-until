"""Builds the long hands-free clip from shared/handsfree-control.json.

Each photo is fitted into a 1280x960 frame on the same grey as the blank frames that stand in for
the empty table, and held for the seconds the control file gives it. Needs ffmpeg and Pillow.

    python scripts/make_clip.py            writes the clip and prints its timeline
    python scripts/make_clip.py --timeline prints the timeline only
"""
import json
import pathlib
import subprocess
import sys
import tempfile

from PIL import Image, ImageOps

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
    grey = tuple(int(GREY[i : i + 2], 16) for i in (2, 4, 6))
    with tempfile.TemporaryDirectory() as tmp:
        # Every frame is drawn at the clip's size first, and the whole clip is encoded in one pass.
        # (Joining separately encoded segments made a file Chrome stopped playing at the first join.)
        inputs, labels = [], []
        for n, (start, end, what, _) in enumerate(rows):
            frame = Image.new("RGB", SIZE, grey)
            if what != "table":
                photo = ImageOps.exif_transpose(Image.open(photos / what)).convert("RGB")
                photo.thumbnail(SIZE, Image.LANCZOS)
                frame.paste(photo, ((SIZE[0] - photo.width) // 2, (SIZE[1] - photo.height) // 2))
            png = pathlib.Path(tmp) / f"{n:02d}.png"
            frame.save(png)
            inputs += ["-loop", "1", "-framerate", str(FPS), "-t", str(end - start), "-i", str(png)]
            labels.append(f"[{n}:v]")
        graph = "".join(labels) + f"concat=n={len(rows)}:v=1:a=0,format=yuv420p[v]"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", graph, "-map", "[v]", "-r", str(FPS), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-g", "100", str(out)], check=True)
    print(f"wrote {out.relative_to(ROOT)}, {rows[-1][1]:.0f} s")


if __name__ == "__main__":
    main()
