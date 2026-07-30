# CLAUDE.md

## Git Workflow

- Always work on feature branches, never push directly to `main`
- Name branches with a `feat/` prefix (e.g. `feat/mobile-nav`). Never use a
  `claude/` prefix
- Commit and push after every task
- Use `gh` CLI for issues and PRs (not WebFetch)
- Never force push
- Never add "Generated with Claude Code" or any Claude attribution (including
  `Co-Authored-By` / `Claude-Session` trailers) to commit messages, PR
  descriptions, or any other artifact

## Code Quality

- Always run `pnpm check` after making any code changes to ensure there are no TypeScript, ESLint, or formatting errors.

## Docs

- Some docs are **anchored**: they declare the source files they describe and
  carry a fingerprint of those files. See `docs/DOCS_SYSTEM.md` for the contract
  and `.claude/skills/docs-sync/SKILL.md` (`/docs-sync`) for the workflow.
- Read `docs/agents/context.json` before hunting through `docs/` by hand — it is
  the generated index of tracked docs, areas, verified commands, and known drift.
- After changing code, run `pnpm docs:check --since main`. If a doc you moved is
  flagged `MAJOR` or `BROKEN`, update it **in the same PR** and re-stamp it with
  `pnpm docs:anchor <doc>`. `MINOR` usually needs no edit.
- Never anchor a doc you did not read against the code. The anchor records the
  commit it was verified against, and that claim shows up in review.

## Guided Tours

- The full `/tour-check` browser walk (`pnpm run test:tours` via
  `.claude/skills/tour-check/SKILL.md`) is required only:
  - **before a prod release** (it is a step of `/prod-upd`), and
  - when a change **directly edits the tours themselves** — `Walkthrough.tsx`
    or `WALKTHROUGH_STEPS`/`PAGE_TOURS`/`PAGE_TOUR_CATALOG` in
    `src/stores/app-store.ts`.
- For other UI changes that touch tour-targeted surfaces (`data-tour` hooks,
  control bars, sidebar, settings panel), a lightweight check is enough:
  verify the affected `targetSelector`s still resolve (grep the selectors, or
  walk just the affected page's tour). Don't run the full two-viewport walk
  per PR — it's a release gate, not a per-change gate.
- Known pre-existing misses are tracked in the walker output; only NEW misses
  introduced by your change are blockers outside a release.
- Tours should cover ≥80% of a page's user-visible features — when adding a
  feature to a page with a tour, update the tour in the same PR.

## Tech Stack

- SolidJS + TypeScript
- Vite
- Web Audio API for audio processing
- Dexie.js for IndexedDB
