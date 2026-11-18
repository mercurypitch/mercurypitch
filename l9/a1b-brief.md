You are a builder on the MercuryPitch repo. Your job: Lesson 9's kit task A1b, arcs and rung names on the band chart, stacked on A1a. Later in your run, you will also apply A1a's review fixes, as fixups on your branch.

**Worktree:** /home/user/mercurypitch/.claude/worktrees/l9-rungs. It has `feat/lesson-09-rungs` checked out at bae1e7e7d: clean, installed, with no dist/. That branch holds A1a's three commits:
- 8695a1d65 test(lessons): Record what the band chart paints for Lessons 3 and 5
- 17bdfc7ba feat(lessons): Paint rungs on the band chart for Lesson 9
- bae1e7e7d docs(find-your-pitch): re-anchor the citations the rungs moved

First run `git -C /home/user/mercurypitch/.claude/worktrees/l9-rungs switch -c feat/lesson-09-arcs`. This is sanctioned, and it is the only branch move you make. Never move `feat/lesson-09-rungs` itself. Use absolute paths or `git -C`.

**Read first:**
- /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l9/BUILDER-RULES.md. These are the container's rules: the heavy throttle and light lane, browser tests, the gates, disk, and your report's shape. They apply to you as written. Disk is especially tight right now.
- From the Lesson 9 lead folder, /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l9/:
  - PLAN.md: A1b at line 265, A1a at 232, and section 6, items 6 and 7;
  - DECISIONS.md, items 2, 6 and 7;
  - FOLLOWUPS.md.
- Lesson 9's package, docs/plans/find-your-pitch/lessons/09-landing-a-leap/:
  - WEB-SPEC.md: its Tests 5, and what it says about Merc's arcs and the rung names (Steps 3 and 4; B8a in the plan);
  - LESSON.md, the source of any words you draw.
- A1a's code and tests: src/features/lessons/kit/band-chart*.ts.
- docs/agent/CONVENTIONS.md, TESTING.md and MISTAKES.md.

**A1a's builder left these open questions.** A reviewer is ruling on them now.
1. `clear()` and `setTarget()` drop `scene.rungs`.
2. There is no `setAxis`.
3. "IN THE BAND" (about 79 px) is right-aligned at a slot's end. It overflows a narrow slot on a phone, and two lit slots could collide.
4. The faint values are guesses.
5. `drawTrace` leaves the line caps round, so from the second frame on, a slotted rung's strokes reach past its ends by half their width.
6. Lesson 3's octave toy stood in for a notes-axis chart like Lesson 5's.
7. band-chart.test.ts is 417 lines.
8. `marksOf` sits at cognitive complexity 15.

Items 3 and 5 bear directly on what you draw. Design A1b so that its own strokes and labels have neither fault, but do not fix A1a's code in your A1b commit.

**A1a's review runs in parallel.** When its report comes in, I will send you the findings to fix.
- Commit each fix as `git commit --fixup=<the A1a commit it belongs to>` on your branch. The lead folds them into A1a later.
- Rebase nothing.
- If a fix collides with work in progress, finish your current step first.

**Build A1b, as its plan and the decisions give it:**
- **Arcs:**
  - An arc runs from the end of one band to the start of the next, and rises above the straight line between them.
  - Amber, with an optional plain digit.
  - It can draw part of itself, so it draws as a note sounds.
  - In rung mode (Step 4): five equal columns in play order, each arc spanning its column, with its number beside the apex (decision 7).
- **Rung names, beside `named`:**
  - They name the given rows (for example "so · A3") and leave every other row unnamed.
  - `drawNotesGrid`'s letters can be switched off.
  - The notes gutter widens to fit the longest given name, and only when names are given (decision 6).
  - Check the plot at 344 px wide, by computing its width there. Only if it gets too narrow, take a screenshot and say so, instead of shrinking the type.
- **Tests:** the second half of Tests 5, as the plan lists it. Where canvas state could leak from one frame to the next (line caps, dashes, alpha, fonts), draw more than one frame in the test.
- **Done when** the same checks as A1a's pass:
  - Lessons 3 and 5's unit tests.
  - `build:e2e`, and the first-paint numbers before and after for Lessons 3 and 5. A1a left them at 132362 and 137307, under ceilings of 133120 and 139264.
  - The learn-lesson-03* and learn-lesson-05* specs.
  - `pnpm metrics:check`: no new function over the complexity line.
  - docs:index, plan-cites at 183 or fewer, and `pnpm pr:validate`.
- **Commits:**
  - one feat commit for A1b;
  - a re-anchor commit, if citations moved;
  - a module-map commit last, if the map drifts;
  - plus the A1a fixups, once I send the findings.

Your final message is the report BUILDER-RULES asks for: commits with sha and subject, files, every gate and its result, first paint before and after, the 344 px check, what you did not verify, and any open questions.