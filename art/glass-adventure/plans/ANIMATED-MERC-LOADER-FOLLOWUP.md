# Animated Merc loader follow-up

**Status:** Implemented and locally verified. The owner accepted the loading
portrait and progress presentation on 2026-09-21. All required CI passed on
`3457a7cd`; sustained physical-device memory/heat checks remain separate. No Meshy rigging
task was submitted; the existing custom Merc rig is preserved.

**Updated:** 2026-09-21

## Implementation checkpoint

- [x] Author and verify welcome/laugh clips; preserve old clips and sculpt source.
- [x] Share the game's Merc material identity with a temporary 3D loading preview.
- [x] Track unique completed asset installations; preserve retry and reveal guards.
- [x] Integrate the clear progress track and reduced-motion/fallback presentation.
- [x] Verify actual desktop, phone, tablet and short landscape output; error/retry.
- [x] Prepare a separate static HTTPS testing preview on port 5296, without HMR.
- [x] Owner accepted the loading portrait and progress presentation.
- [x] Final loader revision `3457a7cd`: all required CI including PR Gate passed.
- [ ] Owner tests repeat entry/retry/leave on a physical tablet/phone.

The accepted museum snapshot is unchanged. Sources, hashes, contact sheets and
six real compiled browser captures are in
[`../loader/v1/`](../loader/v1/README.md). The runtime GLB is 431,512 bytes;
welcome/laugh playback durations are approximately 1.633/1.233 seconds under
the existing frame-one glTF export convention. The extra frame is documented
separately from the authored 1.6/1.2-second spans; old clips were not retimed.

The loader preview is disposable and optional; only game asset installation
and the existing successful-frame/minimum-time boundary determine reveal.
Retry mounts a fresh canvas. Failed required textures now keep their shared
installation prerequisite handled while model downloads finish, avoiding an
unhandled browser rejection while retaining the visible Retry/Leave error.

Focused progress and preview lifecycle tests, actual-rig checks, shared/mobile
typechecking, both host builds and all five loading browser scenarios passed.
Six compiled visual captures have no page errors or horizontal overflow.
These are Chromium software-renderer proofs, not a physical memory/heat test.

The sections below retain the approved design and pre-implementation research.
The checkpoint above and versioned source receipt describe the delivered state.

## Recommendation

Use the shipped Merc GLB and its existing custom rig. Add one authored
`welcome` clip and, after the first motion proof is verified, an optional short
`laugh` clip in the existing deterministic Blender pipeline. Show that actual
GLB in a small loader-owned Three.js canvas on the left, retain the current
right-hand title and detail copy, and turn the existing brass keyline into a
left-to-right readiness track. The track must advance only when declared load
work has decoded and installed; it must not show a numeric percentage.

Do not send Merc through Meshy auto-rigging. This is a compatibility decision,
not a credit decision. Merc is a limbless droplet with two floating hands, a
five-bone character-specific skeleton and facial morph targets. Meshy's API is
documented for textured standard humanoid bipeds with clear limbs, and its
Animation API accepts the ID of a successful Meshy rigging task rather than an
arbitrary existing GLB rig. Re-rigging would risk the silhouette, floating-hand
motion, facial expressions, clip names and runtime material contract while
providing no advantage over the source pipeline already in the repository.

## Pre-implementation Merc baseline

The runtime asset is
`apps/beside-cue/public/games/glass3d/merc.glb`:

| Property                 | Measured value                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Size                     | 416,672 bytes                                                                                       |
| SHA-256                  | `6adbec86f156ec98e770e240e56702eae05c4436e17291699749b5cb9725d6b2`                                  |
| Geometry                 | 12,178 triangles across `merc_body`, `merc_face`, `merc_hand_l` and `merc_hand_r`                   |
| Rig                      | One skin; joints `root`, `base`, `head`, `hand_l`, `hand_r`                                         |
| Face                     | Three morph targets: `blink`, `wide`, `sing`                                                        |
| Clips                    | `sing` 1.000 s, `listen` 1.333 s, `celebrate` 1.067 s, `move` 1.367 s, `fall` 1.400 s               |
| Materials                | Embedded `merc_eye`; body and hands deliberately receive the iridescent mercury material at runtime |
| External images/textures | None                                                                                                |

The exact production derivative is also
`apps/beside-cue/art/merc/merc.opt.glb`; it has the same byte count and hash as
the public file. The unoptimized `merc-preview.glb` is 436,656 bytes with SHA
`f5bb980728a91101129565eb75ac689dab7796981bab09e0d816667fdbc4e903`.

The source path is unusually strong for an animation follow-up:

- `apps/beside-cue/art/merc/make_merc.py` builds the face, five-bone rig,
  weights, morph targets and named NLA clips. Its `bkey`, `face_key`,
  `blink_at` and `stash` helpers already produce one combined glTF clip from
  armature and facial channels.
- `apps/beside-cue/art/merc/merc-sculpt.blend` is the committed, decimated
  stage-one sculpt cache, 332,791 bytes, SHA
  `a6a46d5da588aa2077d43b203fadf8ee3a7030c0d5270e649600a1cba132de04`.
- `apps/beside-cue/art/merc/merc.blend` is the committed stage-two rig and
  animation source, 418,291 bytes, SHA
  `5093b85d8fd6195439891911a3942c7c575d4134d3f54169719cf6ee99d624a0`.
- `apps/beside-cue/art/merc/preview.py` renders fixed telling frames from named
  NLA tracks. It is the right place to add welcome/laugh proof frames.
- `apps/beside-cue/scripts/assets-merc.sh` runs the Blender build and preview;
  `apps/beside-cue/scripts/assets-glass.sh` deduplicates, prunes and welds the
  GLB before copying it to the runtime directory.

The current renderer already proves the runtime contract. Adventure Merc in
`packages/glass-game/src/render/merc.ts` preserves `merc_eye`, applies the
iridescent `MeshPhysicalMaterial` only to body/hands, plays the named clips with
an `AnimationMixer`, and disposes its resources. Journey Merc in
`packages/glass-game/src/journey/merc.ts` uses the same asset and material
identity. The actual-asset regression in
`packages/glass-game/src/render/merc.test.ts` samples the delivered rig through
grounded clips and repeated jumps. The separate 240-frame proof at
`art/glass-adventure/journey-map/v4/proofs/merc-centering.json` measured less
than 0.005 m of lateral body drift at all four journey destinations.

The stale "node-transform clips, no rig" comment in
`apps/beside-cue/src/games/glass3d/assets.ts` has been corrected; the delivered
GLB contains one skin and five joints.

## Official Meshy API findings

Primary sources reviewed on 2026-09-21:

- [Rigging API](https://docs.meshy.ai/en/api/rigging)
- [Animation API](https://docs.meshy.ai/en/api/animation)
- [Animation library reference](https://docs.meshy.ai/en/api/animation-library)
- [Text to Motion API](https://docs.meshy.ai/en/api/text-to-motion)
- [API pricing](https://docs.meshy.ai/en/api/pricing)
- [API asset retention](https://docs.meshy.ai/en/api/asset-retention)

The relevant constraints are explicit:

1. Rigging supports textured humanoid GLBs and currently works well only for
   standard bipeds with clear limbs and body structure. Non-humanoids,
   untextured meshes and unclear limb structures are listed as unsuitable.
   Merc meets two of those exclusion conditions: he is non-humanoid and his
   body/hands have no texture asset because their mercury appearance is a
   runtime shader.
2. A direct `model_url` must be a public URL or data URI, must be a `.glb`, must
   face +Z and must be at most 300,000 faces. Merc is comfortably under the
   face limit, but that does not resolve the body-plan incompatibility.
3. `POST /openapi/v1/animations` requires a `rig_task_id` from a successful
   Meshy rigging task. It cannot consume Merc's existing repository-authored
   skin directly. Preset calls accept one action or up to ten unique actions
   in one merged file. The current catalog includes `Big_Wave_Hello` as action
   28, but it is a biped motion.
4. Text to Motion produces a standalone motion clip, not a Merc animation. It
   still needs retargeting and, through Meshy's Animation API, a compatible
   Meshy biped rig. Prime accepts 2-10 second motions at half-second steps and
   outputs FBX; Swift outputs BVH.
5. Published costs are 5 credits for auto-rigging and 3 credits per preset
   animation. A rig plus one preset is therefore 8 credits; a rig plus two
   presets is 11. Text to Motion costs another 3 credits in Swift mode or 10 in
   Prime mode, before its application/retarget task. Credits are available,
   but spending them cannot remove the compatibility problem.
6. API assets are retained for at most three days for non-Enterprise accounts.
   Any future experiment must archive raw GLB/FBX outputs, task receipts and
   sanitized task metadata immediately; signed result URLs must not be saved.

If a Meshy experiment is ever requested for comparison, it should be a
separate duplicate candidate and never overwrite the current Merc sources or
runtime asset. The acceptance gate would require preserved silhouette, all
three facial morphs or an approved equivalent, both detached hands, stable
grounding, the mercury material treatment, bounded motion and the existing
gameplay clips. Based on the documented input limits, failure or a visibly
generic biped result is the expected outcome.

## Motion authoring proposal

Add the clips to `build_animations()` in `make_merc.py`; do not resculpt or
re-weight the model.

### `welcome` (required)

A 1.4-1.8 second one-shot: settle, lift one floating hand, make two readable
side-to-side wave beats, add a small head/body follow-through and return to the
exact listen pose. Use a blink and modest `wide` expression. Root translation
must return to zero, so swapping into `listen` cannot jump.

The loader plays `welcome` once as soon as the 3D preview has rendered, then
cross-fades to `listen`. This gives a complete greeting inside the existing
two-second initial presentation without delaying asset work or readiness.

### `laugh` (optional second clip)

A 1.0-1.4 second one-shot: two small alternating base/head squash beats, hands
drawn in, `wide` plus a restrained `sing` mouth, then exact listen pose. Keep
the body grounded and avoid the larger `celebrate` hops. It may play once after
a meaningful later progress checkpoint on a genuinely longer load. It must not
play on error, repeat indefinitely, or delay reveal after the first valid game
frame. If the first welcome proof is enough, omit this clip rather than adding
motion for its own sake.

Both clips must be added to the contact-sheet script at front and three-quarter
angles. The optimized GLB should remain below 500 KiB unless the extra sampled
channels produce a measured, reviewed reason to exceed it. Existing clip names,
bone names and morph target names are compatibility contracts.

## Current loader and the missing progress signal

The current loader is correct about readiness but has no progress value:

- `packages/glass-game/src/ui/LoadingScreen.tsx` shows the 252 x 320 transparent
  `merc-idle.webp` on the left and preserves the title/detail/actions on the
  right. The 3 px `statusKeyline` is a fixed-width decoration.
- `packages/glass-game/src/ui/loading-lifecycle.ts` exposes only
  `loading-assets`, `awaiting-first-frame`, `ready` and `error`, guarded by an
  attempt generation. It has no completed/total task data.
- `packages/glass-game/src/render/glass-renderer.ts` waits on three broad
  promises: Merc, museum assets and the optional environment attempt. It then
  performs the optional reflection capture before resolving `ready`.
- `packages/glass-game/src/render/asset-kit.ts` internally starts material
  textures, decoration textures, authored bundles, sky and portrait textures.
  It uses separate loading managers only for dependency errors and reports no
  successful install events.
- `packages/glass-game/src/ui/useAdventure.ts` calls `assetsInstalled()` only
  when the renderer's broad `ready` promise resolves, then calls
  `frameRendered()` after a successful actual render.

This means a percentage based on elapsed time, one broad Promise, request count
or downloaded bytes would be misleading. Fetch progress is not reliable for
cached resources or responses without useful `Content-Length`, and fetch
completion does not include image decode, GLB parse, node validation, material
installation or the qualifying rendered frame.

The 2,000 ms initial presentation minimum is also separate from load progress.
The bar may honestly be full while the cover holds for the last fraction of the
brand minimum; it must never creep forward merely because that timer advances.

## Honest readiness-track contract

Create a fixed logical task plan synchronously from the selected level and its
catalog recipes before starting an attempt. Suggested task identities are:

- `merc:model` after the main scene's Merc is parsed, dressed and installed;
- one `material:<asset-id>` per decoded, configured and installed material map;
- one `decoration-texture:<asset-id>` per installed decoration map;
- one `bundle:<logical-id>` per fully validated and installed logical bundle;
- one `sky:<asset-id>` when the authored sky is installed;
- one `portrait:<asset-id>` after its dependent bundle and portrait clones are
  installed;
- `environment:<asset-id>` when the HDR is installed or the declared
  procedural fallback has been selected;
- `reflection-probe` when the optional capture succeeds or its existing
  non-fatal fallback is selected.

A preferred bundle and its catalogued fallback are one logical task. A failed
preferred request must not increment the count; successful fallback
installation completes that same task exactly once. Duplicate asset IDs count
once. Required failures freeze the track and enter the existing error UI.

Represent progress as `completedUnits / totalUnits`, with the concrete unit IDs
retained for tests and diagnostics. This is a readiness checklist, not an
estimate of bytes or time. CSS may ease between real checkpoints, but no timer
may advance the target value. The fill uses `transform-origin: left` and grows
left-to-right. There is no visible number or percent sign.

The qualifying game frame remains a separate lifecycle gate rather than a bar
unit. When all declared asset/install units complete, the bar reaches its right
edge and the copy changes to the existing "Lighting the exhibits" phase. The
cover then leaves only after the renderer produces the valid frame. Counting
that frame in the denominator would unmount the loader in the same update that
sets the final value, so the visitor would usually never see the completed
track.

Use `role="progressbar"` with `aria-valuemin="0"`, `aria-valuemax={totalUnits}`
and `aria-valuenow={completedUnits}`. `aria-valuetext` should use the current
human phase, such as "Setting the exhibits" or "Lighting the gallery", rather
than reading a percentage. Keep the existing title and detail text on the
right. In reduced-motion mode, checkpoint changes are immediate instead of
interpolated.

The progress state must carry the existing attempt generation. Retry creates a
fresh plan at zero, stale callbacks from the previous renderer are ignored, and
leave/dispose invalidates all pending updates. The durable museum progress is
unrelated and remains untouched.

## Actual 3D loader presentation

Replace the left `<img>` on the successful WebGL path with a loader-owned,
transparent Three.js canvas inside the existing arch. Keep `merc-idle.webp` as
the immediate first paint and fallback until the canvas has produced its first
Merc frame. The normal path then cross-fades to the actual GLB. The fallback is
not a substitute for normal-path acceptance; it prevents a blank loader if the
small presentation renderer alone cannot start.

The preview should:

- resolve the existing logical `merc` asset, not introduce another character;
- preserve `merc_eye` and use the exact body/hand mercury material parameters
  shared with the game renderer;
- use a small neutral studio environment generated in code so the metallic body
  does not render black, with no external texture or post-processing pass;
- cap device pixel ratio, disable shadows and render only the character;
- frame from measured bounds and ground the complete visible rig, including
  the hands;
- pause its RAF while the document is hidden;
- show the listen pose without mixer advancement when reduced motion is set;
- dispose the mixer, GLB scene resources, studio environment, renderer,
  context-loss listeners, resize observer and RAF synchronously on reveal,
  retry or leave.

This approach temporarily uses a second WebGL context while the full museum
renderer loads behind the opaque cover. The GLB is already a required 416 KiB
asset, so normal HTTP caching can avoid a second transfer, but parsing and GPU
upload are still duplicated. That cost must be measured on a representative
phone. A broad shared-resource cache is not recommended for the first pass
because the game renderer mutates materials and owns disposal. If two-context
memory or context loss fails acceptance, the next design should explicitly
share a parsed immutable Merc source through cloned scenes and reference-counted
ownership; it should not silently leak resources to make the loader work.

## Suggested implementation ownership

Asset/source changes:

- `apps/beside-cue/art/merc/make_merc.py`: add named clip authoring only.
- `apps/beside-cue/art/merc/preview.py`: add telling frames for the new clips.
- Regenerate `merc.blend`, `merc-preview.glb`, `merc.opt.glb` and public
  `merc.glb`; preserve `merc-sculpt.blend` unchanged.

Runtime changes:

- Add a small shared Merc model/material helper under
  `packages/glass-game/src/render/` so the loader and gameplay paths cannot
  drift on mesh names, eye preservation or metal parameters.
- Add a loader-preview controller under `packages/glass-game/src/render/` with
  an explicit `dispose()` contract.
- Add a pure `packages/glass-game/src/ui/loading-progress.ts` task ledger, or
  extend `loading-lifecycle.ts` if that remains clearer after implementation.
- Thread task-plan and task-completion callbacks through `asset-kit.ts`,
  `glass-renderer.ts` and `useAdventure.ts`.
- Update `LoadingScreen.tsx` and its CSS only for the left canvas/fallback and
  the readiness track. Preserve the right text, error actions and focus trap.
- Pass both `merc-loading` and `merc` URLs from `GlassAdventure.tsx` until the
  fallback image is intentionally retired by a later decision.

Do not reuse Meshy's task progress in this UI. That percentage describes a
remote content-generation job and has no relationship to loading a local
museum visit.

## Source persistence and reproducibility

For this local animation path, `merc-sculpt.blend` is sufficient to rebuild the
rig and every clip without fetching the original high-detail donor. It is a
processed sculpt cache, not the raw Meshy output. `make_merc.py` still documents
a private-machine default for that original donor, so a future resculpt is not
fully reproducible from this repository alone. This does not block welcome or
laugh authoring because those changes start from the committed sculpt cache.

Before any future resculpt, either archive the exact raw donor GLB plus a
sanitized generation receipt under source control/LFS, or explicitly declare
the committed sculpt cache as the canonical retained source. Never save API
keys, signed Meshy result URLs or private account responses in the repository.

The current binary sources are not LFS-filtered, although they are small. An
asset revision should record SHA-256, byte size, Blender version, export
settings, glTF Transform version and the exact build command in a sanitized
receipt. The old shell wrapper ended both Blender pipelines with `|| true`,
which could mask a failed build despite `pipefail`. The delivered pipeline
removes that masking and supplies Blender's Python failure exit code before
accepting a regenerated GLB.

Expected local entry point after that hardening:

```sh
rtk proxy pnpm --dir apps/beside-cue assets:merc
```

No paid Meshy command belongs in this implementation path.

## Verification and acceptance criteria

### Asset gates

- The optimized and public GLBs are byte-identical and their receipt hashes
  match.
- Nodes `merc_body`, `merc_face`, `merc_hand_l`, `merc_hand_r` and rig joints
  `root`, `base`, `head`, `hand_l`, `hand_r` remain present.
- Morph targets `blink`, `wide`, `sing` and all five existing clip names remain
  present; accepted new clips have finite tracks and the intended duration.
- Welcome/laugh return to the exact listen root/base/head/hand pose and do not
  move the measured ground below zero.
- Front and three-quarter contact-sheet frames show no hand/body intersection,
  facial detachment, silhouette collapse or generic biped motion.
- Runtime metal and embedded eye material match the in-game mascot.

### Loader behavior

- The normal path shows the actual animated GLB on the left and preserves the
  existing right title/detail/actions.
- Welcome is a one-shot and never delays reveal. Reduced motion renders a
  stable authored pose. Error uses a calm stable pose or the existing image.
- The fill starts at the left, never decreases within an attempt, advances only
  on unique completed logical tasks, and has no visible numeric percentage.
- A held required asset visibly holds the track; releasing it advances the
  track. A preferred-bundle failure followed by accepted fallback completes one
  unit, not two.
- The track can reach full while the initial two-second presentation minimum
  remains, and the game still reveals only after a qualifying rendered frame.
- Retry resets only the load-attempt track, preserves durable game progress and
  ignores every stale completion from the prior generation.
- Required failure freezes the track behind the opaque error cover. Leave,
  retry and unmount dispose both renderer attempts and stop all loader RAF work.
- No unfinished museum frame, input target, microphone request or automatic
  audio becomes available under the cover.

### Test/evidence additions

- Extend the actual-GLB contract test to assert skeleton, morphs and clip names.
- Add pure task-ledger tests for uniqueness, monotonicity, fallback identity,
  stale attempts, retry and disposal.
- Extend `glass-adventure-loading.e2e.ts` with one held-unit progress case, one
  retry/reset case, no visible percent text, reduced motion and loader disposal.
- Capture desktop, portrait phone and short landscape evidence with the actual
  3D Merc. Include an error proof and a reduced-motion proof.
- On a physical phone, measure peak memory/context count and repeat at least ten
  enter/leave/retry cycles. Acceptance requires no context loss, persistent RAF,
  duplicated canvas, black metal, clip pop or increasing memory trend.

The loader remains a readiness boundary. Animation and the visible fill improve
that boundary without weakening the existing required-art, stable-frame,
generation-safety or recovery rules.
