# Lighting and presenting glass exhibits: studio photography, museums, and a real-time three.js r185 WebGL2 game

Scope note for the report writer. Every claim about three.js internals below was checked against the three.js **0.185.1** package installed in the repo (`node_modules/.pnpm/three@0.185.1/node_modules/three`). GitHub links point to the matching `r185` files. Two sets of numbers were **computed for this note**: a tone-mapper colour table and an amber-over-backdrop table. Both come from a numpy port of the r185 GLSL (`tonemapping_pars_fragment.glsl.js`), with hue and chroma measured in OKLCh. The scripts are in `tools/tonemap/`.

Game context, from the repo: every glass renderer sets `renderer.toneMapping = ACESFilmicToneMapping` with `toneMappingExposure = 1.2`, and `Renderer3D.ts` uses 1.25. Files: `apps/beside-cue/src/games/glass3d/render/Renderer3D.ts:84-85`, `Hallway3D.ts:81-82`, `Chamber3D.ts:128-129`, `Line3D.ts:97-98`, `Shelf3D.ts:246-247`. `Renderer3D.ts:109` uses a hand-built PMREM environment rather than `RoomEnvironment`.

---

## Q1. How do product photographers and museums light glass, and why does glass look dull or show its background under flat ambient light?

### Takeaway

Glass has almost no appearance of its own. Face-on it reflects only about 4%, so the other roughly 96% you see is whatever lies behind it. Photographers and museums therefore light **the background and the edges**, not the object:

- **Bright-field:** a bright, often graded backdrop, or a light box shining through the glass, shows the glass as dark edge lines and makes coloured glass glow.
- **Dark-field:** a dark backdrop with strip lights behind and to the sides draws the glass as bright rims.
- **Cut crystal** needs small, high-luminance point sources and little diffuse fill to sparkle.
- **Opalescent glass** looks blue in scattered side light and amber in transmitted light.

Flat, even, horizontal ambient light gives none of these contrasts. The glass reads as a dim, background-coloured window. That matches the in-game symptoms.

### Cited Findings

**Bright-field vs dark-field: definitions and setups**

- In **bright-field**, the field (background and the centre of a refractive object) stays bright and the object's **edges appear dark**. In **dark-field** the edges appear **bright** while the background and the object's centre stay dark. — [USPTO patent 7341369, "Isotropic illumination"](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7341369) (older patent; cited for the definition only).
- The standard photographic text, _Light: Science & Magic_, gives glass its own chapter, "The Case of the Disappearing Glass". Its sections are "Two Attractive Opposites" (Bright-Field Lighting, Dark-Field Lighting), "The Best of Both Worlds", and finishing touches (defining the surface of glassware, illuminating the background, minimizing the horizon, liquids in glass). "Finding the Family of Angles" sits in the chapter on metal. — [O'Reilly listing, 5th ed.](https://oreilly.com/library/view/light-science/9780415719414); [British Library record, 2021 ed.](https://eld.bl.uk/catalog/020274388). Only the table of contents was available, not the text.
- Dark-field glass setup: a light behind the glass, a black card or gobo blocking direct light through it, and white reflectors at the front and sides. The reflectors put light on the edges while the card keeps the body dark, giving glowing edges on black. — [DIYPhotography, "Crossing Over To The Dark (Field)"](https://www.diyphotography.net/?p=819); [UniquePhoto Q&A on dark-field](https://www.uniquephoto.com/community/qa/what-is-dark-field-lighting-and-how-do-you-use-it-for-photographing-glass). Search-snippet level only: the full pages were truncated or blocked, and the UniquePhoto Q&A is auto-generated and marked "verify before relying on it".
- Edge definition for clear glass in e-commerce: a white background inside the frame with black material just outside it gives **dark edge lines**. The reverse, a dark background with white cards off-frame, gives **bright rims**. — [UniquePhoto Q&A, clear glass for e-commerce](https://www.uniquephoto.com/community/qa/how-should-i-light-clear-glass-products-for-ecommerce-photos). Auto-generated page; treat it as a pointer.
- Strip boxes placed **behind** glassware and facing inward create stark highlights that reveal its shape, and a single strip box can light one edge. — [PetaPixel, clean glassware on black with speedlights (2021)](https://petapixel.com/2021/10/29/how-to-shoot-clean-glassware-with-speedlights-on-a-black-background). Search snippet only; the page returned 403.

**Gradients and strip softboxes**

- Glossy surfaces reflect even soft sources as **hard-edged shapes**, so a bare strip box makes a crisp highlight on a bottle. The usual fix is a sheet of translucent diffusion between strip box and subject, with the light angled to produce a **linear fade**. Diffusion density controls how steep the fade is. — [PetaPixel, How to Create Gradients of Light for Product Photography](https://petapixel.com/how-to-create-gradients-of-light-product-photography/). The page is undated.
- A similar stripbox-through-diffusion gradient, with the strip nearly perpendicular to the diffusion panel, is used on glossy cosmetics packaging. — [PetaPixel (2018)](https://petapixel.com/2018/10/29/how-to-shoot-and-retouch-a-dynamic-cosmetics-ad-in-photoshop/) (older).
- Smooth gradients and edge lines are the core vocabulary of beverage and glass photography courses. — [ProEdu, Smooth Gradients and Edge Lines in Beverage Photography](https://proedu.com/blogs/news/creating-smooth-gradients-and-edge-lines).
- Commercial HDRI packs exist made of "handcrafted virtual studio lighting sets mainly aimed for transparent materials". — [Superhive, OpenEXR Studio Lighting Pack 2](https://superhivemarket.com/products/openexr-studio-lighting-pack2).

**Sparkle for cut crystal: point sources vs diffuse light**

- Brilliance comes from small, **high-luminance** sources striking faceted or reflective surfaces. It is strongest when **diffuse lighting is reduced**. Recommended are very narrow spotlights, **below 10° beam angle**, and perceived brightness depends on the source's **luminance, not its wattage**. — [DIALux community, "Creating brilliance in lighting design"](https://community.dialux.com/lighting-knowledge/post/creating-brilliance-in-lighting-design-ud8sfJistmuP1Vj).
- Diffusers give softer but "rather flat-looking, low-contrast" images. Practitioners use a large diffuse surround for fill and then add point lights to bring the highlights back. — [Cambridge in Colour forum](https://cambridgeincolour.com/forums/thread29824.htm).
- A light-box patent for photography mounts point LEDs flush with a diffuser specifically to make cut stones sparkle, giving "direct point illumination" on top of the diffuse field. — [USPTO 12253791, Light box for photography and videography](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12253791). Attribution is from the search snippet.

**Museums**

- **Corning Museum of Glass, Contemporary Art + Design Wing** (Thomas Phifer and Partners, with daylight work by Arup; Architectural Record, 16 May 2015, older source):
  - Light enters from above through a serrated skylit roof. Deep precast concrete joists, 4 ft deep and 3 ft 2½ in apart, modulate it.
  - Average light is **200–300 footcandles** (≈2,150–3,230 lux) with fixed electric light added, and up to **500 fc** (≈5,400 lux) on sunny days. Painting galleries are typically about **30 fc** (≈320 lux).
  - Phifer: "glass art is not harmed by daylight". He notes that **horizontal light on a glass plane makes it look dark**, while daylight from above "brings it to life".
  - The curator says earlier glass galleries were kept darker. Colourful objects stand out against a muted background.
  - Source: [Architectural Record](https://www.architecturalrecord.com/articles/7528-corning-museum-of-glass-contemporary-art-design-wing). The lux conversions are mine (1 fc = 10.764 lux).
- Other coverage gives up to **425 fc** on sunny days, and says most days need no artificial light and that top light reduces shadows on pieces on pedestals or the floor. Sources disagree on peak values (425 vs 500 fc). — [The Architect's Newspaper (2014)](https://www.archpaper.com/2014/05/corning-museum-of-glass-expansion-2/); [Dezeen (2015)](https://www.dezeen.com/2015/03/18/thomas-phifer-reflective-white-wing-corning-museum-of-glass-new-york/amp/).
- **The Met, British Galleries** (Folio lighting): linear LEDs are built **into the glass shelves** for a soft, continuous base glow that "supports the objects without competing with them". — [Folio project page](https://folio.it/en/projects/the-metropolitan-museum-of-art-british-gallery-opa/).
- **Plains Art Museum**: a small glass work by John Macpherson was "placed on a custom pedestal that was **lit from the bottom**". — [Plains Art Museum collection record](https://hub.catalogit.app/plains-art-museum/folder/entry/untitled-243).
- Glass-art base lighting options include LED pucks for small pieces, fibre optics, and LED strips. — [Norden, light base for glass art](https://norden.adact.me/post/light-base-for-glass-art) (vendor blog).
- Showcase practice:
  - Small LED spots inside the case pick out objects. Sensitive objects may be lit only from outside the case. The case glass itself should stay nearly invisible. — [XAL, showcase lighting](https://xal.com/en/showcase-lighting-shop-museum) (vendor).
  - Base-mounted LED spots for vitrines exist as a product category. — [Shine Lighting](https://www.shine.lighting/media/base-mounted-led-showcase-spotlight-for-glass-display-cabinets-museum-vitrines-archival-enclosures-and-horizontal-exhibit-trays.7258/) (vendor).
  - Wall-lamp spill onto bases causes glare, which adjustable zoom optics fix. — [Degree Furniture](https://www.degreefurniture.com/a-news-how-to-deal-with-the-light-brightness-of-museum-showcases.html) (vendor, low quality).

**Opalescent glass optics** (relevant to the opaline look)

- Rayleigh scattering by fine particles makes a transparent material look **yellowish-red in transmitted white light** and **blue in light scattered at right angles**. — [Wikipedia, Opalescence](https://en.wikipedia.org/wiki/Opalescence).
- Opalescent glass viewed at right angles to the light looks translucent-to-opaque and **blue**. Viewed looking toward the light it looks more transparent and **orange or amber**. Industrial opalescence comes from added opacifiers such as fluorides, phosphates and borates. — [Steuben Glass Association, "Scattering Light – Tyndall Effect"](https://steubenglass.org/gazelle-gazette/scattering-light-tyndall-effect/) (hobbyist society); [Wikipedia, Opalescence](https://en.wikipedia.org/wiki/Opalescence).

**Why glass looks dull or shows its background**

- A common dielectric with IOR 1.5 reflects only **0.04** at normal incidence. Khronos builds this "F90 = 0.04" into PBR Neutral. — [Khronos PBR Neutral README](https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/README.md).
- In three.js r185 the physical shader **replaces** the diffuse lobe with the transmitted background in proportion to `transmission`: `totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );`. Specular and emissive light are added afterwards. — [three.js r185 transmission_fragment.glsl.js](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_fragment.glsl.js); [meshphysical.glsl.js](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderLib/meshphysical.glsl.js).

### Inferences

- **The brown band is physically correct, not a bug.** In the computed table in Q2, amber glass in front of a dark wall gives near-black brown under every tone mapper. Photographers never show amber that way: they put a bright field behind it. The concept painting's "lit from inside" gold is how bright-field backlit amber looks.
- **Frosted amber turns caramel** because roughness blurs the transmission sample over a wide patch of dim, neutral wall. A photographer would put frosted glass in front of a light box, a bright diffuse field, where it glows.
- **The opal reads darker than the wall** because, at high `transmission`, the three.js shader shows mostly the attenuated wall behind it and very little of its own white diffuse body. Real opaline is a scatterer, bright in front or side light and warm when backlit. The fix is part lighting and part material:
  - Give it a side key light for the cool blue scatter and a backlight or plinth glow for the warm transmitted colour.
  - Lower `transmission` so the diffuse lobe carries the milkiness.
- **Translation of the photographic kit into an exhibit-lighting kit:**
  1. A **bright-field card or niche** behind the coloured and frosted pieces (amber, frosted, opal).
  2. A **dark-field niche plus two vertical strip reflections** behind left and right for clear and champagne crystal.
  3. **Narrow point sources** with low ambient for cut amethyst.
  4. A **top light** for everything, following Corning.
  5. A **glowing plinth top**, following The Met's shelf LEDs and the Plains Art Museum pedestal.
- **Light from above beats horizontal light for glass**, per Phifer. Flat frontal or ambient fill should be reduced near glass, not raised.

### Gaps

- I could not read the full text of the photography tutorials (PetaPixel returned 403; DIYPhotography and Instructables were truncated). The bright-field and dark-field setup details rest on search snippets, so the split of attribution between the DIYPhotography and UniquePhoto pages may be imprecise. _Light: Science & Magic_ was seen only at table-of-contents level.
- I found no authoritative museum standard for displaying glass, such as IES RP-30, CIE 157 or Getty or CCI guidance. The museum evidence is one architecture article and vendor pages.
- I found no source for display-case lighting specific to cut or engraved glass, such as grazing light to reveal etching. The DIALux point-source principle is the closest.

---

## Q2. How do real-time renderers apply this in three.js r185 WebGL2, and what does each technique cost on mobile?

### Takeaway

In three.js, **reflections and refraction come from different places**. Reflections and IBL come from `material.envMap` or `scene.environment`, which can be a studio softbox PMREM made per material. Refraction comes from a **screen-space copy of the opaque scene** rendered from the same camera.

So a studio environment map fixes highlights and edge reflections but **not** what the glass shows through itself. That needs a bright object actually behind the glass: an emissive card, a lit niche or a glowing plinth. The alternative is a custom transmission buffer (drei-style), which costs an extra scene render.

Costs, from cheapest to most expensive:

- emissive cards and baked light pools
- a static per-exhibit PMREM made once
- SH light probes
- spotlights without shadows
- box-projected room probes (a few ALU ops plus a shader patch)
- shadowed spots
- RectAreaLight (per-fragment LTC for every PBR pixel, no shadows)
- CubeCamera captures (6 scene renders each)
- the transmission pass itself (a second render of all opaque objects at full resolution with at least 4x MSAA and a mip chain, every frame)

### Cited Findings

**How r185 transmission works.** Source: [WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js), `renderTransmissionPass`.

- There is one transmission render target per camera, created with `generateMipmaps: true`, `LinearMipmapLinearFilter`, and `samples: Math.max( 4, capabilities.samples )`. The source comment says that is "to avoid feedback loops, the transmission render target requires a resolve, see #26177". The target type is `HalfFloatType` when `EXT_color_buffer_half_float` or `EXT_color_buffer_float` is available, otherwise `UnsignedByteType`.
- Size is the viewport multiplied by `renderer.transmissionResolutionScale`, which defaults to **1.0**.
- In that pass the renderer draws `scene.background`, turns tone mapping **off** (so the buffer is linear and HDR when half-float is available), and renders **all opaque objects**, then builds mipmaps.
- If the `WEBGL_multisampled_render_to_texture` extension is **absent**, it then re-renders the **back faces** of `DoubleSide` transmissive objects into the buffer and rebuilds the mips. The source comment cites #28131. So whether back faces show depends on the device.
- The pass is skipped entirely when `scene.overrideMaterial` is set.
- Transparent or transmissive objects do not appear in other transmissive objects. The pass renders all non-transparent objects first and shades transmissive objects from that. — [three.js forum, "Objects with transmission not showing objects behind" (2023)](https://discourse.threejs.org/t/objects-with-transmission-not-showing-objects-behind/47113). Stacked transmission was called expensive and not implemented — [forum thread (2021, older)](https://discourse.threejs.org/t/transmission-throw-more-than-one-object/29335). The r185 back-face pass partly addresses self-overlap.
- **Per-fragment sampling cost.** `getTransmissionSample` uses `textureBicubic`, which samples two mip levels (floor and ceil LOD) with four `textureLod` taps each. With `dispersion`, `USE_DISPERSION` takes **three** samples, one per channel IOR, `halfSpread = (ior - 1) * 0.025 * dispersion`. — [transmission_pars_fragment.glsl.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js).

**Custom transmission buffer (pmndrs drei `MeshTransmissionMaterial`)**

- Props include `buffer` (a texture of the scene shared between materials), `background` (the buffer scene's background: texture, cube texture or colour), `resolution`, `samples` (default 6), `backside`, `backsideThickness`, `thickness`, `roughness`, `chromaticAberration` (0.03), `anisotropicBlur` (0.1), `distortion`, and `transmissionSampler` (use three's internal buffer).
- It "can still be expensive as it causes an additional render pass of the scene". The docs suggest a tiny buffer, for instance 32×32, for rough glass.
- It can "see" other transmissive and transparent objects. The host mesh is removed from its own render pass.
- Source: [drei docs, MeshTransmissionMaterial](https://drei.docs.pmnd.rs/shaders/mesh-transmission-material).

**Environment maps: per-material override, RoomEnvironment, custom softbox scene, PMREM**

- `Scene.environment` "sets the environment map for all physical materials in the scene. However, it's not possible to overwrite an existing texture assigned to the `envMap` material property." A per-material studio map therefore **wins** over the room environment. — [Scene.js r185](https://github.com/mrdoob/three.js/blob/r185/src/scenes/Scene.js). The game's own code notes the intensity pairing (`material.envMap ? material.envMapIntensity : scene.environmentIntensity`) in `apps/beside-cue/src/games/glass3d/render/merc.ts:50`.
- `PMREMGenerator.fromScene( scene, sigma = 0, near = 0.1, far = 100, { size = 256, position = origin } )` turns any scene into a prefiltered map. The `position` option lets you capture from the exhibit's location. — [PMREMGenerator.js r185](https://github.com/mrdoob/three.js/blob/r185/src/extras/PMREMGenerator.js).
- **`RoomEnvironment` is a softbox studio.** It is a large box room lit by a `PointLight` (intensity 900) plus six emissive box "area lights" with `emissiveIntensity` 50, 50, 17, 43, 20 and 100. The 100 is a ceiling panel. It is based on model-viewer's `EnvironmentScene`. — [RoomEnvironment.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/environments/RoomEnvironment.js).
- r185 also ships **`ColorEnvironment`**, a uniform-colour back-faced sphere for PMREM. It gives flat ambient IBL, which is the "dull glass" case for reflections. — [ColorEnvironment.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/environments/ColorEnvironment.js).
- drei's **`Lightformer`** draws flat shapes that imitate studio light panels: `form` rect, circle or ring, plus `intensity`, `color`, `scale` and `target`. They are meant to sit inside an `<Environment>`, so you can build a softbox HDRI from meshes. — [drei docs, Lightformer](https://drei.docs.pmnd.rs/staging/lightformer). This is React Three Fiber, but the same idea works in vanilla three via emissive meshes plus `fromScene`.

**Local probes and box projection**

- In r185, box or parallax-corrected environment sampling exists **only in the TSL/node path** (`getParallaxCorrectNormal`, for WebGPURenderer). The WebGLRenderer GLSL chunks have nothing equivalent, so WebGL needs an `onBeforeCompile` patch. — [getParallaxCorrectNormal.js r185](https://github.com/mrdoob/three.js/blob/r185/src/nodes/functions/material/getParallaxCorrectNormal.js); a source grep found no other box-projection code.
- drei's `useBoxProjectedEnv(position, scale)` returns `{ref, onBeforeCompile, customProgramCacheKey}` to spread onto a material. It is billed as "the cheapest possible way of getting reflections in threejs" and is paired with `<CubeCamera frames={1}>` to capture the room once. — [drei docs, useBoxProjectedEnv](https://drei.docs.pmnd.rs/misc/use-box-projected-env).
- A plain env map assumes an environment at infinite distance, which is wrong indoors. A box-projected cube map example was once added to three.js and then removed. — [three.js forum, "Lighting for interior"](https://discourse.threejs.org/t/lighting-for-interior/6364) (older thread).
- In Unity, box projection lets a probe's cubemap sit at a finite distance. For a probe reflecting a room interior, set the box size to the room's dimensions. — [Unity Manual, Advanced reflection probe features](https://docs.unity3d.com/6000.2/Documentation/Manual/AdvancedRefProbe.html).

**CubeCamera and LightProbe**

- `CubeCamera.update()` calls `renderer.render( scene, … )` **six times**, once per face, then builds mips. — [CubeCamera.js r185](https://github.com/mrdoob/three.js/blob/r185/src/cameras/CubeCamera.js).
- `LightProbeGenerator.fromCubeTexture()` and `async fromCubeRenderTarget( renderer, cubeRenderTarget )` turn a capture into SH irradiance for `LightProbe`. — [LightProbeGenerator.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/lights/LightProbeGenerator.js).

**RectAreaLight**

- It has no shadow support and works only with PBR materials. You must include and initialise `RectAreaLightUniformsLib` (WebGLRenderer) or `RectAreaLightTexturesLib` (WebGPURenderer). — [three.js docs, RectAreaLight](https://threejs.org/docs/pages/RectAreaLight.html). Both libs exist in r185 `examples/jsm/lights/`.
- The LTC BRDF is approximated with a precomputed texture of about 80 KB. — [three.js docs, RectAreaLightTexturesLib](https://threejs.org/docs/pages/RectAreaLightTexturesLib.html).
- In the forward shader, every lit PBR fragment loops over all `NUM_RECT_AREA_LIGHTS` (`RE_Direct_RectArea`). Light counts (`numPointLights`, `numSpotLights`, `numRectAreaLights`, `numLightProbes`) are part of the **program cache key**, so adding or removing a light recompiles shaders. — [lights_fragment_begin.glsl.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/lights_fragment_begin.glsl.js); [WebGLPrograms.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/webgl/WebGLPrograms.js).
- One user reported 20–30 fps with RectAreaLights against a steady 60 fps with Spot or Point lights. That was the r98 era, so it is old and a rough signal only. — [three.js forum, "Low fps using RectAreaLight"](https://discourse.threejs.org/t/low-fps-using-rectarealight-alternatives/4888).
- Godot, a different engine, says area lights are more demanding than omni and spot lights and suggests reserving them for cinematics or high-end devices. — [Godot docs, AreaLight3D](https://docs.godotengine.org/es/4.x/classes/class_arealight3d.html).

**Fake translucency for opal and backlit glow**

- r185 ships `SubsurfaceScatteringShader`, based on the GDC 2011 talk "Approximating Translucency for a Fast, Cheap and Convincing Subsurface Scattering Look" (older source). — [SubsurfaceScatteringShader.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/shaders/SubsurfaceScatteringShader.js).

**Measured for this note: amber transmission against backdrop brightness**

Method: amber `attenuationColor` set to the concept gold `#F2A93B`. Transmitted light ≈ 0.96 × L_background × attenuationColor^t, where `t` is path length divided by `attenuationDistance` (the three.js Beer-Lambert form) and 0.96 is 1 − F0 for IOR 1.5. Output is tone-mapped at the game's exposure of 1.2 using the r185 GLSL port. Fresnel angle, specular, roughness blur and base-colour tint are ignored.

| Background behind the glass (linear radiance) | t   | ACES (current) | Neutral     | AgX     |
| --------------------------------------------- | --- | -------------- | ----------- | ------- |
| Dark wall, 0.042 (≈ sRGB #3A3A3A)             | 1   | #281401        | #392300     | #3F2200 |
| Dark wall, 0.042                              | 2   | #220500        | #371500     | #380B00 |
| Mid wall, 0.195 (≈ #7A7A7A)                   | 1   | #82500F        | #795002     | #865D27 |
| Mid wall, 0.195                               | 2   | #752401        | #753400     | #813C0D |
| White surface lit to 1.0                      | 1   | #E9C25D        | **#F1A62F** | #CFAA72 |
| White surface lit to 1.0                      | 2   | #ED8B1E        | #ED7414     | #D08751 |
| Light box or emissive card, 2.0               | 1   | #F8E194        | #FBBA6E     | #E6C695 |
| Light box or emissive card, 2.0               | 2   | **#FFBD48**    | #FA8F5D     | #E9A874 |

Source of the formulas: [three.js r185 tonemapping_pars_fragment.glsl.js](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js). The table values were computed for this note.

### Inferences

- **The core design rule.** A per-exhibit studio PMREM gives the glass strip-softbox edge reflections and a top gradient. The **refracted image** is still the real room. Every coloured or translucent exhibit therefore needs something bright actually behind it in the scene:
  - an emissive backdrop card, a lit niche wall, or a glowing plinth top
  - linear radiance of roughly **1–2** behind amber; the dark wall is about 0.04
  - visible in the transmission buffer only if it is an opaque object
  - HDR values above 1 survive into refraction only on devices with half-float support

  This is the real-time bright-field. In the table, Neutral with a backdrop of about 1.0 reproduces the concept gold almost exactly (#F1A62F against #F2A93B). ACES needs thicker glass or a backdrop of about 2.0 to look rich gold, and goes straw-yellow on thin walls.

- **Alternatives** if a visible backdrop is unwanted: a shared custom transmission buffer rendered from a "studio backdrop" scene (MeshTransmissionMaterial-style `buffer`/`background`), at the cost of one extra scene render. Or a cheap cube-map refraction fake for the low tier. That is unverified for PBR materials here; other researchers may cover it.
- **Shapes of reflections.** Punctual lights (Spot, Point) reflect in smooth glass as pinpoints. That is right for cut-crystal sparkle and wrong for smooth vessels. Strip and softbox edge reflections need area shapes: either Lightformer-style emissive strips baked into the PMREM (free per pixel) or RectAreaLights (costly, no shadows). On phones, put the softboxes **in the environment map** and keep at most 0–1 RectAreaLight, for a hero piece on high tiers.
- **Per-material env maps cost almost nothing per pixel.** They use the same IBL code path as `scene.environment`. The cost is GPU memory for one PMREM per look (generated once at load with `fromScene`), not per frame. A small set of shared studio PMREMs keyed by glass family (bright-field warm, dark-field cool, sparkle) is likely enough.
- **CubeCamera per exhibit** means six scene renders per update. Use it once on room entry, or bake offline. Never per frame on phones. `LightProbeGenerator` can reuse the same capture for cheap SH fill on plinths.
- **The transmission pass is the biggest steady cost.** On phones, set `renderer.transmissionResolutionScale = 0.5` (a quarter of the pixels). Rough glass already samples blurred mips, so the lower resolution mostly hurts only clear glass.
  - Avoid `dispersion` on the low tier: it triples the eight-tap bicubic samples.
  - Keep the opaque scene cheap (baked materials), because it is drawn twice.
- **Back faces can differ between phone and desktop.** On devices exposing `WEBGL_multisampled_render_to_texture`, r185 skips the back-face pass. Test the double-sided glass look on target phones.

### Gaps

- I found no measured mobile-GPU frame times for r185 transmission, RectAreaLight, CubeCamera or PMREM generation. The costs above are structural, read from source, not benchmarked.
- I did not verify how widely `EXT_color_buffer_half_float` and `WEBGL_multisampled_render_to_texture` are exposed on target phones. Both change the look: HDR backdrop glow and back faces.
- I did not research HDRI selection (which Poly Haven studio maps suit glass) beyond the existence of glass-oriented studio packs.
- SpotLight penumbra, `SpotLight.map` gobos and shadow-map costs were not separately sourced. I also did not verify how three.js shadow maps treat transmissive casters.

---

## Q3. Tone mapping and colour: ACES, AgX and Khronos PBR Neutral; exposure; selective bloom; how configurators keep colour faithful

### Takeaway

**The current ACES setting probably accounts for much of the dull, shifted look.** three.js's ACES multiplies exposure by 1/0.6, so `toneMappingExposure = 1.2` is an effective **2.0× gain**. On the glass palette, ACES:

- pushes amber and orange **+15° to +31° toward yellow**
- strips **61–70% of the chroma** from pastel opal, mint, lavender and champagne at normal brightness

AgX keeps hue within about ±4° for most swatches (up to +7° on saturated orange at k = 1, and +10° at k = 2) but removes roughly 20–67% of chroma: about 40% on saturated amber and about 65% on pastels. That turns amber into tan or caramel. **Khronos PBR Neutral** (three.js `NeutralToneMapping`) keeps hue within about ±2° at normal brightness (k = 1). Chroma stays within roughly −12% to +15%, mostly a slight boost, and highlights are compressed toward white only above about 0.76–0.8 linear. That is why model-viewer made it the default for product rendering.

Bloom can sell a "lit from inside" glow, but the official selective-bloom method renders the scene twice. On phones, use threshold-based bloom on HDR values above 1, or none.

### Cited Findings

**The r185 implementations.** Source: [tonemapping_pars_fragment.glsl.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js).

- **ACESFilmic** is Stephen Hill's RRT and ODT fit (sRGB to AP1 matrices), with `color *= toneMappingExposure / 0.6`. The source comment says it was "modified to accommodate a brighter viewing environment. The scale factor of 1/0.6 is subjective. See discussion in #19621."
- **AgX** is "based on Filament, which in turn is based on Blender's implementation using rec 2020 primaries" (Filament PR 7236). It uses a log2 range from −10 to +6.5 EV around 0.18 middle grey, and the iolite "minimal AgX" sigmoid polynomial.
- **The AgX "look" line is commented out** (`// v = agxLook(v, look);`). three.js AgX is therefore Blender's base AgX with no "Punchy" look.
- **Neutral** carries the comment `https://modelviewer.dev/examples/tone-mapping`. It uses `StartCompression = 0.8 - 0.04`, `Desaturation = 0.15`, and subtracts an offset of up to 0.04 from the minimum channel.

**Khronos PBR Neutral specification**

- Parameters: F90 = 0.04, the Fresnel reflectance of IOR 1.5 materials; Ks = 0.8 − F90 = 0.76, where highlight compression starts; Kd = 0.15, the desaturation speed.
- For base colours with channels between 0.08 and 0.8, c_out = c_in − F90. The base colour is "exactly reproduced in the output render" for a shiny dielectric facing the camera under unitary-white lighting.
- Above Ks, the colour blends toward neutral grey with "no hue shifts (angle around the white axis)". The mapping is "1:1 and analytically invertible" with continuous derivatives.
- Output is sRGB only, input is assumed Rec. 709, and there is no gamut mapping.
- Source: [KhronosGroup/ToneMapping, PBR_Neutral README](https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/README.md); release announcement: [Khronos community](https://community.khronos.org/t/the-khronos-group-has-released-the-khronos-pbr-neutral-tone-mapper-specification/110811).

**E-commerce practice (model-viewer)**

- From the [model-viewer tone-mapping article](https://modelviewer.dev/examples/tone-mapping):
  - ACES and AgX suffer "significant loss of saturation", and "canary yellow, bright greens and blues are all impossible to output to the screen".
  - Hue "should remain unchanged" and saturation "retained as much as possible".
  - "Any baseColor with R, G, and B values below 231 will be faithfully reproduced under even, white lighting".
  - Lowering exposure to avoid clamping "breaks down completely for shiny objects".
  - Use "simple grayscale lighting to avoid skewing it". "Studio lighting is intentionally crafted to avoid overexposure."
- model-viewer **v3.5.0** added the `neutral` tone mapper, with `commerce` kept as an alias. — [v3.5.0 release notes (mirror)](https://git.tdem.in/google/model-viewer/releases/tag/v3.5.0).
- **v4.0.0** lists as a breaking change: "Our default tone-mapping has been updated to PBR Neutral, for improved color accuracy". Use `tone-mapping="aces"` for the legacy look. — [model-viewer v4.0.0 release](https://github.com/google/model-viewer/releases/tag/v4.0.0). The page shows "23 Oct" but not the year; I believe it was 2024, unverified.
- Blender has an open proposal to add a Khronos PBR Neutral view transform. — [Blender issue #118824](https://projects.blender.org/blender/blender/issues/118824).
- three.js forum: AgX is "less saturated than ACES Filmic, out of the box". Blender's "Punchy" AgX look is closer to ACES saturation. — [three.js forum, "Is AGX tonemapping implemented correctly?"](https://discourse.threejs.org/t/is-agx-tonemapping-implemented-correctly/60609).
- Practitioner opinions: Filmic shifted colour in saturated highlights, while AgX "has a problem of impossibility to achieve saturated highlights". Others defend AgX's desaturation as intentional. — [Blender Artists, "dealing with aces agx srgb"](https://blenderartists.org/t/dealing-with-aces-agx-srgb/); [CG Cookie thread](https://cgcookie.com/comments/387969/replies/new).

**Measured for this note: r185 tone mappers on the Glassworks palette at exposure 1.2**

Method: each swatch is decoded from sRGB to linear and multiplied by a radiance factor `k`, where k = 1 means the pixel's linear radiance equals the swatch, as for a white-lit diffuse surface or emissive intensity 1. The result is mapped with the r185 GLSL port. dh is the OKLCh hue change; dC is the chroma change against the swatch.

| Swatch (input)        | k   | ACES (current)                  | AgX                            | Neutral                           |
| --------------------- | --- | ------------------------------- | ------------------------------ | --------------------------------- |
| Amber gold #F2A93B    | 1   | #EAC560, dh **+15.8°**, dC −14% | #D1AB74, dh +3.7°, dC **−42%** | #F2A833, dh +0.4°, dC +3%         |
| Amber gold #F2A93B    | 2   | #F8E298, dh +20.7°, dC −34%     | #E7C897, dh +5.9°, dC −51%     | #FBBB71, dh −3.6°, dC −20%        |
| Deep amber #B5651D    | 0.5 | #9B4A0D, dh −6.7° (toward red)  | #975B29, dC −21%               | #8E4B01, dh +1.4°                 |
| Deep amber #B5651D    | 2   | #F0AE47, dh +18.3°              | #D69D69, dC −26%               | #F38B2F, dh −0.3°                 |
| Orange-amber #FF8C00  | 1   | #F4B031, dh **+19.5°**          | #D99D62, dC −42%               | #F58D36, dh −2.2°                 |
| Orange-amber #FF8C00  | 2   | #FFD666, dh **+31.2°**          | #EEBC86, dC −49%               | #FCA673, dh −7.3° (toward salmon) |
| Opal milk #F2F0EC     | 1   | #E4E4E3, L 0.92 vs 0.956        | #CCCBCA, L 0.84                | #F2F0EC, L 0.95                   |
| Opal mint #CDEBDD     | 1   | #D9E2DE, dC **−70%**            | #C0C9C5, dC −67%               | #D0F0E1, dC +5%                   |
| Opal lavender #D9CCF0 | 1   | #DCD7E3, dC −66%                | #C3C0CC, dC −66%               | #DACCF1, dC +3%                   |
| Champagne #F7E7CE     | 1   | #E6E1D9, dC −68%                | #CEC8BF, dC −64%               | #F3E3CA, dC ±0%                   |
| Amethyst #9966CC      | 1   | #B77CD6, dh +8.0°, dC −9%       | #A28AC2, dC −46%               | #9E61D8, dC +15%                  |
| Jade #00A86B          | 1   | #3BC186, dC −3%                 | #5CAB82, dC −33%               | #00B675, dC +6%                   |
| Gold trim #D4AF37     | 1   | #DDC75B, dh +6.9°               | #C4AD6E, dC −38%               | #E2B81E, dC +13%                  |

The same pattern holds at exposure 1.0. For example ACES gives amber gold +13.7° and −12% chroma, and pastels −61% to −64% chroma.

**Bloom cost in r185**

- `UnrealBloomPass` uses a half-resolution luminosity high-pass (`threshold`), then **5 mip levels**, each a horizontal and vertical separable blur with kernel sizes 6, 10, 14, 18 and 22, all in `HalfFloatType` targets, then a composite. — [UnrealBloomPass.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/postprocessing/UnrealBloomPass.js).
- The official **selective** bloom example renders the scene **twice per frame**. It swaps non-bloom meshes to a black `MeshBasicMaterial` (layer test), renders a bloom composer, restores the materials, then renders a final composer (a 4x MSAA HalfFloat target) with a mix pass and `OutputPass`. It uses `NeutralToneMapping`. — [three.js example webgl_postprocessing_unreal_bloom_selective.html](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_postprocessing_unreal_bloom_selective.html).
- pmndrs react-postprocessing describes bloom as selective by **brightness threshold**: raise material colours above the threshold and set `toneMapped={false}` on them. Its `SelectiveBloom` is less performant than plain `Bloom`, and `mipmapBlur` is optional. — [react-postprocessing docs, Bloom](https://react-postprocessing.docs.pmnd.rs/effects/bloom). Forum users report slowdowns with selective bloom plus animation — [three.js forum](https://discourse.threejs.org/t/bloom-selective-animate-performance/34783.md).
- **New in r18x WebGLRenderer:** a constructor option `outputBufferType` (default `UnsignedByteType`) and `renderer.setEffects( effects )`. These require `HalfFloatType` or `FloatType`. "Tone mapping and color space conversion are applied automatically", and an `OutputPass` "is not needed". — [WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js).

### Inferences

- **Switching the glass rooms from ACES to `NeutralToneMapping` is the single cheapest fix** for the hue shift and the pastel loss. It costs nothing per frame (a few ALU ops either way). Exposure must be re-tuned: ACES at 1.2 is an effective 2.0× gain with a toe, so a like-for-like midtone brightness under Neutral needs re-balanced lights rather than a copied exposure value.
- Neutral's own trade-off: very bright saturated orange and amber drift toward **salmon or peach** (−6° to −11° hue at k = 2–4), where ACES drifts to straw-yellow (+20° to +38°). Keep the amber "glow" radiance around 1–1.5 rather than blowing it out.
- **AgX is the wrong choice for this palette.** It turns amber into tan (#D1AB74) and makes the "muddy caramel" complaint worse. three.js offers no Punchy look to compensate.
- **Opal mint and lavender play of colour cannot survive ACES or AgX** at normal brightness: −61% to −70% chroma at exposure 1.0–1.2. Under Neutral it survives: +3% to +5% at k = 1, and −3% to −11% even at k = 2, because compression only begins above about 0.76–0.8 linear.
- **Bloom for glass, if used:**
  - Make it threshold-based on HDR values (threshold ≥ 1.0), so only specular glints, cut-crystal sparkle and the glowing backdrop or core bloom.
  - Use r185's `setEffects` with a half-float output buffer so the threshold sees values before tone mapping.
  - Avoid the two-render selective example on phones.
  - Low tier: no bloom; mid tier: a reduced-resolution bloom.
  - Whether bloom raises perceived brightness for glass is a perceptual claim not sourced here.
- **Configurator rule of thumb:** neutral, greyscale studio lighting plus PBR Neutral keeps base colours true. Coloured room light such as warm gallery light shifts the hue by design. If exhibits must match the concept paintings, their key lights and environment should stay near-neutral, with the warmth coming from the glass.

### Gaps

- I did not fetch Blender's own AgX documentation (Blender 4.x default and looks). The Blender evidence is a forum post plus an issue tracker entry.
- I found no independent article measuring hue error across tone mappers. The tables here are my own computation from the r185 source, so they should be confirmed with in-engine renders of the actual materials.
- I did not measure bloom cost on phones, and did not confirm that `UnrealBloomPass` drops into `setEffects()` unchanged.

---

## Q4. Baked vs real-time lighting for a WebGL museum: lightmaps and AO from Blender, mixing baked room light with real-time exhibit lights, and where transmissive glass fits

### Takeaway

Bake the room (walls, floor, plinths, wall washes, plinth glow pools) and keep glass fully real-time, driven by a studio PMREM plus a few punctual lights. glTF does not carry lightmaps, so they are assigned in code on a second UV set. Glass shadows and light filtered through glass cannot be exported from Blender. Exclude glass from shadowing in the bake, or bake a deliberate soft amber glow pool. Because the transmission pass draws the opaque room a second time, cheap baked room materials directly cut the glass cost.

### Cited Findings

- r185 `MeshStandardMaterial.lightMap`: "The light map. Requires a second set of UVs. `lightMap` represents pre-baked illuminance data, and the texture must be assigned a `Texture#colorSpace`. Most `lightMap` textures set `texture.colorSpace = LinearSRGBColorSpace` and use float-type formats such as `.exr` or `.hdr`." — [MeshStandardMaterial.js r185](https://github.com/mrdoob/three.js/blob/r185/src/materials/MeshStandardMaterial.js). `Texture.channel` (default 0) selects the UV set — [Texture.js r185](https://github.com/mrdoob/three.js/blob/r185/src/textures/Texture.js).
- **glTF does not support lightmaps.** Export the bake separately and assign `material.lightMap` in code; `flipY` often needs flipping; generate a second UV set in Blender. Baked **AO** does export as the glTF occlusion texture, and baked lighting can also go into base colour. — [three.js forum, PBR and lightmap](https://discourse.threejs.org/t/question-about-pbr-and-lightmap/18909) (older thread).
- Shadows and filtered light through glass are rendering effects, not material properties, and cannot be exported from Blender. Lights and shadows have to be rebuilt in three.js. — [three.js forum, "Light passing through glass material"](https://discourse.threejs.org/t/light-passing-through-glass-material/64781).
- Tooling:
  - The **LightBake** Blender add-on automates bake setup and export and has a three.js integration. — [Superhive, Light Bake](https://superhivemarket.com/products/light-bake).
  - A course chapter covers baking lightmaps and AO in Blender for three.js. — [Educative, Learn three.js: Blender to bake lightmaps and ambient occlusion](https://www.educative.io/courses/learn-threejs-for-computer-graphics/blender-to-bake-lightmaps-and-ambient-occlusion).
  - An older community guide covers three.js baking. — [CodePen, Guide: three.js baking](https://codepen.io/alaingalvan/post/guide-three-js-baking).
- **GI Bake (`blender-probes-export`)** precomputes reflectance and indirect light in Blender with Cycles:
  - multi-roughness radiance cubemaps (reflection probes with BOX or ELLIPSOID influence)
  - irradiance volumes packed into texture sheets
  - a global probe
  - output as EXR or PNG plus `probes.json`
  - lightmaps are "TBD"; the three.js demo covers only "debugging and probes interpolation"
  - "in development", copyright 2023-present, 44 stars

  Source: [GitHub, gillesboisson/blender-probes-export](https://github.com/gillesboisson/blender-probes-export).

- Shipped web museums and galleries:
  - Onix's "Virtual Web Museum" is a browser exhibition hall built on **pre-baked lighting** with multiple zones, and exhibits defined in JSON linking to GLB models. — [Onix case study](https://works.onix-systems.com/project-details/virtual-web-museum/).
  - The MyGallery3D developer cites "optimization, baked lighting, mobile constraints" as the main work. — [three.js forum, "From a URL to a 3D gallery"](https://discourse.threejs.org/t/from-a-url-to-a-3d-gallery/93044).

### Inferences

- **Hybrid split** for a phone-capable museum:
  - **Baked:** room lightmaps and AO, wall-wash gradients behind each plinth, the plinth-top glow and floor pools.
  - **Real-time:** glass only. That means a per-family studio PMREM, plus 0–2 spots for sparkle (cut crystal) or a top light (all pieces), plus the transmission pass.
- Baked rooms make the second opaque draw in the transmission pass cheap, for example `MeshBasicMaterial` or `MeshLambertMaterial` with `lightMap`.
- **Bake the bright-field into the room.** The bright backdrop behind each coloured piece is best as baked emissive or lit wall texels. The transmission buffer samples it, and the amber then glows without any runtime light. Give it HDR headroom (an EXR lightmap, or an emissive backdrop above 1) so it reaches the roughly 1–2 radiance the amber table needs.
- **Glass in the bake:**
  - Turn off the glass objects' shadow ray visibility in Cycles so plinths are not darkened by opaque-looking glass shadows.
  - Optionally bake a soft, tinted "caustic" pool under amber pieces as a deliberate decal.
  - Do not bake the glass surfaces themselves: their look is view-dependent.
  - These settings are standard Blender practice but were not sourced here.
- **Reflections of the baked room in glass.** A per-room box-projected probe captured once (CubeCamera or offline from Blender via GI Bake) gives plausible room reflections on high tiers. The static studio PMREM is the low-tier fallback.

### Gaps

- I did not find a sourced, step-by-step guide to Cycles ray visibility for glass during bakes, or to mixing baked lightmaps with real-time spots in three.js (the risk of double-counting light).
- No Blender to three.js museum case study with measured mobile frame times was found.

---

## Q5. Examples to learn from: virtual museums, games, three.js glass showcases, and Unreal or Unity archviz

### Takeaway

The useful references are:

- **Real museums:** Corning's top-lit glass wing, The Met's glowing glass shelves, the Plains Art Museum's underlit pedestal.
- **Configurator practice:** model-viewer's neutral studio plus PBR Neutral.
- **pmndrs ecosystem patterns:** Lightformer studio environments, MeshTransmissionMaterial, box-projected env.
- **Unity's box-projected probes** as the archviz idea to port.

I found **no reliable sources** on games with convincing glass exhibits or collectibles, or on Unreal museum lighting specifically.

### Cited Findings

- Corning top-lit gallery: see Q1. — [Architectural Record (2015)](https://www.architecturalrecord.com/articles/7528-corning-museum-of-glass-contemporary-art-design-wing).
- The Met British Galleries glass-shelf LEDs: see Q1. — [Folio](https://folio.it/en/projects/the-metropolitan-museum-of-art-british-gallery-opa/).
- model-viewer's environment API lists `toneMapping` values including `auto`, `neutral` and `commerce`, and a `neutralLighting` setup described as ideal for product shots. — [tessl registry, model-viewer environment docs](https://tessl.io/registry/tessl/npm-google--model-viewer/files/docs/environment.md) (secondary mirror). The default became PBR Neutral in v4.0.0 — [GitHub release](https://github.com/google/model-viewer/releases/tag/v4.0.0).
- three.js's own `RoomEnvironment` comes from model-viewer's `EnvironmentScene`, a box of emissive panels. — [RoomEnvironment.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/environments/RoomEnvironment.js).
- Web gallery builds: Onix Virtual Web Museum (baked) — [Onix](https://works.onix-systems.com/project-details/virtual-web-museum/); MyGallery3D (baked, mobile) — [three.js forum](https://discourse.threejs.org/t/from-a-url-to-a-3d-gallery/93044); Chromomatrix gallery (Figma, Blender, three.js) — [Notion case study](https://pulsaero.notion.site/Chromomatrix-Virtual-Art-Gallery-9c3772bf1daa47ee86f51c33a3101fc8); Paradowski "Apart" (Mozilla Hubs, three.js) — [Paradowski](https://paradowski.com/work/apart).
- pmndrs patterns: [Lightformer](https://drei.docs.pmnd.rs/staging/lightformer), [MeshTransmissionMaterial](https://drei.docs.pmnd.rs/shaders/mesh-transmission-material), [useBoxProjectedEnv](https://drei.docs.pmnd.rs/misc/use-box-projected-env).
- Unity reflection-probe box projection for room interiors. — [Unity Manual](https://docs.unity3d.com/6000.2/Documentation/Manual/AdvancedRefProbe.html).
- Unreal: an Oblivion Remastered mod that turns on Lumen reflections in glass display-case covers notes that people, creatures and worn equipment are not reflected. A Fab art-exhibition scene is lit with Lumen. — [Nexus Mods](https://www.nexusmods.com/oblivionremastered/mods/4476); [Fab listing](https://www.fab.com/listings/4d4f9b35-8df2-4590-8df5-fc265fb4a583). Both are weak sources.

### Inferences

- **The model-viewer and RoomEnvironment lineage is the closest proven web analogue** of a photographer's studio. A Glassworks "studio PMREM" should be a hand-built scene of emissive strips, a top gradient panel and dark flags, made with `fromScene()`. It should follow the photographic recipes per glass family, rather than being a generic room.

### Gaps

- **Games:** I found no sourced write-ups of games with convincing glass exhibits or glass collectibles, and no GDC or SIGGRAPH talk specific to glass exhibit lighting.
- **Archviz:** No substantive Unreal or Unity museum-lighting guide was found. Only Unity's probe documentation is primary.
- **three.js showcases:** I found no specific three.js showcase of glass under studio lighting with a technical write-up, and did not research Sketchfab's glass and refraction guidance.
- **Budget:** These areas were researched less deeply within the tool-call budget.
