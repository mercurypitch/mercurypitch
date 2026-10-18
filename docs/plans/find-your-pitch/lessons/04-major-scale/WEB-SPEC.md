# Lesson 4 web page: spec

The Lesson 4 page is the web lesson for "The major scale and home": written steps, one main toy
in five states, two predicts, an unscored sing-along, a quiz and the lesson explorer. Copy is in
[LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a text-only package: no film
exists for Lesson 4, so the page has no Watch section and the masthead's anchors are Lesson and
Explorer. It is the third page built on the kit (`src/features/lessons/kit/`), and like Lesson 2's
it reuses and never copies: a part that still lives in Lesson 1's module
(`src/features/lessons/lesson-01/`), or that Lesson 2 plans to promote (its
[WEB-SPEC](../02-twelve-notes/WEB-SPEC.md), in build), moves into the kit first.

Its public home is `mercurypitch.com/learn/04` (MASTER-PLAN § 12 item 9): a hand-written document
`learn/04.html` with its module in `src/features/lessons/lesson-04/`, wired as Lesson 1's page is
(`LESSON_01_PATH` and the `lesson01` build input, `vite.config.ts:78-133` and `:447-448`; an entry
in `public/sitemap.xml` and in `public/llms.txt`, as at `:66`).

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
- The scale guide (Sing it) takes the app's canvas colours: target amber `#f59e0b` for Merc's path.

Two things move on their own: the Merc idle loops. Under `prefers-reduced-motion` they always stop,
and every transition this page adds (a slide, Group, the white-keys overlay, the names changing,
the arrow from ti, the guide's sweeping line) lands in its end state with no travel; what the
viewer starts still sounds. For everyone else the masthead's Pause animations toggle stops the
same two (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Lesson 2's departures kept: the step toys double as the
Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the
practise card sits in the Wrap. One more departure: no Watch section (§ 4.2 item 10), because the
package has no film.

1. **Masthead**: Lesson 1's (wordmark, "Season 1 · Lesson 04", anchors Lesson and Explorer, the
   Sound toggle off by default, Pause animations with its reduced-motion lock). `initMasthead`
   takes any map of anchors, so dropping Watch needs no kit change (`kit/page-chrome.ts:71-109`).
2. **Hero**: kicker; the hook question as the title; chips for 10 minutes, After Lesson 2 and
   Sound on; a prerequisite chip linking `/learn/02`; the promise; the two Mercs on the floor line
   either side of the staircase, shown on C with do marked home.
3. **Recall from Lesson 2**: Toys 5.
4. **Cold open: predict**: a compact staircase (Toys 1 in its first state) beside the bubbles, so
   the sound and the stairs are on screen together (playbook rule 10). Play from C and its Land on
   do work from the start; orange's and blue's lines from LESSON.md; the two-choice predict;
   choosing unlocks Play from D, which slides the staircase to D before it plays; the reveal
   appears after Play from D has sounded; orange celebrates once.
5. **Four words you'll meet**: scale, tonic, scale degree and solfège, each with its definition, a
   small figure and a play button (Toys 3).
6. **The steps**: Lesson 1's sticky stage and step deck ("N of 5", Previous and Next, the stage
   beside the text on desktop and above it on phones), every step on the one staircase
   (`toyFor: () => 1`), in five states (Toys 1):
   1. Count the steps: on C, step sizes labelled, the two semitones lit gold.
   2. Two groups and a joint: Group.
   3. Start anywhere: the second predict, then Slide and White keys only; the mix-up card.
   4. Name the steps: the names switch.
   5. Ti leans home: Stop on ti and Land on do; the Go deeper drawer under the text (Toys 6).
7. **Sing it**: the scale guide (Toys 4) with Merc's scale, the octave-up scale, the guide and
   Move do; the safety lines in LESSON.md's order; nothing listens.
8. **Quick check**: the kit's quiz with LESSON.md's four questions, ids `l04-q1` to `l04-q4`
   (Toys 5).
9. **Wrap**: the three recap lines, the challenge, the practise card (Scale Runner today, and Ear
   Lab Home), and the next lesson's hook on a card that opens Lesson 5 in the explorer. Free play
   unlocks here: every staircase control on one stage (playbook rule 17: guided first, free play
   after).
10. **Lesson explorer**: the kit's, with Lesson 4 as the current node and two kit changes for a
    text-only lesson (Explorer and season data, below).
11. **Footer**: Lesson 1's, with the practise link (`mercurypitch.com/pitch-training`, carrying
    `?lesson=04` on the public host) and the credits: every example synthesised in the page,
    Merc's singing the kit's synthesised "ooh", and no film yet.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                                                                                                                                | New in Lesson 4                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1. The staircase          | The kit's sound (`kit/sound.ts`: `playTone`, the soft tone, Merc's "ooh"), notes (`kit/notes.ts`: `hz`, `COLOR`), frame loop and step deck (`kit/frame-loop.ts`, `kit/step-deck.ts`); Lesson 1's keyboard drawing (`lesson-01/toy-spiral-keys.ts`) and its canvas-as-slider keys (`lesson-01/toy-spiral.ts`), promoted into the kit as Lesson 2 plans | Stairs on semitone rows; Group; Slide; White keys only; the names switch; Stop on ti and Land on do; a spelling helper |
| 2. Predict widgets        | Lesson 1's predict (`lesson-01/predict.ts`), promoted into the kit as Lesson 2 plans (its Toys 7)                                                                                                                                                                                                                                                     | A play button that works before the choice (Play from C) beside one that unlocks after it                              |
| 3. Four words             | Lesson 1's strip of figure, word, definition and play button (`lesson-01/words.ts`)                                                                                                                                                                                                                                                                   | Four new figures                                                                                                       |
| 4. Scale guide (Sing it)  | Lesson 2's slide guide (its Toys 5, in build) and Lesson 1's breathing ring (`lesson-01/sing.ts`)                                                                                                                                                                                                                                                     | Thirteen rows instead of four, a 17-note path, Move do                                                                 |
| 5. Recall and quick check | The kit's quiz (`kit/quiz.ts`) and Lesson 2's questions                                                                                                                                                                                                                                                                                               | Question ids, once the Lesson telemetry track adds the field                                                           |
| 6. Go deeper drawer       | Lesson 2's `details` drawer (its Toys 8)                                                                                                                                                                                                                                                                                                              | Three items                                                                                                            |

### 1. The staircase

One component with five states, so the object the lesson transforms is one object on the page.

- **Drawing.** Pitch is height (playbook rule 20). Eight stairs, do to do, run left to right, each
  at its height in semitones above do (0, 2, 4, 5, 7, 9, 11, 12), on faint semitone rows, the
  app's piano-roll way of drawing pitch. Each step rises one row (a semitone, labelled "S") or two
  (a tone, "T"). Each stair carries its name in the current names mode. Below the staircase sits
  the keyboard strip, Lesson 1's drawing set to C4 to C6, with the scale's eight keys lit and a
  hairline from each stair to its key. Each stair's tap area is at least 44 px square.
- **Play up** and **Play down** (FACTS 57) light each stair and key as it sounds; **Slow** doubles
  every length (MASTER-PLAN § 4.2 item 5). Tapping a stair or a key plays it in the soft tone.
- **Step sizes** (step 1): the T and S labels show, and the two semitone steps light gold once
  after Play up.
- **Group** (step 2): brackets over the first four stairs and the last four, each labelled
  "T T S", and the joining step labelled "T"; tapping a bracket plays its four notes, and the two
  brackets flash in turn.
- **Slide** (steps 3 to 5, and free play): Start lower and Start higher (a semitone each), a
  vertical drag, or a tap on a key of the strip to make it do; starts run from C4 to B4. The
  staircase keeps its shape: only its height, its letters and the lit keys change. On desktop the
  stage shows all twenty-five rows from C4 to C6, so the climb is visible; on a phone it shows the
  scale's own thirteen rows with a pitch ruler at the left that scrolls with it, and the strip
  shows the scale's octave at full width and pans with it. A readout names the scale and counts
  its black keys, "D major · 2 black keys: F♯, C♯" (FACTS 10, 12). Letters follow each scale's own
  spelling, one letter per step (FACTS 13), and the strip's black keys take that spelling too (B♭
  in F major, A♯ in F♯ major):

  | Start | Spelled               | Start | Spelled                |
  | ----- | --------------------- | ----- | ---------------------- |
  | C     | C D E F G A B C       | F♯    | F♯ G♯ A♯ B C♯ D♯ E♯ F♯ |
  | D♭    | D♭ E♭ F G♭ A♭ B♭ C D♭ | G     | G A B C D E F♯ G       |
  | D     | D E F♯ G A B C♯ D     | A♭    | A♭ B♭ C D♭ E♭ F G A♭   |
  | E♭    | E♭ F G A♭ B♭ C D E♭   | A     | A B C♯ D E F♯ G♯ A     |
  | E     | E F♯ G♯ A B C♯ D♯ E   | B♭    | B♭ C D E♭ F G A B♭     |
  | F     | F G A B♭ C D E F      | B     | B C♯ D♯ E F♯ G♯ A♯ B   |

  The kit's `letterOf` and `nameOf` know only the seven letters (`kit/notes.ts:36-61`), so a small
  spelling helper is new; Lesson 2's two-names toggle may land one first.

- **White keys only** (step 3): from the current start, the white keys up an octave, drawn over
  the real staircase as a dashed ink-2 staircase with a "?", the steps where it leaves the pattern
  marked, and played (FACTS 60). From D it reads "T S T T T S T". Pressing again removes it.
- **Names switch** (step 4, and free play): Letters · Numbers · Do-re-mi, a segmented control of
  buttons with `aria-pressed`. Numbers run 1 to 7, then 1 at the top (FACTS 18); do-re-mi runs do
  re mi fa so la ti do, with a small note under the switch, "Many books write so as sol" (FACTS
  20).
- **Stop on ti** and **Land on do** (cold open, step 5, quiz question 3): Stop on ti plays up to
  ti and holds it (FACTS 58, 59), leaving the top stair an outline with an arrow up from ti; Land
  on do plays ti, then do, and the top stair fills, its house glyph lit.
- **Predict** (step 3): Toys 2's widget with two choices; choosing unlocks Play white keys from D
  and Play the pattern from D, each sliding the staircase to D first; the reveal (LESSON.md) never
  calls a choice wrong.
- **Keyboard and screen readers.** The staircase is a group whose live summary names the scale,
  its notes and its steps: "D major: D, E, F sharp, G, A, B, C sharp, D. Tone, tone, semitone,
  tone, tone, tone, semitone." Each stair is a button ("Stair 3, mi, F sharp 4"). The start is a
  slider (`role="slider"`, C4 to B4, `aria-valuetext` such as "Do is D4: D major, two black
  keys"): arrow keys move it a semitone, and Home and End jump to C and B. The overlay announces
  "White keys from D: tone, semitone, tone, tone, tone, semitone, tone. Not a major scale." Stop on
  ti announces "Stopped on ti, C sharp 5. Land on do finishes the scale."
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
  eight scale rows labelled with do-re-mi and the current letters, the other five faint. Merc's
  model is an amber target path (FACTS 63): up to so and back, a rest, up to ti, a 2 s hold on
  ti, then do.
- **Play Merc's scale** (do = D3) and **Play it an octave up** (do = D4) sing in Merc's "ooh",
  with blue or orange Merc singing beside the guide (state `sing`). **Start the guide** counts in
  for a second, then a vertical line sweeps across the rows along the path for 18.2 s, with
  nothing riding the path (Lesson 2's fix); during the hold on ti, Lesson 1's breathing ring waits
  at ti with Merc's still at its centre, never a microphone icon. **Move do** shifts do a semitone
  lower or higher, up to four either way (FACTS 52, 63): the rows relabel and the path keeps its
  shape, movable do at work.
- The comfort-check line sits above the buttons, the stop line and the guide's note under them,
  and the referral line in small type at the foot, in LESSON.md's order.
- Nothing listens and nothing is scored: there is no microphone on this page. Under reduced motion
  the path's notes light one after another instead of the travelling line.

### 5. Recall and quick check

- **Recall**: the kit's quiz at the top of the page with Lesson 2's questions 1 and 3 under their
  Lesson 2 ids, `l02-q1` and `l02-q3` (FACTS 30), reshuffled, with earlier answers never shown, so
  the answers measure delayed retrieval (MASTER-PLAN § 9). The kit's `QuizQuestion` has no id
  field yet (`kit/quiz.ts:31-36`); the Lesson telemetry track adds it. On the public host each
  answer is a telemetry event with its `visit_index`.
- **Quick check**: LESSON.md's four questions, three answers each, shuffled per question from the
  stored seed, one-line feedback for every answer, and a check icon and ink (not gold) on the
  right one. Question 3's play button plays `stop-c` (FACTS 58). "Try Step 1 again" and "Try Step
  3 again" use the kit's `data-goto-step`. Answers stay in the viewer's browser until the
  telemetry track exists; Lesson 4 marks done in the explorer once all four have an answer.

### 6. Go deeper drawer

A `details` disclosure, closed by default, under step 5's text, holding LESSON.md's three items.

## Audio

Every tone is synthesised in the page with Web Audio at the frequencies in FACTS 56 and 56a,
through the kit's sound module and its house envelopes (`.claude/memory/audio-pop-free-playback.md`),
and started only by a tap: taps in the soft tone, Merc's singing in Merc's "ooh" (FACTS, Sounds).
Nothing autoplays, and the page has no music bed.

## Mercs

Lesson 1's setup through the kit (`kit/merc-duo.ts`, `kit/merc-warm.ts`): the app's renderer
loaded after first paint, one WebGL context per Merc, medium quality on phones, turned toward each
other, paused off screen, and the still images when WebGL fails or would run on the CPU.
Reactions: blue `sing` while Play from C sounds and orange `sing` while Play from D sounds, each
`listen` while the other sings; orange `celebrate` once after the cold-open reveal (no sparkles);
in Sing it, blue sings the D3 scale and orange the D4 one. Under reduced motion or Pause animations
each Merc holds a still frame and skips the reactions.

## Practise links: what exists and what needs engineering

- **Today, Scale Runner.** `mercurypitch.com/pitch-training` opens the Exercises tab (FACTS 35);
  the viewer taps Scale Runner, which opens on Major and Ascending (FACTS 37), at the viewer's
  stored pace (difficulty 5 unless the app has moved it, FACTS 42), starting from the saved voice
  range (FACTS 41). It scores each note against the octave it plays (FACTS 40), so the copy says
  so and sends the viewer to Settings, Singing Voice Range, first. On the public host the link is
  `/pitch-training?lesson=04`.
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
    once that marker ships (CURRICULUM § 4 item 6).
- **Still open: the octave** (CURRICULUM § 4 item 7). Scale Runner scores the written octave, and a
  visitor who never set a range is fitted as a tenor (FACTS 41), so a soprano who skips Settings
  is scored against a low octave. Until the octave-folded option exists, the copy's sentence about
  Settings is the only remedy; when the option ships, the sentence can go. Scale Runner belongs on
  item 7's list beside Pitch Hold.
- When the slug ships, the Wrap, the footer and the explorer card switch to
  `mercurypitch.com/exercises/slow-scales` (LESSON.md's editorial note).

## Explorer and season data

- **Season data.** In `kit/season.ts`, Lesson 4's practise entry gains today's link, `{ href:
'/pitch-training?lesson=04', addr: 'mercurypitch.com/pitch-training', label: 'Scale Runner',
note: 'for now, then tap Scale Runner' }`, and keeps its `needs` until the slug ships. Its `sig`
  reads "A staircase with two uneven steps that slides to start on any note"; "with two short
  steps" says what the toy shows.
- **A text-only lesson.** Today a lesson is either planned or "Ready · watch and read", and a ready
  card links "Watch the episode" to `#watch` (`kit/explorer.ts:63-107`). Lesson 4 needs a third
  state, "Ready · read", with no Watch button and a Length row reading "10-minute read": a new
  optional field on `Lesson` (for example `film: false`), read by the card, the graph's node state
  and the phone list.
- **Other lessons' cards.** A ready card's actions point at the page's own anchors (`#watch`,
  `#lesson`), which is right only for the page's own lesson. With Lessons 1, 2 and 4 live, a card
  for another lesson should link to that lesson's page, `/learn/NN`.

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practise links that carry `?lesson=04`. Then the layout, accessibility, sound, motion and storage
rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children, touch
targets of at least 44 px, visible focus, a single dark theme with every colour a token and an
explicit body background, sound only after a tap, localStorage only for per-viewer conveniences
inside try/catch, and the whole page usable with no sound, no WebGL and no storage. Page QA
(PRODUCTION-PIPELINE § 5) adds two checks for this page: every stair, the start slider and the
names switch work by keyboard alone and announce what LESSON.md shows; and at 390 px the
staircase, its labels and the keyboard strip fit without overlap at every start from C4 to B4.
