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

- Any change to the spotlight tours or the UI they target (`Walkthrough.tsx`,
  `WALKTHROUGH_STEPS`/`PAGE_TOURS` in `src/stores/app-store.ts`, `data-tour`
  hooks, control bars, sidebar, settings panel) must be verified with the
  `/tour-check` skill (`.claude/skills/tour-check/SKILL.md`), which walks every
  tour in a real browser via `pnpm run test:tours` (`scripts/walk-tours.mjs`).
- Tours should cover ≥80% of a page's user-visible features — when adding a
  feature to a page with a tour, update the tour in the same PR.

## Tech Stack

- SolidJS + TypeScript
- Vite
- Web Audio API for audio processing
- Dexie.js for IndexedDB
