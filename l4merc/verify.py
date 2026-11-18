#!/usr/bin/env python3
"""Check every rendered Lesson 4 Merc pass (PRODUCTION-PIPELINE § 4 trap 2): the alpha_mode tag, the
frame count against its shot file, and transparent corners on the middle frame.
  python3 -I verify.py"""
import glob, json, os, subprocess
import numpy as np
P = '/home/user/mercurypitch/output/motion/lesson-04'
for shot in sorted(glob.glob(P + '/merc/shots/*.json')):
    d = json.load(open(shot))
    w = f"{P}/assets/merc/{d['id']}-merc.webm"
    if not os.path.exists(w):
        print(f"{d['id']:14s} not rendered"); continue
    q = lambda *a: subprocess.run(['ffprobe', '-v', 'error', *a, w], capture_output=True, text=True).stdout.strip()
    alpha = q('-show_entries', 'stream_tags=alpha_mode', '-of', 'csv=p=0')
    wd, ht, n = (int(v) for v in q('-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_read_frames', '-of', 'csv=p=0').split(','))
    want = round(d['duration'] * d.get('fps', 60))
    mid = n // 2
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-c:v', 'libvpx-vp9', '-i', w, '-vf', f'select=eq(n\\,{mid}),format=rgba', '-frames:v', '1', '-f', 'rawvideo', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(ht, wd, 4)[..., 3]
    corners = [int(a[0, 0]), int(a[0, -1]), int(a[-1, 0]), int(a[-1, -1])]
    ok = alpha == '1' and n == want and max(corners) == 0
    print(f"{d['id']:14s} {'OK ' if ok else 'BAD'} alpha_mode {alpha} frames {n}/{want} {wd}x{ht} corners {corners} newer-than-shot {os.path.getmtime(w) > os.path.getmtime(shot)}")
