# Tool changes

These tools came from Lesson 1's tools (`output/motion/lesson-01/tools/`, as its own
`tools/CHANGES.md` left them) on 17 October 2026. Every change made to them for Lesson 2 is
logged here, newest first: the date, the tool, what changed and why. A change that alters
output says which outputs to regenerate. Lesson 1's history stays in Lesson 1's own
`tools/CHANGES.md`.

Kept as they were: every environment-variable default (`MERCURYPITCH_REPO`, `TTS_PYTHON`,
`KOKORO_MODEL`, `KOKORO_VOICES`, `ESBUILD_MODULE`, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `MIX`)
and the named tsconfig in `build-merc.mjs`. Unchanged: `build-merc.mjs`, `merc-combine.py`,
`text-sweep.py`.

## 2026-10-29 (Lesson 4)

These tools, and this log, were copied from Lesson 2's folder into Lesson 4's on 28 October 2026
(23:57 UTC). The edits made since for this film (the scene table in `gen-root.py`, the sounds and
pauses in `mix.py`, `captions.py`'s sound captions, the script tools' titles) went in without
entries here; from this one on, every change is logged.

- **board-clock.py: the storyboard's clock is the scratch cue sheet.** Lesson 4's storyboard and
  handoffs (v3.1) are timed to the Kokoro scratch clock, not to an estimate at 2.6 words a second,
  so the estimate is gone: the storyboard's clock is now `tools/board-cues.json`, a frozen copy of
  `cues.json` of 29 October (483.729 s, envelopes left out; never regenerate it). Until a re-voice
  the two clocks are the same and the tool only names a time's anchor (`board-clock.py 84.94`
  prints `word('b9', 14)`); after one it maps as before. The act names are this film's. Tested:
  every act's shift reads +0.00 s; 75.24, 84.94 and 245.85 name `at('scale-c')`, `word('b9', 14)`
  and `at('b28')`. No output changes.
- **merc-shots.py: Lesson 4's passes.** PASSES is this film's thirteen (m01 to m12, STORYBOARD § Merc
  performances), every entrance and exit keyed to the line or sound it serves. Lesson 2's slide
  contour and its S17 tune are gone. Sung runs are `sound` events with no singer, so a pass names
  the ones its Merc sings (`sings`: cue to state, `sing` or `ride`); each note is a voice entry at
  its MIDI pitch from a NOTES table (FACTS 68), 0.04 s short of the next so the mouth articulates,
  and the arcs follow each run of notes (sing-a's 0.6 s rest drops them). `quiet` holds a pass idle
  through a pause at the top priority (`your-turn`). Regenerate: `merc/shots/*.json` (done: 13
  files, 30,487 frames at 60 fps); then the passes and `merc-tags.py`.
- **chapters.py: Lesson 4's chapters** (STORYBOARD § Scene table, twelve, each at least 10 s; the
  shortest is Next time, 13.5 s). Regenerate: `captions/chapters.json` (done).
- **merc-whole.py: new.** Each rendered pass's first whole frame (PRODUCTION-PIPELINE trap 23),
  for the kit's `L.mercGate`: for a pass whose first state is `drop`, the first frame, after the body
  has touched the square's top three rows, with those rows empty again in alpha; 0 for a pass that
  starts whole. It writes `assets/merc/whole.js` (`window.MERC_WHOLE`), now in
  `assets/lib/scripts.txt` with `assets/lib/hosts.js`; `--check` reports a stale table. Builder A's
  `lab/s04-recall/scratch/whole.py` is the same test, and both give m06a-orange 30. Regenerate:
  `assets/merc/whole.js` after every pass lands, then `gen-root.py` once for the two new script tags
  (done).

## 2026-10-17

- **clock-lint.py: new.** The owner has chosen ElevenLabs voices, so the clock moves twice more
  (Orange's takes now, Blue's later), and a scene with a typed second goes wrong on each move. The
  tool reads a scene's scripts and reports every time written as a bare number (0 is the cut and
  is allowed). It looks at the time argument of the kit's timing calls, a camera move's start, a
  `L.track` move, a time key in an object, a GSAP position and a comparison with `t`. It also
  reports any number with two decimals that equals a cue or word edge of the scene, and
  `at(line, 'start', x)` deep inside a spoken line. `// clock-lint: ok` accepts a line;
  placeholders are skipped; exit 1 on any finding. Tested on a synthetic scene (11 typed times
  found, the anchored and accepted lines passed) and on Lesson 1's title and end scenes (16 typed
  times, all bare seconds after the cut). It writes nothing.
- **cues.py: imported takes are never re-spoken.** The director's ElevenLabs import
  (`output/motion/voice-elevenlabs/import.py`) writes a take's WAV, envelope and word file into
  `assets/voice/` and lists the line in `assets/voice/_elevenlabs.json`; the film is then
  re-timed with `--no-tts`. A run without the flag re-speaks every line whose text or voice
  changed, which would have overwritten a take, so it now keeps any line listed there (and says
  so), keeps that line's old entry in `_lines.json` (undoing an import re-speaks it), and stops
  with a message on a line whose voice in `script.json` names no Kokoro voice. A voice entry may
  now leave out `voice` and `speed` (they matter only to Kokoro). Tested on a copy: `--no-tts` and
  a plain run on unchanged files give byte-identical `cues.json` and `assets/cues.js`; with every
  Orange line listed, nothing is sent to Kokoro. No output changes.
- **merc-tags.py: scene ids as arguments.** `python3 tools/merc-tags.py s14-sing [--check]` updates
  or checks only the named scenes, so a scene builder never rewrites another builder's file; with
  no scene id it works on every scene as before. No output changes.
- **gen-root.py: placeholders hold no typed second.** A placeholder's drift tween took its length
  as a number written into the file, which went stale on a re-time; it now reads `L.dur(id)` at
  run time, and a file that is still a placeholder (it carries `PLACEHOLDER · <id>`) is rewritten
  on every run, so all 17 took the change. Regenerate: the placeholders (done).
- **tts.py: the time of every word, from the model** (Lesson 2's storyboard ties most events to
  a word, and the scratch voice for Blue is about to change, so word times must come from the
  voice, never be typed).
  - Kokoro predicts a duration for every phoneme before it makes the sound, but the v1.0 graph
    keeps that tensor (`/encoder/Gather_output_0`) internal. The tool now adds it as a second
    output named `duration`, in memory, by a raw protobuf edit (an Identity node and a graph
    output appended to the ModelProto's graph); the model file is never changed and no new
    package is needed. kokoro-onnx 0.6.1 then turns the durations into phoneme times.
  - The audio is the plain model's, sample for sample: the timed session runs kokoro-onnx's
    `_prepare` and `_create_batches` without `insert_pauses`, which the plain model never
    applies. Checked on all 67 lines of Lesson 2 (identical arrays); every run re-checks its
    first line and falls back to the plain model, with no word times, on any mismatch.
  - espeak runs some short words together ("on the", "at A", "with the") and splits
    "MercuryPitch"; the script's words are matched to the spoken ones by a small alignment on
    phoneme counts (merges and splits of up to three words), and a merged word's span is shared
    by each word's own phoneme count. All 67 lines align.
  - The model marks each word about a phoneme late: its onset lands near the first vowel, 54 to
    184 ms (median 82 ms over the 67 lines) after the sound begins, measured on the envelope.
    Words that follow a silence take their true onset from the envelope; the line's other words
    move back by the median of those corrections (the `lag` in each file).
  - Writes `assets/voice/<id>.words.json` beside the WAV and envelope:
    `{ source, lag, words: [{ w, t, e }] }` in seconds from the WAV's start.
  - Regenerate: run `cues.py` (it re-speaks only lines whose text or voice changed; delete
    `assets/voice/_lines.json` to re-speak every line and so write every word file).
- **cues.py: word times on every line cue.** Each `line` cue in `cues.json` and `assets/cues.js`
  now carries `words: [[word, start, end], ...]` in film time, from the word files; a line with
  no word file (a voice from another engine) gets words estimated by letters, and the run lists
  those lines. Scenes key events to words with `L.word(scene, line, 'phrase')`
  (`assets/lib/lesson.js`). No other output changes.
- **board-clock.py: new.** The storyboard, HANDOFFS and SCRIPT.md are timed to an estimated cue
  sheet (lines at 2.6 words a second). The tool rebuilds that clock from `script.json` (it
  reproduces the storyboard's scene table to the hundredth) and maps any storyboard time onto
  the voiced clock, naming the anchor and the `at()` or `word()` call to write; with no
  argument it prints the drift by act and by scene; `--scene <id>` lists every cue and word of
  a scene on both clocks. It writes nothing.
- **gen-root.py: Lesson 2's scene table and the kit's script list.** `SCENES` is the storyboard's
  table (17 scenes; the cuts on `act1` to `act4`, `recap` and `next` stay 0.15 s early, s14
  cuts on `b41`). The root's `<script>` tags now come from `assets/lib/scripts.txt`, one per
  line, the list `lab.mjs` and `text-sweep.mjs` read too, so the film, a lab and the sweep load
  the same kit. The placeholder scene marks its oversized ground and staves
  `data-layout-allow-overflow` (check warned on them, 2 warnings across 9 samples). Regenerate:
  `index.html`, `assets/scenes.js` (and the placeholders of scenes with no file yet).
- **gen-root.py: each scene's own `data-duration` follows the table.** A scene file's root
  `data-duration` must equal its span in `assets/scenes.js` (Lesson 1's build guide had
  builders type it), and every re-voice changes the spans; gen-root now rewrites that one
  attribute in each existing scene file when it differs, and prints which it changed. A
  re-voice then needs no hand edit to any scene.
- **lab.mjs: kit labs, and the shared script list.** `node tools/lab.mjs kit:<name> <times>` (or
  `--clip`) hosts `lab/kit-src/<name>.html`, a lab page with its own `kit-<name>` composition id
  and `data-duration`, in `lab/kit-<name>/proj`; scenes work as before. A scene lab leaves out
  the soundtrack only when `assets/audio/full.wav` does not exist yet.
- **text-sweep.mjs: the shared script list.** It loads the kit from `assets/lib/scripts.txt`
  instead of a fixed list, so the sweep sees Lesson 2's kit modules. No output changes.
- **mix.py: Lesson 2's examples** (FACTS 41 to 53). `sound_for` plays first-step, climb, unroll
  (all 37 keys A2 to A5, then a chime on A3 and A4), bc-cd, neighbours, e-f (also for
  `ef-again`), tone-split, two-ways, quiz-pair (Lesson 1's `tone()`), cents-glide (new
  `glide()`: a hold, 40 cents a second, a hold) and slide-blue and slide-orange (new
  `voice_contour()`: Merc's synthesised "ooh" on the FACTS 50 contour with the demos' vibrato).
  The bed, room tone, stings, whooshes, sung notes and loudness are Lesson 1's. Measured on the
  first mix: every example within 0.1 cent of its FACTS pitch; the bed is digital zero inside
  every line, example and sung note and sounds under all eight dressed pauses; -16.0 LUFS.
  Regenerate: `assets/audio/` (then the master render).
- **merc-shots.py: Lesson 2's passes, the slides, named entrances and exits.** `PASSES` is the
  storyboard's Merc table, keyed off cues and words: m01-blue and m01-orange, m05, m06, m08,
  m10, m12a, m12b and m13 (orange) and the unbroken m14-duo pair to past the film's end.
  - New keys: `enter` (a `drop`, 0.4 s) and `exit` (a `hop`, 0.6 s), each a start anchor and
    a fixed length, with the pass ending 0.05 s after its exit ends; `during` (a state over a
    span); `slide` (state `ride` from 0.15 s before the slide to 0.15 s after, full arcs, and
    voice entries on the FACTS 50 contour, its glides in 0.1 s steps, `midi` rising and
    falling, so the stretch and lean follow the pitch); `glideMouth`.
  - The renderer's `point` has no talking mouth, so m01-blue points through "Seven letters,"
    and talks the rest of b3; sparkles default to off (Lesson 2 decision 42).
  - Regenerate: `merc/shots/`, then the passes (`merc-pass.mjs`), then `merc-tags.py`.
- **merc-pass.mjs: `glideMouth`.** A shot's `glideMouth` reaches the renderer's mount options
  (`'open'` is the "ooh" mouth for `ride`); a shot without it renders as before.
- **captions.py: Lesson 2's words and sounds, and three fixes the lesson needs.**
  - `WORDS` and `SOUNDS` are the storyboard's (§ Sounds and captions); the files are
    `captions/lesson-02.en.srt` and `.vtt`.
  - A sentence too long for two lines (b5, 85 characters) is split at its clause marks.
  - A chunk starts on its own first word, from the voice's word times, not at a share of the line
    by letters (which gave b26's "Yes." 0.22 s).
  - A sound description longer than a line wraps (three of Lesson 2's are 45 to 61 characters).
  - A speech caption may start up to 0.1 s late to give a short one before it its 5/6 s.
  - Result on the scratch voice: 100 captions, longest line 42, peak 20.0 characters a second.
    Regenerate: `captions/`.
- **chapters.py: Lesson 2's chapters** (the storyboard's list, each at least 10 s).
- **script-md.py: Lesson 2's title**, and a line naming the approved script in the docs folder;
  it writes this project's `SCRIPT.md`, the voiced clock.
- **web-video.sh: lesson-02 names**, and the poster's default time is 1.6 s into `s02-title`,
  read from `assets/scenes.js`, so it follows every re-time (it was a typed 24.4 s).
