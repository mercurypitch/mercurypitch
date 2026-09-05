# Slice 4 — the Sorting Line

Status: plan, 2026-09-04. Continues `standing-wave-chamber.md` §9, which
built the inside of the first circle and said the map gets drawn when
there are two. This is the second circle.

Six worlds were proposed and each was read against the code on three
axes: **is it a new verb**, **can a stranger play it quietly**, and **can
it be built by late September**. The scores are in §1. This plan picks
one, grafts the best of the others into it, and specifies the first two
rooms in enough detail that nobody has to design again before building.

Locked decisions carried in unchanged, because everything below is
written to them: one new mechanic per world; no streaks, ever; real-unit
scores and a grade card; never mandate loudness; comedic, never stern;
passing is a band, not a finish line.

---

## 1. Which world, and why it beat the others

| World            | New verb | Playable quietly | Buildable | Total |
| ---------------- | -------- | ---------------- | --------- | ----- |
| The Sorting Line | 8        | 8                | 8         | 24    |
| The Top Shelf    | 8        | 8                | 7         | 23    |
| The Span         | 7        | 8                | 8         | 23    |
| The Blackout     | 7        | 8                | 8         | 23    |
| The Beat Clock   | 8        | 5                | 8         | 21    |
| The Pump House   | 7        | 2                | 8         | 17    |

**The Sorting Line wins, and the margin is one point, so this is a
recommendation and not a verdict.** Three worlds sit at 23. Under the
rule that a top two inside two points goes to maff, the choice is
genuinely open and §1.3 says what the alternative costs.

### 1.1 Why the Sorting Line

**Your voice is not a note. It is Merc's body.** Where you sit in your
own range decides his shape: low is a wide flat puddle, high is a narrow
tall thread, and the volume of mercury is conserved between them, so the
two ends are physical opposites rather than two settings of one dial.

It won on the only property none of the others has: **it is the only
proposal with no axis below 8.** Every other world is carrying a seven
or worse into a September deadline, and a seven is where a slice loses a
week. That is the whole argument, and it is worth stating plainly rather
than dressing it up as taste.

Three things sit under it.

**It is the only world a person who cannot match pitch can finish.** No
gate anywhere names a note. There is no target pitch, no `ResonanceState`,
no charge, and the vibrato detector is not in the loop. `t` is a position
in the player's OWN measured range, so two players with nothing in
common vocally sing completely different pitches through the same room
and are both right. Nothing else in this app is true of.

**It asks the detector for the one thing the detector is genuinely
excellent at.** Not a target, not a rate, not a derivative — a slow,
relative, smoothed position. Rooms 1 and 2 need three to six semitones of
band, which is twenty times the pipeline's own jitter and wider than the
shipping Cabinet's ±1.5 semitones.

**It has the best thirty seconds in the set.** Hum low, a chrome droplet
flattens into a pancake, and it slurps under a door with a wet slap. No
sentence of explanation is needed to film that, which the Standing Wave
cannot say about any of its five rooms.

### 1.2 Which axis the runner-up lost on

**The Top Shelf** — sing two notes, and the gap between them is how high
Merc jumps — is the runner-up, because it ties the Sorting Line on the
axis that matters most here (a new verb: 8) and loses only on
buildability.

It lost on **buildability**, and not on a judgement call. The geometry
does not close. `createMerc` stands him 0.55 m tall by default; at the
proposal's 0.06 m per semitone, its second room stacks shelves five
semitones apart, which is 0.30 m — **the shelves are closer together
than Merc is tall**, and its stated tolerance model (overshoot and you
splat on the underside of the shelf above) cannot exist in a gap he
does not fit in. Every fix moves something else: double the metres per
semitone and the room becomes a 1.5 m shaft, which walks straight into
the vertical-FOV bug that has now shipped twice in this codebase; widen
the spacing and the required leaps stop fitting inside every voice
preset. It also needs the only genuinely new physics in the set — a head
test and an upward ground sampler in `locomotion3d.ts`, the module all
three shipped worlds stand on — before its second room can exist at all.

The Span and the Blackout both lost on **new verb**, for the same
underlying reason: each has a room 1 that a player who has met the
Cabinet would describe in the Cabinet's own words. The Span's live
"reach line" ruler quietly converts interval production into visual
tracking, so its rooms can be completed without ever producing an
interval. The Blackout's room 1 is the Cabinet with the lights off —
sing near glass, glass breaks, same shatter timeline, same material —
and its simulation is `resonance3d.ts` with the vibrato branch deleted.
Both have one excellent idea, and §6 takes both ideas without taking
either world.

### 1.3 What maff is actually choosing between

If the Sorting Line's silhouette reads badly on a phone — see §13's step
4a, which is one evening and answers exactly this — the Top Shelf is the
world to fall back to, and the fallback is cheap only if 4a runs first.

If you would rather have the Top Shelf on its merits, the price is a
device pass on its geometry before any of its numbers mean anything,
plus locomotion work on the shared module. That is the trade: the
Sorting Line's risk is aesthetic and answerable in an evening; the Top
Shelf's is physical and answerable only by re-deriving its level data.

---

## 2. What the Sorting Line is

One rule, one number.

```
t = clamp01((midi - lo) / (hi - lo))
```

`lo` and `hi` come from `readMeasuredRange()` (or a voice preset),
trimmed a semitone at each end so the extremes are reachable without
straining. There is no target note anywhere in this world and no note
name on screen.

`t` is his silhouette, and the volume of mercury is conserved:

| t    | what he is | height | width  |
| ---- | ---------- | ------ | ------ |
| 0.00 | a puddle   | 0.32 m | 0.47 m |
| 0.37 | a drop     | 0.55 m | 0.36 m |
| 1.00 | a thread   | 0.94 m | 0.28 m |

Height is linear in `t` (`h = 0.32 + 0.62t`); width falls out of
`w = sqrt(0.0713 / h)`, which holds `w²h` constant. The drop -- the Merc
who already ships -- lies on the sweep at `t ≈ 0.37`, which is what
makes rest a shape rather than a null state. It sat at 0.5 in the first
draft, with the puddle at 0.16 m; §14.5 says why the flat end came up.

**The room is inert.** Every plate, gap and slot is dumb geometry that
would sit there unchanged if the microphone never opened. The voice
touches Merc and nothing else — which is the exact inversion of a
chamber, where the voice changes the room and Merc is a cursor walking
through the consequences.

**Two opposed affordances from one scalar, and this is the mechanic.**
Because `w²h` is conserved, clearance and support move in opposite
directions: flat gets under low things and spans wide gaps; tall fits
narrow slots and falls through a grate. So the shape that carries you
across is the shape that cannot get you through, and a level is a
sequence of trades with somewhere safe to make them. That is a level
generator, not a puzzle — and it is the thing neither shipped verb can
state.

**Silence holds the shape.** Stopping is not a reset. The shape relaxes
toward the drop with a 6-second time constant, and unvoiced and
low-confidence frames hold too. This is the decision that makes the
world playable one-handed: you sing in short bursts and walk in silence,
instead of sustaining a note while your thumb is busy.

**The spring.** The shape follows the voice through a critically damped
spring at ω = 9 rad/s, settling in about 0.45 s. Move slowly and he
morphs; the spring is also the smoother, which is what stops a jittery
f0 reading as Merc convulsing.

The physics it teaches, the way the chamber teaches the harmonic series,
is **pressure and surface tension**: same mass, different footprint.
Spread out to be held up, bead up to pass through.

### 2.1 Bands are stated in semitones, and the room re-scales

The chamber doc's §2 makes a point of this world's mirror image. **A
chamber is built out of ratios, so transposing it does not move one
node.** The Sorting Line is built out of a player's own span, so it is
not free in pitch — a fixed slot height is a different number of
semitones for a wide voice and a narrow one, and stating the ask in
metres gives the narrowest voices the hardest rooms, which is backwards.

So: **the level fixes the ask in semitones, and the room's dimensions
are derived per player.** The Standing Wave transposes; the Sorting Line
re-scales. Same principle, different lever.

Each gate carries both a `t` band and a semitone band, and takes the
more generous of the two, clamped so the resting drop never fits:

```ts
interface Gate {
  /** 'flat' or 'tall' — which end of the range this gate wants. */
  readonly end: 'flat' | 'tall'
  /** The t band, as a fraction of the range. */
  readonly tLimit: number
  /** The same ask in semitones from that end. The wider wins. */
  readonly semis: number
  /** Past this, the resting drop fits and the gate asks nothing. */
  readonly clamp: number
}
```

Worked, for room 1's letterbox (`tLimit 0.23`, `semis 4.0`,
`clamp 0.42`):

| measured span | 4.0 semitones is | band used | slot height |
| ------------- | ---------------- | --------- | ----------- |
| 17 semitones  | t ≤ 0.235        | 0.235     | 0.343 m     |
| 12 semitones  | t ≤ 0.333        | 0.333     | 0.420 m     |
| 10 semitones  | t ≤ 0.400        | 0.400     | 0.472 m     |

Pinned by test, the way the chambers pin six semitones of slack per
preset: **every gate in every room admits at least 3.5 semitones of band
for every voice preset, and no gate is passable by the resting drop.**

---

## 3. Why this is not a verb that already ships

**Against the ring-and-waver (the Cabinet, the Hallway).** That verb is
a TARGET and a SUSTAIN: `stepResonance` needs a `midi` target, a charge
rising to `holdCap: 0.6`, and then vibrato, and a steady in-tune note
stops dead without it. This world deletes all three. No target pitch,
nothing to sustain, no charge, and the shape persists through silence by
design. `resonance3d.ts` and `vibrato.ts` would not be imported.

**Against the Standing Wave.** There the voice changes the ROOM —
`standingAmplitude(x01, mode)` is a property of the room, sampled under
his feet — and the answer is a discrete choice among whole-number
multiples read off a floor pattern. Here the voice cannot touch the
room, the signal is continuous rather than integer-valued, `nearestMode`
has no analogue, and the harmonic series never appears. It is the exact
inversion of circle one, which is why it belongs beside it rather than
after it.

**Against the shipped 2D flow mode, which is the real overlap and needs
the real answer.** `journey-config.ts` already documents "voice =
position", pitch mapped into a window with platforms as bands. So
"continuous pitch → a continuous avatar cursor → be in the band" exists
in this app already. Three things separate this world, and only one of
them is a mechanic change:

1. No gate names a pitch, and the answer is read off a silhouette.
2. The map is to the player's measured range, so nothing is memorisable.
3. **One scalar drives two opposed affordances.** Clearance and footprint
   move in opposite directions, so a room can pose a question no
   pitch-cursor can be asked: the shape that got you here cannot get you
   out, and there is exactly one safe place to swap.

Only the third is structural, and §8 is honest about what follows from
that.

---

## 4. Room 1 — "The Letterbox"

Five metres. No hazard. Cannot be lost.

**On screen.** The void and the floor the chambers already use, lit by
the same procedural rig, chase camera two units ahead. Merc, a drop, at
x = 0.2 in his `listen` idle. At x = 1.5, a glass plate spanning floor to
ceiling with a horizontal slot along the bottom, the slot's height
derived from the band (§2.1) — 0.34 m for a typical measured span. At
x = 4.7, the exit: the pool of light with the shaft in it, closed and
cool, exactly as slice 3d built it and stretched along the room so the
chase camera reveals it in time.

Beside the plate, on the near side, stands a **ghost of him**: a
translucent Merc-shaped mesh scaled to `silhouetteFor(t)` at the band's
centre — a wide, flat, faintly glowing pancake, at his own scale,
standing where he will be standing. That is the whole instruction. There
is no text on this screen.

**The shape gauge** is on screen from the start: a vertical column on the
left, the range top to bottom, a dot where the voice is, the required
band lit. It is not what teaches the room; the ghost is. The gauge is
what stops the later rooms being twitchy, and it follows `ModeLadder`'s
shape and its default-on, toggleable, persisted pattern.

**The jump button is hidden.** There is no vertical geometry in this
room, and a button that does nothing is a button the player believes
they are failing to use.

**What happens, in order, with nobody explaining anything:**

1. He walks into the plate and stops at the standoff, and bumps. Glass.
   Wall. He looks at it.
2. The player makes a sound. Any sound. He deforms with it, visibly and
   in proportion — that is the entire teach, and it lands in under a
   second because it is happening to the character in the middle of the
   frame rather than to a pattern on the floor behind him.
3. A high hum draws him up thin; the pancake ghost does not match, and
   he is now further from it than he was.
4. The player goes the other way and he spreads. As his silhouette
   crosses into the band the slot admits, the slot's outline lights
   custard — the app's existing "this is open now" colour, borrowed from
   the exit — and the ghost fades out, because it has been answered.
5. He walks. The slot swallows a pancake with a wet slap. On the far side
   he wobbles back toward a drop as the relax takes over, with the `wide`
   shape key still on his face for a beat too long, which is the joke.
6. The exit opens. That is room one.

**Why it teaches without text, specifically.** The ghost is drawn by the
same function that decides whether he fits, so it cannot lie — the same
discipline as `ChamberGuide`'s diagrams being drawn from
`standingAmplitude`. And the band is enormous: at least four semitones
wide for every voice, the bottom quarter of the range. You cannot miss
it by trying. A player who hums one low note, once, is through.

**Numbers.**

| Thing                          | Value                                  |
| ------------------------------ | -------------------------------------- |
| Room length                    | 5.0 m                                  |
| Merc starts at                 | 0.2                                    |
| Plate at                       | 1.5                                    |
| Slot band                      | `tLimit 0.23`, `semis 4.0`, clamp 0.42 |
| Slot height (17-semitone span) | 0.343 m                                |
| Exit at                        | 4.7                                    |
| Relax time constant            | 6.0 s toward `t = 0.5`                 |
| Relax during an f0 gap         | half rate (12.0 s)                     |
| Spring                         | critically damped, ω = 9 rad/s         |
| Ghost                          | on, at the band centre                 |
| Failure                        | none, by construction                  |

**Acceptance condition, and it is a test somebody runs.** Room 1 plays
correctly with its `teaches` line hidden. Not "we hope it teaches
itself" — the string is removed and a person who has never seen the
world finishes it. Borrowed from the Pump House proposal, which is the
only one that thought to make that a check rather than a wish.

---

## 5. Room 2 — "The Screen"

Seven metres. The first way to lose. **And it is the room the world
exists for, moved up from third place on purpose.**

The original ordering put two more band-hitting rooms before the trade,
which is exactly the order that earns "isn't this the pitch platformer
again". So room 2 is the inversion, and it teaches the high end of the
range not as a separate lesson but because the trade demands it. One
sentence: **the shape that carries you is not the shape that fits.**

**On screen.** Solid floor to x = 1.6. Then two metres of **mesh floor**
— the existing 72-strip instanced floor with alternating gaps — over a
reject chute with a glow under it. At x = 3.6 a **solid island**, one
metre long. At x = 4.9 a **vertical slot**, 0.33 m wide, in a plate that
spans the corridor. Exit at 6.6.

Two ghosts, one at each end of the trade: a pancake standing on the near
lip of the mesh, and a thread standing on the island. Both drawn from
`silhouetteFor` at their gate's band centre. That is the level design
and the tutorial in the same two objects.

**What the voice does.** Sing low and stay low across the mesh — a wide
footprint spans the gaps and holds. Stop singing on the island, or sing
anything, and change: sing high and he draws in and up until he is
narrow enough for the slot. There is exactly one place to swap, and it
is the only solid ground between the two demands.

**The relax is the room's clock, and the geometry is derived from it.**
From `t = 0.20`, silence relaxes past the mesh's support threshold of
`t = 0.313` after 2.84 seconds — 3.26 m at `walkSpeed: 1.15`. The mesh is
2.0 m, so it crosses in one breath with 1.26 m of slack. A later room may
spend that slack; room 2 must not, because it is the room where falling
is being introduced and the fall must read as "wrong shape", never as
"you ran out of air".

From the island at `t = 0.75`, the same relax reaches the slot's
threshold of `t = 0.634` after 3.74 s — 4.3 m of walking, against 1.3 m
to the slot. Also one breath, also with slack.

**Failure.** He sags, the mesh lets go, and he pours through. The `fall`
clip plays during the sag, before the drop, so the one asset the moment
exists to show is on screen for it — the chamber's decision (the topple,
not the plummet) held to in a room where he genuinely goes through a
grate. A tube pumps him back to x = 1.4, the start of the stretch. **Gates
already passed stay passed**, exactly as broken panes do, because losing
your progress to one misstep is a punishment for learning.

**Numbers.**

| Thing                         | Value                                   |
| ----------------------------- | --------------------------------------- |
| Room length                   | 7.0 m                                   |
| Merc starts at                | 0.2                                     |
| Mesh floor                    | 1.6 → 3.6 (2.0 m)                       |
| Mesh gap                      | derived from the support band           |
| Support band                  | `tLimit 0.313`, `semis 5.0`, clamp 0.42 |
| Gap width (17-semitone span)  | 0.42 m                                  |
| Island                        | 3.6 → 4.6, solid                        |
| Slot at                       | 4.9                                     |
| Slot band                     | `tLimit 0.634`, `semis 5.0`, clamp 0.55 |
| Slot width (17-semitone span) | 0.33 m                                  |
| Exit at                       | 6.6                                     |
| Return after a drop           | x = 1.4                                 |
| Ghosts                        | two, on, at each band's centre          |

**What room 2 proves, and what it does not.** It proves the trade — the
opposition of clearance and support, which is the world's own idea. It
does NOT prove that the mechanic is more than a one-dimensional cursor,
because both of its gates are still `t` intervals. §8 is about that, and
§13's step 4d makes it a falsification check rather than a hope.

---

## 6. The grafts, and where each came from

Four ideas taken from proposals that lost. Each is named with its
source, because a graft with no provenance is a design instinct wearing
a citation.

**From The Blackout — a dropout is not a decision.** The relax runs at
half rate during an f0 gap or a low-confidence frame, rather than at
full rate or not at all. And its stronger half: **any voiced frame at
all does something visible**, so singing the wrong note can never look
identical to a dead microphone — which is the one complaint that came
back from the first real device test of slice 1. Here that is the gauge's
dot: greyed when the mic loses you, never hidden. All three of the
Blackout's judges named this cluster as the thing to steal, and two of
the Sorting Line's named its sibling ("silence holds the state") as the
Sorting Line's own best idea. They are the same idea, and this is the
world that gets to hold both halves.

**From The Span — the reference comes from the voice in the room.** The
Sorting Line's range self-widening was scheduled as a silent guard. The
Span's anchor makes it a designed moment instead: **the world opens by
taking the range from the player rather than trusting a stored preset.**
A baritone on a soprano preset otherwise gets a world whose top half
does not exist, and room 2 is then unfinishable rather than merely hard.
With one correction the Span's own judge supplied: an outlier must be
within an octave of the stored range before it widens it, or a single
stable octave error permanently doubles the control surface.

**From The Top Shelf — tolerance is geometry, never a constant.** There
is no `slotTolSemis` anywhere in this world. A gate's band IS the
furniture, difficulty is level data, and the arithmetic is checkable by
a test the way `|sin(nπx)|` already is in `chambers.ts`. This is the law
that lets §2.1's band table exist at all. Its second idea — the reach
line, a world-space preview of what your voice is about to do — the
Sorting Line already has as the ghost; what The Top Shelf adds is the
**taper**: full ghosts in rooms 1 and 2, fading in later rooms, so the
world does not quietly become a servo the player watches instead of a
room they read.

**From The Pump House — the `teaches` line is hidden for the test.** §4's
acceptance condition. It turns "the first room teaches itself with no
text" from a bar into a check.

Not grafted, and worth saying why: **The Beat Clock's error amplifier**
is the best single idea in the losing set — turn a sub-perceptual pitch
error into a countable rate — and it has no home here, because this
world has no precision demand to amplify. It belongs in a proposal for
the Cabinet's coaching layer, not in this slice.

---

## 7. What is reused, and what is genuinely new

### 7.1 Off the shelf, by module

- **`packages/pitch-engine`** — `createF0Stream`, the 5-frame median and
  the 130 ms gap bridge in `f0-frames.ts`, `micManager`. Consumed through
  `createSingDriver`, exactly as `ChamberStage` does. The tap driver
  still plugs into the same seam.
- **`src/games/glass3d/voice-range.ts` + `src/games/glass/range-finder.ts`**
  — `readMeasuredRange()` and `VOICE_PRESETS` become the whole control
  surface here rather than a transposition. The RangeFinder finally has a
  game that needs it.
- **`src/games/glass3d/sim/locomotion3d.ts`** — untouched, and this is
  the good surprise. `GroundSampler` is `(x, fromY) => number | null`,
  `stepLocomotion` already handles a null floor, and `groundIn` is a
  closure over the room. The Sorting Line's sampler is a closure over the
  live silhouette and returns null where a thread falls through a grate.
  **The module needs no change, for the same reason it has never heard of
  a mode.**
- **`src/games/glass3d/input/pad-intent.ts`** and
  **`render/TouchControls.tsx`** — the walk strip unchanged; the jump
  button hidden in rooms with no vertical geometry.
- **`src/games/glass3d/runtime/loop.ts`** — the fixed 1/120 s step. The
  spring and the relax are stepped in it beside locomotion.
- **`src/games/glass3d/render/Renderer3D.ts`**, **`render/environment.ts`**
  — the renderer, the WebGPU/WebGL seam, the 1024×512 procedural
  environment, `RIG`, `buildRadialFalloff`, `createBackdrop` sized to the
  longest room.
- **`src/games/glass3d/render/Chamber3D.ts`** — as the pattern, not as a
  parent: panes are `BoxGeometry` with a cloned `MeshPhysicalMaterial`,
  the floor is a 72-strip `InstancedMesh`, the exit is a circle and a
  plane. A slotted plate is four of those slabs. **No Blender, no export,
  no new `.glb`.**
- **`render/merc.ts`** and the five clips — `listen`, `move`, `fall`,
  `celebrate` as-is; `sing` is the mouth while voiced. The `fall` clip
  gets more callers in this world than in any other.
- **`src/games/glass/score.ts`** — `qualityFromCents`, `readBest` /
  `writeBest`, the pass band and the gold/silver/bronze chip.
- **`src/games/glass3d/levels/chamber-track.ts`** — 182 pure, tested
  lines. Generalised, not copied (below).
- **`src/games/glass3d/dev/dials.ts` + `DevDials.tsx`** — every number in
  §4 and §5 wants dragging, and the panel is already a lazy DEV-only
  chunk.
- **`render/ModeLadder.tsx`** as the shape for the gauge;
  **`ChamberGuide.tsx`** as the shape for the cards, if playtest says
  room 1 needs a backstop. It should not.
- **The synthetic-voice E2E harness** — an oscillator into a fresh
  `MediaStreamDestination` per call. Its natural gesture is a frequency
  ramp, which is literally this game's input, so the whole track is
  walkable in Playwright without a microphone. This is the cheapest test
  story of any world proposed.
- **`world3d-config.ts`** — a `LINE_CONFIG` sibling of `CHAMBER_CONFIG`
  holding the tension branch; `resolveConfig` gains one branch.

### 7.2 Genuinely new, in the order it lands

1. **`sim/tension3d.ts`** — pure, tested like `chamber3d.ts`. Pitch → `t`
   against a measured range; the critically damped spring; `silhouetteFor(t)`
   with `w²h` conserved; `fitsSlot`, `supportedBy`; the relax with its
   half-rate gap branch; the slide-and-overshoot measurement §9 grades
   on. Pinned tests: a slot admits exactly the band the ghost is drawn
   from; a low-confidence frame holds rather than relaxing; the relax at
   6 s leaves a 2.0 m mesh crossable in one breath with the stated slack.
   **This is the slice's core and it is the small part.**
2. **Posing Merc from a signal.** `merc.ts` gains `setShape(width, height)`.
   The trap is NOT the mixer: `build_animations` keys bones inside the
   armature, and `createMerc` sets `scene.scale.setScalar(s)` on the root
   Object3D, which no clip touches — so `root.scale.set(w, h, w)` is three
   lines the mixer never sees. **The line that bites is the next one:**
   `scene.position.y = -bounds.min.y * s + height * 0.1` is computed once
   from the load-time height, so a non-uniform scale sinks him into the
   floor at `t = 0` and floats him at `t = 1`, silently. Re-derive the
   hover offset on every shape change.
3. **`render/Line3D.ts`** — the room builder, and the biggest unlisted
   item in the original proposal. `Chamber3D.ts` is 631 lines and every
   one of them knows about panes, modes and the wave field; a sibling that
   knows about plates, gaps and ghosts is **400–500 lines**, not an hour.
   Budget it.
4. **The ghost.** A translucent Merc-shaped mesh scaled from
   `silhouetteFor` at the band's centre. A cheap capsule reads fine and
   does not cost a second skinned draw.
5. **`render/ShapeGauge.tsx`** — `ModeLadder`'s shape: a vertical scale,
   live position, a lit band, `bottom: %` positioning, toggleable,
   localStorage default-on, and the dot **greyed rather than hidden**
   when the mic loses you.
6. **Range calibration at world entry**, with the octave-continuity clamp
   from §6.
7. **The track, generalised.** `chamber-track.ts` imports `CHAMBERS` at
   module scope and hardcodes `KEY = 'beside-cue:games:chamber-track'`.
   It becomes a track over a room list with its own storage key, and both
   circles sit on it. Pure and already tested, so this is a
   parameterisation rather than a rewrite.
8. **The stage — and it is a fork, not a refactor.** See §10.

---

## 8. The axis the winner scored worst on, and what has to be true

All three axes returned 8, so there is no low score to confess. There is
still a weakest argument, and it is on **whether this is a new verb**.

The finding, stated as the reviewer stated it: **distinctness is
concentrated in a minority of the rooms.** The mapping rooms — hum into a
band, walk through — are, in the hand, "put the cursor in the band". You
could author them against pitch-as-height and lose nothing but flavour,
and this app has already shipped pitch-as-height in 2D. Only the rooms
that need the shape to be a SHAPE — where clearance and support disagree
— are undescribable in the older verb. On top of that, the
moment-to-moment grammar is inherited wholesale from a chamber: walk,
bump the plate, adjust the voice, the thing turns custard, walk through.
That is deliberate and cheap, and it is also the layer a thirty-second
viewer actually perceives.

**What would have to be true for that not to sink it:**

1. **The trade has to be room 2, not room 3.** Done, in §5. As originally
   ordered, a playtester met three band-hitting rooms before meeting the
   mechanic's actual idea.
2. **At least one gate in the world must be unpassable by a
   one-dimensional pitch cursor.** Every gate as specified reduces
   `fitsSlot` to a `t` interval. There has to be an obstacle that
   genuinely needs both numbers — a **wedge slot admitting a band of
   ASPECT RATIOS** rather than a band of `t`, or a two-part gap where
   clearance and support disagree so only a specific intermediate shape
   passes. This lands in step 4e.
3. **It has to be falsifiable, and it has to be checked early.** At the
   end of step 4d, the question is asked out loud: does any gate in this
   world distinguish `silhouetteFor(t)` from `t` itself? If the honest
   answer after 4e is still no, **the world is a slider with a very good
   avatar**, and it is better to find that out at room 3 than at
   submission. The Top Shelf is then the fallback, which is the other
   half of why §13 starts with an evening rather than a refactor.
4. **Difficulty must never be "narrow the band".** Narrowing bands is the
   pitch-cursor genre's most generic knob and would make the world a
   cents drill in costume, which the locked decisions forbid outright.
   The knob is the number of trades and the distance between safe places
   to make them.

---

## 9. The grade, in real units

Two units, no points, and the vocal one leads.

Per gate, the run records **the slide, not the pitch**. A slide starts
when the voice leaves the last band by more than 0.5 semitones and ends
when it stops — velocity under 0.5 semitones per second for 150 ms.
**Overshoot** is how far past the nearest edge of the required band that
stop landed, in cents, and it is 0 when the stop landed inside.
**First-try** means the first stop landed inside.

Per-gate quality is `clamp01(1 - overshootCents / bandCents)`, which is
`qualityFromCents` with the gate's own band as the zero point — so the
existing function is reused with a per-gate `ScoreConfig` and no new
arithmetic.

The room card:

```
The Screen — 62¢ past the gate · 2 of 3 first time · dropped once
```

The walk card (step 4f):

```
The Sorting Line, walked.
84¢ past the gate on average · 11 of 14 gates first time
```

and then the same gold/silver/bronze chip the rest of the app uses, at
the same thresholds, with nothing anywhere gated on it.

**Why these two.** Cents of overshoot is the unit the codebase already
speaks, it stays comparable across sessions and months, and it measures
the thing this world actually trains — where a glide stops, which is a
siren with a target, which is what every voice teacher asks for and no
game measures. First-try count is per-run and per-room, has the
precedent of listen mode's "N of M first-try", is not a streak, and
carries nothing between sessions; the track keeps the best, so a bad run
cannot take anything away.

**One correction the proposal got wrong and this plan does not.** The
Sorting Line's grade is **not** comparable with a chamber's. A chamber
does not use `score.ts` at all — `ChamberStage.tsx` imports `accuracy`
from `sim/resonance3d.ts`, which divides accumulated cents error against
`cfg.ring.tolSemis`. `computeRunScore` also switches on a `PlayMode` and
takes a `ScoreConfig` that lives in the 2D `journey-config.ts` with no
counterpart in `world3d-config.ts`. So this world carries its own cents
accumulator into its own `ScoreConfig`, and the number sits beside a
chamber grade rather than being compared to it. Half a day, and it lands
on the card that ends the thirty-second video, so it is worth knowing
now.

What the card deliberately does not say: nothing "in tune", because
there is no tune here; and no number that goes up merely for continuing.

---

## 10. Decisions taken while writing this

- **The trade is room 2, not room 3** — this plan, on the review's
  finding that the world's identity was back-loaded into a room the demo
  would not reach.
- **The stage is FORKED, not refactored** — this plan, against the
  original proposal's own ordering. Lifting the world-agnostic half out
  of a 1,094-line `ChamberStage.tsx` is correct engineering and the wrong
  September call: it is a refactor of the only working 3D game, on the
  file that owns the microphone lease, before anything new is playable,
  and the proposal itself named it as the likeliest day-eater. This repo
  already has two of everything — `Hallway3D`/`HallwayStage` beside
  `Chamber3D`/`ChamberStage` — so a third fork is a known quantity. The
  lift is an October job with two working worlds as the regression suite.
  **The fork must carry slice 3's thirteen review fixes**, which are not
  optional and are not re-derivable cheaply: the camera reset on `load()`,
  the jump buffer decaying through the `cleared` and `falling` branches,
  the grounded-checked exit, the `InstancedMesh` bounding sphere that
  `setMatrixAt` does not invalidate, the backdrop sized to the longest
  room, `begin()` after unmount, and the mic-switch double driver.
- **`chamber-track.ts` IS generalised in this slice** — this plan. It is
  pure, 182 lines, and already tested; the alternative is two copies of
  the module whose rules must never drift.
- **The circles map is not in this slice** — carried from
  `standing-wave-chamber.md` §9 ("draw the map when there are two"). Two
  circles is when it becomes due, and due is not the same as free. It is
  a new screen and it gets its own slice; until then, a second card in
  `GamesScreen.tsx`.
- **The detector is YIN, not SwiftF0** — found while checking this plan
  against the code, and it corrects three docs at once.
  `pitch-f0-stream.ts` says so in its own header ("Deliberately uses only
  the 'yin' algorithm — no SwiftF0/ONNX"), and `f0-detector.worker.ts`
  constructs `algorithm: 'yin'`. The header of `drivers/sing.ts` and the
  architecture note in `mini-games.md` both still say SwiftF0 and are
  stale. It does not change this design — the mapping is friendly to
  either — but it changes which failure modes to plan for, and any future
  world reasoning about octave errors should reason about YIN's.
- **A fall restarts the position, not the room** — maff, 2026-09-03,
  carried in from slice 2 and not reopened.
- **A room opens on being finished, not on being finished well; a cleared
  room stays open; stopping costs nothing** — maff, standing, and
  `chamber-track.ts` states it in its own header. This track must not
  quietly reopen it.

---

## 11. maff's answers

Answered 2026-09-04, before any of slice 4 was built. Each of these
changes the shape of the world rather than a number in it, which is why
they were put rather than decided.

1. **Which world — the Sorting Line.** The recommendation stands. The
   margin over the Top Shelf was one point and the choice was genuinely
   open, so this is a decision and not a formality: the world is the one
   where the voice sets Merc's silhouette and the room is inert.
2. **The snap is one mechanic, and its room stays in the plan.** The
   fourth room reads the same scalar one derivative up — a fast slide
   upward whips him off the floor, higher than the thumb jump reaches —
   and that counts as the same verb read faster, not a second verb. So
   the world is five rooms.

   **Still deferred, and deferred on a measurement rather than an
   opinion** (§12): a median-5 plus a 130 ms bridge means the fastest
   gesture is reported as a hold and then as a jump, and a breath
   resumed at a different pitch is indistinguishable from a real fast
   slide. The room is in the plan; it is not in this slice until the
   pipeline has been measured on a device.

3. **The octave-nudge buttons come off this world's HUD.** Nothing on
   screen names a note here, so a control that shifts an octave has no
   referent. The HUD is per-world already, so this costs nothing and
   removes a button that would have to be explained.
4. **The reject chute stays.** Room 2 keeps its fall. Gates that were
   passed stay passed, so it restarts the position and not the room —
   the same rule the chamber's fall already follows, which is what keeps
   three seconds of comedy from costing anything.
5. **Open on a preset and widen silently.** As specified in §6. A player
   who has never run the RangeFinder is not stopped at a door; the range
   grows as they sing. The measurement stays load-bearing without being
   a screen.

---

## 12. What this slice does not do

- **No shared world stage.** `ChamberStage` is forked, not lifted. §10.
- **No snap, and no derivative room.** maff has ruled it the same verb
  read faster rather than a second one (§11.2), so the room stays in the
  world's design — but not in this slice. It is out until the pipeline
  has been measured on a device, because the smoothing path makes a fast
  siren and a breath-and-reacquire look the same. What is deferred here
  is the scope, not the decision.
- **No narrowing bands as a difficulty knob.** §8.
- **No shatter in the first two rooms.** The shard batch and `shatterIn`
  are reused later, for the one thing that breaks in this world.
- **No new 3D assets and no Blender trip.** Plates are slabs, the ghost
  is a capsule, Merc is unchanged.
- **No new sound design** beyond a slap and a squelch keyed to the
  shape's velocity.
- **No circles map.** Two cards in the games list; the map is its own
  slice.
- **No free 3D movement, no room editor, no second mechanic.**
- **No note names, no absolute pitch, and no sharp/flat anywhere.** A
  target pitch in this world would be a different world.

---

## 13. Order of work

Each step lands green and leaves the app working before the next begins.

| #   | Step                                                                                                                                                                                         | Done when                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4a  | **The squash test. LANDED -- see §14.** Pose Merc from the voice by root scale in the Hallway, re-derive the hover offset, sweep `t` from 0 to 1 on a dev dial. No rooms                     | A 0.16 × 0.67 Merc reads as a puddle rather than a broken character on a real phone, the clamp (if any) is written down, and nothing else in the app has changed                         |
| 4b  | **LANDED -- `sim/tension3d.ts` + tests.** Pure: `t`, the spring, `silhouetteFor`, `fitsSlot`, `supportedBy`, the relax with its half-rate gap branch                                         | Pinned tests say a slot admits exactly the band the ghost is drawn from, a low-confidence frame holds rather than relaxing, and a 2.0 m mesh crosses in one breath with the stated slack |
| 4c  | **LANDED, see §15 -- Room 1, on a forked stage.** `Line3D`, the slotted plate, the ghost, the shape gauge, range calibration at entry                                                        | The Letterbox is playable end to end **with its `teaches` line hidden**, and a baritone on a soprano preset gets a world whose bottom end exists                                         |
| 4d  | **LANDED -- `levels/lines.ts` LINE_2, `Line3D` grate + chute + vertical slot, §16.1.** **Room 2, the trade.** Width-aware ground sampler as a closure, the mesh floor, the chute, the return | The Screen is playable, a thread falls through it, the chute returns him to the start of the stretch, gates already passed stay passed — and §8's question is asked out loud             |
| 4e  | **LANDED -- `WedgeSlot`, LINE_3, §16.3.** **The wedge gate**, plus `chamber-track.ts` generalised and a second card in the games list                                                        | A gate exists that a one-dimensional pitch cursor cannot pass, both circles run on one track module, and the list shows two cards with progress                                          |
| 4f  | **LANDED -- `sim/line-grade.ts` + `levels/line-stats.ts`, §16.4.** **The grade and the end card.** Slide and overshoot recorded per gate, best per room kept, the walk card                  | The run reports cents past the gate and first-try count per room and for the walk, replaying returns to the card, and nothing is gated on any of it                                      |

**4a is first on purpose**, and it is the same reasoning that put step 2b
early in slice 2: it puts the new thing into a scene that already works,
so an aesthetic problem cannot be confused with a room problem. It is
also the cheapest possible off-ramp — if a flattened Merc reads as a bug
rather than a joke, the answer arrives in an evening, before a room
exists around it, and §1.3's fallback is still cheap.

---

## 14. What step 4a found

Run 2026-09-04, on the real asset in the real environment, through
`/merc-probe.html`. Three things came out of it and only one of them was
the question that was asked.

### 14.1 The silhouette reads, and §1.3's off-ramp is not needed

The sweep, at 375x812:

| `t`  | body        | reads as                                     |
| ---- | ----------- | -------------------------------------------- |
| 1.00 | 0.94 x 0.28 | a tall teardrop, face clear. Beautiful.      |
| 0.50 | 0.55 x 0.36 | the shipped Merc, unchanged.                 |
| 0.33 | 0.42 x 0.41 | a squat wide Merc, face clear. Charming.     |
| 0.25 | 0.35 x 0.45 | still clearly a face. The comfortable floor. |
| 0.15 | 0.28 x 0.51 | eyes sliding onto the lower rim. Borderline. |
| 0.00 | 0.16 x 0.67 | **a puddle with no face.**                   |

So the answer to §1.3 is yes: a flattened Merc reads as a joke rather
than as a bug, across almost the whole range. **The Top Shelf fallback
is not triggered and the Sorting Line stands.**

### 14.2 The clamp, and why it is a finding rather than a policy

_Superseded the same evening -- see §14.5. maff looked at the flat end on
his phone and chose to dial the sweep rather than fix the face in art,
so the floor is now applied: `SWEEP.flat` sits on the measured line and
a test holds it there. The reasoning below is kept because it is why the
line is where it is._

At the very flat end the eyes and mouth flatten onto the silhouette's
lower rim, and a camera that looks slightly down at him stops seeing
them. He stops being a squashed character and becomes a spill.

**It cannot be fixed by scale, and that was checked rather than
assumed.** Counter-scaling `merc_face` changes nothing: it is a
`SkinnedMesh`, and three cancels a node transform through
`bindMatrixInverse`, so the face rides the skeleton. Recovering it is
art -- a shape key, a head bone that resists the squash, or features
that migrate as he flattens -- or it is mapping the voice onto
`[0.2, 1]` and giving up the flattest shape.

`FLAT_READS_ABOVE = 0.2` records the edge in `sim/tension3d.ts`, and
**nothing applies it**. A floor quietly baked into `silhouetteFor` would
make §4b's choice by default, and the two options have very different
consequences: clamping changes every slot height §2.1 derives, while
fixing the face changes none of them.

### 14.3 The thing that was not the question: he was never anchored

The plan's §7.2 predicted the trap in the right place and for a slightly
wrong reason. `createMerc` did compute a hover offset from the load-time
height -- but **it never ran**. Every caller, both stages and the probe,
assigns `root.position.y` from the simulation on the next frame, so the
offset was overwritten before it was ever seen.

What actually anchors Merc is the root origin, and the origin sits at his
**vertical centre**: `bounds.min.y` is -0.9519 against a height of
1.9028, so half of him is below whatever `y` the simulation gives him.
That is invisible today, because the floor is a non-occluding gradient
(`depthWrite: false`) and half a hovering droplet under the floor line
reads as hovering.

It stops being invisible the moment the shape moves. Anchored at his
centre, scaling his height grows him downward as much as upward, so a
squashed Merc rises off the floor and a stretched one sinks through it --
silently, and neither reads as squash or stretch. **The player just sees
him bob.**

So the body now lives inside a wrapper. `root` is the wrapper and carries
nothing but what the caller puts there; the body carries the scale and a
counter-offset that holds his lowest point exactly where the rest shape
left it. `setShape(1, 1)` is the shipped Merc, to the last bit, and the
two shipped worlds render identically to before.

### 14.4 Two things for §4b to inherit

**Width means the torso.** §2's table reproduces from the `merc_body`
shell (0.3595 wide at h=0.55, giving `w²h` = 0.0711 against the stated
0.0713), not from the whole actor (0.5282, giving 0.1534). The mitts add
8.4 cm per side and hang off their own bones, so `fitsSlot` should gate
on the torso -- gating on the mitts would gate on a limb pose any clip
can move.

**The flat end outruns the Hallway's framing**, separately from the face.
At `t = 0` and 375 px wide, a 0.67 m Merc has a mitt clipped off the left
edge by a chase camera framed for a 0.36 m one. Centring him recovers the
frame but not the face, so the two problems are independent: the framing
one belongs to the Sorting Line's own camera and is not evidence against
the shape.

### 14.5 What the phone said

maff ran the probe on his phone with his own voice, the same evening.
Three things, and only one of them was expected.

**The morph works.** The voice moves him and so does the slider, and the
tall end is good. That is the question 4a existed to ask, answered.

**"He squished too much on low notes."** The face went, exactly as
§14.2 measured, and maff's call was to dial rather than to fix the face
in art. So the sweep is now `0.32 m` to `0.94 m`: the flat end sits on
the line the face was seen to survive (`FLAT_READS_ABOVE_HEIGHT`), the
tall end is the one he called good, and the shipped Merc lies on the
curve at `t ≈ 0.37` rather than 0.5. `silhouetteFor` takes the sweep as
an argument and the probe reads it from `?flat=&tall=`, so the next
argument about these numbers can happen on a phone.

**"He goes below the screen as he stretches."** That was mine. The
anchor in §14.3 had its sign backwards -- it held his TOP still, so a
thread sank 39 cm and a puddle floated 39 cm -- and the check I called
verification looked only at rest, where the offset is zero whichever
sign it carries. The arithmetic now lives in `render/merc-anchor.ts`,
pure and tested across the whole sweep and past both ends of it.

Fixing it surfaced a second, quieter thing: the anchor was on the whole
box, and the whole box's bottom is a **mitt**, hanging 25 cm below the
body in the bind pose and beside it in every clip that plays. Holding a
point nobody sees still lets the body itself drift by the difference,
scaled -- 4 cm at the flat end. The anchor is the torso now
(`merc_body`, 0.2023 m under the root; the box would say 0.2751), which
is also the shell §14.4 says width means.

**And a test that would have caught all of it.** `e2e/merc-probe-shape.e2e.ts`
drives the probe in Playwright at 390x844: at `t` = 0, 0.25, 0.5 and 1 it
screenshots him and asserts the torso is inside the frame, and with the
clip frozen it asserts his feet have not moved -- in world units to a
millimetre and on the screen to a pixel and a half. The first run
failed both ways, which is the point.

One number the test carries rather than asserts: the Hallway's chase
camera frames him 0.4 m left of centre by design (`lookAt` is always
`mercX + 0.4`), and at the flat end that puts the torso's left edge 4 px
past a 390 px phone and a mitt 8 px past it. The flat end therefore
asserts top and bottom only, with the reason in the file. **The Sorting
Line's camera (step 4c) must frame him centred or wider**; the day the
probe can use it, the contract tightens to every edge and the whole box.

---

## 15. What landed in 4b and 4c, and what moved

Both steps landed on 2026-09-04, the same day as 4a, in three commits
on PR #706. The plan held; four numbers and one object did not, and
each is recorded here with why.

### 15.1 The rule (4b)

`sim/tension3d.ts` holds all of it and no three.js: the critically
damped spring at ω = 9 (settles in about half a second, never
overshoots -- both pinned), the relax at 6 s toward rest with the
Blackout's half-rate branch for a doubtful frame, the gate bands, the
furniture derived from them, and the Span's widening. Room 2's clock is
checked against the relax from both ends, with slack.

**The clamp is derived, not declared.** §2.1 wrote a per-gate `clamp`
literal (0.42 for the letterbox) against a rest of 0.5. Rest moved to
0.371 when the flat end came up (§14.5), and a literal that quietly
admitted the resting drop would have turned the letterbox into a
doorway. `REST_MARGIN = 0.08` is stated once, against wherever rest is;
a test walks every gate over spans from 8 to 30 semitones and checks
the resting drop fits none of them.

**The narrowest voices get less band than §2.1's table said.** With
rest at 0.371 a flat gate can offer at most `0.291` of the range, so a
ten-semitone measured span gets 2.9 semitones of letterbox, not four.
The promise is held for every voice PRESET (24 semitones, trimmed to
22), which is what a first-time player has; a narrow measurement gets
what it gets and the widening grows it as they sing. That is the
consequence of maff's dial, and it is the right trade.

### 15.2 The gauge

The tube from the ChatGPT states sheet, as SVG: brass caps, a column of
mercury with a custard meniscus, ticks per semitone with the octaves
longer, a turquoise enamel band for the stretch the gate admits that
warms when he is inside it. The column moves by `transform`, never by
`height`, because SVG geometry animates through CSS on desktop Chrome
and on nothing older, and the one place it has to be smooth is an iOS
WebView. When the mic loses the voice the column greys and never hides.
It sits on the right edge, half the screen tall; `line-gauge` in
storage remembers whether it is shown.

### 15.3 The room (4c)

**The track is generalised** (`levels/track.ts`); `chamber-track.ts` is
the chambers' instance and kept every name. **Rooms are stated in
metres**, as the plan wrote them. **Line3D is Chamber3D with the glass
taken out**, plus a plate whose bottom edge is the slot height, a mouth
on the floor that lights custard when he fits, and a ghost -- an
ellipsoid at the band's centre, standing at the standoff so that a
player who walks up to a shut plate is standing inside the shape they
need to be.

**The camera is centred**, 0.15 m off rather than the chamber's 0.4,
and 0.3 further back: §14.5's finding, applied. The probe's e2e cannot
see this camera yet -- it borrows the Hallway's -- so the whole-box
contract in `merc-probe-shape.e2e.ts` is still waiting on a probe
mode that uses `Line3D`.

**The ghost is not a pancake any more.** With the flat end at 0.32 m
the letterbox's centre body is 0.39 x 0.43: a squat drop, which is what
the ghost honestly draws. §4's "wide, flat, faintly glowing pancake"
described the old sweep.

**The jump is hidden** (`TouchControls` gained a `jump` prop; the
pad's tap-to-jump goes with it). **The grade is deferred to 4f**: a
clear records the walk and nothing about how it went, and the end card
says "walked" rather than a percentage that would have to be invented.
**`LINE_CONFIG` is deferred** with the tension dials; the stage reads
only locomotion and the loop from `CHAMBER_CONFIG`.

**Verified in the browser, driven by `__w3l()`**: tall at the plate he
stops at 1.26 (the standoff) and the mouth stays turquoise; flat, the
mouth goes custard and he walks through; at the exit the room clears,
the card reads "1 of 1 · walked", and `beside-cue:games:line-track`
holds the clear. Not yet verified: a real voice through the spring on
a phone, which is the first thing to do with it.

### 15.4 What the phone said about 4c, and what changed

Three findings from maff's phone, all on room 1.

1. **The plate sat visibly above his head while the sim said he did not
   fit.** Root cause, not a tuning: Merc's root origin is his vertical
   centre (§14.3), and every stage puts the root at floor level, so half
   of him is below the floor plane. Against a floor that is only a
   gradient that read as hovering; against a plate with a real bottom
   edge it read as a lie. Two changes, both in the rule rather than the
   art. `Line3D` now stands his TORSO on the floor
   (`root.y = mercY + feetBelowRoot`, the anchor's own number), and the
   slot is sized and judged by the torso: `TORSO_OF_HEIGHT = 1.6509 /
1.9028` from the measured shell, `slotHeightFor` returns
   `torsoHeight(silhouetteFor(band.hi))`, and `fitsSlotHeight` compares
   the torso. At rest his torso is 0.477 m against a letterbox of
   0.401 m, so the tip visibly does not clear; at the band's edge the
   two are equal by construction. The e2e probe is untouched; it
   measures the actor, not a room.
2. **The ghost is gone.** It read as a circular bulge aligned with the
   plate -- as the thing passing, not as him -- and maff asked whether
   it was needed at all. The slot, the mouth and the gauge's band carry
   the instruction now. §7.2's second skinned draw is not coming back
   unless a playtest asks for it by name.
3. **The room does not teach itself, and does not need a guide.** The
   gate card now carries two sentences: what his body does with a
   voice, and what to do with that. A full guide is for a concept that
   does not explain itself (vibrato, the chamber); a voice that changes
   a shape does.

Also from the phone: the tube reads, and is a little bigger now
(`min(54vh, 27rem)` tall, `4.1rem` wide). Seen on a tablet only, so the
phone sizes are still a question.

## 16. What landed in 4d, and §8's question asked out loud

### 16.1 The Screen (4d)

`LINE_2` in `levels/lines.ts`: solid floor to 1.6, a grate to 3.6 over
an ember chute, the island, a vertical slot at 4.9, the exit at 6.6, a
drop returning him to 1.4. The furniture is a union now -- `SlotPlate`
and `MeshFloor` -- and three pure functions do what the stage used to
do inline: `sizeFor` (a horizontal slot's height, a vertical slot's
width, a grate's gap: one number per piece, drawn from and judged by),
`admits` (fits, or is held), `crossed` (a hand past a plate, the far
lip of a grate). `meshLayout` cuts a grate so that every gap is exactly
the judged size and the two lips absorb the remainder; the stage drops
him only over the gaps (`overGaps`), never on a lip, and `Line3D` lays
its slats from the same layout. A drop is a phase, not a height: the
`fall` clip topples him where he stands, he sinks through the bars as
the chute flares, and 1.6 s later he is at the lip with everything he
had passed still passed.

Two corrections found on the way:

- **`tLimit` was a width, and the plan reads it as an edge.** For a
  flat gate the two are the same number; for a tall one `1 - width` is
  not the threshold the plan's clock was computed from, and the slot
  band came out as [0.451, 1] (rescued by the rest margin) where §5
  says [0.634, 1]. `bandFor` now reads `tLimit` as the band's edge on
  both ends, with `semis` the least width, and a test pins room 2's
  slot band to 0.634.
- **The view's gate rows were built once, for room 1.** The handover
  into a room with more furniture than the last threw on the first
  frame. Rebuilt per room now, and the two-room walk is the check.

Numbers for a 17-semitone span, the plan's: gap 0.377 m (plan: 0.42,
before the torso and the rest margin), slot 0.316 m (plan: 0.33). What
holds cannot fit and what fits cannot be held, which is the room, and
`lines.test.ts` says so for every preset.

### 16.2 The question (§8.3), answered honestly

**Does any gate in this world distinguish `silhouetteFor(t)` from `t`
itself?** No -- and under the rule as locked it cannot. With `w²h`
conserved the body has ONE degree of freedom, so every static gate,
however it is phrased -- a band of aspect ratios, a slot over a grate,
two demands at one place -- reduces to an interval of `t`. §8's "gate
a one-dimensional cursor cannot pass" is not a design that has not
been found yet; it is arithmetic.

What the shape buys that a cursor does not is therefore not in any one
gate but in two other places:

1. **Opposition along the walk.** Room 2's grate wants wide and its
   slot wants narrow, the relax runs the clock between them, and the
   only solid ground to swap on is the island. A pitch-as-height game
   can put two bands in a row; it has no reason for them to fight.
2. **A profile in `x`.** A slot whose ceiling falls along its length
   asks for a GLIDE coupled to walking -- the voice has to keep moving
   while he does, at a rate the room sets -- which is the siren-with-
   a-target §9 grades and which no band can ask for. This is the
   wedge, and it is what 4e builds, in place of the impossible gate.

If the world is still felt to be "a slider with a very good avatar"
after 4e, the remaining lever is a second degree of freedom -- loudness
into volume, so a shape needs two numbers -- and that is a measurement
before it is a design. §4 of the Top Shelf stays the fallback.

### 16.3 The Wedge (4e)

`LINE_3`: five metres, one wedge from 1.8 to 2.8, the exit at 4.6.
`WedgeSlot` carries two gates -- what the mouth admits (`WEDGE_IN`,
`tLimit 0.30`) and what the far end admits (`WEDGE_OUT`, `tLimit 0.06`,
at least two semitones) -- and the ceiling is a straight line between
the two torso heights they become (0.434 m to 0.327 m for a 22-semitone
span). Three rules, all pure and tested in `lines.test.ts`:

- `wedgeCeiling(gate, fit, x)`: the mouth's height before the mouth,
  the far end's after it, linear between.
- `admits` for a wedge judges the ceiling at his FRONT edge, not his
  centre: a falling ceiling meets him there first, so he has to be
  lower than where he stands -- which is the ask.
- `wedgeStop(gate, fit, torso, halfWidth)`: where the wedge stops a
  held shape. Infinity when the far end admits it (no wall), before the
  mouth when the mouth does not, and for anything between, inside. The
  walls are rebuilt from it every frame, so the wall moves with his
  voice.

The test that states the room: a glide that tracks the ceiling at his
centre is walled; one that leads by his widest half-width is not. He
widens as he flattens, so the lead grows through the wedge. `Line3D`
cuts the plate as a trapezoid extruded across the corridor, recut only
when the two ceilings change, with a mouth the wedge's whole length
that lights while he fits where he is.

`bandsFor` and `fitFor` replaced `bandFor` + `sizeFor` in the stage: a
piece of furniture now has a `band` (where he has to be to get
through, what the gauge shows and the grade judges) and an `entry`
band, the same thing for everything but a wedge; and a `Fit` of one or
two numbers. `sizeFor` stays for the one-number pieces.

### 16.4 The grade (4f)

`sim/line-grade.ts`, pure, with `line-stats.ts` beside the track for
what persists. As §9 specified, with one thing it did not: stillness
is a WINDOW, not a velocity. A pitch tracker jitters by a few cents a
frame, which at 60 Hz is a "velocity" of a semitone a second, so the
0.5 semitones-per-second rule would never have seen a stop. A stop is
now the voice held within 0.1 semitones for 150 ms; a slide starts
when it leaves the last stop by more than 0.5. Silence clears the
window and nothing else, so a breath in a held note is not a second
stop. All of it is in `line-grade.test.ts`, jitter included.

Per gate: the first stop aimed at it decides first-try and overshoot
(cents past the nearest edge of the gate's band in MIDI, 0 inside);
later stops count but do not change what the glide did; a gate walked
through with no stop is first-try, he was already there. Quality is
`qualityFromCents` with the gate's own band as the zero point, so
`score.ts` is reused with its own `ScoreConfig` (`LINE_SCORE`: the
journey's thresholds, a drop costing what a fall costs). Room grade is
the mean, less drops, and the track keeps the best per room; the
stats keep that run's units. The room card reads `62¢ past the gate ·
2 of 3 first time · dropped once`; the walk card `84¢ past the gate on
average · 11 of 14 gates first time` over every room's best, with the
app's medal at the app's thresholds and nothing gated on it.

One thing the phone will show: a room cleared before this landed
carries a best of 0%. Walking it again fixes it, because the track
keeps the best.

### 16.5 §13, as it stands

4a through 4f have landed on `feat/sorting-line-squash-test` (PR #706).
Still open, from the phone and the plan: the tube's size on a small
phone (seen on a tablet only), whether the wedge reads as a wedge with
the camera where it is, the guide-versus-hint question if a playtest
says two sentences are not enough, and §7's list.

### 16.6 What the phone said about the wedge, and what changed

Three findings from maff's phone on room 3, after the merge of 4a-4f.

1. **A note released inside the wedge let him walk on out.** Root
   cause: as the relax brought him up, `wedgeStop` moved BEHIND him,
   and the stage skipped any wall behind him -- so there was no wall.
   `wallAt` in `lines.ts` now owns the rule, and a wall is never behind
   him: a wedge whose ceiling has come down on him, or a plate that
   shut while he was in its doorway, pins him where he stands until he
   is the shape again. He stops with his head against it and can back
   out. Tested: inside the wedge at rest the wall is his own `x`; the
   far end's shape and a grate are no wall; a plate's doorway pins.
2. **A low note at the door graded 0%, the same note the next time
   100%.** The wedge's grade judged the first held note against the
   EXIT band -- the bottom two semitones of the range -- wherever it
   was sung. `bandAt` now gives the band that applies where he stands:
   the entry band before the mouth, the exit band at the far end, and
   between them a band that closes as he walks, derived from the
   ceiling at his front by `tForTorso`, the sweep run backwards. The
   gauge shows that band, so the tube says "keep going down" in the
   one place it is true, and a stop is graded against it.
3. **Too short.** At one metre a note released at the mouth still
   fitted the far end before the relax had brought him up; the glide
   never had to be sustained. The wedge is two metres now (1.8 to 3.8,
   room 6.5 m, exit 6.0), and a test walks a released note from the
   mouth at walking pace and requires the ceiling to meet him with
   more than 0.4 m to go.
