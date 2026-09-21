# Compiled Cloudway entry proof

These four PNGs are real browser output using SwiftShader, not concept art.
The trial card was inspected at 320, 1024 and 1440 pixels. The arrival image is
1024 x 768 with touch controls and the final short guidance line. No GL draw
calls were suppressed in these captures.

The entry test supplies valid test-only gallery saves, taps the earned trial
button, waits for installed assets and the first valid game frame, skips the
tutorial, captures the scene, then leaves and compares both gallery saves
byte-for-byte. Test fixtures are not part of the runtime unlock or user preview.
The development shortcut does not manufacture stars.

All three host cases pass. Card layout and declined-entry proofs used source
`9946caba`; the final earned-entry capture was repeated successfully at
`a6bf3140` after shortening four route notices. The final production build
contains the corrected platform kit `05deefa049031550b3aa7897a6d7a3345718b2e10a7595a272ea513195bb9e3e`.
See `manifest.json` for image, final HTML/chunk and kit hashes.

Reproduce from the repository root (installed Node, pnpm dependencies and
Chromium are required):

```sh
rtk proxy env VITE_BESIDE_CUE_GAMES=1 node node_modules/vite/bin/vite.js build apps/beside-cue --outDir /tmp/glass-cloudway-pilot-final --emptyOutDir
rtk proxy env VITE_BESIDE_CUE_GAMES=1 timeout 3600 node node_modules/vite/bin/vite.js preview apps/beside-cue --outDir /tmp/glass-cloudway-pilot-final --host 127.0.0.1 --port 5302 --strictPort
```

In another terminal:

```sh
rtk proxy env GLASS_RENDER_PROOF=1 timeout 600 node node_modules/@playwright/test/cli.js test --config=art/glass-adventure/platform-trials/v2/proofs/compiled-entry/playwright.config.mjs
```

The original run used an equivalent temporary Playwright configuration with
these same settings. Output defaults to `/tmp/cloudway-compiled-entry-results`.
Stop the preview with Ctrl-C; it otherwise expires after one hour. This proof
does not measure tablet frame rate, heat, microphone accuracy or touch feel.
The sibling `scripted-scene/` directory inspects fixed renderer snapshots;
actual route completion by movement/jump/voice input is covered separately by
`packages/glass-game/src/core/cloudway-traversal.test.ts` at 60 and 120 Hz.
