# Final Journey portrait proof

These actual-pixel SwiftShader captures exercise the authored final Journey
portrait through its real reference-note, microphone, pitch-judge, fracture and
save paths. The desktop viewport is 960 x 540 and the landscape tablet viewport
is 768 x 576.

- `portrait-before-*`: the collected artwork is upright and intact.
- `portrait-during-*`: the gold frame remains while the sixteen authored pieces
  carry the picture through the fracture. Teal backs are visible where pieces
  turn away from the camera.
- `portrait-after-*`: the upright artwork returns as the collected reward.

The opt-in Playwright proof also reloads the page and asserts that all four main
Journey exhibits remain complete. Every capture checks center-crop pixel
variance before accepting the screenshot, and the fracture capture runs a full
compact-view planar-reflection cadence before reading pixels. The proof asserts
that the panorama notice stays hidden during the fracture and returns after the
shards settle. Focused unit coverage owns reduced-motion timing, restored saves,
archive protective glazing, texture ownership and the sixteen picture-bearing
shard primitives.

Run from the repository root with private local ports:

```sh
BESIDE_CUE_E2E_PORT=5614 GLASS_PORTRAIT_RENDER_PROOF=1 \
  pnpm exec playwright test \
  -c apps/beside-cue/playwright.config.ts \
  apps/beside-cue/e2e/glass-adventure-portrait-orientation.e2e.ts \
  --project=chromium-adventure \
  --output=test-results-final-camera-portrait
```

Receipt: 1/1 passed in 52.6 seconds on 2026-09-25.
