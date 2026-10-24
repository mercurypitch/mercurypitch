# MercuryPitch premium tutorial series: production research

Date: 2026-10-16. Scope: one web lesson page plus one 4 to 6 minute YouTube explainer per
lesson, built in code with HyperFrames 0.8.97, hosted by blue Merc and orange Merc
(pre-rendered WebGL2 passes), narrated with local Kokoro-82M.

Method: read the HyperFrames skills bundled with the pinned CLI and the matching
domain skills at the `v0.8.97` tag on GitHub; ran the CLI help; ran catalog
queries; built three probe projects and rendered them on this machine (4-core Xeon
2.1 GHz, 15.7 GB RAM, software GL); timed Kokoro on this CPU; read primary sources
(YouTube Help, Hugging Face, Creative Commons, W3C, peer-reviewed papers) and a few
secondary ones where no primary source exists (flagged as such). Nothing in
`/home/user/mercurypitch` was modified.

Probe artefacts (all in the scratchpad):

- Blend-mode probe: `(session scratchpad, not kept)/hf-probe/blendtest` and `.../hf-probe/blendtest2`
- 1080p render benchmark: `(session scratchpad, not kept)/hf-probe/benchtest`
- Registry probe (oscilloscope, WebGPU sine wave): `(session scratchpad, not kept)/hf-probe/regtest`
- CLI help dumps: `(session scratchpad, not kept)/hf-probe/help-clean.txt`, `.../hf-probe/docs-out.txt`, `.../hf-probe/catalog-queries.txt`, `.../hf-probe/catalog-all.json`
- Kokoro timing and voice samples: `(session scratchpad, not kept)/research/tts-bench/` (eight WAVs) and `.../research/tts_bench.py`
- Palette tools: `(session scratchpad, not kept)/research/palette.py`, `.../research/opt_anchored.py`, `.../research/final_palette.py`

---

## 0. Decisions in one page

1. **HyperFrames can carry a 4 to 6 minute narrated explainer**, but its narrative
   workflows (`/faceless-explainer` and friends) are tuned for 30 to 90 s and cap at
   about 3 minutes. Route lesson films through `/general-video` (or the repo's
   `motion-designer` skill, which already drives HyperFrames) and borrow the
   faceless-explainer taste references only.
2. **Merc compositing works, with one trap (verified by render).** A VP9 WebM with
   alpha composites correctly, and `mix-blend-mode: plus-lighter` on the light pass
   adds exactly (measured within 3/255 of the arithmetic sum). But if the light video
   sits inside a wrapper that GSAP transforms, the wrapper becomes an isolated group
   and the light pass's black paints over the background as an opaque rectangle. Put
   the blend mode on the transformed wrapper itself, one wrapper per pass (section 1.4).
3. **Render cost is modest.** Measured 1080p30 throughput with four Merc-sized video
   layers, SVG and text: about 11 frames per second (27 to 29 s per 10 s of film),
   so one full 5-minute 1080p30 render takes about 14 minutes; 60 fps doubles it.
   The expensive step is the Merc raymarch (about 1 s per frame), not HyperFrames.
4. **Ship at 30 fps** unless Merc passes are also rendered at 60 fps. A 30 fps Merc
   plate in a 60 fps film shows each Merc frame twice against 60 fps GSAP motion.
   The repo's motion-designer skill defaults to 60 fps deliverables, so this needs an
   explicit decision.
5. **Captions:** upload an SRT (generated from the script, so it is word-perfect) to
   YouTube for the long-form film; burn captions only into the Shorts cutdowns. Keep
   the bottom 18 percent of the long-form frame free of key content so YouTube's
   closed captions never cover a diagram (`hyperframes check --caption-zone`).
6. **Voice:** Kokoro-82M weights are Apache-2.0 and its voices ship in the same
   repository, so commercial use is allowed. Only `af_heart` (A), `af_bella` (A-),
   `af_nicole` and `bf_emma` (B-) grade above C; every male English voice is C+ or
   lower. Kokoro at speed 1.0 talks fast (180 to 236 wpm measured); use speed about
   0.75 to 0.85 and explicit pauses to land near 150 to 170 wpm. Treat Kokoro as the
   scratch and pilot voice, and budget a paid human cast (or a paid ElevenLabs plan)
   for flagship episodes.
7. **Dialogue is pedagogy, not decoration.** Muller et al. (2008) found a
   student-tutor dialogue that voices and then corrects misconceptions produced an
   effect size of 0.83 over a plain exposition. Give one Merc the plausible wrong
   idea and the other the correction.
8. **Music:** synthesise every musical example in code at exact pitches; use no
   library music, or a bed you synthesise yourself. That removes Content ID risk,
   keeps the web page and YouTube licences identical, and matches the repo rule "no
   recorded music unless cleared". Salamander Grand Piano notes may be used (CC BY
   3.0) with attribution in the description and on the page.
9. **Packaging:** YouTube's own intro metric is retention at 30 s; hook inside the
   first 15 to 30 s; chapters (first 00:00, at least three, each at least 10 s); end
   screen in the last 5 to 20 s; up to three title and thumbnail variants in Test &
   Compare (winner chosen by watch time share).
10. **Accessibility:** a 7-colour concept palette for `#0d1117` that keeps the app's
    own pitch colours (reference amber, user violet), with every colour at 6.1:1 to
    16.0:1 contrast and a minimum CIEDE2000 separation of 12.4 under simulated
    protan, deutan and tritan vision (section 6.2).

Estimated per-episode machine time on this 4-core box: 3 to 5 hours, mostly
unattended (Merc pre-render 0.5 to 1.5 h, renders 1 to 2.5 h, everything else
minutes). Estimated human-plus-agent effort: 2 to 3 days for the first episodes,
about 1 day once the scene and Merc clip libraries exist (section 7).

---

## 1. HyperFrames capabilities for a 4 to 6 minute explainer

### 1.1 What is installed and what was verified

- CLI: `hyperframes@0.8.97` (Apache-2.0, `heygen-com/hyperframes`). `doctor` reports
  0.8.162 is available; the pin is the contract, so stay on 0.8.97 and record any
  upgrade deliberately (the repo's `motion-designer/references/hyperframes-bridge.md`
  says the same).
- Environment: Node 22.22, FFmpeg 6.1.1, Chrome Headless Shell 152, 4 cores,
  15.7 GB RAM, 26.6 GB disk free, `/dev/shm` 16 GB. Docker is installed but not
  running. `whisper-cpp` is not installed (transcription would use Parakeet after
  `hyperframes models install parakeet`, or whisper after building it).
- GPU: the browser probe reports "WebGL unavailable" on the host GPU and falls back to
  software (SwiftShader). Capture path observed: `beginframe capture, software gpu`
  (the fast capture path).
- The bundled skills at `/root/.npm/_npx/f293411582888030/node_modules/hyperframes/dist/skills/`
  hold only `hyperframes` (router), `hyperframes-cli` and `media-use`. The technical
  contract (`hyperframes-core`, `-keyframes`, `-audio`, `-registry`, `-studio`) is
  lazily installed by `hyperframes skills update`, which must not be run here. I read
  those files directly from the matching tag instead, e.g.
  <https://raw.githubusercontent.com/heygen-com/hyperframes/v0.8.97/skills/hyperframes-core/SKILL.md>.
- `hyperframes docs <topic>` prints short inline docs (`data-attributes`, `rendering`,
  `compositions`, `gsap`, `troubleshooting`, `examples`) and needs no install.

### 1.2 The composition contract (rules that cost a render when missed)

From `hyperframes-core` (v0.8.97) and the repo's bridge notes:

- A composition is HTML whose root carries `data-composition-id`, `data-width`,
  `data-height` and (for the root) `data-duration`. **Render length is the root's
  `data-duration`**, read once at compile time, not the GSAP timeline's length.
- Exactly one `gsap.timeline({ paused: true })` per composition, registered at
  `window.__timelines["<root id>"]`, registered only after the build finishes (an
  async build inside `document.fonts.ready` is fine; register at the end).
- Timed elements carry `data-start`, `data-duration` and `class="clip"`. Never tween
  `visibility`, `display` or `autoAlpha` on a `.clip`; animate a child.
- Never pair a CSS `transform` with a GSAP tween of the same property (lint
  `gsap_css_transform_conflict`); use `fromTo`. A later `fromTo` on the same target
  needs `immediateRender: false`.
- Determinism: no `Date.now()`, `performance.now()`, unseeded `Math.random()`,
  network fetches at render time, input state, or `repeat: -1`.
- No `<br>` in body text; transformed elements must be block-level and sized.
- Keep every `id` unique across the assembled page (prefix sub-composition ids).
- A lint error silently switches off the layout and contrast audits (`check` then
  reports 0 samples), so clear lint errors before trusting `check`.
- `data-hidden` hides an element in preview and render non-destructively.

### 1.3 Structure for a long piece: sub-compositions and one root

- Build each scene as a sub-composition (`<div data-composition-src="compositions/scene-03.html" data-composition-id="scene-03" data-start=... data-duration=...>`).
  Templated sub-composition files must keep their `<style>` and `<script>` inside
  the `<template>`; give host slot, template and timeline key the same id. The
  runtime auto-nests child timelines. A sub-composition timeline cannot animate
  host-root elements.
- **One root per project.** `check` fails a project with more than one root-level
  composition (`multiple_root_compositions`), and render-time `--variables` do not
  reach the audio mix. So every variant (9:16 Short, music-only version, a language
  version) is a sibling project, as the bridge doc already prescribes.
- `hyperframes timeline --json` lists every clip with absolute start and end
  (nested rows included); use it instead of reading every scene file.
- Variables (`data-composition-variables` on `<html>`, `data-var-text`,
  `data-var-src`, `window.__hyperframes.getVariables()`) let one scene file serve
  several lessons (lesson number, title, key, target note). `render --batch rows.json`
  renders one output per row, useful for title cards, chapter cards and thumbnails.
- Studio conventions (`hyperframes-studio`): one caption track
  (`data-track-kind="captions"`), one element kind per track, every scene a
  sub-composition; safe boxes are action-safe 90 percent and title-safe 80 percent.

### 1.4 Video element handling and Merc compositing (verified)

Rules (from `hyperframes-core/references/variables-and-media.md`):

- Video frames are extracted by FFmpeg ahead of capture and injected; HyperFrames owns
  playback. Do not call `play()`, `pause()` or seek in code.
- `<video>` must be `muted playsinline`; sound always lives on a separate `<audio>`
  element with an `id` (an id-less `<audio>` is silently dropped from the mix).
- Never put `data-start` on both a `<video>` and a plain wrapper ancestor (lint error
  `video_nested_in_timed_element`); sub-composition hosts are exempt.
- Do not animate timed media dimensions; animate a non-timed wrapper.
- Never add `crossorigin`. Do not reuse the same `src`/start/duration twice in one
  composition (lint warning `duplicate_media_discovery_risk`); give each copy its
  own file.
- `--video-frame-format png` is available; alpha-capable sources always extract as
  PNG. Extracted frames go to a content-addressed cache
  (`/tmp/hyperframes-extract-cache-0`), so re-renders skip extraction (`extract 0.0s`
  on the second run). The benchmark's 1,536 extracted frames took 128 MB; a real
  episode with about 18,000 Merc-plate frames should need a few GB. `hyperframes clean`
  reclaims it; `--frames-cache-dir` relocates it.

**Probe 1: does a VP9 alpha matte plus an additive light pass composite correctly?**
I encoded a 640x360 VP9 WebM with alpha (`alpha_mode=1`, an orange disc on
transparent) and an opaque VP9 light pass (a grey Gaussian glow on black), placed
them over a `#0d1117` background, once with `mix-blend-mode: plus-lighter` and once
with `screen`, and rendered with `render --quality looks`.

| Pixel                    | Expected (plus-lighter) | Rendered plus-lighter | Rendered screen |
| ------------------------ | ----------------------- | --------------------- | --------------- |
| Disc plus light 73       | (255, 201, 73)          | (252, 198, 72)        | (252, 162, 71)  |
| Disc plus light 120      | (255, 248, 120)         | (254, 245, 117)       | (254, 184, 118) |
| Background plus light 16 | (29, 33, 39)            | (27, 31, 37)          | (27, 31, 37)    |
| Background only          | (13, 17, 23)            | (12, 16, 22)          | (12, 16, 22)    |

Conclusion: alpha is respected at the disc edge, `plus-lighter` is a true additive
blend within YUV rounding, and `screen` behaves as screen. Use `plus-lighter` for an
additive-light pass rendered on black.

**Probe 2: the stacking-context trap.** Any element with a `transform` (which every
GSAP `x`/`y`/`scale` tween sets) or `opacity < 1`, `filter` or `isolation: isolate`
creates a stacking context, and stacking contexts are isolated blend groups. Result
on a `#2a3a55` background:

| Layout                                                                                   | Background pixel             | Light-only pixel      |
| ---------------------------------------------------------------------------------------- | ---------------------------- | --------------------- |
| A: one GSAP-moved wrapper holding matte and light; blend mode on the inner light video   | (0, 0, 0), background erased | (16, 16, 16)          |
| B: matte and light each in their own GSAP-moved wrapper; blend mode on the light wrapper | (42, 58, 84), correct        | (57, 73, 99), correct |

Pattern to use for every Merc instance:

```html
<div class="merc-matte" id="blue-matte-wrap">
  <!-- GSAP moves this -->
  <video
    id="blue-matte"
    class="clip"
    src="assets/merc/blue-talk-matte.webm"
    data-start="12"
    data-duration="6"
    muted
    playsinline
  ></video>
</div>
<div
  class="merc-light"
  id="blue-light-wrap"
  style="mix-blend-mode: plus-lighter"
>
  <!-- same GSAP tween -->
  <video
    id="blue-light"
    class="clip"
    src="assets/merc/blue-talk-light.webm"
    data-start="12"
    data-duration="6"
    muted
    playsinline
  ></video>
</div>
```

Tween both wrappers with one tween (`tl.to(["#blue-matte-wrap", "#blue-light-wrap"], ...)`)
so they never drift apart, and never fade a Merc with `opacity` on a common parent
(that also isolates the group); fade each wrapper, or fade by dimming the light pass
and the matte separately. Do not put the Merc pair inside an element with a filter,
a backdrop-filter or a non-1 opacity.

A sibling research note (`research/merc-assets.md`, section 2.4) independently warns
that straight-alpha exports lose Merc's bloom and floor light; the matte-plus-light
split solves exactly that, and Probe 1 shows HyperFrames reassembles it correctly.

### 1.5 Audio

- Mixing is declarative: `data-volume` (1 = 0 dB, up to 3.98 = +12 dB),
  `data-fade-in` / `data-fade-out`, a `data-automation` volume lane for ducking and
  envelopes, audio groups, and a "voiceover carve" (`data-fx-carve`, strength 0.8
  default) that dips the music bed in the voice's bands instead of ducking the whole
  bed (`hyperframes-audio` SKILL). A carve targets a group of voice clips, never
  individual clip ids, and never a voice track.
- `hyperframes normalize-audio --reference <id> --target <id> --write` matches one
  clip's loudness to another by integrated LUFS.
- The mix is extracted from the authored HTML, not from runtime state, so
  render-time variables cannot change audio.
- HyperFrames does not master the final loudness. Measure the render with FFmpeg
  `ebur128` and apply a two-pass `loudnorm` to the audio stream only, copying the
  video: target about -14 LUFS integrated, true peak at most -1 dBTP (YouTube's
  playback reference has been measured at -14 LUFS since 2019, and quieter uploads
  are not turned up; this is not officially documented:
  <https://meterplugs.com/blog/2019/09/18/youtube-changes-loudness-reference-to-14-lufs.html>).
- The bundled narration standard for HyperFrames' own docs films is useful as a
  benchmark: 145 to 155 wpm "with room to breathe", music bed around -31 LUFS, never
  masking the voice (`media-use/audio/references/tts.md`).
- Bundled SFX (21 files: whoosh, click, pop, chime, riser, impact and so on) are from
  Pixabay under the Pixabay Content License (`media-use/audio/assets/sfx/CREDITS.md`);
  usable commercially without attribution.

### 1.6 Captions authoring in HyperFrames (burned-in)

From `media-use/audio/references/captions/authoring.md` and `tts-to-captions.md`:

- Input is a flat word list `[{ "id": "w0", "text": "Hello", "start": 0.0, "end": 0.5 }]`
  produced by `hyperframes transcribe` (Parakeet if installed, else whisper.cpp) or by
  importing an existing `.srt`, `.vtt` or OpenAI-style JSON. `transcribe --to srt -o x.srt`
  exports a sidecar. Always pass `--model` explicitly (`small.en` for English);
  `.en` models silently translate non-English audio.
- Kokoro gives no word timings, so the documented path is TTS then transcribe. Since
  the script text is known, a better path for this series is: synthesise line by
  line, record each line's start and end exactly, and only run alignment where
  word-level karaoke is needed (Shorts).
- Grouping: 4 to 6 words for calm, measured content, broken at sentence boundaries,
  pauses of 150 ms or more, or the maximum count. One group visible at a time; each
  group needs a hard `tl.set(... { opacity: 0, visibility: "hidden" }, group.end)` kill.
- Size text with `window.__hyperframes.fitTextFontSize(text, { maxWidth, fontFamily, fontWeight })`
  (max width 1600 px landscape, 900 px portrait). Landscape captions sit 80 to 120 px
  from the bottom; portrait captions about 600 to 700 px from the bottom.
- The tutorial style row: mono or clean sans, weight 500 to 600, typewriter or fade at
  0.4 to 0.5 s, high contrast, 48 to 64 px.
- 15 caption components are installable (`hyperframes catalog --tag caption-style`);
  the calm ones suit this series (section 1.11). Components ship with transparent
  backgrounds; add a contrast layer under them in the host.
- `hyperframes check --caption-zone "x0=0;y0=.82;x1=1;y1=1;severity=warning"` flags
  any content that enters a caption band. Use it on the long-form film to keep the
  YouTube CC area clear, and on Shorts to keep burned captions clear of diagrams.

### 1.7 TTS and transcription commands

- `hyperframes tts` is Kokoro-only (`-v voice`, `-s speed`, `-l lang`), defaults to
  `af_heart`, and lists 12 curated voices, though the voices file holds all 54. It
  has no per-line control or word timings. For this series drive `kokoro-onnx`
  directly (as the project already does): one call per line, per-line speed, exact
  durations.
- `hyperframes transcribe <wav> --model small.en --json` (or `--engine parakeet`
  after `hyperframes models install parakeet`; the skill reports Parakeet at 6.05 vs
  7.44 percent WER and 5 to 10 times faster than whisper.cpp).
- `hyperframes remove-background` exists (u2net human segmentation) but is irrelevant
  here because Merc is rendered with alpha.

### 1.8 Fonts

- The compiler embeds 18 font families deterministically: Inter, Roboto,
  Montserrat, Outfit, Poppins, Lato, Nunito, Open Sans, Oswald, Playfair Display,
  EB Garamond, IBM Plex Mono, JetBrains Mono, Source Code Pro, Space Mono, Archivo
  Black, League Gothic, Noto Sans JP (read from the CLI's embedded font map). In the
  registry probe the compiler also fetched Inter and JetBrains Mono faces from Google
  Fonts on first use and cached them in `~/.cache/hyperframes/fonts`, so the very
  first compile needs the network unless fonts are local.
- Any other family needs an `@font-face` pointing at a shipped local `.woff2`, or
  lint fires `font_family_without_font_face` and the render falls back silently.
- Music notation: the app already uses VexFlow 5 (MIT, `node_modules/vexflow`) with
  the Bravura (SMuFL, SIL Open Font License) and Academico faces
  (`src/lib/sheet-music-fonts.ts`). For video, pre-render each staff to static SVG at
  build time (VexFlow in Node or in a build page), ship Bravura locally, and animate
  the SVG nodes on the timeline. Do not let VexFlow lay out at render time; its fonts
  load asynchronously.

### 1.9 Render options, performance, long renders and memory

Render flags that matter (from `render --help`):

| Flag                                                                | Use                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `--quality draft / looks / delivery`                                | draft while iterating; looks is CRF 16; delivery is "high"                           |
| `--fps 30` (or rational `30000/1001`)                               | match the Merc plate frame rate                                                      |
| `--resolution landscape-4k`                                         | supersamples via device scale factor (composition unchanged; integer scale only)     |
| `--format hls`                                                      | writes an HLS VOD directory (H.264/AAC, SDR) for self-hosting on the web lesson page |
| `--format webm / mov / png-sequence`                                | transparent outputs (not needed here)                                                |
| `-c compositions/scene-04.html`                                     | render one scene for review                                                          |
| `--workers N`                                                       | each worker is a Chrome process of about 256 MB                                      |
| `--low-memory-mode`                                                 | auto at 8 GB RAM or less: one worker, screenshot capture                             |
| `--strict`                                                          | fail on lint errors (use for finals)                                                 |
| `--crf` / `--video-bitrate`                                         | override encoder quality                                                             |
| `--browser-timeout`, `--protocol-timeout`, `--player-ready-timeout` | raise for heavy compositions on slow CPUs                                            |
| `HF_SEGMENTED_CAPTURE=true` plus `--resume`, `--keep-segments`      | segmented capture for long renders                                                   |

**Segmented capture (long renders).** Reading the 0.8.97 producer code: segmented
capture is off by default (`HF_SEGMENTED_MIN_SECONDS` defaults to infinity), is
switched on with `HF_SEGMENTED_CAPTURE=true` (or a minimum duration), applies only to
MP4 and MOV and not to the layered route (shader transitions or HDR), slices the film
into segments of `HF_SEGMENT_FRAMES` (default 3,000 frames, minimum 30), recycles
the browser every `HF_SEGMENT_BROWSER_RECYCLE` segments (default 3), and with
`--resume` reuses finished segments recorded in `renders/.hf-segments/<hash>/segments.json`
after re-validating them. That is the right safety net for a 5-minute final render.

**Measured throughput on this machine** (10 s, 1920x1080, 30 fps; radial gradient,
SVG staff with an animated 1,200 px sine path, eight popping note heads, a moving
playhead, two GSAP-moved 524x524 VP9-alpha matte plates plus two plus-lighter light
plates, two text blocks):

| Run                        | Wall time | Capture | Output |
| -------------------------- | --------- | ------- | ------ |
| draft, auto workers (2)    | 29.4 s    | 21.6 s  | 5.0 MB |
| delivery, auto workers (2) | 31.3 s    | 26.8 s  | 8.2 MB |
| delivery, 4 workers        | 30.1 s    | 26.5 s  | 8.2 MB |

So about 11 frames per second, and more workers do not help on this CPU. The bridge
doc's own smoke test measured 5 s at 1080p60 in 19 s. Extrapolation for one full
render of a 5-minute film: about 14 minutes at 1080p30, about 28 minutes at 1080p60,
and two to three times that for scenes heavy in blur filters, backdrop filters or many
layers. A 4K supersampled render quadruples the pixels; expect two hours or more.

Output encoding of a delivery render: H.264 High, yuv420p, BT.709, no B-frames,
CRF-based (6.9 Mbps for the benchmark). YouTube recommends H.264 High, two B-frames,
closed GOP of half the frame rate, CABAC, 4:2:0, BT.709, MP4 with fast start, AAC-LC
48 kHz at 384 kbps stereo, and 8 Mbps for 1080p30 or 12 Mbps for 1080p60
(<https://support.google.com/youtube/answer/1722171>). The HyperFrames file is
acceptable as is; if you want the recommended shape, do a final FFmpeg remux or
re-encode together with the loudness pass.

**Concatenating scenes.** Preferred: one root `index.html` mounting 8 to 14 scene
sub-compositions, iterate per scene with `render -c`, and render the final as one job
with segmented capture and `--resume`, which keeps one continuous audio mix. If a
scene must be rendered separately (for example a very heavy one), render every part
with identical settings, concatenate video with the FFmpeg concat demuxer and
`-c copy`, and lay one master audio track over the whole film; concatenating audio at
scene boundaries invites clicks and broken music crossfades.

**Shader transitions.** Shader transitions force the layered composite path: the
engine makes every composition root transparent (put full-screen fills on a full-bleed
child), segmented capture is disabled, and `--page-side-compositing` (default on for
MP4) is the faster path. Prefer plain CSS/GSAP transitions for lesson films.

**WebGPU blocks fail here.** The registry's WebGPU shader blocks (`sine-wave`,
`waveform`, `ripples`, `prism`, and about 36 others tagged `webgpu-shader`) failed to
snapshot: "shaders: WebGPU unavailable (no-adapter)". Treat every `webgpu` item as
unusable on this machine. Canvas 2D and SVG items render fine.

### 1.10 Verification commands

- `hyperframes lint` while authoring; `hyperframes check` as the gate (lint, runtime
  errors, failed requests, layout overlap and overflow, `*.motion.json` assertions,
  WCAG AA text contrast in one browser pass). Useful flags: `--at-transitions` (sample
  every tween boundary to catch seam collisions), `--caption-zone`, `--frame-check`,
  `--strict`, `--snapshots`.
- `hyperframes snapshot --at 3,10.5,18 -o shots` writes PNGs plus a contact sheet;
  `--zoom "#selector"` crops at high density; `--angle iso` tilts the stage for depth
  checks; `--describe` calls Gemini only if `GEMINI_API_KEY` is set (pass
  `--describe false` to be sure nothing leaves the machine).
- `hyperframes compare a b --at 12 --labels v1,v2` renders variants side by side.
- `hyperframes keyframes --json` surfaces animation trajectories.

### 1.11 Registry items useful for a music explainer

The catalog holds 447 items (210 blocks, 237 components). Search is local and
word-based by default (`--on-device` meaning search needs a consented 33 MB model
download). Queries for "staff", "piano", "frequency" and "equation" returned
nothing: notation, keyboards and formulas must be built (VexFlow plus Bravura, SVG,
KaTeX or MathJax pre-rendered to SVG).

Verified here:

- `oscilloscope-trace` (block, 6 s): CRT beam sweeping a waveform across a graticule
  with phosphor persistence; variables `waveform` (sine, square, triangle, data),
  `frequency`, `amplitude`, `persistenceMs`, `phosphorColor`, `sweepRate`,
  `dataSeries`. Canvas 2D; rendered correctly under software GL. Restyle to the
  concept palette and use it for "what is a frequency".
- `sine-wave`, `waveform` (equalizer bars), `ripples`, `prism`: WebGPU, fail here.

Not render-tested, but relevant (one line each, from the catalog descriptions):

| Query        | Item                                                            | Type      | Why it is useful                                                                                                     |
| ------------ | --------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| wave         | `weight-wave`                                                   | block     | a crest of variable-font weight travels along a headline; "sound travels" titles                                     |
| wave         | `echo-trail`                                                    | component | ghosted copies at fixed time offsets; shows period, vibration and pitch history                                      |
| text reveal  | `text-stagger`                                                  | component | word stagger with enter, shimmer and exit                                                                            |
| text reveal  | `text-state-swap`                                               | component | outgoing blur, incoming lift; swapping a wrong idea for the right one                                                |
| text reveal  | `hw-path-text`                                                  | block     | handwriting along any SVG path; a word riding a pitch contour                                                        |
| text reveal  | `marker-highlight`                                              | component | one hand-drawn marker stroke on the emphasised word                                                                  |
| text reveal  | `vox-annotate`                                                  | component | Vox-style keyword marker with a connector to a mono callout label                                                    |
| text reveal  | `mk-callout-highlight`                                          | block     | word emphasis driven by one scalar, built to sync to a voiceover                                                     |
| camera       | `yt-camera-move`                                                | component | zoom, slide and 3D tilt-pan helpers for any wrapper                                                                  |
| camera       | `push-in`                                                       | component | one slow continuous camera push for emphasis                                                                         |
| camera       | `camera-dolly-zoom`                                             | block     | dolly zoom; use at most once per series as a signature beat                                                          |
| camera       | `camera-rig-depth-stack`                                        | component | card stack with depth, parallax and focus shift                                                                      |
| camera       | `ui-focus-zoom`                                                 | component | zoom and pan to an anchored region and hold; app screen tours                                                        |
| grain        | `grain-overlay`                                                 | component | CSS film-grain overlay                                                                                               |
| grain        | `grain-field`                                                   | component | accent-tinted drifting dot field in an exact loop; calm backgrounds                                                  |
| captions     | `caption-clip-wipe`                                             | component | left-to-right clip-path wipe per word; clean                                                                         |
| captions     | `caption-weight-shift`                                          | component | elegant weight transition between lines                                                                              |
| captions     | `caption-pill-karaoke`                                          | component | per-word karaoke highlight; for sung lyrics and solfege                                                              |
| captions     | `caption-highlight`                                             | component | background sweep behind the active word; Shorts                                                                      |
| captions     | `caption-blend-difference`                                      | component | auto-inverting text via `mix-blend-mode: difference` over busy backgrounds                                           |
| match cut    | `match-cut`                                                     | component | a circle accelerates into a hard single-frame swap and matches the incoming circle; note head to Merc eye, and so on |
| match cut    | `text-match-cut`                                                | component | one line becomes another at the speed peak                                                                           |
| match cut    | `type-match-cut`                                                | component | headline splits around an incoming panel                                                                             |
| match cut    | `cut-the-curve`                                                 | component | velocity-matched directional hard cut                                                                                |
| match cut    | `whip-pan-cut`                                                  | component | lateral whip with capped motion blur                                                                                 |
| zoom through | `zoom-through-transition`                                       | component | zoom through a focal card into the next scene                                                                        |
| zoom through | `parallax-zoom` / `parallax-unzoom`                             | component | centre card fills the frame while siblings parallax out, and the reverse                                             |
| zoom through | `fade-through`                                                  | component | calm fade through a wash                                                                                             |
| zoom through | `cinematic-zoom`, `flash-through-white`                         | block     | shader transitions; layered path, see 1.9                                                                            |
| data         | `mk-line-graph`                                                 | block     | SVG series draw on with labels riding the front; pitch over time                                                     |
| data         | `chart-story`                                                   | component | a chart builds and lands exact supplied values                                                                       |
| data         | `number-wheel`                                                  | component | rolling digit counter; Hz and cents readouts                                                                         |
| data         | `conic-progress-ring`                                           | component | ring and centre count settle together; "percent in tune"                                                             |
| path         | `offset-path-traveler`                                          | component | a slotted object follows a path with tangent rotation                                                                |
| path         | `tracing-beam`                                                  | component | glowing dash follows an SVG path through elements                                                                    |
| annotation   | `hw-arrow`, `hw-callout-circle`, `hw-underline`, `hw-box-label` | component | wobbled hand-drawn arrows, circles, underlines and boxes                                                             |
| annotation   | `cursor-annotate`                                               | component | a pen draws a loop, underline or arrow exactly under its nib                                                         |
| annotation   | `yt-feather-highlight`                                          | component | dims everything except a feathered spotlight that glides between targets                                             |
| diagram      | `hw-pipeline`                                                   | block     | hand-drawn boxes and connectors drawn in sequence; vocal folds to air to ear                                         |
| diagram      | `whiteboard-ink`                                                | component | stroke-by-stroke sketch with a following pen nib                                                                     |
| compare      | `before-after-wipe`, `comparison-split`                         | component | persistent divider wipes one state over another                                                                      |
| compare      | `focus-swap`                                                    | component | attention moves between two cards; Merc versus Merc arguments                                                        |
| titles       | `titlecard-calm`, `titlecard-lockup`                            | component | restrained chapter cards                                                                                             |
| titles       | `hw-title`, `hw-write-title`                                    | block     | handwritten title with highlight sweep; true glyph write-on                                                          |
| music        | `beat-accent`                                                   | component | a single music-hit sting: flash, micro scale pulse, decay                                                            |
| light        | `light-sweep-pass`                                              | component | a key light band re-shades a slotted scene once                                                                      |
| lower third  | `lt-kicker-name`, `lt-clean-bar` and nine siblings              | block     | name cards if a guest or human teacher appears                                                                       |

Licensing: registry items live in the Apache-2.0 HyperFrames repository; some vendor
third-party code with its own notice (for example `sine-wave` ships
`lib/shaders.THIRD-PARTY-LICENSES.txt`, MIT). `hyperframes add` needs the network at
install time even for previously seen items; keep installed items under version
control.

### 1.12 HyperFrames gotchas specific to this series

1. The narrative workflows cap at about 3 minutes; use `/general-video` or
   `motion-designer`.
2. The stacking-context blend trap (1.4).
3. WebGPU items do not render here (1.9).
4. 30 fps Merc plates versus 60 fps finals (section 0, item 4).
5. Never run `hyperframes skills`; set `HYPERFRAMES_SKIP_SKILLS=1` for `init`, and
   `HYPERFRAMES_NO_TELEMETRY=1` everywhere.
6. Google Fonts are fetched on first compile; vendor fonts and GSAP locally for
   offline determinism (the bridge doc pins GSAP 3.14.2 locally).
7. GSAP is free for commercial use under Webflow's Standard "No Charge" License,
   which forbids only use in no-code visual animation builders that compete with
   Webflow (<https://gsap.com/standard-license/>). Rendering videos and building
   lesson pages is fine.

---

## 2. Captions

### 2.1 How to produce them

- **Source of truth is the script.** Because narration is synthesised from a known
  script, the SRT can be generated without ASR errors: one cue per sentence chunk,
  times taken from per-line synthesis offsets (plus word-level alignment for long
  lines). Fallbacks: `hyperframes transcribe narration.wav --model small.en --to srt`,
  or upload the plain transcript and let YouTube auto-sync it.
- **Format.** YouTube accepts SRT, SBV, VTT, TTML/DFXP, SCC and more; SRT is the simple
  choice (plain UTF-8, no styling); VTT adds positioning; TTML adds styling
  (<https://support.google.com/youtube/answer/2734698>). Generate VTT from the same
  data for the web lesson page's `<track kind="captions">`.
- **Line rules** (Netflix English timed-text guide,
  <https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide>):
  at most 42 characters per line, two lines per cue, reading speed at most 20
  characters per second for adults; break after punctuation and before conjunctions
  and prepositions; keep articles with their nouns; prefer a bottom-heavy shape.
- **Two speakers.** Identify the speaker when it is not obvious on screen
  (`MERC:` / `TAVI:`, the hosts' names, at speaker changes, or a leading dash for two
  speakers in one cue). Write sound cues for musical examples (`[piano plays A4, then A5]`),
  because the musical example is content, not ambience.

### 2.2 Upload versus burn-in

|                       | Uploaded SRT/VTT (closed captions)                                        | Burned-in (open captions)                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Viewer control        | toggle, size and colour set by viewer                                     | always on                                                                                                                                                                                                                                                                                                                                                                                                          |
| Translation           | YouTube auto-translates uploaded captions; multi-language tracks possible | one language per render                                                                                                                                                                                                                                                                                                                                                                                            |
| Search and transcript | appears in "Show transcript", indexed by YouTube                          | none                                                                                                                                                                                                                                                                                                                                                                                                               |
| Accessibility         | meets WCAG 1.2.2 if accurate                                              | meets it visually, but cannot be enlarged or hidden                                                                                                                                                                                                                                                                                                                                                                |
| Learning effect       | optional, so no forced redundancy                                         | full verbatim on-screen text duplicating narration can hurt some learners (redundancy effect); a few condensed keywords help (Adesope and Nesbit 2012, as summarised in <https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00710/full>; Yue, Bjork and Bjork 2013, <https://sites.lifesci.ucla.edu/psych-bjorklab/wp-content/uploads/sites/13/2016/07/YueBjorkBjork2013_redundancy.pdf>) |
| Collision             | YouTube draws them at the bottom, over the picture                        | designed into the frame                                                                                                                                                                                                                                                                                                                                                                                            |

Evidence that captions matter for reach: in a 2019 Verizon Media and Publicis Media
survey of 5,616 US adults, 69 percent said they watch video with the sound off in
public, and 80 percent said they are more likely to finish a video when captions are
available (<https://www.3playmedia.com/blog/verizon-media-and-publicis-media-find-viewers-want-captions/>).

**Recommendation:** long-form film gets an uploaded SRT (plus auto-translations),
no burned-in captions, and designed on-screen keyword labels (condensed text, not the
script). Reserve the bottom band for YouTube's CC and enforce it with
`check --caption-zone`. Shorts get burned-in word-group captions (a calm component such
as `caption-clip-wipe` or `caption-highlight`), sized for the 9:16 safe area, plus an
uploaded SRT. The web page uses the VTT track and prints the full transcript below the
player.

---

## 3. Voice

### 3.1 Kokoro-82M licence

- Model card: `license: apache-2.0`; "With Apache-licensed weights, Kokoro can be
  deployed anywhere from production environments to personal projects" and "Kokoro
  has been deployed in numerous projects and commercial APIs"
  (<https://huggingface.co/hexgrad/Kokoro-82M>). The voices are files in the same
  Apache-2.0 repository (`voices/*.pt`, and the `voices-v1.0.bin` pack used by
  kokoro-onnx). So commercial use of generated audio is permitted, with no
  attribution requirement on the audio itself (crediting Kokoro in the description is
  good practice).
- `kokoro-onnx` (the runtime used here) is MIT; it downloads `kokoro-v1.0.onnx` and
  `voices-v1.0.bin` from its `model-files-v1.1` GitHub release
  (<https://github.com/thewh1teagle/kokoro-onnx>). It phonemises with espeak-ng (via
  `espeakng_loader`, GPL-3.0); that licence governs distributing the tool, not the
  audio you generate.
- Caveat worth knowing: the model card says the training data includes "synthetic
  audio generated by closed TTS models from large providers" alongside public-domain
  and permissively licensed audio, plus under 12 hours of CC BY audio (Koniwa,
  SIWIS). The Apache grant covers the weights; whether any provider's terms bind the
  trainer is not your licence question, but it is a reputational and legal grey zone
  to weigh for a premium, paid product.
- YouTube disclosure: the altered or synthetic content label is required for
  realistic content (a real person saying something they did not, realistic scenes),
  not for clearly animated characters
  (<https://support.google.com/youtube/answer/14328491>). Animated Merc hosts with
  synthetic voices fall on the "not required" side; never imitate a real person's
  voice.
- Monetisation: YouTube's July 2025 "inauthentic content" rename targets
  mass-produced, repetitive, templated videos
  (<https://www.plagiarismtoday.com/2025/07/08/youtube-targets-inauthentic-content/>,
  <https://ppc.land/youtube-clarifies-inauthentic-content-policy-changes/>). A
  hand-directed series with original visuals and teaching is not that, but vary
  structure across episodes and avoid a single fixed template.

### 3.2 Voice grades (VOICES.md) and measured behaviour

Grades are the model author's estimates of the quality and quantity of each voice's
training data ("Subjectively, voices will sound better or worse to different
people"; HH = 10 to 100 hours, H = 1 to 10 hours, MM = 10 to 100 minutes)
(<https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md>). The last four
columns are my measurements on this CPU with a 68-word explainer paragraph at speed
1.0 (samples in `research/tts-bench/`; F0 by autocorrelation, so treat it as
approximate).

| Voice      | Accent, sex                      | Target quality | Training data | Overall grade | wpm at speed 1.0 | Median F0 | Intonation SD | Synthesis RTF |
| ---------- | -------------------------------- | -------------- | ------------- | ------------- | ---------------- | --------- | ------------- | ------------- |
| af_heart   | US F (flagged as the lead voice) | not listed     | not listed    | **A**         | 196              | 202 Hz    | 3.0 st        | 0.27          |
| af_bella   | US F                             | **A**          | HH            | **A-**        | 189              | 209 Hz    | 2.5 st        | 0.26          |
| bf_emma    | UK F                             | B              | HH            | B-            | 209              | 181 Hz    | 2.4 st        | 0.26          |
| bm_george  | UK M                             | B              | MM            | C             | 189              | 141 Hz    | 2.9 st        | 0.26          |
| bm_fable   | UK M                             | B              | MM            | C             | 226              | 117 Hz    | 3.4 st        | 0.28          |
| am_michael | US M                             | B              | H             | C+            | 180              | 118 Hz    | 3.8 st        | 0.26          |
| am_fenrir  | US M                             | B              | H             | C+            | 228              | 136 Hz    | 4.5 st        | 0.25          |
| am_puck    | US M                             | B              | H             | C+            | 236              | 111 Hz    | 4.2 st        | 0.26          |

Other context: `af_nicole` (US F, B-, HH, a soft whispery voice) is the only other
English voice above C; `am_adam` is F+ even though HyperFrames' own skill lists it
for tutorials, so do not use it.

Reading the table:

- Kokoro synthesises at about a quarter of real time on this CPU, so a 5-minute
  narration takes about 80 seconds; voice is never the bottleneck.
- At speed 1.0 every voice is faster than the 145 to 165 wpm that explainers usually
  use. Plan on `speed` 0.75 to 0.85 for teaching lines, then add pauses (3.4).
- Pairings for two hosts, chosen for distinctness of accent and register as well as
  grade: `af_heart` plus `bm_george` (US female, UK male; best overall grades for a
  mixed pair), `af_heart` plus `bf_emma` (both highest grades, separated by accent
  and about 3.5 semitones of register), or `af_heart` plus `am_fenrir` (the most
  expressive male intonation, useful for the character who holds the misconception).
  Decide by a blind listening test: render the same 30-second dialogue in each
  pairing, have five people rate naturalness and "which voice is which" on a 1-5
  scale, and keep the winner for the whole series.
- Kokoro voices can be blended (weighted averages of voice embeddings) to make a
  bespoke timbre per Merc. That is supported in Kokoro tooling generally; test it,
  because blends can lose clarity.

### 3.3 Options for the final cast

| Option                | Cost                                                                                                                                                                                                                                         | Licence and risk                                                                                                                                                                                                          | Fit                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Kokoro (local)        | free                                                                                                                                                                                                                                         | Apache-2.0, commercial OK; training-data caveat above                                                                                                                                                                     | pilot episodes, scratch tracks for timing, possibly final for a free tier                                     |
| ElevenLabs, paid plan | Starter about $5 to 6 per month for about 30 minutes; Creator about $11 to 22 per month for about 121 minutes (pricing page shows promotional and FAQ prices that disagree) (<https://elevenlabs.io/pricing>)                                | Commercial licence on all paid plans; **free plan output cannot be used commercially even with attribution** and must credit "elevenlabs.io" in the title (<https://help.elevenlabs.io/hc/en-us/articles/13313564601361>) | much better prosody and emotion control; HyperFrames' own docs films use ElevenLabs "River" at 145 to 155 wpm |
| Human voice actors    | non-union e-learning narration about $35 to 55 per finished minute; GVAA-style non-broadcast rates about $450 to 550 for 3 to 5 minutes (secondary sources: <https://www.voicecrafters.com/?p=140657>, <https://www.tamararyanvo.com/rates>) | buy explicit usage rights for YouTube, the paid web course and future cutdowns; never clone an actor's voice without a written AI consent clause                                                                          | best for flagship episodes and for two-character comedy timing                                                |
| Hybrid                | actor records, Kokoro or ElevenLabs used only for pickups                                                                                                                                                                                    | needs a matched voice; consent in writing                                                                                                                                                                                 | practical once the series runs                                                                                |

Recommendation: build the whole pipeline on Kokoro now (it locks timing for every
animation), and run a cast decision after episode 1. Keep narration in a per-line
manifest (`line id, speaker, text, speed, pause_after_ms, take`) so a later re-voice
by humans or ElevenLabs is a drop-in that re-times automatically.

### 3.4 Pacing, pauses and two-character dialogue

- **Rate.** Practitioner convention for explainers is about 150 wpm, slower (about
  120 to 140) for dense material (sources collected in
  <https://breadnbeyond.com/how-many-words-does-a-60-seconds-explainer-video-needs/>;
  no peer-reviewed optimum exists). The best empirical data comes from Guo, Kim and
  Rubin (2014), 6.9 million edX viewing sessions: speaking rates ranged 48 to 254 wpm
  (mean 156); within a length band, engagement rose up to twofold with faster
  speakers; the 145 to 165 wpm middle bucket was "the least energetic"; their
  recommendation is to bring out enthusiasm, not to slow down artificially. They also
  found median engagement of at most about 6 minutes regardless of video length and
  recommend chunks shorter than 6 minutes
  (<https://up.csail.mit.edu/other-pubs/las2014-pguo-engagement.pdf>, DOI
  10.1145/2556325.2566239). Target: 150 to 170 wpm on average, energetic delivery,
  slower on the one key idea per scene, faster on transitions.
- **Script length.** 5 minutes at about 155 wpm is about 750 to 800 words including
  dialogue; budget 10 to 15 percent of runtime for musical examples and silences.
- **Pauses** (synthesise line by line and insert silence yourself; do not rely on
  punctuation): about 150 to 250 ms between sentences of one speaker; 300 to 500 ms at
  a speaker change; 600 to 900 ms after a question to the viewer; 1.0 to 2.0 s before
  and after a musical example the viewer must listen to, and before a reveal. Never
  speak over a pitch the viewer is meant to hear.
- **Dialogue design.** Muller, Bewes, Sharma and Reimann (2008) randomised 364
  first-year physics students across four multimedia versions: the refutation
  version (states and rebuts misconceptions) and the student-tutor dialogue produced
  effect sizes of 0.79 and 0.83 over a concise exposition, with the biggest gains for
  low-prior-knowledge learners and no harm to strong ones (J. Computer Assisted
  Learning 24(2):144-155, <https://doi.org/10.1111/j.1365-2729.2007.00248.x>; see also
  Muller and Sharma, <https://openjournals.library.sydney.edu.au/IISME/article/view/6345>,
  and <https://thejournal.com/articles/2015/05/05/watching-videos-does-not-necessarily-lead-to-learning.aspx>).
  Apply it directly: orange Merc voices the common misconception aloud ("a higher
  note is a louder note", "an octave is eight notes, so it is eight times the
  frequency"), blue Merc tests it with a demonstration, and both arrive at the right
  model. Keep lines short (one idea per line, usually under 20 words), alternate
  often, and give each host a consistent role and verbal tic so viewers can tell them
  apart with eyes closed.

---

## 4. Music and sound effects

### 4.1 Content ID mechanics that matter

- Content ID is only for owners of **exclusive** rights; material "licensed, but
  without exclusivity" does not qualify (<https://support.google.com/youtube/answer/1311402>).
  In practice, non-exclusive royalty-free and CC tracks still get claimed when a
  composer or distributor registers them, and claims are automatic; a licence only
  helps in a dispute.
- Content ID can match compositions, not only recordings, using publisher data, so a
  cover or a synthesised rendition of a copyrighted melody can be claimed
  (<https://youtube.googleblog.com/2011/08/creating-new-opportunities-for.html>).
- **Shorts over one minute with any active Content ID claim are blocked worldwide**
  until the claim is removed (<https://support.google.com/youtube/answer/15424877>).
  Keep Shorts claim-free, or at most 60 s.
- YouTube Audio Library tracks are "copyright-safe" for YouTube and are not claimed
  (<https://support.google.com/youtube/answer/3376882>), but the help page says
  nothing about use outside YouTube, so they are a poor fit when the same film plays
  on the paid web lesson page.

### 4.2 CC0 and free sources, with caveats

| Source                                           | Licence                                                                                                                                                         | Caveats                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Freesound                                        | each sound is CC0, CC BY or CC BY-NC (legacy Sampling+) (<https://freesound.org/help/faq/>)                                                                     | filter to CC0 or CC BY; no ownership warranty from uploaders; record each sound's URL and licence                                                                                                                                                                                                                                      |
| Pixabay (music and SFX)                          | Pixabay Content License: free commercial use, no attribution, no standalone redistribution (<https://pixabay.com/service/license-summary/>)                     | not CC0; some composers register tracks in Content ID, so claims happen and must be disputed with the licence text (<https://www.foximusic.com/blog/need-background-music-that-wont-trigger-content-id/>, <https://help.heygen.com/en/articles/8986144-how-to-remove-your-content-id-claim-in-youtube>); fine for SFX, risky for music |
| HyperFrames bundled SFX                          | Pixabay Content License                                                                                                                                         | 21 files; fine for whooshes and clicks                                                                                                                                                                                                                                                                                                 |
| YouTube Audio Library                            | YouTube terms; some tracks CC BY                                                                                                                                | safe on YouTube only; web-page use unclear                                                                                                                                                                                                                                                                                             |
| Subscription libraries (Epidemic Sound, Artlist) | commercial plan needed for business use; content published while subscribed is reported to stay cleared (secondary: <https://wyzowl.com/epidemic-sound-review>) | channel must be whitelisted; check that the plan covers a paid web course                                                                                                                                                                                                                                                              |
| Commissioned composer                            | work for hire                                                                                                                                                   | contract must forbid Content ID registration or whitelist your channels and site                                                                                                                                                                                                                                                       |

### 4.3 Recommended: synthesise every musical example in code

Why: exact pitches (the lesson's subject), perfect repeatability, no licence or
Content ID exposure, identical rights on YouTube and the web page, and the same
examples can be rendered as live audio in the web lesson.

How:

- Equal temperament from A4 = 440 Hz: `f = 440 * 2^((midi - 69) / 12)`; render at
  48 kHz, 24-bit or float WAV, with short raised-cosine attacks and releases (5 to
  20 ms) to avoid clicks.
- Timbres: pure sine (for "what is a frequency"), band-limited sawtooth or additive
  partials (harmonics lesson), Karplus-Strong plucked string, two-operator FM bell, and
  a formant-filtered source for vowel and "sung" examples. A small numpy script makes
  all of these deterministically; or render through the app's own audio engine in a
  headless page with `OfflineAudioContext` so lesson audio matches what learners hear
  in MercuryPitch.
- Place each example as its own `<audio id=...>` clip on the timeline, at a known
  start, at the same loudness target; leave 1 to 2 s of silence around it.
- **Melodies:** use public-domain tunes (folk songs; compositions published in 1930
  or earlier are public domain in the US as of 2026) and original phrases. Classic
  interval mnemonics from film and pop songs ("Jaws", "Star Wars", "Somewhere Over the
  Rainbow") are copyrighted compositions and can be claimed even when synthesised; use
  them only by name in narration, or pick PD alternatives ("Here Comes the Bride" is
  Wagner, 1850).
- **Background music:** none under explanation, or a sparse pad synthesised from the
  lesson's own key; keep it about 15 to 20 dB under the voice (HyperFrames' docs
  standard is about -31 LUFS for the bed) and drop it entirely during listening
  examples.

### 4.4 Salamander Grand Piano (used by the app)

- Repo notice: `docs/THIRD-PARTY-NOTICES.md` and
  `src/features/piano/instrument/piano-sample-manifest.ts` declare Salamander Grand
  Piano V3 by Alexander Holm, CC BY 3.0 Unported, via Jan Forst's MP3 adaptation
  (`@audio-samples/piano-mp3-*` 1.0.5 on jsDelivr), with the attribution string
  "Salamander Grand Piano V3 by Alexander Holm, MP3 adaptation distributed by Jan
  Forst, licensed under CC BY 3.0." Upstream confirms CC BY 3.0
  (<https://github.com/sfzinstruments/SalamanderGrandPiano>).
- CC BY 3.0 allows copying and adapting "for any purpose, even commercially",
  provided you give appropriate credit, link the licence, indicate changes for
  adaptations, and do not imply endorsement (<https://creativecommons.org/licenses/by/3.0/>).
  **So yes, notes rendered from these samples may appear in a monetised YouTube video
  and on the paid page,** with attribution in the YouTube description and on the
  lesson page (reuse the repo's attribution string, add "notes rendered by
  MercuryPitch").
- Two small cautions. First, the licence forbids imposing technological measures that
  restrict recipients' licence rights; whether a streaming platform's protections
  count is unsettled, and CC's own guidance suggests also making the material
  available somewhere without DRM
  (<https://wiki.creativecommons.org/4.0/Technical_protection_measures>). The samples
  remain freely available upstream, and the web lesson can play the same notes, which
  covers this in practice. Second, very widely used sample libraries occasionally
  appear inside other people's Content ID-registered tracks; a single note or short
  exercise will not match, but a long performed piece could. Prefer synthesised tones
  for long phrases, and the piano for short, recognisable "this is what it sounds
  like on a piano" moments.

---

## 5. YouTube retention and packaging for education

### 5.1 What YouTube itself says

- Recommendation signals: clicks, watch time, survey responses, sharing, likes and
  dislikes; "valued watchtime" counts only videos users rate four or five stars in
  surveys (Cristos Goodrow, 2021, <https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/>).
  Optimise for satisfied viewing, not raw minutes.
- The retention report's "Intro" key moment is the share of viewers still watching at
  **30 seconds**; YouTube's advice is to align title and thumbnail with what the video
  delivers and to experiment with the first 30 s; top moments that occur late should
  move earlier; spikes can mean value or confusion; dips show where viewers leave
  (<https://support.google.com/youtube/answer/9314415>). The 15-second hook is a
  practitioner heuristic, not a YouTube figure.

### 5.2 Hooks and open loops

- Open on the question or the surprising demonstration, not the channel or the
  lesson number. The first frame is a finished picture. Within 15 to 30 s the viewer
  must know the question, why it matters to their singing, and that it will be
  answered.
- Open loops work because curiosity is an information gap (Loewenstein 1994,
  Psychological Bulletin 116(1), DOI 10.1037/0033-2909.116.1.75), and curiosity
  improves memory for the answer and for incidental material shown while waiting
  (Kang et al. 2009, Psychological Science 20(8), DOI 10.1111/j.1467-9280.2009.02402.x).
  Plant one loop in the hook, close it at about 70 to 80 percent of the runtime, and
  open a smaller one per chapter.
- The misconception format (3.4) doubles as a hook: "Most singers think X. Let's test
  it." Veritasium's founder built the channel on that research.
- SoME judging criteria (Grant Sanderson's Summer of Math Exposition) make a good
  storyboard rubric: Motivation (quickly establish why it matters), Clarity (define
  terms, considerate of newcomers), Novelty (fresh presentation), Memorability (an
  "aha" that stays) (<https://some.3b1b.co/rules>). His reflections on the winners
  stress clear motivation and non-obvious insight over production polish
  (<https://www.3blue1brown.com/blog/some1-results>).

### 5.3 Packaging (titles and thumbnails)

- Derek Muller's "We Need To Talk About Clickbait" (Veritasium, 2021) argues title
  and thumbnail are at least half the job, distinguishing accurate-but-enticing
  packaging from misleading "clicktraps"
  (<https://www.veritasium.com/videos/2021/8/17/we-need-to-talk-about-clickbait>;
  details are from secondary summaries such as <https://gigazine.net/gsc_news/en/20210830-clickbait-effective>).
- **Test & Compare** (YouTube Studio, desktop, advanced features enabled): up to three
  titles and/or thumbnails; the variant with the highest **watch time share** wins;
  tests finish within about two weeks; outcomes are Winner, Performed Same or
  Inconclusive; Shorts, kids and private videos are excluded
  (<https://support.google.com/youtube/answer/13861714>). Plan three variants per
  episode: question title, outcome title, counter-intuitive claim title.
- Thumbnails: 16:9, recommended 3840x2160 (minimum width 640), JPG or PNG, up to 50 MB
  on desktop and 2 MB on mobile, verified account required
  (<https://support.google.com/youtube/answer/72431>). Build thumbnails as a
  HyperFrames composition (one hero object, a Merc face, at most three words, the
  concept colour) and export with `snapshot`; check legibility at 168x94.

### 5.4 Chapters, end screens, length, Shorts

- **Chapters:** timestamps in the description, first at 00:00, at least three, in
  ascending order, each chapter at least 10 s; manual chapters override automatic
  ones (<https://support.google.com/youtube/answer/9884579>). Generate them from the
  storyboard's scene table. Chapter titles should be phrased as questions or payoffs,
  matching on-screen chapter cards.
- **End screens:** video at least 25 s; elements in the last 5 to 20 s; up to four
  elements on 16:9 (video, playlist, subscribe, channel; external links need YPP)
  (<https://support.google.com/youtube/answer/6388789>). Design a 12 to 15 s end slate
  with two empty video slots and a subscribe zone, Mercs reacting in the free space,
  and a one-line teaser for the next lesson (closing the series-level loop).
- **Length:** Guo et al.'s MOOC data supports chunks under 6 minutes for learning
  engagement; the 4 to 6 minute plan fits. YouTube gives no official ideal length.
  Use a series playlist so session watch time accrues across lessons.
- **Shorts cutdowns:** up to 3 minutes for vertical or square uploads since
  15 October 2024 (<https://engadget.com/entertainment/youtube/youtube-shorts-can-now-run-up-to-three-minutes-160002081.html>);
  claims block Shorts over 60 s (4.1). Recompose each Short as a sibling 9:16 project
  (never a letterboxed 16:9), 30 to 60 s, one idea, the hook in the first 2 s,
  burned-in captions, and a pointer to the full lesson (Shorts can link a related
  video). Two or three Shorts per episode: the hook demo, the misconception flip, one
  ear-training challenge.
- **Reach:** YouTube's AI auto-dubbing reached all YPP creators in 2025 (initially
  nine languages including Spanish, Portuguese, Hindi, Japanese)
  (<https://www.androidauthority.com/youtube-auto-dubbing-expansion-3524990>);
  uploaded captions auto-translate. Both favour clean, script-accurate captions.
- **Paid tier:** YouTube Courses (free or paid, beta, limited creators and countries)
  is worth checking for the premium series
  (<https://www.netinfluencer.com/youtube-courses-for-creators/>).
- **API publishing:** videos uploaded through `videos.insert` from unverified API
  projects created after 28 July 2020 are locked to private until the project passes
  an audit (<https://developers.google.com/youtube/v3/docs/videos/insert>). Upload
  through Studio by hand until the audit is done.

### 5.5 Patterns from 3Blue1Brown and Veritasium worth copying

| Pattern                                        | Source                                                                                                                                   | How it maps here                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Address the misconception explicitly           | Muller 2008; Veritasium practice                                                                                                         | orange Merc's wrong idea, tested on screen                        |
| Motivation before mechanism                    | SoME criteria                                                                                                                            | start from a singing problem the viewer has                       |
| Concrete example before the general rule       | Sanderson's SoME announcement as summarised (<https://classes.golem.ph.utexas.edu/category/2021/08/why_arent_you_making_maths_vid.html>) | play and show A4 and A5 before saying "octave"                    |
| One persistent visual object carries the story | motion-designer principles 1 and 2                                                                                                       | the pitch trail or the oscilloscope trace persists through scenes |
| Packaging is half the job                      | Veritasium 2021                                                                                                                          | three title and thumbnail variants per episode                    |
| Original, minimal music                        | 3Blue1Brown uses original scores                                                                                                         | synthesised bed or none                                           |

---

## 6. Accessibility

### 6.1 Requirements

- **Captions** for all prerecorded audio (WCAG 2.2 SC 1.2.2, Level A,
  <https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html>); include
  speaker IDs and musical-example cues.
- **Audio description** (SC 1.2.5, AA): not needed when "all of the important
  information in the video track is already conveyed in the audio track"
  (<https://www.w3.org/WAI/WCAG22/Understanding/audio-description-prerecorded.html>).
  Write narration as integrated description ("the blue line climbs one step for each
  semitone") so no separate AD track is needed. Where a scene is purely visual, YouTube
  now lets creators with multi-language audio add a toggleable descriptive audio track
  (<https://support.google.com/youtube/answer/16166822>,
  <https://support.google.com/youtube/answer/13338784>); on the web page, the
  transcript doubles as the media alternative.
- **Colour:** never encode meaning in colour alone (SC 1.4.1); text at least 4.5:1
  (SC 1.4.3); lines, note heads and UI parts at least 3:1 against neighbours (SC
  1.4.11). Pair every concept colour with a shape, position or label.
- **Flashes:** no more than three flashes per second (SC 2.3.1); avoid strobing
  `flash-through-white` and beat-flash effects, and never flash in sync with rhythm
  demonstrations.
- **Motion on the web page:** no autoplay; anything moving longer than 5 s needs
  pause (SC 2.2.2); honour `prefers-reduced-motion`
  (<https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>,
  SC 2.3.3 AAA).

### 6.2 Concept palette for `#0d1117`

Method: candidate colours scored by WCAG contrast against `#0d1117` and by pairwise
CIEDE2000 distance under normal vision and under protanopia, deuteranopia and
tritanopia simulated with the Machado, Oliveira and Fernandes (2009) matrices at full
severity (<https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html>).
The app's existing pitch colours (`--pitch-reference: #f59e0b`, `--pitch-user: #a78bfa`
in `src/features/zen/ZenPitchStage.module.css` and `challenges/ChallengeStage.module.css`)
and the app's text colour `#e6edf3` were fixed, and the other four were optimised to
maximise the worst-case distance. Baselines for comparison on this background:
Okabe-Ito scores a worst case of 10.9 (and its blue `#0072B2` is only 3.65:1), Paul
Tol "bright" 8.6, Tol "light" 7.5.

| Role (suggested)                       | Hex               | Contrast on `#0d1117` | on `#161b22` | on `#21262d` | L\* |
| -------------------------------------- | ----------------- | --------------------- | ------------ | ------------ | --- |
| Target or reference pitch (app colour) | `#F59E0B` amber   | 8.81:1                | 8.05:1       | 7.09:1       | 72  |
| Your sung pitch (app colour)           | `#A78BFA` violet  | 6.95:1                | 6.36:1       | 5.59:1       | 65  |
| Tension, dissonance, off pitch         | `#FF4D97` rose    | 6.09:1                | 5.57:1       | 4.90:1       | 61  |
| In tune, resolution, consonance        | `#80FFCA` mint    | 15.39:1               | 14.06:1      | 12.37:1      | 92  |
| Tonic, home note, root                 | `#FFDF80` butter  | 14.53:1               | 13.28:1      | 11.68:1      | 90  |
| Sound wave, frequency, physics         | `#52C2CC` cyan    | 8.96:1                | 8.19:1       | 7.21:1       | 73  |
| Labels, axes, neutral                  | `#E6EDF3` neutral | 16.02:1               | 14.64:1      | 12.88:1      | 93  |

Worst-case separations (CIEDE2000; about 2 is a just-noticeable difference, above
10 reads as clearly different):

| Vision | Closest pair     | Distance |
| ------ | ---------------- | -------- |
| Normal | amber and butter | 18.9     |
| Protan | mint and butter  | 12.4     |
| Deutan | amber and butter | 12.5     |
| Tritan | mint and cyan    | 12.6     |

Notes:

- Every colour passes 4.5:1 for text on the three app surfaces, so labels can be set
  in the concept colour itself.
- Rose and mint (the "wrong" and "right" pair) differ by 31 L\* units, so they stay
  distinct even in greyscale; amber and cyan, and mint, butter and neutral, are close
  in lightness, so never rely on those pairs without a second cue.
- Host overlap: blue Merc's palette runs from teal `#04ECD8` to a violet crown
  `#BE6CF5`; it sits 11.3 from mint and 9.2 from violet. Orange Merc ("Ember") sits
  22 or more from every concept colour. Keep concept colours on diagrams and labels,
  not on the hosts, and verify on real frames with both Mercs in shot.
- Staff lines and grids: use `#30363d` to `#6e7681` (the app's border tokens);
  check 3:1 where the line carries meaning.

### 6.3 Reduced motion and alternatives on the web lesson

- Respect `prefers-reduced-motion: reduce`: do not autoplay; show a poster and a
  "step-through" version made from the same scenes (`hyperframes snapshot --at` at
  every beat, with the narration text under each still).
- Interactive demos on the page (the MercuryPitch widget, tone players) should not
  animate decoratively; keep only motion that carries information (a pitch trace).
- Provide the transcript, chapter links, and a download of the SRT/VTT.

---

## 7. Recommended production stack and pipeline

### 7.1 Stack and licences

| Stage                  | Tool                                                                                                                                                       | Licence or terms                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Script and facts       | Markdown script with line ids, speaker, intent, on-screen cue; `FACTS.md` for every on-screen claim (house rule)                                           | own                                                            |
| Voice                  | Kokoro-82M via `kokoro-onnx` (scratch and pilot); ElevenLabs paid or human cast for finals                                                                 | Apache-2.0 / MIT; paid plan commercial licence; actor contract |
| Alignment              | per-line timing from synthesis; `hyperframes transcribe` (Parakeet) for word timing                                                                        | Apache-2.0 tool; model licences per download                   |
| Musical examples       | numpy synth or app audio engine via `OfflineAudioContext`; Salamander notes for short piano moments                                                        | own; CC BY 3.0 with attribution                                |
| SFX                    | HyperFrames bundled SFX or Freesound CC0                                                                                                                   | Pixabay licence; CC0                                           |
| Notation               | VexFlow 5 pre-rendered to SVG, Bravura font                                                                                                                | MIT; SIL OFL 1.1                                               |
| Hosts                  | MercuryPitch WebGL2 raymarcher, pre-rendered to VP9 matte and light passes at 30 fps                                                                       | own (AGPL repo; the rendered video is your output)             |
| Composition and render | HyperFrames 0.8.97 + GSAP 3.14.2 (local)                                                                                                                   | Apache-2.0; GSAP Standard No-Charge                            |
| Direction and critique | repo `motion-designer` skill (storyboard, component and film critic rounds, `measure.py`)                                                                  | own                                                            |
| Mastering              | FFmpeg `ebur128` + two-pass `loudnorm`, optional re-encode to YouTube's recommended shape                                                                  | LGPL/GPL tool                                                  |
| Captions               | script-derived SRT and VTT; burned-in only for Shorts                                                                                                      | own                                                            |
| Publish                | YouTube Studio (chapters, end screen, Test & Compare, SRT); web page with VTT, transcript, chapters, widget; HLS via `render --format hls` or a video host | YouTube terms                                                  |

### 7.2 Pipeline

1. **Brief and facts (agent, 1 to 2 h).** Learning goal, the misconception, the hook
   demonstration, the payoff; facts with sources; `BRIEF.md` with
   `workflow: motion-designer`, `renders: pre-authorized` for unattended runs.
2. **Script (agent plus human review, 4 to 8 h).** 750 to 800 words for 5 minutes;
   dialogue lines under 20 words; each line tagged with speaker, intent (claim, test,
   reveal, joke), and the on-screen object it names. Check against the SoME rubric and
   the hook rule (question stated by 15 s, stakes by 30 s).
3. **Voice pass 1 (machine, minutes).** Synthesise each line with Kokoro at speed 0.8,
   insert pauses from the manifest, write `narration.wav`, `lines.json` (start, end
   per line) and the SRT/VTT. Listen at 1x once; fix pronunciations (Kokoro accepts
   phoneme overrides through misaki/espeak markup) and re-synthesise only changed lines.
4. **Storyboard (agent, 2 to 4 h, then a fresh critic round).** One row per beat with
   time from `lines.json`, shot line, what is on screen, purpose, exit, carried object;
   chapter boundaries; Merc actions per beat (choose from the clip library first);
   concept colours per element; caption-zone reservation.
5. **Assets (machine, 0.5 to 1.5 h, unattended).** Render new Merc clips (matte and
   light VP9 at 30 fps) only for beats the library lacks; synthesise musical
   examples; pre-render notation SVGs; install registry components.
6. **Build (agent, 1 to 2 days at first, about half a day later).** One
   sub-composition per scene, each with a lab render and a component critic round;
   Merc wrappers per section 1.4; `check --at-transitions --caption-zone ...` must
   pass with 0 errors.
7. **Render and critic loop (machine about 15 to 30 min per full render; 3 to 5
   rounds).** Draft full renders, a fresh `motion-critic` per round, fix the biggest
   problem first; final render with `--strict`, segmented capture and `--resume`;
   loudness master; `measure.py render` quality bar.
8. **Derivatives (agent plus machine, 2 to 4 h).** Two or three 9:16 Shorts as a
   sibling project with burned-in captions; thumbnail compositions (three variants);
   chapter list; description with attributions (Kokoro, Salamander, SFX).
9. **Publish (human, 1 to 2 h).** Upload in Studio (until the API audit is done), SRT,
   chapters, end screen, Test & Compare with three title and thumbnail variants,
   playlist; publish the web page (VTT track, transcript, chapters, interactive
   exercise, reduced-motion step-through).
10. **Learn (weekly).** Read the 30 s intro retention, dips and spikes; feed the top
    dip of each episode into the next storyboard round.

### 7.3 Per-episode time and compute on this 4-core machine (5-minute film)

| Step                                                    | Machine time                                                                                                                                                                                      | Basis                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Kokoro synthesis, full narration                        | about 1.5 min per pass (RTF 0.26); 10 to 15 min including retakes                                                                                                                                 | measured                                                                  |
| Word alignment for Shorts captions                      | a few minutes                                                                                                                                                                                     | Parakeet or whisper on CPU; estimate                                      |
| Musical examples and notation SVGs                      | under 5 min                                                                                                                                                                                       | estimate                                                                  |
| Merc pre-render                                         | about 1.5 h for 5,400 new Merc frames (40 percent screen time, 1.5 Mercs on average, 1 s per frame); 0.5 to 1 h once a reusable loop library exists (idle, talk, listen, sing, point, nod, react) | 1 s per frame given; double it if matte and light are separate raymarches |
| Scene lab renders during build                          | 30 to 60 min cumulative                                                                                                                                                                           | about 3 s per second of 1080p30, measured                                 |
| Full-film renders, 1080p30                              | about 14 min each (simple scenes) to 30 to 40 min (heavy scenes); 3 to 5 renders, so 1 to 2.5 h                                                                                                   | measured 11 fps                                                           |
| Full-film render, 1080p60 (if chosen)                   | about 28 to 60 min each                                                                                                                                                                           | measured scaling                                                          |
| Shorts (three 45 s, 9:16)                               | about 5 to 10 min total                                                                                                                                                                           | measured scaling                                                          |
| Loudness master and remux                               | about 1 min                                                                                                                                                                                       | estimate                                                                  |
| Critic rounds (snapshots, contact sheets, `measure.py`) | 5 to 10 min each                                                                                                                                                                                  | estimate                                                                  |
| **Total machine time**                                  | **about 3 to 5 h, mostly unattended**                                                                                                                                                             |                                                                           |

Human plus agent effort: about 2 to 3 working days for each of the first two or three
episodes (script, storyboard, building the scene library, critic rounds), then about
1 day per episode. RAM is not a constraint (16 GB; low-memory mode starts at 8 GB);
disk needs a few GB per episode for the frame cache and segments. The machine can
render one episode while the next is being scripted.

### 7.4 Open questions to settle early

1. 30 fps final (matches Merc plates) or 60 fps (needs 60 fps Merc plates, twice the
   raymarch cost).
2. Cast decision after episode 1 (blind listening test of Kokoro pairings versus a
   paid voice or human actors).
3. Background music: none, or a synthesised pad.
4. Whether the premium web page self-hosts video (HLS from HyperFrames or a video
   host) or embeds YouTube; self-hosting avoids ads and recommendations on the paid
   page.
5. Mouth animation for talking Mercs: either pre-rendered talk loops cut to line
   lengths, or a separate mouth layer drawn in HTML/SVG over the plate and driven by
   the line timings (keeps raymarch frames reusable).

---

## 8. Sources

HyperFrames and tooling

- Bundled skills: `/root/.npm/_npx/f293411582888030/node_modules/hyperframes/dist/skills/` (hyperframes, hyperframes-cli, media-use)
- hyperframes-core at v0.8.97: <https://raw.githubusercontent.com/heygen-com/hyperframes/v0.8.97/skills/hyperframes-core/SKILL.md> and `references/` (variables-and-media, determinism-rules, composition-patterns, sub-compositions, creator-editing-recipes, data-attributes)
- hyperframes-keyframes, -audio, -registry, -studio at v0.8.97: `https://raw.githubusercontent.com/heygen-com/hyperframes/v0.8.97/skills/<name>/SKILL.md`
- Repository: <https://github.com/heygen-com/hyperframes>; catalog: <https://hyperframes.heygen.com/catalog>
- Repo bridge notes: `/home/user/mercurypitch/.claude/skills/motion-designer/references/hyperframes-bridge.md`, `SKILL.md`, `references/house-rules.md`
- GSAP licence: <https://gsap.com/standard-license/>
- VexFlow (MIT, local `node_modules/vexflow/package.json`); app fonts `src/lib/sheet-music-fonts.ts`

Voice

- Kokoro-82M model card: <https://huggingface.co/hexgrad/Kokoro-82M>; VOICES.md: <https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md>
- kokoro-onnx: <https://github.com/thewh1teagle/kokoro-onnx>
- ElevenLabs pricing: <https://elevenlabs.io/pricing>; publishing rules: <https://help.elevenlabs.io/hc/en-us/articles/13313564601361>
- Voice actor rates (secondary): <https://www.voicecrafters.com/?p=140657>, <https://www.tamararyanvo.com/rates>
- YouTube synthetic content disclosure: <https://support.google.com/youtube/answer/14328491>
- Inauthentic content policy coverage: <https://www.plagiarismtoday.com/2025/07/08/youtube-targets-inauthentic-content/>, <https://ppc.land/youtube-clarifies-inauthentic-content-policy-changes/>
- Guo, Kim and Rubin 2014: <https://up.csail.mit.edu/other-pubs/las2014-pguo-engagement.pdf>
- Muller et al. 2008: <https://doi.org/10.1111/j.1365-2729.2007.00248.x>; Muller and Sharma: <https://openjournals.library.sydney.edu.au/IISME/article/view/6345>; <https://thejournal.com/articles/2015/05/05/watching-videos-does-not-necessarily-lead-to-learning.aspx>
- Explainer wpm conventions (secondary): <https://breadnbeyond.com/how-many-words-does-a-60-seconds-explainer-video-needs/>

Captions and accessibility

- YouTube caption formats: <https://support.google.com/youtube/answer/2734698>
- Verizon Media and Publicis Media survey: <https://www.3playmedia.com/blog/verizon-media-and-publicis-media-find-viewers-want-captions/>
- Netflix English timed text guide: <https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide>
- Redundancy research: <https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00710/full>, <https://sites.lifesci.ucla.edu/psych-bjorklab/wp-content/uploads/sites/13/2016/07/YueBjorkBjork2013_redundancy.pdf>
- WCAG 2.2 Understanding: <https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html>, <https://www.w3.org/WAI/WCAG22/Understanding/audio-description-prerecorded.html>, <https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html>, <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>, <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>, <https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html>, <https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html>, <https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html>
- YouTube descriptive audio: <https://support.google.com/youtube/answer/16166822>; multi-language audio: <https://support.google.com/youtube/answer/13338784>
- MDN prefers-reduced-motion: <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>
- CVD simulation (Machado et al. 2009): <https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html>; Okabe-Ito: <https://jfly.uni-koeln.de/color/>; Paul Tol: <https://personal.sron.nl/~pault/>

Music and rights

- Content ID eligibility: <https://support.google.com/youtube/answer/1311402>
- Composition matching (2011): <https://youtube.googleblog.com/2011/08/creating-new-opportunities-for.html>
- Three-minute Shorts and claims: <https://support.google.com/youtube/answer/15424877>
- YouTube Audio Library: <https://support.google.com/youtube/answer/3376882>
- Pixabay Content License: <https://pixabay.com/service/license-summary/>; Content ID on Pixabay tracks (secondary): <https://www.foximusic.com/blog/need-background-music-that-wont-trigger-content-id/>, <https://help.heygen.com/en/articles/8986144-how-to-remove-your-content-id-claim-in-youtube>
- Freesound FAQ: <https://freesound.org/help/faq/>
- Salamander Grand Piano: <https://github.com/sfzinstruments/SalamanderGrandPiano>; repo `docs/THIRD-PARTY-NOTICES.md`; CC BY 3.0: <https://creativecommons.org/licenses/by/3.0/>; CC on technical measures: <https://wiki.creativecommons.org/4.0/Technical_protection_measures>
- YouTube loudness reference (secondary): <https://meterplugs.com/blog/2019/09/18/youtube-changes-loudness-reference-to-14-lufs.html>
- Epidemic Sound terms (secondary): <https://wyzowl.com/epidemic-sound-review>

YouTube packaging

- Recommendation system: <https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/>
- Key moments for retention: <https://support.google.com/youtube/answer/9314415>
- Test & Compare: <https://support.google.com/youtube/answer/13861714>
- Chapters: <https://support.google.com/youtube/answer/9884579>
- End screens: <https://support.google.com/youtube/answer/6388789>
- Thumbnails: <https://support.google.com/youtube/answer/72431>
- Upload encoding: <https://support.google.com/youtube/answer/1722171>
- Shorts length change: <https://engadget.com/entertainment/youtube/youtube-shorts-can-now-run-up-to-three-minutes-160002081.html>
- Auto-dubbing expansion: <https://www.androidauthority.com/youtube-auto-dubbing-expansion-3524990>
- YouTube Courses (secondary): <https://www.netinfluencer.com/youtube-courses-for-creators/>
- Data API upload restriction: <https://developers.google.com/youtube/v3/docs/videos/insert>
- Veritasium on clickbait: <https://www.veritasium.com/videos/2021/8/17/we-need-to-talk-about-clickbait>; summary <https://gigazine.net/gsc_news/en/20210830-clickbait-effective>
- SoME rules: <https://some.3b1b.co/rules>; SoME1 results: <https://www.3blue1brown.com/blog/some1-results>; announcement summary: <https://classes.golem.ph.utexas.edu/category/2021/08/why_arent_you_making_maths_vid.html>
- Curiosity research: Loewenstein (1994), Psychological Bulletin 116(1):75-98, DOI 10.1037/0033-2909.116.1.75; Kang et al. (2009), Psychological Science 20(8):963-973, DOI 10.1111/j.1467-9280.2009.02402.x
