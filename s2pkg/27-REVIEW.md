# Lesson 27, Seventh chords and inversions: independent review

Package read in `/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/27-sevenths-inversions/`
(FACTS.md, LESSON.md, WEB-SPEC.md, uncommitted), against its RESEARCH.md and ARTICLE-PLAN.md, the
lead's brief (BRIEF-27), the writer's shared brief, SEASON-2 (§ 2 row 27, the cards for Lessons 26,
27 and 28, § 4.3, § 5, § 7), CURIOSITY-MOMENTS § 1, § 2 (Lesson 23) and § 3.1, the playbook's top
rules, the model packages (12, 23, 25, with 15, 22 and 26's plan), and the app at `c60f0fdcb` (the
worktree's `src/`, which the branch does not touch). The hand-back was read last.

- `node scripts/plan-cites.mjs check …/27-sevenths-inversions`: 233 citations read, 0 findings.
  About 40 cited lines were also read by hand; those below that say less or more than the package
  claims are findings.
- `node scripts/lesson-words.mjs …/LESSON.md`: 2,178 words, cap 2,379, 201 under; steps' own text
  118, 57, 118, 119. Matches LESSON.md, WEB-SPEC Length and FACTS 3.

Counts: **1 blocking, 6 should fix, 11 nits.**

---

## Blocking

### 1. The cold open's predict asks what earlier lessons already answered (LESSON.md:129-152; FACTS 1a, 34-38; WEB-SPEC Decisions 1)

The predict: "Stack one more note on G, B and D the way Lesson 12 built its chords: in C major, skip
a note of the scale above D. Which note goes on top?" [F] [F♯]. The house rule (writer's brief: "A
predict must not ask what an earlier lesson already answered"; the Lesson 21 precedent) fails here
several times over:

- **Lesson 12, a prerequisite, answers it in print.** Its Step 1: "On re it's D, F, A"
  (`lessons/12-chords-four-chord-song/LESSON.md:156`): the third above D in C major is F. Its word
  Diminished: "3 and then 3 semitones: B, D, F" (`:149`): the very top three of G, B, D, F. Its
  Notice rules F♯ out: "no room ever reaches a black key. Every corner is a note of C major."
  (`:161`). The package's own reveal leans on that last line ("Lesson 12 found that C major's chords
  never reach one"), and the hand-back concedes "Lesson 12 itself prints D, F, A as the chord on re".
  A reveal that says "an earlier lesson found this" is the definition of an answered predict.
- **The stem gives the method and the key.** "In C major, skip a note of the scale above D" is a
  look-up on Lesson 4's scale (D, skip E, F). F♯ is excluded by the stem's own words, so the fair
  guess is a misreading, not a guess: Tavi's bubble ("Won't the next note come from G major's
  scale?", `LESSON.md:129`) contradicts the stem it sits over.
- **Lesson 26 asks the identical question,** with the identical two choices, one lesson earlier in
  the season. Its committed plan teaches "D to F" in Step 1 (`lessons/26-second-voice/ARTICLE-PLAN.md:64`),
  "over re it gives F♯, where the key's third is F" on its mix-up card (`:77`), and quick check 1,
  "In C major, what is the third above D, staying in the key?" F [correct] · F♯ (`:139-141`). The
  page now being written in the worktree carries the same (its LESSON.md, quick check 1, "In C
  major, which note is a third above D, in the key?", F correct, F♯ wrong; uncommitted, cited only
  as confirmation). Prerequisite or not, a learner taking the season in order meets this predict
  straight after being quizzed on it.
- **Lesson 15 recites the answer line.** "The bass staff's lines read G, B, D, F and A"
  (`lessons/15-staff/LESSON.md:233`): stacking thirds on lines, the next line above D is F. FACTS 1a
  lists it and does not weigh it.
- **The hero draws the answer's sign.** FACTS 1a says "F and F♯ are both plain beads until a play
  lights one". They are not: the kit's spiral draws a black key's bead smaller (6.5 against a white
  key's 10.5) and, lit as on Lesson 12's ring, as a chrome sphere with its name beside it rather than
  a coloured bead with its letter inside (`src/features/lessons/kit/spiral-draw.ts:13-15`, `:380-405`;
  Lesson 12's ring has "its black keys lit and named in sharps", `lesson-12/rooms-draw.test.ts:6`).
  So before the choice the stage shows F♯ as a black key, which Lesson 12's Notice says no C-major
  chord reaches.
- **Sing it states it in syllables.** "Merc sings so, ti, re, fa" (Just listen and Your turn,
  `LESSON.md:294`, `:309`) is V's seventh chord spelled from so, with fa on top, readable before the
  choice. FACTS 1a notes it ("the predict's reasoning in syllables") and lets it stand.
- **The sound does not decide it.** "Predict before you listen", but what settles F against F♯ is
  key membership, not anything either play makes audible; the reveal argues from the scale.
- **The package applies the rule elsewhere and not here.** FACTS 45 drops the plan's Step 3 predict
  because Lesson 23 answered it. The same rule drops this one.
- **Lesson 26's card primes it.** The lead's tease, "G, B and D going home to C, E and G. Now stack
  one more third." (FACTS 5b), shown on the page that has just taught "a third, staying in the key"
  over re is F, tells exactly the learners who read it that the added note is F. FACTS 5b's "F and F♯
  are both thirds above D … so it answers nothing" ignores that Lesson 26 teaches that the key picks
  the third. (5b also says "one more third" is "what the predict's own stem says"; the stem says "one
  more note".) The `plan` alternative, "Stack thirds and you get a chord. Stack one more on V, and it
  pulls.", leans the same way.
- WEB-SPEC Decisions 1 offers "have Lesson 26 use another note for its question". That does not
  mend it: Lesson 26's Step 1, its mix-up card and its season card (SEASON-2's Lesson 26
  misconception, "over re in C it gives F sharp, where the key's third is F") all teach the same
  step, and Lesson 12 answers it anyway. The fix belongs on this page.

**Fix: a predict on what the hook actually asks, which note makes V pull, decided by ear and by
Lesson 23's pair.** No earlier lesson says which of F or F♯ added to G, B and D pulls home. Lesson
23's Step 4 sets up the reasoning ("only F and B are a tritone apart … closes into a major third …
Lesson 27 comes back to this pair", `lessons/23-perfect-tritone/LESSON.md:260-263`), so it is a
reasoning check on a prerequisite of the kind CURIOSITY-MOMENTS records for Lesson 23's own predict,
not a look-up. F♯ has a real case: in the play F♯4 sits a semitone under I's G4, so it looks like a
leading note into home. As the page would print it (everything else in the cold open, its plays,
hints, locks and held elements, unchanged):

> Tavi: "F♯ sits a semitone under G, and G is in the home chord. Won't F♯ pull hardest?"
> Merc: "Choose, then hear both go home."
>
> **Predict before you listen.** Merc puts one more note on top of G, B and D, then goes home to C,
> E and G. Which note makes the chord pull harder towards home?
> [ F ] [ F♯ ]
>
> Reveal: F. Stacked in C major, as Lesson 12 built its chords, the next note above D is F, the
> key's fa: G, B, D and F is V's seventh chord, the dominant seventh, written V7. One open textbook
> says that added note strengthens V's pull towards I; F♯ isn't in C major at all. Why does F pull?
> That's this lesson's story. (F♯ sits a semitone under G, a note of the home chord, which made it a
> fair guess.)

Stem 29 words and reveal 80 words, against 32 and 91 now, so the cold open gets shorter. The
reveal's last-but-one sentence carries the "which note" half of the hook, which is fine once the
choice is in. What changes with it:

- **FACTS**: 34 to 38 rewritten. The answer is a convention, not a measurement: R4 (Strong) for V7
  pulling harder than V; for F against F♯, R3 (OMT 2e 1.17, Practitioner): major-major sevenths
  "happy and jazzy", major-minor "unresolved (like they strongly need to move to another chord)".
  FACTS should say "counts as" (Lesson 23's form), and the reveal keeps "one open textbook". The fair
  guess is arithmetic: F♯4 (66) to G4 (67), one semitone (that F4 to E4 is one too is Step 3's
  point). 1a is redone for the new answer, with its "plain beads" sentence corrected (finding 3).
- **Promise** (`LESSON.md:103-104`): "hear why the V chord's seventh pulls it home" tells a
  test-wise learner that the stacked, in-key note is the one that pulls. Proposed: "By the end
  you'll build seventh chords, hear why one added note pulls the V chord home, and turn a chord
  upside down."
- **Step 2's text** (`LESSON.md:208-217`) is readable before the choice. With Step 1's visible "A
  major triad with a major seventh is a major seventh chord" and the word Major seventh (11
  semitones), its card ("happy and jazzy" against "unresolved"; "On V, it pulls home") lets a
  learner work out that G, B, D and F♯, a major seventh chord, is the calm one. Hold Step 2's text
  and card as a fourth reveal element, as Step 3's are (its plays already wait), or list it in 1a.
  I would hold it.
- **This lesson's tease on Lesson 26's card**: "G, B and D going home to C, E and G. Now add one
  note on top." (61 characters, under `TEASE_MAX` 70, `src/features/lessons/kit/lesson-copy.ts:76`).
  It is still the opening in miniature and names neither a note nor "third". Replace the `plan`
  alternative too, for example "Three notes make a chord. Add one more to V, and hear where it
  goes." (68), or drop it.
- Optional, and only if Step 3 finds the words (118 of 120): pay off the fair guess there. "With F♯
  instead, B and F♯ are seven semitones apart, a perfect fifth, which counts as settled." (B3 to
  F♯4 is 7, and Lesson 23 calls the fifth settled.)
- WEB-SPEC Decisions 1 goes; quick check 1 can stay as it is (a quiz may ask a recall).

If the lead would rather have an answer that does not rest on a listening convention, the factual
alternative is a size predict: after I's seventh is shown, "Stack one more third on G, B and D, in
C major. How far above G is the new note?" [11 semitones, as on do] [10 semitones]. No lesson says
V's seventh is minor. But its first step (F) is still Lesson 12's and Lesson 26's, so I prefer the
one above.

---

## Should fix

### 2. Chord Stacker's timing is misdescribed on the card, in FACTS and on the coach's list (LESSON.md:375-376, :519-522; FACTS 62, 65; WEB-SPEC:327-328)

The card says "A higher level plays the notes faster"; FACTS 62 says each note is "held 0.6 s at
level 5"; FACTS 65 and the coach's list say "level 1 plays each note for 0.79 s …, level 5 0.6 s …,
level 10 0.36 s"; WEB-SPEC says "its level changes only its speed". The code says otherwise:

- `AudioEngine.playTone` resolves once the tone is scheduled, not when it ends: no await on the
  duration (`src/lib/audio-engine.ts:1104-1279`), and a new tone releases the one before in 80 ms
  ("A new note must replace the previous note immediately", `:1129-1136`). Arpeggio Jumper's code
  says so: "The promise settles when the tone is scheduled. Wait it out, so each demo note sounds in
  full before the next one cuts it off." (`src/features/exercises/arpeggio-jumper/use-arpeggio-jumper-controller.ts:316-319`).
- Chord Stacker does not wait it out. It awaits `playTone`, then only `GAP_BETWEEN_NOTES_MS`, a
  fixed 300 ms (`src/features/exercises/chord-stacker/use-chord-stacker-controller.ts:32`, `:149-154`).
  So notes 1 to 3 start 0.3 s apart and are cut off there, at every level. Only the top note sounds
  for `notePlayDurationMs` (792, 600 or 360 ms at levels 1, 5 and 10). The level does not change the
  pace at all.
- Singing starts 400 ms after the top note begins (`:158-161`), so at levels 1 to 9 the top note is
  still sounding as the first note's time to sing opens. The overlap is 792 − 400 = 392 ms at level
  1, 200 ms at level 5, 8 ms at level 9 and none at level 10.

Fix, card: "… plays a chord of four notes one at a time, from the bottom up, about a third of a
second apart, then you sing each note back in turn …" and "A higher level shortens the top note and
gives you less time to sing each one; the five chords, and the pace of the notes, stay the same at
every level." Coach's list: "the first three notes sound about 0.3 s each at every level; the top
note 0.79 s at level 1, 0.6 s at level 5, 0.36 s at level 10; 3.3, 2.5 and 1.5 s to sing each note;
below level 10 the top note is still sounding for up to 0.4 s as the first note's time to sing
begins." FACTS 62 and 65 and WEB-SPEC Practice links 1 to match.

The writer's other claim stands: Chord Stacker's help, "each one tuned against the notes already
sounding" and "Listen for each new note to 'lock in' with the others"
(`src/features/exercises/exercise-help.ts:196-197`), describes a sustained stack that never sounds.
`playTone` is monophonic, and nothing plays while the learner sings (`_setTargetPitch` only sets a
signal, `src/features/exercises/use-base-exercise.ts:566-567`). The only exception is the top note's
tail above. Its summary, "Add notes one at a time to build a chord in tune." (`:194`), is wrong in
the same way: add it to the hand-back's proposed help text.

### 3. FACTS 1a says F and F♯ are "both plain beads" on the hero's ring (FACTS.md:38)

They are not (finding 1: `spiral-draw.ts:13-15`, `:380-405`; size 6.5 against 10.5, `drawLitBead`
against `drawNamedBead`). Under the present predict this is part of the leak. Under the proposed
one it is harmless, but the sentence must say what the ring shows: F♯ drawn as a black key, smaller,
its name beside it.

### 4. Quick check 1's feedback counts letters two ways (LESSON.md:335; FACTS 75; and the Words, :177-179, FACTS 13)

"A is one letter up from G, a second. The seventh is seven letters up: F." "One letter up" counts
steps, so a second is one letter. "Seven letters up" counts both ends, so a seventh is seven letters
(G, A, B, C, D, E, F), which is Lesson 23's rule: "The number counts letters, both ends included: C,
D, E is three letters, so C up to E is a third" (`lessons/23-perfect-tritone/LESSON.md:195-196`).
Counted by steps, seven letters up from G is G again. Fix: "G, A is two letters, a second. The
seventh spans seven letters, G up to F." In the Words, "seven letters up" should read "seven
letters, both ends counted", or keep "seven letters up" only if the series settles on Lesson 26's
"three letters up" as its form. Either way, one count on the page.

### 5. Step 4 changes Lesson 23's word "inversion" and its rule without saying so (LESSON.md:264-269; FACTS 1b, 49)

Lesson 23, a prerequisite, defined **Inversion** as "an interval turned upside down", whose name
changes: a fifth becomes a fourth (`lessons/23-perfect-tritone/LESSON.md:187`, `:243-246`). Here
"first inversion" names a chord turned upside down whose name stays. The writer's brief asks for one
word, one meaning, and for an earlier rule to be named where it stops being true. FACTS 1b even
cites Lesson 23's fold as what makes E minor tempting, but the reveal names only Lessons 10 and 12.
Fix: one clause in the reveal, for example "(Lessons 10 and 12 called the root the bottom note, and
Lesson 23's intervals changed their names upside down, which made E minor a fair guess.)" The step
text is at 119 of 120, so cut to make room (for instance "stacked in thirds" in the next sentence).
While there, "A seventh chord has a third inversion." never says what is in the bass (FACTS 28 has
it): "its seventh in the bass" is four words, and the Wrap can carry it if the step cannot.

### 6. Turn over's cycle is off by one and its pitches are unspecified (WEB-SPEC:205-209; FACTS 50)

"A fourth press returns a triad to root position, a fifth a seventh chord." Moving the lowest note
up an octave puts a triad back in root position on the third press (C E G, E G C, G C E, C E G) and
a seventh chord on the fourth. If presses keep climbing, the higher voice's I reaches C5, E5 and G5
(G5 is 784 Hz) on the third press and V7 reaches G4, B4, D5 and F5 on the fourth. Both lie outside
FACTS 72's pitches (top E5) and the staff's planned ledger lines. Fix: "The press after the last
inversion returns the chord to root position at its first pitches: the third for a triad, the
fourth for a seventh chord." Add a test (Tests 2 or 8) that no Turn over press sounds a pitch
outside FACTS 72.

---

## Nits

7. **Lesson 28's tease** (FACTS 5; LESSON.md:400-408). I agree with the writer's check. The lead's
   line is Lesson 28's opening in miniature (two parts, bar 8 the interrupted version's V to vi
   under G4, two bars more). It names no part, note or chord, so it does not answer Lesson 28's
   predict, and it presumes nothing from this page. "It sounds finished" is stronger than Lesson
   28's one source, "a weak cadence because of the "hanging" (suspended) feeling it invokes"
   (`lessons/28-cadences-form/RESEARCH.md:49-51`). The writer's "At bar 8 it seems to end, then
   keeps going." (64) is the truer line; the lead's call. Withdrawing the plan's "Songs use it to
   finish" is right (Lesson 28 RESEARCH's first disagreement). The writer's catch also holds:
   Lesson 28's planned stem, "the top part reached do, G, just as it does when the song ends"
   (`lessons/28-cadences-form/ARTICLE-PLAN.md:55-57`), rules out its own second choice. That one is
   for Lesson 28's writer.
8. **Stack's card** (LESSON.md:380-383) says nothing of how Stack picks its chords. It picks near
   the listener's rating (`pickBankItem`, `src/lib/ear/banks.ts:451-486`, "a beginner is not fed the
   tritone on round two"), and the dominant seventh's seed is 1150 against major's 950
   (`banks.ts:117-157`), so a beginner hears major and minor most and the dominant seventh less
   often. Optional: "it picks chords near your level, so the dominant seventh comes more often as
   you improve."
9. **Chord Stacker's printed names** are sharps with octave numbers, "A#3" where theory writes B♭
   (`midiToNoteName`, `src/lib/frequency-to-note.ts:71-83`). The page teaches B♭ in its Words, and
   Lesson 25's card names the same habit of Sight-Singing ("G♯ as 'G#4'"). One clause: "every black
   key as a sharp".
10. **FACTS 62**: `CHORD_LABELS` is "used only by its tests". It is used nowhere: it is returned from
    the controller (`use-chord-stacker-controller.ts:314`) and read by no file, and
    `src/tests/exercise-chord-stacker.test.ts` does not name it. The claim that matters ("it never
    names the chord") is right.
11. **Step 1** (LESSON.md:187): "Stack one more third on a triad, as Lesson 12 did". Lesson 12
    stacked thirds into triads, never a fourth note. Say "stacking thirds as Lesson 12 did".
12. **Step 3** (LESSON.md:227): "Lesson 23 ended on a pair". Its last step did; the lesson ends on
    its Wrap. Say "Lesson 23's last step ended on a pair".
13. **Step 1's toy at first paint** (WEB-SPEC:191-198): say the I room is the one lit at first, so
    Add the seventh cannot sound G, B, D and F before the choice through a V lit by default.
14. **WEB-SPEC Tests 8** (:479-480): "G3 and B3 on their ledger lines in the treble". They hang
    under them: G3 under the second ledger line (A3's), B3 under the first (C4's), as FACTS 51 says.
15. **WEB-SPEC Length** (:141): "Six parts carry more" introduces eight (Steps 2, 3 and 4, Sing it,
    the quick check, the recall, the cold open, the Wrap).
16. **WEB-SPEC Edge cases** (:446): "G2 … sounds only in the lower voice's V7". The lower voice's V
    triad sounds it too (Step 1's V chip and held play, G2, B2, D3).
17. **FACTS 73's loudness**, worked out: 4 × 0.056 = 0.224 against 3 × 0.075 = 0.225 in summed
    amplitude. In power the seventh chord is a little quieter (4 × 0.056² ≈ 0.0125 against
    3 × 0.075² ≈ 0.0169, about −1.3 dB), so "no louder" holds and Step 2 compares two four-note
    chords anyway. Worth one clause in FACTS.

The hand-back's `pr.needs` adds "(the ear-drill launch kind)", which WEB-SPEC's Explorer section
(:353-355) does not have. Admin-only; make them agree.

---

## Checked and found sound

- **Other leak checks**, against the present predict and against the proposed one: the title (75
  characters, names no note); the head title (50), description (147, "A fifteen-minute lesson", 80 to
  160 as `src/tests/lesson-pages.test.ts:156-159` and `:196-209` ask), og and twitter titles (58),
  share alt (150), structured data and llms.txt line; the sound gate; the three Words (all on C, no
  G); the recall (question 3's "C, G, A and F" and "fa" is a weak lean, rightly listed); the step
  headings and the masthead menu's card line (`lesson-menu.ts:210-222`); Step 1's held paragraph and
  Step 3's held text as reveal elements (`predict.ts:70-71`); the steps' toy, free play and tour
  holds (`unlocks`, `holdTour`, `tour-copy.ts:44-46`); Step 4 disabled until the cold open's choice
  (Lesson 22's wiring); the quick check, Wrap and Sing it lines below, listed in 1a. Step 4's
  predict is not answered earlier: Lesson 12 voices every chord in root position
  (`lesson-12/music.ts:165-183`), and no lesson's LESSON.md uses "inversion" for a chord. Its
  heading change is well argued.
- **Music**: every interval and chord (C to B 11, G to F 10, G to F♯ 11, thirds 4-3-4 and 4-3-3, B3
  to F4 6 closing to C4 and E4 4, E-G-C as 3 and 5, F to G 2 in third inversion); the ring's angles
  and bead distances (`spiral-draw.ts:130`); four-corner rooms in ring order for every chord on the
  page; every staff position in both clefs (FACTS 51, 52); the figures 6 and 6 over 4; the slash
  name C/E; the quick-check answers and feedback, apart from finding 4; the Step 2 Notice true of
  both choices.
- **The sing-along**: so, ti, re, fa, mi, do in G is D, F♯, A, C, B, G, with sung steps of +4, +3,
  +3, −1 and −4, spanning 10. Against `VOCAL_RANGES` (`src/stores/settings-store.ts:91-152`) with
  two semitones inside: lower D3 to C4 has bass 10 and 4, baritone 7 and 7, tenor 2 and 12; higher
  D4 to C5 has alto 9 and 5, mezzo 5 and 9, soprano 2 and 12. All pass. Only do on G, A♭ or A
  passes for both voices; C fails as FACTS 53 says; the octave-off figures fail as FACTS 55 says;
  the shorter figures span 6 and 5. Timings: 7.8 s, and 8.8 s with the count-in
  (`kit/move-do.ts:65-66`).
- **Chord Stacker otherwise**: five types and degrees (`:13-19`); the shuffle (`:89`); the root from
  the preset's anchor or a challenge, and the dial over the preset's whole range (`ChordStackerExercise.tsx:27-37`,
  `:122-129`; `vocal-range.ts:14-25`, `:132-147`); tops 8 to 10 under each preset's top from the
  anchor; scoring with no octave folding (`exercise-scoring-utils.ts:63-72`, `:165-172`); the
  25-cent dot; "Sing note N of 4"; the idle line; no staff; level factor 1 + (5 − level) × 0.08,
  levels 1 to 10, default 5. **Stack**: six pads, the dominant seventh "7", no major seventh chord,
  a block of 1.1 s, root C3 to C4, the broken replay, nothing locked.
- **Shared lines**, word for word with Lesson 25 (and so with Lessons 23, 15, 12 and 3): the comfort
  check, Just listen, the voice choice with Lesson 15's line, speaking volume, the stop line, the
  guide's line, the feelings and their endings, the doctor lines. The card's care lines and rest
  version are Lesson 12's form.
- **Copy**: British spelling; no emojis, model names, paths or agent ids; Tavi's lines are a sincere
  guess and a sincere question; Merc never judges; "piano key" and "key" kept apart; "major seventh"
  never stands for the chord.
- **Run time and chips**: 2,178 / 238 = 9.15 minutes plus 334 s of activities = 14.71, so 15;
  four chips with one "15 minutes"; prerequisites 12 and 23 as SEASON-2 § 4.3 has them.
- **Departures**: all justified and listed alike in the preamble, FACTS 4 and the Contract, except
  that the predict needs the change in finding 1. Dropping Step 3's predict, holding Step 1's V
  paragraph and Step 3's text, two rooms in the hero, both choices played, three words, Step 4's
  heading, dropping minor (Lesson 25 is not a prerequisite), G7 and "usually" out of quick check 2,
  and the run time are right.
- **This lesson's own tease** fits the opening as written, but leans for Lesson 26's learners
  (finding 1). **Lesson 28's tease**: nit 7.
