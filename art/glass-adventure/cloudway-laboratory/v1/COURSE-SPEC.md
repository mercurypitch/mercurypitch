# Cloudway II — The Crystal Promenade

An exploratory second course for testing the approved platform family, separate from the current introductory Cloudway. The complete course remains an unshipped study; a bounded first slice with four accepted runtime assets is playable through the B-side Games Preview in games-enabled owner builds, and its development URL remains available. Its final dimensions depend on the reviewed Meshy donors, support anchors and measured jump envelope. [The editable course study](crystal-promenade.design.json) imports directly into the Level Studio and contains 27 pieces: 18 support regions, six route markers and three voice targets.

## Journey and pacing

The route curves left into a quiet garden landing, turns right across a scroll bridge, then arcs around a short pair of crystal steps to an elevated finish. The next landing and one beyond remain readable through the existing fog. Scenery must not expose the entire route at the entrance.

| Sequence         | Play and learning                                                                                                                           | Assets and placement                                                                                                                                                        | Recovery                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Arrival salon    | Hear the comfortable home note, sing to break the first vase. No timed pressure.                                                            | Pearl marble long deck, camellia vase, music stand and ribbon lantern. A balustrade frames the outer edge without covering the jumping edge.                                | Spawn and first saved checkpoint on static marble.                                                         |
| Frost bend       | Two gentle offset jumps teach takeoff and controlled landing. Show the next landing clearly.                                                | Frost lily step, emerald square turn, opal bridge. Rotate the long bridge along travel; square turn supplies room to redirect.                                              | Fall returns to arrival. No singing on slippery surfaces.                                                  |
| Scroll court     | Watch one complete extend/retract cycle from safety, then cross. Gold rollers and changing glass length make the cycle legible.             | Gilt scroll bridge between two static marble landings, hourglass beside the approach as a timing motif.                                                                     | Checkpoint before the mechanism. Never respawn on it.                                                      |
| Rose duet        | Rose step loses support after 2 seconds; lavender after 4. Keep a genuine gap between them and sufficient landing depth for touch controls. | Rose quartz and amethyst crackle platforms. A visible seam, growing crystal fissures and a quiet cue communicate timing; color is not the only signal.                      | Static catch landing after the pair. Leaving and landing again does not restart the same activation timer. |
| Listening garden | Calm rest and a second note. Inspect optional objects, then take the moving platform without a simultaneous voice challenge.                | Moonstone cross landing, celadon urn, lotus goblet, fountain basin and vine balustrade; aurora glide raft for the next crossing.                                            | Checkpoint on the static landing, outside the raft sweep.                                                  |
| Final terrace    | Three physical stair treads lead to a static finishing salon. Sing the final target, then enter the clearly unlocked exit.                  | Ivory stair terrace, rose mirror panel and an optional frosted-scroll-wall exhibit. Frame/pane are separate; do not make an unimplemented glass wall into a mandatory gate. | Final checkpoint before the singing target; exit requires completed mandatory targets.                     |

The 20 designs are an asset library, not a requirement to make every view busy. Repeated details should form a deliberate motif. Preserve clear landing silhouettes, approach sightlines, side challenge-camera space and generous stable areas. Optional props stay out of the jump corridor and the camera's close orbit.

## Timing and collision contract

- The scroll deck has a fixed center and configured local extension axis. Separate gold roller and deck nodes allow meaningful motion without stretching the engraved gold. Its walkable extent follows the visible glass on every simulation update. Stepping beyond the shrinking edge causes a normal fall. The pause state stops its clock.
- Begin with 4 seconds extended, 3 retracted, and 1.5 seconds for each transition, minimum extent 25 percent. These are editable trial values, not difficulty grades. Validate the entire crossing at the slowest supported movement preset before accepting them.
- The crackle 2/4 seconds measure **first contact to loss of support**, including the warning. Visible intact-to-shard swap and collider removal happen together. Authored checkpoint recovery restores their initial state deterministically.
- Use simple independent support/obstacle geometry. Dense ornament is never a movement collider or per-frame triangle-query requirement. Three stair treads need three contact regions. Cross-shaped landings must not acquire invisible support in the notches.
- Use actual visible deck bounds, excluding decorative fins and roller housings. Landings beyond moving platforms are static. Voice targets, exits, spawns and checkpoints always have static support and enough room for Merc's complete footprint.
- Measure jump range, diagonal control, air correction and moving-platform velocity using the current engine. First trials use a generous margin below maximum jump range; geometry is not accepted based on the top-down editor alone.

## Music and progression

Keep the initial melody configurable as relative semitones: home → major third → fifth (0, 4, 7), transposed within the player's comfortable calibrated range. This is a mechanical placeholder pattern for the course trial, not an approved final Merc song. The previously discussed melody-route options remain available for the owner's later musical choice.

Required singing takes place only at the arrival, listening garden and final terrace. The final portrait melody can replace the last single target once a recorded example and sung-input acceptance have been verified. Do not silently require an unfinished mechanic. The course stays a development selection until its art, route and unlock rule pass device testing.

## Production and acceptance order

1. Produce the scroll bridge and rose/lavender pair first at the requested dense quality. Inspect exported donors in clay and PBR, then split working parts in Blender. Reject melted scrolls, fused decoration, opaque painted glass or broken top surfaces.
2. Produce the remaining 17 designs. Keep donor GLBs and PBR maps in `source-assets/meshy/<id>/`; put packed Blender projects and export recipes beside their sources. Never overwrite a donor to save space.
3. Record contact anchors, physical dimensions, material slots, moving parts and intended collision shape for each delivery. Glass masters include prepared closed shards and intact bounds. Runtime GLBs are separate from source projects.
4. Bind the reviewed assets to the laboratory course with explicit IDs. Editor JSON is a design specification requiring engine adaptation and playability review; no arbitrary asset URLs or code execution.
5. Compare the image, donor, Blender export and real loaded scene at the normal camera and closest permitted inspection view. Save those comparisons with hashes. Measure loading memory, draw calls, shadows/reflections and fall/camera costs before shipping a delivery.
6. Test the whole route with mouse/keyboard and touch, including every fall/respawn, pause during scroll retraction, crackle timing, voice cancellation and final exit. Only then request the owner's next device test.

## Storage and current boundary

All full images, dense models, texture masters, Blender projects, turntables and animation masters belong in the shared Proton creative source tree documented in [README.md](README.md). Git holds this specification, metadata, receipts, compact previews and accepted build assets.

The 20 image references and 20 dense Meshy originals are complete. Packed Blender source preparation and semantic material/part authoring remain in progress. Four source-preserving runtime assets have passed the bounded first-slice contract: pearl marble long, gilt scroll bridge, rose quartz crackle fast and amethyst crackle slow. Acceptance applies only to those frozen GLBs and their declared contact surfaces; it does not imply that the remaining full-course library is playable.

## Editable study review

The 27-piece study passes the studio schema and top-view checks with zero warnings. One informational separation describes the raft crossing: the authored moving platform spans it during its travel. This was a top-view check; the subsequent simulation result is recorded below. A desktop import/fit screenshot is archived in `source-assets/proofs/course-design-2026-09-25/crystal-promenade-top-view.png`.

- The moonstone cross is three adjacent support rectangles (`garden-centre`, `garden-west`, `garden-east`), preserving its missing corners. They have no individual asset ID: the runtime adapter must render the single cross donor once across the composite.
- The ivory terrace has three distinct support elevations, 0.16/0.32/0.48 metres. One accepted stair asset must match these exact tread datums; the study does not repeat a full staircase on every tread.
- Scroll motion uses local X, with a fully extended 3-metre deck between safe approaches. The decorative rollers lie outside its certified walkable support.
- Rose and amethyst have a 0.5-metre edge gap. The approach and catch gaps remain below 0.8 metres in the sketch. These are provisional values requiring actual movement simulation, especially under a diagonal approach and slow touch input.
- The raft's static drawing is its near position; it travels 1.8 metres toward the terrace dock. The future runtime adapter needs explicit endpoint dwell rather than treating the editor's total duration as an unspecified easing curve.
- The final exit requires all three named voice targets. The schema records target order but does not implement exit or composite-asset behavior itself.

## Simulation checkpoint — 25 September 2026

`packages/glass-game/src/content/cloudway-laboratory.ts` holds the unregistered mechanical study. Its scoped traversal test completes the bent route at both 30 and 60 updates per second with zero respawns and measured pitch input at all three safe targets. It visits frost, scroll, both timed crystal steps, raft, and all three terrace treads. The reverse journey from an explored finale to the first unbroken vase also passes at both update rates. Recovery from an explored garden preserves the checkpoint without granting unbroken targets or completion. All five focused cases pass.

Every authored void is explicit, including the half-metre crystal-pair gap. The raft waits 1.5 seconds at each endpoint. The current flat-course controller requires a small jump onto each 0.16-metre terrace tread; the proof includes these jumps. This result covers fixed-step simulation, not touch-camera ease, loaded visual alignment, mobile frame rate or accepted art. The final dimensions must be reconciled with each Blender support surface while preserving ornament proportions.

All three study encounters deliberately use a comfortable held note. The editor's configurable 0/4/7 melody remains a musical design proposal; this study does not pretend that relative melody targets or a final sung phrase are integrated. Existing playable courses and campaign progression are unchanged.

## First-slice spacing checkpoint — 26 September 2026

The playable first slice keeps the stable `cloudway-crystal-promenade-first-slice` level and layout namespace and advances `contentRevision` to 2 for the topology change. Each wait or singing court joins two unscaled pearl donors into a 3.2 × 1.44 metre rest. Those joins are confined to the four static courts; challenge islands never touch. This replaces the earlier continuous stack of shallow pearl rows while preserving the accepted 3.2 × 0.72 × 0.34 metre contact declaration on every instance.

The full-extension scroll contact is 2.205964088 metres wide across X and 0.757494056 metres deep along travel after its certified quarter turn. It has a 0.70 metre edge gap before and after it. At 25 percent extension its travel-axis depth is 0.189373514 metres, so the normal walking jump that lands on the full deck misses the retracted landing window. The static training gap is 0.55 metres. The scroll catch to rose, rose to amethyst and amethyst to final catch gaps are each 0.50 metres; the measured 2-second rose versus 4-second amethyst separation therefore remains the half-metre gap specified by the full study.

| Platform centre       | X (m) |      Z (m) | Role                                     |
| --------------------- | ----: | ---------: | ---------------------------------------- |
| Arrival entry         | -0.85 | -11.160000 | Spawn row of the joined arrival court    |
| Arrival               | -0.85 | -10.440000 | First voice rest                         |
| Scroll approach entry |  0.15 |  -9.170000 | Landing row after the training jump      |
| Scroll approach       |  0.15 |  -8.450000 | Saved timing wait                        |
| Scroll deck           |  0.15 |  -7.011253 | Timed moving support                     |
| Scroll catch          |  0.15 |  -5.572506 | Landing row after the second scroll jump |
| Scroll court          |  0.15 |  -4.852506 | Second voice rest                        |
| Rose                  | -0.25 |  -3.172506 | 2-second crackle                         |
| Amethyst              |  0.25 |  -1.302506 | 4-second crackle                         |
| Final catch           |  0.85 |   0.107494 | Saved landing and final voice rest       |
| Final terrace         |  0.85 |   0.827494 | Joined exit row                          |

`CLOUDWAY_CRYSTAL_PROMENADE_MEASUREMENTS` is the code-facing source for these centres, certified dimensions and edge gaps. Checkpoints, voice anchors, the exit and presentation bounds derive from the same coordinates.

The focused traversal proof passes at both 30 and 60 updates per second. It requires jumps across every authored void, lands on the actual scroll support, remains grounded while the centred scroll retracts, and completes the whole route without a respawn when timing is correct. Separate regressions prove that walking cannot cross either 0.70 metre scroll gap, the normal jump fails during the retracted window, and the miss returns to `scroll-save` before the next successful full-extension attempt. The accepted-asset proof freezes all four GLB hashes and checks root identity, contact or support metadata, collider dimensions, scroll roller anchors and every rotated world-space platform footprint without scaling the art.
