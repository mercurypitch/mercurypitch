# Attribute-only export repairs

The first whole-runtime GLB audit found eight real export defects. Seven vessel
bundles contained zero-length tangent vectors on glass/gold materials that use
no normal map. The original platform ramp had no UV stream and its ivory material
referenced UV set `-1`. These defects are independent of the previously observed
cross-site Chrome/GPU corruption; no causal claim is made about that incident.

`sources/` preserves all eight original files. `reports/` records every changed
primitive, protected-stream assertion, source/delivery hash and validator output.
All eight deliveries pass Khronos validation with zero errors. Versioned runtime
URLs prevent a cached old GLB being mistaken for the repaired export.

The repair removes only unused tangent attributes/accessors from materials with
no normal maps. Existing vertex positions, normals, UVs, colours, triangle index
streams and scene transforms remain byte-identical. Orphaned binary spans remain
in the file deliberately; they are not loaded as geometry. The ramp receives
metre-scale UVs from its dominant face normal, and the invalid material reference
becomes UV0. The original Blender builder now creates those ramp UVs as well.

The four V3 vessels still have exactly the same 23 shards and complete assembled
bounds. Fresh `prepareExhibitAsset` measurements show 26,800,740 attribute/index
bytes, down from 36,739,700, without removing a triangle. These figures exclude
textures, temporary loader buffers and complete GPU/CPU residency.

## Reproduce

From the repository root:

```sh
python3 art/glass-adventure/production/repair_current_assets.py
pnpm --filter @irchiinnuss/glass-game exec vitest run src/render/exhibit-asset.test.ts src/render/catalog.test.ts src/browser/assets.test.ts
```

The batch replays the immutable input-to-output map, verifies the source hashes,
and checks that rebuilt output hashes equal the accepted receipts. A changed
Blender export requires a new reviewed receipt/version; do not overwrite these
sources or remove a tangent from a normal-mapped material. Follow the reusable
`game-asset-production` skill and validate every fresh GLB before changing the
runtime manifest.
