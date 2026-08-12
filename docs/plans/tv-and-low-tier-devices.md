# Television and low-tier devices — audit and plan

Trigger: a session on a Philips Google TV (Android TV browser). Reported:

1. Guitar Night, Piano Night and the Karaoke stem mixer stutter — visuals and,
   worse, **audio**.
2. Uploading a song is impossible: every file-picker button does nothing, or
   opens the browser's own context menu.
3. The microphone cannot be enabled.
4. Some controls have no colour — the A/B loop buttons render grey instead of
   blue and red.

Plus one unrelated finding on desktop: the Karaoke tab's **Guide** modal and
**Settings** cogwheel describe and expose controls that do not exist.

Status keys: **[shipped]** in this change, **[next]** planned, **[open]** needs
a decision or hardware to verify.

---

## 1. Why a television is different

Not "a slow phone". Three specific things:

|             | Phone                | Television                                        |
| ----------- | -------------------- | ------------------------------------------------- |
| Pixels      | ~1–2 MP              | 2 MP (1080p) to 8 MP (4K)                         |
| GPU         | sized for its screen | sized for video decode, not for compositing       |
| Browser     | current Chrome       | Chrome **79–90**, frozen at the firmware's age    |
| Input       | touch                | D-pad, no hover, no pointer                       |
| File system | a real picker        | often **no app answers the picker intent at all** |
| Microphone  | always present       | usually absent                                    |

Every one of the four reports maps onto a row of that table.

---

## 2. Performance

### 2.1 What actually costs the frame

Measured by counting the work, not by guessing:

| Source                             | Count | Cost                                                                             |
| ---------------------------------- | ----- | -------------------------------------------------------------------------------- |
| `backdrop-filter` declarations     | ~180  | Compositor reads back the region behind the element and blurs it **every frame** |
| decorative `filter: blur()` layers | ~173  | Full-bleed, permanently animated                                                 |
| `box-shadow` declarations          | ~572  | Cheap individually, not in aggregate                                             |
| `@keyframes`                       | ~128  | Many run forever                                                                 |
| Stem-mixer canvases per frame      | 4     | Overview, live waveform, pitch, MIDI — every animation frame                     |

The canvas work was already carefully optimised (`waveform-peak-cache.ts` is a
segment tree, `overview-mapping.ts` maps columns exactly to avoid moiré). The
**glass is the expensive part**, and it is expensive on a per-frame,
per-element basis that no amount of canvas tuning offsets.

The audio consequence is the important one: `useStemMixerAudioController`'s rAF
tick runs pitch detection and four canvas draws on the same thread that feeds
Web Audio. When that thread misses its deadline, the sound stutters. That is
the reported symptom, and it is why capping frames helps the _audio_.

### 2.2 Detecting the device — [shipped]

`src/lib/device-tier.ts`. Two independent verdicts:

- `deviceClass()` — `desktop | mobile | tv`. What it is.
- `deviceTier()` — `high | balanced | low`. How much budget it has.

Detection is a pure function over a `DeviceProbe` (unit tested against real
user-agent strings), so it can be reasoned about without a television.

TV detection is three signals, ORed:

1. Explicit tokens: `SMART-TV`, `Tizen`, `Web0S`, `CrKey`, `AFT*` (Fire TV),
   `BRAVIA`, `Philips…TV`, `VIDAA`, `NetCast`, `HbbTV`, …
2. The `tv` CSS media type, still honoured by several TV shells.
3. **Android without the `Mobile` token, plus zero touch points.** This is the
   Philips case: its user agent is indistinguishable from a phone's. A tablet
   has the same missing token but reports touch, so the pair is what
   discriminates. There is a test for exactly this, with the real UA string.

Tier scoring: ≤2 cores or ≤2 GB is `low`; a TV is `low` when it has ≤4 cores or
a ≥1920px screen and `balanced` otherwise — **a television never scores
`high`**. Everything else falls out of core count and `deviceMemory`.

On top of the static score, `createFrameHealthSampler` watches real frame
intervals in the stem mixer and the zen ribbon. If ≥40% of a 90-frame window
misses 28 ms, the device is demoted to `low`. Demotion is one-way for the
session: a surface that oscillates between quality levels looks worse than one
that commits.

Escape hatches: `?perf=low`, `?device=tv` for testing on hardware you do not
have, and a **Settings → Display & Controls → Graphics Quality** override that
reports what was detected.

The verdict is published as `data-device-class` / `data-perf-tier` on `<html>`,
before first paint, from every entry point (`index.tsx`, and the standalone
guitar-night / piano-night / karaoke-night mains).

### 2.3 Spending the budget — [shipped]

**CSS** (`src/styles/performance-mode.css`). Overrides keyed on the tier rather
than 300 edited component stylesheets, so full quality stays the default and
one attribute flip is reversible:

- `low`: no `backdrop-filter` anywhere, `will-change: auto` everywhere (a TV has
  ~1 GB of shared video memory; a few dozen pinned compositor layers exhausts
  it), decorative blur and looping animation off, translucent panels given an
  opaque ground so text stays legible without the blur behind it.
- `balanced`: decorative blur and looping animation off, glass kept.
- `tv` (any tier): a strong `:focus-visible` ring, because D-pad navigation is
  unusable without one, and hover transforms suppressed.

Spinners and progress bars are deliberately **not** stopped — one that freezes
reads as a hang.

**Frames.** `createStemMixerFrameScheduler` gained a presentation cap. It stays
uncapped (`Infinity`) on a capable device, so nothing changes there; on a TV it
holds presentation to 30 Hz and analysis to 15 Hz, and never analyses a frame it
is not presenting. `ZenPitchRibbon` gets the same cap, with its band-easing rate
scaled by the frame rate so the glide takes the same wall-clock time either way.

**Resolution.** `renderScale()` caps the canvas backing store at 1× on `low`,
1.5× on `balanced`, 2× otherwise. Wired through the stem mixer's five canvases
and the zen ribbon. A 4K TV reporting dpr 2 would otherwise ask a phone-class
GPU to fill 8 megapixels of waveform per frame.

### 2.4 Still to do

- **[next]** Extend `renderScale()` to the other ~40 `window.devicePixelRatio`
  call sites — falling notes, guitar fretboard, guitar-tab-3d, the analysis
  panes. Each is a two-line change but must swap the sizing _and_ the
  `ctx.setTransform` together or it renders at the wrong scale.
- **[next]** Guitar Night and Piano Night have their own rAF loops
  (`useGuitarListeningController`, `usePianoNightController`) that are not yet
  capped. Same treatment as the mixer.
- **[next]** Move the overview waveform to an `OffscreenCanvas` keyed on
  (window, size, track set) so a scroll redraws a blit plus a playhead instead
  of ~4000 segment-tree queries. This is the one canvas change with real upside.
- **[open]** Whether Piano Night's and Guitar Night's stage backgrounds should
  be swapped for a static image on `low` rather than merely de-blurred.

### 2.5 Would a native app fix this?

Partly, and not for the reason it looks like. A native Android TV app gets a
real file picker, a media-session integration and no browser overhead — but the
GPU and the pixel count are unchanged, so a native port that kept the same
blur-heavy visual design would stutter in the same way. The tier work above is a
prerequisite for the native shell, not an alternative to it.

---

## 3. Uploading a song on a TV

### 3.1 Why the button does nothing

`<input type="file">.click()` fires an `ACTION_GET_CONTENT` intent. Android TV
and Google TV ship **no app that answers it**. The WebView fires it, nothing
resolves it, and the page never hears back: no `change`, no cancel, no error.
The user sees a dead button — or, holding OK, the browser's long-press context
menu, which is what was reported.

There is no capability flag for this and none is coming.

### 3.2 What we do about it — [shipped]

`src/lib/file-picker.ts`. Click the input, then watch for the side effect every
platform _with_ a picker produces: the document loses focus (`blur`, or
`visibilitychange` to hidden) within ~1.5 s, or files arrive, or Chromium fires
`cancel`. Complete silence means no picker opened.

Biased towards silence — only a total absence of evidence is treated as failure,
so a slow-but-working picker never produces a false warning.

Wired into Guitar Night (song + reference inputs, with an inline notice),
Karaoke Night's rail (toast) and the main Karaoke tab's upload zone. The upload
zone had to stop relying on `<label for>`, because a native label activation
leaves nothing to observe.

The message names the route that works: prepare the song on a phone or computer
while signed in, then open it here from the library.

### 3.3 Still to do

- **[next]** On a TV, lead with the library and the demo songs rather than the
  upload box — the upload box should not be the primary call to action on a
  device that cannot use it.
- **[open]** A "send from your phone" pairing flow (QR code → phone uploads →
  TV picks it up from the account) is the genuinely good answer. Needs the
  cross-device session sync that `PREMIUM_FEATURES` gates.
- **[open]** On-device separation is not viable on TV hardware regardless; the
  Karaoke settings copy now says so.

---

## 4. The microphone

Most televisions have no microphone, and those that do expose it to the remote's
voice assistant, not to the browser. A USB microphone or a Bluetooth headset
paired to the TV should work through `getUserMedia` — untested.

- **[open]** Needs hardware to verify. If it does work, the mic-permission copy
  should mention it on `deviceClass() === 'tv'`; if it does not, the mic-gated
  surfaces should say so up front rather than failing at the permission prompt.

---

## 5. The grey A/B buttons

### 5.1 Cause

`color-mix()` needs Chrome 111 (March 2023). The Android TV WebView on a 2020
Philips set is Chrome 83; LG's webOS shell is Chrome 79. A browser that cannot
parse a value **drops the entire declaration**.

This codebase has ~490 `color-mix()` calls. The A/B buttons are one instance:

```css
.loopBtnB.active {
  color: var(--red); /* survives */
  border-color: color-mix(in srgb, var(--red) 45%, transparent); /* dropped */
  background: color-mix(in srgb, var(--red) 16%, transparent); /* dropped */
  box-shadow: 0 0 10px color-mix(in srgb, var(--red) 28%, transparent); /* dropped */
}
```

What is left is an untinted button. Not a dark-mode problem, and not specific to
A/B — it is every accent tint, hover state and glow in the app.

### 5.2 Fix — [shipped]

`tools/css-legacy-fallbacks.ts`, a Vite `enforce: 'pre'` transform, so it sees
authored CSS before Lightning CSS minifies it. Two passes:

1. Beside every custom property holding a literal colour, emit an `-rgb`
   companion **in the same rule**, so theme switching keeps working
   (`--accent: #58a6ff` → `--accent-rgb: 88, 166, 255`). A property that aliases
   another (`--danger: var(--red)`) gets an aliasing companion.
2. Before every declaration using `color-mix()`, emit a legacy equivalent:
   - `color-mix(in srgb, C P%, transparent)` → `rgba(…, P/100)` — exact.
     A `var(--tok)` becomes `rgba(var(--tok-rgb), a)`; a `var(--tok, #hex)`
     keeps its literal as the companion's own fallback, so it works even where
     no companion exists.
   - two literals → computed numerically — exact.
   - otherwise → the dominant side, which keeps the hue family right.
   - `currentColor`, nested mixes and non-sRGB spaces are **left alone**, which
     is today's behaviour, not a regression.

Old browsers keep the first declaration; new browsers take the second. Verified
in the production build: 192 fallbacks emitted across the bundle, and the A/B
rule now carries `rgba(var(--red-rgb), .45/.16/.28)` ahead of each `color-mix`.

Alongside it, Lightning CSS now has explicit `targets` (Chrome 79, Edge 79,
Firefox 78, Safari 13.1), so nesting, `:is()`, logical properties and vendor
prefixes are down-levelled instead of shipped as syntax those engines drop.

### 5.3 Still to do

- **[shipped]** JS-set colour tokens (`--singer-color`, `--lane-color`,
  `--person-color`, `--brush-color`, `--key-color`, `--card-accent`) now write
  their `-rgb` companion too, via `src/lib/css-color-token.ts`. CSS-side alias
  chains (`--danger: var(--red)` and friends) and cross-file declarations
  (`--jam-glass`) are covered by the build transform, which now generates
  companions in every stylesheet, not only those containing a `color-mix`.
  Verified in the production bundle: every static legacy fallback resolves —
  the only remaining unresolved companion is `--bg-hover-rgb`, whose source
  token is itself a translucent `color-mix` and has no meaningful RGB base
  (the inert fallback there equals today's behaviour).
- **[open]** `:has()` (Chrome 105) and `@container` (Chrome 105) are used in ~27
  places and cannot be polyfilled by the same trick. Each needs a graceful
  no-op check — most already degrade to "no enhancement", but this has not been
  audited rule by rule.

---

## 6. The Karaoke Guide and cogwheel (not a TV issue)

### 6.1 What was wrong

The **cogwheel** opened a panel with four controls: Separation Mode, Vocal
Intensity, Instrumental Intensity, Transition Smoothness. All four wrote signals
in `uvr-store`, which were read by exactly one function — `applyUvrSettings` in
`app-store.ts` — **which nothing calls**. The sliders did nothing. The reporter
was right.

The **Guide** was a seven-step tour built around those same four controls,
instructing the user to open the settings panel and tune them before singing.
It described a product that does not exist.

The one real control in that panel was the "Stem Denoise for Matching" toggle.

### 6.2 What changed — [shipped]

- The four dead controls and the `UvrSettings` component are **removed**.
- The cogwheel now opens **Settings → Karaoke**, a new sub-tab
  (`#/settings/karaoke`), rather than growing a second settings system.
- `src/stores/karaoke-settings-store.ts` holds the real preferences:
  - **Separation** — on-device vs studio GPU (surfacing the existing
    `uvrProcessingMode`), with a note that on-device is not viable on a TV.
  - **Index new songs for Shazam & Sing** — new. Exposes behaviour that was
    previously unconditional; off skips fingerprint extraction after separation.
  - **Auto-denoise stems** — moved from the cogwheel. Same localStorage key and
    same bare-`'true'`/`'false'` format, so nobody's preference resets. Covered
    by a migration test.
- **Settings → Display & Controls → Graphics Quality** is the tier override.
- The **Guide** is rewritten around the flow that exists: what the tab does →
  add a song (naming the real buttons, and warning about TV file pickers) →
  on-device vs studio → sing it (stem faders, mic, A/B loop, lyrics) → set lists
  and Karaoke Night → Shazam & Sing.

### 6.3 Still to do

- **[next]** `uvrVocalIntensity`, `uvrInstrumentalIntensity`, `uvrSmoothing` and
  `applyUvrSettings` are now unreferenced by UI. Delete them, and the ~200 lines
  of orphaned `.uvr-settings` / `.intensity-slider` / `.smoothing-slider` CSS in
  `uvr.css` and `vocal-analysis.css`. Left in place here only to keep this
  change reviewable.
- **[next]** The Karaoke page tour (`PAGE_TOURS`) has not been re-checked
  against the new Settings sub-tab.

---

## 7. Verifying this without a television

```
?perf=low          force the low tier
?device=tv         force the television device class
?perf=low&device=tv    both
```

Then check `document.documentElement.dataset` for `perfTier` / `deviceClass`.
Settings → Display & Controls → Graphics Quality reports what was detected and
overrides it persistently.

For the CSS fallbacks, build and grep the output — the fallback declaration must
precede its `color-mix` twin:

```bash
pnpm build && grep -o "_loopBtnB[^{]*{[^}]*}" dist/assets/*.css
```

---

## 8. Order of work

|     | Item                                                                | Why now                                                                   |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Device tier + performance CSS + frame caps                          | Unblocks every other TV fix                                               |
| 2   | `color-mix` fallbacks                                               | One build change repairs ~490 sites                                       |
| 3   | File-picker detection                                               | Turns a dead button into an explanation                                   |
| 4   | Karaoke Guide + Settings                                            | Independent of TV, and the guide now has to describe the TV caveat anyway |
| 5   | Remaining `renderScale()` call sites, Guitar/Piano Night frame caps | Mechanical, follows the pattern                                           |
| 6   | Offscreen waveform cache                                            | The real canvas win                                                       |
| 7   | Phone-to-TV song handoff                                            | Needs cross-device sync                                                   |
| 8   | Native TV shell                                                     | Wants 1–6 done first regardless                                           |
