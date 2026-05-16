# CLAUDE.md — mercurypitch-clod-second

## CRITICAL: Workspace Identity

**This is clod-second.** The active workspace is `/root/mercurypitch-clod-second`.

**NEVER** operate in `/root/mercurypitch-clod-first` — that is a separate, off-limits repository.

If you ever find yourself in a directory other than `/root/mercurypitch-clod-second`, switch back immediately.

## Git Workflow

- Always work on feature branches, never push directly to `main`
- Commit and push after every task
- Use `gh` CLI for issues and PRs (not WebFetch)
- Never force push

## Tech Stack

- SolidJS + TypeScript
- Vite
- Web Audio API for audio processing
- Dexie.js for IndexedDB
