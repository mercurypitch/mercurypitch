# Cloudway laboratory kit

[Open visual catalogue](review.html) · [Task list](TASKS.md) · [Blender review](BLENDER-REVIEW.md) · [Integration spec](INTEGRATION-SPEC.md)

20 distinct single-object references were generated with the built-in ChatGPT image tool and visually inspected. `catalogue.json` retains every final prompt, output path and SHA-256. References are source art, not game models.

## Local review and authoring

The level studio is a separate private tool at
`<user-dotfiles>/besidecue/glass-adventure/tools/cloudway-level-studio/v1`.
It is not part of this public checkout or the application build. An optional
ignored symlink at `art/glass-adventure/level-studio/v1` preserves the owner's
existing local review URL and browser drafts. The studio exports bounded JSON
design specifications; the game consumes deliberately authored level data.

The catalogue's `vite.config.mjs` serves this review tree without HMR or watching.
Its explicit filesystem roots allow the creative source mount and optional
private studio only; set `CLOUDWAY_ASSET_ROOT` or `CLOUDWAY_STUDIO_ROOT` when
those locations differ. From an absolute checkout path stored in `GLASS_REPO`:

```sh
rtk proxy timeout 18000 "$GLASS_REPO/node_modules/.bin/vite" "$GLASS_REPO" --config "$GLASS_REPO/art/glass-adventure/cloudway-laboratory/v1/vite.config.mjs" --host 0.0.0.0 --port 5633 --strictPort
```

Open `/art/glass-adventure/cloudway-laboratory/v1/review.html`. The process stops
after five hours, terminal closure or Ctrl+C; an occupied port fails explicitly.

## First crossing playtest

The development route is `/glass-game/?layout=cloudway-laboratory`. It has its own
save identity and opens the compact first crossing directly. Production builds
ignore this development query. The longer 27-piece course study is retained as
authoring material, rather than presenting unfinished donors as accepted art.

When the accepted platform bundles are installed, check the following on a real
device:

1. Walk across the tiled arrival court and sing at the first vase. The marble
   seams should support Merc continuously; singing takes place on a static rest.
2. Watch the scroll bridge extend and retract, then cross it. Its visible deck
   and available footing must agree, including while Merc stands on the deck.
3. Use the safe rest before the crystal pair. The pink platform loses support
   two seconds after first contact; the purple platform allows four seconds.
   Jump over the deliberate gap between them. The ornate exterior should be
   replaced by matching separate shards when each platform breaks.
4. Fall once and retry. The checkpoint should recover Merc on safe footing and
   restore the moving and cracking platforms without a stall.
5. Break all three voice targets and use the marked exit. Approaching the exit
   before completing them must not finish the course.

Inspect the scroll etching, pink/gold surface and purple/gold surface at normal
play distance and the nearest camera. Report both appearance and responsiveness;
isolated desktop WebGL screenshots are not a claim about phone frame rate.

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

The development-only first crossing binds four reviewed GLBs: the scroll bridge,
instanced pearl rests, Rose Quartz and Amethyst. All are real Git LFS files under
`apps/beside-cue/public/games/cloudway-laboratory-v1/`; a clean checkout does not
need the private source archive to run them. Their full-resolution and bounded
exports have matched actual GLTFLoader/adapter/WebGL proofs. The cracking pair
preserves its original opaque exterior while intact; closed physical-glass shards
carry matching source surface detail when released. The review page also includes
matched Blender material and clay source proofs for all twenty donors. The other
sixteen donors remain source artwork awaiting their own finalization and runtime
acceptance. No production asset is approved merely because its provider job
succeeds.

| First-crossing delivery |      Bytes | Geometry triangles, including alternate states |
| ----------------------- | ---------: | ---------------------------------------------: |
| Scroll bridge           |  4,951,124 |                                        527,368 |
| Pearl rest              |  1,401,472 |                                        112,284 |
| Rose Quartz             |  9,491,080 |                                      1,173,816 |
| Amethyst                | 19,673,144 |                                      2,585,165 |

Triangle totals include the mutually exclusive intact/fractured meshes, not just
what one frame draws. The current exports retain their complete prepared topology
and use separately reviewed 2K WebP maps with Meshopt encoding. Original 8K color,
4K data maps, dense donors and full-detail exports remain in the source archive.
Hash and material inventories are in `production/reports/*-runtime-v1.json`.

## Source storage

Large files use the existing Proton Drive creative folder convention:

- Private alias: `<user-dotfiles>/besidecue/assets/glass-adventure/cloudway-laboratory/v1/`
- Resolved local storage: `~/Documents/root/5-Creative/besidecue/assets/glass-adventure/cloudway-laboratory/v1/`
- This checkout uses ignored `references` and `source-assets` symlinks into that location. Git contains prompts, hashes, receipts, code, and small WebP preview derivatives.
- The provider script writes dense models and PBR maps through `source-assets`; Blender masters, renders, turntables and animations must also use that source tree. Runtime assets accepted for shipping remain in the app repository.
- On another machine, restore these aliases or set `GLASS_SOURCE_ROOT`; source hashes must still match. Full-size catalogue links require the local source mount. A normal Git checkout still shows the small previews.

The 20 originals were copied with SHA-256 equality checked before replacing the local folder with a symlink. This verifies local storage; it does not prove that the Proton Drive client has finished uploading. The user requested highest source quality: Meshy 7.1 Ultra 4K geometry, 8K texture request, PBR, no remesh or polygon target. Inspect actual returned maps; an 8K request does not guarantee every auxiliary map is 8K. No source quality reduction is part of this batch.

## Dense-source delivery — 25 September 2026

All 20 requested source models are archived: 15,154,026 triangles in total, with 8K base-color maps and complete 4K normal/metallic/roughness maps. Every source GLB, map and provider preview was independently rehashed against its receipt. The 20 successful tasks cost 800 credits; the balance is 2,885. A zero-credit provider failure and its one successful retry are retained in the hourglass attempt history. Requested model 7.1 is recorded; Meshy does not echo that model identifier in these responses.

These are full-quality sources, with no automatic remesh, polygon target or decimation. Later runtime exports will be separate derivatives, compared against the source at the actual game camera and closest allowed inspection distance. Full-size original files, packed source projects and proof images remain under the Proton-linked `source-assets` directory.

All 20 packed Blender source masters now pass fresh-process reopen audits. Raw/review objects retain the same dense mesh data and all four full-resolution maps. The source catalogue exposes matched material and clay proofs for every model (120 saved views across three camera angles and two materials). These checks establish source preservation; semantic glass/fracture exports still require acceptance.
