# Repeated room planters — export comparison

Six actual `decor_crystal_planter` placements are rendered through the production
room decoration manager and compared with the previous individual-mesh approach.
The isolated arrangement makes all copies visible together; this is a prop
comparison, not a full-level screenshot or hardware frame-rate measurement.

The export keeps all 55,416 triangles across six placements while reducing six
draw calls to one. Both modes use the same transforms, materials, camera, lighting
and renderer. Mean absolute channel error is 0.000812 on a 0–255 scale; only
0.014% of channels differ, concentrated at rasterized edges. The inspected images
preserve the marble bases, leaves, flowers and translucent-looking authored fins.

Production batches stay within one authored room. Individual covered-solid
activation compacts their matrices and updates bounds. Unique painted surfaces,
planar mirrors, transparent/refractive materials, hidden source parts and skinned
or morphing props retain their individual lifecycle. Instance buffers are explicitly
disposed; geometry and material ownership stays with the scene/library.

Reproduce from the repository root with a local games-enabled Vite server:

```sh
GLASS_QA_URL=http://127.0.0.1:5525 node art/glass-adventure/proofs/asset-audit-2026-09-24/capture-static-decoration-batch.mjs
```

The focused helper, decoration-manager and museum tests pass: 14 tests across
three files. Package TypeScript validation passes. The broader final-head PR
gate remains authoritative after integration.
