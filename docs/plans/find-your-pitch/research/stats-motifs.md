# Stats site motifs: what we can reuse for the tutorial series

Research report on https://dev.stats.maff.app (the picker) and https://dev.stats.maff.app/mercurypitch/
(the MercuryPitch repo report), done 15-16 Oct 2026 for the MercuryPitch music-theory and singing
tutorial series (web lessons plus HyperFrames explainer videos hosted by blue Merc and orange Merc).

Everything was fetched with plain GETs from the dev deploy (its robots.txt says: "Review deploy.
stats.maff.app is the one to index"). Nothing in /home/user/mercurypitch was modified.
Downloaded files were kept as data. The only code that ran was the live site in a headless browser
(for screenshots) and scripts I wrote myself in the scratchpad.

---

## 0. Summary for decision makers

- **The site has no chart library, no music engraving library and no animation library.** Every
  figure is hand-built SVG in one readable, unminified file (`/kit/app.ffcf540f.js`, 2,661 lines,
  with comments). The picker is a small Astro page with a minified 14.8 KB script.
- **Notation is engraved by hand, not with a SMuFL font.** Noteheads are rotated ellipses, stems
  and flags are paths, beams are four-point slabs, ledger lines are lines. Only clefs, rests and
  note-value glyphs come from **Noto Music** (Unicode Musical Symbols block, SIL OFL 1.1). No Bravura
  and no SMuFL on the site. (The MercuryPitch app itself already ships **VexFlow 5.0.0**, MIT, with
  Bravura and Academico for real engraving: `src/lib/sheet-music-renderer.ts`.)
- **The hero motif is a Chladni plate**: a canvas of up to 6,000 grains that run to the nodal lines
  of `u = cos(n pi x) cos(m pi y) +/- cos(m pi x) cos(n pi y)`, retuned with a smoothstep blend and
  burst outward as a page transition. It maps directly to standing waves, harmonics and resonance.
  I de-minified it and made a **seekable, seeded version** (same frame gives the same pixels) for
  HyperFrames. Determinism was tested.
- **Typography**: Outfit (display, 600, tight negative tracking), Inter (UI), JetBrains Mono
  (uppercase micro labels with wide tracking), **Instrument Serif italic** (the poetic voice: tempo
  markings, taglines, tape labels) and Noto Music. All five are SIL OFL 1.1, checked from the font
  name tables. The MercuryPitch app already uses Outfit, Inter and JetBrains Mono, so the only new
  families are Instrument Serif and Noto Music.
- **Motion is restrained and CSS-first**: one easing curve (`cubic-bezier(.2,.8,.2,1)`), card
  fade-up 14 px over .7 s on scroll, a 140 s vinyl spin, a metronome swing whose period is 60/bpm,
  a plucked-string SVG path (fundamental plus 2nd harmonic, exp decay, 1.5 s), the living staff
  canvas, accent colours that cross-fade through a registered `@property`, and cross-document
  view transitions with speculation-rules prerendering. The report has a `Stage` system built for
  per-figure reveal and sound "performances", but no figure uses it yet.
- **Sound** is a Web Audio synth with 13 voices (harp, guitar, celesta, bowed pad, kick and so on),
  a compressor, a limiter, a soft clip and a seeded synthetic reverb. It is off by default, and the
  setting is shared across pages through localStorage. I extracted it with an offline WAV
  renderer, so a video can bake the same sounds. The render is perceptually deterministic but not
  bit-exact: differences are at most 1.8e-7, about -135 dBFS, from Chrome's biquad.
- **Reusable snippets** (9 files, listed in section 9) are tested in headless Chrome: staff
  engraving with true-size Noto clefs and accidentals, GSAP "jumping notes", the Chladni plate, the
  string and wave motifs, the instrument figures, the sound engine, the design tokens and the
  explorer interaction patterns.
- **Two live defects** to pass on: (1) the decorative clef on every movement header is clipped by
  `mask-image` (section 3.11); (2) Noto Music's F clef sits 100 font units low relative to its own
  staff, which matters only if we draw it ourselves (already calibrated in the snippet).

---

## 1. What was fetched (inventory)

Asset folder: `(session scratchpad, not kept)/stats/`

| Local file                                                       | URL                                                              | Size                | What it is                                                                                  |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `index.html`                                                     | `/`                                                              | 6.3 KB              | Astro picker: Chladni plate plus programme list                                             |
| `_astro__picker.Dmx7ti59.css`                                    | `/_astro/picker.Dmx7ti59.css`                                    | 7.1 KB              | picker styles                                                                               |
| `_astro__index.astro_astro_type_script_index_0_lang.z3pGBJ-u.js` | `/_astro/index.astro_astro_type_script_index_0_lang.z3pGBJ-u.js` | 14.8 KB             | picker script (minified): Chladni physics, renderer, burst, string pluck, picker sound      |
| `mercurypitch.html`                                              | `/mercurypitch/`                                                 | 215 KB              | report page; 188 KB of it is inline JSON (`#report-data`)                                   |
| `chaos-master.html`, `token-circles.html`                        | `/chaos-master/`, `/token-circles/`                              | 121 KB, 89 KB       | the same kit with other themes                                                              |
| `mercurypitch-report-offline.html`                               | `/mercurypitch/report-offline` (307 from `report-offline.html`)  | 826 KB              | single-file offline copy, 8 inline @font-face, `mode: "offline"`, synth voices only         |
| `kit__styles.8518bd74.css`                                       | `/kit/styles.8518bd74.css`                                       | 47.7 KB, 562 lines  | the report design system                                                                    |
| `kit__fonts.be0a576e.css`                                        | `/kit/fonts.be0a576e.css`                                        | 2.8 KB              | @font-face, header says "all families SIL Open Font License 1.1"                            |
| `kit__app.ffcf540f.js`                                           | `/kit/app.ffcf540f.js`                                           | 223 KB, 2,661 lines | sound-map.js, sound.js, stage.js, app.js joined, **unminified and commented**               |
| `kit__html-to-image.a90b4290.js`                                 | `/kit/html-to-image.a90b4290.js`                                 | 20.6 KB             | html-to-image UMD build (PNG export of cards)                                               |
| `favicon.svg`                                                    | `/favicon.svg`                                                   | 332 B               | Chladni-like four-arc glyph                                                                 |
| `fonts__instrument-serif-{regular,italic}.woff2`                 | `/fonts/...`                                                     | 21 KB / 22 KB       | Instrument Serif 1.000                                                                      |
| `fonts__inter-latin-var.woff2`                                   | `/fonts/inter-latin-var.woff2`                                   | 48 KB               | Inter 4.001, wght 100-900                                                                   |
| `fonts__outfit-latin-var.woff2`                                  | `/fonts/outfit-latin-var.woff2`                                  | 32 KB               | Outfit 1.100, wght 100-900                                                                  |
| `fonts__jetbrains-mono-latin-var.woff2`                          | `/fonts/jetbrains-mono-latin-var.woff2`                          | 31 KB               | JetBrains Mono 2.211, wght 400-800                                                          |
| `kit__fonts__noto-music-normal-{music,latin,latin-ext}.*.woff2`  | `/kit/fonts/...`                                                 | 56 / 16 / 10 KB     | Noto Music 2.003, split by unicode-range                                                    |
| `robots.txt`, `sitemap.xml`                                      |                                                                  |                     | dev deploy notice; sitemap lists `/`, `/chaos-master/`, `/mercurypitch/`, `/token-circles/` |

No standalone SVG files exist apart from `favicon.svg`. All other SVG is generated at runtime by
`app.js`, or inlined in the HTML (icons, brand mark).

Screenshots of the live site (Playwright, Chromium 1194, 1440x900):
`(session scratchpad, not kept)/stats/shots/`
(`picker.png`, `plate-lumen.png`, `plate-mercurypitch.png`, `plate-token-circles.png`,
`report-hero.png`, `score-zoom.png` at 3x, `score-zoom2.png`, `movement-head.png`,
`mv-staff-masked.png`, `mv-staff-unmasked.png`, and `fig-*.png` for every figure).

Report data shape (`#report-data` JSON keys): `meta` (key `"E minor"`, `sounds: null` meaning no
sample pack, so synth voices only), `kpis`, `loc`, `commits`, `tag_lines`, `prs`, `stars`, `issues`,
`tree`, `tree_excluded`, `extensions`, `wow`, `facts`, `readings`, `credit`, `audience`, `sources`.

---

## 2. Architecture in one paragraph

The picker (`/`) is Astro. It ships `picker-data` JSON (slug, key, accent colours, grain count,
weekly commit counts) and one module that drives the plate, the strings and the sound. Each report
page is static HTML with every card as a placeholder (`<article class="card" data-chart="score">`).
Cards are filled by `app.js` from `FIGURES` (line 2617). Each figure is `fn(card, chartEl, mode)`,
rendered inside a try/catch. Colours are read from CSS custom properties at boot (`token()`, line
868), so a theme is just a `:root` override. The bundle header names the build: `kit/scripts/
build_report.py` joins `kit/template/sound-map.js`, `sound.js`, `stage.js` and `app.js`, with tests
in `src/kit/*.test.ts` (that repository was not inspected).

---

## 3. Motif catalogue

Line numbers refer to `(session scratchpad, not kept)/stats/kit__app.ffcf540f.js`.

### 3.1 Chladni plate (picker hero), canvas 2D

Screenshots: `shots/plate-lumen.png` (D Lydian, orange), `shots/plate-mercurypitch.png` (E minor,
blue, mode 5,8, sign +1), `shots/plate-token-circles.png`.

**Draws**: a square brushed-metal plate (CSS gradients plus a 1.4% stripe every 3 px, a centre bolt
in `::after`, and a "bow" streak in `::before`). Over it sits a canvas of 1.6 px square grains, one
per commit, capped at 6,000.

**Physics** (bundle functions `X`, class `At`; de-minified in `snippets/chladni-plate.js`):

```js
u  = cos(n*PI*x)*cos(m*PI*y) + sign*cos(m*PI*x)*cos(n*PI*y)
gx = -PI*(n*sin(n*PI*x)*cos(m*PI*y) + sign*m*sin(m*PI*x)*cos(n*PI*y))
gy = -PI*(m*cos(n*PI*x)*sin(m*PI*y) + sign*n*cos(m*PI*x)*sin(n*PI*y))
// per grain, per step (n = dt*60, capped at 3):
M = gx*gx + gy*gy + 0.6
v = -0.085*n * u * grad / M                // slide towards u = 0 (the nodal lines)
|v| <= 0.012*n                              // speed cap
jitter = min(0.03*drive, 0.5*drive*sqrt(n)*|u|/sqrt(M))   // shaking proportional to |u|
x += v.x + (rand - .5)*jitter; reflect at 0 and 1
```

Grains on antinodes keep dancing. Grains on nodes come to rest. That is the real Chladni mechanism,
and the colophon says so: "sand on a vibrating plate settles where the plate stays still".

**Mode selection** (`ft`): a band by grain count (up to 900: (3,5),(2,5); up to 2,600: (3,7),(4,7);
above that: (4,9),(5,8),(3,8)), then `pairs[pitchClass % pairs.length]`. Minor keys add the two
terms (`sign +1`) and major keys subtract them (`sign -1`). Opening a project uses `n+1, m+2` with
`drive 3.4` and a 0.26 s blend.

**Retune**: a smoothstep blend of the two fields over 0.9 s. New grains scatter in and fade up at
1.6/s; retired grains drift outward (`(x-.5)*.035*n`) and fade out at 1.9/s.

**Rendering** (`Lt`): 8 tones ramp from accent-2 (oldest commits) to accent (newest), with alpha
`.5 + .5*(i/7)^1.2`. Grains are assigned to weeks in proportion to weekly commits (`Et`), so the
newest grains glow brightest. Each frame first erases 36% of the previous one (`destination-out`
fill `rgba(0,0,0,.36)`), which leaves short comet tails. Per-grain sub-pixel "grit" comes from a
xorshift32 seeded 2654435769 (amplitude 1.1 dpr), so square grains never align to a grid. The glow
is CSS: `filter: drop-shadow(0 0 5px color-mix(in oklab, var(--accent) 55%, transparent))`.

**Motion and interaction**: hovering a programme item retunes the plate, plucks that item's
string, cross-fades `--accent`/`--accent-2` (registered `@property`, 0.9 s ease) and, with sound
on, strums the key's chord. Clicking the plate cycles projects. The plate tilts up to 3.5 deg
towards the mouse (`perspective(1600px) rotateX/rotateY`, transition .7 s var(--ease)). If idle, it
auto-cycles (after 9 s without input and 7 s since the last change; `?cycle=0` disables it). The
loop stops itself when the plate is settled (`restlessness() < .012` for 7 checks) or off screen.
Under reduced motion it settles at once (`settle(6)`).

**Burst page transition** (`qt`): every lit grain flies out along its own ray. The radius is
`r0 * exp(f t)` with `f = ln(diagonal/2)/0.62 s`, drawn as `lighter`-blended 1.4 px streaks on a
fixed full-screen canvas, while the next page's background fades in at alpha `.16 + .84 (t/T)^2`.
Then `location.assign`, with `@view-transition { navigation: auto }` and speculation-rules prerender
making the landing instant.

### 3.2 The programme list with vibrating strings (picker), SVG plus CSS

Each project name is Instrument Serif at `clamp(2.5rem, 1.5rem + 3.4vw, 5rem)`, line-height .95,
at 38% opacity until hovered or selected. The key appears beside it in italic serif ("in E minor",
using the real flat sign). Under it is a `viewBox="0 0 1000 24" preserveAspectRatio="none"` SVG
hairline (`vector-effect: non-scaling-stroke`). On select it is **plucked** (bundle `Ot`/`Bt`):

```js
y(l, t) = 12 + 9 e^(-3.2t) [ sin(PI l) cos(2PI 7.5 t) + 0.35 sin(2PI l) cos(2PI 15 t + 0.6) ]   // 48 points, 1.5 s
```

That is a decaying **mode 1 plus mode 2 standing wave**, as a 1000 x 24 path. The selected string
takes the accent colour (`color-mix(in oklab, var(--accent) 85%, white)`). Arrow keys move focus.

### 3.3 The living staff (report hero), canvas 2D

`hero()`, lines 2468-2489. Five staff lines behind the 156 px wordmark (`report-hero.png`), fitted
to the h1: top at 20% and bottom at 86% of its height. Each line k has width `1 + .36k`, spatial
frequency `1.5 + .5k` and phase `1.7k`. The amplitude is `spacing * (.1 + .62*env(x)) * sin(PI x)`
(pinned at both ends), where `env` is weekly commit volume, cosine-interpolated. The time terms are
`t*.0011*(1+.17k)` and `.55 + .45 sin(t*.0006 + 1.3k)`. It is stroked twice with a blue-aqua-violet
gradient: a 6x-wide pass at 8% alpha for the glow, then the line at 55%. The canvas is masked at
both ends (`linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent)`) and paused off
screen. Reduced motion draws one frame. It is a pure function of t, so it is seekable as is.

### 3.4 The Pull Request Score, SVG engraving (see section 5 for the notation details)

`figScore`, lines 1801-1925 (`score-zoom.png`, `score-zoom2.png`). Every PR is a note in opening
order. One bar is one week in 7/4 (a beat per day). Systems wrap to the 1100 px width with a
justified scale, and the last system stretches by at most 1.25. Each system has a G clef glyph,
"7 over 4" set in Outfit 700, a serif italic bar number, boxed mono rehearsal marks for months,
aqua serif italic release tags (`v0.6.0`), a whole-rest block in empty bars, and a final barline.
Pitch is staff step from time to merge (`STEPS` table in sound-map.js, line 71: 5 min gives step 10,
a week or more gives -2). The note value is also from time to merge (up to 15 min a 16th, up to
1 h an 8th, up to 1 day a quarter, up to 1 week a half, longer a whole). Merged notes are coloured
along an aqua-blue-violet `speedRamp` by log duration. Closed PRs are a rose cross. Open PRs are a
brass diamond head with a fermata (an arc plus a dot) above.

**Playback**: "Play the score" builds its own AudioContext. It is a triangle oscillator on a
**pentatonic** map (`PENTA=[0,2,4,7,9]`, `freq(k)` from MIDI 55), 72 ms per note, a 0.21 s delay
with 0.3 feedback, and a compressor. Each note gets the class `playing` for 260 ms, which applies
`filter:url(#glow)`, a white stroke and stroke-width 1.4. A look-ahead scheduler with
`setTimeout(70ms)` skips late notes rather than piling them up. The "musical" version of the same
data, `SoundMap.scoreEvents` (lines 106-146: tempo map, ramped bar clock, strums of up to 6 notes
22 ms apart, kick on bars with merges, celesta on the first and fastest PR), exists in the bundle
but is not wired to this button yet.

### 3.5 The Piano Roll, SVG

`figPianoRoll`, lines 1541-1587 (`fig-pianoroll.png`). 24 rows map the 24 hours to two octaves,
C3 at 00h up to B4 at 23h, `rowH 12`. On the left is a keyboard 66 px wide: white keys with a
gradient `#cfd7e0 -> #f4f8fd -> #fff`, black keys at 60% width with a gradient
`#0b0f14 -> #2a323c -> #3b4552`, and mono 8 px labels ("C4 12h"). Rows behind black keys are darker,
and a hairline marks each octave. Cells are rounded rects inset 2 px (rx 1.4), coloured on a
log-scaled **heat ramp** (`blue 72% to bg -> darker blue -> blue -> aqua -> violet -> white`).
The hottest key is highlighted in aqua at 35% with a glow, and a "per hour" bar chart sits on the
right. Month ticks and weekly hairlines (opacity .05) run behind. This is the cleanest
"pitch versus time" visual on the site.

### 3.6 Step sequencer ("The Weekly Groove"), SVG

`figSequencer`, lines 1596-1625 (`fig-sequencer.png`). 7 tracks x 24 steps of rounded pads (rx 4,
gap 4). A heat inset has opacity `.2 + .8t`, and a white glowing LED marks the busiest fifth of the
steps. Coloured bars group the hours in fours, like TR-style step buttons (rose, rose-brass, brass,
ink, aqua, blue). A natural fit for rhythm, meter and subdivision.

### 3.7 Metronome, SVG plus CSS animation

`figMetronome`, lines 1628-1653 (`fig-metronome.png`). A 170x220 trapezoid body with a chrome
gradient, an inner well with 9 scale ticks, and an arm with a blue sliding weight. The CSS is
`@keyframes tick { from { rotate(-24deg) } to { rotate(24deg) } }`, ease-in-out, infinite,
alternate. JS sets `animation-duration` to `60 / commits-per-active-day`, clamped to 0.25-6 s. The
tempo mark "quarter note = 28" is set in Outfit 50 px with the Noto quarter-note glyph. It also
names the Italian tempo range (Larghissimo up to Prestissimo, `tempoName()`).

### 3.8 Fretboard, SVG

`figFretboard`, lines 1744-1796 (`fig-fretboard.png`). An ebony gradient board, 14 grain lines at
1.8% white, a bone nut `#e9e4d6`, pearl inlays at frets 3 5 7 9 15 17 19 21 and double dots at 12
and 24, and gradient fret wires (`c700 -> c100 -> c700`). Strings are 0.9 + 2.6 x weight thick,
with a `1 1.4` dash over the heavier ones to suggest winding. A ghost headstock carries pegs with
chrome radial gradients. Finger dots are sized by `sqrt(n)`, and the loudest gets a glow. Frets are
evenly spaced (a data chart, not a real guitar). For lessons, use `fretPosition()` in the snippet,
which gives the real 12-TET spacing.

### 3.9 The Orchestra (hemicycle seating), SVG

`figOrchestra`, lines 1219-1310 (`fig-orchestra.png`). N chairs (here 553, one per 2,500 lines) sit
on up to 12 concentric half rings. Seats are dealt to rings in proportion to radius and ordered
from the left of the stage to the right. Each seat is an r 8.3 sphere (radial gradient from 60%
white highlight at .36/.3 through the colour to 40% black). Families are Strings (blue shades),
Woodwinds (aqua) and Brass (brass), each language labelled with its "instrument" (1st violins, flutes,
trumpets). There is a chrome half-disc podium with a G clef cut into it, a big Outfit number on the
stage, and dashed callout leaders. Good for timbre, instrument families and ensemble texture.

### 3.10 Mixing desk, SVG

`figMixer`, lines 1313-1386 (`fig-mixer.png`). One strip per language on a **log fader** ("the way
audio engineers read loudness"). Each strip has a black readout, a 22-segment LED meter (the top
two segments whitened, opacity rising with height), a slot with ticks, a chrome gradient fader cap,
a cream "masking tape" label in Instrument Serif italic tilted -1.6, 0 or +1.6 deg, and a glowing
status LED. Groups are labelled with bracket paths. Ideal for loudness, decibels, dynamics and
mixing the voice against a backing track.

### 3.11 Movement headers and the decorative staff, CSS

`styles.css` lines 160-178 (`movement-head.png`). The roman numeral is Outfit 200 at 124 px,
transparent with a 1.2 px chrome `-webkit-text-stroke` (outlined). The tempo marking is Instrument
Serif italic 23 px in aqua ("Allegro vivace: _fast and lively_"). The title is Outfit 600
`clamp(32px, 4vw, 46px)` with -.025em tracking. The `.mv-staff` is a 37 px
repeating-linear-gradient staff (lines 9 px apart), masked at both ends, with a G clef in
`::before` and a CSS final barline in `::after`.

**Defect**: `mask-image` clips everything outside the element's border box, so the 58 px clef shows
only its middle loop on every movement header. The proof is `shots/mv-staff-masked.png` against
`shots/mv-staff-unmasked.png`, where the mask was removed in devtools. Fix: move the lines and the
mask to a `::before` layer the size of the staff and keep the clef outside it.

### 3.12 Waveform and crescendo, SVG

- `figWaveform`, lines 1457-1538 (`fig-waveform.png`): one rounded bar per day, mirrored below the
  axis at 30% opacity. Fill is a `userSpaceOnUse` gradient blue-aqua-violet across the width, so
  colour follows the calendar. There are release "rails" with diamond markers, a dashed creation
  rule, a mono annotation and a scrub playhead (`scrub()`), and labels carry a halo
  (`paint-order: stroke`).
- `figCrescendo`, lines 1656-1719 (`fig-crescendo.png`): a stacked area chart with gradient fills
  (78% to 12%), a **hairpin** across the top with _pp_ and _ff_ in Instrument Serif italic 700, and
  annotated jumps with dashed leaders. A "Code / Everything" segmented switch redraws it.
- Both have a `scrub` hairline with a tooltip that follows the pointer.

### 3.13 Vinyl and album cover, SVG

- `figVinyl`, lines 2118-2161 (`fig-vinyl.png`): a three-ring sunburst pressed into a record. A
  black disc carries hairline grooves every 2.3 px (every 9th one brighter: 6% against 2.5% white).
  It has a spectrum-gradient label with the name fitted by `fitText`, "SIDE A · 33 1/3 RPM", a
  spindle hole, and **two sheen wedges that do not rotate** while the record spins (`.spin`
  140 s linear infinite, paused on hover). The fixed highlight is what sells the rotation.
- `figCover`, lines 2391-2448 (`fig-cover.png`): a 1200x630 share card (exported 2400x1260 via
  html-to-image) with radial blue and violet glows, faint staves, a record whose groove bands are
  folders, a tonearm, a chrome-plus-spectrum wordmark through SVG gradients, six big numbers and a
  waveform footer. A ready template for **YouTube thumbnails and end cards**.

### 3.14 Drum pads, LED analyser, depth scale, rhythm, tickets

- `figPads` (squarified treemap, lines 2176-2242): pads have alpha .2 fills, alpha .6 strokes, a
  radial "shine" overlay at the top left, a dot LED, and a strip along the foot showing the family
  mix.
- `figCadence` (lines 2024-2046): an LED spectrum analyser with spectrum-ramped segments and a
  white peak-hold cap. A natural visual for **frequency spectrum and overtones**.
- `figDepth` (lines 2245-2261): values drawn as noteheads (rx 10, ry 7, rotate -22) on soft stem
  bars over a staff, with a quarter-rest glyph for zero. A "descending scale".
- `figRhythm` (lines 2004-2021, `fig-rhythm.png`): the five note-value glyphs from Noto Music
  (U+1D160 eighth and so on) at 34 px over gradient bars. A direct **note values** chart.
- `figTickets` (`fig-showstoppers.png`): "admit one" ticket stubs, made entirely in CSS. A dashed
  perforation, punched half-circles, a music glyph with `text-shadow` glow in the tone colour, a
  vertical mono number and a big Outfit value. Perfect for **key-fact cards** ("A4 = 440 Hz").

---

## 4. Typography

### 4.1 Families and licences (checked from each woff2 name table with fontTools)

| Role                     | Family               | File / version                         | Axes         | Licence                                                                                             |
| ------------------------ | -------------------- | -------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| Display, numbers, titles | **Outfit**           | outfit-latin-var.woff2, v1.100         | wght 100-900 | SIL OFL 1.1, (c) 2021 The Outfit Project Authors                                                    |
| UI text                  | **Inter**            | inter-latin-var.woff2, v4.001          | wght 100-900 | SIL OFL 1.1, (c) 2016 The Inter Project Authors                                                     |
| Micro labels, readouts   | **JetBrains Mono**   | jetbrains-mono-latin-var.woff2, v2.211 | wght 400-800 | SIL OFL 1.1, (c) 2020 The JetBrains Mono Project Authors                                            |
| Poetic voice (italic)    | **Instrument Serif** | regular plus italic woff2, v1.000      | static 400   | SIL OFL 1.1, (c) 2022 The Instrument Serif Project Authors (github.com/Instrument/instrument-serif) |
| Music glyphs             | **Noto Music**       | split woff2, v2.003                    | static 400   | SIL OFL 1.1, (c) 2022 The Noto Project Authors (github.com/notofonts/music)                         |

All five are on Google Fonts. OFL 1.1 allows use in videos, web pages and embedding. Fonts may not
be sold on their own, and a modified font must not use a Reserved Font Name. Rendering them into
YouTube video frames is fine. The MercuryPitch app already uses Outfit (53 rules), Inter and
JetBrains Mono (grep of `src/**/*.css`), so Instrument Serif and Noto Music are the only additions.

### 4.2 Type scale and setting (report)

| Element          | Setting                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wordmark         | Outfit 600, `clamp(54px, 11.5vw, 156px)/.88`, tracking -.045em. "Mercury" uses `--grad-chrome` clipped to the text, "Pitch" uses `--grad-spectrum`  |
| Tagline          | Instrument Serif italic, `clamp(22px, 2.7vw, 36px)/1.18`, chrome-300, `text-wrap: balance`, word-spacing +.1em (the italic sets a tight word space) |
| Kicker / eyebrow | JetBrains Mono 500, 11.5 px / 10.5 px, uppercase, tracking .18em / .15em, ink-3; the figure number in aqua                                          |
| Movement numeral | Outfit 200, 124 px/.78, outlined via `-webkit-text-stroke: 1.2px` chrome at 42%                                                                     |
| Tempo marking    | Instrument Serif italic 23 px in aqua, with the gloss at 17 px in ink-3                                                                             |
| Movement title   | Outfit 600, `clamp(32px, 4vw, 46px)/1.04`, tracking -.025em                                                                                         |
| Card title       | Outfit 600, 25 px/1.12, tracking -.015em, title case                                                                                                |
| Big numbers      | Outfit 600, 30-92 px, tracking -.03 to -.05em, `font-variant-numeric: tabular-nums`; the ratio number filled with the spectrum gradient             |
| Body             | Inter 400, 15 px/1.55; paragraphs use `text-wrap: pretty`                                                                                           |
| SVG micro        | `.t-mono` 10 px mono with .04em tracking; `.t-num` Outfit 600 13 px tabular; `.tape` serif italic on cream                                          |
| Picker           | h1 Instrument Serif 400 `clamp(2.4rem, 1.6rem + 2.6vw, 3.6rem)/1`; programme names up to 5 rem serif                                                |

### 4.3 How headings animate

They hardly do. Headings ride on their card's reveal (opacity plus 14 px rise, .7 s). The wordmark
is static, and the living staff moves behind it. The picker's names animate opacity (.4 s) on
hover. The site's motion budget goes to the visuals, not the type. For the videos we will want
more (split-line reveals, masked rises, scramble-free crossfades), but the type system itself is
directly reusable.

---

## 5. Notation: how notes are drawn (and how to make them jump)

### 5.1 What the site does

**Real notes on a staff: yes, engraved by hand.** In `figScore` (lines 1817-1906), `tacet()`
(lines 1081-1090) and `noteKey()` (lines 1122-1130), with staff space 6 user units:

| Element                     | Implementation                                                                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff                       | 5 `<line>`s, `y = yb - ln*6`, class `.staff` (chrome-300 at 26%)                                                                                                                                                              |
| Pitch                       | step k above the bottom line: `y = yb - k*3` (in treble, k = 0 is E4 and k = 8 is F5)                                                                                                                                         |
| Notehead                    | `<ellipse rx="3.7" ry="2.6" transform="rotate(-22 x y)">`; hollow for half and whole (fill bg, stroke 1.35), filled otherwise (stroke .5)                                                                                     |
| Stem                        | up on the right (`x+3.4`) if `k < 4` (below the middle line), else down on the left (`x-3.4`), length 21 (3.5 spaces), class `.ink` (stroke 1.1)                                                                              |
| Flag                        | `M${x} ${y0}c.4 ${-dir*3.6} 6.4 ${-dir*4.8} 5.4 ${-dir*10.5}`, 5 apart, "always on the right of the stem, curling back toward the head"                                                                                       |
| Beam                        | groups of up to 4 consecutive 8ths and 16ths; direction by the group's mean step; slope clamped to +/-0.16; every stem at least 15 long, default 20; slab 2.8 thick; 16ths add a second slab 4.6 further in, or a 5-unit stub |
| Ledger                      | `x +/- 5.6` at every even k >= 10 and every even k <= -2                                                                                                                                                                      |
| Clef                        | text glyph U+1D11E in Noto Music, font-size 39, baseline `yb+6.5`, about **1.6 times true engraved size** (decorative)                                                                                                        |
| Time signature              | two `<text class="tsig">` (Outfit 700, 17.5 px)                                                                                                                                                                               |
| Rests                       | whole rest as a `<rect>` (empty bar: 10 x 3.6; tacet: 22 x 5.5); quarter rest as glyph U+1D13D                                                                                                                                |
| Barlines                    | 1 px lines, and a 3.5 px rect for the final bar                                                                                                                                                                               |
| Fermata                     | `M x-5 yb-31 a5 5 0 0 1 10 0` plus a dot                                                                                                                                                                                      |
| Accidentals, key signatures | **none on the site**                                                                                                                                                                                                          |

There is no Bravura or SMuFL. Noto Music is the Unicode block (U+1D100-1D1FF) glyph set, used for
clefs, note-value icons, rests, dynamics (pp/ff are actually set in serif italic) and decorative
watermarks (82 px at 5% opacity in the KPI tiles: quarter note, G clef, F clef, fermata, segno,
star).

### 5.2 What I built from it (tested)

`snippets/staff-engraving.js` generalises the site's geometry to any staff space `s`, and adds:

- `parsePitch('F#4')`, `stepOf(pitch, clef)` for treble, bass and alto, `midiOf`, `hzOf`.
- `clef()` draws **true-size clefs from Noto Music outlines** (`noto-music-glyph-paths.json`, 33
  glyphs extracted as SVG path data, so there is no web-font dependency in video renders). Noto's
  own staff glyph puts lines at font y 12, 256, 500, 744, 988 (space = 244 units), so
  `scale = s/244`. **Calibration finding**: the G and C clefs sit on that staff (bottom line at
  font y 12), but the **F clef's dots centre at font y 644**, so it needs its bottom line at font
  y -88. Without that, the F clef renders half a space low. See `tests/clef-test.png`, where the
  red F line falls exactly between the dots.
- `accidental()` uses sharp, flat, natural, double sharp and double flat outlines, aligned on the
  notehead centre (font y 134). Verified in `tests/engraving-test.png`.
- `note()`, `beam()`, `ledgerGroup()`, `wholeRest()`, `halfRest()`, `barline()` and `noteKey()`.
- **`jump(note, 'C5')`** returns a GSAP timeline. It runs an anticipation squash (scaleY .8), a
  stretch on take-off, a rise on power2.out, a fall on power2.in, a landing squash and a
  `back.out(3)` settle, scaling about the head's foot with `svgOrigin`. The old ledgers fade out on
  take-off and the needed ledgers fade in on landing, all as tweens with no callbacks, so it is
  **seekable**. Seeking 0.55 s, then 2.0 s, 0.1 s and 0.55 s again gives identical transforms.
  Filmstrip: `tests/jump-filmstrip.png`. Live demo with a scrubber:
  `snippets/jumping-notes-demo.html`, which must be served over http (screenshot
  `tests/demo-end.png`).

Known limit: a jump across the middle line does not flip the stem (the comment says how to
cross-fade to a re-engraved note). For full scores with key signatures, ties and dots, use the
app's **VexFlow 5** (`src/lib/sheet-music-renderer.ts`). Its SVG output can be post-processed
(group per StaveNote) and animated the same way.

### 5.3 Recommendation for "jumping notes"

Use the hand-engraved approach (site geometry plus Noto outlines) for hero animation, where every
notehead is our own `<g>` and can squash, glow, trail or become Merc. Use VexFlow only for static
or long passages. The hand engraving is already in the house style: the stats score, tiny ledgers,
the -22 deg head tilt and chrome ink.

---

## 6. Colour, backgrounds, texture, glow

### 6.1 Tokens (`styles.css` lines 7-34; full copy in `snippets/stats-tokens.css`)

```
surface   --obsidian #0d1117  --panel #161b22  --raised #21262d  --card-bg #12171e  --hair #30363d
ink       --ink #e6edf3  --ink-2 #a8b3bf  --ink-3 #848d97
signal    --blue #58a6ff  --aqua #2dd4bf  --violet #bc8cff  --green #3fb950  --amber #d29922  --red #f85149  --rose #ff7b72
chrome    --chrome-100 #f4f8fd  -300 #c3ccd6  -500 #8a97a6  -700 #5b6b7b  -900 #1b2430   (the "quicksilver" family)
brass     --brass #e3b341  --brass-2 #f2cc60
gradients --grad-spectrum 120deg blue -> aqua -> violet
          --grad-chrome 180deg #fff -> chrome-100/300 mix -> chrome-500 -> ink -> chrome-300/500 mix (liquid metal)
          --grad-rim 150deg chrome 34% -> 6% -> blue 18% -> violet 26% (1 px card border via padding-box/border-box)
easing    --ease cubic-bezier(.2, .8, .2, 1)
picker    --night #06080c, ink #eef2f6, line rgba(238,242,246,.14), --accent / --accent-2 per project
```

Derived colours in JS (lines 864-925): `mix()`, `alpha()` and `ramp()`. A CIE Lab Delta E
`distinct()` picks categorical colours at least 34 Delta E apart with contrast of at least 3:1 on
the ground, so a theme cannot produce look-alike series. `heat` and `speedRamp` drive the piano
roll, the sequencer and the score.

**Blue and orange precedent**: the other two reports already pair a cold blue with a warm orange.
Lumen Apeiron uses `#73d9ff` plus `#ff7448` (spectrum `#ff7448 -> #f3a64b -> #73d9ff`), and Token
Circles uses `#6e9bff` plus `#f0a860`. For the two Mercs, a lesson theme could be: blue Merc
`#58a6ff` (or `#73d9ff`), orange Merc `#ff7448` or `#ff9a4d`, chrome for neutral ink. My
`#ff9a4d` is used in the jumping-notes test.

### 6.2 Backgrounds and texture

- Body: three radial glows (blue 16% top centre, violet 10% top right, aqua 6% left) over a
  **page-wide faint staff**: a `repeating-linear-gradient` of five 1 px lines 9 px apart at 3.2%
  chrome, repeating every 168 px. This is the site's signature ground.
- **No film grain or noise anywhere.** Texture comes from the faint staves, vinyl grooves,
  fretboard grain lines (1.8%) and the plate's 1.4% brushed stripes (`repeating-linear-gradient(90deg, rgba(255,255,255,.014) 0 1px, transparent 1px 3px)`).
- The share card adds radial glows at 26% and 20% and faint staves at 3.5%.

### 6.3 Glow treatments

- SVG filter `glow()`: `feGaussianBlur stdDeviation 1.4-2.5` merged under the source
  (x -60%, y -60%, 220% box). Used on LEDs, the peak key, the loudest finger dot, the playing note
  and the star line.
- CSS: `drop-shadow(0 0 5px accent 55%)` on the grain canvas; `box-shadow: 0 0 10px currentColor`
  on chip dots; `text-shadow: 0 0 18px tone-glow` on ticket glyphs; a 120 px accent halo on the
  plate.
- Canvas: the living staff's two-pass stroke (6x width at 8%, then 1x at 55%).
- Highlights on spheres: radial gradient centred at (.35, .3).

---

## 7. Interaction patterns worth reusing in the lesson explorer

All in `snippets/explorer-patterns.js`, readable and with the site's timings.

1. **The programme list as a lesson list**: big serif titles at 38% opacity, a hairline string
   that is plucked on hover or focus, and an accent colour that cross-fades through `@property`.
   The hero visual retunes (for us: the lesson's motif or Merc pose). Arrow keys navigate, an idle
   auto-cycle can be switched off with `?cycle=0`, and a click plays an exit animation before
   navigating. This is the lesson explorer.
2. **One sound switch for the site**: off by default, stored in localStorage, synced across tabs
   and the Back button. No AudioContext exists before consent, and turning it on is answered with
   the page's chord. The speaker icon shows waves when on and a cross when off. Use our own key,
   e.g. `lessons-sound`.
3. **Stage**: an IntersectionObserver fades cards up (rootMargin -6% at the bottom). Once half is
   visible a card "performs" once with sound on, one performance at a time, with a button
   outranking a scroll. Reduced motion, print and deep links show the final state. Prerendered
   pages wait for `prerenderingchange`. For lessons: each section's micro-animation plays when it
   arrives, and its sound plays only if sound is on.
4. **Movement nav**: roman-numeral pills (I Instrumentation, II Tempo ...) lit by an
   IntersectionObserver with `rootMargin -35% 0 -60% 0`. A lesson's chapter nav.
5. **Deep links**: an instant scroll, re-applied after `document.fonts.ready`, plus a 2.2 s aqua
   ring pulse. Use for "share this exact concept" links.
6. **Touch-correct tooltips**: tap shows, the next tap or a scroll hides; data-tip delegation.
7. **Card tools**: Copy PNG, Download and Copy link per card (html-to-image, with SVG styles baked
   inline first). A lesson figure could export as a study card.
8. **Cross-document view transitions** (`@view-transition { navigation: auto }`, inlined first in
   `<head>`) plus speculation-rules prerender on hover. Lesson-to-lesson navigation feels like one
   app with no SPA.
9. **Plate tilt** (up to 3.5 deg, mouse only) as a cheap parallax on the hero visual.

---

## 8. Motif to music-theory mapping (recommendation)

| Motif (stats site)                                     | Concept it explains                                                                              | How to use it in a lesson or video                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chladni plate                                          | Standing waves, nodes and antinodes, resonance, harmonics, "why some notes ring"                 | Climb `LADDER` (1,2) to (2,3) to (3,5) to (5,8) as the pitch rises; Merc taps the plate and the sand rearranges. Caveat for a Veritasium-grade claim: cos-cos modes are the membrane approximation; a metal plate follows the biharmonic equation (Chladni's law f ~ (m + 2n)^2), so say "approximately" if quoting ratios |
| Plucked programme string                               | Vibration, frequency, the harmonic series, timbre as a mix of harmonics                          | `standingWavePath()` with harmonics 1..n; show nodes with `nodesOf(n)`; Merc stands on a node and stays still                                                                                                                                                                                                              |
| Living staff                                           | "Sound becomes notation": the staff lines are strings                                            | Opening shot: the five lines vibrate, then freeze into a staff on which the first note lands                                                                                                                                                                                                                               |
| Staff engraving plus jumping notes                     | Reading pitch on the staff, clefs, ledger lines, accidentals, steps and skips, intervals, scales | `jump()` walks a scale, skips a third, leaps an octave; accidentals pop on; the treble and bass clefs meet at middle C (ledger lines)                                                                                                                                                                                      |
| Piano roll                                             | Pitch against time, semitones, octaves, MIDI, melody contour                                     | The singer's pitch trace (the app's own pitch line) laid over a roll; black and white keys teach whole and half steps                                                                                                                                                                                                      |
| Keyboard (piano-roll keys)                             | Octave, semitone, the major-scale pattern W W H W W W H                                          | Keys light in a pattern; Merc hops on keys                                                                                                                                                                                                                                                                                 |
| Metronome                                              | Pulse, tempo, BPM, Italian tempo terms                                                           | `metronomeAngle(t, 60/bpm)` drives the arm frame-exactly; tempoName() labels                                                                                                                                                                                                                                               |
| Step sequencer                                         | Beat, meter, subdivision, 4/4 against 3/4, syncopation                                           | Pads light on the beat; groups of four (the coloured bars) show the bar                                                                                                                                                                                                                                                    |
| Note values (rhythm figure, noteKey)                   | Whole/half/quarter/eighth/sixteenth durations                                                    | The five glyphs over bars whose lengths halve                                                                                                                                                                                                                                                                              |
| Waveform                                               | Sound as air pressure over time, amplitude and loudness                                          | A mirrored bar waveform of Merc's voice                                                                                                                                                                                                                                                                                    |
| LED spectrum analyser                                  | Frequency spectrum, overtones, formants (singing!)                                               | Peak-hold caps show harmonics of a sung vowel; the singer's formant                                                                                                                                                                                                                                                        |
| Mixing desk and LED meter                              | Loudness, decibels, dynamics, balance against a backing track                                    | Fader cap moves with dB; tape labels "Voice", "Piano"                                                                                                                                                                                                                                                                      |
| Crescendo hairpin                                      | Dynamics markings (pp to ff), crescendo and diminuendo                                           | `hairpin()` grows while the waveform grows                                                                                                                                                                                                                                                                                 |
| Fretboard                                              | Frets as semitones, octave at the 12th fret (2:1), equal temperament                             | `fretPosition(n, L)` shows real fret spacing shrinking by 2^(-1/12)                                                                                                                                                                                                                                                        |
| Orchestra hemicycle                                    | Instrument families and timbre, ensemble, register                                               | Seats light by family while each plays; Merc conducts from the podium                                                                                                                                                                                                                                                      |
| Vinyl record                                           | Recording and playback, loops, repetition, form (sides, tracks)                                  | Chapter cards and end screens; the sheen-wedge trick for spinning                                                                                                                                                                                                                                                          |
| Album cover, share card                                | YouTube thumbnail and end-card template                                                          | Same layout, Merc in place of the record                                                                                                                                                                                                                                                                                   |
| Ticket stubs                                           | Key facts ("A4 = 440 Hz", "octave = 2:1", "12 semitones")                                        | Pop-in fact cards in the video, and recap cards on the web page                                                                                                                                                                                                                                                            |
| Movement heads (numeral plus tempo marking plus title) | Lesson and chapter structure                                                                     | "I · Allegro: _the pulse_" as lesson openers                                                                                                                                                                                                                                                                               |

---

## 9. Snippets saved (reusable, tested)

Folder: `docs/plans/find-your-pitch/research/stats-snippets/`

| File                          | Contents                                                                                                                                                                                                                                                                                               | Tested                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `staff-engraving.js`          | Staff, true-size Noto clefs (F clef calibrated), accidentals, notes, stems, flags, beams, ledgers, rests, `noteKey`, pitch maths, **`jump()` GSAP hop**, all scaled by staff space `s`                                                                                                                 | `tests/engraving-test.png`, `tests/clef-test.png`, `tests/jump-filmstrip.png`, seek determinism                                                                 |
| `noto-music-glyph-paths.json` | 33 Noto Music glyphs as SVG path data (y flipped, font units, upm 1000): G/F/C clefs, note values, noteheads, sharp, flat, natural, double sharp, double flat, rests, fermata, segno, coda, repeats, hairpins, p/m/f, common time                                                                      | rendered in the tests                                                                                                                                           |
| `jumping-notes-demo.html`     | A self-contained page that walks a scale with blue and orange notes on a scrubbable paused GSAP timeline (GSAP 3.12.5 from cdnjs)                                                                                                                                                                      | `tests/demo-end.png`                                                                                                                                            |
| `chladni-plate.js`            | De-minified field, grains, modes, tones, renderer, burst, plus **`SeekablePlate`** (seeded mulberry32, fixed 1/fps steps, checkpoints, trail drawn from past states, so no dependence on the previous paint)                                                                                           | `tests/chladni-determinism.mjs` (same sums fresh, after a back-seek and after a rewind); `tests/chladni-ladder.png`                                             |
| `strings-and-waves.js`        | The exact pluck path, a general `standingWavePath()` with harmonics and nodes, the living staff draw function, waveform bar layout. All pure functions of t                                                                                                                                            | syntax checked                                                                                                                                                  |
| `instrument-figures.js`       | Metronome (plus `metronomeAngle`, `tempoName`), vinyl with grooves and fixed sheen, tonearm, hemicycle seat layout, seat sphere gradient, piano-roll keyboard plus heat ramp, fretboard (plus `fretPosition`), channel strip with LED meter and fader, LED column, sequencer pad, hairpin, glow filter | `tests/instruments-test.png`                                                                                                                                    |
| `stats-sound.js`              | Verbatim keys and modes (`scaleFor` parses "E minor", "B-flat major", "d dorian"), `degreeToMidi`, `chordEvents`, the bus (compressor, limiter, soft clip, seeded room), the 13 synth voices, the picker's voice and bus, plus **`renderToWav()`** for video soundtracks                               | rendered in Chrome: peak -5.35 dBFS. Not bit-exact: at most 1.8e-7 difference between renders, from Chrome's BiquadFilter. Cache by event list, not by WAV hash |
| `stats-tokens.css`            | Fonts, tokens, themes, the staff background, type scale, movement head, cards and reveal, sound switch, SVG vocabulary, spin and tick keyframes, plate and programme CSS, view transition note, reduced motion                                                                                         | n/a                                                                                                                                                             |
| `explorer-patterns.js`        | Programme list (hover, pluck, accent, auto-cycle, keyboard), plate tilt, site-wide sound switch, Stage reveal and performance, active nav, deep links with flash, touch tooltips, view transitions and prerender                                                                                       | syntax checked                                                                                                                                                  |

Test scripts are in `(session scratchpad, not kept)/scripts/`
(`test-engraving.mjs`, `test-clef.mjs`, `test-jump.mjs`, `test-chladni.mjs`, `test-instruments.mjs`,
`test-sound.mjs`, `test-demo.mjs`). Test outputs are in `(session scratchpad, not kept)/tests/`.
Font tools: a venv at `(session scratchpad, not kept)/tools-venv`
(fonttools, brotli, pillow), with scripts `fontinfo.py`, `glyphs.py`, `staffglyph.py` and
`contours.py`.

---

## 10. Notes for the HyperFrames build

1. **Determinism rules the site breaks** (fine on the web, not in a seekable render): the site
   uses `performance.now()`, `requestAnimationFrame`, `Math.random()` (the burst angle wobble, the
   score's closed-PR click noise), CSS infinite animations (the vinyl spin, the metronome) and an
   accumulating canvas (the plate trails). The snippets replace each with a function of the
   timeline time: `metronomeAngle(t)`, a rotation of `t / 140 s * 360` for the vinyl,
   `pluckPath(t)`, `drawLivingStaff({ t })` and `SeekablePlate.draw(ctx, frame)`.
2. Draw clefs and accidentals from **path data** rather than the Noto font in videos, so a late
   font load can never shift a frame. Text faces (Outfit, Instrument Serif, Inter, JetBrains Mono)
   should be self-hosted woff2, loaded and awaited via `document.fonts.ready` before the first frame.
3. **Audio**: bake sound effects with `renderToWav()` once, store the WAV next to the composition,
   and key the cache by a hash of the event list (renders differ by up to -135 dBFS across runs,
   so a WAV hash would miss).
4. The **picker layout** (plate on the left, a big serif programme list on the right, colophon at
   the foot; `grid-template-areas: "head head" "plate intro" "plate programme" "foot foot"` at
   960 px and wider) is a strong lesson-explorer template as it stands.
5. **Engraving size**: use true size (`clef()`) when the lesson is about reading clefs; the site's
   1.6x decorative clef is fine for titles.
6. **Accessibility already modelled**: `prefers-reduced-motion` gives final states,
   `aria-pressed` switches, `role="img"` plus `aria-label` on every figure, and tap targets of
   40 px on coarse pointers.

---

## 11. Caveats and open items

- The kit's source repository (`kit/scripts/build_report.py`, `src/kit/*.test.ts`) was not
  available; everything here is read from the shipped bundle. The live code is unminified, so
  nothing material is hidden.
- `Stage.register` is never called, so per-figure reveal animations are designed but not built
  (only the card fade-up runs). `SoundMap.scoreEvents` (the richer score music) is likewise not
  wired to the Play button.
- Chladni frequency claims need care (section 8).
- No orange Merc asset or mascot motion exists on the stats site; it is a data-art site with no
  characters. The blue/orange theme precedent (section 6.1) is the only overlap.
