# Glass adventure — current master plan

Updated 2026-09-20. This is the current plan, not a chronological chat log.
Detailed research and chapter plans remain in
`<user-dotfiles>/personal/besidecue/glass-adventure/`.
Code and production sources are preserved in draft PR #807 on
`feat/glass-museum-level-one`. No merge or release is authorized for this pass.

## Where we are

The owner completed the longer journey and tested on a tablet, accepting the
room scale, controls, physics, music, voice, enclosure and new decoration.
The latest polish fixes wall mounting and Merc's hand clearance, adds an artwork
close-up, and replaces the static salon mirror with a bounded live reflection.
Verification and remaining device checks are in the
[implementation checkpoint](./GALLERY-INSPECTION-AND-LEVEL2-ASSETS.md).
This feedback is useful playtest acceptance, not a measured FPS/thermal audit.

| Area                 | Implemented                                                                                                                 | Still missing                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Integration          | Mini-game slice PRs #774–#782 and follow-ups #802/#803, #785, #804, #806 merged                                             | Standard store builds intentionally keep games disabled                              |
| Controls             | Manual keyboard/touch movement and jump; follow/orbit/zoom camera; automatic run ramp; floor/prop/gate collision            | Physical-device tuning as new routes grow                                            |
| Content architecture | Pure prefab composer, validation, transformed visuals/colliders/anchors, saved gates, room ownership                        | General lesson dispatch and campaign transitions                                     |
| First Light          | Short enclosed tutorial and panorama; two required and one optional held-note exhibit                                       | Campaign entry rather than development layout selection                              |
| Glassworks Journey   | Sixteen room/presentation instances; four required and four optional held-note encounters; garden, archive, salon, panorama | Timed pacing study; ongoing room polish                                              |
| Art                  | Meshy/Blender vessels and wall kit; original paintings, planters, varied floors; required-asset loading cover               | Level 2 derivatives are production candidates until game budgets and fractures pass  |
| Sound                | Approved M01/M03 music/ambience; selected Gentle Whimsical D2 Merc voice and shuffled break reactions; silence for capture  | Level-specific two-note prompts and demonstration audio                              |
| Rendering            | Conservative room visibility, camera obstruction, shadow tuning                                                             | Sustained real-device profiling, LOD/compression strategy if measurements require it |
| Delivery             | Shared glass-game package and host adapters; standalone preview and BesideCue integration                                   | Final MercuryPitch entry/CTA, campaign UI, games-on native builds, publication       |
| Rewards              | Design documents only                                                                                                       | Coins, grades/stars, collection badges, portrait cards, recordings/replay/sharing    |

## Approved direction

- Handcrafted connected museum wings built from reusable components.
- Forgiving required movement, optional exploration and harder paths.
- One new voice skill per level. Move/jump with ordinary controls; stop at a
  safe exhibit to sing. No voice-controlled locomotion.
- Comfortable humming or singing; loudness is never the goal. Demonstrations,
  narration and background sound stop before assessed capture.
- Short skippable teaching. No lives or lost progress after falling.
- Aim for 10–15 minutes on an exploratory first visit, with shorter replays and
  chapter checkpoints. This is a design target, not a measured current length.
- Meshy for modeled art, Blender for measured preparation; preserve images,
  raw donors, packed projects, scripts, receipts and derivatives.
- Web and native share the game and content. Publishing remains a separate
  explicit decision. The disjoint-colliders reference project stays read-only.

## Next executable milestones

### N2 finish — close the current visual polish

- [x] Seat all framed art against its actual wall face.
- [x] Lift the visible Merc rig so hands clear the floor without moving physics.
- [x] Add direct-tap and nearby-button artwork inspection with short original
      stories, accessible dismissal and unchanged camera on return.
- [x] Replace the salon's environment-only mirror with bounded live reflection;
      verify state restoration, view culling, disposal and actual scene output.
- [x] Check phone/tablet layout and desktop rendering; record simulated versus
      physical evidence separately and add direct mouse/touch regression coverage.
- [ ] Confirm all CI checks for the pushed revision before promotion.
- [ ] Owner checks this polish on the tablet, especially the mirror cost and
      reaching/closing artwork. Profile sustained device play separately.

### N3 — lesson and campaign foundation (recommended next implementation)

Keep the current held-note behavior as the acceptance baseline. Extract a
challenge-runner interface around its existing calibration/reference/capture/
judge/result lifecycle; do not copy useAdventure for each new mechanic.

1. Define data-owned lesson profiles and typed challenge state/events. The
   content specifies a profile and parameters; runtime dispatch selects a
   tested judge. World gates depend on completed exhibit IDs, not judge internals.
2. Keep microphone permission, freshness/confidence checks, cancellation and
   audio ownership in one session layer. Every transition invalidates late
   callbacks. A cancelled/hidden/old level cannot restart audio or grant a break.
3. Add a campaign registry for First Light, Glassworks and Twin Galleries; stable
   level/content identities, per-level tutorial keys and save migration from the
   current global tutorial preference. Preserve current checkpoints and completions.
4. Add a simple level entry/continue flow and keyed level disposal. Restart one
   level must not erase another; asset failure/retry must not lose progress.
5. Prove hold parity, independent saves, replay, back/foreground transitions,
   cancelled microphone startup and rapid level change before adding low/high.

Exit: the existing two held-note routes still play identically through the same
host surface, with no level-ID branches in gameplay code and no leaked sessions.

### N4 — Level 2: Twin Galleries

Learning goal: hear and reproduce two comfortable pitches in the right order,
without a forced beat or a demand to sing higher than feels comfortable.

| Chapter                 | Journey and skill                                                                         | Reusable production pieces                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Threshold of two lights | Familiar easy hold, hear Merc explain the contrast; glimpse both gallery colors           | Entry room, split-color doorway, short teaching cards                      |
| Amber lower gallery     | Discover a comfortable low note; one broad main path and a side display                   | Amber cadence urn, warm marble/gold variants, low-register muse painting   |
| Celadon upper gallery   | Reach a contrasting light-filled room via forgiving steps; find a comfortable higher note | Celadon lark decanter, shared wall/window kit, high-register muse painting |
| Listening bridge        | Hear the pair, then answer low → high; retry without losing the opened path               | Twin-tone harp decoration, paired exhibit pedestal, safe singing pad       |
| Meeting of the voices   | Familiar two-note response opens the portrait/finale and roof-garden route                | Paired interval painting, resonance veil and panorama pieces               |

Target four main teaching stations plus about three optional exhibits; tune after
walking the real route. Introduce low and high separately before the pair, and
provide replay/recalibration. Do not secretly widen the interval or add a third
note at the finale. Color supports the audible cue but does not carry it alone.

Implementation gates: comfortable pair calibration; order-aware judge; silence,
stale frames and jitter cannot pass; demonstrated notes never assess themselves;
full keyboard/touch traversal, checkpoint reload and real-mic device play.

Current asset batch: amber urn, celadon decanter, twin-tone resonance harp,
opaline echo amphora and three original paintings. They are staged under
`art/glass-adventure/v6-level2/`; runtime integration follows dimensional,
material, mobile-budget and fracture/collision review. An intact download is
not a finished breakable. Do not inflate the current level's download with
unused candidates.

### N5 — optional scoring/collection pilot (needs policy discussion)

Separate exploration from singing evidence. Proposed: every successful break
opens the route and grants its collectible; exploration coins count discovered
exhibits; singing quality can earn stars or A/B/C, based on time-weighted valid
capture rather than callback counts. Insufficient evidence stays ungraded.
Retries retain personal bests. Avoid rewarding loudness, long forced holds or
penalizing microphone limitations. Pick one vessel as the pilot after agreeing
what each grade means. No scoring implementation is included in current polish.

### N6 — Level 3: Resonance Conservatory

A garden of glass teaches settle → gentle pitch wave. First establish a stable
note; then a broad, comfortable wave; finally repeat it in a longer enclosed-to-
open route. Hold alone must not complete the wave phase, and noise/jitter must
not masquerade as vibrato. Reuse the garden/harp/glass kit and new foliage only
where it improves room identity. Tune against real microphones before expanding.

### N7 — shared delivery and release readiness

Finish MercuryPitch route/CTA and campaign entry; verify identical content IDs
and saves in web/native adapters, offline packaging and native asset manifests.
Test actual iOS/Android installs with games enabled while retaining the games-off
store profile. Decide publication deliberately after acceptance; do not deploy
just because a PR is green.

### N8 — later experiments and portrait finales

- Breakable windows, wall exhibitions and floor vases as optional side discoveries.
- One collectible portrait per completed level; eventual ten-level album and
  end-card composition with exploration coins and singing stars.
- Echo Panes (short call-and-response) is the next bounded experiment; Standing
  Wave/world restoration remains further research.
- Coda Echo: original short melody/words at a final portrait, Merc demonstration
  versus the player's take, optional local replay and later sharing. Recording
  is explicitly opt-in and separately designed; ordinary pitch analysis must
  not silently become saved voice recording.

## Research continuity

The canonical `MECHANICS-MAP.md` maps historical work to the 3D game. Reuse
comfortable-note calibration, fresh voiced-frame filtering, hold judging,
reference playback and existing pitch/wave research. High/low, vibrato and
call-and-response ideas are future localized encounters. Voice-controlled
locomotion and compulsory fixed-camera-room movement were superseded by the
owner's manual movement/free-3D choice. Existing mini-game prototypes are useful
research evidence, not proof that their judges and teaching are integrated here.

Detailed companions: `LEVEL-AUTHORING-PLAN.md`, `LONGER-LEVELS.md`,
`MECHANICS-MAP.md`, `PHASE2-CONTROLS-ENCOUNTERS.md`, `PHASE2-LEVELS.md` and
`GRADES-COLLECTION-DESIGN.md` in the canonical directory. Reward/portrait ideas
also have a repository copy in
[OPTIONAL-EXHIBITS-REWARDS-PORTRAIT-FINALES.md](./OPTIONAL-EXHIBITS-REWARDS-PORTRAIT-FINALES.md).

No new design choice blocks finishing the current polish or producing the Level
2 candidates. The next useful owner discussion is the feel of the comfortable
low/high pair; the later rewards policy should be decided before its pilot.
