You are a builder on the MercuryPitch repo, on the Lesson 9 page, "Landing a leap" (/learn/09). This run wires Sing it: first the card without the microphone (the comfort check, the voice choice, just listening, the warm-up, the briefing with the ladder choice and Move do, Play Merc's ladder, and the no-microphone path), then the take (the listener, Merc's ladder before it, the guide, the live line, the readings, "How did that feel?" and Again). The lead reviews your work. You never push, open PRs, merge, rebase or use git stash.

## Where
- Worktree: /home/user/mercurypitch/.claude/worktrees/l9-flow, branch `feat/lesson-09-page`, at 0b4efb113. Check `git log --oneline -6` and `git status` first. Work only there. Never `cd` in a shell command: use `git -C <dir>` or a `( cd <dir> && ... )` subshell.
- S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad. Logs, notes and screenshots go under $S/l9/page-4/ (create it). Keep logs small.
- The branch is a stack. Do not change any commit below your own:
  - It sits on origin/main f6197d91f. v0.9.22 is tagged, and every kit PR this page needs has merged: #1198, #1199 (the kit's ladder reader), #1207 (`kit/run.ts` and the microphone holder `kit/mic-hold.ts`), #1208 (the band chart's rungs, arcs and names) and #1206 (Move do's ends, and the names modes), with #1205, #1212, #1213 and #1214 (Lesson 10's app copy) after them. The lead moved the page's 19 commits onto main on 26 October, last after #1214, and pushed it to origin as 0b4efb113. #1213 (Arpeggio Jumper's scoring v2) added 17 words to this lesson's practice card, so LESSON.md's learner copy is now 2,379 words, level with the series' cap (FACTS 5, WEB-SPEC Length): add no learner words to LESSON.md.
  - On top, reviewed and gated: the ladder data, the sounds and their words, the quick-check questions, the Sing it flow rule (`ladder-flow.ts`), the band chart's rest, the folds in the kit, the share card, the page shell, the ladder chart controller, the cold open, the recall and quick check, the four words, Steps 1 to 5 with the folds strip and the landing, and the maps.
  - Keep each of your commits to its own task. The lead rebases the page onto main again before its PR.

## Read first
- $S/l9/BUILDER-RULES.md: git, the heavy and light lanes, builds, browser tests, disk, the report. It applies in full. Two numbers there are out of date: plan-cites reports 156 findings on this branch (yours must not report more), and about 9 GB of disk is free for every agent together.
- $S/l9/PLAN.md: section 0, section 3, section 4's B11, B12 and B13 (and A4, A5 and A8 for the reader, the stepped fake microphone and the holder), section 6, and section 7.
- $S/l9/DECISIONS.md: all of it. Decisions 5, 8, 11, 15, 17, 19, 21 to 24, 29, 30 and 31 bear on this run.
- $S/l9/FOLLOWUPS.md: every item that names B12 or B13, and the run 3 section at the end.
- docs/plans/find-your-pitch/lessons/09-landing-a-leap/WEB-SPEC.md: Toys 4 in full (WEB-SPEC:295-473: the states, the retry rules, the flow, reading a ladder, listening, accessibility and motion), the Edge cases, Tests 3, 7 and 8, End to end 6, 7 and 12, and the Contract. LESSON.md's Sing it part, and FACTS.md.
- CLAUDE.md, AGENTS.md, docs/agent/CONVENTIONS.md (§ 6 on pointer and touch, § 7 the banner header), docs/agent/TESTING.md and docs/agent/MISTAKES.md (the lessons' stylesheet order).
- The patterns, all on this branch:
  - this page's `ladder-flow.ts` (the pure rule: `openVisit`, `next`, `offers`, `kindOf`, `LADDER_LINES`, `againName`; drive the card from `offers` and never decide a branch in the DOM code), `ladder-chart.ts` (`liveViewOf`, `liveSummary`, the live view), `ladder-data.ts` (`doOf`, `LADDERS`, `ladderNotes`, `rungName`, `liveWindow`), `sounds.ts` (`mercLadderNotes`, `LADDER_NOTE_SEC`), `steps.ts` and `landing.ts` (how a play claims `NowPlaying` and stops), and `learn/09.html`'s Sing it markup (`#sing`, `#singCard`, `#singStatus`, `#singChart`, `#practiseCard`), which already holds every word of the card;
  - Lesson 7's `sing.ts` and `sing-take.ts` (the microphone holder, the status line written only when its words change, the take's lifecycle), Lesson 3's `sing.ts` and `sing-take.ts` (the listener loaded inside the tap, `takeFrames`, the live folded line and its octave tag, the hidden tab), and Lesson 8's `sing.ts` (comfort, voice, Move do and the feelings around a pure flow);
  - the kit: `comfort.ts` (`mountComfort`, `mountFeelings`, `VisitEnding`, `mountPractiseCard`), `voice-choice.ts` (`VoiceChoice`, `bindVoiceButtons`), `warm-up.ts`, `move-do.ts` (`nextShift`, `setMoveEnds`), `mic-hold.ts` (`MicHold`), `listen.ts` (`listen`, `takeFrames`; it re-exports `take.ts`), `take.ts` (`readLadder`, `rungLine`, `countLine`, `trickyAfter`, `NONE_HEARD_LINE`, `LADDER_SLOT_SEC`), `band-words.ts` (`octaveTag`), `merc-duo.ts` (`mercSing`, `mercListen`, `mercCelebrate`), `now-playing.ts`, `sound.ts` and `frame-loop.ts`;
  - `src/e2e/learn-lesson-07-sing.spec.ts`, `learn-lesson-07-sing-a3.spec.ts` and `src/e2e/helpers/tone-wav.ts` (`fakeMicArgs`, `writeToneWav`, `writeStepsWav`).
- Every line of copy this card shows is already in `learn/09.html`, `LADDER_LINES` or the kit (`rungLine`, `countLine`, the octave line). Use them; do not copy them.

## Scope, in this order, one commit each
1. **Sing it, without the microphone** (PLAN.md B12): `lesson-09/sing.ts`, wired from `main.ts`, with its tests.
   - States 1 to 5 and 9 as WEB-SPEC Toys 4 gives them, each control shown exactly when `offers` says (absent, never disabled, except Move do at its ends and the feelings once answered).
   - The sing chart (`#singChart`) shows the pressed ladder's slots, faint, and moves with Move do; its summary says where do is. Play Merc's ladder sings the pressed ladder in the chosen voice, each rung lighting as he sings it, and claims `NowPlaying`; without Web Audio it lights the rungs in silence, with the hint "This browser can't play sound here.".
   - `VisitStart.sound` reads the switch as `Sound.canPlay` does: 'unset' counts as on.
   - The warm-up's Skip is stored as `fyp-l09-warmup`, inside try/catch; the voice through `VoiceChoice`. Nothing else is written.
   - The Wrap's card follows `offers(...).card` through `VisitEnding`, and `mountPractiseCard` mounts `#practiseCard`.
   - Move do: use the kit's `nextShift` and `setMoveEnds` as #1206 left them, with the default reach (`MOVE_REACH`, four semitones both ways). At an end the button is marked `aria-disabled="true"` and never `disabled`, so a keyboard user's focus stays on it, and the page's handler returns first at an end, so a press there neither moves do nor stops what plays, as Lessons 4, 6 and 8's handlers do. Assert `aria-disabled` at each end, and that neither button is ever `disabled`. WEB-SPEC still says the end buttons are "disabled" (Toys 4 at WEB-SPEC:337, the Edge case at :802 and Tests 3 at :833): reword those three to `aria-disabled` in this commit, as #1206 did for Lessons 4, 6 and 8, and re-anchor what moves.
   - With sound off, Start shows its hint and asks for no microphone. With sound on, Start is wired by the next commit.
   - `lesson-09.css`'s `@import '../kit/lesson-voice.css'` moves back to `main.ts` now that Sing it loads the comfort and voice modules, if, measured on a build, Lessons 1 to 8 keep exactly their stylesheet links and Lesson 4's and Lesson 6's guides their heights. If they do not, keep the @import and report the links you saw.
   - Tests: `sing.test.ts` (PLAN.md B12's unit cases, Tests 3's button clause on the page's own Move do buttons, Tests 7's storage clause), and a new `src/e2e/learn-lesson-09-sing.spec.ts` with this commit's two browser cases: Just listen today never calls `navigator.mediaDevices.getUserMedia` (a spy), and with sound off Start asks for no microphone and its hint shows.
2. **The take** (PLAN.md B13): `lesson-09/sing-take.ts`, with its tests.
   - PLAN.md B13's nine steps, in its order. The listener loads only inside Start's tap, through `new MicHold('lesson-09')`; this page's first-paint modules import only types from `kit/listen` and `kit/take`, and everything else comes through the loaded module, as Lesson 7's take does.
   - `readLadder` takes `slotSec: LADDER_NOTE_SEC` and the take's own `voicedAt` (decisions 5 and 19), and a unit test asserts that `LADDER_NOTE_SEC` equals the kit's `LADDER_SLOT_SEC` (a test file may import `kit/take`; `sounds.ts` never does).
   - Each rung's line is `rungLine(label, slot)`, never `slot.line`. The count is `countLine(count) ?? NONE_HEARD_LINE`; the tricky line follows `trickyAfter(count)`. `{ heard: false }` shows the flow's no-voice line, `noVoice` or `noVoiceLast` as `offers` says.
   - The take's kind is `kindOf(reading)`, except that a take whose listener heard a voiced frame while the reader kept none is 'unsteady', never 'none'.
   - Sound turned off while Merc sings, before the take listens, sends the flow's `silenced` event (decision 23). The tab hidden or the section left during a take abandons it at once: the microphone released now (`release(true)`), and `took` with 'leftSilent' or 'leftVoiced'. Nothing from a take is stored.
   - `mercCelebrate` fires once, when `celebrate` turns true, never on every render.
   - After a take the chart's summary reads as WEB-SPEC's accessibility paragraph gives it ("Your ladder, drawn as a line: ..."), from the rung labels and the band words.
   - The tour names the microphone on Lesson 9 now: add 9 to `LISTENING_LESSONS` in `kit/tour-copy.ts`, and restate that file's header so its count of pages and its list of the lessons that can listen are true.
   - Tests: the take's cases in `sing.test.ts` (or a `sing-take.test.ts` beside it) with a fake listener, as Lessons 3 and 7's sing tests do; and `learn-lesson-09-sing.spec.ts` gains End to end 6 and 7 as PLAN.md B13 gives them. For the stepped case, the smaller ladder needs a lead of more than 8 s (Merc's smaller ladder runs 7.5 s); the full ladder's 8 s is enough. If the fake device's start cannot be pinned (decision 8), the unit tests carry the per-note readings: say so.
   - Done when first paint has grown by no more than a little. A jump of several KB means the take's boundary broke: fix the import, never the ceiling.
3. **The module map**, regenerated, as your last commit.

Each commit raises Lesson 9's first-paint budgets as decision 30 says, only if its measure passes them: to the smallest whole KB above its own measure, with the measure and the cause in the raise's comment, in the commit that causes it. Lesson 3's budget stays 131.

Stop after the map. The Wrap's free play, recap, challenge, next-card tease and footer, and the page-wide checks, are later runs.

## Rules
- BUILDER-RULES.md applies in full: the heavy lane for tsc, eslint, vite build, vitest over many files and Playwright; the light lane for one to three test files; `NODE_OPTIONS=--max-old-space-size=7168` for `pnpm check`; long timeouts on background runs.
- Before `pnpm build:e2e`, check that `df -m /` shows at least 700 MB free (a build's dist/ takes about 180 MB here); if not, wait and check again. Never delete another worktree's files. Delete your dist/ and test-results/ when you are done with them.
- Playwright: `PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers`. Never run `playwright install`. Never test against production or dev: local only.
- Commits: conventional, with a body that says what and why, and the identity git already has here. No Co-Authored-By, no Claude or session lines, no other attribution. No emojis anywhere; icons are SVG.
- Code comments and commit messages cite reasons, the spec, FACTS and repo docs. They never name a plan task (B12, B13 and so on), a plan item, or a scratchpad file (PLAN.md, DECISIONS); say what is still to come in plain words, such as "once the Wrap is wired" (decision 29).
- Every fact and every line of copy comes from the spec, LESSON.md or FACTS.md, nearly all of it already in the markup and `LADDER_LINES`. Never write new learner copy. Each state's status line says that state's own words from the card or `LADDER_LINES`; a moment with no words of its own anywhere (asking for the microphone, say) keeps the state's line, and you list it in your report as a copy gap. Where the plan, a decision, the spec and the code disagree, say so in your report; do not work around it.
- The sing chart's drawer has a `wants`, so the page still rests when nothing moves (decision 11; `learn-frame-loop` checks it). Under reduced motion the live line draws on a fixed frame, the guide's bands light without a pulse, and Merc and Tavi skip their reactions.
- No function above cognitive complexity 15: `pnpm metrics:check` fails on one. Check your files as you go with `node_modules/.bin/eslint -c eslint.audit.config.js --rule '{"sonarjs/cognitive-complexity": ["warn", 15]}' <files>`. No test file above 600 lines.
- Do not open `.env*` files, edit `.claude/settings.json`, or publish artifacts.

## Gates before you hand back
- `pnpm check`: no errors, and no warnings beyond main's 11. It rewrites files: look at `git diff` after it, and fold any change into the commit it belongs to.
- Unit tests: your test files, then `pnpm exec vitest run src/features/lessons src/tests/lesson-pages.test.ts` through heavy. If a test outside lesson-09 fails, run that file alone and report both results.
- `pnpm test:scripts`, `pnpm pr:validate`, `pnpm metrics:check`, `pnpm docs:index:check`, and `node scripts/plan-cites.mjs check` (156 or fewer; re-anchor with `pnpm plan:cites reanchor --base 0b4efb113 --write` where your changes move cited lines).
- `pnpm build:e2e` (it stops at the Glassworks step here, as BUILDER-RULES.md says), then `node scripts/assert-first-paint-budgets.mjs dist` and `node scripts/assert-draft-lessons.mjs dist --shown`.
  - First paint, exact bytes, before and after for Lessons 1 to 9: `node $S/l9/page-2/review/fp-bytes.mjs <worktree>`. Measure the before yourself, on a build of 0b4efb113 before your first change: the move onto main changed it (#1206 and #1207 grew Lessons 1, 2, 4, 6, 7 and 8). $S/l9/page-3/gates/final-fp-bytes.txt is the old base's, for reference only.
  - The stylesheet links of each `dist/learn/NN.html` (in the same order) match those of the same build of 0b4efb113 for Lessons 1 to 8 (save them as $S/l9/page-4/links-before.txt; $S/l9/page-3/gates/final-links.txt is the old base's); report Lesson 9's.
  - The guide heights: `PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers $S/l9/page-2/tools/serve-and-run.sh <worktree> 3791 $S/l9/page-2/tools/guide-heights.mjs 3791` must report Lesson 4's scale guide at 300 px and Lesson 6's tune guide at 240 px.
- Browser specs, with `--retries=0`: `learn-lesson-09-sing`, `learn-lesson-09`, `learn-publish-state`, `learn-stage-fit`, `learn-frame-loop`, `learn-cold-open-fold`, `learn-no-planning-text`, `learn-sound-gate`, `learn-next-card`, `learn-explorer`, `learn-lesson-menu`, `learn-lesson-tour`, `learn-lesson-08`, `learn-lesson-07-sing`, `learn-lesson-05`, `learn-lesson-04`, `learn-lesson-06` and the `learn-lesson-03*` specs.
- Mutations: for each task, take its behaviour out and show that a test fails. For example:
  - Without the microphone: a control shown that `offers` withholds (Start on the listen path, the warm-up on the no-microphone path); Just listen today opening the microphone; a storage write besides `fyp-voice` and `fyp-l09-warmup`; Move do's end button not `aria-disabled` at four steps, or still `aria-disabled` one step back, or `disabled` set at an end; a press at an end that moves do or stops a play; the sound-off hint naming the wrong button; the Wrap's card not following "Just listen today"; 'unset' sound read as off.
  - The take: the listener imported statically (first paint jumps); the take opening before 0.4 s after Merc's last note; `slot.line` in place of `rungLine`; a voiced take with no steady note marked 'none'; the sound turned off while Merc sings spending a take; a hidden tab that keeps the microphone; `mercCelebrate` on every render; a reading or count written to storage; the tour's Lesson 9 without its microphone line.
  List each mutation and the test that caught it. A mutation no test catches is a gap: add the test.

## Hand back (your final message is your report to the lead)
- Your commits, in order: hash and subject.
- Files changed, per commit.
- Every test and gate, with its result and log path.
- First paint before and after for Lessons 1 to 9, and every budget you changed, with its reason; where the lesson-voice sheet ended up, and Lesson 9's links.
- Screenshots under $S/l9/page-4/, at 390x844 and 1440x900: the comfort check, the voice choice, Just listen today, the briefing with the warm-up open, a take with the live line, the readings with "How did that feel?", and the count with Again; and the no-microphone state at one width.
- The mutation list.
- Each spec test (PLAN.md section 7) you implemented, and where.
- The copy gaps, what you could not do or did not verify, and open questions.
