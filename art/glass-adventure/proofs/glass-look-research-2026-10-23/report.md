# Light the Glass Before Modelling More Vessels

Glassworks glass reads dull, brown or darker than its wall because of the light around it and the materials laid over it, not because of the vessels' shapes. The next step is one shared glass system, approved on swatches before anyone models another vessel. In three.js r185, transmission can only show a refracted, darkened copy of the opaque scene behind the glass, and it replaces the material's diffuse lighting outright. The galleries give that copy little to show. Every room shares one hemisphere, one shadowed key and one rim light. One probe captured at the spawn reflects every room. And ACES at the gallery's 0.9 exposure pushes amber about 12° toward yellow and strips 57–60% of the chroma from pastel glass. The vessels make it worse:

- the catalog's glass recipe never reaches an authored GLB;
- 18 of the 26 campaign exhibits are thin-walled DoubleSide shells with no volume;
- the amber urn and celadon decanter transmit nothing;
- a per-frame override blanks the authored emissive on transmissive materials;
- glass shards reuse their vessel's transmissive materials.

The fix has four parts:

- a material library bound by glTF material name at the existing `prepareExhibitAsset` hook;
- luminous looks (amber, opal, frosted) driven by per-family studio environments plus emissive and translucency terms, with screen transmission kept for clear crystal;
- an emissive backdrop, plinth top or cavity liner near 1.45 linear radiance behind coloured glass, about four times the lit wall measured behind the opal amphora, under Neutral tone mapping, with resident lights that never change the light count;
- pre-authored fracture with impact-biased shards, glossy cut faces and an opaque fake-glass shard material.

The pipeline should split three gates: shape from opaque clay references, look from swatches in a locked rig, and context in the game's own renderer. Amber should be approved first, because it forces the rig decisions that every later look must live inside. Nothing has been measured on a phone, so every tier proposed here is a structural estimate that one device test must settle.

## Today's glass can only show a darkened copy of the wall behind it

three.js r185 renders transmission as **one screen-space pass per camera**. Whenever a transmissive object is in the render list, the renderer redraws the background and every opaque object into a separate target. That target is mipmapped, uses at least 4× MSAA, is half-float where the device allows, and is sized `viewport × transmissionResolutionScale`, with tone mapping switched off ([WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js)). Each transmissive pixel then refracts once through a single interface, picks a mip level from its roughness and samples that copy, tinted by base colour and Beer–Lambert absorption ([transmission_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)). The result **replaces the diffuse term**: `totalDiffuse = mix(totalDiffuse, transmitted.rgb, material.transmission)` ([transmission_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_fragment.glsl.js)).

No scene light passes through the glass body, because r185 has no transmission term for punctual lights ([lights_physical_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/lights_physical_pars_fragment.glsl.js)). Transparent and transmissive surfaces also stay out of the copy, except DoubleSide back faces on some devices, so glass cannot see other glass ([three.js forum](https://discourse.threejs.org/t/objects-with-transmission-not-showing-objects-behind/47113)). The body of a highly transmissive vessel therefore shows (1 − Fresnel) × tint × absorption × the opaque pixel behind it. Only the terms added after the mix (specular reflection, sheen and emissive) are independent of the background ([meshphysical.glsl.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderLib/meshphysical.glsl.js)).

Read against that model, the symptoms the owner keeps rejecting are correct behaviour:

- **Amber in front of a wall reads brown** because the wall is its only light.
- **Frosted amber turns caramel** because roughness 0.4 selects mip level ≈4.4 on a 1920-pixel target, which squeezes the whole screen into about 90 pixels. Every frosted pixel averages a wide patch of the same dim room, and more roughness only averages more of it.
- **A milky opal at high transmission** loses its diffuse scattering, so it can never be brighter than the wall behind it.

The blur also depends on resolution. The game's fixed 0.5 transmission scale makes roughness-0.4 glass about 1.5× blurrier than at full scale, so a frost tuned at one scale drifts at another.

The galleries give that model little to work with:

- **Lights.** Every room in a level shares a `HemisphereLight` at 0.6, one shadowed key `DirectionalLight` at 2.5 and an unshadowed teal rim at 0.75 ([glass-renderer.ts:215-241](../../../../packages/glass-game/src/render/glass-renderer.ts)). **No campaign level has a per-room or per-plinth light.**
- **Shadows.** The key's single orthographic shadow map spans 32.6–88.1 m, so its texels are 3.2–8.6 cm wide ([scene-catalog.ts:198-230](../../../../packages/glass-game/src/render/scene-catalog.ts)).
- **Reflections.** They come from **one cube capture taken at the spawn**, `(0, 1.15, −2.8)` in all four campaign levels. That capture then stands in for rooms 50–70 m away ([scene-catalog.ts:244-251](../../../../packages/glass-game/src/render/scene-catalog.ts); [environment.ts:42-66](../../../../packages/glass-game/src/render/environment.ts)).
- **Tone mapping.** The renderer uses `ACESFilmicToneMapping` at exposure 0.9 ([glass-renderer.ts:151-152](../../../../packages/glass-game/src/render/glass-renderer.ts)). r185 divides that by 0.6, an effective 1.5× gain ([tonemapping_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js)).

Two quieter defects add to it. First, whenever the scene has an environment, r185 overwrites `envMapIntensity` with `scene.environmentIntensity` (0.65 here) on every standard or physical material that has no `envMap` of its own ([WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js)). The fallback glass's 1.5 and the chips' 1.3 therefore do nothing. Second, three's shadow map ignores transmission ([WebGLShadowMap.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/webgl/WebGLShadowMap.js)). Each glass intact casts shadows ([vessels.ts:245](../../../../packages/glass-game/src/render/vessels.ts)), so it throws a fully opaque shadow onto its plinth.

Museums do the opposite. The architect of the Corning Museum of Glass's contemporary wing says horizontal light on a glass plane makes it look dark, while light from above "brings it to life". That skylit wing averages **200–300 footcandles** ([Architectural Record](https://www.architecturalrecord.com/articles/7528-corning-museum-of-glass-contemporary-art-design-wing)).

The vessels then ignore the game's own glass definition. `CLEAR_GLASS` and each recipe's tint, roughness, transmission and thickness only build the fallback material shown before a GLB installs. Authored GLB materials are cloned as they are and win ([catalog.ts:20-27](../../../../packages/glass-game/src/render/catalog.ts); [vessels.ts:149-163](../../../../packages/glass-game/src/render/vessels.ts); [material-library.ts:16-65](../../../../packages/glass-game/src/render/material-library.ts)).

The five clear variants (goblet, coupe, decanter, amphora and fluted carafe) fill **18 of the 26 campaign exhibits** ([campaign.ts:17-54](../../../../packages/glass-game/src/content/campaign.ts)). They ship DoubleSide `glass_shell` and `glass_cut` materials with no `KHR_materials_volume`, so three renders them thin-walled, with no refraction offset and no absorption ([adventure-v3 GLBs](../../../../apps/beside-cue/public/games/adventure-v3/)). The shipped amber urn and celadon decanter are opaque `MeshStandardMaterial` with no transmission at all ([amber-cadence-urn-qa-v2.glb](../../../../apps/beside-cue/public/games/adventure-v6/amber-cadence-urn-qa-v2.glb); [celadon-lark-decanter-fracture-v4.glb](../../../../apps/beside-cue/public/games/adventure-v6/celadon-lark-decanter-fracture-v4.glb)).

Every frame, each imported material with `transmission > 0` has its emissive colour overwritten with the stress teal and its intensity set to the stress value, which is 0 at rest. The opaline shell's authored emissive map therefore stays dark ([vessels.ts:653-659](../../../../packages/glass-game/src/render/vessels.ts)). The package's one shared look, a five-recipe finish bank, is applied by material name to runner walls only ([material-finishes.ts](../../../../packages/glass-game/src/render/material-finishes.ts)).

| What the owner sees                | Why r185 produces it                                                                 | What the game does that triggers it                            |
| ---------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Amber reads as a brown band        | Transmitted colour is tint × absorption × the opaque pixel behind; no light is added | Walls behind exhibits; no backdrop, niche or plinth light      |
| Frosted amber turns caramel        | Roughness selects a blurred mip of the same dim surroundings                         | Rough transmission at a fixed 0.5 scale                        |
| Opal reads darker than the wall    | Transmission replaces the diffuse lobe that would scatter light                      | High transmission on a white base under cyan-tinted room light |
| Pastels and champagne wash out     | ACES strips chroma and pushes oranges toward yellow                                  | ACES at exposure 0.9                                           |
| Authored glow vanishes             | Emissive is overwritten every frame                                                  | Stress override on every transmissive material                 |
| Reflections belong to another room | The probe is captured once, at the spawn                                             | One probe for all rooms; `envMapIntensity` ignored             |

The two procedural rebuilds hit exactly this wall:

- **Amber Cadence Urn.** It beat the shipped file on silhouette (IoU 0.990 against 0.930), but stopped after six critic rounds because "the frosted amber reads as satin butterscotch, and clear amber shows the gallery behind it". Two passes of material tuning left its in-game saturation at 0.68, against the concept's 0.81 ([urn LEDGER](../../../../art/glass-adventure/procedural/amber-cadence-urn/LEDGER.md)).
- **Opaline Echo Amphora.** It stopped after seven rounds. Lifting the opal toward white bought brightness, but "the room's light turns a near-white surface cyan". The lifted opal peaked at 185 against a wall at 173, and the ledger concludes that "the concept's 208 belongs to its studio light" ([amphora LEDGER](../../../../art/glass-adventure/procedural/opaline-echo-amphora/LEDGER.md)).

Both ledgers end on the same open choice: light the exhibit in the game. No further modelling round can make that choice.

## One name-bound library should own every glass look

Engines stop per-asset drift by making the material a shared, parameterised asset:

- Unreal's material instances change appearance "without the expensive recompile" but are "limited to predefined material parameters". A static switch in an instance does force a recompile ([Epic API](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UMaterialInstanceConstant?lang=en-US); [UE-231474](https://issues.unrealengine.com/issue/UE-231474)).
- Unity's importer remaps a model's placeholder materials to existing material assets by name ([Unity manual](https://docs.unity.cn/Components/FBXImporter-Materials.html)).

three.js has neither ([three.js forum](https://discourse.threejs.org/t/how-to-change-the-color-of-two-objects-or-parts-of-them-gltf/33093)), so Glassworks needs its own. That is a module of approved looks (`glass.clear`, `glass.amber`, `glass.opal`, `glass.frosted`, each with `cut` and `shard` variants) bound to imported materials at load. Per-vessel overrides stay on a short whitelist, such as thickness scale and tint density. Anything that changes the shader program belongs to the look, as a static switch belongs to an Unreal master material.

The codebase already has the seam. `prepareExhibitAsset` builds one material table and loops its materials by name for unit scaling, right after flattening ([exhibit-asset.ts:99-141](../../../../packages/glass-game/src/render/exhibit-asset.ts)). The unshared install, the shared geometry pool and the runner walls all pass through it. Pools clone the prepared template for every lease, so a look bound there reaches every vessel ([exhibit-geometry-pool.ts:88-160](../../../../packages/glass-game/src/render/exhibit-geometry-pool.ts)). Three facts shape the binding:

1. **Names are ambiguous today.** `glass_shell` labels both the clear Meshy vessels and the opaline amphora. Existing GLBs therefore need a recipe-level map from material name to look, and new exports should carry the look in the name.
2. **Build fresh rather than patch the import.** Amber and celadon arrive as `MeshStandardMaterial`. The finish bank's `apply()` erases authored base-colour maps and samples uv0 only, and the glassware trio has no UVs ([material-finishes.ts:33-101](../../../../packages/glass-game/src/render/material-finishes.ts)). The library must build a fresh physical material.
3. **Fail loudly on unknown names.** An unknown glass name should fail a unit test beside the manifest-hash checks in [catalog.test.ts](../../../../packages/glass-game/src/render/catalog.test.ts), not render silently.

The line between vessel and look runs through the thickness map. KHR_materials_volume gives thickness "in the coordinate space of the mesh" and bakes it "similar to ambient occlusion". Attenuation colour and distance describe the medium itself ([KHR_materials_volume](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_volume/README.md)). So the vessel GLB carries geometry, UVs, a thickness map and look-named slots. The look carries IOR, attenuation, roughness, sheen, iridescence, translucency and its studio environment. That shrinks a known exporter trap to one map per vessel: Blender drops volume and thickness maps unless a `glTF Material Output` group is built ([lessons.md](../../../../.claude/skills/blender-modeler/references/lessons.md)).

The material should be one owned `GlassMaterial` that extends `MeshPhysicalMaterial`. It replaces `transmission_pars_fragment` and `transmission_fragment` through `onBeforeCompile`, the route drei's MeshTransmissionMaterial takes ([MeshTransmissionMaterial.tsx](https://github.com/pmndrs/drei/blob/master/src/core/MeshTransmissionMaterial.tsx)):

- **Paths and cache key.** Recipe defines select its paths: screen transmission, studio refraction, translucency and dispersion. `customProgramCacheKey()` must return those flags and the tier. The default key is `onBeforeCompile.toString()`, which would fold every recipe that shares a closure into one program ([Material.js r185](https://github.com/mrdoob/three.js/blob/r185/src/materials/Material.js)).
- **Version pinning.** Chunk injection breaks across releases: r182 renamed the fields the transmission chunk reads ([three@0.182.0 transmission_fragment](https://cdn.jsdelivr.net/npm/three@0.182.0/src/renderers/shaders/ShaderChunk/transmission_fragment.glsl.js)). So pin `three` and compile every recipe and tier in CI. The runner's floor shell already follows this pattern by throwing when its patched chunk changes ([runner-clear-transmission.ts:10-38](../../../../packages/glass-game/src/render/runner-clear-transmission.ts)).
- **Alternatives rejected.** drei's MeshTransmissionMaterial can see other glass, but it pays one extra scene render per instance, so it suits at most a single hero piece ([drei docs](https://drei.docs.pmnd.rs/shaders/mesh-transmission-material)). three-custom-shader-material adds a dependency without removing the fragile step, since swapping the sample source still needs chunk replacement ([CSM README](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial)).
- **WebGPURenderer is no shortcut.** GLSL injection does not carry over, `MaterialXLoader` works only there, and its WebGL 2 fallback is a separate backend ([WebGPURenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/webgpu/WebGPURenderer.js); [MaterialXLoader docs](https://threejs.org/docs/pages/MaterialXLoader.html)). Writing the glass maths as plain functions keeps a later TSL port mechanical.

The mode that matters most is **studio-environment refraction**. With `transmission = 0` an object leaves the transmissive list and triggers no pass ([WebGLRenderLists.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/webgl/WebGLRenderLists.js)). A custom lookup then refracts the view ray into the material's own PMREM environment with `textureCubeUV(envMap, direction, roughness)`, the call r185 already uses for reflections ([envmap_physical_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/envmap_physical_pars_fragment.glsl.js)). Three things follow:

- the wall can never show through;
- frost stays bright, because PMREM mips are pre-convolved radiance rather than a local average of a dark room;
- the read is identical at every tier and resolution.

Two energy terms then cover r185's missing light transmission. A thickness-weighted emissive makes thick bases glow while rims stay reflective. A translucency term from the exhibit spotlight is modelled on three's own `SubsurfaceScatteringShader`, which adds a back-lit lobe, `pow(saturate(dot(V, −normalize(L + N·distortion))), power)`, per light ([SubsurfaceScatteringShader.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/shaders/SubsurfaceScatteringShader.js)). The cost is that room objects no longer refract through luminous glass. High tiers can blend a small weight of screen transmission back in.

Each family then takes the technique its optics demand:

- **Opal.** Real opalescent glass looks blue in scattered side light and yellowish-red in transmitted light ([Wikipedia: Opalescence](https://en.wikipedia.org/wiki/Opalescence)). Thin Bullseye opaline transmits yellowish light, and thick pieces go almost orange ([Warm Glass](https://www.warm-glass.co.uk/products/bullseye-sheet-glass-2mm-opaline-striker-0403-50)). glTF's `KHR_materials_diffuse_transmission` is only a Release Candidate, and r185's GLTFLoader does not load it ([KHR_materials_diffuse_transmission](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_diffuse_transmission/README.md); [GLTFLoader.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/GLTFLoader.js)). So opal must be emulated in the shader.
- **Amber.** Use a white base with amber `attenuationColor`, never both tints. Base colour and attenuation multiply, so the tint squares into mud.
- **Frosted.** Drop the glossy coat over etched areas. The skill's lesson of roughness 0.4 under a 0.5 coat ([lessons.md](../../../../.claude/skills/blender-modeler/references/lessons.md)) reads as lacquer. r185's clearcoat also multiplies the layer beneath by (1 − clearcoat × Fresnel), which darkens grazing angles further ([meshphysical.glsl.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderLib/meshphysical.glsl.js)).
- **Cut crystal.** It needs internal reflections that three does not model, so it gets a sparkle studio of small hot cards plus faceted normals. `dispersion` is reserved for High, because it triples the 8-tap lookup to 24 ([transmission_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)).

| Look                        | Balanced (phones)                                                                                                                      | High (desktop)                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Clear and champagne crystal | Screen transmission at 0.5 scale, FrontSide, pale attenuation over a long distance; studio refraction once the governor drops the pass | Screen transmission; DoubleSide only on whole vessels that lack a modelled inner wall; dispersion on cut crystal |
| Amber                       | Warm studio refraction plus thickness-weighted emissive; no pass                                                                       | Adds screen transmission over a bright backdrop or liner                                                         |
| Opal                        | White diffuse base, mint sheen, warm back-light term, iridescence about 0.2–0.4; transmission near 0                                   | Same, plus low-weight studio refraction                                                                          |
| Frosted                     | Studio refraction blurred by roughness; no glossy coat over the etch                                                                   | Same; the read does not depend on resolution                                                                     |
| Shards and chips            | Opaque fake glass from the break                                                                                                       | Vessel's look for the first 100–200 ms of flight, then fake glass                                                |

Today's tiers cannot express any of this. High and Balanced differ only in:

- DPR cap (1.5 against 1.25);
- shadow cadence;
- asset profile;
- bundle concurrency.

The 0.5 transmission scale and the 1024 shadow map are type-level literals shared by both. The governor can only drop DPR to 1 and shadows to every fourth frame ([render-quality.ts:24-48](../../../../packages/glass-game/src/render/render-quality.ts); [render-performance-governor.ts](../../../../packages/glass-game/src/render/render-performance-governor.ts)). Glass needs its own tier setting, and the governor needs a last step that turns screen transmission off. That step removes the pass and its second opaque draw.

The cost structure explains the order. The pass runs once per camera whenever any transmissive object is in the render list, regardless of how many there are, and each transmissive pixel pays 8 texture taps ([WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js)). Clear variants fill 18 of the 26 exhibits, so keeping screen transmission for clear glass on phones keeps the pass alive in nearly every room. The device test must decide whether Balanced starts with it on or off.

DoubleSide adds a back-face draw and two material invalidations per object per frame, but only on devices without `WEBGL_multisampled_render_to_texture` ([three.js #28131](https://github.com/mrdoob/three.js/issues/28131)). DoubleSide glass therefore also _looks_ different across devices. That is one more reason to default closed shells to FrontSide, as the skill's own glass rules require ([materials-glass.md](../../../../.claude/skills/blender-modeler/references/materials-glass.md)). Because GlassMaterial owns the transmission chunk, it should also compute the blur from a resolution-independent footprint, so a rough look approved on desktop holds on a phone. None of this is measured: the game has **no phone frame-rate data** ([mobile follow-up plan](../../../../art/glass-adventure/plans/MOBILE-PERFORMANCE-AND-GUIDANCE-FOLLOWUP-2026-09-24.md)).

Three repo constraints decide where the code lands:

1. **The file-size ratchet.** `size.filesOver800` covers packages, and `glass-renderer.ts` (783 lines), `vessels.ts` (757) and `museum.ts` (678) sit near the limit. The library, the lighting kit and the shard path belong in new modules ([code-metrics.mjs](../../../../scripts/code-metrics.mjs)).
2. **Tests that pin today's values.** These need deliberate updates: exactly two directional lights, the emissive stress behaviour, and render-quality receipts that classify any 1024×1024 off-screen pass as shadow and everything else as transmission ([glass-renderer.test.ts:1134-1141](../../../../packages/glass-game/src/render/glass-renderer.test.ts); [glass-adventure-render-quality.e2e.ts:366-374](../../../../apps/beside-cue/e2e/glass-adventure-render-quality.e2e.ts)).
3. **The mobile texture list.** The mobile profile downsizes colour, normal, emissive, roughness, metalness, AO and transmission maps, but **not** thickness, clearcoat, iridescence or sheen maps. Any library map of those kinds must be added to the list ([asset-texture-profile.ts:6-17](../../../../packages/glass-game/src/render/asset-texture-profile.ts)).

## Amber turns gold only in front of light, never a wall

Photographers treat glass as an object with almost no appearance of its own. A dielectric of IOR 1.5 reflects about 4% face-on ([Khronos PBR Neutral](https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/README.md)), so they light the field behind it:

- **Bright-field:** the background and the object's centre stay bright, and edges read dark.
- **Dark-field:** edges read bright against a dark field ([USPTO 7341369](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7341369)).
- **Strip boxes behind diffusion** turn hard-edged highlights on glossy surfaces into graded ones ([PetaPixel](https://petapixel.com/how-to-create-gradients-of-light-product-photography/)).
- **Cut crystal** sparkles under small, high-luminance sources with beams under 10°, and with diffuse fill reduced ([DIALux](https://community.dialux.com/lighting-knowledge/post/creating-brilliance-in-lighting-design-ud8sfJistmuP1Vj)).

Museums add top light and base glow. The Met's British Galleries build LEDs into glass shelves for a continuous glow under the objects. The Plains Art Museum lit a glass work from inside its pedestal ([Folio](https://folio.it/en/projects/the-metropolitan-museum-of-art-british-gallery-opa/); [Plains Art Museum](https://hub.catalogit.app/plains-art-museum/folder/entry/untitled-243)).

In three.js those tools split in two:

- **Reflections** come from `material.envMap` or `scene.environment`, and a per-material map wins ([Scene.js r185](https://github.com/mrdoob/three.js/blob/r185/src/scenes/Scene.js)).
- **Refraction** comes from the screen copy of opaque objects.

A studio environment therefore fixes highlights and edge reflections, but not what the glass shows through itself. That needs something bright, opaque and actually behind it.

The table below puts numbers on "bright". It was recomputed for this report at the gallery's real exposure of 0.9, using a numpy port of the r185 tone-mapping GLSL ([`tools/tonemap/`](tools/tonemap/)), with these assumptions:

- the amber's attenuation colour is the concept gold #F2A93B;
- transmitted light is 0.96 × backdrop × attenuation^t, where t is path length over attenuation distance;
- Fresnel angle, blur and base tint are ignored.

The sources are [tonemapping_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js) and [KHR_materials_volume](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_volume/README.md).

| Behind the amber (linear radiance)           | t   | ACES at 0.9 (today) | Neutral at 0.9 |
| -------------------------------------------- | --- | ------------------- | -------------- |
| Dark wall, 0.042                             | 1   | #1F0E01             | #311E00        |
| Mid-grey wall, 0.195                         | 1   | #6C400A             | #694501        |
| Wall measured behind the opal in-game, ≈0.38 | 1   | #A06A19             | #906004        |
| White surface lit to 1.0                     | 1   | #DEB048             | #DF9818        |
| Emissive backdrop, 1.45                      | 1   | #ECC764             | **#F3A937**    |
| Light box, 2.0                               | 1   | #F3D67D             | #F8B256        |
| Light box, 2.0                               | 2   | #FAAA35             | #F78443        |

A wall leaves amber brown under either tone mapper. Take the wall the amphora critic measured behind the opal: it reads 173 of 255 in the game, which the same port puts near 0.38 linear. Over it, the concept gold becomes ochre (#A06A19 under ACES), which matches the "butterscotch" the critics kept reporting.

The gold appears only when the backdrop reaches about **1.4–1.5 linear radiance**. That is roughly four times that wall and 35 times a dark one. Neutral at 1.45 reproduces it almost exactly (#F3A937). ACES needs thicker glass to get close (#EDAB36 at 1.4 and 1.5 attenuation lengths) and goes pale straw as the light rises. Two caveats apply. Radiance above 1 survives into the refraction only where the transmission target is half-float. And in-engine renders must confirm the arithmetic.

A walk-around museum then complicates "behind", because the camera moves. Exploration runs at a 48° field of view, and the challenge camera frames Merc and the target from 1.45 to 10 m ([camera-policy.ts:9](../../../../packages/glass-game/src/render/camera-policy.ts); [challenge-camera.ts:84-95](../../../../packages/glass-game/src/render/challenge-camera.ts)). Backdrop cards only work for views the game controls: a niche, a wall-backed exhibit, or the challenge camera's axis. Two forms work from everywhere:

- **An emissive plinth top under the vessel**, following The Met's shelves.
- **An opaque liner inside the cavity**, which is the urn critic's own unbuilt idea, "so the glass refracts a lit interior instead of the room" ([urn LEDGER](../../../../art/glass-adventure/procedural/amber-cadence-urn/LEDGER.md)). That is bright-field moved inside the vessel, and it needs the same ~1.45 radiance to glow.

The rest of the glow has to come from the material's studio refraction and emissive terms. For the same reason, glass intacts should stop casting opaque shadows onto the plinth top that is meant to shine.

The studio environments should be built, not downloaded. r185's `RoomEnvironment` is a box of emissive panels plus a point light, derived from model-viewer's `EnvironmentScene`. `PMREMGenerator.fromScene()` prefilters any such scene and takes a `position` option for capturing at an exhibit ([RoomEnvironment.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/environments/RoomEnvironment.js); [PMREMGenerator.js r185](https://github.com/mrdoob/three.js/blob/r185/src/extras/PMREMGenerator.js)). drei's Lightformer applies the same idea with flat emissive panels ([drei Lightformer](https://drei.docs.pmnd.rs/staging/lightformer)). Three shared studios cover the families:

- **warm bright-field** for amber and opal;
- **cool dark-field** with vertical strips for clear and champagne glass;
- **sparkle**, made of small hot cards, for cut crystal.

Each costs GPU memory once at load, and nothing per pixel beyond the image-based lighting path every material already runs. Assigning them as per-material `envMap` also makes `envMapIntensity` a working control again.

The repo already holds a working precedent in the separate glass3d chamber game. It shares one set of key, glint and back directions between its procedural environment and its three spotlights, so reflections and highlights agree. It also authors that environment at 1024×512, because the PMREM cube size is a quarter of the width ([glass3d environment.ts:67-92](../../../../apps/beside-cue/src/games/glass3d/render/environment.ts); [Chamber3D.ts:151-163](../../../../apps/beside-cue/src/games/glass3d/render/Chamber3D.ts); [glass-3d.md](../../../../apps/beside-cue/docs/games/glass-3d.md)).

Punctual lights add glints and drive the translucency term, but they must not change the light count. three skips any light under an invisible ancestor, and `numSpotLights` is part of the program cache key ([WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js); [WebGLPrograms.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/webgl/WebGLPrograms.js)). Room groups toggle visibility as the player walks ([museum.ts:388-396](../../../../packages/glass-game/src/render/museum.ts)). A spotlight per plinth would therefore recompile programs mid-play and defeat the game's precompile and warm-up.

The dev-only Dark Archive shows the alternative: one resident `SpotLight`, re-aimed at the nearest chamber at an intensity of 18 × weight while the global lights dim ([archive-room.ts:54-83](../../../../packages/glass-game/src/render/archive-room.ts); [glass-renderer.ts:265-273](../../../../packages/glass-game/src/render/glass-renderer.ts)). Generalised, one or two resident, unshadowed spots (a top key and a narrow glint) follow the active exhibit. A shadowed spot would add a 512² shadow pass, which the render-quality receipts would misread as transmission.

RectAreaLight is the wrong tool on phones. It evaluates an area-light integral for every lit PBR fragment and casts no shadows. It also needs an ~80 KB lookup table, against a first-paint JavaScript budget with about 290 KB of headroom (1,159 KB measured against 1,450 KB) ([RectAreaLight docs](https://threejs.org/docs/pages/RectAreaLight.html); [RectAreaLightTexturesLib docs](https://threejs.org/docs/pages/RectAreaLightTexturesLib.html); [assert-first-paint-budgets.mjs](../../../../scripts/assert-first-paint-budgets.mjs)). Softbox shapes belong in the studio environment instead.

### Neutral tone mapping keeps the palette that ACES bends

The display transform is the cheapest fix with the widest reach. The table below was recomputed at exposure 0.9 with the same port, at unit radiance unless stated. Each cell gives the output colour, its hue shift and its chroma change in OKLCh, against the input swatch.

| Swatch                    | ACES (today)          | AgX                  | Neutral              |
| ------------------------- | --------------------- | -------------------- | -------------------- |
| Amber gold #F2A93B        | #E0B34B, +12.3°, −11% | #C69E66, +2.8°, −40% | #E39B19, +1.3°, +3%  |
| Amber gold at 2× radiance | #F4D881, +19.2°, −24% | #DFBD89, +5.0°, −47% | #F9B45A, −1.9°, −10% |
| Orange-amber #FF8C00      | #EA9B20, +12.8°, −14% | #CE9053, +5.3°, −40% | #ED8313, −0.4°, −7%  |
| Opal mint #CDEBDD         | #CCD8D2, chroma −60%  | #B4BEB9, −63%        | #BDDBCD, +1%         |
| Opal lavender #D9CCF0     | #D0CAD9, chroma −57%  | #B7B4C1, −63%        | #C9BCE0, +1%         |
| Champagne #F7E7CE         | #DCD7CC, chroma −59%  | #C3BDB4, −60%        | #E6D6BE, 0%          |

The three tone mappers fail differently:

- **ACES** bends warm glass toward yellow and removes most of the chroma from every pastel, which is the opal's play of colour.
- **AgX** keeps hue but turns amber tan. r185 ships it with the "look" line commented out, so there is no Punchy variant to compensate ([tonemapping_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js)).
- **Khronos PBR Neutral** reproduces in-range base colours exactly for a shiny dielectric under unit white light. It compresses only above about 0.76 linear, and does so without hue shifts ([Khronos PBR Neutral](https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/README.md)). model-viewer made it the default in v4.0.0 "for improved color accuracy" ([model-viewer v4.0.0](https://github.com/google/model-viewer/releases/tag/v4.0.0)).

The switch is renderer-wide, so it re-grades every room material and needs exposure and lights re-balanced. That makes it an owner decision, not a glass tweak. Neutral's own failure mode argues for keeping the amber glow near 1–1.5: very bright saturated amber drifts toward salmon (−5° for orange-amber at 2× radiance).

The opal ledger suggests a second rule. Keep key and fill light near neutral, and let the warmth come from the glass. The "room's light" that turned near-white opal cyan is, in these galleries, a sky-blue hemisphere (`0xcceaff`), a teal rim (`0x73ddd9`) and a probe of the same room.

Bloom stays off until measured headroom allows it, as the existing plan says ([FLOATING-MUSEUM-LIVE.md](../../../../art/glass-adventure/plans/FLOATING-MUSEUM-LIVE.md)). If it comes, use a threshold of at least 1.0 through r185's new `setEffects` with a half-float output buffer. That avoids the second scene render in the official selective-bloom example ([WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js); [selective bloom example](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_postprocessing_unreal_bloom_selective.html)).

Room reflections and baking can wait:

- **Per-room capture.** A capture on room entry could replace the single spawn probe, at six scene renders per capture ([CubeCamera.js r185](https://github.com/mrdoob/three.js/blob/r185/src/cameras/CubeCamera.js)).
- **Box projection.** It exists in r185 only in the node path, so WebGL would need a shader patch ([getParallaxCorrectNormal.js r185](https://github.com/mrdoob/three.js/blob/r185/src/nodes/functions/material/getParallaxCorrectNormal.js)). Once glass uses its family studios, it no longer depends on the probe.
- **Baked room light.** It would make the transmission pass's second opaque draw cheaper. But glTF carries no lightmaps, no runtime GLB ships an occlusion texture today, and glass itself cannot be baked ([three.js forum](https://discourse.threejs.org/t/question-about-pbr-and-lightmap/18909)). That makes baking a later project.

## Shards should break like glass and stop rendering as whole vessels

The museum's fracture architecture is sound:

- **Trigger and shards.** A completed voice judge triggers the break. Authored shard nodes (at most 48, and 16–18 on the v6 vessels) are flattened and centred. A nearest-seed runtime split of at most 24 pieces exists only as a fallback ([exhibit-asset.ts:23-64](../../../../packages/glass-game/src/render/exhibit-asset.ts); [fracture.ts:13-97](../../../../packages/glass-game/src/render/fracture.ts)).
- **Motion.** It is scripted and seeded, with no physics: profile-specific outward and upward velocities, 3.1 rad/s spin and a 1.7t² drop ([shatter-motion.ts:146-206](../../../../packages/glass-game/src/render/shatter-motion.ts)).
- **Timing.** A 0.1 s anticipation precedes 2.2 s of visible flight, which fades from 1.45 s. Playback speed defaults to 0.5, so a break lasts 4.6 s ([shatter-presentation.ts:3-33](../../../../packages/glass-game/src/core/shatter-presentation.ts)).
- **Presentation.** Crack lines, a tremor and the stress glow lead in. Three instanced chip meshes, additive glints and a floor ring cover the swap. Fourteen recorded takes in five families supply the sound ([shatter-burst.ts](../../../../packages/glass-game/src/render/shatter-burst.ts); [shatter-sounds.ts:27-42](../../../../packages/glass-game/src/content/shatter-sounds.ts)).

That is the industry pattern Control uses: a stored broken version, swapped in and covered by material-specific particles ([GMTK](https://gmtk.substack.com/p/how-games-do-destruction)).

It should stay pre-authored and scripted. Runtime fracture fits hollow vessels badly:

- ConvexObjectBreaker requires convex input ([ConvexObjectBreaker.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/misc/ConvexObjectBreaker.js)).
- three-pinata needs manifold input and returns more fragments than requested on non-convex meshes. That breaks the catalog's exact shard-count contract ([three-pinata](https://github.com/dgreenheck/three-pinata)).
- Both put CPU work on the break frame.

If shards must ever strike room geometry or each other, Rapier is the maintained, deterministic option, at version 0.21.0 ([npm](https://registry.npmjs.org/@dimforge/rapier3d-compat)). It should be used directly, with:

- convex hulls through `convexMesh`;
- collision groups that skip shard pairs;
- soft CCD over thin plinth tops;
- a fixed 1/60 s step.

The relevant docs are [Rapier colliders](https://rapier.rs/docs/user_guides/javascript/colliders), [Rapier rigid bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies) and [Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism). three's `RapierPhysics.js` helper is unsuitable: it has no convex hulls, uses a variable timestep and pins Rapier 0.17.3 ([RapierPhysics.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/physics/RapierPhysics.js)). The lockfile's Rapier 0.12.0 arrives only as a dependency of `@types/three`; no package uses a physics engine today ([pnpm-lock.yaml](../../../../pnpm-lock.yaml)). No browser benchmark of 50–100 convex bodies on a phone was found, so physics stays out until one exists.

The authored break pattern is where the read is weakest. `bkit.fracture` picks seeds by farthest-point sampling over 3,000 area-weighted surface samples, which spreads cells evenly ([fracture.py](../../../../.claude/skills/blender-modeler/scripts/bkit/fracture.py)). On a 0.6 m urn about 0.35 m across, 17 even cells are plates of roughly 20 × 20 cm, which read as pottery or tile. Glass does the opposite:

- Houdini's Glass mode cuts radial cracks outward from impact points and concentric rings around them, with controls for radial count, ring spacing and impact spread ([SideFX RBD Material Fracture](https://www.sidefx.com/docs/houdini/nodes/sop/rbdmaterialfracture.html)).
- Real annealed glass breaks into large, sharp, irregular shards ([Cardinal Glass](https://cardinalcorp.com/glossary/annealed-glass)), with radial cracks running out from the origin and concentric cracks circling it ([Forensic glass analysis](https://en.wikipedia.org/wiki/Forensic_glass_analysis)).

Within a 16–18 shard budget, that suggests:

- 8–10 small radial wedges within a third of the girth around an impact pole;
- 4–5 medium pieces mid-wall;
- 2–4 large pieces at the far wall, lip, neck and foot.

bkit can get there by weighting the farthest-point distance with a target size that grows away from the pole, and by adding 4–6 radial bisect planes through the impact axis. A heavy foot surviving whole is realistic for glass, but it breaks the recipe's rule that no shard should hold most of the vessel ([recipes/fracture.md](../../../../.claude/skills/blender-modeler/references/recipes/fracture.md)), so the owner must choose. A singing break has no physical impact point. The pole can be authored on the vessel's front and aimed with the facing logic that `faceAnchor` recipes already use toward the listening anchor ([vessels.ts:136-147](../../../../packages/glass-game/src/render/vessels.ts)). Symmetric vessels need one shard set; two-handled amphorae need two.

Cut faces should look like glass seen edge-on. Edge-on glass is strongly tinted by its long optical path ([Lehigh glass lecture](https://www.lehigh.edu/imi/teched/GlassProcess/Lectures/Lecture04_Shelby_ColoredGlass.pdf)). It is also smooth near the origin, where fracture surfaces show a "mirror" zone before roughening into mist and hackle ([ASTM C1678](https://store.astm.org/c1678-21r26.html)). So `glass_cut` and `cavity_surface` should be glossy (roughness about 0.03–0.12), and more saturated than the shell through a shorter attenuation distance. Today the procedural amphora's `glass_cut` sits at roughness 0.25 ([opaline build.py](../../../../art/glass-adventure/procedural/opaline-echo-amphora/build.py)), and the v3 cut material at 0.14 ([adventure-v3 GLBs](../../../../apps/beside-cue/public/games/adventure-v3/)). Per family:

- frosted pieces should cut clearer than their surface;
- opal stays milky through;
- amber cuts deep;
- stone trims keep rough matte faces, whose contrast helps the glass read.

A matte cut face is the strongest single cue toward stone or plaster. That is why the cut belongs to the look library rather than to each vessel.

Rendering is where the museum spends the most for the least visual return. Except on picture-bearing portraits, shards reuse the intact vessel's own authored materials. On every Meshy glass vessel, each shard is therefore a separate DoubleSide transmissive mesh ([vessels.ts:422-435](../../../../packages/glass-game/src/render/vessels.ts)). On devices without `WEBGL_multisampled_render_to_texture`, that costs a back-face draw and two material invalidations per shard per frame, for up to 48 shards ([WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js)). The chips are transmissive as well ([shatter-burst.ts:39-50](../../../../packages/glass-game/src/render/shatter-burst.ts)). The repo's own design guidance already says "Never make shards `DoubleSide` transmissive" and "Swap every shard to a cheap material at the moment of the shatter" ([glass-3d.md §5.3](../../../../apps/beside-cue/docs/games/glass-3d.md)).

One nuance limits the payoff. The pass runs once per camera while any transmissive object is in the render list. In a room with other intact glass it keeps running, so the swap saves pixel shading, back-face draws and invalidations, not the pass itself.

The sequence that avoids a pop:

1. On High, hold the vessel's look for the first 100–200 ms of flight, while speed and the chip burst hide the change. Balanced can switch at the break.
2. Switch to an opaque fake-glass `shard` look: transmission 0, studio reflections, faceted normals and a faint emissive edge. It writes depth and needs no sorting.

`authoredMaterialSelection` already separates intact from shard materials. The shard programs must join the existing precompile and warm-up, or the swap will link a shader on the break frame ([glass-renderer.ts:465-486](../../../../packages/glass-game/src/render/glass-renderer.ts)).

Batching and debris come next. `BatchedMesh` draws many geometries with one material in one multi-draw call, with per-instance culling and colour ([BatchedMesh.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/src/objects/BatchedMesh.js)). `WEBGL_multi_draw` reaches 92.76% of WebGL 2 clients, 96.36% on Android and 99.99% on iOS; Firefox (1.12%) falls back to a loop of ordinary draws ([Web3D Survey](https://web3dsurvey.com/webgl2/extensions/WEBGL_multi_draw)). Shards carry glass, cut, gold and stone slots. One batch per material family per room, sharing per-instance matrices, keeps a break at 2–4 draws instead of one mesh per shard and slot.

The "many pieces" read should come from debris rather than more shards. Today's chip burst emits 39–72 chips plus 8–14 glints, depending on profile ([shatter-motion.ts:33-41](../../../../packages/glass-game/src/render/shatter-motion.ts)). The debris should:

- grow toward 100–300 tiny splinters on opaque fake glass;
- be emitted along the shard boundaries nearest the pole;
- keep dust minimal, because a puff reads as stone;
- flash 1–3-frame star glints on a few spinning facets.

Pieces that leave should shrink rather than alpha-fade, as the scripted path already does, which avoids transparency sorting.

Sound needs one addition. Naughty Dog layered the glass in The Last of Us Part II as strike, crack, thump and debris tail, and called the debris layer the most important ([GameSpot](https://www.gamespot.com/articles/the-last-of-us-part-2-sound-designer-explains-how-/1100-6479127/)). The museum's single takes would gain a randomised tinkle layer timed to the scripted flight.

## Three gates let one approved look carry every later vessel

The process stalls because each review moves three variables at once. The painted concepts mix shape, material and light. Tuning a vessel's glass to match a painting bakes lighting compensation into that vessel, and the next room undoes it. Look-development pipelines prevent this in two ways ([CAVE wiki](https://caveacademy.com/wiki/post-production-assets/assets-general/framing-your-asset-for-turntables/); [CAVE rig 1003](https://caveacademy.com/?p=78400)):

- They lock the camera and light rig early and have every department use the same dataset, so a reviewer "is only comparing the changes made to the asset from one version to the next".
- They approve in stages: neutral grey clay, then generic materials, then the look.

The repo's lessons agree. Glass must be judged in its production render path, with a real backdrop, production exposure and half-resolution transmission ([MISTAKES.md:1773](../../../../docs/agent/MISTAKES.md)). The skill's `three_preview.mjs` lacks the probe capture and the emissive override, so it cannot stand in for the game ([three_preview.mjs](../../../../.claude/skills/blender-modeler/scripts/three_preview.mjs)).

| Gate       | What it judges                                           | Evidence                                                                                                         | Who passes it                                |
| ---------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| G0 Shape   | Silhouette, proportions, closure, budgets, node contract | Clay renders in the locked rig; silhouette IoU against a clay reference                                          | Every vessel                                 |
| G1 Look    | One glass look, independent of any vessel                | Swatch set under four environments plus one hero vessel; region colour metrics and FLIP against approved goldens | Once per look; any library change reopens it |
| G2 Context | A vessel wearing its approved look, in its room          | `runtime_proof.mjs` shots at fixed checkpoints in the real render path, with the served asset tier asserted      | Every vessel                                 |

Shape references must never contain glass:

- 3DReflecNet found that reconstruction degrades severely on transparent and metallic materials, with Hausdorff distance "exploding" as geometry goes missing ([3DReflecNet](https://arxiv.org/pdf/2605.10204)).
- Image-to-3D pipelines remove backgrounds before shape conditioning, so any matte error inside a glass object carries into the mesh ([Hunyuan3D 2.0](https://arxiv.org/html/2501.12202)).
- Neither OpenAI nor Google documents orthographic or clay prompting. OpenAI warns that its model "may have difficulty placing elements precisely in structured or layout-sensitive compositions" ([OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation?api=image); [Gemini image docs](https://ai.google.dev/gemini-api/docs/image-generation)).

The dependable recipe is one opaque, matte mid-grey clay view per image: an orthographic side elevation at mid-height, on flat light grey, with shadowless light. Each image is then checked numerically:

- left-right symmetry;
- straight rim and foot lines;
- a vertical axis;
- no shadow pixels.

Most vessels are surfaces of revolution, so that one profile, revolved in bkit, defines the body. Extra views are needed only for handles, spouts and pinched lips. Make them by editing from the first view with "change only" constraints, as OpenAI's prompting guide advises ([OpenAI Cookbook](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)).

An image-to-3D blockout should be requested as geometry only: Meshy's `should_texture:false`, Tripo's `texture:false`, or Rodin's `material: None`. Never use Rodin's `Shaded`, which bakes lighting. Record the vendor, model version, seed and input hashes in the manifest ([Meshy](https://docs.meshy.ai/api/multi-image-to-3d.md); [Tripo](https://developers.tripo3d.com/en/docs/generation-multiview-to-model/p.md); [EmpirioLabs](https://docs.empiriolabs.ai/models/hyper3d-gen2)). The skill's silhouette gate should then measure against the clay reference rather than the painted concept, which takes material and light out of G0.

Each look gets a material card instead of a painting. The card has three parts:

- **three to six real photographs**, ideally paired backlit and front-lit shots, as glass sellers present sheet glass ([Warm Glass](https://warm-glass.co.uk/products/bullseye-sheet-glass-3mm-white-opal-0113-30));
- **a short parameter spec**: IOR about 1.5, attenuation colour and distance, roughness, and scattering notes;
- **the approved engine renders**, which become the goldens.

The look-dev scene should be a dev-only route in the game build that runs the real `GlassMaterial` and renderer ([RoomEnvironment.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/environments/RoomEnvironment.js); [ColorEnvironment.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/environments/ColorEnvironment.js)). It contains:

- **Canvas:** a fixed 1024×1024 canvas at pixel ratio 1.
- **Cameras:** an orthographic elevation, a fixed three-quarter view, and eight turntable stills at 45°.
- **Environments:** `RoomEnvironment`; a uniform grey `ColorEnvironment` as a furnace-style energy check; two contrasting CC0 HDRIs; and the game's exhibit rig.
- **References:** a chrome sphere, a 0.18 grey sphere, and a ColorChecker in unlit and lit copies.
- **Backdrop:** a checker or stripe backdrop behind every swatch.
- **Swatches:** a sphere, a thick-walled tumbler and a stepped thickness wedge.
- **Tone mapping:** `NeutralToneMapping` throughout.

A look passes G1 only if it reads as its target under all four environments with no per-environment edits. A look that matches under only one environment is compensating for that lighting.

Checks should separate approval from regression:

- **Approval** reads pixels from a render target over fixed regions:
  - transmitted colour through each wedge step against the Beer–Lambert prediction, as CIEDE2000 (culori implements it after Sharma);
  - checker contrast through frosted glass;
  - mean FLIP against the approved golden. Refraction amplifies sub-pixel shifts into noisy per-pixel diffs, which FLIP tolerates better ([culori](https://culorijs.org/api/); [NVIDIA FLIP](https://research.nvidia.com/publication/flip)).
- **Regression** after approval uses Playwright's `toHaveScreenshot` on the canvas with per-platform baselines ([Playwright](https://playwright.dev/docs/test-snapshots)). The repo has no visual baselines today, only screenshots attached for human review. three.js's own suite shows the discipline: software rendering, injected determinism, at most 0.1% differing pixels and committed goldens ([three.js e2e](https://github.com/mrdoob/three.js/blob/dev/test/e2e/puppeteer.js)).

One local hazard matters. SwiftShader, which `runtime_proof.mjs` launches ([runtime_proof.mjs](../../../../.claude/skills/blender-modeler/scripts/runtime_proof.mjs)), stalls on transmission targets ([MISTAKES.md:1975-1979](../../../../docs/agent/MISTAKES.md)). The golden runner needs a software backend proven on this path. Phones get frame-time and sanity checks, never pixel diffs.

For choosing between candidates, `KHR_materials_variants` packs two to four looks into one review GLB that the owner can flip in the look-dev scene. r185's GLTFLoader supports it only through an external plugin, so use the official example's loading pattern ([KHR_materials_variants](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_variants/README.md); [webgl_loader_gltf_variants](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_loader_gltf_variants.html)).

### Amber goes first, after fixes that need no new asset

Amber should be the first look through G1, for three reasons:

- The urn is already built and blocked only on its glass.
- Amber has a numeric target in the concept gold, and a crisp test in the stepped wedge.
- Amber forces the rig decisions that every later look must live inside: tone mapper, exposure, backdrop or liner radiance, and studio environments.

Approving clear glass first, under today's ACES and plain walls, would only reopen it when the rig changes. Clear crystal should follow immediately, since its five variants fill 18 of the 26 exhibits. Opal comes last, because it needs the new translucency term.

The order of work front-loads changes that need no new asset:

1. Stop the stress override from clobbering authored emissive.
2. Give glass per-material studio environments.
3. Stop glass from casting opaque shadows.
4. Move shards and chips to fake glass.
5. Prototype Neutral in the look-dev scene.

Then measure one room on a mid-range Android phone and an iPhone: three intact vessels and one breaking, transmission scale 1.0 against 0.5, and each shard option. Record whether each device exposes `EXT_color_buffer_half_float` and `WEBGL_multisampled_render_to_texture`, because both change the look and not just the speed. Only then should the next vessel enter G0.

## Conclusion

The research moves the problem out of the vessels. Every symptom the critic loops chased traces to what surrounds the glass and to the display transform: brown amber, caramel frost, opal darker than its wall, cyan whites. The urn's two passes of material tuning that "did not move it" are the evidence. The procedural rebuilds were tuning per-vessel materials, which cannot add the light that is missing. The useful corollary is that the highest-leverage changes are configuration, not assets, and they reach all 26 exhibits at once.

A second convergence is less obvious. In a walk-around museum, the only bright-field that works from every viewpoint is light the glass carries itself: studio refraction, emissive and translucency, or an emissive liner inside it. That is also the path that skips the transmission pass on phones. For amber, opal and frosted glass, the look that reads best and the look that costs least are the same one, which leaves screen transmission as a deliberate premium for clear crystal on capable devices.

Separating shape from look is less a process rule than a data boundary. Geometry, UVs and thickness maps belong to the vessel; everything about the medium and its light belongs to the library. Once naming and tests enforce that boundary, a vessel can no longer smuggle in its own look, and approving the first look also freezes the lighting rig for everything after it. The open risks can each be settled by one measurement or decision rather than another modelling round:

- phone frame times;
- device coverage of half-float targets and multisampled render-to-texture;
- whether the owner accepts a renderer-wide move to Neutral.
