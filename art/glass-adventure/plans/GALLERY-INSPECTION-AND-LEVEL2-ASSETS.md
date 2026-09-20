# Gallery inspection, ground clearance and Level 2 art

Implementation checkpoint, 2026-09-20. Extends the accepted longer journey in
draft PR #807. See [NEXT-MASTER-PLAN.md](./NEXT-MASTER-PLAN.md) for the current
sequence and the distinction between implemented and planned mechanics.

## Changes

- Wall mounting uses the measured Meshy wall face and the frame's rear face.
  The previous roughly 20 cm air gap is removed. The frame rear embeds 2–10 mm
  into the uneven wall face; artwork and raised ornament remain in front of it.
  All seven framed-art placements use the same measured offset.
- Merc's visual anchor includes the entire visible rig, including the hands.
  It adds 15 mm clearance at rest and preserves about 10 mm at the lowest
  celebration squash. Physics, jump height and collider grounding do not move.
- Paintings support a direct canvas tap/click and a nearby **View artwork**
  button, so a low camera does not prevent viewing high art. The close-up has
  an original short story and encouragement. It pauses movement/audio, traps
  keyboard focus, fits a narrow phone, and returns focus to the world without
  resetting the camera. Backgrounding goes to ordinary pause, not auto-resume.
  Raycasts reject hidden art and blocking walls. Drag/cancel is not a tap.
- Mirrors use the authored inset with a planar reflection camera. At most one
  front-facing, on-screen mirror captures in a frame; mirrors are hidden in
  that capture to prevent recursion. Reflected room visibility is temporarily
  expanded, then restored. The largest target dimension is 384 pixels at one
  capture per two frames, or 256 per four frames for a viewport with a short
  edge below 600 pixels. This is viewport-based, not device identification.
  Capture failure restores the environment-lit fallback and stops retrying.
  Render state, temporary visibility and target/material ownership are tested.

## Level 2 source batch

The [Twin Galleries collection](../v6-level2/README.md) contains Amber Cadence
Urn, Celadon Lark Decanter, Twin-Tone Resonance Harp and Opaline Echo Amphora,
plus **The Low Note Keeper**, **The High Note Muse** and **The Interval Between**.
Four Meshy jobs cost 120 credits. Exact prompts, seven image masters, four
downloaded donor GLBs, packed Blender projects, normalized 1K GLB derivatives,
sanitized receipts, inventories and review renders are preserved together.

The three vessels still need closed-volume/cavity review, glass material
separation, matched fractures, collider approval and an actual game review.
The harp is a decoration candidate. The opaque concept-colored Meshy surfaces
are not a finished transparent-glass shader. No unused candidates are added to
the current level's download or native asset manifest.

## Verification and boundaries

- Relevant BesideCue/shared-package typecheck passed.
- Focused geometry, placement, inspection and rendering tests passed. They
  cover real Merc GLB bounds and normalized reflection-plane placement.
- Browser checks exercise real mouse orbit, touch controls, accessible artwork
  inspection, focus/return, camera preservation and background interruption.
  The fast interaction suite suppresses WebGL draw calls; it is not pixel or
  GPU-performance evidence.
- A compiled QA build checks the real host's emitted styles at 320 × 640 and
  1024 × 768. It caught and fixed inherited button color overriding the close
  button. Its test-only route selection permits the development journey;
  shipping route guards are not changed. QA scripts and images are in
  `v5/proofs/` and `v5/proofs/polish-sept20/`.
- Actual scene captures are separate from the raster-suppressed interaction
  tests. `v5/proofs/live-mirror-sept20/` shows the live opposite-wall painting
  and room at two recorded poses with no page/asset errors. The tall mirror and
  low third-person viewpoint leave Merc's virtual body outside/occluded in
  these captures; they do not visually prove his own reflected silhouette.
  Physical-device frame time, temperature and mirror cost still need
  owner playtesting/profiling; desktop software rendering does not prove them.
- Source binary storage follows [STORAGE.md](../STORAGE.md). The Git LFS archive
  is independent of the normal-Git playable exports.

## Owner test route

1. Enter the longer journey and visit the garden, archive and portrait salon.
2. Check frames against the walls and Merc's hands while idle, walking,
   jumping and celebrating.
3. Tap a visible painting or use **View artwork** nearby. Read, dismiss and
   continue moving. Try a camera drag near art and confirm it does not open it.
4. On tablet, inspect and dismiss art in portrait/landscape, then briefly switch
   apps while it is open; the game should return paused.
5. Face the salon mirror and move/turn Merc. Check that the reflected room view
   changes, then play for a few minutes and report any sustained slowdown.

## Next work

First finish the shared lesson/campaign foundation: one challenge lifecycle,
per-level teaching, independent progress and safe level switching. Then build
Twin Galleries around comfortable low/high notes and their ordered pair,
using this art batch after production approval. Resonance Conservatory follows
with stable pitch into gentle vibrato. Coins, grades, portrait rewards and
recorded melody finales remain design work, not part of this implementation.
