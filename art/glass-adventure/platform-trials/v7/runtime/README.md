# Accepted Cloudway runtime kit

The installed kit combines the unchanged V6 Frost/Glide and V3 Crackle roots
with source-preserved V7 Marble and reviewed 1K marble maps. Its logical asset
ID, six root names and landing/collider envelope stay stable.

The accepted single-file master is retained outside `public/` at
`master/cloudway-platform-kit-v7.glb`: 77,414,948 bytes, SHA-256
`0f7a2129e7cd23b4148605a46d12fe28361d9ba632bea5d81d92142922fffee9`.
The public delivery is standard glTF with four external binary buffers:

| Public file                            |      Bytes | SHA-256                                                            |
| -------------------------------------- | ---------: | ------------------------------------------------------------------ |
| `cloudway-platform-kit-v7.gltf`        |     60,583 | `5383673777e743da7922f5d5c406bece3da51445b3a7b31e3a6b77fecd1434d1` |
| `cloudway-platform-kit-v7-part-01.bin` | 24,483,552 | `fe5bd4f0133834960c7185f7e864cfc7fbba0ad1142583f5e53148d6e33585a9` |
| `cloudway-platform-kit-v7-part-02.bin` | 11,976,384 | `f360bf1525c8a5f95f0bce849320ae0bf5ad145ece2b9f39f2e11034a3affb96` |
| `cloudway-platform-kit-v7-part-03.bin` | 23,520,812 | `b6655790c58fd7b56c60fa39e5992f469ff184f972241e3d3d05a523840fd4fe` |
| `cloudway-platform-kit-v7-part-04.bin` | 17,393,098 | `d01d8ef9e49488946d7d08face07a323d029ec3ff52bdf682f30fe61655cd065` |

The 77,434,429-byte public transfer keeps each file below 24 MiB. Packaging
copies all 49 accepted buffer views byte for byte and changes only their buffer
URI and byte offset. It does not decimate, compress, quantize or re-encode
geometry or textures, and the existing plain Three.js `GLTFLoader` needs no new
decoder. The decoded cost remains 2,041,018 unique triangles and 257.24 MiB of
geometry plus mipmapped textures before renderer and driver overhead.

Actual rendered comparisons and submission receipts are in `proofs/browser/`.
See the [integration, costs and test ledger](../../../plans/CLOUDWAY-V7-RUNTIME-INTEGRATION-2026-09-24.md).

## Reproduce the accepted delivery

Run from the repository root with installed dependencies:

```sh
rtk proxy timeout 900 node art/glass-adventure/platform-trials/v7/runtime/production/build_runtime_kit.mjs
rtk proxy timeout 180 node art/glass-adventure/platform-trials/v7/runtime/production/package_external_delivery.mjs
rtk proxy timeout 180 node art/glass-adventure/platform-trials/v7/runtime/production/audit_runtime_kit.mjs
rtk proxy timeout 60 node --test art/glass-adventure/platform-trials/v7/runtime/production/test_runtime_build_guards.mjs art/glass-adventure/platform-trials/v7/runtime/production/test_external_gltf_delivery.mjs
```

`production/accepted-inputs.json` pins the archived V6 kit and manifest, V7 raw
and 2K delivery sources, glTF Transform 4.4.2, and the accepted 1K master. The
master builder verifies those inputs, builds in a fresh temporary directory,
checks a fresh import, colliders, topology and Khronos validation, then checks
the accepted output hash before atomic promotion into `runtime/master/`. It
never targets `public/` or removes an output directory.

`production/accepted-delivery.json` pins the public glTF, every external buffer,
the public manifest and all 49 source-to-part buffer-view hashes. The delivery
packager validates a complete temporary candidate before staging files and
promotes the manifest last. If the obsolete public GLB exists, it must match the
accepted master receipt before removal. An already matching artifact is not
rewritten.

`CLOUDWAY_V7_OUTPUT_DIR` selects a separate master-build destination.
`CLOUDWAY_V7_PUBLIC_DIR` selects a separate delivery destination after the
candidate still matches the accepted receipt. A new resolution, source or
buffer layout is a new candidate requiring explicit review and a new receipt.

The public V6 duplicate remains removed. Its exact GLB and manifest are retained
under `platform-trials/v6/runtime/archive/`. Physical-tablet acceptance remains
separate from structural validation and desktop visual proof.
