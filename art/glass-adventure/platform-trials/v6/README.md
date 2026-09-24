# Frost and Glide V6 fitted derivatives

Status: **accepted and integrated runtime delivery**. The 4K GLBs remain
dev/audition masters. The measured 2K WebP plus `KHR_mesh_quantization` Frost
and Glide deliveries now ship inside one combined runtime kit with the
unchanged V3 Marble and Crackle roots. The V3 archive remains intact.

The V5 Meshy 7.1 donors were uniformly fitted to a 1.80 m visual width, centred,
and aligned to their sampled landing plane. Their topology, proportions, relief,
UVs, and 4K provider base/normal maps remain intact in the masters. Separate
bevelled glass/ice geometry completes the shallow donor footprint to the exact
1.70 x 1.30 m landing envelope; a raised opaque-gold perimeter makes that added
area read as a deliberate landing frame. No donor was flattened, decimated, or
non-uniformly stretched.

## Accepted artifacts

| Asset | 4K dev master                                                                                                                                                    | Packed authoring project                                                                                                                           | 2K delivery candidate                                                                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frost | [`cloudway-frost-v6-derivative.glb`](exports/cloudway-frost-v6-derivative.glb), 76,266,516 B, `fcf290ba39b78e5f8f58344eb63e2f16d6fb8632be554cebd59abbb7ecdefd77` | [`frost-v6-derivative.blend`](sources/frost-v6-derivative.blend), 80,488,630 B, `31fba88e6315aa1cdaed378be1ccce312b54562abc6744a5abc7f64898e86725` | [`cloudway-frost-v6-delivery-2k.glb`](exports/delivery/cloudway-frost-v6-delivery-2k.glb), 26,829,112 B, `6a63fb71fc80319e13a8d783c0bb7788216615aefbb6690f28c3df7f6c72e0a0` |
| Glide | [`cloudway-glide-v6-derivative.glb`](exports/cloudway-glide-v6-derivative.glb), 52,829,172 B, `a4c7008e133a7b6162ea223c955323a441592e43d214cb8d5c3bed4cde626915` | [`glide-v6-derivative.blend`](sources/glide-v6-derivative.blend), 52,707,372 B, `0852f97cc6640bf1ef08f2f4d61bd8bc78f3f12020ec827ec4f569583b79cba8` | [`cloudway-glide-v6-delivery-2k.glb`](exports/delivery/cloudway-glide-v6-delivery-2k.glb), 12,889,480 B, `68eefd6f006a0d2b0d6c8fdad658974432a8fb2bf936b9830904be8d50e50a23` |

The two delivery GLBs total 39,718,592 bytes, down 69.23% from the
129,095,688-byte masters. At gzip level 9 they total 32,423,135 bytes. This is
transfer packaging, not GPU texture compression: the audit estimates
201,326,576 bytes for both assets' decoded RGBA mip chains and 19,604,976 bytes
for their quantized geometry accessors. Device performance remains a root
integration check. KTX2 would lower texture memory, but the current loader does
not configure a `KTX2Loader`.

## Review evidence

The V5-to-V6 clay and PBR comparisons use the same 1.80 m width, camera, and
lighting. They establish that the dense donor relief and silhouette survive the
fit while the added frame closes the landing envelope.

| Asset | Clay                                                                                                                           | PBR                                                                                                                          | Review record                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Frost | [front](proofs/comparisons/frost-v5-v6-clay-front.png), [three-quarter](proofs/comparisons/frost-v5-v6-clay-three-quarter.png) | [front](proofs/comparisons/frost-v5-v6-pbr-front.png), [three-quarter](proofs/comparisons/frost-v5-v6-pbr-three-quarter.png) | [`frost-v6-comparison.json`](proofs/diagnostics/frost-v6-comparison.json) |
| Glide | [front](proofs/comparisons/glide-v5-v6-clay-front.png), [three-quarter](proofs/comparisons/glide-v5-v6-clay-three-quarter.png) | [front](proofs/comparisons/glide-v5-v6-pbr-front.png), [three-quarter](proofs/comparisons/glide-v5-v6-pbr-three-quarter.png) | [`glide-v6-comparison.json`](proofs/diagnostics/glide-v6-comparison.json) |

The final master-to-delivery proofs use the runtime's 48-degree exploration FOV
and its portrait-distance envelope. Frost's cyan frame and Glide's emerald frame
remain continuous under the gold perimeter at gameplay scale; neither reads as
a clipped donor. The delivery halves retain the master detail with 46.941 dB
and 49.2583 dB rendered-image PSNR respectively.

| Asset | Gameplay proof                                                                                | SHA-256                                                            | Decision record                                                                                         |
| ----- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Frost | [`frost-master-delivery-gameplay.png`](proofs/comparisons/frost-master-delivery-gameplay.png) | `31febe061b4a30c52f1e373bbf48d455ed46f5b9b76672d051b70b626fb5a947` | [`frost-delivery-gameplay-comparison.json`](proofs/diagnostics/frost-delivery-gameplay-comparison.json) |
| Glide | [`glide-master-delivery-gameplay.png`](proofs/comparisons/glide-master-delivery-gameplay.png) | `e222b9988c6f5ceaeed4d46cf5cd8d6288dd5fa26fe512823cebc548bc9a9d74` | [`glide-delivery-gameplay-comparison.json`](proofs/diagnostics/glide-delivery-gameplay-comparison.json) |

## Measured delivery fidelity

[`delivery-candidate-audit.json`](proofs/diagnostics/delivery-candidate-audit.json)
fresh-imports each master and delivery GLB and compares every mesh in world
space. It also decodes each embedded image and compares it with a Lanczos-matched
master reference.

| Measure                     |             Frost |             Glide |
| --------------------------- | ----------------: | ----------------: |
| Total triangles             |           634,512 |           147,250 |
| Triangle indices            | exactly preserved | exactly preserved |
| Maximum position delta      |     0.000023669 m |     0.000023344 m |
| RMS position delta          |     0.000013706 m |     0.000013670 m |
| Maximum corner-normal delta |  0.490794 degrees |  0.229943 degrees |
| RMS corner-normal delta     |  0.002878 degrees |  0.003095 degrees |
| Maximum UV delta            |       0.000007629 |       0.000007629 |
| 4K-to-2K base-colour PSNR   |        51.3604 dB |        51.5377 dB |
| 4K-to-2K normal-map PSNR    |        52.5587 dB |        52.8447 dB |

The three invalid corner normals present in Glide's master import become valid
in the quantized delivery import; the delivery introduces no invalid normals.
Both exact landing boundaries remain within 0.000007 m of the 1.70 x 1.30 m
contract, and the landing-extension top remains within 0.000006 m of Y=0 after
glTF export.

The Khronos validator reports zero errors and zero warnings for both delivery
files. Its remaining messages are informational unused-tangent/UV notices on
plain gold meshes:

- [`cloudway-frost-v6-delivery-2k-validator.txt`](exports/delivery/cloudway-frost-v6-delivery-2k-validator.txt)
- [`cloudway-glide-v6-delivery-2k-validator.txt`](exports/delivery/cloudway-glide-v6-delivery-2k-validator.txt)

The packed-project reopen audit confirms all seven source images per asset are
packed, the dense donor topology hashes are unchanged, every material exists,
and opening the projects does not mutate them:
[`packed-source-audit.json`](proofs/diagnostics/packed-source-audit.json).

## Runtime packaging decision

The museum path constructs a plain `GLTFLoader` in
[`asset-kit.ts`](../../../../packages/glass-game/src/render/asset-kit.ts#L58). The
installed Three 0.185.1 loader natively lists `KHR_mesh_quantization` and
`EXT_texture_webp`, while KTX2 and Meshopt each require an explicitly configured
loader or decoder. The repository's existing asset notes also select
`KHR_mesh_quantization` because Meshopt would require a WASM decoder and the CSP
change documented in
[`assets-glass.sh`](../../../../apps/beside-cue/scripts/assets-glass.sh#L6).

For that reason the delivery pipeline uses:

1. Lanczos resize with a 2048-pixel maximum dimension.
2. WebP quality 92, near-lossless mode, effort 90.
3. Accessor deduplication and removal of unreferenced data.
4. Per-mesh 16-bit position, normal, tangent, and UV quantization.
5. No KTX2, Meshopt, Draco, vertex welding, or triangle reduction.

[`delivery-browser-loader-smoke.json`](proofs/diagnostics/delivery-browser-loader-smoke.json)
records an actual Headless Chromium 148 load through the repository Three
0.185.1 `GLTFLoader`, with no KTX2, Meshopt, or Draco decoder configured. It
decoded all twelve WebP images as `ImageBitmap`, found the exact roots and
triangle counts, and recovered both transmissive and metallic materials without
console or page errors.

## Integrated runtime kit

The superseded combined runtime is preserved exactly at
[`cloudway-platform-kit-v6.glb`](runtime/archive/cloudway-platform-kit-v6.glb):
44,046,324 bytes, 36,090,287 bytes at gzip level 9, SHA-256
`1c18c7a5e818346551fdadef6a091b848f19d0242092a14bf366d85a90b7930c`.
The authored logical ID remains `cloudway-platform-kit-v1`, so levels and
renderer contracts do not change. Its
[`manifest.json`](runtime/archive/manifest.json)
records the exact source hashes and the six direct roots. V7 now supplies the
public runtime; V6 remains a pinned production input under this archive.

[`build_runtime_kit.mjs`](production/build_runtime_kit.mjs) removes only the V3
Frost and Glide roots and their now-unused resources, imports the accepted V6
deliveries, preserves the four V3 Marble and Crackle roots byte-for-byte at the
gltf-transform document level, and writes the combined GLB atomically. It does
not weld, simplify, decimate, or introduce a decoder-bound extension. Every
root keeps the exact 1.70 x 1.30 m, 0.24 m-deep collider contract with top Y=0.

[`cloudway-platform-kit-v6-audit.json`](proofs/runtime/cloudway-platform-kit-v6-audit.json)
fresh-imports all three inputs and the archived combined output. It verifies the manifest
hash, six roots, all geometry/material/texture records, 634,512 Frost triangles,
147,250 Glide triangles, the full base/normal/metallic-roughness/transmission
maps, and removal of the old Frost/Glide atlases. The 15 runtime textures are an
estimated 234,881,004 decoded RGBA mip bytes (224.0 MiB) before driver overhead:
201,326,576 bytes belong to the two V6 deliveries and 33,554,428 bytes to the
preserved V3 Marble maps. WebP reduces transfer size; it does not reduce this
decoded texture allocation.

The combined Khronos validation has zero errors and one warning. The warning is
the preserved V3 Marble primitive's missing authored tangent space; the same
root and warning exist in the V3 source, while replacing Frost and Glide removes
their two equivalent V3 warnings. The remaining notices are informational
unused tangent/UV attributes on plain gold pieces. The full output is
[`cloudway-platform-kit-v6-validator.txt`](proofs/runtime/cloudway-platform-kit-v6-validator.txt).

The browser proof loads the exact public hash through the real Beside Cue game,
observes actual `drawElementsInstanced` calls, and uses keyboard input to land
on both Frost pieces, restore at the Frost rest, board the moving Glide collider,
ride its 1.9 m translation, and jump to the east rest. A second browser check
uses the repository's plain Three 0.185.1 `GLTFLoader` and verifies the PBR maps
and root colliders without KTX2, Meshopt, or Draco configuration. Render review
uses the game's 48-degree exploration FOV:

- [route overview](proofs/runtime/cloudway-v6-route-overview.png)
- [Frost gameplay close view](proofs/runtime/cloudway-v6-frost-gameplay-close.png)
- [Frost recovery rest](proofs/runtime/cloudway-v6-frost-recovery.png)
- [Glide gameplay close view](proofs/runtime/cloudway-v6-glide-gameplay-close.png)
- [Glide east-rest landing](proofs/runtime/cloudway-v6-glide-crossed.png)

The fitted gold boundaries remain legible through the sky fog, do not cover the
landing read, and align visually with the unchanged collision plane. The
renderer continues to instance repeated donor submeshes; no runtime material
override replaces the authored V6 maps.

## Reproduction

Every potentially long operation is bounded by an outer timeout. No Meshy call
is part of this V6 derivative or packaging pipeline.

```bash
rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v6/production/audit_packed_sources.py
rtk proxy timeout 3600 bash art/glass-adventure/platform-trials/v6/production/package_delivery_candidates.sh
rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v6/production/audit_delivery_candidates.py
rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v6/production/render_delivery_comparison.py -- --asset frost
rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v6/production/render_delivery_comparison.py -- --asset glide
rtk proxy timeout 300 node art/glass-adventure/platform-trials/v6/production/smoke_delivery_loader.mjs
rtk timeout 300 node art/glass-adventure/platform-trials/v6/production/build_runtime_kit.mjs
rtk timeout 300 node art/glass-adventure/platform-trials/v6/production/audit_runtime_kit.mjs
rtk timeout 900 env BESIDE_CUE_E2E_PORT=5904 pnpm --filter @irchiinnuss/beside-cue-app exec playwright test -c playwright.config.ts glass-adventure-cloudway-v6.e2e.ts --project=chromium-adventure
```

The build reports, source inspection, texture-mask diagnostics, and command
records live under [`proofs/diagnostics`](proofs/diagnostics). The combined
runtime audit, validator output, and real-game captures live under
[`proofs/runtime`](proofs/runtime).
