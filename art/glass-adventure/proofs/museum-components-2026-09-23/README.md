# Museum repair: actual browser review

These captures use the real journey renderer on the local AMD Radeon RX 9070 XT
through ANGLE/Vulkan. WebGL drawing is enabled. The proof harness hashes the
actual GLB response bodies observed through its own CDP Network session, so a
file on disk cannot silently stand in for a different asset loaded by the game.

## Comparison stages

- `baseline/`: initial pre-repair close-up views.
- `baseline-cadence/`: old V4/V7 models with frame-cadence measurement enabled.
- `v8-final/`: accepted Conservatory and original temple/cypress kit, isolating V8.
- `v9-pale-domes-desktop/` and `v9-pale-domes-tablet/`: rejected first combined
  color treatment. Temple shape improves but amber/teal domes become too ivory.
  Their `review.json` records the rejection; these are not the final result.
- `v9-speckled-domes-desktop/` and `v9-speckled-domes-tablet/`: rejected stronger
  tint using the same hard colour mask. UV-centroid area sampling found 80.50%
  of the correctly partitioned dome got zero tint; warm neutral marble was
  incorrectly protected as gold. Each rejected desktop folder retains its exact
  GLB. The subsequent continuous-mask correction passed a fresh game review.

- `final-desktop/` and `final-tablet/`: accepted V8/V9 integration. Exact loaded
  V9 SHA is `04da964628212b243ca5b4afd327a1e52d43388929de2057be02bec44a495d74`;
  the smooth neutral mask restores continuous amber/teal surfaces. Physical-device
  acceptance remains open.

## Measured cost

| Actual draw capture                  |  Old V4/V7 | Final V8/V9 |
| ------------------------------------ | ---------: | ----------: |
| Loaded model bytes (four lobby GLBs) | 25,169,492 |  52,192,084 |
| Draw calls                           |        265 |         265 |
| Pass-inclusive triangles             |    867,371 |   2,597,333 |
| Geometries / textures                |    50 / 49 |     49 / 47 |
| Water triangles / draw calls         |  2,136 / 5 |   2,136 / 5 |
| Secondary render passes              |          1 |           1 |

Both final views on the local desktop GPU stayed near the 16.7 ms display
cadence. That is a short browser observation, not a tablet frame-rate guarantee.
Higher detail increases geometry/download cost even with instancing retained;
measure owner tablet load time, sustained frame rate and heat before release.

Each capture manifest records viewport, exact asset hashes/bytes, scene selection,
camera values, screenshots, browser errors and renderer counters. A 1024 x 768
viewport is a tablet-sized desktop view, not a physical tablet benchmark. The
120 requestAnimationFrame intervals describe browser cadence, not GPU timings.

The separate focused Playwright lobby test checks model request boundaries at
phone/tablet/desktop sizes. It suppresses drawing for deterministic loader
coverage and is not used as visual or performance evidence here.

The harness selects Twin Galleries and Resonance Conservatory through their
projected map markers, resets the view, then zooms in. Restart the stable QA
server after catalog edits because its Vite file watcher is disabled. Default
QA URL is `http://127.0.0.1:5341`; override with `GLASS_QA_URL`. Use a fresh
output label for each candidate rather than overwriting accepted proofs.

Run from the repository root with the QA server on 5341:

```sh
rtk proxy timeout 240 /home/maff/.nvm/versions/node/v22.22.2/bin/node art/glass-adventure/proofs/museum-components-2026-09-23/capture-museum-components.mjs final-desktop
rtk proxy timeout 240 env GLASS_QA_VIEWPORT=tablet /home/maff/.nvm/versions/node/v22.22.2/bin/node art/glass-adventure/proofs/museum-components-2026-09-23/capture-museum-components.mjs final-tablet
```

Run those sequentially so concurrent GPU work does not contaminate cadence.
Physical-tablet frame rate, load time and heat remain owner acceptance checks.

The superseded public copies have exact archived sources:

- V4: `art/glass-adventure/journey-map/v4/exports/floating-museum-twin-finish-kit-v4.glb`.
- V7: `art/glass-adventure/journey-map/v7/exports/floating-museum-architecture-kit-v7.glb`.
