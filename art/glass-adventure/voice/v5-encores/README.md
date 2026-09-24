# Merc Coda Echo reference production

Original short words for the existing galleries, using the owner-selected **Merc V1 Gentle Whimsical D2** voice.

| Example                    | Melody       | Notes at native reference range | Final file                     |
| -------------------------- | ------------ | ------------------------------- | ------------------------------ |
| Let light sing             | First arc    | D3–E3–D3                        | `delivery/merc-light-a-v5.mp3` |
| Two small lights come home | Sunlit steps | D3–E3–F♯3–E3–D3                 | `delivery/merc-home-a-v5.mp3`  |

Four ElevenLabs `eleven_v3` auditions were generated from the selected voice. Raw PCM/WAV and request receipts are retained. The A takes provide the original timbre. Forced alignment supplies word boundaries; it is not proof of lyric accuracy.

`export-contours.mjs` compiles the same authored definitions as the game. `prepare.py` uses WORLD spectral and aperiodic envelopes, stretches vowel centers while retaining consonant attacks/releases, and resynthesizes the exact contour. Delivery is mono 24 kHz MP3, normalized to −20 LUFS with a −2 dBTP ceiling and soft onset/release. A lossless master is retained for future tuning. This is authored production audio, not a claim that text-to-speech itself obeys a note score.

## Independent checks

- Whisper.cpp base.en, no text prompt: **“Let light sing.”** and **“Two small lights come home.”** Both agree with the script. Analysis transcripts are archived.
- Decoded delivery MP3 was analyzed with pYIN independently from WORLD resynthesis. At voiced confidence > 0.5, median absolute error is 2.6 cents for each; 95th percentile is 12.6 cents and 7.4 cents. All-frame WORLD reanalysis also remains archived, including low-confidence consonant outliers.
- Peaks of decoded files are −4.76 and −5.81 dBFS. Sizes are 49,196 and 82,604 bytes. Owner listening and taste acceptance remain part of the batch handoff.

The optional **Hear Merc** playback uses his native D3 range and original pacing. The learner's synthesized guide remains calibrated and follows the currently configured shape and pace. That range-adapted guide is paired with the live pitch judge. Hearing either example does not record the player.

Sources: [ElevenLabs v3 prompting](https://elevenlabs.io/docs/best-practices/prompting/eleven-v3), [forced alignment](https://elevenlabs.io/docs/api-reference/forced-alignment/create), [WORLD vocoder](https://github.com/mmorise/World).

## Rebuild

Run `node art/glass-adventure/voice/v5-encores/export-contours.mjs`, then `prepare.py` in an environment with numpy, scipy, soundfile and pyworld plus FFmpeg. Source and deliverable hashes are in `analysis/*-production.json`. Preserve the raw receipts: generation and alignment scripts refuse uncertain or duplicate paid requests.
