# Lesson 4 web page: spec

The Lesson 4 page is the web lesson for "The major scale and home": written steps, one main toy
in five states and a compact one, two predicts, an unscored sing-along, two quizzes (the recall
and the quick check) and the lesson explorer. Copy is in [LESSON.md](LESSON.md); every claim is in
[FACTS.md](FACTS.md). It is a text-only package: no film exists for Lesson 4, so the page has no
Watch section and the masthead's anchors are Lesson and Explorer. It is the third page built on
the kit (`src/features/lessons/kit/`), and like Lesson 2's it reuses and never copies: a part that
still lives in Lesson 1's module (`src/features/lessons/lesson-01/`), or that Lesson 2 plans to
promote (its [WEB-SPEC](../02-twelve-notes/WEB-SPEC.md), in build), moves into the kit first.

Its public home is `mercurypitch.com/learn/04` (MASTER-PLAN § 12 item 9): a hand-written document
`learn/04.html` with its module in `src/features/lessons/lesson-04/`, wired as Lesson 1's page is.
"What the kit and the app still need", below, lists that wiring and every kit change.

## Look

Lessons 1 and 2's look, unchanged: the dark listening room, the series colour code, Lesson 1's
type and wordmark, and the motion rules. On this page:

- Gold `#ffd84d` marks only the staircase's two semitone steps, in steps 1 and 2: the lesson's key
  relationship, as Lesson 2 lit B–C and E–F gold.
- Do, home, is marked by a house glyph (an SVG icon) and its label, never by a colour. The
  pitch-canvas set's tonic butter `#ffdf80` sits too close to gold to carry a second meaning on
  one page, so this page does not use it.
- Blue `#58a6ff` lights the stairs blue Merc sings and orange `#ff7448` those orange Merc sings;
  chrome is every other note.
- The contrast case, step 3's white keys from D (orange's guess), is dashed ink-2 `#a8b3bf` with a
  "?", as in Lesson 2's film (MASTER-PLAN § 5), because the scale guide uses the app's canvas set,
  in which violet is the singer.
- The scale guide (Sing it) takes the app's canvas colours, target amber `#f59e0b` for Merc's
  path, while Merc's scale plays. On the viewer's turn it turns plain chrome, as Lesson 2's guide
  does (its DECISIONS 68).

Two things move on their own: the Merc idle loops. Under `prefers-reduced-motion` they always stop,
and every transition this page adds (a slide, Group, the white-keys overlay, the names changing,
the arrow from ti, the guide's sweeping line) lands in its end state with no travel; what the
viewer starts still sounds. For everyone else the masthead's Pause animations toggle stops the
same two (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Lesson 2's departures kept: the step toys double as the
Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the
practice card sits in the Wrap. One more departure: no Watch section (§ 4.2 item 10), because the
package has no film. Each section's heading, and the line above it, are in LESSON.md ("Section
headings").

1. **Masthead**: Lesson 1's (wordmark, "Season 1 · Lesson 04", anchors Lesson and Explorer, the
   Sound toggle off by default, Pause animations with its reduced-motion lock). `initMasthead`
   takes any map of anchors, and the page's lesson and step deck for the lesson menu
   (`{ lesson: 4, deck }`), so dropping Watch needs no kit change (`kit/page-chrome.ts`).
2. **Hero**: kicker; the hook question as the title; the meta as three chips (10 minutes; "After
   Lesson 2: Twelve notes", the prerequisite chip, a link to `/learn/02`; Sound on); the promise;
   the sound gate from LESSON.md, in the hero copy as Lesson 1's is; the two Mercs live on the
   floor line either side of the staircase, shown on C with do marked home, and its Play button
   (`scale-c`, FACTS 57).
3. **Cold open: predict**: the bubbles, each with its Merc's still, and beside them the compact
   staircase (Toys 1), so the sound and the stairs are on screen together (playbook rule 10). Play
   from C and its Land on do work from the start; orange's and blue's lines from LESSON.md; the
   two-choice predict; choosing unlocks Play from D, which slides the compact staircase to D,
   announced "Major scale from D", before it plays. The reveal appears after Play from D has
   sounded; with sound off, LESSON.md's hint shows and the reveal waits. The live Mercs stay in the
   hero (Mercs, below).
4. **Recall from Lesson 2**: Lesson 2's questions 1 and 3 (Toys 5), straight after the cold
   open, as on Lesson 2's page (MASTER-PLAN § 4.2, decided 20 October 2026).
5. **Four words you'll meet**: scale, tonic, scale degree and solfège, each with its definition, a
   small figure and a play button (Toys 3).
6. **The steps**: Lesson 1's sticky stage and step deck ("N of 5", Previous and Next, the stage
   beside the text on desktop and above it on phones), every step on the one staircase
   (`toyFor: () => 1`), in five states (Toys 1):
   1. Count the steps: on C, step sizes labelled, the two semitones lit gold.
   2. Two groups and a joint: Group.
   3. Start anywhere: orange's line, the second predict, then Slide and White keys only; the
      mix-up card.
   4. Name the stairs: the names switch.
   5. Ti leans home: Stop on ti and Land on do; the Go deeper drawer under the text (Toys 6).
7. **Sing it**: the scale guide (Toys 4) with Merc's scale, the octave-up scale, the guide and
   Move do, and LESSON.md's lines in its order; nothing listens.
8. **Quick check**: LESSON.md's four questions (Toys 5).
9. **Wrap**: the three recap lines, the challenge, the practice card and the kit's next-lesson card
   (`kit/next-card.ts`): Lesson 5's hook and "Start lesson" to its page, or "Coming later" and the
   explorer where a build hides it. The practice card is Lesson 2's app card with LESSON.md's
   eyebrow, title, text, address, second drill and figure: Scale Runner today and Ear Lab Home. Its
   addresses link `/pitch-training?lesson=04` and `/ear-lab?lesson=04` in a new tab, so neither
   meets First Light (Practice links). Free play unlocks here: every staircase control on one stage
   (playbook rule 17: guided first, free play after).
10. **Lesson explorer**: the kit's, with Lesson 4 as the current node, the line under its heading
    from LESSON.md, and the state for a lesson with a page and no film (What the kit and the app
    still need).
11. **Footer**: Lesson 1's, with "Season 1 · Lesson 04 · The major scale and home"; the practice
    link, printed `mercurypitch.com/pitch-training` and linking `/pitch-training?lesson=04`, with
    "Scale Runner is free: tap it in the exercises"; and the credits: Lesson 1's fonts line and
    "Every sound on this page is synthesised in your browser" (FACTS 33a). With no film there are
    no voices to credit.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                                                                                                                                | New in Lesson 4                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The staircase          | The kit's sound (`kit/sound.ts`: `playTone`, the soft tone, Merc's "ooh"), notes (`kit/notes.ts`: `hz`, `COLOR`), frame loop and step deck (`kit/frame-loop.ts`, `kit/step-deck.ts`); Lesson 1's keyboard drawing and its canvas-as-slider keys, now in the kit (`kit/spiral-keys.ts`, `kit/spiral.ts`); the staircase draws using `kit/key-strip.ts` | Stairs on semitone rows; the compact state; Group; Slide; White keys only; the names switch; Stop on ti and Land on do; a spelling helper; a house icon |
| 2. Predict widgets        | Lesson 1's predict, now in the kit (`kit/predict.ts`; Lesson 2's Toys 7)                                                                                                                                                                                                                                                                              | A play button that works before the choice (Play from C) beside one that unlocks after it                                                               |
| 3. Four words             | Lesson 1's strip of figure, word, definition and play button (`lesson-01/words.ts`)                                                                                                                                                                                                                                                                   | Four new figures                                                                                                                                        |
| 4. Scale guide (Sing it)  | Lesson 2's slide guide (its Toys 5, in build) and Lesson 1's breathing ring (`lesson-01/sing.ts`)                                                                                                                                                                                                                                                     | Thirteen rows instead of four, a 17-note path, a count-in on do, Move do                                                                                |
| 5. Recall and quick check | The kit's quiz (`kit/quiz.ts`) with the three changes Lesson 2 makes to it, and Lesson 2's questions                                                                                                                                                                                                                                                  | Nothing more, once Lesson 2's changes land                                                                                                              |
| 6. Go deeper drawer       | Lesson 2's `details` drawer (its Toys 8)                                                                                                                                                                                                                                                                                                              | Three items                                                                                                                                             |

### 1. The staircase

One component in five states, and a compact one for the cold open, so the object the lesson
transforms is one object on the page.

- **Drawing.** Pitch is height (playbook rule 20). Eight stairs, do to do, run left to right, each
  at its height in semitones above do (0, 2, 4, 5, 7, 9, 11, 12), on faint semitone rows, the
  app's piano-roll way of drawing pitch. Each step rises one row (a semitone, labelled "S") or two
  (a tone, "T"). Each stair carries its name in the current names mode, and do's stairs carry the
  house glyph. Below the staircase sits the keyboard strip, Lesson 1's drawing set to C4 to C6,
  with the scale's eight keys lit and a hairline from each stair to its key. Each stair's tap area
  is at least 44 px square.
- **Compact** (cold open): the same stairs, smaller, with do-re-mi names only: no letters, no T
  and S labels, no keyboard strip and no readout. It draws fifteen rows, C4 to D5, so both starts
  fit without rescaling. The stairs light as Merc sings them; Stop on ti leaves the top stair an
  outline with the arrow up from ti, and Land on do fills it. Its stairs are not buttons (the
  bubbles' buttons carry every action), so the drawing is `aria-hidden` and a polite live region
  speaks for it: "Major scale from C" or "Major scale from D" as each starts, then "Stopped on ti.
  Landing on do finishes the scale." Play from D slides it up two rows first.
- **One action per tap.** A tap on a stair plays its note in the soft tone, in every state but the
  compact one. A tap on a key of the strip plays that key in steps 1 and 2; from step 3 on, and in
  free play, it makes that key do instead. A pointer that moves more than 6 px before it lifts is a
  drag, not a tap, as on Lesson 1's spiral (`kit/spiral.ts:421`).
- **Play up** and **Play down** (FACTS 57) light each stair and key as it sounds; **Slow** doubles
  every length (MASTER-PLAN § 4.2 item 5).
- **Step sizes** (step 1): the T and S labels show, and the two semitone steps light gold once
  after Play up.
- **Group** (step 2): brackets over the first four stairs and the last four, each labelled
  "T T S", and the joining step labelled "T"; tapping a bracket plays its four notes, and the two
  brackets flash in turn.
- **Slide** (steps 3 to 5, and free play): Start lower and Start higher (a semitone each), a tap on
  a key of the strip, or, with a mouse or pen, a vertical drag on the staircase; starts run from C4
  to B4. On touch the stage keeps `touch-action: pan-y`, as Lesson 1's does
  (`kit/lesson-stage.css:769-776`), so a vertical swipe still scrolls the page, and the buttons
  and keys do the sliding. A slide is silent: Play up plays the scale from its new start. The
  staircase keeps its shape: only its height, its letters and the lit keys change. On desktop the
  stage shows all twenty-five rows from C4 to C6, so the climb is visible; on a phone it shows the
  scale's own thirteen rows with a pitch ruler at the left that scrolls with it, and the strip
  shows the scale's octave at full width and pans with it. A readout names the scale and counts
  its black keys, "D major · 2 black keys: F♯, C♯" (FACTS 10, 12). Letters follow each scale's
  own spelling, one letter per step (FACTS 13), and the strip's keys take that spelling too (B♭ in
  F major, A♯ in F♯ major):

  | Start | Spelled               | Start | Spelled                |
  | ----- | --------------------- | ----- | ---------------------- |
  | C     | C D E F G A B C       | F♯    | F♯ G♯ A♯ B C♯ D♯ E♯ F♯ |
  | D♭    | D♭ E♭ F G♭ A♭ B♭ C D♭ | G     | G A B C D E F♯ G       |
  | D     | D E F♯ G A B C♯ D     | A♭    | A♭ B♭ C D♭ E♭ F G A♭   |
  | E♭    | E♭ F G A♭ B♭ C D E♭   | A     | A B C♯ D E F♯ G♯ A     |
  | E     | E F♯ G♯ A B C♯ D♯ E   | B♭    | B♭ C D E♭ F G A B♭     |
  | F     | F G A B♭ C D E F      | B     | B C♯ D♯ E F♯ G♯ A♯ B   |

  In F♯ major the strip's white key F reads E♯, the only white key any start renames. The kit's
  `letterOf` and `nameOf` know only the seven letters (`kit/notes.ts:45-70`), so a small spelling
  helper is new; Lesson 2's two-names toggle may land one first. On main it is the kit's (`spellOn`,
  `sharpOf`, `flatOf`, `kit/notes.ts:151-163`).

- **White keys only** (step 3): from the current start, the white keys up an octave, drawn over
  the real staircase as a dashed ink-2 staircase with a "?", the steps where it leaves the pattern
  marked, and played (FACTS 60). From D it reads "T S T T T S T". From C it lies exactly on the
  real staircase with no step marked, and a note reads "On C, the white keys are the major scale"
  (FACTS 6, 12). From E, F, G, A and B the step orders are in FACTS 11a. The overlay follows a
  slide. A black-key start (D♭, E♭, F♯, A♭, B♭) is not a white key, so there the button is off
  (`aria-disabled="true"`, still focusable) with the hint "Start on a white key to compare", and
  an overlay already showing goes. Pressing the button again removes it.
- **Names switch** (step 4, and free play): Letters · Numbers · Do-re-mi, a segmented control of
  buttons with `aria-pressed`. Numbers run 1 to 7, then 1 at the top (FACTS 18); do-re-mi runs do
  re mi fa so la ti do, with a small note under the switch, "Many books write so as sol" (FACTS
  20).
- **Stop on ti** and **Land on do** (cold open, step 5, quiz question 3): Stop on ti plays up to
  ti and holds it (FACTS 58, 59), leaving the top stair an outline with an arrow up from ti; Land
  on do plays ti, then do, and the top stair fills, its house glyph lit.
- **Predict** (step 3): after orange's line, Toys 2's widget with two choices; choosing unlocks
  Play white keys from D and Play the pattern from D, each sliding the staircase to D first; with
  sound off, LESSON.md's hint shows and the reveal waits; the reveal never calls a choice wrong.
- **The house glyph** is a new symbol, `#i-home`, in the page's inline icon sprite (Lesson 1's
  sprite, `learn/01.html:139-235`, has no house). The glyph itself is `aria-hidden`; do's stair
  buttons say it instead ("Stair 1, do, D 4, home").
- **Keyboard and screen readers.** The staircase is a group whose live summary names the scale,
  its notes and its steps: "D major: D, E, F sharp, G, A, B, C sharp, D. Tone, tone, semitone,
  tone, tone, tone, semitone." Each stair is a button ("Stair 3, mi, F sharp 4"; in F♯ major,
  "Stair 7, ti, E sharp 5"). The start is a slider (`role="slider"`, C4 to B4, `aria-valuetext`
  such as "Do is D4: D major, two black keys"): arrow keys move it a semitone, and Home and End
  jump to C and B. The overlay announces "White keys from D: tone, semitone, tone, tone, tone,
  semitone, tone. Not a major scale." Stop on ti announces "Stopped on ti, C sharp 5. Landing on do
  finishes the scale."
- Under reduced motion every move (a slide, Group, the overlay, the names changing, the arrow)
  lands in its end state at once; a played scale still sounds and lights its stairs in turn.

### 2. Predict widgets

- Both are Lesson 1's widget: the choice locks, the play buttons unlock, the reveal plays after
  the sound and never calls a choice wrong; two choices each, every button at least 44 px tall.
- New: the cold open's Play from C (with its Land on do) works before the choice, because
  orange's line answers it; only Play from D waits for the choice, and the reveal waits for Play
  from D. With sound off the reveal waits too, and the hint says so (Lesson 1's rule: the reveal
  describes what was heard).

### 3. Four words

Lesson 1's strip: a three-stair staircase for scale, one stair with the house glyph for tonic,
three numbered stairs for scale degree and three syllable chips for solfège, each with its play
button (FACTS 61).

### 4. Scale guide (Sing it)

- Lesson 2's slide guide, grown to thirteen rows from do to do, in the app's canvas style: the
  eight scale rows labelled with do-re-mi and the letters of the scale last played, in its octave
  (D3 to D4 after Merc's scale, D4 to D5 after the octave-up one, moved by Move do), the other five
  faint. Until a scale has played the rows show Merc's scale, D3 to D4. Merc's model is an amber
  target path (FACTS 63): up to so and back, a rest, up to ti, a 2 s hold on ti, then do.
- **Play Merc's scale** (do = D3) and **Play it an octave up** (do = D4) sing in Merc's "ooh". The
  path lights in step as each plays, while the breathing ring beside the guide shows the still of
  the Merc singing it, blue for D3 and orange for D4, as Lesson 1's ring does
  (`kit/sing.ts:243-249`).
- **Start the guide** is enabled once either scale has played (hear it first: playbook rule 16);
  until then it is `aria-disabled`, with the hint "Play Merc's scale first". It is the viewer's
  turn, so nothing of the app's drawing stays, as in Lesson 2 (its DECISIONS 68): the amber goes,
  the rows turn plain chrome and Merc's path is drawn dashed in chrome. The count-in sounds do of
  the scale last played, once and softly, for its one second (FACTS 63). Then a vertical chrome
  line sweeps across the rows along the path for 18.2 s, with nothing riding the path itself;
  during the hold on ti the ring breathes with the still of the Merc last heard at its centre,
  never a microphone icon. When the sweep ends, the rows go back to their amber rest.
- **Move do** shifts do a semitone lower or higher, up to four either way (FACTS 52, 63): the rows
  relabel and the path keeps its shape, movable do at work. Both scales and the count-in follow it.
- The card follows LESSON.md's order: the comfort line, Your turn, the stop line, the buttons, the
  guide's note, and the doctor lines in small type at the foot. The stop line is in that one place,
  above the buttons.
- Nothing listens and nothing is scored: there is no microphone on this page. Under reduced motion
  the path's notes light one after another instead of the travelling line.

### 5. Recall and quick check

Two quizzes share this page, so it depends on the three changes Lesson 2 makes to `kit/quiz.ts`
(its WEB-SPEC, "What the kit and the app still need"):

- a root element or id prefix, because the kit bound to `#qs`, `#scoreN` and `#quizReset` and
  wrote the ids `q0` and `fb0` onwards;
- `lesson` optional, because the kit marked `lesson` done once every question had an answer;
- a question `id`, the telemetry's `question_id`, which `QuizQuestion` lacked.

If Lesson 2's page has not landed them when this one is built, this page lands them, in the shape
Lesson 2 describes. All three are on main: the id `prefix` (`kit/quiz.ts:78-83`, `:195-199`), an
optional `lesson` (`:72-73`, `:295-300`) and the question `id` (`:40-44`).

- **Recall**: Lesson 2's questions 1 and 3, word for word with their feedback (LESSON.md; FACTS
  30), under their Lesson 2 ids, `l02-q1` and `l02-q3`. It is reshuffled from a seed of its own
  (keys `fyp-l04-recall-seed` and `fyp-l04-recall-v1`), and earlier answers are never shown, so
  the answers measure delayed retrieval (MASTER-PLAN § 9). It takes no `lesson`, so it marks
  nothing done. Neither question plays a sound (FACTS 62). "Try Lesson 2, Step 2 again" and "Try
  Lesson 2, Step 5 again" are plain links to Lesson 2's steps, `/learn/02#lesson`, opening in a new tab so the
  viewer keeps their place here; never `data-goto-step`, which would move this page's own deck. On
  the public host each answer is a telemetry event with its `visit_index`.
- **Quick check**: LESSON.md's four questions, ids `l04-q1` to `l04-q4`, keys `fyp-l04-seed` and
  `fyp-l04-quiz-v1`, and `lesson: 4`, so answering all four marks Lesson 4 done in the explorer.
  Three answers each, shuffled per question from the stored seed, one-line feedback for every
  answer, and a check icon and ink (not gold) on the right one. Question 3's play button plays
  `stop-c` (FACTS 58). The kit rebuilds the questions on every answer (`kit/quiz.ts:272-274`), so
  that button is handled by a listener on the quiz's root (`#qs` today), as the step links are.
  "Try Step 1 again" and "Try Step 3 again" use the kit's `data-goto-step`. Answers stay in the
  viewer's browser until the telemetry track exists.

### 6. Go deeper drawer

A `details` disclosure, closed by default, under step 5's text, holding LESSON.md's three items.

## Audio

Every tone is synthesised in the page with Web Audio at the frequencies in FACTS 56 and 56a,
through the kit's sound module and its house envelopes
(`.claude/memory/audio-pop-free-playback.md`), and started only by a tap: taps in the soft tone,
Merc's singing in Merc's "ooh", and the guide's count-in in the soft tone at half a tap's level
(FACTS, Sounds). Nothing autoplays, and the page has no music bed.

## Mercs

Lesson 1's setup through the kit (`kit/merc-duo.ts`, `kit/merc-warm.ts`): the app's renderer
loaded after first paint, one WebGL context per Merc, medium quality on phones, turned towards each
other, paused off screen (`merc-duo.ts:43-53`), and the still images when WebGL fails or would run
on the CPU.

- They live in the hero, and their reactions are the hero pair's: blue `sing` while the hero's
  Play sounds; in the cold open, blue `sing` while Play from C sounds and orange `sing` while Play
  from D sounds; and orange `celebrate` once after the cold-open reveal (no sparkles).
- The cold open sits below the hero, so the live pair is often off screen and paused while it
  plays. The bubbles carry each Merc's still, and the compact staircase carries the moment.
- `merc-duo.ts` has `mercSing` and `mercCelebrate` (`:164`, `:216`), and `mercListen` (`:206`)
  since Lesson 3's page; this page asks for no other state: the Merc who is not singing idles.
- In Sing it, far below the hero, the ring shows the still of the Merc singing (Toys 4), so the
  live pair needs nothing more.
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Scale Runner.** `mercurypitch.com/pitch-training` opens the Exercises tab (FACTS 35);
  the viewer taps Scale Runner, which opens on Major and Ascending (FACTS 37), at the viewer's
  stored pace (difficulty 5 unless the app has moved it, FACTS 42), starting from the saved voice
  range (FACTS 41). It scores each note against the octave it plays (FACTS 40), so the copy says
  so and sends the viewer to Settings, Singing Voice Range, first. The link is
  `/pitch-training?lesson=04`, and the `?lesson=` marker lets First Light, the main app's intro,
  step aside on a first visit (FACTS 35b), so the card carries no first-visit line (the series' old
  line, FACTS 35a, went when the marker shipped).
- **Today, Ear Lab Home.** `mercurypitch.com/ear-lab`, then tap Home (FACTS 46, 47); on the public
  host `/ear-lab?lesson=04`.
- **Needed: a data-only slug** (CURRICULUM § 4 item 1, the Phase 1 App track): `slow-scales`
  (proposed; the name pairs with `speed-scales`), registered in `EXERCISE_SLUGS`
  (`src/features/exercises/slug-map.ts`) as
  `{ kind: 'exercise', exercise: EXERCISE_SCALE_RUNNER, difficulty: 2 }`, with a line in
  `src/tests/slug-map.test.ts`.
  - Leave out the `scaleId: 'scale-major-c4'` that the CURRICULUM card names. A slug's notes only
    set the start note, and range-fitted `scale-major-c4` starts sopranos on C5 and tenors on C4,
    each run ending on its preset's top note. With no notes, Scale Runner starts on each preset's
    anchor, a fourth or so above the bottom of the range, so every run's top note sits seven to
    nine semitones under the top (FACTS 44). Major and Ascending are already Scale Runner's
    defaults, so this lesson needs no scale-type field (CURRICULUM § 4 item 2 keeps it for later).
  - Difficulty 2 gives each note 868 ms, then a 310 ms gap and a 2.48 s window to sing, against
    700 ms, 250 ms and 2 s at the default (FACTS 42). The code labels levels 1 and 2 "Beginner",
    and level 1 is a little slower again; the director picks. The pace holds for every run until
    the viewer leaves Scale Runner (FACTS 45).
  - Nothing else: the worker already serves any `/exercises/<slug>` path, and its routing test
    walks the registry (FACTS 43). The link should carry `?lesson=04`, so First Light steps aside
    (FACTS 35b).
- **Still open: the octave** (CURRICULUM § 4 item 7). Scale Runner scores the written octave, and a
  visitor who never set a range is fitted as a tenor (FACTS 41), so a soprano who skips Settings
  is scored against a low octave. Until the octave-folded option exists, the copy's sentence about
  Settings is the only remedy; when the option ships, the sentence can go. Scale Runner belongs on
  item 7's list beside Pitch Hold.
- When the slug ships, the Wrap, the footer and the explorer card switch to
  `mercurypitch.com/exercises/slow-scales` (LESSON.md's editorial note).

## What the kit and the app still need

Found in the kit and the app as they stand (18 October 2026), beyond the parts Lesson 2 promotes
into the kit (Toys table). The page is on main at `/learn/04`. Read again on main at `31b7f53e9`
(20 October 2026): an item with a line reference says what main has, and its references are
main's.

- `kit/quiz.ts`: Lesson 2's three changes, which this page's two quizzes need (Toys 5), on main.
- `kit/explorer.ts`, shared with Lesson 3 and worded as its WEB-SPEC words it ("New engineering,
  in one list", item 4), with this page's address: an explorer state for a lesson with a page and
  no film: its card offers "Read the lesson" (`/learn/04`) without "Watch the episode" and shows
  "10 minutes" (`kit/explorer.ts` knows only done, ready and planned). One optional field on
  `Lesson` serves both lessons, added by whichever page ships first; the card's status line,
  "Ready · watch and read" on 18 October, then reads "Ready · read", and the phone list and the
  graph read the same field. On main the chip reads "Ready · read" unless the lesson's film is
  published (`kit/explorer.ts:74-81`).
- `kit/explorer.ts`, the current lesson: it selected Lesson 1 when it opened (`let sel = 1`).
  Lesson 2's page added the option, `current` (`kit/explorer.ts:38-40`, `:180-181`), and this page
  passes 4 (`lesson-04/main.ts:94`).
- `kit/explorer.ts`, links between pages: a ready card's actions were the same-page anchors
  `#watch` and `#lesson`, right only for the page's own lesson, so a card for another ready lesson
  links to that lesson's page, `/learn/NN` (Lesson 2 lists the same gap). On main it does
  (`cardActions`, `kit/explorer.ts:111-127`).
- `kit/season.ts`, Lesson 4's entry: the practice link, `href` `/pitch-training?lesson=04`,
  `addr` `mercurypitch.com/pitch-training`, `label` "Exercises" and `note` "then tap Scale
  Runner", which the card prints as "Exercises, then tap Scale Runner" after the address
  (`practiseMarkup`, `kit/explorer.ts:98-103`). It keeps its `needs` until the slug ships. Its
  `sig` becomes "A staircase with two short steps that slides to start on any note.", since "two
  uneven steps" did not say which. On main the entry reads so (`kit/season.ts:219-239`).
- `kit/notes.ts`: the spelling helper (Toys 1).
- The icon sprite: `#i-home`, the house glyph (Toys 1).
- Lesson 2's slide guide, generalised to any number of rows and a path of any length, with the
  count-in on do (Toys 4).
- Lesson 1's predict widget, promoted into the kit if Lesson 2 has not done it (Toys 2).
- `vite.config.ts`: `/learn/04` served from `learn/04.html` in dev and preview, and `learn/04.html`
  as a build input. On main every `learn/NN.html` is both, with no entry of its own
  (`vite.config.ts:77-87`, `:139-141`, `:473`).
- `src/lib/sw-runtime.ts`: `/learn/04` and `/learn/04.html` in `STANDALONE_DOCUMENT_PATHS`, as
  `/learn/01` is (`sw-runtime.ts:131-135`), so the service worker leaves the lesson alone. On main
  they are there (`:138-139`).
- `public/sitemap.xml` and `public/llms.txt` (its "Lessons" list, as at `:72`): Lesson 4's entry, on
  main (`public/sitemap.xml:101`, `public/llms.txt:78-81`).
- `public/learn/lesson-04-og.jpg`: the share card, 1200 x 630. With no film to cut a frame from,
  it is a still of the hero: the title over the staircase on C, do's house glyph lit.
- The page's head, as Lesson 1's (`learn/01.html:9-60`):
  - title: "The major scale and home · Find Your Pitch, Lesson 4 | MercuryPitch";
  - meta description: "Why does do-re-mi sound finished when it lands on do, and restless when
    it stops on ti? A ten-minute lesson with live sound toys: the major scale's pattern of steps,
    starting it on any note, naming its notes do to ti, and hearing ti lean towards home. With the
    Season 1 map.";
  - canonical and `og:url`: `https://mercurypitch.com/learn/04`; `og:image`: the share card, with
    alt text naming what it shows.
- Lessons 1 and 2's pages, when this one goes live: nothing to edit in their explorers, which read
  each lesson's state from the season (`kit/season.ts`; LESSON.md, Section headings).

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=04`. Then the layout, accessibility, sound, motion and storage
rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children, touch
targets of at least 44 px, visible focus, a single dark theme with every colour a token and an
explicit body background, sound only after a tap, localStorage only for per-viewer conveniences
inside try/catch, and the whole page usable with no sound, no WebGL and no storage. Page QA
(PRODUCTION-PIPELINE § 5) adds two checks for this page: every stair, the start slider and the
names switch work by keyboard alone and announce what LESSON.md shows; and at 390 px the
staircase, its labels and the keyboard strip fit without overlap at every start from C4 to B4.
