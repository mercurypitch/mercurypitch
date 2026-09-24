# Cloudway layout auditions — implementation checkpoint

Date: 2026-09-24
Scope: current Cloudway trial route and scenery auditions only
Status: implemented; crescent selected for the current campaign trial

## Result

Three authored variants now reuse the proven Cloudway trial mechanics:

- **Crescent** follows a broad eastward arc around a planted floating landmark.
- **Ribbon** uses two broad S bends with wide recovery islands between them.
- **Terrace** alternates left and right sections, joined by straight recovery
  islands.

The candidates do not add campaign islands or chapters. The legacy
`CLOUDWAY_GLASS_RIBBON` export and its `cloudway-glass-ribbon` save identity are
unchanged. Development auditions use these separate identities:

```text
cloudway-trial-audition-crescent
cloudway-trial-audition-ribbon
cloudway-trial-audition-terrace
```

`CLOUDWAY_CURRENT_TRIAL` selects the polished crescent under the separate
`cloudway-trial-current-crescent-v1` identity. The current campaign trial now
uses that export deliberately, so existing progress is never interpreted as
progress on a different topology. Focused campaign assertions retain the
historical trial, chapter, island, image and legacy save identities.

## Preserved traversal contract

- Walk speed, run speed, acceleration, jump height and vertical platform
  profile remain the current trial values.
- Every authored void remains 0.5–0.6m along the route axis. Required landing
  overlaps remain at least 0.64m even at the terrace offsets.
- Frost, glide and crackle behavior values are unchanged. Only the glide's
  lateral translation follows each authored route shape.
- Arrival, frost recovery, both docks, crackle recovery and finale remain
  marked safe rests. All three voice encounters remain on static platforms.
- Fog remains 9m near / 14m far. The next route cues remain readable while the
  finale is concealed from arrival.
- The route is dressed with the accepted crystal planter recipe and existing
  floor inlays. Planters stay on outer platform edges; a small planted marble
  landmark remains outside the required movement line.

## Development entry points

```text
/glass-game/?layout=cloudway-crescent
/glass-game/?layout=cloudway-ribbon
/glass-game/?layout=cloudway-terrace
/glass-game/?layout=cloudway-current
```

`selectCloudwayLayout(layoutId)` returns the candidate, its route metadata and
its explicit save ID for tooling or future review. `cloudway-current` resolves
to the same selected export and save identity as the campaign; the existing
`cloudway` shortcut still resolves to the historical straight trial.

## Verification evidence

- Fixed timestep content proof: all three routes finish with all three voice
  encounters, every required platform visited and zero respawns at 60Hz and
  120Hz.
- Save proof: a frost recovery save with zero completed encounters restores on
  its own layout and resets to arrival when supplied to another audition.
- Browser keyboard proof: each layout crossed the three opening gaps, reached
  `cloudway-checkpoint-frost-catch`, persisted zero completed encounters,
  reloaded at that checkpoint and left the other two audition keys absent.
- Browser touch proof: the crescent crossed its first gap with simultaneous
  thumbstick and Jump pointer input.
- Rendered proof: each keyboard journey produced arrival and recovery images
  with real WebGL output. See
  [the proof index](../proofs/cloudway-layouts-2026-09-24/README.md).

Focused regression coverage also retains the original Cloudway traversal and
the existing Cloudway fog tests.

### Command ledger

```text
pnpm --filter @irchiinnuss/glass-game exec vitest run \
  src/content/cloudway-layouts.test.ts \
  src/core/cloudway-traversal.test.ts \
  src/render/cloudway-scene.test.ts --reporter=verbose
18 passed

pnpm --filter @irchiinnuss/glass-game check
passed

pnpm --filter @irchiinnuss/beside-cue-app exec tsc --noEmit
passed

BESIDE_CUE_E2E_PORT=5884 pnpm --filter @irchiinnuss/beside-cue-app exec \
  playwright test -c playwright.config.ts \
  e2e/glass-adventure-cloudway-layouts.e2e.ts \
  --project=chromium-adventure
4 passed

GLASS_RENDER_PROOF=1 (one isolated-port run per candidate)
crescent, ribbon and terrace: 1 passed each; six screenshots inspected
```

## Selection decision

The crescent is the current-trial candidate. It gives the route one strong
scenic gesture, keeps steering changes gradual, and frames the planted island
without hiding the dock or moving raft. Ribbon remains a useful development
comparison, but its recovery view asks for a stronger reversal. Terrace is the
most literal and mechanically clear, but visually repetitive.

The campaign now selects the current-trial export with an explicit isolated
progress identity. The `cloudway-current` development shortcut reaches that
same selection without an unlock prerequisite, while the legacy direct route
and its historical progress identity remain unchanged.
