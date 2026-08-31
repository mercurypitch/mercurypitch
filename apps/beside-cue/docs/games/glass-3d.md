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
- **Design for WebGL2; treat WebGPU as an upgrade.** Whether Android
  System WebView exposes WebGPU is disputed by the compat tables and
  unanswered by them, so the app now measures it and reports the answer
  in Settings (§5.1). three.js covers both backends behind one renderer
  object, so the answer changes performance, not architecture.
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

Ranked against the other candidates in the research doc (§5, §7): the
Resonance Ring is already shipped in 2D and becomes the Cabinet slice;
Shard Sculptor is spectacular but depends on a finished shatter; the
Detuned World is abstract. The Standing Wave Chamber is the only pick
whose _rules need three dimensions_ — the answer to the puzzle is a
place you walk to. It also teaches something no other music game
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

Each chamber opens with a difficulty _drop_ — the saw-tooth from the
research doc, not a ramp.

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
    shatter3d.ts         shard bodies: impulse from pitch accuracy, integrate
    character.ts         kinematic move/jump, coyote time, jump buffer
    objectives.ts        the node chain, ported from the 2D engine
  render/
    Stage3D.tsx          Solid component: canvas ref + onMount loop
    renderer.ts          backend seam (mirrors GlassRenderer.ts)
    scene.ts             camera and transform math — pure, tested
    typegpu/
      Renderer3D.ts      passes: scene, glass, shards, dust, post
      shaders/           TGSL functions
  audio/
    glass-voice.ts       modal synthesis that tracks the target note
    shatter-sfx.ts       layered crack / body / tinkle
  assets.ts              manifest + loader
  probes.ts              DEV window.__w3() for the E2E harness
```

Rules carried over from the 2D engine, deliberately:

1. **Imperative loop inside a Solid component.** No declarative 3D
   wrapper. `JourneyPrototype.tsx` proves the pattern works and stays
   debuggable.
2. **`sim/` never imports the renderer.** Everything with a number in it
   is pure and tested; the renderer only draws. This is also what makes
   a fallback possible without a second game.
3. **One config object.** `world3d-config.ts` holds every constant, and
   a level can deep-merge overrides — same as `feel` in the 2D levels.
4. **Levels are data.** A level is JSON-shaped: rooms, props, panes,
   objectives, key. No code in a level file.
5. **Drivers unchanged.** The 3D world consumes the same
   `InteractionDriver` (sing/tap) — the mic pipeline, the smoothing and
   the vibrato detector come along for free.
6. **DEV probes from day one.** `window.__w3()` reporting positions,
   wave state, pane charge and shard counts, so the synthetic-voice E2E
   harness works here exactly as it does in 2D.

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
  Capacitor WebView — and the Worker runs the ONNX detector.
- The Worker posts back `{ f0, conf, rms, tAudio }`; the main thread
  only ever reads the latest value, exactly as `latestSmoothed()` does
  today.

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

### 5.1 The one fact still to measure

Whether the app can render on WebGPU at all depends on Android System
WebView, and the evidence pulls three ways:

- **caniuse** reports no WebGPU for the WebView row.
- **MDN's compatibility data** mirrors Chrome's yes from 121 — though
  "mirror" is an inference in that dataset, not an observation.
- **maff's point**: TypeGPU ships a showcase game that runs on mobile.
  Worth separating the runtimes, though — TypeGPU's authors also
  maintain a React Native WebGPU binding backed by Dawn, which is native
  WebGPU _outside_ any WebView, and Chrome for Android has had WebGPU
  since 121. Neither of those is the Android System WebView that a
  Capacitor app renders inside, so the showcase can be entirely real
  without settling our case.

None of the three is a measurement of our runtime, and the question is
worth an actual answer because it decides months of architecture. So the
app asks the device: Settings → tap the version line → the **Graphics**
row, shipped in the mic-fix PR. The **Engine** row alongside it reports
`Android WebView <version>` versus `Chrome <version>` (they differ by a
single token in the user agent), so there is no ambiguity about what was
measured.

Until that reads back from the tablet, **assume WebGL2 and design so the
answer changes performance rather than architecture** — which the
layering below achieves. If the answer is yes, TypeGPU shares three's
device and we get compute; if it is no in the WebView but yes elsewhere,
the desktop-web funnel still carries the "Powered by TypeGPU" story, and
the app is unaffected either way.

### 5.2 The stack

| Layer                                | Choice                                                           | Why                                                                                                                                                                                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scene, assets, materials             | **three.js r185** (`WebGPURenderer`, automatic WebGL2 fallback)  | glTF loading, PBR, cameras, `BatchedMesh` — all the parts we would otherwise write badly. One renderer object covers both backends, so the WebGPU answer above changes performance, not architecture                                                                           |
| Custom GPU work, where WebGPU exists | **TypeGPU**, sharing three's `GPUDevice`                         | r185's WebGPU backend accepts an externally supplied device, and our `TypeGpuGlassRenderer` already uses `tgpu.initFromDevice` — so the "Powered by TypeGPU" mandate survives on the desktop-web funnel without forking the game                                               |
| Shard motion                         | **Bespoke integrator**, extending the 2D `stepShardBodies` to 3D | ~0.2ms and no dependency. Baked/bespoke shard motion is the shipping-industry default for this effect (the VAT technique), and we already ship its 2D cousin                                                                                                                   |
| Real physics, only if needed         | `@dimforge/rapier3d-simd` (~758 KB gz, lazy)                     | Only if shards must collide with the pedestal and each other. Do **not** use `three/addons/physics/RapierPhysics.js`: it fetches a pinned old build from a third-party CDN at runtime (fatal offline in a Capacitor app) and falls back to trimesh colliders on dynamic bodies |

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

`BatchedMesh` is the right primitive: one draw call for many _different_
geometries sharing a material, with per-instance matrices and
visibility. (`InstancedMesh` is wrong here — different geometries mean
one draw call each.)

**The environment map should be procedural, not a photograph.** three's
`RoomEnvironment` is about 5 KB of source that builds a room out of
emissive boxes and feeds it to the PMREM generator; a 1k HDR is ~1.4 MB
and gzips badly. Our scene _is_ one room, so that trade gives
essentially the right reflections for nothing. PMREM output is 256²
either way, so a real HDR would be downsampled to that regardless.

### 6.4 Merc

Recommendation: **a billboard of the existing 2D art**, camera-facing,
with a soft contact shadow. It keeps the brand character exactly as
drawn, costs no modelling, and reads as a deliberate style rather than a
compromise. A 3D Merc can come later without changing anything else.

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
- **The break**, layered in four: the resonance swell that precedes it,
  a sharp crack transient, a shard tail of 1.5–3s, then the settle. Thick
  glass wants a dull low body _before_ the bright fragments; thin glass
  does not. Ship dry — no baked reverb, so the room can own its own.
- **Schedule against `audioContext.currentTime`, never `rAF`**, and lead
  the visual by the context's reported output latency. Audio-visual sync
  in an Android WebView is the real risk here, and the fix is to treat
  the audio clock as the master — which is also what §4a does for pitch.
- **One AudioContext**, shared with the pitch pipeline that already
  exists. Resume on the same gesture that starts the game.
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
on the tablet) before the next begins.

| Slice | Contains                                                                                                       | Done when                                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | The Cabinet: room, glass, voice coupling, shatter, sound, score card, plus the tuning panel and frame HUD (§8) | 60fps on the tablet, shards persist, the card shows real units and a grade, and every feel number is draggable and dumps back to config |
| 1     | Merc: kinematic controller, camera, one glass wall to break to pass                                            | The wall breaks because of a note, and Merc walks through the hole                                                                      |
| 2     | Standing Wave Chamber A/B/C, the harmonic ladder HUD, the comedy fall                                          | The three chambers are playable end to end and scored                                                                                   |
| 3     | Polish: juice pass, haptics, reduced-motion path, load time                                                    | Passes the perf gates on a mid Android                                                                                                  |
| 4     | The next mechanic                                                                                              | —                                                                                                                                       |

---

## 10. Risks

- **WebGPU coverage on Android WebView** decides whether the 3D world
  gets compute or has to fake it. No longer argued from compat tables:
  the app measures it and reports it in Settings (§5.1), and the plan
  targets WebGL2 either way.
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

1. Camera: third-person behind Merc, or a fixed cinematic camera per
   room that frames the glass like a stage? (The stage framing is
   cheaper, more brand-consistent, and much easier to make beautiful.)
2. Is Merc a 3D model, or a billboard of the existing 2D art standing in
   the 3D room? The billboard keeps the brand art exactly, costs
   nothing, and reads as deliberate.
3. Does the 3D world live inside Beside Cue, or become its own app for
   the store? It is currently planned as a mode inside Beside Cue.
