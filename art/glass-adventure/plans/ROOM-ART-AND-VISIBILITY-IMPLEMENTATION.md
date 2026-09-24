# Room art and visibility implementation

Date: 2026-09-20. Work in progress for draft PR #807. The owner played and
accepted the tutorial and longer route, then requested lower hidden-room
rendering costs, distinctive rooms, floor variation, paintings and mirrors.
No blocking design decision remains for this pass.

## Intended result

- Crystal garden: jade floor accents, botanical artwork, Meshy crystal-fern
  planters and restrained reused foliage.
- Quiet archive: angular brass floor inlays and original architectural artwork.
- Portrait salon: orbital accents, a fictional singing-muse painting and
  matching gilded wall mirrors.
- Passages: predominantly quiet marble, occasional sound-wave linework.
- Stable variation: room definitions choose a recipe and palette; level and
  platform IDs determine minor variations consistently between visits.
- Mirrors use the existing environment/reflection capture. They do not render
  a second camera view or promise a live reflection of Merc.

## Checklist

- [x] Generate original planter/frame reference images and three paintings.
- [x] Save image masters and prompts under `art/glass-adventure/v5`.
- [x] Submit two Meshy 6 image-to-3D tasks with PBR textures and bounded topology.
- [x] Download and inspect Meshy donors; finalize in Blender and preserve sources.
- [x] Export named reusable nodes and game-sized texture derivatives.
- [x] Integrate reusable decoration definitions, solid proxies and ready-state checks.
- [x] Integrate five deterministic floor recipes; remove replaced embedded petals.
- [x] Cull room groups conservatively using camera frustum and connected rooms.
- [x] Verify doors/windows, camera collision, loading and material disposal.
- [x] Capture actual rendered room views and compare identical workload poses.
- [x] Freeze source archive and visual evidence.
- [x] Prepare canonical dotfiles checkpoint and update the existing PR; pushed revision and CI status are recorded in that checkpoint.

## Boundaries

This is visual dressing and rendering work. Existing encounters, progression
gates and saves remain authoritative. Plants need explicit collision proxies;
wall art stays clear of movement and listening anchors. These paintings are
decoration, not implemented portrait rewards. Coins, graded collections, melody
imitation and recording/share mechanics remain in the previously saved plans.

## Implemented architecture and assets

Room prefabs declare decoration recipes, placement, orientation and optional
covered collision proxies. The composer transforms these with the room and
validates IDs and activation consistency. Stable roots belong to room groups
before asynchronous loading begins. Missing required nodes or paintings keep
the loading cover up; proxies disappear only when the declared art installs.

The V5 bundle contains a crystal-fern marble planter and a reusable ornate
gilded frame, generated with Meshy 6 for 60 credits total. Blender finalization
preserves the ornament geometry and 2K packed source textures while repairing
the frame inset. The runtime bundle
has 16,201 triangles, eight 1K texture images and occupies 9,240,644 bytes.
Three original paintings use separate 768 x 1152 WebP images. Painting and
mirror recipes replace only the frame's named inset surface, retaining its
gilt ornament and jade details. The mirror inset is isolated and made planar
and placed with measured clearance ahead of an overlapping donor cap. Flattening
alone left that cap in front of both the painting and mirror; actual game
screenshots caught the remaining defect before push.
Planter collision follows the bowl: 0.29m top
radius, 0.17m bottom radius, 0.48m height; leaves remain nonblocking.

The tutorial has welcome art and a mirror. The longer route has thirteen
decoration instances: four garden planters, two panorama planters, garden and
archive studies, a fictional singing-muse painting and mirrors. Room floor
recipes are stable across visits and leave IDs, collision and saves unchanged.
The previous V2 flower is part of batched material meshes, not an independent
node. A regression against the real donor protects removal of only its 1,872
central top-surface triangles, retaining the outer border and structural trim.

Visibility retains player/camera rooms, directly connected neighbors and every
room whose expanded rendered bounds intersects the camera view. This is
conservative room/frustum culling, not wall or portal occlusion. It avoids
missing scenery through windows and suppresses hidden group traversal for
main and shadow rendering. Camera collision remains independent of render
visibility. It does not yet stream assets out of memory or introduce LODs.

## Related loading and packaging repairs

The preceding PR run failed the narration browser test deterministically:
loading preparation called `cancel()`, which paused narration and consumed the
welcome before any gesture. The fix preserves an unattempted welcome when paused
while still consuming an in-flight welcome. A regression unit test failed before
the fix; all 13 narration tests and the unchanged browser reproduction now pass.

The actual games-enabled build also exposed a pre-existing packaging mismatch:
`requiredGameAssets` required a V2 runtime manifest that had never been written.
The manifest now records the 17 real V2 binary assets and their source hashes.
A regression checks every declared `games/` asset against the checked-in public
sources, rather than relying only on synthetic complete fixtures.

## Marble lighting polish

Fixed shadow receiver bias scaled to the authored shadow-map footprint removes
the large journey's diagonal floor bands. The compact legacy setting remains
unchanged. Controlled garden and portrait A/B images under `v5/proofs/shadows/`
keep identical scene geometry, camera and render counts; the change affects only
the bias. This is not a resolution, GPU-driver or performance fix.

## Verification and measured limits

- Required PR preparation and BesideCue/shared-package typecheck passed.
- Focused authoring, content, floor geometry, visibility, resource ownership and
  narration suites passed. The real-donor regression confirms the V2 rosette is
  removed without damaging the outer border.
- Native packaging tests passed (7/7), alongside game-asset plugin tests (9/9).
  A games-enabled production build passed, and `verifyGamesBundle` accepted its
  real output after the missing V2 manifest was added.
- Browser checks passed: unchanged welcome narration case; three legacy
  loading/retry/context-loss/leave cases; two legacy collision cases; authored
  First Light loading, skip and replay case.
- Twenty actual scene views at 800x600 and 390x740 loaded with zero reported
  asset or page errors: eight comparable journey views and twelve art/window/
  doorway inspections. These are fixed inspection poses, not a new full route
  playthrough or measured ten-minute journey.
- A second eight-view run intercepts only the visibility module to force all
  rooms visible. Geometry, materials and camera remain identical. The PNG pairs
  have 0% pixels differing by more than eight RGB levels at all eight poses.
  This supports absence of visible culling differences at these specific poses,
  not all possible camera positions.

| View             | Calls, all rooms to culled | Triangles, all rooms to culled |
| ---------------- | -------------------------: | -----------------------------: |
| Desktop entrance |                 550 to 544 |         4,729,682 to 4,721,610 |
| Desktop garden   |                 581 to 561 |         4,911,233 to 4,653,058 |
| Desktop portrait |                 340 to 235 |         2,802,217 to 1,865,769 |
| Desktop panorama |                 620 to 620 |         4,930,532 to 4,930,532 |
| Phone entrance   |                 252 to 138 |         2,194,482 to 1,321,362 |
| Phone garden     |                 490 to 470 |         3,819,777 to 3,561,602 |
| Phone portrait   |                 328 to 223 |         2,685,541 to 1,749,093 |
| Phone panorama   |                 580 to 580 |         4,559,840 to 4,559,840 |

The controlled comparison precedes the final planar-inset mirror polish.
Four targeted desktop/phone painting and mirror views in `proofs/inset-final/`
verify the finalized inset. The older pairs retain identical pre-polish assets
on both sides; they are not an exact final-asset benchmark.

Counts include rendering passes and do not measure frame rate. The new art
adds work compared with the earlier blockout in some views; conservative
culling is not a universal performance win against the less decorated version.
GPU memory is not streamed out. See `v5/proofs/visibility-comparison.json` for
the controlled comparison and `v5/proofs/capture.mjs` for the reproducible setup.

## Next tasks

1. Owner tablet/phone playtest: inspect each room, walk around planters, orbit
   toward windows/doors at multiple zoom levels, and revisit after Retry.
2. Measure sustained physical-device frame times, thermal behavior and initial
   loading before increasing art density further. Use those measurements to
   choose geometry LODs, texture compression and per-room shadow budgets. The
   panorama currently receives no culling savings.
3. Give the route a measured pacing/playthrough pass; keep it a development
   preview until duration, voice retries and device performance are accepted.
4. Return to the saved level/mechanics map for the next teaching level. Coins,
   optional breakable windows, grades, collectible portrait cards and recorded
   melody finales remain design follow-ups, not implementation in this pass.

No owner brainstorming or selection is needed to complete this visual pass.
The PR remains draft; commit/CI status is recorded in the canonical handoff.
