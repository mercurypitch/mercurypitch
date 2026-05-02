# Pitch Detection — Architecture & Algorithms

## Overview

PitchPerfect uses real-time monophonic pitch detection to track a user's singing voice and compare it against target melody notes. The system supports two algorithms (YIN and McLeod Pitch Method) selectable at runtime via the Settings panel.

## Pipeline

```
Microphone → AnalyserNode → Float32Array (time-domain)
                                  │
                           ┌──────▼──────┐
                           │ RMS Amplitude│ ── below threshold → silent (no pitch)
                           │    Check     │
                           └──────┬──────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Algorithm Dispatch       │
                    │   (YIN or MPM)             │
                    └─────────────┬─────────────┘
                                  │
                           ┌──────▼──────┐
                           │  Parabolic  │ ── sub-sample accuracy
                           │Interpolation│
                           └──────┬──────┘
                                  │
                           ┌──────▼──────┐
                           │  Stability  │ ── weighted median, outlier rejection
                           │   Filter    │
                           └──────┬──────┘
                                  │
                           ┌──────▼──────┐
                           │ Confidence  │ ── below minConfidence → reject
                           │    Gate     │
                           └──────┬──────┘
                                  │
                              DetectedPitch { frequency, clarity, noteName, octave, cents }
```

## Algorithms

### YIN (Default)

**Reference:** de Cheveigné & Kawahara, "YIN, a fundamental frequency estimator for speech and music" (2002).

**Steps:**
1. **Difference Function** — Compute squared difference between signal and shifted copy at each lag τ
2. **Cumulative Mean Normalization** — Normalize to reduce bias toward τ=0 and mitigate octave errors
3. **Absolute Threshold** — Find first τ where normalized difference < `adjustedThreshold()`
4. **Parabolic Interpolation** — Refine around the minimum for sub-sample accuracy
5. **Stability Filter** — Weighted median over last 5 frames, reject outliers >15% from median

**Confidence:** `1 - yinBuffer[tauEstimate]` (lower YIN value = higher confidence)

**Strengths:** Well-tested, good general-purpose accuracy, low octave error rate.

### McLeod Pitch Method (MPM)

**Reference:** McLeod & Wyvill, "A Smarter Way to Find Pitch" (2005).

**Steps:**
1. **NSDF Computation** — Normalized Square Difference Function: `NSDF(τ) = 2 * r(τ) / m(τ)` where `r(τ)` is autocorrelation and `m(τ)` is the normalization term. Produces values in [-1, 1].
2. **Key Maxima Detection** — Find the highest peak in each positive lobe of the NSDF using positive-going zero crossings. This is the core innovation that avoids octave errors.
3. **Peak Selection** — Pick the first peak above `globalMax * pickThreshold`. Selects the fundamental, not a harmonic.
4. **Parabolic Interpolation** — Refine around the *maximum* (unlike YIN which refines around a minimum).
5. **Stability Filter** — Same weighted median filter as YIN.

**Confidence:** NSDF peak value directly (0–1 range, naturally bounded).

**Strengths:** Better harmonic handling, fewer octave errors on complex timbres (vibrato, breathy voice).

## Configuration

### Settings Flow

```
Settings Panel → settings-store signals → EngineContext createEffect()
                                           → practiceEngine.syncSettings({
                                                 sensitivity,
                                                 minConfidence,
                                                 minAmplitude,
                                                 bands,
                                                 algorithm
                                             })
                                             → pitchDetector.setSensitivity()
                                             → pitchDetector.setMinConfidence()
                                             → pitchDetector.setMinAmplitude()
                                             → pitchDetector.setAlgorithm()
```

### Sensitivity Presets

| Preset   | detectionThreshold | sensitivity | minConfidence | minAmplitude | Use Case |
|----------|-------------------|-------------|---------------|-------------|----------|
| `quiet`  | 0.05              | 7           | 0.3           | 1           | Studio / quiet room — most forgiving |
| `home`   | 0.1               | 5           | 0.5           | 2           | Moderate background noise |
| `noisy`  | 0.2               | 9           | 0.7           | 4           | Outdoors / noisy — strictest filtering |

### Accuracy Tier → Sensitivity Mapping

| Tier         | Sensitivity Preset | Rationale |
|-------------|-------------------|-----------|
| Learning    | `quiet`           | Beginners need forgiving detection (lowest thresholds) |
| Singer      | `home`            | Balanced for intermediate skill |
| Professional| `noisy`           | Pros want strict filtering, clean signal only |

### Threshold Formulas

- **YIN adjusted threshold:** `0.3 - (sensitivity - 1) * 0.025`
  - sensitivity 1 → 0.30 (strict), sensitivity 12 → 0.025 (relaxed)
- **MPM pick threshold:** `0.9 - (sensitivity - 1) * 0.04`
  - Higher sensitivity → lower threshold → picks earlier peaks (more responsive)
- **RMS amplitude conversion:** `minAmplitude` (1–10 scale) → `(value / 10) * 0.2` → 0.02–0.20 range

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/pitch-detector.ts` | Core YIN + MPM implementations |
| `src/lib/practice-engine.ts` | Mic management, note grading, settings sync |
| `src/contexts/EngineContext.tsx` | Reactive wiring: settings → engine |
| `src/stores/settings-store.ts` | Persisted signals for sensitivity, algorithm, accuracy tier |
| `src/components/SettingsPanel.tsx` | UI for all pitch detection settings |

## Future Considerations

- **AudioWorklet migration** — Move pitch detection off the main thread for lower latency
- **pYIN** — Probabilistic YIN variant that outputs note segmentation (onset/offset), useful for automatic transcription
- **CREPE** — Neural network pitch tracker (requires TensorFlow.js or ONNX), best accuracy but high compute cost — viable as an optional "high quality" mode
