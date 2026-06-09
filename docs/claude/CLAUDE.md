# MercuryPitch -- Claude Code Instructions

## Git Workflow

### Commit & Push Rule
**After completing any task that changes code**, always:
1. Run all checks: `pnpm run check`
2. `git add -A && git commit -m "<message>"`
3. `git push origin <current-branch>`

Never leave uncommitted changes sitting in the working tree. Push immediately after commit. Include tests and linting in the same PR/commit.

### Branch Protection
- **Never push to `main`** -- use feature branches and open PRs targeting `main`
- **Never force push** -- always use `git push` without `--force`
- **Never use `git reset --hard` to rebase** -- always use `git rebase origin <branch>`

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
pnpm run check          # Typecheck + auto-fix lint + auto-format (primary command)
pnpm run typecheck      # TypeScript: tsc --noEmit
pnpm run build          # Vite production build
```

## Deploy
```bash
./deploy.sh              # Full deploy (pull + build + verify)
pnpm run deploy:prod     # Deploy to Cloudflare Workers (production)
pnpm run deploy:dev      # Deploy to Cloudflare Workers (dev)
```

Live URL: https://mercurypitch.com
