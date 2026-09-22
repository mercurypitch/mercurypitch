# Cloudway platform kit v3 review candidate

This directory is an isolated visual-quality repair of the current Cloudway
platform kit. It does not replace the public game asset. The candidate starts
from the original textured Meshy donors archived in `../v2/meshy/`, retains
roughly 35,000–40,000 triangles per unique shell. The source-quality review
file keeps every PBR atlas at 2K; the delivery derivative keeps 2K base color
and uses 1K normal/metallic-roughness maps without reducing geometry.

The broad walkable part of each original donor landing is flattened onto the
gameplay datum while preserving its UVs and PBR material, and remains visible.
A narrow gold boundary marks the exact 1.70m x 1.30m collider, so the authored
marble veining, celadon, crystal, inlay, and foliage are no longer hidden under
an opaque procedural slab. The three crackle roots and their shard behavior are
unchanged from the validated v2 contract.

The six root names remain:

- `Cloudway_Marble`
- `Cloudway_Frost`
- `Cloudway_Glide`
- `Cloudway_Crackle_Intact`
- `Cloudway_Crackle_Warning`
- `Cloudway_Crackle_Release`

## Rebuild the review candidate

Run from the repository root:

```sh
rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v3/production/build_platform_kit_v3.py
rtk bash art/glass-adventure/platform-trials/v3/production/optimize_platform_kit_v3.sh
rtk bash art/glass-adventure/platform-trials/v3/production/optimize_platform_kit_v3_runtime.sh
rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/platform-trials/v3/production/validate_platform_kit_v3.py
rtk python3 art/glass-adventure/platform-trials/v3/production/build_comparison.py
```

`exports/cloudway-platform-kit-v3.glb` is the 42.9 MB source-quality ceiling.
`exports/cloudway-platform-kit-v3-runtime.glb` is the 10.3 MB delivery file.
The packed `.blend`, Blender GLB, both optimized GLBs, manifests, proof renders,
and technical validation all remain under `v3/`. Public integration is
intentionally deferred until visual review.
