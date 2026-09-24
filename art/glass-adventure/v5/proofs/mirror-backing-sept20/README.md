# Selected mirror backing capture repair

The exact-pose before/after preserves the renderer, level, lighting, surface
geometry and quality settings. Excluding the selected frame instance during
reflection capture removes the jagged black diagonal. The outer frame remains
visible in the ordinary scene; other wall frames remain available in reflection.

The donor backing sits around local Z -0.0375 behind the reflective inset at
Z -0.01714. It intersects the virtual camera's oblique near plane. Surface
retriangulation and floor-art exclusion were disproved and are not in the fix.

Both captures report 92 draw calls, 641792 triangles and 110592 reflection-target
pixels, with no asset/page errors. These fixed-pose software-renderer images are
visual evidence, not device frame-rate or thermal measurements.

To reproduce the after capture against the local HTTPS preview from the repo:

```bash
rtk proxy env GLASS_PROOF_BASE=https://localhost:5187 GLASS_PROOF_POSES=art/glass-adventure/v5/proofs/mirror-backing-sept20/pose.json GLASS_PROOF_OUTPUT=/tmp/glass-mirror-recheck GLASS_PROOF_VIEWPORTS='[{"width":800,"height":600}]' timeout 180 node art/glass-adventure/v5/proofs/capture.mjs
```

The saved manifests retain the harness's original image filename; files here
have `before-` and `after-` prefixes to keep both passes together.
