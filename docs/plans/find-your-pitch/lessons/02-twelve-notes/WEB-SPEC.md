# Lesson 2 web page: spec

The Lesson 2 page is the web lesson for "Twelve notes" (written steps, live toys, two predicts, a
sung checkpoint, a quiz), with the episode embedded and the lesson explorer below it. Copy is in
[LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is the second page built from
the Phase 1 toy kit, so it is also that kit's test: "two lessons share it with no copy-paste"
(MASTER-PLAN § 7, Web kit). Where the kit is not ready yet, Lesson 1's page (specified in
[../01-what-is-a-note/WEB-SPEC.md](../01-what-is-a-note/WEB-SPEC.md)) is the code to promote into
the kit, never to copy; "What the kit and the app still need", below, lists the gaps found in the
kit as it stands.

Its public home is `mercurypitch.com/learn/02` (MASTER-PLAN § 12 item 9, decided 16 October
2026): a hand-written document `learn/02.html` with its module in `src/features/lessons/lesson-02/`,
built on the shared parts in `src/features/lessons/kit/`, the way Lesson 1's page (`learn/01.html`,
`src/features/lessons/lesson-01/`, built and not yet merged) is. A private proof preview page is
optional; if one is made, its host rules bind only the preview.

The page agrees with the film as voiced and built (`output/motion/lesson-02/`: 7:11, 431.08 s on
its cue sheet; the build decisions B1 to B25 in that folder's DECISIONS.md), checked on 18 October
2026: the quick check asks the film's four recap questions and points back to the objects that
answer them there; C♯ and D♭ stack on one key under one gold ring (B21); the practice card draws
Leap's twelve answers with the end card's legend; the next-lesson card carries the tease's two
figures; and the episode section prints the film's running time and chapters. The film is a check,
not a source: every claim on the page still has its FACTS line.

## Look

Lesson 1's, unchanged: the dark listening room (Obsidian ground, `#161b22` panels, the faint staff
texture, three soft glows), the series colour code (blue, orange, gold for the fit only, violet for
the contrast case, chrome for any other note), Lesson 1's type, the "Find Your Pitch" wordmark, and
its motion rules. The slide guide (Toys, 5) is the page's one pitch-canvas toy: Merc's model path
takes the app's target amber `#f59e0b` while one of Merc's slides plays, and the viewer's turn uses
the film's own plain chrome guide (DECISIONS 68). Nothing on the page draws a voice, so the app's
singer violet `#a78bfa` does not appear. Three things move on their own here: the two Merc idle
loops and the spiral's drift (there is no living staff in this hero). Under
`prefers-reduced-motion` all three always stop, and every transition this page adds (the climb's
trail, Look down, Unroll, Straighten, Lift out, the arrows that write a name, the names flipping,
the slide guide's line) lands in its final state with no travel; what the viewer starts (a tone, a
slide) still sounds. For everyone else the masthead's Pause animations toggle stops the same three
(WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2), with Lesson 1's departures kept: the Playground (item 9) is
the step toys themselves, not a toy of its own (here gathered on one free-play stage in the Wrap);
the Wrap comes before the episode; and each "Common mix-up" card sits inside the step whose toy
refutes it. New against Lesson 1: the recall check (item 3) runs for the first time; the practice
link sits in the Wrap, as the anatomy has it; the page has two mix-up cards, one per concept
(playbook rule 3); and there is no series blueprint section (Lesson 1's page carries it for the
team), so the masthead's anchors are Lesson, Watch and Explorer. Each section's heading, and the
line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 1's (wordmark, "Season 1 · Lesson 02", anchors Lesson, Watch, Explorer, the
   Sound toggle off by default, the Pause animations toggle with its reduced-motion lock).
2. **Hero**: kicker; the hook question as the title; the meta as three chips (10 minutes; "After
   Lesson 1: What is a note?", the prerequisite chip, a link to `/learn/01`; Sound on); the
   promise; the sound gate from LESSON.md, in the hero copy as Lesson 1's is; the two Mercs live on
   the floor line either side of the spiral, which shows the lit A3 to A4 turn with its five dim
   beads.
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
   5. Two names for one key: the tile row with the two-names toggle (Toys, 3), opening on the
      film's signature 3 (C♯ above D♭ on one key under one gold ring), mix-up card 2.
   6. A hundred cents: the semitone ruler with cents (Toys, 2), and the Go deeper drawer.
7. **Sing it**: the slide guide (Toys, 5) with Merc's slide, the octave-up slide and the guide; the
   safety line; nothing listens.
8. **Quick check**: Lesson 1's quiz component with LESSON.md's four questions, the film's four
   recap questions (Lesson 1's quick check asks its film's three, and one more): three answers each,
   shuffled (seeded per question), one-line feedback for every answer, a check icon and ink (not
   gold) on the right one. Question 2 has its own play button, Play the two steps: A4 to B4, then
   B4 to C5 (FACTS 52, the film's `quiz-pair`), with "1st" and "2nd" lighting in turn as each step
   sounds; no option names a note, so it is answered by ear. The film answers each question with
   the object that taught it (the ring of twelve; the keys A4 to C5 with their "2" and "1" bars;
   the C♯/D♭ key under its gold ring; the ruler with "200 ¢"), so a wrong answer's feedback links
   back to the step whose toy that object is: steps 2, 3, 5 and 6, through the kit's
   `data-goto-step`. Ids `l02-q1` to `l02-q4`; storage keys `fyp-l02-seed` and `fyp-l02-quiz-v1`;
   `lesson: 2`, so answering all four marks Lesson 2 done. The kit rebuilds the questions on every
   answer, so question 2's play button is handled by a listener on `#qs`, as the step links are.
   Answers stay in the viewer's browser (localStorage) until the Lesson telemetry track exists;
   then each first answer is a telemetry event behind consent (MASTER-PLAN Phase 1). A later visit
   asks them afresh, and Lesson 3's page will open with two of them.
9. **Wrap**: the three recap lines and the challenge, then:
   - **The practice card** (LESSON.md): Lesson 1's app card, with Leap's text, today's caveat and
     Contour as an optional first drill, and the address line "Practise it free:
     mercurypitch.com/ear-lab", as the film's end card has it, linking `/ear-lab?lesson=02` in a new
     tab, as Lesson 1's card links Voice Mirror. Its figure is a house-style drawing of Leap's
     twelve answer pads in the app's six columns, each its label over its name (FACTS 32), m2 and M2
     lit, the other ten ghosted with their fills and outlines dimmed but their labels at full
     contrast, as the film's S15g draws them (DECISIONS 77), captioned "Illustration: Leap's twelve
     answers. In Leap: m2 = semitone · M2 = tone."
   - **The next-lesson card**: the next lesson's hook on a card that opens Lesson 3 in the
     explorer, with the tease's two figures side by side as the film shows them: ASKED, 59 %, of
     1,105; TESTED, 10–16 %, a semitone or more off (FACTS 36).
   - **Free play**: one stage with the whole object and every control of the step toys at once (the
     spiral with Climb and Look down; Unroll and Straighten; Lift out the five; the names toggle
     with Sharp, Flat and Show the rare ones; the ruler with One semitone and Glide), switched by
     Spiral, Keyboard, Tiles and Ruler buttons. Nothing locks it: the page's order already puts the
     guided steps first (playbook rule 17: guided first, free play after).
10. **Watch the episode**: the kit's episode section (`kit/episode.ts`), as Lesson 1's page has it:
    the film as MP4s on R2 in the page's own player, never a YouTube embed, with its chapters, its
    captions and the transcript; until the files are uploaded, the poster, the chapters and the
    transcript with "Film coming soon". See "The episode", below.
11. **Lesson explorer**: Lesson 1's, with Lesson 2 as the current node: selected when the page
    opens, and ready to watch and read (`len: '7:11'` and `ready: true` on its entry in
    `kit/season.ts`). Lesson 2 marks done when its quiz is finished. Its card's practice link reads
    as LESSON.md's Wrap, as `season.ts` already has it (`/ear-lab?lesson=02`, "for now, then tap
    Leap", with the subset launch under "needs"). The kit's explorer assumes Lesson 1's page today
    (see "What the kit and the app still need").
12. **Footer**: Lesson 1's, with "Season 1 · Lesson 02 · Twelve notes"; the practice link, printed
    `mercurypitch.com/ear-lab` and linking `/ear-lab?lesson=02`, with "Ear Lab is free: tap Leap";
    and the credits as the film now stands: Lesson 1's fonts line; the episode's voices, the
    owner's ElevenLabs voices (blue Merc "Merc V1 Gentle Whimsical D2", orange Merc "Orange Merc",
    both Eleven v3; MERC-BIBLE § 4), whose rights the owner holds (MASTER-PLAN § 12 item 1); Merc's
    two sung As at the start of the film, ElevenLabs-derived Echo takes the owner also holds (FACTS
    41); every other musical example synthesised in code, Merc's slides included (FACTS 50, 51);
    and on this page every sound synthesised in the browser (FACTS, Labels).

## The episode

The film runs 7:11 (431.08 s on its cue sheet, `output/motion/lesson-02/cues.json`). The markup
prints 7:11 in the line above the heading and under the play button (`<span class="dur">`, the copy
in LESSON.md), and the kit replaces both with the MP4's own length once its metadata loads, as
Lesson 1's page does with 5:14; `onDuration` hands the same length to the explorer
(`explorer.setLength(2, len)`).

- **Where it plays from**: `src/features/lessons/lesson-02/film.ts`, built like Lesson 1's
  (`lesson-01/film.ts`). `FILM_SOURCES` (`{ hd, sd }`, the 1080p and 720p MP4s, the 720p one at 900
  px and below) stays `null` until the files are uploaded, and while it is null the section shows
  the poster, the chapters and the transcript with "Film coming soon"; `FILM_CHAPTERS` and
  `FILM_CAPTIONS_TEXT` read the bundled copies below. The MP4s live on R2 (MASTER-PLAN § 12 item
  7), served from R2's custom domain (planned: `media.mercurypitch.com`), not `r2.dev`. Of outside
  hosts, `media-src` in `public/_headers` lists only `*.r2.dev` and `*.r2.cloudflarestorage.com`
  today, so the domain goes in there before `FILM_SOURCES` points at it, or the browser refuses the
  video. Once the episode is on YouTube the section adds a "Watch on YouTube" link; there is no
  YouTube embed.
- **The files**: the film's `tools/web-video.sh` cuts them all from the delivery master:
  `lesson-02-1080p.mp4` and `lesson-02-720p.mp4` (H.264 and AAC at 30 fps, moov first) for R2;
  `poster.jpg`, the title card 1.6 s into its scene, 1920 x 1080, for `lesson-02/assets/poster.jpg`
  (Lesson 1's poster is its title card too); `og.jpg`, the same frame at 1200 x 630, for
  `public/learn/lesson-02-og.jpg`, the share card; and copies of the film's
  `captions/lesson-02.en.vtt` and `captions/chapters.json`.
- **Captions and chapters travel with the film**: they are copied into this folder's `captions/`
  (the lesson's sources, with the SRT, as Lesson 1's `captions/` holds them) and into
  `lesson-02/assets/` (the page's copies). A `film-sync.test.ts` like Lesson 1's holds the two
  copies equal and checks the speaker labels, and a re-cut that re-times the film changes both
  copies in the same commit as the MP4 URLs. The captions are a same-origin VTT track, on by
  default, whose turns start "BLUE:" or "ORANGE:", as the transcript expects; the transcript is the
  same text, one paragraph per speaker turn, each with its time to jump to.
- **Chapters**: eleven, as the film's `chapters.json` gives them (each starts where its first scene
  starts; the list prints the minutes and seconds, the jump uses the seconds):

| Starts | Seconds | Chapter                  | Steps it mirrors |
| ------ | ------- | ------------------------ | ---------------- |
| 00:00  | 0.00    | The missing five         | the cold open    |
| 00:35  | 35.23   | The very next note       | 1                |
| 00:48  | 48.25   | Twelve equal steps       | 2                |
| 01:35  | 95.17   | The keyboard             | 3                |
| 01:48  | 108.24  | B to C                   | 3                |
| 02:52  | 172.45  | Where the five come from | 4                |
| 03:19  | 199.59  | Sharps and flats         | 5                |
| 04:25  | 265.78  | Cents                    | 6                |
| 05:06  | 306.20  | Sing a semitone          | Sing it          |
| 05:57  | 357.63  | Quick check              | Quick check      |
| 06:49  | 409.06  | Next time                | the next lesson  |

## Toys: what each reuses, and what is new

| Toy                          | Reuses from Lesson 1's page                                                                                                                           | New in Lesson 2                                                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Spiral and keyboard       | Step 5's spiral and step 6's keyboard (`lesson-01/toy-spiral.ts`, `toy-spiral-draw.ts`, `toy-spiral-keys.ts`), promoted into the kit as one component | Dim beads that light once heard; Climb; Look down; all keys lit and playable; Straighten; step bars; Lift out the five                                            |
| 2. Semitone ruler with cents | Step 2's dial (`lesson-01/toy-dial.ts`: its slider, readout and held tone), turned vertical                                                           | The cents scale, the one-semitone zoom, the app-style monitor that flips at 50 cents, the 100-cent glide                                                          |
| 3. Two-names toggle          | Step 5's per-bead labels                                                                                                                              | Sharps, flats or both on every black key, page-wide, both stacked sharp above flat; Sharp and Flat arrows; one gold ring on a key given both names; the rare ones |
| 4. Semitone or tone?         | The quiz's feedback lines (`kit/quiz.ts`) and the tone player (`kit/sound.ts`)                                                                        | All new: a ten-round ear game, two answers                                                                                                                        |
| 5. Slide guide (Sing it)     | The Sing it card (`lesson-01/sing.ts`), Merc's synthesised "ooh", the hum-along ring with Merc's still                                                | Four lanes; Merc's amber path while a slide plays; the plain chrome guide and its sweeping line; the slides themselves                                            |
| 6. Recall check              | The quick-check component (`kit/quiz.ts`) and Lesson 1's questions 2 and 4 (`lesson-01/quiz-questions.ts`)                                            | Its place at the top of the page, a second quiz on one page, and asking by Lesson 1's ids                                                                         |
| 7. Predict widgets           | Lesson 1's predict widget (`lesson-01/predict.ts`: choice locks, play buttons unlock, a kind reveal), promoted into the kit                           | Two of them: every gap or only some (cold open); B to C, the same, or C to D (step 3, three choices)                                                              |
| 8. Go deeper drawer          | none                                                                                                                                                  | All new: a disclosure (`details`) for the ratio, the cent's origin and "sharp" meaning a little high                                                              |

### 1. Spiral and keyboard

One component with four states, so the object the film transforms is one object on the page too.

- **Spiral** (steps 1 and 2, and the hero): Lesson 1's helix (canvas 2D, projected and depth-sorted,
  three turns A2 to A5, 30 degrees per semitone, A at the front, draggable, slow drift except under
  reduced motion or Pause animations, letters at their angles, C seams with octave numbers, tap a
  bead to hear it). New: the five beads on each turn start dim with a "?" and light, keeping their
  glow, once heard; their names follow the two-names toggle. **Climb** plays the thirteen notes from
  A3 to A4 at the film's timing (FACTS 43), lights each bead in turn, runs a step counter from 0 on
  A3 to 12 on A4 (steps, not notes: thirteen notes make twelve steps, FACTS 16; DECISIONS 11) and
  shows each note's frequency in whole hertz as it lights (220 Hz up to 440 Hz, FACTS 43), with a
  gold "× 2" at the end. **Look down** moves the camera to the spiral's axis: one turn becomes the
  ring of twelve, its wedges lit in gold; press again to return. Under reduced motion both land in
  their end state at once.
- **Keyboard** (step 3): Lesson 1's Unroll button and keyboard (A2 to A5, low notes left, A3 blue,
  A4 orange), now with every key lit and playable, the black keys named by the toggle. Two keys
  played one after the other draw a step bar between them, a notch per semitone, labelled "1" or
  "2" as the film's bars are. Phones show one octave, A3 to A4, at full width: the white keys are
  about 45 px wide, and each black key's tap area is 44 px wide in the keys' upper zone, so every
  key keeps a target of at least 44 px (the white keys are always tappable in their lower zone).
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
  (FACTS 24, 30). The monitor always uses sharps, whatever the toggle says, because the app does,
  and its marker is drawn in ink at every reading, as the film draws it: the app's green means in
  tune, which is Lesson 3's idea, and its blue is blue Merc's note (FACTS 30; DECISIONS 28).
- **One semitone** zooms the ruler to A3 to A♯3 with a tick every 10 cents. **Glide** plays the
  100-cent glide (FACTS 25) and moves the marker with it (under reduced motion the readout counts
  while the marker stays put).
- Keyboard: the marker is a slider (`role="slider"`, values 0 to 1200); `aria-valuetext` names the
  nearest note and the distance from it, as the monitor reads, then the frequency, such as "A3 plus
  37 cents, 224.75 hertz" or "A sharp 3 minus 40 cents, 227.76 hertz"; arrow keys move it 1 cent,
  Shift with an arrow 10, Page Up and Page Down 100.

### 3. Two-names toggle

- A segmented control, "Sharps · Flats · Both" (buttons with `aria-pressed`), at the top of the
  step 5 stage and on the free-play stage. It relabels every black key, tile, bead and lane on the
  page at once (C♯ or D♭ or both). Default: Sharps, matching the app, with a small note
  "MercuryPitch's pitch line shows sharps". In Both, each black key and dark tile carries its two
  names stacked, sharp above flat, as the film writes them: a dark tile is too narrow for two names
  side by side at a readable size (the film's build decision B21; FACTS, Illustrations).
- **Sharp** and **Flat** buttons: select any key or tile, press one, and an arrow steps one
  semitone up or down and writes the name it gives on the key it lands on (in place of that key's
  own label while it shows). A key the arrows have given both names gets one gold ring, the fit:
  one key (the Both labels never take a ring). Step 5 opens on the film's signature 3: an
  arrow climbs one semitone from C and writes C♯ on the dark tile, another steps one semitone down
  from D and writes D♭ under it, and the gold ring settles round the tile; beside it, **Play both
  ways** sounds C4 to C♯4, then D4 to D♭4 (FACTS 49), and runs the arrows again. From E, Sharp
  lands on F and writes E♯ on the F tile, above F's own name, where the film writes it (the step's
  Notice). A switch **Show the rare ones** adds the four white-key second names (E♯ on F, F♭ on E,
  B♯ on C, C♭ on B; FACTS 20).
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

- Four lanes (G♯, A, A♯, B, labelled with octave 3 or 4 by the slide chosen; their names follow the
  toggle), pitch as height, beside the breathing ring of Lesson 1's Sing it card.
- **Play Merc's slide** (A3) and **Play it an octave up** (A4) sound Merc's synthesised "ooh" along
  FACTS 50's contour (A held, up one lane, held, and back, 4.2 s; FACTS 51 an octave up), in Lesson
  1's recipe (partials 1, .62, .38, .24, .14, .08, .045, .025 over a lowpass near 2.6 kHz, vibrato
  5.5 Hz, +-14 cents, grown in over 0.35 s). Merc's path rests faint on the lanes in the app's
  target amber, the model a singer follows (MASTER-PLAN § 5), and lights in step with a slide as it
  plays, while the ring shows the still of the Merc singing it, blue for A3 and orange for A4, as
  Lesson 1's ring does.
- **Start the guide** is enabled once either slide has played (hear it first: playbook rule 16). It
  is the viewer's turn, so nothing of the app's drawing stays, as in the film from "Now you"
  (DECISIONS 68): the amber goes, the lanes turn plain chrome and Merc's path is drawn dashed in
  chrome. It counts in for one second, then a vertical chrome line sweeps across the lanes along
  the path in 4.2 s, with nothing riding the path itself, while the ring breathes with Merc's still
  in its centre, never a microphone icon (DECISIONS 65); when the sweep ends, the lanes go back to
  their amber rest. Nothing listens and nothing is scored: no microphone on this page. Under reduced
  motion the path's segments light one after another instead of a travelling line.
- The safety line from LESSON.md sits under the buttons.

### 6. Recall check

- The quick-check component, at the top of the page, with Lesson 1's questions 2 and 4 under the
  `question_id`s Lesson 1's page gives them (proposed: `l01-q2` and `l01-q4`, as this page's own
  are `l02-q1` to `l02-q4`), so one question reports under one id on both pages; the first time the
  page anatomy's item 3 runs. Options are reshuffled from a seed of its own (keys
  `fyp-l02-recall-seed` and `fyp-l02-recall-v1`), not Lesson 1's, and earlier answers are never
  shown, so the answers measure delayed retrieval (MASTER-PLAN § 9). It marks no lesson done. On
  the public host each answer is a telemetry event with its `visit_index`. The kit needs three
  changes for it (below): a second quiz on one page, no done-marking, and question ids.

### 7 and 8. Predicts and the Go deeper drawer

- Both predicts are Lesson 1's widget: the choice locks, the play buttons unlock, the reveal plays
  after the sound and never calls a choice wrong. The cold open's has two choices and step 3's
  three; the widget takes any number from two to four, each at least 44 px tall.
- The Go deeper drawer is a `details` disclosure, closed by default, under step 6's toy.

## Audio

Every tone is synthesised in the page with Web Audio at the frequencies in FACTS 6, through the
kit's `sound.ts` (`hz()` in `kit/notes.ts` is the same formula), with the house envelope rules
(`.claude/memory/audio-pop-free-playback.md`), started only by a tap; Merc's "ooh" as in Toys 5.
Where the page plays an example the film plays, it takes the film's pitches and timings (FACTS 42
to 52: the first step, the climb, B to C then C to D, C to its black key then B to C, E to F, the
tone split, both ways to C♯, the slides, the quiz's two steps; FACTS 25 for the cents glide).
Nothing autoplays. The page has no music bed.

## Mercs

Lesson 1's setup: the app's own renderer (`src/lib/merc/renderer.ts`) through the kit
(`kit/merc-duo.ts`), loaded after first paint, orange with the warm look and warm light
(`kit/merc-warm.ts`), one WebGL context per Merc, `medium` quality on phones, turned toward each
other, paused off screen; a still image if WebGL fails, or if WebGL2 would run on the CPU (Lesson 1
WEB-SPEC, Mercs). They live in the hero, and their reactions are the hero's: blue `sing` while A3
plays and orange `sing` while A4 plays (the climb's first and last notes), and orange `celebrate`
once after the cold-open reveal (no sparkles). The slides play in Sing it, far below the hero,
where the ring shows a still of the Merc singing, so the live pair never needs `ride` (`merc-duo.ts`
has `sing` and `celebrate` only). Under `prefers-reduced-motion` or Pause animations each Merc holds
a still frame and skips the reactions; the buttons and the reveal carry the moment.

## Practice link: what exists and what needs engineering

- Today: `mercurypitch.com/ear-lab` opens the Ear Lab bench; the viewer taps Leap, which offers all
  twelve intervals, plays each pair up or down, and roves the lower note from C3 to A4 (FACTS 32,
  33). The page says so in the Wrap. The link carries `?lesson=02` (`/ear-lab?lesson=02`), which
  keeps the bench's own `#/ear-lab` boot (`src/seo/render-entry-page.ts` adds the hash only when
  there is none) and is ignored until the lesson marker ships.
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

## What the kit and the app still need

Found in the kit and the app as they stand (18 October 2026), beyond promoting Lesson 1's spiral,
keyboard, dial and predict into the kit (Toys table):

- `kit/quiz.ts`: a root element or id prefix, so two quizzes share a page (it binds to `#qs`,
  `#scoreN` and `#quizReset` and writes ids `q0` and `fb0` onwards); `lesson` optional, so the
  recall check marks no lesson done (it marks `lesson` done once every question has an answer); and
  a question `id`, the telemetry's `question_id` (`QuizQuestion` has none, FACTS 35a).
- `kit/explorer.ts`: the current lesson (it selects Lesson 1 when it opens); a link to its own page
  for a ready lesson that is not the current one (its card's Watch the episode and Read the lesson
  are the same-page anchors `#watch` and `#lesson`, so from this page they would open Lesson 2's);
  and a poster per lesson (`poster` is Lesson 1's, and the poster figure's alt text names Lesson
  01).
- `kit/notes.ts`: the sharp and flat names of the five (`letterOf` returns null for them, Lesson
  1's unnamed beads), for the toggle, the labels and the accessible names.
- `kit/sound.ts`: Merc's voice along a contour of holds and exponential glides (FACTS 50), for the
  slides; a voice holds one pitch today, and `setFreq` moves it by a time constant, not a glide of
  a set length.
- `kit/episode.ts`: the "Watch on YouTube" link, once the episode is there.
- `vite.config.ts`: `/learn/02` served from `learn/02.html` in dev and preview, as `LESSON_01_PATH`
  is, and `learn/02.html` as a build input beside `lesson01`.
- `src/lib/sw-runtime.ts`: `/learn/02` and `/learn/02.html` in `STANDALONE_DOCUMENT_PATHS`, so the
  service worker leaves the lesson alone.
- `public/sitemap.xml` and `public/llms.txt` (its "Lessons" list): Lesson 2's entry;
  `public/learn/lesson-02-og.jpg`: the share card (The episode, above).
- Lesson 1's page, when this one goes live: its Wrap's next-lesson card ("02 · Twelve notes",
  marked planned, opening the explorer) links to `/learn/02`, and its explorer's line "Lesson 1 is
  ready to watch and read; the rest are planned" names both lessons.

## Contract

Lesson 1's contract, unchanged and binding, including what its page on the app changed from the
preview (Lesson 1 WEB-SPEC, "On the app"): no CDN at all, self-hosted fonts, Web Animations in
place of GSAP, and practice links that carry `?lesson=02`. Then the layout, accessibility, sound,
motion and storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text
children, touch targets of at least 44 px, visible focus, a single dark theme with every colour a
token and an explicit body background, sound only after a tap, localStorage only for per-viewer
conveniences inside try/catch, and the whole page usable with no sound, no WebGL and no storage.
Page QA before publishing (PRODUCTION-PIPELINE § 5) adds two checks for this page: every black key
and tile reachable and named by keyboard in each toggle state, and the ruler's slider operable by
keys alone.
