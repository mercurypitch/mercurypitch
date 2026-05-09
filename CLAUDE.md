# PitchPerfect — Claude Code Instructions

## Git Workflow

### Commit & Push Rule
**After completing any task that changes code**, always:
1. `git add -A && git commit -m "<message>"`
2. `git push origin <current-branch>`

Never leave uncommitted changes sitting in the working tree. Push immediately after commit.

### Branch Protection
- **Never push to `main`** — use feature branches and open PRs targeting `dev`
- **Never force push** — always use `git push` without `--force`
- **Never use `git reset --hard` to rebase** — always use `git rebase origin <branch>`

### Git Hooks
Repository hooks live in `.githooks/`. To install:
```bash
git config core.hooksPath .githooks
```

| Hook | Purpose |
|------|---------|
| `pre-receive` | Blocks direct pushes to `main` |
| `post-merge` | Auto-deploys via `deploy.sh --check-only` after `git pull` |

## Build & Verify
```bash
pnpm run typecheck   # TypeScript: tsc --noEmit
pnpm run build       # Vite production build
```

## Deploy
```bash
./deploy.sh              # Full deploy (pull + checks)
./deploy.sh --check-only # Syntax checks only, no pull
```

Live URL: https://pitchperfect.clodhost.com
Apache DocumentRoot: `pitch-perfect-repo/public/`
