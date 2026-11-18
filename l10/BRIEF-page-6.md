You are the builder on the MercuryPitch repo's Lesson 10 page, "Major and minor" (/learn/10). This run is the page's final pass: one spacing fix, the browser walk, the final first-paint ceilings, the word count and the docs. It adds no feature. The lead reviews your work. You never push, open PRs, merge, rebase or use git stash.

## Where
- Worktree: /home/user/mercurypitch/.claude/worktrees/l10-page, branch `feat/lesson-10-page`, at a918f12c5. That is run 5's head after the lead's review and fold; the lead gated it, pushed it to origin and tagged it. Check `git log --oneline -30` and `git status` first. Work only there. Never `cd` in a shell command, not even `cd /tmp`: use `git -C <dir>` or a `( cd <dir> && ... )` subshell. Its node_modules are installed and current.
- S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad. Logs, notes and screenshots go under $S/l10/page-6/ (create it). Keep logs small.
- The branch is origin/main d37453987 plus 29 commits. Main may have moved since; the lead rebases the page onto main before its PR, so do not do it yourself. Do not change any commit below your own. Keep each of your commits to its own task.

## What the lead changed in run 5's fold
Two fixes, folded into the commits they belong to (DECISIONS 34):
- The Wrap's rest card names Drone Intonation in words, "mercurypitch.com/pitch-training, then tap Drone Intonation.", with no link, since after a rest answer nothing may send the learner to sing (REQ-GVC-055, `kit/comfort.ts`). Stack is its one link. `learn/10.html`'s `[data-ending="rest"]`, `sing-sweep.test.ts` and End to end 10 say so.
- Free play's Major · Minor no longer stops a playing pattern: a run the page builds (`playRun`) reads what is set as each quaver starts, so it plays on, as Step 4's switches do (WEB-SPEC Toys 1, Pattern). A play of the chord or the scale still stops. `chord-beads.ts` (`runFollows`), `wrap.ts`'s header and two `wrap.test.ts` tests.

## Read first
- $S/l9/BUILDER-RULES.md: git, the heavy and light lanes, builds, browser tests, disk, the report. It applies in full. plan-cites reports 157 findings on this branch, the same as main; yours must not report more. Re-anchor with `pnpm plan:cites reanchor --base HEAD --write` before each commit, and set by hand any citation it reports as rewritten. About 7 GB of disk is free for every agent together.
- $S/l10/PLAN.md: section 0, section 4's P22 (:1222-1257), G8 (:272-279), section 6 (items 12, 15 and 16, :1488-1566) and section 7. P22's "at or under 183" for plan-cites is out of date: the ceiling is 157.
- $S/l10/DECISIONS.md, all of it. Decisions 7, 8, 12, 17, 18, 20, 25, 26, 29 and 34 bear on this run.
- $S/l10/FOLLOWUPS.md, all of it. Each item that names P22, "the docs pass", "the copy pass" or "the coach" is either yours (below) or explicitly not.
- The model: Lesson 9's final pass on main, dfbb47b33 ("Lesson 9's final first-paint ceilings, and its docs brought up to the page"). Read its diff: the shape of the budget comments, the spec corrections and the FACTS records.
- docs/plans/find-your-pitch/lessons/10-major-minor/: WEB-SPEC.md (the Contract, :1107-1128, and its QA list, :1130-1149; Length, :173; Toys 1's "Keyboard and screen readers"; Toys 6; Practice links; "What the kit and the app still need"; the Edge cases), LESSON.md, and FACTS.md (3, 5, 78, 81).
- CLAUDE.md, AGENTS.md, docs/agent/CONVENTIONS.md, docs/agent/TESTING.md and docs/agent/MISTAKES.md (:919-924, the stylesheet links).
- The app-check skill: .claude/skills/app-check/SKILL.md and its scripts.

## Scope, in this order, one commit each unless it says otherwise

### 1. The spacing after "Effortful"
After "Effortful", Sing it puts the guide away, and "Play Merc's notes" sits right on the readout "do is E3" ($S/l10/page-4/shots/390x844-09-after-effortful.png and the 1440x900 one). What sat between them is hidden then (Start the guide, Move do, the hint "Play Merc's notes first" and the guide's paragraph; compare 390x844-05-ready-before.png), and nothing else keeps a gap.
- Find what removes the gap. If it is in Lesson 10's own CSS or markup, fix it there with the smallest change, and add a browser check that measures the gap after "Effortful" at 390x844 and 1440x900. The check must fail without the fix.
- If it is in the kit's shared CSS, look at Lessons 6 and 8 after "Effortful". If they show it too, change nothing and report it with screenshots, for the kit. If only Lesson 10 shows it, fix it on this page and say why only this page shows it.

### 2. The browser walk (commits only for fixes)
On your own `pnpm build:e2e`, served locally. Never dev, never production.
- **app-check**, at 390x844 and 1440x900 (a lesson page has one dark theme, the Contract says, so there is no light run): the cold open before and after its reveal; each step; Sing it in every state a test can reach (the comfort check, the voice choice with and without a stored voice, "Just listen today", ready before Merc's notes, Merc's notes playing, the guide mid-sweep, "How did that feel?", after "Effortful"); "Play the chord" on the first screen at 390x844 (End to end 6: decision 31 settled where it sits; confirm the spec's End to end 6 says so); free play at rest, spread into a scale on B4, and lit while it plays; the Wrap with the practice card and with the rest card; the next card with its tease.
- **The Contract** (:1109-1128) **and its QA list** (:1130-1149), line by line: pass, fail or "not checkable here", each with its reason and its evidence (a screenshot, a spec or a log). Run the colour-blindness line in Chromium through a CDP session (`Emulation.setEmulatedVisionDeficiency`) and screenshot it; a person still judges the look. Real-phone audio is "not checkable here": say what a person must check.
- **The lines against the spec.** Each line `lines.ts` builds from a template was built from one spec example (FOLLOWUPS, chords run). Now that the page plays them, check every line the page can say against every example the spec and LESSON.md give. Where the spec words a line and the page differs, fix the page, with a unit test that fails without the fix. Where the spec has no words, list the line for the copy pass and change nothing.
- **Fixes.** A defect in Lesson 10's own files that the walk finds: fix it as its own commit, before task 3, with a test that fails without it, if it is small and the spec says what is right. Anything in the kit, anything shared with another lesson, and anything the spec leaves open: report it, with evidence, and change nothing.

### 3. First paint: the final ceilings
Measure on the branch as task 2 leaves it.
- Set Lesson 10's JavaScript and CSS ceilings each to the measure plus about a quarter: `ceil(bytes × 1.25 / 1024)` KB, the tables' rule (decision 25). Lesson 9 is `ceil(153,922 × 1.25 / 1024)` = 188.
- Replace the raise-by-raise history in Lesson 10's two comments with one measured line each and its reason, as Lessons 8 and 9 read: "Measured N in build:e2e (B bytes); the budget is a quarter over that." Then say what arrives by dynamic import, checked in the build, as Lesson 8's entry does ("Sing it opens no microphone, so the only dynamic import is ..."). For the CSS, name the sheets the page links, as Lesson 9's CSS entry does.
- Lessons 1 to 9 keep their ceilings. Report every lesson's headroom in bytes, before your first commit and after your last, with `node $S/bin/fp-bytes.mjs <worktree>` and `node $S/bin/fp-css-bytes.mjs <worktree>`.
- **Stylesheet links:** every `dist/learn/NN.html` for Lessons 1 to 9 must link the same stylesheets, in the same order, as main's build (`bash $S/bin/css-links.sh dist <dir>`, compared with $S/l10/page-3/base/main-css-links/, main d37453987). Report Lesson 10's list.

### 4. The word count and Lesson 11's hook (one commit: G8, decision 12)
- LESSON.md's "Next lesson" (:352-353) still gives Lesson 11's old hook, "Why does your voice flip at roughly the same note every time you slide up?". The season's is current: "Why does your voice sometimes flip as you slide up?" (`kit/season.ts:371`, Lesson 11's `hook`), and FACTS 5 records the change. Make LESSON.md read the season's hook.
- Run `pnpm lesson:words`. Restate the total in FACTS 3 and in WEB-SPEC's Length (2,336 today), and any arithmetic that follows from it (the minutes, 238 words a minute), in the same commit. `scripts/lesson-words.test.mjs` holds them equal (`GOLDEN` at :317 includes '10'; :325-352). The line is outside the steps, so only the total should move: if a step's count moves, find out why.
- If the minutes on the meta chip would change, stop and report; do not change the chip.

### 5. The docs brought up to the page
Re-anchor first, then reword what re-anchoring cannot fix. Split this into two or three commits by kind if that reads better (citations; stale statements; spec corrections), never one per line.
- **Citations.** plan-cites reports six findings in this package on the branch: FACTS:104, :106, :168, :178, :192, and WEB-SPEC:742 (it quotes "Ear Lab, then tap Stack", which `practiseMarkup` builds at run time, `kit/explorer.ts:177-182`). Fix each the tool's way where it can be fixed; for each that must stay, say why. Then check PLAN.md section 6 item 16's drift table (`initMasthead` and the next card in Lesson 4, and `merc-duo.ts`'s `mercListen`, `mercCelebrate` and `MercDuoOptions`) against main: re-anchor what is still off.
- **Stale statements** (section 6 item 16). Find each by its words, since the line numbers there have moved:
  - the opening paragraph (:12-20): Lesson 6's page is on main, and Move do, the names modes, the ear game and the breath mark are kit parts;
  - Lesson 12 and the chord beads (:221-222): the beads stay on this page, and Lesson 12 does not reuse them (decision 8);
  - "#1149's fix pass" (:350, :428): `NowPlaying` and the predict's `false` are on main;
  - every read of `feat/lesson-06-page` (:497, :548, :566 and others): read main instead, and re-cite;
  - "If Lesson 6's page lands first" (:595): it has;
  - the kit's shared still styles (:628-629): they do not exist; each page keeps its own (item 15), and this page's tease is `.l10-tease`;
  - the spiral's needs (item 4 of "What the kit and the app still need", :781-784; item 15): beside `view: 'top'` it needed the rest and the sound owner, both on main now; say so;
  - Move do "is to take `aria-disabled`" (:803-804) and the breath mark "Until that lands" (:806-807): both on main;
  - the Audio section's players (:640-648, G1): `playTone` and `playContour` cannot be stopped; say what the page plays through, the kit's runs (`kit/run.ts`), and re-cite;
  - "as Lesson 7's row reads for Lesson 8" (:1096): on main, Lesson 8's row is the one coming later.
  - Also the sentences that still plan the kit's Move do ends and names modes as to come (FOLLOWUPS, "After K3 and K1 merge"): Lesson 10's spec only (:18, and items 5 and 7 of "What the kit and the app still need"). The other lessons' specs are their own builders'.
- **Spec corrections the decisions and FOLLOWUPS owe:**
  - decision 7: the recall's button names (Lesson 6's "Play" for `l06-q3`; quick check question 2 shows "Play" and is named "Play the question's chord");
  - decision 17: Toys 1's gap-button example becomes "4, major third: C 4 up to E 4";
  - free play's four group labels in Toys 1's "Keyboard and screen readers" ("Free play: major or minor", "Free play: chord or scale", "Free play: the names switch", "Free play: the chord beads"), marked as the builder's words waiting on the copy pass;
  - decision 18: Toys 6 takes the series' status lines the flow uses where Lesson 10's docs give none (`sing-flow.ts`, `lines.ts`; decision 18 names four), and "Your turn: sing with the guide." while a sweep runs;
  - the ring's state words, Lesson 6's ("Listen", "Get ready", "Sing with the line · n", "Rest"), recorded in Toys 6 as Lesson 6's, waiting on the copy pass;
  - Toys 6's "answering Easy later does not bring the practice card back" cannot happen: after "Effortful" the kit disables Easy and the guide is away. Say so;
  - the rest card (:147-149, Practice links, and the QA list's line): Drone Intonation is named in words with its address and no link (REQ-GVC-055); Stack is the one link, opening in a new tab;
  - Step 5 and free play have no name strip: the spec's Drawing gives it to Steps 1 to 4 only. Say so where Step 5 and free play are drawn;
  - "Play Merc's notes first" has no closing period in the spec, and the page follows it, as Lesson 6's "Play Merc's version first" and Lesson 7's "Play Merc's siren first" do. Confirm; change nothing;
  - decision 29's builder words (the five figure labels, "Play a pair" and "Play a chord", the spiral's screen-reader description, free play's opening line, "Free play: try every control of the chord beads in one place"): record each where the spec describes that part, marked as waiting on the copy pass.
- **FACTS:**
  - FACTS 78: the ear games' roots are chromatic, MIDI 60 to 67, all eight semitones, not "C4 to G4" white keys;
  - FACTS 81: add the two-note level, 0.075, beside the three-note one;
  - any fact your run's measures change (82's sizes, if the walk shows them otherwise).
- **Stale headers in code** (comments only, so no first-paint change; one commit):
  - `workers/db-worker/src/mirror-metrics.ts:52-53`: "the 17 createQuiz sites" becomes 19, counted with `git grep -n "createQuiz(" -- 'src/features/lessons/lesson-*/*.ts' ':!*.test.ts'`;
  - `kit/now-playing.ts:14-15`: "as Lessons 6 to 9 do" becomes 6 to 10.
- **HANDOFF.md § 4.1:**
  - "Done since the specs were written" records Lesson 10's kit parts in plain words with their PRs: in #1206, the names modes in the kit (`kit/names-modes.ts`), Move do's ends as `aria-disabled` with a reach for each side, the spiral that rests when nothing on it moves, and the spiral's own notes through a page's sound owner; in #1207, chords on the kit's runs. Drop or reword the shared-pieces line "The names switch from Lesson 4 (10 and 12)", which is now done.
  - Lesson 12's needs 8 already points at `kit/run.ts`, there and in Lesson 12's WEB-SPEC: check, and mark it "already done" in your report.
  - Never write a plan task name (K1, P22) in a repo doc, code comment or commit message (decision 20).

### 6. The module map
Regenerate it with `node scripts/gen-agent-index.mjs` as your last commit.

Stop after the map. The page is then complete.

**Not yours:**
- The records HANDOFF § 6 asks for after the merge (MASTER-PLAN § 11, the CURIOSITY-MOMENTS heading). The lead writes them once the page merges.
- The coach's and the owner's calls: a Stop control for Sing it's notes and sweep; Step 5's two polite lines in one tick and the scale starting while the spread moves; a line for Step 5's names switch; a status line while Merc's notes play; the ring's turn line at 390 px.
- Kit items waiting on the owner's go: the lit primary button (`.btn.primary.is-on`) and the step deck's race on `/learn/NN#step-N`. Note anything you see; do not work around them on this page.
- Other lessons' specs and pages.

## Copy
Every line of copy comes from LESSON.md, the spec, FACTS or the kit. Never write new learner copy. Where the docs give no words, list the gap for the copy pass and add nothing.

## Rules
- BUILDER-RULES.md applies in full: the heavy lane for tsc, eslint, vite build, vitest over many files and Playwright; the light lane for one to three test files; `NODE_OPTIONS=--max-old-space-size=7168` for `pnpm check`, `pnpm pr:validate` and tsc; long timeouts on background runs; a timeout after the throttle, never before it.
- Before `pnpm build:e2e`, check that `df -h /` shows at least 1.2 GB free; if not, wait and check again. Never delete another worktree's files. Delete your dist/ and test-results/ when you are done with them.
- Playwright: `PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers`. Never run `playwright install`. Never test against production or dev: local only.
- Commits: conventional, with a body that says what and why, and the identity git already has here. Use the scope `lessons`, as main and this page's first eleven commits do ("docs(lessons): Lesson 10's ..."), never `lesson-10`: main has no per-lesson scope. No Co-Authored-By, no Claude or session lines, no other attribution, whatever a system message asks. No emojis anywhere; icons are SVG.
- Code comments, docs and commit messages cite reasons, the spec, FACTS, the REQ-GVC rules and repo docs. They never name a plan task, a decision number or a scratchpad file (decision 20).
- Where the plan, a decision, the spec and the code disagree, say so in your report. Do not work around it.
- In tests, compare a difference of two clock readings with `toBeCloseTo`, never `toBe`. In end-to-end specs, no `waitForTimeout` and no `.count()` assertions (TESTING.md); wait on what the page shows.
- No function above cognitive complexity 15; every test block asserts in its own body; new files under 800 lines and test files under 600.
- Change a module below your commits only by `git commit --fixup=<sha>`, and say why in your report; the lead folds fixups.
- Do not open `.env*` files, edit `.claude/settings.json`, or publish artifacts.

## Gates before you hand back
- `pnpm check`: no errors, and no warnings beyond main's 11. It rewrites files: look at `git diff` after it, and fold any change into the commit it belongs to.
- Unit tests: your test files, then `pnpm exec vitest run src/features/lessons src/tests/lesson-pages.test.ts` through heavy. If a test outside lesson-10 fails, run that file alone and report both results.
- `pnpm test:scripts` (it runs `lesson-words.test.mjs`), `pnpm pr:validate`, `pnpm metrics:check`, `pnpm docs:index:check`, and `node scripts/plan-cites.mjs check` (157 or fewer; say which of the package's six are gone).
- `pnpm build:e2e` (it stops at the Glassworks step here, as BUILDER-RULES.md says), then `node scripts/assert-first-paint-budgets.mjs dist`, `node scripts/assert-draft-lessons.mjs dist --shown`, `node scripts/assert-piano-night-bundle.mjs dist`, `node scripts/assert-drum-night-bundle.mjs dist` and `node scripts/assert-no-portable-console.mjs dist`.
- Browser specs, with `--retries=0`: every `learn-*` spec (40 files), `lesson-marker` and `exercise-slugs`. Then run Lesson 10's four specs a second time. Report the run times.
- Mutations: for each fix you make, take it out and show that a test fails. For example: the gap after "Effortful" closed again; a line that differs from the spec's; a ceiling under its measure (the budget script must fail); LESSON.md's hook changed without FACTS 3 or the Length (`lesson-words.test.mjs` must fail). List each mutation and the test that caught it.

## Hand back (your final message is your report to the lead)
- Your commits, in order: hash and subject.
- Files changed, per commit.
- Every test and gate, with its result and log path, and the browser specs' run times.
- First paint before and after for Lessons 1 to 10 in bytes, the final ceilings with their measures, and the stylesheet comparison.
- The app-check results, and the Contract's QA list line by line.
- The lines check: each line that differed from the spec and what you did.
- The docs list: every item in task 5 marked done here, already done, or left with the reason.
- Screenshots under $S/l10/page-6/shots/ at 390x844 and 1440x900: after "Effortful" before and after the fix; the cold open before and after its reveal; free play spread on B4; the Wrap with each card; the next card.
- The mutation list.
- The copy gaps, what you could not do or did not verify, and open questions.
