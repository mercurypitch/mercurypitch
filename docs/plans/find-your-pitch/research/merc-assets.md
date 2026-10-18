# Merc as a production asset: inventory and production bible

Research for the MercuryPitch tutorial series (web lessons and YouTube explainers built
with HyperFrames). Repository: `/home/user/mercurypitch`, read only; nothing in it was
changed. Every experiment ran from the scratchpad:

- Probe bundle and scripts: `(session scratchpad, not kept)/merc-probe/`
  (`entry.ts`, `merc.iife.js`, `probe.html`, `probe.mjs`, `probe2.html`, `probe2.mjs`, `bench.mjs`, `score.mjs`)
- Rendered proofs: `(session scratchpad, not kept)/merc-probe/shots/`
  (`blue-idle-high.png`, `orange-idle-high.png`, `orange-celebrate-high.png`, `orange-hero-high.png`,
  `duo-sing.png`, `duo-lock.png`, `duo-orbit.png`, `duo-hop.png`, and others)

## 0. Headline findings

1. **The shipped Merc** (`src/lib/merc/`) is a raymarched SDF character in one WebGL2 fragment
   shader. It has a fixed-step physics sim (240 Hz) and twelve choreographed states. It has
   **no dependencies at all**: every import is relative and it uses only DOM, WebGL2 and
   `structuredClone`. It bundles to a **69.0 KB minified IIFE, 26.5 KB gzipped**, built with
   esbuild 0.28.2 in 20 ms.
2. **It renders deterministically in HyperFrames' own Chrome** (chrome-headless-shell
   152.0.7977.30, ANGLE on SwiftShader Vulkan). I proved this:
   - repeated renders produce the same PNG hash;
   - a film-level score of state changes renders bit-identically whether you play it forward
     frame by frame, jump to a frame cold, or jump back and forth (`score.mjs`: all three
     hashes `659e9adf969128fb`).
3. **The cost is pixels, not physics.** Seeking is nearly free: about 2 to 3 microseconds per
   sim step, so a cold jump to 60 s takes milliseconds after compile. On SwiftShader with
   4 cores, one frame costs:
   - 1080x1080 canvas: about 2.1 s at `medium` and 8.0 s at `high`;
   - 1920x1080 canvas: 3.5 s at `medium` and 12.8 s at `high`;
   - 720x720 canvas: 0.9 s at `medium` and 3.4 s at `high`.

   On a host GPU (`hyperframes render --browser-gpu`) the same frame takes about 1 ms. This
   is the single biggest production decision.

4. **Orange Merc does not exist anywhere in the repo.** No palette, file, character, plan or
   doc defines a second, warm, twin or companion Merc (see section 6). The only warm-Merc
   link is a Beside Cue token comment: `--orange #c93513` is "reserved for Merc and the
   score card" (`apps/beside-cue/docs/games/glass-3d-art.md:134`).
5. **The `setLook()` patch API alone makes a convincing orange Merc**, with no shader change
   and so no change to the pinned shader hash. I rendered it at `high` (section 1.6).
   Several effect colours are hard-coded cool blue in GLSL and stay blue: the floor glow
   pool, landing rings, sound arcs, droplets, the core glow, foot glints and the hop and
   arrow marks. Making those warm needs a shader change, which the shader hash test gates
   behind owner approval.
6. **Merc's voices are in three registers.** Two of them are ElevenLabs output. All three
   carry provenance receipts:
   - A saved spoken voice, "Merc V1 Gentle Whimsical D2" (`B4fBPRmasEsTgd6YlSok`,
     `eleven_v3`), with 9 shipped lines. It belongs to the Glassworks game.
   - Ten sung "ooh" samples, F2 to F5. They are dev placeholders: ElevenLabs takes,
     re-pitched.
   - A fully synthesized, code-owned "ooh", hum and lip-buzz voice in
     `src/lib/demo-audio.ts`. It is ideal for deterministic video audio.
7. **There are four different visual Mercs in the repo.** The series needs one canon host.
   I recommend the WebGL2 resin Merc: he is the most expressive, he is deterministic, the
   look is code the company owns, and he is already the premium-exercise host.

---

## 1. `src/lib/merc/`: renderer, states, API

### 1.1 Files

| File                                               | Lines | Role                                                                                                                                                                                                     |
| -------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/merc/renderer.ts`                         | 687   | `mount()`: canvas, WebGL2 context, live rAF loop or capture mode, bloom and rim post chain, context-loss handling                                                                                        |
| `src/lib/merc/constants.ts`                        | 213   | `STATES`, `SHAPE`, `PALETTE`, `LOOK`, `QUALITY`, `VIEWS`, `BG`, `BLOOM`, `RIM`                                                                                                                           |
| `src/lib/merc/sim.ts`                              | 686   | `Sim` class: fixed 240 Hz step, voice smoothing, lock tracking, particles, `pose()` uniforms, `snapshot()`/`restore()`                                                                                   |
| `src/lib/merc/sim-choreo.ts`                       | 628   | One choreography function per state (spring targets plus effects)                                                                                                                                        |
| `src/lib/merc/sim-glide.ts`                        | 81    | Pitch slope and hum presence for `hum`/`ride` (`RIDE` constants, `rideLean`)                                                                                                                             |
| `src/lib/merc/sim-springs.ts`                      | 101   | Spring table `[rest, Hz, damping]` for squash, lean, sway, melt, eyes, mouth, colour                                                                                                                     |
| `src/lib/merc/stage.ts`                            | 153   | `mountMercStage()`: the never-throws wrapper the app uses (live only)                                                                                                                                    |
| `src/lib/merc/gl.ts`                               | 398   | Programs, render targets (MRT scene+glow, 1/4 and 1/8 bloom), `cameraFor()`, `paletteUniforms()`, `lookUniforms()`                                                                                       |
| `src/lib/merc/scene-shader*.ts`, `post-shaders.ts` | ~1100 | GLSL text, byte-for-byte the "pass 4 study"; hashes pinned                                                                                                                                               |
| `src/lib/merc/rest-space.ts`                       | 245   | Rest-space warp, eye placement                                                                                                                                                                           |
| Tests                                              |       | `stage.test.ts` (fake GL: lifecycle and leaks), `scene-shader.test.ts` (SHA-256 of every GLSL program), `sim.test.ts`, `sim-glide.test.ts`, `sim-pinned.test.ts` (pose hashes of the 10 approved states) |

The only consumer in the codebase is `src/components/room-kit/MercView.tsx`. It lazy-imports
`@/lib/merc/stage`. Nothing in the repo calls `mount()` directly, uses `capture: true` or
calls `renderAt`. The header comment of `renderer.ts:7` says capture mode exists "for tests
and store art", but no script or test uses it. `stage.test.ts:6` says "Pixels are proved
separately, in a real browser"; that proof is not in the repo. I found no script that
captures Merc frames: grepping `scripts/` for `renderAt` and `capture: true` finds nothing
Merc-related.

### 1.2 The twelve states (`constants.ts:13-27`, `sim-choreo.ts`)

| State       | What it looks and does like (from the choreography code)                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Reads voice?               | Loop / timing    |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------- | --------------------------------------------------------------------- | ---------- |
| `drop`      | Falls in from y = 1.75 (DROP_Y0) over 0.55 s, stretched (sq up to 1.32), speed lines and two ghost echoes above him, looking down, smiling. Lands as a **splat**: driven flat to sq 0.58 within 0.06 s and held 0.24 s, then rebounds through a stretch. Splash of 4 droplets, floor ring, happy closed eyes and grin for 0.4 s, then idle breath from 1.2 s.                                                                                                                                                    | no                         | one-shot         |
| `idle`      | Breathes (sq +-0.02, 2.8 s), sways (lean 0.025, 5.6 s), blinks at 1.1/3.9/4.18/6.6 s, glances left (2.2-3.1 s) and right (5.0-5.9 s).                                                                                                                                                                                                                                                                                                                                                                            | no                         | 8 s loop         |
| `listen`    | Leans in (lx 0.24, lz 0.06, yaw -0.2) with one eye closed (right eye shut after 0.25 s), looks to his side, smiles; **sound arcs come in** at his side.                                                                                                                                                                                                                                                                                                                                                          | level -> arc intensity     | 6 s blink loop   |
| `sing`      | **Follows the voice.** `pn = cents/700` stretches him up (sq +0.12 pn), lifts the root (ry 0.05 pn) and leans him back. Deviation from the nearest of 0 or 700 cents leans him sideways (lx 0.11 dev). Hue shifts up the gradient (`hue = pn*1.5-0.2`). The mouth "O" opens with level (`0.2 + level`). Ripple grows with level and unsteadiness. He looks up with pitch and glows 0.25 x level. Reaching fast up a glide (rate > 220 cents/s), he squeezes his eyes into curved lids. Sound arcs on both sides. | cents, level, steady, rate | continuous       |
| `lock`      | In tune: the glow builds over a 1.4 s time constant while the lock holds. The eyes close happily after 0.45 s locked; the mouth opens with level. On engage he squashes and sends a floor ring plus a ripple wave, then a floor ring every 1.15 s.                                                                                                                                                                                                                                                               | lock state (`              | cents            | <30`, steady > 0.72 for 0.12 s; let go after 0.15 s outside 50 cents) | continuous |
| `climb`     | 3.2 s loop: crouch, rise 0.2 off the floor to a hover with a stretch, a 3-echo ghost trail below, an arrow curving up at his side, hue shift, then settle.                                                                                                                                                                                                                                                                                                                                                       | no                         | 3.2 s loop       |
| `celebrate` | Crouch 0.15 s, ballistic jump 0.43 s (apex about a fifth of his height), landing squash with a splash, closed happy eyes, grin. **Sparkles** (gold and white four-point stars) every second jump.                                                                                                                                                                                                                                                                                                                | no                         | 0.8 s loop       |
| `point`     | After 0.28 s he extends his **nub** (a small arm), looks toward it, yaws 0.16, and sends sound arcs from the nub tip; the nub pulses every 2.4 s.                                                                                                                                                                                                                                                                                                                                                                | no                         | 2.4 s loop       |
| `sleep`     | Melts low (melt 0.14, sq down 0.34), sleepy closed eyes (down-arcs), slow ripple.                                                                                                                                                                                                                                                                                                                                                                                                                                | no                         | settles in 1.3 s |
| `hop`       | Hops between floor stops at x = -0.38, 0, 0.38 in 0.75 s slots: crouch, a 0.41 s arc, landing squash, a dotted arc to the next stop, two ghost echoes, floor stop rings.                                                                                                                                                                                                                                                                                                                                         | no                         | 3.0 s loop       |
| `hum`       | Mouth closed and smiling, turned a little (yaw -0.14), eyes to the side. A fan of soft **sound rings** leaves his face while the voice sounds; glow follows level; faint buzz ripple. `still` freezes the rings; `rings:false` turns them off.                                                                                                                                                                                                                                                                   | env (presence), level      | continuous       |
| `ride`      | `hum`, plus he **leans with the sung pitch's slope**: upright under 0.8 semitones/s, full lean 0.17 from 6 st/s, eyes going with it (`sim-glide.ts:33-46`).                                                                                                                                                                                                                                                                                                                                                      | midi slope                 | continuous       |

Under reduced motion, rooms map `drop` to `idle` and `celebrate` to `lock`
(`merc-moves.ts:33-36`). The pins: `sim-pinned.test.ts` hashes the poses of the 10
pre-glide states, so a new state cannot move a pixel of the approved ones.

### 1.3 `mount()` API (exact signatures, `renderer.ts:29-99`)

```ts
export function mount(
  container: HTMLElement,
  opts: MercMountOptions = {},
): MercRenderer

export interface MercMountOptions {
  quality?: MercQuality // 'low' | 'medium' | 'high' | 'ultra'; default 'high'
  transparent?: boolean // premultiplied alpha; page shows through, floor light adds onto it
  capture?: boolean // no loop: renderAt(t) draws exactly t s after the last setState
  continuous?: boolean // with capture: setState is a soft transition (springs, particles, lock carry over)
  size?: number // fixed CSS px (square); 0 = follow container (ResizeObserver)
  pixelRatio?: number // default min(2, devicePixelRatio)
  view?: MercViewName | MercView // default 'front'
  state?: MercState // default 'idle'
  voiceAt?: MercVoiceSource | null // (t) => MercVoice, t = seconds since last setState
  sparkles?: SparkleSide // 'around' | 'right' | 'left'
  still?: boolean // reduced motion for hum/ride
  rings?: boolean // hum/ride sound rings, default true
  onFailure?: (error: Error) => void
}

export interface MercRenderer {
  readonly canvas: HTMLCanvasElement
  readonly state: MercState
  readonly time: number
  readonly ok: boolean
  readonly look: MercLook
  setState(name: MercState): void
  reset(name: MercState): void
  setVoice(voice: MercVoice): void
  setVoiceSource(source: MercVoiceSource | null): void
  setPoseBias(bias: Partial<PoseBias>): void // { yaw, lookX, lookY } on top of the choreography
  setLook(patch: MercLookPatch): void
  setQuality(name: MercQuality): void
  setView(view: MercViewName | MercView): void
  setPaused(paused: boolean): void
  setStill(still: boolean): void
  renderAt(t: number): void
  destroy(): void
}

export interface MercLookPatch extends Partial<MercLook> {
  stops?: readonly GradientStop[] // [height 0..1, '#rrggbb'][], up to GRAD_N = 12
  bead?: readonly [deep: string, light: string] // feet
  rim?: number // silver rim strength, default 0.5
}
```

`mountMercStage(container, opts): MercStage` (`stage.ts:75`) is the app wrapper. It is live
only, defaults to `quality: 'medium'`, never throws, and exposes only `setState`,
`setVoice`, `setPaused`, `setStill` and `destroy`. **It does not expose capture,
`setLook`, `setView` or `setPoseBias`. Video work must use `mount()` directly.**

WebGL context attributes (`renderer.ts:124-132`):

```ts
canvas.getContext('webgl2', {
  alpha: transparent,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: capture,
  powerPreference: 'high-performance',
})
```

So capture mode already sets `preserveDrawingBuffer: true`, and `renderAt` ends with
`gl.finish()`. Screenshot capture works without any change.

### 1.4 Capture mode semantics (`renderer.ts:553-646`)

- **Plain capture** (`capture: true`): `setState(name)` is a **hard reset** (`sim.reset`).
  `renderAt(t)` steps the sim to `round(t / STEP)` steps after that reset. Going back resets
  and replays from 0. Each state starts fresh, with no carried springs.
- **Continuous capture** (`capture: true, continuous: true`): `setState(name)` is a soft
  transition at the current sim time. It also sets `voiceT0` and stores a snapshot, so
  `renderAt(t)` measures t from the last `setState` and a backward seek restores the
  segment snapshot. `reset(name)` is the hard restart to time 0.
- **Determinism**: "the same state, voice and step count give the same pose to the last
  bit" (`sim.ts:5-8`). The comment warns that even reordering float arithmetic moves pixels.
  The final composite applies an ordered dither seeded only from `gl_FragCoord`
  (`post-shaders.ts`), so the dither is deterministic too.

Measured costs (`bench.mjs`): a cold jump to 60 s (14,400 steps) plus the first 64 px
draw, including the first shader compile, took 3,982 ms. A backward jump to 30 s (7,200
steps re-simulated) plus a draw took **22 ms**. Simulation is effectively free; shader
compile and pixels dominate.

### 1.5 Views and camera (`constants.ts:176-203`, `gl.ts:91-103`)

```ts
interface MercView {
  yaw: number
  pitch: number
  dist: number
  target: Vec3
  fov: number /* vertical, deg */
}
VIEWS = {
  front: { yaw: 0, pitch: 0.13, dist: 4.2, target: [0, 0.67, 0], fov: 30 },
  hero: { yaw: 0.34, pitch: 0.15, dist: 4.1, target: [0, 0.63, 0], fov: 30 },
  threequarter: {
    yaw: 0.79,
    pitch: 0.13,
    dist: 4.2,
    target: [0, 0.67, 0],
    fov: 30,
  },
  side: { yaw: 1.5708, pitch: 0.13, dist: 4.2, target: [0, 0.67, 0], fov: 30 },
}
```

`setView()` takes **any** `MercView` object, so the camera is a real 3D orbit and dolly
camera you can animate per frame: yaw, pitch, distance, target and fov. Bloom tap spacing
and rim width rescale with pixels per world unit (`renderer.ts:331-335`), so the halo holds
at every framing. I verified a custom close orbit (`yaw -0.55, dist 3.2, fov 34`) and a
high wide one (`yaw 0.55, pitch 0.32, dist 5.2, fov 26`) in `shots/duo-orbit.png`. Idle Merc
fills about 56% of frame height in `front`, with headroom for jumps. `setPoseBias({ yaw,
lookX, lookY })` turns him and aims his eyes, for example to look at an on-screen note.
One artefact: at strong yaw in `point`, the near eye dome overlaps the nub silhouette
(visible in `duo-orbit.png`, left). Frame `point` near `front`/`hero`.

The canvas does not have to be square. Without `size` it follows the container's width and
height, and the camera's vertical fov holds the scale. Opaque mode paints `BG = #0d1117`,
which is hard-coded (`constants.ts:206`). Transparent mode lets the page colour show.

### 1.6 Look and palette: making an ORANGE Merc

`setLook(patch)` (`renderer.ts:617-637`) patches, as uniforms with no recompile:

- the `MercLook` light model (`constants.ts:131-149`): `edge`, `edge2`, `crown`,
  `shoulder`, `k` (`[crownStreak, shoulderStreak, edgeWhitenTop, leftKey]`), `tint`
  (streak colour) and `tint2` (low edge whitening);
- the palette `stops` (11 used, `GRAD_N = 12`) and `bead` (the feet);
- `rim` strength.

The blue palette (`constants.ts:98-113`) runs teal `#04ecd8` (base), through `#129e9b`,
`#1a73b1`, `#0062d0`, `#016be5`, `#105eec`, `#2747f0` and `#5133f3`, to violet `#8841f5`
and `#be6cf5` (crown). Feet are `#0566aa` / `#16b2e4`; the tint is `#f6f2ff`; tint2 is
`#64cbfa`.

**Proposed "Ember" orange Merc (rendered and verified; `shots/duo-*.png` right figure):**

```ts
const EMBER: MercLookPatch = {
  stops: [
    [0.0, '#ffd84f'],
    [0.136, '#ffcc45'], // custard base (Beside Cue --custard #f2c84b family)
    [0.232, '#ffad33'],
    [0.328, '#ff9126'],
    [0.424, '#ff7a1f'],
    [0.52, '#ff6a1a'], // saturated orange belly (stats accent #ff7448 family)
    [0.616, '#f2541a'],
    [0.712, '#e2431a'],
    [0.808, '#c93513'], // Beside Cue --orange exactly
    [0.904, '#d6304a'],
    [1.0, '#ef5a86'], // rose crown: the hue turns away at the tip, as blue's turns violet
  ],
  bead: ['#a83a12', '#ff9d3a'],
  tint: '#fff1dc', // warm-white streaks
  tint2: '#ffc864', // low edge whitens toward gold instead of sky blue
  k: [1.25, 1.45, 0.55, 0.0], // left key light OFF: it is a hard-coded sky blue vec3(0.22,0.55,1.0)
}
```

Contrast of each stop against `#0d1117` (WCAG relative luminance):

|       | Lowest stop       | Highest stop      |
| ----- | ----------------- | ----------------- |
| Blue  | `#5133f3`: 2.81:1 | `#04ecd8`: 12.6:1 |
| Ember | `#c93513`: 3.61:1 | `#ffd84f`: 13.7:1 |

The orange Merc reads at least as well as the blue one on the app background. Hue runs
47 deg at the base to 342 deg at the crown; the blue runs 175 to 276 deg. That keeps the
"light base, deep middle, turned tip" structure, mirrored on the warm side. An earlier
variant with `#ff7448` exactly at 0.52 (`shots/orange-*.png`) read more peach and coral. The
saturated `#ff6a1a` belly reads as "orange" more clearly. Keep `#ff7448` as Ember's
UI/accent partner colour. When he sings, `uColor.x` shifts the gradient lookup up by up to
0.16, so higher notes read redder and rosier. That is semantically nice: higher pitch looks
warmer.

**What stays cool blue no matter what you patch.** These colours are hard-coded GLSL
constants:

| Effect                           | Location                        | Colour                                                                    |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------------- |
| Floor glow pool and foot streaks | `scene-shader-surface.ts:27-33` | aqua and blue                                                             |
| Landing and lock floor rings     | `:35-36`                        | `vec3(0.3,0.85,1.0)`                                                      |
| Hop stop rings                   | `:42`                           | blue                                                                      |
| Droplets                         | `:208`                          | `vec3(0.12,0.72,0.78)`                                                    |
| Core glow                        | `:237`                          | teal `vec3(0.02,0.34,0.28)`; it reads as warm white on orange, acceptable |
| Nub glow                         | `:241`                          | blue                                                                      |
| Foot glints                      | `:260-261`                      | pale blue                                                                 |
| Sound arcs                       | `scene-shader-frame.ts:63`      | `vec3(0.62,0.78,1.0)`                                                     |
| Hop dots                         | `:90`                           | blue                                                                      |
| Speed lines                      | `:105`                          | blue                                                                      |
| Climb arrow                      | `:139,148`                      | blue                                                                      |
| Ghost outline highlight          | `:126`                          | ghost uses `gradAt`, but mixes 45% toward pale blue                       |
| Sparkles                         | `:79`                           | already gold and white: neutral, fine for both                            |

On Ember Merc the teal floor pool under him is the most visible mismatch
(`orange-celebrate-high.png`, `duo-hop.png`), followed by the pale-blue arcs and rings.
Arguably the arcs and rings could stay as a shared "sound" colour. **Proper fix:** promote
these to uniforms, for example `uAccent` (floor, rings, arcs, dots, arrow) and `uCoreTint`,
with defaults equal to today's constants. Then prove that blue renders pixel-identical
before and after, get owner sign-off, and update the hashes in `scene-shader.test.ts`. The
test says explicitly (`scene-shader.test.ts:43-46`): "render the before and after, get the
new look approved, then update the hash; never update it just to make this test pass."
Interim workaround for video: keep Ember in `transparent` mode and frame him so the floor
pool is cropped or covered by the set's own floor plane. Do **not** use a CSS
`hue-rotate` filter on the whole canvas: it would also tint the catchlights and the ink,
and the result is uncontrolled.

### 1.7 Voice input: how Merc reacts to pitch (`sim.ts:33-49`, `383-444`, `675-686`)

```ts
export interface MercVoice {
  voiced: boolean
  cents: number /* from target */
  level: number /* 0..1 */
  steady: number /* 0..1 */
  midi: number /* fractional sung pitch */
}
export type MercVoiceSource = (t: number) => MercVoice // t = seconds since last setState
```

On each 240 Hz step the sim smooths the voice:

- level, voicing and steadiness over 45 ms;
- cents over 60 ms;
- the cents rate (cents per second) over 100 ms;
- `stepGlide`: the sung midi eased over 60 ms, its slope in semitones per second over
  0.2 s, and a jump guard of 2.5 st;
- the hum presence `env` over 0.12 s.

It also tracks the lock. Each state then reads what it needs; see the table in 1.2. A pure
`voiceAt(t)` keeps capture deterministic: no `setVoice` pushes are needed.

How the rooms build the voice, for example `src/features/long-note/useLongNoteController.ts:372-382`:

```ts
voice = {
  voiced: step !== null && step.offCents !== null,
  cents,
  level: levelFromRms(step?.level ?? 0),
  steady: 1 - Math.min(1, Math.abs(cents) / rules.tolCents),
  midi: target + cents / 100,
}
```

For video, author one contour, a list of `{ t, cents, level }` points (the demo-kit
`DemoVoicePoint` / `VoicePoint` shape). Then:

- feed it to `playVoiceContour` to render the audio;
- feed the same contour to `voiceAt` to drive Merc;
- result: picture and sound are exactly in sync, with no pitch detection in the loop.

### 1.8 Sparkles

`sparkle()` (`sim.ts:359-376`) places 7 four-point stars, gold `vec3(1,0.78,0.38)` and
white `vec3(0.78,0.9,1)`, around him at fixed angles. Delays run 0 to 0.24 s, each lives
about 1.2 s, and they twinkle at 17 rad/s. `sparkles: 'right' | 'left'` fans them all to
one side (`SPARKLES_RIGHT`, mirrored for left). That keeps them off whatever stands on his
other side, which is ideal for a two-Merc shot. They fire only in `celebrate`, on every
second jump.

### 1.9 Quality tiers (`constants.ts:165-170`)

| Tier   | Scale | Samples per px   | March steps | Edge AA | Desktop GPU at 1024 px | SwiftShader, 1080 sq canvas (measured) |
| ------ | ----- | ---------------- | ----------- | ------- | ---------------------- | -------------------------------------- |
| low    | 0.5   | 1                | 48          | yes     |                        | 1.04 s/frame (540 px internal)         |
| medium | 0.75  | 1                | 64          | yes     | 0.25-0.29 ms           | 2.07 s/frame (810 px)                  |
| high   | 1.0   | 4 (rotated grid) | 96          | no      | 0.75-1.09 ms           | 7.97 s/frame                           |
| ultra  | 1.0   | 9 (3x3)          | 128         | no      |                        | 20.2 s/frame                           |

---

## 2. Rendering Merc deterministically inside HyperFrames

### 2.1 Environment facts (verified)

- HyperFrames 0.8.97 is installed at `/root/.npm/_npx/f293411582888030/node_modules/hyperframes`.
  Its Chrome is `/root/.cache/hyperframes/chrome/chrome-headless-shell/linux-152.0.7977.30/`.
- HyperFrames' browser GPU args (`dist/chunk-H7EMX7GA.js:1460-1490`): mode `software` and
  mode `auto` both use `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
  Linux hardware mode uses `--use-angle=gl-egl --ignore-gpu-blocklist`. The CLI flag is
  `--browser-gpu` (force host GPU) or `--no-browser-gpu` (force SwiftShader). Distributed
  (lambda) renders assert SwiftShader for pixel-identical retries.
- Under those flags WebGL2 works: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device
(Subzero)), SwiftShader driver)`, with `MAX_FRAGMENT_UNIFORM_VECTORS` = 4096.
- Merc needs WebGL2 core features only, all supported by SwiftShader:
  - `texStorage2D RGBA8`;
  - MRT (two colour attachments plus `drawBuffers`);
  - `texelFetch`;
  - large uniform arrays.

  He needs no float textures and no extensions; `WEBGL_lose_context` is used only in
  `destroy`.

- No app stores, Solid, network or audio are involved. Capture mode never starts rAF:
  `syncLoop` returns when `!live`. The `visibilitychange` listener is added only in live
  mode. A `ResizeObserver` exists only when `size` is 0. Capture mode is therefore free of
  timers and HyperFrames-safe.

### 2.2 Recipe

**Step 1: bundle (one command, no repo change).**

```bash
# entry.ts (outside the repo)
#   import { mount } from '/home/user/mercurypitch/src/lib/merc/renderer'
#   import { PALETTE, LOOK, STATES, VIEWS } from '/home/user/mercurypitch/src/lib/merc/constants'
#   ;(window as any).Merc = { mount, PALETTE, LOOK, STATES, VIEWS }
/home/user/mercurypitch/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/bin/esbuild entry.ts \
  --bundle --format=iife --target=es2022 --minify --outfile=assets/vendor/merc.iife.js
```

Output: 70,690 bytes (26,472 gzip). Pin it like GSAP in `assets/vendor/`, and record the
repo commit it was built from. The shader is pinned by hash, so a rebuild either matches or
signals a look change.

**Step 2: a film-level score wrapper (verified bit-identical in `score.mjs`).** The
renderer's own `renderAt(t)` measures from the last `setState`. A film needs a whole
timeline of cues, so wrap continuous capture:

```js
function mercFilm(host, score, opts) {
  // score: [{ at: 0, state: 'drop' }, { at: 1.4, state: 'idle' }, ...]
  const r = Merc.mount(host, {
    ...opts,
    capture: true,
    continuous: true,
    state: score[0].state,
  })
  let seg = 0
  const segOf = (T) => {
    let i = 0
    while (i + 1 < score.length && score[i + 1].at <= T) i++
    return i
  }
  const bindVoice = (i) =>
    opts.voiceTrack && // film-time voice, re-based per segment
    r.setVoiceSource((t) => opts.voiceTrack(score[i].at + t))
  bindVoice(0)
  function frame(T) {
    const want = segOf(T)
    if (want < seg) {
      r.reset(score[0].state)
      seg = 0
      bindVoice(0)
    }
    while (seg < want) {
      r.renderAt(score[seg + 1].at - score[seg].at) // land exactly on the cue (one throwaway draw)
      seg++
      r.setState(score[seg].state)
      bindVoice(seg)
    }
    r.renderAt(T - score[seg].at)
  }
  return { frame, renderer: r }
}
```

Each worker's cold start re-simulates from 0. That costs milliseconds plus one throwaway
draw per cue crossed. Forward playback crosses each cue once.

**Step 3: bind to the GSAP timeline so it updates even on suppressed seeks.** The
HyperFrames runtime seeks with `totalTime(t, false)` on some paths and `seek(t, true)` on
others (`dist/chunk-M5YNZQXZ.js`, runtime IIFE). Callbacks such as `onUpdate` are suppressed
when `suppressEvents` is true. Tween **values** are always applied. So drive Merc from a
setter target, not a callback:

```js
const tl = gsap.timeline({ paused: true })
const blue = mercFilm(document.querySelector('#merc-blue'), BLUE_SCORE, {
  quality: 'high',
  size: 720,
  pixelRatio: 1,
  transparent: true,
  view: 'hero',
})
const clock = {
  _t: -1,
  t(v) {
    if (v === undefined) return this._t
    if (v !== this._t) {
      this._t = v
      blue.frame(v)
    }
  },
}
tl.fromTo(
  clock,
  { t: 0 },
  {
    t: FILM_SECONDS,
    duration: FILM_SECONDS,
    ease: 'none',
    immediateRender: true,
  },
  0,
)
window.__timelines['lesson-01'] = tl
blue.frame(0) // compile and warm up at load (first SwiftShader compile is seconds)
```

GSAP treats a function-valued property as a getter/setter. For sub-compositions, map film
time to local time with `(t - start) * speed`, as `three-js-patterns.md` prescribes.

**Step 4: camera moves.** Animate a `MercView` object with GSAP and call
`renderer.setView({...view})` inside `frame()` before `renderAt`. Or keep the canvas fixed
and move or scale its wrapper with CSS transforms, as Long note does: `transform-origin:
50% ${MERC_FEET*100}%`. Do **not** animate the container's CSS width or height with
`size: 0`: every size change rebuilds six render targets.

**Step 5: render.**

- Draft: `npx --yes hyperframes@0.8.97 render --quality draft --fps 30` with Merc at
  `medium`.
- Delivery: `high`, on a GPU host with `--browser-gpu`.
- Always pass `pixelRatio: 1` and an explicit `size`. With `--resolution 4k` HyperFrames
  raises `deviceScaleFactor`, and Merc's default `min(2, devicePixelRatio)` would silently
  double the internal resolution and quadruple the cost.

### 2.3 Render-time budget (measured, SwiftShader, 4 cores; `bench.mjs`)

| Canvas    | low    | medium | high   | ultra  |
| --------- | ------ | ------ | ------ | ------ |
| 720x720   | 0.44 s | 0.91 s | 3.36 s | 6.94 s |
| 1080x1080 | 1.04 s | 2.07 s | 7.97 s | 20.2 s |
| 1920x1080 | 1.53 s | 3.49 s | 12.8 s | 30.8 s |

A 10-minute explainer at 30 fps with Merc on screen half the time is 9,000 Merc frames.
That is about 2.3 h at medium/720 and 8.4 h at high/720 on SwiftShader. Parallel workers
help less than core count suggests, because SwiftShader already uses all cores. **Decision:**
use SwiftShader only for drafts and CI proof frames, and render delivery on a GPU host (the
repo has a `runpod/` directory). Alternatively, cache Merc frames: each frame is a pure
function of (score, look, view, quality, size, t), so an offline pre-pass can store them.

### 2.4 Alpha and compositing caveat

In `transparent` mode the bloom halo and floor light are **additive premultiplied colour
at alpha 0**. They composite correctly inside Chrome over any page background. In a
straight-alpha export they are lost or garbled: PNG un-premultiplies, and ProRes 4444 `mov`
or PNG-sequence output loses glow where alpha is 0. `blue-hero-transparent.png` shows this:
the halo is gone. **Composite Merc inside the HyperFrames page. Do not export him as an
alpha plate for an NLE.** If plates are unavoidable, render opaque on the final background
colour.

### 2.5 Two Mercs in one shot

Each `mount()` is one canvas and one WebGL2 context; Chrome allows about 16. Two Mercs
means two canvases layered by DOM z-order. They cannot occlude each other in depth or
share a floor shadow. Their glows simply add. `shots/duo-sing.png` and `duo-lock.png` show
blue (sing) and Ember (listen, lock) side by side at `high`, transparent, 640 px each. Use
`sparkles: 'left'/'right'` to keep each one's stars off the other. Pad each canvas so the
bloom is not clipped at its edge.

---

## 3. Room choreography: `MercView.tsx`, `merc-moves.ts`

- `src/components/room-kit/MercView.tsx`:
  - mounts the stage once (lazy chunk), with `transparent: true, quality: 'medium'`;
  - pushes `props.voice()` every rAF and hands `setState` over on change;
  - is `aria-hidden`.
- **Feet anchor** (`MercView.tsx:20-27`): `MERC_FEET = 0.81`, the share of canvas height
  from the top where his feet touch the floor in the `front` view. The floor point under
  his centre is at 0.789; the fronts of his feet are at about 0.81. Rooms place the canvas
  with `top = feetY - size * MERC_FEET`, `left = feetX - size/2`. This holds only for
  `front`; any other view needs its own anchor, computed by projecting `(0, 0, 0.2)`
  through `cameraFor(view)`.
- **Sizes per room** (canvas square, in each room's layout unit W):

  | Room      | Size                                            | Source                                      |
  | --------- | ----------------------------------------------- | ------------------------------------------- |
  | Echo      | 0.46 W, on the roof ridge seat                  | `EchoMerc.tsx:19`                           |
  | Lip roll  | 0.48 W                                          | `bay-layout.ts:25`                          |
  | Ng slides | 0.36 W                                          | `bridge-layout.ts:19`                       |
  | Long note | 210 lantern-view units, 0.7x inside the lantern | `stage-layout.ts:19`, `LongNoteRoom.tsx:92` |

- **`createMercMoves`** (`src/components/room-kit/merc-moves.ts`):
  - `state`, `place` ('beside' | 'inside');
  - `set`, `put`, `hopTo(place, then)`: the `hop` state plus a 650 ms CSS transform
    (`.mercHop { transition: transform 650ms cubic-bezier(0.3, 0.7, 0.3, 1) }`), then
    `then`;
  - `move`, `mood` (ignored while cheering);
  - `cheer()`: celebrate for `CHEER_MS = 1600` ms, two jumps, then `afterCheer()`;
  - `stopCheering`.

  It starts in `drop`. A change counter makes sure a stale scheduled landing never
  overwrites a newer state.

- Lip roll: `bay-ride.ts`. Merc **surfs the sung pitch at the playhead**: on the crest when
  on pitch, sunk into the wave when flat, lifted when sharp. His feet ease with
  `RIDE_TAU_SEC = 0.08`, and `RIDE_STATES` maps
  `intro: hum, countIn: listen, waveVoiced/waveQuiet: ride, breath: idle, waveLit: lock,
result: idle, resultBest: celebrate`. `merc-ahead.ts` predicts where he will ride, so
  demo tooltips avoid him. Ng slides works the same way (`bridge-ride.ts`): Merc rides the
  arch and `resultAllLit: celebrate`.

---

## 4. Voices and lines

### 4.1 Sung "ooh" sample set (Echo)

- Files: `src/features/echo/voice/echo-merc-ooh-{41-F2,45-A2,49-Cs3,53-F3,57-A3,61-Cs4,65-F4,69-A4,73-Cs5,77-F5}.mp3`.
  There are ten of them, each 25,772 bytes and a major third apart.
- `src/features/echo/merc-voice-set.ts:5-10`: "the 13 Oct sampler set ... each carrying the
  demo's vibrato (5.5 Hz, +-14 cents, grown in over 0.35 s) ... They are **development
  placeholders, ElevenLabs takes re-pitched onto exact contours**; the store build waits for
  real recordings."
- Each file is at -18 LUFS, with a per-sample `levelDb` of +0.4 to +3.2 dB. Timing:
  `SAMPLE_ONSET 0.02`, `SAMPLE_SUSTAIN_START 0.06`, `SAMPLE_SUSTAIN_END 1.36`.
- `sampleFor(midi)` shifts at most 2 semitones, so the reach is MIDI 39-79 (D#2-G5).
  `merc-sampler.ts` implements crossfades, priming-silence detection and synth fallback
  (`SYNTH_CALL`) when a note is out of reach, too long, or not yet loaded.
- The owner decided on "Merc with vibrato" for calls (13 Oct 2026, decision V1, per
  `merc-sampler.ts:6`).

### 4.2 Synthesized Merc voice (demo-kit), fully code-owned

- `src/lib/demo-audio.ts:421` `playVoiceContour(ctx, points: VoicePoint[], options: VoiceContourOptions): DemoSound`.
  - The waveform is a periodic wave with partials
    `OOH_PARTIALS = [0, 1, 0.62, 0.38, 0.24, 0.14, 0.08, 0.045, 0.025]`, then a lowpass.
  - Timbres: `ooh` at 2600 Hz, Q 0.5; `hum` at 950 Hz, Q 0.9.
  - Envelope: attack 0.09 s, release 0.18 s, peak 0.3.
  - Optional vibrato `{hz, cents, rampSec}`.
  - Optional lip buzz `LIP_FLUTTER = { hz: 25, depth: 0.85 }`, a rounded-sawtooth gain
    flutter with loudness makeup from `flutterMakeup()` (+4.0 dB).
- `src/components/demo-kit/demo-sound.ts`: `createDemoSoundtrack(ctx, minLead, vibrato, timbre?, flutter?)`
  wraps the reference tone (Hear button) and Merc's take on one bus.
- Room soundtracks:
  - Lip roll: `src/features/lip-roll/demo/demo-sound.ts`, `'ooh'` plus `LIP_FLUTTER` and the
    count-in root tone;
  - Ng slides: `'hum'` timbre;
  - Echo: vibrato.
- For video: this voice renders offline in an `OfflineAudioContext`. Every node it uses is
  available there; the TS signatures say `AudioContext`, so a cast is needed. Output is
  sample-exact and deterministic, it comes from the same contour that drives `voiceAt`, and
  it has no licence question.

### 4.3 Spoken narration (Glassworks, not the premium rooms)

`packages/glass-game/src/browser/merc-narration.ts` plays cue clips. The cue map
(`:26-36`) maps `tutorial-note`, `required-break`, `optional-break`, `beautiful-mess`,
`little-disaster`, `sparkling`, `glass-had-plans`, `music-to-my-ears` and
`cracking-performance` to `merc-voice-*` assets. The clips are **recorded TTS**:

- `apps/beside-cue/public/games/adventure-voice-v1/`: `merc-d2-welcome.mp3` ("A little note
  can break glass."), `merc-d2-path-open.mp3` ("Beautiful. A new path is open.") and
  `merc-d2-optional-break.mp3` ("Gorgeous. Absolutely gorgeous."). The manifest records the
  source path, bytes and SHA-256 of each.
- `apps/beside-cue/public/games/adventure-voice-v2/`: six reactions:
  - "Another beautiful mess."
  - "A little note. A lovely little disaster."
  - "That was positively sparkling."
  - "That glass had plans. So did you."
  - "Music to my ears. Confetti to my feet."
  - "Now that was a cracking performance."

  Manifest fields: `"voiceId": "B4fBPRmasEsTgd6YlSok"`, `"model": "eleven_v3"`.

- Provenance (`art/glass-adventure/voice/`):
  - `v1/README.md`: four Voice Design directions (A Warm Nimble, B Bright Playful,
    C Grounded Wry, D Gentle Whimsical) made with `/v1/text-to-voice/design`,
    `eleven_ttv_v3`. "No cloning is used." Each candidate was verified by Whisper ASR and
    checked for zero clipping, at -24.4 to -23.3 LUFS.
  - `RUNTIME.md` and `v3/README.md`: the owner chose D2 on 2026-09-20. The saved permanent
    voice is "Merc V1 Gentle Whimsical D2", `B4fBPRmasEsTgd6YlSok`.
  - `v4/README.md`: the six reactions; raw output is 24 kHz PCM; the 44.1 kHz request
    returned 403.
  - `v6-melody-phrases`: sung phrases. The ElevenLabs timbre is mapped by a WORLD vocoder
    onto authored contours; 88 of 117 variants shipped.
  - `v7-songbook`: a Music v2.5 guide plus Voice Changer. Pitch failed the detector, so
    those takes were rejected as lesson references.
- Voice D brief (`v1/batch.json`): "Soft and androgynous with a clear intimate register,
  gentle warmth, quiet wonder and an easy unhurried rhythm. Lightly melodic and
  whimsical ... A friendly encouraging coach, never wispy, sleepy, childish, squeaky,
  shrill, announcer-like or imitative."
- Lip sync: `packages/glass-game/src/browser/speech-envelope.ts` turns a decoded clip into
  20 ms RMS frames (`createSpeechEnvelope`, `speechEnvelopeAt`). It is exactly what a video
  needs to drive Merc's mouth from narration. Feed it as `level` to the `sing` state with
  `cents: 0`, `steady: 1`: the mouth opens and closes with no stretch.
- **Licence:** the repo documents provenance, ElevenLabs endpoints and the owner's
  selection. It does **not** document the ElevenLabs plan or the commercial-use terms
  (grepping the voice READMEs for licen, commercial, rights or terms finds nothing).
  Confirm the plan's commercial rights before using the voice on YouTube.

### 4.4 Written lines and tone

There are four `merc-lines.ts` tables:

- `src/features/long-note/merc-lines.ts`
- `src/features/echo/merc-lines.ts`
- `src/features/lip-roll/merc-lines.ts`
- `src/features/ng-slides/merc-lines.ts`

`createLineSelector` comes from `src/components/room-kit/line-selector.ts`; it never says
the same line twice in a row. Owner rules quoted in the files:

- "plain words, one register. Each line says what the voice did ... and what to do about
  it" (11 Oct 2026);
- "Merc stays warm but never decorates: no glass, glow or pouring light. No 'wrong',
  'failed' or 'bad' either; the lines are about the sound, never the singer";
- Merc speaks between waves or slides, never while the singer is mid-take.

Examples:

- "I sing it first. Then you sing it back."
- "The {nth} note sat flat. Lift it a little."
- "Land on each note before you move on."
- "Hum ng, like the end of sing. Slide up to {top} and back."

**There are two tonal registers today.** The coaching rooms use plain, exact language.
Glassworks narration is whimsical and witty ("That glass had plans. So did you."). The
series needs a written third register for "teacher Merc". I suggest the rooms' plainness
for instruction, with Glassworks' wit allowed only in asides.

---

## 5. Raster and 3D assets

| Asset                                                                                                                                       | What it is                                                                                                                                                                                                                                                                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/onboarding/merc-sky-{wide,tall}.webp`, `merc-first-light-v2-{wide,tall}.webp`, `merc-first-light-star-*.webp`, `merc-map-v2-*.webp` | AI-generated painterly plates (Higgsfield, image-referenced; `docs/plans/onboarding-first-light.md:292-330`). A glowing blue-violet droplet with feet on a wet reflective floor, spotlight, filament trails.                                                                       | Integrated with `mix-blend-mode: screen` and a baked fade to black. Label as concept art. Closest raster match to the WebGL2 Merc.                                                                                                                                                                                                                                                                                                                                                                                              |
| `apps/beside-cue/public/games/journey/merc-{idle,listening,singing,celebrate}.webp`                                                         | Small (about 11-12 KB) pastel sprite: violet-to-mint glassy drop, smile, feet.                                                                                                                                                                                                     | A different look: softer and pastel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `apps/beside-cue/public/games/merc.webp`                                                                                                    | 2048 px iridescent **sphere** with holographic oval eyes and an orbit of music notes.                                                                                                                                                                                              | An older or alternate concept.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `apps/beside-cue/public/games/glass3d/merc.glb` (431,512 B), `merc-v2.glb` (**Git LFS pointer**, 987,068 B real)                            | Three.js character: silver iridescent quicksilver body **with two hands**. 5-bone rig (`root, base, head, hand_l, hand_r`), morphs `blink, wide, sing`, **7 clips**: `sing` 2 s, `listen` 4 s, `welcome` 1.63 s, `laugh` 1.23 s, `celebrate` 1.07 s, `move` 1.37 s, `fall` 1.40 s. | Material is `MeshPhysicalMaterial({ color: 0xf4f7f8, metalness: 1, roughness: 0.065, iridescence: 0.85, ... })` (`packages/glass-game/src/render/merc-model.ts:24-33`). The base mesh came from **Meshy `multi_image_to_3d`** (AI, 30 credits), then a Blender recipe (`apps/beside-cue/art/merc/make_merc_v2.py`, receipt `art/glass-adventure/merc-character-v2/production-receipt.json`). Masters live off-repo in `<creative-archive>`. Known Three r185 stale-bone-palette defect: see `docs/agent/MISTAKES.md:2082-2087`. |
| `apps/beside-cue/art/merc/merc.blend`, `merc-sculpt.blend`, `merc.opt.glb`, `merc-preview.glb`                                              | Blender sources and preview for the legacy model                                                                                                                                                                                                                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `docs/branding/MASCOT.md`                                                                                                                   | v0.1 plan: SVG/CSS or Rive mascot, AI only for look development.                                                                                                                                                                                                                   | **Stale**: the shipped Merc is the WebGL2 SDF, not SVG. `mascot-explorations.html` is referenced but **does not exist** in `docs/branding/`.                                                                                                                                                                                                                                                                                                                                                                                    |
| `docs/branding/BRAND.md`                                                                                                                    | Tokens: obsidian `#0d1117`, Signal Blue `#58a6ff`, Aqua `#2dd4bf`, Violet `#bc8cff`; chrome family `#f4f8fd` to `#1b2430`; fonts Outfit (display), Inter (UI), Plus Jakarta Sans (warm alternate).                                                                                 | §7 is the legal playbook: AI output for ideation; the shipped mascot is human-authored.                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**The four Mercs:**

1. WebGL2 resin drop, blue-violet gradient, feet, nub (the premium rooms).
2. Painterly AI plates of the same design (onboarding).
3. Pastel sprite (Beside Cue journey).
4. Silver iridescent 3D Merc with hands (Glassworks). His voice is the D2 narration.

---

## 6. Search for a second, orange, warm, twin or companion Merc

The search was a grep over `.ts`, `.tsx`, `.md`, `.json`, `.css`, `.html`, `.mjs` and `.py`
files, excluding `node_modules`, `.git` and `dist`. The pattern matched
orange|warm|amber|ember|sunset|copper|gold|twin|companion|sibling|partner|duo near "merc",
in both orders.

Every hit is unrelated:

- "Freddie Mercury is your voice twin": the voiceprint feature.
- `warmMerc` / `dropWarmMerc` (`apps/beside-cue/src/games/glass3d/render/merc.ts:130-145`):
  these **pre-load** ("warm") the GLB.
- "Twin Galleries": a Glassworks level name.
- `mercury-sing-field-test.md`: "Companion to mercury-sing.md".

The only warm-colour Merc reference is the Beside Cue palette note: `--orange #c93513` is
"reserved for Merc and the score card; never on glass"
(`apps/beside-cue/docs/games/glass-3d-art.md:134`, token in `apps/beside-cue/src/styles.css:11`).

**Conclusion: no orange Merc, second Merc or companion palette exists in code, art or
docs.** The Ember look in 1.6 is new and was rendered for this research only.

---

## 7. Premium vocal exercises: the existing motions and voices

The catalogue (`src/features/premium-exercises/catalogue.ts`) lists four rooms:

| Room                         | Card line                                                    | Merc's role and states                                                                                                                                                                                                                                     | Sound                                                    |
| ---------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Long note** (lantern)      | "Hold one note and fill the lantern with light."             | Drops in. Listens beside the lantern. **Hops inside the lantern glass** to sing (place 'inside', 0.7x, floating on the liquid). The lantern fill tracks the hold. `lock` while in tune, `sing` when off; `celebrate` at the goal or brim; `sleep` on rest. | Reference tone; synthesized demo voice                   |
| **Echo** (stars over a town) | "Merc sings a phrase. Sing it back and light the stars."     | **Call and response.** Merc `sing`s the call: rings on each onset, stars light. Then he `listen`s for the reply; `lock` while it lands; `hop` or `celebrate` at the result.                                                                                | Sampled "ooh" with vibrato (placeholder); synth fallback |
| **Lip roll** (bay of waves)  | "Buzz your lips over three waves and light the bay."         | `hum` at the intro with the buzz drawn beside his mouth (own rings off). Then he **surfs the sung pitch** at the playhead (`ride`): crest = on pitch, sinks = flat, lifts = sharp. `lock` on a lit wave; `celebrate` on a best.                            | Synth "ooh" plus 25 Hz lip flutter                       |
| **Ng slides** (bridge)       | "Hum five slides up a fifth and back, and light the bridge." | `hum` at the intro, then `ride` along each arch, leaning with the slope. `celebrate` when all are lit.                                                                                                                                                     | Synth `hum` timbre                                       |

Each room also has:

- a **scripted demo**: `demo/demo-script.ts`, `demo-cues.ts`, `tip-targets.ts` and
  `scripted-take.ts`, a scripted voice played through the real engine with tooltips that
  avoid Merc;
- dev-only **fixtures** of storyboard frames (`fixture/fixture-scenes.ts`, generated by
  `scripts/sync-echo-art.mjs` and friends);
- painted plates (for example `src/features/echo/art/*.webp`). These come from
  `agent-out/premium-exercises-art/...` outside the repo and are gated out of the store
  build by `PREMIUM_IMAGES` and `PREMIUM_VOICES` in `apps/mercurypitch/vite.config.ts`.

These demos are already **storyboards of Merc teaching**: voice contour in, Merc state and
pose plus synthesized sound out. They are the strongest template for lesson beats.

---

## 8. Merc production bible

### 8.1 Canon decisions (recommended)

- **Host:** the WebGL2 resin Merc (`src/lib/merc`). Blue is canonical. "Ember" orange is the
  second host via `setLook` (palette in 1.6).
- The silver 3D Merc (Glassworks) and the sprite or sphere art are **not** series hosts.
  They are a different design, and the 3D one has hands; mixing them breaks character
  continuity.
- **Framing:** `front` for teaching, `hero` for personality beats, custom `MercView` for
  cinematic moves. Keep idle at about 56% of frame height or smaller. Anchor feet with
  `MERC_FEET = 0.81` (front only).
- **Colour of sound:** keep the pale-blue arcs and rings as the shared "sound" colour for
  both Mercs until accent uniforms exist. Sparkles are gold and white for both.

### 8.2 Reusable as-is for videos

1. All 12 states, including the physics: drop splat, celebrate jump and sparkles, hop arcs
   with dots and ghosts, climb with arrow, point with nub, listen with arcs, sing following
   pitch, lock glow build, hum and ride.
2. Deterministic capture (`capture`, `continuous`, `renderAt`, `reset`). This is verified
   bit-identical in HyperFrames' SwiftShader Chrome, with a working film-score wrapper.
3. A 3D camera via `setView(MercView)` and gaze or turn via `setPoseBias`.
4. `transparent` compositing over HTML, SVG and GSAP sets in-browser.
5. Ember orange via `setLook` with no shader change, so the shader hash is unchanged.
6. The synthesized voice (`playVoiceContour`: ooh, hum, vibrato, lip buzz), renderable
   offline and in sync with `voiceAt` from the same contour.
7. `speech-envelope.ts`, for narration-driven mouth movement.
8. Merc's line-writing rules (`merc-lines.ts`) as the series style guide.
9. The D2 narration voice identity, `B4fBPRmasEsTgd6YlSok`, for new lines. Generating them
   is a paid step, and it needs owner approval and a licence check.
10. The onboarding plates as backgrounds or concept stills, labelled as AI concept art.

### 8.3 Needs building

| #   | Item                                                                                                                                                                                                                                               | Size     | Touches the pinned shader?                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| 1   | `merc-film` score wrapper plus GSAP setter binding, packaged with the IIFE (prototype in `scratchpad/merc-probe/score.mjs`)                                                                                                                        | small    | no                                                            |
| 2   | An `EMBER` look exported as a constant (for example `LOOKS.ember` in `constants.ts`), so web and video share one source                                                                                                                            | small    | no (uniforms only)                                            |
| 3   | Accent uniforms for floor pool, rings, arcs, dots, arrow, droplets, core, nub, glints and key light, defaulting to today's values; prove blue pixel-identical; owner approval; update the hashes                                                   | medium   | **yes**                                                       |
| 4   | A `talk` state: mouth shapes from a speech envelope or visemes, small nods and blinks. Today `sing` with `cents: 0` is the stopgap, but its mouth is only an "O" and it fades the smile. New states do not move pinned ones.                       | medium   | possibly (mouth shapes are in GLSL)                           |
| 5   | Presenter gestures: look-at a screen point (exists via `setPoseBias`), point (exists via the nub, one side only), a mirrored point to the other side, a nod, a shrug or wobble ("encouraging" from MASCOT.md), and a look at the partner Merc      | medium   | no for choreography; the nub is drawn on one side only in SDF |
| 6   | Feet anchor and screen projection helper for any view (`screenOf(worldPoint, view, size)`), so HTML notes land on his nub or feet                                                                                                                  | small    | no                                                            |
| 7   | A non-drawing `seek(t)` or `prepare(t)` API, so score cue crossings skip throwaway draws (the cost is one draw per cue crossed, about 2-8 s each on SwiftShader)                                                                                   | small    | no                                                            |
| 8   | GPU render host (`--browser-gpu`) or a Merc frame cache, for delivery renders                                                                                                                                                                      | ops      | no                                                            |
| 9   | An orange Merc voice. Options: re-run Voice Design for a contrasting identity (the unchosen v1 directions A, B and C are documented starting points), or a synth timbre shift (for example a higher lowpass and different partials) for sung demos | medium   | no                                                            |
| 10  | A real sung "ooh" recording set, replacing the ElevenLabs re-pitched placeholders                                                                                                                                                                  | external | no                                                            |
| 11  | Update `docs/branding/MASCOT.md`: it describes an SVG mascot plan and links a missing `mascot-explorations.html`                                                                                                                                   | small    | no                                                            |

### 8.4 Risks

1. **Render time on SwiftShader**: 2-8 s per 1080 square frame (2.3 numbers). Mitigate with
   a GPU host, small canvases and `medium` for drafts.
2. **The shader hash gate**: any GLSL change, such as warm accents or a new mouth, needs
   owner approval and a before/after render, by explicit test policy.
3. **Hard-coded cool effects on Ember Merc**: the teal floor pool and blue arcs and rings
   (1.6). Visible in every grounded shot.
4. **Alpha export loses the glow** (2.4). Composite in-browser only.
5. **Character canon drift**: there are four Mercs (5.x). The series must lock one.
   Glassworks' D2 voice belongs to the silver Merc today.
6. **Voice licensing and quality**:
   - The ElevenLabs commercial terms are undocumented in the repo.
   - Echo's sung samples are placeholders.
   - TTS singing failed the pitch detector in v7.
   - Instructional sung references should use the synth or real recordings.
7. **Limited gesture vocabulary**: there are no arms. The nub point exists, lean, hop and
   gaze exist, and the mouth has smile, O and grin only. Explainer staging must play to
   that (Merc reacts and HTML graphics carry the content), or item 4/5 work is required.
8. **Two-Merc interplay**: two contexts and two canvases. They cannot occlude in depth or
   cast shadows on each other; staging must keep them apart or layer them cleanly.
9. **Seek semantics**: a naive `onUpdate` binding can be skipped on suppressed seeks. Use
   the setter-target binding (2.2, step 3).
10. **DPR trap**: HyperFrames 4K raises `deviceScaleFactor`, and Merc's default pixel ratio
    would double the resolution. Always pass `pixelRatio: 1` and `size`.
11. **Web lesson pages**: each live Merc costs one WebGL context, and mobile browsers cap
    the count lower. Use one Merc per viewport and destroy offscreen ones. `medium` quality
    on phones; `MercView` already defaults to medium. Capture mode can be scroll-scrubbed
    (`renderAt(progress * duration)`) for a deterministic, scrubbable Merc in the lesson
    explorer. Respect `prefers-reduced-motion` (`still`, and the `STILL_STATE` mapping).
12. **Dither noise in transparent mode**: the composite adds ±0.5/255 noise even where
    alpha is 0. That is invisible in practice, but technically not clean premultiplied
    alpha.

### 8.5 Reproduce the proofs

```bash
SP=(session scratchpad, not kept)/merc-probe
node $SP/probe.mjs  $SP   # 11 stills (blue and orange, all tiers, transparent); determinism check
node $SP/probe2.mjs $SP   # duo shots: sing/listen, lock, custom orbit, hop/climb
node $SP/bench.mjs  $SP   # ms/frame per tier and canvas size; seek costs
node $SP/score.mjs  $SP   # film-score wrapper: forward == cold == back-and-forth (hash 659e9adf969128fb)
```

All scripts use the repo's own `playwright-core@1.60.0` and HyperFrames' chrome-headless-shell
with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, served from a
throwaway local HTTP server. They touch no production API.
