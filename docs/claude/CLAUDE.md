# MercuryPitch — Claude Code Instructions

## Git Workflow

### Commit & Push Rule
**After completing any task that changes code**, always:
1. Run all checks: `pnpm run lint && pnpm run test:run && pnpm run typecheck && pnpm run build`
2. `git add -A && git commit -m "<message>"`
3. `git push origin <current-branch>`

Never leave uncommitted changes sitting in the working tree. Push immediately after commit. Include tests and linting in the same PR/commit.

### Branch Protection
- **Never push to `main`** — use feature branches and open PRs targeting `main`
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

## Runtime Error Detection Workflow (after every code change)

1. **Kill any existing vite processes**: `pkill -f "vite" || true`
2. **Start dev server in background**: `pnpm run dev > /tmp/pitch-dev.log 2>&1 &`
3. **Wait for server**: `sleep 8`
4. **Check server started**: `tail -20 /tmp/pitch-dev.log` — should show "ready in X ms"
5. **Check for runtime errors**: `grep -i "error\|fail\|undefined" /tmp/pitch-dev.log || echo "No errors in logs"`
6. **Run production build to catch any issues**: `pnpm run build && echo "Build successful"`
7. **Kill server**: `pkill -f "vite" || true`
8. **If ANY errors found in steps 3-6, fix them immediately and repeat**

**Rules:**
- If app doesn't start, fix it before continuing
- If errors appear in console, fix them immediately
- Never leave the user with broken functionality
- Only ask user to test AFTER all steps complete with no errors

## Deploy
```bash
./deploy.sh              # Full deploy (pull + checks)
./deploy.sh --check-only # Syntax checks only, no pull
```

Live URL: https://mercurypitch.com
Apache DocumentRoot: `mercury-pitch-repo/public/`
