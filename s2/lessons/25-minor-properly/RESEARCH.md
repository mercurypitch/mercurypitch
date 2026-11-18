# Research: Lesson 25, Minor, properly

Every "Facts to check" item on the Lesson 25 card (SEASON-2 § 3), resolved, and every other claim
the article plan makes. App claims were read at `b803c7d43`; web sources on 30 October 2026.
OMT's music examples and tables are images; no fact rests on them unless the text names them.

## Where the sources and the card disagree (read first)

1. **"Sad and introspective" is not shown on any screen at `b803c7d43`.** The string is in
   `src/lib/scale-data.ts:88`, but no code reads a scale definition's `description`: a search of
   the repository finds the field only in its own file and its type (R13). Risk 16 is real in the
   code and not, today, on a screen. The plan still asks the app content track to change it (and
   its neighbours, "Bright and happy", "exotic tension", "Jazz minor") before anything displays it.
2. **The AP Music Theory reports could not be reached.** The season plan's support for the
   misconception (pedagogy-research.md:677, College Board chief reader reports 2005, 2017, 2021)
   now redirects to a directory page (R12). The misconception card rests instead on OMT, which says
   a piece is "simply 'minor'" while its sixth and seventh change (R2).
3. **OMT frames the three forms as categories "primarily for instrumental performers"** (R2), not
   as three different minors. The plan takes that framing: one minor key, whose sixth and seventh
   move.
4. **The app's walkthrough error on C minor's relative major is gone.** app-pedagogy.md recorded
   "C Minor ... Uses the same notes as relative major (A Major)" at `walkthrough.ts:906`; the string
   is not in `src` at `b803c7d43` (R13).

## Claims

### The three forms

**R1. Natural, harmonic and melodic minor, step by step.**
- Source: Gotham, M. et al. Open Music Theory, 2nd ed. (VIVA, CC BY-SA), § 1.13 "Minor Scales,
  Scale Degrees, and Key Signatures", LibreTexts edition,
  https://human.libretexts.org/Bookshelves/Music/Music_Theory/Open_Music_Theory_2e_(Gotham_et_al.)/01%3A_Fundamentals/1.13%3A_Minor_Scales_Scale_Degrees_and_Key_Signatures.
- Says: "Natural minor: W‑H‑W‑W‑H‑W‑W (ascending)"; "Harmonic minor: W‑H‑W‑W‑H‑3Hs‑H (ascending)";
  "Melodic minor: W‑H‑W‑W‑W‑W‑H (ascending) and W‑W‑H‑W‑W‑H‑W (descending)" (summary); "the
  descending pattern is the same as the natural form" (§ Melodic Minor); harmonic minor's pattern
  "is the same ascending and descending" (§ Harmonic Minor).
- Read: in full. Strength: Strong (standard; the benchmark's ABRSM, Coursera and Hooktheory
  sources for T15 were not re-read). Lesson 10 already taught natural minor as tone, semitone,
  tone, tone, semitone, tone, tone.

**R2. A minor key is one key; the three forms are ways its sixth and seventh change.**
- Source: OMT 2e § 1.13, § The Minor Scale: the three forms "should be thought of like flavors of
  ice cream"; "a work is simply “minor” or “in minor”; musicians do not consider music to be “in” a
  specific type of minor scale"; "minor keys and minor key signatures are always identified as
  simply “minor” ... and are based on the natural minor scale"; "The three different types of minor
  scales are useful categories primarily for instrumental performers."
- Read: in full. Strength: Strong. The misconception's refutation ("one minor key, its sixth and
  seventh change") rests here.

**R3. In do-based solfège, natural minor sings me, le and te; harmonic minor raises te to ti; the
raised ti gives the closure natural minor lacks.**
- Source: OMT 2e § 1.13, § Minor Scale Degrees, Solfège, and Scale-Degree Names: "In natural minor
  ... mi becomes me (pronounced “may”), la becomes le (pronounced “lay”), and ti becomes te
  (pronounced “tay”)"; "the ending lacks the same sense of closure you heard in the major scale. In
  the major scale, this closure is created in part by the ascending semitone between ti and do"; "In
  harmonic minor ... Having ti creates the sense of closure that is absent in the natural minor
  scale"; ascending melodic minor "has the sense of closure associated with the major scale, while
  the descending version follows the pattern of the natural minor scale"; the lowered seventh is
  "the subtonic".
- Read: in full. Strength: Strong. The series' do-based minor (MASTER-PLAN § 12 item 12; Lesson 10
  FACTS 8) matches OMT's syllables.

**R4. In minor, the V chord uses ti, not te, so that it is major.** OMT 2e § 4.02 "Strengthening
Endings with V7": "If you are writing in minor, remember to use ti, not te, in V7 to make the chord
major!" Read: in full. Strength: Strong. Arithmetic: in A minor, so-te-re is E, G, B (E to G is 3
semitones: minor); so-ti-re is E, G♯, B (4: major).

**R5. Raising te to ti leaves three semitones between le and ti, an augmented second, awkward to
sing; melodic minor raises le too on the way up to smooth it.**
- Sources: OMT 2e § 1.13 (R1): the harmonic form's "3Hs" step, "a distance of three half steps (or a
  whole step plus a half step)". Sharkey, L. C. Equipping the Musical Ear (Sierra College, CC BY-NC
  4.0), § 5.2.3 "Melodic Minor", LibreTexts, last modified 16 July 2025,
  https://human.libretexts.org/Courses/Sierra_College/Equipping_the_Musical_Ear/05%3A_Minor_Keys/5.02%3A_Three_Forms_of_the_Minor_Scale/5.2.03%3A_Melodic_Minor:
  "Whereas harmonic minor was driven by an harmonic purpose, melodic minor is driven by a melodic
  purpose"; "That's an augmented second! Three half steps. This is a challenging interval to sing";
  "To reduce the awkward augmented-second interval which is found in harmonic minor, melodic minor
  features a raised sixth scale degree"; the ascending form "looks very much like an A major scale
  ... But, with these pitches, we lose the distinct minor quality. To solve this problem, melodic
  minor uses different notes in its ascending and descending forms."
- Read: both in full. Strength: Strong for the interval (arithmetic: le to ti is 8 to 11, 3
  semitones); Moderate for the reason (one open course; OMT does not give one). Lesson 23's
  "augmented": a major second made a semitone wider.

### Relative and parallel keys

**R6. A major and a minor key with the same key signature are relative; the minor's tonic is three
semitones below the major's. A major and a minor key with the same tonic are parallel.**
- Source: OMT 2e § 1.13, § The Parallel and Relative Relationships: "The relative relationship is
  when a major key shares a key signature with a minor key. For example, C major does not have any
  sharps or flats in its key signature, and neither does A minor"; "The tonic of a minor key is
  always three half steps below the tonic of its relative major"; "The parallel relationship is
  when a major and minor key share a tonic note" (summary). "A sharp key cannot share a relative
  relationship with a flat key".
- Read: in full. Strength: Strong. Lesson 10's C major and C minor are parallel; Lesson 12's "chord
  on la" (A minor inside C major) never called it relative (Lesson 12 LESSON.md, preamble); this
  lesson does.

**R7. In do-based minor, A minor's do is A: the house moves from C to A, while the key signature
stays the same.** MASTER-PLAN § 12 item 12 (do-based minor, decided 19 October 2026), as Lesson 10
FACTS 8 and Lesson 12 LESSON.md (preamble: "The page never calls it a relative minor and never
sings from la as home") record it. Lesson 10's Go deeper names la-based minor as the other
practice ("Some teachers, especially in choirs and with children, sing minor from la instead").
Read: the packages. Strength: n/a (a series decision). Risk 9 (SEASON-2 § 8.1) is handled by saying
it in words and moving the house.

### Season 1 facts this lesson stands on

**R8. Lesson 10: C natural minor lowers mi, la and ti to me, le and te; do stays home**
(lessons/10-major-minor/LESSON.md, Step 5 and quick check 4). **Lesson 4: ti is the leading note,
leaning up to do** (lessons/04-major-scale/LESSON.md:161-162). **Lesson 23: augmented and
diminished** (Lesson 23 RESEARCH R3). Read: the packages.

### The app (read at `b803c7d43`)

**R9. Ear Lab's Gravity drills all twelve degrees, Te and Ti both.** `src/lib/ear/item-bank.ts:58-74`
(`GRAVITY_DEGREES`, "The chromatic twelve for Gravity"; `Te` at semitone 10, `Ti` at 11, `Le` and
`La` at 8 and 9); it writes "Sol" (as Lesson 4's FACTS records). Read: code.

**R10. The Singing tab's scale picker offers natural, harmonic and melodic minor**
(`src/features/sidebar/panels/PlaybackSetupPanel.tsx:145-148`). The app's melodic minor is one
ascending set, degrees `[0, 2, 3, 5, 7, 9, 11, 12]` (`src/lib/scale-data.ts:95-99`), with no
descending form. Sight-Singing reads the chosen scale when no phrase is launched
(`src/features/exercises/sight-singing/SightSingingExercise.tsx:188-195`) and spells every black key
as a sharp (`use-sight-singing-controller.ts:31-44`), so A harmonic minor's G♯ is right and C
minor's E♭, A♭ and B♭ read as D♯, G♯ and A♯. Read: code.

**R11. Scale Runner's Minor is natural minor only.** Its types are Major, Minor, Pentatonic and
Chromatic (`src/features/exercises/scale-runner/ScaleRunnerExercise.tsx:26-33`), and `minor` maps
to `natural-minor` (`src/lib/scale-data.ts:449-459`). Harmonic and melodic minor there wait for
SEASON-2 § 5 item 13. The sheet view gives a minor scale its relative major's signature
(`src/lib/sheet-music-renderer.ts:157-169`: "Minor scales inherit the signature of their relative
major"), which matches R6. `?lesson=25` is not read (`src/lib/lesson-marker.ts:11-19`). Read: code.

**R12. The AP reports.** pedagogy-research.md:677 lists the raised leading tone in minor among
recurring AP Music Theory exam errors, citing College Board chief reader reports for 2005, 2017 and
2021 [Practitioner]. Each URL now redirects to apcentral.collegeboard.org's past-exam directory.
**Not reached; not used.**

**R13. The app's scale descriptions.** `src/lib/scale-data.ts:79-104`: major "Bright and happy —
the most common scale" (:83), natural minor "Sad and introspective" (:88), harmonic minor "Minor
with raised 7th — exotic tension" (:93), melodic minor "Jazz minor — raised 6th and 7th ascending"
(:98). No code outside `scale-data.ts` and the `ScaleDefinition` type (`src/types/index.ts:143`)
reads `description` (repository search for `SCALE_DEFINITIONS` and `.description`), so none is
displayed. "Uses the same notes as relative major" is not in `src`. Read: code.

## Interesting findings

1. **Minor is one key with moving parts.** OMT calls the three forms "flavors of ice cream" and says
   musicians call a piece simply "minor" (R2). Possible: the misconception's better idea.
2. **The raised note makes a gap.** Raising te to ti leaves three semitones between le and ti, a
   step "challenging ... to sing", and melodic minor raises le as well, on the way up only, to close
   it (R5). Possible: Step 2's predict.
3. **Going up, melodic minor is nearly major.** Ascending A melodic minor differs from A major by one
   note, C instead of C♯ (arithmetic on R1: A B C D E F♯ G♯ A). Possible: Step 3's Notice.
4. **The forms are for instrumentalists.** OMT says the three named forms are "useful categories
   primarily for instrumental performers" (R2): a singer meets them as raised notes in a tune.
   Possible: Go deeper.
5. **The app keeps one melodic minor.** Its melodic minor is the ascending form only (R10), so a
   descending run from the Singing tab is not the textbook's. Possible: practice card note.
