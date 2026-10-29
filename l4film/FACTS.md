# Facts: Lesson 4 film, The major scale and home

`claim | source | how it was verified`. The film's facts file. Lesson 4's facts 1 to 65
(`docs/plans/find-your-pitch/lessons/04-major-scale/FACTS.md`, read at `b803c7d43` on main) bind
the film exactly as they bind the page, by the same numbers, and every scoping note there holds
here (above all 23, 26 and 27: "most listeners", only for C major, and only for the tradition the
studies measured). The film adds the facts below, numbered on from 66 so they can join the
lesson's file unchanged when the film's documents move to the docs folder. Every voiced line's
facts are listed beside it in `SCRIPT-DRAFT.md`. Frequencies are f = 440 × 2^((m − 69) / 12) for
MIDI note m, to two decimals, printed by a script run with `python3 -I` on 29 October 2026, which
also checked that every run below climbs 2, 2, 1, 2, 2, 2, 1.

## The voice and the sung runs

66. The voice lines spell solfège for the voice: doh, ray, mee, fah, soh, lah, tee. Captions and
    the picture write do, re, mi, fa, so, la, ti, as the page does (20) | `script.json`; the
    caption map in `tools/captions.py` | design. Kokoro's phonemes for the spellings, checked on
    29 October 2026: /dəʊ/, /ɹeɪ/, /miː/, /fɑː/, /səʊ/, /lɑː/, /tiː/
67. Merc's and Tavi's sung runs are the synthesised "ooh" of the app's demo voice: partials 1,
    .62, .38, .24, .14, .08, .045, .025 under a 2,600 Hz roll-off, attack 0.09 s, release 0.18 s,
    a 5.5 Hz vibrato of ±14 cents grown in over 0.35 s, each note its own envelope; Tavi's runs
    are the same timbre | `tools/mix.py` (`voice_tone`, carried from Lessons 1 and 2: Lesson 2
    FACTS 50); the page's sound module uses the same partials, lowpass and vibrato (the paragraph
    above 56) | code. No Echo samples are used: they hold single notes (A3, A4), and every sung
    note here belongs to a run
68. The film's sounds, at their exact pitches. Where a sound repeats one of the page's, it is the
    page's fact:

    | Sound                                   | Voice or tone | Notes                                                                                                 | Length                         | Fact |
    | --------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------ | ---- |
    | `stop-c` (cold open; act 3 as `stop-c-home`) | Merc's ooh    | C4 to B4 up the major pattern, 0.45 s a note, B4 held 1.2 s                                          | 3.9 s                          | 58   |
    | `stop-d`                                | Tavi's ooh    | D4 to C♯5, 0.45 s a note, C♯5 held 1.2 s, the octave of `stop-c`                                      | 3.9 s                          | 59   |
    | `land-d`                                | Tavi's ooh    | C♯5 0.45 s, then D5 1.2 s                                                                            | 1.65 s                         | 59   |
    | `scale-c`                               | soft tone     | C4 to C5, 0.45 s a note, the last 0.9 s                                                              | 4.05 s                         | 57   |
    | `steps-c`                               | soft tone     | C4 to C5, 0.8 s a note, the last 1.2 s (261.63 to 523.25 Hz)                                         | 6.8 s                          | 68   |
    | `group-low`, `group-high`               | soft tone     | C4 D4 E4 F4, and G4 A4 B4 C5, 0.45 s a note, the last 0.9 s, as the page's Group brackets            | 2.25 s each                    | 65   |
    | `white-d`, `major-d`                    | soft tone     | D4 E4 F4 G4 A4 B4 C5 D5, and D4 E4 F♯4 G4 A4 B4 C♯5 D5, 0.45 s a note, the last 0.9 s               | 4.05 s each                    | 60   |
    | `slide-g`                               | soft tone     | G3 196.00, A3 220.00, B3 246.94, C4 261.63, D4 293.66, E4 329.63, F♯4 369.99, G4 392.00; 0.36 s a note, the last 0.72 s | 3.24 s | 68 |
    | `slide-e`                               | soft tone     | E4 329.63, F♯4 369.99, G♯4 415.30, A4 440.00, B4 493.88, C♯5 554.37, D♯5 622.25, E5 659.26; same lengths | 3.24 s | 68 |
    | `land-c`                                | Merc's ooh    | B4 0.45 s, then C5 1.2 s                                                                             | 1.65 s                         | 58   |
    | `sing-a`                                | Merc's ooh    | the first half of `guide-blue`: D3 E3 F♯3 G3 A3 G3 F♯3 E3 D3, 0.8 s a note, the last 1.2 s          | 7.6 s                          | 63   |
    | `sing-b`                                | Tavi's ooh    | the second half of `guide-orange`: D4 E4 F♯4 G4 A4 B4 C♯5 at 0.8 s, C♯5 held 2.0 s, 0.6 s rest, D5 1.2 s | 8.6 s                      | 63   |
    | `count-in`                              | soft tone     | D3 (146.83 Hz) at half a tapped note's level, 0.8 s, then 0.2 s of silence                            | 1.0 s                          | 63   |
    | `your-turn` (a pause)                   | none          | the guide's 18.2 s: the silent sweep, the bed under it                                                | 18.2 s                         | 63   |
    | `ti-do` (recap)                         | soft tone     | B4 0.45 s, then C5 1.2 s                                                                             | 1.65 s                         | 58   |

    The soft tone is the films' own (`tone()` in `tools/mix.py`, partials 1, .28, .1, .04, Lesson
    1's), not the page kit's (partials 1, .3, .11, .05, .024, .012): the pitches are the same, the
    colour a little plainer | code; arithmetic. G major needs one black key (F♯) and E major four
    (F♯, G♯, C♯, D♯), as 12 counts them; both spelled one letter a step, as 13 requires
69. The bed: a quiet open fifth on D, D3 146.83, A3 220.00 and D4 293.66 Hz, slow detuned sines
    as Lesson 2's pad in A; only in the act transitions and under the dressed pauses, silent under
    every line, example and sung run (playbook rule 12); under the your-turn pause it gives the
    starting note, D3 or D4 (52). The title and end stings are Lesson 1's chimes, unchanged |
    `tools/mix.py` (`pad`, `chime`); Lesson 2 BRIEF, Audio | code; design

## Lines the lesson's facts do not already word

70. The recall: "How many semitones make an octave?" and "Twelve. Seven letters, and five notes
    between them." | Lesson 2's quick-check question 1 (`l02-q1`) and its feedback, which the page
    asks again (30); Lesson 2 FACTS 1, 13 and 15 | carried
71. "A major scale climbs that octave in just seven steps": eight notes, do to do, seven steps,
    twelve semitones | 1, 2 and 4 | arithmetic. Tavi's answer, "Then some steps must be bigger
    than others?", is her guess, which the measuring then shows (2, 6)
72. "With a black key in between, it's a tone"; "with no black key in between, like E to F, it's
    a semitone" (Tavi's guess, which Merc confirms) | 6; Lesson 2 FACTS 14; LESSON.md, step 1 |
    carried
73. "Both halves climb the same way: tone, tone, semitone. One more tone joins them" | 3 | carried
74. "Seven steps that add up to twelve semitones: one octave"; Tavi's "Is that why it ends on C
    again, an octave up?" | 4 | arithmetic
75. "Books often write the pattern with W and H, for whole steps and half steps" | 2 | carried
76. "It changes. The white keys climb tone, semitone, tone, tone, tone, semitone, tone"; "the short
    steps fall in different places, and the third and seventh notes come out a semitone low";
    "Keeping the pattern takes two black keys: F sharp and C sharp. That's D major, named after its
    first note." | 9, 10, 11 | carried. The film never names the white-keys scale (11)
77. "Start the pattern on any of the twelve notes, and you get a major scale"; "The shape never
    changes. Only the keys under it do."; "Every start except C needs at least one black key. C is
    just the one that fits the white keys alone." | 8, 12; the staircase is the film's diagram, so
    "the shape" is a claim about the pattern (2), not about how the scales sound | carried
78. "A scale's first note is its tonic: its home"; "Musicians number the notes up from home, one to
    seven: the scale degrees"; the names | 16, 17, 18, 19, 20 | carried. On screen, so carries a
    small "(sol)", as the page notes (20)
79. "In one system, called fixed doh, it is. We'll use movable doh: the names belong to the stairs,
    not the keys."; "Slide to D, and doh is D, ray is E, mee is F sharp."; "Home moves, and the
    names move with it." | 19, 21; LESSON.md, step 4 ("The names belong to the places in the
    scale, not to the keys") | carried. Tavi's "So doh is always C?" is half right, and Merc says
    so first
80. "Tee is the seventh note, and it sits just a semitone below doh: the last step is a short one";
    "Most listeners hear it waiting for one more note", said over `stop-c-home`, a C major scale |
    22, 23 | carried, and on C only (26)
81. The experiment: "In one experiment, listeners heard a C major scale, then one more note, and
    rated how well it finished the scale. Doh came out on top. Trained musicians show the order
    most sharply, but listeners without training show it too, so that sense of home seems to be
    learned, just by hearing music." | 23a, 24, 25: K&S 1979's design as its abstract gives it, do
    heading the order; the order clearest for musical listeners (K&S 1979) and "more pronounced in
    musicians than non-musicians", yet present "in non-expert groups" (Janata 2003, p. 4); "seems",
    as Janata's "suggests" allows | carried. On screen the tiers carry no numbers, and the credit
    reads "Krumhansl & Shepard, 1979"
82. "Tee is called the leading note, because it's thought of as leading to the tonic"; "It leads
    wherever home is. From D, tee is C sharp, and it leans up to D." | 22, 26 | carried, in the
    textbooks' terms only (26). Tavi's "So tee always sits a semitone under home, wherever the
    scale starts?" rests on 2 and 22, and Merc's "Always: the pattern's last step is a semitone"
    on 2
83. The sing-along's lines: "Sore, hoarse or unwell today? Just listen along."; "sing on doh, ray,
    mee, or on ooh, at about speaking volume"; "Start on my note, or an octave up."; "When you stop
    on tee, wait a moment, and notice where it wants to go."; "Stop immediately if anything feels
    uncomfortable." | 50, 51, 52, 53; LESSON.md, Sing it | carried. Merc's note is D3, Tavi's D4
    (52, 63); the film offers no Move do, so the two octaves are the choice, which every app preset
    holds one of (52). The doctor lines (54) are in the YouTube description and on the page, not in
    the voice
84. The recap: "What pattern of steps makes a major scale?" (2, 3); "Start a major scale on D.
    Which two black keys does it need?" "F sharp and C sharp." (10); "From tee up to doh: a tone,
    or a semitone?" "A semitone. Tee sits just under home, and most listeners hear it lean up."
    (22, 23, over `ti-do`, on C); Tavi's "And in a scale that starts on G, which note is doh?"
    "G. Doh is wherever the scale starts: its home." (9, 19, in movable do, 79) | carried
85. "In MercuryPitch's Scale Runner, sing a major scale back, one note at a time." On screen:
    "Practise it free: mercurypitch.com/pitch-training", "then tap Scale Runner" | 34, 35, 36, 37,
    38 | code, as cited there
86. Next time: "Singers are told to support a long note." / "If that doesn't mean pushing, what
    keeps it steady?": Lesson 5's hook (31), split between Merc and Tavi | carried
87. The cold open's lines: Tavi's "It just hangs there, waiting. Is that because we started on
    C?" and Merc's "Start somewhere else, and listen." are LESSON.md's, word for word; Merc's
    "Still waiting." describes `stop-d`; Tavi's "Home." names the series word (17) as she hears
    `land-d` land; her hook question is the title (28) | LESSON.md, Cold open | carried. The cold
    open claims no listening result: it plays two examples and lets them speak (as 26 says of the
    page's reveal)

## Illustrations without claims

- The staircase, its grid of semitone rows and its keyboard strip: the page's diagram (Lesson 4
  FACTS, Illustrations), drawn in the films' style; every white key the same width, with no claim
  about a real piano.
- Tavi's dashed ink-2 staircase with its "?": her belief, not a fact (MASTER-PLAN § 5).
- The experiment's tiers: an illustration of the order in 24, with no numbers.
- The scale guide's rows, names and path: a house-style drawing in the app's canvas colours,
  labelled as a guide; on the viewer's turn, plain chrome. Nothing listens, and no line on it is
  the viewer's.
- Scale Runner's ladder: a house-style drawing of the notes still to come ahead of a pitch line
  (39), labelled "Illustration", never a screenshot passed off as the app.
- The house glyph labels home (17); it is not a claim.
