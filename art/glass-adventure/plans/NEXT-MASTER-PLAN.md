# Glass adventure — current master plan

Updated 25 September 2026. This is the current status and next-stage plan, not a
chronological chat log. It supersedes the older “pending” labels in dated research
and production notes for the items explicitly implemented below. Original sources,
rejected experiments, detailed research and decision history remain preserved.

The Glassworks foundation was squash-merged through PR #807 into `main` at
`3076872d5dca644682985f2bda70a84e18c2ff95` on 24 September 2026, after the
required PR Gate passed again. The owner authorized roadmap **1–8**, including
configurable melody, and asked us to **stop before 9** for testing. Items 10–11
remain later. Native testing builds were enabled through PR #860, merged at
`ff7eae76082451febfe15d5ea5ebbccfb3a6bc38`. Current work is
`feat/glass-mobile-playability`: the approved performance, guidance and collision
follow-up on a new branch/PR.
Public release remains a separate decision.
The durable execution record is
[APPROVED-POLISH-AND-PROGRESSION-2026-09-23.md](./APPROVED-POLISH-AND-PROGRESSION-2026-09-23.md);
its final integration/CI checkpoint is authoritative for this batch. Plans are
mirrored under `<user-dotfiles>/personal/besidecue/glass-adventure/`.

## Latest design decision — 25 September 2026

The owner can now select the Scarlett input after the microphone recovery pass.
Runtime head `c4632528` passed all 48 applicable checks (one expected skip).
Physical-device acceptance of the whole batch remains open.

New Cloudway feedback has been researched and saved in
[Melody Cloudway level design](./MELODY-CLOUDWAY-LEVEL-DESIGN-2026-09-25.md).
It contains the narration cause and correction contract, measured platform
orientation, three route wireframes, the old 2D compiler comparison, and a
five-note/two-frost-wall journey ending in a complete melodic portrait.

**Recommendation awaiting selection:** one separately selectable candidate,
The Thawing Song, using Sunlit steps (0, +2, +4, +2, 0). Keep current Cloudway
as the comparison; do not create several playable levels. First audition is
ungraded. Melodic target/challenge integration, attempt persistence and later
grading/portrait registration are explicit work, not assumed existing features.
The path-opening narration bug is diagnosed but not yet changed in this
planning delivery. No new runtime level, asset generation or unlock changes.

Next order: owner selects the route, correct narration semantics, block out the
selected journey, integrate melody and resumable attempts, then inspect/playtest
before producing missing art and choosing campaign placement. This design
exercise does not waive PR #861 device acceptance or approve merging/releasing.

## Approved final five passes before device tests

The owner approved camera comfort, picture-bearing portrait shatter, matched
Merc musical phrases, bounded mobile rendering quality, and the final museum
art/pond/stair pass. Follow [FINAL-FIVE-PASSES-2026-09-24.md](./FINAL-FIVE-PASSES-2026-09-24.md).
Implementation is complete: brief diagonal steering preserves camera yaw;
portrait artwork rides the shards; Merc's 3/5/7-note phrases match the selected
key and pace; stable mobile quality reduces measured render work; and per-island
inspection corrected pond/plinth contact and curved bridge landings. Independent
source review has cleared all five areas, including audio retry and close/reopen
ownership. Final browser proof, combined gates and exact-head CI are recorded in
the execution checklist. PR #861 stays open for physical-device acceptance; no
new levels or public release in this batch.

## Current priority after mobile playtest

The owner reported poor real-mobile performance, unclear challenge activation and
Cloudway portrait pass-through/locked-exit confusion. Follow
[MOBILE-PERFORMANCE-AND-GUIDANCE-FOLLOWUP-2026-09-24.md](./MOBILE-PERFORMANCE-AND-GUIDANCE-FOLLOWUP-2026-09-24.md).
It contains evidence-ranked rendering findings, the exact current Sing gesture,
required encounter/exit rules, collision and guidance changes, device acceptance,
and the later breakable-ice-wall concept. This work precedes new islands/levels.
Games-enabled Android and TestFlight testing builds are now authorized so the
shared runtime can be assessed on actual hardware; this does not claim mobile
performance is accepted or authorize public release. Keep full source art while
measuring culling, render passes, mobile quality and reviewed LODs.

## Completed foundation review

The graphics/microphone recovery and independent review pass is complete;
[PR807-PREMERGE-REVIEW-2026-09-24.md](./PR807-PREMERGE-REVIEW-2026-09-24.md)
records the findings and limits. Exact head `7a9666eb` passed all 44 applicable
checks, then the ready-for-review PR Gate rerun also passed before merge.
Mobile testing exposed the performance and Cloudway guidance/collision work
above; it belongs in a focused follow-up. Another Floating Museum art pass
for visible triangulation remains planned after the mobile budget is measured.
Roadmap 9 still waits for acceptance.

### Native testing build enablement

The new workflow profile includes games in non-tag BesideCue PR/main/manual
Android and TestFlight testing builds. It hydrates runtime LFS assets, builds
and verifies native game provenance, and pairs the Android microphone manifest
and iOS microphone plist with the packaged web assets. PR jobs do not upload
TestFlight; main and manual runs keep the existing TestFlight upload behavior.
Android debug APKs are retained, with signed testing AAB/APK artifacts when the
upload key is configured; Google Play internal upload remains manual.

`bc-v*` public-release tags retain canonical games-off manifests/bundles and the
existing 90/150 MiB warning/failure limits. The test profile has a separate
300/340 MiB budget based on a real 378.07 MiB unpacked game-enabled web build
and its 288.72 MiB ZIP estimate. Native run 590 passed: signed Android AAB
302.0 MiB / APK 302.8 MiB, and internal TestFlight 0.1.0 (590) uploaded
successfully. All 43 PR checks passed before merging #860.
This testing configuration supports physical-device measurement; it is not
acceptance of current mobile frame rate or authorization for public release.

## What is playable

The shared package supplies the web `/glass-game` route and the BesideCue native
WebView host. Standard store builds still keep games disabled. First Light is an
ungraded enclosed prologue. Glassworks Journey teaches a comfortable hold; Twin
Galleries introduces lower and higher notes separately before an ordered pair;
Resonance Conservatory teaches settle, two gentle pitch waves, then return to
centre. This is an approachable pitch-wave lesson, not an assessment of stylistic
vibrato. These are existing campaign destinations, not new chapters in this batch.

Merc moves and jumps with keyboard/touch controls, accelerates into running, and
uses a follow/orbit camera. Safe singing stations own microphone setup, reference
playback, capture and shatter. The camera smoothly frames Merc and the exhibit
from an elevated side angle, holds through the effect, then restores exploration.
Manual orbit and zoom remain available. Collisions, tiny-gap support, jump pose,
hand clearance, wall-art mounting/inspection, mirror artifacts/sharpness and the
exit flourish have already received owner playtests and fixes.

The Floating Museum is a live 3D map with modelled islands, temples, Conservatory,
planted terraces, broad flowing waterfalls and earned portrait displays. Mystery
art is a generated flat image inside its frame. The loader uses the actual animated
3D Merc, welcome/laugh clips and visible asset progress. Approved M01/M03 music,
ambience and the Gentle Whimsical D2 voice are integrated; narration and reference
sound yield to assessed microphone capture. Glass-break reactions are varied.

## Approved batch 1–8

| Item                       | Implemented result                                                                                                                                                             | Owner acceptance focus                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1. Platform quality        | Accepted Meshy 7.1 marble, fitted Frost/Glide, existing Crackle; source-preserved geometry and measured texture choices; fog-hidden instance culling                           | Close-up fidelity, loading, sustained tablet frame rate and heat           |
| 2. Camera comfort          | Smooth bounded character/follow response; independent development sensitivity and comfort presets; saved preference                                                            | Diagonal turns, different zooms, manual orbit recovery and touch feel      |
| 3. Current trial route     | Selected crescent with safe rests, planted landmark and edge planters; ribbon/terrace auditions retained; versioned current-trial save                                         | Jump readability, scenery, zero-break checkpoint reload and camera comfort |
| 4. Museum/asset quality    | Camellia dense-to-remesh bake and six instances; hollow Celadon with 18 closed shards; current-world placement audit; 25-model validation; guarded rebuilds and reusable skill | Museum detail, source/contact transitions and device cost                  |
| 5. Configurable melody     | Shared contour compiler, live pitch judge, anchors/glides/breath breaks, transposition and pace; optional Coda Echo in existing galleries                                      | Actual singing fairness, musical phrasing and comfortable tuning           |
| 6. Replay stars            | Easy first clear, authored harder tiers, complete-attempt evidence and save migration; old accuracy results kept separate                                                      | Goals are clear and harder stars cannot come from partial/easy runs        |
| 7. Discoveries/collection  | Optional window/glazing/vase discoveries, finite tokens and distinct earned portraits for existing full galleries                                                              | No duplicate farming; ownership and best results survive replays           |
| 8. Musical memories/finale | Original sung Merc examples, optional Encore seal, explicit opt-in local recording, playback/delete and deliberate download/export                                             | Voice character, recording lifecycle, real microphone and backgrounding    |

Implementation and test details are in the approved execution record. The owner
route is [OWNER-ACCEPTANCE-ITEMS-1-8-2026-09-24.md](./OWNER-ACCEPTANCE-ITEMS-1-8-2026-09-24.md).
Desktop rendering and tablet-sized browser screenshots are not physical-tablet
performance evidence. Software checks do not replace actual singing acceptance.

### Art decisions and source preservation

The earlier coarse silhouettes were caused by source remeshing and excessive
local reduction; dotfiles cleanup and the later runtime-normal pass did not
cause them. The rejected marble whole-shell reductions remain archived. The
selected V7 marble retains 1,256,556 source triangles; 1K/2K texture comparisons
select the runtime maps without changing the relief. Fitted Frost/Glide retain
their source topology and use separate collision proxies. The combined trial
kit is about 2.04M unique triangles and 208 MiB estimated decoded texture mip
storage, so physical-device testing is a real acceptance boundary. Standard glTF delivery
uses four external buffers, each below 24 MiB, to meet the web host's 25 MiB
per-file ceiling without changing the accepted geometry or texture bytes. The
original self-contained GLB remains archived, and web/native manifests include
every dependency.

The accepted museum V8 architecture remains. V10 replaces the former V9 flower
prototype with the camellia bake and preserves eleven unrelated nodes' geometry
and image payloads. Six planters share the same source. The new Celadon supersedes
the rejected opaque V3 trial and old fallback, with measured hollow walls, base
contact and closed shards. Repeated compatible room props are batched within
room visibility boundaries; transparent glass, animated Merc and unique reflection
surfaces retain their own lifecycle. The audit explicitly records such exceptions.

Source guides, provider tasks/receipts, dense donors, rejected and selected
exports, packed Blender projects, texture maps and browser proofs are saved in
repository LFS. Rebuilds verify accepted input/output hashes before promotion.
The [asset audit](../proofs/asset-audit-2026-09-24/README.md) and
[game-asset production skill](../../../.agents/skills/game-asset-production/SKILL.md)
cover hidden geometry/bevels, intersections, surface contact, normals/tangents,
UV/bakes, instancing, fracture and actual runtime review. Do not use triangle
counts or a validator pass as substitutes for an appearance comparison.

Meshy 7.1 and Ultra 4K were verified through the direct API during this work;
the installed wrapper did not expose all those controls. Source production used
the API, with original 4K colour/normal maps retained. No new provider capability
is assumed without rechecking its current API. Meshy's humanoid auto-rig contract
was unsuitable for the droplet-shaped Merc; the game's existing custom rig and
welcome/laugh animations remain in use.

## 9. Next campaign expansion — wait for owner testing

The next authorization should follow acceptance of the current route, museum,
replay and real-singing flows. Do not add levels merely because their reusable
components are ready.

1. Resolve owner feedback on this batch and measure real play duration, tablet
   loading/memory/frame rate/heat and touch comfort. Keep accepted fog and movement
   contracts unless a measured issue calls for a change.
2. Choose the next learning goal and story beat. Candidate: a calm melody gallery
   that teaches three-note glides, then an optional longer phrase. Start with
   authored anchors/curves and Merc examples; tune the optional current Coda Echo
   first, then reuse its compiler/judge rather than create a second audio engine.
3. Compose a longer handcrafted journey from reusable entry, teaching, recovery,
   archive, garden and portrait rooms. One new vocal skill per level; required
   movement stays forgiving. An exploratory first visit of 10–15 minutes remains
   a design target, not a measured duration for current routes.
4. Produce a bounded asset set for that chapter: vases/wine glasses, one earned
   portrait, wall artworks/windows, floor motifs and distinctive room planting.
   Generate concepts first, then Meshy and Blender production with the asset
   checklist. Preserve masters, fit proxies and useful shared variants.
5. Extend the floating map as a living journey: stage paths and level markers,
   unrevealed standing portraits every few steps, island-specific architecture,
   active waterfalls, appropriate vegetation and clear selection/arrival. Scale
   to 10–20 and eventually more levels through data, with scene/loading budgets
   and culling, rather than one permanently loaded giant scene.
6. Add optional platform trials only after the current crescent is accepted.
   Candidate variants are the Opaline Ferry (staggered moving rafts and low/high
   lessons on safe docks) or Frost Conservatory (curved ice, optional crackle
   shortcuts, safe gentle-wave stations). Existing ribbon/terrace auditions help
   choose route shape; they are not extra campaign chapters.
7. Reuse the verified profile/save/collection system for each new chapter. New
   challenge types need explicit contracts and fair acceptance examples, never
   hard-coded level-ID branches in the judge.

## 10. Later mechanics, mastery and social ideas

These remain deliberate design work, not missing pieces in approved items 1–8:

- Refine custom melodies and “feels”: start with 3 notes, expand to 5–7 and up to
  10 where musical phrasing and breath breaks justify it. Tune glides, slides,
  anchors and optional later vibrato; keep the continuous live ribbon readable.
- Evolve the separate Legend/custom-practice concept. Longer holds, tighter pitch
  windows and richer melodies must fit the lesson. A 30-second hold was an idea,
  not an adopted requirement; do not impose it automatically or reward loudness.
- Broaden optional collectible windows, wall exhibitions and floor vases as room
  identity develops. Keep finite exploration tokens separate from learning stars.
  The future ten-level portrait album grows with real authored levels.
- Explore light time pressure on optional cracking/moving/ice routes. Keep the
  main learning journey calm and always provide safe capture stations.
- Brainstorm friendly echo rivals, bubble projectiles, singing races and resonance
  duels. Prototype fairness and separate demonstration audio from capture before
  approving combat, scoring or production assets. No enemies ship in this batch.
- Continue research on Echo Panes/call-and-response, Standing Wave and restoring
  the world through resonance. Reuse historical prototypes as evidence, not as a
  claim that their judges already work in the shared adventure.
- Extend the current local musical memories into richer portrait scorecards only
  after owner acceptance: Merc-versus-player playback, composed results and
  optional sharing presentation. Any future remote account/cloud sharing is a
  separate privacy, retention and deletion design; there are no automatic uploads.
- A non-voice hearing/choice mode remains deferred. If later approved, use an
  audible note and clear options with a short successful-break countdown; it
  must not dilute the voice-first main learning mode.

## 11. Device acceptance and release — later decision

The shared web/native architecture and games-enabled Android/iOS Simulator CI
builds already exist. After content/device acceptance: verify real microphone
permissions, interruption fades, backgrounding, sustained heat/memory and offline
asset availability on actual iPhone/iPad/Android hardware. Check root web routing,
native mini-game entry and saved data separately. Decide games-on store builds,
TestFlight and public `/glass-game` availability explicitly; a green PR is not
permission to merge or publish. Store screenshots and the previously merged
onboarding/audio release fixes remain separate from this game branch.

## Research and earlier phases

The mini-game slice reviews and follow-ups #774–#782, #802/#803, #785, #804 and #806
were handled before this adventure branch. Standard builds keep games disabled.
Read historical delivery receipts for exact releases rather than infer release
status from this development plan.

`MECHANICS-MAP.md` in the dotfiles planning directory maps the original Shipaton
2D game, ludolab explorations and mini-game research to the 3D architecture.
Comfortable-note calibration, fresh voiced frames, hold judging and reference
playback are reused. High/low is now Twin Galleries; gentle pitch waves are the
Conservatory. Manual movement and a free/follow 3D camera supersede old proposals
for voice locomotion or compulsory fixed-camera rooms. The disjoint-colliders
reference project remains read-only.

Detailed companions include `LEVEL-AUTHORING-PLAN.md`, `LONGER-LEVELS.md`,
`MECHANICS-MAP.md`, `PHASE2-CONTROLS-ENCOUNTERS.md`, `PHASE2-LEVELS.md` and
`GRADES-COLLECTION-DESIGN.md` in dotfiles, plus repository plans
[melody](./MELODY-RIBBON-LEARNING-SPEC.md),
[replay](./REPLAY-DIFFICULTY-AND-LEVEL-STARS.md),
[portrait finales](./OPTIONAL-EXHIBITS-REWARDS-PORTRAIT-FINALES.md),
[platform pilot](./CLOUDWAY-PILOT-IMPLEMENTATION.md) and
[friendly rivals](./FRIENDLY-RIVALS-AND-RESONANCE-DUELS.md).
Dated proposal documents retain their historical wording; the approved execution
record and this current master plan state what has now been implemented.

### Android APK feedback — September 24, during mobile follow-up

- Audit camera recentering when combining forward and lateral keys: reported side movement followed by a return to Merc. Reproduce before changing steering design.
- Inspect the final Glassworks Journey portrait orientation (reported upside down), including runtime texture/UV orientation.
- Inspect portrait fracture composition: the picture remains visible while glass behind it breaks. Present picture-bearing shard vs reveal alternatives before changing the effect.
- Melody tracking received a positive device report. Next creative pass: short singable Merc phrases paired with matching reference melodies and configurable scoring, then repeat-after-Merc listening/singing acceptance.

The first musical phrase audition proposal is saved in
[MERC-MUSICAL-PHRASES-2026-09-24.md](./MERC-MUSICAL-PHRASES-2026-09-24.md).
Camera and portrait findings were recorded in
[the Android audit](../proofs/mobile-playability-2026-09-24/camera-portrait-audit.md).

The approved final passes supersede the pending choices in that earlier Android
audit: picture-bearing shards are implemented, the earned picture remains intact,
and brief diagonal steering no longer earns an immediate camera swing. The final
voice delivery contains 88 lazy-loaded variants (39 three-note, 39 five-note and
10 seven-note), 3.22 MB total. Missing seven-note key/pace combinations use the
exact instrumental guide. Every delivered reference completes the shared detector
and judge at 24, 44.1 and 48 kHz; wrong key, constant tone, silence and missed
anchors do not. Encore alone permits a 400 ms consonant gap, without unvoiced
progress, and requires 120 ms fresh voiced evidence per anchor. Real singing and
whether Merc's phrasing feels delightful remain owner listening decisions.

## 25 September — Cloudway laboratory batch

Current execution: [task list](../cloudway-laboratory/v1/TASKS.md). The owner requested fall-stall profiling, a two-row message queue, ten platform designs plus ten props, an exploratory second course (retracting scroll bridge and two-/four-second rose-glass steps) and a browser layout editor with JSON export. Bug fixes stay on #861; new assets/editor/course use `feat/glass-cloudway-laboratory`. The earlier melody-route choice remains unconfirmed.
