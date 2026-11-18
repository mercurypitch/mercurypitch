# Rules for every Lesson 9 builder

The repo's CLAUDE.md and AGENTS.md apply. These are the ones that bite in this container.

## Git
- Work only in the worktree your brief names; its feat/ branch is already checked out. Commit there. Commits are signed by the git config: do not change git config.
- Never push, open a PR, merge, or rebase onto anything. Never use git stash; use a WIP commit and fold it into a proper commit before you report.
- Commit messages: a plain-language conventional subject, like "refactor(lessons): Move do as a kit part" or "test(lessons): ...", then a body saying what and why. No Claude or Co-Authored-By lines, no session links, no emojis.

## Heavy commands (shared 13.7 GB memory cap; a third heavy job gets killed)
- Run tsc, eslint or prettier over src, vite build, vitest over many files, and playwright through the throttle, one at a time:
  NODE_OPTIONS=--max-old-space-size=7168 /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/bin/heavy pnpm check
  NODE_OPTIONS=--max-old-space-size=6144 /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/bin/heavy pnpm exec vitest run <files>
- pnpm check = typecheck, then eslint --fix, then prettier --write. It can take 15 minutes, and it rewrites files: look at git diff after it. Its 11 existing lint warnings are in files you will not touch.

## Iterate light, run heavy once
- Several builders share the two heavy slots, so a heavy command can wait in the queue. While you work, check only what you touched: pnpm exec vitest run <your test files>, pnpm exec eslint <your files>, pnpm exec prettier --check <your files>. Run the full pnpm check, build and browser specs once, when the change is done.
- Those small checks go through the light lane, not the heavy queue: one slot beside the two heavy ones, at low CPU priority, started only while 4 GiB of memory is free. It takes vitest on one to three test files, and eslint or prettier on a handful of files:
  /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/bin/light pnpm exec vitest run <one to three test files>
  Anything bigger goes through heavy. A light run that fails on a timeout is re-run through heavy before you read anything into it.
- Put a timeout after the throttle, never before it (heavy timeout 900 cmd): a timeout in front of heavy or light also counts the time spent waiting in the queue.

## Builds and browser tests
- NODE_OPTIONS=--max-old-space-size=7168 /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/bin/heavy pnpm build:e2e exits 1 at the Glassworks step here, because glass3d/merc-v2.glb is a Git LFS pointer in this checkout. That is expected: the app bundle in dist/ is complete. The chain stops before its asserts, so then run them yourself:
  node scripts/assert-first-paint-budgets.mjs dist
  and record the numbers it prints for every lesson your change can affect, before (on origin/main) and after.
- Browser tests: PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/pw-browsers /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/bin/heavy pnpm exec playwright test <specs> --retries=0 --reporter=line
  Keep the default workers (2 here). More workers on these 4 cores fail timing tests that have nothing to do with you.
  Through heavy, each Playwright run gets a port of its own, free of every other worktree's server (the tracked .env fixes one port for all of them, and the config reuses whatever answers there). Do not set VITE_E2E_PORT yourself.
- Never test against production. Local only.

## Repo gates before you report
- A new module: node scripts/gen-agent-index.mjs, then pnpm docs:index:check.
- Code a lesson package cites (docs/plans/find-your-pitch/**) moved or changed lines: pnpm plan:cites reanchor --base origin/main --write, then node scripts/plan-cites.mjs check. On a branch whose own commits move cited lines (a page built over several commits), use --base HEAD before each commit instead: from origin/main the tool sees those citations as edited and moves nothing. Main reports 183 findings; your branch must not report more.
- pnpm pr:validate.
- Tests sit beside their module and follow docs/agent/TESTING.md (Arrange, Act, Assert; no waitForTimeout; no .count() assertions in e2e).

## Disk
- The session's disk allowance is nearly spent: about 2 GB is free for every agent together. Do not create large files: no copies of dist/ or of builds in the scratchpad, no screenshot sweeps you will not read. Delete throwaway outputs of your own (probe folders, extra logs, test-results/) when you are done with them. If a write fails with "No space left on device", stop and report it; do not delete anything you did not create.

## Never
- Use the Artifact tool or publish anything outside this repo and the scratchpad.
- Touch the six art/glass-adventure/proofs/camera-comfort-2026-09-24/* files git warns about.
- Open .env files, or edit .claude/settings.json.

## Your report (your final message)
Short: commits (sha and subject), files changed, every test and gate you ran with its result, first-paint numbers before and after, anything you could not do, and open questions. Say plainly what you did not verify.
