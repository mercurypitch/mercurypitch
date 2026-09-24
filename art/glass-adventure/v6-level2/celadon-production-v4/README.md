# Celadon lark decanter v4

This package replaces the rejected collapsed reductions with a semantic,
hollow vessel derived from the accepted dense donor. The clean donor supplies
the measured scalloped silhouette and relief; the textured donor supplies the
2K PBR transfer. Neither donor topology ships.

## Accepted runtime asset

- Runtime GLB: [`exports/celadon-lark-decanter-fracture-v4.glb`](exports/celadon-lark-decanter-fracture-v4.glb), 5,820,204 bytes, SHA-256 `76ca793d5d9c7ef2d301ce9c85694f577c96844cb21fdb4ade67832df2925346`.
- Packed Blender master: [`sources/celadon-lark-decanter-fracture-v4.blend`](sources/celadon-lark-decanter-fracture-v4.blend), 11,719,317 bytes, SHA-256 `301cdba45fcb131d77f1c5b77ddf39e42ce609407456c270baf4e427b82c27d2`.
- Public copy: `apps/beside-cue/public/games/adventure-v6/celadon-lark-decanter-fracture-v4.glb`; it byte-matches the runtime export.
- Catalog ID: `celadon-lark-decanter-fracture-v4`. It replaces only the Twin Galleries `upper-decanter` prefab, preserving the existing encounter, checkpoint, save identity, challenge, label, and room placement.

## Geometry and material audit

The 1.15 m intact vessel has 26,512 realized triangles after Blender reimport.
Eighteen closed fracture pieces add 37,080, bringing the realized rendered total
to 63,592. A raw GLB index inventory counts 26,576 intact and 37,094 shard
triangle records, or 63,670 rendered records; Blender omits 78 degenerate export
triplets when rebuilding the surfaces. The validation-only collider contributes
another 60 indexed triangles, so an all-mesh static inventory correctly reports
63,730. Reimport validation found zero non-manifold edges or vertices, zero
non-contiguous edges, zero self-intersection pairs, correct orientation, and a
shard reconstruction volume error of `6.6419758804716916e-9`.

The semantic cavity uses a 12 mm wall target across 32 radial samples at 12
elevations. Measured nearest-wall thickness is 10.04 mm at p05 and 16.95 mm at
p50; the smaller minimum belongs to the intentional open-mouth seam. The cavity
floor is 0.184 m above the base. The scalloped rim spans 15.55 mm in height and
the central mouth ray reaches the cavity floor, confirming an open mouth and a
real hollow interior.

The foot has a sealed planar underside at zero height, with 97 contact vertices
and a 0.11902 m maximum contact radius. UV0 has 74,880 loops, no zero-area
triangles, and separate side, foot, and mouth islands. All 54 rendered GLB
primitives retain normals and UV0. The 19 normal-mapped shell primitives retain
their encoded tangents; 35 unused tangent streams were removed from the cavity,
fracture-cut, and gold primitives whose materials have no normal map. The
collider also omits unused tangents. The attribute repair changed no positions,
indices, normals, UVs, material bindings, or texture data, and the runtime
bundle embeds three 1K textures for the opaque celadon shell, cavity surface,
and fracture cuts.

The exact pre-repair Blender export is archived as
[`sources/celadon-lark-decanter-fracture-v4-pre-attribute-repair.glb`](sources/celadon-lark-decanter-fracture-v4-pre-attribute-repair.glb),
SHA-256 `8ce03aecaf6630a1d4ae6252073e60ab87ce6002a9cf5f5dae86a22cc2131999`.
The material-aware edit receipt is
[`exports/celadon-lark-decanter-fracture-attribute-repair-v4.json`](exports/celadon-lark-decanter-fracture-attribute-repair-v4.json);
`gltf-transform validate` reports zero errors and zero warnings on the repaired
runtime asset.

The packed master keeps the 2K source bakes. Under identical lighting and
camera, the 1K runtime export differs from the packed 2K render by 0.02245 mean
absolute 8-bit units over the full frame and 0.04158 over the central vessel
crop, with 60.99 dB PSNR and zero p95 error. The side-by-side proof is
[`proofs/celadon-lark-decanter-2k-left-1k-right-v4.png`](proofs/celadon-lark-decanter-2k-left-1k-right-v4.png).

Detailed machine-readable evidence lives in
[`exports/celadon-lark-decanter-cavity-v4.json`](exports/celadon-lark-decanter-cavity-v4.json),
[`exports/celadon-lark-decanter-fracture-v4.json`](exports/celadon-lark-decanter-fracture-v4.json),
and [`exports/celadon-lark-decanter-fracture-validation-v4.json`](exports/celadon-lark-decanter-fracture-validation-v4.json).

## Visual proof

- [`proofs/celadon-lark-decanter-intact-v4.png`](proofs/celadon-lark-decanter-intact-v4.png) shows the packed 2K master.
- [`proofs/celadon-lark-decanter-mouth-v4.png`](proofs/celadon-lark-decanter-mouth-v4.png) shows the scalloped rim, shell thickness, and cavity.
- [`proofs/celadon-lark-decanter-shards-v4.png`](proofs/celadon-lark-decanter-shards-v4.png) shows all 18 closed pieces separated.
- [`runtime-proof/captures/celadon-lark-decanter-game-distance-intact-v4.png`](runtime-proof/captures/celadon-lark-decanter-game-distance-intact-v4.png) and [`runtime-proof/captures/celadon-lark-decanter-game-distance-fracture-v4.png`](runtime-proof/captures/celadon-lark-decanter-game-distance-fracture-v4.png) show the exact public GLB intact and fractured in the shipped Twin Galleries at game distance.

The runtime harness uses the public movement, camera, and voice-challenge paths
with a real Web Audio stream and the shipped pitch detector. To keep headless
SwiftShader timing bounded it suppresses draw calls during navigation and audio
input, then restores the original WebGL methods and full 1024 by 768 canvas for
both recorded frames. The runtime manifest records HTTP 200, exact public/local
hash equality, `drawSuppressed: false`, `rasterMinimized: false`, the completed
encounter in saved progress, and zero page errors.

## Reproduce

Run the production phases from the repository root with Blender 5.2.2 LTS and
the recorded `manifold3d` 3.5.3 backend:

```sh
rtk proxy blender -b --factory-startup --python art/glass-adventure/v6-level2/celadon-production-v4/build_celadon_v4.py -- --phase prepare
rtk proxy blender -b --factory-startup --python art/glass-adventure/v6-level2/celadon-production-v4/build_celadon_v4.py -- --phase fracture
rtk proxy blender -b --factory-startup --python art/glass-adventure/v6-level2/celadon-production-v4/build_celadon_v4.py -- --phase validate
rtk proxy blender -b --factory-startup --python art/glass-adventure/v6-level2/celadon-production-v4/build_celadon_v4.py -- --phase render
rtk proxy blender -b --factory-startup --python art/glass-adventure/v6-level2/celadon-production-v4/build_celadon_v4.py -- --phase compare
```

The fracture validation report records the exact tool versions, script hashes,
commands, source receipts, and the fact that this production pass made no new
paid provider request.
