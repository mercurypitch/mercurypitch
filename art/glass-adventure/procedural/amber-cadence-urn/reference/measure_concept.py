"""Segment the urn concept and measure its profile: reference/concept-mask.png and concept-measurements.json.

python3 -I art/glass-adventure/procedural/amber-cadence-urn/reference/measure_concept.py

The generic segmentation thresholds by Otsu, which the amber sets so high that
the cream marble neck and foot drop out; a fixed low threshold keeps them but
also takes the soft floor shadow. The shadow is neutral grey and the marble
warm, so object is: far from the fitted backdrop (the amber and gold), or a
little off it and warmer than it (the marble). What shadow is left spills out
on one side only, so each row keeps its narrower half about the axis. The
silhouette gate reads this mask (`asset.json` reference_mask).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../../..'))
sys.path.insert(0, os.path.join(REPO, '.claude/skills/blender-modeler/scripts'))
import silhouette_compare as sil  # noqa: E402

concept = os.path.join(REPO, 'art/glass-adventure/v6-level2/concepts/amber-cadence-urn.png')
rgb = np.asarray(Image.open(concept).convert('RGB'), dtype=np.float64) / 255.0
h, w, _ = rgb.shape
yy, xx = np.mgrid[0:h, 0:w]
border = np.zeros((h, w), bool)
m = max(4, int(0.03 * min(h, w)))
border[:m, :] = border[-m:, :] = border[:, :m] = border[:, -m:] = True
basis = np.stack([np.ones((h, w)), xx / w, yy / h, (xx / w) ** 2, xx * yy / (w * h), (yy / h) ** 2], axis=-1)
backdrop = np.zeros_like(rgb)
for c in range(3):
    coeff, *_ = np.linalg.lstsq(basis[border], rgb[..., c][border], rcond=None)
    backdrop[..., c] = basis @ coeff
distance = np.abs(rgb - backdrop).max(axis=-1)
warmth = (rgb[..., 0] - rgb[..., 2]) - (backdrop[..., 0] - backdrop[..., 2])
raw = (distance > sil.otsu(distance.ravel())) | ((distance > 0.06) & (warmth > 0.04))
image = Image.fromarray((raw * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.MinFilter(13))
closed = np.asarray(image) > 127
mask = ~sil._flood_exterior(~closed)  # everything the outline encloses
mask = sil.keep_largest(mask)
mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
                  .filter(ImageFilter.MaxFilter(3))) > 127
# The urn is a body of revolution seen from the front: each row is symmetric about the axis.
# The soft floor shadow spills out on the left only, so keep each row's narrower side.
ys, xs = np.nonzero(mask)
axis = float(np.median([(np.nonzero(mask[y])[0].min() + np.nonzero(mask[y])[0].max()) / 2
                        for y in range(ys.min(), ys.max() + 1) if mask[y].any()]))
symmetric = np.zeros_like(mask)
for y in range(ys.min(), ys.max() + 1):
    run = np.nonzero(mask[y])[0]
    if len(run):
        half = min(axis - run.min(), run.max() - axis)
        symmetric[y, int(round(axis - half)):int(round(axis + half)) + 1] = True
mask = symmetric
Image.fromarray((mask * 255).astype(np.uint8)).save(os.path.join(HERE, 'concept-mask.png'))

ys, xs = np.nonzero(mask)
top, bottom = int(ys.min()), int(ys.max())
rows = []
for y in range(top, bottom + 1, 4):
    run = np.nonzero(mask[y])[0]
    rows.append({'row': y, 'left': int(run.min()), 'right': int(run.max())})
centre = float(np.median([(r['left'] + r['right']) / 2 for r in rows]))
widest = max(rows, key=lambda r: r['right'] - r['left'])
out = {'image': [w, h], 'rows_top_bottom': [top, bottom], 'centre_col': centre,
       'widest': widest, 'profile_every_4_rows': rows}
with open(os.path.join(HERE, 'concept-measurements.json'), 'w') as handle:
    json.dump(out, handle, indent=1)
print(json.dumps({k: v for k, v in out.items() if k != 'profile_every_4_rows'}))
