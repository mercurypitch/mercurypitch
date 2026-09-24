# Cloudway Frost and Glide Meshy 7.1 Ultra 4K source auditions

Status: **ACCEPTED AS DENSE SOURCE DONORS WITH LIMITATIONS; NOT INTEGRATED**.
The owner explicitly confirmed both guide uploads. Both 35-credit jobs succeeded,
and their complete original GLBs, PBR maps and packed Blender review scenes are
preserved here. No replacement has been installed in the game.

| Source | Task ID                                | Triangles |     Original GLB |     Charge |
| ------ | -------------------------------------- | --------: | ---------------: | ---------: |
| Frost  | `01a0d008-eb11-7661-bca6-4fb4f1986fff` |   632,256 | 46,738,536 bytes | 35 credits |
| Glide  | `01a0d009-7173-7142-8f57-0c4c8be24adf` |   145,370 | 30,284,496 bytes | 35 credits |

Both requests explicitly pin Meshy 7.1 and Ultra 4K geometry. The provider confirms
`geometry_resolution: 4k` but does not echo the model version. Actual base-colour
and normal maps are 4096 square; metallic and roughness maps are 2048 square.
Total charge is 70 credits; balance after archiving is 3,725. Download retries
did not create additional generation jobs.

The first GLB downloads stopped near 1 MB. Their exact rejected bytes are kept
under each source's `rejected-downloads/`. The producer now requires complete
HTTP Content-Length and GLB/image format validation before promoting a `.part`.
One truncated normal-map transfer per source was also caught and retried. Six
network-free regression tests cover truncated/corrupt transfers, bounded retries,
same-task archive recovery and refusal to submit an existing task again.

These are completed tasks; never submit them again. Their archived receipts are
bound into the comparison reports. Unnecessarily resuming a completed archive
would update receipt timestamps and invalidate those comparison hashes.

This directory is an isolated source audition. It does not change V4, the V3
family, public assets, gameplay code, colliders, or runtime integration.

## Matched source review

In every comparison, **left is current V3; right is the new Ultra 4K source**.
Both have the same displayed width and share camera and lighting. Their original
aspect ratios are preserved: Frost is 30.60% shallower and Glide 40.21% shallower
than the current platforms. They still require a deliberate collider-fit pass.

| Source | Clay                                                                                                     | Textured                                                                                                         | Packed editable scene                                |
| ------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Frost  | [Front](proofs/frost-ultra4k-v3-clay-front.png), [angle](proofs/frost-ultra4k-v3-clay-three-quarter.png) | [Front](proofs/frost-ultra4k-v3-textured-front.png), [angle](proofs/frost-ultra4k-v3-textured-three-quarter.png) | [Blender](sources/frost-ultra4k-source-review.blend) |
| Glide  | [Front](proofs/glide-ultra4k-v3-clay-front.png), [angle](proofs/glide-ultra4k-v3-clay-three-quarter.png) | [Front](proofs/glide-ultra4k-v3-textured-front.png), [angle](proofs/glide-ultra4k-v3-textured-three-quarter.png) | [Blender](sources/glide-ultra4k-source-review.blend) |

The [independent source review](proofs/source-review.json) accepts both as dense
source donors with limitations. All eight proofs, original guides, GLBs, maps
and packed scenes are hash-bound in that review. It does not accept a runtime
replacement.

The new sources have cleaner broad faces and corner details. Frost avoids the
old V3 black triangular top defect but retains small raised bubble-like bumps.
Glide's moon/orbit motif is principally texture detail. Both original materials
are opaque PBR, without glTF transmission or volume: their painted glass
appearance is not evidence of physical translucency. Material finishing remains
separate from source geometry acceptance. The single material also contains the
gold hardware, so glass and metal need deliberate material masks/partitions;
turning on transmission across the entire mesh would be incorrect. Frost's
underside has more/sharper crystals than requested, and Glide has pointed facets
that still need controlled finishing.

## Exact approved-source candidates

| Audition | V2 guide                                                                 |     Bytes | SHA-256                                                            |
| -------- | ------------------------------------------------------------------------ | --------: | ------------------------------------------------------------------ |
| Frost    | `art/glass-adventure/platform-trials/v2/guides/frost-platform-guide.png` | 1,126,005 | `f79a6e0de0bf2fe87c66443aa7abd87911d0377b59e872ff4fd91c9c3c525f45` |
| Glide    | `art/glass-adventure/platform-trials/v2/guides/glide-platform-guide.png` | 1,269,012 | `70acf421f63536dc18ca09f507fcf22b736647c7d92878bd3130b8b567f830c4` |

Both guides are 1254 x 1254 PNGs. Their V5 preflight receipts also pin the
corresponding archived V2 receipt hashes.

## Fixed provider contract

Each audition is prepared as one Image to 3D task at
`https://api.meshy.ai/openapi/v1/image-to-3d` with:

- `model_type: "standard"`
- `ai_model: "meshy-7.1"`
- `geometry_resolution: "4k"`
- `should_remesh: false`
- `should_texture: true`
- `texture_resolution: "4k"`
- `enable_pbr: true`
- `image_enhancement: true`
- `target_formats: ["glb"]`
- `alpha_thumbnail: true`
- one asset-specific texture prompt under the documented 800-character limit

The official Image to 3D and pricing pages were checked on 2026-09-23:
<https://docs.meshy.ai/en/api/image-to-3d> and
<https://docs.meshy.ai/en/api/pricing>. Current pricing is 35 credits per
Meshy 7.1 textured Image to 3D task with Ultra 4K geometry: 30 base credits
plus a 5-credit geometry surcharge. The prepared total is 70 credits.

The guide is converted to a base64 PNG data URI only in child-process memory.
The producer never stores the API key, input data URI, raw provider response, or
signed artifact URLs. It accepts downloads only from `assets.meshy.ai`.

## Receipt safety

`production/run_meshy71_ultra4k_audition.py`:

1. Verifies the exact guide bytes, PNG dimensions, SHA-256, and V2 authority
   receipt.
2. Verifies the fixed request and rejects remesh-only or Meshy-6-only fields.
3. Reconciles Image to 3D task history from the known V4 marble baseline and
   refuses unknown or locally ambiguous tasks.
4. Writes `submission-unconfirmed` before POST.
5. Writes the returned task ID before any balance or status read.
6. On interruption after a task ID, requires `--resume` and cannot resubmit.
7. Archives the original GLB and separate base-color, normal, metallic, and
   roughness maps with byte counts, dimensions, hashes, safe provider fields,
   and observed credit delta.
8. Stops without resubmission if a successful task omits any requested map.

Current task receipts:

- `meshy/frost-ultra4k/receipt.json`: complete archive, maps, hashes and 35-credit provider result.
- `meshy/glide-ultra4k/receipt.json`: complete archive, maps, hashes and 35-credit provider result.

All future GLB, Blend, PNG, JPEG, and WebP outputs under V5 are covered by the
local Git LFS attributes.

## Commands

Network-free preflight:

```sh
rtk python3 art/glass-adventure/platform-trials/v5/production/run_meshy71_ultra4k_audition.py --asset frost
rtk python3 art/glass-adventure/platform-trials/v5/production/run_meshy71_ultra4k_audition.py --asset glide
```

For these completed jobs, do not use `--submit`. If an archive is genuinely
incomplete, resume its recorded task ID without another charge:

```sh
rtk proxy timeout 3600 pass-cli run --env-file /home/maff/.dotfiles/personal/irchiinnuss/secrets/meshy-mcp.env.tmpl -- python3 art/glass-adventure/platform-trials/v5/production/run_meshy71_ultra4k_audition.py --asset frost --resume
rtk proxy timeout 3600 pass-cli run --env-file /home/maff/.dotfiles/personal/irchiinnuss/secrets/meshy-mcp.env.tmpl -- python3 art/glass-adventure/platform-trials/v5/production/run_meshy71_ultra4k_audition.py --asset glide --resume
```

Download regression check:

```sh
rtk proxy python3 art/glass-adventure/platform-trials/v5/production/test_run_meshy71_ultra4k_audition.py
```

After an archive is complete, render its matched source audition on CPU:

```sh
rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v5/production/render_ultra4k_v3_comparison.py -- --asset frost
rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v5/production/render_ultra4k_v3_comparison.py -- --asset glide
```

The comparison fails closed until the GLB, all four external PBR maps, and their
archived receipt agree. It renders neutral-clay and textured front and
three-quarter views at one camera, lighting rig, and V3-authoritative visual
width. The report measures width-matched depth and height drift without treating
equal bounding boxes as surface registration.

## Remaining acceptance gates

A generated donor may be accepted only as a high-detail source after the
hash-bound clay and PBR proofs show a coherent silhouette, a broad safe landing,
recognizable corner and underside forms, faithful motifs, clean region
separation, and no severe seams or baked lighting. Runtime use would still
require an authored low mesh fitted to the existing 1.70 x 1.30 x 0.24 metre
collider, new UVs, actual high-to-low normal/AO baking, finite unit
normal/tangent validation, texture-memory review, and gameplay proof.
