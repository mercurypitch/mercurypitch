# Floating Museum — connected halls and botanical conservatory

Owner authorized continuation after accepting the actual-Merc loader on 2026-09-21.
Continue draft PR #807, branch `feat/glass-museum-level-one`. Preserve the accepted
three-island composition, camera overview, labels, gallery entries, saved stars,
earned portraits, water and character placement.

## Visual target

Compare the accepted `journey-map/v1/a-floating-museum.png` with the delivered V5
overview and close captures. The largest structural omissions are the elevated
connector between the amber/teal halls and the Conservatory's own botanical
architecture. Broad bare white terraces and thick gold medallions are the next
material and silhouette differences. Detail must strengthen that hierarchy without
obstructing the route, water sources, portraits or destination markers.

## Production contract

1. Generate isolated architectural guides with built-in ChatGPT image generation.
   Preserve the original guides and exact prompts under `journey-map/v6/sources/`.
2. Commission two Meshy 6 PBR GLBs using the owner's standing credit authorization:
   a tall open arch with balcony and planted rooftop pergola, and an open marble
   conservatory with a celadon glazed canopy. Initial estimate: 60 credits total;
   initial account balance: 4,060. Preserve task IDs, actual charges and raw donors.
3. Finalize in Blender. Keep the generated silhouettes and carved detail; normalize
   transforms and grounds, inspect apertures and material response, compact textures,
   and produce a packed editable project plus a fresh reimport audit. Never accept
   closed opaque bays or chrome stone columns merely because generation succeeded.
4. Export `floating-museum-architecture-kit-v6.glb`, root
   `map_museum_polish_kit_root`, with `map_twin_connector` and `map_conservatory`.
   Target fewer than 45,000 added triangles combined. Both nodes face +Z, use Y-up,
   and have bottom-centered origins. Nominal connector bounds: 1.7 × 2.8 × 0.8 m;
   conservatory: 2.3 × 2.65 × 2.3 m. The arch needs a real open center at least
   approximately 0.8 m wide before assembly scaling.

The existing Twin temples leave almost no gap at their current spacing. The
connector is a composed facade/balcony layer, not an object blindly dropped into
that gap. Start near 0.78 scale and +0.42 m local Z; settle placement by reviewing
combined front and oblique views. Preserve the accepted amber/teal halls. The
conservatory replaces its old repeated canopy/column assembly.

## Runtime architecture

- Load the V6 architecture document separately from the retained V4 temple/cliff/
  foliage kit. Validate named nodes before assembly. Retain transactional cleanup
  on partial failure, aborted loads, context loss and scene disposal.
- Keep one asset-ID mapping shared by web and games-enabled native hosts; stage the
  runtime GLB and manifest through the existing source allowlist and LFS checks.
- Reuse the approved warm Carrara PBR maps for terraces at a deliberate world scale;
  add restrained inlay borders with shared/instanced geometry. Stone should have
  fine veining rather than painted shadows or a noisy floor pattern.
- Reduce the medallion's visible gold thickness, preserve its face/standing surface
  height contract and earned stars, and give the inset a restrained luminous lens.
- Compose fewer larger planted pockets using existing foliage donors. Keep authored
  paths, stage hit regions, portrait bases and water spillways clear. Avoid a random
  scatter that fills blank areas without supporting the architecture.

## Delivery stages

- [x] Owner accepted loader; latest CI failure isolated to stale five-clip asset test.
- [x] Update the asset test to the exact seven-clip contract; focused six tests pass.
- [x] Create and retain two architecture guides; submit the two Meshy tasks.
- [x] Archive raw donors, sanitized task receipts and actual credit consumption:
      60 credits total; 4,000 remaining after this batch. Partial native download
      recovered from authenticated artifact URLs without another generation.
- [x] Finish Blender kit; verify exported apertures, bounds, UVs/materials and sources.
      Final kit: 41,129 triangles, 5,628,320 bytes, packed Blender source retained.
- [x] Integrate models, marble/inlay, medallions and planted pockets.
      The authored archival-marble slot is the exposed terrace top; its runtime
      material was corrected to warm ivory after the first compiled overview.
- [x] Inspect actual compiled desktop/tablet/phone overview and close views, including
      all destinations and earned-art state. Compare with V5 and the concept.
- [x] Focused model/resource/architecture/vegetation tests, host builds and responsive
      browser checks; record real scene draw/triangle counts, not claimed mobile FPS.
- [x] Commit/push source and runtime stages and update PR #807.
- [x] Preserve the final proof/document checkpoint and mirror it to owner dotfiles.
- [x] Prepare a new static HTTPS preview on port 5297 without HMR; leave the
      accepted port-5296 snapshot files intact.
- [ ] Owner physical-device acceptance and exact pushed-revision CI result.

Sources and proof renders remain under `art/glass-adventure/journey-map/v6/`.
The Blender source is editable; raw generation results are not overwritten by
optimization. Do not save API credentials or signed artifact query strings.

## Remaining after this batch

Cliff/root variants, distant architectural silhouettes and the transparent Celadon
production replacement remain separate follow-ups. Singing judges, level contents,
reward policy and production store flags do not change in this art batch.

## Reviewed source and runtime checkpoints

- `3457a7cd`: corrected the actual-Merc seven-clip contract; all required CI passed.
- `3f1354ad`: original guides, two Meshy donors plus pre-remesh sources, packed
  Blender project, production scripts and source proofs committed and pushed.
- `87677aea`: runtime model loading, warm marble, shallow medallions, planting
  clearance and context-loss cancellation committed and pushed.

Independent source/runtime review found no model intersections, portrait/route
collisions or Merc grounding regressions in the reviewed compiled overviews.
Source GLB SHA-256: `32143c948457c0c8acef7c9b6a9f977874e131c59dd3b19bcc7d6f71ff23e5be`.

## Rendering cost and remaining visual gaps

The V6 full desktop/tablet overview records 264 draws and 614,327 rendered
triangles, versus V5's 196 and 383,855. These are rendered counters across passes,
not unique source geometry or a frame-rate measurement. The V6 conservatory's
physical transmission activates Three.js's opaque-scene transmission pass. In
the narrow First Light phone view, where that building is outside the camera,
V6 records 137 draws/337,237 triangles versus V5's 151/338,180. Water geometry
remains 2,136 triangles and five water draws. Test the full overview and close
Conservatory view on the owner's tablet before calling the cost accepted.

The next landscape pass should use larger authored flower beds, more substantial
marble bridges, varied cliff/root silhouettes and a composed crystal landmark.
The current plant pockets and reused cliff pieces do not reproduce the concept's
full planting density or unique island geology. Profile canopy transmission and
consider a measured device quality tier before adding further rendering work.

## Verification result

- Twelve actual compiled views passed: four destination overviews, tablet, narrow
  phone, earned desktop/phone, and front/oblique close views of both new buildings.
  No successful capture has a page/console error or horizontal overflow. Wheel
  and mouse drag assertions passed in the close views; earned artwork and stars
  were verified from an explicit saved-progress fixture.
- The long capture session's browser exited after nine completed views, before
  the final three browser contexts were created. Those three passed individually
  in fresh browser sessions. The initial protocol/context failures are retained
  in `v6/proofs/runtime/attempts/long-session.json`; their cause is not established.
  This is not evidence that sustained phone/tablet memory or heat is accepted.
- Focused journey models, architecture, planting, surface ownership, context-loss
  and asset-contract tests passed. Shared/mobile typechecks, scoped lint/format,
  generated-index check and diff checks passed.
- Both host builds passed. The final web build also passed first-paint, Piano
  Night/Drum Night isolation and portable-console assertions. Both built hosts'
  V6 GLB bytes match the validated export.
- Runtime revision `87677aea` passed the journey/loading/artwork and native build
  lanes. Its campaign test still listed only the three older lobby models; CI
  correctly reported the new V6 architecture request as an unexpected fourth.
  The exact asset allowlist now includes that model, retaining the prohibition on
  eagerly loading level assets. All four campaign browser tests passed locally
  after this correction. Final pushed-head CI remains a separate check.
- HTTPS LAN URL verified with HTTP 200:
  `https://192.168.178.33:5297/glass-game/?campaign=1`.

Owner test: switch all four destinations, zoom/orbit Twin Galleries and the
Conservatory, check Merc's feet on the medallions, and enter a gallery through
the accepted animated loader. Check sustained full-map/close-canopy smoothness
on the tablet. This static build has no HMR.
