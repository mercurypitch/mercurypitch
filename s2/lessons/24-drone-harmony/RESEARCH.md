# Research: Lesson 24, Harmony against a drone

Every "Facts to check" item on the Lesson 24 card (SEASON-2 § 3), resolved, and every other claim
the article plan makes. App claims were read at `b803c7d43`; web sources on 30 October 2026.
Frequencies are equal-tempered from A4 = 440 Hz; every number below was run with `python3 -I`.

## Where the sources and the card disagree (read first)

1. **The card's beat rates are right.** Recomputed: above A3 (220 Hz) the equal-tempered fifth beats
   0.745 times a second and the major third 8.731 (R4). The card's "about 0.75" and "about 8.7"
   hold; the plan states the formula and the frequencies.
2. **D'Amario et al. is now read in full** (the CC BY version, R8). The card's summary holds, with
   numbers: major thirds averaged 392.17 cents, minor thirds 299.13. The paper's print citation is
   J Voice 34(1), 159.e13-159.e27 (2020); the card's DOI is the 2018 online release of the same
   article.
3. **Dai & Dixon (2019) is now read in full** (R7). The card's quotes are the abstract's, word for
   word. The full text adds that the 16 singers were women, sang /ta:/ in two acoustically isolated
   rooms over headphones, and that the harmonic interval error was lower when both could hear each
   other than when they sang solo (p. 670).
4. **The page cannot run its scored drone checkpoint without headphones, and turns do not help.**
   The card's fallback (the page plays, then the learner sings) works for a melody, not a drone: the
   drone must sound during the hold. Without headphones the drone reaches the microphone, which runs
   with echo cancellation off (R13), and for the unison the drone itself sits in the band. The plan
   scores only with headphones and offers an unscored sing-along otherwise.
5. **A vibrato hides the beats** (Sundberg 1994, R6), and the kit's Merc "ooh" carries one (5.5 Hz,
   ±14 cents, Lesson 22's R18). Every beat demonstration must use tones without vibrato; a ±14-cent
   wave on the fifth's upper note moves its second harmonic by about ±5 Hz, far more than the 0.75
   Hz beat it is meant to show (arithmetic: 659.26 × (2^(14/1200) − 1) = 5.3 Hz).
6. **Kodály's part singing "from the start" is not verified.** Only publishers' listings were found,
   through a search summary: Bicinia Hungarica as "60 progressive two-part songs" (R15). Not used.

## Claims

### Beats

**R1. Two tones close in frequency beat, and the beats a second equal the difference between the
two frequencies.**
- Source: Wolfe, J. (UNSW Physclips). "Interference beats and Tartini tones".
  https://animations.physics.unsw.edu.au/jw/beats.htm. Lesson 3 FACTS 49 read it.
- Says: "The beat frequency equals the difference between frequencies of the beating signals";
  "the number of beats per second equals the difference in frequency between the two interfering
  waves".
- Read: in full. Strength: Strong (physics). So 220 against 222 Hz beats twice a second, and the
  beats slow to nothing as the two meet (Lesson 3's Go deeper).

**R2. Notes that are not the same can beat through their harmonics: tuners make two harmonics stop
beating.**
- Source: Wolfe, beats page (R1), guitar-tuning section: "The A string plays A2, so its third
  harmonic is also E4, a (just) twelfth above"; tune the A string "so its third 'harmonic' stops
  beating with the fourth 'harmonic' of the E string."
- Read: in full. Strength: Strong (physics; one worked example).

**R3. In a pure interval harmonics coincide; in equal temperament the fifth is very slightly narrow
and the major third 0.8 % wide.**
- Source: Wolfe, J. (UNSW Physclips). "Tartini tones, consonance, temperament, harmony and scales".
  https://animations.physics.unsw.edu.au/jw/Tartini-tones-temperament.html.
- Says: "3:2 = 1.500"; "major and minor thirds (5:4 and 6:5 in just intonation)"; "every second
  harmonic of the higher note coincides with one of those of the note a fifth below"; "the other
  harmonics are well separated, which avoids beats"; "the fifth is very slightly narrow"; "The ET
  major third is 0.8% wide (an eighth of a semitone), which is more serious, but can be disguised";
  piano strings' own beating helps hide "the beating due to the ET tuning compromise".
- Read: in full. Strength: Strong (physics). Arithmetic: 2^(4/12) / 1.25 = 1.0079, 0.79 % wide;
  a pure major third is 1200 × log2(5/4) = 386.31 cents, 13.69 below 400; a pure fifth 701.96, 1.96
  above 700; a pure minor third 315.64, 15.64 above 300.

**R4. The beat rates of the piano's intervals above a drone.** Formula: for an interval near the
pure ratio m:n (upper to lower), the nearly coinciding harmonics are the upper note's n-th and the
drone's m-th, so beats a second = |n × f_upper − m × f_drone|. On A3 (220.000 Hz):

| Interval (pure ratio) | Upper note, ET | Harmonics compared | Beats a second |
| --- | --- | --- | --- |
| Unison (1:1) | A3 220.000 | 220.000 against 220.000 | 0 |
| Octave (2:1) | A4 440.000 | 440.000 against 440.000 | 0 |
| Fifth (3:2) | E4 329.628 | 2 × 329.628 = 659.255 against 3 × 220 = 660.000 | 0.745 |
| Fourth (4:3) | D4 293.665 | 3 × 293.665 = 880.994 against 880.000 | 0.994 |
| Major third (5:4) | C♯4 277.183 | 4 × 277.183 = 1,108.731 against 1,100.000 | 8.731 |
| Minor third (6:5) | C4 261.626 | 5 × 261.626 = 1,308.128 against 1,320.000 | 11.872 |

At the pure intervals (E4 at 330.000, C♯4 at 275.000) the compared harmonics are equal and the
beats stop. On the checkpoint's drones: over D3 (146.832) the ET fifth beats 0.497 and the major
third 5.827 a second; over D4 (293.665), 0.994 and 11.654. The rates scale with the drone's
frequency. Arithmetic on R1 to R3, for tones that have these harmonics. Strength: Strong for the
arithmetic; whether the demo voice's harmonics, the app drone's timbre or a singer's voice make
them audible is for the lab (the card says so).

**R5. Musicians tuning by ear listen for beats to stop.** Lesson 3 FACTS 49 (Wolfe: beats are
useful "for tuning musical instruments"). Read there. Strength: Strong.

**R6. Sung with vibrato, a mistuned consonance does not beat; pure tuning is not what most music
uses.**
- Source: Sundberg, J. (1994). Acoustic and psychoacoustic aspects of vocal vibrato. STL-QPSR
  35(2-3), 45-68, p. 64 (read in full for Lesson 22).
- Says: "If such intervals are sung slightly out of pitch, beats occur. The greater the pitch error,
  the quicker the beats, and eventually they give rise to roughness. However, if the notes producing
  the consonant interval are sung with vibrato, no beats will occur"; "pure tuning is not generally
  used in music practise, because it tends to sound queer in many contexts (Sundberg, 1991)".
- Read: in full. Strength: Moderate (an expert review's argument; "no beats" is stated, not
  measured). Use: Step 4's "hold it straight if that's comfortable" (a coach line), and the reason
  the demonstrations carry no vibrato.

### What singers do

**R7. Singing a different part from your partner is less accurate than singing the same part, and
singing alone gives less pitch error, but singers who hear each other adjust to keep the harmony.**
- Source: Dai, J. & Dixon, S. (2019). Singing together: pitch accuracy and interaction in
  unaccompanied unison and duet singing. JASA 145(2), 663-675. https://doi.org/10.1121/1.5087817.
- Says: p. 663 (abstract): "Eight pairs of singers sang two excerpts either in unison or two-part
  harmony"; "(1) singing with the same vocal part is more accurate than singing with a different
  vocal part; (2) singing solo has less pPE than singing with a partner; (3) PEs are correlated, as
  singers adjust pitch to mitigate a partner's error and preserve harmonic intervals at the expense
  of melodic intervals and absolute pitch". p. 666: "Sixteen female UK residents took part", eight
  sopranos and eight altos, aged 19 to 30, singing /ta:/. p. 667: "two acoustically isolated rooms
  ... and sound isolating headphones". p. 670: "the duplex condition has less harmonic interval
  error than the solo condition, even though the PE and melodic interval error are greater"; "the
  solo condition has 9 cents less PE than the duplex condition".
- Read: in full. Strength: Weak to Moderate (one study, 16 singers, mostly choir-experienced).
- Use: the misconception card, shown half right: alone, your own notes are closer; together, the
  harmony between you is closer.

**R8. An a cappella quintet tuned closer to equal temperament than to pure tuning, with major thirds
a little nearer pure, and its rehearsal strategies included listening more closely.**
- Source: D'Amario, S., Howard, D. M., Daffern, H. & Pennill, N. (2020). A longitudinal study of
  intonation in an a cappella singing quintet. J Voice 34(1), 159.e13-159.e27, online 2018,
  https://doi.org/10.1016/j.jvoice.2018.07.015. CC BY, at
  https://eprints.whiterose.ac.uk/id/eprint/157113/.
- Says: abstract (p. 159.e13): a "semiprofessional singing quintet" over "five rehearsal sessions
  over four months"; "Tuning of each singer was closer to equal temperament than just intonation,
  but the size of major thirds was slightly closer to just intonation, and minor thirds closer to
  equal temperament." p. 159.e19: "The average size of the major thirds was 392.17 cents with a
  standard deviation of 27.56 cents. This is slightly closer to just intonation (386 cents) than ET
  (400 cents), and, together with the wide spread, indicates examples of both". p. 159.e22: minor
  thirds averaged "299.13 cents, with a standard deviation of 29.28". p. 159.e23: strategies
  included "singing a progression more slowly, encouraging each other to listen in a more focused
  way", and "separating out parts so that just two or three voices could be isolated".
- Read: in full. Strength: Weak (one ensemble of five). Use: Step 3 and Go deeper, as "one
  quintet", never as what singers do in general.

**R9. Barbershop tunes its chords to remove beats and generally avoids vibrato.** Acosta Martínez &
Daffern (2025), J Voice 39(3), p. 847.e30 (read in full for Lesson 22): barbershop "generally
forbids vibrato", "harmonization to avoid beats and create the lock and ring effect". Strength:
Weak (quoted from one study inside a review). Go deeper only.

### Season 1 and Season 2 facts this lesson stands on

**R10. Lesson 10's do, mi and so make a major triad; lowering mi a semitone makes it minor**
(lessons/10-major-minor/LESSON.md, Steps 2 and 3). **Lesson 13's harmonics**: "one of the frequencies inside a sung
note, at 1, 2, 3 or more times the note's own" (lessons/13-resonance-vowels/LESSON.md:117). **Lesson 5's band**: 35 cents either side of the target (Lesson
5 FACTS 43). **Lesson 23**: the perfect intervals and their ratios (Lesson 23 RESEARCH R7). Read: the
packages. A pure major third, 13.69 cents under the piano's, sits inside a ±35-cent band around the
piano's note; so does the pure fifth, 1.96 above.

### The app (read at `b803c7d43`)

**R11. Drone Intonation holds a drone and scores a sung interval above it against the piano's
equal-tempered note.**
- Pool: unison, minor third, major third, fourth, fifth, octave
  (`src/features/exercises/drone-intonation/use-drone-intonation-controller.ts:18-25`); a launch's
  intervals are kept to that pool (:33-46).
- Target: `const targetMidi = droneMidi + interval.semitones` (:152, :183), so equal-tempered; the
  drone sounds during the match window, `audioEngine.playTone(midiToFreq(droneMidi), matchWindowMs
  + 2000)` (:155), a window of 4 s (:13).
- Score: "(100 - avgDeviation * SCORE_K)", `SCORE_K = 1.5` (:14-16, :198), divided by a difficulty
  factor (:127). At the default, a pure major third 13.69 cents under the target scores 100 − 20.5,
  about 79; a pure fifth about 97.
- The drone's timbre follows the app's instrument setting (`src/lib/audio-engine.ts:1145-1148`:
  "sine/piano/organ/strings/synth"), so whether it has harmonics to beat with depends on that
  setting.
- `/exercises/thirds-on-a-drone` opens it on the minor and major thirds (`src/features/exercises/
  slug-map.ts:75-81`). No slug asks for the fifth, third and octave (SEASON-2 § 5 item 15).
- Read: code.

**R12. Ear Lab's Beat Hunt asks which of two pairs beats.** `src/features/ear-lab/BeatHuntDrill.tsx:
1-13`: "Two pairs of tones, one in tune with itself and one detuned by the staircase's level in
cents; which pair was beating"; "the beat rate — the difference of the two frequencies — is what
the ear has to find". Near-unison pairs only. Read: code.

**R13. The microphone hears the raw signal.** `src/lib/mic-manager.ts:47-56`: echo cancellation,
noise suppression and automatic gain control are all off, "the raw signal, so the pitch detector
sees the true waveform". A drone from the speakers therefore reaches the detector. Whether the
detector locks onto it was not verified (SEASON-2 § 6.2 item 7). Read: code.

**R14. The kit's hold reader scores time inside ±35 cents of one target** (`src/features/lessons/
kit/hold-take.ts:13-25`, Lesson 22 RESEARCH R17), folded into the target's octave, so "any octave"
holds. It plays nothing during a take today; a drone under the take is new kit work. `?lesson=24`
is not read (`src/lib/lesson-marker.ts:11-19`). Read: code.

### Not used

**R15. Kodály's Bicinia Hungarica.** A search summary of publishers' listings (Boosey & Hawkes;
a library record of the 1968 edition) gives the subtitle "60 progressive two-part songs" and a
retailer's "introduction to elementary two-part singing". Read: search summary only. **Not
verified; not used.** The card's "from the start" was not found in any source.

## Interesting findings

1. **The piano's third is never still.** Above A3 the piano's major third beats almost nine times a
   second, its fifth less than once; only the pure ones stop (R4). A breathing glow at the beat rate
   makes the difference visible. Possible: Step 2's predict.
2. **The formula fits on one line.** Beats = n × the upper note − m × the drone, for the ratio m:n:
   2 × 329.63 − 3 × 220 = −0.745 (R4). Possible: Go deeper.
3. **Singers trade their own accuracy for the harmony's.** In one study, pairs who could hear each
   other sang their own notes less accurately but their harmony more accurately than when each sang
   alone (R7). Possible: the misconception's evidence.
4. **One quintet sang thirds between two tunings.** Their major thirds averaged 392 cents, between
   the pure 386 and the piano's 400, with examples of both (R8). Possible: Step 3.
5. **A vibrato hides the beats.** Sung with vibrato, an out-of-tune interval does not beat (R6), and
   barbershop, which tunes its chords until they "lock and ring", generally avoids vibrato (R9).
   Possible: Step 4, and the reason this lesson's demonstrations are straight tones.
