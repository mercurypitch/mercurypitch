# Lesson 2 web page: spec

The Lesson 2 page is the web lesson for "Twelve notes" (written steps, live toys, two predicts, a
sung checkpoint, a quiz), with the episode embedded and the lesson explorer below it. Copy is in
[LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is the second page built from
the Phase 1 toy kit, so it is also that kit's test: "two lessons share it with no copy-paste"
(MASTER-PLAN § 7, Web kit). Where the kit is not ready yet, Lesson 1's page (specified in
[../01-what-is-a-note/WEB-SPEC.md](../01-what-is-a-note/WEB-SPEC.md)) is the code to promote into
the kit, never to copy.

Its public home is `mercurypitch.com/learn/02` (MASTER-PLAN § 12 item 9, decided 16 October
2026): a hand-written document `learn/02.html` with its module in `src/features/lessons/lesson-02/`,
built on the shared parts in `src/features/lessons/kit/`, the way Lesson 1's page (`learn/01.html`,
`src/features/lessons/lesson-01/`, in build as this is written) is. A private proof preview page
is optional; if one is made, its host rules bind only the preview.

## Look

Lesson 1's, unchanged: the dark listening room (Obsidian ground, `#161b22` panels, the faint staff
texture, three soft glows), the series colour code (blue, orange, gold for the fit only, violet for
the contrast case, chrome for any other note), the app's canvas colours on the one pitch-canvas toy
(the slide guide: target amber `#f59e0b`, singer violet `#a78bfa`), Lesson 1's type, the "Find
Your Pitch" wordmark, and its motion rules. Three things move on their own here: the two Merc idle
loops and the spiral's drift (there is no living staff in this hero). Under
`prefers-reduced-motion` all three always stop, and every transition this page adds (the climb's
trail, Look down, Unroll, Straighten, Lift out, the names flipping, the slide guide's line) lands
in its final state with no travel; what the viewer starts (a tone, a slide) still sounds. For
everyone else the masthead's Pause animations toggle stops the same three (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2), with Lesson 1's departures kept: the step toys double as the
Playground (item 9), the Wrap comes before the episode, and each "Common mix-up" card sits inside
the step whose toy refutes it. New against Lesson 1: the recall check (item 3) runs for the first
time; the practice link sits in the Wrap, as the anatomy has it; the page has two mix-up
cards, one per concept (playbook rule 3); and there is no series blueprint section (Lesson 1's page
carries it for the team), so the masthead's anchors are Lesson, Watch and Explorer.

1. **Masthead**: Lesson 1's (wordmark, "Season 1 · Lesson 02", anchors Lesson, Watch, Explorer, the
   Sound toggle off by default, the Pause animations toggle with its reduced-motion lock).
2. **Hero**: kicker; the hook question as the title; the meta as chips (10 minutes, After Lesson 1,
   Sound on) plus a prerequisite chip linking Lesson 1; the promise; the two Mercs live on the
   floor line either side of the spiral, which shows the lit A3 to A4 turn with its five dim beads.
3. **Recall from Lesson 1**: two questions (see Toys, 6).
4. **Cold open: predict**: orange's guess ("Is there a hidden note between every two letters?")
   and blue's reply in speech bubbles, then the two-choice predict (every gap holds a note, or only
   some); choosing unlocks Play the climb on the hero spiral, which lights each bead as it sounds
   and counts the steps; after the climb, the reveal from LESSON.md (twelve steps, not fourteen).
   It leaves which gaps and why to steps 3 and 4, so step 3's predict is not given away.
5. **Four words you'll meet**: semitone, tone, sharp and flat, cent, each with its one-line
   definition and a play button (A3 to A♯3; A3 to B3; C4 to C♯4; the 100-cent glide).
6. **The steps**: Lesson 1's sticky stage and step deck ("N of 6", Previous and Next, the stage
   beside the text on desktop and above it on phones). Each step has its heading, text, one "Try:",
   one "Notice:" and its toy:
   1. The very next note: the spiral (Toys, 1).
   2. Twelve equal steps make an octave: the spiral with Climb and Look down.
   3. B to C: the keyboard with Unroll and Straighten, the second predict (three choices),
      mix-up card 1.
   4. Tones, and where the five come from: the tile row with Lift out the five; the Semitone or
      tone? game (Toys, 4).
   5. Two names for one key: the tile row with the two-names toggle (Toys, 3), mix-up card 2.
   6. A hundred cents: the semitone ruler with cents (Toys, 2), and the Go deeper drawer.
7. **Sing it**: the slide guide (Toys, 5) with Merc's slide, the octave-up slide and the guide; the
   safety line; nothing listens.
8. **Quick check**: Lesson 1's quiz component with LESSON.md's four questions, three answers each,
   shuffled (seeded per question), one-line feedback for every answer, a check icon and ink (not
   gold) on the right one; question 2 has its own play button (E4 then F4). Ids `l02-q1` to
   `l02-q4`. Answers stay in the viewer's browser (localStorage) until the Lesson telemetry track
   exists; then each first answer is a telemetry event behind consent (MASTER-PLAN Phase 1). A
   later visit asks them afresh, and Lesson 3's page will open with two of them.
9. **Wrap**: the three recap lines, the challenge, the practice card (Leap, with today's caveat, and
   Contour as an optional first drill), the next lesson's hook on a card that opens Lesson 3 in the
   explorer. Free play unlocks here: every control of the step toys on one stage (playbook rule 17:
   guided first, free play after).
10. **Watch the episode**: the kit's episode section (`kit/episode.ts`): the film as an MP4 on R2,
    1080p with a 720p copy for phones, served from R2's custom domain (planned:
    `media.mercurypitch.com`, which `media-src` must list first), not `r2.dev` (MASTER-PLAN § 12
    item 7, updated 17 October 2026), its URLs in `lesson-02/film.ts`; captions as a same-origin VTT
    track, the transcript and the chapters built from the film's captions and `chapters.json`, which
    travel with the film: a re-cut that re-times it changes them in the same commit as the MP4s, as
    Lesson 1's page does. Once the episode is on YouTube the section adds a "Watch on YouTube" link;
    there is no YouTube embed. Until the files are uploaded the section shows the poster, the
    chapters and the transcript with "Film coming soon".
11. **Lesson explorer**: Lesson 1's, with Lesson 2 as the current node; Lesson 2 marks done when its
    quiz is finished; its card's practice link reads as LESSON.md's Wrap.
12. **Footer**: Lesson 1's, with the practice link (`mercurypitch.com/ear-lab?lesson=02`) and the
    same credits (scratch voices to be re-voiced, every example synthesised, Merc's sung notes
    ElevenLabs-derived, whose rights the owner holds, MASTER-PLAN § 12 item 1).

## Toys: what each reuses, and what is new

| Toy                          | Reuses from Lesson 1's page                                                                                                                           | New in Lesson 2                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1. Spiral and keyboard       | Step 5's spiral and step 6's keyboard (`lesson-01/toy-spiral.ts`, `toy-spiral-draw.ts`, `toy-spiral-keys.ts`), promoted into the kit as one component | Dim beads that light once heard; Climb; Look down; all keys lit and playable; Straighten; step bars; Lift out the five |
| 2. Semitone ruler with cents | Step 2's dial (`lesson-01/toy-dial.ts`: its slider, readout and held tone), turned vertical                                                           | The cents scale, the one-semitone zoom, the app-style monitor that flips at 50 cents, the 100-cent glide               |
| 3. Two-names toggle          | Step 5's per-bead labels                                                                                                                              | Sharps, flats or both on every black key, page-wide; Sharp and Flat arrows; the rare white-key names                   |
| 4. Semitone or tone?         | The quiz's feedback lines (`kit/quiz.ts`) and the tone player (`kit/sound.ts`)                                                                        | All new: a ten-round ear game, two answers                                                                             |
| 5. Slide guide (Sing it)     | The Sing it card (`lesson-01/sing.ts`), Merc's synthesised "ooh", the hum-along ring                                                                  | Four lanes and Merc's amber path; the guide's sweeping line; the octave-up slide                                       |
| 6. Recall check              | The quick-check component (`kit/quiz.ts`) and Lesson 1's questions 2 and 4 (`lesson-01/quiz-questions.ts`)                                            | Its place at the top of the page, and asking by Lesson 1's ids                                                         |
| 7. Predict widgets           | Lesson 1's predict widget (`lesson-01/predict.ts`: choice locks, play buttons unlock, a kind reveal), promoted into the kit                           | Two of them: every gap or only some (cold open); B to C, the same, or C to D (step 3, three choices)                   |
| 8. Go deeper drawer          | none                                                                                                                                                  | All new: a disclosure (`details`) for the ratio, the cent's origin and "sharp" meaning a little high                   |

### 1. Spiral and keyboard

One component with four states, so the object the film transforms is one object on the page too.

- **Spiral** (steps 1 and 2, and the hero): Lesson 1's helix (canvas 2D, projected and depth-sorted,
  three turns A2 to A5, 30 degrees per semitone, A at the front, draggable, slow drift except under
  reduced motion or Pause animations, letters at their angles, C seams with octave numbers, tap a
  bead to hear it). New: the five beads on each turn start dim with a "?" and light, keeping their
  glow, once heard; their names follow the two-names toggle. **Climb** plays the thirteen notes from
  A3 to A4 (FACTS 43), lights each bead in turn, counts 1 to 12 and shows each note's frequency as
  it lights (220 Hz up to 440 Hz, FACTS 43), with a gold "× 2" at the end. **Look down** moves the
  camera to the spiral's axis: one turn becomes the ring of twelve, its wedges lit in gold; press
  again to return. Under reduced motion both land in their end state at once.
- **Keyboard** (step 3): Lesson 1's Unroll button and keyboard (A2 to A5, low notes left, A3 blue,
  A4 orange), now with every key lit and playable, the black keys named by the toggle. Two keys
  played one after the other draw a step bar between them, a notch per semitone. Phones show one
  octave, A3 to A4, at full width: the white keys are about 45 px wide, and each black key's tap
  area is 44 px wide in the keys' upper zone, so every key keeps a target of at least 44 px (the
  white keys are always tappable in their lower zone).
- **Straighten** (step 3): the octave's keys glide into the row of equal tiles, one per semitone,
  with a "1" under each neighbouring pair and B–C and E–F flashing gold once; press again to bend
  them back into a keyboard. On phones the tile row stands vertical, low notes at the bottom, 13
  tiles of 44 px (pitch is height, playbook rule 20).
- **Lift out the five** (step 4): the five dark tiles rise out of the row; the seven letters show
  five holes labelled "tone" and two touching pairs labelled "semitone"; press Drop back to return
  them, one by one, with "7 + 5 = 12".
- **Predict** (step 3): the predict widget with three choices (B to C, The same, C to D), because
  the eye's guess, "the same", has to be one of them (DECISIONS 13); choosing unlocks Play B to C
  and Play C to D; the reveal (LESSON.md) never tells any choice it was wrong.

### 2. Semitone ruler with cents

Built on Lesson 1's dial: the same log-pitch slider, readout and held tone, turned to stand
vertical (pitch is height).

- A ruler from A3 (bottom) to A4 (top) with thirteen ticks: names on the left (they follow the
  toggle), cents on the right (0, 100 ... 1200). A marker the viewer drags; while dragging, a soft
  tone sounds at the marker's pitch (Web Audio, the dial's envelope).
- Readouts: cents above A3 (0 to 1200, whole cents), the frequency to two decimals (f = 220 x
  2^(c/1200)), and an app-style monitor labelled "How MercuryPitch shows it": the nearest note in
  the app's sharp spelling, and a bar from -50 to +50 cents that flips to the next note past 50
  (FACTS 24, 30). The monitor always uses sharps, whatever the toggle says, because the app does.
- **One semitone** zooms the ruler to A3 to A♯3 with a tick every 10 cents. **Glide** plays the
  100-cent glide (FACTS 25) and moves the marker with it (under reduced motion the readout counts
  while the marker stays put).
- Keyboard: the marker is a slider (`role="slider"`, values 0 to 1200, `aria-valuetext` such as
  "A3 plus 37 cents, 224.75 hertz"); arrow keys move it 1 cent, Shift with an arrow 10, Page Up and
  Page Down 100.

### 3. Two-names toggle

- A segmented control, "Sharps · Flats · Both" (buttons with `aria-pressed`), at the top of the
  step 5 stage and in the free-play stage. It relabels every black key, tile and bead on the page
  at once (C♯ or D♭ or both). Default: Sharps, matching the app, with a small note "MercuryPitch's
  pitch line shows sharps".
- **Sharp** and **Flat** buttons: select any key or tile, press one, and an arrow steps one
  semitone up or down and writes the name it gives on the key it lands on. From E, Sharp lands on F
  and writes E♯ under F, the step's Notice. A switch **Show the rare ones** adds the four white-key
  second names (E♯ on F, F♭ on E, B♯ on C, C♭ on B; FACTS 20).
- The keys' accessible names follow the toggle: "C sharp 4, also D flat 4".

### 4. Semitone or tone?

- Ten rounds. Each plays one step inside A3 to A4, a semitone or a tone, chosen at random from a
  seeded sequence; two answers, Semitone and Tone. Feedback names the keys and the sound, never the
  listener: "E to F: a semitone, no key between them" or "C to D: a tone, with C♯ between". A miss
  replays the step slowly; after two misses in a row the game adds the playbook's line "If that
  felt tricky, good: that's learning" (rule 15). A count "7 of 10" at the end; no rating, no streak.
- A switch **Up and down** mixes in falling steps, because Leap plays both (FACTS 32); off at
  first.
- The two buttons sit side by side, each at least 44 px tall; keys 1 and 2 answer, Space replays.

### 5. Slide guide (Sing it)

- Four lanes (G♯, A, A♯, B, labelled A3 or A4 by the octave chosen) in the app's canvas style,
  with Merc's model as an amber target path: A held, up one lane, held, and back (FACTS 50).
- **Play Merc's slide** (A3) and **Play it an octave up** (A4) sound Merc's synthesised "ooh"
  (Lesson 1's recipe: partials 1, .62, .38, .24, .14, .08, .045, .025 over a lowpass near 2.6 kHz,
  vibrato 5.5 Hz, +-14 cents, grown in over 0.35 s), with blue or orange Merc singing beside it
  (state `ride`). **Start the guide** counts in for one second, then a vertical line sweeps across
  the lanes along the path in 4.2 s, with nothing riding the path itself (the film's fix,
  DECISIONS 68), while a breathing ring waits, with Merc's still in its centre as in Lesson 1's hum-along
  ring, never a microphone icon (the film's fix too, DECISIONS 65). Nothing listens and nothing is
  scored: no microphone on this page. Under reduced motion the path's segments light one after
  another instead of a travelling line.
- The safety line from LESSON.md sits under the buttons.

### 6. Recall check

- The quick-check component, at the top of the page, with Lesson 1's questions 2 and 4 under their
  Lesson 1 `question_id`s (the first time the page anatomy's item 3 runs; the kit's `QuizQuestion`
  has no id field yet, so the Lesson telemetry track adds one). Options are reshuffled and earlier
  answers are never shown, so the answers measure delayed retrieval (MASTER-PLAN § 9). On the
  public host each answer is a telemetry event with its `visit_index`.

### 7 and 8. Predicts and the Go deeper drawer

- Both predicts are Lesson 1's widget: the choice locks, the play buttons unlock, the reveal plays
  after the sound and never calls a choice wrong. The cold open's has two choices and step 3's
  three; the widget takes any number from two to four, each at least 44 px tall.
- The Go deeper drawer is a `details` disclosure, closed by default, under step 6's toy.

## Audio

Every tone is synthesised in the page with Web Audio at the frequencies in FACTS 6, through the
kit's `sound.ts` (`hz()` in `kit/notes.ts` is the same formula), with the house envelope rules
(`.claude/memory/audio-pop-free-playback.md`), started only by a tap; Merc's "ooh" as in Toys 5.
Nothing autoplays. The page has no music bed.

## Mercs

Lesson 1's setup: the app's own renderer (`src/lib/merc/renderer.ts`) through the kit
(`kit/merc-duo.ts`), loaded after first paint, orange with the warm look and warm light
(`kit/merc-warm.ts`), one WebGL context per Merc, `medium` quality on phones, turned toward each
other, paused off screen; a still image if WebGL fails, or if WebGL2 would run on the CPU (Lesson 1
WEB-SPEC, Mercs). Reactions: blue `sing` while A3 plays,
orange `sing` while A4 plays, `ride` during the slides, orange `celebrate` once after the
cold-open reveal (no sparkles). Under `prefers-reduced-motion` or Pause animations each Merc holds a still frame and
skips the reactions; the buttons and the reveal carry the moment.

## Practice link: what exists and what needs engineering

- Today: `mercurypitch.com/ear-lab` opens the Ear Lab bench; the viewer taps Leap, which offers all
  twelve intervals, plays each pair up or down, and roves the lower note from C3 to A4 (FACTS 32,
  33). The page says so in the Wrap.
- Needed (CURRICULUM § 4 item 5, Phase 1 App track): an `ear-drill` launch kind that accepts a bank
  subset, so `/exercises/semitone-or-tone` (proposed slug) opens Leap with only `leap:m2` and
  `leap:M2`. How such a run is rated is decided, pending this App track work (DECISIONS 73): it rates
  on its own track id, never the shared Leap rating, which describes all twelve intervals; its guess
  floor matches the pads it actually shows, 1/2 for two or 1/12 if all twelve show with ten dimmed
  (the drill's `choices` count sets the floor and "must match what the UI actually renders",
  `src/lib/ear/drills.ts:58-60`, `:233-237`); and it passes `updateItem: false`, so the items'
  calibration stays as it is. The controller already supports this through `RunTrack`
  (`src/features/ear-lab/use-identification-controller.ts:58-62`), the way Echo's sung answers rate
  under `echo-sing` (`src/features/ear-lab/EchoDrill.tsx:136-142`; FACTS 34a). The launch should
  also carry `?lesson=02` so First Light steps aside (CURRICULUM § 4 item 6).
- When it ships, the Wrap, the footer, the explorer card and the YouTube description switch to the
  slug; the film's end card keeps `/ear-lab`, as the owner decided (DECISIONS 72), which stays
  valid.

## Contract

Lesson 1's contract, unchanged and binding, including what its page on the app changed from the
preview (Lesson 1 WEB-SPEC, "On the app"): no CDN at all, self-hosted fonts, Web Animations in
place of GSAP, and practice links that carry `?lesson=02`. Then the layout, accessibility, sound,
motion and storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text
children, touch targets of at least 44 px, visible focus, a single dark theme with every colour a
token and an explicit body background, sound only after a tap, localStorage only for per-viewer
conveniences inside try/catch, and the whole page usable with no sound, no WebGL and no storage. Page QA before publishing (PRODUCTION-PIPELINE § 5) adds
two checks for this page: every black key and tile reachable and named by keyboard in each toggle
state, and the ruler's slider operable by keys alone.
