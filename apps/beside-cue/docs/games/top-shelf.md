# Slice 6 — the Top Shelf

The runner-up world from `sorting-line.md` §1, and the last mechanic
before V1 of the mini games (maff, 2026-09-05). Its forks were asked in
`slice-5-polish-to-v1.md` §3; all seven defaults stand (maff,
2026-09-11). This is the plan those defaults make, with the numbers they
need and the decisions they did not settle.

## 1. The fantasy, in one sentence

Hum a note, hum a higher one, and Merc leaps exactly that much higher.

The Sorting Line trains where a glide stops; the chambers train a mode
and a wobble. The Top Shelf trains the distance between two notes --
relative pitch, the skill a singer uses in every phrase and nothing in
this app measures yet. It is a new verb for the reason the Line is: the
room cannot be described in the Cabinet's words. A pitch cursor has a
position. This has a gap.

## 2. Why the proposal did not close, and what closes it

`sorting-line.md` §1.2 found the geometry broken: at 0.06 m per
semitone, shelves five semitones apart are 0.30 m apart and Merc is
0.55 m tall, so its tolerance model -- overshoot and splat on the
underside of the shelf above -- needed a gap he does not fit in, and a
head test in the locomotion every world stands on.

Two defaults close it. **The shelves are a staircase (T1)**: each shelf
starts where the last one ends, so no shelf ever hangs over another and
the vertical spacing no longer has to exceed his height. **There is no
splat (T3)**: the underside is never reachable, so the head test is not
needed. What remains of the proposal is its good part: the interval is
the height.

## 3. The rules

**3.1 The reference.** Every settled note is a stop, found by the Line's
slide tracker (`sim/line-grade.ts`: held within a tenth of a semitone
for 150 ms, and a new stop only after leaving the last one by more than
half a semitone). The last stop is the reference.

**3.2 The leap.** A stop ABOVE the reference is a leap. Its apex is
`(stop - reference) * RISE_PER_SEMI` -- 0.1 m per semitone (T1) --
capped at `MAX_LEAP`, 0.9 m. He jumps straight up with the velocity
that reaches that apex under the locomotion's own gravity, and drifts
forward at walking pace while airborne, toward the next shelf. The stop
fires it. There is no button: the jump button is hidden in this world
(`jump: false`), and walking alone never climbs.

**3.3 Down is free.** A stop BELOW the reference, or on it, only moves
the reference: he crouches a little, visibly readying, and stays put.
This is what keeps every room inside every voice. Five leaps stacked up
the range would need two octaves and more, and a working range is 22
semitones; with down free, each leap is sung from wherever is
comfortable.

**3.4 Landing, and the catch.** A riser is a wall while his feet are
below its lip -- the Line's wall pattern, and never behind him. The wall
lifts once his feet are within `CATCH`, 0.05 m, of the lip: his mitts
catch it and he is on. So an interval up to half a semitone flat still
lands, and that tolerance is geometry, the mitts' reach at this scale,
not a constant (the Top Shelf's own rule, which the Line adopted in §6).

**3.5 Undershoot and overshoot (T3).** Short of the catch, the riser
holds him and he comes back down on the shelf he left: a hop, not a
fall. Past the lip, he lands on the next shelf all the same, and the
grade records how far past, in cents. No leap in a V1 room can reach two
shelves, so an overshoot never skips one.

**3.6 Mid-air.** Stops during a leap move the reference and never leap:
the next leap is measured from the last note held, wherever it was held.

**3.7 Falling (T4).** Walking off a shelf's low edge steps him down to
the shelf below. No V1 room has a gap to fall into; if one is ever
built, a fall returns him to the last shelf he stood on, as the chute
returns him to the lip.

## 4. The rooms (T5)

Rises in semitones; a shelf's top is the sum of the rises below it.
Depths are along the room, in metres.

| Room | Teaches                                     | Rises      | Tops (m)           | Depths                                                     |
| ---- | ------------------------------------------- | ---------- | ------------------ | ---------------------------------------------------------- |
| 1    | Sing a note, then a fifth above it.         | 7          | 0.7                | floor 2.0, one shelf 2.4 with the exit                     |
| 2    | Thirds and fifths, each from where you are. | 4, 7, 3, 7 | 0.4, 1.1, 1.4, 2.1 | floor 1.6, shelves 1.0, the last 1.6 with the exit         |
| 3    | An octave is two leaps.                     | 7, 5, 7, 5 | 0.7, 1.2, 1.9, 2.4 | floor 1.6, ledges 0.7, shelves 1.0, the last 1.6 with exit |

Room 3's second shelf is an octave above the floor, and no single leap
reaches it (`MAX_LEAP` is nine semitones). The ledge between is a fifth
up, so the octave is sung as a fifth and then a fourth, and the ruler
(§6) says "8ve" where he lands. The twist is taught by the room, not a
sentence.

Hints, two sentences each, on the gate card in the Line's pattern:

1. "Hold any note, then sing a higher one: the gap between them is how
   high he leaps. A fifth gets him onto the shelf."
2. "Each leap is measured from the note you last held. Come back down to
   a comfortable note before the next one; going down never moves him."
3. "The top shelf is an octave up, and no leap is that big. Stop on the
   ledge a fifth up, then leap the rest."

## 5. Geometry, per voice preset

Intervals are relative, so the rooms are the same for every preset; what
a preset changes is only whether each ask fits its voice. The largest
ask in any room is seven semitones and `MAX_LEAP` is nine; every preset
in `VOICE_PRESETS` has a 22-semitone working range, so every leap fits
with room to start it anywhere in the lower half. And no room can be
cleared by resting: every riser is at least three semitones (0.3 m),
walking cannot climb one, and silence makes no stops.

| Preset   | Working range | Largest ask | Fits with the start in the lower | Rises per semitone |
| -------- | ------------- | ----------- | -------------------------------- | ------------------ |
| Bass     | 41-63         | 7           | 15 semitones                     | 0.1 m              |
| Baritone | 46-68         | 7           | 15 semitones                     | 0.1 m              |
| Tenor    | 49-71         | 7           | 15 semitones                     | 0.1 m              |
| Alto     | 54-76         | 7           | 15 semitones                     | 0.1 m              |
| Soprano  | 61-83         | 7           | 15 semitones                     | 0.1 m              |

Clearance, which is what broke the proposal: Merc at rest is 0.55 m
tall and 0.53 m wide with his mitts. The shallowest shelf is room 3's
0.7 m ledge, which leaves 0.085 m either side of him; nothing overhangs
anything, so the headroom above every shelf is the whole room.

Rooms rise to 2.4 m. The chase camera follows `y` as it follows `x`,
eased the same way, and the vertical-FOV widening rule frames portrait.

## 6. The thirty seconds (T7): a ruler, and the tube

A semitone ruler runs up the wall behind each riser: a tick every
0.1 m, labelled at the intervals the rooms use -- m3, M3, P4, P5, 8ve --
measured from the shelf he stands on. At each leap's apex, a line
flashes at the height reached with the interval sung beside it
("P5 +12c"). Film it: a note, a higher note, and a chrome droplet leaps
exactly the height the ruler says.

The Line's tube (`ShapeGauge`) returns as an interval gauge: the column
is the voice above the reference, the band is the next shelf's ask, from
the catch below it to the ask itself, and the top of the glass is
`MAX_LEAP`.

## 7. The grade

In the Line's units (`sorting-line.md` §9). Per shelf, the first leap
aimed at it decides **first-try**: it landed. **Overshoot** is
`(sung interval - ask) * 100` cents when positive, and 0 within the
catch. Quality is `clamp01(1 - overshoot / 100)` -- a whole semitone
sharp is worth nothing -- through `qualityFromCents`. The room's grade
is the mean, kept per room for the best run (`createTrack`, and a twin
of `line-stats.ts`). The cards read like the Line's:

```
The Octave -- 18c past the shelf · 3 of 4 first time
The Top Shelf, climbed. 22c past the shelf on average · 8 of 9 first time
```

with the same medal at the same thresholds (`LINE_SCORE`), and nothing
gated on it.

## 8. Steps

| Step | Contains                                                                                                                                                                                                                           | Done when                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 6a   | Spike: `leapVelocity` in `sim/locomotion3d.ts` (additive); `levels/shelf.ts` with the rooms as data, the tops, the ground sampler with the catch, the riser walls and the leap rule, all pure; `/shelf-probe.html`; a headless e2e | maff judges the scale on his phone; the Hallway, chamber and Line tests pass unchanged |
| 6b   | `Shelf3D` and `ShelfStage`, forked from the Line's; the slide tracker drives leaps; room 1 playable; a `__w3s()` dev hook with `sing(midi)`                                                                                        | room 1 climbed in the browser by hook, and by voice on the phone                       |
| 6c   | Rooms 2 and 3; the ruler; the interval gauge; the camera following `y`                                                                                                                                                             | every room climbed; the 2.4 m room framed on a portrait phone                          |
| 6d   | The grade, the cards, the track and stats, the Games card in V1 order                                                                                                                                                              | a run's card reads in cents; bests persist                                             |
| 6e   | Slice 5's haptics and juice on landing; the reduced-motion path                                                                                                                                                                    | felt on the phone; calm under reduced motion                                           |
| 6f   | The device pass: `RISE_PER_SEMI`, `CATCH` and `MAX_LEAP` against M1-M3 (§10)                                                                                                                                                       | the numbers in §3 are measured, not chosen                                             |

## 9. Decisions the T defaults did not settle

- **D1. Down is free** (§3.3). The alternative, every leap stacked on
  the last, bounds a room by the voice and makes room 2 impossible for
  a narrow one.
- **D2. `MAX_LEAP` is 0.9 m, nine semitones.** Room 3 needs a cap below
  an octave, and nine is above every ask in rooms 1 and 2, whose
  largest is seven. It is a body limit -- his spring -- and the ruler
  shows it.
- **D3. `CATCH` is 0.05 m**, half a semitone flat at this scale.
- **D4. Risers are walls through the Line's pattern**, and there is no
  head test anywhere; T3 made it unnecessary, and the locomotion every
  world stands on changes by one additive function.
- **D5. An overshoot never skips a shelf** in a V1 room.
- **D6. First-try means it landed.** Overshoot is graded separately, so
  a sharp landing is a first try with a cost, not a miss.
- **D7. No jump button, and walking never climbs.** The voice is the
  only way up.
- **D8. Mid-air stops move the reference** and never leap.

## 10. What only a measurement can answer

- **M1.** How far a first-time singer's fifth lands from 700 cents,
  against a catch of 50 cents flat and a zero at 100 cents sharp. Maff
  and one stranger, in 6f.
- **M2.** Whether a 150 ms stop reads as "he jumped when I sang" or as
  late. On the phone in 6b; the slide tracker's hold is a dial.
- **M3.** Whether a 2.4 m room frames in portrait with the camera
  following `y`. In 6c.

## 11. What the steps landed

### What 6b landed

`render/Shelf3D.ts` and `render/ShelfStage.tsx`, forked from the Line's,
with room 1 playable from the Games list ("The Top Shelf", after the
Sorting Line), and the rule itself in `sim/shelf-voice.ts`: the Line's
`slideStep` finds the stop, every stop becomes the reference, and only a
stop above it sung on the ground leaps. `window.__w3s()` in DEV holds a
note with `sing(midi)`, which still goes through the slide tracker, so
the e2e climbs room 1 by the same 150 ms stops a voice makes.

Decided here, where the plan was silent:

- **The camera follows the shelf, not the leap.** It eases to the top of
  the shelf he last stood on. A chase that rode the leap would rise with
  him and flatten the height the player is watching; on a landing it
  arrives at the new shelf at the Line's rate, 3.2 per second.
- **The carry overrides the thumb.** Airborne from a leap he drifts
  toward the next shelf at walking pace whatever the pad says; a step
  off a low edge is not carried. The jump intent is dropped everywhere,
  keyboard included, not only the button (D7).
- **The carry goes on across the lip.** The catch takes him by the
  mitts with most of him still over the drop, and the first headless
  frames showed him perched on the edge like that. So a leap that lands
  him on a higher shelf walks him on until all of him is past its lip,
  0.53 m, about half a second: "he is on" (§3.4) is a step onto it.
- **The first stop of a room only readies him**, since there is nothing
  to measure it from, and a new room starts with no reference, so a note
  held across the handover cannot leap him at the start line.
- **The crouch is a squash**, 6% wider and 12% shorter through
  `setShape`, eased in on a stop that only moved the reference and held
  while that note is; a quarter second of silence or a new slide lets it
  go. There is no crouch clip, and the squash keeps his feet where they
  are.
- **The exit lights when he stands on the top shelf**, where the Line
  lights it when every gate is passed; there are no gates here.
- **The HUD names the interval being sung** above the reference, as the
  apex flash will (`P5 +12¢`), "ready" at or below it, and "hold a note"
  before there is one.

What the code showed that the plan did not say:

- **A leap that lands is short.** The catch takes him at the apex, so an
  exact fifth is in the air 0.48 s, against 0.96 s for a leap that comes
  back down. A note meant to settle mid-air (§3.6) has to start moving
  within a third of a second of the launch; the e2e's first try at it
  sang the stop after he had landed and leapt him a third time.
- **A leap only reaches a riser from close by.** From a standstill the
  carry covers 0.62 m before a fifth drops out of the catch, and room 1
  starts him 1.34 m short of where his mitt meets the riser. A fifth
  sung at the start line is a hop that lands 0.3 m short. The hint does
  not say "walk to the shelf first"; the room teaches it, or 6f moves
  `startX`.

### What 6c landed

Rooms 2 and 3 on the stage, the ruler behind every riser, the flash at
every apex, and the Line's tube as the interval gauge. The e2e climbs
all three rooms by hook, room 3's octave only by way of its ledge, and
holds his torso inside a 390x844 frame, 8 px clear, on every one of the
nine shelves he lands on. That answers M3 headless: the chase follows
the shelf he stands on, so it never has to hold the 2.4 m room, only
one shelf and the leap above it. The camera following `y`, listed here
in §8, landed in 6b.

Decided here, where the plan was silent:

- **A ruler per riser, zeroed on the shelf below it**, the one he leaps
  from, so the tick at a lip is that riser's ask. It is furniture, not
  a readout: one ruler re-zeroed on whatever shelf he stands on would
  jump under him at every landing. It is also what says "8ve" in room 3
  (§4): the first riser's ruler reads 8ve at the octave shelf's height,
  beside the ledge he leaps the fourth from.
- **It stands 0.25 m behind him, not at the shelf's back edge**, for
  parallax. From this eye a tick at the back edge, 0.6 m behind him,
  reads 6 cm low against his feet at a fifth's height, more than the
  catch; at 0.25 m it is under 3 cm. He hides its lower ticks while he
  waits at the riser and uncovers them as he leaps.
- **Ticks every semitone to the octave, and his spring a custard tick
  at 0.9 m**, with the ticks above it dim: D2's "the ruler shows it".
- **The flash names what was sung, not how high he went.** A leap
  capped at the spring still says what the voice did, so an octave from
  room 3's floor flashes 8ve at 0.9 m. It is the nearest interval and
  the cents off it (`P5 +12¢`), held 0.7 s and gone by 1.6 s: a short
  line over the ruler's ticks at the height reached, and the words just
  under it, left of the labels, which is below his feet at the apex.
- **The labels are 6.7 cm type on dark pills.** At 5 cm they came out
  8 px tall on a 390 px screen, and a label at a lip's height sat on the
  custard lip itself, so "P5" was lost at every fifth.
- **The gauge is `ShapeGauge` unchanged**, fed in semitones: the column
  is the voice above the reference over nine, the band the next shelf's
  ask from half a semitone under it to the ask, ticks every semitone,
  and no band on the top shelf. Its own toggle key,
  `beside-cue:games:shelf-gauge`. Its aria-label still reads "Where your
  voice sits in your range", which is wrong here; the file is the polish
  slice's.
- **Rooms follow one another in memory**, within a visit; the track that
  keeps them arrives in 6d.

What the code showed:

- **A leap's reach is the interval's, not the room's.** From a
  standstill a leap carries him to its riser from 0.43 m for a minor
  third, 0.48 m for a major third, 0.53 m for a fourth and 0.62 m for a
  fifth: a smaller leap is in the air for less. The carry leaves all of
  him past the lip, which on room 2's 1.0 m shelves is 0.47 m short of
  the next riser, so room 2's minor third, sung where the last leap left
  him, falls 4 cm short and hops. Walked to the riser first, it lands.
  The wall teaches it in one hop; 6f can shorten the gap if the phone
  says the hop reads as the game's fault.
- **A portrait screen is about 0.9 m wide at the ruler's depth**, with
  him in the middle of it. The first flash hung its words 0.9 m to the
  left of the riser, and a headless phone showed only the last glyph at
  the screen's edge; its line, run across the labels, struck through
  "P5". Nothing in this world can be put beside him in portrait, only
  above or below.

### What 6d landed

The grade, in the Line's units and through the Line's own functions:
first-try per riser, cents past the ask, `qualityFromCents` at
`LINE_SCORE`, the mean per room, and `medalFor` at the same thresholds,
with nothing gated on it (`sim/shelf-grade.ts`). The track
(`levels/shelf-track.ts`, `createTrack`) and its stats twin
(`levels/shelf-stats.ts`) keep each room's best. The room card and the
walk card read like the Line's, and the Games card counts the rooms
climbed as the Line's does, where it already stands in the list; the V1
order is a later pass.

Decided here, where the plan was silent:

- **A leap is aimed at a shelf when his mitt reaches its riser**, or
  when it lands him on the shelf, which needs the same. A hop in the
  open is aimed at nothing and is not graded. A fifth carries 0.62 m
  and room 1 starts him 1.34 m out, so grading every leap would mark
  the first fifth most players sing a failed first try for where he
  stood, not for what they sang.
- **"Past the shelf" is the landing leap's**, as §3.5 has it: "the grade
  records how far past". A flat miss costs the first try and nothing in
  cents; §7's overshoot only counts up.
- **A riser climbed with no graded leap is a first try**, the Line's
  `NO_STOPS`: nothing was missed. Only the dev hook can do it.
- **The rooms have names**, for §7's card, each for what is sung in it:
  The Fifth, Thirds and Fifths, The Octave. The room card is the name,
  a dash, and the Line's two units.

What the code showed:

- **First-try counts landings, so the octave room grades a one-leap
  octave as a first try.** An octave sung at room 3's first riser tops
  out at his spring and lands on the ledge (D5), 500¢ past the fifth it
  asked for. The room reads "125¢ past the shelf · 4 of 4 first time",
  75%, and a walk with it in is still gold, 92. The lesson is in the
  cents, not in the count. If 6f wants the count to carry it too, first
  try would have to mean "landed within a semitone", which D6 chose
  against.
