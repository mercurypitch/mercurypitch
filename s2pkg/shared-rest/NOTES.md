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
- App notes from Lesson 27 (VERIFIED by the lead 2 Nov 11:4x at c60f0fdcb): Chord Stacker plays notes
  1 to 3 for about 0.3 s each at every level. It awaits `audioEngine.playTone`, which settles once the
  tone is scheduled, then only `GAP_BETWEEN_NOTES_MS` (300) before the next note cuts it off
  (`src/features/exercises/chord-stacker/use-chord-stacker-controller.ts:32`, `:149-155`). Arpeggio
  Jumper waits each tone out (`use-arpeggio-jumper-controller.ts:316-319`). App fix: wait out
  `notePlayDurationMs` the same way. Its help text describes a sustained stack that never sounds
  ("each one tuned against the notes already sounding", `src/features/exercises/exercise-help.ts:194-197`,
  summary line included): replace it with the Lesson 27 hand-back's proposed text (app content, for the owner).
- App notes from Lesson 26 (VERIFIED by the lead 2 Nov 12:5x at c60f0fdcb): (1) Jam's Harmony Stack
  boxes print the tune's letters on the harmony part: `harmoniseItems` rewrites MIDI, octave and
  frequency but keeps the note's name (`src/lib/jam/jam-modes.ts:134-153`), so the third over C4..B4
  reads C4, D4, E4, F4, G4, A5, B5 (Lesson 26 WEB-SPEC item 15 has the fix and test). (2) A friend who
  joins a Jam room after the host picks a drill or mode never receives either: `onPeerJoined` re-sends
  only a loaded song (`src/stores/jam-store.ts:1971-1983`), and the mode travels only inside a melody
  message. App fix: send the drill and mode to a peer whose channel opens, with a late-join test
  (Lesson 26 hand-back). The card is worded so the friend joins first.

## Draft status (2 Nov 18:1x, lead)
- Lessons 15-27's shared edits are DRAFTED as a content-only patch: s2pkg/shared-rest/draft/shared-16-27.content.patch
  (made in a detached worktree /dev/shm/s2shared at 85ccd03dd; applies with `git apply` on any commit whose
  shared files match 85ccd03dd, e.g. Lesson 28's commit). Contents: MASTER-PLAN § 11 lines 16, 18, 20, 22, 24-27;
  CURIOSITY-MOMENTS § 2 entries 16, 18, 20, 22, 24-27 (every quote checked against the committed lessons, checkq2.py);
  SEASON-2: card 18 signature, card 22 checkpoint, cards 24-27 "Closes on" in the settled form, S20a row,
  § 5.2 items 10 (L16 a/e), 11 (L18), 15 (L24), 18 (L27 Chord Stacker), new 22 (L22), 23-24 (L26 Jam),
  § 5.3 (L20), § 6.1 item 6, § 6.2 items 5 and 7 (L26); L15 FACTS 5 x2 + CM entry + WEB-SPEC Toys 8;
  L17 FACTS 5 x3 (+ L18 LESSON cites), LESSON still, WEB-SPEC Toys 11; 17/19/21 descriptions as words;
  L19 FACTS 5 (quote + LESSON.md:123-125); L20 FACTS 30 (L18 page cites); L21 FACTS 5 x2; L23 FACTS 5;
  L25 FACTS 5 (N9); six facts that quoted replaced card lines (L25 x2, L26, L27 pinned "at `85ccd03dd`";
  L18 FACTS 5 and L22 FACTS 68 reworded).
- Not taken: card 17's closing line stays (L18 hand-back: "two" no longer leans); L26 entry 5 (L28's plan
  recall: the plan is an input; L28's page chose its own recall); SEASON-2 § 5.1 row 22 (optional).
- Pipeline for the real run, on s2plan after Lesson 28 is committed:
  1. `git apply .../draft/shared-16-27.content.patch`, then add L28's entries (below);
  2. `node scripts/plan-cites.mjs reanchor --base HEAD --write > rw.txt`;
  3. `python3 -I .../draft/repoint.py /dev/shm/s2plan HEAD rw.txt --write` (maps "rewritten"/"edited" by line diff);
  4. `node scripts/plan-cites.mjs check docs/plans/find-your-pitch` must give 200 (diff with line numbers
     stripped against the pre-commit run; the two section findings in L9/L14 move digits only).
  Test run on the draft: 216 moved, 48 re-pointed, 200 findings, none new.
- Lesson 28 wave, still to add: its MASTER-PLAN line and CM entry (from the final hand-back); SEASON-2 card 28
  (Misconception, Practise, Facts to check), § 5.1 row 28, § 6.2 item 1 (season close required), § 6.2 item 7
  (L28's alone path records the take), trailer card line if kept; L27 FACTS 5 (43) still describes L28's PLAN
  predict ("whether the chord under do changed or the top part sang a different note") and plan reveal
  ("sounds like an ending and swerves") and Tavi's "sounded finished": rewrite to L28's final predict and
  wording, cite L28's LESSON.md lines.
