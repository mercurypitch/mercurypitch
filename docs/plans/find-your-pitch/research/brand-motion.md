# Brand and motion pipeline: what the lesson builders need

Research date: 2026-10-16. Repository: `/home/user/mercurypitch` (read only; nothing in it was
modified, and `output/motion/` was not opened beyond noting that `output/motion/lesson-01/`
exists). Contrast and colour-vision numbers in this report were computed for this report with
a small WCAG / Machado-2009 script kept in the scratchpad
(`(session scratchpad, not kept)/scripts/contrast.py`
and `.../scripts/cvd.py`).

---

## 0. Decision summary

1. **Brand palette for video and web:** Obsidian `#0d1117` stage, chrome-white `#e6edf3` text,
   Signal Blue `#58a6ff`, Aqua `#2dd4bf`, Violet `#bc8cff`, the spectrum gradient
   `linear-gradient(120deg, #58a6ff 0%, #2dd4bf 50%, #bc8cff 100%)`, and the chrome family
   `#f4f8fd / #c3ccd6 / #8a97a6 / #5b6b7b / #1b2430`. The chrome tokens and `--grad-*` exist
   only in `docs/branding/BRAND.md` and the logo SVGs, not in `src/styles/app.css`.
2. **Type:** Outfit 600-700 for display, tracking -1% to -2%. Inter 400-600 for body and labels,
   with tabular figures at 500 for numbers. Plus Jakarta Sans 600 is the warmer alternative. All
   three are OFL and already sit as variable woff2 files in
   `node_modules/@fontsource-variable/{outfit,inter,plus-jakarta-sans}/files/`.
3. **Voice:** "Find your pitch." Short sentences, verbs over adjectives, an encouraging coach that
   never shames ("You're 8 cents sharp — ease off." rather than "WRONG."). PRODUCT.md adds: direct,
   calm, instructional, never competitive or judgmental.
4. **Merc already has an approved voice:** the ElevenLabs voice "Merc V1 Gentle Whimsical D2",
   ID `B4fBPRmasEsTgd6YlSok`, chosen by the owner on 2026-09-20
   (`art/glass-adventure/voice/RUNTIME.md`, `art/glass-adventure/voice/v3/enrolled-voice.json`).
   Orange Merc has no voice yet. Six unsaved audition directions exist in `voice/v1` and
   `voice/v2`.
5. **Shipped blue Merc can be rendered deterministically in HyperFrames.** `mount(container, {capture: true,
transparent: true, voiceAt})` and `renderAt(t)` in `src/lib/merc/renderer.ts:30-95` draw
   "exactly t seconds after the last setState". `voiceAt` is a pure `(t) => MercVoice` function,
   so a precomputed narration envelope or pitch contour can drive him. Render cost under software
   GL has not been measured.
6. **Colour semantics conflict for an orange host.** In the product's Pitch Studio, amber
   `#f59e0b` already means "the reference or target melody" and violet `#a78bfa` means "the
   singer" (`src/features/stem-mixer/pitch-canvas-visuals.ts:8-17`). Accuracy colours are green,
   lime, yellow and red (`src/features/analysis/trace-model.ts:16-22`). Amber and yellow sit only
   dE 17 apart, so the two are confusable even for normal vision. Blue against orange stays fully
   separable under deuteranopia and protanopia (dE about 110-130), which makes it a strong pair
   for "two voices". Violet against Signal Blue collapses for those viewers (dE 5-7), and green
   against red collapses under deuteranopia (dE 8).
7. **No HyperFrames work exists in the repo outside `output/`.** The only hits are the
   motion-designer skill itself, `AGENTS.md`, `.gitignore` and
   `docs/plans/skills-handoff-2026-09-30.md`. No storyboard or brief has ever been written for a
   film. The nearest precedents are the Beside Cue onboarding video manifests and the Merc voice
   productions under `art/glass-adventure/voice/`.
8. **The kit's numbers are tuned for 30-40 s launch films, so a teaching film has to adapt
   them.** Keep the strict hard-freeze rule, since internal life is cheap. Relax the composition
   count from 24-30 per minute to about 4-8 per minute in explanation chapters, and move the kit's
   density into visual events (one every 2-5 s, tied to narration word timestamps). Section 5 has
   the full proposed table.
9. **Toolchain in this container:** Node v22.22.0, FFmpeg with all four required filters, and
   Python 3.13.16 with numpy but no scipy. HyperFrames 0.8.97 is in the npx cache with Chrome
   Headless Shell, plus the Kokoro TTS model under `~/.cache/hyperframes/tts`. Four successful
   renders are logged on 2026-10-15. Telemetry is enabled in `~/.hyperframes/config.json`; set
   `HYPERFRAMES_NO_TELEMETRY=1`. The HyperFrames Claude Code plugin skills (`hyperframes-core`,
   `hyperframes-audio`, ...) are not installed here. Only the bundled `hyperframes`,
   `hyperframes-cli` and `media-use` skills under `~/.npm/_npx/f293411582888030/node_modules/hyperframes/dist/skills/`
   are available.

---

## 1. Sources read

Brand:

- `docs/branding/BRAND.md` (374 lines, "Version 0.1, Direction: Liquid Precision")
- `docs/branding/MASCOT.md` (174 lines, v0.1 plan)
- `docs/branding/TRADEMARK.md` (143 lines)
- `docs/branding/marketing/README.md` (58 lines)
- `docs/branding/logo/meniscus2/*.svg|png`, `docs/branding/favicon/meniscus2/*`
- `src/styles/app.css` (2925 lines; tokens at lines 37-438), `src/styles/dark-stage.css`,
  `src/styles/mobile-kit.css`, `src/lib/self-hosted-fonts.ts`, `tools/font-aliases.ts`
- `PRODUCT.md` § Brand Commitments (lines 93-107), § Product Principles (129-142),
  § Accessibility (144-150)
- `src/lib/merc/constants.ts`, `src/lib/merc/renderer.ts` (shipped Merc)
- `src/features/stem-mixer/pitch-canvas-visuals.ts`, `src/features/analysis/trace-model.ts`,
  `src/lib/jam/jam-pitch-view.ts` (product colour semantics)
- `art/glass-adventure/voice/` (Merc voice production, v1 to v7)
- `docs/agent/DOCS-AUDIT.md` lines 190-210 (branding archive moves)

Motion:

- `.claude/skills/motion-designer/SKILL.md` (289 lines), `BRIEF-TEMPLATE.md`
- `.claude/skills/motion-designer/references/{house-rules,hyperframes-bridge,measurement,shot-grammar}.md`
- `.claude/skills/motion-designer/kit/{README,VENDORED}.md`,
  `kit/business-motion-film/SKILL.md` and every reference except `business-offers.md`:
  `motion-grammar.md`, `launch-film-notes.md`, `quality-bar.md`, `audio.md`,
  `critic-prompts.md`, `gauntlet.md`, `three-js-patterns.md`, `product-hero-realism.md`,
  `case-study-alder.md`, `case-study-duo.md`
- `kit/business-motion-film/templates/{component-lab.html,projected-overlays.js}`
- `.claude/skills/motion-designer/templates/smoke-test.html`, `scripts/smoke-test.sh`, and the
  `scripts/measure.py` and `scripts/reference_pass.py` argument surface
- `.claude/agents/motion-critic.md`
- `docs/plans/skills-handoff-2026-09-30.md` (how the skill was built, its audit and evidence)
- Bundled HyperFrames docs and skills, read from the npx cache, not from the repo:
  `npx hyperframes docs {data-attributes,compositions,gsap,rendering,troubleshooting}`, `tts --help`,
  `transcribe --help`, `beats --help`, and in `dist/skills/`:
  `hyperframes/references/{routes/faceless-explainer,script-format,storyboard-format,frame-worker-core,production-loop}.md`,
  `media-use/audio/references/{tts,tts-to-captions,bgm}.md`, `media-use/scripts/audio-duck.mjs`

---

## 2. Brand

### 2.1 Strategy, personality, voice and tone

From `docs/branding/BRAND.md` §1 (lines 9-38):

- **Idea: Liquid Precision.** Mercury is quicksilver: a liquid metal that is fluid and reflective
  and responds instantly. The product "turns your voice into something you can see, in real
  time". Mercury is also the messenger god who "invented the lyre", and "Pitch" is the vertical
  axis of music.
- **Brand promise:** "Your voice, made visible — fluid, immediate, precise."
- **Personality table** (lines 23-28):

  | Trait       | Means                                  | Not             |
  | ----------- | -------------------------------------- | --------------- |
  | Precise     | Instrument-grade, trustworthy feedback | Clinical, cold  |
  | Fluid       | Real-time, responsive, effortless      | Sluggish, rigid |
  | Premium     | HDR, chrome, considered craft          | Flashy, gaudy   |
  | Encouraging | Helps you improve, never shames        | Gamey, childish |

- **Voice and tone rules** (lines 32-38):
  - "Confident and clear, never jargon-heavy. Short sentences. Verbs over adjectives."
  - "Encouraging coach, not a drill sergeant. 'You're 8 cents sharp — ease off.' not 'WRONG.'"
  - Taglines: **"Find your pitch."** (recommended primary), "Your voice, in perfect focus.",
    "See every note.", "Real-time pitch, liquid precision."
- `PRODUCT.md:97`: "Product language is direct, calm, and instructional rather than competitive
  or judgmental."
- `PRODUCT.md:133`: "Make feedback actionable and specific without pretending to evaluate
  qualities the system cannot measure." `house-rules.md:49`: exercise scoring must not claim to
  assess pronunciation.
- `PRODUCT.md:102-106`: progress claims use real takes, "never a fabricated composite 'voice
  score'". Voice Atlas colours "do not encode better/worse".
- `house-rules.md:19` (motion-designer), MercuryPitch voice row: "'Find your pitch.' Short
  sentences, verbs over adjectives, an encouraging coach."
- Coach-voice examples from `docs/plans/glass-handoff-2026-07-17.md:327-329`: "You're 18¢ flat —
  ease up." / "There — hold it steady." / "Locked. Keep pouring into it." The same plan has
  playback copy that names the moment: "That was you."
- Merc's character, as fixed by the voice work (`art/glass-adventure/voice/v1/README.md:8-20`):
  "clear, concise, premium and encouraging; never shaming, clinical or childish". He is a "warm
  pitch-reactive guide rather than a decorative sticker", an "ageless sprite, bright quick
  young-adult read, buoyant and lightly mischievous, warm over polished, musical, nonjudgmental".
  Approved Merc lines in the shipped game: "A little note can break glass.", "Hum a comfortable
  note.", "Beautiful. A new path is open.", "Another beautiful mess.", "That was positively
  sparkling."
- Style conventions in the skill: the brief template defaults to `language: en-GB`, and the docs
  use British spelling (colour, centre).

**What this means for lessons.** Use second person and present tense. Name the action ("Slide up
to the note"), not the identity ("You're tone-deaf"). A miss gets a direction plus an amount
("a little sharp, about 20 cents"). Never put "wrong", "bad" or a judgemental red X on the
learner. Merc can be playful, but the explanation copy stays literal, mirroring the Beside Cue
rule (`house-rules.md:19`): "Operational copy is literal; record metaphors belong to Corky
dialogue and display lines only."

### 2.2 Palette

#### Core dark palette (app `:root`, `src/styles/app.css:37-165`; BRAND.md §3 lines 119-130)

| Token                     | Hex                                       | Role                                                                                        |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `--bg-primary` (Obsidian) | `#0d1117`                                 | App background, brand black, video stage                                                    |
| `--bg-secondary`          | `#161b22`                                 | Panels                                                                                      |
| `--bg-tertiary`           | `#21262d`                                 | Raised surfaces (`--surface`)                                                               |
| `--bg-card`               | `#1c2128`                                 | Cards                                                                                       |
| `--border-subtle`         | `#252c35`                                 | Faint hairline                                                                              |
| `--border`                | `#30363d`                                 | Hairlines                                                                                   |
| `--border-strong`         | `#6e7681`                                 | Strong rule                                                                                 |
| `--text-primary`          | `#e6edf3`                                 | Primary text, chrome-white                                                                  |
| `--text-secondary`        | `#a8b3bf`                                 | Secondary text                                                                              |
| `--text-muted`            | `#868f9a` (app) / `#6e7681` (BRAND table) | Muted text. **Discrepancy:** the app moved to `#868f9a`; `#6e7681` is now `--text-disabled` |
| `--text-disabled`         | `#6e7681`                                 | Disabled copy                                                                               |
| `--bg-inverse`            | `#f6f8fa`                                 | Inverse surface                                                                             |
| `--text-inverse`          | `#1f2328`                                 | Inverse text                                                                                |

#### Signal accents (`app.css:51-62`; BRAND.md lines 132-141)

| Token                    | Hex                        | Role                                                        |
| ------------------------ | -------------------------- | ----------------------------------------------------------- |
| `--accent` (Signal Blue) | `#58a6ff`                  | Primary accent, active pitch, links, CTAs (`--note-active`) |
| `--accent-hover`         | `#79b8ff`                  | Hover                                                       |
| `--accent-dim`           | `rgba(88, 166, 255, 0.15)` | Tint surface                                                |
| `--accent-glow`          | `rgba(88, 166, 255, 0.3)`  | Glow                                                        |
| `--teal` (Aqua)          | `#2dd4bf`                  | Secondary: success, in-tune, data                           |
| `--purple` (Violet)      | `#bc8cff`                  | Tertiary: highlights, premium, mascots                      |
| `--green`                | `#3fb950`                  | Perfect or in tune                                          |
| `--yellow`               | `#d29922`                  | Slightly off                                                |
| `--red`                  | `#f85149`                  | Off pitch or error (`--status-danger-fg` is `#f96f68`)      |
| `--orange`               | `#db6d28`                  | UI token only; not a documented brand colour                |
| `--stem-midi-fg`         | `#ac8bf9`                  | MIDI stem violet text                                       |

`--on-accent` is `var(--bg-primary)`: filled controls take dark text, never white. White on
`#58a6ff` measures only 2.5:1.

#### Mercury / chrome (BRAND.md lines 143-153; not present in app.css)

| Token          | Hex       | Role                                       |
| -------------- | --------- | ------------------------------------------ |
| `--chrome-100` | `#f4f8fd` | Specular highlight, top of chrome gradient |
| `--chrome-300` | `#c3ccd6` | Light chrome                               |
| `--chrome-500` | `#8a97a6` | Mid chrome                                 |
| `--chrome-700` | `#5b6b7b` | Deep chrome                                |
| `--chrome-900` | `#1b2430` | Chrome shadow, bevel                       |

#### Signature gradients (BRAND.md lines 155-172)

```css
/* Spectrum (brand rim / "Pitch" wordmark / active states) */
--grad-spectrum: linear-gradient(120deg, #58a6ff 0%, #2dd4bf 50%, #bc8cff 100%);
/* Quicksilver (logo body, premium chrome surfaces) */
--grad-mercury: radial-gradient(
  120% 120% at 38% 30%,
  #f4f8fd 0%,
  #aeb9c6 28%,
  #5b6b7b 62%,
  #1b2430 100%
);
/* Hero wash (landing background) */
--grad-hero:
  radial-gradient(80% 60% at 50% 0%, rgba(88, 166, 255, 0.18), transparent 60%),
  #0d1117;
```

The canonical mark uses **different chrome stops** from `--grad-mercury`.
`docs/branding/logo/meniscus2/mark.svg` defines `radialGradient cx=0.38 cy=0.28 r=1.05` with stops
`#f4f8fd 0`, `#c3ccd6 0.32`, `#8a97a6 0.62`, `#3d4b5c 1`. The "liquid" under the wave is a linear
gradient `#1d3050 → #131f36 (0.55) → #0b1220`, and the spectrum stroke runs left to right
(`x1=0 → x2=1`), not at 120 degrees. When a film rebuilds the mark in code, copy the SVG rather
than BRAND's CSS gradient.

The smoke-test stage (`templates/smoke-test.html:39-45`) is the hero wash, written out:
`radial-gradient(80% 60% at 50% 0%, rgba(88,166,255,0.18), transparent 60%), #0d1117`.
`measure.py color` sampled the rendered background as exactly `#0d1117`
(`skills-handoff-2026-09-30.md` § 10).

#### Other theme presets (app.css)

These are user-selectable app themes; a brand film uses the default dark one.

- `[data-theme='light']` (lines 174-208): bg `#f3f4f6`, secondary `#e8eaed`, tertiary `#dde1e6`,
  card `#eff0f3`, text `#1f2328` / `#525960` / muted `#5c636b`, accent `#0969da`, accent-text
  `#0f57ad`, green `#1a7f37`, red `#cf222e`, yellow `#9a6700`, orange `#bc4c00`, purple `#8250df`,
  teal `#0a6460`. BRAND.md: "Keep it. The Mercury chrome family works unchanged in light mode."
- `midnight` (213), `forest` (246), `ocean` (280), `cyberpunk` (312), `rose` (344) and others
  follow. These are personal themes, not brand palettes.
- `src/styles/dark-stage.css` (`.mp-dark-stage`): the immersive-surface contract (Stem Mixer,
  Karaoke, Zen and others). It is the same Obsidian base, but with `--text-muted: #8b949e`,
  `--border: #6e7681` and `--green: #56d364`.

### 2.3 Product colour semantics that a lesson must not contradict

| Meaning                      | Colour                                                           | Source                                                 |
| ---------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| Reference / target melody    | amber `#f59e0b`, bright `#ffc15a`, fill `rgba(245,158,11,0.58)`  | `src/features/stem-mixer/pitch-canvas-visuals.ts:8-17` |
| The singer's voice           | violet `#a78bfa`, bright `#c4b5fd`, fill `rgba(167,139,250,0.3)` | same                                                   |
| Playhead                     | `#60a5fa`                                                        | same                                                   |
| Selection                    | `#edf5ff`                                                        | same                                                   |
| Accuracy: perfect, excellent | green `#3fb950`                                                  | `src/features/analysis/trace-model.ts:16-22`           |
| Accuracy: good               | lime `#8dcb41` (`--chart-lime`)                                  | same                                                   |
| Accuracy: okay               | yellow `#d29922`                                                 | same                                                   |
| Accuracy: off                | red `#f85149`                                                    | same                                                   |
| Jam hit quality              | perfect `#3fb950`, close `#e3a221`, miss `#f85149`               | `src/lib/jam/jam-pitch-view.ts:63-67`                  |
| Voice Atlas Earlier / Later  | must not encode better or worse                                  | `PRODUCT.md:105-106`                                   |

`PRODUCT.md:95-96`: the Stem Mixer Pitch Studio is "the binding visual and interaction
reference". Lesson diagrams of pitch over time should therefore follow it: pitch on the vertical
axis, time on the horizontal, reference in amber, singer in violet, playhead in blue.

**Implication for the two hosts.** An orange Merc reads naturally as "the reference voice", the
one to copy, because amber already means the target melody. A blue or violet Merc reads as the
singer. Used that way, the hosts reinforce the product's own encoding. The risk is the
accuracy-warning hues. Amber `#f59e0b` and yellow `#d29922` are only dE 17 apart (and dE 5 under
protanopia), so an orange Merc must never appear next to an "okay / slightly off" yellow without
a label or icon. It also must not stand for "wrong".

**Shipped Merc palette** (`src/lib/merc/constants.ts:98-113`): a body gradient by height, from
teal at the base through azure and indigo to violet at the crown:
`#04ecd8` at 0 and 0.136, `#129e9b` 0.232, `#1a73b1` 0.328, `#0062d0` 0.424, `#016be5` 0.52,
`#105eec` 0.616, `#2747f0` 0.712, `#5133f3` 0.808, `#8841f5` 0.904, `#be6cf5` 1.0. Bead feet are
`#0566aa` / `#16b2e4`. The light look uses `tint #f6f2ff` and `tint2 #64cbfa`
(`constants.ts:146-148`). The stage background is `BG = #0d1117` (`constants.ts:205`), with a
silver rim `RIM = {width 0.013, strength 0.5}` (`constants.ts:211`). This palette is Merc's own,
fitted to concept paintings and approved by the owner. It is deliberately not the BRAND spectrum
(`constants.ts:94-97`). An orange variant would be a new `MercPalette` passed through
`setLook({stops, bead})` (`renderer.ts:65-70, 630-634`), with no shader change, because palette
and look are uniforms.

### 2.4 Measured contrast

The motion-designer house rules (`house-rules.md:22-26`) measured these on Obsidian: text
`#e6edf3` 16.0:1, Signal Blue 7.5:1, Aqua 10.2:1, Violet 7.5:1, `#6e7681` 4.1:1 ("never use it
for text in a video"). The spectrum gradient is decoration and never the only carrier of meaning.
I recomputed them (WCAG 2.x relative luminance) and extended the set:

**Dark grounds**

| Foreground                        | `#0d1117` | `#161b22` | `#1c2128` | `#21262d` |
| --------------------------------- | --------- | --------- | --------- | --------- |
| text-primary `#e6edf3`            | 16.0      | 14.6      | 13.7      | 12.9      |
| text-secondary `#a8b3bf`          | 8.9       | 8.1       | 7.6       | 7.1       |
| text-muted (app) `#868f9a`        | 5.8       | 5.3       | 4.9       | 4.6       |
| `#6e7681` (BRAND muted, disabled) | **4.1**   | 3.8       | 3.5       | 3.3       |
| Signal Blue `#58a6ff`             | 7.5       | 6.8       | 6.4       | 6.0       |
| accent-hover `#79b8ff`            | 9.1       | 8.3       | 7.8       | 7.3       |
| Aqua `#2dd4bf`                    | 10.2      | 9.3       | 8.7       | 8.2       |
| Violet `#bc8cff`                  | 7.5       | 6.9       | 6.4       | 6.0       |
| green `#3fb950`                   | 7.4       | 6.8       | 6.4       | 6.0       |
| yellow `#d29922`                  | 7.5       | 6.9       | 6.4       | 6.0       |
| red `#f85149`                     | 5.6       | 5.2       | 4.8       | 4.5       |
| danger-fg `#f96f68`               | 6.8       | 6.2       | 5.8       | 5.4       |
| orange `#db6d28`                  | 5.6       | 5.1       | 4.8       | 4.5       |
| reference amber `#f59e0b`         | 8.8       | 8.1       |           |           |
| reference bright `#ffc15a`        | 11.7      | 10.7      |           |           |
| singer violet `#a78bfa`           | 7.0       | 6.4       |           |           |
| playhead `#60a5fa`                | 7.4       | 6.8       |           |           |
| good lime `#8dcb41`               | 9.7       | 8.9       |           |           |
| chrome-100 `#f4f8fd`              | 17.7      | 16.2      | 15.2      | 14.3      |
| chrome-300 `#c3ccd6`              | 11.7      | 10.6      | 10.0      | 9.4       |
| chrome-500 `#8a97a6`              | 6.4       | 5.8       | 5.4       | 5.1       |
| chrome-700 `#5b6b7b`              | **3.5**   | 3.2       | 3.0       | 2.8       |
| chrome-900 `#1b2430`              | 1.2       | 1.1       |           |           |
| Merc teal `#04ecd8`               | 12.6      | 11.5      | 10.8      | 10.1      |
| Merc azure `#016be5`              | **3.8**   | 3.5       | 3.3       | 3.1       |
| Merc indigo `#2747f0`             | **2.9**   | 2.7       | 2.5       | 2.4       |
| Merc violet `#be6cf5`             | 6.0       | 5.5       | 5.1       | 4.8       |

Filled-control pairs: `#0d1117` on `#58a6ff` 7.5, on `#2dd4bf` 10.2, on `#bc8cff` 7.5. White on
`#58a6ff` is 2.5 (fails); white on light `#0969da` is 5.2. Text `#e6edf3` on chrome-500 is 2.5,
so never put white text on mid chrome. `#0d1117` on chrome-300 is 11.7.

**Light grounds**

| Foreground            | `#f3f4f6` | `#eff0f3` | `#ffffff` |
| --------------------- | --------- | --------- | --------- |
| text `#1f2328`        | 14.4      | 13.9      | 15.8      |
| secondary `#525960`   | 6.5       | 6.2       | 7.1       |
| muted `#5c636b`       | 5.5       | 5.3       | 6.1       |
| accent `#0969da`      | 4.7       | 4.6       | 5.2       |
| accent-text `#0f57ad` | 6.4       | 6.2       | 7.0       |
| teal `#0a6460`        | 6.4       | 6.1       | 7.0       |
| purple `#8250df`      | 4.6       | 4.4       | 5.0       |
| green `#1a7f37`       | 4.6       | 4.5       | 5.1       |
| red `#cf222e`         | 4.9       | 4.7       | 5.4       |
| yellow `#9a6700`      | 4.4       | 4.3       | 4.9       |
| orange `#bc4c00`      | 4.6       | 4.4       | 5.0       |

Rules that follow:

- Body text: `#e6edf3` or `#a8b3bf`.
- Never set text in `#6e7681`, chrome-700, chrome-900, Merc azure or Merc indigo.
- `#868f9a` only on `#0d1117` / `#161b22`; it is marginal on cards.
- Red `#f85149` and orange `#db6d28` sit at 4.5 on `#21262d`, right at the threshold.
- In the light theme, yellow `#9a6700` and purple `#8250df` fail 4.5 on the cards.

**Colour-vision separation** (CIELAB dE76 after Machado-2009 simulation at severity 1.0; above
about 20 reads as clearly different):

| Pair                                     | normal | deutan | protan |
| ---------------------------------------- | ------ | ------ | ------ |
| green `#3fb950` vs red `#f85149`         | 119    | **8**  | 32     |
| green vs yellow `#d29922`                | 70     | 26     | **16** |
| Signal Blue `#58a6ff` vs amber `#f59e0b` | 128    | 129    | 117    |
| Signal Blue vs orange `#db6d28`          | 113    | 112    | 99     |
| Violet `#bc8cff` vs Signal Blue          | 38     | **5**  | **7**  |
| Aqua `#2dd4bf` vs green                  | 47     | 45     | 49     |
| amber vs yellow                          | **17** | **12** | **5**  |
| orange `#db6d28` vs red                  | 28     | **11** | 24     |

Takeaways:

- The blue and orange hosts are the most robust two-category pairing available.
- Never make the blue and violet ends of the spectrum carry two different meanings.
- Accuracy green and red need an icon or text alongside the colour, which BRAND §3 requires
  anyway.

### 2.5 Typography

BRAND.md §4 (lines 187-199):

| Role                | Font                      | Weight  | Notes                                                             |
| ------------------- | ------------------------- | ------- | ----------------------------------------------------------------- |
| Display / headlines | **Outfit**                | 600-700 | Tight tracking (-1 to -2%). Geometric, modern, matches "precise". |
| Alt display         | Plus Jakarta Sans         | 600     | Warmer fallback for marketing when Outfit feels too rigid.        |
| UI / body           | **Inter**                 | 400-600 | The workhorse.                                                    |
| Data / numerics     | Inter (tabular) or a mono | 500     | Cents, Hz, timers: `font-variant-numeric: tabular-nums`.          |

- **Wordmark** (lines 92-97): "MercuryPitch", one word, camel case. Outfit SemiBold 600,
  letter-spacing -1.5% to -2%. "Mercury" in chrome-white `#e6edf3`, "Pitch" in the spectrum
  gradient, or solid Signal Blue on busy backgrounds. The lockup SVG sets `font-size="118"
font-weight="600" letter-spacing="-2"`, which is -1.7%, in live `<text>` with
  `font-family="Outfit, Inter, system-ui, sans-serif"`. In a headless render it needs an
  `@font-face`, or it falls back to another font.
- **UI scale** (`app.css:135-140`): xs 0.65 rem (about 10.5 px), sm 0.72 rem, body 0.78 rem
  (about 12.5 px), md 0.85 rem, lg 1 rem (16 px), xl 1.25 rem (20 px).
- **Marketing scale** (BRAND §4): Display XL 64/72, Display L 48/56, H1 36/44, H2 28/36,
  Lead 20/30 (px, web).
- **Video precedents:**
  - Smoke test (`smoke-test.html:69-113`): title 168 px Outfit 600, -0.02em, line-height 1;
    headline 132 px 600, -0.02em; CTA 64 px 500.
  - `scripts/compose-poster.py`: Outfit 600, tracking -0.0175 em, ink `#e6edf3`, URL in
    `#a8b3bf` at 0.42 of headline size, defaults `--top 0.60 --width 0.76`.
- **Letter-spacing elsewhere in the app:** small caps labels use +0.04 to +0.08 em
  (`app.css:523, 1140, 1687, 1970, 2554, 2721`). Uppercase micro labels track positive; display
  type tracks negative.
- **Font files:** the app self-hosts variable woff2 through `@fontsource-variable/*` 5.3.0
  (`src/lib/self-hosted-fonts.ts`: Google Fonts was dropped over LG München I, 20 Jan 2022,
  3 O 17493/20). Available locally:
  - `node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2` (+ latin-ext)
  - `node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2` (+ opsz and
    italic variants)
  - `node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2`
  - Licence: each package's `LICENSE` (SIL OFL 1.1). Copy the file and its licence into the
    HyperFrames project's `assets/fonts/`.
  - `house-rules.md:17` still says "Not vendored. Download from google/fonts", and the smoke test
    downloads `Outfit[wght].ttf` from the unpinned `google/fonts` `main` branch
    (`smoke-test.sh:51-54`). The fontsource copies are pinned by `pnpm-lock.yaml` and are the
    better source.
- **Package families register as `'Outfit Variable'`** and so on. `tools/font-aliases.ts`
  re-registers them under the plain names. In a composition, declare the plain name yourself:

  ```css
  @font-face {
    font-family: 'Outfit';
    src: url('assets/fonts/outfit-latin-wght-normal.woff2') format('woff2');
    font-weight: 100 900;
  }
  @font-face {
    font-family: 'Inter';
    src: url('assets/fonts/inter-latin-wght-normal.woff2') format('woff2');
    font-weight: 100 900;
  }
  ```

  `product-hero-realism.md:35` warns that headless Chrome renders `-apple-system` as Times.
  HyperFrames lint flags `font_family_without_font_face`.

**Proposed video type ramp for a 1920x1080 teaching film.** These are my proposal, derived from
the precedents above and phone legibility. A 16:9 video shown full-width on a 390 px phone is
scaled by about 0.2, so 48 px becomes about 10 CSS px.

| Role                    | Font / weight             | Size at 1080p | Tracking   |
| ----------------------- | ------------------------- | ------------- | ---------- |
| Chapter / hero title    | Outfit 650-700            | 120-168 px    | -2%        |
| Scene title             | Outfit 600                | 88-104 px     | -1.5%      |
| Label on a diagram      | Inter 600 or Outfit 500   | 56-72 px      | 0 to -0.5% |
| Small label (minimum)   | Inter 500-600             | 44-48 px      | 0          |
| Numerics (cents, Hz)    | Inter 500, `tabular-nums` | 64-120 px     | 0          |
| Micro caps (axis names) | Inter 600 uppercase       | 32-40 px      | +6 to +8%  |

Micro caps at 32-40 px sit below the phone-legibility floor, so keep them for decorative
redundancy only.

### 2.6 Logo files and usage

`docs/branding/logo/meniscus2/` is "the only canonical source" (BRAND.md lines 66-79,
`house-rules.md:18`):

| File                                                | Use                                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `mark.svg` (512x512 viewBox)                        | Primary mark: quicksilver dome, pitch wave as the waterline. Byte-identical to `public/brand-mark.svg`. |
| `lockup-horizontal.svg` (1180x260)                  | Mark plus wordmark (live Outfit text). Header, docs, footer, email.                                     |
| `mark-mono-dark.svg`                                | Single ink `#e6edf3`, for dark grounds                                                                  |
| `mark-mono-light.svg`                               | Single ink `#0d1117`, for light grounds                                                                 |
| `og-image.png` (1200x630), `mark-512.png` (512x512) | Social card and raster master                                                                           |
| `favicon.svg`, `favicon-{16,32,180}.png`            | Favicons; `docs/branding/favicon/meniscus2/` has the full set including maskable and `favicon.ico`      |

Mark geometry (`mark.svg`):

- orb `circle r=246` clipped
- liquid path `M8,256 C96,164 164,164 256,256 S416,348 504,256 A248,248 0 0 1 8,256 Z`
- waterline stroke 22 in spectrum, round caps
- specular `ellipse cx=180 cy=128 rx=52 ry=26 opacity .85 rotate(-20)`
- hairline rim `#c3ccd6` at 0.35 opacity, width 4

The waterline is a sine-like pitch wave, an obvious carried object for a film: the wave can
become a lesson's pitch contour (the smoke test does this).

Usage rules (BRAND lines 99-109):

- Clear space equals the specular highlight diameter, about 0.25 of the mark height.
- Minimum size is 24 px on screen and 8 mm in print. Below 32 px, drop the meniscus ring and the
  wave's inner gradient.
- Do not recolour the chrome body to a flat colour, stretch it, add drop shadows beyond spec,
  rotate the wave, or put the gradient wordmark on a mid-tone ground.
- Replacing the mark means replacing the `public/` files, "never hand-copying the vector into a
  component".

Stale references in BRAND.md: `logo/explorations/`, `logo-explorations.html`,
`favicon/{v1,v2,v6}/` and `mascot-explorations.html` (MASCOT.md:74) no longer exist in the repo.
DOCS-AUDIT.md:203-207 moved them to `<user-dotfiles>/mercurypitch/branding/`.

TRADEMARK.md: use the TM mark now, and the R mark only after registration, per country (line 131).
The word mark "MercuryPitch" (standard characters) is the first filing. The guide is not legal
advice.

### 2.7 Imagery, motif, mascots

- **Hero motif** (BRAND §5 lines 205-216): a suspended mercury droplet or liquid-metal ribbon
  whose surface ripples into a soundwave or pitch contour. HDR studio light, obsidian ground, thin
  blue/teal/violet rim light. Textures: liquid-metal fields, oscilloscope or waveform grids, fine
  particle constellations in the spectrum. "Data as art: the piano roll and pitch canvas ARE brand
  assets." Prefer real product shots plus one abstract mercury hero. Photography: single subject,
  low key, one coloured rim, negative space, "No stocky 'happy people with headphones.'"
- **Motion signatures** (`house-rules.md:20`): "A liquid-metal droplet, spectrum rim light, the
  pitch contour as the persistent actor."
- **MASCOT.md is a v0.1 plan and is out of date.** It proposes an SVG + CSS mascot with states
  `idle, listening, celebrate, encouraging, focused, sleep`. What shipped is a raymarched WebGL2
  Merc (`src/lib/merc/`, `docs/agent/INDEX.md:146`) with `STATES = drop, idle, listen, sing,
lock, climb, celebrate, point, sleep, hop, hum, ride` (`constants.ts:13-26`) and views `front,
hero, threequarter, side` (`constants.ts:178-198`). Idle Merc "fills about 56% of the frame
  height and stands low" (`constants.ts:176-177`). MASCOT.md's rules still hold:
  - AI output is for ideation and marketing surround only;
  - the shipped mascot is human-authored;
  - `prefers-reduced-motion` gets a static pose;
  - "wobble encouragingly when you're off (never shaming)".
- **Merc in a HyperFrames film** (`src/lib/merc/renderer.ts`):
  - `capture?: boolean`: "No loop: renderAt(t) draws exactly t seconds after the last setState"
    (lines 38-39).
  - `continuous?: boolean`: setState is a soft transition at the current simulation time;
    `reset(name)` is the hard restart (lines 40-45).
  - `transparent?: boolean`: premultiplied alpha, "his floor light adds onto it" (lines 33-36).
  - `voiceAt?: (t) => {voiced, cents, level, steady, midi}` (`sim.ts:33-49`): narration or a sung
    example can drive Merc deterministically from a precomputed envelope or contour.
  - The simulation steps at `STEP = 1/240` s (`sim.ts:91`). A backward seek restores a snapshot
    and re-steps (`renderer.ts:557-575`), so random seeking costs time proportional to the
    segment length. That is fine for a renderer that seeks forward.
  - `setView`, `setPoseBias({yaw, lookX, lookY})` and `setLook` (palette) are all available.
  - Quality tiers are `low/medium/high/ultra` (`constants.ts:160-165`). Ultra is 9 spp and 128
    steps. Software-GL render time inside HyperFrames is **unmeasured**; benchmark before
    committing to Merc-heavy shots.
- **Nine "voice specialist" characters** in `public/characters/` (aria, blaze, echo, flux, glint,
  harmony, luna, nova, spark), about 1 KB SVGs with `idle/happy/focused/encouraging` states
  (MASCOT.md:26-31): the supporting cast.

### 2.8 Marketing plates (`docs/branding/marketing/README.md`)

- Plates carry no text. Type is composited in code with `scripts/compose-poster.py`, because
  generators drop or add punctuation: one dropped the full stop from "Find your pitch.", another
  produced `mercurypitch.com/mirror.`
- Generate at 9:16, then scale to width and centre-crop to exactly 1080x1920. Generators emit
  about 9:16.1, which letterboxes on a phone. Reserve the lower 55% as clean background.
- The one plate today is `cta-plate-pitch-curve.png` (1080x1920).
- For a YouTube thumbnail the same rule applies: a text-free generated or built plate, with the
  title composited in code.

---

## 3. The motion pipeline (motion-designer skill)

### 3.1 Pieces and authority order

`SKILL.md:18-34`:

| Piece                                                                                        | Where                                                                          |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Pipeline and non-negotiables                                                                 | `.claude/skills/motion-designer/SKILL.md`                                      |
| Motion Video Kit (vendored, read only, MIT, upstream `echris6/motion-video-kit` @ `255562b`) | `kit/business-motion-film/`                                                    |
| HyperFrames (renderer and composition contract)                                              | `hyperframes:*` plugin skills plus `references/hyperframes-bridge.md`          |
| Fresh critic                                                                                 | `.claude/agents/motion-critic.md`                                              |
| House rules (brand, facts, capture, licensing, output)                                       | `references/house-rules.md`                                                    |
| Measurement                                                                                  | `scripts/measure.py`, `scripts/reference_pass.py`, `references/measurement.md` |
| Shot grammar                                                                                 | `references/shot-grammar.md`                                                   |

The kit's rules override defaults, "except where Deviations at the end of this file says
otherwise". Skip `business-offers.md`. In-app micro-interactions are ordinary UI work and outside
this pipeline (house rules § In-app animation).

### 3.2 Pipeline steps

The skill (`SKILL.md` §§ 0-12) and the kit workflow (kit `SKILL.md` steps 1-9):

0. **Preflight** (`SKILL.md:53-62`, `hyperframes-bridge.md:30-44`). Node 22 or newer; FFmpeg
   with `ebur128`, `tblend`, `signalstats`, `scdet`; Python 3; `npx --yes hyperframes@0.8.97
doctor` green for FFmpeg and Chrome; `browser ensure` if needed. Then run
   `bash scripts/smoke-test.sh <empty-dir>`, once per session, and expect `SMOKE TEST PASSED`.
1. **Brief** (`SKILL.md:64-73`). Copy `BRIEF-TEMPLATE.md` to the project's `BRIEF.md` and fill
   every field. Front matter:

   ```yaml
   workflow: motion-designer
   flow: automation
   storyboard: no # HyperFrames meaning: no user checkpoint; the storyboard still goes to a critic
   renders: pre-authorized
   unattended: true
   message: ''
   audience: ''
   destination: '' # x-feed, reels, tiktok, youtube, landing-page, app-store, in-app
   aspect: 1920x1080
   sizes: 1920x1080, 1080x1920
   length: 30s
   fps: 60
   language: en-GB
   project_dir: output/motion/<slug>
   ```

   The body sections are Intent, Brand (logo files, hex, local fonts and licences), Facts, Assets
   (`path - what - where`), Style references, Audio (music, SFX, **"Voiceover (yes or no)"**),
   Must never appear, and Notes. Build `FACTS.md` with one line per fact:
   `claim | source (path and line or symbol) | how it was verified`. Patch the project's
   `CLAUDE.md` and `AGENTS.md` with the director block (§ 3.12).

2. **Study references** (`SKILL.md:75-92`). Run `python3 scripts/reference_pass.py <video> --out
<project>/study/<name>` (cuts at scene score at least 10, fast moments, an overview sheet and
   dense 20 fps sheets around events). Fill `study/<name>/NOTES.md` and distil `study/RULES.md`.
   Never copy footage, logos, layouts or music. With no references, use `motion-grammar.md` and
   pick 3-6 moments from `launch-film-notes.md`.
3. **Motion principles** (§ 3.3).
4. **Storyboard** (`SKILL.md:113-128`), in `STORYBOARD.md`:
   - One table: `time | shot line | what is on screen | what this moment is for | how it leaves |
which object carries into the next shot`.
   - Shot lines use the shot-grammar vocabulary.
   - About 12-15 compositions per 30 s, each about 1.4-3.5 s. The subject fills 60-85% in feature
     beats. Frame one is finished.
   - Name three signature moments without effect names. It must make sense with the sound off.
   - Then a storyboard critic round.
5. **Build** (`SKILL.md:131-154`):
   - Every value is a function of timeline time. No timers, unseeded randomness or `repeat: -1`.
   - Shared pieces come first: colour and type tokens, local fonts, shared 3D modules, and
     `HANDOFFS.md` with exact pixel positions of carried objects.
   - Each scene is a sub-composition with its own lab page, rendered to stills plus a 3-4 s clip,
     then a component critic round.
   - Carried objects land on exactly the same pixels on both sides of a cut.
   - Search the HyperFrames registry before hand-building a named technique.
   - `check` must report 0 errors before every render; final renders use `--strict`.
   - Builder subagents work in parallel on separate scenes, each given the brief, its storyboard
     rows, the tokens, the handoff table and its file path. One owner integrates.
6. **3D** (`SKILL.md:156-174`), only where it explains something physical or spatial (§ 3.14).
7. **Images and footage** (`SKILL.md:176-188`):
   - Prefer building in code. Real UI comes from the product, never from a generator.
   - Label generated shots as concepts.
   - Prompt generated shots with the geometry template (shot-grammar § 3).
   - Never let a model render text. Never fake a result.
   - Keep a generation ledger: model, prompt, seed, job id, accepted window.
8. **Audio** (§ 3.9).
9. **Critic loop** (§ 3.8).
10. **Quality bar** (§ 3.4).
11. **Honesty** (`SKILL.md:252-258`):
    - On-screen claims come only from the facts file.
    - No invented testimonials, ratings, prices, savings, warranties or results.
    - Label conceptual or generated material.
    - Separate what was measured from what a human must still watch or hear.
12. **Deliverables** (`SKILL.md:260-267`):
    - the MP4 in every requested size at 1080p60;
    - a music-only version;
    - a contact sheet;
    - `LEDGER.md` and the quality-bar results;
    - `DELIVERY.md`: licences for music, effects and fonts, the generation ledger, what was
      measured, and what a human should still check.

Operating mode (`SKILL.md:40-51`):

- `unattended: true` means never ask. Decide, log one line in `DECISIONS.md`, and continue. Stop
  only for a missing tool, a missing licence, or a claim the facts cannot support.
- No approval stops between steps. One-line status reports.
- API keys only in environment variables.

### 3.3 Motion principles

Skill principles (`SKILL.md:94-111`):

1. The thing in the front of the shot becomes the transition. It moves toward the camera while
   the next scene waits underneath.
2. One object carries the story across shots and keeps its identity.
3. One main movement leads, with smaller ones layered and overlapping. The frame never stops and
   starts all at once.
4. Speed always changes: land slowly enough to read, leave fast, and slow again on arrival. No
   linear motion.
5. Cut only when size, direction and subject match on both sides.
6. Every action produces a visible result.
7. Type is motion: big words enter from opposite sides and reveal the next scene. Type never sits
   over busy picture without a backing.
8. Vary the scale (close, wide, overhead, full-frame type). Never repeat a layout such as "a
   heading over three cards".

Kit six rules (`motion-grammar.md:5-12`): the foreground becomes the transition; one persistent
actor; density comes from hierarchy; change speed, never a constant drift; smooth does not mean
dissolves only (a hard cut works when subject, scale, direction and material match and motion
continues); show purpose as cause and effect.

Kit composition rules (`motion-grammar.md:14-21`):

- 60-85% fill;
- vary composition types (macro, wide, overhead, UI close-up, type impact);
- "Keep 1-2 reading targets at a time";
- type enters on opposing axes;
- hand objects across at exact pixels;
- "Keep one wipe direction and one title position through a sequence of similar shots. The
  outgoing title leaves before the wipe; the incoming title enters after it."

### 3.4 Quality bar numbers

From `SKILL.md:232-250`, `quality-bar.md`, `measurement.md:24-36` and `motion-grammar.md:44-49`.

| Check                    | Target                                                                                                                                                                                           | Tool                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Frozen time              | At most about 1 s per 30 s in total. No still stretch longer than about 0.5 s (skill) or 0.6 s (kit), except the final CTA.                                                                      | `measure.py render` § Holds                        |
| Hold definition          | A sample (0.1 s apart, 320 px wide) with mean luma change below 0.1 **and** largest pixel change below 16 (0-255)                                                                                | `--freeze 0.1 --noise 16`                          |
| Low motion               | Mean below 0.35 is listed; every run is reviewed by a critic; not an automatic fail                                                                                                              | `--low 0.35`                                       |
| Single-frame events      | Every pop explained. A jump changes at least 3x as many pixels (more than 24 luma, 960 px) as its neighbours; a pop is two jumps in a row                                                        | `--changed 24`, `events.csv`                       |
| Frame one                | A finished composition                                                                                                                                                                           | `frame-0.png`                                      |
| Loop seam                | Rejoins like an ordinary frame (seam no more than max(2 x p95, 0.5)) if the film loops                                                                                                           | `summary.md` § Loop seam                           |
| Text contrast            | At least 4.5:1 on settled text                                                                                                                                                                   | `check` contrast audit; critic for text on footage |
| Collisions / fly-through | None, including mid-transition. `check` compares text with text only; critics catch text over images                                                                                             | `check` layout audit plus dense sheets             |
| Brand colour             | Within about 3 per channel of the token                                                                                                                                                          | `measure.py color --at T --box X,Y,W,H`            |
| Loudness                 | About -14 LUFS punchy, -16 to -19 calm; true peak at most -1 dBTP; no clipping                                                                                                                   | `summary.md` § Loudness                            |
| Dynamics                 | Energetic at least about 3 LU LRA; calm 1.5-3 LU is fine                                                                                                                                         | ebur128                                            |
| Effects against music    | +3 to +4 dB in the effect's own band (whoosh +2 to +3); 2-8 kHz lift at most about 4 dB; sample peak at most about 6 dB over the music (8 for a signature hit); "body" 150 ms lift also reported | `measure.py audio --music-only`                    |
| Determinism              | Two renders give identical frames (framemd5)                                                                                                                                                     | `ffmpeg -map 0:v -f framemd5`                      |
| Pacing (30 s film)       | 12-15 compositions; beats 1.4-3.5 s; reading holds only on message frames, kept alive by a slow 3-5% push; end card about 1.5-2 s readable with gentle drift                                     | storyboard and critic                              |
| Fill                     | Lead subject 60-85% in feature beats                                                                                                                                                             | critic                                             |
| CTA                      | Readable at phone size for at least about 1.5 s                                                                                                                                                  | critic                                             |
| Mute test                | A first-time viewer understands it with the sound off                                                                                                                                            | critic                                             |
| Bar of taste             | "A critic would put it next to the references without it looking weaker. A video with no bugs is not the same as a good video."                                                                  | critic                                             |
| Stop rule                | Stop at the bar or when the remaining items are sub-frame or cosmetic. Six full-film ONE MORE PASS rounds in a row means stop and report the blocker.                                            | `SKILL.md:228-230`                                 |

Visual criteria the critic judges (`quality-bar.md:17-28`):

- no empty frames, and frame 0 finished;
- no collisions;
- equal spacing in rows, and aligned left edges;
- 60-85% fill;
- 3D without toy gaps, floating parts, tiling, top-down slabs or pops;
- pins on the thing they name;
- transitions that keep a carried object or matched direction;
- brightness: "home-services and consumer buyers rejected dark, moody openers". MercuryPitch's
  stage is dark by brand, so expect critics to test this. Mitigate with bright spectrum light and
  clear figure and ground.

Client rejection phrases (`quality-bar.md:36-45`): "Too basic: image, then video, then text.",
"So much space is being wasted.", "Some parts linger too long.", "Not spaced equally.", "It's not
elite; go harder.", "The first image looks too dark.", "The music doesn't match.", "The sound
effects feel unprofessional and jarring."

Measured progress example (`gauntlet.md:43-45`): frozen time went from about 10 s/36 s to
6.5/31.3, then 1.1/30.1, then 0.7/28.6 across four rounds, and LRA from 0.6 LU to 3-4 LU. The
Duo film shipped at 0.2 s frozen, a mix at -30 LUFS and true peak -12.9 dBFS
(`case-study-duo.md:22-28`).

### 3.5 Shot grammar vocabulary

Every named shot and technique in `references/shot-grammar.md` § 2, one line each. "Says" is what
it communicates; the tell separates it from its look-alike, the "wrong cousin"; registry items are
in brackets.

**Shot line format** (§ 1): `size · angle · lens · move · light · composition · time · out`.
Example: `MCU · eye level, three-quarter · 50 mm · slow push in, 4 % over 2.4 s · soft key left,
aqua rim · subject on left third, lead room right · real time · graphic match: droplet becomes
pitch dot`.

Rules:

- Choose a technique for what it says.
- Change size or angle between neighbouring beats, or give a reason.
- A signature technique (dolly zoom, crash zoom, freeze frame, camera roll, earth zoom) appears
  at most once per film.
- Motivate every move.
- "Static" still has life inside the frame.

Camera movement. In 2D, depth is a number per layer: a translating camera moves each layer by
1/depth, while zoom and rotate move all layers together.

- **Push in / dolly in:** a thought lands. Scale layers by `depth/(depth - travel)` for parallax.
  The cousin is a zoom (no parallax). [`parallax-device-dive`, `camera-rig-depth-stack`]
  HyperFrames' `push-in` is actually a zoom.
- **Pull out / dolly out:** the context arrives. The cousin is a zoom out (no new overlap).
  [`pull-back-reveal`, `parallax-unzoom`]
- **Slow zoom in or out:** pressure without approach. A uniform stage scale or FOV change.
  [`push-in`]
- **Crash zoom:** punctuation, a sting. A scale snap under 0.3 s with radial blur, then a
  breathing hold. [`cinematic-zoom`]
- **Dolly zoom:** the subject holds while the world becomes unreliable. Keep
  `distance x tan(fov/2)` constant. Once per film. [`camera-dolly-zoom`]
- **Pan and tilt:** two facts in one place, connected by a look. All layers move together.
- **Whip pan:** energy moves between spaces. A 0.15-0.3 s move with horizontal-only blur, the
  next scene entering at matched speed. [`whip-pan-cut`, `whip-pan`]
- **Truck / slider / tracking:** the world has layers. Near, mid and far at speeds like 1, 0.5,
  0.2. [`camera-rig-depth-stack`]
- **Crane up, down, over:** leave or arrive at human scale. "A crane over turns a scene into a
  diagram."
- **Arc and orbit:** show another side. The background slides; an arc stops at about a quarter
  turn.
- **Turntable:** inspect like merchandise. The object rotates; camera and background stay still.
  [`product-turntable`]
- **Through an object / pass through / zoom through:** change rooms through a threshold; this is
  the kit's fly-through and logo-as-portal. [`zoom-through-transition`]
- **Earth zoom:** a point inside a larger world. Nested layers scale along one axis. Example
  given: "the whole pitch canvas, then one note, then its waveform."
- **Programmed move (robo arm, hero cam):** precision and inevitability; natural in code.
- **Handheld:** presence, urgency. A seeded shake, never `Math.random()`. [`camera-shake`]
- **Static:** trust the composition. Life comes from inside the frame.
- **Camera roll, Dutch angle:** gravity is broken; rare in brand work.

Shot size:

- **Extreme close-up and macro:** the scene is this fragment (a cents readout, a droplet). Needs
  real magnification and a thin focus plane.
- **Close-up, medium close-up:** a face or device screen read as a whole thing.
- **Medium:** face and gesture together.
- **Wide, establishing:** place, time, context, with a job in the sequence.
- **Insert:** a story-relevant detail at real scale, such as the note landing.
- **Product hero:** the object as a portrait, with designed speculars.
- **Over the shoulder:** a near shoulder or device edge with the far subject sharp.

Angle:

- **Eye level:** equal and honest. Generators drift it lower.
- **Low angle:** monument, hero.
- **High angle:** observation, smallness. Generators snap it to top-down.
- **Top-down (overhead):** a plan or diagram. Avoid it on large textured 3D surfaces.
- **Three-quarter:** the default for faces and devices.
- **Point of view / object POV:** the world from the singer, phone or mic, which stays fixed.

Lens (Three.js `filmGauge = 36`, `setFocalLength(mm)`; vertical FOV for 16:9 / 9:16):

- 14 mm: 71.7 / 104.3. Looming spaces.
- 24 mm: 45.7 / 73.7. A body in its environment.
- 35 mm: 32.3 / 54.4. The storytelling wide-normal.
- 50 mm: 22.9 / 39.6. Looking without stretch.
- 85 mm: 13.6 / 23.9. Isolation.
- 135 mm: 8.6 / 15.2. Compression; needs distance.
- Anamorphic: oval bokeh and horizontal flare streaks. [`vfx-anamorphic-flare`]
- Tilt-shift: a rotated focus plane, so real scale reads as a model.

Light (3D and generated footage only; HTML is lit by the palette):

- **Three-point:** name key, fill and rim jobs.
- **Rim light:** a thread from behind, not a neon outline. The MercuryPitch spectrum rim is this.
- **Motivated:** every source could exist.
- **High key / low key:** contrast ratios.
- **Soft / hard:** the source size.
- **Volumetric:** needs a source and a medium.
- **Silhouette:** expose the background, starve the subject.
- **Chrome and glass:** reflections are the light, so use an environment map and broad soft boxes.

Composition:

- **Thirds or centre:** name the axis. Centre is ceremony; thirds is a relationship.
- **Symmetry:** demand the mirror.
- **Leading lines:** name the vector and where it lands.
- **Negative space:** absence as a mass. Feature beats still fill 60-85%.
- **Foreground interest, layered depth:** each plane has a job.
- **Lead room and look space:** space in front of the motion or the gaze.
- **Visual weight:** one winner per frame.
- **Figure and ground:** chrome on Obsidian needs a rim or a value step.
- **Clean frame:** nothing accidental at the edges.
- **Screen within a screen:** real UI only, captured or HTML.

Colour:

- **Palette as law:** name the allowed hues, ban the rest.
- **Natural grade:** no hidden teal-orange split.
- **Split toning:** name both hues.
- **Desaturation:** pull chroma, keep the accents.

Time and motion:

- **Speed ramp:** real time, a stretched beat, recovery, with speed matched at the joints.
- **Slow motion:** a slower progress curve that reveals mechanics, such as a needle settling on
  the note.
- **Freeze frame:** zero change, so it counts against frozen time. Use it only as the final CTA,
  or dress it. [`freeze-frame-dressing`, `beat-freeze-cut`]
- **Motion blur:** accumulated sub-frame samples. [`motion-blur`]
- **Loop:** the end state equals the start state.
- **Stutter:** dropped or repeated frames. [`stop-motion-cadence`]

Optical and in-camera effects:

- **Rack focus:** attention moves without a cut; the sharp plane changes. [`rack-focus`, `focus-rack`]
- **Shallow focus and bokeh:** disc highlights, not sticker edges.
- **Lens flare:** follows its source.
- **Halation:** bloom on highlight edges.
- **Vignette:** lens falloff, not a hard oval. [`vignette`]
- **Chromatic aberration:** fringes on high-contrast edges, stronger toward the frame edge.
  [`chromatic-aberration-wipe`]
- **Film grain:** different every frame. [`grain-overlay`, `grain-field`]
- **Light leak:** a wash that wounds the edge. [`light-leak`]
- **Double exposure:** additive shared density.
- **Masking and iris:** a shaped window that points. [`iris-reveal`, `sdf-iris`]
- **Morphing:** a shared contour with a designed midpoint.
- **Typography in the world:** words with scale, parallax and occlusion.
- **Floating UI:** planes in 3D from projected anchors (`templates/projected-overlays.js`).
  [`ui-3d-reveal`, `device-frame-stage`]
- **Particles:** countable, from a seeded generator.
- **Slit-scan:** ordered geometry in time. [`slit-scan-reveal`]
- **Oscilloscope trace:** MercuryPitch's own motif, a beam drawing a waveform with phosphor
  persistence. [`oscilloscope-trace`, `svg-stroke-trace` for a pitch contour drawing on]

Transitions, ranked:

1. **Carried object / match cut / graphic match:** the same shape at the same position and size,
   within about 2%. [`match-cut`, `type-match-cut`, `text-match-cut`]
2. **Match motion:** direction and speed continue across the cut.
3. **Foreground fly-through / zoom-through.**
4. **Whip pan cut:** one blur direction on both sides.
5. **Axial cut:** the same axis, a snap in scale.
6. **Smash cut:** an earned state, then its contradiction in brightness, scale and sound.
7. **Invisible cut:** an occluder for 1-3 frames.
8. **Wipe and iris:** one direction per sequence; titles leave before the wipe.
   [`directional-wipe`, `iris-reveal`]
9. **Dissolve:** two images at the midpoint, for time passing. Never the default joiner; a fade
   passes through black.

Also covered:

- J-cut and L-cut: "a whoosh that starts a few frames before the picture changes reads as cause".
- Rhythm: quick cuts need an accelerating curve; a montage claims through order; a split screen
  shows simultaneity.

Atmosphere:

- **Haze:** far planes paler and cooler; fog in the stage colour, measured.
- **Dust motes:** a light shaft with countable specks.

Prompting generated footage (§ 3). Use one shot per prompt with geometry, not mood:

```text
One continuous [N]-second [shot size] of [subject], [lens] at [camera height and pitch].
[Camera move: what travels or rotates, in which direction, how far, how fast, and what stays fixed.]
[Light: the source, its side and quality, the rim or back light.]
[Composition: where the subject sits, what fills the rest, and the near, mid and far layers.]
[Time: real time, slow motion, or a ramp and where it lands.]
[Palette: the allowed hues; everything else neutral.]
Stable geometry, no cut, no text, no logos, no watermark, [the wrong cousin, banned by name].
```

Tells table (§ 4, used by critics on dense sheets):

| Intended      | Look for                                             | Wrong cousin if instead               |
| ------------- | ---------------------------------------------------- | ------------------------------------- |
| Dolly or push | Near and far elements change overlap                 | Uniform scale: a zoom                 |
| Pan or tilt   | Everything shifts together                           | Near layers slide: a truck or crane   |
| Orbit or arc  | The background slides behind the subject             | Static background: a turntable        |
| Rack focus    | The sharp plane changes                              | Both sharp, or neither                |
| Whip pan      | Horizontal streaks, unreadable middle, one direction | Readable middle, radial or mixed blur |
| Match cut     | The same contour at the same place                   | A crossfade or a morph                |
| Match motion  | Speed and direction continue                         | A reset or stop at the cut            |
| Speed ramp    | Returns to real time, no pose jump                   | Slow motion throughout                |
| Dissolve      | Two images at the midpoint                           | Black at the midpoint: a fade         |
| Freeze frame  | Zero change, deliberate, final or dressed            | An accidental hold                    |

Anything else is looked up at `https://melies.co/cinematic-techniques/<category>/<slug>`
(categories: camera-movement, framing, camera-angles, lighting, composition, lenses, color,
time-and-motion, effects, editing, atmosphere, genre-looks, viral-looks). Add it to the file
after use.

### 3.6 Kit mechanism catalog (16 reusable moves)

From `motion-grammar.md:23-42`:

| Mechanism                     | What it does                                                               | Teaching use                                             |
| ----------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Foreground fly-through        | A claim or logo scales past the camera onto a pre-positioned scene         | Chapter title flies through into the first diagram       |
| Logo-as-portal                | The brand shape grows until its hole is the next frame                     | The meniscus orb opens into the pitch canvas (once)      |
| Selection to expansion        | A selected frame expands into the detailed workspace                       | One note on a staff expands into its waveform            |
| Materializing result          | A shell appears, then regions fill in order                                | A scale builds degree by degree                          |
| Persistent rails              | Paths survive a text swap and connect states                               | Staff lines or pitch grid stay while labels change       |
| Continuous canvas             | The camera moves over one layout; the selected item stays sharp            | The 3Blue1Brown-like default for theory                  |
| Artifact ring                 | Small artifacts orbit a stable centre sentence                             | Recap: chapter icons around the lesson's one sentence    |
| Card stack / fan              | Screens arrive and occlude; one becomes many or many resolve to one        | Exercise options resolving to the one to practise        |
| Perspective fold              | A panel folds to a strip; the next rises out                               | Rare                                                     |
| Exploded layers               | A product separates into physical layers                                   | Voice anatomy (breath, folds, resonance), if it explains |
| Registered decomposition      | The source stays recognisable while regions lift into categories           | A chord lifts into its three notes on the same staff     |
| Wall to one actor             | Overload collapses to a single subject                                     | The hook: "all these notes, one idea"                    |
| Carousel emphasis             | A rotating list with one bright active item                                | Note names cycling (C D E ...)                           |
| Colour-field takeover         | A gradient cloud for a brand handoff (once)                                | Intro or outro only                                      |
| Tile wipe                     | Grid tiles as a chapter break (sparingly)                                  | One chapter break at most                                |
| Request, picker, confirmation | A bubble anchors while a sheet rises, a choice is made, the state confirms | Showing the app exercise flow                            |

Launch-film notes (`launch-film-notes.md`; 28 films, links only). Mechanisms that transfer
directly to explainers:

- **01 TypeSafe:** "Keep one visual artifact on screen while the next proposition arrives."
- **03 Devin Voice:** a chart stays registered over the character while a caption advances.
  "Restrained overlays explain a concept."
- **12 Replit Canvas:** the camera travels a column; neighbours blur; new content appears before
  the old leaves.
- **13 Replit Parallel Agents:** persistent rails across headline swaps.
- **14 Adaline:** "a small consistent shape family (circles, thin lines, compact labels) can carry
  complex ideas quietly. Avoid low-contrast pale elements on the key message."
- **28 Extend:** registered decomposition.
- **22 Work Louder:** a hard cut stays cohesive when geometry, palette and motion continue.

Cross-film note: "Long founder/talking-head grammar and slow historical intros don't fit a
15-30s business ad." That is about ads; long-form explainers are where such grammar belongs.

### 3.7 Templates

- `templates/smoke-test.html`: the house example of a correct 5 s composition.
  - Root `#root data-composition-id="main" data-start=0 data-duration=5 1920x1080`.
  - The persistent actor `#contour-layer` (the spectrum pitch trail plus five note dots placed
    from the path) spans the whole film.
  - `#scene-a` (0-2.6 s) holds the lockup "Find your pitch." with the mark. `#scene-b` (2.2-5 s)
    holds "See every note." and `mercurypitch.com`.
  - At 2.15 s the lockup flies through (`scale 1 to 5`, `opacity 1 to 0`, 0.4 s `power3.in`).
    The scene B headline lands with `scale 1.12 to 1`, 0.7 s `expo.out`. The notes pop with
    `back.out(2.2)` and a 0.16 stagger. Slow pushes (`scale 1 to 1.035`, `sine.inOut`) keep the
    holds alive.
  - Frame 0 has the contour a third drawn, drawing at full speed and easing out only.
  - `<audio id="bed">` and `<audio id="whoosh" data-start="2.15">`.
- `kit/.../templates/component-lab.html`: an isolated lab for one Three.js component
  (`createScene(canvas) -> {render(t), anchors(t)}`), driven by a paused GSAP timeline and
  `hf-seek`. It loads unpinned GSAP and hard-codes the ALDER palette (`#f4f0e5`, `#0a211d`);
  replace both.
- `kit/.../templates/projected-overlays.js`: `mountLabels`/`updateLabels` (an evenly spaced
  label column with leader lines to projected 3D anchors; it assumes four labels) and
  `mountPins`/`updatePins` (photo cards that pop from pins, dock into a rail, then fly to the next
  scene's rectangles). Also hard-coded to the ALDER palette.

### 3.8 The critic loop

From `SKILL.md:208-230`, `gauntlet.md`, `critic-prompts.md` and `.claude/agents/motion-critic.md`.

- **The builder never judges its own work.** After the storyboard, each component, and each full
  render, spawn a **new** `motion-critic` subagent.
- **Give it only paths:**
  - `round` (storyboard / component / film / verification);
  - `artifact`;
  - `brief` (BRIEF.md);
  - `references` (study folder or "none");
  - `music_only` (film rounds with sound);
  - `skill_dir`;
  - `report` (in a fresh `review/critic-<n>/` folder);
  - `previous_report` for verification rounds.
- **Never tell it what you fixed or what you believe about the references.** The critic ignores
  such opinions and says so (`motion-critic.md:29-31`). It does not read the builder's notes,
  ledger, decisions or source.
- **Critic method** (`motion-critic.md:33-85`):
  - `measure.py render <artifact> --out <report_dir>/measure`, then read `summary.md`;
  - look at `frame-0.png`, `frame-last.png` and every contact sheet (0.2 s tiles);
  - for each transition and each single-frame event, make a 1 s / 20 fps dense sheet **and** a
    frame-exact sheet covering the whole transition (`--window <s> --fps <film fps>`);
  - `measure.py audio --music-only`;
  - crop into details with `ffmpeg ... crop=`;
  - judge it on mute;
  - check every on-screen claim against the facts file.
- **What it looks for** (`motion-critic.md:87-117`):
  - holds, empty frame, an unfinished frame one, collisions, contrast below 4.5;
  - transitions without a carried object, pops, linear motion;
  - wrong-cousin techniques and monotony;
  - "the default look of a generated video: a centred title on a gradient, everything fading
    in, labels in the corners or a frame border, glow on interface chrome, stock particle
    bursts, type that blurs while the camera scales it";
  - loop seams, toy 3D, and audio faults (music fighting the picture, effects louder than the
    music, harsh 2-8 kHz, boomy whooshes, cuts that miss the beat);
  - unlabelled generated content and claims not in the facts file.
- **Report format** (`motion-critic.md:119-137`):
  - verdict first: SHIP or ONE MORE PASS; component rounds return KEEP, REVISE or REJECT;
  - for verification rounds, every prior item marked FIXED, PARTLY or STILL PRESENT;
  - a **"Shots as read"** section (each shot's range and its reading in shot-grammar terms; a
    difference from the storyboard is a finding);
  - ranked problems with timestamp, screen region and one implementable fix;
  - the numbers relied on;
  - what pixels and numbers cannot judge.
  - Word limits: film 900, component or storyboard 450, verification 600.
  - The caller saves the returned text to the report path, since some harnesses block subagent
    writes.
- **Kit critic prompts** (`critic-prompts.md`):
  - component critic: "Judge only rendered pixels", contact sheet every 0.1 s, KEEP/REVISE/REJECT,
    under 450 words;
  - full-film critic: per scene "% empty frame, how many seconds it could lose", "Places where 3D
    would add real information", top 6-8 changes;
  - verification critic: FIXED/PARTLY/STILL PRESENT, ending with SHIP or ONE MORE PASS (at most
    3 fixes);
  - storyboard critic: chronology, provably true claims, distinct composition and job per beat,
    filler, CTA on mute.
- **Gauntlet rules** (`gauntlet.md:5-19`):
  - set the bar first;
  - split the work into independently improvable parts;
  - builder and judge are different agents;
  - critics judge pixels;
  - fix the largest gap first ("Don't average away a weak opening with strengths elsewhere");
  - verify with a new critic;
  - stop at the bar or at diminishing returns, "not after an arbitrary number of rounds";
  - keep a ledger.
- **Round types** (`gauntlet.md:21-29`): Storyboard, Asset, Component (stills plus a 3-4 s
  proof), Full film, Verification.
- **Ledger:** `LEDGER.md` columns `round | artifact | the critic's top findings | what changed |
the numbers before and after`.
- **Cost:** ALDER took one working day for 28.6 s; Duo took about 70 critic rounds for 40 s
  (`case-study-duo.md:23-24`). The handoff advises starting with a 10-15 s piece
  (`skills-handoff-2026-09-30.md` § 7).

Real defects critics caught (`gauntlet.md:31-41`, `case-study-duo.md:30-37`):

- an ease-out that began at full velocity and made a one-frame pop (fix: smootherstep and a tiny
  stagger);
- a wipe that spliced two titles into one word;
- a near top-down camera;
- a report card blank for 0.2 s between states (fix: crossfade in place);
- text flying through text;
- a retained heading 12 px off because its parent was pushing;
- a mislabelled photo;
- music fading before the logo;
- about 10 of 36 s frozen;
- three pure-black frames at an act change;
- a camera jolt on contact;
- a disclaimer pushed 31 px from the edge;
- effect gains solved against near-silent music;
- a sample with a 33 ms lead-in landing every hit 2 frames late.

### 3.9 Audio rules

From `SKILL.md:190-206`, `kit/.../audio.md` and `house-rules.md:84-93`.

- **Licensing (MercuryPitch):** no recorded music unless it is cleared for commercial use; UGC
  creator briefs carry no music at all. Save the licence text or receipt next to every track and
  effect and list them in `DELIVERY.md`. Rule source: `docs/plans/ugc-noise-integration.md`
  §§ 8, 393-407: "no recorded music, or platform-cleared commercial-use audio only."
- **Music:**
  - Match the energy to the viewer, not the genre, and keep it low.
  - Prefer clean licensed library music over generated. Never name a brand or artist in a music
    prompt.
  - "Chill still needs a pulse."
  - Structure the track to the film, with one section per scene group.
  - Reject tracks with near-silent intros or early decay.
  - Avoid vocals and humming, vinyl crackle, ukulele or whistling stock, trailer hits, EDM drops,
    risers, "anything epic".
  - Deliver 2-3 options at identical integrated loudness.
  - Library beat AI on the energetic film. Edit to picture: time-stretch so cuts fall on beats
    (120 BPM puts cuts at x.0 and x.5), stretch at most 0.5% between cuts, use the track's own
    final hit on the end card with equal-power crossfades on bar lines, and add a 5 ms fade-in.
- **Effects:**
  - One short, soft, rumble-free whoosh per **real** scene change, with little energy below
    150 Hz and an 80-400 ms rise. The rejected ones had 35-83% of their energy below 150 Hz.
  - Small clean clicks, pops, ticks and chimes only on real on-screen actions. Micro sounds on
    every small mechanical move, each at or below the local music peak.
  - Screen candidates with `sfx-candidates.py`: drop anything more than 50% below 150 Hz, more
    than 40% above 6 kHz, or noise-like.
  - Clean sources: high-pass about 150-220 Hz, low-pass about 9-11 kHz, click-free fades.
  - Soften sounds that cluster within 0.15 s (x0.6). Keep repeated sounds consistent.
  - Change one thing per round, named by timestamp.
  - If the music resolves on the logo, add no separate sting.
- **Mix:**
  - Mix inside the composition with per-track volume and automation dips under dense reading.
  - True peak at most -1 dBFS with a limiter; AAC 256k; copy the video stream untouched.
  - Calm film: -19 LUFS integrated after the music was lowered 30%. Energetic film: music at
    about -30 LUFS, whooshes +2 to +3 dB in band raising short-term loudness by at most 0.5 LU.
- **Music-only version:** always export one, from a sibling project with every effect `<audio>`
  marked `data-hidden` (`hyperframes-bridge.md:131-151`). Compare with `measure.py audio`. Use it
  to isolate complaints ("first check whether it's in the music").
- **"Cut every scene change on a beat"** (`SKILL.md:203`). HyperFrames has `hyperframes beats
[DIR]` to detect beats into `beats/<audio>.json`.
- **Deviations:** never run `offline-mix.py` unmodified (it pads to 40 s, dips at 14.0-17.1 s,
  lifts +7 dB after 37.2 s, and muxes without `-shortest`). Treat a `solve-sfx-gains.py` result
  at its 0.005 floor as "no reliable answer". Use `measure.py`, not `frozen-time.sh` or
  `loudness.sh`.

### 3.10 Composition rules that bite (HyperFrames 0.8.97)

From `hyperframes-bridge.md:73-97`, plus rules in the bundled HyperFrames skill
`dist/skills/hyperframes/references/frame-worker-core.md:45-90` and `npx hyperframes docs`:

1. One paused `gsap.timeline({paused: true})` per composition, registered at
   `window.__timelines["<data-composition-id>"]`. **Render length is the root's
   `data-duration`, not the timeline's.**
2. Timed elements carry `data-start`, `data-duration` and `class="clip"` (`data-track-index` is
   display only). Never tween `visibility`, `display` or `autoAlpha` on a `.clip`; animate a
   child.
3. Never pair a CSS `transform` with a GSAP tween of the same property; use `fromTo`, or centre
   with margin or inset (`gsap_css_transform_conflict`).
4. Two `fromTo` tweens on one target: the later one takes `immediateRender: false`, or a seek
   shows the wrong resting state (`gsap_repeated_fromto_without_baseline`). The smoke test's
   first draft hit this.
5. Every named font needs an `@font-face` with a local file. Every `<audio>` needs an `id`, or
   the render is silent. No `crossorigin` on media. No `<br>` in body text.
6. Scenes are sub-compositions (`data-composition-src`); otherwise lint warns
   `nested_structure_needs_subcomposition`. Bundled-skill rules for sub-composition files:
   - the file is one `<template>` fragment, with every `<style>` and `<script>`, including the
     GSAP load, inside it;
   - style the root by `#root`, never a class on the `data-composition-id` element
     (`subcomposition_root_styled_by_class` renders the scene unstyled);
   - put the full-bleed background on a full-duration `.clip` layer, not on `#root`;
   - prefix ids and classes with `<frame_id>-`;
   - the hero is visible by t 0.5 s, with `fromTo` entrances rather than CSS-hidden start states;
   - no exit tweens on non-final scenes ("the root transition IS the exit").
7. `data-layout-allow-overflow` is for a deliberate fly-through past the edge. Never use it, or
   `data-layout-allow-overlap`, to silence a real collision.
8. **One root composition per project.** `check` fails `multiple_root_compositions`, and
   `render --variables` does not reach the audio. Every other size, and the music-only version,
   is a sibling project (`<slug>-9x16/`, `<slug>-music-only/`).
9. `check` passing with warnings still needs reading. A lint error switches off the layout and
   contrast audits ("0 samples means nothing ran"). `render` continues past lint errors unless
   given `--strict`.
10. The `check` layout audit only compares text with text. The smoke test's title flying across
    the logo image went unflagged; critics catch these.
11. Pin GSAP locally (`assets/vendor/gsap-3.14.2.min.js` from jsdelivr) and pin Three.js to an
    exact version. The template's CDN URL and the kit lab's unpinned `gsap@3` are banned.
12. Deterministic everything: no `requestAnimationFrame` loops, `Date.now()`, `Math.random()`,
    physics history or `repeat: -1`. Three.js scenes take `render(t)` from the root seek clock.
13. Render capture path: the render summary's second line says `beginframe capture` (fast) or
    `screenshot capture` with `software gpu` (slow). `--browser-gpu` or `--no-browser-gpu`
    forces either. `--docker` gives deterministic fonts and Chrome.
14. **Media:** `data-media-start` (trim), `data-volume` (1 is 0 dB, up to 3.98 for +12 dB),
    `data-fade-in` and `data-fade-out` (linear clip-edge ramps), and `data-automation` volume
    lanes for ducking (and a `rate` lane for speed ramps).
15. **Variables:** `data-composition-variables` declares them on the sub-composition `<html>`;
    `data-variable-values` overrides them per instance; read them with
    `window.__hyperframes.getVariables()`. This is useful for reusing one diagram
    sub-composition across lessons.
16. **Caption keep-out** (bundled frame-worker rule): keep all content in the top ~83% (y ≤ 900
    on 1080), "even when Captions: disabled".
17. **"Visible text is short motion-graphics copy ... never a sentence from the narration."**
18. **"Build the whole shot, reveal across the full duration, never front-load."** "Dumping the
    whole canvas in the first ~25% then holding it is exactly what reads as a PowerPoint slide."

### 3.11 Measurement tools and their defaults

`scripts/measure.py` (standard library only; needs ffmpeg):

```bash
python3 scripts/measure.py render FILM.mp4 --out DIR [--every 0.2] [--low 0.35] [--freeze 0.1] [--noise 16] [--changed 24]
python3 scripts/measure.py dense FILM.mp4 --out DIR --at 2.4,7.0 [--window 1.0] [--fps 20]
python3 scripts/measure.py audio FILM.mp4 --music-only MUSIC.mp4 [--out DIR]
python3 scripts/measure.py color FILM.mp4 --at SECONDS --box X,Y,W,H
python3 scripts/reference_pass.py <ref.mp4> --out study/<name> [--cut 10.0] [--fast 8] [--dense-fps 20]
```

- `render` writes `summary.md` (probe, holds, low motion, single-frame events, loop seam,
  loudness), `motion.csv`, `frames.csv`, `events.csv`, `loudness.csv`, `frame-0.png`,
  `frame-last.png` and `sheet-NN.jpg` (5x5 tiles, one every `--every` s).
- Calibration readings on the dark MercuryPitch stage (`measurement.md:55-72`):
  - a static frame changes no pixel by more than 1-2;
  - slowly drifting type reaches 9-29 (largest change);
  - a thin pitch curve being drawn reads only 0.15-0.6 on the mean but 87-174 on the largest
    change;
  - a fly-through reads 8-17 on the mean.
  - "On a dark stage [0.35] also catches slow moves that are genuinely visible". Calibrate by
    rendering one still second and the slowest acceptable move.
- Contact sheets pick real frames (`select`, `-fps_mode passthrough`) stamped with their own time.
- Smoke-test render cost: 5 s at 1080p60 delivery took 18.8-19 s on 4 vCPU with software GL,
  about **3.8 s of wall time per second of film**. Two renders were byte-identical. On the owner's
  AMD GPU machine the whole smoke test took 63 s.

### 3.12 Directory conventions

- Projects live in `output/motion/<slug>/` (gitignored: `.gitignore:24-25`, "motion-designer
  video projects: HyperFrames sources, renders and review frames"). Never commit renders or
  projects. `output/marketing-captures/` is also gitignored (`.gitignore:23`).
- Durable sources (brief, facts, storyboard, compositions, ledgers): "ask the owner where they
  go". The convention for private originals is `<user-dotfiles>/mercurypitch/`
  (`house-rules.md:99-101`). This is still an open decision (`skills-handoff` § 8.2).
- Create a project with
  `HYPERFRAMES_SKIP_SKILLS=1 npx --yes hyperframes@0.8.97 init output/motion/<slug> --non-interactive`.
  `init` refuses a non-empty directory, so write `BRIEF.md` afterwards. Append the director block
  to the generated `CLAUDE.md` and `AGENTS.md`:

  ```markdown
  ## Director: motion-designer

  This project is directed by the `motion-designer` skill. `BRIEF.md` is the
  confirmed brief: do not run the `/hyperframes` intent interview or route to
  another workflow. Use the HyperFrames domain skills (core, animation,
  keyframes, cli, audio, media-use, registry) for technical questions only. When
  `BRIEF.md` says `renders: pre-authorized`, render without asking. Every render
  is judged by a fresh `motion-critic` subagent, never by the builder.
  ```

- Inside a project:
  - `index.html` (the single root) and `compositions/` (scene sub-compositions);
  - `assets/vendor/` (pinned GSAP, Three.js), `assets/fonts/` (with licence files),
    `assets/brand/`, `assets/audio/`;
  - `renders/`, `review/critic-<n>/`, `study/<name>/` plus `study/RULES.md`, `shots/`
    (snapshots);
  - the documents `BRIEF.md`, `FACTS.md`, `STORYBOARD.md`, `HANDOFFS.md`, `DECISIONS.md`,
    `LEDGER.md`, `DELIVERY.md`, plus the generation ledger.
  - Sibling projects: `<slug>-9x16/` and `<slug>-music-only/`.
  - HyperFrames' optional `SCRIPT.md` holds locked narration (§ 3.13).
- Never run `hyperframes skills`, `hyperframes skills update` or `npx skills add`. Always set
  `HYPERFRAMES_SKIP_SKILLS=1` for `init`. Opt out of telemetry with
  `HYPERFRAMES_NO_TELEMETRY=1` or `DO_NOT_TRACK=1`, or run
  `npx --yes hyperframes@0.8.97 telemetry disable`.
- The pin is the contract. Upgrading means bumping `SKILL.md`, the bridge and `smoke-test.sh`,
  then running the smoke test. Latest upstream is 0.8.162 (`~/.hyperframes/config.json`).
- Shipped in-app media follows a different contract: a builder script in `scripts/`, plus
  `SOURCE-MANIFEST.md` and `BUILD-CONTRACT.json` with pinned hashes. Example:
  `apps/beside-cue/media-source/onboarding/corky-v2.6/` with
  `scripts/prepare-beside-cue-j2-greeting.mjs`. Never overwrite shipped media; add a version.
  Dialogue there is a separately registered audio cue: "never mux audio into an in-app
  onboarding video".

### 3.13 Voiceover and narration: what exists

**In the motion-designer skill itself: almost nothing.**

- The brief template asks only "Voiceover (yes or no)" (`BRIEF-TEMPLATE.md:57`).
- The quality bar assumes a film that "must make sense with the sound off".
- The kit's references are music-and-effects films. Talking-head grammar is called unsuitable for
  short ads (`launch-film-notes.md:129`).
- No rule covers voice levels, ducking, narration timing or captions.
- Narration-driven timing is therefore new territory for this pipeline.

**HyperFrames 0.8.97 has a full narration toolchain** (bundled docs in the npx cache):

- Route `faceless-explainer`: a "faceless explainer MP4 with invented typography, abstract
  graphics, diagrams, or data visualization. Sweet spot 30-90s; hard cap about 3 minutes." A
  10-minute lesson is beyond HyperFrames' own route envelope, which is another reason to build
  chapters as separately rendered and critiqued units.
- `SCRIPT.md` = locked narration (`references/script-format.md`). Its shape:

  ```markdown
  # SCRIPT — <slug>

  **Voice:** <voice> (<provider>)
  **Voice settings:** stability 0.35 · similarity 0.75 · style 0.20
  **Voice direction:** <overall delivery>

  ---

  ## Line 1 — Hook (Frame 1)

  **Time:** 0.0 – 3.0s (a guide; real timing comes from word timestamps)
  **Delivery:** <per-line note>

      <spoken text, indented: the only part fed to TTS>
  ```

  The storyboard's per-frame `voiceover:` key is the editable guide; `SCRIPT.md` is the commit.

- `hyperframes tts [INPUT] -o out.wav -v <voice> -s <speed> -l <lang>` is local **Kokoro-82M
  only**. Voices: af_heart (default), af_nova, af_sky, am_adam, am_michael, bf_emma,
  bf_isabella, bm_george, and non-English voices. Speed `0.7-0.8` suits tutorials. The Kokoro
  model is already downloaded here (`~/.cache/hyperframes/tts/models/kokoro-v1.0.onnx`). Use it
  for **scratch or animatic voice only**.
- `hyperframes transcribe <audio> [--model small.en] [--to srt|vtt -o file] [--engine
parakeet|whisper]` produces word-level timestamps `[{id,text,start,end}]` and exports
  **SRT/VTT** for YouTube captions.
- Providers: HeyGen returns word timestamps directly; ElevenLabs and Kokoro need a transcribe
  pass. The HyperFrames docs narrator is ElevenLabs "River" at **145-155 words per minute** with
  "music under it about -31 LUFS, never masking the voice".
- `media-use/scripts/audio-duck.mjs --meta audio_meta.json --target "#bgm"` writes a
  `data-automation` ducking lane. Defaults: duck 0.25 (-12 dB), attack 0.15 s, release 0.4 s,
  merge-gap 0.6 s. The engine's bed volume under a voice is `BGM_BED_VOLUME = 0.12` (about
  -18 dB).
- The production loop says: "when BGM plays under a voice, the bed is carved
  (`hyperframes-audio/scripts/carve.mjs`) before Verify — a duck alone is not a finished mix".
  `hyperframes-audio` is a plugin skill that is **not installed** in this container.
- Frame-worker rules for voiced films:
  - "Duration — fixed from real voice timing."
  - Reveal each piece "as the voiceover reaches it".
  - No `<audio>` inside scene sub-compositions; narration, music and effects are assembled at the
    root.
  - Visible text is never the narration sentence.
  - Caption keep-out is the bottom 17%.

**Merc voice assets in the repo** (`art/glass-adventure/voice/`):

| Version                              | What                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v1/`                                | Four original ElevenLabs Voice Design directions (`eleven_ttv_v3`, seeds in `batch.json`): A Warm Nimble, B Bright Playful, C Grounded Wry, D Gentle Whimsical, three previews each. No cloning; the descriptions say "never ... imitative".                                                                                                          |
| `v2/`                                | Three variations near D2: E Warmer Grounded, F Brighter Clear, G Quiet Playful (audition only).                                                                                                                                                                                                                                                       |
| `v3/`                                | Selection and enrollment: **"Merc V1 Gentle Whimsical D2", `voice_id B4fBPRmasEsTgd6YlSok`**, verified 2026-09-20 (`enrolled-voice.json`).                                                                                                                                                                                                            |
| `RUNTIME.md`                         | "Merc narration — approved D2". Playback policy and captions: "Captions remain available with Merc voice disabled."                                                                                                                                                                                                                                   |
| `v4/`                                | Six more D2 reactions with captions.                                                                                                                                                                                                                                                                                                                  |
| `v5-encores/`                        | Sung words in Merc's voice: ElevenLabs takes, then WORLD-vocoder resynthesis onto exact authored contours. Delivery at **-20 LUFS, -2 dBTP**. Independent pYIN check: median absolute error **2.6 cents** (`README.md:12-17`). Merc's native range is **D3** (`README.md:20`).                                                                        |
| `v6-melody-phrases/`, `v7-songbook/` | More sung phrases. Key rule at `v7-songbook/README.md:29-31`: "Creative sketches and scored reference examples have separate acceptance gates: ... an instructional reference must match the actual compiled contour and pass the production detector." Also: "Note names in a generation prompt are a request, not evidence of the resulting pitch." |

D2's design description (`v1/batch.json`, direction d): "Soft and androgynous with a clear intimate
register, gentle warmth, quiet wonder and an easy unhurried rhythm. Lightly melodic and whimsical
while remaining natural, intelligible and emotionally present." An orange Merc needs a contrasting
but compatible second voice. The repo holds unsaved candidates: C "Grounded Wry" (masculine-leaning,
warm low-mid, "understated dry comic timing") and B "Bright Playful" are the most distinct from D2.
Any choice needs owner listening and an enrollment like `v3/`. ElevenLabs keys stay in env vars.

### 3.14 3D and product realism (short)

- Use 3D only where it explains something physical or spatial. Light it like a product shoot: soft
  key on one side, rim behind. Camera pitch 35-55 degrees, never top-down on large surfaces, never
  ending tight on a flat one. No floating parts, gaps, flat black glass or repeating textures.
- Labels are HTML positioned from projected anchors each frame.
- Measure the rendered background against the brand colour. Under ACES tone mapping, compensate
  the HDR background by 1.1-1.9 per channel.
- Render contract: `createScene(canvas) -> {render(t), anchors(t), dispose}`,
  `preserveDrawingBuffer: true`, `setPixelRatio(1)`, `SRGBColorSpace`, `ACESFilmic`,
  `compileAsync` before resolve, and retime by `(t - start) * speed`.
- Use smootherstep `x*x*x*(x*(x*6-15)+10)` rather than a cubic ease-out, which pops on its first
  frame. Keep a slow "breathing" separation (+10-15%) after a lift.
- Realistic motion is measured from real footage (keys plus a monotone Fritsch-Carlson cubic);
  never blend keys with a smoothstep. Accumulation motion blur: 24 sub-frames on fast moves, a
  300-degree shutter easing to 180, ramped over 6 frames. Widen lights to fix glints rather than
  dimming them.
- Fonts: headless Chrome renders `-apple-system` as Times. Edit shared files through a `.next.js`
  copy plus `node --check`. Author the stage colour to what comes out after encoding
  (`#f5f5f7` decoded as `#f3f5f5`).

### 3.15 Product visuals and generated imagery (house rules)

- Real product UI comes from the product:
  `pnpm marketing:capture -- --recipe <karaoke-zen|jam-karaoke|piano-practice|singing-practice|voice-mirror>`
  against a local `pnpm run build:tours` build, written to `output/marketing-captures/`.
  `scripts/capture-marketing.mjs` hard-asserts loopback hosts and uses synthetic demo state.
  Never capture production or a real account, and never touch `api.mercurypitch.com`.
- UI rebuilt in HTML must match the shipped UI, and its component critic gets a captured still to
  compare against.
- Generators: text-free plates, labelled as concepts, centre-cropped to the exact canvas, prompts
  per shot-grammar § 3, all recorded in the generation ledger. Higgsfield and Google Flow have
  been used; any generator is acceptable.

### 3.16 Facts and the trap list

Facts authority, highest first:

1. the code;
2. `PRODUCT.md`;
3. `CHANGELOG.md`;
4. `BRAND.md`, for taglines only.

`docs/plans/` is intention; check `docs/agent/DOCS-AUDIT.md`, then the code. Known traps
(`house-rules.md:38-51`):

- "Hear yourself played back" must be checked against the current voice-history capability.
- The Voice Mirror asks for a glide up, a glide down, one held note, then five played notes sung
  back (`MATCH_NOTE_COUNT` in `src/lib/mirror/session.ts`). It takes about two to three minutes.
- `/mirror` needs no account and no download.
- Exercise scoring must not claim to assess pronunciation.

Lesson-specific example: the app's tuning reference A4 = 440 Hz is in
`src/lib/frequency-to-note.ts:25,62,129`. BRAND.md's "sub-cent accuracy" (line 14) is a brand
statement, not a verified fact; keep it off screen unless code or tests support it.

---

## 4. HyperFrames and prior motion work in the repository

- `grep -ri hyperframes` outside `output/`, `node_modules` and `.git` finds only:
  - `.gitignore`;
  - `AGENTS.md` (lines 22, 31-37: "motion-designer is where all video and motion-graphics work
    starts");
  - `docs/plans/skills-handoff-2026-09-30.md`;
  - the motion-designer skill files (SKILL, BRIEF-TEMPLATE, references, kit, templates, scripts).
- `grep data-composition-id` finds only the bridge reference, the kit lab template, VENDORED.md
  and the smoke-test template. **No composition, storyboard or brief exists anywhere in the
  repository.**
- `output/motion/lesson-01/` exists and is someone else's work in progress (not inspected). The
  HyperFrames cache shows activity on 2026-10-15: four successful renders, a 448-item registry
  cache in `~/.hyperframes/cache/`, and the Kokoro model downloaded.
- `docs/plans/skills-handoff-2026-09-30.md` holds the skill's provenance and audit:
  - the post: `https://x.com/RoundtableSpace/status/2105209785335373948`;
  - the kit: `https://github.com/echris6/motion-video-kit`;
  - the renderer: `https://github.com/heygen-com/hyperframes`;
  - Melies: `https://melies.co/cinematic-techniques`.
  - § 10 records the cloud evidence: the smoke test passed, `check` caught two real defects, the
    critic dry run went two rounds, and `measure.py` sampled `#0d1117` exactly.
  - "Not verified here: ... a full-length film with complete critic rounds; Three.js scenes."
- The closest prior "motion" work:
  - Beside Cue onboarding videos (`apps/beside-cue/media-source/onboarding/{corky-v2-preview,
corky-v2.4, corky-v2.5, corky-v2.6, pull-expansion-v1}/`): Google Flow footage plus FFmpeg
    builders with hash-pinned manifests, a 24 fps frame-exact transition spec (8/4/8/6 frames),
    and dialogue as a separate cue.
  - The Glass "shatter replay video" was planned as Phase 2 (`docs/plans/glass-handoff-2026-07-17.md:407`).
  - Merc voice and singing production lives in `art/glass-adventure/voice/`.
  - The concept art `art/glass-adventure/concepts/floating-museum-direction.png`.
- HyperFrames registry items relevant to lessons, from the cached catalogue:
  - sound and pitch: `sine-wave`, `waveform`, `oscilloscope-trace`, `svg-stroke-trace`,
    `ripple-waves`, `ripples`;
  - chrome and liquid looks: `liquid-metal`, `chrome-orb`;
  - diagrams and data: `flowchart`, `flowchart-vertical`, `data-chart`, `mk-line-graph`,
    `animated-bar-chart`, `chart-story`;
  - editing: `match-cut`, `type-match-cut`, `text-match-cut`, `morph-swap`, `icon-morph-beat`,
    `rack-focus`, `focus-rack`, `pull-back-reveal`, `parallax-unzoom`, `camera-rig-depth-stack`,
    `zoom-through-transition`, `freeze-frame-dressing`, `drift-hold`, `titlecard-calm`;
  - annotation: `inline-highlight`, `marker-highlight`, `hw-underline`, `hw-callout-circle`,
    `hw-arrow`, `vox-annotate`;
  - typography: `per-word-rise`, `kinetic-type-swap`, `count-up`, `number-wheel`;
  - YouTube furniture: `yt-lower-third`, `yt-circle-pointer`, `yt-feather-highlight`,
    `yt-camera-move`.

  Run `npx --yes hyperframes@0.8.97 catalog --query "<beat>"` before hand-building.

- **Web-lesson reuse opportunity.** The CLI bundle ships a `<hyperframes-player>` custom element
  (`dist/hyperframes-player.global.js`, about 100 KB). Its attributes include `src`, `srcdoc`,
  `controls`, `muted`, `poster`, `playback-rate` and `audio-src`. The same chapter
  sub-compositions could therefore appear in the lesson page as scrubbable figures. This is
  unverified for SolidJS integration, bundle budget and reduced motion. The alternative is native
  Solid and SVG components that share tokens and geometry with the film.

---

## 5. Adapting the pipeline to a 4-12 minute YouTube explainer

### 5.1 What transfers unchanged

- The whole Gauntlet discipline: builder separate from judge, fresh critics on real renders,
  paths only, FIXED/PARTLY/STILL PRESENT verification, the ledger, and fixing the largest gap
  first.
- Determinism: every value a function of timeline time, a pinned toolchain, local fonts and GSAP,
  `check` at 0 errors, `--strict` finals, and two-render framemd5 identity.
- Honesty: on-screen claims only from `FACTS.md`, no invented results, generated material
  labelled. For lessons, also no fake learner scores and no claims the scorer cannot measure
  (`PRODUCT.md:133`).
- Frame one finished. Contrast at least 4.5:1. No text collisions, including mid-transition.
  Carried objects on exact pixels. Palette as law, with brand colour within 3 per channel.
- Shot grammar and its wrong-cousin tells, along with the rules "a signature technique at most
  once" and "motivate every move".
- Principles 2 (one persistent actor), 3 (hierarchical overlapping motion), 4 (eased speed
  changes, no linear motion) and 6 (cause, then visible result). For teaching, 6 becomes "every
  claim is demonstrated": say "a fifth sounds stable", then play it and show the two waves
  aligning at 3:2.
- Audio hygiene: a licensed or no-music rule, soft rumble-free whooshes only on real scene
  changes, a music-only (here: no-narration) stem, true peak at most -1 dBTP.
- The composition rules that bite (§ 3.10), especially one root per project and sub-compositions
  per scene. Each chapter is a sub-composition, and each diagram inside it may be a nested
  sub-composition reused through variables.

### 5.2 What must be adapted

| Topic                                   | Kit or skill rule (30-40 s launch film)                               | Teaching film (4-12 min) proposal                                                                                                                                                                                                                                                                                                           | Reason                                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distinct compositions (layouts)         | 12-15 per 30 s (24-30 per minute), 1.4-3.5 s each                     | **4-8 per minute** in explanation chapters (typically 8-15 s each). 10-20 per minute only in the hook, montages and recap. About 50-80 for a 10-minute film                                                                                                                                                                                 | A diagram must stay on screen while it is explained. Re-laying out every 2 s destroys the learner's spatial memory                                      |
| Visual events (the new unit of density) | The beat equals the composition                                       | **One visual event every 2-5 s** while narration runs: an element added, transformed, highlighted, annotated, or a camera reframe. No stretch longer than 6 s without an event; longer than 8-10 s on one framing calls for a camera move                                                                                                   | Keeps the kit's density at the event level instead of the layout level. It is the frame-worker "reveal across the full duration, never front-load" rule |
| Longest time on one composition         | About 3.5 s                                                           | Typical cap **30 s**. Up to **45 s** only for one continuously transforming diagram that gets an event at least every 5 s                                                                                                                                                                                                                   | Continuous-canvas teaching (3Blue1Brown style). Past that, re-stage                                                                                     |
| Hard freeze (zero pixel change)         | At most about 1 s per 30 s, none longer than 0.5-0.6 s except the CTA | **Keep:** at most 1 s per 30 s, none longer than 0.5 s. Exemptions: one deliberate "think about it" pause per chapter, at most 2 s and dressed with Merc breathing or a slow drift, and the end screen                                                                                                                                      | Internal life is cheap, so true freezes are never needed. Stable layout is not the same as frozen pixels                                                |
| Low-motion runs                         | Every run reviewed by a critic                                        | **Expected.** Critics review only low-motion runs longer than 10 s that contain no visual event. Recalibrate `--low` on the lesson's own slowest acceptable "reading" shot (`measurement.md:69-72`)                                                                                                                                         | Reading needs calm, and `--low 0.35` on a dark stage flags almost every explanation                                                                     |
| Internal life during a held diagram     | Slow 3-5% push                                                        | **1.5-3% push or drift per 10 s**, plus at most **one** ambient element (Merc idle, a slow playhead, a breathing highlight). Ambient motion never brighter or faster than the current reading target                                                                                                                                        | Coherence and signalling: ambient motion must not compete with the thing being explained                                                                |
| Narration pace                          | none                                                                  | **140-155 words per minute** (HyperFrames' docs narrator runs 145-155). About 1,400-1,550 words per 10 minutes. At most about 25 words per sentence                                                                                                                                                                                         | Beginners, a music vocabulary, and a whimsical voice that should not be rushed                                                                          |
| Word-to-picture sync                    | none                                                                  | The visual for a named object starts **-0.2 s to +0.1 s** around the onset of the word that names it, read from `transcribe` word timestamps                                                                                                                                                                                                | Temporal contiguity. Gives a measurable sync target for the critic                                                                                      |
| Landing a key idea                      | Readable landing, fast exit                                           | After each key idea, **0.6-1.2 s** of narration silence while the visual completes                                                                                                                                                                                                                                                          | "Let it land"                                                                                                                                           |
| Scene changes                           | Cut on a music beat                                                   | Cut in a **narration gap of at least 250 ms**, with the picture changing **2-6 frames before** the next line (a J-cut). Chapter changes get 1-2 s with the chapter card                                                                                                                                                                     | The narration is the clock, not the music                                                                                                               |
| On-screen text                          | "Type is motion"; 1-2 reading targets                                 | Keywords only: labels of **4 words or fewer**, definitions of **10 words or fewer**, **never the narration sentence**. On screen for at least **1.0 s + 0.3 s per word**. 1-2 reading targets at a time                                                                                                                                     | Redundancy principle; matches the HyperFrames frame-worker rule                                                                                         |
| Text size at 1080p                      | Smoke test 168/132/64 px                                              | Minimum **48 px**; labels 56-72; titles 96-140; numerics 64 or more, tabular                                                                                                                                                                                                                                                                | Phones show a 16:9 frame at about 20% scale                                                                                                             |
| Caption keep-out                        | none                                                                  | Keep key content above **y ≤ 0.83 x H** (900 px at 1080)                                                                                                                                                                                                                                                                                    | YouTube captions and the HyperFrames rule                                                                                                               |
| Fill                                    | Subject 60-85% in feature beats                                       | The diagram fills 60-85% of the area above the caption line. When a host shares the frame, Merc takes **15-30% of frame height** and the diagram 55-70%. Host-only beats use Merc's front framing (56% of height)                                                                                                                           | Hosts must not crowd the explanation                                                                                                                    |
| Layout consistency                      | Principle 8: vary scale, never repeat a layout                        | Keep **one home diagram frame** for pitch (time horizontal, pitch vertical, low at the bottom, reference amber, singer violet), the same across chapters and lessons. Vary scale **between** chapters, not arbitrarily within one                                                                                                           | A consistent spatial model teaches; it also matches the product                                                                                         |
| Signature techniques                    | Once per film                                                         | Each still at most once per film; **at most one signature per chapter**                                                                                                                                                                                                                                                                     | Long films invite repetition                                                                                                                            |
| Hook and opening                        | Frame 0 finished                                                      | Frame 0 finished. **The question is stated by 0:15** and the promise of the payoff by 0:30. Cold open first, then the title or intro sting within 5 s at most                                                                                                                                                                               | YouTube retention                                                                                                                                       |
| Ending                                  | End card 1.5-2 s                                                      | **Recap 20-40 s**, then an **end screen of 15-20 s** with gentle drift, its element zones kept clear                                                                                                                                                                                                                                        | YouTube end screens use the last 5-20 s                                                                                                                 |
| Chapters                                | none                                                                  | **60-150 s each**, 4-8 per 10 minutes. The description's chapter list starts at 0:00, with at least 3 chapters of at least 10 s each. A visible chapter marker on screen                                                                                                                                                                    | YouTube chapters (verify current Help)                                                                                                                  |
| Sound-off test                          | Must make sense on mute                                               | Must make sense **with captions on and sound off**. **Every audio example has a visual twin** (contour, keys lighting, waveform)                                                                                                                                                                                                            | Narration carries the meaning, and "Your voice, made visible" is the brand promise                                                                      |
| Loudness                                | -14 punchy, -16 to -19 calm, TP ≤ -1                                  | **-14 LUFS integrated ±1**, TP at most -1 dBTP. Voice around -16 to -14 short-term. Music bed under the voice at **-28 to -32 LUFS short-term** (the HyperFrames narrator spec says -31). Duck about -12 dB with 0.15 s attack and 0.4 s release, then carve                                                                                | YouTube normalises playback toward about -14 LUFS (it lowers louder content and does not raise quieter content)                                         |
| Music                                   | Low, cut on beats                                                     | **No music under any musical example, and none under explanations of pitch or intervals.** A bed only in the hook, transitions and outro. If tonal, in the lesson's key. Licensed or none (house rule)                                                                                                                                      | A tonal bed clashes with the examples and contaminates ear training                                                                                     |
| Effects                                 | One soft whoosh per real scene change; clicks on real actions         | The same, plus: **nothing within 0.5 s of a musical example**, no pitched effects at all in pitch lessons, and at most one small tick per 3 s on reveals, each below the voice                                                                                                                                                              | Pitched effects would read as notes                                                                                                                     |
| Musical examples                        | none                                                                  | Synthesised **deterministically** (piano or sine samples rendered offline, or the app's own synth) and **verified to pitch**: median error 5 cents or less by pYIN. Sung examples follow the v5/v7 rule: an instructional reference must match the authored contour and pass the detector. TTS "singing" never counts as evidence           | `v7-songbook/README.md:29-31`                                                                                                                           |
| Critic rounds                           | Storyboard, component, film, verification                             | Add a **script round** before the storyboard (accuracy, one idea per chapter, misconceptions, pace in words per minute). **Per-chapter component rounds with narration** (each chapter about 1-2.5 min). Film rounds **split by chapter range** (2-4 critics) plus one **structure critic** for the arc, chapter balance and retention dips | A 900-word report cannot cover 10 minutes, and 70 rounds across a whole film is unaffordable                                                            |
| Contact sheets                          | Every 0.2 s                                                           | Use `--every 1.0` for whole-film rounds (600 tiles, 24 sheets per 10 minutes), `--every 0.2` per chapter, plus dense sheets at every chapter and scene transition                                                                                                                                                                           | 0.2 s over 10 minutes is 3,000 tiles                                                                                                                    |
| Render                                  | 1080p60, about 3.8 s wall per second of film (4 vCPU, software GL)    | Draft at **1080p30 `--quality draft`** for animatics. Deliver **1080p60**, or 2160p60 if the measured render time allows (about 38 min per 10-min film at 1080p60, before any Merc WebGL cost)                                                                                                                                              | Feasible, but render chapters separately while iterating                                                                                                |
| Sizes                                   | 1920x1080 plus 1080x1920                                              | YouTube 1920x1080 primary. Optional Shorts are separate sibling projects recomposed at 9:16, never letterboxed                                                                                                                                                                                                                              | One root per project                                                                                                                                    |

### 5.3 Narration-driven workflow (proposed order of work)

1. **Brief** with `destination: youtube`, `aspect: 1920x1080`, `sizes: 1920x1080`, `length:
~8m`, `fps: 60`, `language: en-GB`, and Audio set to "Voiceover: yes (Merc D2 plus orange
   Merc TBD)". Write the learning objectives into Intent: 1-3 testable outcomes. Build `FACTS.md`
   with theory claims and their sources (for example A4 = 440 Hz, the 12-TET semitone ratio
   2^(1/12), 100 cents per semitone) and app claims with code references.
2. **Script first** (`SCRIPT.md`, locked lines, one section per storyboard frame), then a fresh
   critic on it. A teaching film's timing comes from the voice, so the script is the true
   storyboard input.
3. **Scratch voice:** Kokoro `--speed 0.85-0.95`, then `transcribe --model small.en`, giving word
   timestamps and an animatic timing table. This makes the storyboard's time column real rather
   than estimated.
4. **Storyboard** per chapter. Each row gets a shot line, a `voiceover:` cue, events with their
   word anchors, and the carried object. Then a storyboard critic.
5. **Build** shared tokens, fonts, the home pitch-diagram component, the Merc capture wrapper, and
   `HANDOFFS.md`. Then chapters in parallel, each lab-rendered with scratch voice for a component
   critic.
6. **Final voice:** ElevenLabs Merc D2 plus the chosen second voice. Re-transcribe, re-time
   ("Duration fixed from real voice timing"), and re-verify the sync tolerances.
7. **Musical examples:** render them offline and verify by pitch. Each example gets an explicit
   "listen" beat (music out 300 ms before, the example with its visual twin, then 0.5-1 s of rest
   before the narration resumes). Play interval-recognition examples at least twice.
8. **Music bed and effects** last. Duck and carve, measure with `measure.py audio` against a
   no-effects sibling, and also render a no-narration stem for diagnosis.
9. **Film rounds** by chapter range, then a structure critic. Stop rules as before.
10. **Deliver:**
    - MP4 (1080p60, and 2160p60 if feasible);
    - SRT and VTT from `transcribe --to srt`;
    - the chapter list with timestamps;
    - a thumbnail (1280x720, text composited in code over a text-free plate);
    - the music-only and no-narration versions;
    - `LEDGER.md`, `DELIVERY.md` with font, music and voice licences;
    - a list of what a human must still hear: voice warmth, example tuning by ear, the mix on
      phone speakers.

### 5.4 Host direction (blue Merc and orange Merc)

- Give each host a job, not decoration. The shared Merc renderer already reacts to a voice
  (`voiceAt`). Blue Merc as the singer, mirroring the product's violet singer trace, and orange
  Merc as the reference, mirroring the product's amber reference melody, makes "copy the
  reference" demonstrations self-explanatory and colour-blind safe.
- Never use orange as an error colour and never set it beside the yellow "okay" band without a
  label.
- On-screen hosts take 15-30% of frame height in teaching beats and stay outside the diagram's
  reading path, with look space toward the diagram. Host-only beats (hook, transitions, jokes)
  can take the 56%-height front framing. Merc is "about 56% of frame height and stands low"
  (`constants.ts:176-177`).
- Merc's native sung range is around D3 (`v5-encores/README.md:20`). Examples above it should be
  sung by the orange host, if its voice suits, or played on an instrument.
- Lines stay in brand voice: encouraging, never shaming. The playful quips belong to the hosts;
  explanations stay literal.

### 5.5 Web lesson page implications

- The house rules' in-app animation section applies (`house-rules.md:115-124`): principles 3, 4,
  6 and 7; eased, never linear; **always ship a reduced-motion variant** that keeps every state
  and message without rotation, travel or parallax (also `PRODUCT.md:146`); check at a phone
  viewport with `mobile-ui-check` or `app-check`.
- Use app tokens (`--bg-*`, `--text-*`, `--accent`, `--teal`, `--purple`) and the self-hosted
  fonts. Add the chrome tokens and `--grad-spectrum` locally to the lesson module, since app.css
  lacks them (BRAND §8 checklist item 3 is unchecked).
- Canvas-only information needs labels or summaries for assistive technology
  (`PRODUCT.md:145`).
- Keep diagram geometry shared between film and page: the same SVG paths and the same home pitch
  frame, so the explorer and the film read as one system.

---

## 6. Discrepancies, stale docs and risks

1. `BRAND.md` lists `--text-muted #6e7681`; the app now uses `#868f9a` (`app.css:48`), and
   `#6e7681` is `--text-disabled`. The house-rules contrast note about `#6e7681` (4.1:1) is still
   correct for that hex.
2. The chrome tokens and `--grad-*` gradients exist only in `BRAND.md` (checklist item "Add the
   Mercury/Chrome tokens to app.css" is unchecked). The logo SVG uses different chrome stops from
   `--grad-mercury` (`#3d4b5c` against `#1b2430` at the edge).
3. `BRAND.md` and `MASCOT.md` point at files that moved to dotfiles: `logo/explorations/`,
   `logo-explorations.html`, `favicon/{v1,v2,v6}`, `mascot-explorations.html`.
   `DOCS-AUDIT.md:197` says the "three top-level logo SVGs" were kept, but BRAND says they were
   deleted, and they are absent.
4. `MASCOT.md` (v0.1, SVG plan, six states) does not describe the shipped WebGL2 Merc (twelve
   states, its own palette).
5. `house-rules.md:17` says fonts are not vendored, but the fontsource woff2 files are present and
   pinned. `smoke-test.sh` downloads Outfit from unpinned `google/fonts` `main`.
6. The kit's `component-lab.html` and `projected-overlays.js` hard-code the ALDER palette and
   unpinned GSAP.
7. The `hyperframes-core` and `hyperframes-audio` plugin skills, which the bridge says to read
   before writing compositions, are not installed in this cloud container. Use the bundled
   `dist/skills/hyperframes/references/frame-worker-core.md`, `npx hyperframes docs <topic>` and
   the upstream repo instead.
8. HyperFrames telemetry is on (`~/.hyperframes/config.json`). Export
   `HYPERFRAMES_NO_TELEMETRY=1` in every session.
9. `scipy` is missing; `solve-sfx-gains.py` and `offline-mix.py` need it. `measure.py` does not.
10. HyperFrames' own explainer route caps at about 3 minutes. Long-form is outside its tested
    envelope, and the handoff never verified a full-length film. Build and critique by chapter,
    and expect render time, memory and Merc WebGL cost to need measuring.
11. "Must make sense with the sound off" conflicts with narration-led teaching. Redefine it as
    "with captions" (§ 5.2).
12. Colour semantics: orange against yellow and amber collide, and violet against blue collapses
    for colour-blind viewers (§ 2.4).
13. Music in pitch lessons can contaminate ear-training examples. Default to no bed under
    examples.
14. The kit's brightness note (buyers rejected dark openers) clashes with the obsidian brand.
    Answer it with a bright spectrum hero and strong figure and ground in the first 3 s rather
    than a lighter stage.

## 7. Open decisions for the owner

1. Where durable film sources live (`<user-dotfiles>/mercurypitch/...` or elsewhere). This was
   already open in `skills-handoff` § 8.2.
2. Orange Merc's voice (from the v1/v2 auditions or a new design) and its palette stops.
3. A music library and licence. The house rule allows licensed music or none.
4. Delivery resolution: 1080p60, or 2160p60 at about 4x the render time.
5. Whether the web lesson page embeds `<hyperframes-player>` figures or rebuilds them as Solid and
   SVG components.
6. The language variant for narration (en-GB per the brief template, or en-US for a YouTube
   audience).
