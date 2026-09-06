# Brief A — the polish slice (5a–5e)

You are picking up slice 5 of Beside Cue's mini games in
`apps/beside-cue` of `mercurypitch/mercurypitch`. Read, in order:
`docs/games/handoff-2026-09-06.md`, `docs/games/slice-5-polish-to-v1.md`
(§1 and §2; check §5 for maff's answers, which override the defaults),
then `docs/games/glass-3d.md` §5.4, §7.1 and §8.

**Your scope**: steps 5a–5e of the plan, one PR each, in order, on
branches off `origin/main` named `feat/polish-5a-chip-calm`,
`feat/polish-5b-shatter`, `feat/polish-5c-reduced-motion-haptics`,
`feat/polish-5d-load`, `feat/polish-5e-gate`. Rebase-merge is maff's
call after he has tested each on his phone; you open the PR, report,
and wait. Do not merge.

**Files you own**: `src/games/glass3d/render/*` (stages and scenes),
`src/games/glass3d/world3d-config.ts`, `src/games/glass3d/dev/*`,
`src/games/glass3d/runtime/*`, `src/screens/games.css`. **Do not edit**
`src/games/glass3d/sim/locomotion3d.ts` or add files under
`src/games/glass3d/levels/shelf*` -- agent B owns those. If a step
needs a change there, say so in the PR and stop at that boundary.

**Per step, what done looks like**:

- 5a: every stage shows the Cabinet's chip (backend, fps, CPU ms, and a
  load breakdown: renderer init, Merc, ORT session, mic, first frame).
  Calm mode per P3, with a pure, tested decision function (when to
  halve, when to resume). The Cabinet gets the Hallway's vertical-FOV
  widening. Frame time before/after calm mode stated in the PR.
- 5b: the shatter timeline of §7.1 as DURATIONS (never frame counts),
  through `world3d-config.ts` and DevDials: hitstop, slow-motion ramp,
  camera shake (trauma squared), DPR drop to ~1.0 for the burst and
  restore, haptics via `@capacitor/haptics` (heavy on the crack, three
  decaying lights) with a `navigator.vibrate` fallback in the browser.
  Skip chromatic aberration and dust (P4). Tests pin the timeline's
  order and that a 30 fps clock plays it at the same wall duration.
- 5c: `prefers-reduced-motion` path per P6 in all worlds; the Line's
  and Hallway's haptics per P5. Verified in the pane with
  `resize_window` colorScheme/emulation or a media-query override.
- 5d: load time measured on the phone (maff reads the chip) before any
  change; then warm ORT and Merc's glb from the games list on
  `requestIdleCallback` (P7). Numbers before and after in the PR.
- 5e: the gate (P1, P2) run by maff with your instructions; you record
  the table in `slice-5-polish-to-v1.md` §2.3. Then P9, the fall's
  mitts, one pass in Blender through the MCP; keep what ships if it
  does not read better.

**Rules that bite** are in the handoff §4; the ones you will hit first:
run git from the repo root; wrap every long command in `timeout`; never
touch port 5199; keep the `.claude/launch.json` entries and stop only
your own ports; no emojis; no attribution lines; no timelines. Verify
with `vitest`, `tsc`, `eslint --no-warn-ignored`, `prettier`, and the
browser pane before claiming anything.

**Report** in the PR body: what changed, the numbers, what maff should
look at on the phone, and any decision you had to make that the plan
did not.
