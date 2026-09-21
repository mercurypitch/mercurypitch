# Cloudway Trials — optional platform journey research and art audition

Status: concept and research only, 2026-09-21. Owner requested prototypes before
mechanics/art approval, then Meshy models and Blender finishing. No platform-trial
runtime or paid Meshy job is authorized by this proposal alone. Existing standing
Meshy permission applies to accepted production tasks; this new mode has an explicit
concept-approval gate. Working name is provisional.

## The experience

A small authored journey between museum islands: Merc runs and jumps using ordinary
controls, crossing warm marble, frozen glass, drifting opaline rafts and crackling
crystal. Beautiful vases and portraits give familiar voice challenges a different
rhythm. This is a new optional activity, not a replacement for enclosed learning
chambers. Recommend a standalone map side-route first; after playtesting it can be
one possible Legend challenge for an already-completed gallery.

Keep a restrained, readable environment: white pearl clouds, distant temple domes,
warm Carrara landings, aged gold edges, celadon/teal opaline inlays and small botanical
pockets. Platforms have clear usable top silhouettes. Flowers, finials and sharp
crystals belong below or beside the landing surface, never where a foot must land.

## Visual audition

Built-in ChatGPT imagegen used the accepted museum concept as style reference and
the actual Merc animation contact sheet for mascot anatomy. Exact prompts and PNG
masters are retained in `../platform-trials/v1/concepts/`, with a hash manifest.
These are design illustrations, not existing screenshots or measured jump layouts.

1. **Platform family:** marble / frost / glide / crackle. Distinct material,
   edge and underside shape, legible without relying only on color.
2. **Cloudway route:** third-person scene from a safe singing landing toward ice,
   a moving raft, two cracking tiles and a portrait terrace; optional droplets on
   a side ledge. Image spacing is illustrative and must be rebuilt from jump tests.
3. **Crackle states:** intact / warning / release for one framed rectangular slab.
   Warning is a visible crack pattern and receding rim, not only an audio cue.

The family-sheet cracked rose slab and the state-sheet framed clear slab are two
related form explorations. Recommended production choice: the framed state-sheet
shape with the family-sheet subtle rose tint. The side rails on Glide should mark
its route endpoints in the world rather than read as wheels. Frost is visually
clear, but we must prove landing-edge visibility against clouds on an actual tablet.

## Reusable platform catalogue

All numbers below are starting design experiments, not committed physics tuning.
Use Merc's actual collider and current movement configuration as the scale source.

| Piece               | Player expectation                             | Runtime behavior                                                                    | Visual/audio contract                                                                              |
| ------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Marble rest landing | Safe to stop, listen and sing                  | Static support; checkpoint after each teaching segment                              | Ivory flat top, teal inlay, gold rim, small flowers outside travel lane                            |
| Frost slab          | Momentum carries farther but can be controlled | Reduced braking/turn acceleration with a bounded speed; no random direction changes | Etched frost and internal bubbles, thick legible bevel; soft slide sound never masking a reference |
| Glide raft          | It carries Merc steadily                       | Authored local spline or linear path, endpoint dwell and eased reversals            | Celadon top; stationary endpoint motifs; readable motion before jumping                            |
| Crackle tile        | Landing starts a clearly shown deadline        | Intact → warning → release → reset; support removed exactly at release              | Expanding cracks and segmented rim countdown, optional quiet ticks; bounded shards fall below      |
| Singing perch       | Target and mouth are visible                   | Static safe support, voice challenge and ordinary cinematic                         | Larger marble pad, short plinth, clear foreground/background separation                            |
| Portrait terrace    | Rest, finale and reward                        | Safe static landing; familiar completion/exit                                       | Upright branded portrait frame, gentle reveal and route back                                       |

Initial dimensions: normal tile about 1.4 × 1.8 m at current world scale; safe
singing landings about 2.4 × 3.0 m. Validate against the actual ~0.32 m collider
width and 0.5 m jump height. Never derive collision size from image proportions.
Start gaps well within the measured minimum-speed jump range, then author optional
extensions. Keep broad catch/reset behavior while prototyping.

## Suggested first trial: The Glass Ribbon

An approximately two-to-four minute target, to be measured after implementation:

1. **Arrival:** wide marble landing, skippable two-card explanation, familiar easy
   hold breaks a goblet. No timer while the player discovers the new environment.
2. **Frost:** two large icy slabs and a safe catch landing. Teach momentum with no
   simultaneous voice demand. Short direct retry, no lives or lost collectibles.
3. **Glide:** one moving raft; wait and see its path, cross to a singing perch and
   open a paired-vase gate. First encounter gives a generous endpoint dwell.
4. **Crackle:** two visible warning tiles, taught one at a time; reach safety before
   singing. The easy introduction uses a long forgiving window, tuned to actual
   traversal rather than a guessed universal timer.
5. **Finale:** stable portrait terrace, a short learned vocal phrase or hold. The
   optional Legend variant may replace one segment with a timed resonance test.

Add optional discovery droplets on one side branch, not over every required jump.
First pilot reuses approved vessels/portrait mechanics. Do not create a new judge,
new recording system and dynamic-platform physics in the same initial experiment.

## Timing and camera fairness

The user's timed singing idea belongs in an explicitly introduced optional advanced
segment. Beginner ice/moving/cracking lessons separate movement from singing. A
later timed singing platform offers a broad stable top while its rim slowly cracks;
success stabilizes it and opens the next jump. It cannot physically slide Merc off
while the current voice session locks ordinary movement.

- Explain and play the reference before arming a deadline. Microphone permission,
  calibration, asset loading, instruction reading and device interruptions never
  consume the player's time. One clear ready action arms the attempt.
- A timed voice attempt shows the target, Merc, platform edge and remaining warning
  continuously. The cinematic shot must fit the whole active hazard; it cannot pan
  away from imminent failure. Use a wider shot or the fixed route view if necessary.
- Once armed, the visible warning and judge use one attempt clock. Replaying the
  reference explicitly restarts that timed attempt, rather than secretly granting
  extra score. Capture timestamps determine evidence; late UI frames cannot erase
  a valid pre-deadline success.
- Success latches before support removal when its last accepted sample is within
  the deadline. The shatter celebration cannot make Merc fall. On failure stop
  capture, show the release, then return to the last safe landing without camera
  whipping, lives lost or erasing portrait/coin ownership.
- Pause/background freezes both platform simulation and attempt; resuming requires
  a short ready state. Never advance hazards by the whole hidden wall-clock gap.
- Practice can remove the timer. Legend records the exact timed profile; it is
  optional and never required to access the next ordinary museum level.

This recommendation follows the principle of making precise timing optional where
it is not the core activity. [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/do-not-make-precise-timing-essential-to-gameplay-offer-alternatives-actions-that-can-be-carried-out-while-paused-or-a-skip-mechanism/).

## Architecture gap: modular art is ready; dynamic support is not

Current `PlatformDefinition` is an axis-aligned static box with top/thickness and
completion-based activation. `stepMovement` uses bounded fixed steps, coyote time,
jump buffering and a `CourseCollider`; it has no support velocity, surface friction
profile or falling-platform timeline. This mode needs a real simulation addition,
not just an animated Meshy mesh sitting above an unchanged collider.

Proposed layers under the shared `packages/glass-game` package:

1. **Authoring:** `PlatformArchetype` describes material recipe, collision footprint,
   surface response and optional behavior. A placed platform adds a stable ID,
   transform, motion path or collapse profile. Level validation checks swept bounds,
   landing clearance, safe respawn, speed/period limits and assets. Existing static
   museum definitions remain valid without migration.
2. **Simulation:** a `PlatformSystem` creates current/previous support transforms
   and velocities at the same fixed step as Merc. Store supported platform ID and
   contact point. Apply support displacement before player's relative movement;
   deliberate policy for retained horizontal/upward velocity on jump. A platform
   moving down must not accidentally steal all jump height. No rotating supports
   in the first pilot; linear translation only.
3. **Collision:** render motion and collision share the same authoritative platform
   transform. Sweep Merc and support through each bounded step, handle platform
   pushing/headroom, and remove contact on release exactly once. No unstable mesh
   triangle colliders for art detail. Any rest-frame gap forgiveness must not bridge
   a deliberate jump gap or an already-collapsed tile.
4. **Surface response:** ice changes bounded acceleration and stopping parameters
   while supported; leaving ice restores ordinary behavior without a velocity snap.
   Keep air control separately authored. Do not alter global movement to imitate ice.
5. **Attempt orchestration:** trial checkpoints and hazard reset are separate from
   durable collectibles and tier evidence. A reset restores deterministic initial
   platform phases; otherwise timing differs unpredictably between retries.
6. **Presentation:** interpolate visual transforms between sim states; animate
   warnings and fragments from state transitions. GPU particles never decide a fall.
   Reuse the challenge-camera interface with an additional hazard framing envelope.
7. **Delivery:** shared web/native asset allowlist, local saves and optional entry
   from the map. No second game engine or host-specific simulation fork.

Godot's character documentation is a useful behavioral reference for explicit
support velocity and platform-on-leave policy; we are not adopting Godot.
[CharacterBody3D platform behavior](https://docs.godotengine.org/en/4.5/classes/class_characterbody3d.html).
The fixed-step and interpolated-presentation design follows the existing engine's
approach and the reasoning in [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/).
These sources inform the design; they do not prove the current custom engine already
supports moving platforms.

## Meshy and Blender production after approval

- Approve family silhouettes/materials and the one-trial flow first.
- Generate one isolated Meshy guide per platform (not the whole contact sheet).
  Commission the stable marble shell, ice shell and opaline frame, then derive a
  crackle variant in Blender from an approved parent so fragments match exactly.
- Retain original guide/prompt, raw donor, task/credit receipt, packed Blender file,
  PBR originals, optimized export and geometry/material proof. No assets live only
  in a tool cache. Use `art/glass-adventure/platform-trials/v2/` for production.
- Blender: metric origins at top-centre, deliberate snap dimensions, bevels/UVs,
  simple exported collision boxes, pivots, material slots and LODs. Platform motion
  is deterministic engine data; no baked rigid-body simulation drives contact.
- Build four-to-eight closed major fracture pieces for a collapsing tile and a
  bounded shared sparkle effect. Keep intact/warning/release variants aligned.
  No humanoid rig needed. Animation clips only for purely decorative mechanisms.
- Generate/bake tileable Carrara, frost normal/roughness, bubbles and crack masks.
  Keep stone matte; test clear ice against the bright sky. Share material atlases
  and instances; avoid many separate physical-transmission passes. Measure glass
  overlap and mobile cost before selecting final shaders.
- Target small reusable pieces (roughly 2k–8k triangles per primary piece as an
  initial budget, not a promise), 1k material atlases for ordinary tiles and one
  2k hero set only if close views justify it. Runtime download budget follows the
  measured pilot; source masters remain high quality in LFS.

## Gates and task list

- [x] Map current architecture and old voice/platform research.
- [x] Produce three branded imagegen auditions; retain exact prompts and hashes.
- [x] Document independent replay tiers, current-star migration and Legend options.
- [ ] Owner approves mechanics/visual direction and whether the first trial is a
      side-route or a Legend requirement. Recommendation: optional side-route first.
- [ ] Whitebox one safe segment with static + moving support; deterministic tests.
- [ ] Validate ice and breakaway behavior before decorative production integration.
- [ ] Produce approved Meshy/Blender kit and inspect actual landing surfaces.
- [ ] Integrate one short route with known held-note challenges and reusable camera.
- [ ] Measure real desktop/tablet controls, sustained rendering and microphone timing.
- [ ] Only then tune timed-voice/Legend variant and additional art sets.

Physics tests: ride without drift, jump/land on moving support, endpoint reversals,
frame-rate variation, bounded long frames, tiny seams versus deliberate gaps,
headroom/pushing, collapse exact timing, reset while airborne, pause/resume and
camera return. Voice tests: no timer during permission/reference, stale samples do
not win, a valid completion latches before the deadline, failure preserves collection.
Browser/device checks: touch movement plus camera visibility, legible warning without
sound or color alone, repeated falls/retries, and all visual/collision edges agree.

Prior research retained: `game-mechanics-research.md` proposed voice-created paths,
resonance and generous input windows. Reuse fresh pitch evidence, calibration,
short retry loops and anticipation/payoff. Voice-controlled movement and a demand
for stylistic fast vibrato are not carried into this manual-control route.
