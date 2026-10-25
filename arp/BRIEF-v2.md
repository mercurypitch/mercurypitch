You are a builder on the MercuryPitch repo. The lead reviews your work; you never push, open PRs, merge, rebase or use git stash.

## Where
- Worktree: /home/user/mercurypitch/.claude/worktrees/kit-movedo, on the new branch `feat/arpeggio-jumper-v2`, cut from origin/main (the lead creates it; check `git log -1` first). Work only there.
- S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad. Logs and notes go under $S/arp-v2/.

## Read first
- $S/arp/CONSENSUS.md: the agreed grading rule, the bugs in Arpeggio Jumper's scoring windows, the migration checklist, the copy fixes and the device checks. It was written against origin/main 5e08dd4a3. Main has moved since, so re-check every path and line it cites before you rely on it.
- $S/arp/CODE-FACTS.md, and CRITIC-A.md / CRITIC-B.md where CONSENSUS.md points to them.
- CLAUDE.md, AGENTS.md, docs/agent/CONVENTIONS.md, docs/agent/TESTING.md and docs/agent/MISTAKES.md.

## The owner's decisions (25 October)
- **The one rule:** a drill's grade is the mean of its note scores, and everything else is feedback ("average yes").
- **The octave offset ships in this bump** ("the lessons' arpeggio can forgive octave jumps"): one offset per run (an octave down, none, or an octave up) that minimises total error, applied to the score and to the note tally. Tell the singer, for example "Scored an octave above the guide tone." The leap to the top do still has to be sung.
- **The singing floor ships:** each note's singing time stays at or above about 1.2 s at every level. Higher levels shorten the demo instead.
- Drone's stability becomes feedback, in a later bump, not this one.
- Stage 2 (continuous tier bands, calibration, the default tier) comes later, not here.
- The release note is shown to the owner before this ships. Draft it; do not edit CHANGELOG.md, which the release PR owns.
- "Recommended is fine for all matters here": where CONSENSUS.md recommends, do that.

## Scope: CONSENSUS.md Step 0 and Step 1 only
1. **Step 0:** delete `richness * w` from the Call-Response, Mirror Melody, Scale Runner and Drone grades, with no reweighting and no version bump. Richness is 0 or 1 today, so each score moves by at most 0.25 before rounding; pin that in their tests.
2. **Step 1, Arpeggio Jumper v2, one scoring bump**, all of it:
   - the grade (`score = avgAccuracy`; best note kept as praise only);
   - scoring the right sound in steps and echo mode: windows from the tone's end, own-slot scoring, the full-length demo, the mic-latency offset, and the settled trim;
   - "not sung" notes, and the silence guard (a run with nothing voiced is not recorded; REQ-GVC-031);
   - the octave offset;
   - the 1.2 s floor;
   - the migration checklist (SCORING_VERSION bump with a dated comment in the same commit; `onCurrentScoring` filters on the EMA, playCount, findWeakExercises and computePerExerciseStats; the comparability, challenge-attempt and record-payload tests; superseded Skill Threads labelled);
   - the copy fixes listed under "With Arpeggio Jumper v2", including the Lesson 9 and Lesson 12 docs lines, re-checked against today's files.
3. **Out of scope:** Steps 2 to 4 (Scale Runner, Mirror Melody, Routine Runner and Drone bumps, Call-Response, the other best-of terms, the approximations' deletion) and Stage 2. List anything you find there for later. Do not build it.
4. **"Fix now" copy** (Call-Response's timing promise, Drone's "just intonation", Routine Runner's "Endurance" tag) is out of this branch's scope too. List it in the hand-back.

## Other branches touch nearby files
- PR #1208 (feat/lesson-09-kit) and the Lesson 9 page branch edit Lesson 9's FACTS.md and WEB-SPEC.md. Keep your edits to those files to the lines CONSENSUS.md names, so the lead can carry them across.
- `src/features/admin/*` is another builder's. Do not touch it.

## Tests (docs/agent/TESTING.md: Arrange, Act, Assert; behaviour, not implementation)
- Pin a flawless run at 100 and a silent run at 0, with realistic clarity (0.9). Today's "scores high" tests only assert a score above 40, which is how a 75 cap shipped unnoticed.
- The windows:
  - steps mode does not score the reference tone, the previous note or silence;
  - echo mode scores each slot in its own time, offset by the measured latency.
- The octave offset: a run sung an octave above or below scores as if in the guide's octave, and says so; a run that mixes octaves picks the offset with the least total error.
- The 1.2 s floor at every level, and the levels above 5 now reachable.
- "Not sung" notes, and the silence guard.
- The version bump: old records stop feeding the EMA and the weak-drill list.
- Mutation: take each behaviour out, one at a time, and show its test fails. List each mutation and the test that caught it.
- Model the score shifts the way CONSENSUS.md's "Effect on scores" table does, with your final rule, and report the table.

## Rules
- Run memory-heavy jobs through `$S/bin/heavy` (tsc, eslint, vitest over many files, playwright, vite build). `pnpm check` needs `NODE_OPTIONS=--max-old-space-size=7168`. Background Bash runs need a long timeout.
- Browser specs need `pnpm run build:e2e` first.
  - Before building, check that at least 1.2 GB of disk is free (`df -h /`). If not, wait and check again; do not delete other worktrees' files.
  - Delete dist/ and test-results/ when done.
  - Run Playwright with `PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers`, and never run `playwright install`.
- Never test against production, and never use production takes.
- Commits: one per step or concern, conventional, with a body that says what and why. Use the identity git is already configured with in this worktree. Add no Co-Authored-By, no Claude or session lines, and no other attribution; CLAUDE.md forbids it.
- No emojis anywhere. Do not open `.env*` files. Do not edit `.claude/settings.json`. Do not publish artifacts.

## Gates before you hand back
- `pnpm check`: no errors, and no new warnings (main has 11).
- The exercises' and progress' unit tests (src/tests/exercise-*.test.ts, src/features/exercises, the progress model tests), and the full unit run once.
- `pnpm run build:e2e` (it checks the first-paint budgets), then the exercises' browser specs that cover Arpeggio Jumper, and the mobile exercise audit if the drill's screen changed (.claude/skills/mobile-ui-check/SKILL.md).
- `pnpm pr:validate`, `pnpm metrics:check`, `pnpm docs:index:check`, and `node scripts/plan-cites.mjs check` (no more findings than main).

## Hand back (your final message is your report to the lead)
- Your commits, in order: hash and subject.
- The final rule, as code and in words.
- The modelled score table.
- The release-note draft for the owner: the CHANGELOG line, plus a sentence for the leaderboard averages that mix old and new scoring.
- The device checks still needed (CONSENSUS.md "Device checks before v2 ships"), and what you did about speaker bleed.
- The tests added, and the mutation list.
- Every gate, with its result and log path.
- What you left for Steps 2 to 4.
