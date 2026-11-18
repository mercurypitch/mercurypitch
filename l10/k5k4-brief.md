You are a builder on the Lesson 10 page of MercuryPitch's Find your pitch season, the web lessons at /learn/NN. Your job is two kit tasks from Lesson 10's plan, in order: K5, then K4. Both change the kit's spiral, `src/features/lessons/kit/spiral.ts`.

## Read first
1. `/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l9/BUILDER-RULES.md`. It applies to you in full: git, the heavy and light throttles, browser tests, gates, disk, and your report.
2. `/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l10/PLAN.md`:
   - section 0;
   - section 2, G2 and G3;
   - section 3's guardrails;
   - the K4 and K5 tasks in section 4, around lines 496-545.
   The plan gives each task's goal, files with line numbers, tests and "Done when".
3. `/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l10/DECISIONS.md`, items 6, 9 and 11: K4 and K5 are approved.
4. The repo's docs/agent/CONVENTIONS.md and docs/agent/TESTING.md. Read docs/agent/MISTAKES.md before your first change.

## Where you work
- **Worktree:** `/home/user/mercurypitch/.claude/worktrees/kit-spiral`. Branch `feat/kit-spiral-owner` is checked out, at origin/main 5e08dd4a3, with node_modules installed. Work only there.
- **K5 first,** on `feat/kit-spiral-owner`: `SpiralOptions.owner?: SoundOwner`. With an owner, a bead tap or a slider key plays a stoppable voice that claims the owner, releases it at the note's end, and is stopped by a claim from elsewhere. Without an owner, it plays as today.
- **Then K4,** on a new branch stacked on K5. When K5's commits are done and the tree is clean, run `git switch -c feat/kit-spiral-rest` in the same worktree. That one command is allowed. Do not rebase.
  - K4 gives the spiral's drawer a `wants`, true only while something moves or has changed.
  - It also adds `overlayWants?: () => boolean`, so a page's overlay can ask for frames.
  - It compares what the spiral shows with what it last drew, rather than trusting `wake()`. A7 does the same for Lesson 9's band chart; that work is on branch `feat/lesson-09-...`, not yet on main, so follow the plan's description and `frame-loop.ts:1-18` instead.
- Lessons 1 and 2 are the only pages using the spiral today. They pass no owner, so K5 must change nothing for them. Under K4 they still do not rest page-wide, because their sky and other drawers keep drawing.

## Commits
- One commit per task: K5 on its branch, K4 on its branch.
- If `node scripts/gen-agent-index.mjs` changes docs/agent/INDEX.md, commit that change as its own last commit on the branch, "docs(agent): regenerate the module map".
- Re-anchored plan citations (`pnpm plan:cites reanchor --base origin/main --write` for K5, `--base feat/kit-spiral-owner` for K4) go in a separate commit, "docs(find-your-pitch): re-anchor citations to the spiral". `node scripts/plan-cites.mjs check` must stay at or under 183.

## Checks
- While iterating, use the light lane for vitest on your test files, and for eslint and prettier on your files.
- When each task is done, run through heavy:
  - `pnpm check`;
  - `pnpm build:e2e`, which exits 1 at the known Glassworks LFS step; then `node scripts/assert-first-paint-budgets.mjs dist`;
  - the `learn-lesson-01*`, `learn-lesson-02*` and `learn-frame-loop` specs, with the default workers and `--retries=0`;
  - `pnpm pr:validate` and `pnpm docs:index:check`.
- First paint before your change, on main 5e08dd4a3, is already measured. Do not rebuild main for it:
  - learn/01 142729 bytes (ceiling 158720);
  - learn/02 163292 bytes (ceiling 168960);
  - all lessons are in `/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l9/a1a-fp-bytes-before.txt`.
  Record Lessons 1 and 2 after each task. A ceiling rises only in the change that needs it, with its reason. Say so, rather than raising it quietly.
- Mutation check before you report: for each task, break the new behaviour three or four ways, for example:
  - a tap that never claims the owner;
  - a voice not stopped by a second claim;
  - `wants` always false;
  - `wants` ignoring a pulse or `setView`.
  Confirm each goes red, and restore the file with git checkout after each one.

## Rules that bite
- Disk is short: about 2 GB is free for every agent together. Delete dist/ when your last browser run is done, and keep logs small.
- Never push, open a PR, merge or rebase. Never use git stash; use a WIP commit instead. Never test against production. No Claude attribution, no session links and no emojis in commits or code.
- If something in the plan is wrong on main, do the right thing, and say what you changed and why in your report. Ask only if you are truly blocked.

## Report (your final message)
Keep it short:
- commits on each branch, with SHA and subject;
- files changed;
- every test and gate, with its result;
- first paint for Lessons 1 and 2, before and after each task;
- the mutations and their results;
- your decisions, open questions, and what you did not verify.