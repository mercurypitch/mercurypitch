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
