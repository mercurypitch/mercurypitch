# CLAUDE.md

## Git Workflow

- Always work on feature branches, never push directly to `main`
- Commit and push after every task
- Use `gh` CLI for issues and PRs (not WebFetch)
- Never force push
- Never add "Generated with Claude Code" or any Claude attribution (including
  `Co-Authored-By` / `Claude-Session` trailers) to commit messages, PR
  descriptions, or any other artifact

## Code Quality

- Always run `pnpm check` after making any code changes to ensure there are no TypeScript, ESLint, or formatting errors.

## Tech Stack

- SolidJS + TypeScript
- Vite
- Web Audio API for audio processing
- Dexie.js for IndexedDB
