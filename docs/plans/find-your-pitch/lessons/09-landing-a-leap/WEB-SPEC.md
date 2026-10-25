# Lesson 9 web page: spec

The Lesson 9 page is the web lesson for "Landing a leap": written steps, one main toy in seven
states, one predict, a sung checkpoint of one slow ladder that measures each note against Merc's
band and records nothing, two quizzes (the recall and the quick check) and the lesson explorer. Copy
is in [LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a text-only package: no
film exists for Lesson 9, so the page has no Watch section and the masthead's anchors are Lesson,
Sing and Explorer. It is built on the kit (`src/features/lessons/kit/`) and, like Lessons 2 to 7, it
reuses and never copies: a part that still lives in an earlier lesson's module moves into the kit
first. Where this page shares a behaviour with Lesson 3's checkpoint (the comfort check, the
warm-up, the voice choice, "How did that feel?" and the rest card), it is Lesson 3's, unchanged
unless this spec says otherwise, and after "Effortful" it follows Lessons 6 and 7: no further try,
and the rest card in the Wrap.

One object carries the lesson across its steps: the ladder chart (Toys 1), the kit's band chart with
rungs. Merc's leap arcs across it in the cold open; the step and the leap, Hear it first, the climb,
the five leaps in order and the landing are each a state of it; at the checkpoint the viewer's own
ladder is drawn on it; and in the Wrap its rungs are free play. Motion principle 2, "One object
carries the story across shots and keeps its identity" (`research/brand-motion.md:667`), and
playbook rule 6 ask for it, and the CURRICULUM's signature is its moment: "the leap drawn as an arc
whose landing zone is the target band (amber, the app's pitch-canvas colour); slow leaps first"
(FACTS 6).

Its public home is `mercurypitch.com/learn/09` (MASTER-PLAN § 12 item 9): a hand-written document,
`learn/09.html`, with its module in `src/features/lessons/lesson-09/`, wired as Lesson 3's page is.
Every build carries it, as every build carries every lesson page, and it is a draft, with a line in
`kit/drafts.ts`: the dev site and every PR preview serve it, and on mercurypitch.com the site worker
answers its address with the 404 page until the admin console publishes it, at run time and with no
release (FACTS 63). Whoever publishes it waits for three things: the vocal coach's sign-off, the
hard gate, because it is a voice lesson (MASTER-PLAN § 7, days 1 and 6; § 12 item 8); Lesson 3's
page live at `/learn/03`; and Lesson 6's live at `/learn/06`, because its prerequisite chips and its
recall check link there (FACTS 2, 4, 9). Those are rules for whoever uses the console, which asks
before it breaks one but never stops it: it asks before it publishes a draft that waits on a
sign-off, and before it publishes a lesson while one it builds on is not published, then publishes
it if told to. A page published early still works, with plain chips and unlinked step links where
its links to those lessons would be (Edge cases). It opens
in Lesson 2's order, the cold open straight under the title and the recall after it, as MASTER-PLAN
§ 4.2 now has every page open (§ 12 item 13; FACTS 3), and its copy follows the plain-language
review's patterns. "What the kit and the app still need", below, lists the wiring and every kit
change.

## Look

Lessons 1 to 7's look, unchanged: the dark listening room, the series colour code, Lesson 1's type
and wordmark, and the motion rules. On this page:

- The ladder chart is a pitch canvas, so it takes the app's canvas set (FACTS 100; MASTER-PLAN § 5):
  Merc's notes are amber bands `#f59e0b`, each with Merc's steady line at its centre, and Merc's
  leaps are amber arcs between them; the viewer's line, and the illustrated singer's in Steps 2 and
  5, are singer violet `#a78bfa`. Violet means a singer only. A band's edge lights mint `#80ffca`
  with the words "IN THE BAND" while a line sits inside it (`drawLitEdge`,
  `kit/band-chart-draw.ts:193-212`), so the word, not the colour, carries it.
- Each rung is named in words beside its band, its syllable and its spelled note ("so · A3"), and no
  other row of the chart is named (Toys 1, Drawing). Gold `#ffd84d`, which means "the fit", is not
  used: the band itself is the landing zone.
- The slowed folds in Step 1 are Lesson 3's schematic, now the kit's (`kit/folds.ts`; FACTS 100), in
  chrome on the dark room with ink labels.

Two things move on their own: the Merc idle loops. Under `prefers-reduced-motion` they stop, and
every transition this page adds lands in its end state with no travel: an arc draws whole, a line
draws whole at once, a band lights without a pulse, and the folds become Lesson 3's two stills, open
and closed, with the ratio in words. What the viewer starts still sounds. For everyone else the
masthead's Pause animations toggle stops the same two (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) in Lesson 2's order, with Lessons 2 to 7's departures kept: the
step toys double as the Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy
refutes it; the practice card sits in the Wrap. No Watch section (§ 4.2 item 10). Each section's
heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 1's (wordmark, "Season 1 · Lesson 09", anchors Lesson, Sing and Explorer,
   the Sound toggle off by default, Pause animations with its reduced-motion lock), through
   `initMasthead(sections, { lesson: 9, deck })` (`kit/page-chrome.ts:110-126`): before anything else
   the page's links to other lessons follow the state it was served with (`followPageState`,
   `kit/page-state.ts:84-108`; Edge cases), then "Season 1 · Lesson 09" opens the lesson menu
   (`kit/lesson-menu.ts`), and the page's steps are remembered as the viewer moves through them
   (`kit/position.ts`).
2. **Hero**, laid out as Lesson 2's is (`learn/02.html:333-506`). The hero copy holds the kicker;
   the hook question as the title, `<h1 class="hook" id="hook">` in its default wording, the
   season's, which `src/features/lessons/kit/lesson-copy.test.ts` holds every page's title to
   (`:323-332`), with no variant's team note anywhere in the markup (`src/features/lessons/kit/team-notes.test.ts:85-101`; FACTS 1), and the
   element the site worker writes a picked hook into (`src/lesson-gate.ts:590-591`); the meta as
   five chips ("16 minutes", FACTS 5; "After Lesson 3: Match a note", a link to `/learn/03`; "After
   Lesson 6: Intervals: the distance between notes", a link to `/learn/06`, each chip wholly the
   link, as Lesson 2's `a.chip.chip-link` is, `learn/02.html:351-356`, so that it stays as a plain
   chip where its lesson is not live; Sound on; Microphone optional); the promise; and the sound
   gate from LESSON.md. Beside it, the stage: the bubbles, and Merc and Tavi on the floor line
   either side of the ladder chart in its compact state, whose still before any play is do's and
   so's bands with Merc's amber arc between them, the signature. Under the stage, the cold open's
   predict card (Toys 2). On a phone (390 x 844) the title and the opening's first control, Play
   Merc's leap, and the three choices belong on the first screen, and on a tablet in landscape
   (1024 x 640) the stage and the choices too (CURIOSITY-MOMENTS § 3.1, "Above the fold",
   `docs/plans/find-your-pitch/CURIOSITY-MOMENTS.md:280-282`). Of the plan's levers, the recall's
   place is already used, since it follows the predict; the others are Merc and Tavi's size
   (`--merc`, `kit/lesson-stage.css:204`) and the hook's length, and this hook is a short one.
   `src/e2e/learn-cold-open-fold.spec.ts` holds the title on the first screen at its seven sizes and
   reports where the first control and the choices sit (End to end 5).
3. **Recall from Lesson 6**: Lesson 6's questions 2 and 3, for everyone (Toys 5).
4. **Four words you'll meet**: leap, third, arpeggio and landing zone, each with its definition, a
   small figure and a play or show button (Toys 3).
5. **The steps**: Lesson 1's sticky stage and step deck ("N of 5", Previous and Next), every step on
   the one ladder chart (`toyFor: () => 1`, `kit/step-deck.ts:49-54`), in five states (Toys 1):
   1. Why is a leap harder than a step? Step and Leap, with the slowed folds.
   2. Can I aim a leap, then? The illustrated copy, Hear it first and Leap; the mix-up card.
   3. What's the ladder for? Climb, and two leaps over the climb.
   4. Which leap first? The five leaps in the syllabus's order, with Slow.
   5. How do I know I landed? An illustrated landing and its adjustment, with Play, Slow and scrub.
6. **Sing it**: the comfort check, the voice choice, the warm-up, the ladder choice and Move do,
   Merc's ladder, the briefing, the take, the readings and the feeling question (Toys 4). It is
   MASTER-PLAN § 4.2 item 7's checkpoint: the learner's line against Merc's target bands,
   octave-tolerant, with Voice Mirror's 35-cent band, and language about the sound.
7. **Quick check**: LESSON.md's four questions (Toys 5).
8. **Wrap**: the three recap lines, the challenge, the practice card in the version Sing it's ending
   picks, free play, and the kit's next-lesson card (`createNextCard(9)`,
   `kit/next-card.ts:181-210`, drawn before `createExplorer`, `:27-30`). The card is Lesson 10's,
   its words the kit's: the eyebrow with the number, the title and the state, then the tease, "Three
   notes, one chord. Move one by a semitone.", one line above the hook as `.next-tease`, the hook as
   `.q2` and the way on (`:130-146`; FACTS 7), "Coming later" and "See it on the map" until Lesson
   10's page is live. Its hook and tease are the ones the admin console picked, the defaults until
   it picks (`:14-20`), since the card reads the season as the page's state shows it (`:185`). The
   tease's figure, a still of the pitch spiral with do, mi and so lit and one "?" over all three,
   not over mi, sits in the page's `[data-next-card]` mark, whose children the kit keeps in the card
   after its words (`:27-29`, `:184`, `:205`), as Lesson 2's figures are (`learn/02.html:1823`). The
   card is a link, so the figure holds no button. The practice card is the Arpeggio Jumper and
   Interval Trainer card, with "Ten minutes, gently, most days" under it; after "Effortful",
   "Uncomfortable" or "Just listen today" it is the rest card instead, without that line or a link
   (Toys 4). Its address links `/pitch-training?lesson=09` in a new tab. Free play unlocks here: the
   chart's rungs on one stage (playbook rule 17).
9. **Lesson explorer**: the kit's, with Lesson 9 as the current node and the line under its heading
   from LESSON.md; its card shows what `kit/lesson-state.ts` says of a live lesson, and no Watch
   button, since Lesson 9 has no published film (`kit/season.ts:23-25`).
10. **Footer**: Lesson 1's, with "Season 1 · Lesson 09 · Landing a leap"; the practice link, printed
    `mercurypitch.com/pitch-training` and linking `/pitch-training?lesson=09`, with "Arpeggio Jumper
    and Interval Trainer are free." (FACTS 54); Lesson 1's fonts line and "Every sound on this page
    is synthesised in your browser" (FACTS 101); no first-visit line, because the link carries the
    marker (FACTS 56).

## Length

The learner copy is 2,379 words on `pnpm lesson:words` (FACTS 5; the review's 2,350, before the
listen path's voice line), level with the series' cap of 2,379: Lesson 3's page on the same count at
`a3d8048e1` is 2,454 words, 75 of them the note under its new title, which is not in editorial form,
so the counter reads it. The page runs about 16 minutes: 10.00 of reading and about 6.4 of sound,
toys and tasks, 16.4 in all. That is past MASTER-PLAN § 4.2's 8 to 12 minutes of active time, as
Lessons 3, 5, 6 and 7 are (16, 18, 17 and 16 minutes), and acceptable by their precedent. Each
step's text, with its Try and its Notice, runs 106 to 120 words (Steps 1 to 5: 118, 119, 120, 119
and 106), inside § 4.2's 50 to 120 a step. One step carries more beside it: Step 2, about 200 words
with its mix-up card (about 80 words), which sits in the step whose toy refutes it, as in Lessons 2
to 7. The page has no Go deeper drawer.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                                                                                                                    | New in Lesson 9                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1. The ladder chart       | The kit's band chart (`kit/band-chart.ts`, `kit/band-chart-draw.ts`: the notes axis, Merc's band and steady line, the lit edge, the violet trace, its head, the playhead and edge pins); the kit's folds and slow clock (`kit/folds.ts`, `kit/slow-motion.ts`); the kit's spelling (`kit/major-scale.ts`, `kit/notes.ts`); `kit/sound.ts` | Rungs over slots or across the plot; Merc's arcs; rung names; seven states; the folds strip; the ratio readout |
| 2. Predict widget         | The kit's predict as it is (`kit/predict.ts`), with three choices and a reveal that waits for every play                                                                                                                                                                                                                                  | Three paths, each drawn as it sounds                                                                           |
| 3. Four words             | Lesson 1's strip of figure, word, definition and button (`lesson-01/words.ts`), promoted into the kit if no earlier page has                                                                                                                                                                                                              | Four new figures                                                                                               |
| 4. Sing it                | Lesson 3's checkpoint (`kit/comfort.ts`, `kit/listen.ts`, `kit/take.ts`, `kit/voice-choice.ts` on `fyp-voice`, `kit/warm-up.ts`, the feeling question, the rest card); Lesson 4's Move do; Lessons 6 and 7's rest card after "Effortful"; Voice Mirror's bands (`src/lib/mirror/match-bands.ts`)                                          | One ladder take read note by note (`readLadder`); rung lines; the ladder choice; a flow rule                   |
| 5. Recall and quick check | The kit's quiz as it stands (`kit/quiz.ts`: an id `prefix`, question ids, an optional `lesson`, a `slot` and links away)                                                                                                                                                                                                                  | Ids and keys                                                                                                   |

### 1. The ladder chart

One component, the kit's band chart (`kit/band-chart.ts`) on a notes axis, in seven states: compact,
step, hear, ladder, order, landing and free play, plus live mode at the checkpoint (Toys 4).

- **Drawing.** Pitch is height (playbook rule 20): one faint row per semitone, bottom to top,
  through the kit's notes axis (`axis: { notes: [lo, hi] }`, `kit/band-chart.ts:54-68`), with its 40
  px gutter on the left (`:202`). Only the rungs' rows are named, each by its syllable and its
  spelled note in Lesson 4's spelling ("so · A3"), through a new rung-names option beside `named`,
  since the kit's grid letters every natural row and names its `named` notes in full
  (`drawNotesGrid`, `kit/band-chart-draw.ts:113-141`; FACTS 22). Time runs left to right. Each of
  Merc's notes is a rung: a band 35 cents either side, Voice Mirror's own (`HIT_TOLERANCE_CENTS`,
  FACTS 43), with Merc's steady line at its centre; the vibrato of his "ooh" is never drawn, as the
  kit's band rule says (`band-chart.ts:5-12`). A rung is drawn either over its own time slot, so a
  phrase reads as a staircase of bands (sequence mode), or across the whole plot, so the ladder
  reads as four rows (rung mode). Merc's leap is an amber arc from the end of one band to the start
  of the next, rising above the straight line between them; a sung line is the violet trace, which
  needs no arc. The chart's spoken summary (`describe`) names what it shows in words, never the
  sign: "Do, D3, and so, A3, with Merc's leap between them".
- **Windows.** Steps 1, 2 and 5, and the compact chart: do − 2 to so + 2, 11 semitones; Steps 3 and
  4 and free play: do − 1 to the top do + 1, 14 semitones; the live chart, do − 1 to the chosen
  ladder's top + 1: 14 semitones for the full ladder, 9 for the smaller (Toys 4). Every window holds
  every note its state plays (FACTS 90 to 95).
- **The voice.** `fyp-voice` if stored, else the lower: do is D3 for the lower voice and D4 for the
  higher (FACTS 69, 74), and the chart follows a change made in Sing it (`VoiceChoice.subscribe`,
  `kit/voice-choice.ts:20-48`). The steps carry no voice switch; free play does (below).
- **Compact** (hero and cold open): do's and so's bands over two slots, and no names or controls on
  the chart. **Play Merc's leap** sounds do then so (FACTS 91), and the arc draws as the second note
  starts. After the choice, each of the predict's three plays draws its path as it sounds: the
  middle note's band between do's and so's, and Merc's two smaller moves as arcs, do to the middle
  note and on to so (FACTS 12). The drawing is `aria-hidden`, and a polite live region speaks for
  it: "Merc's leap: do, D3, up to so, A3, a perfect fifth"; for a path, such as mi's, "Do, D3, up to
  mi, F sharp 3, a major third; then up to so, A3, a minor third" (re's: a tone, then a perfect
  fourth; fa's: a perfect fourth, then a tone).
- **Step** (Step 1): do's band and the second note's, over two slots; under the plot, in the
  figure's bottom 64 px, the folds strip: the kit's folds (`drawFoldPair`, `kit/folds.ts:91`),
  slowed 220 times by the kit's slow clock (`createSlowClock`, `kit/slow-motion.ts:29-47`), opening
  and closing at the sounding note's slowed rate and resting apart when nothing sounds. **Step**
  plays do then re; **Leap** plays do then so (FACTS 92); **Slow** (`aria-pressed`) doubles every
  length, the sound never pitch-shifted. The status line under the canvas names the move and the
  folds' change as a ratio, because the kit's `slowRate` prints both do and re as 0.7 a second
  (FACTS 30): "The step: D3 to E3, a tone. The folds go about an eighth faster: 1.12 times." and
  "The leap: D3 to A3, a perfect fifth. The folds go one and a half times as fast: 1.50 times." (the
  higher voice an octave up, the same ratios).
- **Hear** (Step 2): as Step, without the folds, and with the illustration drawn from the start: a
  violet line that leaps from do's band and lands about 75 cents under so's band, labelled "an
  illustration" beside it, with no sound (FACTS 98). **Hear it first** plays so alone and lights
  so's band while it sounds, with the status "So: hear where the leap lands." **Leap** plays do then
  so with Merc's arc, whether or not Hear it first came first. **Slow** as in Step.
- **Ladder** (Step 3): four slots, do, mi, so and the top do, drawn faint. **Climb** plays them in
  turn, each band lighting as it sounds. **Leap to so** and **Leap to the top do** play do then that
  rung, the arc drawn from do's slot over the slots between, so the drawing shows the leap skipping
  the rungs it climbed; the arcs are a drawing convention, not a timeline (FACTS 100). The status
  names each leap: "Do to so: a perfect fifth, 7 semitones, over mi." **Slow** as above.
- **Order** (Step 4): rung mode, the four rungs across the plot, faint, each named. **Play the five
  leaps** plays them in the syllabus's order (FACTS 36, 93), each arc drawing as its second note
  sounds, numbered 1 to 5 in plain digits beside it, the status naming it: "1 of 5: mi to so, a
  minor third, 3 semitones". **Slow** halves the speed: 12.4 s at speed, 24.8 s slowed.
- **Landing** (Step 5): do's slot and so's, longer. **Play** plays the illustrated landing (FACTS
  94, 99): the violet trace leaps to 80 cents under so, holds, slides up into the band and settles
  25 cents under so, while so's band stays lit amber. The readout follows the trace in the kit's
  words (`bandValueText`, `kit/band-words.ts:85-87`): "80 cents below Merc's note: outside the band;
  nearest note G sharp 3", then "25 cents below Merc's note: in the band; nearest note A3", and the
  band's edge lights "IN THE BAND" (`drawLitEdge`). **Pause** while it plays, **Slow** (6.0 s), and
  a **scrub** bar on the same row (MASTER-PLAN § 4.2 item 5): scrubbing draws the trace to that
  moment without sound.
- **Free play** (Wrap): rung mode, the four rungs as four buttons, "do", "mi", "so" and "top do",
  each named with its note ("so, A3"). A tap plays that rung in the soft tone; a tap after another
  plays the leap between them with its arc, up or down, and names it: "So to top do: a perfect
  fourth, 5 semitones, up". **Hear it first** (`aria-pressed`) sounds the landing note before each
  leap; **Slow** as above; the voice switch, "Lower voice" and "Higher voice" (`aria-pressed`),
  changes the chart's voice for the visit and stores nothing.
- **Layout and targets** (FACTS 97). The stage fit is the kit's, so the page sets no figure height
  of its own: on every step the deck measures what the toy needs besides its figure
  (`kit/step-deck.ts:15-17`; `fitStage`, `kit/stage-fit.ts:38`), and the figure, the kit's `.viz`
  (330 px beside the text; 280 px in the deck, 250 px at 420 px wide and under), gives way to it
  down to `--viz-min`, which this page sets to 210 px on the ladder chart, as Lesson 3's band chart
  does (`lesson-03/lesson-03.css:177-182`), because its rung names and rows collide any lower; a
  stage still over budget scrolls inside itself, by 60 px at most (PRODUCTION-PIPELINE § 5). Keep
  each step's chrome, its stage less the figure, under about 375 px at 1133 px wide: each step's
  controls are one row of `btn sm` buttons where they fit, wrapping on a phone as the kit's rows do,
  and at 344 px Step 5's scrub bar takes a row of its own. Every target is at least 44 px square,
  with the kit's 10 px between neighbours, at every width from 344 px up, and no chart row is a
  target. The plot gives 27.5 px a semitone beside the text over the 11-semitone window and 21.6 px
  over the 14, so the band stands 19.2 or 15.1 px; at the 210 px floor, 16.5 and 13.0 px; in the
  deck, 22.9 and 18.0 px at 280 px and 20.2 and 15.9 px at 250 px. Step 1's folds strip leaves its
  plot 21.6 px a semitone at 330 px and 10.7 px at the floor, where its two named rows still stand
  at least 21 px apart.
- **Keyboard and screen readers.** The chart is a group with a live summary in spoken names, never
  the sign. Every control is a button, and Slow, Hear it first and the voice switch carry
  `aria-pressed`. The scrub bar is a slider (`role="slider"`, 0 to 3 seconds, `aria-valuetext` such
  as "1.4 seconds of 3: 80 cents below Merc's note, outside the band"), moved by the arrow keys a
  tenth of a second at a time, Home and End for its ends. No two controls on the stage share a name:
  "Leap" in Steps 1 and 2 is named "Leap: do up to so"; the rung buttons "do, D3" and so on; the
  voice switch "Lower voice" and "Higher voice", distinct from Sing it's voice buttons and from Move
  do (Toys 4). Tab order: the state's own controls in reading order, then Slow, then the scrub bar.
- Under reduced motion an arc and a trace draw whole at once, a band lights without a pulse, and the
  folds are two stills with the ratio in words; a played sound still sounds.

### 2. Predict widget

- The kit's predict as it is (`mountPredict`, `kit/predict.ts:80`; FACTS 11), which takes two to
  four choices: here three `.choice` buttons, `data-choice` "re", "mi" and "fa", each at least 44 px
  tall. The choice locks (`:113-131`) and unlocks the three plays, `data-play` "re", "mi" and "fa",
  labelled "Play do, re, so", "Play do, mi, so" and "Play do, fa, so", which start disabled.
- **Play Merc's leap** is a `data-free` play inside the predict's root: it works before the choice,
  so the sound comes first (playbook rule 5), and it never reveals, since it is the leap the
  question is about and says nothing of how a middle note splits it.
- `revealOn: ['re', 'mi', 'fa']` and `revealAfter: 'all'`: the reveal waits until all three paths
  have been heard with sound on (`:97-101`, `:146-160`), each to its end: a path cut short, by
  another sound or a stop, does not count, so the reveal waits for it to play through (Audio).
  `revealOn` must be given: with `'all'` the kit reads only that list, so without it the first heard
  play would reveal (`:100-101`).
- The hints: `chosen`, "Locked in. Play all three: do to so, through re, mi and fa."; `next`, "Now
  play the others, so you've heard all three."; `silent`, LESSON.md's "Sound is off, so nothing
  played. Turn sound on to hear them, then play all three."; `again`, "Play them again, or play
  Merc's leap."
- `guess` gives "You said: re", "You said: mi" or "You said: fa", in Lesson 2's form
  (`lesson-02/cold-open.ts:34-37`), never "right" or "wrong", and the reveal's text is LESSON.md's
  for every choice. It answers by arithmetic, mi's 4 and 3 semitones against re's and fa's 2 and 5;
  its "(Each makes the jump smaller too, so re or fa was a fair guess.)" consoles the other two
  choices; and no line says which note helps a singer aim (FACTS 12). `onReveal`: Tavi celebrates
  once (Merc and Tavi).
- States: waiting for a choice, with Play Merc's leap working; the choice locked and the plays open;
  one or two paths heard, with the `next` hint; all three heard, and the reveal shown. With sound
  off a play draws its path and shows the `silent` hint, and the reveal does not come.
- Under reduced motion the reveal appears without its rise (`kit/predict.ts:149`).

### 3. Four words

Lesson 1's strip: Leap plays do up to so with its arc; Third plays do up to mi, then mi up to so;
Arpeggio plays do, mi, so and the top do; Landing zone lights so's band and plays nothing (FACTS
91). Each button names what it does ("Play: do up to so"; "Show: so's landing zone").

### 4. Sing it: do-mi-so-do

The ladder chart in live mode, inside Sing it's card, with Merc's rungs as the target and the
viewer's line drawn against them. It is the kit's `.sing-chart` (240 px; 210 px at 420 px wide and
under), a band chart as on Lessons 3 and 5 (`learn/03.html:1491`), so the full ladder's 14-semitone
window gives 15.1 px a semitone (13.0 at 210 px) and the smaller ladder's 9 gives 23.6 (20.2) (FACTS
97). Every state has a visible status line that is also announced (`aria-live="polite"`).

States:

1. **Comfort check**, always first and asked every visit (never stored): Lesson 3's comfort line,
   its list naming all six of REQ-GVC-020's conditions, and its two buttons (FACTS 64, 65), through
   the kit's `mountComfort` (`kit/comfort.ts:158-166`).
2. **Voice choice**, after either comfort answer: Lesson 3's two buttons with Merc and Tavi's stills
   (`aria-pressed`, at least 44 px), under LESSON.md's line in its three forms, "Choose a voice to
   sing with. If you chose one in an earlier lesson, pick it again:" with none stored and "Keep the
   voice you chose before, or change it:" with one, as Lessons 5 to 7 word it, the first as Lesson
   5's page prints it (`learn/05.html:1385-1388`; FACTS 69); after "Just listen today" with none
   stored, Lesson 8's "Choose a voice: it picks the Merc who sings." It reads and writes `fyp-voice`
   through `VoiceChoice` (`kit/voice-choice.ts:20-48`). A stored choice shows pressed and can be
   changed; with none stored, neither is pressed and the next state waits for a choice, before "Just
   listen today" plays anything too, because the voice picks the Merc who sings. Just listen today's
   line and the doctor lines (state 3) do not wait: they show with the choice, as Lessons 3, 6 and 8
   have them, since the referral guidance never waits on an unrelated choice.
3. **Just listen today** (listen-only mode): LESSON.md's line with the doctor lines (FACTS 67, 68);
   the ladder choice and Move do (state 5) and **Play Merc's ladder**, which sings it on a tap in
   the chosen voice, the chart lighting each rung; nothing listens, the warm-up and Start are not
   shown, and nothing asks the viewer to sing (REQ-GVC-021). The Wrap shows the rest card.
4. **Warm-up**, optional, with Skip: Lesson 3's words and its two plays, Play Merc's sigh and Play
   the slide, in the chosen voice (`warmUpContour`, `kit/warm-up.ts:24-36`), with "Copy the way
   Merc's voice slides, not the exact notes." and the stop line (FACTS 70). Nothing listens and
   nothing is scored (REQ-GVC-074, REQ-GVC-075). The Skip is stored as `fyp-l09-warmup`, as Lessons
   3 and 5 store theirs (`lesson-03/sing.ts:48`, `lesson-05/sing.ts:54`).
5. **Your turn and briefing**: LESSON.md's Your turn text with its two controls; the stop line on
   its own line; the "What this does" box (REQ-GVC-002, REQ-GVC-003, REQ-GVC-012, REQ-GVC-026; FACTS
   87, 88); **Play Merc's ladder** and **Start**, the only control that asks for the microphone
   (MASTER-PLAN § 4.2 item 2).
   - The ladder choice: two buttons with `aria-pressed`, "Do-mi-so-do: up to the top do" (pressed at
     first) and "Smaller: do-mi-so-mi-do". The chart shows the pressed ladder's slots, faint.
   - **Move do**: Lesson 4's control, word for word (`learn/04.html:1254-1263`): a group labelled
     "Move do:" with two buttons, "lower" and "higher", a semitone a tap, up to four each way from
     D3 (or D4), each disabled at its end, as Lesson 4's are (`kit/move-do.ts:26-27`, `:51-63`,
     `:38-49`; FACTS 75). The rungs, their names and the chart's window move with it, and the
     chart's summary says where do is ("Do is D3"), in Lesson 4's spelling (FACTS 22). The ladder
     choice and Move do can change before Start or Start again, and Move do before Again, whose two
     buttons are the ladder choice there; never during a take.
   - Start: with sound on, it asks for the microphone (`listen('lesson-09', Sound.context())`,
     `kit/listen.ts:54-57`), then Merc sings the chosen ladder, each slot's band lighting as he
     sings it (Listen), then, at least 0.4 s after his last note ends, the take opens. With sound
     off, Start and Play Merc's ladder play nothing and ask for nothing, and the hint shows: "Sound
     is off, so nothing played. Turn sound on to hear Merc's ladder, then press Start." Start
     again and the Again buttons do the same, and their hint names them: "Sound is off, so nothing
     played. Turn sound on to hear Merc's ladder, then press Start again." and "Sound is off, so
     nothing played. Turn sound on to hear Merc's ladder, then press Again." That is Lesson 1's
     rule, as Lessons 5 to 7 apply it: what waits on hearing a sound waits while the sound is off.
     Sound turned off while Merc sings, before the take opens, ends the take without counting it,
     and the card goes back to how it stood before its button, with that button's hint: no take is
     spent on a ladder the viewer could not hear.
6. **Take**: the status reads "Your turn: start on do when you're ready. Move on each time the next
   band lights up." The take waits up to 6 s for the first voiced frame, then runs one 1.5 s slot a
   note from that frame, 6.0 s for the full ladder and 7.5 s for the smaller (`takeFrames`,
   `kit/listen.ts:168-195`, with `wait: 6` and `run` the ladder's length, `:89-110`; FACTS 76).
   Before the voice starts, do's band glows; from the first voiced frame, each slot's band glows in
   turn, every 1.5 s: that is the guide, on the chart itself, so the page needs no ring or countdown
   beside it. The violet line draws live, folded around the glowing rung's note (its cents from the
   rung through `foldCents`, `src/lib/pitch-measurements/f0.ts:57-59`), with a small "octave lower"
   or "octave higher" tag while it sits within 50 cents of the rung an octave away (FACTS 45); a
   frame outside the window pins to the chart's edge with a small arrow and no number. Merc and Tavi
   listen (`mercListen`, `kit/merc-duo.ts:206`). The microphone is released when the take ends.
7. **Reading**: one line a note, from the ladder reader (below), listed under the chart in the
   ladder's order, each also drawn: a rung whose note landed lights its edge, "IN THE BAND". If no
   voice came within 6 s, the line is Lessons 5 and 7's with this task's cue, "We didn't hear you
   start that time. Start on do when its band lights.", with **Start again** while the visit has had
   fewer than three takes (this take counts, and leaves the visit's one Again unused) and **Done for
   today**, and no feeling question, since nothing was sung. After the last take, or once Done for
   today is pressed, the line keeps "We didn't hear you start that time." and drops its cue, since
   no retry wording shows without a retry control. Otherwise **How did that feel?** follows the
   lines at once (REQ-GVC-022), and the count (below) comes with its answer (state 8).
8. **How did that feel?**: Lesson 3's four answers (`aria-pressed`, at least 44 px, two a row on
   phones), through `mountFeelings` (`kit/comfort.ts:168-206`) with its default, an answer that
   locks, asked after each take with voice (FACTS 82): a press disables all four, and `reset()`
   frees them for the next take, so an answer cannot be changed once it has set what follows. Lesson
   6's page (PR #1149) gives `mountFeelings` a `changeable` option for its sweeps, which this page
   leaves off.
   - Easy or Workable: the count, and "If that felt tricky, good: that's learning." when fewer than
     all the heard notes landed (`trickyAfter`, `kit/take.ts:184-186`); then, if the visit's one
     Again is unused and fewer than three takes have been made, **Again** (the same ladder, named
     "Again: do-mi-so-do" or "Again: the smaller ladder") and, after the full ladder, **Again,
     smaller** too (named "Again, smaller ladder", which holds its visible label); either uses the
     one Again. Then **Done for today**. Merc celebrates once if every heard note landed (FACTS 83).
     The Wrap shows the practice card.
   - Effortful: the count, then Lesson 3's "Keep it gentle: rest before you sing again.", no Again
     and no further ladder this visit; the ladder choice, Move do and Start go. The Wrap shows the
     rest card, as Lessons 6 and 7 specify. The rules decide it: a report of effort suppresses
     immediate-repeat encouragement (REQ-GVC-021), and both practice drills reach an octave.
   - Uncomfortable: the lines and the count are taken away, then Lesson 3's "Thanks for saying so.
     That's enough singing for today: rest your voice." with the doctor lines; no Again and no
     further ladder; the chart keeps Merc's rungs only. The Wrap shows the rest card (REQ-GVC-023,
     REQ-GVC-024, REQ-GVC-055).
   - Once "Effortful" or "Uncomfortable" has been answered, no further ladder and the rest card stay
     so for the visit. The page keeps the ending in memory for the visit, never in storage
     (`VisitEnding`, `kit/comfort.ts:89-114`).
9. **No microphone** (refused, no device, or the listener failed to load): listen-only mode with
   LESSON.md's "No microphone?" line; Merc's ladder still plays, and the Wrap keeps the practice
   card, since singing along with nothing listening is no report of effort (Lesson 3's rule).
   Without Web Audio (no `AudioContext` in the browser), nothing can play and the listener cannot
   run, so Sing it offers this listen-only path at once, with no Start: Play Merc's ladder lights
   the rungs in silence, with the hint "This browser can't play sound here."

The retry rules, all in the flow rule below (FACTS 77, 78):

- A visit allows at most three takes. Every take counts: one with no voice, one with no steady note,
  and one abandoned when the page was hidden.
- Again after "Easy" or "Workable" is offered at most once a visit, whatever the take's reading. A
  take with no voice asks no feeling question; its Start again is a fresh start and leaves the one
  Again unused. A take abandoned when the page was hidden asks none either, and Start comes back
  while takes remain, but if it had voice it uses the one Again up. So a visit holds at most three
  takes and two sung ladders.
- Never a retry after "Effortful" or "Uncomfortable": once either has been answered, no Again and no
  Start appear for the rest of the visit.
- The ladder can only get smaller within a visit: once a smaller ladder has been sung (a take with
  voice), the full ladder's button is gone, and Again offers only the smaller one.
- No reading line invites another try (FACTS 79), so no retry wording can show without an Again.

The flow is a pure rule (`lesson-09/ladder-flow.ts`), as Lessons 6 and 7's are: from the comfort
answer, the voice, whether sound and Web Audio are on, the ladder pressed and Move do's position,
the takes so far (how many, and for each whether it had voice, whether any note was steady, which
ladder it sang and whether it was abandoned), whether the visit's one Again has been used, and the
answers so far (the latest, and whether "Effortful" or "Uncomfortable" was ever answered), it gives
the state, the controls shown, the lines and the Wrap's card, so every branch above is unit-tested
without a microphone (Tests, 7).

Reading a ladder (`kit/take.ts`, extended with `readLadder` and `rungLine`; pure and unit-tested):

- Input: the take's raw frames, the ladder's rungs as MIDI notes in sung order (from do D3: 50, 54,
  57, 62, or 50, 54, 57, 54, 50), and the slot length, 1.5 s. A frame is voiced when Voice Mirror's
  `preprocess` keeps it, as `readTake` takes them (`kit/take.ts:125-147`).
- No voiced frame gives `{ heard: false }`, the "didn't hear you start" line (state 7).
- The slots start at the first voiced frame: slot k holds the raw frames from 1.5k s to 1.5(k + 1) s
  after it. Each slot is read by the kit's own `readTake` against its rung, unchanged: its first 0.3
  s dropped as the attack, so the move from the last note is never read as this one, and 0.6 s of
  steady voice needed after it (FACTS 76); the distance folded into the rung's octave, with the
  octave line only within 50 cents (FACTS 45, 80).
- The count is the kit's `countRun` over the slots, each slot one note with one take, so a slot with
  no steady voice is left out, never counted as a miss (FACTS 81).
- The line for a slot, `rungLine(label, reading)`: the rung's label ("Do", "Mi", "So", "Top do"; on
  the smaller ladder "Do", "Mi", "So", "Mi again", "Do again"), a middle dot, then the reading:
  "Right in the middle: …", "In the band: …" or "Close: …", each with the kit's gap words
  (`readingLine`, `kit/take.ts:88-105`), without its "Listen again, then aim a touch higher." on a
  close note; beyond 60 cents, "{About a semitone below}, nearer a different note."
  (`semitonesAway`, `:79-86`), without the kit's "Listen again, then slide up to the band." (FACTS
  79); a slot without steady voice, "We didn't hear a steady note there." (new,
  `NOT_STEADY_RUNG_LINE`), without the kit's "Try again at about speaking volume."
  (`NOT_STEADY_LINE`, `:74-75`); and the octave line, when there is one, as a second sentence
  (`octaveLine`, `:107-113`).
- The count's line is the kit's `countLine` ("This time, 3 of your 4 notes landed in the band.", or
  "… of the 3 notes we heard …"), or `NONE_HEARD_LINE` when voice came but no note was steady
  (`kit/take.ts:173-182`).
- Every template passes `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts`, surface
  `finding`) in a unit test, as Lesson 3's lines do.

Listening: Lesson 3's `kit/listen.ts`, unchanged: `micManager.acquire('lesson-09')` for the take
(`:59`), released when it ends, on leaving the section, on `pagehide` and when the tab is hidden
(`:18-22`); the YIN-only F0 stream (`src/lib/pitch-f0-stream.ts`); one AudioContext through
`Sound.context()`, so every note Merc sings and every frame the take hears share a clock; nothing
plays while a take is open. Nothing is recorded or kept, nothing leaves the device, and no event
carries a note, a reading or an answer. No checkpoint event: `lesson_answer` covers only the quick
check and the recall; a count-only "checkpoint finished" event (REQ-GVC-090; FACTS 87) is not built.

Accessibility and motion: the bands are words plus the lit edge, never colour alone (REQ-GVC-082).
After a take the chart's summary reads, for example, "Your ladder, drawn as a line: do in the band,
mi close, so in the band, top do with no steady note" (REQ-GVC-085). Start, Start again, Again,
Again smaller, Done for today, the comfort and voice buttons, the ladder choice, Move do and the
four feelings are real buttons of at least 44 px in a keyboard order that follows the flow; a button
the flow does not offer is absent, not disabled, except Move do at its ends and the feelings once
answered, as the kit has them; Space never starts a take by itself (REQ-GVC-080). Under reduced
motion the live line draws on a fixed frame that never scrolls, the guide's bands light without a
pulse, and Merc and Tavi skip their reactions (REQ-GVC-083).

### 5. Recall and quick check

The kit's quiz as it stands carries everything two quizzes on one page need (`kit/quiz.ts`): an id
`prefix` for each quiz's elements (`:88-93`), question ids, from which a question's lesson is read
(`:42-47`, `lessonOfQuestion` `:131-135`), an optional `lesson` (`:82-83`), a `slot` for a
question's own controls (`:52-58`), and links that leave this page for a question from another
lesson (`linkAway`, `:186-216`), which keep their words and drop the link where that lesson is not
live (`:186-190`).

- **Recall**: Lesson 6's questions 2 and 3, word for word with their feedback (LESSON.md; FACTS 4),
  under their Lesson 6 ids, `l06-q2` and `l06-q3`, with the prefix `rc-`, as Lessons 3 and 5's
  recalls have (`lesson-05/recall.ts:17-22`), shown to everyone (Lesson 6 is a prerequisite).
  Reshuffled from a seed of its own (keys `fyp-l09-recall-seed` and `fyp-l09-recall-v1`, as Lessons
  4 and 5's are, `lesson-04/main.ts:61`); earlier answers are never shown, so the answers measure
  delayed retrieval (MASTER-PLAN § 9). It takes no `lesson`, so it marks nothing done. Question 2's
  slot holds a Play button for Lesson 6's sound, C4 then F4 (FACTS 96), handled by a listener on the
  quiz's host, since the kit builds each slot once and keeps it across answers (`quiz.ts:237-244`).
  The kit turns "Try Step 5 again" and "Try Step 2 again" into "Try Lesson 6, Step 5 again" and "Try
  Lesson 6, Step 2 again", links that open Lesson 6's page at that step, `/learn/06#step-5` and
  `/learn/06#step-2`, in a new tab so the viewer keeps their place here, never `data-goto-step`,
  which would move this page's own deck (`quiz.ts:186-216`); where Lesson 6 is not live, each keeps
  its words with no link (`:206-209`; Edge cases). The address is the quiz's `away.href`
  (`quiz.ts:94-101`), the kit's `recallStepHref` (`:141-143`) in place of the default
  `/learn/06#lesson`, and the kit's step deck opens at the step an address names
  (`kit/step-deck.ts:18-23`, `:292-300`).
- **Quick check**: LESSON.md's four questions, ids `l09-q1` to `l09-q4`, keys `fyp-l09-seed` and
  `fyp-l09-quiz-v1` (`lesson-04/main.ts:84`), and `lesson: 9`, so answering all four marks Lesson 9
  done in the explorer. Three answers each, shuffled per question from the stored seed, one-line
  feedback for every answer, and a check icon and ink (not gold) on the right one. The kit prints
  "Right." or "Not quite." before each line (`quiz.ts:315`), so no feedback line starts with
  "Right", "Yes" or "Correct". "Try Step 2 again", "Try Step 3 again", "Try Step 4 again" and "Try
  Step 5 again" use the kit's `data-goto-step`. LESSON.md's note on the shuffle is editorial and
  never printed. Answers stay in the viewer's browser; since #1193 each question's first answer in
  a visit also goes out, anonymously.

## Audio

Every tone is synthesised in the page with Web Audio at the frequencies in FACTS 90, through the
kit's sound module and its house envelopes (`.claude/memory/audio-pop-free-playback.md`), and
started only by a tap: Merc's notes, leaps, paths and ladders in Merc's "ooh"; the illustrated
landing, the recall's two notes and the rung taps in free play in the soft tone (FACTS 90 to 96). A
leap is two notes, each its own voice, so a repeated note is heard as two; Step 5's slide is one
voice that glides, the kit's `contourVoice` (`kit/sound.ts:321`). Nothing autoplays, nothing plays
while a take is open, and the page has no music bed.

One sound plays at a time, page-wide. Every source, the cold open, the Four words, the step toys,
the recall, Sing it and free play, takes the page's one "now playing" owner before it sounds, and
the owner stops whatever was sounding, so a new tap stops the last, whichever control made it.
Leaving a step stops its sound and anything it has queued, the rest of a sequence or a replay,
whatever the route: Previous or Next, a swipe, the wide page's scroll, the lesson menu's jump, a
`#step-N` address and a quick-check step link all reach the deck's `show`, which calls each toy's
`onStep(step, previous)` (`kit/step-deck.ts:45-47`, `:140-172`), and the page stops the step's sound
whenever `step` differs from `previous`; a layout switch calls it with the same step (`:188-191`)
and stops nothing. A play cut short, by a new play or a stop, never counts as heard: the cold open's
`play` resolves `false` for it, and the predict counts only a play that runs to its end (Toys 2).
Both rules' kit parts come with PR #1149's fix pass, from Lesson 6's page review: the owner, and
`kit/predict.ts`'s `play` resolving `false` for "not heard", where a `void` result keeps today's
meaning, so Lessons 2 to 5 see no change (What the kit and the app still need, 9; unit tests 14 and
15).

## Merc and Tavi

Lesson 1's setup through the kit (`kit/merc-duo.ts`, `kit/merc-warm.ts`): the app's renderer loaded
after first paint, one WebGL context per Merc, medium quality on phones, turned towards each other,
paused off screen, and the still images when WebGL fails or would run on the CPU.

- They live in the hero, and their reactions are the hero pair's: the Merc of the chart's voice
  sings while the cold open's leap and paths sound (Merc for the lower voice, Tavi for the
  higher), and Tavi celebrates once at the cold open's reveal (no sparkles), the puzzled guesser
  who then gets it (playbook rule 15). The same rule picks the singing Merc wherever Merc's notes
  sound.
- `kit/merc-duo.ts` has `mercSing`, `mercListen` and `mercCelebrate` (`:164`, `:206`, `:217`): Merc
  sings his notes, both listen during a take, and the singing Merc celebrates once after "Easy" or
  "Workable" when every heard note landed, never otherwise (FACTS 83). Proposed: a `mercHop` beside
  them for Merc's leaps, since the renderer has `hop`, "Moving between places; jumping notes"
  (`src/lib/merc/constants.ts:23`; MERC-BIBLE § 5, `MERC-BIBLE.md:101`). Without it the page uses
  `mercSing`.
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Arpeggio Jumper and Interval Trainer.** Both sit in the Exercises tab, which
  `mercurypitch.com/pitch-training` opens (FACTS 55), and both are free and ungated (FACTS 54). On
  the public host the card's link is `/pitch-training?lesson=09`: the marker makes First Light step
  aside for good, so a first visit lands on the Exercises tab with no intro (FACTS 56), and the card
  carries no first-visit line. The card names the taps ("then tap Arpeggio Jumper or Interval
  Trainer"), because Scale Runner sits between them in the menu (FACTS 53). It comes in two
  versions, picked by how Sing it ended (Toys 4); the rest card, a link until #1177, links nowhere.
  What the card says of each drill is in FACTS 48 to 52, and it says in plain words that Interval
  Trainer wants each note in the octave it plays, not an octave away, and that Arpeggio Jumper
  scores a whole run sung an octave up or down in that octave, and says so (FACTS 50, 51;
  CURRICULUM § 4 item 7).
- **App content, done** (MASTER-PLAN § 7's App content track): Arpeggio Jumper's grade is the
  average of its note scores, its scoring version 2 of 25 October 2026 (FACTS 50). It no longer
  blends in a "richness" score, which was only the run's average pitch clarity, a measure of the
  recording rather than the singing, and nor does the grade of Scale Runner, which Lesson 4's card
  links. Interval Trainer's card no longer says it sings intervals "above and
  below" a note: main fixed it on 19 October 2026 (FACTS 53), and this package's plan commit drops
  the fix from MASTER-PLAN § 7's App content row (`MASTER-PLAN.md:304`).
- **Needed, proposed: `/exercises/leap-ladder`** (CURRICULUM § 4 item 2, and the Phase 2 engineering
  track's Lesson 9 interval set, `MASTER-PLAN.md:311-315`): Interval Trainer on this lesson's leaps,
  registered in `EXERCISE_SLUGS` as
  `{ kind: 'exercise', exercise: EXERCISE_INTERVAL_TRAINER, intervals: [3, 4, 7, 5, 12] }`, each
  upward, with a line in `src/tests/slug-map.test.ts`. It needs the `intervals` field on
  `ExerciseLaunch` (`src/features/exercises/slug-map.ts:26-43`), passed by `applyExerciseSlug` into
  the launch override beside the notes and the difficulty (`src/App.tsx:754-765`); the trainer
  reading it in place of its fixed pool, which today has no minor third (FACTS 51, 59); and, since
  `plannedRounds` caps a run at the pool's size and `generateIntervals` plays each interval once,
  either five rounds a run or a field that lets intervals repeat (FACTS 60). The set keeps the
  plan's octave, which this page makes optional, as the rules allow: played from a preset's anchor,
  as the trainer plays every round, the octave tops out 7 to 9 semitones under the preset's top, so
  it requests no extreme of the saved range (REQ-GVC-011), and the card's "If the top do felt high
  today, leave them for another day." is the gentler way (REQ-GVC-055; FACTS 60). When it ships,
  LESSON.md's editorial note gives the card's new sentences, and the season entry's `needs` gives
  way to a second link.
- **Optional, proposed: `/exercises/arpeggio-jumper`**, a data-only slug (CURRICULUM § 4 item 1)
  that opens Arpeggio Jumper on its setup screen with its defaults, so the card can link the drill
  itself; its notes, if any, are fitted to the singer's range as every slug's are
  (`src/App.tsx:750`).
- **Not linked**, with the reasons in FACTS: the Ascent's "Tuning & Ear" week (FACTS 61), which the
  CURRICULUM card listed and CURRICULUM § 4 item 8's rewrite now takes, beside weeks 2 and 3, so
  that its coach note, its focus line, its first goal and its two videos are checked against the
  claims rules before a lesson links it; Ear Lab's Leap (`src/features/ear-lab/LeapDrill.tsx`),
  which names intervals by ear and so is Lesson 6's kind of drill, not a sung one; and the Sing
  room's premium exercises, which are not this lesson's (FACTS 54).

## Explorer and season data

- **Season data**: Lesson 9's entry in `kit/season.ts` (`:325-344`) gains a plain `minutes: 16` and
  `page: '/learn/09'` after its topics, in every build, under the comment Lesson 5's entry carries,
  `// A draft until its sign-off (drafts.ts), as Lesson 3 is.` (`season.ts:250`), as Lesson 3's own
  are written (`season.ts:210-213`; FACTS 5, 62, 63). Whether the page is live is `kit/publish.ts`'s
  to say: `seasonFor` draws a lesson held back as one coming later, with no page and no reading time
  (`:94-124`), so the entry reads neither `DRAFT_LESSONS` nor `DRAFTS_SHOWN`, which
  `kit/drafts.test.ts` keeps to the publishing rules alone (`:57-67`). Its link changed before the
  page, on its own, since every lesson page's explorer prints it (FACTS 61, 62): it is
  `href: '/pitch-training?lesson=09'`, `addr: 'mercurypitch.com/pitch-training'`,
  `label: 'Exercises'` and `note: 'then tap Arpeggio Jumper'`, so the card reads "Exercises, then
  tap Arpeggio Jumper", as Lesson 4's reads "Exercises, then tap Scale Runner" (`season.ts:236-241`,
  `explorer.ts:181`). The note is in the learner's words (`season.ts:34-37`); `needs` keeps
  "Interval Trainer (sing) and Arpeggio Jumper" for the team, and no card draws it. Its topics
  stay. Its hook is the entry's, the default (`season.ts:334`); its tease, which Lesson 8's card
  draws, is `kit/lesson-copy.ts`'s (`:114`), whose entry held the alternative `'harder'` (`:106-114`
  at `b7093a0a4`) until #1186 dropped it (FACTS 1). `EDGES` already holds [3, 9] and [6, 9]
  (`season.ts:420-421`).
- **The explorer card**: what the kit draws for a lesson with a page and no published film: its
  state and main action from `kit/lesson-state.ts` ("Start lesson", "Continue: step N" or "Read
  again"), its minutes, no Watch button (`kit/season.ts:23-25`), and the learner's fields only,
  which `src/e2e/learn-no-planning-text.spec.ts` holds every built lesson page to.

## What the kit and the app still need

Found in the kit and the app as they stand on main (21 October 2026, `a3d8048e1`), and in Lesson 6's
page as PR #1149 has it (`f6333d527`), beyond the parts Lessons 2 to 7 promote into the kit (Toys
table):

1. The lesson host: `learn/09.html` at `/learn/09`. Every build takes every `learn/NN.html` as an
   input and routes its clean path (`tools/draft-lessons.ts:1-18`; `lessonPages`, `:77-86`;
   `lessonInputs` and `lessonPaths`, `:109-122`; `vite.config.ts:319`, `:493`), so the page needs no
   build change. Its line in `kit/drafts.ts`,
   `9: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`, beside Lessons 3 to 8's (`:30-39`),
   makes it a draft: production's `LESSON_DRAFTS`, "0", holds it back, and the dev site's and the
   previews', "1", show it (`wrangler.jsonc:165-167`, `:188-190`, `:231-232`), until the console
   sets it either way, and the Content Studio's Lessons page names that reason when asked to publish
   it (FACTS 9). `/learn/09` and `/learn/09.html` go in `STANDALONE_DOCUMENT_PATHS`
   (`src/lib/sw-runtime.ts:93`, the lessons `:131-157`), so the service worker never serves the app
   shell in the lesson's place; `src/tests/lesson-pages.test.ts` checks a draft for them too
   (`:339-343`). On release: delete the `drafts.ts` line, and add the page to `public/sitemap.xml`
   and to `public/llms.txt`'s Lessons list (`:66-70`), whose intro already allows a page with no
   episode; until then the site worker adds the page to both only while it is published
   (`src/lesson-gate.ts:22-24`). Then `src/tests/lesson-pages.test.ts` holds the page to the
   released checks (`:277-305`), and `tools/lesson-links.ts` links it from every entry document by
   its headline (FACTS 63).
2. The page's head, written in full from its first commit:
   `src/features/lessons/kit/lesson-copy.test.ts` reads every `learn/NN.html`, drafts included
   (`:305-320`), and `src/tests/lesson-pages.test.ts` holds every lesson document's head and
   structured data, a draft's included (`:139-275`), and a released lesson's listings (`:277-305`).
   The hook's copies are the ones the site worker rewrites when the console picks an alternative
   hook (`src/lesson-gate.ts:17-19`, `:453-468`); only the meta description and the Article's
   description, which repeat each other, may shorten the hook, and every other copy carries it
   whole. As Lesson 2's head has them (`learn/02.html:9-136`):
   - the title, "Landing a leap: singing big intervals in tune | MercuryPitch" (60 characters, the
     test's most, `lesson-pages.test.ts:154-155`), SEARCH.md § 4's draft (`SEARCH.md:240`), and
     the h1, `h1.hook#hook`, the hook in its default wording (`lesson-copy.test.ts:323-332`; Hero);
   - the meta description, "How do you land a note you have to leap to? A sixteen-minute lesson on
     big leaps: hear the landing note first, aim at its band, then sing a ladder." (147 characters,
     inside the test's 80 to 160, `lesson-pages.test.ts:156-159`, with the run time in words that
     every page's description and Article carry, `:191-210`). It names no middle note, so
     it does not answer the cold open's predict (the lead's decision 1, 24 October 2026);
   - `og:title` and `twitter:title`, "Landing a leap: Find Your Pitch, Lesson 9", hold the headline,
     as the title did until #1187 (`lesson-pages.test.ts:184-188`; `learn/02.html:26-29`);
   - `og:description`, the full hook and one line, "How do you land a note you have to leap to? Hear
     the landing note first, then aim at it." (`lesson-copy.test.ts:349-352`;
     `learn/02.html:30-33`), and `twitter:description`, the hook exactly
     (`lesson-copy.test.ts:353-355`; `learn/02.html:49-52`);
   - canonical and `og:url` `https://mercurypitch.com/learn/09`, `robots` "index, follow,
     max-image-preview:large" and `twitter:card` "summary_large_image"
     (`lesson-pages.test.ts:143-161`);
   - `og:image` and `twitter:image`, `https://mercurypitch.com/learn/lesson-09-og.jpg` (item 3),
     with `og:image:width` 1200 and `og:image:height` 630, and as `og:image:alt` and
     `twitter:image:alt` "The title card: Find Your Pitch, Lesson 09, Landing a leap, above two
     bands, do's and so's, with an amber arc leaping from one to the other, between Merc and
     Tavi." (`learn/02.html:34-43`, `:53-60`);
   - the Article node, in the head's first `application/ld+json` script and as a single object,
     since the test reads `alternativeHeadline` there and checks it only when present
     (`lesson-copy.test.ts:338-346`, `:356`): `@id` `https://mercurypitch.com/learn/09#lesson` and
     `url` `https://mercurypitch.com/learn/09` (`lesson-pages.test.ts:173-174`); the headline
     "Landing a leap"; `alternativeHeadline`, the hook exactly; `description`, the meta
     description's words, and `image`, the `og:image` URL (`:182-183`); `position: 9`,
     `learningResourceType` "Lesson", free, the series as `isPartOf`, and the organization as author
     and publisher (`:175-180`), as in Lesson 2's (`learn/02.html:69-111`). It has no
     `datePublished` yet, as the built pages leave it out until they go live
     (`learn/04.html:61-68`): the date is the day the page first goes live on mercurypitch.com,
     which nothing writes at run time, so it is set in the commit that deletes the page's
     `drafts.ts` line or in one straight after the console publishes it (SEARCH.md § 3.2);
   - a BreadcrumbList from the home page to the headline (`lesson-pages.test.ts:212-225`;
     `learn/02.html:112-136`); and the legal links, privacy, terms and imprint, in a `nav` labelled
     "Legal" (`lesson-pages.test.ts:263-274`).
3. The share image the head names, `public/learn/lesson-09-og.jpg`, which
   `src/tests/lesson-pages.test.ts` requires of every lesson document, a draft's included: in
   `public/`, at the pixel size its `og:image:width` and `og:image:height` give (`:227-246`). It is
   1200 x 630, a baseline JPEG as Lesson 4's card is (`public/learn/lesson-04-og.jpg`), drawn with
   the page's own kit so that it looks like the page it opens: the title, Lesson 09 and the wordmark
   over the ladder chart's compact still, do's and so's bands with Merc's amber arc between them,
   between Merc and Tavi. It shows no middle note, so it does not answer the cold open's
   predict.
4. First-paint ceilings for `learn/09.html` in `scripts/assert-first-paint-budgets.mjs`, one in its
   JavaScript table and one in its stylesheet table, beside Lesson 3's (`:103-151`, `:287-290`).
   Every build emits every lesson page, and the check fails a document with no ceiling (`:550-554`),
   so without them the Browser jobs fail before any spec runs, as Lesson 6's did on PR #1149. Each
   is the page's measured first paint plus about a quarter, the tables' rule (`:47-58`, `:243-253`),
   measured in `build:e2e`, where the check runs (`package.json:20`): a build of Lesson 6's page
   alone weighed it about 8 KB lighter. As on Lesson 3, the listener, the pitch detector and Voice
   Mirror's scorer arrive through a dynamic import when Start is pressed
   (`scripts/assert-first-paint-budgets.mjs:108-111`), and the ceiling holds only while that
   boundary does.
5. `kit/band-chart.ts` and `kit/band-chart-draw.ts`: rungs in the scene, each a band at its cents
   from do, over a time slot or across the plot, each with its glow and its lit edge; Merc's arcs,
   with an optional number; and a rung-names option on the notes axis beside `named`
   (`band-chart.ts:54-68`), which names the given rows ("so · A3") and leaves the rest unnamed (Toys
   1). The existing single band is the one-rung case, so Lessons 3 and 5's figures see no change; a
   unit test proves it.
6. The folds strip: the kit's folds (`kit/folds.ts`), in a 64 px canvas under the band chart inside
   the one figure, so the stage fit sizes both together.
7. `kit/take.ts`: `readLadder`, `rungLine` and `NOT_STEADY_RUNG_LINE` (Toys 4), beside `readTake`,
   which they reuse unchanged.
8. `kit/comfort.ts`: an option that sends "Effortful" to the rest card,
   `afterFeeling(f, { restAfterEffort: true })`, since `afterFeeling` leaves it to the coach
   (`:69-78`) and Lessons 6, 7 and 9 all choose it (unit test 13). Built by #1192: Lesson 6's page
   (PR #1149) sent effort to the rest card in its own flow until then, and Lessons 6, 7 and 8 now
   pass the option, as this page will. `mountFeelings` needs nothing new: PR #1149's `changeable`
   option serves Lesson 6's sweeps, and this page takes the default, an answer that locks (Toys 4,
   state 8).
9. The two sound rules' kit parts (Audio), which PR #1149's fix pass brings from Lesson 6's page
   review: `kit/predict.ts`'s `play` may resolve `false` for a play cut short, which the predict
   then never counts as heard, while a `void` result keeps today's meaning (`:31-41`, `:184-188`);
   and a page-wide "now playing" owner that every sound source takes before it sounds, which stops
   the sound before it. If that pass keeps the owner in Lesson 6's own modules, it moves into the
   kit before this page is built, as Move do does (item 10).
10. Move do as a kit part, promoted before this page is built. Built by #1192: Lesson 4's page
    had it, and Lesson 6's page (PR #1149) a copy in its own module (`lesson-06/sing-guide.ts`,
    its `MOVE_MAX` and `clampMove`), so this page would have made a third. `kit/move-do.ts` holds
    Lesson 4's control word for word (`kit/move-do.ts:26-49`, `:51-63`): four semitones each way,
    the two buttons and their disabled ends, and Lessons 4, 6 and 8 use it, as this page will.
11. The four-words strip: built, promoted from Lesson 1's page (`lesson-01/words.ts`) into
    `kit/words-strip.ts` with Lesson 7's page; Lesson 6's page (PR #1149) keeps its own in
    `lesson-06/words.ts`.
12. `kit/merc-duo.ts`: `mercHop`, proposed (Merc and Tavi).
13. `src/e2e/helpers/tone-wav.ts`: proposed `writeStepsWav(steps, leadSilence)`, steady tones in
    sequence after a stretch of silence, beside `writeToneWav` (`:76`), for the end-to-end ladder
    test (Tests, end to end 6).
14. App: the `intervals` launch field and a minor third for `/exercises/leap-ladder`, the optional
    Arpeggio Jumper slug, the App content item, and the Ascent week 4 rewrite (Practice links).

Lesson 6's page (PR #1149) also brings kit parts this page does not use: the ear game
(`kit/ear-game.ts`), the tune line (`kit/tune-line.ts`, with its layout, drawing and motion modules)
and the slide guide's `breaths`. The ladder is sung on one breath and read on the band chart.

Already on main, so this page needs nothing more from them: run-time publishing (`kit/publish.ts`,
`kit/page-state.ts`, `src/lesson-gate.ts`), which settles the page's chips, its recall's step links
and its next card for the state it is served with; the kit's stage fit (`kit/stage-fit.ts`), the
lesson menu and the remembered steps (`kit/lesson-menu.ts`, `kit/position.ts`), the generated
next-lesson card with the next lesson's tease (`kit/next-card.ts`, its copy from
`kit/lesson-copy.ts`), the step deck that opens at a step an address names (`kit/step-deck.ts`),
Watch only with a published film (`kit/season.ts:23-25`), learner-only explorer cards, the kit's
spelling of a major key (`majorScale`, `kit/major-scale.ts:24-45`, which makes the draft's proposed
`keyLetter` unnecessary), the warm-up (`kit/warm-up.ts`) and the folds (`kit/folds.ts`). Released
lessons need no edit when this page goes live, since every lesson page draws the season as its state
shows it (`kit/page-state.ts:54-57`).

## Edge cases

What the page does where nothing above says:

- **No stored voice**: the steps' chart shows the lower voice; Sing it asks after the comfort check,
  before anything plays. A `fyp-voice` holding anything but the two stored values counts as none and
  is overwritten only by a choice.
- **No storage** (blocked, private mode, or a read that throws): every read and write is inside
  try/catch; the page works, asking the voice each visit, reseeding the quizzes and forgetting the
  warm-up's Skip.
- **Sound off**: each play button draws what it would play and shows the kit's hint; the cold open's
  reveal waits for all three paths to be heard with sound on (Toys 2); Start and Play Merc's ladder
  show state 5's hint and ask for no microphone.
- **No Web Audio**: every play button draws in silence with the hint "This browser can't play sound
  here.", so the cold open's reveal cannot come, as on every page that uses the kit's predict; Sing
  it offers the listen-only path of state 9 at once, with no Start; the Wrap keeps the practice
  card.
- **No microphone, a refusal, or a listener that fails to load**: state 9 of Toys 4.
- **The tab hidden, or the section left, during a take**: the take is abandoned and the microphone
  released; no reading and no feeling question follow; the take counts towards the three, and uses
  the one Again up if it had voice (Toys 4, the retry rules).
- **A singer who moves on early or late**: the slots run from the first voiced frame, so a ladder
  sung a little fast or slow still reads each note from the middle of its slot, after the attack;
  one sung much faster or slower reads the note it held in each slot, which may be "nearer a
  different note". The line describes the sound (REQ-GVC-045) and the chart shows the line against
  the bands, so the viewer can see why.
- **One note held for the whole ladder**: each slot reads against its own rung, so a steady A3 on
  the lower full ladder reads do and the top do "About five semitones below", mi "About three
  semitones above" and so "Right in the middle": "This time, 1 of your 4 notes landed in the band."
  (Tests).
- **A note sung an octave away**: it counts, with the octave line, on any rung (FACTS 80); the live
  line shows it folded around the rung with its tag.
- **A voice outside the window**: the line pins to the edge with an arrow; the readings come from
  the frames, and the window does not move.
- **Octave jumps from the detector**: Voice Mirror's `preprocess` and the slot's median keep a short
  jump from deciding a reading (`readTake`).
- **Three takes used**: Again is gone and Start does not come back; Done for today remains.
- **Move do at an end**: that button is disabled, as Lesson 4's is, and the chart's summary says
  where do is.
- **A visitor who types the printed address** (`mercurypitch.com/pitch-training`, without the
  marker) on a first visit meets First Light, whose way out on its first beat is the × labelled
  "Skip the intro"; the page prints no line for it, since its links carry the marker (FACTS 56).
- **No WebGL, or a slow device**: Merc and Tavi's stills (`kit/merc-warm.ts`).
- **Lesson 6 never marked done**: the recall still shows, as a prerequisite's does.
- **Lesson 9 published while Lesson 3 or 6 is held back**: nothing stops it. The console asks first,
  but the publish order is a rule for whoever uses it (the intro), so the page follows the state it
  is served with. The site worker, and then the masthead's `followPageState`, make every link to a
  lesson that
  is not live no link (`src/lesson-gate.ts:523-533`, `:547-567`; `kit/page-state.ts:64-108`, called
  by `initMasthead`, `kit/page-chrome.ts:126`): the "After Lesson 3" or "After Lesson 6" chip stays
  as a plain chip, and any other link keeps its words. The kit's quiz does the same for the recall's
  step links, which keep their words, "Try Lesson 6, Step 5 again", with no link
  (`kit/quiz.ts:186-216`). The recall still shows, and the explorer and the lesson menu draw the
  lesson held back as coming later. End to end 13 holds it.
- **Reduced motion**: Look, Toys 1 and Toys 4 give the end states; nothing moves on its own.

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-09/` and the new kit
parts:

1. The ladders: the full and smaller ladders' notes from do D3 and D4 equal FACTS 20 and 90, their
   intervals 4, 3, 7, 5 and 12, and both sit inside every preset of their voice with at least two
   semitones to spare, checked against `VOCAL_RANGES` imported from `src/stores/settings-store.ts`
   (FACTS 73).
2. Spelling: at every Move do position, for both voices, the rungs equal `majorScale(do)` at degrees
   1, 3, 5 and 8, with no double sign and no E♯, B♯, C♭ or F♭; from D they read D, F♯, A, D; every
   accessible name says "sharp" or "flat" and holds no sign (FACTS 22).
3. Move do: four each way and no further, each end's button disabled; from each preset's middle
   half's bottom the full ladder fills that middle half exactly within the four (FACTS 75).
4. The sounds and drawings: the cold open's three paths are do, re, so; do, mi, so; and do, fa, so
   (FACTS 91); Step 1's ratios read 1.12 and 1.50 (FACTS 30); Step 4's five leaps come in the
   syllabus's order, mi to so, do to mi, do to so, so to the top do and do to the top do, 12.4 s at
   speed and 24.8 s slowed (FACTS 93); Step 5's illustrated trace lands 80 cents under so and
   settles 25 cents under, and its readouts at those points are "outside the band; nearest note G
   sharp 3" and "in the band; nearest note A3" (FACTS 94); every window holds every note its state
   plays.
5. The band chart with rungs: a scene with one rung at 0 paints exactly as today's single band
   (Lessons 3 and 5 unchanged); rungs over slots and across the plot, arcs, and the rung-names
   option land where their times and cents say.
6. The ladder reader, on synthetic frames at the detector's 16 ms hop (`DEFAULT_HOP_SEC`,
   `src/lib/pitch-measurements/f0.ts:35`): D3, F♯3, A3 and D4 for 1.5 s each read four "Right in the
   middle" lines and "This time, 4 of your 4 notes landed in the band."; each 30 cents flat reads
   four "In the band: 30 cents below Merc's note." lines; a steady A3 for 6.0 s reads do and the top
   do "About five semitones below, nearer a different note.", mi "About three semitones above,
   nearer a different note." and so "Right in the middle: on Merc's note.", and "This time, 1 of
   your 4 notes landed in the band."; the top do sung as D3 reads "Top do · Right in the middle: on
   Merc's note. You sang it an octave lower: same note." and counts as landed; a slot with 0.4 s of
   voice reads "We didn't hear a steady note there." and is left out of the count ("… of the 3 notes
   we heard …"); no voice gives `{ heard: false }`; a ladder sung 0.3 s late in every note still
   reads each rung, the attack trim taking the move; the smaller ladder reads five slots with "Mi
   again" and "Do again"; no line holds "Listen again" or "Try again".
7. The Sing it flow (`lesson-09/ladder-flow.ts`, Toys 4): with no stored voice the voice choice
   comes before either path, and a stored voice starts pressed and can be changed; "Just listen
   today" shows its line and the doctor lines at once, beside the voice choice, shows no Start and
   picks the rest card; with sound off Start, Start again and Again ask for nothing and show the
   hint naming the button, and sound turned off while Merc sings ends the take uncounted, the card
   back as it was; without Web Audio, Sing it is listen-only with no Start; a take with no voice
   brings no feeling question and offers Start again while fewer than three takes have been made,
   leaving the visit's one Again unused, and after the last take its line drops its cue; "Easy" and
   "Workable" offer Again once a visit, and after the full ladder Again smaller too, either using it
   up; after a smaller ladder the full ladder's button is gone; an abandoned take counts, and uses
   the one Again up if it had voice; a walk over every sequence of take outcomes, ladder choices and
   answers never reaches a fourth take or a third sung ladder, never offers the full ladder after a
   sung smaller one, and never shows Again after "Effortful" or "Uncomfortable", and at every step
   offers what the step asks for: the feeling question after a sung ladder, Start again or Start
   while takes remain, Again after "Easy" or "Workable" while the one Again is unused, and Merc's
   one celebration where it was earned; "Effortful" and "Uncomfortable" end the singing for the
   visit and pick the rest card; "Uncomfortable" takes the lines and the count away; the feelings
   lock once answered and free again only for the next take; nothing is written to storage but
   `fyp-voice` and `fyp-l09-warmup`.
8. Copy: every line of LESSON.md's page copy and every template in Toys 1, 2 and 4 passes
   `validateGuidedDynamicClaim` (surface `finding`); no quiz feedback line starts with "Right",
   "Yes" or "Correct"; no accessible name or live text holds a ♯ or ♭ sign; and no two controls on a
   stage share an accessible name.
9. Every fixed sound's frequency equals `hz(m)` for the notes of FACTS 90, and the illustrations'
   points equal FACTS 94's and 98's.
10. The predict: the choice locks on the first press; before it only Play Merc's leap plays; after
    it, the reveal stays hidden until "re", "mi" and "fa" have each been heard with sound on, in any
    order, and a silent play shows the `silent` hint; the reveal's line for mi is "You said: mi",
    and no hint or line holds "right" or "wrong" (FACTS 11).
11. Quizzes: the recall's ids are `l06-q2` and `l06-q3`, it takes no `lesson`, and its two step
    links are `/learn/06#step-5` and `/learn/06#step-2`; the quick check's ids are `l09-q1` to
    `l09-q4`, with `lesson: 9`.
12. Season data: Lesson 9's entry has `minutes: 16` and `page: '/learn/09'` in every build,
    whichever way `VITE_DRAFT_LESSONS` reads, as `season.test.ts` checks Lessons 3 to 5's
    (`:241-266`), and the same file's check of every page in the repository then covers it
    (`:302-319`); `seasonFor(LESSONS, defaultPageState(false))` gives Lesson 9 no page and no
    reading time while its line is in `drafts.ts`, and `seasonFor(LESSONS, defaultPageState(true))`
    keeps both, as `publish.test.ts` checks a lesson held back and one published (`:58-110`). That
    file's example of a lesson with no page is found, not named: the first lesson the season has
    with none (`:45-56`, through `lessonWithNoPage` in `kit/season.test-fixtures.ts:22-36`), so
    this page's arrival does not break it. Lesson 9's practise link carries `?lesson=09`, and
    `EDGES` holds [3, 9] and [6, 9].
13. The kit's new option (What the kit and the app still need, 8):
    `afterFeeling('effortful', { restAfterEffort: true })` is today's answer to "Effortful" with
    `rest: true`, so the count and the gentle line stay, with no Again and no doctor lines; every
    other answer with the option, and all four without it, give what `afterFeeling(f)` gives today
    (`kit/comfort.ts:56-87`), so Lessons 3 and 5 see no change.
14. One sound at a time, and leaving a step (Audio), with fake timers and a spy on the kit's sound:
    starting any source while another sounds stops the first (a Four words play over Step 3's climb;
    a free-play rung over the recall's notes); with Step 4's five leaps sounding, a step change by
    each route, Previous, Next, a swipe, the lesson menu's jump, a `#step-N` address and a
    quick-check step link, stops them, and running the clock past their end starts no note; a layout
    switch, `onStep` with the same step, stops nothing.
15. A play cut short never counts as heard (Audio; Toys 2): the cold open's `play` resolves `false`
    when its path is stopped before its end, by another sound or a stop, and never when the path
    runs out; with re and mi heard, fa cut short leaves the reveal hidden, and fa played to its end
    shows it, as PR #1149's fix pass tests a stopped run in the kit.

End to end (Playwright, at 390 x 844 and 1440 x 900, on the e2e build, which shows drafts):

1. No AudioContext before the first tap; nothing plays before a play button.
2. Cold open: Play Merc's leap plays before a choice; the three plays stay disabled until a choice;
   the reveal appears only after all three paths have played with sound on; with sound off, the hint
   shows and no reveal comes; and a path cut short, by the Four words' Leap played over it, brings
   no reveal until it plays to its end (unit test 15).
3. The chart by keyboard alone: Tab reaches every control; the scrub bar moves by arrows, and Home
   and End jump; Slow, Hear it first and the voice switch toggle `aria-pressed`; free play's rungs
   play and announce their leaps; every announcement uses spoken names.
4. At 390 x 844 and at 344 px wide, every target measures at least 44 x 44 px, none overlap and
   nothing scrolls sideways.
5. The stage fits short landscape screens: `src/e2e/learn-stage-fit.spec.ts` holds this page to it
   once it is built, as it holds every lesson page, all of which every build carries (`:31-32`), at
   1024 x 640, 1133 x 631, 1280 x 680 and 1366 x 657 and on a phone held sideways (FACTS 97);
   `src/e2e/learn-no-planning-text.spec.ts` reads it for the team's planning words and every
   variant's note the same way, and `src/e2e/learn-cold-open-fold.spec.ts` holds its title on the
   first screen at seven sizes and reports where Play Merc's leap and the three choices sit
   (`:176-203`).
6. Sing it, with the fake microphone (`src/e2e/helpers/tone-wav.ts`, `fakeMicArgs`, `:198`): with
   sound off, Start asks for no microphone and the hint says sound is off; with sound on, a steady
   A3 (`writeToneWav(220)`) on the lower full ladder reads so "Right in the middle" and the other
   three far from their bands, with "This time, 1 of your 4 notes landed in the band." and the
   tricky line; "Easy" offers Again and Again smaller, and after a second take neither shows. A
   steady D3 reads the top do with "You sang it an octave lower: same note." Proposed, with
   `writeStepsWav`: D3, F♯3, A3 and D4 at 1.5 s each, after 8 s of silence so that they start after
   Merc's ladder and inside the take's 6 s wait, read "This time, 4 of your 4 notes landed in the
   band."; if the fake device's start cannot be pinned that way, the unit tests carry the per-note
   readings. "Effortful" shows the gentle line, no Again, the feelings locked, and the rest card in
   the Wrap. "Uncomfortable" shows the doctor lines, no Again, no lines and no count, and the rest
   card. "Just listen today" never calls `navigator.mediaDevices.getUserMedia` (a spy), shows the
   doctor lines and leaves the rest card. A refused permission shows the no-microphone line and
   keeps the practice card.
7. The microphone's tracks stop at the end of each take, on leaving the section and when the tab is
   hidden (a spy on `MediaStreamTrack.stop`).
8. The recall shows with an empty `fyp-done`, and answering both its questions marks nothing done;
   its step links are `<a href="/learn/06#step-5" target="_blank">` and
   `<a href="/learn/06#step-2" target="_blank">`; answering all four quick-check questions marks
   Lesson 9 done in the explorer; each feedback line starts "Right." or "Not quite.".
9. Every practice link carries `?lesson=09`; opening `/pitch-training?lesson=09` in a fresh profile
   shows the Exercises tab and no intro, as `src/e2e/lesson-marker.spec.ts:66-75` does for Lesson
   4's link.
10. The Wrap's next card names Lesson 10, says "Coming later" and leads to the map, never to a page,
    as `src/e2e/learn-next-card.spec.ts` checks a card for a lesson not written yet; its tease,
    Lesson 10's line, sits one line above the hook, the card's words in the order eyebrow, tease,
    hook and way on, as that spec checks Lesson 1's card (`:117-134`).
11. With reduced motion emulated, an arc and a trace draw at once, the guide's bands light in place,
    and nothing moves on its own.
12. After a full run, storage holds only the keys in the Contract.
13. Published out of order (Edge cases), built like `src/e2e/learn-publish-state.spec.ts`, whose
    `serveWith` writes a state into the page's head as the site worker does (`:31-60`). Served by
    `serveWith(page, '/learn/09', state)` with the state
    `{ drafts: false, lessons: { 9: { published: true }, 6: { published: false } } }`, the page
    keeps "After Lesson 6" as a plain chip (`ul.meta .chip` with that text counts 1 and has no
    `href`) and links `/learn/06` nowhere (`a[href^="/learn/06"]` counts 0), as that spec checks
    Lesson 4's chip for Lesson 2 (`:106-126`); the recall's answer "5 semitones: a perfect fourth"
    shows "Try Lesson 6, Step 5 again" in its feedback with no link; and Lesson 3, a draft the state
    does not set, takes the default of a site that holds drafts back, so its chip is plain too and
    nothing links `/learn/03`.

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=09`. Then the layout, accessibility, sound, motion and storage
rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children, touch
targets of at least 44 px with no two tap zones overlapping, visible focus, a single dark theme with
every colour a token and an explicit body background, sound only after a tap, localStorage only for
per-viewer conveniences inside try/catch, and the whole page usable with no sound, no WebGL, no
storage and no microphone. Every ♯ and ♭ the page prints in text (the rung names, the readouts, the
chart's summary) has a spoken name, as Lesson 2's contract sets: the sign is `aria-hidden` and a
visually hidden word follows it (`nameHtml`, `signsHtml`, `kit/notes.ts:204-227`), so a screen
reader says "F sharp"; the figures' accessible names and every live region use words only. The page
stores the quiz seeds and records (`fyp-l09-recall-seed`, `fyp-l09-recall-v1`, `fyp-l09-seed`,
`fyp-l09-quiz-v1`), `fyp-done` (`kit/progress.ts:12`), `fyp-voice` (`kit/voice-choice.ts:20`), the
warm-up's Skip (`fyp-l09-warmup`), the masthead's Pause animations choice, `fyp-motion`
(`kit/motion-switch.ts:12`); through the kit, as every lesson page does, the steps the viewer
reached, `fyp-pos` (`kit/position.ts:20`), and its record of the welcome tour, `fyp-tour`
(`kit/tour-gate.ts:29`); and nothing from the take: no note, no reading, no count, no answer to "How
did that feel?" and no ending.

Page QA before publishing (PRODUCTION-PIPELINE § 5) adds, for this page:

- The vocal coach has signed the page off, and Lessons 3 and 6 are live on the site it is published
  to: the console asks about both, but publishes on "Publish anyway" (the intro).
- The microphone is requested only by Start; "Just listen today", sound off and a refused permission
  never open it; the browser's microphone indicator goes off at the end of each take, on leaving the
  section and when the tab is hidden.
- The network panel shows nothing sent while the microphone is open, and storage holds nothing but
  the keys above.
- The whole page, Sing it included, runs by keyboard alone, and a screen reader hears every state
  and reading, in spoken names.
- No reading line invites another try, and no visit reaches a fourth take, a third sung ladder, or
  the full ladder after a sung smaller one.
- With reduced motion emulated, nothing moves on its own and the live line draws on a still frame.
- The Wrap shows the rest card after "Effortful", "Uncomfortable" and "Just listen today", and the
  practice card otherwise; neither carries a first-visit line, and the practice link opens the
  Exercises tab with no intro.
- Every step stage fits the four short landscape screens with the masthead (End to end 5), and the
  app-check sweep (`.claude/skills/app-check`) passes at phone and desktop width with Sing it open
  in each state, run locally or on dev, never against production.
