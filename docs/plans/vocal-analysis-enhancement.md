# Vocal Analysis Enhancement Plan

**Date:** 2026-06-05  
**Reference:** Klevgrand Altitude ($29.99 VST plugin)  
**Goal:** Match Altitude's core vocal analysis features in MercuryPitch's web app

---

## 1. What Klevgrand Altitude Does

Altitude is a real-time vocal analysis plugin that provides singers and producers with visual feedback on vocal performance. Key features:

| Feature | Description |
|---------|-------------|
| **Pitch Curve** | Real-time scrolling pitch line with zoom, showing exact frequency movement over time |
| **Cents Deviation** | Scrolling graph showing ±50¢ deviation from target note (green/yellow/red) |
| **Vibrato Analysis** | Quantified depth (cents) and rate (Hz), visualized as modulation waveform |
| **Spectrogram** | Color-coded time-frequency heatmap showing harmonics, formants, breath |
| **Tonal Stability** | Shows how steadily a note is held (pitch variance over time) |
| **Phase Correlation** | Stereo monitoring for phase issues |
| **Singer's Resonance** | Visual feedback on resonance zones (chest/mask/head) |

**Algorithm:** YIN fundamental frequency estimation (autocorrelation-based) with parabolic interpolation for sub-sample accuracy. Same family as our existing YIN implementation.

---

## 2. MercuryPitch's Existing Capabilities

### What We Have (Already Implemented)

| Feature | Status | Location |
|---------|--------|----------|
| YIN / MPM / SwiftF0 pitch detection | **Complete** | `src/lib/pitch-detector.ts` |
| FFT-based vibrato analysis (rate, depth, quality) | **Complete** | `src/lib/vocal-analyzer.ts:detectVibrato()` |
| FFT-based HNR (harmonic-to-noise ratio) | **Complete but unconnected** | `src/lib/vocal-analyzer.ts:computeHNR()` |
| FFT-based harmonic richness | **Complete but unconnected** | `src/lib/vocal-analyzer.ts:computeHarmonicRichness()` |
| FFT-based resonance zone detection | **Complete but unconnected** | `src/lib/vocal-analyzer.ts:detectResonance()` |
| Intensity / dynamic range (dB envelope) | **Complete** | `src/lib/vocal-analyzer.ts:computeRMSEnvelope()` |
| Slide detection and classification | **Complete** | `src/lib/vocal-analyzer.ts:detectSlides()` |
| Pitch history SVG chart (MIDI line) | **Complete** | `src/components/VocalAnalysis.tsx` |
| Static spectrum bar chart | **Basic** | `src/components/VocalAnalysis.tsx` |
| Vocal fatigue tracking | **Complete** | `src/lib/vocal-analyzer.ts:analyzeFatigue()` |
| STFT engine (Bluestein Chirp-Z) | **Complete but unused** | `src/lib/stft-engine.ts` |
| 3 pitch detection algorithms | **Complete** | `src/lib/pitch-algorithms/` |

### What We're Missing (vs Altitude)

| Missing Feature | Priority | Complexity |
|----------------|----------|------------|
| **Spectrogram display** (time-frequency heatmap) | High | Medium — STFT engine exists, need renderer |
| **Cents deviation curve** (scrolling ±¢ vs target) | High | Low — already have pitch history, just render cents |
| **Pitch stability metric** (real-time pitch variance) | High | Low — compute from pitch history buffer |
| **Connect STFT → vocal-analyzer** | High | Medium — wire stftForward to computeHNR/Richness/Resonance |
| **Vibrato waveform visualization** | Medium | Low — already have vibrato detection, render modulation |
| **Resonance zone visualization** (chest/mask/head) | Medium | Low — use detectResonance(), just need UI |
| **Note-level accuracy breakdown** | Medium | Medium — segment by notes, compute cents per note |
| **Formant visualization** (F1/F2) | Low | High — needs formant extraction from spectrum |
| **Singer's resonance peak detection** (2-4 kHz) | Low | Medium — search for peak in formant range |

---

## 3. The Key Problem: Unconnected DSP

The biggest finding: `vocal-analyzer.ts` contains **three FFT-based functions** that are fully implemented but never called:

1. **`computeHNR(magnitudeSpectrum, sampleRate, fundamentalFreq, fftSize)`** — Real harmonic-to-noise ratio calculation (not the approximation in `approximateBreathiness`)
2. **`computeHarmonicRichness(magnitudeSpectrum, sampleRate, fundamentalFreq, fftSize)`** — Extracts H1-H15 harmonics, computes weighted richness score
3. **`detectResonance(magnitudeSpectrum, sampleRate, fftSize)`** — Chest/mask/head energy ratios (200-800, 800-2500, 2500+ Hz)

These are called nowhere. The UI uses the "approximate" fallbacks which use pitch clarity and frequency heuristics instead of actual spectral data.

**The fix:** Wire `stft-engine.ts` → `vocal-analyzer.ts` FFT functions → UI components.

---

## 4. Implementation Plan

### Phase 1: Wire the DSP Pipeline (1-2 days)

**Goal:** Connect the existing but unused FFT-based functions to the live audio stream.

| Step | What | Files |
|------|------|-------|
| 1.1 | Create `src/lib/spectral-pipeline.ts` — a bridge that takes raw audio buffers, runs STFT, and feeds the resulting magnitude spectra into the FFT-based vocal analyzer functions | `src/lib/spectral-pipeline.ts` (new) |
| 1.2 | Add `computePitchStability(pitchHistory, windowMs)` to `src/lib/vocal-analyzer.ts` — real-time pitch variance over a sliding window | `src/lib/vocal-analyzer.ts` |
| 1.3 | Add `computeCentsDeviation(pitchResult, nearestNote)` to return the signed cents offset from the nearest note | `src/lib/frequency-to-note.ts` |
| 1.4 | Update `live-pitch-analysis.ts` to optionally accept STFT magnitude data and use the FFT-based functions when available, falling back to approximate | `src/lib/live-pitch-analysis.ts` |
| 1.5 | Add tests for the new pipeline functions | `src/tests/spectral-pipeline.test.ts` (new) |

### Phase 2: Spectrogram Display (2-3 days)

**Goal:** Add a real-time scrolling spectrogram (time-frequency heatmap) to the Vocal Analysis tab.

| Step | What | Files |
|------|------|-------|
| 2.1 | Create `src/components/SpectrogramCanvas.tsx` — a Canvas2D component that renders a scrolling spectrogram from STFT magnitude data (like Altitude's spectrogram view) | `src/components/SpectrogramCanvas.tsx` (new) |
| 2.2 | Color mapping: use a perceptual colormap (e.g., Viridis-style: dark blue → cyan → green → yellow → red) based on dB magnitude | Inside SpectrogramCanvas |
| 2.3 | Add zoom controls (frequency range, time resolution) | Inside SpectrogramCanvas |
| 2.4 | Integrate SpectrogramCanvas into `VocalAnalysis.tsx` as a toggleable panel alongside the existing spectrum bars | `src/components/VocalAnalysis.tsx` |
| 2.5 | Use the real `stftForward()` from `stft-engine.ts` instead of the downsampled frequency data | `src/components/VocalAnalysis.tsx` |

### Phase 3: Cents Deviation Curve (1-2 days)

**Goal:** Add a scrolling cents deviation graph — the most distinctive Altitude feature.

| Step | What | Files |
|------|------|-------|
| 3.1 | Create `src/components/CentsDeviationCanvas.tsx` — scrolling graph showing signed cents from target note over time, with color coding (green ±15¢, yellow ±30¢, red >30¢) | `src/components/CentsDeviationCanvas.tsx` (new) |
| 3.2 | Add horizontal reference lines at ±25¢, ±50¢, and a center line at 0¢ (in-tune) | Inside the canvas |
| 3.3 | Show the target note name on the Y-axis | Inside the canvas |
| 3.4 | Add to VocalAnalysis as a new panel | `src/components/VocalAnalysis.tsx` |

### Phase 4: Vibrato Visualization (1 day)

**Goal:** Show the vibrato modulation waveform and stats.

| Step | What | Files |
|------|------|-------|
| 4.1 | Create `src/components/VibratoWaveformCanvas.tsx` — renders the detected vibrato modulation as a sine-like waveform overlay on the pitch curve | `src/components/VibratoWaveformCanvas.tsx` (new) |
| 4.2 | Show vibrato rate (Hz) and depth (cents) as numeric labels | Inside the canvas |
| 4.3 | Color-code: natural (4-7 Hz) = green, slow/opera (< 4 Hz) = blue, fast/tense (> 7 Hz) = orange | Inside the canvas |

### Phase 5: Enhanced Vocal Metrics UI (1-2 days)

**Goal:** Show the FFT-based metrics that are already computed but not displayed.

| Step | What | Files |
|------|------|-------|
| 5.1 | Replace the "Breathiness" card with real HNR from `computeHNR()` when STFT is available | `src/components/VocalAnalysis.tsx` |
| 5.2 | Replace "Richness" card with real `computeHarmonicRichness()` | `src/components/VocalAnalysis.tsx` |
| 5.3 | Replace "Resonance" card with real `detectResonance()` chest/mask/head ratios, shown as a 3-bar horizontal chart | `src/components/VocalAnalysis.tsx` |
| 5.4 | Add "Pitch Stability" card showing real-time pitch variance (lower = more stable) | `src/components/VocalAnalysis.tsx` |
| 5.5 | Add overall "Tonal Quality" score combining HNR + richness + stability | `src/components/VocalAnalysis.tsx` |

### Phase 6: Auto Vocal Range Detection (1 day)

**Goal:** Automatically detect the user's vocal range from their singing history.

| Step | What | Files |
|------|------|-------|
| 6.1 | Add `detectVocalRange(pitchHistory)` function that finds the 1st/99th percentile of sustained pitches (filtering out slides) | `src/lib/vocal-analyzer.ts` |
| 6.2 | Update `VocalRangeSelector.tsx` to show "Auto-detected" option | `src/components/VocalRangeSelector.tsx` |

---

## 5. Technical Architecture

### Data Flow (After Implementation)

```
Microphone
  ↓
AudioContext.getByteTimeDomainData()
  ↓
PitchDetector.detect()          ─→ Pitch (Hz, cents, clarity, note)
  ↓
stftForward(audio)              ─→ Magnitude Spectrum (Float32Array)
  ↓
├── computeHNR(spectrum)        ─→ HNR score (dB)
├── computeHarmonicRichness(spectrum) ─→ Richness (0-100)
├── detectResonance(spectrum)   ─→ Chest/Mask/Head ratios
└── computeRMSEnvelope(samples) ─→ Intensity (dB)
  
Pitch History Buffer
  ├── detectVibrato(history)    ─→ Rate (Hz), Depth (cents), Classification
  ├── detectSlides(history)     ─→ Slide events
  ├── computePitchStability(history) ─→ Variance metric
  └── Cents deviation series    ─→ CentsDeviationCanvas
  
All metrics → VocalAnalysis UI (cards + canvases)
```

### Spectrogram Rendering

The spectrogram uses a **Canvas2D scrolling buffer**:
- Each STFT frame produces a column of pixels (height = frequency bins)
- New columns are added to the left, older columns scroll right
- Pixel color = dB magnitude mapped through a perceptual colormap
- Canvas is updated at ~20-30 FPS for smooth scrolling
- Uses `requestAnimationFrame` with RAF throttling

### Key Performance Considerations

- **STFT is expensive** — use hopSize of 512 or 1024 (not 256) for real-time
- **Spectrogram canvas** — use `ImageData` direct pixel manipulation (no DOM elements)
- **Pitch buffer** — cap at 10 seconds of history (300 samples at 30Hz)
- **FFT-based metrics** — compute every 100ms, not every frame

---

## 6. Estimated Scope

| Phase | Days | Value |
|-------|------|-------|
| Phase 1: DSP Pipeline | 1-2 | **Critical** — enables all FFT-based features |
| Phase 2: Spectrogram | 2-3 | **High** — most visually impressive Altitude feature |
| Phase 3: Cents Deviation | 1-2 | **High** — the most practically useful for singers |
| Phase 4: Vibrato Waveform | 1 | **Medium** — makes vibrato analysis visual |
| Phase 5: Enhanced Metrics | 1-2 | **High** — unlocks 3 existing but hidden analysis functions |
| Phase 6: Auto Vocal Range | 1 | **Low** — convenience feature |
| **Total** | **7-11 days** | |

---

## 7. What We Already Have That Altitude Doesn't

MercuryPitch has some unique advantages over Altitude:

| Feature | Altitude | MercuryPitch |
|---------|----------|--------------|
| **3 pitch algorithms** (YIN/MPM/SwiftF0) | Only YIN | ✅ |
| **Vocal fatigue tracking** | None | ✅ Linear regression trend |
| **Exercise system** | None | ✅ 16 exercises with scoring |
| **Challenges/badges** | None | ✅ Gamification |
| **Web-based** | DAW plugin only | ✅ Runs in browser |
| **Vocal run detection** | None | ✅ |
| **Free** | $29.99 | ✅ |

The goal isn't to clone Altitude, but to match its core analysis features (spectrogram, cents deviation, pitch stability) while keeping MercuryPitch's unique advantages.

---

## 8. Sources

- [Klevgrand Altitude](https://klevgrand.com/products/altitude) — Official product page
- [Klevgrand Altitude Manual](https://klevgrand.com/support/altitude-manual) — User guide
- [KVR Audio - Altitude](https://www.kvraudio.com/product/altitude-by-klevgrand) — Community reviews
- YIN Algorithm: de Cheveigné & Kawahara (2002) — "YIN, a fundamental frequency estimator for speech and music"
