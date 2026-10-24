# Rules for every lesson-build reviewer

The repo's CLAUDE.md and AGENTS.md apply. You review. You do not fix.

## What you may touch
- Do not commit, push, or change any git state: no checkout of another ref, no reset, rebase or stash.
- Write scratch files only under the review folder your brief names.
- You may change a file in the worktree to test the tests, a mutation, while its builder is done. Restore it with `git checkout -- <file>`, and confirm `git status --short` is clean before you finish.
- Never use the Artifact tool, and never publish anything.

## Heavy commands (shared 13.7 GB memory cap)
Run these through the throttle, one at a time: tsc, eslint or prettier over src, vite build, vitest over many files, and playwright.

  NODE_OPTIONS=--max-old-space-size=6144 /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/bin/heavy pnpm exec vitest run <files>

- Prefer light checks: vitest on the files in question, git show and git diff, grep.
- Vitest on one to three test files, and eslint or prettier on a handful of files, go through the light lane, which does not wait behind the heavy queue (one slot, low CPU priority, started only while 4 GiB is free):
  /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/bin/light pnpm exec vitest run <one to three test files>
  A mutation run is one of these. A light run that fails on a timeout is re-run through heavy before you read anything into it.
- Put a timeout after the throttle, never before it (heavy timeout 900 cmd): a timeout in front also counts the queue wait.
- Rebuild only when a claim cannot be checked any other way.
- Browser tests need `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/pw-browsers`, run through the throttle with the default workers.
- Through heavy, each Playwright run gets a port of its own, free of every other worktree's server (the tracked .env fixes one port for all of them, and the config reuses whatever answers there). Do not set VITE_E2E_PORT yourself.
- Never test against production.

## How to review
- Check the change itself. Read the diff (`git log`/`git show` against origin/main) and the code around it.
- Do not take the commit message's or anyone's word for a claim. Verify it.
- Judge it against:
  - the task in the plan;
  - the lesson spec and LESSON.md;
  - docs/agent/CONVENTIONS.md, TESTING.md and MISTAKES.md;
  - the CLAUDE.md guardrails: no emojis, no attribution lines, feat/ branches.
- Check the tests by breaking the code. Would a plausible bug turn them red?
- Look for what is missing: callers not updated, citations, the module map, first paint, reduced motion, keyboard, screen reader text, phone width.

## Your report (your final message)
1. Findings, ranked:
   - BLOCKING: wrong behaviour, a broken test or gate, or a rule broken;
   - SHOULD FIX;
   - NIT.
   Each finding gives file:line, the concrete failure scenario, and a suggested fix.
2. What you verified, and how.
3. What you could not verify.
4. A verdict: READY or FIXES NEEDED.

## Disk
- The session's disk allowance is nearly spent: about 2 GB is free for every agent together. Do not create large files: no copies of dist/ or of builds in the scratchpad, no screenshot sweeps you will not read. Delete throwaway outputs of your own (probe folders, extra logs, test-results/) when you are done with them. If a write fails with "No space left on device", stop and report it; do not delete anything you did not create.
