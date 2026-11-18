# Arc C ("Read it"), Lessons 15 to 21: research and article plans

Each lesson's folder holds RESEARCH.md (every card fact resolved, with source, what it says, how far it
was read and a strength) and ARTICLE-PLAN.md (Season 1's LESSON.md order, with predicts, Tavi's lines
and quick checks written out). App claims were read at `b803c7d43`. Downloads were deleted after use.

## Across the arc

- **Exam-board comparison, now checked (SEASON-2 § 1.1, § 7 item 13).** ABRSM's theory specification
  (v1.2, April 2023, p. 12): Grade 1 sets both clefs, middle C in both, semibreve to semiquaver, ties,
  single dots, 2/4 3/4 4/4, and C G D F major; Grade 2 adds two ledger lines, triplets, and A B♭ E♭
  major; Grade 3 adds 6/8 and up to four sharps or flats. The season's reading scope (two ledger lines,
  three sharps or flats) is ABRSM Grade 2 for major keys; 6/8 reaches into Grade 3.
- **Counting (§ 7 item 3).** "1 and 2 and" and "1 e and a" are standard (OMT 2e 1.9; RCM 2019 p. 11).
  For 6/8 both open textbooks read count "1 la li" or Takadimi "ta ki da"; "1 and a" is practitioner
  usage only (Musical U). The recommendation survives on continuity, plus a reason the plan missed: in a
  singing course "la" is a solfège degree. Takadimi (HPW 1996) read in full. The 2024 dissertation is
  Beiersdorfer (Liberty University): 146 beginners, three systems, no difference (abstract).
- **Sight-singing exams play do-mi-so and do first** (RCM 2019 p. 14: "the broken tonic triad and the
  beginning note", twice, before a two-bar, stepwise test in C, do to so). This sources Lessons 16 and
  18's checkpoints directly.
- **Sight-Singing shows the answer.** Beyond § 5 item 10's list, the drill draws the live pitch tracker
  above the staff with the target band and the next notes (two named), and its hold bar names the note
  ("Hold C4 to continue"). A names-off option must hide all three; § 5 item 10e should say so.
- **Range floors.** Every sing-along in C puts do on C3 or C4, the app's Tenor and Soprano presets'
  lowest notes (`settings-store.ts:122`, `:92`). Lessons 15, 16, 18 and 21 flag it for the coach; G (no
  sharps for do to so) is the alternative. Lesson 20 moves do to D with Move do.
- **`?lesson=15` to `21` are not lesson markers** (`lesson-marker.ts:11-19`), as § 5.1 says.

## Lesson 15, The staff

- Settled: clefs (G4, F3), lines and spaces, ledger lines, grand staff, middle C = C4 (OMT 2e 1.2 to
  1.6; Ewell and Schmidt-Jones 1.2); 88 keys, 27.5 to 4,186 Hz, by the 1890s (Yamaha 2017), names A0 and
  C8 by formula.
- Contradicts the card: nothing in the theory; OMT gives middle C as C4 in 1.6, not 1.2 to 1.4.
- Unverified: the octave treble clef's tie to tenors rests on a dictionary summary (OMT's own clefs
  chapter answered 403); Haines 2008 on the staff's origins not read.
- Decision-dependent: clefs (2), numbering (1), recall scope (5).
- Best finding: Cristofori's first piano had 54 keys; some makers now build 97.

## Lesson 16, Sing what you see

- Settled: Takeuchi and Hulse's abstract (learned early, up to about 6; relations after); RCM's exam
  shape; Demorest and May, Pfordresher and Halpern abstracts; every Sight-Singing limit in code.
- Contradicts the card: the abstract gives no prevalence, so "rare" is unsourced (the plan drops it);
  the drill's pitch tracker and hold label are missing from § 5's list.
- Unverified: absolute-pitch prevalence; whether slug launches fit notes to the singer's octave.
- Decision-dependent: clefs (2), release order (6).
- Best finding: people with absolute pitch remember notes by their names, not by a better memory for
  sound.

## Lesson 17, How long is a note?

- Settled: values, rests, dots, ties (OMT 2e 1.8); ABRSM uses the British names, with American
  equivalents shown (the card's "not verified" is resolved); counting as above.
- Contradicts the card: the app writes dotted values and triplets as well, and never a tie; The Chart
  waits silently for the first tap after its count-in.
- Unverified: the mensural history (Wikipedia only).
- Decision-dependent: counting (3), note names (4: the hook depends on "quarter").
- Best finding: the semibreve, once the shortest note, is now the longest in common use (to confirm).

## Lesson 18, Read and sing a whole line

- Settled: Henry 2004 and Mishra 2014 abstracts in full (both paywalled, no full text); dynamics and
  articulation (OMT 2e 1.7; ABRSM Grade 1 terms and signs); RCM's "tap one measure of the beat".
- Contradicts the card: Henry had no untreated group, so it shows gains with pattern teaching, not that
  patterns beat names; the breath mark is not an ABRSM Grade 1 sign (it rests on Lesson 14's sources).
- Unverified: how far ahead readers look (not claimed); whether the Singing tab scores in its sheet view.
- Decision-dependent: clefs (2), counting (3), release (6).
- Best finding: in Mishra's meta-analysis, sight-reading improved in control groups too.

## Lesson 19, Threes, offbeats and syncopation

- Settled: simple and compound metre, triplets, syncopation (OMT 2e 1.9 to 1.11); ABRSM grades.
- Contradicts the card: standard texts count 6/8 "1 la li"; the hook already says "two" and "three", so
  the predict asks which grouping gives two; Subdivide's 3/4 is three hits, not six eighths in twos; the
  sheet view writes only n/4.
- Unverified: the AP Chief Reader reports (links now redirect); "Row, Row, Row Your Boat"'s metre and
  rights.
- Decision-dependent: counting (3), note names (4).
- Best finding: in the app's own drill, a 3/4 bar and a 6/8 bar both last 1.5 s; only the grouping differs.

## Lesson 20, Runs and the pentatonic scale

- Settled: degrees 1 2 3 5 6 and "no semitones" (OMT 2e 8.9, 7.13); steps 2 2 3 2 3; minor pentatonic as
  a rotation, do me fa so te; Savage 2015 read whole; Duke 2009 abstract; Miksza 2007 abstract.
- Contradicts the card: Savage tested the pentatonic and it failed the universal threshold (frequency
  about 0.2); Scale Runner is note-by-note echo, not a run, and scores against the octave it plays;
  Arneson's agility advice is "fast arpeggios and scales", not "slow first".
- Unverified: none used; Bennett not read.
- Decision-dependent: few (clefs for the staff toggle).
- Best finding: the pentatonic is not universal, but scales of uneven steps with seven or fewer notes
  nearly are.

## Lesson 21, Keys and the circle of fifths

- Settled: pattern, spelling, orders of sharps and flats, finding do (OMT 2e 1.12; Lesson 4 FACTS 13);
  the comma and the 2-cent narrowing (arithmetic; Wolfe; Rubinstein); ABRSM's key grades; the app's key
  picker, signature and spelling.
- Contradicts the card: the card's T17 and T18 sources (Coursera, Trinity, 12tone) were not read;
  Rubinstein's page misprints 2^(7/12) as 1.49651 (it is 1.49831); the sheet view spells a whole key in
  flats or sharps, not letter by letter.
- Unverified: the circle's history (Jensen 1992 not read); Trinity's Grade 1 circle.
- Decision-dependent: three sharps and flats (13), clefs (2).
- Best finding: twelve pure fifths miss seven octaves by about a quarter of a semitone, and equal
  temperament fixes it with under 2 cents a fifth.
