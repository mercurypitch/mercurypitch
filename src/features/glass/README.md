# Glass — implementation log & operating manual

The living companion doc for the `/glass` campaign feature: what exists, how
to configure and tune it, how to verify it, and the phase-by-phase build log
with the gotchas we hit (so nobody hits them twice). The product/plan source
of truth is [`docs/plans/glass-handoff-2026-07-17.md`](../../../docs/plans/glass-handoff-2026-07-17.md);
this file is the engineer-facing view and gets updated with every phase.

- Branch: `feat/glass-campaign` · phases done: **P0 · P1 · P2 · P3**
- Try it: `pnpm dev` → `https://localhost:3000/glass`
- Interactive look-dev prototype (feel reference):
  `docs/plans/prototypes/glass-shatter-prototype.html`

## 1. What Glass is (one paragraph)

A standalone campaign page (sibling of `/mirror` and `/karaoke-night`): a
calibration glide finds the singer's ceiling, the "glass" tunes itself just
below it and hums its note, and the singer runs reps — sing into a live
quicksilver mirror, then hear their own recorded voice played back through a
small FX rack — while near-misses permanently fatigue the pane, until holding
the note shatters it (P4). Honest metrics + improvement delta, never a
composite score. Audio never leaves the device.

## 2. File map

```
glass.html                          entry: SEO head, FAQ schema, canonical /glass
src/features/glass/
  main.tsx                          bootstrap: consent, glass_view funnel
  GlassApp.tsx                      the whole flow (state machine driver + UI)
  funnel.ts                         glass_* events → POST /api/mirror/event
  take-recorder.ts                  MediaRecorder wrapper (on-device voice takes)
  fx-rack.ts                        echo/reverb/hall WebAudio graph + presets
  FxRackPanel.tsx                   slider rail + preset pills + monitor gate UI
  icons.tsx                         inline SVG icons (no emoji — house rule)
  glass.css                         committed dark cosmic theme (no light mode)
  renderer/
    GlassRenderer.ts                backend seam + async factory (GPU → lite)
    crack-field.ts                  shared crack geometry + painter (both backends)
    canvas2d/CanvasGlassRenderer.ts lite backend (every browser; the fallback)
    typegpu/TypeGpuGlassRenderer.ts PRIMARY backend — TypeGPU/WebGPU (mandate)
src/lib/glass/
  config.ts                         EVERY gameplay tunable (see §3)
  target.ts (+test)                 calibration → ceiling/median/target
  resonance.ts (+test)              tick physics: charge, fatigue, cracks, shatter
  metrics.ts (+test)                per-rep numbers, lock cleanliness, epicness
  session.ts (+test)                the phase reducer
  test-frames.ts                    synthetic pitch-track builders for tests
src/lib/pitch-f0-stream.ts          shared mic→YIN frame stream (mirror + glass)
src/lib/demo-audio.ts               audible guided demos (siren/hum/lock sketch)
src/lib/gpu/webgpu-device.ts        shared WebGPU adapter/device (promoted)
```

Wiring outside the feature: `vite.config.ts` (entry, `GLASS_PATHS` dev
rewrite, `pitch-core` + `vendor-gpu` chunks), `src/worker.ts` +
`wrangler.jsonc` (`assets.run_worker_first` alias routing), db-worker
`FUNNEL_EVENTS`, `public/sitemap.xml`.

## 3. Configuration — where every knob lives

**`src/lib/glass/config.ts` (`GLASS_CONFIG`) is the only place gameplay
numbers live.** Groups:

| Group         | The knobs you'll actually touch                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calibration` | `glideSeconds` (8), `ceilingSustainMs` (300) — raise if squeaks set the ceiling; retry guards (`minVoicedSeconds`, `minSpanSemitones`)                                                                   |
| `target`      | **`offsetSemitones` (−2)** — the difficulty dial; −2 is deliberately beginner-friendly ("fun experience, not perfect something"), move toward −1 when testing says so. `tolCents` (35) is the band width |
| `reps`        | `singSeconds` (8), `playbackMaxSeconds` (4.2), `restNudgeAfterReps` (6)                                                                                                                                  |
| `resonance`   | `rise`/`fall`/`riseAccel` — how fast the charge fills/drains; `lockForShatterSec` (0.8) anti-fluke gate                                                                                                  |
| `fatigue`     | `rate` (how fast near-misses damage), `assist` (0.38 — how much damage lowers the shatter wall), `crackSteps` (visual crack thresholds)                                                                  |
| `shatter`     | The §17.3 performance-scaled timing (slow-mo factors/durations, epicness weights) — consumed in P4                                                                                                       |

Other tunables, deliberately NOT in config:

- **FX presets + send levels** — top of `src/features/glass/fx-rack.ts`
  (`FX_PRESETS`, and the wet scalers inside `setSettings`). Cosmic names are
  decision 17: `Dry · Starlight · Nebula · Supernova`. Starlight is the
  default room (`DEFAULT_FX`); user changes persist in `localStorage`
  (`glass.fx.v1`).
- **Demo-audio levels/durations** — `src/lib/demo-audio.ts` (`DEMO_GAIN`).
- **Monitor feedback guard** — `RUNAWAY_RMS` / `RUNAWAY_HOLD_SEC` in
  `GlassApp.tsx`.
- **Mirror view range** — `VIEW_CENTS` (±340¢) in the renderers.

## 4. Routing & SEO (decision 15, amended)

`/glass` is served by Cloudflare's `html_handling` (extensionless →
`glass.html`, same as `/karaoke`). The three aliases —
`/break-glass-with-your-voice`, `/high-note-test`, `/shatter` — are **NOT
byte-copied HTML files** (unlike the mirror's aliases): they're listed in
`wrangler.jsonc → assets.run_worker_first`, which makes browser navigations
reach `src/worker.ts` BEFORE the asset layer; the worker serves `glass.html`
content at the alias URL. Canonical stays `/glass`; only `/glass` is in the
sitemap. Dev/preview mirror this via `GLASS_PATHS` in `vite.config.ts`.

## 5. Funnel & analytics

Events (see `funnel.ts`; all must exist in the db-worker `FUNNEL_EVENTS`
allowlist): `glass_view` (session-deduped) · `glass_mic_granted/denied` ·
`glass_calibrate_done` (ceilingMidi, targetMidi, usedFallback, renderer) ·
`glass_rep_done` (rep, meanAbsCents, bestLockMs, inBandPct) ·
`glass_playback_done` · `glass_shatter` (rep, fatigue) ·
`glass_results_view` (full summary + renderer) · `glass_fx_change` ·
`glass_monitor_on/off` · `glass_card_generated/shared` (P5) ·
`glass_cta_app_click`.

Ads: `glass_card_shared → card_shared`, `glass_cta_app_click → app_open`
(live cross-funnel actions); `glass_results_view → glass_complete` is
created in P6 via the campaigns repo (`scripts/create_conversions.py`).

**Deploy note:** the DEPLOYED db-worker rejects `glass_*` with HTTP 400
until it's redeployed with the extended allowlist (`pnpm deploy:db:dev` /
`:prod`). The beacon swallows this by design — telemetry never breaks the
page — but remember the deploy or the funnel counts nothing.

## 6. Verifying (the fake-singer recipe)

**`node scripts/verify-glass.mjs [baseUrl]`** drives the whole flow against
a running dev server (`VITE_DEV_PORT=3100 pnpm dev` if someone owns 3000).
It asserts the calibration→announce→rep→playback→results walk, the renderer
backend log, and the `[glass] take playback N.Ns` audible-replay proof.
`HEADED=1` runs on your display (see gotcha 4). Unit tests:
`pnpm exec vitest run src/lib/glass`. Always `pnpm check`.

How the fake singer works, and the gotchas that shaped it:

1. **The singer is injected at the `getUserMedia` level** (Playwright
   `addInitScript` patches it to return a WebAudio oscillator stream:
   0.4 s rest → 8.5 s exponential glide A2→A5 → 2.2 s hold on A4, looped).
   Holding A4 exercises the real ceiling path — the announce must show
   **G4** at the default −2 offset, a built-in config assertion.
2. **Why not Chromium's fake-audio device:** we started with
   `--use-file-for-fake-audio-capture=<wav>`; it worked, then silently
   started producing near-silence mid-day on a desktop with live audio
   activity (even the default beep tone died). OS-level fake audio is
   flaky on developer desktops; API-level injection is deterministic
   everywhere.
3. **Playwright's headless shell has NO `getUserMedia`**
   (`NotSupportedError`). The script resolves the FULL chromium binary
   from the Playwright cache
   (`~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`) and grants
   mic permission via `newContext({ permissions: ['microphone'] })` —
   `--use-fake-ui-for-media-capture` does NOT grant on the full binary.
4. **WebGPU headless:** `--enable-unsafe-webgpu --enable-features=Vulkan`
   makes the TypeGPU backend run headless (the backend log confirms it,
   and validation errors would surface on the console) — but **headless
   screenshots omit WebGPU canvas content**. For visual proof run with
   `HEADED=1` (composites correctly) or just open the page.

## 7. Build log / post-mortem

### P0 — skeleton (commit `714abea9`)

Entry + landing + funnel + worker-routed aliases + `Powered by TypeGPU`
footer credit (mandate, decision 9). Learned/decided:

- **Alias routing without byte copies** works via `assets.run_worker_first`
  (wrangler ≥4.x; the config-schema confirms support). The worker's rewrite
  block (`GLASS_PATHS`) finally fires for real navigations — the reason the
  mirror had to emit real files no longer applies to paths on this list.
- The plan commits were cherry-picked from the planning branch and had to be
  `--reset-author`-ed: the cloud session had stamped a `Claude` author,
  which the repo's authorship rule forbids.

### P1 — audio core (commit `b8481d2f`)

Shared `pitch-f0-stream` (frames now carry per-buffer `rms` — the fatigue
model needs loudness), the four pure libs + 30 synthetic-track tests, and
the real flow with the mirror's hardened mic handling. Learned:

- Mirror's `probeMic`/`rebuildAudio`/generation-token patterns ported
  as-is; they encode years of iOS WebKit pain — don't reinvent them.
- The calibration fallback path (median + 4 semitones) triggers naturally
  when the input never sustains a semitone ≥300 ms — the fake-singer WAV
  exercises it because an exponential sweep spends only ~250 ms per
  semitone. Real singers hold their top note; the ceiling path needs a
  human test.
- Physics tuning is test-pinned: rep-1-fails / rep-3-wins arcs are encoded
  in `resonance.test.ts` expectations, so retuning `GLASS_CONFIG` may
  legitimately require updating tests (they assert the MODEL, not magic).

### P2 — self-voice loop, FX rack, live mirror (commit `0ebc4766`)

- `take-recorder.ts`: MediaRecorder over the SAME stream micManager holds
  (never a second `getUserMedia`); mimeType chain
  `audio/webm;codecs=opus → audio/mp4 → audio/webm`; a 2 s watchdog on
  `onstop` so a wedged recorder can't hang the rep loop. Blobs are
  in-memory only, discarded on shatter (the burst is the payoff — no
  replay after it) and after each playback.
- Playback decodes via `decodeAudioData → AudioBufferSourceNode → fx.input`
  (sample-accurate, FX-routed) with an `<audio>`-element →
  `createMediaElementSource` fallback for undecodable blobs.
- `fx-rack.ts`: dry path + three parallel sends. Echo = feedback delay
  (0.28 s, 0.35 feedback) with a 3.2 kHz lowpass in the loop; Reverb =
  ConvolverNode with a GENERATED impulse response (1.2 s exp-decaying
  stereo noise — zero assets); Hall = 3.4 s IR darkened by
  neighbor-averaging passes. `input` (dry+wet) vs `wetInput` (sends only):
  playback uses the former, the live monitor the latter — in headphones
  you already hear yourself; the monitor adds the room.
- Monitor safety: OFF by default, explicit "I'm wearing headphones"
  confirm, and a runaway detector (RMS > 0.32 sustained 0.7 s while
  monitoring → self-disable + explanation).
- `GlassRenderer` seam + Canvas2D backend ported from the prototype. One
  renderer instance survives phase changes (its canvas is re-mounted into
  each panel's `.glass-stage`) so cracks persist across reps;
  `resetAll()` disposes it — a new session is a NEW glass.
- Analysis stays dry BY CONSTRUCTION: the FX graph hangs off playback and
  monitor only; the YIN stream reads the raw MediaStream.

### P3 — TypeGPU renderer

See §8 below for the backend details; summary + gotchas:

- **TGSL needs the build plugin.** `tgpu.vertexFn/fragmentFn` JS closures
  require `unplugin-typegpu` in vite — without it every draw fails at
  pipeline resolution with _"Missing metadata for tgpu.fn function body"_.
  If you ever see that error, the plugin fell out of `vite.config.ts`.
- **`tinyest` must be pinned 0.3.1** (override in `pnpm-workspace.yaml` —
  package.json `pnpm.overrides` does NOT apply in this workspace setup):
  tinyest 0.3.2 dropped the `FORMAT_VERSION` export and unplugin-typegpu
  crashes vite config loading. Same override chaos-master carries.
- Versions matched to chaos-master: `typegpu@^0.11.9` (upgraded from
  0.10.2 — the 0.10 API had pipelines behind `~unstable`),
  `unplugin-typegpu@^0.11.6`.

- typegpu upgraded 0.10.2 → **0.11.9** to match chaos-master's proven API
  (`tgpu.vertexFn`/`fragmentFn` TGSL closures, `root.createRenderPipeline`)
  — the two projects now share patterns.
- `webgpu-device.ts` promoted from guitar-tab-3d to `src/lib/gpu/` (shared
  acquire, device-loss handling); the factory acquires the device, then
  `tgpu.initFromDevice({ device })` — and `root.destroy()` on dispose,
  NEVER `device.destroy()` (crashes Firefox's GPU process; chaos-master
  learned this the hard way).
- The GPU scene is a fullscreen-quad TGSL fragment: SDF pane tint, target
  band, resonance ripples, specular sweep, and the ribbon evaluated as
  distance-to-polyline over a storage buffer of recent samples — additive
  glow, aqua in band, violet fringe with resonance. Cracks, chrome frame,
  perimeter meter and the note label render on a transparent Canvas2D
  OVERLAY (text/hairlines are not shader territory; geometry comes from
  the shared `crack-field.ts` so both backends stay identical).
- The whole renderer stack is a **lazy chunk**: `GlassApp` dynamic-imports
  the seam at Start, and the factory dynamic-imports the TypeGPU backend
  only when WebGPU is available. `typegpu`/`wgpu-matrix` are pinned to a
  `vendor-gpu` manualChunk so the landing (and non-WebGPU browsers) never
  download them.
- Which backend ran is reported as `renderer: 1|0` on
  `glass_calibrate_done` and `glass_results_view`.

## 8. Renderer backends

|             | TypeGPU (primary)                                                      | Canvas2D (lite)                            |
| ----------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| File        | `renderer/typegpu/TypeGpuGlassRenderer.ts`                             | `renderer/canvas2d/CanvasGlassRenderer.ts` |
| Chosen when | `navigator.gpu` + adapter/device acquired + `getContext('webgpu')` OK  | everything else, or any GPU-init failure   |
| Draws       | pane tint, ripples, target band, ribbon glow, specular (WGSL via TGSL) | same look, 2D canvas                       |
| Overlay     | shared Canvas2D overlay: frame, cracks, meter, label                   | integrated (same shared crack-field)       |
| Credit      | the "Powered by TypeGPU" footer is ALWAYS shown (mandate)              | same                                       |

Fallback is never a second product: physics, crack geometry, ribbon data
and all UI are shared; backends only rasterize.

## 9. What's next

- **P4 — shatter**: `fracture.ts` shared geometry (recursive biased convex
  splitting from the prototype §7), GPU shard instancing + lite 2D path,
  flash/slow-mo (performance-scaled, §17.3), results polish, baseline delta.
- **P5 — share card + SEO polish** · **P6 — campaign wiring** (db-worker
  deploy, `glass_complete` conversion, SKAG) · **P7 — in-app exercise twin**
  (`glass-shatter` in `/#/exercises`).
- Voice Mirror back-port: wire `demo-audio.ts` into the mirror's silent
  `TaskDemo` (separate PR — plan §17.4).
