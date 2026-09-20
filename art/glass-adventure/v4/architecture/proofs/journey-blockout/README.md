# Glassworks Journey — first route blockout

This preview assembles the existing V4 window/screen modules, enclosed rooms,
corners, passages and panorama terrace into a longer, continuous route. Four
required held-note exhibits open four gates. Four optional treasures sit in
the garden and panorama. The original prototype and tutorial keep their own
saved progress; this route is `glassworks-journey/journey`.

`capture.mjs` uses the real renderer and assets at the fixed positions in
`poses.json`. It captures arrival, garden, portrait and panorama at 800×600 and
390×740. Completion is seeded to inspect those views: these screenshots do
not claim that the full route was played, sung or timed. Camera settling skips
raster work, then each saved screenshot renders a real frame. Asset and page
errors are recorded in `manifest.json`.

The eight views loaded without asset or page errors. Recorded render counts
range from 224–510 draw calls and approximately 2.1–4.74 million triangles per
captured frame, including render passes. Those counts are a workload warning,
not a frame-rate measurement or physical-device performance acceptance.

## Next acceptance work

- Profile on the intended phone/tablet hardware. Add room visibility control,
  distance detail and a tighter shadow/render-pass budget before promoting the
  route into the campaign.
- Distinguish room identities through dressing, light and texture scale. The
  garden has its soundscape and exhibits, but no botanical dressing yet.
  Repeated bays and busy floor/shadow patterns need an art pass.
- Walk all transitions, check camera sightlines and optional-exhibit discovery,
  and measure singing fatigue and actual play duration. A 10–15 minute journey
  remains a design target, not a verified duration.

No new Meshy or Blender source was needed to prove this arrangement. Keep the
existing donors intact; commission additional details once the route is
accepted. The preview is development-only at `/glass-game/?layout=journey`.
