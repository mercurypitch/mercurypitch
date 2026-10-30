# Build guide: scene builders for Lesson 4, "The major scale and home"

Read this, then your scene sheets below, then the kit (`assets/lib`, summarised under "The kit").
Everything that binds you is in this folder, `output/motion/lesson-04/`, read-only to builders:

| Document | What you take from it |
| --- | --- |
| `STORYBOARD.md` (v3.1, approved for build by storyboard critic 03) | Your rows; § The world, § Camera plan, § Persistent actors, § Codes, § Type (every pulse, label and dim rule); **§ Build checks, which is binding** |
| `HANDOFFS.md` (v3.1) | Your entry and exit frames, to the pixel; § Shared formulas, § World, § Framings, § Camera moves |
| `FACTS.md` | The only source for any number, name or claim on screen; FACTS 68 holds every sound's notes |
| `BRIEF.md` | What must read with the sound off; what must never appear |
| `SCRIPT.md`, `DECISIONS.md` | The words as voiced; why each choice was made |

`tools/CHANGES.md` logs every change to the tools. Also read
`docs/plans/find-your-pitch/PRODUCTION-PIPELINE.md` § 3 and the traps in § 4, above all 3 to 7
(Merc tags, sub-composition time, blending), 12 (dim strokes, never labels), 13 (the motion
measure.py can see), 14 (only the Merc making the sound shows arcs), 15 (closing passes run past
the end), 20 and 22 (a film timed as "a cue plus seconds"; a re-time moves a moment onto check's
samples), 23 (a drop starts above its own square) and 24 to 26.

Lesson 2's finished scenes (`output/motion/lesson-02/compositions/`) are working examples of every
pattern this film shares with it: the room, the Mercs and their reflections, drops and hops,
chapter cards, kickers, ring timers, pills, the title (s02) and the end card (s17). Read them; never
edit them.

## The clock: never type a second

The storyboard and HANDOFFS are timed to the Kokoro scratch clock of 29 October, **483.73 s
(8:03.7)**, frozen in `tools/board-cues.json`. Today `cues.json` is that same clock, so a storyboard
time is today's film time. It will move: the owner's ElevenLabs voices replace the scratch ones
before the final render (BRIEF: about 8:41 to 8:50 voiced), and every scene shifts. A scene that
keys off cues and words follows untouched; a scene with a typed second goes wrong.

- In a scene, every time is a cue, a word, or a duration:
  - `at('b9')`, `at('b9', 'end', -0.2)`, `at('steps-c', 'start', 0.8 * k)` for cue edges;
  - `word('b9', 'black key')` for the start of a phrase in a line, `word('b9', 'tone', 'end')` for
    its end, `word('b9', 14)` for a word by index, `word('b28', 'doh#2')` for a second occurrence
    ("and doh again").
- The only bare times a scene may hold are `0` (the cut) and `D` (the scene's end). A time measured
  from the cut is written from the cue the cut sits on. Scenes that cut on a mark (`act1` to `act4`,
  `recap`, `next`) start 0.15 s before it, so `at('act1')` is 0.15 in scene time.
- `python3 tools/clock-lint.py compositions/<scene>.html` finds typed times and must print nothing.
  It flags a bare number given as a time to the kit's timing calls, a camera move, an `L.track`
  move, a time key, a GSAP position, or a comparison with `t`; any number that equals a cue or word
  edge; and `at(line, 'start', x)` deep inside a spoken line. A line that must keep such a number (a
  pixel that happens to match) carries `// clock-lint: ok`.
- Translate a storyboard time with `python3 tools/board-clock.py <seconds> ...`: it names the
  nearest anchor and prints the call (`board-clock.py 84.94` prints `word('b9', 14)`).
  `python3 tools/board-clock.py --scene <id>` lists every cue and word of a scene with its times.
- **Choose the anchor by the moment's role, not by the nearest word.** board-clock names the
  nearest cue or word, which is not always the one the moment belongs to. Tavi's drop at 61.45 falls
  inside Merc's b6, but it is there for her line, so it keys off that: `at('o3', 'start', -1.1)`. An entrance keys off the line or sound it serves, an exit off
  the end of the line it closes, a reaction off the word it answers.
- Gaps and sound lengths are the same on both clocks, so an offset inside a sound or a pause, or
  after a cue's end, is exact. Inside a line, key to the word.
- A short move keeps its storyboard length and is anchored by its start: a Merc drop is 0.4 s, a
  hop 0.6 s, a bead's hop 0.3 s, a slide of the staircase its stated length (0.45 to 0.9 s), a push
  or pull its stated length. Never map both ends of a short move; the voice would stretch or squeeze
  it.
- A long lead move (S1's drift, S7c's slow push, S9b's push to the name band, S9d's truck) runs
  between the anchors of the stretch it carries, so it keeps its role when the voice changes; check
  that content still travels at least about 8 px a second in its middle (S1's drift is exempt: it
  is not counted as motion, and the Mercs carry the cold open).
- A move that spans a cut is written the same way in both scenes: the same anchors, the same curve
  (`L.ease` is GSAP's own). This film has one, the bead's flight into the house across the S2 to
  S3 cut (36.9 to 37.9), and one builder owns both scenes.

### Note onsets (FACTS 68)

A bead lands on a note's onset, and a note's onset is its sound's start plus an offset that never
changes with the voice. Offsets from the sound's start, in seconds:

| Sound | Notes | Onsets | Ends |
| --- | --- | --- | --- |
| `stop-c`, `stop-c-home`, `stop-d` | 7 | `0.45 * k`, k 0 to 6 (the last held 1.2 s) | 3.9 |
| `land-c`, `land-d`, `ti-do` | 2 | 0, 0.45 (the last held 1.2 s) | 1.65 |
| `scale-c`, `white-d`, `major-d` | 8 | `0.45 * k`, k 0 to 7 (the last 0.9 s) | 4.05 |
| `steps-c` | 8 | `0.8 * k`, k 0 to 7 (the last 1.2 s) | 6.8 |
| `group-low`, `group-high` | 4 | `0.45 * k`, k 0 to 3 (the last 0.9 s) | 2.25 |
| `slide-g`, `slide-e` | 8 | `0.36 * k`, k 0 to 7 (the last 0.72 s) | 3.24 |
| `sing-a`, `sing-b`, and the silent `your-turn` | 8 | `0.8 * k`, k 0 to 6 (ti at 4.8, held 2.0 s), a rest 6.8 to 7.4, do at 7.4 | 8.6 |
| `count-in` | 1 | 0 (0.8 s, then 0.2 s of silence) | 1.0 |

So stop-c's bead lands on stair k + 1 at `at('stop-c', 'start', 0.45 * k)`, and a hop that lands
there starts 0.3 s before it.

## Your files

- You own only your scenes: `compositions/<scene-id>.html`, and `lab/<scene-id>/`.
- Do not edit `index.html`, `assets/**` (the kit, cues, scenes, audio, Merc), `tools/*`,
  `script.json`, another builder's scene, or the documents above. If the kit lacks something, write
  it inside your scene and say so in your report; the director may promote it into the kit.
- `assets/scenes.js` and each scene's `data-duration` are generated (`tools/gen-root.py` keeps the
  attribute in step on every re-time). Write the skeleton's `DUR` from `assets/scenes.js`.
- `cues.py`, `mix.py`, `gen-root.py`, `merc-shots.py`, `merc-pass.mjs`, `merc-whole.py`,
  `captions.py` and `chapters.py` are the director's: they rewrite files every builder shares. Ask;
  do not run them. `assets/merc/whole.js` (each pass's first whole frame, for `L.mercGate`) is
  regenerated by the director as each pass lands; a pass not in it yet gets m06a's 30 and a console
  warning, which is expected until its WebM exists.
- The Merc passes' shot files (`merc/shots/*.json`) come from `tools/merc-shots.py`; the passes
  render on the scratch clock while you build (the first groups' first, m12 alongside) and again
  after the re-voice. `ls assets/merc/` shows which exist; a `.part.webm` is one still rendering.
  Write the static tags your sheet lists, run `python3 tools/merc-tags.py <scene-id>` (your own
  scenes only; with no scene id it rewrites every builder's tags), and build around them: a pass
  that is not rendered yet shows as nothing in a lab render made with the settings under "Proving
  a scene" (trap 3). Merc placement is proved in a lab clip once the pass exists (trap 5).

## The scene skeleton

```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /></head>
  <body>
    <div id="ID" data-composition-id="ID" data-start="0" data-duration="DUR" data-width="1920" data-height="1080">
      <div class="scene" id="ID-scene"></div>
      <!-- Merc tags, static (trap 4), then python3 tools/merc-tags.py ID:
           <video id="ID-m12-blue" data-merc="m12-blue" class="clip" muted playsinline></video>
           <video id="ID-m12-blue-refl" data-merc="m12-blue" data-merc-refl class="clip" muted playsinline></video> -->
      <script>
        ;(function () {
          const SID = 'ID'
          const D = L.dur(SID)
          const at = (cue, edge, off) => L.at(SID, cue, edge, off)
          const word = (line, which, edge, off) => L.word(SID, line, which, edge, off)
          const root = document.getElementById(SID + '-scene')
          const room = L.room(root, { floor: false })    // far, mid, near, top, hud
          const mid = L.stage(room.mid)                   // the world: staircase, strip, beads, world labels
          const hud = L.stage(room.hud)                   // frame-fixed type: kickers, cards, labels
          const cam = L.frameRig(room, { from: 'F0' })    // the framings: add moves in time order
          cam.to(at('b9', 'start', 0.11), 1.5, 'CU-A', 'power2.inOut')
          const st = L.stairs(mid, {})
          const kb = L.strip(mid, {})
          const tl = gsap.timeline({ paused: true })
          // build every object once here, then draw it every frame from t:
          L.clock(tl, D, (t) => {
            cam.apply(t)
            st.draw({ w: 0, s0: 0, rows: { keep: { boxes: [], cam, t } }, stair: (n) => ({}), riser: (n) => ({}) })
            kb.draw({ key: (m) => ({}), hair: { a: 1, w: 0, s0: 0 } })
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
`L.scene(SID).start + t`; draw anything that travels across a cut (a glow, a drift, an orbit) from
film time so its phase matches (HANDOFFS § Shared formulas). `lab/kit-src/stairs.html` is a complete
example of the staircase, the strip, a bead run, the rows' keep-out and two camera moves.

## Rules that cost a render

- Every animated value is a function of timeline time. No `Date.now`, `Math.random`,
  `requestAnimationFrame`, `setTimeout`, CSS animations or transitions, `repeat: -1`. Use
  `L.rng(seed)` for scatter.
- Never put a CSS `transform` on an element GSAP also animates; a second `fromTo` on the same target
  and property needs `immediateRender: false`. The kit draws per frame, which avoids both.
- Never tween `visibility`, `display` or `autoAlpha` on a `.clip`; never set `visibility: visible`
  (Lesson 1 decision 32). Fade an element's opacity.
- `<video>` tags are static in the HTML, `class="clip"`, `muted`, `playsinline`, timed by
  `tools/merc-tags.py` (trap 4); `L.merc()` adopts and places them. The Mercs are placed in screen
  space (the `top` layer or a layer of their own, as Lesson 2's scenes do), so no camera move shifts
  or scales them.
- No `<br>` in text. Fonts only from the kit. No network fetches. No emoji anywhere: the house is
  `L.house`, the check an SVG mark, the practise card's tab icons the app's own SVGs.
- Type (STORYBOARD § Type): kickers JetBrains Mono 500 30 px at (120, 110) (`L.kicker`); big ideas
  Instrument Serif italic; numbers Outfit 600; diagram labels Outfit 600, 36 to 64 px; ♯ and ♭ are
  Noto Music paths (`L.spell`). Nothing essential below y 896 (the caption band); S13's care block
  above y 864. On-screen words are a label, a number or the key term, never a narrated sentence (the
  care block's stop line and the doctor lines are the two carried whole).
- **Frame-fixed or world** (HANDOFFS § Shared formulas): kickers, the list, legends, tallies, sums,
  cards, pills, credits, "scale degrees", "solfège", "1 semitone" and the hook's lines live in `hud`
  and never scale or move with the camera; a stair's name, a riser's label, a key's name, "tonic =
  home", "(sol)", the brackets and "leading note" ride the world. A frame-fixed label that a framing
  would put over the diagram leaves before the move and its replacement lands after it. In F0,
  frame-fixed labels use the label lane (right of the staircase on C from x 1250, on D from x 1340;
  top left from x 140 on E and G and through S7).
- Timing of text (STORYBOARD § Type): a label fades in over 0.2 s from its cue and out over 0.2 s
  from its exit cue; "up fast" is 0.3 s, power3.in; a label switch slides the old label up 12 px as
  it fades and the new one in from 12 px below, 0.25 s, staggered 0.05 s stair by stair. Nothing
  lands where something else is still leaving.
- **Dim strokes and fills, never labels** (trap 12): every settled label at 4.5:1 or better. A label
  whose group dims is hidden while it is dim (the staircase under the chapter cards, in S4 and in
  S11's tiers). Ink on the ground 16.0:1, ink-2 8.9:1, ink on an unlit stair 13.4:1, on a stair lit
  40 % chrome 4.9:1, on a black key lit 40 % chrome 5.2:1, on a stair lit 45 % blue 5.7:1 and 45 %
  orange 6.1:1; each is measured again in your lab clip.
- Colour (STORYBOARD § Codes): blue `#58a6ff` is what Merc sings, orange `#ff7448` what Tavi sings;
  gold `#ffd84d` only the major pattern's two semitone risers once measured (never a celebration,
  never "the right answer": an answer pill gets an ink check); chrome `#c3ccd6` every other note and
  every soft-tone example; ink `#e6edf3` labels; aqua only the chapter cards' numerals, so no
  kicker in this film carries an aqua numeral (write `L.kicker(hud, '2 · Start anywhere')`, no
  `<b>`). Tavi's wrong guesses are dashed ink-2 with a "?" (`L.GUESS`); a step being measured is
  `L.MEASURE`; amber `#f59e0b` is S12's path and the ladder's target; violet `#a78bfa` only the
  ladder's sung line. No green anywhere.
- **Beads** (HANDOFFS § Shared formulas): a bead rests on its tread; a hop is 0.3 s, landing on the
  note's onset, peaking 40 world px above its higher resting point, rising before it travels
  (`L.bead4.hopAt`); a drop falls 60 world px over 0.2 s (`L.bead4.dropAt`); a bead that reaches a
  do stair under a house rises into it and becomes its light (`L.bead4.riseAt`). A bead never stands
  over or overlaps a house, a label or a lane name.
- **Keep-out** (HANDOFFS § Shared formulas): no stair, key, lane, label or mark within 20 px of a
  Merc's body box (`L.mercBox(x, feetY, size)`). The faint rows are masked round each Merc on
  screen: pass every on-screen Merc's box, as it moves, in `rows.keep.boxes`. In CU-C, F-recap-1 and
  F-recap-3 the strip fades (and sinks) over the push and returns over the pull.
- Only the Merc making the sound shows arcs (trap 14): the passes already do this; never add a
  `listen` anywhere, and nothing in S13 listens to the viewer.

## Motion: what measure.py sees

The storyboard's motion rule is checked on pixels (STORYBOARD § Build checks). Lesson 2 measured the
same kit's pulses (`output/motion/lesson-02/lab/kit-pulses/`, a clip with one event a second over a
still row): a tile or key scaling 1.05, a bar growing 15 % and a dark tile lit to 60 % chrome each
register about 0.6 s; a 64 px label scaling 1.2 registers 0.7 s; an echo ring 0.5 s; an edge glow
(an accent) 0.1 s. So count a stair, key or riser pulse as 0.6 s, not the board's 0.7, when you
budget a stretch. This film lights a stair to 40 % chrome, not 60 %, and group B measured it
(`lab/s05-steps/pulse`, a still F0 staircase): `L.lit`'s own shape registers 0.4 to 0.6 s at 40 %;
`L.light` (linear, up 0.3 s and back 0.4 s) registers 0.7 s, so count a stair light as 0.7 s only
with `L.light`. A slower ramp (up 0.4, back 0.8 to 1.2) registers only on a big area: stair 4 or 8 at
F0, or any stair in a close-up. Any light or pulse has a dead sample near its peak about a third of
the time, so budget a stretch with a margin. Holds: none longer than 0.5 s outside the end card; no more than about 1.8 s per 30 s
in a clip with no Merc on screen.

## The kit

`assets/lib/scripts.txt` lists the files in load order; the root, the labs and the text sweep load
the same list. Every maker builds once and draws per frame. World positions are F0's pixels
(HANDOFFS § World); `cam.map(x, y, t)` turns a world point into screen pixels for type in `hud`.

| File | What | Key calls |
| --- | --- | --- |
| `lesson.js` (Lessons 1 and 2) | timing, room, beads, staff, Merc layering | `L.at`, `L.word`, `L.ease(name)` (GSAP's curve), `L.dur`, `L.clock`, `L.room(root, { floor })` (far, mid, near, top, hud, and the `bokeh` and `staves` the rig lifts; the near layer carries `L.bokeh`, DECISIONS 89 and 93), `L.stage`, `L.bead(svg, { r: 22, color })`, `L.dust`, `L.merc`, `L.staff`, `L.note`, `L.afterFonts`, `L.rng` |
| `motion.js` | progress, pulses, echo rings | `L.prog(t, t0, dur, ease)`, `L.track(t, v0, moves)`, `L.env`, `L.pulse(t, times, 'tile' \| 'key' \| 'bar' \| 'label' \| 'bead')`, `L.lit(t, times)`, `L.echoRings(svg).draw(t, [{ t, x, y, r }])`; `L.rig` is Lesson 2's camera: this film uses `L.frameRig` instead |
| `marks.js` | type and marks | `L.kicker(hud, text)`, `L.chapterCard(hud, { num, title, baseline: 480, tIn, tOut })` (`tOut` is when its 0.38 s exit starts), `L.ringTimer`, `L.pill(layer, text, ...)`, `L.spell` (labels with ♯ and ♭ paths), `L.bracket`, `L.arrow`, `L.guessRing`, `L.GUESS`, `L.INKDARK`, `L.stageOf` |
| `tiles.js` (Lesson 2) | S4's tile row | `L.tiles(svg, opts)`, `.draw((tile) => ({ dx, dy, scale, lit, labelA, ... }), rowT)`; `L.tileBrackets(svg, row)` with `.add(ma, mb, y, labelY)` |
| **`frames.js`** (new) | the camera as framings (HANDOFFS § Framings, § Camera moves) | `L.FRAMES` (every named framing), `L.frameRig(room, { from })`: `.to(at, dur, 'CU-A' \| { s, ox, oy }, ease)` (push, pull, truck and crane: the layers part), `.pan(at, dur, { x, y }, ease)` (every layer alike), `.curve(at, dur, fn)`, `.hermite(at, dur, to)` (from the moves so far, at their rates, to rest: S9's second leg), `.apply(t)`, `.map`, `.inv`, `.scale`, `.state`, `.matrix` |
| **`hosts.js`** (wave 1) | the hosts and counted events, promoted from groups A and B | `L.mercGate(room.top, { sid, pass, tag, x, feetY, size, hop, hopDx, mirror, floor, fade })` (a pass placed for trap 23: a drop pass with an intro, DECISIONS 81, plays its segments first, the tall render of the whole fall from its first frame with a 6-frame fade and then any head, and shows the pass from the intro's last frame; a pass without one is hidden until its first whole frame and faded in while eased down its last 60 px; either is carried through a hop out; returns the body box for `rows.keep.boxes`), `L.light(t, times, up, down)` (the counted 40 % light), `L.swap` (§ Type's label switch), `L.filmDust(layer)` (draw it from film time), `L.MERC_WHOLE` (from `assets/merc/whole.js`), `L.MERC_INTRO` (from `assets/merc/intro.js`) |
| **`stairs.js`** (new) | the staircase world (HANDOFFS § World) | `L.ST` (geometry: `.H`, `.colX(n, w)`, `.tread(n, s0)`, `.foot(s0)`, `.rest(n, w, s0)`, `.houseBox`, `.keyX(m)`, `.scale(s0)`, `.START`); `L.stairs(svg, { x0, x1, k0, k1 })`: `.draw({ w, s0, a, rows, stair(n), riser(n), houses })`; `L.strip(svg)`: `.draw({ a, dy, key(m), hair })`; `L.house(parent)`; `L.bead4` (`.hopAt`, `.squash`, `.dropAt`, `.riseAt`, `.runAt`, `.place`); `L.mercBox`; `L.MEASURE` |

`spiral.js`, `keyboard.js`, `ruler.js`, `monitor.js`, `lanes.js` and `stepbars.js` are Lessons 1 and
2's and load with the kit; this film's storyboard does not call for them (the strip is `L.strip`,
not `L.keyboard`; S12's guide is drawn in its scenes from HANDOFFS § Inside E, unless `L.lanes`
takes that geometry exactly). The header of each new file documents every option; read it before
you call it.

Each new module carries its HANDOFFS pixels as defaults, so a builder who passes nothing gets the
handoff geometry. Proven in the kit's lab page (`lab/kit-src/stairs.html`, stills in
`lab/kit-stairs/`): the rows and their keep-out masks round both F0 corners, the staircase on C, D
and G with its slides, letters and numbers cross-fading, risers measured as a bead runs up, the
top house lighting, the strip with every start's keys and hairlines, and the push to CU-D and back.
The world geometry matched HANDOFFS § World to the pixel.

Known in the kit:
- The room carries the camera's depth cue (`L.bokeh`, DECISIONS 89): 21 faint, soft chrome discs,
  static in the room's under layer (`room.under`, between far and mid since DECISIONS 100), which
  the rigs move as the near layer, so they move only with the camera, at 1.6 times the world, and
  every mark of the diagram covers them. They are the same in every scene. Do not add a depth cue of
  your own, and do not hide, fade or restyle `room.under` or `room.near` (the dust lives there). A
  clip rendered before 29 Oct 14:43 does not have them; one rendered before 20:49 draws them over
  the diagram, some in blue or violet.
- While the camera slides them against the diagram, the bokeh and the far staves brighten (DECISIONS
  93; `L.frameRig` does it, from the moves you already write), and every frame at rest is as before.
  Do not set the opacity of `room.bokeh` or `room.staves`. A clip rendered before 29 Oct 18:42 shows
  the old cue during its moves.
- The black keys draw over an opaque obsidian backing, so a black key at 45 % reads as a dim black
  key over the white keys rather than a grey one (DECISIONS 70).
- A label pool builds a label the first frame it is asked for; call `.prepare([texts])` on a pool
  (`st.stairs[i].names`, `st.risers[i].labels`, `kb.keys[m].names`) to build them up front, so no
  frame pays for a first build.
- The rows' keep-out mask sets its filter region to the holes each frame and hides the holes when no
  box is passed; pass `rows.keep.boxes` only for Mercs actually on screen.

## Proving a scene

```bash
cd output/motion/lesson-04
export HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1
export PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.mjs   # this container's Playwright (text sweep)
export HF_VIDEO_EXTRACTION_FAILURE_MODE=observe HF_VIDEO_COVERAGE_THRESHOLD=0   # lab renders while a pass is missing (trap 3)
npx --yes hyperframes@0.8.97 check                          # 0 errors, bar missing_local_asset for passes not rendered yet
node tools/lab.mjs <scene-id> 0.0,1.2,3.4                     # stills of your scene at scene times
node tools/lab.mjs <scene-id> --clip                          # a 30 fps draft with its sound
python3 ../../../.claude/skills/motion-designer/scripts/measure.py render lab/<scene-id>/clip.mp4 --out lab/<scene-id>/measure
node tools/text-sweep.mjs <scratch-dir> --step 0.25 <scene-id> && python3 tools/text-sweep.py <scratch-dir> <scene-id>
python3 tools/merc-tags.py <scene-id> --check                 # your tags are current
python3 tools/clock-lint.py compositions/<scene-id>.html      # no typed seconds: prints nothing
```

A tag whose pass is not rendered yet makes the root `check` report `missing_local_asset` for that
file (trap 3); that one finding is expected until the pass exists, and nothing else may be red.

Look at your stills yourself. Before you hand a scene back: clock-lint prints nothing; the handoff
frames match HANDOFFS to 2 px (stills at your first and last frames); every framing your scene uses
puts its stairs, keys and labels where HANDOFFS § Framings says (a still at each landed framing);
the lab clip passes measure.py against both limits; the text sweep finds no settled label under
4.5:1; and your sheet's Checks are looked at by name, on stills at the times they name. Report the
files you wrote, the anchor you chose for each row and why, anything you could not build, and the
still and clip paths. A provisional HANDOFFS value you confirm goes in your report with the still
that shows it; the director records it in "Handoff confirmations" below.

## A re-voice (the ElevenLabs takes)

The director's tool brings the takes into the voice folder:
`output/motion/voice-elevenlabs/import.py <this folder> <takes>`, run with the TTS venv's Python.
Per line it writes a 24 kHz mono WAV with Kokoro's edges and loudness, the envelope and the word
times, and lists the line in `assets/voice/_elevenlabs.json`. Then:

```bash
PY=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/tts-venv/bin/python   # numpy, soundfile, kokoro-onnx
$PY tools/cues.py --no-tts                                     # the clock, from the WAVs and word files (speaks nothing)
$PY tools/mix.py                                               # sound
python3 tools/gen-root.py                                      # scene table, root, placeholders, each scene's data-duration
python3 tools/merc-shots.py && node tools/merc-pass.mjs merc/shots/<id>.json   # Merc (m12 and m09 first)
python3 tools/merc-tags.py && python3 tools/captions.py && python3 tools/chapters.py && python3 tools/script-md.py
python3 tools/board-clock.py                                   # the new drift against the storyboard
```

Run `cues.py` with `--no-tts` once any take is imported: without the flag it re-speaks with Kokoro
every line whose text or voice changed (it never re-speaks a line listed in `_elevenlabs.json`, and
it stops on a line whose voice in `script.json` is not a Kokoro voice). Nothing in a scene changes
if it keys off cues, words and durations: check with `python3 tools/clock-lint.py` on every built
scene.

## Builder splits

Effort is agent build time including lab proofs, at the storyboard's density: S about an hour, M 1
to 2 h, L 2 to 4 h, XL 4 to 6 h. The points (in brackets) weigh the splits.

| Scene | Effort | Scene | Effort | Scene | Effort |
| --- | --- | --- | --- | --- | --- |
| s01-cold-open | XL (5) | s07-predict | XL (5) | s13-your-turn | L (4) |
| s02-title | S (2) | s08-anywhere | L (4) | s14-recap | XL (5) |
| s03-promise | M (3) | s09-names | L (4) | s15-next | S (2) |
| s04-recall | L (4) | s10-ti | M to L (3) | s16-end | S to M (2) |
| s05-steps | XL (5) | s11-why | L (4) | | |
| s06-groups | L (4) | s12-sing | L (4) | | |

Groups (STORYBOARD): A s01 to s04 (14 points), B s05 and s06 (9), C s07 and s08 (9), D s09 to s11
(11), E s12 and s13 (8), F s14 to s16 (9).

This machine has 4 cores, and the workflow tool runs at most two agents at once here
(PRODUCTION-PIPELINE trap 8); the Merc passes render on the same cores and slow every lab render
while they run (trap 9). So **one builder per group, two at a time**: A and B first, then C and D,
then E and F, each next group starting as a slot frees. Every cross-group handoff (A to B at 69.35,
B to C at 146.10, C to D at 229.24, D to E at 341.24, E to F at 405.49) is a fixed rest frame in
HANDOFFS, so no builder waits on another, and every provisional value sits inside one group: Merc's
mouth point in S1 and S10 (the passes decide them), S4c's stand-up, S12a's tip and S13d's reverse
tip (the lab decides the curves). Between waves the director promotes into the kit what two groups
wrote alike, and says so in the next builders' brief.

Critic 03's three items are proved on pixels, not taken on trust: the strip in S14c (item 1), the
beads clear of the riser labels in S6b, S7e, S8b and S8c (item 2), and Merc's arc onto stair 1 in
S10b (item 3). The sheets name the stills.

## Scene sheets

Spans and other seconds are on the scratch clock, for orientation only: the re-voice moves them,
and `assets/scenes.js` is the truth after any re-time. Rows are the storyboard's. "Checks" are the
storyboard's § Build checks and the critic's items, as storyboard time and then the anchor
`tools/board-clock.py` gives for it: write the anchor, never the time. Merc placement: feet point and
shown size; a hero-view Merc's feet line is 0.80 of his square, a front-view one's 0.81 (`L.merc`).
Every drop takes 0.85 s, the renderer's whole fall and splat, starting 1.1 s before its host's first
word, and falls in whole from above the frame by its intro (DECISIONS 81, 86); every hop out takes
0.6 s (STORYBOARD § Merc performances). `L.mercGate` does all of it, the trap 23 gate and the intro
included: give it the scene id, the pass, its tag's id, the corner and the hop's start, and run
`tools/merc-tags.py <scene-id>` so the intro's segment tags are there. Keep every mark 20 px clear of
a dropping Merc's column, his body's width down to his feet, for the drop's 0.85 s: from the frame's
top while he falls (its first 0.55 s, DECISIONS 86), from the top of the intro's box (at size 300 in
the hero view, y 323) after that.

### s01-cold-open: Cold open, seven stairs, one short of home (0.00 to 34.18)

- Rows: 1a to 1g. Group A.
- In: frame 0 is a finished picture (HANDOFFS § Inside A, Cold open): F-cold (1.2x), the compact
  staircase on C, bare: the fifteen compact rows (C4 to D5, world x 230 to 1206), eight dim stairs
  named do re mi fa so la ti do, the top stair an outline under an unlit house, no keyboard; "from
  C" under its foot (screen x 389, baseline 860); the kicker "FIND YOUR PITCH · LESSON 04" (gone by
  5.6); both Mercs on the floor, feet (230, 840) and (1690, 840), front, 420, wet reflections at
  16 %. The room is `L.room(root, { floor: true })`.
- Out (to s02, same group): S1g and HANDOFFS § S1 to S2: the two lines leave up fast from
  `at('o2', 'end', 0.07)`; the Mercs slide 360 px outward and out of frame from `at('o2', 'end')`
  (0.6 s, power2.in, to feet x -130 and 2050); the dolly `cam.to(at('hook', 'start', 0.17), 0.93,
  'F-house', 'power3.in')`; from 33.30 the house's glow grows toward the lens, its edges blurring
  away, until the full-frame field covers the frame at the dolly's end: chrome at 75 % over the
  ground at the centre falling to 35 % at the corners, no edges, mean brightness 110 to 125 of 255;
  it holds, breathing 2 % in brightness from film time, to the cut at `at('title')`.
- Kit: `L.frameRig` (the drift `cam.to(0, at('o2', 'end'), 'F-cold end', 'power1.inOut')`, which
  keeps the screen point (960, 486) still, then the dolly); `L.stairs(mid, { x0: 230, x1: 1206, k0:
  0, k1: 14 })` with the top house only (`houses.top` with `w: 0`: before the strip exists the
  staircase on D keeps C's columns, `w` 0 and `s0` 2, and rises two rows, 10.2 to 11.0); stairs lit
  blue, then orange (45 % mixes), the top stair `fill: 'outline'` until land-d fills it; `L.bead`
  and `L.bead4` (Merc's bead from his mouth to stair 1, then a hop per note; Tavi's dropping onto
  stair 1; the rise into the house, 23.2 to 23.5); `L.echoRings`; `L.arrow` (ink-2, from the bead
  up to the outline top stair); `L.guessRing` (the dashed ring round "from C", with its "?");
  `L.ringTimer` (predict-d, at (610, 278)) and the ink check that replaces it; `L.kicker`; type for
  "from C", "from D?", "still hanging?", "home moved", "finished on do", "restless on ti?".
- Merc: m01-blue and m01-orange, front, 420, turned toward the stairs, on screen from frame 0 to the
  slide out. Merc's bead leaves his mouth at about (270, 664) **(provisional: the pass's mouth
  point)** at 0.30 and lands on stair 1 at 0.60 (stop-c's start).
- Checks: frame 0 a finished picture; the hook by 0:33 (o2 ends 32.78); "from D?" at 10.9 once "from
  C" has gone; "finished on do" at 29.1 once "home moved" has gone; Tavi's bead drops onto stair 1
  (14.79 to 14.99, `at('stop-d', 'start', -0.2)`), crossing neither the staircase, the house nor
  "still hanging?" and its fading ring timer; no bead stands over the house (it rises in, 23.2 to
  23.5); the stairs keep 38 px or more from both Mercs at the drift's end (HANDOFFS § Framings,
  F-cold end); the field's mean brightness on a still at 34.0.

### s02-title: Title (34.18 to 37.58)

- Row: 2. Group A. Adapt Lesson 2's `output/motion/lesson-02/compositions/s02-title.html` (the field
  shrinking into a bead on the staff's middle line, the five chimes, the notes hopping in with a
  ripple each, all keyed off `at('title')`): the title "The major scale and home" (chrome serif
  italic 140 px, one line, centred, baseline 380), its kicker "LESSON 04", "Find Your Pitch"
  (Outfit 48 px) under it.
- In: HANDOFFS § S1 to S2: the same field; it shrinks into the bead over 34.18 to 34.64 (Lesson 2's own curve: the radius on power2.out, the centre on power3.out; DECISIONS 112);
  the title lands from 34.44; the notes hop in with the chimes at 34.23, 34.32, 34.41, 34.50 and
  34.59 (the sting's own offsets from `at('title')`).
- Out (to s03, same builder): from 36.6 (`at('title', 'start', 2.42)`) the type and notes exit up;
  the staff fades 36.9 to 37.5 while the staircase on D fades up under it in F-cold (stairs unlit,
  the top stair filled unlit, the house unlit), and the bead flies back into the top house from
  `at('title', 'start', 2.72)` over 1.0 s (power2.inOut), ending at the house's centre (screen
  (1464, 215)) and lighting it: draw this in both s02 and s03 with the same call from film time.
- Kit: Lesson 2's s02 (`L.staff`, `L.note`, `L.kicker`), plus `L.stairs` and `L.house` in F-cold for
  the fade-up. Merc: none.
- Checks: the notes bob 8 px on a 1.2 s cycle so the card never holds (confirm in the clip); the
  staircase and the bead on s02's last frame and s03's first match to 2 px.

### s03-promise: The promise (37.58 to 47.05)

- Rows: 3a to 3c. Group A.
- In: HANDOFFS § S2 to S3: F-cold (1.2x), the staircase on D at full (unlit, the top stair filled
  unlit, the house unlit), the bead in flight to the house, no Mercs.
- Out (to s04, same group): HANDOFFS § S3 to S4: F0, the staircase on C, names do to do, the top
  house lit; the rows already full width (x 220 to 1680, widened 46.3 to 46.9); the list gone at
  46.75.
- Kit: `L.stairs` (the seven risers growing in turn, one every 0.2 s from 38.7; the slide down two
  rows to C, 41.3 to 42.2; the stairs lighting chrome in turn, 42.9 to 43.4, 0.07 s apart; the rows
  widening from the compact x 230 to 1206 to x 220 to 1680 as the pull ends); `L.frameRig` (the pull
  and pan `cam.to(word('b3', 'hear'), 2.5, 'F0', 'power2.inOut')`); the list (frame-fixed, Outfit 600
  44 px at x 140, baselines 200, 260, 320, 380); `L.arrow` (ink, 3 px, from ti's tread to the house).
- Merc: none.
- Checks: S3a to S3c (37.6 to 47.0) carry small events with no Merc on screen: the tightest span is
  40.8 to 41.3 (`word('b3', 10, 'start', 0.56)` to `word('b3', 'start')`); the list stays 185 px or
  more above every tread it crosses.

### s04-recall: From Lesson 2, twelve semitones, seven steps (47.05 to 69.35)

- Rows: 4a to 4d. Group A.
- In: S3 to S4 (above).
- Out (to s05): **HANDOFFS § A to B** (fixed): F0, no Mercs (m04 ended 68.55), the kicker lane
  empty; the staircase on C at full: names do re mi fa so la ti do (36 px, baseline 724), risers
  unmeasured (4 px chrome at 40 %), no riser labels, no house; rows C4 to G5, x 220 to 1680,
  black-key rows shaded; no strip.
- Kit: `L.kicker('From Lesson 2')`; `L.stairs` (dimmed to 25 % with its labels and house faded, 47.1
  to 47.5; back to full on the new rows, 60.2 to 60.6; the seven risers growing in turn on "seven
  steps"); `L.tiles` (Lesson 2's row, C4 to C5, HANDOFFS § Carried, rising from 300 px below, 47.6
  to 48.6, power3.out; the tiles scaling in turn, the dark ones lit to 60 % chrome);
  `L.tileBrackets` (the twelve "1" brackets, y 740, labels at 790); `L.ringTimer` (q0 at (164,
  232)); the stand-up (HANDOFFS § S4c's stand-up, scene-built from the tiles' geometry:
  **provisional**, the lab decides the pivot and the curves; if the lab shows tiles vanishing rather
  than the row turning upright, the row tips about its left end over 1.5 s instead); "1 octave = 12
  semitones" and "in 7 steps" / "in 7 steps?" (frame-fixed, top left).
- Merc: m04-orange (feet (1800, 840), 300, hero, turned left) drops in at `at('o3', 'start',
  -1.1)` (61.45, during b6), talks o3, listens to b7, and hops out right at `at('b7', 'start', 0.29)`.
- Checks: S4a to S4c (47.0 to 61.45) with no Merc: the tiles, the brackets, the stand-up; S4c reads
  as the row turning upright into the rows (a 3 s clip of 58.4 to 61.4 first); the labels keep the
  top left after the stand-up.

### s05-steps: Count the steps (69.35 to 110.88)

- Rows: 5a to 5g. Group B.
- In: A to B (fixed, above). The scene cuts on `act1` 0.15 s before it.
- Out (to s06, same group): HANDOFFS § S5 to S6: F0; Tavi down since 110.08 (m06a's leap, DECISIONS 123, spans the
  cut: feet (1800, 840), 300); the staircase on C with letters, all seven risers measured and
  labelled T T S T T T S, the legend at x 140; E4, F4, B4 and C5 named.
- Kit: `L.strip` (sliding up from y +240, 69.55 to 70.45, power3.out, via `dy`; the eight keys up to
  full on "on the white keys"; hairlines drawn staggered 0.06 s via `hair.hA(n)`); `L.stairs`
  (names to letters through the label pools; risers `measuring`, then `tone` or `semi` with `grow`;
  labels T and S); `L.frameRig` (CU-A `cam.to(word('b9', 'Now', 'start', 0.08), 1.5, 'CU-A',
  'power2.inOut')`; the pan to CU-B `cam.pan(word('o4', 'with', 'start', 0.08), 1.6, { x: -480 },
  'sine.inOut')`, which moves every layer alike by 480 screen px, so CU-B's `ox` lands on -760 and
  the far layer sits at -550, as HANDOFFS § Shared formulas works out; then the pull
  `cam.to(word('b10', 'Yes.', 'start', 0.03), 1.6, 'F0', 'power2.inOut')`, which eases the pan's
  part back out with the rest); `L.bead` and `L.bead4` (drops onto stair 1 before scale-c and steps-c;
  runs at their onsets); `L.echoRings`; `L.pulse`; `L.kicker('1 · Measure the steps')`; "a major
  scale" (serif italic 110 px at x 1250, baseline 300); the legend (frame-fixed, top left, after the
  pull).
- Merc: m06a-orange leaps in from the right edge (`leap: true`, DECISIONS 123): its pass opens 1.38 s
  before o5 (109.50), she is in the air 109.65 to 110.08 and settled by 110.30; its pass spans
  the S5 to S6 cut.
- Checks: the tightest spans, 74.8 to 75.24 (`word('b8', 13, 'start', 0.46)` to `at('scale-c')`),
  82.2 to 82.5 (`word('b9', 7)` to `word('b9', 7, 'start', 0.29)`), 92.4 to 93.3 (`word('b10', 3,
  'start', 0.28)` to `at('b10', 'end')`) and 106.76 to 107.15 (`word('b12', 3, 'start', 0.70)` to
  `word('b12', 5)`); CU-A and CU-B land where HANDOFFS § Framings puts them (the C-D riser and then
  the E-F riser at screen x 436); the push and the pull show the layers parting and the CU-A to CU-B
  move is a pan; the 40 % chrome stair mix registers in measure.py (§ Motion above); a stair name on
  a lit stair and "C♯" on the lit C♯4 key at 4.5:1 or better.

### s06-groups: Two groups and a joint (110.88 to 146.10)

- Rows: 6a to 6d. Group B.
- In: S5 to S6 (above).
- Out (to s07): **HANDOFFS § B to C** (fixed): F0 (since the pull landed at 124.0), no Mercs (m06b
  ended 145.65), the kicker lane empty; the staircase on C at full, letters C to C, risers measured,
  riser labels 2 2 1 2 2 2 1, hairlines drawn; the strip with C major's keys at full and the rest at
  45 %, no key names (gone at 145.8); no sum, brackets or legend.
- Kit: `L.bracket` (ink, ticks down, riding the world: stairs 1 to 4 x 242 to 714, stairs 5 to 8
  x 722 to 1194, at the heights HANDOFFS § S6's brackets gives); `L.frameRig` (F-low `cam.to(word('b13', 3), 1.6, 'F-low',
  'power2.inOut')`; the truck to F-high from `at('group-low', 'start', 1.52)`, 1.1 s, a `to` so the
  layers part; the pull to F0 from `at('group-high', 'start', 2.07)`, 1.1 s); `L.bead4` (group-low
  and group-high; the hop from stair 4 to stair 5 lands on G4, 120.83, once the truck has settled);
  the ghost outline (stairs 1 to 4 and their risers, drawn from `L.ST` beneath the riser labels,
  moving by (+480, -182), 124.3 to 125.6, power2.inOut); the sum (Outfit 600 50 px at x 1270, baseline 260; DECISIONS 110) and "= 12"; the
  octave bracket (chrome, vertical, x 1232, y 664 to 352) and "= 1 octave" (serif italic 96 px at x
  1262, baseline 543); `L.pulse`; `L.echoRings`.
- Merc: m06a-orange talks o5 and hops out right at `at('o5', 'end', 0.09)`; m06b-orange leaps in from
  the right edge (`leap: true`, DECISIONS 123: its pass opens 1.38 s before o6, 134.55; in the air 134.70 to 135.13), talks o6, listens to b16, and hops out right at `at('b16', 'end',
  -0.55)`.
- Checks: S6a to S6c (114.8 to 130.5) with no Merc: the push, the truck, the pull; S6b's truck reads
  as a truck (the layers part), not a pan; **critic 03 item 2**: the bead's hops in S6b keep clear of
  the riser labels (stills at the middle of every hop from 118.1 to 123.5: 7 px or more from a
  tone's label, 6 px from a semitone's, 28 px or more from a riser's bar).

### s07-predict: Predict, the white keys from D (146.10 to 199.36)

- Rows: 7a to 7h. Group C.
- In: B to C (fixed, above). Under the card the riser labels return to T and S, unseen.
- Out (to s08, same group): HANDOFFS § S7 to S8: Tavi on screen (m08 from 198.27); the staircase on D
  at full, letters D E F♯ G A B C♯ D, riser labels T T S T T T S, F♯4 and C♯5 lit (their names gone
  at 195.7), "D major" up (it leaves in S8a, 199.4 to 199.6).
- Kit: `L.chapterCard(hud, { num: 2, title: 'Start anywhere', baseline: 480, tIn: at('act2', 'start',
  0.22), tOut: at('o7', 'start', -0.48) })` over the staircase dimmed to 25 % (labels hidden);
  `L.kicker('2 · Start anywhere')`; Tavi's dashed staircase (HANDOFFS § World, Tavi's white-keys
  staircase: D's columns, heights 0 2 3 5 7 9 10 12, `L.GUESS`, dashed hairlines to the white keys,
  its "?"), filled ink-2 at 25 % where the rows say; `L.pill` (the two pills, the check on
  "changes"); `L.ringTimer` (predict, at (620, 440), r 24); `L.frameRig` (the slow push to F-white
  `cam.to(at('predict'), 4.3, 'F-white', 'sine.inOut')`; the pull `cam.to(word('b19', 'Now'), 1.0,
  'F0')`; CU-D from `word('b21', 6, 'start', 0.17)`, 1.0 s; the crane to F-keys-D from `word('b21',
  16, 'start', 0.52)`, 1.0 s; the pull from `word('b22', 11, 'start', 0.66)`, 1.0 s); `L.stairs` (the
  real staircase back to full on C as the pull lands, its slide to D, 170.7 to 171.6); `L.strip`
  (F♯4 and C♯5 lit to 40 % chrome); `L.bead4` (white-d on the dashed treads, major-d on the real
  ones); the step rows (frame-fixed, "WHITE KEYS" and "MAJOR" JetBrains Mono 28 px from x 140, the
  steps Outfit 600 48 px from x 340); `L.arrow` (the two small ink arrows); "Predict." and "D major"
  (serif italic 120 px at x 140, baseline 300); `L.pulse`; `L.echoRings`.
- Merc: m07-orange drops in at `at('o7', 'start', -1.1)` (147.35, under the act 2 card, down as it
  leaves), talks o7, and hops out right at `at('o7', 'end', 0.07)`; m08-orange drops in at
  `at('o8', 'start', -1.1)` (198.27), once the pull has landed.
- Checks: S7c to S7h (153.3 to 198.27) with no Merc: the predict, the push, the close-up, the crane;
  the tightest spans 163.3 to 163.83 (`word('b18', 2, 'start', 0.37)` to `word('b18', 5)`) and 188.75
  to 188.93 (`word('b21', 14, 'start', 0.02)` to `word('b21', 15)`); the ring timer stays 28 px or
  more from every dashed stair while it is up; at CU-D the dashed treads lie 52 px below the real ones
  (a still at 186.6); S7e's dashed and solid staircases differ only at stairs 3 and 7; "D major" lands
  at 196.6 once the dashed staircase has gone and the pull has landed; **critic 03 item 2**: the bead's
  hops in S7e (171.8 to 175.8) keep clear of the riser labels (stills at the middle of every hop).

### s08-anywhere: A pattern, not a set of keys (199.36 to 229.24)

- Rows: 8a to 8d. Group C.
- In: S7 to S8 (above).
- Out (to s09): **HANDOFFS § C to D** (fixed): F0, no Mercs (m08 ended 228.25), the kicker lane
  empty, the tally gone (228.9); the staircase on C at full: letters C D E F G A B C, riser labels T T
  S T T T S, hairlines; the strip with C major's keys at full and the rest at 45 %, no key names.
- Kit: `L.stairs` (the slides, interpolating `w` and `s0` together, power2.inOut: D to G 208.0 to
  208.9, G to E 212.30 to 212.75, E to C 225.2 to 226.1; the letters switching as each slide runs);
  `L.strip` (the scale's keys and lit black keys following every slide; `hair` with the slide's `w`
  and `s0`); the three ghost outlines (the staircase's outline drawn from `L.ST` at 30 % where it
  stood on C, D and G, sliding onto E, 216.6 to 217.8); the tally (Outfit 600 64 px at x 140,
  baseline 250); `L.bead4` (slide-g and slide-e, 0.36 s a note); `L.pulse`.
- Merc: m08-orange (feet (1800, 840), 300) through 8d, listening to b23 to b25, and hops out right at
  `word('b25', 19)`.
- Checks: the camera holds F0 still from 196.6 to 229.2 (signature 2); on every start each stair's
  foot hairline lands on its key and the gold pair sits at stairs 3 to 4 and 7 to 8; **critic 03 item
  2**: the bead's hops in S8b and S8c (209.0 to 216.0) keep clear of the riser labels (stills at the
  middle of every hop).

### s09-names: Name the stairs (229.24 to 270.63)

- Rows: 9a to 9f. Group D.
- In: C to D (fixed, above). Under the card the riser labels leave for good.
- Out (to s10, same group): HANDOFFS § S9 to S10: Tavi on screen (m09 spans the cut); the staircase
  on C (back from D at 269.4), names do to do, both houses lit, no riser labels, no key names.
- Kit: `L.chapterCard(hud, { num: 3, title: 'Name the stairs', baseline: 480, tIn: at('act3',
  'start', 0.22), tOut: at('b26', 'start', -0.48) })`; `L.kicker('3 · Name the stairs')`;
  `L.frameRig` (the one push with no stop, HANDOFFS § Camera moves: its first leg from `at('b26')`
  to `word('b27', 'these')` as `cam.curve` with `s` on sine.in from 1 to 1.2, `ox = -420 (s - 1)`,
  `oy = -736 (s - 1)`; its second leg `cam.hermite(word('b27', 'these'), 1.4, 'F-names-1')`; the
  truck along the names `cam.to(at('b28'), 3.0, 'F-names-2', 'power1.inOut')`, the layers parting;
  the pull `cam.to(at('o9', 'start', -1.35), 0.8, 'F0', 'power2.inOut')`, 248.71 to 249.51, on
  the second "doh" and landing as Tavi's fall ends (DECISIONS 83), which blends into the truck's
  last 0.14 s); `L.stairs` (letters to
  numbers to solfège through the label pools, 86 px at 2.4x; both houses from "its home"); "tonic =
  home" (riding the world); "scale degrees" and "solfège" (frame-fixed at x 1400, baseline 420);
  `L.pill` in `L.GUESS` ("do = C?"), then solid ("fixed do: do = C", moving up and shrinking to 40
  px); "movable do"; "(sol)" (riding the world, right-aligned at x 828, baseline 474); the stair-1
  outline rising two rows; the slides to D and back (263.2 to 264.0, 268.6 to 269.4); `L.strip` (D4,
  E4 and F♯4 named in turn).
- Merc: m09-orange drops in at `at('o9', 'start', -1.1)` (248.97) as the pull out runs, and lands
  with it: the pull runs 248.70 to 249.50, so it lands as her fall ends (249.52).
- Checks: S9a to S9d (229.2 to 248.97) with no Merc: the slow push and the truck; the push never stops
  between F-near and F-names-1 (s, ox and oy each move one way only: plot them from the lab or print
  them from `cam.state(t)` at 0.05 s steps); "scale degrees" lands at 241.44 with the top stair's
  right edge at x 1294; the truck in S9d is a truck (the layers part); "solfège" lands at 249.50 once
  the pull has landed; nothing comes within 20 px of Tavi's column (x 1700 to 1900, from the frame's
  top down) in any frame of the pull; "do = C?" at 252.58 once "solfège" has gone; "movable do" under the moved
  "fixed do"; on D the top house stops 74 px short of the pills.

### s10-ti: Ti, one short of home (270.63 to 295.94)

- Rows: 10a to 10c. Group D.
- In: S9 to S10 (above).
- Out (to s11, same group): HANDOFFS § S10 to S11: both Mercs on screen (m09 and m10 span the cut);
  the staircase on C, the stairs lit blue (they fade in S11a), no bead, the top house lit, the bottom
  house returning lit (295.9 to 296.3).
- Kit: `L.frameRig` (CU-C `cam.to(word('b32', 'Back', 'start', 0.05), 1.5, 'CU-C', 'power2.inOut')`;
  the pull `cam.to(word('b33', 'Listen:', 'start', 0.07), 1.7, 'F0', 'power2.inOut')`); `L.strip`
  (fading and sinking over the push, back over the pull); `L.stairs` (stair 7 lit; the ti-do gold
  riser growing twice; the top stair emptying to an outline and its house unlighting, and the bottom
  house fading out, 281.5 to 282.0); "1 semitone" (frame-fixed at x 1200, baseline 250); `L.arrow`
  (ink from ti's tread up to do's; then ink-2 up to the outline); `L.bead4` (Merc's bead: a hop from
  his mouth onto stair 1 landing at `at('stop-c-home')`, peaking at y 602, 72 px over the straight
  line and 40 px clear of stair 1's corner (242, 664); the run at stop-c-home's onsets; land-c's
  hop onto the top stair at 294.14 and the rise into the house, 294.2 to 294.5); `L.echoRings`.
- Merc: m09-orange (feet (1800, 840), 300, hero) on screen throughout, clear of the stairs in CU-C by
  its numbers; m10-blue (feet (110, 840), 300, hero, turned right) drops in at `at('stop-c-home',
  'start', -1.37)` (282.20, as the pull lands; CU-C's lower stairs fill his corner, and the pull
  clears it of stair 1 by then); his bead leaves his mouth at (156, 797) 0.3 s before
  stop-c-home. The renderer's first hop always arcs right, so m10-blue (and
  m11-blue in s11) is rendered facing left and the scene mirrors its box, reflection and all
  (`L.merc(...).box.style.transform = 'scaleX(-1)'`, as Lesson 2's s10): on screen he faces right,
  toward the stairs, and his hop out arcs left.
- Checks: **critic 03 item 3**: stills at 283.42 (the hop's middle) and 283.5 show the arc's apex and
  40 px between the bead and stair 1's corner; the bead on stair 1 (y 620 to 664) never meets the
  bottom house (gone by 282.0); "1 semitone" and the arrow leave before the pull (280.5 to 280.7); no
  bead stands over a house.

### s11-why: Why do is home (295.94 to 341.24)

- Rows: 11a to 11f. Group D.
- In: S10 to S11 (above).
- Out (to s12): **HANDOFFS § D to E** (fixed): F0, no Mercs (m11 ended 341.15), the kicker lane
  empty, every label gone (340.9); the staircase on D at full: names do to do, both houses lit,
  risers measured (no labels), hairlines; the strip with D major's keys, F♯4 and C♯5 lit.
- Kit: `L.kicker('An experiment')` and the credits (frame-fixed, Outfit 500, ink-2, x 120);
  `L.frameRig` (the push to F-exp `cam.to(word('b35', 1, 'start', 0.32), 1.2, F_EXP, 'power2.inOut')`,
  F-exp being the old F-chart, 1.3x about (840, 250), kept in s11; from "top" (307.13, 1.85 s,
  power2.inOut) on to F-chart, 1.45x about (960, 104), following the stair names in; a sideways
  drift of about 5 px a second between, horizontal only, turning only inside beats (DECISIONS 98);
  the pull `cam.to(at('o11', 'start', -1.35), 0.8, 'F0', 'power2.inOut')`, 320.23 to 321.03, landing
  as Tavi's fall ends (DECISIONS 83)); the probe bead with its
  "?"; the axis and its labels; the shelves and chips (HANDOFFS § S11's experiment: chips 120 x 56,
  radius 12, `#1b232d` opaque with a 2 px chrome rim at 55 % and ink names; the black keys' dim chips
  chrome at 35 % with ink letters; the shelves closing to 64 px apart and spreading back);
  `L.house` (the lit house beside do on the top shelf); `L.stairs` (dimmed to 20 %, its labels hidden,
  and back to full, 322.2 to 322.6; the names flying out as chips and back); "learned, it seems" and
  "one short step" with its hairline to the riser; "leading note" (riding the world) and its curved
  arrow; the slide to D (335.6 to 336.4) with "leading note" and the arrow riding; "ti = C♯";
  `L.strip`.
- Merc: m09-orange and m10-blue in the corners for o10, both hopping out at `at('o10', 'end')` (Merc
  starting b35 as he goes); m11-orange drops back into her corner at `at('o11', 'start', -1.1)` (320.48), as
  the pull out runs, and m11-blue into his at `at('b36', 'end', 0.05)` (321.03), as his own line
  ends; nothing comes within 20 px of either column (Tavi x 1700 to 1900, Merc x 10 to 210, from the
  frame's top down) in any frame of the pull or the falls; both hop out at `at('b38', 'end', -0.19)`.
  m10-blue and m11-blue are mirrored in the scene, as in s10.
- Checks: the dim chips' letters on the fourth shelf at 4.5:1 or better; the chips 8 px apart at the
  closest and never touching, in every frame of the shelves' close and spread; no numbers anywhere on
  the chart; "leading note" lands at 330.8 once Tavi's two labels have gone.

### s12-sing: Sing it, Merc then Tavi (341.24 to 372.92)

- Rows: 12a to 12e. Group E.
- In: D to E (fixed, above). The scene cuts on `act4` 0.15 s before it.
- Out (to s13, same group): HANDOFFS § S12 to S13: the S12 guide with every segment lit, the orange
  bead on do's segment end (it fades in S13a), "wait", the arrow, the chip and the house still up;
  Merc (240, 840) and Tavi (1700, 840) at 360 (m12 spans the cut).
- Kit: `L.chapterCard(hud, { num: 4, title: 'Sing it', baseline: 480, tIn: at('act4', 'start', 0.22),
  tOut: at('b39', 'start', -0.48) })`; `L.kicker('4 · Sing it')`; `L.stairs` (dimmed to 25 %, back to
  full as the card's exit ends, 343.49 to 343.69); `L.strip` (sliding down and out, 341.6 to 342.2,
  power2.in); the tip into the guide (HANDOFFS § S12a's tip, scene-built from `L.ST` and § The guide:
  **provisional**, the lab decides the curves); the guide (lanes x 600 to 1440, 46 px; names
  right-aligned at x 556; the path's amber band at 35 %, lighting to full behind the bead; "wait"
  over the hold; the house at (1381, 116)); `L.bead4` (each bead drops onto the path's start (600,
  737) and rides it, stepping up a lane on each note at the onsets above (a 0.18 s hop centred on
  each onset; DECISIONS 99), lifting and dimming in the rest; DECISIONS 96: each crossing within 40 ms of the voice's onset as measured from the sung
  track, and a bead parks with its right edge at x 1440 at the latest); `L.arrow`; the chip "one octave up" (`L.pill`, mono 30 px); `L.echoRings`.
- Merc: m12-blue (feet (240, 840)) and m12-orange (feet (1700, 840)), rendered at 520 and shown at
  360, front, turned toward each other; Merc drops in at `at('b39', 'start', -1.1)` (342.50) and
  Tavi 0.12 s after him, both under the act 4 card and down as it leaves; the card's type keeps
  20 px from both columns (Merc x 144 to 336, Tavi x 1604 to 1796, from the frame's top down).
- Checks: the tip and S13d's reverse tip read as the same staircase changing shape, with no frame
  where it is absent (a 2 s clip of 343.6 to 345.6 first); the beads drop onto the path 22 px or more
  from its names; the bead on do's segment keeps 21 px under the house; the lane names fade in only
  as the tip lands; no riser stays where its stair was during the tip (the gold pair gone by
  343.99); every lane crossing within 40 ms of its onset, measured, for both beads.

### s13-your-turn: Your turn (372.92 to 405.49)

- Rows: 13a to 13d. Group E.
- In: S12 to S13 (above).
- Out (to s14): **HANDOFFS § E to F** (fixed): F0; the staircase on C at full: names do to do
  (baseline 724), both houses lit, risers unmeasured, no riser labels; the strip with C major's keys
  at full and the rest at 45 %, hairlines drawn, no key names; Merc at (110, 840) and Tavi at (1800,
  840), both at 300 (Merc's move ended 405.2; Tavi there since S13a; m12 spans the cut); every mark
  of S13 gone (404.24).
- Kit: the guide's move to the right half (HANDOFFS § The guide in S13: lanes x 1060 to 1700, 40 px,
  names right-aligned at x 1040; from `at('b41', 'start', 0.08)`, 0.9 s, power2.inOut) and the plain
  guide on the moving lanes (DECISIONS 96: S12's amber band thinning and cooling in place into the
  path, a solid 6 px chrome line at 70 %, 372.94 to 373.54; the lane rules giving way to faint fills
  on the eight named lanes, 373.24 to 373.54; the names in ink-2); "Your turn." (serif italic 120 px at x 380, baseline 200); the care block
  (HANDOFFS § The care block: every line, size, baseline and break as given); the count-in's bead
  (dropping 184 px onto (1090, 700) over 0.35 s, landing at `at('count-in')`, gone 1.0 s later;
  DECISIONS 99); the cursor (a vertical
  chrome line, 4 px with a soft glow, sweeping the lanes at your-turn's onsets, the segment under it
  at full chrome with the same glow); the reverse tip into the staircase on C (HANDOFFS § S13d's
  reverse tip, from `at('your-turn', 'end', 0.10)`, the staircase still by about 405.15:
  **provisional**, the lab decides the curves within its limits); `L.strip` (rising from y +240 after
  the blocks, power3.out, its hairlines over its last 0.2 s).
- Merc: m12 (both). Over the guide's move Merc scales to 300 in place and Tavi to 300, moving to
  (1800, 840), her recap corner (20 px from the lanes' end, 40 px from the frame's edge); through
  your-turn both idle (the passes draw no arcs); over the breath, from `at('your-turn', 'end', 0.16)`
  for 1.2 s, Merc moves to (110, 840) at 300 on 6p² − 8p³ + 3p⁴ (DECISIONS 99), clear of every row
  and stair as he goes (the rows are masked); Tavi stays.
- Checks: nothing in S13 suggests the film or the app hears the viewer (no microphone, no listening
  ring, no ring timer, no Merc listening, nothing of the app's drawing over the turn); S12's marks
  leave first (372.94 to 373.24) while the band thins into the path in place (no frame without a
  path), and the fills come in after them; "Your turn." lands at 373.55 once the chip has gone and
  the moving names have passed (a still at 373.55: HANDOFFS § The guide in S13 has the positions);
  the path reads at phone size (a still at 400 x 225: the path and the lit segment stand clear of the
  fills); the care lines from 373.85, the doctor lines at 373.9
  once the guide has stopped; nothing of the care block below y 864 and no line past x 960; the
  doctor lines at 4.5:1 or better; in the breath the reverse tip starts inside the care block's fade,
  no block grows in under 0.5 s, and the frame is still (bar the Mercs' idle) for about 0.3 s before
  the cut.

### s14-recap: Quick check (405.49 to 470.24)

- Rows: 14a to 14g. Group F.
- In: E to F (fixed, above). The scene cuts on `recap` 0.15 s before it.
- Out (to s15, same group): HANDOFFS § S14 to S15: the Mercs in the corners at 300; the card and
  the ladder gone (470.0) but for the ladder's top rung, which slides across the cut, below S15's
  '"support"' (DECISIONS 108), into S15's bead
  on one curve (469.9 to 471.9; DECISIONS 102).
- Kit: `L.kicker('Quick check')` (landing on the recap mark, 405.64; DECISIONS 97); the card panel
  (fading in with each card and leaving with it; frame-fixed: x 120 to 1000, y 140 to 330, radius
  16, a chrome stroke at 25 %, obsidian fill at 85 %; text Outfit 600 40 px, ink, at x 150,
  baselines 220 and 280); `L.ringTimer` (q1 to q4 at (950, 250)); `L.frameRig` (F-recap-1 from
  `at('q1', 'start', 0.43)`, 1.6 s; the pull from `at('b47', 'end', 0.08)`, 1.0 s; F-recap-3, now about (300, 400), from
  `word('b50', 4, 'start', 0.59)`, 1.2 s; the pull from `at('b51', 'end', 0.09)`, 1.0 s, each
  power2.inOut); `L.strip` (sinking 60 px and fading over each push via `dy` and `a`, returning over
  each pull; S14c's behaviour below); `L.stairs` (the riser labels and gold fills of 14b and 14d,
  every riser back to unmeasured at 419.62 and 443.01; the slides to D, C and G; both do stairs and
  houses); `L.bead4` (ti-do: the top house unlighting as the bead drops onto ti, 433.09 to 433.29; on
  do's onset, 433.74, the hop from ti straight into the house's centre, the house lighting as it
  enters, 433.74 to 434.04); S6's two brackets in 14b (`L.bracket`, HANDOFFS § S6's brackets, placed
  for F-recap-1); one ripple, on "steps"; the ladder (S14f, HANDOFFS § The ladder: drawn large first
  and eased to its card-time box over 459.4 to 460.0; the panel, the
  playhead, the dashed amber target line and its "A4" pill, the violet sung line with its break, six
  chrome rungs at the app's spacing and the lifted falloff (100 % down to 45 %), "B4" and "C5", the dashed connector, "Scale Runner"
  and "ILLUSTRATION"); the practise card (HANDOFFS § The practise card: the tab icons are the app's
  SVGs in `src/components/AppNavTabs.tsx` and the × the intro's close glyph in
  `src/features/onboarding/FirstLight.tsx`, read with `git show b803c7d43:<path>`); `L.arrow`;
  `L.echoRings`; `L.pulse`.
- Merc: m12-blue at (110, 840) and m12-orange at (1800, 840), both shown at 300, in the corners
  throughout.
- Checks: **critic 03 item 1**: on 14c's slide to D (421.4 to 422.3) the strip's eight lit keys fade
  to 45 % with the rest, so from 422.3 to 427.22 it shows no scale (a still at 424.0), and D major's
  keys come up on "F sharp" (427.22), F♯4 lit and named, then C♯5 on "C sharp" (427.84); the bottom
  house fades out 413.0 to 413.3 (`at('q1', 'start', 2.43)`), before 14b's first label, and returns
  lit from `at('b47', 'end')`; no later card finds its answer already drawn; in F-recap-3 the "S"
  stands right-aligned at screen x 1382, baseline 358, 14 px clear of the bead on ti, and the stair
  names sit at baseline 854; nothing in S14 holds still over 0.5 s from the cut to card 1 (the
  kicker lands at 405.64); the ladder fills the frame from 455.3 and has eased into its card-time
  box before the card's first line (460.0); the top rung lands on the same pixels either side of
  the 470.24 cut; the stairs keep
  38 px from Merc in F-recap-1 and 29 px in F-recap-3 (HANDOFFS § Framings); the ladder shows
  nothing the app does not (six rungs ahead, only the next two named, the sung line broken between
  notes, the run on G4, labelled "Illustration"); the rung names at 4.5:1 or better; the practise
  card's address and path match FACTS 85 and 88, and the director checks them at phone width in a
  local build before the card is called final (DECISIONS 27).

### s15-next: Next time (470.24 to 478.53)

- Row: 15. Group F.
- In: S14 to S15 (above). The scene cuts on `next` 0.15 s before it.
- Out (to s16, same group): HANDOFFS § S15 to S16: the Mercs in the corners at 300; S15's type gone
  (478.5).
- Kit: `L.kicker('Next time')`; the carried rung landing as a chrome bead at (560, 520) by 471.9
  (HANDOFFS § S14 to S15); '"support"' (serif italic 160 px with its quotation marks, centred,
  baseline 420, landing with the kicker on "Next", 470.71, and scaling 1.2 once on its word, 473.14; DECISIONS 108); the long note (the bead drawing a level line from x
  560 to 1360 at y 520, 474.1 to 475.4, wavering once on "pushing"); "what keeps it steady?" (serif italic 96 px, centred,
  baseline 680).
- Merc: m12 (both, 300, in the corners): Merc talks b54 and b55, Tavi o14.

### s16-end: End card (478.53 to 483.73)

- Row: 16. Group F. Adapt Lesson 2's `output/motion/lesson-02/compositions/s17-end.html` (the lockup;
  here the beads bob beside it rather than orbit, and the lockup's wipe has a feathered edge of
  about 60 px; DECISIONS 97) with this film's lines (STORYBOARD 16, HANDOFFS § S16): "Find your pitch." (serif
  italic 120 px, baseline 330); "Practise it free: mercurypitch.com/pitch-training" (Outfit 600 56
  px, baseline 440); the skip line and "then [Exercises icon] Exercises › Scale Runner" (Outfit 500
  40 px, ink-2, baselines 510 and 570, within x 636 to 1284). Lesson 2's file keys its bead window
  to its own `s16-next`; here that is `s15-next`.
- Merc: m12 (both): they grow to 520 and move to (330, 840) and (1590, 840) from `at('end', 'start',
  0.07)` for 0.6 s; the celebration is the passes' own (one hop, sparkles off, from
  `merc-shots.py`), and the scene draws a chrome ring under each on landing; the passes run to the
  film's end (trap 15).
- Checks: the call to action is the one hold the quality bar allows; the address sits 60 px above the
  Mercs' heads at rest and never nearer than 57 px, rising in only once the hop has come down
  (DECISIONS 95); no frame of the wipe slices the wordmark.

## Handoff confirmations

The director records here each provisional HANDOFFS value once its builder has confirmed it in a
lab still (still paths beside it). Until then, the HANDOFFS value is the one to build to.

| Handoff | Value | Confirmed | Stills |
| --- | --- | --- | --- |
| World geometry | rows, stairs on C, D and G, strip, hairlines, houses | kit lab: exact | `lab/kit-stairs/` |
| Inside A, S1 | Merc's mouth point: (261, 781) on m01-blue, not (270, 664) | builder A, on the s01 clip with the pass | `lab/s01-cold-open/scratch/mouth/sheet.png`, `full-1.0s.png` |
| Inside A, S4c | the stand-up: pitch 120 to 26 px and width 112 to 24 px over 0.6 s from STAND (power2.inOut); the turn, and the pivot from (240, 560) to (360, 677), from STAND + 0.2 over 0.8 s; each sliver to x 220-1680 and 26 px over 1.0 s, its fill fading from + 0.3 over 0.7 s (power2.in); an exact crossfade to the kit's rows at STAND + 2.2 | builder A: reads as the row turning upright, so the fallback tip is not needed | `lab/s04-recall/scratch/standup/sheet.png`, `lab/s04-recall/frame-09` to `frame-14` |
| A to B, 69.35 | s04's last frame against s05's first (29 Oct, after both fix rounds' gate moves): max 19, 0.003 % over 8, none over 24 | director | `lab/entrances/seam-s04-last.png`, `seam-s05-first.png` |
| B to C, 146.10 | s07's frame 0 against s06's last clip frame (with its passes): max 36 at edges, mean 0.39; after B's fix round the semitones' gold corner (B-01 item 2) vanished at the cut until the kit drew it too (DECISIONS 85), then max 22, none over 24 | builder C; director | `lab/s07-predict/scratch/diff-s06-s07.png`, `lab/entrances/seam-s06-last.png`, `seam-s07-first.png` |
| Inside C, S7 to S8 (199.36) | s07 at 53.253 against s08 at 0.007: max 21, two pixels over 16 (dust) | builder C | `lab/s07-predict/scratch/diff-s07-s08.png` |
| C to D, 229.24 | s08's last frame against s09's first: max 10, no pixel over 16; again after the gate move and the re-timed pulls (29 Oct, 12:30): max 18, 0.003 % over 8, none over 24 | builder C; director | `lab/s08-anywhere/scratch/diff-s08-s09.png`, `lab/entrances/seam-s08-last.png`, `seam-s09-first.png` |
| Inside D, S10 to S11 (295.94) | s10's last frame against s11's first: max 22, no pixel over 24 | builder D | `lab/s11-why/tools/hdiff.py` |
| D to E, 341.24 | s11's last frame: stair 1 at x 361 to 474, both houses lit, on D, F♯4 and C♯5 lit, no labels; s11's last against s12's first (29 Oct, 12:30, m11's passes in): max 17, 0.002 % over 8, none over 24 | builder D; director | `lab/s09-names/BUILD-NOTES.md`, `lab/entrances/seam-s11-last.png`, `seam-s12-first.png` |
| Inside A, S4d | Tavi's drop seen whole (m04, 61.45 to 62.30): in high over her corner (body from y 360), the whole fall, the splat (62.05), standing by 62.37, before o3 (62.54); the stripe field ends at x 1680, 20 px clear of her column | director, s04 lab stills with the pass and its intro | `lab/entrances/s04-m04-corner.png` |
| Inside B, S5g | Tavi's leap in from the right edge (m06a, DECISIONS 123): off frame through the crouch, in at the arc's top at about 109.83, landed with the squash at 110.08, settled by 110.30, before o5 (110.88) | director, s05 lab stills (30 Oct) | `lab/entrances/s05-m06a-leap.jpg` |
| Inside B, S5 to S6 (110.88) | Tavi in her corner on both sides of the cut: s05's last frame against s06's first are consecutive pass frames (mean difference 0.08, only along her edges) | director (30 Oct) | `lab/entrances/s05-s06-cut-leap.jpg` |
| Inside B, S6d | m06b's leap in from the right edge (in the air 134.70 to 135.13, settled by 135.35), before o6 (135.92), at floor level, far below the sum (baseline 260) | director, s06 lab stills (30 Oct) | `lab/entrances/s06-m06b-leap.jpg` |
| Inside C, S7a | the act 2 card ends at x 1528, 170 px clear of Tavi's column (x 1700); the strip's last key ends at x 1675, 25 px clear; the splat's spray reaches x 1678, beside that key, for about 0.1 s at 148.02 | director, s07 lab stills (m07's old pass under the new tag, its new intro) | `lab/entrances/s07-m07-card.png`, `s07-m07-splat-zoom.png` |
| Inside D, S9d | the pull to F0 (248.71 to 249.51, 0.8 s from o9 - 1.35 on the second "doh", power2.inOut) lands as Tavi's fall ends (m09-in drops 248.96 to 249.81, down before o9 at 250.06); the strip's keys pass behind her column from about 249.02 to 249.35 (DECISIONS 83) and she lands on bare floor beside its last key (x 1675) | director, s09 lab stills with m09-in's intro | `lab/entrances/s09-m09-pull.png`, `s09-m09-column-zoom.png` |
| Inside D, S11c | the pull to F0 (320.23 to 321.03, 0.8 s from o11 - 1.35, power2.inOut) lands as Tavi's fall ends (m11 drops 320.48 to 321.33: the splat at 321.10, standing by 321.40, eyes open by 321.50, before o11 at 321.58); the strip's right end passes behind her column from about 320.50 to 320.89 and is at x 1675, 25 px clear, when she lands (DECISIONS 83); the axis label "finishes it best" keeps 23 px over her column's top and leaves its x range by 320.60; Merc drops 321.03 to 321.88 with the world at F0: stair 1 and the keys from x 240, 30 px clear of his column (x 10 to 210); with his main pass in, he is first seen high above his corner at 321.20, lands by 321.60, splats 321.70 to 321.75 and stands by 322.20, eyes open, 5.7 s before b37 | director, s11 lab stills with both intros, then with m11-blue's main (12:20) | `lab/entrances/s11-m11-tavi-corner.png`, `s11-m11-tavi-landing.png`, `s11-m11-merc-corner.png`, `s11-m11-merc-landing.png` |
| Inside C, S7 to S8: m08's splice (203.65) | m08-orange-in hands over to m08-orange at film frame 12219: the same film frame differs by p99.9 8, max 15, no pixel over 24; the step seen there (p99.9 8, max 101, 5 pixels over 24) is the size of either pass's own step | director, both passes decoded | `lab/entrances/splices.txt` |
| Inside D, S9: m09's splice (254.50) | m09-orange-in hands over to m09-orange at film frame 15270: the same film frame differs by p99.9 11, 9 edge pixels over 24 (encoding noise on the outline); the step seen there (p99.9 10, 6 pixels over 24) is the size of the head's own step | director, both passes decoded | `lab/entrances/splices.txt`, `m09-splice.png` |
| Inside D, S10 | Merc's mouth point (156, 797), not the provisional (130, 715), at the bead's launch (283.27) on the m10-blue pass (he drops 282.20 to 283.05, DECISIONS 81; pass frame 64, mouth at (78, 144) facing left, mirrored at feet (110, 840), size 300); the hop to stair 1 then peaks at y 602 and clears stair 1's corner (242, 664) by 34 px | director, the pass decoded and the s10 lab still at the launch | `lab/entrances/s10-m10-mouth.png`, `s10-m10-hop.png` (283.27 to 283.63) |
| Inside E, S12a | the tip's curves | | |
| Inside E, S13d | the reverse tip's curves, the Mercs' move | | |
