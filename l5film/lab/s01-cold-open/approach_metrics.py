"""approach-sim.mjs's shots measured as measure.py measures a clip: per pair of frames the mean luma change at
320 px wide and the share of pixels at 960 px wide that change by more than 24, and measure.py's pop and jump
rule on the shares (lab/s01-cold-open/approach-sim/, or the folder given). Luma is Rec. 601 on the 0-255 scale,
as PIL gives it; ffmpeg's gray from the clip's limited-range video reads about 0.86 of it.
    python3 lab/s01-cold-open/approach_metrics.py [folder]
"""
import json, os, sys
import numpy as np
from PIL import Image
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'approach-sim')
m = json.load(open(os.path.join(D, 'frames.json')))
A, fr = m['A'], m['frames']
small, big, luma = [], [], []
for f in fr:
    im = Image.open(os.path.join(D, f['name'])).convert('L')
    small.append(np.asarray(im.resize((320, 180), Image.BILINEAR), dtype=np.float32))
    big.append(np.asarray(im.resize((960, 540), Image.BILINEAR), dtype=np.float32))
    luma.append(float(np.asarray(im, dtype=np.float32).mean()))
mean = [float(np.abs(small[i + 1] - small[i]).mean()) for i in range(len(fr) - 1)]
share = [float((np.abs(big[i + 1] - big[i]) > 24).mean()) for i in range(len(fr) - 1)]
ev = []
n = len(share)
at = lambda i: share[i] if 0 <= i < n else 0.0
skip = -1
for i in range(n):
    if i == skip: continue
    a, b, bef, aft = share[i], at(i + 1), at(i - 1), at(i + 2)
    if a >= 0.0003 and b >= 0.0003 and 0.5 <= a / b <= 2 and 3 * max(bef, aft) <= min(a, b):
        ev.append(('pop', fr[i + 1]['t'])); skip = i + 1
    elif a >= 0.0003 and 3 * max(bef, b) <= a:
        ev.append(('jump', fr[i + 1]['t']))
print(f"hook {A['HOOK']:.3f}  approach {A['PUSH']:.3f} to {A['PUSH'] + A['PUSH_D']:.3f}  cut {A['D']:.3f}")
for i, f in enumerate(fr):
    mc = mean[i - 1] if i else 0.0
    sh = share[i - 1] if i else 0.0
    rb = f['rb']
    print(f"  {f['t']:.3f}  hook{f['t'] - A['HOOK']:+.3f}  r {'-' if rb is None else f'{rb:7.1f}'}  luma {luma[i]:6.1f}  change {mc:5.2f} (x0.86 {0.86 * mc:5.2f})  share {100 * sh:5.1f} %")
print('peak change', round(max(mean), 2), '(x0.86', round(0.86 * max(mean), 2), ')  events', ev or 'none')
json.dump({'t': [f['t'] for f in fr], 'rb': [f['rb'] for f in fr], 'luma': luma, 'mean_change': mean, 'share': share, 'events': ev},
          open(os.path.join(D, 'metrics.json'), 'w'), indent=1)
