# Craft rules

What separates an asset that looks made by an artist from one that looks
generated or typed in. Each rule says why, how to do it with `bkit`, and how to
check it. The critic holds every asset to these.

## 1. No perfectly cut edges

Real objects have no zero-radius edges; light catches a small round on every
corner, and an unrounded edge reads as CAD. Glass rims are rolled, metal bands
have softened corners, stone has a small chamfer.

- Lips: `profile.rolled_lip(outer_top, inner_top)` across the wall.
- Bands: `profile.raised(..., corner=...)`; one corner step reads as a soft
  chamfer at band scale.
- Where two outline pieces meet: `profile.blend` (a tangent fillet), never a
  straight step.
- Check: `validate.report(...)['sharp_edges_over_30deg']` lists only the
  designed creases (a band's step, a foot's ledge).

## 2. Units are metres, sizes come from the brief

The game scales nothing for you except to its display height. Build at the
contract's size (a 0.92 m amphora is 0.92 m tall) and check scale against Merc
when the asset is new.

## 3. Why before what

Each part's function decides its form: a foot wide enough to stand, a lip rolled
for strength, a handle thick enough to lift the vessel, a wall thick enough to
survive. Write the why into the brief; the critic asks.

## 4. Silhouette first, from splines

The outline is what a player sees. Profiles are a few measured control points
through `profile.spline` (centripetal Catmull-Rom; `corners` keep deliberate
edges), resampled by curvature (`profile.resample`), never a hand-typed
polyline. Fit to the concept with the silhouette gate before any detail.

## 5. Radial is exactly radial, repeats are exact

A vessel is a lathe (`lathe.lathe`), its motifs one stroke placed N times by
angle. Hand-placed repeats drift; generated meshes are never quite symmetric.

## 6. Thickness is real

Walls are offset along the surface normal (`profile.offset`, which keeps the
wall even on slopes; offsetting by radius thins every shoulder). The inner wall
follows a smooth core, not the trims: a collar or band is added on the outside
only. Route that core inside any concave corner (where a collar's foot meets a
shoulder), or the inner wall comes out through the outer one.

Sample a long inner wall in runs (`profile.between` per run, then resample): one
chord across a neck that narrows and flares cuts straight out through an 8 mm
wall. The self-intersection gate catches it; place the runs so it never fires.

## 7. Joins are designed

Nothing floats, nothing shows a gap, nothing pierces where it can be seen.

- A tube ending on a curved wall (a handle root): seat its end ring in the wall
  (`sweep.seat_on_lathe(outline, sink)`), and push the next few rings clear of
  the wall (`clear=(sweep.clear_of_lathe(outline, gap), None, 3)`). Where the
  wall flares across the end, an unseated ring sits behind the next one and the
  first span folds through itself.
- A strap lying along a wall (a handle's tail, a leaf, a strapwork band): a
  lens or D section (`section=`), its centre line just under the surface, the
  crown standing proud, the side facing the wall cut flat. An ellipse centred
  above the wall leaves its edges floating; one centred on the wall dives
  through it into the cavity.
- Sink depth is less than the wall thickness minus 2 mm. Check in the shard
  sheet: a cut through the joint shows the end inside the wall, not the cavity.
- Parts sink into each other (a body into its stem ring, a foot into its base
  ring) by a few millimetres; coplanar faces flicker.

## 8. Flat is flat

Planes are planar, mouldings are swept profiles, a ledge is level. Zebra
stripes on a plane are straight and evenly spaced.

## 9. Topology serves shading

Even quads on curved surfaces, density where the outline bends (curvature-
weighted resampling), no needles or slivers. A lathe ring costs `segments`
quads: spend rings on the silhouette and the visible lip, few on the hidden
inner wall below the neck, none on faces nobody sees.

## 10. Ornament earns geometry only where it reads

An inlay, band or relief is geometry when it changes the silhouette or a
material at gameplay size, within budget; otherwise a normal map baked from
geometry we own. A motif too fine to survive the 128 px game panel is not there
for a player: make it bolder or drop it. Size motifs from the concept, not by
taste (a curl as wide as the concept's curl).

## 11. No lighting in albedo

Physically plausible IOR, metalness and roughness from `bkit.materials`. Colour
comes from the concept's lit midtones, not its highlights or shadows.

## 12. Every build is a script

Re-runnable, deterministic (fixed seeds), named parts, applied transforms,
origin at the contact point (a vessel's base centre on the floor), one
`build.py` per asset that a gate run can rebuild from nothing.

## 13. Perfect is not the same as good

Scripted geometry drifts toward a sterile CAD look. Break it up where the real
object would: roughness variation, a hammered texture on metal, veining in
stone, seeds and cords in glass. Never with lumps in the form.

- Hammered metal: `textures.hammered_normal` (a tileable dent map made in bpy,
  packed into the export) through `textures.attach_normal` on the metal, and
  UVs in tiles (`lathe.lathe(uv=TILE)`, `sweep.tube(uv=TILE)`) so every part
  gets the same dent size. Size the dents from the concept (the amphora's are
  1.2 cm). Export tangents (`export.glb(..., tangents=True)`) for any
  normal-mapped material.

## Materials per span

One closed shell can carry several materials (glass body, gold bands, gold rim):
build the outline as pieces with `profile.chain((slot, points), ...)`, and give
a raised band its own step faces (start on the wall, step out, run the face,
step back, end on the wall). The colour change is then a clean line at a crease,
not a seam in the shading.

## Fracture

Breakables shatter along convex Voronoi cells intersected with every closed
part (`bkit.fracture`). Seed the cells on every part by surface area, or a heavy
solid foot with no seeds becomes one shard holding 40 per cent of the mass.
Every shard is one connected group, cut faces take each part's cut material,
volume is kept within 3 per cent, and shards leave Blender triangulated and
cleaned (`scene.clean(shard, triangulate=True)`), because the exporter's own
triangulation of a cut n-gon leaves zero-area triangles no check in Blender sees.
