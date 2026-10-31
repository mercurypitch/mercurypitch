# Research: Lesson 20, Runs and the pentatonic scale

Every "Facts to check" item on the season plan's card (SEASON-2 § 3, Lesson 20), resolved, Savage et
al. (2015) read whole as the season plan asked (§ 8.1 risk 15), and every other claim the article plan
makes. App claims cite the code at `b803c7d43` by `file:line`, each line read there. Web sources
fetched 30 October 2026. Strength grades as research/pedagogy-research.md.

## Where a source contradicts the card or the season plan

1. **Savage et al. (2015) do more than fail to support a pentatonic universal: they tested it, and it
   failed.** Pentatonic scales were one of eight features "specifically predicted to be universal" that
   "failed to meet this threshold" (frequency about 0.2 in their Table S5), though where they occur they
   "tend to show surprisingly similar interval structures" (R20-7). The card's "makes no universality
   claim" stands; the lesson can now correct the myth with a source.
2. **The pentatonic's degrees rest on Open Music Theory, not only on Kodály and Bennett.** OMT 2e 8.9
   gives 1, 2, 3, 5, 6 and "removes ... the two notes that create half steps" (R20-1). Kodály's use of
   pentatonic material is a practitioner account (R20-6); Bennett was not read.
3. **Scale Runner is not a run.** It plays each note for 700 ms and then waits up to 2 s for the singer
   to match it, one note at a time (R20-11). The card calls it a run drill; the practise card must say
   it is note-by-note echo, good for tuning the pattern, not for speed. It also scores against the
   octave it plays (R20-11).
4. **Duke, Simmons and Cash (2009) report rank correlations from 17 pianists**, so "the proportion of
   correct trials predicted retention" is a correlation in a small sample (R20-8). The card's
   paraphrase holds; the lesson says "in one study of 17 pianists".
5. **Arneson, the benchmark's agility source, says agility is developed with "fast arpeggios and
   scales"** (R20-10). It does not say to start slowly; the "slow first" advice rests only on the
   practice studies, as an inference, as the card says.

## Sources

- **OMT 2e**: Gotham et al., _Open Music Theory_, 2nd ed., LibreTexts edition: 8.9 "Collections"
  (part 8, 20th- and 21st-Century Techniques) and 7.13 "Pentatonic Harmony" (part 7, Popular Music),
  human.libretexts.org/Bookshelves/Music/Music_Theory/Open_Music_Theory_2e_(Gotham_et_al.)/. Full text
  read; their examples are images.
- **Savage 2015**: Patrick E. Savage, Steven Brown, Emi Sakai and Thomas E. Currie (2015), "Statistical
  universals reveal the structures and functions of human music", _PNAS_ 112(29), 8987-8992,
  doi:10.1073/pnas.1414495112, PMC4517223. Full text read, with its SI as given on the PMC page
  (pmc.ncbi.nlm.nih.gov/articles/PMC4517223/), in two passes.
- **Duke 2009**: Robert A. Duke, Amy L. Simmons and Carla Davis Cash (2009), "It's Not How Much; It's
  How: Characteristics of Practice Behavior and Retention of Performance Skills", _Journal of Research
  in Music Education_ 56(4), 310-321, doi:10.1177/0022429408328851. Abstract read in full (OpenAlex);
  full text not read (paywalled).
- **Miksza 2007**: Peter Miksza (2007), "Effective Practice: An Investigation of Observed Practice
  Behaviors, Self-Reported Practice Habits, and the Performance Achievement of High School Wind
  Players", _Journal of Research in Music Education_ 55(4), 359-375, doi:10.1177/0022429408317513.
  Abstract read (Crossref record).
- **Arneson**: Christopher Arneson, "A Basic Guide to Vocal Exercises for Beginning Singing Teachers"
  (4 pp.), www.rider.edu/sites/default/files/docs/voiceteacher-basic_guide_for_beginning_teachers.pdf,
  the benchmark's source (research/curriculum-benchmark.md § 2.1). Full text read; p. 2.
- **Kodály**: research/pedagogy-research.md § 3.2 (secondary, Practitioner).
- **Lessons 4, 10 and 18**: Lesson 4's and 10's FACTS at `b803c7d43`; Lesson 18's RESEARCH.md.

## Claims

**R20-1. The major pentatonic is the major scale without fa and ti, degrees 1, 2, 3, 5, 6: do re mi so
la; leaving out fa and ti removes both semitones.**
OMT 2e 8.9: "Using the scale degrees of a major scale, a pentatonic scale can be formed with" 1, 2, 3, 5
and 6; "What the pentatonic collection removes from the diatonic is the two notes that create half
steps", scale degrees 4 and 7. OMT 2e 7.13: a collection "distinctive for containing only 5 pitches and
no semitones". Full text. Strong. The major scale's semitones are mi-fa and ti-do (Lesson 4 FACTS).

**R20-2. Its steps climb 2, 2, 3, 2 and 3 semitones: no semitones, but not even.**
Arithmetic from [0, 2, 4, 7, 9, 12] (`python3 -I`); the app's own description, "Folk and rock, no half
steps" (`src/lib/scale-data.ts:115-119`, `degrees: [0, 2, 4, 7, 9, 12]`). Strong. (The lead review's
correction, SEASON-2 line 17.)

**R20-3. The minor pentatonic is a rotation of the same five notes: from la, A C D E G; sung with A as do
in do-based minor, do me fa so te, climbing 3, 2, 2, 3, 2.**
OMT 2e 8.9: "an especially common rotation of the pentatonic collection that is referred to as the
minor pentatonic"; OMT 2e 7.13: the pentatonic is "typically found in one of two rotations: the "major
pentatonic" and the "minor pentatonic" scales". The degrees, arithmetic from the app's
`'pentatonic-minor'`, `degrees: [0, 3, 5, 7, 10, 12]` (`src/lib/scale-data.ts:120-124`): 3 is me, 5
fa, 7 so, 10 te in do-based minor (Lesson 10 FACTS 8). Full text and code. Strong. OMT's example of
which notes is an image; the note names are arithmetic.

**R20-4. The pentatonic's five notes are a stack of fifths: C, G, D, A, E.**
OMT 2e 8.9 (Key Takeaways): it "can also be generated as a stack of five perfect fifths" (five notes,
four fifths: C-G-D-A-E, arithmetic); body: "the pentatonic is a narrower form of the same collection:
C, G, D, A, E." Full text. Strong. Links to Lesson 21's circle.

**R20-5. The blues scale adds one note to the minor pentatonic, between fa and so.**
`src/lib/scale-data.ts:125-129` (`blues`, `degrees: [0, 3, 5, 6, 7, 10, 12]`, "Blues scale with the
"blue note""). The app's Gravity drill names that semitone "Fi", ♯4 (`src/lib/ear/item-bank.ts:68`).
Code read. Strong for what the app holds; no theory text was read for the blues scale, so the plan keeps
it to Go deeper and teaches no syllable (card).

**R20-6. Kodály teaching starts from pentatonic material.** pedagogy-research.md § 3.2: "Sound before
symbol, singing first, folk material, pentatonic starting material" (Wikipedia and a teacher's blog).
Secondary. Practitioner. The plan does not say why, and does not claim pentatonic is "easier".

**R20-7. The pentatonic is not a universal of music; scales of uneven steps with seven or fewer notes
nearly are.**
Savage 2015, abstract: "Our analyses reveal no absolute universals but strong support for many
statistical universals that are consistent across all nine geographic regions sampled", from "a
well-sampled global set of 304 music recordings". Results, Universal Features: the pitch universals are
"Discrete pitches", "Nonequidistant scale", "≤7 scale degrees", "Descending/arched contour" and "Small
intervals (<750 cents)"; "Eight features that were specifically predicted to be universal failed to meet
this threshold: vocal embellishment, syllabic singing, vocables, membranophones, idiophones,
aerophones, dissonant homophony, and pentatonic scales"; "Many of these features do display widespread
distributions and surprising cross-cultural similarities when they do occur [e.g., pentatonic scales
throughout the world tend to show surprisingly similar interval structures (refs. 43 and 44)]". SI
Table S5: pentatonic scale, long-term frequency 0.198, not significant. The SI codes "Pentatonic scale"
present for "exactly five pitch classes" and "Nonequidistant scale" when "not all intervals between
pitch classes are equal". Their caveats: the sample "is relatively small compared with the vast array
of music that humans have produced"; analyses are "restricted primarily to surface features that could
be analyzed from audio recordings alone". Full text. Strong for what this sample shows; the plan says
"in one study of 304 recordings from around the world".

**R20-8. In one study of 17 pianists, how long they practised and how many tries they made did not
predict how well they played the next day; how many of their tries were correct did.**
Duke 2009, abstract: "We observed 17 graduate and advanced-undergraduate piano majors practicing a
difficult, three-measure keyboard passage from a Shostakovich concerto"; "Results indicated no
significant relationship between the rankings of pianists' retention test performances and any of the
following variables: practice time, number of total practice trials, and number of complete practice
trials. There were significant relationships between retention test rankings and the percentage of all
performance trials that were performed correctly, r = —.51, the percentage of complete performance
trials that were performed correctly, r = —.71, and the number of trials performed incorrectly during
practice, r = .48" (correlations with ranks, where rank 1 is best, hence the signs); "the strategies
employed during practice were more determinative of performance quality at retention than was how much
or how long the pianists practiced". Abstract only. Moderate (small, correlational, piano not voice). As
the card says, "slow enough to be accurate, then nudge it up" is an inference for singing, said as one.

**R20-9. Among 60 high-school wind players, slowing down while practising was one of the behaviours
that went with better performance.**
Miksza 2007, abstract: "Significant correlations were found ... (b) between performance achievement and
the behaviors repeat section, whole-part-whole, slowing, and skipping directly to or just before
critical musical sections of the étude". Abstract only. Weak to Moderate (correlational). Go deeper
only.

**R20-10. Singing teachers develop agility with scales and arpeggios on open vowels; staccato with
short, separated notes.**
Arneson p. 2: "AGILITY, the execution of fast moving passages with clear articulation and freedom is of
primary importance in good singing, promoting flexibility and coordination. Fast arpeggios and scales,
ascending and descending using the vowel [u], [a], and alternating vowels, develop agility";
"STACCATO is produced much in the same way as legato but without sustaining the sound between each
note"; staccato exercises "develop onset, and breath coordination". Full text. Practitioner. The plan's
"ah" or "oo" follows it; the vocal coach signs off any agility instruction.

**R20-11. Scale Runner sings one note at a time: it plays each note, then listens; its Pentatonic is
the major pentatonic, up or down one octave, scored against the octave it plays.**
`src/features/exercises/scale-runner/ScaleRunnerExercise.tsx:26-33` (types Major, Minor, Pentatonic,
Chromatic); :52-53 (opens on Major, up); `src/lib/scale-data.ts:450-460` (`getScaleDegrees`: pentatonic
is `'pentatonic-major'`, minor `'natural-minor'`); `src/features/exercises/scale-runner/use-scale-runner-controller.ts:16-18`
(`NOTE_PLAY_DURATION_MS = 700`, `GAP_BETWEEN_NOTES_MS = 250`, `MATCH_WINDOW_MS = 2000`), :20-37
(`buildScaleNotes`: the degrees from a base note, closing on the octave, reversed for down), :88-120
(play the note, then a match window), :72-78 (difficulty scales the times); scoring by
`noteDeviationCents` (:133), which compares to the target MIDI with no octave folding
(`src/features/exercises/exercise-scoring-utils.ts:119-132`). So C pentatonic up is C D E G A C, six
notes, with no way back down in one run. Code read. Strong.

**R20-12. Staccato Precision: eight short notes from the major scale, in random order, each a 200 ms
reference then a 1.5 s window.**
`src/features/exercises/staccato-precision/use-staccato-precision-controller.ts:11-15` (`ROUNDS = 8`,
`NOTE_PLAY_DURATION_MS = 200`, `GAP_BEFORE_MATCH_MS = 300`, `MATCH_WINDOW_MS = 1500`);
(`generateNotes`, :18-22: the major scale's eight degrees, shuffled). Code read. Strong. It is echo, not a run.

**R20-13. `/exercises/speed-scales` opens Scale Runner at difficulty 8, fast.**
`src/features/exercises/slug-map.ts:61-67` (the comment, then the entry, :62-67). Code read. Strong. Not linked (no score may reward speed).

**R20-14. `?lesson=20` is not a lesson marker today.** R15-19.

## Interesting findings

1. **The pentatonic isn't everywhere, but uneven scales of seven or fewer notes nearly are.** In 304
   recordings from nine regions, pentatonic scales failed the test for a universal; scales with unequal
   steps and at most seven notes passed it (R20-7). Strong. **Possible Go deeper**, and a myth worth
   correcting ("every culture uses the pentatonic"). It also fits Step 1: 2, 2, 3, 2, 3 is uneven.
2. **Where pentatonic scales do occur, they tend to share interval structures** (R20-7). Strong.
   **Possible Go deeper.**
3. **The pentatonic is four fifths stacked: C, G, D, A, E** (R20-4). Strong. **Possible wrap line or
   tease** for Lesson 21's circle, as long as it does not answer Lesson 21's predict.
4. **"It's not how much; it's how":** in the pianists' study, practice time did not predict the next
   day's playing; the share of correct tries did (R20-8). Moderate. **Possible cold open** (the plan's).
5. **The app's ear drills already name the blue note's degree, "Fi"** (R20-5). Strong. **Possible Go
   deeper**, with no syllable taught.
