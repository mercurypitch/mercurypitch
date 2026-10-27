# Lesson 8 web page: spec

The Lesson 8 page is the web lesson for "Beat, tempo and the backbeat": written steps, one main toy
in five step states with a compact state and free play, two predicts, an ear game, a tap pad, a
checkpoint in two parts (a tap take that times the viewer's taps, then one sung line that nothing
listens to or scores), two quizzes (the recall and the quick check) and the lesson explorer. Copy is
in [LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a text-only package: no
film exists for Lesson 8, so the page has no Watch section and the masthead's anchors are Lesson,
Sing and Explorer. It is built on the kit (`src/features/lessons/kit/`) as it stands on main at
`d59c00ad6`, and like Lessons 2 to 7 it reuses and never copies: a part that still lives in an
earlier lesson's module, or that Lessons 2 to 7 plan to promote, moves into the kit first. Where
this page shares a behaviour with Lesson 3's checkpoint (the comfort check, the voice choice, "How
did that feel?" and the rest card), it is Lesson 3's, unchanged unless this spec says otherwise, and
after "Effortful" it follows Lesson 6: no further try, and the rest card in the Wrap. Some of what
it reuses is on Lesson 6's page branch, #1149 (`origin/feat/lesson-06-page`, cited at `8a8d90335`),
and not yet on main: the kit's ear game, `kit/ear-game.ts`, and Lesson 6's questions and quiz plays.
#1149's fix pass also brings two kit changes this page's sound rules lean on: a predict's `play`
that can resolve as not heard, and a page-wide "now playing" owner (Toys 2; Audio). So the page is
built once #1149 has merged.

One object carries the lesson across its steps: the beat machine (Toys 1). It starts as a
metronome whose arm swings one way, then the other, one swing a beat; in Step 3 its beats unroll
into a row of pads grouped into bars; in Step 4 the row grows lanes, Kick, Clap and Hi-hat, and is
the beat grid of a step sequencer; in Step 5 it plays two patterns at one tempo. The hero's cold
open and the checkpoint show the same object in its compact state. Motion principle 2, "One object
carries the story across shots and keeps its identity" (`research/brand-motion.md` § 3.3), and
playbook rule 6 ask for it, and the CURRICULUM's signature is its moment: "a metronome whose arm
becomes the beat grid of a step sequencer" (FACTS 5).

Its public home is `mercurypitch.com/learn/08` (MASTER-PLAN § 12 item 9): a hand-written document
`learn/08.html` with its module in `src/features/lessons/lesson-08/`, wired as Lesson 3's page is
(`lesson-03/main.ts`). It is a draft until the vocal coach signs off its one sung line, as Lesson
3's page is: every build carries it, and the site worker serves it on the dev site and previews
but answers its address with the 404 page on mercurypitch.com until the admin console publishes it
(FACTS 7). Publish it only after Lesson 6's page at `/learn/06` is published, because its recall
check asks Lesson 6's questions and links there (FACTS 3), and once the kit parts listed under "What
the kit and the app still need" are in. Lesson 8 builds on Lesson 1, not Lesson 6 (`kit/season.ts`,
`EDGES`), but the console asks before it publishes this page while Lesson 6's is not published
there, since its own list of the recalls that ask a lesson off that map names Lesson 6 for it
(`RECALLS`, `src/features/admin/lessons/lesson-admin.ts:493-511`). "Publish anyway" still publishes
it, so the order is the owner's to keep; as a backstop the recall sits in a wrapper that leaves it
out while Lesson 6 is not live (Toys 7). The curiosity plan's kit work is on main: the next-lesson
card draws Lesson 9's tease above its new hook, and Lesson 7's card draws this lesson's tease, "Same
song, same speed. Only the claps move.", both from the season data (`kit/season.ts` and
`kit/lesson-copy.ts`; FACTS 6, 6a). The page writes neither into its markup.

## The checkpoint: how it takes input

The CURRICULUM's checkpoint is "tap on 2 and 4 under a groove, then sing a phrase on the beat"
(FACTS 5), which said "clap" until this package. The page takes the first half as **taps** and
judges their timing, and takes the second half as an **unscored sing-along**, so nothing on the page
listens.

- **Why taps, not claps.** A page hears a clap only through the microphone. The kit's listener
  reads pitch from a voice, not the moment a sound starts, and opens the microphone with echo
  cancellation off, so it would hear the page's own groove as loudly as the hands; the kit has no
  detector for the start of a sound; and the app has no sung-rhythm scoring to borrow (FACTS 35).
  A tap, on the other hand, is an input event the page can time exactly: the Ear Lab's rhythm
  drills take theirs the same way, on pointer down and on Space or Enter (FACTS 34). So the page
  invites claps aloud once, with the groove and unmeasured, then asks for taps, and says so: "The
  page can't hear claps, only taps." It never claims to hear a clap.
- **What is measured.** Each tap's time is its event's own timestamp, on the page's clock (FACTS
  37). Each beat's time is where the audio clock put it, mapped onto the page's clock by the
  context's output timestamp, which estimates when the device played it (FACTS 38, 39); where the
  browser gives no usable timestamp, the page reads both clocks at once, as the Ear Lab's Pulse does
  (FACTS 38). Two delays remain that no browser reports: the rest of the output path and the touch
  or key. So the take opens with two bars of tapping every beat, and the median of those taps'
  offsets, outliers set aside, is subtracted from every later tap: Drum Night's estimator, bounded
  at 0 to 250 ms and needing five taps (FACTS 40). A steady offset, the device's delay less any lead
  the hand keeps, then cancels out while it lies between 0 and 250 ms; beyond that the estimate
  stops at its bound and the rest stays in the taps, for the 120 ms window to hold (Edge cases).
  That is also why the page states no latency figure for any device.
- **The window and the judge.** A lined-up tap counts as on a beat within 120 ms of it, the Ear
  Lab's window for crotchet taps, "sized for a pointer or the space bar", and Drum Night's default
  (FACTS 41). The taps are matched to the beats by the Ear Lab's own judge, `judgeTake`
  (`src/lib/ear/rhythm-take.ts:93-132`), imported, never copied. At 90 BPM a beat is 667 ms, so
  the window is under half a beat and no tap can serve two beats.
- **What the page says.** One line about the taps: how many of the eight beats on 2 and 4 got a
  tap, and where the others landed (Toys 6). It describes the taps, never the person, and claims
  nothing it did not measure: it never calls the taps "in time", and it never says the line was
  sung on the beat, since nothing hears the voice (FACTS 44, 66).
- **The sung line** has a guide and no score: Merc sings the first line of "Twinkle, Twinkle" over
  the backbeat, the guide counts in and lights each beat, and the viewer sings along. The page
  never calls `getUserMedia` (FACTS 35, 69).
- **Audio on the audio clock.** Every click, drum hit and sung note is started, and every timed
  sound stopped, at a time on the AudioContext's clock, from a lookahead scheduler; no sound is
  started or stopped by a timer (FACTS 36; Audio).

## Look

Lessons 1 to 7's look, unchanged: the dark listening room, the series colour code, Lesson 1's type
and wordmark, and the motion rules. On this page:

- Gold `#ffd84d` marks only the backbeat, the fit: the numbers 2 and 4 and the clap marks on them
  whenever claps sit on 2 and 4 (the cold open from its reveal on, Steps 4 and 5, the take's two
  target beats). It glows once as the cold open's reveal shows.
- The cold open is neutral until its reveal: every click plain, the four beat numbers one size, and
  the claps drawn as plain dots, so nothing on screen says which beats are strong before the
  viewer has chosen and heard (FACTS 30c). From the reveal on, beat 1's number is drawn larger and
  the claps on 2 and 4 turn gold.
- The contrast case is dashed ink-2 `#a8b3bf` (MASTER-PLAN § 5): after the cold-open reveal, a
  faint dashed ghost of the claps on 1 and 3 stays beside the claps on 2 and 4 for comparison.
- Blue `#58a6ff` lights the syllables Merc sings and orange `#ff7448` those Tavi
  sings. The drums, the cells and the metronome are chrome `#c3ccd6`; the beat that is sounding is
  ink `#e6edf3`, lit.
- In the steps, beat 1's click is the high click, and its number is drawn larger: beat 1 is marked
  by pitch and size, not by colour. March's accented kick is a larger mark with an accent sign, ">",
  and is named "accented" to a screen reader. No meaning rests on colour alone.
- Nothing on this page is in tune or out of it, and nothing is scored, so it uses no canvas set,
  no singer violet and no mint.

Three things move: the Merc idle loops, and the metronome's arm and the lit beat while something
the viewer started is playing; Merc and Tavi's hops on the cold open's claps belong to the first.
Nothing moves on its own except Merc and Tavi. Under `prefers-reduced-motion` Merc and Tavi stop and
nothing hops; the arm holds still, upright, and the beat lamp lights in its place on each beat; the
playhead is a lit cell, which changes state and never travels; and every transition this page adds
(the morph, a pattern change, the cold-open slide) lands in its end state with no travel. What the
viewer starts still sounds. For everyone else the masthead's Pause animations toggle stops the
same things (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Lessons 2 to 7's departures kept: the step toys double as
the Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the
practice card sits in the Wrap. No Watch section (§ 4.2 item 10). The page opens in Lesson 2's
order: the hook, the stage, the sound gate and the cold open's predict, then the recall (§ 4.2
items 3 and 4, and § 12 item 13; CURIOSITY-MOMENTS § 3.1, "the order to copy"). Items 2 to 5 are
the hero, one `section.hero` laid out as Lesson 2's (`learn/02.html:333-506`). Above 1080 px it
has two columns, the hero's copy and the gate on the left, the stage and the predict on the right
(`lesson-stage.css:16-21`); at 1080 px and below it is one column in the order listed here, with
the promise after the predict (`lesson-stage.css:365-408`). So on a phone the title and the first
Play come before anything asks for an answer (CURIOSITY-MOMENTS § 3.1, "Above the fold"). Each
section's heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 3's (wordmark, "Season 1 · Lesson 08", anchors Lesson, Sing and Explorer,
   the Sound toggle off by default, Pause animations with its reduced-motion lock), through
   `initMasthead` (`kit/page-chrome.ts:122-154`) with Lesson 3's map of sections and
   `{ lesson: 8, deck }` (`lesson-03/main.ts:104-112`), which draws the lesson menu, remembers the
   steps the viewer reaches, and first settles the page's own links to other lessons by the state
   the page was served with (`followPageState`, `kit/page-chrome.ts:126`).
2. **The hook**, the hero's copy: the kicker, the hook question as the title (`h1.hook#hook`, as
   `kit/lesson-copy.test.ts:323-332` requires of every page from its first commit), the meta as
   four chips ("16 minutes", FACTS 4; "After Lesson 1", a link; "Also useful: Lesson 6, Intervals",
   a plain chip as Lesson 3's is, `learn/03.html:366-369`, FACTS 2; Sound on) and the promise, from
   LESSON.md. The title is the season's hook (`kit/season.ts:312`, FACTS 1); it says the song feels
   different and never says where the claps land, so it answers nothing the predict asks.
3. **The stage**: Tavi's and Merc's bubbles over Merc and Tavi on the floor line, with the beat
   machine in its compact state between them (Toys 1), and under the machine the two plays: "Play
   with claps on 1 and 3" (`twinkle-13`, FACTS 72), which works from the start, and "Play with
   claps on 2 and 4" (`twinkle-24`), locked until a choice (Toys 2).
4. **The sound gate**: LESSON.md's line and its button. At 1080 px and below it sits between the
   stage and the predict, so its button comes before the choices in the reading order, as it does
   in the tab order (`lesson-stage.css:386-396`).
5. **The cold open's predict**: the predict card, `#predict`, under the stage, as Lesson 2's is
   (`learn/02.html:452`): LESSON.md's predict, its two `[data-choice]` buttons, the lock hint and
   the reveal (Toys 2).
6. **Recall from Lesson 6**, `section#recall`, straight after the hero, as Lesson 2's is
   (`learn/02.html:509`): Lesson 6's questions 1 and 4, open once Lesson 6 is marked done; for
   anyone else the closed line "Done Lesson 6? Two questions from it". It sits inside
   `<div data-if-live="6">`, so it is left out while Lesson 6 is not live (Toys 7).
7. **Four words you'll meet**: beat, tempo, bar and backbeat, each with its definition, a small
   figure and a play button (Toys 3).
8. **The steps**: Lesson 1's sticky stage and step deck ("N of 5", Previous and Next), every step on
   the one beat machine (`toyFor: () => 1`), in five states (Toys 1), with the ear game and the
   predict in the step text (Toys 2, 4):
   1. Where is the beat? The metronome, with Start and the tap pad.
   2. How fast is the beat? The same, with Tempo and the tap readout (Toys 5).
   3. Why do musicians count to four? The beat row with Bars; Count the bar under the Notice; the
      Go deeper drawer (Toys 8).
   4. What makes a backbeat? The beat grid, Kick, Clap and Hi-hat, on Ableton's basic rock beat.
   5. So is rhythm just speed? The second predict, then March, Rock and Tempo; the mix-up card.
9. **Sing it**: first the tap take (Toys 6, part 1), then the comfort check, the voice choice,
   Merc's line, the guide, Move do and the feeling question (Toys 6, part 2); nothing listens.
10. **Quick check**: LESSON.md's four questions (Toys 7).
11. **Wrap**: the three recap lines, the challenge, the practice card in the version Sing it's
    ending picks, the next lesson's card, and free play. The practice card is Lesson 2's app card
    with LESSON.md's eyebrow, title, text, address and second drill: Drum Night, linked
    `/drum-night?drawer=learn&lesson=08`, and Ear Lab's Subdivide, linked `/ear-lab?lesson=08`
    (Practice links); no first-visit line, since the marker steps First Light aside (FACTS 54, 57).
    After "Effortful", "Uncomfortable" or "Just listen today" it is the rest card instead, with the
    same two drills, since neither asks for the voice (Toys 6). Both links open in a new tab. The
    next lesson's card is the kit's, drawn by `createNextCard(8)` before
    `createExplorer({ current: 8 })`, as Lesson 3's page draws its own (`lesson-03/main.ts:99-101`;
    `kit/next-card.ts:181-210`), from the season as the page's state shows it (`pageLessons`,
    `:185`): the eyebrow "Next lesson 09 · Landing a leap" with "Coming later"; Lesson 9's tease,
    "One note, two ways up: step by step, or one leap.", in `.next-tease` above its hook, "How do
    you land a note you have to leap to?", or the wordings the admin console picked; and "See it on
    the map" while Lesson 9 has no published page, then "Start lesson" to `/learn/09` (FACTS 6). Its
    slot, the page's mark, `<div class="next-card card l08-next" data-next-card hidden>` in `#wrap`,
    holds the tease figure (Toys 9), which the card keeps after its words (`kit/next-card.ts:184`,
    `:205`), as Lesson 2's mark keeps its figures (`learn/02.html:1823`). Free play unlocks after
    the card: every beat-machine control on one card (Toys 1; playbook rule 17), keeping the card's
    place after the challenge and the practice card (CURIOSITY-MOMENTS § 3.1).
12. **Lesson explorer**: the kit's, `createExplorer({ current: 8 })` (`kit/explorer.ts:256`), with
    Lesson 8 as the current node. Under its heading is Lesson 1's line, which names no lesson's
    state: the legend and the cards say it, from the season data. Its cards show only learner
    information: "Ready", "Coming later" or "Done", no signature, no backlog and no topic codes
    (FACTS 7, 58; Explorer and season data).
13. **Footer**: Lesson 1's, with "Season 1 · Lesson 08 · Beat, tempo and the backbeat"; the two
    practice links, printed `mercurypitch.com/drum-night?drawer=learn` and
    `mercurypitch.com/ear-lab`, with "Drum Night and Subdivide are free." and no first-visit line
    (FACTS 46, 47, 54, 57); Lesson 1's fonts line and "Every sound on this page is synthesised in
    your browser" (FACTS, Labels); no dateline; the legal links, as every lesson document closes
    (`src/tests/lesson-pages.test.ts:263-274`). With no film there are no voices to credit.

## Length

The learner copy is 2,534 words today, every branch counted (FACTS 4; 2,502 at `1308fd2e7`), 155
over the series' cap, Lesson 3's page at 2,379 words on the same count once the note under its title
is marked Editorial (2,382 under its old title, at `616c97edb`); the text package's 2,328 was under
it. The page runs about 16 minutes: 10.65 minutes of reading at 238 words a minute and 5.70 of
sound, toys and tasks, 16.35 in all. That is past MASTER-PLAN § 4.2's budget, "8 to 12 minutes of
active time, 500 to 900 words" (`MASTER-PLAN.md:137`), as Lessons 3, 5, 6 and 7 are (16, 18, 17 and
16 minutes: Lesson 3 FACTS 61, Lesson 5 FACTS 2, Lesson 6 FACTS 3, Lesson 7 FACTS 4). The owner kept
the longer lessons on 22 October 2026 (HANDOFF), so nothing is cut; were a cut wanted, the Go deeper
drawer (45 words) and the ABRSM sentence (14 words) would go first. Each step's text, with its Try,
its Notice and any predict, runs 91 to 120 words (Steps 1 to 5: 92, 91, 119, 120 and 115), inside
§ 4.2's 50 to 120 a step. Three parts carry more beside it, for these reasons:

- **Step 3, 174 words with its drawer.** Its Go deeper drawer (45 words) says why bars of 2 and of 4
  are hard to tell apart by ear, and is closed by default; Count the bar, its ear game, is a card
  under the Notice.
- **Step 5, 220 words with its mix-up card.** The mix-up card (95 words) sits in the step whose toy
  refutes it, as in Lessons 2 to 7.
- **Sing it, about 640 words.** It holds two tasks, the taps and the sung line, with their status
  lines, and the series' singing lines, Lesson 3's word for word and not cut (LESSON.md's intro).

The activities are timed from the spec's own lengths: the cold open's two versions and the choice,
25 s; the four words, 18 s; Step 1, 14 s; Step 2, 25 s; Step 3, 18 s and Count the bar, 48 s; Step
4, 19 s; Step 5, 30 s; the tap take about one and a half times with Play the groove, the comfort
check and the voice choice, 61 s; Merc's line, the guide and the feeling question, 24 s; the six
recall and quiz questions, 60 s (FACTS 4).

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                                                                      | New in Lesson 8                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The beat machine       | The kit's metronome drawing (`kit/explorer-figures.ts:20-32`), sound (`kit/sound.ts`), frame loop, step deck and stage fit; the app's drum voices (`src/lib/drum-voices.ts`); the stats site's arm angle (`research/stats-snippets/instrument-figures.js:103-104`)                          | The beat clock; the metronome on the stage; the beat row with Bars; the beat grid with Kick, Clap and Hi-hat; Rock and March; Tempo; the morph; the compact state |
| 2. Predict widgets        | The kit's predict (`kit/predict.ts`), with a free play before the choice and a reveal after both of two plays                                                                                                                                                                               | Nothing                                                                                                                                                           |
| 3. Four words             | Lesson 1's words strip, a ticket per word with its figure and play button, in the kit for Lesson 7 (`kit/words-strip.ts:1-12`)                                                                                                                                                              | Four new figures                                                                                                                                                  |
| 4. Count the bar          | The kit's ear game (`kit/ear-game.ts`, on #1149): Lesson 2's Semitone or tone? promoted and generalised to N answers                                                                                                                                                                        | Three answers, 2, 3 and 4, on the keys 2, 3 and 4 (a key per answer, new in the kit); the clicks as the game's notes                                              |
| 5. Tap pad and readout    | The Ear Lab's tap rule (`src/lib/ear/tap-rule.ts:22-52`, moved there from its `TapPad`, `src/features/ear-lab/EarStage.tsx:545-622`): pointer down, Space or Enter, the event's own time; since #1177, also a click no pointer or key made (`tap-rule.ts:81-93`)                            | A plain-DOM pad in the kit; the taps-per-minute readout                                                                                                           |
| 6. Sing it                | Lesson 3's comfort check, voice choice and feeling question (`kit/comfort.ts`, `kit/voice-choice.ts`, `fyp-voice`); Lesson 6's rest card after "Effortful" and its pure flow rule; the Ear Lab's judge (`src/lib/ear/rhythm-take.ts`); Drum Night's latency estimator, moved into `src/lib` | The tap take and its lines; the sung line's guide on the beat machine; Move do in semitones                                                                       |
| 7. Recall and quick check | The kit's quiz (`kit/quiz.ts`), with its prefix, slot and away links; Lesson 3's recall (`lesson-03/recall.ts`) and its step links; Lesson 6's question objects and quiz plays (on #1149), imported                                                                                         | Keys; the recall's `data-if-live` wrapper                                                                                                                         |
| 8. Go deeper drawer       | Lesson 2's `details` drawer                                                                                                                                                                                                                                                                 | One item                                                                                                                                                          |
| 9. Tease figure           | The kit's next-lesson card and its slot (`kit/next-card.ts`), as Lesson 2's figures sit in it                                                                                                                                                                                               | Two lines into the amber band                                                                                                                                     |

### 1. The beat machine

One component, `kit/beat-machine.ts`, new, in the states compact, metronome (Step 1), tempo (Step
2), bars (Step 3), grid (Step 4), patterns (Step 5) and free play. It draws in SVG (no canvas: every
part is a few shapes, and its cells are real buttons) and sounds through the beat clock (Audio). It
is generic over a pattern (rows, cells and levels) and a tempo, so a later rhythm lesson can draw
its patterns with it.

- **The metronome** (Steps 1 and 2): the kit's drawing, `metronomeSVG()`, the stats site's metronome
  recoloured with the page tokens (FACTS 59), drawn up to 210 px tall in the figure, with one beat
  lamp under its foot. While it plays, its arm's angle is −24° × cos(π t / s), where t is the time
  since the first beat on the audio clock, mapped to the page's clock (Audio), and s is one beat, 60
  / BPM seconds: the stats snippet's `metronomeAngle`, so the arm reaches a side on every beat, left
  and right in turn, and crosses the middle halfway between (FACTS 12, 59). The click sounds as the
  arm reaches a side, and the lamp lights for 120 ms. The arm's motion is drawn from the audio clock
  on the kit's frame loop, never from the CSS swing the explorer card uses
  (`lesson-sections.css:984-995`). The kit's drawing had one fixed gradient id, so one copy a page,
  and this page shows up to four metronomes (the stage, the hero, the guide and free play, beside
  the explorer card's), so `metronomeSVG(id)` takes an id per copy (`kit/explorer-figures.ts:20-32`;
  What the kit and the app still need, item 6).
- **The beat row** (Step 3): the signature move. On entering Step 3 the metronome slides into the
  figure's top-left corner, shrinking to 44 px, and its lamp unrolls into a row of pads, one per
  beat of a bar, numbered 1 to N, beat 1's number larger: the arm becomes the beat grid's first
  line. It takes 0.6 s on the kit's `expoOut` curve (`kit/reveal.ts:17-18`), runs backwards when the
  viewer goes back to Step 2, and under reduced motion lands at once. **Bars** is a segmented
  switch, 2, 3 and 4 (`aria-pressed`, at least 44 px each), from 4: the row shows one bar, and
  playing loops it, beat 1 on the high click (1,500 Hz) and the others on the plain one (1,000 Hz),
  the lit pad following the playhead (FACTS 74). A readout in the figure counts "Bar 3 · beat 2".
- **The beat grid** (Step 4): the row's numbers become the grid's header and three lanes appear
  under them, Kick, Clap and Hi-hat, labelled in a 56 px column with the small metronome above it:
  the inside of a drum pattern, a row for each sound and a column for each beat (FACTS 23). Step
  4's text explains each lane's name where it first appears (FACTS 22). Each Kick and Clap cell is
  a toggle button; each Hi-hat cell toggles its beat's two eighths together, drawn as two ticks.
  Step 4 opens on Ableton's basic rock beat with a clap for the snare (FACTS 22, 24, 75): kick on 1
  and 3, claps on 2 and 4, the hi-hat on every eighth, at 90 BPM. **Play** loops the bar; **Reset**
  puts the rock beat back. The click is off while the grid plays patterns, so the drums carry the
  beat (FACTS 75). The numbers 2 and 4, and the clap marks on them, turn gold whenever claps sit
  there (Look).
- **The patterns** (Step 5): **March** and **Rock**, a segmented switch (`aria-pressed`), and
  **Tempo**. March is a kick on 1, accented at gain 1.0, the BOOM, and claps on 2, 3 and 4, the
  whacks, with no hi-hat, at 120 BPM; Rock is Step 4's beat at 90 (FACTS 25, 75). Each pattern keeps
  its own tempo for the visit, starting from its own, so "swap the tempos" means March at 90 and
  Rock at 120. A pattern change while playing takes effect at the next bar line, its tempo with it,
  so the bar playing ends at its own pattern's tempo. Step 5's controls are a row of their own,
  shown only in this state: **Play**, **March**, **Rock** and its own **Tempo** slider, so nothing
  here touches Step 2's Tempo. All four start `disabled` in the markup, so the stage cannot answer
  the predict before the viewer commits (Toys 2). Play, March and Rock are buttons, passed as the
  predict's `unlocks`, which sets `disabled = false` on each as the choice locks
  (`kit/predict.ts:66-67`, `:124-126`). The Tempo slider is an `input`, which `unlocks` does not
  take, so the predict's `onChoice` enables it (`:65`, called at `:129`). Lesson 2's stage does the
  same with Sharp and Flat: `disabled` in its markup (`learn/02.html:938`, `:943`) and enabled from
  its predict's `onChoice` (`lesson-02/steps.ts:142`; `lesson-02/keys-toy.ts:341-345`). No
  `aria-disabled` is involved: a `disabled` control stays out of the tab order until the choice, and
  the choice locks for the visit, so the row stays open after it. This page is the first to pass
  `unlocks`, so its tests check it (Tests, unit 15).
- **Tempo** (Steps 2 and 5, and free play): a slider, 60 to 140 BPM in steps of 1, from 90 in
  Step 2 or from the pattern's own tempo in Step 5, in a slider row labelled "Tempo" with its
  value, "90 BPM", and ticks at 60, 90, 120 and 140 (FACTS 74). A change while playing takes
  effect from the next beat, and the arm's swing follows from that beat. Keyboard: arrow keys move
  it by 1, Page Up and Page Down by 10, Home and End jump to 60 and 140; `aria-valuetext` reads
  "90 beats per minute".
- **Readouts** sit inside the figure, as Lesson 1's do (`learn/01.html`, `.readout`), so no status
  line takes height: the metronome's "90 BPM" (Steps 1 and 2), Step 2's "Your taps: 88 BPM"
  (Toys 5), Step 3's "Bar 3 · beat 2", and Step 5's "March · 90 BPM".
- **Compact** (the hero's cold open, and the checkpoint's guide in Toys 6): two rows of two bars
  each, eight beat cells a row, the first line of "Twinkle" above the second, the syllables in
  their cells ("star" and "are" across two), the claps as dots under their beats, and the beat
  numbers over each bar, one size until the cold open's reveal (Look); a 44 px column at the left
  of the first row holds the small metronome. Its cells are drawings, never targets: 35 to 41 px
  wide on phones (FACTS 80). The drawing is `aria-hidden`, and a polite live region speaks for it:
  "Claps on 1 and 3" or "Claps moved to 2 and 4" as each version starts. Its cells light as Merc
  sings them, Merc or Tavi.
- **Layout and targets** (FACTS 80). The figure is 250 px tall at every width, the kit's height on
  the narrowest phones (`lesson-stage.css:1094-1110`), set by this page's stylesheet, because the
  tallest drawing, the grid with its number strip and bar labels, is 182 px; the morph keeps that
  height in every state. On phones (below 961 px, where the stage sits above the text) the figure
  spans the card's inner width (`.viz.wide`, `lesson-stage.css:1283-1293`), 356 px at 390 x 844.
  The grid's four beat columns sit beside the 56 px label column with 4 px between, so a cell is 72
  px wide at 390 px, 60.5 px at 344 px and never under 44 px at any width from 344 to 1440 px, and
  each lane is 44 px tall: every cell is a target of at least 44 x 44 px, and none overlaps
  another. Where the kit caps the figure under 182 px, on a phone held sideways (162 px at 844 x
  390, `lesson-stage.css:1111-1128`), the bar labels go and the numbers move into the cells' top
  corners, so the grid needs 140 px (FACTS 80). On touch the figure keeps the kit's `touch-action:
pan-y` (`lesson-stage.css:776`), so a swipe still scrolls; every action is a button.
- **The stuck stage** (FACTS 80). Beside the text the kit gives the stage the room the window
  leaves under the masthead and caps the figure at that room less the rest of the stage, which
  `stage-fit.ts` measures (`lesson-stage.css:662-704`; `stage-fit.ts:22-44`). The beat machine's
  stages, from the kit's stylesheets with a model that reproduces three measured stages, are at
  1024 px wide:

  | Step | Controls under the figure                   | Stage, px | Around the figure, px |
  | ---- | ------------------------------------------- | --------- | --------------------- |
  | 1    | Start and the tap pad (one 64 px row)       | 446       | 196                   |
  | 2    | Start and the tap pad; the Tempo slider row | 543       | 293                   |
  | 3    | Start and Bars 2, 3, 4                      | 426       | 176                   |
  | 4    | Play and Reset                              | 426       | 176                   |
  | 5    | Play, March and Rock; the Tempo slider row  | 523       | 273                   |
  | Free | Two rows, the Tempo slider and the tap pad  | 599       | 349                   |

  The kit's stage-fit test holds every built lesson at 1024 x 640, 1133 x 631, 1280 x 680 and 1366 x
  657 (`src/e2e/learn-stage-fit.spec.ts:34-58`), where the rooms are 564, 555, 604 and 581 px: so
  every step's stage fits whole, its figure never shrinks and nothing scrolls inside the stage. Each
  also keeps to the polish audit's budget of about 550 px at 1024 px wide, which Lessons 4 and 5
  hold (`src/e2e/learn-lesson-04.spec.ts:366-371`; `lesson-05/lesson-05.css:171-174`): the tallest,
  Step 2's, is 543 px. Free play is a card in the Wrap, not the stuck stage. At 390 x 844 the
  one-card deck's stages are 418 to 535 px, inside the 786 px below the masthead. No step shows a
  status line under its figure, and Count the bar and both predicts sit in the step text, not on the
  stage, which is what keeps Step 2 and Step 5 inside the room.

- **Keyboard and screen readers.** The figure is a group named for its state, with a summary that
  changes with it: "Metronome at 90 beats per minute, stopped", "One bar of 3 beats, playing",
  "Drum pattern, one bar: kick on 1 and 3, claps on 2 and 4, hi-hat on every half beat". Each cell
  is a toggle button (`aria-pressed`) named by its lane and beat, "Clap on beat 2", and the
  Hi-hat's "Hi-hat on beat 2, both halves". A polite live region says what each action changed,
  "Claps on 1 and 3", "March at 90 beats per minute", once per action and never on every beat. Tab
  order: Start or Play, the tap pad, Bars or the pattern switch, Tempo, Reset, then the cells, Kick
  before Clap before Hi-hat, beat 1 to 4. Start moves focus to the tap pad while the metronome
  plays, so Space and Enter tap at once (Toys 5).
- **States**: compact; metronome (Step 1); tempo (Step 2); bars (Step 3); grid (Step 4); patterns
  (Step 5); free play, every control together. Any state can be playing or still. Leaving a step by
  any route stops the step's sound and anything queued to play after it, a miss's replay in Count
  the bar included (Toys 4). Every route goes through the deck's `show`, which tells each registered
  toy the new step and the one before (`kit/step-deck.ts:167`): Next and Previous (`:213-223`), a
  swipe (`:225-251`), scrolling another step into view on the wide page (`:196-211`), the lesson
  menu's jump (`:281-285`, called at `kit/lesson-menu.ts:530`), a `#step-N` address
  (`kit/step-deck.ts:263-270`, `:292-299`) and a quiz's step link (`kit/quiz.ts:361`, `:366`). The
  page registers one toy (`registerToy`, `kit/step-deck.ts:92-96`), as `lesson-03/main.ts:80-87`
  does, whose `onStep(step, previous)` (`kit/step-deck.ts:45-47`) stops the stage, Count the bar and
  Step 5's predict plays whenever the two differ; a layout change that shows the same step again
  (`kit/step-deck.ts:188-191`) stops nothing. Any other play on the page stops it too: one sound at
  a time (Audio).
- **Free play** (Wrap): its own copy of the object in a card, as Lesson 2's free play is
  (`lesson-02/free-play.ts:1-13`), with every control: Play, Bars, the Click switch, March, Rock
  and Clear, Tempo, the tap pad and its readout, and the grid's cells. Nothing locks: the guided
  steps come first on the page (playbook rule 17). Its line, in the form of Lesson 6's ("Free
  play: try every control of the tune"), reads "Free play: every control of the beat machine in one
  place".
- **Captions.** Each step's figure carries its caption, as Lesson 6's do: "Fig. 1 The metronome",
  "Fig. 2 The metronome, with Tempo", "Fig. 3 The beat row", "Fig. 4 The beat grid" and "Fig. 5
  Two patterns, one grid". The hero's figure is described for a screen reader, before its reveal,
  by what it draws: "The first two lines of 'Twinkle, Twinkle' in four bars of four beats, one
  syllable to a beat, the beats numbered 1 to 4, with the claps drawn as dots under beats 1 and 3
  and a small metronome beside them."
- Under reduced motion the arm holds still and upright and its lamp lights on each beat; the
  morph, a pattern change and the cold-open slide land in their end states at once; a played
  pattern still sounds and lights its cells in turn.

### 2. Predict widgets

- Both are the kit's predict (`kit/predict.ts:30-72`, `mountPredict` at `:80`): the choice locks,
  the play buttons unlock, the reveal appears after the sound and never calls a choice wrong; two
  choices each, every button at least 44 px tall.
- **Heard means played to its end.** The kit counts a play as heard unless its promise resolves
  `false` (`kit/predict.ts:32-41`, `:184-188`), so a play the page cuts short must say so. Here a
  play is cut short by its own stop, by any other play on the page, which stops it (Audio), or, in
  Step 5, by leaving the step by any route (Toys 1, States), and none of these counts as heard: the
  page's `play` resolves `false` for "not heard", as #1149's fix pass lets the kit's `play` return,
  and the reveal stays hidden until a play runs to its end. This holds for both predicts: the cold
  open's "Play with claps on 2 and 4" and Step 5's two plays.
- **Cold open.** The choices are [ Strong beats ] [ Weak beats ] (FACTS 30b). Its two plays sit
  under the compact machine on the hero's stage, outside the predict card, and are handed to the
  predict as its `plays` (`kit/predict.ts:68-69`). "Play with claps on 1 and 3" is a free play
  (`data-free`, `kit/predict.ts:15-16`): it sets up the question and answers nothing. Only "Play
  with claps on 2 and 4" waits for the choice, and the reveal waits for it (`revealOn`). Until a
  choice the lock hint reads LESSON.md's "Choose an answer to unlock the play button." (until #1177,
  "the sound"); after one, `hints.chosen` reads "Locked in. Play with claps on 2 and 4.", in
  Lesson 2's form; with sound off, `hints.silent` is LESSON.md's line. The play slides the claps one
  beat along on the compact grid (0.4 s; at once under reduced motion), then Merc sings, the
  syllables on beat 1 loudest and those on 2 and 4 softest (FACTS 30c, 72), Merc and Tavi hopping on
  each clap (Merc and Tavi). The reveal's "You said" line is the kit's `guess`: "You said: strong
  beats" or "You said: weak beats", never "right" or "wrong"; as it shows, the numbers 2 and 4 glow
  gold once and beat 1's number grows (Look), and Tavi celebrates (Merc and Tavi). After it,
  `hints.again` reads "Play either version again."
- **Step 5.** Both plays, "Play the march at 90" and "Play the rock beat", unlock after the choice,
  and the reveal waits until both have been heard to their ends (`revealAfter: 'all'`), since it
  compares them; after the first, the hint reads "Now play the other one." (`hints.next`); after the
  choice, "Locked in. Play both, and watch the grid." (`hints.chosen`); after the reveal, "Play
  them again, or swap the tempos on the stage." (`hints.again`), which leads to the step's Try. They
  play
  two bars each on the stage's grid, which shows the pattern that is playing. The choice also opens
  the step's stage controls: Play, March and Rock as its `unlocks`, and Tempo from its `onChoice`
  (Toys 1, The patterns). The guess lines are "You said: yes, the same speed now" and "You said: no,
  still the march's pattern".
- With sound off the reveal waits, and the hint is LESSON.md's (`hints.silent`): the reveal only
  ever describes a sound that was heard (`kit/predict.ts:5-10`).
- States: waiting for a choice; a sound playing; choice made and sound heard, reveal shown.
- Under reduced motion the reveal appears at once, with no slide-in.

### 3. Four words

Lesson 1's strip, which the kit has held since Lesson 7 (`kit/words-strip.ts:1-12`): a ticket per
word with its small figure, its definition and a play button, with the page's own figures in
`lesson-08/words.ts`, as Lesson 7 keeps its own (`lesson-07/words.ts:1-14`). Each word is the page's
one sound: a newer sound anywhere on the page stops it, and a press of the word still sounding is
ignored (`kit/words-strip.ts:7-12`). The figures: for beat, four dots that light in turn; for tempo,
the same dots twice, far apart then close; for bar, two groups of four with a bar line between, each
1 larger; for backbeat, one bar's grid with the kick on 1 and 3 and the claps on 2 and 4 in gold.
Each button names what it plays: "Play four clicks", "Play 60, then 120 beats per minute", "Play two
bars of four", "Play a bar with claps on 2 and 4" (FACTS 73). Under reduced motion the dots light in
turn, with no other motion.

### 4. Count the bar

The kit's ear game, `kit/ear-game.ts`: Lesson 2's Semitone or tone? (`lesson-02/ear-game.ts:1-16`)
promoted and generalised to N answers on Lesson 6's page branch, #1149 (`kit/ear-game.ts:1-25` at
`8a8d90335`). It sits in Step 3's text column, under the Notice, as Lesson 2's game card does (its
DECISIONS 82).

- **A round** plays two bars and the next bar's first beat at 90 BPM, only beat 1 on the high click,
  so the bar's size is heard from the high clicks alone (FACTS 16, 19, 77): 5, 7 or 9 clicks. The
  game hands a round's events to the page's own `play` (`kit/ear-game.ts:123-129`) as `EarNote`s,
  each a `midi`, an `at` and a `dur` (`:37-42`), so each click travels as one: `midi` 90 for the
  high click and 83 for the plain one, the MIDI notes nearest 1,500 and 1,000 Hz, `at` its beat's
  time and `dur` 0.07 s. The page's `play` sounds the kit's tick at 1,500 or 1,000 Hz for each
  (FACTS 74), on the beat clock (Audio), and returns the run as the game's `EarPlaying`, its `done`
  and its `stop` (`:52-56`). A missed round plays again with `slower: 1.5`, every onset and length
  half as long again (`slowerBy`, `:112-114`), so at 60 BPM. The answers are three buttons side by
  side, "2", "3" and "4", each at least 44 px tall, named "2: answer bars of 2" and so on (until
  #1177 "Bars of 2", as Step 3's toggles are named); the number keys 2, 3 and 4 answer while the
  game has focus. The kit's game maps key 1 to the first answer, so here key 2 would answer "3": it
  takes a key per answer instead, its `keys` option, which this page brought to the kit
  (`keyAnswer`, `:98-110`; `keys`, `:119-120`; What the kit and the app still need, item 16). Space
  replays the round while the focus is anywhere in the game but on a button; on a focused button
  Space and Enter press it, as on any button, and the game's Play button replays the round while it
  waits for an answer (`:202-207`). The answers use `aria-disabled`, never `disabled`, so a keyboard
  user's focus stays put, as the kit's game has it (`:25-26`).
- **Feedback** names the bar and the sound, never the listener, in one template per size, each
  round's `words`: "Bars of 2: the high click came back every other beat, 1 2, 1 2."; "Bars of 3:
  the high click came back every third beat, 1 2 3, 1 2 3."; "Bars of 4: the high click came back
  every fourth beat, 1 2 3 4." The kit's game puts "Yes." before a right answer's line and "Here it
  is again, slower." before a miss's (`:233-235`). A miss lights the right answer, reads its line
  and replays the round at 60 BPM, 700 ms later (`:249-257`); the round is not asked again, and Next
  moves on. After two misses in a row the playbook's line "If that felt tricky, good: that's
  learning." follows, once a game (rule 15). A polite live region reads each line.
- **Rounds**: six, each size twice, shuffled with no size twice running, from a seeded sequence:
  each game, Play again included, draws a seed from `Math.random()`, keeps it in memory only and
  feeds it to the kit's `mulberry32` (`kit/dom.ts:57-66`); the unit tests pass a fixed seed.
- **The count** at the end, "5 of 6", counts the rounds answered right first time; no rating, no
  streak, nothing stored. Then Play again.
- **Leaving Step 3**, by any route, stops the round's sound and a miss's replay still waiting out
  its 700 ms (Toys 1, States). The kit's game keeps that replay on a timer, and since #1149's fix
  pass its `stop` clears the timer as well as the sound (`kit/ear-game.ts:145-149`); this page calls
  it on every step change.
- States: ready (a Play button); playing; answering; feedback shown; finished, with the count and
  Play again. Under reduced motion the answer lights and the line appear with no transition.

### 5. Tap pad and readout

- **The pad**, `kit/tap-pad.ts`, new: one wide button, 64 px tall, labelled "Tap" with "or press
  Space" under it, that takes a tap on pointer down with the primary button (a click would arrive a
  frame or two late) and on Space or Enter, ignoring a held key's repeats, timed by the event's own
  `timeStamp`, and flashes for 110 ms: the Ear Lab's rule exactly. The rule moved out of the Ear
  Lab's `TapPad` (`src/features/ear-lab/EarStage.tsx:545-622`) into a small shared module,
  `src/lib/ear/tap-rule.ts` (`pointerTap`, `keyTap` and `TAP_FLASH_MS`, `:22-52`), that the Ear
  Lab's pad and the kit's both call, so the two cannot drift (What the kit and the app still need,
  item 3). Since #1177 both pads also take a click no pointer or key made (`clickTap`, `:81-93`).
  The pad keeps `touch-action: manipulation`, so a quick second tap is never read as a zoom.
- **Steps 1 and 2.** The pad sits beside Start in one row. A tap there is silent and only flashes,
  so the clicks stay clear; Step 1 judges nothing. Start moves the focus to the pad while the
  metronome plays, and a polite live region says "Metronome started. Tap the pad, or press Space,
  with each click."
- **The readout** (Step 2, and free play): "Your taps: 88 BPM", 60,000 divided by the median of
  the last eight gaps between taps, rounded to a whole BPM, shown from the fourth tap of a run
  (FACTS 45). A gap longer than 2 s starts a new run, and the readout goes back to "Your taps: tap
  four times"; a gap shorter than 0.15 s is a bounce and is ignored. A steady delay cancels out of
  a gap, so the readout needs no lining-up. It describes the taps and is never stored.
- In Sing it the same pad takes the take's taps, and each sounds a clap (Toys 6).

### 6. Sing it

Two parts on one card, each with a visible status line that is also announced (`role="status"`):
first the backbeat, tapped, with no voice; then the line, sung, with Lesson 3's comfort check
before it. Lesson 3's rule for leaving holds for both: if the card stays off screen for 600 ms, or
the page is hidden, whatever is playing stops (`lesson-03/sing.ts:388-412`).

**Part 1: the tap take.** The card holds Play the groove, Start, the pad (Toys 5), the take strip
(the compact beat machine cut to one bar of four, with 2 and 4 marked) and the line.

- **Play the groove** plays the take's groove for four bars at 90 BPM, a kick on 1 and 3 and the
  hi-hat on every eighth, no click and no clap, 10.7 s, for clapping aloud (FACTS 76). A second
  press stops it. Nothing is measured.
- **Start: tap the backbeat** runs the take (FACTS 43), whose status reads "Press Start when
  you're ready to tap." until then: a 0.6 s lead, one bar counted in on the click, beat 1 on the
  high click, status "Counting in: one bar."; two bars of the groove with the click, status "Tap every beat:
  bar 1 of 2"; four bars of the groove without the click, status "Now 2 and 4: bar 1 of 4", the take
  strip's 2 and 4 outlined in gold; then 0.35 s more. 28 beats, 19.6 s in all. Each tap sounds a
  clap at once, at gain 0.7. Start becomes Stop while the take runs, and moves the focus to the pad.
- **The judge**, `lesson-08/take-judge.ts`, a pure function of the taps, the beat times and the
  tempo, so every line below is unit-tested (Tests, unit 5). Beats are counted from 0, the first
  count-in click; beat b sounds at T(b) = T(0) + b × 666.7 ms on the page's clock (Audio). Then:
  1. **Lining up.** Each tap whose nearest beat is one of the pulse bars' eight (beats 4 to 11)
     gives a sample, its time less that beat's. The samples go to the estimator moved from Drum
     Night (FACTS 40), which needs five; the page also asks five of them to fall inside its outlier
     radius. With fewer, the take is not lined up. Otherwise the estimate L, 0 to 250 ms, is taken
     from every tap.
  2. **Matching.** Every time is measured from beat 12, T(12), and the call is
     `judgeTake(taps, onsets, 120, barMs)` (`rhythm-take.ts:93-132`): `taps` are the lined-up taps,
     each tap's time less L and less T(12); `onsets` are the sixteen beats 12 to 27, at 0, 666.7 and
     so on to 10,000 ms; 120 is the window, `TOLERANCE_MS.quarters` (`:32-37`); and `barMs` is 15.5
     beats less the window, 10,213 ms. The judge's own filter keeps the taps from −120 ms to `barMs`
     plus 120 ms (`:99-101`), which is exactly 120 ms before beat 12 to half a beat after beat 27;
     `verify08.py` § 7 calls it the same way. A matched beat 2 or 4 (an odd beat) is a backbeat hit,
     up to 8; a matched beat 1 or 3 is a tap on 1 or 3; every tap left over, between beats or a
     second tap on one beat, matched no beat.
  3. **The line**, the first that applies:

     | When                                               | The line                                                                                                      |
     | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
     | Not lined up                                       | "We couldn't line your taps up with the beat that time. Tap every beat for the first two bars, then 2 and 4." |
     | No taps matched or left over in the last four bars | "No taps came in the last four bars. After the two bars of every beat, tap 2 and 4."                          |
     | At least 6 on 2 and 4 and at least 6 on 1 and 3    | "That's every beat: N on 2 and 4 and M on 1 and 3. A backbeat is 2 and 4 only."                               |
     | All 8 on 2 and 4, none on 1 or 3, none left over   | "All 8 landed on 2 and 4: a backbeat."                                                                        |
     | Otherwise                                          | "On 2 and 4: N of 8." then "M taps landed on 1 or 3." if any, then "K taps matched no beat." if any           |

     A count that starts a sentence is a word, "One tap" to "Nine taps", and a digit from 10; one
     tap is "One tap landed on 1 or 3." So two taps a beat early read "On 2 and 4: 6 of 8. Two taps
     landed on 1 or 3." (FACTS 42).

- **After the take** the take strip grows to the last four bars, one row a bar, and draws where each
  lined-up tap fell as a small tick, ticks on 2 and 4 in gold: a drawing of the taps as measured,
  never a mark of the person (FACTS, Illustrations without claims). The line reads in the status
  region. **Again** runs the whole take again, the lining-up included; it is always offered, since
  the taps use no voice (FACTS 44), and nothing about a take is stored.
- **Stopping.** Stop, or leaving the card or the page, ends the take with no line: "Stopped. Press
  Start to tap again."
- **Sound off.** The take and the groove need sound: with sound off, Start and Play the groove show
  the kit's toast for a play that does (`kit/sound.ts:510-522`, `canPlay`, `needsSound`; till this
  PR, the usual one, and the groove ran silently) and run nothing. The status reads "Sound is off,
  so the take didn't start. Turn sound on, then press Start." or the groove's (LESSON.md). No Web
  Audio: both `aria-disabled`, "This browser can't play the page's sounds, so the take can't run."

**Part 2: the sung line.** The guide is the compact beat machine (Toys 1) cut to the first line,
two bars of eight beat cells with the syllables "Twin kle twin kle lit tle star", "star" across
the last two, and the claps on 2 and 4 in gold, with the still of the Merc singing beside it,
Merc for the lower voice and Tavi for the higher, never a microphone icon. Every state has its
status line, LESSON.md's (Sing it, Status lines): the comfort check's "Before you sing: how is
your voice today?"; the voice choice's "Choose the voice you'll sing with.", or "Choose a voice: it
picks the Merc who sings." after "Just listen today"; "Just listening today: press Play Merc's line
to hear it."; before Merc's line is heard, "Play Merc's line first: Merc sings it, then the guide
is yours."; then "Start the guide when you're ready, or play Merc's line again."; while Merc sings,
"Merc sings the line."; while the guide runs, "Your turn: sing with the guide."; when it ends,
"How did that feel?"; and once the guide is put away, "Merc can still sing the line for you."

States:

1. **Comfort check**, always first in this part and asked every visit (never stored): Lesson 3's
   line, its list naming all six of REQ-GVC-020's conditions, and its two buttons, through
   `mountComfort` (`kit/comfort.ts:158-166`; FACTS 60). The tap take before it needs no check: it
   uses no voice (FACTS 44).
2. **Voice choice**, after either comfort answer: Lesson 3's two buttons with Merc and Tavi's stills
   (`aria-pressed`, at least 44 px), read from and stored in `fyp-voice` through `VoiceChoice` and
   `bindVoiceButtons` (`kit/voice-choice.ts:30-47`, `:60-77`; FACTS 62). Its line has the two forms
   Lessons 6 and 7 write: with none stored, "Choose a voice to sing with. If you chose one in an
   earlier lesson, pick it again:", neither button pressed, and the next state waits for a choice,
   before "Just listen today" plays anything too, because the voice picks the Merc who sings; with
   one stored, "Keep the voice you chose before, or change it:", that button pressed, and nothing
   waits on it.
3. **Just listen today** (listen-only mode): LESSON.md's line with the doctor lines (FACTS 61,
   65); **Play Merc's line** sings it on a tap in the chosen voice, the guide lighting as it plays;
   Start the guide and Move do are not shown, and nothing asks the viewer to sing (REQ-GVC-021).
   The answer holds for the visit, and the Wrap shows the rest card (`VisitEnding`,
   `kit/comfort.ts:89-114`).
4. **Ready**: the controls in LESSON.md's order, under the Your turn text and the stop line, which
   sits in one place, on its own line above the buttons. **Play Merc's line** plays the guide's
   count-in bar, then Merc's "ooh" on the line's seven syllables over the groove, 8.0 s (FACTS 68,
   79), the cells lighting in step. **Move do** is two buttons, named "Move do lower" and "Move do
   higher" so they never share a name with the voice buttons, a semitone each, up to four either
   way, moving Merc's line and the guide together (FACTS 67). Its readout names semitones, never
   letters: "do: as written", "do: 1 semitone lower", "do: 3 semitones higher", so no spelling is
   needed; at four it says "do: 4 semitones lower, the lowest".
5. **Guide**: **Start the guide** is enabled once Merc's line has been heard with sound on (hear it
   first: playbook rule 16); until then it is `aria-disabled`, with the hint "Play Merc's line
   first." With sound off, Play Merc's line runs its lights silently and the hint reads "Sound is
   off: turn it on to hear Merc's line, then start the guide.", since the guide's count-in and
   groove are its point. The guide plays the count-in bar on the click, beat 1 on the high click,
   with do sounded once and softly on beat 1 (FACTS 79), then lights each beat as the line goes by,
   for 5.3 s, over Rock at half its gain, the backbeat under it (FACTS 76). Merc does not sing in
   the guide: it is the viewer's turn. Space never starts the guide, and focus never moves to a
   button when a state changes, only to its text (REQ-GVC-080, as `lesson-03/sing-view.ts:1-9`
   does). When the guide ends, the line counts as sung, and Start the guide gives way to the feeling
   question: from then on the only way to sing again is Again, so a visit holds at most two guides.
6. **How did that feel?** appears under the guide each time it ends, asked afresh with no answer
   pressed: Lesson 3's four answers through `mountFeelings` (`kit/comfort.ts:175-206`; FACTS 66).
   - Easy or Workable shows LESSON.md's line, "That's it: one line over the backbeat, done.", which
     names the task, never the voice or how the line went, since nothing listened; and **Again**,
     the guide once more, once a visit (Lesson 7 FACTS 58), so a visit holds at most two sung
     lines.
   - Effortful shows Lesson 3's gentle line, "Keep it gentle: rest before you sing again.", and
     puts the guide, Again and Move do away (REQ-GVC-021: a report of effort suppresses
     immediate-repeat encouragement). Play Merc's line still plays, at the do Move do last set. The
     Wrap shows the rest card (REQ-GVC-055; FACTS 66), set by hand until #1192, as the kit's
     `afterFeeling` leaves "Effortful" off it for the coach; this page now asks (`restAfterEffort`,
     `kit/comfort.ts:69-78`); LESSON.md's coach list asks the coach to confirm the wording.
   - Uncomfortable shows Lesson 3's enough-for-today line, "Thanks for saying so. That's enough
     singing for today: rest your voice.", and the doctor lines, puts the guide, Again and Move do
     away, and the Wrap shows the rest card (REQ-GVC-023, REQ-GVC-055).
   - An answer can be changed until the guide next runs, but a guide put away and a rest card
     picked stay so for the visit. The page keeps the ending in memory for the visit, never in
     storage.
   - The question, its line and Again hide while a guide runs. A guide cut short, by another of
     the card's controls, a sound elsewhere on the page or leaving the card, asks nothing: the card
     shows again what it showed before the guide ran, the answer, its line and Again included, and
     only a guide run to its end counts towards the two. When Again hides as it starts its guide,
     the keyboard's place moves to the status line, never to a button.

The flow is a pure rule (`lesson-08/sing-flow.ts`), as Lesson 6's is: from the comfort answer, the
voice, whether Merc's line has been heard, how many guides have run and the latest answer, it
gives the state, the controls shown, the line and the Wrap's card, so every branch above is
unit-tested (Tests, unit 8). The tap take is outside it: its Again and the practice drills stay on
offer after any answer, since neither uses the voice (FACTS 44).

Nothing listens and nothing is scored: the page has no microphone and never calls `getUserMedia`,
so it produces no reading to get wrong (REQ-GVC-031), and its lines describe the taps, the tune and
the task, never the body (REQ-GVC-045; FACTS 69). The doctor lines appear only after "Just listen
today" and "Uncomfortable", as on Lesson 3's page. Keyboard order follows the card: Play the
groove, Start, the pad; then the comfort buttons, the voice buttons, Play Merc's line, Start the
guide, Move do, then the four feelings and Again. Under reduced motion the cells light one after
another, which is the guide in either case, and the still stays still.

### 7. Recall and quick check

Two quizzes share this page through the kit's quiz (`kit/quiz.ts`, `createQuiz` at `:218`), with
the options it already has (`:80-104`): an id prefix for each quiz's elements; `lesson` optional; a
question `id`, the event's `qLesson` and `q`; and a question from another lesson linking "Try Lesson
M, Step N again" in a new tab, through `away` (`:94-101`, `linkAway` at `:191-216`). While that
lesson is not live where the page is served, the words stay with no link, which would lead to the
404 page (`:18-20`, `:197`, `:206-209`).

- **Recall**: Lesson 6's questions 1 and 4, word for word with their feedback (LESSON.md; FACTS 3):
  the very question objects Lesson 6's page asks, imported from `lesson-06/quiz-questions.ts` and
  filtered by their ids, `l06-q1` and `l06-q4`, never copied, as Lesson 4 imports Lesson 2's
  (`lesson-04/quiz-questions.ts:21`, `:28-29`) and Lesson 6 imports Lesson 4's (on #1149,
  `lesson-06/quiz-questions.ts:21`, `:28-29`). They run in the module `lesson-08/recall.ts`, which
  is Lesson 3's recall (`lesson-03/recall.ts:1-10`, `:36-48`) with Lesson 6 for Lesson 2: open for a
  viewer who has marked Lesson 6 done (`Done.has(6)`, `kit/progress.ts:22-44`), and otherwise the
  closed `details` line "Done Lesson 6? Two questions from it", which opens the same two. Prefix
  `rc-`, keys `fyp-l08-recall-seed` and `fyp-l08-recall-v1`; earlier answers are never shown, so the
  answers measure delayed retrieval (MASTER-PLAN § 9). It takes no `lesson`, so it marks nothing
  done. Its links open Lesson 6's page at the step, `/learn/06#step-3` and `/learn/06#step-4`, in a
  new tab, through `away: { href: recallStepHref }`, as Lessons 3, 4 and 5 pass theirs
  (`lesson-03/recall.ts:47`; `lesson-04/main.ts:64`; `lesson-05/recall.ts:21`); the kit's step deck
  opens a page at the step its address names (`kit/step-deck.ts:19-23`). Question 1's slot is Lesson
  6's own, a "Play" button with `data-quiz-play="lines"` (on #1149,
  `lesson-06/quiz-questions.ts:37-38`, `:46`), which plays `line-c`, 0.6 s of silence, then
  `line-fs` (FACTS 78) through Lesson 6's `bindQuizPlays`, bound to the recall's `host`
  (`lesson-06/quiz-play.ts:14-33`); like every play here, it stops whatever else is sounding
  (Audio).
- **While Lesson 6 is not live.** The page publishes after `/learn/06` (FACTS 7), and the console
  asks before it publishes the page ahead of it (the intro), but "Publish anyway" goes ahead, so
  the recall has a backstop: `section#recall` sits inside
  `<div data-if-live="6">`. Where Lesson 6 is not live, the site worker takes out the wrapper and
  the section in it (`src/lesson-gate.ts:20-21`), and on a page no worker served `followPageState`
  does the same as the page boots (`kit/page-state.ts:84-108`, run first in `initMasthead`,
  `kit/page-chrome.ts:126`); where it is live, the wrapper goes and the section stays. The build
  marks the wrapper's tag `hidden` where its build's default holds Lesson 6 back, as it marks a
  reading's span, so a page no worker served reads right before its script runs: this page taught
  the build's marker that `<div>` form (`tools/draft-lessons.ts:134`, in `markLessonStates`,
  `:146-177`), where it took only spans and threw on any other reading. So
  `recall.ts` returns at once when `#recall` is absent, before any `q` call, since `q` throws on a
  missing element (`kit/dom.ts:13-19`); and the page calls it after `initMasthead`, where Lesson 3
  calls its recall first (`lesson-03/main.ts:56`, `:104`), so that it never mounts a quiz the page
  then takes away. Nothing then invites the viewer to answer questions on a lesson the explorer
  calls "Coming later", and the step links' fallback, their words with no link
  (`kit/quiz.ts:191-216`), is never shown.
- **Quick check**: LESSON.md's four questions, ids `l08-q1` to `l08-q4`, keys `fyp-l08-seed` and
  `fyp-l08-quiz-v1`, and `lesson: 8`, so answering all four marks Lesson 8 done in the explorer.
  Three answers each, shuffled per question from the stored seed, one-line feedback for every
  answer, and a check icon and ink (not gold) on the right one. The kit prints "Right." or "Not
  quite." before each line (`kit/quiz.ts:315`), so no feedback line starts with "Right", "Yes" or
  "Correct". Question 2's slot holds its play button, two bars of 3 and the next first beat, seven
  clicks, 4.0 s (FACTS 77), named "Play two bars"; the kit keeps a slot's controls across answers,
  and the page handles them with a listener on the quiz's `host`. "Try Step 2 again" to "Try Step
  5 again" use the kit's `data-goto-step`. Answers stay in the viewer's browser; since #1193 each
  question's first answer in a visit also goes out, anonymously.

### 8. Go deeper drawer

A `details` disclosure, closed by default, under Step 3's text, holding LESSON.md's one item, "Two
or four?".

### 9. Tease figure

The drawing in the next-lesson card's slot, the page's `[data-next-card]` mark, which the kit keeps
in the card after its words (`kit/next-card.ts:184`, `:205`, as Lesson 2's figures sit there): an
SVG, `aria-hidden`, of two lines rising from one note into Lesson 9's amber band, one in steps and
one a dashed arc with a "?" over its landing (CURIOSITY-MOMENTS § 2, Lesson 8, Tease; FACTS 6). It
sits under the words the kit draws, the eyebrow, the tease line, the hook and the way on
(`kit/next-card.ts:131-146`). It holds no button, since the card is a link, and it plays no sound.
Its styles go in this page's stylesheet, under a class of its own, `.l08-tease`: never Lesson 2's
`.tease` (`lesson-02/lesson-02.css:510`), which `learn-next-card.spec.ts` tests, nor the kit's
`.next-tease`, which sets the tease line (`lesson-sections.css:296-302`). It does not move.

## Audio

Every sound is synthesised in the page with Web Audio, through the kit's sound module, its master
bus and its house envelopes (`.claude/memory/audio-pop-free-playback.md`), and started only by a
tap: the clicks in the kit's tick (FACTS 74), the drums from the app's shared drum voices (FACTS 59,
75), Merc's singing in Merc's "ooh", each syllable its own voice so repeated notes are heard as two,
and the sung line's count-in do in the soft tone (FACTS 79). The tune is played only as its bare
melody, synthesised, never from a recording or an arrangement, and the patterns are the page's own
(FACTS 33). Nothing autoplays, one sound plays at a time, and the page has no music bed. One sound
at a time is the page-wide "now playing" owner's, from #1149's fix pass, which this page needs in
the kit: every source on the page, the stage, the predicts' plays, the four words, Count the bar,
the quiz plays, the take and Sing it, starts its sound through it, and it stops the one already
sounding first. A sound so stopped, or stopped by leaving its step, never counts as heard (Toys 2).

- **The beat clock**, `kit/beat-clock.ts`, new. A run is a list of events (a click, a drum hit, a
  note, a Merc's hop), each with a beat and a level, at a tempo, started at an audio-clock time a
  lead after the tap that starts it (0.1 s, or the take's 0.6 s). On every frame of the kit's frame
  loop (`kit/frame-loop.ts:95-155`) it schedules each event that falls within the next 0.1 s, at its
  exact time on the audio clock, with `start(when)` (FACTS 36); an event whose time has already
  passed when it comes up is skipped, never played late. A tempo change applies from the next beat.
  Each run plays into its own gain node on the kit's master bus, so Stop fades that node out over 30
  ms and drops it, and any hit already scheduled goes silent with it. The frame loop runs on
  `requestAnimationFrame`, which a hidden tab pauses, and the kit stops every sound when the page is
  hidden (`kit/sound.ts:475-477`), so a hidden page plays nothing.
- **The two clocks.** The beat clock maps an audio-clock time to the page's clock with
  `getOutputTimestamp()` (FACTS 38), read on every frame, using the latest reading whose
  `performanceTime` is above 0; with none, it pairs `currentTime` with `performance.now()` at the
  start of the run, as the Ear Lab's Pulse does (`src/features/ear-lab/PulseDrill.tsx:137-138`).
  Every lit beat, the arm's angle, Merc and Tavi's hops and the take's beat times use that map, so
  the picture follows the sound where the browser reports its output delay (FACTS 39).
- **Levels** (FACTS 72 to 76): the click 0.09 high and 0.06 plain; Kick 0.8 (March's accent
  1.0), Clap 0.7, Hi-hat 0.5; the viewer's claps in the take 0.7; under the sung line every drum
  at half its gain; Merc's "ooh" at the kit's level, 0.2, and in the cold open 0.2 on beat 1, 0.17
  on beat 3 and 0.14 on 2 and 4 (`kit/sound.ts:181`; FACTS 30c); the count-in do at 0.065.
- **What the kit's sound module has** (What the kit and the app still need, item 5): a voice and a
  burst of noise start at a time ahead on the audio clock (`at`, `kit/sound.ts:39-43`, `:169`;
  `playNoise`, `:406-473`), and `contourVoice` releases on it (`:321-347`). This page added the
  rest, the bus and the note in a module of their own that only this page imports,
  `kit/sound-ahead.ts`, so no other lesson's first paint carries them: a caller's own bus on the
  master, `openBus`, so the drums play into it and obey the Sound switch, the hush and the
  hidden-page stop, where the master is module-private (`kit/sound.ts:77`, made at `:109`, lent by
  `openMaster` at `:482-490`; the bus at `kit/sound-ahead.ts:18-66`, closed with every voice
  through `onStopAll`, `:31-35` there and `kit/sound.ts:134-137`, `:492-495`); `tick` with a start
  time and a bus, where it sounded at once (`kit/sound.ts:383-404`); and `bookNote`, a voice
  booked ahead and released by the audio clock (`kit/sound-ahead.ts:68-100`), where a voice given
  a length is stopped by a timer (`kit/sound.ts:262-268`, `:266`).

## Merc and Tavi

Lesson 1's setup through the kit (`kit/merc-duo.ts`, `kit/merc-warm.ts`): the app's renderer loaded
after first paint, one WebGL context per Merc, medium quality on phones, turned towards each other,
paused off screen, and the still images when WebGL fails or would run on the CPU.

- They live in the hero, beside the cold open's compact machine, and are on screen while it plays.
  Merc sings the cold open's two versions, a `mercSing` per syllable (`kit/merc-duo.ts:164`), and
  Tavi listens (`mercListen`, `:206`). Both hop on every clap, a hop in place that lands on the
  clap, started from the beat clock 0.53 s before it: a new kit cue (FACTS 30d; What the kit and
  the app still need). Tavi celebrates once as the reveal shows, the puzzled guesser who then
  gets it (`mercCelebrate('orange', 1600)`, `:217`, as Lesson 2's cold open does; playbook rule
  15), with no sparkles: the page mounts the pair with `{ sparkles: 'none' }` (`MercDuoOptions`,
  `:120-126`). The page asks for no other state; the Merc who is not singing idles.
- In the steps and in Sing it Merc and Tavi appear as stills: the guide shows the still of the Merc
  singing (Toys 6).
- Under reduced motion or Pause animations each Merc holds a still frame, skips the reactions and
  does not hop.

## Practice links: what exists and what needs engineering

- **Today, Drum Night's First Pocket.** `mercurypitch.com/drum-night?drawer=learn` opens Drum
  Night, its own document with no intro (FACTS 47), on its Learn panel, "Build the first pocket",
  at every width (FACTS 49): the plain address does not, and on a phone the rail that holds Learn
  is hidden, so the card prints and links the `drawer` address. "Play First Pocket at 84 BPM" plays
  a two-bar backbeat, the snare on 2 and 4, after a four-beat count-in, with the take armed (FACTS
  48), answered on the pads or the number keys, 2 the snare (FACTS 50). Its phrase coach reports
  how early or late the hits landed: beside the kit on a wide screen, and at 1,040 px and narrower
  behind the bar at the foot of the room, "Tap to open the phrase coach and take history" (FACTS
  51). So the card names the phrase coach. On the public host the link is
  `/drum-night?drawer=learn&lesson=08`; Drum Night reads `drawer` and ignores the marker, which only
  the main app reads (FACTS 57). The room shows no grade: "timing evidence rather than a grade"
  (FACTS 47).
- **Today, Ear Lab's Subdivide.** `mercurypitch.com/ear-lab`, then tap Subdivide (FACTS 52, 53): two
  bars on its drum kit, the kick on beat 1, and four pads naming the metre, the answer among three
  others drawn from its five. On the public host `/ear-lab?lesson=08`, the marker before the hash
  the entry document adds (`src/seo/entry-pages.ts:454-458`). The main app reads the marker before
  it renders and steps First Light aside for good (FACTS 57), so the card, the rest card and the
  footer carry no line about closing the intro (FACTS 54). Subdivide needs no voice, so it stays on
  the rest card.
- **Needed, proposed: `/exercises/count-the-bar`** (CURRICULUM § 4 item 5, the planned `ear-drill`
  launch kind, which the CURRICULUM's Lesson 8 card names: "a run of only its 3/4 and 4/4 bars needs
  the `ear-drill` launch kind"; FACTS 55, 56): Subdivide with its 3/4 and 4/4 patterns only
  (`metre:3-4:a`, `metre:3-4:b`, `metre:4-4:a`, `metre:4-4:b`), registered in `EXERCISE_SLUGS`
  (`src/features/exercises/slug-map.ts:54-86`) with a line in `src/tests/slug-map.test.ts`. As
  Lesson 2 decided for its two-answer Leap run, it rates on a track of its own (`RunTrack`), never
  the shared Subdivide rating; its guess floor matches the two pads it shows, a half
  (`src/lib/ear/drills.ts:58-60`, `:233-237`); and it passes `updateItem: false`. Subdivide has no
  2/4 pattern (`src/lib/ear/metre.ts:41-47`); a 2/4 pair is the App track's to add, also proposed.
  When it ships, LESSON.md's editorial note gives the copy, and the card, the rest card and the
  footer switch to the slug, which carries `?lesson=08` too.
- **Proposed, App content.** Drum Night's phone bar (`DrumNightApp.tsx:4974-5028`) offers no Learn
  button, so on a phone its Learn panel opens from an address that names it, as this page's does; a
  Learn button there is the App content track's to weigh. And `/drum-night`'s entry document should
  link back to Lesson 8 once it is out (`docs/plans/find-your-pitch/SEARCH.md` § 8: "`/drum-night`
  | 8").
- Not linked: none of the premium exercises (`src/lib/native-build.ts:58-68`; FACTS 57).

## Explorer and season data

Lesson 8's entry (`kit/season.ts:303-324`; FACTS 58), as this page wrote it:

- `minutes: 16` and `page: '/learn/08'`, written plainly with Lesson 5's comment, "A draft until its
  sign-off (drafts.ts), as Lesson 3 is." (`season.ts:250-252`). Every build keeps a draft's page and
  reading time (`kit/season.test.ts:241-266`); where the page's state holds the lesson back, every
  list draws it with neither, as a lesson coming later (`kit/publish.ts:94-124`).

- `pr.link`: `href` `/drum-night?drawer=learn&lesson=08`, so the card's link opens First Pocket on
  a phone too (FACTS 49); `addr` `mercurypitch.com/drum-night?drawer=learn`, the address the page
  prints, so a learner who types it lands on the panel too; `label` stays "Drum Night"; and a
  learner `note`, "then press Play First Pocket", printed "Drum Night, then press Play First
  Pocket" by `practiseMarkup` (`kit/explorer.ts:177-182`). `pr.needs`, "Ear Lab Time (an ear-drill
  link)", stays as it is: it is admin only, never drawn on a lesson page (`season.ts:102-103`).
- The signature (`kit/team-notes.ts:40`) and `fig: 'metronome'` stay as they are. The card's figure caption, "A metronome, its arm on
  beats 2 and 4" (`kit/explorer-figures.ts:207`), is the kit's and stays: the card's arm swings in
  CSS at a fixed rate that names no tempo, 1.1 s a side (`lesson-sections.css:984-995`), and the
  caption describes the drawing, which claims no tempo (FACTS 58, Illustrations without claims).
- The hook stays word for word (`season.ts:312`; FACTS 1), with no alternative, and the tease stays
  as `kit/lesson-copy.ts:113` has it: "Same song, same speed. Only the claps move.", which Lesson
  7's card shows (FACTS 6a). Lesson 9's entry carries the hook this page's card shows
  (`season.ts:334`), and its copy the tease (`kit/lesson-copy.ts:114`) and, until #1186, its old
  hook as an alternative (`:106-112` at `b7093a0a4`); all are Lesson 9's, not this page's (FACTS 6).

## What the kit and the app still need

Found in the kit and the app as they stood on main at `d59c00ad6` (21 October 2026), and on #1149 at
`8a8d90335` where an item says so, beyond the parts Lessons 2 to 7 promote into the kit (Toys
table). The page's build brought every item but 17, and each item's citations are to the tree it
was built on.

1. `kit/beat-clock.ts`, new: the lookahead scheduler on the audio clock, the run's own gain node,
   the audio-to-page clock map (Audio). Generic, with unit tests on a fake clock.
2. `kit/beat-machine.ts`, new: the toy (Toys 1), generic over patterns and tempo.
3. `kit/tap-pad.ts`, new (Toys 5), and the tap's timing rule moved out of the Ear Lab's `TapPad`
   (`src/features/ear-lab/EarStage.tsx:545-622`) into `src/lib/ear/tap-rule.ts` as pure functions
   that the Ear Lab's pad and the kit's both call.
4. Drum Night's latency estimator, `estimateDrumInputLatency`, moved whole from
   `src/features/drum-night/runtime/drum-latency-calibration.ts` into `src/lib/timing/input-latency.ts`
   (`:30-71`), with Drum Night importing it from there (`runtime/useDrumNightRuntime.ts:5-6`, and
   `runtime/index.ts:5` re-exporting it) and its test moving beside it: the house rule keeps a feature out of a sibling
   feature's code (`.dependency-cruiser.cjs:101-109`, "Shared code belongs in src/lib or
   src/components").
5. `kit/sound.ts`: a bus of the caller's on the master, which is module-private (`:77`, made at
   `:109`), so drum hits play into it and obey the Sound switch, the hush and the hidden-page stop;
   `tick` with a start time (`:383-404`); a voice given a length stopped on the audio clock, where
   `voice` stops one on a timer (`:262-268`). The beat clock keeps the clock map itself. Voices and
   noise already took a start time (`:39-43`, `:406-473`). Built with the bus and the note in
   `kit/sound-ahead.ts` (`openBus`, `:18-66`; `bookNote`, `:68-100`), which only this page imports,
   so every other lesson's first paint stays without them; `kit/sound.ts` lends it the master
   (`openMaster`, `:482-490`) and closes its buses with every voice (`onStopAll`, `:492-495`).
6. `kit/explorer-figures.ts`: `metronomeSVG(id)`, a gradient id per copy (`:20-32`), with a test
   that two copies on one page have distinct ids.
7. `kit/ear-game.ts`, Lesson 2's game promoted and generalised on #1149 (Toys 4), with two more
   things this page needs. A key per answer: a `keys` option, one key for each answer in their order
   and "1" to "N" by default, so that this page's answers 2, 3 and 4 take the keys 2, 3 and 4, where
   `keyAnswer` mapped "1" to the first answer (`:98-110`), with a unit test beside the kit's. And a
   stop that clears a miss's queued replay as well as the sound, which #1149's fix pass adds.
8. `kit/merc-duo.ts`: a one-shot hop in place, `mercHop(which, atAudioTime)`, that lands at a time
   on the audio clock and plays over any state, singing included, and does nothing under reduced
   motion or Pause animations (Merc and Tavi; FACTS 30d). The renderer's `hop` state loops round
   four stops (`src/lib/merc/sim-choreo.ts:450-475`), so the cue is new; its timing is that hop's
   crouch and flight (`:127-128`). If a hop over singing cannot be had, Tavi alone hops, and
   LESSON.md's stage directions change to say so. Built as `mercHop(which)`, which lands `HOP_MS`,
   530 ms, after it is called (`kit/merc-hop.ts:15-41`, a module of its own that only this page
   imports, so no other lesson's first paint carries it): the beat clock calls it that long before
   each clap, on the page's clock as the audio clock maps to it (`early`, Audio), so the cue needs
   no audio time of its own. It moves the whole figure, live or still, so both hop while Merc sings.
9. The next card's tease and Lesson 9's hook need nothing: the curiosity plan's kit work is on main
   (`8cba5c3d9`, `e364eeaa6`). The card draws Lesson 9's tease, "One note, two ways up: step by
   step, or one leap." (`kit/lesson-copy.ts:114`), above its new hook, "How do you land a note you
   have to leap to?" (`season.ts:334`), under `.next-tease` (`kit/next-card.ts:142`;
   `lesson-sections.css:296-302`), and the old hook was the admin console's alternative in
   `kit/lesson-copy.ts:106-112` at `b7093a0a4` until #1186 dropped it. This page adds only its
   tease figure to the slot (Toys 9).
10. `kit/quiz.ts`: `recallStepHref` promoted beside `lessonPageHref` (`:141-143`, `:137-139`),
    since this page is its fourth user after Lessons 3, 4 and 5, whose own copies became
    re-exports of the kit's (`lesson-03/quiz-questions.ts:23-24`, `lesson-04/quiz-questions.ts:31-32`,
    used at `lesson-04/main.ts:43` and `:64`, and `lesson-05/quiz-questions.ts:19-20`). #1149's
    `recallHref` (`lesson-06/quiz-questions.ts:30-32` at `b7093a0a4`) opened a page, never a step;
    #1186 deleted it. The quiz needs nothing else: its prefix, slot and away links are on main
    (`kit/quiz.ts:80-104`, `:186-216`).
11. `kit/comfort.ts`, built by #1192: `restAfterEffort`, which this page's flow passes
    (`lesson-08/sing-flow.ts:121`) to pick the rest card after "Effortful", as Lesson 6's does; both
    picked it by hand before. The kit's default stays the coach's (`kit/comfort.ts:69-78`).
12. `src/features/lessons/kit/drafts.ts:30-40`: Lesson 8's line, "the vocal coach's sign-off
    (MASTER-PLAN § 12 item 8)", in the form of Lessons 3 and 5's, and the season entry above. The
    console puts the page live on mercurypitch.com by publishing it, with no release
    (`kit/drafts.ts:13`); releasing it in code means deleting that line (`drafts.ts:18-24`).
13. The service worker: `/learn/08` and `/learn/08.html` in `STANDALONE_DOCUMENT_PATHS`
    (`src/lib/sw-runtime.ts:93`), beside the drafts' entries and their comment (`:138-157`), so
    that where it is held back its address reaches the site worker's 404 page, never the app
    shell; the build takes `learn/08.html` by itself, in every mode (`tools/draft-lessons.ts:16-18`;
    `vite.config.ts:319`, `:493`).
14. The head, from `docs/plans/find-your-pitch/SEARCH.md` § 3 and Lesson 2's document
    (`learn/02.html:3-145`), whole in the page's first commit. Two tests hold it: the kit's
    `src/features/lessons/kit/lesson-copy.test.ts:323-358` reads every `learn/NN.html`, drafts
    included, from its first commit, and `src/tests/lesson-pages.test.ts:139-275` holds every lesson
    document's head too. The copies of the hook that the first test reads are the ones the site
    worker rewrites when the console picks another hook (`src/lesson-gate.ts:17-19`).
    - The title, `h1.hook#hook`, the hook word for word (`lesson-copy.test.ts:323-332`).
    - The document title, at most 60 characters, ending in " | MercuryPitch"
      (`lesson-pages.test.ts:154-155`): SEARCH.md § 4's draft, "Beat, tempo and the backbeat,
      explained | MercuryPitch" (54 characters), which the owner chose on 22 October 2026 with the
      other query-led titles. Until #1187 the test wanted the headline in the title too; it now
      wants it in `og:title` (`:184`).
    - The description, 80 to 160 characters (`:139-142`): "Why does the same song feel different
      when you clap on 2 and 4? A sixteen-minute lesson on the beat, tempo, bars of 2, 3 and 4, and
      the backbeat." (145 characters). It shortens the hook, so it serves as `description` and as
      the Article's description (`:165`) only, never as a copy of the hook.
    - Canonical and `og:url` `https://mercurypitch.com/learn/08`; robots
      `index, follow, max-image-preview:large`; `twitter:card` `summary_large_image` (`:126-144`);
      `og:type` `article` and `og:site_name` "MercuryPitch" (`learn/02.html:23-24`).
    - `og:title` and `twitter:title`, "Beat, tempo and the backbeat: Find Your Pitch, Lesson 8", in
      the form of Lesson 2's (`learn/02.html:26-29`, `:45-48`).
    - `og:description`, the full hook and then one line, as Lesson 2's (`learn/02.html:30-33`),
      since the kit's test wants it to start with the hook (`lesson-copy.test.ts:349-352`): "Why
      does the same song feel different when you clap on 2 and 4 instead of 1 and 3? Hear the claps
      move, then tap the backbeat."
    - `twitter:description`, the hook exactly (`learn/02.html:49-52`;
      `lesson-copy.test.ts:353-355`).
    - `og:image` and `twitter:image`, `https://mercurypitch.com/learn/lesson-08-og.jpg`, with
      `og:image:width` 1200 and `og:image:height` 630, and `og:image:alt` and `twitter:image:alt`
      naming the card (item 15; `learn/02.html:34-43`, `:53-60`).
    - The Article block: `@id` `https://mercurypitch.com/learn/08#lesson`, headline "Beat, tempo and
      the backbeat", `alternativeHeadline` the hook exactly (`lesson-copy.test.ts:356`), the same
      description as the meta, `url` and `mainEntityOfPage` the canonical address, `image` the
      og:image (`lesson-pages.test.ts:173-174`, `:182-183`), `inLanguage` `en-GB`,
      `learningResourceType` "Lesson", `educationalLevel` "Beginner", `timeRequired` `PT16M`,
      `teaches` ["The beat and the pulse", "Tempo in beats per minute", "Bars of 2, 3 and 4", "The
      backbeat"], `isAccessibleForFree`, `position` 8, `isPartOf` the series, and author and
      publisher the organization (`:163-189`); and the BreadcrumbList ending on the headline
      (`:212-225`).
    - No `datePublished` at first. The console publishes at run time and nothing writes the field
      then: the worker's rewrite puts the lesson state into the head and changes the hook's copies,
      the links and the `data-if-live` readings, and writes no date (`src/lesson-gate.ts:13-21`), so
      a published draft is served without one. The owner sets it in one of two commits and picks
      which: the one that deletes the page's `drafts.ts` line, or one straight after the console
      publishes the page.
15. `public/learn/lesson-08-og.jpg`: the share card, 1200 x 630, a still of the hero before its
    reveal: the title over the metronome and the compact grid, between Merc and Tavi as the hero
    and Lessons 6 and 7's cards stand them, the claps on 1 and 3 as plain dots and every beat number
    one size, so the card, which people see before the page, answers nothing the cold open asks
    (Look). Its alt text, in the form of Lesson 2's (`learn/02.html:40-43`) and naming Merc and Tavi
    as Lesson 6's does (`learn/06.html:40-43`): "The title card: Find Your Pitch, Lesson 08, Beat,
    tempo and the backbeat, above a metronome and a grid of four bars of four beats, with claps as
    dots under beats 1 and 3, between Merc and Tavi."
16. Indexing, requested when the console publishes the page: from then on the site worker lists it
    in `sitemap.xml` and `llms.txt` as it serves them (`src/lesson-gate.ts:22-24`). While it is a
    draft, the static files keep it out: in neither `public/sitemap.xml` nor `public/llms.txt`,
    linked from no entry document, with its service-worker rule kept
    (`src/tests/lesson-pages.test.ts:307-344`). When its line leaves `drafts.ts`, the release adds a
    line to each static file (`public/llms.txt`'s Lessons list, `:66-80`), as `kit/drafts.ts:18-21`
    asks and `lesson-pages.test.ts:282-290` checks. The first-paint budget comes with the page,
    beside the other drafts' (`scripts/assert-first-paint-budgets.mjs:103-159`, Lessons 3 and 5),
    at `:205-211`, and its CSS ceiling at `:338-341`, since every build carries every lesson page.
17. The App content items under Practice links: the App and App content tracks' to weigh, and not
    built with the page.
18. From #1149's fix pass, both needed before this page's predicts and plays are built:
    `kit/predict.ts`'s `play` may resolve `false` for a play cut short, which then never counts as
    heard (Toys 2); and a page-wide "now playing" owner, in the kit (promoted there if #1149 keeps
    it in `lesson-06/`), through which every source starts its sound, stopping the one already
    sounding (Audio).

## Edge cases

- **Sound off, unset or missing.** Every play obeys the kit's `canPlay` (`kit/sound.ts:510-522`):
  the first tap turns sound on, sound off plays the visuals silently with the kit's toast, and no
  Web Audio leaves the page readable with every play `aria-disabled` and its line saying why. The
  predicts' reveals and Start the guide wait for heard sound (Toys 2, 6); the take and the groove,
  which need sound, do not run, and say so (Toys 6; till #1192 the groove ran silently).
- **A hidden page or a card off screen** stops what is playing (Audio; Toys 6), and a take that
  was running ends with no line.
- **Leaving a step**, by any route, stops the stage's sound, Count the bar's queued replay and Step
  5's predict plays, and a play so stopped is not heard (Toys 1, States; Toys 2); starting any play
  stops every other (Audio).
- **A device that delays its sound a lot** (a wireless headset, say). Up to 250 ms the lining-up
  absorbs it; from 250 ms up to half a beat, about 333 ms, the cap leaves at most 83 ms over, plus
  the taps' own spread, so taps within about 37 ms of their mean still fall inside the 120 ms window
  and the take reads right; past half a beat each pulse tap lies nearer the next beat than its own,
  so the lining-up cannot see the delay and the line reads taps that "matched no beat" (FACTS 42).
  The page cannot tell this from mistimed taps and says nothing about the device; it gives no figure
  for any (FACTS 39).
- **No usable output timestamp**: the clock pairing fallback (Audio), and the lining-up absorbs
  the output delay with the rest.
- **Coarse event times.** A browser may reduce a timestamp's precision (FACTS 37). How far is not
  read; the window is 120 ms and the lines claim nothing finer.
- **Taps before Start, or after the take**, are ignored: the take's matching takes taps only from
  120 ms before beat 12 to half a beat after beat 27; the pulse bars' taps only line up.
- **Keyboard**: a held key's repeats are ignored; Space on the focused pad taps and does not press
  any other button; a second finger on a touch screen is a second tap, as it is a second strike.
- **Storage blocked** (`kit/dom.ts:68-88` never throws): the quizzes run without their seed and
  record, the voice choice is asked each time, the done list is empty; nothing breaks.
- **A stored voice** is used at once; changing it takes effect at the next play.
- **Tempo at its ends**: 60 and 140 BPM, the arm's swing 1.0 s and 0.43 s a beat; the take and the
  sung line always run at 90.
- **Held back** (mercurypitch.com while the console has not published the draft): `/learn/08`
  answers the 404 page, with noindex (`src/lesson-gate.ts:10-12`), and every page's season draws
  Lesson 8 with no page, so none links it and Lesson 7's next-lesson card reads "Coming later"
  (FACTS 7). A page no worker served, such as the e2e bundle's, takes its build's default
  (`kit/page-state.ts:5-10`).
- **A hook or tease switched in the admin console.** An override names a wording the lesson's code
  already holds, by its variant id, and a reader that meets an id its code lacks keeps the default
  (`src/lib/lesson-state.ts:13-16`, `:45-53`). The site worker writes the picked hook into a page's
  `h1` and the head's copies of it (`src/lesson-gate.ts:13-21`). Lesson 8 holds no other hook, so
  its title stays as written; if the console picks a hook for Lesson 9, the card shows it, since the
  card takes the season as the page's state shows it (`kit/next-card.ts:185`), and nothing in this
  page's markup changes.

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-08/` and the new kit
parts:

1. The tune equals the published score: the fourteen notes and lengths of FACTS 31, imported from
   Lesson 6's data where its page has landed, never copied; the first line's syllables start on
   beats 1, 2, 3, 4, 1, 2, 3 and "star" holds two; on 2 and 4 fall "kle", "kle", "tle" and the
   second beat of "star" (FACTS 32).
2. The patterns: Rock is Ableton's basic rock beat with a clap for the snare (on the 0-based beats,
   kick 0 and 2, clap 1 and 3, hi-hat on every eighth; FACTS 24); March is a kick on 1, accented,
   and claps on 2, 3 and 4; the cold open's two versions differ only in their clap beats, every
   note, length, level and the tempo the same (FACTS 30); Merc's levels in the cold open are 0.2 on
   beat 1, 0.17 on beat 3 and 0.14 on 2 and 4 (FACTS 30c).
3. The beat clock on a fake audio clock: every event starts at exactly its time whatever the frame
   times; an event whose time has passed is skipped; a tempo change applies from the next beat;
   Stop fades the run's node over 30 ms; no sound is started or stopped by `setTimeout` (a spy);
   the clock map uses the output timestamp when it is above 0, and the pairing otherwise; a hop
   cue starts 0.53 s before its clap.
4. The arm: −24° at each beat on one side and +24° on the other, 0° between, at every tempo from 60
   to 140 (`metronomeAngle`).
5. The take judge: the cases of `verify08.py` § 7 from fixed seeds, every template in Toys 6 and
   the rule that picks it; 120 ms either side counts and 121 ms does not; the 250 ms cap; fewer than
   five pulse samples; a second tap on one beat matches no beat; counts in words from "One" to
   "Nine"; the estimator and `judgeTake` imported from `src/lib`, never copied. `verify08.py` is not
   in the repository, so the tests draw their own seeded takes (`lesson-08/take-judge.test.ts`): on
   them a 20 ms spread reads "All 8 landed on 2 and 4: a backbeat." every time, and a 40 ms spread
   at least 7 of 8, since a spread that wide puts a tap past the 120 ms window now and then (FACTS
   42 reports every take reading all 8 on that script's seeds).
6. The tap readout: the median of the last eight gaps; shown from the fourth tap; a 2 s gap starts
   a new run; a gap under 0.15 s is ignored.
7. Count the bar from a fixed seed: six rounds, each size twice, never the same twice running; the
   feedback templates; the count counts first-time answers only.
8. The Sing it flow (`lesson-08/sing-flow.ts`, Toys 6): with no stored voice the voice choice comes
   before either path, under its first line, and a stored voice starts pressed, under its second
   line, and can be changed; "Just listen today" hides Start the guide and Move do and picks the
   rest card; Start the guide waits for Merc's line heard with sound on; the feeling question
   follows every guide, asked afresh, and hides while one runs; a guide cut short asks nothing and
   leaves the card as it was, Again included; "Easy" and "Workable" give "That's it: one line over
   the backbeat, done." and Again once a visit; "Effortful" and "Uncomfortable" put the guide, Again
   and Move do away for the visit and pick the rest card, and no later answer brings them back;
   nothing is written to storage but `fyp-voice`.
9. Move do: clamps at four semitones either way; at 0 the line lies inside every preset of the
   chosen voice, checked against `VOCAL_RANGES` imported from `src/stores/settings-store.ts`
   (FACTS 67); the readouts.
10. Copy: every line of LESSON.md's page copy and every template in Toys 2, 4 and 6 passes
    `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts`, surface `finding`); no quiz
    feedback line starts with "Right", "Yes" or "Correct"; no accessible name or live text holds a
    ♯ or ♭ sign.
11. Every fixed sound's frequency equals `hz(m)` for the notes of FACTS 71.
12. Layout, the pure helper behind Toys 1's targets: at every width from 344 to 1440 px every cell
    and every control is at least 44 px each way and none overlaps another; under a 182 px figure
    the grid takes its compact layout, which fits 140 px (FACTS 80).
13. `metronomeSVG(id)`: two copies have distinct gradient ids.
14. The season entry: Lesson 8 keeps `page` and `minutes` in every build, as Lessons 3 and 5 do
    (`kit/season.test.ts:241-266`), and the season gives the page its entry, as it must every lesson
    document in `learn/` (`kit/season.test.ts:322-339`); a state that holds it back draws it with
    neither (`kit/publish.test.ts:59-74`); its link's `note` matches none of the backlog words
    (`kit/season.test.ts:177-190`).
15. Step 5's lock: before the predict's choice, Play, March, Rock and Tempo are `disabled` and none
    carries `aria-disabled`; the choice enables the three buttons through `unlocks` and Tempo
    through `onChoice`. No test covered `unlocks` (`kit/predict.test.ts:54` covers the choice's own
    plays), so the kit gained one beside it (`:75`).
16. Count the bar's keys: with the answers 2, 3 and 4, the keys 2, 3 and 4 answer "2", "3" and "4",
    and 1 answers nothing; with no `keys` option the kit's game keeps "1" to "N" (in the kit's own
    tests).
17. Leaving a step, on a fake clock: a step change by every route the deck has (Next and Previous, a
    swipe, a scroll on the wide page, `jump` as the lesson menu calls it, a `#step-N` address, and
    `show` as a quiz's step link calls it) stops the stage's sound, Count the bar's round and Step
    5's predict plays; a miss in Count the bar and then a step change within its 700 ms start
    nothing once the clock passes 700 ms; a re-show of the same step, as a layout change makes
    (`kit/step-deck.ts:188-191`), stops nothing.
18. Heard means finished: for the cold open's predict and Step 5's, a play cut short, by its stop,
    by another play or, in Step 5, by leaving the step, resolves `false` and leaves the reveal
    hidden, and a play that runs to its end reveals; starting any sound on the page stops the one
    already sounding (the page-wide owner).

End to end (Playwright, `src/e2e/learn-lesson-08.spec.ts`, at 390 x 844 and 1440 x 900, with the
draft shown as `build:e2e` shows it):

1. A hard load of `/learn/08` answers 200 with the lesson; no AudioContext before the first tap;
   nothing plays before a play button.
2. The cold open: "Play with claps on 1 and 3" plays before any choice and reveals nothing; "Play
   with claps on 2 and 4" is disabled until a choice and enabled after; the reveal stays hidden
   while it plays and after a play cut short by another play, and shows once a play has run to its
   end, reading "You said: weak beats" or "You said: strong beats"; until the reveal the four beat
   numbers are one size and no clap mark is gold; with sound off the hint shows and the reveal
   waits.
3. Step 5: the stage's Play, March, Rock and Tempo are `disabled` until the choice and enabled after
   it, with no `aria-disabled` on any; Step 2's Tempo works throughout; the reveal waits until both
   plays have run to their ends.
4. The beat machine by keyboard alone: Tab reaches every control and cell; a cell toggles
   `aria-pressed`; Tempo moves by arrows and jumps by Home and End; Bars and the pattern switch
   toggle `aria-pressed`; each announcement reaches the live region; at 390 x 844 every cell
   measures at least 44 x 44 px with none overlapping.
5. The stage fits: the kit's `src/e2e/learn-stage-fit.spec.ts` takes every lesson the e2e bundle
   builds (`:27-32`), so Lesson 8 joins it on its first build: every control of every step in reach
   at the four short sizes with at most 60 px of the stage's own scroll (`:34-58`), and on a phone
   held sideways each step's figure and first control on screen together (`:259-288`). By FACTS
   80's model it needs none of that scroll.
6. The tap take's flow: Start runs the count-in and the two parts' status lines; with no taps the
   line reads "We couldn't line your taps up with the beat that time. Tap every beat for the first
   two bars, then 2 and 4."; Stop ends it with "Stopped. Press Start to tap again."; with sound off
   neither Start nor Play the groove runs, and each says so. The judge's lines themselves are
   unit-tested (unit 5), since a browser's timing on a test machine is not a device's.
7. Sing it: the comfort check shows first in its part, every visit; with no stored voice the voice
   choice follows either answer, under "Choose a voice to sing with. If you chose one in an earlier
   lesson, pick it again:", and nothing plays until a voice is chosen; a stored `fyp-voice` shows
   pressed under "Keep the voice you chose before, or change it:", and a tap on the other voice
   changes it; "Just listen today" shows no guide and no Move do, shows the doctor lines and leaves
   the rest card in the Wrap; Start the guide stays `aria-disabled` until Merc's line has played;
   the feeling question appears when each guide ends; "Easy" shows "That's it: one line over the
   backbeat, done." and Again, and Again is gone after its one use; "Effortful" hides the guide,
   Again and Move do and shows the gentle line; "Uncomfortable" does the same with the doctor
   lines; after either, the Wrap shows the rest card with both drills, and answering "Easy" later
   does not bring the practice card back on this visit.
8. No call to `navigator.mediaDevices.getUserMedia` at any point (a spy, as
   `src/e2e/learn-lesson-03.spec.ts:323-332` sets one).
9. The recall: with an empty `fyp-done` it is the closed line; with Lesson 6 done it is open; its
   answers mark nothing done; its step links are `<a href="/learn/06#step-3" target="_blank">` and
   `/learn/06#step-4`; question 1's Play plays; served with a state that holds Lesson 6 back, as
   `src/e2e/learn-publish-state.spec.ts` serves one (`:31-59`), the page has no `#recall` and no
   wrapper, and raises no error; answering all four quick-check questions marks Lesson 8 done in the
   explorer; each feedback line starts "Right." or "Not quite.".
10. Every practice link carries `?lesson=08` before any hash: `/drum-night?drawer=learn&lesson=08`
    and `/ear-lab?lesson=08`.
11. The next-lesson card: a row for `/learn/08` in `src/e2e/learn-next-card.spec.ts`'s `CARDS`
    (`:37-98`), `['/learn/08', 'Next lesson 09 · Landing a leap Coming later', '#explorer', 'See it
on the map']`, while Lesson 9 has no page; a test as the spec's Lesson 1 test is (`:117-134`):
    `.next-tease` reads `LESSON_COPY[9].tease`, and the card's words run eyebrow, `next-tease`,
    `q2`, `chip`; and its tease figure, after the words, holds no button.
12. No planning words: the kit's `src/e2e/learn-no-planning-text.spec.ts` reads every built lesson,
    this one included. Its pattern for the team's word "Signature" is case-sensitive (`:23-40`),
    so the page's "time signature" stays lower case wherever it appears, as LESSON.md writes it.
13. The first screen: the kit's `src/e2e/learn-cold-open-fold.spec.ts` loads every lesson the e2e
    bundle carries (`:32`), so this page joins it on its first build, at its seven sizes from 390 x
    844 to 1440 x 900 (`:35-58`). It holds that the title, `h1.hook#hook` (which it finds as
    `h1#hook`, `:119`), is wholly on the first screen at load (`:197-202`), and it reports where the
    opening's first control and the predict's choices sit (`:79-139`): here "Play with claps on 1
    and 3", the first Play in `main > section.hero`, and the two `#predict [data-choice]` buttons.
    The page aims for CURIOSITY-MOMENTS § 3.1's mark: at 390 x 844 the title and the first Play on
    the first screen, at 1024 x 640 the stage and the choices too. The app-check sweep screenshots
    it until the report is enforced.
14. With reduced motion emulated, the arm does not move, Merc and Tavi do not hop, the morph and the
    pattern changes land in their end states, and nothing moves on its own.
15. A visitor with the studio installed still gets the lesson, not the shell (the service worker's
    document list), as Lesson 3's spec checks.

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=08` before any hash. Then the layout, accessibility, sound,
motion and storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text
children, touch targets of at least 44 px with no two tap zones overlapping, visible focus, a
single dark theme with every colour a token and an explicit body background, sound only after a
tap, every sound timed on the audio clock, localStorage only for per-viewer conveniences inside
try/catch, and the whole page usable with no sound, no WebGL and no storage (the take and the
guide then say why they cannot run). Every ♯ and ♭ the page prints in text (the recall's "from
F♯", its answers and feedback) has a spoken name, as Lesson 2's contract sets: the sign is
`aria-hidden` and a visually hidden word follows it, so a screen reader says "F sharp"; the
figures' accessible names and every live region use words only. The page stores the quiz seeds and
records (`fyp-l08-recall-seed`, `fyp-l08-recall-v1`, `fyp-l08-seed`, `fyp-l08-quiz-v1`),
`fyp-done`, `fyp-voice`, the masthead's Pause animations choice, `fyp-motion`
(`kit/motion-switch.ts:12`), and the steps the viewer reached, the kit's `fyp-pos`
(`kit/position.ts:20`), which `initMasthead` keeps (`kit/page-chrome.ts:122-154`), and the kit's
record of the welcome tour, `fyp-tour` (`kit/tour-gate.ts:29`); nothing from the toys, the take or
Sing it but the voice.

Page QA before publishing (PRODUCTION-PIPELINE § 5) adds, for this page:

- Every control, cell and switch works by keyboard alone and announces what LESSON.md shows; the
  whole of Sing it runs by keyboard, and a screen reader hears every state.
- At 390 x 844 every grid cell is at least 44 px square and nothing scrolls sideways at 344, 360
  and 375 px; at 1024 x 640 and 1133 x 631 every step's controls are on screen with the stage
  stuck, as the kit's stage-fit test checks, against a local or dev build, never production.
- On a real phone, by ear and by eye (`docs/agent/DEVICE-DEBUGGING.md`): the arm reaches each side
  as its click sounds; Merc and Tavi land on the cold open's claps; the take with the phone's own
  speaker reads "All 8 landed on 2 and 4: a backbeat." for steady taps on 2 and 4; and the same
  with a wireless headset, noting the line it gives, for the Edge cases.
- The network panel and the browser's microphone indicator stay quiet through Sing it: no request,
  no microphone.
- The Wrap shows the rest card after "Effortful", after "Uncomfortable" and after "Just listen
  today", and the Drum Night card otherwise; every link opens in a new tab.
- The app-check sweep at phone and desktop width, with Sing it open in each state and the cold open
  before and after its reveal.
