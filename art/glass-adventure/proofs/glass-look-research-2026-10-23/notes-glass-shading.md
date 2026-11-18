# Real-time glass shading in three.js r185 (WebGLRenderer, WebGL2): coloured, milky and frosted glass that reads as luminous

Method note for the report writer: most of the three.js mechanics below were read directly from the published `three@0.185.1` package source (installed at `mercurypitch/node_modules/.pnpm/three@0.185.1`). They are cited to the matching files at the GitHub `r185` tag. The version history comes from grepping the published packages for each release on jsDelivr, with release dates from the npm registry. Those claims are primary-source verified, not taken from forum posts.

## 1. How MeshPhysicalMaterial implements transmission, thickness, attenuation, ior, dispersion, iridescence and clearcoat (r150 to r185), and its documented limits

### Takeaway

In r185, transmission is a single screen-space pass per camera. It captures only the background plus opaque objects, and (on some devices only) the back faces of DoubleSide transmissive meshes. Each transmissive pixel then makes one refracted, mip-blurred lookup into that capture. The lookup is tinted by base colour times Beer-Lambert, and it replaces the diffuse lighting term entirely. Nothing in the model transmits light from the scene's lights through the glass, so clear glass can only ever look like "the pixel behind it, filtered and darkened". That is exactly the brown-wall and caramel-frost symptom the game sees.

### Cited Findings

#### The transmission render target (WebGLRenderer.renderTransmissionPass, r185)

- The renderer keeps one transmission render target per camera, `currentRenderState.state.transmissionRenderTarget[camera.id]`. It is created with `generateMipmaps: true` and `minFilter: LinearMipmapLinearFilter`. Its type is `HalfFloatType` when `EXT_color_buffer_half_float` or `EXT_color_buffer_float` exists, and `UnsignedByteType` otherwise. It uses the working (linear) colour space and `samples: Math.max(4, capabilities.samples)`, with the code comment "to avoid feedback loops, the transmission render target requires a resolve, see #26177" — [WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js)
- The target is sized `activeViewport.z * transmissionResolutionScale` by `activeViewport.w * transmissionResolutionScale`. `WebGLRenderer.transmissionResolutionScale` defaults to `1.0` ("The normalized resolution scale for the transmission render target") — [WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js)
- What the pass draws, in order:
  - It clears the target; if the clear alpha is below 1, it clears to white at alpha 0.5.
  - It draws `background.render(scene)`.
  - It sets `toneMapping = NoToneMapping` ("Otherwise they are applied twice") and calls `renderObjects(opaqueObjects, scene, camera)`.
  - It then resolves MSAA and regenerates the full mip chain (`updateMultisampleRenderTarget` and `updateRenderTargetMipmap`).
    — [WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js)
- Back faces: only when `extensions.has('WEBGL_multisampled_render_to_texture') === false` does the pass redraw back faces. It takes every transmissive item with `material.side === DoubleSide` that passes `object.layers.test(camera.layers)` and draws it again with `material.side = BackSide`, setting `material.needsUpdate = true` before and after. It then resolves and regenerates mips a second time — [WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js)
- If `scene.overrideMaterial` is set, the pass returns immediately — [WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js)
- Render lists:
  - Any material with `transmission > 0.0` goes into the `transmissive` list, whatever its `transparent` flag. Only otherwise does `transparent === true` put it in the `transparent` list.
  - Both lists are sorted back-to-front (`reversePainterSortStable`).
  - The pass runs once per camera per frame, whenever `transmissiveObjects.length > 0`.
    — [WebGLRenderLists.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/webgl/WebGLRenderLists.js); [WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js)
- The material uniforms are `transmissionSamplerMap = transmissionRenderTarget.texture` and `transmissionSamplerSize = (target.width, target.height)` — [WebGLMaterials.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/webgl/WebGLMaterials.js)

#### Shader mechanics (transmission_pars_fragment / transmission_fragment, r185)

- The header says "Transmission code is based on glTF-Sampler-Viewer" — [transmission_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)
- Refraction is a single interface:
  - It computes `refract(-v, normalize(n), 1.0 / ior)`.
  - The ray is `normalize(refractionVector) * thickness * modelScale`, where modelScale is the per-axis length of the model matrix columns ("The thickness is specified in local space").
  - The exit point `position + ray` is projected with `projMatrix * viewMatrix` into a screen UV, and that UV is sampled once.
    — [transmission_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)
- Roughness blur picks a mip: `lod = log2(transmissionSamplerSize.x) * applyIorToRoughness(roughness, ior)`, where `applyIorToRoughness = roughness * clamp(ior * 2.0 - 2.0, 0.0, 1.0)`. The comment reads "an IOR of 1.0 results in no microfacet refraction and an IOR of 1.5 results in the default amount" — [transmission_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)
- Filtering is "Mipped Bicubic Texture Filtering by N8". `textureBicubic` runs a 4-tap bicubic on the floor and the ceil mip and blends them by `fract(lod)`, so 8 `textureLod` taps per lookup — [transmission_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)
- Beer-Lambert: if `isinf(attenuationDistance)` there is no attenuation. Otherwise `attenuationCoefficient = -log(attenuationColor) / attenuationDistance` and `transmittance = exp(-attenuationCoefficient * length(transmissionRay))` — [transmission_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)
- The tint multiplies twice: `transmittance = diffuseColor * volumeAttenuation(...)`. In r185 the `diffuseColor` argument is `material.diffuseContribution`, which is `diffuseColor.rgb * (1.0 - metalnessFactor)` — [transmission_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_fragment.glsl.js); [lights_physical_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/lights_physical_fragment.glsl.js)
- Fresnel complement: `F = EnvironmentBRDF(n, v, specularColor, specularF90, roughness)`, and the result is `(1.0 - F) * transmittance * sample.rgb` — [transmission_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)
- Dispersion (`USE_DISPERSION`) uses three IORs, `ior -/+ (ior - 1.0) * 0.025 * dispersion` around the centre value. Each one gets its own ray, projection and bicubic lookup, and keeps one colour channel. That makes 24 taps instead of 8 — [transmission_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)
- Transmission replaces diffuse lighting: `totalDiffuse = mix(totalDiffuse, transmitted.rgb, material.transmission)`. The two maps read different channels: `transmissionMap` uses R and `thicknessMap` uses G — [transmission_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_fragment.glsl.js)
- Final composition:
  - `outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance`, so emissive is added after the transmission mix and is not attenuated by it.
  - Sheen is then added on top.
  - Clearcoat layers last: `outgoingLight * (1.0 - clearcoat * Fcc) + (clearcoatSpecularDirect + clearcoatSpecularIndirect) * clearcoat`.
    — [meshphysical.glsl.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderLib/meshphysical.glsl.js)
- Punctual lights are not transmitted. Under `USE_TRANSMISSION`, `lights_physical_pars_fragment` only declares the `transmission` and `transmissionAlpha` struct fields. There is no BTDF term for light arriving from behind the surface, so a spotlight behind or above a vessel adds nothing through the glass body — [lights_physical_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/lights_physical_pars_fragment.glsl.js)
- Alpha: `transmissionAlpha = 1 - (1 - sample.a) * avg(transmittance)` and `diffuseColor.a *= material.transmissionAlpha`. This only matters over a transparent canvas — [transmission_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js); [opaque_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/opaque_fragment.glsl.js)
- Defaults:

  | Property                    | r185 default |
  | --------------------------- | ------------ |
  | `ior`                       | 1.5          |
  | `thickness`                 | 0            |
  | `attenuationDistance`       | Infinity     |
  | `attenuationColor`          | white        |
  | `iridescenceIOR`            | 1.3          |
  | `iridescenceThicknessRange` | [100, 400]   |
  | `sheenColor`                | black        |
  | `sheenRoughness`            | 1.0          |
  | `specularIntensity`         | 1.0          |

  The doc comment also says "When transmission is non-zero, `opacity` should be set to `1`" — [MeshPhysicalMaterial.js r185](https://github.com/mrdoob/three.js/blob/r185/src/materials/MeshPhysicalMaterial.js)

- GLTFLoader r185 maps glTF fields as follows:
  - `thicknessFactor` becomes `thickness` (default 0) and `thicknessTexture` becomes `thicknessMap`.
  - `attenuationDistance` falls back to `Infinity`.
  - `attenuationColor` is read in linear sRGB.
  - `KHR_materials_dispersion.dispersion` becomes `material.dispersion`.
    — [GLTFLoader.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/GLTFLoader.js)
- The KHR_materials_volume spec is "Complete, Ratified by the Khronos Group":
  - "If the value is 0 the material is thin-walled."
  - Thickness is stored in the G channel.
  - Beer's law is σt = -log(c)/d, which gives T(x) = c^(x/d).
  - Thickness-map volumetrics are "a lossy process"; ray tracers should ignore the map.
    — [KHR_materials_volume README](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_volume/README.md)

#### Version history, verified by grepping each published package

- **r133 (2021-09-30):** the target is fixed at 1024x1024: `new renderTargetType(1024, 1024, { generateMipmaps: true, type: HalfFloat if available, minFilter: LinearMipmapLinearFilter ... })`. It holds opaque objects only, with tone mapping off in the pass — [three@0.133.0 WebGLRenderer.js](https://cdn.jsdelivr.net/npm/three@0.133.0/src/renderers/WebGLRenderer.js); dates from the [npm registry](https://registry.npmjs.org/three)
- **r150 (2023-02-23):** bicubic mip filtering (`textureBicubic`) appears; it is absent in r149 — [three@0.149.0 chunk](https://cdn.jsdelivr.net/npm/three@0.149.0/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js); [three@0.150.0 chunk](https://cdn.jsdelivr.net/npm/three@0.150.0/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)
- **r151 (2023-03-30):** the DoubleSide back-face loop inside `renderTransmissionPass` appears; it is absent in r150 — [three@0.150.0 WebGLRenderer.js](https://cdn.jsdelivr.net/npm/three@0.150.0/src/renderers/WebGLRenderer.js); [three@0.151.0 WebGLRenderer.js](https://cdn.jsdelivr.net/npm/three@0.151.0/src/renderers/WebGLRenderer.js)
  - On 4 Dec 2023, Mugen87 replied about the change between r149 and r158: "This is intended. Back sides of transmissive objects were not rendered correctly in older three.js versions." He added that it also changes the final colour of transmissive surfaces — [three.js forum](https://discourse.threejs.org/t/transmission-rendering-changed-with-version-r150/58866)
- **r155 to r163:** the target is resized to the drawing buffer (`_transmissionRenderTarget.setSize(_vector2.x, _vector2.y)`) and is multisampled — [three@0.155.0 WebGLRenderer.js](https://cdn.jsdelivr.net/npm/three@0.155.0/src/renderers/WebGLRenderer.js)
- **r164 (2024-04-25)** — [three@0.164.0 WebGLRenderer.js](https://cdn.jsdelivr.net/npm/three@0.164.0/src/renderers/WebGLRenderer.js); [three@0.163.0 chunk](https://cdn.jsdelivr.net/npm/three@0.163.0/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js); [three@0.164.0 chunk](https://cdn.jsdelivr.net/npm/three@0.164.0/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)
  - `dispersion` arrives (`USE_DISPERSION` is absent in r163).
  - Transmission targets become per camera and are sized to the active viewport.
  - The back-face loop is skipped when `WEBGL_multisampled_render_to_texture` exists.
- **r172 (2024-12-31):** `transmissionResolutionScale` arrives; it is absent in r171 (2024-11-29) — [three@0.171.0](https://cdn.jsdelivr.net/npm/three@0.171.0/src/renderers/WebGLRenderer.js); [three@0.172.0](https://cdn.jsdelivr.net/npm/three@0.172.0/src/renderers/WebGLRenderer.js)
- **r182 (2025-12-10):** the transmission chunk changed its struct fields from `material.diffuseColor, material.specularColor` to `material.diffuseContribution, material.specularColorBlended` — [three@0.181.0 transmission_fragment](https://cdn.jsdelivr.net/npm/three@0.181.0/src/renderers/shaders/ShaderChunk/transmission_fragment.glsl.js); [three@0.182.0 transmission_fragment](https://cdn.jsdelivr.net/npm/three@0.182.0/src/renderers/shaders/ShaderChunk/transmission_fragment.glsl.js)
- **r185.0** was published 2026-06-25 and **r185.1** on 2026-07-01 — [npm registry](https://registry.npmjs.org/three)

#### Documented limitations

- **Glass behind glass.** donmccurdy, 20 Jan 2023: "Transmissive and transparent surfaces are not visible behind a transmissive surface". Transmission shows opaque surfaces only. He suggested `.transparent = false` on transmissive materials. drcmda in the same thread: the vanilla material "can't see other transmissive/transparent objects" — [three.js forum](https://discourse.threejs.org/t/objects-with-transmission-not-showing-objects-behind/47113)
- A 2021 maintainer comment (via search snippet) called this "a common limitation of the 'transmission' effect in realtime renderers". Supporting more is possible but expensive and not implemented — [three.js forum search result](https://discourse.threejs.org/t/transmission-throw-more-than-one-object/29335)
- **Issue #28131**, opened by mrxz on 13 Apr 2024 against r163: "DoubleSided transmission unsupported with `WEBGL_multisampled_render_to_texture` (Oculus Browser)" — [GitHub #28131](https://github.com/mrdoob/three.js/issues/28131)
  - With that extension, the back-side draw reads and writes the same texture ("Source and destination textures of the draw are the same").
  - Mugen87: "we were hoping to circumvent the feedback loop by always using a multisampled render target". He proposed a `copyTexSubImage2D()` copy instead.
  - The issue was retitled "unsupported", relabelled Enhancement, and is still open.
- **PRs #28423 and #28434** came up only as search snippets; neither was opened. #28423 was described as a transmission-pass performance trade-off ("rendering all contents to the transmission buffer ... will likely not have the same contents as the canvas"). #28434 was described as background rendering in the pass — [PR #28423](https://github.com/mrdoob/three.js/pull/28423); [PR #28434](https://github.com/mrdoob/three.js/pull/28434)

#### WebGPURenderer path (r185), for comparison

- Front faces sample `viewportOpaqueMipTexture()` ("The texture should only contain the opaque rendering objects"). `BackSide` materials sample a separate `viewportMipTexture()`. The LOD formula is the same and the lookup is bicubic (`textureBicubicLevel`) — [PhysicalLightingModel.js r185](https://github.com/mrdoob/three.js/blob/r185/src/nodes/functions/PhysicalLightingModel.js); [ViewportTextureNode.js r185](https://github.com/mrdoob/three.js/blob/r185/src/nodes/display/ViewportTextureNode.js)
- Transmissive materials go into the transparent list. A DoubleSide transmissive material with `forceSinglePass === false` goes into `transparentDoublePass` and is drawn back side first, then front — [RenderList.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/common/RenderList.js); [Renderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/common/Renderer.js)

### Inferences

- **The brown band, explained.** With `transmission = 1`, the visible colour is (1-F) x base x Beer x (the opaque pixel behind, offset along the refracted ray). Nothing adds light. Amber over a dark wall must therefore read as brown. With `thickness = 0` (thin-walled) the lookup is the pixel straight behind, so the result is literally the wall seen through a filter.
- **Frosting goes caramel, explained.** At roughness 0.4 and ior 1.5, lod = 0.4 x log2(width). On a 1920 px target that is about 4.4, roughly a 90 px-wide mip. The result is a local average of the surroundings, mostly the dark wall, tinted amber. Raising roughness only averages more of the same dark room and cannot add energy. Clearcoat then multiplies the base by (1 - clearcoat x Fcc), which darkens grazing angles further.
- **The opal reads darker than the wall, explained.** Transmission replaces diffuse. A white milky base with high transmission therefore has no diffuse scattering of the gallery lights at all. It can only show (1-F) x wall x attenuation, which is never more than the wall, before clearcoat losses. Milky glass needs the very scattering term that transmission removes.
- **Double tint.** Base colour and `attenuationColor` multiply. Using both for amber squares the tint, which makes it darker and muddier. Pick one: either a white base with `attenuationColor` (thickness-dependent: pale rims, saturated base), or base colour only for thin-walled pieces.
- **Partial glass-behind-glass, desktop only.** The r151+ loop renders the back faces of every DoubleSide transmissive object into the shared buffer. A vessel can therefore show the back faces, but never the front faces, of shards or vessels behind it. On devices with `WEBGL_multisampled_render_to_texture` (Quest/Android headsets per #28131), none of that happens. Desktop and those devices will look different.
- **Rough glass changes look with resolution.** The blur is tied to resolution. The footprint fraction of the screen is about W^(roughness - 1), where W is the target width. Higher resolution looks sharper and lower looks blurrier. Lowering `transmissionResolutionScale` from 1 to 0.5 at roughness 0.4 widens the blur by about 0.5^-0.6, roughly 1.5x. Rough-glass recipes will look different per tier and device unless the LOD formula is patched.
- **What the model leaves out.** There is no exit-interface refraction, no total internal reflection, no internal reflections, no caustics and no off-screen content. A refracted UV that leaves the screen just samples the clamped edge (render-target default wrap; not separately verified).
- **Iridescence and transmission.** The transmission complement calls plain `EnvironmentBRDF`, so iridescence colours only the reflections, not the energy split with transmission. This is inferred from the call signature.
- **Back-face CPU cost.** Each DoubleSide transmissive object toggles `material.needsUpdate` twice per frame. Programs are cached, but this adds a per-object CPU cost, which matters with many shards. Not measured.

### Gaps

- Issue #26177 (the MSAA feedback-loop rationale) was not opened. Sizing between r140 and r151 was not traced in detail (r150-r151 grep results were ambiguous).
- No source says how many mobile browsers expose `WEBGL_multisampled_render_to_texture` (beyond the Oculus/Android headset in #28131), or `EXT_color_buffer_half_float`. Without half-float, the 8-bit fallback clamps HDR highlights in the capture.

## 2. Techniques to make coloured glass read as lit from within, without the wall showing

### Takeaway

Making amber glow means adding energy that does not come from the screen buffer, or swapping the buffer for a controlled source. The options:

- a per-material studio-environment refraction lookup (PMREM `textureCubeUV` with roughness);
- emissive or translucency terms (emissive is composited after transmission, so it survives a dark background);
- your own capture pass with a controlled backdrop (MeshTransmissionMaterial's `background` idea);
- a two-sided (Wyman-style) refraction against an environment.

Beer-Lambert thickness maps make glass look volumetric, but they only remove light.

### Cited Findings

- **Env-map refraction in core.**
  - `refractionRatio` with `CubeRefractionMapping` exists only on `MeshBasicMaterial`, `MeshLambertMaterial` and `MeshPhongMaterial`. The chunk computes `refract(cameraToFrag, worldNormal, refractionRatio)` per fragment, or `vReflect = refract(cameraToVertex, ...)` per vertex — [MeshPhongMaterial.js r185](https://github.com/mrdoob/three.js/blob/r185/src/materials/MeshPhongMaterial.js); [envmap_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/envmap_fragment.glsl.js); [envmap_vertex r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/envmap_vertex.glsl.js)
  - For PBR materials, `envmap_physical_pars_fragment` provides `textureCubeUV(envMap, dir, roughness)` for PMREM maps (`ENVMAP_TYPE_CUBE_UV`). `getIBLRadiance(viewDir, normal, roughness)` uses it for reflections. A custom refraction can call the same function with a refracted direction and a roughness value to get a blurred, energy-preserving "frosted" lookup with no screen buffer — [envmap_physical_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/envmap_physical_pars_fragment.glsl.js)
- **Emissive is a free lever.** It is added after the transmission mix (`outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance`), so a dark background cannot dim it — [meshphysical.glsl.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderLib/meshphysical.glsl.js)
- **Translucency example in three.js.** `SubsurfaceScatteringShader` extends Phong. Its parameters are `thicknessMap` (R channel), `thicknessColor`, `thicknessDistortion` 0.1, `thicknessAmbient` 0.0, `thicknessAttenuation` 0.1, `thicknessPower` 2.0 and `thicknessScale` 10.0. Per light, it computes `scatteringHalf = normalize(L + N * distortion)` and `scatteringDot = pow(saturate(dot(V, -scatteringHalf)), power) * scale`, then adds `(scatteringDot + ambient) * thickness * attenuation * lightColor` to `directDiffuse` — [SubsurfaceScatteringShader.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/shaders/SubsurfaceScatteringShader.js); example page [webgl_materials_subsurface_scattering](https://threejs.org/examples/#webgl_materials_subsurface_scattering)
- **Beer-Lambert with thickness maps.** See question 1: the G channel times `thickness`, applied as `exp(-(-log(c)/d) * length)`. The glTF spec says thickness maps are baked like AO, by casting rays opposite the normal, and calls them "lossy" — [KHR_materials_volume README](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_volume/README.md)
- **Wyman 2005 (older source, flagged).**
  - "An Approximate Image-Space Approach for Interactive Refraction" appeared in ACM TOG 24(3), pp. 1050-1053. It uses two GPU passes and refracts a distant environment through two interfaces, where earlier interactive methods handled one. The author notes aliasing can occur — [SIGGRAPH History archive](https://history.siggraph.org/?p=113948)
  - A companion paper, "Interactive image-space refraction of nearby geometry" (GRAPHITE 2005), handles nearby geometry by approximating it with a plane in screen space — [HPG 2025 poster citing it](https://highperformancegraphics.org/2025/publications/posters/Constant-Time%20Light%20Refraction%20Simulation%20-%20HPG2025.pdf)
- **Maxime Heckel, "Refraction, dispersion, and other shader light effects"** (24 Jan 2023, updated 14 Jun 2023) — [blog](https://blog.maximeheckel.com/posts/refraction-dispersion-and-other-shader-light-effects/)
  - Capture: hide the mesh, render the scene to a render target, and sample it with `gl_FragCoord.xy / winResolution` offset by `refract(eye, normal, 1/ior).xy`.
  - Dispersion: per-channel IOR uniforms, with a `LOOP` of jittered samples to smooth it. A saturation step fixes the washed-out result, and a six-channel "rygcbv" split gives finer spectral spread.
  - Backside: two FBOs (back faces first, then front), credited to Codrops.
  - Lighting: Blinn-Phong specular, and Fresnel as `pow(1.0 - abs(dot(eye, n)), power)`.
- **pmndrs drei MeshTransmissionMaterial (MTM) source** — [MeshTransmissionMaterial.tsx](https://github.com/pmndrs/drei/blob/master/src/core/MeshTransmissionMaterial.tsx)
  - It subclasses `MeshPhysicalMaterial`. `onBeforeCompile` replaces `#include <transmission_pars_fragment>` and `#include <transmission_fragment>`, merges in custom uniforms, and forces the `USE_TRANSMISSION` define. Three's own `transmission` stays 0 unless `transmissionSampler` is set, so the built-in pass does not run.
  - Each frame, per instance: the host mesh swaps to a `DiscardMaterial` and the whole scene renders into `fboMain`. With `backside`, it first renders into `fboBack`, then renders the host with `BackSide` and `backsideThickness` into `fboMain`.
  - `background` temporarily replaces `scene.background` during capture. A shared `buffer` skips the passes, and `transmissionSampler` uses three's built-in buffer instead.
  - Sampling: `samples` jittered taps (10 in the wrapper, 6 in the class). Each tap is spread along a "thickness smear", `max(pow(roughness, 0.33), anisotropicBlur)`. Roughness randomises the normals by roughness squared, with no mip blur in buffer mode.
  - `chromaticAberration` sets per-channel IOR: `ior`, `ior*(1+a)` and `ior*(1+2a)`. `distortion` uses simplex fractal noise, and `temporalDistortion` animates it.
- **Vanilla port.** The `@pmndrs/vanilla` README documents `MeshTransmissionMaterial` as "An improved THREE.MeshPhysicalMaterial" that "can 'see' other transmissive or transparent objects". It notes "it can still be expensive as it causes an additional render pass of the scene" and "the host mesh gets removed from the render-stack temporarily". Defaults: `_transmission` 1, `thickness` 0, `roughness` 0, `chromaticAberration` 0.03, `anisotropicBlur` 0.1, `distortion` 0, `distortionScale` 0.5, `temporalDistortion` 0 — [drei-vanilla README](https://github.com/pmndrs/drei-vanilla)
- drcmda (Jan 2023): extra setup code can be copied from the React material to add support in vanilla — [three.js forum](https://discourse.threejs.org/t/objects-with-transmission-not-showing-objects-behind/47113)

### Inferences

- **(a) Studio-refraction mode, the best fit for the luminous look on every tier.**
  - Inject a refraction lookup into the material's own PMREM envMap: a warm, bright studio for amber, soft pastel-white for opal. Use roughness for the frost.
  - Keep `transmission = 0`. The object then sits in the opaque list, so the transmission pass is not triggered and other transmissive glass can see it behind them.
  - The wall can never appear, and frosting stays bright because PMREM mips are pre-convolved radiance, not a dark local average.
  - Cost: real room objects are not refracted. On the high tier a small weight of true screen transmission can be blended in for refraction cues.
- **(b) Energy terms.**
  - A thickness-weighted emissive: amber x k x thickness x (1 - F), so thick bases glow and rims stay reflective.
  - An SSS-style translucency term from the gallery spotlights, added after the transmission mix so a light behind or above makes the body glow.
  - Both cover the missing punctual-light transmission in r185.
- **(c) Controlled backdrop.** The built-in pass cannot be steered per material: it uses the same camera layers and renders the whole opaque list. A controlled backdrop therefore needs an owned capture pass, MTM-style, with a `background` or a replacement layer. Per-instance passes are too expensive for many vessels, so one shared capture is the only realistic version.
- **(d) Two-sided Wyman-style refraction, a high-tier option for thick vessels.** Pre-pass the glass back faces (normals plus depth) at low resolution. Then refract at the front face, find the exit, refract again, and look up the studio env. This gives a convincing thick-glass look without sampling the wall. The mechanics of distance estimation, interpolating front-to-back depth and a precomputed normal-direction distance, are recalled from the paper rather than re-read here; verify them.
- **(e) Tint discipline.** For amber, use a white base with `attenuationColor` amber and `attenuationDistance` near the wall thickness in local units. That gives a pale lip and a saturated base, and avoids the squared muddy tint.

### Gaps

- I found no published, measured recipe for "luminous amber" in three.js.
- The Wyman paper text was not opened.
- The `@pmndrs/vanilla` README does not show who drives the per-frame capture in vanilla (in drei it is `useFrame`). Confirm from the vanilla story or source before adopting it.

## 3. Milky/opalescent and etched/frosted glass; status of KHR_materials_diffuse_transmission, dispersion and volume_scatter

### Takeaway

Opalescent glass is a scattering material: bluish in scattered or side light, orange or amber when you look through it toward the light. So it should be built mostly from diffuse plus translucency terms, not from high screen-space transmission.

The matching glTF extensions split by status:

| Extension                          | Spec status       | three.js r185 GLTFLoader                      |
| ---------------------------------- | ----------------- | --------------------------------------------- |
| KHR_materials_diffuse_transmission | Release Candidate | not supported                                 |
| KHR_materials_volume_scatter       | unratified draft  | not supported                                 |
| KHR_materials_dispersion           | ratified          | supported (`material.dispersion`, since r164) |

### Cited Findings

- **Physics.** Due to Rayleigh scattering, a transparent material "appears yellowish-red in transmitted white light and blue in the scattered light perpendicular to the transmitted light" — [Wikipedia: Opalescence](https://en.wikipedia.org/wiki/Opalescence)
- A Lehigh University lecture describes particle-containing glass that looks bluish from the side and reddish along the beam, because blue scatters more strongly — [Lehigh IMI lecture 18](https://www.lehigh.edu/IMI/teched/OPG/lecture18.pdf)
- A hobbyist source says opalescent glass viewed at right angles to the light is "translucent to opaque" and blue, while viewed toward the light it is more transparent and orange or amber, "dichromatic depending on the angle". Treat it as lower authority — [Carder Steuben Glass Association](https://steubenglass.org/gazelle-gazette/scattering-light-tyndall-effect/)
- **KHR_materials_diffuse_transmission** on the Khronos main branch: Status "Release Candidate", copyright 2025 — [KHR_materials_diffuse_transmission README](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_diffuse_transmission/README.md)
  - Parameters: `diffuseTransmissionFactor` (default 0), `diffuseTransmissionTexture` (A channel), `diffuseTransmissionColorFactor` (default [1,1,1]) and `diffuseTransmissionColorTexture` (RGB, sRGB).
  - The BSDF blends the diffuse BRDF with a Lambertian diffuse BTDF under the specular layer. The BTDF has no roughness control.
  - With KHR_materials_transmission, "the transmission effect overrides the diffuse transmission effect". With KHR_materials_volume, the object becomes translucent.
  - luma.gl also describes it as a release candidate, "not a ratified extension" — [luma.gl glTF materials docs](https://luma.gl/docs/api-reference/gltf/gltf-materials)
- **KHR_materials_dispersion**: "Complete, Ratified by the Khronos Group", copyright 2024 — [KHR_materials_dispersion README](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_dispersion/README.md)
  - `dispersion = 20/V_d` (Abbe number), default 0. Crown glass, with V_d 59, gives 0.33.
  - IOR per wavelength comes from the first two terms of Cauchy's equation. The extension requires KHR_materials_volume.
  - Real-time renderers can trace transmission per colour channel. The spec notes gemstones' many internal reflections mean "dispersion alone does not fully reproduce their appearance in a real-time rasterizer".
- **KHR_materials_volume_scatter**: luma.gl calls it "an active, unratified draft". It requires KHR_materials_volume and has fields `multiscatterColorFactor` (older spelling `multiscatterColor`), `multiscatterColorTexture` and `scatterAnisotropy`. luma.gl warns "Draft field names and behavior can change"; its own implementation is a thickness-aware single-scatter approximation with Henyey-Greenstein — [luma.gl glTF materials docs](https://luma.gl/docs/api-reference/gltf/gltf-materials)
- **three.js r185 GLTFLoader** extension list: KHR_materials_anisotropy, clearcoat, dispersion, emissive_strength, ior, iridescence, sheen, specular, transmission, unlit, variants and volume, plus EXT_materials_bump. Not `KHR_materials_diffuse_transmission`, and not `KHR_materials_volume_scatter` — [GLTFLoader.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/GLTFLoader.js)
- Volume and ior support arrived with PR #22117, merged July 2021 for r131 — [three.js PR #22117](https://github.com/mrdoob/three.js/pull/22117)
- **Layers useful for opal.** Sheen is a grazing-angle lobe added after the transmission mix. Iridescence (thin film, default IOR 1.3, 100 to 400 nm) produces view-dependent hue shifts in the specular — [meshphysical.glsl.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderLib/meshphysical.glsl.js); [MeshPhysicalMaterial.js r185](https://github.com/mrdoob/three.js/blob/r185/src/materials/MeshPhysicalMaterial.js)
- **Frosted glass in three.js.** `material.roughness`, which includes `roughnessMap`, drives the per-pixel mip LOD of the transmission lookup, so etched patterns can be painted into a roughness map — [transmission_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_fragment.glsl.js)
- MTM frosts differently: it jitters normals by roughness squared plus a thickness smear — [MeshTransmissionMaterial.tsx](https://github.com/pmndrs/drei/blob/master/src/core/MeshTransmissionMaterial.tsx)
- NVIDIA's "Phenomenological Scattering Model for Order-Independent Transparency" (2016, older) rasterises coloured transmission, diffusion and refraction with order-independent draws, and includes source code — [NVIDIA Research](https://research.nvidia.com/publication/2016-02_phenomenological-scattering-model-order-independent-transparency)
- NVIDIA Omniverse OmniSurface: transmission colour plus depth drive absorption ("red colored glass gets a deeper red" with depth), with separate scatter parameters — [OmniSurface Transmission docs](https://docs.omniverse.nvidia.com/materials-and-rendering/latest/templates/parameters/OmniSurface_Transmission.html)

### Inferences

- **Opal recipe (emulating diffuse transmission by hand).**
  - Keep a white or very pale diffuse base, with screen transmission at or near 0 so the scattering survives.
  - Add a pale blue or mint sheen for grazing-angle scatter.
  - Add a warm (peach or amber) back-light term, Lambert from the opposite hemisphere (dot(-N, L)), as a diffuse BTDF. Optionally use SSS-style wrap.
  - Use low iridescence (around 0.2 to 0.4, film range around 250 to 600 nm, to tune) for the mint and lavender play of colour.
  - Use studio-env refraction at low weight for any see-through hint.
  - The material is then brighter than the wall, because it scatters the gallery lights instead of filtering the wall.
- **Etched glass.**
  - Real etched glass is matte on one surface. A glossy clearcoat over a 0.4-rough base reproduces a lacquered look, not etching. For etched areas, drop clearcoat or use a clearcoat roughness map that matches the etch.
  - The screen-space mip blur cannot tell near objects from far ones, while real frosted glass blurs distant objects more.
  - A PMREM refraction lookup with roughness gives a bright, stable frost that is the same on every tier.
- **Clear, champagne and amethyst crystal.**
  - Champagne: white base, very pale warm `attenuationColor`, long `attenuationDistance`.
  - Amethyst: purple attenuation.
  - Cut-crystal sparkle needs internal reflections that three.js does not model. Fake it with a high-contrast studio env (small bright cards) plus faceted normals, and add dispersion (r164+, 24 taps) only on the high tier.

### Gaps

- The official Khronos status page for KHR_materials_volume_scatter was not found; only luma.gl's description was.
- I found no three.js issue or PR adding KHR_materials_diffuse_transmission, so its roadmap is unknown.
- I found no peer-reviewed real-time opal technique.
- "Opaline" (French opaline glass) versus precious-opal diffraction "play of colour" was not researched.

## 4. Extending MeshPhysicalMaterial safely in r185 (onBeforeCompile, customProgramCacheKey, three-custom-shader-material) versus WebGPURenderer with TSL

### Takeaway

On WebGLRenderer r185 the proven route is a subclass of MeshPhysicalMaterial that replaces the two transmission chunks via `onBeforeCompile`, the way drei MTM does, with an explicit `customProgramCacheKey`. It is fragile across releases: r182 renamed the fields the transmission chunk uses. So pin the three.js version and add compile tests.

Moving to WebGPURenderer means rewriting the glass in TSL, because GLSL injection is not used there. Its WebGL 2 fallback is a separate backend, not WebGLRenderer. Maturity claims for 2025-2026 come mostly from secondary sources.

### Cited Findings

- **Program cache key.** `Material.customProgramCacheKey()` returns `this.onBeforeCompile.toString()` by default. The doc: "In case onBeforeCompile is used, this callback can be used to identify values of settings used in onBeforeCompile(), so three.js can reuse a cached shader" — [Material.js r185](https://github.com/mrdoob/three.js/blob/r185/src/materials/Material.js)
- **Chunk drift.** In r182 the transmission chunk switched from `material.diffuseColor, material.specularColor` to `material.diffuseContribution, material.specularColorBlended` — [three@0.181.0](https://cdn.jsdelivr.net/npm/three@0.181.0/src/renderers/shaders/ShaderChunk/transmission_fragment.glsl.js); [three@0.182.0](https://cdn.jsdelivr.net/npm/three@0.182.0/src/renderers/shaders/ShaderChunk/transmission_fragment.glsl.js)
- **Prior art.** drei MTM is built this way: `onBeforeCompile` chunk replacement, merged uniforms, and a forced `USE_TRANSMISSION` define — [MeshTransmissionMaterial.tsx](https://github.com/pmndrs/drei/blob/master/src/core/MeshTransmissionMaterial.tsx)
- **three-custom-shader-material (CSM)** — [CSM README](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial)
  - Vanilla usage: `import CustomShaderMaterial from "three-custom-shader-material/vanilla"` with `baseMaterial: THREE.MeshPhysicalMaterial`.
  - Fragment outputs include `csm_DiffuseColor`, `csm_FragColor`, `csm_Roughness`, `csm_Metalness`, `csm_Clearcoat`, `csm_ClearcoatRoughness`, `csm_ClearcoatNormal`, `csm_Transmission`, `csm_Thickness` and `csm_Iridescence`. Each requires the matching base feature, for example `csm_Transmission` needs `transmission`. Also `csm_Emissive`, `csm_AO`, `csm_FragNormal` and `csm_UnlitFac`.
  - `patchMap` can replace specific chunks. The cache key is a hash of the shaders plus the base material's key. v6 makes initialisation "negligible".
  - Caveats: extending materials that already use `onBeforeCompile` "may or may not work", and chained instances need manual scoping. The README does not mention WebGPU or TSL.
- **WebGPURenderer fallback.** In r185, "By default, the renderer tries to use a WebGPU backend if the browser supports WebGPU. If not, WebGPURenderer falls backs to a WebGL 2 backend". It has a `forceWebGL` option — [WebGPURenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/webgpu/WebGPURenderer.js)
- **Legacy materials under WebGPU.** `MeshPhysicalMaterial` is auto-mapped to `MeshPhysicalNodeMaterial` — [StandardNodeLibrary.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/webgpu/nodes/StandardNodeLibrary.js)
- A grep of the r185 package finds no `onBeforeCompile` handling in `src/renderers/common`, `src/renderers/webgpu` or `src/materials/nodes` — [r185 source tree](https://github.com/mrdoob/three.js/tree/r185/src)
- **TSL slots.** `MeshPhysicalNodeMaterial` exposes `transmissionNode`, `thicknessNode`, `attenuationColorNode`, `attenuationDistanceNode`, `iorNode`, `dispersionNode`, `iridescenceNode`, `sheenNode`, `clearcoatNode` and others. `NodeMaterial` adds `backdropNode` and `backdropAlphaNode`, with the doc example `material.backdropNode = saturation( viewportSharedTexture().rgb, 0 )` — [MeshPhysicalNodeMaterial.js r185](https://github.com/mrdoob/three.js/blob/r185/src/materials/nodes/MeshPhysicalNodeMaterial.js); [NodeMaterial.js r185](https://github.com/mrdoob/three.js/blob/r185/src/materials/nodes/NodeMaterial.js)
- **Maturity (secondary sources, flagged).**
  - A 2026 Utsubo migration guide calls WebGPURenderer production-ready with automatic WebGL 2 fallback. It advises keeping a WebGL 2 path for Linux Firefox and iOS devices below A12, warns that in-app WebViews (Instagram, X, LINE, Facebook) can fail adapter requests, and says async `init()` is required — [Utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
  - An older post from the v0.170 era says it was "still marked experimental" — [svilenkovic](https://svilenkovic.com/3d/webgpu-three-js)
  - A May 2026 article treats it as the default — [vr.org](https://vr.org/articles/webgpu-baseline-2026-three-js-webxr-default)
  - A search-result claim that it has been "recommended since r171 (September 2025)" conflicts with npm, which dates r171 to 2024-11-29 — [npm registry](https://registry.npmjs.org/three)
- **A WebGPU glass example.** Codrops (8 Sep 2026): "Building an Infinite Liquid Glass Grid with Three.js, WebGPU, and TSL" — [Codrops](https://tympanus.net/codrops/2026/09/08/building-an-infinite-liquid-glass-grid-with-three-js-webgpu-and-tsl/)

### Inferences

- **Recommended shape on WebGL2 r185.** One owned `GlassMaterial extends MeshPhysicalMaterial`:
  - Replace `transmission_pars_fragment` and `transmission_fragment`, and add terms after `#include <lights_fragment_end>` or just before `#include <opaque_fragment>`.
  - Drive it from recipe defines (`GLASS_ENV_REFRACTION`, `GLASS_SCREEN_TRANSMISSION`, `GLASS_TRANSLUCENCY`, `GLASS_DISPERSION`).
  - Have `customProgramCacheKey()` return the recipe's feature flags and tier. The default `toString()` key would make every recipe that shares one closure share one program.
  - Pin `three`, and add a headless compile test for each recipe and tier, so a future chunk rename fails CI instead of failing in production.
- **CSM adds little here.** Its outputs can modulate transmission and thickness, but swapping the sample source still needs `patchMap` or chunk replacement. You would carry a dependency without avoiding the fragile part.
- **WebGPU is a rewrite, not a switch.** The GLSL injections do not carry over, so migrating means re-authoring in TSL (`backdropNode` or viewport mip textures, custom nodes). The WebGL 2 fallback runs on `WebGLBackend`, which also uses `WEBGL_multisampled_render_to_texture` (seen in r185 `WebGLBackend.js`), so its performance and look must be validated separately. For a production game in late 2026, staying on WebGLRenderer with a pinned version is the lower-risk choice. Keep the glass maths in plain functions so a later TSL port is mechanical.

### Gaps

- The official three.js manual page for WebGPURenderer returned 404, so no first-party stability statement was retrieved.
- I found no benchmarks comparing the WebGPURenderer WebGL 2 backend with WebGLRenderer for transmission.
- CSM's three.js version compatibility with r185 is not stated in its README.

## 5. Performance on mobile GPUs: cost of the transmission pass, scaling, resolution scale and cheap fallbacks

### Takeaway

The cost of built-in transmission scales mainly with opaque-scene complexity times capture resolution, not with the number of transmissive objects. All transmissive objects share one pass per camera. The pass costs a full re-render of the opaque scene into a 4x MSAA half-float target, then a resolve and a full mip chain every frame. Each transmissive pixel then pays 8 bilinear taps, or 24 with dispersion.

MTM-style materials cost one full scene render per instance, two with backside. That rules them out for shard showers. Low tiers should skip the pass entirely (`transmission = 0`) and use env-map refraction plus emissive or translucency terms.

### Cited Findings

- **One shared pass per camera.** It runs whenever any transmissive object is in the list. It re-renders the background and all opaque objects at viewport x `transmissionResolutionScale` into a target with at least 4 samples, half-float when supported, then resolves and mipmaps it — [WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js)
- **Per-pixel cost.** 8 `textureLod` taps per lookup (mipped bicubic), times 3 with `dispersion` — [transmission_pars_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)
- **DoubleSide extras.** On devices without `WEBGL_multisampled_render_to_texture`, each DoubleSide transmissive object costs one extra back-face draw, plus a second resolve and mip generation — [WebGLRenderer.js r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js); [GitHub #28131](https://github.com/mrdoob/three.js/issues/28131)
- **Draw calls double.** Jan 2023, Chaser_Code: "Transparent ans shadows are makes double drawcalls". drcmda: "MTM takes like 0.2ms on my system, MPM is consistently over 2ms, this i think is due to the smaller buffer". That is anecdotal, from one machine, in the r148 era — [three.js forum](https://discourse.threejs.org/t/draw-call-and-triangles-amount-increases-when-having-a-physical-material-with-transmission/46663)
- **MTM cost.** One extra full scene render per instance per frame, or two with `backside`. A shared `buffer` or `transmissionSampler` skips them — [MeshTransmissionMaterial.tsx](https://github.com/pmndrs/drei/blob/master/src/core/MeshTransmissionMaterial.tsx)
- **MTM performance thread, July 2024.** A single MTM mesh pushed a MacBook Air M2 to 100% GPU — [three.js forum](https://discourse.threejs.org/t/meshtransmissionmaterial-poor-performances-urgent/68566)
  - manthrax: DPR 1 is "roughly 4x performance".
  - drcmda: about 1.5 DPR is a mobile compromise. Lower `samples` and `resolution`. `transmissionSampler` shares three's buffer, but then transmissive objects cannot see each other. Use adaptive DPR via PerformanceMonitor.
  - Another user: a resolution as small as 32x32 for rough glass.
- Maxime Heckel: FPS "can drop significantly" as the sample loop grows. Cap DPR at 2 because some iPhones reach DPR 3 — [blog](https://blog.maximeheckel.com/posts/refraction-dispersion-and-other-shader-light-effects/)
- **Resolution scale.** `transmissionResolutionScale` has existed since r172 (2024-12-31) — [three@0.172.0 WebGLRenderer.js](https://cdn.jsdelivr.net/npm/three@0.172.0/src/renderers/WebGLRenderer.js)
- **Cheapest core fallback.** `CubeRefractionMapping` with `refractionRatio` on Basic, Lambert or Phong: one cube lookup, no pass — [envmap_fragment r185](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/envmap_fragment.glsl.js)

### Inferences

- **Suggested tiers.**

  | Tier | Approach                                                                                                                                                                                                                                                                                                  |
  | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Low  | No transmission pass anywhere (`transmission = 0` on every glass, which removes the pass and its doubled opaque draws). Use PMREM env refraction (one `textureCubeUV`) plus Fresnel reflection, emissive and translucency terms. FrontSide, no dispersion. Opaque or alpha-blended with `depthWrite` off. |
  | Mid  | Built-in transmission only where true see-through matters (clear crystal), at `transmissionResolutionScale` 0.5, which means a quarter of the pixels. Luminous recipes (amber, opal, frosted) stay env-based. FrontSide only, to avoid the back-face loop.                                                |
  | High | Scale 0.75 to 1. DoubleSide on whole vessels only, never shards. Dispersion on cut crystal. Optionally a Wyman-style back-face pre-pass for thick vessels.                                                                                                                                                |

- **Shards.** Keep all shards in the single shared pass (built-in) or on env-only materials. Never one MTM per shard, which would be N scene renders. Set shards to FrontSide, so 50 shards do not trigger 50 back-face draws and 100 `needsUpdate` toggles per frame on desktop.
- **Cost drivers.** Opaque scene complexity is re-rendered every frame the pass runs, so gallery rooms with heavy geometry pay twice. Frustum culling should keep off-screen transmissive objects out of the list, so the pass only runs when glass is in view. This is inferred from standard culling, not re-verified.
- **Roughness per tier.** Lowering the resolution scale makes rough glass blurrier (see question 1), so retune roughness per tier, or patch the LOD to be resolution-independent.

### Gaps

- I found no measured r185 transmission numbers on real phones (Adreno, Mali, Apple). The cost of mip generation on tile-based GPUs is unquantified.
- I found no data on which mobile browsers lack half-float render targets.

## 6. Real examples worth copying, and how Unreal and Unity do coloured and frosted glass in ways that transfer to WebGL

### Takeaway

The best-known three.js glass looks come from:

- the built-in transmission examples and the glTF TransmissionTest model;
- the FBO-and-refraction family: Maxime Heckel, Codrops multiside refraction, drei MTM;
- TSL viewport-texture work on WebGPU.

AAA engines handle coloured glass the same basic way: a thin translucent model that tints the background, plus screen-space refraction with absorption. Their Beer-style absorption maths is identical to glTF and three.js, so recipes transfer directly. None of the engine sources shows a built-in fix for "glass looks lit from within"; that needs extra energy terms or controlled backgrounds.

### Cited Findings

- **Official three.js examples.**
  - `webgl_materials_physical_transmission`, used to reproduce #28131 — [GitHub #28131](https://github.com/mrdoob/three.js/issues/28131); page [threejs.org/examples](https://threejs.org/examples/#webgl_materials_physical_transmission)
  - `webgl_loader_gltf_transmission`, updated in PR #22117 — [PR #22117](https://github.com/mrdoob/three.js/pull/22117)
  - `webgl_materials_subsurface_scattering`, which uses `SubsurfaceScatteringShader` — [SubsurfaceScatteringShader.js r185](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/shaders/SubsurfaceScatteringShader.js)
- The glTF **TransmissionTest** sample was used to compare r149 against r158 — [three.js forum](https://discourse.threejs.org/t/transmission-rendering-changed-with-version-r150/58866)
- **Maxime Heckel** (Jan 2023, updated Jun 2023): nine interactive playgrounds covering FBO, refraction, chromatic dispersion, specular and Fresnel. Demos exist at r3f.maximeheckel.com/refraction — [blog](https://blog.maximeheckel.com/posts/refraction-dispersion-and-other-shader-light-effects/); [demo](https://r3f.maximeheckel.com/refraction)
- **Codrops.**
  - Jesper Vos, "Real-time Multiside Refraction in Three Steps". It is older (pre-2023, exact date unverified); Heckel credits it for the backside technique — [Codrops](https://tympanus.net/codrops/?p=44326)
  - Matt Park, "Playing with Light and Refraction in Three.js: Warping 3D Text Inside a Glass Torus" (March 2025), MTM in R3F — [Codrops](https://tympanus.net/codrops/?p=89382)
  - "Building an Infinite Liquid Glass Grid with Three.js, WebGPU, and TSL" (8 Sep 2026) — [Codrops](https://tympanus.net/codrops/2026/09/08/building-an-infinite-liquid-glass-grid-with-three-js-webgpu-and-tsl/)
- **Unreal Engine Thin Translucent** (UE 4.25+) is a physically based model for tinted glass that draws white specular and the tinted background in one pass, where it used to need separate objects — [Epic: Shading Models](https://dev.epicgames.com/documentation/en-us/unreal-engine/shading-models-in-unreal-engine); [UE 4.25 tech blog](https://www.unrealengine.com/en-US/tech-blog/improved-shading-models-in-unreal-engine-4-25-and-beyond)
  - Setup: Blend Mode Translucent, Shading Model Thin Translucent, Lighting Mode Surface ForwardShading, and a Thin Translucent Material output that takes the tint colour.
  - It accounts for the air-to-glass-to-air bounces, and supports coloured translucent shadows.
- **Unity HDRP (docs version 7.1.8, old).**
  - Refraction models are Sphere, Box and Thin. Thickness applies to Box and Sphere; the Thin model implies 5 cm.
  - Transmittance Color tints the light, and Absorption Distance is the thickness at which that colour reaches full strength.
  - Absorption is derived as roughly -log(color)/distance, citing Burley's Disney BSDF notes.
    — [Unity HDRP Refraction (7.1.8)](https://docs.unity3d.com/Packages/hdrp/manual/Refraction-in-HDRP.html); [Unity HDRP Surface Type](https://docs.unity3d.com/Packages/hdrp/manual/Surface-Type.html)

### Inferences

- **Parameters map one to one.** HDRP Transmittance Color and Absorption Distance correspond to glTF and three.js `attenuationColor` and `attenuationDistance`; the formula is the same. HDRP "Thin" corresponds to three's `thickness = 0`, and Box or Sphere to a non-zero thickness ray offset. UE Thin Translucent is close to three's thin-walled transmission. Engine material notes therefore translate directly into recipe values.
- **What actually makes vessels glow.** In real galleries, glass glows because of display lighting: back-lit cases, uplights through plinths, bright backdrops. The shading equivalent is a translucency term keyed to a plinth uplight or spot, or an env-refraction "light box" studio. That is what the concept painting's warm, lit-from-within amber implies.
- **Clear-crystal reference.** For clear crystal, MTM-style jittered sampling with chromatic aberration is the best-looking reference in three.js. Its per-instance scene pass makes it suitable at most for a single hero vessel on the high tier, with a shared buffer.

### Gaps

- Current (v14 to v17) Unity HDRP refraction subpages returned 404 or only a contents page, so the screen-space refraction fallback order (probes or sky when the ray leaves the screen) is unverified.
- UE5 Substrate glass was not researched.
- These glTF Sample Assets look relevant but their names were not checked in this session: MosquitoInAmber, DragonAttenuation, GlassVaseFlowers, DispersionTest, DiffuseTransmissionTest, AttenuationTest, IORTestGrid. Check them in KhronosGroup/glTF-Sample-Assets.
