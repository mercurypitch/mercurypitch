# CLAUDE.md

Agent instructions live in **[AGENTS.md](AGENTS.md)** — read it. This file is a
pointer so the two cannot drift apart.

Before exploring the codebase, read
**[docs/agent/INDEX.md](docs/agent/INDEX.md)** — a generated module map with
entry points for every feature, store and worker. It is cheaper than grepping,
and CI keeps it from going stale.

| Document | Read it when |
|---|---|
| [docs/agent/INDEX.md](docs/agent/INDEX.md) | Orienting, or looking for where something lives |
| [docs/agent/CONVENTIONS.md](docs/agent/CONVENTIONS.md) | Writing code |
| [docs/agent/MISTAKES.md](docs/agent/MISTAKES.md) | Before a first change in an unfamiliar area |
| [docs/agent/REFACTOR-PLAN.md](docs/agent/REFACTOR-PLAN.md) | Touching an oversized file |
| [docs/agent/DOCS-AUDIT.md](docs/agent/DOCS-AUDIT.md) | Before trusting `docs/plans/` — many "pending" plans have shipped |

The guardrails in full are in [AGENTS.md](AGENTS.md). The ones that must not
wait for that read:

- **Never test against production** — local or dev only.
- **Never push to `main`, never force-push.** Branches use a `feat/` prefix,
  never `claude/`.
- **Do not commit, push, open a PR, or merge unless asked.**
- **No Claude attribution** in commits, PR bodies, or any artifact.
- **No emojis** anywhere. Use an SVG icon component.
- **Run `pnpm check`** after any code change.
