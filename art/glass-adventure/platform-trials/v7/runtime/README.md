# Accepted Cloudway runtime kit

The installed kit combines the unchanged V6 Frost/Glide and V3 Crackle roots
with source-preserved V7 Marble and reviewed 1K marble maps. Its logical asset
ID, six root names and landing/collider envelope stay stable.

- Public GLB: `apps/beside-cue/public/games/cloudway-v7/cloudway-platform-kit-v7.glb`.
- Exact SHA-256: `0f7a2129e7cd23b4148605a46d12fe28361d9ba632bea5d81d92142922fffee9`.
- 77,414,948 bytes; 2,041,018 unique triangles; 257.24 MiB estimated decoded
  geometry plus mipmapped textures before driver/renderer overhead.
- Actual rendered comparisons and submission receipts: `proofs/browser/`.
- [Integration, costs and test ledger](../../../plans/CLOUDWAY-V7-RUNTIME-INTEGRATION-2026-09-24.md).

## Reproduce the accepted delivery

Run from the repository root with installed dependencies:

```sh
rtk proxy timeout 900 node art/glass-adventure/platform-trials/v7/runtime/production/build_runtime_kit.mjs
rtk proxy timeout 180 node art/glass-adventure/platform-trials/v7/runtime/production/audit_runtime_kit.mjs
rtk proxy timeout 60 node --test art/glass-adventure/platform-trials/v7/runtime/production/test_runtime_build_guards.mjs
```

`production/accepted-inputs.json` pins the archived V6 kit and manifest, V7 raw
and 2K delivery sources, glTF Transform 4.4.2, and the accepted 1K runtime output.
The build verifies inputs before processing, builds in a fresh temporary folder,
checks a fresh import/colliders/topology and Khronos validation, then checks the
accepted output hash before atomic promotion. It never removes the output
directory. An already matching GLB is left untouched, including its inode and
modification time. Tests reject input/output drift without overwriting artifacts.

`CLOUDWAY_V7_OUTPUT_DIR` can select a separate destination for this exact accepted
kit. The historical 2K comparison is preserved as rendered evidence; only the
1K combined runtime is approved in the guarded output receipt. A new resolution
or source is a new candidate requiring explicit visual review and acceptance,
not a reason to silently rewrite the receipt. The standalone 2K marble baseline
and its original provider sources remain reproducible in the parent directory.

The public V6 duplicate has been removed; its exact GLB and manifest are retained
under `platform-trials/v6/runtime/archive/`. Current museum/tablet acceptance is
separate from structural validation and desktop visual proof.
