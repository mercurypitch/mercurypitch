# Lesson 3 web page: spec

The Lesson 3 page is the web lesson for "Match a note": written steps, live toys, two predicts, the
first sung checkpoint that listens, and a quiz. There is no episode yet, so this is a text-only
page. Copy is in [LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is the third
page on the Phase 1 toy kit (`src/features/lessons/kit/`) and the first with a microphone, so it
adds three kit parts every later voice lesson needs: the band chart, the listener and the comfort
check. Where a part exists only in Lesson 1's page (`src/features/lessons/lesson-01/`), it is
promoted into the kit, never copied (Lesson 2 WEB-SPEC); if Lesson 2's page has not promoted it
first, this page does.

Its public home is `mercurypitch.com/learn/03` (MASTER-PLAN § 12 item 9): a hand-written document
`learn/03.html` with its module in `src/features/lessons/lesson-03/`, served the way Lesson 1's page
is (Lesson 1 WEB-SPEC, "On the app"). It publishes only after two things: the vocal coach's
sign-off, because it is a voice lesson (MASTER-PLAN § 7, day 6; § 12 item 8), and Lesson 2's page
at `/learn/02`, because the recall check links there and uses the quiz changes that page brings
(Toys, 8).

## Look

Lesson 1's, unchanged: the dark listening room, the series colour code, Lesson 1's type, the "Find
Your Pitch" wordmark and its motion rules. The pitch-canvas toys (the hook stage, the octave toy,
the band chart and the checkpoint) use the app's canvas set: target amber `#f59e0b`, singer violet
`#a78bfa`, and in-tune mint `#80ffca` for the band's lit edge, always beside the words "in the
band" (FACTS 59). There is no "off" colour: a note outside the band is described in words, never
painted as an error. Gold appears once, on the octave toy's "same note" bracket (the fit). Violet
means the singer only.

Only the two Merc idle loops move on their own. Everything else moves because the viewer started
it: the folds' vibration, the chase, a tone's line, the live line. Under `prefers-reduced-motion`
the Mercs hold a still frame, every transition lands in its end state, the band chart never
scrolls, and what the viewer starts still sounds. For everyone else, the masthead's Pause
animations toggle stops the Merc loops (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2), with Lesson 2's departures kept: the step toys double as the
Playground, the mix-up card sits inside the step whose toy refutes it, and the practise link is in
the Wrap. New: there is no Watch section until a film exists, and the checkpoint listens.

1. **Masthead**: Lesson 1's, with "Season 1 · Lesson 03" and the anchors Lesson, Sing and Explorer.
2. **Hero**: kicker, title, LESSON.md's meta as chips ("15 minutes", FACTS 61; the Lesson 1 chip,
   a link to `/learn/01`; "Also useful: Lesson 2"; Sound on; Microphone optional), the promise, and
   the two Mercs either side of the hook stage (Toys, 1).
3. **Recall from Lesson 2**, open only when Lesson 2 is marked done (Toys, 8).
4. **Cold open: predict**: the bubbles, the two figures, the sound pair, the predict and the reveal
   (Toys, 1).
5. **Three words you'll meet**, each with a play button (Merc's "ooh" on A3; Lesson 2's 100-cent
   glide) or, for the band, a small band that lights.
6. **The steps**: Lesson 1's sticky stage and step deck (`kit/step-deck.ts`, "N of 5"), each step
   with its heading (orange's question), text, "Try:", "Notice:" and toy: 1, the vocal folds (Toys,
   2); 2, louder or higher and the care card (Toys, 3); 3, match it by ear, the mix-up card and the
   Go deeper drawer (Toys, 4 and 9); 4, two octaves, its predict first and the voice choice last
   (Toys, 5); 5, the band chart (Toys, 6).
7. **Sing it**: the checkpoint (Toys, 7).
8. **Quick check** (Toys, 8).
9. **Wrap**: the recap, the challenge, the practise card in the version the checkpoint's ending
   picks (Toys, 7: the Voice Mirror card with "Ten minutes, gently, most days", or the rest card
   without it), and the kit's next-lesson card (`kit/next-card.ts`): Lesson 4's hook and "Start
   lesson" to its page, or "Coming later" and the explorer while it is not live. Free play unlocks
   here: the folds, the slider match with its rounds on C4 and F3, and the band chart in drag mode
   on one stage (playbook rule 17).
10. **Lesson explorer**: Lesson 1's, with Lesson 3 current and marked done when its quick check is
    finished (the recall marks nothing). Its card reads "Ready · read", with a Length of 15 min
    (`minutes: 15`), and offers "Start lesson" with no film (New engineering, 4); its practise link
    is already `season.ts`'s (`/mirror?lesson=03`).
11. **Footer**: the practise link, the font credits, and "Every sound on this page is synthesised in
    your browser" (FACTS, Labels).

## Toys: what each reuses, and what is new

| Toy                 | Reuses                                                                                                                                             | New in Lesson 3                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1. Hook stage       | Lesson 1's predict widget (`lesson-01/predict.ts`, promoted into the kit); the tone player (`kit/sound.ts`)                                        | The two figures, the sound pair on the band chart, three reveal cards                             |
| 2. Vocal folds      | Lesson 1's string toy (`lesson-01/toy-string.ts`: slow motion 220 times, cycle counter) and dial (`lesson-01/toy-dial.ts`: log slider, rail, bead) | The folds drawn from above, Breathe and Sing, Stretch                                             |
| 3. Louder or higher | Lesson 1's loudness toy (`lesson-01/toy-loud.ts`), promoted with label and timbre options                                                          | Merc's "ooh", the renamed sliders, the care card                                                  |
| 4. Match it by ear  | The dial's slider and `holdToPlay` (`kit/toy-helpers.ts`); the vertical layout of Lesson 2's planned semitone ruler                                | All the rest: the hidden-gap round, Compare, Play together                                        |
| 5. Two octaves      | The predict widget; the band chart (toy 6)                                                                                                         | The octave band, the gold bracket, the voice choice                                               |
| 6. Band chart       | None in the kit; the app's canvas colours (`src/features/stem-mixer/pitch-canvas-visuals.ts`)                                                      | All new, as `kit/band-chart.ts`: one component for toys 1, 5, 6 and 7, and for Lessons 5, 7 and 9 |
| 7. Sing it          | Lesson 1's hum-along ring (`lesson-01/sing.ts`); the app's mic chain and Voice Mirror's maths (FACTS 57)                                           | The first microphone on a lesson page: `kit/comfort.ts`, `kit/listen.ts`, `kit/take.ts`           |
| 8. Recall and quiz  | `kit/quiz.ts` with Lesson 2's three changes; `kit/progress.ts`; Lesson 2's questions 2 and 4                                                       | Ids (`l02-q2`, `l02-q4`, `l03-q1` to `l03-q4`); a recall shown by Lesson 2's done mark            |
| 9. Go deeper        | The `details` drawer of Lesson 2's spec                                                                                                            | Beats                                                                                             |

### 1. Hook stage

- Two ticket cards (the stats-site motif) repeating the figures of Lesson 2's next-lesson card:
  "ASKED 59 %" over "of 1,105 · said they couldn't copy a tune", and "TESTED 10–16 %" over "a
  semitone or more off" (FACTS 1 to 4, 44a), with LESSON.md's semitone line under them (FACTS 39).
  Between them, the band chart (toy 6) with one amber band at A3.
- **Play: on the note** and **Play: a semitone off** are live from the start, as sound before the
  numbers: Merc's A3 (1.6 s, blue Merc in `sing`), then the reply (1.6 s) on A3 or G♯3 (FACTS 43,
  46), drawn as a violet line inside the band or a semitone under it, labelled "0 cents" or "100
  cents below: a semitone". The reply belongs to no Merc.
- The predict widget: orange's bubble ("I can't sing.") and blue's reply, then LESSON.md's question
  about the 39 students who said they couldn't copy a note, with its two choices (FACTS 6).
  Choosing shows the three cards one after another, then the answer line, whose bracket speaks to
  "Most of them" without calling it wrong; no choice is ever marked wrong. Under reduced motion the
  cards appear together.
- States: waiting for a choice; a sound playing; choice made, cards and answer shown.
- Accessible text: the figures are text; while the pair plays, the chart's label reads "Merc's A3
  as a band; the reply on the same note" or "the reply a semitone below it".

### 2. Vocal folds

- A canvas of the two folds seen from above, a V that opens at the back, in chrome with ink labels
  ("vocal folds", "front", "back"). **Breathe** draws them apart; **Sing** (hold to sing) brings
  them together and sounds Merc's "ooh" at Stretch's pitch while they vibrate.
- At real speed the drawing shows the blurred envelope, as the string toy does. **Slow motion**
  (220 times slower) shows each open-and-close cycle, with a tick and a counter: once a second at
  220 Hz, twice at 440 Hz (FACTS 22).
- **Stretch** is a log slider from 110 to 440 Hz (A2 to A4; FACTS 48). The folds draw longer and
  thinner as it rises, and a bead climbs the pitch rail in the kit's note colour (blue at A3, orange
  at A4, chrome elsewhere: `kit/notes.ts`). Readout: "220 Hz: 220 swings a second", and in slow
  motion "slowed 220 times: 1 a second".
- States: breathing; singing (sounding); slow motion on or off; any Stretch value.
- Accessible text: Sing has `aria-pressed`; Stretch is `role="slider"` with `aria-valuetext` such
  as "220 hertz, A3: the folds open and close 220 times a second"; a live line repeats the state.
  Under reduced motion the canvas shows two still frames, open and closed, with the rate in text.

### 3. Louder or higher

- Lesson 1's loudness toy, promoted into the kit with options for its slider labels and timbre:
  here "Louder" (how far) and "Higher" (how fast), in Merc's "ooh" (`kit/sound.ts` kind `merc`),
  its flag reading "Louder: the note stayed put" or "Higher: the note moved up".
- States and accessible text as in Lesson 1: each slider sounds while held and carries its own
  `aria-valuetext` (a percentage, a frequency). New here: the flag sits in a polite live region, so
  a screen reader hears what each move did to the note.
- Beside it, the care card: LESSON.md's four lines, each with an icon from the app's SVG set (no
  emoji), and the comfort line in bold.

### 4. Match it by ear

- A vertical stage, pitch as height, ±300 cents around Merc's note. One round, on A3, with the
  viewer's note starting a seeded 80 to 200 cents above or below it; free play adds rounds on C4
  and F3 (FACTS 47).
- The round: **Play Merc's note** (1.5 s, the kit's soft tone, steady, so the comparison and the
  beats are clean); drag the handle, and your note sounds while held (`holdToPlay`); **Compare**
  plays Merc's note, then yours, a second each, and only then reveals the gap ("Your note sits 18
  cents below Merc's note"), a tick at Merc's pitch and a 35-cent band with "in the band" or
  "outside the band". Adjust and compare as often as liked; nothing is rated.
- **Play together** sounds both notes at once, for the beats (Go deeper).
- The gap stays hidden until Compare: the ear does the comparing (playbook rule 23's "sing first,
  then see", here for a slider).
- States: ready; Merc's note playing; dragging (sounding); comparing; gap shown.
- Accessible text: the handle is `role="slider"`; until Compare its `aria-valuetext` says only
  "Your note, above where it started" or "below where it started"; after Compare a polite live
  region reads the gap. The keys are the band chart's: arrows move 1 cent, Shift with an arrow 10,
  Page Up and Page Down 100.

### 5. Two octaves

- The band chart on a pitch axis from F3 to C5, log-spaced so every semitone has the same height,
  with a tick per semitone, letters on the natural notes and A3 and A4 named in full: Merc's amber
  band at A3, and a dashed amber band one octave up at A4.
- The predict opens the step: two choices (Yes, it counts · No, it's a different note); choosing
  unlocks Play blue's A3, Play orange's A4 and Play both. Once Play both has been heard, the reveal
  (LESSON.md) appears, as in Lesson 1's predict, which never describes a sound the viewer has not
  heard; orange's reply is drawn as a violet line landing in the A4 band, with a gold bracket
  between the bands, "same note, an octave apart".
- The voice choice: two buttons with the Mercs' stills, "Lower: sing with blue Merc, around A3" and
  "Higher: sing with orange Merc, around A4" (`aria-pressed`, at least 44 px), kept in localStorage
  inside try/catch (`fyp-voice`, which later voice lessons share). Sing it reads the choice, and
  asks for one before the warm-up if none is stored.
- States: waiting for a choice; play buttons unlocked; revealed; a voice chosen or not.
- Accessible text: "Merc's band at A3, and the same note an octave up at A4"; the reveal is text.

### 6. Band chart

The signature: the singer's line chasing Merc's band, the gap shrinking in cents.

- A strip in the app's canvas style. Vertical: cents around Merc's note, −150 to +150, with ticks
  at 0, ±15, ±35, ±50 and ±100, labelled "35", "50: halfway to the next note" and "100: a
  semitone". Horizontal: a 4-second window. Merc's amber band reaches ±35 cents (FACTS 41), with
  Merc's amber line steady at its centre. Merc's "ooh" carries a vibrato (FACTS 40), but the chart
  leaves it out, so the wobble is never read as part of the band or as something to copy.
- **Chase** (demo): Play, Pause, a scrub bar and Slow (half speed), with sound: Merc's A3, then a
  tone that follows the violet line. The line starts 80 cents low ("try"), passes a "compare" mark,
  adjusts to 40 low, then to 12 low, inside the band; the readout counts −80, −40, −12; the band's
  edge lights mint and "in the band" appears (FACTS, Illustrations).
- **Drag**: after the chase, a handle on the line's head, from −150 to +150 cents, the chart's
  height. Readouts: the gap in cents, signed; the band state by Voice Mirror's edges (15 or less
  "right in the middle", 35 or less "in the band", 60 or less "close", beyond that "outside the
  band"); and the nearest note's name in the app's sharp spelling, which flips at ±50 cents (FACTS
  39; Lesson 2 FACTS 28).
- **Live** (toy 7): the singer's line, folded into Merc's octave. A note more than 150 cents away
  pins the line to the chart's top or bottom edge, with an arrow pointing off the chart, and the
  readout gives the distance in semitones, as the take's line does.
- States: idle (Merc's band and line); chase playing, paused or scrubbed; drag; live.
- Keyboard: the handle is `role="slider"`, −150 to +150 cents, with `aria-valuetext` such as "20
  cents below Merc's note: in the band; nearest note A3"; arrows move 1 cent, Shift with an arrow
  10, Page Up and Page Down 100, as on toy 4.
- Under reduced motion the chase lands in its end state with its three readings listed beside it.

### 7. Sing it: the checkpoint

The band chart in live mode, with Merc's note as the band and the viewer's line drawn against it.
Every state has a visible status line that is also announced (`aria-live="polite"`). The window is
the one MASTER-PLAN § 4.2 item 7 asks for, octave-tolerant and generous: the app's own 35-cent "hit"
and guided zone (FACTS 41), and "close" out to 60 cents described as close. Each note allows up to
three tries: Hutchins and Peretz (2012) found that singers don't improve over repeated sung tries,
so more would add singing, not learning (FACTS 16).

States:

1. **Comfort check**, always first and asked every visit (never stored): the comfort line, the list
   naming all six of REQ-GVC-020's conditions, and two buttons (FACTS 33, 34). "Just listen today"
   opens listen-only mode: Merc sings each note on a tap, the chart shows Merc's band and line,
   nothing listens, and LESSON.md's rest line and doctor lines show (REQ-GVC-021; FACTS 35).
2. **Voice choice**, if Step 4 left none, so that the warm-up's demonstrations are in the chosen
   voice.
3. **Warm-up**, optional, with Skip: two cards, each with a play button for Merc's demonstration in
   the chosen voice (the sigh: a 1.5 s "ooh" glide down from E4 to A3, or from E5 to A4; the slide:
   up from A to E and back, the lip trill's path; FACTS 37, 46a), the instructions with "Copy the
   way Merc's voice slides, not the exact notes", and the stop line. Nothing listens and nothing is
   scored (REQ-GVC-074, REQ-GVC-075).
4. **Briefing**: the "What this does" box (REQ-GVC-002, REQ-GVC-003, REQ-GVC-012, REQ-GVC-026;
   FACTS 52, 60) and **Start**, the only control that asks for the microphone (MASTER-PLAN § 4.2,
   item 2).
5. **Note n of 3**, A, then G, then B in the chosen voice (FACTS 45). **Listen**: Merc's note,
   2.0 s, the singing Merc in `sing`. **Your turn**: the take waits up to 6 s for the first voiced
   frame, then runs 3 s; the violet line draws live, folded into Merc's octave, with a small
   "octave lower" or "octave higher" tag while it sits within 50 cents of Merc's note; the gap
   readout follows it; both Mercs `listen`; Lesson 1's breathing ring counts the time.
6. **Reading**: one line from LESSON.md's set, chosen by the take's reading (below), then **Again**
   (the same note and timing: REQ-GVC-014) while the note has had fewer than three tries, and
   **Next note** (after note 3, **Done**). A note's first take in the band brings one `celebrate`
   from the singing Merc.
7. **How did that feel?** after note 3 (REQ-GVC-022). The answer also picks the Wrap's practise
   card:
   - Easy or Workable: the count (below), rule 15's line when fewer than all the heard notes
     landed, and **Again**, the three notes once more from the start, offered once a visit. The
     Wrap shows the Voice Mirror card.
   - Effortful: the count, no celebration and no Again (a report of effort suppresses
     immediate-repeat encouragement: REQ-GVC-021), then "Keep it gentle: rest before you sing
     again." The Wrap shows the Voice Mirror card unless the coach decides otherwise (LESSON.md,
     For the vocal coach).
   - Uncomfortable: no count, no celebration and no Again, then LESSON.md's line and the doctor
     lines (REQ-GVC-021, REQ-GVC-023, REQ-GVC-024). The Wrap shows the rest card.
   - The rest card, after "Uncomfortable" or "Just listen today", is LESSON.md's "Rest today. Voice
     Mirror will be here when your voice feels comfortable", without "Ten minutes, gently, most
     days" (REQ-GVC-055; FACTS 36, 38). The page holds the ending in memory for the visit, never in
     storage; skipping Sing it, or singing along with no microphone, leaves the Voice Mirror card.
8. **No microphone** (permission refused, no device, or the listener failed to load): listen-only
   mode, with LESSON.md's "No microphone?" line.

Reading a take (`kit/take.ts`, pure, unit-tested):

- Input: the take's raw frames and Merc's MIDI note. Voiced frames come from Voice Mirror's
  `preprocess` (confidence floor and median filter; FACTS 57).
- Drop the first 0.3 s after voicing starts (the attack). A take with fewer than 0.6 s of voiced
  frames left is not steady: it gives "We didn't hear a steady note that time", never a low reading
  (REQ-GVC-031).
- The deviation d is the median of `foldCents(cents − target)` over the kept frames, signed,
  between −600 and +600 cents; the octave count comes from the median of the unfolded difference,
  rounded to whole octaves.
- The line by |d|: 15 or less, "Right in the middle"; 35 or less, "In the band"; 60 or less,
  "Close", with "Listen again, then aim a touch lower" (or higher, for a note below); beyond 60,
  the direction and the size in semitones ("about a semitone" up to 150 cents, then "about N
  semitones"), always with "nearer a different note". The octave line ("You sang it an octave
  lower: same note") is added only when |d| is 50 or less, where the nearest note is still Merc's,
  so a different note is never called the same one (FACTS 39, 41).
- The edges come from Voice Mirror, not from copies: `HIT_TOLERANCE_CENTS` is exported already, and
  the 15 and 60 inside `matchBand` (`src/lib/mirror/metrics.ts:253-258`) become exports beside it.
  A unit test checks that, on steady synthetic takes within 60 cents, the page's band matches
  `scoreMatchTake`'s.
- Every feedback template passes `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts`,
  surface `finding`) in a unit test.

Counting the notes (`kit/take.ts` too):

- Each note counts by its last steady take, so the count shows where each note ended: a later
  steady take replaces an earlier one, and a take that was not steady replaces nothing.
- A note with no steady take is left out, never counted as a miss: "This time, 1 of the 2 notes we
  heard landed in the band." With all three heard, "This time, 2 of your 3 notes landed in the
  band." With none, there is no count, only "We didn't hear a steady note this time." (REQ-GVC-031,
  REQ-GVC-041).
- Rule 15's line ("If that felt tricky, good: that's learning.") follows a count only when fewer
  than all the heard notes landed.

Listening (`kit/listen.ts`, loaded as its own chunk when Start is pressed):

- `micManager.acquire('lesson-03')`, and `release` when the last take ends (acquiring again for
  Again), on leaving the section, on `pagehide` and when the tab is hidden; `createF0Stream`
  (`src/lib/pitch-f0-stream.ts`: YIN only, no model weights, the `pitch-core` chunk; FACTS 57). The
  site already allows the microphone (FACTS 58).
- One AudioContext: a new `Sound.context()` in `kit/sound.ts` hands the stream the page's context,
  made in the sound gate's tap.
- A take opens 0.4 s after Merc's note ends, once its 0.34 s release has finished, so Merc's note
  never enters it (analysis capture runs with echo cancellation off). The page plays nothing while
  a take is open.
- Nothing is recorded or kept (no take recorder: REQ-GVC-004) and nothing leaves the device
  (REQ-GVC-003). No analytics except, once the Lesson telemetry track exists, at most a count-only
  "checkpoint finished" event, never cents or audio (REQ-GVC-090).

Accessibility and motion:

- The band state is words plus the mint edge, never colour alone (REQ-GVC-082). After each take
  the chart's text summary reads, for example, "Merc's note A3; your note 20 cents above it, in the
  band" (REQ-GVC-085).
- Start, Again, Next note, Done, the comfort buttons and the four feelings are real buttons of at
  least 44 px, in a keyboard order that follows the flow; Space never starts a take by itself
  (REQ-GVC-080).
- Under reduced motion the window never scrolls (the line draws across a fixed frame), the ring
  shows a number instead of breathing, and the Mercs skip their reactions (REQ-GVC-083).

Tests:

- Unit: the take reader on synthetic frames (12 cents above: "Right in the middle"; 20 above: "In
  the band"; 45 below: "Close"; 200
  below: "About two semitones below"; an octave below and 25 cents high: "In the band" with the
  octave line; an octave below and 55 cents high: "Close" with no octave line; an octave below and
  200 cents high: no octave line; 0.4 s of voice: no steady note); the count (three steady takes,
  two in the band: "2 of your 3"; one note with no steady take: "1 of the 2 notes we heard"; no
  steady take at all: no count; a later steady take replacing an earlier one, and an unsteady one
  replacing nothing); the three-try limit; the band-edge agreement; and the claims check.
- End to end, with the fake microphone's steady A3 (`src/e2e/helpers/tone-wav.ts`,
  `writeToneWav(220)`, `fakeMicArgs`): lower voice, A3 reads "Right in the middle", G3 "About two
  semitones above" and B3 "About two semitones below", only Next note follows a note's third try,
  and "Easy" shows "1 of your 3", Again and, in the Wrap, the Voice Mirror card with "Ten minutes,
  gently, most days"; higher voice, A4 adds the octave line and G4 does not. "Effortful" shows the
  count and no Again. "Uncomfortable" shows no count and no Again, and the Wrap's rest card with no
  "Ten minutes" line. "Just listen today" requests no microphone and leaves the same rest card.

### 8. Recall check and quick check

- The recall check at the top shows only when Lesson 2 is marked done (`Done.has(2)`,
  `kit/progress.ts`); anyone else sees LESSON.md's closed line, a `details` element that opens the
  same two questions. It asks Lesson 2's questions 2 and 4 word for word under `l02-q2` and `l02-q4`
  (FACTS 44), the first with its play button (A4 to B4, then B4 to C5; FACTS 46a), the only
  question on the page with a sound. Their "Try Lesson 2, Step N again" lines are plain links to
  Lesson 2's page (`/learn/02`), not `data-goto-step`; a link that opens Lesson 2 at that step is
  optional engineering (New engineering, 6). Options are reshuffled from a seed of its own and
  earlier answers are never shown, so the answers measure delayed retrieval (MASTER-PLAN § 9). It
  marks no lesson done.
- The quick check is the kit's quiz with LESSON.md's four questions, three answers each, shuffled
  per viewer from a stored seed, ids `l03-q1` to `l03-q4`, a check icon and ink (not gold) on the
  right answer, and feedback that links back to Steps 1, 4 and 5 (`data-goto-step`). The kit prints
  "Right." or "Not quite." before each feedback line (`kit/quiz.ts:167`), so no line starts with
  "Yes" or "Right". Finishing it marks Lesson 3 done.
- Storage keys, named as Lessons 1 and 2 name theirs: `fyp-l03-recall-seed` and `fyp-l03-recall-v1`
  for the recall, `fyp-l03-seed` and `fyp-l03-quiz-v1` for the quick check. Answers stay in
  localStorage until the Lesson telemetry track exists.
- Two quizzes on one page need the three changes to `kit/quiz.ts` that Lesson 2's spec lists (its
  "What the kit and the app still need"): a root element or id prefix, so two quizzes share a page;
  `lesson` optional, so the recall marks no lesson done; and a question `id` (`QuizQuestion` has
  none). The recall also needs the slot that spec adds after a question's heading, so question 2's
  Play the two steps stays out of its answers' names. Lesson 2's page brings them, and this page
  publishes after it.

### 9. Go deeper

- A `details` drawer, closed by default, under Step 3's toy: beats (FACTS 49), heard with toy 4's
  Play together.

## Audio

Every tone is synthesised in the page through `kit/sound.ts` at the frequencies in FACTS 43, with
the house envelope rules, started only by a tap. Merc's notes use the kit's "ooh" (vibrato 5.5 Hz,
±14 cents; FACTS 40), which the band chart draws as a steady line at the note's centre (Toys, 6);
the slider match uses the kit's steady soft tone. Nothing autoplays, there is no music bed, and
nothing plays while a take is open.

## Mercs

Lesson 1's setup (`kit/merc-duo.ts`, `kit/merc-warm.ts`): the app's renderer, loaded after first
paint, one WebGL context each, stills when WebGL fails or would run on the CPU. Reactions: blue
sings A3, G3 and B3 for the lower voice, orange sings A4, G4 and B4 for the higher; the other Merc
`listen`s; both `listen` while the viewer sings; the singing Merc `celebrate`s once for a note's
first take in the band (no sparkles), and never after "Effortful" or "Uncomfortable". Under reduced
motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practise link: what exists and what needs engineering

- **Today: Voice Mirror**, `mercurypitch.com/mirror?lesson=03` (`season.ts` already carries it).
  It counts any octave, and its "hit" band is this lesson's 35 cents (FACTS 41, 51). It is its own
  document, so a first-time visitor meets no First Light (FACTS 53). The `?lesson=` marker records
  nothing until CURRICULUM § 4 item 6 ships. The card comes in two versions, picked by how the
  checkpoint ended (Toys, 7), and both link the same address.
- **App content, small:**
  - Voice Mirror's first glide says "to your highest"; "to your highest comfortable note" would
    match the playbook's range rule (REQ-GVC-072) and the lesson's "keep the glides comfortable"
    (FACTS 51).
  - Its results line adds, when three or more of the five notes land, "Your ear is ahead of your
    control, the good order" (`src/features/mirror/MirrorApp.tsx:2068-2072`). The task measured
    the voice, not the ear, so the sentence infers what was not measured (REQ-GVC-045), right after
    a lesson careful to say "most", never "all", about ears. Dropping the sentence would do.
- **Pitch Hold, needed before the lesson links it** (CURRICULUM § 4 items 1, 2, 6 and 7; FACTS 54
  to 56):
  1. A slug, proposed `/exercises/hold-a-note`, opening Pitch Hold on its setup screen.
  2. The `durationSec` launch field, so the slug sets one 5-second hold whatever timer the viewer
     saved, and one more field that CURRICULUM § 4 does not list yet (proposed `zoneCents`), for a
     fixed 35-cent zone in place of the ordinary one, which starts at ±50 and shrinks every 5
     seconds. Both mirror the app's reviewed guided dose (three 5-second holds in a fixed 35-cent
     zone), and the controller already takes a fixed zone and a fixed length (`fixedZoneCents`,
     `fixedTargetDurationSeconds`). The vocal coach confirms the length.
  3. The octave-folded scoring option, or the written-octave sentence in LESSON.md's editorial
     note. Until one ships, the lesson says "any octave counts" only about Voice Mirror.
  4. App content: the card's "How long can you stay locked in?" and its "Endurance" tag, and the
     help's "You are scored on how long you stay inside the target zone", invite the longest hold,
     which the playbook rules out. A slug opens past the card, but the library still shows it.
  5. The `?lesson=03` marker, because a slug boots the main app, where First Light opens on a first
     visit.
- When the slug ships, LESSON.md's editorial note gives the copy, and the explorer card's note
  changes from "Pitch Hold still needs a slug" to the link.

## New engineering, in one list

1. The lesson host: `learn/03.html` at `/learn/03`, wired the way `/learn/01` is (`vite.config.ts`,
   the worker and service worker, the sitemap, `llms.txt`), with `src/features/lessons/lesson-03/`.
2. Kit parts: `band-chart.ts`, `listen.ts`, `take.ts` (the reading and the count), `comfort.ts`
   and `Sound.context()` (Toys, 6 and 7); and, if Lesson 2 has not done it, the predict widget,
   string toy, dial and loudness toy promoted with their options.
3. Two exports in `src/lib/mirror/metrics.ts`: the 15- and 60-cent band edges.
4. The explorer, beyond the changes Lesson 2's spec lists (the current lesson, links to a lesson's
   own page, a poster per lesson): a state for a lesson with a page and no film, whose card offers
   "Read the lesson" (`/learn/03`) without "Watch the episode" (`kit/explorer.ts` knows only done,
   ready and planned, and a ready card's buttons are same-page anchors); and Lesson 3's `len` in
   `season.ts`, "15 minutes" (FACTS 61).
5. The quiz: Lesson 2's three changes to `kit/quiz.ts` and its slot for a question's own controls
   (Toys, 8), if its page has not shipped them, and the recall's rule of showing only after
   Lesson 2.
6. Optional: links that open Lesson 2 at a step (proposed `/learn/02#step-3`), which needs Lesson
   2's step deck to read the address when it opens (`kit/step-deck.ts` has no such hook today);
   until then the recall links the page.
7. The tests in Toys 7 and the page QA below.
8. For the Pitch Hold link: the slug, `durationSec`, a zone field and the octave-folded option
   (Practise link).

## Contract and page QA

Lesson 1's contract, unchanged and binding, with its changes for the app (Lesson 1 WEB-SPEC, "On
the app"): no CDN, self-hosted fonts, Web Animations in place of GSAP, practise links carrying
`?lesson=03`, 16 px gutters, no sideways scroll at 390 px, touch targets of at least 44 px, visible
focus, a single dark theme with every colour a token, sound only after a tap, localStorage only for
per-viewer conveniences inside try/catch, and the whole page usable with no sound, no WebGL, no
storage and no microphone. The checkpoint stores nothing but the voice choice (`fyp-voice`) and
the warm-up's Skip (`fyp-l03-warmup`): no take, no reading and no answer to "How did that feel?".

Page QA before publishing (PRODUCTION-PIPELINE § 5) adds, for this page:

- The microphone is requested only by Start; "Just listen today" and a refused permission never
  open it; the browser's microphone indicator goes off when the last take ends, on leaving the page
  and when the tab is hidden.
- The network panel shows nothing sent while the microphone is open, and the checkpoint leaves
  nothing in storage but the voice choice and the Skip.
- The whole checkpoint runs by keyboard alone, and a screen reader hears every state and reading.
- With reduced motion emulated, nothing moves on its own and the live line draws on a still frame.
- The Wrap shows the rest card after "Uncomfortable" and after "Just listen today", and the Voice
  Mirror card otherwise.
- The app-check sweep at phone and desktop width, with the checkpoint open in each state.
