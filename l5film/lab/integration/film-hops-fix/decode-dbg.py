# decode-dbg.py <fps> <mp4> <first frame> <scene start>: read debug-gate.js's cells and Merc's cx frame by frame
import math, subprocess, sys
import numpy as np
fps, path, n0, S0 = int(sys.argv[1]), sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', path, '-vf', 'format=gray', '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
N = 1920 * 1080
def shown(k, F, MS=0.05, PF=30):
    lim = 1000 * MS + 0.5 + 1000 * k / F + 1e-6
    i = math.floor(lim / 1000 * PF) + 1
    while i > 0 and round(i * 1000 / PF) > lim: i -= 1
    return i
print(f'{"frame":>6} {"t":>8} {"page n":>6} {"page rest 1e-9 fr":>17} {"old":>4} {"kit":>4} {"shown":>5} {"cx":>7} {"box x":>8}')
j = 0
while True:
    b = p.stdout.read(N)
    if len(b) < N: break
    a = np.frombuffer(b, np.uint8).reshape(1080, 1920)
    vals = []
    for r in range(5):
        v = 0
        for c in range(32): v = (v << 1) | (1 if a[r * 12 + 6, c * 12 + 6] > 128 else 0)
        vals.append(v - (1 << 32) if v >= 1 << 31 else v)
    reg = a[520:851, 0:1500] > 70
    col = reg.sum(0); cx = float((col * np.arange(1500)).sum() / col.sum()) if col.sum() else float('nan')
    n = n0 + j; T = n / fps
    k = math.floor((T - S0) * fps + 1e-9)
    print(f'{n:>6} {T - S0:>8.3f} {vals[0]:>6} {vals[1]:>17} {vals[2]:>4} {vals[3]:>4} {shown(k, fps):>5} {cx:>7.1f} {vals[4] / 100:>8.2f}')
    j += 1
