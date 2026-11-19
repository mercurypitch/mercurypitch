# Tool changes

These tools came from Lesson 4's backup (`l4film/tools/` in the session scratchpad, as its own
`tools/CHANGES.md` left them) on 18 November 2026, into this film's project, with `gen-root.py`
and `script-draft.py` already adapted for Lesson 5 by the script and storyboard rounds (DECISIONS
36, 59 and 68). Five tools were lost with Lesson 4's project and are recreated here from their
contracts. Every change made to them for Lesson 5 is logged here, newest first: the date, the tool,
what changed and why. A change that alters output says which outputs to regenerate. Lesson 4's
history stays in Lesson 4's own `tools/CHANGES.md`.

Environment variables, the same names as Lessons 1 to 4: `MERCURYPITCH_REPO`, `TTS_PYTHON`,
`KOKORO_MODEL`, `KOKORO_VOICES`, `ESBUILD_MODULE`, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `MIX`;
`lab.mjs` passes `HF_VIDEO_EXTRACTION_FAILURE_MODE` and `HF_VIDEO_COVERAGE_THRESHOLD` through
(PRODUCTION-PIPELINE trap 3). Defaults moved to what this container has: `merc-pass.mjs` looks for
Playwright in `/opt/node-tools` and Chromium at `/opt/pw-browsers/chromium` first;
`build-merc.mjs` builds from the read-only main checkout (`.claude/worktrees/fix`) and its pinned
esbuild lives in `.node/`. `mix.py` and `merc-pass.mjs` keep `/home/user/mercurypitch` for the
rest (mix.py reads only Echo samples there, which this film does not use).

Every heavy run (a render, a Chromium pass, the Merc bundle, the Kokoro run) goes through the
scratchpad's heavy helper on this shared machine, one at a time.

## 2026-11-19 (Lesson 5, group E's fix round E-01: the kit's Voice Mirror card, DECISIONS 216)

- **assets/lib/recap.js, `L.RECAP.VM`: the card closes up 13 px under its rows, and the ten line
  is one line.** Checked first that s13-recap is `L.RECAP`'s only user (a grep of `compositions/`,
  `assets/lib/` and `tools/` finds it only there and in recap.js itself).
  - The readout's baselines move from 525, 565 and 605 to 523, 560 and 597 (37 px apart, not 40).
  - "Keep..." moves from 665 to 654, "Sore..." from 710 to 699, and "Free..." from 765 to 752.
  - The free line's underline moves from 777 to 764.
  - The panel's feet change from [300, 360, 420, 480, 625, 685, 730, 790] to
    [300, 360, 420, 480, 617, 674, 719, 777]. Each foot keeps its offset under its line.
  - The rows, the glyphs and the title do not move. The carried bead still starts at the "five
    notes" glyph's first dot (272, 434 after the drift), so `L.TEASE.carry` is unchanged.
  - `VM.ten` is now one line: `{ text, x 270, y 820, size 30, family 'inter', weight 400 }`. It was
    two lines at 822 and 862 with `tenX` and `tenSize`. The ink runs from about 797 to 827 and ends
    near x 1100, left of the card's edge at 1110. The panel's last foot (777) stands 20 px over its
    cap top.
  - The old file is kept as `lab/s13-recap/fix-E-01/recap.before-E01.js.txt`.
  - Regenerate s13-recap's stills and clip. No other scene reads `L.RECAP`.

## 2026-11-19 (Lesson 5, the passes for DECISIONS 190: the hops back at the clean break)

- **script.json: `break`.** `{"id": "break", "type": "pause", "dur": 1.9, "gap": 0.0}` between b54
  and b55 (b55 keeps its 0.3 s gap); nothing else changed (checked: the parsed script is the old
  one plus that event).
- **The clock, rebuilt aside** (`cues.py --no-tts` in `lab/clock190/`, through the heavy helper)
  and moved into place by rename, the old files kept as `*.pre190`: `cues.json`, `assets/cues.js`,
  `assets/audio/voice.wav`, `PACING.md`. Checked first: the 97 cues before b55 identical to the
  millisecond (start, end, every word), the 10 from b55 on exactly 1.9 s later, `break` new
  (489.71 to 491.61); the voice track identical before b55 and every later line sample-identical
  45,600 samples (1.9 s) later. The film: 9:09.5 (549.465 s).
- **gen-root.py and chapters.py, run aside and renamed in** (`MIX=voice`): `assets/scenes.js`
  (s13's end, s14's and s15's starts), `index.html` (those three hosts and the total) and the s13
  placeholder's duration; no built scene file touched (s01 to s12 compared). `captions/chapters.json`
  was stale since step 2, where `chapters.py` ran before `gen-root.py` and read the 8:55 scene
  table; it is now right (every chapter moved, "Practise it" 491.91). Old files kept as `*.pre190`.
- **board-clock.py: events on both clocks only.** It walked script.json's events and looked each
  up in the frozen board clock, which has no `break`: `ORDER` now holds the events both clocks
  have; a board time in the gap `break` fills maps by its offset from the event before, as any gap.
- **merc-shots.py: the hops in `break`.** Hop 1 at `break`'s start + 0.60, hop 2 the board's 0.65 s
  later (+ 1.25), the state ending at + 1.91 (DECISIONS 190); the assertion that no line or sound
  touches the pair holds. `keep_before_beat`: the first bias key after the beat is also written at
  its time before the beat, so every frame before it keeps the bias it was rendered with (without
  it, the long eased span between two glance blocks shifted by up to 5e-8 of lookX).
- **Re-rendered only m-orange's and m-blue's s13, s14 and s15 chunks** (`lab/clock190/render-190.py`,
  the queue's own arguments, one at a time through the heavy helper; the queue was not run, since it
  would redo every chunk). Every chunk from s03 to s12 and both m01 passes proved unchanged on every
  frame (`review/merc/shots-190.txt`), and their WebMs and sidecars touched so a later queue run
  counts them done. The old shot files are kept as `merc/shots/*.pre190`.
- **merc-sheet.py --hops** writes `review/merc/hops-190.png`, the hops frame by frame as a scene
  places them; merc-passes.py's text now puts the hops in `break`.

## 2026-11-18 (Lesson 5, production step 2: the lead's answers)

- **merc-shots.py: the hops in a silence, `listen` capped, the listening gaze held, no hop stop
  marks.** Merc's hop pair is centred in the `card` pause (the first silence after b55 that holds
  it; 0.65 s apart, the board's), from cues: hop 1 523.290, hop 2 523.940 (DECISIONS 160); the
  script asserts that no line or sound touches it. `listen` holds for the first 3 s of each of the
  other host's lines (`LISTEN_CAP`), then `idle` to the line's end (DECISIONS 161). In those
  listening idles the shot's bias now carries frame keys (`glance_bias`) that cancel `idle`'s glance
  away by the eye springs' own response to it, so the eyes stay on the speaker. m-blue's shot sets
  `light: {stops: [0, 0, 0]}` (DECISIONS 162). Regenerated: every shot, so every chunk re-renders.
- **merc-pass.mjs: `light`.** A shot's `light` patches slots of the light set over the variant's
  own (`LIGHT` or `WARM_LIGHT`) through the renderer's `setLook`; the bundle is unchanged.
- **merc-passes.py and merc-sheet.py:** the hops' new place and the listening rule in PASSES.md;
  the sheet's new rows (the hops in the `card` pause, a long listen).
- **Re-rendered** (`merc/render.log`, after its "step 2 follow-up" line): all 27 jobs, 31,922 frames
  at 30 fps in 2.16 hours, 244 ms a frame on average with another heavy job sharing the machine:
  m-orange's 13 chunks in 46.7 min (188 ms), m-blue's 12 in 64.6 min (264 ms), m01-blue and
  m01-orange in 9.5 and 8.8 min (494 and 460 ms). No failures, no crescent re-renders. The two
  chunks the answers cannot touch (m-orange-s03 and m-blue-s04, before any change) came out
  byte-identical to step 2's at all their dumped frames. The join proof: 23 of 23 boundaries join
  (`review/merc/joins.md`). `assets/merc/roots.js`, `merc/PASSES.md` and
  `review/merc/contact-sheet.png` regenerated; m-blue-s13's root x now moves from 523.433 to
  525.233 only.
- **DECISIONS renumbered** (the coordinator): this section's decisions are 160 to 163, after the
  kit step's 132 to 159; the citations in `merc-shots.py`, `merc-pass.mjs`, `merc-passes.py` and
  above follow.

## 2026-11-18 (Lesson 5, production step 2)

- **scratch-voices.json: new; tts.py and cues.py read it.** The scratch Kokoro voice of each host
  (Merc `am_michael` at 0.84, Tavi `af_heart` at **0.78**, the lead's answer 1, DECISIONS 126), in
  place of script.json's `voices`, which stays the board's and is not changed. `tts.py`'s
  `voice_of` and `cues.py`'s pacing header read it. Tavi's 15 lines were spoken again
  (`review/scratch-clock/cues-run-tavi078.log`); Merc's takes stayed. Regenerated: `cues.json`,
  `assets/cues.js`, `assets/audio/voice.wav`, PACING.md, SCRIPT.md, `captions/chapters.json`,
  `assets/scenes.js` and `index.html` (`MIX=voice`). The clock: 9:07.6 (547.565 s).
- **board-clock.py: reads the frozen board clock.** `tools/board-cues.json` (cues.json's schema,
  107 events, 562.009 s), written once by `--freeze` from the script.json the board was timed on,
  which refuses to overwrite it (DECISIONS 127). The word-rate estimate (`estimate()`) is used only
  by `--freeze`. The acts' shifts: `review/scratch-clock/board-drift.md`.
- **merc-pass.mjs: chunks and ranges, a no-draw pre-roll, the root, dumps, a sidecar and the pin.**
  `--chunk=<id>` renders one of the shot's `chunks` (its frames, at its size) as
  `<chunk id>-merc.webm`; `--from` and `--to` any range. A range that does not start at frame 0
  first replays every state change before it with the WebGL draw calls switched off
  (`window.__mercNoDraw`, set by wrapping the context's draw, clear, blit and finish calls before
  the bundle loads; the bundle is unchanged), then draws as a straight run would (DECISIONS 129).
  The root uniform (`uRoot`) is read back on every draw. Each output gets a sidecar,
  `<out>-merc.json`: frames, fps, size, drawn square, time a frame, pre-roll time, crescent fixes,
  the pin and `root`, one [x, y] a frame. `--dump=<frames>` writes those frames' straight-alpha RGBA
  (upright, raw and PNG) to `lab/merc/dump/`; `--no-video` encodes nothing. The pin (DECISIONS 128):
  the bundle's sha256 against `BUILD.json`, its commit `b5ddaf2d7`, Playwright 1.63.0 and Chromium
  build 1243, or the pass refuses (`MERC_UNPINNED=1` for a lab). `--stills` pre-rolls too.
- **merc-shots.py: rewritten for Lesson 5** (Lesson 4's stays in its backup, `l4film/tools/`). Three performances: the m01 pair (S1, at 420), m-orange and m-blue from
  their leaps to past the end, cut into one chunk a scene (`chunks`: from one frame before the
  scene to two after it; 300, S15 400). Scoring as the board: talk on the host's lines, `sing` on
  the host's sounds (`gauge`, `demo` on the page's demo line to the cent, `listen`, `twinkle`),
  `listen` with no arcs while the other host talks, `idle` through every sound with no singer and
  through `breathe`, `tick-in`, `hold` and `tick-out`. Fixed-length states (the leaps, Merc's two
  hops, Tavi's end-card hop) win over the rest and are never merged; a short gap after one joins
  the run after it. Storyboard times map through `board-clock.py` (`board()`). Both hosts face
  right; shots carry `mirror` (Tavi's true; DECISIONS 130). 30 fps (the brief). No drops, so no
  intros (`merc/intros.json` is not written).
- **merc-tags.py: chunked passes.** For a shot with `chunks`, a scene's tag gets the chunk made for
  that scene (or any chunk holding all its frames) as `src`, and its media start counted from the
  chunk's first frame; a scene no chunk covers is reported as a problem.
- **merc-queue.py: new.** Every chunk and unchunked pass through the heavy helper, one at a time,
  longest pass first and its longest chunks first, skipping what is newer than its shot and the
  bundle; each chunk dumps its three shared frames at either end. Logs to `merc/render.log`.
  Started detached (`setsid nohup`, trap 11).
- **merc-joins.py: new.** The join proof: at every boundary the three frames two chunks share,
  compared as rendered (byte for byte), by root, and as decoded from the WebMs
  (`review/merc/joins.md`).
- **merc-roots.py: new** (the kit step's request). Writes `assets/merc/roots.js`,
  `window.MERC_ROOTS`: every rendered chunk's renderer root from its sidecar, keyed by the chunk's
  id, as `{ frames: [[x, y], ...], t0, fps }` (`t0` the film time of frames[0], to 9 decimals), the
  shape `L.mercGate({ root })` in `assets/lib/hosts.js` reads. Only m-blue-s13 (the two hops) has an
  x that moves; every other chunk's x is 0 on every frame, which is right (only `hop` sets the root's
  x in the renderer). Re-run after every render; the lead adds the script to `scripts.txt`.
- **Rendered** (`merc/render.log`): all 27 jobs, 31,922 frames at 30 fps (the chunks' shared
  frames included) in 2.06 hours of rendering, 232 ms a frame on average, through the heavy helper
  one at a time while another heavy job shared the machine: m-orange's 13 chunks in 60.9 min (245
  ms a frame), m-blue's 12 in 48.5 min (198 ms), m01-blue and m01-orange at 420 in 7.1 and 7.0 min
  (368 and 365 ms). Pre-rolls took 0.1 to 0.8 s. No crescent re-renders. 53 MB of WebM. The join
  proof: 23 of 23 boundaries join (`review/merc/joins.md`). The contact sheet:
  `review/merc/contact-sheet.png` (`tools/merc-sheet.py`, new: the moments decoded from the WebMs,
  Tavi mirrored, and the hosts stood on y 840 by PASSES.md's rules, with 1:1 crops of the feet).
- **merc-passes.py: new.** Writes `merc/PASSES.md` for the scene builders from the shots, the
  sidecars and the dumps (the feet are measured, not quoted).

## 2026-11-18 (Lesson 5, production step 1)

- **merc-pass.mjs: proved on this machine.** A two-second shot of its own (`lab/merc/test/lab-test-blue.json`: Merc idle,
  `sing` from 0.85 s, an A3 from 1.0 s with full arcs from 0.92, size 300, `front`, 60 fps), kept
  out of `merc/shots/` so `merc-whole.py` and `merc-tags.py` never count it: 120 frames at 225 x
  225, 272 ms a frame (PRODUCTION-PIPELINE § 3 gives 0.26 s alone at this size), no crescent
  re-render. The WebM carries `alpha_mode=1`; decoded with libvpx-vp9 every frame's corners are
  alpha 0 and the body opaque. Composited over the room's obsidian, 0.5 s is idle with no arcs and
  1.5 s sings with the "ooh" mouth and arcs either side (`lab/merc/lab-test-blue-0.5-1.5.png`). The
  same shot as Tavi (`--stills`, no video) draws her warm gradient, amber floor and warm arcs
  through `WARM` (`lab/merc/lab-test-orange-0.5-1.5.png`). The test WebM sits in `lab/merc/`, not
  `assets/merc/`.
- **build-merc.mjs: recreated** from what `merc-pass.mjs` expects of it (its header): one IIFE per
  look, `assets/merc-lib/merc-blue.js` and `merc-orange.js`, setting `window.MercLib` (`mount`,
  `VIEWS`, `WARM` and the rest of the constants) from the checkout's `src/lib/merc/renderer.ts`,
  `constants.ts` and `src/features/lessons/kit/merc-warm.ts`, read and never changed. The two
  build-time switches `merc-pass.mjs` sets, `__mercSparkles` (Lesson 1 DECISIONS 23) and
  `__mercArcs` (the arcs at a shot's strength: 0.5 while he talks, 1 on a sung note), are edits of
  the bundle's copy of `sim.ts`, each required to match exactly once. **One job is now done another
  way:** Tavi's warm floor light was a build-time swap of the shader's hard-coded cool constants;
  the app now carries the light Merc casts as a uniform set (`LIGHT`), and `merc-warm.ts`'s
  `WARM_LOOK` swaps the whole set through `setLook` (its test holds her to the old swaps' amber), so
  no shader text is swapped and the two bundles hold the same code. The checkout's
  `tsconfig.json` is named (trap 16). `assets/merc-lib/BUILD.json` records the commits, the esbuild
  version and each bundle's sha256. Built from `b5ddaf2d7` (src/lib/merc last changed in `124c04f52`,
  merc-warm.ts in `dc8a17e80`) with esbuild 0.25.12 (the repository's lockfile pins it for vite; a
  pinned copy is in `.node/`), 110 KB each. The checkout is the working directory, so the bundle's
  path comments are its own: two builds from different directories were byte-identical.
- **lab.mjs: recreated** from Lessons 1 and 2's BUILD-GUIDEs (Proving a scene) and Lesson 2's
  entries below in Lesson 4's log (kit labs, the shared script list): a temporary project in
  `lab/<scene>/proj/` hosting the scene from its time 0, `assets/` linked, the kit loaded from
  `assets/lib/scripts.txt` as the root loads it, the soundtrack offset to the scene's start
  (`MIX`, default full; none when that mix does not exist yet). Stills by `hyperframes snapshot`
  (`--describe false`, so no frame leaves the machine); a clip is the skill's 3 to 4 s by default
  (`--clip`, 4 s from `--from`), the whole scene with `--full`, and `--stills` takes frames from
  the clip, which show Merc where a snapshot cannot (trap 5). A window that does not start at 0 is
  rendered from the scene's start and cut, so every frame is the film's own. `kit:<name>` hosts
  `lab/kit-src/<name>.html` as before. Tested on placeholders with `MIX=voice`: stills of `s03-promise` at 1.0
  and 5.0 s; a 3.5 s clip from 4.0 s (105 frames at 30 fps, rendered from 0 in 9.6 s and cut), its
  sound matching `voice.wav` at the scene's film time to the sample (envelope correlation 1.00, lag
  0); `s02-title`'s default clip, its 3.60 s. The first version hosted the whole scene in a shorter
  root, which lints `clip_ends_past_root_duration`; the host now ends with the window and lints
  clean. Proofs in `review/toolchain/lab-test/`.
- **gen-root.py: run** (kept as the storyboard rounds left it). It needs the kit's root files, so
  this step wrote the seed of `assets/lib/`: `scripts.txt` (GSAP, the cues, the scenes,
  `lesson.js`), `fonts.css.txt` (the five OFL fonts, root-relative, trap 1), `lesson.css` (the
  palette and the placeholder's classes) and `lesson.js`, the clock part of Lessons 1 to 4's kit
  only (`L.scene`, `L.dur`, `L.at`, `L.word`, `L.clock`, with the same calls; a missing cue or word
  throws). The rest of that kit was not in the backup; it is the kit step's. Run with `MIX=voice`,
  the root plays the scratch voice. Fifteen placeholders written; `check` 0 errors, 0 warnings
  (one info: a long placeholder title overflows at t 29.75). The placeholder film rendered end to end through the heavy helper:
  `renders/placeholders-draft.mp4`, 8:55.4, 16,063 frames at 1920 x 1080, 30 fps draft, `--strict`,
  with the scratch voice (-21.0 LUFS), in 6 min 29 s on two workers.
- **clock-lint.py: recreated** from Lesson 2's entry (17 October) and Lesson 4's BUILD-GUIDE (The
  clock): a typed time as a kit call's time argument (`TIME_ARGS`, the kit step extends it), a
  camera move's start, a list of times, an `L.track` move's start, a GSAP position or a time key in
  an object; a comparison of `t` with a number; a number of 1 or more with two decimals equal to a
  cue or word edge of the scene (under a second a number is a length far more often: a scene cut
  0.15 s before a mark holds that mark at 0.15); an offset of 0.4 s or more into a spoken line
  (`at(line, 'start', x)`, `at(line) + x`). `// clock-lint: ok` accepts a line; placeholders are
  skipped; exit 1 on any finding, nothing printed when clean. Tested on Lesson 4's sixteen finished
  scenes (on its scratch clock): silent, as they were in Lesson 4. On a synthetic scene with ten
  typed times and three anchored ones: all ten found, the anchored and accepted lines passed.
- **board-clock.py: the board clock is the word-rate estimate, rebuilt.** STORYBOARD.md and
  HANDOFFS.md (v2) are timed on 9:22.0 (562.01 s), script draft 3's estimate at Merc 2.32 and Tavi
  3.08 words a second, not on a voice; so, as Lesson 2's did, the tool rebuilds that clock from
  `script.json` (the rates read from `script-draft.py`, a word at its place in the line at the
  line's rate) and maps it onto `cues.json`. Tested: it reproduces the storyboard's scene table to
  the tenth (0:38.3 to 9:16.0) and its word times (398.35, 399.22, 401.37, 406.66, 408.39, 410.97).
  The scene table and the marks a cut leads are read from `gen-root.py`; the act names are this
  film's (five chapters, Sing it, the recap, next time, the end). No `board-cues.json` is frozen:
  the board is not re-timed. If `script.json`'s words or gaps change before it is, the rebuilt
  board clock moves with them, so freeze it then (Lesson 4's way).
- **cues.py: recreated** from the contract in Lessons 2 and 4's logs and PRODUCTION-PIPELINE § 2
  and § 3, with `tools/board-cues.json` (a frozen `cues.json`) for the exact schema: `{ total,
  cues: { id: { start, end, dur, type, who, text, words: [[word, start, end]], sound } } }`, every
  gap the silence before its event (the script's 0.3 s when an event has none), a line as long as
  its take, `total` the last event's end plus 0.2 s (Lesson 4's 6.0 s sting in its 6.2 s scene).
  The Kokoro takes live in `assets/voice-kokoro/` and are copied into `assets/voice/` (which
  `mix.py` and `merc-shots.py` read) unless the line is listed in `assets/voice/_elevenlabs.json`:
  an imported take is never re-spoken or replaced, and its words, without a word file, are
  estimated by letters and listed. Also writes `assets/cues.js`, `assets/audio/voice.wav` (the
  voice alone, a scratch soundtrack until `mix.py` has this film's sounds) and `PACING.md`, the
  pacing report against PRODUCTION-PIPELINE § 3's 140 to 165 words a minute while speaking. Tested:
  a run with `--no-tts` and a plain run on unchanged takes give byte-identical `cues.json`,
  `assets/cues.js` and `voice.wav`; on a copy, a line listed as imported kept its WAV byte for byte,
  re-timed the film (+0.5 s) and had its words estimated.
- **tts.py: recreated** from Lesson 2's entry (17 October, "the time of every word, from the
  model"): Kokoro per line (Merc `am_michael` at 0.84, Tavi `af_heart` at 0.9, from `script.json`),
  its phoneme durations from the graph's `/encoder/Gather_output_0` exposed as a second output,
  `duration`, in memory (a second ModelProto.graph field appended to the bytes, which protobuf
  merges; the model file is unchanged and no package is added), kokoro-onnx 0.6.1's own timing
  for each phoneme, the script's words aligned on phoneme counts (merges and splits of up to three),
  and the onsets calibrated on the envelope (a silence is claimed by the first word after it and
  the last word before it; the other words move back by the median correction, `lag`). Each take
  is trimmed to 0.02 s before its first word and after its last and set to -22.8 LUFS (the level
  Lesson 4's import set its takes to, so a later import sits alike). Writes `<id>.wav` (24 kHz mono,
  16-bit), `<id>.env.json` (`{ rate: 100, level }`, what `merc-pass.mjs` reads) and
  `<id>.words.json` (`{ source, lag, words: [{ w, t, e }] }`) in `assets/voice-kokoro/`, and
  `_lines.json`. Every run checks its first line against the plain model, sample for sample, and
  falls back to it without word times on any difference. Results on this film: all 71 lines timed,
  the first line identical to the plain model; 11 lines with a merged or split word ("than a",
  "no one", "on the" ...); lag 33 to 145 ms, median 68 ms (Lesson 4 measured 54 to 184, median
  82); b4 is 0.7 dB under -22.8 LUFS, held at the 0.97 peak. A first full run left the last word of
  b33 0.07 s past its take's end; every word is now held inside the take's sound, and b33 was
  spoken again (no other line had a word outside its take).
- **mix.py, merc-shots.py, captions.py: copied; their sounds and passes wait for their steps.**
  Their tables (`sound_for`, `NO_BED` and the bed on D; `PASSES`, `NOTES` and the leads;
  `WORDS`, `SOUNDS` and `SUNG`) are still Lesson 4's, as the brief for this step asks. Each now
  says so in its header and stops with a message on this film's cues instead of failing on a
  missing key or writing Lesson 4's output: `mix.py` names the sounds it cannot make,
  `merc-shots.py` stops before it writes, `captions.py` names the cues it cannot caption (`heard`,
  `breathe`, `hook` and `card` carry none, STORYBOARD § Sounds and captions). `captions.py` writes
  `captions/lesson-05.en.srt` and `.vtt`. No output yet.
- **chapters.py: Lesson 5's thirteen chapters** (STORYBOARD § Scene table), one of them on a cue:
  "Practise it" starts on `b55`, the recap's clean break inside `s13-recap` (`cue:b55`). Writes
  `captions/chapters.json` (done: 0:00 to 8:34 on the scratch clock).
- **script-md.py: Lesson 5's title** and spellings ("A three", "mercurypitch dot com slash
  mirror"; A3 and mercurypitch.com/mirror on screen), and the docs folder it will move to. Writes
  `SCRIPT.md` (done).
- **merc-pass.mjs: this container's Playwright and Chromium by default**
  (`/opt/node-tools/node_modules/playwright`, 1.63.0, and `/opt/pw-browsers/chromium`, build 1243;
  Lesson 4's passes ran on Chromium 1194 under Playwright 1.56.1). The header now says what it
  reads and writes. Output otherwise unchanged.
- **merc-tags.py, merc-whole.py: copied unchanged** (they read the scene table and the shot files;
  nothing in them is Lesson 4's but their examples). Both run on this film: no tags yet, and
  `whole.js` is written once the passes exist.
- **Not recreated.** `text-sweep.mjs` and `.py` (the settled-label contrast sweep every 0.25 s):
  `check`'s contrast audit covers its sample times today; the kit step decides whether the sweep
  comes back. `merc-combine.py` (Lessons 1 and 2's, contract unknown; its likely job, joining a
  pass's matte and light, ended with the one straight-alpha WebM a pass, Lesson 1 DECISIONS 4).
  `web-video.sh` (the web copies: 1080p and 720p at 30 fps, H.264 and AAC with the moov first, the
  poster 1.6 s into `s02-title` from the scene table, the share image, captions and chapters;
  Lesson 2 WEB-SPEC): the delivery step's.

## 18 November: the kit step (Lesson 5's kit)

- **clock-lint.py: the kit's new timing calls.** `TIME_ARGS` gains `L.fade` (its tIn and tOut),
  `L.glow` (its list of times), `L.run` (its start), and the two cut curves `L.TEASE.carry` and
  `L.TEASE.shrink` (their start). A kit object drawn from scene time is checked too: in
  `x.draw(t, <time>, ...)` the second argument is a time (a ring timer's start; a kicker's in and
  out), and in `x.life(t, tIn, tOut, fade, [pulses])` the in, the out and each pulse. A draw whose
  first argument is not `t` (`bracket.draw(progress, alpha)`) is left alone. Tested on a sample: each
  typed time is reported, `bracket.draw(0.5, 1)` is not. The placeholder scenes stay clean.
- **text-sweep.mjs: not rebuilt.** `check`'s contrast audit measured every settled label in the kit
  labs at the times given (`--at`, up to five a run), the gauge's labels over the hatches and the
  chart's by the amber and violet fills among them, all passing (lab/kit-*/check.json); the sweep
  every 0.25 s stays the scene rounds' to ask for.
- **Kit labs: `lab/kit-src/probe.mjs` (new, in the lab, not a tool).** It loads each lab page with
  the kit and the real fonts in this container's Chromium, seeks it and checks every module against
  its HANDOFFS pixels (lab/kit-probe/RESULTS.md) and writes `lab/kit-type/WIDTHS.md`;
  `lab/kit-src/stills.sh` renders every lab's stills through `tools/lab.mjs`. Both run inside the
  heavy helper. `tools/lab.mjs` is unchanged; its bundler prints "Skipping sub-composition ... the
  file is empty" for a kit page (it does not follow the page's symlink), and the runtime loads the
  page anyway: every still shows it.

## 18 November: the kit's fix round (critic-kit-01)

- **lab.mjs: a kit page is copied, not linked** (the lead's answer 7). `lab/<id>/proj/compositions/
  kit-<name>.html` is now a copy of the page's real file (`copyFileSync(realpathSync(src), ...)`)
  in place of the symlink, because the bundler does not follow a link and reported the page as
  empty ("Skipping sub-composition ... the file is empty"). Tested on `kit:hook` (a 60 fps clip) and
  every kit page's stills: the message is gone, and the stills and clips are as before. The old file
  is kept as `lab/kit-src/lab.before-kit01.mjs.txt`. Nothing else in the tool changed.
