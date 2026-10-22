# Lesson 13 web page: spec

The Lesson 13 page is the web lesson for "Resonance and vowels": written steps, one main figure in
seven states, one predict, a sung checkpoint of one held note through five vowels, two quizzes (the
recall and the quick check) and the lesson explorer. Copy is in [LESSON.md](LESSON.md); every claim
is in [FACTS.md](FACTS.md). It is a text-only package: no film exists for Lesson 13, so the page has
no Watch section and the masthead's anchors are Lesson, Sing and Explorer. It is built on the kit
(`src/features/lessons/kit/`) and, like Lessons 2 to 11, it reuses and never copies: a part that
still lives in an earlier lesson's module, or that an earlier lesson's spec plans to promote, moves
into the kit first. Where this page shares a behaviour with Lesson 3's checkpoint (the comfort
check, the warm-up, the voice choice, "How did that feel?" and the rest card), it is Lesson 3's,
unchanged unless this spec says otherwise. Its hold is Lesson 5's first hold, ten seconds, read by
the kit's hold reader (`kit/hold-take.ts`), and after "Effortful" it follows Lessons 6, 7, 9, 10
and 11: no further hold, and the rest card in the Wrap.

One object carries the lesson across its steps: the vowel figure (Toys 1), the kit's band chart
with Merc's amber line held level at the band's centre, and under it a strip of LED columns, one
column for each harmonic of Merc's note, on a fixed axis from 0 to 4,000 Hz. Merc's ‘ee’ lights it
in the hero; the cold open turns it from ‘ee’ to ‘ah’; the harmonics one at a time, the resonance
curves, ‘ee’, ‘ah’ and ‘oo’, the five vowels and the two voices are each a state of it; at the
checkpoint Merc's ten seconds light it, and while the viewer sings it stays dark under the
viewer's violet line; in the Wrap its states are free play. Motion principle 2, "One object carries
the story across shots and keeps its identity" (`research/brand-motion.md:667`), and playbook rule
6 ask for it, and the CURRICULUM's signature is its moment: "one pitch line, with a harmonic
spectrum underneath whose peaks move as the vowel changes (the stats site's LED analyser motif)"
(FACTS 6). The strip draws Merc's model only, labelled so, and never the viewer's voice (FACTS 40,
44, 59).

Its public home is `mercurypitch.com/learn/13` (MASTER-PLAN § 12 item 9): a hand-written document,
`learn/13.html`, with its module in `src/features/lessons/lesson-13/`, wired as Lesson 5's page is.
Every build carries it, as every build carries every lesson page, and it is a draft, with a line in
`kit/drafts.ts`: the dev site and every PR preview serve it, and on mercurypitch.com the site worker
answers its address with the 404 page until the admin console publishes it, at run time and with no
release (FACTS 9, 64). Whoever publishes it waits for two things: the vocal coach's sign-off, the
hard gate, because it is a voice lesson (MASTER-PLAN § 7, days 1 and 6; § 12 item 8); and Lesson
11's page live at `/learn/11`, because its prerequisite chip and its recall check link there (FACTS
2, 4, 9). Those are rules for whoever uses the console, and nothing enforces them: the console asks
before it publishes a draft that waits on a sign-off, then publishes it on "Publish anyway", and
nothing checks the lessons a page links. A page published early still works, with a plain chip and
unlinked step links where its links to Lesson 11 would be (Edge cases). It is built after Lesson
11's page, whose quiz questions its recall reuses. It opens in Lesson 2's order, the cold open
straight under the title and the recall after it, as MASTER-PLAN § 4.2 now has every page open (§
12 item 13; FACTS 3), and its copy follows the plain-language review's patterns. "What the kit and
the app still need", below, lists the wiring and every kit change.

## Look

Lessons 1 to 11's look, unchanged: the dark listening room, the series colour code, Lesson 1's type
and wordmark, and the motion rules. On this page:

- The band chart is a pitch canvas, so it takes the app's canvas set (Lesson 3 FACTS 59;
  MASTER-PLAN § 5): Merc's line is target amber `#f59e0b`, the viewer's line singer violet
  `#a78bfa`, and the band's lit edge in-tune mint `#80ffca`, as on Lesson 5's hold. Violet means the
  singer only, and mint means in the band only: neither appears in the strip.
- The strip is the stats site's LED analyser (research/stats-motifs.md § 3.14, `:313-314`): each
  column is 12 segments with a 2 px gap between them, lit from the bottom, each segment 3 dB, 36 dB
  in all (FACTS 41). Lit segments ramp from aqua `#2dd4bf` at the bottom to amber `#f59e0b` at the
  top, interpolated a segment at a time; unlit segments are chrome `#c3ccd6` at 8 %. Nothing in the
  strip is violet, mint, rose or gold, so no column reads as the singer, as in tune, as a fault or
  as "the fit".
- The labelled peaks (FACTS 42) carry the motif's white peak-hold cap, a 2 px bar in ink `#e6edf3`
  across the column's top lit segment, and a small chevron above it, so a peak is marked by shape,
  never by colour alone (REQ-GVC-082).
- The bar numbers sit in a row under the strip in JetBrains Mono at 11 px, ink 2 `#a8b3bf`, the
  labelled peaks' numbers in ink and bold. Where columns stand 16 px apart or more every bar is
  numbered; closer than that (the lower voice at 344 px, and below A3), the 1st bar, every 5th bar
  and the labelled peaks are, so no two numbers touch.
- The resonance curves (Toys 1, Step 2) are chrome lines, 1.5 px at 60 %, over the strip.
- Every state of the figure carries the caption "Merc's model" at the strip's top right (FACTS 44),
  and the curves, when shown, "Merc's model too" beside it, so the model is named wherever it is
  drawn.

Two things move on their own: the Merc idle loops. Under `prefers-reduced-motion` they stop, and
every transition this page adds lands in its end state with no travel: a column jumps to its new
height, a change of vowel draws its end, and the take's ring holds still. What the viewer starts
still sounds. For everyone else the masthead's Pause animations toggle stops the same two (WCAG
2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) in Lesson 2's order, with Lessons 2 to 11's departures kept:
the step toys double as the Playground, unlocked in the Wrap; the mix-up card sits in the step whose
toy refutes it; the practice card sits in the Wrap. No Watch section (§ 4.2 item 10). Each
section's heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 1's (wordmark, "Season 1 · Lesson 13", anchors Lesson, Sing and Explorer,
   the Sound toggle off by default, Pause animations with its reduced-motion lock), through
   `initMasthead(sections, { lesson: 13, deck })` (`kit/page-chrome.ts:107-138`): before anything
   else the page's links to other lessons follow the state it was served with (`followPageState`,
   `:111`; `kit/page-state.ts:64-108`; Edge cases), then "Season 1 · Lesson 13" opens the lesson
   menu (`kit/lesson-menu.ts`), and the page's steps are remembered as the viewer moves through
   them (`kit/position.ts`).
2. **Hero**, laid out as Lesson 2's is (`learn/02.html:320-493`). The hero copy holds the kicker;
   the hook question as the title, `<h1 class="hook" id="hook">` in its default wording, the
   season's, which `src/features/lessons/kit/lesson-copy.test.ts` holds every page's title to
   (`:323-332`), with no variant's team note anywhere in the markup (`:412-418`; FACTS 1), and the
   element the site worker writes a picked hook into (`src/lesson-gate.ts:582-583`); the meta as
   four chips ("16 minutes", FACTS 5; "After Lesson 11: Registers and the break", a link to
   `/learn/11`, wholly the link, as Lesson 2's `a.chip.chip-link` is, `learn/02.html:338-343`, so
   that it stays as a plain chip where Lesson 11 is not live; Sound on; Microphone optional); the
   promise; and the sound gate from LESSON.md. Beside it, the stage: the bubbles, orange's "A
   different vowel must be a slightly different note, surely?" and blue's "Watch the line, and
   listen.", and the two Mercs on the floor line either side of the vowel figure in its compact
   state, whose still before any play is ‘ee’ on A3: Merc's level line, the 18 columns lit as the
   model gives them, the 1st and 10th capped. Under the stage, the line that glosses the strip,
   then the cold open's predict card (Toys 2). On a phone (390 x 844) the title, the opening's
   first control, Play Merc's ‘ee’, and the two choices belong on the first screen, and on a tablet
   in landscape (1024 x 640) the stage and the choices too (CURIOSITY-MOMENTS § 3.1, "Above the
   fold", `docs/plans/find-your-pitch/CURIOSITY-MOMENTS.md:300-302`). Of the plan's levers, the
   recall's place is already used, since it follows the predict; the others are the Mercs' size
   (`--merc`, `kit/lesson-stage.css:193`) and the hook's length, and this hook, at 97 characters,
   is a long one: on a phone the strip's gloss may go under the stage's fold before the choices
   do, and the gloss is the line to move below the choices if End to end 5 reports them off the
   first screen. `src/e2e/learn-cold-open-fold.spec.ts` holds the title on the first screen at its
   seven sizes and reports where the first control and the choices sit (`:167-206`).
3. **Recall from Lesson 11**: Lesson 11's questions 1 and 2, for everyone (Toys 5).
4. **Four words you'll meet**: harmonic, spectrum, resonance and formant, each with its definition,
   a small figure and a button (Toys 3).
5. **The steps**: Lesson 1's sticky stage and step deck ("N of 5", Previous and Next), every step on
   the one vowel figure (`toyFor: () => 1`, `kit/step-deck.ts:43-48`), in five states (Toys 1):
   1. What's inside one note? The harmonics, one at a time, then all.
   2. Then what makes ‘ee’ different from ‘ah’? The resonance curves, ‘ee’ and ‘ah’; the Go deeper
      drawer (Toys 4).
   3. What moves a peak? ‘Ee’, ‘ah’ and ‘oo’.
   4. Are five vowels five different notes? The five vowels on one note; the mix-up card (Toys 4).
   5. Does everyone's ‘ah’ have the same peaks? ‘Ah’ in the lower and the higher voice.
6. **Sing it**: the comfort check, the voice choice, the warm-up, the note, the briefing, one
   ten-second hold through five vowels with up to three takes, and the feeling question (Toys 6).
   It follows MASTER-PLAN § 4.2 item 7: the viewer's line against Merc's target band,
   octave-tolerant, with Lesson 5's generous band and its reading of time in the band, language
   about the sound. It reads pitch and nothing else: the strip stays dark while the viewer sings,
   and nothing on the page hears, names, scores or matches a vowel (FACTS 59; Decisions 3).
7. **Quick check**: LESSON.md's four questions (Toys 5).
8. **Wrap**: the three recap lines, the challenge, the practice card in the version Sing it's ending
   picks, free play (Toys 7), and the kit's next-lesson card (`createNextCard(13)`,
   `kit/next-card.ts:181-210`, drawn before `createExplorer`, `:27-30`). The card is Lesson 14's,
   its words the kit's: the eyebrow with the number, the title and the state, then the tease,
   "‘Twinkle, twinkle, little star’, twice. The second ‘star’ swells.", one line above the hook as
   `.next-tease`, the hook as `.q2` and the way on (`:130-146`; FACTS 7), "Coming later" and "See it
   on the map" until Lesson 14's page is live. Its hook and tease are the ones the admin console
   picked, the defaults until it picks (`:14-20`), since the card reads the season as the page's
   state shows it (`pageLessons`, `kit/page-state.ts:54-57`). The tease's figure (Toys 8) sits in
   the page's `[data-next-card]` mark, whose children the kit keeps in the card after its words
   (`kit/next-card.ts:27-29`), as Lesson 2's figures are (`learn/02.html:1776`). The card is a link,
   so the figure holds no button. The practice card is the Voice Mirror card, with "Ten minutes,
   gently, most days" under it; after "Effortful", "Uncomfortable" or "Just listen today" it is the
   rest card instead, without that line (Toys 6). Both link `/mirror?lesson=13` in a new tab.
9. **Lesson explorer**: the kit's, with Lesson 13 as the current node and the line under its
   heading from LESSON.md; its card shows what `kit/lesson-state.ts` says of a live lesson, the
   plate figure (`fig: 'chladni'`, `kit/explorer-figures.ts:188-213`; FACTS 10a), and no Watch
   button, since Lesson 13 has no published film (`kit/season.ts:23-25`).
10. **Footer**: Lesson 1's, with "Season 1 · Lesson 13 · Resonance and vowels"; the practice link,
    printed `mercurypitch.com/mirror` and linking `/mirror?lesson=13`, with "Voice Mirror is free,
    with no account." (FACTS 63); Lesson 1's fonts line and "Every sound on this page is
    synthesised in your browser." (FACTS 65 to 67); no first-visit line, because Voice Mirror is
    its own document (FACTS 63).

## Length

The learner copy is 2,374 words by the review's count (FACTS 5), 5 under the series' cap of 2,379.
The page runs about 16 minutes: 9.97 minutes of reading at 238 words a minute and about 5.5 of
sound, toys and tasks, 15.5 in all. That is past MASTER-PLAN § 4.2's 8 to 12 minutes of active
time, as Lessons 3, 5, 6, 7, 9 and 11 are (15, 17, 15, 16, 16 and 16 minutes), and acceptable by
their precedent. Each step's text, with its Try and its Notice, runs 96 to 117 words (Steps 1 to 5:
117, 107, 110, 96 and 117), inside § 4.2's 50 to 120 a step. Two steps carry more beside it:

- **Step 2, about 185 words.** Its one-item Go deeper drawer (77 words) tells the sopranos'
  finding, and is closed by default.
- **Step 4, about 190 words.** Its mix-up card (92 words) sits in the step whose toy refutes it, as
  in Lessons 2 to 11.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                             | New in Lesson 13                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1. The vowel figure       | The kit's band chart (`kit/band-chart.ts`: Merc's line steady at the band's centre, the vibrato left out, a fixed window, a painter under the plot as Lesson 5's level strip is, `kit/band-chart-hold.ts`); the kit's sound and notes              | The spectrum strip (`kit/spectrum-strip.ts`); Merc's vowel model and its sound; the resonance curves; seven states      |
| 2. Predict widget         | The kit's predict as it is (`kit/predict.ts`), with two choices, a free play and a reveal after one play that is heard to its end                                                                                                                  | ‘Ee’ turning to ‘ah’ on the strip                                                                                       |
| 3. Four words             | Lesson 1's strip of figure, word, definition and button (`lesson-01/words.ts`; Lesson 6's own copy, `lesson-06/words.ts`, takes the page's sound owner), in the kit since Lesson 7's page, `kit/words-strip.ts`                                    | Four small strips                                                                                                       |
| 4. Go deeper, mix-up card | Lesson 2's `details` drawer; the mix-up card's markup                                                                                                                                                                                              | Their copy                                                                                                              |
| 5. Recall and quick check | The kit's quiz as it stands (`kit/quiz.ts`: an id `prefix`, question ids, an optional `lesson` and links away)                                                                                                                                     | Ids and keys                                                                                                            |
| 6. Sing it                | Lesson 3's checkpoint (`kit/comfort.ts`, `kit/listen.ts`, `kit/voice-choice.ts` on `fyp-voice`, `kit/warm-up.ts`, the feeling question, the rest card); Lesson 5's hold (its Move, its Listen · Breathe · Sing ring, `kit/hold-take.ts`, its flow) | Merc's ten seconds through five vowels; the vowel names that light; one hold of three takes; the rest card after effort |
| 7. Free play              | Toy 1's states                                                                                                                                                                                                                                     | One stage with every control                                                                                            |
| 8. The next card's figure | The kit's next card, which keeps a page's figure after its words (`kit/next-card.ts:27-29`)                                                                                                                                                        | A still: Twinkle's first phrase drawn twice, seven amber bands, the second "star" a "?"                                 |

### 1. The vowel figure

One component, the kit's band chart with a new painter under its plot, `kit/spectrum-strip.ts` (What
the kit and the app still need, 6), in seven states: compact, harmonics, resonances, shapes, five
vowels and voices, plus free play (Toys 7) and the live state at the checkpoint (Toys 6). It reads
its columns from Merc's vowel model (`lesson-13/vowels.ts`, needs 7), a pure module, so every number
the strip draws is the one `verify13.py` asserted (FACTS 40 to 42).

- **Drawing.** The band chart's plot on top: Merc's note as the band's centre, the band 35 cents
  either side, a cents axis of ±100 (`axis: { range: 100 }`, `kit/band-chart.ts:39-52`) with only
  the ±35 ticks named, and Merc's amber line drawn left to right as it sounds and level at the
  centre, its vibrato left out as on Lessons 3 and 5 (`kit/band-chart.ts:5-12`; FACTS 43). Under
  it, the strip: one column for each harmonic of the note up to 4,000 Hz, the k-th centred at
  k × f0 on a fixed axis from 0 to 4,000 Hz across the strip, so A3 draws 18 columns 220 Hz apart
  and A4 9 columns 440 Hz apart, twice as far (FACTS 41, 65). Each column is 70 % of the space
  between neighbours; the last may reach into the strip's right inset by up to half its width.
  Its lit segments are the model's level for that harmonic, in 3 dB segments from the voice's
  loudest bar among the five vowels, so the tallest bar of the loudest vowel fills its column and
  a harmonic 36 dB or more below it lights nothing (FACTS 41). The labelled peaks are the model's
  (FACTS 42): the tallest bar, then the tallest bar above it that stands at least one segment over
  both its neighbours, each with the cap and the chevron (Look).
- **Heights.** The figure is the kit's `.viz.tall`, 380 px beside the text, 340 px in the deck and
  310 px at 420 px wide and under (`kit/lesson-stage.css:785-787`, `:1076-1078`, `:1087-1089`). The
  plot takes 30 % of it, rounded, the bar numbers an 18 px row, and 28 px go to the insets, 12 above
  the plot, 8 between plot and strip and 8 under the numbers; the strip takes the rest: at 380 px a
  114 px plot and a 220 px strip, a segment every 18.3 px (16.3 lit); at 340 px, 102 and 192, every
  16.0 px; at 310 px, 93 and 171, every 14.2 px (12.2 lit). This page sets `--viz-min` to 240 px on
  the figure, as Lesson 3's band chart sets its own (`lesson-03/lesson-03.css:171-176`), because 12
  segments need it: at 240 px the strip is 122 px, a segment every 10.2 px (8.2 lit). A stage still
  over budget scrolls inside itself, by 60 px at most (PRODUCTION-PIPELINE § 5).
- **The voice.** The steps sing in blue Merc's lower voice, A3, whatever `fyp-voice` holds, since
  Step 5 compares the two voices and the step copy names the lower voice's bars (FACTS 48); Step 5
  and free play switch it for the visit and store nothing. The cold open is the lower voice too.
- **Changing vowel.** When a play moves from one vowel to the next, the columns follow the sound:
  their heights are the model's levels computed from resonances that glide from one vowel's to the
  next over the change (0.5 s in the cold open, 0.25 s in Step 4 and Sing it), sampled each frame,
  and the caps move to the new vowel's labelled peaks once the change ends. The model gives the
  in-between levels from the same formula, so the drawing never shows a level the sound does not
  have.
- **Compact** (hero and cold open): the steps' figure, with no bar numbers but the labelled peaks'
  and no controls on the figure. Its still before any play is ‘ee’ on A3, the 1st and 10th bars
  capped: the cold open's set-up, which says nothing of what ‘ah’ does. Play Merc's ‘ee’ (Toys 2)
  draws Merc's line again as it sounds, 2.0 s, the strip holding ‘ee’. After the choice, Play
  ‘ee’, then ‘ah’ draws 2.0 s of ‘ee’, the 0.5 s change and 2.0 s of ‘ah’, the columns changing as
  they sound (FACTS 66); ‘ah’ then stays, capped on the 3rd and 5th bars. The drawing is
  `aria-hidden`, and a polite live region speaks for it, in words that never answer the predict
  before its reveal: before any play, "Merc's model: ‘ee’ on A 3, one bar for each harmonic, with
  two peaks marked: the 1st bar and the 10th."; after Play Merc's ‘ee’, "Merc's ‘ee’ on A 3: the
  line stayed level."; after Play ‘ee’, then ‘ah’, "Merc's ‘ee’, then ‘ah’, on A 3: the line stayed
  level."; at the reveal, "‘Ah’: peaks on the 3rd bar and the 5th."
- **Harmonics** (Step 1): the source alone, the 1/k slope through no resonance (FACTS 40, 66). The
  strip draws each harmonic's level against the 1st, which fills its column: the 1st 12 segments,
  the 2nd 10, the 3rd 9, down to 4 for the 18th (`verify13.py`). **Add a harmonic** adds the next
  harmonic and plays the 1st to that one together, 1.5 s, the new column lighting as it joins;
  after the 18th its next press starts again from the 1st alone. **All** plays all 18, 2.0 s, and
  lights all 18. No peak is capped in this state, since the source has none. Merc's line draws
  level through every play (the step's Notice). The readout at the plot's top left
  (`.viz .readout`, `kit/lesson-stage.css:788-795`) reads "A3 · 220 Hz apart" and, under it,
  "harmonics: 3 of 18". The live region: "Harmonics 1 to 3 of A 3: 220, 440 and 660 hertz, 220
  hertz apart." (up to the 18th, "Harmonics 1 to 18 of A 3, up to 3,960 hertz, 220 hertz apart.");
  after All, "All 18 harmonics of A 3, 220 hertz apart. The line stayed level."
- **Resonances** (Step 2): **Resonances** (`aria-pressed`, off at first) draws the model's three
  resonance curves over the strip: each resonator's own response in decibels, its peak at the
  strip's top at its resonance frequency, falling to the strip's foot 36 dB below it, on the same
  0 to 4,000 Hz axis, with "Merc's model too" beside the caption. **‘Ee’** and **‘ah’** each play
  that vowel, 2.0 s, the columns and the curves changing together, and stay; with Resonances on,
  each labelled peak sits under the first or the second curve (`verify13.py`: ‘ee’'s 1st and 10th
  bars under the first and second resonances, ‘ah’'s 3rd and 5th likewise; the step's Notice). The
  live region: "‘Ee’ on A 3: peaks on the 1st bar and the 10th." and "‘Ah’ on A 3: peaks on the
  3rd bar and the 5th."; with Resonances on, each adds "Each peak sits under a resonance's curve."
- **Shapes** (Step 3): **‘Ee’**, **‘ah’** and **‘oo’**, 2.0 s each, as Resonances' vowels play,
  with no curves; ‘oo’ caps the 1st and 5th bars (FACTS 42). The step's first Try, shaping the
  vowels without a sound, needs no control. The live region names the peaks as above, "‘Oo’ on A
  3: peaks on the 1st bar and the 5th."
- **Five vowels** (Step 4, the signature): **Play the five vowels** plays ‘ee’, ‘eh’, ‘ah’, ‘oh’
  and ‘oo’ in turn on A3, 2.0 s each with 0.25 s glides between, 10.0 s, Sing it's demonstration
  (FACTS 53, 66), and the vowel names row under the figure lights each in turn (Toys 6). The
  picker, a group labelled "Play one vowel:", holds five buttons, one per vowel, each playing its
  vowel alone, 2.0 s. Merc's line draws level the whole way. The tallest bar goes from the 1st to
  the 2nd, the 3rd, the 2nd and the 1st (FACTS 42; the step's Notice). The live region after the
  five: "The five vowels on A 3. The line stayed level. The tallest bar was the 1st, then the 2nd,
  the 3rd, the 2nd and the 1st."
- **Voices** (Step 5): **Lower** and **Higher**, a voice switch (`aria-pressed`, Lower pressed at
  first), each playing ‘ah’ in its voice, 2.0 s: the lower voice on A3 with blue Merc singing, its
  18 columns capped on the 3rd and 5th; the higher on A4 with orange Merc, its 9 columns twice as
  far apart and its tallest the 2nd, 880 Hz, with no second labelled peak (FACTS 42). Each voice's
  columns are drawn against its own loudest bar (FACTS 41). The plot's band follows the voice's
  note. The live region: "Lower voice, ‘ah’ on A 3: 18 bars, 220 hertz apart. The tallest is the
  3rd." and "Higher voice, ‘ah’ on A 4: 9 bars, 440 hertz apart. The tallest is the 2nd."
- **Live** (Sing it): Toys 6.
- **Layout and targets** (FACTS 68). The stage fit is the kit's, so the page sets no figure height
  of its own beyond `--viz-min`: on every step the deck measures what the toy needs besides its
  figure (`kit/step-deck.ts:15-17`; `fitStage`, `kit/stage-fit.ts:38`), and the figure gives way to
  it down to the floor. On a phone at 390 x 844 the stage card is 358 px inside the 16 px gutters
  and the figure's canvas 354 px, so the strip, the canvas less 14 px each side, is 326 px wide: the
  lower voice's columns stand 17.9 px apart (12.6 px wide) and the higher's 35.9 px; at 344 px the
  strip is 280 px and Move's lowest note, F3, gives the closest columns, 22 of them 12.2 px apart
  and 8.6 px wide (`verify13.py`). Every target is at least 44 px square, with 8 px between
  neighbours, at every width from 344 px up, and no column, curve or number is a target. Controls
  sit under the canvas in rows, as the kit's rows wrap:
  - Step 1: Add a harmonic and All, two a row at 173.0 px each at 390 px (150.0 px at 344 px).
  - Step 2: Resonances, ‘ee’ and ‘ah’, three a row at 112.7 px (97.3 px at 344 px).
  - Step 3: ‘ee’, ‘ah’ and ‘oo’, three a row.
  - Step 4: Play the five vowels on a row of its own; the picker on a row of its own, five a row
    at 64.4 px (55.2 px at 344 px).
  - Step 5: Lower and Higher, two a row.

  Keep each step's chrome, its stage less the figure, under about 375 px at 1133 px wide, so every
  step's stage fits the short landscape screens with the masthead (End to end 5): the tallest is
  Step 4's, two rows of 44 px with the status line.

- **Keyboard and screen readers.** The figure is a group with a live summary in spoken names,
  never the sign: "A 3", "C sharp 4". Every control is a button; Resonances and the voice switch
  carry `aria-pressed`. Each vowel button's accessible name begins with its visible label and adds
  the British word FACTS 38 gives for its vowel: "ee, as in key", "eh, as in pet", "ah, as in half",
  "oh, as in paw" and "oo, as in coo"; Add a harmonic's names the harmonic it adds, "Add a
  harmonic: the 4th, 880 hertz". No two controls on the stage share a name: Step 5's switch is
  "Lower voice, A 3" and "Higher voice, A 4", distinct from Sing it's voice buttons and from its
  Lower and Higher, which move the note. Tab order: the state's own controls in reading order.
- Under reduced motion a column jumps to its height, a change of vowel lands on its end, the caps
  move at once and the line draws whole; a played sound still sounds.

### 2. Predict widget

The kit's predict as it is on main (`src/features/lessons/kit/predict.ts`, with #1149's `play` that
reports a play cut short and #1160's hint rules; FACTS 12). Every line cited in this section is
that file's unless it says otherwise.

- `mountPredict` (`kit/predict.ts:79`) takes two to four choices: here two `.choice` buttons,
  `data-choice` "heights" and "places", labelled "Their heights" and "Their places", each at least
  44 px tall. The choice locks: the pressed one shows pressed and both are disabled (`:106-113`).
  It opens the play `data-play` "ee-ah", labelled "Play ‘ee’, then ‘ah’", which starts disabled in
  the markup, and moves the focus to it (`:114-121`).
- **Play Merc's ‘ee’** is a `data-free` play inside the predict's root: it works before the
  choice, so the sound comes first (playbook rule 5), and it never reveals, since ‘ee’ alone
  answers nothing (`:14-16`, `:92-96`).
- `revealOn: ['ee-ah']`, with the default `revealAfter: 'any'` (`:52-58`): the reveal waits until
  ‘ee’, then ‘ah’ has been heard to its end with sound on (`heard`, `:146-160`). The page's `play`
  claims the page's sound owner before it sounds and resolves `false` when another sound, or a
  stop, cuts it short (`:30-40`; Audio), as Lesson 6's cold open does
  (`lesson-06/cold-open.ts:101-118`), and the kit then reveals nothing and leaves the hint as it
  was (`kit/predict.ts:170-174`). A play with sound off that draws its strip to its end resolves
  `true`, so the kit can say that nothing was heard (`:148-151`).
- The hints. The page's own lock hint, in the markup, is LESSON.md's "Choose an answer to unlock
  ‘ee’, then ‘ah’.", and the kit keeps it to put back (`:83-84`). The kit's three (`:41-51`):
  `chosen`, "Locked in. Now play ‘ee’, then ‘ah’."; `silent`, LESSON.md's "Sound is off, so nothing
  played. Turn sound on to hear it, then play it again."; and `again`, "Play either again." This
  page has no `next`, since one play reveals, so after a choice a heard play that does not reveal,
  Merc's ‘ee’, shows `chosen` (`:47-48`, `:159`).
- `guess` gives "You said: their heights" or "You said: their places", in Lesson 2's form
  (`lesson-02/cold-open.ts:34-37`), and the reveal's text is LESSON.md's for either choice. It
  answers "Their heights" first; its "(The peaks did move along the strip, so ‘their places’ was a
  fair guess.)" consoles the other choice with what is true of it (FACTS 13). `onReveal`: the live
  region speaks the reveal's peaks, and orange celebrates once (Mercs).
- States, and what a play that runs to its end does in each (`heard`, `kit/predict.ts:146-160`):
  - **Waiting for a choice.** The lock hint shows. Play ‘ee’, then ‘ah’ is disabled, and the kit
    ignores it before a choice too (`:165`); Play Merc's ‘ee’ works. Played with sound off, Merc's
    ‘ee’ draws its line and its strip, and `silent` takes the lock hint's place (`:148-151`). Heard
    with sound on, still before a choice, it puts the page's lock hint back, since ‘ee’, then ‘ah’
    is still locked (`:152-156`).
  - **Choice made, ‘ee’, then ‘ah’ not heard yet.** The choice shows pressed and locked, Play ‘ee’,
    then ‘ah’ is open and has the focus, and the hint reads `chosen` (`:106-124`). Merc's ‘ee’
    heard with sound on shows `chosen` again, in place of `silent` if sound off had left it there,
    and reveals nothing (`:159`). Either play with sound off draws its strip and shows `silent`, and
    the reveal stays hidden (`:148-151`).
  - **Revealed.** ‘Ee’, then ‘ah’ heard to its end with sound on shows the reveal, with its "You
    said" line, and the hint reads `again` (`:126-142`, `:157-158`). Later plays, sound on or off,
    change neither (`:147`).

  In every state a play cut short reveals nothing and leaves the hint as it was
  (`kit/predict.ts:173-174`). The predict's own two plays never cut each other short: a tap on one
  while the other plays does nothing (`busy`, `:165`). So a play here is cut short only by another
  source taking the page's sound (a Four words play, a step toy: Audio), or by sound turned off or
  the page hidden, which stop every voice (`kit/sound.ts:475-477`, `:507`).

- The tests that hold each state. The kit's own (`src/features/lessons/kit/predict.test.ts`): a
  free play that works before a choice and never reveals (`:264-278`), the lock hint back after a
  free play heard before a choice (`:218-240`), `chosen` in place of `silent` after a choice
  (`:242-262`), the sound-off hint after a choice (`:131-147`) and the play cut short (`:176-199`).
  The page's: unit test 11 holds every state above, unit test 16 the play cut short, and End to
  end 2 the cold open in a browser (Tests).
- The strip changes with sound off as with sound on, as every kit predict's visuals run
  (`kit/predict.ts:30-36`); only the reveal's words wait for the sound (Edge cases).
- Under reduced motion the reveal appears without its rise (`kit/predict.ts:135`).

### 3. Four words

Lesson 1's strip of four, each figure a small copy of the vowel strip with no band chart:
**Harmonic** plays the 1st harmonic of A3, then the 2nd, 220 and 440 Hz, pure tones, 1.0 s each
with 0.3 s between, beside two columns that light in turn; **Spectrum** shows ‘ee’'s strip
lighting from the foot, silent; **Resonance** shows one curve over a dim strip, peaking at the first
resonance, silent; **Formant** shows ‘ee’'s strip with its two peaks capped, silent (FACTS 66).
Each button carries LESSON.md's label: "Play: the 1st harmonic of A3, then the 2nd", "Show: the
strip lights", "Show: a curve over the strip, peaking at one resonance" and "Show: the two peaks of
‘ee’ marked", and its accessible name begins with it. A Show replays its drawing, and under reduced
motion lands on its end.

### 4. Go deeper and the mix-up card

A `details` disclosure, closed by default, under Step 2's text, holding LESSON.md's item; it plays
no sound. The mix-up card under Step 4's text is the series' card, its four labelled parts in
LESSON.md's words, with no control.

### 5. Recall and quick check

The kit's quiz as it stands carries everything two quizzes on one page need (`kit/quiz.ts`): an id
`prefix` for each quiz's elements (`:81-86`), question ids, from which a question's lesson is read,
an optional `lesson`, and links that leave this page for a question from another lesson (`linkAway`,
`:173-203`), which keep their words and drop the link where that lesson is not live (`:193-196`).

- **Recall**: Lesson 11's questions 1 and 2, word for word with their feedback (LESSON.md; FACTS 4),
  under their Lesson 11 ids, `l11-q1` and `l11-q2`, with the prefix `rc-`, as Lessons 3 and 5's
  recalls have (`lesson-05/recall.ts:14-21`), shown to everyone (Lesson 11 is a prerequisite).
  Reshuffled from a seed of its own (keys `fyp-l13-recall-seed` and `fyp-l13-recall-v1`); earlier
  answers are never shown, so the answers measure delayed retrieval (MASTER-PLAN § 9). It takes no
  `lesson`, so it marks nothing done. Neither question plays a sound. The two questions come from
  Lesson 11's own module, `lesson-11/quiz-questions.ts`, once its page is built, filtered by id, so
  the recall cannot drift from Lesson 11's quiz, as Lesson 5's recall is held to Lesson 3's
  (`lesson-05/quiz-questions.test.ts`). The kit turns "Try Step 2 again" and "Try Step 3 again"
  into "Try Lesson 11, Step 2 again" and "Try Lesson 11, Step 3 again" (`quiz.ts:190-192`), links
  that open Lesson 11's page at that step, `/learn/11#step-2` and `/learn/11#step-3`, in a new tab
  so the viewer keeps their place here (`:197-201`), never `data-goto-step`, which would move this
  page's own deck; where Lesson 11 is not live, each keeps its words with no link (Edge cases). The
  address is the quiz's `away.href`, `recallStepHref`, which moves into `kit/quiz.ts` from the two
  copies Lessons 3 and 5 keep (`lesson-03/quiz-questions.ts:24`,
  `lesson-05/quiz-questions.ts:19-20`; needs 11), and the kit's step deck opens at the step an
  address names (`stepFromHash`, `kit/step-deck.ts:78-84`), as Lesson 11's will.
- **Quick check**: LESSON.md's four questions, ids `l13-q1` to `l13-q4`, keys `fyp-l13-seed` and
  `fyp-l13-quiz-v1`, and `lesson: 13`, so answering all four marks Lesson 13 done in the explorer.
  Three answers each, shuffled per question from the stored seed, one-line feedback for every
  answer, and a check icon and ink (not gold) on the right one. The kit prints "Right." or "Not
  quite." before each line (`quiz.ts:278`), so no feedback line starts with "Right", "Yes" or
  "Correct". "Try Step 1 again", "Try Step 3 again" and "Try Step 4 again" use the kit's
  `data-goto-step`. No question plays a sound. LESSON.md's note on the shuffle is editorial and
  never printed. Answers stay in the viewer's browser until the telemetry track exists.

### 6. Sing it: one note, five vowels

The band chart in hold mode with the strip under it, inside Sing it's card: the kit's `.sing-chart`
with this page's `.vowel-chart`, 340 px tall (310 px at 420 px wide and under, the step figure's
heights, so the strip's segments are the ones Toys 1 gives), its frame fixed at ten seconds with
the seconds named under the plot (`setWindow(10)`, `timeTicks`; `kit/band-chart-hold.ts:1-13`, as
Lesson 5's hold chart is, `learn/05.html:1531`). Under the chart, the vowel names row: an ordered
list of the five vowels, ‘ee’, ‘eh’, ‘ah’, ‘oh’ and ‘oo’, each in a 44 px tall cell, not a target;
the vowel of the moment is bold, underlined and `aria-current="step"`, so it never rests on colour
alone. Every state has a visible status line that is also announced (`aria-live="polite"`); the
names row is not announced as it changes, so a screen reader is not talked over, and the status
line says once what the names do.

While Merc sings, the strip lights with Merc's model on the hold's note, changing with his vowels.
While the viewer sings, the strip stays dark, its segments all unlit, and only the viewer's violet
line draws against Merc's band (FACTS 59). Nothing on the page reads anything from the microphone
but pitch frames: no analyser, no spectrum, no level, and no vowel (Decisions 3).

States:

1. **Comfort check**, always first and asked every visit (never stored): Lesson 5's status line,
   "Before you sing: how is your voice today?" (`learn/05.html:1319`), LESSON.md's head line,
   "Sore, hoarse or unwell today? Just listen along.", Lesson 3's list naming all six of
   REQ-GVC-020's conditions, and its two buttons (FACTS 45, 46), through the kit's `mountComfort`
   (`kit/comfort.ts:111-119`).
2. **Voice choice**, after either comfort answer: Lesson 3's two buttons with the Mercs' stills
   (`aria-pressed`, at least 44 px), under LESSON.md's line in its two forms, "Choose a voice to
   sing with. If you chose one in an earlier lesson, pick it again:" with none stored and "Keep the
   voice you chose before, or change it:" with one (FACTS 48). It reads and writes `fyp-voice`
   through `VoiceChoice` (`kit/voice-choice.ts:20-47`). A stored choice shows pressed and can be
   changed; with none stored, neither is pressed and the next state waits for a choice, before
   "Just listen today" plays anything too, because the voice picks the Merc who sings.
3. **Just listen today** (listen-only mode): LESSON.md's line with the doctor lines (FACTS 47);
   **Play Merc's ten seconds**, which sings the five vowels on a tap in the chosen voice on its A,
   the strip lighting and the names row with it; nothing listens, the warm-up, the note and Start
   are not shown, and nothing asks the viewer to sing (REQ-GVC-021). The Wrap shows the rest card.
4. **Warm-up**, optional, with Skip: Lesson 3's words and its two plays, Play Merc's sigh and Play
   the slide, in the chosen voice (`warmUpContour`, `kit/warm-up.ts:24-36`), with "Copy the way
   Merc's voice slides, not the exact notes." and the stop line (FACTS 49, 51). Nothing listens and
   nothing is scored (REQ-GVC-074, REQ-GVC-075). The Skip is stored as `fyp-l13-warmup`, as Lessons
   3 and 5 store theirs (`lesson-05/sing.ts:54`).
5. **Note**: LESSON.md's "Your note is Merc's A: move it Lower or Higher until it sits easily.",
   with Lesson 5's **Lower** and **Higher** (a semitone a tap, up to four either way, F3 to C♯4 or
   F4 to C♯5: FACTS 52; `MAX_MOVE` and `holdNote`, `lesson-05/sing.ts:55-56`, `:84-86`): each tap
   plays Merc's ‘ah’ on the new note for 1.0 s, the strip lighting it (FACTS 66). Their accessible
   names are "Lower: move the note down a semitone" and "Higher: move the note up a semitone", and
   the status line names the note in words ("Your note: G sharp 3"). The move lasts for the visit
   and is not stored. It comes before Start: finding the note needs no microphone.
6. **Briefing**: the "What this does" box (REQ-GVC-002, REQ-GVC-003, REQ-GVC-012, REQ-GVC-026;
   FACTS 57), LESSON.md's Listen · Breathe · Sing paragraph with the stop line, and **Start**, the
   only control that asks for the microphone (MASTER-PLAN § 4.2 item 2).
7. **Hold**, ten seconds, in three phases shown on the ring as **Listen · Breathe · Sing**, as on
   Lesson 5 (`kit/sing.ts:1-14`; FACTS 53). Listen: Merc sings the five vowels on the note, 2.0 s
   each with 0.25 s glides, 10.0 s, the singing Merc in `sing` and the other listening; the strip
   lights and the names row lights with each vowel. Breathe: the ring breathes once over 2 s from
   the end of Merc's demonstration, with "Breathe in, low and quiet"; nothing counts down. Sing: the
   status reads "Sing ‘ee’, ‘eh’, ‘ah’, ‘oh’ and ‘oo’, two seconds each, moving on as each name
   lights up."; the ring turns from the first voiced frame and closes over the ten seconds; the
   violet line draws on the fixed frame, folded into Merc's octave; both Mercs `listen`; the strip
   stays dark. The take opens 0.4 s after Merc's demonstration ends, during the Breathe ring, with
   every sound held off while it is open (`Sound.hush`, `kit/sound.ts:538-541`). It waits up to
   6 s from opening for the first voiced frame, then runs exactly 10 s from it, timed on the
   frames' own clock; it ends sooner only if the voice stops for more than 1 s, so a breath of under
   a second between vowels does not end it, though its silence counts as time out of the band
   (`HOLD_WAIT_SEC`, `HOLD_QUIET_SEC`, `kit/hold-take.ts:39-44`, and the reader's rules, `:1-31`).
   The names row lights ‘ee’ as the take opens and ‘eh’, ‘ah’, ‘oh’ and ‘oo’ at 2, 4, 6 and 8 s
   from the first voiced frame, on the frames' clock (the listener's `onFrame` gives the first
   voiced time, `kit/listen.ts:89-110`): a pace, never a check, and nothing on the page compares
   the voice with the vowel lit. Nothing on the page extends the take. The microphone is released
   when it ends.
8. **Reading**: one line from the kit's hold reader (`readHold`, `kit/hold-take.ts:265`), unchanged:
   the time in Merc's band out of the ten seconds, rounded down to 0.1 s, and when the line
   settled, or the stop line for a hold cut short, with the octave line within 50 cents
   (`:231-259`, `:74-75`; FACTS 53). LESSON.md's examples are illustrations. If no voice came
   within 6 s, the line is the kit's `NO_START_LINE` (`:48-49`), with **Again** while the visit
   has had fewer than three takes (the take counts as one) and **Done for today**, and no feeling
   question, since nothing was sung. Otherwise **How did that feel?** follows at once
   (REQ-GVC-022). The chart's summary after a take reads, for example, "Merc's note A 3; your line
   in the band for 8.4 of 10 seconds, settled after 0.5 seconds", Lesson 5's form (REQ-GVC-085),
   and names no vowel.
9. **How did that feel?**: Lesson 3's four answers (`aria-pressed`, at least 44 px, a 2 x 2 grid on
   phones), through `mountFeelings` (`kit/comfort.ts:121-152`) with its default, an answer that
   locks, asked after each take with voice (FACTS 54): a press disables all four, and `reset()`
   frees them for the next take, so an answer cannot be changed once it has set what follows.
   Lesson 6's `changeable` option is left off. What each answer allows comes from `afterFeeling`
   (`:48-76`) with the proposed `restAfterEffort` (needs 10).
   - Easy or Workable: Merc `celebrate`s if the take was in the band for at least 80 % of its ten
     seconds, at most once a visit; rule 15's line, "If that felt tricky, good: that's learning."
     (`TRICKY_LINE`, `kit/take.ts:155`), if it was in the band for under half; then Lesson 5's
     "Rest for a few easy breaths. Ready when you are.", with **Again** (named "Again: one more
     hold") while the visit has had fewer than three takes, and **Done for today**. The Wrap shows
     the practice card.
   - Effortful: the reading stays, with no celebration; Lesson 3's "Keep it gentle: rest before you
     sing again."; no Again and no further hold this visit, only **Done for today**; Play Merc's
     ten seconds stays, and Start goes. The Wrap shows the rest card, as Lessons 6, 7, 9, 10 and 11
     specify: a report of effort suppresses immediate-repeat encouragement (REQ-GVC-021,
     REQ-GVC-055).
   - Uncomfortable: the reading and the viewer's line are taken away, then Lesson 3's "Thanks for
     saying so. That's enough singing for today: rest your voice." with the doctor lines; no Again
     and no further hold; the microphone stays off. The Wrap shows the rest card (REQ-GVC-023,
     REQ-GVC-024, REQ-GVC-055).
   - Once "Effortful" or "Uncomfortable" has been answered, no further hold and the rest card stay
     so for the visit. The page keeps the ending in memory for the visit, never in storage
     (`VisitEnding`, `kit/comfort.ts:84-102`).
10. **Done for today** ends the checkpoint with the status "Done for today." and leaves the Wrap's
    card as the answers so far have set it.
11. **No microphone** (refused, no device, or the listener failed to load): listen-only mode with
    LESSON.md's "No microphone?" line; Play Merc's ten seconds still plays, and the Wrap keeps the
    practice card, since singing along with nothing listening is no report of effort (Lesson 3's
    rule). Without Web Audio (no `AudioContext` in the browser), nothing can play and the listener
    cannot run, so Sing it offers this listen-only path at once, with no Start: Play Merc's ten
    seconds draws the strip in silence, with the hint "This browser can't play sound here."

The dose and the retries, all in the flow rule below (FACTS 53, 54):

- One hold, ten seconds, Lesson 5's first hold, which the owner set on 19 October 2026, and one of
  the house lengths (5, 10 or 15 s); there is no longer hold, and nothing rewards length
  (REQ-GVC-070).
- A visit allows at most three takes, every take counted: one with no voice, and one abandoned when
  the page was hidden. So a visit holds at most 30 seconds of singing on the note.
- Again comes only after "Easy" or "Workable", or after a take with no voice. Never a retry after
  "Effortful" or "Uncomfortable": once either has been answered, no Again and no Start appear for
  the rest of the visit.
- A take abandoned when the page was hidden asks no feeling question, and Start comes back while
  takes remain.
- Merc's demonstration cut short, by a tap on any other sound on the page or by leaving the section,
  cancels that hold before the take opens: the microphone is released, the hold counts as no take,
  and Start comes back.
- No line after a take invites another try, so no retry wording can show without an Again.

The flow is a pure rule, Lesson 5's `lesson-05/hold-flow.ts`, moved into the kit as
`kit/hold-flow.ts` with the hold lengths as data (Lesson 5 passes ten seconds then fifteen, this
page ten alone), `TAKES_PER_HOLD` 3, `CELEBRATE_SHARE` 0.8 and `TRICKY_SHARE` 0.5 unchanged
(`lesson-05/hold-flow.ts:28-37`; needs 8). From the comfort answer, the voice, whether sound and Web
Audio are on, the takes so far (how many, and for each whether it had voice, whether it was
abandoned and its share in the band), and the answers so far (the latest, and whether "Effortful" or
"Uncomfortable" was ever answered), it gives the state, the controls shown, the lines, whether Merc
celebrates and the Wrap's card, so every branch above is unit-tested without a microphone (Tests,
6).

Listening: Lesson 3's `kit/listen.ts` unchanged, through Lesson 5's hold runner moved into the kit
(`holdOne`, `lesson-05/sing-hold.ts:116-169`; needs 9) with Merc's Listen phase passed in, so
Lesson 5's passes its two-second note and this page its ten seconds of vowels:
`micManager.acquire('lesson-13')` for each take (`kit/listen.ts:59`), released when it ends, on
leaving the section, on `pagehide` and when the tab is hidden (`:18-22`); the YIN-only F0 stream;
one AudioContext through `Sound.context()`, so every note Merc sings and every frame the take
hears share a clock; nothing plays while a take is open. The frames are read for pitch and then
dropped: nothing is recorded or kept, nothing leaves the device, and no event carries a frame, a
reading or an answer; at most a count-only "checkpoint finished" event once the Lesson telemetry
track exists (REQ-GVC-090; FACTS 57). The listener and the hold reader arrive through a dynamic
import when Start is pressed, as on Lesson 5, so a page that is only read never loads them
(`kit/listen.ts:5-8`).

Accessibility and motion: no state carries meaning in colour alone (REQ-GVC-082). After a take the
chart's summary names the note and the time in the band, never a vowel (REQ-GVC-085). Start, Again,
Lower, Higher, Done for today, the comfort and voice buttons and the four feelings are real buttons
of at least 44 px in a keyboard order that follows the flow; a button the flow does not offer is
absent, not disabled, except the feelings once answered, as the kit has them; Space never starts a
take by itself (REQ-GVC-080). Under reduced motion the ring shows the phase and the seconds as words
and a number, the names row changes without a transition, and the Mercs skip their reactions
(REQ-GVC-083).

### 7. Free play

In the Wrap, the vowel figure on one stage with every control, unlocked once the viewer reaches the
Wrap (playbook rule 17): the voice switch, Lower and Higher (`aria-pressed`), named as in Step 5, on
a row of its own, two a row; Resonances on a row of its own; the five vowel buttons, five a row;
Play the five vowels and All harmonics, two a row. A vowel button plays its vowel in the chosen
voice on its A, 2.0 s; All harmonics plays the source alone, as Step 1's All. The switch changes the
figure's voice for the visit and stores nothing. It sits in the Wrap, not in the stuck deck, so it
scrolls with the page; on a phone its stage stays under about 700 px. Its live region speaks as Toys
1's states do.

### 8. The next card's figure

A still in the page's `[data-next-card]` mark, drawn once at load as an SVG with no motion:
Twinkle's first phrase as Lesson 14's song line draws it (Lesson 14 WEB-SPEC, Toys 1, on main),
drawn twice side by side. Each copy is the phrase's seven notes as amber `#f59e0b` bands at their
heights, from D3 in the lower voice, D3 D3 A3 A3 B3 B3 A3, each 35 cents either side over its own
time, the six crotchets and the closing minim, with Merc's line through each, as that toy's compact
state draws line 1, its bands unlit, but without its words. In the second copy the seventh band,
"star", holds a "?" in ink and no line. It draws no mint, which in the series means a line in the
band, and no breath mark, no swell and no light that grows. Lesson 14's predict asks what "star"'s
line will do as it swells, [ It rises ] [ It stays level ], so a second "star" drawn in its band, or
with a swell, would answer it (FACTS 7). It is `aria-hidden` and claims nothing: the card's words
carry the meaning, the default tease or `band` alike. CURIOSITY-MOMENTS' Lesson 13 Tease draws the
same still.

## Audio

Every tone is synthesised in the page with Web Audio at the frequencies in FACTS 65, through the
kit's sound module and its house envelopes (`.claude/memory/audio-pop-free-playback.md`), and
started only by a tap: Merc's vowels and the source in the vowel model below; the four words' two
pure tones; the warm-up's sigh and slide in Merc's "ooh", as on Lesson 3. Nothing autoplays,
nothing plays while a take is open, and the page has no music bed.

The vowel model (FACTS 40), Merc's model, labelled so on the figure:

- Each sung line is one of the kit's contour voices (`contourVoice`, `kit/sound.ts:321-347`) in
  Merc's kind (`kind: 'merc'`), so it keeps his vibrato, 5.5 Hz and ±14 cents grown in over 0.35 s,
  his attack and release, and his gain, 0.2 (`:181-204`; FACTS 43). Two proposed options change
  what it is made of (needs 5): `partials`, the source, every harmonic of the note up to 4,000 Hz at
  1/k of the first, in place of the "ooh"'s eight; and `resonators`, three lowpass biquads in
  series, in place of the 2,600 Hz lowpass, each at one of the vowel's three resonance frequencies
  from FACTS 37 (the men's means for the lower voice, the women's for the higher), with its Q set
  to the frequency over the bandwidth, 80, 80 and 120 Hz, given to the Web Audio filter in decibels,
  20 log10 of that ratio. A voice that passes neither is built as today.
- A change of vowel within a line is a contour point that carries the next vowel's resonances: the
  filters' frequencies glide to it exponentially, as the pitch does, and their Q in decibels
  linearly, over the change (0.5 s in the cold open, 0.25 s in Step 4 and Sing it). The pitch does
  not move: every point of a line holds the note's frequency, so Merc's line is level because the
  note is exact (FACTS 43).
- Equal power: each vowel on each note is scaled so its power, the source through its three
  resonances, equals the unfiltered source's, by a factor the vowel model computes; the factors run
  from 0.28 to 0.71 in the lower voice and from 0.11 to 2.64 in the higher, over every note Move
  reaches (FACTS 67). A play's `gain` is Merc's 0.2 times the largest factor among the vowels it
  sings on its note, and each point's `level` is its vowel's factor over that largest, so every
  level is at most 1, as `ContourPoint.level` asks (`kit/sound.ts:271-278`), and the level glides
  with the resonances. The master gain and compressor stay as they are (`:109-118`). The voice's
  overall loudness is matched by ear to Merc's "ooh" on Lessons 3 and 5 before publishing, on a
  phone's speaker and on headphones (Decisions 2; Contract).
- The source alone (Step 1, free play's All harmonics) is the same voice with `partials` and no
  `resonators`, at the same power.
- The four words' Harmonic plays two of the kit's soft tones made pure (`partials: [1]`), 220 and
  440 Hz, at the soft tone's gain.
- The strip draws the model's levels from the same pure helper that gives the voice its resonances
  and factors (`lesson-13/vowels.ts`), so the figure and the sound cannot drift apart; the strip
  is never an analysis of the sound, and no `AnalyserNode` exists on the page (Tests, 2 and 8).
- The alternative, if the resonators sound wrong by ear (Decisions 2): each vowel as its own
  periodic wave whose partials are the model's levels for that note, and a change of vowel as a
  crossfade between two such voices whose levels add to one, written as contour points 10 ms apart
  through the change, as Lesson 11's spec writes its gear crossfade. It matches the strip exactly,
  since the strip is the same levels, but its peaks fade from bar to bar instead of sliding.

One sound plays at a time, page-wide. Every source, the cold open, the four words, the step toys,
Sing it's plays (Merc's ten seconds, Lower and Higher, the warm-up) and free play, claims the page's
one owner before it sounds, `NowPlaying` (`kit/now-playing.ts:1-15`, `:17-39`), with its own stop,
and releases it when it ends; the owner stops whatever was sounding with that source's own stop, so
a new tap stops the last, whichever control made it, and its lit button, its strip and its live text
reset as they do when it is stopped. Leaving a step stops its sound and anything it has queued (the
rest of Step 4's five vowels, or a harmonic still to play), whatever the route: Previous or Next, a
swipe, the wide page's scroll, the lesson menu's jump, a `#step-N` address and a quick-check step
link all reach the deck's `show`, which calls each toy's `onStep(step, previous)`
(`kit/step-deck.ts:39-41`, `:130-171`), and the page stops the step's sound whenever `step` differs
from `previous`; a layout switch calls it with the same step (`:178-181`) and stops nothing, as
Lesson 6's steps do (`lesson-06/steps.ts:78-89`). A play cut short, by a new play or a stop, never
counts as heard: the cold open's `play` resolves `false` for it, and the predict counts only a play
that runs to its end (Toys 2; `kit/predict.ts:30-40`, `:170-174`). Both parts came with PR #1149,
Lesson 6's page, and are on main.

A sequence decides once, at the tap, whether it sounds (`ToneOptions.audible`,
`kit/sound.ts:555-558`), so a step's later vowels never ask `Sound.canPlay()` from a timer, which
would show the sound-off toast with no tap (`:514-522`). A play pressed again while it runs stops
it; a play pressed while another runs stops the other and starts. The predict's two plays are the
exception: the kit ignores a tap on either while one runs (Toys 2). While a take is open every play
on the page is silent, as the kit's hush makes it. A live line is written to its region only when
its text changes, so a screen reader does not hear the same line twice.

## Mercs

Lesson 1's setup through the kit (`kit/merc-duo.ts`, `kit/merc-warm.ts`): the app's renderer loaded
after first paint, one WebGL context per Merc, medium quality on phones, turned towards each other,
paused off screen, and the still images when WebGL fails or would run on the CPU.

- They live in the hero, and their reactions are the hero pair's: blue sings while the cold open's
  vowels sound, and orange celebrates once at the cold open's reveal (no sparkles), the puzzled one
  who then gets it, whichever choice was made (playbook rule 15; FACTS 14). Elsewhere the Merc of
  the figure's voice sings while Merc's vowels sound (blue for the lower voice, orange for the
  higher).
- `kit/merc-duo.ts` has `mercSing`, `mercListen` and `mercCelebrate` (`:164`, `:206`, `:216`): Merc
  sings his vowels, and both listen during a take. In Sing it Merc celebrates at most once, only
  after "Easy" or "Workable", for a take in the band for at least 80 % of its ten seconds, never
  because a hold was longer (FACTS 55).
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Voice Mirror.** At `mercurypitch.com/mirror`, free, with no account, its own document,
  so a lesson link never meets First Light (FACTS 63). The card's link is `/mirror?lesson=13`, the
  marker the app accepts (`src/lib/lesson-marker.ts:18-25`). Its hold, "Pick any comfortable note
  and hold it steady.", is six seconds, and it reads pitch only: no file of Voice Mirror's mentions
  a formant, a timbre, a vowel, a spectrum or a resonance, so a hold sung through vowels there is
  read for its pitch and nothing else (FACTS 63). The card suggests the hold on ‘ee’, moving through
  ‘ah’ to ‘oo’, as the page's own suggestion, not a Voice Mirror option, and asks for comfortable
  glides, since its first task asks for a glide "to your highest comfortable note". It comes in two
  versions, picked by how Sing it ended (Toys 6), and both link the same address.
- **Not linked**, with the reasons in FACTS, each checked against the rule that nothing linked may
  claim to assess a vowel:
  - **Long Note** (FACTS 60): free, in the Exercises tab that `mercurypitch.com/pitch-training`
    opens, but with no vowel option, a help that begins "Hold a steady pitch as long as you can"
    and scores "how long you hold it", and a setup screen that says "The longer and steadier, the
    better.", where the house rules never reward the longest hold (REQ-GVC-070); no slug opens it,
    and no link can set its length.
  - **Analysis' spectrum view** (FACTS 61): its Spectrum card shows only for a stored take with
    audio, "from the separated vocal", and its live take, "Sing now", draws the singer's own
    spectrum beside a Voice card that names the take's "Resonance" as chest, mask, head or mixed and
    marks a "resonant" breathiness as good: a judgement of the voice on the very vowels this page
    never judges. It opens at `#/analysis` in the main app.
  - **Mah Meh Mee Moh Moo** (FACTS 62), the app's own five-vowel drill, in Singing Zen's list and
    the Ascent's "Breath & Power" week: it asks for "clear enunciation", vowels that "remain pure"
    and "all five sounds in one breath", it has no address of its own, and the series links no
    Ascent week until the rewrite CURRICULUM § 4 item 8 waits on.
  - The Sing room's premium rooms, which `PREMIUM_EXERCISES` gates
    (`src/lib/native-build.ts:58-68`).
- **Needed, proposed: "Long Note on vowels"** (CURRICULUM § 2.1's Practise line; § 4, "vowels"
  among the gaps with no drill, `CURRICULUM.md:520-522`): needs 12. When it ships, LESSON.md's
  editorial note gives the change: the card names it, and its address replaces Voice Mirror's.

## Explorer and season data

- **Season data**: Lesson 13's entry in `kit/season.ts` (`:372-381`) gains a plain
  `minutes: 16` and `page: '/learn/13'` after its topics, in every build, under the comment
  Lesson 3's entry carries (`season.ts:210-211`), "A draft until its sign-off (drafts.ts):
  built in every mode, and live where the page state publishes it (publish.ts).", as Lesson
  3's own are written (`season.ts:212-213`; FACTS 5, 64). Whether the page is live is
  `kit/publish.ts`'s to say: `seasonFor` draws a lesson held back as one coming later, with
  no page and no reading time (`kit/publish.ts:102-124`), so the entry reads neither
  `DRAFT_LESSONS` nor any build flag, which `kit/drafts.test.ts` keeps to the publishing
  rules alone. Its `pr`, today `{ needs: 'Long Note on vowels' }` (`kit/season.ts:379`),
  gains the link, proposed with the page (FACTS 64), as Lesson 3's reads (`:215-222`):

  ```ts
  link: { href: '/mirror?lesson=13', addr: 'mercurypitch.com/mirror', label: 'Voice Mirror' },
  ```

  It is printed on every page's explorer card for Lesson 13 (`practiseMarkup`,
  `kit/explorer.ts:174-179`); `needs` keeps "Long Note on vowels" for the team, and no card draws it
  (`kit/season.ts:27-34`). The link lands with the page, not before it: every lesson page's explorer
  prints it, and only this page says why the hold is suggested on vowels. Its hook is the entry's
  (`kit/season.ts:378`), and its tease is `kit/lesson-copy.ts`'s (`:142`), with no alternative hook,
  as FACTS 1 and 10 record: this spec changes no hook or tease line. Its `sig` (`kit/season.ts:391`)
  is the team's and never drawn (`:133`). `EDGES` already holds [11, 13] (`:421`).

- **The explorer card**: what the kit draws for a lesson with a page and no published film: its
  state and main action from `kit/lesson-state.ts` ("Start lesson", "Continue: step N" or "Read
  again"), its minutes, the plate figure and its caption, "A vibrating plate: sand gathers where the
  plate stays still" (`kit/explorer-figures.ts:210`; FACTS 10a), no Watch button
  (`kit/season.ts:23-25`), and the learner's fields only, which
  `src/e2e/learn-no-planning-text.spec.ts` holds every built lesson page to.

## What the kit and the app still need

Found in the kit and the app as they stand on main (22 October 2026, `e0cbe33dc`), beyond the parts
Lessons 2 to 11 promote into the kit (Toys table). Lessons 9 and 11's pages are not built yet,
and several items below are theirs too: whichever page is built first lands the part, and the
others take it. Lesson 7's page has landed its own: the range chart, the timbre hook, `quietAfter`
and the four-words strip in the kit.

1. The lesson host: `learn/13.html` at `/learn/13`. Every build takes every `learn/NN.html` as an
   input and routes its clean path (`tools/draft-lessons.ts:78-86`, `:110-122`;
   `vite.config.ts:306`, `:474`), so the page needs no build change. Its line in `kit/drafts.ts`,
   `13: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`, beside Lessons 3 and 5's
   (`kit/drafts.ts:31-38`), makes it a draft: production's `LESSON_DRAFTS`, "0", holds it back, and
   the dev site's and the previews', "1", show it (`wrangler.jsonc:112-116`, `:167`, `:190`,
   `:232`), until the console sets it either way, and the Content Studio's Lessons page names that
   reason when asked to publish it (`src/features/admin/AdminLessonsPage.tsx:186-207`; FACTS 9).
   `/learn/13` and `/learn/13.html` go in `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`,
   the lessons `:131-150`), so the service worker never serves the app shell in the lesson's place;
   `src/tests/lesson-pages.test.ts` checks a draft for them too (`:274-278`). On release: delete the
   `drafts.ts` line, and add the page to `public/sitemap.xml` and to `public/llms.txt`'s Lessons
   list (`:66-77`); until then the site worker adds the page to both only while it is published
   (`src/lesson-gate.ts:22-24`). Then `src/tests/lesson-pages.test.ts` holds the page to the
   release's checks (`:213-240`). `datePublished` is set in the commit that deletes the `drafts.ts`
   line or in one straight after the console publishes it, as the owner picks, and indexing is
   requested on the day the console publishes it, not at the release (SEARCH.md § 3.2, `:146-153`; §
   12, `:396-420`).
2. The page's head, written in full from its first commit:
   `src/features/lessons/kit/lesson-copy.test.ts` reads every `learn/NN.html`, drafts included
   (`lesson-copy.test.ts:323-358`), and `src/tests/lesson-pages.test.ts` holds every lesson
   document, a draft's included, to its head, its share card, its structured data and its legal
   links (`:112-210`), since a draft the console publishes goes live with the head it was built with
   (`:12-17`). The hook's copies are the ones the site worker rewrites when the console picks
   another hook (`HOOK_COPIES`, `src/lesson-gate.ts:444-460`, and the structured data after it);
   only the meta description and the Article's description, which repeat each other, may shorten the
   hook, and every other copy carries it whole. As Lesson 2's head has them (`learn/02.html:3-137`):
   - the title, "Resonance and vowels: why ee and ah differ | MercuryPitch" (57 characters, under
     the test's ceiling of 60, `lesson-pages.test.ts:127-128`), SEARCH.md § 4's draft for Lesson 13
     (`SEARCH.md:231`), which holds the Article's headline (`lesson-pages.test.ts:160`), the
     query-led form SEARCH.md § 13 item 1 recommends; if the owner keeps the series' name in it,
     "Resonance and vowels · Find Your Pitch | MercuryPitch" (53), the form Lessons 4 and 5 take
     (`learn/04.html:9`, `learn/05.html:9`), since the full form, "Resonance and vowels: Find
     Your Pitch, Lesson 13 | MercuryPitch", runs to 63 (Decisions 1). "Why ee and ah differ" says
     only what the hook says, that the two differ, and nothing of what the peaks do. The worker
     never rewrites a title. The h1 is `h1.hook#hook`, the hook in its default wording
     (`lesson-copy.test.ts:323-332`; Hero);
   - the meta description, "Same note, ‘ee’ or ‘ah’: what makes them sound different? A free
     lesson with sound toys: harmonics, resonance, and one note held through five vowels." (149
     characters, inside the test's 80 to 160, `lesson-pages.test.ts:129-132`). It does not quote
     the hook, so the worker leaves it as it is;
   - `og:title` and `twitter:title`, "Resonance and vowels: Find Your Pitch, Lesson 13" (48;
     `learn/02.html:26-29`, `:45-48`);
   - `og:description`, the full hook and one line, "If ‘ee’ and ‘ah’ sung on the same note draw the
     same pitch line, what makes them sound different? Watch Merc's line, then make your guess."
     (138 characters; `lesson-copy.test.ts:349-352`; `learn/02.html:30-33`), and
     `twitter:description`, the hook exactly (97; `lesson-copy.test.ts:353-355`;
     `learn/02.html:49-52`), so both descriptions the worker rewrites fit 80 to 160 (FACTS 1);
   - canonical and `og:url` `https://mercurypitch.com/learn/13`, `robots` "index, follow,
     max-image-preview:large" and `twitter:card` "summary_large_image"
     (`lesson-pages.test.ts:116-134`);
   - `og:image` and `twitter:image`, `https://mercurypitch.com/learn/lesson-13-og.jpg` (item 3),
     with `og:image:width` 1200 and `og:image:height` 630, and as `og:image:alt` and
     `twitter:image:alt` "The title card: Find Your Pitch, Lesson 13, Resonance and vowels, above an
     amber pitch line held level over a strip of bars, two of them marked, between blue Merc and
     orange Merc." (`learn/02.html:34-43`, `:53-60`; `lesson-pages.test.ts:177-197`);
   - the Article node, in the head's first `application/ld+json` script and as a single object,
     since the test reads `alternativeHeadline` there and checks it only when present
     (`lesson-copy.test.ts:338-346`, `:356`), and `lesson-pages.test.ts` asks for the Article
     first (`:142-144`): `@id` `https://mercurypitch.com/learn/13#lesson` and
     `url` `https://mercurypitch.com/learn/13` (`lesson-pages.test.ts:146-147`); the headline
     "Resonance and vowels"; `alternativeHeadline`, the hook exactly; `description`, the meta
     description's words, and `image`, the `og:image` URL (`:158-159`); `position: 13`,
     `learningResourceType` "Lesson", `timeRequired` "PT16M", `inLanguage` "en-GB", free, the
     series as `isPartOf`, and the organization as author and publisher (`:148-156`), as in Lesson
     2's (`learn/02.html:69-109`). It has no `datePublished` yet, as the built pages leave it out
     until they go live (`learn/04.html:61-68`; item 1);
   - a BreadcrumbList from the home page to the headline (`lesson-pages.test.ts:163-175`;
     `learn/02.html:110-128`); and the legal links, privacy, terms and imprint, in a `nav` labelled
     "Legal" (`lesson-pages.test.ts:200-210`).

   None of it answers the predict: the title, the hook and the descriptions say that ‘ee’ and ‘ah’
   differ on one note, never what the peaks do, and "Watch Merc's line, then make your guess." is
   the cold open's set-up (FACTS 3).

3. The share image the head names, `public/learn/lesson-13-og.jpg`, in the page's first commit:
   `src/tests/lesson-pages.test.ts` holds every lesson document, a draft's included, to its own
   card, a file in `public/` at the pixel size `og:image:width` and `og:image:height` give, with
   both alts set and the same (`:177-197`), so the page fails the unit tests without it. It is 1200
   x 630, a baseline JPEG as Lessons 3, 4 and 5's cards are (`public/learn/lesson-04-og.jpg`), drawn
   with the page's own kit so that it looks like the page it opens: the title, Lesson 13 and the
   wordmark over the vowel figure's compact still, Merc's amber line level over ‘ee’'s strip with
   its two peaks capped, between blue Merc and orange Merc. It shows no ‘ah’, no second strip, no
   arrow and no word but the title's, so it says nothing of what the peaks do and does not answer
   the cold open's predict. Lesson 6's page test holds its card the same way
   (`lesson-06/page.test.ts:126-141`); the shared test makes a page test of this page's own
   unnecessary.
4. First-paint ceilings for `learn/13.html` in `scripts/assert-first-paint-budgets.mjs`, one in its
   JavaScript table and one in its stylesheet table, beside Lessons 5 and 6's (`:130`, `:148`;
   `:225`, `:235`). Every build emits every lesson page, and the check fails a document with no
   ceiling (`:517`, `:549`), so without them the Browser jobs fail before any spec runs. Each is the
   page's measured first paint plus about a quarter, the tables' rule (`:47-58`, `:174-184`),
   measured in `build:e2e`, where the check runs (`package.json:20`): a build of Lesson 6's page
   alone weighed it about 8 KB lighter (`assert-first-paint-budgets.mjs:145-147`). The vowel model
   and the strip load at first paint, since the hero's still needs them; the listener and the hold
   reader arrive through a dynamic import when Start is pressed, as on Lesson 5
   (`assert-first-paint-budgets.mjs:126-129`), and the ceiling holds only while that boundary does.
5. `kit/sound.ts`, proposed: two options on `VoiceOptions` (`:30-46`), `partials` and
   `resonators` (Audio). `partials` gives a voice's source amplitudes whatever its `kind` (today
   `build` picks the wave from the kind, `:172-173`); `resonators`, a list of `{ hz, q }` built as
   lowpass biquads in series in place of the one lowpass (today 2,600 Hz for Merc and 3,400 for the
   soft tone, Q 0.5, `:175-178`), with `q` the linear ratio, set on the filter in decibels. And an
   optional `res` on `ContourPoint` (`:271-278`): the resonators' values the voice reaches at that
   point, their frequencies gliding exponentially and their Q in decibels linearly, as the pitch and
   level do (`:321-347`). Without them every voice is built as today, so Lessons 1 to 7 see no
   change; a unit test proves it. Lesson 11's spec proposes a `wave` and a `lowpass` option for its
   gears (its needs 6): whichever page is built first lands one design, and the other uses it.
   Lesson 7's page has since added a `timbre` option (`:44-45`, `:184`): a function that takes the
   voice's one lowpass, may retune it, and routes the tone to the envelope itself, as its "ng" and
   lip trill do (`kit/timbre.ts`).
6. `kit/spectrum-strip.ts`, new: the LED strip as a painter under the band chart's plot, as
   `kit/band-chart-hold.ts`'s level strip is (`:1-13`, `:37-42`), behind a `spectrum` option on
   `BandChartOptions` (`kit/band-chart.ts:48-65`), off by default, with a scene field holding the
   columns (each its harmonic number and its lit segments), the labelled peaks, the curves (each a
   resonance frequency and its points) and the caption. It draws only what the scene gives it, takes
   no audio input, and is pure but for the canvas calls, with its layout (column centres and widths,
   the numbers shown, the heights) a pure helper. A chart without the option draws as today.
7. `lesson-13/vowels.ts`, the page's pure vowel model: the ten sets of means from FACTS 37, the
   source, the resonators' response (the RBJ lowpass, as `verify13.py` gives it), the levels, the
   segments, the labelled peaks, the in-between resonances of a change, and the equal-power factors,
   unit-tested against `verify13.py`'s numbers (Tests, 1 and 2).
8. `kit/hold-flow.ts`, Lesson 5's `lesson-05/hold-flow.ts` moved into the kit (Toys 6), with the
   hold lengths as data, so Lesson 5 keeps ten seconds then fifteen and this page has ten alone, and
   with the Wrap's rest card after effort (item 10). Lesson 5's tests move with it and pass
   unchanged.
9. `kit/hold-run.ts`, Lesson 5's `holdOne` and its lead (`lesson-05/sing-hold.ts:40-42`,
   `:88-169`) moved into the kit, with Merc's Listen phase passed in as a function that resolves
   `false` when it was cut short, and a hook on the first voiced frame for the vowel cues. Lesson 5
   passes its two-second note, unchanged.
10. `kit/comfort.ts`: an option that sends "Effortful" to the rest card,
    `afterFeeling(f, { restAfterEffort: true })`, since `afterFeeling` leaves it to the coach
    (`:58-67`) and Lessons 6, 7, 9, 10, 11 and 13 all choose it, as Lesson 11's spec proposes (its
    needs 9). Until the option lands this page overrides `rest` itself, as Lesson 6's page does.
11. `recallStepHref` in `kit/quiz.ts`, moved from the two copies Lessons 3 and 5 keep
    (`lesson-03/quiz-questions.ts:24`, `lesson-05/quiz-questions.ts:19-20`), so that Lessons 7,
    9, 11 and 13's recalls take one address rule. The four-words strip is in the kit already,
    promoted from Lesson 1's page into `kit/words-strip.ts` with Lesson 7's, and it takes the page's
    sound owner as Lesson 6's own strip does (`owner`, `kit/words-strip.ts:46-51`;
    `lesson-06/words.ts:149-159`).
12. App, proposed: "Long Note on vowels" (Practice links; FACTS 60), the CURRICULUM's practice for
    this lesson. A vowel cue for Long Note: the five vowel names shown over the run, a vowel every
    two seconds on a ten-second run, as words only; the run scored as today on pitch alone, with
    nothing that hears, scores, names or matches a vowel, and no copy that says it does; a fixed
    length, through CURRICULUM § 4 item 2's `durationSec` launch field; its help's "as long as you
    can" and "how long you hold it", and its setup screen's "The longer and steadier, the better.",
    rewritten so that length is never rewarded (REQ-GVC-070); and a data-only slug that opens it
    with the cue on, registered in `EXERCISE_SLUGS` (`src/features/exercises/slug-map.ts:47-65`)
    with a line in `src/tests/slug-map.test.ts`, linked with `?lesson=13`, because a slug boots the
    main app, where First Light opens on a first visit unless the marker steps it aside.
13. `src/e2e/helpers/tone-wav.ts`: `writeVowelWav(hz, seconds)`, beside `writeToneWav` (`:76`), the
    1/k source through the five vowels' resonances in turn, two seconds each, with 0.25 s changes,
    for the end-to-end test that a held note sung through vowels reads as the note and nothing else
    (Tests, end to end 6). It names its file by its note and length, written beside and renamed into
    place, as `writeToneWav` does (`:48-64`, `:78-83`).
14. Copy in the code, not made here: the season entry's `minutes`, `page` and `pr.link`, which land
    with the page (Explorer and season data; FACTS 64).

Already on main, so this page needs nothing more from them: run-time publishing (`kit/publish.ts`,
`kit/page-state.ts`, `src/lesson-gate.ts`), which settles the page's chip, its recall's step links
and its next card for the state it is served with; the page-wide sound owner (`kit/now-playing.ts`)
and the predict's `play` that reports a play cut short (`kit/predict.ts:30-40`), from PR #1149; the
kit's stage fit (`kit/stage-fit.ts`), the lesson menu and the remembered steps
(`kit/lesson-menu.ts`, `kit/position.ts`), the generated next-lesson card with the next lesson's
tease (`kit/next-card.ts`, its copy from `kit/lesson-copy.ts`), the step deck that opens at a step
an address names (`kit/step-deck.ts`), Watch only with a published film (`kit/season.ts:23-25`),
learner-only explorer cards, the band chart and its hold frame (`kit/band-chart.ts`,
`kit/band-chart-hold.ts`), the hold reader (`kit/hold-take.ts`), the contour voices (`contourVoice`,
`playContour`, `kit/sound.ts:321-347`, `:575-584`), the warm-up (`kit/warm-up.ts`), the voice choice
(`kit/voice-choice.ts`) and the comfort check (`kit/comfort.ts`). Released lessons need no edit when
this page goes live, since every lesson page draws the season as its state shows it
(`kit/page-state.ts:54-57`): Lesson 12's next card turns from "Coming later" to "Start lesson" and
links this page.

## Decisions for the owner

With the recommendation first:

1. **The hook, the predict and the title** (FACTS 1, 3): the season's hook stays, and the predict
   asks what will change in the bars, their heights or their places. The hook says that ‘ee’ and
   ‘ah’ on one note draw the same line and sound different; both choices are a change, so it leans
   on neither, and "their places", a different vowel with different frequencies in it, is the
   misconception made visible. Recommended: keep. The title: recommended, the query-led "Resonance
   and vowels: why ee and ah differ | MercuryPitch", as SEARCH.md § 13 item 1 recommends; the
   series' name fits only in Lessons 4 and 5's short form, "Resonance and vowels · Find Your Pitch |
   MercuryPitch", without "Lesson 13".
2. **How the vowels sound** (Audio; FACTS 40): Merc's "ooh" voice with a 1/k source to 4 kHz
   through three resonances at the measured British means, every vowel at one power, the vibrato
   kept. Recommended: keep it, and tune it by ear before publishing on a phone's speaker and on
   headphones; if a vowel sounds buzzy or nasal rather than sung, widen the bandwidths a little
   (the strip follows, since it reads the same model) before trying the crossfaded waves.
3. **The learner's own spectrum** (FACTS 59): not shown. While the viewer sings the strip stays dark
   and only the pitch line draws. Recommended: keep it so. The house rule forbids any claim to check
   a vowel, and REQ-GVC-045 any finding beyond observed recording behaviour; every tract's peaks
   differ (Step 5), so a measured average is not anyone's target; and the viewer's spectrum drawn
   under Merc's model would read as a shape to match, whatever the page said.
4. **The practise links left out** (Practice links; FACTS 60 to 62): Long Note, the Analysis
   spectrum view and Mah Meh Mee Moh Moo, each for its own reason. Recommended: link Voice Mirror
   now, and Long Note once "Long Note on vowels" ships without length rewards (needs 12); never link
   the Analysis tab from a lesson while its Voice card grades resonance.
5. **The CURRICULUM card's Practise line** (FACTS 6): applied in this PR, in the form Lesson 14's
   card takes: Voice Mirror's hold until "Long Note on vowels" ships, the three drills not linked
   with their reasons, and the card's rule that the app must not claim to assess vowels.
6. **The next card's figure** (Toys 8; FACTS 7): Twinkle's first phrase as seven amber bands,
   drawn twice, the second copy's "star" a "?" with no line, as CURIOSITY-MOMENTS' Lesson 13 Tease
   draws it since Lesson 14's PR. A still that drew the second "star" in its band, or with a swell,
   would answer Lesson 14's predict. Recommended: keep.
7. **‘Oh’** (FACTS 39): modelled on the steady vowel of "paw" and "more", since "go" glides in the
   standard British accent. A question for the vocal coach: whether the page should say "like
   ‘oh’, held without the glide".

## Edge cases

What the page does where nothing above says:

- **No stored voice**: the steps' figure shows the lower voice, as it always does; Sing it asks
  after the comfort check, before anything plays. A `fyp-voice` holding anything but the two stored
  values counts as none and is overwritten only by a choice.
- **No storage** (blocked, private mode, or a read that throws): every read and write is inside
  try/catch; the page works, asking the voice each visit, reseeding the quizzes and forgetting the
  warm-up's Skip.
- **Sound off**: each play button draws what it would play, the strip changing as it would, and
  shows the kit's hint; the cold open's reveal waits for ‘ee’, then ‘ah’ to be heard with sound on
  (Toys 2), though the strip has shown the change, as every kit predict's visuals run; Start's
  sequence plays Merc's ten seconds in silence, so the briefing's Start stays available, as on
  Lesson 5, and the hold reads the voice as usual.
- **No Web Audio**: every play button draws in silence with the hint "This browser can't play sound
  here.", so the cold open's reveal cannot come, as on every page that uses the kit's predict; Sing
  it offers the listen-only path of state 11 at once, with no Start; the Wrap keeps the practice
  card.
- **No microphone, a refusal, or a listener that fails to load**: state 11 of Toys 6.
- **The tab hidden, or the section left, during a take**: the take is abandoned and the microphone
  released; no feeling question follows; the take counts towards the three (Toys 6).
- **Merc's ten seconds cut short before a take**: the hold is cancelled before the take opens, the
  microphone released, and Start comes back; it counts as no take (Toys 6).
- **A breath between vowels**: under a second, the take runs on and the silence counts as out of
  the band; over a second, the take ends with the kit's stop line, "Stopping early is fine.".
- **A voice that sings no vowel, the wrong vowel, or a hum**: the reading is the same as for any
  held note, since nothing reads a vowel; nothing on the page says otherwise.
- **An octave error, or a note sung an octave away**: the reader folds it into Merc's octave and,
  within 50 cents, adds the octave line, as on Lesson 5.
- **Three takes used**: Again is gone and Start does not come back; Done for today remains.
- **Move at its ends**: Lower is absent at four semitones down and Higher at four up, as on Lesson
  5; the note, the strip and the hold follow the moved note, and the strip's columns follow its
  harmonics (22 at F3, 7 at C♯5).
- **No WebGL, or a slow device**: the Mercs' stills (`kit/merc-warm.ts`).
- **Lesson 11 never marked done**: the recall still shows, as a prerequisite's does.
- **Lesson 13 published while Lesson 11 is held back**: nothing stops it, since the publish order is
  a rule for whoever uses the console (the intro), so the page follows the state it is served with.
  The site worker, and then the masthead's `followPageState`, make every link to a lesson that is
  not live no link (`kit/page-state.ts:64-108`, called by `initMasthead`, `kit/page-chrome.ts:111`):
  the "After Lesson 11" chip stays as a plain chip, and any other link keeps its words. The kit's
  quiz does the same for the recall's step links, which keep their words, "Try Lesson 11, Step 2
  again", with no link (`kit/quiz.ts:193-196`). The recall still shows, and the explorer and the
  lesson menu draw the lesson held back as coming later. End to end 13 holds it.
- **Reduced motion**: Look, Toys 1 and Toys 6 give the end states; nothing moves on its own.

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-13/` and the new kit
parts:

1. The vowel model (`lesson-13/vowels.ts`) against `verify13.py`: the ten sets of means, to 0.1 Hz;
   18 bars on A3 and 9 on A4; the labelled peaks, lower voice ‘ee’ (1, 10), ‘eh’ (2, 7), ‘ah’ (3,
   5), ‘oh’ (2, none), ‘oo’ (1, 5), and higher voice ‘ee’ (1, 6), ‘eh’ (1, none), ‘ah’ (2, none),
   ‘oh’ (1, none), ‘oo’ (1, 3); ‘ee’'s segments on A3, 12, 7, 3, 1, then dark to a lone 3 on the
   10th; the tallest bar of each vowel; the source alone, 12 segments on the 1st down to 4 on the
   18th; every labelled peak of ‘ee’ and ‘ah’ under the first or second resonance (FACTS 40 to 42).
2. The sound's schedule: every point of every line holds the note's frequency; the cold open's play
   is 2.0 s of ‘ee’, a 0.5 s change and 2.0 s of ‘ah’, 4.5 s; the five vowels are 2.0 s each with
   0.25 s changes, 10.0 s, their cues at 0, 2, 4, 6 and 8 s; the resonators' values at each point
   are the vowel's means and bandwidths, Q in decibels 20 log10 of the frequency over the bandwidth;
   the equal-power factors run from 0.28 to 0.71 (lower) and 0.11 to 2.64 (higher) over Move's
   notes, and every point's level is at most 1 (FACTS 66, 67).
3. Containment and the note: Move gives F3 to C♯4 and F4 to C♯5; every one of the six presets
   holds exactly one of A3 and A4 in its middle half, checked against `VOCAL_RANGES` imported from
   `src/stores/settings-store.ts` (FACTS 52).
4. The strip's layout: at a 380, 340, 310 and 240 px figure, the plot, strip and segment heights
   of Toys 1; at 390 px the strip 326 px, A3's columns 17.9 px apart and 12.6 px wide; at 344 px
   F3's 12.2 px apart and 8.6 px wide; the numbers shown, every bar at 16 px apart or more, else the
   1st, every 5th and the labelled peaks, and no two numbers overlapping (FACTS 68).
5. The band chart with the `spectrum` option off paints as today; with it on and an empty scene it
   paints unlit columns only.
6. The Sing it flow (`kit/hold-flow.ts`, Toys 6): with no stored voice the voice choice comes before
   either path, and a stored voice starts pressed and can be changed; "Just listen today" shows no
   Start and picks the rest card; without Web Audio, Sing it is listen-only with no Start; a take
   with no voice brings no feeling question and offers Again while fewer than three takes have been
   made; "Easy" and "Workable" offer Again while takes remain, and Merc celebrates only after them
   and at least 80 % in the band, at most once a visit; the tricky line shows under half; an
   abandoned take counts; a walk over every sequence of take outcomes and answers never reaches a
   fourth take or more than 30 seconds of singing, and never shows Again after "Effortful" or
   "Uncomfortable"; "Effortful" keeps the reading and "Uncomfortable" takes it away; both end the
   singing for the visit and pick the rest card, and a later "Easy" brings back neither Again, Start
   nor the practice card; Merc's demonstration cut short counts as no take; the feelings lock once
   answered and free again only for the next take; nothing is written to storage but `fyp-voice`
   and `fyp-l13-warmup`. Lesson 5's flow tests, moved with it, pass unchanged with its two lengths.
7. The vowel cues: on synthetic frames at the detector's 16 ms hop, ‘ee’ is lit from the take's
   opening and ‘eh’, ‘ah’, ‘oh’ and ‘oo’ from 2, 4, 6 and 8 s after the first voiced frame; with no
   voiced frame ‘ee’ stays lit; nothing in the cue code reads anything but the frames' times.
8. Nothing judges a vowel: every line of LESSON.md's page copy and every template in Toys 1, 2 and 6
   passes `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts`, surface `finding`); no
   reading, summary or status after a take names a vowel or says "vowel", "pronunciation",
   "match", "heard your" or "correct"; no module under `lesson-13/` or `kit/spectrum-strip.ts`
   creates an `AnalyserNode` or imports the listener, and the strip's scene is empty from the
   take's opening to its end, whatever the frames hold.
9. Copy: no quiz feedback line starts with "Right", "Yes" or "Correct"; no accessible name or live
   text holds a ♯ or ♭ sign; no two controls on a stage share an accessible name; each vowel
   button's name begins with its visible label; no live text before the cold open's reveal names a
   bar of ‘ah’ or says "heights", "louder" or "softer" of the bars.
10. Every fixed sound's frequency equals `hz(m)` for the notes of FACTS 65.
11. The predict (Toys 2's states): the choice locks on the first press; before it only Play Merc's
    ‘ee’ plays; after it, the reveal stays hidden until ‘ee’, then ‘ah’ has been heard with sound
    on, and a silent play shows the `silent` hint; before a choice, Merc's ‘ee’ heard after a
    silent one brings the lock hint back; after a choice, Merc's ‘ee’ heard replaces `silent` with
    `chosen`; after the reveal, a silent play leaves "Play either again."; the reveal's line is
    "You said: their heights" or "You said: their places"; no hint says "right" or "wrong" (FACTS
    12, 13). Unit test 16 holds a play cut short.
12. Quizzes: the recall's ids are `l11-q1` and `l11-q2`, it equals Lesson 11's two questions as its
    module has them, it takes no `lesson`, and its two step links are `/learn/11#step-2` and
    `/learn/11#step-3`; the quick check's ids are `l13-q1` to `l13-q4`, with `lesson: 13`.
13. Season data: Lesson 13's entry has `minutes: 16` and `page: '/learn/13'` in every build, as
    `season.test.ts` checks Lessons 3, 4 and 5's, and the same file's check of every page in the
    repository then covers it. While its line is in `drafts.ts`, Lesson 13 has no page and no
    reading time in `seasonFor(LESSONS, defaultPageState(false))` and keeps both in
    `seasonFor(LESSONS, defaultPageState(true))`, as `publish.test.ts` checks a lesson held back and
    one published. Lesson 13's practise link carries `?lesson=13`, and `EDGES` holds [11, 13].
14. The kit's new options: `afterFeeling('effortful', { restAfterEffort: true })` is today's answer
    with `rest: true`, and every other answer, with or without it, gives what `afterFeeling(f)`
    gives today (`kit/comfort.ts:48-76`); `kit/sound.ts` without `partials` and `resonators` builds
    every voice as today, and with them takes the given source and filters; `recallStepHref` from
    the kit gives Lessons 3 and 5's recalls the addresses they give today; Lesson 5's hold runner
    from the kit plays its two-second note as before.
15. One sound at a time, and leaving a step (Audio), with fake timers and a spy on the kit's sound:
    starting any source while another sounds stops the first (a four words play over Step 4's five
    vowels; free play over the cold open; a Lower tap over Merc's ten seconds in listen-only mode);
    with Step 4's five vowels sounding, a step change by each route, Previous, Next, a swipe, the
    lesson menu's jump, a `#step-N` address and a quick-check step link, stops them, and running the
    clock past their end starts no vowel; a layout switch, `onStep` with the same step, stops
    nothing.
16. A play cut short never counts as heard (Audio; Toys 2): the cold open's `play` resolves `false`
    when ‘ee’, then ‘ah’ is stopped before its end, by another sound or a stop, and never when it
    runs out; cut short, it leaves the reveal hidden, and played to its end it shows it.
17. Layout, the pure helper behind Toys 1's targets: at every width from 344 to 1440 px every
    control is at least 44 px wide, with 8 px between neighbours and none overlapping, five vowel
    buttons a row at 55.2 px or more (FACTS 68).

End to end (Playwright, at 390 x 844 and 1440 x 900, on the e2e build, which shows drafts):

1. No AudioContext before the first tap; nothing plays before a play button.
2. Cold open: Play Merc's ‘ee’ plays before a choice; Play ‘ee’, then ‘ah’ stays disabled until a
   choice; the reveal appears only after it has played with sound on; with sound off, the hint shows
   and no reveal comes; the play cut short, by the four words' Harmonic played over it, brings no
   reveal until it plays to its end (unit test 16); after the reveal the live region names ‘ah’'s
   3rd and 5th bars.
3. The figure by keyboard alone: Tab reaches every control; Resonances and the voice switch toggle
   `aria-pressed`; the picker plays one vowel a press; every announcement uses spoken names, and
   every vowel button's name starts with its label.
4. At 390 x 844 and at 344 px wide, every target measures at least 44 x 44 px, none overlap and
   nothing scrolls sideways.
5. The stage fits short landscape screens: `src/e2e/learn-stage-fit.spec.ts` holds this page to it
   once it is built, as it holds every lesson page, at 1024 x 640, 1133 x 631, 1280 x 680 and 1366
   x 657 and on a phone held sideways (FACTS 68); `src/e2e/learn-no-planning-text.spec.ts` reads it
   for the team's planning words and every variant's note the same way, and
   `src/e2e/learn-cold-open-fold.spec.ts` holds its title on the first screen at seven sizes and
   reports where Play Merc's ‘ee’ and the two choices sit (`:167-206`).
6. Sing it, with the fake microphone (`src/e2e/helpers/tone-wav.ts`, `fakeMicArgs`, `:115`), as
   `src/e2e/learn-lesson-05.spec.ts` drives Lesson 5's hold: a steady A3 (`writeToneWav(220, 20)`)
   in the lower voice reads "In the band for all 10 seconds." and asks "How did that feel?"; the
   strip is dark through the take, with no lit segment; the vowel names light in turn. The same note
   sung through vowels (`writeVowelWav(220, 20)`, needs 13) reads a line that starts "In the band
   for", and no reading, summary or live text names a vowel. "Easy" shows the rest line, Again and
   Done for today, and the Wrap shows the Voice Mirror card with "Ten minutes, gently, most days";
   after the third take Again is gone. "Effortful" shows the gentle line, no Again, the feelings
   locked, and the rest card in the Wrap. "Uncomfortable" shows the doctor lines, no Again, no
   reading and no violet line, and the rest card. "Just listen today" never calls
   `navigator.mediaDevices.getUserMedia` (a spy), shows the doctor lines and leaves the rest card. A
   refused permission shows the no-microphone line and keeps the practice card.
7. The microphone's tracks stop at the end of each take, on leaving the section and when the tab is
   hidden (a spy on `MediaStreamTrack.stop`); no `AnalyserNode` is created on the page (a spy on
   `AudioContext.prototype.createAnalyser`).
8. The recall shows with an empty `fyp-done`, and answering both its questions marks nothing done;
   its step links are `<a href="/learn/11#step-2" target="_blank">` and
   `<a href="/learn/11#step-3" target="_blank">`; answering all four quick-check questions marks
   Lesson 13 done in the explorer; each feedback line starts "Right." or "Not quite.".
9. Every practice link carries `?lesson=13`; opening `/mirror?lesson=13` in a fresh profile boots
   Voice Mirror with no intro, as `src/e2e/lesson-marker.spec.ts:121` checks its own documents.
10. The Wrap's next card names Lesson 14, says "Coming later" and leads to the map, never to a page,
    as `src/e2e/learn-next-card.spec.ts` checks a card for a lesson not written yet (`:195`); its
    tease, "‘Twinkle, twinkle, little star’, twice. The second ‘star’ swells.", sits one line above
    the hook, the card's words in the order eyebrow, tease, hook and way on, then the figure, as
    that spec checks Lessons 1 and 2's cards (`:102-119`, `:147-163`).
11. With reduced motion emulated, a column jumps to its height, a vowel change lands at once, the
    ring holds still, and nothing moves on its own.
12. After a full run, storage holds only the keys in the Contract.
13. Published out of order (Edge cases), built like `src/e2e/learn-publish-state.spec.ts`, whose
    `serveWith` writes a state into the page's head as the site worker does (`:32`). Served by
    `serveWith(page, '/learn/13', state)` with the state
    `{ drafts: false, lessons: { 13: { published: true }, 11: { published: false } } }`, the page
    keeps "After Lesson 11" as a plain chip (`ul.meta .chip` with that text counts 1 and has no
    `href`) and links `/learn/11` nowhere (`a[href^="/learn/11"]` counts 0), as that spec checks
    Lesson 4's chip for Lesson 2 (`:106-126`); and the recall's answer "You're doing it wrong" shows
    "Try Lesson 11, Step 2 again" in its feedback with no link.

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=13`. Then the layout, accessibility, sound, motion and storage
rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children, touch
targets of at least 44 px with no two tap zones overlapping, visible focus, a single dark theme with
every colour a token and an explicit body background, sound only after a tap, localStorage only for
per-viewer conveniences inside try/catch, and the whole page usable with no sound, no WebGL, no
storage and no microphone. Every ♯ the page prints in text (Move's notes, the readouts) has a spoken
name, as Lesson 2's contract sets: the sign is `aria-hidden` and a visually hidden word follows it
(`nameHtml`, `signsHtml`, `kit/notes.ts:208-227`), so a screen reader says "C sharp"; the figures'
accessible names and every live region use words only. The page stores the quiz seeds and records
(`fyp-l13-recall-seed`, `fyp-l13-recall-v1`, `fyp-l13-seed`, `fyp-l13-quiz-v1`), `fyp-done`
(`kit/progress.ts:12`), `fyp-voice` (`kit/voice-choice.ts:20`), the warm-up's Skip
(`fyp-l13-warmup`), the masthead's Pause animations choice, `fyp-motion`
(`kit/motion-switch.ts:12`), and the steps the viewer reached, `fyp-pos` (`kit/position.ts:20`); and
nothing from the take: no frame, no line, no reading, no answer to "How did that feel?" and no
ending.

Page QA before publishing (PRODUCTION-PIPELINE § 5) adds, for this page:

- The vocal coach has signed the page off, and Lesson 11 is live on the site it is published to:
  the console asks only about the sign-off, and nothing checks the rest (the intro).
- The vowels are heard by ear on a phone's speaker and on headphones: five vowels a listener can
  tell apart, sung by one voice on one note, every vowel as loud as the others and as loud as
  Merc's "ooh" on Lessons 3 and 5, with no click at a change (Audio; Decisions 2).
- The microphone is requested only by Start; "Just listen today", a refused permission and listening
  never open it; the browser's microphone indicator goes off at the end of each take, on leaving the
  section and when the tab is hidden.
- The network panel shows nothing sent while the microphone is open, and storage holds nothing but
  the keys above, as the "What this does" box says.
- The strip stays dark through every take, and nothing on the page names, scores, matches or
  corrects a vowel, with any vowel or none sung; no line after a take invites another try; and no
  visit reaches a fourth take.
- The whole page, Sing it included, runs by keyboard alone, and a screen reader hears every state in
  spoken names.
- With reduced motion emulated, nothing moves on its own.
- The Wrap shows the rest card after "Effortful", "Uncomfortable" and "Just listen today", and the
  practice card otherwise; neither carries a first-visit line, and the practice link opens Voice
  Mirror with no intro.
- Every step stage fits the four short landscape screens with the masthead (End to end 5), and the
  app-check sweep (`.claude/skills/app-check`) passes at phone and desktop width with Sing it open
  in each state, run locally or on dev, never against production.
