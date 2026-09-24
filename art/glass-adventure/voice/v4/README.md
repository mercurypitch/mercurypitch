# D2 glass reactions — 2026-09-20

Owner request: keep the selected original Gentle Whimsical D2 voice, add
"Another beautiful mess" and varied short spoken glass reactions with matching
captions. Permanent saved voice: `Merc V1 Gentle Whimsical D2`,
`B4fBPRmasEsTgd6YlSok`. No replacement or additional library identity was made.

| ID                   | Exact line                               |
| -------------------- | ---------------------------------------- |
| beautiful-mess       | Another beautiful mess.                  |
| little-disaster      | A little note. A lovely little disaster. |
| sparkling            | That was positively sparkling.           |
| glass-had-plans      | That glass had plans. So did you.        |
| music-to-my-ears     | Music to my ears. Confetti to my feet.   |
| cracking-performance | Now that was a cracking performance.     |

The original "Gorgeous. Absolutely gorgeous." remains the seventh choice.
Optional breaks draw without replacement; required breaks alternate the
path-open cue with this pool, beginning with the path-open cue. There is no
forced repeat at a deck boundary. The voice preference never suppresses captions.

## Sources and reproducibility

`batch.json` stores exact text, settings and seeds. `generate.mjs --dry-run`
reports the bounded request without contacting the provider. `--generate`
requires an injected credential, verifies the saved voice name, reserves each
receipt before its request and refuses uncertain retries. Completed recordings
are reused only after text and hash verification. Credentials are never saved.

Six successful Eleven v3 requests generated 200 text characters. Raw provider
output is mono 24kHz signed 16-bit PCM; `raw/*.json` records provider request IDs,
settings, source hashes and durations. `masters/` contains equivalent lossless
WAVs. `prepare.py` independently transcribes, checks clipping and exports 128kbps
MP3 without retiming or loudness processing. Runtime MP3s and their manifest live
in `apps/beside-cue/public/games/adventure-voice-v2/`; the authoring PCM/WAVs use LFS.

The initial 44.1kHz request returned HTTP 403 and no audio. Its historical
receipt remains under `raw/rejected-pcm44100/`. The precise error body was not
captured. A bounded 24kHz request succeeded; no provider account changes were
made. Output formats and model settings follow the official
[speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
and [speech model guidance](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech).

## Audio verification

All six recordings decode, have zero clipped source samples and last 2.16–3.2s.
Peaks range from -2.23 to -0.75dBFS. Independent Whisper base.en transcribed five
exactly, ignoring punctuation; it heard "mass" for "mess" on the first. An
independent medium-model pass, also without the expected text, correctly heard
"Another beautiful mess." Both findings are preserved in `audio-audit.json`;
the initial secondary result also remains in `secondary-audit.json`.

This verifies text and signal integrity, not human listening approval of each
new take. The owner can hear the new performances during optional breaks.
Narration still stops before microphone capture and on interruption. Runtime
selection, cancellation and caption tests are in the shared game package.
