# Recipe: a handle

A strap swept along a measured path, seated in the neck at its root, landing on
the shoulder and ending in a leaf that lies on the body. Worked example:
`handle()` in the amphora's `build.py`.

## Path

Control points in the handle's plane (x, 0, z), from the concept's outline: the
outer edge minus the strap's half width at each height.
`sweep.path(points, samples=34)` resamples evenly; pass the result with
`resample=False` so per-point sizes line up with the samples.

## Section

`sweep.tube(..., section=f)` with `f(u, a) -> (along_normal, along_binormal)`:

- On the free arc: an ellipse, radius `rho` in the plane and `0.78 rho` across.
- At the root: a cuff a few millimetres larger for its first 6 cm, gold.
- Below the landing: a D section. The centre line runs 3 mm under the wall
  (`radius_at(body_line, z) - 0.003`), the crown stands out to the concept's
  outer edge, the side facing the vessel is cut flat no more than 6 mm into
  the wall, and the half width tapers to a point at the tip, which ends inside
  the wall.

## Ends

```python
seat=(sweep.seat_on_lathe(neck_line, 0.0035), None),       # root ring 3.5 mm inside the neck wall
clear=(sweep.clear_of_lathe(neck_line, 0.0015), None, 3),  # next 3 rings pushed outside it
```

Keep the seat depth under the wall thickness minus 2 mm. The tip needs no seat:
the D section already ends inside the wall.

## Materials

`material=[jade, gold]` and `face_material(i, k)`: gold for the cuff spans, the
tail spans and the sides that wrap the face toward the vessel (on a 10-sided
section, sides 3 to 6), jade elsewhere. Side k = 0 faces the frame normal; with
`first_normal=(0, 0, 1)` on a planar path that is the outer side of the arc all
the way round.

## Mirror

Build the other handle from the same path with x negated; `tube` recalculates
normals, and the frame normal starts on the same side, so the slots match.
