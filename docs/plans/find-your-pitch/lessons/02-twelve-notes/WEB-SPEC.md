# Lesson 2 web page: spec

The Lesson 2 page is the web lesson for "Twelve notes" (written steps, live toys, three predicts, a
sung checkpoint, a quiz), with the episode embedded and the lesson explorer below it. Copy is in
[LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is the second page built from
the Phase 1 toy kit, so it is also that kit's test: "two lessons share it with no copy-paste"
(MASTER-PLAN § 7, Web kit). Where the kit is not ready yet, Lesson 1's page (specified in
[../01-what-is-a-note/WEB-SPEC.md](../01-what-is-a-note/WEB-SPEC.md)) is the code to promote into
the kit, never to copy; "What the kit and the app still need", below, lists each piece the page
needs and what it must do.

Its public home is `mercurypitch.com/learn/02` (MASTER-PLAN § 12 item 9, decided 16 October
2026): a hand-written document `learn/02.html` with its module in `src/features/lessons/lesson-02/`,
built on the shared parts in `src/features/lessons/kit/`, the way Lesson 1's page (`learn/01.html`,
`src/features/lessons/lesson-01/`, built and not yet merged) is. A private proof preview page is
optional; if one is made, its host rules bind only the preview.

The page agrees with the film as voiced and built, checked on 18 October 2026 against its master,
`renders/rc-04-60fps.mp4` in `output/motion/lesson-02/` (7:11, 431.08 s on its cue
sheet, FACTS 54; the build decisions B1 to B25 in that folder's DECISIONS.md): the quick check asks
the film's four recap questions and points back to the objects that answer them there; C♯ and D♭
stack on one key under one gold ring (B21); the practice card draws Leap's twelve answers with the
end card's legend; the next-lesson card carries the tease's two figures; and the episode section
prints the film's running time and chapters. The master passed its last critic round (critic 15,
SHIP, 18 October 2026) with the recap objects, the Leap grid and the end card as checked here; a
later re-render is checked again. The film is a check, not a source: every claim on the page still
has its FACTS line.

## Look

Lesson 1's, unchanged: the dark listening room (Obsidian ground, `#161b22` panels, the faint staff
texture, three soft glows), the series colour code (blue, orange, gold for the fit only, violet for
the contrast case, chrome for any other note), Lesson 1's type, the "Find Your Pitch" wordmark, and
its motion rules. The slide guide (Toys, 5) is the page's one pitch-canvas toy: Merc's model path
takes the app's target amber `#f59e0b` (a kit token, `--amber`) only while one of Merc's slides
plays; at rest and on the viewer's turn it is the film's own plain chrome guide (DECISIONS 68 and
79). Nothing on the page draws a voice, so the app's singer violet `#a78bfa` does not appear. Three
things move on their own here: the two Merc idle loops and the spiral's drift (there is no living
staff in this hero). Under `prefers-reduced-motion` all three always stop, and every transition
this page adds (the climb's trail, Look down, Unroll, Straighten, Lift out, the arrows that write a
name, the names flipping, the slide guide's line) lands in its final state with no travel; what the
viewer starts (a tone, a slide) still sounds. For everyone else the masthead's Pause animations
toggle stops the same three (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2), with Lesson 1's departures kept: the Playground (item 9) is
the step toys themselves, not a toy of its own (here gathered on one free-play stage in the Wrap);
the Wrap comes before the episode; and each "Common mix-up" card sits inside the step whose toy
refutes it. New against Lesson 1: the recall check (item 4) runs for the first time, and it comes
straight after the hero, because the cold open (item 3) plays in the hero, beside the spiral it
lights, as Lesson 1's does (DECISIONS 80, where items 3 and 4 swapped; every page has taken this
order since 20 October 2026, MASTER-PLAN § 12 item 13). The practice link sits in the Wrap,
as the anatomy has it; the page has two mix-up cards, one per concept (playbook rule 3); and there
is no series blueprint section (it is the team's, in the Content Studio), so the masthead's anchors
are Lesson, Watch and Explorer. Each section's heading, and the line above it, are in LESSON.md
("Section headings"); the step headings are Tavi's questions (DECISIONS 86).

1. **Masthead**: Lesson 1's (wordmark, "Season 1 · Lesson 02", anchors Lesson, Watch, Explorer, the
   Sound toggle off by default, the Pause animations toggle with its reduced-motion lock).
2. **Hero, with the cold open**: kicker; the hook question as the title; the meta as three chips
   (13 minutes; "After Lesson 1: What is a note?", the prerequisite chip, a link to `/learn/01`;
   Sound on); the promise; the sound gate from LESSON.md, in the hero copy as Lesson 1's is. The
   stage holds the hero spiral (Toys, 1), the lit A3 to A4 turn with its five dim beads, between
   Merc and Tavi on the floor line, with Tavi's guess ("Is there a hidden note between every two
   letters?") and Merc's reply in speech bubbles over it, as Lesson 1's bubbles sit over its stage.
   Under the stage is the cold open's predict card (Toys, 7): two choices (every gap holds a note,
   or only some), the lock hint, and Play the climb, which unlocks on a choice and plays on the hero
   spiral, lighting each bead as it sounds and counting the steps; after the climb, the reveal from
   LESSON.md (twelve steps, not fourteen). It leaves which gaps and why to steps 3 and 4, so step
   3's predict is not given away. Merc and Tavi react here (Merc and Tavi, below). On phones the
   hero stacks as Lesson 1's does (kicker, title, chips, stage, sound gate, predict card, promise;
   `kit/lesson-stage.css:354-397`), so Play the climb sits right under the spiral it lights. There
   the spiral takes the stage's full width above the floor line, at least 250 px tall, and Merc and
   Tavi stand smaller either side of its base: at Lesson 1's phone size, `min(39vw, 160px)` each
   (`kit/lesson-stage.css:439`), Merc and Tavi leave too little room between them for a spiral.
3. **Recall from Lesson 1**: two questions, straight after the hero (see Toys, 6).
4. **Four words you'll meet**: semitone, tone, sharp and flat, cent, each with its one-line
   definition and a play button (A3 to A♯3; A3 to B3; C4 to C♯4; the 100-cent glide).
5. **The steps**: Lesson 1's sticky stage and step deck ("N of 6", Previous and Next, the stage
   beside the text on desktop and above it on phones). Each step has its heading, Tavi's question
   (LESSON.md), its text, one "Try:", one "Notice:" and its toy; on phones, steps 3 to 5 use the
   stage in Toys 1, "On phones" (DECISIONS 83):
   1. "What's the very next note after A?": the spiral (Toys, 1).
   2. "How many steps until we're back at A?": the spiral with Climb and Look down.
   3. "Isn't B to C the same step as C to D?": the keyboard with Unroll and Straighten; the second
      predict (three choices) and its two plays; Play E to F after the reveal; mix-up card 1, with
      Play C to C♯, then B to C.
   4. "So where do the other five come from?": the tile row with Lift out the five; Play C, C♯, D,
      then C to D in the text; and the Semitone or tone? game (Toys, 4), a card under the Notice in
      the step's text column, not on the stage (DECISIONS 82).
   5. "Why does one key have two names?": the tile row with the two-names toggle (Toys, 3), opening
      on the film's signature 3 (C♯ above D♭ on one key under one gold ring); mix-up card 2 with the
      third predict inside it (Toys, 7): the card shows its belief and why it seems right, then the
      predict, whose choice unlocks Play E to F and the stage's Sharp, Flat and Show the rare ones,
      and then, once E to F has played, its evidence and better idea (DECISIONS 85).
   6. "How big is a semitone, exactly?": the semitone ruler with cents (Toys, 2), and the Go deeper
      drawer.
6. **Sing it**: the slide guide (Toys, 5) with Merc's slide, the octave-up slide and the guide; the
   safety line; nothing listens.
7. **Quick check**: Lesson 1's quiz component with LESSON.md's four questions, the film's four
   recap questions (Lesson 1's quick check asks its film's three, and one more): three answers each,
   shuffled (seeded per question), one-line feedback for every answer, a check icon and ink (not
   gold) on the right one. Question 2 has its own play button, Play the two steps: A4 to B4, then
   B4 to C5 (FACTS 52, the film's `quiz-pair`), with "1st" and "2nd" lighting in turn as each step
   sounds; no option names a note, so it is answered by ear. The button and the two chips sit in
   the slot the kit gives a question after its heading, outside the heading that names the answers
   (What the kit and the app still need, 9). The film answers each question with the object that
   taught it (the ring of twelve; the keys A4 to C5 with their "2" and "1" bars; the C♯/D♭ key under
   its gold ring; the ruler with "200 ¢"), so a wrong answer's feedback links back to the step whose
   toy that object is, steps 2, 3, 5 and 6, through the kit's `data-goto-step`; the link sits on
   the misconception's answer, as in Lesson 1's quick check, and question 2's two wrong answers both
   carry it, since "They're the same size" is mix-up card 1's belief. Ids `l02-q1` to `l02-q4`;
   storage keys `fyp-l02-seed` and `fyp-l02-quiz-v1`; `lesson: 2`, so answering all four marks
   Lesson 2 done. The kit rebuilds the questions on every answer, so question 2's play button is
   handled by a listener on `#qs`, as the step links are. Answers stay in the viewer's browser
   (localStorage) until the Lesson telemetry track exists; then each first answer is a telemetry
   event behind consent (MASTER-PLAN Phase 1). A later visit asks them afresh, and Lessons 3 and 4
   will each open with two of them.
8. **Wrap**: the three recap lines and the challenge, then:
   - **The practice card** (LESSON.md): Lesson 1's app card, with Leap's text, today's caveat and
     Contour as an optional first drill; the address line "Practise it free:
     mercurypitch.com/ear-lab, then tap Leap", as the film's end card prints the address, linking
     `/ear-lab?lesson=02` in a new tab, as Lesson 1's card links Voice Mirror, so a first visit
     meets no intro (Practice link, below; FACTS 33b). Its figure is a house-style drawing of Leap's
     twelve answer pads in the app's six columns, each its label over its name (FACTS 32), in the
     page's own colours (DECISIONS 87): m2 and M2 lit, their labels and names in ink on a brighter
     fill; the other ten ghosted, with no fill and a faint outline (ink at 20 %), their labels and
     names in ink-2, 7.7:1 to 8.5:1 on the card's gradient (`--ink-2` #a8b3bf on `--card` #12171e
     and on the gradient's lighter top, `kit/lesson-base.css:17`, `:25`, `:55-59`). It is drawn at
     the card's width, never scaled down, so its text keeps the type scale's 12 px floor; on phones
     a pad's name may take two lines. Its caption: "Illustration: Leap's twelve answers. In Leap:
     m2 = semitone · M2 = tone."
   - **The next-lesson card**: the kit's (`kit/next-card.ts`), Lesson 3's hook and "Start lesson" to
     `/learn/03`, or "Coming later" and the explorer where a build hides it (a draft until its
     sign-off). The page's mount keeps the tease's two figures side by side after the card's words:
     ASKED, 59 %, of 1,105; TESTED, 10–16 %, a semitone or more off (FACTS 36). The film prints the
     second label "≥ 1 semitone off"; the page spells it out in words.
   - **Free play**: one stage with the whole object and every control of the step toys at once (the
     spiral with Climb and Look down; Unroll and Straighten; Lift out the five; the names toggle
     with Sharp, Flat and Show the rare ones; the ruler with One semitone and Glide), switched by
     Spiral, Keyboard, Tiles and Ruler buttons. Nothing locks it: the page's order already puts the
     guided steps first (playbook rule 17: guided first, free play after). Its spiral is a copy of
     its own, with its own lit beads (DECISIONS 81). On phones its stage takes the layouts of the
     steps it repeats.
9. **Watch the episode**: the kit's episode section (`kit/episode.ts`), as Lesson 1's page has it:
   the film as MP4s on R2 in the page's own player, never a YouTube embed, with its chapters, its
   captions and the transcript. Until the files are uploaded the page has no Watch section and no
   Watch link (`kit/films.ts`). See "The episode", below.
10. **Lesson explorer**: Lesson 1's, with Lesson 2 as the current node, selected when the page
    opens. Until the film is published Lesson 2 reads "Ready · read" and its card offers the kit's
    one action ("Start lesson", "Continue: step N" or "Read again"; Lesson 1's spec, item 9)
    without Watch the episode; once the film is published (its sources set in `kit/films.ts`) it
    reads "Ready · watch and read" and Watch the episode joins the action. Its
    Length row is the page's reading time, 13 min (`minutes: 13`), with the film's 7:11 only once
    the film plays. The line under the explorer's heading names no lesson's state: the legend
    (Ready, Coming later, Done) and the cards say it, from the season. Lesson 2 marks done when its
    quiz is finished. Its card's practice link reads as LESSON.md's Wrap: `season.ts` links
    `/ear-lab?lesson=02` with the note "then tap Leap"; the subset launch it still needs is the
    team's (`pr.needs`), kept for the admin console and never drawn on the card.
11. **Footer**: Lesson 1's, with every string as LESSON.md gives it ("Head and footer"): "Season 1
    · Lesson 02 · Twelve notes"; the practice link, printed `mercurypitch.com/ear-lab` and linking
    `/ear-lab?lesson=02`, with "Ear Lab is free: tap Leap."; and the credits as Lesson 1's built
    footer words them ("Voices in the episode: ElevenLabs (Eleven v3).", `learn/01.html:1603-1607`),
    with the episode's sung notes, its synthesised examples and this page's synthesised sound
    (FACTS 41, 50, 51; FACTS, Labels).

## The episode

The film runs 7:11 (431.08 s on its cue sheet, `output/motion/lesson-02/cues.json`; FACTS 54). The
markup prints 7:11 in the line above the heading and under the play button (`<span class="dur">`,
the copy in LESSON.md), and the kit replaces both with the MP4's own length once its metadata
loads, as Lesson 1's page does with 5:14; `onDuration` hands the same length to the explorer
(`explorer.setLength(2, len)`). The `<video>` element's `aria-label` is "Find Your Pitch, Lesson 02:
Twelve notes".

- **Where it plays from**: `src/features/lessons/lesson-02/film.ts`, built like Lesson 1's
  (`lesson-01/film.ts`). Its `FILM_SOURCES` (`{ hd, sd }`, the 1080p and 720p MP4s, the 720p one
  at 900 px and below) is Lesson 2's entry in the kit's film list, `src/features/lessons/kit/films.ts`,
  which the season map reads too. The entry stays `null` until the files are uploaded, and while it
  is null the page offers nothing to watch: no Watch section, no masthead link, no "Watch the
  episode" on the card, the masthead's other links numbered without a gap. The markup ships the
  section and its link hidden, so the page paints without them, and `kit/episode.ts` shows them
  once the entry is set: setting it is the whole change. `FILM_CHAPTERS` and `FILM_CAPTIONS_TEXT`
  read the bundled copies below. The MP4s live on R2 (MASTER-PLAN § 12 item 7), served from R2's
  custom domain (planned: `media.mercurypitch.com`), not `r2.dev`. Of outside hosts, `media-src`
  in `public/_headers` lists only `*.r2.dev` and `*.r2.cloudflarestorage.com` today, so the
  domain goes in there before the entry points at it, or the browser refuses the video. Once the
  episode is on YouTube the section adds a "Watch on YouTube" link; there is no YouTube embed.
- **The files**: the film's `tools/web-video.sh` cuts them all from the delivery master,
  `rc-04-60fps`:
  `lesson-02-1080p.mp4` and `lesson-02-720p.mp4` (H.264 and AAC at 30 fps, moov first) for R2;
  `poster.jpg`, the title card 1.6 s into its scene, 1920 x 1080, for `lesson-02/assets/poster.jpg`
  (Lesson 1's poster is its title card too); `og.jpg`, the same frame at 1200 x 630, for
  `public/learn/lesson-02-og.jpg`, the share card, whose alt text is in LESSON.md ("Head and
  footer"); and copies of the film's `captions/lesson-02.en.vtt` and `captions/chapters.json`.
- **Captions and chapters travel with the film**: when it ships they are copied into this folder's
  `captions/` (the lesson's sources, with the SRT, as Lesson 1's `captions/` holds them) and into
  `lesson-02/assets/` (the page's copies). A `film-sync.test.ts` like Lesson 1's holds the two
  copies equal and checks the speaker labels, and a re-cut that re-times the film changes both
  copies in the same commit as the MP4 URLs. The captions are a same-origin VTT track, on by
  default, whose turns start "BLUE:" or "ORANGE:", as the transcript expects; the transcript is the
  same text, one paragraph per speaker turn, each with its time to jump to.
- **Chapters**: eleven, as the film's `chapters.json` gives them (FACTS 54; each starts where its
  first scene starts; the list prints the minutes and seconds, the jump uses the seconds):

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

Every toy and predict below mounts on a root element, as many per page as the page needs, each
with its own state (What the kit and the app still need, 2).

| Toy                          | Reuses from Lesson 1's page                                                                                                                                                    | New in Lesson 2                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Spiral and keyboard       | Step 5's spiral and step 6's keyboard (`lesson-01/toy-spiral.ts`, `toy-spiral-draw.ts`, `toy-spiral-keys.ts`), promoted into the kit as one component, six copies on this page | Dim beads that light once heard, per copy; Climb; Look down; all keys lit and playable; Straighten; step bars; Lift out the five; the phone stage for steps 3 to 5               |
| 2. Semitone ruler with cents | Step 2's dial (`lesson-01/toy-dial.ts`: its slider, readout and held tone), turned vertical, two copies (step 6, free play)                                                    | The cents scale, the one-semitone zoom, the app-style monitor that flips at 50 cents, the 100-cent glide                                                                         |
| 3. Two-names toggle          | Step 5's per-bead labels                                                                                                                                                       | Sharps, flats or both on every black key, page-wide from one store, both stacked sharp above flat; Sharp and Flat arrows; one gold ring on a key given both names; the rare ones |
| 4. Semitone or tone?         | The quiz's feedback lines (`kit/quiz.ts`) and the tone player (`kit/sound.ts`)                                                                                                 | All new: a ten-round ear game, two answers, a card in step 4's text column                                                                                                       |
| 5. Slide guide (Sing it)     | The Sing it card (`lesson-01/sing.ts`, promoted), Merc's synthesised "ooh", the hum-along ring with Merc's still                                                               | Four lanes; Merc's path at rest in plain chrome, amber only while a slide plays; the plain chrome guide and its sweeping line; the slides themselves                             |
| 6. Recall check              | The quick-check component (`kit/quiz.ts`) and Lesson 1's questions 2 and 4 (`lesson-01/quiz-questions.ts`)                                                                     | Its place straight after the hero, a second quiz on one page, and asking by Lesson 1's ids                                                                                       |
| 7. Predict widgets           | Lesson 1's predict widget (`lesson-01/predict.ts`: choice locks, play buttons unlock, a kind reveal), promoted into the kit                                                    | Three of them: every gap or only some (cold open, in the hero); B to C, the same, or C to D (step 3, three choices); a black key or a white key, from E (step 5)                 |
| 8. Go deeper drawer          | none                                                                                                                                                                           | All new: a disclosure (`details`) for the ratio, the cent's origin and "sharp" and "flat" for a miss of any size                                                                 |

### 1. Spiral and keyboard

One component with four states, so the object the film transforms is one object on the page too.
The page holds six copies of it, each with its own state: the hero's; steps 1 and 2's; step 3's;
step 4's; step 5's; and free play's.

- **Spiral** (the hero, steps 1 and 2, free play): Lesson 1's helix (canvas 2D, projected and
  depth-sorted, three turns A2 to A5, 30 degrees per semitone, A at the front, draggable, slow drift
  except under reduced motion or Pause animations, letters at their angles, C seams with octave
  numbers, tap a bead to hear it). New: the five beads on each turn start dim with a "?" and light,
  keeping their glow, once heard on that copy. Each copy keeps its own lit beads, so the cold-open
  climb lights only the hero spiral and step 1 opens on dim beads (DECISIONS 81). Their names
  follow the two-names toggle. **Climb** (Play the climb, in the hero) plays the thirteen notes from
  A3 to A4 at the film's timing (FACTS 43), lights each bead in turn, runs a step counter from 0 on
  A3 to 12 on A4 (steps, not notes: thirteen notes make twelve steps, FACTS 16; DECISIONS 11) and
  shows each note's frequency in whole hertz as it lights (220 Hz up to 440 Hz, FACTS 43), with a
  gold "· Hz × 2" at the end (the hertz doubled, not "12 × 2"). **Look down** moves the camera to
  the spiral's axis: one turn becomes the ring of twelve, its wedges lit in gold; press again to
  return. Under reduced motion both land in their end state at once.
- **Keyboard** (step 3): Lesson 1's Unroll button and keyboard (A2 to A5 on a wide stage, low notes
  left, A3 blue, A4 orange; its labels "Unroll the spiral" and "Roll it back up",
  `kit/spiral.ts:175-178`), now with every key lit and playable, the black keys named by
  the toggle. Two keys played one after the other draw a step bar between them, a notch per
  semitone, labelled with its number of semitones: "1" and "2" as the film's bars are, and "3" and
  up the same way. Phones show the octave A3 to A4 ("On phones", below).
- **Straighten** (step 3): the octave's keys glide into the row of equal tiles, one per semitone,
  with a "1" under each neighbouring pair and B–C and E–F flashing gold once; press again (Bend it
  back) to bend them back into a keyboard.
- **Lift out the five** (step 4): the five dark tiles rise out of the row; the seven letters show
  five holes labelled "tone" and two touching pairs labelled "semitone"; press Drop back to return
  them, one by one, with "7 + 5 = 12".
- **Predict** (step 3): the predict widget with three choices (B to C, The same, C to D), because
  the eye's guess, "the same", has to be one of them (DECISIONS 13); choosing unlocks Play B to C
  and Play C to D; the reveal (LESSON.md) never tells any choice it was wrong. It sits in the step's
  text, and its plays light the two steps' keys on the stage as they sound.

#### On phones (DECISIONS 83)

Measured from Lesson 1's stage CSS at 390 x 844, the page's phone check: the stage card is 358 px
wide inside the 16 px gutters (`kit/lesson-base.css:96-97`, `:224-229`); its 1 px borders
(`:448-455`), its 12 px side padding below 960 px (`kit/lesson-stage.css:1079-1081`) and a figure's
own 1 px border (`kit/lesson-stage.css:769-777`) leave Lesson 1's canvas 330 px wide, 308 px tall in
the tall figure (`:1083-1089`). That is too narrow for eight 44 px keys, so steps 3 to 5 widen the
figure.

- **The figure**, steps 3 to 5: it spans the card's inner width, 356 px (`margin-inline: -12px`,
  no side borders, square corners), and is Lesson 1's tall figure, 310 px, so its canvas is 356 px
  wide and 308 px tall. The keys and tiles lie left to right, as in the film and on the desktop
  stage, so Straighten is one glide.
- **Step 3, the keyboard**: the octave A3 to A4, all eight white keys, 44.5 px each (356 / 8, no
  key margin), in Lesson 1's proportions (`kit/spiral-keys.ts:119-141`): the keys from y
  111 to y 246, the black keys 84 px deep and 27.6 px wide as drawn. Each black key takes taps over
  a 44 px wide zone centred on it, its full depth; black keys sit 44.5 px apart, centre to centre,
  so two zones never overlap (0.5 px clear). Each white key takes taps across its full 44.5 px in
  the 51 px below the black keys, and wherever no black key's zone reaches. Names sit on the keys;
  step bars draw under them, y 256 to 300. On a phone narrower than 386 px the keyboard shows as
  many white keys as fit at 44 px or wider (seven from 342 px up), from A3, and two 44 px buttons
  under it pan one white key at a time, where Lesson 1's pan an octave (`kit/spiral.ts:314-326`).
- **Straighten**, and step 4's row: thirteen equal tiles across the same 356 px, 27.4 px each. On
  phones they are a picture, not targets: they light as notes play, and every control is a 44 px
  button. A tile narrower than 44 px takes no taps; on the desktop stage the tiles are about 50 px
  and do. In step 4, "tone" labels sit over the five holes and "semitone" labels under the two
  touching pairs, so no two labels share a line.
- **Step 5**: a close-up of the row, B3 to F4, seven tiles at 50.9 px (356 / 7), each a target, as
  the film closes up on the row (S11's lifted C, C♯ and D; S12's tilt over E and F). Everything the
  step asks happens there: C♯ and D♭, E to F, Flat on F, and the four rare names on B, C, E and F.
  The seven tiles stay 44 px or wider from a 342 px phone up.
- **Stage heights** at 390 x 844, from the card's 1 px borders, its 12 px and 14 px top and bottom
  padding, the stage head's 44 px buttons and 12 px gap, the figure label's 16 px line and 10 px gap
  (`kit/lesson-stage.css:699-704`, `:766-768`), the 310 px figure, and Lesson 1's 14 px control gap,
  10 px row gap and 44 px buttons (`kit/lesson-stage.css:874-880`; `kit/lesson-base.css:524-532`):
  - Step 3, 478 px. Under the figure, one row: Unroll the spiral (Roll it back up) and Straighten
    (Bend it back). The predict, its two plays, Play E to F and the mix-up card's play are in the
    step's text below the stage.
  - Step 4, 478 px. Under the figure, one row: Lift out the five (Drop back). The ear game is in
    the step's text.
  - Step 5, 680 px. Above the figure: the names toggle (Sharps · Flats · Both, three 44 px segments
    in one row) and its note, "MercuryPitch's pitch line shows sharps", on two lines. Under the
    figure, three rows: Sharp and Flat; Play both ways; the Show the rare ones switch. The predict
    and Play E to F are in the step's text.
  - Each stays under the 786 px a 390 x 844 screen leaves below the 58 px masthead (`--mast`,
    `kit/lesson-base.css:94`). That is the phone's budget only: beside the text the stage is
    stuck, and every step's stage also fits 1024 x 640 with the masthead, the kit's landscape
    budget (PRODUCTION-PIPELINE.md § 5, `src/e2e/learn-stage-fit.spec.ts`).

### 2. Semitone ruler with cents

Built on Lesson 1's dial: the same log-pitch slider, readout and held tone, turned to stand
vertical (pitch is height).

- A ruler from A3 (bottom) to A4 (top) with thirteen ticks: names on the left (they follow the
  toggle), cents on the right (0, 100 ... 1200). A marker the viewer drags; while dragging, a soft
  tone sounds at the marker's pitch (Web Audio, the dial's envelope).
- Readouts: cents above A3 (0 to 1200, whole cents), the frequency to two decimals (f = 220 x
  2^(c/1200)), and an app-style monitor labelled "How MercuryPitch shows it": the nearest note in
  the app's sharp spelling, and a bar from -50 to +50 cents that flips to the next note at 50 cents
  (FACTS 24, 30). The monitor always uses sharps, whatever the toggle says, because the app does,
  and its marker is drawn in ink at every reading, as the film draws it: the app's green means in
  tune, which is Lesson 3's idea, and its blue is Merc's note (FACTS 30; DECISIONS 28).
- **One semitone** zooms the ruler to A3 to A♯3 with a tick every 10 cents. **Glide** plays the
  100-cent glide (FACTS 25) and moves the marker with it (under reduced motion the readout counts
  while the marker stays put).
- Keyboard: the marker is a slider (`role="slider"`, values 0 to 1200); `aria-valuetext` names the
  nearest note and the distance from it, as the monitor reads, then the frequency, such as "A3 plus
  37 cents, 224.75 hertz" or "A sharp 3 minus 40 cents, 227.76 hertz"; arrow keys move it 1 cent,
  Shift with an arrow 10, Page Up and Page Down 100.

### 3. Two-names toggle

- A segmented control, "Sharps · Flats · Both" (buttons with `aria-pressed`), at the top of the
  step 5 stage and on the free-play stage. Both controls write one page-wide store and show its
  state (What the kit and the app still need, 6), and it relabels every black key, tile, bead and
  lane on the page at once (C♯ or D♭ or both). Default: Sharps, matching the app, with a small note
  "MercuryPitch's pitch line shows sharps". In Both, each black key and dark tile carries its two
  names stacked, sharp above flat, as the film writes them: a dark tile is too narrow for two names
  side by side at a readable size (the film's build decision B21; FACTS, Illustrations).
- **Sharp** and **Flat** buttons: select any key or tile, press one, and an arrow steps one
  semitone up or down and writes the name it gives on the key it lands on: in place of a black
  key's or dark tile's own label while it shows, and above the letter on a white key or tile. A key
  the arrows have given both names gets one gold ring, the fit: one key (the Both labels never take
  a ring). Step 5 opens on the film's signature 3: an arrow climbs one semitone from C and writes C♯
  on the dark tile, another steps one semitone down from D and writes D♭ under it, and the gold
  ring settles round the tile; beside it, **Play both ways** sounds C4 to C♯4, then D4 to D♭4
  (FACTS 49), and runs the arrows again. On step 5's stage, Sharp, Flat and Show the rare ones stay
  locked until the step's predict has a choice (Toys, 7). From E, Sharp lands on F and writes E♯
  above F's own letter, where the film writes it (the predict's evidence); from F, Flat lands on E
  and writes F♭ above E's (the step's Try). A switch **Show the rare ones** adds the four white-key
  second names (E♯ on F, F♭ on E, B♯ on C, C♭ on B; FACTS 20), each above its key's letter.
- The keys' accessible names follow the toggle: "C sharp 4, also D flat 4".

### 4. Semitone or tone?

- A card in step 4's text column, under the Notice, not on the stage (DECISIONS 82). Ten rounds.
  Each plays one step inside A3 to A4, a semitone or a tone, chosen at random from a seeded
  sequence; two answers, Semitone and Tone. Feedback names the keys and the sound, never the
  listener, and names a key between in the toggle's spelling: "E to F: a semitone, no key between
  them", or "C to D: a tone, with C♯ between" (D♭ under Flats, C♯/D♭ under Both). A miss replays
  the step slowly; after two misses in a row the game adds the playbook's line "If that felt
  tricky, good: that's learning" (rule 15). A count "7 of 10" at the end; no rating, no streak.
- A switch **Up and down** mixes in falling steps, because Leap plays both (FACTS 32); off at
  first.
- Two 44 px buttons side by side; keys 1 and 2 answer ("Space replays" until #1177; it never did).

### 5. Slide guide (Sing it)

- Four lanes (G♯, A, A♯, B, labelled with octave 3 or 4 by the slide chosen; their names follow the
  toggle, and each lane's label has its spoken name, such as "A sharp 3"), pitch as height, beside
  the breathing ring of Lesson 1's Sing it card.
- **Play Merc's slide** (A3) and **Play it an octave up** (A4) sound Merc's synthesised "ooh" along
  FACTS 50's contour (A held, up one lane, held, and back, 4.2 s; FACTS 51 an octave up), in Lesson
  1's recipe (partials 1, .62, .38, .24, .14, .08, .045, .025 over a lowpass near 2.6 kHz, vibrato
  5.5 Hz, +-14 cents, grown in over 0.35 s). At rest, Merc's path lies on the lanes as a dashed
  chrome line, the film's plain guide. While a slide plays, the path lights in the app's target
  amber (`--amber`), the model a singer follows (MASTER-PLAN § 5), in step with the slide, and when
  the slide ends it goes back to its chrome rest; meanwhile the ring shows the still of the Merc
  singing it, Merc for A3 and Tavi for A4, as Lesson 1's ring does. Amber shows only while a
  slide plays (DECISIONS 79).
- **Start the guide** is enabled once either slide has played (hear it first: playbook rule 16). It
  is the viewer's turn, so nothing of the app's drawing shows, as in the film from "Now you"
  (DECISIONS 68): the lanes stay plain chrome and Merc's path dashed chrome. It counts in for one
  second, then a vertical chrome line sweeps across the lanes along the path in 4.2 s, with nothing
  riding the path itself, while the ring breathes with Merc's still in its centre, never a
  microphone icon (DECISIONS 65); when the sweep ends the line goes, and the lanes and the path are
  at their chrome rest. Nothing listens and nothing is scored: no microphone on this page. Under
  reduced motion the path's segments light one after another, in chrome, instead of a travelling
  line.
- The safety line from LESSON.md sits under the buttons.

### 6. Recall check

- The quick-check component, straight after the hero (DECISIONS 80), with Lesson 1's questions 2
  and 4 under the `question_id`s Lesson 1's page gives them (proposed: `l01-q2` and `l01-q4`, as
  this page's own are `l02-q1` to `l02-q4`), so one question reports under one id on both pages;
  the first time the page anatomy's item 4 runs. Options are reshuffled from a seed of its own
  (keys `fyp-l02-recall-seed` and `fyp-l02-recall-v1`), not Lesson 1's, and earlier answers are
  never shown, so the answers measure delayed retrieval (MASTER-PLAN § 9). It marks no lesson done.
  On the public host each answer is a telemetry event with its `visit_index`. The kit needs three
  changes for it (What the kit and the app still need, 9): a second quiz on one page, no
  done-marking, and question ids.

### 7 and 8. Predicts and the Go deeper drawer

- All three predicts are Lesson 1's widget, promoted (What the kit and the app still need, 3): the
  choice locks, the play buttons unlock, the reveal plays after the sound and never calls a choice
  wrong. The cold open's has two choices, step 3's three and step 5's two; the widget takes any
  number from two to four, each at least 44 px tall.
- Step 5's asks "One semitone up from E: a black key or a white key?", with A black key and A white
  key, before any arrow can show the answer, as the film holds its 2.0 s `predict-e` pause before
  the sound (DECISIONS 18 and 85). It sits inside mix-up card 2, after the card's belief and why it
  seems right. The choice unlocks Play E to F (FACTS 47) and, on the stage, Sharp, Flat and Show
  the rare ones; once E to F has played, the card's evidence and better idea show, as the reveal.
- The Go deeper drawer is a `details` disclosure, closed by default, under step 6's toy.

## Audio

Every tone is synthesised in the page with Web Audio at the frequencies in FACTS 6, through the
kit's `sound.ts` (`hz()` in `kit/notes.ts` is the same formula), with the house envelope rules
(`.claude/memory/audio-pop-free-playback.md`), started only by a tap; Merc's "ooh" as in Toys 5.
Where the page plays an example the film plays, it takes the film's pitches and timings (FACTS 42
to 52: the first step, the climb, B to C then C to D, C to its black key then B to C, E to F, the
tone split, both ways to C♯, the slides, the quiz's two steps; FACTS 25 for the cents glide). Each
has a control: Play the climb; Play B to C and Play C to D; Play C to C♯, then B to C, on mix-up
card 1 (FACTS 46); Play E to F, after step 3's reveal and in step 5's predict (FACTS 47); Play C,
C♯, D, then C to D, in step 4 (FACTS 48); Play both ways; the slides; and Play the two steps.
Nothing autoplays. The page has no music bed.

## Merc and Tavi

Lesson 1's setup: the app's own renderer (`src/lib/merc/renderer.ts`) through the kit
(`kit/merc-duo.ts`), loaded after first paint, Tavi with the warm look and warm light
(`kit/merc-warm.ts`), one WebGL context per Merc, `medium` quality on phones, turned towards each
other, paused off screen; a still image if WebGL fails, or if WebGL2 would run on the CPU (Lesson 1
WEB-SPEC, Merc and Tavi). They live in the hero, beside the spiral the cold open plays on, and their
reactions are the hero's: Merc `sing` while A3 plays and Tavi `sing` while A4 plays (the climb's
first and last notes), and Tavi `celebrate` once after the cold-open reveal (no sparkles). The
slides play in Sing it, far below the hero, where the ring shows a still of the Merc singing, so
the live pair never needs `ride` (`merc-duo.ts` has `sing` and `celebrate` only). Under
`prefers-reduced-motion` or Pause animations each Merc holds a still frame and skips the reactions;
the buttons and the reveal carry the moment.

## Practice link: what exists and what needs engineering

- Today: `mercurypitch.com/ear-lab` opens the Ear Lab bench; the viewer taps Leap, which offers all
  twelve intervals, plays each pair up or down, and roves the lower note from C3 to A4 (FACTS 32,
  33). The page says so in the Wrap, whose address line reads "Practise it free:
  mercurypitch.com/ear-lab, then tap Leap". The link carries `?lesson=02` (`/ear-lab?lesson=02`),
  which keeps the bench's own `#/ear-lab` boot (`src/seo/render-entry-page.ts` adds the hash only
  when there is none) and lets First Light step aside on a first visit (FACTS 33b).
- First visit (FACTS 33a, 33b): `/ear-lab` boots the full studio, where a visitor with no stored
  welcome flag meets First Light, the studio's intro, before the Ear Lab. A link that carries
  `?lesson=02` steps the intro aside for good before the app renders (the step-aside, shipped in
  `152aad288`), so the page's links open the Ear Lab, and the practice card and the footer carry no
  first-visit line, as DECISIONS 84 planned; nor does the explorer card's note in `season.ts`,
  "then tap Leap" (Lesson explorer, above). Lesson 1's link, `/mirror`, boots Voice Mirror's own
  page, which has no intro.
- Needed (CURRICULUM § 4 item 5, Phase 1 App track): an `ear-drill` launch kind that accepts a bank
  subset, so `/exercises/semitone-or-tone` (proposed slug) opens Leap with only `leap:m2` and
  `leap:M2`. How such a run is rated is decided, pending this App track work (DECISIONS 73): it rates
  on its own track id, never the shared Leap rating, which describes all twelve intervals; its guess
  floor matches the pads it actually shows, 1/2 for two or 1/12 if all twelve show with ten dimmed
  (the drill's `choices` count sets the floor and "must match what the UI actually renders",
  `src/lib/ear/drills.ts:58-60`, `:233-237`); and it passes `updateItem: false`, so the items'
  calibration stays as it is. The controller already supports this through `RunTrack`
  (`src/features/ear-lab/use-identification-controller.ts:59-63`), the way Echo's sung answers rate
  under `echo-sing` (`src/features/ear-lab/EchoDrill.tsx:136-142`; FACTS 34a). The launch should
  also carry `?lesson=02` so First Light steps aside (CURRICULUM § 4 item 6).
- When it ships, the Wrap, the footer, the explorer card and the YouTube description switch to the
  slug; the film's end card keeps `/ear-lab`, as the owner decided (DECISIONS 72), which stays
  valid.

## What the kit and the app still need

Found in the kit and the app as they stand (18 October 2026, read at `4d5891ac0`). Each item says
what it must do. The kit items move Lesson 1's code into `src/features/lessons/kit/`, and Lesson
1's page then imports them from there; nothing is copied.

### The kit

1. **Styles.** Much of the page's styling lives in `lesson-01/lesson-01.css`, and the kit's
   `lesson-sections.css` covers only the quick check, the Wrap, the episode, the explorer and the
   blueprint. Into the kit: the hero stage, bubbles and floor (`.stage-night`, `.bubbles`,
   `.bubble`, `.duo`, `.merc`, `.floor`); the predict (`.predict`, `.choices`, `.plays`,
   `.lock-hint`, `.reveal`); the words strip (`.tickets`, `.ticket`); the steps' stage and deck
   (`.steps-grid`, `.steps-text`, `.step`, `.step-kicker`, `.steps-stage`, `.stage-card`,
   `.stage-head`, `.progress`, `.stage-nav`, `.toy`, `.viz`, `.ro`, `.viz-status`, `.flag`,
   `.controls`, `.slider-row`, `.range`, `.ticks`, `.kb-pan`, `.deck-nav`); the mix-up card
   (`.mixup`); Sing it's ring (`.sing-grid`, `.sing-btns`, `.safety`, `.ring`); and the app card
   (`.app-card`, `.addr`). Lesson 1's own figures stay in its file. New in the kit: the token
   `--amber: #f59e0b` in `lesson-base.css`, the app's target amber (`PITCH_VISUAL_COLORS.reference`,
   `src/features/stem-mixer/pitch-canvas-visuals.ts:8-9`), used only by Sing it's slides; and the
   wide figure for steps 3 to 5 on phones (Toys 1, "On phones").
2. **Toys that mount per root.** Lesson 1's toys bound fixed ids (`#cvSpiral`, `#unrollBtn` and
   `#kbPan`, `lesson-01/toy-spiral.ts:43-50` at `4d5891ac0`; `#cvDial` and `#dial`,
   `lesson-01/toy-dial.ts:21-25` at `4d5891ac0`), so a page could hold one of each. Each kit toy
   mounts on a root element it is given, finds its parts inside it, and any number mount on one
   page, each with its own state and drawn only while on screen (`kit/frame-loop.ts`). This page
   mounts the spiral-and-keyboard component six times (Toys 1) and the ruler twice (step 6, free
   play).
3. **`kit/predict.ts`**, from `lesson-01/predict.ts`, which bound `#predict`, `#lockHint`, `#reveal`
   and `#revealGuess` (`lesson-01/predict.ts:23-27`, `:100` at `4d5891ac0`): mounts per root, three
   on this page; two to four choices, each at least 44 px tall; it is given the play buttons and any
   other controls its choice unlocks (step 5's Sharp, Flat and Show the rare ones), and the reveal
   it shows once the sound has played; it never calls a choice wrong.
4. **`kit/sing.ts`**, from `lesson-01/sing.ts`, which bound the ring's parts and the two sing
   buttons by id (`#ringProgress`, `#ringBreath`, `#ringRipples`, `#ringMerc`, `#ringNote`,
   `#ringState`, `#ring`, `#singA3`, `#singA4`; `lesson-01/sing.ts:24-57` at `4d5891ac0`) and draws
   Lesson 1's app-card figure (`#mirrorFig`, `lesson-01/sing.ts:28`): mounts per root; the breathing
   ring with the still of the Merc singing and the buttons it is given; the slide guide (Toys 5)
   plugs into it; an app card's figure stays the lesson's own.
5. **The hero's sky**, from `lesson-01/hero.ts`: its stars, mounted on the hero stage. The living
   staff and the pitch rail stay Lesson 1's; this hero has a spiral copy where Lesson 1 has its
   rail.
6. **One page-wide store for the names toggle** (`kit/names.ts`, proposed): Sharps, Flats or Both,
   opening on Sharps every visit (not stored). Both toggles (step 5's and free play's) write it and
   show its state; every copy of every toy, the lanes, the ear game's feedback and the figures'
   accessible names read it and redraw when it changes.
7. **Lit beads, per copy.** Each spiral copy keeps its own; they are not in any shared store
   (DECISIONS 81).
8. **`kit/step-deck.ts`**: one toy per step stays (`toyFor`, `step-deck.ts:50-51`); the ear game is
   in step 4's text, not on the stage (DECISIONS 82). Optional: open at the step a `#step-N` address
   names, so Lessons 3 and 4's recall links can open a step here (Lesson 3 WEB-SPEC, "New
   engineering", 6).
9. **`kit/quiz.ts`**: three changes, so two quizzes can share a page: a root element or id prefix
   (it binds to `#qs`, `#scoreN` and `#quizReset` and writes ids `q0` and `fb0` onwards); `lesson`
   optional, so the recall check marks no lesson done (it marks `lesson` done once every question
   has an answer); and a question `id`, the telemetry's `question_id` (`QuizQuestion` had none,
   FACTS 35a). And two more, for this page and the pages that reuse its questions: a slot after a
   question's heading, outside the `<h3>` that labels its answers (`quiz.ts:306`), for the
   question's own controls, so question 2's Play the two steps and its "1st" and "2nd" chips do not
   become part of every answer's name (Lesson 3's recall asks question 2 with its button too); and
   a rule for a question reused on another lesson's page: there its "Try Step N again" is a plain
   link to this page (`/learn/02`, or `/learn/02#step-N` once the step deck opens at a step), never
   `data-goto-step`, which would open the reusing page's own step N (Lessons 3 and 4 already write
   it so).
10. **`kit/explorer.ts`** and **`kit/season.ts`**: the current lesson (it selects Lesson 1 when it
    opens); a link to its own page for a ready lesson that is not the current one (its card's
    actions are same-page anchors, so from this page they would open Lesson 2's); a poster per
    lesson (`poster` is Lesson 1's, and the poster figure's alt text names Lesson 01); and a state
    for a lesson whose page is live and whose film is not published, "Ready · read", whose card
    offers its action without Watch the episode (built: `kit/lesson-state.ts` gives the state and
    the action, and Lesson 2's entry carries `minutes: 13`, its film's `len: '7:11'` for the team,
    and `film: 'production'` until the film is published). Its practice note is "then tap Leap":
    a lesson's link skips the app's intro since the `?lesson=` step-aside shipped (item 18).
11. **`kit/notes.ts`**: the sharp and flat names of the five (`letterOf` returns null for them,
    Lesson 1's unnamed beads), in signs ("C♯4") and in words ("C sharp 4"), for the toggle, the
    labels and every accessible name.
12. **`kit/sound.ts`**: Merc's voice along a contour of holds and exponential glides (FACTS 50), for
    the slides; a voice holds one pitch today, and `setFreq` moves it by a time constant, not a
    glide of a set length.
13. **`kit/episode.ts`**: the "Watch on YouTube" link, once the episode is there.

### The app and the site

14. `vite.config.ts`: `/learn/02` served from `learn/02.html` in dev and preview, as
    `LESSON_01_PATH` is, and `learn/02.html` as a build input beside `lesson01`.
15. `src/lib/sw-runtime.ts`: `/learn/02` and `/learn/02.html` in `STANDALONE_DOCUMENT_PATHS`, so the
    service worker leaves the lesson alone.
16. `public/sitemap.xml` (`https://mercurypitch.com/learn/02`) and `public/llms.txt` (its "Lessons"
    list, the entry in LESSON.md, "Head and footer"); `public/learn/lesson-02-og.jpg`, the share
    card (The episode, above).
17. Lesson 1's page, when this one goes live: no edit. Its Wrap's next-lesson card
    (`kit/next-card.ts`) and its explorer take each lesson's state from the season, so the card
    reads "Start lesson" and links to `/learn/02` once the season gives this lesson its page.
18. **The `?lesson=` step-aside** (CURRICULUM § 4 item 6; MASTER-PLAN § 7, the Phase 1 App track):
    shipped in `152aad288`. A launch that carries `?lesson=02` skips First Light (FACTS 33b), so the
    first-visit line has gone from the practice card, the footer and the explorer card's note
    (item 10). Recording which lesson sent the viewer has not shipped: the step-aside sends no
    analytics event and stores no lesson number; it holds the number in memory for that page load
    only, so What's New can tell a lesson's first visit from a return
    (`src/stores/onboarding-store.ts:263-266`, `:298-306`).
19. **The `ear-drill` launch kind with a bank subset** (CURRICULUM § 4 item 5): Practice link,
    above.

## Contract

Lesson 1's contract, unchanged and binding, including what its page on the app changed from the
preview (Lesson 1 WEB-SPEC, "On the app"): no CDN at all, self-hosted fonts, Web Animations in
place of GSAP, and practice links that carry `?lesson=02`. Then the layout, accessibility, sound,
motion and storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text
children, touch targets of at least 44 px with no two tap zones overlapping, visible focus, a single
dark theme with every colour a token and an explicit body background, sound only after a tap,
localStorage only for per-viewer conveniences inside try/catch, and the whole page usable with no
sound, no WebGL and no storage. Every ♯ and ♭ the page prints in text (buttons such as "Play: A to
A♯", headings such as question 3's, the step text, the lane labels) has a spoken name: the sign is
`aria-hidden` and a visually hidden word follows it (`.sr`), so a screen reader says "A sharp" and
"D flat"; the figures' accessible names already use words. Page QA before publishing
(PRODUCTION-PIPELINE § 5) adds three checks for this page: every black key and tile reachable and
named by keyboard in each toggle state; the ruler's slider operable by keys alone; and, at 390 x
844, steps 3 to 5's stages at the heights in Toys 1 ("On phones"), with every key and tile that
takes taps at least 44 px wide.
