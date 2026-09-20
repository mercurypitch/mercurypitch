# Journey water study

This isolated study renders the production `createJourneyWater` module through
the repository Vite server. It owns no alternate water implementation. The
scene uses two differently sized spillways and a fixed camera so frame changes
come from the water shader and geometry.

Run against the approved local HTTP Vite origin:

```bash
WATER_STUDY_ORIGIN=http://127.0.0.1:5224 \
  node art/glass-adventure/journey-map/v2/water-study/capture.mjs
```

## Recorded evidence

- `water-flow-0000ms.png` and `water-flow-1400ms.png` disable mist. The second
  frame changes 32,903 of 480,000 full-frame pixels (6.8548%). The broken
  silver filaments advance toward the basins while the sheet edges and lower
  silhouettes deform; particles cannot account for the difference.
- `water-with-mist-1400ms.png` enables the normal pooled impact mist. It records
  36 points for two spillways in one draw.
- `water-reduced-2000ms.png` and `water-reduced-3200ms.png` are byte-identical.
  Reduced motion retains a calm turquoise fall and ripple surface without
  advancing flow or mist.
- `manifest.json` records source metrics, image hashes, pixel differences and
  browser errors. Chromium SwiftShader reported no page or shader-console
  errors.

Visual inspection at 800 by 600 found a pale silver/turquoise cascade with a
turquoise core, irregular transparent edges, a pinned curved top lip, stronger
impact turbulence and readable basin rings. The study verifies rendering and
motion; it does not claim physical-device frame rate or the future full-map
budget.
