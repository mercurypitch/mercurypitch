# Pipelines that separate shape, surfacing and look-development (glass vessels, three.js r185 WebGLRenderer, small team)

Research date: 2026-10-23. "Secondary" marks a reseller, blog or aggregator rather than the vendor's own documentation. Local facts about three.js come from the project's installed `three@0.185.1` package under `node_modules/.pnpm/three@0.185.1/node_modules/three/`.

## 1. How studios separate modelling from surfacing, and which approval gates they use

### Takeaway

Engines keep shape and surfacing apart by making the material a shared, parameterised asset. Unreal does it with a master material plus instances that can only change pre-exposed parameters. Unity remaps imported placeholder materials to existing material assets by name. VFX-style pipelines approve an asset in a locked camera and light rig, in stages (clay, then generic grey materials, then the final look), so each review judges one change. For a three.js WebGLRenderer game the practical equivalent is a JavaScript material library bound by glTF material name. KHR_materials_variants suits A/B review of candidate looks. MaterialX is not usable unless the game moves to WebGPURenderer.

### Cited Findings

#### Master materials and material instances (Unreal)

- Epic's API reference: material instances "change a material's appearance without the expensive recompile", but they are "limited to predefined material parameters". Those parameters are "statically defined in the compiled material by a unique name, type and default value" (same wording on the 4.26, 4.27 and 5.x API pages) — [Epic API: UMaterialInstanceConstant](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UMaterialInstanceConstant?lang=en-US); [UE 5.1 Python API: MaterialInstanceConstant](https://docs.unrealengine.com/5.1/en-US/PythonAPI/class/MaterialInstanceConstant.html)
- Epic's instancing guide: a parameterised material can be edited in a Material Instance without recompiling, and an instance "inherits all of its attributes from the parent (or master) Material" — [Epic: Instanced Materials](https://dev.epicgames.com/documentation/unreal-engine/instanced-materials-in-unreal-engine)
- Caveat: flipping a static switch in an instance triggers shader recompilation (bug report UE-231474, UE 5.4). Static switches therefore cost a recompile, unlike scalar, vector and texture parameter edits — [UE-231474](https://issues.unrealengine.com/issue/UE-231474)

#### Assigning materials by name at import (Unity, three.js)

- Unity's model importer (Materials tab) has a **Search and Remap** button. It reconnects a model's imported materials to existing Material assets **by name**, searching Local Materials Folder, Recursive-Up or Project-Wide (older docs: Local, Recursive-Up, Everywhere). If no material of the right name is found, nothing changes. Unmatched entries can be assigned by hand in the Remapped Materials list. Extracted materials are not updated by later re-imports — [Unity 2022.3 manual: FBX Importer Materials tab](https://docs.unity.cn/Components/FBXImporter-Materials.html); [Unity 2018.2 manual](https://docs.unity3d.com/2018.2/Documentation/Manual/FBXImporter-Materials.html)
- three.js has no material remap or library feature. Forum guidance is to traverse the loaded scene and set `mesh.material` yourself, because "which materials map to which meshes would probably need to be customized for your application" — [three.js forum](https://discourse.threejs.org/t/how-to-change-the-color-of-two-objects-or-parts-of-them-gltf/33093)
- In the installed three r185.1, the GLTFLoader header lists KHR_materials_variants as supported only through an external user plugin (takahirox/three-gltf-extensions). The built-in material extensions include transmission, volume, ior, dispersion, iridescence, sheen, clearcoat, specular, anisotropy, emissive_strength and unlit. KHR_materials_diffuse_transmission is not among them — [local three r185.1 GLTFLoader.js](../../../../node_modules/.pnpm/three@0.185.1/node_modules/three/examples/jsm/loaders/GLTFLoader.js); [three-gltf-extensions](https://github.com/takahirox/three-gltf-extensions)

#### glTF KHR_materials_variants

- Status: "Complete, Ratified by the Khronos Group". Purpose: "a compact glTF representation of multiple material variants of an asset, structured to allow low-latency switching at runtime"; the example use is commerce (sneaker colourways). Contributors come from Adobe, Emersya, Facebook, OLV, Shopify and Wayfair — [KHR_materials_variants spec](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_variants/README.md)
- Structure: the root holds a `variants` array of names. Each primitive holds `mappings` of {`material` index, `variants` indices}, and "each variant index must be used no more than one time" per mappings array. When no mapping contains the active variant, the viewer falls back to "vanilla glTF behaviour" — [KHR_materials_variants spec](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_variants/README.md)
- The official three.js example `webgl_loader_gltf_variants` reads `gltf.userData.gltfExtensions['KHR_materials_variants'].variants` and the per-mesh `object.userData.gltfExtensions[...].mappings`. It loads the mapped material with `parser.getDependency('material', index)`, then calls `parser.assignFinalMaterial(mesh)`, and caches the original material for fallback. It lights the scene with an `HDRLoader` environment and `ACESFilmicToneMapping` — [three.js example source](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_loader_gltf_variants.html)
- Ready-made helpers: threepipe's `GLTFKHRMaterialVariantsPlugin` (set `selectedVariant`), and glTF-Transform's `KHRMaterialsVariants` class for authoring or editing variants in build scripts — [threepipe plugin](https://threepipe.org/plugin/GLTFKHRMaterialVariantsPlugin.html); [glTF-Transform KHRMaterialsVariants](https://gltf-transform.dev/modules/extensions/classes/KHRMaterialsVariants)

#### MaterialX

- three.js docs: "The node materials loaded with this loader can only be used with WebGPURenderer." The installed r185.1 `MaterialXLoader.js` imports `MeshPhysicalNodeMaterial` and `MeshBasicNodeMaterial` — [three.js MaterialXLoader docs](https://threejs.org/docs/pages/MaterialXLoader.html); [local MaterialXLoader.js](../../../../node_modules/.pnpm/three@0.185.1/node_modules/three/examples/jsm/loaders/MaterialXLoader.js)
- Legacy node-material support for WebGLRenderer was removed in r164. WebGPURenderer can fall back to WebGL2 while still supporting node materials "with some limitations" — [three.js forum: NodeMaterials](https://discourse.threejs.org/t/what-is-going-on-with-nodematerials-all-the-examples-are-gone/66451); [three.js manual: WebGPURenderer](https://threejs.org/manual/en/webgpurenderer.html)
- A three.js forum thread proposes TSL nodes that mirror MaterialX nodes. I found no evidence that this has shipped — [three.js forum: Thoughts on MaterialX support](https://discourse.threejs.org/t/thoughts-on-materialx-support/89517)

#### Approval gates: locked turntable rig, clay first

- CAVE Academy (Jahirul Amin, 2023-06-18): "I usually render in this order for supervisor sign off": v001 "Clay neutral grey shader pass", v002 a grey pass with generic materials (metal, plastic), v003 "look dev and beyond". The light rig and cameras are reused across all stages of asset creation — [CAVE: How to Use the Character Look Development and Lighting Rig 1003](https://caveacademy.com/?p=78400)
- CAVE Asset Render Turntable Builder (Jahirul Amin, 2020-04-17): one render scene and camera "used across multiple departments", so a supervisor can compare a model turntable with a look-dev turntable using "the same cameras, the same light setup, the same everything". It also says "the lighting should remain consistent and where possible, the camera too", and "All render scenes should be set up in an ACEScg colour space" — [CAVE: Asset Render Turntable Builder](https://caveacademy.com/?p=9269)
- CAVE wiki: "Lock the camera (and the light rig) as soon as possible and have all relevant departments use the same dataset ... By doing this, your supe or client is only comparing the changes made to the asset from one version to the next." The reference shoot order is colour chart, grey card, grey ball, chrome ball, then the asset, and "we would actually calibrate our setup and then shoot the reference" — [CAVE wiki: Framing your Asset for Turntables](https://caveacademy.com/wiki/post-production-assets/assets-general/framing-your-asset-for-turntables/)
- Unity HDRP Look Dev is "an image-based lighting tool that contains a viewer for you to check and compare Assets". It renders them "the same way they look in the Scene", can load two assets into two viewports for comparison, needs an Environment Library, and works only in Edit mode. The page found is for HDRP 7.1.8 — [Unity HDRP: Look Dev](https://docs.unity3d.com/Packages/hdrp/manual/Look-Dev)

### Inferences

- **Why the current process has not converged:** the painted concepts mix shape, material and lighting, so each review round moves three variables at once. Tuning glass per vessel to match a painting amounts to baking lighting compensation into each material. Master materials and locked-rig gating exist to prevent exactly that.
- **The three.js equivalent of master and instances:** a material library module with one factory per approved look (for example `glass.amber`, `glass.opal`, `glass.frosted`) returning shared `MeshPhysicalMaterial` objects. Per-vessel overrides would be limited to a short whitelist (for example thickness scale and tint density), mirroring Unreal's "predefined parameters". Anything that changes the shader program (defines, `onBeforeCompile`, toggling transmission on or off) behaves like an Unreal static switch: it forces a recompile, so the master owns it.
- **Binding by name at load:** Blender material names (for example `GW_glass_amber`) are exported as glTF material names. A post-load hook would swap placeholders for library materials by name, as Unity's Search and Remap does. Vessel GLBs would then ship without glass textures, and an unknown material name would fail a CI check instead of rendering silently.
- **KHR_materials_variants is for review, not shipping:** bake two to four candidate looks into one look-dev test GLB (with glTF-Transform at build time, or the three.js example's pattern) so the owner can flip between candidates in one scene. Variants can only hold glTF-expressible materials, and the name-based library already covers sharing.
- **MaterialX:** skip it for WebGLRenderer r185. Revisit only if the game migrates to WebGPURenderer, which has a WebGL2 fallback.
- **Proposed gates:**
  - G0 Shape: clay render in the locked rig, plus a silhouette metric against the clay shape reference.
  - G1 Look: one glass look approved on standard swatch geometry and on one hero vessel in the look-dev scene.
  - G2 In context: the game's exhibit lighting at fixed cameras.
  - Later vessels pass only G0 and G2 and inherit G1. Any change to the material library reopens G1 for every vessel and re-baselines the golden images.
- **Existing tooling:** the repo's blender-modeler skill already has a "silhouette against the concept" gate (per its skill description, `.claude/skills/blender-modeler/SKILL.md`). Pointing that gate at a clay shape reference instead of the painted concept would take material and lighting out of the shape gate.

### Gaps

- I found no game-studio talk or document defining formal gate names or acceptance criteria. The CAVE pages are training material and describe one author's habit ("I usually render in this order"). SIGGRAPH, fxguide and 80.lv studio talks were not fetched in this pass.
- Not verified: whether Unity HDRP Look Dev still exists in current HDRP versions (the page found is 7.1.8).
- Not verified: the Blender 5.2 glTF exporter's exact handling of material names and slots. Standard glTF `material.name` behaviour is assumed.

## 2. Look-dev scene standards, and building one in three.js with automated visual checks

### Takeaway

The standard look-dev kit is a locked camera, neutral lighting (a neutral HDRI or studio), a chrome ball, a mid-grey ball, a ColorChecker and turntable stills, all calibrated before the asset is shot. three.js r185.1 has the pieces for a browser version: `RoomEnvironment`, `ColorEnvironment`, `HDRLoader`, PMREM and `NeutralToneMapping`, the Khronos PBR Neutral curve that is built to preserve base colour. Automated checks can copy three.js's own e2e approach: software rendering, a fixed viewport, deterministic time and randomness, small pixel thresholds and committed goldens. Add perceptual (FLIP) and colour (CIEDE2000) metrics for look approvals, because raw pixel diffs are brittle for refractive glass.

### Cited Findings

#### Reference kit and calibration

- Grey and chrome balls are lighting and reflection references, and the Macbeth chart keeps colours consistent. In VFX look-dev the chart is typically paired with a chrome sphere and a matte sphere (summarised from CAVE Academy and practitioner forum pages) — [CAVE: How do you Shoot the Grey Ball for VFX?](https://caveacademy.com/how-do-you-shoot-the-grey-ball-for-vfx/); [highend3d forum: chrome balls for lighting reference](https://forum.highend3d.com/t/how-to-use-chrome-balls-for-lighting-reference/62023)
- Mid-grey: one studio uses 0.19 and others use 0.18 or 0.21. A fixed mid-grey value lets teams align Macbeth charts shot with different cameras and lighting — [CAVE wiki: Setting your mid grey value](https://caveacademy.com/wiki/post-production-assets/surfacing/surfacing-training/setting-your-mid-grey-value/)
- Calibration means comparing a photographed chart's values with a digital chart. Caveat: a Macbeth chart in an uncalibrated HDRI tells you little about the lighting — [Polycount thread](https://polycount.com/discussion/comment/2734848)
- Reference objects in frame make errors obvious fast, for example a white ball that does not read as white (forum answer, as summarised in search results) — [Blender Artists: Color Chart Question](https://blenderartists.org/t/color-chart-question/1375162)
- CAVE's Houdini look-dev kit bundles grey and chrome balls, a Macbeth chart, a turntable and HDRIs, for regular and ACES workflows — [CAVE: Houdini Look Development and Lighting Props](https://caveacademy.com/product/houdini-look-development-and-lighting-props/)

#### Display transform for judging materials

- Khronos PBR Neutral (2024) "enables faithful reproduction of a product's base color, hue and saturation when using PBR rendering under grayscale lighting, while eliminating HDR artifacts around highlights". It is a 1:1 match up to a maximum value, with the rest reserved as highlight headroom, in about 13 lines of GLSL. Adopters include Blender, Babylon.js, Filament and three.js — [Khronos press release](https://www.khronos.org/news/press/khronos-pbr-neutral-tone-mapper-released-for-true-to-life-color-rendering-of-3d-products)
- three r185.1 exposes `NeutralToneMapping` (constant 7, documented as "Implementation based on the Khronos 3D Commerce Group standard tone mapping") and `AgXToneMapping` (6), alongside ACESFilmic, Reinhard, Cineon and Linear — [local three r185.1 src/constants.js](../../../../node_modules/.pnpm/three@0.185.1/node_modules/three/src/constants.js); [three.js src/constants.js on GitHub](https://github.com/mrdoob/three.js/blob/dev/src/constants.js)
- Blender has a pull request adding a Khronos PBR Neutral view transform, following a proposal issue — [Blender PR #118936](https://projects.blender.org/blender/blender/pulls/118936); [Blender proposal #118824](https://projects.blender.org/blender/blender/issues/118824)

#### three.js building blocks (r185.1)

- `RoomEnvironment` is "a scene with a basic room setup that can be used as input for PMREMGenerator#fromScene", based on model-viewer's `EnvironmentScene`. `ColorEnvironment` is "a scene with a uniform color" whose PMREM "represents uniform ambient lighting". `DebugEnvironment` is also included. Loaders shipped: `HDRLoader`, `RGBELoader`, `EXRLoader`, `UltraHDRLoader`, `HDRCubeTextureLoader`, `KTX2Loader` — [local environments folder](../../../../node_modules/.pnpm/three@0.185.1/node_modules/three/examples/jsm/environments/); [RoomEnvironment.js on GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/environments/RoomEnvironment.js)

#### Cross-renderer references and goldens

- Khronos glTF Render Fidelity compares Khronos sample assets across three.js (via model-viewer), filament.js, babylon.js and the glTF Sample Viewer (real-time), and three-gpu-pathtracer, Dassault STELLAR, V-Ray and Blender Cycles (path traced) — [Khronos Render Fidelity: About](https://github.khronos.org/glTF-Render-Fidelity/about)
- Per search snippets that I could not confirm on the About page: the site treats STELLAR as its reference because it "approaches the physical result with far fewer approximations than are necessary in real-time renderers". It also includes a Furnace Test whose correct result is a 7x7 grid of metal-rough spheres that are all invisible — [Khronos blog: sample assets and render fidelity upgrade](https://www.khronos.org/blog/khronos-upgrades-gltf-sample-assets-and-render-fidelity-comparison-websites); [model-viewer fidelity page](https://modelviewer.dev/fidelity)
- model-viewer's render-fidelity-tools keep reference renders in a `goldens` folder — [model-viewer issue #4483](https://github.com/google/model-viewer/issues/4483)
- A March 2026 refresh added an experimental interactive side-by-side 3D comparison mode (three.js, babylon.js, model-viewer, three.js path tracer) — [Digital Production, 2026-03-23](https://digitalproduction.com/2026/03/23/gltf-sample-assets-and-fidelity-site-refresh/)

#### Screenshot-test practice

- **three.js's own e2e screenshot test (Puppeteer):**
  - Viewport: each example renders at 400x250 with `viewScale = 2` (an 800x500 viewport) and is downscaled before comparison.
  - Thresholds: `pixelThreshold = 0.1`; `maxDifferentPixels = 0.1`, meaning at most 0.1% of pixels may differ.
  - Rendering: software Vulkan (lavapipe) through `VK_DRIVER_FILES`.
  - Determinism: an injected `deterministic-injection.js`, `Math.random` rewritten in workers, a wait for network idle and then for `window._renderFinished`.
  - Flakiness: an exception list for flaky examples and `maxRetries = 2`.
  - Goldens: references are stored as JPEG (quality 95) in `examples/screenshots` and regenerated with `--make`. Failures write `-actual`, `-expected` and `-diff` images.
  - Source: [three.js test/e2e/puppeteer.js](https://github.com/mrdoob/three.js/blob/dev/test/e2e/puppeteer.js)
- **Playwright `toHaveScreenshot`:**
  - The first run generates baselines. They are stored per test file in `*-snapshots` folders, with names that include browser and platform, because "Screenshots differ between browsers and platforms due to different rendering, fonts and more".
  - "Browser rendering can vary based on the host OS, version, settings, hardware, power source". Run tests in the same environment that generated the baselines.
  - `threshold` (0 = strict to 1 = lax, default 0.2) is "an acceptable perceived color difference between the same pixel in compared images". Other options: `maxDiffPixels`, `stylePath`, and `--update-snapshots` to regenerate baselines.
  - Source: [Playwright: Visual comparisons](https://playwright.dev/docs/test-snapshots)
- `maxDiffPixels` (a count) and `maxDiffPixelRatio` (a fraction of all pixels) are image-level limits, and exceeding either fails the assertion — [TestQuality: Playwright visual regression guide](https://testquality.com/playwright-visual-regression-guide/). Per a search snippet, the threshold is a YIQ colour-space distance — [Playwright SnapshotAssertions API](https://playwright.dev/docs/api/class-snapshotassertions)
- QA Wolf: canvas content cannot be targeted with DOM locators, so element screenshots of the canvas are used. It suggests 0.01 for `maxDiffPixelRatio` and warns that animations and live content cause false failures — [QA Wolf: Visual diffing](https://docs.qawolf.com/qawolf/visual-diffing)
- The project already depends on `@playwright/test` ^1.59.1, `sharp` ^0.35.5 and `vitest` ^4.1.5 — [local package.json](../../../../package.json)

#### Perceptual and colour metrics

- NVIDIA ꟻLIP (Andersson et al., HPG 2020) was built to compare rendered images against ground truths. It produces a map approximating the difference a viewer perceives when flipping between the two images. It installs with `pip install flip-evaluator` and is BSD-3 licensed. Standard FLIP handles LDR only (HDR-FLIP is separate), and the authors recommend the mean FLIP value when a single number is needed — [NVIDIA Research: FLIP](https://research.nvidia.com/publication/flip); [NVIDIA developer blog](https://developer.nvidia.com/blog/flip-a-difference-evaluator-for-alternating-images); [FLIP README (mirror of NVlabs/flip)](https://github.com/gmh5225/flip)
- culori: `differenceCiede2000(Kl = 1, Kc = 1, Kh = 1)` returns a `(colorA, colorB)` function computing "the CIEDE2000 ΔE\*00 color difference ... as implemented by G. Sharma". Difference functions operate in `lab65`, and `parse`, `converter` and `nearest` are also provided — [culori API](https://culorijs.org/api/)
- Other JavaScript CIEDE2000 implementations: color-diff (BSD-3), colorlab, cie.js — [color-diff README](https://github.com/dajudge/color-diff/blob/master/README.md); [colorlab](https://npmjs.com/package/colorlab); [cie.js](https://www.npmjs.com/package/cie.js)

### Inferences

- **Proposed three.js look-dev scene (a dev-only route or page in the game build):**
  - **Canvas and cameras:** a fixed canvas (for example 1024x1024 at `pixelRatio` 1, or render at 2x and downscale as three.js e2e does), with three camera presets:
    - A: orthographic side elevation, for the shape gate.
    - B: 3/4 perspective at a fixed field of view and height, for the material gate.
    - C: eight turntable stills at 45-degree steps, for diffs instead of video.
  - **Environments:**
    - E1 `RoomEnvironment`: procedural and neutral, with nothing to download.
    - E2 `ColorEnvironment` uniform grey: a furnace-style energy sanity check.
    - E3 and E4: two contrasting CC0 HDRIs through `HDRLoader` (warm interior, daylight).
    - E5: the game's exhibit lighting rig, used for gate G2.
  - **Props:**
    - A chrome sphere (metalness 1, roughness 0).
    - A mid-grey sphere (linear albedo 0.18).
    - A ColorChecker plane in two copies: unlit `MeshBasicMaterial` to verify the colour pipeline end to end, and lit `MeshStandardMaterial` to read the lighting.
    - For glass, a high-contrast checker or stripe backdrop behind the swatch, which makes refraction offset, roughness blur and absorption measurable.
  - **Tone mapping:** `NeutralToneMapping` for material judgement; the game's own tone mapper for in-context checks.
- **Check layers:**
  1. A Playwright element screenshot of the canvas against a golden at tight tolerance, to catch regressions after approval.
  2. In-page metrics on raw pixels read back from a render target, over fixed regions: mean CIEDE2000 of the colour transmitted through the vessel body against the target, contrast of the backdrop checker seen through the glass (a frosting proxy), and highlight position and size.
  3. Mean FLIP between a candidate and an approved golden. Optionally, also compare against a path-traced reference (Cycles, or three-gpu-pathtracer if it supports the needed glass extensions) rendered with the same HDRI and PBR Neutral transform.
- **Where to run it:** CI in a container with a software GL or Vulkan backend, for determinism, as three.js does. Phones get performance checks and visual sanity checks, not pixel diffs, since Playwright warns that hardware changes rendering.
- **Why per-pixel diffs are not enough for glass:** refraction amplifies sub-pixel changes in camera or geometry, so per-pixel diffs are noisy. Use region colour metrics and FLIP for look approval, and keep pixel diffs for regression detection once a look is frozen.
- **When goldens are made:** only after the owner signs off a G1 image set. Changing the material library then re-runs the suite, and the new baseline is accepted deliberately (`--update-snapshots`).

### Gaps

- I found no authoritative source for CIEDE2000 acceptance thresholds in rendering QA. The rule of thumb that about 1 is a just-noticeable difference was not verified this session.
- No WebGL-specific guidance turned up for deterministic headless Chromium (SwiftShader or ANGLE flags) under Playwright. three.js itself uses lavapipe through Vulkan.
- Not verified: three-gpu-pathtracer's support for KHR_materials_transmission, volume, IOR and dispersion. That decides whether it can serve as a path-traced golden for glass.
- Not fetched: official ColorChecker Classic patch values (X-Rite or BabelColor data).
- The Render Fidelity site's image metrics or thresholds, if any, were not found. The About page describes none.
- Not verified: which Blender release merged the Khronos PBR Neutral view transform. Matching it would let Cycles goldens share three.js's tone curve.

## 3. Shape-only reference images with current image models (unlit, clay, orthographic, multi-view)

### Takeaway

As of October 2026 the leading models are OpenAI's GPT Image 2.5 (Sunburst and Flare; gpt-image-2 shipped in April 2026 and is Codex's built-in image model), Google's Nano Banana 2.1, 2 and Pro (Gemini 3.x image models), FLUX.2 (Nov 2025) and Midjourney V8.x. They all follow natural-language constraints well, but neither vendor documents orthographic or clay rendering. OpenAI also admits trouble with layout-sensitive compositions and with consistency across images. The reliable recipe is one opaque, matte, shadowless view per image, with other views made by reference-image editing or by the 3D vendors' own image-to-multiview step, each checked numerically. Never use glass in a shape reference.

### Cited Findings

#### OpenAI (API, ChatGPT, Codex)

- The current OpenAI image guide names `gpt-image-2.5-sunburst` and `gpt-image-2.5-flare` and does not mention gpt-image-2.
  - Transparency: "For transparent backgrounds with either model, set `background: "transparent"` and use `output_format: "png"` or `"webp"`."
  - Sizes: custom sizes with edges that are multiples of 16, aspect ratio between 1:3 and 3:1, no edge over 3840 px, and 655,360 to 8,294,400 total pixels. "Resolutions above `2560x1440` are experimental."
  - Quality levels: `low`, `medium`, `high`, `xhigh`, `max`, `auto`.
  - Stated limitations: the model "may occasionally struggle to maintain visual consistency for recurring characters or brand elements", and "may have difficulty placing elements precisely in structured or layout-sensitive compositions". Masking is "entirely prompt-based", and complex prompts can take up to 2 minutes.
  - Source: [OpenAI: Image generation guide](https://developers.openai.com/api/docs/guides/image-generation?api=image)
- GPT Image 2.5 was reportedly released on September 8 (2026) as two API models. Flare is speed-first, reportedly with higher quality than gpt-image-2 at up to 50% lower latency. Sunburst is aimed at quality, precision and editing. Pricing is reportedly the same as gpt-image-2. One review notes that OpenAI does not say which variant powers ChatGPT or Codex defaults (secondary) — [APIYI launch note](https://docs.apiyi.com/en/live/2026-09/gpt-image-2-5-flare-sunburst-launch); [Luma guide](https://lumalabs.ai/learning-center/articles/gpt-image-2-5-sunburst-and-flare-complete-guide); [CometAPI](https://www.cometapi.com/what-is-gpt-image-2-5/); [MindStudio review](https://www.mindstudio.ai/blog/gpt-image-25-review)
- gpt-image-2 launched on April 21, 2026 as the model behind ChatGPT Images 2.0, in the API and in Codex. It has a "thinking" mode on paid plans and reportedly produces up to 8 images from one prompt while keeping objects and style consistent (secondary) — [Neurohive](https://neurohive.io/en/news/chatgpt-images-2-0-openai-launches-image-generation-model-with-reasoning-2k-resolution-and-multilingual-text/); [TechWyse](https://www.techwyse.com/?p=75930)
- **OpenAI Cookbook prompting guide** (model table "As of April 21, 2026"; the page is now marked archived):
  - Models: gpt-image-2 is the "Recommended default for new builds"; gpt-image-1.5 and gpt-image-1 are legacy; gpt-image-1-mini is for drafts and large batches.
  - Prompt structure: order the prompt background or scene, then subject, then key details, then constraints. State the intended use, and name materials and medium.
  - Camera: camera specs are interpreted loosely.
  - Edits: say "change only X" and "keep everything else the same", and repeat the preserve list on every iteration.
  - Consistency: create a reusable anchor and restate invariants such as "Do not redesign the character". Refer to each reference image by index.
  - Product shots: "isolate the subject, preserve geometry ... avoid added shadows or backdrops".
  - Not covered: orthographic drawings, clay renders and game assets.
  - Inconsistency: the guide says `input_fidelity` is disabled for gpt-image-2, yet some examples pass it.
  - Source: [OpenAI Cookbook: GPT Image prompting guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)
- Codex: the CLI has had built-in image generation (the `image_gen` tool and the `$imagegen` skill) since about March 2026, with gpt-image-2 as default after its launch. The built-in path needs no API key and counts against ChatGPT plan limits, while a fallback script needs `OPENAI_API_KEY`. Image turns reportedly use up allowance 3 to 5 times faster than text turns (secondary) — [Vaughan: Image generation in Codex CLI](https://codex.danielvaughan.com/2026/04/27/codex-cli-image-generation-gpt-image-2-visual-development-workflows/); [Vaughan: Codex CLI visual workflows v0.137](https://codex.danielvaughan.com/2026/06/04/codex-cli-visual-workflows-image-input-gpt-image-2-generation-asset-pipelines-v0137/); [Atlas Cloud: Codex plugins](https://www.atlascloud.ai/blog/tips/codex-plugins)
- Sources conflict on transparency. The bundled Codex skill reportedly sends transparent-output requests to gpt-image-1.5 "since gpt-image-2 does not support transparent backgrounds" (a mirror of an openai/codex commit). The Cookbook lists transparent output as a gpt-image-2 preview. The current API guide says transparency works with both 2.5 models — [openai/codex mirror](https://upd.dev/openai/codex/src/branch/main/.codespellignore); [OpenAI Cookbook](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide); [OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation?api=image)

#### Google (Gemini image models)

- The Gemini API docs (October 2026) list:
  - Nano Banana 2.1, ID shown as `gemini-nano-banana-2.1`, the "primary workhorse".
  - Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`): fastest and cheapest, 1K only, and "Not optimized for multiple reference inputs or multi-turn sequential editing".
  - Nano Banana 2 (`gemini-3.1-flash-image`).
  - Nano Banana Pro (`gemini-3-pro-image`), the premium model.
  - Legacy Nano Banana (`gemini-2.5-flash-image`).
  - Source: [Gemini API: Image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- Limits and behaviour on the same page:
  - Up to 14 reference images per request. The object-image limit is 14 on Lite, 10 on 2.1 and 2, and 6 on Pro.
  - Resolutions 1K, 2K and 4K (uppercase K; the default is 1K).
  - Thinking "enabled by default and cannot be disabled in the API".
  - A SynthID watermark on every output.
  - A Batch API for volume, with up to 24 hours turnaround.
  - Source: [Gemini API: Image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- Google's own templates and tips:
  - "Describe a scene in rich detail. The more specific you are, the more control you have over the results."
  - Product mockup: "A high-resolution, studio-lit product photograph of a [product] on a [background] ... The camera angle is a [angle type] to showcase [feature]".
  - Minimalist template: "The background is a vast, empty [color] canvas".
  - Inpainting: "change only the [specific element] ... Keep everything else in the image exactly the same, preserving the original style, lighting, and composition".
  - Gemini 3 Pro Image is recommended for professional asset production.
  - Source: [Gemini API: Image generation](https://ai.google.dev/gemini-api/docs/image-generation)

#### Midjourney and FLUX

- The Midjourney V8 line arrived in 2026: V8.0 alpha (March 17), V8.1 made default (June 10) and V8.2 made default (July 24). Sources disagree on which version is the documented default. Omni Reference (`--oref`) is reportedly V7-only or missing in V8.1, and an "Edit Model" reportedly replaces Omni Reference, Character Reference and Retexture (unconfirmed; secondary) — [Midjourney docs: models](https://docs.midjourney.com/docs/models); [Medium: V8.2 default](https://medium.com/@inchristiely/midjourney-v8-2-is-now-the-default-five-things-that-changed-30c8dffcc492); [Atlas Cloud: V8.1](https://www.atlascloud.ai/models/midjourney/v8.1/text-to-image); [issoh.co.jp report](https://www.issoh.co.jp/md/tech/11424)
- FLUX.2 (Black Forest Labs, November 25, 2025) takes up to 10 reference images and outputs up to 4 MP. Variants are [pro], [flex], [dev] (open weights, 32B) and [klein]. It pairs a Mistral 3 24B vision-language model with a rectified-flow transformer — [BFL blog: FLUX.2](https://bfl.ai/blog/flux-2); [AlternativeTo](https://alternativeto.net/news/2025/11/black-forest-labs-releases-flux-2-image-models-with-open-weights-and-high-res-features/); [Vercel: FLUX.2 max](https://vercel.com/ai-gateway/models/flux-2-max)

#### View conventions and consistent multi-view generation

- MV-Adapter (ICCV 2025) is a plug-in for text-to-image models (SDXL, 768x768) that generates consistent multi-view images. It was trained on about 70k Objaverse objects rendered orthographically (six views per sample). Its camera layout is 0° elevation at azimuths 0, 90, 180 and 270 (the Era3D layout), which the authors say makes it easy to plug into image-to-3D. It reports beating ImageDream, Zero123++, CRM, SV3D and Era3D on PSNR, SSIM and LPIPS — [MV-Adapter (arXiv)](https://arxiv.org/pdf/2412.03632); [ICCV 2025 supplement](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Huang_MV-Adapter_Multi-View_Consistent_ICCV_2025_supplemental.pdf); [ICCV poster](https://iccv.thecvf.com/virtual/2025/poster/487)
- Hunyuan3D 2.0 fixes "4 orthogonal viewpoints as basis since they cover most parts of the geometry" before adding more views — [Hunyuan3D 2.0 paper](https://arxiv.org/html/2501.12202)
- The 3D vendors standardise view order and offer their own image-to-multiview step:
  - Tripo canonicalises inputs to [front, left, back, right]. Its `generate_multiview_image` and `edit_multiview_image` tasks can be passed straight to multiview-to-model by `task_id` — [Tripo P series doc](https://developers.tripo3d.com/en/docs/generation-multiview-to-model/p.md); [ComfyUI: Tripo Image to Multiview node](https://docs.comfy.org/built-in-nodes/TripoImageToMultiviewNode.md)
  - Meshy accepts an `input_task_id` from its Text-to-Image or Image-to-Image tasks, "including multi-view" — [Meshy: Multi-Image to 3D](https://docs.meshy.ai/api/multi-image-to-3d.md)

#### Why glass breaks references

- 3DReflecNet (CVPR 2026): reconstruction is best on diffuse materials, drops noticeably on glossy ones, and drops severely on metallic and transparent ones. The Hausdorff distance "explodes" on non-Lambertian materials, meaning geometry goes missing. Glass images are a blend of a transmission layer and a reflection layer — [3DReflecNet (arXiv)](https://arxiv.org/pdf/2605.10204); [CVPR 2026 supplement](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Liang_3DReflecNet_A_Large-Scale_CVPR_2026_supplemental.pdf)
- Removing the background from a transparent object leaves background colours and reflections inside it (a green glass bottle example) — [Dreamina case study](https://dreamina.capcut.com/ai-image/glass-reflective-product-scenes); [Cutout.pro guide](https://www.cutout.pro/learn/?p=2612). At grazing angles, the colour seen through glass approaches the background colour — [US patent 9357204](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9357204)
- "Complex light paths induced by refraction and reflection have prevented both traditional and deep multiview stereo from solving this challenge" — [UCSD, CVPR 2020: Neural 3D Reconstruction of Transparent Shapes](https://cseweb.ucsd.edu/~viscomp/projects/CVPR20Transparent/)
- Image-to-3D pipelines remove the background and normalise object size before shape conditioning (Hunyuan3D-DiT), so any matte error on a transparent object carries into the geometry — [Hunyuan3D 2.0 paper](https://arxiv.org/html/2501.12202)

### Inferences

- **Never put glass in a shape reference.** Ask for the same form as opaque matte clay. Glass corrupts silhouettes (see-through interiors, refraction-shifted edges, highlights read as geometry), background removal and image-to-3D input alike.
- **Most vessels are surfaces of revolution.** One orthographic side elevation (the profile) fully defines the body. Extract the profile curve from that silhouette and revolve it in Blender, which avoids cross-view consistency entirely. Extra views are needed only for asymmetric parts (handles, spouts, pinched lips), plus a top view when the cross-section is not circular.
- **One view per image, not a four-up sheet.** OpenAI documents difficulty with "layout-sensitive compositions". Make the other views by editing with the front as reference ("Using image 1 as the exact object, show it from the left at the same scale and camera height; change only the viewpoint; do not redesign it"), restating the invariants each time as the Cookbook advises. Alternatively, hand the front view to Tripo's or Meshy's image-to-multiview step.
- **A prompt skeleton built from the OpenAI and Google guidance:**
  - Background: "plain flat light-grey background, no floor line, no horizon, no props".
  - Subject: "a single [vessel description] made of uniform matte mid-grey clay; opaque; no glass, no transparency, no reflections, no surface decoration".
  - Camera: "orthographic side elevation, camera at the vessel's mid-height, 0° elevation, no perspective, whole object centred with a 10% margin".
  - Lighting: "flat, even, shadowless ambient light; no cast shadow, no highlights, no rim light".
  - Use and constraints: "technical reference for 3D modelling".
  - Variant for silhouette metrics: "solid black silhouette on white".
- **Check the images numerically instead of re-prompting at length.** OpenAI notes that camera specs are interpreted loosely, so check:
  - left and right widths are symmetric about the axis;
  - the rim and foot read as straight lines, not ellipses, in a true 0° orthographic side view;
  - the axis is vertical;
  - no cast-shadow pixels touch the silhouette.
    Reject failing images.
- **Cost:** draft at low quality and 1K (gpt-image-1-mini or Flare; Nano Banana 2 Lite) and finish at higher quality. Use the Gemini Batch API for bulk runs. Codex image turns spend plan allowance faster than text turns.
- **Choosing a model for an agent-driven pipeline:** Nano Banana 2.1 or Pro and FLUX.2 accept many reference images, which helps keep a consistent house style across reference sheets. Midjourney fits poorly: I found no verified API, and its reference features are changing between V7 and V8.

### Gaps

- No vendor guidance specific to orthographic, clay or turnaround prompting, and no tests comparing models on orthographic accuracy, were found.
- OpenAI's official Codex image-generation docs were not read. Which GPT Image variant Codex uses by default after the 2.5 release is unknown.
- The Gemini model ID string `gemini-nano-banana-2.1` is as the page reports it but unusual; verify it before coding against it.
- Not verified: Midjourney's official API availability and current default model.

## 4. Multi-view image-to-3D tools (2025–2026): inputs, baked lighting, clean geometry with replaceable materials

### Takeaway

All the commercial tools now take two to eight views and expose geometry-only output and delighting:

- Meshy 7.1: `should_texture:false`, `remove_lighting` on by default.
- Tripo v3: `texture:false`, `delight` on by default.
- Rodin Gen-2/2.5: `material: None`. Avoid `Shaded`, which is baked lighting.
- Hunyuan3D: a delight model trained so that textures are "lighting-invariant".
- TRELLIS.2 (open, Dec 2025): outputs PBR with opacity.

None of them produces refraction, IOR or volume absorption. For glass vessels, take geometry only from clay multi-view inputs and assign the shared glass material by name.

### Cited Findings

#### Meshy (Multi-Image to 3D, current docs)

- `POST /openapi/v1/multi-image-to-3d` takes 1 to 4 images (.jpg, .jpeg, .png or .webp, at most 20 MB each), and "the images should show the same object from different angles". With meshy-7.1 or latest, the first image is treated as the front. Models: `latest` (Meshy 7.1), `meshy-7.1`, `meshy-6`, `meshy-6-lite` (`meshy-7` is deprecated). `geometry_resolution` is `standard` or `2k` (2048³) — [Meshy: Multi-Image to 3D](https://docs.meshy.ai/api/multi-image-to-3d.md)
- Texture options:
  - `should_texture` (default true; false returns an untextured mesh).
  - `enable_pbr` (default false; adds metallic, roughness and normal maps).
  - `texture_resolution` (2k, 4k or 8k).
  - `texture_prompt` (at most 800 characters) and `texture_image_url`.
  - `texture_image_urls` (1 to 4 multi-view texture references, 7.x only).
  - Source: [Meshy: Multi-Image to 3D](https://docs.meshy.ai/api/multi-image-to-3d.md)
- Lighting options: `image_enhancement` defaults to true, and "false keeps the exact look of the inputs". `remove_lighting` defaults to true and removes highlights and shadows from the base colour, a cleaner result that "works better under your own lighting" — [Meshy: Multi-Image to 3D](https://docs.meshy.ai/api/multi-image-to-3d.md)
- Mesh and output options:
  - `should_remesh` defaults to false on non-lite models, which is the setting for highest quality.
  - `topology` (quad or triangle) and `target_polycount` (100 to 300,000, default 30,000).
  - `decimation_mode` and `save_pre_remeshed_model`.
  - `symmetry_mode` is deprecated and "doesn't affect output".
  - `auto_size` with `origin_at` (bottom or center).
  - Output formats: glb, obj, fbx, stl, usdz and 3mf.
  - `multi_view_thumbnails` returns front, right, back and left previews.
  - Credits: an example task consumed 30 credits, and failed tasks are refunded.
  - Source: [Meshy: Multi-Image to 3D](https://docs.meshy.ai/api/multi-image-to-3d.md)
- An older version of the same page listed meshy-5 and meshy-6, with `latest` meaning Meshy 6 — [Meshy docs (older page)](https://docs.meshy.ai/api/multi-image-to-3d)

#### Tripo (v3 API)

- `POST /generation/multiview-to-model`. The P series is "Optimized for low-poly output with clean topology": P1-20260311, and P2-20260801 (Preview, with quad output). The default H series model is v3.1-20260211.
  - Inputs: views keyed front, left, back and right. "The front view cannot be omitted"; at least 2 images; PNG, JPEG or WebP, at least 256 px.
  - "All images should depict the same object under consistent lighting."
  - Source: [Tripo: Multiview to 3D Model (P Series)](https://developers.tripo3d.com/en/docs/generation-multiview-to-model/p.md)
- Options:
  - `texture:false` gives "a bare geometry without any textures". `pbr` defaults to true (base_color, metallic, roughness, normal) and forces texturing.
  - `model_seed`: the same seed and input give an identical mesh. `texture_seed` varies the texture on fixed geometry.
  - `face_limit`: P1 50 to 20,000; P2 48 to 50,000, or 25,000 with quads.
  - `texture_quality`: fast, standard, detailed, or extreme (8K).
  - `delight` (default true) "Removes baked-in lighting from the reference image". Only `texture_version` v3.5-20260815 reads it.
  - `auto_size` (real-world metres) and `export_uv`. Orientation should be converted at the end through `/v3/models/convert`.
  - Source: [Tripo: Multiview to 3D Model (P Series)](https://developers.tripo3d.com/en/docs/generation-multiview-to-model/p.md)
- fal.ai's wrapper for Tripo H3.1 multiview takes 2 to 4 images, with the front required (secondary) — [fal.ai: Tripo H3.1 multiview-to-3d](https://fal.ai/models/tripo3d/h3.1/multiview-to-3d/llms.txt)

#### Rodin / Hyper3D (Deemos)

- Rodin Gen-2, per reseller API docs:
  - Inputs: up to 5 images as multi-view references (jpg or png, under 4096x4096 px and 30 MB).
  - `material`: PBR (default), Shaded, All, or None (an untextured white mesh). **"Shaded means baked lighting."**
  - `mesh_mode`: Quad or Raw. Outputs: glb, obj, usdz, fbx and stl.
  - The same seed gives similar but not identical results.
  - About $0.80 per generation on EmpirioLabs.
  - Sources (secondary): [EmpirioLabs: Hyper3D Gen2](https://docs.empiriolabs.ai/models/hyper3d-gen2); [Runware: Rodin Gen-2](https://runware.ai/docs/models/hyper3d-rodin-gen-2)
- Scenario's help page (updated June 2026) says the current generation is Rodin Gen-2.5, with Standard and Fast tiers (secondary) — [Scenario: Rodin Hyper3D Models](https://help.scenario.com/articles/6155258011-rodin-hyper3d-models-the-essentials)

#### Tencent Hunyuan3D

- Release history:
  - Hunyuan3D 2.0 (January 21, 2025) open-sourced the shape DiT, the Paint texture model and `Hunyuan3D-Delight-v2-0`, an "Image Delight Model".
  - 2mv, a multi-view image-to-shape model, and 2mini followed on March 18, 2025.
  - 2.1 (June 13, 2025) was "fully open-sourced with new PBR model".
  - The 2.5 technical report came out on June 23, 2025.
  - A Blender add-on was released on January 27, 2025.
  - Source: [Hunyuan3D-2 GitHub](https://github.com/Tencent-Hunyuan/Hunyuan3D-2)
- The 2.0 paper says reference images often have uneven lighting, and "Directly inputting such images into the multi-view generation framework can cause illumination and shadows to be baked into the texture maps". The fix is an image-to-image delighting step (InstructPix2Pix-style) trained on pairs rendered under "a random HDRI environmental map" and under "an even white light". As a result, "All generated texture maps are seamless and lighting-invariant" — [Hunyuan3D 2.0 paper](https://arxiv.org/html/2501.12202)
- Hunyuan3D 3.0, through ComfyUI partner nodes: 2 to 4 multi-view images improve geometry and material fidelity, with PBR materials and "professional UVs". Hunyuan3D 3.1 Pro multiview reportedly takes up to 8 reference images and supports up to 1.5M faces (secondary) — [ComfyUI docs: Hunyuan3D 3.0](https://docs.comfy.org/tutorials/partner-nodes/hunyuan3d/hunyuan3d-3-0); [ComfyUI blog](https://blog.comfy.org/p/hunyuan-3d-30-in-comfyui-state-of); [Scenario: Hunyuan 3D 3.1 Pro Multiview](https://www.scenario.com/models/hunyuan-3d-31-pro-multiview); [Layer: Hunyuan3D v3.1 Pro](https://www.layer.ai/models/tencent--hunyuan3d-v3.1-pro)

#### Microsoft TRELLIS.2

- TRELLIS.2-4B (December 2025, MIT licence) uses an O-Voxel representation with "full PBR materials, including transparency/translucency" (opacity). It takes about 3 s at 512³ and about 60 s at 1536³ on an H100, needs an NVIDIA GPU with at least 24 GB, and was tested only on Linux — [TRELLIS.2-4B model card](https://huggingface.co/microsoft/TRELLIS.2-4B); [ComfyUI Wiki, 2025-12-18](https://comfyui-wiki.com/en/news/2025-12-18-microsoft-trellis2-3d-generation). The output map list (albedo, metallic, roughness, normal, opacity) comes from a secondary source — [Codesota](https://www.codesota.com/news/trellis-2-3d-generation)

### Inferences

- **Use these tools for geometry only.** Glass appearance lives in transmission, IOR, attenuation and roughness parameters that these tools do not produce. TRELLIS.2's opacity is alpha, not refraction or volume absorption. Request `should_texture:false`, `texture:false` or `material: None`, then bind the shared glass material by name, as in question 1.
- **Inputs should be clay renders or clay generations, not glass paintings.** Tripo explicitly asks for consistent lighting across views, and the ideal consistent input is clay renders from one locked rig. When the inputs are already clean, Meshy's `image_enhancement:false` keeps their exact look.
- **AI meshes probably come out solid.** A hollow glass vessel needs a wall thickness and an inner surface, or at least a correct `thickness` value for three.js transmission. Generated meshes are likely to arrive as solid closed shells, which would need a post-pass (Solidify or shelling in Blender, or a rebuilt profile). That is another reason to treat AI meshes as blockouts for lathe-type vessels and keep procedural bpy for final geometry.
- **Reproducibility:** record vendor, model version string, seed and input image hashes in each asset's manifest. Tripo's `model_seed` gives identical meshes; Rodin's seeds do not.
- **Cheap vendor trial:** run each candidate once on a single hero vessel's clay four-view set. Measure silhouette IoU against the reference at the four canonical views, plus watertightness and polycount, then standardise on one vendor.

### Gaps

- The official Hyper3D/Deemos and Tencent API docs were not fetched. Details for Rodin Gen-2/2.5 and Hunyuan3D 3.x come from resellers.
- I found no independent benchmark of these tools on vessels or glass-like objects.
- Not verified: whether any tool outputs hollow interiors or wall thickness.
- Not verified: whether TRELLIS.2 supports multi-image conditioning.
- Meshy's per-option credit costs are not on the API page.

## 5. Material references independent of any asset, and judging a material independent of scene lighting

### Takeaway

Define each glass look as a material card made of parameters, real photographs and approved swatch renders, not as a painting of a vessel. The lighting-invariant properties of glass are measurable: absorption colour per distance (KHR_materials_volume), IOR, roughness and scattering. Real glass is also documented in both transmitted and reflected light. Judge a candidate on standard swatch geometry under several fixed environments with the PBR Neutral display transform. It passes only if it reads correctly in all of them without per-scene edits.

### Cited Findings

- KHR_materials_volume (ratified) definitions:
  - `attenuationColor` is "The color that white light turns into due to absorption when reaching the attenuation distance".
  - `attenuationDistance` is the "average distance that light travels in the medium before interacting with a particle", in world space.
  - The extinction coefficient is σt = −log(c)/d.
  - "Base color changes the color of light at the volume boundary. Absorption occurs while the light is traveling through the volume."
  - Thickness is "given in the coordinate space of the mesh", and "Baking thickness into a map is similar to ambient occlusion baking".
  - Source: [KHR_materials_volume spec](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_volume/README.md)
- three r185.1 GLTFLoader supports KHR_materials_transmission, volume, ior and dispersion, but not KHR_materials_diffuse_transmission, which matters for opal and frosted looks — [local three r185.1 GLTFLoader.js](../../../../node_modules/.pnpm/three@0.185.1/node_modules/three/examples/jsm/loaders/GLTFLoader.js)
- Physically Based (by Anton Palmqvist) is an open database of real-world material properties (RGB colour, metalness, IOR, density), light sources and camera sensors. It has an API at api.physicallybased.info and is released under CC0. It includes glass entries (generic glass, flint glass and others), per a Raycast extension built on it. A 2026 paid PDF lists PBR values for 600 materials — [80.lv](https://80.lv/articles/physically-based-a-database-of-pbr-values-for-real-world-materials/); [Raycast: PBR Assistant](https://www.raycast.com/chad_ashley/pbr-assistant); [CG Channel, 2026-01-26](https://www.cgchannel.com/2026/01/this-25-pdf-lists-the-pbr-values-for-600-real-world-materials/)
- Real opalescent glass reads differently in transmitted and reflected light, and with thickness (retailer and reviewer descriptions of Bullseye glass):
  - Opaline striker looks clear when cold and strikes to a milky white that transmits warm-hued light on a full fuse. Thin pieces look yellowish; thick pieces look warmer, almost orange.
  - Opaque White Opal looks brighter than White Opal in reflected light but greyer in transmitted light.
  - White Opal shows slight dappling in transmitted light.
  - Bullseye's black opal is compositionally a transparent glass that transmits almost no light.
  - Sources: [Warm Glass: Opaline Striker 0403](https://www.warm-glass.co.uk/products/bullseye-sheet-glass-2mm-opaline-striker-0403-50); [Warm Glass: Opaque White Opal 0013](https://warm-glass.co.uk/products/bullseye-sheet-glass-3mm-opaque-white-opal-0013-30); [Warm Glass: White Opal 0113](https://warm-glass.co.uk/products/bullseye-sheet-glass-3mm-white-opal-0113-30); [Creative Glass Shop: Black Opalescent](https://creativeglassshop.ch/en/bullseye-opalescent-sheet/1286-bullseye-black-opalescent-3mm-fusible-glass-sheets.html)
- Documenting the lighting is part of the reference: shoot colour chart, grey card, grey ball and chrome ball under the subject's lighting after calibrating the setup — [CAVE wiki: Framing your Asset for Turntables](https://caveacademy.com/wiki/post-production-assets/assets-general/framing-your-asset-for-turntables/). Without calibrated lighting, chart comparisons say little — [Polycount thread](https://polycount.com/discussion/comment/2734848)
- PBR Neutral is designed to keep base colour, hue and saturation faithful under greyscale lighting, which makes it the right display transform for judging material colour — [Khronos press release](https://www.khronos.org/news/press/khronos-pbr-neutral-tone-mapper-released-for-true-to-life-color-rendering-of-3d-products)
- Side-by-side comparison against a reference asset under the same environment is a standard look-dev tool feature (Unity Look Dev's two viewports) — [Unity HDRP: Look Dev](https://docs.unity3d.com/Packages/hdrp/manual/Look-Dev)
- Image models offer "studio-lit product photograph" templates, but neither OpenAI's nor Google's guide makes any claim about physically accurate refraction or transmission — [Gemini API: Image generation](https://ai.google.dev/gemini-api/docs/image-generation); [OpenAI Cookbook](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)

### Inferences

- **The material card (one per look: amber, opal, frosted) has three parts:**
  1. Three to six real photographs with legible lighting, ideally paired transmitted (backlit) and reflected (front-lit) shots, the way glass sellers present sheet glass.
  2. A short parameter spec: IOR about 1.5; attenuation colour and distance for amber; roughness for frosted; scattering and opacity notes for opal.
  3. Approved engine renders of the swatch set in the look-dev scene. These approved renders, not the photographs, become the goldens.
- **Swatch geometry, all placed in front of a checker or stripe backdrop:**
  - A sphere, for Fresnel and reflections.
  - A thick-walled tumbler, which is the vessel case: wall against body thickness, and the rim.
  - A stepped thickness wedge, for absorption against thickness. That is the behaviour that defines amber under Beer–Lambert attenuation, per KHR_materials_volume.
- **The lighting-independence test:** render every swatch under environments E1 to E4 from question 2. A look passes only if it reads as the target in all of them with no per-environment edits. If it matches under just one environment, the mismatch is in the lighting, not the material.
- **Metrics for the test:**
  - The colour transmitted through each wedge step on a white backdrop, compared with the Beer–Lambert prediction from attenuationColor and attenuationDistance (CIEDE2000).
  - Backdrop-checker contrast seen through frosted glass.
  - Fresnel F0 sanity: for n = 1.5, ((n−1)/(n+1))² = 0.04, about 4% reflectance at normal incidence (derived, not sourced).
- **A cheap source of real reference:** photograph actual objects (an amber bottle, a frosted jar, an opal glass offcut) once on a light box for transmitted light, and once on a grey card under diffuse daylight for reflected light, with a ColorChecker in frame. That gives lighting-documented targets in under an hour.
- **AI-generated swatches** (for example "amber glass sphere on grey") are mood references only, never numeric targets. They invent optics and bake in their own lighting.
- **Opal and frosted will hit engine limits.** r185 GLTFLoader has no diffuse transmission, and rough transmission in `MeshPhysicalMaterial` is an approximation. Their cards should state a stylised target the engine can reach, approved on engine renders.

### Gaps

- I found no sourced measured transmittance or colour values for amber, opalescent or frosted glass. The Physically Based glass values were not retrieved, and no Bullseye technical data sheets were found.
- I found no published method specifically for judging real-time glass "independent of lighting". The multi-environment test is my inference from standard look-dev practice.
- Khronos glTF sample assets probably useful for glass (TransmissionTest, AttenuationTest, DragonAttenuation, MosquitoInAmber, GlassVaseFlowers, IORTestGrid, TransmissionRoughnessTest, DispersionTest) are named from prior knowledge, not verified this session. Check https://github.com/KhronosGroup/glTF-Sample-Assets.
- Licensing of photographic references (retailer and museum images) was not checked. Treat them as internal reference only.
