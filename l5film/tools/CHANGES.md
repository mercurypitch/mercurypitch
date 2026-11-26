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

## 2026-11-26 (Lesson 5, the final run: the lead's additions to the final passes, DECISIONS 245, 257 to 259)

Two tools changed, both only for the final profile. The copies before: `lab/final-run/before/tools/`.
Outputs to regenerate: the final shots (`python3 tools/merc-shots.py --final`), every pass
(`tools/merc-queue.py --order=final`) and `merc/PASSES.md`; all done in this run.

- **merc-shots.py: a breath in before a host's own sung sound, and with the viewer in `breathe`**
  (lines 72 to 74, 116 to 126, 310 to 323, 357 to 365, 387 to 393, 977 to 980, 1022 to 1031, 1036 to
  1037, 1050). Under `--final` only; without it the tool writes the same four shots byte for byte
  before and after (`lab/final-run/nonfinal-check/`).
  - Before: `sing` from 0.15 s before a host's own sound, the mouth shut until the note. After: a
    voice entry `breath_span` (the small o at `BREATH_LEVEL` 0.05, a step in and out, no sound) for
    `BREATH_IN` 0.15 s before the first note of `gauge`, `demo`, `listen` and `twinkle`, and `sing`
    from 0.20 s before it.
  - Before: both hosts `idle` through `breathe`. After: `BREATHE_WITH` (line 126): both in `sing`
    (over the quiet `idle`, priority 6.5) with the same small o from 0.12 s into the pause to 0.15 s
    before its end, `idle` again 0.05 s after the mouth shuts. No arcs window is added.
  - An assert that no such breath lies over the host's own voice (line 980), so a re-time that puts
    a line there stops the tool.
  - `merc/final-report.md` names both in its constants, marks "(breath in)" before a host's own
    sound too and "(the hosts breathe in with the viewer)" on that pause, and counts them.
- **merc-passes.py: the guide's text for the final passes** (lines 97, 185 to 188, 195 to 198):
  the hosts no longer idle through `breathe`, and the two additions are described. For shots
  without `profile: final` the guide is unchanged.

## 2026-11-26 (Lesson 5, the final voices: the import tools and the re-time, DECISIONS 246 to 256)

Two tools are new and one changed; `tts.py` and every other tool are as they were (`tts.py` sha256
e1e084f6...). The proofs and the copy before are in `lab/voices-import/` (NOTES.md). What this step
rewrote was copied first to `backup-pre-voices/`. After any re-import, in this order:

```bash
$S/bin/heavy .venv/bin/python -I tools/import.py            # every take; or the ids, or --who=orange
$S/bin/heavy .venv/bin/python -I tools/cues.py --no-tts     # the clock, PACING.md, assets/audio/voice.wav
MIX=full python3 tools/gen-root.py                           # the scene table FIRST: the next three read it
$S/bin/heavy .venv/bin/python tools/mix.py
python3 tools/captions.py && python3 tools/chapters.py && python3 tools/script-md.py
$S/bin/heavy npx --yes hyperframes@0.8.97 check && python3 tools/clock-lint.py
```

`ctc_align.py --calibrate` runs again only if the Kokoro takes or the model change.

- **ctc_align.py: new** (recreated from PRODUCTION-PIPELINE § 3 and trap 19; the director's original
  was lost with Lesson 4's machine). Forced alignment of a line's own words with wav2vec2-base-960h
  as ONNX, in numpy: `spoken` spells a script word for the model's 26 capitals and apostrophe (a
  hyphenated word as its parts, a numeral as its words), `viterbi` is the CTC trellis and its best
  path (it may pass a word boundary before the first word and after the last: the model writes one
  at a line's end), `Aligner.words` gives each script word, as written, its start and end and the
  mean log-probability of its letters, `Aligner.heard` the greedy transcript, `compare` the
  transcript against the script line.
  - `place` moves the aligned words onto the sound: a silence (tts.py's: 5 ms frames 40 dB under
    the loudest, 50 ms or more) that the aligner's letters put between two words sets the end of
    the first and the start of the second, within 0.3 s of the aligner's own time, and the take's
    first and last words take the sound's start and stop; every other edge moves back by the
    calibration's constant. It stands in for `tts.calibrate`, which sets a word on any silence
    within 0.3 s before it, a stop's closure inside the word before included (DECISIONS 248).
  - `--calibrate` aligns every Kokoro take, compares the word starts and ends with Kokoro's own
    word files and writes `tools/ctc-calibration.json`: the constants (+35 ms starts, +5 ms ends),
    the model's sha256 and the errors as aligned and as placed (DECISIONS 247). `--check` writes
    nothing. With an audio file and a line it prints that take's words and what the model hears.
  - Reads sound through ffmpeg; writes nothing but the calibration file.
- **import.py: new** (recreated likewise). Per line of `voice-takes/batch.json`: decodes
  `voice-takes/takes/<id>.mp3` to 24 kHz mono; leaves out the clicks that are not speech (trap 18,
  and a run under 60 ms at the file's first or last sample); aligns and places the words; trims from
  PAD before the first sound to PAD after the last with FADE, filling the pad with silence where
  the service cut the take short; sets LUFS under PEAK and writes the envelope, all with tts.py's
  own constants and functions (`frame_rms`, `silences`, `loudness`, `envelope`). Writes
  `assets/voice/<id>.wav`, `.env.json`, `.words.json` and `assets/voice/_elevenlabs.json`, and in
  `voice-takes/`: `import.json` (what each import measured, kept across runs), `IMPORT.md` (edges,
  lengths against the scratch takes, levels) and `ASR.md` (the words check). It refuses a line
  whose text in batch.json is not script.json's. `--dry` measures and writes nothing. It calls no
  service.
- **tools/ctc-calibration.json: new, generated** by `ctc_align.py --calibrate`; `import.py` stops
  without it.
- **models/w2v/: new.** `vocab.json` (sha256 4178db26...), `onnx/model_quantized.onnx` (95 MB,
  cd5040c1...), and the export's `config.json` and `preprocessor_config.json`, from
  huggingface.co/Xenova/wav2vec2-base-960h. `W2V_MODEL` names another folder.
- **cues.py: the pacing report's heading** (lines 207 to 219 and 238; nothing in the clock).
  - **Before:** `# Pacing: the scratch clock`, the scratch voices named ("local Kokoro: Merc
    `am_michael` at 0.84 ..."), and "a line with many marks reads slow (Kokoro pauses at each)",
    whatever stood in `assets/voice/`.
  - **After:** when every line is listed in `_elevenlabs.json`, `# Pacing: the voiced clock`, the
    voices the list names, and "(the voice pauses at each)". Otherwise the text is the old one: on
    the backed-up scratch clock the report comes out byte for byte as `backup-pre-voices/PACING.md`.
  - The copy before: `lab/voices-import/before/cues.before-import.py.txt`.
- **gen-root.py: not changed; run aside** (`lab/voices-import/root-aside/`), because on a re-time it
  writes the root `data-duration` of every built scene whose length moved (13 of 15 here), and this
  step was not to touch a scene file. Only its `assets/scenes.js` and `index.html` were installed.
  Run it in place before the next render (DECISIONS 252).
- **Regenerated on the voiced clock** (9:29.7): `cues.json`, `assets/cues.js`,
  `assets/audio/voice.wav`, `PACING.md`; `assets/scenes.js`, `index.html`;
  `assets/audio/kit-sound.json`, `full.wav`, `music-only.wav`, the six stems, `mix-report.json`;
  `captions/lesson-05.en.srt`, `.vtt`, `chapters.json`; `SCRIPT.md`. Not regenerated, and stale until
  the final passes: `merc/shots/`, `assets/merc/` (the passes and `roots.js`), every scene's Merc
  tags and the 13 root durations.
- **New in renders/**: `voices-final-listen.mp3` and `voices-final-voice-only.mp3` (DECISIONS 255).

## 2026-11-20 (Lesson 5, the final passes proved on two scenes: DECISIONS 189, 201, 203, 224, 225, 227, 234)

Six tools changed; `merc-joins.py`, `merc-whole.py` and `merc-sheet.py` did not. Nothing the film
reads was written: `merc/shots/`, `assets/merc/`, `compositions/` and `index.html` keep the hashes
taken before the work (`lab/passes-proto/tools-before/film-files.sha256`), and each tool, run as it
was run before, writes what it wrote before (`merc-shots.py --check`: 0 shots would change;
`merc-tags.py --check`: 0 stale; `merc-queue.py --list`, `merc-roots.py` and `merc-passes.py`: byte
for byte, written aside and compared; `merc-pass.mjs`: three frames of today's m-blue rendered
aside equal the film's dumps byte for byte). The copies before: `lab/passes-proto/tools-before/`.
The proofs: `lab/passes-proto/` (README.md). Nothing to regenerate now. The final run, after the
final voices and `tools/cues.py`: `python3 tools/merc-shots.py --final`, read `merc/final-report.md`,
`python3 tools/merc-queue.py --order=final` (detached, as its header says), then `merc-roots.py`,
`merc-joins.py`, `merc-passes.py`, `merc-tags.py` (every scene) and `merc-tags.py --check --margins`.

- **merc-shots.py: the final passes' profile, `--final`** (lines 53 to 72, 86 to 89, 97 to 143, 248 to 250,
  310 to 319, 384 to 387, 466 to 898, 910, 914 to 1017). Without `--final` the tool is today's. With it (60 fps unless
  `--fps=<n>`; `--out=<dir>` writes the shots elsewhere, the talk envelopes in `<dir>/../talk/` and
  the report as `<dir>/../final-report.md`):
  - **A talk cycle** (DECISIONS 201; `TALK`, line 110; `talk_env`, line 537). Before: each line's
    envelope fed `sing` as it was (`gain` 0.55), so a held vowel held one mouth shape. After: the
    envelope is written again at 240 samples a second as `merc/talk/<line>.env.json`: from each
    word's start (voiced stretches less than 0.06 s apart) the mouth is open for the first 0.70 of
    every 1 / 5.5 s at 0.55 x loudness ^ 0.6 and shut for the rest. `gain` stays 0.55 (the loudest O
    stays 0.75 of a sung note's); `power` 0.6 is new (was 1); the shot's voice entry carries
    `gain: 1` and the new file. The arcs stay at 0.5 (`SPEECH_ARCS_FINAL`), now keyed over each
    phrase instead of the whole line (line 318), so a pause and a breath in show none.
  - **A breath in** (DECISIONS 189; `BREATH_IN` 0.15, `BREATH_LEVEL` 0.05, lines 114 and 115). The
    mouth opens to its smallest shape 0.15 s before the first word after every pause of
    `PAUSE_MIN` 0.25 s or more; a line that opens on one starts `sing` 0.20 s before it (was 0.05).
  - **A blink in the pauses** (DECISIONS 189; `find_pauses`, line 515; `Track.blink_in`, line 668;
    `plan_final`, line 781). A state's blinks run from its start (`sing` 2.7 s in, `idle` 1.1 s), so
    a cue of the state a host is already in restarts them: one `sing` cue 2.7 s before puts the
    talker's blink `BLINK_AFTER` 0.10 s after the voice stops; one `idle` cue 1.1 s before puts the
    listener's `BLINK_PAIR` 0.03 s after that, in a pause of `PAIR_MIN` 0.50 s or more or when the
    talker has none. Pauses up to `LONG_PAUSE` 1.2 s come first, the longest first. A cue of `idle`
    goes only where it steps the breath by 0.7 % or less (`BREATH_STEP`, line 135: restarting the
    breath at its top showed as a 3 px jolt at 240 px); a cue of `sing` goes anywhere (1.2 % at most).
  - **Eyes at rest across every cut** (DECISIONS 203; `CUT_CLEAR` 0.20, line 142; `clear_cuts`,
    line 790; `Track.recue`, line 738). A `listen` that would start or end within 0.2 s of a scene
    boundary starts 0.2 s after it; a blink or a glance that would cross one is moved by a cue of
    its state; a blink a later cue would cut short is finished or moved.
  - **S14's chunks at S15's size** (DECISIONS 225; `CHUNK_SIZE_FINAL`, line 250; `chunks`, line
    910). Before: `{'s15-end': 400}`. After, with `--final`: `{'s14-next': 400, 's15-end': 400}`.
  - **`merc/final-report.md`** (`final_report`, line 972): every pause of 0.25 s or more with what
    each host does in it or why not, what was moved at the cuts, and any eye move left on one.
- **merc-pass.mjs: `--out=<dir>` and `--dump-dir=<dir>`** (lines 21 to 23, 109 to 111, 187, 383,
  445). The WebM, its sidecar, the `--stills` and the dumps go there instead of `assets/merc/`,
  `lab/merc/` and `lab/merc/dump/`. Nothing else changed: the renderer's pin holds, and the talk
  cycle, the breath in and the blinks are the shot's cues and envelopes.
- **merc-tags.py: `--shots=<dir>`, `--scenes=<dir>`, `--src=<prefix>`, and `--margins`** (lines 61
  to 76, 88 to 99, 118, 136, 145, 150 to 185, 190, 225, 252 to 254, 270, 275, 292 to 302, 322 to 332). The first three point the tool
  at a lab's shots and scene copies. `margins()` models the renderer's cut for every film frame a
  tag shows and gives the distance to the nearest pass-frame boundary; `--margins` prints it, and
  `--check` now fails a pass at the film's fps whose margin is under `MARGIN_MS` 4 ms or whose film
  frame would show another pass frame (this step's 30 fps passes are reported, not failed).
- **merc-queue.py: `--order=final`, `--plan`, `--shots=<dir>`, `--out=<dir>`, `--log=<file>`** (lines
  16 to 26, 38 to 48, 54, 65 to 68, 72 to 100, 116 to 127, 139). The default order and the default files are today's.
  `--order=final` renders the checks first (m-blue-s04, both s15, m-blue-s13), then scene by scene,
  Merc's chunk and Tavi's together; `--plan` prints that list with frames and time
  (`MS_PER_FRAME`, line 48).
- **merc-roots.py: `--shots=<dir>`, `--merc=<dir>`, `--out=<file>`** (lines 19 to 34, 40, 46, 65, 67).
- **merc-passes.py: `--shots=<dir>`, `--merc=<dir>`, `--dump=<dir>`, `--out=<file>`, and the final
  profile's text** (lines 11 to 29, 47, 55, 78 to 81, 95 to 101, 186 to 193, 267 to 275, 281 to 282): for
  shots with `profile: final` the guide gives their fps, the talk cycle, the breath in, the blinks
  and the cuts, and the one-to-one frame timing; for today's shots it is unchanged.

## 2026-11-20 (Lesson 5, the sound step, DECISIONS 242)

Two tools changed and two are new. Regenerate, in this order: `.venv/bin/python tools/mix.py` (it
runs `node tools/sound-kit.mjs` first), `python3 tools/captions.py`, the review cut's mux, then
`.venv/bin/python tools/sound-measure.py --out review/<round> --cut <cut> --picture <picture>`.
Proofs: `review/sound-01/` (SOUND.md and its tables). The copies before: `review/sound-01/before/`
(`mix.before-sound.py.txt`, `captions.before-sound.py.txt`).

- **sound-kit.mjs: new, read-only.** Loads the kit's modules in node (no browser: `assets/cues.js`,
  `assets/scenes.js`, `assets/merc/roots.js` and every `assets/lib/*.js` of `scripts.txt` but GSAP)
  and writes `assets/audio/kit-sound.json`: `L.CONTOUR.easy`, `.pushed`, `.push` and `.demo`
  (`cents`, the drawn line `c` and `db`, every millisecond), `L.CONTOUR.vib(t, 0)` over 10 s, the
  Push slider's `pushAt`, a step's cents and dB, the gauge's length from `L.GAUGE.x` and its line's
  place in Merc's band, `L.TRACE.ONSET`, `.len` and `.level` for the three starts, `L.TEASE`'s notes
  and onsets, `L.TITLE.CHIME`, `L.HOP`, `L.settled('demo')`, and each file's sha256. Two rules live
  only in a scene, so it reads that scene's own line and stops if the line no longer reads so:
  s09-onset's `ROW_T = [0, LEN + 0.2, 2 * (LEN + 0.2)]` (the starts back to back) and s13-recap's
  `HOP1 = at('break', 'start', 0.6), HOP2 = at('break', 'start', 1.25)` with its moves
  `at: HOPn + L.HOP.crouch, dur: L.HOP.air` (the landings: 490.84 and 491.49 on today's clock).
  `--print` prints a summary and writes nothing. It writes nothing but that JSON.
- **sound-measure.py: new, read-only** (writes only into `--out`). Reads `cues.json`,
  `kit-sound.json`, `mix-report.json`, the mixes and the stems; with `--cut`, the review cut's
  decoded sound; with `--picture`, S9's frames. Writes `SOUND.md`, `tracks/<sound>.csv` and
  `starts-picture.csv`: each sung sound's pitch and level every 10 ms against the kit's drawn
  values (the fundamental's instantaneous frequency, band-passed 3 semitones each side), the ticks
  against `listen`, the starts' onsets, lines against sounds, the bed's windows and the silences,
  the landings, whooshes and chimes, the stems' and mixes' loudness, the stems' sum against
  `full.wav`, the limiter, and the traces' heads frame by frame against the sound. It shares no code
  with the mixer. Its frame reader passes `-fps_mode passthrough` and checks one frame read alone
  against the same frame read in a run: without it FFmpeg repeats the first frame after a seek and
  every frame reads one late (the first run read the picture 33 ms behind for that reason).
  `--only 1,3` runs sections and writes nothing (development).
- **mix.py: this film's sounds, bed and effects** (Lesson 4's engine kept: `tone`, `chime`,
  `noise_whoosh`, `room_tone`, `place`, the limiter, the balance by loudness and its targets).
  - `sound_for` (line 452) is Lesson 5's: `easy`, `pushed`, `push` and `demo` on `L.CONTOUR`'s drawn
    line and level (`contour_note`, 313); `gauge`, `listen` and `twinkle` as held notes with the
    voice's own wave from the kit (`held_note`, 321; `tune`, 405); the three starts (`start_sound`,
    379): the tone's level is `L.TRACE.level`, its onset `L.TRACE.ONSET`, the puff and the click the
    page's own bursts (its seeded noise, envelope and band, `page_burst`, 350; lengths and levels
    from `lesson-05/starts.ts`, FACTS 80); `starts` on s09's row times; `tick` (419). `ooh` (292) is
    the one timbre: FACTS 79's partials and lowpass on any contour, the release closing inside the
    sound's own length so no tail runs under the next line. A sound whose length by the kit is not
    its cue's stops the run.
  - The bed (481 to 513, 584 to 598): an explicit list, FACTS 81's eight marks and nine pauses and
    `break` (DECISIONS 215), each a window in the gap between two lines, sounds or stings; a mark or
    pause with no window stops the run. Lesson 4's rule (everywhere but the quiet stretches, gaps
    under 1.2 s merged) left `hook` and `recap` without the pad on this cue sheet. The pad runs up
    to the title chime's first note. `pad` now takes a time array, and each window holds the pad on
    its own time, zero at the window's middle: on the film's clock its slow beating left one pause
    9 dB under another (-26.8 to -35.7 dBFS RMS; `break` the lowest). The gate's edges are written
    where they fall (the same raised cosine a 0.35 s Hann kernel gave; convolving 26 million
    samples took minutes).
  - The effects: one whoosh an act mark, each at the same RMS (Lesson 4's differed by seed, 4 dB
    in peak here), ending no later than the next line's start (`next`'s starts 0.05 s earlier for
    that); the ticks and Merc's two landings (`landing`, 433) are set after the balance, against
    `listen`'s peak (13 dB under) and the pad's peak in `break` (3 dB under), so the whooshes'
    level does not move with them. The ticks sit in the `fx` stem.
  - The master: the limiter's look-ahead is computed in place (the same values; 30 rolled copies
    of the film took 3 GB); the final loudness is read on the two-channel signal the file carries;
    the stems are written with the limiter's gain and the final gain, so they add up to `full.wav`
    and `bed + stings + floor` is `music-only.wav`; a stem with nothing in it is not written
    (`merc`); `full-raw.wav` and `music-raw.wav` are no longer left behind. It writes
    `assets/audio/mix-report.json`: every time and level it chose.
  - Removed: Lesson 4's `sound_for` table, `C_MAJ`, `D_MAJ` and `NO_BED`.
  - Run it with the project's Python (`.venv/bin/python`: numpy and soundfile; the system Python
    has neither), through the heavy helper (1.5 minutes).
- **captions.py: this film's tables, and four rules.** `WORDS` (the address, FACTS 78), `SOUNDS`
  (STORYBOARD § Sounds and captions, word for word), `QUIET` (`heard`, `breathe`, `hook`, `card`,
  and `break`, which the board's table does not list) and `SUNG` (`gauge` and `twinkle` Merc's,
  `demo` Tavi's, `listen` both, so the line after it is named). Lesson 4's solfège spellings are
  gone (a stray "ray" or "tee" would have been rewritten). The rules, each for one caption of this
  film: a long sound's description gives way by up to a tenth of its length, so "[your ten
  seconds]" comes up when "[tick: start]" has had its 0.83 s; a description still short of its
  minimum starts early by what it lacks ("[tick: stop]", 17 ms); `KEEP` holds words no caption may
  part, a quoted title and a speaker's label from its first word ('"Twinkle, / Twinkle"' was
  broken twice); a sentence with no clause mark that cannot fit is halved at the space nearest
  its middle (o15, 85 characters); a first line never ends on a little word when the sentence can
  be split at a clause mark instead (b6's "... talk at: a"); a short last chunk takes the clause
  before it (b30's "a scoop." stood 0.83 s alone). Output: 139 captions, 23 of them sound
  descriptions, longest line 42, peak 19.7 characters a second, no warning.
- **gen-root.py: not changed; run with `MIX=full`.** `index.html`'s soundtrack is now
  `assets/audio/full.wav` (its one changed line); `assets/scenes.js` was rewritten byte for byte;
  no scene file was touched (35 files' sha256 before and after).

## 2026-11-19 (Lesson 5, integration: Merc's root on the shown pass frame in the film, DECISIONS 225)

No tool changed. One kit file changed, by an atomic rename; proofs and the copy before are in
`lab/integration/film-hops-fix/` (README.md, `base/hosts.js`).

- **assets/lib/hosts.js: `L.passFrame(t, ds, ms, pf = 30)`, new (lines 90 to 99; header lines 50 to
  61), and `L.mercGate` reads Merc's root with it.**
  - **Before** (line 151): `const i = Math.floor((rootFromTag ? t - ds + ms : S0 + t - root.t0) * (root.fps || 30) + 1e-6)`.
  - **After** (line 176): `const i = rootFromTag ? L.passFrame(t, ds, ms, root.fps || 30) : Math.floor((S0 + t - root.t0) * (root.fps || 30) + 1e-6)`.
  - **The header's `root` entry** says so (lines 43 to 47).
  - **Why the old reading failed.** The renderer cuts a pass once, at the render's fps F (ffmpeg
    `-ss data-media-start`, pts 0.5 ms early, `fps=F:round=up`), and shows cut frame
    `floor((T - start) x F)` of the frame's exact time. Where a scene starts on a fraction of a frame
    (s13 at film frame 13871.1), video time from the tag reads one pass frame late. That gave
    film-draft-01's 49.6 px at 490.933 and the 4 px in the air.
  - **What the new function does.** It takes F from the render
    (`window.__HF_EXPORT_RENDER_SEEK_CONFIG.fps`; the pass's own fps with no render, as in a probe or
    a preview). It gives k a 1e-3 frame margin, because the page's time comes rounded to the
    microsecond.
  - **What the margin fixes.** That rounding is also DECISIONS 224's "9 px after hop 2" in the lab at
    60 fps: the old 1e-6 margin read one frame early on 650 of 3901 frames. The proposed
    `floor(ms x fps) + floor((t - ds) x fps)` would have done so on 650 of 1951 at 30 fps, and on
    every odd frame at 60.
  - **What changes on screen.**
    - The film at 30 fps: Merc's body moves +4.0 px through both carries, -49.6 px at 14728, and
      -0.4 to -9.6 px at 14748 to 14758 (the ease back after hop 2).
    - The film at 60 fps: unchanged, byte for byte.
    - s13 alone at 60 fps: the 2 frames that jumped after hop 2 (29.283 and 29.383) move back onto the ease, 1280.8 to 1290.3 and 1282.5 to 1288.5.
    - s13 alone at 30 fps: unchanged.
    - Every other host: unchanged, since its root x is 0.
  - **Proof.**
    - Film frames 488 to 496 s rendered with the producer's own plan at 30 and 60 fps, before and
      after: `hops-30.txt`, `hops-60.txt` and `hops-film-fix.png`.
    - The ffmpeg model: `ffmpeg-model/`.
    - Debug renders of the page's time and the frame read.
    - Every scene's probe, the kit probe and every `check` again.

## 2026-11-19 (Lesson 5, film-draft-02 and its comparison with draft-01)

No existing tool's output changed; `gen-root.py` was not run (no scene's length changed, and the
root is byte for byte what it would write with `MIX=voice`). film-cuts.py and film-events.py ran
as they are on draft-02. One new read-only tool:

- **tools/film-compare.py** (new). One whole-film draft against another, into `OUT/COMPARE.md` and
  `OUT/compare/`:
  - holds (measure.py's rule) for the film, per 30 s and per scene, both drafts side by side, and
    every hold of 0.3 s or more in the second draft with the words around it (inside a word when
    0.1 s or more of the hold lies in it);
  - single-frame events from each draft's `events.md`: each first-draft event still there (within a
    frame), moved (an unclaimed event within 1 s whose boxes meet its main box) or gone; the type
    steps of DECISIONS 233 by time; every new event, described from `compare/notes.json`;
  - the critic's four collisions (F-01 item 4): two inks picked by colour and place, specks and the
    room's dust left out, their nearest distance on every frame of the critic's window and of a
    window widened only where nothing else takes those colours and places; crops of the same frame
    from both drafts;
  - Merc's box through the clean break's hops (490.31 to 491.62, on to 491.95 for hop 2's settle):
    his body's pixels below the recap's chart, the box's centre and foot on every frame, the largest
    step, and any frame that steps out and back;
  - loudness from each `summary.md`.

## 2026-11-19 (Lesson 5, integration part 2: the whole film, film-draft-01)

Part 1's log is at the end of this file. No existing tool changed; `gen-root.py` was not run (no
scene's length changed). Two new read-only tools, both reading a whole-film render and writing only
under `review/`:

- **tools/film-cuts.py** (new). Every cut in `assets/scenes.js`: the last frame before and the first
  after (film frame `ceil(t * 30)`), with the frames either side, picked by their own timestamps after
  a seek (checked against a sequential decode: identical). Their luma change outside the hosts' boxes
  (HANDOFFS § Hosts: body box, 20 px keep-out, down to the frame's foot) and inside each box, against
  the step before and the step after; the 16 px cells that change only at the cut; and, for the
  three matched cuts (and the figure S6 carries into S7), the carried object's best whole-pixel
  shift, the move of its drawn centroid and its luma change in place. Writes `cut-NN.png`,
  `cuts.json` and `cuts.md` (with `notes.json`'s notes, when present).
- **tools/film-events.py** (new). After `measure.py render`: the hard holds summed per 30 s with
  their scenes (`holds-30s.md`), and every single-frame event in `events.csv` with its frame, scene,
  the cut it is or the cue edges and words within 0.2 s, the boxes that change, and a still strip
  (`events.md`, `events/NN.png`, `events/sheet-NN.png`). Uses film-cuts.py's frame picking.

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

## 19 November: integration, part 1 (the kit's fixes every scene sees)

The kit's fixes from the scene rounds, applied when no builder was editing, each file by an atomic
rename; proofs in `lab/integration/` (the copies before: `lab/integration/base/`). Line numbers are the
files' after the change.

- **assets/lib/hosts.js, `L.mercGate`: Merc's root read on the pass frame the renderer shows**
  (DECISIONS 214). Before (old line 146): `const i = Math.floor((S0 + t - root.t0) * (root.fps || 30) + 1e-6)`,
  the table's t0 about 1.4 frames behind the shown frame. After (lines 134, 150 to 151):
  `const ms = parseFloat(vid.getAttribute('data-media-start') || '0'), rootFromTag = timed && Number.isFinite(ms)`
  and `const i = Math.floor((rootFromTag ? t - ds + ms : S0 + t - root.t0) * (root.fps || 30) + 1e-6)`
  (t0 only for an untimed tag); the header's `root` entry says so (lines 39 to 45). Only m-blue-s13's
  root x moves (frames 842 to 897); every other chunk's x is 0, so no other scene's host moves.
  **compositions/s13-recap.html**: its local `rootFromTag` (old lines 223 to 232) and the
  `root: rootFromTag(...)` argument are gone; Merc's gate takes the default root (line 214).
  Proof: `lab/integration/item1-root/` (both hops frame by frame at 30 and 60 fps).
- **assets/lib/marks.js, `L.chapterCard`: the card in its own composited layer** (DECISIONS 202).
  Before (old line 177): the rise and breathing were an SVG transform on the glyphs' group
  (`inner.setAttribute('transform', 'translate(0 dy) translate(960 b-60) scale(s) translate(-960 -(b-60))')`),
  so the glyphs were laid out again at each frame's scale and Chrome snapped their baseline to the
  pixel grid (one jump each time it crossed a row: s11 at 0.800 and 1.467, S8, S9 and S10 at 1.467).
  After (lines 144 to 151, 184): the card's svg sits in a div (`.chapter-card-layer`, `will-change:
  transform`, its origin (960, baseline - 60)) in the hud's layer, and draw sets
  `wrap.style.transform = translate(0px, dy px) scale(s)`; `g` keeps its opacity attribute and class,
  `fit()` and the 1680 px cap are unchanged. The card now draws over the hud's svg (it was inside it):
  no scene shows hud marks over a card. Proof: `lab/integration/item2-card/` and `lab/kit-src/card.html`.
- **assets/lib/folds.js, `L.TRACE.STACK`: the "h" glyph's key is `hGlyph`** (DECISIONS 191). Before
  (old line 112): `h: { text: 'h', x: 760, y: 690, size: 120 }`, which overwrote `h: 70` (the rows'
  half-height). After (line 113): `hGlyph: { ... }`, so `STACK.h` is 70; the header says so (lines 21
  to 23). `L.TRACE.RECAP` is unchanged. **compositions/s09-onset.html**: `const ROW_H = 70` and its
  comment (old lines 198 to 199) become `const ROW_H = ST.h` (line 198); the glyph reads `ST.hGlyph`
  (line 214).
- **assets/lib/lesson.js and frames.js: the bokeh's and staves' lift, once for the film** (DECISIONS
  200). Before: `L.BOKEH_LIFT = 3`, `L.STAVE_LIFT = 2.5` (old lines 239 to 240); the bokeh's lift ramp
  `clamp((v - 10) / 150)` (frames.js old line 225). After: `L.BOKEH_LIFT = 5`, `L.STAVE_LIFT = 4`
  (lesson.js lines 242 to 243, its header lines 60 to 64), the ramp `clamp((v - 10) / 240)` (frames.js
  line 227, its comments lines 31 to 34 and 222 to 225). At rest the room is unchanged (shown at
  1 / LIFT); moving, the bokeh shows at up to 5 times its rest alpha (was 3) and lifts over a fast
  push's ease-in. Proof: `lab/integration/moves/` (every camera move, `MOVES.md` and its sheets).
- **assets/lib/chart.js: `L.settled(contour, { step = 0.016, band = 35, hold = 0.5 })`** (the page's
  "settled" rule as one kit function, lines 123 to 135; header lines 17 to 19) -> `{ entry, settled }`,
  the same loops s10 and s13 each held. **compositions/s10-steady.html** and **s13-recap.html**: their
  local `ENTRY` loops (old lines 52 to 61 and 65 to 74) become
  `const { entry: ENTRY, settled: SETTLED } = L.settled(DC)` (s10 line 52, s13 line 65). The
  flags hold: S10 entry 0.704 s, flag 1.204, world x 478.8 (screen 334.5); S13 x 334.50 at the entry.
- **assets/lib/tease.js: `L.TEASE.LINE.y` 170** (was 150; DECISIONS 220, 223; header line 8).
  **compositions/s14-next.html**: `const LINE_Y = 170` becomes `const LINE_Y = L.TEASE.LINE.y` (line
  51); the line's baseline stays 170 (s14's probe).
- **Not changed**: `L.RECAP.VM` (recap.js) is as group E left it (the card's last foot 777, `VM.ten` one
  line at baseline 820; DECISIONS 216, 223); `L.label`'s `backPad` default (DECISIONS 182); s10's own
  `ROW_H = 70` (not one of the named swaps; it can read `ST.h` now).
- **Kit labs**: `lab/kit-src/card.html` (new: a chapter card on S11's times, with its probe);
  `lab/kit-src/recap.html`'s Voice Mirror foot check follows group E's 777.
