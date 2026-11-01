# Lesson 23 review: Perfect, major, minor and the tritone

Independent review of `docs/plans/find-your-pitch/lessons/23-perfect-tritone/` (FACTS.md, LESSON.md,
WEB-SPEC.md) in `/dev/shm/s2plan` at `271dc369a`. I checked it against:

- RESEARCH.md and ARTICLE-PLAN.md;
- BRIEF-23's four answers and the common brief's list of what earlier reviews caught;
- SEASON-2 § 1, § 2, § 3 (Lessons 22 to 24 and 27), § 4.3, § 5, § 6.2 and § 7;
- CURIOSITY-MOMENTS § 1, § 3.1 and § 5, HANDOFF § 5 and § 6, SEARCH § 3 and § 12, TEACHING-PLAYBOOK,
  MERC-BIBLE and the header of `kit/lesson-copy.ts`;
- Lesson 15's package (the model for Sing it), Lesson 21's committed package, Lessons 2, 4, 6, 8, 9
  and 10 where the page leans on them, and the plans for Lessons 22, 24 and 27;
- the app at `c60f0fdcb`. The branch changes only docs, so I read the worktree's `src/`.

I read the hand-back last.

The review was read-only:

- I ran the two node scripts.
- I used `python3 -I -c` only for arithmetic and character counts.
- I made two WebFetch reads. OMT 2e 1.15: all eight quotes I checked match word for word, including
  the new "Size is considered generic." and "Example 4 shows how these qualities are applied today."
  Wikipedia "Tritone": the five quotes FACTS 19, 36, 37 and 38 use all match.
- I edited nothing and saved no downloads.

**Counts: 0 blocking, 5 should fix, 10 nits.**

Line numbers are the package files' as they stand at 20:51.

---

## Should fix

### 1. Before the choice, the steps' toy can sound F♯, fold the fifth and show every lane, though four places say it cannot

- **Where:**
  - LESSON.md:55-57 ("before it the toy reaches no black key and folds nothing");
  - FACTS 1a (FACTS.md:51: Sharp, Flat, Fold and Curl are "the only ways to a black key, a fold or
    the ring");
  - WEB-SPEC:213-216 ("before it the toy reaches only white keys ... Step up, Step down and the step
    plays work from the start");
  - WEB-SPEC:586-588 (Edge cases);
  - WEB-SPEC:667-670 (Test 18: "the steps' toy shows no black key");
  - hand-back § 6 item 6 ("the toy cannot reach F♯ or fold the fifth before the choice").
- **What is wrong:**
  - **The step plays are open from the start.** WEB-SPEC:215-216 says so. Three of those plays work
    against the lock:
    - Step 2's "Play C up to F, then F♯" (WEB-SPEC:224-227; FACTS 70) sounds F♯. It names F♯ on the
      pitch line ("Only a lit note is named", WEB-SPEC:50) and writes it on the staff. By Toys 1's
      readout rule (WEB-SPEC:192-197), the readout then says "4 letters · 6 semitones · an augmented
      fourth, a tritone". That is the predict's answer, whole.
    - Step 3's "Play C up to G, then G up to C" is "drawn as the fold draws it" (WEB-SPEC:228-230).
      That draws the fifth and its upside down filling the octave, 7 + 5, which is exactly what the
      lock on Fold was meant to hold back.
    - Step 1's "Play C up to E♭" reaches a black key too. That one does no harm, but it still makes
      "the only ways to a black key" false.
  - **The lanes are drawn.** The pitch line is "on" in every state of this page (WEB-SPEC:177-180),
    with "the black-key lanes fainter" (WEB-SPEC:49-50).
    - Before the choice, a learner who presses Step up to G sees G light seven lanes up, past a faint
      unnamed lane at six.
    - The hero withholds its lanes for exactly this reason (FACTS 40: a ruler that puts F♯ in its
      middle).
    - Test 18's "shows no black key" then contradicts Look.
  - **How a learner meets it.** Reaching Step 2 or 3 before choosing needs Next on the deck, and Step
    2's own text says the same thing in words. The deck's convention (Lessons 15 and 19) is that step
    text may reveal, and the tour is held. But this package claims a stronger defence than the spec
    delivers, and Test 18 cannot pass as written.
- **Fix:**
  1. Add the plays that sound or draw the answer to the predict's `unlocks`: Step 2's two plays and
     Step 3's two.
  2. Draw the steps' pitch line with no black-key lanes (or no lanes) until the choice, as the hero
     draws none.
  3. Reword LESSON.md:55-57, FACTS 1a and WEB-SPEC:213-216 to say what is locked. Say that Step 1's
     E♭ play stays open, because a minor third answers nothing.
  4. Make Test 18 check the lanes and those four plays.

  Alternatively, keep the plays open, correct the four claims and rest the case on the step deck. But
  then say plainly that Step 2's play shows the answer before the choice.

### 2. The predict can be answered from Lesson 6 and the stage's own label, and the recall prints the deciding fact right under the choices

- **Where:**
  - LESSON.md:113-116 (the stage, "an octave: 12 semitones");
  - LESSON.md:123 (Tavi: "The fifth sits right in the middle");
  - LESSON.md:153-159 (recall 1: "7 semitones: a perfect fifth");
  - FACTS 1a (FACTS.md:51) and FACTS 7 (FACTS.md:59).
- **What is wrong:**
  - **The stage and the bubbles hold most of it.** Before the choice the learner reads that the
    octave is 12 semitones (the stage) and that G is the fifth (Tavi).
  - **The recall supplies the rest.** On a phone the choices sit below the first screen and the
    recall follows soon after (CURIOSITY-MOMENTS § 3.1). Its first question offers "7 semitones: a
    perfect fifth" as a visible option, and its feedback confirms "C up to G is seven". So 7 and 5:
    G does not split the octave evenly.
  - **Lesson 6 already gave the other half.** Its cold open moved "Twinkle" "up six semitones" from
    C to F♯ (`lessons/06-intervals/LESSON.md:46`, then "Play from F♯"). Its Step 5 counts C up to G
    as a fifth of seven semitones. And its quick check 1 says "Every note moved up six semitones".
  - **The common brief's rule.** "A predict must not ask what an earlier lesson already answered."
    No earlier lesson says "half", but this predict is one subtraction away from Lesson 6, the only
    prerequisite.
  - **What FACTS 1a says.** It argues this is "the reasoning the predict asks for". It leaves out
    question 1 for its "six semitones" but keeps question 2, which carries the other number.
  - **Whose call.** SEASON-2's card designed the cold open this way ("the fifth is 7 semitones of
    12; the half is 6", `SEASON-2.md:504-505`), so this is the lead's call. Lesson 21's review raised
    the same kind of item.
- **Fix (for the lead):**
  - **(a)** Keep the predict as a deliberate reasoning check, and say so in FACTS 1a: name Lesson
    6's cold open, its Step 5 and its quick check 1 as the facts it rests on.
  - **(b)** In any case, take recall question 2 off this page. Ask Lesson 6's questions 3 and 4
    instead: question 4 checks that sizes, not ups and downs, make a tune, which is still interval
    work. That way the page does not print "7 semitones: a perfect fifth" one scroll below the
    choices.
  - If the lead keeps question 2, record in FACTS 1a that this was decided knowing the leak.

### 3. The reveal says how G and F♯ sound to the learner, where the page's own rule is "counts as"

- **Where:**
  - LESSON.md:143-144 ("And played with C, G sounds settled, while F♯ sounds restless, as if it
    wants to move.");
  - LESSON.md:245 ("Exact, yes, but not calm.");
  - FACTS 26 (FACTS.md:90) and FACTS 25 (FACTS.md:89).
- **What is wrong:**
  - **What FACTS 25 promises.** It says the page uses "counts as", "never that every listener hears
    it so", because OMT warns that "These categorizations have varied with milieu".
  - **What the reveal does.** It tells every learner what they hear: G "sounds settled", F♯ "sounds
    restless". FACTS 26 calls this "a description of how the two sound in this music", but it rests
    only on OMT's classes. No listener study is cited.
  - **The contrast with Lesson 4.** Lesson 4, whose ti line this page leans on, hedged a similar
    claim with a source: "most listeners hear ti lean up to do" (`04-major-scale/LESSON.md:250`).
  - **Step 4's "not calm".** It is a milder form of the same claim.
- **Fix:** keep the hook's words but frame them as music's convention. Two wordings:
  - "And played with C, G counts as settled, while F♯ counts as restless, as if it wants to move."
  - "In this music, G with C is heard as settled and F♯ as restless."

  For Step 4: "Exact, yes, but not settled: the tritone counts as a dissonance ...". Then update FACTS
  26 to quote what the page says.

### 4. The reveal's "the scale's eight notes" counts the scale differently from Lessons 10 and 21

- **Where:**
  - LESSON.md:144-145 ("(G is the fifth of the scale's eight notes, near their middle, which made it
    a fair guess.)");
  - FACTS 42 (FACTS.md:112) and FACTS 45 (FACTS.md:115: "C, D, E, F, G, A, B, C has eight notes").
- **What is wrong:**
  - **Earlier lessons say seven.** Lesson 10 asks "How many of the seven notes"
    (`10-major-minor/LESSON.md:209`). Lesson 21 lights "D major's seven notes" (`21-keys-circle/
    LESSON.md:115`). Lesson 4 counts ti as "the seventh note" and teases "seven stairs ... one short
    of home".
  - **One word, one meaning.** The common brief asks for it. Here "the scale's notes" would mean
    seven in three lessons and eight in this one.
  - **The middle moves with the count.** Of seven notes, the middle is F, so the parenthesis also
    only works under its own count.
- **Fix:** say it in the series' terms: "(G is so, the scale's fifth note, near the middle of do up
  to do, which made it a fair guess.)" Change FACTS 45 to match.

### 5. "The devil in music" says something about a ban, which the season's card held back until its sources are read, and LESSON.md does not list it as a departure

- **Where:**
  - LESSON.md:258-261 ("Stories that the Church punished singers for it are probably just that:
    stories.");
  - FACTS 38 (FACTS.md:105);
  - the LESSON.md preamble, whose Go deeper bullet (lines 66-69) names only the untranslated Fux.
- **What is wrong:**
  - **The card's instruction.** SEASON-2's card says "**not verified** in those sources, so nothing
    about a ban is said until they are read" (`SEASON-2.md:527-529`). FACTS 38 quotes that, then
    goes ahead.
  - **The only support for the punishment claim.** It is Wikipedia's "likely fanciful", which FACTS
    38 itself notes is "citing nothing for it".
  - **What the Weak source covers.** Sword 2022's quote from Kelly is about the *nickname's* date
    ("not aware of any medieval references to" diabolus in musica), not about any punishment.
    Turning that into "probably just stories" is an inference.
  - **The departure is not listed.** It appears in the hand-back (§ 6 item 10), not in LESSON.md's
    preamble.
  - **A smaller point.** "bars the tritone leap" drops the source's "in Contrapuncto". The drawer
    says "counterpoint textbook" earlier, so this is minor.
- **Fix:** cut the last sentence, so the drawer ends "... quotes the phrase in a proverb and bars the
  tritone leap in counterpoint." If the lead wants the ban line kept:
  - list it as a departure from the card in the preamble and in WEB-SPEC's Contract;
  - word it to the encyclopedia: "An encyclopedia calls stories of singers punished for it 'likely
    fanciful'".

---

## Nits

### 6. "Twelve lanes" from C to C, and the B lane on the ring

- **Where:** WEB-SPEC:178, 205, 239 and 257; FACTS 44 (FACTS.md:114); FACTS 79 (FACTS.md:192); the
  curl at WEB-SPEC:203-212.
- **What is wrong:**
  - **The lane count.** Lesson 15's pitch line gives a lane to every note, "a lane for every semitone
    from D4 to G5" (Lesson 15 FACTS 33). Counted that way, C to the C an octave up is 13 lanes, and
    14 with Step 4's B lane. "Twelve lanes" fits only if a lane is the gap between notes, but then a
    note cannot "light its lane" (WEB-SPEC:48).
  - **The layout arithmetic.** FACTS 79's "about 21 px each" (260 / 12) becomes about 18.6 px with
    14 lanes.
  - **The B lane on the ring.** When the line curls, C4 and C5 meet and B4 already sits on C's left.
    The extra B3 lane "joining on C's left" lands on the same bead.
- **Fix:**
  - Define a lane as one note's row and give the count: 13, and 14 in Step 4.
  - Redo FACTS 79's arithmetic.
  - Say that the B lane merges into the ring's B bead.

### 7. Who owns the enabled state of Sharp and Flat

- **Where:** WEB-SPEC:158, 213-216, 272, 235-236 and 589-590.
- **What is wrong:**
  - **The unlock is blanket.** The predict's `unlocks` sets `disabled = false` on every listed
    button the moment a choice locks (`src/features/lessons/kit/predict.ts:124-126`). So with the top
    note on E, B or F, the choice would enable Sharp on E or B, or Flat on F. The Edge cases say
    those stay disabled.
  - **Free play.** It is "unlocked whether or not a choice was made" on what Toys 1 calls the same
    mounted toy (WEB-SPEC:168-169).
- **Fix:** have the toy own its buttons' state, and pass the choice in through `onChoice` rather than
  `unlocks`. Or say that the toy re-applies its per-letter rule after the unlock. Also say whether
  free play is a second instance.

### 8. "Lesson 27 says why fa moves down" names Lesson 27's answer as its subject

- **Where:** LESSON.md:248; FACTS 30 (FACTS.md:94).
- **What is wrong:**
  - Lesson 27's predict asks which note sits on top of the V chord, [F] [F♯]. Its answer is fa, F
    in C (`lessons/27-sevenths-inversions/ARTICLE-PLAN.md:31-35`).
  - Its promise keeps out "fa", "F" and "tritone" (`:14-16`).
  - The writer rightly dropped the plan's "on the V chord it is the added seventh". But this page
    still tells the learner that Lesson 27 is about fa, and Step 4 has just said F is fa.
- **Fix:** "A later lesson says why F moves down." Or: "Lesson 27 comes back to this pair."

### 9. Lesson 27 asks this page's quick check 1 as its recall, and the package does not record it

- **Where:** FACTS 75 (FACTS.md:185); hand-back § 7 item 4.
- **What is wrong:**
  - Lesson 27's plan recalls "Lesson 23, quick check 1 (as Lesson 23's ARTICLE-PLAN writes it)"
    (`lessons/27-sevenths-inversions/ARTICLE-PLAN.md:43-44`).
  - The package records only Lesson 24's use of question 3 (FACTS 77).
  - Question 1's words and answers are unchanged today, so nothing breaks yet.
- **Fix:** add a line to FACTS 75 and the hand-back: question 1's words stay as they are, because
  Lesson 27 asks them.

### 10. "Only one pair of white keys is a tritone apart"

- **Where:** LESSON.md:246; FACTS 27 (FACTS.md:91).
- **What is wrong:** on a piano, many pairs of white keys are a tritone apart: F3 and B3, B3 and F4,
  F4 and B4. One pair of letters is. The page defines "piano key" carefully elsewhere (WEB-SPEC
  Contract).
- **Fix:** "Among the white keys, only F and B are a tritone apart: fa and ti in C major."

### 11. The predict says Merc will play one note, then offers two plays

- **Where:** LESSON.md:126-127 ("Merc will play one note between the two Cs. Which one splits the
  octave into two equal leaps?").
- **What is wrong:** both splits are played. "Will play one note" can be read as one play.
- **Fix:** "Which note between the two Cs splits the octave into two equal leaps?"

### 12. Lesson 21 is committed now: bind the citations made in words

- **Where:** FACTS Sources (FACTS.md:37-40, still "in its fix pass and not yet committed"); FACTS 7,
  18, 32, 44 and 52.
- **What I checked:** every claim about Lesson 21 is true of `lessons/21-keys-circle/` at
  `271dc369a`:
  - its recall asks Lesson 6's question 2 (LESSON.md:146-157);
  - Step 3, "a scale uses each letter once" (:215-216), and its mix-up card, "The key decides which
    name the note takes." (:223);
  - Step 5, "about 702 cents, against 700" (:256);
  - the hint forms (:132-140);
  - key signatures in Step 4 (:231).

  The hand-back's line numbers all match.
- **Fix:** cite them by path and line, and drop the "fix pass" sentence from Sources.

### 13. The head leaves out `teaches`, `alternativeHeadline` and the llms.txt line

- **Where:** WEB-SPEC:92-102 and :556-557.
- **What is wrong:** SEARCH § 3.2 changes `alternativeHeadline` and `teaches` for each lesson, and §
  3.4 asks for an llms.txt line on release. Lesson 21's fixed spec now writes all three and checks
  them against its predict (`21-keys-circle/WEB-SPEC.md:436-453`).
- **Fix:** propose them. Remember that llms.txt's one-line answer may name the tritone, since a
  learner never sees it before the choice.

### 14. FACTS 1a's list of where the lesson's name shows leaves out the lesson menu

- **Where:** FACTS 1a (FACTS.md:51).
- **What is wrong:**
  - The masthead's lesson menu lists every lesson's row by its title from the first paint, this
    lesson's included: "Perfect, major, minor and the tritone" (`rowOf`, `title: L.title`,
    `src/features/lessons/kit/lesson-menu.ts:166-176`).
  - On a phone it is the only menu.
  - FACTS 1a names Lesson 22's card, the explorer, the footer and the share titles, but not this
    row. The same argument covers it.
- **Fix:** add it to the list.

### 15. BRIEF-23 asked for the six-preset table in FACTS

- **Where:** FACTS 52 (FACTS.md:125).
- **What is wrong:** FACTS 52 gives the margins in prose. The table is only in LESSON.md's coach
  list (LESSON.md:439-446). The numbers agree with each other and with my own check (below).
- **Fix:** move or copy the table into FACTS 52.

---

## Hand-back claims

- **The two scripts: true.** plan-cites read 265 citations with 0 findings, and lesson-words counted
  2,020 words. Both are reproduced. Steps' own text is 112, 119, 116 and 120. The section counts in
  WEB-SPEC Length match the counter.
- **§ 6 item 6, "the toy cannot reach F♯ or fold the fifth before the choice": false** (finding 1).
- **§ 6 item 10:** it lists the ban sentence, which LESSON.md's preamble does not (finding 5).
- **§ 7 item 4:** it covers Lesson 24's recall but not Lesson 27's (finding 9).
- **§ 8: the Lesson 21 citations are all correct at `271dc369a`** (finding 12).
- **Process note, for the lead.** The writer reports four read-only git commands in
  `/home/user/mercurypitch`. The common brief says "No git at all". They changed nothing.

---

## Checked and found sound

- **Arithmetic, all reworked by hand.**
  - Every interval's letters and semitones: C–D 2/2, C–E♭ 3/3, C–E 3/4, C–F 4/5, C–F♯ 4/6, C–G 5/7,
    C–G♭ 5/6, C–A 6/9, C–A♭ 6/8, C–B♭ 7/10, C–B 7/11, B3–F4 5/6, C♯–G 5/6, D–F♯ 3/4, D–A 5/7, A–D
    4/5. Test 1's whole list and the readout's augmented second, fifth and sixth also check out.
  - Every inversion: 5+4 and 7+5; M3 4 to m6 8; A4 to d5 6+6; the unison and octave 1+8 and 0+12.
  - Every frequency in FACTS 66 matches 440 × 2^((m − 69)/12).
  - The arithmetic mean of C4 and C5 is exactly 1.5 × C4: 392.44 Hz, 1.955 cents above G4, and C5 /
    392.44 = 4:3. The geometric mean is 369.99 Hz, F♯4.
  - The hertz gaps: 130.37 and 131.26 Hz; 108.37 and 153.26 Hz.
  - Pure fifth 701.96 cents.
  - The six tritone pairs on the ring; F–B the only white pair by letter.
  - Tavi's and Merc's sung line: 7.0 s. The chip: 2,020 / 238 = 8.49 minutes, plus 306 s, gives
    13.59, so 14.
  - The tease and head lengths: 57, 64, 70, 66, 67, 57, 59, 157, 66, 79 and 203 characters.
- **Range.** I recomputed all six presets from `VOCAL_RANGES` (`settings-store.ts:91-152`).
  - D3 to D4 gives bass 10/2, baritone 7/5 and tenor 2/10. D4 to D5 gives alto 9/3, mezzo 5/7 and
    soprano 2/10.
  - For the lower voice only do on D3 passes. For the higher, D4 or D♯4 pass. So D is the only key
    for both.
  - C♯ and E♭ for the lower voice and C♯4 for the higher each leave 1 semitone.
  - The octave below falls 2 to 10 semitones under the floors.
  - Each line's middle sits within 4 semitones of every preset's middle.
- **Staff positions.** C3 is in the bass staff's second space. C4 is on one ledger line, above the
  bass staff and below the treble. C5 is in the treble's third space. D4 sits just over middle C's
  ledger line on the bass staff and hangs under the treble staff. D5 is on the treble's fourth line.
- **Shared lines, word for word against Lesson 15's Sing it.** The comfort check, "Just listen today"
  with its notes swapped, the voice choice and its stored-voice line, Lesson 15's clef line, "Sing at
  about speaking volume.", the stop line, the guide's "Nothing listens here" line, the four feelings
  and their two closing lines, and the doctor lines. The rest card matches Lesson 8's
  (`08-beat-tempo-backbeat/LESSON.md:324-326`). The recall matches Lesson 6's LESSON.md and
  `lesson-06/quiz-questions.ts:65-104` word for word.
- **Leak check, beyond findings 1 and 2.**
  - Clean: the title, the head title, the descriptions, the share card and its alt, the promise, the
    sound gate, the stage, both bubbles, the four words and their figures, the four step headings,
    the menu card's "Lesson 23 · How do you name an interval?", the steps' section heading and Lesson
    22's tease and still. None names F♯, six semitones or a halfway note.
  - Lesson 22's planned tease is true of the page.
  - Lesson 24's proposed tease sets up its opening (220 against 224 Hz) and names no beat, slowing or
    stopping, so it does not answer Lesson 24's predict.
  - The tease still draws no glow, which would show the beats.
- **Brief-23's answers are followed.**
  - No translation of Fux is quoted.
  - F♯ and G♭ are both shown, citing Lesson 2's question 3 and Step 5, and Lesson 21's Step 3.
  - The page has one predict, and the tritone's upside down is a Try and Notice on the fold.
  - The key is D, with the table and the coach flag.
- **The common brief's list.**
  - The step headings, the tour hold (`holdTour`, `tour-gate.ts:57-69`), and no "Now play the other
    one." (no `next` hint).
  - The rest card on the sung part, the six-preset check, "piano key" against "in D", and the teases
    checked.
  - Where Lesson 2's "the music around it decides" meets this page's "the letters make one a fourth,
    the other a fifth", the two agree.
- **Sources.** Every OMT and Wikipedia quote I fetched matches. "Fa and ti lean hardest", "why
  perfect" and OMT's white-key method are correctly left unsaid or cut. The sound gate's unsupported
  "never" is gone.
- **App claims, read at the cited lines.** All match what the package says:
  - the predict's `unlocks`, `revealAfter`, the free play, the hints and the lock-hint behaviour
    (`predict.ts`);
  - Leap's bank, its labels, root C3 to A4, the coin flip, timing, 12 rounds and the miss replay;
  - the lesson marker for 01 to 14, and `LESSON_ANSWER_BOUNDS` page and question 1 to 14;
  - Ear Lab's boot hash and the printed address rule;
  - `leap-ladder` 3, 4, 7, 5 and 12, and `MAX_LAUNCH_INTERVAL` 12;
  - Lesson 10's recall wiring and `unlocks` use, and Lesson 6's `PAIR` (1.55 s) and `QUIZ_FOURTH`;
  - the kit's `COUNT_IN`, `afterFeeling`, `VisitEnding`, Lesson 8's wrap, Lesson 12's `HINT` and
    `AFTER_OPTIONS`, and `contourOf`;
  - the soft tone and Merc's partials, filters, levels, vibrato and master compressor;
  - `.viz.tall` 380, 340 and 310 px, and the phone hero order;
  - `mercListen`, `mercCelebrate`, the next card's tease line, "Coming later" and "See it on the
    map";
  - the head test's 60 and 80 to 160 limits, and "fourteen" in `MINUTE_WORDS`;
  - the no-planning-text patterns, and Lesson 10's draft line form.
- **Copy.** British spelling throughout, no emojis, and no model names, scratchpad paths or agent
  ids. Tavi's three lines are a sincere guess, a half-right question and a sincere guess. Merc mocks
  nothing.
- **Length.** 2,020 words, 359 under the 2,379 cap; the built page is about 2,170. Each step's own
  text is inside 50 to 120.
