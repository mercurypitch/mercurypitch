# Lesson 21 review: Keys and the circle of fifths

Independent review of `docs/plans/find-your-pitch/lessons/21-keys-circle/` (FACTS.md, LESSON.md,
WEB-SPEC.md). I checked it against RESEARCH.md, ARTICLE-PLAN.md, BRIEF-21's four answers, the common
brief's list of what the Lesson 15 and 17 reviews caught, SEASON-2 § 1, § 3 (Lessons 20, 21 and 22),
§ 4, § 5, § 6.2 and § 7, CURIOSITY-MOMENTS § 1, HANDOFF § 5 and § 6, SEARCH § 3 and § 12, Lesson
15's package (the closest model), Lessons 4, 6 and 8 where the page leans on them, and the app at
`c60f0fdcb`. I read the hand-back note last.

The review was read-only. I ran the two node scripts and nothing else, edited nothing, and
downloaded nothing. I used one WebFetch, of OMT 2e 1.12, to check the newly quoted lines; every one
matched. A second fetch, of E&SJ 1.8, returned 404, so the E&SJ quotes were not checked again. I
worked all the arithmetic by hand.

**Counts: 0 blocking, 7 should fix, 14 nits.**

Line numbers are the package files' lines as they stand at 17:07.

---

## Should fix

### 1. On Pure, the walk is drawn falling short of C, but every other line says it overshoots C

- **Where:** WEB-SPEC:212 ("on Pure it stops short of C by the gap"); LESSON.md:257-258 ("on Pure the
  thread fails to meet C by the gap"); WEB-SPEC:53-54 (the gap drawn "between the walk's last bead
  and C").
- **What is wrong:** these lines contradict the page's own copy and its sound:
  - LESSON.md:250 and Quick check 4 say the pure fifths "overshoot".
  - The Notice (LESSON.md:255) says the walk "ends a little higher than it began".
  - The walk's last note is 265.19 Hz against C4's 261.63 Hz: 23.46 cents sharp (FACTS 31). I worked
    it by hand: 261.6256 × 531441/524288 = 265.195.
  - The circle's own announcement on Pure is "The walk ended 23.46 cents above C" (WEB-SPEC:218).
  - The plan's signature reads "twelve pure fifths overshoot, the gap shown"
    (ARTICLE-PLAN.md:130).

  The walk runs clockwise round the circle. A thread that "stops short of C" therefore reads as
  falling short, which is lower. The learner would hear a note that is too high while watching a
  picture that says too low.
- **Fix:** on Pure, draw the thread running clockwise past C by the gap: "on Pure it overshoots C by
  the gap, drawn and labelled '23.46 cents'". Do this in WEB-SPEC:212 and :53-54, and in LESSON.md:258
  ("on Pure the thread runs past C by the gap"). Add to WEB-SPEC Tests 4 that the gap is drawn past C,
  clockwise.

### 2. After a choice, replaying G major shows "Now play the other one." before either D major has played

- **Where:** WEB-SPEC:243-250 (Toys 5: `data-free` G major, `revealOn` both D plays,
  `revealAfter: 'all'`, and `next` set to "Now play the other one."); LESSON.md:120-124; FACTS 36.
- **What is wrong:** in the kit's predict, once a choice is in, every heard play that does not
  reveal sets `next`. That includes the free play (`heard()`, `src/features/lessons/kit/predict.ts`:
  `if (revealsAnswer(what) && answered()) showReveal(choice) else hint.innerHTML = ... opts.hints.next ?? opts.hints.chosen`).
  Here `revealsAnswer('G')` is false. So a learner who chooses and then replays G major, which is a
  natural thing to do, reads "Now play the other one." with no D major heard yet. Lesson 4's step 3
  predict, which the spec models this one on, has no free play, so the kit has never met this case.
- **Fix (either):**
  - Drop `next` and let the kit fall back to `chosen`, "Locked in. Play D major both ways.", which is
    true at every point before the reveal. This needs no kit change. Edit WEB-SPEC:248, LESSON.md:123
    and FACTS 36.
  - Or list a kit change under "What the kit and the app still need": show `next` only once at least
    one `revealOn` play has been heard, otherwise `chosen`. Add a test in Tests 3 (choose, play G
    major, and the hint is still `chosen`).

### 3. The circle's bead buttons can take the house past three sharps or flats, and the spec does not say what happens there

- **Where:** WEB-SPEC:203 ("A bead's key signature shows beside the circle ... when the house is on
  it"); :204-208 ("In Step 2 the house steps from C to A and no further ... in Step 3 from C to E♭");
  :215-217 (every bead is a button "that plays its scale and moves the house there"); Tests 4
  (:483-485); the Playground (Sections 11).
- **What is wrong:**
  - Every one of the twelve beads is a button that moves the house and shows its key's signature.
    One tap on E, B or A♭ then shows four or five sharps or flats. That breaks "C to A and no further"
    and SEASON-2 § 7 item 13 (reading stops at three).
  - Step back in Step 2 moves the house from C to F, a flat key, a step before flats are taught.
  - For the six keys past the reading range, nothing says what the buttons do. There is no octave
    for their scales and no spelling: one letter a degree gives B major's A♯ and D♯, F♯ major's E♯,
    and C♭ major's F♭. Nothing says how the two-name beads are named or announced either ("C♯ major
    or D♭ major, seven sharps or five flats"?).
- **Fix:** give each step its range. In Step 2, the beads from C round to A are buttons and Step back
  stops at C. In Step 3, the beads from C round to E♭. Elsewhere, beads past three sharps or flats show
  their name and play their scale (give the octave: say the first do of that key from C3 or C4 in the
  learner's clef), but draw no signature beside the circle. Name the bottom three with both names
  ("B major or C flat major"). Add these to Tests 4 and to "What the kit and the app still need",
  item 4.

### 4. White keys only, once the key signature is drawn, would need a natural sign that no lesson has taught

- **Where:** WEB-SPEC:154-161 (Toys 1). The first G major play moves F♯'s sharp into the signature,
  and "From then on G major is written with the signature". White keys only can then be switched on
  again (the Try, LESSON.md:177).
- **What is wrong:** under a one-sharp signature, the white keys' F must be written F natural with a
  ♮. The kit's glyph list has no natural (Lesson 15 WEB-SPEC:215 lists the notehead, the sharp and the
  flat), and no lesson in either season has taught the sign. The spec does not say what the staff
  shows.
- **Fix:** say it. With White keys only on, the staff drops the signature and writes G A B C D E F G
  plain. Switching it off brings the signature back as the scale ends, which keeps sound before
  symbol. Add a line to Tests 1. If a natural is wanted instead, it is new copy and needs a fact.

### 5. The built page's margin under the cap rests on "about 150" extra words, which is low for this page

- **Where:** FACTS 3 (FACTS.md:51: "about 2,348, 31 under the series' cap, so no cut is needed");
  WEB-SPEC Length (:122-128).
- **What is wrong:**
  - Lesson 8 FACTS 4, the source of the 150, shows its own text package's 2,328 words becoming 2,502,
    and now 2,534, on the built page. That is 174 to 206 words more, not 150.
  - This page's own hints, which lesson-words leaves out because they sit in parentheses, come to
    about 180 on my count:
    - Find do's lines, about 76: the three "Do is G. The last sharp, F♯, is ti." lines (9 words each),
      "One flat: F major.", the two second-to-last-flat lines, the three "That's ..." lines, "All six
      found.", Next round and Again.
    - The predict's hints, about 29.
    - The two figure captions, about 20.
    - Spell it's live lines, about 12.
    - "Play Merc's notes first" and "Keep the voice you chose before, or change it:", about 13.
    - Toy labels, about 30.

  So the built page lands at about 2,380, on the cap or just over it. "No cut is needed" is
  therefore not safe. Step 5 still stays: 2,198 is under the brief's 2,230.
- **Fix:** in WEB-SPEC Length and FACTS 3, count this page's own hint lines instead of borrowing
  Lesson 8's figure. Say the built page may land at the cap, and either commit to the two cuts already
  named (Step 2's drawer, about 37 words; the reveal's last sentence, 16) or trim about 30 words now.
  Find do's three sharp lines could share one form ("Do is A: a semitone above the last sharp.").

### 6. The predict's answer is in Lesson 4's reveal, word for word, and most learners will recall it rather than predict it

- **Where:** LESSON.md:115-116 (the predict); FACTS 1a, which notes the overlap; hand-back question
  4.
- **What is wrong:**
  - Lesson 4's reveal reads "Keep the major pattern instead and you need two black keys, F♯ and C♯"
    (`lessons/04-major-scale/LESSON.md:122`).
  - Its Step 5 reads "from D, ti is C♯" (`:162`).
  - Its quick check 2 lists D major's notes.
  - Lesson 4 sits on this page's prerequisite path (6 via 4).
  - SEASON-2's own card (`SEASON-2.md:403-407`) frames the lesson as asking "what Lesson 4 did not":
    *why* the sharps pile up.

  The predict asks *which* sharp, which Lesson 4 answered. Leaving Lesson 4's question 2 out of the
  recall does not change that. The writer saw the problem and kept the plan's predict. I agree it is
  the lead's call. Here is a concrete alternative that keeps the title and every step.
- **Fix (proposed, for the lead):** move the predict to A major's third sharp, which no earlier
  lesson builds.
  - Hero: D major from D4, then A major from A3 (a fifth below, or A4 a fifth above).
  - Merc: "A is a fifth above D. A major keeps D's F♯ and C♯, and it needs one sharp more."
  - Tavi: "F, then C. The next letter after C is D. Isn't the new sharp D♯?"
  - Choices: [ D♯, the next letter after C ] [ G♯, the note just below do ].
  - The two plays: A with D♯ (A B C♯ D♯ E F♯ G A, which runs 2 2 2 1 2 1 2) and A with G♯ (A major).
  - The reveal says the same thing one key later.

  The leak check carries over: Step 2 names G♯, so the tour hold stays. The title ("G major needs one
  sharp and D major two") does not leak. If the lead keeps the D major predict, add a line to FACTS 1a
  saying the choice was made knowing this.

### 7. On a page that defines "key" as a scale, Tavi's line, the mix-up card and Quick check 3 use "key" for a piano key

- **Where:** LESSON.md:205 (Tavi: "A♯ and B♭ are one key."); :213 (belief: "A♯ and B♭ are the same
  key: a key can use either."); :217 ("The key decides which name a black key takes."); :318 (Quick
  check 3: "A♯ is the same key").
- **What is wrong:** the four words have just taught "Key: the scale a piece uses" (LESSON.md:156).
  The mix-up's belief then uses "key" in both senses in one line, and the better idea uses "key" and
  "black key" side by side. Step 3's own body has to explain "on a piano they're one key". For a
  beginner on this page, "A♯ and B♭ are the same key" reads as "the same scale".
- **Fix:** where a piano key is meant, say "black key" or "piano key":
  - Tavi: "A♯ and B♭ are one black key. Can't F major use A♯?"
  - Belief: "A♯ and B♭ are the same black key: a key can use either."
  - Quick check 3's feedback: "A♯ is the same black key, but ..."

  Each change adds one word. FACTS 22 records the card's wording change.

---

## Nits

### 8. The prerequisite chips invert the precedent that FACTS 2 cites

- **Where:** LESSON.md:84-85 and FACTS 2 (FACTS.md:50).
- **What is wrong:**
  - The built pages print the full title for an "After" chip: "After Lesson 6: Intervals: the
    distance between notes" (`learn/09.html:343-345`, `learn/10.html:348-350`).
  - They print the short name for an "Also useful" chip: "Also useful: Lesson 6, Intervals"
    (`learn/08.html:340-341`).
  - Lesson 17 FACTS 2 sets out the same rule.

  This page does the opposite: short names on both After chips ("Intervals", "The staff") and the
  full title on the plain chip ("Resonance and vowels"). FACTS 2's "as Lesson 17's chip names 'Lesson
  15, The staff'" compares an After chip with a plain one.
- **Fix:** either follow the built pages ("After Lesson 6: Intervals: the distance between notes ·
  After Lesson 15: The staff: where notes sit · Also useful: Lesson 13, Vowels"), or keep the short
  names and record them as a departure for the lead, with the right precedent.

### 9. The frequency lists are incomplete

- **Where:** FACTS 60 (FACTS.md:128); FACTS 31 (:87); WEB-SPEC Tests 4 (:483-484).
- **What is wrong:**
  - Find do plays do, mi and so from the tapped place. From the treble's top places that reaches
    notes FACTS 60 does not list: E♭5 gives B♭5 (932.33 Hz), F5 gives C6 (1046.50 Hz), and G5 gives
    B5 (987.77 Hz) and D6 (1174.66 Hz).
  - Tests 4 holds the pure walk "to FACTS 31's" thirteen frequencies, but FACTS 31 gives only the
    first and the last. The thirteen are in WEB-SPEC Audio, and FACTS 60 says they are "of 31".
- **Fix:** add the four notes to FACTS 60, and add the thirteen walk frequencies (checked: 261.63,
  392.44, 294.33, 441.49, 331.12, 496.68, 372.51, 279.38, 419.07, 314.31, 471.46, 353.59, 265.19) to
  FACTS 31.

### 10. Two note lengths the timings rest on are not written down

- **Where:** FACTS 62 and 63; WEB-SPEC Audio (:324-326).
- **What is wrong:** the 2.37 s of Step 2's scales and the 3.85 s of the equal-temperament word assume
  notes 0.27 s and 0.25 s long. The verifier uses those lengths. The package never states them, so a
  builder has to work backwards from the totals.
- **Fix:** state both: "0.3 s apart, each 0.27 s" and "thirteen notes 0.3 s apart, each 0.25 s".

### 11. Step 3 calls the white-key B "F major's fourth note"

- **Where:** LESSON.md:207, "On white keys, F major's fourth note, B, sits a tone above A".
- **What is wrong:** F major's fourth note is B♭, which is the step's point.
- **Fix:** "On white keys, the fourth note from F, B, sits a tone above A". The word count is the
  same.

### 12. The guide's line counts in twice before anything sweeps

- **Where:** LESSON.md:291, "The guide counts you in on so, and again before the second run, then a
  line sweeps along the notes."
- **What is wrong:** the sentence puts both count-ins before the sweep. The sweep in fact runs between
  the two count-ins.
- **Fix:** "The guide counts you in on so, then a line sweeps along the notes, and it counts you in
  again before the second run."

### 13. The coach's list and the spec say different things about when the feeling question comes

- **Where:** the coach list, LESSON.md:455 ("asked after each run of the guide"), against WEB-SPEC
  Toys 7.6 (:281, "after each guide that runs to its end").
- **What is wrong:** the guide has two runs, C and G. The coach's wording could be read as asking
  between them.
- **Fix:** "after each time the guide runs to its end".

### 14. The stairs' syllables are held until the choice, but Step 1's caption says "its ti" from the start

- **Where:** WEB-SPEC:162-163 (the stairs' syllables "show only ... after the cold open's choice")
  against the caption at :161, "Fig. 1 G major: one sharp, F♯, its ti.", and Step 1's text
  (LESSON.md:174).
- **What is wrong:** the caption and the text say "ti" before the choice, so the hold on the
  syllables protects nothing. FACTS 1a already accepts that Step 1 shows G major's ti, and the tour
  waits for the choice.
- **Fix:** drop the syllable hold, or hold the caption's "its ti" with it. Make FACTS 1a say which.

### 15. The lesson files cite "the brief"

- **Where:** LESSON.md:17 ("under the 2,230 the brief allows"); FACTS 3; FACTS 54 ("given in the
  writer's brief"); WEB-SPEC:122.
- **What is wrong:** a reader of the repository cannot trace the brief. The lead's decision on the
  sing-along has no source in the repository.
- **Fix:** cite "the lead's decision of 1 November 2026". For the 2,230, give the reason: the built
  page's extra words under the 2,379 cap. The hand-back should ask the lead to record the sing-along
  decision in SEASON-2 § 3's card, whose checkpoint still says do re mi fa so.

### 16. FACTS 5 takes a number from a Lesson 22 source that Lesson 22's research says not to use for numbers

- **Where:** FACTS 5 (FACTS.md:53).
- **What is wrong:** the alternative tease's "far more than two cents" cites Timmers and Desain's 0.6
  to 2 semitones (`lessons/22-vibrato/RESEARCH.md:57-58`). Lesson 22's research marks that source
  "Not used for a number; superseded by R3". R3, Sundberg's "less than ±1 semitone", is a ceiling
  only.
- **Fix:** rest the claim on Lesson 22's plan instead, Merc's ±50 cents (`ARTICLE-PLAN.md:27-28`), or
  on R3 together with the plan.

### 17. The head leaves out the structured data and the llms.txt line

- **Where:** WEB-SPEC, "What the kit and the app still need", item 2.
- **What is wrong:** the item gives no structured data and no llms.txt line. Either one could carry
  the answer, for example a `teaches` entry reading "each new sharp is the key's ti".
- **Fix:** give `timeRequired` `PT16M`, the `teaches` items (for example "Building a major scale on
  any note", "Key signatures of up to three sharps or flats", "The circle of fifths", "Why twelve
  notes: equal temperament") and the llms.txt line. Check each against the predict, as Lesson 15's
  item 10 does.

### 18. Look does not say what colour a note lights in when the soft tone plays it

- **Where:** WEB-SPEC:44-45, "A note lights in its singer's colour ... by the voice that plays it".
- **What is wrong:** the steps' scales play in the soft tone, which belongs to no singer, so the rule
  does not say what colour they light in.
- **Fix:** say "by the staff's clef: blue on the bass staff, orange on the treble".

### 19. FACTS 40 cites the wrong file for what Compose's sidebar holds

- **Where:** FACTS 40 (FACTS.md:102).
- **What is wrong:**
  - The claim "Compose's sidebar holds Playback Setup" rests on the panel's own file. The source is
    the sidebar's layout: `[TAB_COMPOSE]: ['library', 'playback-setup', 'mic', 'note-list']`
    (`src/features/sidebar/sidebar-registry.ts:118`).
  - The panel only shows while `showPlaybackSetupInfo()` is on (`PlaybackSetupPanel.tsx:35`). That
    setting is on by default and can be switched off in Settings (`src/stores/settings-store.ts:677-678`).
- **Fix:** cite the registry, and add the setting to WEB-SPEC Edge cases ("Playback Setup turned off
  in Settings: the card's step is not there").

### 20. Quick check 4's feedback says the octaves stay pure, which no fact records

- **Where:** LESSON.md:327, "The octaves stay pure, 2 to 1."
- **What is wrong:** the line is true of equal temperament as the app computes it (440 × 2^((n −
  69)/12)), but no fact records it, and FACTS 73 even notes that real pianos stretch their octaves.
- **Fix:** add to FACTS 32: "equal temperament keeps every octave at exactly 2 to 1" (Lesson 1's 2:1;
  the formula). List Quick check 4's feedback where it is used.

### 21. Test 8 cannot pass as written, and the Contract's leak line is too broad

- **Where:** WEB-SPEC Tests 8 (:493-495) and Contract (:508).
- **What is wrong:**
  - Test 8 asks that nothing above the reveal names C♯. The predict's own choice, "C♯, the note just
    below do", and the button "Play D with C♯" both do, so the test fails as written.
  - Test 8 also lists the step headings and the recall, but not the menu card's line.
  - The Contract's "Nothing before the reveal names D major's new sharp" is too broad for the same
    reason.
- **Fix:** exempt the predict's choices and its locked plays. Check C♯, "ti" and "just below do" in
  the head, the share card, the title, the promise, the gate, the menu card's line, the step and
  section headings, the recall and the four words. Word the Contract line to match.

Smaller points, with no separate number:
- FACTS 3 lists the steps' counts twice in one sentence ("runs 116, 119, 120, 120 and 110 words
  (Steps 1 to 5: 116, ...)").
- Find do, the small staircase under each predict play, and the four words' three new figures are
  new parts. Each appears in the Toys table, but none is in "What the kit and the app still need".

---

## Checked and found sound

- **Leaks**, checked against the predict ("which note does D major add as its second sharp", answer
  C♯, its ti). None of these leaks:
  - the title and hook;
  - the promise;
  - the sound gate;
  - the head title (54 characters);
  - the description (151 characters, which I counted by hand);
  - the og:title and the share descriptions;
  - the share card, which shows G major only;
  - the five step headings, and the menu card's "Lesson 21 · Why does G major need F♯?";
  - the section headings and their lines;
  - the recall (Lesson 6's fifth, Lesson 15's E-F-G);
  - the four words and their figures;
  - the locked play labels, which name both options alike;
  - the explorer card;
  - both teases for Lesson 21's card.

  Step 1's stage does show G major's ti before the choice, and the tour is held (`holdTour`,
  `tour-gate.ts:57-69`). That meets the rule the Lesson 15 review set.
- **Musical arithmetic:**
  - The scales of G, D, A, F, B♭ and E♭ major, each with one letter a degree.
  - The white keys from G (2 2 1 2 2 1 2) and from F (2 2 2 1 2 2 1).
  - D major with G♯ (2 2 2 1 2 1 2) and with C♯ (2 2 1 2 2 2 1).
  - Each key a fifth up adds its ti (the old key's fa raised); each key a fifth down adds its fa (the
    old key's ti lowered).
  - The orders of sharps and flats.
  - The circle's order, with the bottom three at 5, 6 and 7 o'clock (B/C♭, F♯/G♭, C♯/D♭).
  - Every signature place in both clefs, checked against standard engraving and against VexFlow's
    tables:
    - sharps on lines 0, 1.5 and −0.5, flats on 2, 0.5 and 2.5;
    - the bass clef one line lower;
    - treble F5 C5 G5 and B4 E5 A4;
    - bass F3 C3 G3 and B2 E3 A2.
  - Find do's eleven places (F2 to B3 and D4 to G5) and every do's place in them.
  - The staff range in both clefs (F2 to E♭4 and B♭3 to A5, inside two ledger lines).
- **Tuning arithmetic:**
  - 12 × 7 = 84 = 7 × 12.
  - 1200 log2(1.5) = 701.955 cents; 2^(7/12) = 1.49831 (Rubinstein's misprint avoided, as BRIEF-21
    asked).
  - (3/2)^12 / 2^7 = 531441/524288 = 1.013643, which is 23.46 cents, 0.2346 of a semitone.
  - 23.46 / 12 = 1.955 cents.
  - All thirteen pure-walk frequencies, worked by hand.
- **Timings:** 3.15 s, 2.3 s, 2.7 s, 6.8 s, 7.6 s, 5.4 s, 12.8 s and 13.8 s all check. The run time
  checks: 2,198 / 238 = 9.235 minutes, plus 385 s, gives 15.65, so the chip reads 16.
- **Sing-along (BRIEF-21 answer 1, carried out correctly):**
  - so la ti do in C, then in G: G3 A3 B3 C4, then D3 E3 F♯3 G3; and G4 A4 B4 C5, then D4 E4 F♯4 G4.
  - The table checked against `VOCAL_RANGES` at `c60f0fdcb` (`settings-store.ts:91-152`), every
    figure right: tenor and soprano 2 below, bass 4 above, and the rest wider.
  - The octave-up and octave-down arithmetic in FACTS 55 checks.
  - "Join in on ti" stays inside every preset.
  - The leap between runs is C4 to D3, ten semitones.
  - The key choice is flagged for the coach.
- **Shared lines,** word for word with Lesson 15's (`lessons/15-staff/LESSON.md:269-308`): the
  comfort check, the voice buttons and the stored-voice line, the stop line, the speaking-volume line,
  "Nothing listens here ...", the four feelings and their gentle and enough-for-today lines, and the
  doctor lines. "Just listen today" is adapted as stated. The rest card matches Lesson 8's
  (`08-beat-tempo-backbeat/LESSON.md:324-326`). Leaving out the clef line follows Lesson 17's
  precedent.
- **Recall:** both questions match their sources word for word, `l06-q2`
  (`lesson-06/quiz-questions.ts:64-84`) and Lesson 15's question 2. The `linkAway` and
  `recallStepHref` behaviour is as described.
- **Citations:** plan-cites reads 200 citations with 0 findings. I read the following at
  `c60f0fdcb`, and each says what the package says it does:
  - predict.ts (the hint fields, `revealAfter: 'all'`, the free play; see finding 2);
  - tour-gate, lesson-menu, step-deck and tour-copy;
  - quiz.ts (:141-143, :186-216, :315);
  - `VOCAL_RANGES`;
  - PlaybackSetupPanel: view-only outside Compose, transposition by the `KEY_OFFSETS` delta, the
    eight keys;
  - `KEY_SIGNATURES` and `KEY_OFFSETS`;
  - sheet-music-renderer: `useFlats` at :494, `chooseClef` by median at :175-183, the signature at
    :572, and `Accidental.applyAccidentals`, so the signature's notes carry no sign;
  - Compose's sheet view takes `keyNameSignal` (`App.tsx:4398-4402`);
  - FACTS 42's clef sequence, which I worked by hand (C bass, G treble, D bass, A treble, F bass, B♭
    treble);
  - the Singing tab's phone stage has no sheet view;
  - the Compose toast;
  - the melody seed (`scale-major-c3`) and the default `keyName` 'C';
  - Ear Lab Home: the I-IV-V-I cadence, `HOME_DEGREES`, the C3 to B3 rove, tap by default, the bench
    entry;
  - Sight-Singing's `NOTE_NAMES`;
  - the lesson marker and First Light;
  - season.ts (:11-13, :39-42, :91-106, :267-268, :303-324, :398-399);
  - lesson-copy.ts (:31-34, :61-62, `TEASE_MAX` :76);
  - next-card.ts (the slot keeps a page's figure);
  - explorer `practiseMarkup`; voice-choice; move-do `countIn`; comfort `afterFeeling`; sound.ts;
    notes.ts `hz` and `spellScale`; major-scale; spiral; key-strip; home-glyph; now-playing;
  - Lesson 4's steps.ts and stairs-toy.ts;
  - vexflow pinned at 5.0.0 in the lock file.
- **External sources:** the OMT 2e 1.12 quotes in FACTS 15, 17 to 21 and 23 all match the page
  verbatim (WebFetch).
- **Teases (BRIEF-21 answer 4):**
  - 69, 62, 61 and 65 characters, all inside `TEASE_MAX`, which I counted by hand.
  - The plan's line is 107 characters and Lesson 20's 79, as stated.
  - Lesson 22's tease is its opening's set-up and names no middle, centre or average (Lesson 22
    ARTICLE-PLAN:27-35, :42).
  - Lesson 21's own tease does not leak.
- **Step 5 (BRIEF-21 answer 2):** kept in the page at 2,198 words, under the brief's 2,230, with the
  reason given. lesson-words agrees: 2,198 in all, steps 116, 119, 120, 120 and 110. Finding 5 is
  about the built page only.
- **Rubinstein (BRIEF-21 answer 3):** cited for his cents figure only, and the ratio worked in FACTS
  29.
- **The Compose departure:** justified by the code (view-only key picker in the Singing tab; no sheet
  view on the phone stage).
- **Copy:** British spelling throughout, no emojis, no model names, paths or agent ids in the lesson
  files. Tavi's two lines are sincere guesses. Every heading is a question.
- **The hand-back's claims match the package:** the word count, plan-cites, the departures, the
  season entry, the teases and their lengths.
