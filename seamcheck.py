#!/usr/bin/env python3
"""Find pieces of a segmented HyperFrames render whose first frames were captured too early.

A fresh browser can capture a piece's first frames before its seek lands: blank frames, or a
frame from the film's start (30 Oct, film-01 pieces 9 and 10). Such a frame differs from both
the frame before the seam and a frame a little after it, which a real cut on the seam does not.

Usage: seamcheck.py <film.mp4> [--seg 1500] [--fps 60] [--total N]
Prints one line per seam and, last, "BAD <indexes>" or "CLEAN". Exit 0 clean, 3 bad, 2 error.
"""
import argparse, subprocess, sys, tempfile, glob, os
from PIL import Image, ImageChops, ImageStat

ap = argparse.ArgumentParser()
ap.add_argument("film")
ap.add_argument("--seg", type=int, default=1500)
ap.add_argument("--fps", type=int, default=60)
ap.add_argument("--total", type=int, default=0, help="total frames (default: probe)")
ap.add_argument("--look", type=int, default=6, help="frames checked after each seam")
ap.add_argument("--thresh", type=float, default=6.0, help="mean luma difference (0-255) at 240 px")
a = ap.parse_args()

total = a.total
if not total:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
                          "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", a.film],
                         capture_output=True, text=True).stdout.strip()
    total = int(out)

# The seeks below go by time, so a film whose frames are not evenly timed would be checked at the
# wrong frames: refuse it. (30 Oct: pieces with two timebases, joined by stream copy, gave 1612 s.)
pts = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                      "packet=pts_time", "-of", "csv=p=0", a.film], capture_output=True, text=True).stdout.split()
pts = sorted(float(x) for x in pts if x not in ("", "N/A"))
uneven = sum(1 for p, q in zip(pts, pts[1:]) if abs(q - p - 1 / a.fps) > 0.25 / a.fps)
if len(pts) != total or uneven:
    print(f"BADTIME {len(pts)} frames, {uneven} uneven steps, last at {pts[-1] if pts else 0:.3f} s")
    sys.exit(2)

def diff(x, y):
    return ImageStat.Stat(ImageChops.difference(x, y)).mean[0]

bad = []
with tempfile.TemporaryDirectory(dir="/dev/shm") as d:
    for k in range(1, (total - 1) // a.seg + 1):
        s = k * a.seg
        first = s - 1                      # the last frame of the previous piece
        n = a.look + 2                     # first .. s + look
        t0 = (first - 0.5) / a.fps         # half a frame early, so the seek lands on frame "first"
        for f in glob.glob(f"{d}/*.png"):
            os.remove(f)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0:.6f}", "-i", a.film,
                        "-frames:v", str(n), "-vf", "scale=240:-2", "-vsync", "0", f"{d}/f%03d.png"],
                       check=True)
        ims = [Image.open(f).convert("L") for f in sorted(glob.glob(f"{d}/f*.png"))]
        if len(ims) < n:
            print(f"piece {k}: only {len(ims)} frames read at {t0:.3f} s"); bad.append(k); continue
        before, after = ims[0], ims[-1]
        odd = [s + i for i, im in enumerate(ims[1:-1]) if diff(im, before) > a.thresh and diff(im, after) > a.thresh]
        lum = " ".join(f"{ImageStat.Stat(im).mean[0]:.0f}" for im in ims)
        print(f"piece {k} at frame {s} ({s / a.fps:.3f} s): luma {lum}" + (f"  ODD frames {odd}" if odd else ""))
        if odd:
            bad.append(k)
print("BAD " + " ".join(map(str, bad)) if bad else "CLEAN")
sys.exit(3 if bad else 0)
