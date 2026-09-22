# Cloudway pilot — The Glass Ribbon

Approved for implementation on 2026-09-21. This supersedes the production gate
in `CLOUDWAY-PLATFORM-TRIALS.md`. Work stays on `feat/glass-museum-level-one`,
PR #807; no merge or release is requested.

## First playable route

An optional outing from the first island, using Merc's existing controls and
voice challenges. Pearl clouds, gold-edged marble, celadon ice and opaline
platforms carry the approved concept into a real 3D scene.

1. Arrival: a generous marble landing, two short skippable instruction cards,
   and a familiar comfortable-note goblet.
2. Frost garden: two icy slabs with bounded sliding and a safe recovery landing.
3. Opaline crossing: one translating raft, obvious docking positions, then a
   static singing perch. Platforms carry Merc using the collision simulation.
4. Crackle ribbon: two warning-and-release tiles, introduced individually.
   Cracks and the rim communicate the deadline without requiring sound.
5. Safe finale: a familiar voice challenge, portrait and shimmering exit.

Target first visit: roughly 2–4 minutes, to be measured during playtesting.
All singing happens on stable ground. No collapse clock runs during permission,
calibration, reference playback, challenge cameras, pause or a hidden tab.
Falls return to a nearby safe checkpoint; already earned discoveries remain.

## Unlock and save meaning

The first landmass currently contains two chapters: First Light and Glassworks
Journey. First Light has no grading policy. For the pilot, complete First Light
and finish Glassworks Journey with three saved pitch stars. The generic rule is
completion for every chapter on the island, plus three saved stars for every
authored graded encounter. Missing chapters or malformed saves never unlock it.

These are the existing pitch-accuracy stars, including legitimately saved older
editions. They are not the proposed replay difficulty stars. Do not silently
change the grading model or label this a hard-mode achievement. Future replay
tiers need the separate versioned evidence migration in
`REPLAY-DIFFICULTY-AND-LEVEL-STARS.md`.

The trial has its own level/save ID, stays outside the main chapter sequence,
and never blocks later galleries. A development-only `?layout=cloudway` route
allows testing without fabricating earned stars. Normal campaign entry must
enforce the unlock, including when an entry callback is invoked directly.

## Variants deferred until current visual acceptance

| Variant                            | Route emphasis                                    | Voice placement                              |
| ---------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| The Glass Ribbon (this build)      | One example of frost, glide and crackle           | Static safe perches, comfortable holds       |
| The Opaline Ferry (follow-up)      | Two staggered rafts and broad docking terraces    | Low/high pairs on docks                      |
| The Frost Conservatory (follow-up) | Curved icy approach and optional crackle shortcut | Familiar gentle-wave lesson on solid islands |

Owner feedback on 22 September freezes all new levels until the current trial is pristine. See `CLOUDWAY-POLISH-2026-09-22.md`. Only the first route ships in this batch. Variants reuse authored behavior and
asset recipes; they do not fork the simulation. Timed singing, rival characters,
combat, new judges and legend difficulty remain separately planned.

## Runtime and asset gates

- One bounded simulation owns current platform transforms, collision activation,
  support deltas and warning states. Rendering reads that state.
- Static levels retain their existing movement. Ice affects grounded movement;
  it must not become uncontrolled skating. Jumping away from a raft is explicit.
- Authored gaps must stay gaps; ordinary museum seam forgiveness remains intact.
- Resetting a checkpoint resets nearby trial platform state deterministically.
- Use Meshy for the decorative platform donors, then finish in a dedicated Blender
  scene. Preserve guides, exact prompts, task receipts, raw donors, PBR originals,
  packed `.blend`, optimized GLBs and surface/origin measurements under
  `art/glass-adventure/platform-trials/v2/`.
- Landing surfaces match simple collision proxies. Inspect normals, hidden bevels,
  intersections, resting height and repeat resource sharing for this new family.
- Do not interrupt the user's existing compiled preview on port 5298. Publish a
  separate compiled acceptance snapshot when this route is ready.

## Implementation checklist

- [x] Confirm user approval, first-island membership and existing grading semantics.
- [x] Assign separate runtime, level/render and asset production ownership.
- [x] Produce and inspect Meshy platform donors; finish and archive Blender source.
- [x] Implement/test frost, translating support, crackle, reset and pause behavior.
- [x] Build the authored route and render platform behavior from simulation.
- [x] Add locked/unlocked campaign entry and development-only direct route.
- [x] Test movement, gaps, warnings, resets and voice safety in simulation.
- [x] Verify trial entry/leave preserves gallery saves in the browser.
- [x] Inspect compiled phone/tablet/desktop entry and playable scene.
- [x] Commit separate runtime, content/renderer and concise-copy stages.
- [x] Pilot head `816bcd02`: all 40 non-production checks passed. New polish-head CI is tracked separately.
- [x] Preserve production and test receipts; provide a stable HTTPS LAN test host.
- [ ] Owner acceptance of tablet pacing, jumps, voice sessions and sustained performance.

No known urgent blocker remained in the prior tested batch: PR #807 at
`d291c065c7c25a09abe6fcf035969c69c3551169` had 39 passing checks and one
production-only skip. Full museum asset optimization remains follow-up work;
the new platform family receives the asset checklist as part of this production.

## Implementation and local acceptance — 2026-09-21

- The actual eleven-platform route completes at 60 and 120 updates/second using
  movement, jumps, raft riding and three pitch-fed breaks, without teleporting.
  Both runs reach the exit without a fall. First-visit duration is still unmeasured.
- Unlock logic has six passing tests covering mapped island membership, gallery
  completion, two versus three stars, malformed saves and historical evidence.
- Runtime review added bounded side pushes, ceiling/headroom handling and safe
  checkpoint recovery if a moving slab pins Merc. Legacy static floors use a
  fast path. Eight focused files / 81 tests pass, including clock freezes through
  voice and shatter, and rejecting props on moving platforms until transform
  parenting exists. Runtime stage is committed as `728338dc`; route, renderer,
  entry UI, CI lane and playtest server are committed as `9946caba`. Short route
  notices follow at `a6bf3140`; the final production build was repeated afterward.
- Three Meshy donor families are archived. The packed Blender source and visual
  family/crackle proofs are built: marble, frost and glide, plus intact/warning/
  released crackle derivatives. The frost top artifact is repaired. Final runtime
  textures are 1K WebP; the runtime kit is 7,921,368 bytes. Final review caught
  inconsistent side-face winding in the six release shards. The packed source
  and export are corrected; all shards are closed, consistently wound and have
  positive world-space volume. Khronos validation has zero issues. The final
  runtime SHA is `05deefa049031550b3aa7897a6d7a3345718b2e10a7595a272ea513195bb9e3e`.
  Three 30-credit generations and three 5-credit remeshes used 105 Meshy credits.
- Renderer uses shared instanced submeshes and authoritative lifecycle progress.
  Warning, falling shards and reformation are implemented. Three actual-GL
  renderer snapshots cover the raft, warning and release with no page/asset errors.
  Root inspected the final pictures. These scripted snapshots complement the
  input-driven traversal tests; they do not measure physical-device performance.
- The combined mobile/shared typecheck ran; its sole failure was a runtime test
  using the old push-result shape. The runtime agent corrected it and package
  typecheck now passes. Root app typecheck and `pnpm pr:prepare` also passed.
  The final games-enabled production build passes and includes the corrected
  kit and concise captions directly. Its HTML/chunk/model hashes are preserved
  beside the compiled proof captures.
- New browser specification is included in the explicit adventure CI matrix.
  A restartable no-HMR LAN server script lives at
  `apps/beside-cue/scripts/glass-playtest.ts`; HTTPS LAN port 5300 started at
  21:20 UTC with a three-hour lifetime. The direct trial URL returned HTTP 200.
- Existing real-browser regressions pass: campaign 4, controls 5, solids 2
  (11 total). New trial requirement layout passes at 320/1024/1440px. A declined
  unlock recheck refreshes the card and releases the entry busy state; its browser
  regression passes. All three new browser entry/save tests pass. Compiled,
  actually rendered menu captures pass at 320/1024/1440px. Final compiled earned
  entry/save preservation passes again after caption polish, with a 1024px touch
  screenshot. See `../platform-trials/v2/proofs/compiled-entry/` and sibling
  `scripted-scene/` for reproducible captures and their distinct evidence scopes.
- Platform-family validation, source hashes, safe provider receipts, LFS coverage
  and the dynamic web/native asset inventory passed independent review. Model
  winding, hidden bevel/footprint issues and tangents were corrected in production.
  Full museum asset-quality work remains a separate backlog item.
