# Signal Quality Advisor — feature plan

Owner request (2026-08-17): "when there is a noise, from the home or similar, our
pitch detector throws these blips... this can be controlled with our 'quiet',
'home' and 'noisy' environment mic calibration... have some sort of exercise
intelligence or in general an intelligence layer, that recognizes this, and can
recommend at least to user to switch to a quieter environment, or simply change
that setting manually to noisy and try again... integrate it across all of our
detectors ideally. And show a notification when we notice it."

Everything below is grounded in a full code map (file:line refs verified
2026-08-17, main at 512fff19).

## 1. What the environment setting actually does today

`SensitivityPreset = 'quiet' | 'home' | 'noisy'` (`src/stores/settings-store.ts:37`),
mutated only by `applySensitivityPreset` (`:251`). It sets four numbers
(`:89-110`); three reach the detector via `EngineContext.tsx:99-117` →
`practiceEngine.syncSettings()` → `PitchDetector` setters
(`src/lib/pitch-detector.ts:648-660`):

| preset | detectionThreshold\* | sensitivity | minConfidence | minAmplitude (→ RMS gate) |
| ------ | -------------------- | ----------- | ------------- | ------------------------- |
| quiet  | 0.05                 | 7           | 0.3           | 1 (→ 0.005)               |
| home   | 0.10                 | 5           | 0.5           | 2 (→ 0.010)               |
| noisy  | 0.20                 | 9           | 0.7           | 4 (→ 0.020)               |

\*`detectionThreshold` is dead — no consumer outside the store and settings UI.

`noisy` "mostly fixes" blips because it raises the RMS gate 4× and the clarity
floor 0.3 → 0.7 — exactly the two per-frame gates
(`pitch-detector.ts:159-167`, `:184-198`) that ambient noise slips past under
`quiet`. The advisor's job is to notice when the gates are being slipped and
say so.

## 2. Prerequisite bug fix (own tiny PR, before the feature)

`PracticeEngine.startMic()` reconstructs the `PitchDetector` when the real
AudioContext sample rate / buffer size differs from the assumed one
(`src/lib/practice-engine.ts:222-234`) passing **only `sensitivity`** —
`minConfidence` and `minAmplitude` silently revert to defaults (0.3 / 0.02,
`pitch-detector.ts:59-69`) and are never re-applied, because the EngineContext
effect only fires on settings _changes_. On such devices the user's `noisy`
choice is partly discarded on every mic start — the advisor would then detect
noise and recommend a setting that appears not to work.

Fix: pass the full current option set on reconstruction (or call the three
setters right after). Branch `fix/mic-preset-resync`. Test: construct with
noisy-preset values, force the reconstruction path, assert the new detector's
options survived. Mutation flip: revert → test red.

## 3. Detection design

### 3.1 Observation seam (the `mic-level` template)

New file `src/lib/signal-quality.ts`, framework-free, modeled on
`src/lib/mic-level.ts` (publish/read, no reactivity, `STALE_MS`):

```ts
export interface DetectionFrameStats {
  rms: number // computed in detect() and currently thrown away
  clarity: number // raw algorithm confidence BEFORE the gate
  accepted: boolean // did the frame survive rms + confidence gates
  frequency: number // 0 when rejected
  atMs: number
}
export function publishDetectionFrame(s: DetectionFrameStats): void
export function readSignalQuality(): SignalQualityVerdict // rolling classifier output
```

Publisher: one call inside `PitchDetector.detect()`
(`src/lib/pitch-detector.ts:151-208`) — the single choke point every live
surface funnels through — **gated by a new constructor option
`telemetry: 'live' | 'off'` defaulting to `'off'`**, so the ~10 offline/lab
construction sites (`pitch-algorithm-tester.ts`, `stem-fingerprinter.ts`,
`midi-generator.ts`, benchmark/transcription loops…) publish nothing and pay
one boolean check per frame. Only inside `detect()` are `rms`, pre-gate
clarity, and the rejection reason all visible; downstream a rejected frame is
an all-zero `DetectedPitch`, indistinguishable from silence.

### 3.2 Classifier (pure function, the whole test surface)

Rolling 10 s window, O(1) per frame (ring counters, no arrays of frames).
Signals:

- **blip rate** — accepted-pitch runs of ≤ 3 consecutive frames bounded by
  rejected/silent frames. Real singing produces runs of dozens of frames
  (the stability filter at `pitch-detector.ts:594-635` needs 5 to even
  confirm a note); ambient noise produces stutter.
- **ambient floor** — median RMS of _rejected_ frames (energy without
  periodicity). Compare against the active preset's RMS gate, not an
  absolute: `floor > GATE_HEADROOM (1.5) × currentMinAmplitudeRms` means the
  room is crowding the gate. Precedent for "room nearly as loud as source":
  guitar's `noisy` rule (`src/lib/guitar/input-events.ts:206`).
- **clarity crowding** — median accepted clarity within 0.1 of the active
  `minConfidence` floor: detections are barely clearing the bar.

Verdict `noisy-environment` fires when, over the window with the mic live:
`blipRuns ≥ 6` AND ambient floor over headroom AND (clarity crowding OR
preset is `quiet`). Hysteresis: 3 s of clean frames resets the counters;
first 2 s after mic start ignored (auto-gain settle). All thresholds are
named exported constants so tests and later tuning touch one block.

The classifier must **not** fire on: silence (floor ≈ 0), sustained correct
singing (long runs), speech between exercises (runs of 5–20 frames but floor
below headroom). Each of these is a synthetic-stream unit test.

### 3.3 Advisor owner (one instance, no per-surface duplicates)

A single app-level `createSignalQualityAdvisor()` started where the practice
engine lives (`EngineContext.tsx`), polling `readSignalQuality()` at ~2 Hz
only while the mic is active (reuse `mic-manager` subscription,
`src/lib/mic-manager.ts:149`). Structure mirrors
`src/features/mic-feedback/useMicInsights.ts` (debounce, hysteresis, copy
table) but it is a sibling, not a fifth insight — insights are per-surface
banners; this is a global one-shot toast.

## 4. Notification + deep link

Pattern: `usePlaybackMicNudge` (`src/features/mic-feedback/usePlaybackMicNudge.ts:34-57`)
— persisted stamp, `showActionNotification`, `removeNotification(id)` inside
the action before acting.

```ts
showActionNotification(
  preset() === 'noisy'
    ? 'Background noise is still triggering false notes. A quieter spot will score truer.'
    : 'Background noise is triggering false notes. Try the Noisy room setting, or move somewhere quieter.',
  'warning',
  {
    label: 'Open mic settings',
    onClick: () => openSettingsSection('practice', 'sensitivity-presets'),
  },
  { channel: 'signal-quality', title: 'Microphone', durationMs: 15_000 },
)
```

- `openSettingsSection` + anchor flash already exist (`ui-store.ts:93-99`,
  `SettingsPanel.tsx:234-255`); the preset select (`SettingsPanel.tsx:478-503`)
  needs the missing `data-settings-anchor="sensitivity-presets"` — one line.
- Anchored-jump precedent: `whats-new-content.tsx:93`; toast→settings
  precedent: `UvrPanel.tsx:949-970`.
- Alternative action considered: run auto-calibrate directly
  (`auto-calibrate.ts:13-40` — samples 1 s ambient, would correctly land on
  `noisy` at that moment). Deferred: calibrating while the user may resume
  singing mid-sample gives a wrong preset; the settings jump keeps the human
  in the loop, and the panel has the live meter + Auto-calibrate button
  anyway.
- Caps: at most once per 10 min (localStorage stamp
  `pitchperfect_signal_advisor_last`), at most twice per session (module
  counter). Channel replacement dedupes any overlap. No emoji, no new icon
  needed (toast renderer is text + action).

## 5. Integration map — "across all of our detectors"

**Phase 1 (this PR):** `telemetry: 'live'` on the shared engine's detector —
covers Singing, all 18 exercises, warm-up, zen, challenges, recording:
everything routed through `PracticeEngine.update()`
(`practice-engine.ts:341`), which is where the owner sees the blips.

**Phase 2 (follow-up, one line per surface once the seam exists):** own-instance
surfaces opt in with `telemetry: 'live'`:

| Surface                             | construction site                                                      |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Karaoke live mic                    | `useStemMixerMicController.ts:357`                                     |
| Jam                                 | `jam-pitch-detector.ts:23`                                             |
| Guitar tuner                        | `GuitarTuner.tsx:227`                                                  |
| Guitar practice / sing-to-fretboard | `useGuitarPracticeController.ts:258,401`, `SingToFretboardState.ts:39` |
| Mirror / Glass / voice-session      | `pitch-f0-stream.ts:72`                                                |
| Mercury Sing / Shazam               | `live-pitch-buffer.ts:52,88`                                           |
| Live analysis capture               | `use-live-capture.ts:109`                                              |

Phase 2 finding worth its own decision: **Jam and the tuner ignore the
environment preset entirely** (hardcoded `minConfidence: 0.3,
minAmplitude: 0.02`) — the advisor's recommendation would do nothing there.
Routing the preset into them is a behavior change to flag to the owner, not
sneak in.

Guitar Night is excluded — it has its own worklet health system with a
`noisy` verdict already (`input-events.ts:171-217`).

## 6. Tests / verification

- Classifier unit tests (pure, synthetic streams): noisy-room stream fires;
  clean sustained singing never fires; silence never fires; speech-shaped
  stream never fires; already-`noisy` preset selects the alternate copy;
  reset-on-clean hysteresis; mic-start grace.
- Seam tests: `telemetry: 'off'` publishes nothing (offline loops stay
  silent); `detect()` publishes rms/clarity/accepted faithfully for an
  accepted and a gate-rejected frame.
- Advisor tests: fires toast once, respects 10-min stamp and session cap,
  action calls `openSettingsSection('practice', 'sensitivity-presets')`,
  nothing when mic inactive.
- Anchor test: SettingsPanel renders `data-settings-anchor="sensitivity-presets"`.
- Mutation flips: remove the gate-headroom condition → speech test red;
  remove cooldown → cap test red.
- 100% changed-line coverage, `pnpm check`, full suite — per standing policy.
- Runtime probe: dev server + Playwright, feed a looped noise WAV as fake
  mic (`--use-file-for-fake-audio-capture`), assert the toast appears and
  the deep link lands on the flashed preset select.

## 7. Guardrails / non-goals

- Must not contradict the recorded quiet-as-default rationale
  (`settings-store.ts:139-152`, `dev-changelog.md:626`, locked by
  `app-store.test.ts:35-56`) — the advisor recommends, never auto-switches.
- No per-frame allocation on the hot path; counters only.
- No new BUGS.md entry needed (no prior report; checked).
- Plan doc ships as `docs/plans/signal-quality-advisor.md` in the feature PR.

## 8. Delivery order

1. `fix/mic-preset-resync` — the startMic option-drop bug (§2).
2. `feat/signal-quality-advisor` — seam + classifier + advisor + toast +
   anchor + Phase 1 wiring (§3–4), plan doc included.
3. Phase 2 wiring + the jam/tuner preset-routing decision — after owner
   retests Phase 1 ("We will see if it will go in release, depending on how
   good it will work").
