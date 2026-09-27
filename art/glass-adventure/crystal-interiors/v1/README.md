# Crystal interior auditions v1

Owner review, 27 September 2026: keep these three effects as comparison studies.
They are **not the accepted final art direction**. The next pass should explore
organic branching light with visible depth inside a thicker crystal volume.
The current eight-centimetre scroll envelope is a specific study, not a
universal interior treatment for every platform.

Three bounded living-light studies share the same platform-local envelope:
`resonance-veins`, `frost-roots`, and `aurora-heart`. The runtime implementation
is generated from a stable seed, contracts every path by its full tube radius,
and batches each preset into one tube/ribbon draw; Frost adds one bounded sparkle
draw. No effect changes platform physics.

The runtime envelope is `{ width: 2.10, height: 0.08, depth: 2.10,
center: [0, -0.05, 0], inset: 0.006 }` in platform-local metres, with +Y up.
The scroll retracts along local X; the caller passes its visible length ratio to
the effect, which applies a centred X scale and a soft fade near zero length.

`createCrystalInterior` returns one owned root plus `configure`, `update`,
`reset`, `snapshot`, and `dispose`. Palette, intensity, speed, pause,
reduced motion, retraction, seed, and quality remain deterministic. The opaque
tone-mapped core remains visible through the accepted 98.5%-transmissive scroll
deck; optional frost sparkles never replace that core.

The measured readability pass uses millimetre-scale opaque cores with saturated
palette depth and a view-dependent bright edge. Frost's primary/branch diameters
are 11.152/7.616 mm in the production envelope. The browser proof matches the
game's 0.5 transmission-buffer scale, 0.9 exposure, and bright cloud backdrop.

Measured high/mobile costs are 840/480 triangles and one draw for Resonance
veins, 980/560 triangles and two draws for Frost roots, and 2016/1152 triangles
and one draw for Aurora heart. Every preset uses zero textures. Aurora's shader
drift is derived from measured envelope clearance and is capped at 0.00238
metres in the 8-centimetre shell.

The editable Blender master and full proof renders live under the ignored
`source-assets` mount, resolved by `GLASS_CRYSTAL_INTERIOR_SOURCE_ROOT` or the
local Proton Drive convention. Rebuild them without touching an open Blender
session:

```sh
rtk proxy timeout 1200 flock -w 1200 /tmp/glass-crystal-interiors-blender.lock env ALSOFT_DRIVERS=null blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/crystal-interiors/v1/author_crystal_interiors.py
```

The authoring master contains editable curves, explicit envelope guides, four
matched cameras, and emission/transform keyframes. The twelve earlier Blender
images remain historical pre-readability references and do not represent the
current tube widths. Browser proof uses the real Three.js module from
`packages/glass-game/src/render/crystal-interior.ts` and the accepted
`Cloudway_GiltScrollBridge_RuntimeV1` GLB. It verifies animated,
paused, reduced-motion, reset, and 36%-retracted frames through the physical
transmission deck under the production presentation settings. A second proof
enters `Frost roots` through the Creator
Gallery, waits for the real level and asset gate, and frames the installed
effect without changing renderer state or materials. See `proof-manifest.json`
for portable hashes and ignored creative-archive proof paths.
