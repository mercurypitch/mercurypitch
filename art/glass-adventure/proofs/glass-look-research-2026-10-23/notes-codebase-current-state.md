# Glassworks / Beside Cue glass game: glass, lighting and fracture today

Read-only codebase audit, 2026-10-23. Branch
`feat/blender-modeler-skill` at `e53b8fe`, clean tree. three `0.185.1`
(`packages/glass-game/package.json:38`, `apps/beside-cue/package.json:41`).
No physics engine and no post-processing library anywhere (no `EffectComposer`,
bloom, rapier/cannon/ammo in any package.json or source).

Path shorthands: `gg/` = `packages/glass-game/src/`, `bc/` = `apps/beside-cue/`,
`pub/` = `apps/beside-cue/public/games/`, `skill/` = `.claude/skills/blender-modeler/`,
`art/` = `art/glass-adventure/`.

`docs/agent/INDEX.md` maps only the root `src/` app; it does not index
`packages/glass-game` (the package README `packages/glass-game/README.md` is the
real map). AGENTS.md has no glass-game section beyond the blender-modeler skill
pointer (AGENTS.md:23, 32-42).

---

## Key findings (most load-bearing for a shared glass plan)

1. **The catalog glass recipe does not reach authored exhibits.** `CLEAR_GLASS`
   and per-recipe `tint/roughness/transmission/thickness` (gg/render/catalog.ts:20-27)
   only build the fallback `glass` material in gg/render/vessels.ts:149-163.
   Authored GLB materials are cloned as-is (gg/render/material-library.ts:16-65)
   and win once the GLB installs. `recipe.tint` still colours the shatter chips
   (vessels.ts:339-344).
2. **Most shipped vessels have no `KHR_materials_volume`**: thickness 0 means
   thin-walled glass with no refraction offset or attenuation. That covers the v3 Meshy
   fluted/amphora/coupe/decanter, v2 goblet/vase and v6 opaline. **amber-v6 and
   celadon-v4 have no transmission at all** (opaque MeshStandardMaterial). Among
   hydrated GLBs only the glassware trio carries volume. The rosebud and runner
   walls are LFS pointers here; their code paths imply metre thickness
   (`RESONANCE_ROSEBUD_MATERIAL_OPTICS.displayThickness`,
   gg/content/resonance-rosebud-profile.ts:25-35; MISTAKES.md:900-905), but that is
   inferred, not inspected. See §3 and §9.
3. **Every Meshy glass material is `doubleSided`**, and shards reuse the intact
   transmissive materials (vessels.ts:422-435). In r185 each DoubleSide
   transmissive object gets a back-face draw plus two `material.needsUpdate` per
   frame (three WebGLRenderer.js:2050-2070, skipped when
   `WEBGL_multisampled_render_to_texture` exists). This goes against the repo's
   own guidance (bc/docs/games/glass-3d.md:522-543 "Never make shards DoubleSide
   transmissive... swap every shard to a cheap material at the moment of the shatter").
4. **vessels.ts overwrites emissive on every imported material with
   `transmission > 0`**: color becomes `0x3fccbe` (or the resonance palette) and
   intensity becomes the stress value, 0 at idle (vessels.ts:129-133, 653-659).
   This is why skill/references/lessons.md:95 says "The game ignores emission on
   its glass". The authored emissive map on shipped opaline `glass_shell` is
   therefore dark at idle.
5. **Lighting is global, with no per-exhibit light.** Gallery = Hemisphere +
   one shadowed directional key + one rim directional (glass-renderer.ts:215-241).
   The key's ortho shadow covers the whole level: texel 3.2 cm (First Light)
   to 8.6 cm (Gallery 01). The only SpotLight is the dev-only Dark Archive one
   (gg/render/archive-room.ts:54). Environment = **one** cube capture at the
   spawn `(0, 1.15, -2.8)` for all four campaign levels, used in every room.
6. **`material.envMapIntensity` is ignored** for these materials. r185 sets the
   uniform to `scene.environmentIntensity` whenever `material.envMap === null`
   and `scene.environment` is set (three src/renderers/WebGLRenderer.js:2694-2698).
   The glass fallback's `envMapIntensity: 1.5` (vessels.ts:159) and the chips' 1.3
   (shatter-burst.ts:42) have no effect. Scene-wide value 0.65 (glass-renderer.ts:208).
7. **The finish bank (5 recipes) is runner-only.** It is applied by material
   _name_ only to runner walls (`W## optical glass` etc.) and to a few runner
   hosts. Nothing in the gallery or museum path calls it.
8. **Open owner decisions in the procedural rebuilds both point at lighting.**
   The amphora's opal reads darker than the wall behind it, and the ledger says
   the third choice is to "light the exhibit in the game (a scene change)"
   (art/procedural/opaline-echo-amphora/LEDGER.md, "Open after round 7"). The
   urn's amber reads as satin butterscotch, and the next idea is an opaque liner
   inside the cavity (art/procedural/amber-cadence-urn/LEDGER.md, "Open after round 6").
   Neither file has been swapped into the game.
9. **The ratchet leaves little room in the files a glass system would touch.**
   `size.filesOver800` is a global ratchet that includes `packages/`
   (scripts/code-metrics.mjs:41, 91, 99-135; baseline `docs/agent/code-metrics.baseline.json`:
   133 files over 800, 45 over 1500). Current sizes: glass-renderer.ts 783 lines
   (17 lines of headroom by the metric's split-count), camera.ts 774, vessels.ts
   757, museum.ts 678.

---

## 1. Renderer setup

### Gallery renderer (campaign, museum rooms): gg/render/glass-renderer.ts

- Construction: `createGraphicsRenderer('gallery', { antialias: true, alpha: false, powerPreference: 'high-performance' })`
  at :145-149. The wrapper (gg/render/graphics-renderer.ts:10-51) only rolls back
  canvas listeners on failure.
- `outputColorSpace = SRGBColorSpace` :150; `toneMapping = ACESFilmicToneMapping` :151;
  `toneMappingExposure = 0.9` :152.
- Capability probe: `EXT_color_buffer_float`, `OES_texture_float_linear` :153-159.
- `transmissionResolutionScale = renderQuality.transmissionResolutionScale` (always 0.5) :160-161,
  re-applied in `applyPresentationQuality` :357-358.
- Shadows: `shadowMap.enabled = true`, `type = PCFShadowMap`,
  `autoUpdate = shadowFrameInterval === 1`; manual prime `needsUpdate = true` before
  the probe render :162-168 (MISTAKES.md:1011). Per-frame cadence and invalidation
  run on a "shadow topology" string (grounded/moving, active solids, enabled
  platforms, each breakable's phase and broken state) :706-733.
- Pixel ratio: `effectiveGlassPixelRatio(devicePixelRatio, quality)` = `min(dpr, maximumPixelRatio)` :169-173
  (render-quality.ts:65-74). When the governor adapts: `min(that, ADAPTIVE_PIXEL_RATIO = 1)` :343-365.
- Post-processing: **none**. One `renderer.render(scene, camera)` per frame :738.
  Extra passes come from three itself (shadow, transmission) and from the planar mirror
  `Reflector` (gg/render/planar-reflections.ts:5, 11-16: target max 1024 desktop, 512
  compact, capture every 2nd or 4th frame).
- Warm-up: `precompileRendererPrograms` then one hidden-renderables-visible render :465-486
  (gg/render/program-precompile.ts, gg/render/render-warmup.ts:28-61; the warm-up
  exposes only meshes, lines, points and sprites plus their ancestors, not lights).
- First-frame check is `gl.getError()` plus drawing-buffer size only (gg/render/first-frame.ts:3-18).

### Render-quality tiers: gg/render/render-quality.ts

- Preference key `'render-quality:v1'` :3; values `'auto' | 'high' | 'balanced'` :5.
- HIGH :30-38 = `{ assetProfile: 'full', maximumConcurrentBundleLoads: 2, maximumPixelRatio: 1.5, shadowFrameInterval: 1, shadowMapSize: 1024, transmissionResolutionScale: 0.5 }`.
- BALANCED :40-48 = `{ assetProfile: 'mobile', maximumConcurrentBundleLoads: 1, maximumPixelRatio: 1.25, shadowFrameInterval: 2, shadowMapSize: 1024, transmissionResolutionScale: 0.5 }`.
- `auto` resolves to BALANCED if `mobileHint || coarsePointer`, else HIGH :56-63.
  The gallery's mobileHint is `navigator.userAgentData.mobile` (glass-renderer.ts:122-128).
  The runner's is `options.assetProfile === 'mobile'` (runner-renderer.ts:103).
- **The tiers change only DPR cap, shadow cadence, the asset profile (mobile GLB/texture downsizing) and bundle-load concurrency.**
  The shadow map size (1024) and the transmission scale (0.5) are type-level literals,
  identical in both tiers.
- Shadow cadence: first frame, then every Nth frame, plus on invalidation :77-103.
- Governor (gg/render/render-performance-governor.ts:5-11, 45-46, 70-100): only for
  BALANCED with a non-`high` preference. After 24 samples with at least 6 frames
  of 1/24 s or longer and at least 1 s of window, it adapts one way to DPR 1 and
  shadows every 4th frame.
- Asset profile is fixed at load (`options.assetProfile ?? renderQuality.assetProfile`, glass-renderer.ts:140).
  Mobile downsizes decoded GLB images: color, normal and emissive to 1024, rough,
  metal, AO and transmission maps to 512 (gg/render/asset-texture-profile.ts:6-17).
  **`thicknessMap`, clearcoat, iridescence and sheen maps are not in that list**, so
  they are never downsized.
- Where set: read at gg/ui/useAdventure.ts:85-87 (`host.readPreference`), written
  :550-553, then `renderer.setRenderQuality` (glass-renderer.ts:510-516). The UI is
  the "Graphics quality" group in `DevelopmentRenderTuning`
  (gg/ui/DevelopmentRenderTuning.tsx:22), mounted in the advanced section of
  gg/ui/AdventureSettings.tsx:220-226. The runner reads it at
  gg/ui/SongRunnerScreen.tsx:140-141 and 324-329 (gg/ui/RunnerSoundTune.tsx:278).

### Other renderers in the package (same tone-map family)

- **Runner (Singing Current)**, gg/render/runner-renderer.ts:107-122: same context options;
  exposure `RUNNER_LOOK.exposure = 0.92`, `environmentIntensity 0.75` (gg/render/runner-look.ts:7-9);
  same tiers, `PCFShadowMap`, manual cadence.
- **Museum journey map**, gg/journey/scene.ts:171-217: exposure 0.86 :182;
  `transmissionResolutionScale = 0.5` :183; DPR cap 1.8 on High, else the tier's cap :204-209.
- **Loading Merc**, gg/render/loading-merc.ts:420-430: `alpha: true`, `powerPreference: 'low-power'`,
  exposure 1.02, no shadows, DPR at most 1.5 (:40).
- Separate game (not this package): bc/src/games/glass3d/render/\* (Cabinet,
  Hallway) uses a 3-SpotLight rig and a procedural environment. That is in-repo
  prior art for exhibit lighting (see §2).

## 2. Environment and lights

### Environment: gg/render/environment.ts

- Startup env: PMREM of the procedural `createReflectionTexture()` :11-21. That is a
  512x256 RGBA16F equirect (gg/render/materials.ts:56-118) with a warm key lobe
  `pow(.., 45) * 8` toward (-0.57, 0.74, 0.35) and a teal rim lobe `pow(.., 25) * 3`
  (:75-78), giving PMREM cubeSize 128.
- Then the HDR replaces it: `HDRLoader` then `fromEquirectangular` :24-41. Asset id
  `museum-environment-v2` = `pub/adventure-v2/environment/golden-coast.hdr`
  (gg/browser/assets.ts:46), from Poly Haven Umhlanga Sunrise 1k, 1024x512, CC0
  (art/v2/source-pbr/README.md:42-48). That gives cubeSize 256.
- Then the HDR itself is replaced by a **reflection-probe cube capture** :42-66
  (`CubeCamera(0.08, 160)`, `HalfFloatType`, `fromCubemap`). The capture is run at
  glass-renderer.ts:445-463 with vessels, Merc, portal and contact shadow hidden;
  size `container.clientWidth < 700 ? 128 : 256` :456.
- The probe position comes from gg/render/scene-catalog.ts:244-251: the spawn
  position with `y + 1.15`. Measured for all four campaign levels:
  **`(0, 1.15, -2.8)`**. That one capture lights every room, including rooms 50-70 m
  away. Legacy `glassworks` probe: `(1.2, 1.15, 1.2)` :70.
- `scene.environmentIntensity = 0.65` (glass-renderer.ts:208). Dark Archive lowers it by
  `night * 0.06` :271.
- Runner: `captureRunnerImageLight` adds two emissive "reflection cards"
  (`0xffecd0 x2.4` and `0xe0f9ff x1.7`, visible only in reflections) and then captures at
  (0, 1.3, -6), 128 on Balanced and 256 on High (gg/render/runner-look.ts:20-36, 40-79).
- No `LightProbe`, no `RoomEnvironment` in the game (RoomEnvironment appears only in
  skill/scripts/three_preview.mjs `--env room`). No lightmaps or AO maps: no hydrated
  runtime GLB has an `occlusionTexture`. Some v3 intacts carry an unused TEXCOORD_1/2.

### Gallery lights: gg/render/glass-renderer.ts (shared by every room in a level)

- `HemisphereLight(0xcceaff, 0x243e42, 0.6)` :215-216.
- Key `DirectionalLight(0xffdfaa, 2.5)`, `castShadow`, map 1024, ortho half-extent
  `sceneFrame.shadowExtent`, near 0.5, `normalBias = max(0.018, texel * 0.75)`,
  `bias = -0.00015` :217-234.
- Rim `DirectionalLight(0x73ddd9, 0.75)`, no shadow :235-241.
- Frame placement from authored `presentation.lightBounds` (scene-catalog.ts:198-230):
  `lightDistance = 2 * radius + 3`; key at target + (-0.55, 1, 0.65) x distance; rim at
  target + (1, 0.45, -0.5) x distance; `shadowExtent = radius * 1.08`.
- Measured per campaign level (esbuild probe of `getMuseumSceneFrame`):

| Level (campaign id)                        | shadow map span / texel           | key position        | rim position      |
| ------------------------------------------ | --------------------------------- | ------------------- | ----------------- |
| first-light (`glassworks-chamber/chamber`) | 32.6 m / 3.2 cm, normalBias 0.024 | (-12.4, 37.1, 27)   | (39, 18.9, -11.1) |
| glassworks (`glassworks-journey/journey`)  | 88.1 m / 8.6 cm, normalBias 0.065 | (-35.3, 88.5, 87.6) | (95.7, 42, -9.6)  |
| twin-galleries                             | 71.3 m / 7.0 cm                   | (-25.9, 73, 68.3)   | (81.1, 35, -11.1) |
| resonance-conservatory                     | 78.9 m / 7.7 cm                   | (-32.9, 80, 75)     | (85, 38.2, -12.4) |

- Test pin: gg/render/glass-renderer.test.ts:1134-1141 expects exactly 2 `DirectionalLight`s
  in `scene.children`, one of them casting shadows.
- **No per-room or per-plinth lights in any campaign level.** The Twin Galleries'
  "two colours of light" (gg/content/campaign.ts:41) is floor art and paintings,
  not lights.
- Dark Archive (dev levels `glassworks-unbroken-archive/archive-awakening|archive-hush`,
  gg/render/archive-room.ts:13-16): one `SpotLight(0xffdeb1, 18, 8, 0.95, 0.75, 1.5)`
  at (0, 3.5, -0.15) aimed at (0, 0.3, 0.8), no shadow :54-57. It is re-aimed at
  the nearest chamber and its intensity is `18 * weight` :73-83, while global
  lights dim with `night` (glass-renderer.ts:265-273: hemi 0.6 to 0.26, key 2.5 to 1.1,
  rim 0.75 to 0.55). This is the precedent for "one shared light moved and weighted",
  which avoids changing the light count.
- Runner lights (gg/render/runner-look.ts:7-19): key `0xffdfac` 3.2 at (-6, 8, -8),
  shadow half-extent 8; hemi `0xc5e4e9/0x304744` 0.28; rim `0xa6e0df` 0.52 at (5, 3, 3).
- Journey map (gg/journey/scene.ts:278-292): `AmbientLight(0xfff2dc, 0.3)`,
  `HemisphereLight(0xddeef2, 0x294a43, 0.62)`, sun `DirectionalLight(0xffdfac, 2.25)` at
  (-9, 14, 10) with a 1024 shadow (+-14 x +-12).

### Fog and background

- Gallery: `FogExp2(0x59899e, 0.009)`. Cloudway: `Fog(0xe3e7ef, near, far)` plus
  `installBackdropFog` (glass-renderer.ts:195-198; gg/render/cloudway-scene.ts:7-12;
  gg/render/backdrop-fog.ts:137-153 patches _every_ scene material through
  `onBeforeCompile`, glass included).
- Sky: atmosphere dome (gg/render/atmosphere.ts) plus `museum-sky` texture. A
  backdrop-projected `scene.background` is used only for Cloudway (glass-renderer.ts:397-404).

### In-repo prior art for exhibit lighting (other game)

- bc/src/games/glass3d/render/environment.ts:67-92: `RIG` directions (key, glint, back)
  shared by the procedural environment map and the SpotLights, so reflections and
  punctual lights agree. Chamber3D.ts:151-163 uses `SpotLight(CUSTARD, 55, 12, PI/10, 0.85, 1.6)`,
  glint `SpotLight(TURQUOISE, 30, ...)` and rim `SpotLight(PAPER, 16, ...)`, plus a radial-falloff
  backdrop and floor (environment.ts:489-539). Its env is authored at 1024x512 because
  PMREM cubeSize = width/4 (bc/docs/games/glass-3d.md:798-806).

## 3. Materials

### Museum palette: gg/render/catalog.ts and gg/render/materials.ts

- `MUSEUM_MATERIAL_CATALOG` catalog.ts:299-344 holds marble, teal, limestone and
  gold, each with ambientCG texture sets. `glass` :331-338 = `{ color: 0xcdf7f0, roughness: 0.06, transmission: 0.92, thickness: 0.055, iridescence: 0.35 }`;
  `mirror` metalness 1. Built as `MeshPhysicalMaterial` in materials.ts:120-136.
- Users of museum `glass`: solid proxies with role `glass` (gg/render/museum.ts:49-58),
  Cloudway lab and living-crystal platform bodies (catalog.ts:429-481).
- `GLTF_MATERIAL_ALIASES` catalog.ts:346-354 maps `museum_ivory` to marble, `museum_brass` to gold,
  `museum_petrol` to teal, `museum_obsidian` to rock, `museum_cyan` and `museum_glass` to glass.
  It is applied by **name** in `createKitInstance` (gg/render/kit-instance.ts:25-36) for
  kit, decor and persistent exhibit frames. The override copies only color, roughness,
  metalness, normalScale and the map/normal/rough/metal/AO channels
  (material-library.ts:34-49). Transmission and thickness are not copied.

### Catalog glass recipe (exhibits)

- `CLEAR_GLASS` catalog.ts:20-27 = `{ shatterProfile: 'radial', tint: 0xd9fff4, roughness: 0.025, transmission: 0.97, thickness: 0.025, fragmentBudget: 20 }`.
  Overrides: frosted-scroll-wall `tint 0xbdeeff, roughness 0.16` :54-69; frost-gold arch
  `0xcaf5ff, 0.13` :70-89; rosebud `0xf3c9dc, 0.08, transmission 0.96` :171-200; glassware
  trio `roughness 0.045, transmission 0.98, thickness 0.02`, tint `0xd5f3ee` or
  `0xe6d3f0` (G22) (gg/render/glassware-trio-catalog.ts:40-70); runner walls
  `transmission 0.92 (W06) | 0.97` (gg/render/singing-current-wall-catalog.ts:6-36).
- Used **only** by the vessel fallback material (vessels.ts:149-163):
  `MeshPhysicalMaterial({ color: tint, roughness, transmission, thickness, ior: 1.48, iridescence: 0.8, iridescenceThicknessRange: [150, 480], clearcoat: 1, envMapIntensity: 1.5, side: DoubleSide, emissive: stressEmissive, emissiveIntensity: 0 })`.
  That material renders the procedural fallback geometry before load (gg/render/vessel-fallback-geometry.ts)
  and replaces the `legend_portrait` slot for exhibits with `persistentPortrait` (vessels.ts:428-431).

### How exhibits load GLB materials

- gg/render/asset-kit.ts:197-249 `installTargets`: for each breakable whose recipe
  bundle matches, either `prepareExhibitAsset` (unshared) or
  `createExhibitGeometryPool(...).acquire` (`sharedGeometry: true`), then
  `vessel.setGeometry` or `setGeometryLease`. Persistent frames
  (`persistentPrefix`) go through `createKitInstance`, which applies the aliases :229-243.
- gg/render/exhibit-asset.ts:17-146 validates the node contract (§4), scales to
  `displayHeight`, and builds one `createMaterialTable` (:101) whose `index()` clones
  each source material through `MaterialLibrary.clone` (gg/render/asset-geometry.ts:37-68).
  Thickness and attenuationDistance are scaled for names in
  `scaleImportedMaterialUnits` (:114-140; glassware trio glass+interior, rosebud
  `RoseGlass`+`FractureInterior`) or through `bakeImportedMaterialUnits` (runner walls,
  asset-geometry.ts:45-66; MISTAKES.md:900-905).
- Shared pool: preparation clones into a template library, then every lease clones again
  (`library.clone(material)`) so each vessel owns its materials
  (gg/render/exhibit-geometry-pool.ts:88-160).
- `MaterialLibrary.clone` clones every texture-valued property, so thickness,
  transmission and emissive maps survive and keep `.channel` (material-library.ts:40-59).
- Overrides at runtime, vessels.ts:
  - **Emissive stress override**. Per frame, every library material with
    `transmission > 0` gets `emissive = stressEmissive` (`0x3fccbe` default, or the
    resonance `crackGlow`, vessels.ts:129-133) and `emissiveIntensity = surfaceStress` :653-659.
    Stress is `charge^2 * 0.8` while charging, `1.5` during the 0.1 s anticipation,
    then `max(0, 0.45 - 3t)` :633-652. Resonance exhibits get
    `min(0.12, stress * 0.18)` (:45-48). Opaque materials (amber, celadon) keep their
    authored emissive and get no stress glow.
  - Portrait slot: the `legend_portrait` material's `map` is replaced by the loaded
    painting (vessels.ts:523-534, 568-593).
  - Nothing else: no roughness, transmission, side or env changes on authored materials.
- Shards use the **same material array** as the intact unless the exhibit is a
  picture-bearing portrait (vessels.ts:422-435). Shard meshes cast shadows unless
  `castShardShadows === false` (the runner passes false, gg/render/runner-targets.ts:349).
  The intact mesh casts shadows (:245); nothing sets `receiveShadow` on vessels.
  Note: three draws transmissive casters as fully opaque in the shadow map.

### Material finish bank (runner only)

- Recipes in gg/content/material-finishes.ts:30-234; files :3-28 (12 PNGs at 512 px
  in `pub/material-finish-v1/`, total 544,794 bytes, gated below 600,000 bytes and
  at most 512 px by gg/browser/material-finish-assets.test.ts:49-53).

| id                           | transmission / ior / thickness                              | clearcoat / coat roughness | attenuation      | maps (repeat)            | fallback roughness              |
| ---------------------------- | ----------------------------------------------------------- | -------------------------- | ---------------- | ------------------------ | ------------------------------- |
| champagne-crystal :31-67     | 0.97 / 1.46 / 0.045                                         | 0.35 / 0.075               | `#eac778` @ 1.8  | rough+normal (1.43)      | 0.0655                          |
| amethyst-cut-crystal :68-104 | 0.91 / 1.54 / 0.07                                          | 0.5 / 0.065                | `#8060b0` @ 0.55 | rough+normal (1.82)      | 0.09                            |
| opal-ribbon-glass :105-153   | 0.78 / 1.48 / 0.055, iridescence 0.24 (IOR 1.3, 310-430 nm) | 0.6 / 0.08                 | `#a9d9cd` @ 0.85 | base+rough+normal (1.25) | 0.17, fallback colour `#d9e5df` |
| etched-frost-glass :154-190  | 0.94 / 1.47 / 0.045                                         | 0.08 / 0.14                | `#cbe6dc` @ 2.2  | rough+normal, clamp (1)  | 0.2875                          |
| celadon-porcelain :191-233   | 0 (opaque)                                                  | 0.78 / 0.12                | none             | base+rough+normal (1.54) | 0.245                           |

Every recipe sets `roughness: 1` (the map drives it), `transparent: false`,
`depthWrite: true`. `RUNNER_MATERIAL_FINISH_TEXTURE_IDS` covers only
champagne, etched and celadon (:238-243), so 7 maps are uploaded.

- Application (gg/render/material-finishes.ts):
  - `createMaterialFinishBank(textures)` :17-93 configures colour space, wrap,
    repeat, `flipY = false` and anisotropy. It does not set `.channel`, so maps sample uv0.
  - `apply(material, id, mapped)` :33-84 `setValues` the recipe but **keeps the
    host's metre thickness if above 0** (:57-67), and sets
    `map = baseColor ? texture : null` (**it erases an authored base-colour map**).
    It sets rough and normal maps, or nulls them plus scalar fallbacks when
    `mapped = false`. It leaves thicknessMap, emissive, sheen and transmissionMap
    untouched, and tags `userData.materialFinish`. It needs a `MeshPhysicalMaterial`.
  - **By name**, `finishRunnerWallMaterial` :96-138: `/^W\d{2} optical glass$/` gets etched-frost for W06
    (botanical-edge special case :104-118), champagne otherwise;
    `W04 colored border glass` gets amethyst, `W08 colored border glass` gets opal;
    `/^W\d{2} warm gold$/` gets scalar gold.
- Callers (all runner): bank built at gg/render/runner-renderer.ts:410-415; walls at
  gg/render/runner-targets.ts:331-339 (lease materials, `mapped = geometry has 'uv'`) and
  :371-383 (frames); floor shell `apply(..., 'champagne-crystal', false)` plus FrontSide
  (gg/render/runner-world.ts:156-166); celadon `create()` for `museum_petrol` scenery
  (gg/render/runner-scenery.ts:161-163) and for the opening (gg/render/runner-opening.ts:45, 100).
  Docs: art/material-finish-v1/README.md:3-26.

### Custom shader work

- gg/render/runner-clear-transmission.ts:10-38: `onBeforeCompile` replaces the r185
  `textureBicubic(transmissionSamplerMap, ...)` with `textureLod` in
  `transmission_pars_fragment`. It throws if the chunk changed. Cache key
  `runner-clear-transmission-v1`. Only the runner floor shell uses it (runner-world.ts:166).
- gg/render/backdrop-fog.ts:102-130: fog chunk patch on all Cloudway materials.
- gg/journey/dome-materials.ts:30, 71-130: masks roof panes into glass on the journey
  map by patching `transmission_fragment` and roughness/metalness/normal/AO with
  `museumPaneMask`. This is the precedent for masked transmission.
- ShaderMaterials (not glass shells): crystal interiors (gg/render/crystal-interior.ts:343),
  living crystal roots (gg/render/living-crystal-interior.ts:153), water and pools.
- No custom shader on exhibit glass.

### Transmission, thickness, attenuation and UV1 in practice

- Values come straight from the GLB's KHR transmission, volume and ior extensions,
  through GLTFLoader and then the clone. A GLB without volume has thickness 0,
  so three renders it thin-walled.
- uv1: `flattenGeometry` unions attributes across primitives and zero-fills
  missing ones (asset-geometry.ts:139-158). Tests confirm `uv1` survives and
  `channel: 1` is honoured (gg/render/asset-geometry.test.ts:27, 187-191, 355-371;
  `configureTexture` sets `.channel`, gg/render/texture-recipe.ts:37). No shipped
  exhibit material samples uv1. The procedural amber urn puts its thickness map on
  `LobeUV` = TEXCOORD_1 (`thicknessTexCoord: 1`,
  art/procedural/amber-cadence-urn/optics.json; skill/scripts/gltf_finish.py:1-20).

## 4. Exhibits: placement, assets and contracts

### Placement

- Authoring: `ExhibitPrefab { id, variant, plinth: { height, radiusTop, radiusBottom, presentation } }`
  (gg/authoring/contracts.ts:87-96). The kits use `EXHIBIT_PLINTH = { radiusTop: 0.25, radiusBottom: 0.29, height: 0.24 }`
  with presentation `{ role: 'plinth', material: 'stone' }`
  (gg/content/solid-props.ts:4-8; gg/content/enclosed-museum-kit.ts:84-93;
  gg/content/glassworks-journey-kit.ts:52-61).
- Compiling (gg/authoring/exhibits.ts:96-133) produces a `BreakableDefinition` with
  `mount: { kind: 'plinth', solidId, height, radii, facingYaw, presentation }`
  (gg/contracts.ts:246-272) plus a cylinder `SolidPropDefinition` for the plinth.
  That plinth renders as a solid proxy in the room group with `materials.marble`
  (museum.ts:240-275, proxyMaterial :49-58). Unmounted legacy exhibits get a marble
  `legacy-plinth-*` plus a gold ring (museum.ts:335-362). Gold approach pads:
  `createExhibitApproachPads` (museum.ts:334).
- Vessel root: `position = target.position`, `y += mount.height ?? 0.255`,
  `rotation.y = mount.facingYaw`; `faceAnchor` recipes face the listening anchor;
  barriers use `presentation.facingYaw` (vessels.ts:136-147). The intact is
  recentred on its X/Z bounds with its base at y = 0 and scaled to `displayHeight`
  (exhibit-asset.ts:65-100).
- Room ownership: each vessel's `root.visible` follows its room's visibility
  (glass-renderer.ts:298-303, 671-674; gg/render/room-visibility.ts). Hidden vessels
  ingest state without animating (vessels.ts:596-616).
- Cameras: exploration FOV 48 degrees (gg/render/camera-policy.ts:9). The challenge
  camera frames Merc and the target bounds at 1.45-10 m (gg/render/challenge-camera.ts:84-95).
  The opaline brief assumes 3-6 m and 100-250 px tall at 1280x800
  (art/procedural/opaline-echo-amphora/BRIEF.md "Role and cameras").
- Walls: Cloudway barriers (`presentation.kind === 'barrier'`, floor-mounted, no plinth,
  `barrierEnvelope` must match bounds within 2 mm, exhibit-asset.ts:77-87). Runner
  walls: gg/render/runner-targets.ts:300-400.

### Asset manifest and replacement record

- Logical id to path: `GLASS_GAME_ASSET_FILES` (gg/browser/assets.ts:34-156).
  Manifests required in the runtime allowlist: :189-200 (`adventure-v6/manifest.json` :196).
- `pub/adventure-v6/manifest.json` entries (`models[]`) carry `id, file, node,
intactNode, shardPrefix, shardCount, source (.blend), sourceSha256, runtimeSource,
sha256, dimensions, intactTriangles, triangles, textureCount,
maximumTextureDimensions, collision, bytes, attributeRepair`. `pub/adventure-v3/manifest.json`
  `assets[]` carry `id, file, bytes, sha256, source, validation, intactNode,
shardPrefix, shardCount, attributeRepair`.
- Replacing a GLB is recorded by updating its manifest entry (sha256, bytes,
  counts, source). gg/render/catalog.test.ts:13-157 recomputes the **sha256 of every
  GLB with a receipt** and checks `intactNode`, `shardPrefix` and `shardCount` against
  the recipe. It also checks every numbered shard name exists exactly once and that
  the prefix count matches. Both briefs state this
  (art/procedural/opaline-echo-amphora/BRIEF.md:3-8; art/procedural/amber-cadence-urn/BRIEF.md:10).
  These tests read LFS files: in this checkout several runtime GLBs are still
  LFS pointers (rosebud, runner walls w01-w10, Cloudway lab frosted wall and
  frost-gold arch, pearl lantern, runner obstacles), so `git lfs pull --include` is
  needed first (MISTAKES.md:2065-2070).
- House rule: swapping a file into the game is the owner's call, in its own commit
  (skill/references/house-rules.md:16-19).

### Node naming contract

- Enforced by `prepareExhibitAsset` (exhibit-asset.ts:23-64): the recipe needs `intactNode`,
  `shardPrefix` and `1 <= shardCount <= 48`. It requires exactly one `intactNode` and
  exactly `shardCount` roots named `${shardPrefix}${000..}`. Any other root with
  the prefix throws "Unexpected fracture node". Children of shard roots are ignored.
  An optional `sourceHeight` must match within 0.1 mm.
- Collider `COLLIDER_<root>` is not read by the game (validation-only;
  skill/references/house-rules.md:21-37; manifest `collision` fields).
- Families: `breakable_l2_<name>_{intact,shard_###}` plus `COLLIDER_breakable_l2_<name>`
  (v6); `<form>_<name>_{intact,shard_###}` (v1-v3, e.g. `vase_amphora_intact`);
  `Glassware_G##_{Intact,Shard_###}` with `Glassware_G##_Fractured` (trio,
  gg/content/glassware-trio-profile.ts:4-45); `legend_cash_{intact,shard_###,frame_*}`
  (portrait slab); `frost_arch_*`, `frost_wall_*`.

## 5. Fracture and shatter at runtime

- **Trigger**: a judge completes (hold, melody, wave and so on). gg/core/game.ts:572-606
  does `completed.add`, then `breakPresentations.set(id, { at: elapsedSeconds, speed })`,
  then the `break` event. `completion: 'awaken'` keeps the vessel whole (:589-595).
  The snapshot exposes `brokenAt` (:448). The host saves progress _before_ effects
  (gg/ui/useAdventure.ts:236-248). Hold charge accrues by
  `elapsed / requiredSeconds` (gg/core/hold.ts:72; defaults 1.2 s within 150 cents,
  README.md:77).
- **Shard source**: authored shard nodes, flattened and centred on their centroids
  (exhibit-asset.ts:106-113). Fallback is `fractureGeometry` (gg/render/fracture.ts:13-97,
  nearest-seed triangle partition of the intact, at most 24 pieces :22, using
  `recipe.fragmentBudget`). It is used only when no authored set exists (vessels.ts:294-296).
- **Motion**: scripted and deterministic, no physics (README.md:30 "rigid-body shard
  simulation ... not implemented"). `planShatterShardMotion` (gg/render/shatter-motion.ts:146-206):
  - seeded by `${id}:${profile}:shard:${i}`; `speed = clamp(span * 0.9, 0.55, 2.8)` :89.
  - crown: outward 0.48-0.90 x speed, up 1.3-1.88 x speed.
  - radial: outward 0.92-1.5, up 0.55-1.11.
  - sheet and ice-wall: forward push.
  - spin 3.1 rad/s (3.8 for ice-wall) :193; release delay up to 0.075/0.1/0.12 s.
  - Per frame: `pos = origin + v*t`, `y -= 1.7 t^2`, `rot = spin*t`,
    `scale = 1 - fade` (vessels.ts:707-724).
- **Timing** (gg/core/shatter-presentation.ts:3-33):
  - normal: anticipation 0.1 s, visible flight 2.2 s, fade starts at 1.45 s and
    lasts 0.75 s.
  - reduced motion: 0 / 0.45 s, flight scale 0.14, no burst or wave.
  - Playback speed defaults to **0.5** (range 0.4-1.6), latched at the break. The
    lifecycle is 2.3 s / speed, so 4.6 s at the default.
- **Lifetime and despawn**: `shardGroup.visible = shattered && !restored && flight < visibleFlightSeconds`
  (vessels.ts:677-683). No settling debris. Geometry stays allocated until vessel
  dispose. Saved completions restore with intact and shards hidden (:623-624).
- **Particles**: `createShatterBurst` (gg/render/shatter-burst.ts). Chips are 3
  InstancedMeshes (tetra, octa, 3-sided cone) on one `MeshPhysicalMaterial`
  (`transmission 0.82, roughness 0.08, ior 1.46, thickness 0.018, clearcoat 1`, `color: recipe.tint`, :39-50),
  gravity 2.05 (:155). Glints are additive `MeshBasicMaterial 0xeaffff` octahedra, gravity 1.35 (:84-89, 163).
  Counts (shatter-motion.ts:33-41): crown 39/8, radial 45/9, sheet 48/10, ice-wall 72/14.
  Plus a floor wave `RingGeometry(0.22, 0.245, 64)`, opacity 0.65 fading over 0.55 s,
  scale `1 + 4t` (vessels.ts:471-481, 725-728).
- **Before the break**:
  - Crack lines are `EdgesGeometry(piece, 22 deg)` per shard
    (exhibit-geometry-pool.ts:37, 97-103; vessels.ts:322-333), drawn with
    `LineBasicMaterial 0xcaffee`. Opacity is `min(1, max((charge - 0.25) / 0.75, anticipation)) * 0.92` (:214-219, 662-668).
  - Tremor `rotation.z = sin(now * 48) * (charge - 0.6) * 0.018` when charge > 0.6 (:669-676).
  - Emissive stress glow, as in §3.
  - Resonance exhibits (glassware trio, rosebud) instead get projected surface cracks
    in 4 stages at charge 0.18/0.40/0.64/0.84 (opacity 0.42 to 0.96), tremor from
    0.58 at 7.6 Hz with at most 2.4 mm and 0.008 rad, and spray/droplet/dust
    accents capped at 10k triangles (balanced) or 24k (high)
    (gg/render/resonance-release-config.ts:123-168; gg/render/resonance-surface-cracks.ts).
- **Sound**: `voiceChallenge.completeBreak()` calls `sound.shatter()` (gg/ui/voice-challenge.ts:745-760),
  then `fracture.play(profile, identity, 2.7)` (gg/browser/glass-sound.ts:291-294).
  The profile comes from `exhibitShatterProfile(target)` (gg/browser/browser-host.ts:68),
  which maps variants to form, size and material (gg/content/shatter-sounds.ts:102-137).
  There are 14 recorded takes in 5 families (:27-42), stored at `pub/shatter-sounds-v1/*.mp3`,
  and adjacent takes never repeat (:81-95).
- **Cut faces and inner walls**:
  - v6 Meshy: `cavity_surface` (inner wall, also on shards) and `glass_cut` (cut
    faces, shards only).
  - v3: `glass_cut` (T 0.88, rough 0.14).
  - Trio: `Glassware_G##_Interior`.
  - Rosebud: `FractureInterior`.
  - Procedural builds: `glass_cut` / `amber_cut` plus per-part cut materials (§8).
  - The game does not treat any of them specially: all are cloned GLB materials,
    and transmissive ones receive the emissive stress override.
- **Performance limits**:
  - authored shard count at most 48; fallback pieces at most 24.
  - Breaks invalidate the shadow cadence (glass-renderer.ts:715-719).
  - The runner disables shard shadows.
  - Hidden-room vessels skip presentation.
  - There is no cheap shard material swap and no shard batching; each shard is its
    own Mesh with the intact's (DoubleSide, transmissive) material.

## 6. Tests and proofs

### Browser (Playwright, `bc/e2e/`)

- `glass-adventure-glassware-trio.e2e.ts:21`: each trio exhibit loads 3 GLBs with
  status 200, breaks with a synthetic tone, releases the mic and restores. Raster
  draws are **suppressed** (helpers/thawing-song-input.ts:31-43, `realRendering` off),
  with the first-person camera.
- `glass-adventure-render-quality.e2e.ts`:
  - auto profile on compact touch (:427).
  - mobile GLB image downsizing (:485).
  - matched High and Balanced real-render frame receipts, gated by
    `GLASS_RENDER_QUALITY_PROOF=1` (:47, 595-687). It asserts DPR 1.5 vs 1.25, a
    shadow pass on update but not on reuse, equal screen and transmission triangles,
    and a colour-pixel ratio below 0.71.
  - Pass classification is by viewport: **a 1024x1024 target counts as "shadow",
    anything else off-screen as "transmission"** (:366-374).
- `glass-adventure-material-hosts.e2e.ts`: UI glass tiles and cards only (CSS
  "material" hosts), not 3D materials.
- `glass-adventure-solids.e2e.ts`: collision and landing; real-render screenshots
  with `GLASS_EDGE_RENDER_PROOF=1` (:6).
- `glass-adventure-living-crystal.e2e.ts:18`: compiles, draws and survives a camera drag.
- `glass-adventure-resonance.e2e.ts:175`: Rosebud draws, cancels partial resonance,
  breaks and restores.
- Root app: `src/e2e/glass-game.spec.ts` (delivery smoke).
- **No visual baselines**: no `toHaveScreenshot` or `toMatchSnapshot` anywhere.
  Screenshots are attachments for human review. Pixel reads exist only in
  helpers/runner-collectible-renderer.ts:121-133.

### Unit tests (vitest, `gg/render/`)

`glass-renderer.test.ts` (lights :1095-1185), `vessels.test.ts` (emissive :42-45, 110),
`vessel-shatter-presentation.test.ts`, `vessel-shatter-speed.test.ts`,
`vessel-visibility.test.ts`, `fracture.test.ts`, `shatter-motion.test.ts`,
`shatter-burst.test.ts`, `portrait-shatter.test.ts`, `exhibit-asset.test.ts`,
`exhibit-geometry-pool.test.ts`, `asset-geometry.test.ts`, `catalog.test.ts`
(manifest hashes), `glassware-trio-asset.test.ts`, `material-finishes.test.ts`,
`runner-clear-transmission.test.ts`, `materials.test.ts`, `environment.test.ts`,
`render-quality.test.ts`, `render-performance-governor.test.ts`,
`render-warmup.test.ts`, `program-precompile.test.ts`, `planar-reflections.test.ts`,
`resonance-*.test.ts`, `frost-*-asset.test.ts`, `singing-current-wall-asset.test.ts`,
`cloudway-mobile-resource-budget.test.ts` (mobile texture GPU at most 96 MiB, :91-120).

### Skill runtime proof: skill/scripts/runtime_proof.mjs

- `node runtime_proof.mjs --config proof.json [--candidate x.glb] [--out dir]` (:3).
- It spawns the Beside Cue Vite dev server with `VITE_BESIDE_CUE_GAMES=1` on port 5391
  (`PROOF_PORT`), behind a lock file (:49-107). It launches Chromium with
  `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`,
  preferring `/opt/pw-browsers/chromium` (:131-139).
- Serving the candidate: `page.route('**/' + config.replace)` fulfils with the
  candidate bytes (`model/gltf-binary`) and counts hits (:170-180). The run **fails
  if the game never requested the replaced URL** (:291-296) and reports LFS pointers
  (:154-169, 236-238).
- It seeds localStorage under the prefix `beside-cue:glass-adventure:`: tutorial
  seen, comfortable note 60, camera `third-person`, audio muted, automatic singing
  off, `render-quality:v1` from the viewport, and `progress:<levelId>` from the
  config (:181-207). Then it opens `/glass-game/?layout=<layout>`, waits for
  `data-ready="true"` (:208-219) and dismisses buttons by name (:240-247).
- Shots: optional `drag [dx, dy]` (mouse from the canvas centre, 12 steps), `keys`
  holds, `settle` ms, then two RAFs and a page screenshot (:248-275).
- Configs used:
  - Opaline: layout `twin-galleries`, checkpoint
    `glassworks-twin-galleries/twin-galleries/court/checkpoint/entry`, with the urn and
    celadon decanter pre-completed. Desktop 1280x800 at scale 1, High. Shots `entry`
    (6 s), `face` (drag 350, 0), `walk` (W 1.3 s), `walk-tilt` (drag 0, -60)
    (art/procedural/opaline-echo-amphora/proof.json).
  - Urn: checkpoint `.../warm/checkpoint/entry`, no completions. Shots `entry`,
    `right` (350), `left` (-700), `tilt` (0, -60)
    (art/procedural/amber-cadence-urn/proof.json).
- Companion tools:
  - `three_preview.mjs` copies the game's exposure 0.9, environment 0.65, the HDR,
    and the hemi `0xcceaff/0x243e42` 0.6, key `0xffdfaa` 2.5 at (-2, 4, 3) and rim
    `0x73ddd9` 0.75 at (3, 2, -3) lights, against a pale backdrop and floor. It is
    **not** the probe capture and has no emissive override
    (skill/scripts/three_preview.mjs:1-20, 77-98).
  - `runtime_batch.py`, `glb_patch.py`, `glb_recolour.py`, `colour_stats.py`.
  - Older capture scripts: art/v6-level2/production/capture_vessel_runtime.mjs and
    art/proofs/runtime-fracture-fixture.mjs.

## 7. Existing docs and plans

- Where plans live:
  - `docs/plans/*.md` in kebab-case, with dated handoffs as `<topic>-YYYY-MM-DD.md`,
    e.g. `blender-modeler-skill-2026-10-21.md`, `glass-handoff-2026-07-17.md`,
    `skills-handoff-2026-09-30.md`. Folders exist for big programs (`find-your-pitch/`, `mobile-native/`).
  - Game-specific plans: `art/glass-adventure/plans/UPPER-KEBAB[-YYYY-MM-DD].md`
    (50 files, often a `Status:` line) and `bc/docs/games/*.md`.
- Structure of the most recent plan (docs/plans/blender-modeler-skill-2026-10-21.md):
  - `# Plan: <title>`
  - `**Date:** ... · **Branch:** ... · **Status:** ...`
  - a pointer to the evidence folder, then `---`
  - numbered `## 1. Verdict` ... `## 7. The skill` (with `###` subsections)
  - `## 8. Examples ...`, `## 9. Order of work`, `## 10. Decisions for the owner`.
- Status:
  - `blender-modeler-skill-2026-10-21.md`: skill built, two vessels rebuilt,
    "Nothing in the game changes until the owner swaps a file in" (:3-7).
  - `glass-handoff-2026-07-17.md` is the **root app's** Glass voice mirror
    (`src/features/glass/`, `src/lib/glass/fracture.ts`), not the museum.
    DOCS-AUDIT.md:72-73 says its 5 open items are genuine.
  - DOCS-AUDIT.md is dated 2026-07-28 and predates the Glassworks and blender plans,
    so none of them are audited there.
  - bc/docs/games/glass-3d.md: "Status: proposal, 2026-08-31" (:3). It covers a
    different 3D chamber game but holds the repo's best guidance on three glass
    cost (§5.3 :522-562), phone settings (§5.4 :563-633) and budgets (§6.3 :758-815).
    bc/docs/games/glass-3d-art.md is the art direction ("one warm spotlight").
  - art/plans/MOBILE-PERFORMANCE-AND-GUIDANCE-FOLLOWUP-2026-09-24.md: the open item
    "Add measured automatic/mobile quality settings for ... costly glass effects" (:87-90),
    no device FPS yet (:65-80).
  - art/plans/FLOATING-MUSEUM-LIVE.md:68-75: "Start with no bloom pass and add it
    only if measured headroom warrants it".
  - art/plans/GAME-ASSET-QUALITY-AUDIT.md: audit plan.
  - art/material-finish-v1/README.md: the finish bank, with art work still open
    (:52-65).
  - art/proofs/modeling-audit-2026-10-21/generators-research.md §4 (:255-330):
    r185 transmission mechanics, settings and mobile mitigations.
  - art/proofs/modeling-audit-2026-10-21/meshy-vs-procedural.md:40-62: keep the Meshy
    vessels until rebuilt materials read right.
- Known defects and lessons:
  - docs/agent/BUGS.md has **no glass-game entries**.
  - docs/agent/CODE-HEALTH.md mentions only Beside Cue CI timing (:455-480).
  - docs/agent/REFACTOR-PLAN.md lists no `packages/glass-game` file. The only
    glass-related entry is `apps/beside-cue/src/games/glass/JourneyPrototype.tsx`,
    3,196 LOC (:59).
  - Relevant MISTAKES.md entries:
    - :900 preserve physical material units when baking.
    - :1011 prime manual shadows before offscreen renders.
    - :1018 keep decorative triangles out of camera collision.
    - :1773 judge glass in its production render path, with a real backdrop,
      production exposure and half-resolution transmission.
    - :1941 mirror backing.
    - :2044 glass clearance beneath source detail.
    - :2065 LFS pointers.
    - :2086 assert the loaded asset tier: a proof once intercepted the desktop
      GLB while mobile loaded.
    - :2163 shadow comparison texture before the first reflection capture.
  - skill/references/lessons.md has these glass entries:
    - :6 the exporter silently drops volume and thickness maps; the
      `thicknessTexCoord` fix.
    - :32 frost the transmission (roughness 0.4 under coat 0.5).
    - :87 brightness against colour play in the game's light.
    - :95 the game ignores emission on glass.
    - :97 clear glass shows the gallery.
    - :146 rooms re-light themselves through the probe; pale tints read 1.6x as saturated.
    - :164 pure metal mirrors the HDR's brown ground.
    - :187 clear glass is not opal.

## 8. The skill side (`.claude/skills/blender-modeler/`)

- `scripts/bkit/fracture.py`: Voronoi pre-fracture of **closed** shells.
  - Every part is intersected with the same convex cells through exact boolean;
    cut faces take a **per-part cut material** (`cut_materials`).
  - It rejects attempts whose shard is not one connected group, then checks volumes
    (:1-13, 90-108, 193-230).
- `scripts/bkit/textures.py`:
  - procedural `hammered_normal`, `marbled`, `crackle`, `inlay`, `laurel`.
  - `attach_normal` and `attach_color`.
  - `thickness_map` plus `attach_thickness(material, image, uv_map)`. This builds the
    `glTF Material Output` group with its Occlusion input; otherwise the exporter
    drops the map (:1-12, 219-255).
- `scripts/bkit/materials.py`: `principled`, `opal_glass`, `clear_glass`, `cut_glass`,
  `jade`, `gold`, `marble`, `optics`, `vertex_tint`, `paint_corners` (:20-132).
- `scripts/bkit/validate.py`: closure, self-intersection, loose pieces,
  `show_through` (:228) and `cavity_intrusions` (:255).
- `scripts/gltf_finish.py` merges `optics.json` KHR_materials_volume and iridescence
  blocks (including `thicknessTexCoord`) into the JSON chunk (:1-20).
- `references/materials-glass.md`:
  - r185 glass rules (:7-24): one transmission pass, glass never sees glass, single
    interface, keep closed shells single-sided.
  - presets table (:42-51).
  - "The museum's light" (:76-92): the probe replaces the HDR in galleries.
- `references/qa.md`:
  - pipeline gates (:7-16).
  - three_preview `--set` / `--env room` (:92-110).
  - runtime proof (:111-124).
  - colour in the game measured as numbers (:126-149).
- `references/house-rules.md`: the breakable contract (:21-37) and budgets (hero
  intact 8,000 tris, shards 1.6x) (:39-48).
- Material names exported by the procedural builds:
  - **Opaline Echo Amphora** (art/procedural/opaline-echo-amphora/build.py:97-127):
    - `glass_shell` (opal: white, roughness 0.20, transmission 0.35, IOR 1.47,
      coat 0.6 / 0.05, thin film 420 nm, sheen `#efe6d8`, COLOR_0 patches times crackle).
    - `glass_waves` (opal plus gold inlay).
    - `gold_trim` (hammered, metallic 0.75, `#ebcb88`, roughness 0.30).
    - `gold_polished` (roughness 0.20).
    - `jade_stone` (`#3f6a4b`, transmission 0.08, IOR 1.61, coat 0.3).
    - `glass_cut` (`#dcefe7`, roughness 0.25, transmission 0.45).
    - Cut faces: `glass_cut` for glass, gold/jade for those parts (:494-497).
    - Optics: volume on `glass_shell`/`glass_waves` 0.02 m @ 0.3 m; `glass_cut` 0.03;
      `jade_stone` 0.04; iridescence 1.0 (optics.json).
  - **Amber Cadence Urn** (art/procedural/amber-cadence-urn/build.py:118-153):
    - `marble_cream` (coat 0.35).
    - `amber_glass` (`#ffcc4d`, roughness 0.40, transmission 0.90, IOR 1.52, coat
      0.5 / 0.03, thickness map on `LobeUV` = TEXCOORD_1, thicknessFactor 0.15,
      attenuation `[0.965, 0.745, 0.254]` @ 0.06 m).
    - `gold_polished` (metallic 1.0).
    - `laurel_frieze` and `laurel_shoulder` (inlays).
    - `jade_stone` (`#48551e`, transmission 0.10).
    - `amber_cut`.
    - Cut faces: marble for foot, neck and cup; `amber_cut` for the body; gold for
      the bands and beads; jade for the cabochon (:528-530).
  - Both stopped at critic rounds 7 and 6 without SHIP (LEDGER.md tails).

## 9. Every glass asset in the game

### Campaign (gg/content/campaign.ts:17-54); positions from the composed levels; all on 0.24 m stone plinths

| Level                  | Room            | Exhibit id       | Variant                           | Optional |
| ---------------------- | --------------- | ---------------- | --------------------------------- | -------- |
| first-light            | chamber         | threshold-goblet | goblet                            | no       |
| first-light            | chamber         | window-coupe     | coupe                             | yes      |
| first-light            | reveal          | passage-decanter | decanter                          | no       |
| glassworks             | vestibule       | vestibule-goblet | goblet                            | no       |
| glassworks             | garden          | garden-decanter  | decanter                          | no       |
| glassworks             | garden          | garden-amphora   | amphora                           | yes      |
| glassworks             | garden          | garden-coupe     | coupe                             | yes      |
| glassworks             | archive         | archive-carafe   | fluted                            | no       |
| glassworks             | archive         | archive-glazing  | archive-glazing-v5                | yes      |
| glassworks             | portrait        | portrait-finale  | portrait-awakened-muse            | no       |
| glassworks             | panorama        | panorama-amphora | amphora                           | yes      |
| glassworks             | panorama        | panorama-coupe   | coupe                             | yes      |
| twin-galleries         | warm            | lower-urn        | amber-v6                          | no       |
| twin-galleries         | warm            | lower-coupe      | coupe                             | yes      |
| twin-galleries         | cool            | upper-decanter   | celadon-lark-decanter-fracture-v4 | no       |
| twin-galleries         | cool            | upper-goblet     | goblet                            | yes      |
| twin-galleries         | court           | bridge-pair      | decanter                          | no       |
| twin-galleries         | court           | court-echo       | opaline-v6                        | yes      |
| twin-galleries         | portrait        | portrait-pair    | portrait-interval                 | no       |
| resonance-conservatory | foyer           | entrance-goblet  | goblet                            | no       |
| resonance-conservatory | fern-house      | fern-wave        | decanter                          | no       |
| resonance-conservatory | listening-court | court-coupe      | coupe                             | yes      |
| resonance-conservatory | orchid-house    | orchid-wave      | opaline-v6                        | no       |
| resonance-conservatory | orchid-house    | orchid-echo      | fluted                            | yes      |
| resonance-conservatory | wave-salon      | keeper-finale    | portrait-wave-keeper              | no       |
| resonance-conservatory | panorama        | sky-echo         | amphora                           | yes      |

Sources: gg/content/enclosed-chamber.ts:124-145; gg/content/glassworks-journey.ts:289-371;
gg/content/twin-galleries.ts:295-356; gg/content/resonance-conservatory.ts:221-283.

### Variant to GLB to material names (hydrated GLBs inspected read-only)

| Variant                                                                                       | GLB                                                                                       | Material names                                                                                                                                | Notes                                                                                                                                   |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| goblet                                                                                        | `vessels-v2` = pub/adventure-v2/vessels-qa-v2.glb (v1 fallback `vessels`)                 | `glass_shell` (T 0.98, IOR 1.46, rough 0.025), `glass_cut` (T 0.88), `gold_trim`                                                              | all doubleSided, no volume; nodes `goblet_laurel_*` x23                                                                                 |
| vase (dev/archive)                                                                            | same                                                                                      | same                                                                                                                                          | `vase_rounded_*` x23 (v2)                                                                                                               |
| fluted, amphora, coupe, decanter                                                              | pub/adventure-v3/{fluted-carafe,moon-amphora,aurora-coupe,cut-crystal-decanter}-qa-v2.glb | `glass_shell` (T 0.98, rough 0.04), `glass_cut` (T 0.88, rough 0.14), `gold_trim` (metal 0.95)                                                | no ior, no volume; doubleSided; 23 shards; intact has uv0+uv1(+uv2), unused                                                             |
| opaline-v6                                                                                    | pub/adventure-v6/opaline-echo-amphora-qa-v2.glb                                           | `glass_shell` (base, MR, normal and **emissive** maps, T 1 + texture, IOR 1.47), `cavity_surface` (T 0.48), `glass_cut` (T 0.312)             | 18 shards; tangents                                                                                                                     |
| amber-v6                                                                                      | pub/adventure-v6/amber-cadence-urn-qa-v2.glb                                              | `amber_shell` (textured, emissive), `cavity_surface`, `glass_cut`                                                                             | **no transmission at all**; 16 shards                                                                                                   |
| celadon-lark-decanter-fracture-v4                                                             | pub/adventure-v6/celadon-lark-decanter-fracture-v4.glb (LFS-hydrated)                     | `celadon_shell`, `cavity_surface`, `glass_cut`                                                                                                | opaque; 18 shards                                                                                                                       |
| portrait, portrait-awakened-muse, portrait-interval, portrait-wave-keeper, archive-glazing-v5 | pub/adventure/legend-slab.glb                                                             | `legend_edge` (T 0.95), `legend_portrait` (T 0.06 + painting), `museum_brass`, `museum_obsidian`                                              | 16 shards; frames via aliases                                                                                                           |
| g01-sunlit-diadem, g14-tidal-wave-carafe, g22-aurora-lotus-bowl                               | pub/glassware-trio-v1/\*.glb                                                              | `Glassware_G##_Glass` (T 1, volume 0.008-0.01 m, attenuation e.g. G14 `0.3/0.85/0.95` @ 0.12), `Glassware_G##_Interior`, `Glassware_G##_Gold` | single-sided glass, clearcoat, **no UVs**; 33/21/20 shards; dev levels only (glassware-trio-study, unbroken-archive, archive-hush-room) |
| resonance-rosebud-v1                                                                          | pub/resonance/assets/resonance-rosebud-v1.glb (**LFS pointer here**)                      | `RoseGlass`, `FractureInterior` (gg/content/resonance-rosebud-profile.ts:18-35)                                                               | living-glass-trial (dev)                                                                                                                |
| frosted-scroll-wall, frost-gold-arch-breakwall-a                                              | pub/cloudway-laboratory-v1/... (LFS pointers)                                             | node families `frost_wall_*`, `frost_arch_*`                                                                                                  | Cloudway barriers; 32 shards                                                                                                            |
| current-wall-w01..w10-v1                                                                      | pub/singing-current-walls-v1/w01-w10.glb (LFS pointers)                                   | `W## optical glass`, `W04/W08 colored border glass`, `W## warm gold`                                                                          | runner only; finish bank                                                                                                                |
| cloudway-lab-voice                                                                            | none                                                                                      | fallback only                                                                                                                                 | shardCount 0                                                                                                                            |

Other transmissive surfaces:

- museum `glass` proxies and platforms.
- `LivingCrystalV2_Shell_Rose` (T 0.94, doubleSided; pub/crystal-interiors-v2).
- chips.
- the runner floor shell (champagne).
- journey dome panes.

Room kit GLBs (window and screen bays, decor, harp, columns, arcade, canopy) are
opaque atlases with no transmission.

## 10. Hooks and obstacles

### Narrowest hooks

- **Name to finish for every exhibit**: in `prepareExhibitAsset`, right after
  `createMaterialTable` and flattening, where `table.materials` is already looped by
  name for unit scaling (gg/render/exhibit-asset.ts:114-141). Both the unshared path
  (asset-kit.ts:216-221) and the shared pool (exhibit-geometry-pool.ts:97) go
  through it, and so do the runner walls. Because pools clone their prepared
  templates per lease (:143-145), a finish applied there propagates to every vessel.
  Alternative, one level lower: `createMaterialTable().index()` (asset-geometry.ts:45-66).
  It sees each source material once with its name, before clone dedup.
- **Shard-only material** (cheap shard material or cut-face treatment):
  `authoredMaterialSelection` already separates `intact` from `shards`
  (vessels.ts:422-435).
- **Per-material runtime look** (stress, emissive, env): vessels.ts `update()`
  :653-659 is the only per-frame material writer. If authored emissive must survive,
  the override has to stop clobbering it.
- **Persistent frames**: `createKitInstance` aliases (kit-instance.ts:25-36). Note
  that runner frames also get `finishRunnerWallMaterial`.
- **Per-plinth lights or backdrops**, in order of how local each is:
  - (a) data: `ExhibitPrefab` (gg/authoring/contracts.ts:87-96), compiled at
    gg/authoring/exhibits.ts:96-133 into `BreakableDefinition.mount`
    (gg/contracts.ts:264-272).
  - (b) render: the vessel `root` (vessels.ts:134-147), which moves, rotates and
    hides with its room (glass-renderer.ts:671-674).
  - (c) room-owned: the solid-proxy and pad loop in museum.ts:240-362 via
    `renderParent(target.id)`.
  - (d) room decorations: `ROOM_DECORATION_CATALOG` (gg/render/room-decoration-catalog.ts:26-98),
    placed by room prefabs (gg/render/room-decorations.ts).
  - Lighting precedent: the archive spotlight pattern (archive-room.ts:54-83 plus
    glass-renderer.ts:263-273): one resident light, re-aimed and weighted.
- **Per-room environment**: `environment.capture()` is called once
  (glass-renderer.ts:445-463) at the spawn. Per-room probes would need new calls
  and per-material `envMap`. That `envMap` is required anyway, because r185 ignores
  `envMapIntensity` without it.

### Obstacles

- **Light count changes recompile shaders**: three skips lights under an invisible
  ancestor (`projectObject` returns at `object.visible === false`, three
  src/renderers/WebGLRenderer.js:1833), and `numSpotLights` is part of the program
  key (webgl/WebGLPrograms.js:340, 474). Room groups toggle visibility
  (museum.ts:388-396 `setVisibleRooms`; glass-renderer.ts:663-674).
  A light per plinth inside room groups would change `numSpotLights` and recompile
  programs mid-play, defeating the precompile and warm-up (glass-renderer.ts:465-486).
  Warm-up exposes renderables only (render-warmup.ts:42-51).
- **Shadowed spotlights**:
  - each adds a shadow pass (three's default spot shadow map is 512x512);
  - the Balanced cadence covers only the shared cadence object;
  - the render-quality e2e would misclassify a 512 spot shadow pass as
    "transmission" (bc/e2e/glass-adventure-render-quality.e2e.ts:366-374).
- **Transmission cost**:
  - one extra full opaque render per camera at 0.5 scale, with at least 4x MSAA,
    half float and mipmaps (three WebGLRenderer.js:1983-1995);
  - DoubleSide back-face draws per object (:2050-2070);
  - every shard is an object.
  - The probe cube capture (6 faces) and planar mirrors also redraw the scene.
- **Material path differences**:
  - amber and celadon are `MeshStandardMaterial` (no extensions); the finish bank
    requires `MeshPhysicalMaterial` (material-finishes.ts:101).
  - `apply()` nulls `map` for recipes without a base colour, which erases authored
    colour maps.
  - finish maps sample uv0 only (no `.channel`); the trio has **no UVs**, so it would
    need `mapped = false`.
- **Ratchets and budgets**:
  - `size.filesOver800` includes packages and apps (§ Key findings 9). Several
    glass-game files sit just under 800 (gg/ui/useAdventure.ts 1008 already over;
    gg/browser/runner-session.ts 799, gg/journey/water.ts 797, gg/journey/scene.ts 796,
    gg/contracts.ts 796, glass-renderer.ts 783, gg/render/camera.ts 774).
    New logic belongs in new modules.
  - The ESLint complexity and depcruise cycle ratchets scan only `src` and `workers`
    (scripts/code-metrics.mjs:388-394, 450).
  - First-paint JS budget `glass-game.html` 1450 KB, measured 1159 KB with three;
    CSS 60 KB, measured 46 (scripts/assert-first-paint-budgets.mjs:75-77, 194-196).
    New three addons (RectAreaLight LTC tables, composer passes) count against it.
  - Mobile: Cloudway texture GPU at most 96 MiB (cloudway-mobile-resource-budget.test.ts:120).
  - Finish maps at most 512 px and 600 KB total.
  - Brief budgets: hero intact at most 8k tris, shards at most 12.8k, textures at
    most 512 px, GLB at most the size it replaces.
  - DPR 1.5/1.25, shadow map 1024 and transmission 0.5 are fixed by type
    (render-quality.ts:26-27).
  - No measured phone FPS exists (art/plans/MOBILE-PERFORMANCE-...:65-80;
    render-quality receipts say "not phone FPS").
- **Proof hazards**:
  - SwiftShader stalls on transmission targets (MISTAKES.md:1975-1979).
  - The proof must assert the served tier (MISTAKES.md:2086).
  - LFS pointers for half the glass GLBs here.
  - three_preview lacks the probe and the emissive override, so judge in
    `runtime_proof.mjs`.
- **Tests that pin current values**:
  - glass-renderer.test.ts:1134-1141 (2 directionals).
  - vessels.test.ts:42-45, 110 (emissiveIntensity behaviour).
  - material-finishes.test.ts (name mapping).
  - catalog.test.ts (manifest sha256 and node counts).
  - render-quality e2e (DPR 1.5 / 1.25, shadow pass presence).
