"""Turn the concept mask's rows into a side profile in true metres: reference/concept-profile.json.

python3 -I art/glass-adventure/procedural/amber-cadence-urn/reference/fit_profile.py

A body of revolution seen from elevation e under an orthographic camera puts a
side-silhouette point at height z at projected height z cos e; the front of the
foot's bottom edge drops r_foot sin e below that and the back of the rim rises
r_rim sin e above it. With the contract height 0.72 m that fixes the scale, and
each row's half width is the radius there. Rows at the very top and bottom are
the rim and foot ellipses, not the side, and are left out.
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
E = math.radians(4.0)
HEIGHT = 0.72
m = json.load(open(os.path.join(HERE, 'concept-measurements.json')))
rows = m['profile_every_4_rows']
top_row, bottom_row = m['rows_top_bottom']
half = {r['row']: (r['right'] - r['left']) / 2 for r in rows}
r_rim_px = half[min(half, key=lambda y: abs(y - (top_row + 40)))]  # just under the rim's back edge
r_foot_px = max(v for y, v in half.items() if y > bottom_row - 120)
# projected extent in pixels = HEIGHT_px cos e + (r_rim + r_foot) sin e
height_px = ((bottom_row - top_row) - (r_rim_px + r_foot_px) * math.sin(E)) / math.cos(E)
s = HEIGHT / height_px
bottom = -r_foot_px * s * math.sin(E)
profile = []
for y in sorted(half):
    z = ((bottom_row - y) * s + bottom) / math.cos(E)
    if 0.01 < z < HEIGHT - 0.012:
        profile.append((round(z, 4), round(half[y] * s, 4)))
out = {'elevation_deg': 4.0, 'metres_per_px': round(s, 7), 'r_rim': round(r_rim_px * s, 4),
       'r_foot': round(r_foot_px * s, 4), 'diameter_widest': round(2 * max(r for _, r in profile), 4),
       'z_r': profile}
json.dump(out, open(os.path.join(HERE, 'concept-profile.json'), 'w'), indent=1)
print({k: v for k, v in out.items() if k != 'z_r'})
for z, r in profile[::6]:
    print(f'z {z:.3f}  r {r:.4f}')
