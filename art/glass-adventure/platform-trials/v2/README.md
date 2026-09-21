# Cloudway platform kit v1

This directory is the editable and auditable source archive for The Glass
Ribbon platform kit. The frozen runtime bundle is
`apps/beside-cue/public/games/cloudway-v1/cloudway-platform-kit-v1.glb`.

## Frozen runtime contract

- Asset ID: `cloudway-platform-kit-v1`
- SHA-256: `05deefa049031550b3aa7897a6d7a3345718b2e10a7595a272ea513195bb9e3e`
- Size: 7,921,368 bytes
- Coordinates: metres, glTF +Y up, identity root transforms, root origin at
  the top-centre of the landing plane
- Landing skin and collider: 1.70m wide x 1.30m deep at y=0; box height
  0.24m, centre `[0, -0.12, 0]`
- Decorative shell: approximately 1.80m x 1.40m; flora, frames, finials,
  crystalline undersides, and the outer 5cm border are non-supporting
- Embedded textures: nine WebP PBR maps, all 1024 x 1024

The exact roots are `Cloudway_Marble`, `Cloudway_Frost`, `Cloudway_Glide`,
`Cloudway_Crackle_Intact`, `Cloudway_Crackle_Warning`, and
`Cloudway_Crackle_Release`. Triangle counts are 7,741, 7,845, 7,964, 2,472,
2,616, and 308 respectively. Release contains six independently pivoted,
closed, consistently outward-wound shard volumes.

The machine-readable runtime contract and full visual bounds live in
`exports/manifest.json` and the public `manifest.json`. The final fresh-import
evidence, including directed-edge and signed-volume checks for every shard,
lives in `proofs/cloudway-platform-kit-validation.json`.

## Archive map

- `../v1/concepts/`: approved master concept sheets
- `guides/`: isolated image-to-3D guides derived from the approved concepts
- `prompts/`: exact image and Meshy prompts
- `meshy/`: original full-quality donors, pre-remesh GLBs, runtime remeshes,
  PBR maps, task IDs, safe receipts, hashes, and credit ledger
- `sources/cloudway-platform-kit-v1.blend`: packed editable Blender source;
  SHA-256 `00c5206c427965a39867de14467b485b1b10feda71bdd0601a9d4b0db14cf732`
- `sources/runtime-textures/`: external copies of the packed 1K runtime maps
- `exports/cloudway-platform-kit-v1-blender.glb`: uncompressed Blender export;
  SHA-256 `5239cdc15c9ff3fe2ebef0257f622cd88c5d49b23924ca64a5dc37b13d2291bd`
- `exports/cloudway-platform-kit-v1.glb`: optimized runtime source, byte-identical
  to the public GLB
- `proofs/cloudway-platform-kit-final-glb.png`: optimized-family render;
  SHA-256 `9dbc295af712ed390cae4f3db5a341e12cccc06caf27e3adbcbd2e621154ac3c`
- `proofs/cloudway-platform-kit-final-crackle.png`: optimized crackle-state render;
  SHA-256 `ee6723aaf3432b8e6702a78c480bfa5b4b9a48d9afd27cb96c8906cec5ae5cda`

`cloudway-ribbon-preview.webp` is a wide derivative of the approved Cloudway
route concept. It is card art, not a gameplay screenshot. The two `final-*`
PNG files above are actual Blender renders of the optimized GLB.

Meshy used 90 credits for the three original textured image-to-3D donors and
15 credits for their runtime remeshes: 105 credits total. The final checked
balance was 3,895. No API keys, authorization headers, or signed artifact URLs
are stored here.

## Rebuild and verify

Run these commands from the repository root in order:

```sh
rtk node art/glass-adventure/platform-trials/v2/production/build_preview.mjs
rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v2/production/build_platform_kit.py
rtk bash art/glass-adventure/platform-trials/v2/production/optimize_platform_kit.sh
rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v2/production/validate_platform_kit.py
```

The optimizer runs deduplication, pruning, welding, MikkTSpace tangent
generation, `repair_invalid_tangents.py`, bounded WebP compression, and the
Khronos validator before it copies the GLB to the public directory. The final
validator then reimports that optimized GLB in a clean Blender process, checks
node transforms, bounds, colliders, normals and shard topology, renders the
proofs, and writes both manifests.

Acute-triangle bevel modifiers can push a fragment beyond its authored landing
footprint. The release shards therefore use an exact full-size top ring and a
chamfer entirely below y=0. For fracture meshes, edge incidence alone is not a
sufficient closure test: validate opposite directed-edge traversal and a
positive signed volume as well.
