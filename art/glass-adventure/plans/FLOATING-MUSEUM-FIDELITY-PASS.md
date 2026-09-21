# Floating Museum — concept fidelity pass

Approved 2026-09-21 from the owner's comparison of concept A with the first live
map. This follows the working navigation/water prototype. Preserve all four
playable gallery IDs, saves, independent access and selected Merc voice. Commit
reviewed stages to PR #807; no merge, release or store publication.

The owner accepted the resulting V3 composition. This document preserves that
pass; current follow-up work is tracked in
[FLOATING-MUSEUM-POLISH-BATCH-2.md](./FLOATING-MUSEUM-POLISH-BATCH-2.md).

## Reference and diagnosis

Reference: `../journey-map/v1/a-floating-museum.png`.
Before: `../journey-map/v2/proofs/runtime/{desktop,tablet,phone}.png`.

| Element          | Selected concept                                                                 | First live build                                             | This pass                                                                                            |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Composition      | Three landmasses climbing left foreground to right distance; Twin halls dominate | Four similarly sized gazebos in a cropped horizontal panel   | Three visual landmasses; two separate First Light/Journey destinations share the left island         |
| Camera           | Lower oblique museum vista; central facade and bridges visible                   | High angle reveals roofs; right island dominates             | Authored overview, bounded orbit, responsive framing and labels projected from actual 3D anchors     |
| Sky              | Luminous pearl clouds, blue/lavender distance, warm sunlight at left             | Downward camera samples orange underside of the sky gradient | Original cloudscape environment plus separately moving cloud layers; blue-white lighting             |
| Brand            | Glassworks sun crest upper left in the sky                                       | Large editorial heading above the map                        | Compact gold Glassworks wordmark and sun crest inside the map                                        |
| Island titles    | Ivory/gold hanging plaques beside the islands                                    | Labels only in bottom rail                                   | Sharp, accessible projected cartouches, with rail/list fallback                                      |
| Path             | Wide marble promenade, arched bridge undersides, elevated gold medallions        | Thin connector slabs and tiny repeated dots                  | Readable medallions at actual destinations, continuous authored route and arched supports            |
| Buildings        | Substantial marble arches, statues, teal banners, closed glass domes             | Repeated open canopy skeletons                               | Dedicated Meshy temple donor with Blender finalization, paired amber/celadon halls and garden crown  |
| Cliff            | Jagged natural pale limestone spurs and ledges                                   | Broad low-poly tapered hull                                  | Dedicated Meshy limestone cliff donor, independent derivative and reusable geometry                  |
| Gardens          | Cypress trees, flowers, hanging vines, crystals                                  | Sparse small planters                                        | Repeated authored botanical assets, instanced foliage and trailing vegetation                        |
| Portraits        | Upright gilded mystery/earned monuments at route junctions                       | One dark frame, collectible only in HTML                     | Deliberate monument placements and readable mystery presentation; earned status remains save-derived |
| Selected gallery | Compact illustrated ivory card lower right                                       | Tall unillustrated right sidebar                             | Compact overlay card with gallery art, progress, and clear Enter/Continue/Replay                     |

The image's illustrative stars do not grant actual rewards. Historical/ungraded
completions still have no invented score. No new gameplay gates are introduced.

## Asset pipeline

- [x] Generate isolated temple, limestone cliff and cypress guides from concept A.
- [x] Preserve exact prompts, untouched generated images and hashes.
- [x] Submit Meshy tasks once, record task IDs and actual credit charges.
- [x] Preserve raw donors; Blender normalizes metre-space, derives map LODs,
      retains packed authoring files, and exports named reusable groups.
- [x] Inspect actual exported renders and record triangles, draws, textures,
      bytes, hashes and visual decisions before integration.
- [x] Generate a sky-only cloudscape; keep buildings and water as live geometry.

Static architecture does not need the closed-fracture gate used for breakables,
but still needs sensible normals, complete textures, bounds and no visible holes
or detached garbage. Celadon production remains separate and must keep its
stricter hollow-vessel/fracture requirements.

## Implementation and review

- [x] Scene: authored shared first island, central Twins, rear Conservatory.
- [x] Camera: reference-facing overview at desktop/tablet; readable phone focus.
- [x] Decoration: real medallion placement, architecture, monuments, gardens.
- [x] Sky: bright cloud environment and visible depth without orange undercast.
- [x] UI: immersive composition, wordmark, anchored labels, illustrated card.
- [x] Preserve one renderer, one foreground clock, abort/late-load retirement,
      reduced motion, retry, touch cancellation and audio ownership.
- [x] Actual desktop/tablet/phone screenshots compared with the reference.
- [x] Check real mouse/touch selection and 320px layout without overlap.
- [x] Record complete render counts including shadows; avoid claiming device
      frame rate from software-rendered proofs.
- [x] Scoped checks and new static preview.
- [x] Asset stage committed/pushed as `340b8139`.
- [x] Runtime stage committed/pushed as `8fa38d83`; the owner accepted the V3
      composition.
- [ ] Final Batch 2 CI acceptance. CI for the later documentation head
      `4f109ab0` failed the web heading, map-kit inventory and projected-label
      readiness checks. Batch 2 is fixing them; no final green result is claimed.

The currently shared static HTTPS snapshot stays unchanged during construction.
Handoff the next snapshot only after the complete host has been inspected.

## Production record

The three new Meshy jobs succeeded. Final and pre-remesh donors are archived in
`../journey-map/v3/meshy/`, with sanitized task receipts and content hashes.
They consumed 90 credits in total; the verified balance after archival was 4060.
Exact prompts and untouched image-generation masters live in `v3/concepts/`.
No credentials or expiring artifact links are stored in the repository.

The owner explicitly approved the exact Celadon guide upload and further Meshy
attempts as needed. The resulting opaque V3 trial completed, consuming 30
credits, and was rejected by the fracture geometry audit, including a remaining
self-intersection in its dense pre-remesh donor. It is archived and the current
game vase is not replaced. No upload approval blocker remains; production of an
acceptable replacement is still open. See the detailed V3 audit in
`v6-level2/production/`; do not confuse static map acceptance with acceptance of
a breakable vessel.

Batch 2 art checkpoint `619e41e4` preserves the packed V4 twin-finish source,
runtime GLB, amber/teal dome textures, botanical cluster, manifests and isolated
proof renders. Runtime integration and final Batch 2 review remain open.

## Runtime review, 2026-09-21

Final compiled screenshots and render receipts are in
`../journey-map/v3/proofs/runtime/`. All three views were inspected against concept
A, and the owner accepted this V3 composition. Desktop is 1600x900; touch tablet
is 1024x768; touch phone is 320x640. The phone
focuses its selected island; desktop/tablet retain the three-island overview.
The responsive sky plate crops without stretching, and trees/planters leave
clearance around raised medallions and portraits. Four chapter IDs, progress and
independent entry remain unchanged.

Validation: 31 focused unit tests across nine files; six journey browser cases;
then two final exact-center mouse/native-touch cases after raising the medallion
surfaces. Package typecheck, scoped lint/format, and the BesideCue production
build passed. Final compiled captures contain zero browser errors. At the
captured views, desktop/tablet render 178 draws and 317,628 triangles; phone
renders 132 draws and 272,947 triangles. Counts include the shadow pass.
SwiftShader evidence does not establish physical tablet FPS or thermal behavior.

Static HTTPS snapshot: `https://192.168.178.33:5292/glass-game/?campaign=1`.
Output directory: `/tmp/glass-museum-fidelity-final`. HMR is absent. Server was
started with a three-hour lifetime; restart instructions accompany the handoff.

The packed Blender source is
`../journey-map/v3/sources/floating-museum-sculpture-kit-v3.blend`. The 3,928,964-byte
runtime GLB and production receipt are in `v3/exports/`; public runtime bytes
match SHA-256 `a43c4f9693d97cb48c95cf644745244fa5461e339a606de004bf9c956de6194f`.
Untouched guides, final/pre-remesh donors and sanitized receipts remain archived.

## Remaining art and acceptance work

These follow-ups moved into the active
[second polish batch](./FLOATING-MUSEUM-POLISH-BATCH-2.md):

- The accepted V3 twin massing shared a celadon dome material. Distinct
  amber/teal dome art is pushed in `619e41e4`; Batch 2 runtime integration and
  compiled desktop/tablet/phone review are complete.
- Batch 2 adds finer medallion engraving and stars driven only by saved progress,
  without invented grades.
- Batch 2 maps the earned portrait onto its physical monument while retaining a
  mystery fallback for uncollected, failed and loading states.
- Batch 2 enriches flower beds, trailing foliage and bridge ornament from the
  reusable assets while retaining the accepted three-island composition.
- Owner tablet performance and Batch 2 playtest acceptance remain open. The
  independently rejected Celadon breakable remains a separate production task.
