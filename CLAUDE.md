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

## Guided Tours

- The full `/tour-check` browser walk (`pnpm run test:tours` via
  `.claude/skills/tour-check/SKILL.md`) is a **release gate only**: it runs
  **before a prod release** (as a step of `/prod-upd`) and never per PR —
  the two-viewport walk takes 20+ minutes.
- For any change touching tour-targeted surfaces or the tours themselves
  (`data-tour` hooks, control bars, sidebar, settings panel,
  `Walkthrough.tsx`, `WALKTHROUGH_STEPS`/`PAGE_TOURS`/`PAGE_TOUR_CATALOG` in
  `src/stores/app-store.ts`), a lightweight check is enough: verify the
  affected `targetSelector`s still resolve (grep the selectors, click them
  in a preview, or walk just the affected page's tour).
- Known pre-existing misses are tracked in the walker output; only NEW misses
  introduced by your change are blockers outside a release.
- Tours should cover ≥80% of a page's user-visible features — when adding a
  feature to a page with a tour, update the tour in the same PR.

## Tech Stack

- SolidJS + TypeScript
- Vite
- Web Audio API for audio processing
- Dexie.js for IndexedDB
