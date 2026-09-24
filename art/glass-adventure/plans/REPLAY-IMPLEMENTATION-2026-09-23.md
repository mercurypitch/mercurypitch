# Authored replay challenges — implementation checkpoint

Part of approved roadmap item 6. This is implementation evidence, not owner
device acceptance. Work remains active on branch `feat/glass-museum-level-one`.

## Implemented foundation

- `core/replay-profile.ts` validates explicit required-exhibit overrides and
  resolves three current-gallery profiles without changing movement or capture
  confidence/freshness. A content/profile revision plus challenge signature
  identifies compatible evidence.
- `core/replay-progress.ts` keeps each profile's current attempt separate.
  Required encounters and exit must all be completed in that attempt. Saved
  discoveries/portraits are durable and union independently; old accuracy
  results do not grant a new difficulty tier. Changed signatures archive older
  earned clears without reusing their progress.
- `ui/replay-visit-host.ts` preserves the original save before migration, uses
  a visit lease to reject retired cleanup writes, and provides a compatibility
  exploration projection for existing hosts. Only isolated attempts certify
  new difficulty clears.
- First Light remains ungraded. First visits use the easy profile; completing
  it permits either harder tier. Existing completions also permit replay and
  previously earned Cloudway access remains available without fabricating new
  stars. Three-star replay goals replace accuracy as the new trial requirement.
- Hold goals use 2–3-second ordinary exhibits and a 5/7-second selected finale.
  Pair goals preserve the player's comfortable notes. Wave goals demonstrate
  the actual configured cycle count; references finish and fall quiet before
  scoring can begin.

## Completion and collection integration

- The in-run subtitle shows the selected challenge. The completion card awards
  one, two or three level stars; portrait accuracy is labelled A/B/C separately.
- Three existing full galleries have distinct collectible portraits and finite
  optional discoveries. Legacy completed saves recover their earned portrait,
  without inventing discoveries or harder-tier stars.
- The museum album presents owned/locked portraits, discoveries, level stars and
  four evidence-derived badges. Original artwork stories remain unchanged.
  Nested inspection restores focus after its inert parent becomes active again.

## Verification so far

- 45 focused tests passed: replay/migration, host leases, trial eligibility,
  voice session and reference audio. Includes duplicate exits, profile changes,
  failed evidence, old saves, no storage, and the longer three-wave reference.
- Eight browser tests passed on the real host: gallery switching/loading
  failures, legacy checkpoints/access, replay selection/resume/restart. Selector
  layouts checked at 320×740, 1024×768 and 1440×900. HTML dialog screenshots were
  inspected; WebGL drawing was disabled in this behavioral suite, so these do
  not claim rendered-world or device-performance proof.
- Subsequent focused run: 81 tests across replay, collection, reference audio,
  rewards and voice lifecycle passed, and the glass-game package typecheck passed.
- A real keyboard-driven final exit certifies a three-star isolated attempt
  exactly once, shows the separate portrait award and updates the album. Phone
  and tablet completion cards were captured. The collection browser case checks
  320/768/1440 widths, nested artwork, keyboard focus and return to replay.
- These HTML-focused tests deliberately suppress WebGL draw calls. They verify
  behavior and layout, not new portrait geometry or physical-device performance.
  Proofs are under `proofs/replay-2026-09-24` and `proofs/collection-2026-09-24`.

## Remaining integration and review

1. Inspect the three completion portraits in actual rendered scenes.
2. Review migration, profile entry and end-card behavior independently, then
   rerun only checks affected by findings. Run the PR gate on committed stages.
3. Continue current-gallery collections and optional finale work from the
   approved checklist. Legend/custom campaign difficulties remain an explicit
   later authoring choice; this batch ships no empty locked Legend controls.

Sources of truth: `APPROVED-POLISH-AND-PROGRESSION-2026-09-23.md` and
`REPLAY-DIFFICULTY-AND-LEVEL-STARS.md`. Preserve 3D art and save identities while
these UI and persistence changes are integrated.
