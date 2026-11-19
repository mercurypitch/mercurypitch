"""DECISIONS 178's proof, part 2: Merc's amber inside the bead's disc, every frame of a clip from hook + 0.5 to the
cut (disc-geometry.json gives the disc's centre and radius a frame). The disc, the field and the bokeh are a cool
grey (the chrome #c3ccd6: R 19 under B), and the hosts have left by hook + 0.45, so any warm pixel is Merc's amber
(#f59e0b) or its glow: "line" counts pixels with R over B by 30 or more and G over B by 15 or more (the line seen
through the disc at 62 % reads about (197, 177, 144)); "tint" counts any pixel with R over B by 8 or more (its glow,
about (145, 146, 134)). Counted inside 0.95 of the disc's radius, and the line also in the whole frame.
    python3 -I amber_in_disc.py <clip.mp4> <label>      (from lab/s01-cold-open/leftovers)
Writes amber-<label>.json.
"""
import json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
clip, label = sys.argv[1], sys.argv[2]
g = json.load(open(os.path.join(HERE, 'disc-geometry.json')))
rows = g['rows']
n0, n1 = rows[0]['k'], rows[-1]['k']
tmp = tempfile.mkdtemp(dir=HERE)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', clip, '-vf', f'select=between(n\\,{n0}\\,{n1})', '-vsync', '0',
                '-start_number', str(n0), os.path.join(tmp, 'f%04d.png')], check=True)
yy, xx = np.mgrid[0:1080, 0:1920]
out = []
for r in rows:
    p = os.path.join(tmp, f"f{r['k']:04d}.png")
    if not os.path.exists(p):
        continue
    a = np.asarray(Image.open(p).convert('RGB')).astype(int)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    amber = (R - B >= 30) & (G - B >= 15)
    tint = R - B >= 8
    inside = (xx - r['x']) ** 2 + (yy - r['y']) ** 2 <= (0.95 * r['r']) ** 2 if r['r'] else np.zeros_like(amber)
    out.append({'t': round(r['t'], 3), 'from_hook': round(r['t'] - g['HOOK'], 3), 'r': None if r['r'] is None else round(r['r'], 1),
                'blur': round(r['blur'], 1), 'line_alpha': r['line'], 'amber_in_disc': int((amber & inside).sum()), 'tint_in_disc': int((tint & inside).sum()), 'amber_in_frame': int(amber.sum())})
for f in os.listdir(tmp):
    os.remove(os.path.join(tmp, f))
os.rmdir(tmp)
json.dump(out, open(os.path.join(HERE, f'amber-{label}.json'), 'w'), indent=1)
for o in out:
    print(f"  {o['t']:.3f} hook{o['from_hook']:+.3f}  r {o['r']}  blur {o['blur']:4.1f}  line {o['line_alpha']:.3f}  line in disc {o['amber_in_disc']:6d}  tint in disc {o['tint_in_disc']:6d}  line in frame {o['amber_in_frame']:6d}")
