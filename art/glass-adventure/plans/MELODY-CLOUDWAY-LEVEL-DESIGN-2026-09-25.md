# Cloudway: a journey made from a melody

25 September 2026. **Design proposal; awaiting owner selection.**

This answers the playtest feedback about misleading break narration, broad
platforms, a mostly straight route, and a melody that should connect the journey
to its final portrait. It does not implement a level, change a save, or spend
asset-generation credits. The current game remains available for comparison.

Open the [route review board](../level-design/v1/review.html) to compare the
current footprint and three proposed wireframes. Proposed drawings show pacing,
direction and encounters; their gaps and dimensions are not validated gameplay
geometry. The current-footprint drawing uses the actual platform bounds.

## Recommended decision

Make **one candidate, The Thawing Song**, under a new development level ID. Keep
today's Cloudway as the movement/physics comparison until the candidate passes
owner tests. The candidate can then replace the intro trial; creating it does
not automatically add another campaign destination or change unlock rules.

Use the existing **Sunlit steps** phrase: five notes, **0, +2, +4, +2, 0
semitones relative to its root**. In one example key that is C–D–E–D–C; the
actual key must fit the singer. Merc introduces it, the player discovers its
notes along a curved frosted garden, and the last portrait asks for the whole
phrase with the existing live melody ribbon.

Every encounter should answer two questions: what did the player learn, and
what visibly changed? Two notes open real frosted barriers. Other notes add to
the visible phrase and produce a beautiful local reaction. Walking and jumping
remain controlled by keys/touch; voice is used at safe challenge stations.

| Choice                                | Benefit                                                                      | Cost                                                                               | Recommendation                     |
| ------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| Rearrange the current trial in place  | Fastest small geometry pass                                                  | Mixes movement regression testing with a new lesson; existing saves need migration | Keep for small fixes only          |
| One separately selectable candidate   | Clear before/after comparison, coherent teaching, preserves current progress | Needs a new content definition and melody challenge adapter                        | **Choose this**                    |
| Build several new playable levels now | More variety immediately                                                     | Splits art/testing effort before the design is proven                              | Keep the other wireframes on paper |

## 1. What the current game actually does

Audited against PR #861, source head `c4632528ef967d2ee3e101f144e11b790f26dcea`.
The read-only audit passed the existing 13 narration tests and 12 Cloudway
content/traversal tests. Some narration tests currently assert the undesirable
behavior; their passing is not evidence that the wording is correct.

### The path-opening line is a real semantic bug

`useAdventure.ts` passes only whether the object is optional to
`narration.breakCompleted`. Required breaks alternate between a path-opening
line and a neutral celebration. Reloading resets the alternation, so the line
can appear to be random. Both its caption and its audio cue say a path opened.
Changing the caption alone would leave the spoken error in place.

| Current Cloudway object | Actual change after shattering                                                                 | Appropriate reaction                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Arrival goblet          | Next voice encounter becomes eligible; exit progress becomes 1/3                               | Neutral celebration; guidance points to the next encounter    |
| Crossing vase           | Final portrait becomes eligible; exit progress becomes 2/3                                     | Neutral celebration                                           |
| Final portrait          | Exit requirements become complete and the exit opens; intact portrait collider also disappears | Exit-specific guidance and a truthful access-opening reaction |

All eleven platforms already exist and are traversable before any glass is
broken. The portrait's own disappearing collision is not evidence that an
inter-station route opened. The present trial has no separate collectible reward
policy; collection ideas below are proposed presentation/progression work.

**Small correction to implement first when work is selected:** replace the
optional/required narration argument with an explicit break outcome. The core
completion event should distinguish ordinary celebration, an authored route
gate/bridge opening, and a closed-to-open exit. Only actual access changes can
select the path-opening cue. Encore completion always celebrates. Prerequisite
activation alone does not mean a route opened. Keep the varied neutral lines,
including “Another beautiful mess.” Do not mark required vases optional to
work around the wording: that would change exit requirements.

Regression coverage must include arrival, crossing after checkpoint restoration,
final exit opening, a real museum gate/bridge, Encore, and matching captions and
audio. Remove odd/even break counts from semantic selection. Emit the outcome
once on the real transition; loading an already completed save must not replay
it. Authored guidance remains the precise next-step instruction.

### Broad platforms are authored bounds, not a lost model rotation

Most of the route advances along world +Z. Examples of actual X width × Z length:

| Surface           | Current dimensions | Interpretation                       |
| ----------------- | ------------------ | ------------------------------------ |
| Arrival           | 3.40 × 3.40        | Wide safe starting deck              |
| Each frost step   | 2.40 × 1.75        | Wider across the route than along it |
| First raft dock   | 2.80 × 1.60        | Broad but short approach             |
| Moving raft       | 1.80 × 1.60        | Almost square                        |
| Each crackle step | 1.80 × 1.65        | Almost square                        |
| Finale            | 4.00 × 4.45        | Already longer along the route       |

The renderer fits donor geometry to these bounds. It does not align a platform's
long axis to an authored route tangent; its only Y rotation here is the tiny
crackle-warning wobble. The crescent variant shifts X centers while retaining
the original Z stations, dimensions and tops. Its route goes about 26.7 units
forward while moving only 5.32 sideways between the first and last waypoints.
That explains why it still feels predominantly straight.

Wide landings are helpful, especially on touch. Making every surface narrow
would add precision pressure without adding purpose. Use a mix instead:

- **Arrival/turn/singing pads:** broad, stable, approximately square. Leave
  space for Merc, the target and the side-view challenge camera.
- **Causeways:** longer along travel; initial blockout family about 1.8–2.2
  wide by 3.0–4.0 long, subject to current capsule/camera and playtests.
- **Cross-steps:** short forward travel and generous lateral landing width,
  deliberately placed where the player redirects rather than everywhere.
- **Moving/crackle surfaces:** retain forgiving footprints and stable recovery
  pads. Turn first, then jump; avoid asking for a sharp airborne camera turn.

These are candidate size families, not promised final dimensions. A 90-degree
orientation must change render placement, collision bounds, gap definitions and
landing checks together. Current physics supports axis-aligned rectangles;
rotating only the mesh would create false footing. Diagonal decks need either
deliberate stepped rectangular support with matching art or a separately tested
oriented-support feature. The first candidate should use cardinal deck modules
and broad turn pads to trace a curve. Keep ornamental trim proportions and UV
scale: author a long-deck variant instead of stretching every ornate donor.

## 2. Research translated into our design

These are design applications, not claims that another game's algorithm can
automatically validate this 3D game.

- Nintendo's original designers describe anticipating how a player will
  approach an obstacle, then revising the placement together. **Application:**
  draw each approach, landing, camera turn and reveal; test the route as a new
  touch player as well as an experienced keyboard player.
  [Nintendo: Designing Levels Together](https://www.nintendo.com/en-gb/Iwata-Asks/Super-Mario-Bros-25th-Anniversary/Vol-5-Original-Super-Mario-Developers/4-Designing-Levels-Together/4-Designing-Levels-Together-212908.html)
- Launchpad separates intended movement rhythm from the geometry that realizes
  it. **Application:** author short sequences of travel, a safe vocal stop,
  feedback and a reveal. Song timing influences the lesson's phrasing, not a
  requirement to sprint or jump on the beat.
  [Smith et al., Launchpad](https://mtreanor.com/publications/Smith-Launchpad-TCIAIG-2011.pdf)
- Tanagra combines designer changes, movement models and geometric constraints.
  **Application:** melody compilation should help author a bounded route whose
  jumps, landings and gate dependencies are checked, followed by real playtests.
  Its 2D playability results do not establish playability for our camera,
  collision system or moving platforms.
  [Smith, Whitehead and Mateas, Tanagra](https://ojs.aaai.org/index.php/AIIDE/article/view/12379)

Our practical sequence is **introduce → practice → variation → musical payoff**.
Limit a section to one new idea. Existing frost, raft and crackle mechanics can
serve the story, but the first melody candidate should not require mastering
all three while also learning a phrase. Begin with gentle frost, ordinary
jumps, two real gates and safe rests. Audition a raft or crackle side route only
after that version feels good.

## 3. Three routes to compare

The wireframes are alternative treatments of the same lesson, not three
implementation commitments. All show five note stations and a final portrait.
Intermediate stepping pieces are pacing suggestions, not one-to-one note events.

### A. The Thawing Song — recommended

A crescent around a frosted garden pavilion. Architecture hides the next turn;
the approved near fog keeps the next one or two landings legible. The first ice
wall opens a view into the garden. The second reveals the final portrait under
a warm glass canopy. From the finale, the player sees the route now illuminated
with the five learned notes.

| Beat              | Movement and composition                                                         | Voice task                | Result and recovery                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Arrival terrace   | Broad deck; select/calibrate the comfortable root and pace, then hear the phrase | Goblet: root, note 1      | First phrase marker lights. Save the selected lesson context and checkpoint before the first attempt                                   |
| Frost promenade   | Long deck, two short offset frost steps, broad turn pad                          | Frost wall: +2, note 2    | Visible fissure, shatter, first passage opens. Safe approach and landing on both sides                                                 |
| Lantern court     | Curve turns around a planted screen; one ordinary jump                           | Vase: +4, note 3          | Highest phrase marker and nearby glass flowers glow; no claim that a path opened                                                       |
| Returning arcade  | Broad corner followed by a short causeway                                        | Frost wall: +2, note 4    | Second passage opens to reveal a glimpse of the portrait; checkpoint at the safe court                                                 |
| Home-note balcony | Calm walk and optional nearby decorative vase                                    | Goblet: root, note 5      | The phrase is visibly complete. Merc offers the complete example again                                                                 |
| Portrait pavilion | Large stable singing space, good side-camera clearance                           | Sing 0 → +2 → +4 → +2 → 0 | Picture-bearing portrait shatters and the exit opens visibly. First design audition is ungraded and awards no new campaign collectible |

Target first-visit duration: roughly **4–6 minutes**, a design target to measure,
not a measured runtime. Replays should be shorter. No mandatory vocal task sits
on a slippery, moving or collapsing floor, and mic permission/reference playback
never consumes a platform timer. Fallen players resume at a safe checkpoint
without having to redo already completed notes.

The walls are the encounter, with a visible resonant glass emblem at Merc's
singing height. They do not require breaking a nearby vase and then singing
again. The first is in a short covered arch with visible side returns and a
lintel above jump height, so bypass prevention looks physical. Art, collider,
challenge state and opening effect reference one logical gate record, compiled
into distinct globally unique runtime IDs. Validate every link. Fog is not a
gate. Checkpoints beyond each wall must explicitly require its completed gate
encounter; restoring a later checkpoint must never put Merc behind intact glass.

### B. The Switchback Conservatory

Three connected terraces with clear left/right changes at wide courts. Tall
frosted screens show silhouettes, then reveal the next room on shatter. The
route uses more long decks and two deliberate corner jumps, separated by safe
turn pads. It offers the strongest spatial contrast to the existing route but
costs more camera/occlusion testing. Use if stronger directional platforming is
more important than the gentler crescent introduction.

### C. The Braided Garden

A clearly marked main melody route winds around a planted core. One optional
spur branches from a completed note court, has a crackle step and decorative
vase, then rejoins before the next required note. It adds exploration without
putting required pitch learning under a timer. It costs more signposting,
anti-skip validation and testing; save it for after A unless the owner prefers
exploration as the first focus. The side vase does not add an extra melody note.

## 4. Melody-to-level authoring

### What already exists and what is missing

| Capability                   | Verified current state                                                                                             | Reuse / required extension                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Old 2D songbook compiler     | Notes, durations, encounters, rests and a whole-song transposition compile into a 2D stage                         | Reuse the content/pacing separation; do not import its voice-driven movement                                             |
| 3D room/component authoring  | Room composition, transforms, explicit solids, activation, exits and validation exist                              | Extend the authoring pipeline with trail modules and melodic roles                                                       |
| Cloudway surfaces            | Frost, translating rafts, crackle, catch checkpoints and current route variants exist                              | Reuse runtime behaviors and current controls                                                                             |
| Melody catalogue/judge       | Authored anchors, glides, timing, confidence/freshness and completion checks exist                                 | Reuse the exact contour and judge; no second pitch tracker                                                               |
| Merc musical references      | Key/pace-matched phrase assets and reference playback exist                                                        | Reuse Sunlit steps for the first audition; check selected key/pace availability                                          |
| Singer calibration           | The 3D melody UI stores a comfortable root; its MIDI 36–84 envelope is static, not a measured personal range       | Keep whole-phrase key adjustment and explicit audition; true low/high range capture is additional work                   |
| Main exhibit challenges      | `hold`, `ordered-pair`, `settle-wave`; targets are `comfortable`, `low`, `high`                                    | Add an explicit melodic-anchor target and a main-game `melody` challenge adapter                                         |
| Encore                       | Optional melody experience after gallery progress                                                                  | Share its proven pieces; it does not currently make a main portrait depend on melody completion                          |
| Real route-opening reactions | Requiredness currently stands in for opening                                                                       | Add explicit completion effects/outcomes and use them for voice and guidance                                             |
| Ice barrier exhibit          | Generic gate/solid activation and frosted exit presentation exist                                                  | Author a reusable wall encounter with intact/fractured art, safe approach and real blocking                              |
| Melody attempt persistence   | SavedProgress v2 has checkpoint, completed object IDs and rewards; no melody root/pace/version or attempt identity | Extend and migrate the save contract before a melodic route is resumable                                                 |
| Melody score/portrait reward | Hold/pair grading and campaign portrait collection exist; Cloudway has no reward policy                            | First candidate is ungraded; later add a reviewed melody grading policy and register its portrait metadata before awards |

The old 2D implementation lives in
`apps/beside-cue/src/games/glass/levels/{types,compile,feel}.ts` and is explained
in `apps/beside-cue/docs/games/melody-levels.md`. It really does compile songs
into stages. Its “voice controls height/jump” rules are historical and do not
apply to the approved 3D controls. Some older Cloudway research still labels
dynamic platforms as future work; the runtime now implements them.

The shared 3D system is a good foundation, but **a melody-driven Cloudway is not
already ready just by changing level JSON**. The missing target contract,
main-portrait adapter and authoring/compiler validation are bounded work.

### Proposed authoring contract

One source of truth should drive the reference, target markers, station order,
final ribbon and assessment. Example below is **proposed data, not a current API**:

```ts
const thawingSong = {
  id: 'cloudway-thawing-song-v1',
  melody: { id: 'sunlit-steps', version: 1 },
  routeTemplate: 'garden-crescent-v1',
  control: 'manual-movement',
  lesson: {
    noteStations: [
      { anchor: 'sunlit-steps-home', object: 'goblet' },
      {
        anchor: 'sunlit-steps-two',
        object: 'frost-wall',
        gate: 'garden-entry',
      },
      { anchor: 'sunlit-steps-four', object: 'vase' },
      {
        anchor: 'sunlit-steps-back-two',
        object: 'frost-wall',
        gate: 'pavilion-entry',
      },
      { anchor: 'sunlit-steps-return', object: 'goblet' },
    ],
    finale: { object: 'portrait', challenge: 'whole-melody' },
  },
  travel: { profile: 'intro', optionalTimedSpur: false },
  presentationSeed: 'thawing-song-v1',
}
```

1. Validate melody IDs, unique anchor IDs, note count, rests and supported range.
   Repeated pitches remain distinct learning events; the last root cannot be
   credited because the first root was sung earlier.
2. Select an authored route template and fill its allowed encounter slots.
   The melody specifies the learning sequence; the template specifies turns,
   safe pads, sightlines and movement beats. Compilation must reject a phrase
   that exceeds its available slots rather than spilling arbitrary platforms
   into space. A longer phrase needs an authored longer template.
3. Compile stable IDs, note stations, gate dependencies, checkpoints, explicit
   intentional gaps and the final portrait into the extended 3D level contract.
   Use separate purposes for a platform and a note station. A longer held note
   must not automatically create a longer or harder jump.
4. Validate geometry and dependency graphs against the actual Merc movement
   configuration. Include landings, headroom, camera space, all raft phases if
   used, gate bypasses and recovery paths. Reject unreachable or circular goals.
5. Export a deterministic plan, top view and diagnostic report for review.
   Author-adjust modules and compile again. Decoration variation can be seeded;
   required geometry, note order and rewards do not shuffle on each retry.

This is an **authoring tool first**. It can later accept another approved melody
and template. Arbitrary user-entered notes generating a new world during play
is a separate product decision and not needed for this candidate.

### Range, phrase and difficulty rules

- Calibrate or select the comfortable root and pace **before** the first example.
  The current 3D melody calibration captures one comfortable note, not a personal
  low/high range; MIDI 36–84 is only a static validity envelope. Audition the whole
  phrase and allow whole-phrase key adjustment. For offsets 0..4, offer centering
  around that comfortable note rather than assuming it must be the lowest note.
  True measured-range capture is a separate extension, not an existing guarantee.
- Current recorded Sunlit steps variants cover roots MIDI 48–60 and paces
  0.8, 1 and 1.25. Inside that bank use the matched Merc take (“Tiny sparks can
  glow”). Outside it, keep a comfortable valid key and use the existing exact
  synthesized guide, clearly described as a guide. Do not move a singer into an
  uncomfortable recorded key. Producing additional Merc keys is later asset work.
- Never clamp individual notes into range: that changes the melody. If the
  phrase cannot fit, offer recalibration or a clearly named authored narrower
  variant such as First arc, with its own content identity. No silent substitution.
- Freeze melody version, root and pace for the whole route attempt, including
  checkpoint restoration. Before the first break, key adjustment is free. After
  that, changing key/pace requires an explicit fresh route attempt with rebuilt
  targets and references; retain lifetime collection ownership separately.
  This is a new persistence contract: save attempt ID, melody/version, root,
  pace, transposition and per-anchor evidence with the route. Existing completed
  IDs merge monotonically, so do not try to restart a lesson by deleting a few
  IDs from a v2 save. Scope lesson evidence to the new attempt and use the replay
  flow with an explicit reset/migration rule; old-key evidence must never finish
  the new-key portrait. Legacy saves for current Cloudway remain untouched.
- Note stations can start with the current forgiving intro hold policy. Final
  melody assessment uses the existing anchor/glide judge, not a long-note bar
  and not elapsed time. Replay only the current attempt after a mistake; keep
  completed travel encounters and safe recovery.
- Use the existing phrase timing as an audition baseline. Sunlit steps currently
  has four 0.4 s landings, a 0.6 s final landing and four 0.65 s connections:
  **4.8 s before pace scaling**. Validate the actual Merc recording and real
  singing at that pace. A breath changes the authored contour and reference
  together; do not reward a hidden pause the example did not teach.
- No advanced vibrato or exact metrical rhythm requirement in this first
  candidate. Later tiers may change evidence/tolerance policies explicitly;
  speed, platform risk, singing accuracy, stars and collected objects remain
  separate. The first candidate is explicitly **ungraded**, with local completion
  only. Melody is not covered by the current hold/pair grading policy. Campaign
  awards later need an explicit melody grading adapter, portrait metadata and
  collection registration using the existing systems; no automatic award is
  implied. Do not change current trial unlocks during this audition.

## 5. Feedback, visual composition and assets

The phrase appears as five small glass notes joined by a restrained curve at
safe stops. Completing a station illuminates its own note, including repeated
pitches as separate positions. During travel keep the HUD quiet. At the final
portrait, expand the same phrase into the existing live ribbon; Merc's matched
example and the player's trial use exactly those targets.

Suggested concise controls: **Sing**, **Hear example**, **Try again**, **Change
key**. Longer explanation belongs behind the existing help action. Keep the
phone Sing button discoverable; reference/narration ends before assessed capture.
The existing side camera should frame the wall/emblem and Merc, with room to
see the resulting passage opening. No unrequested camera spin on each note.

| Asset / module                   | Use in candidate                                                    | Production approach after approval                                                                                              |
| -------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Broad marble deck and cross-step | Safe landings, turns, singing stations                              | Reuse current accepted high-detail platform family and matching bounds                                                          |
| Long marble causeway             | Clear forward runs between short jumping groups                     | One proportionate module; preserved trims/UV density, not extreme donor stretch                                                 |
| Frosted wall in covered arch     | Two real voice-opened passages                                      | Shared opaque/rough frost pane, crack stages, bounded fracture set and authored collision                                       |
| Resonant wall emblem             | Readable voice target at Merc height                                | Reuse visual language of glass targets; glass face fractures with the wall                                                      |
| Planted screen / pavilion        | Hide a turn and frame the final reveal                              | Reuse garden/temple pieces where silhouettes work; inspect camera clearance and contacts                                        |
| Five note markers                | Connect the musical lesson visibly                                  | Shared instanced geometry/material; separate saved state per anchor                                                             |
| Final portrait                   | Musical payoff, then later registered score/collection presentation | Existing picture-bearing fracture system; first audition ungraded; register a distinct collectible only at campaign integration |

Meshy and Blender are appropriate for the missing long deck and arch/wall kit
after route approval. Preserve raw sources, bake detail into reviewed lower-cost
variants when needed, inspect normals/intersections/contact and validate exports
with the game-asset-production procedure. Do not decimate approved art to fund
the new scene. Repeated arches, planters and note markers should share geometry
or instances. Budget visible fracture shards and transparent layers on actual
Android/iOS hardware before decorating a long route.

Fog remains the existing approved presentation. Physical screens do the major
reveal work; the next landing must remain visible, and neither a gate nor its
activation must depend on the fog/culling pass. Optional scenery should support
the route's silhouette and not hide a touch-sized singing interaction.

## 6. Execution order and acceptance

These unchecked items are deliberately **future work awaiting design approval**,
not unfinished implementation hidden in this planning delivery.

- [x] Audit current narration, platform bounds, route shape and prerequisites.
- [x] Reconcile the 2D compiler, existing 3D authoring and live melody system.
- [x] Research primary design sources and produce three route wireframes.
- [x] Save this proposal and link it from the master plan/task record.
- [ ] Owner selects A, B or C, and confirms the first candidate's phrase length.
- [ ] Correct narration outcomes independently; prove current Cloudway and museum
      gates keep their existing progression, including checkpoint restoration.
- [ ] Block out **only the selected route** using current assets. Verify deliberate
      mixed platform orientations, safe singing perches, two real barriers, camera
      turns, checkpoint recovery and the staged reveal. Show top/side runtime views.
- [ ] Add the shared melodic-anchor target and main-game melody adapter, then
      compile this one phrase into the selected route. Prove the final portrait cannot
      finish from silence, a constant note, a skipped anchor or a stale observation.
- [ ] Add versioned melodic attempt persistence and migration; prove a resume
      retains root/pace, a deliberate retune starts clean evidence, and every
      post-gate checkpoint rejects restoration without its gate prerequisite.
- [ ] Play through with touch and keys, replay matched Merc audio and sing it back
      on actual hardware. Collect owner feedback on musicality and challenge fairness.
- [ ] Produce only the missing approved art modules, inspect contacts and
      full-detail versus budgeted export screenshots, then integrate fracture/audio.
- [ ] Review visual and rendering budgets on physical devices; save a complete
      before/after route video and images from the same camera positions.
- [ ] Owner accepts the candidate; separately decide replacing the current intro,
      preserving/migrating saves, campaign placement and unlock rules. Define the
      melody grading adapter and registered portrait reward before adding campaign
      awards. Only then expand the other route concepts or additional melodies.

Acceptance checks: each required break has a clear, truthful consequence; all
required notes are taught before the final phrase; two gates really block until
sung open; the next one or two landings are readable without showing the whole
finale; no new precision jump is combined with a new voice mechanic; intended
gaps are intentional and visible; a restore preserves the right phrase/root and
completed encounter IDs; mobile input never overlaps help/reference controls;
no paid reward, enemy pressure or recording consent is introduced implicitly.

## 7. Relationship to the master plan

This is the next **design decision**, not permission to skip physical acceptance
of PR #861 or a new public release. It consolidates earlier requests for curved
Cloudway variants, frosted walls, purposeful platforms, note melodies and a
portrait finale. Existing advanced ideas remain in their own records: friendly
rivals/enemies, wider campaign expansion, custom/legend difficulty, musical
memory sharing and further museum art passes. They are not required for this
first candidate and have not been silently cancelled.

Relevant records:

- [Current master plan](./NEXT-MASTER-PLAN.md)
- [Cloudway layout auditions](./CLOUDWAY-LAYOUT-AUDITIONS-2026-09-24.md)
- [Mobile playability and current exit rules](./MOBILE-PERFORMANCE-AND-GUIDANCE-FOLLOWUP-2026-09-24.md)
- [Melody ribbon learning specification](./MELODY-RIBBON-LEARNING-SPEC.md)
- [Melody implementation](./MELODY-IMPLEMENTATION-2026-09-23.md)
- [Encore integration](./ENCORE-IMPLEMENTATION-2026-09-24.md)
- [Replay difficulty and stars](./REPLAY-DIFFICULTY-AND-LEVEL-STARS.md)
- [Optional exhibits and portrait finales](./OPTIONAL-EXHIBITS-REWARDS-PORTRAIT-FINALES.md)

Source entry points: `packages/glass-game/src/content/cloudway-{trial,layouts}.ts`,
`render/cloudway-platforms.ts`, `contracts.ts`, `authoring/`, `ui/narration.ts`,
`ui/useAdventure.ts`, `content/merc-reactions.ts`, `browser/merc-narration.ts`,
`content/melodies.ts`, `core/melody-{contour,judge}.ts` and `ui/MelodyPractice.tsx`.
