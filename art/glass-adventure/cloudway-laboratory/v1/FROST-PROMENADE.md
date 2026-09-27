# Frost Promenade — authored routes and breakable walls

This pass extends Crystal Promenade and adds a separate development route for
comparing turns and platform mechanics. It follows the tablet polish in PR867.
The existing campaign and unlock rules stay separate from these course previews.

## Two routes to test

| Route                       | Purpose                                                                                            | Development URL                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Crystal Promenade           | Familiar opening, a frost bend, a wall courtyard, a moving raft and a final landing                | `/glass-game/?layout=cloudway-laboratory`        |
| Promenade mechanics preview | The same components arranged across both world axes, with a sideways scroll and turning approaches | `/glass-game/?layout=cloudway-mechanics-preview` |

Games-enabled owner builds retain the Crystal Promenade Preview card. The second
route is development-only. Direct layout queries are ignored in production.
The primary course retains its existing save identity and accepted opening
platform IDs. Revision-3 partial saves recover on the same safe courts; finished
saves stay finished. Restart a finished preview to explore the extension.

The primary route keeps the scroll crossing and two-/four-second crystal pair,
then introduces slippery Frost Lily steps. A static court gives the player time
to sing through the frosted doorway. Beyond it, an Aurora raft carries Merc
toward the final landing. The alternate route tests those same mechanics with
cardinal turns rather than changing their timing or demanding harder singing.

## Authoring boundary

The runtime source is
`packages/glass-game/src/content/data/cloudway-crystal-promenade.course.json`.
It uses schema `mercurypitch.cloudway-course`, version 2. The compiler validates
it against code-owned profiles in `content/cloudway-laboratory-profiles.ts` and
`content/frost-wall-profile.ts`.

JSON owns placement, quarter turns, behavior timing, named encounters, safe
checkpoints, camera sections, prerequisites and the exit. Profiles own measured
contact dimensions, supported behaviors, art IDs and the wall's frame/pane
collision. A designer moves a certified component instead of separately editing
its visible mesh scale and collider.

Explicit gaps name the platforms, contact state and distance. The compiler
measures them and rejects discrepancies, unsupported profile combinations,
unknown references, cyclic encounter prerequisites, missing camera coverage and
unsafe singing/checkpoint anchors. Singing and respawn courts must fully support
Merc on ordinary static footing. Frost, scroll, crackle and moving platforms
cannot host these anchors.

The private level studio remains a design tool. Its existing exports are not
silently treated as this newer runtime schema. Translate a design into the
reviewed source document, regenerate the maps and run traversal tests before
shipping it. The strict compiler is reusable by a future studio exporter.

Generate actual compiled-contact maps from the repository root:

```sh
rtk proxy node --experimental-strip-types art/glass-adventure/cloudway-laboratory/v1/production/render-course-maps.mjs
```

See [primary route](course-maps/cloudway-crystal-promenade-first-slice.svg) and
[mechanics preview](course-maps/cloudway-crystal-promenade-mechanics-preview.svg).
These diagrams show contact geometry and movement endpoints, not an art render.

## Wall and shatter behavior

The frost wall has a persistent ornate frame, one intact pane and 32 prepared
closed fragments. The frame keeps its side/top collision after completion;
only the pane gate disappears. Its measured envelope also drives camera
framing. Loading a completed encounter shows the open frame without replaying
the burst. No dense mesh is fractured or used for movement collision at runtime.

Break effects use crown, radial, sheet and ice-wall profiles. Deterministic
per-exhibit variation changes the trajectories; bounded instanced chips and
glints add smaller detail without a draw call per particle. The shared burst
ends after 2.3 seconds. Reduced motion omits the small particle layer. Materials,
buffers and cached bounds have explicit ownership and teardown.

The moving raft uses the same fixed-step displacement for the rider and visible
model. Jumping carries bounded horizontal takeoff momentum once per jump; it
does not accumulate while standing or repeatedly pressing jump. Pause and voice
challenge states freeze platform movement. Rigid repeated pieces use instancing
with frustum/fog selection; hidden render instances do not remove gameplay
collision.

## Device test sequence

1. Start each route, then try its first turn using touch and keyboard. Check both
   camera modes, including manual camera override and recovery.
2. On an ordinary stone court, jump near an outer edge and deliberately land
   just short of the next court. A supported jump should land; a miss should
   strike or clear the side, never sink through the slab.
3. Cross the scroll at full extension and from each roller edge. Walk off a
   retracting edge and confirm the fall returns to a safe checkpoint.
4. Cross the pink/purple pair, then the Frost Lily steps. The deliberate gaps
   require jumps; icy control should ease back to normal on the next stone rest.
5. Approach the wall without singing: its pane must block passage. Start the
   challenge on its safe court, sing the target, watch the burst, then pass
   through the opening. The gold frame should remain and should still collide.
6. Reload after breaking the wall. The same checkpoint and open passage should
   restore immediately, without another burst or invisible pane.
7. Ride and jump from the Aurora raft in both travel directions. Confirm that
   its visible position, footing and takeoff agree. Fall and retry once.
8. Complete all required targets and enter the finale. The exit must remain
   locked while a required encounter is incomplete.

Desktop hardware proof and automated simulation establish different things.
Neither substitutes for Android/iPhone frame-time and touch acceptance. The
opt-in browser proof records real GPU identity, loading time, challenge-entry
latency, long tasks and before/during/after/restored wall captures:

```sh
rtk proxy timeout 600 env DISPLAY=:0 GLASS_FROST_RENDER_PROOF=1 BESIDE_CUE_E2E_PORT=5611 pnpm exec playwright test e2e/glass-adventure-frost-promenade.e2e.ts --project=chromium-adventure --workers=1
```

Run that command from `apps/beside-cue`. It uses a synthetic microphone tone to
exercise the real audio pipeline and refuses a software GPU renderer. It is
opt-in because normal CI cannot claim hardware rendering performance.

## Source preservation

Dense Meshy donors, original maps, packed Blender projects and full proof images
remain under the ignored Proton-linked `source-assets` tree. Accepted runtime
GLBs belong under `apps/beside-cue/public/games/cloudway-laboratory-v1` in Git LFS.
Delivery reports record source hashes, material roles and export settings.
Their original pending-review statuses are historical production receipts; the
delivery verification below and linked hardware receipt record final acceptance. The
wall's new pane and fragments are authored derivatives; its ornate outer frame
retains the donor detail. Rejected previews remain archived for comparison.

## Delivery verification — 27 September 2026

The shared game suite passes 988 tests across 137 files. The host route selector
passes its five cases. Actual GLB tests verify material roles, quantized geometry,
wall dimensions, clear opening and all 32 closed fragments. Independent review
covered the compiler, moving contact, camera, resource ownership and source-geometry
preservation. The code-health ratchet passes without a baseline update.

Six hardware browser cases cover both routes and camera modes, restored passage,
and Frost/Aurora gameplay views. A separate run exercises the existing goblet,
vase and portrait through their actual voice and break lifecycle. See the compact
[hardware receipt](production/reports/frost-promenade-hardware-proof.json).
Wall challenge entry measured 48–133 ms on the desktop AMD GPU; the existing
encounters measured 38–241 ms. No challenge long tasks were recorded in those
runs. Device performance remains an owner acceptance step.

Visual inspection caught and fixed a loader defect before delivery: transforms
were being written into quantized integer geometry before float promotion,
compressing the new wall. Position, normal and tangent attributes now promote
before transforms; source data and authored UVs remain intact. Regression tests
exercise the actual shipped quantized wall as well as synthetic geometry.

## Edge-contact follow-up

A real-keyboard jump reproduced a descending body missing strict top support
while still overlapping the platform side. Post-descent recovery previously
handled only props. Platforms now separate that missed landing from the slab,
while successful landings keep the same foot-centre support rule. Connected
shallow steps remain walkable. Only the exact bordering rims of a marked gap
that the body spans simultaneously keep the existing narrow-gap fall behavior;
ordinary jump gaps still have solid landing edges.

The automatic browser solids suite includes a successful landing, a grazing
outer edge, a clear miss and a short approach to the next actual Pearl platform.
These use keyboard input on the compiled course. Core regressions cover both
30 and 60 Hz, moving contact, shallow roller steps, props and intentional gaps.

The Pearl donor's continuous top was also wider than its contact metadata. A
measured local presentation fit maps its 3.32 × 0.78 m near-datum ledge to the
existing 3.20 × 0.72 m course contact, preserving height, source geometry,
materials and authored gap sizes. The lower ornamental rim remains visible;
it is not advertised as extra landing space. Decoded-GLB corner rays cover the
fit independently of metadata.

Follow-up validation: 78 focused collision/course tests, 10 asset/presentation
tests, six automatic real-input browser cases and four actual-raster AMD GPU
cases pass. Independent review is clear; see the
[edge-contact receipt](production/reports/platform-edge-contact-proof.json).
Physical-device retesting remains an owner acceptance step.
