# Camellia gardens — source to game

The V10 kit replaces the floating museum's old flower-cluster prototype with
ivory camellias and broad jade leaves in a gold-edged marble planter. The existing
temples, cliff, cypresses, destination identities and map topology are preserved.

## Production and selection

- Original generated guide: `guides/camellia-crescent-planter.png`.
- Meshy 7.1 dense generation and quad-dominant remesh: 40 credits total. Durable
  receipts in this directory identify the two tasks; originals are in `sources/`.
- Dense donor: 2,122,454 triangles. Reviewed remesh: 117,800 triangles. The remesh
  has acceptable petal/leaf outlines, but its provider textures were rejected for
  large pale leaf patches. Neither donor is silently overwritten.
- `production/bake_botanical.py` freezes triangles and corner normals, transforms
  the source/target together, and bakes 2K base, ORM and tangent normals through a
  short controlled cage. The packed `baked/camellia-crescent-rebaked.blend` contains
  the editable target, hidden dense donor and packed texture maps.
- Export validation found 126 zero tangents at UV-degenerate corners. The narrow
  `repair_bake_tangents.py` pass gives only those corners a finite unit basis
  orthogonal to the unchanged normal. All other tangents, geometry and UV bytes
  stay unchanged. Fresh GLB validation passes with zero errors.
- Equal-camera Three.js 1K/2K proofs retain the same petal and leaf outlines.
  The accepted **1K** maps use about 16 MiB of decoded RGBA mip storage, compared
  with 64 MiB at 2K. The delivery has identical triangles and 16-bit attributes.
  WebP compression reduces download size; it is not claimed to reduce GPU texture
  residency. See `proofs/three-delivery.json` and matched PNGs.

The wrapped `map_flower_cluster` parent is deliberately unscaled. Quantization
decode transforms remain on its child, because the game's authored-unit loader
resets the selected root transform. Resetting the quantized child instead would
destroy the object's dimensions. Fresh Three import measures a 0.99978 m width,
0.39558 m height and -0.00037 m lowest point, within the contact tolerance.

## Runtime contract

`delivery/floating-museum-botanical-kit-v10-1k.glb` is copied to
`apps/beside-cue/public/games/journey-map-v10/floating-museum-botanical-kit-v10.glb`.
Its existing logical ID remains `floating-museum-twin-finish-kit-v4`; the new URL
invalidates cached V9 art. The six planters are real GPU instances of one mesh and
material. The decoded-maps cost is shared, not multiplied per placement.

`production/audit_bundle.py` confirms all 11 non-botanical nodes keep identical
geometry, index, UV, normal and image payloads, material semantics and transforms.
The original V9 runtime kit is preserved under `sources/`, and removed from the
public runtime directory to avoid shipping an unused second copy.

The one inherited glTF warning is the old cliff's missing authored tangent stream;
it uses the same derivative tangent basis as V9. No blanket normal recalculation
or silhouette decimation was applied to existing architecture.

Actual map proof is in
`art/glass-adventure/proofs/museum-components-2026-09-23/v10-desktop/`.
Screenshots use actual WebGL drawing on the local desktop GPU and verify served
asset bytes. Desktop cadence and tablet-sized screenshots are not physical-tablet
performance claims. Final garden placement is separately reviewed in the museum
architecture audit.

## Rebuild

The reviewed donor/remesh, baked images, packed master, raw/repaired GLBs and
1K/2K delivery hashes are pinned in `production/accepted-inputs.json`. Packaging
requires glTF Transform 4.4.2 and checks its inputs **before** writing candidates.
It invokes the tangent repair, validates the result, and checks the accepted
output hash before replacing a delivery. `--publish` copies only that accepted
1K bundle to the public directory and refreshes its manifest bytes/hash together.
The original production scripts are retained as hash-addressed evidence under
`production/archive/`; use the current scripts for guarded rebuilds.

To reproduce deliveries from the reviewed bake, run from the repository root:

```sh
rtk proxy timeout 480 node art/glass-adventure/journey-map/v10/production/package_botanical.mjs 1024 --publish
rtk proxy timeout 480 node art/glass-adventure/journey-map/v10/production/package_botanical.mjs 2048
rtk proxy python3 art/glass-adventure/journey-map/v10/production/audit_bundle.py
rtk proxy apps/beside-cue/node_modules/.bin/gltf-transform validate apps/beside-cue/public/games/journey-map-v10/floating-museum-botanical-kit-v10.glb
rtk proxy timeout 60 python3 art/glass-adventure/journey-map/v10/production/test_production_guards.py
```

To repeat the dense-to-remesh bake with Blender 5.2.2 LTS, use a **new candidate
directory**. The command refuses to overwrite the accepted `baked/` master and
records input, script and output hashes. A fresh Blender bake can differ between
tool versions; inspect its clay/PBR/normal comparisons before explicitly accepting
new inputs. No command silently updates the accepted-input receipt.

```sh
rtk proxy timeout 1800 blender -b --factory-startup --python art/glass-adventure/journey-map/v10/production/bake_botanical.py -- --output art/glass-adventure/journey-map/v10/candidates/camellia-rebake
```

Refresh equal-camera export proof against a local games-enabled Vite server:

```sh
rtk proxy timeout 180 env GLASS_QA_URL=http://127.0.0.1:5525 node art/glass-adventure/journey-map/v10/production/capture_botanical.mjs
```

The accepted mapped-game composition is documented by the desktop/tablet/orbit
receipts under `proofs/museum-components-2026-09-23/` and the companion museum
architecture audit. The packaging process preserves masters and removes only
its own temporary candidate directory. Drift tests verify that changed inputs
cannot replace an accepted delivery or repaired export.
