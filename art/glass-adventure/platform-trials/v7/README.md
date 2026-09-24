# Cloudway Marble V7 — source-preserved delivery baseline

This directory preserves the accepted source-quality baseline for the Cloudway
Marble replacement. The selected 1K derivative is now integrated with V6
Frost/Glide and V3 Crackle in the [combined V7 runtime](runtime/README.md). The
V4 archive and immutable Meshy source are unchanged. `manifest.json` and the
original checkpoint describe the earlier standalone source-acceptance stage.

## Accepted production direction

The semantic reconstruction experiments established the failure boundary:
replacing complete fascia and arch bays with a clean shell visibly shifted the
source arches, interrupted corner connections, and introduced cut remnants
around ornaments. Those experiments are rejected and are not delivery inputs.

The review baseline instead keeps every source triangle, UV, transformed split
normal, arch, corner, foliage strand, relief, and pendant. It applies only the
reviewed V4 envelope fit, downsamples the provider base and normal maps from 4K
to 2K, packs the provider 2K metallic and roughness maps, converts textures to
WebP, and safely quantizes vertex attributes. There is no decimation, remesh,
flatten, face replacement, or decoder-bound geometry compression.

## Review artifacts

- Delivery GLB:
  `exports/delivery/cloudway-marble-v7-dense-baseline-delivery-2k.glb`
- Packed Blender source:
  `sources/cloudway-marble-dense-baseline-v7.blend`
- Matched clay/PBR views:
  `proofs/dense-baseline/matched-{clay,pbr}-{front,three-quarter,gameplay,top,side}.png`
- Delivery audit:
  `proofs/diagnostics/dense-baseline-delivery-audit.json`
- Actual Chromium/Three loader smoke:
  `proofs/diagnostics/dense-baseline-browser-loader-smoke.json`

The delivery contains 1,256,556 triangles in one shared prototype mesh. Its
44,277,888-byte payload requires no Draco, meshopt, or KTX2 decoder. Estimated
decoded cost is 30.47 MiB of indexed geometry plus 64 MiB for the three mipped
2K textures. This standalone 2K baseline remains archived; the
combined runtime uses the same geometry with reviewed 1K maps. Physical-tablet
performance remains an owner acceptance check, not a claim from this source audit.

## Rebuild

All long commands have explicit outer timeouts:

```bash
rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup \
  --python-exit-code 1 --python \
  art/glass-adventure/platform-trials/v7/production/build_marble_dense_baseline_v7.py
rtk proxy timeout 3000 bash \
  art/glass-adventure/platform-trials/v7/production/package_marble_dense_baseline.sh
rtk proxy timeout 900 env ALSOFT_DRIVERS=null blender -b --factory-startup \
  --python-exit-code 1 --python \
  art/glass-adventure/platform-trials/v7/production/audit_marble_dense_delivery.py
rtk proxy timeout 300 node \
  art/glass-adventure/platform-trials/v7/production/smoke_marble_dense_loader.mjs
```
