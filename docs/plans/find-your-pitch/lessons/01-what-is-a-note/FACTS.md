# Facts: Lesson 1, What is a note?

`claim | source | how it was verified`. Anything on screen or in the narration must be here.

## Physics and perception

1. A musical note's pitch comes from a vibration; faster vibration is heard as a higher pitch | ANSI/ASA S1.1 (pitch is the attribute of auditory sensation ordered from low to high, depending chiefly on frequency); Rossing, _The Science of Sound_, 3rd ed., ch. 1 and 7 | textbook definition
2. Frequency is measured in hertz; 1 Hz = one cycle (swing) per second | BIPM, _The International System of Units_ (SI Brochure, 9th ed.), Table 4: hertz, Hz = s^-1 | SI definition
3. Loudness depends mainly on amplitude (how far it swings); pitch mainly on frequency (how fast) | Rossing, ch. 6-7; Moore, _An Introduction to the Psychology of Hearing_, ch. 4 and 6 | textbook
4. People, especially children, often confuse "high" with "loud" | Costa-Giomi and Descombes (1996), Journal of Research in Music Education 44(3), doi:10.2307/3345594; Flowers and Costa-Giomi (1991) | used only as Tavi's question, not stated as a statistic
5. Sound travels from the vibrating source through the air as a pressure wave | Rossing, ch. 2 | textbook
6. The vocal folds vibrate to make the voiced sound of singing | Titze, _Principles of Voice Production_ (1994), ch. 1 | textbook
7. An octave is a 2:1 frequency ratio: 440 Hz is exactly twice 220 Hz | ANSI/ASA S1.1 (octave: interval with frequency ratio 2) | arithmetic
8. With a 2:1 ratio, every second cycle of the higher tone lines up with each cycle of the lower one | period of 440 Hz = 1/440 s; 2 periods = 1/220 s | arithmetic
9. Listeners hear notes an octave apart as having the same quality ("octave equivalence", the same chroma or note name) | Deutsch, _The Psychology of Music_, 3rd ed. (2013), ch. 7; Shepard (1982), Psychological Review 89(4) | said as "most people hear one note, just brighter"; octave equivalence is partly learned (Jacoby et al. 2019, Current Biology), so never "everyone" or "always"
10. A non-2:1 pair (220 Hz and 277.18 Hz) does not line up every cycle; it is a different note (C#4) | 440 x 2^(-8/12) = 277.18 Hz | arithmetic
11. Each doubling (110, 220, 440, 880 Hz) is heard as an equal step, while the hertz gaps double (110, 220, 440) | Weber-Fechner / logarithmic pitch perception; Moore ch. 6 | arithmetic plus textbook
    11a. The sweep (S5) glides exponentially from 110 Hz to 880 Hz, f = 110 x 8^u for u from 0 to 1, and its readout shows the frequency sounding at that moment, so passing values such as 118, 233, 459 and 826 Hz are true readings, not claims | `tools/mix.py` `sweep()` (f = f0 \* (f1 / f0) \*\* (t / dur)); measured by builder B from the mix | code
12. Pitch can be pictured as a spiral (helix): height plus a circle of note names that repeats every octave | Drobisch (1855); Shepard (1982) | historical model, shown as "more like a spiral"

12c. Slowed 220x, a 220 Hz string swings once a second (220 / 220 = 1); at real speed, 220 swings fill one second | arithmetic | arithmetic
12d. The HIGHER example steps 220 Hz to 330 Hz at the same loudness (a higher pitch, frequency ratio 3:2) | tools/mix.py 'higher' | measured
12e. A 2:1 pair is the simplest whole-number fit: every slow peak meets every second fast peak. Other whole-number pairs also realign: 3:1 meets on every slow peak too (every third fast peak), at a different note name (E5 over A3); 5:4 meets every fourth slow peak. So meeting on every slow peak is not unique to 2:1; being the simplest fit is | arithmetic (review round, plan lens: music teaching) | said as "the simplest fit there is", never "lines up = same note"; the web toy labels 3:1 as "fits too: a different note"
12f. Played one after the other, 440 Hz sounds higher than 220 Hz; played together they fuse into one sound, because 440 Hz is the second harmonic of 220 Hz and the pair forms one harmonic series | Bregman, Auditory Scene Analysis (1990), harmonicity and fusion; arithmetic (440 = 2 x 220) | said as "Higher, yes. But together, they melt into one note." (b16a); never "most people hear one note"

## Naming

13. Western music names notes with seven letters, A B C D E F G, then repeats | standard theory (ABRSM Grade 1 syllabus) | textbook
14. There are twelve notes in each octave on a piano (seven white keys, five black) | 12-tone equal temperament; any piano keyboard | count
15. Octave numbers: A4 = 440 Hz, A3 = 220, A2 = 110, A5 = 880 | scientific pitch notation (ASA); ISO 16:1975 | arithmetic
16. A4 = 440 Hz is the standard tuning pitch orchestras tune to | ISO 16:1975, _Acoustics: Standard tuning frequency_ | standard (some orchestras tune slightly higher, so the line says "the A that orchestras tune to", the standard reference)
    17a. Octave numbers change at C, not at A: B3 is followed by C4 (scientific pitch notation, ASA) | standard; app note naming C4 = MIDI 60 | standard
17. Middle C on a piano is C4 (about 261.63 Hz) | scientific pitch notation; the app uses C4 = MIDI 60 (`src/lib/sequence/test-echo.ts:18`) | code and standard

12a. "That two for one fit is the octave": an octave is the 2:1 ratio, so this is the definition, not a perception claim | ANSI/ASA S1.1 | definitional
12b. Merc's sung placeholder notes measure 220.0 Hz and 439.6 Hz median | critic round 1, autocorrelation over 14 windows | measured

## Singing

18. When two people sing the same tune together, they are often an octave apart (typical lower and higher voices) | Titze (1994): average speaking fundamental about 100-120 Hz for adult men, about 200-220 Hz for adult women, roughly an octave | said as "often", not "always"
19. Matching a note an octave up or down still matches the note name, and Voice Mirror counts it: its match score folds every error into one octave (`foldCents`), so a match counts in any octave. Shown on screen as "Voice Mirror counts any octave" (s17) | follows from 9 and 15; `src/lib/mirror/metrics.ts:249` ("Errors are octave-folded") and `src/lib/pitch-measurements` `foldCents` | code (critic round 1 verified; wording widened after critic 04)
20. Sing gently; never push or strain | the app's guided-voice safety foundation (`src/lib/guided-voice`); MercuryPitch brand voice | owner rule

## Product

21. In MercuryPitch your voice draws a line, higher notes higher on the screen | PRODUCT.md (real-time pitch visualisation); `docs/branding/BRAND.md` § 5 (the pitch canvas) | product
    22a. MercuryPitch is free | `public/llms.txt` line 3 ("A free, open-source singing and playing studio") | repo
22. Voice Mirror is at mercurypitch.com/mirror and needs no account | `public/llms.txt` ("No account, no setup, about sixty seconds"); motion-designer house rules | repo
23. The series name "Find Your Pitch" uses the brand tagline | `docs/branding/BRAND.md` § 1 ("Find your pitch.", recommended) | repo
24. The next-lesson card's tease, one line above Lesson 2's hook: "Seven letters, but twelve notes.", the seven letters of 13 against the twelve notes of 14, which Lesson 2 counts | `src/features/lessons/kit/lesson-copy.ts`, Lesson 2; 13, 14 | carried; the card draws it from the season data, so the page's markup holds none of it
25. The run time, "8 minutes" on the meta chip and as the season's `minutes` since #1192, where both read "10 minutes", an estimate with no task time behind it: 1,292 words of learner copy on today's page, every branch counted, at 238 words a minute (5.43 minutes), plus 132 s, 2.20 minutes, of sound, toys and tasks: the cold open's choice and its three plays, Play 220 Hz and Play 440 Hz (1.7 s each) and Play both (the two at 1.1 s, then together for 2 s: 4.7 s), 15 s; the three words' sounds (Pitch's 1.8-second glide, Hertz's 1.3 s, Octave's 2.6 s), 9 s; Step 1's pluck, which rings 3.2 s, and slow motion for about five one-second swings, 10 s; Step 2's dial from 110 to 880 Hz with its held tone, 8 s; Step 3's two sliders, each held with its tone, 10 s; Step 4's Play both, whose two tones run up to 9 s while the ratio slides from 1 to 3, and the ladder's four rungs at 0.62 s each, 14 s; Step 5's turn and about five beads at 0.9 s each, 10 s; Step 6's unroll, then A3 and A4, 6 s; Sing it's Merc's A (2.4 s) and the four-second hum back, about one and a half times, 10 s; the four quick-check questions, 40 s. 5.43 + 2.20 = 7.63, so the chip reads 8. The film is not counted: once it is uploaded (`kit/films.ts:43`), the page offers it as "The same lesson, as a film" (`#watch`), and the explorer gives its length beside the lesson's (`8 min · film 5:14`) | MASTER-PLAN § 4.2 (the web lesson's budget, "8 to 12 minutes of active time, 500 to 900 words", `MASTER-PLAN.md:137`); Brysbaert 2019 (Lesson 3 FACTS 61, carried); the words counted by `scripts/lesson-words.mjs` (`pnpm lesson:words`); the lengths in the page's modules: `src/features/lessons/lesson-01/predict.ts:16-36`, `lesson-01/words.ts:171-203`, `kit/sound.ts:379` (a pluck's partials stop at 3.2 s), `lesson-01/toy-octave.ts:140` (Play both stops itself at 9 s), `:162` (a rung, 0.62 s), `kit/spiral.ts:72` (a tapped bead or key, 0.9 s) and `kit/sing.ts:303-304` (Merc's note 2.4 s, the hum back 4 s); `kit/explorer.ts:184-188` (`lengthText`) | counted and arithmetic (1,292 / 238 = 5.43; 5.43 + 2.20 = 7.63); the task times are estimates timed from the page's own lengths, and the dial, the sliders and the turn have none, so the chip rounds to the nearest minute. It sits at the foot of § 4.2's 8 to 12 minutes and past its 900 words, 1,087 words under the series' cap of 2,379. The owner chose real run times for every chip on 23 October 2026 (HANDOFF)

## Illustrations without claims

- The tune in S17 (A B C# D E D C# B A, sung at A3 and A4 at once) is an illustration of two voices an
  octave apart, synthesised in `tools/mix.py`; no claim about any real song.
- The stylised pitch chart in S7 shows the app's default 24-semitone span (`PRODUCT.md`: "The default
  visible pitch range is 24 semitones") and no playhead (free monitoring has none); it is labelled as
  MercuryPitch's way of drawing pitch, not a screenshot.

## Labels

- The narration voices and Merc's sung notes are scratch/placeholder audio (see DECISIONS.md); the
  final cut carries no generated imagery, so no "concept" label is needed on screen.
