# Final portrait prefab proof

These captures verify the three final portrait prefabs inside their authored
gallery checkpoints. They use the shipped level definitions, the real
`GlassAdventure` Three renderer, the checked-in portrait textures, and the
checked-in `legend-slab.glb` geometry. The capture does not replace WebGL draw
calls or substitute a test scene.

## Result

| Portrait | Gallery checkpoint | Visual inspection |
| --- | --- | --- |
| [Awakened Muse](captures/awakened-muse.png) | Glassworks Journey portrait entry | Warm pink and gold portrait is upright, fully inside the brass frame, and has intact glass and texture mapping. |
| [Interval](captures/interval.png) | Twin Galleries portrait entry | Gold and celadon two-light portrait is upright, fully framed, and has intact glass and texture mapping. |
| [Wave Keeper](captures/wave-keeper.png) | Resonance Conservatory wave-salon portrait entry | Green floral portrait is upright, fully framed, and has intact glass and texture mapping. |

All three captures reached the expected checkpoint with three main exhibits
complete. Each run observed HTTP 200 responses for the prefab geometry and its
authored texture, byte-compared both responses with the checked-in assets, and
recorded no page or console errors. Exact positions, SHA-256 hashes, renderer,
asset byte counts, and comparison results are in
[`captures/manifest.json`](captures/manifest.json).

The images were rasterized at 1024 by 768 with WebGL2 through ANGLE and
SwiftShader. They prove composition, orientation, framing, UV mapping, and
asset integrity in the real game path. They are not a device-performance or
GPU-driver benchmark.

## Reproduce

Start the repository's stable playtest server, whose Vite configuration has
HMR and file watching disabled:

```sh
/home/maff/.nvm/versions/node/v22.22.2/bin/node \
  apps/beside-cue/scripts/glass-playtest.ts \
  --host 127.0.0.1 \
  --port 5357
```

From a second shell, run:

```sh
GLASS_PORTRAIT_QA_URL=http://127.0.0.1:5357 \
  pnpm exec node \
  art/glass-adventure/proofs/portrait-prefabs-2026-09-24/capture-portrait-prefabs.mjs
```

The harness seeds only the completed encounters and entry checkpoint needed to
reach each final portrait. It leaves the portrait reward uncollected, moves
Merc through public keyboard input, recenters and zooms through public camera
controls, and then captures the completed WebGL frame. It hides surrounding
HTML only after the scene is ready so the proof image is a clean canvas crop.
