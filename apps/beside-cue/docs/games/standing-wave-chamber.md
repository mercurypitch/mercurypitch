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
