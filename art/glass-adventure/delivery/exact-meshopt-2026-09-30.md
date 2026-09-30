# Exact Meshopt delivery — 2026-09-30

Eight existing runtime GLBs now use lossless `EXT_meshopt_compression`. The
reviewed decoded geometry, index order, normals, UVs, material assignments,
node transforms, optical values, bounds, fracture pieces and source masters
are unchanged. This reduces transfer and APK storage; it does not reduce
decoded geometry memory, GPU memory, triangle counts or draw calls.

## Runtime receipts

Paths below are relative to `apps/beside-cue/public/games/`. The before hashes
identify the reviewed uncompressed runtime exports; after hashes identify the
exact files copied into the game.

| Runtime path                                          | Before bytes | After bytes | Before SHA-256                                                     | After SHA-256                                                      |
| ----------------------------------------------------- | -----------: | ----------: | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `resonance/assets/resonance-rosebud-v1.glb`           |    5,766,196 |   4,257,288 | `f21d1b9de8651f2de19ead98acc886571453d7d8fb3db50fc7d913c7c1efa23c` | `1cc56be7bf247a4217898a2ea8a3071c76d518eb005efdb264bc6802ba559741` |
| `adventure-v3/moon-amphora-qa-v2.glb`                 |   11,456,580 |   5,776,264 | `d940811b0981b3b3822e15baaf8c484cfa7ea1748f5b1db5aa6f3744460668fc` | `3888614adc96dc1b7f671c7d03a47d42b092726b866923210caf3ea89f027cb8` |
| `adventure-v3/fluted-carafe-qa-v2.glb`                |    9,117,212 |   4,278,408 | `8e02ae9eb0ce64a7af5f2943ba3f13f1591e16afa2fc40abf58c4c150d6d9b8d` | `0237482230eb757bbdea50cdc4206193a190818da1d71a13d9e9dd996a99d001` |
| `adventure-v3/aurora-coupe-qa-v2.glb`                 |    7,213,496 |   3,707,060 | `2df31a3d30ccd43d10fbb2e77dd03ef4743f7dc0644397a6a6fdd2317f7b075f` | `6831b6f79d84abf3178e88ba8a4dd154ef7047434345010679ab8505a21cf198` |
| `adventure-v3/cut-crystal-decanter-qa-v2.glb`         |    8,259,824 |   3,715,732 | `3681f6707c08bec07eb555c6865aac4f15dc6dd30ee3c3adb1aeb3f98e4de07b` | `3a220f7f9bbebc7b4f8fdd9d380d13d27578f5d7773c39578478ec36bce57e19` |
| `adventure-v2/vessels-qa-v2.glb`                      |    3,378,428 |   1,818,936 | `6b04ecf14ef27b8610d3ee7e37980bb6cda0d0427ce89fc7d691a9827c936393` | `1e937bbddb0ffe6278869f2fd0f31cfcd1d1a4b3ada79bf4028ac75ed783c88c` |
| `crystal-interiors-v2/living-crystal-platform-v2.glb` |      847,764 |     461,664 | `aa4febb3ccf8a1e9ab842263a14af9f923e279e0c8e317ac662f5d73a775643b` | `a0b0c2b8b0186129bbefffef5fb4b935ab20944de20097745d20707225b03c70` |
| `adventure/vessels.glb`                               |      442,928 |     353,292 | `ab521342177578aeb8aa13932ded620790203946f1c32d6f267bb094a4077f71` | `47a031457340938a5f2c71aad3146b3665f0955710be3dcf060afc0831cf5abd` |

The raw GLB reduction is **22,113,784 bytes**. Current manifest totals are
37,883,292 bytes for `adventure-v3` and 27,642,985 bytes for `adventure-v2`.
The Rosebud keeps 96,736 intact triangles and 115,850 fracture triangles; the
Living Crystal platform keeps 32,336 triangles. Merc is excluded.

## Production and equivalence

The producer encodes original buffer-view bytes with Meshopt format version 0,
filter `NONE` and index mode `INDICES`. It performs no quantization,
simplification, vertex reorder, index rotation, transform bake or material
rewrite. Every compressed view is decoded and compared byte-for-byte before
the candidate is written. Unreferenced buffer views may be omitted.

The independent prover normalizes all buffer-view references through the
source-to-candidate mapping, compares the remaining JSON and extension sets,
then checks every decoded view and accessor. It also compares the actual
Three.js GLTFLoader geometry, transforms, material assignments, animation and
skeleton output. All eight expanded proofs passed. These eight bundles have
no embedded images, skins or animations.

The runtime asset adapter already loads Three.js’s Meshopt decoder lazily.
The direct asset tests now supply that same decoder. Existing geometry,
closed-fragment, material-optics and resource-ownership assertions remain.
The v2 bundle has direct coverage for both its vase and goblet fractures.

Focused verification command:

```sh
rtk proxy pnpm --filter @irchiinnuss/glass-game exec vitest run src/render/resonance-rosebud-asset.test.ts src/render/asset-kit-exhibit-leases.test.ts src/render/exhibit-asset.test.ts src/render/living-crystal-platform-asset.test.ts src/browser/assets.test.ts
```

A real renderer smoke and final native packaging are verified separately by
the integration task. This receipt does not claim physical-device frame-time
acceptance or a signed release artifact.

## APK measurement

The preserved analysis replaced the eight entries in an existing release APK
using Info-ZIP deflate level 9. Baseline: 355,834,191 bytes; candidate:
348,355,528 bytes; saving: **7,478,663 bytes**. The candidate has **8,160,312
bytes** of headroom below the 340 MiB cap. This analysis APK is unsigned. The
1,145 untouched entries retain their original sizes, compression metadata
and CRCs. Every replacement payload was independently compared with its
candidate file.

## Preserved source and audit locations

The owner’s private creative archive holds all eight candidates, individual
production/proof JSON files, `expanded-proof-summary.json`,
`apk-replacements.json`, `apk-measurement.json` and the audit README:

```text
/home/maff/Documents/root/5-Creative/besidecue/assets/glass-adventure/glassware-audition-v1/delivery-audit-2026-09-30
```

The reproducible producer, prover and APK measurement scripts are preserved at:

```text
/home/maff/.dotfiles/personal/besidecue/glass-adventure/glassware-audition-v1/production/delivery
```

Receipt/tool hashes at integration:

| File                          | SHA-256                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `expanded-proof-summary.json` | `9334c85b5843197152603414d7d8895f5c77247bc24ba1dc4a5fcc7f24a89545` |
| `apk-replacements.json`       | `4e0f10d9431dceec1b8156ebaba333ff3c81280892fbc81a43d4ca669e7cd160` |
| `apk-measurement.json`        | `bbb7562f6c2701a7f6302b7ac1393a2a5a87485de170dad948b6dce801959647` |
| `exact-meshopt.mjs`           | `833894f970f288eba234393f7012eb8d0ff4a3f0217bca0d11278129d7f065e8` |
| `prove-exact-meshopt.mjs`     | `433a3e397fd3ded6022ab39a3a407ea0e49eb9f2f80d6c59ad8ddd6468cab24b` |
| `measure-apk-replacements.py` | `edb52ca6ccf7d07de6b95cb5bb0ac47905e586c57951df913ca0acb43e2cb299` |
