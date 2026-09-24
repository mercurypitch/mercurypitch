# Cloudway scripted scene proof

These images validate the real Three.js renderer and final platform kit at fixed,
authored snapshots. They do not claim player-input traversal. Input-driven route
reachability is covered separately by
`packages/glass-game/src/core/cloudway-traversal.test.ts`, which walks the whole
route at 60 Hz and 120 Hz without teleporting or respawning.

The captured asset is `cloudway-platform-kit-v1.glb`, SHA-256
`05deefa049031550b3aa7897a6d7a3345718b2e10a7595a272ea513195bb9e3e`.
The three snapshots show the translating raft at its midpoint, the second
crackle tile in its warning phase, and the same tile halfway through release.
The exact snapshot payloads and renderer metrics are recorded in
`scripted-render-report.json`.

From the repository root, start the isolated no-HMR source server:

```sh
rtk timeout 600s node apps/beside-cue/scripts/glass-playtest.ts --port 5340 --host 127.0.0.1
```

In a second shell, run the capture harness from the repository root:

```sh
rtk timeout 240s node art/glass-adventure/platform-trials/v2/proofs/scripted-scene/capture-scripted-scene.mjs
```

The harness uses SwiftShader, asserts there are no page or asset errors, writes
the three PNGs and JSON report beside itself, then disposes the renderer and
browser. Port 5340 is temporary; it does not touch the stable preview servers.
