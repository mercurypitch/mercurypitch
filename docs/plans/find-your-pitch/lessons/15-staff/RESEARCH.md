# Research: Lesson 15, The staff: where notes sit

Every "Facts to check" item on the season plan's card (SEASON-2 § 3, Lesson 15), resolved, and every
other claim the article plan makes. App claims cite the code at `b803c7d43` (main, 0.9.25) by
`file:line`, each line read there. Web sources were fetched on 30 October 2026. Strength grades follow
research/pedagogy-research.md: Strong, Moderate, Weak, Practitioner.

## Where a source contradicts the card or the season plan

1. **Nothing contradicts the card's theory.** OMT 2e 1.2 to 1.6 and Ewell and Schmidt-Jones 1.2 bear
   out every clef, line and middle-C claim. Two refinements: OMT 2e names the treble clef's line
   ("wraps around the G line") but never gives its octave, and Ewell and Schmidt-Jones supply it ("the
   G above middle C", "the F below middle C"), so G4 and F3 rest on that text plus OMT 2e 1.6's
   "middle C is C4" (R15-3, R15-4, R15-7).
2. **The card's "OMT 1.2 to 1.4" is right but short.** The middle-C-is-C4 line is in OMT 2e 1.6
   ("American Standard Pitch Notation"), and E-F and B-C as half steps are in 1.5. Chapter numbers
   were checked against the LibreTexts edition (pages dated 29 Aug 2025).
3. **88 keys, A0 to C8: verified from a maker, with one gap.** Yamaha gives 88 keys, "7 ¼ octaves" and
   27.5 Hz to 4,186 Hz; it does not print the names A0 and C8. Those follow from the frequencies by the
   series' own formula (Lesson 2 FACTS 6), so the article may say "A0 to C8" (R15-9). OMT 2e 1.6 says
   only that the keyboard "spans the full octaves 1 to 7" plus "a small part of both octaves 0 and 8".
4. **The octave treble clef: the convention is sourced, but only one source ties it to tenors.** An
   open textbook gives the clef and its meaning without naming tenors; a reference dictionary names
   tenors. Open Music Theory's own chapter on it (Pressbooks) answered 403 and was not read (R15-14).
5. **The app's lesson marker refuses `?lesson=15`.** `src/lib/lesson-marker.ts:11-19` accepts 01 to 14
   only, so the card's practise link is today an ordinary visit and First Light may intercept it
   (season plan § 5.1 says so; this confirms it).

## Sources

- **OMT 2e**: Mark Gotham, Kyle Gullings, Chelsey Hamm, Bryn Hughes, Brian Jarvis, Megan Lavengood and
  John Peterson, _Open Music Theory_, 2nd ed., LibreTexts edition (pages dated 29 Aug 2025),
  human.libretexts.org/Bookshelves/Music/Music_Theory/Open_Music_Theory_2e_(Gotham_et_al.)/01%3A_Fundamentals/,
  sections 1.2 "Notation of Notes, Clefs, and Ledger Lines", 1.3 "Reading Clefs", 1.4 "The Keyboard
  and the Grand Staff", 1.5 "Half Steps, Whole Steps, and Accidentals", 1.6 "American Standard Pitch
  Notation (ASPN)". Full text of each read. Its examples are images; no claim rests on an image.
- **E&SJ**: Terry B. Ewell and Catherine Schmidt-Jones, _Music Fundamentals_, LibreTexts, 1.2 "Clef"
  (last modified 16 Jul 2023), human.libretexts.org/Bookshelves/Music/Music_Theory/Music_Fundamentals_(Ewell_and_Schmidt-Jones)/01%3A_Pitch_and_Major_Scales_and_Keys/1.02%3A_Clef.
  Full text read.
- **Yamaha 2017**: Yamaha Corporation of America, "Why Aren't There More Than 88 Keys on a Piano?",
  16 October 2017, hub.yamaha.com/?p=4830 (excerpted from Yamaha's Musical Instrument Guide). Full
  text read.
- **ABRSM 2023**: ABRSM, _Music Theory Grades: Qualification Specification_, Version 1.2 (April 2023),
  www.abrsm.org/sites/default/files/2023-09/Music%20Theory%20Qual%20Spec%20April%202023%20[2023%20rebrand].pdf,
  § 3 pp. 12 and 16. PDF downloaded, text extracted, read; deleted afterwards.
- **OnMusic**: _OnMusic Dictionary_ (Connect For Education Inc.), entry "octave treble clef" (updated
  6 June 2016), dev-dictionary.onmusic.org/terms/2392-octave_treble_clef. Read in a summary of the
  entry (the fetcher would not quote it whole).
- **Basel**: University of Basel, "From Ink to Sound", § 2.10 "Lines and staff",
  tales.nmc.unibas.ch/en/from-ink-to-sound-32/from-sound-to-ink-early-forms-of-musical-notation-188/lines-and-staff-949.
  Full page read; no author named.
- **Lessons 1, 2 and 4**: their FACTS.md and LESSON.md at `b803c7d43`, cited "Lesson N FACTS M".

## Claims

**R15-1. A staff is five lines, and notes sit on the lines and in the spaces between them.**
OMT 2e 1.2: "A staff consists of five horizontal lines, evenly spaced"; "Noteheads on a line should
fill in half of each space above and below"; "Noteheads in a space should just touch the lines above
and below." Five lines leave four spaces between them, so nine positions (arithmetic). Full text.
Strong (standard text).

**R15-2. Letters repeat A to G; each line or space up the staff is the next letter.**
OMT 2e 1.4: "pitches in Western musical notation are designated by the letters A, B, C, D, E, F, and G,
repeating in a loop"; OMT 2e 1.3 gives the treble lines E, G, B, D, F and spaces F, A, C, E, which
interleave as E F G A B C D E F. Full text. Strong.

**R15-3. The treble clef curls round the second line from the bottom, which it names G: the G above
middle C, G4.**
OMT 2e 1.3: "the treble clef wraps around the G line (the second line from the bottom)"; "it is
sometimes called the "G clef."" E&SJ 1.2: "a treble clef symbol tells you that the second line from the
bottom (the line that the symbol curls around) is "G""; "The G indicated by the treble clef is the G
above middle C". With middle C as C4 (R15-7), that G is G4 (391.995 Hz by Lesson 2 FACTS 6's formula).
Full text. Strong.

**R15-4. The bass clef's two dots sit either side of the second line from the top, which it names F:
the F below middle C, F3.**
OMT 2e 1.3: "the dot of the bass clef begins on the F line"; OMT 2e 1.2's drawing steps: "Place two dots
to the right of the backward C, in the top two spaces of the staff." E&SJ 1.2: "A bass clef symbol tells
you that the second line from the top (the one bracketed by the symbol's dots) is F"; "the F indicated
by the bass clef is the F below middle C." F3 is 174.61 Hz. Full text. Strong.

**R15-5. Treble lines E G B D F, spaces F A C E; bass lines G B D F A, spaces A C E G; with OMT's
mnemonics.**
OMT 2e 1.3: "Every Good Bird Does Fly" (E, G, B, D, F); the spaces "spell the word "face""; bass lines
"Good Bikes Don't Fall Apart" (G, B, D, F, A); spaces "All Cows Eat Grass" (A, C, E, G). In octave
numbers (arithmetic from R15-3, R15-4): treble E4 G4 B4 D5 F5 and F4 A4 C5 E5; bass G2 B2 D3 F3 A3 and A2
C3 E3 G3. Full text. Strong. The article may give one mnemonic per clef in Go deeper; the plan does
not lean on mnemonics, since counting from the clef's line is the lesson's point.

**R15-6. Ledger lines are short lines that carry the staff past its edges.**
OMT 2e 1.2: "When notes are too high or low to be written on a staff, small lines called ledger lines
are drawn to extend the staff"; "be sure not to put in an extra ledger line above or below the note".
Full text. Strong. Two ledger lines each way is ABRSM Grade 2's extent: "Extension of the stave to
include two ledger lines below and above each stave" (ABRSM 2023 p. 12, Grade 2 item 2), and beyond two
is Grade 3 (p. 12, Grade 3 item 2). Full text. Strong for what the board sets.

**R15-7. Middle C is C4; octave numbers change at C.**
OMT 2e 1.6: "The pitch middle C is C4, which is useful to memorize"; "each new octave designation begins
on the note C". Lesson 1 FACTS 17 (middle C is C4, about 261.63 Hz) and Lesson 1's quick check 4 ("Which
note comes right after B3?" C4). Full text. Strong.

**R15-8. The grand staff is a treble staff above a bass staff joined by a line and a brace; middle C
sits on the one ledger line between them.**
OMT 2e 1.4: "To make a grand staff, a staff with a treble clef is placed above a staff with a bass
clef"; "The two staves are connected on the left side with a line and a brace"; "Middle C is the note
that appears on the line between the two staves in a grand staff"; pianists play "the lower notes (in
the bass clef) with their left hand". E&SJ 1.2: "Middle C is above the bass clef and below the treble
clef". So middle C is one ledger line below the treble staff and one above the bass staff, the same
note (arithmetic from R15-5). Full text. Strong.

**R15-9. A modern piano has 88 keys, from A0 (27.5 Hz) to C8 (about 4,186 Hz): seven octaves and a
minor third, 52 white keys and 36 black.**
Yamaha 2017: "By the 1890s, today's modern keyboard had become established with 88 keys spanning 7 ¼
octaves"; "These produce frequencies from 27.5 Hz to 4,186 Hz (4.186 kHz) when A is tuned to 440 Hz."
The names follow from Lesson 2 FACTS 6's formula: MIDI 21 is 27.5 Hz (A0) and MIDI 108 is 4,186.01 Hz
(C8); 108 - 21 + 1 = 88 keys; 87 semitones is 7 octaves (84) and 3 semitones; 52 of the 88 are white
(script, `python3 -I`). Full text. Strong for the count and range (maker); the names are arithmetic.

**R15-10. On the keyboard, E to F and B to C are semitones; the other neighbouring letters are a tone
apart.**
OMT 2e 1.5: "E–F and B–C are both half steps"; "A whole step is the equivalent of two half steps."
Lesson 2 FACTS 13 to 15 and quick check 2 ("B to C: two white keys, but only one semitone"); Lesson 4's
uneven staircase (lessons/04-major-scale/LESSON.md:91). Full text. Strong.

**R15-11. A sharp raises a note a semitone and a flat lowers it; on the staff the sign sits to the left
of the note, on the same line or space.**
OMT 2e 1.5: a sharp "raises a note by a half step"; a flat "lowers a note by a half step"; "Accidentals
are always written to the left of a note, regardless of stem direction." Full text. Strong.

**R15-12. Every staff note has one key on the keyboard; the staff's letters are the white keys and its
sharps and flats the black ones.** From R15-2, R15-10, R15-11 and Lesson 2 FACTS 18 (one key, two
names). Arithmetic and carried. Strong.

**R15-13. ABRSM's Grade 1 theory sets both clefs and middle C in both.**
ABRSM 2023 p. 12, Grade 1 item 3: "The stave. Treble (G) and bass (F) clefs. Names of notes on the
stave, including middle C in both clefs." Full text. Strong (what the board sets). Usable as one line
("Both clefs are in a beginner's first theory exam").

**R15-14. A treble clef with a small 8 below is read an octave lower than written; tenors read it.**
E&SJ 1.2: "Much more common is the use of a treble clef that is meant to be read one octave below the
written pitch"; "A very small "8" at the bottom of the treble clef symbol means that the notes should
sound one octave lower". The page does not mention tenors. OnMusic, "octave treble clef": the version
with the 8 below is "also called the vocal tenor clef", used for the tenor part "to indicate that the
tenor voice actually sounds an octave lower" than treble notation; it notes tenor music is often
written in plain treble clef today (read in summary). Full text for E&SJ; summary only for OnMusic.
Moderate. Open Music Theory's Pressbooks chapter "Clefs", which a search summary says names "tenor
vocalists, guitarists, and bassists", answered 403 and was **not read**; a writer reads it, or Gould,
_Behind Bars_ (2011), before a script says it.

**R15-15. The app writes a melody in the bass clef when its middle note sits below middle C.**
`src/lib/sheet-music-renderer.ts:175-183`: `chooseClef` takes the median of the sorted MIDI notes
(`sorted[Math.floor(sorted.length / 2)]`, :180) and returns `mid < 60 ? 'bass' : 'treble'` (:182); the
comment: "melodies centred below it read better in bass". Code read. Strong.

**R15-16. Compose has four views: Piano Roll, Sheet Music, split piano roll and sheet music, Session
Editor.** `src/App.tsx:2321-2345` (`COMPOSE_VIEWS`). Code read. Strong.

**R15-17. The app's voice presets put lower voices below the treble staff.** `VOCAL_RANGES`,
`src/stores/settings-store.ts:91-149`: Soprano C4 to C6 (:92), Mezzo-Soprano A3 to A5 (:102), Alto F3 to
F5 (:112), Tenor C3 to C5 (:122), Baritone G2 to G4 (:132), Bass E2 to E4 (:142). The baritone's G2 sits
on the bass staff's bottom line and six ledger lines below the treble staff (G2 to E4 is 9 letters
down: D4, C4 ledger, B3, A3 ledger, G3, F3 ledger, E3, D3 ledger, C3, B2 ledger, A2, G2 ledger; arithmetic).
Code read. Strong.

**R15-18. No note-reading drill exists; the app's note quiz is on a guitar fretboard.**
`src/features/guitar-practice/NoteLocatorQuiz.tsx:1-30`: `createNoteLocatorQuiz` sets a target pitch
class and counts fretboard positions found in a 30 s round (`ROUND_TIME = 30`, :18), using
`MAX_FRET` and `OPEN_MIDI` from the guitar constants (:3). No staff. A search of `src` for "note-reading"
finds only an end-to-end test file name. Code read. Strong.

**R15-19. `?lesson=15` is not a lesson link today.** `src/lib/lesson-marker.ts:11-19`: "Strict on
purpose: `lesson=` and two digits, 01 to 14, Season 1's lessons"; `SEASON_1_LESSON =
/^(?:0[1-9]|1[0-4])$/` (:19). Code read. Strong.

**R15-20. The kit has only a G clef path and its pages engrave decorative clefs.**
`src/features/lessons/kit/glyphs.ts:10` (`G_CLEF_PATH`); `src/features/lessons/kit/page-chrome.ts:166-175`
(`engraveClefs`, `svg.clef[data-clef="g"]`). The page toy needs an F clef (season plan § 6.2 item 2).
Code read. Strong.

**R15-21. The house marks do on a lesson's drawings, never a colour.**
`src/features/lessons/kit/home-glyph.ts:1-13`: "the house that marks do, the tonic"; "Lesson 4 marks
home with a house, never with a colour". Code read. Strong. (Used by the sing-along's staff.)

## Interesting findings

1. **Cristofori's first piano had 54 keys; 88 arrived by the 1890s, and some makers build 97.**
   Yamaha 2017: "The piano that Bartolomeo Cristofori first invented in Italy had only 54 keys"; the
   range "was gradually expanded in response to requests from composers"; "By the 1890s, today's modern
   keyboard had become established with 88 keys"; "some manufacturers are making 97-key pianos to
   special order", whose extra strings "are really only there to provide a richer sound". Full text.
   Strong (maker). **Possible Go deeper** (or the cold open's last line after the reveal).
2. **The first staves had four lines, two of them coloured.** Basel § 2.10: lines appear with pitch
   notation from the 10th century; Italian 11th-century manuscripts used "a red one to indicate the F
   and a yellow one to indicate the C"; a third line was added between them and a fourth above; "Latin
   letters were placed as clefs in order to determine the pitch"; Guido of Arezzo (c. 991 to 1033)
   "claimed, that he had invented this system". Full page; Moderate (a university teaching resource,
   no author named). The popular line "Guido invented the staff" overstates it, and John Haines, "The
   origins of the musical staff", _The Musical Quarterly_ 91 (2008), argues as much; that paper was
   **not read** (its PDF link led to a login page). **Possible Go deeper**, and a myth worth correcting
   only once Haines is read.
3. **The clefs are letters.** The G clef "curls around a G" and the F clef's "two dots center around an
   F" (E&SJ 1.2); "The C clef is moveable: whatever line it centers on is a middle C" (E&SJ 1.2), and OMT
   2e 1.3 says the alto clef "is indented around the C line (the middle line)". Full text. Strong.
   **Possible Go deeper**: a third clef, the alto, that viola players read, centred on middle C.
4. **Five lines, nine notes; two staves, twenty-one.** Each staff holds nine positions (R15-1). Between
   the bass staff's top line (A3) and the treble's bottom line (E4) sit three more: B3 in the space above
   the bass staff, middle C on its ledger line, D4 in the space below the treble. So the grand staff
   writes 9 + 3 + 9 = 21 white-key notes, G2 to F5, with only middle C's ledger line (arithmetic from
   R15-5 and R15-8). **Possible wrap line.**
5. **The piano reaches past the grand staff at both ends.** A0 is 13 letters below the bass staff's G2
   and C8 is 18 letters above the treble's F5 (arithmetic), so a piano's highest and lowest notes need
   many ledger lines or an octave sign; the article names this as a question for later, since 8va is
   ABRSM Grade 2 (ABRSM 2023 p. 18, Signs, Grade 2: "8va"). **Possible Go deeper.**
