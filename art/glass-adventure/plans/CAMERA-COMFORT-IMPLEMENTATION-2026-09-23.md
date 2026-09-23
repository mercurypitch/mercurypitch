# Camera Comfort Implementation Checkpoint

**Updated:** 2026-09-24
**Branch:** `feat/glass-museum-level-one` / PR 807
**Scope:** C1 camera and turn comfort only
**State:** implementation and focused verification complete; owner hardware feel pass remains

## Baseline evidence

The pre-change camera and visible Merc turns both applied their full maximum
turn rate on the first eligible frame. Two regression assertions were written
against that behavior before the response code changed:

```text
camera, first 60 Hz automatic-follow step:
  actual 0.046666666666666856 rad
  expected < 0.02 rad

Merc, first 50 ms visible-heading step:
  actual 0.30000000000000004 rad
  expected < 0.1 rad
```

Command used for the red baseline:

```bash
rtk timeout 120s pnpm --filter @irchiinnuss/glass-game exec vitest run \
  src/render/camera.test.ts src/render/merc.test.ts
```

The values equal the old hard caps exactly: `2.8 / 60` for camera follow and
`6 * 0.05` for Merc. Keyboard chords and touch-stick arcs both feed the same
world heading; the discontinuity was in the rendered heading response, not in
the shared movement acceleration.

## Implemented response

- `angular-response.ts` now owns the shortest-path angular response shared by
  the chase camera and Merc. It integrates at 1/240 second internally, clamps a
  delayed render update to 50 ms, and bounds both angular speed and angular
  acceleration.
- Camera follow keeps its existing 2.8 rad/s speed cap. The tunable smoothing
  value is the time used to derive its acceleration cap. Merc keeps a separate
  fixed 6 rad/s speed cap and 72 rad/s² acceleration cap.
- Manual orbit cancels angular follow velocity immediately. The existing quiet
  interval still gives manual input priority, after which follow returns from
  rest instead of resuming stale velocity.
- Challenge entry/exit, pause, respawn, recenter, and reduced-motion paths clear
  the response state at the same ownership boundaries that already controlled
  automatic follow.
- Movement acceleration, collision, gravity, jump impulse, and fixed simulation
  steps were not changed. A paired simulation test runs Gentle and Responsive
  cameras over the same moving jump and asserts identical complete player state
  and identical jump peak while the early camera headings differ.

## Development tuning surface

The development-only `Camera tuning` control is rendered inside the real
adventure host. It provides:

| Setting           |      Range | Default | Gentle | Responsive |
| ----------------- | ---------: | ------: | -----: | ---------: |
| Look sensitivity  | 0.40–1.80x |   1.00x |  0.80x |      1.20x |
| Follow smoothness | 0.08–0.45s |   0.20s |  0.32s |      0.12s |

The values persist through `GlassGameHost` under `camera-comfort:v1`, apply to
the live renderer, clamp malformed stored input, reset to defaults, and copy as
a small JSON preset. The panel has an owned visual surface, 44 px entry target,
bounded phone layout, short-height scrolling, and mouse/touch range controls.
Keyboard input remains digital; Look sensitivity applies only to pointer orbit.

## Preserved behavior

Focused tests cover the behavior that must remain stable:

- identical fixed-duration response at 30, 60, and 120 Hz;
- bounded first step and bounded 50 ms delayed frame;
- shortest-path wrap behavior without target overshoot;
- manual orbit priority and smooth automatic return;
- stable camera-relative movement basis and deliberate diagonal rebase;
- the same heading completion at near, default, and far zoom;
- pause, challenge presentation, respawn, and reduced-motion ownership;
- identical movement state and jump reach under different camera tuning;
- continuous touch-stick arcs remain on one movement basis.

The diagnostic attributes used by the browser regression expose rendered
camera yaw, rendered Merc yaw, requested travel yaw, and active tuning values.
They do not feed back into input, simulation, or rendering.

## Verification

Unit and integration command:

```bash
rtk timeout 120s pnpm --filter @irchiinnuss/glass-game exec vitest run \
  src/render/angular-response.test.ts src/render/camera.test.ts \
  src/render/merc.test.ts src/ui/camera-comfort.test.ts src/ui/input.test.ts
```

Result: **5 files, 52 tests passed**.

Final real-input browser command, on isolated ports 5733 and 6733:

```bash
rtk timeout 240s env BESIDE_CUE_E2E_PORT=5733 \
  pnpm --filter @irchiinnuss/beside-cue-app exec playwright test \
  e2e/glass-adventure-camera.e2e.ts --project=chromium-adventure \
  --grep 'camera presets|phone tuner'
```

Result: **2 @smoke tests passed**. The desktop case uses Playwright's real
mouse and keyboard paths. The phone case uses Chromium CDP touch dispatch for
both viewport orbit and an abrupt live-stick direction change. It also checks
that the open panel stays inside 390×844 and does not create page overflow.

Relevant workspace typecheck:

```bash
rtk timeout 180s pnpm beside-cue:typecheck
```

Result: **passed** for the shared packages, Glass Game, and Beside Cue app.
Targeted ESLint also passed for every changed TypeScript/TSX source and unit
test; the repository intentionally ignores the Playwright file in that lint
configuration.

## Rendered evidence

The proof set is in
`art/glass-adventure/proofs/camera-comfort-2026-09-24/`:

- `gentle-tuning.png` and `responsive-tuning.png` show the actual panel over
  the rendered museum with the stored values selected.
- `gentle-route.png` and `responsive-route.png` show the route after the same
  drag and keyboard sequence.
- `gentle.webm` and `responsive.webm` are matched 6.08 second review clips.
  Loading tails were removed and each action timeline was compressed to the
  same duration; frames were not synthesized.
- `manifest.json` records the viewport, exact preset values, render backend,
  and gesture sequence.

The screenshots were inspected at original 640×480 resolution. The museum,
Merc, controls, utility stack, announcement, and tuning panel all rendered;
this was not the state-only raster-suppressed smoke setup.

## Integration seams included at owner request

- `GlassAdventureProps.onRestart` can hand replay restart ownership to the
  campaign; without it, the existing fresh local replay behavior remains.
- `GlassAdventureProps.replayGoal` is forwarded into `AdventureVisit` for the
  owner's completion presentation work and is not interpreted here.
- The active settle-wave cycle count is forwarded to `VoiceChallengePanel` so
  three-cycle replay tiers do not retain two-cycle instructional copy.

## Touched files

```text
apps/beside-cue/e2e/glass-adventure-camera.e2e.ts
art/glass-adventure/plans/CAMERA-COMFORT-IMPLEMENTATION-2026-09-23.md
art/glass-adventure/proofs/camera-comfort-2026-09-24/*
packages/glass-game/src/render/angular-response.test.ts
packages/glass-game/src/render/angular-response.ts
packages/glass-game/src/render/camera.test.ts
packages/glass-game/src/render/camera.ts
packages/glass-game/src/render/glass-renderer.ts
packages/glass-game/src/render/merc.test.ts
packages/glass-game/src/render/merc.ts
packages/glass-game/src/ui/CameraTuningPanel.module.css
packages/glass-game/src/ui/CameraTuningPanel.tsx
packages/glass-game/src/ui/GlassAdventure.tsx
packages/glass-game/src/ui/camera-comfort.test.ts
packages/glass-game/src/ui/camera-comfort.ts
packages/glass-game/src/ui/input.test.ts
packages/glass-game/src/ui/input.ts
packages/glass-game/src/ui/useAdventure.ts
```

## Remaining owner review

No physical-device comfort claim is made from Chromium emulation. The owner
should compare Gentle, Default, and Responsive on one desktop mouse and one
phone, paying particular attention to rapid A/D reversals, a full touch-stick
arc, landing after a camera return, and the point at which follow resumes after
a deliberate orbit. Any selected values can be copied directly from the panel.
