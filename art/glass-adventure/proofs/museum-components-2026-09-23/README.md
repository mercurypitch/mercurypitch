# Museum component comparisons

`baseline/` records the accepted V7 central balcony surrounded by the older V4
temple/tree meshes and the V6 Conservatory retained in V7. The screenshots use
the real application and actual WebGL drawing on the local AMD GPU. Each model
response is checked byte-for-byte against the local public file and hashed.
These are appearance checks, not tablet performance measurements.

The capture script selects Twin Galleries and Resonance Conservatory through
their projected map markers, resets the view between them, and zooms fully in.
Its manifest records the resulting camera, viewport, renderer and scene costs.
Run it against a newly restarted stable QA server so Vite's disabled watcher
cannot leave old catalog modules in memory:

```sh
rtk proxy timeout 180 /home/maff/.nvm/versions/node/v22.22.2/bin/node /home/maff/.codex/worktrees/00ad/mercurypitch-agent/art/glass-adventure/proofs/museum-components-2026-09-23/capture-museum-components.mjs accepted
```

The default QA URL is `http://127.0.0.1:5341`. Override it with `GLASS_QA_URL`.
Use a new output label for a new candidate; preserve the baseline.

Archived model sources remain available if public versions are replaced:

- V4: `art/glass-adventure/journey-map/v4/exports/floating-museum-twin-finish-kit-v4.glb`.
- V7: `art/glass-adventure/journey-map/v7/exports/floating-museum-architecture-kit-v7.glb`.

No draw calls, textures, materials or shadows are suppressed for these proofs.
