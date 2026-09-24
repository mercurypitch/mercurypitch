# Glassworks: mobile performance and clear challenge progression

24 September 2026. Owner feedback after the PR807 recovery pass. This is the
next focused work item, before new levels or islands. It records unresolved
work, not a claim that mobile performance or these interactions are fixed.
The owner permits merging PR807 and handling this pass separately. The owner subsequently authorized games in Android and TestFlight testing
builds. Public release remains a separate decision. Native testing builds are
allowed before this performance pass so they can be measured on real hardware.

## Report and current evidence

- Mobile browser play is very slow. The exact device/browser and affected scenes
  have been requested; no physical-device profile has been captured here.
- Starting a vocal challenge near a vase/portrait is not discoverable enough.
- Merc can jump through the portrait; the end hoop does not complete the level
  when required glass remains. Do not treat this report as a completed-level
  trigger failure without reproducing with all requirements satisfied.
- Native BesideCue and the web route use the same shared WebGL game. A WebView
  wrapper is not a substitute for rendering optimization. Compare matched
  browser/native builds on the same hardware before attributing a difference.
- Cloudway explicitly permits traversal and safe checkpoints before singing.
  Three required encounters are ordered goblet, vase, portrait; the exit requires
  all three. Locked later encounters return no nearby actionable target, so the
  Sing offer disappears without explaining the missing prerequisite.
- The current Sing offer is a bottom-centre button. Its target must be within
  0.75 m of the authored anchor, grounded, at its floor height and fully on a deck.
  This is a narrow discovery condition, especially with touch movement.
- The accepted platform kit has about 2.04 million unique triangles and an
  estimated 208 MiB of decoded texture mip storage, before repeated draws and
  other scene resources. These are asset estimates, not measured phone GPU
  residency, visible triangle counts or frame rates.

## 1. Establish a reproducible mobile baseline

- [ ] Record phone/tablet model, OS/browser/WebView versions, viewport, DPR,
      orientation, power-saving state, route and build revision.
- [ ] Compare the existing dev preview with an optimized local games-enabled
      production build. Then compare that same build in native on the same device.
- [ ] Capture frame-time distribution and long frames on the map, a gallery and
      Cloudway: idle, walking/turning, entering a challenge, live singing, shattering
      and exiting. Separate initial load/compile stalls from sustained slow frames.
- [ ] Count draw calls and triangles across every render pass, not just the last
      renderer.info reset; include transmission, shadow and mirror passes. Record
      render target dimensions and texture/geometry estimates separately.
- [ ] Compare looking toward/away from the detailed kit and through room walls;
      then isolate resolution, shadows, reflections, glass and geometry one at a
      time. Keep the same route/camera for comparisons.
- [ ] Measure after warmup and over a five-minute session for heat/throttling.
      Aim for a stable 30 fps minimum on the selected target phone, preferably 60;
      establish a measured device budget before making a new blanket CI threshold.

## 2. Optimize rendering while retaining the accepted appearance

- [ ] Check actual camera-frustum culling and spatial bounds. Offscreen culling
      does not imply wall occlusion, skipped shadow work or skipped CPU updates.
      Repeated meshes must be grouped into useful spatial/room chunks.
- [ ] Add measured automatic/mobile quality settings for render resolution,
      shadow quality/update cadence, reflection resolution/cadence and costly glass
      effects. Preserve the high-quality desktop choice and all 2-pixel target guards.
- [ ] Cull rooms/route chunks and avoid animation/material work for hidden content
      where safe; keep challenge/collision simulation and microphone judging correct.
- [ ] Produce deliberate runtime LODs where geometry is the measured bottleneck,
      preserving silhouettes, relief, foliage and dense sources. Bake normal/detail
      maps and compare matched actual game views. No blind whole-shell decimation.
- [ ] Reduce texture residency/loading only with source-preserved derivatives,
      reviewed normal/roughness detail, correct mipmaps and an explicit asset budget.
- [ ] Verify reflection, shadow and transmission interactions; an object behind
      the camera may still legitimately cast a visible shadow or appear in a mirror.

## 3. Make starting to sing obvious on touch

- [ ] Keep a clear, reachable Sing action while approaching an available exhibit;
      use a visible ground marker and target highlight, with a forgiving safe approach
      area. Do not require users to guess an invisible precise anchor.
- [ ] Explain the locked state of a later exhibit: name the next required object
      and provide a short directional cue rather than hiding the action entirely.
- [ ] For touch, show a microphone icon and concise action without keyboard-only
      instructions. Retain F for keyboard. Ensure 44 px target size and no overlap
      with movement, Jump, Help, Tune, captions or browser safe areas.
- [ ] Keep explicit user intent for microphone acquisition; do not start capture
      just by walking past an object. Preserve the recovery/takeover flow.
- [ ] Verify the first encounter from a fresh save and from a zero-break resumed
      checkpoint, permission-denied recovery and each replay difficulty.

## 4. Make challenge gates and the finale physically coherent

- [ ] Add deliberate collision proxies for intact required portraits/frames and
      vulnerable exhibit volumes; remove only the broken parts after shattering.
      Avoid blocking the singing anchor, camera escape or safe return path.
- [ ] Present a clearly sealed exit until every required encounter is complete,
      with a concise remaining-object cue. Open the seal visibly after the portrait
      shatters. Optional discoveries and optional Encore must never block completion.
- [ ] Decide where required challenge completion should open the next route
      segment. Recommended: a visible resonance seal at each teaching station with
      a safe resting/singing platform, rather than allowing an unexplained run to
      the inert finale. Use existing reusable geometry before commissioning ice art.
- [ ] Keep checkpoints useful before the first break. If new physical gates make
      old saved positions invalid, restore the player to a safe reachable unlocked
      checkpoint without losing broken exhibits, earned rewards or recordings.
- [ ] Test touching/crossing/jumping through a locked exit, final-shatter unlock,
      entry from either direction, lingering in the trigger and jump/grounded exit.
      Completion and rewards occur exactly once; zero/partial breaks cannot finish.
- [ ] Test all prerequisites on fresh/resumed/easy/harder attempts, with galleries
      and the current Cloudway route using the same authored requirement contract.

## 5. Later concept: breakable ice walls

- [ ] Plan translucent ice panes/walls as authored vocal obstacles, with clear
      cracks, a satisfying fracture and a safe place to sing before the passage opens.
- [ ] Distinguish required route gates from optional discoveries in level data.
      Ice does not imply new scoring rules, forced loudness or timed singing on an
      unstable platform. Reuse the existing challenge judge and fracture lifecycle.
- [ ] Concept art, Meshy/Blender production, collision/fragment budgets and mobile
      acceptance come after the current performance and guidance pass. No new ice
      assets or levels are authorized by this note alone.

## Acceptance and scope

- [ ] Owner can discover the first Sing action unaided on a narrow phone, finish
      each required challenge in sequence and understand why the exit is sealed.
- [ ] Portrait collision, shatter and finale agree visually and physically.
- [ ] Before/after measurements show sustained improvement on the reported real
      device; desktop/tablet screenshots or software WebGL do not certify phone speed.
- [ ] Responsive checks cover narrow portrait and landscape layouts, real touch
      input and safe areas. Microphone evidence remains independent of frame rate.
- [ ] Retain current accepted fog, art sources, camera settings, saves and finite
      rewards. No additional islands, new levels, enemies or release scope yet.

Related plans: NEXT-MASTER-PLAN.md, OWNER-ACCEPTANCE-ITEMS-1-8-2026-09-24.md,
PR807-PREMERGE-REVIEW-2026-09-24.md and the game-asset production checklist.

## Bounded audit findings (24 September)

The camera/interaction and rendering audits were read-only. No fresh physical
phone measurements or new browser runs were claimed for this report.

- `cloudway-platforms.ts:107-116,255-318`: batches set `frustumCulled=false`;
  manual compaction tests only a 16 m camera radius, so behind-camera platform
  instances really are submitted. Use expanded-frustum per-instance filtering
  and retain shadow casters needed by visible surfaces; never blindly angle-cull.
- Existing per-pass receipts show roughly 10.08M–14.15M platform triangles
  submitted per frame across the screen and two offscreen passes at sampled
  Cloudway views. Unique kit storage is approximately 49.24 MiB geometry plus
  208 MiB estimated decoded texture mips = 257.24 MiB before driver overhead.
  These counts explain credible load; they are not device FPS measurements.
- `kit-instance.ts:19-47` makes donor meshes shadow casters/receivers; the main
  renderer updates a 1024-square shadow target each frame and uses physical glass
  transmission at half resolution. Lower target resolution saves fragments but
  not the repeated vertex submissions. Main DPR currently caps at 1.5 with AA.
- `cloudway-platforms.ts:255-359` rebuilds instance data once for world/camera
  work and once for final view compaction; profile duplicate CPU buffer/bounds work.
- Cloudway has no live planar mirrors, so reducing mirror quality cannot fix this
  route. Its compact reflection probe is generated once during loading.
- `cloudway-trial.ts:129-149` replaces the generic tutorial's explicit stand-on-
  circle-and-tap instruction. Its useful initial hint expires after five seconds.
  Add the literal touch action and persistent next-required-exhibit guidance.
- Cloudway objects are placed exactly at the 0.75 m limit from their interaction
  anchors; the visual pad radius is only 0.23. Current mobile CSS already hides
  F and raises the Sing button above the stick/Jump. No static CSS overlap was
  found; the missing action is principally eligibility and explanation.
- `cloudway-layouts.ts:397-458` creates only planter/landmark solids, whereas
  `museum.ts:287-317` draws fallback exhibit plinths and the portrait without
  matching collision. This is a real Cloudway mismatch. Authored galleries already
  have plinth cylinders and required room/portrait gates.
- Existing zero-break finale-save/backtrack coverage confirms no false completion
  or lost progress. Add a real-touch pad-to-Sing flow, since current Cloudway phone
  coverage exercises stick/jump rather than discovering a voice encounter.

Primary reference: Three.js Object3D.frustumCulled defaults to true, but explicit
batch overrides and per-instance bounds determine this runtime's behavior:
https://threejs.org/docs/pages/Object3D.html#frustumCulled
Native wrapper evidence is local: BesideCue capacitor.config.ts packages dist,
and AdventureScreen imports the same @irchiinnuss/glass-game implementation.
