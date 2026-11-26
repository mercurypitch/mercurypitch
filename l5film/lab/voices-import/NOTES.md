# Importing Lesson 5's final voices: the proofs (brief `briefs/l5-voices-import.md`)

The log of record is DECISIONS 246 to 256, `tools/CHANGES.md` (26 November) and the last row of
`LEDGER.md`. This folder holds what those cite. Nothing here is read by the film.

| File | What it is |
| --- | --- |
| `calibration.txt` | `tools/ctc_align.py --calibrate`: the aligner against Kokoro's own word times on the 71 scratch takes, as aligned and as placed (DECISIONS 247) |
| `proofs.py`, `proofs.txt` | `tts.calibrate` on the aligner's times against `ctc_align.place` on the final takes: the eight word starts it sets on a stop inside the word before; how late the aligner marks the word after a clear pause, by voice (DECISIONS 247, 248) |
| `moves.py`, `moves.txt` | every word start `place` moves more than 0.13 s on the final takes, with the envelope from the placed time on: each is a soft start (DECISIONS 248) |
| `look.py`, `look/` | takes looked at closely: the trimmed waveform's edges, the envelope, the word times against the envelope's onsets (o1, o4, o13, o9; b52, b42, b1, b29, b34) |
| `import-all.txt` | `tools/import.py` on all 71 |
| `cues-no-tts.txt` | `tools/cues.py --no-tts`: the pacing report as printed |
| `root-aside/` | `tools/gen-root.py` run on copies: `gen-root.txt` lists the 13 scene files whose root `data-duration` it would write; only its `assets/scenes.js` and `index.html` went into the film (DECISIONS 252) |
| `root-synced/` | a copy of the project with those 13 numbers written (assets linked), for `check` |
| `check-root.txt`, `check-root-synced.txt` | `hyperframes check` on the film as it stands and on that copy: the same result |
| `snap/` | stills at 265.0, 265.37 and 266.2 s: the layout note is S9's title mid-swap |
| `mix.txt`, `captions.txt`, `chapters.txt` | those tools' output on the voiced clock |
| `before/cues.before-import.py.txt` | `tools/cues.py` before its heading change |

Elsewhere: `backup-pre-voices/` (the clock, sound, captions, root and voice folder before the work,
with `before.sha256`); `voice-takes/IMPORT.md`, `ASR.md` and `import.json` (the import's reports);
`tools/ctc-calibration.json`; `models/w2v/`.

To check the scene files are as they were:
`sha256sum compositions/*.html | diff - <(grep ' compositions/' backup-pre-voices/before.sha256)`.
