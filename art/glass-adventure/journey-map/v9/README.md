# Museum detail repair V9

## State

The temple and cypress dense archives passed the silhouette gate. Their 90k and
20k remeshes then passed the same-camera clay review and received hash-bound PBR
retextures. CPU Blender finishing preserves each accepted silhouette and UVs,
repairs tangent singularities without changing positions, indices, or UVs, and
keeps the Meshy normal and dense-donor normal bake as separate review exports.

Both same-camera normal-map reviews selected the Meshy-normal variants. Those
variants retain the shared dense-donor AO in their ORM textures; the noisier
dense-normal alternatives remain archived as audit evidence. The hash-bound
decisions are `proofs/temple-normal-selection-v9.json` and
`proofs/cypress-normal-selection-v9.json`. The accepted combined kit is now installed at the versioned public V9 path.
Its exact SHA is `04da964628212b243ca5b4afd327a1e52d43388929de2057be02bec44a495d74`
(19,481,064 bytes). Actual desktop and tablet-sized desktop browser review passed;
physical-tablet performance remains unmeasured. The source kit and packed Blender
project are retained in `exports/` and `sources/`.

The kit preserves old cliff/flower payloads, geometry sharing and named anchors.
Temple structure and dome partitions retain the accepted split normals. The
continuous neutral colour mask preserves amber/teal identity without the ivory
holes and patchy edges of the rejected hard mask. See the measured diagnosis in
`proofs/dome-tint-mask-audit-v9.md` and the final actual-game comparisons in
`../../proofs/museum-components-2026-09-23/README.md`.

Rebuild the combined kit after the accepted candidates and source colour maps:

```sh
rtk proxy timeout 900 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v9/production/build_twin_finish_kit_runtime.py
```

## Visual finding

The CPU Cycles comparisons use the same scale, camera, lighting, and smooth clay
material for each stage. In each clay proof the order from left to right is
dense pre-remesh source, textured donor as clay, and current V4 as clay.

- The dense temple has a smooth dome, clean columns and arches, legible statue
  anatomy and drapery, and intact steps. Detail is already lost in the 21,839
  triangle textured donor and is visibly worse in the 9,993 triangle V4 mesh.
- The dense cypress has rounded foliage clusters, branches, trunk, planter, and
  vines. The 7,136 triangle donor is already faceted; the 1,192 triangle V4 mesh
  has the crystalline silhouette seen in the game.

The dense sources are coherent shape authorities. The current damage is stored
in mesh positions, so recalculating normals or subdividing V4 cannot restore it.

## Source provenance

| Asset   | Exact local source                                                                   |      Bytes | SHA-256                                                            | Source triangles | Accepted remesh budget |
| ------- | ------------------------------------------------------------------------------------ | ---------: | ------------------------------------------------------------------ | ---------------: | ---------------------: |
| Temple  | `art/glass-adventure/journey-map/v3/meshy/floating-museum-temple-v3-pre-remesh.glb`  | 32,205,248 | `9081197e97545d873eca2773ccebfeeadb919acc4e2f96e62ac99a6faa929023` |        1,789,350 |       90,000 triangles |
| Cypress | `art/glass-adventure/journey-map/v3/meshy/floating-museum-cypress-v3-pre-remesh.glb` | 11,942,508 | `cb6f436f48909cfa3c449d085dc48ff3ba9dfc71dbc230332878e32c95cbeda1` |          663,730 |       20,000 triangles |

Both source GLBs contain positions and indices but no normals, UVs, or material.
The archived Meshy remesh tasks are
`01a0cebb-46e1-72a2-a44b-0c419eeafc82` for the 89,166-triangle temple and
`01a0cebd-1bb5-77ac-a695-9e877f69eb94` for the 20,605-triangle cypress. The
accepted PBR tasks are `01a0cecb-7295-70bd-be93-a214e8d5225c` and
`01a0ced2-c48f-71c4-b329-991ce0e016ce`. Their archived inputs, requests, costs,
outputs, and hashes are recorded in `meshy/*-receipt.json`; no signed provider
URL or credential is persisted.

The PBR step retained the accepted geometry. Temple position and index payloads
match the remesh exactly. Cypress positions and all 61,815 index values match;
the provider only widened the cypress index component from unsigned short to
unsigned int.

The structured handoff is
`proofs/museum-remesh-source-manifest-v9.json`.

## Receipt-guarded provider production

`production/run_museum_remesh.py` and `production/run_museum_retexture.py`
produce one independently receipted operation per asset. A run without a submit
mode is a local preflight. Submission writes `submission-unconfirmed` before the
charged call and persists the returned task ID before any auxiliary provider
read. Reruns therefore poll a known task or stop at an ambiguous receipt rather
than duplicating a charge.

```bash
rtk python3 art/glass-adventure/journey-map/v9/production/run_museum_remesh.py --asset temple
rtk python3 art/glass-adventure/journey-map/v9/production/run_museum_remesh.py --asset cypress
```

The approved and completed submission commands were:

```bash
rtk proxy timeout 1200 python3 art/glass-adventure/journey-map/v9/production/run_museum_remesh.py --asset temple --submit --authorized-source-transfer
rtk proxy timeout 1200 python3 art/glass-adventure/journey-map/v9/production/run_museum_remesh.py --asset cypress --submit --authorized-source-transfer
rtk proxy timeout 1200 python3 art/glass-adventure/journey-map/v9/production/run_museum_retexture.py --asset temple --submit --authorized-source-transfer
rtk proxy timeout 1200 python3 art/glass-adventure/journey-map/v9/production/run_museum_retexture.py --asset cypress --submit --authorized-source-transfer
```

`--resume` only polls and archives a task ID already present in a receipt. Status
receipts omit free-form provider messages and signed URLs; download URLs remain
in memory and must use the `assets.meshy.ai` host.

## Candidate and finish gates

The 90k and 20k requests are review budgets. Meshy's triangle remesh is a
decimation operation; polygon count alone does not establish fidelity. The
accepted clay reviews were generated with:

```bash
rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v9/production/review_museum_remesh_candidate.py -- --asset temple
rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v9/production/review_museum_remesh_candidate.py -- --asset cypress
```

The order is dense source, old textured donor, current V4, and V9 candidate.
The finished review candidates are rebuilt with:

```bash
rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v9/production/finish_museum_candidate.py -- --asset temple
rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v9/production/finish_museum_candidate.py -- --asset cypress
```

The finisher produces packed editable Blender sources, 2K tangent-space normal
and ambient-occlusion transfers from the dense donors, shared ORM textures,
and Meshy-normal plus dense-bake-normal GLBs. Fresh GLB validation requires the
target dimensions and ground anchor, unchanged triangle count, UV0, finite unit
normals, finite unit tangents with handedness ±1, and complete base-color,
normal, metallic-roughness, and occlusion bindings. The temple dome partition
must retain these loop normals and tangents; amber and teal instances share the
same structure and dome geometry payloads. All cypress placements share one
finished mesh.

`production/render_museum_finish_comparison.py` renders both variants at
identical cameras and binds the proofs to candidate hashes. The completed review
selected Meshy normals for both assets: dense normals added narrow dark streaks
to temple edges and folds and high-frequency crusty noise to cypress foliage.
The accepted assets are substantial repairs of the damaged V4 shapes; they are
not represented as pristine hand-authored sculpture or foliage.

## Proofs and reproduction

The clay and textured comparisons are in `proofs/`:

- `temple-clay-front-v9.png` and `temple-clay-angle-v9.png`
- `temple-textured-front-v9.png` and `temple-textured-angle-v9.png`
- `cypress-clay-front-v9.png` and `cypress-clay-angle-v9.png`
- `cypress-textured-front-v9.png` and `cypress-textured-angle-v9.png`
- `temple-normal-comparison-front-v9.png` and
  `temple-normal-comparison-angle-v9.png`
- `cypress-normal-comparison-front-v9.png` and
  `cypress-normal-comparison-angle-v9.png`

`proofs/museum-source-shape-comparison-v9.json` records the source and proof
hashes, draw order, Blender version, render engine, and render command.
`proofs/museum-geometry-lineage-v9.json` records the accessor counts, V3-to-V4
triangle parity, normal comparison, and runtime/export hash parity.

```bash
rtk proxy timeout 7200 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v9/production/render_source_shape_comparison.py
rtk python3 art/glass-adventure/journey-map/v9/production/audit_geometry_lineage.py
```
