# Lesson 11 web page: spec

The Lesson 11 page is the web lesson for "Registers and the break": written steps, one main toy in
six states, one predict, a sung checkpoint of one slow siren that listens and reads nothing, two
quizzes (the recall and the quick check) and the lesson explorer. Copy is in [LESSON.md](LESSON.md);
every claim is in [FACTS.md](FACTS.md). It is a text-only package: no film exists for Lesson 11, so
the page has no Watch section and the masthead's anchors are Lesson, Sing and Explorer. It is built
on the kit (`src/features/lessons/kit/`) and, like Lessons 2 to 10, it reuses and never copies: a
part that still lives in an earlier lesson's module, or that an earlier lesson's spec plans to
promote, moves into the kit first. Where this page shares a behaviour with Lesson 3's checkpoint
(the comfort check, the warm-up, the voice choice, "How did that feel?" and the rest card), it is
Lesson 3's, unchanged unless this spec says otherwise, and after "Effortful" it follows Lessons 6,
7 and 9: no further try, and the rest card in the Wrap. Its sung checkpoint is Lesson 7's siren
take with the reading left out.

One object carries the lesson across its steps: the range chart (Toys 1), Lesson 7's, with Merc's
line drawn in two gears and a seam between them. Merc's siren crosses the seam in the cold open; one
note in each gear, the slowed slide, the three model slides, the five two-note slides and the figure
both ways are each a state of it; at the checkpoint the viewer's own siren is drawn on it, with
nothing marked; and in the Wrap its states are free play. Motion principle 2, "One object carries
the story across shots and keeps its identity" (`research/brand-motion.md:667`), and playbook rule 6
ask for it, and the CURRICULUM's signature is its moment: "the siren's line crossing a shaded seam,
with the seam narrowing over repetitions" (FACTS 6). The app detects no register (FACTS 27), so the
seam is drawn on Merc's model only, labelled a model, and never on the viewer's line.

Its public home is `mercurypitch.com/learn/11` (MASTER-PLAN § 12 item 9): a hand-written document,
`learn/11.html`, with its module in `src/features/lessons/lesson-11/`, wired as Lesson 3's page is.
Every build carries it, as every build carries every lesson page, and it is a draft, with a line in
`kit/drafts.ts`: the dev site and every PR preview serve it, and on mercurypitch.com the site worker
answers its address with the 404 page until the admin console publishes it, at run time and with no
release (FACTS 9, 48). Whoever publishes it waits for two things: the vocal coach's sign-off, the
hard gate, because it is a voice lesson (MASTER-PLAN § 7, days 1 and 6; § 12 item 8); and Lesson
7's page live at `/learn/07`, because its prerequisite chip and its recall check link there (FACTS
2, 4, 9). Those are rules for whoever uses the console, and nothing enforces them: the console asks
before it publishes a draft that waits on a sign-off, then publishes it if told to, and nothing
checks the lessons a page links. A page published early still works, with a plain chip and unlinked
step links where its links to Lesson 7 would be (Edge cases). It is built after Lesson 7's page,
whose range chart, siren take and quiz questions it reuses, and with the hook this package gives it,
since its title must be the season's (FACTS 1). It opens in Lesson 2's order, the cold open straight
under the title and the recall after it, as MASTER-PLAN § 4.2 now has every page open (§ 12 item
13; FACTS 3), and its copy follows the plain-language review's patterns. "What the kit and the app
still need", below, lists the wiring and every kit change.

## Look

Lessons 1 to 10's look, unchanged: the dark listening room, the series colour code, Lesson 1's type
and wordmark, and the motion rules. On this page:

- The range chart is a pitch canvas, so it takes the app's canvas set (FACTS 84; MASTER-PLAN § 5):
  Merc's line is target amber `#f59e0b`, and the viewer's line singer violet `#a78bfa`. Violet
  means the singer only. There is no in-tune mint and no off rose: nothing on this page is in tune
  or out of it, and nothing on it is a fault.
- Merc's two gears are two widths of the one amber line, 6 px in the lower gear and 2 px in the
  upper. Through a crossfade the width follows the lower gear's share of the sound (Audio), so a
  blended note is drawn between the two. The width is a drawing convention for the folds'
  thickness, never a loudness (FACTS 84), and a key in words says so wherever the gears are drawn:
  "Thick line: lower gear. Thin line: upper gear." The viewer's line has one width, 3 px, always.
- The seam is chrome `#c3ccd6` at low opacity with a fine diagonal hatch, never red or rose: a
  switch is not a fault (FACTS 84). It spans the pitches Merc's line jumps across, and is never
  drawn under 2 px tall. Its label is a word: "Merc's model" until the cold open's reveal, "the
  switch" after it. Every state that draws Merc's gears also carries the caption "Merc's model" at
  the plot's top right (FACTS 86), so the model is named wherever it is drawn.
- Gold `#ffd84d`, which means "the fit", is not used.

Two things move on their own: the Merc idle loops. Under `prefers-reduced-motion` they stop, and
every transition this page adds lands in its end state with no travel: a line draws whole at once,
the stretch gauge shows its end, and the take's ring holds still. What the viewer starts still
sounds. For everyone else the masthead's Pause animations toggle stops the same two (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) in Lesson 2's order, with Lessons 2 to 10's departures kept:
the step toys double as the Playground, unlocked in the Wrap; the mix-up card sits in the step whose
toy refutes it; the practice card sits in the Wrap. No Watch section (§ 4.2 item 10). Each
section's heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 1's (wordmark, "Season 1 · Lesson 11", anchors Lesson, Sing and Explorer,
   the Sound toggle off by default, Pause animations with its reduced-motion lock), through
   `initMasthead(sections, { lesson: 11, deck })` (`kit/page-chrome.ts:109-140`): before anything
   else the page's links to other lessons follow the state it was served with (`followPageState`,
   `:113`; `kit/page-state.ts:64-108`; Edge cases), then "Season 1 · Lesson 11" opens the lesson
   menu (`kit/lesson-menu.ts`), and the page's steps are remembered as the viewer moves through
   them (`kit/position.ts`).
2. **Hero**, laid out as Lesson 2's is (`learn/02.html:320-493`). The hero copy holds the kicker;
   the hook question as the title, `<h1 class="hook" id="hook">` in its default wording, the
   season's, which `src/features/lessons/kit/lesson-copy.test.ts` holds every page's title to
   (`:325-334`), with no variant's team note anywhere in the markup (`src/features/lessons/kit/team-notes.test.ts:85-101`; FACTS 1), and the
   element the site worker writes a picked hook into (`src/lesson-gate.ts:582-583`); the meta as
   four chips ("16 minutes", FACTS 5; "After Lesson 7: Slides, sirens and your range", a link to
   `/learn/07`, wholly the link, as Lesson 2's `a.chip.chip-link` is, `learn/02.html:339-344`, so
   that it stays as a plain chip where Lesson 7 is not live; Sound on; Microphone optional); the
   promise; and the sound gate from LESSON.md. Beside it, the stage: the bubbles, orange's "My voice
   just flipped. Did I do it wrong?" and blue's "Let's slide again and listen.", and the two Mercs
   on the floor line either side of the range chart in its compact state, whose still before any
   play is orange Merc's siren drawn whole, thick, then thin across the seam labelled "Merc's
   model": the signature. Under the stage, the cold open's predict card (Toys 2). On a phone
   (390 x 844) the title and the opening's first control, Play orange Merc's siren, and the two
   choices belong on the first screen, and on a tablet in landscape (1024 x 640) the stage and the
   choices too (CURIOSITY-MOMENTS § 3.1, "Above the fold",
   `docs/plans/find-your-pitch/CURIOSITY-MOMENTS.md:288-290`). Of the plan's levers, the recall's
   place is already used, since it follows the predict; the others are the Mercs' size (`--merc`,
   `kit/lesson-stage.css:193`) and the hook's length, and this hook is a short one.
   `src/e2e/learn-cold-open-fold.spec.ts` holds the title on the first screen at its seven sizes and
   reports where the first control and the choices sit (End to end 5).
3. **Recall from Lesson 7**: Lesson 7's questions 1 and 4, for everyone (Toys 5).
4. **Four words you'll meet**: register, chest voice, head voice or falsetto, and flip, each with
   its definition, a small figure and a play button (Toys 3).
5. **The steps**: Lesson 1's sticky stage and step deck ("N of 5", Previous and Next), every step
   on the one range chart (`toyFor: () => 1`, `kit/step-deck.ts:49-54`), in five states (Toys 1):
   1. What changes when a voice flips? One note in each gear; the Go deeper drawer.
   2. Why does a slide flip? Merc's slide, slowed, with the stretch gauge; the mix-up card.
   3. Why only sometimes? Three model slides up; the Go deeper drawer.
   4. Can a flip get smoother? Five slow two-note slides across a narrowing seam: the signature.
   5. What do other singers do with a flip? A short figure, flipped on purpose and with the switch
      hidden.
6. **Sing it**: the comfort check, the voice choice, the warm-up, Merc's slow siren, the briefing,
   one take and the feeling question (Toys 4). It departs from MASTER-PLAN § 4.2 item 7 as Lesson
   7's does: there is no target band and no cents window, because the siren asks for no note and
   the house rules never score a hum or reward a wide range. It goes one step further than Lesson 7
   and reads nothing, not even Lesson 7's middle half, because the app cannot tell a gear and the
   page must mark no flip on the viewer's line (FACTS 27, 64).
7. **Quick check**: LESSON.md's four questions (Toys 5).
8. **Wrap**: the three recap lines, the challenge, the practice card in the version Sing it's ending
   picks, free play, and the kit's next-lesson card (`createNextCard(11)`,
   `kit/next-card.ts:181-210`, drawn before `createExplorer`, `:27-30`). The card is Lesson 12's,
   its words the kit's: the eyebrow with the number, the title and the state, then the tease, "Four
   chords, round and round.", one line above the hook as `.next-tease`, the hook as `.q2` and the
   way on (`:130-146`; FACTS 7), "Coming later" and "See it on the map" until Lesson 12's page is
   live. Its hook and tease are the ones the admin console picked, the defaults until it picks
   (`:14-20`), since the card reads the season as the page's state shows it (`:185`). The tease's
   figure is a still of the four chords as four rooms on the spiral, and it puts no tune note on
   the ring at all: it lights no corner, draws no bead on a room and draws no path from bead to
   bead, since a tune drawn bead to bead shows which of its notes sit on a chord's corners, which
   is Lesson 12's predict. It may show the four rooms; any tune it shows stays off the ring. That
   is Lesson 12's rule for this still (Lesson 12's WEB-SPEC, Decisions for the owner, item 13;
   Lesson 12's FACTS 5b; FACTS 7). The still sits in the page's `[data-next-card]` mark, whose
   children the kit keeps in the card after its words (`:27-29`, `:184`, `:205`), as Lesson 2's
   figures are (`learn/02.html:1798`). The card is a link, so the figure holds no button. The
   practice card is the Siren card, with "Ten minutes, gently, most days" under it; after
   "Effortful", "Uncomfortable" or "Just listen today" it is the rest card instead, without that
   line (Toys 4). Its address links `/pitch-training?lesson=11` in a new tab. Free play unlocks
   here: the chart's five step states on one stage (playbook rule 17).
9. **Lesson explorer**: the kit's, with Lesson 11 as the current node and the line under its
   heading from LESSON.md; its card shows what `kit/lesson-state.ts` says of a live lesson, and no
   Watch button, since Lesson 11 has no published film (`kit/season.ts:23-25`).
10. **Footer**: Lesson 1's, with "Season 1 · Lesson 11 · Registers and the break"; the practice
    link, printed `mercurypitch.com/pitch-training` and linking `/pitch-training?lesson=11`, with
    "The Siren exercise is free." (FACTS 43); Lesson 1's fonts line and "Every sound on this page is
    synthesised in your browser." (FACTS 85); no first-visit line, because the link carries the
    marker (FACTS 43).

## Length

The learner copy is 2,286 words by the review's count (FACTS 5), 93 under the series' cap of 2,379.
The page runs about 16 minutes: 9.61 minutes of reading at 238 words a minute and about 6.5 of
sound, toys and tasks, 16.1 in all. That is past MASTER-PLAN § 4.2's 8 to 12 minutes of active
time, as Lessons 3, 5, 6, 7 and 9 are (15, 17, 15, 16 and 16 minutes), and acceptable by their
precedent. Each step's text, with its Try and its Notice, runs 93 to 116 words (Steps 1 to 5: 116,
107, 114, 93 and 114), inside § 4.2's 50 to 120 a step. Three steps carry more beside it:

- **Step 1, about 160 words.** Its one-item Go deeper drawer (about 45 words) names the two gears
  singing seldom uses, and is closed by default.
- **Step 2, about 180 words.** Its mix-up card (about 70 words) sits in the step whose toy refutes
  it, as in Lessons 2 to 10.
- **Step 3, about 160 words.** Its one-item Go deeper drawer (about 45 words) gives the lab finding
  that up and down differ, and is closed by default.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                                                       | New in Lesson 11                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1. The range chart        | Lesson 7's range chart (`kit/range-chart.ts`, its Toys 1 and its needs 3: pitch as height, the canvas colours, the gutter, a window per voice group, a line drawn as it sounds, the live line and its edge pins); the kit's sound and notes (`kit/sound.ts`, `kit/notes.ts`) | Merc's line in two gears; the seam and its label; slots; the stretch gauge; six states; the gear model's sound |
| 2. Predict widget         | The kit's predict as it is (`kit/predict.ts`), with two choices, a free play and a reveal after one play                                                                                                                                                                     | Two sirens, each drawn as it sounds; the seam's label at the reveal                                            |
| 3. Four words             | Lesson 1's strip of figure, word, definition and button (`lesson-01/words.ts`), promoted into the kit if no earlier page has                                                                                                                                                 | Four new figures                                                                                               |
| 4. Sing it                | Lesson 3's checkpoint (`kit/comfort.ts`, `kit/listen.ts`, `kit/voice-choice.ts` on `fyp-voice`, `kit/warm-up.ts`, the feeling question, the rest card); Lesson 7's siren take, its ring and its flow rule; Lessons 6, 7 and 9's rest card after "Effortful"                  | No reading; Merc's siren in one gear; a take that needs two seconds of voice before it ends on a quiet         |
| 5. Recall and quick check | The kit's quiz as it stands (`kit/quiz.ts`: an id `prefix`, question ids, an optional `lesson` and links away)                                                                                                                                                               | Ids and keys                                                                                                   |
| 6. Go deeper drawers      | Lesson 2's `details` drawer                                                                                                                                                                                                                                                  | Two drawers                                                                                                    |

### 1. The range chart

One component, Lesson 7's `kit/range-chart.ts`, in six states, compact, gears, slide, three slides,
smoother and styles, plus free play, and live mode at the checkpoint (Toys 4). This page adds four
options to it, each off by default so that Lesson 7's chart is unchanged: Merc's line in two gears,
the seam, slots, and the stretch gauge (What the kit and the app still need, 5). It leaves out
Lesson 7's column and its lit middle half.

- **Drawing.** Pitch is height (playbook rule 20): one faint row per semitone with a tick, set
  bottom to top, and Lesson 7's 34 px gutter on the left naming the C and A rows in the app's sharp
  spelling ("C3", "A3"); no other row is named. Time runs left to right. Merc's line is drawn left
  to right as it sounds, its head glowing, and stays drawn when it ends. Merc's line takes the
  gear's width at every moment (Look): its points carry the lower gear's share of the sound, from 1
  (all lower gear, 6 px) to 0 (all upper gear, 2 px). A seam is a band from the pitch Merc's line
  jumps from to the pitch it jumps to, across the plot or across its slot, drawn at that height but
  never under 2 px (centred on the jump where the floor applies). The key, "Thick line: lower gear.
  Thin line: upper gear.", sits under the plot in every state that draws the gears, and the caption
  "Merc's model" at its top right. The chart's spoken summary (`describe`) names what it shows in
  words, never the sign: "Merc's model: orange Merc's siren, from D 4 up to B 4 and back, jumping
  across a seam between F 4 and G 4".
- **Windows.** Every state but live: C3 to E5, 28 semitones, for either voice, so a change of voice
  moves the lines and never the axis; it holds every sound the steps and the cold open play, from
  E3 to B4, with 4 semitones to spare below and 5 above (FACTS 73 to 80). Live: Lesson 7's windows,
  E2 to C5 for the lower voice and F3 to C6 for the higher, which hold every preset of each group
  (FACTS 83).
- **The voice.** `fyp-voice` if stored, else the lower: blue Merc sings the lower voice's lines and
  orange Merc the higher's (FACTS 76 to 81), and the chart follows a change made in Sing it
  (`VoiceChoice.subscribe`, `kit/voice-choice.ts:30-47`). The steps carry no voice switch; free play
  does (below). The cold open plays both voices, whatever is stored.
- **Compact** (hero and cold open): the steps' window, with no row names and no controls on the
  chart. Its still before any play is orange Merc's siren drawn whole, D4 up to B4 and back, thick,
  then thin above the seam from F4 to G4, then thick again below it, the seam labelled "Merc's
  model". Play orange Merc's siren (Toys 2) clears the line and draws it again as it sounds (FACTS
  75). After the choice, Play blue Merc's siren draws blue's siren under it, E3 up to C♯4 and back,
  with its own seam from G3 to A3, also labelled "Merc's model"; both lines and both seams then
  stay. At the reveal each seam's label changes to "the switch", and the key appears under the plot.
  The drawing is `aria-hidden`, and a polite live region speaks for it: before any play, "Merc's
  model: a siren's line that jumps across a grey seam"; after orange's play, "Orange Merc's siren,
  from D 4 up to B 4 and back. The line jumps across the seam between F 4 and G 4 on the way up, and
  back on the way down."; after blue's, "Blue Merc's siren, from E 3 up to C sharp 4 and back,
  jumping across its seam between G 3 and A 3."; after the reveal, "Each seam is now labelled the
  switch."
- **Gears** (Step 1): no seam. **Lower gear** plays G♯3 (or F♯4) for 2.0 s in the lower gear and
  draws it as a short thick line in the plot's left half; **Upper gear** plays the same note in the
  upper gear and draws it as a thin line at the same height in the right half (FACTS 76). Each line
  stays once drawn, so the two sit side by side at one height: the step's Notice. The live region:
  "Lower gear: G sharp 3, drawn thick." and "Upper gear: G sharp 3, the same height, drawn thin."
- **Slide** (Step 2): Merc's slide, the cold open's up half in the chosen voice, E3 to C♯4 with the
  jump from G3 to A3 (or D4 to B4, F4 to G4), with its seam across the plot labelled "the switch".
  Under the canvas, on a row of its own, the stretch gauge: a horizontal bar labelled "stretch",
  with "less" and "more" at its ends and no numbers, that fills evenly through the slide's time,
  from a tenth at its start to full at its end, while the line beside it jumps at the seam (FACTS
  77, 84). **Play** (Pause while playing), **Slow** (`aria-pressed`, pressed at first in this state,
  since the step's Try asks for it: every length doubles, the jump's included, and the pitches never
  change, so the slide takes 8.0 s and its jump 0.08 s) and a **scrub** bar, as every animation has
  (MASTER-PLAN § 4.2 item 5): scrubbing draws the line and the gauge to that moment without sound.
  The live region after a play: "Merc's slide: the stretch rose evenly the whole way, and the line
  jumped across the seam between G 3 and A 3."
- **Three slides** (Step 3): three slots, a third of the plot each, numbered 1, 2 and 3 under them.
  **Slide 1**, **Slide 2** and **Slide 3** each play their slide up, 4.0 s, and draw it across its
  slot (FACTS 78): Slide 1 is the cold open's up half, with its seam across its slot from G3 to A3
  (or F4 to G4); Slide 2 switches later, with its seam from A3 to B3 (or G4 to A4); Slide 3 stays in
  one gear the whole way, the lower from E3 to C♯4 (or the upper from D4 to B4), and its slot has
  no seam. **Slow** (`aria-pressed`) doubles every length. The live region: "Slide 1: switching
  gear between G 3 and A 3.", "Slide 2: switching later, between A 3 and B 3." and "Slide 3: one
  gear the whole way, with no seam." The slots and their seams stay once drawn, so the three can be
  compared.
- **Smoother** (Step 4, the signature): five slots, a fifth of the plot each, numbered 1 to 5 under
  them. **Play the five slides** plays the five two-note slides in turn, F3 up to B3 and back (or E4
  to A4), 21.9 s, each drawn across its slot as it sounds, with its seam from the jump's lower pitch
  to its upper: 2, 1.5, 1, 0.5 and 0.25 semitones, centred on G♯3 (or F♯4), never under 2 px, so
  that a hairline stays in the fifth slot (FACTS 79). **Slow** (`aria-pressed`) doubles every
  length, 43.8 s. The slide picker, a group labelled "Play one slide:", holds five buttons, "1" to
  "5", each playing its slide alone, 3.9 s, and drawing it in its slot. The seams do not move or
  animate: each slot's seam is drawn at its own height, so the narrowing reads left to right across
  the five, and stays (Decisions). The live region names each slide as it sounds: "1 of 5: a jump
  of 2 semitones" to "5 of 5: a jump of a quarter of a semitone; the seam is a hairline". The
  step's Notice already says "It's a model of what practice can do, not a promise.", so the chart
  adds no words beyond its key and its caption.
- **Styles** (Step 5): the seam across the plot from G3 to A3 (or F4 to G4). **Flip on purpose**
  plays the figure with the gear changing abruptly at each leap across the seam, and draws its seven
  notes as short lines, thick below the seam and thin above it; **Hide the switch** plays the same
  notes with both gears at half the sound the whole way, and draws them at one width, 4 px (FACTS
  80). Each plays for 3.6 s, and **Slow** (`aria-pressed`) doubles it. The live region: "Flip on
  purpose: G 3, C 4, B 3, G 3, E 3, G 3, C 4. Each leap across the seam changes gear." and "Hide the
  switch: the same notes in one even sound." (the higher voice's notes are F 4, A sharp 4, A 4, F 4,
  D 4, F 4 and A sharp 4).
- **Live** (Sing it): Toys 4.
- **Free play** (Wrap): the five step states on one stage under one state switch, five buttons with
  `aria-pressed`, "Gears", "Slide", "Three slides", "Smoother" and "Styles", one pressed at a time,
  "Gears" first, in two rows of three and two above the state's own controls, and the voice switch,
  "Lower voice" and "Higher voice" (`aria-pressed`), on a row of its own under them, which changes
  the chart's voice for the visit and stores nothing. Switching keeps each state's settings for the
  visit (Slow, the slots drawn).
- **Layout and targets** (FACTS 83). The stage fit is the kit's, so the page sets no figure height
  of its own: on every step the deck measures what the toy needs besides its figure
  (`kit/step-deck.ts:15-17`; `fitStage`, `kit/stage-fit.ts:38`), and the figure, the kit's
  `.viz.tall` (380 px beside the text, 340 px in the deck, 310 px at 420 px wide and under), gives
  way to it down to `--viz-min`, which this page sets to 210 px on the range chart, as Lesson 3's
  band chart does (`lesson-03/lesson-03.css:177-182`), because its named rows and its seams need it;
  a stage still over budget scrolls inside itself, by 60 px at most (PRODUCTION-PIPELINE § 5). The
  plot is the figure less 11 px above and below, as Lesson 7's 288 px chart in a 310 px figure:
  12.79 px a semitone at 380 px, 11.36 at 340, 10.29 at 310 and 6.71 at the 210 px floor, so the
  cold open's 2-semitone seam stands 25.6, 22.7, 20.6 and 13.4 px, and Step 4's five seams at 310 px
  stand 20.6, 15.4, 10.3, 5.1 and 2.6 px (at the floor 13.4, 10.1, 6.7, 3.4 and the 2 px minimum).
  On a phone at 390 x 844 the stage card is 358 px inside the 16 px gutters and the figure's canvas
  354 px, so the plot is 320 px wide beside the gutter: Step 3's slots are 106.7 px each (91.3 px
  at 344 px) and Step 4's 64.0 px (54.8 px). Every target is at least 44 px square, with 8 px
  between neighbours, at every width from 344 px up, and no chart row or slot is a target. Controls
  sit under the canvas in rows, as the kit's rows wrap:
  - Step 1: Lower gear and Upper gear, two a row at 173.0 px each at 390 px (150.0 px at 344 px).
  - Step 2: the gauge's row (44 px tall, not a target); Play and Slow, two a row; the scrub bar on a
    row of its own, with a 44 px thumb.
  - Step 3: Slide 1, Slide 2 and Slide 3, three a row at 112.7 px (97.3 px at 344 px); Slow on a row
    of its own.
  - Step 4: Play the five slides and Slow, two a row; the picker on a row of its own, five 52 px
    segments in 260 px, centred.
  - Step 5: Flip on purpose and Hide the switch, two a row; Slow on a row of its own.
  - Free play: the state switch in rows of three and two, the voice switch two a row, then the
    state's own rows. It sits in the Wrap, not in the stuck deck, so it scrolls with the page; on a
    phone the stage stays under about 700 px with its tallest state, the slide's.

  Keep each step's chrome, its stage less the figure, under about 375 px at 1133 px wide, so every
  step's stage fits the short landscape screens with the masthead (End to end 5): the tallest is
  Step 2's, three rows of 44 px with the key and the status line.

- **Keyboard and screen readers.** The chart is a group with a live summary in spoken names, never
  the sign. Every control is a button; Slow, the voice switch and free play's state switch carry
  `aria-pressed`. The scrub bar is a slider (`role="slider"`, 0 to 4 seconds of the slide whatever
  Slow says, `aria-valuetext` such as "0.9 seconds of 4: lower gear, near F sharp 3" or "1.7 seconds
  of 4: the switch, from G 3 to A 3"), moved by the arrow keys a tenth of a second at a time, Home
  and End for its ends. No two controls on the stage share a name, and each name begins with its
  visible label: "Lower gear, G sharp 3" and "Upper gear, G sharp 3"; "Play the slide"; "Slide 1",
  "Slide 2" and "Slide 3"; the picker's "1 of 5" to "5 of 5"; "Flip on purpose" and "Hide the
  switch"; the voice switch "Lower voice" and "Higher voice", distinct from Sing it's voice buttons.
  Tab order: the state's own controls in reading order, then Slow, then the scrub bar; in free play
  the state switch and the voice switch first.
- Under reduced motion a line draws whole at once, its head does not glow in a pulse, the gauge
  shows its end, and a scrub moves at once; a played sound still sounds.

### 2. Predict widget

The kit's predict as it is on main (`src/features/lessons/kit/predict.ts`, with #1149's `play` that
reports a play cut short and #1160's hint rules; FACTS 11). Every line cited in this section is
that file's unless it says otherwise.

- `mountPredict` (`kit/predict.ts:80`) takes two to four choices: here two `.choice` buttons,
  `data-choice` "mistake" and "every", labelled "A mistake" and "Every voice can", each at least
  44 px tall. The choice locks: the pressed one shows pressed and both are disabled (`:113-120`).
  It opens the play `data-play` "blue", labelled "Play blue Merc's siren", which starts disabled in
  the markup, and moves the focus to it (`:121-128`).
- **Play orange Merc's siren** is a `data-free` play inside the predict's root: it works before the
  choice, so the sound comes first (playbook rule 5), and it never reveals, since it is the siren
  the question is about (`:14-16`, `:92-96`).
- `revealOn: ['blue']`, with the default `revealAfter: 'any'` (`:52-58`): the reveal waits until
  blue Merc's siren has been heard to its end with sound on (`heard`, `:144-160`). The page's
  `play` resolves `false` for a siren cut short, by another sound or a stop, and the kit then
  reveals nothing and leaves the hint as it was (`:30-40`, `:170-174`; Audio). A siren played with
  sound off that draws its line to its end resolves `true`, so the kit can say that nothing was
  heard (`:148-151`).
- The hints. The page's own lock hint, in the markup, is LESSON.md's "Choose an answer to unlock
  blue Merc's siren.", and the kit keeps it to put back (`:83-84`). The kit's three (`:41-51`):
  `chosen`, "Locked in. Now play blue Merc's siren."; `silent`, LESSON.md's "Sound is off, so
  nothing played. Turn sound on to hear the siren, then play it again."; and `again`, "Play either
  siren again." This page has no `next`, since one play reveals, so after a choice a heard play
  that does not reveal, orange's siren, shows `chosen` (`:47-48`, `:159`).
- `guess` gives "You said: a mistake" or "You said: every voice can", in Lesson 2's form
  (`lesson-02/cold-open.ts:34-37`), and the reveal's text is LESSON.md's for either choice. It
  answers "Every voice can" first; its "(Classical singers train to hide it, so "a mistake" was a
  fair guess.)" consoles the other choice; and no line says a flip rules anything out (FACTS 12).
  `onReveal`: each seam's label changes to "the switch", the key appears, and orange celebrates
  once (Mercs).
- States, and what a play that runs to its end does in each (`heard`, `kit/predict.ts:158-174`):
  - **Waiting for a choice.** The lock hint shows. Play blue Merc's siren is disabled, and the kit
    ignores it before a choice too (`:165`); Play orange Merc's siren works. Played with sound off,
    orange's siren draws its line and `silent` takes the lock hint's place (`:148-151`). Heard with
    sound on, still before a choice, it puts the page's lock hint back, since blue's siren is still
    locked (`:152-156`).
  - **Choice made, blue's siren not heard yet.** The choice shows pressed and locked, Play blue
    Merc's siren is open and has the focus, and the hint reads `chosen` (`:106-124`). Orange's siren
    heard with sound on shows `chosen` again, in place of `silent` if sound off had left it there
    (`:159`). Either siren played with sound off draws its line and shows `silent`. The reveal stays
    hidden.
  - **Revealed.** Blue's siren heard to its end with sound on shows the reveal, with its "You said"
    line, and the hint reads `again` (`:126-142`, `:157-158`). Later plays change neither (`:147`).

  In every state a play cut short reveals nothing and leaves the hint as it was
  (`kit/predict.ts:187-188`). The predict's own two plays never cut each other short: a tap on one
  while the other plays does nothing (`busy`, `:179`). So a siren is cut short only by another
  source taking the page's sound (a Four words play, a step toy: Audio), or by sound turned off or
  the page hidden, which stop every voice (`kit/sound.ts:475-477`, `:507`).

- The kit's own tests hold these rules (`src/features/lessons/kit/predict.test.ts`): the sound-off
  hint after a choice (`:153-169`), the play cut short (`:198-221`), the lock hint back after a
  free play heard before a choice (`:218-240`), `chosen` in place of `silent` after a choice
  (`:266-286`), and a free play that never reveals (`:288-302`). The page's are unit test 10 and
  End to end 2, and Page QA's "The predict before a choice", "The predict after a choice" and "A
  siren cut short" check them by hand (Contract).
- Under reduced motion the reveal appears without its rise (`kit/predict.ts:149`).

### 3. Four words

Lesson 1's strip, its figures small drawings of the range chart's lines: Register plays one note in
each gear, G♯3 (or F♯4), 2.0 s each with 0.3 s between, beside a thick and a thin line at one
height; Chest voice plays the lower gear, 2.0 s, beside a thick line; Head voice, or falsetto,
plays the upper gear, 2.0 s, beside a thin line; Flip plays the cold open's up half, 4.0 s, beside
a rising line that jumps across a small seam and goes on thin (FACTS 76). Each button names what it
does, as LESSON.md words them: "Play: one note in each gear", "Play: the lower gear", "Play: the
upper gear" and "Play: a siren that flips".

### 4. Sing it: one slow siren

The range chart in live mode, inside Sing it's card, with Merc's amber siren as the shape and the
viewer's line drawn against the window. It is the kit's `.sing-chart` (240 px; 210 px at 420 px wide
and under, `kit/lesson-voice.css:40-46`, `:385-388`), over Lesson 7's windows, so the plot gives
6.81 px a semitone for the lower voice's 32 semitones and 7.03 for the higher's 31 (5.88 and 6.06
at 210 px; FACTS 83). Merc's siren is drawn in its one gear (thick for the lower voice, thin for the
higher) with no seam; the viewer's line is violet, 3 px, and nothing is ever drawn on it or beside
it: no seam, no label, no band and no mark, whatever the frames hold (FACTS 27, 64). Every state has
a visible status line that is also announced (`aria-live="polite"`). Nothing is scored and nothing
is celebrated (FACTS 66).

States:

1. **Comfort check**, always first and asked every visit (never stored): LESSON.md's head line,
   "Sore, hoarse or unwell today? Just listen along.", Lesson 3's list naming all six of
   REQ-GVC-020's conditions, and its two buttons (FACTS 52, 53), through the kit's `mountComfort`
   (`kit/comfort.ts:146-154`).
2. **Voice choice**, after either comfort answer: Lesson 3's two buttons with the Mercs' stills
   (`aria-pressed`, at least 44 px), under LESSON.md's line in its two forms, "Choose a voice to
   sing with. If you chose one in an earlier lesson, pick it again:" with none stored and "Keep the
   voice you chose before, or change it:" with one (FACTS 57). It reads and writes `fyp-voice`
   through `VoiceChoice` (`kit/voice-choice.ts:20-47`). A stored choice shows pressed and can be
   changed; with none stored, neither is pressed and the next state waits for a choice, before
   "Just listen today" plays anything too, because the voice picks the Merc who sings.
3. **Just listen today** (listen-only mode): LESSON.md's line with the doctor lines (FACTS 55, 56);
   **Play Merc's slow siren**, which sings it on a tap in the chosen voice, the chart drawing Merc's
   line; nothing listens, the warm-up and Start are not shown, and nothing asks the viewer to sing
   (REQ-GVC-021). The Wrap shows the rest card.
4. **Warm-up**, optional, with Skip: Lesson 3's words and its two plays, Play Merc's sigh and Play
   the slide, in the chosen voice (`warmUpContour`, `kit/warm-up.ts:24-36`), with "Copy the way
   Merc's voice slides, not the exact notes." and the stop line (FACTS 58). Nothing listens and
   nothing is scored (REQ-GVC-074, REQ-GVC-075). The Skip is stored as `fyp-l11-warmup`, as Lessons
   3 and 5 store theirs.
5. **Your turn and briefing**: LESSON.md's Your turn text; the stop line on its own line; the "What
   this does" box (REQ-GVC-002, REQ-GVC-003, REQ-GVC-012, REQ-GVC-026; FACTS 69, 70); **Play Merc's
   slow siren** and **Start**, the only control that asks for the microphone (MASTER-PLAN § 4.2 item
   2). Merc's siren is 8.5 s in one gear, E3 up to C♯4 and back in the lower gear for the lower
   voice, E4 to C♯5 in the upper gear for the higher (FACTS 81). Start is `aria-disabled` until
   Merc's siren has sounded once this visit, with the hint "Play Merc's slow siren first" (hear it
   first: playbook rule 16). With sound off, Play Merc's slow siren draws Merc's line and plays
   nothing, so Start stays unavailable and the hint says why: "Sound is off, so nothing played. Turn
   sound on to hear Merc's slow siren, then press Start." That is Lesson 1's rule, as Lessons 5 to 7
   and 9 apply it: what waits on hearing a sound waits while the sound is off.
6. **Take**: Start asks for the microphone (`listen('lesson-11', Sound.context())`,
   `kit/listen.ts:54-57`), and the take opens at least 0.4 s after any sound has ended, with every
   sound held off while it is open (`Sound.hush`, `kit/sound.ts:533-541`). The status reads
   "Breathe, then hum one slow siren on "ng", up only as far as is easy and back. We stop listening
   when you stop." The take waits up to 6 s for the first voiced frame, then runs until the voice
   has been quiet for 1.0 s after at least 2.0 s of it, or for 14 s from the first voiced frame,
   whichever comes first; nothing on the page extends it (`takeFrames`, `kit/listen.ts:168-195`,
   with `wait: 6`, `run: 14`, `quiet: 1` and Lesson 7's `quietAfter: 2`; FACTS 63). The violet
   line draws live on the window from the left, from the listener's frames smoothed for drawing
   (`latest`, `kit/listen.ts:39-40`), as Lesson 7's does; a frame outside the window pins to the
   chart's top or bottom edge with a small arrow and no number. A jump in the line is drawn as it
   comes and named by nothing: a jump can be a flip, a breath or the detector's error, and the page
   tells none of them apart (FACTS 27). Merc's line stays on the chart, faint, for the shape.
   Lesson 7's ring turns slowly while the take is open, once every 8.5 s whatever the take's
   length, with the chosen voice's Merc at its centre and the word "Listening", and shows no
   seconds, so it never reads as a time to fill. Both Mercs listen (`mercListen`,
   `kit/merc-duo.ts:206`). The microphone is released when the take ends.
7. **After the take**: no reading. If no voice came within 6 s, the line is LESSON.md's, "We didn't
   hear you start that time. Hum "ng" as the ring turns.", with **Start again** while the visit has
   had fewer than three takes (this take counts, and leaves the visit's one Again unused) and **Done
   for today**, and no feeling question, since nothing was sung. Otherwise the chart's summary reads
   "Your siren, drawn as a line." (REQ-GVC-085), and **How did that feel?** follows at once
   (REQ-GVC-022).
8. **How did that feel?**: Lesson 3's four answers (`aria-pressed`, at least 44 px, a 2 x 2 grid on
   phones), through `mountFeelings` (`kit/comfort.ts:156-187`) with its default, an answer that
   locks, asked after each take with voice (FACTS 65): a press disables all four, and `reset()`
   frees them for the next take, so an answer cannot be changed once it has set what follows. Lesson
   6's page gives `mountFeelings` a `changeable` option for its sweeps (`kit/comfort.ts:165`), which
   this page leaves off. What each answer allows comes from `afterFeeling` with the proposed
   `restAfterEffort` (What the kit and the app still need, 9); its `count` and `tricky` have nothing
   to show here.
   - Easy or Workable: LESSON.md's "That's it: one slow siren, done. Flip or no flip, that's a whole
     siren."; then, if the visit's one Again is unused and fewer than three takes have been made,
     **Again** (named "Again: one more slow siren"); then **Done for today**. The Wrap shows the
     practice card.
   - Effortful: Lesson 3's "Keep it gentle: rest before you sing again.", no Again and no further
     siren this visit; Play Merc's slow siren stays, and Start goes. The Wrap shows the rest card,
     as Lessons 6, 7 and 9 specify. The rules decide it: a report of effort suppresses
     immediate-repeat encouragement (REQ-GVC-021), and the practice drill asks for six more glides
     (FACTS 65).
   - Uncomfortable: the viewer's line is taken away, then Lesson 3's "Thanks for saying so. That's
     enough singing for today: rest your voice." with the doctor lines; no Again and no further
     siren; the chart keeps Merc's siren only. The Wrap shows the rest card (REQ-GVC-023,
     REQ-GVC-024, REQ-GVC-055).
   - Once "Effortful" or "Uncomfortable" has been answered, no further siren and the rest card stay
     so for the visit. The page keeps the ending in memory for the visit, never in storage
     (`VisitEnding`, `kit/comfort.ts:84-102`).
9. **No microphone** (refused, no device, or the listener failed to load): listen-only mode with
   LESSON.md's "No microphone?" line; Merc's slow siren still plays, and the Wrap keeps the practice
   card, since singing along with nothing listening is no report of effort (Lesson 3's rule).
   Without Web Audio (no `AudioContext` in the browser), nothing can play and the listener cannot
   run, so Sing it offers this listen-only path at once, with no Start: Play Merc's slow siren
   draws Merc's line in silence, with the hint "This browser can't play sound here."

The retry rules, all in the flow rule below (FACTS 63):

- A visit allows at most three takes. Every take counts: one with no voice, and one abandoned when
  the page was hidden.
- Again after "Easy" or "Workable" is offered at most once a visit. A take with no voice asks no
  feeling question; its Start again is a fresh start and leaves the one Again unused. A take
  abandoned when the page was hidden asks none either, and Start comes back while takes remain, but
  if it had voice it uses the one Again up. So a visit holds at most three takes and two sung
  sirens.
- Never a retry after "Effortful" or "Uncomfortable": once either has been answered, no Again and no
  Start appear for the rest of the visit.
- No line after a take invites another try, so no retry wording can show without an Again.

The flow is a pure rule, shared with Lesson 7's page: `kit/siren-flow.ts`. Lesson 7's page has it
in `lesson-07/siren-flow.ts` (its Toys 4); this page, the second to need it, promotes it to the
kit, with Lesson 7's reading as an option this page leaves off (What the kit and the app still
need, 7). From the comfort answer, the voice, whether sound and Web Audio are on, whether Merc's
siren has sounded, the takes so far (how many, and for each whether it had voice and whether it was
abandoned), whether the visit's one Again has been used, and the answers so far (the latest, and
whether "Effortful" or "Uncomfortable" was ever answered), it gives the state, the controls shown,
the lines and the Wrap's card, so every branch above is unit-tested without a microphone (Tests,
7).

Listening: Lesson 3's `kit/listen.ts`, with one option added: `micManager.acquire('lesson-11')` for
the take (`:59`), released when it ends, on leaving the section, on `pagehide` and when the tab is
hidden (`:18-22`); the YIN-only F0 stream (`src/lib/pitch-f0-stream.ts`); one AudioContext through
`Sound.context()`, so every note Merc sings and every frame the take hears share a clock; nothing
plays while a take is open. The frames are drawn and then dropped: nothing reads them, nothing is
recorded or kept, nothing leaves the device, and no event carries a frame or an answer; at most a
count-only "checkpoint finished" event once the Lesson telemetry track exists (REQ-GVC-090; FACTS
69). The listener arrives through a dynamic import when Start is pressed, as on Lesson 3, so a page
that is only read never loads it (`kit/listen.ts:5-8`).

Accessibility and motion: no state carries meaning in colour alone (REQ-GVC-082). After a take the
chart's summary reads "Your siren, drawn as a line." and names no note, gear, flip or span
(REQ-GVC-085). Start, Start again, Again, Done for today, the comfort and voice buttons and the four
feelings are real buttons of at least 44 px in a keyboard order that follows the flow; a button the
flow does not offer is absent, not disabled, except Start's wait for Merc's siren and the feelings
once answered, as the kit has them; Space never starts a take by itself (REQ-GVC-080). Under reduced
motion the live line draws on a fixed frame that never scrolls, the ring holds still with the word
"Listening", and the Mercs skip their reactions (REQ-GVC-083).

### 5. Recall and quick check

The kit's quiz as it stands carries everything two quizzes on one page need (`kit/quiz.ts`): an id
`prefix` for each quiz's elements (`:81-86`), question ids, from which a question's lesson is read
(`:42-47`), an optional `lesson` (`:75-76`), and links that leave this page for a question from
another lesson (`linkAway`, `:179-209`), which keep their words and drop the link where that lesson
is not live (`:199-202`).

- **Recall**: Lesson 7's questions 1 and 4, word for word with their feedback (LESSON.md; FACTS 4),
  under their Lesson 7 ids, `l07-q1` and `l07-q4`, with the prefix `rc-`, as Lessons 3 and 5's
  recalls have (`lesson-05/recall.ts:16-23`), shown to everyone (Lesson 7 is a prerequisite).
  Reshuffled from a seed of its own (keys `fyp-l11-recall-seed` and `fyp-l11-recall-v1`); earlier
  answers are never shown, so the answers measure delayed retrieval (MASTER-PLAN § 9). It takes no
  `lesson`, so it marks nothing done. Neither question plays a sound. The two questions come from
  Lesson 7's own module, `lesson-07/quiz-questions.ts`, once its page is built, filtered by id, so
  the recall cannot drift from Lesson 7's quiz, as Lesson 5's recall is held to Lesson 3's
  (`lesson-05/quiz-questions.test.ts:38-45`). The kit turns "Try Step 1 again" and "Try Step 5
  again" into "Try Lesson 7, Step 1 again" and "Try Lesson 7, Step 5 again", links that open Lesson
  7's page at that step, `/learn/07#step-1` and `/learn/07#step-5`, in a new tab so the viewer
  keeps their place here, never `data-goto-step`, which would move this page's own deck
  (`quiz.ts:179-209`); where Lesson 7 is not live, each keeps its words with no link (Edge cases).
  The address is the quiz's `away.href` (`quiz.ts:87-94`), the kit's `recallStepHref`, which Lesson
  8's page moved into `kit/quiz.ts` (`:134-136`; What the kit and the app still need, 11), and the
  kit's step deck opens at the step an address names (`kit/step-deck.ts:18-23`, `:284-292`), as
  Lesson 7's does.
- **Quick check**: LESSON.md's four questions, ids `l11-q1` to `l11-q4`, keys `fyp-l11-seed` and
  `fyp-l11-quiz-v1`, and `lesson: 11`, so answering all four marks Lesson 11 done in the explorer.
  Three answers each, shuffled per question from the stored seed, one-line feedback for every
  answer, and a check icon and ink (not gold) on the right one. The kit prints "Right." or "Not
  quite." before each line (`quiz.ts:293`), so no feedback line starts with "Right", "Yes" or
  "Correct". "Try Step 2 again", "Try Step 3 again", "Try Step 4 again" and "Try Step 5 again" use
  the kit's `data-goto-step`. LESSON.md's note on the shuffle is editorial and never printed.
  Answers stay in the viewer's browser until the telemetry track exists.

### 6. Go deeper drawers

`details` disclosures, closed by default, under the text of Steps 1 and 3, holding LESSON.md's
items. Neither plays a sound.

## Audio

Every tone is synthesised in the page with Web Audio at the frequencies in FACTS 73, through the
kit's sound module and its house envelopes (`.claude/memory/audio-pop-free-playback.md`), and
started only by a tap: Merc's sirens, slides, notes and figure in the gear model below; the
warm-up's sigh and slide in Merc's "ooh", as on Lesson 3. Nothing autoplays, nothing plays while a
take is open, and the page has no music bed.

The gear model (FACTS 74), Merc's model, labelled so on the chart:

- Each sung line is two of the kit's contour voices (`contourVoice`, `kit/sound.ts:314-347`), one
  per gear, on one pitch path: the two take the same points, the same times and pitches, and start
  on the same audio-clock time (`at`), so their pitches and Merc's vibratos move together. The
  lower gear is Merc's "ooh" (`kind: 'merc'`); the upper gear is Merc's voice with the soft tone's
  partials, which are weaker above the fundamental (`kind: 'merc'` with the proposed
  `wave: 'soft'`). Both pass through a 900 Hz lowpass, the "ng" of Lesson 7 (the proposed
  `lowpass: 900`; Lesson 7's page gets its "ng" from the `timbre` option and `NG` in
  `kit/timbre.ts`). The two kit options change nothing for a voice that does not pass them (What the
  kit and the app still need, 6).
- A switch is a crossfade between the two voices whose levels always add to one, written as contour
  points 10 ms apart through the crossfade, because the kit's level ramps are exponential and would
  leave both gears 40 dB down in the middle of a crossfade written as two points; between the
  points the sum dips by 1.5 dB at most (FACTS 74). The extra points
  sit on the same pitch path, so the glide is unchanged. At a flip the crossfade runs with the 40 ms
  jump; in Step 4 it lengthens to 120, 250, 400 and 600 ms, centred on the jump (FACTS 79); in Hide
  the switch both levels are 0.5 throughout (FACTS 80). Away from a crossfade the silent gear sits
  at the kit's floor.
- The upper gear's level is trimmed so the two gears sound equally loud, since the kit gives each
  wave the same peak and the soft wave's energy sits lower: the switch is to be heard as a change of
  colour, not of loudness, and the model changes no loudness (FACTS 74). The trim and the lowpass
  are tuned by ear before publishing, on a phone's speaker and on headphones (Decisions).
- A glide runs even in semitones, as the kit's exponential pitch ramps do. The times, rates and
  jumps of every line are FACTS 75 to 81's, and a pure helper in the page's module builds both
  gears' points from them, unit-tested (Tests, 1 and 2).

One sound plays at a time, page-wide. Every source, the cold open, the Four words, the step toys,
Sing it and free play, takes the page's one "now playing" owner before it sounds, and the owner
stops whatever was sounding, so a new tap stops the last, whichever control made it. Both gears of
a line are one sound to the owner, started and stopped together. Leaving a step stops its sound and
anything it has queued, the rest of a sequence (Step 4's five slides) or a replay, whatever the
route: Previous or Next, a swipe, the wide page's scroll, the lesson menu's jump, a `#step-N`
address and a quick-check step link all reach the deck's `show`, which calls each toy's
`onStep(step, previous)` (`kit/step-deck.ts:45-47`, `:140-181`), and the page stops the step's
sound whenever `step` differs from `previous`; a layout switch calls it with the same step
(`:188-191`) and stops nothing. A play cut short, by a new play or a stop, never counts as heard:
the cold open's `play` resolves `false` for it, and the predict counts only a play that runs to its
end (Toys 2). Both rules' kit parts are on main, from Lesson 6's page (#1149): the owner,
`NowPlaying` (`kit/now-playing.ts:17-39`), which every source claims with its own stop before it
sounds and releases when it ends (`:5-15`), and `kit/predict.ts`'s `play`, which resolves `false`
for "not heard", where `true` or nothing is a play heard to its end, so Lessons 2 to 5 see no
change (`:31-41`; What the kit and the app still need, 10; unit tests 14 and 15).

A sequence decides once, at the tap, whether it sounds (`ToneOptions.audible`,
`kit/sound.ts:555-558`), so a step's later notes never ask `Sound.canPlay()` from a timer, which
would show the sound-off toast with no tap (`:514-522`). A play that is pressed again while it runs
pauses it; a play pressed while another runs stops the other and starts. A live line is written to
its region only when its text changes, so a screen reader does not hear the same line twice.

## Mercs

Lesson 1's setup through the kit (`kit/merc-duo.ts`, `kit/merc-warm.ts`): the app's renderer loaded
after first paint, one WebGL context per Merc, medium quality on phones, turned towards each other,
paused off screen, and the still images when WebGL fails or would run on the CPU.

- They live in the hero, and their reactions are the hero pair's: orange sings while orange's
  siren sounds and blue while blue's does, and orange celebrates once at the cold open's reveal (no
  sparkles), the puzzled one who then gets it, whichever choice was made (playbook rule 15; FACTS
  13). Elsewhere the Merc of the chart's voice sings while Merc's lines sound (blue for the lower
  voice, orange for the higher).
- `kit/merc-duo.ts` has `mercSing`, `mercListen` and `mercCelebrate` (`:164`, `:206`, `:216`): Merc
  sings his lines, and both listen during a take. Nothing celebrates in Sing it: a hum is never
  scored or celebrated, as on Lesson 7's page (FACTS 66). Proposed, as Lesson 7's spec proposes:
  `ride` and `hum`, which `src/lib/merc/constants.ts` lists for the glide rooms ("humming, and
  riding the voice", `:24-26`), so the singing Merc would ride a siren and hum it on "ng", in place
  of `sing`. Without them the page uses `mercSing`, as Lesson 7's page, built without them, does.
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, the Siren exercise.** It sits in the Exercises tab, which
  `mercurypitch.com/pitch-training` opens, as "Siren / Range Explorer", and it is free and ungated
  (FACTS 43). On the public host the card's link is `/pitch-training?lesson=11`: the marker makes
  First Light step aside for good, so a first visit lands on the Exercises tab with no intro, and
  the card carries no first-visit line (FACTS 43). The card names the tap ("then tap Siren / Range
  Explorer"), says what the drill does and how it scores, and names its help's line that asks for no
  breaks, because this page lets a flip come (FACTS 40 to 42). It comes in two versions, picked by
  how Sing it ended (Toys 4), and both link the same address. From its default centre note the
  drill's glides stay in the lower half of the saved preset, so it asks for nothing near the top of
  the saved range, but its octave glide starts on the preset's lowest note at the default level
  (FACTS 40, 62; REQ-GVC-011): a question on the coach's list.
- **App content, small** (MASTER-PLAN § 7's App content track), proposed, for the Siren exercise
  (FACTS 41, 42):
  - its help (`src/features/exercises/exercise-help.ts:149-156`): ":150" "Glide your full range up
    and down like a smooth siren." becomes "Glide up and down like a smooth siren, within an easy
    part of your range."; ":152" drops "through your range"; ":153" becomes LESSON.md's "Stay
    relaxed and let the pitch flow. If your voice flips between your low and high voice, let it:
    every voice changes gear."; and ":154", which says the glide is scored on how smooth and
    connected it is, becomes "Most of your score is how close you come to the second note.", as the
    code scores it (70 % of the grade, FACTS 41), at least until the slide part below is fixed. When
    the help changes, the card's sentence about it goes (LESSON.md's editorial note).
  - its menu card (`src/features/exercises/ExerciseMenu.tsx:175-176`), "Glide smoothly across your
    range. Develop seamless register transitions and vocal flexibility.", becomes "Glide smoothly
    between two notes and back. Develop vocal flexibility.", which promises nothing about the
    switch.
  - its slide score: `detectSlides` scores the jumps between steady stretches of the line, so a
    glide sung smoothly at the dot's pace earns nothing from the 30 % slide part of the grade, and a
    flip or a tracking error can earn it (FACTS 41, an inference from the code). Proposed: measure
    the glide itself in that part (`computeDirectness`, `src/lib/vocal-analyzer.ts:515-535`, over
    each round's window), or leave the part out of the Siren's grade.
  - optionally, the octave glide fitted so that it no longer starts on the preset's lowest note, for
    example by centring the glides two semitones higher before the shift into the preset
    (`use-siren-controller.ts:89-100`).
- **Needed, proposed: `/exercises/siren`** (CURRICULUM § 4 item 1), a data-only slug that opens the
  Siren exercise on its setup screen with its defaults, registered in `EXERCISE_SLUGS`
  (`src/features/exercises/slug-map.ts:47-65`) with a line in `src/tests/slug-map.test.ts`, its
  notes, if any, fitted to the singer's range as every slug's are, and `?lesson=11` on the link,
  because a slug boots the main app, where First Light opens on a first visit unless the marker
  steps it aside (FACTS 46). When it ships, LESSON.md's editorial note gives the copy: the card's
  tap goes and the address becomes `mercurypitch.com/exercises/siren`.
- **Not linked**, with the reasons in FACTS: Slide In/Out, whose speed score is full only for a
  slide of about a third of a second or quicker at the default level and nothing by about a second
  (FACTS 44), where this page asks for a slow slide; the Ascent, whose range week asks for notes
  past the comfortable top, and whose rewrite CURRICULUM § 4 item 8 waits on (FACTS 45); and the
  Sing room's premium rooms, Ng slides among them, which `PREMIUM_EXERCISES` gates (FACTS 45).

## Explorer and season data

- **Season data**: Lesson 11's entry in `kit/season.ts` (`:351-359`) gains a plain `minutes: 16`
  and `page: '/learn/11'` after its topics, in every build, under the comment Lesson 5's entry
  carries, `// A draft until its sign-off (drafts.ts), as Lesson 3 is.` (`season.ts:250`), as
  Lesson 3's own are written (`season.ts:210-213`; FACTS 5, 47, 48). Whether the page is live is
  `kit/publish.ts`'s to say: `seasonFor` draws a lesson held back as one coming later, with no page
  and no reading time (`:94-124`), so the entry reads neither `DRAFT_LESSONS` nor `DRAFTS_SHOWN`,
  which `kit/drafts.test.ts` keeps to the publishing rules alone (`:57-67`). Its link, proposed with
  the page (FACTS 47): `href: '/pitch-training?lesson=11'`,
  `addr: 'mercurypitch.com/pitch-training'`, `label: 'Exercises'` and
  `note: 'then tap Siren / Range Explorer'`, so the card reads "Exercises, then tap Siren / Range
  Explorer", as Lesson 9's reads "Exercises, then tap Arpeggio Jumper" (`season.ts:334-339`,
  `explorer.ts:174-179`). The note is in the learner's words (`season.ts:34-37`); `needs` keeps
  "siren and slide drills" for the team, and no card draws it. The link lands with the page, not
  before it as Lesson 9's did: every lesson page's explorer prints it, and only this page says what
  the drill's help asks and why a flip may come anyway (Decisions). Its hook is the entry's
  (`season.ts:357`), which this package changed, and its tease and the alternative `same-note` are
  `kit/lesson-copy.ts`'s (`:124-132`), as FACTS 1 records: this spec proposes no other change to a
  hook or a tease. `EDGES` already holds [7, 11] (`season.ts:419`).
- **The explorer card**: what the kit draws for a lesson with a page and no published film: its
  state and main action from `kit/lesson-state.ts` ("Start lesson", "Continue: step N" or "Read
  again"), its minutes, no Watch button (`kit/season.ts:23-25`), and the learner's fields only,
  which `src/e2e/learn-no-planning-text.spec.ts` holds every built lesson page to.

## What the kit and the app still need

Found in the kit and the app as they stand on main (21 October 2026, `62c99c150`), Lesson 6's page
(#1149) and the kit's predict fix (#1160) included, with this package's hook and its alternative,
beyond the parts Lessons 2 to 10 promote into the kit (Toys table). Lessons 7 and 9's pages are not
built yet, and several items below are theirs too: whichever page is built first lands the part, and
the others take it.

1. The lesson host: `learn/11.html` at `/learn/11`. Every build takes every `learn/NN.html` as an
   input and routes its clean path (`tools/draft-lessons.ts:1-18`; `lessonPages`, `:77-86`;
   `lessonInputs` and `lessonPaths`, `:109-122`; `vite.config.ts:306`, `:474`), so the page needs no
   build change. Its line in `kit/drafts.ts`,
   `11: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`, beside Lessons 3 to 8's
   (`:30-38`), makes it a draft: production's `LESSON_DRAFTS`, "0", holds it back, and the dev
   site's and the previews', "1", show it (`wrangler.jsonc:165-167`, `:188-190`, `:231-232`), until
   the console sets it either way, and the Content Studio's Lessons page names that reason when
   asked to publish it (FACTS 9). `/learn/11` and `/learn/11.html` go in `STANDALONE_DOCUMENT_PATHS`
   (`src/lib/sw-runtime.ts:93`, the lessons `:131-156`), so the service worker never serves the app
   shell in the lesson's place; `src/tests/lesson-pages.test.ts` checks a draft for them too
   (`:274-278`). On release: delete the `drafts.ts` line, and add the page to `public/sitemap.xml`
   and to `public/llms.txt`'s Lessons list (`:66-70`), whose intro already allows a page with no
   episode; until then the site worker adds the page to both only while it is published
   (`src/lesson-gate.ts:22-24`). Then `src/tests/lesson-pages.test.ts` holds the page to a
   released lesson's listings, the sitemap, llms.txt, the service worker and a link from every
   entry document (`lesson-pages.test.ts:212-240`), in place of a draft's (`:242-279`), and
   `tools/lesson-links.ts` links it from every entry document by its headline (FACTS 48). Indexing
   is requested on the day the console publishes it, not at the release (SEARCH.md § 3.2).
2. The page's head, written in full from its first commit:
   `src/features/lessons/kit/lesson-copy.test.ts` reads every `learn/NN.html`, drafts included
   (`:373-408`), and `src/tests/lesson-pages.test.ts` holds every lesson document's head, share
   card and structured data, a draft's included, since a draft the console publishes goes live
   with the head it was built with (`:12-17`, `:112-210`). The hook's copies are the ones the site
   worker rewrites when the console picks the alternative hook (`src/lesson-gate.ts:17-19`,
   `:445-460`); only the meta description and the Article's description, which repeat each other,
   may shorten the hook, and every other copy carries it whole. As Lesson 2's head has them
   (`learn/02.html:9-128`):
   - the title, "Registers and the break: chest and head voice | MercuryPitch" (60 characters, at
     the test's ceiling of 60, `lesson-pages.test.ts:127-128`), which holds the Article's headline
     (`:160`), the query-led form SEARCH.md § 13 item 1 recommends; if the owner keeps the series'
     form, "Registers and the break: Find Your Pitch | MercuryPitch" (55), since "Registers and the
     break: Find Your Pitch, Lesson 11 | MercuryPitch" runs to 66 (Decisions). SEARCH.md § 4's draft
     for Lesson 11, "Registers and the break: why voices flip | MercuryPitch" (`SEARCH.md:229`), is
     not used: "why voices flip" leans on the predict's answer. The worker never rewrites a title.
     The h1 is `h1.hook#hook`, the hook in its default wording (`lesson-copy.test.ts:325-334`;
     Hero);
   - the meta description, "Why does your voice sometimes flip as you slide up? A sixteen-minute
     lesson with sound toys on chest voice, head voice and the break." (133 characters, inside the
     test's 80 to 160, `lesson-pages.test.ts:129-132`, and 156 with the alternative hook written in,
     should the console pick it);
   - `og:title` and `twitter:title`, "Registers and the break: Find Your Pitch, Lesson 11"
     (`learn/02.html:26-29`, `:45-48`);
   - `og:description`, the full hook and one line, "Why does your voice sometimes flip as you slide
     up? Hear Merc's siren flip, then make your guess." (`lesson-copy.test.ts:351-354`;
     `learn/02.html:30-33`), and `twitter:description`, the hook exactly
     (`lesson-copy.test.ts:355-357`; `learn/02.html:49-52`);
   - canonical and `og:url` `https://mercurypitch.com/learn/11`, `robots` "index, follow,
     max-image-preview:large" and `twitter:card` "summary_large_image"
     (`lesson-pages.test.ts:116-134`);
   - `og:image` and `twitter:image`, `https://mercurypitch.com/learn/lesson-11-og.jpg` (item 3),
     with `og:image:width` 1200 and `og:image:height` 630, and as `og:image:alt` and
     `twitter:image:alt` "The title card: Find Your Pitch, Lesson 11, Registers and the break, above
     an amber siren line that jumps across a grey seam, between blue Merc and orange Merc."
     (`learn/02.html:34-43`, `:53-60`);
   - the Article node, in the head's first `application/ld+json` script and as a single object,
     since the test reads `alternativeHeadline` there and checks it only when present
     (`lesson-copy.test.ts:340-348`, `:358`): `@id` `https://mercurypitch.com/learn/11#lesson` and
     `url` `https://mercurypitch.com/learn/11` (`lesson-pages.test.ts:146-147`); the headline
     "Registers and the break"; `alternativeHeadline`, the hook exactly; `description`, the meta
     description's words, and `image`, the `og:image` URL (`:158-159`); `position: 11`,
     `learningResourceType` "Lesson", `timeRequired` "PT16M", `inLanguage` "en-GB", free, the series
     as `isPartOf`, and the organization as author and publisher (`:148-156`), as in Lesson 2's
     (`learn/02.html:69-109`). It has no `datePublished` yet, as the built pages leave it out until
     they go live (`learn/04.html:61-68`): the date is the day the page first goes live on
     mercurypitch.com, which nothing writes at run time, so it is set in the commit that deletes the
     page's `drafts.ts` line or in one straight after the console publishes it, as the owner picks
     (SEARCH.md § 3.2);
   - a BreadcrumbList from the home page to the headline (`lesson-pages.test.ts:163-175`;
     `learn/02.html:110-128`); and the legal links, privacy, terms and imprint, in a `nav` labelled
     "Legal" (`lesson-pages.test.ts:200-209`).

   None of it answers the predict: the title, the hook and the descriptions say a voice may flip,
   never whether a flip is a mistake, and "Hear Merc's siren flip" is the cold open's set-up
   (FACTS 3).

3. The share image the head names, `public/learn/lesson-11-og.jpg`, which
   `src/tests/lesson-pages.test.ts` asks of every lesson document, a draft's included, from its
   first commit: the `og:image` it names is in `public/`, at the pixel size its `og:image:width`
   and `og:image:height` give, with an `og:image:alt` that `twitter:image:alt` repeats
   (`:177-196`). It is 1200 x 630, a baseline JPEG as Lesson 4's card is
   (`public/learn/lesson-04-og.jpg`), drawn with the page's own kit so that it looks like the page
   it opens: the title, Lesson 11 and the wordmark over the range chart's compact still, orange
   Merc's amber siren thick, then thin across the grey seam, between blue Merc and orange Merc. It
   carries no label on the seam and no word but the title's, so it says nothing of whether a flip is
   a mistake and does not answer the cold open's predict.
4. First-paint ceilings for `learn/11.html` in `scripts/assert-first-paint-budgets.mjs`, one in its
   JavaScript table and one in its stylesheet table, beside Lesson 3's (`:103-122`, `:222-225`).
   Every build emits every lesson page, and the check fails a document with no ceiling (`:479-485`),
   so without them the Browser jobs fail before any spec runs, as Lesson 6's did on PR #1149. Each
   is the page's measured first paint plus about a quarter, the tables' rule (`:47-58`, `:178-188`),
   measured in `build:e2e`, where the check runs (`package.json:20`): a build of Lesson 6's page
   alone weighed it about 8 KB lighter. As on Lesson 3, the listener and the pitch detector arrive
   through a dynamic import when Start is pressed
   (`scripts/assert-first-paint-budgets.mjs:108-111`), and the ceiling holds only while that
   boundary does.
5. `kit/range-chart.ts`, new with Lesson 7's page (its Toys 1 and needs 3: "generic over a window,
   a column and its lit band, lines, bands and range bars, so Lesson 11 ... and Lesson 14 can use
   it"), with four options for this page, each off by default (Toys 1): a line's points carrying the
   lower gear's share, drawn as the width between 6 px and 2 px; seams, each a hatched band between
   two pitches across the plot or a slot, at least 2 px tall, with an optional word label; slots,
   which divide the plot's time into equal parts, each drawing its own line and seam; and the
   stretch gauge, a strip outside the canvas whose fill follows the line's time. The column is an
   option too, which this page leaves off. A unit test proves that a chart with none of the new
   options draws as Lesson 7's does.
6. `kit/sound.ts`: two options on `VoiceOptions` (`:30-46`), proposed: `wave`, the partials a voice
   uses whatever its `kind` (today `build` picks them from the kind, `:172-173`), so a Merc voice
   can take the soft partials and keep its vibrato and envelope; and `lowpass`, the filter's
   frequency in hertz (today 2,600 for Merc and 3,400 for the soft tone, `:175-178`). Lesson 7's
   "ng" came another way: the voice's `timbre` option (`:44-45`, `:184`), with `NG` in
   `kit/timbre.ts` (`:28-32`) retuning that lowpass to 900 Hz. Without the two options every voice
   is as today, so Lessons 1 to 7 see no change; a unit test proves it.
7. `kit/siren-flow.ts`, the Sing it flow as a pure rule shared with Lesson 7's page (Toys 4), with
   Lesson 7's reading as an option, so that a flow with no reading never shows a band, a reading or
   "Try again". Lesson 7's page has the rule in `lesson-07/siren-flow.ts`; this page promotes it.
8. `kit/listen.ts`: a `quietAfter` option on `TakeOptions` (`:89-110`), built with Lesson 7's page,
   whose take needs it ("quiet for 1.0 s after at least 2.0 s of voice", its Toys 4): `quiet` ends a
   take only once the take has heard `quietAfter` seconds of voice (`:100-105`), so a breath in the
   first two seconds does not end it; absent, a take ends on `quiet` as before (`takeOver`,
   `:146-160`), so Lessons 3 and 5 see no change. This page needs nothing more of it.
9. `kit/comfort.ts`: an option that sends "Effortful" to the rest card,
   `afterFeeling(f, { restAfterEffort: true })`, since `afterFeeling` leaves it to the coach
   (`:58-67`) and Lessons 6, 7, 9 and 11 all choose it (unit test 13). Lesson 6's page sends
   effort to the rest card in its own flow (`lesson-06/sing-flow.ts:90-95`), so until the option
   lands this page overrides `rest` itself, as that page does. `mountFeelings` needs nothing new:
   its `changeable` option serves Lesson 6's sweeps (`kit/comfort.ts:156-187`), and this page takes
   the default, an answer that locks (Toys 4, state 8).
10. Nothing new for the two sound rules (Audio): their kit parts are on main since #1149.
    `kit/predict.ts`'s `play` may resolve `false` for a play cut short, which the predict then
    never counts as heard, while `true` or nothing keeps the old meaning (`:31-41`, `:184-188`);
    and `NowPlaying`, the page-wide owner, stops the sound before a source that claims it
    (`kit/now-playing.ts:17-39`). A page opts in by handing it to what it mounts (`:14-15`), as
    Lesson 6's cold open does (`lesson-06/cold-open.ts:103`); this page hands it to every source.
11. `recallStepHref` in `kit/quiz.ts`, built: Lesson 8's page moved it there (`:134-136`), and
    Lessons 3, 4 and 5 take it from the kit (`lesson-03/quiz-questions.ts:24`,
    `lesson-04/quiz-questions.ts:32`, `lesson-05/quiz-questions.ts:20`), so Lessons 7, 9 and 11's
    recalls take one address rule, and the addresses did not change.
12. `kit/sing.ts`: an open turn for the ring (`RingRun`, `:44-68`), proposed, for a take whose end
    the singer sets: the progress arc turns once every given period (8.5 s here, 6 s on Lesson 7's
    page) until the take ends it, and the state line holds one word, "Listening", where the turn
    today counts its seconds down (`turn`, `:36-37`).
13. The four-words strip: built, promoted from Lesson 1's page (`lesson-01/words.ts`) into
    `kit/words-strip.ts` with Lesson 7's page; Lesson 6's page keeps its own in `lesson-06/words.ts`.
14. `src/e2e/helpers/tone-wav.ts`: Lesson 7's `writeGlideWav(fromHz, toHz, secondsEachWay)`, built
    with its page (`:94`), beside `writeToneWav` (`:76`); proposed, an optional
    jump, `{ atHz, semitones }`, that leaps the given semitones at that pitch on the way up and back
    down, for the end-to-end test that nothing marks a flip on the viewer's line
    (Tests, end to end 6).
15. `kit/merc-duo.ts`: `ride` and `hum`, proposed, as Lesson 7's spec proposes (Mercs).
16. App: the Siren exercise's help, menu card and slide score, the optional octave fitting, and the
    `/exercises/siren` slug (Practice links).

Lesson 6's page (#1149) also brought kit parts this page does not use: the ear game
(`kit/ear-game.ts`), the tune line (`kit/tune-line.ts`, with its layout, drawing and motion modules)
and the slide guide's `breaths` (`kit/slide-guide.ts:60`). The siren is one breath and draws on the
range chart.

Already on main, so this page needs nothing more from them: run-time publishing (`kit/publish.ts`,
`kit/page-state.ts`, `src/lesson-gate.ts`), which settles the page's chip, its recall's step links
and its next card for the state it is served with; the kit's stage fit (`kit/stage-fit.ts`), the
lesson menu and the remembered steps (`kit/lesson-menu.ts`, `kit/position.ts`), the generated
next-lesson card with the next lesson's tease (`kit/next-card.ts`, its copy from
`kit/lesson-copy.ts`), the step deck that opens at a step an address names (`kit/step-deck.ts`),
Watch only with a published film (`kit/season.ts:23-25`), learner-only explorer cards, the contour
voices (`contourVoice`, `playContour`, `kit/sound.ts:314-347`, `:571-584`), the warm-up
(`kit/warm-up.ts`), the voice choice (`kit/voice-choice.ts`) and the comfort check
(`kit/comfort.ts`). Released lessons need no edit when this page goes live, since every lesson page
draws the season as its state shows it (`kit/page-state.ts:54-57`): Lesson 10's next card turns from
"Coming later" to "Start lesson" and links this page.

## Decisions for the owner

With the recommendation first:

1. **The hook** (FACTS 1): since this package the new wording, "Why does your voice sometimes flip
   as you slide up?", is the default, with the old kept as the alternative `same-note`, whose note
   says it needs a source.
   Recommended: never pick `same-note` until FACTS.md has one, since the console would write its
   claim into the title, the head, every explorer card and Lesson 10's next card. The source to
   look for is a singer's flip followed over repeated slides; Roubeau, Henrich and Castellengo 2009,
   whose full text needs a login, is the likeliest place. Step 3 teaches the opposite of
   `same-note` ("a slide doesn't have to switch at one fixed note"), so the owner may prefer to
   retire it.
2. **The title** (item 2): recommended, the query-led "Registers and the break: chest and head voice
   | MercuryPitch", as SEARCH.md § 13 item 1 recommends; the series' form fits only without "Lesson
   11".
3. **How the gear change sounds** (Audio): the lower gear in Merc's "ooh", the upper in the soft
   tone's partials, both on "ng" through a 900 Hz lowpass with Merc's vibrato, the levels matched.
   Recommended: keep it, and tune it by ear before publishing; if the upper gear sounds like a
   different instrument rather than the same voice changing colour, raise its lowpass or add one
   partial back, and keep the levels matched.
4. **The jump's size** (FACTS 75): 2 semitones in both voices, inside the one woman's range in Švec
   1999 and under its two men's. Recommended: keep it, so each siren keeps most of its glide and the
   model reads as a model; a larger jump for the lower voice would follow the men's figures more
   closely.
5. **The fall at the same notes** (FACTS 29, 75): Merc's sirens jump back down at the notes they
   jumped up at, a simplification of the lab finding that the jump down comes lower. Recommended:
   keep it, with one seam a siren, since Step 3's Go deeper tells the finding in words.
6. **The seam's narrowing** (Toys 1, Smoother): drawn, not animated: each of the five slots holds
   its own seam, so the narrowing reads left to right and nothing moves on its own. Recommended:
   keep it static; an animated seam would read as a promise that practice closes it, which Step 4
   says it does not.
7. **The Siren link** (FACTS 42): linked now, with the card naming its help's line, where Lesson 7
   did not link it. Recommended: link it, and ship the help's new lines (Practice links) so the
   card's sentence about them can go; and land the season entry's link with the page, not before.
   The Siren's slide part, which scores jumps rather than the glide (FACTS 41; App content), is a
   known app bug, filed by the lead with the task #38 follow-ups; until it is fixed, the card and
   the help name only the part of the score that measures how close you come to the second note.
8. **The CURRICULUM card** (FACTS 6): done in this package. Its checkpoint and its Practise line
   match the page: "one slow, quiet siren on "ng", up only as far as is easy" and the Siren exercise
   alone.

## Edge cases

What the page does where nothing above says:

- **No stored voice**: the steps' chart shows the lower voice; Sing it asks after the comfort check,
  before anything plays. A `fyp-voice` holding anything but the two stored values counts as none and
  is overwritten only by a choice.
- **No storage** (blocked, private mode, or a read that throws): every read and write is inside
  try/catch; the page works, asking the voice each visit, reseeding the quizzes and forgetting the
  warm-up's Skip.
- **Sound off**: each play button draws what it would play and shows the kit's hint; the cold open's
  reveal waits for blue Merc's siren to be heard with sound on (Toys 2); Start stays unavailable,
  with state 5's hint, and asks for no microphone.
- **Sound off before a choice**: Play orange Merc's siren draws its line in silence, and the
  sound-off hint takes the place of "Choose an answer to unlock blue Merc's siren."
  (`kit/predict.ts:162-165`); blue's siren stays locked, and its play disabled. Page QA, "The
  predict before a choice".
- **Sound on again, still before a choice**: orange's siren, heard this time, puts the lock hint
  back, since blue's siren is still locked (`kit/predict.ts:166-170`). Page QA, "The predict before
  a choice".
- **Blue's siren cut short** (a Four words play over it, sound turned off, or the page hidden):
  the page's `play` resolves `false`, so nothing is revealed and the hint stays as it was
  (`kit/predict.ts:187-188`): `chosen`, or `silent` if the play before it was silent, whose "play
  it again" still holds now that sound is on. Played again to its end with sound on, it reveals.
  Page QA, "A siren cut short"; unit test 15; End to end 2.
- **No Web Audio**: every play button draws in silence with the hint "This browser can't play sound
  here.", so the cold open's reveal cannot come, as on every page that uses the kit's predict; Sing
  it offers the listen-only path of state 9 at once, with no Start; the Wrap keeps the practice
  card.
- **No microphone, a refusal, or a listener that fails to load**: state 9 of Toys 4.
- **The tab hidden, or the section left, during a take**: the take is abandoned and the microphone
  released; no feeling question follows; the take counts towards the three, and uses the one Again
  up if it had voice (Toys 4, the retry rules).
- **A voice that flips, cracks or jumps during the take**: the violet line shows the jump as the
  detector heard it, and nothing on the page marks, names or counts it; the feeling question comes
  as after any take. A detector's octave error looks the same, and is treated the same.
- **A siren that goes past Merc's, or a hum that hardly moves**: the line is drawn either way, a
  frame past the window pinned to its edge with an arrow; nothing is said about its height or its
  span (REQ-GVC-072).
- **Three takes used**: Again is gone and Start does not come back; Done for today remains.
- **A visitor who types the printed address** (`mercurypitch.com/pitch-training`, without the
  marker) on a first visit meets First Light, whose way out on its first beat is the × labelled
  "Skip the intro"; the page prints no line for it, since its links carry the marker (Lesson 9
  FACTS 56).
- **No WebGL, or a slow device**: the Mercs' stills (`kit/merc-warm.ts`).
- **Lesson 7 never marked done**: the recall still shows, as a prerequisite's does.
- **Lesson 11 published while Lesson 7 is held back**: nothing stops it, since the publish order is
  a rule for whoever uses the console (the intro), so the page follows the state it is served with.
  The site worker, and then the masthead's `followPageState`, make every link to a lesson that is
  not live no link (`src/lesson-gate.ts:515-525`, `:539-559`; `kit/page-state.ts:64-108`, called by
  `initMasthead`, `kit/page-chrome.ts:113`): the "After Lesson 7" chip stays as a plain chip, and
  any other link keeps its words. The kit's quiz does the same for the recall's step links, which
  keep their words, "Try Lesson 7, Step 1 again", with no link (`kit/quiz.ts:179-209`). The recall
  still shows, and the explorer and the lesson menu draw the lesson held back as coming later. End
  to end 13 holds it.
- **The admin console's hook**: picking `same-note` writes it into the h1, the head's copies of the
  hook, every explorer card and Lesson 10's next card (`src/lesson-gate.ts:17-19`, `:445-460`); the
  meta description still fits, at 156 characters; and the page then claims what FACTS 1 cannot
  support, which is why its note says to wait (Decisions, 1).
- **Reduced motion**: Look, Toys 1 and Toys 4 give the end states; nothing moves on its own.

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-11/` and the new kit
parts:

1. The lines (FACTS 75 to 81), for both voices: the cold open's sirens, D4 to B4 and E3 to C♯4, 8.5
   s, gliding at 1.7677 semitones a second with the 2-semitone jump from 1.697 s to 1.737 s and back
   from 6.763 s to 6.803 s; the four words' and Step 1's notes, G♯3 and F♯4, 2.0 s; Step 2's slide,
   4.0 s at speed and 8.0 s slowed; Step 3's slides, the later switch from 2.829 s and Slide 3 at
   2.25 semitones a second with no jump; Step 4's five slides, 3.9 s each with 0.6 s between, 21.9 s
   in all, their jumps 2, 1.5, 1, 0.5 and 0.25 semitones centred on G♯3 (or F♯4), each in 0.04 s,
   up and back at the same notes; Step 5's figure, 3.6 s, its gear changing at exactly the three
   leaps across the seam; Sing it's siren in one gear, E3 to C♯4 and E4 to C♯5, 8.5 s at 2.25
   semitones a second.
2. The gear model: both gears of every line share every point's time and pitch; the two levels add
   to one at every point; a crossfade has a point every 10 ms; the flips' crossfades are 40 ms and
   Step 4's 40, 120, 250, 400 and 600 ms, centred on the jump; Hide the switch holds both at 0.5;
   the width drawn from the lower gear's share is 6 px at 1 and 2 px at 0.
3. Containment: every line Merc sings sits inside the chart's window, and Sing it's siren inside
   every preset of its voice, with at least 3 semitones to spare above, checked against
   `VOCAL_RANGES` imported from `src/stores/settings-store.ts` (FACTS 62).
4. The seams: each drawn from the jump's lower pitch to its upper, at least 2 px tall; at a 310 px
   figure Step 4's stand 20.6, 15.4, 10.3, 5.1 and 2.6 px, and at the 210 px floor 13.4, 10.1, 6.7,
   3.4 and 2 px (FACTS 83).
5. The range chart with this page's options: a chart with none of them paints as Lesson 7's does;
   slots divide the plot's time equally and keep each slide's line and seam in its slot; the
   stretch gauge's fill is a tenth at the slide's start and full at its end, rising evenly in time
   across the jump; and in live mode no seam, label, band or mark is ever drawn on or beside the
   viewer's line, whatever the frames hold, a jump of 2 semitones and an octave error included.
6. The take's minimum (What the kit and the app still need, 8), on synthetic frames at the
   detector's 16 ms hop (`DEFAULT_HOP_SEC`, `src/lib/pitch-measurements/f0.ts:35`): with
   `quietAfter: 2`, 0.8 s of voice, 1.2 s of quiet and 3 s more of voice is one take that ends 1.0
   s after the voice stops; 3 s of voice then 1.0 s of quiet ends there; a voice that never stops
   ends 14 s after it starts; no voice ends after 6 s; without `quietAfter`, a take ends on `quiet`
   as today, so Lessons 3 and 5 see no change.
7. The Sing it flow (`kit/siren-flow.ts`, Toys 4): with no stored voice the voice choice comes
   before either path, and a stored voice starts pressed and can be changed; "Just listen today"
   shows no Start and picks the rest card; Start waits for Merc's siren, and with sound off it stays
   unavailable after Play, with the sound-off hint; without Web Audio, Sing it is listen-only with
   no Start; a take with no voice brings no feeling question and offers Start again while fewer than
   three takes have been made, leaving the visit's one Again unused; "Easy" and "Workable" offer
   Again once a visit, then not; an abandoned take counts, and uses the one Again up if it had
   voice; a walk over every sequence of take outcomes and answers never reaches a fourth take or a
   third sung siren, and never shows Again after "Effortful" or "Uncomfortable"; "Effortful" and
   "Uncomfortable" end the singing for the visit and pick the rest card, and a later "Easy" brings
   back neither Again, Start nor the practice card; "Uncomfortable" takes the viewer's line away;
   with the reading option off, no state shows a band, a reading or "Try again"; the feelings lock
   once answered and free again only for the next take; nothing is written to storage but
   `fyp-voice` and `fyp-l11-warmup`.
8. Copy: every line of LESSON.md's page copy and every template in Toys 1, 2 and 4 passes
   `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts`, surface `finding`); no quiz
   feedback line starts with "Right", "Yes" or "Correct"; no accessible name or live text holds a ♯
   or ♭ sign; no two controls on a stage share an accessible name; and the take's status lines and
   the chart's summary after a take name no flip, gear, switch, break or register.
9. Every fixed sound's frequency equals `hz(m)` for the notes of FACTS 73.
10. The predict (Toys 2): the choice locks on the first press; before it only Play orange Merc's
    siren plays, a silent play of it shows the `silent` hint in place of the lock hint, and a heard
    one puts the lock hint back; after it, the hint reads `chosen`, the reveal stays hidden until
    blue Merc's siren has been heard to its end with sound on, a silent play shows `silent`, and
    orange's siren heard then shows `chosen` again; the reveal's line is "You said: every voice can"
    or "You said: a mistake"; no hint and no line of the reveal says "right" or "wrong"; at the
    reveal each seam's label reads "the switch" (FACTS 11, 13).
11. Quizzes: the recall's ids are `l07-q1` and `l07-q4`, it equals Lesson 7's two questions as its
    module has them, it takes no `lesson`, and its two step links are `/learn/07#step-1` and
    `/learn/07#step-5`; the quick check's ids are `l11-q1` to `l11-q4`, with `lesson: 11`.
12. Season data: Lesson 11's entry has `minutes: 16` and `page: '/learn/11'` in every build,
    whichever way `VITE_DRAFT_LESSONS` reads, as `season.test.ts` checks Lessons 3 to 5's
    (`:241-266`), and the same file's check of every page in the repository then covers it
    (`:286-303`); `seasonFor(LESSONS, defaultPageState(false))` gives Lesson 11 no page and no
    reading time while its line is in `drafts.ts`, and `seasonFor(LESSONS, defaultPageState(true))`
    keeps both, as `publish.test.ts` checks a lesson held back and one published (`:57-91`). That
    file's example of a lesson with no page is Lesson 9 (`:44-55`): if it is still a fixed lesson
    when this page lands, it moves to one the test finds,
    `LESSONS.find((L) => L.n > 0 && L.page === undefined)`, as Lesson 9's spec proposes, so that no
    page's arrival breaks it. Lesson 11's practise link carries `?lesson=11`, and `EDGES` holds
    [7, 11].
13. The kit's new option (What the kit and the app still need, 9):
    `afterFeeling('effortful', { restAfterEffort: true })` is today's answer to "Effortful" with
    `rest: true`; every other answer with the option, and all four without it, give what
    `afterFeeling(f)` gives today (`kit/comfort.ts:48-76`), so Lessons 3 and 5 see no change.
14. One sound at a time, and leaving a step (Audio), with fake timers and a spy on the kit's sound:
    starting any source while another sounds stops the first, both of its gears (a Four words play
    over Step 3's slide; free play over the cold open); with Step 4's five slides sounding, a step
    change by each route, Previous, Next, a swipe, the lesson menu's jump, a `#step-N` address and a
    quick-check step link, stops them, and running the clock past their end starts no note; a layout
    switch, `onStep` with the same step, stops nothing.
15. A play cut short never counts as heard (Audio; Toys 2): the cold open's `play` resolves `false`
    when blue Merc's siren is stopped before its end, by another sound or a stop, and never when it
    runs out; cut short, it leaves the reveal hidden, and played to its end it shows it, as the
    kit's own test does for a stopped run (`kit/predict.test.ts:198-221`).
16. The kit's other new parts: `kit/sound.ts` without `wave` and `lowpass` builds every voice as
    today, and with them takes the given partials and filter; `recallStepHref` from the kit gives
    Lessons 3 and 5's recalls the addresses they gave before (done with Lesson 8's page,
    `kit/quiz.test.ts:317-322`); the ring's open turn takes one period a turn, shows no seconds and
    stops when the take ends.
17. Layout, the pure helper behind Toys 1's targets: at every width from 344 to 1440 px every
    control is at least 44 px wide, with 8 px between neighbours and none overlapping, the picker's
    five segments 52 px each, and free play's state switch in rows of three and two (FACTS 83).

End to end (Playwright, at 390 x 844 and 1440 x 900, on the e2e build, which shows drafts):

1. No AudioContext before the first tap; nothing plays before a play button.
2. Cold open: Play orange Merc's siren plays before a choice; with sound off it shows the sound-off
   hint, and with sound on again it brings back "Choose an answer to unlock blue Merc's siren.";
   Play blue Merc's siren stays disabled until a choice; the reveal appears only after blue Merc's
   siren has played with sound on; with sound off, the hint shows and no reveal comes; blue's siren
   cut short, by the Four words' Flip played over it, brings no reveal until it plays to its end
   (unit test 15); after the reveal each seam reads "the switch".
3. The chart by keyboard alone: Tab reaches every control; the scrub bar moves by arrows, and Home
   and End jump; Slow, the voice switch and free play's state switch toggle `aria-pressed`; the
   picker plays one slide a press; every announcement uses spoken names.
4. At 390 x 844 and at 344 px wide, every target measures at least 44 x 44 px, none overlap and
   nothing scrolls sideways.
5. The stage fits short landscape screens: `src/e2e/learn-stage-fit.spec.ts` holds this page to it
   once it is built, as it holds every lesson page, all of which every build carries (`:31-32`), at
   1024 x 640, 1133 x 631, 1280 x 680 and 1366 x 657 and on a phone held sideways (FACTS 83);
   `src/e2e/learn-no-planning-text.spec.ts` reads it for the team's planning words and every
   variant's note the same way, and `src/e2e/learn-cold-open-fold.spec.ts` holds its title on the
   first screen at seven sizes and reports where Play orange Merc's siren and the two choices sit
   (`:176-203`).
6. Sing it, with the fake microphone (`src/e2e/helpers/tone-wav.ts`, `fakeMicArgs`, `:115`): with
   sound off, Start stays `aria-disabled` after Play Merc's slow siren and the hint says sound is
   off; with sound on, a glide from E3 up to C♯4 and back (`writeGlideWav(164.81, 277.18, 4)`) in
   the lower voice draws a violet line and the summary reads "Your siren, drawn as a line.":
   Chromium loops the file, so the take never falls quiet and runs its full 14 seconds. The same
   glide with a 2-semitone jump at G3 (`{ atHz: 196, semitones: 2 }`) draws the jump in the line,
   and no seam, label or other mark appears on or beside it, and no live text names it. "Easy" shows
   "That's it: one slow siren, done. Flip or no flip, that's a whole siren." and Again, and after a
   second take Again is gone; the Wrap shows the Siren card with "Ten minutes, gently, most days".
   "Effortful" shows the gentle line, no Again, the feelings locked, and the rest card in the Wrap.
   "Uncomfortable" shows the doctor lines, no Again, no violet line, and the rest card. "Just listen
   today" never calls `navigator.mediaDevices.getUserMedia` (a spy), shows the doctor lines and
   leaves the rest card. A refused permission shows the no-microphone line and keeps the practice
   card.
7. The microphone's tracks stop at the end of each take, on leaving the section and when the tab is
   hidden (a spy on `MediaStreamTrack.stop`).
8. The recall shows with an empty `fyp-done`, and answering both its questions marks nothing done;
   its step links are `<a href="/learn/07#step-1" target="_blank">` and
   `<a href="/learn/07#step-5" target="_blank">`; answering all four quick-check questions marks
   Lesson 11 done in the explorer; each feedback line starts "Right." or "Not quite.".
9. Every practice link carries `?lesson=11`; opening `/pitch-training?lesson=11` in a fresh profile
   shows the Exercises tab and no intro, as `src/e2e/lesson-marker.spec.ts:66-75` does for Lesson
   4's link.
10. The Wrap's next card names Lesson 12, says "Coming later" and leads to the map, never to a page,
    as `src/e2e/learn-next-card.spec.ts` checks a card for a lesson not written yet; its tease,
    "Four chords, round and round.", sits one line above the hook, the card's words in the order
    eyebrow, tease, hook and way on, as that spec checks Lesson 1's card (`:102-119`).
11. With reduced motion emulated, a line draws at once, the gauge shows its end, the ring holds
    still with "Listening", and nothing moves on its own.
12. After a full run, storage holds only the keys in the Contract.
13. Published out of order (Edge cases), built like `src/e2e/learn-publish-state.spec.ts`, whose
    `serveWith` writes a state into the page's head as the site worker does (`:31-60`). Served by
    `serveWith(page, '/learn/11', state)` with the state
    `{ drafts: false, lessons: { 11: { published: true }, 7: { published: false } } }`, the page
    keeps "After Lesson 7" as a plain chip (`ul.meta .chip` with that text counts 1 and has no
    `href`) and links `/learn/07` nowhere (`a[href^="/learn/07"]` counts 0), as that spec checks
    Lesson 4's chip for Lesson 2 (`:106-126`); and the recall's answer "A staircase, one step for
    each note" shows "Try Lesson 7, Step 1 again" in its feedback with no link.

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=11`. Then the layout, accessibility, sound, motion and storage
rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children, touch
targets of at least 44 px with no two tap zones overlapping, visible focus, a single dark theme with
every colour a token and an explicit body background, sound only after a tap, localStorage only for
per-viewer conveniences inside try/catch, and the whole page usable with no sound, no WebGL, no
storage and no microphone. Every ♯ the page prints in text (the step notes, the figure's notes, the
chart's summaries) has a spoken name, as Lesson 2's contract sets: the sign is `aria-hidden` and a
visually hidden word follows it (`nameHtml`, `signsHtml`, `kit/notes.ts:204-227`), so a screen
reader says "C sharp"; the figures' accessible names and every live region use words only. The page
stores the quiz seeds and records (`fyp-l11-recall-seed`, `fyp-l11-recall-v1`, `fyp-l11-seed`,
`fyp-l11-quiz-v1`), `fyp-done` (`kit/progress.ts:12`), `fyp-voice` (`kit/voice-choice.ts:20`), the
warm-up's Skip (`fyp-l11-warmup`), the masthead's Pause animations choice, `fyp-motion`
(`kit/motion-switch.ts:12`), and the steps the viewer reached, `fyp-pos` (`kit/position.ts:20`); and
nothing from the take: no frame, no line, no answer to "How did that feel?" and no ending.

Page QA before publishing (PRODUCTION-PIPELINE § 5) adds, for this page:

- The vocal coach has signed the page off, and Lesson 7 is live on the site it is published to: the
  console asks only about the sign-off, and nothing checks the rest (the intro).
- The gear model is heard by ear on a phone's speaker and on headphones: one voice changing colour
  at the switch, the two gears equally loud, and no click at a crossfade (Audio; Decisions, 3).
- **The predict before a choice** (Toys 2; Edge cases): with sound off, Play orange Merc's siren
  draws its line and the hint reads "Sound is off, so nothing played. Turn sound on to hear the
  siren, then play it again." in place of "Choose an answer to unlock blue Merc's siren."; with
  sound on, played again, the lock hint comes back; Play blue Merc's siren stays disabled
  throughout.
- **The predict after a choice** (Toys 2): the hint reads "Locked in. Now play blue Merc's siren."
  and blue's siren has the focus; blue's siren with sound off shows the sound-off hint and no
  reveal; orange's siren, then heard with sound on, puts "Locked in. Now play blue Merc's siren."
  back; blue's siren heard to its end with sound on shows the reveal, its "You said" line and "Play
  either siren again.".
- **A siren cut short** (Toys 2; Edge cases): blue's siren stopped before its end, by a Four words
  play, by turning sound off or by hiding the tab, reveals nothing and leaves the hint as it was;
  played again to its end with sound on, it reveals.
- The Wrap's next card: its still shows the four rooms with no tune note, lit corner, bead or path
  on the ring (Sections, item 8; Lesson 12's WEB-SPEC, Decisions for the owner, item 13).
- The microphone is requested only by Start; "Just listen today", sound off and a refused permission
  never open it; the browser's microphone indicator goes off at the end of each take, on leaving the
  section and when the tab is hidden.
- The network panel shows nothing sent while the microphone is open, and storage holds nothing but
  the keys above.
- The whole page, Sing it included, runs by keyboard alone, and a screen reader hears every state in
  spoken names.
- Nothing marks, names or counts a flip on the viewer's line, a sung flip included; no line after a
  take invites another try; and no visit reaches a fourth take or a third sung siren.
- With reduced motion emulated, nothing moves on its own and the live line draws on a still frame.
- The Wrap shows the rest card after "Effortful", "Uncomfortable" and "Just listen today", and the
  practice card otherwise; neither carries a first-visit line, and the practice link opens the
  Exercises tab with no intro.
- Every step stage fits the four short landscape screens with the masthead (End to end 5), and the
  app-check sweep (`.claude/skills/app-check`) passes at phone and desktop width with Sing it open
  in each state, run locally or on dev, never against production.
