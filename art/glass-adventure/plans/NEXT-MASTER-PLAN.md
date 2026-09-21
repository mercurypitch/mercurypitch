# Glass adventure — current master plan

Updated 2026-09-21. This is the current plan, not a chronological chat log.
Detailed research and chapter plans remain in
`<user-dotfiles>/personal/besidecue/glass-adventure/`.
Code and production sources are preserved in draft PR #807 on
`feat/glass-museum-level-one`. No merge or release is authorized for this pass.

## Where we are

The shared campaign contains First Light, Glassworks Journey, Twin Galleries
and Resonance Conservatory, with separate progress and the Journey rewards
pilot. The owner accepted the longer enclosed route, controls/collisions, music,
artwork inspection, mirror fixes and the Twin Galleries low/high teaching.
Conservatory microphone fairness, timed pacing and sustained physical-device
performance remain acceptance work.

The approved four-stage checklist is
[APPROVED-FOUR-STAGES.md](./APPROVED-FOUR-STAGES.md). Shared web/native delivery
is implemented; games-on Android APKs and the unsigned iOS Simulator package
have built in CI. Standard store builds still keep games disabled. Packaging
and software-renderer proofs do not establish physical-device performance.

The owner chose A, Floating Museum, from the
[map audition](./JOURNEY-MAP-AUDITION.md); B/C remain archived. The live map,
accepted composition, amber/teal domes, planting, saved stars/portrait display,
and corrected Merc centering are preserved through `cab03138`. The current
[third polish batch](./FLOATING-MUSEUM-POLISH-BATCH-3.md) adds selected-island
inspection zoom/orbit/reset, flat generated mystery artwork, and three broad
waterfalls with planted source pools and soft spray termination. That document
compares the original concept against actual runtime images element by element
and orders the remaining structural, material and landscape work.

The owner accepted the museum portrait polish. The
[animated 3D Merc loader](./ANIMATED-MERC-LOADER-FOLLOWUP.md) is now implemented:
the actual custom mascot rig has welcome/laugh clips, the right-side copy is
preserved, and a clear track follows installed assets without visible numbers.
Retry, graphics cleanup, reduced motion and error handling are verified locally;
the owner accepted the improved portrait and progress presentation. Sustained
physical-device cost remains unmeasured. The
[fourth museum polish batch](./FLOATING-MUSEUM-POLISH-BATCH-4.md) is integrated
and pushed through `87677aea`: an open planted Twin connector, botanical
Conservatory, warm Carrara terraces, thinner luminous medallions and planting
clearance. Source production is preserved at `3f1354ad`. Full-map tablet cost
and owner visual acceptance remain open; the next art pass is denser authored
flower beds, marble bridges, varied cliffs and a crystal landmark.
Meshy's API supports rigging and animations, but its documented
humanoid contract is not suitable for this droplet mascot; no rigging experiment
was submitted. Standing permission to use Meshy credits remains valid for
appropriate models.

The authorized 30-credit opaque Celadon V3 trial failed geometry acceptance and
is archived. The existing fluted Celadon fallback remains in use; transparent
replacement production is still open and has no approval blocker. Detailed
lesson/asset evidence remains in
[TWIN-GALLERIES-IMPLEMENTATION.md](./TWIN-GALLERIES-IMPLEMENTATION.md).

All required checks passed on museum polish commit `25fed35f`, including PR
Gate, web/browser, Beside Cue adventure lanes and native games-on builds.
The loader's stale five-clip test was corrected at `3457a7cd`; every required
check including PR Gate, browser and native builds passed on that revision.
The fourth art batch has separate verification. Historical revision details
are retained in each batch document.

| Area                 | Implemented                                                                                                                                                | Still missing                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Integration          | Mini-game slice PRs #774–#782 and follow-ups #802/#803, #785, #804, #806 merged                                                                            | Standard store builds intentionally keep games disabled                                           |
| Controls             | Manual keyboard/touch movement and jump; follow/orbit/zoom camera; automatic run ramp; floor/prop/gate collision                                           | Physical-device tuning as new routes grow                                                         |
| Content architecture | Prefab composer, shared hold/pair lessons, validation, room ownership, independent saves and campaign transitions                                          | Further judge types and richer authoring tools                                                    |
| First Light          | Short enclosed tutorial and panorama; two required and one optional held-note exhibit                                                                      | Device regression through the shared campaign                                                     |
| Glassworks Journey   | Sixteen room/presentation instances; four required and five optional held-note encounters; garden, archive, salon, panorama                                | Timed pacing study; ongoing room polish                                                           |
| Twin Galleries       | Eighteen connected placements; four required and three optional low/high encounters; owner accepted the learning sequence                                  | Timed pacing and sustained device performance; remaining V6 vessel production                     |
| Art                  | Meshy/Blender vessels and wall kit; original paintings including three Level 2 works, planters, varied floors; loading cover                               | Amber approved/pushed; Celadon upload approved, V3 rejected/archived; replacement production open |
| Sound                | Approved M01/M03 music/ambience; Gentle Whimsical D2 Merc voice and shuffled reactions; two-note references; quiet capture                                 | Additional level-specific Merc narration                                                          |
| Rendering            | Conservative room visibility, camera obstruction, shadow tuning                                                                                            | Sustained real-device profiling, LOD/compression strategy if measurements require it              |
| Delivery             | Shared package/hosts; canonical `/glass-game`, Home CTA, selective LFS hydration, all-file native hashes, successful games-on Android/iOS Simulator builds | Physical-device acceptance and publication remain separate; later map changes need their own CI   |
| Rewards              | Journey pilot committed/pushed (`25dbb403`): finite discovery tokens, final-portrait singing stars, durable portrait ownership                             | Owner device acceptance; broader collection UI, recordings/replay/sharing remain future           |

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

## Current owner follow-up — challenge clarity and replay proposals

The 2026-09-21 playtest prioritized a side-view cinematic for every singing
challenge, held through the shatter and smoothly restored afterward, plus a
Conservatory beginner sway completion investigation. These fixes precede the
next landscape batch. Implementation/verification is tracked in
[CHALLENGE-CAMERA-AND-SWAY-POLISH.md](./CHALLENGE-CAMERA-AND-SWAY-POLISH.md).
The same polish batch simplifies singing actions and puts detailed guidance behind
a tap/click help control, while preserving gallery stories and adding outside-click
dismissal to artwork inspection.

The owner approved the first [Cloudway pilot](./CLOUDWAY-PILOT-IMPLEMENTATION.md)
after the challenge-polish batch passed its checks. The Glass Ribbon now has an
authored eleven-platform route, frost, a carrying raft, two cracking steps, three
comfortable-note stations and five safe checkpoints. It has a separate save and
replay, plus a guarded first-island entry. First Light is ungraded: complete it
and earn three saved pitch stars in Glassworks Journey. This does not implement
the proposed replay difficulty system. Meshy export review, input-driven
traversal and rendered browser checks pass. The HTTPS playtest route and
new-head PR gate are tracked in the pilot checklist; tablet acceptance remains
open.

After tablet acceptance, choose between The Opaline Ferry (staggered moving
rafts with low/high lessons on docks) and The Frost Conservatory (curving frost
with optional crackle shortcuts and safe gentle-wave stations). Both reuse this
simulation and platform family; neither is implemented yet.

These other ideas remain **planning only**:

- [Replay difficulty and level stars](./REPLAY-DIFFICULTY-AND-LEVEL-STARS.md): first
  clear on easy, selected harder replays for higher level stars, possible separate
  Legend crest; preserve coins/portraits and distinguish the existing final-portrait
  accuracy pilot. Its migration and candidate durations need explicit later review.
- [Friendly rivals and resonance duels](./FRIENDLY-RIVALS-AND-RESONANCE-DUELS.md):
  gentle enemies, bubble projectiles and singing races. Start with a safe echoing
  rival, keep demonstration audio separate from capture and prototype pressure
  before approving combat, rewards or production assets.

## Next executable milestones

### Asset quality follow-up — before increasing scene density

Apply this checklist to the new Cloudway family during production, then complete the
[Meshy → Blender → game audit](./GAME-ASSET-QUALITY-AUDIT.md): hidden bevels,
intersections, correct surface contact, normals, repeated-object instancing,
fracture/animation preparation and measured rendering cost. It defines a full
asset inventory, per-family evidence, source-preserving fixes and a reusable
checklist/skill built from verified guidance and our own production lessons.
The Cloudway family passes its scoped production audit, including landing
proxies, coherent outward fracture winding, hashes and instanced parts. The
broader existing museum inventory has not yet passed this new audit.

### N2 finish — close the current visual polish

- [x] Seat all framed art against its actual wall face.
- [x] Lift the visible Merc rig so hands clear the floor without moving physics.
- [x] Add direct-tap and nearby-button artwork inspection with short original
      stories, accessible dismissal and unchanged camera on return.
- [x] Replace the salon's environment-only mirror with bounded live reflection;
      verify state restoration, view culling, disposal and actual scene output.
- [x] Check phone/tablet layout and desktop rendering; record simulated versus
      physical evidence separately and add direct mouse/touch regression coverage.
- [x] Confirm prior polish revision CI; new batch needs its own CI result.
- [x] Correct diagonal mirror artifact and place View artwork at top center.
- [x] Owner accepted hand clearance, mounted art and artwork inspection.
- [x] Owner accepted the mirror artifact fix and Twin Galleries low/high lesson.
- [x] Prepare sharper bounded reflection, above-floor exit rim and top-row artwork.
- [x] Owner accepted sharper mirrors, top-row artwork and exit-floor clearance.
- [ ] Sustained physical-device cost and timed route pacing remain unmeasured.

### N3 — lesson and campaign foundation (implemented; owner accepted Twin learning)

The shared challenge and voice-session layers now dispatch held notes and
ordered pairs. First Light, Glassworks Journey and Twin Galleries share the
campaign, independent progress and revisioned teaching. The design contract is:

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

### N4 — Level 2: Twin Galleries (first playable route implemented)

Learning goal: hear and reproduce two comfortable pitches in the right order,
without a forced beat or a demand to sing higher than feels comfortable.

| Chapter                 | Journey and skill                                                                         | Reusable production pieces                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Threshold of two lights | Familiar easy hold, hear Merc explain the contrast; glimpse both gallery colors           | Entry room, split-color doorway, short teaching cards                      |
| Amber lower gallery     | Discover a comfortable low note; one broad main path and a side display                   | Amber cadence urn, warm marble/gold variants, low-register muse painting   |
| Celadon upper gallery   | Reach a contrasting light-filled room via forgiving steps; find a comfortable higher note | Celadon lark decanter, shared wall/window kit, high-register muse painting |
| Listening bridge        | Hear the pair, then answer low → high; retry without losing the opened path               | Twin-tone harp decoration, paired exhibit pedestal, safe singing pad       |
| Meeting of the voices   | Familiar two-note response opens the portrait/finale and roof-garden route                | Paired interval painting, resonance veil and panorama pieces               |

The first playable route has four main teaching stations and three optional
exhibits across eighteen placements. Tune after walking the real route. Introduce low and high separately before the pair, and
provide replay/recalibration. Do not secretly widen the interval or add a third
note at the finale. Color supports the audible cue but does not carry it alone.

Acceptance gates: comfortable pair calibration; order-aware judge; silence,
stale frames and jitter cannot pass; demonstrated notes never assess themselves;
full keyboard/touch traversal, checkpoint reload and real-mic device play.

Current asset batch: amber urn, celadon decanter, twin-tone resonance harp,
opaline echo amphora and three original paintings. They are staged under
`art/glass-adventure/v6-level2/`. The three paintings are integrated with
inspection stories. The harp is now integrated in the listening court with a
measured base proxy, 9,837-triangle render derivative and actual scene proof.
Opaline V2 has a validated hollow cavity and 18-piece fracture; its continuous
opal/gold/jade materials and optional court integration passed review, with
actual intact and shattering render proofs. V1 is retained as rejected material evidence. Amber V2 is now approved and integrated in the lower gallery (`e2279942`),
with a 16-piece hollow fracture and exact render/source receipts. The owner
explicitly approved the exact Celadon guide upload and further Meshy attempts as
needed. The resulting 30-credit opaque V3 trial failed geometry review and is
archived with the earlier rejected remeshes; replacement production remains
open. The extra five-credit Celadon remesh also failed topology and remains
archived as rejected input.
The route keeps approved existing breakable recipes until replacements pass. An intact download is
not a finished breakable. Do not inflate the current level's download with
unused candidates.

### N5 — optional scoring/collection pilot (implemented and pushed)

Separate exploration from singing evidence. Proposed: every successful break
opens the route and grants its collectible; exploration coins count discovered
exhibits; singing quality can earn stars or A/B/C, based on time-weighted valid
capture rather than callback counts. Insufficient evidence stays ungraded.
Retries retain personal bests. Avoid rewarding loudness, long forced holds or
penalizing microphone limitations. The approved pilot uses Glassworks Journey,
1–3 singing stars, finite discovery coins and a completion portrait; implementation
and validation are tracked in the four-stage checklist. The first pilot grades
only the final portrait singing (not all route exhibits); that scope is explicit
on the end card. Portrait ownership never depends on stars. Old saves do not
receive invented stars or discovery tokens.

### N6 — Level 3: Resonance Conservatory (implemented; final review)

A garden of glass teaches settle → gentle pitch wave. First establish a stable
note; then a broad, comfortable wave; finally repeat it in a longer enclosed-to-
open route. Hold alone must not complete the wave phase, and noise/jitter must
not masquerade as vibrato. Reuse the garden/harp/glass kit and new foliage only
where it improves room identity. The new authored route has 18 room/presentation placements, four required and
three optional encounters plus two original paintings. Complete no-jump route
traversal passes; phone/tablet lesson panels were rendered and cancelled without
errors using synthetic microphone observations. Final review corrected an extrema-count issue: the demonstrated two waves
now mean two waves followed by return to the settled note.
Tune against real microphones before expanding.

### N7 — shared delivery (implemented; owner acceptance and release remain separate)

MercuryPitch route/CTA and campaign entry share content IDs and game behavior
with the native adapter; storage namespaces remain host-owned. Browser and
offline/native asset checks pass. CI created games-enabled Android APKs and an
unsigned iOS Simulator package; see the delivery receipt for commit/digests and
seven-day expiry. Test actual device installs with games enabled while retaining
the games-off store profile. A Simulator package is not an iPhone/TestFlight
build. Decide publication deliberately after acceptance; do not deploy just
because a PR is green.

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
reference playback and existing pitch/wave research. High/low is now the Twin Galleries encounter mechanic. The Conservatory now implements a gentle pitch-wave teaching gesture; it is
not an assessment of stylistic vibrato. Call-and-response remains a later
localized encounter. Voice-controlled
locomotion and compulsory fixed-camera-room movement were superseded by the
owner's manual movement/free-3D choice. Existing mini-game prototypes are useful
research evidence, not proof that their judges and teaching are integrated here.

Detailed companions: `LEVEL-AUTHORING-PLAN.md`, `LONGER-LEVELS.md`,
`MECHANICS-MAP.md`, `PHASE2-CONTROLS-ENCOUNTERS.md`, `PHASE2-LEVELS.md` and
`GRADES-COLLECTION-DESIGN.md` in the canonical directory. Reward/portrait ideas
also have a repository copy in
[OPTIONAL-EXHIBITS-REWARDS-PORTRAIT-FINALES.md](./OPTIONAL-EXHIBITS-REWARDS-PORTRAIT-FINALES.md).

No new game-design choice or asset-upload approval blocks Level 2. The owner
explicitly approved the exact Celadon guide and further Meshy attempts; the
completed 30-credit opaque V3 trial was rejected and archived, so production of
an acceptable replacement remains open. The owner accepted the comfortable
low/high learning sequence and authorized the rewards defaults and next stages;
physical-device mirror cost and journey duration still need measured feedback.
