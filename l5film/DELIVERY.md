# Lesson 5, "Breath and a steady note": delivery

27 November. The final run is DECISIONS 257 to 269; its notes are in `lab/final-run/NOTES.md`.

## The files

| What | Path | Details |
| --- | --- | --- |
| The film | `renders/film-final-60.mp4` | 569.750 s (9:29.75), 1920x1080, 60 fps, 34,185 frames, H.264 High (yuv420p, BT.709), AAC 192k at 48 kHz stereo, 157 MB |
| The music-only version | `renders/film-final-60-music-only.mp4` | the same picture, stream for stream, with `assets/audio/music-only.wav`: the bed, the room tone and the stings. It has no voice and none of the effects (ticks, whooshes, Merc's landings, chimes); `tools/mix.py` defines this mix. It was muxed onto the one joined picture, not rendered a second time (DECISIONS 269). |
| Contact sheets of the final film | `review/final-measure/sheet-01.jpg` to `sheet-05.jpg` | one frame every 5 s, each stamped with its time |
| A frame from every scene | `review/final-film/scenes-sheet.png` | the middle frame of each of the 15 scenes, with frame numbers; full-size frames beside it |
| Frame 0 | `review/final-measure/frame-0.png` | the finished cold open: the kicker, the A3 band, both hosts on the floor |
| Captions | `captions/lesson-05.en.srt`, `captions/lesson-05.en.vtt` | on the final voices' clock (the import regenerated them, DECISIONS 251 to 256); the speaker named where the host changes, sounds in brackets |
| Chapters | `captions/chapters.json` | 0:00 "One push", 0:56 "How loud to sing", 1:10 "What pushing does", 1:48 "What the diaphragm does", and on through the film |
| The passes' contact sheet | `review/merc/contact-sheet.png` | the hosts' 27 final passes at 60 fps, as the scenes show them |

## Licences

- **Music and effects.** Everything you hear apart from the voices is generated in code by
  `tools/mix.py`:
  - the bed on A and the room tone;
  - every sung note and example, at its exact pitch on the contour the picture draws;
  - the ticks, one whoosh an act, Merc's two landings, and the chimes.

  No music or sound was downloaded or licensed (FACTS 79 to 81, 96 to 98). The Echo samples the
  sound kit carries serve only `sing` events, which this film does not use.
- **Fonts**, all under the SIL Open Font License 1.1, with their licence texts beside them in
  `assets/fonts/`: Inter (`OFL-Inter.txt`), Outfit (`OFL-Outfit.txt`), Instrument Serif
  (`OFL-InstrumentSerif.txt`), JetBrains Mono (`OFL-JetBrainsMono.txt`) and Noto Music
  (`OFL-NotoMusic.txt`). They are embedded in the render only as rendered pixels.
- **Brand.** The MercuryPitch mark and lockup (`assets/brand/`) are the product's own.
- **The hosts.** Merc and Tavi are rendered from the project's own Three.js character
  (`assets/merc-lib/`, `tools/merc-pass.mjs`). No image or video model was used.

## The voice generation ledger

- **Who and how.** The owner's two ElevenLabs voices, both in the owner's workspace: Merc is
  "Merc V1 Gentle Whimsical D2" (`B4fBPRmasEsTgd6YlSok`) and Tavi is "Tavi - Orange Merc
  (recreated)" (`nIlUZMilnuQseg9riG4H`). The model was Eleven v3 (`eleven_v3`). Each line had
  one take (generations_count 1), and its prompt was exactly the line's text from `script.json`.
  No generation was repeated.
- **The counts.** 71 takes: Merc 56 lines (4,757 characters), Tavi 15 (883). They cost 5,640
  credits in all, over two flows. They were generated on the owner's yes on 26 November.
- **The record.** `voice-takes/ledger.jsonl` has one row per call (line, flow, node, session,
  credits). The rest is in `voice-takes/BATCH.md` (the batch and every line's text) and
  `voice-takes/IMPORT.md` (the import, the take edges and the clock).
- **Nothing generated in this run.** The final run itself called no generation service: no
  voice, music, image or video.

## What was measured

All measured on `renders/film-final-60.mp4` unless named.

- **`hyperframes check`** (before the pieces): 0 errors and the 24 standing warnings (Merc's
  reflection tags read as duplicate media, as before). Runtime and motion are clean, contrast is
  67 of 67 at WCAG AA, and there is one layout note: two words overlap at 265.37 s in S9 ("A
  catch").
- **Frames.** There are 34,185 frames. Each join of the 19 pieces was compared two ways
  (`review/final-film/joins.md` and `joins/straddle/`):
  - Against the same renderer rendering straight through each join: no join repeats, skips or
    shifts a frame.
  - Against a single-frame snapshot of the root: in camera moves the snapshot itself sits up to
    about 2 px off, so the snapshot cannot settle this one.
- **Holds** (`review/final-measure/summary.md`, by scene in `holds-by-scene.md`): 12.3 s inside
  the film, which is 0.6 s per 30 s. The longest is 0.5 s, at 444.20 s in s12-your-turn, and no
  other hold is over 0.4 s. There is no final hold. S8 and S9 run at about 1.2 s per 30 s and
  S15, the end card, at 2.9; every other scene is under 0.8.
- **Single-frame events.** None among the strongest; 28 weaker ones are in `events.csv`.
- **Loudness.** -16.0 LUFS integrated, loudness range 5.0 LU, true peak -2.6 dBTP. 426 to 434 s
  read about -52.7 LUFS: that is the viewer's ten-second hold in S12, silent by design.
- **The effects against the music** (`measure.py audio`, `review/final-measure/audio/`). The
  music-only version leaves out the voice as well as the effects, so this measure reads every
  line the hosts speak as an "effect over silence". Its rows are the voice, not a finding on the
  effects. The effects against the music were measured on the stems in the sound step
  (`review/sound-01/`) and not again here.
- **Memory and time.** The picture was rendered in pieces, each a fresh process with one browser,
  which took 4,890 s. At most 8.61 GiB of the 13.7 GiB memory cap was used.

## What a person should still watch or listen to

- **The whole film once, end to end, at 60 fps with sound.** No critic has seen this render: it
  was measured, not reviewed.
- **The hosts' final passes in motion.** These are new in this run and were checked on stills
  only:
  - the breath in before Merc's `gauge`, `listen` and `twinkle` and Tavi's `demo` and `listen`;
  - both hosts breathing in with the viewer in `breathe` (422.8 to 423.7 s);
  - the blinks after the voice;
  - S14's hosts at 300 px into S15's end card (546 to 569 s).
- **The voices, by ear.** The import found 15 take edges where the service cut while the voice
  was still sounding (`voice-takes/IMPORT.md`), and 22 lines whose words its speech check heard
  differently (`voice-takes/ASR.md`; o4, b42, b47, b48 and o12 first).
- **The effects' balance, by ear.** The measure here cannot separate the effects from the voice
  (see above).
- **The low-motion runs that measure.py lists** in `summary.md`. Most are a small element moving
  (a thin line drawing, the hosts' talk), which the mean change hides. A critic should look at
  the long ones:
  - 380.0 s, 18.1 s (S11's long listen);
  - 459.4 s, 16.6 s (S12);
  - 399.5 s, 14.7 s (S12's start);
  - 307.7 s, 11.3 s (S10);
  - 437.9 s, 9.9 s (S12).
- **S9's overlap note at 265.37 s**: the words "A catch" and the word beside it.
