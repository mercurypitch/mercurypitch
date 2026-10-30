# Research: Lesson 17, How long is a note?

Every "Facts to check" item on the season plan's card (SEASON-2 § 3, Lesson 17), resolved, the
counting syllables the season plan flagged (§ 7 item 3), and every other claim the article plan
makes. App claims cite the code at `b803c7d43` by `file:line`, each line read there. Web sources
fetched 30 October 2026. Strength grades as research/pedagogy-research.md.

## Where a source contradicts the card or the season plan

1. **ABRSM's use of the British names, "not verified" on the card, is verified.** ABRSM's theory
   specification names the values "semibreve, minim, crotchet, quaver and semiquaver" for Grade 1 and
   says "American equivalents are shown at the beginning of each relevant section" (R17-6).
2. **"The app writes only these values" is true, but the list is longer than the card implies.** The
   notation module writes whole, dotted half, half, dotted quarter, quarter, dotted eighth, quarter
   triplet, eighth, dotted sixteenth, eighth triplet, sixteenth and sixteenth triplet, and **never a
   tie**: a note that would cross a bar line is cut and the rest written as rests (R17-13). So Step 5's
   ties have no practice in the app.
3. **The Chart is not read "over the click" for the whole bar.** It counts four clicks in, then waits in
   silence (a soft rail ticks) until the first tap, which anchors the take; the beat ticks under the bar
   from that tap (R17-15). The card's copy of its prompt is exact, but the article should describe what
   happens.
4. **Counting with "and" and "e ... a" is confirmed in a standard text**, OMT 2e 1.9, which writes the
   "and" as "+" (R17-8). The 2024 dissertation the planner found is Beiersdorfer (Liberty University),
   read to its abstract: three systems, no difference between them (R17-10).

## Sources

- **OMT 2e**: Gotham et al., _Open Music Theory_, 2nd ed., LibreTexts edition (pages dated 29 Aug
  2025), 1.8 "Notating Rhythm" and 1.9 "Simple Meter and Time Signatures",
  human.libretexts.org/Bookshelves/Music/Music_Theory/Open_Music_Theory_2e_(Gotham_et_al.)/01%3A_Fundamentals/.
  Full text read.
- **ABRSM 2023**: ABRSM, _Music Theory Grades: Qualification Specification_, Version 1.2 (April 2023),
  § 3 pp. 12 and 16 (as Lesson 15's Sources). Full text read.
- **RCM 2019**: The Royal Conservatory of Music, _Voice Syllabus_, 2019 Edition, p. 11 "Sight Reading",
  Rhythm (as Lesson 16's Sources). Full text read.
- **HPW 1996**: Richard Hoffman, William Pelto and John W. White (1996), "Takadimi: A Beat-Oriented
  System of Rhythm Pedagogy", _Journal of Music Theory Pedagogy_ 10, 7-30. Full text read, in a copy
  reprinted with the journal's copyright line ("Reprinted from Journal of Music Theory Pedagogy, vol
  10 (1996) 7 – 30"), hosted at musescore.org/sites/musescore.org/files/2024-10/Takadimi%20Article.pdf;
  page numbers are the journal's.
- **Beiersdorfer 2024**: Brendan Beiersdorfer (2024), "Easy as 1, 2, 3: An Analysis of Rhythm-Counting
  Systems and Their Affect on Performance Accuracy in Beginner Band Students", DME dissertation,
  Liberty University, digitalcommons.liberty.edu/doctoral/6369. Abstract read; full text not read.
- **Colley 1987**: Bernadette Colley (1987), "A Comparison of Syllabic Methods for Improving Rhythm
  Literacy", _Journal of Research in Music Education_ 35(4), 221-235, doi:10.2307/3345075. Abstract
  read (Crossref record).
- **Wikipedia, Mensural notation**: "Mensural notation", English Wikipedia, raw wikitext read 30
  October 2026 (the revision id could not be fetched: the API refused for rate limits); the section on
  note values. Secondary.
- **Lesson 8**: its LESSON.md and FACTS.md at `b803c7d43`.

## Claims

**R17-1. Note values are fractions of each other: a whole note is two halves, four quarters, eight
eighths, sixteen sixteenths.**
OMT 2e 1.8: values are "hierarchical", "their lengths are defined relative to one another"; "a whole
note divides into two half notes, four quarter notes, eight eighth notes, and so on"; the common values
are "the whole note, half note, quarter note, eighth note, and sixteenth note". Full text. Strong.

**R17-2. How the shapes change: an open head, a stem, a filled head, a flag; flags on stems of filled
heads only.**
OMT 2e 1.8: halving a value is done by adding a stem, filling the notehead, or adding a flag (close
paraphrase); "quarter notes and shorter durations are filled in"; "filled noteheads always have stems";
"Flags are only added to the stems of filled noteheads." Full text. Strong. Beams join flagged notes
within a beat (OMT's example labels them; the app beams "Flagged notes inside one beat",
`src/lib/ear/rhythm-notation.ts:12-13`).

**R17-3. Each note value has a rest of the same length.**
OMT 2e 1.8: "rests refer to the duration of silences in music"; each note value has a matching rest
(paraphrase). Full text. Strong.

**R17-4. A dot adds half the note's value; a tie joins two notes of the same pitch into one sound.**
OMT 2e 1.8: a dot adds half the value of the note or rest it follows (paraphrase); "A tie is a curved
line that connects two or more notes with the same pitch"; tied notes are not played again, and ties
are never used with rests (paraphrase). Full text. Strong.

**R17-5. In a simple time signature the top number counts the beats in a bar and the bottom names the
note that gets the beat; in 4/4 that is the quarter note.**
OMT 2e 1.9: "the top number of a time signature represents the number of beats in each measure"; "the
bottom number represents the beat unit", "which note value gets the beat"; simple meter is one "in
which the beat divides into two, and then further subdivides into four". Full text. Strong.

**R17-6. British names: semibreve (whole), minim (half), crotchet (quarter), quaver (eighth),
semiquaver (sixteenth); ABRSM's exams use them, with American equivalents shown.**
OMT 2e 1.8: "British terms for rhythmic values are different from American terms", listing semibreve,
minim, crotchet, quaver, semiquaver and breve. ABRSM 2023 p. 12, Grade 1 item 1: "Note values of
semibreve, minim, crotchet, quaver and semiquaver, and their equivalent rests. Tied notes.
Single-dotted notes."; p. 16, table "Time values": "N.B. American equivalents are shown at the
beginning of each relevant section". Full text. Strong.

**R17-7. A beat's length in seconds is 60 divided by the tempo in BPM: at 60 BPM a quarter note beat
lasts 1 s, at 120 BPM 0.5 s.**
Lesson 8 quick check 1 ("120 beats every minute: two a second") and its FACTS on BPM; arithmetic
(60/60 = 1, 60/120 = 0.5; a whole note in 4/4 is 4 s at 60 BPM, 2 s at 120). OMT 2e 1.8 gives no
absolute durations, only relative ones (checked). Strong.

**R17-8. Counting in simple metre: numbers on the beats, "and" for the half-beat, "e" and "a" for the
quarter-beats: "1 e and a".**
OMT 2e 1.9: "each quarter note gets a count, expressed with Arabic numerals"; "the divisions are counted
aloud with the syllable "and," which is usually notated with the plus sign (+)"; "Further subdivisions at
the sixteenth-note level are counted as "e"", with "a" for the last (paraphrase); thirty-second notes add
"ta". RCM 2019 p. 11 lets a singer "count the rhythm (1& 2&, etc.)". HPW 1996 p. 9 calls it "the common
"l-e-&-a, 2-e-&-a" system, which developed along with the introduction of music into American public
schools". Full text. Strong (standard text and exam board). This settles SEASON-2 § 7 item 3 for simple
metre.

**R17-9. Takadimi is a beat-oriented alternative: "ta" on the beat, "di" on the half-beat, "ta ka di
mi" for four sixteenths.**
HPW 1996 p. 14: "In simple meter, any attack on the beat, regardless of notation, is called "Ta," and
any attack on the second half of the beat is called "di." Further subdivisions are called "ka" and
"mi." At the subdivision level, then, the syllables yield the pattern "Ta-ka-di-mi," the name we have
given the system"; p. 8: rhythm systems "typically fall into two categories, those that emphasize
counting within the measure and those that emphasize pattern or beat". Full text. Strong for what the
system is.

**R17-10. No counting system has been shown to beat the others for beginners.**
Beiersdorfer 2024, abstract: a "quantitative, quasi-experimental" study of 146 beginner band students
in three settings, each taught Traditional, Kodály or Takadimi counting; each system "significantly
affected rhythmic accuracy after instruction", and ANOVA found no significant difference between the
three; the author calls for longer, single-system studies (paraphrase). Abstract only. Weak
(quasi-experimental, unpublished dissertation, no random assignment). Colley 1987, abstract: 160
second- and third-graders; "a syllabic system that differentiated between duple and triple
subdivisions of the beat improved recognition skills to a greater degree than one that did not", and
word-based patterns improved performance and notation most. Abstract only. Weak to Moderate. Together:
the choice of syllables rests on continuity with Lesson 8, as SEASON-2 § 7 item 3 says.

**R17-11. A bar of eighths in 4/4 is counted "1 and 2 and 3 and 4 and"; four sixteenths on a beat
"1 e and a".** R17-8 applied. Strong.

**R17-12. Note values used to be shorter: what was once the shortest value, the semibreve, is now the
longest in common use.**
Wikipedia, Mensural notation: "Between the 14th and 16th centuries, composers repeatedly introduced
new note shapes for ever smaller temporal divisions of rhythm, and the older, longer notes were slowed
down in proportion"; "Thus, what was originally the shortest of all note values used, the semibreve,
has become the longest note used routinely today, the whole note." Secondary; Weak until a musicology
text (for example Apel, _The Notation of Polyphonic Music_) is read. Go deeper only, marked so.

**R17-13. The app writes whole to sixteenth notes, dotted values and triplets, in 4-beat bars only,
and never a tie.**
`src/lib/ear/rhythm-notation.ts:24` (`WRITTEN_BAR = 4`, "Beats in a written bar"); :57-70 (`VALUES`:
4, 3 dotted, 2, 1.5 dotted, 1, 0.75 dotted, 2/3 triplet, 0.5, 0.375 dotted, 1/3 triplet, 0.25, 1/6
triplet beats); :1-17 (a value is matched "to the longest written value that fits without crossing a
barline, and anything left over becomes rests"). A search of the module and `RhythmScore.tsx` for "tie"
finds none. Code read. Strong.

**R17-14. The Chart and Pulse draw on one bank of 15 patterns, from three quarters to sixteenths and
triplets, some over two bars.**
`src/lib/ear/banks.ts:215-321` (`PULSE_BANK`: "3 quarters", "4 quarters", "rest on 2", "and of 2",
"eighths on 1", "off the beat", "eighth run", "triplet on 1", "triplet on 2", "16ths on 1", "gallop",
"mixed", and three two-bar items); :323-331 (`CHART_BANK` is the same patterns under their own ids).
Code read. Strong.

**R17-15. The Chart shows the bar on a one-line staff, counts four in at 100 BPM, then waits for the
first tap, which anchors the take.**
`src/features/ear-lab/ChartDrill.tsx:1-16` ("the pattern is written on the drum's upper rule from the
moment the round opens, four clicks count the tempo in, and then everything stops. The bar waits for
the player ... silence until the first tap, which anchors the take"; "From that tap the beat ticks under
the bar"); its prompt, "A written bar over the click. Tap it at sight." (:49);
`src/lib/ear/timing.ts:90-100` (`PULSE_TIMING`: `beats: 4`, `periodMs: 600`, so 100 BPM; a soft rail
ticks up to 8 beats while waiting); `src/features/ear-lab/RhythmScore.tsx:1-12` (one line, heads on
it, stems up, beams over the top). Pulse is the mirror: it plays the bar, then you tap it back
(`src/features/ear-lab/PulseDrill.tsx:1-20`; prompt "A bar of onsets, then a bar of yours. Tap the call
back.", :53). Code read. Strong.

**R17-16. No address opens one Ear Lab drill, or a subset of its patterns.**
`src/stores/ui-store.ts:534-548` (`pendingEarDrill`, "An Ear Lab drill someone asked for from
elsewhere in the app"); its only setters are `startEarDrill` (:546-547) and the Merc drill room
(`src/features/ear-lab/merc/MercDrillRoom.tsx:395`). Code read. Strong.

**R17-17. `?lesson=17` is not a lesson marker today.** R15-19.

## Interesting findings

1. **The semibreve, once the shortest note, is now the longest in common use** (R17-12). Weak
   (secondary) until checked in a musicology text. **Possible Go deeper**, and a strong one for the
   lesson's misconception: the shapes stayed and the clock moved.
2. **"1 e and a" grew up with music in American schools** (HPW 1996 p. 9, R17-8). Strong (a primary
   pedagogy paper's history line). **Possible Go deeper.**
3. **Takadimi's syllables echo North Indian tabla drumming.** HPW 1996 p. 14, note 10: "The reader may
   recognize these syllables as being similar to those used in North Indian tabla playing to vocalize
   divisions of a pulse." Strong (the authors' own note). **Possible Go deeper.**
4. **Three counting systems, one result.** 146 beginners improved with each of three systems and no
   system beat the others (R17-10). Weak. **Possible Go deeper or wrap line**: count aloud, whichever
   way you count.
5. **A quarter note at 100 BPM is 0.6 s**: the tempo of the app's own rhythm drills (R17-15), between
   this lesson's 60 and 120 examples (arithmetic). **Possible practise-card line.**
