# Moon amphora: source-derived glass candidate

This asset uses the actual high-detail Meshy amphora, cleaned in Blender. It retains the original handles, open mouth, cavity, fluting, collar and laurel relief. It is staged for owner review; it is not active in the game.

The low-resolution textured Meshy donor supplies only the gold/glass region decisions. Its baked shading is not used as a glass texture. `ready-intact.blend` has physical `glass_shell`, `glass_cut` and `gold_trim` slots. The exact source-derived shell is clipped into 23 Voronoi fragments, retaining exterior normals and material regions. New interior cut faces use `glass_cut`.

## Authoritative artifacts

- `finalized.blend`: packed editable intact model and matching fragments, before proof staging.
- `../../exports/moon-amphora.glb`: +Y-up, metre-scale, foot-centered export; `vase_amphora_intact` and `vase_amphora_shard_000` through `_022`.
- `ready-intact.blend` / `.json`: inspected shell and resolved material regions before fracture.
- `finalization.json`: actual export hashes, bounds, volumes, fragment seed positions and source provenance.
- `geometry-validation.json`: independent GLB reimport and geometry/material checks.
- `finalized-intact.png` / `finalized-fracture.png`: actual Cycles renders of the staged asset. The fracture proof lowers its studio floor below the expanded pieces; no model geometry is changed or saved by rendering.
- `validation.json`: authoring acceptance and remaining integration limits, written after inspecting the above images.

## Preservation and quality decisions

The untouched high-detail Meshy GLB is `../../../v2/meshy/moon-amphora-01/pre-remeshed.glb`, also imported in `../moon-amphora-high-source/raw-import.blend`. The textured donor and all source archives remain unchanged.

The initial 1.2mm cleanup was rejected visually because it softened the relief too much. The retained workflow uses 0.6mm OpenVDB with no source projection, pole fixing or adaptivity, followed by 200k and 100k reductions. It required no local fairing. Twelve isolated zero-volume double-triangle artifacts were removed as whole components; the result has 99,976 intact triangles and passes Blender's export validation without repairs.

Matched source/candidate clay views are retained. Across 16,069 source samples, p95 deviation is 0.509mm and p99 is 1.992mm; the maximum is 10.176mm around narrow handle/relief recesses. The overall silhouette, handles, cavity and major decoration are retained. Tiny foot beading and some recesses remain softer than the original high source. These limits are recorded rather than claiming exact source fidelity.

The material projection uses the same high-source normalization for both meshes. `../../material-regions/moon-amphora/proof-v3/` contains the inspected source swatches, diagnostic front/back images and face correspondence. All 690 weak-color faces had valid geometric correspondence; their closest source color class was retained after inspecting the boundaries. `resolved-material-boundaries.json.gz` records every decision. Confident labels and mesh geometry were not altered for classification.

## Reproduction

Run from the repository root with Blender 5.2.2. Commands are bounded; the dense remesh can take a few minutes. The fracture helper invokes external Python with Manifold3D 3.5.3 installed under `/tmp/glass-museum-manifold`; this is a local authoring dependency, never a runtime package dependency. Reinstall that version at a chosen location and pass its library path when moving the authoring environment.

```sh
rtk proxy timeout 300s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/donors/moon-amphora/prepare_fine_lod.py
rtk proxy timeout 180s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/donors/moon-amphora/inspect_source_fidelity.py -- fine-060-lod100k
rtk proxy timeout 60s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/donors/moon-amphora/prepare_reviewed_shell.py
# For a new geometry revision, create a new proof output in recipe-v3.json first;
# the proof tool deliberately refuses to overwrite a previous audition.
rtk proxy timeout 180s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/material-regions/prove_regions.py -- --recipe art/glass-adventure/v3/material-regions/moon-amphora/recipe-v3.json
rtk proxy timeout 60s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/donors/moon-amphora/apply_reviewed_materials.py
rtk proxy timeout 300s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/export_final_shell.py -- --family moon-amphora
rtk proxy timeout 120s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/validate_final_shell.py -- --family moon-amphora
rtk proxy timeout 180s blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/v3/donors/moon-amphora/render_proof.py -- --name moon-amphora
```

The current bundle is 11,461,724 bytes and contains 223,688 triangles including all hidden fragments. Normal, tangent and UV0 attributes and physical material slots survive export. Volume reconstruction error is below 8e-10. This is an authoring candidate; mobile memory, draw-call cost, download size and in-game fracture motion still need an integration audition.
