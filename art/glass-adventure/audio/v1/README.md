# Glassworks audio masters and auditions

Ten owner-provided Suno WAV downloads were moved from `~/Music` into `masters/` on 2026-09-15. Every copy was hash-verified before its original was removed. Exact original filenames, take identities and SHA-256 hashes are in `intake.json`. Other music files were not moved.

All masters are 48 kHz stereo 16-bit PCM WAV and decode completely. No measured true peak exceeds 0 dBTP. Keep these WAVs as the editable source; no replacement download is needed. This is technical acceptance, not a completed subjective or in-game audition.

`previews/` contains MP3 VBR q2 auditions derived locally from the WAVs. Music targets −20 LUFS and ambience −28 LUFS using a constant volume adjustment only, preserving dynamics. Each encoded preview was fully decoded/measured again. Neither original WAVs nor musical structure were edited.

Original archive: 157,040,798 bytes. MP3 auditions: 18,267,752 bytes. These are saved on disk, not yet committed/pushed or activated in the app.

| Cue | Take | Duration | Original LUFS | Original peak dBTP | Proposed role       |
| --- | ---- | -------- | ------------- | ------------------ | ------------------- |
| A01 | v1   | 0:12     | -21.64        | -5.66              | Open-air bed        |
| A02 | v1   | 0:14     | -15.28        | -4.29              | Garden water        |
| A03 | v2   | 0:14     | -16.42        | -8.03              | Quiet gallery       |
| A03 | v1   | 0:15     | -25.10        | -9.83              | Quiet gallery       |
| M01 | v1   | 2:32     | -15.78        | -3.60              | Main exploration    |
| M02 | v1   | 3:00     | -15.98        | -1.99              | Quiet balcony       |
| M03 | v1   | 2:00     | -16.35        | -3.58              | Playful traversal   |
| M04 | v1   | 1:53     | -16.65        | -3.52              | Welcome/tutorial    |
| M05 | v1   | 0:18     | -17.17        | -4.15              | Completion          |
| M06 | v1   | 3:00     | -16.94        | -3.94              | Future moonlit wing |

## What still needs an audio edit

- Audition M01 and A01 first in the museum; compare the two A03 takes at matched volume. No preferred A03 take has been chosen by file loudness.
- The ambience takes are 12–15 seconds, so choose unobtrusive loop boundaries and crossfades before enabling continuous playback. Their generated dynamic changes may need editing.
- M04 is 1:53: use a short entry excerpt or a quiet tutorial section. M05 is 18 seconds, suitable as a completion cue with a tail; do not repeat the entire cue on every broken vase.
- Check for unwanted voices, hums or distracting motifs by listening; waveform/level checks cannot establish musical fit or prove absence of vocals.
- Before integration, edit loopable lossless derivatives and choose runtime encoding/loop points. MP3auditions are not a guarantee of sample-seamless looping.
- Keep one shared music/ambience owner and fade both out before calibration/listening. Restore softly after mic capture ends. Persist volume/mute; quiet headphone accompaniment remains an explicit player choice.
- Validate transition ramps, pause/app-switch cleanup, rapid encounter switching and real speaker/microphone feedback on tablet and phone.
- The separate S01–S04 short accent suggestions are not among these downloads. All M01–M06 and A01–A03 cues are present; this intake does not cover the entire event-sound brief.

Independent verification repeated all 20 original/preview hashes, WAV format and full decode, MP3 full decode and loudness/peak measurements, cue coverage and every review-page media/source link. All passed. Preview music measures −20.01 to −19.99 LUFS; ambience −28.01 to −27.92 LUFS; maximum preview true peak is −6.02 dBTP. This does not replace listening or device playback acceptance.

## Reproduce auditions

Run `python3 prepare_previews.py` from this directory (or its absolute path); it verifies master hashes and regenerates bounded FFmpeg encodes. Then run `python3 build_review.py`. The review is available through the existing Vite `/@fs/` authoring path and also links from the museum review gallery. No microphone or external service is used.

Full prompt direction remains in the dotfiles `personal/besidecue/glass-adventure/SUNO-AUDIO-PROMPTS.md`. Actual Suno model/settings/take URLs are not yet recorded; the file names establish the owner-supplied cue mapping.
