# Facts: Lesson 4 film, The major scale and home

`claim | source | how it was verified`. The film's facts file. Lesson 4's facts 1 to 65
(`docs/plans/find-your-pitch/lessons/04-major-scale/FACTS.md`, read at `b803c7d43` on main, with
`git show b803c7d43:docs/plans/find-your-pitch/lessons/04-major-scale/FACTS.md`) bind
the film exactly as they bind the page, by the same numbers, and every scoping note there holds
here (above all 23, 26 and 27: "most listeners", only for C major, and only for the tradition the
studies measured). The film adds the facts below, numbered on from 66 so they can join the
lesson's file unchanged when the film's documents move to the docs folder. Every voiced line's
facts are listed beside it in `SCRIPT-DRAFT.md`. Frequencies are f = 440 × 2^((m − 69) / 12) for
MIDI note m, to two decimals, printed by a script run with `python3 -I` on 29 October 2026, which
also checked that every run below climbs 2, 2, 1, 2, 2, 2, 1. The repository root here is checked
out at an older commit (`3962d2f53`, 19 October), from before the plain-language review: its copy
of the lesson's facts differs from `b803c7d43`'s, at 54 among others, so every lesson fact this
file cites is the `b803c7d43` copy's.

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
    | `slide-g`                               | soft tone     | G4 392.00, A4 440.00, B4 493.88, C5 523.25, D5 587.33, E5 659.26, F♯5 739.99, G5 783.99; 0.36 s a note, the last 0.72 s | 3.24 s | 68 |
    | `slide-e`                               | soft tone     | E4 329.63, F♯4 369.99, G♯4 415.30, A4 440.00, B4 493.88, C♯5 554.37, D♯5 622.25, E5 659.26; same lengths | 3.24 s | 68 |
    | `land-c`                                | Merc's ooh    | B4 0.45 s, then C5 1.2 s                                                                             | 1.65 s                         | 58   |
    | `sing-a`                                | Merc's ooh    | the second half of `guide-blue`: D3 E3 F♯3 G3 A3 B3 C♯4 at 0.8 s, C♯4 held 2.0 s, 0.6 s rest, D4 1.2 s | 8.6 s                       | 63   |
    | `sing-b`                                | Tavi's ooh    | the second half of `guide-orange`: D4 E4 F♯4 G4 A4 B4 C♯5 at 0.8 s, C♯5 held 2.0 s, 0.6 s rest, D5 1.2 s | 8.6 s                      | 63   |
    | `count-in`                              | Merc's ooh    | D3 (146.83 Hz), 0.8 s, then 0.2 s of silence: Merc gives the starting note                            | 1.0 s                          | 63   |
    | `your-turn` (a pause)                   | none          | the guide's second half, 8.6 s: the silent sweep up to ti, the hold, the rest and do; room tone only  | 8.6 s                          | 63   |
    | `ti-do` (recap)                         | soft tone     | B4 0.45 s, then C5 1.2 s                                                                             | 1.65 s                         | 58   |

    The soft tone is the films' own (`tone()` in `tools/mix.py`, partials 1, .28, .1, .04, Lesson
    1's), not the page kit's (partials 1, .3, .11, .05, .024, .012): the pitches are the same, the
    colour a little plainer | code; arithmetic. G major needs one black key (F♯) and E major four
    (F♯, G♯, C♯, D♯), as 12 counts them; both spelled one letter a step, as 13 requires. Both
    slides start in middle C's own octave, C4 to B4 (on G4 and E4), as every other staircase
    example does. The
    sing-along is the guide's second half only (63): up to ti, the hold, the rest and home, sung by
    Merc from D3, then by Tavi from D4, then by the viewer; the guide's first half, up to so and
    back, stays on the page. The page counts in with the soft tone at half a tapped note's level
    (63); the film has Merc sing the starting note instead, because a phone speaker loses D3's
    fundamental and the soft tone has little above it: above 300 Hz Merc's sung D3 carries 13.5 dB
    more than the soft tone at half level (−24.9 against −38.4 dBFS RMS, measured on the mixer's
    output on 29 October 2026). Every pitch in this table was measured from the mixer's own output on
    29 October 2026, each note within 5 cents of its frequency
69. The bed: a quiet open fifth on D, D3 146.83, A3 220.00 and D4 293.66 Hz, slow detuned sines
    as Lesson 2's pad in A; only in the act transitions and under the dressed pauses, silent under
    every line, example and sung run (playbook rule 12). It is silent too in the listening
    silences, `hang-c`, `predict-d`, `hang-d`, `wait`, `q3` and `your-turn`, which keep only the
    room tone: after a C scale a pad on D is in the wrong key, and after a D scale it sounds home
    before the landing does. The viewer's starting note comes from the count-in (63) and from
    Merc's and Tavi's runs just before. The title and end stings are Lesson 1's chimes,
    unchanged | `tools/mix.py` (`pad`, `chime`, `NO_BED`); Lesson 2 BRIEF, Audio | code; design

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
75. Not in the film since draft 2: the W and H line ("Books often write the pattern with W and H,
    for whole steps and half steps", 2) was cut for length, and the letters are not on screen, so
    the film keeps one vocabulary, tone and semitone; the page carries W and H (2)
76. "It changes. The white keys climb tone, semitone, tone, tone, tone, semitone, tone"; "the short
    steps fall in different places, and the third and seventh notes come out a semitone low";
    "Keeping the pattern takes two black keys: F sharp and C sharp. That's D major, named after its
    first note." | 9, 10, 11 | carried. The film never names the white-keys scale (11)
77. "Start the pattern on any of the twelve notes, and you get a major scale"; "The shape never
    changes. Only the keys under it change."; "Every start except C needs at least one black key.
    C is just the one that fits the white keys alone." | 8, 12; the staircase is the film's
    diagram, so "the shape" is a claim about the pattern (2), not about how the scales sound |
    carried. On screen, the black keys each start needs: "C 0 · D 2 · G 1 · E 4" (10, 12, 68)
78. "A scale's first note is its tonic: its home"; "Musicians number the notes up from home, one to
    seven: the scale degrees"; the names | 16, 17, 18, 19, 20 | carried. On screen, so carries a
    small "(sol)", as the page notes (20)
79. "In one system, called fixed doh, it is. We'll use movable doh: the names belong to the stairs,
    not the keys."; "Slide to D, and doh is D, ray is E, mee is F sharp."; "Home moves, and the
    names move with it." | 19, 21; LESSON.md, step 4 ("The names belong to the places in the
    scale, not to the keys") | carried. Tavi's "In the opening, doh moved up to D. But isn't doh
    always C?" is a sincere doubt: she heard home move in the cold open, and may know fixed do; she
    is half right, and Merc says so first
80. "Tee is the seventh note, and it sits just a semitone below doh: the last step is a short one";
    "Most listeners hear it waiting for one more note", said over `stop-c-home`, a C major scale |
    22, 23 | carried, and on C only (26). Merc's "Listen: up to tee from C, and stop." brings in
    `stop-c-home` (58) and claims nothing; it opens on "Listen" because no one is singing with the
    viewer yet, so it must not read as a cue to sing
81. The experiment: "In one experiment, listeners heard a C major scale, then one more note, and
    rated how well it finished the scale." "The top rating went to doh. Later studies found the same kind
    of order in listeners without training too, only weaker. So that sense of home seems to be
    learned, just by hearing music." (draft 3 opens the second line "The top rating went to doh.",
    so a muted caption cannot read "Do came out" as the verb) | 23, 23a, 24, 25: K&S 1979's design as its abstract gives
    it, do heading the order; the later studies as Janata 2003 sums them up (p. 4: "more
    pronounced in musicians than non-musicians", and present "in non-expert groups"), not K&S
    1979, whose less musical listeners leaned on pitch height; "seems", as Janata's "suggests"
    allows | carried. On screen the tiers carry no numbers; the experiment is credited
    "Krumhansl & Shepard, 1979", and the later studies "as summed up in Janata et al., 2003",
    since that is the review that sums them up (the studies it cites were not read here, 25)
82. "Tee is called the leading note, because it's thought of as leading to the tonic"; "It leads
    wherever home is. From D, tee is C sharp, and it leans up to D." | 22, 26 | carried, in the
    textbooks' terms only (26). Tavi's "So it sounds finished on doh because we've learned that
    doh is home, and tee stops one short step under it?" answers the cold open's question with the
    page's two reasons and no others (23a, 22); Merc's "That's how it seems" keeps 23a's "seems".
    Tavi's question before the experiment, "But why is doh home, and not tee?", is the page's own
    (23a). On screen her answer is two labels, "learned, it seems" on do and "one short step" on
    ti's gold riser: the first keeps 23a's "seems", which the label must not drop
83. The sing-along's lines: "Let's sing it. Listen first: up to tee, a wait, and home."; Tavi's
    "So on tee, I just wait, and listen for where it wants to go?" (her re-explaining question) and
    Merc's "Yes. Try it, an octave up."; "Now you. Sore, hoarse or unwell today? Just listen
    along."; "Otherwise, sing on doh, ray, mee, or on ooh, at about speaking volume. Start on my
    note, or an octave up."; "Wait on tee, and notice where it wants to go."; "Stop immediately if
    anything feels uncomfortable." | 50, 51, 52, 53, 63; LESSON.md, Sing it | carried. The run is
    the guide's second half (63, 68). Merc's note is D3, Tavi's D4 (52, 63); the film offers no
    Move do, so the two octaves are the choice, which every app preset holds one of (52). The
    house rules pair the stop line with a referral line (TEACHING-PLAYBOOK, house rules; the owner
    waived both "immediately" and the referral for Lessons 1 and 2 only, Lesson 2 DECISIONS 74),
    so with the full stop line the film shows the doctor lines on screen (54 at `b803c7d43`, which
    carries Lesson 3 FACTS 35 whole: the NHS's laryngitis page, reviewed 2024, and the 2018
    hoarseness guideline's key action statement 4B), in small type under
    the stop line, from the first care line to the end of the viewer's turn, carried whole as every lesson
    that sings carries them: "If hoarseness or discomfort lasts more than a couple of weeks, see a
    doctor (a GP or an ear, nose and throat specialist). If it's very painful, or breathing or
    swallowing is hard, get help straight away." They are also in the YouTube description and on
    the page; the vocal coach decides the wording (54)
84. The recap: "What pattern of steps makes a major scale?" "Tone, tone, semitone, tone, tone,
    tone, semitone. Two groups, joined by a tone." (2, 3); "Start a major scale on D.
    Which two black keys does it need?" "F sharp and C sharp." (10); "From tee up to doh: a tone,
    or a semitone?" "A semitone. Tee sits just under home, and most listeners hear it lean up."
    (22, 23, over `ti-do`, on C); Tavi's "And in a major scale that starts on G, which note is
    doh?" "G. Doh is wherever a major scale starts: its home." (9, 19, in movable do, 79; "a major
    scale", since 19's source speaks of major scales) | carried
85. "In MercuryPitch's Scale Runner, sing a major scale back, one note at a time. Set your voice
    range in Settings first, and sing in the octave it plays." On screen, in the order a visitor
    meets them: "Practise it free: mercurypitch.com/pitch-training", "First visit? Skip the
    intro: × › Yes, skip", "Set your range first: Settings › Singing Voice Range", "then
    Exercises › Scale Runner", "sing in the octave it plays" | 34, 35, 36, 37, 38, 39, 40, 41, 88 |
    code, as cited there. "In the octave it plays" because Scale Runner scores a note sung an
    octave away as 1,200 cents off (40), while the sing-along offers either octave (83); "set your
    voice range first" because it plays in the saved range, and a visitor who never set one gets
    the tenor preset, which starts it on E3, below every higher voice's range (41, 44), as the
    page's practice card says (LESSON.md, Practise it). Its ladder shows the notes after the one
    being asked for, at most six (39: `getUpcomingMidi` returns `scaleNotes.slice(noteIndex + 1)`,
    `use-scale-runner-controller.ts:228-231`), and the note being asked for is a dashed line that
    stops at the playhead (`src/components/PitchOverTimeCanvas.tsx:436-447`), so the film draws
    the pitch line past do and on re, and six rungs ahead of it, mi up to do
86. Next time: "Singers are told to "support" a long note." / "If that doesn't mean pushing,
    what keeps it steady?": Lesson 5's hook (31), split between Merc and Tavi, with its quotation
    marks on "support", a word the series uses only in quotation marks | carried
87. The cold open's lines: Tavi's "It just hangs there, waiting. Is that because we started on
    C?" is LESSON.md's, word for word; Merc's "Start on D, and listen. Will it still hang?" is
    LESSON.md's "Start somewhere else, and listen", with the start named and the page's predict
    asked aloud, a 1.5 s hold after it (`predict-d`); Merc's "Still waiting." describes `stop-d`;
    Tavi's "So home moved with the start." is the page's reveal (26), said as her inference from
    `land-d`; her hook question is the title (28) | LESSON.md, Cold open | carried. The cold open
    claims no listening result: it plays two examples and lets them speak (as 26 says of the
    page's reveal)
88. A viewer who types mercurypitch.com/pitch-training on a first visit meets First Light, the
    app's intro, before the Exercises tab; only a link carrying `?lesson=04` skips it. So the
    practise card and the end card add "First visit? Skip the intro: × › Yes, skip", and the
    YouTube description's link carries
    `?lesson=04` | 35a, 35b; at `b803c7d43`: `stepAsideForLesson` returns without stepping aside
    when the address has no valid marker (`src/stores/onboarding-store.ts:310-316`), and
    `src/index.tsx:117` calls it before the render; on its first screen the intro's way out is the
    × button labelled "Skip the intro" (`src/features/onboarding/FirstLight.tsx:740-746`), which
    asks first: "Skip the intro?", with "Keep going" and "Yes, skip"
    (`src/features/onboarding/skip-confirm.tsx:45-52`, asked on that first screen, `:59-63`).
    Settings is a tab of its own (`src/components/AppNavTabs.tsx:385-388`; the tab names are
    "Settings" and "Exercises", `src/features/tabs/constants.ts:365`, `:377`), so a viewer who
    sets the range goes back to Exercises for Scale Runner; where the tab bar runs short of room
    it shows icons only, the name then in the tooltip (`AppNavTabs.tsx:436-450`, `:523-532`), so
    the card draws each tab's own icon beside its name. Whether a phone shows the names was not
    checked in a browser | code
89. The ladder's run starts on G4, a start note the app plays: Scale Runner's setup screen has a
    "Starting Note" dial offering every note of the saved range, and a note picked there is used
    as it is ("a note picked on the dial afterwards is the singer's own choice"); G4 is in every
    preset's range but the bass's (soprano C4 to C6, mezzo-soprano A3 to A5, alto F3 to F5, tenor
    C3 to C5, baritone G2 to G4, bass E2 to E4). With nothing picked it starts on the preset's
    anchor (44) | at `b803c7d43`: the dial (`src/features/exercises/scale-runner/
    ScaleRunnerExercise.tsx:141-146`, `NoteDial` with `notes={getNoteOptions(vocalRangePreset())}`
    and `onChange={setStartNote}`), the comment at `:42-43`; `getNoteOptions` lists every MIDI
    note from the preset's `lowMidi` to its `highMidi` (`src/lib/vocal-range.ts:140-147`, with
    `getComfortableMidiRange`); the ranges in `VOCAL_RANGES` (`src/stores/settings-store.ts:91-152`)
    | code

## Illustrations without claims

- The staircase, its grid of semitone rows and its keyboard strip: the page's diagram (Lesson 4
  FACTS, Illustrations), drawn in the films' style; every white key the same width, with no claim
  about a real piano.
- Tavi's dashed ink-2 staircase with its "?": her belief, not a fact (MASTER-PLAN § 5).
- The experiment's tiers: an illustration of the order in 24, with no numbers.
- The scale guide's rows, names and path: a house-style drawing in the film's colours,
  labelled as a guide; on the viewer's turn, plain chrome. Nothing listens, and no line on it is
  the viewer's.
- Scale Runner's ladder: a house-style drawing of the notes still to come ahead of a pitch line
  (39), in the film's colours rather than the app's green, labelled "Illustration", never a
  screenshot passed off as the app. Its run starts on G4, a start the app offers (89).
- The house glyph labels home (17); it is not a claim.
