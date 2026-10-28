# Find Your Pitch: production pipeline

How a lesson becomes a film and a web page, as built on Lesson 1 (all 17 Merc passes and all 21
scenes built; the full-film critic rounds and the delivery render are still to come). The film
follows the repository's `motion-designer` skill (`.claude/skills/motion-designer/SKILL.md`):
HyperFrames compositions on one seekable GSAP timeline, a fresh `motion-critic` after every stage,
a measured quality bar. This file records what a teaching film adds to that pipeline.

The Lesson 1 project is `output/motion/lesson-01/` (gitignored, per the skill's house rules). Its
`tools/` and `assets/lib/` are the seed of the reusable film kit planned for Phase 1. Its documents
(brief, facts, script, storyboard, handoffs, build guide, decisions, captions) are kept in this
repo in `lessons/01-what-is-a-note/`; where the compositions and tools live is MASTER-PLAN § 12
item 2.

## 1. The project layout

```
output/motion/lesson-NN/
  BRIEF.md  FACTS.md  STORYBOARD.md  HANDOFFS.md  BUILD-GUIDE.md  DECISIONS.md  LEDGER.md
  script.json            the typed script: lines, sung notes, examples, pauses, marks
  cues.json              generated: every event on one clock
  index.html             generated: one host per scene + the soundtrack
  compositions/sNN-*.html  one sub-composition per scene, local timeline
  assets/
    cues.js scenes.js    generated timing for the compositions
    lib/                 the scene kit (lesson.js, lesson.css, glyphs.js, fonts.css.txt)
    fonts/  brand/  vendor/gsap-3.14.2.min.js
    merc-lib/            the film's Merc bundles (blue, orange)
    merc/                rendered Merc performances (<pass>-merc.webm)
    voice/               per-line narration + loudness envelopes
    audio/               full.wav, music-only.wav, stems
  merc/shots/*.json      generated Merc performances
  captions/              SRT and VTT
  tools/                 the pipeline (below)
  lab/<scene>/           lab stills and clips per scene
  review/critic-NN/      one folder per critic round
  renders/               drafts and masters
```

## 2. Steps and commands

Toolchain: Node 22, FFmpeg with `ebur128`, `tblend`, `signalstats`, `scdet`, Python 3 (a venv with
`kokoro-onnx`, `soundfile`, `numpy` for voice and audio), pinned `hyperframes@0.8.97` with
`HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1`. Run the skill's smoke test once per
session.

| #   | Step              | Command                                                                                                                                                               | Output and gate                                                                                                                             |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scaffold          | `npx --yes hyperframes@0.8.97 init output/motion/lesson-NN --non-interactive`; copy the kit; fetch OFL fonts from `google/fonts` with their licences                  | Director block appended to the project's CLAUDE.md and AGENTS.md                                                                            |
| 2   | Brief and facts   | write `BRIEF.md`, `FACTS.md`                                                                                                                                          | Every claim sourced (code beats PRODUCT.md beats CHANGELOG beats BRAND)                                                                     |
| 3   | Script            | write `script.json`                                                                                                                                                   | Script critic: true, teachable, every orange line a deep question or sincere guess; voice lessons: the vocal coach signs off                |
| 4   | Voice and clock   | `python tools/cues.py`                                                                                                                                                | Per-line WAV and loudness envelope; `cues.json`; pacing report (target 140 to 165 wpm while speaking)                                       |
| 5   | Sound             | `python tools/mix.py`                                                                                                                                                 | `full.wav`, `music-only.wav`, stems; examples at exact pitch; bed only in act transitions, silent under narration and examples              |
| 6   | Scenes table      | `python3 tools/gen-root.py`                                                                                                                                           | `assets/scenes.js`, `index.html`, placeholder scenes so the film always renders                                                             |
| 7   | Storyboard        | write `STORYBOARD.md`, `HANDOFFS.md`                                                                                                                                  | Fresh critic, fix, verification critic (Lesson 1 took two rounds plus a third set of fixes)                                                 |
| 8   | Merc performances | `python3 tools/merc-shots.py` then `node tools/merc-pass.mjs merc/shots/*.json`                                                                                       | One straight-alpha WebM per performance; render in the background while scenes are built                                                    |
| 9   | Scenes            | builders, in parallel, each owning contiguous scenes; static Merc `<video data-merc>` tags timed by `python3 tools/merc-tags.py`; `node tools/lab.mjs <scene> --clip` | Each scene proven by a lab render (not a snapshot); `merc-tags.py --check` and `check` at 0 errors                                          |
| 10  | Captions          | `python3 tools/captions.py`, then `python3 tools/chapters.py`                                                                                                         | SRT and VTT with sound descriptions in the gaps; `chapters.json` from the scene table (never typed by hand: it goes stale on every re-time) |
| 11  | Render            | `npx --yes hyperframes@0.8.97 render --fps 60 --quality delivery --strict`                                                                                            | Measured with `scripts/measure.py render`; fresh critic per round to SHIP                                                                   |
| 12  | Deliver           | master, music-only mux, contact sheet, captions, LEDGER, DELIVERY                                                                                                     | Owner review; voice lessons: the vocal coach signs off the film and page                                                                    |

## 3. Decisions a teaching film adds to the skill

- **Pacing.** The kit's 12 to 15 compositions per 30 s is a launch-film number. A teaching film
  runs 4 to 8 layout changes a minute, with a visual event every 2 to 5 s tied to the word that
  names it (within -0.2 to +0.1 s), and nothing longer than about 6 s without one. A diagram may be
  held while it is explained, but something inside it always moves (no still stretch over 0.5 s;
  a dressed "predict" pause of at most 3 s per chapter is allowed).
- **One clock.** Scenes, Merc performances, the mix and the captions key off cue names in
  `cues.json`, never off typed seconds. A re-voiced line re-times the film: run steps 4 to 8 and
  10 again.
- **Narration pacing.** Kokoro speaks fast at speed 1.0 (180 to 236 wpm); speeds 0.84 (blue) and
  0.9 (orange) plus authored gaps give about 164 wpm while speaking and 117 overall. Long lines
  are split into phrase events so the picture can land on a word.
- **Merc.** Pre-render each performance once (`merc-pass.mjs`), from the cue sheet
  (`merc-shots.py`): he sings on his sung cues (full sound arcs), talks on his lines (mouth from the line's loudness,
  arcs at half strength), and idles, turned towards the speaker, while the other Merc speaks or
  sings. Only the Merc making the sound shows arcs (trap 14). Each performance is ONE straight-alpha VP9 WebM
  (`<id>-merc.webm`) with alpha = max(A, R, G, B) over his premultiplied colour, so his bloom and
  floor light survive and he composites correctly in any moved, scaled or faded layer; each scene
  holds static `<video data-merc>` tags timed by `tools/merc-tags.py` (trap 4). Always force
  `format=rgba` in the ffmpeg graph: left to negotiate, ffmpeg once dropped the alpha. (The earlier
  matte plus `plus-lighter` light-pass pair is abandoned: it is exact only when nothing above it
  creates a stacking context, so a camera layer turned it into a black square.) The orange Merc's
  warm floor light comes from a build-time swap of the shader's hard-coded cool constants
  (`build-merc.mjs`), never an edit of `src/lib/merc`. Measured cost per frame on a 4-core CPU
  with SwiftShader at `medium` (Lesson 1, `merc/render.log`); the other plan files cite this table.
  Its first column is the encoded frame that `render.log` prints, which at `medium` is three
  quarters of the shot file's `size` (`src/lib/merc/constants.ts`): a shot of `size` 640 encodes
  at 480 x 480. A builder sets the shot `size`, so read the table by its shot column, not by the
  frame column.

  | Encoded frame | Shot `size` | CPU                    | Seconds per frame | Lesson 1 passes                    |
  | ------------- | ----------- | ---------------------- | ----------------- | ---------------------------------- |
  | 225 px        | 300         | alone                  | 0.26              | m19                                |
  | 270 to 315 px | 360 to 420  | alone                  | 0.47 to 0.62      | m03, m14, m17                      |
  | 360 to 420 px | 480 to 560  | alone                  | 0.64 to 0.85      | m01, m06, m18-duo, m21             |
  | 480 px        | 640         | alone                  | 1.08              | m18                                |
  | 390 px        | 520         | shared by seven agents | 1.5 to 2.3        | m10                                |
  | 390 px        | 520         | shared                 | 1.24 to 1.28      | m10-blue crescent-guard re-renders |
  | 315 px        | 420         | shared                 | 2.13              | m03-blue re-render                 |

  Sharing the CPU costs up to four times as much: alone, 390 px ran at 0.71 to 0.76 s (m18-duo,
  m21) and m03-blue at 0.54 s, against 1.24 to 2.3 s and 2.13 s shared. The cause is the shared
  CPU, not the container restart before m10: m14, m17, m18, m18-duo, m19 and m21 ran after the same
  restart at the solo speeds above.

- **Frame rate.** 60 fps master, and Merc at 60 fps too: passes on twos read as a stutter beside
  the 60 fps picture (Lesson 1, critic 05). `merc-shots.py` snaps every pass to the film's frame
  grid and `merc-tags.py` times the tags in whole frames, so film frame n shows pass frame n - P
  exactly, across cuts too. The closing passes run a little past their scene, so the hosts never
  drop out on the film's last frame (trap 15).
- **Audio.** Every musical example is synthesised at its exact frequency in `mix.py`. Merc's sung
  notes are the app's Echo "ooh" set: ElevenLabs takes re-pitched onto exact contours, development
  placeholders that the app withholds from its store build (`src/features/echo/merc-voice-set.ts`);
  the two-voice tune (s17) uses the app's synthesised "ooh" (`src/lib/demo-voice.ts`). The owner
  holds the Echo samples' rights, so they stay until a voice actor replaces them (MASTER-PLAN § 12
  item 1). The bed is a quiet open-fifth pad in the key that plays only in
  act transitions and under the dressed pauses (predict, hum, quiz), where critic 03 found the mix
  silent; its open fifth on the lesson's note also supports the hum. It is silent under narration and under every musical
  example: `mix.py` mutes it around every `line`, `sound` and `sing` cue, merging windows closer
  than 1.2 s so it never pumps between lines. In Lesson 1 it sounds under the title (22.5 to 26.0
  s), the predict pause, the hum pause and the three quiz pauses, measured from the bed stem. One soft whoosh per act change. Muting the bed left
  digital silence between lines (78 stretches in Lesson 1's rc-04, critic 06), so a room tone runs
  under the whole film in both mixes: pink noise from 150 to 3000 Hz at -55 LUFS, 37 LU under the
  voice and pitchless (trap 17). A music-only render is not needed: the music-only mix muxed onto
  the same picture is identical by construction.
- **Quality bar additions.** Two measured checks join the skill's quality bar. The bed is silent
  inside every spoken line and musical example (the bed stem's RMS is zero there); Lesson 1 passes
  (measured).
  And a colour-blindness gate: a Machado et al. (2009) simulation (protan, deutan, tritan, severity
  1.0) and CIEDE2000 over the full palette (the series code, the pitch-canvas set, both Merc
  bodies), with the worst case recorded beside the canvas set's 12.4
  ([research/production-research.md](research/production-research.md)). Pitch-canvas scenes use
  the app's canvas set; the series code governs explanatory diagrams (MASTER-PLAN § 5).
- **Captions.** Upload the SRT; never burn full captions into the long form (redundancy). Keep the
  bottom 17 % of every frame free of essential content. `tools/captions.py` holds the limits and
  warns on a breach:
  - at most 42 characters a line and two lines a caption;
  - at most 20 characters a second, and at least 5/6 s on screen;
  - the short speaker label, the host's name ("MERC:", "TAVI:"), only when the speaker changes,
    and the same names in a sound ("[Tavi sings an A, 440 Hz]"), never a colour (owner, 24
    October 2026). The tool wrote colour labels ("BLUE:", "[orange Merc ...]") for Lessons 1
    and 2, whose captions in this repository were renamed by hand, so it must write the names
    before either film is re-cut: their film-sync tests fail on a colour label.
- **Voices.** The scratch voice is local Kokoro; the final voices are the owner's ElevenLabs
  voices, Blue as D2 ("Merc V1 Gentle Whimsical D2") and Orange as "Orange Merc", Eleven v3, one
  take a line (October 2026: 133 lines for both lessons, 6,743 credits). The director's tools are
  in `output/motion/voice-elevenlabs/`:
  - every request names its line ("Lesson N line ID") so `ledger_sync.py` rebuilds the ledger from
    the session, and `fetch.py` downloads the takes within their two-hour links;
  - a local Whisper checks each take against the script; it hears number words as digits and
    "cents" as "sense", so a mismatch is a prompt to listen, not a verdict;
  - `import.py` writes each line's WAV at Kokoro's edges and loudness, its envelope and, where the
    lesson keys words, its word times, and keeps the Kokoro takes in `assets/voice-kokoro/`;
  - then `tools/cues.py --no-tts` re-times the film; a line listed in `_elevenlabs.json` is never
    re-spoken;
  - the two voices live in different ElevenLabs workspaces, and the connector reaches one at a
    time;
  - a voiced film runs longer than its Kokoro estimate (Lesson 2: 6:33 scratch, 7:11 voiced at
    2.43 words a second); the owner allows up to 10 minutes.
- **Captions and chapters travel with the film.** A re-cut that re-times it (every re-voice does)
  regenerates both, and the page's copies in `src/features/lessons/lesson-NN/assets/` change in
  the same commit as the lesson's `captions/` folder and the new MP4s; `film-sync.test.ts` holds
  the two copies equal.
- **Parallel builders.** A build guide, a shared kit, exact handoff frames between builders, and
  scene files owned by one builder each. Lab renders per scene (`tools/lab.mjs`: a temporary
  project hosting one scene, with the soundtrack offset to it) prove each scene alone.

## 4. Traps found on Lessons 1 and 2

1. CSS `url('../fonts/...')` in a stylesheet fails HyperFrames' lint
   (`invalid_parent_traversal_in_asset_path`): inline the `@font-face` rules in the root with
   root-relative paths.
2. A Merc pass that shows as a black square in `snapshot` or `render` lost its alpha in encoding
   (see the `format=rgba` note above), not in the preview: correctly encoded passes composite in
   both, with or without `--no-proxy`. Check a pass before blaming the renderer: `ffprobe` must
   show the tag `alpha_mode=1` (it reports `pix_fmt=yuv420p` even for a good alpha VP9), and a
   frame decoded with `-c:v libvpx-vp9` must have transparent corners.
3. A missing video file breaks `check` and `render` on HyperFrames 0.8.97
   (`missing_local_asset`), which it did not on earlier versions. Build scenes before their Merc
   passes exist all the same: lab renders set `HF_VIDEO_EXTRACTION_FAILURE_MODE=observe` and
   `HF_VIDEO_COVERAGE_THRESHOLD=0`, and the root `check` reaches 0 errors only once every pass
   exists.
4. HyperFrames finds videos by parsing the HTML before any script runs (the producer's
   `parseVideoElements`), and reads their timing from the static `data-start`, `data-duration` and
   `data-media-start`. A `<video>` created by a script plays in the browser preview and renders as
   nothing. So every Merc pass is a static tag in its scene (`data-merc="<pass>"`), timed from the
   cue sheet by `tools/merc-tags.py`; the kit's `L.merc()` only adopts and places it. A script may
   move a static video into any wrapper: the renderer injects its frames by id.
5. `hyperframes snapshot` does not show videos inside sub-compositions, only root-level ones. Prove
   a scene with Merc in it with a lab render (`node tools/lab.mjs <scene> --clip`).
6. Sub-compositions run on local time; a `<video>` inside one keeps local `data-start`.
7. CSS blending is limited to the nearest stacking context (any transform, opacity below 1, filter
   or isolation): see the Merc note above.
8. The workflow tool runs at most two agents at once on a 4-core machine; long parallel builds use
   separate background agents.
9. Merc on SwiftShader costs from about a quarter of a second (a 225 px frame, shot `size` 300)
   to about a second (480 px, shot `size` 640) per frame at `medium`, and up to four times that
   when other agents share the CPU (the table in § 3): start his performances early.
10. The shader can paint an opaque black crescent along Merc's crown for one frame at the top of a
    fast stretch (hop take-off, celebrate), at any quality (seen in 5 of Lesson 1's 17 passes,
    every hop). `merc-pass.mjs` guards each frame: more than 40 opaque near-black pixels in the
    top 40 % of the frame means it re-renders that frame at a time nudged by up to 12 ms. The
    renderer bug itself is in `src/lib/merc` and in the app too (MERC-BIBLE backlog).
11. A cloud container can restart mid-production and stop every background process (renders,
    builders). Files survive. Keep long jobs resumable: one output file per Merc pass, written only
    when complete, so a restarted queue needs only the passes that are missing or empty. A
    session's own background commands are also stopped after two hours, and a long Merc
    performance (Lesson 2's m14 duo, 7,499 frames at size 520) takes longer than that: start render
    queues detached (`setsid nohup`), skipping every pass whose WebM is newer than its shot file.
    A detached `hyperframes render` cancels itself within seconds (`render_cancelled_parent_exited`:
    it watches every ancestor process it saw at start) unless `HYPERFRAMES_RENDER_DETACHED=1` is set.
12. Dimmed text fails contrast. Ghosting a diagram by lowering the opacity of the whole group
    takes its labels under 4.5:1 (Lesson 1's quiz and dimmed panels, 2.2 to 3.4:1, found only in
    its fifth film round; Lesson 2's ghosted pads, found on its storyboard). Dim strokes and fills,
    never labels: every settled label stays at 4.5:1 or better, or is hidden while its group is dim.
13. measure.py does not see small motion. A 2 % drift measures as a hold for much of its length,
    and a glow or halo pulse registers for only 0.1 to 0.4 s of its 0.75 s (Lesson 2, storyboard
    critics 07 and 08, measured on mock clips). Count motion as measure.py registers it: a tile
    or key scaling 5 %, a bar or large label scaling 15 to 20 %, an echo ring, a large lit area,
    or a camera move by its speed (at least about 8 px a second). Give a long diagram stretch a
    lead move, such as a 120 to 150 px pan under the pulses (motion principle 3), and check a
    mock or lab clip with measure.py before building on a guess. Budget about 1.8 s of holds per
    30 s for a clip with no Merc in it.
14. A host who listens can look as if he is talking. The `listen` state draws arcs at Merc's side
    and closes one eye, and with the sound off the listener read as the speaker (Lesson 1, critics
    05 and 06). Only the Merc making the sound shows arcs.
15. A pass that ends with its scene drops out of the film's last frame, the one an embed holds
    when it stops (Lesson 1, critic 06). Run the closing passes past the end.
16. esbuild looks for a `tsconfig.json` above each file it bundles. The generated entry file sits
    in the film project, so the Merc bundle came out with a leading `"use strict";` inside the
    repository and without it anywhere else. `build-merc.mjs` names the tsconfig, so the bundle no
    longer depends on where the project lives.
17. A bed muted to exactly zero around speech leaves digital silence between lines: a room tone
    under the whole film keeps the soundtrack alive (§ 3, Audio).
18. An ElevenLabs take can end with a lone click after up to two seconds of silence (2 of 133).
    Trimming at the last sample above 1 % of the peak keeps the silence; `import.py` treats a blip
    under 60 ms, 0.3 s or more from the speech, as no sound.
19. Whisper's word times are not good enough to time picture. On Lesson 1's scratch takes,
    against Kokoro's own phoneme times, Whisper small.en's word starts were about 0.19 s early
    with as much spread again, even after calibration on the envelope; Lesson 2's word anchors sat
    about 0.2 s before their words until this was found. Forced alignment of the script's own
    words (`voice-elevenlabs/ctc_align.py`, wav2vec2-base-960h as ONNX) plus the same calibration
    matches to 5 ms for the median word and 60 ms for nine in ten.
20. A film timed as "a cue plus seconds" does not follow a re-voice. Lesson 1's scenes held 300
    times inside lines, measured on the scratch voice; with the final voices a third of them would
    have landed 0.2 s or more off their words. `voice-elevenlabs/resync.py` moved 109 numbers,
    keeping each time's distance from the nearest word start, after a read of every long sum (a
    fade's length must not stretch). Lesson 2 keys every time inside a line to a word (`word()`),
    and followed both its re-voices without a hand edit: key every time inside a line to a word.
21. A re-voice can leave a line too short for a caption of its own (Lesson 1's "Is it?", 0.58 s,
    under the 5/6 s minimum). `captions.py` lets the next caption start up to 0.1 s late, and
    joins a too-short line to the same speaker's next line when they fit together.
22. A re-time can move a moment `check` passed before onto its sample times. Lesson 1's recap deck,
    fanned so each ticket covers part of the next, failed layout (`content_overlap`) only at rc-07.
    Mark layering that is meant with `data-layout-allow-overlap` on each text block involved; it is
    not inherited, so a wrapper does not cover its children.
23. A Merc pass's drop starts above its own square. For about 0.45 s at its start (Lesson 2's m13
    and m14, frames 0 to 27 at 60 fps; m05, frames 7 to 36) the frames hold only part of the body,
    cut off by the square's top row, and no mask hides the edge. Keep the box, pass and reflection,
    at opacity 0 until the first frame with the whole body inside the square, then fade it in over
    3 frames. Count that frame from the tag's `data-start` alone: HyperFrames 0.8.97 extracts from
    the keyframe before `data-media-start`, so the render can show a frame one earlier than the
    tag's times suggest (Lesson 2, film critics 11 and 12).
24. A scene that guards `L.merc()` with its own idea of a tag's id fails silently when the ids
    differ. Lesson 2's closing scenes looked for `s14-sing-m14-duo-blue` while the tag was
    `s14-m14-duo-blue`, so `L.merc()` never ran and the four videos sat unplaced at the frame's
    top left, orange on top, with blue's sound arcs round her. Pass the tag ids to `L.merc()`
    (`video`, `reflVideo`) and let it report a missing tag; a clearance check of each Merc's box
    against every text (`lab/s13-cents/merc-clear.mjs`) catches the rest (critic 11).
25. A shared label push must keep each label on one side of its obstacle for the label's whole
    life. A push straight out of each obstacle reverses when the obstacle's centre crosses the
    label: it threw "+25 Hz" 83 to 177 px in one frame, five times in half a second (critic 11).
26. `check`'s layout stage treats a video's whole square as opaque, and reads a `tspan` at
    `fill-opacity` 0 as visible text. Mark a label beside Merc `data-layout-allow-occlusion` only
    where the pixels show the square is transparent there, and set hidden text to opacity 0
    outside its stretch.
27. On four CPUs, Lesson 2's 7:11 film renders in 27 minutes as a 30 fps draft (`--quality looks`)
    and in 55 to 61 minutes as a 60 fps release candidate (`--quality high`). The first film round
    can read the draft; each later round costs an hour of render before its critic starts.

## 5. The web lesson

Built from the same sources: the written lesson (`lessons/NN-<slug>/LESSON.md`), the facts, the
captions (VTT track and transcript), the film (HLS at 1080p30 from the master,
`tools/web-video.sh`), the colour code and type, and a shared toy kit (Phase 1). Lesson 1's page is
a single HTML file: sound gate, predict-then-reveal opener, step deck with live toys (vibration,
loud versus high, octave fit, spiral to keyboard) that double as the Playground, misconception card,
sung checkpoint (hum along with Merc, unscored: nothing listens; to be scored, sing it back on "ooh"
in Voice Mirror), quick check (four questions), Wrap, the episode with chapters and captions, and
the lesson explorer (Season 1 and the trailer; Lesson 1 ready, the rest planned).

Where it lives: Lesson 1's page was built first as a private preview page, the proof preview only, and
the no-iframe rule in its contract (WEB-SPEC) binds only that preview. The public lessons live at
`mercurypitch.com/learn/NN` (MASTER-PLAN § 12 item 9), on the same origin as the app's analytics,
accounts and `?lesson=` marker, built by the Phase 1 Lesson host track, whose exit is Lesson 1
served at its public URL with CTAs carrying `?lesson=01`. The episode plays there from R2 (§ 12
item 7): an MP4 at 1080p and a 720p copy for phones, cut from the delivery master. Until #1193
quiz answers stayed in the viewer's browser; now each question's first answer in a visit is an
anonymous `lesson_answer` event (MASTER-PLAN § 9).

Checks before publishing: phone (390 px) and desktop widths in light and dark, keyboard focus, no
sideways scroll, every audio button user-initiated, and motion. The stage budget is landscape, not
only a phone's: beside the text the stage is stuck under the masthead, so every step's stage must
fit a tablet in its browser, 1024 x 640 with the masthead, where a stuck stage has 564 px. The kit
gives the figure what the rest of its toy leaves (`kit/stage-fit.ts`), down to 180 px, or to the
`--viz-min` a lesson's stylesheet sets for a drawing that collides with itself any lower (a readout
in its corner, a label per semitone). So keep a toy's chrome, its stage less the figure, under
about 375 px at 1133 px wide; a stage still over budget scrolls inside itself, by 60 px at most.
`src/e2e/learn-stage-fit.spec.ts` holds every built lesson to it at four short landscape sizes, and
on a phone held sideways (844 x 390). Under `prefers-reduced-motion` the Merc idle loops freeze
(`setPaused(true)` or a still frame), and the staff vibration and the spiral's drift stop; a
visible "Pause animations" toggle in the masthead lets anyone stop them (WCAG 2.2.2). The shared
toy kit's contract carries both rules.
