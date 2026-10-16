# Facts: Lesson 2, Twelve notes

`claim | source | how it was verified`. Anything on screen or in the narration must be here. App
claims cite the source at `99c8818` (main, 16 Oct 2026) by `file:line`. Web sources were fetched on
16 Oct 2026.

## Tuning and arithmetic

1. Twelve-tone equal temperament (12-TET) divides the octave into twelve equal steps, the semitones | Wolfe, "Note names, MIDI numbers and frequencies", UNSW (newt.phys.unsw.edu.au/jw/notes.html): "In equal temperament, an octave comprises 12 equal semitones" | fetched; quoted
2. Each equal-tempered semitone multiplies the frequency by 2^(1/12) = 1.059463..., about 1.0595 | Wolfe (as 1): "Each semitone therefore has a ratio of 2^1/12 (approximately 1.059)" | fetched; arithmetic to four decimals
3. Twelve such steps multiply to exactly 2, the octave's 2:1 ratio: (2^(1/12))^12 = 2^(12/12) = 2 | arithmetic; the octave is 2:1 (ANSI/ASA S1.1, Lesson 1 FACTS 7) | arithmetic
4. So twelve semitones up from A3 (220.00 Hz) is A4 (440.00 Hz): "two hundred and twenty hertz has doubled to four hundred and forty" (b10) | 3 and the table in 6 | arithmetic
5. The hertz size of a semitone grows with pitch while its ratio stays the same: A3 to A#3 is 13.08 Hz, A4 to A#4 is 26.16 Hz; a semitone raises the frequency by about 5.95 % | 2 and 6 | arithmetic; web lesson Go deeper only
6. Frequencies used, A4 = 440 Hz, f = 440 x 2^((m - 69) / 12) for MIDI note m (A4 = 69, C4 = 60), to two decimals | Wolfe (as 1): "By convention, A4 is often set at 440 Hz", "m for the note A4 is 69"; the same formula is the app's `midiToFreq` (`src/lib/scale-data.ts:151-157`) | computed from the formula and rounded to two decimals; all 37 rows re-checked by script; table below

   | Note        | MIDI | Hz     | Note        | MIDI | Hz     | Note        | MIDI | Hz     |
   | ----------- | ---- | ------ | ----------- | ---- | ------ | ----------- | ---- | ------ |
   | A2          | 45   | 110.00 | A3          | 57   | 220.00 | A4          | 69   | 440.00 |
   | A#2 / Bb2   | 46   | 116.54 | A#3 / Bb3   | 58   | 233.08 | A#4 / Bb4   | 70   | 466.16 |
   | B2          | 47   | 123.47 | B3          | 59   | 246.94 | B4          | 71   | 493.88 |
   | C3          | 48   | 130.81 | C4          | 60   | 261.63 | C5          | 72   | 523.25 |
   | C#3 / Db3   | 49   | 138.59 | C#4 / Db4   | 61   | 277.18 | C#5 / Db5   | 73   | 554.37 |
   | D3          | 50   | 146.83 | D4          | 62   | 293.66 | D5          | 74   | 587.33 |
   | D#3 / Eb3   | 51   | 155.56 | D#4 / Eb4   | 63   | 311.13 | D#5 / Eb5   | 75   | 622.25 |
   | E3          | 52   | 164.81 | E4          | 64   | 329.63 | E5          | 76   | 659.26 |
   | F3          | 53   | 174.61 | F4          | 65   | 349.23 | F5          | 77   | 698.46 |
   | F#3 / Gb3   | 54   | 185.00 | F#4 / Gb4   | 66   | 369.99 | F#5 / Gb5   | 78   | 739.99 |
   | G3          | 55   | 196.00 | G4          | 67   | 392.00 | G5          | 79   | 783.99 |
   | G#3 / Ab3   | 56   | 207.65 | G#4 / Ab4   | 68   | 415.30 | G#5 / Ab5   | 80   | 830.61 |
   |             |      |        |             |      |        | A5          | 81   | 880.00 |

7. A4 = 440 Hz is the standard tuning reference, and the app's reference is fixed at it | ISO 16:1975 (Lesson 1 FACTS 16); `A4_FREQ = 440.0` (`src/lib/scale-data.ts:152`) | standard and code
8. Octave numbers change at C: B3 is followed by C4 | scientific pitch notation (Lesson 1 FACTS 17a); `midiToNoteNameOctave` (`src/lib/note-utils.ts:38-40`) | standard and code
9. Each example is synthesised in exact 12-TET from the table in 6, so every semitone the film plays is exactly 100 cents | Lesson 2's `tools/mix.py` (to be written, as Lesson 1's `hz()` and `tone()`) | by construction; measure in the critic round as Lesson 1 did (FACTS 12b)

## The keyboard, semitones and tones

10. Neighbouring keys on a keyboard, white or black, are one semitone (half step) apart, and the half step is the smallest interval in Western notation | Open Music Theory, 2nd ed. (Gotham et al.), 1.5 "Half Steps, Whole Steps, and Accidentals": "A half step is considered to be the smallest interval, or distance between two notes, in Western musical notation" | fetched (LibreTexts edition); said as "the smallest step a piano has" (b19) and "the smallest step between them" (b5, b13)
11. A tone (whole step) is two semitones | OMT 2e 1.5: "A whole step is the equivalent of two half steps" | fetched
12. "Semitone" and "tone" are also called "half step" and "whole step" | OMT 2e 1.5 uses half and whole steps; the ABRSM Grade 1 syllabus says "tones and semitones" (research/curriculum-benchmark.md § 1.1); the app's own Learn chapter says "100 cents = 1 semitone (half step)" (`src/types/walkthrough.ts:834`) and Ear Lab Contour names its tiers "Whole steps" and "Half steps" (`src/lib/ear/banks.ts:176-187`) | fetched and code; said as "Some people call it a half step" (b14), "Some call it a whole step" (b24)
13. Every octave of a keyboard has seven white keys (the letters A to G) and five black keys, in groups of two and three: twelve keys | OMT 2e 1.4 "The Keyboard and the Grand Staff": "The black keys are grouped into sets of either three or two", letters "repeating in a loop", "repeating the pattern for each octave"; the count of keys per octave | fetched; counted (OMT does not state the count)
14. E and F, and B and C, have no black key between them, because they are already a half step apart | OMT 2e 1.5: "Two pairs of white keys—E/F and B/C—do not have black keys in between them ... This is because E–F and B–C are both half steps" | fetched; said as "B and C are already neighbours, a semitone apart, so there's no room for a key between them" (b21)
15. Of the seven neighbouring letter pairs (A–B, B–C, C–D, D–E, E–F, F–G, G–A), five are a tone apart and two (B–C, E–F) a semitone; the five tone-wide gaps each hold one note, so 7 + 5 = 12 | follows from 11, 13 and 14 | counted
16. The twelve-step climb A3 to A4 passes A3, A#3, B3, C4, C#4, D4, D#4, E4, F4, F#4, G4, G#4, A4: thirteen notes, twelve steps | 6 | counted

## Sharps, flats and two names

17. A sharp (♯) raises a note by a semitone; a flat (♭) lowers it by a semitone | OMT 2e 1.5: "A sharp (♯) ... raises a note by a half step"; "A flat (♭) ... lowers a note by a half step" | fetched
18. The black key between C and D is C♯ (a semitone above C) and D♭ (a semitone below D): spelled differently, the same sound, "enharmonic" | OMT 2e 1.5: "Notes have enharmonic equivalence when they are spelled differently but sound the same"; "C♯ and D♭ are enharmonically equivalent" | fetched
19. The five black keys of an octave and both their names: C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭, A♯/B♭ | 17 and 18 | derived
20. A sharp or flat can land on a white key: one semitone up from E is F, so E♯ is F; likewise F♭ is E, B♯ is C and C♭ is B | OMT 2e 1.5: "F is also known as E♯, and E is also known as F♭"; "C is also known as B♯, and B is also known as C♭" | fetched; the film uses E♯ only (b33); the web toggle shows the other three as extras
21. Both names are correct; which one is written depends on the music around it (the key) | OMT 2e 1.12: "the B major and C♭ major scales have different key signatures ... but they sound the same because the notes B and C♭ are enharmonically equivalent"; research/pedagogy-research.md § 3.10 ("Spelling encodes function in a key", OMT v2, Lavengood et al. 2023) | fetched (1.12); the OMT v2 page itself returned 403, so its wording is the research report's; said only as "depends on the music around it" (b34)

## Cents

22. A cent is a hundredth of an equal-tempered semitone: 100 cents to a semitone, 1,200 to an octave; one cent is a ratio of 2^(1/1200), about 1.000578 | Ellis, A. J. (1885), "On the Musical Scales of Various Nations", Journal of the Society of Arts, 485–527 (the paper that introduced the cent); definitions as in "Cent (music)", Wikipedia | fetched (Wikipedia); the film never dates the cent, because Ellis first defined the system in his 1880 "History of Musical Pitch" and introduced it officially in 1885; the page says only that the cent "comes from Alexander Ellis, who used it in 1885 to compare the scales of different musical cultures"
23. A tone is 200 cents | 11 and 22 | arithmetic (b52)
24. Halfway between two neighbouring notes is 50 cents; past it, the other note is nearer. Likewise A♯ sits exactly halfway between A and B, 100 cents from each | 11 and 22 | arithmetic (b40; the page's cold-open reveal and step 1)
25. The cents glide (`cents-glide`) holds A3 220.00 Hz for 0.5 s, glides exponentially to A#3 233.08 Hz over 2.5 s (f = 220 x 2^(u/12), 40 cents a second), and holds 0.6 s; its readout shows the cents sounding at that moment, so values such as 25, 50 and 75 cents (223.20, 226.45 and 229.74 Hz) are true readings, not claims | Lesson 2's `tools/mix.py`, built like Lesson 1's `sweep()` (Lesson 1 FACTS 11a) | arithmetic; measure in the critic round

## MercuryPitch

26. MercuryPitch is free | `public/llms.txt:3` ("A free, open-source singing and playing studio") | repo
27. MercuryPitch draws your voice as a line, higher notes higher | Lesson 1 FACTS 21 (PRODUCT.md; `docs/branding/BRAND.md` § 5) | product
28. On MercuryPitch's pitch line the black keys get their sharp names (C#, D#, F#, G#, A#) | the app's note tables are sharps only (`src/lib/note-utils.ts:18-31`, `src/lib/scale-data.ts:7-20`, `NoteName` in `src/types/index.ts:8-22`); the pitch canvas labels its rows `note.name + note.octave` (`src/components/PitchCanvas.tsx:1364`, `:1369`) with names from `midiToNote` (`src/lib/scale-data.ts:172-177`, used at `:342`), so even a scale in B♭ is labelled A#; the live note label comes from the pitch detectors' sharp lists (`src/lib/pitch-algorithms/autocorrelator-detector.ts:244-257`, `fft-detector.ts:412-425`; `swift-f0-adapter.ts:74` through `freqToNote`) | code. Scoped to the pitch line on purpose: the sheet-music view spells flats in flat keys (`src/lib/sheet-music-renderer.ts:85-121`, `:494`), the key picker offers "Bb" (`src/features/sidebar/panels/PlaybackSetupPanel.tsx:94`) and a Learn chapter writes scales with flats (`src/types/walkthrough.ts:905`, `:922`). Said as "On MercuryPitch's pitch line, you'll see the sharp names, like C sharp" (b35); never "always" or "only"
29. MercuryPitch measures pitch distance in cents, 100 to a semitone | Voice Mirror: "All pitch math is done in MIDI-cents (A4 = 6900), so a semitone is a uniform 100-cent step" (`src/lib/mirror/metrics.ts:10-11`), and a match is scored by its median deviation in cents (`metrics.ts:261-347`); the web drills average the deviation in cents (`src/features/exercises/exercise-scoring-utils.ts:119-131`) and score 100 - 1.5 x average cents (`:161-164`); `freqToNote` returns the cents from the nearest note (`src/lib/scale-data.ts:180-188`) | code (b39)
30. The Singing tab's "Input monitor", on by default, shows the nearest note's name, its frequency to one decimal and a cents bar from -50 to +50 | `src/components/SingingCanvasHud.tsx:91-99`; default `true` (`src/stores/settings-store.ts:683-684`); `src/components/PitchDisplay.tsx:22-69` (bar labels at `:62-64`); the detectors name the nearest note and measure cents from it, so the reading stays within 50 either way (`autocorrelator-detector.ts:259-267`) | code; drawn in S13 as a labelled house-style monitor, not a screenshot (b39, b40)
31. Ear Lab is at mercurypitch.com/ear-lab | `src/seo/entry-pages.ts:397-402`; `public/llms.txt:30-32` | code (end card)
32. Ear Lab's Leap plays two notes and asks for the distance ("Two notes — name the interval"); its twelve answers include Minor 2nd (m2, one semitone) and Major 2nd (M2, two semitones); each trial roves the lower note between C3 and A4 and plays the pair up or down at a coin flip; it is rated by Elo | `src/features/ear-lab/instruments.ts:131-138`; `src/lib/ear/banks.ts:36-50` (`leap:m2` payload 1, `leap:M2` payload 2); `src/lib/ear/drills.ts:180-186` (12 choices); `src/features/ear-lab/LeapDrill.tsx:47-48` (root, direction), `:94` (prompt), `:97-101` (all twelve buttons) | code (end card "Leap: m2 = semitone, M2 = tone"; the page's practise card)
33. Today no link opens Leap, or limits it to m2 and M2: `/exercises/<slug>` launches only an exercise or a tab, and the existing slugs are perfect-octave, speed-scales, karaoke-duel and jam-relay; the Ear Lab opens a named drill only through `pendingEarDrill`, set by the Ascent's ear week | `src/features/exercises/slug-map.ts:24-44`, `:47-64`; `src/stores/ui-store.ts:541-546`; `src/pages/EarLabPage.tsx:60-68`; the `ear-drill` launch kind with a bank subset is planned (CURRICULUM § 4 item 5) | code and plan; so the film's end card shows /ear-lab and never a slug
34. A subset launch must also change Leap's guess floor: the drill's `choices` count sets the Elo guess floor "so it must match what the UI actually renders" | `src/lib/ear/drills.ts:58-59`, `:180-186` | code (WEB-SPEC engineering note, not narrated)
35. Ear Lab Contour asks only whether the second of two tones went up, down or stayed; its gap tiers include 200 cents ("Whole steps") and 100 cents ("Half steps"), served by the rating, not chosen | `src/features/ear-lab/ContourDrill.tsx:26-30` (Up, Down, Same), `:51-57`, `:4-7`; `src/lib/ear/banks.ts:160-187` | code (page only, as an optional warm-up)

## Research (the next-episode hook)

36. In a sample of 1,105 university students, 59 % said they could not imitate melodies by singing; in the two singing experiments, 10 of 79 participants (13 %) and 7 of 45 (16 %) sang a semitone or more off; the abstract says "10-15% of the participants imitated pitch at least one semitone off" | Pfordresher, P. Q. and Brown, S. (2007), "Poor-pitch singing in the absence of 'tone deafness'", Music Perception 25(2), 95–115, doi:10.1525/mp.2007.25.2.95: p. 95 (questionnaire), pp. 98 and 100 (Experiment 1: 79 participants; average note errors beyond +100 or -100 cents, "more than one semitone off pitch"), pp. 108 and 109 (Experiment 2: 45 participants; every pitch but the comfort pitch sung outside +-1 semitone, octave equivalents allowed) | full text fetched from the first author's site (acsu.buffalo.edu/~pqp/pdfs/Pfordresher&Brown_2007_MP.pdf) and read; said as the CURRICULUM's Lesson 3 hook: "Asked, most of 1,105 students said they couldn't copy a tune. Tested, only about one in ten to one in six missed by a semitone or more" (b54, b55); on screen 59 %, 13 % and 16 %. The survey and the experiments are different groups, which is why the lines say "Asked" and "Tested"
37. The same paper measures in cents "such that 100 cents = 1 semitone" | p. 100 | read; a second source for 22, not narrated
37a. Singers also say "sharp" for a little too high and "flat" for a little too low | the same paper, p. 100: "negative values reflected undershooting ('flat'), positive values reflected overshooting ('sharp')" | read; the page's Go deeper only (the film keeps one meaning per word)

## Singing and safety

38. Starting on A3 or A4 suits every voice type the app knows: each comfortable range contains A3 to A#3 or A4 to A#4 (bass E2–E4, baritone G2–G4, tenor C3–C5, alto F3–F5, mezzo-soprano A3–A5, soprano C4–C6) | `VOCAL_RANGES`, `src/stores/settings-store.ts:91-152` | code; said as "Start on my A, or the A an octave up" (b42b)
39. An octave up still counts as the same note | Lesson 1 FACTS 18 and 19 | carried
40. Sing gently; never push | Lesson 1 FACTS 20; the playbook's house rules | owner rule (b44). A one-semitone slide on a hum or "ooh" is within "a comfortable hum", so the comfort-check line is not required (TEACHING-PLAYBOOK house rules: it precedes holds, sirens and range); the page adds the app's house line "Stop immediately if anything feels uncomfortable" (`src/features/exercises/ExerciseShell.tsx:710-713`)

## Sounds: the exact pitches of every example

Every example is synthesised in `tools/mix.py` at the frequencies in 6, with Lesson 1's soft
`tone()` timbre unless noted. Times are seconds from the sound's cue.

41. `sing-blue-a3`, `sing-orange-a4`: Merc's Echo "ooh" placeholders, A3 and A4, measured 220.0 and 439.6 Hz | Lesson 1 FACTS 12b; `src/features/echo/merc-voice-set.ts:1-20`, `:50-62` | measured in Lesson 1; development placeholders (MASTER-PLAN § 12 item 1)
42. `first-step` (2.0 s): A3 220.00 at 0.00 for 0.85 s; A#3 233.08 at 1.00 for 0.95 s | 6 | by construction
43. `climb` (6.0 s): the thirteen notes of 16, onset 0.42 k for k = 0 to 12, each 0.40 s, the last (A4 440.00) 0.90 s | 6, 16 | by construction
44. `unroll` (3.0 s): a run up every key from A2 to A5 (37 notes, 0.05 s apart from 0.15 s, each 0.30 s), then a soft chime on A3 and A4 together at 2.0 s | 6 | by construction
45. `bc-cd` (3.4 s): B3 246.94 at 0.00 (0.55 s) to C4 261.63 at 0.60 (0.75 s); C4 at 1.90 (0.55 s) to D4 293.66 at 2.50 (0.75 s) | 6 | by construction
46. `neighbours` (3.4 s): C4 261.63 at 0.00 to C#4 277.18 at 0.60; B3 246.94 at 1.90 to C4 at 2.50 (same lengths as 45) | 6 | by construction
47. `e-f` (1.5 s), used twice (events `e-f`, `ef-again`): E4 329.63 at 0.00 (0.55 s) to F4 349.23 at 0.60 (0.75 s) | 6 | by construction
48. `tone-split` (3.7 s): C4 at 0.00, C#4 at 0.55, D4 at 1.10 (0.50, 0.50, 0.70 s); then C4 at 2.30 (0.50 s) to D4 at 2.85 (0.75 s) | 6 | by construction
49. `two-ways` (3.4 s): C4 at 0.00 to C#4 277.18 at 0.60; D4 293.66 at 1.90 to D♭4 277.18 at 2.50: both pairs land on the same frequency | 6, 18 | by construction
50. `slide-blue` (4.2 s): Merc's synthesised "ooh" (`src/lib/demo-audio.ts:304` partials 1, .62, .38, .24, .14, .08, .045, .025; a soft lowpass; vibrato 5.5 Hz, +-14 cents, grown in over 0.35 s; Lesson 1's `voice_tone()`), centre pitch A3 220.00 from 0.0 to 1.2 s, gliding to A#3 233.08 by 1.7 s, holding to 2.7 s, gliding back to A3 by 3.2 s, holding to 4.2 s | 6; `src/lib/demo-audio.ts:415-486` (`playVoiceContour`, a sung line that follows a cents contour) | by construction; the vibrato swings around the exact centre, so "up a hundred, then back to zero" (b43) describes the centre pitch
51. `slide-orange` (4.2 s): the same contour one octave up, A4 440.00 to A#4 466.16 and back | 6, 39 | by construction
52. `quiz-pair` (3.4 s): C4 261.63 at 0.00 to D4 293.66 at 0.60; E4 329.63 at 1.90 to F4 349.23 at 2.50 | 6 | by construction; the first pair is a tone, the second a semitone (b49)
53. The bed: Lesson 1's quiet open-fifth pad on A (110.00, 164.81, 220.00 Hz), only in the act transitions and under the dressed pauses (`q0`, `predict`, `your-turn`, `q1` to `q3`) | Lesson 1's `tools/mix.py` `pad()` | carried; its A also gives the viewer the starting note in `your-turn`

## Illustrations without claims

- The circle of twelve beads (S6) is the spiral seen from straight above: the turn's twelve beads
  at 30 degrees each (Lesson 1's geometry, Shepard 1982's pitch helix). No claim beyond 1.
- The equal tiles (S9 to S12) are a diagram, one tile per semitone, under the kicker "EQUAL
  WIDTHS"; not a claim about any real instrument's key sizes.
- The vertical ruler (S13) and the lanes (S14) are labelled "How MercuryPitch draws your voice"
  and the monitor "How MercuryPitch shows it": house-style drawings of 28 to 30, not screenshots.
- Orange's dashed "big jump" arc (S8) draws orange's guess, the contrast case, not a fact.
- The title card's five jumping notes and the title and end stings are Lesson 1's, unchanged
  (series identity); no claim.
- S16's faded violet line wandering a semitone below an amber band illustrates "missed by a
  semitone" (36); it is not anyone's recorded voice.

## Labels

- The narration voices and Merc's sung notes are scratch and placeholder audio, as in Lesson 1;
  the final cut carries no generated imagery, so no "concept" label is needed on screen.

## Unsupported, so left out of the script and the page

- "The semitone is the smallest step in music": false in general (quarter tones exist, and Ear
  Lab's own Contour plays 50- and 25-cent gaps, `src/lib/ear/banks.ts:189-201`). The script says
  "the smallest step a piano has" and "the smallest step between them" instead (10).
- "Pianos are tuned in exact equal temperament": not checked against any tuning source for this
  lesson (tuners are widely said to stretch octaves, but no source was read). The film plays exact
  synthesised 12-TET (9) and never claims a real piano's tuning.
- "Ear Lab needs no account": no sign-in gate appears in the Ear Lab code read
  (`src/pages/EarLabPage.tsx`, `src/features/ear-lab/LeapDrill.tsx`,
  `src/features/ear-lab/IdentificationDrillView.tsx`), but no repo statement says so, unlike
  Voice Mirror's "No account" (`public/llms.txt:19`). The page says only "Free".
- "Under about 20 cents a note no longer sounds out of tune": the app's own FAQ copy says so
  (`src/seo/entry-pages.ts:506`) with no source. Left out; Lesson 3 teaches the target band.
- "Most beginners think B to C is a bigger step": no prevalence data was found. It is voiced only
  as orange's sincere guess, never as a statistic.
