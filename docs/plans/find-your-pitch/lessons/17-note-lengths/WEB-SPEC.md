# Lesson 17 web page: spec

The Lesson 17 page is the web lesson for "How long is a note?": written steps, one main toy in five
step states with a compact state for the hero and free play, one predict, the four words, a
checkpoint in two parts (a tap take that times the learner's taps against a written rhythm, then an
optional sung version that nothing listens to or scores), two quizzes (the recall and the quick
check) and the lesson explorer. Copy is in [LESSON.md](LESSON.md); every claim is in
[FACTS.md](FACTS.md). It is a text-only package: no film exists for Lesson 17, so the page has no
Watch section and the masthead's anchors are Lesson, Tap it and Explorer.

It is built on the kit (`src/features/lessons/kit/`) as Season 2's kit PR leaves it (SEASON-2 § 8.2
item 1): the season structure, the staff toy with both clefs, rhythm on the staff and the lesson
plumbing. Like every lesson page it reuses and never copies: a part that lives in an earlier lesson's
module moves into the kit first. Most of what it reuses is Lesson 8's: the beat clock, the beat row,
the tap pad, the take's lining-up and its judge, the comfort check, the voice choice, the feelings
and the rest card (Lesson 8 WEB-SPEC, Toys 1, 5 and 6). Its click is the Ear Lab's woodblock, the
one The Chart and Pulse sound by default (Audio). Where this page shares a behaviour with Lesson 8's
checkpoint, it is Lesson 8's, unchanged unless this spec says otherwise.

One object carries the lesson: Lesson 8's row of beat pads, which this page writes down. In the hero
the four pads sound four quarter notes, which are written on a line as they sound. In Step 1 a beat
halves into eighths and sixteenths, and beats join into half and whole notes; in Step 2 the same
written bar plays at a tempo the learner sets; in Step 3 its counts light under it; in Step 4 a beat
turns into a rest; in Step 5 the bars lift onto the five-line staff, where a dot and a tie lengthen a
note. The checkpoint reads a two-bar rhythm on the same line. It is the card's signature: "Lesson 8's
beat pads; each pad grows a notehead and a stem; halving a pad makes two eighths, which a beam joins;
joining two makes a half note; the row lifts onto one line ... and then onto the five-line staff, on
one pitch" (FACTS 4).

Its public home is `mercurypitch.com/learn/17` (SEASON-2 § 7 item 1): a hand-written document
`learn/17.html` with its module in `src/features/lessons/lesson-17/`, wired as Lesson 8's page is. It
joins `kit/drafts.ts` in its first commit, held back on mercurypitch.com until the vocal coach has
looked at the sung part and the console publishes it, and it publishes only after `/learn/08` is
live, because its prerequisite chip and its recall link there (FACTS 2, 7). The next-lesson card on
Lesson 16's page draws this lesson's tease above its hook from the season data, and this page's card
draws Lesson 18's; neither is written into a page's markup (FACTS 5, 5b).

## The checkpoint: how it takes input

The card's checkpoint is "tap a two-bar rhythm read from the page over the click, and the page shows
each tap against its note. Optional and unscored: after the comfort check, sing it on one comfortable
note" (SEASON-2 § 3, Lesson 17). The page takes the first part as **taps** and judges their timing,
and the second as an **unscored sing-along**, so nothing on the page listens.

- **Why taps.** A page hears a clap only through the microphone, and this page opens none; a tap is
  an input event it can time exactly, by the rule the Ear Lab's rhythm drills and Lesson 8's pad
  share (FACTS 31).
- **What is measured.** Each tap's time is its event's own timestamp on the page's clock; each beat's
  time is where the audio clock put it, mapped to the page's clock as Lesson 8's beat clock maps it
  (`src/features/lessons/kit/beat-clock.ts:18-24`). The delays no browser reports, the rest of the
  output path and the touch, are taken out by lining up: two bars of tapping every beat come first,
  and Drum Night's estimator, bounded at 0 to 250 ms and needing five taps, takes their median
  offset from every later tap, as Lesson 8's take does (FACTS 32).
- **Why not anchor on the first tap**, as The Chart and Pulse do. Anchoring sets the whole grid from
  one tap: an early or late first tap moves every other note's verdict, and the first note can never
  be early or late. Lining up sets it from eight taps, outliers set aside, and keeps every note's
  timing measurable. The Ear Lab also subtracts the round trip Settings measures, which a lesson page
  does not have; Lesson 8's lining-up needs none (FACTS 32, 40).
- **The window and the judge.** A lined-up tap meets a note within 120 ms of its start,
  `TOLERANCE_MS.quarters`, as in Lesson 8's take; at 60 BPM an eighth is 500 ms from its neighbour,
  so the window stays under half of that, the Ear Lab's own rule for its windows. The taps are
  matched to the notes by the Ear Lab's judge, `judgeTake`, imported, never copied (FACTS 33).
- **What the page says, and what it draws.** The judge reports, for each note, whether a tap met it
  and how early or late that tap was, and it lists the taps that met no note. The line says what it
  can say plainly: how many of the nine notes got a tap, where a tap fell between notes when that
  place is the half note's held beat, whether the notes on ‘and’ got none, and how many other taps
  fell between notes. Early and late are drawn, not said: each lined-up tap is a tick at the point
  where it fell, before or after its note, measured against the beat the learner's own taps set, not
  against the sound. The strip is hidden from a screen reader and the line speaks for it, so every
  learner gets the counts (FACTS 34). This is the lead's question 3: the ledger can report early or
  late per tap, but only against a reference, and here that reference is the learner's own beat.
- **The sung part** has a guide and no score: Merc sings the two bars on one note, the guide counts
  in and lights each note, and the learner sings along. The page never calls `getUserMedia`
  (FACTS 60).
- **Audio on the audio clock.** Every click, note and clap is started, and every timed note stopped,
  at a time on the AudioContext's clock through the beat clock; nothing is started or stopped by a
  timer (Audio).

## Look

Lesson 8's look, unchanged: the dark listening room, the series colour code, Lesson 1's type and
wordmark, and the motion rules (Lesson 8 WEB-SPEC, Look). On this page:

- **Notation** is drawn in ink `#e6edf3` on chrome lines `#c3ccd6`: noteheads, stems, flags, beams,
  rests, dots, ties and the time signature. A note lights in its singer's colour while it sounds,
  blue `#58a6ff` for Merc and orange `#ff7448` for Tavi, by the voice that plays it (FACTS 10).
- **Gold** `#ffd84d` marks only the fit: in the checkpoint, a tick whose tap met its note. Nothing
  else on the page is gold (MASTER-PLAN § 5; playbook rule 11).
- **Rests and silences** are dashed ink-2 `#a8b3bf` in the stopwatch strip and in the pitch-line view,
  so a silence is never mistaken for a short note.
- **The pitch-line view** (the rhythm bar's "See it on the pitch line" switch, in every step and in
  free play, SEASON-2 § 1.4 item 1; Toys 1 says which toys have none, and why) is Season 1's
  picture: time left to right, pitch up, each note a band as long as it sounds, at its pitch, in the
  app's amber, the colour of Merc's model note on a pitch canvas; no violet, since no line of the
  learner's is drawn.
- **No decorative staves or clefs** anywhere on the page: in a season that teaches the staff, a staff
  is always music (SEASON-2 § 1.5 item 7 and § 6.1 item 8). The kit's engraved decorative clef
  (`engraveClefs`, `src/features/lessons/kit/page-chrome.ts:166-175`) is left off this page.
- **Nothing is in tune or out of it**, and nothing is scored, so the page uses no target band, no
  singer violet and no mint.

What moves: Merc and Tavi's idle loops; while something the learner started plays, the lit beat, the
notes being written and the strip's readings. A note is written as it sounds: it fades in over 0.12
s at its start, and its strip cell fills over its length. Under `prefers-reduced-motion`, or with
the masthead's Pause animations on, Merc and Tavi stop, each note appears at once at its start, and
each strip cell shows its reading at once when the note ends; what the learner starts still sounds
(WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the practice
card sits in the Wrap. No Watch section. The page opens in Lesson 2's order: the hook, the stage, the
sound gate and the cold open's predict, then the recall (FACTS 5a). Items 2 to 5 are the hero, laid
out as Lesson 8's: two columns above 1080 px, one column at 1080 px and below in the order listed,
with the promise after the predict. Each section's heading, and the line above it, are in LESSON.md
("Section headings").

1. **Masthead**: Season 2's (What the kit and the app still need, item 1), "Season 2 · Lesson 17",
   anchors Lesson, Tap it and Explorer, the Sound toggle off by default, Pause animations.
2. **The hook**: the kicker, the hook question as the title (`h1.hook#hook`), the meta as four chips
   ("16 minutes"; "After Lesson 8: Beat, tempo and the backbeat", a link; "Also useful: Lesson 15, The
   staff", a plain chip; Sound on) and the promise (FACTS 2, 3).
3. **The stage**: Tavi's and Merc's bubbles over Merc and Tavi on the floor line, the compact pads
   between them (Toys 2), and under them the two plays: "Play the bar at 60 BPM", which works from
   the start (`data-free`), and "Play the bar at 120 BPM", locked until a choice (Toys 3).
4. **The sound gate**: LESSON.md's line and its button, between the stage and the predict at 1080
   px and below.
5. **The cold open's predict**: the predict card, `#predict`, under the stage: LESSON.md's predict,
   its two choices, the lock hint and the reveal (Toys 3).
6. **Recall from Lesson 8**, `section#recall`, straight after the hero: Lesson 8's questions 2 and 4,
   open to everyone; neither says how long a beat lasts, so reading on before the predict's choice
   gives nothing away (Toys 9; FACTS 1a).
7. **Four words you'll meet**: note value, rest, dot and tie, each with its definition, a play
   button and its rhythm written as it plays (Toys 4).
8. **The steps**: the kit's sticky stage and step deck ("N of 5", Previous and Next), every step on
   the one object (Toys 1), in five states (Toys 5), with Step 3's Go deeper drawer (Toys 10).
9. **Tap it, then sing it**, `#sing`: the tap take, then the comfort check, the voice choice, Merc's
   bars, the guide, Move the note and the feeling question (Toys 7).
10. **Quick check**: LESSON.md's four questions (Toys 9).
11. **Wrap**: the three recap lines, the challenge, the practice card in the version the sung part's
    ending picks (Practice links), the next lesson's card with its still (Toys 11) and free play
    (Toys 8). Both drill links open in a new tab.
12. **Lesson explorer**: the kit's, with Lesson 17 as the current node, on Season 2's tab (Explorer
    and season data).
13. **Footer**: Lesson 1's, with "Season 2 · Lesson 17 · How long is a note?", the practice link
    printed `mercurypitch.com/ear-lab` and linked `/ear-lab?lesson=17`, "The Chart and Pulse are
    free.", Lesson 1's fonts line and "Every sound on this page is synthesised in your browser"; the
    legal links, as every lesson document closes.

## Length

The learner copy is 2,309 words on `scripts/lesson-words.mjs`, every branch counted, under the
series' cap of 2,379 by 70 (FACTS 3). The page runs about 16 minutes: 9.70 minutes of reading at 238
words a minute and about 5.9 of sound, toys and tasks. That is past MASTER-PLAN § 4.2's budget, "8 to
12 minutes of active time, 500 to 900 words", as every Season 1 page from Lesson 3 is. The chip's
figure is an estimate until the staff toy and the rhythm toy are timed in their labs, as SEASON-2
§ 1.3 asks; the chip is then set from the lab. Each step's own text, with its Try and its Notice,
runs 107 to 120 words (Steps 1 to 5: 118, 120, 119, 107 and 110), inside § 4.2's 50 to 120 a step.
Three parts carry more beside it:

- **Step 2, 227 words with its mix-up card**, which sits in the step whose toy refutes it.
- **Step 3, 198 words with its Go deeper drawer** (two items), closed by default. The article plan's
  third item, on which counting system works best, was cut for length (FACTS 25).
- **The checkpoint, 516 words.** It holds two parts, the taps and the optional sung bars, and
  the series' singing lines, Lesson 8's word for word and not cut.

The hints and status lines are stage directions in LESSON.md and are not counted, as in the text
packages of Lessons 9 to 14. A built page writes them in the open and counts them, about 150 words
more (Lesson 8 FACTS 4), so as it stands the built page would be about 2,460 words, some 80 over the
cap, with the chip still at 16 minutes. Before the build, two cuts of about 100 words bring it back
under: the Go deeper drawer (70 words; its two items stay in FACTS 23 and 24), and the mix-up card's
second piece of evidence with its Play both (32 words), while Step 2's toy keeps Play both.

## Toys: what each reuses, and what is new

| Toy                        | Reuses                                                                                                                                                                                                                                                      | New in Lesson 17                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. The rhythm bar          | Lesson 8's beat row and beat clock (`kit/beat-machine.ts`, `kit/beat-clock.ts`); the kit's notes on the audio clock (`kit/sound-ahead.ts`); the Ear Lab's woodblock click (`click-synth.ts`); Season 2's rhythm on the staff and staff toy (SEASON-2 § 6.2) | The rhythm model (notes, rests, dots, ties); Play the halvings; Halve and Join; Note · Rest; Count; Tempo and Play both; the stopwatch strip; the pitch-line view; Dot, Tie and Clef |
| 2. The hero's compact pads | Lesson 8's compact strip (`kit/beat-strip.ts`)                                                                                                                                                                                                              | A line above the pads and a strip under them, written as the bar plays                                                                                                               |
| 3. Predict widget          | The kit's predict (`kit/predict.ts`), with a free play before the choice                                                                                                                                                                                    | Nothing                                                                                                                                                                              |
| 4. Four words              | The kit's words strip (`kit/words-strip.ts`)                                                                                                                                                                                                                | Four rhythm figures, written as they play                                                                                                                                            |
| 5. Step states             | The kit's step deck and stage fit                                                                                                                                                                                                                           | Five states of the rhythm bar                                                                                                                                                        |
| 6. The stopwatch strip     | Nothing                                                                                                                                                                                                                                                     | All of it, a kit part under rhythm on the staff (SEASON-2 § 6.2 item 3)                                                                                                              |
| 7. The checkpoint          | Lesson 8's take (its pad, lining-up, judge and strip ticks), comfort check, voice choice, feelings and rest card; Move do's step and reach (`kit/move-do.ts`)                                                                                               | The take generalised to any written rhythm, moved into the kit; its lines; the sung bars and their guide                                                                             |
| 8. Free play               | Toy 1 in a card, as Lesson 8's free play: one bar of pads, and Step 5's staff                                                                                                                                                                               | Nothing beyond Toy 1                                                                                                                                                                 |
| 9. Recall and quick check  | The kit's quiz (`kit/quiz.ts`); Lesson 8's question objects and its quiz play, imported                                                                                                                                                                     | Question 4's play                                                                                                                                                                    |
| 10. Go deeper drawer       | Lesson 2's `details` drawer                                                                                                                                                                                                                                 | Two items                                                                                                                                                                            |
| 11. Tease still            | The kit's next-lesson card and its slot (`kit/next-card.ts`)                                                                                                                                                                                                | Two bars on the staff over a beat grid                                                                                                                                               |

### 1. The rhythm bar

One component, the kit's rhythm bar, new with this page and generic over its bars, so Lessons 18 and
19 can draw theirs with it (What the kit and the app still need, item 3). It draws in SVG, with real
buttons laid over it for anything the learner can press, and sounds through the beat clock.

- **The model** (pure, unit-tested): a bar of 4/4 as a list of symbols, each a note or a rest with a
  value (4, 2, 1, 0.5 or 0.25 beats), a dot (adding half) and, for a note, a tie to the next note.
  The values always add up to the bar's four beats, and every figure the rhythm bar plays is whole
  bars, Play both's rows included, save two kinds: the half-rest and whole-rest examples end on the
  next bar's first note, so their silence is heard between two notes, and the four words' tickets are
  short figures with no bar line (Toys 4). A tie
  joins two notes into one sound, even across a bar line, and two bars can be one figure. A beat made
  silent keeps its notes in the model, so it can turn back. From the model come the drawing, the hits
  the beat clock books, the strip's readings and the counts.
- **The writing** follows the Ear Lab's notation maths wherever it applies, since it is pure and the
  season plans to share it (`readRhythm` and `beamGroups`, `src/lib/ear/rhythm-notation.ts:112-240`):
  heads on the line, stems up, beams over the top joining the flagged notes of one beat, rests across
  the line, as The Chart draws them (FACTS 13, 40). The Ear Lab's maths reads values from note starts
  and writes no tie, so the kit's model carries what it lacks: an explicit rest where a note could
  have filled the gap (Step 4's rests; FACTS 44), a dot chosen by the learner, and the tie. Rests are
  engraved by the rules for 4/4 (FACTS 26a): a silent beat is one quarter rest on the beat, whatever
  it held; two silent beats from beat 1 or beat 3 are one half rest, and a silent bar one whole rest;
  beats 2 and 3 never share a rest, so beat 3 stays in sight. The 4/4 is written at the start of the
  line with the first note of the first bar heard, in the hero and in each step, and stays. On the
  five-line staff (Step 5, free play) the kit's staff toy engraves the same symbols on the learner's
  clef, every note on A3 (the bass staff's top line) or A4 (the treble's second space), as FACTS 29
  sources them: on the bass staff A3 sits above the middle line, so its stems point down, on the left
  of the heads, its ties curve above them and its dots sit in the space above the top line; on the
  treble staff A4 sits below the middle line, so its stems point up, its ties curve below and its dots
  sit in its own space. On the one line, stems go up and a tie curves below.
- **Written as it sounds.** A bar the page teaches is drawn note by note as it plays: before its
  first play a changed beat shows only its pad, and as each note starts it appears, in its singer's
  colour while it sounds, then ink. A flagged note appears with its flag, and when the last flagged
  note of its beat sounds, the beat's flags join into a beam, so Step 1's "Flags in one beat join into
  a beam" is seen as it is said. Once heard, a bar stays written until it changes. This is how every
  staff idea arrives after its sound (SEASON-2 § 1.4 item 1).
- **The pads** are Lesson 8's beat row: four pads under the line, numbered 1 to 4, beat 1's number
  larger, each pad a button the width of its beat. The notes inside a beat are drawn in its pad and
  are never targets of their own (FACTS 70). Each pad lights while its beat plays. In a two-bar
  figure, Step 5's staff and Play both's 120 BPM row, the eight beats only light and take no press, so
  no target falls under 44 px.
- **Play the halvings** (Step 1): a button that plays the article plan's five bars in turn at 60 BPM,
  each written as it sounds in place of the one before: a whole note; two halves; four quarters;
  eight eighths; sixteen sixteenths; 4 s each, 20 s, the strip reading each. The sixteenths stay
  written, and Reset puts back four quarters (FACTS 66).
- **Halve and Join** (Step 1, free play): the learner chooses a beat (a pad, `aria-pressed`, the
  arrow keys moving the choice), then presses Halve or Join, two buttons under the figure. Halve
  splits every note in the chosen beat in two: a quarter into two eighths, two eighths into four
  sixteenths; on a half or a whole note it splits that note, a half into two quarters, a whole into
  two halves. Join undoes it: four sixteenths into two eighths, two eighths into a quarter; a quarter
  with its partner beat (1 with 2, 3 with 4) into a half note, when the partner holds a quarter too;
  two halves into a whole. So halves start on beats 1 and 3 only and a whole fills the bar, and the
  bar always adds up to four beats. A press that cannot go leaves its button `aria-disabled`, with a
  hint for each case: Halve on sixteenths, "A sixteenth is the shortest note here."; Join on a
  quarter whose partner beat holds anything else, "Join needs a quarter on the other beat of the pair
  too."; Join on a half note when the other half of the bar is split, "Join needs a half note in the
  other half of the bar too."; Join on a whole note, "A whole note already fills the bar."; either on
  a silent beat in free play, "Turn the rest back into a note first." Each press plays the bar at
  once, written as it sounds. Reset puts back four quarters.
- **Note · Rest** (Step 4, free play): a tap on a pad makes its beat silent, and back, and the bar
  plays at once. A pad inside a half or a whole note silences that note, which becomes a half or a
  whole rest; any other silent beat is engraved as one quarter rest, whatever it held, and two silent
  beats from beat 1 or beat 3 become one half rest, by the rules above (FACTS 26a).
- **The rest strip** (Step 4): under the figure, the five rests, whole to sixteenth, each a button
  with its name, "Half rest", that plays a short example with that rest between notes, at 60 BPM,
  written as it sounds, each rest placed as FACTS 26a writes it: the half rest on beat 3, quarter,
  quarter, half rest, then the next bar's first quarter (5 s); the quarter, eighth and sixteenth rests
  in one bar each (quarter, quarter rest, half; quarter, eighth rest, eighth, half; quarter, sixteenth
  rest, sixteenth, eighth, half); and the whole rest as a bar of silence between a bar of four
  quarters and the next bar's first quarter, since a whole rest fills a bar. The silence is always
  heard between two notes. In these examples only the rest's cell in the stopwatch strip reads, so a
  narrow rest can take its neighbours' room (Toys 6).
- **Count** (Step 3, free play): a switch that writes each note's count under it, "1", "and", "e",
  "a", "(4)", lit in turn as the bar plays, the unsaid counts in brackets (FACTS 20 to 22). Step 3's
  Play plays two bars in turn, each written and counted as it sounds: eight eighths, "1 and 2 and 3
  and 4 and", then a quarter, two eighths, four sixteenths and a quarter, "1, 2 and, 3 e and a, 4",
  8 s. On every second play with Count on, the counts fade to faint and stay unlit, so the learner
  counts alone; the next play lights them again. Merc never says them: the page plays no speech
  (FACTS 75).
- **Tempo and Play both** (Step 2, free play): Tempo is Lesson 8's slider, 60 to 120 BPM here, in
  steps of 1, from 60, with ticks at 60, 90 and 120 and the readout "60 BPM"; a change while playing
  takes effect from the next beat. Step 2's bar is two quarters and a half note. **Play both** (Step 2) plays two rows of whole bars, each written as it plays in a row of its own: one bar at 60 BPM,
  two eighths, a quarter, two eighths and a quarter, 4 s; then, after a pause of 1 s, two bars at 120
  BPM, two quarters and a half note twice, 4 s. The two rows share one time axis, 4 s across, so each
  eighth at 60 sits over a quarter at 120 and each quarter at 60 over a half at 120, and the strip
  reads 0.5, 0.5, 1, 0.5, 0.5 and 1 s under both: the same seconds written two ways, with the clicks
  heard to differ (FACTS 17).
- **Dot, Tie and Clef** (Step 5, free play): two bars on the staff, half, quarter, quarter, then
  quarter, quarter, half. **Dot** turns bar 1's half note and the quarter after it into a dotted
  half, and bar 2's two quarters into a dotted quarter and an eighth, and back: the strip reads "3 s"
  and "1 s", then "1.5 s", "0.5 s" and "2 s". **Tie** ties bar 1's last quarter to bar 2's first note
  across the bar line, and back: one sound of "2 s" with a quarter, or of "2.5 s" with Dot's dotted
  quarter. Each press plays the two bars, written as they sound; a tied pair sounds once and reads
  one length. **Clef** is a two-way switch, Bass · Treble, from the stored voice (Bass when none is
  stored): it moves the staff and the sound together, A3 in the bass, A4 in the treble, redraws the
  stems, ties and dots for that staff, and stores nothing (FACTS 10, 29).
- **See it on the pitch line** (every step and free play): a switch that redraws the bar as Season
  1's pitch line, each note an amber band as long as it sounds, rests as dashed gaps, the beat lines
  under it, the strip in step with it. Off by default; it keeps its place for the visit, in memory.
  Three toys have none: the hero's pads (Toys 2), whose only controls are the predict's two plays;
  the four words (Toys 4), whose tickets are too small for a second view; and the checkpoint (Toys 7),
  where a band as long as each note would read the rhythm out before it is tapped.
- **Keyboard and screen readers.** The figure is a group named for what it shows, "One bar of 4/4:
  two quarter notes and a half note, on one line", rebuilt as the bar changes; each pad is named by
  its beat and contents, "Beat 2: two eighth notes", "Beat 3: a quarter rest". A polite live region
  says what each action changed, once: "Beat 2 halved: two eighth notes", "Dots added: a dotted half
  note, then a dotted quarter and an eighth", "Tie added across the bar line". Tab order: Play, the
  step's own controls, the pitch-line switch, then the pads, beat 1 to 4.
- **Layout and targets**: Lesson 8's figure height, 250 px, and its widths: on phones the figure
  spans the card's inner width, 356 px at 390 x 844, so a pad of a one-bar figure is about 89 px wide
  and never under 44 px from 344 px up, where the figure is about 310 px (FACTS 70). The controls
  under the figure stay within one row of buttons and, in Step 2, the Tempo row, so every step's stage
  fits the kit's stuck-stage room at 1024 x 640 to 1366 x 657, as Lesson 8's stages do (Lesson 8
  WEB-SPEC, Toys 1); Step 5's two bars on the staff are drawn inside the same height.

### 2. The hero's compact pads

Lesson 8's compact strip (`src/features/lessons/kit/beat-strip.ts:1-17`) cut to one bar of four: the
four pads, the beat numbers over them, the small metronome at their left, with the line above and an
empty stopwatch strip under them. Merc's and Tavi's bubbles over them show LESSON.md's two lines
from the start; neither holds a number, and Tavi's is the guess the lesson answers (FACTS 1a, 18).
Before any play, nothing is written and no number shows. "Play the bar at 60 BPM" sounds four
quarter notes with the woodblock's clicks, the 4/4 written at the line's start with the first note
and each note written as it sounds and read in the strip as it ends ("1 s"); "Play the bar at 120
BPM" plays the same written bar twice as fast, leaving the notes as they are, and the strip's cells
read "0.5 s" as each ends. The drawing is `aria-hidden`; a polite region speaks for it: "Four
quarter notes at 60 beats per minute: 1 second each." as the first play ends, and the second's
reading only with the reveal. Its notes light in the voice's colour. The share card draws this
figure written, with the strip empty.

### 3. Predict widget

The kit's predict (`src/features/lessons/kit/predict.ts:1-17`), as Lesson 8's cold open uses it: the
60 BPM play carries `data-free` and works before a choice, never revealing; the 120 BPM play unlocks
with the choice and reveals once heard to its end (the kit's default, `revealOn` left unset,
`src/features/lessons/kit/predict.ts:53-59`). Its hints: `chosen`, "Locked in. Play the bar at 120
BPM, and watch the stopwatch."; `silent`, "Sound is off, so nothing played. Turn sound on, then play
it again."; `again`, "Play either bar again." The lock line is "Choose an answer to unlock the faster
play." The reveal opens on the choice ("You said: one second, the same" or "You said: half a
second"), then LESSON.md's reveal; the strip's 120 BPM readings are spoken with it. A play cut short
resolves false and changes nothing (FACTS 1a).

### 4. Four words

The kit's words strip: a ticket per word with its definition and play button. Each ticket's figure is
a short rhythm on one line, written as it plays and kept: a whole note, then two halves (8 s); a
quarter, a quarter rest, a quarter, a quarter rest (4 s); a dotted half, then a quarter (4 s); two
quarters, then, after a beat's pause, the same two tied (FACTS 65). The tickets' figures are short
rhythms with no time signature and no bar line, so a figure need not fill a bar; the tie curves
below the heads, opposite their stems (FACTS 29). Each figure has its strip; the tie's reads "1 s,
1 s", then "2 s".

### 5. Step states

The deck registers one toy whose `onStep(step, previous)` sets the rhythm bar's state and stops
whatever it plays whenever the two differ, by every route the deck has (Lesson 8 WEB-SPEC, Toys 1,
States). The states:

1. **Halves** (Step 1): one bar of four quarters on one line, Play, Play the halvings, Halve, Join,
   Reset, the strip, the pitch-line switch. Caption: "Fig. 1 A bar, halved and joined".
2. **Tempo** (Step 2): two quarters and a half note, Play, Tempo and Play both, the strip. Caption:
   "Fig. 2 One bar, any tempo".
3. **Count** (Step 3): two bars played in turn, eight eighths, then a quarter, two eighths, four
   sixteenths and a quarter, Play and Count. Caption: "Fig. 3 The counts under the notes".
4. **Rests** (Step 4): four quarters, Play, Note · Rest on the pads, the rest strip. Caption: "Fig. 4
   Notes and rests".
5. **Staff** (Step 5): two bars on the five-line staff, Play, Dot, Tie and Clef, the beats lit with
   no pad buttons. As the step opens the line becomes the staff, carrying only what Step 4's line
   holds, all of it heard: the line thickens into the staff's middle line, the other four lines draw
   in around it, the clef draws at the left, and the notes slide to A's line or space, their stems
   turning down as they rise on the bass staff, over 0.6 s on the kit's `expoOut`, at once under
   reduced motion. Step 5's own two bars are then written by their first play, in place of what came
   across, whichever of Play, Dot or Tie sounds them first, so they too are heard before they are
   seen. Caption: "Fig. 5 Two bars on the staff".

### 6. The stopwatch strip

New kit work, under rhythm on the staff (SEASON-2 § 6.2 item 3), as the lead asked: a row under any
written bar with one cell per note or rest, each as wide as its symbol's place in the bar.

- **What it reads**: the symbol's written length in seconds at the tempo it plays, 60 / BPM times its
  beats, from its start to the next symbol's start: two decimals at most, trailing zeros dropped, "4
  s", "1 s", "0.5 s", "0.67 s", "0.25 s" (FACTS 16, 63). A tied pair is one cell across both. A rest's
  cell is dashed and reads its silence, "rest, 1 s" to a screen reader.
- **When**: a cell fills left to right while its symbol sounds and shows its reading as the symbol
  ends; it keeps the reading until the bar changes or plays again. At a new tempo the readings are
  replaced as each note ends, never all at once before the sound.
- **What it never does**: it shows no reading before its sound, so the hero's 120 BPM readings first
  appear as that play is heard; it never rounds a length to a tidier one; it measures what the page
  books, not the sound at the speaker, and says nothing about the device.
- **Narrow cells**: a reading must fit its cell. At 390 px a sixteenth's cell is about 22 px, and so
  is an eighth's in a two-bar figure, too narrow for "0.25 s" or "0.5 s". So a run of equal notes
  inside one beat that does not fit reads once under the beat, "4 × 0.25 s" or "2 × 0.5 s"; a lone
  note that does not fit, such as the eighth after Step 5's dotted quarter, reads on a second row
  under the first, centred on its note, where it has its neighbours' room; and in the rest strip's
  examples only the rest's cell reads (Toys 1). The screen reader hears every length either way.
- **Data in, nothing out**: the strip takes the bar's symbols, the tempo and the beat clock's spots,
  and draws; it is `aria-hidden`, and the figure's polite region reads the lengths once per play.

### 7. The checkpoint

Two parts on one card, each with a visible status line that is also announced (`role="status"`):
first the rhythm, tapped, with no voice; then the same rhythm sung, optional, with Lesson 8's comfort
check before it. Lesson 8's rule for leaving holds for both: if the card stays off screen for 600 ms,
or the page is hidden, whatever is playing stops.

**Part 1: the tap take.** The card holds the two written bars on one line, Start, the pad and the
line. The bars are drawn from the start, since reading them is the task; they are a rhythm the steps
have taught and played.

- **Start: tap the rhythm** runs the take (FACTS 36): a 0.6 s lead; one bar counted in on the
  woodblock's click, beat 1 on the high click, status "Counting in: one bar."; two bars of the click
  alone, status "Tap every beat: bar 1 of 2", each pad number lighting; then the two written bars,
  the click going on under them, status "Now the written bars: bar 1 of 2", each note lighting as
  its start passes; then 0.35 s more. 20 beats at 1 s, 20.95 s in all. Each tap sounds a clap at
  once, at 0.7 (FACTS 69). Start becomes Stop while the take runs, and moves the focus to the pad.
  Until Start, the status reads "Press Start when you're ready to tap."
- **The judge**, the kit's take judge (What the kit and the app still need, item 5), a pure function
  of the taps, the beat times, the beat's length and the written onsets, so every line below is
  unit-tested. Beats are counted from 0, the first count-in click; beat b sounds at T(b) = T(0) + b ×
  1,000 ms on the page's clock. Then:
  1. **Lining up.** Each tap whose nearest beat is one of beats 4 to 11 gives a sample, its time less
     that beat's. The estimator needs five, and the page asks five inside its outlier radius; with
     fewer, the take is not lined up. Otherwise the estimate L, 0 to 250 ms, is taken from every tap
     (FACTS 32).
  2. **Matching.** Every time is measured from T(12), and the call is `judgeTake(taps, onsets, 120,
barMs)` (`src/lib/ear/rhythm-take.ts:89-132`): `taps` are each tap less L and less T(12);
     `onsets` are the nine notes' starts, 0, 1,000, 2,000, 4,000, 4,500, 5,000, 6,000, 6,500 and
     7,000 ms; 120 is `TOLERANCE_MS.quarters`; `barMs` is 7.5 beats less the window, 7,380 ms, so the
     judge's own filter keeps the taps from 120 ms before the first note to half a beat after the
     last (FACTS 33).
  3. **The line**, the first that applies:

     | When                                     | The line                                                                                                                            |
     | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
     | Not lined up                             | "We couldn't line your taps up with the beat that time. Tap every beat for the two bars after the count-in, then the written bars." |
     | No tap met a note and none was left over | "No taps came in the written bars. After the two bars of every beat, tap once for each note."                                       |
     | All 9 met, none left over                | "All 9 notes got a tap, and no tap fell between them."                                                                              |
     | Otherwise                                | "Notes with a tap: N of 9.", then the clauses below that apply, in this order                                                       |

     The clauses: a leftover tap within 120 ms of beat 4 of bar 1, where the half note holds: "One tap
     came on beat 4 of bar 1, where the half note holds."; when N is at least 1, both notes on "and"
     unmet: "The two notes on ‘and’ got none.", or one of them: "One note on ‘and’ got none." (with N
     at 0 those clauses would only repeat the count); other leftover taps: "K taps fell between the
     notes.", or "K more taps fell between the notes." after the beat-4 clause. N sits after a colon,
     as in Lesson 8's "On 2 and 4: 6 of 8.", so no sentence starts with a digit; K starts its sentence,
     so it is a word, "One tap" to "Nine taps", then digits, as Lesson 8's `tapsWord` writes it. The
     simulation reads every line from seeded takes (FACTS 35).

- **After the take** the strip under the written bars draws where each lined-up tap fell as a small
  tick at its fraction of the bar: gold when it met its note, ink-2 when it met none (Look). It is a
  drawing of the taps as measured, never a mark of the person (FACTS 71). The line reads in the
  status region. **Again** runs the whole take again, lining-up included; it is always offered,
  since the taps use no voice (FACTS 34), and nothing about a take is stored.
- **Hear the bars**, offered once a take has ended and never before, so the bars are read at sight:
  it plays the two written bars on A3 or A4 after a bar's count-in, 4 s and 8 s, the click under
  them, each note lit as it sounds and the ticks left in place, so the learner hears what they read
  beside where they tapped. It is how every written rhythm on the page plays. The Chart, likewise,
  lets the bar be heard only after the answer, on request, though it sounds a click on each note's
  start where this page plays the notes (FACTS 40).
- **Stopping.** Stop, or leaving the card or the page, ends the take with no line: "Stopped. Press
  Start to tap again."
- **Sound off.** The take needs sound: with sound off, Start shows the kit's toast for a play that
  does and runs nothing, and the status reads "Sound is off, so the take didn't start. Turn sound on,
  then press Start." No Web Audio: Start is `aria-disabled`, "This browser can't play the page's
  sounds, so the take can't run."

**Part 2: the sung bars.** The guide is the same two bars on one line, with the still of the Merc
singing beside it, Merc for the lower voice and Tavi for the higher, never a microphone icon. Every
state has its status line, Lesson 8's with "Merc's bars" for "Merc's line": "Before you sing: how is
your voice today?"; "Choose the voice you'll sing with.", or "Choose a voice: it picks the Merc who
sings." after "Just listen today"; "Just listening today: press Play Merc's bars to hear them.";
before Merc's bars are heard, "Play Merc's bars first: Merc sings them, then the guide is yours.";
then "Start the guide when you're ready, or play Merc's bars again."; while Merc sings, "Merc sings
the bars."; while the guide runs, "Your turn: sing with the guide."; when it ends, "How did that
feel?"; once the guide is put away, "Merc can still sing the bars for you."

States, as Lesson 8's (Lesson 8 WEB-SPEC, Toys 6, part 2), with these changes:

1. **Comfort check**, first in this part and asked every visit: Lesson 3's line, list and buttons,
   through `mountComfort` (`src/features/lessons/kit/comfort.ts:159`; FACTS 50).
2. **Voice choice**, after either comfort answer: Lesson 3's buttons, read from and stored in
   `fyp-voice`, with the two forms of its line (FACTS 52). A choice also sets the clef and the note of
   every toy on the page for the rest of the visit.
3. **Just listen today**: LESSON.md's line with the doctor lines; **Play Merc's bars** sings them in
   the chosen voice, the guide lighting as they play; the guide and Move the note are not shown.
4. **Ready**: **Play Merc's bars** plays the count-in bar, then the nine notes on A3 or A4 over the
   click, 12 s, each note lit as it sounds; Merc's voice is the kit's `merc` kind, an "ooh", with a
   short gap before each note so repeated notes start apart (FACTS 58, 63). **Move the note** is two
   buttons, "Move the note lower" and "Move the note higher", a semitone each, up to four either way,
   through `kit/move-do.ts`, moving Merc's bars and the guide together. Its readout names semitones,
   never letters: "note: as written", "note: 1 semitone lower", "note: 4 semitones higher, the
   highest" (FACTS 57).
5. **Guide**: enabled once Merc's bars have been heard with sound on, with the hint "Play Merc's bars
   first." until then. It plays the count-in bar on the click with the note sounded once and softly
   on beat 1, then lights each note as it goes by, for 8 s, the click under it; Merc does not sing.
   Space never starts it, and focus never moves to a button when a state changes.
6. **How did that feel?**, after each guide that runs to its end: Lesson 3's four answers through
   `mountFeelings` (`src/features/lessons/kit/comfort.ts:175`). Easy or Workable shows "That's it: two
   bars on one note, done." and Again, once a visit; Effortful and Uncomfortable put the guide, Again
   and Move the note away, Uncomfortable with the doctor lines; after Effortful, Uncomfortable or Just
   listen today the Wrap shows the rest card, through `restAfterEffort`
   (`src/features/lessons/kit/comfort.ts:53`; FACTS 56).

The flow is a pure rule, as Lesson 8's `sing-flow.ts` is, so every branch is unit-tested. The tap take
is outside it: its Again and the practice drills stay on offer after any answer. Keyboard order
follows the card: Start, the pad, Again; then the comfort buttons, the voice buttons, Play Merc's
bars, Start the guide, Move the note, the four feelings and Again.

### 8. Free play

Its own copy of the rhythm bar in a card after the next-lesson card, as two figures. The first is
one bar of four pads with Play, Halve, Join, Note · Rest, Count, Tempo, the pitch-line switch and
Reset; one bar keeps every pad at least 44 px wide on a phone (FACTS 70). Under it, Step 5's two bars
on the staff with Play, Dot, Tie and Clef, which keep the fixed places Toys 1 gives them, so neither
needs a chosen note and neither can be pressed where it cannot go. Nothing locks: the guided steps
come first on the page (playbook rule 17). Its line: "Free play: every control of the rhythm bar in
one place".

### 9. Recall and quick check

Two quizzes through the kit's quiz, with the options it has (an id prefix each, a question's `id`,
and `away` for another lesson's step links).

- **The recall** imports Lesson 8's question objects, `l08-q2` and `l08-q4`, filtered by id as
  Lesson 8 imports Lesson 6's (`src/features/lessons/lesson-08/quiz-questions.ts:26-28`), never
  copied; its "Try Step N again" links become "Try Lesson 8, Step N again" to `/learn/08#step-N`, in
  a new tab, through `recallStepHref` (`src/features/lessons/kit/quiz.ts:142`). Question 2's "Play
  two bars" is Lesson 8's quiz play, bound on the recall's host (FACTS 7). Everyone sees it. Lesson
  8's question 1 is left out: its right answer, "two a second", would answer the predict for a
  learner who reads on before choosing (FACTS 1a).
- **The quick check**: LESSON.md's four questions, ids `l17-q1` to `l17-q4`, word for word, three
  options each in a stored shuffle. Question 4's play button, "Play the rhythm", sits in its slot and
  plays two eighths and a quarter at 60 BPM over two clicks, 2 s (FACTS 68), drawn as nothing: the
  options are words, so the ear answers.
- Storage, as every page's: `fyp-l17-recall-seed`, `fyp-l17-recall-v1`, `fyp-l17-seed` and
  `fyp-l17-quiz-v1`. Each question's first answer in a visit is sent as the anonymous `lesson_answer`
  once the lesson plumbing accepts lesson 17 (What the kit and the app still need, item 9).

### 10. Go deeper drawer

Lesson 2's `details` drawer, closed by default, in Step 3's text after the Notice: two items,
Takadimi and "1 e and a" (FACTS 23, 24).

### 11. Tease still

The kit's next-lesson card for Lesson 18, its tease above its hook (FACTS 5). Its slot holds a still
of Lesson 18's opening line as Lesson 18's stage draws it, in the learner's clef from `fyp-voice`
(treble for the higher voice, bass for the lower or for none stored): two bars, four quarters and
then two quarters and a half note, C4 D4 E4 D4 and C4 E4 G4 on the treble staff or an octave lower on
the bass, engraved as Toys 1 engraves, with the beat grid under them and no cursor, no bracket and no
syllable, so it shows no group and no count, which Lesson 18's predict asks about. It does not play,
and nothing above the card plays it, though CURIOSITY-MOMENTS § 3.1 allows a tease sound a Play there:
Lesson 18 sounds this line only once its own predict is answered, so a play here would hand that
predict a clue. It teaches nothing on this page, and each symbol in it is one Lessons 15 and 17 have
already played. The card is a link, so the still has no buttons; it is `aria-hidden`.

## Audio

- **One clock.** Every sound the page makes goes through the beat clock
  (`src/features/lessons/kit/beat-clock.ts:1-27`), booked ahead on the audio clock into the run's
  own bus, so leaving a step cancels what it booked: the clicks as the Ear Lab's woodblock, its
  `wood` voice, a triangle at 1,050 Hz whose pitch falls by half over 50 ms, with beat 1 knocking
  higher at 1,575 Hz (FACTS 62); the notes as voices booked at their start and released on the audio
  clock (`bookNote`, `src/features/lessons/kit/sound-ahead.ts:83-100`), the kit's `soft` voice in
  the steps and the `merc` voice in the sung part, at A3 or A4 (FACTS 61); the claps as the shared
  drum voice. A note sounds for its length less the gap of FACTS 63; a tied pair is one voice. The
  Ear Lab sends its clicks straight to the context's output, outside any bus
  (`src/features/ear-lab/click-synth.ts:90-91`), so the kit takes the voice's shape and books it on
  a run's own bus (What the kit and the app still need, item 11).
- **Levels.** The notes at the steps' level and the woodblock under them, so the note is heard over
  the beat and the beat is never lost; the clap at 0.7 of the drum voice's level. The real-phone
  check (Contract) sets the woodblock's level and confirms the balance by ear.
- **One sound at a time**, through the page's one-sound owner
  (`src/features/lessons/kit/now-playing.ts:1-15`): any play stops whatever else plays, a take
  included. The Sound switch, the hush and a hidden page close every open bus.
- **Sound off.** A play with sound off runs its drawing silently: the notes are written and the strip
  reads, as Lesson 8's toys run their lights, with the kit's notice; the predict's 120 BPM play does
  not reveal (Toys 3); the take and the sung part do not start (Toys 7). Every sound on the page is
  synthesised; nothing is recorded.

## Merc and Tavi

Their bubbles in the cold open carry LESSON.md's two lines from the start, before any play, and
neither holds a number (FACTS 1a, 18); they idle beside the stage and look at the pads while a play
runs. They hop on nothing: the beat is the click's. In the sung part the still of
the singing Merc is the chosen voice's, Merc for the lower and Tavi for the higher. Merc never
speaks a count aloud: a count lights under its note (Toys 1), since every sound on the page is
synthesised and the kit has no speech. Under reduced motion both stand still.

## Practice links: what exists and what needs engineering

- **Today**: Ear Lab, printed `mercurypitch.com/ear-lab` and linked `/ear-lab?lesson=17`, "then tap
  The Chart", with Pulse as the second drill (FACTS 39 to 42, 48). The card says what The Chart does
  as it stands at `c60f0fdcb`: a bar on one line, four clicks at 100 BPM, a quarter note 0.6 s, a
  silent wait for the first tap, then the click under the rest of the bar; and that some of its bars
  hold triplets, which come later (FACTS 45). Pulse plays a bar as clicks and is tapped back (FACTS
  41).
- **Needs engineering: the `ear-drill` launch kind** (SEASON-2 § 5.2 item 12; code with tests), then
  a subset as data: The Chart on the patterns this lesson's values write, with no triplet and no
  sixteenth: `c-q3`, `c-q4`, `c-q-rest`, `c-e-and`, `c-e-one`, `c-e-off`, `c-e-run` and
  `c-e-across` (the bank's ids, FACTS 42; their written values, FACTS 45), which write quarters,
  halves, eighths and dotted quarters, with one eighth rest, every one of which this page plays and
  writes. The card then drops its triplet sentence.
- **Needs engineering: the lesson marker** for 15 to 28 (SEASON-2 § 5.2 item 21), without which
  `?lesson=17` is an ordinary visit and First Light opens (FACTS 47). It is part of the kit PR this
  page waits on.
- **App content, proposed**: the `PULSE_TIMING` comment that says a soft rail ticks while the take
  waits, which the anchored take no longer does (FACTS 40); and, for the Ear Lab's owner, that The
  Chart writes its "rest on 2" pattern as a half note, since a bank pattern holds note starts only
  (FACTS 44). Writing rests would need a length or a rest in the bank's data; nothing on this page
  depends on it.
- **No practice for ties**: the app writes no tie (FACTS 43); Step 5 and free play are the only
  place a learner meets one until the kit's rhythm bar reaches a drill.

## Explorer and season data

The lead writes these entries; this spec gives them:

- **The season entry**, in Season 2's module (What the kit and the app still need, item 1): `n: 17`,
  `lane: 'theory'`, `title: 'How long is a note?'`, `short: 'Note lengths'`, `topics: ['T07']`,
  `minutes: 16`, `page: '/learn/17'`, `hook: 'Why is a quarter note not a quarter of a second?'`,
  `pr.link` with `href: '/ear-lab?lesson=17'`, `addr: 'mercurypitch.com/ear-lab'`, `label: 'Ear
Lab'` and `note: 'then tap The Chart'`, since the explorer prints the label, a comma and the note,
  as Season 1's Ear Lab entries read (`practiseMarkup`,
  `src/features/lessons/kit/explorer.ts:177-181`), and `pr.needs: 'The Chart without triplets or
sixteenths (an ear-drill link)'`, which no page draws
  (`src/features/lessons/kit/season.ts:90-106`). The edge `[8, 17]`; Lesson 15 only helps, so it is
  no edge (SEASON-2 § 4.3). The topic T07, "Note values, rests, dots, ties, subdivision"
  (SEASON-2 § 4.1).
- **The figure** beside its explorer card: a bar of four quarter notes on one line over four pads,
  captioned "A bar of four quarter notes, written over Lesson 8's beat pads", a drawing with no
  reading in seconds, so the card answers nothing (FACTS 1a). It is a new `fig` kind, `'rhythm'`,
  which the kit still needs (item 12 below); until it is drawn the entry leaves `fig` out and the card
  shows no figure.
- **The signature**, in `kit/team-notes.ts`, which no page imports: "Lesson 8's beat pads grow
  noteheads and stems, halve into eighths, join into half notes, and lift onto one line, then the
  staff."
- **The copy**, in `kit/lesson-copy.ts`: Lesson 17's `tease`, "Same written bar, played twice. Only
  the tempo changes.", with one alternative, `teaseAlts` id `shapes`, the season plan's line cut to
  fit and made true, "Same five notes, twice as fast: the note shapes change." (FACTS 5b), its note
  in `kit/team-notes.ts`'s `TEASE_NOTES`; and Lesson 18's tease, "Now you can read when each note
  comes, and where it sits." (FACTS 5). Each is a line of at most 70 characters, `TEASE_MAX`
  (`src/features/lessons/kit/lesson-copy.ts:76`); the lead settles Lesson 17's two at review. No hook
  alternative.
- **The explorer**: Season 2's tab, its line above the heading "Season 2 · Lesson 17" (FACTS 6), with
  Lesson 17's card showing only learner information: "Ready", "Coming later" or "Done", no
  signature, no backlog and no topic codes.

## What the kit and the app still need

Each item names the season plan's line it belongs to. The page is built once items 1 to 5, 9 and 11
are in; items 6 to 8 and 12 come with the page's own PR.

1. **Seasons in the kit** (SEASON-2 § 6.2 item 1): the season per lesson, Season 2's data in its own
   module, the masthead's "Season 2 · Lesson 17", the explorer with a tab per season and, above its
   heading, the masthead's "Season 2 · Lesson 17" in place of Season 1's "Season 1, fourteen lessons
   and a trailer", as the lead decided (FACTS 6), and a cross-season prerequisite line where one is
   needed (this lesson needs none: Lesson 8 is its only edge).
2. **The head** (SEARCH § 3.1 and § 12): a title of at most 60 characters in searchers' words,
   proposed "Note values: whole, half and quarter notes \| MercuryPitch" (57 characters, the bar and
   the name included, as SEARCH § 4 counts its titles); a description of 80 to 160 characters, the
   hook then what the lesson covers, proposed "Why is a quarter note not a quarter of a second? A
   16-minute lesson on whole, half, quarter, eighth and sixteenth notes, rests, dots and ties, with
   sound toys." (159 characters), which says nothing of tempo or seconds (FACTS 1a); the og and
   twitter descriptions the same; the share card, `learn/lesson-17-og.jpg`, the hero's pads with the
   written bar and an empty strip; the two structured-data blocks from Lesson 1's; `learn/17.html`
   in `kit/drafts.ts`; and on release, as SEARCH § 12 item 3 lists them for
   `src/tests/lesson-pages.test.ts` to name, the sitemap, `llms.txt`, `STANDALONE_DOCUMENT_PATHS`
   and the first-paint budget.
3. **Rhythm on the staff** (SEASON-2 § 6.2 item 3): the kit's rhythm model and drawing (Toys 1), on
   the Ear Lab's notation maths where it fits, with what this page adds to it: explicit rests placed
   by the rules for 4/4 (FACTS 26a), a dot chosen by the learner, the tie, two bars in one figure, the
   write-as-it-sounds drawing with its flags joining into a beam, and the stopwatch strip with its
   rule for narrow cells (Toys 6). 4/4 is all this page needs; 3/4 and 6/8 are Lesson 19's.
4. **The staff toy** (SEASON-2 § 6.2 item 2) with the F clef, since the kit has only the G clef's path
   (`G_CLEF_PATH`, `src/features/lessons/kit/glyphs.ts:10`): this page needs one pitch on either clef,
   A3 on the bass staff's top line and A4 in the treble's second space, with A3's stems down, its ties
   above and its dots in the space above the top line, and A4's stems up, its ties below and its dots
   in its space (FACTS 29), all of which SEASON-2 § 6.1 item 1 marks as "checked, then built", where it
   records that the stats snippet does not flip a stem across the middle line; and the pitch-line
   switch.
5. **The tap take in the kit**: Lesson 8's lining-up and its judge's frame, from
   `src/features/lessons/lesson-08/take-judge.ts`, generalised to any written onsets, any number of
   beat bars and a page's own line rules, with Lesson 8's backbeat lines kept as its own rules, so
   Lesson 8's page reads exactly as it does (its unit tests unchanged); the ticks of `kit/beat-strip.ts`
   at any position in a bar, gold or ink-2. Lessons 18 and 19 can take the same part.
6. **The rhythm bar's controls**: Play the halvings, Halve and Join with a hint for each case that
   cannot go, Note · Rest, Count with its fade, Tempo (Lesson 8's slider with its range set by the
   page), Play both, Dot, Tie and Clef (Toys 1).
7. **Move the note**: `kit/move-do.ts`'s step and reach with this page's labels and readout, as each
   page keeps its own (`src/features/lessons/kit/move-do.ts:1-19`).
8. **The pitch-line view of a rhythm**: Season 1's pitch line drawing notes as amber bands of their
   length, rests as dashed gaps, on the rhythm bar's time axis.
9. **The lesson plumbing** (SEASON-2 § 5.2 item 21): the marker's reach to 17
   (`src/lib/lesson-marker.ts:11-25`), the lesson-answer bounds, the admin console's row and the
   released list, so the practise link steps First Light aside and the quiz answers are kept.
10. **The shared lines**: Lesson 15's draft keeps the voice buttons and adds a line under them, that
    the staff follows the choice; the lead makes the two pages' words agree at review (FACTS 52).
11. **The woodblock in the kit**: the Ear Lab's `wood` click voice
    (`src/features/ear-lab/click-synth.ts:45-52`) as a kit sound booked through the beat clock on a
    run's bus, with beat 1 pitched higher (FACTS 62), since `scheduleClick` sends its click straight to
    the context's output (`src/features/ear-lab/click-synth.ts:90-91`), past the bus a step cancels.
    The Ear Lab keeps its own.
12. **The explorer's figure**: a new `fig` kind, `'rhythm'`, in the entry's type, which offers
    `'poster'`, `'metronome'` and `'chladni'` today (`src/features/lessons/kit/season.ts:138`), drawn
    with its caption in `cardFigure` (`src/features/lessons/kit/explorer-figures.ts:188-213`): four
    quarter notes on one line over four pads, "A bar of four quarter notes, written over Lesson 8's
    beat pads" (Explorer and season data).

## Decisions for the owner

None is open. Everything the page needs is decided (SEASON-2 § 7), is the vocal coach's call
(LESSON.md, For the vocal coach), or is the lead's to settle at review: this lesson's tease, proposed
with the season plan's line, cut to fit and made true, as its alternative (Explorer and season data;
FACTS 5b), and the words the voice choice shares with Lesson 15 (FACTS 52). The owner agreed to the
lead's recommended teases, so neither comes back to the owner.

## Edge cases

- **Sound off.** Plays draw silently; the predict waits for a heard play; the take and the sung part
  do not start and say why (Toys 3 and 7; Audio).
- **No Web Audio.** Every play button is `aria-disabled` with "This browser can't play the page's
  sounds."; the bars stay written as the page's markup draws them for that case only, with no strip
  readings, and the quizzes work, question 4 and the recall's question 2 aside.
- **A device that delays sound past the estimator's cap.** Up to 250 ms the lining-up takes the delay
  out; between about 250 and 370 ms the excess stays in every tap and the ticks drift late by it,
  while the taps still meet their notes; past about 370 ms the taps fall outside the window and the
  line describes taps between notes (FACTS 35). The page gives no device figure; a learner on
  Bluetooth headphones who sees every tick late can try the speaker. Lesson 8's take has the same
  limit.
- **Taps during the count-in** give no sample and fall before the judged bars, so they change
  nothing.
- **A take stopped, or the card left**, ends with "Stopped. Press Start to tap again." and no line.
- **A tempo change while playing** applies from the next beat, and the strip's readings change with
  each note as it ends.
- **Halve or Join where it cannot go** does nothing and gives that case's hint (Toys 1).
- **The stored voice changes** in the sung part: every toy's clef and note follow from then on; a bar
  already written redraws on the new clef at once, without playing.
- **Step 5's Clef switch** changes that toy only, never the stored voice.
- **Lesson 8's page not live** where this page is served: the prerequisite chip shows as a plain chip
  and the recall's step links keep their words with no link (`linkAway`,
  `src/features/lessons/kit/quiz.ts:191`). The console asks before it publishes this page while
  Lesson 8's is not published.
- **`?lesson=17` before the marker reads it**: First Light opens on a first visit to the Ear Lab
  (FACTS 47); the page is not built before item 9.
- **Narrow and short screens**: at 344 px every pad stays at least 44 px wide, since only one-bar
  figures have pads to press; the strip's readings follow its rule for narrow cells (Toys 6); at 844
  x 390 the kit's compact stage shows each step's figure with its first control, as Lesson 8's does.

## Tests

Unit tests, each failing without the code it covers:

1. **The rhythm model**: Halve and Join on every beat from four quarters, a whole note and a bar of
   sixteenths, and each case's hint where one cannot go; the bar always adds up to four beats; halves
   only on beats 1 and 3; Note · Rest keeps the notes for the way back; a silent beat engraved as one
   quarter rest whatever it held, a half rest only from beat 1 or 3, two quarter rests over beats 2
   and 3 and a whole rest for a silent bar (FACTS 26a); the halvings' five bars; Dot in both its
   places and Tie with and without it; a tie makes one sounding note.
2. **The writing**: for the checkpoint's onsets the symbols equal `readRhythm`'s (FACTS 37); Step 4's
   bars keep their explicit rests where FACTS 26a puts them; beams join only the flagged notes of one
   beat, as the beat's last note sounds; the 4/4 comes with the first note; on the bass staff A3's
   stems point down, its ties curve above and its dots sit above the top line, and on the treble A4's
   stems point up, its ties curve below and its dots sit in its space (FACTS 29).
3. **The stopwatch strip**: every reading at 60, 90, 100 and 120 BPM for every value, dotted values
   and a tied pair ("1 s", "0.5 s", "0.67 s", "0.6 s", "1.5 s", "2 s", "2.5 s", "3 s"); no reading
   before its note ends; every state's bars at 390 x 844 and at 344 px with no two readings
   overlapping and none cut off, a beat of sixteenths reading "4 × 0.25 s".
4. **The take judge**: every line of Toys 7 from seeded takes, as the simulation reads them (FACTS
   35), including the delays of 0 to 350 ms, the beat-4 tap, the missed "and"s, no "and" clause when
   no note got a tap, no taps, no beat taps and a delay of 400 ms; Lesson 8's take reads exactly as
   before through the shared part.
5. **The predict**: the 60 BPM play works before a choice and never reveals; the reveal waits for the
   120 BPM play heard to its end; the hints as Toys 3 gives them.
6. **The sung part's flow**: every branch of Toys 7, part 2, at most two guides a visit, the rest card
   after Effortful, Uncomfortable or Just listen today.
7. **The words**: LESSON.md's quiz questions and lines word for word in the page's modules; the recall
   is Lesson 8's objects `l08-q2` and `l08-q4` by id, not copies; no feedback line starts "Right",
   "Yes" or "Correct".
8. **The season**: the entry, with `label: 'Ear Lab'`; the edge; the tease and its alternative, each
   within `TEASE_MAX`, with the alternative's note; and no team field drawn on the page.

End-to-end specs, against a local or dev build, never production:

1. `learn-lesson-17`: the hero holds no digit before the first play; the cold open's two plays write
   four quarter notes and read "1 s" and "0.5 s";
   the reveal appears only after the 120 BPM play; each step's controls do what Toys 1 says; the
   take runs with simulated key presses timed to the clicks and reads "All 9 notes got a tap, and no
   tap fell between them."; the page never calls `getUserMedia`.
2. The kit's shared specs with Lesson 17 added: the stage fit at its four landscape sizes, the cold
   open's fold, no planning text, the next-lesson card's tease, the frame loop resting.
3. The mobile and layout checks at 390 x 844 and 344 px: no sideways scroll, every target at least 44
   px, no overlap.

## Contract

Lesson 1's contract and its page on the app, unchanged and binding: no CDN, self-hosted fonts, Web
Animations in place of GSAP, and practice links that carry `?lesson=17` before any hash. Then the
layout, accessibility, sound, motion and storage rules: 16 px side gutters, no sideways scroll at
390 px, `min-width: 0` on text children, touch targets of at least 44 px with no two tap zones
overlapping, visible focus, a single dark theme with every colour a token and an explicit body
background, sound only after a tap, localStorage only for per-viewer conveniences inside try/catch,
and the whole page usable with no sound and no storage. The page prints no ♯ or ♭ (Move the note's
readout names semitones, never letters); any added later gets a spoken name, as Lesson 2's contract
sets. The figures' names and every live region use words only. The page stores the quiz seeds and
records, `fyp-done`, `fyp-voice`, `fyp-motion`, `fyp-pos` and `fyp-tour`, as every lesson page does;
nothing from the toys, the take or the sung part but the voice. The pitch-line switch and Step 5's
Clef hold for the visit, in memory.

Page QA before publishing (PRODUCTION-PIPELINE § 5) adds, for this page:

- Every button works by keyboard alone and announces what LESSON.md shows; the take runs from Space
  on the pad; a screen reader hears each bar described and each take's line.
- On a real phone, by ear and by eye (`docs/agent/DEVICE-DEBUGGING.md`): each note's length is heard,
  a half note against two quarters, a rest against a held note; repeated notes start apart; the
  click and the note start together, with no drift over two bars; the take lines up on the phone's
  speaker and on wired and Bluetooth headphones, and its ticks sit where the taps were made.
- The network panel and the browser's microphone indicator stay quiet through the whole page.

Where this package departs from ARTICLE-PLAN.md, and why, every one argued in FACTS:

1. Every rhythm sounds on A3 or A4, not C3 or C4: the voice buttons name A3 and A4, those notes sit
   well inside every preset of each voice where C3 and C4 are two presets' floors, A sits inside both
   staves where C4 needs a ledger line, and they are Merc's and Tavi's notes since Lesson 1 (FACTS
   57). The lead's answer to question 2 named C3 and C4 as well; the staff still waits for Step 5, as
   that answer asked. The cost is the bass staff's stems: A3 sits above the middle line, so its stems
   point down where C3's would have stayed up, and Toys 1 engraves them so (FACTS 29).
2. The cold open's bar is written by its first play, so the sound comes first there too (FACTS 18,
   64).
3. The recall asks Lesson 8's questions 2 and 4, not 1 and 2: question 1's right answer, two beats a
   second, would answer the predict for a learner who reads on before choosing (FACTS 1a, 7).
4. Step 3's counts light under the notes as they play, where the plan has Merc count a bar of eighths
   aloud: the page plays no speech (FACTS 75). The bar of eighths and the fade on the second play are
   kept (Toys 1, Count).
5. The checkpoint lines the taps up from two bars of beat taps, uses Lesson 8's 120 ms window, counts
   the notes met in words and draws early and late, as the lead's question 3 asked (FACTS 32 to 35).
6. The checkpoint has nine notes; the plan's coach note counted eight (FACTS 36).
7. Held and silent beats are counted in brackets and not aloud, as Open Music Theory writes them;
   the plan's "count through a rest as you would a note" is dropped (FACTS 21).
8. Step 4 writes its own rest examples, each rest placed by the rules for 4/4, since The Chart writes
   "rest on 2" with no rest (FACTS 26a, 44).
9. Step 2 adds the same seconds written two ways, Play both, in whole bars (FACTS 17).
10. The practice card describes The Chart's silent wait, where RESEARCH R17-15 has a rail ticking in
    it, and says only that triplets come later, since this page teaches sixteenths, which the plan's
    card set aside (FACTS 40, 45).
11. Go deeper keeps Takadimi and the history of "1 e and a". The British names, all five, are named
    once in Step 1, as SEASON-2 § 7 item 4 asks, so Go deeper does not list them again; the
    semibreve's history stays out with no musicology source read, and the item on which counting
    system works best is cut for length (FACTS 15, 25, 73).
12. The tease for this lesson is proposed afresh, with the season plan's line, cut to fit and made
    true, as its alternative; the lead settles the two at review (FACTS 5b).
13. The checkpoint adds Hear the bars once a take has ended, since every written rhythm on the page
    plays and the plan's two bars had no play; it waits for the take so the bars are still read at
    sight, as The Chart lets its bar be heard only after the answer (FACTS 40; Toys 7).
14. The pitch-line switch is on the rhythm bar, in every step and in free play, not on every toy: the
    hero, the four words and the checkpoint have none, and in the checkpoint it would read the
    rhythm out before the taps (Toys 1).

Kept as the plan has them, after the review: the woodblock click (FACTS 62), Step 1's five bars from
a whole note to sixteenths, each played then written (Play the halvings), Step 3's bar of eighths
with its fading count, and Step 5's dotted quarter, played and written (FACTS 66).
