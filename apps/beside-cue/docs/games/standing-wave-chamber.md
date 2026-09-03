# Slice 2 — the Standing Wave Chamber

Status: plan, 2026-09-03. Continues `glass-3d.md` §2 and §9, which
designed this mechanic and listed it as the next slice. Slices 0, 0b, 1
and 1b are landed; this is the one that turns a scene into a game.

Three questions were open in `glass-3d.md` §11. maff answered them on
2026-09-03 and this plan is written to those answers:

- **Start with a few chambers**, test everything, then decide the count.
- **The player moves Merc.** Build the movement architecture properly;
  it will be reused, as the 2D platformer's already is.
- **The harmonic ladder is toggleable**, so it can be judged in play
  rather than in the abstract.

---

## 1. What a chamber is, and why the word

A **chamber** is one room with one fundamental. It is the unit of level
design here in the way a "screen" is in a platformer: you enter it, it
poses one spatial question, you answer it with your voice, you leave.

The room has a pitch. Sing that pitch, or any whole-number multiple of
it, and a **standing wave** forms along it — a pattern that does not
travel. It has **bellies**, where the air moves hardest, and **nodes**,
where it does not move at all. The positions are not a choice: for the
n-th mode, the room divides into n equal parts, and the nodes fall on the
divisions.

That is the whole mechanic:

- Glass at a **belly** shakes itself apart.
- The floor at a **node** is still, and safe to stand on.
- Which mode you sing decides where both are.

So a chamber is a puzzle with a musical answer: _put a belly on that
pane while keeping a node under my feet._ Sing the octave and the room
splits in two; sing the twelfth and it splits in three, and everything
moves.

It is the one mechanic on the list that is **about space**, which is why
it is the one that earns 3D at all.

---

## 2. Are we restricted by vocal range?

**No — because we choose the fundamental, and only the ratios are fixed.**

The theory constrains the _intervals_ between modes, never the absolute
pitch. Mode n of a chamber with fundamental f₀ is n·f₀, so:

| modes | ratio | interval      |
| ----- | ----- | ------------- |
| 1 → 2 | 2:1   | an octave     |
| 2 → 3 | 3:2   | a fifth       |
| 3 → 4 | 4:3   | a fourth      |
| 4 → 5 | 5:4   | a major third |
| 5 → 6 | 6:5   | a minor third |

Two things follow, and they are the actual design constraints:

**Pick f₀ so the playable modes land in the player's range.** The
RangeFinder already measures that range (`src/games/glass/range-finder.ts`,
reached from the games list). A chamber does not need a fixed frequency
in a config file — it needs a fixed _mode set_, and f₀ falls out of the
player's own range. A player with a comfortable band around A3–A4 gets a
chamber whose f₀ is two octaves below; the same room, transposed.

**Higher modes are closer together, so they fit a smaller range.** A
puzzle that needs modes 1 and 2 asks for an octave. One that needs modes
4, 5 and 6 asks for a major third and a minor third — about seven
semitones end to end, which is inside almost anyone's comfortable range.
So early chambers should live high on the ladder, where the steps are
small, and the ladder is a difficulty knob we get for free.

The unpleasant surprise to watch for: modes are close in _pitch_ up
there but the node pattern changes a lot between them, so a small sung
change moves the safe floor a long way. That is the good version of the
problem — the puzzle is legible and the singing is easy — but it needs
the ladder HUD (§5) or it reads as the room being twitchy.

**Open, and needs a real voice to settle:** whether the tolerance band
that works for one held note (`ring.tolSemis`, currently 1.5 semitones)
is too wide to tell mode 5 from mode 6, which are only 3.2 semitones
apart. If it is, the band has to narrow _in a chamber_ while staying
wide in the Hallway. Do not assume; measure it against a real singer
first.

---

## 3. Merc moves

The Hallway's traversal is scripted: `mercX` is advanced by the stage at
a fixed `HOVER_SPEED` and the voice is the only input. That was right for
a scene with one pane. It is wrong for a room where standing in the
correct place is the puzzle.

### The seam

Movement becomes its own module, with no knowledge of the renderer, the
voice, or Solid:

```
src/games/glass3d/sim/locomotion3d.ts
```

- `createLocomotion(cfg)` → a pure state machine, stepped by the same
  fixed-step loop the resonance runs in (`runLoop`, 1/120 s).
- Input is an **intent**, not a device: `{ move: -1..1, jump: boolean }`.
  A touch controller, a keyboard, and a scripted path all produce the
  same shape, which is what makes this reusable and testable.
- Output is a position, a velocity, a facing, and a grounded flag.

The 2D platformer already has this shape in
`src/games/glass/JourneyPrototype.tsx`; the point of a separate module is
that this one is not trapped inside a component.

### What it has to do

- Walk along the chamber's axis. One axis, not free 3D movement — the
  chamber is a corridor and the puzzle is _where along it_ you stand.
- Jump, with a fixed arc. Platforms are how a chamber gets vertical.
- **Fall when the floor under it is a belly.** This is the failure state,
  and it is what the `fall` clip has been waiting for — it is rigged and
  exported and nothing plays it (see `art/merc/make_merc.py`).
- Be steppable without a renderer, so the physics has tests rather than
  a person watching it.

### Controls

The app is played one-handed on a phone while singing, which rules out
most of the obvious answers. Proposal, to be tried rather than assumed:

- **Hold-to-walk**, a single thumb zone on the side you want to go.
- **Tap to jump.**
- Nothing that needs two hands, and nothing in the top third of the
  screen, which is where the coach and the wave gauge live.

The alternative worth prototyping beside it: **the voice moves him too**
— louder is faster — so the game stays hands-free. It is more original
and it fights the singing, which is the risk.

---

## 4. What a chamber is made of

```
src/games/glass3d/levels/chamber.ts
```

A chamber is data, not code:

```ts
interface Chamber {
  /** Which modes this room's geometry is built around. */
  readonly modes: readonly number[]
  /** Length in metres. Nodes fall at length * i / n for mode n. */
  readonly length: number
  /** Panes to break, as a position along the axis and a height. */
  readonly panes: readonly { at: number; height: number }[]
  /** Standing platforms, likewise. */
  readonly platforms: readonly { at: number; height: number }[]
  /** What has to be broken to open the exit. */
  readonly exit: { needs: 'all' | number }
}
```

The first three, as the test set:

1. **One mode, one pane.** Teaches that the room has a pitch and that a
   belly breaks glass. No platforms, no failure.
2. **Two modes, two panes.** The first pane is at a belly of mode n and a
   node of mode n+1; the second is the reverse. Teaches that changing
   the note moves the danger.
3. **Two modes, a pane and a gap.** The node you must stand on to break
   the pane is not the node you must stand on to cross. Teaches that the
   answer is a sequence, which is what makes it a level rather than a
   puzzle.

Ship those, play them, then decide the count. Anything beyond three is
content, and content is cheap once the three prove the verb.

---

## 5. The harmonic ladder HUD

A vertical ladder of the room's modes, with the mode you are singing
lit, and the node pattern each one would produce drawn on the floor.

**Toggleable**, per maff. Two settings, because they are different
questions:

- **Show the ladder** — which modes exist and which you are on. Without
  this the room's pitch is a secret, and a secret pitch is a guessing
  game.
- **Show the node pattern** — where the safe floor _would_ be for the
  mode you are singing. This is the one that might be too much help, and
  the one worth being able to turn off to find out.

Default both on. A player who wants the harder version can find it; a
player who cannot see why they fell will never find anything.

The wave gauge and coaching already exist and are shared
(`render/VoiceCoach.tsx`) — the ladder sits beside them, not instead of
them.

---

## 6. Order of work

Each step lands green and is playable before the next begins.

| #   | Step                                                                            | Done when                                                                          | Status |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| 2a  | `locomotion3d.ts` + tests. No renderer, no chamber — walk, jump, fall, grounded | The physics has tests and a debug page moves a box with it                         | done   |
| 2b  | Touch controller, wired to the Hallway, replacing the scripted walk             | Merc is driven by a thumb in a scene that already works, with nothing else changed | done   |
| 2c  | `chamber.ts` + the standing-wave maths, with tests on node positions per mode   | Node positions are pinned against hand-computed values                             | done   |
| 2d  | Chamber 1 renders: room, one pane, the node pattern on the floor                | Singing the mode breaks the pane                                                   | done   |
| 2e  | Falling: a belly under Merc plays the `fall` clip and restarts the chamber      | The clip finally has a caller                                                      | done   |
| 2f  | Chambers 2 and 3, the ladder HUD, the settings toggles                          | Three chambers playable end to end and scored                                      | done   |

Step 2b was deliberately early: it put the new movement in a scene that
already worked, so a control problem could not be confused with a
chamber problem.

### What landed, and where

| Thing                    | File                                                      |
| ------------------------ | --------------------------------------------------------- |
| Walking and jumping      | `src/games/glass3d/sim/locomotion3d.ts`                   |
| Thumb → intent           | `src/games/glass3d/input/pad-intent.ts`                   |
| The pad and jump button  | `src/games/glass3d/render/TouchControls.tsx`              |
| Standing-wave maths      | `src/games/glass3d/sim/chamber3d.ts`                      |
| The three rooms, as data | `src/games/glass3d/levels/chambers.ts`                    |
| The room, drawn          | `src/games/glass3d/render/Chamber3D.ts`                   |
| The room, played         | `src/games/glass3d/render/ChamberStage.tsx`               |
| The harmonic ladder      | `src/games/glass3d/render/ModeLadder.tsx`                 |
| A chamber's tighter band | `CHAMBER_CONFIG` in `src/games/glass3d/world3d-config.ts` |

### Decisions taken while building it

- **The tolerance question from §2 is answered in the config, not by
  hand.** A chamber uses `tolSemis: 0.7` against the Hallway's 1.5,
  because modes 4 and 5 are 3.86 semitones apart and two 1.5-wide bands
  would leave under a semitone of ground between them. It still wants a
  real voice to confirm, but the number is now written down and pinned.
- **The floor pattern is coloured by SAFETY, not by amplitude.** A
  smooth ramp is a picture of the wave; the floor has a threshold in it,
  and drawing that threshold is what makes the pattern something to
  stand on. It reads `floorThreshold` from the same room the rule does.
- **A ledge does not shake.** Only the ground itself can drop him, which
  is what lets a chamber have vertical space without every mode change
  being a fall.
- **The fall is a topple, not a plummet.** The `fall` clip animates
  going over — anticipation, topple, impact, settle — so he plays it
  where he stood. Dropping him through the floor threw the one asset the
  moment exists to show out of frame.
- **A fall restarts the position, not the room.** Panes already broken
  stay broken. Losing three of them to one misstep is a punishment for
  learning.
- **Failure is turned off in chamber 1 without a flag**, by setting its
  `floorThreshold` to 1: amplitude never exceeds 1, so the check simply
  passes everywhere.

### Transposing, and why it costs nothing

Settled on 2026-09-03, after the first play: the rooms were pitched
around G4 for everybody, which is where the Hallway's pane sits and
which is between alto and soprano. Every lower voice was being asked to
reach for notes it does not have.

`src/games/glass3d/voice-range.ts` is now the one place that answers
"where does this player's voice sit", in MIDI, from three sources in
order: an explicit choice (a voice preset, or the octave buttons in the
room), the range the RangeFinder measured, then G4 as a last resort.

The important part is that **none of this is a difficulty setting**. A
chamber is built out of ratios; transposing it does not move one node,
one belly, or one answer. A room outside your range is not a hard room,
it is a room you cannot play. The difficulty knob is the mode set, which
is untouched.

- **Voice presets** in the games list — bass, baritone, tenor, alto,
  soprano — one tap, no singing required. Standard tessitura centres.
- **Octave buttons in the room**, for the player who finds their pick
  still a little high or low, persisted for the next room.
- **The range finder still wins.** A voice that has been listened to
  beats a voice type picked off a list, so a fit clears the pick.

Pinned by test: every chamber is singable by every preset with more than
six semitones of slack.

### Teaching the room

`render/ChamberGuide.tsx`, four cards, shown once on the first chamber
anyone walks into and reachable afterwards from the HUD's `?` and from a
link on the gate.

The rule is one sentence of physics, and a player who has that sentence
reads the floor immediately; a player who does not sees coloured stripes
and a droplet that keeps falling over. Each card answers a question the
room cannot answer for itself in time: what am I singing at, what do the
colours mean, why did everything move, and how do I walk.

**The diagrams are drawn from `standingAmplitude`** — the same function
that colours the floor and decides whether Merc falls. A hand-drawn
standing wave would be a second source of truth about where the nodes
are, and the first thing to go stale.

The gate no longer explains the mechanic itself. It said the same thing
the guide had just said, which made the first screen of a game a wall of
text.

### Still open

- The chamber tolerance has not met a real singer. §2's question stands.
- No score is kept per chamber; the grade card is the average accuracy
  of that room's breaks and is not persisted.
- The exit is a position, not a door. Nothing marks it in the room.

---

## 7. Known issues and follow-ups

Carried in from device testing, so none of it is lost. None blocks this
slice.

| What                                                                                                                                                                                                                                                                                                              | Where it came from                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Art-direction and configurability pass on the break.** The shatter has been tuned twice by hand. It wants a proper pass: a tuning surface, and a decision about whether shard trajectories are art-directed rather than simulated                                                                               | maff, 2026-09-03, explicitly as a follow-up |
| **The onboarding intro does not play on native iOS.** Black, flickering between scenes, no sound. The shipped path is the v0.9 cinematic one, whose media is one mp4 and one m4a. Audio is `fetch` + `decodeAudioData`, so a byte-range problem would explain the video and not the silence — likely two failures | maff, builds 185 and 5564ef1                |
| **First load is sluggish.** Asset load plus renderer init, on a CI build with no production optimisation. Worth measuring before treating it as a bug                                                                                                                                                             | maff, 2026-09-03                            |
| **The Cabinet's framing has the same vertical-FOV problem the Hallway just had.** Not reported as broken, so not touched                                                                                                                                                                                          | found while fixing the Hallway              |
| **`fall` still has no articulation in the mitts** and reads as tipped rather than laid out                                                                                                                                                                                                                        | the polish pass, deliberately stopped short |

---

## 8. What this slice does not do

- No free 3D movement. One axis and a jump.
- No chamber editor. Chambers are checked-in data.
- No new sound design. The ring, the pump and the break already exist.
- No second mechanic. Slice 4 is where that lives.

---

## 9. Slice 3 — the chamber track

maff, 2026-09-03, after playing all three: the rooms should not be three
cards in the games list. They should be **one game with a path through
it**, entered once, walked in order, showing `1 of 3` as you go.

He is right, and the reason is already written down in §4: the rooms
teach in a fixed order — the room has a note, the note moves the danger,
the answer is a sequence. Three peers in a list invite playing them out
of order, which breaks the only teaching structure the slice has. A
track makes the order real instead of advisory.

### The rule the track must not break

`games/glass/score.ts` states it: _passing is a band, not a finish
line_, and _nothing is gated by any of it yet_. Together with maff's
standing "no streaks, ever", that settles the design:

- **Rooms unlock in order, on being finished — not on being finished
  well.** Getting through is the condition. The grade is a record.
- **A cleared room stays open.** Going back to room 1 to sing it better
  is a thing a player should be able to do without starting over.
- **Nothing is lost by stopping.** The track remembers where you were.

### Order of work

| #   | Step                                                                                        | Done when                                                       |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 3a  | `chamber-track.ts` — which rooms are cleared, where you are up to, persisted. Pure + tested | The state survives a reload and cannot name a room that is gone |
| 3b  | One card in the games list, replacing the three. Shows progress                             | "The Standing Wave · 2 of 3" and it enters where you left off   |
| 3c  | Room-to-room handover inside the stage: clear a room, a short beat, the next one builds     | The microphone is NOT re-prompted between rooms                 |
| 3d  | The exit becomes a thing you can see, not a coordinate                                      | You can tell where the room ends before you reach it            |
| 3e  | The end of the track: a card for the whole walk, and a way back into any cleared room       | Finishing says so, and replaying is one tap                     |
| 3f  | Two more rooms, now that adding one is cheap                                                | Five rooms, and the ladder climbed rather than restated         |

All six landed. What each one turned out to be:

- **3d** — the exit is a pool of light with a shaft standing in it, in
  the room's own visual language rather than a doorway with a frame
  (the Hallway already found out that dark posts in a void room read as
  floating monoliths). Closed it is cool and steady, open it is custard
  and breathing, and it opens the moment the last pane goes. The pool
  is stretched ALONG the room, not around the shaft: the chase camera
  shows about two units ahead of Merc, so a pool the width of the shaft
  would not appear until he was standing in it.
- **3e** — the end card lists the rooms with the best grade each, and
  every cleared room is a button back into it. Replaying returns to the
  card rather than walking the player forward down a path they have
  already finished. The track keeps the BEST grade per room, so a worse
  run costs nothing.
- **3f** — chambers 4 and 5, below.

### The two new rooms, and the bug they turned up

**Chamber 4, "The way out is up."** Modes 5 and 6 (3.16 semitones, a
shade tighter than chamber 3), hinged on the centre exactly as chamber 2
is but one rung higher: 0.5 is a belly of 5 and a node of 6. What is new
is that the exit stands on a ledge, so the room cannot be finished by
walking. Arrival now checks his HEIGHT as well as his position.

**Chamber 5, "Three notes, and the room does not say which order."**
Panes at 0.3, 0.625 and 0.75 want modes 5, 4 and 6 — neither up the
ladder nor down it, so the room has to be read rather than tried. Its
ledge sits over the centre, which is the perch for the second pane and
the belly of the note that opened the first: somewhere to stand while
still holding the wrong one.

Building chamber 4 turned up why the jump had never been needed. Two
faults, stacked:

1. `stepLocomotion` landed him on any surface above his feet, and
   `groundIn` answered with the highest slab over that x whatever his
   height. So walking into a ledge's shadow LIFTED him onto it — every
   platform in the game was a free step, and chamber 3's ledge was
   reached that way for the whole of slice 2.
2. That ledge was 0.62 high against a jump of 0.5. It could never have
   been jumped onto. The test beside it asserted `height > 0.5`, which
   is the opposite of the invariant that matters.

Fixed at both ends: `GroundSampler` now takes `fromY` and never offers a
surface above his feet, and every ledge is asserted to be inside the
jump with clearance to spare. Chamber 3's is now 0.42, and reachable for
the first time.

### What 3c actually costs, and why it is the interesting one

Each `ChamberStage` today owns a canvas, a renderer, a microphone lease
and a fixed `chamber` prop. A track has to move between rooms without
tearing all of that down — the microphone especially, because
re-prompting between rooms is the difference between a path and three
games in a trench coat.

Two ways, and the second is the one to take:

1. **Remount the stage per room.** Trivial to write; throws away the
   renderer and the mic every time. `micManager` lingers 2 s after the
   last consumer, so a fast handover would usually reuse the device —
   "usually" being the problem.
2. **One stage, rooms swapped inside it.** The renderer already builds
   its geometry from the chamber it was handed, so what is needed is a
   `load(chamber)` on `Chamber3D` that rebuilds panes, platforms and the
   floor pattern while keeping the renderer, the environment, Merc and
   the lease. The stage keeps the driver across the swap.

The second also gives the between-rooms beat somewhere to live: Merc
walks out of one room and into the next without a black frame.

### The shape above the track: circles

maff, same conversation: the games list should eventually be a map of
**circles**, each circle one mechanic with its own run of levels, walked
easy to hard or picked freely — the Plants vs Zombies shape.

That is not a new direction. It is the locked decision **one new
mechanic per song/world** given a picture: a circle IS a world, and the
track is what a world contains. Recording it here so the track is built
to sit inside one rather than being retrofitted into one later:

- A track is **named, ordered and self-contained** — it owns its rooms,
  its progress and its end card, and knows nothing about what is beside
  it. That is what makes a second circle cheap.
- The games list stays a flat list until there are **two** circles. A
  map with one circle on it is a worse list.
- Which circles are open, and whether they are ordered or free, is a
  question for when there is something to order. The Standing Wave is
  the first; the Hallway and the Cabinet are a teaching pair that may
  become the one before it.

So: build the inside of the circle now, draw the map when there are two.

### Also worth doing, in the same pass

- **A grade for the walk, not just the room.** The chamber already
  averages the accuracy of its breaks; the track should keep them per
  room and say something honest at the end, in real units.
- **Chamber 3's ledge is decoration.** Locomotion has had a jump since
  2a and no room requires it. One of the two new rooms should.
  _Done, and worse than described: the ledge could not be jumped onto at
  all, and was only ever stood on by a collision bug. See above._
