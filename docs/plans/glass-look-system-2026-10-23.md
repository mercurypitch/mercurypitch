# Plan: one glass look for every Glassworks vessel

**Date:** 2026-10-23 · **Branch:** the plan sits on `feat/blender-modeler-skill`;
the work goes on `feat/glass-look-system`, stacked on it · **Status:** approved
by the owner on 2026-10-23 (§13); Phase 0 in progress.

Evidence for every claim below is in
[`art/glass-adventure/proofs/glass-look-research-2026-10-23/`](../../art/glass-adventure/proofs/glass-look-research-2026-10-23/):
the research report, five research notes (glass shading in three.js r185,
lighting glass exhibits, glass fracture, look-development pipelines, and an
audit of what the game does today) and the tone-mapping scripts behind the
colour tables. It follows
[`blender-modeler-skill-2026-10-21.md`](blender-modeler-skill-2026-10-21.md),
whose two rebuilt vessels both stopped on their glass.

---

## 1. Verdict

- **The glass looks wrong because of what surrounds it, not because of the
  vessels' shapes.** three.js r185 transmission shows a blurred copy of the
  opaque room behind the glass, and that copy replaces the material's own
  diffuse light. The galleries give it a wall, one shared set of lights, one
  reflection probe captured at the spawn, and ACES tone mapping that pushes
  amber toward yellow and strips most of the colour from pastel glass.
- **Build one glass look library in the game, approve one look on a fixed
  bench and in one room, then bind it by material name to every exhibit.**
  Amber goes first. No vessel modelling and no per-vessel material tuning until
  amber is approved in its room.
- **For coloured and milky glass, the look that reads best is also the
  cheapest one.** Amber, opal and frosted glass carry their own light: they
  refract a built-in studio environment and add a thickness glow and a
  back-light term, instead of showing the room. That path also skips the
  transmission pass on phones. Real see-through (screen transmission) stays for
  clear crystal on devices that can afford it.
- **Breaking keeps today's design** (pre-authored shards, scripted motion), but
  shards stop rendering as whole transmissive vessels, cut faces turn glossy
  and deeply tinted, and the break pattern starts from an impact point instead
  of even plates.
- **Shape, look and light get separate gates.** Shape is judged against an
  unlit clay reference, a look against its material card on the bench, and a
  vessel in context in the real game. The painted concept stays a mood
  target, never a colour target.

## 2. Why today's glass reads dull

| What the owner sees            | Why r185 produces it                                                 | What the game does that triggers it                             |
| ------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Amber reads as a brown band    | Transmitted colour is tint × absorption × the opaque pixel behind it | A wall behind every exhibit; no backdrop, niche or plinth light |
| Frosted amber turns caramel    | Roughness picks a blurred mip of the same dim surroundings           | Rough transmission at a fixed 0.5 scale                         |
| Opal reads darker than a wall  | Transmission replaces the diffuse lobe that would scatter light      | High transmission on a white base under cyan-tinted room light  |
| Pastels and champagne wash out | ACES strips chroma and pushes oranges toward yellow                  | ACES at exposure 0.9                                            |
| Authored glow vanishes         | Emissive is overwritten every frame                                  | The stress override on every transmissive material              |
| Reflections from another room  | The probe is captured once, at the spawn                             | One probe for all rooms; `envMapIntensity` ignored              |

The facts behind the table, from the audit:

- **Lights.** Every room in a level shares one hemisphere light (0.6), one
  shadowed key (2.5) and one teal rim (0.75)
  ([`glass-renderer.ts:215-241`](../../packages/glass-game/src/render/glass-renderer.ts)).
  No campaign level has a per-room or per-plinth light.
- **Reflections.** One cube capture at `(0, 1.15, -2.8)` serves every room of
  all four campaign levels
  ([`scene-catalog.ts:244-251`](../../packages/glass-game/src/render/scene-catalog.ts),
  [`environment.ts:42-66`](../../packages/glass-game/src/render/environment.ts)).
  r185 replaces `envMapIntensity` with the scene's 0.65 on any material without
  its own `envMap`.
- **Tone mapping.** `ACESFilmicToneMapping` at exposure 0.9
  ([`glass-renderer.ts:151-152`](../../packages/glass-game/src/render/glass-renderer.ts)).
  At that setting the concept gold moves 12° toward yellow, and opal mint,
  opal lavender and champagne lose 57-60% of their chroma. Khronos PBR Neutral
  keeps all of them within about 2° of hue and a few percent of chroma.
- **The vessels.** The catalog's glass recipe never reaches an authored GLB.
  18 of the 26 campaign exhibits are thin-walled DoubleSide shells with no
  volume. The shipped amber urn and celadon decanter transmit nothing at all.
  A per-frame override blanks authored emissive on every transmissive material
  ([`vessels.ts:653-659`](../../packages/glass-game/src/render/vessels.ts)).
  Glass intacts cast fully opaque shadows
  ([`vessels.ts:245`](../../packages/glass-game/src/render/vessels.ts)), and
  shards reuse the intact's DoubleSide transmissive materials
  ([`vessels.ts:422-435`](../../packages/glass-game/src/render/vessels.ts)).

The arithmetic agrees with what the critics kept reporting. Over the wall
measured behind the opal in the game (about 0.38 linear), the concept's amber
becomes ochre `#A06A19` under today's ACES. The concept gold only appears with
about **1.45 linear radiance behind the glass** (Neutral gives `#F3A937`
against the concept's `#F2A93B`). That is four times the brightness of that
wall. No modelling round can supply it; light can.

## 3. The boundary: what a vessel owns, and what the look owns

| The vessel GLB owns                                                      | The look library owns                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Geometry, UVs, the node contract and the shard set                       | IOR, attenuation colour and distance, roughness, coat, sheen, iridescence |
| A thickness map, baked like ambient occlusion                            | The glow and back-light terms, and the studio environment                 |
| Material slot names that name a look (`glass.amber`, `glass.amber.cut`)  | The `cut`, `inner` and `shard` variants, and the technique per tier       |
| A short whitelist of per-vessel overrides: thickness scale, tint density | Tone mapping, exposure and the exhibit light                              |

Three rules keep the boundary:

1. A vessel never carries its own glass optics. Exporters keep writing
   `KHR_materials_volume` so the thickness map survives; every other optical
   value is replaced at load.
2. New exports name their slots by look. Existing GLBs get a name map per
   variant in the recipe, because `glass_shell` means clear glass on the v3
   vessels and opal on the v6 amphora.
3. A transmissive material whose name maps to no look fails a unit test beside
   the manifest checks in
   [`catalog.test.ts`](../../packages/glass-game/src/render/catalog.test.ts).
   It never renders silently with its own optics.

## 4. The look library

### 4.1 `GlassMaterial`

One owned class that extends `MeshPhysicalMaterial`, in a new module
(`packages/glass-game/src/render/glass-material.ts`). Its recipe chooses a
technique:

| Technique | What it does                                                                                                                                                                                                                                                       | Cost                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `studio`  | Transmission 0. Refracts the view ray into the material's own studio environment with `textureCubeUV(envMap, direction, roughness)`, absorbs by the thickness map (Beer-Lambert), adds a thickness-weighted glow and a back-light lobe from the exhibit spotlights | No transmission pass; renders and writes depth like any opaque material |
| `screen`  | three's own transmission, with a blur footprint that does not depend on resolution, so a frost tuned on a desktop holds at 0.5 scale on a phone                                                                                                                    | The transmission pass: one more opaque render per frame                 |
| `blend`   | `studio` plus a small weight of `screen`, High tier only                                                                                                                                                                                                           | As `screen`                                                             |

How it is built, and what keeps it safe:

- `onBeforeCompile` replaces `transmission_pars_fragment` and
  `transmission_fragment` and adds the back-light term after the lights loop.
  This is the route drei's MeshTransmissionMaterial takes. The glass maths stay
  plain GLSL functions, so a later port to WebGPU node materials is mechanical.
- `customProgramCacheKey()` returns the technique flags and the tier. The
  default key is the closure's source text, which would fold different recipes
  into one program.
- A chunk guard throws when three's chunk text changes, as
  [`runner-clear-transmission.ts:10-38`](../../packages/glass-game/src/render/runner-clear-transmission.ts)
  already does. r182 renamed the fields these chunks read, so `three` stays
  pinned and every recipe and tier compiles in the browser suite.
- In `studio` mode GlassMaterial binds the thickness map itself. r185 binds
  `thicknessMap` only when transmission is above 0 (`WebGLPrograms.js:164`).
- Faces are FrontSide by default. DoubleSide is allowed only for whole vessels
  without a modelled inner wall, in `screen` mode. On devices with
  `WEBGL_multisampled_render_to_texture`, three skips back faces, so DoubleSide
  glass looks different from device to device.

Rejected: drei's MeshTransmissionMaterial (one extra scene render per
instance), three-custom-shader-material (a dependency that keeps the fragile
step), and moving to WebGPURenderer (GLSL injection does not carry over, and
its WebGL 2 fallback is a separate backend to test).

### 4.2 The looks

| Look                | Technique on Balanced (phones)                                                                      | Technique on High (desktop)            | Studio                    | First vessel                 |
| ------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------- | ---------------------------- |
| `glass.amber`       | `studio`, glow and back-light                                                                       | `blend` over a lit liner or plinth top | warm bright-field         | Amber Cadence Urn rebuild    |
| `glass.clear`       | `screen` at 0.5, FrontSide; `studio` when the governor drops the pass                               | `screen`                               | cool dark-field strips    | v3 goblet and decanter       |
| `glass.champagne`   | as clear, warm attenuation over a long distance                                                     | as clear                               | cool dark-field strips    | a v3 coupe                   |
| `glass.opal`        | `studio`: white diffuse base, mint sheen, warm back-light, iridescence 0.2-0.4, transmission near 0 | the same, plus low-weight refraction   | warm bright-field         | Opaline Echo Amphora rebuild |
| `glass.frosted`     | `studio` blurred by roughness; no glossy coat over the etch                                         | the same                               | warm bright-field         | Cloudway frost wall          |
| `glass.cut-crystal` | `studio` with faceted normals                                                                       | `screen` with `dispersion`             | sparkle (small hot cards) | glassware trio G22           |
| `porcelain.celadon` | opaque; in the library so the decanter binds the same way                                           | the same                               | warm bright-field         | celadon decanter             |

Rules that hold for every look:

- **One tint, not two.** A white base with a coloured attenuation. Base colour
  and attenuation multiply, so tinting both squares the colour into mud.
- **Every look has three variants.**
  - `.cut`: glossy (roughness 0.03-0.12) and more deeply tinted than the
    shell, through a shorter attenuation distance, because a fracture face is
    glass seen edge-on. Frosted cuts clearer than its surface; opal stays
    milky through.
  - `.inner`: the cavity wall.
  - `.shard`: opaque fake glass for pieces in flight (§6).
- **Trims are not the problem.** Gold, jade and marble keep their authored
  materials. Stone trims keep rough cut faces; that contrast helps the glass
  read.

### 4.3 Binding by name

- **The hook** is `prepareExhibitAsset`, right after `createMaterialTable`,
  where materials are already looped by name
  ([`exhibit-asset.ts:99-141`](../../packages/glass-game/src/render/exhibit-asset.ts)).
  The unshared install, the shared geometry pool and the runner walls all pass
  through it. Pools clone their template for every lease, so one binding
  reaches every vessel
  ([`exhibit-geometry-pool.ts`](../../packages/glass-game/src/render/exhibit-geometry-pool.ts)).
- **Build fresh; do not patch the import.** The amber urn and the celadon
  decanter arrive as `MeshStandardMaterial`. The finish bank's `apply()` erases
  authored base-colour maps and samples uv0 only, and the glassware trio has no
  UVs.
- **The recipe store** is the existing finish bank
  ([`content/material-finishes.ts`](../../packages/glass-game/src/content/material-finishes.ts)),
  extended with the new parameters. The runner keeps its five recipes until it
  is moved over.
- **The per-frame writer** in
  [`vessels.ts:653-659`](../../packages/glass-game/src/render/vessels.ts) adds
  the stress glow on top of the look's own emissive, instead of overwriting it.

### 4.4 Tiers

- **A glass block in the render-quality tiers**
  ([`render-quality.ts:24-48`](../../packages/glass-game/src/render/render-quality.ts)).
  It holds:
  - the technique per look;
  - whether screen transmission is on;
  - the transmission scale;
  - the studio environment size;
  - dispersion;
  - the shard hold time (§6).

  Today the two tiers differ only in pixel ratio, shadow cadence, asset profile
  and load concurrency.

- **A last step for the performance governor** that turns screen transmission
  off. It removes the pass and its second opaque render.
- **Mobile texture downsizing** also covers thickness, clearcoat, iridescence
  and sheen maps
  ([`asset-texture-profile.ts:6-17`](../../packages/glass-game/src/render/asset-texture-profile.ts)).
- **Every number in §4.2 is a structural estimate** until the phone test in
  Phase 2. Nothing has been measured on a phone.
- **Until then, both tiers run glass at maximum quality** (the owner's call,
  2026-10-23): screen transmission at full scale, the largest studio
  environments, dispersion on cut crystal and the full shard hold. Performance
  is measured and the tiers are tuned after the phone test.

## 5. The exhibit light kit

### 5.1 Studio environments

- **Three studios, built at load.** Each is a small scene of emissive panels
  prefiltered with `PMREMGenerator.fromScene`, the way three's
  `RoomEnvironment` is built. Nothing is downloaded.
  - **Warm bright-field** for amber, opal and frosted glass.
  - **Cool dark-field** with vertical strips, for clear and champagne glass.
  - **Sparkle**, made of small hot cards, for cut crystal.
- **Assigned per material** as `envMap`. That makes `envMapIntensity` a working
  control again, and glass stops depending on the spawn probe.
- **Cost:** GPU memory once at load. Nothing per pixel beyond the image-based
  lighting every material already runs.
- **One set of directions** shared by the studios and the resident spotlights,
  so highlights and reflections agree. The separate glass3d chamber game
  already does this
  ([`glass3d/render/environment.ts:67-92`](../../apps/beside-cue/src/games/glass3d/render/environment.ts)).

### 5.2 Resident exhibit lights

- **One or two resident, unshadowed SpotLights** (a top key and a narrow glint)
  follow the nearest exhibit, weighted by distance. This generalises the Dark
  Archive's single re-aimed spotlight
  ([`archive-room.ts:54-83`](../../packages/glass-game/src/render/archive-room.ts)).
- **The light count never changes.** three skips lights under hidden room
  groups, and the spotlight count is part of the shader key, so a light per
  plinth would recompile shaders mid-play. Resident lights join the existing
  warm-up.
- **Light comes from above, not from the side.** Horizontal light makes glass
  look dark.
- **No RectAreaLight.** It costs on every lit pixel, casts no shadows, and its
  lookup table counts against the first-paint budget (about 290 KB of headroom
  left). Softbox shapes belong in the studios.

### 5.3 Light behind and under the glass

- **Emissive plinth tops** under amber, opal and frosted exhibits, like the lit
  glass shelves in museum cases. They read from every viewpoint, which a
  backdrop card does not in a walk-around museum. Backdrop cards are only for
  views the game controls: niches, wall-backed exhibits and the challenge
  camera's axis.
- **An opaque emissive liner inside the cavity** for coloured glass in `screen`
  or `blend` mode, which was the urn critic's own unbuilt idea. It needs about
  1.45 linear radiance to read gold.
- **Glass stops casting opaque shadows** onto the plinth that is meant to glow.
  three's shadow map ignores transmission.
- **Key and fill move toward neutral**, so the warmth comes from the glass. The
  sky-blue hemisphere and teal rim are what turned near-white opal cyan.

### 5.4 Tone mapping

- **Try Khronos PBR Neutral against today's ACES**, on the bench and then in
  one room. three r185 ships it as `NeutralToneMapping`, and model-viewer made
  it its default for colour accuracy.
- **It changes every room, not just the glass.** The tone mapper is
  renderer-wide, so switching re-grades every material and needs exposure and
  lights rebalanced across all four campaign levels. It is the owner's
  decision at checkpoint 2.
- **Bloom stays off.** [`FLOATING-MUSEUM-LIVE.md`](../../art/glass-adventure/plans/FLOATING-MUSEUM-LIVE.md)
  adds it only if measured headroom allows.

### 5.5 Later, not now

- **Per-room probe captures**, at six scene renders per capture. Glass stops
  depending on the probe once it uses the studios.
- **Box-projected reflections.** WebGL would need a shader patch.
- **Baked room light.** glTF carries no lightmaps, and no runtime GLB ships an
  occlusion texture today.

## 6. Breaking

### 6.1 What stays

- **Today's design stays.** Pre-authored shards in the GLB, seeded scripted
  motion, the 0.1 s anticipation and 2.2 s flight, the crack lines, tremor and
  chip burst, and the 14 recorded takes. A stored broken version, swapped in
  under cover of particles, is how Control does it.
- **No physics engine now.** If shards ever have to strike room geometry, use
  Rapier directly: convex hulls, a fixed 1/60 s step, collision groups that
  skip shard pairs. That waits for a phone benchmark of 50-100 bodies, which
  nobody has published.

### 6.2 What changes in the game

- **Shard materials.** At the break, shards switch to their look's `.shard`
  variant: opaque fake glass, FrontSide, studio reflections, faceted normals
  and a faint emissive edge.
  - The hook is `authoredMaterialSelection`
    ([`vessels.ts:422-435`](../../packages/glass-game/src/render/vessels.ts)).
  - With a `studio` look the intact and the shards already render the same
    way, so nothing pops.
  - With a `screen` look, High holds the intact's look for the first 100-200 ms
    of flight; Balanced switches at the break.
  - Shard programs join the precompile and warm-up
    ([`glass-renderer.ts:465-486`](../../packages/glass-game/src/render/glass-renderer.ts)),
    so no shader links on the break frame.
- **Chips** move to the shard look and stop being transmissive
  ([`shatter-burst.ts`](../../packages/glass-game/src/render/shatter-burst.ts)).
  - They grow toward 100-300 splinters on High (fewer on Balanced), emitted
    along the shard edges nearest the impact pole.
  - Glints become 1-3-frame star flashes.
  - Dust stays minimal: a puff reads as stone.
- **Cut faces** turn glossy and deeply tinted through the `.cut` variants. A
  matte cut face is the strongest single cue toward stone or plaster.
- **Sound** gains a randomised debris-tail layer timed to the scripted flight.
  Naughty Dog called the debris tail the most important layer of their glass.
- **Batching** with `BatchedMesh`, one batch per material family, comes only
  if a profile shows draw calls matter.

### 6.3 What changes in the skill

- **Breaks start from an impact point.**
  [`bkit/fracture.py`](../../.claude/skills/blender-modeler/scripts/bkit/fracture.py)
  spreads seeds evenly today, which gives about 20 × 20 cm plates on a 0.6 m
  urn. That reads as pottery. Instead:
  - weight the farthest-point distance by a target size that grows away from
    an impact pole;
  - add 4-6 radial bisect planes through the impact axis.
- **Target split within 16-18 shards:**
  - 8-10 small wedges within a third of the girth around the pole;
  - 4-5 medium pieces mid-wall;
  - 2-4 large pieces at the far wall, lip, neck and foot.
- **The pole sits on the vessel's front.** It is aimed by the facing logic the
  `faceAnchor` recipes already use. Round vessels need one shard set;
  two-handled amphorae may need two.
- **A heavy foot surviving whole is realistic**, but it breaks the recipe's
  rule that no shard holds most of the vessel
  ([`recipes/fracture.md`](../../.claude/skills/blender-modeler/references/recipes/fracture.md)).
  The owner chooses.

## 7. The bench and the three gates

### 7.1 The look-development bench

A development-only page in the glass game build, gated like the development
levels. It runs the real renderer settings (one shared config with
`glass-renderer.ts`), the real `GlassMaterial`, the real studios and the
resident lights. The skill's `three_preview.mjs` cannot stand in: it has
neither the probe nor the emissive override.

| Part         | Contents                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas       | 1024 × 1024 at pixel ratio 1                                                                                                                                  |
| Cameras      | Orthographic elevation, a fixed three-quarter view, eight turntable stills at 45°                                                                             |
| Environments | `RoomEnvironment`; a uniform grey `ColorEnvironment` as an energy check; the game's HDR; the game's exhibit rig (gallery lights, resident spots, plinth glow) |
| References   | A chrome sphere, a 0.18 grey sphere, a colour checker in unlit and lit copies                                                                                 |
| Backdrop     | A checker or stripe card behind every swatch, so lost refraction is visible                                                                                   |
| Swatches     | A sphere, a thick-walled tumbler, a stepped thickness wedge, and one hero vessel per look                                                                     |

How a look is judged on the bench:

- **It must read as its target under all four environments with no
  per-environment edits.** A look that matches under one environment only is
  compensating for that light.
- **A capture script** (Playwright, sharing the server and lock code of
  [`runtime_proof.mjs`](../../.claude/skills/blender-modeler/scripts/runtime_proof.mjs))
  writes named shots and one contact sheet.
- **Metrics:**
  - CIEDE2000 colour difference of each wedge step against the Beer-Lambert
    prediction;
  - checker contrast through frosted glass;
  - mean FLIP against the approved golden. FLIP tolerates the sub-pixel shifts
    refraction amplifies.
- **SwiftShader stalls on transmission targets**
  ([`MISTAKES.md`](../agent/MISTAKES.md), "SwiftShader"). `studio` looks avoid
  the target. `screen` looks need a proven software backend or a timeout and a
  note on the sheet.

### 7.2 The gates

| Gate           | What it judges                                           | Evidence                                                                            | Judged by                                 |
| -------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------- |
| **G0 Shape**   | Silhouette, proportions, closure, budgets, node contract | Clay renders; silhouette IoU against a clay or silhouette reference                 | the model-critic, numbers only, no colour |
| **G1 Look**    | One look, independent of any vessel                      | The bench under four environments; the metrics above against the material card      | the owner; no critic loop                 |
| **G2 Context** | A vessel wearing its approved look, in its room          | `runtime_proof.mjs` shots at fixed checkpoints, with the served asset tier asserted | the owner, once                           |

- **G1 runs once per look.** A change to the library reopens it.
- **G0 and G2 run for every vessel.**
- **Swapping a file into the game stays the owner's call**, in its own commit
  with its manifest receipt.
- **After approval, goldens freeze the look.** Playwright `toHaveScreenshot`
  baselines on the bench canvas catch regressions. The repo has no visual
  baselines today.

### 7.3 What changes in the skill

- **The model-critic stops judging glass colour** against painted concepts.
  This covers [`model-critic.md`](../../.claude/agents/model-critic.md),
  [`qa.md`](../../.claude/skills/blender-modeler/references/qa.md) and
  [`materials-glass.md`](../../.claude/skills/blender-modeler/references/materials-glass.md).
- **Builds name their materials by look.** A vessel's `optics.json` shrinks to
  its thickness maps and the whitelist overrides.
- **The skill's previews use the library's values**, so the skill and the game
  never disagree about a look.

## 8. References

### 8.1 Shape references (clay)

When one is needed:

- **Needed for** a new vessel or prop that has only a painted concept, and as
  the input to an image-to-3D blockout.
- **Not needed for the urn and the amphora now.** Their silhouettes already
  match their concepts (IoU 0.990 and 0.976). The silhouette mask the skill
  extracts is itself a shape-only reference.

Rules:

- **No glass in a shape reference.** Reconstruction collapses on transparent
  materials, and background removal leaves background colour inside glass.
- **One view per image**: an orthographic side elevation in matte mid-grey
  clay, under flat shadowless light, on flat light grey. Most vessels are
  surfaces of revolution, so that one profile defines the body.
- **Extra views** (handles, spouts, pinched lips) are made by editing from the
  first view, changing only the viewpoint.

The prompt for the owner to run in Codex. The first view:

```text
Orthographic side elevation of <the vessel's form only, e.g. a squat urn with
four rounded lobes, a short narrow neck, a rolled lip and a flared round foot>.
The object is centred and upright and fills about 80% of the image height.
The whole object is one opaque matte mid-grey clay material: no glass, no
transparency, no metal, no gold, no gems, no texture, no painted pattern.
Flat, even, shadowless light: no highlights, no reflections, no cast or
contact shadow. Plain flat light-grey background (#D9D9D9), no floor line, no
gradient. Camera exactly at the object's mid-height, looking straight at it:
no perspective, no tilt. Square image, 1024 x 1024. No text or labels.
```

A further view:

```text
Using the attached image as the reference, change only the viewpoint: turn
the object 90 degrees about its vertical axis so the handle is seen in
profile. Keep everything else exactly the same: the same object and
proportions, the same scale and framing, the same clay material, the same
flat light and the same background.
```

Checks and use:

- **A small skill script checks every image before use:** left-right symmetry,
  a vertical axis, straight rim and foot lines, no shadow pixels and a flat
  background. The silhouette gate then measures against it.
- **If image-to-3D is used, ask for geometry only.** That is Meshy
  `should_texture: false`, Tripo `texture: false` or Rodin `material: None`;
  never Rodin `Shaded`, which bakes in light. Record the vendor, model version,
  seed and input hashes in the manifest.

### 8.2 Material cards

Each look gets a card instead of a painting. A card has three parts:

- **Three to six real photographs**, ideally backlit and front-lit pairs, as
  glass sellers show sheet glass. They are owner-supplied, or openly licensed
  with the source recorded.
- **A short parameter spec:** IOR, attenuation colour and distance, roughness
  and scattering notes, from physicallybased.info where values exist.
- **The bench goldens**, once the look is approved.

AI-generated swatches can serve as mood references, never as numeric targets.

## 9. Order of work

Each phase ends with one owner checkpoint: a single page with before-and-after
shots and the numbers, not a long report. Sizes are in working sessions.

### Phase 0: the bench and the fixes that need no asset (2 sessions)

- Branch `feat/glass-look-system`.
- The bench page, its capture script and metrics.
- `GlassMaterial` with the `studio` technique, the studio builder, and the
  resident lights on the bench only.
- Two fixes that need no new asset:
  - the stress glow adds to authored emissive instead of overwriting it;
  - glass intacts stop casting opaque shadows.

  Both change the shipped look slightly, so the owner sees before-and-after
  shots first.

- **Checkpoint 0:** the bench sheet with today's materials under the four
  environments. It proves the bench reproduces what the game shows.

### Phase 1: amber through G1 (1-2 sessions, at most 3 owner rounds)

- Three candidates on the bench, each under ACES and under Neutral:
  - **A:** today's material, as the baseline;
  - **B:** screen transmission over a lit liner or plinth top near 1.45;
  - **C:** the `studio` look with glow and back-light.
- The amber material card.
- **Checkpoint 1:** the owner picks the technique and the tone mapper for the
  bench, and approves `glass.amber` v1 and its goldens.
- **Stop rule:** if nothing is approved after 3 rounds, stop and put the
  remaining options to the owner.

### Phase 2: amber in its room, and the phone (1-2 sessions)

- **The room.** In the Twin Galleries warm room: the light kit (studios,
  resident spots, plinth glow, no glass shadows) and the amber look bound by
  name. The rebuilt urn is served by `runtime_proof.mjs`, not swapped in,
  beside the shipped one.
- **A device receipt.** A development overlay shows:
  - frame time and tier;
  - whether the device exposes `EXT_color_buffer_half_float`,
    `WEBGL_multisampled_render_to_texture` and `WEBGL_multi_draw`.

  The first two change the look, not just the speed.

- **The phone test needs the owner.** Open the room on a mid-range Android and
  an iPhone through the LAN playtest server
  ([`glass-playtest.ts`](../../apps/beside-cue/scripts/glass-playtest.ts),
  port 5300; see [`DEVICE-DEBUGGING.md`](../agent/DEVICE-DEBUGGING.md)).
  Compare:
  - three intact vessels and one break;
  - transmission at 1.0 against 0.5;
  - each shard option.
- **If Neutral is chosen,** one more session sweeps all four campaign levels
  at fixed checkpoints and rebalances exposure and lights.
- **Checkpoint 2:** the owner:
  - approves amber in context;
  - decides the renderer-wide tone mapper;
  - fixes the tier values from the phone numbers;
  - decides whether the rebuilt urn replaces the shipped one.

### Phase 3: clear crystal (G1 at most 2 rounds, then G2 in one room; 1 session)

- Clear glass covers 18 of the 26 campaign exhibits, so it comes next.
- The v2 and v3 Meshy vessels bind `glass_shell` and `glass_cut` through their
  per-variant name maps, FrontSide.
- **Checkpoint 3.**

### Phase 4: breaking (2 sessions)

- The shard and chip looks, glossy cuts, splinters and glints, the debris
  sound layer, and shard programs in the warm-up.
- The impact-biased fracture in bkit. Only the urn rebuild is re-fractured, as
  the test, once the owner has decided the foot rule.
- **Checkpoint 4:** a bench break sequence (frames at 0, 0.1, 0.25, 0.5 and
  1.0 s) and one break on a phone.

### Phase 5: opal, frosted, cut crystal and celadon (G1 at most 2 rounds each; 2 sessions)

- Opal needs the back-light term. Its hero vessel is the amphora rebuild, then
  G2 in the court.
- **Checkpoint 5:** per look; the owner may review them together.

### Phase 6: rollout and the pipeline (2 sessions)

- Bind every exhibit (§11). The glassware trio and the rosebud come after
  `git lfs pull`.
- Freeze the bench goldens as regression baselines.
- Make the skill changes (§7.3), and add the clay prompt and its checker
  script (§8.1).
- **Only then does the next vessel enter G0.** The urn's three shape notes
  (stone about 55 × 70 mm, taller cup points, warmer marble) go into one G0
  build.

## 10. Budgets and stop rules

- **Frozen until checkpoint 2:**
  - vessel modelling;
  - per-vessel material tuning;
  - new Meshy generations;
  - model-critic rounds on materials.
- **Critic agents judge shape only (G0).** Looks and context are judged by
  numbers and the owner's eye.
- **Round caps:** amber gets at most 3 owner rounds and every later look 2.
  Then stop and present the options.
- **No new research is planned.** The evidence folder covers every decision
  except the phone numbers, which only a device can give.
- **Expected size:** about 11-14 working sessions in all. The first owner
  decision, at checkpoint 1, comes after about 3.

## 11. Rollout map

All 26 campaign exhibits, from the audit
([`campaign.ts:17-54`](../../packages/glass-game/src/content/campaign.ts)):

| Variant (exhibits)   | GLB materials                                         | Binds to                                                      | Phase |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------- | ----- |
| goblet (4)           | `glass_shell`, `glass_cut`, `gold_trim`               | `glass.clear`, `glass.clear.cut`, authored gold               | 3     |
| coupe (5)            | same                                                  | `glass.champagne` or `glass.clear`                            | 3     |
| decanter (4)         | same                                                  | `glass.clear`                                                 | 3     |
| amphora (3)          | same                                                  | `glass.clear`                                                 | 3     |
| fluted carafe (2)    | same                                                  | `glass.clear`                                                 | 3     |
| opaline-v6 (2)       | `glass_shell`, `cavity_surface`, `glass_cut`          | `glass.opal`, `.inner`, `.cut`; rebuild: `glass.opal` slots   | 5     |
| amber-v6 (1)         | `amber_shell` (opaque), `cavity_surface`, `glass_cut` | stays as shipped until a swap; rebuild: `glass.amber`, `.cut` | 1-2   |
| celadon decanter (1) | `celadon_shell`, `cavity_surface`, `glass_cut`        | `porcelain.celadon`, `.inner`, `.cut`                         | 5     |
| portrait slabs (4)   | `legend_edge`, `legend_portrait`, frames              | `glass.clear` on the edge; the painting stays                 | 3     |

Outside the campaign:

- **Development levels:**
  - the glassware trio (`Glassware_G##_Glass`): `glass.clear`, or
    `glass.cut-crystal` for G22;
  - the rosebud (`RoseGlass`): `glass.clear` with a tint override.
- **The Cloudway frost walls:** `glass.frosted`.
- **The runner walls** keep the finish bank they use today until it is moved
  into the library.

## 12. Risks

| Risk                                                                    | What limits it                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `studio` glass does not show the room through coloured glass            | Clear crystal keeps real transmission; the bench's checker card shows what is lost; High can blend                                                                                                           |
| Shader chunk patches break on a three.js upgrade                        | `three` pinned, chunk guards, every recipe and tier compiled in the browser suite                                                                                                                            |
| Neutral re-grades the whole game                                        | An owner decision with a sweep of every level                                                                                                                                                                |
| No phone data                                                           | The Phase 2 device test comes before any tier value is fixed                                                                                                                                                 |
| SwiftShader differs from phones                                         | Goldens guard regressions on the bench only; phones give frame times and sanity checks                                                                                                                       |
| Tests pin today's values                                                | Deliberate updates: exactly two directional lights (`glass-renderer.test.ts:1134-1141`), the emissive stress behaviour, the render-quality pass classifier (`glass-adventure-render-quality.e2e.ts:366-374`) |
| The file-size ratchet (`glass-renderer.ts` 783 lines, `vessels.ts` 757) | All new logic in new modules: the material, looks, studios, exhibit lights, shard looks and bench                                                                                                            |
| Git LFS pointers in a fresh checkout                                    | `git lfs pull` before tests and proofs                                                                                                                                                                       |

## 13. Decisions for the owner

The owner answered yes to all four on 2026-10-23, and asked for maximum quality
settings until performance is measured (§4.4).

To start Phase 0:

1. **The order.** Amber goes first, and vessel modelling and per-vessel
   material work stay frozen until amber passes checkpoint 2.
2. **Glass that carries its own light.** Accept that amber, opal and frosted
   glass may stop showing the room through them, if the bench shows they read
   better that way. Clear crystal keeps real see-through on capable devices.
3. **A Neutral tone-mapping trial** on the bench and in one room. The
   renderer-wide switch is decided at checkpoint 2.
4. **The phone test in Phase 2 needs you** and two devices: a mid-range Android
   and an iPhone.

Later:

5. **The foot rule** (Phase 4): may a heavy foot survive a break whole?
6. **Clay references** come from Codex only for new vessels, with the prompt in
   §8.1.
