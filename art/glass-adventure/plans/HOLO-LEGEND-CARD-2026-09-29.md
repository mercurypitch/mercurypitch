# Holo Legend Cards: teardown, plan, prompts and agent skills

**Date:** 29 September 2026 · **Status:** research and plan; nothing implemented.
**Companion page:** https://claude.ai/artifact/MnarQeo8URAXJM8k67h3CA (private
to the owner until shared). It carries a live study of the technique, with
original procedural art, that you can sing to, shatter and pull apart layer by
layer.

This document answers four questions:

1. How was the ThreeUI "Dark Souls Holo Card" built? (section 1)
2. How would the same technique become the finale portrait of each island in
   the glass game, the "boss shatter"? (section 2)
3. What art, prompts and preprocessing does one card need? (section 3)
4. Which skills from `github.com/mengto/skills` are worth installing, which
   need changes, and which conflict with our rules? (section 4)

Section 5 holds paste-ready prompts for each phase. Section 6 lists risks and
the decisions reserved for the owner.

---

## Summary

- **It is a shadowbox of flat shader layers, not a 3D model.** Roughly fifteen
  planes sit up to 1.5 card-units deep behind a window cut into a gold frame.
  They are clipped to that window and lit by one shared light, one shared
  prismatic "sweep" band and one shared scan pulse, then bloomed and
  film-finished. Tilting the card shows real parallax between the planes. That
  parallax, plus foil that changes with viewing angle, is what reads as
  holographic.
- **It fits our game as the Legend Card.** It would be the last portrait of each
  island: `portrait-awakened-muse` (Glassworks), `portrait-interval` (Twin
  Galleries) and `portrait-wave-keeper` (Conservatory). The portrait waits
  behind resonant holo glazing. The finale note shatters the glazing, and the
  foil shards glint as they fly. A scan pulse then "awakens" the portrait. The
  card lifts, spins and flips to show the island crest, then lives in the
  Museum Collection, where it can be tilted and flipped at any time.
- **Build it ourselves, as two renderers sharing one material library.** The
  in-world card runs on the existing single-pass renderer: no composer, no
  stencil, glow faked with halo quads. The Collection inspector gets its own
  renderer, with bloom, a finish pass and gyro tilt.
- **Make the foil a voice channel, not only decoration.** On each island the
  sweep band answers what that island teaches: hold progress, the low/high
  pair, or gentle pitch sway.
- **Skills.** Install 11 of mengto's 146 skills now and adapt about 9 more for
  art and asset work. Skip the rest. Do **not** install `workflow-ship-change`:
  it pushes to `main`, publishes live and adds attribution trailers, all of which
  AGENTS.md forbids. That repo has no Blender skill. Mirror our own
  `.agents/skills/game-asset-production` into `.claude/skills/`, where Claude
  Code sessions can see it, and consider BlenderMCP on a local machine.

---

## 1. The reference, taken apart

### 1.1 What loads

`https://threeui.com/dark-souls-holo-card` is a React shell. It mounts a
sandboxed iframe of `/landing-pages/dark-souls-holo-card.html` only while the
card is on screen and the tab is visible. The catalogue entry describes the
scene this way:

- "Full HTML + Three.js r180 + custom GLSL + embedded models and textures"
- "Three.js card composer with render, bloom, and finish passes, plus the
  shrine render pipeline"
- "44 embedded resources: 37 WebP images, five GLB models, and two WOFF2 fonts"
- "Pointer tilt and lighting, drag rotation, double-click or F to flip, wheel
  zoom, arrow keys, R to reset, responsive layout, and reduced motion"

The page holds two scenes:

1. **The card**, the part we want: about 1,100 lines of GLSL and JavaScript.
2. **The sword shrine**, which we do not need. It is a separate 3D render with a
   procedural greatsword, GLB altar, roots and flowers, ground fog and
   depth-of-field bokeh, drawn into a render target behind the card. The
   wrapped grip and sun-shaped guard at the top of the screenshot belong to that
   sword. The card hangs in front of it.

Licensing: the item is tagged free. ThreeUI's terms put "Community" package
code under MIT with attribution required. The item page does not say whether
this item counts as Community code. The art is Dark Souls fan art (FromSoftware
IP). **Treat the code as a reference, write our own, and never ship its art,
names or symbols.**

### 1.2 The layer stack

The card measures 6.3 by 9.45 units (2:3). The camera sits at z = 32 with a 20
degree field of view, which is close to orthographic. Parallax therefore comes
from the layers' depth, not from lens distortion. Lower render order draws
first.

| Order | Layer                   | z (card units)              | Blend                     | Job                                                                                                           |
| ----: | ----------------------- | --------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
|  -100 | Backdrop                | screen                      | opaque                    | Shrine render or a procedural dark vignette, plus the floating card's soft shadow                             |
|   -50 | Window mask             | +0.001                      | colour off, stencil write | Writes stencil = 1 wherever the frame is transparent (the window)                                             |
|   -40 | Background plate        | -0.42 to -1.42              | opaque, stencil test      | 180 x 260 grid displaced by a depth map; heat shimmer, firelight, the knight's cast shadow, contact shadows   |
|     2 | Far fog                 | -1.0                        | alpha, stencil            | Domain-warped fbm fog, rendered into a 512 x 768 half-float target and sampled by both fog planes             |
| 2.5-4 | Smoke, flame, cinders   | at the fire's sampled depth | alpha / additive          | Procedural blackbody flame, smoke plume, 286 instanced cinders                                                |
|     5 | Near fog                | -0.3                        | alpha, stencil            | A second fog bank                                                                                             |
|   5.5 | God rays                | -0.14                       | additive, stencil         | 44-tap radial blur of a rays mask; breathing shafts, drifting dust                                            |
|     6 | Window rim shadow       | -0.05                       | alpha, stencil            | Inner shadow of the frame, pushed away from the light                                                         |
|     8 | Holo laminate           | +0.003                      | additive, stencil         | Sunburst diffraction grating, sweep band and glitter over the window only                                     |
|    20 | Frame (card front)      | 0                           | alpha                     | Normal-mapped gold, studio reflections, glitter, glowing gems                                                 |
|    22 | Subject shadow          | +0.006                      | alpha                     | The knight's drop shadow on the frame, offset by the light                                                    |
|    24 | Subject                 | helm +0.17, feet -0.26      | alpha                     | Cut-out knight on a leaning plane: rim light, firelit edge, emissive slits, laser-etched hairlines            |
|    26 | Title type              | +0.012                      | alpha                     | Foil and ink lettering with embossed normals                                                                  |
|    27 | Scan sparks             | card surface                | additive points           | 900 sparks that lift off the surface as the intro pulse passes                                                |
|    40 | Room cinders and ash    | world                       | additive                  | 200 particles drifting in front of and behind the card                                                        |
|     0 | Back, edge, back layers | -thickness                  | opaque / alpha            | Gold back with a lacquer clear-coat, two rotating medallion plates, a ticking dial, a live fire in the centre |

### 1.3 Six tricks that make depth cheap

1. **Stencil window.** The frame writes stencil wherever its alpha is below 0.5.
   Every layer inside the card tests for stencil = 1. The deep diorama can never
   show past the frame, even at extreme tilt.
2. **Registered depth.** Each recessed plane is scaled by `(camD - z) / camD`
   and so is its position. Face-on, the composition lines up exactly like the
   flat painting. The layers only separate as the card turns.
3. **Relief plate.** The background painting is a 180 x 260 grid. Each vertex
   is pushed back by the painting's own depth map (`fx.a`) with the same
   registration rule. The painting becomes a bas-relief.
4. **Leaning subject.** The knight is one plane rotated about X. His helm stands
   in front of the frame and his feet sit behind it. This is the cheapest
   possible pop-out.
5. **Overscan.** The plate extends 25 to 30% beyond every side of the painting,
   with mirrored wrapping as a fallback. Parallax never reveals an edge.
6. **Shadows as compositing.** No shadow maps. The knight's long shadow on the
   floor is his matte, sampled along a sheared direction in the plate shader.
   Contact shadows are hand-placed Gaussian ellipses under his boots and the
   sword tip. Heat shimmer is a noise UV offset inside a mask above the fire.

### 1.4 Eight ingredients of "holographic"

1. **One shared light and one shared sweep.** Every layer evaluates the same
   function `sweepX(cardUv, viewDir)` in card space. It is a Gaussian rainbow
   band whose position depends on the view and light vectors projected onto the
   card's tangent frame. Because every layer uses card UV, the etching, film,
   gilding and foil letters light up as one band crossing one object.
2. **Sunburst diffraction grating** (the laminate). With `h = viewT + lightT`,
   h is zero at the mirror angle. Rays radiate from the arch keystone as
   `(0.5 + 0.5 cos(90 * angle))^2`. Hue follows
   `dot(h, radialDirection) * 2.4 + radius * 1.6`, so the rainbow slides along
   the rays as the card tilts, like embossed foil. A high-frequency noise
   "tooth" breaks it into grain. The whole laminate is multiplied by 0.52 so
   that, in the code's own comment, "the painting stays the subject".
3. **Glitter flakes.** A cell grid, 120 x 180 on the frame and 150 x 225 on the
   laminate. Each cell holds one flake 30 to 40% of the time, tilted at random.
   A flake flashes only when its own normal lines up with the half-vector
   (exponent 300 to 420), tinted by a random hue.
4. **Normal-mapped gold.** Frame and back textures pack a tangent-space normal
   (RG), a gold mask (B) and a rim channel (A). Gold uses F0 derived from the
   albedo, a Fresnel term and a small "studio" environment function: dark floor,
   warm fire bounce low on the left, cool rim on the right, and a glare softbox
   that follows the pointer. The highlight is a tight Blinn lobe (exponent 120).
5. **Laser-etched hairlines from a distance field.** The line art is reduced to
   centre lines and stored as a distance field (`lineart_df`). The shader draws a
   line one device pixel wide at any zoom by measuring art texels per pixel with
   `fwidth`. It shows only inside the sweep band and mostly while hovering, so
   the engraving flashes as the light rakes across it. In the code's words: at
   rest, almost nothing, "or it reads as traced".
6. **Emissive masks and HDR bloom.** The visor slit, sword fuller, gems, flames
   and embers go above 1.0 in a half-float target. `UnrealBloomPass` (strength
   0.42, radius 0.38, threshold 1.15) blooms only those.
7. **Finish pass.** Radial chromatic fringe (constant in device pixels), Khronos
   PBR Neutral tone mapping, a vignette, sRGB conversion, and triangular film
   grain weighted towards the midtones.
8. **The scan pulse (intro).** A sphere grows from the fire with radius
   `R = K * t^e`. K and e are solved so the front reaches (roughly) the nearest
   point of the card at 1.35 s and passes the farthest at 2.3 s. Ahead of the front the card is
   dark. The front itself is a 1.5 px white-hot line. Behind it, each layer's
   own "wire" burns white-gold, then cools through orange to ember red, and
   sparks lift off the surface. The wires are the plate's depth contours, the
   subject's silhouette and hairlines, the frame and gold outlines, and the
   letter outlines.

### 1.5 Motion and interaction model

| Behaviour      | Rule in the reference                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Pointer input  | Offset from the card's screen centre: x / 0.45, y / 0.5 of the viewport, clamped to +-1.3                           |
| Hover weight   | Eases in at rate 5/s and out at 1.4/s; counts as hovering for 2.6 s after the last move                             |
| Hover target   | pitch = -y _ 0.36 rad, yaw = x _ 0.52 rad                                                                           |
| Idle sway      | pitch 0.1 sin(0.53 t + 0.6), yaw 0.36 sin(0.37 t)                                                                   |
| Spring         | stiffness 34 (16 during the first 2.2 s), damping 0.72 of critical                                                  |
| Drag           | 0.0085 rad/px yaw, 0.0065 rad/px pitch, pitch clamped to +-0.95; velocity estimated with a 0.55 / 0.45 blend        |
| Release        | Inertia decays as e^(-2.6 t); below 0.9 rad/s it snaps to the nearest face                                          |
| Flip           | Target face += pi (double-click or F); R resets; arrow keys add angular velocity                                    |
| Idle rules     | After 6 s idle on the back it flips home; after 15 s idle it makes one 6 s ease-in-out 360 degree showcase spin     |
| Light          | Wanders when idle; follows the pointer when hovering: L = (1.15 x, 0.48 + 0.85 y, 0.9)                              |
| Intro          | Rises from y = -3.2 over 1.9 s (ease-out cubic), scales 0.86 to 1, then bobs +-0.07 with a slight roll              |
| Fire flicker   | 0.82 + 0.2 n(2.3 t) + 0.12 n(7.9 t) + 0.06 n(17.3 t), where n is 1-D value noise; drives one shared `uFire` uniform |
| Zoom           | Wheel, clamped 0.8 to 1.35                                                                                          |
| Reduced motion | No sway, bob or roll; constant fire; direct interaction still works                                                 |
| Gyroscope      | Not supported. We add it for phones.                                                                                |

### 1.6 Engineering worth copying

- **Warm-up before the first frame.** `renderer.compileAsync` runs on the whole
  scene and on every post-processing material, and `renderer.initTexture` on
  every texture, so the card never hitches when it appears. We already own a
  seam for this: `render/program-precompile.ts`.
- **A frame-time governor.** At load it measures GPU cost by rendering and
  calling `readPixels` to force a sync. It then samples windows of 45 frames. On
  sustained misses (average above 18.5 ms, or 3 frames above 21 ms) it steps the
  render scale down to 0.8, then 0.6. After 8 calm windows it tries stepping
  back up, and a failed trial doubles the hold-off, up to 600 s. The pixel ratio
  is bounded by a 16-megapixel budget rather than a fixed cap.
- **Honest staged loading** ("Gathering embers", "Raising the shrine") with a
  real progress value.
- **A deterministic capture hook.** `window.__holo.pose(rx, ry, t, light,
hover)` freezes the clock and poses the card, and `shot()` returns a PNG. This
  is how the preview video and thumbnails were made. It is also exactly what our
  screenshot tests and scorecards need: headless previews pause
  `requestAnimationFrame` (INDEX section 7).
- **Per-map colour spaces.** Albedo textures are sRGB. Packed data textures use
  `NoColorSpace`. Anisotropy is set to the maximum.
- **HDR through an 8-bit target.** The shrine's scan glow is carried in the
  backdrop texture's alpha channel and lifted back into HDR
  (`colour *= 1 + (1 - alpha) * 4`), so it still blooms.

---

## 2. Legend Cards in the glass game

### 2.1 What exists today

- `packages/glass-game` renders with Three.js r185 on one single-pass
  `WebGLRenderer` created without a stencil buffer (`render/glass-renderer.ts`),
  with ACES Filmic tone mapping at exposure 0.9. Pixel ratio is capped at 1.5
  (high) or 1.25 (balanced) by `render/render-quality.ts`. There is no
  EffectComposer and no bloom.
- Portraits are breakables. `render/catalog.ts` defines `collectedPortrait()`
  recipes on the `legend-slab` bundle (16 authored shards), with
  `portraitFracture: 'picture-bearing'` and a `persistentPortrait` plane "used
  before fracture and for the collected reward". The glass is a
  `MeshPhysicalMaterial` with transmission 0.97 and iridescence 0.8.
- `render/vessels.ts` builds the portrait and its shards. Deterministic fracture
  is owned by `render/shatter-motion.ts`, `render/shatter-burst.ts` and
  `render/fracture.ts`.
- `ui/MuseumCollection.tsx` and `ui/ArtworkInspection.tsx` show collected art as
  flat images.
- `OPTIONAL-EXHIBITS-REWARDS-PORTRAIT-FINALES.md`, in this folder, plans a
  "painting glazing" finale and reserves two questions: whether a portrait sits
  behind separate glazing, and how it is presented after it breaks. The Legend
  Card is a concrete answer to both.

### 2.2 Which portraits become Legend Cards

Only the last portrait on each island. Everything else keeps today's treatment,
so the Legend Card stays special.

| Island                | Level                              | Variant                  | Painting                     |
| --------------------- | ---------------------------------- | ------------------------ | ---------------------------- |
| First Light Island    | Glassworks, Gallery 01             | `portrait-awakened-muse` | "She who woke the glass"     |
| Twin Galleries Island | Twin Galleries, Gallery 02         | `portrait-interval`      | "The Interval Between"       |
| Conservatory Island   | Resonance Conservatory, Gallery 03 | `portrait-wave-keeper`   | "The keeper of gentle waves" |

All three subjects are imaginary muses, which keeps us clear of likeness rights.
The legacy `portrait` variant uses the `legend-johnny-cash` texture. It should
not become a trading card of a real person without a rights and
representation review.

### 2.3 The finale beat sheet

The game's tone is gentle: "You do not need a bigger voice." So this is a boss
beat in structure only (a bigger stage, readable phases, a special reward),
never a harder test. The times below are the ones the companion study runs,
in seconds after the glazing breaks; tune them in play.

| Beat      | Time       | What the player sees                                                                                                                                                                                                              | Built from                                                       |
| --------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Approach  | -          | The card stands in the finale cabinet behind holo glazing. The sweep band and glitter follow Merc and the camera. The diorama inside shows real parallax and slow dust. It reads as "this one is different" from across the room. | In-world card material, laminate on the intact glazing           |
| Resonance | while held | The foil answers the voice (section 2.4). Hairline cracks grow from the impact point. The portrait's etched lines start to glow. The breath grace and decay of today's hold judge stay exactly as they are.                       | `uResonance` from the hold judge; existing crack field           |
| Shatter   | 0-1.7 s    | The glazing breaks into its authored shards. Each shard carries the laminate, so every piece flashes rainbow as it tumbles. A burst of foil flakes lifts off the surface and glints until about 2.4 s.                            | `legend-slab` shards with the laminate material; `shatter-burst` |
| Awakening | 0.25-2.7 s | A scan sphere grows from the impact point. Ahead of it the portrait is dim. The front is a white-hot line. Behind it the portrait's own lines burn white-gold and cool to rose, and sparks lift off.                              | Scan uniforms shared by every card layer                         |
| Lift      | 1.9-3.8 s  | The card rises out of the cabinet (ease-out cubic) and grows slightly.                                                                                                                                                            | Card root transform                                              |
| Spin      | 2.6-5.8 s  | One and a half showcase turns, ending on the back, while the card's own foil film fades in.                                                                                                                                       | Card root transform, foil material                               |
| Reveal    | 5.8-8.6 s  | The back: island crest and a medallion ring whose three stars light one by one (5.9 to 6.8 s).                                                                                                                                    | Back layers                                                      |
| Collect   | 8.6-9.8 s  | It flips home and settles, then flies to the collection icon and the end-level scorecard opens.                                                                                                                                   | Existing completion flow                                         |

**Reduced motion:** the glazing fades out in 0.24 s, the same as the veil. A
single soft brightening replaces the scan. There is no spin. The card appears
face-on, and its back is shown on request.

**Rules carried over from the portrait plan:** collecting a card never depends
on earning two or three stars; success is saved before any effect plays; and a
completed visit restores the settled card without replaying the shatter.

### 2.4 The foil as a voice channel

A VFX effect should carry gameplay meaning before spectacle. Here the sweep band
does:

- **Glassworks, held note.** Hold progress drives three visual stages: the band
  brightens at 35%, cracks spread at 70%, and the glazing shatters at 100%. The
  judge is unchanged. These are visual stages, not extra tests.
- **Twin Galleries, low/high pair.** The card is split between warm sunset and
  cool sky, like the painting. The low note lights the warm half's foil and the
  high note lights the cool half's. Once both are lit, the band travels from one
  singer to the other ("the space between them became a path") and the glazing
  breaks.
- **Conservatory, gentle waves.** The band's position follows the singer's
  gentle pitch sway (cents from the home note mapped to a band offset), so the
  foil literally waves with the voice. A steady note keeps it still, which is
  also fine.

### 2.5 Architecture

Two renderers share one material library.

- `packages/glass-game/src/render/holo-card/` (new)
  - `holo-card-materials.ts`: ShaderMaterial factories sharing one uniform
    block: `uTime`, `uLightDir`, `uCardRot` (mat3), `uFoil`, `uHover`,
    `uResonance`, and the scan uniforms. GLSL chunks: `studio()`, `sweepX()`,
    `glitter()`, `hue()`, `iso()`, `hairline()`, plus the scan. Include
    `<tonemapping_fragment>` and `<colorspace_fragment>` so the output matches
    the ACES pipeline, as `render/crystal-interior.ts` already does.
  - `holo-card-rig.ts`: builds the layer stack (plate, subject, laminate, frame,
    type, back, edge) from a `HoloCardRecipe`. Returns
    `{ root, update(dt, input), setScan(), dispose() }`.
  - `holo-card-portal.glsl.ts`: a stencil-free window test. Each inner fragment
    intersects its view ray with the card's front plane, samples the frame alpha
    there, and discards if the frame covers it. This works on our main renderer,
    which has no stencil buffer, and costs one texture read.
  - `holo-card-motion.ts`: a pure, unit-tested state machine implementing the
    rules in 1.5. Input comes from the pointer or the gyroscope, and it has a
    reduced-motion branch.
  - `holo-card-scan.ts`: pulse timing, solving K and e from the card's nearest
    and farthest distances.
- **In the world:** add a `holoCard?: HoloCardRecipeId` field to
  `BreakableRenderRecipe`, consumed by `render/vessels.ts`. The laminate replaces
  the glass material on the intact glazing and rides the picture-bearing shards.
  With no bloom available, glow comes from additive halo quads, and emissive
  values stay under the ACES shoulder.
- **In the inspector:** `ui/HoloCardViewer.tsx`, lazily loaded from
  `MuseumCollection`. It has its own canvas and renderer (stencil on) and an
  `EffectComposer` chain: render, bloom, finish. Input: pointer tilt, drag,
  double-tap to flip, and the gyroscope on phones (iOS needs permission,
  requested from a tap). It pauses when hidden or offscreen and disposes
  everything on close.
- **Content:** `content/legend-cards.ts` holds one `HoloCardRecipe` per island
  finale: asset IDs, title and subtitle, subject rectangle, depth range, lean,
  light anchors and palette. Assets resolve through `host.assetUrl`, like every
  other bundle.

### 2.6 Budgets (to confirm on devices)

| Surface   | Draws | Textures (decoded)                     | Extra render targets | Frame target                                           |
| --------- | ----: | -------------------------------------- | -------------------- | ------------------------------------------------------ |
| In-world  |  <= 8 | <= 2 MB per card on the mobile profile | none                 | No regression on the balanced profile during the burst |
| Inspector | <= 16 | full set, 1024 to 2048 px              | bloom chain only     | 60 fps on a mid Android at pixel ratio 1.25            |

Balanced-profile fallbacks, in order: drop the glitter, halve the plate grid,
shrink the bloom target, then step the render scale down (1, 0.8, 0.6), as the
reference's governor does.

### 2.7 Delivery plan

Each phase ends with a gate you can look at.

| Phase                          | Work                                                                                                                                    | Gate                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Decide (half day)           | Confirm the three cards, the art direction (3.3), and what the back shows                                                               | Owner sign-off on section 6's open decisions                                                                                                                           |
| 1. Study (2-3 days)            | Dev-only route `/glass-game/?study=holo-card`: one card with placeholder art, the full motion model and the deterministic `pose()` hook | Side by side with the reference at four fixed poses; the laminate reads at arm's length on a phone; 60 fps in a 390 x 844 viewport on the balanced profile             |
| 2. Art (2-4 days, in parallel) | One card's full layer set, using the prompts and scripts in section 3                                                                   | Layer contract checks pass (alpha, sizes, colour spaces), and the card reads well with every effect switched off: art first                                            |
| 3. Inspector (2 days)          | `HoloCardViewer` in the Collection: bloom, finish, gyro, reduced motion, disposal                                                       | Memory returns to baseline after 10 open/close cycles; focus trap, Escape and a screen-reader label work                                                               |
| 4. Finale (3-4 days)           | Laminate on the glazing and shards, voice coupling, awakening scan, lift/spin/flip/collect, saved-state restore                         | Deterministic replay from a seed; a completed visit restores without replaying; the reduced-motion path works; frame time during the burst is measured on a mid device |
| 5. Score (1-2 days)            | Score every beat against the reference and iterate                                                                                      | Every rubric item reaches 8/10, judged by an independent agent from captures                                                                                           |

### 2.8 Scorecard for phase 5

Use `workflow-score-to-target`. Each item scores 0 to 10, built from five
criteria worth 0 to 2 points each. The benchmark is the ThreeUI card captured at
the same poses. Its page exposes `window.__holo.pose()` and `shot()`, so the
reference captures can be deterministic too.

| Item               | Criteria (0-2 each)                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| Tilt feel          | Settle time, overshoot, drag inertia, snap to a face, idle sway                                             |
| Foil read          | Rainbow follows the angle, sweep band unity, grain and tooth, glitter density, stays subordinate to the art |
| Gold               | Normal detail, specular tightness, studio reflections, gem glow, edge gilding                               |
| Depth              | Parallax separation, no edge reveal, subject pop-out, fog and dust layering, window rim shadow              |
| Awakening          | Front width and heat, wire cooling, timing across the card, sparks, reduced-motion still                    |
| Shatter            | Shards carry the foil, flake burst, silhouettes, no pops, cleanup                                           |
| Choreography       | Lift easing, spin, flip, landing, hand-off to the scorecard                                                 |
| Mobile performance | Frame time, memory, thermals over 5 minutes, load time, no hitch on the first frame                         |

---

## 3. Art pipeline

### 3.1 Layer contract, per card

| File                                   | Size                                      | Colour space | Channels                                                                                            |
| -------------------------------------- | ----------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| `plate.webp`                           | 1536 x 2304 (130% overscan of the window) | sRGB         | RGB: the scene behind the subject, with the subject's area painted as empty floor                   |
| `plate_aux.webp`                       | 768 x 1152                                | data         | R: emissive (lamps, windows); G: fog-density hint; B: unused; A: depth (0 near, 1 far)              |
| `subject.webp`                         | 1024 x 1536                               | sRGB         | RGBA cut-out with a clean matte and no halo                                                         |
| `subject_aux.webp`                     | 1024 x 1536                               | data         | R: distance to the nearest line-art centre line, in texels / 6; G: emissive; B: rim mask; A: unused |
| `frame.webp`                           | 2048 x 3072                               | sRGB         | RGBA frame albedo with a transparent window                                                         |
| `frame_aux.webp`                       | 2048 x 3072                               | data         | RG: tangent-space normal; B: gold mask; A: window rim shadow                                        |
| `type.webp`                            | 2048 x 3072                               | data         | R: foil letters; G: ink letters; B: emboss height; A: drop shadow                                   |
| `back.webp`, `back_aux.webp`           | 2048 x 3072                               | sRGB / data  | As for the frame                                                                                    |
| `medallion.webp`, `medallion_aux.webp` | 1024 x 1024                               | sRGB / data  | The rotating crest plate on the back                                                                |

Channel packing keeps each layer to one or two texture reads and one decode per
file. For the mobile asset profile, halve every dimension. Move to KTX2 only if
decoded memory says so.

### 3.2 Preprocessing scripts to write

Python with Pillow, NumPy and SciPy, kept beside the art sources. The existing
receipts and hashes habit continues.

- `depth.py`: run a monocular depth model (for example Depth Anything V2) on the
  plate, normalise near = 0 and far = 1, blur 2 px, and write it to
  `plate_aux.a`. Check that the floor gradient is monotonic and that the
  subject's area really is empty floor.
- `hairlines.py`: extract line art from the subject (XDoG, or a generated line
  pass checked for registration), skeletonise it to one-pixel centre lines, run
  `scipy.ndimage.distance_transform_edt`, divide by 6, and write it to
  `subject_aux.r`.
- `normals.py`: turn a height map (a Blender bake or a relief pass) into a
  tangent-space normal with a Sobel filter. Take the gold mask from a colour key
  or a separate mask render.
- `type.py`: set the title and subtitle in an OFL display face at card
  resolution and write the foil, ink, height and shadow channels. Never generate
  lettering with an image model.
- `pack.py`: pack channels, write WebP (lossless for data maps, quality 90 for
  albedo), and emit a manifest of sizes and SHA-256 hashes.
- **Blender**, best for the frame and back: model the frame at true scale and
  bake albedo, normal, gold mask and rim AO through an orthographic front
  camera. Author the glazing shards with Cell Fracture, named
  `legend_card_shard_##`, and export them in a GLB beside the intact glazing.
  Follow `.agents/skills/game-asset-production`.

### 3.3 Art direction guardrails

Keep the reference's grammar and change its identity. This is the 70%
"adjacent family" setting from `generate-reference-inspired-brand-worlds`.

- **Keep:** shadowbox depth, a gilt frame with an arched window, a foil title
  cartouche, drifting light, and a finely made card back.
- **Change:** the subjects (our muses), the palette (rose quartz, opal,
  moonstone, celadon, pearl, ivory and gilt over indigo and plum, instead of ash
  and fire), the ornament vocabulary (tuning forks, sound waves, orchid leaves,
  crystal), and the story (resonance and glass, not bonfires).
- **Never:** Dark Souls names, symbols (bonfire, coiled sword, "Ashen One",
  "Link the Fire"), its fonts or its exact layout.
- Run `audit-reference-originality` against the reference before shipping.

### 3.4 Generation prompts

Append this style block to every art prompt:

```text
Style: a luminous museum painting from the Glassworks, a floating glass museum.
Soft oil-paint finish with crisp glass and gilt highlights. Palette: rose quartz,
opal, moonstone, celadon, pearl, ivory and warm gilt, with deep indigo and plum
shadows. Gentle, welcoming mood: wonder, not menace. Clean, readable silhouettes.
No text, letters, numbers, logos, signatures or watermarks. No frame or border
unless asked.
```

**Plate** (the diorama behind the subject). The example is for "She who woke
the glass":

```text
A tall 2:3 portrait painting (1536x2304) of the portrait salon inside the
Glassworks at night. Three depth layers: tall ivory columns at the left and right
edges in the foreground; a colonnade of ivory arches in the middle distance; far
terraces fading into indigo haze. High in the centre, a large crystal rose window
glows with soft moonlight. A pale marble floor with faint golden ripples reflects
the rose window. Leave the central lower third empty: a clear stage of floor where
a figure will be added later. No people, statues or furniture there. One small
amber lantern low on the left; cool moonlight from the upper right. Strong
atmospheric perspective: near forms crisp and warm, far forms soft and cool. Paint
15% of extra scene beyond every edge and keep important details away from the
borders.
```

**Subject** (the cut-out):

```text
Full-length imaginary singing muse: a gown of rose quartz and opal with
crystalline folds, moonstone hair, golden ribbons curling around her, an ivory
halo behind her head. Three-quarter view, standing, feet visible, arms relaxed,
lips softly parted mid-note. Key light: cool moonlight from the upper right. Rim
light: warm amber from the lower left. Isolated on a fully transparent background;
if the model cannot output transparency, use flat pure #00B140 green with no
gradient and no shadow. No floor, ground shadow or other objects. The figure fills
88% of the height, centred, 1024x1536.
```

Then remove the background, check the edges for green spill, and confirm that
the alpha matte has no halo.

**Frame** (concept for Blender, or direct albedo):

```text
Front orthographic view of an ornate collectible-card frame at exactly 2:3
(2048x3072): polished gilt gold with inlaid clear crystal and moonstone. An arched
window opening in the middle, 70% of the width and 60% of the height, with a
round-arched top and a small crystal keystone. Engraved ornament of tuning forks,
sound waves and orchid leaves; no acanthus scrolls, no flames. A blank cartouche
band at the top and a blank nameplate band at the bottom. Four small moonstone
cabochons at the corners. Even, flat studio lighting, no perspective, no cast
shadow. The window opening and everything outside the rounded card edge must be
fully transparent.
```

**Frame relief pass** (only if the model accepts a registration reference):

```text
Using the attached frame image as an exact registration reference, output the same
frame as a grayscale height map: white is the highest relief, black the lowest,
with smooth gradients on bevels. The window and the area outside the card are pure
black. Every edge stays in exactly the same pixel position.
```

**Card back:**

```text
Front orthographic view of a collectible card back at exactly 2:3 (2048x3072)
with rounded corners. Deep indigo lacquer with a fine engraved gilt border. In the
centre, a large circular medallion shaped like a 12-petal crystal rose window;
leave its centre plain, because a separate rotating plate sits there. Around the
medallion, three empty star-shaped settings. At the bottom, a small gilt emblem
of a floating island carrying a glass museum. Transparent outside the card's
rounded rectangle. Flat, even lighting.
```

**Medallion plate:**

```text
A circular gilt openwork medallion: 12 petals radiating like a rose window, with
pierced gaps between the petals. Centred, filling 90% of a 1024x1024 canvas.
Front orthographic, even lighting. Transparent background and transparent gaps.
```

**Twin Galleries and Conservatory variants:** reuse the prompts and swap in each
painting's own description from `content/gallery-artworks.ts`. For "The Interval
Between": two singers on ivory balconies, one in warm sunset and one beneath a
cool blue sky, joined by a golden flower. For "The keeper of gentle waves": moonstone
hair, crystal orchids, soft golden waves. For the Interval card, compose the
plate so the warm and cool halves split at the vertical centre line. Section 2.4
depends on that split.

**Tools already connected to your account.** HiggsField offers image
generation, background removal, upscaling, image-to-GLB (`generate_3d`) and
audio generation. ElevenLabs offers image generation and speech. Both spend
credits. Keep a receipt of every prompt, the model and the output hash, as
`game-asset-production` requires.

---

## 4. Agent skills from `github.com/mengto/skills`

Snapshot reviewed: commit `798db0a` (28 September 2026). It holds 146 skills,
MIT licensed (copyright 2026 Meng To). They are portable `SKILL.md` folders, and
many ship a `demo/` folder and a Codex-only `agents/openai.yaml`.

### 4.1 Verdicts

**Install now.** These are general quality loops and the mechanics this plan
needs.

| Skill                                        | Why it is worth having here                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codex/iterate-until-verified`               | Turns "make it perfect" into an acceptance matrix, splits making from judging, and loops until gates pass or a blocker is proven. Fits AGENTS.md. |
| `workflow/workflow-score-to-target`          | Anchored 0 to 10 rubric, five criteria worth 2 points each, blind judge subagents, before/after scorecards. This is phase 5.                      |
| `workflow/workflow-progress-screenshots`     | Sends captures of the start, key moment and result without being asked. Includes `capture.mjs` and `compare.py` for side-by-side images.          |
| `game-development/create-game-vfx`           | Spec per effect: trigger, owner, duration, meaning, spawn cap, cleanup, reduced-motion equivalent.                                                |
| `game-development/design-game-encounters`    | Boss phases that change the pressure without invalidating what was learned; deterministic starts for each phase.                                  |
| `game-development/build-game-audio-feedback` | Cue map and priorities for the crack, shatter and awakening; audio unlock; visual equivalents.                                                    |
| `web-design/build-wireframe-scan-reveal`     | The same world-space pulse as the card's intro, with tested defaults and lifecycle rules. Use it for the awakening.                               |
| `web-design/add-mouse-driven-orbit`          | Frame-rate-independent damping (`1 - (1 - 0.055)^(dt * 60)`), coarse-pointer rules, rounding settled values. Use it for the inspector's tilt.     |
| `codex/optimize-web-animations`              | Pausing offscreen work, leak audits (rAF, observers, WebGL disposal), route-cycle memory probes.                                                  |
| `3d/3d-retina-resolution`                    | Keeping renderer and composer pixel ratios in sync, the classic bug once the inspector gains a composer.                                          |
| `codex/video-to-superprompt`                 | Turns a screen recording of any effect you like into a builder-ready recreation prompt (ffprobe, ffmpeg frames, layered analysis).                |

**Adapt before use.** Each is valuable but assumes Codex tools or another project.

| Skill                                                                                              | Change needed                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codex/codex-gpt-image-2-5-flare`                                                                  | Keep its transparent-asset contract and `inspect_png.py` alpha verifier. Replace the Codex-only `image_gen.imagegen` tool with whichever generator we use. Rename it, e.g. `transparent-asset-generation`. |
| `codex/generate-reference-inspired-brand-worlds`                                                   | The similarity dial and the list of protected signature elements keep us clear of the reference. Leave out its 3 MB of example images.                                                                     |
| `codex/audit-reference-originality`                                                                | Pre-ship overlap audit against the ThreeUI card. Keep its "originality risk, not legal verdict" language.                                                                                                  |
| `codex/web-technique-to-skill`                                                                     | Once the study works, use it to package our own `holo-card-shadowbox` skill: one mechanism, a demo and acceptance checks.                                                                                  |
| `3d/3d-high-resolution-textures`                                                                   | Colour-space rules for packed data maps, mipmaps, anisotropy, texel density. It overlaps `game-asset-production`; keep it as a reference.                                                                  |
| `3d/3d-high-poly-models`                                                                           | Silhouette versus normal-map detail, and runtime LODs, for the Blender frame.                                                                                                                              |
| `game-development/build-hybrid-game-assets`                                                        | The table of representations (imported, procedural, generated 2D, reference-only) plus provenance. Merge it into our asset skill rather than keeping two.                                                  |
| `ui/no-ai-design-slop`, `ui/audit-ai-design-slop`                                                  | A passive design gate for the inspector UI and card typography. Our own design documents still come first.                                                                                                 |
| `game-development/optimize-threejs-games`, `build-mobile-threejs-games`, `test-playable-web-games` | Short checklists. Our package README already covers most of them; install them if you like the prompts.                                                                                                    |

**Skip.**

| Skill or group                                                                                                                                                                                                                                                                | Reason                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflow/workflow-ship-change`                                                                                                                                                                                                                                               | Commits and fast-forward pushes to `main`, publishes live, merges `main` rather than rebasing, and ends commits with an attribution line. Contradicts AGENTS.md guardrails 2 to 5. |
| `workflow/workflow-threads-manager`                                                                                                                                                                                                                                           | Built for the desktop app's session tools and Meng's changelog rules. It would need a rewrite for the `mcp__Claude_Code_Remote__*` tools.                                          |
| About 80 web-design skills (landing and pricing pages, style systems, scroll storytelling)                                                                                                                                                                                    | Marketing websites, not our game.                                                                                                                                                  |
| Meng-specific: `write-like-meng-on-x`, `x-bookmark-quote-posts`, `daily-ui-inspiration-capture`, `build-daily-inspiration-sites`, `publish-project-to-github`, `elevenlabs-tts` (needs his local voice profiles)                                                              | Personal workflows.                                                                                                                                                                |
| ARPG-specific: `build-isometric-arpg`, `build-threejs-enemy-systems`, `build-game-monster-system`, `tune-enemy-ai`, `design-action-combat`, `build-game-inventory`, `build-game-map-editor`, `build-game-changelog`, `implement-fog-of-war`, `build-vesperfall-review-assets` | We have no combat or enemies. The boss-phase guidance we need is in `design-game-encounters`.                                                                                      |
| `codex/performance-profiling`                                                                                                                                                                                                                                                 | Apple Instruments. Useful only when profiling BesideCue on an iPhone by hand.                                                                                                      |
| `game-development/build-rigged-game-assets`                                                                                                                                                                                                                                   | Not for the card. Revisit for Merc animation work: its manifest template and validator are good.                                                                                   |

### 4.2 Blender

- mengto/skills has no Blender skill. The only mention of Blender is in a tweet
  archive.
- **Ours already exists:** `.agents/skills/game-asset-production` covers Meshy
  and Blender sources through to validated GLB, collision, fracture and audits.
  Claude Code does not see it, because it lives only in the Codex tree (this
  session's skill list does not include it). Copy it into `.claude/skills/`.
- **BlenderMCP** (`github.com/ahujasid/blender-mcp`, published on PyPI as
  `mcp-for-blender`) is a community add-on plus MCP server. It lets Claude
  inspect a scene, run Python in Blender and read viewport screenshots. It runs
  on your own machine next to Blender, not in cloud sessions. Its Python
  execution has full access to that machine, so review it before enabling it.
  It suits the frame and back bakes and the shard authoring.
- Our art scripts already run headless Blender (`bpy`), e.g.
  `art/glass-adventure/crystal-interiors/v1/author_crystal_interiors.py`. The
  cloud container has no Blender, so a cloud session can only run those scripts
  if the environment's setup script installs Blender.

### 4.3 Install recipe

Project scope (committed, so every session gets the skills) goes in
`.claude/skills/<name>/`. Personal scope goes in `~/.claude/skills/<name>/`.
Leave out `demo/` and `agents/` to keep the repository small; the recommended set
is under 500 KB without them.

```bash
# From the repository root. Review the result before committing.
git clone --depth 1 https://github.com/mengto/skills /tmp/mengto-skills
SRC=/tmp/mengto-skills/agent-skills
for s in codex/iterate-until-verified workflow/workflow-score-to-target \
         workflow/workflow-progress-screenshots game-development/create-game-vfx \
         game-development/design-game-encounters game-development/build-game-audio-feedback \
         web-design/build-wireframe-scan-reveal web-design/add-mouse-driven-orbit \
         codex/optimize-web-animations 3d/3d-retina-resolution codex/video-to-superprompt; do
  name=$(basename "$s")
  mkdir -p ".claude/skills/$name"
  rsync -a --exclude demo --exclude agents "$SRC/$s/" ".claude/skills/$name/"
done
cp /tmp/mengto-skills/LICENSE .claude/skills/THIRD-PARTY-mengto-skills-LICENSE
cp -R .agents/skills/game-asset-production .claude/skills/game-asset-production
git -C /tmp/mengto-skills rev-parse --short HEAD   # record the snapshot in the commit message
```

Adaptation notes for our environment:

- Wherever a skill says "Codex Browser" or "the in-app browser", use Playwright
  with the preinstalled Chromium (`executablePath: '/opt/pw-browsers/chromium'`
  in cloud sessions).
- In `workflow-progress-screenshots/scripts/capture.mjs`, set
  `CHROME=/opt/pw-browsers/chromium` and replace `--use-angle=metal`, which is
  macOS-only, with `--use-angle=swiftshader` on Linux.
- Wherever a skill says to commit, push or publish, AGENTS.md wins: no commits
  until asked, never push to `main`, rebase rather than merge, and no
  attribution lines.
- Keep the `THIRD-PARTY` licence file with the skills. MIT requires the notice.

### 4.4 Housekeeping found along the way

`.agents/skills/` (Codex) and `.claude/skills/` (Claude Code) are hand-kept
copies, and all four shared skills have drifted:

- `prod-upd` has release-note steps only in the Claude copy.
- `memory` has its canonical-source pointer only in the Codex copy.
- `game-asset-production` exists only for Codex.
- `jam-two-peer` exists only for Claude.

One canonical tree plus a sync check (like `docs:index:check`) would stop this.
It is out of scope here and was filed as a separate suggestion.

---

## 5. Paste-ready prompts

### 5.1 Install the skills

```text
Read art/glass-adventure/plans/HOLO-LEGEND-CARD-2026-09-29.md section 4 and
AGENTS.md. Install the "Install now" skills from github.com/mengto/skills into
.claude/skills/ exactly as the install recipe in 4.3 describes: no demo/ or
agents/ folders, the MIT licence copied as
.claude/skills/THIRD-PARTY-mengto-skills-LICENSE, and
.agents/skills/game-asset-production mirrored into .claude/skills/. Then apply the
adaptation notes in 4.3 to the copied files: Playwright and
/opt/pw-browsers/chromium instead of Codex Browser, and --use-angle=swiftshader in
capture.mjs. Wherever a skill's instructions contradict AGENTS.md (committing,
pushing, publishing, attribution lines, merging main), add one line at the top of
that SKILL.md saying AGENTS.md wins, and list those spots in your report. Do not
install workflow-ship-change or workflow-threads-manager. Show me the file tree
and the size added, and do not commit until I have reviewed it.
```

### 5.2 Phase 1: the holo card study

```text
Build the Legend Card study for the glass game. Read first:
art/glass-adventure/plans/HOLO-LEGEND-CARD-2026-09-29.md (sections 1, 2.5, 2.6 and
2.7), packages/glass-game/README.md, AGENTS.md and docs/agent/CONVENTIONS.md.

Goal: a development-only route /glass-game/?study=holo-card, excluded from
production like the existing ?layout= proofs. It renders one Legend Card with
runtime-generated placeholder art (canvas textures) and the complete motion model.
No gameplay changes.

In packages/glass-game/src/render/holo-card/ build:
1. holo-card-motion.ts: a pure state machine implementing every rule in the
   plan's table 1.5, plus gyroscope input and a reduced-motion branch. Unit-test
   every rule, including snapping to the nearest face and the idle flip and spin.
2. holo-card-materials.ts: ShaderMaterials sharing one uniform block (uTime,
   uLightDir, uCardRot, uFoil, uHover, uResonance, scan uniforms). GLSL chunks:
   studio(), sweepX(), glitter(), hue(), iso(), hairline(). Include the three.js
   tonemapping and colorspace chunks so the output matches our ACES renderer.
   Write the shaders yourself from the plan's description. Do not copy ThreeUI
   code.
3. holo-card-rig.ts: the layer stack from a HoloCardRecipe. The plate is a
   subdivided plane displaced by depth and registered with (camD - z) / camD. The
   subject stands on a leaning plane. Then the laminate, frame, type, back and
   gilded edge. Clip the inner layers with a ray-plane portal test in the fragment
   shader: the main renderer has no stencil buffer.
4. A window.__holoStudy.pose(rx, ry, t, light, hover) hook for deterministic
   captures, available in development only.

Gates, with screenshots for each (use workflow-progress-screenshots):
- Our card and the reference (threeui.com/landing-pages/dark-souls-holo-card.html,
  posed with window.__holo.pose) side by side at four poses: front; yaw 0.3; pitch
  -0.25; back.
- 60 fps in a 390x844 viewport on the balanced quality profile. Report measured
  frame times, not estimates.
- Reduced motion: no sway, bob or idle spin; interaction still works.
- renderer.info.memory returns to its baseline after 10 mount/unmount cycles.

Rules: no emojis; never destructure Solid props; run the package's vitest for the
new files and pnpm beside-cue:typecheck once before any PR; do not commit until I
review.
```

### 5.3 Phase 4: the finale in the world

```text
Wire the Legend Card into the glass game's island finales. Read first:
art/glass-adventure/plans/HOLO-LEGEND-CARD-2026-09-29.md (sections 2.2 to 2.6),
art/glass-adventure/plans/OPTIONAL-EXHIBITS-REWARDS-PORTRAIT-FINALES.md,
packages/glass-game/README.md, and the phase 1 study in src/render/holo-card/.

Scope: the three variants portrait-awakened-muse, portrait-interval and
portrait-wave-keeper only.
1. Add holoCard?: HoloCardRecipeId to BreakableRenderRecipe and consume it in
   render/vessels.ts. The laminate replaces the glass on the intact glazing and
   rides the picture-bearing shards.
2. Couple the foil to the voice as section 2.4 describes, per island. Do not
   change the hold judge's thresholds, breath grace or decay.
3. Implement the beat sheet in 2.3: shatter, awakening scan, lift, spin, flip to
   the back, collect. Use a deterministic seed. Save success before any effect
   plays. A completed visit restores the settled card without replaying the
   shatter.
4. Implement the reduced-motion path in 2.3.
5. Stay inside the in-world budgets in 2.6. Glow comes from halo quads, not
   bloom.

Gates, with screenshots or a short frame strip for each beat:
- Deterministic replay: the same seed gives identical frames at t = 0.5, 1.5 and
  3.0 s.
- Save and restore: reloading after the finale shows the settled card and
  collection entry with no replay.
- A one-star or ungraded success still collects the card.
- Measured frame time during the burst on the balanced profile, reported against
  the pre-change baseline.
Follow AGENTS.md; do not commit until I review.
```

### 5.4 Phase 5: score against the reference

```text
Use the workflow-score-to-target skill. Items and criteria are in
art/glass-adventure/plans/HOLO-LEGEND-CARD-2026-09-29.md section 2.8. The
benchmark is the ThreeUI card posed with window.__holo.pose at matching poses.
Capture both sides with deterministic poses at 1600x900 and 390x844. Score the
baseline first. Hand the captures and rubric to a fresh subagent that did not do
the work, and take the lower score when two judges disagree. Improve the lowest
items first, one round at a time, sending a side-by-side capture each round. The
target is 8/10 on every item. Report any item that plateaus, with the reason and
what it would take. Save the scorecard beside the plan.
```

---

## 6. Risks and open decisions

**Risks**

| Risk                                                                                   | Mitigation                                                                                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| The reference's art is FromSoftware IP, and its code licence is not stated on the item | Write our own shaders; our own art under 3.3; run `audit-reference-originality` before shipping                     |
| A trading card of a real person (the legacy `legend-johnny-cash` portrait)             | Legend Cards use the imaginary muses; any real Legend needs rights and representation review first                  |
| Mobile GPU: additive laminate overdraw, plate grid, texture memory                     | Budgets in 2.6, the balanced-profile fallbacks, a governor in the inspector                                         |
| No stencil buffer in the main renderer                                                 | Ray-plane portal test, proven in the phase 1 study                                                                  |
| Custom ShaderMaterials drifting from the ACES pipeline                                 | Include the tone mapping and colour space chunks; compare against a `MeshStandardMaterial` swatch in the same scene |
| iOS gyroscope needs a permission prompt from a user gesture                            | Gyro off until the player taps "Tilt with phone"; pointer and drag always work                                      |
| Headless captures freeze with `requestAnimationFrame`                                  | The deterministic `pose()` hook plus `preserveDrawingBuffer` for captures only                                      |
| CSP for textures decoded through `ImageBitmapLoader`                                   | Already documented in the package README: `blob:` in `connect-src` and `img-src`                                    |

**Decisions reserved for the owner**

1. Confirm the three Legend Cards, one per island finale (2.2).
2. Imaginary muses only, or real Legends after a rights review?
3. Does the card back show the stars earned, or only the island crest and date?
   Either is compatible with "collecting never depends on stars".
4. Is gyroscope tilt in the inspector on by default?
5. Approve the per-island voice coupling (2.4), or simplify it to one shared
   behaviour.

---

## Sources

- ThreeUI card page: https://threeui.com/dark-souls-holo-card
- Scene document: https://threeui.com/landing-pages/dark-souls-holo-card.html
  (read on 29 September 2026; three.js r180 from jsDelivr)
- ThreeUI terms, "Commercial use and licenses" section (in the site bundle)
- Agent skills: https://github.com/mengto/skills (commit `798db0a`)
- BlenderMCP: https://github.com/ahujasid/blender-mcp
- Our code: `packages/glass-game/src/render/{catalog,vessels,glass-renderer,render-quality}.ts`,
  `packages/glass-game/src/content/{campaign,gallery-artworks}.ts`,
  `art/glass-adventure/plans/OPTIONAL-EXHIBITS-REWARDS-PORTRAIT-FINALES.md`
