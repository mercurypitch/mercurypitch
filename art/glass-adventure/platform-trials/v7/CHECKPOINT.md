# V7 production checkpoint

## 2026-09-24 — exact dense quality baseline passed

- Immutable donor SHA-256 verified:
  `fa4d01900561e257be18c7190ef893aa789f178d1d4ccd13c2da22427d1033bb`.
- Exact donor topology retained: 702,537 authoring vertices and 1,256,556
  triangles. The envelope fit preserves the triangle-index SHA-256
  `23039e153bc1bf97eaf0bb605bf6ca80ae729a1a4f15c0cdf8d7557c65f90d96`.
- Matched neutral-clay proofs are pixel-identical in all five views.
- Matched 4K-provider versus 2K-delivery PBR proofs preserve silhouette and
  material identity at front, three-quarter, gameplay, top, and side cameras.
- Delivery SHA-256:
  `6d87455f6ccc901595dc00db0ca400c36ba643bfd1fdb12206a6a43a416bc030`.
- Delivery is 44,277,888 bytes; Khronos validation reports no errors or
  warnings; required extensions are `EXT_texture_webp` and
  `KHR_mesh_quantization` only.
- Quantization maximum fresh-import vertex error is 0.023745 mm; maximum bounds
  drift is 0.005067 mm. Triangle count and index ordering are unchanged.
- Repository Three r185 loaded the delivery in headless Chromium with one mesh,
  three decoded 2048 × 2048 WebP maps, the opaque marble material, and no
  configured KTX2, Draco, or meshopt decoder.
- Measured delivery cost is 30.47 MiB geometry plus 64 MiB mipped decoded
  textures, 94.47 MiB combined. The result remains review-only and uninstalled.
- No provider call, runtime/public mutation, commit, push, merge, or deploy
  occurred.

The authored full-shell reconstruction was rejected before any material bake
because it displaced source arches and damaged corner/fascia continuity. Any
future reduction must isolate only strictly interior flat patches and must beat
this exact-source baseline in matched proof; it may not alter source arches,
corner faces, ornaments, or foliage.
