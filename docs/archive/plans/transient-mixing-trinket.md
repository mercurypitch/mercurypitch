# Pitch Test — Dynamic Sensitivity, Frequency Slider, Test Listing

## Context

The Pitch Test tab currently has no way to adjust detector sensitivity in real-time while detection is running. The sine generator frequency is only controllable via a number input (no slider for sweeping). The "Run Test" benchmark mode shows only pass/fail counts and a raw error index list — users can't tell which notes were tested or why something failed.

---

## Feature 1: Dynamic Sensitivity Slider

### What
A sensitivity range slider (1–10) in the Pitch Test control panel that adjusts the current detector's sensitivity/confidence threshold in real-time while detection is active.

### Implementation

**Add `setSensitivity` / `setMinConfidence` to detector classes:**

`YINDetector`, `FFTDetector`, `AutocorrelatorDetector` each wrap an internal `PitchDetector` which already has `setSensitivity(value)` and `setMinConfidence(value)` methods. But these wrapper classes don't expose them. Need to:

- Add `setSensitivity(value: number)` to `IPitchDetector` interface in `pitch-detector-base.ts`
- Add `setMinConfidence(value: number)` to `IPitchDetector` interface
- Implement both methods in `YINDetector`, `FFTDetector`, `AutocorrelatorDetector` by delegating to the internal `PitchDetector`

**UI in PitchTestingTab:**
- Add a slider + label below the algorithm selector, hidden when algorithm has no sensitivity concept (all three support it currently)
- Range: 1–10, step 1
- Default: 7 (current default)
- Label: "Sensitivity" with current value display
- On change: call `detector.setSensitivity(val)` on the matching detector immediately
- Also add a minConfidence slider (0.3–0.9, step 0.1) — this gates whether low-clarity detections are accepted
- Both disabled during "Run Test" mode (which creates its own temporary waveforms)

**Files modified:**
| File | Change |
|------|--------|
| `src/lib/pitch-algorithms/pitch-detector-base.ts` | Add `setSensitivity` and `setMinConfidence` to `IPitchDetector` |
| `src/lib/pitch-algorithms/yin-detector.ts` | Implement `setSensitivity`/`setMinConfidence` delegating to `PitchDetector` |
| `src/lib/pitch-algorithms/fft-detector.ts` | Same |
| `src/lib/pitch-algorithms/autocorrelator-detector.ts` | Same |
| `src/components/PitchTestingTab.tsx` | Add sensitivity + minConfidence sliders in control panel |
| `src/styles/app.css` | Slider group styles for inline control panel use |

---

## Feature 2: Frequency Slider for Sine Generator

### What
A range slider alongside the existing frequency number input that lets users sweep through frequencies in real-time while detection is running.

### Implementation

- Add `<input type="range">` below the existing frequency number input
- Range: 65–2100 Hz (matches detector min/max range)
- Log-scale mapping for natural feel (since pitch perception is logarithmic)
  - Map slider position 0–100 linearly, convert to log frequency
  - `freq = 65 * 2^(pct * log2(2100/65))` where `pct = sliderVal / 100`
- Step: fine enough for smooth sweeping (1000 internal steps mapped to log scale)
- The existing `createEffect` already regenerates the waveform when `frequency()` changes — no additional wiring needed
- Show current value label

**Files modified:**
| File | Change |
|------|--------|
| `src/components/PitchTestingTab.tsx` | Add range slider + log-scale mapping for frequency |
| `src/styles/app.css` | Frequency slider styles |

---

## Feature 3: Test Result Listing

### What
Replace the sparse "Failed at test indexes" error list with a comprehensive table showing every tested note, its target frequency, and pass/fail status — visible after a test run completes.

### Current state
- `runTest()` tests 22 notes (C2–A6 chromatic, incorrectly labeled in `computeErrorItems` as C3–A#4)
- Results show: total/passed/failed counts + success rate
- Errors shown as: "Failed at test indexes:" with note name/freq chips (only first 20)
- No way to see all tested notes or understand what was tested

### Implementation

**Replace the results panel** with:

1. **Summary bar** (always visible): total/passed/failed + success rate — keep as is
2. **Note-by-note results grid** (shown when test is complete):
   - Grid header: Note | Target Hz | Result
   - Each row shows:
     - Note name (e.g., "C3")
     - Target frequency (e.g., "130.81 Hz")
     - Status badge: green "Pass" with checkmark or red "Fail" with detected frequency
   - Scrollable if > 10 rows
3. **Test description** at top: "22 chromatic notes from C2 (65.41 Hz) to A6 (1046.5 Hz), tested with [algorithm name]. Pass = detected within ±5 Hz of target."

Also fix the note naming in `computeErrorItems` — it's off by an octave (C2 is labeled C3, etc.).

**Files modified:**
| File | Change |
|------|--------|
| `src/components/PitchTestingTab.tsx` | Replace error-only list with full test table; fix note name mapping, add test description |
| `src/styles/app.css` | Test table styles (grid rows, status badges, scroll container) |

---

## Verification

1. `npm run build` — no TypeScript errors
2. `npm run test:run` — all 508 tests pass
3. Open Pitch Test tab:
   - Select YIN → sensitivity slider appears → drag while mic detection running → observe real-time changes in detection behavior
   - Select FFT / Autocorrelation → sliders still work
   - Select "Generate Sine" mode → frequency slider appears → drag while detection running → sine frequency changes in real-time → canvas shows pitch tracking the sweep
   - Click "Run Test" → wait for completion → see full table of all 22 notes with pass/fail per note → failed rows show detected frequency
