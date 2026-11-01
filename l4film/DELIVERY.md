# Delivery: Find Your Pitch, Lesson 4, "The major scale and home"

October and November 2026. Built in code with HyperFrames 0.8.97 (pinned) on one GSAP timeline;
host performances by the shader Merc (`src/lib/merc`), pre-rendered per performance.

**Master: `renders/film-06.mp4`**, 9:11.2 (551.205 s on its cue sheet), 1920x1080 at 60 fps, with
the owner's ElevenLabs voices. It passed its last critic round (FILM6, SHIP, 1 November), which
left only optional polish: the hosts' falls from the top edge at 1:09.1, 2:51.0, 4:46.0 and 6:35.0
(decisions 130 and 137 keep them: a fall opens a chapter, and the owner asked for none to change);
the practise card's glow on "Singing Voice Range" and its gear's small pulse, 8:46.7 to 8:47.6; the
recall's swap and its 0.3 s hold at 0:52.6; and the title's blur at 0:39.7 with five like push-ins
(1:29.6, 2:22.0, 3:34.8, 4:39.2 and 5:15.6). Its one condition was the length, past the brief's
9:00: the owner allowed up to 10 minutes on 17 October ("The film can be up to 10 min it's fine no
need to cut stuff"), so nothing is cut.

**The voices are the final ones.** Merc speaks with "Merc V1 Gentle Whimsical D2", as in Lessons 1
and 2, and Tavi with Lessons 1 and 2's Orange Merc designed again in this workspace (DECISIONS
138). The owner reviewed film-04, the picture lock on the scratch voices, and called it great
(DECISIONS 137); film-05 brought the final voices and the re-time to their pace, 1:06.5 longer;
film-06 adds the holds round. The owner's ear check of Tavi's recreated voice against her
Lesson 2 takes is still open.

Six film critic rounds read it (review/film-01 to film-06; LEDGER rows 30 to 35): the first found
the recall's tiles popping on, an empty frame before the tease, a short end card with small lower
lines, the brackets never laid over each other, the same fall entrance six times, a floating
predict ring, tangled ghost outlines, a small tile stack, the zoom pattern six times and an
unmarked tone rise (DECISIONS 122); the polish round took them by scene group, and Tavi's two
falls became floor-level leaps (DECISIONS 123). The second found the same fall seven times, the
end card complete for only 4.1 s, the tease's bead dropped at the cut, a minute at one wide
framing with a small subject and the fixed-do pill slicing its own words; the second round made
every return within a chapter a leap, carried the bead into the end card, pushed in on S6 and
widened the pill before its words roll (DECISIONS 130 to 133). The third found a hard-edged box in
the floor under each host in S12 and S13, the two hosts falling 3 frames apart, the end card still
4.1 s and the pill's roll unclipped; the director's round ran the floor to the frame's edge, let
Tavi fall first, held the sting and the card 1 s longer and clipped the roll (DECISIONS 134 and
135). The fourth marked the floor and the end card fixed and passed the picture lock (DECISIONS
136). The fifth, on the final voices, found the boards sitting still through the longer voiced
lines (25.7 s of holds, three over 0.5 s) and the practise card's line shifting as its phrase
grew; the holds round gave the boards a slow drift or settle through long lines and marked the
phrase with a glow (DECISIONS 139). The sixth marked both fixed and passed the film (DECISIONS
140).

**A person must listen and watch before it is published:**

- **The voices:** whose they are, and whether these takes are approved. By ear: Merc's "doh" at
  5:56.4 (speech recognition hears "daw"); the spliced "G. Doh" at 8:35.0 (0.30 s of silence cut
  in after "G."); Tavi's "home" at 0:27.9 in her first question (heard as "Ho"); and whether her
  questions at 2:57.0, 3:54.1 and 6:17.2 sound like questions.
- **The viewer's turn,** 7:33.8 to 7:42.4: 8.6 s of room tone at -53 dBFS by design, after Merc's
  D3 count-in (7:32.8). Whether it reads as a broken video on YouTube.
- **Phone speakers:** the whooshes (they sit over silence in their own band), the count-in and the
  mix in general.
- **The captions** against the picture: they are uploaded, never burned in, and must stay clear of
  the care block.
- **The floor** under the hosts in S12 and S13 on an OLED phone and after YouTube's encoding: a
  dark gradient is where an encoder bands.
- **The end:** the sting decays to room tone by 9:09.0, so the complete card's last 2.2 s are
  near-silent; whether that reads as an ending or as a gap.
- **The loop seam** jumps (21.65 on the frame-change scale). It matters only if a page ever loops
  the film.

## Files

| File | What it is |
| --- | --- |
| `renders/film-06.mp4` | 1920x1080, 60 fps, H.264, AAC 48 kHz; the master, with the final voices. sha256 `5481187b50a14193f2d771f0269de1630456678f0579474b5168f8798fceb344` |
| `film-06-music-only.mp4` (not on disk) | The same picture with the music-only mix: the bed on D, the room tone and the stings. The disk is full, so it was kept in memory, and the container restart of 1 November (12:07) cleared it; it is made again from the master in seconds, into any folder with room: `ffmpeg -i renders/film-06.mp4 -i assets/audio/music-only.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -movflags +faststart film-06-music-only.mp4` |
| `renders/contact-sheet-film-06.jpg` | One frame every 10 s of the master, 0:00 to 8:50, in a 6 x 9 grid |
| `renders/film-05.mp4` | FILM5's master (ONE MORE PASS), the final voices before the holds round; kept to compare. Its music-only was in memory and went with the restart of 1 November; the same command with `film-05.mp4` makes it again (its sound is byte-identical to film-06's) |
| `renders/film-04.mp4`, `film-04-music-only.mp4` | The picture lock on the scratch voices (FILM4, SHIP), which the owner reviewed; kept to compare |
| `captions/lesson-04.en.srt`, `.vtt` | Captions with speaker labels (MERC, TAVI) and sound descriptions, on the final voices' clock: 123 captions, at most 20.0 characters a second; upload, never burn in |
| `captions/chapters.json` | Twelve YouTube chapters from the scene table (`tools/chapters.py`), from "One short of home" at 0:00 to "Next time" at 8:55 |
| `review/measure-film-06/` | The measured quality bar for the master. Its frame sheets were moved to memory to free the disk and went with the restart of 1 November; `measure.py render` makes them again |
| `review/film-06/` | The passing critic's report (FILM6), its crops and dense sheets |
| `feat/lesson-04-films` (GitHub) | A branch that holds only the films, in Git LFS, never merged: film-04, film-05 and film-06 (bfd8196) with their sha256, to download. GitHub holds every object, but downloads fail while the organisation's LFS budget is spent |
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
- **Narration:** the owner's ElevenLabs voices, generated with Eleven v3 on the owner's account
  (31 October 2026): "Merc V1 Gentle Whimsical D2" (`B4fBPRmasEsTgd6YlSok`) for Merc, as in
  Lessons 1 and 2, and "Tavi - Orange Merc (recreated)" (`nIlUZMilnuQseg9riG4H`) for Tavi. Tavi's
  voice is Lessons 1 and 2's "Orange Merc" designed again, from the same description, in the
  workspace the connector reaches (DECISIONS 138; the measurements are in
  `voice-elevenlabs/README.md`). The scratch takes they replace, Kokoro-82M (Apache-2.0) through
  kokoro-onnx (`tools/tts.py`: `am_michael` for Merc, `af_heart` for Tavi), are kept in
  `assets/voice-kokoro/`.
- **Fonts:** Instrument Serif, Outfit, Inter, JetBrains Mono and Noto Music, all SIL Open Font
  Licence 1.1; licence texts in `assets/fonts/OFL-*.txt`.
- **Brand marks:** `assets/brand/mark.svg` and `lockup-horizontal.svg` from the repository.
- **Host characters:** the shader Merc from `src/lib/merc`, in the same prebuilt bundle as Lesson 2
  (`assets/merc-lib/`, byte for byte: built by Lesson 1's `tools/build-merc.mjs` from the
  repository at `0f82eabed`, the folder last changed in `23be86cd0`). Tavi is the orange look: a
  palette plus a build-time swap of the shader's cool light constants; the app's source is
  untouched. The passes render on Chromium 1194 under Playwright 1.56.1. On 31 October every pass
  whose shot moved with the final voices' clock was rendered again: the 16 shots `merc-shots.py`
  rewrote and the five intros' tall segments, 21 passes. m08-orange-in's shot did not move.

## Generation ledger

No generated images or video. The only generated media is the narration:

| Model | Voices | Settings | Lines | Accepted |
| --- | --- | --- | --- | --- |
| Kokoro-82M via kokoro-onnx (local, deterministic; the build's scratch voice) | am_michael (Merc), af_heart (Tavi) | per-line WAV, word times and loudness envelope (`tools/tts.py`), now in `assets/voice-kokoro/` | 69 lines (55 Merc, 14 Tavi) | the timing voice to film-04; replaced |
| ElevenLabs Eleven v3 | D2 (Merc), Tavi - Orange Merc (recreated) (Tavi) | one take a line, text exactly as `script.json`; trimmed to Kokoro's edges and set to -22.8 LUFS by `voice-elevenlabs/import.py`; word times by forced alignment; every request in `voice-elevenlabs/ledger.jsonl` | 69 lines (55 Merc, 14 Tavi); 71 requests, 4,744 credits | all first takes, but two: b52's first take with 0.30 s of silence cut in after "G." (`voice-elevenlabs/b52-gap.py`), and o2's retake |

## What was measured

From `review/measure-film-06/summary.md` and `audio.md`, and the passing critic (FILM6):

- **The check:** `hyperframes check` (0.8.97): 0 errors on the integrated project before the render
  (65 warnings, the build's baseline); clock-lint silent; `merc-tags.py` 68 tags, none stale.
- **Holds:** 8.2 s inside the film in 63 short runs, 0.4 per 30 s, the longest 0.4 s; frame 0 is a
  finished composition. The end card keeps moving to the last frame (a slow push and the hosts'
  idles), so there is no final hold. (film-05: 25.7 s, 1.4 per 30 s, the longest 0.9 s; film-04:
  11.9 s, 0.7, 0.5 s.) The holds round's drifts add 22 weak single-frame events, whole-pixel steps
  that each change at most 0.17 % of the pixels.
- **Loudness:** -16.0 LUFS integrated, loudness range 5.5 LU, true peak -2.4 dBTP; film-05's to the
  decimal, as the sound is unchanged (the decoded difference under -121 dBFS). (film-04, on the
  scratch voices: -16.0 LUFS, 5.2 LU, -1.5 dBTP.)
- **Effects against the music:** five whooshes (1:18.1, 2:49.4, 4:22.4, 6:33.6 and 7:43.8) over a
  silent bed, +23.9 to +26.4 dB in their band; their loudest 50 ms sits 14 to 16 dB under the
  narration, and their 2 to 8 kHz peak about 16 dB under the voice's. The bed sounds in the pauses
  where it belongs (-28 to -33 dBFS) and is room tone (-53 dBFS) under narration and in the
  viewer's turn (FILM5). `audio.md`'s "harsh" flags are not usable here: the music-only render
  holds the bed alone, so all narration counts as effects there.
- **Pitches** (film-01, spot-tracked): `stop-c` C4 to B4 within 4 cents; `stop-d` and `land-d` D4 to
  C♯5 to D5; `sing-a` D3 to C♯4; `sing-b` from D4; all within about 9 cents. Not re-tracked since:
  the re-time moved the notes in time, and no note's pitch has changed.
- **Text:** every text passes the check's 4.5:1 audit; the smallest text measured 9.1:1 in film
  round 3, and FILM6 measured the "still hanging?" label at 14.4:1. Every on-screen claim is in
  FACTS.md: the practise card's path and its phone line (FACTS 85), the credits (FACTS 81) and the
  tier order (lesson fact 24); the ladder is labelled "Illustration". The end card is complete from
  9:06.0 to the last frame, 9:11.2.

## How film-06 was made

Run in `output/motion/lesson-04/` on 31 October and 1 November 2026 (UTC).

1. The final voices, the clock, the passes, the sound and the captions:

   ```bash
   cd ../voice-elevenlabs
   python3 ledger_sync.py <session transcript.jsonl>
   python3 fetch.py <session transcript.jsonl> ledger.jsonl takes
   <tts-venv>/bin/python b52-gap.py takes
   <tts-venv>/bin/python import.py ../lesson-04 takes
   cd ../lesson-04
   TTS_PYTHON=<tts-venv>/bin/python <tts-venv>/bin/python tools/cues.py --no-tts
   python3 tools/gen-root.py && python3 tools/merc-shots.py
   PLAYWRIGHT_MODULE=<playwright 1.56.1>/index.mjs node tools/merc-pass.mjs merc/shots/<id>.json [--tall --until=44]
   python3 tools/merc-whole.py && python3 tools/merc-tags.py <scene ids>
   TTS_PYTHON=<tts-venv>/bin/python <tts-venv>/bin/python tools/mix.py
   python3 tools/captions.py && python3 tools/chapters.py && python3 tools/script-md.py
   ```

2. The holds round (below) in `compositions/s05` to `s11` and `s14`, then the check, clock-lint and
   `merc-tags.py --check`.

3. The master in 1,500-frame pieces with a seam check, the music-only version, the contact sheet
   and the measurements (the director's `render-l4.sh`, with `mem-guard.sh` beside it, which
   moves the render to one browser if memory nears the cap):

   ```bash
   HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1 npx --yes hyperframes@0.8.97 check
   KEEP_MB=50 WORKERS=2 setsid nohup bash render-l4.sh film-06 60 high <frozen copy> >/dev/null 2>&1 &
   bash mem-guard.sh film-06 <frozen copy> <pgid of render-l4.sh>
   ```

   The script renders with `HF_SEGMENTED_CAPTURE=true` into `/dev/shm` and re-renders, on one
   browser that is never recycled, any piece whose first frames are wrong (`seamcheck.py`).
   film-06 is 33,073 frames, frozen at 04:20. The main pass ran 04:22 to 06:52 on two browsers
   with no memory kill (the peak about 11.3 GB of the 13.4 GiB cap, the renderer's extract cache
   included). The seam check found the first frames of pieces 6, 11 and 20 blank or half painted,
   a recycled browser capturing before the page painted; the repair re-rendered pieces 5, 6, 10,
   11, 19 and 20 by 08:06, and every seam was clean. The music-only version, the contact sheet and
   the measurements were done at 08:24. The master went onto disk, checked byte for byte, and onto
   `feat/lesson-04-films` before the critic read it.

## The re-voice (31 October)

What changed when the owner's voices replaced Kokoro, in order (DECISIONS 137 and 138):

1. The 69 lines, generated on the owner's account one take a line, the text exactly as
   `script.json`: 71 requests, 4,744 credits. Tavi's voice is Lessons 1 and 2's Orange Merc
   designed again in this workspace and measured against her 20 original takes
   (`voice-elevenlabs/README.md`). b52 keeps its first take, with 0.30 s of silence cut in after
   "G." (`b52-gap.py`); o2 keeps its retake. `import.py` trims each take to Kokoro's edges, sets it
   to -22.8 LUFS and times its words by forced alignment (`ctc_align.py`).
2. Decision 136's two fixes went in first: S12's floor strip comes up with each host's fall and is
   full on the landing frame, and the pill's roll fades at its rim (DECISIONS 137).
3. The re-time: `tools/cues.py --no-tts` made the film 551.205 s (9:11.2), 1:06.5 longer; speech is
   902 words in 397.2 s. The scenes read their times from the cue sheet, and `board-clock.py` maps
   the storyboard to the new clock. The end sting stays 6.0 s in a 6.2 s S16.
4. 21 Merc passes rendered again (above), then `merc-whole.py` (one row: m09-orange's first whole
   frame 28 to 29) and `merc-tags.py` for every scene (68 tags, none stale).
5. `mix.py`, `captions.py`, `chapters.py`, `script-md.py`; the check (0 errors, 65 warnings); stills
   of the S12 falls, the floor and the end card; film-05 through `render-l4.sh`; FILM5, ONE MORE
   PASS for the holds the longer lines left.

## The holds round (1 November)

FILM5 found the boards sitting still through the longer voiced lines. Two builders applied the
study's rule 8 ("never still") without moving anything the voice or the sound cues, a scene's first
or last frame, or any handoff (DECISIONS 139 and 140):

- S5 to S8: slow sideways camera creeps (at most 30 px, eased), labels that settle where Tavi is in
  frame, and a slower tally fade in S8 from the same start.
- S9 to S11: the same kind of slow drift and settle through their long lines.
- The practise card: "Singing Voice Range" is marked by a glow instead of growing from its left
  edge, so the centred line stays put, and the gear fades in at full size.

Holds in the film went from 25.7 s to 8.2 s, the longest from 0.9 s to 0.4 s.
