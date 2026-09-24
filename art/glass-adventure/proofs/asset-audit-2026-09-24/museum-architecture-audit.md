# Floating museum architecture audit

Date: 2026-09-24

## Scope and evidence

This audit covers the current journey assembly in `journey/models.ts`,
`journey/architecture.ts`, `journey/vegetation.ts`,
`journey/vegetation-placement.ts`, and `journey/water.ts`. It also reviews the
actual WebGL captures in `museum-components-2026-09-23/v10-desktop`, the matched
desktop and tablet vegetation captures, the supplemental orbit captures, and
`runtime-geometry-audit.json`. The three live-renderer side panels in
`waterfalls/` add direct origin-to-ending coverage for every authored
waterfall.

The screenshots are fixed stage views, not a complete walkaround. They support
the visible contact and composition findings below. The dedicated side panels
show all three waterfall endpoints, but the evidence still does not prove hidden
backsides or every bridge landing. Code assertions are identified separately
from visual observations.

## Repetition and instancing

The code uses two distinct forms of reuse. `authoredUnit()` clones an object and
shares its geometry and material buffers; it does **not** reduce draw calls.
`InstancedMesh` batches repeated transforms into one draw per donor mesh and is
the only reuse described here as instancing.

| Family                                                                         | Current mechanism                                                                                                                                                   | Finding                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three cliffs and three ivory terraces                                          | Shared-template clones, one transformed object per island                                                                                                           | Sensible exception at this count. The islands have different scale/yaw, remain separately cullable, and there is no measured journey bottleneck attributable to these six objects.                                                        |
| Gold trail markers                                                             | One `InstancedMesh`                                                                                                                                                 | Appropriate.                                                                                                                                                                                                                              |
| Stair treads, crystal shards, medallion studs, bridge deck/edge/finial repeats | `InstancedMesh` within each authored assembly                                                                                                                       | Appropriate. The two skybridges retain separate batches because their widths, curves, elevations, and parent transforms differ.                                                                                                           |
| Source ponds                                                                   | One `InstancedMesh`                                                                                                                                                 | Appropriate.                                                                                                                                                                                                                              |
| Three waterfall sheets                                                         | Three meshes with width/height-specific geometry                                                                                                                    | Sensible exception; these are transparent animated sheets with different dimensions. Mist/bubbles share one point draw.                                                                                                                   |
| V10 cypresses and Camellia clusters                                            | Actual donor-mesh `InstancedMesh` batches                                                                                                                           | Appropriate. Six Camellia transforms are retained, two per landmass.                                                                                                                                                                      |
| Journey rim planters created by vegetation                                     | Actual donor-mesh `InstancedMesh` batch                                                                                                                             | Appropriate. The focused test rejects leftover `map_planter` clones in this owner.                                                                                                                                                        |
| Glassworks entry-garden columns and planters                                   | Two column clones and two planter clones                                                                                                                            | Concrete small opportunity, not a current priority. Converting two copies saves at most one draw per single-mesh donor and requires changing the architecture owner, which was outside this bounded vegetation change.                    |
| Room decorations                                                               | Per-room opaque repeats use the new static decoration batch; painted, mirrored, transparent, refractive, skinned, morphing, and hidden-source parts stay individual | Correct ownership boundary. The six-planter proof measures 6 draws to 1 at the same 55,416 triangles with mean absolute channel error 0.000812/255. Cross-room copies remain separate for room culling and painting/reflection lifecycle. |

No broad architecture rewrite is justified by the evidence. If later profiling
shows journey draw submission is limiting, the first small candidate is the two
entry-garden columns plus two architecture-owned planters. The three landmasses,
stage roots, portraits, and cross-room props should remain separate until a real
profile demonstrates a gain that outweighs culling and lifecycle coupling.

## Support, contact, and intersections

The three terrace donors sit 0.035 m above their landmass anchors. Authored
building donors use a 0.02 m local base lift, and portrait/vegetation bases use
small deliberate surface offsets. In the reviewed V10 desktop and vegetation
captures, the visible pavilion, Twin, conservatory, stair, portrait, cypress,
and Camellia bases do not show an obvious daylight gap. The Glassworks and
Conservatory high-angle orbit views also show the reviewed flower pots supported
by the marble terrace rather than hanging beyond its edge.

The flower placement gate uses the measured `map_platform` local footprint
(half extents 1.644 by 1.233 m), the per-island terrace scale and yaw, and the
full conservative flower radius. Tests also require separation from every path,
stage medallion, portrait, source pond, architecture envelope, and retained
cypress footprint. The runtime result contains exactly six Camellia transforms.
Only one source-pond-adjacent candidate remains after all gates; First Light and
Twin pond candidates conflict with the combined support and clearance envelopes,
so their flowers move to supported terrace pockets. This is a deterministic
placement result, not a visual claim that every source area was seen from all
angles.

The Twin connector is deliberately offset forward and overlaps its two temple
halves structurally. The reviewed front and three-quarter views read as a joined
building; no obvious open seam or unsupported connector appears. Bridge tests
verify authored endpoints. The new waterfall side views expose the visible
bridge-to-cliff edges from three additional angles without an open seam,
floating rail, or cliff penetration. They still do not expose every underside
at a grazing angle. No contact fix is required from the available evidence; a
targeted low-angle capture remains the appropriate response if a player reports
a specific gap.

## Waterfall origins and endings

All three waterfall definitions have a source pond. Validation requires each
pond ellipse to overlap its waterfall lip and limits the vertical source-to-lip
gap to 0.25 m. The current authored gaps are 0.055 m, 0.055 m, and 0.075 m.
Sheets begin at the authored lip, dissolve at each `visibleDrop`, and share the
mist/bubble field at the lower end. There are intentionally no receiving basins.

The first dedicated side capture found a real visible defect that the overlap
validation did not cover: the circular source material starts its edge fade at
94% radius, and the Glassworks and Conservatory ponds appeared to stop on
marble before the terrace edge. The correction preserves the single shared
source draw and its material, but extends only the downstream center of the
source geometry into a tapered mouth. A focused regression transforms every
authored mouth into world space and requires the shader's non-faded core to
continue at least 0.20 m beyond the authored lip.

The refreshed live-renderer panels show the corrected complete treatment for
each fall. In `glassworks-falls.png`, the west pond now has a visible narrow path
to the side lip; its sheet clears the cliff face and resolves into the shared
particle field. `twin-falls.png` shows the source mouth at the broad front lip
and contains the full lower fade. In `conservatory-east-falls.png`, the east
pond visibly reaches the terrace edge before the sheet descends, fades, and
meets the particles. The cliff fascia occludes a short part of each vertical
turn from these high side views, but there is no longer exposed marble between
the pond mouth and its terrace lip. None shows a floating source, hard lower
cutoff, unintended receiving basin, or obvious cliff intersection.

The panels are 1000 by 1200 actual WebGL canvas captures. Their SHA-256 hashes
are `e6eb731697ca7df1e86b65a70d54ebb4c7cbb5e307929e0076e87ff6f63db82e`,
`2944c6cf53115e9ecf0b208f338fece14c364d7b7a53defebfcd3ea13339c5fc`,
and `1f24ad976048b2545960d1a7e0970e8bd8b879ba8a2b7a4ba45d5f2ca0e3f2f1`
respectively. `waterfalls/receipt.json` has SHA-256
`91bf4593625a462202300bd7843a1f7e04524e84a751be06e30ee6075896a46f`
and records the exact cameras, renderer, four served GLB hashes, and an empty
error list. HTML controls were hidden only during screenshots; the live
renderer, water animation, and scene materials were unchanged.

## Cliff and bridge variety

All three islands reuse `map_cliff_geometry_mesh_v4` with distinct scale and yaw.
That repetition is real. The current desktop, orbit, and waterfall side views
show the donor under distinct pavilion, Twin, and conservatory silhouettes with
different yaw, scale, ivy, bridge contact, and waterfall dressing. Direct
comparison can reveal the shared rock language, but the reviewed player views
do not show a repeated seam, support failure, or silhouette collision. A new
cliff family is not justified by the visible result.

The route has one lower curved promenade and two elevated skybridges. Their
widths are 0.72, 0.82, and 0.80 m; the two skybridges use different curve values
(-0.22 and 0.42) and different endpoint elevations. This is enough functional
variation for the current three-link route. The side panels show distinct
promenade and skybridge approaches against the cliff faces without an obvious
intersection. No additional bridge family is needed from the reviewed evidence.

## Geometry-screen finding

The runtime audit screened 25 mapped GLBs. No file contains non-finite vertex or
normal data. The only primitive above the one-percent face/vertex-normal
opposition screen is `map_cliff_geometry_mesh_v4`: 134 of 7,975 triangles
(1.6803%). The affected surface area is 0.33%, so the count is not evidence by
itself of an inverted shell; sharp-smoothed rock folds can trigger the screen.

Visible cliff portions in the V10 desktop and vegetation captures show no
obvious black void, missing patch, or reversed-light island. This observation is
limited to the rendered angles. Keep the source normals and use a targeted
diagnostic overlay if a specific patch appears in play; a blanket normal
recalculation is not warranted.

## Dense Marble budget recommendation

The archived standalone 2K Marble master is
`platform-trials/v7/exports/delivery/cloudway-marble-v7-dense-baseline-delivery-2k.glb`.
It is 44,277,888 bytes and 1,256,556 triangles, with an estimated 30.47 MiB of
decoded indexed geometry plus 64 MiB for three mipped 2K textures. Its 94.47 MiB
decoded estimate is useful for source-quality review, but it is not the current
combined runtime file.

The accepted runtime file is
`apps/beside-cue/public/games/cloudway-v7/cloudway-platform-kit-v7.glb`, SHA-256
`0f7a2129e7cd23b4148605a46d12fe28361d9ba632bea5d81d92142922fffee9`.
It is a 77,414,948-byte (73.83 MiB) combined kit. Marble retains the accepted
1,256,556-triangle geometry and geometry hash while its base, normal, and ORM
maps are 1K. Across every family, the kit contains 2,041,018 unique triangles,
49.24 MiB of decoded indexed geometry, and 218,103,788 bytes (208.00 MiB) of
estimated decoded texture mips; the geometry-plus-texture estimate is 257.24
MiB. These are loaded-resource estimates, not a device memory measurement.

The camera agent's browser submission receipt records six authored Marble
instances in the full layout, three submitted in the default, zoomed-in, and
challenge arrival passes, and two in the zoomed-out arrival pass. This confirms
that conservative camera/fog culling lowers per-pass instance submission. It
does not reduce the 73.83 MiB transfer or the decoded resource estimate. Treat
the accepted kit as the current dense-quality development candidate for the
owner's physical-device test. The evidence does not establish a general mobile
release budget.

## Vegetation proof delta

The accepted desktop and tablet captures use actual WebGL with no recorded page
errors. The matched desktop render moves from 259 to 255 draw calls, 4,620,533
to 4,417,240 pass-inclusive triangles, and 49 to 48 geometries while keeping the
same 46 textures and five water draws. Procedural pink spheres and faceted bed
leaves are absent when the V10 botanical donor is available; the fallback path
retains them when it is not. The default Twin composition and the visible
Glassworks/Conservatory contact were reviewed, while the deterministic tests are
the proof for all six transform clearances.

## Current-world stage-4 decision

The current desktop, tablet, orbit, and waterfall evidence covers the visible
stage-4 concerns. V10 cypress donors and six real Camellia clusters provide
foliage and flower-bed dressing in supported garden pockets; the reviewed views
keep paths, medallions, portraits, and tree trunks readable. Deterministic
clearance tests cover all six transforms where a fixed camera cannot. Pavilion,
Twin-gallery, conservatory, portrait, and medallion landmarks remain visually
distinct, supported, and unobscured in their reviewed compositions.

The three landmasses still share one cliff donor, but their scale, yaw,
architecture, ivy, bridge approach, flowers, and waterfall dressing produce
different visible silhouettes. The promenade and two skybridges show distinct
approaches without a visible contact defect. The refreshed source-mouth proof
now covers all three waterfall lips and lower dissolves. Within the reviewed
current-world views, no further foliage, flower-bed, landmark, bridge, cliff, or
waterfall correction is justified. This conclusion remains limited to the
captured player-facing angles and the stated geometric assertions; it does not
claim a hidden-backside walkaround.
