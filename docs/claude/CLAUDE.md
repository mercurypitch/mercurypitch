# MercuryPitch — git hooks

Agent instructions are in [AGENTS.md](../../AGENTS.md); build and deploy
commands are in [DEPLOY.md](DEPLOY.md). This file covers only the local git
hooks, which are not documented elsewhere.

## Installing the hooks

```bash
git config core.hooksPath .githooks
```

| Hook | Purpose |
|------|---------|
| `pre-receive` | Blocks direct pushes to `main` |
| `post-merge` | Runs `deploy.sh --check-only` after `git pull` |

## Rebasing

Use `git rebase origin/<branch>`. Never `git reset --hard` to reach the same
result — it discards local work with no recovery path.

`--force-with-lease` is acceptable when pushing a rebased branch. Plain
`--force` is not.
