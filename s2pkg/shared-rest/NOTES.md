# Shared entries still owed (Lessons 16 to 28), collected as they come up

- SEASON-2 § 3, Lesson 17's card: its "Closes on" line still carries "Put the two together", which
  Lesson 17 FACTS 5 dropped (its "two" leans towards Lesson 18's predict). Rewrite it with the
  settled tease, "Now you can read when each note comes, and where it sits.", at Lesson 18's commit.
- Per lesson at lead review: MASTER-PLAN § 11 line, CURIOSITY-MOMENTS § 2 block, SEASON-2 § 3
  closing line (only where a tease changes), SEASON-2 § 5 rows the package changes (e.g. Lesson 22's
  centre-line hold reader as a kit item).
- Head descriptions in digits (found 2 Nov, 01:4x, from Lesson 20's hand-back, verified): the head
  test wants the minutes as a word with its article and 80-160 characters
  (`src/tests/lesson-pages.test.ts:156-159`, `:200-209`). Fix in the shared commit, in WEB-SPEC
  and FACTS 1a (both quote the description):
  - Lesson 17 (WEB-SPEC:654-656, FACTS 1a): "Why is a quarter note not a quarter of a second? A
    sixteen-minute lesson with sound toys: whole to sixteenth notes, rests, dots and ties." (137;
    "sixteen-minute" in the old wording would be 164).
  - Lesson 19 (WEB-SPEC:397-399, FACTS 1a): "Six notes in a bar, grouped two ways: why does one feel
    like two beats, the other three? A twelve-minute lesson with sound toys: 6/8, triplets and
    syncopation." (159; the old order would be 162).
  - Lesson 21 (WEB-SPEC:440, FACTS 1a): "A fifteen-minute lesson on keys and the circle of
    fifths." (description 151 -> 156).
  Re-check each count against the description as the WEB-SPEC states it before writing.
- Lesson 19 FACTS 5 quotes Lesson 20's predict as the plan wrote it ("what best predicted", "How
  many of their tries came out right"); Lesson 20 now asks "Which went with playing it better?"
  with "What share of their tries came out right". Update the quote in the shared commit (after
  Lesson 20 is committed, with its final wording).
- SEASON-2 § 5.3: add "a drill that sings a run continuously and reads it note by note" (Lesson 20
  hand-back: no drill in the app or the plan does).
- Lesson 20 cites Lesson 18's ARTICLE-PLAN (FACTS 30) and Lesson 16's ARTICLE-PLAN (FACTS 54):
  rebind to their FACTS/LESSON once 16 and 18 are committed, if the lines still hold.
- App notes from Lesson 20 (VERIFIED by the lead 2 Nov 02:1x: Scale Runner's grade is
  round(acc*0.4 + best*0.15 + evenness*0.25), at most 80, and both drills read `difficultyFactor`,
  whose level rises at an average of 90; Staccato Precision scores pitch, best round and the attack's
  pitch, not timing. For the owner's report and the app's own list, not the page): Staccato
  Precision's help says it scores timing (`exercise-help.ts:206`); Scale Runner's grade tops out at
  80 against a level-up average of 90 (`use-scale-runner-controller.ts:198-204`,
  `adaptive-difficulty.ts:12-13`).
- Lesson 15 FACTS 5 and its CURIOSITY-MOMENTS § 2 entry describe Lesson 16's old predict (the
  plan's "What does she need to hear first?"); Lesson 16 now asks "Tavi sings the line with no note
  to start from. What will you hear?" (Lesson 16 hand-back). Update both in the shared commit, with
  Lesson 16's final wording, if the review keeps the new predict.
- From Lesson 18's hand-back (verify at the shared commit): Lesson 17's tease still and its FACTS 5
  still use the plan's C pitches, "the learner's clef" and Lesson 18's old predict choices; three
  edits listed in s2pkg/18-HANDBACK.md. Also a test gap for the owner's app list: the planning-text
  test's topic-code pattern misses lettered codes (S11a, S11b, S20a, S20b); verify before reporting.
- Lesson 20 citations in Lesson 18: DONE in L18 fix pass (all by path; committed 984c2c2dc).
- From Lesson 22's hand-back (verify at the shared commit): Lesson 21 FACTS 5's tease note says
  "steady note" where Lesson 22 now says "straight note"; SEASON-2 § 3 Lesson 22's card "inside the
  band counts in full" -> "counts in full"; SEASON-2 § 5.2 gains item 22, the centre-line hold
  reader (Lesson 22 WEB-SPEC item 6). Owner question taken as recommended: title "What is vibrato in
  singing? | MercuryPitch".
- App note from Lesson 24 (VERIFIED by the lead 2 Nov 08:1x): Drone Intonation's run score is
  round(accuracy*0.4 + best*0.15 + stability*0.25), at most 80 since richness left the grade on
  25 Oct without a reweighting (`use-drone-intonation-controller.ts:284-292`), and its level rises
  only at an EMA of 90 (`src/features/practice-intelligence/adaptive-difficulty.ts:12-13`), so it can
  never level up, as Scale Runner cannot. For the owner's report and the app's list.
- From Lesson 25's review: SEASON-2 § 3, Lesson 25's "Closes on" line ("So far you've sung against a
  drone that never moves...", SEASON-2.md:627-628) is false: Lesson 12's sing-along already sang over
  moving chords. Replace with the writer's line from the L25 hand-back.
- From Lesson 24: Lesson 23 FACTS 5 quotes L24's first answer as "It slows down, then stops"; it is
  now "It slows, then stops" (exact line in the L24 hand-back). SEASON-2 § 4.1's S20a row ("against a
  drone the third and fifth are intervals, not yet a chord", SEASON-2.md:754) no longer matches
  Step 2's chord: replace from the L24 hand-back.
