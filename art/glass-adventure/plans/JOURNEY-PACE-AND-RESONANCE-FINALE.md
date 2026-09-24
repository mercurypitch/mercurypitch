# Glassworks — journey pace, tutorial and resonance finale

Owner direction, 2026-09-20. This updates the existing longer-level and portrait
plans. Keep the spacious architecture. The enclosed slice becomes the basis of
the introductory tutorial; the larger Glassworks journey becomes the first full
level. Implementation and acceptance status are tracked separately below.

## This playable polish pass

### A natural stride without another mobile button

Levels may author walking speed, running speed, run-up delay and ramp duration.
The chamber starts at 1.55 world units/second, builds after 0.6 seconds of
committed movement, and reaches 2.7 over the following 0.8 seconds. Its old speed
was 1.15. These are initial playtest values, not universal campaign constants.

Short taps remain precise. Small thumbstick deflections remain slow. Stopping,
reversing, bumping into a wall, starting a voice encounter, pausing or respawning
must not leave a charged sprint waiting to surprise the player. Jump height and
gravity stay unchanged; jump distance still depends on the speed at takeoff.
Future room validation/playthroughs therefore need to test both walking and
running approaches to gaps, not infer reachability from a single jump number.

Existing narrow/open route and foundation proofs keep their previous default
speed until intentionally retuned. The expanded full level can use its own pace.
No sprint button, stamina bar, timed pressure or speed reward is introduced.

### The resonance veil

The old exit looked like an upright hoop but tested a thin floor rectangle only
while Merc was grounded. A jump could cross it and land beyond the trigger.
Display and trigger will share one portal geometry derived from authored exit
bounds. Crossing the opening on foot or in the air counts once when its required
encounters are complete. A nearby jump, locked portal, or crossing far above or
below the opening must not finish the level.

Visual direction: a brass frame holding a thin pearlescent glass veil. Dormant
glass is quiet; the earned exit glows softly and ripples. On crossing, the veil
opens into a brief release of bubbles, glints and small light arcs. The existing
results panel appears after about 1.2 seconds. Reduced motion uses a restrained
static/fade treatment. No rapid flash, extra singing requirement or precision
jump is needed to finish. The exit should be recognizable in the room, not only
from an instruction floating over the game.

This is a small real-time effect, using the existing material palette. It does
not need a new large generated model, cloth simulation or streamed cinematic.
Collision remains stable while the cosmetic effect disperses. Completion is
saved immediately; interrupting the effect cannot lose the earned result.

### Merc reactions

Keep the selected D2 Gentle Whimsical identity. Add short reactions including
“Another beautiful mess.” Draw reactions from a shuffled pool rather than
repeating one optional-break line. Use all pool entries before reshuffling and
prevent an immediate repeat across pool boundaries. Required-route guidance
remains readable separately from Merc's exact spoken caption. Muting Merc keeps
the caption; starting microphone capture cancels pending narration and its tail.

No response implies a measured singing grade: “sparkling” is character delight,
not a hidden assessment. Future grade language must be backed by actual evidence.

## The campaign shape

| Stage                            | Teaching and route                                                                                 | First content target                                                                                                                              | Exit role                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Tutorial — First Light Gallery   | Move, orbit, optional safe hop, Sing, find a comfortable note, hold, see a persistent route change | Current enclosed chamber, two required displays and one optional coupe; short enough to learn without fatigue                                     | Introduce the same resonance veil used in later levels; first collection reward can be a Merc keepsake, not one of the ten Legend portraits |
| Level 1 — Glassworks Journey     | Apply the familiar held note through a longer handcrafted museum                                   | Vestibule → concealed window passage → garden → archive → portrait salon → panorama; four required displays and roughly four optional discoveries | Final portrait earns the level's collectible and opens departure; player can still explore before crossing                                  |
| Level 2 — Twin Galleries         | Comfortable low/high notes, then an intentional two-note order                                     | Related lower/upper galleries with broad connected routes, four paired stations, three optional exhibits                                          | Familiar final pair earns portrait; same veil and departure sequence                                                                        |
| Level 3 — Resonance Conservatory | Settle near a note, then deliberately add gentle vibrato                                           | Garden rest → crystal rooms → botanical loggia → hero display → sunset                                                                            | Familiar settle/wave finale earns portrait; no surprise louder or longer note                                                               |

The full routes remain handcrafted from reusable rooms, ports, mounts, gates,
collision proxies, audio regions and visual recipes. They are not generated by
randomly stacking decorative meshes. A 10–15 minute first exploratory visit is a
playtest goal for full levels; the tutorial should be markedly shorter, initially
aiming for 3–5 minutes including instruction and retries. Do not achieve either
duration by slowing Merc or extending required breath holds.

Preserve the current `glassworks` and `glassworks-chamber/chamber` saves. When
the tutorial becomes a campaign entry, map its role explicitly; do not reset
progress merely to rename it. A new expanded `glassworks-journey` ID separates
the long route from the prototype. Public selection and next-level navigation
need a campaign registry before a button can honestly promise the next level.

## Portrait success and departure are different moments

Recommended future sequence:

1. Complete the taught voice mechanic at the finale portrait on a safe pad.
2. Reveal and save the collectible portrait; calculate any available lesson
   grades from the actual recorded pitch evidence.
3. Open the resonance veil, show a view toward the next wing, and let the player
   choose to explore remaining optional displays or leave.
4. Optionally try a short encore at a separate safe listening mark.
5. Walk or jump through the veil for the brief departure flourish, then show the
   portrait scorecard and Continue / Revisit / Collection actions.

The portrait must not vanish unearned just because the player reached an exit,
and a weak encore must never revoke the portrait or lower the completed lesson's
stars. Interrupted departure can resume from a saved completed level. Campaign
travel changes the loaded level only after completion has persisted.

## A branded final flourish: Coda Echo

Recommended later experiment: **Coda Echo**, an optional musical signature at
the veil. Merc demonstrates a tiny phrase using only the level's taught skill;
the player answers while standing safely still. The response adds a visible
streak of light to the departure and a small separate Encore seal on the portrait.
This ties the farewell to vocal learning and Merc's personality.

Start small: one held note in the tutorial/first level, the known low/high pair
in level two, and the already-taught gentle wave in level three. Later Echo
Archive lessons can use a short original three-note phrase or a few sung words.
Speech TTS is not a pitch-accurate sung reference. A sung-reference production
and pitch verification step is required before shipping melodic imitation.

The first encore pilot should use completion feedback, with one clearly stated
bonus condition if evidence is reliable. Do not invent three extra stars for a
three-second exit. A cosmetic seal is easier to understand than a second scoring
system competing with the level grade. Only later, after grading validation,
consider an evidence-based best-ever encore result.

Alternatives to keep for review:

- A running jump through a bright part of the veil can change the bubble trail
  cosmetically. It should not change singing stars or gate progression; it would
  otherwise reward platforming accuracy in a vocal-learning result.
- A sweeping curtain and camera fly-through can make a later hero finale more
  theatrical, but must preserve reduced motion, wall clearance and interruption.
- A collectible melody fragment could join a personal museum theme after several
  levels. This depends on a real collection/music system and is not this pass.

Any saved player performance is opt-in and local first. Replay can compare Merc's
verified reference with the player's take. Sharing is a separate explicit action;
no automatic upload, public recording or requirement to record to earn progress.

## Delivery order and acceptance

- [x] This pass: configurable run-up in chamber, reliable swept exit, resonance
      veil, completion timing, extra D2 reactions and synchronized captions.
- [x] Verify short/long movement, analog input, wall collision and lifecycle
      resets; walk/jump/locked/rotated portal cases; one completion and durable saves.
- [x] Inspect live rendered exit states on phone and desktop; verify fixed
      framing and brief release with reduced-motion tests.
- [ ] Owner checks faster travel, walk/jump exits and new D2 reactions on a device.
- [ ] Loading-screen follow-up: implement the opaque Merc presentation and true
      readiness contract already saved in LOADING-SCREEN-POLISH.md.
- [ ] Turn the accepted chamber into an explicit tutorial campaign entry, with
      minimal contextual teaching and a clearly skip/replayable tutorial.
- [ ] Block out the full held-note route from LONGER-LEVELS.md. Play the entire
      route before producing additional walls/vessels. Extend the existing museum
      identity with controlled outdoor views and concealed reveals.
- [ ] Implement reliable scoring/portrait persistence and campaign navigation as
      separate reviewed work, then add optional window/glazing encounters.
- [ ] Validate the low/high and vibrato lesson adapters in bounded rooms before
      filling their longer wings.
- [ ] Prototype Coda Echo only after the core lessons and portrait results work.

Today does not introduce coins, measured stars, portrait collection storage,
recording/sharing, a ten-level campaign, or a next-level destination. The existing
completion panel remains honest about available actions.
