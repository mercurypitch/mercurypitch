# QA: gates, sheets and what they catch

Numbers decide first; pictures are for the critic and the owner. One command
runs the gates in order and exits 1 on any failure:

```bash
python3 -I scripts/asset_pipeline.py <asset_dir> <out_dir> [--intact-only] [--sheet] [--shards-sheet]
```

| Gate       | Script                                          | Fails when                                                                                                                                                           |
| ---------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| build      | the asset's `build.py`                          | any part is open, self-intersecting, has slivers or no UVs; any shard fails the same                                                                                 |
| finish     | `gltf_finish.py`                                | an optics block names a missing material, or volume without transmission                                                                                             |
| contract   | `validate_asset.py` + `contract.json`           | names, extras, parents, height, budgets, shard count, shard origins, closure (welded at 1e-6), a shard piece that floats free, shard volume against intact beyond 3% |
| khronos    | `gltf_validate.mjs`                             | the Khronos glTF validator reports any error                                                                                                                         |
| silhouette | `silhouette_render.py`, `silhouette_compare.py` | `forms_pass` is false                                                                                                                                                |

## The silhouette gate

`silhouette_render.py` renders the model flat white on black, orthographic,
from the concept's elevation. `silhouette_compare.py`:

1. Segments the concept from its studio backdrop (a quadratic background fit,
   distance, chroma and gradient maps, Otsu, enclosed regions removed only when
   they look like the backdrop).
2. Crops both masks to their bounds and scales them to 800 px tall, so the
   comparison is about proportion, not size.
3. Fills every row from its leftmost to its rightmost pixel (handle loops and
   pale glass stop mattering), then takes a running median of each edge over
   +-6 rows: a band where pale glass at the outline dropped out reads as a
   notch, while a real step survives a median.
4. Reports IoU, the width of 10 horizontal bands (band 0 at the bottom), and
   their deltas. `blockout_pass`: IoU at least 0.85, every band within 0.05.
   `forms_pass`: IoU at least 0.90, every band within 0.03.

`overlay.png`: cyan is concept only, magenta model only.

Both masks are scaled to their own height before rows are compared, so the
silhouette's lowest point (the front of a foot's bottom edge at the camera's
elevation) and its highest set the scale for every row. Move either and steep
parts of the outline elsewhere change width in the gate without changing in the
mesh (`lessons.md`).

### Measuring the elevation

A horizontal circle of radius r seen from elevation e is an ellipse of half
height r sin e. Measure the rim or base ellipse on the concept: e = asin(b / r).

### Fitting a profile to the concept

`rows.json` holds every row of both filled outlines in the gate's own units
(fractions of the 800 px height). For a body of revolution under an
orthographic camera at elevation e, a side-silhouette point at height z sits at
projected height z cos e. With `bottom` and `top` the projected extremes of the
model (the front of the base, `-r_base sin e`; the back of the rim,
`z_top cos e + r_rim sin e`) and `H = top - bottom`:

```
row fraction f = (z cos e - bottom) / H
target radius  = (right - left) / 2 * H        (concept row at f)
```

Fit control points outside the handles' rows; inside them the outline is the
handles'. Where a surface is nearly horizontal (a ledge, a foot's top) the
outline is its front edge, not its side, and this mapping does not hold.

## The sheet

`render_views.py` panels, composed by `compose_sheet.py`:

| Mode     | Shows                                                              | Catches                                                                            |
| -------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| clay     | studio light, cavity                                               | form, proportion, joins, sunk or floating parts                                    |
| zebra    | horizontal reflection stripes                                      | dents, wobble and broken curvature (stripes kink or break)                         |
| wire     | Cycles wireframe                                                   | density, slivers, wasted rings                                                     |
| ids      | flat colour per object                                             | detached parts                                                                     |
| matids   | flat colour per material, with a legend                            | a band, cuff or lining in the wrong material                                       |
| material | Cycles with the asset's materials, ACES 1.3 at the game's exposure | how the materials read (a guide; `three_preview.mjs` and the runtime proof decide) |
| game     | 128 px, enlarged without smoothing                                 | what survives at gameplay size                                                     |

Views: three_quarter and low (perspective), front, side and top
(orthographic). Collision proxies are always hidden; shards are hidden unless
`--show-shards`. The intact sheet ends with a `three.js` column: the same views
drawn by the game's renderer (`three_preview.mjs`), which decides how a material
reads when it and Cycles disagree.

## Measurement renders

`measure_views.py` and `annotate_measure.py` slice the mesh and label radii at
heights: the "dots and measurements" view to compare with a concept by eye.

## Material preview in the game's renderer

Cycles is not three.js. Tune materials in `three_preview.mjs`, which renders a
GLB with the game's own three.js build, tone mapping, museum HDR and lights in
about ten seconds:

```bash
node scripts/three_preview.mjs <out_dir>/<asset>.glb preview.png [--views front,three_quarter,side]
node scripts/three_preview.mjs x.glb dump.png --dump                       # materials as three.js loaded them
node scripts/three_preview.mjs x.glb try.png --set gold_trim.metalness=0.75,glass_waves.normalScale=2.5
node scripts/three_preview.mjs x.glb room.png --env room                   # neutral light, no museum sky
```

`--set` changes a loaded material for one render, so a value can be found
before it goes into `build.py`. `--env room` separates a material fault from
what the museum's sky and ground put into it. Compare colours as numbers:
the hue, saturation and value of a region's midtones (the middle half of its
pixels by value) against the same region of the concept.

## Runtime proof

`runtime_proof.mjs --config proof.json [--candidate x.glb]` starts the Beside
Cue dev server, opens the game in software WebGL, seeds progress so the camera
starts where the asset is, answers the game's own request for `replace` with
the candidate, and screenshots each shot (drags and key holds). It fails if the
game never requested the replaced file, and reports Git LFS pointers it served.
Shoot the baseline with the same config and no candidate.

The game will not load a breakable without its shards: tune materials on full
builds. A material can be tried without Blender by patching the GLB's JSON
(factors, transmission, coat) or recomputing its COLOR_0 from the build's own
colour function, then proving the patched file; a config with only the entry
shot takes about two minutes.

### Colour in the game

The runtime shot is the measure of colour (`lessons.md`: the room's probe light
saturates pale tints, and three_preview's museum sky under-reads them). Compare
it with the concept drawn at the size the game draws the asset, region against
region:

```bash
python3 -I scripts/colour_stats.py concept.png 50,44,107,84 --width 156   # the concept, 70 px across as in the game
python3 -I scripts/colour_stats.py runtime/desktop-entry.png 920,177,972,206
```

Bound the region by landmarks found in each image (between two gold bands, under
a rim), never by one box for both. It prints luminance percentiles (the contrast
a material has: an opaque amber read 63/110/129 against the concept's
48/110/200), the median colour, Lab means, the chroma spread (play of colour)
and hue shares in the bins the eye uses. Aim each number at the concept's, one
change at a time.

Glass measures the room behind it as much as itself. When the shot shows what
stands behind (a dark wainscot as a band through the lower half, the far side
of a part inside), frost the transmission rather than lower it: roughness about
0.4 under a clear coat of 0.5 blurs the room and keeps the highlights, then set
the hue with the base and volume colours (`lessons.md`, the urn's round 5).
