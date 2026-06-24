# Phase 1: Spectrogram Polish

**Plan Date:** 2026-06-10  
**Parent:** [VA Enhancement Plans](README.md)  
**Effort:** 2-3 days  
**Dependencies:** None (independent)

---

## Goal

Bring MercuryPitch's spectrogram display closer to Sonic Visualiser's professional spectrogram features. Add a piano-keyboard frequency scale, multiple colour maps, peak bins display, and expose STFT window parameters.

---

## 1. Piano Keyboard Frequency Scale

### What
Replace the linear frequency Y-axis on the spectrogram with a logarithmic, piano-keyboard-styled scale. Each octave is visually distinct, with C notes shaded in grey — exactly like Sonic Visualiser.

### Why
Linear frequency scales are hard to read for musicians. A piano keyboard overlay maps directly to musical understanding (C4, E4, G4...). This is SV's signature spectrogram feature.

### Implementation

**File: `src/components/SpectrogramCanvas.tsx`** (modify)

1. Add a left-side piano keyboard column (~40px wide) to the canvas.
2. Each piano key is a horizontal band. White keys get light borders, black keys get dark fill with a small indent.
3. C notes get a subtle grey background across the full spectrogram width (like SV's grey C shading).
4. Key labels appear on the left edge: "C4", "C5", "C6".
5. The piano column scrolls with the spectrogram (frequency zoom).
6. Frequency range defaults to show ~3-4 octaves centered on the vocal range (configurable).

**Props to add:**
```ts
interface SpectrogramCanvasProps {
  // ... existing
  freqMin?: number    // default 65Hz (C2)
  freqMax?: number    // default 2093Hz (C7)
  showPianoKeys?: boolean  // default true
}
```

**Key rendering logic:**
```
For each MIDI note 36 (C2) through 96 (C7):
  Map MIDI to Y position (log scale or MIDI-linear)
  Draw key band with appropriate style
  If note is C, draw subtle grey background line
```

**Effort:** 1 day

---

## 2. Colour Map Selector

### What
Replace the single hardcoded Viridis-like colormap with a selectable set of 4-5 colour maps, matching Sonic Visualiser's options.

### Why
Different colour maps reveal different aspects of the spectrum. A "Highlight" mode with abrupt colour transitions helps isolate intensity bands.

### Implementation

**File: `src/components/SpectrogramCanvas.tsx`** (modify)

1. Extract the `magnitudeToColor` function into a colour map module: `src/lib/colour-maps.ts`.
2. Define 5 colour maps:
   - **Viridis** (current, blue→cyan→green→yellow→red) — good general purpose
   - **Thermal** (black→red→yellow→white) — classic heatmap
   - **Ice** (dark blue→light blue→white) — cold, good for low-intensity detail
   - **Banded** (same as Viridis but quantized to 8 discrete levels) — highlights iso-intensity contours
   - **Highlight** (dark→bright transition at a threshold) — isolate specific intensity levels
3. Each colour map is a function `(norm: number) => [r, g, b]`.
4. Add a `colourMap` prop and a dropdown selector in the spectrogram header.
5. Store preference in localStorage.

**Props to add:**
```ts
colourMap?: 'viridis' | 'thermal' | 'ice' | 'banded' | 'highlight'
```

**File: `src/lib/colour-maps.ts`** (new)

**Effort:** 0.5 day

---

## 3. Peak Bins Display

### What
Toggle to show only spectral peaks — bins whose magnitude exceeds both frequency neighbours. SV calls this "Peak Bins" mode.

### Why
Cleaner visual — shows only the "important" frequencies (harmonics and formants) without the noise floor. Particularly useful for vocal analysis where you want to see harmonic structure.

### Implementation

**File: `src/components/SpectrogramCanvas.tsx`** (modify)

1. Add a `peakBinsOnly` prop (boolean, default false).
2. In the `createEffect` rendering loop, when `peakBinsOnly` is true:
   - For each frequency bin, check if `mag[bin] > mag[bin-1] && mag[bin] > mag[bin+1]`
   - If not a peak, paint background colour instead of the colour-mapped value.
3. Add a toggle button next to the colour map selector.

**Props to add:**
```ts
peakBinsOnly?: boolean
```

**Effort:** 0.5 day

---

## 4. Phase-Based Colour Scale

### What
Option to colour the spectrogram by phase angle instead of power magnitude. SV has a "Phase" colour scale option.

### Why
Phase information reveals transient details, vocal fry, and consonantal attacks that are invisible in magnitude-only spectrograms. Useful for the "Consonant Attack Scoring" feature (Phase 3.2 of vocal analysis roadmap).

### Implementation

**File: `src/components/SpectrogramCanvas.tsx`** (modify)  
**File: `src/workers/spectral.worker.ts`** (modify)

1. Modify the spectral worker to also output `phaseSpectrum: Float32Array` (phase angle per bin from STFT).
2. Add a `phaseSpectrum` prop to SpectrogramCanvas.
3. When colour scale is "Phase", map phase angle [-π, π] to a cyclic colour wheel (hue-based).
4. Add "Phase" option to the colour map dropdown.

**New colour scale:**
```
Phase → cyclic HSV hue (0°=red, 120°=green, 240°=blue, 360°→0°)
```

**Effort:** 0.5 day

---

## 5. Window Shape & Size Parameters

### What
Expose the STFT window function (Hann, Hamming, Blackman, etc.) and window size as user-configurable parameters.

### Why
Different window shapes trade off between frequency resolution and spectral leakage. SV exposes 9 window types. For vocal analysis, Hann and Blackman-Harris are most useful.

### Implementation

**File: `src/lib/stft-engine.ts`** (modify)  
**File: `src/workers/spectral.worker.ts`** (modify)  
**File: `src/components/SpectrogramCanvas.tsx`** (modify)

1. In `stft-engine.ts`, accept a `windowType` parameter:
   ```ts
   stftForward(audio: Float32Array, nFft: number, hopSize: number, windowType?: 'hann' | 'hamming' | 'blackman' | 'blackman-harris')
   ```
   Default: `'hann'` (matches SV default).
2. Pass through from spectral worker (add to message type).
3. Add a small settings gear on the spectrogram panel exposing:
   - Window type dropdown (4 options)
   - FFT size: 1024 | 2048 | 4096 | 8192
   - Window overlap: 50% | 75% | 87.5%
4. Store preferences in localStorage.

**Effort:** 1 day

---

## Files Changed

| File | Operation | Description |
|---|---|---|
| `src/components/SpectrogramCanvas.tsx` | Modify | Piano keys, colour maps, peak bins, settings UI |
| `src/lib/colour-maps.ts` | **New** | Colour map functions |
| `src/workers/spectral.worker.ts` | Modify | Phase spectrum output, window params |
| `src/lib/stft-engine.ts` | Modify | Window type parameter |
| `src/components/VocalAnalysis.tsx` | Modify | Wire new spectrogram props |

---

## Deliverables

- [ ] Piano keyboard overlay on spectrogram Y-axis with C-note shading
- [ ] 5 selectable colour maps (Viridis, Thermal, Ice, Banded, Highlight)
- [ ] Peak bins toggle
- [ ] Phase colour scale option
- [ ] Window type/size/overlap controls (gear menu)
- [ ] All preferences persisted to localStorage
- [ ] Tests for colour-map.ts functions (5 maps × edge cases)

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Piano keyboard rendering performance | Draw keys to offscreen buffer once, blit on each frame (no per-frame key drawing) |
| Phase spectrum doubles worker message size | Only send phase when phase colour scale is active |
| Too many settings overwhelms users | Hide advanced settings behind a gear icon; sensible defaults for all |
