# MercuryPitch — git hooks

Agent instructions are in [AGENTS.md](../../AGENTS.md); build and deploy
commands are in [DEPLOY.md](DEPLOY.md). This file covers only the local git
hooks, which are not documented elsewhere.

## Installing the hooks

```bash
git config core.hooksPath .githooks
```

| Hook         | Purpose                                                                   |
| ------------ | ------------------------------------------------------------------------- |
| `pre-commit` | Runs only `git diff --cached --check` for fast staged-whitespace feedback |
| `pre-push`   | Blocks direct pushes to `main`                                            |

The hooks deliberately do not format, lint, typecheck, test, build, or deploy.
Run `pnpm pr:prepare` and the relevant typecheck once per work item before its
first PR push; cloud CI is the complete code, test, and build gate after that.
The pre-push hook is only a convenience because local hooks can be bypassed.
GitHub's `MainProtection` ruleset must separately require pull requests and the
`PR Gate` status check; those repository settings are not installed from code.

## Rebasing

Use `git rebase origin/<branch>`. Never `git reset --hard` to reach the same
result — it discards local work with no recovery path.

`--force-with-lease` is acceptable when pushing a rebased branch. Plain
`--force` is not.
