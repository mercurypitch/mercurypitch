# Merc melody phrase production v6

This immutable batch produces three optional Coda Echo phrases with the
owner-selected **Merc V1 Gentle Whimsical D2** voice:

| Melody       | Words                  | Notes | Selected source |
| ------------ | ---------------------- | ----: | --------------- |
| First arc    | Let it shine           |     3 | `shine-gentle`  |
| Sunlit steps | Tiny sparks can glow   |     5 | `sparks-gentle` |
| Gallery arch | Another beautiful mess |     7 | `mess-gentle`   |

The paid source batch is complete. `batch.json`, `raw/*.json` and `raw/*.pcm`
are immutable request, response and source-byte receipts. `generate.mjs`
reserves a durable receipt before every paid request and refuses uncertain or
duplicate attempts. Do not rerun that paid batch under this revision.

The saved provider voice supplies timbre and articulation. A carrier-free WORLD
pass maps its spectral and aperiodic envelopes onto the same authored contours
used by the guide, visualizer and judge. Unvoiced consonants remain natural.
Sunlit steps retains the source duration around “sparks”; Gallery arch uses a
fully voiced WORLD window for the problematic “ti” nucleus. No hidden detector
carrier is present in shipped audio.

## Final inventory

The candidate grid contains 117 variants: integer roots 48 through 60 at paces
0.8, 1 and 1.25 for all three phrases. Automated acceptance ships 88 variants:

- First arc: 39 of 39;
- Sunlit steps: 39 of 39;
- Gallery arch: 10 of 39;
- total public audio: 3,219,104 bytes;
- largest file: 72,044 bytes.

The public manifest lists only those 88 files. Runtime code requests one exact
key/pace asset only when the player chooses **Hear Merc**. It does not preload
the bank. A missing or rejected variant shows a plain availability explanation,
and **Hear melody** remains the exact instrumental guide for the selected
contour.

`analysis/bank-approved.json` is the canonical delivered inventory, including
the SHA-256 and byte count of every asset. The public
`adventure-voice-v6/manifest.json` mirrors that allowlist. `finalize_bank.py`
removes every rejected or stale MP3, including files from the rejected carrier
experiment.

## Automated evidence

Automated checks establish reproducibility and exercise compatibility. They do
not establish whether the performance is charming or pleasant to hear.

- `analysis/source-selection.json` records the selected raw takes and labels the
  early carrier bank as a rejected experiment.
- `analysis/REJECTED-EXPERIMENTS.md` identifies every retained carrier-era and
  tuning receipt so it cannot be mistaken for release evidence.
- `analysis/bank-full.json` records all 117 carrier-free candidates before
  acceptance filtering.
- `analysis/bank-intelligibility.json` binds every decoded candidate hash to an
  unprompted Whisper base.en transcript. All 88 shipped variants exactly match
  their intended lyric after case and punctuation normalization.
- `analysis/runtime-verification-full-sr24000.json`,
  `runtime-verification-full-sr44100.json` and
  `runtime-verification-full-sr48000.json` bind the delivered hashes to the
  production YIN detector and shared melody judge. All 88 complete with zero
  retries at every rate.
- Each runtime receipt also rejects a two-semitone error, a constant note, full
  silence, a missing middle anchor and a missing final anchor.

The lyrical policy keeps the global 0.18-second dropout default unchanged. Its
Encore-only 0.40-second grace comes from the exact-transcript natural “sparks”
consonant run, measured at 0.36267 seconds at 48 kHz. The 0.12-second per-anchor
evidence requirement prevents a gap from covering unheard notes. The former
stretched 0.768-second gap still resets and was rejected.

## Owner audition

Open `review/index.html` to hear the native-root, Natural-pace representative of
each phrase. The three review MP3s are copies of the hash-verified shipped
assets. Owner listening is still **pending**, especially for lyric clarity,
natural vowels, word stress, whimsical character and resynthesis artifacts in
the seven-note phrase. Automated pitch and transcript checks are not recorded
as perceptual approval.

## Reproduction

Free request validation does not resolve or transmit a credential:

```sh
rtk proxy node art/glass-adventure/voice/v6-melody-phrases/generate.mjs --dry-run
```

In the audio-tooling environment with NumPy, SciPy, librosa, soundfile and
pyworld installed, rebuild and audit the carrier-free bank with:

```sh
rtk proxy python art/glass-adventure/voice/v6-melody-phrases/prepare_bank.py full
rtk proxy python art/glass-adventure/voice/v6-melody-phrases/transcribe_bank.py
rtk proxy python art/glass-adventure/voice/v6-melody-phrases/audit_bank_transcripts.py
rtk proxy python art/glass-adventure/voice/v6-melody-phrases/finalize_bank.py
rtk proxy env MERC_SAMPLE_RATE=24000 node art/glass-adventure/voice/v6-melody-phrases/verify_runtime.mjs
rtk proxy env MERC_SAMPLE_RATE=44100 node art/glass-adventure/voice/v6-melody-phrases/verify_runtime.mjs
rtk proxy env MERC_SAMPLE_RATE=48000 node art/glass-adventure/voice/v6-melody-phrases/verify_runtime.mjs
```

Owner listening remains the final acceptance step after these deterministic
checks.
