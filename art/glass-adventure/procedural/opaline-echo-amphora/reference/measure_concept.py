"""Measure the concept's body profile: centre-run half width per row, converted to metres.

python3 -I measure_concept.py CONCEPT.png OUT.json
The run of object pixels that contains the centre column is the body (or neck)
without the handles, because there is background between a handle and the neck.
Pixels become metres through the contract height (0.92 m from foot to rim); the
concept is shot nearly level (about 8 degrees from above), so heights near the
top and bottom are slightly foreshortened and the numbers are a guide, fitted
again against the silhouette gate.
"""
import json
import sys

import numpy as np

sys.path.insert(0, '.claude/skills/blender-modeler/scripts')
import silhouette_compare as sil  # noqa: E402

mask = sil.segment(sys.argv[1])
ys, xs = np.nonzero(mask)
top, bottom = ys.min(), ys.max()
centre = int(np.median(xs))
metres_per_px = 0.92 / (bottom - top + 1)
rows = []
for y in range(top, bottom + 1, 6):
    row = mask[y]
    if not row[centre]:
        continue
    left = centre
    while left > 0 and row[left - 1]:
        left -= 1
    right = centre
    while right < len(row) - 1 and row[right + 1]:
        right += 1
    rows.append({'z': round((bottom - y) * metres_per_px, 4), 'r': round((right - left + 1) / 2 * metres_per_px, 4)})
json.dump({'metres_per_px': metres_per_px, 'centre_px': centre, 'rows': rows}, open(sys.argv[2], 'w'), indent=1)
print('CONCEPT', len(rows), 'rows, scale', round(metres_per_px * 1000, 4), 'mm/px')
