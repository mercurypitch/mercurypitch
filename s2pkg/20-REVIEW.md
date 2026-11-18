# Lesson 20 review: Runs and the pentatonic scale

Reviewer's report on `docs/plans/find-your-pitch/lessons/20-runs-pentatonic/` (FACTS.md, LESSON.md,
WEB-SPEC.md, uncommitted in `/dev/shm/s2plan` on `feat/season-2-plan` at `b55beeb20`, app at
`c60f0fdcb`). Read against RESEARCH.md, ARTICLE-PLAN.md, BRIEF-20, the current BRIEF-writer-common
(it changed while I worked, adding the "minutes as a word" rule; the package already complies),
SEASON-2 § 1, § 2 row 20, § 3 (Lessons 19, 20, 21), § 4.3, § 5, § 7, the house rules, the model
packages and the app. The hand-back was read last.

Counts: **1 blocking, 8 should fix, 18 nits.** Line numbers are the files as they stand.

Tools: `node scripts/plan-cites.mjs check …/20-runs-pentatonic` gives 246 citations, 0 findings.
`node scripts/lesson-words.mjs …/LESSON.md` gives 2,230 words, 149 under the cap of 2,379, with steps
of 119, 111, 120 and 97. Both match what the package states.

---

## Blocking

### B1. Sing it gives no way out when the top feels high (voice safety)

- **Where:** LESSON.md 250-254 (Your turn); 447-456 (coach list); FACTS 51-52; WEB-SPEC Toys 6,
  state 2.
- **What is wrong:** Your turn says only "If the bottom feels low, move do, your starting note,
  higher." Move do's "lower" button is `aria-disabled` from the start. No smaller run is offered.
  So a learner for whom la (B3 or B4) feels high has nothing to do except stop.
- **Evidence:** every other sung checkpoint in the series has a way past the top:
  - Lessons 4, 6, 8, 10, 12 and 14: "If the top feels high, move do, your starting note, lower".
  - Lesson 9: "If the top feels high, move do … lower, or take the smaller ladder"
    (`09-landing-a-leap/LESSON.md:221-222`).
  - Lesson 15: "If the top note feels high, leave it out and stop at fa." (`15-staff/LESSON.md:294-295`).
    Lesson 15's preamble names this as the reason for the line (`15-staff/LESSON.md:52-55`).
  - Lesson 23: "If the top note feels high, sing only do up to so." (`23-perfect-tritone/LESSON.md:304-305`).

  Lesson 23 had the same constraint (no Move do at all) and still gave the singer a smaller task.
  The range rule only keeps the run two semitones inside the presets. Real voices differ from the
  presets, and the house rule is "comfortable, never push" (SEASON-2 § 1.4 item 4).
- **Fix:** offer the smaller run the coach list already floats: do re mi so mi re do, seven 0.75 s
  slots, 5.25 s, topping at A3 or A4 (FACTS 51 already shows it is at least 7 under every top).
  - Make it a choice beside the full run, as Lesson 9's ladders are: [ The run ] [ Smaller: do re mi
    so mi re do ].
  - Add "If the top feels high, sing the smaller run." to Your turn.
  - Add its rung labels to FACTS 58, and its slot count to the flow and the tests.
  - The cost is about 15 words, inside the text cap's 149. The built page then needs one of the
    Step 4 cuts that WEB-SPEC Length already names.
  - At minimum, if the coach later declines the smaller run, Your turn still needs a top line, such
    as "If la feels high, stop and just listen today."
  - Either way, list the top line for the coach.

---

## Should fix

### S1. "That's the next notch up." is false on this page's own Tempo

- **Where:** LESSON.md 282 and 476; WEB-SPEC 334; FACTS 63.
- **What is wrong:** the scored take runs at 0.75 s a note and the faster pass at 0.45 s. The page's
  own Tempo has five notches, 0.75, 0.6, 0.45, 0.3 and 0.2 (FACTS 39; WEB-SPEC 260-261). So 0.45 is
  two notches up from 0.75, not the next one.
- **Why it matters:** Step 3 teaches the learner to "nudge it up" and "drop back a notch"
  (LESSON.md 196), so "notch" is a unit the learner has just used.
- **Fix:** keep the lead's 0.45 s and reword the line. Two options:
  - "That's two notches up: 0.45 seconds a note." This also names the task, not the voice.
  - "That's the run, faster."

  Then update FACTS 63 and the coach line.

### S2. The page never shows or plays the smudging its title asks about

- **Where:** LESSON.md 104-106 (cold open), 204-205 (Step 3); FACTS 38 and 92; WEB-SPEC Toys 2 and 5.
- **What is wrong:** the writer rightly stopped drawing Merc's clean synthesised run as blurred
  (FACTS 38). But nothing replaced it. Every run on the page lands "each still in its band": the fast
  play, all five notches and Merc in Sing it. The hook asks how singers avoid "the notes smudging
  together". Step 3's plan says "When notes start to smudge, drop back a notch". Yet the learner
  never hears or sees a smudged run, so the plan's cue has nothing to point to.
- **Evidence:** CURIOSITY-MOMENTS § 1 rule 3 ("Show, don't tell. A sound and a figure"). Lesson 3's
  cold open plays "a semitone off" as a drawn, synthesised illustration of a miss
  (`03-match-a-note/LESSON.md:68-71`).
- **Fix:** give Step 3's run toy one illustrative play, "Play it smudged", in Merc's voice at 0.2 s
  a note.
  - Glides take most of each note (say 0.12 s of 0.2), and mi and la land 40 to 70 cents off.
  - The beads are drawn where the voice went, outside their bands.
  - Its Notice: "smudged, the beads slip out of their bands: that's the moment to drop back a
    notch."
  - Add a FACTS line under "Illustrations without claims": an illustration, not a measurement of any
    singer.
  - It costs about 3 words of label and one Notice clause.
  - If the lead prefers no such play, Step 3 at least needs one clause saying what smudging is
    ("notes that slide past their bands").

### S3. Step 1's Notice reads names the staircase is not specified to show

- **Where:** LESSON.md 158-160; WEB-SPEC Toys 1, 192-193 ("from D the five are D, E, F♯, A and B,
  and their names show on focus").
- **What is wrong:** the Notice asks the learner to see "From D, the five are Merc's: D, E, F♯, A
  and B". The spec shows names only on focus, so a sighted mouse or touch user never sees the
  letters after the slide. Lesson 4's staircase draws each stair's name in the page's names mode,
  Letters, Numbers or Do-re-mi (`src/features/lessons/lesson-04/stairs-words.ts:5-6`, `stairName`
  at :29-34). The spec does not say which mode, or whether there is a mode switch, in Steps 1 and 2.
  Step 1's text speaks in syllables and its Notice in letters. Step 2 needs both: "A, C, D, E and G"
  and "do, me, fa, so and te".
- **Fix:** say in WEB-SPEC Toys 1 what each stair shows.
  - For example, syllable above and letter below, printed through `signsHtml` for F♯, E♭ and B♭.
    Or offer Lesson 4's names switch, defaulting to letters in Step 1 and to syllables in Step 2.
  - Add the drawn names to the Contract's list of printed signs.

### S4. "Run" means two things across the season (Lesson 18 and Lesson 20)

- **Where:** LESSON.md 144 (Run, the word); 47 (the staff switch); FACTS 28 and 47.
- **What is wrong:** Lesson 18, two lessons earlier, teaches "a run" as a reading pattern of steps:
  - "a run of steps (neighbouring lines and spaces)" (`18-read-a-line/ARTICLE-PLAN.md:82`);
  - its reveal: "A run of steps up and back" (:40);
  - its quick check: "A run of steps [correct] · Like do re mi." (:138);
  - its wrap: "Readers see patterns … a run, a repeat, do-mi-so" (:152).

  Lesson 20's run, do re mi so la so mi re do, skips at mi–so and so–mi. On Lesson 20's own staff
  switch that is F♯3 on the fourth line to A3 on the top line in the bass clef, and F♯4 in the
  bottom space to A4 in the second space in the treble. Neither is "neighbouring lines and spaces".
  The brief's rule is one word, one meaning.
- **Fix:**
  - Make Lesson 20's word say the difference: "Run: quick notes one after another, by step or by
    skip, like Merc's nine."
  - Add a line to the hand-back's "Notes for other packages" for Lesson 18's writer: always qualify
    it as "a run of steps" (Lesson 18's own Words and Step 3 mostly do), so that Lesson 20's broader
    "run" does not contradict it.

### S5. The coach list leaves out two practice-advice lines the learner reads

- **Where:** LESSON.md 202 (mix-up card) and 320 (Wrap); coach list 419-423.
- **What is wrong:** the coach list quotes Step 3's plan and Arneson's line. It leaves out the two
  most direct instructions on how to practise singing fast:
  - the mix-up card's "The better idea: find the fastest tempo you can sing right, practise there,
    then nudge it up.";
  - the Wrap's "For speed, keep your tries right: a tempo where every note lands, then nudge it up."

  "The fastest tempo you can sing right" invites working at the edge. That is the coach's call.
- **Fix:** add both to "The steps" in the coach list, and to FACTS 20 and 78's status ("the coach's
  list").

### S6. Tavi's guess and the predict test different ideas

- **Where:** LESSON.md 108-121; FACTS 13 and 15.
- **What is wrong:** the bubble voices "To sing it fast, you just practise it fast, don't you?",
  which is about tempo. The choices are "How long they practised" and "What share of their tries
  came out right", and the reveal's fair-guess line explains "how long". So the learner commits on
  an idea nobody on the stage voiced. Tavi's misconception is answered only later, in Step 3's mix-up
  card, by inference.
- **Evidence:** CURIOSITY-MOMENTS § 1 rule 2: the other choice is "a fair guess". MERC-BIBLE: Tavi's
  sincere guess sets up the predict. The card's misconception stays in Step 3's mix-up card either
  way.
- **Fix:** let Tavi voice the "how long" guess. Either:
  - "To sing it fast, you just practise it a lot, don't you?"; or
  - "Surely the more you practise, the faster you get?"

  Both are sincere guesses that match the first choice. Keep "Speed comes from practising it fast."
  for the mix-up card, as the card asks. Update FACTS 13.

### S7. Tests 18 fails against its own page

- **Where:** WEB-SPEC 618-622.
- **What is wrong:** the test says that at first paint the hero, the recall and the four words hold
  no "slow" beyond the predict's own choices. But the hero's free play is "Play it slowly" (LESSON.md
  102), and the Run word's play is "[Play: the run, slowly]" (LESSON.md 144). Both contain "slow",
  and both are deliberate.
- **Fix:**
  - Exempt the two play labels by name, or test whole words other than "slowly".
  - Keep "share", "correct", "accurate" and "how long", with the predict's choices exempt.
  - Say in FACTS 1a why "Play it slowly" is not a leak. It already argues that the plays "show what a
    fast run is"; quote the label there.

### S8. The draft line says "look", but this voice lesson waits on a sign-off

- **Where:** WEB-SPEC 479-481 (`20: "Lessons 5, 9 and 10's pages, and the vocal coach's look at the
  sung checkpoint"`); hand-back, the same line.
- **What is wrong:** LESSON.md 3-4 and the hand-back's MASTER-PLAN § 11 entry say this page "waits
  on the vocal coach's sign-off (MASTER-PLAN § 12 item 8)". The series uses "look" for theory lessons
  with an unscored or light sung part:
  - Lessons 10 and 12 (`src/features/lessons/kit/drafts.ts:39-40`);
  - Lessons 15 and 23 (`15-staff/WEB-SPEC.md:567`, `23-perfect-tritone/WEB-SPEC.md:562-563`).

  Voice lessons with a scored checkpoint use "sign-off": Lessons 9, 11, 13 and 14 (`drafts.ts:38`;
  `11-registers-break/WEB-SPEC.md:731` and the like).
- **Fix:** `20: "Lessons 5, 9 and 10's pages, and the vocal coach's sign-off (MASTER-PLAN § 12 item
  8)"`, in WEB-SPEC and the hand-back.

---

## Nits

### N1. "so" as a conjunction

- LESSON.md 296, quick check 1: "Do is its home and so its fifth: both stay." reads as "and so
  (therefore) its fifth". The writer's rewording brings in the ambiguity FACTS 74 says the page
  avoids. Suggest "Its home, do, and its fifth, so, both stay."
- FACTS 74's "'so' … is never a conjunction" is also not true of the page as a whole. The imported
  recall has "All seven, so the scale starts a semitone lower", and the shared line has "Thanks for
  saying so." Say "never in this page's own lines".

### N2. The listen path lost Lesson 9's voice-choice prompt

- Lesson 9 prints, after Just listen today with no voice stored, "Choose a voice: it picks the Merc
  who sings." (`09-landing-a-leap/LESSON.md:204`).
- Lesson 20 drops it (LESSON.md 237-243), so a listener sees only "Choose a voice to sing with".
  Yet the preamble (24-28) says these lines are Lesson 9's word for word.
- Suggest "Choose a voice: it picks who sings." (Tavi sings for the higher voice), or say why the
  line is dropped.

### N3. "Merc sings it first in D" is false after a Move do

- LESSON.md 250: after a press of "higher", the run is no longer in D. Lessons 15 and 23 could say
  "in G" and "in D" because they have no Move do.
- Suggest "Merc sings it first, from do," or "starting in D".

### N4. "As above" after the faster pass implies a count

- LESSON.md 284: "(After the faster pass, Effortful and Uncomfortable end the singing as above.)"
  The Effortful branch above gives "the count", but the faster pass has none.
- Add "with no count".

### N5. Staccato Precision's timings are its starting level only

- The coach list (LESSON.md 484) says Staccato Precision gives "each 0.2 s, then 1.5 s". That holds
  only at its starting level.
- Unlike Scale Runner, it can level up. Its grade can reach 100 (`avgAccuracy * 0.45 + bestRound *
  0.2 + attackPrecision * 0.35`, `use-staccato-precision-controller.ts:197-198`). Above level 5 its
  reference and window shrink, to 0.12 s and 0.9 s at level 10 (`verify20.py` section 10).
- Add "at its starting level; shorter if its level rises". FACTS 67 already says "each shorter".

### N6. FACTS 8 misdescribes the Run word's play

- FACTS 8 (line 56) says the four words' plays are "in the soft tone at C4 … for everyone".
- The Run word plays Merc's run from D3 in his "ooh" (FACTS 28, WEB-SPEC Toys 4 and the Audio table).
  Correct FACTS 8.

### N7. FACTS 79 lists only the fixed notes

- Move do's runs and Step 1's Slide reach G♯3, C♯4, D5, G♯4, C♯5 and D♯5, among others.
- Add "every other note, Move do's and Slide's among them, is `hz(m)`", as WEB-SPEC Tests 5 implies.

### N8. The three files disagree on where the departures are listed

- WEB-SPEC 648 says each departure is "listed in LESSON.md's preamble". The preamble (34-65) lists
  11 of FACTS 4's departures. It leaves out:
  - Merc's shorter line;
  - the Run definition;
  - Step 1's Slide and riser counts;
  - the reader's options;
  - the plan's Easy and Workable line;
  - the practice card;
  - the quick check's rewording;
  - the tease.
- FACTS 4 in turn leaves out the Wrap's third line (FACTS 78) and "Leave out" for "Remove".
- Align them, or say "argued in FACTS 4" only.

### N9. The Contract's list of printed signs

- The Contract (WEB-SPEC 634-636) lists "F♯ in Step 1 and Sing it". Sing it prints no F♯ (the range
  table is the coach's).
- The next-lesson card's tease prints F♯ and C♯ and is missing from the list.

### N10. FACTS 6 claims a shared line as the page's own

- FACTS 6 calls "Cadenza: your solo, and any octave counts" this page's own line.
- It is word for word the Sing it line of Lessons 9, 15, 21 and 23.

### N11. FACTS 1a's search left out Lessons 16 and 18

- FACTS 1a searched Lessons 1 to 15, 17, 19, 21 and 23 for an earlier answer to the predict. It did
  not search the plans of Lessons 16 and 18, which come before this page.
- I searched both: nothing on the study or on practice tempo. Lesson 16's plan:102 "a link, not
  proof" is about a different study. Add them to the list.

### N12. Decisions for the owner lists settled items

- WEB-SPEC Decisions for the owner (529-532) lists the two teases, both settled.
- The brief asks for only what is truly open. Move them to a note, or say "None open", as the
  hand-back does.

### N13. The masthead's anchors are named two ways

- WEB-SPEC line 9 says "Lesson, Sing it and Explorer"; line 73 says "Lesson, Sing and Explorer".
  Pick one.

### N14. A "lower" button that never works

- On this page Move do's "lower" is never usable (LESSON.md 254; WEB-SPEC 297-301).
- Lesson 9's flow rule is "a control it does not offer is absent, never disabled", with only the kit's
  end states as the exception (`src/features/lessons/lesson-09/ladder-flow.ts:15-18`).
- A button disabled from the first paint is a control not offered. Consider showing only "higher",
  as "Move do higher".

### N15. Quick check 4 replays the Minor pentatonic word's own sound

- Quick check 4 plays exactly the sound the Minor pentatonic word labels: A3 C4 D4 E4 G4 A4, soft
  tone, 3.15 s (WEB-SPEC Toys 4 and 8).
- A learner can match the remembered sound instead of hearing the shape. Consider E minor
  pentatonic, E3 G3 A3 B3 D4 E4: its first step is still three semitones.

### N16. Kit item 6 is incomplete

- WEB-SPEC kit item 6 (499-504) adds `attackSec` and `steadySec` to `LadderOptions`.
- But `readLadder` reads each slot through `readTake`, which reads `ATTACK_SEC` and `STEADY_SEC`
  itself (`src/features/lessons/kit/take.ts` `readTake`: `onset + ATTACK_SEC`, `< STEADY_SEC`).
- So the options must reach `readTake` as well. Say so.

### N17. The dose differs from Lesson 9's

- The coach list (LESSON.md 461-464) says "at most three takes a visit, as Lesson 9".
- Lesson 9 also caps sung ladders at two (`ladder-flow.ts`, header: "at most two sung ladders").
  This page allows two read runs plus the faster pass, three sung runs in a visit.
- Say so for the coach. The load is small: 6.75 + 6.75 + 4.05 s.

### N18. The built-page margin is 9 words and the itemisation may miss some

- WEB-SPEC Length itemises about 140 built-page words, landing at about 2,370.
- Lesson 4's staircase carries a visible readout beside its screen-reader line (`learn/04.html:765-767`,
  `stairs-readout`). If the kit's staircase keeps it, it is not counted.
- Either say it is hidden on this page, or count it. Step 4's cut is already named.

---

## Checked and sound

**Predict leaks.** The predict asks which went with better next-day playing among 17 piano
students: how long they practised, or the share of tries that came out right. I checked these
against the predict and found nothing that gives the answer:

- the title, promise and sound gate;
- the seven chips;
- the hero stage and its two free plays;
- Tavi's and Merc's bubbles;
- the recall (`l09-q2`, `l10-q4`), compared word for word with Lessons 9 and 10 and their quiz
  objects at `c60f0fdcb`;
- the four words and the four step headings;
- the masthead menu card and the section-heading lines;
- the head title, description, og and twitter text, the share alt, the structured data and the
  llms.txt line;
- Lesson 19's tease and its still (Lesson 19 FACTS 5), and Lesson 21's tease and still;
- the explorer entry.

Step 3's text, the mix-up card and the Wrap carry the answer, all behind the deck or far below, and
the tour holds for the choice, as Lesson 23's does. Season 1's packages and the plans of Lessons 16
and 18 give neither the study's result nor "accurate practice first". Lessons 3 and 9 speak of the
tempo of a performance, as FACTS 1a says.

**Sources, re-read for this review:**

- Duke 2009's abstract, from OpenAlex: 17 piano majors; "practice until they were confident they
  could play the passage accurately"; no relation to time or trials; r = −.51 and −.71 for the
  share correct.
- Arneson p. 2 (pdftotext): the LEGATO, STACCATO and AGILITY paragraphs, and "Staccato exercises
  develop onset, and breath coordination, among other things." are verbatim. "[u], [a]" is "oo" and
  "ah".
- Savage 2015 (PMC): "containing seven or fewer scale degrees per octave", the eight failed
  features, "surprisingly similar interval structures" and "relatively small". Table S5 gives 0.981
  for nonequidistant scales and 0.964 for seven or fewer degrees, so "nearly were" is fair.
- OMT 2e 8.9: "ma2–ma2–mi3–ma2–mi3", "The black-note collection is, once again, the pentatonic.",
  the "removes … half steps" and "minor pentatonic" lines. 7.13: "a subset of both of those
  collections … only 5 pitches and no semitones" and "two rotations".

**Musical arithmetic.** Each of these is right:

- The major pentatonic's steps 2, 2, 3, 2, 3, and from la 3, 2, 2, 3, 2.
- D E F♯ A B; A C D E G; do me fa so te from A.
- C E♭ F G B♭ as C natural minor less re and le.
- 12 / 5 = 2.4.
- E pentatonic's three black keys (F♯, G♯, C♯).
- Every frequency in FACTS 79.
- Every duration:
  - the runs: 1.80, 2.70, 4.05, 5.40 and 6.75 s;
  - notes a second: 1.33, 1.67, 2.22, 3.33 and 5;
  - the staircase: 4.05 and 3.15 s; the inline plays: 7.7 and 6.8 s;
  - staccato 3.75 s, legato 4.05 s, the pair 8.3 s;
  - the faster pass: 9.1 s.
- The run time: 355.5 s = 5.92 min, plus 9.37 min of reading, gives 15.29, so the chip reads 15.
- The head strings: 53, 148, 58, 67 and 163 characters; the teases 50, 54, 69 and 65.

**Staff positions.** Bass clef: D3 on the middle line, E3 in the space above, F♯3 on the fourth
line, A3 on the top line, B3 in the space above it. Treble clef: D4 under the bottom line, E4 on
it, F♯4 in the bottom space, A4 in the second space, B4 on the middle line. No ledger lines. These
match Lesson 15's letters (`15-staff/LESSON.md:176-180`, `:233-234`), and its sharp rule (:200-201).

**Range.** I worked the six-preset arithmetic against `VOCAL_RANGES`
(`src/stores/settings-store.ts:91-152`):

- The lower run, D3 to B3:
  - bass E2–E4: 10 below, 5 above;
  - baritone G2–G4: 7 below, 8 above;
  - tenor C3–C5: 2 below, 13 above.
- The higher run, D4 to B4:
  - alto F3–F5: 9 below, 6 above;
  - mezzo-soprano A3–A5: 5 below, 10 above;
  - soprano C4–C6: 2 below, 13 above.
- Move do:
  - Any move lower leaves the tenor or the soprano 1 semitone or less above the floor.
  - Up: +3 is the most for the lower voice (la D4, 2 under the bass's top) and +4 for the higher
    (la D♯5, 2 under the alto's top).
  - The plan's ±4 breaks four presets: tenor, bass, soprano and mezzo.
- The octave below is out: D2 is 2 under the bass's floor, and D3 is 3 under the alto's.
- The smaller run sits at least 7 under every top.
- Do on E gives 2 lower and 1 higher for the lower voice, and 2 and 2 for the higher.
- The kit's `MoveReach` with 0 on one side works, and `setMoveEnds` marks the button at once
  (`move-do.ts:29-63`).

**The drills, read in the code.**

- Scale Runner:
  - one note at a time: a 0.7 s tone, a 0.25 s gap, then a 2 s window, scaled by `difficultyFactor`;
  - Pentatonic is `pentatonic-major`, six notes, one direction a run;
  - a Starting Note dial, and a start from the preset's anchor, folded only if the top would pass;
  - no octave folding in the scoring (`averageDeviationCents`), so an octave scores 0;
  - a grade of at most 80, against a rise at an EMA of 90, so it never rises;
  - its level changes only through `updateDifficultyFromEma`, and the launch override is one-shot;
  - `/exercises/speed-scales` opens it at difficulty 8.
- Staccato Precision:
  - eight shuffled major-scale degrees from the anchor, with no fold, inside every preset;
  - a 0.2 s reference, a 0.3 s gap and a 1.5 s window;
  - 7, 7, 6 and 5 rounds at levels 4 to 1;
  - "timing" in its help but not in its scoring.
- The practice card's words match all of this. "Under Scale, choose Pentatonic" matches the label,
  and "Singing Voice Range" is the Settings heading.

**Kit claims, read in the code.**

- The research predict's wiring, as Lesson 3's (`hook.ts:170-188`), and `data-free` plays
  (`predict.ts:12-17`).
- `holdTour`; `stepsOf` and the step deck's `h3` titles.
- `readLadder`, `readTake` (0.3 + 0.6 = 0.9 s cannot fit a 0.75 s slot, so the two options are
  needed), `countLine`, `trickyAfter`, `rungLine` and `octaveLine`.
- The band edges, 15, 35 and 60.
- `TAKE` (0.4 s gap, 6 s wait) and `COUNT_IN` (0.8 s at 0.065, 0.2 s quiet).
- Merc's voice: 2,600 Hz, 0.2 gain, 5.5 Hz vibrato at ±14 cents grown in over 0.35 s, a 0.09 s attack
  and a 0.34 s release.
- `PAD` 14; `.sing-chart` 240 and 210 px, giving 19.3 and 16.5 px a semitone.
- `afterFeeling`, `recallStepHref`, `linkAway`, and "Right." and "Not quite."
- `RECALLS`; the lesson marker (01 to 14); `mirror-metrics` bounds 1 to 14; `RELEASED_LESSONS`;
  `lessonPages`; `LESSON_PAGE`.
- The head test's 60 and 80-160 limits, and its `MINUTE_WORDS` (the description's "A
  fifteen-minute lesson" passes the brief's new rule).
- The no-planning-text patterns (nothing on the page matches) and the stage-fit sizes.

**Shared lines.** I diffed these word for word against Lesson 9's text: the comfort check, Just
listen today (with "the run"), the doctor lines, the warm-up, the stop line, "What this does", the
feelings and the no-microphone line. The only gap is N2. The practice card's care lines and the rest
card match Lesson 12's (`12-chords-four-chord-song/LESSON.md:337-345`), and dropping Staccato
Precision from the rest card is right.

**Copy.** I checked:

- British spelling, including practise/practice throughout.
- No emojis, model names or paths in the learner copy.
- The headings are Tavi's questions, and Tavi's line is a sincere guess (but see S6).
- The chips' titles match `season.ts`, and "Also useful" uses Lesson 19's `short`.
- Step 3's inference is hedged: "suggests" and "though no study here tested it on singers".
- Arneson is attributed as "a guide for new singing teachers", and the blues scale as
  "MercuryPitch's".
- The Lesson 18 citations hold at `ARTICLE-PLAN.md:58`, `:101-108` and `:175`. Lesson 16's `:204`
  is still the ±60 rule.

**Hand-back.** Its claims check out: the counts, the entries and the departures. It omits S4's
Lesson 18 note and S8's draft line.
