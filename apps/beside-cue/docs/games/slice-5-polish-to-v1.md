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
entirely when calm, at the cost of a frozen Merc. On the Sorting Line,
Merc's relax back to rest after the voice stops runs calm: calm engages
39% of the way back, where from the tallest shape the Line allows a
30 fps frame moves the top of his head 1.3 mm (his width at most 0.4 mm,
from the flat end), and less on every frame after -- under the 2 mm
that would count as motion.

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

### 2.4 What 5a landed

**The chip, on every stage.** One line for the frame -- backend, frames
drawn a second, main-thread milliseconds per drawn frame (mean and worst
over the last second), the share of that second the loop kept the main
thread busy, and detector frames a second -- then where the wait between
tapping a card and the first frame went, then, once the gate is tapped,
the microphone's own wait. The phases, in the order they happen:
`scene` (building the scene; the environment map is painted on a canvas
inside it), `gpu` (`renderer.init()`), `merc`, `glass` (the Cabinet's
bowl and shards, a pane's shards), `compile` (the shard program, linked
before the break needs it), `draw` (the first frame's own cost), `first`
(mount to first frame: the card tap), `mic` (the tap to a live stream,
the permission prompt included the first time) and `f0` (a live stream
to the first detector frame). There is no ORT phase because no ONNX
session is made on the way into a 3D world: the stream is YIN in a
worker (`pitch-f0-stream.ts` says so), so `f0` is the pitch engine's
share of the wait.

A development build shows the chip; a production build only with `?perf`
in the address, so no player sees it -- the Cabinet's old chip, which
they did see, included. Its f0 rate is now counted by change of the
detector's level: the Cabinet counted changes of `tAudio`, which is the
audio clock read at the poll rather than a stamp on the frame.

**Calm (P3), as a rate.** Three seconds with no touch, key, voiced frame
or motion, and the stage draws 30 frames a second by the clock: half a
60 Hz screen, a quarter of a 120 Hz one, and nothing at all off a phone
that Low Power Mode already holds at 30, which halved would draw a
breathing Merc at 15. Only the drawing slows. The loop still runs every
frame, so the fixed-step simulation is fed the same wall time and a
touch is answered on the frame it arrives in. What counts as motion is
each world's own -- shards in the air, a fall, a room handing over, Merc
walking or in the air -- because half rate on those is a stutter rather
than a saving; the plan named only input and voice. The renderer is
handed the time since the last DRAWN frame, so Merc's clip and the chase
camera keep their speed. `runtime/calm.ts` is the rule, tested at 30,
60, 90 and 120 Hz with jitter; both numbers are dials.

**What it measured.** Production build, headless Chromium, 390 × 844 at
DPR 3 (so the 1.5 cap applies), read off the chip the way maff reads it.
On a desktop GPU (Radeon RX 9070 XT through ANGLE; WebGPU is not offered
headless, so WebGL2): 60 fps active and 30 calm in every world. A drawn
frame costs the main thread 0.3-0.6 ms on average and under 1 ms at
worst, calm or not, and the loop's share of the main thread falls from
2-4% to 1%. Calm draws fewer frames, not cheaper ones; half the frames
through the GPU is the thermal saving. In software (SwiftShader) the
worlds draw 7-11 fps, below the calm rate, so calm correctly changes
nothing there. Neither machine is a phone: these numbers say the
mechanism works, and the gate's are the chip's on the devices (§2.3).

**Where the wait goes**, on the same desktop GPU, in milliseconds:

| World    | scene | gpu | merc | glass | compile | draw | first | mic | f0  |
| -------- | ----- | --- | ---- | ----- | ------- | ---- | ----- | --- | --- |
| Cabinet  | 44    | 28  | --   | 12    | 127     | 35   | 250   | 17  | 548 |
| Hallway  | 43    | 18  | 19   | 23    | 3       | 103  | 200   | 18  | 531 |
| Chambers | 46    | 25  | 21   | 10    | 2       | 121  | 220   | 18  | 548 |
| Line     | 46    | 20  | 19   | --    | --      | 143  | 231   | 18  | 547 |

The files are the small part: Merc and the glass load side by side in
about 20 ms. The first draw is the large one, 100-140 ms in the Merc
worlds (in the Cabinet the shader work shows under `compile` instead),
then building the scene at about 45. The largest wait on the list comes
after the gate: half a second from a live stream to the first detector
frame, on a machine where the stream itself took 18 ms (a fake device,
so no prompt). That, not Merc's glb, is where 5d looks first. (5d found
the half second to be the fake device's own: it is silent but for a
beep every half second, and `f0` waits for the first beep. §2.7.)

**The Cabinet's lens (P8).** `render/fov.ts` holds a composition's
horizontal angle on a narrower screen, only ever widening, and capped.
The Hallway, the chambers and the Line each carried that rule inline;
they share one copy now, pinned by a test to the arithmetic they shipped
with. The Cabinet was composed at 36 degrees on a 3:2 screen and had no
rule at all, so on a 390 × 844 phone it kept its 36 vertical degrees and
17 of width. It opens to the Hallway's cap now, 62, which gives 31
degrees of width.

**The production build, on the phone.** `pnpm --filter
@irchiinnuss/beside-cue-app preview:lan` builds, then serves `dist` on
`https://<lan-ip>:4173` with the dev server's certificate
(`preview.https` falls back to `server.https`). If `.dev-cert/` is
missing, `bash apps/beside-cue/scripts/dev-cert.sh` first, so the
certificate names the LAN address. Open `/?perf`.

### 2.5 What 5b landed

**The break, as durations.** `runtime/impact.ts` is §7.1 as P4 chose
it: a heavy tap and the shake at the crack, 100 ms of hitstop, 0.35×
until 350 ms, eased back to full speed by 550, a 400 ms shake that dies
as the square of what is left of it, light taps at 100, 300 and 550,
and the pixel ratio at 1.0 for the 1.2 s burst. Every quantity is a
function of the wall time since the crack, and the one that
accumulates -- how far the shards have flown -- is the speed's integral
in closed form, so a 30 fps clock and a 60 fps one put the same shard in
the same place at the same moment. The tests pin both: the order of the
events, read back off the functions a millisecond at a time, and a break
played at 30 and at 60 fps ending at the same wall time, with its four
taps felt once each and in order at any rate from 24 to 120.

**What slows is what is seen.** The hitstop and the slow motion scale
the shards' clock and Merc's clip, never the fixed-step simulation: the
pad's jump pulse is 80 ms, shorter than the hitstop, and a world that
stopped stepping would drop a jump pressed inside it. The glass shows
broken from the crack itself -- a shard at rest sits where it was in the
pane -- so what the hitstop holds still is the break, not the intact
pane it would otherwise have held.

**The shake** turns the lens about its own axes after the camera is
placed for the frame, so the framing holds and nothing accumulates. The
plan gives it no size: 0.8 degrees of turn, 1.2 of roll and 18 Hz is
about a centimetre at the Cabinet's bowl and four at the Hallway's pane,
and reads as a rattle rather than a sway. These, like every number of
the break, are the plan's first guesses: thirteen dials under "The hit",
the `impact` branch of `world3d-config.ts`, for maff to drag on the
phone and paste back.

**The pixel ratio** drops as a scripted step, never a controller: 1.5 to
1.0 at the crack and back at 1.2 s, and a screen already at or under 1.0
is left alone. Measured, 585 px of canvas became 390 and came back 1203
to 1215 ms after the crack, in every world.

**Haptics (P5)** go through the app's own haptics port
(`@irchiinnuss/mobile-runtime`): `@capacitor/haptics` in the app,
`navigator.vibrate` in a browser -- Android Chrome buzzes, iOS Safari has
no vibration and stays silent -- loaded the first time glass breaks. The
Cabinet has the chamber's pattern, and there is no switch of the games'
own. An e2e records what reaches `navigator.vibrate`: 35, 10, 10 and 10
ms, in that order.

**Not built:** chromatic aberration and the dust (P4), and §7.1's white
flash for two frames, which P4's list does not include and which the
reduced-motion path would only have to take out again.

**The crack frame had a stall, and it was not the timeline's.** Before
any of this, the Hallway's crack frame took 56-63 ms, 40-47 of them on
the main thread (5a, three breaks). Wrapping three's node builds showed
why: the shard batch's program was never built at load -- the compile
there skipped it -- and was built on the crack frame instead, twice
(back faces, then front). The batch is now never culled as a whole: its
bounds are the intact pane's and go stale once the shards fly
(`setMatrixAt` does not move them), each shard is still culled on its
own, and a batch that could be culled could be skipped by that compile.
With that, all three worlds build the program at load, and the worst
frame in the half second after the crack is 19-21 ms (mean 16.7), three
breaks each. The cost moved to where nothing is waiting: the Hallway's
`compile` went from 4 ms to 131 and its first frame from 107 to 47, so
`first` from 222 to 293, and the chambers' `first` from 239 to 320 --
the load numbers 5d starts from. The same probe found the chamber's
panes built when they first come into view rather than at load: a stall
on walking up to a pane, outside the break, and 5d's too.

**Measured where.** Development build (the break hooks exist only
there), headless Chromium, 390 × 844 at DPR 3, the desktop GPU through
ANGLE (WebGL2). Not a phone: the numbers say the mechanism works, and
the gate's are the chip's.

### 2.6 What 5c landed

**Reduced motion (P6), from one reading of the preference.**
`platform/reduced-motion.ts` is AssetStage's live `prefers-reduced-motion`
signal, moved out so the 3D worlds read the same one rather than a
second copy, and followed while a world is open, on the next frame.
Under it the worlds still play -- he walks, the voice shapes him, the
glass breaks -- and the break keeps its taps, at the same moments, and
loses everything that moves the picture for its own sake: no hitstop, no
slow motion, no shake, no pixel-ratio step (`reducedImpact`). The shards
fly for half the time as the same paths on a clock twice the wall's,
rather than as a flight cut off in mid-air or a smaller burst: nothing
fades or shrinks that did not before, and the camera, whose movement is
the one that fills the view, stays still throughout. The other reading,
a slower and shorter burst, is a change to the solver's launch numbers,
and it is maff's to ask for if the quicker flight reads as more motion
rather than less.

**The breathing bob** is Merc's idle clip, `listen`. Under reduced
motion it fades in and holds its first frame, in the Hallway, the
chambers and the Line; the clips that are the game -- walking, singing,
celebrating, the fall -- still play. **The gauge's column** jumps to
where the voice puts it instead of sliding. The ringing glass's pulse
and the open exit's breath stay: they are light, not movement.

**Haptics (P5), the rest of them.** The Hallway's, the chambers' and the
Cabinet's came with the break in 5b. The Sorting Line taps light when
the mouth he is walking at opens and medium when he drops through a
grate, and nothing for a bump against a shut mouth or for the gates
further on. A mouth follows the voice and a voice wavers, so an opening
is felt only after the mouth has been shut for a quarter of a second
(`runtime/mouth-tap.ts`): a tap for every flicker buzzes like a fault.

**Tested.** The unit tests pin the reduced break (no hitstop, slow
motion, shake or burst at any moment, and the same taps), the stage
under the setting and through a change mid-break, the preference
reader, and the mouth rule. The e2e breaks the Cabinet on Playwright's
held clock, so "the first frame after the crack" is one 16 ms step on
any machine: with the preference off that frame is held, shaken and
drawn at 1.0; under `reducedMotion: 'reduce'` it is none of those, the
canvas never changes size, and the four taps still arrive. The Line's
drop reaches `navigator.vibrate` as its 20 ms.

### 2.7 What 5d landed

**Measured first, and the half second was the microphone's.** 5a's
largest wait, `f0` at 530-550 ms in every world, was not the pitch
engine's. Chromium's fake microphone, which every headless run uses, is
silent but for a short beep every half second -- sound at 517, 1016 and
1520 ms after the stream opens -- and `f0` ends at the first detector
frame with any level in it: the first beep. Fed a continuous sung tone
instead (`--use-file-for-fake-audio-capture`), the same path takes 48 ms
in every world, and 43 of those are the first 2048-sample window filling
at 48 kHz, which nothing done before the microphone can shorten. `mic`
is 17 ms, a fake device with no prompt.

**Where a card tap's wait went before 5d.** The 5c build, production,
headless Chromium, 390 × 844 at DPR 3, the desktop GPU through ANGLE
(WebGL2), the median of three cold starts, each in a fresh browser, in
milliseconds:

| World    | scene | gpu | merc | glass | compile | draw | first | mic | f0  |
| -------- | ----- | --- | ---- | ----- | ------- | ---- | ----- | --- | --- |
| Cabinet  | 45    | 25  | --   | 13    | 123     | 36   | 251   | 17  | 48  |
| Hallway  | 43    | 25  | 24   | 11    | 124     | 41   | 278   | 17  | 48  |
| Chambers | 44    | 26  | 23   | 11    | 125     | 58   | 289   | 17  | 48  |
| Line     | 46    | 26  | 19   | --    | --      | 147  | 244   | 17  | 48  |

Merc's glb is the larger of the two files that load side by side after
`gpu`, so in every world he is in, he is the one the stage waits for.
The rest is the renderer's -- building the scene, `renderer.init()` and
the shader work (`compile`, `draw`) -- and it is 84-91% of `first`,
which P7 keeps per stage.

**The warm (P7).** When the games list is shown, once its first frame
has been painted and the page is idle -- `requestIdleCallback` with a
two-second ceiling, or a quarter of a second after the paint where
Safari has none (`runtime/warm.ts`) -- the list starts two things:
Merc's glb, fetched and parsed, and the pitch detector's worker. The
next `createMerc` takes that load instead of starting its own, and the
next F0 stream adopts the worker instead of spawning one
(`preloadF0Detector`, an additive export of the pitch engine). Each is
taken once: dressing Merc writes to the loaded scene, and a stream
terminates its worker when it ends, so neither can serve two. The list
warms again whenever a game hands it back, and lets go of what no game
took when it is left for Home. Nothing on the way asks for the
microphone or makes an audio context; the worker is told the sample
rate later, by message. There is still no ORT session to make -- the
stream is YIN -- so on this path the pitch model is that worker.
`?cold` in the address turns the warm off, so one build on one phone
gives both numbers.

**What it bought.** The 5d build on the same machine, warm and `?cold`
taken in turn run by run, so that a slow spell lands on both, the median
of five, in milliseconds:

| World    | merc, warm | merc, cold | first, warm | first, cold |
| -------- | ---------- | ---------- | ----------- | ----------- |
| Cabinet  | --         | --         | 255         | 250         |
| Hallway  | 8          | 26         | 272         | 295         |
| Chambers | 7          | 23         | 287         | 287         |
| Line     | 8          | 20         | 228         | 240         |

What remains of `merc` is dressing him: his materials, his size, his
wrapper. `first` moves by about as much in the Hallway and the Line,
and in the chambers in two runs of five (271 and 272, against 286-291
cold). From run to run `first` spreads by up to 60 ms on this machine,
more than the saving, and the Cabinet, which has no Merc, moves by that
spread alone. With the GPU in software (SwiftShader, the median of
three), where drawing holds the main thread, `merc` goes from 33-48 ms
to 7-10 and `f0` from 750-1030 ms to 450-670, in every world: the worker
the list started is up before the gate, and one spawned at the gate
comes up while the renderer has the thread. Neither machine is a phone;
the second shows what the warm is for when the main thread is the
bottleneck.

**It never touched the list's first paint.** In every run the list was
painted 9-17 ms after it mounted, with no long task in between, and the
warm began just after it, 11-20 ms after the mount: the worker spawned
and Merc's file was asked for in the first idle moment after the paint.
Even a tap as quick as Playwright's, the card clicked the moment the
list existed, found the warm under way (`merc` 7-9). A tap that beats
it loses nothing: the stage loads what it needs itself, as before.

**What it does not move.** `f0` stays at 47-48 ms, because on a desktop
the worker is up before the first window has filled; on a phone, where
a module worker's thread, fetch and parse all cost more, the spare is
the part that can show. The glass files load in the same slot as Merc
and could ride the same warm if the phone's `glass` says they are worth
it. The shader work cannot: it belongs to a WebGL context, and the list
has none -- a renderer made there would be a second context for the
page, which P7 ruled out.

**Measured where.** Headless on a desktop is not a phone. These numbers
say the warm works and where the rest of the wait sits; the number that
counts is `first` on the chip on the phones, with and without `?cold`,
and it goes in §2.3 with the gate.

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

**P1, answered by maff on 2026-09-11.** A Samsung Galaxy S22 or S23
would be the benchmark phone, and none is to hand. The gate is
therefore the Android tablet standing in for a mid Android, the iPhone
13 as the older iPhone (also measured in Low Power Mode), and the iPhone
15 as the ceiling. §2.3 marks every Android number as the tablet's.

**Everything else, answered by maff on 2026-09-11.** Proceed on the
defaults; ask only for big decisions the plan does not cover, or
blockers.
