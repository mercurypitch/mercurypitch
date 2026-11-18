You are a builder on the MercuryPitch repo, on the Lesson 12 page, "Chords and the four-chord song" (/learn/12). The lead reviews your work. You never push, open PRs, merge, rebase or use git stash.

## Where
- Worktree: /home/user/mercurypitch/.claude/worktrees/rd, branch `feat/lesson-12-page`, at @@HEAD@@. Check `git log --oneline -8` first. Work only there. Its node_modules are installed and current.
- S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad. Logs and notes go under $S/l12/page-1/.
- The branch is origin/main @@MAIN@@, with Lesson 10's whole page on it (#1234), plus the page's five modules still off main, which the lead cherry-picked from their two branches, one commit each, the files unchanged:
  - @@PICKS@@, all under `src/features/lessons/lesson-12/` but the share card (`public/learn/lesson-12-og.jpg`).
  - The other five modules are on main already (#1205): `music.ts`, `numerals.ts`, `sounds.ts`, `lines.ts` and `quiz-questions.ts`.
  - Nothing imports the ten yet. Change a picked one only by `git commit --fixup=<sha>`, one already on main by an ordinary commit of its own; the lead folds fixups at integration.
- Everything PLAN.md has this page wait for is on main now: Lesson 10's page with its P11 (the plan's "stacked on feat/lesson-10-page after L10-P11" now reads: main), B0, B2 and Lesson 9's page under it, the kit's names modes, a voice kind and gain on each run note, Move do's reach for each side with `aria-disabled` ends, the spiral's sound owner and rest, the lesson page tour, and the console's order warning (#1212). PLAN's kit tasks L12-K1 and L12-K2 shipped inside Lesson 10's kit PRs (DECISIONS 3).

## Read first
- $S/l9/BUILDER-RULES.md: git, the heavy and light lanes, builds, browser tests, disk, the report. Three numbers there are out of date: plan-cites reports @@CITES@@ findings on main and on this branch (yours must not report more); `pnpm check` on main ends with 11 warnings, 0 errors; and about @@DISK@@ GB of disk is free for every agent together.
- $S/l12/PLAN.md: section 0, section 3, section 4's P11 (and skim P12 to P21, so the shell leaves each the markup and hooks it needs), section 5, section 6 and section 7. The plan predates Lesson 10's page: read it for what Lesson 12 needs, and Lesson 10's shell for how today's code does it.
- $S/l12/DECISIONS.md: all of it. 2 (the drafts line), 9 (the explorer card's practice link), 11 (the tune toy's Stop names, for P14, but leave its markup room), 12 (the owner's items) and 14 (drift) bear on this run. Lesson 10's decisions that apply here too: $S/l10/DECISIONS.md 1, 9, 20 and 25 (the description's rule, first paint, no plan names, the shell's ceilings).
- $S/l12/FOLLOWUPS.md: every item that names the page head, the page or its screenshots. The share card's alt text is the one there, not WEB-SPEC's :918-920.
- docs/plans/find-your-pitch/lessons/12-chords-four-chord-song/WEB-SPEC.md, LESSON.md and FACTS.md; docs/plans/find-your-pitch/LESSON-TOUR.md.
- CLAUDE.md, AGENTS.md, docs/agent/CONVENTIONS.md, docs/agent/TESTING.md and docs/agent/MISTAKES.md, with its entry "Take the lessons' base stylesheet into another page by `@import`, never by a link" (:919).
- **The pattern is Lesson 10's shell, commit @@L10SHELL@@** ("Lesson 10's page shell, in the season as a draft"). Read its message and its whole diff with `git show @@L10SHELL@@`. It did on today's code what P11 does here: the drafts line, the season entry, the service worker's paths, both budget tables, the run recorder (`kit/run-recorder.test-fixtures.ts`), the page tour on the new page, LESSON-TOUR.md and the spec's Contract. The nearest code is `learn/10.html`, `lesson-10/main.ts`, `lesson-10/lesson-10.css`, `lesson-10/page.test.ts`, `lesson-10/steps.ts` and `src/e2e/learn-lesson-10.spec.ts`. The plan names Lessons 2, 4 and 6 for the hero, the boot order and the page test: take Lesson 12's content from the plan and the spec, the mechanics from Lesson 10's shell, and say in your report wherever the two differ and which you followed.

## Scope, in this order, one commit each
1. **P11, the page shell and registration** (PLAN.md P11, section 5, section 6), with:
   - the description by Lesson 10's decision 1 rule, and the spec's need 12 brought to match in the same commit if it differs;
   - the drafts line in the spec's wording (DECISIONS 2). Lesson 12 is a draft as Lessons 3 to 10 are: served on dev and PR previews, answered with the 404 page on mercurypitch.com until the admin console publishes it, and kept out of the sitemap and llms.txt (the header of `kit/drafts.ts`). No `datePublished` (R1's);
   - the season entry: the minutes from the series' rule (`pnpm lesson:words` and the run-time rule Lesson 10's entry follows; the plan's 15 is a guess from before the counter), the page, and the explorer card's `pr.link` from DECISIONS 9 (Cadence, `/ear-lab?lesson=12`, "then tap Cadence"); `pr.needs` stays. The meta chip says the same minutes;
   - the page's practice card as WEB-SPEC's Practice links gives it today, with the rest card's version;
   - first-paint ceilings for `learn/12.html` in both tables at the smallest whole KB above your measure, the measure and its cause in the comment, to rise as each toy joins (Lesson 10's decision 25). Lessons 3, 4 and 5 have 223, 745 and 775 bytes of script left on main: any lesson whose number rises past its ceiling gets the same treatment, as @@L10SHELL@@ did for Lessons 3 and 4, with its numbers and when the old ceiling can hold again;
   - the test shifts: section 5's list, less what Lessons 9 and 10's shells already made season-driven. In your report, list each shift you made, and each one section 5 names that you found already done;
   - the run recorder: import `kit/run-recorder.test-fixtures.ts` where a test needs it. Never copy it;
   - the lesson page tour: all five steps find their targets on Lesson 12 at 390x844 and 1440x900; LESSON-TOUR.md counts the new page; WEB-SPEC's Contract names `fyp-tour` beside `fyp-pos` (:1303), as Lesson 10's does;
   - the stylesheets: every `dist/learn/NN.html` links the same stylesheets, in the same order, as the base build. @@L10SHELL@@'s message says how Lesson 10 kept this;
   - each toy does nothing until its own task wires it, as the plan says. The shell imports none of the ten modules unless it needs one; if it does, say which and why.
2. **The module map**, regenerated with `node scripts/gen-agent-index.mjs`, as your last commit.

Stop after P11. P12 onwards are later runs.

## Rules
- BUILDER-RULES.md applies in full: the heavy lane for tsc, eslint, vite build, vitest over many files and Playwright; the light lane for one to three test files; `NODE_OPTIONS=--max-old-space-size=6144` for `pnpm check` and the build (tsc runs out of the default heap); long timeouts on background runs; a timeout after the throttle, never before it.
- Before `pnpm build:e2e`, check `df -h /` shows at least 1.2 GB free. Never delete another worktree's files. Delete your dist/ and test-results/ when you are done.
- Playwright: `PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers` on every browser run. Never run `playwright install`.
- Never test against production. Local only.
- Commits: conventional, a body that says what and why, the identity git already has here. No Co-Authored-By, no Claude or session lines, no other attribution. No emojis anywhere; icons are SVG.
- Code comments and commit messages name no plan task (P11, B2, K1), no decision number and no scratchpad file.
- Do not touch `src/features/admin/*` beyond a test shift section 5 names. Do not open `.env*` files, edit `.claude/settings.json`, or publish artifacts.
- Where the plan, a decision and the code disagree, say so in your report instead of working around it.

## Gates before you hand back
- **Before your first commit:** `pnpm build:e2e` on the branch as it stands, then `node scripts/assert-first-paint-budgets.mjs dist`. The picked modules are imported by nothing, so this is main's build: record Lessons 1 to 10 and save each `dist/learn/NN.html`'s stylesheet links, in order, under $S/l12/page-1/base/. Then delete that dist/.
- `pnpm check`: no errors, and no warnings beyond main's 11; look at `git diff` after it.
- Unit tests: everything P11's "Done when" names, `kit/publish.test.ts`, `kit/season.test.ts`, `kit/drafts.test.ts` and the explorer, next card and lesson menu tests, `kit/run-recorder.test.ts`, and all of `src/features/lessons/lesson-12/` and `lesson-10/`.
- `pnpm build:e2e` (it stops at the Glassworks step here, as BUILDER-RULES.md says), then `node scripts/assert-first-paint-budgets.mjs dist` and `node scripts/assert-draft-lessons.mjs dist --shown`. Report first paint for Lessons 1 to 10 and 12 (Lesson 11 has no page), before and after, and the stylesheet comparison for every lesson page.
- Browser specs: P11's list (`learn-stage-fit`, `learn-cold-open-fold`, `learn-no-planning-text`, `learn-next-card`, `learn-explorer`, `learn-lesson-menu`, `learn-sound-gate`, `learn-publish-state`, `learn-frame-loop`, `learn-lesson-10*` and the new `learn-lesson-12`), plus `learn-lesson-09`, `learn-lesson-tour`, `stage-and-tour-focus` and any other spec @@L10SHELL@@ touched.
- `pnpm pr:validate`, `pnpm metrics:check`, `pnpm docs:index:check`, and `node scripts/plan-cites.mjs check` at @@CITES@@ or fewer. Re-anchor with `pnpm plan:cites reanchor --base origin/main --write` where your changes move cited lines, and set by hand any citation whose cited lines changed, as @@L10SHELL@@'s message describes.
- Mutations: for each behaviour you add, take it out and show a test fails: the drafts line, the season's page and minutes, the `pr.link`, the service worker's paths, each budget row, each check in `lesson-12/page.test.ts`, and End to end 1 and 14. List each mutation and the test that caught it.

## Hand back (your final message is your report to the lead)
- Your commits, in order: hash and subject.
- Files changed, per commit.
- Every test and gate, with its result and log path.
- First paint before and after for Lessons 1 to 10 and 12 (Lesson 11 has no page), each ceiling you set or changed with its reason, and the stylesheet comparison.
- Two screenshots of the page shell (390x844 and 1440x900) and one of the tour's first step on Lesson 12, under $S/l12/page-1/.
- The mutation list.
- Where the plan and Lesson 10's shell differed, and which you followed.
- What you could not do or did not verify, and open questions.
