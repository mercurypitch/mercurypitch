# Vocal Analysis — Feature Roadmap (Issue #288)

**Branch**: `feat/gh288-vocal-analysis`  
**Parent**: `dev` (commit `aaaef3b`)  
**Source**: [Issue #288 — [RESEARCH] Vocal Analysis](https://github.com/Komediruzecki/pitch-perfect/issues/288)

## Overview

Issue #288 is a research-level feature wishlist covering 20 vocal analysis advancements across two domains:

1. **"The Naked Vocal Match"** — comparing user's isolated vocal stem against the original artist's stem (10 items)
2. **Advanced Timbre Analysis** — analyzing the quality/timbre of the user's voice with server-side processing (10 items)

The codebase already has significant infrastructure in place:
- UVR vocal separation (ONNX-based, works)
- Real-time pitch detection (YIN, FFT, autocorr, SwiftF0 ONNX)
- Pitch scoring & comparison (`mic-scoring.ts`, `practice-engine.ts`)
- PyTorch-compatible STFT engine (`stft-engine.ts`)
- Session history in IndexedDB
- `VocalAnalysis` component (currently heuristic-based)

---

## Phase 1 — Foundational Metrics (High Impact, Low Complexity)

These build directly on existing infrastructure. No new ONNX models needed.

### 1.1 Intensity Mirroring (dB Envelope Analysis)

**What**: Compare the user's amplitude envelope to the original artist's. Score energy matching per note.

**Why first**: Already have AnalyserNode infrastructure and RMS computation patterns. Just need to extract envelope data and compare.

**Implementation**:
- Extract RMS envelope from isolated vocal stems (both user and artist)
- Align envelopes in time (using existing note-timing data from practice engine)
- Compute per-note intensity score: `1.0 - clamp(|user_dB - artist_dB| / max_delta, 0, 1)`
- Display as overlay bars or color-coded note indicators in existing VocalAnalysis view

**Effort**: ~2-3 days

### 1.2 Breathiness Efficiency Index

**What**: Compute harmonic-to-noise ratio (HNR) from the user's vocal. "Air to tone" ratio.

**Why first**: Pure DSP on existing FFT data. No model needed. An FFT frame with strong harmonic peaks = efficient tone. Flat spectrum = breathy/wasted air.

**Implementation**:
- Take FFT frames from the real-time mic input or recorded stem
- Compute HNR: power in harmonic peaks / total power
- Display as a live meter (0-100%) with color zones (red = breathy, green = resonant)
- Track over session to show improvement

**Effort**: ~2 days

### 1.3 Micro-Tone Slide Tracking

**What**: Track and score the path a singer takes BETWEEN target notes ("scoops", "slides", approach). Score the transition quality, not just note destination.

**Why first**: The pitch detector already runs continuously at frame-level. Already have `PitchSample[]` streams with timestamps. Just need transition-path analysis on top.

**Implementation**:
- Detect note transitions from the pitch sample stream (stable pitch → changing pitch → new stable pitch)
- Measure transition duration, pitch path (direct vs overshoot vs undershoot)
- Classify slide type: clean (immediate), scoop (rising approach), fall (descending approach), overshoot
- Display in pitch history with transitions highlighted
- Score: clean transitions earn bonus points, excessive scooping flags for improvement

**Effort**: ~3 days

---

## Phase 2 — Spectral/Timbre Metrics (High Impact, Medium Complexity)

### 2.1 Vibrato Detection & Oscilloscope

**What**: Detect vibrato from the user's voice (not synthesize it). Measure rate (Hz) and depth (cents). Visualize as an oscilloscope-like waveform.

**Why**: Pitch detection runs at frame rate. Vibrato is periodic pitch modulation (~4-8 Hz). Detectable by FFT-on-pitch-track (frequency-domain analysis of the pitch time series).

**Implementation**:
- Buffer last N pitch samples (~500ms window)
- Run FFT on the pitch time series to find dominant modulation frequency
- Classify: none | slow (operatic, 4-5.5 Hz) | natural (5.5-7 Hz) | nervous (7+ Hz)
- Measure depth in cents (peak-to-peak amplitude of modulation)
- Display oscilloscope visualization: time-domain pitch wobble + frequency spectrum
- Score: rate and depth within "musical" ranges earn higher marks

**Effort**: ~3-4 days

### 2.2 Harmonic Richness Score

**What**: Count and measure overtones in the voice. "Rich" voice = many strong harmonics. "Thin" voice = few/weak harmonics.

**Why**: Direct FFT analysis. No model, no training data.

**Implementation**:
- Take magnitude spectrum from FFT
- Detect fundamental (f0) from pitch detector
- Measure amplitude of first 10-15 harmonics relative to fundamental
- Richness score: weighted sum of harmonic amplitudes (H2-H15) / fundamental amplitude
- Display as a "Harmonic Profile" bar chart (like an EQ visualization but for overtones)
- Track over session for vocal fatigue correlation (see 2.4)

**Effort**: ~2-3 days

### 2.3 Resonance Zone Detection (Heuristic)

**What**: Classify where the voice is resonating — chest, mask (mixed), or head — based on spectral energy distribution.

**Why**: No ONNX model needed for rough classification. Spectral centroid and formant-energy ratios give usable signals. True formant tracking needs ML (Phase 4), but a heuristic version is useful now.

**Implementation**:
- Compute spectral centroid and energy ratios across three bands: low (chest, ~200-800 Hz), mid (mask, ~800-2500 Hz), high (head, ~2500+ Hz)
- Classify dominant zone based on energy distribution
- Display as a "body map" visualization (simple SVG of torso/head with glow on active zone)
- Track zone transitions when singer moves through their range

**Effort**: ~3 days

### 2.4 Vocal Fatigue Tracker

**What**: Track how timbre metrics (harmonics, breathiness, pitch stability) change over a session. Alert when degradation suggests fatigue.

**Why**: Built on metrics from 1.2 and 2.2. Just needs a time-series tracker.

**Implementation**:
- Record HNR, harmonic richness, pitch stability, and intensity at checkpoints (every 30s or per song)
- Compute trend lines for each metric
- Fatigue indicators: HNR dropping, harmonic richness declining, pitch stability worsening, intensity harder to maintain
- Display as trend sparklines in VocalAnalysis
- Threshold alert: "Your high-end harmonics are dropping; it's time to rest your voice"

**Effort**: ~2 days

---

## Phase 3 — Advanced Comparison (High Impact, High Complexity)

### 3.1 Phase-Aligned Vocal Comparison Engine

**What**: Core engine that takes user's UVR-isolated stem + artist's isolated stem, aligns them in time, and produces per-frame comparison data.

**Why**: Foundation for all "Naked Vocal Match" features. Must be right.

**Implementation**:
- Accept two audio buffers: user stem, artist stem
- Use cross-correlation or DTW to align timing (artist timing as reference, user warped to match)
- Extract pitch, intensity, and spectral features from both at aligned time points
- Produce `ComparisonFrame[]` output: `{ time, userPitch, artistPitch, userIntensity, artistIntensity, userHNR, artistHNR, ... }`
- This is the data backbone for scoring, visualization, and reports

**Effort**: ~5-7 days

### 3.2 Consonant Attack Scoring

**What**: Detect and score the "transients" — hard P, T, K, B, D, G sounds that define professional diction.

**Why**: On the path to full "Naked Vocal Match." Needs the aligned comparison engine (3.1) plus transient detection.

**Implementation**:
- Detect transients in the amplitude envelope (sudden energy spikes ~5-50ms)
- Compare user's transient count, timing, and strength vs artist's
- Identify missed consonants (artist has transient, user doesn't) and sloppy ones (user transient much weaker)
- Onset precision: how close in time user's consonants hit vs artist's

**Effort**: ~4-5 days

### 3.3 "Aura" Overlay Visualization

**What**: Two translucent overlapping waveforms (User vs Artist) that pulse. More overlap = brighter glow. Visual harmonic alignment.

**Why**: The signature UI feature of "The Naked Vocal Match." Motivational and beautiful.

**Implementation**:
- Render two waveform rings from the comparison engine's spectral data
- Opacity/glow intensity proportional to pitch + intensity match at each frequency bin
- Animate in real-time as a playback-driven visualization
- Color shift: cold (blue/purple) when diverged, warm (gold/white) when aligned

**Effort**: ~5-7 days

---

## Phase 4 — ML-Powered Features (Complex, Needs Models)

These require new ONNX models or cloud processing. Deferred until foundational phases ship.

### 4.1 Formant / Vowel Shape Matching
- ONNX model for formant extraction (e.g., a lightweight CREPE variant or custom formant tracker)
- Compare user's F1/F2 vowel space to artist's
- Score vowel purity per syllable

### 4.2 Strain / Constriction Detection
- ONNX model trained on healthy vs. strained vocal samples
- Spectral features indicating vocal tract tension
- Real-time "Red Alert" warning system

### 4.3 AI Mock Audition Report
- Aggregated comparison data → natural language report
- "You are 85% similar to the original, but your attack is too soft"
- Could use LLM with structured comparison data as input

### 4.4 Global Leaderboards
- Backend service (Cloudflare Workers or similar)
- "Vocal Twin" rankings — who matches which artist best

---

## Execution Order

```
Phase 1.1  Intensity Mirroring         ████░░░░░░  (2-3d)
Phase 1.2  Breathiness Index           ███░░░░░░░  (2d)
Phase 1.3  Micro-Tone Slide Tracking   ████░░░░░░  (3d)
Phase 2.2  Harmonic Richness Score     ███░░░░░░░  (2-3d)
Phase 2.1  Vibrato Detection           █████░░░░░  (3-4d)
Phase 2.3  Resonance Zone Detection    ████░░░░░░  (3d)
Phase 2.4  Vocal Fatigue Tracker       ███░░░░░░░  (2d)
Phase 3.1  Aligned Comparison Engine   ████████░░  (5-7d)
Phase 3.2  Consonant Attack Scoring    ██████░░░░  (4-5d)
Phase 3.3  Aura Overlay UI             ████████░░  (5-7d)
── Phase 4 deferred until Phases 1-3 ship ──
```

**Total Phase 1**: ~7-8 days  
**Total Phases 1-2**: ~15-18 days  
**Total Phases 1-3**: ~29-37 days

## Deliverables per Phase

Each phase produces:
- New/updated components in `src/components/`
- New analysis modules in `src/lib/`
- Updated types in `src/types/`
- Tests for all new modules
- CSS updates (modular, following existing patterns)
- Barrel exports updated in `src/components/index.ts`

## Current State (before any work)
- `VocalAnalysis.tsx`: Belt/Falsetto/Dynamics checks are heuristic; Riffs/Runs are stubs
- `VocalChallenges.tsx`: Interactive exercises using existing pitch detection
- No formant, vibrato detection, HNR, or envelope comparison exists in the codebase
- UVR pipeline works and produces isolated stems — the raw material for comparison is available

## Related Files
- `src/components/VocalAnalysis.tsx` — main vocal analysis UI
- `src/components/VocalChallenges.tsx` — interactive vocal exercises
- `src/lib/mic-scoring.ts` — pitch comparison scoring
- `src/lib/practice-engine.ts` — practice session scoring
- `src/lib/stft-engine.ts` — STFT/iSTFT for spectral analysis
- `src/lib/pitch-detector.ts` — continuous pitch detection
- `src/lib/swift-f0-detector.ts` — ONNX pitch detection
- `src/types/index.ts` — type definitions
- `src/styles/vocal-analysis.css` — analysis UI styles
