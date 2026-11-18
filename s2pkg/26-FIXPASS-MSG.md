Lesson 26 fix pass. The independent review is at
/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/26-REVIEW.md
(2 blocking, 6 should fix, 11 nits; the predict's other leak checks, Lesson 27's tease on both
pages, the music, Sing it's range against all six presets, Harmony Stack's other claims, your
`harmoniseItems` finding, the kit claims, the shared lines and the copy checked sound). Read it in
full, then fix the package in /dev/shm/s2plan (same rules as before: no git, no pnpm; the worktree
is RAM, so copy the three files to s2pkg/26/ when you finish). No other writer is in the worktree.

The lead's calls:

1. B1: take it. Specify the pre-choice state once, in Toys 2: until the cold open's choice the
   steps' stage and free play draw the tune alone on plain rows, as the hero does (no lane, no second
   line, no bracket, no name on a bead), with the hero's spoken summary, under the lock line; each
   step's own state draws from the choice on, and a return visit holds them again. Make LESSON.md's
   toy lines, FACTS 40, the Look's lane rule, Tests 5 and Page QA say the same, in Lessons 25 and 27's
   way. For Sing it, take the second option: narrow Page QA's line to "lights a C major lane", and add
   Sing it's figure, its part lines and "Just listen today"'s play to FACTS 1a's open list with the
   tour-hold argument, beside Steps 3 and 4.
2. B2: take it. The lead checked both gaps at c60f0fdcb: `onPeerJoined` re-sends only a song
   (`src/stores/jam-store.ts:1971-1983`), and the room's octave comes from the host's range setting.
   Reorder the card so the friend joins first and the host's range is set first, in the review's
   words or better (it drops S3's clause). Correct FACTS 63b and 64, `pr.link.note`, and Page QA's
   two-peer check in the card's order, with the late-join case shown once. Add the app item (the host
   sends the drill and the mode to a peer whose channel opens, as it does a song; a test that a late
   joiner gets both).
3. Harmony Stack's note names (your question): the card describes the app as it is. Its default line
   is your as-is sentence, "It plays nothing; on the third, its boxes print the tune's letters.",
   counted in the length; item 15 is the app fix, and the card switches to "its boxes name their
   notes" when it ships. Say so in Practice links and item 15, and make LESSON.md's preamble line
   match.
4. S1: take it. Count spans only, Lesson 23's rule, both ends included
   (`lessons/23-perfect-tritone/LESSON.md:195-196`), word for word in its form where you can: Step 1's
   "three letters up", quick check 1's E ("D, E is two letters: a second.", as Lesson 27 words it),
   Step 3's "the same letter names", and the bracket "D up to F: 3 semitones" in Step 1 where it has
   the room. FACTS 11 and 71 to match.
5. S2: take it (the 3 then 4, and "major thirds on do, fa and so; minor thirds on re, mi, la and
   ti").
6. S3: take it: the clause goes with B2's rewrite; keep the table for the coach.
7. S4: take it. Make cuts 1 to 5 now (5 with N4). Then count the built page as the review does: the
   brief's 150 plus every line this page adds that the counter would count, the review's list
   included. Cut further, the reserve line first, then your own choices, until that estimate is at or
   under 2,379. Put the counts and the named cuts in WEB-SPEC Length and FACTS 3.
8. S5: set 16 now: the chip "16 minutes", the head's "A sixteen-minute lesson" (keep the description
   within 80 to 160 characters), `timeRequired` `PT16M` and `minutes` 16, with FACTS 3 saying the lab
   may move it.
9. S6: take it. Read the learner's own part with Lesson 18's anchor, unchanged, so a late start still
   reads its notes. The "on the other part's note" line compares each sung frame with the note the
   other part is sounding at that frame's audio-clock time, the part as played, not with an anchored
   beat. Say it in Toys 5 and FACTS 58, and add the synthetic case (the lower part's singer one beat
   late, on Merc's sounding notes) to Tests 7.
10. The nits: take every one you find correct. N9: put Lesson 25 FACTS 5's replacement line in the
    hand-back's shared-file entries (the lead fixes it in the shared commit). N10: hold quick check
    2 until the cold open's choice, as question 4's play is held, and say so in FACTS 1a and Tests.
    N11: note the stale comment with item 15.

The lead's answers to your hand-back's questions:

- Head title: "How to sing a harmony in thirds | MercuryPitch" (query-led, SEARCH.md § 13 item 1).
- The chip: 16 (item 8 above).
- Jam's note names: item 3 above; the lead lists item 15 and B2's app item for the owner.
- For the coach: keep Move do, the new reader line and the Harmony Stack range table on the coach's
  list.
- Shared-file entries: keep them in the hand-back; the lead writes them in the shared commit.

Re-run plan-cites (0 findings) and lesson-words. Update the hand-back: the CURIOSITY-MOMENTS entry
with the final predict and choices word for word, the shared-file entries (N9 among them), the kit
and app items (B2's and item 15) and the built-page estimate. Then reply with what changed, the
counts, and anything you did not take and why.
