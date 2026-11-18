Lesson 28 fix pass. The independent review is at
/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/28-REVIEW.md
(1 blocking, 9 should fix, 13 nits; the music, tempo and durations, all twelve range edges, the
other leak surfaces, the season's close, Karaoke Night, Ear Lab's Cadence, Harmony Stack's reasons,
Sing it's shared lines and kit pieces, the length, the run time, the head and the Wikipedia quotes
checked sound). Read it in full, then fix the package in /dev/shm/s2plan (same rules as before: no
git, no pnpm; the worktree is RAM, so copy the three files to s2pkg/28/ when you finish, and often
while you work). No other writer is in the worktree. A second worktree, /dev/shm/s2shared, is the
lead's: do not touch it.

The lead's calls:

1. B1: take route (a). The hero's Play the song stays the song as it kept going, ten bars, but bars
   9 and 10 become the song going on into A again, bars 1 and 2 (B4 A4 | G4 B4 over G3 F♯3 | E3
   G3, or the writer's better), and the play stops at bar 10's end. No G4 over G3 at a cadence
   sounds anywhere before the choice. The tease and both bubbles stay true; Tavi's line changes
   with item 5. Step 2's Interrupted play (bars 7 to 10) and its sentence follow ("Bars 9 and 10
   start A again", or better, within the step's cap), and so do FACTS 33, verify28.py section 3
   (re-run it), Toys, Tests 2 and the hero's spoken summary. Then make FACTS 1a, LESSON.md's
   preamble, Audio rule 5, Tests 5 and Page QA say what the hero actually plays and why that
   answers nothing, in Lessons 26 and 27's way.
2. S1: take it. A stem with one reading that leaves both choices open, in the review's words or
   better, for instance "Merc and Tavi sing bars 7 and 8 two ways: to end the song there, and to
   keep going, as you heard. At bar 8, whose note is different?" [ Tavi's part ] [ Merc's part ].
   Check it against route (a)'s hero and the bound tease; the answering plays' labels to match.
3. S2: take it. Sing it's staffs draw the hero's empty strip until the choice, as the steps' figure
   does (Toys 6, Edge cases, FACTS 1a, 46). Hold quick check 4, its play and its answers, until the
   cold open's choice, as Lesson 26 holds its quick check 2 (say so in FACTS 1a and Tests), and give
   its feedback a line true of what its own play does. The Wrap's "interrupted, V to vi": hold it
   as a reveal element (`src/features/lessons/kit/predict.ts:70-71` takes several) or word it
   without the numerals, your choice. Rewrite FACTS 1a's paragraph on the chain honestly, naming
   Lesson 12's "From V to vi, all three notes move up a step".
4. S3: take it: the coach's list quotes the page's Easy or Workable line, and gains the voice-choice
   line ("Lower voices sing Merc's part, ...") beside the voice choice.
5. S4: take all five, in the review's words or better. Tavi's bubble must stay a sincere guess for
   the wrong part (MERC-BIBLE).
6. S5 and your question 3: keep the breath marks after bars 2, 4 and 6 as the default. Say it on the
   page in one short sentence the coach signs, where the marks are first read (Step 4, or Sing it's
   reading line if Step 4's text would pass its 120 words; cut to fit), and put the conflict with
   Lessons 14 and 18 in FACTS 67 and in the coach's question, with bar 4 alone as the coach's
   alternative.
7. S6 and your question 2: keep the alone path, and give it the plan's first turn: an optional
   "Hear Tavi's part first" (the other part, for whichever part the learner sings; 26.7 s, not timed
   into the chip), so the order is § 6.2 item 7's, the page plays, then the learner sings. FACTS 63,
   the preamble and the hand-back's § 3 clause say so, and that a learner without headphones hears
   the harmony afterwards, from the recording.
8. S7: take it. Align the playback on a moment both clocks see: the take's first voiced onset in the
   decoded buffer set to the audio-clock time of the listener's first voiced frame, the part from
   bar 1 on that clock; a learner who came in late plays back late. Add the synthetic test (a take
   whose recording starts at a random offset still plays back aligned) and keep the lab's
   round-trip item. Nit 6's 26.9 s settles with it.
9. S8: take it ("a perfect cadence is a full stop", or the plan's wording); FACTS 49 to match.
10. S9: take it: SEARCH § 8's row splits (`/karaoke-night` 14, 28; `/jam` 14, and 26 once Lesson 26's
    entry lands), and Ear Lab's `lessonsPractised` gains 28 beside its row. Say it in item 15 and
    the hand-back's § 3 item 6.
11. The nits: take every one you find correct. Nit 1 goes into the hand-back's § 3 item 1 as the
    reviewer words it (it keeps the half of the belief that is right). Nit 11: skip the voice
    choice on the listening path. Nit 8: cite 238 words a minute as Lessons 20 to 24 do.

The lead's answers to your hand-back's questions:

1. Season 2's close: take your lines ("End of Season 2"; "You've read a song in two parts. Now sing
   a whole song."; the rest line "You've read a song in two parts."), with the kit item that a
   close per season is required before the build, as your hand-back has it.
2. The alone path: kept, with item 7's first turn.
3. The breath marks: item 6.
4. Card 28's misconception: take your fix with nit 1's wording; the lead writes it in the shared
   commit.

Keep the chip at 19 unless the run-time sum moves it (the optional first turn is not timed), and the
head description within 80 to 160 characters with "A nineteen-minute lesson". Keep the built page at
or under 2,379 on the brief's count (150 plus every line this page adds that the counter would
count); make room with named cuts in WEB-SPEC Length.

Re-run plan-cites (0 findings) and lesson-words. Update the hand-back: the CURIOSITY-MOMENTS entry
with the final predict and choices word for word, the MASTER-PLAN line, the shared-file entries
(nit 1, S6's clause and S9 among them), the kit and app items (S7's alignment and test among them)
and the built-page estimate. Then reply with what changed, the counts, and anything you did not
take and why.
