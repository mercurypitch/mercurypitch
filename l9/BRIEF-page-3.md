You are a builder on the MercuryPitch repo, on the Lesson 9 page, "Landing a leap" (/learn/09). This run wires the five steps: Steps 1 and 2 with the folds strip, Steps 3 and 4, and Step 5 with its scrub bar, plus stopping the steps' sound when the viewer leaves a step. The lead reviews your work. You never push, open PRs, merge, rebase or use git stash.

## Where
- Worktree: /home/user/mercurypitch/.claude/worktrees/l9-flow, branch `feat/lesson-09-page`, at 019bd5c93. Check `git log --oneline -14` and `git status` first. Work only there. Never `cd` in a shell command: use `git -C <dir>` or a `( cd <dir> && ... )` subshell.
- S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad. Logs, notes and screenshots go under $S/l9/page-3/ (create it). Keep logs small.
- The branch is a stack. Do not change any commit below your own:
  - `lead/l9-base` (b15019a5b) is origin/main 2404b342e plus four PRs that hold for the owner's release tag (#1198, #1199, #1207 with `kit/run.ts` and the microphone holder, #1208 with the band chart's rungs, arcs and names), with one map commit.
  - On top, reviewed and folded: the ladder data, the sounds and their words, the quick-check questions, the Sing it flow rule, the band chart's rest, the folds in the kit (`kit/folds-sing.ts`), the share card, the page shell, the ladder chart controller (`ladder-chart.ts`), the cold open, the recall and quick check, the four words, and the maps.
  - When the held PRs merge, the lead moves the page's commits onto main with `git rebase --onto origin/main lead/l9-base`. Keep each of your commits to its own task.

## Read first
- $S/l9/BUILDER-RULES.md: git, the heavy and light lanes, builds, browser tests, disk, the report. It applies in full. Two numbers there are out of date: plan-cites reports 157 findings on this branch (yours must not report more), and about 1.0 GB of disk is free for every agent together.
- $S/l9/PLAN.md: section 0, section 3, section 4's B7, B8a and B8b (and A2 and A6 for the kit's runs and folds), section 6, and section 7.
- $S/l9/DECISIONS.md: all of it. Decisions 10, 11, 25, 26, 29, 30 and 31 bear on this run.
- $S/l9/FOLLOWUPS.md: every item that names B7, B8a or B8b (the folds strip's labels and stills; Climb clearing the last leap's line; `landingSound` with no `from`; `playLine` with no `at`; `landingAt` and `landingTrace` in at-speed seconds under Slow; `COPY_TRACE` with no `slow`).
- docs/plans/find-your-pitch/lessons/09-landing-a-leap/WEB-SPEC.md (Toys 1, the Edge cases, the Tests, Tests 14 in particular, and the Contract), LESSON.md and FACTS.md.
- CLAUDE.md, AGENTS.md, docs/agent/CONVENTIONS.md (§ 6 on pointer and touch, § 7 the banner header), docs/agent/TESTING.md and docs/agent/MISTAKES.md.
- The patterns, all on this branch:
  - this page's own `steps.ts` (the shell's `STEP_STATE`), `ladder-chart.ts` (`show`, `play`, `lineOf`), `ladder-data.ts`, `sounds.ts`, `lines.ts` (the status lines and `scrubText`) and `words.ts` (how a play claims `NowPlaying`);
  - Lesson 3's folds toy and chase scrub on its band chart (`lesson-03/`), Lesson 7's `sirenContourFrom` (the precedent for resuming a contour after Pause or a scrub);
  - `kit/folds.ts`, `kit/folds-sing.ts` (`foldStretch`, `foldVibration`, `drawFoldPair`, `drawFoldText`), the slow clock (`createSlowClock`), `kit/run.ts`, `kit/step-deck.ts` (`onStep(step, previous)`), `kit/sound.ts` (`contourVoice`, the soft tone), `kit/band-words.ts` (`bandValueText`) and `kit/band-chart.ts`.
  - Every note, time and line these steps use is already in `ladder-data.ts`, `sounds.ts` and `lines.ts`. Use them; do not copy them.

## Scope, in this order, one commit each
1. **Steps 1 and 2, with the folds strip** (PLAN.md B7): `lesson-09/steps.ts` and `lesson-09/folds-strip.ts`, with their tests, and Steps 1 and 2's part of End to end 3.
   - The strip is a 64 px canvas under the chart, inside the same figure, so the stage fit sizes both together (`learn-stage-fit` passes).
   - It follows the FOLLOWUPS item on its labels and stills: no `drawFoldLabels` in 64 px.
   - It rests when nothing sounds (decision 11) and shows stills under reduced motion.
2. **Steps 3 and 4** (PLAN.md B8a): `steps.ts` and its test, with fake timers: the order, the numbers, the timing (12.4 s, 24.8 s with Slow) and the status lines. Climb clears the last leap's status line.
3. **Step 5, and stopping sound when the viewer leaves a step** (PLAN.md B8b):
   - Play, Pause and Slow (the landing stretched to 6.0 s), resuming from where it stopped.
   - The scrub bar is decision 26's native range, wired here.
   - The readout uses `bandValueText`, and the band's edge lights with "IN THE BAND".
   - `onStep` stops the step's runs whenever the step changes, and never on a layout switch (same step).
   - Tests 14's step routes in unit tests, and the scrub bar by keyboard end to end.
4. **The module map**, regenerated, as your last commit.

Each toy raises Lesson 9's first-paint budgets as decision 30 says: to the smallest whole KB above its own measure, with the measure and the cause in the raise's comment, in the commit that causes it. Lesson 3's budget stays 131.

Stop after the map. Sing it (the voice choice, Merc's ladder and the take) and the Wrap are later runs: their controls keep doing nothing.

## Rules
- BUILDER-RULES.md applies in full: the heavy lane for tsc, eslint, vite build, vitest over many files and Playwright; the light lane for one to three test files; `NODE_OPTIONS=--max-old-space-size=7168` for `pnpm check`; long timeouts on background runs.
- Before `pnpm build:e2e`, check that `df -m /` shows at least 900 MB free (a build's dist/ takes about 180 MB here); if not, wait and check again. Never delete another worktree's files. Delete your dist/ and test-results/ when you are done with them.
- Playwright: `PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers`. Never run `playwright install`. Never test against production or dev: local only.
- Commits: conventional, with a body that says what and why, and the identity git already has here. No Co-Authored-By, no Claude or session lines, no other attribution. No emojis anywhere; icons are SVG.
- Code comments and commit messages cite reasons, the spec, FACTS and repo docs. They never name a plan task (B7, B12 and so on), a plan item, or a scratchpad file (PLAN.md, DECISIONS); say what is still to come in plain words, such as "once Sing it is wired" (decision 29).
- Every fact and every line of copy comes from the spec, LESSON.md or FACTS.md, most of them already in `sounds.ts` and `lines.ts`. Never write new learner copy. Where the plan, a decision, the spec and the code disagree, say so in your report; do not work around it.
- No function above cognitive complexity 15: `pnpm metrics:check` fails on one. Check your files as you go with `node_modules/.bin/eslint -c eslint.audit.config.js --rule '{"sonarjs/cognitive-complexity": ["warn", 15]}' <files>`.
- If the scrub bar ends up anything but the native range, stop and say why: decision 26 chose the native range so that no pointer code is needed.
- Do not open `.env*` files, edit `.claude/settings.json`, or publish artifacts.

## Gates before you hand back
- `pnpm check`: no errors, and no warnings beyond main's 11. It rewrites files: look at `git diff` after it, and fold any change into the commit it belongs to.
- Unit tests: your test files, then `pnpm exec vitest run src/features/lessons src/tests/lesson-pages.test.ts` through heavy. If a test outside lesson-09 fails, run that file alone and report both results.
- `pnpm test:scripts` (CI runs it in its lint job; it holds the lessons' word counts), `pnpm pr:validate`, `pnpm metrics:check`, `pnpm docs:index:check`, and `node scripts/plan-cites.mjs check` (157 or fewer; re-anchor with `pnpm plan:cites reanchor --base lead/l9-base --write` where your changes move cited lines).
- `pnpm build:e2e` (it stops at the Glassworks step here, as BUILDER-RULES.md says), then `node scripts/assert-first-paint-budgets.mjs dist` and `node scripts/assert-draft-lessons.mjs dist --shown`.
  - First paint, exact bytes, before and after for Lessons 1 to 9: `node $S/l9/page-2/review/fp-bytes.mjs <worktree>`. The before is this branch's build, already measured: $S/l9/page-2/review/gates/fp-final-bytes.txt.
  - The stylesheet links of each `dist/learn/NN.html` (in the same order) match $S/l9/page-2/review/gates/links-final.txt for Lessons 1 to 8.
  - The guide heights: `PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers $S/l9/page-2/tools/serve-and-run.sh <worktree> 3791 $S/l9/page-2/tools/guide-heights.mjs 3791` must report Lesson 4's scale guide at 300 px and Lesson 6's tune guide at 240 px.
- Browser specs: `learn-lesson-09`, `learn-publish-state`, `learn-stage-fit`, `learn-frame-loop`, `learn-cold-open-fold`, `learn-no-planning-text`, `learn-sound-gate`, `learn-next-card`, `learn-explorer`, `learn-lesson-menu`, `learn-lesson-tour`, `learn-lesson-08`, `learn-lesson-04`, `learn-lesson-06` and the `learn-lesson-03*` specs, with `--retries=0`.
- Mutations: for each task, take its behaviour out and show that a test fails. For example:
  - Steps 1 and 2: Slow that does not double a length, or not pressed; Hear it first that plays more than so; the folds moving under reduced motion; the strip drawing while nothing sounds.
  - Steps 3 and 4: the arcs out of order or unnumbered; a play that ends before 12.4 s; a "1 of 5" line on the wrong leap; Climb leaving the last leap's line.
  - Step 5 and leaving: `onStep` with the same step stopping a run; one route (Previous, Next, a swipe, the menu's jump, a `#step-N` address, a quick-check link) that leaves the five leaps sounding; the clock run past the end starting a note; the scrub's `aria-valuetext` wrong at one value; Slow that does not halve the landing's clock; Pause that restarts from the beginning.
  List each mutation and the test that caught it. A mutation no test catches is a gap: add the test.

## Hand back (your final message is your report to the lead)
- Your commits, in order: hash and subject.
- Files changed, per commit.
- Every test and gate, with its result and log path.
- First paint before and after for Lessons 1 to 9, and every budget you changed, with its reason.
- Screenshots under $S/l9/page-3/: Step 1 with the folds strip, Step 4 during its five leaps, and Step 5 with the scrub bar, at 390x844 and 1440x900; and the strip's stills under reduced motion at one width.
- The mutation list.
- Each spec test (PLAN.md section 7) you implemented, and where.
- What you could not do or did not verify, and open questions.
