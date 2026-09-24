# Cloudway V7 runtime integration — implementation checkpoint

Date: 2026-09-24
Scope: dense Marble V7, preserved V6/V3 platform families, current crescent route
Status: implemented and verified; physical-tablet acceptance remains the owner gate

## Result

The current Cloudway bundle keeps the stable logical ID
`cloudway-platform-kit-v1`. It replaces only the Marble root with the accepted
dense V7 delivery, keeps the accepted V6 Frost and Glide roots, and keeps the
three V3 Crackle states. The six root names and each platform's 1.70 × 1.30m
landing/collision envelope remain unchanged.

```text
public file: apps/beside-cue/public/games/cloudway-v7/cloudway-platform-kit-v7.glb
bytes: 77,414,948
SHA-256: 0f7a2129e7cd23b4148605a46d12fe28361d9ba632bea5d81d92142922fffee9
logical ID: cloudway-platform-kit-v1
Marble triangles: 1,256,556
Marble runtime map maximum: 1,024px
```

The superseded V6 combined source and manifest are archived byte for byte at
[`platform-trials/v6/runtime/archive`](../platform-trials/v6/runtime/archive/).
The public V6 duplicate is no longer shipped.

## Source and quality decision

The runtime build compares the accepted 2K dense Marble delivery against the
packaged root after a fresh import. Indices, positions, normals, tangents,
quantized accessor records, transforms and world bounds must match. Packaging
does not weld, simplify, decimate, flatten or deform the ornaments.

The 1K and 2K derivatives were rendered from the same real-game viewpoints.
Their closest-view whole-frame normalized RMSE is approximately 0.0179. The 1K
version retains the silhouette, carved relief, veins and material separation;
the 2K version adds only small vein sharpness at that distance. The accepted 1K
runtime saves 48 MiB of decoded Marble maps compared with the 2K derivative.
The comparison does not claim a separate 4K gameplay test.

- [1K route overview](../platform-trials/v7/runtime/proofs/browser/cloudway-v7-1k-route-overview.png)
- [1K close view](../platform-trials/v7/runtime/proofs/browser/cloudway-v7-1k-arrival-zoomed-in.png)
- [1K wide view](../platform-trials/v7/runtime/proofs/browser/cloudway-v7-1k-arrival-zoomed-out.png)
- [2K route overview](../platform-trials/v7/runtime/proofs/browser/cloudway-v7-2k-route-overview.png)
- [2K close view](../platform-trials/v7/runtime/proofs/browser/cloudway-v7-2k-arrival-zoomed-in.png)

## Honest runtime cost

The combined bundle contains 2,041,018 unique triangles, 51,628,704 bytes of
unique decoded geometry and 218,103,788 bytes of decoded RGBA8 mipmapped
textures. Unique geometry plus textures total 269,732,492 bytes (257.24 MiB)
before renderer and driver overhead. The transfer GLB is not used as a proxy
for decoded memory.

The crescent authors six Marble, two Frost, one Glide and two intact Crackle
platforms. Submitting all of them would cost 8,960,554 main-pass triangles.
The renderer therefore compacts complete transformed donor bounds after the
current camera update, outside the fully opaque 14m fog plus a conservative 2m
margin. It restores all live instances before the next camera occlusion pass,
so a platform that re-enters view is available to the raycaster before the
final presentation cull. Moving offsets, warning yaw and release-fragment
motion participate in the bounds calculation.

Actual captured platform submissions are recorded in
[`cloudway-v7-platform-submissions.json`](../platform-trials/v7/runtime/proofs/browser/cloudway-v7-platform-submissions.json):

| Camera state   | Pass                 | Draw calls |             Triangles | Marble instances |
| -------------- | -------------------- | ---------: | --------------------: | ---------------: |
| Arrival        | screen / offscreen-1 |    14 / 14 | 5,038,692 / 5,038,692 |                3 |
| Arrival        | offscreen-12         |          9 |             3,772,676 |                3 |
| Zoom in        | screen / offscreen-1 |    25 / 25 | 5,185,942 / 5,185,942 |                3 |
| Zoom in        | offscreen-12         |         15 |             3,773,804 |                3 |
| Zoom out       | screen / offscreen-1 |    14 / 14 | 3,782,136 / 3,782,136 |                2 |
| Zoom out       | offscreen-12         |          9 |             2,516,120 |                2 |
| Held challenge | screen / offscreen-1 |    25 / 25 | 5,185,942 / 5,185,942 |                3 |
| Held challenge | offscreen-12         |         15 |             3,773,804 |                3 |

Thirty-frame no-raster samples measured 6.3ms at arrival, 5.9ms zoomed in,
5.5ms zoomed out and 8.93ms in the held challenge. Disabling InstancedMesh
camera raycasts changed the held sample to 8.8ms, a 0.13ms difference in this
run. The dense platform raycasts did not justify replacing honest render
geometry with a separate occlusion proxy.

## Route, save and browser proof

`CLOUDWAY_CURRENT_TRIAL` is the polished crescent and uses the isolated
`cloudway-trial-current-crescent-v1` save identity. The campaign now selects
that export. `?layout=cloudway-current` reaches the same selected trial for
development review; `?layout=cloudway` and `cloudway-glass-ribbon` remain the
historical straight route and save identity. Focused tests retain the existing
trial, chapter, island, image and unlock keys and reject cross-reading the old
save as current-crescent progress.

The real-browser proof loads and hash-checks the public V7 bytes, observes
actual `drawElementsInstanced` submissions, crosses the first recovery with
real keyboard input, reloads its checkpoint, and boards/rides the V6 Glide to
the safe east rest. The rendered proof uses `?layout=cloudway-current` with the
actual Three.js renderer and accepted 9–14m fog.

## Validation ledger

```text
apps/beside-cue/node_modules/.bin/gltf-transform validate \
  apps/beside-cue/public/games/cloudway-v7/cloudway-platform-kit-v7.glb
zero errors, zero warnings

node art/glass-adventure/platform-trials/v6/production/audit_runtime_kit.mjs
passed against the byte-identical archived V6 kit

pnpm beside-cue:typecheck
passed

pnpm --filter @irchiinnuss/glass-game exec vitest run \
  src/render/cloudway-platforms.test.ts src/browser/assets.test.ts \
  src/content/cloudway-layouts.test.ts src/core/trial-unlock.test.ts
30 passed

BESIDE_CUE_E2E_PORT=5924 pnpm --filter @irchiinnuss/beside-cue-app \
  exec playwright test -c playwright.config.ts \
  e2e/glass-adventure-cloudway-platform-kit.e2e.ts \
  --project=chromium-adventure
3 passed, 2 explicit one-off raster comparisons skipped
```

The focused unit and browser results are also captured in the final handoff.
The one-off raster and 1K/2K comparisons are guarded by explicit environment
variables; routine CI keeps the behavioral, hash, loader and traversal checks.
The implementation has no unfinished code or proof work. Device-specific
physical tablet acceptance remains the owner gate.
