# Delivery: Find Your Pitch, Lesson 4, "The major scale and home"

> Draft, 30 October 2026, written while the polish round runs. Every `{fill}` is filled from the
> master that a film critic passes; the rest holds now. It moves to the film's folder as
> `DELIVERY.md` at that point.

{fill: month} 2026. Built in code with HyperFrames 0.8.97 (pinned) on one GSAP timeline; host
performances by the shader Merc (`src/lib/merc`), pre-rendered per performance.

**Master: `renders/{fill: film-NN}.mp4`** (and `{fill}-music-only.mp4`), {fill: m:ss.s}
({fill} s on its cue sheet), 1920x1080 at 60 fps. It passed its last critic round ({fill: critic
FILM-N, SHIP}), which left {fill: the polish items it named}.

**It still speaks with the scratch voices.** The narration is local Kokoro, the build's timing
voice, not the owner's ElevenLabs voices: those are generated only on the owner's yes (DECISIONS
16), and the film is re-timed and re-checked after they are imported (§ At the re-voice). This
master is a picture lock, not the film to publish.

{fill: how many} film critic rounds read it (review/film-01 to {fill}; LEDGER rows 30 to {fill}):
the first found the recall's tiles popping on, an empty frame before the tease, a short end card
with small lower lines, the brackets never laid over each other, the same fall entrance six times,
a floating predict ring, tangled ghost outlines, a small tile stack, the zoom pattern six times
and an unmarked tone rise (DECISIONS 122); the polish round took them by scene group, and Tavi's
two falls became floor-level leaps (DECISIONS 123). {fill: what the later rounds found.}

**A person must listen and watch before it is published:** the voices once they are final
(casting, delivery, lip sync and the pace); the viewer's turn, 6:38 to 6:45, about 7 s of room
tone at -52 LUFS by design: whether it reads as a broken video on YouTube; the whooshes by ear
(they sit over silence in their own band, 640 to 1550 Hz); Merc's D3 count-in and the mix in
general on phone speakers; and the captions against the picture (they are uploaded, never burned
in). {fill: anything the passing critic left for a human.}

## Files

| File | What it is |
| --- | --- |
| `renders/{fill}.mp4` | 1920x1080, 60 fps, H.264, AAC 48 kHz; the master |
| `renders/{fill}-music-only.mp4` | The same picture with the music-only mix: the bed on D, the room tone and the stings |
| `renders/contact-sheet-{fill}.jpg` | One frame every 10 s of the master, in a 6 x 9 grid |
| `captions/lesson-04.en.srt`, `.vtt` | Captions with speaker labels (MERC, TAVI) and sound descriptions; upload, never burn in. Regenerated at the re-voice |
| `captions/chapters.json` | Twelve YouTube chapters from the scene table (`tools/chapters.py`), from "One short of home" at 0:00 to "Next time" at 7:50 on the scratch clock |
| `review/measure-{fill}/` | The measured quality bar for the master |
| `LEDGER.md`, `DECISIONS.md` | Every critic round and every build decision with its reason |
| `lab/entrances/` | Proofs for the host entrances (DECISIONS 86 and 123) |

## Licences and provenance

- **Music and sound effects:** none recorded or licensed. Every musical example, the sung runs,
  the bed (an open fifth on D, FACTS 69), the stings and the whooshes are synthesised in
  `tools/mix.py` at exact frequencies (FACTS 56 to 63 and 67 to 69; every pitch measured from the
  mixer's own output on 29 October, each note within 5 cents). The room tone is filtered noise
  from the same script.
- **Merc's and Tavi's sung notes:** the app demo voice's synthesised "ooh" (FACTS 67), carried from
  Lessons 1 and 2. No Echo samples are used: they hold single notes, and every sung note here
  belongs to a run.
- **Narration (scratch):** Kokoro-82M (Apache-2.0) through kokoro-onnx, model files v1.0, run
  locally and deterministically (`tools/tts.py`): `am_michael` at 0.84 speed for Merc (55 lines)
  and `af_heart` at 0.9 for Tavi (14 lines), 69 lines in `assets/voice/`. **Final:** the owner's
  ElevenLabs voices, "Merc V1 Gentle Whimsical D2" for Merc and "Orange Merc" for Tavi, as in
  Lessons 1 and 2, once the owner says yes.
- **Fonts:** Instrument Serif, Outfit, Inter, JetBrains Mono and Noto Music, all SIL Open Font
  Licence 1.1; licence texts in `assets/fonts/OFL-*.txt`.
- **Brand marks:** `assets/brand/mark.svg` and `lockup-horizontal.svg` from the repository.
- **Host characters:** the shader Merc from `src/lib/merc`, in the same prebuilt bundle as Lesson 2
  (`assets/merc-lib/`, byte for byte: built by Lesson 1's `tools/build-merc.mjs` from the
  repository at `0f82eabed`, the folder last changed in `23be86cd0`). Tavi is the orange look: a
  palette plus a build-time swap of the shader's cool light constants; the app's source is
  untouched. The passes render on Chromium 1194; the two re-rendered for the leaps on 30 October
  (m06a, m06b) ran under Playwright 1.56.1 on the same browser.

## Generation ledger

No generated images or video. The only generated media is the scratch narration:

| Model | Voices | Settings | Lines | Accepted |
| --- | --- | --- | --- | --- |
| Kokoro-82M via kokoro-onnx (local, deterministic; the build's scratch voice) | am_michael (Merc), af_heart (Tavi) | per-line WAV, word times and loudness envelope (`tools/tts.py`), in `assets/voice/` | 69 lines (55 Merc, 14 Tavi) | timing voice until the re-voice |
| {fill at the re-voice: ElevenLabs Eleven v3} | D2 (Merc), Orange Merc (Tavi) | {fill: as Lesson 2's import} | 69 lines | {fill} |

## What was measured

{fill from `review/measure-{fill}/summary.md` and `audio.md`, and the passing critic:}

- **The check:** `hyperframes check` (0.8.97): {fill} errors before the `--strict` render.
- **Holds:** {fill} s inside the film, {fill} per 30 s, the longest {fill} s; frame 0 is a finished
  composition. (film-01: 11.4 s, 0.7 per 30 s, the longest 0.5 s at 4:30.2; no final hold.)
- **Loudness:** {fill} LUFS integrated, loudness range {fill} LU, true peak {fill} dBTP. (film-01:
  -16.0 LUFS, LRA 5.2 LU, -1.5 dBTP; stereo sample peak 0.839, nothing clips.)
- **Effects against the music:** five whooshes (69.1, 145.8, 229.0, 341.0 and 405.2 s on the
  scratch clock), in 640 to 1550 Hz; in full band about 2 to 3 dB over the pad and about 5 dB
  under the voice median (film-01). The pad sounds only in transitions and pauses, never under
  narration. `audio.md`'s "harsh" flags are not usable here: the music-only render holds the bed
  alone, so all narration counts as effects there.
- **Pitches** (film-01, spot-tracked): `stop-c` C4 to B4 within 4 cents; `stop-d` and `land-d` D4 to
  C♯5 to D5; `sing-a` D3 to C♯4; `sing-b` from D4; all within about 9 cents. {fill}
- **Text:** {fill: contrast range}; every on-screen claim is in FACTS.md, including the tier order
  (lesson fact 24) and the credits; the end card holds complete for {fill} s.

## How {fill} was made

Run in `output/motion/lesson-04/` on {fill} (UTC).

1. The clock, the scenes, the passes, the sound and the captions:

   ```bash
   TTS_PYTHON=<tts-venv>/bin/python <tts-venv>/bin/python tools/cues.py --no-tts
   python3 tools/gen-root.py && python3 tools/merc-shots.py
   PLAYWRIGHT_MODULE=<playwright 1.56.1>/index.mjs node tools/merc-pass.mjs merc/shots/<id>.json
   python3 tools/merc-whole.py && python3 tools/merc-tags.py <scene ids>
   TTS_PYTHON=<tts-venv>/bin/python <tts-venv>/bin/python tools/mix.py
   python3 tools/captions.py && python3 tools/chapters.py && python3 tools/script-md.py
   ```

2. The check, then the master in 1,500-frame pieces with a seam check, the music-only version,
   the contact sheet and the measurements (the director's `render-l4.sh`, in the pack's tools):

   ```bash
   HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1 npx --yes hyperframes@0.8.97 check
   WORKERS=2 setsid nohup bash render-l4.sh {fill} 60 high <frozen copy> >/dev/null 2>&1 &
   ```

   The script renders with `HF_SEGMENTED_CAPTURE=true` into `/dev/shm`, two workers (four, and
   once three, were killed by the 13.4 GiB memory cap on 30 October), and re-renders any piece whose first
   frames were captured before its seek landed (`seamcheck.py`: a fresh browser that jumps
   straight to a piece's start; film-01's pieces 9 and 10 needed it). {fill: its time and frames.}

## At the re-voice

What changes when the owner's voices replace Kokoro, in order:

1. Generate the 69 lines on the owner's account, one take a line, text exactly as `script.json`
   (ElevenLabs spends credits: never repeat a request to retry), and import them as Lesson 2 did.
2. Lengthen the end sting in `script.json` from 5.0 to 6.5 s (DECISIONS 122): S16 grows to about
   6.7 s and the complete end card, whole 1.32 s into S16 since the polish round, holds 5.38 s,
   past the 5 s the film critic asked for.
3. Re-time: `tools/cues.py`, then `tools/board-clock.py` maps every storyboard time to the new
   clock; the scenes read their times from the cue sheet, so no scene types a second.
4. Re-render every Merc pass whose span moved (`merc-shots.py`, then `merc-pass.mjs` and
   `merc-whole.py`), the m12 pair included, then `merc-tags.py` for every scene.
5. `mix.py`, `captions.py`, `chapters.py`, `script-md.py`; the check; a new master through
   `render-l4.sh`; a fresh film critic round to SHIP; then this file again.
