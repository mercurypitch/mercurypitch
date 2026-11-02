Lesson 18 fix pass: the review is in, here are the lead's calls. The independent review is at
/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/18-REVIEW.md
(3 blocking, 10 should fix, 12 nits; plan-cites 0 and all 111 cited code lines confirmed). Read it in
full, then fix the package in /dev/shm/s2plan (same rules as before: no git, no pnpm; the worktree is
RAM, so copy the three files to s2pkg/18/ when you finish). Lessons 16 and 20 are committed
(26d90e225): cite their files by path now, and rebind every citation of Lesson 20 you made in words.

The lead's calls:

1. Blocking 1 (the title answers the predict): keep the season's hook, and recast the predict on Step
   1's demonstration, as the reviewer recommends, so its answer is heard, not asserted, and nothing
   before the choice (the title, the descriptions, Lesson 17's card, the step headings, Merc's
   "Watch what my eyes catch") gives it away. Reword whatever leans, and list every place in FACTS 1a.
2. Blocking 2: fix the beat arithmetic everywhere it appears (the notes sound on beats 2, 4, 6 and 8,
   so they fall 1, 2, 3 and 4 beats behind): Step 1's Notice, its screen-reader line and FACTS 38.
3. Blocking 3: keep each note judged in its own beats, but anchor the windows on the singer's first
   note, as The Chart does; never measure a gap from the wrong note; a note left out or far late reads
   as not heard ("We didn't hear a steady note there."), never as a pitch gap, so "It doesn't score
   your timing" stays true. Specify it in WEB-SPEC with tests and the phone lab test.
4. The should-fixes: take every one, including keeping the Wrap's free play from unlocking Steps 1 and
   2 before the choice. Where the review offers options, take its recommendation unless it breaks
   another rule, and say which you took.
5. The nits: take every one you find correct.
6. The head description writes the minutes as a word, within 160 characters (the head test).

Re-run plan-cites (0 findings) and lesson-words (aim at or under 2,230; name cuts in WEB-SPEC Length
if over). Update the hand-back to match (the CURIOSITY-MOMENTS entry quotes the predict word for word;
the Lesson 17 edits; anything new for SEASON-2 § 5). Then reply with what changed, the counts, and
anything you did not take and why.
