# Rules for the 0.9.22 polish builders

The repo's CLAUDE.md and AGENTS.md apply. These are the ones that bite in this container.

S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad

## Git
- Work only in the worktree your brief names; its feat/ branch is already checked out, at origin/main. Commit there. Commits are signed by the git config: do not change git config.
- Never push, open a PR, merge, or rebase. Never use git stash; use a WIP commit and fold it into a proper commit before you report.
- Never `cd` in a shell command: use `git -C <dir>` and `( cd <dir> && ... )` subshells.
- Commit messages: a plain-language conventional subject, like "fix(plan): the main button starts the first stop", then a body saying what and why. No Claude or Co-Authored-By lines, no session links, no emojis.
- Code comments and commit messages give reasons (the spec, the repo docs, what a reader or a crawler meets). They never name a scratchpad file, a plan task id, or "the brief".

## Heavy commands (shared memory cap; a third heavy job gets killed)
- Two builders share two heavy slots. Run tsc, eslint or prettier over src, vite build, vitest over many files, and playwright through the throttle, one at a time:
  NODE_OPTIONS=--max-old-space-size=7168 $S/bin/heavy pnpm check
  NODE_OPTIONS=--max-old-space-size=6144 $S/bin/heavy pnpm exec vitest run <files or dirs>
- pnpm check = typecheck, then eslint --fix, then prettier --write. It can take 15 minutes and it rewrites files: look at git diff after it and fold any change into the commit it belongs to. Main has 11 lint warnings, in files you will not touch; you add none.
- Put a timeout after the throttle, never before it (`$S/bin/heavy timeout 900 <cmd>`): a timeout in front also counts the queue.

## Iterate light, run heavy once
- While you work, check only what you touched, through the light lane (one slot, low priority, started only while 4 GiB of memory is free): vitest on one to three test files, eslint or prettier on a handful of files:
  $S/bin/light pnpm exec vitest run <one to three test files>
  Anything bigger goes through heavy. A light run that fails on a timeout is re-run through heavy before you read anything into it.
- Run the full pnpm check, the build and the browser specs once, when the change is done.

## Builds and browser tests
- Disk: about 900 MB is free for both builders together. Before `pnpm build:e2e`, check that `df -m /` shows at least 700 MB free; if not, wait and check again. A build's dist/ takes about 180 MB. Delete your own dist/ and test-results/ once you have what you need. Never delete anything you did not create. No copies of dist/ in the scratchpad, no screenshot sweeps you will not read.
- NODE_OPTIONS=--max-old-space-size=7168 $S/bin/heavy pnpm build:e2e exits 1 at the Glassworks step here, because glass3d/merc-v2.glb is a Git LFS pointer in this checkout. That is expected: the app bundle in dist/ is complete. The chain stops before its asserts, so run them yourself:
  node scripts/assert-first-paint-budgets.mjs dist
  node scripts/assert-draft-lessons.mjs dist --shown
  and record the numbers for every page your change can affect, before (a build of origin/main, which is your branch's first commit's parent) and after. To measure before cheaply, build once at the start, record, and delete dist/.
- First-paint budgets: if your change takes a page over its budget, raise that budget to the smallest whole KB above the new measure, in the commit that causes it, with the measure and the cause in the comment beside it. Never raise one that still passes.
- Browser tests: PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers $S/bin/heavy pnpm exec playwright test <specs> --retries=0 --reporter=line
  Keep the default workers (2 here). Through heavy each run gets a port of its own; do not set VITE_E2E_PORT yourself. Never run `playwright install`.
- Screenshots: the app-check skill (.claude/skills/app-check/SKILL.md) drives the app in a real browser at 390x844 and 1440x900; use its scripts, and add the extra sizes your brief names. Tours: the tour-check skill (.claude/skills/tour-check/SKILL.md, scripts/walk-tours.mjs). Save screenshots under your brief's folder in $S/polish/.
- Never test against production or the dev site. Local only. A page that would fetch from media.mercurypitch.com or any other remote host: stub it with Playwright route interception or let it fail; never let it reach the network.

## Repo gates before you report
- A new module: node scripts/gen-agent-index.mjs, then pnpm docs:index:check (the map is your last commit).
- node scripts/plan-cites.mjs check: measure it on your branch before your first change; your branch must not report more. Where your changes move lines a plan cites: pnpm plan:cites reanchor --base origin/main --write.
- pnpm test:scripts, pnpm pr:validate, pnpm metrics:check (no function above cognitive complexity 15; the crossFeatureImports count, 537 on main, must not rise).
- Tests sit beside their module and follow docs/agent/TESTING.md (Arrange, Act, Assert; no waitForTimeout; no .count() assertions in e2e).
- Mutations: for each fix, take its behaviour out and show that a test fails. A mutation no test catches is a gap: add the test.

## Never
- Use the Artifact tool or publish anything outside this repo and the scratchpad.
- Touch the six art/glass-adventure/proofs/camera-comfort-2026-09-24/* files git warns about.
- Open .env files, or edit .claude/settings.json.

## Your report (your final message)
Short: commits (sha and subject), files changed per commit, every test and gate with its result and log path, first-paint numbers before and after, screenshots (paths), the mutation list, anything you could not do, and open questions. Say plainly what you did not verify.
