# Build guide: scene builders for Lesson 5, "Breath and a steady note"

Read this, then your rows in the storyboard, then the kit (`assets/lib`, summarised under "The kit").
Everything that binds you is in this folder (the film's root), read-only to builders:

| Document | What you take from it |
| --- | --- |
| `STORYBOARD.md` (v3) | Your rows; § The world, § Camera plan, § Persistent actors, § Codes, § Type (every pulse, label and dim), § Build checks |
| `HANDOFFS.md` (v3) | Your entry and exit frames, to the pixel; § Shared formulas, § The wave rule, § World, § Framings, § Camera moves, § The cuts, § Provisional values |
| `LAB-CHECKS.md` | What paper could not settle: the stills and clips your lab must show, and the pass rule for each |
| `FACTS.md` | The only source for any number, name or claim on screen; FACTS 80 holds every sound's contour |
| `BRIEF.md` | What must read with the sound off; what must never appear |
| `SCRIPT.md`, `DECISIONS.md` | The words as voiced; why each choice was made (the kit's: 132 to 142; its fix round after critic-kit-01: 143 to 159) |
| `merc/PASSES.md` | Merc's and Tavi's passes: chunks, sizes, which are rendered |
| `lab/kit-type/WIDTHS.md` | The real widths of every label HANDOFFS places, and LAB-CHECKS 4 to 15's clearances, measured |

`tools/CHANGES.md` logs every change to the tools. Also read the motion-designer skill's
PRODUCTION-PIPELINE traps, above all 3 to 7 (Merc tags, sub-composition time, blending), 12 (dim
strokes, never labels), 13 (the motion measure.py can see), 14 (only the host making the sound shows
arcs), 20 and 22 (a film timed as "a cue plus seconds"). The kit labs (`lab/kit-src/*.html`) are
working examples of every module: read them; never edit them.

## The clock: never type a second

The storyboard and HANDOFFS are timed to the board clock (`tools/board-cues.json`, frozen). Today's
`cues.json` is the scratch voices' clock (547.565 s); the owner's final voices will move it again,
and every scene shifts with it. A scene keyed to cues and words follows untouched; a scene with a
typed second goes wrong.

- In a scene, every time is a cue, a word, or a duration:
  - `at('b9')`, `at('b9', 'end', -0.2)` for cue edges (scene time);
  - `word('b9', 'black key')` for the start of a phrase in a line, `word('b9', 'tone', 'end')` for
    its end, `word('b9', 14)` by index, `word('b28', 'tone#2')` for a second occurrence;
  - `L.cue(id, edge, off)` is the same in **film** time, for a curve drawn from film time on both
    sides of a cut (`L.TEASE.carry`, `L.TEASE.shrink`, the dust, a glow's breathing).
- The only bare times a scene may hold are `0` (the cut) and `D` (the scene's end). Scenes that cut
  on a mark (`act1` to `act5`, `sing`, `recap`, `next`) start 0.15 s before it.
- `python3 tools/clock-lint.py compositions/<scene>.html` must print nothing. It flags a bare number
  given as a time to the kit's timing calls (`L.prog`, `L.env`, `L.fade`, `L.swap`, `L.run`, the
  lists of `L.pulse`, `L.lit`, `L.light` and `L.glow`, `L.track`'s moves, the cut curves), a camera
  move, a kit object drawn from `t` (`kicker.draw(t, tIn, tOut)`, `ring.draw(t, t0, dur)`,
  `label.life(t, tIn, tOut, fade, [pulses])`), a time key (`{ t: 1.2 }`, `tIn`, `tOut`, `at`), a GSAP
  position, a comparison with `t`, any number equal to a cue or word edge, and an offset deep inside
  a spoken line. A line that must keep such a number carries `// clock-lint: ok`.
- Translate a board time with `python3 tools/board-clock.py <seconds>`; `--scene <id>` lists a
  scene's cues and words. **Choose the anchor by the moment's role**, not by the nearest word: an
  entrance keys off the line it serves, an exit off the end of the line it closes, a reaction off
  the word it answers.
- A short move keeps its board length and is anchored by its start (a push or pull its stated
  length, a pulse 0.15 up and 0.6 back); a long lead move (S1's drift, the 10 s push to F-gauge, the
  promise truck) runs between the anchors of the stretch it carries.
- The sounds' contours are functions of the take's own time (`L.CONTOUR`, FACTS 80): draw a take as
  `t - at('<its cue>')`, never from a typed onset.

## Your files

- You own only your scenes: `compositions/<scene-id>.html`, and `lab/<scene-id>/`.
- Do not edit `index.html`, `assets/**` (the kit, cues, scenes, audio, the passes), `tools/*`,
  `script.json`, another builder's scene, or the documents above. If the kit lacks something, write
  it inside your scene and say so in your report; the director may promote it into the kit.
- `assets/scenes.js` and each scene's `data-duration` are generated (`tools/gen-root.py`). Read `D`
  with `L.dur(SID)`.
- `cues.py`, `mix.py`, `gen-root.py`, `merc-shots.py`, `merc-pass.mjs`, `merc-passes.py`,
  `merc-queue.py`, `merc-whole.py`, `captions.py` and `chapters.py` are the director's (and the
  pass builder's): they rewrite shared files. Ask; do not run them. The root `index.html` loads
  every line of `assets/lib/scripts.txt` (GSAP, the cues, the scenes, `assets/merc/roots.js` and
  the whole kit; `gen-root.py` re-run with `MIX=voice` in the kit's fix round, DECISIONS 159), as
  the labs do.
- The passes (`assets/merc/<pass>-<scene>-merc.webm`, one chunk a scene, with a JSON sidecar) render
  while you build; `ls assets/merc/` shows which exist (a `.part.webm` is one still rendering). Write
  the static tags your rows need, run `python3 tools/merc-tags.py <scene-id>` (your scenes only),
  and build around them.

## The scene skeleton

```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /></head>
  <body>
    <div id="ID" data-composition-id="ID" data-start="0" data-duration="DUR" data-width="1920" data-height="1080">
      <!-- the passes, static (trap 4), timed by python3 tools/merc-tags.py ID -->
      <video id="ID-blue" data-merc="m-blue" class="clip" muted playsinline></video>
      <video id="ID-blue-refl" data-merc="m-blue" data-merc-refl class="clip" muted playsinline></video>
      <div class="scene" id="ID-scene"></div>
      <script>
        ;(function () {
          const SID = 'ID'
          const D = L.dur(SID)
          const T0 = L.scene(SID).start                    // film time = T0 + t
          const at = (cue, edge, off) => L.at(SID, cue, edge, off)
          const word = (line, which, edge, off) => L.word(SID, line, which, edge, off)
          const root = document.getElementById(SID + '-scene')
          const room = L.room(root, { floor: true })       // back far under floor-layer mid near top vignette hud
          const world = L.stage(room.mid)                  // the world: drawings and world labels (ride the camera)
          const hud = L.stage(room.hud)                    // frame-fixed type: kickers, cards, pills (never scale)
          const dust = L.filmDust(room.near)               // drawn from FILM time, so it runs on across cuts
          const cam = L.frameRig(room, { from: 'F0' })     // the framings; add moves in time order
          cam.to(at('b13', 'start', 0.2), 10.0, 'F-gauge', 'sine.inOut')
          const ch = L.bandChart(world, L.CHART.S5)        // a module at its HANDOFFS place by default
          const kicker = L.kicker(hud, 'Chapter 2')
          const merc = L.mercGate(room.top, { sid: SID, pass: 'm-blue', tag: SID + '-blue', ...L.HOSTS.corners.merc })
          const tl = gsap.timeline({ paused: true })
          // build every object once above, then draw it every frame from t:
          L.clock(tl, D, (t) => {
            cam.apply(t)
            dust(T0 + t)
            const box = merc(t)                            // the host's body box on screen (keep-out), or null
            ch.draw({ lines: [{ id: 'v', contour: 'push', t: t - at('b13') }], strip: { envs: [{ id: 'v', contour: 'push', t: t - at('b13') }] } })
            kicker.draw(t, at('b12'), at('b13', 'end'))
          })
          window.__timelines = window.__timelines || {}
          window.__timelines[SID] = tl
        })()
      </script>
    </div>
  </body>
</html>
```

`L.clock` runs on every seek; draw everything from `t` (scene time). Draw anything that travels
across a cut from film time `T0 + t`. A module called with no options draws at its HANDOFFS
geometry; its file's header documents every option.

## Rules that cost a render

- Every animated value is a function of timeline time. No `Date.now`, `Math.random`,
  `requestAnimationFrame`, `setTimeout`, CSS animations or transitions, `repeat: -1`. Scatter comes
  from `L.rng(seed)`.
- **A cut is a scene change, never a camera move.** Each matched cut (o8, sing, recap) ends one
  scene's push and starts the next scene's rig at F0 with the carried object on the same pixels
  (HANDOFFS § The cuts). Do not write a cut as a `cam.to` of a few milliseconds (the rig ignores its
  lift since DECISIONS 136, but the next scene owns the frame).
- **The room crossfades across a matched cut** (DECISIONS 149): the incoming scene makes
  `const cut = L.roomCut(room, { from: '<the outgoing framing>' })` after its room and calls
  `cut.draw(t, T)` every frame after `cam.apply(t)`. On the cut frame the room still shows the
  outgoing framing, and over 0.3 s it fades to rest; the carried object is the scene's own, drawn on
  its pixels throughout (`lab/kit-cuts/`).
- The floor, the hosts and their reflections are screen space: the hosts in `room.top` through
  `L.mercGate`, the floor is the room's (`room.setFloor(a)`; no patch). No camera move shifts or
  scales them. A pass is mirrored by its name unless you say otherwise: Tavi's orange passes
  mirrored, Merc's blue never (`L.mercMirror(pass)`); `L.mercGate` takes the chunk's root from
  `window.MERC_ROOTS['<pass>-sNN']` (`assets/merc/roots.js`, in `scripts.txt`; `merc/PASSES.md`
  gives the call) and stands the soles on 840 at `L.HOSTS.FEET` 0.836 of the box. Nothing in this
  film drops in.
- `<video>` tags are static in the HTML, `class="clip"`, `muted`, `playsinline` (trap 4); `L.merc`
  and `L.mercGate` adopt and place them. Never tween `visibility`, `display` or `autoAlpha` on a
  `.clip`. Never put a CSS `transform` on an element GSAP also animates (the kit draws per frame).
- Fonts only from the kit (`fonts.css.txt`), no network, no `<br>`, no emoji: icons are `L.icon`
  ('leaf', 'halt'), the check is `L.check`, ♯ and ♭ go through `L.spell` (Noto Music, raised 0.3 em).
  Measure type only inside `L.afterFonts` (the doctor lines: `L.TURN.breakLines`).
- **Frame-fixed or world** (STORYBOARD § Type): kickers, chapter cards, pills, the four words, the
  care block, the recap panel, the cards, the feel block and the hook live in `hud` and never scale
  or ride a move; every label naming a part of a drawing rides the world (`world` or the module's own
  group). A frame-fixed label a move would put over a drawing leaves before the move and its
  replacement lands after it. "SLOWED · ILLUSTRATION" (CU-scoop to CU-wave) and the tags on 10h's
  frame are frame-fixed; every other tag is set in the world px of its drawing (`ch.tag`, `L.tag`).
- Timing of text: a label fades in over 0.2 s from its word and out over 0.2 s (`L.fade`,
  `label.life`); "up fast" is 0.3 s, power3.in; a switch slides the old label up 12 px and the new
  in from 12 px below, 0.25 s (`L.swap`). No two separate labels land within 0.4 s; nothing lands
  where something is still leaving. Counted pulses scale a 48 px-or-larger label 1.2 **about its
  left baseline** (`label.life(..., pulses, 'label')`), a pill or chip 1.08, a bead 1.2 or one echo
  ring (`L.echoRings`); a settling move of small type is eased over 0.4 s or more.
- **Dim strokes and fills, never labels** (trap 12): every settled label at 4.5:1 or better; a label
  whose group dims is hidden while dim (a chart under a chapter card). Measured: ink on the ground
  16.0:1 (14.9 on the brightest glow), ink-2 8.9:1 (8.3); ink on the band's 12 % amber 13.3, on the
  strip's 28 % violet 10.0, on a lit strip (40 %) 7.7; ink-2 on a lit strip 4.25 (never set ink-2 on
  a lit strip); ink on a hatch line 8.9, on a lit hatch line 2.8 (a light is transient: a label
  never settles inside a lit hatch).
- Colour (STORYBOARD § Codes): amber `#f59e0b` is Merc's band and his line (4 px, steady); violet
  `#a78bfa` a voice's line and strip; mint `#80ffca` the band's lit edge, only beside "in the band";
  gold `#ffd84d` only the gauge's "what the note needs" line and the together start's tick; blue and
  orange the tease's and the voices' dots; aqua only the chapter cards' numerals; chrome every other
  mark; Tavi's guesses dashed ink-2 with a "?" (`L.guess`, `L.GUESS`). Loudness is never drawn on
  the pitch axis.
- **The wave rule**: Merc's and a voice's lines on any band chart use `k W = 10 L / 1120`
  (`L.waveK`, the chart sets it from `W` and the plot's length): a cycle is 203.6 / W px and the
  wave 280 / W px tall on the 1120 px plot, ratio 1.375 in every framing.
- **Keep-out**: no mark or label within 20 px of a host's body box (`L.mercBox`, what `L.mercGate`'s
  draw returns); the tease's rows are masked round the boxes you pass to `te.draw({ keep })`.
- Only the host making the sound shows arcs (trap 14): the passes do this; nothing listens to the
  viewer (FACTS 87): the ring never pulses with sound.

## Motion: what measure.py sees

`lab/kit-room/MOVES.md` measures every camera move on the kit's clip: the 10 s push to F-gauge (5 %,
`L.steady(10)`: 0.3 s ramps, constant speed between) never averages under 0.061 over any 0.5 s
(the room at rest 0.005 to 0.008); the other pushes 3 to 5; the drift 0.1. The dust alone keeps a
still frame from reading as a hard hold. Prove your own moves on your lab clip; LAB-CHECKS 20 asks
that the gauge push keeps moving through the 10 s, with no still stretch over 0.5 s.

## The kit

Load order is `assets/lib/scripts.txt`. Each file's header documents every option; this is the map.

| File | Calls |
| --- | --- |
| `lesson.js` | the clock: `L.scene`, `L.dur`, `L.at`, `L.word`, `L.cue` (film time), `L.clock`; `L.C` (palette), `L.FONT`, `L.clamp`, `L.lerp`, `L.smooth`, `L.f2`, `L.ease(name)` (GSAP's curves), `L.easeOut`, `L.easeInOut`, `L.rng(seed)`, `L.afterFonts`, `L.svg`, `L.el`, `L.stage`, `L.stageOf`, `L.uid`; the room: `L.room(root, { floor, glows, staves, bokeh, vignette })` -> layers `back far under floorLayer mid near top vignette hud`, `.staves`, `.bokeh`, `.floor`, `.setFloor(a)`; `L.ROOM`, `L.BOKEH_LIFT`, `L.STAVE_LIFT`, `L.filmDust(layer)` -> `draw(T)` (`L.dust`); `L.field(svg, id).draw({ x, y, r, a, T, soft, dither })` and `L.FIELD` (the head bead's field, S1h and S2: screen space in `room.top` with the vignette hidden under it, breathing 2 %, a stepped grain; DECISIONS 148); `L.bead(parent, { r, color })`, `L.bead4.place / squash`; `L.glowPath`; `L.staff`, `L.note`, `L.step`, `L.clef`, `L.sharp`; `L.TITLE` (S2: staff, chimes, zoom, the bead's flight across the S2 to S3 cut) |
| `motion.js` | `L.prog(t, t0, dur, ease)`, `L.track(t, v0, moves)`, `L.env(t, t0, up, hold, down)`, `L.pulse(t, times, kind)` (`L.PULSE`: label 1.2, bead 1.2, chip and pill 1.08), `L.lit`, `L.light`, `L.glow`, `L.run`, `L.swap`, `L.fade(t, tIn, tOut, opts)` -> `{ a, dy }`, `L.echoRings(parent).draw(t, rings)`, `L.steady(dur, ramp = 0.3)` (an ease for `cam.to`: ramps, constant speed between; the push to F-gauge) |
| `marks.js` | `L.text`, `L.place`, `L.label(parent, str, opts)` (`.life(t, tIn, tOut, fade, pulses, kind)` pulses about the left baseline; `back: true` an opaque ground behind it, for a label a cursor or line passes behind), `L.kicker(hud, text)` (`.draw(t, tIn, tOut)`), `L.chapterCard(hud, { num, title, tIn, tOut })` (never wider than 1680 px, breathing included), `L.ringTimer(hud, { x, y })` (`.draw(t, t0, dur)`), `L.pill` (centres its text when `x1` fixes the capsule), `L.chip` (the four words, Quiet and Loud), `L.chipRow(parent, words, { right, y, gap: 12 })` (the four words' row, from their measured widths), `L.tag(parent, text, { x, y, anchor, opaque })` and `L.TAGS` (ILLUSTRATION 271, LISTEN ONLY 250, SLOWED · ILLUSTRATION 453), `L.spell`, `L.bracket`, `L.arrow`, `L.leader`, `L.check`, `L.guess` and `L.GUESS`, `L.underline`, `L.icon(parent, 'leaf' or 'halt')` |
| `frames.js` | `L.FRAMES` (F0, F-cold, F-cold end, F-hook, F-bead, F-promise-a and -b, F-strip, F-gauge, F-hold, CU-scoop, CU-wave, F-turn, F-end), `L.frameAbout`, `L.frameRig(room, { from })` -> `.to(at, dur, framing, ease)`, `.hermite`, `.curve`, `.pan` (unused), `.apply(t)`, `.map(x, y, t)`, `.inv`, `.scale(t, layer)`, `.slide`, `.matrix`, `.state`, `.cutAt(t)`, `.edgeAlpha(box, t, layer)` (a world chip's alpha by its distance to the frame's edge: gone within 16 px), `.drive(tl, D)`: layers far 0.25, mid 1, near and under 1.6; the bokeh and staves lift while they slide; `L.roomCut(room, { from, at, dur })` -> `draw(t, T)` (the room's crossfade across a matched cut) |
| `chart.js` | `L.CONTOUR` (easy, pushed, push, demo; `.vib`, `.pushAt`, `.pushCents`, `.pushDb`, `.from`), `L.waveK`, `L.CHART` (S1, S5, S7, S10, FRAME, RECAP, AT078, MINI1, SLIDER10H, LABELS), `L.bandChart(svg, place)` -> `.draw({ a, band, merc: { a, w }, lines, strip })` (`merc.w` the amber line's world width: 4 / the framing's scale for 4 px on screen), `.waveRule()`, `.merc`, `.geo`, `.place`, `.label(name)`, `.tag(kind)`, `.bead(r)`, `.x`, `.y`, `.band`, `.lastLine`; `L.pushSlider` (with its own "Push"), `L.timeAxis` (its "0" right-aligned 12 px left of the plot), `L.settledFlag` (`labelA` hides its word, as the recap's flag) |
| `figure.js` | `L.FIGURE` (S6, CUT, S7, S8, S13, PARTS), `L.figure(svg)` -> `.draw({ k, x0, y0, a, draw, legs, fade, breath, lungFill, glow, run, knee, jaw })`, `.at(name)`, `.pt(u, v)`, `.shape()`: one side-profile body (DECISIONS 143) |
| `gauge.js` | `L.GAUGE` (SMALL, FRAME, x(t), lungs(t), GOLD, cross, STRIP, FROM078, LABELS, LEADERS, CHIPS, TAG, PREDICT), `L.GAUGE.split(u)` (6b, provisional curves), `L.GAUGE.BACKS` (the labels the cursor passes behind, drawn with `back: true`), `LABELS.readoutAdding` (the switch at the crossing), `L.gauge(svg)` -> `.place`, `.draw({ band, strip, open, frameA, cursor, drawn, gold, goldDraw, hatch, heldLit, addedLit, lungsA, lungsRun })` |
| `mixup.js` | `L.MIXUP` (ROWS, CHART, ROW1, PAIR, ROW2, WORD, CUT, REASSEMBLE(u)), `L.pressPair(svg)` -> `.draw({ a, draw, place, pressed, pushA, namesA, smallA })`, `L.beliefRow(svg)` (row 0 with its dashed underline and "?") |
| `folds.js` | `L.FOLDS`, `L.folds(svg)` -> `.draw({ state, vib, T, grow, airA, airU, cx, cy, s })`; `L.TRACE` (strip, STACK, RECAP, ONSET, level), `L.trace(svg, place)` -> `.draw({ kind, t, a, dim, lit, circle, tick, place })`; `L.voiceBox(svg)` |
| `turn.js` | `L.TURN` (FRAME, BRACKET, VOICES, NOTHING, BREATHE_IN, RING, PHASE, COUNTER, ROW, playhead(t), CARE, FEEL, FTURN), `L.TURN.breakLines`, `L.ring(svg)` -> `.draw({ a, draw, trackA, arc, tick, scale, words, counts })`, `L.playhead(svg)` |
| `recap.js` | `L.RECAP` (FROM, TO, frameAt(u), mercW(u), voiceOK(u), LABELS, FLAG, PANEL, VM, REST, DRIFT), `L.panel(svg, box)` -> `.draw({ a, y1, dy })`, `L.glyph(svg, 'glide' or 'hold' or 'dots', { x, y })` (`.dot(i)`: the tease's first bead) |
| `tease.js` | `L.TEASE` (ROWS, BEADS, onset, COPY, Q, LINE, HOOK, END, MASK), `L.TEASE.carry(T, t0)` (S13 to S14, film time), `L.TEASE.shrink(T, t0)` and `.place(u)` (S14 to S15), `L.tease(svg)` -> `.draw({ rowsA, keep, beads, copy, arrows, qA, place })`, `L.lockup(parent)` (the MercuryPitch lockup, feathered wipe) |
| `hosts.js` | `L.HOSTS` (cold, corners, small, mercRight, end, FEET 0.836), `L.mercBox`, `L.merc`, `L.mercGate(layer, { sid, pass, tag, x, feetY, size, base, mirror, moves, leap, root, glow })` -> `draw(t)` (the body box; `mirror` by pass, `root` from `window.MERC_ROOTS`), `L.mercMirror(pass)`, `L.HOP`, `L.LEAP`, `L.ROOT_PX` |
| `lesson.css` | the palette and type tokens (`--ink`, `--ink-2`, `--chrome`, `--amber`, `--violet`, `--font-*`), the layer classes, the placeholder classes |

Known in the kit: `L.GAUGE.split`'s curves are provisional (the lab's 0.6 / 0.35 split clears the chip
by 56.7 px: WIDTHS.md line 11). "added" lands at the crossing (137.25), centred (1560, 645) inside
its hatch, with no leader (DECISIONS 144): HANDOFFS § The gauge still gives x 1508, baseline 760 and
a leader; build the kit's place. `L.CHART.FRAME` (the hold frame, k 1.0 on its 640 px plot) is off
the wave rule (its rule k is 0.571): draw no voice line in it; only Merc's line shows there and at
the recap's cut (`L.RECAP.voiceOK`).

**For the sound step** (DECISIONS 155): the takes' vibrato starts at 0.5 s, after their glide
(`vib0`), the Push note's at its start: make each take's sound match its drawing.

Kit labs, one page each in `lab/kit-src/` (stills and clips in `lab/kit-<name>/`, the probe's
results in `lab/kit-probe/RESULTS.md`): room, type, chart, figure, gauge, mixup, folds, turn,
recap, tease, hook, hosts, and, since the fix round, `title` (the field's exit onto the title) and
`cuts` (the room across a matched cut, an object carried on its pixels).

## Proving a scene

From the film's root. Every heavy job (a check, a lab still or clip, measure.py) goes through the
scratchpad's heavy helper, one at a time: the passes render on the same four cores.

```bash
export HF_VIDEO_EXTRACTION_FAILURE_MODE=observe HF_VIDEO_COVERAGE_THRESHOLD=0   # while a pass is missing (trap 3)
$S/bin/heavy npx --yes hyperframes@0.8.97 check                          # 0 errors, bar a pass not rendered yet
$S/bin/heavy node tools/lab.mjs <scene-id> 0.0,1.2,3.4                   # stills: lab/<scene-id>/still-<t>.png
$S/bin/heavy node tools/lab.mjs <scene-id> --clip --from=12 --len=4 --stills=13.5   # a clip with sound; stills that show the hosts
$S/bin/heavy python3 <repo>/.claude/skills/motion-designer/scripts/measure.py render lab/<scene-id>/clip.mp4 --out lab/<scene-id>/measure
$S/bin/heavy npx --yes hyperframes@0.8.97 check lab/<scene-id>/proj --at=<t1,...,t5>   # contrast of the settled labels at your sheet's times
python3 tools/merc-tags.py <scene-id> --check                            # your tags are current
python3 tools/clock-lint.py compositions/<scene-id>.html                 # no typed seconds: prints nothing
```

`check`'s contrast audit measures every text box against the pixels behind it, glyphs hidden, at
the times given (up to five a run): give it the times your rows settle a label over a fill or a
hatch. A snapshot does not show a video inside a scene (trap 5): stills with a host come from
`--clip --stills`. Lab clips render at draft quality, whose encode drops a fine grain: judge a dither
(the field's) on a still or a `--quality looks` render, not on a draft clip
(`lab/kit-title/field-stretch.png`).

Before you hand a scene back: clock-lint prints nothing; the handoff frames match HANDOFFS to 2 px
(stills at your first and last frames); every framing your scene uses lands where HANDOFFS
§ Framings says (a still at each); your LAB-CHECKS lines are shown on stills or clips at the times
they name; the lab clip passes measure.py; no settled label under 4.5:1. Report the files you wrote,
the anchor you chose for each row and why, anything you could not build, and the still and clip
paths.

## Builder splits

Effort is agent build time including lab proofs: S about an hour, M 1 to 2 h, L 2 to 4 h, XL 4 to
6 h. The points (in brackets) weigh the splits. Lengths are the scratch clock's.

| Scene | Length | Effort | What makes it so |
| --- | --- | --- | --- |
| s01-cold-open | 38.8 s | XL (5) | the chart, two takes and the strip at F-cold, the pills and ring timer, both hosts' leaps, the drift, the pull to F-hook with '"support"', the push through the head bead |
| s02-title | 3.6 s | S (2) | Lesson 4's title (`L.TITLE`), this film's line, the bead's flight across the cut |
| s03-promise | 10.5 s | M (3) | the bead's landing, the truck, the crane into s04 |
| s04-recall | 13.6 s | L (4) | F-strip, the swatches, the four words introduced, the crane back |
| s05-push | 36.2 s | XL (5) | the Push note, its slider and plan, the chart to 0.78, Lesson 1's figure, the fork, two tags |
| s06-diaphragm | 68.8 s | XL (6) | the figure, the split, the gauge opening, the 10 s push with the cursor, the hatches, the readout, Quiet and Loud, the matched cut |
| s07-support | 36.4 s | L (4) | 7a's reassembly across the cut, the card's rows, the chart and the press pair into the rows |
| s08-breathe | 20.4 s | M (3) | the figure whole, its legs, five cue labels and leaders |
| s09-onset | 57.1 s | XL (5) | the folds growing from the throat, three starts on the strip, the stack, three sounds' onsets |
| s10-steady | 61.1 s | XL (5) | the hold chart at F-hold, CU-scoop, the truck to CU-wave, the settled flag, the SLOWED chip, the voice box, 10h's frame and the matched cut |
| s11-sing | 39.2 s | L (4) | the hold frame at the right half, both hosts singing, "Sing it" |
| s12-your-turn | 76.8 s | XL (5) | the care block, the ring and counter, the playhead, the push to F-turn, the feel block, the matched cut |
| s13-recap | 63.1 s | XL (5) | the frame's slide, the panel and three cards, the Voice Mirror card, the rest card, the carry's start |
| s14-next | 15.9 s | M (3) | the tease: rows, beads, arrows and the copy, the carry's end, the shrink's start |
| s15-end | 6.2 s | S to M (2) | the shrink, the lockup's wipe, the address and the free line, the push to F-end |

Groups (STORYBOARD § Scene table): A s01 to s04 (14 points), B s05 to s07 (15), C s08 to s10 (13),
D s11 and s12 (9), E s13 to s15 (10).

This machine has four cores and the passes render on them. So **one builder per group, two at a
time**: A and B first, then C and D, then E, each next group starting as a slot frees. Every
cross-group handoff (A to B on `act1`, B to C on `act3`, C to D on `sing`, D to E on `recap`) is a
fixed frame in HANDOFFS § The cuts, so no builder waits on another; the two matched cuts across
groups (`sing`, `recap`) carry an object on its pixels, and both builders draw it from the kit's
one definition (`L.CHART.FRAME`, `L.RECAP.FROM`). The provisional values sit inside one group each:
the split's curves (B), the carry's path (E). Between waves the director promotes into the kit what
two groups wrote alike, and says so in the next builders' brief.
