# Cloudway polish evidence — 2026-09-22

## Camera framing

`cloudway-arrival-desktop.png` and the two portrait images use the actual
Cloudway development renderer, imported assets, scene lighting and WebGL2
output through SwiftShader. Raster calls were not suppressed and the canvas
was not resized. The portrait cases seed the saved finale checkpoint and enter
the real voice challenge with a silent media track so the shot remains
available for inspection.

This is an appearance proof from `?layout=cloudway`, not a traversal proof. It
does not exercise campaign unlocking, the route from arrival to finale or
physical-device performance. `camera-manifest.json` records the viewport,
checkpoint, camera, projected-frame metrics and exact asset hashes. Both
portrait frames report zero projected overlap between Merc and the portrait,
with the cinematic camera settled on the portrait's painted side.

## Backdrop-matched fog

`cloudway-fog-arrival-default.png` verifies the authored arrival view and
`cloudway-fog-arrival-right-zoom-in.png` verifies a near oblique view. The
first left-orbit capture exposed Three's axial fog-depth behavior and was
rejected: orbiting could uncover the distant finale even though its camera
distance had not changed. `cloudway-fog-arrival-left-zoom-out.png` replaces it
with the radial-distance implementation and verifies the far finale remains
merged into the fitted sky during a real mouse orbit and wheel zoom.

The fog images are genuine 2160×1350 WebGL2 raster at device pixel ratio 1.5,
with no draw suppression or canvas resizing. `fog-manifest.json` records the
accepted authored and near-view frames; `fog-radial-left-manifest.json` records
the radial-distance follow-up. These are appearance checks, not route traversal
or physical-device performance tests.

## Phone target icon

`target-disc-phone.png` is the 300×196 voice-panel crop produced by the actual
Beside Cue high-note calibration E2E at a 320×640 viewport. It verifies that the
target-disc SVG and voice copy fit the host UI. That E2E deliberately suppresses
the museum WebGL raster, so this image makes no camera, scene-rendering or
traversal claim. `ui-manifest.json` records its test provenance and hash.

## Final V3 integration

`cloudway-v3-arrival-desktop.png` is a fresh arrival through the final logical
asset map and shows the V3 marble, green inlay, gold boundary and frosted
landings. `cloudway-v3-portrait-tablet-singing.png` uses the same runtime bytes
at the seeded finale checkpoint and verifies the tablet cinematic still keeps
Merc and the painted target separated above the voice panel.

`integrated-v3-manifest.json` records zero page or console errors, the camera
projection metrics and runtime asset receipts. The V3 platform is manifest v3,
SHA-256
`e96bb26369cb037dffcfab3d0c71911dc7e872c2b8f766db8cb73599a6d51c62`.

## Reproduction and asset baseline

The portable harnesses are `capture-cloudway-camera.mjs` and
`capture-cloudway-fog.mjs`. Set `CLOUDWAY_PROOF_URL` and optionally
`CLOUDWAY_PROOF_OUTPUT` to use another local development server. Set
`CLOUDWAY_PROOF_CASE=left` for the focused radial fog check. Each harness hashes
the runtime assets it targets through `proof-assets.mjs`.

The camera and fog images without `v3` in their filename predate the Cloudway
V3 platform replacement. Their platform baseline is manifest v1 logical asset
`cloudway-platform-kit-v1`, SHA-256
`05deefa049031550b3aa7897a6d7a3345718b2e10a7595a272ea513195bb9e3e`.
The fitted sky is manifest v1 asset `floating-museum-cloudscape-v3`, SHA-256
`3cab6e70611c1166e536e4c1de78a063abc7bc51030eb1026c2caab82db5b75c`.
The manifests retain the full per-proof receipts, including the portrait slab
and texture hashes.
