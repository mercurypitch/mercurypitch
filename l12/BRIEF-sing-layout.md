You are a builder on the MercuryPitch repo, on the Lesson 12 page, "Chords and the four-chord song" (/learn/12). This run builds three of its page pieces, which need no page yet: the chord strip's layout, the Sing it flow and the Sing it guide. The lead reviews your work. You never push, open PRs, merge, rebase or use git stash.

## Where
- Worktree: /home/user/mercurypitch/.claude/worktrees/l10-singquiz (the folder name is historical). The lead has checked out a new branch there for you, `feat/lesson-12-sing-layout`, at 05d1be73d. Check `git log --oneline -8` and `git status` first. Work only in that worktree. Never `cd` in a shell command: use `git -C <dir>` or a `( cd <dir> && ... )` subshell.
- S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad. Logs and notes go under $S/l12/sing-layout/.
- The branch starts on a stack. Do not change any commit below your own:
  - 05d1be73d is `feat/lesson-12-music`: main at 2404b342e plus Lesson 12's music, spoken numerals, sounds, the page's lines, the quick check's questions and a map commit (PR #1205, which holds for the owner's release tag). They are reviewed. Use them where they fit; do not edit them. If one of them is wrong for your task, say so in the report.
  - The plan says these three tasks depend on nothing. They sit on the music branch anyway, so that they can use its chords and lines instead of copying them. Later the lead moves your commits onto other bases and onto `feat/lesson-12-page`. So keep each commit to its own task.

## Read first
- $S/l9/BUILDER-RULES.md: git, the heavy and light lanes, disk, the report. It applies here in full. Two numbers there are out of date. First, run `node scripts/plan-cites.mjs check` on the base before your first commit and write its count in your notes (the last run on this base gave 157). Yours must not report more; it exits 1 whenever any finding remains. Second, about 0.9 GB of disk is free for every agent together, and another builder needs most of it for a build. So this run makes no build and keeps its logs small.
- $S/l12/PLAN.md:
  - section 0 and section 3;
  - the start of section 4 (the checks every task carries) and its L12-P5, L12-P6 and L12-P7;
  - section 6 (items 15 and 17 in particular) and section 7.
- $S/l12/DECISIONS.md: all of it. Decision 16 sets the branch; the lead stacked it on the music branch, as above.
- $S/l12/FOLLOWUPS.md.
- docs/plans/find-your-pitch/lessons/12-chords-four-chord-song/WEB-SPEC.md:
  - Toys 1 "The ring of rooms": the chord strip and its compact layout, around :338;
  - Toys 6 "Sing it";
  - the Decisions for the owner, 6 to 10 (the vocal coach's items);
  - the Edge cases that touch the strip or Sing it;
  - the Tests (unit 7, 8 and 9) and the Contract.
- LESSON.md (its Sing it section, and the Wrap's practice card) and FACTS.md: 60, 63, and whatever the spec's strip, Sing it and guide cite.
- CLAUDE.md, AGENTS.md, docs/agent/CONVENTIONS.md (§ 7, the banner header), docs/agent/TESTING.md and docs/agent/MISTAKES.md.
- The patterns. Lesson 10 built the same three pieces, and the lead has reviewed them. Follow their shape, not their numbers:
  - **The strip's layout:** Lesson 10's `src/features/lessons/lesson-10/chord-layout.ts` and its test. Read them in /home/user/mercurypitch/.claude/worktrees/l10-hero, and never edit, commit or run anything in that worktree. Also `kit/tune-line-layout.ts` (`Rect`, `MIN_TARGET`) on your branch.
  - **The Sing it flow:**
    - Lesson 10's `lesson-10/sing-flow.ts` and its test. They are not checked out anywhere: read them with `git -C <your worktree> show feat/lesson-10-sing-quiz:src/features/lessons/lesson-10/sing-flow.ts` (and `sing-flow.test.ts`).
    - On your branch: Lesson 6's `lesson-06/sing-flow.ts`, the plan's model; `kit/comfort.ts` (`afterFeeling`, `restAfterEffort`, the feeling lock); `kit/voice-choice.ts`.
  - **The Sing it guide:**
    - Lesson 10's `lesson-10/sing-guide.ts` and its test, read the same way.
    - On your branch: `kit/slide-guide.ts` (`GuideRow`, `gap`); `kit/notes.ts`; `VOCAL_RANGES` in `src/stores/settings-store.ts`, which only the test imports.
    - `lesson-12/music.ts` (the chords) and `lesson-12/lines.ts`, which already holds Sing it's line and its readout in words and in markup. Use them; do not copy them.

## Scope, in this order, one commit each
1. **The chord strip's layout** (PLAN.md L12-P5): `src/features/lessons/lesson-12/strip-layout.ts` and its test.
   - From the figure's width and height it gives:
     - the chips' rectangles;
     - the row for the step's own buttons;
     - whether the compact layout applies.
   - Tests 7 runs at every width from 344 to 1440 px, not at a sample of them.
2. **The Sing it flow** (PLAN.md L12-P6): `lesson-12/sing-flow.ts` and its test.
   - It is a pure rule. It has no DOM, audio, timers or storage.
   - It keeps the kit's lock on the feeling answer until the coach decides (spec Decisions 7).
   - The Wrap's card comes from `afterFeeling` with `restAfterEffort: true`. Check the plan's line numbers for `comfort.ts` on your branch; section 6 item 17 lists some that have moved.
   - Tests 8's storage clause belongs to a later page task. Leave it out, and say so in the test file's header.
3. **The Sing it guide** (PLAN.md L12-P7): `lesson-12/sing-guide.ts` and its test.
   - It takes a shift and never clamps it; the clamp comes later, in the kit.
   - The reach `{ lower: 4, higher: 3 }` is plain data.
4. **The module map**, regenerated, as your last commit.

Each module carries a banner header. Nothing imports these modules yet. Nothing outside `src/features/lessons/lesson-12/` changes, except `docs/agent/INDEX.md` in the last commit. Stop after the map; the page tasks are later runs.

## Rules
- BUILDER-RULES.md applies in full:
  - the heavy lane for tsc, eslint and vitest over many files;
  - the light lane for one to three test files;
  - `NODE_OPTIONS=--max-old-space-size=7168` for `pnpm check`;
  - long timeouts on background runs.
- No build and no browser specs this run: no page links these pieces, so no first paint or spec can change. Say so in the report.
- Commits are conventional, with a body that says what and why, and the identity git already has here.
  - No Co-Authored-By, no Claude or session lines, and no other attribution.
  - No emojis anywhere; icons are SVG.
- Code comments and commit messages cite reasons, the spec, FACTS and repo docs.
  - They never name a plan task (P5, P18, L12-K2 and so on), a plan item (G7) or a scratchpad file (PLAN.md, DECISIONS).
  - Say what is still to come in plain words, such as "once the page is built" or "the kit's clamp".
  - Some comments on the base name plan tasks. Leave them, and do not copy the habit.
- Do not open `.env*` files, edit `.claude/settings.json`, or publish artifacts.
- Where the plan, a decision, the spec and the code disagree, say so in your report; do not work around it.
- Every fact the modules state comes from the spec, LESSON.md or FACTS.md: a width, a time, a note, a line's words. Name the FACTS item in a comment where the plan does. Never write new learner copy: the lines are in `lines.ts` and the spec.
- No function above cognitive complexity 15: `pnpm metrics:check` fails on one. Check your files as you go with `node_modules/.bin/eslint -c eslint.audit.config.js --rule '{"sonarjs/cognitive-complexity": ["warn", 15]}' <files>`.

## Gates before you hand back
- `pnpm check`: no errors, and no warnings beyond main's 11. It rewrites files: look at `git diff` after it, and fold any change into the commit it belongs to.
- Unit tests: your test files, then `pnpm exec vitest run src/features/lessons src/tests/lesson-pages.test.ts` through heavy. If a test outside lesson-12 fails, run that file alone and report both results; the lead checks it against the base. (`kit/beat-layout.test.ts` has timed out once under load and passed alone; report it if it does.)
- `pnpm test:scripts`, `pnpm pr:validate`, `pnpm metrics:check`, `pnpm docs:index:check`, and `node scripts/plan-cites.mjs check` (no more than the base's count). CI runs `test:scripts` in its lint job.
- Mutations. For each task, take its behaviour out and show that a test fails. List each mutation and the test that caught it. A mutation no test catches is a gap: add the test. For example:
  - **Layout:** a chip 43 px high at one width; two chips that overlap at one width; one row at 439 px; two rows at 440 px; the compact layout at exactly 240 px when the spec says below; the buttons' row over a chip.
  - **Flow:** the guide's Start enabled before Merc's notes were heard with sound on, or after a muted play; the feeling answer changeable once given; no rest card after Effortful; the comfort answer kept between visits; the feeling question not asked afresh when a sweep ends.
  - **Guide:**
    - rows a whole tone apart, or five named rows;
    - no `gap` after a silence;
    - the breath at 5.5 s;
    - a note less than a semitone inside a preset at one shift;
    - the bass preset with room at +4;
    - a clamp inside the guide;
    - chords that do not move with do.

## Hand back (your final message is your report to the lead)
- Your commits, in order: hash and subject.
- Files changed, per commit.
- Every test and gate, with its result and log path.
- The mutation list.
- Each spec test (PLAN.md section 7) you implemented, and where.
- What you could not do or did not verify, and open questions.
