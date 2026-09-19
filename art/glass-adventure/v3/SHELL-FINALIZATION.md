# Meshy glass finalization

The first complete candidate is `donors/fluted-carafe/validation.json`. Its
source is the genuine archived high-detail Meshy carafe, finalized in isolated
Blender processes. The source silhouette was not replaced with a procedural
lathe. This is an asset inspection candidate, not runtime activation or a device
performance claim.

## Proven path

1. Preserve the provider GLB and untouched `raw-import.blend` before repairs.
2. Inspect actual inner/outer surfaces and ray-probe the mouth. The source may be
   edge-manifold while containing self-intersections or microscopic artifacts.
3. Derive a clean surface from the source with OpenVDB. For the carafe, 1.2 mm
   voxels with adaptivity, pole fixing, original-surface projection and attribute
   transfer disabled passed the surface gate. The amphora uses a finer setting
   in its own recipe to preserve relief. Measure fidelity per family.
4. Reduce the clean surface, then repair only diagnosed intersecting face patches
   within an explicit sub-millimetre movement limit. Do not apply that reduction
   directly to the original defective surface. Preserve the clean high-detail
   source even when a smaller candidate fails.
5. Remove isolated collapsed two-sided triangles: two opposite faces on exactly
   the same three vertices are zero-volume components, not usable glass. Both
   faces must be removed. Deleting just one duplicate creates a hole.
6. Check edge/vertex manifoldness, edge orientation, actual nonadjacent triangle
   intersections **and** Blender's mesh validator on a copy. An edge-only gate
   misses the collapsed-component problem.
7. Assign real glass, cut-glass and gold materials. Textured donor paint is a
   source for reviewed gold-region labels; its baked clay/reflection colors are
   not the final glass appearance. The untextured carafe uses explicit reviewed
   surface regions, recorded in `ready-intact.json`.
8. Cut 12–24 seeded convex cells through the actual closed surface. Preserve
   surface normals, UVs and material IDs; new caps use `glass_cut`. Compare the
   sum of signed fragment volumes with the intact volume.
9. Export, reimport independently, weld only exact export seams on inspection
   copies, and repeat the surface/volume/material/attribute gates. Inspect the
   actual intact and exploded renders before writing `validation.json: passed`.

## Shared production helpers

- `solid_fracture.py`: `remove_collapsed_components(obj)`, `mesh_check(obj)` and
  `fracture(intact, root, seeds, materials, work_directory)`. The cutter expects a
  triangulated mesh with UV0 and named physical material slots. It returns shard
  objects and the backend report without exporting or changing the live game.
- `solid_fracture_backend.py`: external Manifold3D process. It preserves corner
  normals/UVs and material runs. It does not author a replacement vessel.
- `export_final_shell.py -- --family FAMILY --input ready-intact.blend`: stage a
  single-mesh intact and its matching fragments using the family recipe.
- `validate_final_shell.py -- --family FAMILY`: independent GLB reimport and
  optical-material/normal/UV/tangent checks. Writes `geometry-validation.json`;
  it intentionally does not grant visual acceptance.
- `measure_final_fidelity.py -- --family FAMILY`: deterministic bidirectional
  vertex-sample distances to the real normalized high-detail source. These are
  measured samples, not a global Hausdorff guarantee.
- `render_shell_proof.py -- --name FAMILY`: actual physical-material intact and
  exploded renders, with low support fragments kept above the display floor.

The decanter has a separate solid stopper. Its family pipeline can fracture the
body into 22 pieces and retain the stopper as the 23rd, with a two-child intact
group. Validate the components separately and explicitly record their resting
contact; do not union a detachable stopper into the hollow wall.

## Environment and bounded reproduction

Blender 5.2.2 LTS and ordinary Python with `numpy` and `manifold3d==3.5.3` were
used. The Manifold wheel was installed only in `/tmp/glass-museum-manifold`.
Do not import this binary wheel inside Blender: its allocator conflicts with
Blender's TBB allocator on this host. The helper launches `/usr/bin/python3` in
a separate process and accepts explicit `python`/`library_path` overrides.
The runtime app has no new dependency.

From the repository root:

```sh
rtk proxy timeout 60s python3 -m pip install --target /tmp/glass-museum-manifold --no-deps --only-binary=:all: manifold3d==3.5.3
rtk proxy timeout 180s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/voxel_finalize_trial.py -- fluted-carafe
rtk proxy timeout 120s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/clean_surface_lod.py -- fluted-carafe
rtk proxy timeout 60s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/prepare_fluted_final.py
rtk proxy timeout 300s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/export_final_shell.py -- --family fluted-carafe
rtk proxy timeout 90s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/validate_final_shell.py -- --family fluted-carafe
rtk proxy timeout 90s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/measure_final_fidelity.py -- --family fluted-carafe
rtk proxy timeout 180s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/render_shell_proof.py -- --name fluted-carafe
```

Inspect the rendered images before updating the final visual acceptance record.
No command spends Meshy credits or modifies the user's interactive Blender scene.

## Carafe result

The validated carafe has 49,930 intact triangles and 23 closed fragments. The
bundle contains 119,708 triangles including the alternative fractured state and
is 9,121,856 bytes. SHA-256:
`a23ffab3b2e37ef38a5c9cc5648241b47fcca55775c46863ed1726940f4862fa`.
Every primitive retains normals, UV0 and tangents, with optical transmission for
`glass_shell`/`glass_cut` and metalness for `gold_trim`. The reimported volume
reconstruction error is `8.42e-9` relative.

The final surface's sampled maximum distance to the original is 1.45 mm
(95th percentile 0.55 mm). Original-to-final samples reach 3.04 mm
(95th percentile 1.62 mm). All five mouth probes reach the actual inner floor
near 14.8 mm above the foot. The gold finish is Blender-authored on the existing
Meshy support, collars and scalloped rim; no clay texture is presented as glass.

Failed trials remain diagnostic files. In particular, direct 20k/50k collapse,
adaptive remesh, source projection, and the unsuccessful QuadriFlow attempt
must not be promoted because an output `.blend` happens to exist. The gallery
requires the explicit family validation record.
