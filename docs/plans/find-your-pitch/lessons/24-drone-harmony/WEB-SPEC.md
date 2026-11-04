# Lesson 24 web page: spec

The Lesson 24 page is the web lesson for "Harmony against a drone", Season 2's fifth voice lesson
and the second of Arc D, Harmonise it: a cold open in which a top note slides down into a drone and
its throb slows and stops, a recall from Lessons 10 and 23, written steps on one main toy, Lesson
5's band chart with a drone held under it, in four step states with free play, a second predict in
Step 2, a scored checkpoint of three holds over a drone, with headphones, read on the middle of the
learner's line, an unscored sing-along without them, two quizzes and the lesson explorer. Copy is in
[LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a text-only package: no film
exists for Lesson 24, so the page has no Watch section and the masthead's anchors are Lesson, Sing
and Explorer. It is built on the kit (`src/features/lessons/kit/`) as it stands on main at
`c60f0fdcb`, and like every lesson page it reuses and never copies: a part that lives in an earlier
lesson's module moves into the kit first.

It stands on Season 2's kit work, none of it built yet: the seasons in the kit (SEASON-2 § 6.2 item
1), and four pieces Lesson 22's spec proposes and this page shares: Merc's voice with its vibrato
as a parameter, null for a straight note (`docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:684`);
the band chart's new states, of which this page takes the no live band state and the violet middle
line (`docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:698-716`); the centre-line reader
(`docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:717`); and Lesson 5's hold flow moved
into the kit with options (`docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:732`). This
spec adds the drone chart's states, a drone that sounds under a take, the headphones check
and the quiet check, and two lab tests. As the lead answered on 2 November 2026, the scored holds
ship only after the lab test in which silence over a speaker drone reads as no voice, never as a
unison in tune, and no beat rate goes on screen before the timbre test; until the first passes, and
wherever the learner has no headphones, Sing it is the unscored sing-along (FACTS 51, 52, 72).

One object carries the lesson: Lesson 5's band chart with a drone under it, the drone chart. In the
cold open a thin line sinks into the drone's band and its throb slows to still; in Step 1 a dragged
note beats against the drone, then against its octave; in Step 2 do, mi and so stand over it as
beads, tuned the piano's way or pure; in Step 3 Lesson 5's band sits on mi, with the piano's tick
and the pure one inside it; in Step 4 a wave smears the fifth's slow throb; in Sing it the learner's
own line holds each note over the drone. The card's signature is that path, with the second
singer's line left to Lesson 26 (FACTS 4, 38).

Its public home is `mercurypitch.com/learn/24`: a hand-written document `learn/24.html` with its
module in `src/features/lessons/lesson-24/`. It is a voice lesson, so it is a draft until the vocal
coach signs off its voice lines and its checkpoint (LESSON.md, For the vocal coach), in the draft
list's form (`src/features/lessons/kit/drafts.ts:31-42`). The season puts Lessons 24, 26 and 28
last, for their engineering and the headphones work, with one coach batch for all three (SEASON-2 §
8.2 item 7, `docs/plans/find-your-pitch/SEASON-2.md:1272-1273`); Lesson 26 reuses this page's drone,
headphones check, quiet check and band.

## Look

Season 1's look, unchanged: the dark listening room, the series colour code, Lesson 1's type and
wordmark, and the motion rules. The drone chart takes the app's canvas set, as on Lesson 5's page:
target amber `#f59e0b`, singer violet `#a78bfa` for the learner's line alone, and in-tune mint
`#80ffca` for the band's lit edge, always beside the words "in the band" (MASTER-PLAN § 5). On this
page:

- **Amber is the note being tuned to.** In the hero and Steps 1 and 2 the drone itself is the amber
  band, 15 cents either side of A3, labelled "drone · A3": a drawing of one held note, with no
  tolerance and no edges named, narrow enough that the top note at 224 Hz, 31 cents up, lies just
  above it, as Lesson 23's still draws it (FACTS 26, 40). In Step 3, and in Sing it, the amber band
  is Lesson 5's, 35 cents either side of the note to sing, and the drone is a chrome line labelled
  "drone", or a chrome marker pinned to the chart's foot with an arrow where it lies below the
  window, as the band chart pins any note beyond it (`src/features/lessons/kit/band-chart.ts:1-12`).
  Step 4, which is about listening, draws no band: Lesson 22's wave swings 50 cents either side,
  past both edges of a 35-cent band, so the top note's chrome line crosses a solid tick labelled
  "piano", with the drone pinned below. In Sing it Merc's sung model note is the amber band
  (MASTER-PLAN § 5). The drone turns from the amber band to a chrome line between Steps 2 and 3, and
  back on the way back, so the figure's spoken summary says so whenever the colours change (Toys
  2).
- **The top note is chrome**, thin, at its true pitch: a played tone, any other note in the series
  code, never Merc's sung note (FACTS 42). Step 4's wave is drawn on it from the same schedule the
  sound plays.
- **A beat is drawn as brightness, never as a new colour.** The band and the line brighten and dim
  together with the envelope of the two harmonics that nearly meet, which swells and fades at the
  gap between them, each pair's swing weighted by its weaker harmonic's level, so a chord's pairs
  add up and the pure chord holds still; under Step 4's wave the same envelope, computed from the
  wave's schedule, gives the weaker throb and its flutter (FACTS 38). The swing stays under 0.1 in
  relative luminance at every rate, so nothing on the page counts as a flash (WCAG 2.3.1), and above
  three beats a second it is a fine shimmer at the edges, its rate carried by the readout's words
  where the figure has one. Before the cold open's choice no word or number names a throb (FACTS
  1a).
- **Ticks**: the piano's note is a solid chrome tick labelled "piano", the pure one a dashed ink
  `#e6edf3` tick labelled "pure". Lesson 10's beads are chrome, the sounding one ink and lit, with
  no gold: no gold appears on any pitch canvas (FACTS 29).
- **Orange `#ff7448`** is Tavi's and **blue `#58a6ff`** Merc's, in their bubbles and their stills.
- **No decorative staff or clef anywhere**: in Season 2 a staff on screen is always music, and this
  page draws none (SEASON-2 § 1.5 item 7).

Five things move: the Merc idle loops; a line drawing as its play sounds; the brightness at the
beat rate; the top note sinking into the band during the slide; and the ring in Sing it. Only Merc
and Tavi move on their own. Under `prefers-reduced-motion` Merc and Tavi hold a still frame, a
play's line lands whole as it starts, and the brightness holds still, the readout and the figure's
spoken summary saying whether the pair is beating and how fast (`src/features/lessons/kit/band-chart.ts:33-35`);
what the viewer starts still sounds. For everyone else the masthead's Pause animations toggle stops
the same things.

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap as far as both predicts allow; the mix-up card sits in Step 4,
whose question it answers; the practice card sits in the Wrap. No Watch section. The page opens in
Lesson 2's order (FACTS 5a). Each section's heading, and the line above it, are in LESSON.md
("Section headings").

1. **Masthead**: Season 1's, with the kit's seasons: "Season 2 · Lesson 24", anchors Lesson, Sing
   and Explorer, the Sound toggle off by default and Pause animations, through `initMasthead`
   (`src/features/lessons/kit/page-chrome.ts:127`) with `{ lesson: 24, deck }`. On a first visit its
   welcome tour waits for the cold open's choice (Toys 1).
2. **Hero, with the cold open**, laid out as Lesson 2's: the kicker, the hook as the title
   (`<h1 class="hook" id="hook">`), the meta as seven chips, the promise and the sound gate from
   LESSON.md. The chips are "16 minutes" (FACTS 3); "After Lesson 5: Breath and a steady note",
   "After Lesson 10: Major and minor" and "After Lesson 23: Perfect, major, minor and the tritone",
   each a link to that page that stays a plain chip wherever it is not live (FACTS 2); "Sound on";
   "Microphone optional"; and "Headphones optional". The stage holds Tavi's and Merc's bubbles over
   Merc and Tavi, the drone chart's hero state between them, and under it the cold open's two plays,
   the slide locked until a choice; the predict card sits under the stage (Toys 1). The head:
   - the title, at most 60 characters: "How to sing in tune with a drone | MercuryPitch" (47), the
     lead's answer, query-led as SEARCH.md § 13 item 1 decided
     (`docs/plans/find-your-pitch/SEARCH.md:454-456`);
   - the description, 136 characters: "Hold a note against a drone: how can you hear when the two are
     in tune? A sixteen-minute lesson with sound toys and three notes to hold.";
   - the head test holds the description to 80 to 160 characters
     (`src/tests/lesson-pages.test.ts:156-159`) and to the chip's run time in words (`:191-210`);
   - og:title and twitter:title "Harmony against a drone · Find Your Pitch, Lesson 24" (52);
     og:description and twitter:description the hook alone (71);
   - the share card `learn/lesson-24-og.jpg`, 1200 by 630, drawing the hero's still, the drone band
     on A3 and a thin chrome line just above it, between Merc and Tavi, with no glow; its alt "The
     title card: Find Your Pitch, Lesson 24, Harmony against a drone, above a wide drone band on A3
     with a thin line just above it, between Merc and Tavi." (153);
   - the Article's structured data: headline "Harmony against a drone", `alternativeHeadline` the
     hook, the description, `timeRequired` `PT16M`, position 24, and `teaches` "Beats: the throb two
     close notes make", "Hearing in tune against a drone", "Why the piano's fifth and major third
     beat above a drone, and pure intervals do not" and "Holding a harmony note by listening to the
     other part"; and on release a line in llms.txt in its own form (`public/llms.txt:78`), as
     Lesson 23's spec gives its own: "- [Lesson 24: Harmony against a drone](https://mercurypitch.com/learn/24):
     How to hear when a held note is in tune against a drone. How two close notes beat, why above a
     drone the piano's fifth beats slowly and its major third fast while pure intervals ring still,
     and how to hold do, so and mi over a drone by listening."

   Nothing a learner can meet before the choice, the title, the descriptions, the share card and
   its alt, names a beat, a slowing or a stopping, or which interval beats faster (FACTS 1a). The
   structured data and the llms.txt line, which no learner meets on the page, name the answers.
   Lengths: `verify24.py`, section 10.

3. **Recall from Lessons 10 and 23**, straight after the hero, shown to everyone (Toys 5; FACTS 7).
4. **Four words you'll meet**: Drone, Harmonic, Pure and Equal-tempered, each with its figure and
   play, Pure's play locked until the cold open's choice (Toys 4).
5. **Steps**: the step deck, four steps, the drone chart stuck beside the text (Toys 2), with Step
   2's predict and Step 4's mix-up card in their text, and Steps 1 and 3's words held for the
   predicts' reveals (Toys 1, 3).
6. **Sing it**: the comfort check, the voice choice and Move do, the headphones check, the "What
   this does" box, Start, the quiet check, the briefing, the three holds, their readings and "How
   did that feel?", the ten-second holds; or the sing-along (Toys 6).
7. **Quick check**: four questions, question 4's play waiting for the cold open's choice (Toys 5).
8. **Wrap**: the three lines, the one-sentence challenge, the practice card in the version Sing it's
   ending picks (Practice links), the next-lesson card with Lesson 25's still (Toys 7), and free
   play, the steps' toy in every state, holding back what would answer a predict until its choice
   (Toys 2).
9. **Explorer**: the season's map with a tab per season, opening on Season 2's.
10. **Footer**: LESSON.md's, with the practice links, the fonts line and "Every sound on this page
    is synthesised in your browser."

## Length

The learner copy is 2,137 words on `node scripts/lesson-words.mjs`, every branch counted (FACTS 3),
under the series' cap of 2,379. Each step's own text, with its predict, its reveal, its Try, its
Notice and any Tavi line, runs 104, 120, 95 and 82 words, inside 50 to 120 a step. The page runs
about 16 minutes: 8.98 of reading at 238 words a minute and about 7.1 of sound, toys and tasks,
with six quiz questions, 16.06 in all, as the plan expected. The chip is an estimate until the
drone chart's states and the holds are timed in their lab (SEASON-2 § 1.3), and this section says
so until then. Five parts carry more, for these reasons:

- **Step 4, 183 words.** Its own text is 82; the rest is its heading and the mix-up card, which
  sits in the step whose question it answers.
- **Sing it, 575 words.** It holds the series' singing lines, Lesson 3's and Lesson 5's word for
  word, which are not cut; the headphones check and the quiet check, which the scored path needs;
  Move do; the holds' cues; the "What this does" box; the reading's example lines; the feelings'
  lines; and the sing-along (FACTS 49 to 59).
- **The quick check, 256 words.** Four questions with three answers each and a line of feedback for
  every answer, as MASTER-PLAN § 4.2 item 8 asks.
- **The recall, 118 words.** Lessons 10 and 23's questions, word for word.
- **The Wrap, 284 words.** The practice card says what its link opens and what it scores, with the
  headphones line, its care lines, its rest version and Beat Hunt (FACTS 60 to 63), and the next
  lesson.

The hints and status lines are stage directions in LESSON.md and are not counted, as in every text
package: the two predicts' hints and their "You said" lines, the stored voice's line, Sing it's
status lines, and the toys' labels and readouts. A built page writes them in the open: about 150
words by Lesson 8's reckoning (Lesson 8 FACTS 4), and 89 more for this page's nine lock, held and
status lines: the steps' figure's lock line, "Choose an answer at the top to unlock this figure."
(10); its line in Steps 3 and 4 before Step 2's choice, "Answer Step 2's question first to use
this figure." (9); Step 1's held line, "Hear the slide at the top to unlock this step." (10);
Step 3's, "Hear Step 2's two intervals to unlock this step." (9); Step 2's first hint, "Choose an
answer at the top first." (7); the Pure word's lock line and quick check 4's, each "Choose an
answer at the top to hear this." (9 and 9); "Just listen today"'s, "Answer Step 2's question first
to hear this." (8); and the quiet check's line when it hears a note, "The microphone heard a note
during the drone. Check your headphones, then press Start again and stay quiet." (18). So the
built page runs about 2,376 words, 3 under the cap (`verify24.py`, section 12).

The first draft counted 2,227 words and a built page of about 2,442, and named the cuts a build
would make; the lead asked for them now, and they are made, every fact they carried staying in
FACTS:

1. Step 2's Go deeper drawer, "The formula" (52 words; FACTS 27): the step's text already names
   the two harmonics and their gap.
2. The practice card's sentence on Drone Intonation's drone, "Its drone is a plain tone by default,
   without the harmonics Step 2's beats come from." (16 words), whose place takes "Headphones help
   here too: its drone plays while it listens." (10; FACTS 51, 60).
3. The sound gate's last clause, ", and headphones keep the drone out of it" (8 words; FACTS 6),
   which Sing it's headphones check says where it matters.
4. Shorter wording that keeps every claim: the practice card's lead-in, now a stage direction, and
   its "this lesson's so and do aren't in it", since "the two thirds only" says what the link holds;
   Step 1's octave sentence and its Try; the mix-up card's "Why it seems right"; Step 3's band
   sentence and its quintet; Step 4's text and Notice; the Wrap's first line; six uses of "so"
   meaning "therefore", on a page that sings so, the card's range line, Lesson 10's, keeping its
   own (FACTS 51); and the sing-along's condition, now a stage direction.

The fix pass added words too: the held lines, the longer quiet-check line, the headphones' volume,
Move do, Pure's ratio of small whole numbers, the beats "between you", and Step 4's new Notice. A
build counts its own page; if that count runs over the cap, the next cut is Step 3's quintet
sentence (16 words; FACTS 31), which the step's band sentence does not need.

The activities are timed from FACTS 67 to 70. Free play is not counted.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                                             | New in Lesson 24                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Hero and predict       | The kit's predict (`kit/predict.ts`) with a free play, `onChoice` and two reveal elements; the band chart (`kit/band-chart.ts`); the tour's hold (`kit/tour-gate.ts`)                                                                                              | The drone chart's hero state: the drone as a narrow amber band, the top note as a chrome line, the brightness at the beat rate; the slide drawn from its schedule; Step 1's words held as the second reveal element                       |
| 2. The drone chart, steps | Lesson 5's band chart (`kit/band-chart.ts`); Lesson 10's beads, as a style; the band chart's pinned marker for a note below its window                                                                                                                             | Four step states and free play, held back until the choices that would answer: the drag and the octave, the beads with Piano · Pure, the band on mi, the wave                                                                             |
| 3. Step 2's predict       | The kit's predict, a second on the page, with `revealAfter: 'all'`, `unlocks`, `onChoice` and several reveal elements                                                                                                                                              | A first hint until the cold open's choice, then mounted; its choice unlocks the beads' taps, Piano · Pure and Play all three, and tells Steps 3 and 4's states, free play and the listening path; Step 3's words held as a reveal element |
| 4. Four words             | Lesson 5's word tickets (`lesson-05/words.ts`), with the page's sound owner                                                                                                                                                                                        | Four small figures that draw their plays; Pure's play locked until the cold open's choice                                                                                                                                                 |
| 5. Recall and quick check | The kit's quiz (`kit/quiz.ts`), its prefix, keys and away links; Lesson 10's question object; Lesson 23's, once built                                                                                                                                              | Ids `l24-q1` to `l24-q4`; quick check 4's play, by ear only, held until the cold open's choice                                                                                                                                            |
| 6. Sing it                | Lesson 5's hold flow, moved into the kit; the comfort check, voice choice and feelings (`kit/comfort.ts`, `kit/voice-choice.ts`); Move do (`kit/move-do.ts`); the listener (`kit/listen.ts`); the hold reader (`kit/hold-take.ts`); Lesson 22's centre-line reader | The headphones check; the quiet check; a drone under a take; three five-second holds, then two of ten, as sets; Move do higher, the drone with it; the sing-along                                                                         |
| 7. Tease still            | The kit's next-lesson card and its slot (`kit/next-card.ts`)                                                                                                                                                                                                       | Lesson 25's opening as a still, as Lesson 25's package draws it, which plays nothing                                                                                                                                                      |

### 1. The hero and the cold open's predict

The hero's figure is the drone chart in its hero state: over a fixed window 10 seconds across, a
pitch axis from 20 cents under A3 to 45 over it, with no cents ticks and no numbers; the drone's
amber band, 15 cents either side of A3, labelled "drone · A3"; and from the first paint the top
note's line as a still, thin and chrome, across the window at 224 Hz, 31.2 cents up, just above the
band, unnamed, as Lesson 23's still draws it (FACTS 5, 40). Nothing glows at first paint. It takes
no taps.

- **Play the drone and the top note** (`pair`, with `data-free`): the drone, A3 at 220 Hz, and the
  top note at 224 Hz together, 3.0 s, both with harmonics and no vibrato, started on one audio time
  (Audio). As they sound, the band and the line brighten and dim together four times a second,
  under the luminance cap (Look). Merc and Tavi listen. It works before a choice and never reveals
  (FACTS 41).
- **Play the slide** (`slide`), locked until a choice: the drone with the top note at 224 Hz for 1.5
  s, gliding to 220 Hz over 6 s on an exponential curve, then 220 Hz for 2.5 s, 10.0 s in all, the
  two voices started on one audio time, so the top note ends 13° from in phase with the drone and
  the still pair sounds whole (FACTS 44). The line redraws across the window as it sounds, from 31.2
  cents down to the band's middle, a straight slope on the cents axis, and the brightness follows
  the difference: four times a second, then three, two, one, then still (FACTS 44).
- The kit's predict, as it is: two `.choice` buttons, "It slows, then stops" (`stops`) and "It
  speeds up" (`faster`). `revealOn: ['slide']`, the default `revealAfter`, so the reveal waits until
  the slide has been heard to its end with sound on (`src/features/lessons/kit/predict.ts:53-59`).
  The hints are LESSON.md's: `chosen` "Locked in. Play the slide.", `silent` "Sound is off: nothing
  played. Turn sound on, then play it again." and `again` "Play either of them again.", with no
  `next`, so the locked-in hint stays until the reveal. The markup's lock hint is "Choose an answer
  to unlock the slide."; `guess` gives "You said: it slows, then stops" or "You said: it speeds up".
- `onChoice` tells the steps' toy, free play, the Pure word's play, quick check 4's play and Step 2's
  predict that the cold open's choice is in, so each enables what it held back for it (Toys 2 to
  5), and settles the tour's hold. The predict's `unlocks` is not used here: the steps' controls
  belong to their own toy, which `onChoice` tells.
- `reveal`, two elements: the hero's `.reveal` first, since the kit writes the "You said" line into
  the first, then Step 1's text with its two plays, its Try and its Notice, which say the answer
  (the closer the notes, the slower the beats; in tune, it's still). The kit shows them together
  and announces them in that order (`showReveal`, `src/features/lessons/kit/predict.ts:133-148`;
  "one or several elements", `src/features/lessons/kit/predict.ts:70-71`), as Lesson 25's predict
  reveals its Step 1 paragraph. Until then Step 1's place shows the held line "Hear the slide at
  the top to unlock this step." `onReveal` hides that line and gives Tavi's quiet "oh", with no
  sparkles, since the reveal calls no choice right (FACTS 1a, 46).
- What a play does to the hint is the kit's: a free play heard before a choice puts the lock hint
  back, and after the choice leaves the locked-in hint; a play sound off kept silent shows
  `silent`; a play cut short, by another sound or by leaving the hero, counts as not heard and
  changes nothing (`src/features/lessons/kit/predict.ts:158-174`).
- The figure's accessible name is "A drone band on A3, with a second note just above it". A polite
  live region says what each play drew: the two notes sounding together, throbbing; after the
  slide, the top note sinking into the drone's band and the throbbing slowing until it stops. Before
  the choice nothing it says names a beat, a rate or a stop.

On a first visit the welcome tour waits for the choice. Its step "One step at a time"
(`src/features/lessons/kit/tour-copy.ts:44-46`) scrolls to the steps' stage, which would carry a
learner past the predict, so the page holds the tour until a choice is made, through the kit's
`holdTour` (`src/features/lessons/kit/tour-gate.ts:57-69`), with no time limit, as Lessons 15, 16,
21, 22 and 23 hold theirs. A visit that never chooses is offered the tour again on the next lesson
page it opens at the top; the lesson menu's "Tour this page" still runs it at once (FACTS 47).

**Before the choice nothing on the page plays its answer.** Every control of the steps' drone chart
is disabled and announced as unavailable, under the line "Choose an answer at the top to unlock
this figure.", and the chart draws only the drone's band, until the cold open's choice: Step 1's
drag would slide a note into the drone, and every later state sets a note against it. The Wrap's
free play holds the same states back under the same line (Toys 2). Step 2's choices are disabled
until then too (Toys 3); the Pure word's play and quick check 4's play are disabled under their own
lines (Toys 4, 5). The other three words' plays stay open: none sets two close notes together (FACTS
71). Sing it plays nothing before Start, and its notes are never two close notes (Toys 6). Step 1's
text, which says the answer, waits under its held line until the reveal, not only the choice.

### 2. The drone chart in the steps

Lesson 5's band chart on the step deck's stage, a pitch axis in cents and a fixed window of time,
with the drone held under it. Every line is computed from its play's schedule, the frequencies the
sound plays, and every brightness from the same frequencies (Look), so the drawing and the sound
share one clock; nothing is analysed from the audio. The figure is an image with a spoken summary
of what it last drew, and every control is at least 44 px. Four states and free play, with the
window of each:

1. **Step 1, close notes.** The window runs 40 cents either side of A3. The drone's amber band at
   A3, 15 cents either side, and the top note's chrome line, dragged between 216 and 224 Hz (31.8
   cents under to 31.2 over), with the arrow keys moving it 0.5 Hz and Page Up and Page Down 2 Hz. A
   drag plays the drone and the top note, following the drag, for up to 6 s, and rings on at the
   pitch it was left on for 4 s after release, then stops, so a beat every 2 s at the spot just
   found is heard twice; the preset plays cover the gap meanwhile. Within 0.1 Hz of 220 the note
   snaps to it, and the snap restarts the top note in phase with the drone: the dragged voice
   releases over 0.05 s while a new one at 220 Hz starts on a whole period of the drone's, counted
   from the drone's own start, with the same partial phases, so every partial of the two lines up
   and the still unison sounds whole every time. A snap left at whatever phase the drag reached
   could land near 180°, where the fundamental and every odd harmonic cancel and the pair loses
   5.6 dB and sounds an octave up; a top note kept a few dB under the drone would still lose 10 to
   15 dB of its fundamental there, so the page restarts in phase rather than lowering the top note
   (FACTS 44, 69). **Octave** moves the window up an octave: the band then marks the drone's second
   harmonic, labelled "drone × 2 · 440 Hz", the note drags between 432 and 448 Hz, and it snaps,
   in phase in the same way, within 0.2 Hz of 440. The readout under the chart says the rate in Beat
   Hunt's words, "2 beats a second", "a beat every 2 s", and "still" at none (FACTS 28). Its plays:
   "Play 222 against 220" and "Play the octave", 441 Hz against the drone, 3.0 s each, and the
   toy's 221, 3.0 s, 220.5, 4.0 s, and 220, 3.0 s, from its preset buttons, each pair started on
   one audio time (FACTS 69).
2. **Step 2, the beads.** The window runs from 50 cents under A3 to 60 over E4. The drone's band at
   A3; three beads at the chart's left edge, do at A3, mi at C♯4 and so at E4, Lesson 10's major
   triad on A, chrome, the sounding one ink and lit; a dashed ink tick labelled "pure" at 275 and at
   330 Hz. **Piano · Pure** (default Piano) moves mi between 277.18 and 275.00 Hz and so between
   329.63 and 330.00. A tap on so or mi plays it over the drone, 3.0 s, its chrome line drawn at its
   pitch and the brightness at its rate; the readout says the rate. **Play all three** plays the
   drone, which is do, with mi and so, 4.0 s, in the switch's tuning: the piano's chord shimmers
   with a slow swell under it, the pure chord holds still, and the readout says "beating" or
   "still". The predict's two plays sound here too (Toys 3). Until Step 2's choice the taps, the
   switch and Play all three are disabled under the predict's hint.
3. **Step 3, the band on mi.** The window runs from 40 cents under A3 to 60 over C♯4. Lesson 5's
   amber band on mi, C♯4, 35 cents either side, at least 43 px tall on a phone (FACTS 78); a solid
   chrome tick at its centre labelled "piano" and a dashed ink tick 13.69 cents under it labelled
   "pure"; the drone as a chrome line at A3, labelled "drone". Mi's line drags between the band's
   edges, sounding over the drone as it moves, with the readout. "Play the piano's mi" and "Play
   pure mi", 3.0 s each, draw mi's line at the tick (FACTS 25, 26). The piano's mi over the drone
   answers Step 2's predict, so the drag and both plays wait for Step 2's choice, under the stage's
   hint "Answer Step 2's question first to use this figure." (FACTS 46).
4. **Step 4, the wave.** The window runs 80 cents either side of E4, with no band: a solid chrome
   tick at E4 labelled "piano", the top note's chrome line, and the drone as a chrome marker pinned
   to the chart's foot with an arrow, labelled "drone · A3". "Play with a wave" draws the top note's
   line with a singer's wide wave, Lesson 22's cold-open wave, six swings a second at 50 cents
   either side, grown in over 0.3 s, through Lesson 22's vibrato option (Audio), and "Play
   straight" a level line, 4.0 s each. The brightness follows the envelope of E4's second harmonic
   and the drone's third, computed from the play's schedule: an even swell under one a second when
   straight; with the wave, a swell about a third as deep under a flutter at the wave's rate and
   twice it (FACTS 38). The piano's fifth over the drone answers half of Step 2's predict, so both
   plays wait for Step 2's choice, under the same hint as state 3.
5. **Free play**, in the Wrap: the four states under a state switch, every control and play as in
   its step, holding back the same states until the same choices: state 1 until the cold open's
   choice, states 2, 3 and 4 until Step 2's.

The steps' plays wait for the cold open's choice, as the stage's lock line says (Toys 1), and those
of states 2 to 4 for Step 2's too. Leaving a step stops its sound. A state change keeps the drone
where it is when it stays in the window, but not its colour throughout: in Steps 1 and 2 the drone
is the amber band; in Step 3 the amber band moves to mi and the drone becomes a chrome line; in
Step 4 there is no band and the drone is pinned below (Look). Each change of colour adds a line to
the figure's spoken summary: "The amber band is now mi's; the drone is the chrome line below.",
"No band now: the top note is the chrome line, the drone pinned below." and, going back to Step 1
or 2, "The amber band is the drone again." (FACTS 40).

### 3. Step 2's predict

- Until the cold open's choice, Step 2's two choices and its two plays are disabled and its hint
  reads "Choose an answer at the top first."; nothing else of the step shows but its heading and its
  predict.
- On the cold open's choice the hint reads "Choose an answer to unlock the two intervals.", the
  choices enable and the kit's predict mounts: `.choice` buttons "The fifth" (`fifth`) and "The
  major third" (`third`); plays **Play the fifth** (`fifth`) and **Play the major third** (`third`),
  each the drone with the piano's E4 or C♯4, 4.0 s, drawn on the drone chart's Step 2 state;
  `revealOn: ['fifth', 'third']` with `revealAfter: 'all'`; `chosen` "Locked in. Play both
  intervals.", `silent` the kit's sound-off line, `again` "Play either of them again.", no `next`;
  `guess` "You said: the fifth" or "You said: the major third".
- `unlocks`, the controls the choice enables together: the beads' taps, Piano · Pure and Play all
  three (`src/features/lessons/kit/predict.ts:64-67`). `onChoice` then tells everything else the
  choice unlocks: Steps 3 and 4's state of the figure, their two plays each and Step 3's drag, and
  the figure's hint for them; free play's states 2, 3 and 4; and "Just listen today"'s play, Play
  the drone and Merc's notes, which loses its lock line (Toys 6). Nothing else on the page waits for
  this choice (FACTS 46).
- `reveal`, several elements, in this order: the step's `.reveal`, first, since the kit writes the
  "You said" line into it; the step's text, Try and Notice; then Step 3's Tavi line, its text with
  its two plays, its Try and its Notice, which give the pure third's 14 cents against the fifth's 2
  and say only the pure mi is still, and so lean on the answer. Until the reveal the step shows only
  its predict, and Step 3's place shows the held line "Hear Step 2's two intervals to unlock this
  step."; `onReveal` hides that line. The kit shows the elements together and announces them in
  order (`showReveal`, `src/features/lessons/kit/predict.ts:133-148`), so nothing in either step's
  words answers the predict first (FACTS 1a, 46, 48).

### 4. Four words

Lesson 5's word tickets with the page's sound owner, each with a small figure that draws its play
as it sounds (FACTS 68):

- **Drone**: a small drone chart, the band at A3 drawing across as A3 sounds, 3.0 s.
- **Harmonic**: six rungs, A3's harmonics from 220 to 1,320 Hz, spaced by frequency, each lighting
  as it sounds, 0.9 s each, 5.4 s.
- **Pure**: the drone's band at A3 and a chrome line at 330 Hz, both still, as the pure fifth
  sounds, 3.0 s. Its play is disabled until the cold open's choice, under the line "Choose an answer
  at the top to hear this." (FACTS 46).
- **Equal-tempered**: thirteen rungs evenly spaced, A3 up to A4, each lighting as it sounds, 0.3 s
  each and the last 0.6 s, 4.2 s.

### 5. Recall and quick check

The kit's quiz (`kit/quiz.ts`), with "Right." or "Not quite." before each feedback line and three
answers in a shuffled order. The recall asks Lesson 10's question object `l10-q1`
(`src/features/lessons/lesson-10/quiz-questions.ts:41-61`) and Lesson 23's question 3, once Lesson
23's questions are a module (What the kit and the app still need), imported and never copied; their
step links read "Try Lesson 10, Step 1 again" and "Try Lesson 23, Step 1 again" through `linkAway`
(`src/features/lessons/kit/quiz.ts:191-205`), plain words where that page is not live (FACTS 7). The
quick check's questions are `l24-q1` to `l24-q4`, in a module of their own, so Lesson 26's recall
can import `l24-q1` word for word (FACTS 74). Quick check 4's Play, by ear only, plays A3 with E4
at 330 Hz, 4.0 s; it is disabled until the cold open's choice under the line "Choose an answer at
the top to hear this.", the Pure word's line, while the question's answers stay open (FACTS 46,
77). The page keeps `fyp-l24-recall-seed`, `fyp-l24-recall-v1`, `fyp-l24-seed` and
`fyp-l24-quiz-v1`.

### 6. Sing it: three holds over a drone

Lesson 5's Sing it, moved into the kit with options (Lesson 22's item 7,
`docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:732`), with a set of three five-second
holds over a drone, then a set of two of ten, read by Lesson 22's centre-line reader (The reader,
below). Every state has a visible status line that is also announced (`aria-live="polite"`). Each
set allows up to three takes in a visit, as each of Lesson 5's holds does (`TAKES_PER_HOLD`,
`src/features/lessons/kit/hold-flow.ts:37-38`); the set's rules follow the states.

States:

1. **Comfort check**, always first and asked every visit, never stored: Lesson 3's line, its list of
   six conditions and its two buttons (FACTS 49), through the kit's `mountComfort`
   (`src/features/lessons/kit/comfort.ts:159`).
2. **Voice choice and Move do.** The voice choice comes after either comfort answer when none is
   stored, and before anything in Sing it plays, since it picks the singer and the drone's octave:
   Lesson 3's two buttons with Merc's and Tavi's stills (`aria-pressed`, at least 44 px), under
   LESSON.md's line in its two forms (FACTS 50). It reads and writes `fyp-voice`
   (`src/features/lessons/kit/voice-choice.ts:20`). The lower voice sings over D3, the higher over
   D4, or up to G3 and G4 with Move do (FACTS 56, 57); the page's examples stay on A3 (FACTS 8).
   Under it, after "I'm comfortable: let's
   sing" only, LESSON.md's line, "If do feels low, move it higher.", and Lesson 4's control as
   Lesson 20's page has it: a group labelled "Move do:" with "lower" and "higher", with the reach
   `{ lower: 0, higher: 5 }` for both voices (`MoveReach`, `src/features/lessons/kit/move-do.ts:29-36`;
   `clampMove`, `src/features/lessons/kit/move-do.ts:39-42`). "lower" rests at D, `aria-disabled`,
   never `disabled`, and after any press of "higher" it is the way back
   (`src/features/lessons/kit/move-do.ts:8-12`). Do starts on D every visit, and a move holds for
   the visit, in memory. Do moves with the drone, Merc's model notes, the band, the quiet check's
   drone and the sing-along together, and every label and spoken summary that names a note follows
   it; it can change before Start, between sets and before the sing-along, never during a set. Up
   to five semitones every preset of each voice stays at least two inside (FACTS 57).
3. **Just listen today**: LESSON.md's line with the doctor lines, and **Play the drone and Merc's
   notes**, in the chosen voice, on D, again on each tap: do, so and mi, each sung alone for 2.0 s,
   then held straight with the drone for 5.0 s, Merc's usual wave off, as in the holds. Merc's so
   and mi over the drone are the piano's fifth and third, so the play is disabled until Step 2's
   choice, under the line "Answer Step 2's question first to hear this." (FACTS 46). Nothing
   listens; the headphones check, Move do, Start and the sing-along do not show, and nothing asks
   the viewer to sing (REQ-GVC-021, REQ-GVC-055). The Wrap shows the rest card (FACTS 49, 63).
4. **Headphones check**: "Put on headphones to keep the drone out of the microphone, with the volume
   low enough to hear yourself." with **I have headphones on** and **No headphones**. No headphones
   opens the sing-along (state 12) and asks for no microphone. The answer holds for the visit, in
   memory, never stored (FACTS 51).
5. **Briefing**: the "What this does" box (REQ-GVC-002, REQ-GVC-003, REQ-GVC-012, REQ-GVC-026; FACTS 58) and **Start**, the only control that asks for the microphone, through the kit's listener under
   the page's consumer id, `lesson-24`. With sound off, Start asks for nothing and plays nothing, with
   the hint "Sound is off, so nothing played. Turn sound on to hear the drone, then press Start.",
   as Lessons 16 and 22's Start does. A refused microphone opens the sing-along.
6. **The quiet check**, after the microphone opens and before every set, Again's included:
   LESSON.md's line, and the drone on do, where Move do left it, for 2.0 s at the holds' level, with
   nothing else playing, while the listener reads the frames (What the kit and the app still need,
   item 6). It fails on any voiced run of 0.3 s or more at any pitch, since it cannot tell the drone
   from a voice, a hum or a television, and passes otherwise. If it fails, the microphone is
   released, the line reads "The microphone heard a note during the drone. Check your headphones,
   then press Start again and stay quiet.", which says what it heard and what to do and names no
   cause it cannot know, the sing-along opens in the holds' place, and Start stays offered under
   it, so a learner who fixes the headphones can run the check again (FACTS 52).
7. **The holds of a set**: do, then so, then mi. Before each, the singing Merc, Merc for the lower
   voice and Tavi for the higher, sings the note alone on "ooh", straight, at the piano's pitch, 2.0
   s with its release, the other listening. Then Lesson 5's three phases on the ring, **Listen ·
   Breathe · Sing**. Listen: once Merc's note has ended, so the two never sound together, the drone
   comes in on do, 2.0 s, both Mercs listening. Breathe: the ring breathes once over 2 s, the drone
   still sounding; nothing counts down. Sing: the take opens 0.4 s into Breathe, as Lesson 5's opens
   during its Breathe ring, waits up to 6 s for the first voiced frame, and runs 5 s from it, or
   less if the voice stops for more than a second; the drone sounds through it, the only sound the
   take allows; the ring turns and closes over the hold; the violet line draws on a fixed 5-second
   frame, folded into the note's octave, against Lesson 5's band on the note, with the drone as a
   chrome line through the band's middle on do and a pinned marker on so and mi (Look). **No live
   band state**: during the take the band's edge does not light, the band does not glow and no line
   says where the voice is, as on Lesson 22's page (its item 5,
   `docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:710-711`), since a wave would flicker
   it (FACTS 58). The drone releases over 0.3 s as the take ends; the microphone stays open for the
   set and is released when the set ends.
8. **After each take**: the centre-line reader reads it. Where it found a vibrato, the line's middle
   draws itself as Lesson 22's dashed violet line over 0.6 s, at once under reduced motion (its item
   5, `docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:704-706`). Then one line from the
   reading and the octave line where it applies; Lesson 22's vibrato line, "The note had a wave:
   about …", does not show, since this page teaches no rate or extent (FACTS 58). The band's edge
   lights mint beside the reading while its line says the voice was in the band. A hold that heard
   no voice within 6 s ends the set (the set's rules).
9. **How did that feel?**, after a set: Lesson 3's four answers, an answer that locks, through
   `mountFeelings` (`src/features/lessons/kit/comfort.ts:175`), and what each answer allows from the
   kit's rule (`afterFeeling`, `src/features/lessons/kit/comfort.ts:56-82`), with the rest card
   after Effortful:
   - Easy or Workable, after the three five-second holds: the celebration and the tricky line as
     the set's rules give them; then "Rest for a few easy breaths. Ready when you are." with **Hold
     so and mi for 10 seconds**, **Again** (while the set has takes left) and **Done for today**.
     The rest has no timer: the singer ends it.
   - Effortful: the readings stay; no celebration, no Again and no longer holds; "Keep it gentle:
     rest before you sing again." and only **Done for today**; the Wrap shows the rest card.
   - Uncomfortable: the readings are taken away; no celebration, no Again and no more holds; "Thanks
     for saying so. That's enough singing for today: rest your voice." with the doctor lines; the
     microphone stays off; the Wrap shows the rest card (REQ-GVC-021, REQ-GVC-023, REQ-GVC-024).
   - Once "Effortful" or "Uncomfortable" has been answered, no further take and the rest card stay
     so for the visit, in memory, through the kit's `VisitEnding`
     (`src/features/lessons/kit/comfort.ts:101-114`).
10. **The ten-second holds**: the quiet check again (state 6), then so and mi, as state 7 with
    10-second takes and a 10-second frame, then "How did that feel?" with the same endings; Easy or
    Workable gives the summary, "This time the middle of your line was in the band for X of 10
    seconds on so, then Y on mi.", from that take's two holds, with **Again** (while the set has
    takes left) and **Done for today** (FACTS 55, 58).
11. **Done for today** ends the checkpoint with the status "Done for today." and leaves the practice
    card in the version the visit's ending picks.
12. **The sing-along**, for No headphones, no microphone, a refused microphone or a quiet check that
    heard a note: LESSON.md's line and **Start the sing-along**, on do where Move do left it. For do,
    then so, then mi: the note sung alone, 2.0 s, then 1.0 s of quiet, then the drone for 5.0 s
    while the ring closes over it; nothing listens and no line is drawn. Then "How did that feel?"
    with the same endings; Easy or Workable adds "A unison, a fifth and a major third, each over the
    drone." with **Sing along again** and **Done for today**. Sing along again is offered once a
    visit, the cap Season 1's sing-alongs put on their Again ("the guide once more, once a visit",
    `docs/plans/find-your-pitch/lessons/08-beat-tempo-backbeat/WEB-SPEC.md:633`; the kit's
    `AfterFeeling`, "still offered only once a visit", `src/features/lessons/kit/comfort.ts:41`), so
    a visit holds at most two sing-alongs (FACTS 59).

**The set's rules** (FACTS 55, 59):

- **A set** is the holds sung in one go: the three of five seconds, or the two of ten. One run of a
  set is one take, and each set allows three takes in a visit, every take counted, one with no
  voice or one cut short when the page is left or hidden too, as Season 1 counts its takes (Lesson
  7 FACTS 58).
- **Again** sings the whole set again: the quiet check, then each note after its model note.
- **A hold with no voice within 6 s** ends the set there. The readings so far stay, and the kit's
  no-start line shows (`NO_START_LINE`, `src/features/lessons/kit/hold-take.ts:48-49`). If a hold
  of the set was sung before it, "How did that feel?" follows, since Lesson 5's flow asks it
  whenever anything was sung (`afterTake`, `src/features/lessons/kit/hold-flow.ts:89-103`) and
  a singer who stops partway may have stopped for discomfort; then Easy or Workable offers **Again**,
  while the set has takes left, and **Done for today**, never the next set, and Effortful and
  Uncomfortable end as in state 9. If none was sung, **Again**, while the set has takes left, and
  **Done for today**, with no feeling question, as Lesson 5's.
- **The celebration**: the singing Merc celebrates after Easy or Workable only for a set whose every
  hold was read and was in the band for at least 80 % of its length, at most once a set (Merc and
  Tavi). **The tricky line** follows a set with any read hold under half its length in the band.
- **The summary** after the ten-second set reads that take's two holds and names a hold it could
  not read: "This time the middle of your line was in the band for 9.1 of 10 seconds on so; there was
  no reading on mi.", or the same with the notes swapped; with neither read, no summary shows.

**The reader** is Lesson 22's centre-line reader as its spec gives it
(`docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:486-522`), unchanged, on a 5-second
or a 10-second hold: this page restates none of it. Its hold reader's rules stand: 35 cents either
side of the piano's note, folded into its octave, and no reading for too little voice (FACTS 58).
A pure fifth and a pure major third both read in full (FACTS 26). Nothing reads beats. Its tests
are Lesson 22's, all on 10-second holds bar an early stop and a short trimmed span, with three
here at five seconds (Tests 10).

### 7. Tease still

The drawing in the next-lesson card's slot, the page's `[data-next-card]` mark, which the kit keeps
in the card after its words (`src/features/lessons/kit/next-card.ts:32-35`): an SVG, `aria-hidden`,
of Lesson 25's opening as Lesson 25's package draws it. It holds no button, since the card is a
link, does not move and plays no sound. Its styles go under a class of its own, not the tease line's
`.next-tease` (FACTS 5b).

## Audio

Every sound is synthesised in the page with Web Audio, through the kit's sound module, its master
bus and its house envelopes, and started only by a tap. Nothing autoplays, and the page has no
music bed (FACTS 67 to 73).

- **The sound rules**, for every source of sound on the page (the cold open's two plays, the four
  words, every play of the steps' toy and of free play, Step 2's plays, quick check 4's play, Merc's
  notes, the drone and the sing-along):
  1. One sound plays at a time, across the whole page: a new play stops the one before. A drone with
     its notes is one sound.
  2. Leaving a step, by any route, stops its sound and any queued play; scrolling Sing it off screen
     for 600 ms, or hiding the page, stops what plays there and abandons a take.
  3. A play that is cut short never counts as heard by either predict.
  4. During a take only the drone plays: every play control is disabled from Start until the set
     ends.
  5. A play that would answer a predict stays disabled until that predict's choice, wherever it sits
     on the page (Toys 1 to 5).

  The kit has the page-wide owner every source registers with (`NowPlaying`,
  `src/features/lessons/kit/now-playing.ts:39`).

- **The drone's timbre and the top note's.** Every note set against the drone, and the drone itself,
  is a straight tone with harmonics: Merc's "ooh" partials with no modulator, through Lesson 22's
  vibrato option set to null (its item 4,
  `docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:684-697`; `src/lib/demo-voice.ts:33-37`;
  `src/features/lessons/kit/sound.ts:30-52`), since the kit's soft tone carries the third's beating
  harmonics 26 to 32 dB down (FACTS 72). Which timbre makes the fifth's slow beat and the third's
  fast one audible on phone speakers and on headphones, through the master compressor
  (`src/features/lessons/kit/sound.ts:117-124`), is the lab's to choose before any beat rate goes
  on screen (What the kit and the app still need, item 7).
- **Exact frequencies.** Each tone's partials sit at exact multiples of its frequency, so every beat
  is the arithmetic of FACTS 11 to 21; nothing is detuned to make a beat louder or slower. The slide
  is one voice along a contour, gliding exponentially on the audio clock
  (`src/features/lessons/kit/sound.ts:16-21`).
- **One audio time.** The drone and every note set against it start together, on one audio time,
  each partial at phase 0 (the kit starts a voice at its own time, `build`,
  `src/features/lessons/kit/sound.ts:171-206`): two notes on one frequency add by their phase, and
  at 180° the fundamental and every odd harmonic cancel. So the slide ends 13° from in phase and
  its still pair sounds whole, and Step 1's snap restarts the top note on a whole period of the
  drone's (Toys 2; FACTS 44, 69).
- **Step 4's wave** is a singer's wide one, Lesson 22's cold-open wave, six swings a second at 50
  cents either side, grown in over 0.3 s, its phase 0 at the voice's start
  (`docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:196`), through Lesson 22's vibrato
  option on the top note only; the drone stays straight. Merc's usual wave, 5.5 swings at 14 cents
  (`src/features/lessons/kit/sound.ts:194-205`), would leave 78 % of the slow throb, so it is not
  the demonstration (FACTS 38).
- **Levels.** A note at the kit's 0.13 and Merc at 0.2 (`src/features/lessons/kit/sound.ts:187`); a
  drone pair at the note level for each tone. In Sing it the drone sits below Merc's notes, at a
  level the lab sets so the singer's own voice stays clear in the headphones (FACTS 54).
- **A drone under a take.** The kit holds every sound off while a take is open
  (`src/features/lessons/kit/sound.ts:539-547`); Sing it's drone is the one exception, started
  before the take opens and kept through it, with every other source still hushed (What the kit and
  the app still need, item 5).
- **One low note.** The page's lowest sound is D3, 146.83 Hz, the lower voice's drone and do, which a
  phone's speaker carries through the "ooh"'s harmonics. Move do only raises it, up to G3 and G4.

## Merc and Tavi

Lesson 1's setup through the kit (`src/features/lessons/kit/merc-duo.ts`): the app's renderer loaded
after first paint, one WebGL context per Merc, medium quality on phones, paused off screen, and the
stills when WebGL fails.

- They live in the hero, on either side of the drone chart. Tavi asks and Merc answers in the
  bubbles, which show from the start, over the still line. While the cold open's plays sound, both
  listen (`mercListen`, `src/features/lessons/kit/merc-duo.ts:207`): the sounds are played tones, not
  Merc's voice. Tavi gives a quiet "oh" as the reveal shows, with no sparkles (`mercCelebrate`,
  `src/features/lessons/kit/merc-duo.ts:217`; `MercDuoOptions`, `src/features/lessons/kit/merc-duo.ts:119`).
- In Sing it the singing Merc appears as a still beside the chart, Merc for the lower voice and
  Tavi for the higher, and sings each note alone (`mercSing`, `src/features/lessons/kit/merc-duo.ts:165`);
  during a take both listen; the singing Merc celebrates only after Easy or Workable, for a set
  whose every hold was read and was in the band for at least 80 % of its length, at most once a set
  (FACTS 59).
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Drone Intonation's thirds.** The link is `/exercises/thirds-on-a-drone?lesson=24`,
  printed mercurypitch.com/exercises/thirds-on-a-drone (`src/features/exercises/slug-map.ts:75-81`):
  it opens Drone Intonation on the minor and the major third only, so this lesson's do and so are
  not in it, and it scores against the piano's notes, so a pure major third held through a round
  scores about 79 a round (FACTS 60), as the lead answered. The card says both, and that headphones
  help there too, since the drill plays its drone from the speakers while it listens
  (`src/features/exercises/drone-intonation/use-drone-intonation-controller.ts:152-155`) on the same
  raw microphone chain as this page (`src/lib/mic-manager.ts:47-56`; FACTS 51). It says nothing of
  the drill's drone's timbre, a plain sine by default (FACTS 60), nor of its run score, which an app
  fix let reach 100 (below); its editorial note says "about 79 a round" is a round's score, not the
  run's.
  It is the season plan's link for this lesson (SEASON-2 § 5.1, row 24,
  `docs/plans/find-your-pitch/SEASON-2.md:861`).
- **The link to swap.** When the slug for the fifth, the major third and the octave ships (SEASON-2
  § 5.2 item 15, `docs/plans/find-your-pitch/SEASON-2.md:917-929`), the card's link becomes that
  slug with `?lesson=24`, and the text's second sentence becomes "This link opens it on this
  lesson's fifth, major third and octave; do is the drone itself." When the pure-tuning option ships
  (the same item), the sentence on 79 goes. Both are lines in LESSON.md's editorial note.
- **The second drill, Ear Lab's Beat Hunt**: `/ear-lab?lesson=24`, printed mercurypitch.com/ear-lab,
  "then tap Beat Hunt": two pairs of tones, which pair was beating (FACTS 61). It asks for no voice,
  so it stays on the rest card.
- **The rest version.** After "Effortful", "Uncomfortable" or "Just listen today" the card shows
  Lesson 10's form, headed "Rest today", and is no longer a link, since Drone Intonation asks for the
  voice (`mountPractiseCard`, `src/features/lessons/kit/comfort.ts:126-149`; FACTS 63).
- **The first visit and the marker.** Nothing reads `?lesson=24` until SEASON-2 § 5.2 item 21 widens
  the marker, and until then the quiz's answers are refused whole; the page is not built before
  that, so First Light steps aside and the card has no first-visit line (FACTS 64).
- **Needed: a drone with harmonics in Drone Intonation**, proposed here, the app's work: a timbre
  for the drill's drone with harmonics up to at least the sixth, whatever the app's instrument, so
  its fifths and thirds can beat as this page's do (FACTS 66). The card says nothing of the drone,
  so none of its lines changes when it ships.
- **Shipped: Drone Intonation's run score reweighted**, the app's fix this package asked for. The
  run scored round(accuracy × 0.4 + best round × 0.15 + stability × 0.25), at most 80 once richness
  left the grade on 25 October, and its level rises only at an average of 90
  (`src/features/practice-intelligence/adaptive-difficulty.ts:12-13`), so it could never level up.
  Each weight is now divided by their sum, so a full score reads 100 and the level can rise
  (`src/features/exercises/drone-intonation/use-drone-intonation-controller.ts:285-295`; FACTS 60,
  66). The card never named the run score, so none of its lines changes.
- No premium exercise is linked: Drone Intonation and Ear Lab are free (FACTS 62).

## Explorer and season data

Lesson 24's entry, proposed for Season 2's data in its own module, in Season 1's entry form, as
Lesson 10's is (`src/features/lessons/kit/season.ts:346-364`):

- `n: 24`, `lane: 'voice'`, `title: 'Harmony against a drone'`, `short: 'Drone harmony'`,
  `topics: ['S20a']`, with S20a's name as SEASON-2 § 4.1 gives it, "Hold a part against a drone;
  beats"; the hook word for word (FACTS 1); `minutes: 16` and `page: '/learn/24'` once the page is
  built, under the drafts' comment, `// A draft until its sign-off (drafts.ts), as Lesson 3 is.`
- `pr.link`: `href` `/exercises/thirds-on-a-drone?lesson=24`, `addr`
  `mercurypitch.com/exercises/thirds-on-a-drone`, `label` "Drone Intonation" and `note` "the two
  thirds"; `pr.needs`, "The fifth, third and octave slug and a pure-tuning option (SEASON-2 § 5.2
  item 15); a drone with harmonics", is the team's only: the field is
  "Admin only, never drawn on a lesson page" (`src/features/lessons/kit/season.ts:102-103`).
- `EDGES` gains [5, 24], [10, 24] and [23, 24], as SEASON-2 § 4.3 gives them (FACTS 2); Lesson 24's
  prerequisite list is then [5, 10, 23] (`PREREQ`, `src/features/lessons/kit/season.ts:474-479` at `ad0a099f7`).
- The tease on Lesson 23's card is this lesson's, set on Lesson 24 in the lesson copy: `tease` "A
  drone, and a second note just above it, almost in tune.", with `teaseAlts`
  `[{ id: 'fifths', text: 'Fifths count as settled, tritones lean. Next, a note against a drone.' }]`
  and the variant's team note (FACTS 5). The tease on this page's card is Lesson 25's, set on Lesson
  25: "A minor tune, played twice. The second ending changes one note.", with the alternative
  `plan`, "Do, mi and so made a major chord. Minor keys hide another change.", true of this page
  but leaning softly on Lesson 25's predict, so the lead's line is the default (FACTS 5b). Each is
  at most `TEASE_MAX`, 70 characters (`src/features/lessons/kit/lesson-copy.ts:76`).
- The signature line for the admin console, from the card (FACTS 4): "Lesson 5's band with a drone
  under it: a top note sinks into it and its throb stills, the beads stand over it tuned two ways,
  and a wave smears the fifth's slow beat."
- The explorer's card shows "16 min" once the page is live.

## What the kit and the app still need

Found in the kit and the app as they stand on main at `c60f0fdcb`. Every item is proposed.

1. **The lesson host**: `learn/24.html` at `/learn/24`, which every build takes as a lesson page
   (`lessonPages`, `tools/draft-lessons.ts:82`); `/learn/24` and `/learn/24.html` in
   `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`); and the first-paint budgets. The lesson
   pages' route already takes any two digits (`LESSON_PAGE`, `src/lesson-gate.ts:135`).
2. **The draft line**, in the draft list's form:
   `24: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`, as Lesson 5's
   (`src/features/lessons/kit/drafts.ts:31-42`).
3. **Seasons in the kit** (SEASON-2 § 6.2 item 1), as Lesson 15's spec sets them out; the masthead
   then names Season 2, where today its season is a constant
   (`src/features/lessons/kit/lesson-menu.ts:111`).
4. **Lesson 22's four pieces**, as its spec gives them and this page cites them, without restating
   them: its item 4, Merc's voice with its vibrato as a parameter
   (`docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:684`), null for the drone and every
   note against it, Lesson 22's cold-open wave for Step 4's top note; its item 5, the band chart's
   new states (`docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:698-716`), of which this
   page takes the no live band state and the violet middle line for Sing it; its item 6, the
   centre-line reader (`docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:717`), which reads
   this page's holds; and its item 7, Lesson 5's hold flow in the kit
   (`docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:732`), with this page's options
   (item 8). The page is not published without them.
5. **A drone under a take**, code with tests: the kit's hush (`src/features/lessons/kit/sound.ts:539-547`)
   gains one kept source, a drone voice started before the hush, which the hush leaves sounding while
   it stops and silences everything else; the drone's own release ends it. Tests: during a take a
   play of any other source sounds nothing and says nothing; the kept drone sounds until its release;
   a second kept source is refused.
6. **The headphones check and the quiet check in the kit**, code with tests, since Lesson 26 asks
   for both: `kit/headphones.ts`, the check's two buttons and the visit's answer, in memory; and
   `kit/quiet-check.ts`, pure, which reads the frames of the two seconds with Voice Mirror's own
   preprocessing, as the hold reader does, and fails when it finds a voiced run of 0.3 s or more at
   any pitch, since it cannot tell the drone from a voice or a television; its line says what it
   heard and what to do (Toys 6, state 6). Tests: synthetic frames of silence pass; frames of a
   steady tone on the drone's pitch or an octave from it, for 0.3 s or more, fail; a voiced run of
   0.3 s at an unrelated pitch, a tritone from do, fails too; a run of 0.2 s at any pitch passes; a
   failure releases the microphone, shows the line and opens the sing-along with Start under it.
7. **Two lab tests**, before the scored path ships and before any beat rate goes on screen, on the
   lab's phones (one iPhone, one Android) and laptops, with the coach for the second:
   - **Silence over a speaker drone** (the lead's answer 1): with nobody singing, the drone on D3
     and on D4, and on Move do's highest, G3 and G4, from the device's speakers at the holds' level
     and at full volume, the microphone open: the quiet check must fail or the hold must give no
     reading, on every device, and silence must never give a reading in the band, never a unison in
     tune. Then a voice that stops: sing do for 2 s of the five-second hold and stop, at the holds'
     level and at full volume; the reading must be Lesson 5's stopped-early line, never a full hold,
     since a drone the detector hears now and then could carry the stopped hold on (FACTS 52). The
     test records too whether the detector itself hears the drone, which says how often the quiet
     check will send a learner to the sing-along, and the same with closed and open-back headphones
     at the drone's level, where the check should pass, and with Bluetooth earbuds, the commonest
     headphones on a phone: whether opening the microphone switches the headset's profile or moves
     the drone to the loudspeaker, and so how often the check sends their wearers to the sing-along.
   - **The timbre** (the lead's answer 2): the drone and the top note in the "ooh" partials, straight,
     and any timbre the lab proposes, through the master compressor: whether the piano's fifth over
     A3 (0.75 a second), D3 (0.50) and D4 (0.99), and its third over A3 (8.7), D3 (5.8) and D4
     (11.7), and both over Move do's highest drones, G3 (0.66 and 7.8) and G4 (1.33 and 15.6), are
     heard as beats on phone speakers and on headphones, by the lab and the coach; and whether Step
     4's wave leaves the fifth's throb much fainter under a flutter, as FACTS 38 computes. The page's
     rates go on screen only for a timbre that passes. The same session times the drone chart's
     states and the holds for the chip (SEASON-2 § 1.3), and checks the brightness against the
     luminance cap.
8. **Lesson 5's hold flow, this page's options**: holds of 5 seconds as well as 10 and 15 (`HOLD_SEC`,
   `src/features/lessons/lesson-05/hold-flow.ts:31-32`; the hold reader's length,
   `src/features/lessons/kit/hold-take.ts:56`); a set of three notes, each with its own model note,
   then a set of two, with the set's rules (Toys 6): a take is one run of a set, Again sings the
   whole set, a hold with no voice ends the set, the celebration needs every hold read; the drone
   under each take (item 5); no live band state; `restAfterEffort` on; the second set's button;
   Move do's reach, five higher and none lower, moving the drone too; and the summary's subject per
   note, "on so", "on mi", with a line for a hold it could not read (`holdSummary`,
   `src/features/lessons/kit/hold-take.ts:330-343`). Lesson 5's page keeps its behaviour.
9. **The drone chart's states** on the band chart (`src/features/lessons/kit/band-chart.ts`), code with
   tests: the drone as a narrow amber band or as a chrome line or a pinned marker; the top note's
   line from a schedule, the slide's and the wave's included; the brightness from the envelope of
   the harmonics that nearly meet, from the schedule's phase, summed over a chord's pairs, under the
   luminance cap; the beads; the ticks; the readout; the spoken summary's line when the colour
   changes.
10. **The lesson copy**: this lesson's tease and its variant set on Lesson 24, with the variant's team
    note (FACTS 5), within `TEASE_MAX`: 57 and 69 characters; and the signature line in the team's
    notes.
11. **Season 2 in the app's lesson plumbing** (SEASON-2 § 5.2 item 21), the app's work: the lesson
    marker's range (`src/lib/lesson-marker.ts:11-19`) and the lesson-answer bounds
    (`workers/db-worker/src/mirror-metrics.ts:57-62`), which refuse Lesson 24's answers whole today
    (FACTS 64).
12. **The head and the share card** (Sections, 2): the title, the descriptions, the share card
    `learn/lesson-24-og.jpg` and its alt, and the structured data with `timeRequired` `PT16M`; the
    head test already has its word for sixteen (`src/tests/lesson-pages.test.ts:84`).
13. **Lesson 23's questions as a module** (`lesson-23/quiz-questions.ts`), so this page imports its
    question 3 (Toys 5).
14. **Drone Intonation, the app's work** (Practice links): the fifth, third and octave slug and the
    pure-tuning option (SEASON-2 § 5.2 item 15); and a drone with harmonics (proposed here). Its run
    score, reweighted so a full score reads 100 and the drill can level up, has shipped.
15. **At release, the room's link back**, optional: SEARCH § 8's rows for the exercises and Ear Lab
    gain 24.

## Decisions for the owner

None open. The page's title, which the first draft asked about, is the lead's answer of 2 November
2026, "How to sing in tune with a drone | MercuryPitch" (47), query-led (Sections, 2). It names no
beat, slowing or stopping (FACTS 1a).

## Edge cases

- **Sound off, unset or missing.** Every play obeys the kit's `canPlay`. Both predicts' reveals wait
  for plays heard with sound on; Start waits for sound (Toys 6). With no Web Audio the page stays
  readable, every play runs its drawing in silence with its hint, and Sing it offers the sing-along
  as words alone.
- **Before the cold open's choice**: the slide is locked and the reveal hidden; the steps' toy and
  free play are disabled under their lock line; Step 2's choices and plays are disabled and its hint
  reads "Choose an answer at the top first."; the Pure word's play and quick check 4's are
  disabled; the tour waits (Toys 1).
- **Before the cold open's reveal**, its choice made: the steps' toy works, and Step 1's text, its
  two plays, Try and Notice stay hidden under their held line until the slide has been heard to its
  end (Toys 1).
- **Before Step 2's choice**: its two plays, the beads' taps, Piano · Pure, Play all three, Steps 3
  and 4's plays and drag, free play's states 2 to 4 and "Just listen today"'s play are disabled.
  Until its reveal, the step's text, Try and Notice, and Step 3's Tavi line, text, plays, Try and
  Notice, stay hidden, Step 3's under its held line (Toys 3, 6).
- **One of Step 2's plays heard, the other not**: the hint stays `chosen`; the reveal waits.
- **A play cut short** (another sound, a step link, leaving the hero or the step): not heard, no
  reveal, the hint as it was; the line keeps what it last drew.
- **A return visit** starts with both predicts fresh, so the steps' toy, free play, Step 2, the Pure
  word and quick check 4 hold back again until their choices, and Steps 1 and 3's words until their
  reveals. Move do starts on D again.
- **A drag during a play**: the drag takes over the sound; the play stops and counts as cut short.
- **Reduced motion**: lines land whole, the brightness holds still, and the readout and the spoken
  summary carry the rate.
- **A first visit that never chooses**: the welcome tour waits, and the next lesson page opened at
  the top offers it again; "Tour this page" runs it at once (Toys 1).
- **No voice chosen**: every example sounds on A3; nothing in Sing it plays until a voice is chosen,
  and the voice moves only Sing it's notes and drone.
- **"I have headphones on" with none on**: the quiet check hears the drone and opens the sing-along
  (Toys 6, state 6).
- **A hum, an early answer, a television or a second singer during the quiet check**: it fails as
  the drone would, since it cannot tell them apart; its line says the microphone heard a note and
  asks for quiet, and Start runs it again (Toys 6, state 6).
- **Headphones unplugged during a set**: the drone then reaches the microphone; the reader cannot
  tell, so the page does not claim to. The quiet check runs before every set, Again's included, not
  only the first.
- **The microphone refused** at Start: the sing-along; no take is counted.
- **A hold with no voice in 6 s**: it ends the set, with the kit's no-start line; "How did that
  feel?" follows if a hold of the set was sung, and Again while the set has takes left; with nothing
  sung, Again and Done for today and no feeling question (Toys 6, the set's rules).
- **Move do pressed during a set**: it is disabled from Start to the set's end, as every play
  control is; between sets it moves the next set, the drone with it (Toys 6, state 2).
- **A hold that stops early**: Lesson 5's line for it ("Stopping early is fine.").
- **A note sung an octave away**: read in full, with the octave line; on do over the drone, the
  octave is the drone's own octave and reads the same.
- **A narrow phone**: the chart keeps the band at least 43 px tall (FACTS 78); the beads' labels sit
  outside the plot.
- **Leaving Sing it mid-set**: the take is abandoned and counts as one of the set's three, the drone
  stops and the microphone is released.

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-24/`, and on the kit
parts it adds:

1. **Sounds**: every fixed sound's frequency as FACTS 67 to 70 give it, the pure notes at 275.00 and
   330.00 Hz, 441 Hz for the octave; every play's length; the slide's schedule, 1.5 s at 224, an
   exponential glide over 6 s, 2.5 s at 220, with its rate 4.00, 2.99, 1.99, 0.99 and 0 at 0, 1.5,
   3.0, 4.5 and 6.0 s into the glide; no modulator on any drone or top note but Step 4's wave, six
   swings a second at 50 cents either side, grown in over 0.3 s. Then the phases (FACTS 44, 69):
   - every play starts the drone and the notes set against it on one audio time, each partial at
     phase 0;
   - the slide's schedule leaves the top note 12° to 14° from in phase with the drone at its end;
   - a snap of Step 1's drag to 220 Hz, or to 440 Hz with Octave, starts the new top note on a whole
     period of the drone's from the drone's start, so its partials and the drone's meet in phase,
     whatever phase the drag had reached, the dragged voice released over 0.05 s;
   - under Step 4's wave, the envelope of E4's second harmonic and the drone's third, computed from
     the play's schedule over 400 s, has its strongest component under 2 Hz at most 40 % of the
     straight play's at 0.745 Hz (31 % by FACTS 38, near 0.61 Hz, where the kit's wave in cents
     moves it), and components at the wave's rate and twice it, its flutter (FACTS 38).
2. **Beat rates**: the readout's rate is |n × top − m × drone| for the ratio the interval nears, as
   FACTS 11, 15, 19 and 20 give: 0.745 and 8.731 above A3, 0.497 and 5.827 above D3, 0.994 and
   11.654 above D4, and 0.664 and 7.778 above G3, 1.327 and 15.556 above G4; the pure chord's pairs
   under 20 Hz are none; the readout's words follow `beatWord` with "still" at none (FACTS 27, 28).
3. **The range**: every note of D3, F♯3 and A3 and of D4, F♯4 and A4 at least 2 semitones inside
   every preset of its voice in `VOCAL_RANGES`, with the table's numbers (FACTS 56), and so at every
   Move do position up to five semitones higher; Move do's reach is `{ lower: 0, higher: 5 }`, with
   "lower" `aria-disabled` at D and "higher" at five; no other octave is offered (FACTS 57).
4. **The cold open's predict**: at first paint the hero draws the drone's band and the still line at
   224 Hz, with no glow, no cents and no rate; the slide does not play before a choice; the free play
   works before it and never reveals; the reveal waits for the slide heard to its end with sound on;
   a play cut short reveals nothing and leaves the hint; no `next` hint is set; the hints and guesses
   are LESSON.md's; Step 1's text, its two plays, Try and Notice stay hidden, the held line in their
   place, until the reveal, and show with it, after the hero's reveal in the announcement (FACTS 41,
   43, 44, 46).
5. **Step 2's predict**: until the cold open's choice its choices and plays are disabled and its
   hint reads "Choose an answer at the top first."; on that choice the hint reads "Choose an answer
   to unlock the two intervals." and the predict mounts; the reveal waits for both plays heard; its
   `unlocks` enables the taps, Piano · Pure and Play all three on its choice, and its `onChoice`
   enables Steps 3 and 4's plays and Step 3's drag, free play's states 2 to 4 and "Just listen
   today"'s play; the step's text, Try and Notice, and Step 3's Tavi line, text, plays, Try and
   Notice, stay hidden until the reveal, Step 3's held line in their place, and show with it (FACTS
   46, 48).
6. **Nothing answers either predict before its choice**: the lesson menu's headings, the recall and
   the four words name no beat's slowing or stopping and no faster interval; the steps' toy, free
   play, the Pure word's play and quick check 4's play sound and draw nothing until the cold open's
   choice; no two close notes sound before it anywhere on the page; nothing sounds the piano's fifth
   or third over the drone before Step 2's choice, "Just listen today"'s play included; Step 1's
   words are hidden until the cold open's reveal and Step 3's until Step 2's (FACTS 1a, 46, 71).
7. **The quiz**: the recall imports `l10-q1` and Lesson 23's question 3 unchanged, with their away
   links; the quick check's ids and keys; `l24-q1`'s words as LESSON.md gives them (FACTS 74).
8. **The quiet check** (What the kit and the app still need, item 6): a voiced run of 0.3 s at an
   unrelated pitch fails it as the drone's does, with its line; it runs before every set, Again's
   included (FACTS 52).
9. **The drone under a take** (item 5).
10. **The hold flow and the set's rules** (Toys 6): three five-second holds, then two ten-second ones
    only after Easy or Workable; a take is one run of a set, and three takes a set, a take with no
    voice or one cut short counted; Again sings the whole set, the quiet check first; a hold with no
    voice in 6 s ends the set, then "How did that feel?" if a hold of the set was sung, its Easy or
    Workable offering Again while takes remain and never the next set, or, with nothing sung, Again
    and Done for today with no feeling question; Effortful keeps the readings and offers nothing
    more, with the rest card; Uncomfortable takes the readings away, with the doctor lines and the
    rest card; the celebration only for a set whose every hold was read and in the band for at least
    80 % of its length, once a set; the tricky line at its share; the summary's words, with "there
    was no reading on mi" (or on so) for a hold it could not read and no summary when neither was
    read; Lesson 22's vibrato line never shows; Move do changes nothing during a set (FACTS 55, 57,
    58, 59).
11. **The reader at five seconds**, three cases beside Lesson 22's, which are on 10-second holds bar
    an early stop and a short trimmed span (`docs/plans/find-your-pitch/lessons/22-vibrato/WEB-SPEC.md:858-884`),
    on synthetic frames 16 ms apart through Voice Mirror's `preprocess`, as there: a ±50 wave at six
    swings a second round mi for 5 s reads in the band for all 5 seconds; Merc's ±14 wave at 5.5 on
    a pure third, 13.69 cents under the piano's mi, reads in full; and a 5-second hold that stops at
    2.5 s gives Lesson 5's stopped-early line, read on the middle line (FACTS 58).
12. **The sing-along and the listening path**: the sing-along opens after No headphones, no
    microphone, a refused microphone and a failed quiet check; asks for no microphone; plays at do
    where Move do left it; gives its Easy and Workable line; offers Sing along again once a visit,
    and not after it has been sung twice. After "Just listen today", the headphones check, Move do,
    Start and the sing-along do not show, and its play waits for Step 2's choice (FACTS 59;
    REQ-GVC-055).

Page tests (the series' own, run on every lesson page): the head test, with the title, the
description's length and its "A sixteen-minute lesson", the chip and `timeRequired`
(`src/tests/lesson-pages.test.ts:156-159`, `:191-210`); no planning text on the page; the stage
fits a 390 px screen; first paint within the budget; the claims validator; one sound at a time; no
background staff or clef; the tour's hold.

## Contract

Lesson 1's contract, unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of
GSAP, and practice links that carry `?lesson=24`. Then the layout, accessibility, sound, motion and
storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children,
touch targets of at least 44 px with no two tap zones overlapping, visible focus, a single dark theme
with every colour a token and an explicit body background, sound only after a tap, the microphone
only after Start, localStorage only for per-viewer conveniences inside try/catch, and the whole page
usable with no sound, no microphone, no headphones, no WebGL and no storage. Nothing on the page
flashes more than three times a second (Look). The figures' accessible names and every live region
use words only, and every note is spoken with its letter and octave. The page stores the quiz seeds
and records (`fyp-l24-recall-seed`, `fyp-l24-recall-v1`, `fyp-l24-seed`, `fyp-l24-quiz-v1`),
`fyp-done` (`src/features/lessons/kit/progress.ts:12-15`), `fyp-voice`
(`src/features/lessons/kit/voice-choice.ts:20`), `fyp-motion`
(`src/features/lessons/kit/motion-switch.ts:12`), `fyp-pos` (`src/features/lessons/kit/position.ts:20`)
and `fyp-tour` (`src/features/lessons/kit/tour-gate.ts:29`); nothing from the toys, the headphones
answer, Move do, the quiet check or the holds: Move do and the headphones answer hold for the
visit, in memory. No frame, reading or answer from Sing it is kept or sent: a
take is held in memory until it is read and then dropped (`src/features/lessons/kit/listen.ts:19-22`).
Both predicts' choices hold for the visit, in memory: a return visit starts fresh.

Page QA before publishing adds, for this page, every check against a local or dev build, never
production:

- Every play, drag, switch and button works by keyboard alone and announces what LESSON.md shows.
- The cold open's two plays sound and draw as FACTS 41 and 44 say: the throb heard before the glide
  and the stillness after it, the still pair whole; Step 1's snapped unison sounds whole each time.
- Step 4's two plays, by ear with the coach: straight, an even throb; with the wave, a much fainter
  throb under a flutter, harder to follow, as FACTS 38 computes and the step says.
- No source on the page sounds two close notes, a pure interval or an interval over the drone
  before the cold open's choice, or the piano's fifth or third over it before Step 2's.
- The lab's two tests have passed and are written down where the coach's sign-off is.
- With headphones, a held note with an even vibrato reads in full on each of do, so and mi, one that
  comes late too, and a sung pure third and a sung piano third both read in the band, by ear, with
  the coach.
- On a real phone at 390 px, the drone chart's four states, the beads' labels and the holds' lines
  fit their cards, and D3 is heard through the speaker.
