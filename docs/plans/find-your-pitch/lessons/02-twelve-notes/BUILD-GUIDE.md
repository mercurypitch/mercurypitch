# Build guide: scene builders for Lesson 2, "Twelve notes"

Read this, then your scene sheets below, then the kit (`assets/lib`, summarised under "The kit").
Everything that binds you is in the approved documents, read-only, in
`docs/plans/find-your-pitch/lessons/02-twelve-notes/`:

| Document                                  | What you take from it                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `STORYBOARD.md` (v11, approved for build) | Your rows; § The world, § Codes, § Type (every pulse, label and dim rule); **§ Build checks, which is binding** |
| `HANDOFFS.md`                             | Your entry and exit frames, to the pixel; § Shared formulas                                                     |
| `FACTS.md` (copy in this folder)          | The only source for any number, name or claim on screen                                                         |
| `BRIEF.md` (copy in this folder)          | What must read with the sound off; what must never appear                                                       |
| `SCRIPT.md`, `DECISIONS.md`               | The words as written; why each choice was made                                                                  |

In this folder, `SCRIPT.md` is the voiced script on the current clock, `DECISIONS.md` the film
build's own calls (B1 on), and `tools/CHANGES.md` every change to the tools since Lesson 1.

Also read `docs/plans/find-your-pitch/PRODUCTION-PIPELINE.md` § 3 and the traps in § 4, above
all 3 to 6 (Merc tags), 7 (blending stops at the nearest stacking context), 12 (dim strokes,
never labels), 13 (motion measure.py can see), 14 (only the speaker shows arcs) and 15 (closing
passes run past the end).

## The clock: never type a second

The storyboard and HANDOFFS are timed to an **estimated** cue sheet: every line at 2.6 words a
second. The numbers in this guide are on the Kokoro scratch clock of 17 October: **392.71 s
(6:32.7)**, 17.5 s shorter than the storyboard, at 2.77 words a second. That clock moves twice
more. The owner has chosen ElevenLabs voices: Orange's takes are being imported now (a scratch
preview puts the film at 398.80 s, with every scene from s05 on later by up to 6.1 s), and Blue's
lines follow when his voice is available. So every number here, in `cues.json` or in a still is
for orientation only, and a scene that keys off cues and words follows both moves untouched.

- In a scene, every time is a cue, a word, or a duration:
  - `at('b6')`, `at('b6', 'end', -0.2)`, `at('first-step', 'start', 1.0)` for cue edges;
  - `word('b6', 'an A')` for the start of a phrase in a line, `word('b6', 'up', 'end')` for its
    end, `word('b6', 3)` for a word by index, `word('b21', 'semitone#2')` for a second occurrence.
- The only bare times a scene may hold are `0` (the cut) and `D` (the scene's end). A time
  measured from the cut is written from the cue the cut sits on: `const T0 = at('title')`, then
  `seg(t, T0 + 0.31, T0 + 0.93)`. Scenes cut on a mark start 0.15 s before it, so `at('act2')` is
  0.15 in scene time.
- `python3 tools/clock-lint.py compositions/<scene>.html` finds typed times and must print
  nothing. It flags a bare number given as a time to the kit's timing calls, a camera move, a
  `L.track` move, a time key, a GSAP position, or a comparison with `t`. It also flags any number
  that equals a cue or word edge, and `at(line, 'start', x)` deep inside a spoken line. A line that
  must keep such a number (a pixel that happens to match) carries `// clock-lint: ok`.
- Translate any storyboard time with `python3 tools/board-clock.py <seconds> ...`: it names the
  anchor and prints the call to write. `python3 tools/board-clock.py --scene <id>` lists every cue
  and word of a scene on both clocks; with no argument it prints the drift by act.
- Gaps and sound lengths are the same on both clocks, so an offset inside a sound (`at('climb',
'start', 0.42 * k)`) or after a cue's end is exact. Inside a line, key to the word.
- A short move keeps its storyboard length and is anchored by its start: a Merc drop is 0.4 s, a
  hop 0.6 s, a slide in or out 0.4 s, a push or pull its stated length (2.0 s, 1.4 s...). Never
  map both ends of a short move; the voice would stretch or squeeze it.
- A long lead move (a 120 to 150 px pan, truck or slide under a stretch of pulses) runs between
  the anchors of the stretch it carries, so it keeps its role when the voice changes; check that
  content still travels at least about 8 px a second in its middle.
- A move that spans a cut is written the same way in both scenes: the same anchors, the same
  curve (`L.ease` is GSAP's own), so both sides evaluate one curve.

## Your files

- You own only your scenes: `compositions/<scene-id>.html`, and `lab/<scene-id>/`.
- Do not edit `index.html`, `assets/**` (the kit, cues, scenes, audio, Merc), `tools/*`,
  `script.json`, another builder's scene, or anything outside this folder. If the kit lacks
  something, write it inside your scene and say so in your report; the director may promote it.
- `assets/scenes.js` and each scene's `data-duration` are generated (`tools/gen-root.py` keeps the
  attribute in step on every re-time). Write the skeleton's `DUR` from `assets/scenes.js`.
- `cues.py`, `mix.py`, `gen-root.py`, `merc-shots.py` and `merc-pass.mjs` are the director's: they
  rewrite files every builder shares. Ask; do not run them.
- Merc passes are not rendered yet (the voice will change). Write the static tags your sheet
  lists, run `python3 tools/merc-tags.py <scene-id>` (your own scenes only; with no scene id it
  rewrites every builder's tags), and build around them: a missing pass renders as nothing (trap
  3). Merc placement is proved in a lab clip once the passes exist (trap 5).

## The scene skeleton

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <div
      id="ID"
      data-composition-id="ID"
      data-start="0"
      data-duration="DUR"
      data-width="1920"
      data-height="1080"
    >
      <div class="scene" id="ID-scene"></div>
      <!-- Merc tags, static (trap 4), then python3 tools/merc-tags.py ID:
           <video id="ID-m14-duo-blue" data-merc="m14-duo-blue" class="clip" muted playsinline></video>
           <video id="ID-m14-duo-blue-refl" data-merc="m14-duo-blue" data-merc-refl class="clip" muted playsinline></video> -->
      <script>
        ;(function () {
          const SID = 'ID'
          const D = L.dur(SID)
          const at = (cue, edge, off) => L.at(SID, cue, edge, off)
          const word = (line, which, edge, off) =>
            L.word(SID, line, which, edge, off)
          const root = document.getElementById(SID + '-scene')
          const room = L.room(root, { floor: false }) // far, mid, near, top, hud
          const rig = L.rig(room) // the camera: add moves in time order
          const tl = gsap.timeline({ paused: true })
          // build every object once here, then draw it every frame from t:
          L.clock(tl, D, (t) => {
            rig.apply(t)
            // ...
          })
          window.__timelines = window.__timelines || {}
          window.__timelines[SID] = tl
        })()
      </script>
    </div>
  </body>
</html>
```

`L.clock` runs on every seek; draw everything from `t` (scene time). Film time is
`L.scene(SID).start + t`; draw anything that travels across a cut (a glow, an orbit, a drift)
from film time so its phase matches (HANDOFFS § Shared formulas).

## Rules that cost a render

- Every animated value is a function of timeline time. No `Date.now`, `Math.random`,
  `requestAnimationFrame`, `setTimeout`, CSS animations or transitions, `repeat: -1`. Use
  `L.rng(seed)` for scatter.
- Never put a CSS `transform` on an element GSAP also animates; a second `fromTo` on the same
  target and property needs `immediateRender: false`. The kit draws per frame, which avoids both.
- Never tween `visibility`, `display` or `autoAlpha` on a `.clip`; never set `visibility: visible`
  (Lesson 1 decision 32: it overrides the runtime's hidden host). Fade an element's opacity.
- `<video>` tags are static in the HTML, `class="clip"`, `muted`, `playsinline`, timed by
  `tools/merc-tags.py` (trap 4); `L.merc()` adopts and places them.
- No `<br>` in text. Fonts only from the kit. No network fetches.
- Type: kickers JetBrains Mono 500 30 px, essential labels 48 px or more; nothing essential below
  y 896 (the caption band); every settled label at 4.5:1 or better. **Dim strokes and fills, never
  labels** (trap 12): a label whose group dims is hidden while it is dim, or set at a level that
  passes (on the ground ink 16:1, ink-2 8.9:1, ink at 55 % 5.4:1).
- ♯ and ♭ are Noto Music paths (`L.spell`); the app's own labels keep `#` ("C#4", "A#3").
- On-screen words are a label, a number or the key term, never a narrated sentence.
- Gold is the fit only, one thing at a time; an answer pill gets a check (ink), never gold.
  Orange's guesses are dashed ink-2 with a "?" (`L.GUESS`). Violet is only the canvas's singer.
- Only the Merc making the sound shows arcs (trap 14): the passes already do this; never add a
  `listen` anywhere.

## Motion: what measure.py sees

The storyboard's motion rule is checked on pixels (STORYBOARD § Build checks). Measured on this
kit (`lab/kit-pulses/`, a clip with one event a second over a still row): a tile scaling 1.05, a bar
growing 15 % and a dark tile lit to 60 % chrome each register about 0.6 s (a 0.1 s hold falls at the
top of the 0.15 s rise); a 64 px label scaling 1.2 registers 0.7 s; an echo ring 0.5 s; a long tile
pulse 0.8 s; an edge glow (an accent) 0.1 s. So count a tile, bar or lit-area pulse as 0.6 s, not
the board's 0.7, when you budget a stretch. Holds: none longer than 0.5 s outside the end card;
no more than about 1.8 s per 30 s in a clip with no Merc.

## The kit

`assets/lib/scripts.txt` lists the files in load order; the root, the labs and the text sweep load
the same list. Every maker builds once and draws per frame. Positions are in the layer you draw in;
`rig.map(x, y, t)` turns a mid-layer point into screen pixels for type in the top layer.

| File                           | What                                                     | Key calls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lesson.js` (Lesson 1's, plus) | timing, room, beads, staff, Merc layering                | `L.at`, **`L.word`** (word timing), **`L.ease(name)`** (GSAP's curve), `L.clock`, `L.room(root, { floor })` (now with `hud`, frame-fixed type above the vignette), `L.bead`, `L.hop`, `L.dust`, `L.merc`, `L.staff`, `L.note`, **`L.afterFonts`**                                                                                                                                                                                                                                                                   |
| `motion.js`                    | progress, pulses, echo rings, camera                     | `L.prog(t, t0, dur, ease)`, `L.track(t, v0, moves)`, `L.env`, **`L.pulse(t, times, 'tile' \| 'key' \| 'bar' \| 'label' \| 'bead', { long })`**, **`L.lit(t, times)`**, **`L.echoRings(svg).draw(t, [{ t, x, y, r }])`**, **`L.rig(room)`**: `.push(at, dur, { s, cx, cy }, ease)` (a push from 1x is a true push about its centre), `.centre(...)` (a pan when pushed), `.pan`, `.tilt` (every layer alike), `.truck` (parallax), `.slide(layer, ...)` (an arc's layers), `.apply(t)`, `.map(x, y, t)`, `.scale(t)` |
| `marks.js`                     | type and marks                                           | `L.kicker(hud, '<b>2</b> · The keyboard')` (baseline (120, 110), aqua numeral), `L.chapterCard(hud, { num, title, baseline: 612 or 360, tIn, tOut })` (Lesson 1's act card), `L.ringTimer`, `L.pill(htmlLayer, text, ...)` with `check`, `L.listenMark`, **`L.spell`** (labels with ♯ ♭ paths), `L.bracket`, `L.arrow`, `L.guessRing`, `L.GUESS`, `L.stageOf`                                                                                                                                                       |
| `spiral.js`                    | Lesson 1's helix, promoted                               | `L.spiral(svg)`, `.draw({ yaw, pitch, ortho, unroll, line(s), bead(s), letter(name, s), letterTurn })`, `.at(s)`, `.isSharp`, `.name`; `L.spiral.unroll(dt)` (Lesson 1's unroll curves); `L.ringOfTwelve`                                                                                                                                                                                                                                                                                                           |
| `keyboard.js`                  | Lesson 1's A2 to A5 keyboard                             | `L.keyboard(svg, { place: { s: 2, cx: 960, cy: 820 } })` (the S8 frame), `.key('C4')`, `.draw((k) => ({ rise, a, scale, lit, face, tint, labelA, label }))`; `L.noteName`, `L.midiOf`, `L.hzOfMidi`                                                                                                                                                                                                                                                                                                                 |
| `tiles.js`                     | the tile row                                             | `L.tiles(svg, { only })`, `.draw((tile) => ({ dx, dy, scale, lit, edge, labelA, q, names, second, outline, from, u, shape }), rowT)`, `.map`; `L.tiles.tip(uScale, uTurn)` (the tip into the ruler); `L.tileBrackets(svg, row)` with `.add(ma, mb, y, labelY)`                                                                                                                                                                                                                                                      |
| `ruler.js`                     | the vertical ruler and the magnifier                     | `L.ruler(svg, { hud })`, `.draw({ push, line, tick(m), name(m), cents(c), beads, columns, bracket, seg })`, `.y(m, cents)`; `L.magnifier(svg, ruler).draw({ open, slide, ticks, unit, bead, bead2, arrow, readout, echoes, t })`                                                                                                                                                                                                                                                                                    |
| `monitor.js`                   | the input monitor                                        | `L.monitor(layer, { x, y, scale: 1.4 or 0.8 })`, `.draw({ name, hz, cents, a, ring, namePulse, barPulse })`, `.markerAt(cents)`                                                                                                                                                                                                                                                                                                                                                                                     |
| `lanes.js`                     | the canvas: the app's drawing and the film's plain guide | `L.lanes(svg, { hud, x0, x1, rows, keys })`, `.draw({ app, title, octave, labelsA, band, singer, marker, plain, plainLabelsA, up, names, highlight, hlA, cursor })`, `.contour(u)`, `.sung(t)`; `L.slideCents`, `L.C.amber`, `L.C.singer`                                                                                                                                                                                                                                                                           |
| `stepbars.js`                  | step bars                                                | `L.stepBar(svg, { notches: 1 or 2 }).draw({ x, y, grow, pulse, labelA, outline, outlineA })` (80 px a semitone, never scaled)                                                                                                                                                                                                                                                                                                                                                                                       |

Each module carries its HANDOFFS pixels as defaults, so a builder who passes nothing gets the
handoff geometry. Proven in lab pages rendered to stills (`lab/kit-src/*.html`, stills in
`lab/kit-<name>/`): the marks, the spiral (front view, the 2.2x push about (1230, 650), the plan
view), the unroll onto the keyboard and the 2x push to the S8 frame, the tiles (glide, brackets,
lift, tip), the ruler (magnifier, labels, bracket, the D to E push), the canvas and the monitor.

Known in the kit:

- At the front view (yaw 0, pitch 10) the left half of the lit turn crowds (G, F♯, F sit within
  50 px of each other), so its letters touch; the turntable yaw and `letter()`'s `dx`, `dy` are
  the scene's to tune. At S4's 2.2x framing the lower turn's back beads (D3) land beside the dim
  A♯3 bead: dim the other turns there if it reads as clutter.
- A dark tile's tip-to-tick shape stays dark; S13a cross-fades the ruler's chrome ticks over it.

## Proving a scene

```bash
cd output/motion/lesson-02
export HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1
npx --yes hyperframes@0.8.97 check                          # 0 errors for the whole project
node tools/lab.mjs <scene-id> 0.0,1.2,3.4                     # stills of your scene at scene times
node tools/lab.mjs <scene-id> --clip                          # a 30 fps draft with its sound
python3 ../../../.claude/skills/motion-designer/scripts/measure.py render lab/<scene-id>/clip.mp4 --out lab/<scene-id>/measure
node tools/text-sweep.mjs <scratch-dir> --step 0.25 <scene-id> && python3 tools/text-sweep.py <scratch-dir> <scene-id>
python3 tools/merc-tags.py <scene-id> --check                 # your tags are current
python3 tools/clock-lint.py compositions/<scene-id>.html      # no typed seconds: prints nothing
```

Look at your stills yourself. Before you hand a scene back: clock-lint prints nothing, the handoff
frames match the table to 2 px (stills at your first and last frames), the lab clip passes
measure.py against both limits, the text sweep finds no settled label under 4.5:1, and your
sheet's Build-checks spans are looked at by name. Report the files you wrote, the cue anchors you chose for each row, anything you could
not build, and the still and clip paths. A provisional HANDOFFS value you confirm goes in your
report with the still that shows it; the director records it in "Handoff confirmations" below.

## A re-voice (the ElevenLabs takes)

The director's tool brings the takes into the voice folder:
`output/motion/voice-elevenlabs/import.py <this folder> <takes>`, run with the TTS venv's Python.
Per line it writes a 24 kHz mono WAV with Kokoro's edges and loudness, the envelope, and the word
times, and lists the line in `assets/voice/_elevenlabs.json`. Then:

```bash
PY=<tts-venv>/bin/python   # numpy, soundfile, kokoro-onnx
$PY tools/cues.py --no-tts                                     # 4: the clock, from the WAVs and word files (speaks nothing)
$PY tools/mix.py                                               # 5: sound
python3 tools/gen-root.py                                      # 6: scene table, root, placeholders, each scene's data-duration
python3 tools/merc-shots.py && node tools/merc-pass.mjs merc/shots/<id>.json   # 8: Merc (m14-duo first)
python3 tools/merc-tags.py && python3 tools/captions.py && python3 tools/chapters.py && python3 tools/script-md.py
python3 tools/board-clock.py                                   # the new drift against the storyboard
```

Run `cues.py` with `--no-tts` once any take is imported. Without the flag it re-speaks with Kokoro
every line whose text or voice changed. It never re-speaks a line listed in `_elevenlabs.json`, and
it stops on a line whose voice in `script.json` is not a Kokoro voice. `cues.py` and `mix.py` need
soundfile, which the system Python lacks; the venv has it. Nothing in a scene changes if it keys
off cues, words and durations: check with `python3 tools/clock-lint.py` (every built scene).

## Builder splits

Effort is agent build time including lab proofs, at the storyboard's density: S about an hour, M
1 to 2 h, L 2 to 4 h, XL 4 to 6 h. The points (in brackets) weigh the splits.

| Scene          | Effort     | Scene          | Effort | Scene     | Effort     |
| -------------- | ---------- | -------------- | ------ | --------- | ---------- |
| s01-cold-open  | XL (5)     | s07-unroll     | M (3)  | s13-cents | XL (5)     |
| s02-title      | S (2)      | s08-predict    | L (4)  | s14-sing  | L (4)      |
| s03-promise    | S to M (2) | s09-neighbours | L (4)  | s15-recap | L (4)      |
| s04-first-step | M (3)      | s10-tone       | L (4)  | s16-next  | M (2)      |
| s05-climb      | L (4)      | s11-names      | L (4)  | s17-end   | S to M (2) |
| s06-semitone   | M to L (3) | s12-direction  | XL (5) |           |            |

This machine has 4 cores. The workflow tool runs at most two agents at once here
(PRODUCTION-PIPELINE trap 8), so a third builder runs as a separate background agent. The Merc
passes, about 15,500 frames, render on the same cores and slow every lab render while they run
(trap 9).

**Three builders (proposed)**, each owning one stage of the persistent object:

1. **The spiral, S1 to S7** (22 points): from frame 0 to the keyboard close-up. Internal handoffs
   A to B (the push across the S3 to S4 cut) and B to C (the plan-view rest frame) stay with one
   builder. Out: HANDOFFS § Inside C, S7 to S8 (fixed geometry, no Merc, no type at the cut).
2. **The keys and the tiles, S8 to S12** (21 points): In: the S8 frame (fixed). Out: S12 to S13,
   the row easing home to y 420 to 700 across the cut (0.5 s, `power2.inOut`, from
   `at('act4', 'start', -0.35)`), the panel and Orange gone.
3. **The ruler, the canvas and the close, S13 to S17** (17 points): In: the same ease across the
   S12 to S13 cut. Holds the one unbroken Merc pair (m14-duo) from S14 to the end.

**Two builders**: S1 to S9, and S10 to S17. The one cross-builder handoff is S9 to S10: the tile row
at home at 1x and at rest (HANDOFFS § Inside C: S9d and S10), the twelve "1" brackets, the
kicker "EQUAL WIDTHS" up across the cut (both scenes draw it in `hud`; S10 removes it at b24's
end). The split is even: 30 points each.

Either way, a provisional handoff value is confirmed by the builders on both sides in a lab still
before either scene is built further (HANDOFFS, first paragraph). HANDOFFS is read-only to
builders, so the director records each confirmation in "Handoff confirmations" below.

## Scene sheets

Spans and other seconds are on the Kokoro scratch clock, for orientation only: the import moves
them, and `assets/scenes.js` is the truth after any re-time. Rows are the storyboard's. "Checks"
are the storyboard's § Build checks spans, as storyboard time then the anchor
`tools/board-clock.py` gives: write the anchor, never the time. Merc placement: feet point and
shown size; a hero-view Merc's feet line is 0.80 of his square, a front-view one's 0.81
(`L.merc`).

### s01-cold-open: Cold open, the five dim beads (0.00 to 23.95)

- Rows: 1a to 1h. Group A.
- In: frame 0 is a finished picture: Lesson 1's spiral turning on its axis (+1.5 degrees a second,
  a turntable: `yaw` from film time), the A3 to A4 turn lit with its letters and five dim "?"
  beads, the kicker "FIND YOUR PITCH · LESSON 02", both Mercs on the floor (y 840, wet reflections
  at 16 %).
- Out (to s02, same group): the A♯3 bead grows toward the lens over 1.8 s (`power3.in`) until its
  light fills the frame 0.24 s before `title`. Key its end to `at('title', 'start', -0.24)`:
  voiced, b4 is 0.7 s shorter than the board's, so a start keyed to b4 overruns the cut.
- Kit: `L.spiral` (turntable, the 20 degree turn in 1e, dim turns), `L.rig` (pushes 3 %, 8 % about
  the stacked beads, 4 %; the dolly 1.16x to 1.6x on the A♯3 bead), `L.merc` on the near layer
  (the Mercs ride it in S1 only), `L.hop` (the beads arcing from the mouths), `L.kicker`,
  `L.ringTimer` (q0), `L.bracket` (gold), `L.guessRing` (seven rings, two with their own "?"),
  `L.echoRings`, `L.pulse`, `L.dust`. The room is `L.room(root, { floor: true })`.
- Merc: m01-blue (feet (330, 840)) and m01-orange (feet (1590, 840)), front, 520. Blue points
  through "Seven letters," (B10). The board slides both 300 px outward from o2's second word over
  2.4 s; voiced o2 is 2.05 s, so the slide runs into b4 (the passes cover it; B11): start it
  there, or earlier, as the frame reads best.
- Checks: the hook lands by 0:25 (voiced o2 ends at 21.63); the text column right of the spiral
  starts at x 1380 (no letter past x 1329, no bead past 1292 at 1.16x); "12 notes" only once "7
  letters" has gone; "the other five?" over the upper turn dimmed to 20 %.

### s02-title: Title (23.95 to 27.35)

- Row: 2. Group A. Adapt Lesson 1's `output/motion/lesson-01/compositions/s02-title.html` (staff,
  the five chimes A3 E4 A4 C♯5 E5, notes hopping in, each sending a ripple). That file times its
  moves as bare seconds after the cut (`seg(t, 0.31, 0.93)`; clock-lint lists them): write each
  from `at('title')`.
- In: the full-frame chrome light shrinks to a bead on the staff's middle line (0.46 s).
- Out: the title, kicker "LESSON 02", "Find Your Pitch" and the notes exit up from `at('title',
'start', 2.16)`; the staff fades as the spiral returns (into s03).
- Kit: `L.staff`, `L.note`, `L.kicker`, `L.room`. Merc: none.
- Checks: the notes bob 8 px on a 1.2 s cycle so the card never holds; confirm in the clip.

### s03-promise: The promise (27.35 to 33.17)

- Row: 3. Group A.
- In: the spiral returning from 20 % as the title leaves.
- Out (to s04): **HANDOFFS § A to B** (provisional): the front view, yaw 0, pitch 10, the slow
  turn stopped; the lit turn's letters and five dim beads; the blue bead at A3 and the orange at
  A4 on the front; the other turns' beads at 60 %, no letters; no text, no Merc; dust continues.
  One push spans the cut: `rig.push(at('b5', 'end', -0.42), 2.0, { s: 2.2, cx: 1230, cy: 650 },
'power2.inOut')` in both scenes (s04 writes the same call with its own `at`); at the cut it is
  at u 0.435, scale 1.395. Lab: at 2.2x A3 lands at (636, 692), the dim A♯3 bead at (956, 636), B3
  at (1164, 548) and A4 at (636, 261).
- Kit: `L.spiral` (the crane down as `pitch`, the turn back to yaw 0 by `at('b5', 'end', -0.4)`),
  `L.rig`, `L.kicker` (three kickers, each on its words). Merc: none.

### s04-first-step: The very next note (33.17 to 44.31)

- Rows: 4a to 4c. Group B.
- In: A to B (above): the same push, landing at `at('act1', 'start', 0.98)`.
- Out (to s05, same group): continuous; Orange's drop starts here.
- Kit: `L.spiral` (`line(s).glow` for the travelling highlight, 200 px a second), `L.rig`,
  `L.kicker('<b>1</b> · The very next note')`, `L.listenMark`, `L.echoRings` (A3 on `word('b6',
'an')` and `word('b6', 'A')`), `L.arrow` (the chevron that bends into the arc), `L.bracket`,
  `L.pulse`.
- Merc: m05-orange (feet (1640, 840), 360, hero), dropping in at `at('b7', 'end', -0.1)`; the
  scene eases his frame down 60 px over the 0.4 s drop (`power2.out`).
- Checks: the travelling highlight is credited at 200 px a second: confirm in the clip.

### s05-climb: Twelve steps to the octave (44.31 to 70.84)

- Rows: 5a to 5d. Group B.
- Out (to s06, same group): continuous; Orange's slide in starts at `at('b11', 'end')`.
- Kit: `L.spiral` (beads lighting on each tone at `at('climb', 'start', 0.42 * k)`, the light
  trail via `line(s).glow`), `L.rig` (the pull out, then the arc: `yaw` 0 to 30 with
  `rig.slide('far', ..., { x: 120 })` and `rig.slide('near', ..., { x: -300 })`, and back), the
  counter (Outfit 120 px) and readout (Outfit 48 px, "Hz" mono), `L.echoRings`, `L.pulse`,
  `L.bracket`/gold "× 2".
- Merc: m05-orange hops out right at `word('b8', 'steps', 'start', -0.05)` (0.6 s); m06-orange
  (feet (280, 840), 360, hero, turned right) slides in from the left at `at('b11', 'end')`.
- Checks: S5b 62.41 to 63.06 is `at('climb', 'start', 5.85)` to `at('b9')`; S5c 71.30 to 71.90 is
  `word('b10', 10, 'start', 0.13)` to `at('b10', 'end', 0.08)`: the arcs' slow tails.

### s06-semitone: Equal steps, the semitone (70.84 to 87.45)

- Rows: 6a to 6c. Group B.
- Out (to s07): **HANDOFFS § B to C** (provisional), a rest frame: `pitch` 90, `ortho` 1, the lit
  turn a true circle centred (960, 520), radius 300 (lab: exact), A at the bottom, the orange A4
  bead over the blue A3 with a 3 px blue rim (draw orange 3 px smaller), all twelve lit; the other
  turns at 0; wedges dimmed; no labels, no kicker, no Merc.
- Kit: `L.spiral` (the crane up and over: `pitch` 10 to 90 with `ortho` 0 to 1, `line(s).a` of the
  other turns to 0, letters out with the "+13 Hz" labels), gold wedges (scene paths), "semitone"
  (serif italic 300 px, then 120 px beside the lit wedge), "HALF STEP" (mono 34 px, typed on).
- Merc: m06-orange slides out left at `at('o4', 'end', 0.05)` (0.4 s).
- Checks: the 0.4 s span at 94.6 is `word('b14', 6, 'start', 0.22)` to `at('b14', 'end', 0.16)`.

### s07-unroll: The spiral becomes a keyboard (87.45 to 100.52)

- Rows: 7a and 7b. Group C (builder 1 in the three-way split).
- In: B to C (above).
- Out (to s08): **HANDOFFS § Inside C, S7 to S8** (fixed): the uniform 2x push about (960, 820)
  lands exactly at `at('b17')` (anchor its end there, 1.5 s, `power2.inOut`); white keys 138.18 px
  wide, y 300 to 820 (A3's left edge 407.27 to A4's right edge 1512.73); black keys 80 px, y 300
  to 628; labels JetBrains Mono 60 px, `#2a323c`, baseline y 784; every key outside A3 to A4 at 0.
  The kit's unroll lab ends on exactly this frame (`lab/kit-unroll/frame-04-at-7.4s.png`).
- Kit: `L.chapterCard(hud, { num: 2, title: 'The keyboard', baseline: 612, tIn: at('act2',
'start', 0.22), tOut: at('b15', 'start', -0.1) })`, `L.kicker`, `L.spiral` with
  `L.spiral.unroll(dt)` and `L.keyboard` (as `lab/kit-src/unroll.html`), `L.bracket` ("7 white + 5
  black"), `L.pulse` (keys 5 %), `L.echoRings` (all 37 beads light).
- Merc: none.
- Checks: S7a 100.4 to 100.83 is `word('b15', 6, 'start', 0.48)` to `at('unroll')`; the chapter
  breath (only the card's 3 % breathing moves).

### s08-predict: Predict, B to C (100.52 to 129.81)

- Rows: 8a to 8e. Group C.
- In: S7 to S8 (fixed, above). Draw the keyboard with `place: { s: 2, cx: 960, cy: 820 }` and the
  rig at 1x, or keep the rig at 2x: the frame is the same.
- Out (to s09, same group): the S8 frame at 1.10x about (752, 300) after S8c's 6 % and S8e's 4 %;
  the two step bars standing from y 290 over B3/C4 (x 683.64, one notch to y 210) and C4/D4 (x
  821.82, two notches to y 130) (HANDOFFS § Inside C: S8 and S9, provisional).
- Kit: `L.keyboard`, `L.pulse('key')`, arcs (scene paths; the dashed one in `L.GUESS`), `L.pill`
  and its check, `L.ringTimer` (predict), `L.stepBar`, `L.rig`.
- Merc: m08-orange (feet (1700, 840), 480, hero) slides in from the right at `at('b17', 'end',
-0.1)` and out right at `at('o5', 'end')`, 0.4 s each.
- Checks (the riskiest scene: S8 counts 4.4 s per 30 s by the board's rule; measure first): S8c
  121.10 to 122.17 is `word('b18', 5, 'start', 0.06)` to `word('b18', 8)`; 122.37 to 123.58 is
  `word('b18', 8, 'start', 0.11)` to `word('b18', 11, 'start', 0.19)`; 126.21 to 127.08 is
  `word('b18', 18, 'start', 0.10)` to `at('predict')`; the 0.4 s span at 133.8 is `at('bc-cd',
'end', 0.12)` to `at('b19')`.

### s09-neighbours: Neighbours, drawn equal (129.81 to 157.39)

- Rows: 9a to 9d. Group C.
- Out (to s10): **HANDOFFS § Inside C: S9d and S10** (fixed geometry): from `at('b23', 'end',
0.57)` the tile row is at home and at rest at 1x: 13 tiles, centres x = 240 + 120 i, y 420 to
  700; the twelve "1" brackets at y 740 (labels 790); the kicker "EQUAL WIDTHS" up (it leaves at
  b24's end).
- Kit: `L.keyboard`, `L.rig` (the 2.2x push about (580, 317), then `rig.centre` from (580, 317) to
  (455, 317), the 150 px pan; the pull out to 1x; the 120 px pan out and home), `L.stepBar`
  (outline, then fill), `L.tiles` (`from` a key's rect and `u` for the glide, 1.1 s each, 0.035 s
  apart, as `lab/kit-src/tiles.html`), `L.tileBrackets`, `L.pulse`, `L.lit` (key faces at 2.2x),
  `L.kicker`.
- Merc: none.
- Checks: S9a 144.5 to 144.97 is `word('b20', 8, 'start', 0.41)` to `word('b20', 10)`; S9b 157.12
  to 157.6 is `word('b21', 17, 'start', 0.25)` to `at('b22')`; a 10 s clip of S9b first; the slow
  ends of the S9a to S9b and S9c to S9d pans.

### s10-tone: Tones, and where the five come from (157.39 to 181.76)

- Rows: 10a to 10e. Group C.
- Out (to s11): **HANDOFFS § C to D** (fixed), a rest frame: the row at home, every tile in its
  slot, the dark tiles unlabelled, the twelve brackets in chrome at full, nothing else on screen,
  the pull out landing on the cut; no Merc, no kicker.
- Kit: `L.tiles` (the five lift 300 px; `rig.tilt` 80 px with them), `L.tileBrackets` (and the "2"
  bracket, `.add(60, 62, 815, 860)`), `L.rig` (3 % push about (720, 410); the 2x push about (720,
  560), then `rig.centre` to (840, 560); the pull out), `L.guessRing` (the returning "?" rings),
  `L.pulse`, `L.lit`.
- Merc: m10-orange (feet (80, 870), 300, hero, turned right) peeks in at `at('b24', 'end')` (0.4
  s) and hops out left at `word('b26', 0, 'start', 0.08)` (0.6 s).
- Checks: the slow ends of S10e's 120 px pan.

### s11-names: Sharps and flats, two names (181.76 to 205.56)

- Rows: 11a to 11d. Group D.
- In: C to D (above).
- Out (to s12, same group in D): the row at y 340 to 620 (it eases up 80 px as the three settle),
  both names on every dark tile (sharp above flat), the white tiles' names back, the brackets
  gone; Orange's peek starts here.
- Kit: `L.chapterCard(hud, { num: 3, title: 'Two names', baseline: 360, ... })`, `L.kicker`,
  `L.tiles` (the row) plus `L.tiles(nearSvg, { only: [60, 61, 62] })` on the near layer for the
  lift to 2.4x, `L.rig.truck` (x -75 moves the near layer 120, the row 75, the staves about 19),
  the ♯ and ♭ glyphs (`L.spell` or `window.GLYPHS` paths), `L.arrow`, the gold ring, `L.pulse`,
  `L.echoRings`.
- Merc: m12a-orange (feet (1640, 860), 330, hero) peeks in at `at('b31', 'end')` (0.4 s).
- Checks: the slow ends of the truck (S11b to S11d); the row's labels hidden while it is at 30 %.

### s12-direction: A direction, not a colour (205.56 to 239.72)

- Rows: 12a to 12e. Group D.
- Out (to s13): the panel gone; the row eases home to y 420 to 700 across the cut, 0.5 s
  `power2.inOut` from `at('act4', 'start', -0.35)`, the same call in s13.
- Kit: `L.tiles` (dashed outlines, "E♯" on F as `second`), `L.rig` (tilt 160 px, pan 150 px,
  back), `L.arrow` ("+1 semitone"), `L.pill` and check, `L.ringTimer` (predict-e), `L.spell` ("E♯
  = F", gold), `L.lanes` configured as the S12e panel (rows C4 to E4 in the app's labels, a short
  violet line rising into C#4).
- Merc: m12a ducks out right at `at('b32')` (0.4 s); m12b-orange (feet (1640, 860), 330) peeks
  back in at `at('o7')` (0.4 s) and hops out right at `at('b34', 'end', 0.3)` (0.6 s).
- Checks: the 0.4 s span at 239.76 is `word('b33', 12)` to `word('b33', 13)`; the slow ends of
  S12b to S12c's pan.

### s13-cents: A hundred cents (239.72 to 277.01)

- Rows: 13a to 13f. Group D.
- In: the ease across the S12 to S13 cut (above).
- Out (to s14): **HANDOFFS § D to E** (fixed): S13f's push to 160 px a semitone (scale 160 / 55
  about (560, 977)) lands at rest exactly at `at('b41')` (2.0 s, `power2.inOut`): ticks G#3 y 680,
  A3 520, A#3 360, B3 200; labels JetBrains Mono 30 px, ink-2, right-aligned at x 540; nothing
  else (lab: `lab/kit-ruler/frame-04-at-9.9s.png`).
- Kit: `L.chapterCard(hud, { num: 4, title: 'Measure it, sing it', baseline: 360, ... })`,
  `L.kicker`, `L.tiles` and `L.tiles.tip(uScale, uTurn)` (the tip's bounds check out: lowest
  corner y 862.1, highest 133.8, rightmost x 1736), `L.ruler`, `L.magnifier`, `L.monitor` (1.4 at
  (900, 232)), `L.echoRings`, `L.pulse`, `L.spell` ("1200 ¢ = 1 octave").
- Merc: m13-orange (feet (1840, 860), 290, hero, turned left) drops in at `at('o8', 'start',
-0.1)` and hops out right at `at('o8', 'end', 0.08)`.
- Checks: S13b 263.4 to 263.83 is `word('b36', 7, 'start', 0.47)` to `word('b36', 9)`; S13f 282.5
  to 283.0 is `word('b39', 1, 'start', 0.25)` to `word('b39', 3, 'start', 0.02)`; the 0.4 s span
  at 281.4 is `at('b38', 'end', 0.08)` to `at('b39')`; the inset slide's slow ends.

### s14-sing: Sing a semitone (277.01 to 325.51)

- Rows: 14a to 14g. Group E.
- In: D to E (above).
- Out (to s15): **HANDOFFS § E to F** (provisional): the plain guide at 20 % (its labels gone)
  fading out; the Mercs mid-move from feet (230, 860) and (1690, 860) at 420 to (170, 860) and
  (1750, 860) at 300 (scale 0.808 to 0.577 of the 520 render), `power3.inOut`, from
  `at('your-turn', 'end', 0.13)` for 1.2 s, the same call in s15.
- Kit: `L.ruler` (the four ticks, pushed), `L.lanes` (all of S14a to S14g: band, singer line,
  marker, relabel, plain guide, highlight, cursor; as `lab/kit-src/canvas.html`), `L.monitor` (0.8
  at (1400, 160)), `L.ringTimer` (your-turn), `L.kicker`, `L.rig` (2 % push about (574, 520)).
- Merc: m14-duo-blue and m14-duo-orange, rendered at 520, shown at 420 (feet (230, 860) and (1690,
  860)); both drop in at `at('b41')`, the scene easing each frame down 60 px over the 0.4 s drop.
- Checks: from "Now you" nothing of the app's drawing is on screen (title, marker, violet line,
  amber band, app labels, chip: gone by `word('b42a', 'Now you', 'start', 0.3)`); the guide's
  labels drop before it dims; the ring timer leaves with the pause.

### s15-recap: Quick check (325.51 to 372.11)

- Rows: 15a to 15g. Group F.
- In: E to F (above).
- Out (to s16, same group): the grid gone; the Mercs move from the corners (300) to the floor
  ((560, 840) and (1360, 840), 520), `power3.inOut`, from `at('b52a', 'end', 0.29)` for 1.6 s,
  across the cut (HANDOFFS § Inside F).
- Kit: `L.kicker`, cards (Lesson 1's plain rounded cards), `L.ringTimer` (q1 to q4),
  `L.ringOfTwelve({ cx: 1300, cy: 480, r: 180 })`, `L.pill` and check, `L.tiles({ from: 69, to:
72, x0, step, w })` for the A4 to C5 strip, `L.tileBrackets`, `L.ruler({ x: 1300, ... })` at
  0.8, `L.spell`, the Leap grid (12 pads, scene-drawn; ghosted pads keep their labels in ink-2).
- Merc: m14-duo (shown at 300 in the corners).

### s16-next: Next time (372.11 to 387.51)

- Row: 16. Group F.
- Out (to s17): HANDOFFS § Inside F, S16 to S17: the Mercs on the floor at 520; the one-band
  canvas at 100 % at the cut, fading over s17's first 0.5 s.
- Kit: `L.lanes` configured as the one-band canvas (x 728 to 1192, y 560 to 800: one amber band, a
  faded violet line a semitone below), `L.kicker`, the two figures (Outfit 160 and 120 px).
- Merc: m14-duo.

### s17-end: End card (387.51 to 392.71)

- Row: 17. Group F. Adapt Lesson 1's `compositions/s21-end.html` (lockup, the bead orbits), with
  the URL "Practise it free: mercurypitch.com/ear-lab" and the legend "In Leap:" over "m2 =
  semitone · M2 = tone" between the Mercs once s16's canvas has gone; one gold ring under the
  Mercs on the hop. Lesson 1's file times its moves as bare seconds after the cut (write them from
  `at('end')`), and keys its orbit window to Lesson 1's `s20-next`; here that is `s16-next`.
- Merc: m14-duo (celebrates once from `at('end', 'start', 0.2)` for 0.85 s; the passes run 0.1 s
  past the film's end).
- Checks: the call to action is the one hold the quality bar allows.

## Handoff confirmations

The director records here each provisional HANDOFFS value once both builders have confirmed it in
a lab still (still paths beside it). Until then, the HANDOFFS value is the one to build to.

| Handoff               | Value                                 | Confirmed      | Stills                                |
| --------------------- | ------------------------------------- | -------------- | ------------------------------------- |
| A to B                | push centre (1230, 650), 2.2x, eps 10 |                |                                       |
| B to C                | ring centre (960, 520), radius 300    | kit lab: exact | `lab/kit-spiral/frame-03-at-6.8s.png` |
| Inside C, S8 and S9   | pills, arcs, bars                     |                |                                       |
| Inside D, S11 and S12 | tile framings                         |                |                                       |
| Inside E, S14         | canvas                                | kit lab        | `lab/kit-canvas/`                     |
| E to F                | Merc move, `power3.inOut`             |                |                                       |
| Inside F              | Merc move, `power3.inOut`             |                |                                       |
