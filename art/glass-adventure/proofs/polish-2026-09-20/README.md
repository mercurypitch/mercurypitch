# Gallery polish evidence — 2026-09-20

Mirror and exit images use the real game renderer, imported assets, scene
lighting and WebGL output. The mirror image is the current adaptive high tier
(1024 × 768, bounded cadence three); distant mirrors keep the original small
target. The ready portal image predates only the sparkle-only clearance change;
the 0.9-second flourish image includes that correction. Corresponding capture
metadata is in `manifest.json`; those counters are not physical-device FPS.

Header images use the compiled game in its campaign/Journey host. Raster calls
are suppressed for these **UI layout only** checks; they do not represent the
world's pixels. `header-layout-manifest.json` records six viewport sizes from
320 px through 1440 px, font/color and control bounds, with no page errors or
HMR client. The first real-render 320 px header was inspected separately.

Owner desktop/tablet performance and perception remain the next acceptance
check. The owner's original HTTPS snapshot was not changed during this pass.
