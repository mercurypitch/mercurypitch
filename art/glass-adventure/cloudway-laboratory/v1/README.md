# Cloudway laboratory kit

[Open visual catalogue](review.html) · [Task list](TASKS.md) · [Integration spec](INTEGRATION-SPEC.md) · [Level studio](../../level-studio/v1/index.html)

20 distinct single-object references were generated with the built-in ChatGPT image tool and visually inspected. `catalogue.json` retains every final prompt, output path and SHA-256. References are source art, not game models.

## Provider production

The owner authorized uploads and credits. Scoped Proton Pass access was restored on 25 September 2026; the balance read 3,685 credits before this batch. Set `MESHY_CREDENTIAL_TEMPLATE` to the existing private scoped credential-template path (`<user-dotfiles>/irchiinnuss/secrets/meshy-mcp.env.tmpl`); never print its contents or export the key into the parent session. Per-asset receipts are the live production authority.

```sh
rtk proxy python3 art/glass-adventure/cloudway-laboratory/v1/production/produce.py prepare
rtk proxy timeout 240 pass-cli run --env-file "$MESHY_CREDENTIAL_TEMPLATE" -- python3 art/glass-adventure/cloudway-laboratory/v1/production/produce.py balance
rtk proxy timeout 240 pass-cli run --env-file "$MESHY_CREDENTIAL_TEMPLATE" -- python3 art/glass-adventure/cloudway-laboratory/v1/production/produce.py submit --asset gilt-scroll-bridge
rtk proxy timeout 900 pass-cli run --env-file "$MESHY_CREDENTIAL_TEMPLATE" -- python3 art/glass-adventure/cloudway-laboratory/v1/production/produce.py resume --asset gilt-scroll-bridge
```

Repeat for the exact catalogue IDs, with bounded concurrency and balance checks. Prepare is offline. An exclusive per-asset source lock serializes worktrees on this host. Submission records durable intent in the shared source receipt before POST and refuses duplication; the Git receipt is a sanitized mirror. Resume reads one existing task and archives it when complete, without submitting again. If POST is uncertain, use `reconcile` and compare safe task metadata before modifying the receipt. Model and texture URLs are used in memory only; archive files with hashes.

The official [Meshy Image-to-3D API](https://docs.meshy.ai/en/api/image-to-3d), checked 25 September 2026, supports `meshy-7.1`, `geometry_resolution:4k`, and `texture_resolution:8k`. Each request preserves dense geometry (`should_remesh:false`) and asks for PBR maps. The current pricing estimate is 40 credits each; provider consumed credits are the authority. No repeated charged regeneration without inspecting the first result.

## Blender and runtime acceptance

Inspect dense donors before reducing anything. The marble/opal tops must have a genuine planar contact surface, not a low-poly approximation hidden by a picture. Preserve the generated materials and silhouette; isolate high-to-low baking where justified. Keep full donor GLBs, PBR originals, and packed Blender masters.

- Scroll: split the two rollers and the deck; retract across the deck width, with anchored center and matching collision extent. Do not scale the entire decorated object.
- Rose pair: separate gold clasps and transmissive glass; prepare closed shards, a visible warning buildup, and atomic intact-to-broken swap. Fast lifetime 2 seconds, slow 4, measured from first contact to loss of support.
- Stair module: three physical treads with matching independent support bounds.
- Doorway: frame stays solid while the separate glass pane fractures.
- Goblet/vases: hollow mouths and meaningful thickness; do not treat painted opacity as a finished glass shader.
- Mirror: separate frame and optical surface; reuse the existing bounded reflection implementation.
- Basin: model is intentionally dry; water is a runtime surface/effect.
- Repeated props: batch compatible geometry/materials by visible region; retain picking identities.

The runtime adapter is pending actual model inspection. No production asset is approved merely because its provider job succeeds.

## Source storage

Large files use the existing Proton Drive creative folder convention:

- Private alias: `<user-dotfiles>/besidecue/assets/glass-adventure/cloudway-laboratory/v1/`
- Resolved local storage: `~/Documents/root/5-Creative/besidecue/assets/glass-adventure/cloudway-laboratory/v1/`
- This checkout uses ignored `references` and `source-assets` symlinks into that location. Git contains prompts, hashes, receipts, code, and small WebP preview derivatives.
- The provider script writes dense models and PBR maps through `source-assets`; Blender masters, renders, turntables and animations must also use that source tree. Runtime assets accepted for shipping remain in the app repository.
- On another machine, restore these aliases or set `GLASS_SOURCE_ROOT`; source hashes must still match. Full-size catalogue links require the local source mount. A normal Git checkout still shows the small previews.

The 20 originals were copied with SHA-256 equality checked before replacing the local folder with a symlink. This verifies local storage; it does not prove that the Proton Drive client has finished uploading. The user requested highest source quality: Meshy 7.1 Ultra 4K geometry, 8K texture request, PBR, no remesh or polygon target. Inspect actual returned maps; an 8K request does not guarantee every auxiliary map is 8K. No source quality reduction is part of this batch.
