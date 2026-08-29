# Drum Night Playback Intelligence (PR A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the four shipped drum kits sound human with zero new assets: pool-based sample selection (no machine-gun), per-articulation dB-domain velocity dynamics with a velocity-to-brightness filter, seeded per-hit micro-variation, and decode-time onset alignment.

**Architecture:** Two new pure modules (`drum-sample-select.ts`, `drum-hit-dynamics.ts`) hold all the math and randomness behind injectable seeded PRNGs; `drum-kit-player.ts` wires them into `chooseResource`/`playSample`/decode. No manifest or curation-schema changes — onset is measured from the decoded buffer at runtime (browser-exact, immune to MP3 codec-padding differences), and layer targeting uses velocity-range centers (curated `power` lands with the deep kits in PR C).

**Tech Stack:** TypeScript, WebAudio, Vitest (existing FakeAudioContext harness in `drum-kit-player.test.ts`).

**Spec:** Research + plan artifact "Drum Night Sound & Feel" (https://claude.ai/code/artifact/1e932a06-d3e8-4514-b2f3-5b3c0b142cb9); raw reports in `~/agent-out/mercurypitch/2026-08-28/drum-research-*.md`. Branch: `feat/drum-night-sound-feel` off `feat/drum-night-foundation` (PR #628).

## Global Constraints

- No emojis anywhere; SVG icons only.
- `pnpm check` must pass after code changes; focused vitest for the drum suite.
- NO commits/pushes/PRs until the user asks (project rule) — the per-task commit steps below are deferred; keep the working tree reviewable instead.
- Synth fallback path (`triggerDrumVoice`) stays byte-identical — synthesis work is PR D.
- All randomness must flow through injectable, seeded PRNGs (deterministic tests, reproducible sessions).
- Never `stop()` an audible voice — fades only (existing de-click discipline).

---

### Task 1: Pure selection module

**Files:**
- Create: `src/features/drum-night/audio/drum-sample-select.ts`
- Test: `src/features/drum-night/audio/drum-sample-select.test.ts`

**Interfaces:**
- Produces: `fnv1a32(...values: number[]): number`; `mulberry32(seed: number): () => number`;
  `createDrumSampleSelector(seed: number): DrumSampleSelector` where
  `DrumSampleSelector = { pick(pool: readonly DrumKitSampleResource[], velocity: number): DrumKitSampleResource | null; reset(): void }`.
- Consumes: `DrumKitSampleResource` from `./drum-kit-manifest` (fields: `id`, `velocityMin`, `velocityMax`, `roundRobin`).

Selection algorithm (from DrumGizmo's power-pool technique, adapted to velocity-range centers):
- Sort pool by `(velocityMin, roundRobin)`. Target `t = (clamp(v,1,127) - 1) / 126`.
- Center per entry `c_i = ((velocityMin + velocityMax) / 2 - 1) / 126`.
- Jitter sigma = `0.5 * meanGapBetweenDistinctCenters` (0 when single center).
- Score `s_i = |c_i - t| + gauss(random) * sigma + recencyPenalty(id)`; gauss = Box-Muller from two uniform draws.
- `recencyPenalty`: 0.30 for the immediately previous pick, 0.12 for the one before, keyed per selector instance; guarantees no immediate repeat whenever the pool has >= 2 entries within one sigma of the target.
- Deterministic: same seed + same call sequence => same picks.

- [x] **Step 1: Write failing tests** — determinism (two selectors, same seed, 32 picks identical); no-immediate-repeat on a 2-RR equal-layer pool over 64 picks; layer targeting (v=20 picks l1-center entries overwhelmingly, v=120 picks l2, over 200 picks with seed sweep); single-sample pool always returns it; empty pool returns null.
- [x] **Step 2: Run, verify fail** (`pnpm vitest run src/features/drum-night/audio/drum-sample-select.test.ts`).
- [x] **Step 3: Implement module.**
- [x] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — deferred (user commits).

### Task 2: Pure dynamics module

**Files:**
- Create: `src/features/drum-night/audio/drum-hit-dynamics.ts`
- Test: `src/features/drum-night/audio/drum-hit-dynamics.test.ts`

**Interfaces:**
- Produces:
  - `velocityGain(articulation: DrumVoiceId, velocity: number): number` — dB-domain curve `(v/127)^e`, exponent 2.0 for drums, 1.6 for metals (`hh-*`, `crash`, `ride`), floor 0.02 at v=1 (~-34 dB, ghost notes survive).
  - `brightnessCutoffHz(velocity: number): number | null` — `1200 * 2^(4 * v/127)`; returns `null` (bypass, no filter node) when >= 16000.
  - `microVariation(random: () => number, articulation: DrumVoiceId): { rateRatio: number; gainScale: number; cutoffScale: number; startOffsetSec: number }` — cents uniform in +/-10 (drums) / +/-25 (metals + `clap`), `rateRatio = 2^(cents/1200)`; gain uniform +/-0.75 dB as linear scale; cutoffScale uniform 0.94..1.06; startOffsetSec uniform 0..0.0004.
  - `measureOnsetSeconds(buffer: AudioBuffer): number` — scan channel 0 for first |sample| > 0.001 within the first 60 ms, return `max(0, t - 0.001)`; defensively returns 0 when `getChannelData` is absent/throws or the buffer is silent in the window.
- Consumes: `DrumVoiceId` from `@/lib/drum-voices`.

- [x] **Step 1: Failing tests** — curve endpoints (v=127 => 1, v=1 => floor), metals shallower than drums at v=64; cutoff null at v>=~113, ~1266 Hz at v=8; micro-variation bounds and determinism under mulberry32; onset scan finds a synthetic onset at 30 ms within 1.5 ms, returns 0 for missing getChannelData and for silence.
- [x] **Step 2: Run, verify fail.**
- [x] **Step 3: Implement.**
- [x] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — deferred.

### Task 3: Wire into the player

**Files:**
- Modify: `src/features/drum-night/audio/drum-kit-player.ts` (`CachedSample`, decode path, `chooseResource`, `playSample`, options)
- Test: `src/features/drum-night/audio/drum-kit-player.test.ts` (extend harness: `FakeBufferSourceNode.start(at, offset)` capture + `playbackRate` param; buffers with `getChannelData`)

**Interfaces:**
- Consumes: Task 1 selector, Task 2 dynamics.
- Produces: `CreateDrumKitPlayerOptions.selectionSeed?: number` (default `0xd1a7`), unchanged `DrumKitPlayerPort`.

Wiring:
- `CachedSample` gains `onsetSec: number`, set right after `decodeAudioData` via `measureOnsetSeconds`.
- `chooseResource(gmKey, velocity)`: pool = `drumKitResourcesForHit(selectedKitId, gmKey, velocity)` REPLACED by the full articulation pool: `drumKitResourcesForKey(selectedKitId, gmKey)` = all resources whose `gmKeys` include the key regardless of velocity band (add tiny helper in player, not manifest); selector `pick(pool, velocity)`; keep cache preference (`cache.has`) with fallback to any cached pool member, and `warmMiss` for the preferred pick. One selector per player instance, `reset()` on `selectKit`.
- `playSample`: draws `microVariation`; `strikeGain = max(MINIMUM_GAIN, resource.playbackGain * velocityGain(articulation, velocity) * mv.gainScale)`; `source.playbackRate.value = mv.rateRatio`; cutoff = `brightnessCutoffHz(velocity)`, when non-null scaled by `mv.cutoffScale`, lowpass Q 0.5, chain `source -> filter -> gain`, else `source -> gain`; `source.start(at, min(cached.onsetSec + mv.startOffsetSec, max(0, buffer.duration - 0.001)))`.
- `SampleVoice` gains optional `filter` for cleanup; disconnect it in `cleanVoice`.
- Baseline prewarm (`resourcesForHits`) still uses `drumKitResourcesForHit` (velocity-banded) so warm-up stays 5 fetches.

- [x] **Step 1: Failing tests** — trigger uses selector (two equal hits pick different resources); strikeGain reflects articulation curve (hat at v=64 louder than kick at v=64 relative to their v=127 gains); filter present at low velocity, absent at v=127; `start` called with onset offset when decoded buffer has a 30 ms silent lead; playbackRate within +/-25 cents; determinism with fixed `selectionSeed`.
- [x] **Step 2: Run, verify fail.**
- [x] **Step 3: Implement wiring.**
- [x] **Step 4: Full drum suite green** (`pnpm vitest run src/features/drum-night src/tests/drum-voices.test.ts src/tests/drum-machine.test.ts`) + existing 870-line player spec untouched semantics (update only where velocity-gain constants are asserted).
- [ ] **Step 5: Commit** — deferred.

### Task 4: Verify choke semantics (no code expected)

**Files:** read `public/drum-night/kits/catalog.json` hh entries + `drum-kit-player.ts` choke path.

- [x] Confirm `hh-pedal`/`hh-closed` resources list `chokes: ["hh"]` (or equivalent) so open-hat choking already happens with the 45 ms fade; confirm pedal plays its own sample. If missing, add the choke wiring test + fix; research target is 25-60 ms — 45 ms is in range, leave constant alone.

### Task 5: Gate

- [x] `pnpm check` clean; focused vitest green; note in PR-description draft that curated `power` + per-kit `velcurve` overrides arrive with PR C.

---

## Roadmap context (PR B-E, separate plans)

- **PR B — Feel engine** (engine DONE in this branch, UI wiring PENDING):
  - [x] `src/features/drum-night/groove/groove-humanize.ts` + 13 tests — seeded streams, Friberg swing curve, functional Voss-McCartney pink noise, shared leaky drift walk, per-style profiles with asymmetric clamps, flams, `suggestGhostSteps`.
  - [x] `drum-session-scheduler.ts` `humanize` option + ornament triggers + `HUMANIZED_DRUM_SESSION_LOOKAHEAD_MS = 120` default when the hook is present; occurrence records played values; throwing/null hooks fall back to authored values.
  - [x] `src/features/drum-night/session/drum-session-humanize.ts` bridge (GM fold, timeline-beat -> bar/step, 16-bar noise cycle) + 4 tests.
  - [x] `scripts/extract-groove-profiles.py` (offline GMD extraction; run needs the downloaded dataset — not yet executed; output JSON will override the flat per-position defaults).
  - [ ] UI wiring: style/intensity/swing + locked controls in DrumNightApp/DrumGrooveEditor, feed `createDrumSessionHumanizer` into the session scheduler construction (find it in `useDrumNightRuntime.ts` / DrumNightApp), persist settings, default humanize OFF for imported MIDI.
  - [ ] Run the GMD extraction, commit `groove-profiles.generated.json`, and load its tables as per-position overrides in `groove-humanize.ts`.
- **PR C — Deep kits**: SFZ ingestion + `power`/`velcurve`/`formats` catalog fields, Opus+MP3 dual-encode + runtime probe, FLAC supporter tier, Naked Drums flagship, Virtuosity/MuldjordKit default upgrades.
- **PR D — Electronic flavor**: circuit-modeled voices per verified recipes; parameter-level humanize; no Roland marks.
- **PR E — Pattern library**: GMD-seeded + hand-authored JSON patterns feeding the PR B style tables.
