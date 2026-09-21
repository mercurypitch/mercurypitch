# Glassworks — approved production pass

Updated 2026-09-21. Owner authorized stages 1–4, review and commits/pushes between
stages to existing draft PR #807. The order below is the working sequence;
independent production and audits can run in parallel. No merge or publication.
Existing static playtest builds remain unchanged until a new build is ready.

## Baseline

- Owner accepted First Light, Glassworks Journey, Twin Galleries and the latest
  mirror, artwork-header and exit-floor polish.
- Baseline `20caf8cc`: 34 successful PR checks, zero failures when checked for
  this pass. Physical-device sustained FPS/thermal measurements remain separate.
- The four stages below are not complete merely because this plan exists.

## 1. Finish Twin Galleries production

- [x] Amber Cadence Urn: valid donor, hollow cavity, fracture, packed Blender
      project, materials, dimensions, topology and reconstruction receipts.
- [ ] Celadon Lark Decanter: same production gates; preserve rejected remeshes.
- [x] Integrate the approved Amber derivative with catalog/native mappings,
      exact source/public checksums and unchanged encounter/save identities.
- [ ] Integrate Celadon only after its replacement passes the same gates.
- [x] Amber intact/shatter renders, focused tests and bounded render-cost
      evidence; software versus physical-device evidence is labeled.
- [ ] Repeat the production/render gates for the replacement Celadon.
- [ ] Commit and push this stage; record commit and CI result here.

Meshy produces modeled donors; Blender prepares production forms. Do not weaken
topology checks just to finish an asset. Keep sources and derivative provenance.

## 2. Rewards and portrait pilot

Pilot: Glassworks Journey. Singing quality and exploration are separate.

- [x] Data-owned reward configuration, finite once-per-exhibit discovery coins.
- [x] Confidence/freshness-aware, capture-time-weighted 1–3 singing stars;
      insufficient reliable evidence is ungraded. No loudness or callback-count
      scoring. Document and test thresholds.
- [x] One original collectible portrait, earned on successful final required
      exhibit and persisted before departure. Stars never gate the route or
      portrait. Replay preserves personal bests and cannot duplicate coins.
- [x] Backward-compatible save parsing; old completions never invent grades.
- [x] One optional glazed artwork/window pilot with safe approach, retained
      artwork/frame and consistent visible/collision state after breaking.
- [x] End card shows stars, discoveries and portrait separately; phone/tablet
      layout, reload, replay and cancellation evidence.
- [x] Commit and push this stage; record commit and CI result here.

Checkpoint: `25dbb403`, pushed to PR #807. Focused tests 25/25; phone/tablet
UI proofs in `../rewards-pilot/v1/proofs/manifest.json`. CI remains authoritative.

No microphone recording, playback of recorded voice, cloud sharing, spending
economy or journey-map implementation belongs to this pilot.

## 3. Resonance Conservatory

- [x] A typed settle-then-gentle-wave lesson with a capture-clock judge.
      A steady hold, silence, stale observations, abrupt jumps and tracker
      jitter must not count as a pitch wave.
- [x] One encounter verified before extending the route. Comfortable calibrated
      pitch, clear demonstration, resting/retry with no lives or forced speed.
- [x] A handcrafted garden wing assembled from reusable rooms and exhibits,
      distinct pacing/decor, checkpointed lesson progression and optional finds.
- [x] Shared campaign entry, tutorial and host mappings; no level-ID branches
      in gameplay. Test traversal, voice lifecycle and independent saves.
- [x] Commit/push and provide device singing test instructions. Automated
      evidence is not a substitute for owner microphone acceptance.

Checkpoint: `d2c6af3d`, pushed to PR #807. Reviewed judge/authoring/course
suite 43/43; synthetic-microphone UI proofs at phone/tablet sizes are saved
under `../v7-conservatory/proofs/`. Physical microphone acceptance remains open.

## 4. Shared web/native delivery

- [x] Audit and finish MercuryPitch entry/CTA into the shared campaign.
- [x] Verify selected-gallery loading, asset failure/retry, durable saves,
      background/resume and audio ownership across hosts.
- [x] Verify offline/native asset packaging and games-enabled Android/iOS build
      routes while preserving the intentional games-off store profile.
- [x] Exercise available build/browser gates; name actual SDK/device limitations
      and provide install/test artifacts where the environment supports them.
- [ ] Final PR review, relevant CI, stage commit/push and handoff.

Implementation checkpoint: `35637b54`, pushed to PR #807. Root/browser delivery
proofs are in `../delivery/v1/proofs/manifest.json`. Native CI produced the
Android debug/instrumentation APKs and unsigned iOS Simulator app at `fa214b25`;
exact artifact IDs, hashes and limitations are in
`../delivery/v1/proofs/native-ci-checkpoint.json`. Both native jobs completed
successfully. Final-head CI and live-map integration checks remain open.

## Backlog: the museum journey map

See [JOURNEY-MAP-AUDITION.md](./JOURNEY-MAP-AUDITION.md). Generate three visual
directions now and let the owner audition them while the four stages proceed.
Owner selected A, Floating Museum, and then authorized a live 3D map with modeled
islands, animated waterfalls and ambient sound after these four stages finish.
B/C stay archived. Research/export budgets and implement that follow-up only
after the agreed stage work; do not substitute a static image backdrop.

## Progress log

- 2026-09-21: production, reward implementation and delivery audit started in
  parallel; map concepts requested with built-in image generation.
- 2026-09-21: three map auditions saved and pushed in `732c2455`; A selected.
  User authorized live map production as the next follow-up after stages 1–4.

## Resume rule

Read this checklist, current Git status and the stage evidence before resuming.
Only mark completed work with its source paths/tests/commit. Preserve owner
changes and active agents' ownership; root owns review and Git operations.

- 2026-09-21 checkpoint `e2279942`: Amber runtime/source/16-shard production
  and shared neutral asset catalog pushed. Celadon rejected donors remain
  preserved; a clearer opaque modeling guide is being tried as a new input.
- 2026-09-21 checkpoint `25dbb403`: rewards pilot pushed; no physical voice
  recording or sharing was introduced.
- 2026-09-21 checkpoint `d2c6af3d`: Conservatory lesson and route pushed.
  Final review corrected exact two-wave completion and impossible authored
  speed/period bounds.
- Shared delivery browser/build checks pass. Review found and fixed LFS-pointer
  and per-file native sync integrity gaps: staging rejects pointers, schema 3
  stamps all required hashes, Capacitor sync verifies copied bytes, and Android
  verifies them again during asset merging. Focused staging/native tests 13/13.
  Selective CI hydration excludes raw art and Blender sources. No games-enabled
  Android/Xcode build success is claimed until the new CI jobs run.
- Latest Conservatory CI passes Beside Cue/typecheck and mobile store builds.
  Follow-ups are pushed: proof-script formatting in `35637b54`, and four-chapter
  catalogue/durable replay-save assertions in `b0bcc9c9` (browser specs 9/9).
- Celadon opaque guide is prepared. Automatic approval review blocked its
  upload to Meshy pending exact-payload confirmation; no new job or credit was
  submitted. Keep the currently integrated fluted decanter until an approved
  replacement passes the same production gates. Local map LOD preparation may
  continue independently while that answer is pending.
- The approved live-map follow-up is being built from the already approved
  local model kit while the independent Celadon upload remains pending. This
  does not mark the outstanding Celadon production gate complete.
- `ce2841bd` fixes repeated HTML formatting failure at its source: the museum
  entry is generated by Vite like the other SEO entries and must stay untracked.
  Entry-model tests 10/10. `fa214b25` preserves the reviewed live-water module,
  6/6 focused tests and real-render motion/reduced-motion evidence. Map assembly,
  lifecycle review and full-host visual acceptance are still in progress.

- `2b550a71` preserves the packed map kit, seven named reusable model groups,
  6.83 MB GLB and matching source/public hashes. Existing approved Meshy models
  were simplified and assembled in Blender; rejected Celadon inputs were not
  substituted into production.
- `d398b3e0` fixes the optional Conservatory wave guidance lint gate. Its
  games-enabled Android and iOS Simulator jobs also succeeded. The remaining
  Home destination-order browser assertion was fixed in `69a25078` and its
  focused real-browser check passed. Live-map integration gets its own CI.

- `f0d0c68a`: shared live map integrated, with compiled phone/tablet/desktop
  proofs, 421 package tests, focused mouse/touch/recovery browser cases and
  construction rollback. A static HTTPS preview is available without HMR.
  This completes the first map implementation, not the outstanding Celadon
  production replacement or physical-device acceptance. Current-head CI is
  still running after push; no merge or release has occurred.
