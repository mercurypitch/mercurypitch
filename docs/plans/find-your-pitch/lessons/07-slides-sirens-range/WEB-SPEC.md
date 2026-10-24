# Lesson 7 web page: spec

The Lesson 7 page is the web lesson for "Slides, sirens and your range": written steps, one main toy
in eight states, two predicts, a sung checkpoint of one gentle siren that listens and scores
nothing, two quizzes (the recall and the quick check) and the lesson explorer. Copy is in
[LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a text-only package: no film
exists for Lesson 7, so the page has no Watch section and the masthead's anchors are Lesson, Sing
and Explorer. It is built on the kit (`src/features/lessons/kit/`) and, like Lessons 2 to 6, it
reuses and never copies: a part that still lives in an earlier lesson's module, or that Lessons 2
to 6 plan to promote, moves into the kit first. Where this page shares a behaviour with Lesson 3's
checkpoint (the comfort check, the warm-up, the voice choice, "How did that feel?" and the rest
card), it is Lesson 3's, unchanged unless this spec says otherwise, and after "Effortful" it follows
Lesson 6: no further try, and the rest card in the Wrap.

One object carries the lesson across its steps: the range chart (Toys 1). The siren sweeps it, a
song is placed on it, the push gauge stands beside it, the voice types overlap on it and, at the
checkpoint, the viewer's own siren lands on it. Motion principle 2, "One object carries the story
across shots and keeps its identity" (`research/brand-motion.md` § 3.3), and playbook rule 6 ask
for it, and the CURRICULUM's signature is its moment: "the siren's glowing line sweeping the chart,
with the comfortable band lit and the edges dimmed".

Its public home is `mercurypitch.com/learn/07` (MASTER-PLAN § 12 item 9): a hand-written document
`learn/07.html` with its module in `src/features/lessons/lesson-07/`, wired as Lesson 1's page is.
It publishes only after three things: the vocal coach's sign-off, because it is a voice lesson
(MASTER-PLAN § 7, day 6; § 12 item 8); Lesson 3's page at `/learn/03`, because its prerequisite chip
and its recall check link there (FACTS 2, 3); and the kit parts that Lesson 3's page brings (the
listener, the take reader and the comfort check) with the quiz changes of Lesson 2's page, which
Lesson 3's page already waits for. "What the kit and the app still need", below, lists the wiring
and every kit change.

## Look

Lessons 1 to 6's look, unchanged: the dark listening room, the series colour code, Lesson 1's type
and wordmark, and the motion rules. On this page:

- The range chart is a pitch canvas, so it takes the app's canvas set (FACTS 87; MASTER-PLAN § 5):
  Merc's siren and Merc's "Twinkle" are drawn in target amber `#f59e0b`, the viewer's siren in
  singer violet `#a78bfa`. Violet means the singer only. There is no "off" colour and no in-tune
  mint: nothing on this page is in tune or out of it.
- The lit band is ink `#e6edf3` at low opacity with the word "middle"; the dimmed ends are the
  room's dark with a fine hatch and the words "the ends". Lit and dimmed are always words and
  pattern as well as brightness, never brightness alone.
- Gold `#ffd84d` marks the fit once: the cold open's bracket from "Twinkle"'s lowest note to its
  highest, the slice that fits inside the column, drawn with the tune's beads at the reveal.
- The six voice-type bands and the two singers' range bar are chrome `#c3ccd6` outlines with ink
  labels; a band's name, its span and "probably a soprano" are words, never a colour.

Two things move on their own: the Merc idle loops. Under `prefers-reduced-motion` they stop, and
every transition this page adds lands in its end state with no travel: a siren draws as a whole
line with its glow resting at the turn, a slide or a band move lands at once, and the checkpoint's
band appears without moving. What the viewer starts still sounds. For everyone else the masthead's
Pause animations toggle stops the same two (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Lessons 2 to 6's departures kept: the step toys double as
the Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the
practice card sits in the Wrap. No Watch section (§ 4.2 item 10). Each section's heading, and the
line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 1's (wordmark, "Season 1 · Lesson 07", anchors Lesson, Sing and Explorer,
   the Sound toggle off by default, Pause animations with its reduced-motion lock). `initMasthead`
   takes any map of anchors, and the page's lesson and step deck for the lesson menu
   (`{ lesson: 7, deck }`, `kit/page-chrome.ts`).
2. **Hero**: kicker; the hook question as the title; the meta as four chips ("16 minutes", FACTS 4;
   "After Lesson 3: Match a note", a link to `/learn/03`; Sound on; Microphone optional); the
   promise; the sound gate from LESSON.md in the hero copy; Merc and Tavi on the floor line either
   side of the range chart in its compact state. As built, the hero holds the cold open (item 4) in
   Lesson 2's order, with the recall after it (CURIOSITY-MOMENTS § 3.1, "Place"), and its chart
   shows the column alone, with no siren still: Merc's siren spans the same 9 semitones as
   "Twinkle", E3 to C♯4, so a still of it would answer the predict before the guess. The signature,
   the siren sweeping the chart, is Step 1's.
3. **Recall from Lesson 3**: Lesson 3's questions 1 and 4, for everyone (Toys 5).
4. **Cold open: predict**, in the hero as built: the bubbles, each with its Merc's still, and beside
   them the compact chart showing the column alone; Play "Twinkle" works from the start and plays
   with the tune's beads hidden; the two-choice predict; choosing unlocks Play "Twinkle" on the
   column, which lights the tune's beads one by one as Merc sings them, and once that play has been
   heard to its end the gold bracket and the reveal show (Toys 1, Compact; Toys 2).
5. **Four words you'll meet**: range, siren, lip trill and voice type, each with its definition, a
   small figure and a play or show button (Toys 3).
6. **The steps**: Lesson 1's sticky stage and step deck ("N of 5", Previous and Next), every step
   on the one range chart (`toyFor: () => 1`), in five states (Toys 1):
   1. What does a siren do? Merc's siren sweeping the chart; the care line and the comfort line.
   2. Why lip trills and "ng"? The siren in three sounds; the Go deeper drawer.
   3. How many notes can my voice reach? "Twinkle" on the column, with Slide.
   4. So why is the middle worth more? The push gauge; the mix-up card; the Go deeper drawer.
   5. So am I a tenor, or an alto? The second predict, the two singers and the six bands; the Go
      deeper drawer.
7. **Sing it**: the comfort check, the voice choice, the warm-up, Merc's siren, the briefing, one
   take, the reading and the feeling question (Toys 4). It departs from MASTER-PLAN § 4.2 item 7:
   there is no target band and no cents window, because the siren asks for no note and the house
   rules never score a hum or reward a wide range; the reading only describes where the take's
   middle half sat (FACTS 59).
8. **Quick check**: LESSON.md's four questions (Toys 5).
9. **Wrap**: the three recap lines, the challenge, the practice card in the version Sing it's ending
   picks, and the kit's next-lesson card (`kit/next-card.ts`): Lesson 8's hook, "Coming later" and
   the explorer until Lesson 8 is live, then "Start lesson" to its page. The card is the Vocal Range
   Test card, with "Ten minutes, gently, most days" under it; after "Effortful", "Uncomfortable" or
   "Just listen today" it is the rest card instead, without that line (Toys 4). Only the Vocal Range
   Test card links `/vocal-range-test?lesson=07`, in a new tab; until #1177 the rest card did too.
   Free play unlocks here: every chart control on one stage (playbook rule 17).
10. **Lesson explorer**: the kit's, with Lesson 7 as the current node, the line under its heading
    from LESSON.md, and the state for a lesson with a page and no film (What the kit and the app
    still need).
11. **Footer**: Lesson 1's, with "Season 1 · Lesson 07 · Slides, sirens and your range"; the
    practice link, printed `mercurypitch.com/vocal-range-test`, with "The Vocal Range Test is free,
    in your browser." (FACTS 68a); Lesson 1's fonts line and "Every sound on this page is
    synthesised in your browser" (FACTS, Labels). The test is its own document, so the footer
    needs no first-visit line (FACTS 64).

## Length

The learner copy is 2,477 words today, every branch counted (FACTS 4; 2,480 at `1308fd2e7`), 98 over
the series' cap of 2,379; the text package's 2,361 was level with it then. The page runs about 16
minutes: 10.41 minutes of reading at 238 words a minute and about 6 of sound, toys and tasks, 16.41
in all. That is past MASTER-PLAN § 4.2's 8 to 12 minutes of active time, as Lessons 3, 5 and 6 are
(16, 18 and 17 minutes: Lesson 3 FACTS 61, Lesson 5 FACTS 2, Lesson 6 FACTS 3). Each step's text,
with its Try, its Notice and any predict, runs 99 to 132 words (Steps 1 to 5: 112, 132, 111, 99 and
125), inside § 4.2's 50 to 120 a step but for Steps 2 and 5. Three steps carry more beside it:

- **Step 2, about 200 words.** Its Go deeper drawer (about 60 words) names the evidence behind
  "Studies that test singers are still few", and is closed by default.
- **Step 4, about 235 words.** Its mix-up card (about 90 words) sits in the step whose toy refutes
  it, as in Lessons 2 to 6, and its one-item Go deeper drawer is closed by default.
- **Step 5, about 185 words.** Its predict and reveal, the lesson's second, come before the text,
  and its one-item Go deeper drawer is closed by default.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                                         | New in Lesson 7                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The range chart        | Lesson 3's band chart (`kit/band-chart.ts`, its Toys 6: pitch as height, the canvas colours, the live line and its edge pins); Lesson 6's tune line for "Twinkle" (`kit/tune-line.ts`, its Toys 1); the kit's sound and notes (`kit/sound.ts`, `kit/notes.ts`) | A window per voice group; the column with its lit middle half and dimmed ends; a glowing siren sweep; three sounds on one path; Slide; the push gauge; bands; singers |
| 2. Predict widgets        | Lesson 1's predict, now in the kit (`kit/predict.ts`)                                                                                                                                                                                                          | A predict whose reveal is the drawing: the tune's beads, hidden until the choice                                                                                      |
| 3. Four words             | Lesson 1's strip of figure, word, definition and button (`lesson-01/words.ts`)                                                                                                                                                                                 | Four new figures                                                                                                                                                      |
| 4. Sing it                | Lesson 3's checkpoint (`kit/comfort.ts`, `kit/listen.ts`, `kit/take.ts`, its warm-up, its voice choice on `fyp-voice`, Lesson 1's ring, the feeling question, the rest card); Lesson 6's rest card after "Effortful"                                           | One siren take; the siren reader; the band that settles on the take's middle half; a flow rule                                                                        |
| 5. Recall and quick check | The kit's quiz (`kit/quiz.ts`) with the three changes Lesson 2 makes to it; Lesson 3's questions 1 and 4                                                                                                                                                       | Ids and keys                                                                                                                                                          |
| 6. Go deeper drawers      | Lesson 2's `details` drawer                                                                                                                                                                                                                                    | Three drawers                                                                                                                                                         |

### 1. The range chart

One component, `kit/range-chart.ts`, in eight states: compact, siren, sounds, song, push, types,
live and free play.

- **Drawing.** Pitch is height (playbook rule 20): one faint row per semitone with a tick, set
  bottom to top. A 34 px gutter on the left names the C and A rows in the app's sharp spelling
  ("C3", "A3"); no other row is named. In the siren, sounds, song, push and live states the window
  holds every preset of the voice shown: E2 to C5 for the lower voice, F3 to C6 for the higher
  (FACTS 87); Step 5's view is E2 to C6 for either voice. The voice is `fyp-voice` if stored, else
  the lower. The voice switch, two buttons with `aria-pressed`, "Lower voice" and "Higher voice",
  on a row of their own under the canvas in the siren, sounds, song and push states, changes the
  chart's voice for the visit and stores nothing. At the plot's left stands the column, a bar two
  octaves tall, A2 to A4 (or A3 to A5): its middle half, D♯3 to D♯4 (or D♯4 to D♯5), lit and
  labelled "middle", and its outer quarters dimmed and labelled "the ends" (FACTS 35). To its right,
  time runs left to right for every line.
- **Compact** (the hero, which holds the cold open): no names and no controls on the chart, which
  shows the column alone; as built there is no siren still (Sections, item 2). Play "Twinkle" sounds
  the tune's first two lines with no beads drawn and nothing on the chart that shows their height
  (FACTS 83). As built, the choice is not the reveal, since the reveal waits until it is heard
  (CURIOSITY-MOMENTS § 1, rule 2): the choice unlocks Play "Twinkle" on the column, which draws the
  tune's fourteen beads joined by a line across the column, from E3 (or E4), one by one as Merc
  sings them, each lit while it sounds. Once that play has been heard to its end with the sound on,
  a gold bracket joins the tune's lowest note to its highest beside the column and the reveal shows;
  a play that sound off kept silent, or that another sound cut short, takes its beads away again.
  After the reveal either Play lights the beads in turn. The drawing is `aria-hidden`, and a polite
  live region speaks for it: before the reveal, "Twinkle, Twinkle, its first two lines", naming no
  note; after it, "Twinkle, Twinkle, from E 3 up to C sharp 4 and back: 9 of the column's 24
  semitones" (`lesson-07/cold-open.ts`).
- **Siren** (Step 1): Merc's siren (FACTS 82), an amber line drawn left to right as it sounds, its
  head glowing, turning round inside the lit middle. **Play** (Pause while playing), **Slow** (half
  speed, 12 s) and a **scrub** bar, as every animation has (MASTER-PLAN § 4.2 item 5); scrubbing
  draws the line to that moment without sound.
- **Sounds** (Step 2): the siren state, with three buttons, "ng", "Lip trill" and "oo"
  (`aria-pressed`, one pressed at a time, "ng" first). Play plays Merc's siren in the pressed sound
  (FACTS 82); the line is drawn from the same path every time and never changes.
- **Song** (Step 3): "Twinkle"'s line on the column, with **Start lower**, **Start higher** (a
  semitone a tap) and **Play “Twinkle”**. As built, the chart draws the tune's beads itself, on its
  own semitone rows (`kit/range-chart-draw.ts`, `drawBeads`), in the look of Lesson 6's tune line,
  beads joined by a faint line: every copy of that tune line is its core on a canvas of its own
  (`kit/tune-line.ts`), and the song must sit on the column's rows. Do runs from the
  column's bottom to 15 semitones up, so the tune never leaves the column, and opens on E3 (or E4)
  (FACTS 84). With a mouse or pen a vertical drag also slides it; on touch the stage keeps
  `touch-action: pan-y`, as Lesson 1's does (`kit/lesson-stage.css:787`), so a swipe scrolls
  the page and the buttons slide. The beads carry no names. A readout names the move and the place,
  never the key: "Moved up 2 semitones: all of it in the lit middle", "reaching into the dimmed top
  end" or "reaching into the dimmed bottom end", so no note needs a key's spelling. From E3 the tune
  stays wholly in the lit middle for moves of 1 down to 2 up.
- **Push** (Step 4): a note on the column, drawn as a bead, starts at the column's bottom, A2 (or
  A3); to the column's right a horizontal gauge, labelled "push for its quietest note", with "less"
  and "more" at its ends and no numbers, fills along the illustrative curve of FACTS 85,
  p = ((s − 8) / 16)² for s semitones above the column's bottom: lowest a third of the way up, at F3
  (or F4), and rising most towards the top; the fill is 12 % of the gauge plus 88 % of p.
  - **Lower** and **Higher** move the note a semitone a tap and stop at the column's ends. Pressed
    and held, either repeats every 150 ms after 400 ms, so a held Higher climbs the whole column in
    under 4 s: the step's Try. The repeat runs from `pointerdown` to `pointerup`, `pointercancel` or
    `pointerleave`; both buttons take `touch-action: manipulation`, `user-select: none` and
    `-webkit-touch-callout: none`, and swallow `contextmenu`, so a long press on a phone repeats
    instead of selecting text or opening a menu. By keyboard, Enter or Space moves a semitone.
  - The note also drags, by its own handle: a 44 px square centred on the bead, with
    `touch-action: none` on the handle alone and pointer capture from `pointerdown`, so a vertical
    drag that starts on the handle moves the note a semitone at a time, while a swipe anywhere else
    on the stage still scrolls the page, as the stage keeps `touch-action: pan-y`.
  - While the note moves, Merc's "ooh" sounds it at one fixed, quiet level, since the gauge draws
    what the note needs, not how it sounds. Small print under the gauge: "An illustration of what a
    small study suggests: the shape, not measurements."
  - The readout names the note and the push in the curve's words (FACTS 85): "F3: the least push,
    the curve's lowest point"; "nearly the least push" from D♯3 to G3; "a little more push" from
    A♯2 to D3 and from G♯3 to C4; "more push" at A2 and from C♯4 to F4; "much more push" from F♯4
    to A4; the higher voice an octave up. So the dimmed bottom quarter reads "more push" or "a
    little more push", and a note can sit in the lit middle and read "more push".
- **Types** (Step 5): Toys 2's predict comes first. Choosing unlocks **Singer A** and **Singer B**
  (`aria-pressed`): one range bar from A3 to C6 with that singer's comfortable band lit, E4 to E5
  for A and C4 to C5 for B, and the words "probably a soprano" or "probably a mezzo-soprano" (FACTS
  86). **Show all six** draws the app's six bands as overlapping columns, low to high, each with its
  name and span written up the column. As built, the columns take no taps, as no part of the chart
  does: their six buttons sit under the canvas, low to high, three a row, each playing its band's
  middle note in the soft tone for a second, lighting its column and saying its span in the
  chart's summary ("Tenor: C 3 to C 5"). The singers and the bands share one view, E2
  to C6, whatever the chart's voice, and the voice switch is hidden here. Small print: "The broad
  bands the Vocal Range Test uses. Books draw them differently: two put the soprano's top seven
  semitones apart." (FACTS 40, 41).
- **Live** (Sing it): Toys 4.
- **Free play** (Wrap): the sounds switch, Slide, the push gauge, the two singers and the six bands
  on one stage, under one state switch: five buttons with `aria-pressed`, "Siren", "Sounds", "Song",
  "Push" and "Types", one pressed at a time, "Siren" first, in two rows of three and two above the
  state's own controls. Switching keeps each state's settings for the visit (the pressed sound, the
  slide, the note, the singer), and the voice switch shows in the four states that use a voice.
- **Layout and targets** (FACTS 88). Every target is at least 44 px square, with 8 px between
  neighbours, at every width from 344 px up, and no chart row is a target:
  - On phones (960 px and under, where the stage sits above the text) the figure spans the card's
    inner width, as Lessons 2 and 6 do on phones. Measured from Lesson 1's stage CSS at 390 x 844,
    the stage card is 358 px inside the 16 px gutters and the figure's canvas 354 px. As built the
    canvas runs to the card's edges, 356 px, and the controls under it share the 332 px inside
    the card's padding (`kit/range-chart-layout.ts`, `canvasWidth` and `stageInner`).
  - The chart's canvas is 288 px tall, under Lesson 1's 310 px tall figure at 420 px and under: the
    line window's 32 semitones get 8.25 px each and Step 5's 44 semitones 6.00 px each, so each band
    stands 144 px tall. With the stage head and at most five rows of 44 px controls (free play's
    siren state: the voice switch, the state switch's two rows, Play and Slow, the scrub bar), the
    stage stays under about 650 px, inside the 786 px left below the masthead. Beside the text the
    stage is stuck, so it also meets the kit's landscape budget: every step's stage fits 1024 x 640
    with the masthead, its chrome (the stage less the chart) under about 375 px
    (PRODUCTION-PIPELINE.md § 5).
  - The six band columns share the plot beside the 34 px gutter: as built, 52.0 px each at 390 px,
    44.3 px at 344 px and 101.1 px at 1440 px. "Mezzo-soprano" will not fit across them, so each
    band's name and span run up the column, bottom to top, in about 127 px of its 144 px at 12 px
    type.
  - Controls sit under the canvas in rows: the voice switch on a row of its own, two buttons at
    162.0 px each at 390 px (139.0 px at 344 px), as built; the sounds and the six bands' buttons
    three a row at 105.3 px (90.0 px); Play and Slow, Singer A and Singer B, Start lower and Start
    higher, and Lower and Higher two a row at 162.0 px; free play's state switch three and then two
    a row. The scrub bar spans its row, with a 44 px thumb, and the push note's handle is a 44 px
    square.
- **Keyboard and screen readers.** The chart is a group with a live summary in spoken names, never
  the sign: "Merc's siren, from E 3 up to C sharp 4 and back", "Twinkle, moved up 2 semitones: all
  of it in the lit middle". Play, Pause, Slow, the state's buttons and each band are buttons; the
  three sounds, the two singers, the voice switch and free play's state switch carry
  `aria-pressed`. The scrub bar is a slider (`role="slider"`, 0 to 6 seconds, `aria-valuetext` such
  as "2.1 seconds of 6: going up, near B 3"); the push note is a slider too, named "Note for
  the push gauge", a semitone an arrow key, Home and End for the column's ends, its
  `aria-valuetext` the curve's words, such as "F 3: the least push, the curve's lowest point", "C
  sharp 4: more push" or "A 2, the bottom of the column: more push". No two controls on the stage
  share a name: the voice switch's buttons are "Lower voice" and "Higher voice", and the push
  buttons show "Lower" and "Higher" with the names "Lower note" and "Higher note", each name
  beginning with its visible label. Each band is "Tenor, C 3 to C 5: play its middle note, C 4".
  Tab order: in free play the state switch first; then the voice switch where it shows, Play, Slow,
  the scrub bar, the state's own controls, then the bands, low to high.
- Under reduced motion a siren draws as a whole line at once; a slide, a note's move and the cold
  open's beads land at once; and nothing glows in a pulse; a played sound still sounds. As built,
  the siren's Pause then stops the sound with the whole line left drawn, and Play starts the siren
  again from its beginning, since a line drawn whole has no moment to carry on from; the cold open's
  beads stand in place from the start of a play and light in turn.

### 2. Predict widgets

- Both are Lesson 1's widget: the choice locks, the reveal never calls a choice wrong, two choices
  each, every button at least 44 px tall.
- The cold open's Play "Twinkle" works before the choice, so the sound comes first (playbook rule
  5), and it plays with the tune's beads hidden, so the chart cannot answer the question before the
  guess (playbook rules 2 and 3; FACTS 83). As built, the reveal waits until it is heard
  (CURIOSITY-MOMENTS § 1, rule 2; `kit/predict.ts` with `revealOn: ['column']`): the choice unlocks
  a second button under the choices, Play "Twinkle" on the column, whose play draws the beads one by
  one, and once it has been heard to its end with the sound on, the gold bracket and the reveal's
  text, the tune's span against the column, show. The lock hint reads "Choose an answer to unlock
  Play “Twinkle” on the column." before the choice, "Locked in. Play “Twinkle” on the column: each
  note lights as Merc sings it." after it, and "Play “Twinkle” again, and watch where the slice
  sits." after the reveal. With sound off, Lesson 1's hint (`lesson-01/predict.ts:48-49`), made
  singular, "Sound is off, so nothing played. Turn sound on to hear it.", shows instead, and the
  reveal waits.
- Step 5's predict needs no sound: choosing shows its reveal and unlocks the two singers.
- States: waiting for a choice, the column alone; a sound playing, beads still hidden; choice made,
  Play "Twinkle" on the column unlocked; that play sounding, its beads lighting one by one; that
  play heard, beads, bracket and reveal shown.
- Under reduced motion the beads, the bracket and the reveal appear at once.

### 3. Four words

Lesson 1's strip: Range shows the column with its two ends lighting in turn; Siren plays Merc's
siren on "ng"; Lip trill plays it on the trill (FACTS 82); Voice type shows the six names in their
bands. Each button names what it does ("Play Merc's siren, on ng"; "Show the six voice types").

### 4. Sing it: one gentle siren

The range chart in live mode, with Merc's amber siren as the shape and the viewer's line drawn
against the window. Every state has a visible status line that is also announced
(`aria-live="polite"`). Nothing is scored and nothing is celebrated (FACTS 59).

States:

1. **Comfort check**, always first and asked every visit (never stored): Lesson 3's comfort line,
   its list naming all six of REQ-GVC-020's conditions, and its two buttons (FACTS 48, 50), through
   the kit's comfort check (`kit/comfort.ts`).
2. **Voice choice**, after either comfort answer: Lesson 3's two buttons with Merc and Tavi's stills
   (`aria-pressed`, at least 44 px), under LESSON.md's line, in two forms: "Keep the voice you chose
   before, or change it:" with a choice stored, and "Choose a voice to sing with. If you chose one
   in an earlier lesson, pick it again:" with none. Read from and written to `fyp-voice` inside
   try/catch (FACTS 54). A stored choice shows pressed and can be changed; with none stored, neither
   is pressed and the next state waits for a choice, before "Just listen today" plays anything too,
   because the voice picks the Merc who sings, as on Lessons 5 and 6's pages.
3. **Just listen today** (listen-only mode): LESSON.md's line with the doctor lines (FACTS 52, 53);
   **Play Merc's siren** sings it on a tap in the chosen voice, the chart drawing Merc's line;
   nothing listens, the warm-up and Start are not shown, and nothing asks the viewer to sing
   (REQ-GVC-021). The Wrap shows the rest card.
4. **Warm-up**, optional, with Skip: Lesson 3's two cards and words, each with a play button for
   Merc's demonstration in the chosen voice, with "Copy the way Merc's voice slides, not the exact
   notes" and the stop line (FACTS 55). Nothing listens and nothing is scored (REQ-GVC-074,
   REQ-GVC-075). The Skip is stored as `fyp-l07-warmup`, as Lessons 3 and 5 store theirs.
5. **Your turn and briefing**: LESSON.md's Your turn text, the stop line on its own line, the "What
   this does" box (REQ-GVC-002, REQ-GVC-003, REQ-GVC-012, REQ-GVC-026), **Play Merc's siren** and
   **Start**, the only control that asks for the microphone (MASTER-PLAN § 4.2 item 2). Start is
   `aria-disabled` until Merc's siren has sounded once this visit, with the hint "Play Merc's siren
   first" (hear it first: playbook rule 16). With sound off, Play Merc's siren draws Merc's line and
   plays nothing, so Start stays unavailable and the hint says why: "Sound is off, so nothing
   played. Turn sound on to hear Merc's siren, then press Start." That is Lesson 1's rule, as
   Lessons 5 and 6 apply it: what waits on hearing a sound waits while the sound is off.
6. **Take**: the status reads "Breathe, then hum one siren on "ng", up and back. We stop listening
   when you stop." The take opens when the microphone is ready, waits up to 6 s for the first voiced
   frame, then runs until the voice has been quiet for 1.0 s after at least 2.0 s of voice, or for
   10 s from the first voiced frame, whichever comes first; nothing on the page extends it (FACTS
   58). The violet line draws live on the window from the left; a frame outside the window pins to
   the chart's top or bottom edge with a small arrow and no number. Merc's line stays on the chart,
   faint, for the shape. Lesson 1's ring turns slowly while the take is open, one turn every 6 s
   whatever the take's length, and shows no seconds, so it never reads as a time to fill. The
   microphone is released when the take ends.
7. **Reading**: one line from the siren reader (below). For a reading with a band, the lit band
   moves from the column's middle half to the middle half of the viewer's siren, or to its one
   centre note under three semitones, labelled "middle half of your siren" (or "middle of your
   siren"), with the rest of the window dimmed: the signature, the siren's glowing line with its
   middle half lit and the edges dimmed. The window never moves, so a band that reaches past its
   top or bottom is drawn to that edge, with the live line's small arrow on the cut side and no
   number, and a band wholly outside it is drawn as a 6 px strip along that edge with the arrow;
   the text summary then adds "above the chart" or "below the chart", and the reading line names
   the band's notes either way. If no voice came within 6 s, the line is Lesson 5's, with this
   task's cue: "We didn't hear you start that time. Hum "ng" as the ring turns.", with **Again**
   (while the visit has had fewer than three takes; this take counts) and **Done for today**, and
   no feeling question, since nothing was sung. Otherwise **How did that feel?** follows at once
   (REQ-GVC-022).
8. **How did that feel?**: Lesson 3's four answers (`aria-pressed`, at least 44 px, a 2 x 2 grid on
   phones), asked afresh after each take with voice (FACTS 60):
   - Easy or Workable after a reading with a band: LESSON.md's line, "That's it: one gentle siren,
     done. The lit band shows where its middle notes sat today.", with **Again** if the visit's one
     Again is unused and fewer than three takes have been made, and **Done for today**. The Wrap
     shows the Vocal Range Test card.
   - Easy or Workable after an unsteady take, which lit no band: "That's it: one gentle siren,
     done." alone, naming no band; when Again is offered, on the same two conditions, "Try again at
     about speaking volume." follows it, and otherwise nothing does; then **Done for today**. The
     Wrap shows the Vocal Range Test card.
   - Effortful: Lesson 3's "Keep it gentle: rest before you sing again.", no Again and no further
     siren this visit (REQ-GVC-021: a report of effort suppresses immediate-repeat encouragement).
     The Wrap shows the rest card, because the practice card asks for two more glides and more
     singing, and the app never raises the dose after effort (REQ-GVC-055; LESSON.md, For the vocal
     coach, to confirm).
   - Uncomfortable: Lesson 3's "Thanks for saying so. That's enough singing for today: rest your
     voice.", the doctor lines, no Again and no further siren; the reading's band and line are
     taken away (Lesson 3 shows no count after it). The Wrap shows the rest card (REQ-GVC-023,
     REQ-GVC-024, REQ-GVC-055).
   - An answer can be changed until the next take or Done for today. Changing to Effortful or
     Uncomfortable takes Again away; once either has been picked, no further siren and the rest
     card stay so for the visit, whatever is picked after. The page keeps the ending in memory for
     the visit, never in storage.
   - **Done for today** ends the takes, not the card: the question, its answer and its lines stay,
     and the answer locks as it stands, as Lesson 3's does after its one answer: the four buttons
     are disabled, the one picked still pressed, and its lines, band and Wrap card stay as they
     are. No Start, Again or Done for today comes back. Until #1192 an answer changed after Done
     for today emptied the card, the question with it, and left only the reading's line; from
     #1192 until #1195 it could still be changed, and on 24 October 2026 the owner chose the
     lock.
9. **No microphone** (refused, no device, or the listener failed to load): listen-only mode with
   LESSON.md's line; Merc's siren still plays, and the Wrap keeps the Vocal Range Test card, since
   singing along with nothing listening is no report of effort (Lesson 3's rule). Without Web Audio
   (no `AudioContext` in the browser), nothing can play and the listener cannot run, so Sing it
   offers this listen-only path at once, with no Start: Play Merc's siren draws Merc's line in
   silence, with the hint "This browser can't play sound here."

The retry rules, all in the flow rule below (FACTS 58):

- A visit allows at most three takes. Every take counts: one with no voice, an unsteady one, and one
  abandoned when the page was hidden or the section left.
- Again after "Easy" or "Workable" is offered at most once a visit, whatever the take's reading, so
  the retry that follows an unsteady take is the visit's one Again: a not-steady take uses it up
  only if Again is pressed after it.
- A take with no voice asks no feeling question; its Again is a fresh start and leaves the visit's
  one Again unused. A take abandoned when the page was hidden or the section left asks none either,
  and Start comes back while takes remain, but if it had voice it uses the one Again up (Edge
  cases).
- Never a retry after "Effortful" or "Uncomfortable": once either has been picked, no Again and no
  Start appear for the rest of the visit.
- "Try again at about speaking volume." shows only beside an offered Again. So a visit holds at most
  three takes and two sung sirens.

The flow is a pure rule (`lesson-07/siren-flow.ts`), as Lesson 6's sing-along is: from the comfort
answer, the voice, whether sound and Web Audio are on, whether Merc's siren has sounded, the takes
so far (how many, and for each whether it had voice, whether it lit a band and whether it was
abandoned), whether the visit's one Again has been used, and the answers so far (the latest, and
whether "Effortful" or "Uncomfortable" was ever picked), it gives the state, the controls shown, the
lines and the Wrap's card, so every branch above is unit-tested without a microphone (Tests, 7).

Reading a siren (`kit/take.ts`, extended with `readSiren`; pure and unit-tested):

- Input: the take's raw frames. A frame is voiced when Voice Mirror's `preprocess` keeps it
  (confidence floor and median filter), as Lesson 3's reader takes them (its Toys 7).
- No voiced frame within 6 s of opening gives the "didn't hear you start" line (state 7).
- The attack comes off first, from the raw frames: drop every raw frame within 0.3 s of the first
  voiced one, Lesson 3's attack rule. Under 1.0 s of voiced frames left gives "We didn't hear a
  steady siren that time.", never a low reading (REQ-GVC-031).
- Otherwise the notes come from `computeRange([frames])` in `src/lib/mirror/metrics.ts`, imported,
  not copied, given the trimmed raw frames, which it preprocesses itself (`:164`): the semitones
  the take dwelt on for 0.15 s in all, after its outlier guard (FACTS 67a). If it returns null, the
  line is the not-steady one. Its `lowNote`, `highNote` and `semitones` never reach the page.
- The band: when the notes held span under three semitones (`highMidi - lowMidi < 3`), one note,
  the centre, `Math.round((lowMidi + highMidi) / 2)`; otherwise `middleHalf(lowMidi, highMidi)`.
- `middleHalf(lowMidi: number, highMidi: number): { low: number; high: number }` is a new export
  from `metrics.ts` (`:353-368`): `low` is `Math.round(lowMidi + span * 0.25)` and `high` is
  `Math.round(highMidi - span * 0.25)`, with `span = highMidi - lowMidi`, exactly the p25 and p75
  that `pickMatchTargets` computed, which now calls it (`:380`). So `pickMatchTargets`'
  callers, `src/lib/mirror/session.ts:125` and
  `src/features/onboarding/beats/BeatVoiceprint.tsx:427`, see no change, and the page and the Vocal
  Range Test share one rule (FACTS 35). The parity test sits in `src/lib/mirror/metrics.test.ts`,
  beside the `pickMatchTargets` tests (`:452-518`).
- The line: "The lit band is the middle half of your siren: about {low} to {high}.", or, for one
  note, "The lit band is the middle of your siren: about {note}." Notes are named with
  `midiToNoteNameOctave` (`src/lib/note-utils.ts:38-40`, the app's sharp spelling, "C#4"), shown
  with the sign ("C♯4") and spoken in words ("C sharp 4") through a small formatter in
  `kit/notes.ts`.
- No reading names a span or an end of the siren. From three semitones up the middle half holds
  neither the lowest nor the highest note held: a quarter of a span of three or more is at least
  0.75 semitone, so rounding to the nearest note leaves at least one semitone at each end. Below
  three it would not: at a span of 1 the middle half is both notes, and at a span of 2 a quarter is
  exactly half a semitone, which `Math.round` rounds up, onto the highest note. Hence the centre
  (FACTS 59). Nothing is compared with an earlier take or another visit (REQ-GVC-072).
- Every template passes `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts`, surface
  `finding`) in a unit test.

Listening: Lesson 3's `kit/listen.ts`, unchanged: `micManager.acquire('lesson-07')` for the take,
released when it ends, on leaving the section, on `pagehide` and when the tab is hidden; the
YIN-only F0 stream (`src/lib/pitch-f0-stream.ts`); one AudioContext through `Sound.context()`;
nothing plays while a take is open, and the take opens at least 0.4 s after any sound has ended, as
in Lesson 3. As built, leaving the section is `#sing` out of view for 600 ms (`lesson-07/sing.ts`),
and since a tall panel giving way to a short one can leave the card above the screen on a phone,
after Start, the card brings its top back into view whenever its panels change, before that watch
sees it gone, as Lesson 3's card does (`lesson-03/sing-view.ts`). Nothing is recorded or kept,
nothing leaves the device, and no event carries the band, a note or an answer. No checkpoint event:
`lesson_answer` covers only the quick check and the recall; a count-only "checkpoint finished" event
(REQ-GVC-090; FACTS 62) is not built.

Accessibility and motion: the band is words plus the lit fill, never colour alone (REQ-GVC-082).
After a take the chart's text summary reads, for example, "Your siren, drawn as a line; the middle
half of it lit, about G 3 to C 4" (REQ-GVC-085). Start, Again, Done for today, the comfort and
voice buttons and the four feelings are real buttons of at least 44 px in a keyboard order that
follows the flow; a button the flow does not offer is absent, not disabled, except Start's wait for
Merc's siren; Space never starts a take by itself (REQ-GVC-080). Under reduced motion the live line
draws on a fixed frame that never scrolls, the band appears in place, the ring holds still with the
word "Listening", and Merc and Tavi skip their reactions (REQ-GVC-083).

### 5. Recall and quick check

Two quizzes share this page, so it depends on the three changes Lesson 2 makes to `kit/quiz.ts`
(its WEB-SPEC, "What the kit and the app still need"), which are on main: an id prefix for the
elements each quiz binds and writes (`kit/quiz.ts:88-93`, `:220-224`); `lesson` optional, since the
kit marks `lesson` done once every question has an answer (`:82-83`, `:344-349`); and a question
`id` (`:42-47`).

- **Recall**: Lesson 3's questions 1 and 4, word for word with their feedback (LESSON.md; FACTS 3),
  under their Lesson 3 ids, `l03-q1` and `l03-q4`, shown to everyone (Lesson 3 is a prerequisite).
  Reshuffled from a seed of its own (keys `fyp-l07-recall-seed` and `fyp-l07-recall-v1`); earlier
  answers are never shown, so the answers measure delayed retrieval (MASTER-PLAN § 9). It takes no
  `lesson`, so it marks nothing done. Neither question plays a sound. Question 1's "Try Lesson 3,
  Step 1 again" links to Lesson 3's page at that step, `/learn/03#step-1`, opening in a new tab so
  the viewer keeps their place here, as Lesson 5's recall links them: the quiz's `away.href` is
  `recallStepHref` (`lesson-05/quiz-questions.ts:19-20`, `lesson-05/recall.ts:21`), where the kit's
  default would open `/learn/03#lesson` (`kit/quiz.ts:94-101`). It is never `data-goto-step`, which
  would move this page's own deck (`kit/quiz.ts:352-369`). Question 4 has no step link.
- **Quick check**: LESSON.md's four questions, ids `l07-q1` to `l07-q4`, keys `fyp-l07-seed` and
  `fyp-l07-quiz-v1`, and `lesson: 7`, so answering all four marks Lesson 7 done in the explorer.
  Three answers each, shuffled per question from the stored seed, one-line feedback for every
  answer, and a check icon and ink (not gold) on the right one. The kit prints "Right." or "Not
  quite." before each line (`kit/quiz.ts:315`), so no feedback line starts with "Right", "Yes" or
  "Correct". "Try Step 1 again", "Try Step 2 again", "Try Step 4 again" and "Try Step 5 again" use
  the kit's `data-goto-step`. Answers stay in the viewer's browser; since #1193 each question's
  first answer in a visit also goes out, anonymously.

### 6. Go deeper drawers

`details` disclosures, closed by default, under the text of Steps 2, 4 and 5, holding LESSON.md's
items.

## Audio

Every tone is synthesised in the page with Web Audio at the frequencies in FACTS 81, through the
kit's sound module and its house envelopes (`.claude/memory/audio-pop-free-playback.md`), and
started only by a tap: Merc's siren and "Twinkle" in Merc's "ooh", the bands' notes in the soft
tone, the push gauge in Merc's "ooh" at one quiet level. Two kit additions (FACTS 82): a voice that
follows a pitch path, ramped even in semitones (exponential in hertz), for the siren; and two
timbres on Merc's "ooh", "ng" (a 900 Hz lowpass) and a lip trill (a 22 Hz level wobble of 70 % depth
over a soft band of breath noise). Nothing autoplays, one sound plays at a time (a new tap stops
the last), nothing plays while a take is open, and the page has no music bed.

## Merc and Tavi

Lesson 1's setup through the kit (`kit/merc-duo.ts`, `kit/merc-warm.ts`): the app's renderer loaded
after first paint, one WebGL context per Merc, medium quality on phones, turned towards each other,
paused off screen, and the still images when WebGL fails or would run on the CPU.

- They live in the hero, and their reactions are the hero pair's: the Merc of the chart's voice
  `sing`s while the cold open's "Twinkle" sounds (Merc for the lower voice, from E3; Tavi for the
  higher, from E4), and Tavi `celebrate`s once after the cold-open reveal (no sparkles), the
  puzzled guesser who then gets it (playbook rule 15). The same rule picks the singing Merc wherever
  Merc's siren sounds.
- `merc-duo.ts` has `mercSing`, `mercListen` and `mercCelebrate` (`:164`, `:206`, `:217`), so this
  page needs no other state: the Merc who is not singing idles, and both idle during a take. Three
  states the renderer already has would suit it, proposed: `listen` for the take, which the kit has
  since Lesson 3's page added `mercListen`; and `ride` and `hum`, which
  `src/lib/merc/constants.ts` lists for the glide rooms ("humming, and riding the voice",
  `:24-26`) and MERC-BIBLE § 5 gives to "riding a glide (sirens, slides)", so the singing Merc
  would `ride` Merc's siren, and `hum` it on "ng", in place of `sing`. Without `ride` and `hum` in
  the kit, the page uses `mercSing` and idles, as above.
- Nothing celebrates in Sing it: a hum is never scored or celebrated as an achievement (FACTS 59).
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, the Vocal Range Test.** `mercurypitch.com/vocal-range-test`, on the public host
  `/vocal-range-test?lesson=07`, which Lesson 7's season entry already carries (FACTS 71). It is its
  own document, booting Voice Mirror's entry with the range intent, so a first visit meets no First
  Light; a first guided run shows the test's own overview, and in the UK and the EEA a cookie
  banner, both screens of its own with their own buttons, so the card needs no first-visit line
  (FACTS 64). It runs Voice Mirror's two glides and a hold, then a screen naming a famous singer of
  the voice type the range overlaps most, then five match notes picked from the middle half of the
  range the glides found; it shows the range first, with the span and the overlapping voice type as
  "a broad guide, not a verdict", then Accuracy and Steadiness scores (FACTS 65a to 69a). The card
  comes in two versions, picked by how Sing it ended (Toys 4). The rest card, a link until #1177,
  now links nowhere. The `?lesson=` marker changes nothing in the test: the main app's step-aside
  never runs in the test's own document, and the test's intent reads only the path (FACTS 64, 72a).
- **App content, small** (the App content track): on main since `7ed2aa1d2` and `e37bbba59`, all
  but one sentence, which stays proposed:
  - The twin screen after the hold now reads "{Legend}: a famous {type}, the voice type your range
    overlaps most. A broad guide, not a verdict." (FACTS 69a). Its old line, "{Legend} shares your
    voice type. That is yours now: it is on your voiceprint whatever happens next.", assigned a
    voice type from range alone, which Step 5 says range cannot decide (FACTS 69).
  - The test asks for "your highest comfortable note" in the first glide and the overview's card,
    the landing's lede, and the entry page's descriptions and lede, as REQ-GVC-072 and the card's
    "keep the glides comfortable" ask (FACTS 70b). Proposed: the entry page's structured data,
    added since, says "a glide from the lowest comfortable note to the highest"; "to the highest
    comfortable note" would match.
  - The results' clause about the ear being ahead is gone: the task measured the voice, not the ear
    (REQ-GVC-045; FACTS 69a).
  - The returning visitor's change line gives each reading earlier then today, with no arrow and no
    sign, and calls a reading "similar" only when it is unchanged (FACTS 70c; REQ-GVC-065,
    REQ-GVC-066).
  - The warm-up ends with no grade, score or level, and its help no longer says that warming up
    "protects your cords" (FACTS 75a, 76a).
- **Needed, proposed: `/exercises/lip-trills`** (CURRICULUM § 4 item 2, the Phase 1 App track): the
  Guided Warmup on its Lip trills routine, registered in `EXERCISE_SLUGS` as
  `{ kind: 'exercise', exercise: EXERCISE_WARMUP, pattern: 'lip-trill' }` with a line in
  `src/tests/slug-map.test.ts`. Beyond the entry it needs (FACTS 73 to 76a):
  - the `pattern` field on `ExerciseLaunch` (`src/features/exercises/slug-map.ts:25-41`), passed by
    `applyExerciseSlug` into the launch override beside the notes and the difficulty
    (`src/App.tsx:754-765`); the override's config already carries `pattern`, and the warm-up
    already reads it (`WarmupExercise.tsx:61`);
  - the coach's decision on the routine's first block, a breath held for four counts, which Lesson
    5 chose not to link (FACTS 74; Lesson 5 FACTS 65). If the coach says no, the slug needs a new
    routine without it, added under a new pattern name, since routine segments are keyed off the six
    existing names, which therefore do not change (`warmup-exercises.ts:338-345`);
  - `?lesson=07` on the link, because a slug boots the main app, where First Light opens on a first
    visit unless the marker steps it aside (FACTS 72a), so LESSON.md's editorial copy carries no
    first-visit line.
  - Met on main since `e37bbba59`: the two app changes the link waited on, because the house rules
    never score a lip trill and make no health claims. The warm-up ends with no grade, score or
    level (`WarmupExercise.tsx:324-331`, `:362-368`; `ExerciseShell.tsx:108-116`), and its help no
    longer says that warming up "protects your cords" (`exercise-help.ts:23`; FACTS 75a, 76a).
  - Not a condition, for the director: the warm-up still saves each run, with its coverage score,
    to the exercise history, where it ticks off the first segment of Today's Session and earns
    practice time, the streak and badges; no screen the link opens shows it. It no longer moves the
    exercise's difficulty (`WarmupExercise.tsx:305-322`).
- **Not linked**, with the reasons in FACTS: the Siren exercise (FACTS 77), which Lesson 11's card
  plans with a slug; the Sing screen's premium rooms Lip roll and Ng slides, and its premium
  Warm-up, which runs those two rooms first (FACTS 78); the Ascent's week 3 (FACTS 79), until the
  App content track rewrites it (CURRICULUM § 4 item 8); and the warm-up's Sirens routine, which
  opens with the same held breath and glides a whole octave on "Ooo" (`warmup-exercises.ts:221-244`,
  `:358-364`).
- When the slug ships, LESSON.md's editorial note gives the copy, and the explorer card's `needs`
  gives way to a second link.

## Explorer and season data

- **Season data**: Lesson 7's entry in `kit/season.ts` (`:285-302`) gains `minutes: 16`
  (FACTS 4) and, proposed, `needs: "the warm-up's Lip trills routine (a pattern slug)"`, the form
  Lesson 5's entry uses for its own missing drill, for the team and never drawn on the card; the
  warm-up's ungraded end, which the proposal used to name, is on main (Practice links). Its link,
  hook, signature and topics stay (FACTS 71).
- **A text-only lesson**: the "Ready · read" state Lesson 4's spec proposes (no Watch button, the
  card's length from `minutes`), the current lesson (the page passes `current: 7`), and cards for
  other lessons linking to their own `/learn/NN`: the kit has all three.

## What the kit and the app still need

Found in the kit and the app as they stand on main (19 October 2026, `51f1c53de`), beyond the parts
Lessons 2 to 6 promote into the kit (Toys table). Read again on main at `31b7f53e9` (20 October
2026): an item main has met since says so, and the line references are main's.

1. The lesson host: `learn/07.html` at `/learn/07`. On main the dev and preview servers and the
   build take every `learn/NN.html` as a lesson page, with no entry of its own
   (`vite.config.ts:78-87`, `:147-149`, `:489`), and the site worker keeps a draft out of production
   until its sign-off or until the console publishes it (`src/lesson-gate.ts:32-36`;
   `kit/drafts.ts`). Built: `/learn/07` and `/learn/07.html` in `STANDALONE_DOCUMENT_PATHS`
   (`src/lib/sw-runtime.ts`, as `/learn/01` is). Left out on purpose: `public/sitemap.xml` and
   Lesson 7 in `public/llms.txt`'s "Lessons" list, since the site worker lists a draft there while
   the admin console publishes it, and its release adds it for good.
2. The page's head, as Lesson 1's (`learn/01.html`). As built, held to the head checks of
   `src/tests/lesson-pages.test.ts` (a title of at most 60 characters, a description of at most
   160): title "Your vocal range: slides, sirens and comfort | MercuryPitch" (SEARCH.md § 4; built
   as "Slides, sirens and your range | MercuryPitch" until #1187), and `og:title` "Slides, sirens
   and your range · Find Your Pitch, Lesson 7"; meta description "Why is your comfortable middle
   worth more than your highest note? A sixteen-minute lesson on gentle sirens, lip trills and “ng”,
   your range and voice types."; canonical and `og:url` `https://mercurypitch.com/learn/07`;
   `og:image` `public/learn/lesson-07-og.jpg`, 1200 x 630, the title card above the column alone,
   its middle half lit and its ends dimmed, between Merc and Tavi, which answers nothing
   the predict asks, with alt text naming what it shows.
3. `kit/range-chart.ts`, new (Toys 1), generic over a window, a column and its lit band, lines,
   bands and range bars, so Lesson 11 (its signature, "the siren's line crossing a shaded seam")
   and Lesson 14 can use it. Built, with its layout and its drawing in `kit/range-chart-layout.ts`
   and `kit/range-chart-draw.ts`.
4. `kit/sound.ts`: the "ng" and lip-trill timbres (Audio). The voice that follows a pitch path is on
   main: `contourVoice` and `playContour` glide pitch and level exponentially from point to point
   (`kit/sound.ts:314-347`, `:575-584`). Built: `kit/timbre.ts`, the "ng" (Merc's "ooh" through a
   900 Hz lowpass) and the lip trill, each a `Timbre` that the voice's new `timbre` option applies as
   the voice is built (`kit/sound.ts:44-45`, `:184`), in a module only this page loads.
5. `kit/take.ts`: `readSiren` (Toys 4); `src/lib/mirror/metrics.ts`:
   `middleHalf(lowMidi: number, highMidi: number): { low: number; high: number }`, exported and used
   by `pickMatchTargets`, with its parity test in `src/lib/mirror/metrics.test.ts` (Toys 4). Both
   built: `readSiren` at `kit/take.ts:247`, `middleHalf` at `metrics.ts:353-368` and the parity test
   at `metrics.test.ts:479`. The note formatter is on main: Lesson 4's spelling helper names a note
   with its sign and in words (`sharpOf`, `signName`, `wordName`, `kit/notes.ts:157-197`).
6. Lesson 3's kit parts are on main: `comfort.ts` with the feeling question, `listen.ts`, `take.ts`,
   the voice choice on `fyp-voice` (`voice-choice.ts`) and the warm-up cards (`warm-up.ts`); so is
   Lesson 1's predict widget (`kit/predict.ts`). Still needed: Lesson 6's tune line. Built: Lesson
   6's rest card after "Effortful", left to the coach by default (`kit/comfort.ts:76-77`), a kit
   option since #1192 (`restAfterEffort`); and Lesson 1's words strip, promoted
   (`lesson-01/words.ts`) to `kit/words-strip.ts`, which Lesson 1's page now uses too.
7. `kit/quiz.ts`: Lesson 2's three changes (Toys 5), on main.
8. `kit/explorer.ts`: the text-only state and the current lesson (Explorer and season data). Both
   are on main.
9. `src/e2e/helpers/tone-wav.ts`: a glide beside `writeToneWav` (`:76`), built as
   `writeGlideWav(fromHz, toHz, secondsEachWay)` (`:94`), the same tone gliding up and back down,
   even in semitones; Chromium loops the file, as the helper notes (`:89-90`), so it plays one siren
   after another, for the end-to-end tests (Tests).
10. App: the `pattern` slug and its test (Practice links), and the App content list's one open
    sentence. The two warm-up changes the lip-trill link waited on are on main (Practice links).
11. Lessons 1 to 6's pages, when this one goes live: nothing to edit. Their explorers and their
    Wraps' next-lesson cards (`kit/next-card.ts`) read each lesson's state from the season
    (`kit/season.ts`), so Lesson 6's card turns from "Coming later" to "Start lesson" and links
    this page.

## Edge cases

What the page does where nothing above says:

- **No stored voice**: the chart shows the lower voice and its switch; Sing it asks after the
  comfort check, before anything plays. A `fyp-voice` holding anything but the two stored values
  counts as none and is overwritten only by a choice.
- **No storage** (blocked, private mode, or a read that throws): every read and write is inside
  try/catch; the page works, asking the voice each visit, reseeding the quizzes and forgetting the
  warm-up's Skip.
- **Sound off**: each play button draws what it would play and shows the hint "Sound is off, so
  nothing played. Turn sound on to hear it."; as built, the cold open's reveal waits for Play
  "Twinkle" on the column heard with the sound on, so it does not show (Toys 2); and Start stays
  unavailable, with state 5's hint, until Merc's siren has sounded with the sound on (Toys 4, state
  5: Lesson 1's rule, as Lessons 5 and 6 apply it).
- **No Web Audio** (no `AudioContext` in the browser): nothing can sound and the listener cannot
  run, so every play button draws in silence; as built, only Sing it shows the hint "This browser
  can't play sound here.", and the page's other plays draw in silence as the kit's do on every page
  (`Sound.canPlay`); Sing it offers the listen-only path of state 9 at once, with no Start; the Wrap
  keeps the Vocal Range Test card.
- **No microphone, a refusal, or a listener that fails to load**: state 9 of Toys 4.
- **The tab hidden, or the section left, during a take or as the microphone opens for one**: the
  take is abandoned, the microphone released; no reading or feeling question follows; it counts
  towards the three. The briefing returns, with Start while takes and sung sirens remain and no
  "Effortful" or "Uncomfortable" has been picked, else Done for today; a take abandoned after voice
  was heard uses up the visit's one Again, so a visit holds at most two sung sirens (Toys 4).
- **A voice outside the window**: the line pins to the edge with an arrow; the reading still names
  the band from the notes the take held, and the window does not move. A lit band past the edge is
  drawn to the edge, or as a strip along it, with the arrow (Toys 4, state 7).
- **Octave jumps from the detector**: Voice Mirror's outlier guard drops them before the band
  (FACTS 67a); a short jump never moves the band.
- **A siren that only rises, or a hum that hardly moves**: the band is the middle half of whatever
  was held, or under three semitones its centre: a steady A3 gives "The lit band is the middle of
  your siren: about A3.", and a hum between A3 and B3 gives "about A♯3".
- **Three takes used**: Again is gone and Start does not come back; Done for today remains, and an
  unsteady third take's line carries no "Try again".
- **No WebGL, or a slow device**: Merc and Tavi's stills (`kit/merc-warm.ts`).
- **Lesson 3 never marked done**: the recall still shows, as a prerequisite's does. Until
  `/learn/03` is live, this page does not publish.
- **Reduced motion**: Look, Toys 1 and Toys 4 give the end states; nothing moves on its own.

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-07/` and the new kit
parts:

1. "Twinkle": the fourteen notes and lengths of FACTS 83, spanning 9 semitones from E3 and from E4.
2. The chart's windows and columns equal FACTS 87, checked against `VOCAL_RANGES` imported from
   `src/stores/settings-store.ts`: every preset of each group inside its window, the column's lit
   band equal to `middleHalf` of the column, and Step 5's view, E2 to C6, holding the singers' A3
   to C6 and all six bands.
3. Merc's siren path: E3 to C♯4 and E4 to C♯5, 6.0 s, even in semitones, inside every preset of
   its group and inside the lit middle (FACTS 56).
4. Step 3's slide: do clamps between the column's bottom and 15 semitones up, and the readout's
   three places follow from where the tune's lowest and highest notes sit: from E3, a move of 2 up
   reads "all of it in the lit middle" and 3 up "reaching into the dimmed top end" (FACTS 84).
5. The push curve (FACTS 85): p = ((s − 8) / 16)², lowest at F3 (or F4), a quarter of its top value
   at the column's bottom and its top value at the column's top, rising from F3 to the top; the
   readout's words for every note of both columns, the bottom quarter included, as FACTS 85 lists
   them; no number in any label or accessible text; and, on a fake clock, a held Lower or Higher
   repeats every 150 ms after 400 ms and stops at the column's ends.
6. The siren reader, on synthetic frames at the detector's 16 ms hop (`DEFAULT_HOP_SEC`,
   `src/lib/pitch-measurements/f0.ts:35`): 0.5 s on E3, then a glide up to E4 and back over 6 s,
   reads "about G3 to C♯4"; the same glide with no time on E3 reads "about G♯3 to C♯4", because the
   attack rule leaves E3 under 0.15 s; a steady A3 for 3 s reads "The lit band is the middle of
   your siren: about A3."; 0.5 s on C3, a glide up to G4 over 4 s and 0.5 s there reads "about F3
   to D4"; a 0.1 s octave jump inside a glide leaves the band where it was; 0.8 s of voice gives
   "We didn't hear a steady siren that time.", with no "Try again"; no voice in 6 s gives "We didn't
   hear you start that time."; spans of 1 and 2 semitones read as one note, the centre: 0.8 s on
   A3, 0.5 s on A♯3 and 0.5 s on A3 again, and 0.8 s on A3, a glide up to B3 over 0.6 s, 0.4 s there
   and 0.6 s back, both read "The lit band is the middle of your siren: about A♯3."; for every low
   note from C2 to C5 and every span from 0 to 40 semitones, the band is the centre under three and
   names neither end from three up; the attack trim works on the raw frames, which `computeRange`
   then receives; `middleHalf` gives `pickMatchTargets` the same window it computed before the
   change (FACTS 35, 59, 81).
7. The Sing it flow (`lesson-07/siren-flow.ts`, Toys 4): with no stored voice the voice choice
   comes before either path, and a stored voice starts pressed and can be changed; "Just listen
   today" shows no Start and picks the rest card; Start waits for Merc's siren, and with sound off
   it stays unavailable after Play, with the sound-off hint; without Web Audio, Sing it is
   listen-only with no Start; a take with no voice brings no feeling question and offers Again
   while fewer than three takes have been made, leaving the visit's one Again unused; "Easy" and
   "Workable" after a band offer Again once a visit, then not; after an unsteady take they give
   "That's it: one gentle siren, done." with "Try again at about speaking volume." and Again
   only while the one Again is unused and fewer than three takes have been made, and pressing that
   Again uses it up; an abandoned take counts, and uses the one Again up if it had voice; a walk
   over every sequence of take outcomes and answers never reaches a fourth take or a third sung
   siren, and never shows "Try again" without Again; "Effortful" and "Uncomfortable" end the
   singing for the visit and pick the rest card, and a later "Easy" brings back neither Again, Start
   nor the Vocal Range Test card; "Uncomfortable" takes the band away; after Done for today the
   question, its answer and its lines stay, the four answers locked with the one picked still
   pressed, a later answer changes nothing, and no Start, Again or Done for today comes back, in
   every sequence the walk takes; nothing is written to storage but `fyp-voice` and
   `fyp-l07-warmup`.
8. Copy: every line of LESSON.md's page copy and every template in Toys 1 and 4 passes
   `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts`, surface `finding`); no quiz
   feedback line starts with "Right", "Yes" or "Correct"; no accessible name or live text holds a
   ♯ or ♭ sign; and no two controls on the stage share an accessible name.
9. Every fixed sound's frequency equals `hz(m)` for the notes of FACTS 81.
10. Layout, the pure helper behind Toys 1's targets: at every width from 344 to 1440 px every band
    column and control is at least 44 px wide, with 8 px between neighbours and none overlapping,
    the voice switch on its own row and free play's state switch in rows of three and two (FACTS
    88).
11. Season data: Lesson 7's entry has `minutes: 16` and its link carries `?lesson=07`;
    `EDGES` holds [3, 7].

End to end (Playwright, at 390 x 844 and 1440 x 900):

1. No AudioContext before the first tap; nothing plays before a play button.
2. Cold open: before a choice the chart shows the column with no beads and no bracket, and the live
   text names no note, even while "Twinkle" plays; Play "Twinkle" plays before a choice; the beads,
   the gold bracket and the reveal appear only after a choice and, as built, only once Play
   "Twinkle" on the column has been heard (Toys 2); with sound off, the hint shows and the reveal
   waits.
3. The chart by keyboard alone: Tab reaches every control; the scrub bar and the push note move by
   arrows, and Home and End jump; Start lower and Start higher move "Twinkle" and the readout
   follows; the sounds, the singers, the voice switch and free play's state switch toggle
   `aria-pressed`; each band plays and announces its span; the push buttons are named "Lower note"
   and "Higher note" and the voice switch's "Lower voice" and "Higher voice"; every announcement
   uses spoken names.
4. At 390 x 844 and at 344 px wide, every target measures at least 44 x 44 px, none overlap and
   nothing scrolls sideways.
5. Step 4 on a phone, at 390 x 844 with touch emulated: a long press on Higher climbs the note from
   the column's bottom to its top, without scrolling the page, selecting text or opening a menu,
   and the readout ends on "A4: much more push"; a vertical drag that starts on the note's handle
   moves the note; a swipe anywhere else on the stage scrolls the page.
6. Sing it, with the fake microphone (`src/e2e/helpers/tone-wav.ts`, `fakeMicArgs`): with sound off,
   Start stays `aria-disabled` after Play Merc's siren and the hint says sound is off; with sound
   on, a steady A3 (`writeToneWav(220)`) in the lower voice reads "The lit band is the middle of
   your siren: about A3."; "Easy" shows "That's it: one gentle siren, done. The lit band
   shows where its middle notes sat today." and Again, and after a second take Again is gone; the
   Wrap shows the Vocal Range Test card with "Ten minutes, gently, most days". A glide from E3 up to
   E4 and back (`writeGlideWav(164.81, 329.63, 3)`) reads "about G3 to C♯4", spoken "C sharp 4" in
   the live region: Chromium loops it, so the take never falls quiet, runs its full ten seconds and
   holds a whole turn at each end, from any starting point. "Effortful" shows the gentle line, no
   Again, and the rest card in the Wrap. "Uncomfortable" shows the doctor lines, no Again, no band,
   and the rest card. "Just listen today" never calls `navigator.mediaDevices.getUserMedia` (a
   spy), shows the doctor lines and leaves the rest card. A refused permission shows the
   no-microphone line and keeps the Vocal Range Test card.
7. The microphone's tracks stop at the end of each take, on leaving the section and when the tab is
   hidden (a spy on `MediaStreamTrack.stop`).
8. The recall shows with an empty `fyp-done`, and answering both its questions marks nothing done;
   its one step link is `<a href="/learn/03#step-1" target="_blank">`; answering all four
   quick-check questions marks Lesson 7 done in the explorer; each feedback line starts "Right." or
   "Not quite.".
9. Every practice link carries `?lesson=07`.
10. With reduced motion emulated, a siren draws at once, the cold open's beads and the checkpoint's
    band appear in place, and nothing moves on its own.
11. After a full run, storage holds only the keys in the Contract.

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=07`. Then the layout, accessibility, sound, motion and storage
rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children, touch
targets of at least 44 px with no two tap zones overlapping, visible focus, a single dark theme with
every colour a token and an explicit body background, sound only after a tap, localStorage only for
per-viewer conveniences inside try/catch, and the whole page usable with no sound, no WebGL, no
storage and no microphone. Every ♯ the page prints in text (the reading, the chart's row names, the
bands' spans) has a spoken name, as Lesson 2's contract sets: the sign is `aria-hidden` and a
visually hidden word follows it, so a screen reader says "C sharp". The page stores the quiz seeds
and records (`fyp-l07-recall-seed`, `fyp-l07-recall-v1`, `fyp-l07-seed`, `fyp-l07-quiz-v1`),
`fyp-done`, `fyp-voice`, the warm-up's Skip (`fyp-l07-warmup`) and the masthead's Pause animations
choice, `fyp-motion` (`kit/motion-switch.ts:12`); through the kit, as every lesson page does, its
memory of the furthest step, `fyp-pos` (`kit/position.ts:20`), and its record of the welcome tour,
`fyp-tour` (`kit/tour-gate.ts:29`); and nothing from the take: no band, no note, no answer to "How
did that feel?" and no ending.

Page QA before publishing (PRODUCTION-PIPELINE § 5) adds, for this page:

- The microphone is requested only by Start; "Just listen today" and a refused permission never
  open it; the browser's microphone indicator goes off at the end of each take, on leaving the
  section and when the tab is hidden.
- The network panel shows nothing sent while the microphone is open, and storage holds nothing but
  the keys above.
- The whole page, Sing it included, runs by keyboard alone, and a screen reader hears every state
  and reading, in spoken names.
- No reading names a span or an end of the siren: from three semitones up it names a middle half
  that holds neither end, and under three only the centre; nothing celebrates in Sing it.
- With sound off, Start stays unavailable and says why; "Try again" never shows without Again; and
  no visit reaches a fourth take or a third sung siren.
- With reduced motion emulated, nothing moves on its own and the live line draws on a still frame.
- The Wrap shows the rest card after "Effortful", "Uncomfortable" and "Just listen today", and the
  Vocal Range Test card otherwise.
- The app-check sweep at phone and desktop width, with Sing it open in each state.
