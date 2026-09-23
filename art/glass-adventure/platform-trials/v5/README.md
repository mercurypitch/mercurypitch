# Cloudway Frost and Glide Meshy 7.1 Ultra 4K source auditions

Status: **NOT SUBMITTED**. No Frost or Glide V5 provider task exists, no guide
was transferred, and no credits were charged.

The first Frost submission command was rejected before process creation by the
external-egress approval gate. The gate requires approval that explicitly names
both source files, the Meshy API destination, and the two 35-credit jobs.
Do not retry either submission until that specific approval is present.

This directory is an isolated source audition. It does not change V4, the V3
family, public assets, gameplay code, colliders, or runtime integration.

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

Current preflight receipts:

- `meshy/frost-ultra4k/receipt.json`: `not-submitted`, no task ID.
- `meshy/glide-ultra4k/receipt.json`: `not-submitted`, no task ID.

All future GLB, Blend, PNG, JPEG, and WebP outputs under V5 are covered by the
local Git LFS attributes.

## Commands

Network-free preflight:

```sh
rtk python3 art/glass-adventure/platform-trials/v5/production/run_meshy71_ultra4k_audition.py --asset frost
rtk python3 art/glass-adventure/platform-trials/v5/production/run_meshy71_ultra4k_audition.py --asset glide
```

Only after the specific external-transfer approval is granted:

```sh
rtk proxy timeout 3600 pass-cli run --env-file /home/maff/.dotfiles/personal/irchiinnuss/secrets/meshy-mcp.env.tmpl -- python3 art/glass-adventure/platform-trials/v5/production/run_meshy71_ultra4k_audition.py --asset frost --submit --authorized-source-transfer
rtk proxy timeout 3600 pass-cli run --env-file /home/maff/.dotfiles/personal/irchiinnuss/secrets/meshy-mcp.env.tmpl -- python3 art/glass-adventure/platform-trials/v5/production/run_meshy71_ultra4k_audition.py --asset glide --submit --authorized-source-transfer
```

If a command ends after its receipt contains a task ID, use the matching
resume command and never submit again:

```sh
rtk proxy timeout 3600 pass-cli run --env-file /home/maff/.dotfiles/personal/irchiinnuss/secrets/meshy-mcp.env.tmpl -- python3 art/glass-adventure/platform-trials/v5/production/run_meshy71_ultra4k_audition.py --asset frost --resume
rtk proxy timeout 3600 pass-cli run --env-file /home/maff/.dotfiles/personal/irchiinnuss/secrets/meshy-mcp.env.tmpl -- python3 art/glass-adventure/platform-trials/v5/production/run_meshy71_ultra4k_audition.py --asset glide --resume
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
