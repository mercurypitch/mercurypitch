# Cloudway Meshy 7.1 Ultra 4K audition

This production folder begins with an isolated audition using the accepted V2
marble-platform guide and one dense Meshy 7.1 donor from the documented API.
The current fitting, runtime and acceptance checkpoint is recorded in
[the production plan](../../plans/ULTRA-PLATFORM-PRODUCTION-2026-09-23.md).
Public assets change only after the exact derivative passes visual review.

The fixed request uses `ai_model: "meshy-7.1"`,
`geometry_resolution: "4k"`, 4K PBR textures, and `should_remesh: false`.
The dense result remains the shape authority; triangle and texture budgets are
chosen only after clay, PBR, and runtime-scale comparisons.

Run the local preflight without credentials or network access:

```sh
rtk python3 art/glass-adventure/platform-trials/v4/production/run_meshy71_ultra4k_trial.py
```

The preflight verifies the exact guide and V2 receipt hashes, validates the
fixed API request, and writes a `not-submitted` receipt. The charged command is
intentionally separate and must run with Proton Pass injecting
`MESHY_API_KEY` only into the child process:

```sh
rtk proxy timeout 3600 pass-cli run --env-file /home/maff/.dotfiles/personal/irchiinnuss/secrets/meshy-mcp.env.tmpl -- python3 art/glass-adventure/platform-trials/v4/production/run_meshy71_ultra4k_trial.py --submit --authorized-source-transfer
```

If the process stops after a task ID is recorded, resume without resubmitting:

```sh
rtk proxy timeout 3600 pass-cli run --env-file /home/maff/.dotfiles/personal/irchiinnuss/secrets/meshy-mcp.env.tmpl -- python3 art/glass-adventure/platform-trials/v4/production/run_meshy71_ultra4k_trial.py --resume
```

The producer stores `submission-unconfirmed` before POST, then persists the task
ID before any balance or status read. It never writes the API key, input data
URI, provider response body, or signed output URLs. Artifact downloads are
accepted only from `assets.meshy.ai`; receipts retain fixed local paths, hashes,
dimensions, topology counts, safe status fields, credit balances, and the
provider-confirmed model/resolution fields when returned.
If a successful task omits any requested PBR map, the producer still archives
the dense GLB, lists the missing roles, and stops without resubmitting.

## Archived result

Task `01a0cef2-fffb-726e-8659-b4e06c21149a` completed for 35 credits. The
receipt binds the 65,096,584-byte dense GLB (`fa4d0190...`) to 1,256,556
triangles and 702,537 referenced vertices. The GLB embeds 4K base color and
normal images plus a 2K metallic-roughness image; the provider archive also
contains separate 4K base color/normal and 2K metallic/roughness PNGs.

Render the hash-bound, source-only comparison against the V3 marble platform:

```sh
rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup \
  --python-exit-code 1 \
  --python art/glass-adventure/platform-trials/v4/production/render_ultra4k_v3_comparison.py
```

The command writes neutral-clay and textured front/three-quarter proofs plus
`proofs/marble-ultra4k-v3-source-comparison.json`. Both sources are uniformly
matched to the V3 visual width of 1.801668 metres; no axis is stretched. The
proof order is current V3 on the left and Ultra 4K on the right. The
manifest records source bounds, triangle and vertex counts, material-to-image
bindings, embedded image hashes, external map hashes, render hashes and the
review decision.

The Ultra result is accepted as a high-detail source donor. It has cleaner
arches, corner blocks, feet,
medallions, inlay and foliage than V3. It is not runtime-ready: at the matched
width it is 0.970874 metres deep versus V3's 1.400053 metres, and 0.650717
metres high versus V3's 0.572171 metres. A future low mesh must preserve the V3
landing/collider envelope and pass texture, tangent and runtime-memory review.
Whether to retain source UV/PBR or produce a new layout and high-to-low bake
depends on the derivative's actual quality. The source comparison performs no
additional generation, remesh, bake or runtime integration.

## Rejected remesh and bake path

The additional 5-credit 90k provider remesh is preserved with its receipt under
`meshy/marble-ultra4k`. It was fitted to the existing contact envelope, but
neutral-clay review exposed poor broad-face shading. Normal transfer also
revealed provider corner normals facing away from their own geometric faces.
Geometric-face gating corrects this basis but does not make the whole-shell
high-to-low projection reliable: nearby overlapping donor sheets contaminate
the normal bake. A narrower cage reduced those hits while losing coverage.

Rejected maps, packed Blender project, scripts and diagnostic images are
retained. Disabling the normal map does not earn visual acceptance, because it
leaves lumpy arches and slab faces. The second comparison simplified the dense
donor directly while retaining its provider atlas and PBR textures. That path
also failed visual review; neither derivative is installed in the game.

Historical report paths are resolved by recorded hashes in
`production/rejected-archive-index.json`; regenerate it with
`python3 art/glass-adventure/platform-trials/v4/production/index_rejected_archives.py`.
The corrected 90k rejection has its full packed Blender project, maps and GLBs.
The earlier rejected iteration retains both GLBs and their exact embedded
images, but its intermediate packed Blend and three standalone channel PNG
encodings were superseded before archival. The index records that limitation
instead of pointing those hashes at newer files.

## Rejected direct 238k derivative

The direct candidate has 238,000 shell triangles and a separate 32-triangle
landing boundary. Its 2K and 4K raw GLBs pass structural validation, but the
exact exported assets fail matched clay and PBR review. Broad surfaces show
triangular shading defects, the arches are rough, and the top artwork loses
the clean appearance of the dense donor. Higher texture resolution does not
repair this result. Both independent reviewers rejected it.

See `proofs/marble-direct-dense-clay-front.png` (dense left, derivative right)
and `proofs/marble-direct-pbr-front.png` (dense, 4K derivative, 2K derivative).
The paired three-quarter views and `marble-direct-dense-review.json` bind the
proofs to the exact raw GLBs. The packed Blender project, maps and rejected
exports are retained for diagnosis. There is no optimized or accepted V4
runtime bundle and no candidate performance result.
The optimizer and bundle assembler read the rejection decision and refuse
downstream production. A future accepted trial must have its own review.

The trial establishes failure of this combined fitting, flattening,
simplification and normal-finalization pipeline. It does not isolate one step
as the sole cause. Before another whole-object attempt, compare frozen clay
stages of those operations, then prove one broad slab/arch region with an
appropriate low surface and isolated bake. Do not repeat percentage reduction
or tangent repairs while the clay surface still fails review. Keep Meshy's
original source immutable; the public V3 platform kit remains unchanged.
