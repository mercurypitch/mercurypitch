# Research: Lesson 26, A second voice

Every "Facts to check" item on the Lesson 26 card (SEASON-2 § 3), resolved, and every other claim
the article plan makes. App claims were read at `b803c7d43`; web sources on 30 October 2026.

## Where the sources and the card disagree (read first)

1. **The card's checkpoint cannot be scored with today's kit.** The kit's note reader reads one
   sung reply per take ("one sung note against Merc's", `kit/take.ts:1-30`), not a five-note line
   sung in time against a part the page is playing. The checkpoint needs a line reader, the
   two-voice scheduler (SEASON-2 § 6.2 item 5) and headphones (item 7); the role swap needs
   nothing more. The plan says what works today: an unscored sing-along with headphones, and a
   turn-taking version that plays the take back with the tune, once a take can be recorded on the
   page (the lesson kit has no recorder; the app has one, R10).
2. **"Passing note" is the series' British term; Open Music Theory says "passing tone"** (R5). No
   British source was read for the term in this pass; the plan names both, as Lesson 4 named
   "leading note" and "leading tone".
3. **The card's misconception example holds and is the app's own example** (R8): a fixed four
   semitones over re in C gives F♯; the key's third is F.

## Claims

### Thirds inside a key

**R1. In a major key, each third between scale notes is major or minor by where it falls: C–E, F–A
and G–B are major; the others are minor.**
- Source: Gotham, M. et al. Open Music Theory, 2nd ed., § 1.15 "Intervals", § Another Method for
  Intervals: The White-Key Method (LibreTexts edition):
  "All of the thirds are minor except for three: C–E, F–A, and G–B, which are major."
- Read: in full (for Lesson 23). Strength: Strong. Arithmetic: in C major, thirds up from each
  degree: C–E 4, D–F 3, E–G 3, F–A 4, G–B 4, A–C 3, B–D 3. In any major key the pattern is the
  same by degree: major on do, fa and so; minor on re, mi, la and ti.

**R2. Thirds are consonances ("imperfect consonances", with sixths).** OMT 2e § 2.01 "Introduction
to Species Counterpoint", § Consonance and dissonance: "Imperfect consonances (major and minor
thirds and sixths)". Read: in full (for Lesson 23). Strength: Strong. Used to say why a line a
third away sounds like harmony, not a clash.

**R3. A harmony a third above a tune, kept in the key, mixes three- and four-semitone thirds.**
Arithmetic on R1, for "Twinkle" in C (Lesson 6's tune, C C G G A A G, F F E E D D C): a third above
is E E B B C C B, A A G G F F E. Its thirds: C–E 4, G–B 4, A–C 3, G–B 4, F–A 4, E–G 3, D–F 3, C–E 4.
A fixed four semitones instead gives E, B, C♯, B, A, G♯, F♯, E: three notes outside C major (C♯,
G♯, F♯). Strength: Strong (arithmetic). The tune is public domain in the UK and US (Lesson 6 FACTS
28-29); a harmony line written for the lesson is the lesson's own.

**R4. The checkpoint's lines.** Tune do re mi re do (C D E D C). A third above, in the key: mi fa so
fa mi (E F G F E), thirds 4, 3, 3, 3, 4. A third below: la ti do ti la (A B C B A, below the tune),
thirds 3, 3, 4, 3, 3. Arithmetic on R1. Strength: Strong.

### Chord tones and passing notes (T23, light)

**R5. A passing note moves by step between two notes, in one direction, and usually does not belong
to the chord under it.**
- Source: OMT 2e § 4.04 "Embellishing Tones" (LibreTexts edition): "an embellishing tone is the
  middle note of a three-note gesture in which the first and last notes are consonant with the
  bass"; "In almost all cases, however, the embellishing tone is a note that doesn't belong to the
  underlying chord"; "Passing tones are approached by step and left by step in the same direction,
  either ascending or descending"; "Neighbor tones are approached by step and left by step in the
  opposite direction".
- Read: in full. Strength: Strong. Use: over a C major chord, mi fa so: fa passes between two chord
  notes, E and G; in the tune do re mi, re passes between C and E. The benchmark's musictheory.net
  and Hooktheory II ch. 3 for T23 were not re-read.

### Singing against another part

**R6. Singing a different part is harder, but listening keeps the harmony.** Dai & Dixon (2019),
JASA 145(2), 663-675, read in full for Lesson 24 (its RESEARCH R7): "(1) singing with the same vocal
part is more accurate than singing with a different vocal part"; "(3) ... singers adjust pitch to
mitigate a partner's error and preserve harmonic intervals" (p. 663); the duet condition had "less
harmonic interval error than the solo condition" (p. 670). Strength: Weak to Moderate (16 singers).

**R7. Lessons this one stands on.** Lesson 6: "Twinkle" and its intervals (lessons/06-intervals/
LESSON.md). Lesson 10: major and minor thirds, 4 and 3 semitones. Lesson 12: a key's chords are
built from its own notes, the chord on re is ii, minor, D F A (lessons/12-chords-four-chord-song/
LESSON.md, Step 1 and quick check 2). Lesson 24: holding a note against a drone. Read: the packages.

### The app (read at `b803c7d43`)

**R8. The app's harmony code walks the key, not a fixed interval.** `src/lib/jam/jam-modes.ts:
100-107`: "Diatonic on purpose: a fixed +4/+7 semitones would put a major chord on every degree of
the scale, so a run up C major would harmonise the second degree as D-F#-A and leave the key.
Walking the scale's own pitch classes gives D-F-A, which is the chord that belongs there."
`diatonicStepUp` (:108-130) steps up by scale degrees; for a chromatic note it falls back to +4 or
+7 (:119). Read: code.

**R9. Jam's Harmony Stack needs two or more people.** `jam-modes.ts:45-51`: "One voice per chord
tone — root, third, fifth. Build the chord.", roles Root, Third, Fifth, `minPeers: 2`. Drone
Intonation's thirds slug (`slug-map.ts:75-81`) is a solo practice on thirds above a drone (Lesson 24
RESEARCH R11). No drill plays a melody and scores a harmony line sung with it (SEASON-2 § 5 item
17). `?lesson=26` is not read (`lesson-marker.ts:11-19`). Read: code.

**R10. The page has no recorder; the app does.** The lessons kit reads one sung note per take
(`src/features/lessons/kit/take.ts:1-30`: "one sung note against Merc's"; "The first 0.3 s after
voicing starts is the attack"; "A take with less than 0.6 s of voice left is not steady") and no
kit file uses `MediaRecorder`; the app captures voice in `src/lib/voice-capture.ts` and Karaoke's
`src/lib/use-karaoke-voice-capture-controller.ts` (repository search). Read: code. A five-note line
reader and a recorded take played back with the tune are new kit work.

**R11. The microphone hears the page.** `src/lib/mic-manager.ts:47-56` (Lesson 24 RESEARCH R13).
A tune the page plays during a take reaches the detector without headphones; for a harmony a third
away the detector may lock onto the louder line. Not verified (SEASON-2 § 6.2 item 7).

## Interesting findings

1. **The app already knows the lesson.** Jam's harmony code says a fixed four semitones "would
   harmonise the second degree as D-F#-A and leave the key", and walks the scale instead (R8).
   Possible: Step 2's evidence.
2. **Half of "Twinkle"'s thirds are not the same size.** Copied a third higher in C, three of its
   eight thirds are minor and five major (R3). Possible: Step 2's Notice.
3. **A fixed shift leaves the key three times in one line.** Moved up four semitones everywhere,
   "Twinkle" picks up C♯, G♯ and F♯, three notes C major does not have (R3). Possible: the
   misconception's demonstration.
4. **The passing note is everywhere.** In the tune do re mi, re passes between two chord notes; in
   the harmony mi fa so, so does fa (R5). Possible: Step 4.
5. **The harmony you hear in a duet is a trade.** Singers who heard each other let their own notes
   drift a little to keep the interval between them (R6). Possible: wrap line.
