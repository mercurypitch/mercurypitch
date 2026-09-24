# Frost and Glide V6 derivative checkpoint

Scope: prepare reviewable Frost and Glide derivatives from the accepted V5
Meshy 7.1 dense donors. This directory does not alter the public platform kit,
runtime catalog, collision code, route, checkpoints, or V3 archive.

## Constraints carried into production

- Raw V5 GLBs, textures, receipts, and packed source-review projects are immutable.
- Preserve donor proportions and surface relief. Do not contact-flatten or run a
  whole-shell collapse/decimation pass.
- The authoritative landing envelope is 1.70 x 1.30 metres with its top at Y=0
  after glTF export. Decorative geometry may retain the established 1.80 x 1.40
  metre V3 visual envelope.
- Complete the shallow source depth with authored non-overlapping glass/ice
  geometry around the donor. Collision remains a separate simple box contract.
- Separate transmissive glass/ice from opaque metallic gold with an explicit
  texture mask derived from the aligned provider base-colour and metallic maps.
- Acceptance requires matched clay and PBR views, packed Blender projects,
  fresh-import checks, exact hashes, and a written visual decision.

## Checkpoint 1 - source contract and shared preview

- Worktree: `feat/glass-museum-level-one`, clean before V6 creation.
- Existing no-HMR playtest: PID 3374996, port 5300, cwd is this worktree.
  It was inspected and left running unchanged.
- Blender: 5.2.2 LTS (`d13f752e3b9c`).
- Frost donor: 632,256 triangles, 46,738,536 bytes, SHA-256
  `5f1c6fe3ebafc293283841527392ffe0972b28b50bdaaba293bfaaeaa0bec67c`.
- Glide donor: 145,370 triangles, 30,284,496 bytes, SHA-256
  `394507ad969b53c88bf007edca9d4cc013adf3bab377c10dc3867a606276e36f`.
- V5 source proofs reviewed: the new donors have cleaner corners and broad
  surfaces than V3, but are 30.60% (Frost) and 40.21% (Glide) shallower at
  matched visual width. Both use one opaque fused material.

## Checkpoint 2 - fitted master production

- Frost master: 634,512 triangles, including all 632,256 donor triangles;
  76,266,516 bytes; SHA-256
  `fcf290ba39b78e5f8f58344eb63e2f16d6fb8632be554cebd59abbb7ecdefd77`.
- Glide master: 147,250 triangles, including all 145,370 donor triangles;
  52,829,172 bytes; SHA-256
  `a4c7008e133a7b6162ea223c955323a441592e43d214cb8d5c3bed4cde626915`.
- Donor triangle-index hashes remain exact. The only donor transform is uniform
  scale plus translation. Authored bevelled glass/ice and gold objects complete
  the 1.70 x 1.30 m landing envelope with its top at glTF Y=0.
- Both packed Blender projects reopen without mutation, contain all seven packed
  source/derived images, and pass topology, material, and landing-contract
  checks in `proofs/diagnostics/packed-source-audit.json`.

## Checkpoint 3 - matched master review

- Four matched images per asset cover clay/PBR and front/three-quarter views.
- Frost retains its snowflake engraving, bubbles, crystalline apron and gold
  corner cages; Glide retains its lunar inlay, water veining, crystalline
  underside and gold hardware.
- The cyan Frost and emerald Glide extensions read as flush glass landing
  frames under a continuous opaque-gold perimeter. Both comparison decisions
  are recorded as accepted.

## Checkpoint 4 - measured delivery packaging

- The runtime uses a plain Three `GLTFLoader`; its configured path supports
  `EXT_texture_webp` and `KHR_mesh_quantization` without another decoder. KTX2,
  Meshopt and Draco were therefore excluded.
- Frost 2K delivery: 26,829,112 bytes, SHA-256
  `6a63fb71fc80319e13a8d783c0bb7788216615aefbb6690f28c3df7f6c72e0a0`.
- Glide 2K delivery: 12,889,480 bytes, SHA-256
  `68eefd6f006a0d2b0d6c8fdad658974432a8fb2bf936b9830904be8d50e50a23`.
- Combined transfer size falls 69.23%, from 129,095,688 to 39,718,592 bytes.
  All 781,762 triangles and all triangle indices remain exact. Maximum measured
  position drift is 0.000023669 m and maximum UV drift is 0.000007629.
- Khronos validation reports zero errors and zero warnings for both delivery
  GLBs. A real Chromium 148 load through repository Three 0.185.1 decodes all
  WebP images, physical materials, roots and triangle counts without console or
  page errors.
- Matched 48-degree gameplay-distance proofs are accepted at 46.941 dB rendered
  PSNR for Frost and 49.2583 dB for Glide. The glass border remains deliberate
  and continuous at the runtime camera scale.

Final handoff: `README.md` lists exact artifacts, hashes, measurements, evidence
and bounded reproduction commands. Public assets and runtime integration remain
unchanged for root review.
