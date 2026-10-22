# Materials that survive glTF and read in three.js

The game is three.js r185. It clones every authored GLB material as it is
(`material-library.ts`), so what the GLB says is what renders. Sources and
measurements are in `art/glass-adventure/proofs/modeling-audit-2026-10-21/generators-research.md` § 4.

## How three.js draws glass

- Any visible transmissive material triggers one extra render per camera: the
  background and every **opaque** object, into a mipmapped target at
  `transmissionResolutionScale` (the game uses 0.5). Glass samples that target.
- Glass never sees other glass. A jade handle with transmission behind an opal
  body is invisible through it; an opaque gold band behind it shows. Design
  lines of sight with that in mind.
- Refraction is one interface: the ray bends at the surface and travels
  `thickness` (mesh units, metres here) before it samples; roughness picks a
  blurrier mip. Tint through depth comes from `attenuationColor` and
  `attenuationDistance`.
- Reflections of the environment carry most of the "glass" read. Smooth normals
  matter: refraction and highlights both follow the normal, so a faceted wall
  looks broken.
- Back faces: keep glass single-sided on closed shells (backface culling on).
  Double-sided glass renders differently on devices that have
  `WEBGL_multisampled_render_to_texture`.

## What the Blender 5.2.2 exporter writes

| Principled BSDF input               | glTF                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| Base Color, Metallic, Roughness     | core PBR                                                                                         |
| Transmission Weight above 0         | `KHR_materials_transmission`                                                                     |
| IOR (with transmission, if not 1.5) | `KHR_materials_ior`                                                                              |
| Coat Weight, Coat Roughness         | `KHR_materials_clearcoat`                                                                        |
| Thin Film Thickness and IOR         | nothing without the glTF Material Output group: add `KHR_materials_iridescence` in `optics.json` |
| (volume)                            | nothing without that group: add `KHR_materials_volume` in `optics.json`                          |

`scripts/gltf_finish.py` adds the blocks from `optics.json` after export and
refuses volume on a material without transmission. Procedural textures,
Subsurface and Glass or Refraction BSDF nodes are not exported at all: use
`bkit.materials.principled` only.

## Presets (`bkit.materials`) and the numbers that read

| Use         | Settings                                                                                                                       | Optics block                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Opal glass  | sRGB `#d7efe6`, roughness 0.10, transmission 0.62, IOR 1.47, thin film 420 nm, film IOR 1.55, sheen 0.6 `#dccbf2`, **no coat** | volume thickness 0.02, attenuation `[0.82,0.94,0.90]` at 0.3 m; iridescence 1.0, IOR 1.55, 100-430 nm |
| Clear glass | roughness 0.03, transmission 1.0, IOR 1.5                                                                                      | volume thickness 1-2 times the wall                                                                   |
| Cut faces   | the glass a touch rougher (0.14), transmission 0.8                                                                             | thickness 0.03                                                                                        |
| Gold        | metallic 1, sRGB `#e0b65e`, roughness 0.26-0.30; `textures.hammered_normal` for hand-worked gold                               | none                                                                                                  |
| Jade        | sRGB `#2f7d57`, roughness 0.24, transmission 0.08, IOR 1.61, coat 0.6; `textures.marbled` veins at one image per three tiles   | thickness 0.04, attenuation `[0.2,0.55,0.35]` at 0.05 m                                               |
| Marble      | sRGB `#efe9df`, roughness 0.34, coat 0.25                                                                                      | none                                                                                                  |

Pearl and texture:

- Sheen (`principled(..., sheen=0.6, sheen_tint='#dccbf2')`) exports as
  `KHR_materials_sheen`: a soft tinted glow toward grazing angles, the pearl on
  opal glass.
- Hammered gold is a normal map, not geometry (`craft-rules.md` § 13); the
  exporter then needs tangents.

Notes that cost a round to learn:

- A coat over a thin film hides the colour play: the film sits on the base
  specular layer. Leave coat off iridescent glass.
- Colours are picked from the concept's lit midtones, in sRGB; `materials.srgb`
  converts them to the linear values the sockets want.
- Jade with real transmission is invisible behind glass and costs the
  transmission pass; keep it near 0.1 so it reads as stone.
- A cut material per part: glass breaks into rougher glass, gold into gold,
  stone into stone.

## Checking

The matids panel shows which faces carry which material. The material panel
(Cycles) is a guide, not the truth: confirm glass in the runtime proof, where
milky glass can turn chalky and clear glass can vanish.
