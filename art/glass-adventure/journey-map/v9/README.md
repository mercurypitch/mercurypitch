# Museum detail repair V9 — local source checkpoint

## State

The temple and cypress dense archives pass the local silhouette gate and are
ready to be used as remesh sources. No source file has been uploaded, no V9
provider task exists, and no credits have been charged. The next step requires
specific approval to transmit the two files listed below to Meshy.

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

## Approval-ready source manifest

| Asset   | Exact local source                                                                   |      Bytes | SHA-256                                                            | Source triangles | Planned first candidate |
| ------- | ------------------------------------------------------------------------------------ | ---------: | ------------------------------------------------------------------ | ---------------: | ----------------------: |
| Temple  | `art/glass-adventure/journey-map/v3/meshy/floating-museum-temple-v3-pre-remesh.glb`  | 32,205,248 | `9081197e97545d873eca2773ccebfeeadb919acc4e2f96e62ac99a6faa929023` |        1,789,350 |        90,000 triangles |
| Cypress | `art/glass-adventure/journey-map/v3/meshy/floating-museum-cypress-v3-pre-remesh.glb` | 11,942,508 | `cb6f436f48909cfa3c449d085dc48ff3ba9dfc71dbc230332878e32c95cbeda1` |          663,730 |        20,000 triangles |

Both source GLBs contain positions and indices but no normals, UVs, or material.
The intended provider operation is triangle remesh, GLB output, and bottom
origin. Retexture should wait until the returned clay candidates pass visual
review. The final kit should share temple geometry between the amber and teal
instances, with the colour variants retained as separate material treatments.

The structured handoff is
`proofs/museum-remesh-source-manifest-v9.json`.

## Receipt-guarded candidate production

`production/run_museum_remesh.py` prepares one independently receipted candidate
per asset. Running it without a mode is a local-only preflight: it verifies the
source GLB, its V3 provider receipt, the exact source hash, and the fixed request,
then writes a `not-submitted` receipt. It does not start the MCP launcher.

```bash
rtk python3 art/glass-adventure/journey-map/v9/production/run_museum_remesh.py --asset temple
rtk python3 art/glass-adventure/journey-map/v9/production/run_museum_remesh.py --asset cypress
```

After specific source-transfer approval, run V8 Conservatory first. Once its
task ID is safely receipted, the V9 submission commands are:

```bash
rtk proxy timeout 1200 python3 art/glass-adventure/journey-map/v9/production/run_museum_remesh.py --asset temple --submit --authorized-source-transfer
rtk proxy timeout 1200 python3 art/glass-adventure/journey-map/v9/production/run_museum_remesh.py --asset cypress --submit --authorized-source-transfer
```

The script saves `submission-unconfirmed` before the charged call and saves the
returned task ID before checking balance or doing any other provider read. A
rerun cannot resubmit an ambiguous receipt. `--resume` only polls and archives a
task ID already present in the receipt. Status receipts omit free-form provider
messages and signed URLs; download URLs remain in memory and must use the
`assets.meshy.ai` host.

## Candidate and finish gates

The 90k and 20k triangle requests are first review budgets. Meshy's triangle
remesh is a decimation operation; its polygon count does not establish clean
retopology or fidelity. After each receipt reaches `archived`, create the
same-camera four-stage clay review with:

```bash
rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v9/production/review_museum_remesh_candidate.py -- --asset temple
rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v9/production/review_museum_remesh_candidate.py -- --asset cypress
```

The order is dense source, old textured donor, current V4, and V9 candidate.
The review manifest records topology, normal health, UV layers, and whether a
tangent basis can be computed. It deliberately marks the professional finish as
unfinished. A visually accepted candidate still needs a final non-overlapping
UV layout, dense-to-low tangent-space normal and ambient-occlusion transfer,
PBR texture work on that same UV layout, tangent and split-normal validation,
and fresh export/reimport checks. The temple material split must retain the
reviewed loop normals, and amber/teal temples must share geometry. Every runtime
cypress placement must reuse one finished mesh.

No candidate, bake, PBR texture, packed Blender file, runtime derivative, or
public asset is produced by the current source-preparation checkpoint.

## Proofs and reproduction

The clay and textured comparisons are in `proofs/`:

- `temple-clay-front-v9.png` and `temple-clay-angle-v9.png`
- `temple-textured-front-v9.png` and `temple-textured-angle-v9.png`
- `cypress-clay-front-v9.png` and `cypress-clay-angle-v9.png`
- `cypress-textured-front-v9.png` and `cypress-textured-angle-v9.png`

`proofs/museum-source-shape-comparison-v9.json` records the source and proof
hashes, draw order, Blender version, render engine, and render command.
`proofs/museum-geometry-lineage-v9.json` records the accessor counts, V3-to-V4
triangle parity, normal comparison, and runtime/export hash parity.

```bash
rtk proxy timeout 7200 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v9/production/render_source_shape_comparison.py
rtk python3 art/glass-adventure/journey-map/v9/production/audit_geometry_lineage.py
```
