# Slice 5 — polish and follow-ups, then the Top Shelf, then V1

Written 2026-09-05, after slice 4 (the Sorting Line) merged as #706 and
#711. maff's call for the road to V1 of the mini games: **the polish
slice first, then the carried follow-ups, then the Top Shelf as the last
mechanic, then a V1 release** — with a detailed device test by maff
before each step is called done.

This document is the interview for all three, asked now rather than
later. Every question carries the default the work will proceed on if
it is not answered; an answer changes the default and is recorded here
beside it. The polish slice's contents come from `glass-3d.md` §5.4,
§7.1, §8 and §9 (its row 3, never run); the follow-ups from
`standing-wave-chamber.md` §7 and `sorting-line.md` §16.5; the Top
Shelf's questions from `sorting-line.md` §1.2, which is the only place
it has been analysed.

---

## 1. What exists, measured against what the plan asked for

| Plan item (`glass-3d.md`)                                                     | State on `main`                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Pixel ratio capped at 1.5 while a world runs (§5.4)                           | Done in every stage (`Math.min(devicePixelRatio, 1.5)`)                                                      |
| Render on demand / idle loop off when calm (§5.4, the thermal budget)         | **Not done.** Every stage runs a rAF loop from mount to unmount, Merc breathing and the pool pulsing         |
| DPR drop to ~1.0 for the 1.2 s burst (§7.1)                                   | **Not done**                                                                                                 |
| Hitstop, slow-motion ramp, camera shake, chromatic aberration, dust (§7.1)    | **Not done.** Only the shard simulation's own slow-motion factor exists (`world3d-config.ts`)                |
| Haptics: heavy on the crack, three decaying light taps (§7.1)                 | **Not done.** `@capacitor/haptics` is installed and unused; the 2D game uses `navigator.vibrate`             |
| Reduced-motion path (§9 row 3)                                                | **Not done** in any 3D world. The app has a `reducedMotion` preference in `content/assets.ts` for onboarding |
| Load time (§9 row 3); "first load is sluggish" (chamber §7)                   | **Not measured.** Nothing warms the renderer, Merc's glb (417 KB) or the ORT session before a card is tapped |
| FPS and frame time in the page (§8)                                           | The Cabinet's chip shows backend, fps and f0 rate; the other stages show the backend only                    |
| The perf gate: 60 fps on a mid Android, measured after ten minutes (§5.4, §9) | **Never run.** Every slice landed on maff's phone and a browser                                              |

Follow-ups carried from device testing, none blocking:

- Art-direction and tuning pass on the break (chamber §7, maff's own
  follow-up). This IS the §7.1 timeline above, plus a tuning surface.
- The Cabinet's vertical-FOV framing, the bug the Hallway and the Line
  already fixed with the widening rule.
- The `fall` clip has no mitt articulation; reads as tipped, not laid out.
- Sorting Line (§16.5): rooms cleared before the grade landed carry a
  best of 0% until walked again; the hints and the wedge want a
  stranger's playtest; the second degree of freedom is a measurement.
- The onboarding intro on native iOS (chamber §7) has had two fixes on
  `main` since (`asset-fetch` status-0, the video handoffs). Needs maff
  to confirm on the device; it is not games work.

---

## 2. Slice 5 — the polish slice

### 2.1 Decisions for maff, with defaults

**P1. The gate device.** The plan says "a mid Android". You have an
iPhone 13 Pro and an Android tablet. _Default:_ the gate is the tablet,
stated as such, and the iPhone in Low Power Mode is the second gate.
If you have or can borrow a mid-range Android phone, name it and it
replaces the tablet.

**P2. What passes.** _Default:_ after ten minutes in a world, frame
time under 12 ms on the CPU side and no visible hitch at the shatter on
the gate device; on the iPhone in Low Power Mode, 30 fps with the
simulation at full speed (the fixed-step loop already guarantees the
second half). The numbers are read off the chip, which every stage gets.

**P3. The idle loop.** The plan says render on demand when calm; the
worlds are never still (breathing, the pool). _Default:_ a calm mode
rather than a stop: after three seconds with no input and no voice, the
stage renders at half rate; any touch, key or voiced frame returns it
to full rate on that frame. Cheaper than on-demand, keeps the breathing,
and is the thermal budget's actual ask. Alternative: stop rendering
entirely when calm, at the cost of a frozen Merc.

**P4. The shatter's juice (§7.1).** _Default:_ build hitstop (100 ms),
the slow-motion ramp (0.35× to 1.0× over 350 → 550 ms), camera shake
(trauma-squared), the DPR drop to 1.0 for the burst, and the haptics --
all as durations, never frame counts. **Skip** chromatic aberration (a
post pass means a render target, which is fill rate on a phone) and the
dust billboards (the shards already carry the moment). Every number
goes through the existing DevDials so the tuning is dragged, not
guessed. This is your "art-direction pass on the break".

**P5. Haptics, where.** _Default:_ chamber and Hallway: heavy on the
crack, three decaying lights (§7.1). Sorting Line: light when a mouth
opens, medium on a drop, nothing on a bump. Cabinet: same as the
chamber. No in-app toggle for V1; iOS and Android system settings
already gate haptics, and the app's Settings screen is not the place
for a game-only switch until someone asks.

**P6. Reduced motion.** _Default:_ under `prefers-reduced-motion` the
worlds still play (he walks, the voice shapes him) but: no camera
shake, no hitstop or slow-motion, no DPR pop, no breathing bob, shards
fly for half the time, and the gauge's column moves without its
transition. Haptics stay (they are not motion). Alternative: hide the
3D cards and offer the 2D games -- rejected as a default because it
takes the whole thing away for a preference about vestibular comfort.

**P7. Load time.** _Default:_ measure first, as chamber §7 says. Each
stage gets a one-line breakdown in the dev chip: renderer init, Merc,
ORT session, mic, to first frame. Then, if the numbers say so: warm
ORT and Merc's glb when the games list opens (`requestIdleCallback`,
all local files, about 1.5 MB parsed), and keep the renderer per stage.
Decision asked now: **is warming on the list screen acceptable**, given
it spends CPU before a card is tapped? Default yes.

**P8. The Cabinet's FOV.** No question: the Hallway's widening rule is
applied to the Cabinet stage.

**P9. The fall's mitts.** _Default:_ one pass in Blender through the
MCP on the `fall` clip's mitts; if it does not read better on the
phone, keep what ships. Not a code task, so it is last in the slice.

**P10. The 0% bests.** Local to devices that played the pre-grade
build (yours, and the browser). _Default:_ no migration code; those
rooms are walked again. Alternative: bump the line track's storage key
so pre-grade clears are forgotten -- one line, but it also forgets that
the rooms were cleared.

**P11. The Sorting Line's second degree of freedom** (loudness into
volume, §16.2). _Default:_ deferred past V1. The Top Shelf is the last
mechanic before V1, so no room 4 -- but a level probe (mic level versus
distance, logged on the phone) is cheap and can ride along with P7's
measurement if you want the number in hand.

### 2.2 Steps

| Step | Contains                                                                                                          | Done when                                                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 5a   | The chip everywhere: fps, CPU ms, load breakdown; the calm mode (P3); the Cabinet's FOV (P8)                      | Numbers readable on the phone in every world; calm mode measured as a frame-time drop          |
| 5b   | The shatter timeline as durations: hitstop, slow-motion ramp, shake, DPR drop, haptics (P4, P5), through DevDials | maff tunes it on the phone and the pasted values land in `world3d-config.ts`                   |
| 5c   | Reduced-motion path (P6), and the Sorting Line's and Hallway's haptics                                            | `prefers-reduced-motion` in the browser pane shows the calmer world; haptics felt on the phone |
| 5d   | Load time: measure, then warm (P7)                                                                                | Card-tap to first frame stated as a number before and after, on the gate device                |
| 5e   | The gate (P1, P2) run and recorded here; the fall's mitts (P9)                                                    | A table of frame times per world per device, after ten minutes, in §2.3                        |

Each step is its own PR, rebase-merged, fix-ups squashed.

### 2.3 What the gate measured

(Filled by 5e.)

---

## 3. Slice 6 — the Top Shelf

Only `sorting-line.md` §1.2 has looked at it, and it found that the
geometry does not close as proposed: at 0.06 m per semitone, shelves
five semitones apart are 0.30 m apart, and Merc is 0.55 m tall. These
are the forks the plan will need decided; a full plan (the shape of
`sorting-line.md`) is written once they are.

**T1. Scale.** _Default:_ shelves are a STAIRCASE, offset sideways as
they rise, so vertical spacing can be less than his height; and 0.1 m
per semitone, so an octave is 1.2 m and a room is a tall room rather
than a shaft. The vertical-FOV rule now handles tall rooms. Alternative:
scale Merc down in that world (the Line already scales him), which
buys spacing at the price of a smaller face on the phone.

**T2. What the two notes are.** _Default:_ the note he is holding is
the reference and the note he jumps to is the target; the interval
between them is the jump height. The reference is the last settled
note, which the Line's slide tracker already finds, so the skill is
relative pitch, and a room states its asks in semitones ("a fifth up").
Alternative: a fixed tonic per room, which is easier and is not
interval training.

**T3. Tolerance.** _Default:_ no splat. Overshoot lands him on a higher
shelf if one is there (rewarded, and graded as cents past the ask);
undershoot brings him back to the shelf he left. The proposal's
"splat on the underside" needs a head test in `locomotion3d.ts` and a
gap he does not fit in; this default needs neither.

**T4. Failure.** _Default:_ falling returns him to the last shelf he
stood on, as the chute returns him to the lip -- losing progress to one
misstep is a punishment for learning (§5 of the Line, held to).

**T5. Rooms for V1.** _Default:_ three, the Line's shape: teach (one
interval, a fifth), apply (thirds and fifths, a staircase), twist (an
octave he must split into two jumps because no single jump reaches it).

**T6. Shared physics.** The upward ground sampler lands in
`locomotion3d.ts`, which all three shipped worlds stand on. _Default:_
behind the existing locomotion tests, no behaviour change for a world
that does not use it, and the Hallway's, chamber's and Line's e2e and
unit tests are the regression gate.

**T7. The verb's thirty seconds.** The Line's §1.1 argument was that its
best thirty seconds need no sentence. The Top Shelf's: hum a note, hum
a higher one, and a chrome droplet leaps exactly that much higher.
_Default:_ the room-1 shelf heights are drawn as a ruler of semitones
up the wall, so the leap reads as a measurement without a word.

---

## 4. V1 of the mini games

**V1. Which games, in what order.** Today's list: the 2D games (Merc's
Journey, Jump Trials), the Cabinet, the Hallway, the chambers, the
Sorting Line. _Default order for V1:_ Cabinet, Hallway, Sorting Line,
chambers, Top Shelf, then the 2D games -- the 3D worlds first by the
difficulty of their verb, the chambers after the Line because vibrato
is the hardest ask. Say if the 2D games should lead.

**V2. Devices without WebGL2 or a GPU.** The stages already report
"no GPU". _Default:_ the 3D cards stay visible with a one-line note
and do not open; the 2D games remain.

**V3. The thirty-second video.** The Line's plan had it end on the
Line's card. _Default:_ unchanged -- the Top Shelf earns the opening
(the leap), the Line keeps the close (the grade in real units).

**V4. Local progress at V1.** _Default:_ no wipe, no migration; the
keys stay as they are (`beside-cue:games:*`).

**V5. Store and RevenueCat.** Locked already: games gate nothing and
are gated by nothing; BeSideCue Pro stays support-only. No decision.

---

## 5. Answers

(Recorded here as they arrive, beside the question they answer.)
