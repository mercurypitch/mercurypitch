# Lesson 19 review: Threes, offbeats and syncopation

Reviewer's report on `docs/plans/find-your-pitch/lessons/19-threes-offbeats/` (FACTS.md, LESSON.md,
WEB-SPEC.md) as saved at 17:02 to 17:03 on 1 November 2026. App claims checked at `c60f0fdcb` in the
worktree; plan files at the branch head. Read-only; the only scripts run were `plan-cites.mjs` and
`lesson-words.mjs`. One download (three page images of the 1881 song book, to
`/dev/shm/s2dl/review-19/`) was read and deleted.

**Counts: 0 blocking, 5 should fix, 16 nits.**

The package is careful and mostly sound. The predict holds: nothing before the reveal says which
grouping gives two beats. Citations resolve and say what the package says they do, the arithmetic
is right, and every quote I checked against its source is verbatim. The findings are a teaching gap
Lesson 17 opens, one false tease alternative, two kit behaviours the spec missed, and one claim
stated more strongly than its abstract.

---

## Should fix

### S1. Step 1 never says what the 8 in 6/8 means, and Lesson 17's rule points to the misconception

- **Where:** LESSON.md:160-168 (Step 1: heading and text); FACTS 12 (FACTS.md:72).
- **What is wrong:** the heading asks "What do the numbers in 6/8 mean?", but the text explains only
  the top number ("In 6/8 it counts eighth notes"). Lesson 17, the lesson this one builds on, taught
  the bottom number as "the bottom 4 says a quarter note gets the beat"
  (`lessons/17-note-lengths/LESSON.md:144-145`). A learner who applies that rule to 6/8 concludes
  that an eighth note gets the beat, which is six beats a bar: the card's misconception, reached
  through the page's own prerequisite. Nothing on the page undoes it.
- **Evidence:** the source the package already cites says it. OMT 2e 1.10 has "the bottom number
  (8) means that the eighth note is the division." (checked on the live page today; FACTS 12 and
  R19-2 carry the quote but the page never uses it).
- **Fix:** add one sentence to Step 1 after "In 6/8 it counts eighth notes.", for example: "The 8
  says which note the 6 counts: eighths. In 4/4 the bottom 4 named the beat; in 6/8 the 8 names the
  smaller note, and three of them make a beat." Cite OMT 1.10 in FACTS 12's "where used" column.
  This adds about 25 words, and Step 1's own text goes from 119 to about 144, over § 4.2's 120. To
  pay for it, cut "three eighths long" (the sentence that follows says it) or move "In Britain, a
  dotted quarter is a dotted crotchet." to the mix-up card.

### S2. The alternative tease "Every bar this season has walked in fours." is false

- **Where:** FACTS 5b (FACTS.md:62); WEB-SPEC:373-375 and :413-415; LESSON.md:66-69 ("kept, made
  true, as the alternative"); the hand-back's `TEASE_NOTES[19].fours` ("every bar in Season 2 so far
  is in four").
- **What is wrong:** FACTS 5b rejects Lesson 18's planned line because Lesson 8's quiz plays bars of
  three. The same Lesson 8 question is asked on a Season 2 page: Lesson 17's recall plays it.
  `lessons/17-note-lengths/LESSON.md:115-118` has "Listen. [Play two bars] How many beats are in
  each bar? 3 [correct]", whose play is "two bars of 3 ... at 90 BPM" (`lesson-08/quiz-play.ts:5-6`).
  So by Lesson 18 the season has played bars of three. FACTS 5b's support, "Lessons 15 to 18's plans
  and packages write no bar of 3/4 or 6/8 (searched)", is about *writing*, while the tease says
  "walked".
- **Fix:** make the alternative claim only what the search supports. For example, "Every bar
  written this season has had four beats." is 49 characters. Lesson 15 writes no bars, Lessons 17
  and 18 write only 4/4 (Lesson 18's plan, line 7: "4/4, 60 BPM"), and Lesson 16 should be checked.
  Or drop the alternative. Correct the team note to match.

### S3. The first-visit tour tells this page's visitors that Merc and Tavi sing

- **Where:** WEB-SPEC Toys 3, "The tour" (WEB-SPEC:207-210); What the kit and the app still need
  (WEB-SPEC:382-408); FACTS 60 (FACTS.md:141).
- **What is wrong:** the spec holds the tour until the choice but does not read what the tour says.
  Its first stop, on every lesson page, is "They teach every lesson. Listen to them sing, then sing
  along with them when it's your turn." (`src/features/lessons/kit/tour-copy.ts:41`). Nothing on
  Lesson 19 is sung, and Merc and Tavi have no voice button (WEB-SPEC:334-335), so the line is false
  here. Every Season 1 page has a `#sing` section (`learn/01.html` to `learn/12.html`), as do
  Lessons 15 and 17, so this is the first page where the line is wrong. The "Your turn to sing" stop
  drops out by itself, since `#sing` is missing (`tour-copy.ts:6-8`), but the first stop does not.
- **Fix:** add a kit item: a page with nothing sung needs its own body for the "Meet Merc and Tavi"
  stop, for example "They teach every lesson. Listen along, and try each idea yourself." It could be
  chosen by a list like `LISTENING_LESSONS` (`tour-copy.ts:34-35`). Add it to FACTS 60 and to the
  hand-back's kit list. Lesson 21's writer may meet the same issue.

### S4. The hero's first hop cannot land on the first kick with a 0.1 s lead

- **Where:** WEB-SPEC Toys 2 (WEB-SPEC:183, "starting 0.1 s after the press") and Audio
  (WEB-SPEC:314-315); FACTS 57, 58 and 64 (FACTS.md:138, 139, 148).
- **What is wrong:** Merc and Tavi "hop on the kick and the snare", and the first kick sounds 0.1 s
  after the press. A hop lands `HOP_MS` = 530 ms after it is called (`kit/merc-hop.ts:16-23`), so the
  first hop would have to start 0.43 s before the press. Lesson 8's cold open, the model the spec
  imports the hop from, books its plays with `lead: 0.6` for exactly this reason ("room before the
  first clap for its hop to start") and `early: HOP_MS / 1000` (`lesson-08/cold-open.ts:163-165`).
  The beat clock's default lead is 0.1 s (`kit/beat-clock.ts:188`). In twos the hops are 667 ms
  apart, longer than the 530 ms hop, so the later hops fit. Only the first one does not.
- **Fix:** give Play in threes and Play in twos Lesson 8's `lead: 0.6` and `early: HOP_MS / 1000`,
  and keep 0.1 s for Play six notes, which has no hop. Update FACTS 64, the Audio bullet and the run
  time (it moves by about 2 s, so the chip still reads 12). Cite `lesson-08/cold-open.ts:163-165`.

### S5. The Colley line is stronger than the abstract it rests on

- **Where:** LESSON.md:201-202 (Go deeper); FACTS 26 (FACTS.md:89).
- **What is wrong:** the page says the children "recognised rhythms better than children who learned
  one that didn't". The abstract, the only part read (Weak to Moderate), says the system "improved
  recognition skills to a greater degree than one that did not". That compares gains, not end
  levels, and only the abstract was read.
- **Fix:** "...improved more at recognising rhythms than children who learned one that didn't."

---

## Nits

1. **"Row" count and title** (LESSON.md:186-187; FACTS 29). There are four "mer-ri-ly"s, two to a
   bar of 6/8, so the second and fourth count "2 and a", not "1 and a". Write "each 'mer-ri-ly' fills
   one beat: '1 and a', then '2 and a'". The book's title is "Row Your Boat (Round.)", which I read on
   p. 69 of the Internet Archive copy. The 6/8 and E. O. Lyte are as FACTS 29 says. So quote the
   lyric rather than a title the book does not use: 'prints the round "Row, row, row your boat" in
   6/8'.
2. **WEB-SPEC:333-334**, "sits at the head of Step 1 as Lesson 17's step lines do": Lesson 17 has no
   Tavi line in any step. Lessons 15 (LESSON.md:196) and 12 (LESSON.md:218) do; cite one of them.
3. **FACTS 61** (FACTS.md:145), "quick check 3's figure, if drawn": quick check 3 has no figure or
   play. Delete the phrase.
4. **The pitch-line view in Steps 3 and 4.** WEB-SPEC:173-175 gives it to Steps 3 and 4. The step
   states (WEB-SPEC:242-247) and LESSON's toy lines (LESSON.md:215, :228) do not list it. Make all
   three agree. It is not required, since those bars are on one line, not a staff.
5. **When Step 2's tunes are written.** WEB-SPEC:165-166 says every note "is written as it first
   sounds"; Toys 5 (WEB-SPEC:232) says "Play plays the tune shown". Say which applies to Step 2's
   tunes.
6. **Status lines with two Start buttons.** FACTS 37 changes "Press Start" to "Press a Start
   button" "since this page has two". It keeps "Stopped. Press Start to tap again." and "...then
   press Start." (LESSON.md:255-256). Either say why those two stay, or adapt them the same way.
7. **Quick check 2's cue is new at quiz time** (LESSON.md:268-273; FACTS 69). The feedback relies on
   "the kick came back after three eighths". The page's own 6/8 marks beat 2 with the snare, and the
   second kick is first mentioned on the practice card, which comes after the quiz. Pattern b's
   sidestick also sits on pad 3, where in twos put its snare. The question is answerable. Either let
   Step 1's toy offer the drill's second bar once, or say in FACTS 69 that the cue is new.
8. **FACTS 34** (FACTS.md:100) gives the first line's condition as "no taps in the first time
   through". The rule (WEB-SPEC:267; Lesson 8's `lineUp`) is "not lined up": fewer than five
   agreeing samples. Use that.
9. **WEB-SPEC:421-424**, "since past half a beat, 333 ms, a tap is nearest the next beat": 333 ms is
   half of 3/4's beat. The 6/8 tune's limit comes from the 250 ms cap plus the 120 ms window. Split
   the two reasons.
10. **The head description** (WEB-SPEC:388-390) lacks the "how" SEARCH § 3.1 asks for ("with sound
    toys"). Adding it puts the description at 171 characters, so trim elsewhere, for example
    "...why does one feel like two beats, the other three?".
11. **The still on Lesson 18's card.** Lesson 18's next-lesson card will show a still of this page's
    opening, and nothing here says what it may show. Add to FACTS 1a and the hand-back: six pads
    ungrouped, no arcs, nothing written, as on the share card.
12. **Recall question 2 repeats Lesson 17's recall.** Lesson 17 already asks Lesson 8's question 2
    (`17-note-lengths/LESSON.md:115`), so a learner coming from 17 meets it again. The rule allows
    it; if the lead prefers variety, Lesson 17's question 1 or 4 also leaks nothing.
13. **The stage direction assumes an order** (LESSON.md:119-121): "two groups of three, then three
    groups of two" and "twice a bar, then three times". The learner chooses the order. Write "in
    threes ... in twos".
14. **FACTS 1a's list of what can be read before the choice** leaves out two things:
    - the triplet word's written 2/4 figure, a beat of three beamed eighths, under its button
      (FACTS 66);
    - Tap the beat's "two taps a bar in the 6/8 tune and three in the 3/4 tune" (LESSON.md:234).

    Neither answers the predict alone: the first needs a beat-equals-group inference, and the second
    needs to know 6/8 groups in threes, which only Step 1 says. List both and say why.
15. **The dotted half is not paid off.** The recall sets a dotted half at three beats in 4/4. Step 2's
    6/8 tune ends on a dotted half counted "1 (2)", and the 3/4 tune on one counted "1 (2 3)". Both
    last 2 s, but the page never says so. FACTS 13 says Step 2 uses "a dotted half lasts two such
    beats", yet LESSON.md has no such words. Add a clause, for example "Both tunes end on a dotted
    half: three beats in 3/4, two in 6/8, the same 2 seconds". Or drop the claim from FACTS 13's
    "where used" column.
16. **The hand-back's kit list** (19-HANDBACK.md:134-151) misses S3 (the tour line) and S4 (the hop
    lead). It also misses that the compact strip (`kit/beat-strip.ts`) needs six cells to a bar, not
    only the beat machine's row.

---

## What I checked and found sound

- **Leak check (rule 1):** I checked each of these against the predict (which grouping feels like
  two beats; answer: in threes) and none names the answer:
  - the title, the lesson's name and the promise;
  - the sound gate ("how notes are grouped");
  - the head title, the description, `og:title` and the share card;
  - both bubbles, and Play six notes (all one level, no hop, no arcs);
  - the recall (Lesson 17's q3 and Lesson 8's q2), the four words and their headings;
  - the step headings, and the menu card "Lesson 19 · What do the numbers in 6/8 mean?"
    (`lesson-menu.ts:210-221`);
  - the steps' section line, the explorer card and figure, and both teases.

  `holdTour` exists and does what FACTS 60 says (`tour-gate.ts:57-69`). The tour's steps stop is
  `tour-copy.ts:44-46`.
- **Citations:** `node scripts/plan-cites.mjs check ...` gives 137 citations read, 0 findings. I
  read these at `c60f0fdcb` by content:
  - Ear Lab: `metre.ts` (patterns :72-83, voices :49-52, accent :26, `metreGroups`, `stepMs`),
    `SubdivideDrill.tsx:1-10, :84-96, :151`, `timing.ts:119-133, :231-240`,
    `instruments.ts:195-202`, `drills.ts:225-230`, `draw-options.ts`, `MetreLattice.tsx:1-11`;
  - Pulse and notation: `banks.ts:215-321, :456-486`, `PulseDrill.tsx:53`, `rhythm-take.ts:28-37,
    :78-132`, `input-latency.ts:4-71`, `rhythm-notation.ts:1-24, :242-250`,
    `RhythmScore.tsx:231-259`, `sheet-music-renderer.ts:573`;
  - Lesson 8: `quiz-questions.ts:55-75`, `quiz-play.ts:5-6`, `take-judge.ts:29-39, :78-132`;
  - the kit: `predict.ts:54-59, :95-102`, `next-card.ts:10-12, :142`, `quiz.ts:142, :191`,
    `season.ts:11-13, :90-145`, `explorer.ts:177-181`, `lesson-copy.ts:33-34, :61-62, :76`,
    `merc-hop.ts:16-23`, `beat-machine.ts:137`, `sound.ts:31-32`, `sound-ahead.ts:83-100`,
    `drum-voices.ts:10-22, :349-357`, `voice-choice.ts:20`;
  - the app: `lesson-marker.ts:11-19`, `ui-store.ts:570-584`, `entry-pages.ts:480-484`,
    `llms.txt:3`.

  Each says what the package says. The practice card describes what Subdivide and Pulse do, not
  what their names suggest.
- **Sources checked today:**
  - OMT 2e 1.10 and 1.11: all seven 1.11 quotes and the four 1.10 quotes FACTS uses are verbatim.
  - Sharkey 7.2.03 ("condense 'triplet' into two parts", modified 16 Jul 2025).
  - Williams 2023 (all three quotes; updated 21 August 2023).
  - *Franklin Square Song Collection* (1881), p. 69: "Row Your Boat (Round.)", E. O. Lyte, 6/8, the
    "mer-ri-ly" eighths flagged.
- **Arithmetic and music:**
  - Both tunes are 4 bars of 6 eighths and 8 s, 15 and 12 notes, with counts as FACTS 30 gives them.
  - An eighth is 1/3 s in both tunes, so 60 and 90 BPM. Subdivide's bars are 1.5 s and its replay
    bars 1.86 s.
  - Step 3's bar: 4 beats, triplet eighths 1/3 s apart. Step 4's bar: 1 + 0.5 + 1.5 + 1 beats, with
    the tie at beat 3.
  - The pitches C3, C4 and A3, A4. Stems on both staves, and the beams.
  - The take frames (18 and 27 beats), 18.95 s, `barMs` 7380 and 7546.67.
  - The other-metre windows. I worked the 4-of-8 and 4-of-12 example lines by hand, including a
    learner who taps 3/4's beats through both passes: the estimator's spread then rejects nothing,
    and the take still lines up at 0 ms.
  - The run time: 299 s + 7.40 min, so 12. Character counts: 59, 154, 50, 42, 50 and 54.
- **Length:** `lesson-words.mjs` gives 1,761, 618 under 2,379. Steps' own text is 119, 115, 94 and
  115, as stated. The built page comes to about 1,911.
- **Shared lines:** these match Lesson 17's current text word for word or in its stated forms:
  - the sound gate's second sentence;
  - the lock-line form, the silent-play hint and the reveal's fair-guess form;
  - "Counting in: one bar." and the sound-off take line;
  - the section lines (Ripresa, Coda, Four words) and Lesson 8's Cadenza line;
  - the footer and the explorer lines.

  No Season 1 voice line is used, and none is needed.
- **Voice safety:** nothing is sung. The optional spoken count follows Lesson 8's Try
  (`08/LESSON.md:142`) and Lesson 17's (`17/LESSON.md:181`), which ask for no comfort check. No
  range advice, no score.
- **Copy:** British spelling ("metre", "synthesised"; practise as verb, practice as noun); no emojis,
  model names or scratchpad paths in the lesson files; headings are Tavi's questions; both Tavi lines
  are sincere guesses. No feedback line opens "Right", "Yes" or "Correct".
- **Lead's answers:**
  1. "Row" is named, not played, after reading its metre (verified).
  2. The cold open's drums are Subdivide's 6/8 a, the snare on 4 (`metre.ts:77`).
  3. The checkpoint is tapped on Lesson 17's take, and the metre is named in quick check 2.
- **Agreement with Lesson 17:** the take's lining-up, its 120 ms window, ticks and judge agree with
  Lesson 17 FACTS 32-36. The click stopping for the judged pass is a stated and argued departure.
  The counts in brackets and "and" agree, apart from S1.
- **Departures:** all eleven are argued in FACTS and listed in WEB-SPEC's Contract. The three files
  agree except where nits 4, 5 and 15 say.
- **The hand-back's claims** match the files, except the `fours` team note (S2) and the kit list
  (nit 16).
