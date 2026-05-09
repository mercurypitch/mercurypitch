# Claude Code Configuration for Pitch Perfect

This document contains my Claude Code workflow preferences for this project.

## Git Commits & Pushes

- **ALWAYS commit and push after fixing bugs**
- **ALWAYS include tests and linting in the same PR/commit**
- **Do NOT leave uncommitted changes on the refactor branch**
- After any code change, run: `pnpm run lint && pnpm run test:run && pnpm run typecheck && pnpm run build && git add -A && git commit -m "fix: ..." && git push`

## Runtime Error Detection Workflow (MUST DO AFTER EVERY CODE CHANGE)

1. **Kill any existing vite processes**: `pkill -f "vite" || true`

2. **Start dev server in background**: `pnpm run dev > /tmp/pitch-dev.log 2>&1 &`

3. **Wait for server**: `sleep 8`

4. **Check server started**: `tail -20 /tmp/pitch-dev.log` - should show "ready in X ms"

5. **Check for runtime errors**: `grep -i "error\|fail\|undefined" /tmp/pitch-dev.log || echo "No errors in logs"`

6. **Run production build to catch any issues**: `pnpm run build && echo "Build successful"`

7. **Kill server**: `pkill -f "vite" || true`

8. **If ANY errors found in steps 3-6, fix them immediately and repeat**

**Rules:**

- If app doesn't start, fix it before continuing
- If errors appear in console, fix them immediately
- Never leave the user with broken functionality
- Only ask user to test AFTER ALL steps complete with no errors
