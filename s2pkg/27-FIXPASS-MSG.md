Lesson 27 fix pass. The independent review is at
/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/27-REVIEW.md
(1 blocking, 5 should fix, 11 nits; the other leak checks, the music, the ring and staff positions,
the sing-along and six-preset table, Chord Stacker's other claims, Stack, the shared lines, the
copy, the run time and the departures checked sound). Read it in full, then fix the package in
/dev/shm/s2plan (same rules as before: no git, no pnpm; the worktree is RAM, so copy the three files
to s2pkg/27/ when you finish). Lesson 26's writer is in the same worktree writing its own package;
its files are not yours.

The lead's calls:

1. Blocking 1: take it, with the review's predict. Tavi's line, Merc's "Choose, then hear both go
   home.", the stem "Merc puts one more note on top of G, B and D, then goes home to C, E and G.
   Which note makes the chord pull harder towards home?" with [ F ] [ F♯ ], both played after the
   choice, and the review's reveal. Keep every claim as strong as its source and no stronger: "counts
   as" for the settled and unsettled intervals, "one open textbook says" for the added note's pull,
   and the fair-guess sentence for F♯. Rewrite FACTS 34 to 38 in that form and redo FACTS 1a for the
   new question (every place that states or leans on the answer, held or listed with the tour-hold
   argument, in Lesson 22's way). Hold Step 2's text and card as a further reveal element of the cold
   open's predict, with the steps' held line in their place (`src/features/lessons/kit/predict.ts:70-71`
   takes several), and say so in WEB-SPEC Toys, Edge cases and Tests. Take the new promise ("By the
   end you'll build seventh chords, hear why one added note pulls the V chord home, and turn a chord
   upside down."). Take the optional Step 3 line on B and F♯ if Step 3's text stays within its cap;
   it closes the loop on the wrong answer. WEB-SPEC Decisions 1 goes. Update the CURIOSITY-MOMENTS
   entry with the final predicts and choices word for word.
2. This lesson's own tease (FACTS 5b): the lead binds "G, B and D going home to C, E and G. Now add
   one note on top." (61). The plan's alternative ("... Stack one more on V, and it pulls.") is
   withdrawn: it now leans on the predict. The alternative, if you keep one, is "Three notes make a
   chord. Add one more to V, and hear where it goes." (68), with the lead's line the default. Lesson
   26's writer has been told and binds the same line on Lesson 26's card. Check it against the new
   opening in FACTS 5b.
3. Should fix 2: take it, in the review's words or better: the card, the coach's list, FACTS 62 and
   65 and WEB-SPEC Practice links 1 say what the drill does (notes 1 to 3 about 0.3 s apart and cut
   off there at every level; the level changes the top note and the time to sing; the top note's
   tail overlaps the first time to sing below level 10). Add the help's summary line ("Add notes one
   at a time to build a chord in tune.") to the hand-back's proposed help text, and list the cut-off
   notes in "Kit and app work" as an app fix (Chord Stacker should wait out each note, as Arpeggio
   Jumper does, `use-arpeggio-jumper-controller.ts:316-319`); the card describes the drill as it is.
4. Should fix 3: take it. FACTS 1a says what the ring shows (F♯ drawn as a black key, smaller, its
   name beside it) and why that does not answer the new question.
5. Should fix 4: take it. One count on the page, Lesson 23's rule: the number counts letters, both
   ends included (`lessons/23-perfect-tritone/LESSON.md:195-196`). Quick check 1's feedback in the
   review's words or better ("G, A is two letters, a second. The seventh spans seven letters, G up
   to F."), and the Words and FACTS 13 in the same form.
6. Should fix 5: take it. One clause in Step 4's reveal naming Lesson 23's inversion of intervals
   (the name changes) against this one (the name stays), cutting elsewhere to stay within the cap,
   and say what is in the bass in third inversion ("its seventh in the bass"), in Step 4 or the Wrap.
   Fix FACTS 1b and 49 to match.
7. Should fix 6: take it: the press after the last inversion returns the chord to root position at
   its first pitches (the third press for a triad, the fourth for a seventh chord), and a test that
   no Turn over press sounds a pitch outside FACTS 72.
8. The nits: take every one you find correct. Nit 7: the lead binds "A song in two parts. At bar 8
   it seems to end, then keeps going." (64) for Lesson 28's tease, with the plan's "Songs use it to
   finish" withdrawn and FACTS 5 saying why ("it sounds finished" is stronger than Lesson 28's
   source). Nit 8 only if the count stays within the aim below. Make the hand-back's `pr.needs` and
   WEB-SPEC's Explorer section agree.

The lead's answers to your hand-back's questions:

1. Lesson 26's overlap: settled by Blocking 1. Lesson 26 keeps its quick check; this page cites
   "the third above D in C is F" as taught there and no longer asks it.
2. Lesson 28's tease: the line in item 8 above.
3. Lesson 28's predict stem: already in Lesson 28's brief.
4. SEASON-2 § 3's "Closes on" line: keep your replacement in the hand-back, made to agree with the
   bound Lesson 28 tease; the lead writes it into the shared file.
5. Chord Stacker's help text: in the hand-back with item 3's addition; the lead lists it for the
   owner as app content.
6. Head title: "Seventh chords and chord inversions | MercuryPitch" (query-led, SEARCH.md § 13 item 1).
   Keep the description within 80 to 160 characters with "A fifteen-minute lesson".
7. For the coach: keep it on the coach's list, with both shorter figures ready.

Re-run plan-cites (0 findings) and lesson-words. Keep lesson-words at or under 2,230 so the built
page fits the 2,379 cap; make room for the new reveal and lines with named cuts in WEB-SPEC Length.
Update the hand-back: the CURIOSITY-MOMENTS entry, the shared-file entries (SEASON-2 § 3's line
among them), the kit and app items (item 3's fix among them) and the built-page estimate. Then reply
with what changed, the counts, and anything you did not take and why.
