# Build decisions (film project)

> A copy of the film project's `DECISIONS.md` (`output/motion/lesson-02/`, gitignored, in the
> Lesson 2 pack), taken when `rc-04-60fps` shipped on 18 October 2026.

One line each, with the reason. These are the film build's own calls. The lesson's planning
decisions are in `docs/plans/find-your-pitch/lessons/02-twelve-notes/DECISIONS.md`, numbered
from 1; to keep the two apart, these are numbered B1, B2 and so on. Newest last.

- **B1.** Scratch voices are Lesson 1's: Blue `am_michael` at 0.84, Orange `af_heart` at 0.9 (local
  Kokoro-82M). Blue's is provisional: the owner is choosing a new scratch voice, so every scene,
  Merc pass, the mix and the captions key off cue names and words, and a re-voice re-runs steps 4
  to 8 (BUILD-GUIDE, "A re-voice").
- **B2.** Word times come from the voice model itself: Kokoro's phoneme durations, read from the
  graph in memory, matched to the script's words and calibrated on the envelope (tools/tts.py,
  `tools/CHANGES.md`). Scenes tie events to words with `L.word`, never with seconds typed after a
  line's start, because the storyboard ties most events to a word.
- **B3.** The storyboard's times are an estimate at 2.6 words a second; the voiced cut runs at 2.77
  and is 17.5 s shorter (6:32.7 against 6:50.2). Builders translate with `tools/board-clock.py`.
  A move keeps its storyboard length and is anchored by its start (a drop is 0.4 s, a hop 0.6 s,
  a push 2.0 s), never by two mapped ends, which would stretch or squeeze it.
- **B4.** The Merc bundles are built from `src/lib/merc` as it stands at the repository's HEAD
  (`71e709ed2`; the folder last changed in `af4018810`), read-only, by Lesson 1's
  `tools/build-merc.mjs`; every shader swap still matched once. This build has `glideMouth`,
  which the slides' `ride` needs for the "ooh" mouth (Lesson 1's 6ef814b06 build did not).
- **B5.** No Merc pass is rendered in phase 1: the talking mouth follows each line's envelope, and
  Blue's voice is about to change. The shot files exist (`merc/shots/`); m14-duo is about 6950
  frames for each Merc, so it goes first once the voice is final (PRODUCTION-PIPELINE trap 9).
- **B6.** The spiral is Lesson 1's geometry and projection, promoted into `assets/lib/spiral.js`,
  with two changes: a lit chrome bead has the storyboard's soft 16 px glow, not Lesson 1's wide
  halo (with 37 beads the halos hazed the frame), and the letters sit beside their beads on the
  side away from the axis as seen, not at radius 344 in 3D, because at the front view the
  letters of the back of the turn (D, E) landed on their own beads.
- **B7.** The monitor is one drawing (510 x 340) scaled: at 1.4 it fills S13f's box exactly (x 900
  to 1614, y 232 to 708); at 0.8 it is 408 x 272 from (1400, 160), 12 px narrower than HANDOFFS'
  S14 box, which cannot be the same drawing at 0.8 (its 30 px padding is not scaled).
- **B8.** The ring timer is Lesson 1's predict ring (an ink arc on a faint chrome track), not its
  aqua recap ring: in Lesson 2's code aqua belongs to the chapter numerals.
- **B9.** The "you are here" marker keeps the app's geometry (the dot 14 px inside the canvas, the
  pill from 25 px in) at the film's size (a 30 px label); the app's 12 px label would not read.
- **B10.** m01-blue points only through "Seven letters," and talks the rest of b3: the renderer's
  `point` has no talking mouth, and the Merc whose voice plays must be seen to speak.
- **B11.** The m01 passes run to S1's end: voiced, o2 lasts 2.05 s, shorter than the board's 2.4 s
  slide out, so the exit's timing stays a scene choice and the pass covers it either way.
- **B12.** Kit lab pages live in `lab/kit-src/` and render with `node tools/lab.mjs kit:<name>`;
  their stills are in `lab/kit-<name>/`.
- **B13.** The owner has chosen ElevenLabs voices: "Orange Merc" (`p2JfZCXWY245UrEylK7q`, Eleven v3)
  for Orange and D2 for Blue, whose lines wait until D2 reaches the connected workspace. The
  director imports the takes (`output/motion/voice-elevenlabs/import.py`: Kokoro's edges and
  loudness, the lesson's own envelope, word times from a local Whisper matched to the script and
  calibrated as Kokoro's are) and re-times with `cues.py --no-tts`. The clock moves twice. A
  scratch preview with Orange's 12 takes, which run 6.1 s longer than Kokoro's, puts the film at
  398.80 s (162 wpm while speaking). `assets/voice/` and `cues.json` stay on Kokoro until the
  director imports.
- **B14.** No scene file holds a typed second: every time is a cue, a word or a duration, written
  through `at()` and `word()`, with only 0 (the cut) and `D` bare. `tools/clock-lint.py` checks it
  and is part of proving a scene; placeholders take their length from the table at run time.
- **B15.** Orange's final voice is in (director, 17 October 2026). Her 12 lines are the owner's
  ElevenLabs voice "Orange Merc" (`p2JfZCXWY245UrEylK7q`, Eleven v3, one take a line), brought in
  with `output/motion/voice-elevenlabs/import.py`. The replaced Kokoro files are in
  `assets/voice-kokoro/`. Then `cues.py --no-tts`, the mix, the root, the shot files, the captions,
  the chapters, SCRIPT.md and the board clock were regenerated. The clock went from 392.71 s to
  398.80 s, the hook ends at 0:21.67, and `check` passes. Blue's 55 lines stay on the scratch voice
  until the owner's D2 voice is reachable from the connector. Their import will move the clock
  again, which is why B14 holds.
- **B16.** Blue's final voice is in (director, 17 October 2026). Blue's 55 lines are the owner's
  ElevenLabs voice D2, "Merc V1 Gentle Whimsical D2" (`B4fBPRmasEsTgd6YlSok`, Eleven v3, one take a
  line), imported as in B15. The import now trims a lone click at either end of a take: b35 ended
  with one, 0.37 s after the speech. The clock went from 398.80 s to 431.08 s (7:11), and the hook
  ends at 0:22.97. D2 speaks at about 2.43 words a second, so the film is 11 s past the brief's
  7:00 ceiling, as DECISIONS 56 in the plan predicted for 2.4. Its trims (b10, b21's last clause,
  b52a with S15g) would save about 11 s together. Long pauses inside takes add only 4 s in all,
  most of them between sentences. The owner decided (17 October): the film may run up to 10
  minutes, so nothing is cut and 7:11 stands. The length target is now up to 10:00.
  `captions.py` now lets a short sentence take the next sentence's first clauses when it cannot take
  the whole sentence: b26's "Yes." alone was up for 0.63 s, under the 5/6 s minimum. The builders
  were told the clock moved.
- **B17.** Word times come from forced alignment, not Whisper (director, 17 October 2026).
  Measured on Lesson 1's scratch takes against Kokoro's own phoneme times, Whisper small.en's word
  starts, even after calibration, were about 0.19 s early with as much spread again. So every
  `word()` anchor in this film sat about 0.2 s before its word (up to 0.37 s for one word in ten).
  `voice-elevenlabs/ctc_align.py` (wav2vec2-base-960h, given the script's words) plus the same
  calibration matches Kokoro's times to 5 ms for the median word and 60 ms for nine in ten. All 67
  lines' word files were redone (`import.py --words-only`): word starts moved 0.20 s later on the
  median, 0.37 s at p90. Line starts, the clock (431.08 s) and the scene cuts did not move; scenes
  keyed to words follow on their own (B14). The Whisper word files are kept outside the project.
- **B18.** m10-orange is rendered facing left and mirrored in s10 (director, 17 October 2026).
  The renderer's first hop always arcs right (`src/lib/merc/sim-choreo.ts`, HOPS slot 0), and
  only m10 exits left (the storyboard's S10d: "On 'Yes' Orange hops out left"); builder 2 saw the
  hop lean right while the scene carried him left. Mirrored, he faces right, toward the tiles, and
  hops left with the carry. His highlight is on the other side for those six seconds. S7 to S8 and
  S8a carry the key names across the cut, landed in S7's push, as HANDOFFS § Inside C has them
  (builders 1 and 2 asked; confirmed).
- **B19.** Renders are authorised, and the film rounds start (director, 18 October 2026). The
  brief said `renders: ask`; the owner's answer came on 17 October: "Let me know when first two
  lessons films are done", so both copies of the brief now say `renders: pre-authorized`. The root
  check passes (review/check-2.log: 0 errors; left for the critic to judge are one layout warning,
  s13's "100" at 4:42-4:47, and seven infos: six texts over the Mercs' floor reflections in s14 and
  s15, and one "C" overlap at 3:40.9). Builder 1's layout round marked three designed stacks
  (S1's "× 2" over "octave", S5's counter over "STEPS", S6's "HALF STEP" under "semitone") and gave
  S5's and S6's readouts and gap labels their own zones. As Lesson 1 did, the first film round
  reads a 30 fps draft (`renders/draft-01.mp4`, about an hour); release candidates render at 60 fps.
- **B20.** Critic 11's answers (director, 18 October 2026). The close's Mercs were never placed:
  s14 to s17 guarded L.merc with `getElementById(SID + '-' + pass)`, an id the static tags do not
  have (`s14-m14-duo-blue`, not `s14-sing-m14-duo-blue`), so all four videos sat unplaced at the
  frame's top-left, orange on top with blue's sound arcs round her: what critic 11 read as orange
  speaking blue's lines over six texts (its items 1 and 2). The passes were right. Each scene now
  hands L.merc its own tag ids (`video`, `reflVideo`), and a clearance check (`lab/s13-cents/
merc-clear.mjs`) finds no Merc over any text in S13 to S17. A pass's drop falls from above its
  own square, so its frame top cut the body for about 0.4 s in S4 (m05), S13a and S14a (item 5): a
  soft fade over the square's top now lifts as the Merc lands. The shared label block keeps every
  label on one side for its whole life and moves it smoothly (item 3: "+25 Hz" flipped sides five
  times in 0.5 s; letters jumped too). Card 2 dims the spiral to 12 % (item 4). The dark tiles are
  #2a313b with a 2 px chrome rim (#c3ccd6 at 65 %; the rim 6.3:1 on the stage, the face 1.44:1) in
  the kit's `tiles.js`, so S9 to S13 and S15 all change (item 7). Holds (item 8): S10's pulses start
  0.45 s earlier; S13's bead grows 0.3 s before "tells" and its monitor lands over 1.0 s; S14's
  guide pushes in 3 % across the your-turn stretch. The zoom-through's light is chrome grey, not
  white: mean brightness peaks at 123 of 255, was about 240 (item 9). Item 10: S10's Orange at 270,
  29 px inside the edge; S8's pills at 0.95 scale (capitals about 29 px); S10's "tone" labels 40 px;
  card 4's baseline at 340 (41 px above the tiles); S15's grid legend 40 and 48 px; S17's "In Leap:"
  44 px, as large as the gap between the Mercs allows (three lines at 56 px would be a layout
  change, not made). Item 6, the close's frame balance, is not redesigned: with the Mercs on the
  floor, S14 reads as a stage; S15 stays top-heavy as the board sets it. Critic 12 judges both.
  Release candidates render at 60 fps from rc-01.
- **B21.** C♯ and D♭ stay stacked on their tile (director, 18 October 2026). Critics 11 and 12 noted
  that the brief's signature 3 has both names "side by side" under one gold ring, while the film
  writes D♭ under C♯. The approved board (S11c: "writes "D♭" under "C♯"", and "sharp above flat"
  for the other four dark tiles) asks for the stack, and a dark tile is too narrow for two names
  side by side at a readable size. The film keeps the board; the brief's wording is corrected in
  both copies. Neither critic ranked it as a problem.
- **B22.** Critic 12's answers (director, 18 October 2026). The drops: the renderer's drop starts
  above each pass's own square, so for about 15 frames a pass holds only the Merc's lower half, and
  B20's soft top fade still read as a hard edge in the film (47.85, 268.33, 306.36). Each Merc now
  stays at opacity 0 until the first frame in which its whole body is inside its square, then fades
  in over 2 to 3 frames, and the pass's last bit of fall and its landing play as rendered (m05
  from frame 37, m13 and both m14 passes from frame 28, at 60 fps; counted from the tag's
  data-start, since HyperFrames 0.8.97 extracts from the keyframe before the media start). The
  recap's cards land with their questions; the S13 statement fills the empty right side; the
  lanes keep the board's size (critics 11 and 12 asked for full-frame lanes; neither ranked it
  as blocking).
- **B23.** Critic 13's answers: the close restaged (director, 18 October 2026). With the critic
  items closed, what kept the film from sitting beside Lesson 1 was staging: S15's recap of text
  cards on an empty stage and S14's mid-frame lanes (raised in all three film rounds). S15 now
  follows Lesson 1's recap: each card arrives with its answer object ghosted on stage, which lights
  on the answer; cards crossfade in place; the Mercs stay full size on the floor (230 and 1690 at 420) from S14 through S15, so the board's move to the small corner sizes is dropped. S14's lanes
  run full width with a keyboard rail, as Lesson 1's do, the monitor inside the lane field. m13's
  drop now leads o8 by 0.6 s (its pass re-rendered, about 5 minutes), so Orange is there as she
  speaks, as m05 is at 48.25. m14's drop cannot lead b41 without re-rendering both 125 s passes
  (about five hours each, and the drop would start before the S13 to S14 cut), so S14 opens on a
  materialise instead: landing rings and a burst of sparkles at both Mercs' feet from the cut until
  the bodies fade in, 0.48 s into b41. Builder 2 restages S14 and builder 3 S15, with the Mercs'
  places as the contract between them.
- **B24.** S14's guide stays at full to the cut (director, 18 October 2026). The board dims the
  plain guide to 20 % as the your-turn pause ends and fades its names; with S15 now opening straight
  on card 1, that left 357.3 to 357.635 near-empty (critic 13, item 2). The turn's own type
  ("Your turn.", the safety lines, the chip, the ring timer, the cursor) still leaves when the
  pause ends; the guide, its names and the rail stay until the cut changes the picture. S14's lanes
  run at 120 px a semitone (the board's 160 would not fit full width above the Mercs) with a
  keyboard rail at x 30 to 150 and the octave-up names at x 236; the far staves end on S15's own
  call, so they meet at the cut.
- **B25.** Critic 14's answers (director, 18 October 2026). Builder 2 takes S13's tail with S14, so
  the lane field, rings and rail grow out of the S13 axis from about 304.6 and the cut stays exact,
  and eases Orange's slide-ins to 0.25 to 0.35 s; builder 3 makes the recap's swaps sequential (out
  over 0.12 s, then in) and re-stages Q2 (large keys under the question) and Q4 (a full-height
  ruler); builder 1 pushes in for the S5 climb and pulls back for "× 2".
