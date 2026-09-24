# Mobile render-quality pass

This receipt covers the bounded runtime pass at the current Cloudway arrival
camera. The accepted `high` path retains the previous 1.5 DPR cap, 1024 PCF
shadow map, half-scale transmission prepass, full geometry, textures, glass
materials, antialiasing, and per-frame shadows. `balanced` caps DPR at 1.25 and
reuses a directional shadow map for at most one intervening frame. Auto selects
Balanced once at startup for a mobile hint or a compact coarse-pointer viewport;
it does not adapt from transient frame timings.

## Measured recurring work

The exact GL calls, target sizes, and triangle submissions are in
`render-submissions.json`. Chromium SwiftShader rendered the actual scene at a
390 x 844 CSS viewport with device scale factor 3.

| Frame                      | Draw calls | Submitted triangles | Render-target pixels |
| -------------------------- | ---------: | ------------------: | -------------------: |
| High                       |        116 |          14,119,936 |            1,974,022 |
| Balanced shadow update     |        116 |          14,119,936 |            1,690,422 |
| Balanced shadow reuse      |         83 |           8,994,166 |              641,846 |
| Balanced two-frame average |       99.5 |          11,557,051 |            1,166,134 |

Balanced preserves the same screen and transmission submissions on update
frames. Its lower DPR reduces recurring color-target pixels by 30.64%. Across
one update plus one reuse frame, it reduces draw calls by 14.22%, submitted
triangles by 18.15%, and target pixels by 40.93%. Starting Merc movement after
the reuse frame immediately restored the complete 33-draw shadow pass. The
focused renderer regression also forces immediate updates for takeoff/landing,
room and platform visibility changes, topology changes, and glass shattering.

`high-accepted-baseline.png`, `balanced-shadow-update.png`, and
`balanced-shadow-reuse.png` use the same live scene and camera. The High and
Balanced update images are both 1170 x 2532; their RGB mean absolute channel
error is 1.092/255 and PSNR is 37.56 dB. The stationary Balanced update and
reuse images are byte-identical. `balanced-movement-start.png` records the
invalidation frame. Exact hashes and pixel differences are in
`pixel-comparison.json`. `quality-selector-phone.png` shows the persisted
Auto/High/Balanced selector in its real phone host.

High is the unchanged current High policy captured in the same build, rather
than a screenshot from a separate historical checkout. This isolates the
policy difference while preserving an exact camera and asset set.

## Focused verification

```text
rtk proxy pnpm --filter @irchiinnuss/glass-game exec vitest run src/render/render-quality.test.ts src/render/glass-renderer.test.ts src/render/cloudway-platforms.test.ts src/render/museum.test.ts
Result: 4 files passed, 43 tests passed.

rtk proxy env BESIDE_CUE_E2E_PORT=5611 pnpm --filter @irchiinnuss/beside-cue-app exec playwright test e2e/glass-adventure-render-quality.e2e.ts --project=chromium-adventure --output=test-results-mobile-rendering-stage4
Result: actual phone touch taps selected High and closed the panel; persisted Auto/High selection and 320x568, 768x1024, and 1280x800 host-fit checks passed; actual-pixel proof skipped by default (1 passed, 1 skipped).

rtk proxy env BESIDE_CUE_E2E_PORT=5611 GLASS_RENDER_QUALITY_PROOF=1 pnpm --filter @irchiinnuss/beside-cue-app exec playwright test e2e/glass-adventure-render-quality.e2e.ts --project=chromium-adventure --grep='records matched' --output=test-results-mobile-rendering-stage4-proof
Result: matched real-render proof passed (1 passed).

rtk proxy git diff --check -- packages/glass-game/src/render packages/glass-game/src/ui apps/beside-cue/e2e/glass-adventure-render-quality.e2e.ts
Result: no output.

rtk proxy env VITE_BESIDE_CUE_GAMES=1 pnpm --filter @irchiinnuss/beside-cue-app exec vite build --outDir /tmp/glass-render-quality-production --emptyOutDir
Result: 497 modules transformed and the production CameraTuningPanel chunks emitted the three-column selector, 40px controls, and final player-facing copy.

rtk proxy adb devices -l
Result: no physical Android device attached.
```

## Asset preservation and limits

`source-asset-hashes.json` records the six Cloudway kit source hashes and an
empty result from:

```text
rtk proxy git diff --name-only HEAD -- apps/beside-cue/public/games/cloudway-v7
```

This pass did not edit mesh, buffer, texture, or material assets. It also did
not reduce shadow-map resolution or transmission quality. The screenshots are
real pixels, and the GL counts are real submissions, but SwiftShader wall time
is not hardware performance evidence. Stationary reuse and movement-start
invalidation have pixel receipts; the shatter transition is covered by the
renderer regression rather than a matched shatter screenshot. Phone FPS,
thermal behavior, and subjective motion/shatter quality remain physical-device
acceptance checks.
