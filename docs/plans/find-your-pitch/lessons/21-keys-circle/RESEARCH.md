# Research: Lesson 21, Keys and the circle of fifths

Every "Facts to check" item on the season plan's card (SEASON-2 § 3, Lesson 21), resolved, the exam
board comparison the season plan left open (§ 1.1, § 7 item 13), the circle's history, and every other
claim the article plan makes. App claims cite the code at `b803c7d43` by `file:line`, each line read
there. Web sources fetched 30 October 2026. Strength grades as research/pedagogy-research.md.

## Where a source contradicts the card or the season plan

1. **"Up to three sharps or three flats" is ABRSM's Grade 2, for major keys.** ABRSM's theory
   specification sets C, G, D and F major at Grade 1, adds A, B♭ and E♭ major (and A, E and D minor) at
   Grade 2, and "all major and minor keys up to and including four sharps and flats" at Grade 3 (R21-9).
   So the season's reading scope matches the end of Grade 2 for majors. SEASON-2 § 1.1 says the
   comparison "was not checked": it now is, and § 1.1 and § 7 item 13 can say so.
2. **The card's sources for T17 and T18 (Coursera M2, Trinity Grade 1, 12tone) were not read.** The plan
   rests the same facts on Open Music Theory 2e 1.12 and ABRSM instead (R21-3 to R21-6). That Trinity
   sets the circle of fifths at Grade 1 is in the benchmark's secondary table only and stays **not
   verified**.
3. **The circle's history is thinly sourced.** The earliest known circle of fifths is credited to Nikolai
   Diletskii's _Grammatika_ (1670s) by Claudia Jensen (1992), before Johann David Heinichen's
   "musicalischer Circul" (1711), long credited; but Jensen's article was **not read** (seen only in a
   search summary and its citation). The plan keeps history to an optional Go deeper line, marked so.
4. **Wolfe's circle notes are a composer's programme note on a circle of fourths**, not a physics paper;
   the arithmetic in them is the same comma, and the plan rests the numbers on arithmetic (R21-11).
5. **The app's sheet view spells a whole melody with flats or with sharps**, chosen by whether the key
   signature has flats (R21-15); it does not spell letter by letter. For the eight keys the picker offers
   that gives right spellings of the scales, but it is not general key-aware spelling.

## Sources

- **OMT 2e**: Gotham et al., _Open Music Theory_, 2nd ed., LibreTexts edition, 1.12 "Major Scales,
  Scale Degrees, and Key Signatures" and 8.9 "Collections". Full text read.
- **Lesson 4 FACTS 12, 13**: Hutchinson, _Music Theory for the 21st-Century Classroom_ § 2.2, and Mount,
  _Fundamentals, Function, and Form_ § 6.6, as Lesson 4 quotes them (one letter per degree). Carried.
- **ABRSM 2023**: _Music Theory Grades: Qualification Specification_, Version 1.2 (April 2023), § 3 pp.
  12, 13 and 16 (as Lesson 15's Sources). Full text read.
- **Wolfe 2011**: Joe Wolfe, "Circle of Fourths" (programme note for his orchestral piece, 2010,
  revised 2011), www.phys.unsw.edu.au/~jw/music/circle/Circle2011.pdf, p. 1 and its note 1. Text
  extracted and read.
- **Rubinstein**: Michael Rubinstein, "Why 12 notes to the Octave?" (University of Waterloo, © 2000),
  www.math.uwaterloo.ca/~mrubinst/tuning/12.html. Full page read.
- **Jensen 1992**: Claudia R. Jensen (1992), "A Theoretical Work of Late Seventeenth-Century Muscovy:
  Nikolai Diletskii's _Grammatika_ and the Earliest Circle of Fifths", _Journal of the American
  Musicological Society_ 45(2), 305-331. Citation seen in a search summary (and on the author's CV);
  **not read**.
- **Lessons 2, 4, 6, 13 and 15**: their FACTS and LESSON.md at `b803c7d43`; Lesson 15's RESEARCH.md.

## Claims

**R21-1. A major scale climbs tone, tone, semitone, tone, tone, tone, semitone.**
OMT 2e 1.12: "W-W-H-W-W-W-H"; Lesson 4 quick check 1 and its FACTS. Full text. Strong.

**R21-2. A major scale uses each letter once.**
Lesson 4 FACTS 13: Hutchinson § 2.2, "All major scales use the notes of the musical alphabet in order;
no notes are skipped and no notes occur twice"; Mount § 6.6, "Each pitch letter name is used only once
(except for the keynote, which is typically repeated at the end of the scale)". Carried. Strong. OMT 2e
1.12 says only that a scale "always starts and ends on notes of the same letter name". So F major is F
G A B♭ C D E: with A♯ it would hold two As and no B (the card's misconception, Open Music Theory v2 as
pedagogy-research.md:676 cites it).

**R21-3. G major needs F♯ and F major needs B♭, to keep the pattern.**
Arithmetic from R21-1: on G the white keys give G A B C D E F G, whose last two steps are a semitone (E-F)
and a tone (F-G), where the pattern needs a tone then a semitone, so F rises to F♯, ti. On F they give F G
A B, a tone, a tone, a tone, where the third step must be a semitone, so B falls to B♭, fa (`python3 -I`
checks all twelve, as Lesson 4's `verify.py` did, Lesson 4 FACTS 12). Strong. Lesson 4's page builds D
major with two black keys (lessons/04-major-scale/LESSON.md:122); its film slides to G (its FACTS 12).

**R21-4. Each key a fifth up keeps the last key's sharps and adds one, on its own ti.**
Arithmetic: the key a fifth up starts on the old key's so; its first six degrees are the old key's so,
la, ti, do, re, mi, all already in the old key, and its seventh, ti, is the old key's fa, a tone below
the new do, which must rise a semitone. So C to G adds F♯, G to D adds C♯, D to A adds G♯. Strong.

**R21-5. The order of sharps is F C G D A E B, and of flats B E A D G C F; the last sharp is a half
step below do; the second-to-last flat is do.**
OMT 2e 1.12: "The order of sharps is always F, C, G, D, A, E, B" ("Fat Cats Go Down Alleys (to) Eat
Birds"); the flats are "the opposite of the order of the sharps: B, E, A, D, G, C, F" ("Birds Eat And
Dive Going Copiously Far"); "In sharp key signatures, the last sharp is a half step below the tonic";
"In flat key signatures, the second-to-last flat is the tonic". Full text. Strong. F major, one flat, is
the case the rule cannot cover; it is learned by itself (arithmetic: one flat has no second-to-last).

**R21-6. The circle of fifths puts each key a fifth from its neighbours, C at the top, sharps
clockwise, flats anticlockwise, and three enharmonic pairs at the bottom.**
OMT 2e 1.12: "The circle of fifths is so named because each key signature is a fifth away from the ones
on either side of it"; major keys "in order of number of accidentals", C major at the top, sharp keys
clockwise, flat keys counterclockwise; the bottom three keys are "enharmonically equivalent", for
example B major and C♭ major "sound the same because the notes B and C♭ are enharmonically equivalent".
Full text. Strong.

**R21-7. Twelve fifths up from C pass through every one of the twelve notes and land on C again, seven
octaves up, on a keyboard.**
Arithmetic: 12 x 7 semitones = 84 = 7 x 12 (`python3 -I`); each of the twelve pitch classes is reached
once. Wolfe 2011 p. 1 says it of fourths ("after 12 fourths, we have covered five octaves and come back
'home' to C") and note 1 "a circle of fifths is seven octaves". Strong.

**R21-8. Season 1's ring of twelve beads re-threads by fifths: C G D A E B F♯ C♯ G♯ D♯ A♯ F.**
R21-7 applied to Lesson 2's ring (Lesson 2 FACTS: the twelve notes; one key, two names, FACTS 18).
Strong. On the ring the flat side reads F, B♭, E♭, A♭ going the other way.

**R21-9. ABRSM's theory grades: majors C, G, D, F at Grade 1; A, B♭, E♭ at Grade 2; up to four sharps or
flats at Grade 3; five at Grade 4; six at Grade 5.**
ABRSM 2023 p. 12: Grade 1, "Scales and key signatures of the major keys of C, G, D and F in both clefs";
Grade 2, "Relative major and minor keys. Construction of the minor scale (harmonic only). Scales and key
signatures of the major keys of A, Bb and Eb, and the minor keys of A, E and D"; Grade 3, "all major and
minor keys up to and including four sharps and flats"; p. 13: Grade 4 "up to and including five sharps
and flats", Grade 5 "up to and including six sharps and flats". p. 16's table repeats it (Keys: Grade 1
"major keys of C, F, G, D"; Grade 2 "major keys of Bb, Eb, A", "minor keys of A, E, D"). Full text. Strong.

**R21-10. A pure fifth is a 3:2 ratio, about 701.955 cents; an equal-tempered fifth is 700 cents, 2^(7/12),
about 1.49831.**
Arithmetic (1200 x log2(1.5) = 701.955; 2^(7/12) = 1.498307). Rubinstein: "all fifths are tuned to
2^(7/12)=1.49651..., slightly less than 3/2", and his table lists the equal-tempered fifth at -1.95 cents.
**Rubinstein's printed decimal is wrong**: 2^(7/12) is 1.49831, not 1.49651 (`python3 -I`); his cents
figure is right. Lesson 2 FACTS 22 (a cent is a hundredth of a semitone). Strong (arithmetic).

**R21-11. Twelve pure fifths overshoot seven octaves by the Pythagorean comma, (3/2)^12 / 2^7 =
531441/524288, about 1.01364, or 23.46 cents: about a quarter of a semitone.**
Arithmetic (`python3 -I`: 1.0136432647705078; 23.460010 cents). Wolfe 2011 p. 1, for fourths: "Out by
1.3% or a quarter of a semitone, called the Pythagorean comma – it's not a new problem!" Strong.

**R21-12. Equal temperament narrows each fifth by about 2 cents, a twelfth of the comma, so twelve
fifths close the circle.**
Arithmetic: 23.46 / 12 = 1.955 cents = 701.955 - 700. Rubinstein's -1.95 cents. Strong. Lesson 2 taught
equal semitones of 100 cents (FACTS 22); Lesson 13 the fifth as the third harmonic (helps).

**R21-13. Why twelve: seven twelfths is close to the fifth's share of the octave.**
Rubinstein: "It is the approximation 7/12 = .5833333333... which suggests an octave of 12 steps, with a
fifth equal to 7 semi-tones", explained by continued fractions. log2(3/2) = 0.58496 (arithmetic).
Moderate (a university page). Go deeper only.

**R21-14. The app's key picker offers eight major keys: C, G, D, A, E, B, F and B♭.**
`src/features/sidebar/panels/PlaybackSetupPanel.tsx:87-94`. Its key table holds thirteen, C to F♯ and F
to G♭ (`src/lib/scale-data.ts:28-44`, `KEY_SIGNATURES`). Code read. Strong.

**R21-15. The Singing tab's sheet view writes the key signature, minor keys under their relative
major's, and spells the melody all in flats in a flat key, all in sharps otherwise.**
`src/lib/sheet-music-renderer.ts:572` (`if (keySig !== 'C') stave.addKeySignature(keySig)`);
:156-169 (`notationKeySignature`, "Minor scales inherit the signature of their relative major"), with
`RELATIVE_MAJOR` (:127-140); :494 (`useFlats = (KEY_SIGNATURES[keySig]?.flats ?? 0) > 0`) and
:115-120 (`midiToVFKey` picks `FLAT_NAMES` or `SHARP_NAMES`). Code read. Strong.

**R21-16. Sight-Singing writes every black key as a sharp, so F major's B♭ would show as A♯.**
`src/features/exercises/sight-singing/use-sight-singing-controller.ts:31-44` (`NOTE_NAMES`);
`SightSingingExercise.tsx:108-118` (♯ drawn). R16-12. Code read. Strong.

**R21-17. Ear Lab's Home asks for scale degrees heard in a key.**
`src/features/ear-lab/HomeDrill.tsx:1-11` ("A cadence plants the key ..., a probe note sets the fork
ringing, and the answer comes by tap — the seven rungs of the ladder in the console — or by mic"); `src/lib/ear/item-bank.ts:44-56`
(`HOME_DEGREES`, Do to Ti, "Sol" spelled so). Code read. Strong.

**R21-18. `?lesson=21` is not a lesson marker today.** R15-19.

## Interesting findings

1. **Twelve pure fifths miss seven octaves by a quarter of a semitone** (R21-11), and "it's not a new
   problem" (Wolfe). Strong. **Possible Step 5 cold beat**: play twelve pure fifths folded into one
   octave and land 23 cents sharp of the C you started on (C4 x 1.01364 = 265.2 Hz against 261.6 Hz).
2. **Equal temperament's fix is tiny per fifth: under 2 cents**, a fiftieth of a semitone (R21-12).
   Strong. **Possible wrap line**; it also carries the card's tease into Lesson 22.
3. **The pentatonic is the circle's first five beads, and the major scale its first seven**: C G D A E
   (Lesson 20, R20-4) and F C G D A E B (arithmetic: the seven letters a fifth apart, F to B). Strong.
   **Possible Go deeper**, joining Lessons 20 and 21.
4. **The first circle of fifths may be Russian, not German.** Diletskii's _Grammatika_ (1670s) is credited
   by Jensen (1992) with the earliest circle, before Heinichen's of 1711 (R21, contradiction 3). Weak until
   Jensen is read. **Possible Go deeper**, marked so.
5. **Why twelve: 7/12 of an octave is within 2 cents of a pure fifth** (R21-13, R21-10). Moderate.
   **Possible Go deeper.**
