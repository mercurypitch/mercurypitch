# Brief: import Lesson 5's final voices, re-time the film, and cut a listening copy

The owner said yes to Lesson 5's final voices on 26 November, and will check the result. The takes
come from the owner's ElevenLabs voices: Merc "Merc V1 Gentle Whimsical D2", Tavi "Tavi - Orange
Merc (recreated)". Model Eleven v3, one take a line, prompt exactly the script line. Your job is to
bring them into the film as the series' pipeline describes, rebuilding the two import tools that
were lost with Lesson 4's machine, and to re-time the film on them.

S   = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
L5  = $S/l5film (the film's HyperFrames project)
V   = $L5/voice-takes (the takes: `takes/<line id>.mp3`, 44.1 kHz mono MP3; `batch.json`, the 71
      lines with their text; `ledger.jsonl`, the generation calls)
PY  = $L5/.venv/bin/python (numpy, soundfile, onnxruntime 1.32, kokoro-onnx); run tools with -I
SERIES = /home/user/mercurypitch/.claude/worktrees/fix/docs/plans/find-your-pitch (read only)

Tavi's 15 takes are in `V/takes/` now. Merc's 56 are being generated and downloaded by another
agent; they are all in when `V/merc-report.md` exists.

## Read first
- SERIES/PRODUCTION-PIPELINE.md: § 3 "Voices" (the director's import pipeline) and § 4 traps 18
  to 21 (the lone click at a take's end; why Whisper's word times are not good enough and forced
  alignment is; key every time to a word).
- `L5/tools/tts.py`, all of it: the take format every tool downstream reads (24 kHz mono 16-bit,
  PAD 0.02 s before the first word and after the last, FADE, LUFS -22.8, PEAK 0.97, the envelope
  at ENV_RATE 100, `words.json` with each script word as written). Reuse its functions where you
  can rather than writing new ones.
- `L5/tools/cues.py`: its `--no-tts` contract and how it reads `assets/voice/_elevenlabs.json`.
- `L5/tools/CHANGES.md`, and the headers of `mix.py`, `captions.py`, `chapters.py`,
  `script-md.py`, `gen-root.py`, `merc-shots.py` and `clock-lint.py` before you run any of them.
- `L5/DECISIONS.md` from 240 on, and `L5/BRIEF.md` § Audio.

## Phase 1: the tools, proven on Tavi's 15 (start now)
1. **`L5/tools/ctc_align.py`**: forced alignment of a script line's own words with
   wav2vec2-base-960h as ONNX (the Xenova export: `vocab.json` and `onnx/model_quantized.onnx` from
   huggingface.co, into `L5/models/w2v/`). The CTC trellis and its Viterbi path in numpy; words
   normalised for the model's vocabulary (capitals and the apostrophe; a numeral spoken as its
   word, "3" as THREE), while the output keeps each script word as written.
2. **Calibrate it on the Kokoro takes** (`L5/assets/voice-kokoro/<id>.wav` and their
   `.words.json`, whose times are the model's own phoneme times): align every Kokoro take, compare
   word starts and ends, and report the median and the 90th-percentile error. Apply the constant
   offset that the comparison gives, as the pipeline did (the target it met before: 5 ms for the
   median word, 60 ms for nine in ten).
3. **`L5/tools/import.py`**: for each take, decode to 24 kHz mono; treat a blip under 60 ms that
   stands 0.3 s or more from the speech as no sound (trap 18); align; trim to PAD before the first
   word and after the last, with FADE; set LUFS -22.8 under PEAK 0.97; compute the envelope as
   tts.py does; write `L5/assets/voice/<id>.wav`, `.env.json` and `.words.json` (its `source`
   naming the take and the aligner, its `lag` the calibration), and add the line to
   `L5/assets/voice/_elevenlabs.json` in the form cues.py reads, with the take's generation id from
   `V/ledger.jsonl` and the file it came from. The Kokoro takes stay in `assets/voice-kokoro/`.
4. **A words check, no other service**: a greedy CTC transcript of each take with the same model,
   compared with the script line (normalised). List every line whose words differ, in
   `V/ASR.md`, with both texts. A difference is a prompt for a person to listen, not a verdict.
5. Run 3 and 4 on Tavi's 15. Look at three of them closely: the waveform's edges after the trim,
   the envelope, and the word times against the envelope's onsets.

If `V/merc-report.md` exists when Phase 1 is done, go straight on to Phase 2. Otherwise hand back
Phase 1 (below) and wait to be resumed.

## Phase 2: all 71, the re-time and the listening copy
Before you change anything, copy into `L5/backup-pre-voices/`: `cues.json`, `assets/cues.js`,
`assets/audio/` (its WAVs), `PACING.md`, `SCRIPT.md`, `captions/`, `index.html` and
`assets/voice/` as it stands.
1. Import all 71 takes (import.py), and run the words check on all 71.
2. `PY -I tools/cues.py --no-tts`: the film re-timed on the takes. Report its new length against
   the scratch voice's 9:09.47 (the owner allows up to 10 minutes) and PACING.md's summary.
3. The mix and everything that follows the clock, each tool read before it runs: `mix.py` (the
   film's full mix, `full.wav`, as the sound step made it: DECISIONS 243), `captions.py`,
   `chapters.py`, `script-md.py`, `MIX=full gen-root.py` (it must leave every scene file as it
   is), then `npx --yes hyperframes@0.8.97 check` through `$S/bin/heavy` (0 errors) and
   `tools/clock-lint.py` on every scene (silent).
4. **The listening copy for the owner**: `L5/renders/voices-final-listen.mp3`, the full mix at
   192 kbps, and `L5/renders/voices-final-voice-only.mp3`, the voice track alone. Measure the full
   mix's integrated loudness, true peak and loudness range, and compare them with the sound step's
   (DECISIONS 243: -16.1 LUFS, 4.8 LU).
5. Do not run the hosts' passes or render the film: the final passes (`lab/passes-proto/final60/`)
   and the 60 fps render are the next step, after the director checks your work.

## Rules
- Never call ElevenLabs or any other voice, music, image or video service. The takes are given.
- Write only in L5 (and `V/ASR.md`). Never edit a scene file; never production; no commits or
  pushes; no attribution, emojis or model names in any file.
- Every heavy job (`check`, a render, a long batch) goes through `$S/bin/heavy`, one at a time.
  Other agents render on this machine at the same time.
- Disk is limited (about 7 GB free, shared). Never delete anything outside your own new files to
  make room; if it runs short, stop and report it.
- Log what you decide in `L5/DECISIONS.md` from 246 on, add a row to `L5/LEDGER.md`, and log the
  new tools in `L5/tools/CHANGES.md`.

## Hand back
- Phase 1: the calibration numbers (median and 90th-percentile error of word starts and ends on
  the Kokoro takes, before and after the offset), Tavi's 15 imported, the words check's flags, and
  anything in the take format you had to decide.
- Phase 2: all 71 imported; the words check's flags by line (with both texts); each take's length
  against its Kokoro take; the film's new length and PACING summary; the tools run and their
  results (check, clock-lint); the listening copies' paths and their loudness; what still waits
  for the final passes and render.
