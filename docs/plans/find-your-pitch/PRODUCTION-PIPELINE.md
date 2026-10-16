# Find Your Pitch: production pipeline

How a lesson becomes a film and a web page, as built and proven on Lesson 1. The film follows the
repository's `motion-designer` skill (`.claude/skills/motion-designer/SKILL.md`): HyperFrames
compositions on one seekable GSAP timeline, a fresh `motion-critic` after every stage, a measured
quality bar. This file records what a teaching film adds to that pipeline.

The Lesson 1 project is `output/motion/lesson-01/` (gitignored, per the skill's house rules). Its
`tools/` and `assets/lib/` are the seed of the reusable film kit planned for Phase 1.

## 1. The project layout

```
output/motion/lesson-NN/
  BRIEF.md  FACTS.md  STORYBOARD.md  HANDOFFS.md  BUILD-GUIDE.md  DECISIONS.md  LEDGER.md
  script.json            the typed script: lines, sung notes, examples, pauses, marks
  cues.json              generated: every event on one clock
  index.html             generated: one host per scene + the soundtrack
  compositions/sNN-*.html  one sub-composition per scene, local timeline
  assets/
    cues.js scenes.js    generated timing for the compositions
    lib/                 the scene kit (lesson.js, lesson.css, glyphs.js, fonts.css.txt)
    fonts/  brand/  vendor/gsap-3.14.2.min.js
    merc-lib/            the film's Merc bundles (blue, orange)
    merc/                rendered Merc performances (<pass>-merc.webm)
    voice/               per-line narration + loudness envelopes
    audio/               full.wav, music-only.wav, stems
  merc/shots/*.json      generated Merc performances
  captions/              SRT and VTT
  tools/                 the pipeline (below)
  lab/<scene>/           lab stills and clips per scene
  review/critic-NN/      one folder per critic round
  renders/               drafts and masters
```

## 2. Steps and commands

Toolchain: Node 22, FFmpeg with `ebur128`, `tblend`, `signalstats`, `scdet`, Python 3 (a venv with
`kokoro-onnx`, `soundfile`, `numpy` for voice and audio), pinned `hyperframes@0.8.97` with
`HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1`. Run the skill's smoke test once per
session.

| #   | Step              | Command                                                                                                                                                               | Output and gate                                                                                       |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Scaffold          | `npx --yes hyperframes@0.8.97 init output/motion/lesson-NN --non-interactive`; copy the kit; fetch OFL fonts from `google/fonts` with their licences                  | Director block appended to the project's CLAUDE.md and AGENTS.md                                      |
| 2   | Brief and facts   | write `BRIEF.md`, `FACTS.md`                                                                                                                                          | Every claim sourced (code beats PRODUCT.md beats CHANGELOG beats BRAND)                               |
| 3   | Script            | write `script.json`                                                                                                                                                   | Script critic: true, teachable, every orange line a deep question or sincere guess                    |
| 4   | Voice and clock   | `python tools/cues.py`                                                                                                                                                | Per-line WAV and loudness envelope; `cues.json`; pacing report (target 140 to 165 wpm while speaking) |
| 5   | Sound             | `python tools/mix.py`                                                                                                                                                 | `full.wav`, `music-only.wav`, stems; examples at exact pitch; bed ducked under examples               |
| 6   | Scenes table      | `python3 tools/gen-root.py`                                                                                                                                           | `assets/scenes.js`, `index.html`, placeholder scenes so the film always renders                       |
| 7   | Storyboard        | write `STORYBOARD.md`, `HANDOFFS.md`                                                                                                                                  | Fresh critic, fix, verification critic (Lesson 1 took two rounds plus a third set of fixes)           |
| 8   | Merc performances | `python3 tools/merc-shots.py` then `node tools/merc-pass.mjs merc/shots/*.json`                                                                                       | One straight-alpha WebM per performance; render in the background while scenes are built              |
| 9   | Scenes            | builders, in parallel, each owning contiguous scenes; static Merc `<video data-merc>` tags timed by `python3 tools/merc-tags.py`; `node tools/lab.mjs <scene> --clip` | Each scene proven by a lab render (not a snapshot); `merc-tags.py --check` and `check` at 0 errors    |
| 10  | Captions          | `python3 tools/captions.py`                                                                                                                                           | SRT and VTT, with sound descriptions in the gaps                                                      |
| 11  | Render            | `npx --yes hyperframes@0.8.97 render --fps 60 --quality delivery --strict`                                                                                            | Measured with `scripts/measure.py render`; fresh critic per round to SHIP                             |
| 12  | Deliver           | master, music-only mux, contact sheet, captions, LEDGER, DELIVERY                                                                                                     | Owner review                                                                                          |

## 3. Decisions a teaching film adds to the skill

- **Pacing.** The kit's 12 to 15 compositions per 30 s is a launch-film number. A teaching film
  runs 4 to 8 layout changes a minute, with a visual event every 2 to 5 s tied to the word that
  names it (within -0.2 to +0.1 s), and nothing longer than about 6 s without one. A diagram may be
  held while it is explained, but something inside it always moves (no still stretch over 0.5 s;
  a dressed "predict" pause of at most 3 s per chapter is allowed).
- **One clock.** Scenes, Merc performances, the mix and the captions key off cue names in
  `cues.json`, never off typed seconds. A re-voiced line re-times the film: run steps 4 to 8 and
  10 again.
- **Narration pacing.** Kokoro speaks fast at speed 1.0 (180 to 236 wpm); speeds 0.84 (blue) and
  0.9 (orange) plus authored gaps give about 164 wpm while speaking and 119 overall. Long lines
  are split into phrase events so the picture can land on a word.
- **Merc.** Pre-render each performance once (`merc-pass.mjs`), from the cue sheet
  (`merc-shots.py`): he sings on his sung cues, talks on his lines (mouth from the line's loudness;
  sound arcs off), listens while the other speaks. Each performance is ONE straight-alpha WebM with
  alpha = max(A, R, G, B) over his premultiplied colour, so his bloom and floor light survive and
  he composites correctly in any moved, scaled or faded layer. (A matte plus a `plus-lighter`
  light pass is exact only when nothing above it creates a stacking context: a camera layer breaks
  it into a black square. And always force `format=rgba` in the ffmpeg graph: left to negotiate,
  ffmpeg once dropped the alpha.) The orange Merc's warm floor light comes from a build-time swap
  of the shader's hard-coded cool constants (`build-merc.mjs`), never an edit of `src/lib/merc`.
- **Frame rate.** 60 fps master; Merc at 30 fps (each frame shown twice: animation on twos).
- **Audio.** Every musical example is synthesised at its exact frequency in `mix.py`; Merc's sung
  notes are the Echo voice set (placeholders) and the app's own "ooh" timbre; the bed is a quiet
  open-fifth pad in the key, ducked to silence half a second around every example; one soft
  whoosh per act change. A music-only render is not needed: the music-only mix muxed onto the same
  picture is identical by construction.
- **Captions.** Upload the SRT; never burn full captions into the long form (redundancy). Keep the
  bottom 17 % of every frame free of essential content.
- **Parallel builders.** A build guide, a shared kit, exact handoff frames between builders, and
  scene files owned by one builder each. Lab renders per scene (`tools/lab.mjs`: a temporary
  project hosting one scene, with the soundtrack offset to it) prove each scene alone.

## 4. Traps found on Lesson 1

1. CSS `url('../fonts/...')` in a stylesheet fails HyperFrames' lint
   (`invalid_parent_traversal_in_asset_path`): inline the `@font-face` rules in the root with
   root-relative paths.
2. A Merc pass that shows as a black square in `snapshot` or `render` lost its alpha in encoding
   (see the `format=rgba` note above), not in the preview: correctly encoded passes composite in
   both, with or without `--no-proxy`. Check a pass before blaming the renderer: `ffprobe` must
   show the tag `alpha_mode=1` (it reports `pix_fmt=yuv420p` even for a good alpha VP9), and a
   frame decoded with `-c:v libvpx-vp9` must have transparent corners.
3. A missing video file does not break `snapshot` or `render`: build scenes before their Merc
   passes exist.
4. HyperFrames finds videos by parsing the HTML before any script runs (the producer's
   `parseVideoElements`), and reads their timing from the static `data-start`, `data-duration` and
   `data-media-start`. A `<video>` created by a script plays in the browser preview and renders as
   nothing. So every Merc pass is a static tag in its scene (`data-merc="<pass>"`), timed from the
   cue sheet by `tools/merc-tags.py`; the kit's `L.merc()` only adopts and places it. A script may
   move a static video into any wrapper: the renderer injects its frames by id.
5. `hyperframes snapshot` does not show videos inside sub-compositions, only root-level ones. Prove
   a scene with Merc in it with a lab render (`node tools/lab.mjs <scene> --clip`).
6. Sub-compositions run on local time; a `<video>` inside one keeps local `data-start`.
7. CSS blending is limited to the nearest stacking context (any transform, opacity below 1, filter
   or isolation): see the Merc note above.
8. The workflow tool runs at most two agents at once on a 4-core machine; long parallel builds use
   separate background agents.
9. Merc on SwiftShader costs about 0.4 s (300 px) to 1.0 s (640 px) per frame at `medium`;
   the CPU is shared with everything else, so start his performances early.
10. A cloud container can restart mid-production and stop every background process (renders,
    builders). Files survive. Keep long jobs resumable: one output file per Merc pass, written only
    when complete, so a restarted queue needs only the passes that are missing or empty.

## 5. The web lesson

Built from the same sources: the written lesson (`lessons/NN/LESSON.md`), the facts, the captions
(VTT track and transcript), the film (an MP4 encoded for the web), the colour code and type, and a
shared toy kit (Phase 1). Lesson 1's page is a single HTML file: sound gate, predict-then-reveal
opener, step deck with live toys (vibration, loud versus high, octave fit, spiral to keyboard),
misconception card, sung checkpoint (hum along with a reference; the live microphone version lives
in the app), quick check, the embedded episode with chapters and captions, and the lesson explorer
with all fourteen lessons as placeholders. Checks before publishing: phone (390 px) and desktop
widths in light and dark, keyboard focus, reduced motion, no sideways scroll, every audio button
user-initiated.
