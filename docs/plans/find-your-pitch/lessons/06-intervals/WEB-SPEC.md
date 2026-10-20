# Lesson 6 web page: spec

The Lesson 6 page is the web lesson for "Intervals: the distance between notes": written steps, one
main toy in six states and a compact one, two ear games, an anchor board, two predicts, an
unscored sing-along, two quizzes (the recall and the quick check) and the lesson explorer. Copy is
in [LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a text-only package: no
film exists for Lesson 6, so the page has no Watch section and the masthead's anchors are Lesson,
Sing and Explorer. It is built on the kit (`src/features/lessons/kit/`), and like Lessons 2 to 4 it
reuses and never copies: a part that still lives in Lesson 1's module
(`src/features/lessons/lesson-01/`), or that Lessons 2 to 4 plan to promote, moves into the kit
first.

Its public home is `mercurypitch.com/learn/06` (MASTER-PLAN § 12 item 9): a hand-written document
`learn/06.html` with its module in `src/features/lessons/lesson-06/`, wired as Lesson 1's page is.
It publishes only after Lesson 4's page at `/learn/04`, because its prerequisite chip and its
recall check link there (FACTS 2, 7). "What the kit and the app still need", below, lists the
wiring and every kit change.

## Look

Lessons 1 to 4's look, unchanged: the dark listening room, the series colour code, Lesson 1's type
and wordmark, and the motion rules. On this page:

- Gold `#ffd84d` marks only the fit: the gap numbers that stay the same when the tune line slides
  (Step 3 and free play), glowing once as the line lands. The cold open's compact line shows no
  numbers (Toys 1), so its slide has no glow: the reveal says what stayed the same.
- Blue `#58a6ff` lights the notes blue Merc sings and orange `#ff7448` those orange Merc sings;
  chrome is every other note.
- The contrast case, Step 4's swapped version, is dashed ink-2 `#a8b3bf` with a "?" (MASTER-PLAN
  § 5), because the sing-along guide uses the app's canvas set, in which violet is the singer.
- The guide (Sing it) takes the app's canvas colours, target amber `#f59e0b` for Merc's path, while
  Merc's version plays; on the viewer's turn it turns plain chrome, as Lessons 2 and 4's guides do
  (Lesson 2 DECISIONS 68).
- Step and leap are words on the toy ("step", "leap", "same"), never a colour alone.

Two things move on their own: the Merc idle loops. Under `prefers-reduced-motion` they always
stop, and every transition this page adds (the lift and slide, the swap, the gap numbers' glow)
lands in its end state with no travel. The guide's sweeping line is not a transition but the
viewer's place in the tune, so under reduced motion it becomes the path's notes lighting one after
another (Toys 6), never a jump to its end. What the viewer starts still sounds. For everyone else
the masthead's Pause animations toggle stops the same two (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Lessons 2 to 4's departures kept: the step toys double as
the Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the
practice card sits in the Wrap. No Watch section (§ 4.2 item 10). Each section's heading, and the
line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 1's (wordmark, "Season 1 · Lesson 06", anchors Lesson, Sing and Explorer,
   the Sound toggle off by default, Pause animations with its reduced-motion lock). `initMasthead`
   takes any map of anchors (`kit/page-chrome.ts:71`).
2. **Hero**: kicker; the hook question as the title; the meta as three chips ("15 minutes", FACTS
   3; "After Lesson 4: The major scale and home", a link to `/learn/04`; Sound on); the promise; the
   sound gate from LESSON.md in the hero copy, as Lesson 1's is; the two Mercs on the floor line
   either side of the tune line on C, with its Play button (`line-c`, FACTS 63). The hero's line is
   a copy of its own in the compact state (Toys 1: the first line, no names, numbers or marks, its
   beads not buttons), whose beads light as blue Merc sings; it shares no lit state with the cold
   open's copy or the stage's, as Lesson 2's copies of its spiral keep their own (its DECISIONS
   81). Its drawing is `aria-hidden`, and the Play button's name says what plays ("Play Twinkle
   from C").
3. **Recall from Lesson 4**: Lesson 4's questions 1 and 4, for everyone (Toys 7).
4. **Cold open: predict**: the bubbles, each with its Merc's still, and beside them the compact
   tune line (Toys 1), so the sound and the line are on screen together (playbook rule 10). Play
   from C works from the start; orange's and blue's lines from LESSON.md; the two-choice predict;
   choosing unlocks Play from F♯, which lifts the compact line and slides it up six rows, announced
   "Twinkle from F sharp", before it plays. The reveal appears after Play from F♯ has sounded; with
   sound off, LESSON.md's hint shows and the reveal waits.
5. **Four words you'll meet**: interval, step, leap and transpose, each with its definition, a
   small figure and a play button (Toys 3).
6. **The steps**: Lesson 1's sticky stage and step deck ("N of 5", Previous and Next), every step on
   the one tune line (`toyFor: () => 1`), in five states (Toys 1), with the games and the board
   beside it in Steps 2 and 5:
   1. What shape is a tune? The first line on C, with its contour marks.
   2. How far apart are the notes? Both lines, one above the other, the gaps numbered, steps and
      the leap labelled; the Step or leap? game (Toys 4).
   3. What happens if I slide the whole tune? Orange's line, then Slide and the names switch.
   4. So is it the ups and downs I remember? The second predict, then Swap sizes; the mix-up card.
   5. Do the distances have names? The named intervals, the anchor board (Toys 5) and the Name it
      game (Toys 4); the Go deeper drawer under the text (Toys 8).
7. **Sing it**: the comfort check, the voice choice, the two versions, the guide, Move do and the
   feeling question after each version (Toys 6); nothing listens.
8. **Quick check**: LESSON.md's four questions (Toys 7).
9. **Wrap**: the three recap lines, the challenge, the practice card in the version Sing it's
   ending picks, and the next lesson's hook on a card that opens Lesson 7 in the explorer. The card
   is Lesson 2's app card with LESSON.md's eyebrow, title, text, address and second drill:
   Interval Trainer and Ear Lab's Leap. After "Effortful", "Uncomfortable" or "Just listen today" it
   is Lesson 3's rest card instead, with Interval Trainer named and "then tap Interval Trainer"
   after its address, then the same second drill (Toys 6). Its addresses link
   `/pitch-training?lesson=06` and `/ear-lab?lesson=06` in a new tab, so neither meets First Light
   (Practice links). Free play unlocks here: every tune-line control on one stage (playbook
   rule 17).
10. **Lesson explorer**: the kit's, with Lesson 6 as the current node, the line under its heading
    from LESSON.md, and the state for a lesson with a page and no film (What the kit and the app
    still need).
11. **Footer**: Lesson 1's, with "Season 1 · Lesson 06 · Intervals: the distance between notes"; the
    two practice links, printed `mercurypitch.com/pitch-training` and `mercurypitch.com/ear-lab`,
    with "Interval Trainer and Leap are free." (both links carry `?lesson=06`, so neither meets
    First Light, FACTS 44a; the form of Lesson 2's footer, its LESSON.md, "Head and footer");
    Lesson 1's fonts line and "Every sound on this page is synthesised in your browser" (FACTS 6).
    With no film there are no voices to credit.

## Length

The learner copy is 2,258 words by the review's count (FACTS 3), under the series' cap, Lesson 3's
page at 2,355 on the same count, and the page runs about 15 minutes: 9.49 minutes of reading at 238
words a minute and about 6 of sound, toys and tasks, 15.49 in all. That is past MASTER-PLAN § 4.2's
8 to 12 minutes of active time, as Lessons 3 and 5 are (15 and 17 minutes: Lesson 3 FACTS 61,
Lesson 5 FACTS 2). Each step's text, with its Try, its Notice and any predict, runs 88 to 119 words
(Steps 1 to 5: 88, 119, 115, 103 and 95), inside § 4.2's 50 to 120 a step. Two steps carry more
beside it, for these reasons:

- **Step 4, about 215 words.** Its mix-up card (about 100 words) sits in the step whose toy refutes
  it, as in Lessons 2 to 5.
- **Step 5, about 245 words.** Its table of five anchors (about 60 words) is what the anchor board
  plays, and its Go deeper drawer (about 60) is closed by default.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                 | New in Lesson 6                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The tune line          | The kit's sound (`kit/sound.ts`: `playTone`, the soft tone, Merc's "ooh"), notes (`kit/notes.ts`: `hz`, `COLOR`) with Lesson 4's spelling helper, frame loop and step deck; Lesson 4's staircase rows, its slider and its names switch | Beads on semitone rows joined by a line; the two lines stacked; the compact state; contour marks; gap numbers and gap buttons; Lift and Slide; Swap sizes; named intervals |
| 2. Predict widgets        | Lesson 1's predict (`lesson-01/predict.ts`), promoted into the kit as Lesson 2 plans                                                                                                                                                   | A play button that works before the choice (Play from C) beside one that unlocks after it                                                                                  |
| 3. Four words             | Lesson 1's strip of figure, word, definition and play button (`lesson-01/words.ts`)                                                                                                                                                    | Four new figures                                                                                                                                                           |
| 4. Ear games              | Lesson 2's Semitone or tone? (its Toys 4, in build), generalised to two or four answers                                                                                                                                                | Step or leap? (two answers, either direction) and Name it (four answers, each in its anchor's direction)                                                                   |
| 5. Anchor board           | The words strip's play buttons                                                                                                                                                                                                         | Five rows, each with the tune's snippet and the bare interval                                                                                                              |
| 6. Sing it                | Lesson 3's comfort check and voice choice (`kit/comfort.ts`, `fyp-voice`, its Toys 5 and 7); Lesson 4's scale guide with its count-in and Move do (its Toys 4); Lesson 1's breathing ring (`lesson-01/sing.ts`)                        | A two-version path of ten rows with a breath mark; the feeling question after each version, without a microphone; the guide put away                                       |
| 7. Recall and quick check | The kit's quiz (`kit/quiz.ts`) with the three changes Lesson 2 makes to it; Lesson 4's questions                                                                                                                                       | Nothing more, once Lesson 2's changes land                                                                                                                                 |
| 8. Go deeper drawer       | Lesson 2's `details` drawer                                                                                                                                                                                                            | One item                                                                                                                                                                   |

### 1. The tune line

One component in six states, and a compact one for the cold open and the hero, so the object the
lesson transforms is one object on the page: the tune lifted off the chart and slid with every
distance in it kept (the CURRICULUM's signature: "a tune's contour lifted off the chart and slid up
and down while it keeps its shape"). Motion principle 2, "One object carries the story across shots
and keeps its identity" (`research/brand-motion.md` § 3.3), and playbook rule 6 ask for it.

- **Drawing.** Pitch is height (playbook rule 20). Each note is a bead on faint semitone rows, the
  app's piano-roll way of drawing pitch (FACTS 38), set left to right in time, a minim's bead twice
  a crotchet's width, and the beads are joined by a line. The rows carry no names. Each bead's name
  sits under it, in a strip of its own: its letter, spelled as Lesson 4 spells each key, one letter
  per degree, through Lesson 4's spelling helper (its Toys 1; FACTS 24, 38), never the app's
  sharps. So from B♭ the first line reads B♭ B♭ F F G G F, and F major's fa is B♭, never A♯:

  | Start | First line           | Second line        | Start | First line           | Second line        |
  | ----- | -------------------- | ------------------ | ----- | -------------------- | ------------------ |
  | C     | C C G G A A G        | F F E E D D C      | F♯    | F♯ F♯ C♯ C♯ D♯ D♯ C♯ | B B A♯ A♯ G♯ G♯ F♯ |
  | D♭    | D♭ D♭ A♭ A♭ B♭ B♭ A♭ | G♭ G♭ F F E♭ E♭ D♭ | G     | G G D D E E D        | C C B B A A G      |
  | D     | D D A A B B A        | G G F♯ F♯ E E D    | A♭    | A♭ A♭ E♭ E♭ F F E♭   | D♭ D♭ C C B♭ B♭ A♭ |
  | E♭    | E♭ E♭ B♭ B♭ C C B♭   | A♭ A♭ G G F F E♭   | A     | A A E E F♯ F♯ E      | D D C♯ C♯ B B A    |
  | E     | E E B B C♯ C♯ B      | A A G♯ G♯ F♯ F♯ E  | B♭    | B♭ B♭ F F G G F      | E♭ E♭ D D C C B♭   |
  | F     | F F C C D D C        | B♭ B♭ A A G G F    | B     | B B F♯ F♯ G♯ G♯ F♯   | E E D♯ D♯ C♯ C♯ B  |

  The tune never reaches ti, so F♯ major's E♯, the one white key Lesson 4's table renames, never
  shows. From Step 3 on, and in free play, Lesson 4's names switch (its Toys 1) shows the do-re-mi
  names in the letters' place: Letters · Do-re-mi, two of its three modes, since this lesson uses
  no degree numbers. A printed name keeps its sign, with a spoken name beside it (Contract); every
  accessible name and live text uses words, "B flat 4", never the sign.

- **Layout and targets** (FACTS 72). Every target is at least 44 px square and none overlaps
  another, at every width from 344 px up:
  - Time runs left to right in crotchet columns, a minim's two wide. A bead's target is its column,
    the full height of its band of rows. A gap's target is a button as wide as a crotchet's column,
    centred under its gap in a 44 px strip below the names; Step 5's brackets are buttons of the
    same width in a 44 px strip above the line.
  - Whenever both lines show (Steps 2 and 5, and free play) they stack, the first above the second,
    as the song's words are written, at every width, each on a band of its own ten rows, do to la.
    In one row their 16 crotchet widths would get under 44 px each, not only on a phone (20.6 px at
    390 px) but at every desktop width this grid gives (40.7 px at 1440 px, 30 px at 1024 px), so a
    phone-only fix would leave the desktop failing too; stacked, each line needs 8, which fit at
    every width from 388 px. Every target stays where it is drawn: a bead plays its note, and the
    button under a gap plays that gap, as Step 2's Try asks. Gap 7, "star" to "How", the one move
    between the lines, sits at the right end of line 1's strip, under the minim's second half, with
    a small return arrow towards line 2.
  - On phones (below 960 px, where the stage sits above the text) the figure spans the card's inner
    width, as Lesson 2's steps 3 to 5 do (its DECISIONS 83). Measured from Lesson 1's stage CSS at
    390 x 844, the stage card is 358 px inside the 16 px gutters and 356 px inside its 1 px borders,
    and the figure's own 1 px border leaves a 354 px canvas: crotchet columns of 44.25 px and a
    minim's of 88.5 px. With the names under the beads, no ruler takes width.
  - Heights at 390 x 844: a band's ten rows sit 9 px apart (97 px with the beads), the names strip
    is 20 px and the gap strip 44 px, so two lines and a 12 px space between them make a 350 px
    canvas (Step 5 the same, its bracket strip above in place of the gap strip below; free play,
    with both strips, 438 px), where Lesson 1's taller step figure on a phone is 310 px; the stage,
    with its head and a row of 44 px controls, stays well under the 786 px left below the masthead.
    The one-line states (Steps 1, 3 and 4) draw all 21 rows from C4 to G♯5, so a slide travels
    visibly, in a 276 px canvas whose strip under the names holds the contour marks or the gap
    numbers.
  - Narrower than 388 px, where eight 44 px columns no longer fit, the crotchet columns stay 44 px
    and each line's minim, its last note, takes what is left (75 px at 375 px, 60 px at 360 px), so
    no other note moves. Below 366 px the gap buttons shift left together, by at most 22 px, so
    that the last 44 px of line 1's strip stay gap 7's (6 px at 360 px). The layout holds down to
    344 px, where the minim's column comes to 44 px.
- **Compact** (cold open and hero): the first line only, smaller, with no names, no numbers and no
  marks, on sixteen rows from C4 to D♯5, so both starts fit without rescaling. The beads light as
  Merc sings them. Its beads are not buttons (the bubbles, or the hero's Play, carry every action),
  so the drawing is `aria-hidden` and a polite live region speaks for it: "Twinkle from C" or
  "Twinkle from F sharp" as each starts. Play from F♯ lifts it and slides it up six rows first
  (below).
- **Play** plays the line shown, lighting each bead as it sounds (`line-c`, `lines-c` or the
  current start, FACTS 63 to 65); **Slow** doubles every length (MASTER-PLAN § 4.2 item 5). A tap on
  a bead plays its note in the soft tone.
- **Contour marks** (Step 1): in the strip under the names, between beads, a small word and glyph
  for each move, "same", "up" or "down", never a colour alone. They are labels, not buttons.
- **Gaps** (Step 2, and free play): both lines show, stacked, fourteen beads. Each gap's button
  carries its size in semitones, with a sign for down (0, 7, 0, 2, 0, −2, −2, 0, −1, 0, −2, 0, −2;
  FACTS 22, 23), over the word "step", "leap" or "same", in 15 px and 12 px type. It plays its two
  notes and lights them (FACTS 64). In Steps 3 and 4 the gap numbers are labels in the same strip.
- **Slide** (Step 3, and free play): Start lower and Start higher (a semitone each), or, with a
  mouse or pen, a vertical drag on the line; starts run from C4 to B4. On touch the stage keeps
  `touch-action: pan-y`, as Lesson 1's does (`lesson-01/lesson-01.css:770-777`), so a swipe still
  scrolls the page and the buttons do the sliding. A slide is the signature move: the line lifts
  (a soft shadow, the rows dim), travels, and settles on its new rows, where the letters change and
  the gap numbers glow gold once, unchanged. A faint chrome ghost of the line on C stays in place
  for comparison. With the lines stacked (free play), each band's rows scroll under its line as it
  travels. A slide is silent: Play plays the tune from its new start. A readout names it, spelled
  as the drawing is: "Twinkle from B♭4: do do so so la la so" (spoken "Twinkle from B flat 4: do do
  so so la la so").
- **Swap sizes** (Step 4, and free play): a toggle (`aria-pressed`) that draws the swapped version
  (FACTS 37) over the real line as the contrast case, dashed ink-2 with a "?", its two changed gaps
  marked ("2" where the tune has 7, "7" where it has 2), and plays it. It follows a slide. Pressing
  it again removes it.
- **Predict** (Step 4): Toys 2's widget with two choices; choosing unlocks Play the first line and
  Play the swapped version; with sound off, LESSON.md's hint shows and the reveal waits; the reveal
  never calls a choice wrong.
- **Names** (Step 5, and free play): brackets in the strip over the named gaps, "P5 · 7" over
  "-kle, twin-", "M2 · 2" over "-tle star" and "m2 · 1" over "I won-" (FACTS 13, 22), each a button
  that plays its interval.
- **Keyboard and screen readers.** The line is a group with a live summary in spoken names:
  "Twinkle from B flat 4: B flat, B flat, F, F, G, G, F. Same, up 7, same, up 2, same, down 2."
  Each bead is a button ("Note 3 of 7, F 5, twin"; with do-re-mi showing, "Note 3 of 7, so, F 5");
  each gap a button ("Gap 2: up 7 semitones, a leap"). The start is a slider (`role="slider"`, C 4
  to B 4, `aria-valuetext` such as "Starts on F sharp 4: every interval the same"): arrow keys move
  it a semitone, Home and End jump to C 4 and B 4. The names switch is two buttons with
  `aria-pressed`. Swap sizes announces "Swapped: up 2, then up 7. Same ups and downs, two intervals
  changed." Tab order: Play, Slow, the slider and its buttons, the toggles and the names switch,
  then the beads and gaps, line 1 before line 2.
- **States**: compact; contour (Step 1); gaps (Step 2); slide (Step 3); swap (Step 4); names (Step
  5); free play, every control together. Any state can be playing or still.
- Under reduced motion every move (the lift and slide, the swap, the glow) lands in its end state
  at once; a played line still sounds and lights its beads in turn.

### 2. Predict widgets

- Both are Lesson 1's widget: the choice locks, the play buttons unlock, the reveal plays after
  the sound and never calls a choice wrong; two choices each, every button at least 44 px tall.
- New, as on Lesson 4's page: the cold open's Play from C works before the choice, because orange's
  line answers it; only Play from F♯ waits for the choice, and the reveal waits for Play from F♯.
  With sound off the reveal waits too, and the hint says so (Lesson 1's rule: the reveal describes
  what was heard).
- States: waiting for a choice; a sound playing; choice made and sound heard, reveal shown.
- Under reduced motion the reveal appears at once, with no slide-in.

### 3. Four words

Lesson 1's strip: a two-bead figure with the gap marked for interval, two neighbouring beads for
step, two beads with an empty row between for leap, and a line and its moved copy for transpose,
each with its play button (FACTS 66). Each button names what it plays, in spoken names ("Play C 4,
then G 4"; Transpose's "Play from C 4, then from F sharp 4").

### 4. Ear games

One component in two modes, generalised from Lesson 2's Semitone or tone? (its WEB-SPEC, Toys 4).
It sits in its step's text column, under the Notice, as Lesson 2's game card does (its DECISIONS
82). Answers are buttons side by side, each at least 44 px tall; the number keys answer (1 and 2,
or 1 to 4). Space replays the round's pair while the focus is anywhere in the game but on a button;
on a focused button Space and Enter press it, as on any button, so a key meant to replay never
answers by accident, and the Replay button replays. A polite live region reads each feedback line.
Feedback names the interval and the sound, never the listener.

- A round takes one answer. A miss lights the right answer, reads its feedback line and replays
  the pair at 1.5 times the lengths; the round is not asked again, and Next moves on. After two
  misses in a row the playbook's line "If that felt tricky, good: that's learning." follows (rule
  15).
- The count at the end, "7 of 10" (or "5 of 8"), counts the rounds answered right first time; no
  rating, no streak, nothing stored.
- Rounds come from a seeded sequence (FACTS 67): each run, Play again included, draws a new seed
  from `Math.random()`, keeps it in memory only and feeds it to the kit's `mulberry32`
  (`kit/dom.ts:58`); the unit tests pass a fixed seed (Tests, 5).
- **Step or leap?** (Step 2): ten rounds, two answers, Step and Leap. One feedback template for
  each size the game plays, with "up" or "down" as played: 1, "A step: a semitone up."; 2, "A step:
  2 semitones down, a tone."; 3, "A leap: 3 semitones down."; 4, "A leap: 4 semitones up."; 5, "A
  leap: 5 semitones up, a perfect fourth."; 7, "A leap: 7 semitones up, a perfect fifth." (Thirds,
  3 and 4, are named only by their semitones: the page never names them.)
- **Name it** (Step 5): eight rounds, four answers, labelled "Semitone · m2", "Tone · M2", "Fourth ·
  P4" and "Fifth · P5". Feedback templates: "A perfect fifth, up: 'twin-kle, twin-kle'." "A perfect
  fourth, up: 'Should auld'." "A tone, down: 'lit-tle star'." "A semitone, down: 'I won-der'."
- States: ready (a Play button); playing; answering; feedback shown; finished, with the count and
  Play again.
- Under reduced motion the answer lights and the feedback appear with no transition.

### 5. Anchor board

Five rows, LESSON.md's table, on a card in Step 5's text column, under the Notice: each row has the
interval's name and label, its semitones, a small two-bead figure on rows, and two buttons, **Play
the tune** (the snippet) and **Play the interval** (the bare pair), with accessible names such as
"Play 'Should auld ac-quain-tance be for-got'" and "Play the interval: C 4 up to F 4, a perfect
fourth"; the semitone row's snippet is "How I won-der", four notes, so its tune button reads "Play
'How I won-der'" (FACTS 68). The octave row plays Lesson 1's A3 and A4 and its tune button reads
"Play Lesson 1's two As". A row lights while it sounds; one sound at a time (a new tap stops the
last). On phones (below 960 px) each row stacks: the name, label and semitones on one line beside
the figure, and under them the two buttons side by side, each half the row's width and at least
44 px tall, as the kit's small buttons are (`btn sm`, `kit/lesson-base.css:522-526`). At 390 px a
card with 1 px borders and 16 px padding leaves a 324 px row, so with an 8 px gap each button is
158 px wide; a label wraps if it must. Under reduced motion the row lights with no transition.

### 6. Sing it

The guide is Lesson 4's scale guide (its Toys 4), cut to ten rows, do up to la, in the app's canvas
style: the six scale rows labelled do, re, mi, fa, so, la, the other four faint. Its rows show no
letters: a readout names the two starts, spelled as the tune line spells them (Toys 1), "do is D3,
then F3", or at Move do's lowest "do is B♭2, then D♭3" (spoken "do is B flat 2, then D flat 3";
FACTS 57). Merc's model is an amber target path along the tune's two lines (FACTS 70), with a
breath mark after "star", the end of the first line, 4.8 s in: a small tick in the path's own
colour with the word "breathe" (FACTS 58a). Every state has a visible status line that is also
announced (`aria-live="polite"`).

States:

1. **Comfort check**, always first and asked every visit (never stored): Lesson 3's comfort line,
   its list naming all six of REQ-GVC-020's conditions, and its two buttons (FACTS 50), through the
   kit's comfort check that Lesson 3 adds (`kit/comfort.ts`), with no microphone step after it.
2. **Voice choice**, after either comfort answer: Lesson 3's two buttons with the Mercs' stills
   (`aria-pressed`, at least 44 px), under LESSON.md's "Keep the voice you chose in Lesson 3, or
   choose now", read from and stored in `fyp-voice` inside try/catch (FACTS 52). A stored choice
   shows pressed and can be changed, and nothing waits on it. With none stored, neither is pressed
   and the next state waits for a choice, before "Just listen today" plays anything too, because the
   voice picks the Merc who sings, as on Lesson 5's page (its WEB-SPEC, Toys 6).
3. **Just listen today** (listen-only mode): LESSON.md's line with the doctor lines (FACTS 51, 55);
   Play the first version and Play the second version sing Merc's versions on a tap in the chosen
   voice, the path lighting as each plays; Start the guide and Move do are not shown, and nothing
   asks the viewer to sing (REQ-GVC-021). The Wrap shows the rest card.
4. **Ready**: the four controls in LESSON.md's order, under the Your turn text and the stop line.
   **Play the first version** sings do = D3 (lower) or D4 (higher), and **Play the second
   version** three semitones higher, in Merc's "ooh", the path lighting in step while the ring
   beside the guide shows the still of the Merc singing, blue for the lower voice and orange for the
   higher, as Lesson 1's ring does (`lesson-01/sing.ts:23-39`). **Move do** is two buttons, Lower
   and Higher, a semitone each, up to four either way, moving both versions together (FACTS 57);
   the readout and the path's row labels follow.
5. **Guide**: **Start the guide** is enabled once either version has played (hear it first:
   playbook rule 16); until then it is `aria-disabled`, with the hint "Play Merc's version first".
   It is the viewer's turn, so the amber goes, the rows turn plain chrome and Merc's path is drawn
   dashed in chrome (Lesson 2 DECISIONS 68). The count-in sounds do of the version last played, once
   and softly, for its one second (FACTS 70). Then a vertical chrome line sweeps along the path for
   9.6 s, past the breath mark, with nothing riding the path itself, while the ring breathes with
   the still of the Merc last heard at its centre, never a microphone icon. When the sweep ends,
   the rows go back to their amber rest, and the version last played counts as sung.
6. **How did that feel?** appears under the guide each time a sweep ends, asked afresh with no
   answer pressed: Lesson 3's four answers (`aria-pressed`, at least 44 px; FACTS 59). So it follows
   each version, and discomfort is caught after the first, not only after both.
   - Easy or Workable leaves everything as it was and shows LESSON.md's line for the versions sung
     so far: while only one has been, "That's one starting note. Now the other version, from a new
     note."; once both have, "One tune, two starting notes: you just transposed it." A version is
     sung once a sweep has ended after it, whichever version came first.
   - Effortful shows Lesson 3's gentle line, "Keep it gentle: rest before you sing again.", and puts
     the guide and Move do away (REQ-GVC-021: a report of effort suppresses immediate-repeat
     encouragement). The versions still play, at the do Move do last set. The Wrap shows the rest
     card, because the practice card's Interval Trainer would ask for more singing, an octave leap
     in every default run (REQ-GVC-055; FACTS 40, 59; LESSON.md, For the vocal coach, to confirm).
   - Uncomfortable shows Lesson 3's enough-for-today line, "Thanks for saying so. That's enough
     singing for today: rest your voice.", and the doctor lines, puts the guide and Move do away,
     and the Wrap shows the rest card (REQ-GVC-023, REQ-GVC-055).
   - An answer can be changed until the next sweep, but a guide put away and a rest card picked stay
     so for the visit. The page keeps the ending in memory for the visit, never in storage.

The flow is a pure rule (`lesson-06/sing-flow.ts`), as Lesson 5's hold flow is: from the comfort
answer, the voice, the versions sung and the latest answer, it gives the state, the controls shown,
the line and the Wrap's card, so every branch above is unit-tested (Tests, 7).

Nothing listens and nothing is scored: the page has no microphone and never calls `getUserMedia`,
so it produces no reading to get wrong (REQ-GVC-031), and its lines describe the tune and the task,
never the body (REQ-GVC-045; FACTS 60). The stop line, "Stop immediately if anything feels
uncomfortable.", is in one place, above the buttons, and the doctor lines appear only after "Just
listen today" and "Uncomfortable", as on Lesson 3's page. Keyboard order follows the flow: the
comfort buttons, the voice buttons, the two Play buttons, Start the guide, Move do, then the four
feelings; Space never starts the guide by itself. Under reduced motion the path's notes light one
after another instead of the travelling line, the breath mark lighting in its turn, and the ring
shows a number instead of breathing.

### 7. Recall and quick check

Two quizzes share this page, so it depends on the three changes Lesson 2 makes to `kit/quiz.ts`
(its WEB-SPEC, "What the kit and the app still need"): a root element or id prefix, because the kit
binds to `#qs`, `#scoreN` and `#quizReset` and writes the ids `q0` and `fb0` onwards
(`kit/quiz.ts:104-108`, `:155-165`); `lesson` optional, because the kit marks `lesson` done once
every question has an answer (`:174-175`); and a question `id`, the telemetry's `question_id`
(`QuizQuestion` has none, `:31-36`). If no earlier page has landed them, this one does, in the shape
Lesson 2 describes.

- **Recall**: Lesson 4's questions 1 and 4, word for word with their feedback (LESSON.md; FACTS
  7), under their Lesson 4 ids, `l04-q1` and `l04-q4`, shown to everyone (Lesson 4 is a
  prerequisite). Reshuffled from a seed of its own (keys `fyp-l06-recall-seed` and
  `fyp-l06-recall-v1`); earlier answers are never shown, so the answers measure delayed retrieval
  (MASTER-PLAN § 9). It takes no `lesson`, so it marks nothing done. Neither question plays a sound
  (FACTS 71). "Try Lesson 4, Step 1 again" is a plain link to Lesson 4's page, `/learn/04`,
  opening in a new tab so the viewer keeps their place here, never `data-goto-step`, which would
  move this page's own deck: the rule Lesson 2's reviewed spec sets for a question reused on
  another lesson's page (its "What the kit and the app still need", item 9). It stays the page
  only, as the brief for this lesson asks, even though that rule allows a step address once a step
  deck can open at one (Lesson 3 WEB-SPEC, "New engineering, in one list", item 6); Lesson 4's deck
  opens on Step 1 (FACTS 7). On the public host each answer is a telemetry event with its
  `visit_index`.
- **Quick check**: LESSON.md's four questions, ids `l06-q1` to `l06-q4`, keys `fyp-l06-seed` and
  `fyp-l06-quiz-v1`, and `lesson: 6`, so answering all four marks Lesson 6 done in the explorer.
  Three answers each, shuffled per question from the stored seed, one-line feedback for every
  answer, and a check icon and ink (not gold) on the right one. The kit prints "Right." or "Not
  quite." before each line (`kit/quiz.ts:167`), so no feedback line starts with "Right", "Yes" or
  "Correct". Question 1's play button plays `line-c`, then `line-fs`, and question 3's plays C4 then
  F4 (FACTS 63, 69). Each sits in the slot Lesson 2's spec adds after a question's heading, outside
  the `<h3>` that labels its answers (`kit/quiz.ts:155`), so the button is not part of every
  answer's name. The kit rebuilds the questions on every answer (`kit/quiz.ts:148-150`), so those
  buttons are handled by a listener on the quiz's root, as the step links are. "Try Step 2
  again", "Try Step 3 again", "Try Step 4 again" and "Try Step 5 again" use the kit's
  `data-goto-step`. Answers stay in the viewer's browser until the telemetry track exists.

### 8. Go deeper drawer

A `details` disclosure, closed by default, under Step 5's text, holding LESSON.md's one item.

## Audio

Every tone is synthesised in the page with Web Audio at the frequencies in FACTS 62 and 62a,
through the kit's sound module and its house envelopes
(`.claude/memory/audio-pop-free-playback.md`), and started only by a tap: taps, the toys and the
games in the soft tone, Merc's singing in Merc's "ooh", the guide's count-in in the soft tone at
half a tap's level (FACTS, Sounds). The two songs are played only as their bare melodies,
synthesised, never from a recording or an arrangement (FACTS 30). Each note of a sung line is its
own voice, so repeated notes ("Twin-kle") are heard as two. Nothing autoplays, one sound plays at a
time, and the page has no music bed.

## Mercs

Lesson 1's setup through the kit (`kit/merc-duo.ts`, `kit/merc-warm.ts`): the app's renderer
loaded after first paint, one WebGL context per Merc, medium quality on phones, turned towards each
other, paused off screen, and the still images when WebGL fails or would run on the CPU.

- They live in the hero, and their reactions are the hero pair's: blue `sing` while the hero's
  Play sounds and while the cold open's two plays sound; orange `celebrate` once after the
  cold-open reveal (no sparkles), the puzzled guesser who then gets it (playbook rule 15).
- `merc-duo.ts` has `mercSing` and `mercCelebrate` only (`:147`, `:184`), so this page asks for no
  other state: the Merc who is not singing idles.
- The cold open sits below the recall, so the live pair is often off screen and paused; the bubbles
  carry each Merc's still, and the compact line carries the moment. In Sing it the ring shows the
  still of the Merc singing (Toys 6).
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Interval Trainer.** `mercurypitch.com/pitch-training` opens the Exercises tab (FACTS
  44); the viewer taps Interval Trainer, which plays two notes, the second always higher, then asks
  for both back (FACTS 40), six rounds at the default pace (FACTS 41), starting low in the saved
  voice range (FACTS 42). It scores each note against the octave it plays (FACTS 43), so the copy
  says so and sends the viewer to Settings, Singing Voice Range, first (CURRICULUM § 4 item 7). The
  link is `/pitch-training?lesson=06`, and the `?lesson=` marker lets First Light, the main app's
  intro, step aside on a first visit (FACTS 44a), so the card, the rest card and the footer carry no
  first-visit line (the series' old line, FACTS 44, went when the marker shipped).
- **Today, Ear Lab's Leap.** `mercurypitch.com/ear-lab`, then tap Leap (FACTS 45, 46); on the public
  host `/ear-lab?lesson=06`, which keeps the bench's `#/ear-lab` boot. Leap needs no voice, so it
  stays on the rest card (FACTS 59).
- **Needed, proposed: `/exercises/fourths-and-fifths`** (CURRICULUM § 4 item 2, the Phase 1 App
  track): Interval Trainer with the planned `intervals` field set to a perfect fourth and a perfect
  fifth, both up (5 and 7 semitones; the field's shape is the App track's to settle), registered in
  `EXERCISE_SLUGS` (`src/features/exercises/slug-map.ts:47-65`) with a line in
  `src/tests/slug-map.test.ts`. The difficulty stays the viewer's own; the director may add a
  beginner difficulty, as Lesson 4's proposed slug does. Beyond the field itself it needs (FACTS
  47, 49):
  - repeats: `plannedRounds` caps a run at the pool's size and `generateIntervals` draws each
    interval at most once (`use-interval-trainer-controller.ts:46-64`), so a two-interval pool must
    be allowed to repeat, with no interval twice running, or the run is two rounds long;
  - the octave: Interval Trainer scores the written octave (FACTS 43), so until the octave-folded
    option ships (CURRICULUM § 4 item 7) the card keeps its Settings sentence; Interval Trainer
    belongs on item 7's list beside Pitch Hold and Scale Runner;
  - `?lesson=06` on the link, so First Light steps aside (FACTS 44a);
  - App content: the menu card's "above and below" (FACTS 48), which the App content track already
    lists.
- **Needed, proposed: `/exercises/steps-and-leaps`** (CURRICULUM § 4 item 5): the planned
  `ear-drill` launch kind with a bank subset, opening Leap with `leap:m2`, `leap:M2`, `leap:P4` and
  `leap:P5`. As Lesson 2 decided for its two-answer run (its DECISIONS 73; FACTS 49), it rates on a
  track of its own (`RunTrack`), never the shared Leap rating; its guess floor matches the pads it
  shows, a quarter for four (`drills.ts:58-60`, `:233-237`); and it passes `updateItem: false`.
- When either ships, LESSON.md's editorial note gives the copy, and the Wrap and the footer switch
  to the slug; the explorer card, which links Leap, switches when `steps-and-leaps` ships.

## What the kit and the app still need

Found in the kit and the app as they stand (18 October 2026, `4d5891ac0`, with `src/`, `public/`
and `learn/` unchanged at `0f416f33a`), beyond the parts Lessons 2 to 4 promote into the kit (Toys
table):

- `kit/quiz.ts`: Lesson 2's three changes, which this page's two quizzes need, and its slot for a
  question's own controls, which quiz questions 1 and 3 need (Lesson 2 WEB-SPEC, "What the kit and
  the app still need", item 9; Toys 7).
- `kit/explorer.ts`, shared with Lessons 3 and 4, needs nothing new: a lesson with a page and no
  film reads "Ready · read", its card offers "Start lesson" (`/learn/06`) without "Watch the
  episode" and shows its Length, "15 min"; the page passes `current: 6`, and other lessons' cards
  link to their own pages.
- `kit/season.ts`, Lesson 6's entry (`:182-200`): `minutes: 15` (FACTS 3). The practice link
  stays Ear Lab's (`href` `/ear-lab?lesson=06`, `addr` `mercurypitch.com/ear-lab`, `label` "Ear
  Lab"), and its `note` stays "then tap Leap to name them", printed "Ear Lab, then tap Leap to name
  them" by `practiseMarkup` (`kit/explorer.ts:98-103`): the `?lesson=` step-aside has shipped
  (FACTS 44a), so the note needs no first-visit form. Its `needs` stays until the slug ships. A
  second proposal only, for the director: link Interval Trainer instead, the Wrap's lead drill
  (`href` `/pitch-training?lesson=06`, `label` "Exercises", `note` "then tap Interval Trainer").
- `kit/notes.ts`: Lesson 4's spelling helper (its Toys 1 and "What the kit and the app still
  need"), each name in signs ("B♭4") and in words ("B flat 4"), for the bead names, the readouts,
  the slider and every accessible name; `letterOf` and `nameOf` know only the seven letters
  (`kit/notes.ts:36-61`).
- Lesson 4's names switch (its Toys 1), promoted into the kit with a choice of modes, so this page
  offers Letters and Do-re-mi.
- `kit/tune-line.ts`: the tune line (Toys 1), new, generic over a list of notes and lengths, so
  Lessons 9 and 14 can draw their phrases with it.
- The ear game (Toys 4): Lesson 2's Semitone or tone?, promoted and generalised to N answers and a
  direction rule.
- Lesson 3's comfort check (`kit/comfort.ts`), usable without its microphone steps, and its voice
  choice, reading and writing `fyp-voice`.
- Lesson 4's scale guide, generalised to any number of rows and any path, with its count-in and
  Move do (Toys 6), and the feeling question as a kit part shared with Lesson 3.
- `vite.config.ts`: `/learn/06` served from `learn/06.html` in dev and preview, as `LESSON_01_PATH`
  is (`vite.config.ts:81`, `:132-133`), and `learn/06.html` as a build input beside `lesson01`
  (`:447-448`).
- `src/lib/sw-runtime.ts`: `/learn/06` and `/learn/06.html` in `STANDALONE_DOCUMENT_PATHS`, as
  `/learn/01` is (`sw-runtime.ts:131-135`).
- `public/sitemap.xml` and `public/llms.txt` (its "Lessons" list, `:62-67`): Lesson 6's entry.
- `public/learn/lesson-06-og.jpg`: the share card, 1200 x 630, a still of the hero: the title over
  the tune line on C with its leap bracketed.
- The page's head, as Lesson 1's (`learn/01.html:9-58`):
  - title: "Intervals: the distance between notes · Find Your Pitch, Lesson 6 | MercuryPitch";
  - meta description: "Why can you start 'Twinkle, Twinkle' on any note and it is still the same
    tune? A fifteen-minute lesson with live sound toys: a tune as a pattern of intervals, steps and
    leaps, transposing, and intervals named by tunes you know. With the Season 1 map.";
  - canonical and `og:url`: `https://mercurypitch.com/learn/06`; `og:image`: the share card, with
    alt text naming what it shows.
- Lessons 1 to 5's pages, when this one goes live: nothing to edit in their explorers, which read
  each lesson's state from the season (`kit/season.ts`). Lesson 5's next-lesson card turns from
  "coming later" to "ready to read".
- App content (the App content track): Interval Trainer's menu card, "above and below" (FACTS 48).

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-06/` and the new kit
parts:

1. The melody data equals the published score: the fourteen notes and lengths of FACTS 20, and
   "Should auld ac-quain-tance be for-got" as FACTS 25.
2. `transpose(line, n)`: for every start from C4 to B4 the gaps equal 0, 7, 0, 2, 0, −2; the F♯4
   line shares no note name with the C4 line and is all black keys (FACTS 36).
3. `swapSizes(line)`: the same signs of every gap, exactly two gaps changed, and notes 1, 2, 5, 6
   and 7 unchanged (FACTS 37), at every start.
4. `classify(semitones)`: 0 same, 1 and 2 step, 3, 4, 5 and 7 leap; `intervalName`: 1 to 12 against
   Hutchinson's table (FACTS 11), and the five labels against `LEAP_BANK`'s labels and payloads
   (`src/lib/ear/banks.ts`), imported, not copied.
5. The games' sequences from a fixed seed: Step or leap? draws only 1, 2, 3, 4, 5 and 7, first notes
   from C4 to G4, every note from F3 to D5; Name it plays each of 1, 2, 5 and 7 twice, never the
   same twice running, steps down and leaps up (FACTS 67).
6. The guide: each version 9.6 s; the count-in 0.8 s and 0.2 s; Move do clamps at four semitones
   either way and keeps the versions three apart; at Move do 0 both versions lie inside every
   preset of the chosen voice, checked against `VOCAL_RANGES` imported from
   `src/stores/settings-store.ts` (FACTS 56, 57).
7. The Sing it flow (`lesson-06/sing-flow.ts`, Toys 6): with no stored voice the voice choice
   comes before either path, and a stored voice starts pressed and can be changed; "Just listen
   today" hides the guide and Move do and picks the rest card; the feeling question follows every
   sweep, asked afresh; with one version sung, "Easy" and "Workable" give the one-version line and
   change nothing else, and with both sung, the transposed line; "Effortful" and "Uncomfortable"
   put the guide and Move do away for the visit and pick the rest card, and a later change of
   answer brings back neither; nothing is written to storage but `fyp-voice`.
8. Copy: every line of LESSON.md's page copy and every template in Toys 4 and 6 passes
   `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts`, surface `finding`); no quiz
   feedback line starts with "Right", "Yes" or "Correct"; no accessible name or live text in Toys 1
   to 6 holds a ♯ or ♭ sign.
9. Every fixed sound's frequency equals `hz(m)` for the notes of FACTS 62.
10. Spelling, through Lesson 4's helper: at every start from C4 to B4 the fourteen names give one
    letter per scale degree (the same degree always the same letter, six degrees on six letters)
    and agree with Lesson 4's table for that key (its WEB-SPEC, Toys 1); from B♭4 the lines read
    B♭ B♭ F F G G F and E♭ E♭ D D C C B♭; F major's fa is B♭; no name is E♯, B♯, C♭ or F♭ or has a
    double sign; the spoken names read "B flat 4"; and the guide's readout at Move do −4 reads "do
    is B♭2, then D♭3" (FACTS 24, 38, 57; `verify.py` runs the same checks).
11. Layout, the pure helper behind Toys 1's targets: at every width from 344 to 1440 px every bead,
    gap and bracket target is at least 44 px wide and none overlaps another in its strip, each gap's
    target lies under its own gap, and gap 7's sits at the end of line 1's strip (FACTS 72).

End to end (Playwright, at 390 x 844 and 1440 x 900):

1. No AudioContext before the first tap; nothing plays before a play button.
2. Cold open: Play from F♯ is disabled until a choice, enabled after; the reveal stays hidden until
   `line-fs` has finished; with sound off the hint shows and the reveal waits.
3. The tune line by keyboard alone: Tab reaches every bead and gap; the slider moves by arrows and
   jumps by Home and End; after a slide the gap numbers read the same and the names under the beads
   follow Lesson 4's spelling; the names switch toggles `aria-pressed` and shows do-re-mi in the
   letters' place; Swap sizes toggles `aria-pressed` and the dashed overlay; each announcement in
   Toys 1 reaches the live region, in spoken names. At 390 x 844, in Steps 2 and 5 the two lines
   stack, and every bead, gap and bracket target measures at least 44 x 44 px with none
   overlapping, at every start.
4. The games: keys answer; Space replays when no button has focus, and presses a focused button; a
   missed round is not asked again; the count reads "N of 10" or "N of 8".
5. Sing it: the comfort check shows first, every visit; with no stored voice the voice choice
   follows either answer, and nothing plays until a voice is chosen; a stored `fyp-voice` shows
   pressed, and a tap on the other voice changes it; "Just listen today" shows no guide and no Move
   do, shows the doctor lines and leaves the rest card in the Wrap; Start the guide stays
   `aria-disabled` until a version has played; the feeling question appears when each sweep ends;
   "Easy" after the first version's sweep shows the one-version line, and after the second's the
   transposed line, and keeps the Interval Trainer card; "Effortful" hides the guide and Move do and
   shows the gentle line; "Uncomfortable" hides the guide and Move do, shows the doctor lines and
   the rest card.
6. No call to `navigator.mediaDevices.getUserMedia` at any point (a spy).
7. The recall shows with an empty `fyp-done`, and answering both its questions marks nothing done:
   `fyp-done` stays empty and no explorer node changes; its step link is
   `<a href="/learn/04" target="_blank">`; answering all four quick-check questions marks Lesson 6
   done in the explorer; each feedback line starts "Right." or "Not quite.".
8. Every practice link carries `?lesson=06`.
9. With reduced motion emulated, the slide and the swap land in their end states with no
   transition, the guide's notes light one after another in place of the sweep, and nothing moves
   on its own.
10. The Wrap after "Effortful": after the first version's sweep, "Effortful" leaves the rest card in
    the Wrap, with Interval Trainer named for later, "then tap Interval Trainer", and no Interval
    Trainer card; answering "Easy" after that does not bring the card back on this visit.

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=06`. Then the layout, accessibility, sound, motion and storage
rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children, touch
targets of at least 44 px with no two tap zones overlapping, visible focus, a single dark theme
with every colour a token and an explicit body background, sound only after a tap, localStorage
only for per-viewer conveniences inside try/catch, and the whole page usable with no sound, no WebGL
and no storage. Every ♯ and ♭ the page prints in text (the buttons such as Play from F♯, the
readouts, the bead names, the quiz's answers and feedback) has a spoken name, as Lesson 2's
contract sets: the sign is `aria-hidden` and a visually hidden word follows it, so a screen reader
says "F sharp" and "B flat"; the figures' accessible names and every live region use words only.
The page stores the quiz seeds and records (`fyp-l06-recall-seed`, `fyp-l06-recall-v1`,
`fyp-l06-seed`, `fyp-l06-quiz-v1`), `fyp-done`, `fyp-voice` and the masthead's Pause animations
choice, `fyp-motion` (`kit/motion-switch.ts:12`), and nothing from Sing it but the voice.

Page QA before publishing (PRODUCTION-PIPELINE § 5) adds, for this page:

- Every bead, gap, slider position and toggle works by keyboard alone and announces what LESSON.md
  shows; the whole of Sing it runs by keyboard, and a screen reader hears every state.
- At 390 x 844 the two lines stack in Steps 2 and 5, the figure spans the card's inner width, and
  the tune line, its names, gap numbers and brackets fit without overlap at every start from C4 to
  B4, with the swap shown and without, every target at least 44 px square (Toys 1, Layout and
  targets); at 360 and 375 px the minim's column shrinks as Toys 1 says and nothing scrolls
  sideways.
- The network panel and the browser's microphone indicator stay quiet through Sing it: no request,
  no microphone.
- The Wrap shows the rest card after "Effortful", after "Uncomfortable" and after "Just listen
  today", and the Interval Trainer card otherwise.
- The app-check sweep at phone and desktop width, with Sing it open in each state.
