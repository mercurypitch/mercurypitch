# Glassworks mobile rendering submission proof

This receipt records the bounded first rendering pass for the Cloudway platform
kit. It compares the legacy 16 m camera-radius selector with the final
camera-frustum, fog-distance, and visible-receiver shadow selector. Both
captures use the same deterministic cameras and the same public V7 kit.

## Results

All arrival views are unchanged at the default, closest, widest, and challenge
cameras. At the first-recovery forward camera, the final selector changes the
submitted Marble instances from 4 to 3:

| Pass         | Legacy triangles | Final triangles |             Difference | Draw calls |
| ------------ | ---------------: | --------------: | ---------------------: | ---------: |
| Screen       |        6,444,970 |       4,553,902 | -1,891,068 (-29.3418%) |   27 -> 27 |
| Offscreen 1  |        6,444,970 |       4,553,902 | -1,891,068 (-29.3418%) |   27 -> 27 |
| Offscreen 12 |        5,032,832 |       3,774,772 | -1,258,060 (-24.9971%) |   17 -> 17 |

These are actual Three.js/WebGL submission counts captured after Three.js
submitted each draw. Rasterization was suppressed for the count proof. The
SwiftShader wall times in the raw receipts are diagnostic harness values, not
hardware FPS or device-performance measurements.

The raw captures are
[`legacy-radius-submissions.json`](./legacy-radius-submissions.json) and
[`frustum-shadow-aware-submissions.json`](./frustum-shadow-aware-submissions.json).
[`comparison.json`](./comparison.json) contains the matched-camera summary.

## Verification commands

The same runtime Playwright invocation captured the legacy and final states;
the receipt emitted by each run was archived under the filenames above:

```sh
rtk proxy env BESIDE_CUE_E2E_PORT=5611 pnpm --dir apps/beside-cue exec playwright test -c playwright.config.ts e2e/glass-adventure-cloudway-platform-kit.e2e.ts --project=chromium-adventure --grep "real renderer submits" --output=test-results-mobile-rendering
```

Final result: 1 test passed in 22.1 seconds (32.6 seconds total). The test also
asserts that the first-recovery screen pass submits fewer than four Marble
instances.

Focused selector and renderer-adapter regressions:

```sh
rtk proxy pnpm --filter @irchiinnuss/glass-game exec vitest run src/render/cloudway-platform-culling.test.ts src/render/cloudway-platforms.test.ts
```

Final result: 2 files and 16 tests passed.

The required workspace typecheck passed during integration. Later selector
refinements passed the focused tests above; CI checks the final PR source:

```sh
rtk proxy pnpm beside-cue:typecheck
```

Final result: passed. A scoped `git diff --check` also passed.

## Asset preservation

This pass changes TypeScript source and tests only. It does not edit meshes,
materials, textures, GLTF, or binary assets. The runtime Playwright test
fetches the public kit and verifies its byte lengths and SHA-256 hashes against
the checked-in manifest before collecting submissions:

| File                                   |      Bytes | SHA-256                                                            |
| -------------------------------------- | ---------: | ------------------------------------------------------------------ |
| `cloudway-platform-kit-v7.gltf`        |     60,583 | `5383673777e743da7922f5d5c406bece3da51445b3a7b31e3a6b77fecd1434d1` |
| `cloudway-platform-kit-v7-part-01.bin` | 24,483,552 | `fe5bd4f0133834960c7185f7e864cfc7fbba0ad1142583f5e53148d6e33585a9` |
| `cloudway-platform-kit-v7-part-02.bin` | 11,976,384 | `f360bf1525c8a5f95f0bce849320ae0bf5ad145ece2b9f39f2e11034a3affb96` |
| `cloudway-platform-kit-v7-part-03.bin` | 23,520,812 | `b6655790c58fd7b56c60fa39e5992f469ff184f972241e3d3d05a523840fd4fe` |
| `cloudway-platform-kit-v7-part-04.bin` | 17,393,098 | `d01d8ef9e49488946d7d08face07a323d029ec3ff52bdf682f30fe61655cd065` |

## Pixel-proof limitation

A new opt-in one-frame pixel-capture experiment was added during this pass. Its
only run stopped in camera choreography before taking a screenshot: the heading
helper remained 0.145908 radians from its target, outside its 0.03-radian
tolerance. No render or culling assertion failed because the test did not reach
those assertions. The unverified experiment was removed.

That experiment did not exist on `origin/main`, so removing it removed no
baseline coverage. The existing opt-in V7 real-pixel proof remains in the E2E
spec. This receipt therefore supports submission-count correctness and the
focused culling invariants; it does not claim a matched before/after pixel proof
or physical-device performance acceptance.
