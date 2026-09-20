# V5 visual evidence

`capture.mjs` drives the actual shared renderer through local Vite at fixed
inspection poses. It waits for required assets, settles the camera, renders a
frame and saves the canvas together with draw metrics and asset/page errors.
The poses are reproducible scene inspections, not a complete playthrough,
real microphone acceptance, sustained frame-rate or physical-device benchmark.

- Root PNGs and `manifest.json`: eight desktop/phone journey views.
- `rooms/`: twelve art, doorway and window inspection views.
- `all-rooms/`: matching root poses with only the visibility selection bypassed
  in the served test module. No production bypass was added.
- `visibility-comparison.json`: equal-scene measurements and paired image
  differences; counts include render passes.
- `shadows/`: controlled earlier shadow-bias before/after views.
- `inset-final/`: final mirror and painting checks after isolating and flattening
  the frame inset; these supersede the matching earlier artwork close-ups.
- `frame-*.png` and `crystal-planter-*.png`: Blender asset inspections.

The broad visibility comparison was captured before the final planar-inset
polish. That correction affects only the frame surface; the paired comparison
remains a controlled measurement of the same pre-polish assets with visibility
on/off. It must not be represented as an exact final-asset FPS measurement.
Final bundle/source checksums are in the runtime manifest and source archive.
