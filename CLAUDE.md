# CLAUDE.md

Agent instructions live in **[AGENTS.md](AGENTS.md)** — read it. This file is a
pointer so the two cannot drift apart.

Before exploring the codebase, read
**[docs/agent/INDEX.md](docs/agent/INDEX.md)** — a generated module map with
entry points for every feature, store and worker. It is cheaper than grepping,
and CI keeps it from going stale.

| Document                                                         | Read it when                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| [docs/agent/INDEX.md](docs/agent/INDEX.md)                       | Orienting, or looking for where something lives                   |
| [docs/agent/CONVENTIONS.md](docs/agent/CONVENTIONS.md)           | Writing code                                                      |
| [docs/agent/MISTAKES.md](docs/agent/MISTAKES.md)                 | Before a first change in an unfamiliar area                       |
| [docs/agent/REFACTOR-PLAN.md](docs/agent/REFACTOR-PLAN.md)       | Touching an oversized file                                        |
| [docs/agent/CODE-HEALTH.md](docs/agent/CODE-HEALTH.md)           | Deciding what to work on — measured state and hotspots            |
| [docs/agent/TESTING.md](docs/agent/TESTING.md)                   | Writing or reviewing a test                                       |
| [docs/agent/DEVICE-DEBUGGING.md](docs/agent/DEVICE-DEBUGGING.md) | Chasing a bug that only reproduces on a phone                     |
| [docs/agent/METRICS.md](docs/agent/METRICS.md)                   | Reading a metric, or adding a quality gate                        |
| [docs/agent/BUGS.md](docs/agent/BUGS.md)                         | Checking whether a defect is already known                        |
| [docs/agent/DOCS-AUDIT.md](docs/agent/DOCS-AUDIT.md)             | Before trusting `docs/plans/` — many "pending" plans have shipped |

The guardrails in full are in [AGENTS.md](AGENTS.md). The ones that must not
wait for that read:

- **Never test against production** — local or dev only.
- **Never push to `main`.** Branches use a `feat/` prefix, never `claude/`.
- **Bring a branch up to date by REBASING onto `main`, never by merging `main`
  into it.** A merge commit on a feature branch buries the change under
  someone else's work and makes the PR unreadable. Rebasing rewrites your own
  commits, so the push that follows needs a force — and
  **`git push --force-with-lease` is the expected way to do it.** Plain
  `--force` is not: the lease is what refuses to overwrite work that arrived
  while you were rebasing. Never rewrite a branch you do not own.

  ```bash
  git fetch origin main && git rebase origin/main
  git push --force-with-lease origin <your-branch>
  ```

- **Do not commit, push, open a PR, or merge unless asked.**
- **No Claude attribution** in commits, PR bodies, or any artifact.
- **No emojis** anywhere. Use an SVG icon component.
- **Run `pnpm check`** after any code change.
