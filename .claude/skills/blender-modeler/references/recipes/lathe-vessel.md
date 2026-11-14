# Recipe: a lathed vessel

A hollow vessel with raised bands, a collar, a rolled lip and an even wall, as
one closed shell with several materials. The worked example is
`art/glass-adventure/procedural/opaline-echo-amphora/build.py` (`body()`).

## 1. Outlines

Measured control points, bottom to top, in metres (`BRIEF.md` cites each):

```python
body_line = profile.spline(BODY, samples=10)    # outer glass wall, stem to collar foot
neck_line = profile.spline(NECK, samples=10)    # collar top to just past the lip
core = profile.spline(BODY[:-1] + CORE_SHOULDER + NECK[1:], samples=10)
inner = profile.offset(core, wall_thickness)    # wall_thickness(z): metres
```

- Run the neck outline a centimetre past the lip so the rim can be measured off it.
- The core is the surface the inner wall follows: the glass under the collar,
  routed inside the corner where the collar's foot meets the shoulder.

## 2. Pieces, one material each

```python
pts, slots = profile.chain(
    (opal, [V(0, z_bottom)]),                                   # pole: closes the base
    (opal, profile.resample(profile.between(body_line, z_bottom, z0), 6, curvature_bias=0.5)),
    (gold, profile.raised(body_line, z0, z1, proud=0.0028, samples=1)),   # a band
    (opal, profile.resample(profile.between(body_line, z1, w0), 5, curvature_bias=0.3)),
    ...
    (gold, collar_points),                                      # its own shape, on the outside only
    (opal, profile.resample(profile.between(neck_line, z_collar_top, rim0), 7)),
    (gold, rim_face + lip + [inner_top] + inner_gold[1:]),      # rim band over the lip, a little inside
    (opal, cavity + profile.blend(cavity, floor, samples=3) + floor),     # inner wall, fillet, floor, pole
)
body = lathe.lathe('body', pts, 32, material=[opal_mat, gold_mat], span_materials=slots, sharp_degrees=50)
```

- `raised` starts and ends on the wall, so its neighbours share its end points
  and the step faces are gold.
- The lip: `rolled_lip(outer_top, inner_top)` across the wall; set its base so
  its crown lands on the contract height.
- The cavity in two runs (neck, body), resampled separately; a long chord across
  a flaring neck cuts out through the wall.
- Stop the cavity above the solid base and close it with a filleted floor at
  the axis.

## 3. Budget

Every profile point is a ring of `segments` quads. 32 segments hold a hero
outline at gameplay distance; spend points on the silhouette and the visible
mouth, few on the inner wall below the neck. The amphora body is 4,032
triangles at 32 segments.

## 4. Feet and rings

Separate closed lathes (base ring, foot, stem ring), each sunk 2-3 mm into the
next so nothing is coplanar. Each hides one small disc inside its neighbour.

## Check

`validate.report(part, within_shell=True)` per part, then the silhouette gate,
then the clay, zebra and matids panels.
