# Shorter Cloudway reveal range

The fog starts at 9 metres from the camera and reaches the painted sky at 14
metres, replacing 16–31 metres. At the authored view the next two route cues
remain clear, while later platforms fade away. Orbit and zoom still affect the
exact reveal because this is continuous radial fog, not a fixed platform count.

Five actual WebGL2 / SwiftShader views are saved: arrival, raft approach,
midroute, wide oblique zoom-out and close oblique zoom-in. The manifest records
the camera, viewport, asset hashes and empty browser error lists. Seeded
checkpoints are appearance evidence; these captures do not prove route traversal
or tablet frame rate. The next raft and crackle warning remain visibly readable.

Verification passed on Node 22:

- `cloudway-scene.test.ts` and `backdrop-fog.test.ts`: seven tests.
- Glass-game TypeScript check, targeted ESLint and Prettier.
- Capture script syntax and five real rendered views, independently reviewed.

The capture script defaults to HTTP port 5340. Start a fresh local server after
editing constants because the stable preview has watching disabled. Use
`CLOUDWAY_PROOF_URL`, `CLOUDWAY_PROOF_OUTPUT` and `CLOUDWAY_PROOF_LABEL` to record a
new comparison without overwriting this accepted set.
