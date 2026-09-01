# The 3D glass world — plan

Status: proposal, 2026-08-31. Written right after PR #649 merged (the 2D
workshop verbs: resonance ring, steady beam, improv atrium).

The 2D songbook stays. This is the second stage: a real 3D room where
Merc platforms, glass is geometry rather than a rectangle, and the
shatter is the payoff the whole brand is named after.

---

## 0. TL;DR

- **First mechanic: the Standing Wave Chamber.** Your sung pitch fills a
  hall with a standing wave. Where the wave piles up (a belly) glass
  shakes itself apart; where it cancels (a node) everything is still and
  safe to stand. The chamber's modes are the harmonic series of its
  fundamental, so the puzzle — "put a belly on that pane while keeping a
  node under my feet" — has a musical answer: sing the octave, sing the
  twelfth. It is the one mechanic on the list that is _about space_, so
  it is the one that earns 3D.
- **Before it, one vertical slice: the Cabinet.** A single spotlit room,
  a wine glass on a pedestal, hold its note then let it wave, and it
  shatters properly. No platforming, no puzzle. Its job is to prove the
  entire pipeline end to end — Blender fracture, asset load, renderer,
  voice coupling, shard simulation, sound, haptics, score card — and it
  is also the shareable money shot on its own.
- **We are not starting from zero.** The main app already ships a
  TypeGPU renderer with a WebGPU device seam and graceful fallback, a
  deterministic fracture library with tests, and a documented decision
  that TypeGPU is the mandated backend. Beside Cue already ships the
  pitch stream, the vibrato detector, the driver seam, run scoring and
  the grade card. The genuinely new work is 3D geometry, a 3D shatter,
  and the wave.
- **One prerequisite, before any 3D code.** Pitch detection currently
  runs inside `requestAnimationFrame`. Adding a renderer would degrade
  the game's own input exactly when frames get expensive, so the
  detector moves off the frame loop first (§4a).
- **WebGPU does reach the app, and it still is not the whole audience.**
  Android System WebView ships WebGPU (chromestatus lists an explicit
  WebView milestone, and Chromium's source agrees) — but that is about
  70–80% of Android and iOS 26 upward only. So: one renderer, two tiers.
  three.js covers both backends behind one object, and the effect
  degrades on the lower tier rather than merely running slower (§5.1).
- **The shatter needs no GPU compute.** Bake each shard's trajectory
  into vertex attributes and drive the whole burst from one `uProgress`
  uniform: one draw call, no per-frame upload, identical on both
  backends. That also decides the TypeGPU question — adopting
  `@typegpu/three` today would forfeit the WebGL2 fallback, for
  ergonomics on an effect that does not need it (§5.2).
- **Slices**: Cabinet (engine proof) → Merc moves and breaks a wall →
  Standing Wave Chamber (the first designed level) → polish → the next
  mechanic.

---

## 1. What already exists

Inventory first, because most of the hard parts have precedent in this
repo.

**In the main app (`src/`)**

| Piece                       | Where                                                         | What it gives us                                                                                                        |
| --------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| WebGPU device acquisition   | `src/lib/gpu/webgpu-device.ts`                                | One shared device per page, device-loss handling, `isWebGpuSupported()`                                                 |
| TypeGPU renderer            | `src/features/glass/renderer/typegpu/TypeGpuGlassRenderer.ts` | A working TGSL pipeline: vertexFn/fragmentFn, storage buffers, `root.createRenderPipeline`, `root.destroy()` on dispose |
| Backend seam                | `src/features/glass/renderer/GlassRenderer.ts`                | The pattern: try WebGPU, fall back, report which ran                                                                    |
| Fracture library            | `src/lib/glass/fracture.ts` (+ tests)                         | Recursive convex splitting, shard bodies, integration, seeded determinism, performance-scaled timeline                  |
| Shard compositor            | `src/features/glass/renderer/shard-burst.ts`                  | The 2.5D burst that shipped — the look to match in real 3D                                                              |
| The plan that set the rules | `docs/plans/glass-handoff-2026-07-17.md` §5.3, §7             | The TypeGPU mandate, the shatter algorithm, the perf gates                                                              |

**In Beside Cue (`apps/beside-cue/src/`)**

| Piece             | Where                           | What it gives us                                                        |
| ----------------- | ------------------------------- | ----------------------------------------------------------------------- |
| Pitch stream      | `@irchiinnuss/pitch-engine`     | Fractional MIDI, confidence, gap bridging, mic lifecycle                |
| Driver seam       | `games/glass/drivers/`          | `sing` and `tap` behind one interface — the 3D world plugs in unchanged |
| Vibrato detector  | `games/glass/vibrato.ts`        | Rate and depth from the raw stream; already the ring's pump             |
| Run scoring       | `games/glass/score.ts`          | Real-unit line, pass band, gold/silver/bronze grade                     |
| Data-first config | `games/glass/journey-config.ts` | Every feel number in one deep-mergeable object                          |
| Level compiler    | `games/glass/levels/compile.ts` | Level data → stage per mode; the shape to copy                          |

**Art**: `~/.dotfiles/personal/irchiinnuss/native-apps/break-glass/wineglass-stage.blend`
— the wine glass is already modelled procedurally on the branded stage,
and the Blender MCP bridge is operational.

**So the new work is**: 3D asset pipeline, a 3D renderer for a small
scene, real 3D shard simulation, the wave simulation, a character
controller, and the room's sound.

---

## 2. The first mechanic — the Standing Wave Chamber

### 2.1 Why this one

Ranked against the other mechanics on the list: the Resonance Ring is
already shipped in 2D and becomes the Cabinet slice below; Shard
Sculptor is spectacular but cannot start until the shatter is finished;
the Detuned World is abstract, and abstract is the one thing a first 3D
mechanic cannot afford. The Standing Wave Chamber is the only pick whose
_rules need three dimensions_ — the answer to the puzzle is a place you
walk to. It also teaches something no other music game
teaches physically: the harmonic series.

### 2.2 The fantasy

You step into a long glass hall. Your voice fills it. Where your voice
piles up, the glass shakes itself apart. Where your voice cancels,
nothing moves — dust hangs in the air. You learn to place stillness and
violence in space by choosing your note.

### 2.3 The rules

- The chamber has a length and a **fundamental** (a note, from the
  level's key). Its modes are that fundamental's harmonic series:

  | Sing                         | Harmonic | Bellies            | Nodes        |
  | ---------------------------- | -------- | ------------------ | ------------ |
  | the fundamental              | 1        | one, at the middle | the two ends |
  | the octave                   | 2        | two, at ¼ and ¾    | the middle   |
  | the twelfth (octave + fifth) | 3        | three, at ⅙, ½, ⅚  | ⅓ and ⅔      |
  | two octaves                  | 4        | four               | ⅛ steps      |

- A stable wave forms only while the voice sits within `modeTolCents` of
  a harmonic. Between harmonics the room churns: visible noise, no
  charge. **This is the ear-training**, and it is legible without any
  theory — you hear the room lock.
- **Bellies destroy**: a pane standing at a belly cracks, then shatters
  after `bellyHoldMs` of held wave.
- **Nodes are safe**: a pane at a node is immune; Merc standing at a
  node is untouched.
- **Vibrato pumps** the amplitude, exactly as it pumps the resonance
  ring — a rattling pane is finished by letting the note wave.
- **Loudness is spectacle only** (locked rule): louder means brighter,
  more dust, a bigger camera shake. It never gates a pane.

### 2.4 The puzzle, and why it is a puzzle

Put a belly on the pane _and_ keep a node under your feet. Because the
node and belly positions are fixed per harmonic, reading the room is a
musical question: the pane sits at three-quarters, so that is the
octave's second belly — sing the octave, and stand at the middle, which
is the octave's node.

Later chambers stack: a fragile floor tile that only survives at a node,
several panes at different positions needing different harmonics in
sequence (which is a little bugle call), and a finale that asks for the
sequence in tempo.

### 2.5 The curve (teach → apply → finale)

- **Chamber A — teach.** One pane at the middle, no floor hazard, the
  wave drawn large and obvious, a harmonic ladder in the corner lighting
  up 1·2·3·4 as you find them. You cannot lose.
- **Chamber B — apply.** The floor becomes fragile. Pane at ¾: the
  octave, standing at the middle node.
- **Chamber C — finale.** Three panes, three harmonics in sequence, the
  last finished with vibrato. Score card at the end.

Each chamber opens with a difficulty _drop_ rather than a ramp: a
saw-tooth, so the player gets a moment of feeling capable before the
next demand lands.

### 2.6 Feel and forgiveness

- Pitch coyote time: the last confident harmonic holds through a short
  dropout, so a breath does not collapse the wave.
- Snap-in: within `modeTolCents` the wave locks fully rather than
  proportionally, so being nearly right feels like being right.
- The wave decays over `waveFallMs` rather than dropping, so moving your
  head or taking a breath is not punished.
- **Failure is comedy**: linger on a belly and the floor tile under Merc
  shatters, he drops with a yelp into a soft pile of shards, climbs back
  at the checkpoint. No death, no cascade.

### 2.7 Scoring

Reuse `score.ts` unchanged: per-pane quality from mean cents off the
harmonic while charging, a small clean-run bonus for never standing on a
belly, the real-unit line first ("about 9¢ off the harmonics"), then the
gold/silver/bronze chip. Nothing gated.

---

## 3. The slice before it — the Cabinet

One room. A pedestal, a spotlight, a wine glass. Hold its note; the rim
ripples with your error, the glass sings back; let the note wave and it
shatters — hit-stop, a beat of slow motion, a few hundred shards that
tumble, settle and _stay_ on the floor. Then the score card.

**Decided (maff, 2026-08-31):** the room is a **black void with one
spotlight** — a museum case, an ad shot. Cheapest to render, most
striking, and the most shareable single image; reflections come from a
procedural room environment at zero asset cost. The **camera is a fixed
cinematic stage**, per room, for the whole first build — a general 3D
camera is a later question, asked only if the stage framing ever feels
tight. And the **glass is a Blender asset from the start**: the Cabinet
exists to prove the pipeline, so the pipeline is what gets proven —
authored glass, Cell Fracture, glb export, meshopt, the lot. Nothing is
playable until the art exists, and that is accepted.

It is the Resonance Ring we already shipped and validated in 2D, so the
game logic is a port rather than a design. Its purpose is that it
exercises every new part of the stack exactly once: Blender fracture →
export → load → render glass → couple to the voice → simulate shards →
layered sound → haptics → score. When it runs at 60fps on the tablet,
the engine exists.

---

## 4. Engine architecture

The 2D engine's shape is the one to copy, because it is what made 244
tests possible: **pure simulation modules + one imperative runtime + all
feel numbers in one config object.**

```
apps/beside-cue/src/games/glass3d/
  world3d-config.ts      every feel number, deep-mergeable per level
  types.ts               World3D, Prop, Pane3D, Chamber, ShardSet
  levels/
    types.ts             LevelDef3D — pure data, no engine imports
    the-cabinet.ts
    resonance-hall.ts
    index.ts
    compile3d.ts         LevelDef3D + mode -> Stage3D
  sim/                   PURE. no GPU, no DOM, unit-tested
    wave.ts              harmonics -> node/belly positions, amplitude field
    resonance3d.ts       per-pane charge: hold -> cap -> vibrato pump
    shatter3d.ts         solves each shard's launch from the pitch accuracy
                         at the break — once, not per frame (§5.2)
    character.ts         kinematic move/jump, coyote time, jump buffer
    objectives.ts        the node chain, ported from the 2D engine
  runtime/               the loop, deliberately NOT in the component
    loop.ts              fixed-step accumulator, substeps, system list
    collide.ts           Octree + Capsule wrapper (three/addons)
  render/
    Stage3D.tsx          Solid component: canvas ref + onMount ONLY
    renderer.ts          backend seam (mirrors GlassRenderer.ts)
    scene.ts             camera and transform math — pure, tested
    three/
      Renderer3D.ts      scene build, materials, the per-frame draw
      shards.ts          the one merged shard geometry
      glass-material.ts  the physical material and its cheap tier
      shaders/           TSL nodes
  audio/
    glass-voice.ts       modal synthesis that tracks the target note
    shatter-sfx.ts       layered crack / body / tinkle
  input/
    look.ts              touch-drag camera; no pointer lock on mobile
  assets.ts              manifest + loader (GLTFLoader + MeshoptDecoder)
  probes.ts              DEV window.__w3() for the E2E harness
  debug.ts               lil-gui bound to the config, dev-only (§8)
```

Rules carried over from the 2D engine, deliberately:

1. **Imperative loop, mounted from a Solid component.** No declarative
   3D wrapper — and not because none was tried: `solid-three` has no
   stable release since 2023 and its `main` branch has not moved since,
   while the React equivalent it ports has four orders of magnitude more
   use. Solid does not need one anyway. A reconciler exists to diff JSX
   into a mutable scene graph across re-renders; Solid has no re-renders,
   so `createEffect(() => { mesh.position.x = playerX() })` _is_ the
   reconciler, in one line.
2. **But the loop does not live in the component.** `JourneyPrototype.tsx`
   is 3,184 lines — runtime, simulation, rendering and UI in one file.
   That held for 2D and it will not hold for a scene builder plus a
   character controller plus a render loop. `Stage3D.tsx` stays under
   about 150 lines: canvas ref, mount, unmount, signal plumbing. The
   loop is `runtime/loop.ts`, and it can be tested without a component
   at all.
3. **No entity-component system.** The libraries are healthy (bitECS,
   koota) and the case for them is real at thousands of independently
   behaving entities or at deep behaviour composition. We have one room,
   a few panes, one character, and a shard burst — and the shards want a
   flat typed-array loop, which `fracture.ts` already is. Systems are
   just functions over the world, run in order; adding an ECS would put
   two organising principles in the same few thousand lines. Revisit if
   a level ever ships hundreds of independently-behaving props.
4. **`sim/` never imports the renderer.** Everything with a number in it
   is pure and tested; the renderer only draws. This is also what makes
   a fallback possible without a second game.
5. **One config object.** `world3d-config.ts` holds every constant, and
   a level can deep-merge overrides — same as `feel` in the 2D levels.
6. **Levels are data.** A level is JSON-shaped: rooms, props, panes,
   objectives, key. No code in a level file.
7. **Drivers unchanged.** The 3D world consumes the same
   `InteractionDriver` (sing/tap) — the mic pipeline, the smoothing and
   the vibrato detector come along for free.
8. **DEV probes from day one.** `window.__w3()` reporting positions,
   wave state, pane charge and shard counts, so the synthetic-voice E2E
   harness works here exactly as it does in 2D.

### 4.1 Moving Merc through it

Start with **`Octree` + `Capsule` from `three/addons`** — zero
dependencies, official, and the whole controller in the `games_fps`
example is about sixty lines: build the octree from the loaded room,
sweep a capsule, treat `normal.y >= 0.15` as grounded, and run five
substeps per frame. Static triangle-mesh collision is exactly what a
room is.

Rapier's `KinematicCharacterController` is the upgrade, and only earns
its ~2 MB of WASM when Merc has to push dynamic shards around. Its
sharp edges, in the order they bite: it does not rotate anything (we own
yaw), it does not apply gravity (we own that too), it has no grounded
flag (same normal test as above), autostep is off by default and only
fires while already touching the floor, and snap-to-ground needs a
downward component in the desired motion or Merc launches off every
downhill slope. Do not use `three/addons/physics/RapierPhysics.js`
either way — see §5.2.

**The jump numbers come from the design, not from tuning.** Given a
desired height and time to apex, `gravity = -2h / t²` and
`v = 2h / t`, which means the two numbers in `world3d-config` are the
two a designer can actually picture. On top of that, the forgiveness
grammar that every good platformer shares: fall gravity 1.5–2.5× the
rise gravity, a variable height that cuts upward velocity on release
rather than zeroing it, ~100–150 ms of coyote time, ~100–150 ms of jump
buffering, reduced gravity near the apex, and a nudge out of near-miss
ledges instead of a block. Ground and air acceleration are separate
numbers.

That is deliberately the same shape as the pitch forgiveness in §2.6 —
snap-in, pitch coyote time, the decay window. Both sets of windows live
in the one config object, because they are one design.

---

## 4a. Prerequisite — get the pitch stream out of the frame loop

Verified in our own code before planning anything else, because it
decides whether the 3D world can work at all.

`packages/pitch-engine/src/pitch-f0-stream.ts` runs the detector inside
a `requestAnimationFrame` loop: each frame pulls 2048 samples from an
`AnalyserNode` and calls `detector.detect(buffer)` synchronously. Two
consequences that do not matter for a 2D canvas and matter enormously
for a 3D scene:

1. **The pitch hop IS the frame interval.** At 60fps the voice is
   sampled every 16ms; at 30fps, every 33ms — and the samples between
   frames are never analysed at all. The input mechanic degrades exactly
   when the renderer gets expensive, which is the worst possible
   coupling: the harder the scene, the worse the singing feels.
2. **Detection cost sits inside the frame budget**, competing with the
   renderer for the same 16ms.

**The fix**: drive detection from the audio clock, not the frame clock.

- An `AudioWorkletProcessor` receives 128-sample quanta, accumulates
  them into a ring buffer, and emits a fixed hop (1024 samples at 48kHz
  is ~21ms, matching today's effective cadence at 60fps).
- Each hop is handed to a Worker as a transferable `ArrayBuffer` — no
  SharedArrayBuffer, so no COOP/COEP headers to arrange inside the
  Capacitor WebView — and the Worker runs the same YIN detector the
  stream uses today. (Deliberately still YIN: the package ships no model
  weights, by the bundle rule.)
- The Worker posts back `{ f0, conf, rms, tAudio }`; the main thread
  only ever reads the latest value, exactly as `latestSmoothed()` does
  today.

**The blast radius is smaller than it looks.** The main web app does not
import this module: it has its own fork at `src/lib/pitch-f0-stream.ts`,
which has diverged (it carries a `peekFrames` the package copy does not).
The only consumer of the package's `createF0Stream` is Beside Cue's sing
driver. So this lands as a change to one game's input path, behind an
unchanged `F0Stream` interface — not as surgery on the mirror. The two
copies having drifted is its own problem, but not this one's.

What this buys, beyond unblocking 3D: the hop becomes constant so the
median smoothing window is a true time window; the detector leaves the
main thread entirely; and a slow phone gets a steady pitch stream under
a dropped-frame renderer. It also improves the 2D games we already ship,
so it is worth doing on its own merits.

**Do this before slice 0**, not after: every feel number in the 3D world
gets tuned against the pitch stream's timing, and tuning against a
frame-coupled stream means tuning twice.

---

## 5. Renderer and libraries

### 5.1 WebGPU in the WebView — settled, and maff was right

The compat tables were the wrong place to look. caniuse says no WebGPU
for the Android WebView row; MDN says yes, but by mirroring Chrome
rather than by observing anything. Neither is evidence. Three primary
sources are:

- **chromestatus** lists shipping milestones for WebGPU Compatibility
  Mode as `desktop 146 / android 146 / webview 146` — an explicit
  WebView milestone, and M146 went stable in March.
- **Chromium source**: `kWebGPUService` is `FEATURE_ENABLED_BY_DEFAULT`
  under `BUILDFLAG(IS_ANDROID)`, and `aw_field_trials.cc` — the file
  that explicitly disables some seventy features for WebView — does not
  disable it.
- The **blink-dev Intent to Ship** answered the "WebView application
  risks" question with "None", meaning WebView was in scope of the ship.

So WebGPU ships in Android System WebView, which is the runtime a
Capacitor app renders inside. maff's instinct was right, and it was
right for a better reason than the showcase game he cited: that one most
likely runs on TypeGPU's own React Native binding, which is Dawn outside
any WebView. The WebView answer is yes on its own evidence.

**What that does not mean.** Coverage is not universal:

| Hardware                           | WebGPU from                   |
| ---------------------------------- | ----------------------------- |
| Mali, Adreno, Intel, Android 12+   | Chrome 121                    |
| PowerVR, Android 16+               | Chrome 139                    |
| Samsung Xclipse (Exynos flagships) | not yet — expected around 154 |

Android 12 and above is roughly 81% of devices; after the vendor gaps
that lands near **70–80% of Android**, and **iOS 26 and above only** —
there is no flag a third-party app can flip below that. Advanced
Protection Mode disables WebGPU outright and cannot be overridden. And
the System WebView does not auto-update on emulators, so this is a
real-hardware question every time.

The device readout shipped in the mic-fix PR is therefore still the
thing to trust for our own hardware: Settings → tap the version line →
the **Graphics** row, with **Engine** alongside it reporting
`Android WebView <version>` against `Chrome <version>` so there is no
ambiguity about what was measured. One caveat it already handles, and
which broke a three.js user in the wild: presence of `navigator.gpu` is
not the answer — the adapter request has to be awaited, because a device
can have the API and no adapter.

**The conclusion for the plan is unchanged, for a different reason.**
Not "assume WebGL2 because WebGPU may be absent", but "one renderer,
two tiers, because a fifth of Android and every iOS below 26 will land
on WebGL2". Design the scene once; degrade the effect, not just the
backend.

### 5.2 The stack

| Layer                                | Choice                                                         | Why                                                                                                                                                                                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scene, assets, materials             | **three.js r185**, `WebGPURenderer` with its automatic backend | glTF loading, PBR, cameras, `BatchedMesh` — all the parts we would otherwise write badly. One renderer object covers WebGPU and WebGL2, and r185 asks for `featureLevel: 'compatibility'` by default, which reaches devices without Vulkan 1.1                                 |
| Shaders                              | **TSL**                                                        | Compiles to WGSL or GLSL from one source, so the shatter shader is written once and survives whichever backend the device gives us. Also makes shaders ordinary JS modules, which is most of §8                                                                                |
| Shard motion                         | **Solved once at the break; CPU-driven `BatchedMesh` for now** | See below — this is the finding that removes the need for compute at all. The impulse still comes from how well the note was sung; what changes is that it is solved once rather than integrated every frame                                                                   |
| Custom GPU compute, if it ever comes | **TypeGPU**, sharing three's `GPUDevice` by hand               | `new WebGPURenderer({ device })` and `tgpu.initFromDevice({ device })` both exist, so one device can serve both. Not `@typegpu/three` — see below                                                                                                                              |
| Real physics, only if needed         | `@dimforge/rapier3d-simd` (~758 KB gz, lazy)                   | Only if shards must collide with the pedestal and each other. Do **not** use `three/addons/physics/RapierPhysics.js`: it fetches a pinned old build from a third-party CDN at runtime (fatal offline in a Capacitor app) and falls back to trimesh colliders on dynamic bodies |

**The shatter needs no GPU compute, and that is the most useful thing
the research turned up.** A shatter is deterministic, a few seconds long,
and not interactive. So bake each shard's launch velocity, rotation axis,
angular rate and delay into static vertex attributes, merge every shard
into one `BufferGeometry`, and drive the entire thing from a single
`uProgress` uniform in the vertex shader. One draw call, zero per-frame
upload, no compute, no float-texture dependency, no driver-bug exposure,
and identical behaviour on both backends. Shard trajectories are
ballistic anyway, so nothing is lost visually. Persistent GPU state —
ping-pong simulation, transform feedback — only earns its keep if shards
must bounce, pile and re-scatter, and they do not.

**TypeGPU: yes to the device, no to `@typegpu/three`.** maff asked for
TypeGPU directly — he has shipped it in `chaos-master` (compute-heavy
IFS flame pipelines) and in this repo's own `/glass` route — so the
question was re-checked against current facts on 2026-09-01 rather than
left on the original citation.

What is still true: `@typegpu/three` **disables three's WebGL2
fallback**, making the app WebGPU-only. Issue
[#1637](https://github.com/software-mansion/TypeGPU/issues/1637) has
been open since 2025-08-21 and was last touched 2026-08-18; the caution
is still in the docs verbatim. `@typegpu/gl` shipped in alpha
(0.12.3) and can target WebGL2/GLSL, but its own docs say it does not
implement the full API and never mention three.js.

What is newly confirmed, and is the path: **sharing one `GPUDevice` by
hand works, and preserves the fallback.** `new WebGPURenderer({ device
})` and `tgpu.initFromDevice({ device })` both accept an injected
device, and — verified in three's `WebGPUBackend.js` source — _neither
library destroys a device it did not create_, so the two lifecycle
contracts agree. This repo already has the exact shape that needs:
`src/lib/gpu/webgpu-device.ts` hands out a shared device, and
`src/features/glass/renderer/GlassRenderer.ts` already probes support,
dynamically imports the GPU backend and silently falls back.

The real cost is not the wiring: a material authored through
`@typegpu/three`'s `toTSL()` cannot run on the WebGL branch, so every
such material needs a second implementation. That is what #1637 exists
to remove, and it has not.

**So: no TypeGPU in slice 0, and nothing in slice 0 wants it.** The
shatter needs no compute (below), and the Cabinet has one glass, one
plinth and one light. TypeGPU earns its place the moment there is
compute worth doing — glass dust, a particle field, a real fluid — and
at that point it goes in on the WebGPU branch only, through the shared
device, with the WebGL branch simply not drawing that effect. That is
degrading one effect, not maintaining two renderers.

That does leave the TypeGPU mandate (`glass-handoff-2026-07-17.md`
Decision 9) satisfied only on the desktop-web funnel, where the existing
`TypeGpuGlassRenderer` already lives. Worth naming as a decision rather
than letting it drift.

**What we are accepting by choosing `WebGPURenderer`.** It is still
described as experimental by its own manual, and `WebGLRenderer` is
explicitly not deprecated. Concretely: about +98 KB gzipped over core
three (185 vs 87 for the shipped builds); material initialisation
measured 16–36× slower than `WebGLRenderer` on both backends, so it is a
renderer-class cost we inherit either way; no `ShaderMaterial` or
`onBeforeCompile` (TSL is the replacement, which is why TSL is in the
table); no `EffectComposer`, and pmndrs `postprocessing` is not
compatible; and on **all** Android, shadows fall back to a software
`step()` depth comparison rather than hardware PCF, so shadow quality
and cost differ from the desktop machine we develop on.

If any of that bites hard, the exit is plain `WebGLRenderer` and a
WebGL2-only shatter — and r184's `WebGLNodesHandler` lets it consume
TSL node materials, so the shaders would survive the move.

### 5.3 The glass material, and the trick that pays for it

three.js runs an extra full-scene pass, at a hard-coded minimum of 4×
MSAA plus a regenerated mipmap chain, on every frame in which any
material has `transmission > 0`. On a tile-based mobile GPU that is the
dominant cost of glass. Two rules follow:

1. **Never make shards `DoubleSide` transmissive.** For each double-sided
   transmissive object three.js issues an extra backside draw _and_
   invalidates the material, per object per frame. 150 shards would mean
   150 extra draws and 300 material invalidations every frame.
2. **Swap every shard to a cheap material at the moment of the shatter**
   — env-map reflection, a Fresnel rim and an additive edge glint. The
   transmission pass then disappears exactly when the burst needs the
   budget. The expensive frame is the calm one; the violent frame is
   cheap. This is the single best performance property of the whole
   design, and it falls out of the fiction for free.

The numbers behind that, read out of `WebGLRenderer.js`: the transmission
target is built with `samples: Math.max(4, capabilities.samples)` — the
4× MSAA is forced, not a setting — as a half-float target with
`generateMipmaps: true`, sized by `transmissionResolutionScale`, whose
**default is 1.0**, the full viewport. On a 1080×2400 phone that is a
~20 MB resolved texture behind an ~83 MB MSAA renderbuffer; at 0.25 it is
~1.3 MB and ~5.2 MB. Each transmissive fragment then costs eight
dependent texture fetches, or twenty-four with `dispersion`, which is
why `dispersion` stays at 0.

So: `transmissionResolutionScale` 0.25 on mobile and 1.0 on desktop,
`FrontSide` only, `dispersion: 0`, and a 256² PMREM env map.

And a third rule, for the bottom of the range: **the low-end tier drops
transmission entirely.** three.js skips the whole extra pass when no
material has `transmission > 0`, so `transparent: true, opacity: 0.3,
roughness: 0.05, clearcoat: 1` against the same environment map costs
nothing beyond an ordinary transparent draw and still reads as glass.
That also covers the reported Android bug where `transmission > 0`
renders invisible: probe one frame at startup, and fall to this tier.

---

### 5.4 The settings that decide the frame on a phone

Six numbers matter more than anything we will write ourselves. All of
them are decided once, at renderer construction, and all of them are
cheap to get wrong quietly.

**Pixel ratio.** Fill cost scales as the square of the device pixel
ratio. On a 1080×2400 panel reporting DPR 3, the CSS viewport is
360×800, and the backing store at each cap is: 1.0 → 288k fragments,
1.5 → 648k, 2.0 → 1.15M, native 3.0 → **2.59M**. Capping at 1.5 instead
of native is a 4× cut in fragments, and for an effect whose edges are
glass and light, it is close to invisible. `setPixelRatio(Math.min(dpr,
1.5))` while the chamber runs; 2.0 is fine for the flat screens where
the canvas is idle. Note `setPixelRatio` internally calls `setSize(…,
false)`, so it never fights our CSS sizing and the call order does not
matter.

**Antialiasing.** MSAA is nearly free on a tile-based GPU — Arm quotes
1–2% — but only because the multisampled buffer never leaves tile-local
memory, and only when the geometry is light. The one measured comparison
worth trusting (Galaxy S8, Adreno 540) shows exactly where it breaks: on
Sponza at 153k vertices, 4× MSAA costs 1 fps out of 60; on Hairball at
1.03M vertices it costs **16 of 35 fps**. Coverage and depth run at 4×
the rate, so the cost tracks edges, not pixels — and a few hundred glass
shards are all edges. Measure with the real shard geometry before
assuming MSAA is free, and keep FXAA in reserve: the same study measured
it at 1–2 fps regardless of scene complexity.

The trap underneath it: the `antialias: true` constructor flag applies
**only to the default framebuffer**. Any pass we render into a
`WebGLRenderTarget` is unaffected, and needs `samples: 4` set on the
target itself.

**Transparency.** three.js sorts transparent objects back-to-front per
draw call and never sorts _within_ one, so a `BatchedMesh` of shards has
no internal ordering at all. Rather than fight that: sparks and glints
use `AdditiveBlending` with `depthWrite: false`, which is
order-independent because addition commutes; shards use `alphaHash`,
which dithers instead of blending and therefore rides in the **opaque**
list with early-Z and correct depth against everything (the grain it
introduces is invisible on a shape that is on screen for 16 ms); and the
handful of layers we actually know — room, shards, sparks, flash — get
explicit `renderOrder` values rather than trusting a depth sort. Never
sort particles on the CPU: it is O(n log n) plus a full index re-upload
every frame, redone on every camera move.

**Context attributes.** `powerPreference: 'default'` — a phone has one
GPU, so there is nothing to select, and biasing the driver toward higher
clocks on a device with a 60–90 second thermal fuse just means boosting
harder and throttling sooner. `preserveDrawingBuffer: false`, which
matters more on a tiler than the generic advice suggests: preserving the
buffer across frames defeats the driver's ability to discard the colour
attachment at end-of-tile, which is the same mechanism that makes MSAA
cheap. If we need a screenshot for the share card, render on demand and
call `toDataURL()` in the same tick. And use `invalidateFramebuffer` on
depth, stencil and multisampled attachments when done with them — it is
the WebGL2 spelling of "do not bother storing this", and it is free.

**The idle loop is the thermal budget.** Time-to-first-throttle is
60–90 seconds on a budget device, and sustained throttling costs 30–50%
of peak. A shatter that lasts seconds is never at risk on its own — the
risk is entirely that something kept rendering _before_ it, so the burst
lands on an already-hot GPU. So `setAnimationLoop(null)` whenever
nothing is animating, and render on demand. This is also why the
chamber's calm phase must be genuinely calm rather than idly beautiful.
Test the burst after ten minutes of real use, never on a cold device.

There is no thermal signal available to us in JavaScript: Android's
`getThermalHeadroom` is a Java API, and reaching it would mean writing a
Capacitor plugin. Design so we do not need to know.

### 5.5 Losing the GPU, and getting it back

three.js already handles the ordinary case: it calls `preventDefault()`
on `webglcontextlost` and re-initialises GL state on
`webglcontextrestored`, re-uploading the geometry and textures it owns.
Three things it does not do, which are ours:

- **It does not tell the app.** Add a listener on `renderer.domElement`
  so the chamber can pause, mute the ring, and show something honest
  rather than a frozen frame.
- **It does not restore render-target contents**, so any accumulation
  buffer needs re-seeding.
- **It cannot help when re-creation also fails.** There is a documented
  Android WebView failure where `getContext` returns null after a long
  session and only a reload recovers, so we need a one-shot
  `window.location.reload()` escape hatch, guarded so it can fire once.

Two structural rules follow. **One `WebGLRenderer` for the app
lifetime**, not one per route: Chromium force-loses the oldest context
once too many are alive, and a SolidJS screen that mounts a new renderer
each visit is how we would get there. And on teardown, `dispose()` is
not enough — it releases three's own objects but leaves the context
alive; `forceContextLoss()` is the line that actually gives the GPU
back.

Worth knowing rather than handling: some WebView GPU losses surface as
an app **crash** on the render thread, not as a catchable JS event. If
this ever ships, the Play Console crash list is part of the graphics
debugging surface.

Two Capacitor settings matter here, neither of them graphics APIs:
`webContentsDebuggingEnabled: true` in debug builds (it is what lets
`chrome://inspect` attach to the WebView on a real device — see §8), and
`backgroundColor` set to the canvas clear colour, so startup and
rotation do not flash white behind a transparent canvas.

---

## 6. Assets

### 6.1 Blender → glTF, for the wine glass

1. Solid of revolution, 48–64 segments. **Apply Solidify at ~1mm before
   fracturing** — non-negotiable: it makes shards read as glass edge-on
   and keeps their convex hulls sane.
2. Two material slots: outer, and a rougher interior for the fracture
   faces.
3. 3D cursor at the intended impact point.
4. **Cell Fracture** (still the standard; it moved to the Extensions
   platform after 4.1 and runs on 4.2 LTS through 5.x): `source_limit`
   120, `source_noise` 0.1 (glass cuts are clean — 0.3 is concrete),
   `margin` 0.002 (the 0.03 in most tutorials is for concrete and shows
   as a visible gap on intact glass), `recursion` 1,
   `recursion_chance` 0.3, and **`recursion_chance_select = CURSOR_MIN`**
   so fine shards cluster at the impact and big slabs stay at the rim —
   the single best glass setting. Keep sharp edges on, smooth faces off.
5. Expect 140–190 objects (island split overshoots `source_limit`).
   Decimate any shard over 200 triangles.
6. **Centroids come free**: `use_recenter` (on by default) sets each
   shard's origin to its median, so the exported node translation _is_
   the centroid. Nothing to export.
7. **Do not trust Cell Fracture's mass output** — it computes volume from
   the bounding box, which is badly wrong for thin curved shards. Write
   true volume into a custom property with a few lines of `bpy`, and
   enable Include → Custom Properties on export so it arrives as
   `userData`.

**Glass, as an exported material.** The exporter pattern-matches a node
graph rather than evaluating it, so the chain has to be exact:
Principled `Transmission Weight` > 0 gives `KHR_materials_transmission`;
an `IOR` other than 1.5 gives `KHR_materials_ior` (1.5 is the glTF
default and is omitted, and a _linked_ IOR socket is silently skipped —
use a constant); a `glTF Material Output` node group with `Thickness` > 0
gives `KHR_materials_volume`, without which there is no refraction. A
`Volume Absorption` node feeds attenuation colour and distance. Volume
also **requires a manifold mesh** — one more reason the Solidify step is
mandatory, since a single-plane pane renders wrong. Anything procedural
(noise, gradients, colour ramps) must be baked first; the exporter
cannot see it.

### 6.2 Optimising the export

```
gltf-transform dedup shards.glb t1.glb
gltf-transform weld t1.glb t2.glb
gltf-transform meshopt t2.glb shards.opt.glb
```

**Never run bare `gltf-transform optimize`** on anything in this game.
Its defaults are tuned for a static showcase model, and three of them
are actively hostile here:

- `--join-named true` **merges named meshes** — destroying both the
  per-shard nodes and any `getObjectByName('pane_03')` the game uses to
  break one specific pane.
- `--simplify true` decimates on a **position-only error metric**, so
  skin weights are invisible to the error budget: a collapse that looks
  fine in bind pose can tear once rigged.
- `--palette true` merges materials, which is exactly wrong around
  glass.

Run the passes per asset, explicitly, in a committed prebuild step — not
one `optimize` call, and not a Vite plugin (texture encoding shells a
native binary and takes tens of seconds; that belongs to a content
pipeline, not `vite build`).

**meshopt, not Draco.** The decoder is a single ES module with its WASM
embedded — about 7.7 KB gzipped, no file fetch, no path config, **no
worker**. Draco is roughly ten times that and builds its worker from a
`blob:` URL, which means loosening CSP (`script-src blob:; worker-src
blob:`) — fragile under a custom scheme in a WebView. Draco also carries
per-primitive overhead that multiplies across 150 shard primitives, and
has not shipped a release since January 2024.

**Textures: start with WebP, not KTX2.** Textures are around 85% of a
typical textured `.glb`, so their format matters more for download size
than mesh compression does — but the Basis transcoder is ~260 KB
gzipped and only pays back above roughly four 1024² textures. KTX2's
real prize is 4–8× less VRAM, so adopt it when we measure a memory
problem, not before. When we do, `detectSupport(renderer)` is mandatory:
without it the loader throws, and where no compressed format is found it
falls back to uncompressed RGBA — strictly worse than the WebP we
started with.

### 6.3 Budgets

| Item                           | Budget                                              |
| ------------------------------ | --------------------------------------------------- |
| Intact wine glass              | 3,000–6,000 tris                                    |
| 150 shards, total              | ≤25,000 tris                                        |
| Room (walls, floor, pedestal)  | 10,000–20,000 tris                                  |
| Scene total                    | **<50,000 tris**                                    |
| Draw calls                     | **<15** — all shards in one `BatchedMesh`           |
| Textures                       | one 1024² baked lighting/AO atlas, one 256² env map |
| Shard GLB (meshopt, quantised) | ~40–70 KB gz                                        |
| Frame @60fps                   | physics ≤3ms · scene ≤3ms · GPU ≤8ms                |

Those numbers are deliberately under the ceiling. Scaled from ARM's
published per-clock rates, a mid-range phone will carry **600–1,500
opaque shards** of 20–40 triangles plus **2,000–5,000 additive points**
at around 8px for the glass dust, so 150 shards is a third of the
conservative end. Take the headroom in shard count only after the
Cabinet holds 60fps, and remember the limit is fill rate rather than
geometry: rasterisation happens in 2×2 quads, so even a one-pixel
particle costs four fragment invocations, and alpha blending defeats
both hardware overdraw-removal mechanisms at once. Keep draw calls
under about 100–150 — Chrome's command buffer and ANGLE validation sit
between us and the driver.

`BatchedMesh` is one option for that: one draw call for many _different_
geometries sharing a material, with per-instance matrices and
visibility. (`InstancedMesh` is wrong here — real fracture shards do not
share geometry.) But it hard-depends on `WEBGL_multi_draw` with no
polyfill, and it has a standing report of being slower on WebGPU than
WebGL on Android. Since the shards are baked and move as one, merging
them into a single `BufferGeometry` with per-shard attributes is
simpler, faster and depends on nothing.

**The environment map should be procedural, not a photograph.** three's
`RoomEnvironment` is about 5 KB of source that builds a room out of
emissive boxes and feeds it to the PMREM generator; a 1k HDR is ~1.4 MB
and gzips badly. Our scene _is_ one room, so that trade gives
essentially the right reflections for nothing. PMREM output is 256²
either way, so a real HDR would be downsampled to that regardless.

### 6.4 Merc

**Decided (maff, 2026-08-31): a real 3D model.** The billboard was the
cheap path and it was declined — Merc gets modelled, rigged and
animated. What that commits us to, from §6.1's export rules: actions
stashed to NLA tracks, sampled animation, deform bones only, four bone
influences, and a character art pass that has to exist before slice 1
can walk. The upside is real: he is lit by the scene, he reads from any
angle the stage framing picks, and the brand character becomes an
asset every future 3D thing reuses.

Build order still protects the schedule: the Cabinet (slice 0) has no
Merc, so the modelling runs in parallel with the engine work, not in
front of it. The controller in §4.1 is body-agnostic — a capsule walks
the same whatever is drawn around it — so a placeholder capsule can
prove slice 1's mechanics while the rig is finished.

---

### 6.5 Getting the files onto the device

Three things about how Capacitor serves local files change the plan, all
verified in its source:

- **Android's range-request handling is broken.** A `Range` header gets a
  206 response whose `Content-Range` is computed from the stream — but
  the stream is never seeked, so the bytes come from position 0 while
  claiming to be a later range. So: **no progressive or chunked
  loading**, fetch whole `.glb` files.
- **Pre-compressing assets does nothing.** Neither platform's handler
  implements `Content-Encoding` negotiation, so a `.glb.br` arrives as
  opaque bytes. We do not need it: the APK already deflates these files,
  geometry data compresses about 50% that way, and that compounds with
  meshopt (Draco's entropy-coded output would not).
- **iOS reads the whole file into memory** for non-media extensions, so
  keep individual files modest rather than shipping one fat bundle.

Use relative asset paths (`./models/…`), never root-absolute, under a
custom scheme; and add `.glb`/`.hdr` to Vite's `assetsInclude`, since
they are not known asset types by default.

## 7. Sound

The glass has to _answer_ the voice — that feedback loop is the mechanic,
not decoration.

- **The ring**: modal synthesis, a few detuned partials with exponential
  decay tuned to the pane's target note, amplitude driven by the
  resonance level. As the player locks on, the glass sings with them and
  the partials come into tune. This is the whole audible reward.

  Concretely: four to six bandpass biquads at inharmonic ratios, driven
  by looping filtered noise whose amplitude follows `rms`, retuned in
  real time by ramping `filter.frequency`. Six nodes, negligible cost.
  A rubbed wine glass is sustained rather than struck, so the first mode
  should dominate; to swell toward the break, raise `Q` (a longer ring),
  raise gain, steepen a `WaveShaperNode` curve with the charge for
  buzz, and bring in a slow subharmonic and tremolo as failure
  approaches — the vibrato detector already hands us the rate and depth
  to pump that with.

  For the ratios, the closest published struck-vessel model (STK's
  `NextMug`) is `1 : 2.13 : 4.17 : 5.06` with gains falling
  `1.0, 0.8, 0.6, 0.4` and a pole radius of 0.997 — but that is a
  ceramic mug, and a real wine glass has its first two modes far closer
  together. **Measure an actual glass with our own pitch engine.** We
  have the best possible tool for this sitting in the repo, and the
  numbers it gives will be truer than anything published.

  Synthesis rather than samples, and for a specific reason:
  pitch-shifting a recording by `playbackRate` holds up for about three
  or four semitones before the formants read as a chipmunk, and this
  tone has to follow an arbitrary sung pitch across a whole vocal
  range. No sample set covers that.

- **The break**, layered in four: the resonance swell that precedes it,
  a sharp crack transient, a shard tail of 1.5–3s, then the settle. Thick
  glass wants a dull low body _before_ the bright fragments; thin glass
  does not. Ship dry — no baked reverb, so the room can own its own.
- **Schedule against `audioContext.currentTime`, never `rAF`**, and lead
  the visual by the context's reported output latency. Audio-visual sync
  in an Android WebView is the real risk here, and the fix is to treat
  the audio clock as the master — which is also what §4a does for pitch.
- **One AudioContext**, shared with the pitch pipeline that already
  exists. Resume on the same gesture that starts the game. This was not
  a wish — it was a fix, and it is **done**: `audio/shared-audio-context.ts`
  now owns the only context in the app, and the five that used to exist
  (`audio/web-audio-output.ts`, `onboarding/cinematic-onboarding-audio.ts`,
  `screens/TapTuner.tsx`, and both glass drivers) take a named lease on
  it instead. Game audio is the sixth lease, not the sixth context —
  six is the number older Chrome capped a tab at. `InteractionDriver`
  had already anticipated this: `ctx()` returns that shared context, so
  the stage hums through the clock the input is stamped with.

  What the module handles, so this section does not have to: creation
  and resume inside the user gesture (iOS WKWebView), `statechange` for
  the `'interrupted'` state iOS parks a context in during a call, and
  suspend/resume on `visibilitychange` so the sound pauses with the
  frame loop. It never closes the context — `close()` is one-way and a
  replacement would cost another gesture. New audio should call
  `acquireSharedAudioContext('<owner>')` and never `new AudioContext()`;
  a test asserts that exactly one module constructs one.

- **The tone has to be distinguishable from the voice, not cancelled.**
  Echo cancellation would tame the mic-into-speaker loop and destroy
  pitch detection, and honest pitch means AGC, noise suppression and
  echo cancellation all stay off — that is already locked in the
  handoff doc. So the glass must answer in a register the detector will
  not confuse for the singer: an octave away, or gated to the frames
  where the voice is not the thing being measured. This is a design
  constraint on the sound, decided here rather than discovered in a
  feedback squeal on a tablet.
- **Haptics are already a dependency** (`@capacitor/haptics`). One buzz
  does not sell a shatter: a rising vibration during the resonance
  build, a heavy impact exactly on the crack frame, then two or three
  decaying light taps as the debris settles.

### 7.1 The shatter moment, in milliseconds

Everything above fires on one timeline, measured from the crack:

| t (ms)          | What                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------- |
| −800 → 0        | resonance swells, the crack field grows — the anticipation the research says the payoff depends on |
| 0               | crack transient, heavy haptic, white flash for two frames                                          |
| 0 → 100         | **hitstop**: full freeze                                                                           |
| 100 → 350       | slow motion at 0.35×                                                                               |
| 350 → 550       | ramp back to 1.0×                                                                                  |
| 0 → 400         | camera shake, trauma-squared decay                                                                 |
| 0 → 350         | chromatic aberration, decaying                                                                     |
| 0 → 1200        | dust billboards                                                                                    |
| 100 / 300 / 550 | three decaying light haptics                                                                       |
| 2500            | shards freeze, fade, dispose — and the ground keeps them                                           |

**Every one of those numbers is a duration, and the code must treat them
that way.** iOS puts Low Power Mode, visual idle and thermal mitigation
into WebKit's half-rate set, which means 30fps that the page cannot
override. A timeline advanced by frame count would play the whole
shatter at half speed for anyone with a low battery; advanced by
`deltaTime` it simply plays at 30fps.

Drop the device pixel ratio from the running cap of 1.5 (§5.4) to ~1.0
for the 1.2s burst and restore it after: under shake, slow motion and
chromatic aberration nobody sees it, and it hands back about 2.25× the
fill rate at exactly the frame where the budget is thinnest. Do it as a
scripted step tied to the timeline, not as a live controller — a
resolution controller needs about twenty frames to settle, which is most
of the burst, and the visible pop is worse than a slightly soft second.

---

## 8. The dev loop — how we will see what we are doing

A 3D scene is not debuggable by reading the code, and the phone is where
it has to be right. Four decisions, all of them cheap now and expensive
to retrofit.

**Tunables live in lil-gui, and dump back out as JSON.** Every number in
this plan — chamber tolerances, `transmissionResolutionScale`, shard
count, the shatter timeline — wants to be dragged rather than guessed.
`lil-gui` is the three.js standard, has no dependencies, and is plain
DOM, so in Solid it is a `new GUI()` in `onMount` and `gui.destroy()` in
`onCleanup`. The part that makes it worth the dependency is `gui.save()`,
which returns a JSON-compatible snapshot of every controller: a "copy"
button next to the panel, and the tuned values paste straight into the
config module. That is the same discipline as `journey-config` in the 2D
game — the panel edits values that have a permanent home, and never
becomes the home itself. (One gotcha: `save()` throws on duplicate
controller names, so name them.)

Not leva: it is React-only, down to its dependencies, and the Solid port
died in 2021. Not Tweakpane either — alive but feature-frozen since 2024,
and the Solid wrapper still targets v3.

**The HUD is FPS, frame time, and `renderer.info`.** `stats-gl` covers
the first two and handles both renderers. The draw-call, triangle and
program counts come from `renderer.info` — and `info.programs.length` is
the one to watch, because every material permutation is a compile stall.
Set `renderer.info.autoReset = false` and reset once per frame ourselves;
it resets at the top of every `render()` call by default, so with the
transmission pass we would only ever be reading the last one.

**Accept that GPU time is unmeasurable on Android and design around it.**
Chromium's driver bug list excludes Android from the entry that exposes
`EXT_disjoint_timer_query_webgl2`, and without a flag the extension is
never handed out — so `stats-gl`'s GPU panel reads nothing in the app,
and no native profiler reaches into Chrome's GPU process either. What is
left works well enough: FPS and CPU milliseconds and `renderer.info` in
the page, `chrome://inspect` over USB for real traces, and Perfetto only
to ask whether the whole system is janking. GPU cost gets attributed by
A/B — halve the resolution, drop the transmission pass, cut the shard
count — not by measurement. This is a real argument for the A/B switches
being wired from the start.

**Shaders as TSL, not GLSL strings.** TSL is a JS node graph that
compiles to either WGSL or GLSL, which is the same reason it survives
whichever way §5.1 resolves — and it means shaders are ordinary modules,
so Vite's JS hot reload applies with no shader-reload plumbing at all.
Changing a `uniform()` node's value is a data update rather than a
recompile; only graph-structure changes recompile. `onBeforeCompile` is
now documented as the legacy path in three's own source. If any raw GLSL
does appear, `vite-plugin-glsl` handles it, but it needs a hand-written
`import.meta.hot.accept` that rebuilds the material or Vite falls back to
a full reload and the scene state is gone.

Whatever the module structure, the HMR dispose hook must call
`setAnimationLoop(null)`, dispose geometries and materials, then
`renderer.dispose()` **and** `renderer.forceContextLoss()` — the second
line is the one everyone omits, and omitting it is how a morning of hot
reloads ends with Chromium force-losing contexts.

**Screenshot regression, borrowed from three.js itself.** three's own E2E
harness injects a determinism layer before page scripts: a seeded
`Math.random`, `Date.now` and `performance.now` pinned to 0, and
`requestAnimationFrame` replaced by a gated one-shot that fires only once
the page says it is ready. That is exactly the shape of the visibility
and rAF spoofing already in our Playwright harness for the 2D game, so
the extension is small: pin the clock, render one frame, and compare
against a stored image. Without it, a 3D snapshot test is a coin flip.

Two tools worth having installed rather than depending on: the official
**three.js DevTools** extension, which reads a live scene graph plus
render stats out of any page that sets `window.__THREE_DEVTOOLS__` (three
dispatches to it already), and **WebGPU Inspector** or **Spector.js** for
frame capture when a draw call is wrong rather than slow. Spector.js is
pure JS instrumentation, so it is the one that works inside a remote
Android WebView.

---

## 9. Delivery slices

Each slice lands green (`pnpm check`, tests, and a measured frame time
on the tablet) before the next begins. The §4a prerequisite is not one
of them — it is already open as its own PR, because it improves the 2D
games we ship today and should not wait behind a 3D decision.

| Slice | Contains                                                                                                       | Done when                                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | The Cabinet: room, glass, voice coupling, shatter, sound, score card, plus the tuning panel and frame HUD (§8) | 60fps on the tablet, shards persist, the card shows real units and a grade, and every feel number is draggable and dumps back to config |
| 1     | Merc: kinematic controller, camera, one glass wall to break to pass                                            | The wall breaks because of a note, and Merc walks through the hole                                                                      |
| 2     | Standing Wave Chamber A/B/C, the harmonic ladder HUD, the comedy fall                                          | The three chambers are playable end to end and scored                                                                                   |
| 3     | Polish: juice pass, haptics, reduced-motion path, load time                                                    | Passes the perf gates on a mid Android                                                                                                  |
| 4     | The next mechanic                                                                                              | —                                                                                                                                       |

---

## 10. Risks

- **WebGPU coverage.** Settled in principle — the WebView does ship it
  (§5.1) — and still a risk in practice, because it is 70–80% of Android
  and iOS 26 upward. The lower tier has to be a designed experience, not
  an apology. The app reports what a given device actually got, in
  Settings.
- **`WebGPURenderer` is experimental by its own manual**, costs ~98 KB
  gzipped over core three, initialises materials 16–36× slower on both
  backends, and runs a software shadow path on all Android. The exit is
  plain `WebGLRenderer` plus `WebGLNodesHandler`, which keeps the TSL
  shaders (§5.2).
- **MSAA against shard geometry.** 4× MSAA is nearly free on a tiler
  until the vertex count climbs, and then it is not — a measured 16 of
  35 fps on a million-vertex scene. A few hundred shards is the case
  where that flips. Measure with the real geometry before assuming
  (§5.4).
- **Heat before the burst, not during it.** The shatter is too short to
  throttle a device on its own; what throttles it is anything that keeps
  rendering while nothing moves. The idle loop is the thermal budget
  (§5.4).
- **GPU time is not measurable on Android**, so performance work is A/B
  switches rather than a profiler (§8). Wire the switches early.
- **Asset weight vs the APK.** Budgets in §6.
- **Vocal load.** A room that asks for sustained high harmonics is
  tiring; chamber design must respect the 15-minute block rule and put
  real rests in.
- **Scope.** The Cabinet must ship before the Chamber is designed in
  code. The temptation is to build the wave first because it is more
  interesting.

---

## 11. Open questions for maff

Answered 2026-08-31, recorded where they land in the doc:

1. Camera: **fixed cinematic stage** per room (§3). Revisit a general
   camera only if the stage framing ever feels tight.
2. Merc: **a 3D model**, modelled in parallel with the engine (§6.4).
3. First mechanic: **the Standing Wave Chamber**, as planned (§2).
4. The glass: **a Blender asset from the start** (§3).

Still open:

1. Does the 3D world live inside Beside Cue, or become its own app for
   the store? It is currently planned as a mode inside Beside Cue.
