# Accepted Cloudway runtime kit

The installed kit combines the unchanged V6 Frost/Glide and V3 Crackle roots
with source-preserved V7 Marble and reviewed 1K marble maps. Its logical asset
ID, six root names and landing/collider envelope stay stable.

The accepted single-file master is retained outside `public/` at
`master/cloudway-platform-kit-v7.glb`: 77,414,948 bytes, SHA-256
`0f7a2129e7cd23b4148605a46d12fe28361d9ba632bea5d81d92142922fffee9`.
The public delivery is standard glTF with three external binary buffers,
compressed losslessly with `EXT_meshopt_compression` (PR #1275):

| Public file                                    |      Bytes | SHA-256                                                            |
| ---------------------------------------------- | ---------: | ------------------------------------------------------------------ |
| `cloudway-platform-kit-v7-meshopt.gltf`        |     76,306 | `af2688533c7e5b70b741054dd40e70a7f9bf055322265c1c502bcbdd904f5403` |
| `cloudway-platform-kit-v7-meshopt-part-01.bin` | 21,251,392 | `86a06e960594cdf80124e83808b49818c7f4c63da8ec1e20d36dee5e56f88030` |
| `cloudway-platform-kit-v7-meshopt-part-02.bin` | 23,932,821 | `83e66a81457a23f8ee5bbc481a57bdf393aace8e36764e7709692354cea86564` |
| `cloudway-platform-kit-v7-meshopt-part-03.bin` | 10,798,802 | `a899d6541071f633fa99dad2690162419392b07c6a92e85fc81aae287d0fce07` |

The 56,059,321-byte public transfer keeps each file below 24 MiB. Vertex views
use Meshopt ATTRIBUTES mode and index views use INDICES mode, with no
quantization or filters, so every accessor decodes to the master's bytes in the
same order. Textures were already WebP and are unchanged. The game loads it with
Three.js `GLTFLoader` plus `MeshoptDecoder`. The decoded cost remains 2,041,018
unique triangles and 257.24 MiB of geometry plus mipmapped textures before
renderer and driver overhead.

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

Delivery has two steps. `package_external_delivery.mjs` makes the first: the
master as glTF with four external buffers that copy all 49 buffer views byte for
byte. `production/accepted-delivery.json` pins that glTF, every buffer, its
manifest and all 49 source-to-part buffer-view hashes. The packager validates a
complete temporary candidate, checks it against that receipt and writes it to
the gitignored `runtime/external-delivery/` folder. It refuses any destination
under `apps/beside-cue/public`, because those files would replace the shipped
Meshopt delivery. The second step is the lossless Meshopt re-encode from PR
#1275, whose input and output hashes are in the `losslessReencode` block of the
public `manifest.json`. The packager's output matches that block's `from` files.

`audit_runtime_kit.mjs` and `test_external_gltf_delivery.mjs` decode the shipped
Meshopt files (`production/meshopt_delivery.mjs`) and check them against the
master: every decoded accessor and texture image byte for byte, the glTF JSON
outside storage, `EXT_meshopt_compression` as the only added extension, and
every part at or below 24 MiB.

`CLOUDWAY_V7_OUTPUT_DIR` selects a separate master-build destination.
`CLOUDWAY_V7_DELIVERY_DIR` selects a separate first-step delivery destination,
outside `apps/beside-cue/public`. A new resolution, source or buffer layout is a
new candidate requiring explicit review and a new receipt.

The public V6 duplicate remains removed. Its exact GLB and manifest are retained
under `platform-trials/v6/runtime/archive/`. Physical-tablet acceptance remains
separate from structural validation and desktop visual proof.
