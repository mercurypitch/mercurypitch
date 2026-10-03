# Singing Current material finish

The runner uses five authored optical recipes on existing hosts. This pass also
uses the existing warm cloudscape, brings the opening side pool into phone
framing, softens the gold/marble response and reduces the crystal interior's
emission so its rounded forms remain distinguishable from the shell.

| Finish               | Current use                               | Mapping                                                               |
| -------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| Champagne crystal    | Clear wall panes and thick platform shell | Panes use roughness/normal maps; shell retains scalar optics          |
| Amethyst cut crystal | W04 colored border                        | Scalar tint/attenuation; this donor has no UVs                        |
| Opal ribbon glass    | W08 colored border                        | Pale opal fallback plus restrained iridescence; this donor has no UVs |
| Etched frost glass   | W06 pane                                  | Normalized whole-pane UVs; clear center and rougher perimeter         |
| Celadon porcelain    | Existing terrace ceramic material         | Opaque glazed surface with shared maps                                |

`packages/glass-game/src/content/material-finishes.ts` owns the recipes and
texture IDs. `render/material-finishes.ts` applies them only to independently
owned materials with reviewed semantic names. Actual metre-scale host thickness
and existing charge emission are preserved. Missing required maps fail before
changing a material. Hosts without UVs explicitly use scalar fallbacks.

The renderer owns texture disposal. Leased walls and scenery materials borrow
the maps. Seven maps are uploaded for the current runner; the complete reusable
library has twelve 512px maps totaling 544,794 bytes. Seven RGBA8 mip chains are
approximately 9.33 MiB before driver overhead. No new render pass or geometry is
introduced. No collision, melody, scoring, timing or unlock rule changes.

## Provenance and authoring

The new maps are deterministic authored surface fields, with no baked lighting
or reflections. They are distributed under the repository's AGPL-3.0-or-later
license. Exact file hashes, dimensions and channel metadata are in
`apps/beside-cue/public/games/material-finish-v1/manifest.json`.

Seven editable Blender groups, packed `.blend` masters, production scripts,
five exported host examples and rendered comparisons are retained in the private
Glassworks production archive under `material-finish-v1`. Large originals stay
in its linked creative storage. This repository carries compact delivery files.

Existing source texture provenance remains in
`art/glass-adventure/v2/source-pbr/README.md`: ambientCG Marble004/Metal034 and
the Poly Haven Umhlanga Sunrise HDR are CC0. No paid texture pack was purchased
or redistributed. [ambientCG licensing](https://docs.ambientcg.com/license/) and
[Poly Haven licensing](https://polyhaven.com/license) support this delivery.

Blender procedural graphs are authoring sources, not browser shaders. The
portable contract uses supported physical material parameters and baked maps;
color is sRGB while roughness and tangent normals are linear data. See
[Blender Principled BSDF](https://docs.blender.org/manual/en/latest/render/shader_nodes/shader/principled.html)
and [Three.js physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html).

## Verification and remaining art work

Focused tests cover optical units, map color spaces, partial-bank failures,
borrowed texture ownership, exact delivery hashes and native asset inclusion.
Actual AMD/OpenGL browser runs at 390x844, 844x390, 768x1024 and 1440x900 passed
the opening pitch feedback, first three shatters, lane change and jump sequence
with no page or GL errors. These are desktop viewport checks, not physical-phone
performance certification.

This is a bounded material and opening-composition improvement. The broader
reference still calls for connected planted water edges and more substantial
W04 facets/W08 ribbons. Scalar optics cannot restore missing silhouette detail.
Those remain separate source-preserving art tasks rather than hidden claims of
completion in this material pass.
