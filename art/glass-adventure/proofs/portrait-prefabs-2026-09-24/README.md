# Final portrait prefab proof

These captures verify the three final portrait prefabs inside their authored
gallery checkpoints. They use the shipped level definitions, the real
`GlassAdventure` Three renderer, the checked-in portrait textures, and the
checked-in `legend-slab.glb` geometry.

## Intact result

| Portrait                                    | Gallery checkpoint                               | Visual inspection                                                                                               |
| ------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| [Awakened Muse](captures/awakened-muse.png) | Glassworks Journey portrait entry                | Warm pink and gold portrait is upright, fully inside the brass frame, and has intact glass and texture mapping. |
| [Interval](captures/interval.png)           | Twin Galleries portrait entry                    | Gold and celadon two-light portrait is upright, fully framed, and has intact glass and texture mapping.         |
| [Wave Keeper](captures/wave-keeper.png)     | Resonance Conservatory wave-salon portrait entry | Green floral portrait is upright, fully framed, and has intact glass and texture mapping.                       |

All three captures reached the expected checkpoint with three main exhibits
complete. Each run observed HTTP 200 responses for the prefab geometry and its
authored texture, byte-compared both responses with the checked-in assets, and
recorded no page or console errors. Exact positions, SHA-256 hashes, renderer,
asset byte counts, and comparison results are in
[`captures/manifest.json`](captures/manifest.json).

## Fracture result

| Portrait      | Live fracture capture                                   | Visual inspection                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Awakened Muse | [Completed hold](fractures/awakened-muse-fracture.png)  | The persistent painted plane and brass frame remain by design. The removed protective glazing is optically clear and its edge-on fragments do not separate visibly from this pale room in the frozen frame; the image alone is not a shard-silhouette proof. |
| Interval      | [Separated glazing](fractures/interval-fracture.png)    | The persistent portrait and frame remain while the authored teal glazing pieces separate around them.                                                                                                                                                        |
| Wave Keeper   | [Separated glazing](fractures/wave-keeper-fracture.png) | The persistent portrait and frame remain while two transparent teal glazing pieces remain visible at the right edge of the bounded fracture window.                                                                                                          |

Each fracture run enters the public voice challenge, feeds an oscillator through
a real `MediaStream` and the shipped pitch detector, reaches four completed main
exhibits, and records the resulting saved encounter and portrait reward. The
manifest at [`fractures/manifest.json`](fractures/manifest.json) contains the
exact encounter IDs, saved progress, frame timing, full-resolution renderer
state, asset hashes, and zero captured page errors. This state evidence proves
that Awakened Muse completed and removed its breakable glazing, while the
transparent material and view limit what its still image can show.

The images were rasterized at 1024 by 768 with WebGL2 through ANGLE and
SwiftShader. The fracture helper temporarily minimizes the canvas and suppresses
draw calls while it navigates and supplies real-audio input, then restores the
original WebGL methods and the 1024 by 768 canvas before the recorded frame.
Every fracture manifest entry records `drawSuppressed: false` and
`rasterMinimized: false` at capture. The images prove composition, orientation,
framing, UV mapping, asset integrity, and the visible fracture states described
above. They are not a device-performance or GPU-driver benchmark.

## Reproduce

Start the repository's stable playtest server, whose Vite configuration has HMR
and file watching disabled:

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

GLASS_PORTRAIT_FRACTURE_QA_URL=http://127.0.0.1:5357 \
  pnpm exec node \
  art/glass-adventure/proofs/portrait-prefabs-2026-09-24/capture-portrait-fractures.mjs
```

The intact harness seeds only the completed encounters and entry checkpoint
needed to reach each final portrait. The fracture harness then completes the
authored final challenge through the real pitch detector. Both use public
keyboard and camera input and capture the shipped renderer rather than a
substitute scene.
