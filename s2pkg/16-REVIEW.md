# Lesson 16 review: Sing what you see

This is an independent review of `docs/plans/find-your-pitch/lessons/16-sing-what-you-see/`
(FACTS.md, LESSON.md and WEB-SPEC.md). I read it in `/dev/shm/s2plan` at `b55beeb20`, with the
package uncommitted. The scratchpad copies are byte for byte the same as the worktree files.

I checked it against:

- RESEARCH.md and ARTICLE-PLAN.md;
- BRIEF-16, with the lead's five answers and the two teases;
- the common brief's list of what earlier reviews caught;
- SEASON-2 § 1.4, § 1.5, Lesson 16's card (`SEASON-2.md:220-262`), § 4.3, § 5 and § 7;
- CURIOSITY-MOMENTS § 1 and § 3.1, plus Lesson 15's entry;
- HANDOFF § 5, the TEACHING-PLAYBOOK (rules 1, 2, 6, 16, 22 and 23, and the house rules), and the
  header of `kit/lesson-copy.ts`;
- Lessons 9 and 15 (their packages and Lesson 9's quiz code);
- the Lesson 23 and Lesson 21 packages as models;
- Lesson 18's plan and brief;
- the built pages `learn/04.html`, `learn/06.html` and `learn/09.html`;
- the app at `c60f0fdcb`. The branch changes only docs, so I read the worktree's `src/`.

I read the hand-back last.

How the review was done:

- **Read-only.** I edited nothing and downloaded nothing.
- **Node scripts.** I ran the two node scripts:
  - plan-cites: 239 citations, 0 findings;
  - lesson-words: 2,225. That matches FACTS 3 and WEB-SPEC Length, and is 154 under the cap.
- **Python.** I used `python3 -I -c` only for character and word counts.
- **WebFetch.** I made three reads:
  - Wikipedia "Sight-reading" at revision 1371524263: both quotes in FACTS 26 match.
  - Wikipedia "Gordon music learning theory" at revision 1379965924: both quotes in FACTS 24
    match, but see nit 5.
  - A PubMed search, for nit 3 only.

**Counts: 1 blocking, 8 should fix, 13 nits.**

Line numbers are the package files' as they stood at 01:38.

---

## Blocking

### 1. The new predict's answer and the page's thesis contradict each other, and the reveal concedes that the "wrong" choice is true

**Where:**

- LESSON.md:116-117 (the predict) and :131-135 (the reveal);
- LESSON.md:190, Step 2: "Reading needs a first note, not a stored one.";
- LESSON.md:318-320, quick check 1: "What does a singer need before reading a tune they've never
  heard?", answered "A note to start from, such as do";
- LESSON.md:345-346, the Wrap's first line: "Reading a tune needs one note to start from, not
  absolute pitch";
- FACTS 22, 31 and 34.

**What is wrong:**

- **The reveal teaches the opposite of the thesis.** It says that with nothing played, "Tavi still
  read the steps, up one, up one, back, back, but from F". So reading worked with no note given;
  the note bought only the written pitches.
  - Three lines later the page states its thesis three times, without that distinction: Step 2,
    quick check 1's right answer and the Wrap all say that reading needs a note to start from.
  - A learner who took the cold open's point can fairly answer "but Tavi read it with nothing".
  - The card's objective, "know that reading needs a starting note and relative pitch"
    (`SEASON-2.md:224-225`), fitted the plan's predict. Under the new one it needs saying in a
    different way.
- **Choice 1 is true of what the stage shows.**
  - The predict asks about "the line", the five written notes on the stage.
  - Choice 1 reads "Not this tune: that takes perfect pitch".
  - The reveal then says that, without the note, "she missed every written note". It also says
    absolute pitch "would have let her start on G with nothing played". In other words, singing
    the written line with no note does take absolute pitch.
  - So choice 1's claim and its reason are both true of the written line. The parenthetical,
    "so 'not this tune' was a fair guess", ends up conceding it.
  - The answer holds only if "this tune" means the tune at any pitch.
- **The series does support that reading.**
  - Lesson 6's mix-up card says "a tune is a pattern of intervals, so it can start on any note"
    (`learn/06.html:1042-1043`).
  - Its sing-along ends "One tune, two starting notes: you just transposed it." (`:1707`).
  - Neither line is cited. FACTS 31 cites only Lesson 6's Go deeper drawer.
  - As worded, though, the predict hangs on that one word, and the choice adds a reason that the
    reveal confirms.

The writer's reason for leaving the plan's predict is sound:

- Lesson 9's built Step 3 says: "Before a singer sings a new tune from the page, the Royal
  Conservatory of Music's examiners play do, mi and so, then the tune's first note."
  (`learn/09.html:1091-1098`; the same words in Lesson 9's LESSON.md:152-153). That answers "What
  does she need to hear first?".
- The new question is a real one, and a learner can reason it out from Lesson 6, which is allowed.
  It does not need to change. Its wording and the thesis lines do.

**Fix:**

1. **Take perfect pitch out of the choices**, so that they turn on what is heard. For example:
   [ A jumble: with no note, she can't read it ] [ The tune, from a note of her own ].
   - The parenthetical becomes "(She missed every written note, so a jumble was a fair guess.)".
   - This also removes the leak in should fix 1(a).
2. **Say what the given note is for**, wherever the page states its thesis:
   - Step 2: "To land on the written notes, a reader needs one note to start from, not a stored
     one."
   - Quick check 1: "What does a singer need to sing a new tune on its written notes?". This is not
     Lesson 18's recall item, so it is free to change.
   - The Wrap: "To sing a tune on its written notes, you need one note to start from, not absolute
     pitch: hear do, then count the steps from it."
   - The challenge, "why you don't need perfect pitch to sing from the page", stays true as it is.
3. **FACTS 31:**
   - Cite Lesson 6's mix-up card and the sing-along line as the base for the reasoning.
   - Record that "this tune" means the tune at any pitch, in Lesson 6's sense.
   - FACTS 34's "every sentence is 18, 19, 22 and 33" then needs the new parenthetical.

---

## Should fix

### 1. Before the choice, Step 2's heading and text point to the answer, though FACTS 1a says they do not

**Where:** FACTS 1a (FACTS.md:45: "Step 2's text ... says nothing of what a reader sings without one;
its mix-up card's evidence speaks only of Tavi's try with one note first"), and LESSON.md:183-197.

**How a learner meets Step 2 before choosing:**

- On a wide screen the steps are a column of text that scrolls beside the stuck stage
  (`src/features/lessons/kit/step-deck.ts:5-8`). Step 2's text sits a scroll or two under the
  choices.
- On a phone it is one Next away.
- Its heading, "Do I need perfect pitch for this?", is in the masthead's menu from first paint.

**What it shows:**

- (a) The mix-up card prints "You need perfect pitch to sing from the page." under "Common
  mix-up". That is choice 1's reason, labelled as a mistake.
- (b) Tavi's "So how did I sing it without perfect pitch?" says that she sang it without perfect
  pitch.
- (c) The card's evidence, "Tavi has no absolute pitch", settles a premise that the predict leaves
  open.
- FACTS 1a checks only the second half of the card's evidence line.
- The title, "... just by reading it?", and Step 2's heading in the menu both prime "no perfect
  pitch needed". That is acceptable on its own, as the season's hook and a heading that asks a
  question, but it adds to (a) to (c).
- The series accepts step text that reveals the answer, provided the tour is held and the facts
  say so plainly (Lesson 21 FACTS 1a: "a learner who scrolls there unasked has passed the
  predict"). This package claims the opposite.

**Fix:**

- Blocking item 1's rewording removes (a).
- Give Tavi a line that presupposes nothing and sets up the thesis, for example "So what did the
  one note give me?".
- Rewrite FACTS 1a to say what Step 2 does show before the choice, and that the tour is held for
  it, in the way Lesson 21's FACTS 1a does.

### 2. Before the choice, the Words' "Sight-singing" play has Tavi (or Merc) sing the written notes with nothing played first

**Where:** LESSON.md:160-161 and :166-167; WEB-SPEC:242-246; FACTS 67 and FACTS 3's 6.9 s.

**What is wrong:**

- For a stored higher voice, Tavi sings G4 A4 B4 C5 D5 off a staff with no note before it and
  lands on the written G. For a lower voice, Merc does the same on G3.
- The reveal says only absolute pitch does that ("would have let her start on G with nothing
  played"). Tavi's own try with no note starts on F.
- The word sits under the predict and plays before the choice. A learner can therefore hear Tavi
  read the staff's G cold just before being asked what she sings with no note. That contradicts
  both the answer and the premise.

**Fix:**

- Give the play its note first, as the page's own rule asks: do in the soft tone for 1.0 s, 0.4 s
  of quiet, then the voice sings do, re, mi, fa, so. That makes 4.4 s; update FACTS 67, FACTS 3
  and Tests 4.
- Or play it in the soft tone, as the steps do.
- Merc singing the start in Sing it is a different case: he is the reference, as the examiner is.
  FACTS 42 could say so in one clause.

### 3. The no-microphone path never gives do before the learner reads

**Where:** LESSON.md:305-306 and :308-311; WEB-SPEC:293-299 (state 5) and :329-332 (state 9);
FACTS 51.

**What is wrong:**

- The start plays only once the microphone is granted (state 5).
- When it is refused, the no-microphone path draws both phrases and offers only Play Merc's
  phrases, which sings the start and both phrases together.
- "Read and sing anyway, then play Merc's phrases to check" therefore asks the learner to sing the
  cold open's no-note case, the very thing the page teaches against.

**Fix:**

- On that path, add [ Play the start ]: do, then do, mi, so, mi, do. It plays no phrase.
- Reword the line: "No microphone? Play the start, read and sing anyway, then play Merc's phrases
  to check. Nothing listens."
- Add the case to Edge cases and to Tests 8.

### 4. The ten-note slug proposal puts a bass preset on G2, not G3

**Where:** WEB-SPEC:443-450 ("the lower presets get G3 to D4, the page's own lower line"); the
hand-back, item 10(a); FACTS 59.

**Evidence:** `octaveShiftIntoRange` (`src/lib/vocal-range.ts:36-71`), worked by hand.

- **The ten-note line** G4 A4 B4 A4 G4 G4 D5 B4 A4 G4 spans 67 to 74, centre 70.5. That is exactly
  phrase 2's span, so it fits exactly as phrase 2 does.
- **Bass (40 to 64, centre 52):**
  - The loop starts at ceil((40 − 67) / 12) × 12 = −24, and both −24 and −12 fit.
  - Their centres sit 5.5 and 6.5 from the range's middle, so −24 wins: G2 to D3, for both
    phrases.
- **Baritone and tenor:** G3 to D4.
- **Alto, mezzo-soprano and soprano:** G4 to D5.
- **Written in the bass octave** (G3 to D4, span 55 to 62), the bass still gets −12, which is G2.
  Under the app's fit, no way of writing the line puts a bass preset on G3.

FACTS 59's own figures (phrase 1 on G3, phrase 2 on G2) are right. The proposal built on them is
not.

**Fix:**

- Keep the one-line authoring, since it keeps both phrases in one octave.
- Say that a bass preset reads G2 to D3, an octave under the page's line. Octave-folded scoring
  (item f) makes that harmless for the score. With the bass clef (item c), though, it puts do on
  the bass staff's bottom line, not in the top space that the page and quick check 2 teach.
- Or ask item 10 for a fixed-phrase slug that skips the fit.
- Correct the hand-back's item 10(a) the same way.

### 5. Sight-Singing's tracker can be hidden, and it names notes in a sixth place

**Where:** FACTS 58 (FACTS.md:141); the practice card (LESSON.md:361-362); WEB-SPEC:432-434,
:455-457 and :530; the hand-back, item 10(e).

**Evidence:**

- **The tracker has its own hide control, and it is remembered.** `ExercisePitchTracker` keeps
  `createPersistedSignal('pitchperfect_exercise_tracker', true)` (`src/components/ExercisePitchTracker.tsx:25-28`),
  draws a "Hide pitch tracker" button (`:38-41`) and draws "Show Tracker" while hidden (`:66-74`).
- **The pitch line's axis names notes.** `drawYAxisLabels` (`src/components/PitchOverTimeCanvas.tsx:305-349`)
  labels the octave Cs when the view is wide. Zoomed in, it labels every semitone, or every second
  or third, with `noteNameFromMidi`. It is drawn on every frame (`:292`).

**What is wrong:**

- FACTS 58 says the drill "draws the learner's pitch line above the staff throughout" and names
  notes in five places.
- One tap hides the whole tracker. That removes the pitch line and four of the six name displays:
  the target label, the two upcoming labels, the live dot's label and the axis labels. What is
  left is the letters under the notes and the hold bar.

**Fix:**

- **The card** can say what to do today: "Tap Hide pitch tracker to read without your pitch line;
  the names under the notes and on the hold bar stay." This replaces "It names every note and
  shows your pitch line: read the staff, not the names." Re-count the words.
- **FACTS 58:** six displays, with the tracker hideable and the choice remembered.
- **Item 10(e)** then needs only the letters under the notes and the hold bar's name hidden, since
  the tracker's own hide covers the rest. That is less to build.

### 6. The example reading "In the band: 12 cents" is wrong: the kit reads 12 cents as "Right in the middle"

**Where:** LESSON.md:286; WEB-SPEC:370-371.

**Evidence:**

- `bandOf` returns 'middle' at 15 cents or less (`src/features/lessons/kit/band-words.ts:29-35`,
  `BULLSEYE_TOLERANCE_CENTS = 15`).
- `readingWords` then writes "Right in the middle: ..." (`src/features/lessons/kit/take.ts:89-95`).
- Lesson 9's example, which this package carries, is 20 cents (Lesson 9 LESSON.md:235).

**Fix:**

- Write "Re · In the band: 20 cents below the written note." in both places.
- The coach's list (LESSON.md:503-504) also leaves out "Right in the middle", which FACTS 47
  includes. Add it.

### 7. The second phrase opens on a leap that no step shows on the staff

**Where:** LESSON.md:217-228 (Step 4) and :468-471 (the coach's list); FACTS 43.

**What is wrong:**

- Step 4 teaches do, mi and so as three lines or spaces in a row, with a third as line to line.
  Nowhere does the page show do to so as a written leap: two lines, or two spaces, up.
- That leap is the second phrase's first move, read with the names off.
- The recall's first question names do to so as a fifth of 7 semitones, but not on the staff.
- The Royal Conservatory puts fifths at Level 3, after steps (Preparatory and Level 1) and skips
  (Level 2) (R16-2).
- It is singable:
  - The start has just sung so.
  - So is two lines up from the house.
  - For the bass preset, the first note read after do lands 2 semitones under its top, E4. The
    coach's list already asks about that.
- But SEASON-2 § 1.4 item 1 asks that each staff idea be met before it is read.

The rest of the phrase checks out:

- G D B A G is +7, −3, −2, −2.
- G3 to D4 is two spaces up (top space, the space above, the space over C4's ledger line).
- G4 to D5 is two lines up.
- No step plays the phrase, and Play Merc's phrases waits until the singing has ended.

**Fix:**

- Replace Step 4's first cut candidate, "Steps use every line and space; a third skips one."
  (WEB-SPEC Length, cut 1), with "Do to so, two lines or two spaces up, is Lesson 9's leap, a
  fifth." Step 4's existing do, mi, so, mi, do play already lights so two places above mi.
- Otherwise, take the coach's alternative (do, mi, re, mi, do) now, and list do, so, mi, re, do as
  the alternative.

### 8. "Practise it free" and "Sight-Singing is free." have no FACTS line

**Where:** LESSON.md:365 and :397-399.

**What is wrong:** every claim needs a line in FACTS (playbook house rules), and no line covers
these two.

**Evidence:** Lesson 9 FACTS 54 sources it:

- `PREMIUM_EXERCISES` gates only the Sing room's premium exercises (`src/lib/native-build.ts:57-68`).
- Pitch Training's cards are `available: true`.
- Sight-Singing's card is `src/features/exercises/ExerciseMenu.tsx:228-235`.

**Fix:** add a line carried from Lesson 9 FACTS 54 and Lesson 23 FACTS 59, citing Sight-Singing's
card.

---

## Nits

1. **Quick check 3's second answer misdescribes the bass clef** (LESSON.md:333-334).
   - The answer reads "On three neighbouring places: line, space, line", with the feedback "That's
     do, re, mi: steps".
   - In the bass clef, do, re and mi (G3, A3, B3) are space, line, space.
   - Lesson 18 will ask this question word for word, so fix it now: "On three neighbouring places,
     like line, space, line" / "Neighbouring places are steps, like do, re, mi."
   - The hand-back says quick check 3 was kept word for word. Its second and third answers did
     change from the plan ("positions" to "places", "skips" to "leaps"). Lesson 18 asks the
     committed text, so the changes are fine, but the hand-back should say so.
2. **FACTS 3 counts "eight quiz questions"; the page asks six** (two in the recall, four in the
   quick check). Adjust the time estimate.
3. **"Researchers think it's learned early ... and hard to learn after that"** (LESSON.md:188-190;
   quick check 1's "is thought to be learned").
   - Both rest on the abstract of a 1993 review, put in the present tense.
   - "A 1993 review found the evidence points to early learning, up to about age 6" keeps the
     claim as strong as its source.
   - A later paper is titled "Absolute pitch can be learned by some adults" (Van Hedger, Heald and
     Nusbaum 2019, PLoS One, doi:10.1371/journal.pone.0223047). I saw only its PubMed listing and
     did not read it. It is reason enough to date the claim.
4. **"Exams such as the Royal Conservatory's give that note first."** (LESSON.md:196) speaks for
   other exams, but only one board was read (FACTS 23 says so). Write "The Royal Conservatory's
   exams give that note first."
5. **FACTS 24 cites the article's lead, but the quote is in another section.** The definition of
   audiation ("a term Gordon coined in 1975 ...") is in the article's Audiation section; only the
   "a model for music education ..." quote is in the lead. Say "its lead and its Audiation
   section".
6. **Quick check 2 moved from the treble staff to the bass staff** with no reason given in the
   package.
   - The reason, that the treble's do is the recall's G line, appears only in the hand-back. Put
     one clause in the preamble or in FACTS 13.
   - A higher voice that never switched clef meets the bass staff's do only in Step 1's text. That
     is acceptable, but worth knowing.
7. **WEB-SPEC Length's cut counts.** Cut 1 is 10 words, not 11, and cut 3 is 17, not 16. The total
   of 42 is right by chance.
8. **"Once you've been close"** (LESSON.md:269) uses "close" to mean within 60 cents. The reading
   lines' "Close" means 35 to 60 cents, which gives one word two meanings. Write "once you've held
   near it for about half a second".
9. **"First Tavi's line from the top of the page"** (LESSON.md:267). For the lower voice it is
   written in the bass clef, in Merc's octave, so it looks different from the hero's staff. Write
   "the tune Tavi sang at the top of the page".
10. **"If so feels high, stop after the first phrase."** has no control behind it.
    - Play Merc's phrases appears only once the singing has ended (LESSON.md:308-311).
    - A learner who stops there by choice therefore never hears either phrase sung.
    - Add [ Stop here ] after phrase 1's answer. It ends the singing and shows Play Merc's phrases.
11. **The Toys cross-references are off by one.**
    - The Toys sections are numbered 1 to 7: Recall and quick check is 5, Sing it is 6, and the
      tease still is 7.
    - WEB-SPEC:98 and :106 say Toys 6, which should be 5.
    - WEB-SPEC:105 says Toys 7, which should be 6.
    - WEB-SPEC:108 says Toys 8, which should be 7.
    - FACTS 45, 47 and 50 say Toys 7, which should be 6.
    - FACTS 16 says Toys 2, but the staircase is Toys 3.
12. **FACTS 1a lists the Words, but not the Sight-singing play's singer** (should fix 2). Once that
    play gets its note first, say so in 1a.
13. **The hand-back omits most of the new findings.**
    - Item 10(a) carries the slug error (should fix 4).
    - Item 10(e) counts five name displays (should fix 5).
    - Fix both there, along with the CURIOSITY-MOMENTS entry's predict wording if blocking item 1
      changes the choices. The entry quotes the choices word for word.

---

## Checked and sound

- **The six-preset range table, against `VOCAL_RANGES`** (`src/stores/settings-store.ts:91-152`).
  The MIDI ranges are bass 40-64, baritone 43-67, tenor 48-72, alto 53-77, mezzo-soprano 57-81
  and soprano 60-84.
  - Lower line, G3 to D4 (55-62): 15/2, 12/5 and 7/10 below/above.
  - Higher line, G4 to D5 (67-74): 14/3, 10/7 and 7/10.
  - The octave-lower table: 3 above the floor, on the floor, 5 below; 2 above, 2 below, 5 below.
    "Four of six" is right.
  - G♯ leaves the bass 1 and the alto 2. F♯ leaves at least 3.
  - The first phrase alone leaves 5 and 6 at the top and at least 7 below.
  - Each line's middle sits within 6.5 of each preset's middle.
- **Every staff position, in both clefs.**
  - Treble: G4 is the second line, A4 the second space, B4 the middle line, C5 the third space and
    D5 the fourth line.
  - Bass: G3 is the top space, A3 the top line, B3 the space above, C4 the first ledger line above
    and D4 the space over it.
  - Do, mi and so sit on three lines (treble) or three spaces (bass).
  - Tavi's F4 sits one place under G4, and her try keeps the steps (+2, +2, −2, −2).
  - Quick check 2's answers and feedback check out, and so do Step 1's "fa on middle C's ledger
    line".
  - C3 sits under four ledger lines and G2 on the sixth, below the drill's treble staff
    (`ledgerStepsFor`, `SightSingingExercise.tsx:73-79`).
- **Every frequency in FACTS 64, and every duration in FACTS 66 to 70**, recomputed: 3.0, 4.4, 1.7,
  2.2, 2.9, 3.7, 8.0, 3.3, 2.6 and 12.0 s.
- **Lesson 9 does answer the plan's predict**, so the writer was right to replace it
  (`learn/09.html:1091-1098`; Lesson 9 LESSON.md:152-153).
- **No earlier lesson answers the new predict outright.**
  - I searched the built pages for "perfect pitch", "absolute pitch", "starting note" and
    "sight-sing".
  - Lesson 6's lines are reasoning aids. A learner can reason the answer out from them, which a
    predict allows, as Lesson 21's does.
- **The teases.**
  - Lesson 15's tease and still (Lesson 15 WEB-SPEC:434-442) stay true: five unnamed notes, up two
    places and back down, never played.
  - Lesson 17's tease and its `shapes` alternative are word for word (55 and 55 characters), and
    neither touches this predict.
- **The head.**
  - The description is 142 characters, with "A fifteen-minute lesson"
    (`src/tests/lesson-pages.test.ts:154-159` and `:191-210`).
  - The title is 56 characters, og:title 46 and its alt 127.
  - The choices are 39 and 33 characters, and the teases 51 and 36.
  - Nothing in the title, the promise, the sound gate, the share card, the recall or the Words'
    definitions names a note to start from, beyond what blocking item 1 and should fixes 1 and 2
    cover.
- **The recall.** It matches `l09-q2` word for word (`src/features/lessons/lesson-09/quiz-questions.ts:54-73`)
  and Lesson 15's quick check 1 (Lesson 15 LESSON.md:315-321).
- **The shared lines** match Lesson 15's Sing it word for word: the comfort check, Just listen
  today with "the two phrases", the voice choice and its line, the clef line, the speaking-volume
  line, the stop line, and the four feelings with the gentle and enough lines and the doctor lines.
- **The sound gate** is Lesson 9's form.
- **The Sight-Singing claims** I read in the code all hold, apart from should fix 5:
  - six notes, scale pitch classes inside the preset's whole span, each move 7 or less, never the
    same note twice running (`use-sight-singing-controller.ts:103-127`);
  - "No audio preview" (`SightSingingExercise.tsx:272-273`);
  - the treble clef only, with sharps;
  - 450 ms, 60 cents and the half-back rule, unfolded (`use-sight-singing-controller.ts:196-217`);
  - 8 s per note;
  - the hold bar's "Hold … to continue" (`:349`);
  - the start screen's "Key: C major · in your range" by default (`src/stores/app-store.ts:42-43`);
  - the tenor default (`settings-store.ts:298-299`) and "Singing Voice Range"
    (`SettingsPanel.tsx:646`);
  - a slug's notes fitted by whole octaves (`src/App.tsx:794-798`), and no auto-start;
  - the lesson marker for 01 to 14 only (`src/lib/lesson-marker.ts:18-19`);
  - `/pitch-training` booting at `#/exercises` (`src/seo/entry-pages.ts:567-573`).
- **The kit claims I read:**
  - the predict's lock, hints, `revealAfter: 'all'` and "no `next`" behaviour (`predict.ts:43-59`,
    `:159-175`);
  - `holdTour` and the tour's step to the stage;
  - `rungLine`, `readingWords`, `octaveLine`, `NOT_STEADY_RUNG_LINE`, `ATTACK_SEC`, `STEADY_SEC`
    and `MAX_TRIES`;
  - `gapWords` taking whose note it is;
  - `foldCents`;
  - `TakeOptions` having no `until` today;
  - `VisitEnding` and the `comfort.ts` mounts;
  - `homeOf` (A3 and A4) and the `fyp-voice` key;
  - the staircase's C4 to B4 slider;
  - the `home-glyph.ts` header;
  - the Lesson 9 entry, `PREREQ` and `DRAFT_LESSONS` in `season.ts` and `drafts.ts`.
- **Lesson 9's built page.** Its Leap and Third definitions (`learn/09.html:613-614` and `:676-677`)
  and Lesson 6's Go deeper (`learn/06.html:1389-1396`) are quoted correctly.
- **Copy and safety.**
  - British spelling throughout, and no emojis, model names or paths in the copy.
  - Tavi's lines are questions.
  - Merc says "absolute pitch, often called perfect pitch" once.
  - No score, no count, any octave counted, and the rest card after Effortful, Uncomfortable and
    Just listen today.
  - The coach's list covers every voice line and the exercise.
- **Length:** 2,225 words, and each step's own text runs 81 to 118, which matches the package.
