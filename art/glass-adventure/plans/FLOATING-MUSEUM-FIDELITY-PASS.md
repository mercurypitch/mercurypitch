# Floating Museum — concept fidelity pass

Approved 2026-09-21 from the owner's comparison of concept A with the first live
map. This follows the working navigation/water prototype. Preserve all four
playable gallery IDs, saves, independent access and selected Merc voice. Commit
reviewed stages to PR #807; no merge, release or store publication.

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

- [ ] Generate isolated temple, limestone cliff and cypress guides from concept A.
- [ ] Preserve exact prompts, untouched generated images and hashes.
- [ ] Submit Meshy tasks once, record task IDs and actual credit charges.
- [ ] Preserve raw donors; Blender normalizes metre-space, derives map LODs,
      retains packed authoring files, and exports named reusable groups.
- [ ] Inspect actual exported renders and record triangles, draws, textures,
      bytes, hashes and visual decisions before integration.
- [ ] Generate a sky-only cloudscape; keep buildings and water as live geometry.

Static architecture does not need the closed-fracture gate used for breakables,
but still needs sensible normals, complete textures, bounds and no visible holes
or detached garbage. Celadon production remains separate and must keep its
stricter hollow-vessel/fracture requirements.

## Implementation and review

- [ ] Scene: authored shared first island, central Twins, rear Conservatory.
- [ ] Camera: reference-facing overview at desktop/tablet; readable phone focus.
- [ ] Decoration: real medallion placement, architecture, monuments, gardens.
- [ ] Sky: bright cloud environment and visible depth without orange undercast.
- [ ] UI: immersive composition, wordmark, anchored labels, illustrated card.
- [ ] Preserve one renderer, one foreground clock, abort/late-load retirement,
      reduced motion, retry, touch cancellation and audio ownership.
- [ ] Actual desktop/tablet/phone screenshots compared with the reference.
- [ ] Check real mouse/touch selection and 320px layout without overlap.
- [ ] Record complete render counts including shadows; avoid claiming device
      frame rate from software-rendered proofs.
- [ ] Scoped checks, stage commits/pushes, current-head CI and new static preview.

The currently shared static HTTPS snapshot stays unchanged during construction.
Handoff the next snapshot only after the complete host has been inspected.
