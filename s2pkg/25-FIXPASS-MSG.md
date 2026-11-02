Lesson 25 fix pass. The independent review is at
/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/25-REVIEW.md
(1 blocking, 9 should fix, 12 nits; the new predict, the music, the six-preset table, C minor's
flats in both clefs, the head, the teases, the shared lines and the app claims checked sound). Read
it in full, then fix the package in /dev/shm/s2plan (same rules as before: no git, no pnpm; the
worktree is RAM, so copy the three files to s2pkg/25/ when you finish). Lesson 24's package is in
the same worktree under its own review; it is not yours.

The lead's calls:

1. Blocking 1: take it. Hold the Wrap's Raise te, Raise le, chord column and chord play until the
   cold open's choice, under the steps' lock line, enabled through `onChoice` and held again on a
   return visit, as Lesson 22's free play does (lessons/22-vibrato/WEB-SPEC.md, Toys 5). Correct
   the Toys 1 free-play bullet and Edge cases, add the Wrap to Tests 3 and 18, and add it to FACTS
   1a. Call the hero's play "the tune play" (or its button's name) everywhere, and keep "free play"
   for the Wrap only.
2. Should fix 1: take the recommended fix. Step 1's chord sentences become a second reveal element
   of the cold open's predict (`src/features/lessons/kit/predict.ts:70-71` takes several), with one
   held line in their place until the reveal; word it as the steps' other lock lines are worded.
   Say in FACTS 1a what Step 1 shows before and after the choice.
3. Should fix 2: take it. One sentence in Step 4 that Lesson 21's "no sharps or flats, C major"
   now names the major key's home only, and the house says which is home; trim to stay at or under
   120 words. List the dropped F♯ minor note as a departure in the preamble and FACTS 7.
4. Should fix 3: take it ("0.15 s of quiet", FACTS 62 and WEB-SPEC Audio).
5. Should fix 4: take it. Item 4 lists roots and a window from A2 (A2 to B4 covers the page), the
   side-by-side staircase and chord column as new, and the tests.
6. Should fix 5: take it. Add SEASON-2 § 5.2 item 10 (b), (c), (e), (f) and (g) to item 15 and
   `pr.needs`, and to the card's editorial note what each removes, above all that (g) lets the link
   open Sight-Singing in A harmonic minor directly, in Lesson 16's way.
7. Should fix 6 and 7: take them (Lesson 16's two sentences on the card; the coach's
   Sight-Singing bullet gains the preset's edges and the augmented second).
8. Should fix 8: take it. Cite Lesson 12's sing-along over moving chords as the reason the plan's
   Lesson 26 line is false, in FACTS 5 and the `TEASE_NOTES` note, and drop the "So far" reason.
   Put SEASON-2 § 3's false "Closes on" line for Lesson 25 in the hand-back's shared-file entries,
   with a true replacement (the lead writes it into the shared file).
9. Should fix 9: take it: all four places into FACTS 1a, and Test 18 rewritten as a testable
   assertion in the reviewer's terms.
10. The nits: take every one you find correct. For N1, word the stem better than the reviewer's
    suggestion if you can; it must not imply the learner heard chords under the first ending.
    N9: keep the default head title. N10: say in FACTS 5b that the alternative leans slightly and
    the lead's line is the default.

The lead's answers to your hand-back's questions:

- Teases: bound as you proposed. On Lesson 24's card, the lead's "A minor tune, played twice. The
  second ending changes one note.", with the `plan` alternative. On this page's card, Lesson 26's
  "‘Twinkle’, and the same tune four semitones higher, played together.", with your mended `plan`
  alternative, "Lesson 24's other part was a drone. What if it's a tune?".
- Second drill: keep Sight-Singing in A harmonic minor, with should fix 5, 6 and 7.
- Head title: "Harmonic and melodic minor, relative keys | MercuryPitch".
- Lesson 26's ARTICLE-PLAN.md is committed on the branch, so citing it by path is right.

Re-run plan-cites (0 findings) and lesson-words (aim at or under 2,230; name cuts in WEB-SPEC
Length if over). Keep the head description within 160 characters with "A fifteen-minute lesson".
Update the hand-back: the CURIOSITY-MOMENTS entry with the final predict and choices word for word,
the shared-file entries (SEASON-2 § 3's "Closes on" line for Lesson 25 among them), and the kit
items. Then reply with what changed, the counts, and anything you did not take and why.
