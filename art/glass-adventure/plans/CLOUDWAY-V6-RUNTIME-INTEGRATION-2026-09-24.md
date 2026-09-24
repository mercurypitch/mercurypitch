# Cloudway V6 runtime integration — implementation checkpoint

Date: 2026-09-24
Scope: accepted Frost and Glide V6 assets in the current Cloudway platform kit
Status: verified historical integration; superseded by V7 combined delivery

V6 remains an archived production/proof stage. The accepted V7 kit adds the
exact dense marble and replaces this public bundle; it preserves these Frost and
Glide sources. Current runtime URLs and costs are recorded in the V7 manifest.
The browser specification was renamed `glass-adventure-cloudway-platform-kit.e2e.ts`
and now verifies the current public kit. Commands and hashes below are historical.

## Result

The accepted 2K Frost and Glide deliveries now ship in one combined GLB under
the existing logical asset ID `cloudway-platform-kit-v1`. The runtime keeps the
V3 Marble and three Crackle phase roots unchanged, replaces only the Frost and
Glide roots, and removes their obsolete V3 materials and textures before write.
No runtime loader or renderer contract changed.

```text
archived file: art/glass-adventure/platform-trials/v6/runtime/archive/cloudway-platform-kit-v6.glb
bytes: 44,046,324
gzip level 9: 36,090,287
SHA-256: 1c18c7a5e818346551fdadef6a091b848f19d0242092a14bf366d85a90b7930c
logical ID: cloudway-platform-kit-v1
```

The build consumes only these accepted sources:

```text
cloudway-platform-kit-v3.glb
  10,338,088 B
  e96bb26369cb037dffcfab3d0c71911dc7e872c2b8f766db8cb73599a6d51c62

cloudway-frost-v6-delivery-2k.glb
  26,829,112 B
  6a63fb71fc80319e13a8d783c0bb7788216615aefbb6690f28c3df7f6c72e0a0

cloudway-glide-v6-delivery-2k.glb
  12,889,480 B
  68eefd6f006a0d2b0d6c8fdad658974432a8fb2bf936b9830904be8d50e50a23
```

The 4K masters, accepted delivery GLBs and byte-identical superseded combined
kit remain development sources under `art/`. The public V6 duplicate was
removed after the V7 runtime replaced it.

## Preserved runtime contract

- The six direct roots retain their stable names: Marble, Frost, Glide and the
  three Crackle phases.
- Every root carries the exact box collider: 1.70m wide, 1.30m deep, 0.24m
  high, with top Y=0.
- The V3 Marble and Crackle geometry/material records compare exactly with the
  V3 source after a fresh import.
- V6 Frost retains 634,512 triangles. V6 Glide retains 147,250 triangles.
  There is no welding, simplification, decimation, or arbitrary resampling.
- Base-colour, normal, metallic-roughness and transmission maps survive the
  merge. The real renderer continues to create instanced meshes per repeated
  donor submesh.
- The combined kit uses `EXT_texture_webp` and `KHR_mesh_quantization`, both
  supported by the existing plain Three 0.185.1 `GLTFLoader`. It does not add
  KTX2, Meshopt or Draco decoder requirements.
- The route, movement, jump, platform behavior, fog and collision simulation
  code are unchanged.

The combined kit has 15 textures. Their full RGBA8 mip chains are estimated at
234,881,004 decoded bytes (224.0 MiB) before driver overhead. Of that,
201,326,576 bytes belong to the accepted V6 Frost and Glide deliveries and
33,554,428 bytes belong to the preserved V3 Marble maps. The 44.0 MB public GLB
is the transfer artifact; WebP does not reduce decoded GPU allocation.

## Validator and structural evidence

[`cloudway-platform-kit-v6-audit.json`](../platform-trials/v6/proofs/runtime/cloudway-platform-kit-v6-audit.json)
fresh-imports the public output, verifies its manifest hash and source equality,
and rejects missing roots, collider drift, topology changes, lost PBR maps, or
retained V3 Frost/Glide resources.

The Khronos validator reports zero errors and one warning in
[`cloudway-platform-kit-v6-validator.txt`](../platform-trials/v6/proofs/runtime/cloudway-platform-kit-v6-validator.txt).
That warning is the unchanged V3 Marble primitive's missing authored tangent
space. The V3 source has the same warning; the V6 replacement removes the two
equivalent warnings that belonged to the old Frost and Glide roots. Plain gold
pieces also retain informational unused tangent/UV notices.

## Real-game proof

The dedicated `@smoke` browser spec uses a 1024x768 real WebGL2 canvas with the
game's 48-degree exploration FOV. It verifies the exact served file bytes and
hash, observes actual `drawElementsInstanced` calls, and records no console or
page errors.

Keyboard input then proves both fitted surfaces against the actual simulation:

1. Merc jumps onto both V6 Frost pieces and settles at
   `cloudway-checkpoint-frost-catch`.
2. A validated checkpoint reload starts from that safe rest with zero completed
   encounters.
3. Merc walks to the west dock, waits for the moving surface's authored west
   dwell, jumps onto V6 Glide, and is carried by its 1.9m translation.
4. Merc runs to the authored east edge, jumps the 0.55m gap, lands on the east
   rest and reaches `cloudway-checkpoint-glide-east`.

The rendered review confirms the cyan Frost and emerald Glide boundaries remain
clear through the 9–14m sky fog, Merc's feet align with the unchanged collision
plane, and the dense donor detail does not clutter the next landing cue:

- [route overview](../platform-trials/v6/proofs/runtime/cloudway-v6-route-overview.png)
- [Frost gameplay close view](../platform-trials/v6/proofs/runtime/cloudway-v6-frost-gameplay-close.png)
- [Frost recovery rest](../platform-trials/v6/proofs/runtime/cloudway-v6-frost-recovery.png)
- [Glide gameplay close view](../platform-trials/v6/proofs/runtime/cloudway-v6-glide-gameplay-close.png)
- [Glide east-rest landing](../platform-trials/v6/proofs/runtime/cloudway-v6-glide-crossed.png)

## Save and campaign boundary

This asset integration does not reinterpret progress. The legacy
`CLOUDWAY_GLASS_RIBBON` remains `cloudway-glass-ribbon`. The selected crescent
candidate remains an explicit separate export and save identity:

```text
CLOUDWAY_CURRENT_TRIAL
cloudway-trial-current-crescent-v1
```

Campaign selection and any deliberate legacy-progress mapping remain with the
campaign owner. This slice does not edit campaign UI, input, movement or
simulation physics.

## Command ledger

```text
rtk timeout 300 node \
  art/glass-adventure/platform-trials/v6/production/build_runtime_kit.mjs
deterministic public GLB and manifest written

rtk timeout 300 node \
  art/glass-adventure/platform-trials/v6/production/audit_runtime_kit.mjs
passed

rtk timeout 300 pnpm --filter @irchiinnuss/glass-game exec vitest run \
  src/browser/assets.test.ts src/render/cloudway-platforms.test.ts \
  --reporter=verbose
9 passed

rtk timeout 300 pnpm --filter @irchiinnuss/beside-cue-app exec tsc --noEmit
passed

rtk timeout 900 env BESIDE_CUE_E2E_PORT=5904 \
  pnpm --filter @irchiinnuss/beside-cue-app exec playwright test \
  -c playwright.config.ts glass-adventure-cloudway-v6.e2e.ts \
  --project=chromium-adventure
3 passed on an isolated no-HMR server; screenshots inspected at original size
```

The local proof used port 5904 and `/tmp/cloudway-v6-smoke`; it did not reuse or
restart the owner server.
