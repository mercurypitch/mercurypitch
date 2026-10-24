# Meshy or procedural: what two rebuilds showed

**Date:** 2026-10-23 · **Branch:** `feat/blender-modeler-skill`

The plan's verdict was to model the museum procedurally and keep generators for
organic pieces at most. Two shipped Meshy vessels were rebuilt from their
concepts with the `blender-modeler` skill and measured with the same gates, so
the choice rests on numbers rather than taste.

## The numbers

|                                                         | Opaline Echo Amphora: Meshy                                | Procedural                                                         | Amber Cadence Urn: Meshy   | Procedural                                      |
| ------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------- | ----------------------------------------------- |
| Silhouette against the concept (IoU, worst of 10 bands) | 0.948, +3.1% (fails the 3% gate)                           | 0.976, 0.9%                                                        | 0.930, +16.5%              | 0.990, 1.6%                                     |
| Intact triangles                                        | 8,728                                                      | 7,988                                                              | 9,864                      | 9,632                                           |
| Shard triangles                                         | 14,654                                                     | 12,346                                                             | 16,624                     | 15,506                                          |
| File                                                    | 3.81 MB, 1024 px JPEG textures                             | 1.79 MB, maps at most 512 px                                       | 3.74 MB                    | 1.83 MB                                         |
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
smaller, and fracture cleanly by construction. Their cost is look-development,
and it is where both stopped: the critic loop ends after six rounds without a
SHIP, and both reached that with the form settled and a material open. The
amphora's opal reads darker than the wall behind it unless its colour play is
traded for brightness; the urn's amber glass reads as satin butterscotch in the
game, where clear glass shows the gallery through it. Both decisions are the
owner's, with the evidence in each `LEDGER.md`; neither shipped file is swapped. The skill now carries the tools that shorten it: colour
measured as numbers against the concept at the size the game draws it
(`colour_stats.py`), material and vertex-colour probes served into the running
game without a rebuild (`glb_patch.py`, `glb_recolour.py`, `runtime_batch.py`),
and `three_preview.mjs` for form and gloss.

## Recommendation

Stop using Meshy for new museum meshes. Vessels, architecture, plinths, frames
and props are lathes, sweeps and kit pieces, and the skill builds them better
and smaller. Organic ornament (a capital's acanthus, a figure, foliage) is the
one place a generator could still help, and only as a source to measure or bake
from, never as the shipped mesh.

Keep the two shipped Meshy vessels until their rebuilds' materials read right
in the game. The procedural geometry is ready; the glass is not, and the next
step for each is a material decision recorded in its ledger, not more
modelling.
