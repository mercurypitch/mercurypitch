# Cloudway Meshy 7.1 Ultra 4K audition

This isolated audition reuses the accepted marble-platform guide from V2 and
requests one dense Meshy 7.1 donor through the documented direct API. It does
not replace the V3 review candidate or any public game asset.

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

The Ultra result is accepted as a high-detail source donor for a later
professional high-to-low workflow. It has cleaner arches, corner blocks, feet,
medallions, inlay and foliage than V3. It is not runtime-ready: at the matched
width it is 0.970874 metres deep versus V3's 1.400053 metres, and 0.650717
metres high versus V3's 0.572171 metres. A future low mesh must preserve the V3
landing/collider envelope, receive a new UV layout and validated normal/AO bake,
and pass tangent and runtime-memory review. The comparison performs no
additional generation, remesh, bake or runtime integration.
