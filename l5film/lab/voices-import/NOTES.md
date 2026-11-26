# Notes: importing Lesson 5's final voices (brief `briefs/l5-voices-import.md`)

Working notes, kept current so the work can be picked up after a stop. The log of record is
DECISIONS 246 on, `tools/CHANGES.md` and `LEDGER.md`.

## State

- [x] Model: `models/w2v/vocab.json`, `onnx/model_quantized.onnx` (sha256 cd5040c1...), plus the
      export's `config.json` and `preprocessor_config.json`.
- [x] `tools/ctc_align.py` written; `--calibrate` run once (constants +33 ms starts, +5 ms ends with
      tts.calibrate as the placement). TO REDO with the aligner's own placement (`place`), below.
- [x] `tools/import.py` written and dry-run on Tavi's 15. TO CHANGE to `ctc.place`.
- [x] `tools/tts.py` is the original again (sha256 e1e084f6...; a `lags` option was tried and taken
      out; the copy before is `before/tts.before-import.py.txt`).
- [ ] Phase 1: calibrate again, import Tavi's 15, words check, look at three takes closely.
- [ ] Phase 2: backup, all 71, cues.py --no-tts, mix, captions, chapters, script-md, gen-root, check,
      clock-lint, listening copies, logs.

## Findings so far

1. Calibration on the 71 Kokoro takes (1034 words), aligner minus Kokoro: as aligned, starts median
   +40 ms, |error| median 40, 90th percentile 90; ends -10 / 30 / 130. Sub-frame averaging over
   shifted copies and the length of silence put round the sound change nothing (exp3, exp4).
2. `tts.calibrate` on an aligner's times is unsafe on natural speech: it lets a silence claim the
   first word the model starts within 0.3 s after it, and a stop's closure inside a word is a
   silence. On the final takes it moved 34 of 391 placed word starts more than 0.13 s, ten of them
   0.19 to 0.275 s early ("back" in "spring back" onto the p of "spring"), and word ends by up to
   0.54 s (`exp8-tts-calibrate-on-aligner-times.txt`). So the importer places words itself: a
   silence sets a word edge only when the aligner's letters put it between two words, and the
   edge is within the aligner's own error of it (exp10: no move over 0.175 s; to be capped 0.15).
3. The takes are cut tight by the service, in 80 ms steps: some start or end with the voice still
   sounding (o1, o3, o7, o13, o15, b9, b58, b59 ...). The importer fades 5 ms and fills the pad.
4. About a fifth of the takes carry a 1 to 2 ms step at the file's last samples (some at the
   first), 60 to 240 ms after the speech: closer than trap 18's 0.3 s, so the importer also counts
   as no sound a run under 60 ms that touches the file's edge with 50 ms or more of silence
   between it and the rest (exp6, exp7).
5. After a clear pause the aligner marks the final voices' words 55 ms late (both), the scratch
   voices' 40 and 35 ms (exp9): within 20 ms, so the scratch voices' constant stands.

## Open point for Phase 2

`gen-root.py` rewrites each built scene's root `data-duration` when the table changes, and every
scene's length changes on a re-time. The brief says it must leave every scene file as it is. Plan:
run it aside first, see exactly what it would change, keep the scene files untouched, and report.

## Progress, 26 November (later)

- [x] The aligner's forced path now passes an optional word boundary at the line's edges (the model
      writes one after the last word; without it "in?" in o9 was put 0.3 s late on bad frames).
- [x] Calibration final (`calibration.txt`): as aligned starts +40 ms median, |error| 40 / 90 ms
      (median / 90th percentile), ends -10, 30 / 135; as placed starts 0, 10 / 45 ms, ends 0, 15 / 65.
      Constants +35 ms (starts), +5 ms (ends).
- [x] Backup made before anything changed: `backup-pre-voices/` (with `before.sha256`, which also holds
      every scene file's hash, and `voice.sha256`).
- [x] Phase 1: Tavi's 15 imported; looked at o1, o4, o13, o9 (`look/`).
- [x] Phase 2 step 1: all 71 imported (`import-all.txt`); `voice-takes/ASR.md`, `IMPORT.md`, `import.json`.
- [ ] Next: cues.py --no-tts; gen-root aside (scene files!); mix; captions; chapters; script-md; check;
      clock-lint; listening copies; DECISIONS 246+, LEDGER, CHANGES.

Order to run after cues.py: gen-root.py BEFORE chapters.py and script-md.py (both read
assets/scenes.js; CHANGES records chapters.json going stale that way on the 190 re-time), and before
mix.py if sound-kit.mjs reads the scene table.

## Progress (after the re-time)

- [x] `cues.py --no-tts`: 9:29.7 (569.740 s), 143 words a minute while speaking (`cues-no-tts.txt`).
      cues.py's pacing header now names the imported voices when every line is imported
      (`before/cues.before-import.py.txt`; the scratch report is byte for byte the old one).
- [x] gen-root.py run ASIDE (`root-aside/`): it would rewrite the root `data-duration` of 13 scene
      files (all but s02 and s15) and nothing else. Installed only `assets/scenes.js` and `index.html`;
      the 15 scene files keep their sha256 (`backup-pre-voices/before.sha256`).
- [x] mix.py (after gen-root, since sound-kit.mjs loads the scene table): -16.0 LUFS, 5.0 LU, -2.5 dBTP
      by its own report (`mix.txt`). captions.py: 139 captions, 23 sound descriptions, no warning.
      chapters.py and script-md.py after gen-root.
- [x] clock-lint: silent on every scene.
- [ ] check (root, scene files untouched) running: `check-root.txt`. Then check on a copy with the
      durations synced (`root-synced/`), listening copies, logs.
