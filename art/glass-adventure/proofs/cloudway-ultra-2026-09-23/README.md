# Cloudway Ultra platform comparison

`capture-platforms.mjs` opens the real local Cloudway entry, waits for its first
safe checkpoint and captures the untouched arrival view plus a close view made
with mouse-wheel zoom and a real mouse orbit, then a lower camera view for
grazing top and edge shading. It does not teleport Merc, seed
completed progress or suppress WebGL draws. The only localStorage fixture skips
the already-reviewed tutorial overlay.

Each capture records screenshots, actual browser renderer, 120 animation-frame
intervals and hashes of GLB response bodies compared with their source files.
Frame cadence is not GPU timing. A tablet-sized desktop capture is not a
physical-tablet performance test. Camera inputs and viewports are fixed across
candidates so art differences can be assessed in the same context.

Before installation, `CLOUDWAY_CANDIDATE_FILE` can replace only the platform GLB
in this isolated browser. It loads and draws the real candidate file and records
the override in the manifest; no public asset or owner session is changed.

Run from the repository root, with the local no-HMR QA server on 5341:

```sh
rtk proxy timeout 240 /home/maff/.nvm/versions/node/v22.22.2/bin/node art/glass-adventure/proofs/cloudway-ultra-2026-09-23/capture-platforms.mjs baseline-desktop
```

For a tablet viewport, add `env CLOUDWAY_VIEWPORT=tablet` before Node. To compare
an uninstalled candidate, set `CLOUDWAY_CANDIDATE_FILE` to its repository-relative
GLB path. Final captures must run without that override against the installed
catalogue. Restart the QA server after editing imported modules: it intentionally
does not watch files.

The initial V3 baseline captures four real GLBs on an AMD RX 9070 XT Vulkan
renderer, no console/page errors, and approximately 16.7 ms median/p95 frame
cadence. See the generated manifests for exact values. This does not resolve
the owner's physical-tablet loading, memory, frame-rate or heat acceptance.

`baseline-instrumented/manifest.json` adds passive native WebGL draw counters.
Across 120 frame intervals at the final grazing view, V3 submits 7,560 calls
and 135,050,880 triangles: 63 calls and 1,125,424 triangles per interval. These
are pass-inclusive submissions, including instances, not visible-pixel counts
or GPU timings. All observed draws use TRIANGLES. No multi-draw extension was
requested; counter consistency, browser errors and the four loaded GLB hashes
are checked. The wrappers do not alter native calls or suppress drawing.

`baseline-route-override` verifies that the isolated override mechanism loads
the exact current V3 bytes. It is not a new candidate comparison. Both V4
marble derivatives failed Blender clay/PBR review before game integration, so
there is no V4 performance measurement or claim of tablet acceptance here.
