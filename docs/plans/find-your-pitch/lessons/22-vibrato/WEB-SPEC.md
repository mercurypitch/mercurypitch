# Lesson 22 web page: spec

The Lesson 22 page is the web lesson for "Vibrato", Season 2's fourth voice lesson and the first of
Arc D, Harmonise it: a cold open on a held note whose line swings past both edges of Lesson 5's
band, a recall from Lessons 5 and 14, written steps on one main toy, Lesson 5's band chart, in four
step states with free play, a second predict in Step 3, a scored checkpoint of two ten-second holds
read on the middle of the learner's line, two quizzes and the lesson explorer. Copy is in
[LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a text-only package: no film
exists for Lesson 22, so the page has no Watch section and the masthead's anchors are Lesson, Sing
and Explorer. It is built on the kit (`src/features/lessons/kit/`) as it stands on main at
`c60f0fdcb`, and like every lesson page it reuses and never copies: a part that lives in an earlier
lesson's module moves into the kit first.

It stands on Season 2's kit work, none of it built yet: the seasons in the kit (SEASON-2 § 6.2
item 1) and Lesson 5's hold flow moved into the kit (What the kit and the app still need, item 7). This
spec says what this page adds to them: Merc's voice with its vibrato as a parameter, the band
chart's new states, and the centre-line reader, which reads a hold on the middle of the line with
any vibrato it finds taken out, so a vibrato counts in full (What the kit and the app still need,
items 4 to 6). The page ships only with that reader, as the lead answered on 2 November 2026:
today's reader counts frames, and scores a vibrato of about ±50 cents or wider as time out of the
band (FACTS 43).

One object carries the lesson: Lesson 5's band chart, zoomed until a held note's wave shows. In the
cold open Merc's line swings past both its edges; in Step 1 a level line, a wave and a swell; in
Step 2 a counter and a ruler measure the wave's rate and extent; in Step 3 a middle line draws
itself and the wave slows until the note moves; in Step 4 Merc's sung wave stands beside the app's
ribbon, labelled a mark; in Sing it the learner's own line is drawn, then its middle. The card's
signature is that path (FACTS 4).

Its public home is `mercurypitch.com/learn/22`: a hand-written document `learn/22.html` with its
module in `src/features/lessons/lesson-22/`. It is a voice lesson, so it is a draft until the vocal
coach signs off its voice lines and its checkpoint (LESSON.md, For the vocal coach), in the draft
list's form (`src/features/lessons/kit/drafts.ts:31-41`). The season pairs it with Lesson 20 for the
coach, and it can go out with Voice Mirror's link alone (SEASON-2 § 8.2 item 5,
`docs/plans/find-your-pitch/SEASON-2.md:1236-1237`).

## Look

Season 1's look, unchanged: the dark listening room, the series colour code, Lesson 1's type and
wordmark, and the motion rules. The band chart takes the app's canvas set, as on Lesson 5's page:
target amber `#f59e0b` for Merc's band and his line, singer violet `#a78bfa` for the learner's line
alone, and in-tune mint `#80ffca` for the band's lit edge, always beside the words "in the band", as
Lesson 5's spec sets them (Lesson 5 WEB-SPEC, Look); the band reaches 35 cents either side (FACTS
16). On this page:

- **Merc's lines are amber, wave and all.** MASTER-PLAN § 5 gives Merc's sung note on a pitch
  canvas the amber of the target band, and SEASON-2 § 6.1 item 5 keeps violet for the singer alone
  (FACTS 38). So every example on a band chart, the hero's still and the cold open's wave, the four
  words' plays, the steps' waves and Step 4's sung wave, is Merc's line in amber, drawn at its true
  pitch, wave and all (FACTS 63). The kit's chart leaves Merc's own vibrato out of his amber centre
  line, so the wobble is never read as part of the band or as something to copy
  (`src/features/lessons/kit/band-chart.ts:5-12`). This page keeps that in Sing it, where his line
  is the target, and draws his wave everywhere else, because the wave is what the lesson is about
  and every example is for listening. Violet is only ever the learner's own line, in Sing it.
- **No centre line before the cold open's reveal.** The hero, the four words and the steps draw the
  band with no amber line at its centre, no cents ticks and no note name (FACTS 38). The middle line
  is a wave's own middle, dashed and labelled "middle": amber through Merc's waves (FACTS 42),
  violet through the learner's line in Sing it, after a hold in which the reader found a vibrato.
- **Loudness is never drawn on the pitch axis.** Step 1's swell grows Lesson 5's level strip under
  the chart, in chrome, while the line stays level (FACTS 17).
- **The app's ribbon** in Step 4 is drawn in chrome, a mark, never violet or amber, and labelled
  "the app's mark"; Merc's sung wave beside it is amber and labelled "sung": it is synthesised, so
  nothing on the page calls it measured (FACTS 30, 68).
- **Orange `#ff7448`** is Tavi's and **blue `#58a6ff`** Merc's, in their bubbles and their stills.
  No gold appears on any pitch canvas (playbook rule 11).
- **No decorative staff or clef anywhere**: in Season 2 a staff on screen is always music, and this
  page draws none (FACTS 6).

Four things move: the Merc idle loops; a line drawing as its play sounds; the middle line drawing
itself (0.6 s); and the ring in Sing it. Only Merc and Tavi move on their own. Under
`prefers-reduced-motion` Merc and Tavi hold a still frame, a play's line lands whole as the play
starts, and the middle line appears at once, as the kit's chart lands a figure in its end state
(`src/features/lessons/kit/band-chart.ts:33-35`); what the viewer starts still sounds. For everyone
else the masthead's Pause animations toggle stops the same things.

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap as far as both predicts allow; the mix-up card sits in the step
whose toy refutes it; the practice card sits in the Wrap. No Watch section. The page opens in
Lesson 2's order (FACTS 5a). Each section's heading, and the line above it, are in LESSON.md
("Section headings").

1. **Masthead**: Season 1's, with the kit's seasons: "Season 2 · Lesson 22", anchors Lesson, Sing
   and Explorer, the Sound toggle off by default and Pause animations, through `initMasthead`
   (`src/features/lessons/kit/page-chrome.ts:127`) with `{ lesson: 22, deck }`. On a first visit its
   welcome tour waits for the cold open's choice (Toys 1).
2. **Hero, with the cold open**, laid out as Lesson 2's: the kicker, the hook as the title
   (`<h1 class="hook" id="hook">`), the meta as four chips, the promise and the sound gate from
   LESSON.md. The chips are "15 minutes" (FACTS 3); "After Lesson 14: Phrasing: sing a whole song",
   a link to that page that stays a plain chip wherever Lesson 14 is not live (FACTS 2); "Sound on";
   and "Microphone optional". The stage holds Tavi's and Merc's bubbles over Merc and Tavi, the band
   chart's hero state between them with Merc's line already drawn as a still, and under it the cold
   open's three plays, the two straight notes locked until a choice; the predict card sits under
   the stage (Toys 1). The head:
   - the title, at most 60 characters: "What is vibrato in singing? | MercuryPitch" (42; Decisions for
     the owner, 1);
   - the description, 153 characters: "If a singer's held note swings up and down six times a second,
     why do we still hear one note? A fifteen-minute lesson with sound toys and a note to hold.";
   - the head test holds the description to 80 to 160 characters
     (`src/tests/lesson-pages.test.ts:156-159`) and to the chip's run time in words (`:191-210`);
   - og:title and twitter:title "Vibrato · Find Your Pitch, Lesson 22" (36); og:description and
     twitter:description the hook alone (93);
   - the share card `learn/lesson-22-og.jpg`, 1200 by 630, drawing the hero's band with Merc's amber
     line waving across both its edges, no line at its centre and no note named, between Merc and
     Tavi; its alt "The title card: Find Your Pitch, Lesson 22, Vibrato, above a band with a pitch
     line waving across both its edges, between Merc and Tavi." (136);
   - the Article's structured data: headline "Vibrato", `alternativeHeadline` the hook, the
     description, `timeRequired` `PT15M`, position 22, and `teaches` "What a vibrato is: a regular
     wave in a held note's pitch", "Vibrato rate and extent", "Why an even vibrato is heard as one
     note" and "Reading Voice Mirror's vibrato report"; and on release a line in llms.txt: "Lesson
     22, Vibrato: what a vibrato's rate and extent measure, why an even vibrato is heard as one note
     at the middle of its swing, and how Voice Mirror reports one."

   Nothing a learner can meet before the choice, the title, the descriptions, the share card and
   its alt, names a straight note, a middle or a centre (FACTS 1a). The llms.txt line, which no
   learner meets before the choice, names the middle. Lengths: `verify22.py`, section 8.

3. **Recall from Lessons 5 and 14**, straight after the hero, shown to everyone (Toys 5; FACTS 7).
4. **Four words you'll meet**: Vibrato, Rate, Extent and Straight note, each with its figure and
   play (Toys 4).
5. **Steps**: the step deck, four steps, the band chart stuck beside the text (Toys 2), with Step
   3's predict, mix-up card and Go deeper drawer in its text (Toys 3).
6. **Sing it**: the comfort check, the voice choice, the optional warm-up, the note, the "What this
   does" box, Start, the briefing, the two holds, their readings and "How did that feel?" (Toys 6).
7. **Quick check**: four questions, question 3's play waiting for Step 3's choice (Toys 5).
8. **Wrap**: the three lines, the one-sentence challenge, the practice card in the version Sing it's
   ending picks (Practice links), the next-lesson card with Lesson 23's still (Toys 7), and free
   play, the steps' toy in every state, holding back what would answer a predict until its choice
   (Toys 2).
9. **Explorer**: the season's map with a tab per season, opening on Season 2's.
10. **Footer**: LESSON.md's, with the practice link, the fonts line and "Every sound on this page is
    synthesised in your browser."

## Length

The learner copy is 2,229 words on `node scripts/lesson-words.mjs`, every branch counted (FACTS 3),
under the series' cap of 2,379 by 150. Each step's own text, with its Try, its Notice and any Tavi
line, runs 89 to 117 words, inside 50 to 120 a step. The page runs about 15 minutes: 9.37 of
reading at 238 words a minute and about 6.1 of sound, toys and tasks, with six quiz questions,
15.46 in all, where the plan expected about 15. The chip is an estimate until the band chart's new
states and the holds are timed in their lab (SEASON-2 § 1.3), and this section says so until then.
Five parts carry more, for these reasons:

- **Step 3, 260 words.** Its own text, with its predict and reveal, is 109; the rest is its heading,
  the mix-up card, which sits in the step whose toy refutes it, and the Go deeper drawer.
- **Sing it, 565 words.** It holds the series' singing lines, Lesson 3's and Lesson 5's word for
  word, which are not cut; the two holds' cues; the "What this does" box; the reading's three
  example lines; and the feelings' lines (FACTS 47 to 60).
- **The quick check, 303 words.** Four questions with three answers each and a line of feedback for
  every answer, as MASTER-PLAN § 4.2 item 8 asks.
- **The recall, 156 words.** Lessons 5 and 14's questions, word for word.
- **The Wrap, 256 words.** The practice card says what Voice Mirror does today, with its vibrato
  sentence, its care lines and its rest version (FACTS 59, 60), and the next lesson.

The hints and status lines are stage directions in LESSON.md and are not counted, as in every text
package: the two predicts' hints and their "You said" lines, the steps' lock line, quick check 3's
lock line, the stored voice's line, Sing it's status lines and its listening note, and the toys'
labels and live lines. A built page writes them in the open: about 150 words by Lesson 8's
reckoning (Lesson 8 FACTS 4), and 33 more for this page's lock lines, Step 3's first hint, "Choose
an answer at the top first." (7), quick check 3's line (8) and free play's two (18). It prints the
reading's three example lines too, under Lesson 5's lead-in, "After each hold, one line, such as:"
(`learn/05.html:1513`), as Lesson 5's built page does. So the built page would run about 2,412
words, some 33 over the cap. A build counts its own page, and while that count runs over the cap it
makes these cuts, in order; every fact they carry stays in FACTS:

1. Step 3's Go deeper drawer, "Which middle?" (39 words; FACTS 19): the step's point rests on its
   reveal, not on which average. Without it the page runs about 2,373, 6 under.
2. Sing it's opening line, "Your turn: one note, ten seconds, twice." (7 words), which the
   section's heading already says.

The activities are timed from FACTS 64 to 71. Free play is not counted.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                 | New in Lesson 22                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Hero and predict       | The kit's predict (`kit/predict.ts`) with a free play, `revealAfter: 'all'`, `onChoice` and `onReveal`; the band chart (`kit/band-chart.ts`); the tour's hold (`kit/tour-gate.ts`)                     | The chart's hero state, with no centre line, ticks or note name; Merc's wave in amber, a still at first paint, redrawn from its play's schedule; the dashed middle line   |
| 2. The band chart, steps  | Lesson 5's band chart and level strip (`kit/band-chart.ts`, `kit/band-chart-hold.ts`); the app's ribbon (`src/lib/effect-renderer.ts`)                                                                 | Four step states and free play, both held back until the choices that would answer: the sweep, the swing counter and the ruler, Drift, Merc's sung wave beside the ribbon |
| 3. Step 3's predict       | The kit's predict, a second on the page, with a free play and several `reveal` elements                                                                                                                | A first hint until the cold open's choice, then mounted; its plays draw on the steps' chart; its choice unlocks the slow wave across the page                             |
| 4. Four words             | Lesson 5's word tickets (`lesson-05/words.ts`), with the page's sound owner                                                                                                                            | Four small band charts that draw their plays' lines                                                                                                                       |
| 5. Recall and quick check | The kit's quiz (`kit/quiz.ts`), its prefix, keys and away links; Lesson 5's question object; Lesson 14's, once built                                                                                   | Ids `l22-q1` to `l22-q4`; quick check 3's play, by ear only, held until Step 3's choice                                                                                   |
| 6. Sing it                | Lesson 5's hold flow, moved into the kit; the comfort check, voice choice and feelings (`kit/comfort.ts`, `kit/voice-choice.ts`); the listener (`kit/listen.ts`); the hold reader (`kit/hold-take.ts`) | Two ten-second holds; no live band state; the centre-line reader, window by window; the vibrato line; the middle drawn after a take with a vibrato                        |
| 7. Tease still            | The kit's next-lesson card and its slot (`kit/next-card.ts`)                                                                                                                                           | Lesson 23's opening as a still, which plays nothing                                                                                                                       |

### 1. The hero and the cold open's predict

The hero's figure is the band chart in a new hero state: the amber band, 35 cents either side of
Merc's note, with no line at its centre, no cents ticks and no note named, over a fixed window 4.5
seconds across, between Merc and Tavi. Across it, from the first paint, lies Merc's line as a
still: the cold open's wave as it will sound, in his amber, swinging past both edges of the band,
as Lesson 21's card and the share card draw it, so Tavi's bubble speaks of a line the learner can
see (FACTS 38, 40). It takes no taps.

- **Play Merc's note** (`wave`, with `data-free`): Merc sings A3, for every learner, for 3.0 s on
  "ooh", with a wave of six swings a second at ±50 cents, grown in over 0.3 s, through the voice's
  vibrato option (What the kit and the app still need, item 4). As it sounds, his line redraws
  across the window at its true pitch, past both edges of the band swing after swing, 16 of its 18
  swings (FACTS 39, 64). It works before a choice and never reveals.
- **Play: top** (`top`) and **Play: middle** (`middle`), locked until a choice: each plays the same
  wave for 2.0 s, 0.3 s of quiet, then a straight note for 2.0 s, 4.3 s in all: the top, 226.45 Hz
  (A3 and 50 cents), or the middle, 220.00 Hz (A3). The wave draws as above; as the straight note
  sounds, its level line draws at its height in Merc's amber, 15 cents above the band's top edge for
  the top, across the band's middle for the middle (FACTS 41).
- The kit's predict, as it is: two `.choice` buttons, "The top of the swing" (`top`) and "The middle
  of the swing" (`middle`). `revealOn: ['top', 'middle']` with `revealAfter: 'all'`, so the reveal
  waits until both straight notes have been heard to their end with sound on
  (`src/features/lessons/kit/predict.ts:53-59`). The hints are LESSON.md's: `chosen` "Locked in. Play
  both straight notes.", `silent` "Sound is off: nothing played. Turn sound on, then play it again."
  and `again` "Play any of them again.", with no `next`, so the locked-in hint stays until the reveal
  (FACTS 41). The markup's lock hint is "Choose an answer to unlock the two straight notes."; `guess`
  gives "You said: the top" or "You said: the middle".
- `onChoice` tells the steps' toy and free play that a choice is in, so each enables what it held
  back for it, and opens Step 3's predict (Toys 3). `onReveal` gives Tavi's quiet celebration (Merc
  and Tavi) and draws the middle line: dashed amber, through the wave's middle, labelled "middle",
  drawing itself left to right over 0.6 s, at once under reduced motion (FACTS 42). The predict's
  `unlocks` is not used: it takes buttons only (`src/features/lessons/kit/predict.ts:64-67`), and
  the steps' sliders are not buttons.
- What a play does to the hint is the kit's: a free play heard before a choice puts the lock hint
  back, and after the choice leaves the locked-in hint; a play sound off kept silent shows
  `silent`; a play cut short, by another sound or by leaving the hero, counts as not heard and
  changes nothing (`src/features/lessons/kit/predict.ts:158-174`).
- The figure's accessible name is "A band 35 cents either side of a held note, with no note
  named". A polite live region says what each play drew, Merc's line swinging past both edges of
  the band, swing after swing, then, after the choice, the straight note sitting 50 cents up, above
  the band, or at the middle of the swing, inside it; the reveal adds that the dashed line marks the
  middle of the swing. Before the choice nothing it says names a note or a middle.

On a first visit the welcome tour waits for the choice. Its step "One step at a time"
(`src/features/lessons/kit/tour-copy.ts:44-46`) scrolls to the steps' stage, which would carry a
learner past the predict, so the page holds the tour until a choice is made, through the kit's
`holdTour` (`src/features/lessons/kit/tour-gate.ts:57-69`), with no time limit, as Lessons 15, 16, 21
and 23 hold theirs. A visit that never chooses is offered the tour again on the next lesson page it
opens at the top (`tourDue`, `src/features/lessons/kit/tour-gate.ts:36-49`); the lesson menu's "Tour
this page" still runs it at once. The hold matters here: the steps' text says where the note is
heard (Step 2's extent measured from the middle, Step 3's reveal and its mix-up card), and the
steps sit further down on a wide screen, under the recall and the four words, and two Nexts from
Step 1 to Step 3 in a phone's deck. A learner who goes there unasked has passed the predict, as on
Lessons 16 and 21's pages (FACTS 1a).

**Before the choice nothing on the page plays its answer.** Every control of the steps' band chart
is disabled and announced as unavailable, under the line "Choose an answer at the top to unlock
this figure.", and the chart draws only its band, with no line, until the cold open's choice (FACTS
1a). Step 1's straight note and its wave on the same note would answer the predict; Step 2's ruler
measures from the middle; Step 3's toy draws the middle; Step 4's sung wave sits on it. The Wrap's
free play holds the same states back under the same line (Toys 2). Step 3's two choices and its
Play: six a second are disabled until then too, so Step 3's predict cannot be answered first. The
four words' plays stay open: none sets a straight note beside a wave's middle or top (Toys 4; FACTS
70). Sing it plays no straight note either: its model notes, the note's taps and its listening note
are Merc's usual "ooh", with its small wave, so no straight note on A sounds anywhere on the page
before the choice (Toys 6; FACTS 48, 56).

### 2. The band chart in the steps

Lesson 5's band chart on the step deck's stage, with Lesson 5's level strip under the plot, on
Merc's A3 for every learner (FACTS 8). In every state the band has no amber line at its centre and
no note name; Merc's line is amber, wave and all, and its middle is drawn as its own dashed amber
line where a step needs it. Every line is computed from its play's schedule, the same sine the voice
plays, so the drawing and the sound share one clock (Audio). The figure is an image with a spoken
summary of what it last drew, and every control is at least 44 px. Four states and free play, with
LESSON.md's plays (FACTS 65 to 68):

1. **Level, wave and swell (Step 1).** A window 4.5 seconds across. **Play straight**: A3 in Merc's
   "ooh" with no wave, 3.0 s, a level line through the band's middle. **Play with a wave**: the same
   note, six swings a second at ±40 cents, grown in over 0.3 s, 3.0 s; the line waves, crossing the
   band's edges a little. **Play a swell**: the note straight and on pitch from its start, 4.0 s, its
   level 0.5 for the first second, rising to 1.0 at 2.5 s and back to 0.5 at 4.0 s, Lesson 14's
   swell without its glide in; the level strip grows and shrinks while the line stays level (FACTS
   17, 65). Live lines: "A level line.", "The line waves up and down, six swings a second." and "The
   line stays level; the strip under it grows, then shrinks."
2. **Rate and extent (Step 2).** The window shrinks to one second and redraws from its left edge
   each second, a sweep, so the chart never scrolls. A **counter** under it reads "6 swings a
   second" and pulses once at each swing's peak; a **ruler** stands from a dashed tick at the wave's
   middle to the top of a swing and reads "±30 cents". **Rate**, 5 to 8 swings a second in steps of
   0.5, and **Extent**, ±10 to ±60 cents in steps of 10, start at 6 and ±30. **Play** sounds 4.0 s at
   their values, grown in over 0.3 s; a slider moved during a play changes the sound within 50 ms,
   through the voice's new vibrato setter, and the line, the counter and the ruler from that moment
   (FACTS 66). **Play Merc's "ooh"**: 2.0 s in the kit's default voice, 5.5 swings a second at ±14
   cents grown in over 0.35 s (FACTS 15); the counter reads 5.5, the ruler ±14, and the line stays
   inside the band. Rate stops at 5, so nothing in the steps can be heard moving before Step 3's
   choice, and Extent at ±60 (FACTS 24).
3. **The middle (Step 3).** A window 3.5 seconds across: Merc's wave at ±50 cents, its middle a
   dashed amber line labelled "middle". **Play: six a second** (Step 3's free play): the cold open's
   wave, 3.0 s. **Play: two a second** (its answering play): ±50 cents at two swings a second, grown
   in over 0.3 s, 3.0 s, six swings. **Rate**, 2 to 7 swings a second in whole steps, with **Play at
   this rate**, 3.0 s, the sound following the slider. **Drift**, a switch: on, the next play's
   middle rises 50 cents over its 3.0 s, so the dashed line climbs and leaves the band at 2.1 s while
   the wave goes on round it (FACTS 23, 67). Rate and Drift wait for Step 3's choice, which its
   predict's `onChoice` gives the toy (Toys 3); Drift switched during a play stops the play. Live
   lines: "Merc's wave, six swings a second.", "The wave, two swings a second." and, with Drift, "The
   middle rose 50 cents and left the band."
4. **Sung and marked (Step 4).** Two panels side by side, one above the other on a phone. **Sung**:
   a window 2.0 seconds across; **Play the sung wave** sounds and draws Merc's wave of 5.5 swings a
   second at ±30 cents, grown in over 0.3 s, for 2.0 s, 11 swings, in amber, inside the band, the
   panel labelled "sung" (FACTS 68). **The app's mark**: the ribbon the app draws for a vibrato note,
   by its own function, `vibratoShapePath` (`src/lib/effect-renderer.ts:214-241`), in chrome, at the
   note's drawn width. **Stretch**, a slider, widens the note from 120 to 330 px, and the ribbon's
   swings go from 5 to 15, one per 22 pixels of width (`src/lib/effect-renderer.ts:226`), while the
   sung wave keeps its 11 swings (FACTS 30). Live lines: "The sung line: 11 swings in 2 seconds."
   and, after a stretch, "The ribbon now swings 10 times; the sung line still swings 11."
5. **Free play (Wrap).** The four states above on one card, every control in each, and no predict
   attached. Season 1's free play locks nothing, because there the guided steps come first on the
   page (`src/features/lessons/lesson-10/wrap.ts:11-12`); this one keeps the steps' holds, since a
   learner can scroll to the Wrap before either choice (FACTS 24). Until the cold open's choice every
   control is disabled, under the steps' line, "Choose an answer at the top to unlock this figure.":
   Step 1's straight note beside its wave on the same note would answer it. Until Step 3's choice,
   Step 3's Play: two a second, Rate and Drift stay disabled, under the line "Answer Step 3's
   question first to hear this." Both predicts' `onChoice` reach it, as they reach the steps' toy,
   and a return visit holds it back again.

On a phone the chart fills the card at 344 to 390 px wide and 160 px tall, Step 4's two panels one
above the other; the controls wrap under it.

### 3. Step 3's predict

The kit's predict, the page's second, on the predict card in Step 3's text: two `.choice` buttons,
"Still one note" (`one`) and "A note that moves up and down" (`moves`); the plays `six` (with
`data-free`, "Play: six a second") and `two` ("Play: two a second"), which draw on the steps' chart
(Toys 2); `revealOn: ['two']`, with the default `revealAfter: 'any'`. The hints are LESSON.md's:
`chosen` "Locked in. Play the slow wave.", `silent` "Sound is off: nothing played. Turn sound on,
then play it again." and `again` "Play either wave again.", with no `next`; `guess` gives "You said:
still one note" or "You said: a note that moves" (FACTS 21, 24).

**Its first hint, and when it mounts.** Until the cold open's choice, its two choices and both plays
are disabled in the markup and its hint reads "Choose an answer at the top first.": its own choices
cannot be used yet, so it asks for the one that opens them. The cold open's `onChoice` then sets the
hint to "Choose an answer to unlock the slow wave.", enables the two choices and Play: six a second,
and only then mounts this predict. The kit's predict keeps the hint it finds when it mounts, "the
page's own hint, asking for a choice" (`src/features/lessons/kit/predict.ts:84-85`), and puts that
hint back after a free play heard before a choice (`src/features/lessons/kit/predict.ts:166-170`),
so a predict mounted with the page would bring "Choose an answer at the top first." back after Play:
six a second. On its own choice the kit enables Play: two a second
(`src/features/lessons/kit/predict.ts:113-131`).

Its `reveal` is four elements: the reveal itself, Tavi's line, the mix-up card, and the Try and
Notice lines. All four stay hidden until the slow wave has been heard to its end with sound on, so
the step shows only its predict until then, since the Notice says the slow note moves and the card
and Tavi's line follow the reveal (`src/features/lessons/kit/predict.ts:70-71`). The Go deeper
drawer stays shown: it is about which average, not about a slow wave. Its `onChoice` tells the
steps' toy to enable Rate and Drift, free play to enable its slow wave, Rate and Drift (Toys 2), and
the quick check to enable question 3's play (Toys 5). So the slow wave cannot sound anywhere on the
page before Step 3's choice, and no other source plays a wave slower than five swings a second
before it (FACTS 1a, 24). No Merc reacts to Step 3's reveal: Merc and Tavi live in the hero.

### 4. Four words

Four tickets, each with its figure and play, as Lesson 5's word tickets are built
(`src/features/lessons/lesson-05/words.ts:1-12`), with the page's sound owner. Each figure is a
small band chart, its band round the word's note with no line at its centre, which draws its play's
line in Merc's amber as it sounds (FACTS 70):

- **Vibrato**: A3, six swings a second at ±30 cents, 2.5 s.
- **Rate**: ±30 cents at five, then seven swings a second, 2.0 s each with 0.4 s between.
- **Extent**: six swings a second at ±20, then ±60 cents, the same timing; the ±60 line crosses the
  band's edges.
- **Straight note**: D3, straight, 2.0 s, a level line through its band.

Every wave grows in over 0.3 s. The straight note is on D, so no play before the cold open's choice
sets a straight note beside a wave's middle or top; and no word plays a wave slower than five swings
a second, so none answers Step 3's predict (FACTS 1a, 24). Under reduced motion each line lands
whole as its play starts.

### 5. Recall and quick check

Two quizzes through the kit's quiz, each with its own prefix and keys.

- **Recall**: Lesson 5's question 3, imported from its questions and filtered by id, `l05-q3`
  (`src/features/lessons/lesson-05/quiz-questions.ts:68-88`), then Lesson 14's question 3, `l14-q3`,
  imported the same way once Lesson 14's page is built; until then its words are LESSON.md's, word
  for word (FACTS 7). Shown to everyone. Prefix `recall-`, keys `fyp-l22-recall-seed` and
  `fyp-l22-recall-v1`; no `lesson`, so it marks nothing done. Its step links read "Try Lesson 5, Step
  4 again" and "Try Lesson 14, Step 3 again" and open that page at the step in a new tab, or keep
  their words with no link where the lesson is not live, through `linkAway`
  (`src/features/lessons/kit/quiz.ts:186-212`).
- **Quick check**: LESSON.md's four questions, ids `l22-q1` to `l22-q4`, keys `fyp-l22-seed` and
  `fyp-l22-quiz-v1`, and `lesson: 22`, so answering all four marks Lesson 22 done. Three answers
  each, shuffled from the stored seed, one line of feedback for every answer, with "Right." or "Not
  quite." before it (`src/features/lessons/kit/quiz.ts:315`). Its step links stay on this page.
- **Question 3's play**: ±50 cents at two swings a second on A3, grown in over 0.3 s, 3.0 s (FACTS
  71); it draws nothing, so the question is answered by ear. It is Step 3's slow wave, and the quick
  check is a scroll from Step 3, so the play is disabled until Step 3's choice, under the line
  "Answer Step 3's question first to hear this.", which goes when Step 3's `onChoice` enables it. Its
  answers stay open: like the steps' text, its feedback says the slow wave moves only to a learner
  who went past Step 3's predict to answer it (FACTS 1a, 24).

### 6. Sing it: two holds

Lesson 5's Sing it (its WEB-SPEC, Toys 6), moved into the kit with options (What the kit and the app
still need, item 7), with two ten-second holds read by the centre-line reader. Every state has a
visible status line that is also announced (`aria-live="polite"`). Each hold allows up to three
takes in a visit, as Lesson 5's does (`TAKES_PER_HOLD`,
`src/features/lessons/lesson-05/hold-flow.ts:31-32`).

States:

1. **Comfort check**, always first and asked every visit, never stored: Lesson 3's line, its list of
   six conditions and its two buttons (FACTS 47), through the kit's `mountComfort`
   (`src/features/lessons/kit/comfort.ts:159`).
2. **Voice choice**, after either comfort answer when none is stored, and before anything in Sing
   it plays, since it picks the Merc who sings with the learner: Lesson 3's two buttons with Merc
   and Tavi's stills (`aria-pressed`, at least 44 px), under LESSON.md's line in its two forms (FACTS
   49). It reads and writes `fyp-voice` (`src/features/lessons/kit/voice-choice.ts:20`), and the
   choice sets the octave of Sing it's notes (`homeOf`,
   `src/features/lessons/kit/voice-choice.ts:53`); the page's examples stay Merc's, on A3 (FACTS 8).
3. **Just listen today**: LESSON.md's line with the doctor lines; Lesson 5's **Play Merc's 10-second
   note**, in his usual "ooh", in the chosen voice, again on each tap; the chart shows the band and
   Merc's amber line; nothing listens, Start is not shown, and nothing asks the viewer to sing
   (REQ-GVC-021). Lesson 5 offers a 15-second note too, for its longer hold; this page's holds are
   both 10 seconds. The Wrap shows the rest card (FACTS 48, 59).
4. **Warm-up**, optional, with Skip: Lesson 3's two cards and words as Lesson 5's page has them,
   with "Copy the way Merc's voice slides, not the exact notes." and the stop line (FACTS 50);
   nothing listens and nothing is scored. Its Skip is remembered as `fyp-l22-warmup`, so a return
   visit opens it folded, as Lesson 5's own key does (`src/features/lessons/lesson-05/sing.ts:53-54`).
5. **The note**: Merc's A in the chosen voice, with **Lower** and **Higher**, a semitone a tap, up to
   four either way, F3 to C♯4 or F4 to C♯5 (FACTS 51, 55); each tap plays the note for 1.0 s in
   Merc's usual "ooh". The move lasts for the visit and is not stored. It comes before Start: finding
   the note needs no microphone.
6. **Briefing**: the "What this does" box (REQ-GVC-002, REQ-GVC-003, REQ-GVC-012, REQ-GVC-026; FACTS 52) and **Start**, the only control that asks for the microphone (MASTER-PLAN § 4.2 item 2),
   through the kit's listener under the page's consumer id, `lesson-22`. With sound off, Start asks
   for nothing and plays nothing, with the hint "Sound is off, so nothing played. Turn sound on to
   hear Merc's note, then press Start.", as Lesson 16's Start does. Under the briefing, Lesson 5's
   lead-in and the reading's example lines, as LESSON.md gives them (FACTS 45).
7. **Hold 1, straight**, in Lesson 5's three phases on the ring, **Listen · Breathe · Sing**.
   Listen: Merc's note, 2.0 s, his usual "ooh", as Lesson 5's model, the singing Merc in `sing`, the
   other listening (FACTS 56). Breathe: the ring breathes once over 2 s; nothing counts down. Sing:
   the ring turns and closes over the hold, the violet line draws on Lesson 5's fixed 10-second
   frame, folded into Merc's octave, and Merc and Tavi both listen. The take opens 0.4 s after
   Merc's note ends, waits up to 6 s for the first voiced frame, then runs exactly 10 s from it, or
   less if the voice stops for more than a second
   (`src/features/lessons/lesson-05/sing-hold.ts:5-20`; `HOLD_QUIET_SEC`,
   `src/features/lessons/kit/hold-take.ts:39-42`). Nothing plays while it is open. **No live band
   state**: during the take the band's edge does not light, the band does not glow and no line names
   where the voice is against the band, since a wave wider than the band would flip it on every
   swing; Lesson 5's take shows its state live (`src/features/lessons/lesson-05/sing-hold.ts:60-88`;
   FACTS 57). The microphone is released when the take ends.
8. **After the take**: the centre-line reader reads it (below). The learner's line stays drawn.
   Where the reader found a vibrato, the line's middle draws itself over it as a dashed violet line
   over 0.6 s, at once under reduced motion; a take with none found draws no dashed line, since its
   line is its own middle. Then one line from the reading, the octave line where it applies, and the
   vibrato line only where a vibrato was found (FACTS 45, 46). The band's edge lights mint beside the
   reading while its line says the voice was in the band. If no voice came within 6 s, the kit's
   line asks again (`NO_START_LINE`, `src/features/lessons/kit/hold-take.ts:48-49`), with **Again**
   while the hold has had fewer than three takes and **Done for today**, and no feeling question,
   since nothing was sung.
9. **How did that feel?**: Lesson 3's four answers after each take with a reading, an answer that
   locks, through `mountFeelings` (`src/features/lessons/kit/comfort.ts:175`), and what each answer
   allows from the kit's rule (`afterFeeling`, `src/features/lessons/kit/comfort.ts:56-82`), with
   `restAfterEffort` set:
   - After Hold 1, Easy or Workable: the singing Merc celebrates if the take was in the band for at
     least 80 % of its length; the tricky line if it was in the band for under half; then "Rest for
     a few easy breaths. Ready when you are." with **Hold 2: floating** (only when Hold 1 has a take
     with a reading), **Again** (while Hold 1 has had fewer than three takes) and **Done for today**.
     The rest has no timer: the singer ends it.
   - After Hold 2, Easy or Workable: the summary, "This time the middle of your line was in the band
     for X of 10 seconds, then Y of 10.", from each hold's counted take, or the first alone while
     Hold 2 has none with a reading; the tricky line if either was under half; the celebration if
     Hold 2's take was in the band for at least 80 % of it; then **Again** (while Hold 2 has had
     fewer than three takes) and **Done for today**.
   - Effortful: the reading stays; no celebration, no Again and no Hold 2; "Keep it gentle: rest
     before you sing again." and only **Done for today**; the Wrap shows the rest card (FACTS 59).
   - Uncomfortable: the reading is taken away; no celebration, no Again and no more holds; "Thanks
     for saying so. That's enough singing for today: rest your voice." with the doctor lines; the
     microphone stays off; the Wrap shows the rest card (REQ-GVC-021, REQ-GVC-023, REQ-GVC-024).
   - Once "Effortful" or "Uncomfortable" has been answered, no further take and the rest card stay
     so for the visit, in memory, through the kit's `VisitEnding`
     (`src/features/lessons/kit/comfort.ts:101-114`).
10. **Hold 2, floating**: as Hold 1, with the same model note, Merc's usual "ooh", 5.5 swings a
    second at ±14 cents, inside the band, drawn as the kit draws his line, steady at the band's
    centre (FACTS 56).
11. **Done for today** ends the checkpoint with the status "Done for today." and leaves the Voice
    Mirror card in the Wrap.
12. **No microphone** (refused, no device, or the listener failed to load): LESSON.md's "No
    microphone?" line and Lesson 5's **Play Merc's 10-second note**, as in state 3; nothing listens;
    the Wrap keeps the practice card. Without Web Audio, Sing it offers this path at once, and the
    play draws its note in silence with "This browser can't play sound here."

The flow is a pure rule, Lesson 5's moved into the kit, with this page's options: the holds'
lengths, 10 and 10; Hold 2 only after Easy or Workable on a Hold 1 take with a reading; three takes
a hold; one listening note; no live band state; the centre-line reader; `restAfterEffort` on; and
the summary's subject, "the middle of your line". Both holds take Lesson 5's model note, so the
flow needs no option for it. From the hold, the take's reading, the answer and the takes so far it
gives the next state, the buttons, the lines, whether the singing Merc celebrates and the Wrap's
card, so every branch is unit-tested without a microphone (Tests, 11). Lesson 5's own constants
stay its defaults (`src/features/lessons/lesson-05/hold-flow.ts:28-37`).

**The centre-line reader** (`kit/hold-centre.ts`, new, pure and unit-tested; What the kit and the app
still need, item 6):

- **Input**: the take's raw frames, Merc's MIDI note and the hold's length, as the kit's hold reader
  takes them: voiced frames from Voice Mirror's preprocessing, a median of 5 frames within each
  voiced run, each one's distance from Merc's note folded into his octave, and the octave count from
  the median of the unfolded difference (`src/features/lessons/kit/hold-take.ts:5-14`; FACTS 43).
- **Find the vibrato, window by window.** Trim the voiced frames 0.4 s at the start and 0.2 s at the
  end, as Voice Mirror's steadiness does (`src/lib/mirror/metrics.ts:66-68`). Take windows 3.0 s
  long, the first at the trimmed start and one every 0.5 s after it, the last ending at the trimmed
  end; a trimmed span of 3.0 s or less is one window. Judge each by Voice Mirror's rule: the shared
  detector finds a modulation, its rate lies between 3.5 and 8.5 swings a second, and the sine
  fitted near that rate reaches 10 cents (`src/lib/mirror/metrics.ts:496-511`). The rule moves into
  one exported function that Voice Mirror's steadiness and this reader both call, so the two judge a
  stretch of frames alike; Voice Mirror still runs it once on the whole trimmed hold, and its results
  and tests stay as they are. A finding window covers its own span, and one at the trimmed start or
  end reaches on to the hold's first or last frame.
- **No window finds one**: the reading is today's, frame for frame and line for line.
- **Where windows find one**: inside the spans they cover, each frame's folded distance becomes the
  line's mean over exactly one swing centred on it, at the rate of the finding window whose middle is
  nearest. Each frame holds its value for the time it stands for, the time to the next frame in its
  stretch, or one hop for a stretch's last frame, and a frame at the swing's edge counts for its part
  inside it. A mean never reaches across a stall, a gap of more than Voice Mirror's voiced-run gap of
  0.12 s, or past the hold's ends: there it keeps its one swing's length, shifted inside. Outside the
  covered spans the raw distance stands. The hold is then read on that middle line by the hold
  reader's own rules: the band test at 35 cents, the time in the band rounded down to 0.1 s,
  settling at 0.5 s unbroken, a stall between two frames in the band counted as in it, and its lines
  (`src/features/lessons/kit/hold-take.ts:16-26`; `holdLine`,
  `src/features/lessons/kit/hold-take.ts:231-259`).
- **Why windows, and why one swing.** Hold 2's cue invites a vibrato that comes part-way through,
  and a singer's rate wanders. Voice Mirror's rule run once over the whole hold misses a vibrato that
  starts 8 s in, and its one sine slips out of phase as the rate wanders (FACTS 44). A running mean
  exactly one swing long takes out a sine of that rate whatever its phase and passes a straight
  drift unchanged, so a middle that drifts still leaves the band; when the rate wanders the leftover
  is small, ±7.8 cents of a ±50 wave at 7.2 swings a second in a window set for 6 (FACTS 44). Voice
  Mirror takes the fitted wave's share out of its wobble figure, not out of the line
  (`src/lib/mirror/metrics.ts:507-510`), so the middle line is this reader's own work.
- **The description**: the rate is the median of the finding windows' rates, to 0.1. The extent is
  √2 times the RMS of the raw distance less the middle line, over the frames where that difference's
  RMS over one swing reaches 10/√2 cents, in whole cents: for a sine, its swing either side. These
  are the reader's own numbers, not Voice Mirror's, whose fit runs once over the whole hold, so for
  the same hold the two can differ, most for a vibrato that comes late or wanders; both read below
  the sung extent, since the median and the pitch stream's analysis buffer trim a vibrato's peaks
  (FACTS 46).
- **Output**: the reading as today's, plus the middle line, for the dashed drawing, and the
  vibrato's rate and extent, for the vibrato line, or none.
- **The vibrato line**, new: "The note had a wave: about 5.6 swings a second, ±38 cents.", the rate
  written to 0.1 without a trailing ".0" and the extent in whole cents, only when a vibrato was
  found. A vibrato wider than the band, say ±60, is described the same way, with nothing added. No
  line when none was found. It describes the sound and is never scored: the score is the time the
  middle line spends in the band, and nothing scores a vibrato's presence, rate or extent (FACTS
  46).
- **The summary** takes its subject from the page, "the middle of your line" here where Lesson 5's
  says "your line", as an option of the kit's summary (`holdSummary`,
  `src/features/lessons/kit/hold-take.ts:330-343`).

On a phone the chart and its lines fit Sing it's card at 344 to 390 px, the 10-second frame with its
seconds named under it, as Lesson 5's (`src/features/lessons/kit/band-chart.ts:16-18`).

### 7. Tease still

The drawing in the next-lesson card's slot, the page's `[data-next-card]` mark: an SVG,
`aria-hidden`, of Lesson 23's opening as its share card draws it, an upright pitch line between Merc
and Tavi, C4 at its foot and C5 at its top, the words "an octave: 12 semitones", and nothing between
the two Cs (FACTS 5). It holds no button, since the card is a link, does not move and plays no
sound. Its styles go under a class of its own, not the tease line's `.next-tease`.

## Audio

Every sound is synthesised in the page with Web Audio, through the kit's sound module, its master
bus and its house envelopes, and started only by a tap: every example in Merc's "ooh" on A3, and
Sing it's notes in the chosen voice's octave, each with the vibrato its play names, or none (FACTS
62 to 71). Nothing autoplays, and the page has no music bed.

- **The sound rules**, for every source of sound on the page (the cold open's three plays, the four
  words, every play of the steps' toy and of free play, Step 3's two plays, quick check 3's play, the
  warm-up, the note's taps, Merc's model notes and the listening note):
  1. One sound plays at a time, across the whole page: a new play stops the one before.
  2. Leaving a step, by any route, stops its sound and any queued play; scrolling Sing it off screen
     for 600 ms, or hiding the page, stops what plays there and abandons a take.
  3. A play that is cut short never counts as heard by either predict.
  4. Nothing plays during a take: every play control is disabled from Start until the take ends.
  5. A play that would answer a predict stays disabled until that predict's choice, wherever it
     sits on the page (Toys 1 to 5).

  The kit has the page-wide owner every source registers with (`NowPlaying`,
  `src/features/lessons/kit/now-playing.ts:39`).

- **Waves.** Every wave is a pure sine on the pitch, from the voice's vibrato option at the play's
  rate and extent, its depth grown in linearly from 0 at the voice's start over 0.3 s, or over 0.35 s
  for Merc's default "ooh", its phase 0 at the start, in the demo voice's form
  (`src/lib/demo-voice.ts:33-37`). Each figure draws its line from the same schedule, the extent
  times the grown-in share times the sine of the phase, so the drawing and the sound share one
  clock; nothing is analysed from the audio. A straight note has no modulator at all.
- **The sliders.** Step 2's and Step 3's sliders change a sounding voice's rate and extent through
  the new vibrato setter, gliding over 50 ms; the drawing integrates the rate, so its line stays
  continuous through the change.
- **Drift and the swell are contours.** Drift glides the voice's pitch from the note to 50 cents
  above over 3.0 s, and the swell holds a straight note while its level moves through its three
  points, both scheduled on the audio clock (`src/features/lessons/kit/sound.ts:16-21`; `contourVoice`,
  `src/features/lessons/kit/sound.ts:321-347`).
- **Merc's model notes** in Sing it are timed notes with the default vibrato, before both holds, as
  Lesson 5's are (`playTone`, `src/features/lessons/kit/sound.ts:561-569`;
  `src/features/lessons/lesson-05/sing-hold.ts:106`).
- **One low note.** The page's lowest sound is D3, 146.83 Hz, the Straight note word, which a
  phone's speaker carries through the "ooh"'s overtones, as Lesson 14's D3 does (FACTS, Layout).

## Merc and Tavi

Lesson 1's setup through the kit (`src/features/lessons/kit/merc-duo.ts`): the app's renderer loaded
after first paint, one WebGL context per Merc, medium quality on phones, paused off screen, and the
stills when WebGL fails.

- They live in the hero, on either side of the band. Tavi asks and Merc answers in the bubbles,
  which show from the start, over the still line. While the cold open's note sounds, Merc sings
  (`mercSing`, `src/features/lessons/kit/merc-duo.ts:165`) and Tavi listens (`mercListen`, `:207`),
  for every learner, since the page's examples are Merc's (FACTS 8). Tavi celebrates once as the
  reveal shows, quietly, with no sparkles, since the reveal calls no choice right (`mercCelebrate`,
  `:217`; `MercDuoOptions`, `:119`).
- In Sing it the singing Merc appears as a still beside the chart, Merc for the lower voice and
  Tavi for the higher, and sings the model note; during a take both listen; the singing Merc
  celebrates only after Easy or Workable, for a take in the band for at least 80 % of its length, at
  most once a hold (FACTS 58).
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Voice Mirror's hold.** The link is `/mirror?lesson=22`, printed mercurypitch.com/mirror,
  as Lesson 5's card links its own (`learn/05.html:1821-1834`). The card says what Voice Mirror does
  at `c60f0fdcb` (FACTS 28, 29, 37): glides, a hold of any comfortable note for six seconds, with
  "I'm done" after 2, then five notes to sing back; for the hold, how fast the note drifted and how
  much it wobbled, in cents, under a steadiness score; and, when it finds a vibrato between 3.5 and
  8.5 swings a second reaching 10 cents, its rate and extent, said to be a feature and not scored,
  and kept out of the wobble. It is free, with no account. It is the season plan's link for this
  lesson (SEASON-2 § 5.1, `docs/plans/find-your-pitch/SEASON-2.md:859`).
- **The rest version.** After "Effortful", "Uncomfortable" or "Just listen today" the card shows
  Lesson 12's form with Lesson 5's words, headed "Rest today", with no "Ten minutes" line, and is no
  longer a link, since Voice Mirror asks for the voice (`mountPractiseCard`,
  `src/features/lessons/kit/comfort.ts:126-149`; FACTS 59).
- **The first visit.** Voice Mirror is its own document, so a link to it never meets First Light,
  and the card has no first-visit line (`src/seo/entry-pages.ts:154-157`; FACTS 34).
- **The lesson marker.** Nothing reads `?lesson=22` until SEASON-2 § 5.2 item 21 widens the marker,
  and until then the quiz's answers are refused whole (FACTS 35).
- **Not linked**: the Vibrato exercise, whose help uses a health word and gives a method for
  building a vibrato, whose default is "the polished sound" and which scores the vibrato itself
  (`src/features/exercises/exercise-help.ts:109-116`; FACTS 31); Long Note Lantern, whose help counts a
  vibrato as wobble so a straight tone scores highest (FACTS 32); and Long Note, which scores the
  spread of every cent, a vibrato's included, and still asks for a note held as long as you can
  (FACTS 33).
- **Needed: the Vibrato exercise's copy and default** (SEASON-2 § 5.2 item 14), the app's work, to
  make the drill consistent with Voice Mirror's report. Once it ships, whether the card ever links a
  drill that scores the vibrato itself stays the coach's call; until then the card links Voice
  Mirror alone. SEASON-2 § 5.3 lists, as a gap, a vibrato practice that neither scores the vibrato
  nor rewards a straight tone, other than Voice Mirror's report.
- No premium exercise is linked: Voice Mirror is free (FACTS 37).

## Explorer and season data

Lesson 22's entry, proposed for Season 2's data in its own module, in Season 1's entry form, as
Lesson 5's is (`src/features/lessons/kit/season.ts:245-263`):

- `n: 22`, `lane: 'voice'`, `title: 'Vibrato'`, `short: 'Vibrato'`, `topics: ['S19']`, with S19's
  name as SEASON-2 § 4.1 gives it; the hook word for word (FACTS 1); `minutes: 15` and
  `page: '/learn/22'` once the page is built, under the drafts' comment,
  `// A draft until its sign-off (drafts.ts), as Lesson 3 is.`
- `pr.link`: `href` `/mirror?lesson=22`, `addr` `mercurypitch.com/mirror`, `label` "Voice Mirror" and
  `note` "its Hold: a vibrato reported, never scored", in Lesson 5's form (FACTS 28). `pr.needs`,
  "The Vibrato exercise's copy and default (SEASON-2 § 5.2 item 14), before any link to it", is the
  team's only: the field is "Admin only, never drawn on a lesson page"
  (`src/features/lessons/kit/season.ts:102-103`).
- `EDGES` gains [14, 22], as SEASON-2 § 4.3 gives it (FACTS 2); Lesson 22's prerequisite list is
  then [14] (`PREREQ`, `src/features/lessons/kit/season.ts:452-458`).
- The tease on Lesson 21's card is this lesson's, set on Lesson 22 in the lesson copy: `tease`
  "Merc holds one note, and its line swings past both edges of the band.", with `teaseAlts`
  `[{ id: 'nudged', text: 'Each fifth is nudged two cents. A held note can move far more.' }]` and
  the variant's team note (FACTS 5b). The tease on this page's card is Lesson 23's, set on Lesson
  23: "One note, swinging. Now two notes together: one pair wants to move.", with the alternative
  `hold` (FACTS 5). Each is at most `TEASE_MAX`, 70 characters
  (`src/features/lessons/kit/lesson-copy.ts:76`).
- The signature line for the admin console, from the card (FACTS 4): "Lesson 5's band, zoomed until a
  held note's wave shows: a counter and a ruler measure it, a middle line draws itself, and the
  app's ribbon stands beside it, labelled a mark."
- The explorer's card shows "15 min" once the page is live.

## What the kit and the app still need

Found in the kit and the app as they stand on main at `c60f0fdcb`. Every item is proposed.

1. **The lesson host**: `learn/22.html` at `/learn/22`, which every build takes as a lesson page
   (`lessonPages`, `tools/draft-lessons.ts:82`); `/learn/22` and `/learn/22.html` in
   `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`); and the first-paint budgets. The lesson
   pages' route already takes any two digits (`LESSON_PAGE`, `src/lesson-gate.ts:134`).
2. **The draft line**, in the draft list's form:
   `22: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`, as Lesson 5's
   (`src/features/lessons/kit/drafts.ts:31-41`).
3. **Seasons in the kit** (SEASON-2 § 6.2 item 1), as Lesson 15's spec sets them out; the masthead
   then names Season 2, where today its season is a constant
   (`src/features/lessons/kit/lesson-menu.ts:111`).
4. **Merc's voice with its vibrato as a parameter** (SEASON-2 § 6.1 item 6), code with tests:
   - `VoiceOptions` (`src/features/lessons/kit/sound.ts:30-46`) gains a `vibrato` option of a rate,
     an extent either side and a grow-in time, or null, in the demo voice's form
     (`src/lib/demo-voice.ts:33-37`). Absent, a voice keeps today's, Merc's "ooh" its 5.5 swings a
     second at ±14 cents over 0.35 s and the soft tone none
     (`src/features/lessons/kit/sound.ts:188-199`); null, a straight note, with no modulator built;
     set, that rate, extent and grow-in, its phase 0 at the voice's start.
   - The voice's handle gains a vibrato setter that glides the modulator's rate and depth to new
     values over 50 ms, for Step 2's and Step 3's sliders.
   - The timed note, the sung line and the contour pass the option through
     (`src/features/lessons/kit/sound.ts:321-347`, `:561-584`).
   - Tests: a voice built with null has no modulator; one with 6, 50 and 0.3 has a modulator at 6 Hz
     whose depth reaches 50 cents at 0.3 s; with no option every Season 1 play builds what it builds
     today; the setter moves rate and depth within 50 ms without restarting the voice.
5. **The band chart's new states** (`src/features/lessons/kit/band-chart.ts`), code with tests:
   - **No centre**: a figure option that hides Merc's amber line and the cents ticks and names no
     note, for the hero, the four words and the steps.
   - **Merc's wave from a schedule**: a line drawn in his amber at its true pitch from a play's rate,
     extent, grow-in and drift, as the sound plays it, and the same line drawn whole as the hero's
     still at first paint.
   - **The middle line**: dashed, labelled "middle", drawing itself over 0.6 s: amber from Merc's
     wave's schedule in the hero and the steps, violet from the reader's middle line in Sing it, only
     when the reader found a vibrato.
   - **The sweep, the counter and the ruler** (Step 2), and **the rising middle** (Step 3's Drift).
   - **The ribbon panel** (Step 4): the app's ribbon at a set width, in chrome, labelled, beside
     Merc's sung wave (`src/lib/effect-renderer.ts:214-241`).
   - **No live band state** for a take: the lit edge, the glow and the band words off until the take
     ends.
   - With these the page meets the season's vibrato view for its own needs (SEASON-2 § 6.2 item 6,
     `docs/plans/find-your-pitch/SEASON-2.md:1072`): Sing it draws the learner's line and its
     middle, and gives its rate and extent in words. SEASON-2 § 6.1 item 6 calls the trace beside the
     ribbon "the measured wave"; on this page it is Merc's synthesised wave, labelled "sung" (FACTS
     68).
6. **The centre-line reader**, code with tests (Toys 6; FACTS 43, 44, 46), for SEASON-2 § 5:
   - In Voice Mirror's metrics, the wave finding lifted out of its steadiness
     (`src/lib/mirror/metrics.ts:496-511`) into one exported function, which the steadiness then
     calls on the whole trimmed hold, as now, its results and Voice Mirror's tests unchanged.
   - `kit/hold-centre.ts`, pure, beside the hold reader: that function on 3-second windows every
     half second across the trimmed hold; the running mean one swing long wherever a window found a
     vibrato; the hold read on the middle line by the hold reader's own rules; the middle line, and
     the vibrato's rate from its windows and extent from the line less its middle, returned with the
     reading.
   - The vibrato line, and the summary's subject as an option (`holdSummary`,
     `src/features/lessons/kit/hold-take.ts:330-343`).
   - Its tests are Tests 8 to 10.
   - The page is not published without it, as the lead answered on 2 November 2026: today's reader
     counts frames, so on the kit's 16 ms frames a vibrato of ±50 cents at six swings a second reads
     about 6 of 10 seconds in the band, and ±60 about 4 (FACTS 43).
7. **Lesson 5's hold flow in the kit**, code with tests: Lesson 5's take
   (`src/features/lessons/lesson-05/sing-hold.ts:1-20`), its flow rule
   (`src/features/lessons/lesson-05/hold-flow.ts:1-22`) and its Sing it move into the kit with
   options: the holds' lengths, 10 and 15 there, 10 and 10 here (`HOLD_SEC`,
   `src/features/lessons/lesson-05/hold-flow.ts:28-29`); the listening notes, a 10-second and a
   15-second note there, one 10-second note here; the reader, today's or the centre-line reader;
   the live band state, on there and off here; `restAfterEffort`, off there and on here; Hold 2's
   button; and the summary's subject. Lesson 5's page keeps its behaviour, and its tests move with
   the code.
8. **The lesson copy**: this lesson's tease and its variant set on Lesson 22, with the variant's team
   note (FACTS 5b), within `TEASE_MAX` (`src/features/lessons/kit/lesson-copy.ts:76`): 69 and 62
   characters; and the signature line in the team's notes.
9. **Season 2 in the app's lesson plumbing** (SEASON-2 § 5.2 item 21), the app's work; the lesson
   marker's range (`src/lib/lesson-marker.ts:11-19`) and the lesson-answer bounds
   (`workers/db-worker/src/mirror-metrics.ts:57-62`), which refuse Lesson 22's answers whole today
   (FACTS 35).
10. **The head and the share card** (Sections, 2): the title, the descriptions, the share card
    `learn/lesson-22-og.jpg` and its alt, and the structured data with `timeRequired` `PT15M`; the
    head test already has its word for fifteen (`src/tests/lesson-pages.test.ts:83`).
11. **Lesson 14's questions as a module** (`lesson-14/quiz-questions.ts`), so this page imports
    `l14-q3` (Toys 5).
12. **The Vibrato exercise's copy and default** (SEASON-2 § 5.2 item 14), the app's work (Practice
    links).
13. **At release, the room's link back**, optional: SEARCH § 8's `/mirror` row gains 22; so does
    Voice Mirror's `lessonsPractised` (`src/seo/entry-pages.ts:177`), which links each released
    lesson from its document (`src/seo/entry-pages.ts:70-77`).

## Decisions for the owner

1. **The page's title.** SEARCH.md § 4 has no Season 2 drafts. Recommended: "What is vibrato in
   singing? | MercuryPitch" (42), a question in the words people type, as SEARCH § 3.1 asks. The
   alternative, "Vibrato: rate, extent and the note you hear | MercuryPitch" (58), names the
   lesson's two measures. Neither names a straight note, a middle or a centre (FACTS 1a).

## Edge cases

- **Sound off, unset or missing.** Every play obeys the kit's `canPlay`. Both predicts' reveals wait
  for plays heard with sound on; Start waits for sound (Toys 6). With no Web Audio the page stays
  readable, every play runs its drawing in silence with its hint, and Sing it offers the
  no-microphone path.
- **Before the cold open's choice**: both straight notes are locked and the reveal hidden; the
  steps' toy and free play are disabled under their lock line; Step 3's choices and its Play: six a
  second are disabled and its hint reads "Choose an answer at the top first."; no straight note on A
  sounds anywhere on the page; the tour waits (Toys 1).
- **Before Step 3's choice**: Play: two a second, Rate and Drift in Step 3 and in free play, and
  quick check 3's play, are disabled; quick check 3's answers stay open (Toys 2, 3 and 5).
- **Step 3's Play: six a second heard before its choice**: the hint goes back to "Choose an answer
  to unlock the slow wave.", the hint its predict found when it mounted (Toys 3).
- **One straight note heard, the other not**: the hint stays `chosen`; the reveal waits for the
  other.
- **A play cut short** (another sound, a step link, leaving the hero or the step): not heard, no
  reveal, the hint as it was; the line keeps what it last drew.
- **Step 3's choice made, the slow wave not yet heard**: the hint stays `chosen`; the reveal, Tavi's
  line, the card, Try and Notice stay hidden; Rate and Drift work, and so do quick check 3's play and
  free play's.
- **A return visit** starts with both predicts fresh, so the steps' toy, free play, Step 3 and quick
  check 3's play hold back again until their choices.
- **A slider moved during a play**: Step 2's and Step 3's Rate change the sound and the line from
  that moment; Drift switched during a play stops it, and the next play takes it.
- **Reduced motion**: lines land whole; the middle line appears at once; nothing travels.
- **A first visit that never chooses**: the welcome tour waits, and the next lesson page opened at
  the top offers it again; "Tour this page" runs it at once (Toys 1).
- **No voice chosen**: every example sounds on A3, as it does for every learner; nothing in Sing it
  plays until a voice is chosen, and the voice moves only Sing it's notes.
- **The microphone refused** at Start: the no-microphone path, with Lesson 5's 10-second note; no
  take is counted.
- **A hold with no voice in 6 s**: the kit's no-start line, with Again while takes remain; no
  feeling question.
- **A hold that stops early**: Lesson 5's line for it, read from the middle line ("Stopping early is
  fine."), with a vibrato found if a window finds one in the frames there are.
- **Too little voice to read**: the not-steady line, never a low reading (REQ-GVC-031).
- **A wave outside 3.5 to 8.5 swings a second**, a slow swing or a fast flutter: not taken out; the
  hold is read frame by frame, as today, and no vibrato line shows.
- **A vibrato that comes late, or whose rate wanders**: found in the windows where it is and read on
  its middle there; the rest of the hold is read frame by frame (Toys 6).
- **A vibrato wider than the band**: the middle is read; the vibrato line gives its extent in the ±
  form, with nothing added.
- **A middle that drifts**: read as it moves, so a drifting note leaves the band, as in Lesson 5
  (FACTS 22).
- **Singing an octave or two from Merc's note**: the frames are folded, and the octave line shows
  within 50 cents.
- **A take abandoned** (page hidden, Sing it scrolled away for 600 ms): it counts as a take; no
  feeling question; Again comes back while takes remain.
- **Effortful after Hold 1**: no Hold 2 this visit; the Wrap shows the rest card.
- **No WebGL**: the Mercs' stills; everything else runs.
- **No storage** (a private window): the quiz seeds, the voice and the warm-up's fold last for the
  visit; nothing breaks.
- **Lesson 5 or 14 not live** where the page is served: the chip stays a plain chip and the recall's
  step links keep their words with no link (FACTS 2, 7).
- **The practice link before item 21 ships**: Voice Mirror opens as for any visit, since it never
  meets First Light, and the quiz's answers are refused until then (FACTS 34, 35).

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-22/`, and on the kit
parts it adds:

1. **Sounds**: every fixed sound's frequency equals `hz(m)` for FACTS 62's notes, with the cold
   open's top at 226.45 Hz; every play's length, rate, extent and grow-in as FACTS 64 to 71 give
   them, every wave grown in over 0.3 s and Merc's default "ooh" over 0.35 s; Step 1's swell
   straight, its levels 0.5, 1.0 and 0.5 at 1.0, 2.5 and 4.0 s.
2. **The voice's vibrato option** (What the kit and the app still need, item 4).
3. **The range**: every note of F3 to C♯4 and F4 to C♯5 at least 2 semitones inside every preset of
   its voice in `VOCAL_RANGES`, with the table's numbers (FACTS 55).
4. **The cold open's predict**: at first paint the hero draws Merc's still line; neither straight
   note plays before a choice; Play Merc's note works before it and never reveals; the reveal waits
   for both straight notes heard to their end with sound on; a play cut short reveals nothing and
   leaves the hint; no `next` hint is set; the hints and guesses are LESSON.md's (FACTS 38, 41).
5. **Step 3's predict**: until the cold open's choice its choices and Play: six a second are
   disabled and its hint reads "Choose an answer at the top first."; on that choice the hint reads
   "Choose an answer to unlock the slow wave.", the choices and Play: six a second enable and the
   predict mounts; Play: six a second heard before its choice brings back the second hint, never
   the first; Play: two a second, Rate and Drift wait for its own choice; the reveal, Tavi's line,
   the card, Try and Notice stay hidden until the slow wave is heard; Play: six a second never
   reveals (FACTS 1a, 21, 24).
6. **Nothing answers either predict before its choice**: at first paint the hero draws no centre
   line, no note name and no cents; the lesson menu's headings, the recall and the four words name
   no middle; the steps' toy and free play play and draw nothing until the cold open's choice; the
   four words' straight note is on D3; Sing it's model notes, the note's taps and the listening note
   are the default "ooh", so no straight note on A sounds before that choice; quick check 3's play
   and free play's two a second, Rate and Drift are disabled under their lock line until Step 3's
   choice, and no source plays a wave slower than five swings a second before it; a return visit
   holds them all again (FACTS 1a, 24, 48, 56, 70, 71).
7. **The recall and quick check**: `l05-q3` imported, not copied, and `l14-q3` once it exists; the
   links open `/learn/05#step-4` and `/learn/14#step-3`; ids `l22-q1` to `l22-q4`, three answers
   each, one right, LESSON.md's words; no feedback line starts "Right", "Yes" or "Correct".
8. **The centre-line reader**, on synthetic frames 16 ms apart, the kit's test hop, through Voice
   Mirror's `preprocess`, each case at twelve phases of the wave against the frames; the numbers
   are from the writer's model of both readers (FACTS 43, 44, 46; `verify22.py`, sections 10 and
   11):
   - a ±50 wave at six swings a second round Merc's note for 10 s reads in the band for all 10
     seconds, where today's reader gives 6.1 to 6.4, and is described at 6 swings a second, ±40 to
     ±50;
   - the same wave with its rate rising from 6.0 to 7.2 over its last 1.7 s reads at least 9.8;
   - a ±50 wave that starts 8 s in, and one that starts 6 s in, read at least 9.8, where today's
     reader gives 9.2 to 9.3 and 8.4 to 8.6, and each is described at ±40 to ±50;
   - a ±50 wave whose rate drifts from 5.5 to 6.5 a second over the hold reads at least 9.8 and is
     described at ±40 to ±50; a ±60 wave drifting from 5.0 to 7.0 reads at least 9.8 and is
     described at ±45 to ±55;
   - a ±60 wave at 5.5 a second reads 10.0, where today's reader gives 3.9 to 4.0, and is described
     at 5.5 swings a second, ±45 to ±55;
   - a ±40 wave whose middle drifts from 0 to 60 cents above over 10 s reads 5.6 to 5.9, its middle
     leaving the band at 5.8 s;
   - a ±50 wave at two swings a second is not found and reads as today's reader reads it, 4.8 to
     4.9, with no vibrato line;
   - a straight hold with ±5 cents of noise finds no vibrato and reads exactly as today, line for
     line;
   - a ±8 wave at six a second is not found and reads as today;
   - the ±50 wave an octave lower reads the same, with the octave line;
   - a hold that stops at 4 s reads at least 3.8 of its 4.0 seconds, with Lesson 5's stopped-early
     line, where today's reader gives 2.4 to 2.5;
   - a stall of 0.3 s with no frames mid-hold changes the reading by at most 0.1 s;
   - a hold whose trimmed frames span 3.0 s or less is judged as one window.
9. **The shared wave finding**: Voice Mirror's steadiness gives the same results on all its existing
   tests once the finding is lifted out.
10. **The vibrato line and the summary**: the line only with a vibrato found; "about 5.6 swings a
    second, ±38 cents" for a rate of 5.6 and an extent of 38, and "about 6 swings a second" for
    6.0; the rate the median of the finding windows' rates; on frames that skip the median filter, a
    ±50 sine described as ±50, within 1; no score and no advice in the line; the summary "This time
    the middle of your line was in the band for 9.8 of 10 seconds, then 9.6 of 10." for two
    readings, and Lesson 5's own summary unchanged (FACTS 45, 46).
11. **The flow rule** with this page's options: the voice before anything in Sing it plays; Hold 2
    only after Easy or Workable on a Hold 1 take with a reading; at most three takes a hold, every
    take counted; no hold after Effortful or Uncomfortable; Uncomfortable takes the reading away;
    the celebration only after Easy or Workable, for a take at least 80 % in the band, once a hold;
    the rest card after Effortful, Uncomfortable and Just listen today, the practice card otherwise,
    with no microphone too; one listening note; and Lesson 5's flow unchanged with its own options
    (FACTS 48, 54, 58, 59).
12. **No live band state, the middle and the models**: from Start to a take's end no lit edge, glow
    or band words; after it the dashed middle where a vibrato was found and none where none was,
    then the lines; both holds' model notes are the default "ooh" (FACTS 56, 57).

Page tests, against a local or dev build, never production:

13. The head test (`src/tests/lesson-pages.test.ts`): the title within 60 characters, the
    description 80 to 160 with "A fifteen-minute lesson", the chip "15 minutes" and `timeRequired`
    `PT15M`.
14. No planning text on the page: no topic code such as "S19", no "planned", "slug" or "for the
    team" (`src/e2e/learn-no-planning-text.spec.ts:22-41`).
15. The stage-fit test at the four short landscape sizes, every step's controls on screen with the
    stage stuck (`src/e2e/learn-stage-fit.spec.ts:229-235`).
16. The first-paint budgets for `learn/22.html`.
17. The claims validator over LESSON.md and WEB-SPEC.md, 0 flagged lines (FACTS, Claims check).
18. **The tour's hold**: on a first visit at the top the welcome tour does not open before the cold
    open's choice and opens after it (Toys 1).
19. **One sound at a time**: a word's play stops a cold open play; a step's play stops a word's;
    every play control is disabled during a take.
20. No background staff on `learn/22.html` (Lesson 15's test).
21. **The locks, in a browser**: before the cold open's choice the steps' toy and free play show
    their lock line and nothing in them plays; before Step 3's choice quick check 3's play and free
    play's slow wave, Rate and Drift are disabled under their line, and each enables on that choice
    (Toys 1 to 5).

## Contract

Lesson 1's contract, unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of
GSAP, and practice links that carry `?lesson=22`. Then the layout, accessibility, sound, motion and
storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children,
touch targets of at least 44 px with no two tap zones overlapping, visible focus, a single dark theme
with every colour a token and an explicit body background, sound only after a tap, the microphone
only after Start, localStorage only for per-viewer conveniences inside try/catch, and the whole page
usable with no sound, no microphone, no WebGL and no storage. The figures' accessible names and every
live region use words only, and every note is spoken with its letter and octave. The page stores the
quiz seeds and records (`fyp-l22-recall-seed`, `fyp-l22-recall-v1`, `fyp-l22-seed`,
`fyp-l22-quiz-v1`), `fyp-done` (`src/features/lessons/kit/progress.ts:12-15`), `fyp-voice`
(`src/features/lessons/kit/voice-choice.ts:20`), `fyp-motion`
(`src/features/lessons/kit/motion-switch.ts:12`), `fyp-pos` (`src/features/lessons/kit/position.ts:20`),
`fyp-tour` (`src/features/lessons/kit/tour-gate.ts:29`) and the warm-up's fold, `fyp-l22-warmup`;
nothing from the toys or the holds. No frame, reading or answer from Sing it is kept or sent: a
take is held in memory until it is read and then dropped (FACTS 61). The sliders, Drift and Stretch
hold for the visit, in memory, and so do both predicts' choices: a return visit starts fresh.

Page QA before publishing adds, for this page, every check against a local or dev build, never
production:

- Every play, slider, switch and button works by keyboard alone and announces what LESSON.md shows.
- The cold open's note and its two answering plays sound and draw as FACTS 39 and 41 say, the line
  past both edges swing after swing, 16 of its 18 swings.
- No source on the page sounds a straight note on A before the cold open's choice, or a wave slower
  than five swings a second before Step 3's.
- A held note with an even vibrato reads in full, one that comes late too, and a drifting one
  leaves the band, by ear, with the coach; for the same steady vibrato the vibrato line's rate is
  close to Voice Mirror's, and both extents read below the sung one (FACTS 46).
- On a real phone at 390 px, the band chart, the two panels of Step 4 and the holds' lines fit their
  cards, and D3 is heard through the speaker.
