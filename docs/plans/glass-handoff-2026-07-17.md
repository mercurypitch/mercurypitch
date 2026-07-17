# Glass — Campaign Handoff & Decisions Log (2026-07-17)

Planning handoff for **Glass** (`mercurypitch.com/glass`): a cinematic,
standalone campaign experience where the visitor's voice dances as a living
waveform inside a quicksilver mirror pane — and, by landing and holding a note
at the top of their own range, builds resonance until the glass **shatters**
in a real physics simulation. Between attempts they hear their **own recorded
voice** played back (on-device, never uploaded), the "get accustomed to your
voice" practice loop, and their rep-over-rep improvement is measured honestly.

Written so implementation can start in **any** environment with zero prior
chat context: read this file and you have every decision, the validated
mechanics, the architecture, the campaign wiring, and the open items.

- **This doc + prototype live on branch:** `claude/voice-mirror-visualization-d7h0q7`
  (session-designated). Implementation work should follow CLAUDE.md and use
  `feat/` branches (e.g. `feat/glass-campaign`).
- **Workflow rules (CLAUDE.md):** `feat/` branches, never push `main`, never
  force-push, **no Claude/AI attribution anywhere**, run `pnpm check` after
  code changes.
- **Interactive look-dev prototype (open in a browser):**
  [`docs/plans/prototypes/glass-shatter-prototype.html`](./prototypes/glass-shatter-prototype.html)
  — see §15 for what it validates and the tuned constants it contributed.

---

## 0. TL;DR

| | |
|---|---|
| What | Standalone campaign page `/glass`, sibling of `/mirror` and `/karaoke-night` |
| Fantasy | "Break glass with your voice" — the opera-singer trope, personalized |
| Loop | Calibrate ceiling → 3 reps of *sing → hear your real voice back → retry* → glass shatters |
| Renderer | **TypeGPU (WebGPU) — mandatory**, "Powered by TypeGPU" footer credit; Canvas2D "lite" fallback behind the same seam |
| Physics | Cumulative glass fatigue (near-misses leave permanent cracks) + resonance → Voronoi-style fracture, 3D shard tumble |
| Scores | Honest metrics + improvement delta; **no composite voice score** (house rule) |
| Share | Canvas PNG "shatter card" now; replay video Phase 2 |
| Backdrop | Procedural cosmos placeholder now; Higgsfield stills later (preflight → approval → generate) |
| Campaign | New funnel events → `glass_complete` conversion action → new SKAG per the campaigns-repo playbook |
| Privacy | Audio and analysis stay on-device, recordings in-memory only — same promise as the mirror |

## 1. Decision log (interview, chronological)

All twelve decisions were made explicitly by maff in the planning interview;
the four AskUserQuestion rounds are compressed here.

1. **Placement — standalone campaign page.** Own tiny Vite entry
   (`glass.html`), own funnel + Google Ads conversion, ad traffic lands
   directly on it. Not a mirror mode, not an in-app exercise.
2. **Concept — shattering mirror pane.** A full glass mirror shows the
   dancing waveform; climbing toward the target spider-cracks the pane;
   landing and holding it shatters the glass outward, revealing the cosmos
   (and the results) behind.
3. **Scoring — improvement-delta hybrid.** Honest metrics (cents precision,
   lock time, resonance) + a playful resonance/integrity meter + a
   rep-over-rep improvement delta. Deliberately NO "your voice = 62/100"
   composite (see `voice-mirror-phase2.md` §1 for the rationale).
4. **Backdrop — static art, generated later.** Ship a procedural starfield/
   nebula first; swap in 1–3 Higgsfield stills later (§9). No credits spent
   during planning.
5. **Target note — your own ceiling.** A short calibration glide finds the
   singer's range top; the glass is tuned near it. Personalized,
   stretchy-but-reachable, teaches reaching.
6. **Practice loop — 3 reps: record → hear yourself → retry.** Each rep the
   user's REAL voice is recorded (net-new infra, §8) and played back while
   the mirror re-dances to it. Repeated self-listening is the point.
7. **Shatter — true 3D glass.** Chosen over the lightweight 2D option.
8. **Name — Glass, at `/glass`.**
9. **3D stack — TypeGPU (house WebGPU stack). MANDATORY.** maff (who has
   another project heavily using TypeGPU — chaos-master, the source of the
   existing `webgpu-device.ts` adapter) requires WebGPU + TypeGPU for Glass,
   with a **"Powered by TypeGPU" footer credit**. Verified repo state:
   `typegpu@0.10` + `wgpu-matrix` are installed but `guitar-tab-3d` still
   renders Canvas2D (`TabRenderer.ts:107` TODO) — **Glass is the first
   shipped TypeGPU surface in the app.**
10. **Share artifact — shatter card now, video later.** PNG card in v1
    (reuses the mirror's card patterns); ~6 s replay video is Phase 2 (§10).
11. **Failure path — cumulative glass fatigue.** Damage persists across
    reps; every near-miss leaves real micro-cracks and honestly lowers the
    shatter threshold (resonance stress is physically cumulative). Persistence
    always pays off; the card reports "shattered on rep N" truthfully.
12. **Deliverables this session — this doc + interactive prototype** (§15).

## 2. The experience, beat by beat

1. **Landing.** "Can your voice break glass?" One CTA. Trust copy: "Your
   audio never leaves this device." Footer: `Powered by TypeGPU` (linked)
   — REQUIRED, per decision 9.
2. **Mic moment.** Same hardened flow as the mirror: AudioContext + stream
   acquired inside the tap, `probeMic()` silence check with one automatic
   graph rebuild (the iOS WebKit fix), echoCancellation/noiseSuppression/AGC
   off for honest pitch. Copy the learnings from `MirrorApp.tsx` §start.
3. **Calibration glide (~8 s).** "Slide from low to high, like a siren."
   The mirror wakes up as they sing — first magic moment. Output: the
   ceiling note and the **target** (§3.2), announced with theater: the pane
   etches a gold target line and hums the note. "This glass rings at G4.
   Your G4."
4. **Rep loop (×3, the heart).** Per rep:
   - **Sing (~8 s).** The waveform ribbon dances in the glass; nearing the
     target raises ripples and a perimeter resonance meter; near-misses
     visibly fatigue the pane (hairline cracks that STAY).
   - **Listen back.** Their actual recorded take replays (on-device) while
     the mirror re-dances to the same frames in gold. Coach copy: "That was
     you. Getting used to your own voice IS the exercise."
   - **Retry.** Metrics quietly logged per rep (§4).
5. **The shatter.** Resonance filled while locked ≥0.8 s → white flash →
   slow-motion fracture → shards tumble in 3D with the waveform still
   glowing on them → the cosmos behind is revealed.
   If three reps pass without a shatter: the session continues — fatigue
   makes rep 4, 5, … progressively winnable; the coach reframes ("The glass
   remembers every close call").
6. **Results.** "Shattered on rep 3" + honest numbers (§4) + improvement
   delta + shatter card share/copy/download + "Open MercuryPitch" CTA +
   "Sing it again" (new glass).

## 3. Flow & mechanics spec

### 3.1 Session state machine

Pure reducer in `src/lib/glass/session.ts` (mirror the
`src/lib/mirror/session.ts` pattern + tests):

```
idle → mic → calibrate → announce → rep(n): sing → rep(n): playback → gap
     ↻ (n+1)                                    ↘ shatter → results
```

Component owns timers/audio/rendering; the reducer owns ordering. Every
async flow uses the mirror's **generation-token pattern** (`flowGen`) so
back/forward/reset orphans die at their next checkpoint.

### 3.2 Target selection (calibration → the glass's note)

- Glide take → voiced frames (`conf ≥ CONF_MIN`) → per-semitone dwell.
- **Ceiling** = highest semitone sustained ≥ 300 ms.
- **Target** = ceiling − 1 semitone (snapped). Stretchy but reachable.
- Guard rails: if the glide yields < 1.5 s voiced or < 5 semitones span,
  re-run calibration once, then fall back to target = median + 4 semitones.
- Tolerance: **±35 cents** (`HIT_TOLERANCE_CENTS`, octave-folding OFF here —
  reaching the actual pitch height is the fantasy; document this divergence
  from the mirror's match task in copy: "any octave" does NOT apply).

### 3.3 Resonance + fatigue model (validated in the prototype, §15)

Constants (prototype-tuned; start here, tune with real singers):

| Constant | Value | Meaning |
|---|---|---|
| `TOL_CENTS` | 35 | in-band tolerance |
| `RES_RISE` | 0.30 /s | resonance growth base; accelerates `(+0.5·res)` |
| `RES_FALL` | 0.55 /s | decay when out of band |
| `LOCK_FOR_SHATTER` | 0.8 s | continuous lock required before shatter may fire |
| `FATIGUE_RATE` | 0.052 | stress→damage rate; stress = `level · proximity²`, proximity = `1 − |off|/300¢` |
| `FATIGUE_ASSIST` | 0.38 | full fatigue lowers the shatter wall by 38% |
| `CRACK_STEPS` | .18/.36/.55/.74/.90 | fatigue thresholds that spawn permanent cracks |

- `resonance += dt · (RES_RISE + 0.5·res) · (1 − 0.4·|off|/TOL)` in band;
  `−= dt · RES_FALL` out of band. Clamp 0..1.
- `fatigue` only rises (per glass); **persists across reps** — the honesty
  mechanism AND the guarantee that persistence eventually wins.
- **Shatter when** `resonance ≥ 1 − FATIGUE_ASSIST·fatigue` AND
  `lockRun ≥ LOCK_FOR_SHATTER`.
- All pure functions over `{t, cents, level, voiced}` frames →
  `src/lib/glass/resonance.ts` + synthetic-track tests (house pattern).

## 4. Scores & results (the honest hybrid)

Per rep (pure, `src/lib/glass/metrics.ts`):

- `meanAbsCents` over voiced frames (→ "Precision ±18¢")
- `bestLockSec` (longest continuous in-band run)
- `inBandPct`, `peakResonance`
- Rep index, plus session-level: `shatterRep` (0 = glass held), final
  `fatigue`, `targetMidi`, `ceilingMidi`.

Results screen shows: shattered-on-rep-N (or "the glass held — best attempt
was 12¢ away"), Resonance %, Best lock, Precision, and the **delta line**:
"▲ 41% tighter than rep 1". Baseline across visits à la
`src/lib/mirror/baseline.ts`: store the last session's summary in
localStorage (`glass.baseline.v1`) → "Since Tuesday: +2 semitones higher,
0.8 s longer lock." **Never a composite score.** Vocal-health guard in copy:
cap suggested attempts per session (e.g. soft "give your voice a rest"
nudge after ~6 reps) — high-note repetition is real strain.

## 5. Architecture

### 5.1 Entry & routing (clone the mirror wiring)

- `glass.html` — third standalone entry: SEO meta + FAQ JSON-LD (§12),
  loads `/src/features/glass/main.tsx`. Add to `rollupOptions.input` in
  `vite.config.ts`.
- Dev/preview rewrites: add `GLASS_PATHS = new Set(['/glass', '/break-glass-with-your-voice'])`
  to `standaloneEntryRewritePlugin`; emit alias HTML byte-copies in
  `mirrorAliasFilesPlugin` (rename it `aliasFilesPlugin`); check the root
  wrangler worker for the mirror/karaoke path rewrites and mirror them.
- Bundle rules (strict, same as mirror): **YIN only, no ONNX/model weights**;
  shared leaves ride the `pitch-core` manualChunk; the TypeGPU renderer is a
  **dynamic import behind the Start tap** so the landing stays instant.
  Budget: landing JS ≤ ~120 KB gz incl. `vendor-solid`; renderer chunk lazy.

### 5.2 Feature layout

```
src/features/glass/
  main.tsx            entry bootstrap (consent init, funnel view)
  GlassApp.tsx        flow orchestration (mirror MirrorApp patterns)
  funnel.ts           glass_* events (§11)
  glass.css
  take-recorder.ts    NET-NEW: MediaRecorder capture + on-device playback (§8)
  card-renderer.ts    shatter card (adapt mirror card-renderer)
  renderer/
    GlassRenderer.ts            backend-agnostic seam (interface + factory)
    typegpu/TypeGpuGlassRenderer.ts   PRIMARY (mandatory)
    canvas2d/CanvasGlassRenderer.ts   lite fallback (seeded from the prototype painter)
src/lib/glass/        pure logic + tests: session.ts, target.ts,
                      resonance.ts, fracture.ts, metrics.ts, baseline.ts
src/lib/gpu/webgpu-device.ts   PROMOTED from guitar-tab-3d (shared acquire,
                      device-loss handling); tab-3d imports move here too
```

`src/features/mirror/f0-stream.ts` is duplicated per feature today —
promote it to `src/lib/pitch-f0-stream.ts` (covered by the `pitch-core`
chunk regex) and have mirror + glass share it.

### 5.3 Renderer seam & the TypeGPU mandate

- `createGlassRenderer()`: `isWebGpuSupported()` → try
  `acquireWebGpuDevice()` → **TypeGpuGlassRenderer**; on failure →
  **CanvasGlassRenderer** (lite). Report which backend ran as a funnel
  metric (`renderer: 1|0`) so real WebGPU coverage on ad traffic is known.
- **The fallback is NOT a second build**: fracture geometry (§7), resonance
  model (§3.3), ribbon/crack/HUD data all live in shared pure modules; the
  backends only rasterize. The look-dev prototype (§15) is literally the
  first draft of the Canvas2D backend.
- **Footer credit (required):** `Powered by TypeGPU` on the landing +
  results screens, linking `https://docs.swmansion.com/TypeGPU/`. Copy in
  the lite fallback: "Best on a WebGPU browser — powered by TypeGPU".

### 5.4 TypeGPU scene (v1 pipelines; no compute required)

1. **Backdrop quad** — procedural cosmos (gradient + star hash) or, later,
   the Higgsfield still as a sampled texture (§9).
2. **Pane quad** — SDF rounded-rect; ripple heightfield = traveling waves
   emitted from the ribbon head + a standing wave on the target line scaled
   by resonance; normals from the heightfield gradient drive env reflection
   (refracted sample of the backdrop) + a drifting specular band that
   brightens with resonance.
3. **Ribbon** — last ~150 `{cents, level}` samples as an instanced quad
   strip (additive, blue→aqua by proximity, violet fringe ∝ resonance).
4. **Cracks** — growing polyline segment list (uniform/storage buffer),
   rendered as SDF etches that also perturb the pane normals.
5. **Shards** — CPU integrates ≤128 rigid bodies (gravity 980 px/s², drag,
   3D tumble about a random in-plane axis, slow-mo 0.16× for 0.45 s then
   ramp); per-frame instance buffer {2×3 affine from projected rotated
   basis, alpha, brightness = facing}; fragment samples the pane snapshot
   texture. Dust = instanced points; flash = fading fullscreen quad.
6. **HUD/meter** — DOM/CSS overlay (chips, coach line, perimeter meter can
   stay canvas/DOM; don't shader-render text).

Perf gates: 60 fps on a mid phone, DPR clamp ≤2, pause when
`document.hidden`, shard count halved under `prefers-reduced-motion`
(plus no flash, no slow-mo).

## 6. The mirror visualization (feel spec — validated in the prototype)

- **Idle**: pane breathes — faint mirrored starfield, slow specular drift.
- **Voice**: ribbon glows blue; head dot swells with level. In-band → aqua,
  ripples bloom from the target line, hum swells (§8 audio), perimeter
  meter fills gold → aqua near the top.
- **Near-miss**: crack birth is FELT — a micro shudder (translate ±1.5 px,
  120 ms), a glint along the new crack, integrity chip ticks down.
- **Coach voice** (brand: encouraging, precise, never shames):
  "You're 18¢ flat — ease up." / "There — hold it steady." /
  "Locked. Keep pouring into it." / "The glass remembers every close call."
- **Playback**: ribbon replays in gold; copy names the moment: "That was you."

## 7. Shatter physics (the algorithm that shipped in the prototype)

Shared pure module `src/lib/glass/fracture.ts` (used by BOTH backends):

1. **Fracture pattern** — recursive convex splitting: start from the pane
   rect; split each polygon with a chord through a jittered interior point;
   chords near the impact are biased to aim at it (radial look); recurse
   depth 7 (~100 shards), early-out below ~260 px² or (far from impact,
   shallow depth) with p=0.35 — small shards cluster at the impact,
   big slabs at the rim, exactly like real glass.
2. **Bodies** — per shard: centroid, outward velocity ∝ `1.5 − dist/0.8h`
   (impact-centered burst) + upward bias + random z ±340; angular velocity
   ±7 rad/s about a random in-plane axis.
3. **Integration** — gravity 980, drag 0.4/0.3, weak-perspective projection
   (f=900): the affine from the rotated, projected basis vectors; brightness
   from facing (`|cos rot|`); alpha fade over ~3.5 s.
4. **Timeline** — flash (0.22 s) → slow-mo 0.16× (0.45 s) → ramp to 1× →
   results at ~1.9 s. Deterministic via seeded PRNG (mulberry32) so replays
   and the Phase-2 video can reproduce a shatter exactly.

## 8. Self-voice recording & playback (NET-NEW infrastructure)

Nothing in the app records or replays the user's actual audio today (all
exercises keep pitch contours only) — this is Glass's genuinely new
capability, and it must honor the privacy promise loudly.

- **Capture**: `take-recorder.ts` wraps `MediaRecorder` on the SAME
  MediaStream `micManager` already holds (no second getUserMedia).
  MimeType fallback chain: `audio/webm;codecs=opus` → `audio/mp4` →
  `audio/webm` → first `isTypeSupported`. Chunks in memory; stop → Blob.
- **Playback**: `decodeAudioData` → `AudioBufferSourceNode` on the existing
  AudioContext, started on the same clock that drives the visual replay of
  the take's recorded `F0Frame[]` — audio and the gold ribbon stay in sync.
  Fallback if decode fails (some Safari webm cases): `<audio src=objectURL>`.
- **Capture pauses during playback** (F0 loop off, recorder off) — no
  feedback loop; on phones playback routes to the speaker at modest gain.
- **Privacy rules (hard):** blobs live in memory only, one take at a time,
  `URL.revokeObjectURL` + drop on rep advance/reset/unload; NEVER persisted
  (no IndexedDB), NEVER beaconed. Landing + playback copy both state it:
  "Recorded on your device, played back to you, then deleted."
- Mic-silence, iOS AudioContext resume, and context-leak handling: copy the
  mirror's `probeMic`/`rebuildAudio`/teardown code paths verbatim.

## 9. Higgs-field backdrop (Higgsfield MCP — deferred generation)

- v1 ships the **procedural cosmos** (prototype's backdrop: indigo
  `#0b1026 → #090714`, violet/aqua nebula wisps, two star layers) — it is
  already on-brand and free.
- Later: generate 1–3 stills on **`nano_banana_2`** (~1.5 cr @1k, the
  proven recipe from `voice-mirror-handoff-2026-07-09.md` §8). Discipline is
  LAW: `get_cost: true` preflight → maff approves → generate → show → stop.
- Prompt scaffold (Style-A-consistent):

  > A vast deep-indigo-to-black cosmic nebula dusted with tiny constellation
  > stars, thin ribbons of liquid mercury drifting through the void catching
  > gold and periwinkle starlight, a faint circular resonance ripple of
  > light at the center, dark cinematic lighting, ultra-detailed, sleek and
  > premium, no text, no watermark — aspect 9:16 (mobile) + 16:9 (desktop)

- Ship as `public/glass/backdrop-{portrait,landscape}.webp` ≤ 200 KB each
  (`magick -quality 82`); the TypeGPU backdrop quad samples them with a slow
  parallax drift; procedural stays as the no-asset fallback.

## 10. Share artifact

- **v1 — shatter card (PNG canvas):** frozen mid-burst shard composition
  (re-render the deterministic fracture at its most photogenic frame) +
  data block: `SHATTERED AT G4 · rep 3 · resonance 94% · lock 2.1s · ±18¢`
  (+ delta line, + "glass held" variant). Square + story formats, share /
  copy / download — adapt `src/features/mirror/card-renderer.ts` wholesale
  (fonts, share/clipboard outcomes, dated filenames, Safari gesture rule:
  decode/prepare assets BEFORE the tap).
- **Phase 2 — replay video (~6 s):** deterministic replay (seeded fracture +
  stored frames) re-rendered to a capture canvas →
  `canvas.captureStream(30)` + recorded audio track → MediaRecorder
  (`video/mp4` on Safari, `video/webm` elsewhere) → Web Share API Level 2
  files. Risks (codec matrix, memory on low-end) are why it is NOT in v1.

## 11. Funnel & campaign wiring ("track it into a campaign")

### 11.1 App-side funnel (`src/features/glass/funnel.ts`)

Karaoke-style prefixed events, same transport (POST `/api/mirror/event`,
shared anonymous `mirror.clientId.v1`, keepalive fetch — reuse the mirror
funnel's CORS-safe beacon verbatim):

```
glass_view · glass_mic_granted · glass_mic_denied · glass_calibrate_done
glass_rep_done (metrics: rep, meanAbsCents, bestLockMs, inBandPct)
glass_playback_done · glass_shatter (metrics: rep, fatigue, renderer)
glass_results_view (metrics: ceilingMidi, targetMidi, shatterRep,
                    bestLockMs, precisionCents, reps, renderer)
glass_card_generated · glass_card_shared · glass_cta_app_click
```

- Extend `FUNNEL_EVENTS` in `workers/db-worker/src/index.ts` (~line 620)
  with the list above (comment block per house style). No new route/table.
- Ads mapping in the funnel chokepoint (like `AD_CONVERSION_BY_EVENT`):
  `glass_results_view → AD_CONVERSIONS.glass_complete` (NEW),
  `glass_card_shared → AD_CONVERSIONS.card_shared` (existing),
  `glass_cta_app_click → AD_CONVERSIONS.app_open` (existing).

### 11.2 Campaigns repo (`disjoint-colliders/packages/campaigns`)

1. **Create the conversion action** `glass_complete` (secondary/observed
   until the Glass SKAG launches, then its primary bid target) via
   `scripts/create_conversions.py`; record the `send_to` in
   `mercury/config/conversion-map.md` AND in `AD_CONVERSIONS`
   (`src/lib/consent.ts`) — note the map is missing karaoke's live action;
   add both rows while there.
2. **New SKAG — "Campaign G · Glass"** per `playbook/01`: build PAUSED →
   checklist → enable. Keyword theme (run Keyword Planner first, Phase-0
   rule): `"break glass with your voice"`, `"can you break glass by
   singing"`, watchlist `"highest note test"`, `"how high can I sing"`.
   This is a curiosity/challenge theme — expect cheap CPCs, unknown volume;
   it is ALSO a natural YouTube/Shorts creative later (the shatter replay).
3. LP H1 must word-match the winning keyword (§12); geo tiers, negatives,
   budget discipline all inherit from `mercury/campaign-plan.md`.
4. **Success criteria (Phase-1 style):** cost per `glass_complete` ≤ €1.50;
   shatter rate ≥ 60% of completed calibrations; `glass_card_shared` ≥ 5%
   of results; junk terms < 5% of spend.

## 12. SEO surface

- `glass.html` head (clone mirror.html patterns): title
  **"Break Glass With Your Voice — Free 60-Second Challenge"**; description
  sells the fantasy + privacy; canonical `https://mercurypitch.com/glass`;
  OG/Twitter cards; FAQ JSON-LD: "Can a human voice really break glass?"
  (yes — resonance, loudness, sustain), "What note breaks glass?" (the
  glass's resonant frequency — here, tuned to YOUR range), "How do opera
  singers shatter glass?".
- Alias route `/break-glass-with-your-voice` (byte-copy HTML like
  `/vocal-range-test`); add both to `public/sitemap.xml`.
- Cross-links: mirror results → "Think you can break glass with that
  range?" (funnel cross-pollination, and vice versa).

## 13. Delivery phases (each lands green: `pnpm check` + tests + size gate)

- **P0 — Skeleton.** `glass.html` + entry + vite wiring + landing +
  `Powered by TypeGPU` footer + funnel `glass_view` + db-worker allowlist.
- **P1 — Audio core.** Mic flow (mirror-hardened), shared `f0-stream`
  promotion, calibration → target, session reducer, resonance/fatigue libs
  (+ synthetic-track tests). Playable with debug bars, no visuals.
- **P2 — Self-voice loop.** `take-recorder.ts` (record/decode/replay),
  playback-driven ghost replay, rep cycle end-to-end on the **Canvas2D lite
  renderer** (seeded from the prototype) — the full product loop works
  before any GPU code.
- **P3 — TypeGPU renderer.** Promote `webgpu-device.ts` → `src/lib/gpu/`;
  pane/ripples/ribbon/cracks pipelines behind the seam; lazy chunk;
  backend funnel metric.
- **P4 — Shatter.** `fracture.ts` shared geometry + TypeGPU shard
  instancing + lite 2D projection path + flash/slow-mo/dust + results
  screen + fatigue-across-reps + baseline delta.
- **P5 — Share & SEO.** Shatter card (square/story, share/copy/download),
  aliases, sitemap, FAQ schema, mobile audit (`audit:mobile` pattern).
- **P6 — Campaign.** Remaining funnel events + ads mapping; campaigns-repo
  conversion action + config; Phase-0 checklist (Tag Assistant verify)
  before any spend.
- **Phase 2 (post-launch):** replay video, Higgsfield backdrop stills,
  mirror cross-links, possibly "glass gallery" (wine glass / window /
  chandelier as difficulty skins).

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| WebGPU missing on a slice of ad traffic | Lite Canvas2D fallback behind the same seam (shared geometry/logic); measure real coverage via the `renderer` funnel metric before investing more in either path |
| iOS silent-mic / suspended AudioContext | Reuse the mirror's `probeMic` + `rebuildAudio` + gesture rules verbatim (hard-won) |
| MediaRecorder codec matrix | mimeType fallback chain + decode-check + `<audio>` fallback (§8); recording is a progressive enhancement — if unsupported, the rep loop runs with contour-only replay |
| Feedback/echo during playback | Capture fully paused during playback; modest playback gain |
| Perf on low-end (shatter) | ≤128 shards, DPR clamp, reduced-motion path, pause on hidden |
| Vocal strain (repeated high notes) | Soft rest nudge after ~6 reps; coach copy never pushes louder, only steadier |
| Keyword volume unknown | Phase-0 Keyword Planner pass before building the SKAG; the theme doubles as organic short-form content either way |
| Bundle creep | Lazy renderer chunk, no ONNX, `pnpm size` gate in P0 and every phase |
| Higgsfield spend | Preflight `get_cost` → approval → generate → stop (standing rule) |

## 15. The look-dev prototype (this session's second deliverable)

**File:** `docs/plans/prototypes/glass-shatter-prototype.html` — a single
self-contained page (Canvas 2D + WebAudio, zero dependencies). Open it in
any browser. **It validates choreography, palette, physics feel, scoring
and copy — NOT the rendering stack** (production is TypeGPU, per decision
9; the prototype painter is the seed of the lite fallback backend).

What's real in it (and transfers 1:1):

- The full rep arc: **▶ Run guided demo** plays three scripted "singer"
  takes — rep 1 wobbly miss, rep 2 near-miss (~70% resonance), rep 3 locks
  and shatters organically — with the listen-back beat between reps.
- **Free sing · drag** — pointer = pitch, hold = sing; you can work the
  glass yourself, fatigue it, and shatter it.
- The §3.3 resonance/fatigue model with the exact constants tabled above;
  permanent cracks at fatigue steps; honest results panel with per-rep
  metrics and the improvement delta.
- The §7 fracture algorithm (recursive biased convex splitting, seeded),
  slow-mo shard burst with 3D-projected tumble, dust, flash.
- Synthesized sound: glass hum ∝ proximity·resonance, darker "your take"
  timbre on playback, noise-burst + crystalline-ping shatter. Mute toggle;
  `prefers-reduced-motion` respected.
- Verified headless (Playwright, 1180×780): three runs, zero console
  errors, no early shatter in reps 1–2, organic rep-3 shatter, delta line
  rendered ("▲ 76–77% tighter than rep 1").

## 16. How to continue in a fresh environment

```bash
git fetch origin
git checkout claude/voice-mirror-visualization-d7h0q7   # this doc + prototype
# open docs/plans/prototypes/glass-shatter-prototype.html in a browser
# implementation: branch off main as feat/glass-campaign (CLAUDE.md rules)
pnpm install && pnpm dev
```

Then tell the assistant: *"Read `docs/plans/glass-handoff-2026-07-17.md`
and start Phase P0."* Higgsfield generation (§9) needs the Higgsfield MCP
connector attached and ALWAYS runs preflight-cost → approval first. The
campaigns-repo steps (§11.2) touch
`disjoint-colliders/packages/campaigns` — a separate repo; keep its
`.env`/refresh-token security rules.

### Open items for maff

- [ ] Judge the prototype's feel (run the guided demo + free sing): shatter
      weight, slow-mo length, crack pacing, coach copy tone.
- [ ] Confirm target rule (ceiling − 1 semitone) vs. a slightly easier
      ceiling − 2 for first-time visitors.
- [ ] Keyword Planner pass on the §11.2 theme before the SKAG build.
- [ ] Decide the alias slug: `/break-glass-with-your-voice` (long, exact
      match) vs `/glass-challenge`.
- [ ] Phase-2 replay video: greenlight after v1 funnel data.
