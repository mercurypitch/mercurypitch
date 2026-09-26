# Tablet navigation and platform polish

Status: implemented after the Android build 636 playtest, with final review and
PR gates in progress on 27 September 2026. Physical-device acceptance remains
pending. This pass follows the merged camera and first-slice work. Device
feedback supersedes its earlier visual/collision acceptance where the contracts
below differ.

## Current PR acceptance

1. **Passage camera.** In enclosed galleries, sustained travel should bring the
   view behind Merc's facing and smoothly shorten its distance in a narrow
   passage. Obstruction handling must keep the near plane clear of walls and
   ceilings, avoid oscillation at doorways, and restore distance gradually when
   space opens. Automatic camera rotation must not curve unchanged movement
   input. Manual inspection while standing still remains possible.
2. **First-person option.** Third-person remains the default. A persistent
   pause/settings option selects first-person; V provides the same action when
   gameplay owns keyboard focus. Use a stable eye-height pivot rather than an
   animated head bone. Merc must not obscure the view. First-person singing
   frames the target without switching to a side cinematic. Pause, modal focus,
   checkpoints and switching back must retain predictable input ownership.
3. **Touch ownership.** Show an understandable neutral movement affordance.
   A movement contact starts inside the lower-left control region and remains
   owned until release/cancellation. Right-side look and Jump have separate
   contacts. Releasing movement must not enable a persistent global move mode.
   Test a second finger both before and after acquiring movement, rapid
   reacquisition, neutral input, pause, blur and native backgrounding.
4. **Scroll geometry and contact.** Extend the usable scroll length along travel,
   preserve engraved roller proportions, and increase approach/catch separation
   only within the measured jump envelope. The visible rollers are physical:
   Merc must land on their upper support and collide with their sides rather
   than fall through them. Rendered motion and colliders use the same transforms.
   Audit every current platform variant, rotated instance and moving phase;
   preserve real voids and deterministic crackle support removal.
5. **Repeated singing stall.** Profile entry and at least three consecutive
   encounters in the unlocked introductory Cloudway, separately from Promenade.
   Distinguish main-thread/GPU stalls from microphone/audio waits. Fix the
   measured cause without hiding errors, decimating accepted art blindly or
   starting the microphone before the player's action. Capture reproducible
   evidence and regression tests; desktop or software rendering cannot establish
   physical Android frame times.

Changing course geometry requires a content revision and safe checkpoint
validation. Campaign achievements and previously earned exhibit completion must
not be silently reset. Actual before/after screenshots and measured collision
probes complement simulation tests; a top-down layout alone is not acceptance.

## Singing-stall evidence — 27 September 2026

A matched loaded-scene CPU profile reproduced the first-encounter freeze while
WebGL draw submission was suppressed. With Cloudway's dense visual platform
donors still in the cinematic camera query, all 235 planner rays included those
donors and took 4,785.5 ms; the click reached voice mode in 4,904 ms and the
browser recorded a 4,807 ms main-thread task. Excluding only the visual donors
left the authored physical proxies and the rest of the scene unchanged: 237
planner rays took 42.4 ms, the first click reached voice mode in 192 ms, and two
same-vessel restarts took 182 ms and 206 ms while reusing the cached camera
plan. Merc/vessel bounds traversal took 10.1 ms before the change and 19.3 ms
across all six post-change samples. Synthetic microphone acquisition took 1.2
ms, while sampled audio-context resumes took 0–56 ms. Three distinct authored
encounters on a physical Android tablet remain an acceptance check.

The renderer now keeps dense platform presentation meshes out of camera
collision and updates cheap platform proxies from the same runtime bounds used
by collision. This preserves glide motion, scroll deck length and roller
support while avoiding triangle-scale camera planning. Focused renderer and
proxy tests pass, including an integration regression that verifies installed
Cloudway donor batches never enter `museum.cameraOccluders()`.

These profiles establish the synchronous camera-ray cause for the reproduced
desktop CPU stall. They used Chromium SwiftShader and suppressed draw calls, so
they do not establish target-device raster or Android timing. In the same
diagnostic, route ready took 3.48–4.09 seconds: the reported asset-loading phase
took 2.02–2.23 seconds and awaiting-first-frame took 0.53–0.58 seconds. That is
only a CPU/loader boundary; physical-tablet startup remains a separate gate.

A separate real-raster run verified ANGLE on an AMD Radeon RX 9070 XT and
opened the three distinct authored targets through legitimate saved
checkpoints. Arrival goblet, crossing vase and finale portrait reached voice
mode in 164 ms, 43 ms and 219 ms; their page-ready times were 3.87 s, 2.70 s and
2.64 s. Challenge-window long tasks were 52 ms, none, and 187 ms. The three
screenshots contain rendered scene pixels and the matching voice panels. This
is desktop hardware evidence with page reloads between targets, not one
continuous traversal or physical Android acceptance.

Exact reports, hashes, the bounded harness and its repeat command are archived
under
`source-assets/proofs/runtime/cloudway-sing-stall-2026-09-27/`.

## Follow-up: turn the Promenade into a useful mechanics bench

The compact slice currently proves four art deliveries, not the complete
platform library. Expand the same exploratory course in bounded sections after
its controls, contact and encounter performance are reliable. Keep each trial
legible through fog, with a stable recovery court between mechanisms.

| Section                 | Trial                                                                 | Required foundation                                                            |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Arrival court           | Safe movement, jumping and one short vocal target                     | Clear controls and responsive encounter entry                                  |
| Frost bend              | Offset jumps, then a gentle curved route with slippery footing        | Frost donor accepted at runtime; explicit visible support                      |
| Scroll crossing         | Watch the cycle, jump onto the extended deck, cross to safety         | Physical rollers, longer deck, real gaps and fair recovery                     |
| Crystal duet            | Rose releases after 2 seconds; amethyst after 4 seconds               | Readable cracks and contact loss in the same simulation update                 |
| Ice-wall court          | Sing from a stable pad to shatter a framed ice panel and open passage | Independent pane/frame, prepared shards, saved gate state and collider removal |
| Moving crossing         | Board a raft, ride it and jump to a static catch                      | Shared visual/contact motion and inherited platform velocity                   |
| Optional exhibit alcove | Extra floor vase or wall glass for inspection and voice practice      | No progression deadlock; props outside jump and camera corridors               |
| Finale court            | One finishing vocal challenge, then the unlocked exit                 | All required encounters declared explicitly; safe saved checkpoint             |

The ice panel should initially teach one already-supported held-note challenge.
It is a physical gate, not a new pitch detector. Its frame stays intact, while
pane/shards and solid-gate state resolve from the same completion event. A
checkpoint restored after breaking it must retain the open passage. No singing
is required while a floor is retracting, moving or collapsing.

Finalize existing dense Meshy donors in Blender before generating replacements.
Keep full-resolution source models, textures, packed projects and review renders
in the Proton-linked source archive. Deliver accepted runtime assets with contact
anchors, exported bounds, hashes and actual device-budget evidence. Introduce
new mechanism sections one at a time so the course remains a useful test bench
instead of an unexplained catalogue of obstacles.

Future melody-generated routes, custom sung finales and branching animated
crystal interiors remain separate design tasks. They do not block this polish
PR, and this document does not claim those systems are implemented.
