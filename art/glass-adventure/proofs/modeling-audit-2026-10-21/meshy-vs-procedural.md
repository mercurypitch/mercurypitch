# Meshy or procedural: what two rebuilds showed

**Date:** 2026-10-22 · **Branch:** `feat/blender-modeler-skill`

The plan's verdict was to model the museum procedurally and keep generators for
organic pieces at most. Two shipped Meshy vessels were rebuilt from their
concepts with the `blender-modeler` skill and measured with the same gates, so
the choice rests on numbers rather than taste.

## The numbers

|                                                         | Opaline Echo Amphora: Meshy                                | Procedural                                                         | Amber Cadence Urn: Meshy   | Procedural                                      |
| ------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------- | ----------------------------------------------- |
| Silhouette against the concept (IoU, worst of 10 bands) | 0.948, +3.1% (fails the 3% gate)                           | 0.975, 1.0%                                                        | 0.930, +16.5%              | 0.988, 2.9%                                     |
| Intact triangles                                        | 8,728                                                      | 7,984                                                              | 9,864                      | 9,740                                           |
| Shard triangles                                         | 14,654                                                     | 12,580                                                             | 16,624                     | 15,724                                          |
| File                                                    | 3.81 MB, 1024 px JPEG textures                             | 1.67 MB, maps at most 512 px                                       | 3.74 MB                    | 1.61 MB                                         |
| Materials                                               | one glass material, gold and jade painted into its texture | glass, hammered and polished gold, jade, each its own PBR material | amber, cavity, cut; opaque | amber glass, marble, gold, laurel friezes, jade |
| Closed shells, clean shards                             | yes, after a repair pass                                   | yes, by construction (gated)                                       | yes, after a repair pass   | yes, by construction                            |
| Shard origin at its centroid                            | no (2 to 5 cm off)                                         | yes                                                                | no                         | yes                                             |
| A change                                                | a new generation, then repair, remesh and fracture again   | edit `build.py`, re-run, gates re-check                            | same                       | same                                            |

Measured with `validate_asset.py`, `silhouette_render.py` and
`silhouette_compare.py` on the shipped files and on the rebuilds; the rebuilds'
rounds are in `art/glass-adventure/procedural/*/LEDGER.md`.

## What each did well and badly

Meshy's strength was a painterly surface: the shipped amphora's opal texture
carried the concept's colour play, and the procedural build needed several
critic rounds of colour work, measured in the game's own renderer, to match it.
Its weaknesses were the ones the plan predicted: proportions off the concept
(the urn's lower body 16.5% too wide), invented detail (gold ribs between the
urn's lobes that the concept does not have), every material baked into one
texture, files more than twice the size, and a repair pipeline before any of it
could ship.

The procedural builds are exact to the runtime contract, symmetric, editable,
smaller, and fracture cleanly by construction. Their cost is look-development:
matching a painted concept's materials took most of the amphora's five rounds,
and the skill now carries the tools that shorten it (`three_preview.mjs`,
`--set` overrides, colour measured as numbers, the runtime proof).

## Recommendation

Stop using Meshy for shipped museum meshes. Vessels, architecture, plinths,
frames and props are lathes, sweeps and kit pieces, and the skill builds them
better and smaller. Organic ornament (a capital's acanthus, a figure, foliage)
is the one place a generator could still help, and only as a source to measure
or bake from, never as the shipped mesh.
