# Balanced first-render shadow regression

This receipt covers the real-raster phone startup failure from CI head
`6e623f8f`, Actions run `36070994811`, controls job `107872344856`. The failed
artifact was downloaded to
`/tmp/glass-adventure-playwright-controls-36070994811`; the cleaned job log is
`/tmp/glass-controls-ci-6e623f8f.log`.

The failed run loaded all 28 scene assets with successful HTTP responses, then
changed `data-loading-phase` to `error` while using the Balanced render profile.
No page or request error explained the failure. A local rerun with Chromium GPU
logging exposed the rendering error:

```text
GL_INVALID_OPERATION: glDrawElements: Mismatch between texture format and
sampler type (signed/unsigned/float/shadow).
```

A temporary diagnostic wrapper around the museum canvas found GL error 1282
for Balanced at both 320 x 740 and 390 x 740, while High at 320 x 740 remained
clean. The temporary wrapper was removed after diagnosis.

Balanced disables automatic shadow updates before the environment reflection
probe captures its cube map. That probe is the renderer's first pass, before
the playable-frame shadow cadence can request an update, so it sampled Three's
placeholder shadow texture. The fix primes one manual shadow update before the
probe. The probe consumes that update, and the existing cadence still requests
a complete shadow update for the first playable frame. The same contract now
has focused coverage for a fresh renderer attempt, renderer recovery, and a
High-to-Balanced switch.

## Red and green evidence

```text
rtk proxy env BESIDE_CUE_E2E_PORT=5611 pnpm --dir apps/beside-cue exec playwright test e2e/glass-adventure-controls.e2e.ts --project=chromium-adventure --grep='Tune clears Help and movement labels cannot be selected' --output=test-results-mobile-rendering-controls-repro
Before fix: 1 failed in 31.9s; data-ready remained false and loading ended in error.

rtk proxy env DEBUG=pw:browser BESIDE_CUE_E2E_PORT=5611 pnpm --dir apps/beside-cue exec playwright test e2e/glass-adventure-controls.e2e.ts --project=chromium-adventure --grep='Tune clears Help and movement labels cannot be selected' --output=test-results-mobile-rendering-controls-browser-debug
Before fix: 1 failed; Chromium repeatedly reported the sampler-format GL_INVALID_OPERATION above.

rtk proxy pnpm --filter @irchiinnuss/glass-game exec vitest run src/render/glass-renderer.test.ts -t 'initializes a balanced shadow'
Before fix: failed because the reflection probe observed needsUpdate=false; expected true.

rtk proxy pnpm --filter @irchiinnuss/glass-game exec vitest run src/render/glass-renderer.test.ts -t 'initializes a balanced shadow|invalidates the first manual shadow'
After fix: 2 passed, 19 skipped.

rtk proxy pnpm --filter @irchiinnuss/glass-game exec vitest run src/render/glass-renderer.test.ts
After fix: 1 file passed, 21 tests passed.

rtk proxy env BESIDE_CUE_E2E_PORT=5611 pnpm --dir apps/beside-cue exec playwright test e2e/glass-adventure-controls.e2e.ts --project=chromium-adventure --grep='Tune clears Help and movement labels cannot be selected' --output=test-results-mobile-rendering-controls-green
After fix: the original 320 x 740 real-raster case passed, 1/1 in 15.2s total (5.2s test time). The test's pixels, timeout, and assertions were unchanged.
```

The retained local Playwright outputs are:

- `apps/beside-cue/test-results-mobile-rendering-controls-repro/`
- `apps/beside-cue/test-results-mobile-rendering-controls-browser-debug/`
- `apps/beside-cue/test-results-mobile-rendering-controls-green/`

An independent combined rerun after the fix passed all six controls cases in
50.1s. The two other untouched real-raster phone paths that had failed with the
same Balanced startup error, voice blur input and journey island entry, passed
2/2 in 55.0s.

This is a browser-rendering correctness and startup receipt using Chromium's
software renderer. It does not measure or claim physical-phone FPS.
