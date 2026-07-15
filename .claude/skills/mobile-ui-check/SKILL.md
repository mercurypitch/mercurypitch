---
name: mobile-ui-check
description: Screenshot every exercise's setup and live-run screens at a phone viewport and auto-flag mobile layout regressions (content overflow, the floating Stop button overlapping metrics, a missing Start CTA) with scripts/audit-exercises-mobile.mjs. Use after ANY change to the shared exercise chrome (ExerciseShell, mobile-polish.css, exercises.css) or an exercise's active/idle view, or when asked to "check the exercises on mobile", "audit mobile views", or "are the drills OK on a phone?".
---

# /mobile-ui-check — audit the exercise UI on a phone viewport

Every drill renders through one shared shell (`ExerciseShell`), so a mobile
layout mistake there repeats across all ~18 exercises: content overflowing the
fixed canvas, the floating **Stop** button landing on an exercise's metrics
row, the recent-scores card staying in its absolute desktop corner, or a
missing **Start** CTA. Eyeballing every drill by hand is slow and easy to skip.
`scripts/audit-exercises-mobile.mjs` walks them in a real mobile browser,
measures those failure modes, and drops annotated screenshots + a JSON report.

## Steps

1. **Build and serve** a local-mode bundle (same rule as `/tour-check` — never
   point the audit at a prod-API build, it would create junk anonymous users):
   ```sh
   pnpm run build:tours
   pnpm dlx serve dist -l 3005 &
   ```
   `build:tours` builds with an **empty `VITE_API_BASE_URL`** so the app runs
   on the local Dexie adapter. For a quick iteration loop the Vite dev server
   works too — pass its URL via `BASE_URL` (see below).

2. **Run the audit** (idle screens only, or add `AUDIT_ACTIVE=1` to also start
   each drill and screenshot the running view):
   ```sh
   pnpm run audit:mobile                 # idle setup screens
   AUDIT_ACTIVE=1 pnpm run audit:mobile  # also drive the live runs (uses a fake mic)
   ```
   Env vars:
   - `BASE_URL` — app URL (default `http://localhost:3005`; use
     `https://localhost:3000` for the dev server).
   - `CHROMIUM` — chromium path; sandboxes often need
     `CHROMIUM=/opt/pw-browsers/chromium` (the script also falls back to it).
   - `OUT` — output dir (default `./mobile-audit`).
   - `ONLY` — comma-separated title substrings to limit the run, e.g.
     `ONLY="Slide,Pitch Hold"`.

3. **Read the output.** Each exercise prints `ok` / `WARN` / `FAIL`, and the
   run exits non-zero if any check fails (so it works as a CI gate). Every
   screen is saved to `OUT/NN-<slug>-{idle,active}.png`, with a
   machine-readable `OUT/report.json`. Open the screenshots to confirm the fix
   visually — the numbers catch overlaps, the pixels catch ugliness.

## What it checks

| Screen | Check |
| --- | --- |
| idle | no horizontal overflow inside the canvas |
| idle | recent-scores card is **in flow**, not the absolute desktop corner card |
| idle | a **Start** button is present |
| active | no horizontal overflow inside the canvas |
| active | the **Stop** control does not overlap any `*-metric-label` / `*-metric-value` |

## Notes & how to extend

- **Mobile rules live in `src/styles/mobile-polish.css`** under
  `@media (max-width: 768px)`, scoped to the `.is-idle` / `.is-active` state
  classes the shell sets on `.exercise-canvas-area`. Desktop and the live-run
  visualisers are intentionally left untouched — keep new mobile rules there.
- The probe keys off stable classes (`.exercise-canvas-area`,
  `.exercise-score-history`, `.exercise-idle-start`, `.exercise-btn-stop`,
  `*-metric-*`). If you rename those, update `probe()` in the script.
- To audit a **different surface** (e.g. the Guitar or Piano tab), copy the
  script and swap the tab locator + the per-view checks — the launch, seeding,
  and screenshot scaffolding are reusable as-is.
- `AUDIT_ACTIVE` starts a real run with a **fake microphone**
  (`--use-fake-device-for-media-stream`), so no human input is needed. The
  Sight-Singing active view shows a `detected: …` debug line that is
  `import.meta.env.DEV`-only and absent from the `build:tours` bundle.
