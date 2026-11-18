#!/usr/bin/env python3
"""Compare two audit folders shot by shot: compare.py <dir a> <dir b> [threshold]

For each screenshot name in both, the mean absolute difference of the two
pictures, shrunk and in grey (0 to 255). Prints the shots over the threshold
(default 4.0) and those in only one folder, and for each report.json the
lines that differ. A moving figure or a mascot mid-blink scores about 1 to 3;
a different layout, a missing figure or other text scores well over 4.
"""
import json
import os
import sys

from PIL import Image, ImageChops, ImageStat

a, b = sys.argv[1], sys.argv[2]
limit = float(sys.argv[3]) if len(sys.argv) > 3 else 4.0


def shots(d):
    return {f for f in os.listdir(d) if f.endswith(".png") and not f.startswith("sheet-")}


sa, sb = shots(a), shots(b)
for only, where in ((sa - sb, a), (sb - sa, b)):
    for f in sorted(only):
        print(f"  only in {os.path.basename(where)}: {f}")
worst = []
for f in sorted(sa & sb):
    ia = Image.open(os.path.join(a, f)).convert("L")
    ib = Image.open(os.path.join(b, f)).convert("L")
    if ia.size != ib.size:
        print(f"  size differs: {f} {ia.size} vs {ib.size}")
        continue
    w = 240
    h = round(ia.height * w / ia.width)
    d = ImageStat.Stat(ImageChops.difference(ia.resize((w, h)), ib.resize((w, h)))).mean[0]
    worst.append((d, f))
worst.sort(reverse=True)
over = [(d, f) for d, f in worst if d > limit]
print(f"{os.path.basename(a)} vs {os.path.basename(b)}: {len(sa & sb)} shots compared, {len(over)} over {limit}; largest {worst[0][0]:.1f} ({worst[0][1]})" if worst else "nothing to compare")
for d, f in over:
    print(f"  {d:5.1f}  {f}")
try:
    ra = json.load(open(os.path.join(a, "report.json")))
    rb = json.load(open(os.path.join(b, "report.json")))
    na = [n for n in ra["notes"] if not n.startswith("sections:")]
    nb = [n for n in rb["notes"] if not n.startswith("sections:")]
    for x, y in zip(na, nb):
        if x != y:
            print(f"  note differs:\n    a: {x[:200]}\n    b: {y[:200]}")
    if len(na) != len(nb):
        print(f"  notes: {len(na)} vs {len(nb)}")
except FileNotFoundError:
    pass
