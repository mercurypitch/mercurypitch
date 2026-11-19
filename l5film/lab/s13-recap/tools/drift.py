# The cards' drift in `card` as drawn: each screenshot's row profile (lab/s13-recap/drift/, x 260 to 720, y 140 to 290: the
# heading, the rule, "Practise it.") matched to the first one's at a sub-pixel shift (linear interpolation), against the
# layer's own offset. A drift the raster steps shows whole-pixel shifts; a composited one follows the offset.
import json
import numpy as np
from PIL import Image
rows = json.load(open('lab/s13-recap/drift/drift.json'))
prof = lambda k: np.asarray(Image.open(f'lab/s13-recap/drift/d-{k + 6:03d}.png').convert('L'), dtype=np.float64).sum(axis=1)
p0 = prof(rows[0]['k'])
ys = np.arange(len(p0), dtype=np.float64)
win = (ys >= 25) & (ys <= 115)
out = []
for r in rows:
    pk = prof(r['k'])
    best = min((float(np.sum((pk[win] - np.interp(ys[win] + s, ys, p0)) ** 2)), s) for s in np.arange(0, 16, 0.02))
    off = float(r['layer'].split(',')[1].replace('px', ''))
    out.append(f"{r['k'] / 60:6.3f} s into card: layer {off:8.3f} px; drawn shift {-best[1]:8.2f} px; error {(-best[1]) - off:+.2f}")
open('lab/s13-recap/drift.txt', 'w').write('\n'.join(out) + '\n')
print('\n'.join(out))
