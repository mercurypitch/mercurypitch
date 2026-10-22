# Generators: Meshy and the alternatives

Evidence, prices and API details as of 2026-10-21 are in
`art/glass-adventure/proofs/modeling-audit-2026-10-21/generators-research.md`.
This page is the decision rule.

## Never the deliverable for

- **Glass and vessels.** Generators output opaque surfaces with baked lighting
  and no transmission data, single-skinned or lumpy walls, rims with no real
  thickness, and only approximate symmetry. Meshy's `symmetry_mode` is deprecated
  and has no effect.
- **Architecture and kit pieces.** Flat must be flat, repeats exact, modules on
  a grid. A generated column has wavy flutes and an arch has no true radius.
- **Fracture sets.** Booleans only guarantee results on closed manifolds; a raw
  generated mesh is neither closed nor clean.

The audit measured this on the shipped museum: the Meshy amphora's outline is
close (silhouette IoU 0.948 against its concept), but its gold, jade and glass
are paint in the textures of one glass material, and the file weighs 3.8 MB.
The procedural rebuild has an IoU of 0.965, real gold and jade materials, and
weighs 1.2 MB with its hammered-gold and jade textures.

## Where one helps

- **Organic ornament** a lathe or sweep cannot reach (acanthus, a figure, a
  plant): generate the piece alone from clean, evenly lit multi-view
  references, then rebuild: weld and repair, retopologise, our own UVs, bake
  normal and AO onto our own low-poly, de-light, validate. Budget 2-8k triangles.
- **A measurement source.** A donor mesh can be sliced for proportions when the
  concept is ambiguous (`art/.../reference/measure_donor.py`).
- **A silhouette.** A generated orthographic image can be traced into a profile;
  the mesh still comes from the profile.

## Choosing one, when needed

- Meshy: use multi-image, `meshy-t2.5` or a high-resolution 7.1 output as a bake
  source; `model_type: lowpoly` retires 2026-10-30.
- TRELLIS.2 through ComfyUI for local or offline work.
- Tripo H3.1 / P2 for built-in low-poly and quads.
- Check each licence for the markets the game ships in.
