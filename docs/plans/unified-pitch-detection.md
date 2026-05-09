# Unified Pitch Detection Refactor

## Context

Both MIDI generation and realtime vocal pitch display use the same `PitchDetector` class (YIN algorithm), but with different parameters, step sizes, and post-processing. This creates a visible discrepancy between what the pitch canvas shows and the MIDI melody that gets generated — the user observes "the pitch display is a bit different than what midi melody is showing."

**Root cause**: Two divergent configurations of the same detector:
- **MIDI** (`detectNotes`): bufferSize=1024, minConfidence=0.3, 100ms step, MIDI range 38-96, merges notes with 0.08s min-duration
- **Realtime** (`startRafLoop`): bufferSize=2048, minConfidence=0.4, ~16ms step, no range filter, per-frame pills

**Goal**: Harmonize the two paths so they produce consistent results. The realtime pitch display should show what the MIDI generator will produce — same parameters, same filtering, same note merging. Additionally, keep pitch display notes visible when the vocal stem is muted.

## Files

1. `src/lib/pitch-detector.ts` — PitchDetector class (YIN algorithm)
2. `src/lib/midi-generator.ts` — `detectNotes()`, `synthesizeMidiBuffer()`, constants
3. `src/lib/scale-data.ts` — `freqToMidi`, `midiToNote`, `freqToNote`
4. `src/components/StemMixer.tsx` — realtime pitch detection in RAF loop, `drawPitchCanvas`, pitch display

---

## Part 1: Harmonize PitchDetector Parameters

**Problem**: MIDI uses bufferSize=1024, realtime uses bufferSize=2048. The 1024 buffer gives coarser frequency resolution but matches the 1024 FFT analyser window better. Realtime's 2048 gives finer resolution but the extra precision creates discrepancies vs MIDI output.

### 1a. Define shared config constants in `midi-generator.ts`

Export a `PITCH_DETECT_CONFIG` object so both paths use identical parameters:

```ts
export const PITCH_DETECT_CONFIG = {
  bufferSize: 1024,
  minAmplitude: 0.02,
  minConfidence: 0.3,
  threshold: 0.15,
  sensitivity: 7,
  minFrequency: 65,
  maxFrequency: 2100,
} as const
```

### 1b. Update `detectNotes` to use shared config

Already uses bufferSize=1024, minAmplitude=0.02, minConfidence=0.3 — just replace inline values with `PITCH_DETECT_CONFIG` references.

### 1c. Update `StemMixer.tsx` PitchDetector instantiation

Line 391 — change from custom params to use `PITCH_DETECT_CONFIG`:
```ts
pitchDetector = new PitchDetector({
  sampleRate: audioCtx.sampleRate,
  ...PITCH_DETECT_CONFIG,
})
```

This also means PITCH_FFT_SIZE should align — change the analyser `fftSize` to 1024 to match (currently 2048). The `timeData` buffer used with `vocalAnalyser.getFloatTimeDomainData` must match the analyser's fftSize.

---

## Part 2: Extract Note-Merging Utility

**Problem**: Both `detectNotes` (lines 208-239) and `drawPitchCanvas` (lines 2230-2251) independently implement same-pitch merging into sustained notes/pills. These should share one function.

### 2a. Add `mergeConsecutiveNotes()` to `midi-generator.ts`

Extract the merging logic from `detectNotes` into an exported function:

```ts
export interface PitchDetection {
  midi: number
  noteName: string
  timeSec: number
}

export interface MergedNote {
  midi: number
  noteName: string
  startSec: number
  endSec: number
}

/** Merge consecutive same-pitch detections into sustained notes.
 *  Adjacent detections within `maxGapSec` of each other are merged.
 *  Resulting notes shorter than `minDurationSec` are dropped. */
export function mergeConsecutiveNotes(
  detections: PitchDetection[],
  maxGapSec: number = WINDOW_STEP_SEC + 0.02,
  minDurationSec: number = MIN_NOTE_DURATION_SEC,
): MergedNote[] { ... }
```

### 2b. Refactor `detectNotes` to use `mergeConsecutiveNotes`

Replace lines 208-239 (the manual merge loop) with a call to `mergeConsecutiveNotes`. The function currently builds `MidiNoteEvent[]` (with tickOn/tickOff). Change it to call `mergeConsecutiveNotes` then convert `MergedNote[]` to `MidiNoteEvent[]` by calling `secondsToTicks`.

### 2c. Refactor `drawPitchCanvas` to use `mergeConsecutiveNotes`

Currently `buildPillGroups` (lines 2230-2251) merges `pitchHistory` entries by note name. Instead:
1. Convert `pitchHistory` (PitchNote[]) to `PitchDetection[]`
2. Call `mergeConsecutiveNotes(detections, 0.02, 0.04)` — tighter params for realtime (16ms frames)
3. Draw pills from `MergedNote[]` with note labels from `midiToNote()`

This makes the pitch canvas show the same note structure as the MIDI output.

---

## Part 3: Apply MIDI Range Filter to Realtime Display

**Problem**: `detectNotes` filters to MIDI 38-96 (D2-C7), but the realtime path has no range filter. This means the pitch canvas can show notes outside the MIDI range that would never appear in generated MIDI.

### 3a. Add range filter to `PitchDetectorOptions` or as a config constant

Add `midiMin` and `midiMax` to `PITCH_DETECT_CONFIG`:
```ts
export const PITCH_DETECT_CONFIG = {
  ...
  midiMin: 38,  // D2
  midiMax: 96,  // C7
} as const
```

### 3b. Apply range filter in both paths

In `detectNotes` — already done (line 188), just use config constants.
In `startRafLoop` — add the same check before pushing to `pitchHistory`:
```ts
const midi = freqToMidi(pitch.frequency)
if (midi >= PITCH_DETECT_CONFIG.midiMin && midi <= PITCH_DETECT_CONFIG.midiMax) {
  pitchHistory.push({ ... })
}
```

---

## Part 4: Keep Pitch Display When Muted

**Problem**: When vocal stem is muted, `createSources` skips the vocal track entirely (line 1611: `if (!isAudible) continue`). If play is pressed while vocal is muted, no `vocalAnalyser` gets connected, and `pitchHistory` only contains data from the previous session. The pitch canvas should always show whatever `pitchHistory` data exists, regardless of mute state.

### 4a. Verify `drawPitchCanvas` doesn't check mute

Currently at line 2195 it checks `if (!vocal().buffer)` — this correctly only guards against "no vocal loaded at all." Mute state is not checked. No change needed here.

### 4b. Ensure `vocalAnalyser` still receives data when muted  

When `toggleMute` sets gain to 0 during playback, the analyser still receives silence (gain node outputs 0). The pitch detector returns frequency=0 for silence, so no new data enters `pitchHistory`. The existing pills remain. This is correct behavior — existing pills stay, no new ones appear.

**No code change needed for this part** — the existing behavior already preserves pitch display on mute. The pitch pills persist across mute/unmute cycles during the same playback session.

---

## Part 5: Clean Up

### 5a. Remove redundant clarity check in `detectNotes`

Line 186: `if (pitch.frequency > 0 && pitch.clarity > 0.3)` — the clarity check is redundant because `PitchDetector.detect()` already checks `minConfidence: 0.3`. Remove the clarity condition (keep `pitch.frequency > 0`).

### 5b. Remove unused `_formatDuration` in `UvrUploadControl.tsx`

Noticed during exploration — `_formatDuration` is defined but never used (line 40-44). Prefixed with `_` indicating it was intentionally unused. Remove to reduce noise.

---

## Summary of Changes

| File | Change |
|---|---|
| `src/lib/midi-generator.ts` | Add `PITCH_DETECT_CONFIG`, `PitchDetection`, `MergedNote`, `mergeConsecutiveNotes()`. Refactor `detectNotes` to use them. Remove redundant clarity check. |
| `src/components/StemMixer.tsx` | Use `PITCH_DETECT_CONFIG` for PitchDetector (line 391). Apply MIDI range filter in RAF loop. Convert `drawPitchCanvas` pill-building to use `mergeConsecutiveNotes`. Align `PITCH_FFT_SIZE` to 1024. |

## Verification

1. `npm run typecheck` — no errors
2. `npm run build` — builds cleanly
3. Upload a vocal track and enter StemMixer — pitch canvas displays notes
4. Generate MIDI — MIDI notes match the pattern shown on pitch canvas (same range, similar note durations)
5. Mute vocal stem during playback — existing pitch pills remain visible on canvas
6. Toggle between layouts (auto-1col, auto-2col, fixed-2col) — pitch canvas works in all
7. Download MIDI — file still generates correctly
