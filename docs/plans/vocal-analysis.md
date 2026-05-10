# Vocal Analysis — Research & Implementation Plan

Issue: [#288](https://github.com/Komediruzecki/pitch-perfect/issues/288)

## Overview

Expand PitchPerfect beyond pitch accuracy into comprehensive vocal analysis. Two major feature categories: (1) comparing user vocals against reference artist stems ("Naked Vocal Match"), and (2) analyzing vocal timbre qualities like vibrato, resonance, breathiness, and strain. Heavy processing runs server-side (Cloudflare Workers or Containers) and sends lightweight JSON diagnostics to the frontend.

---

## Current State

PitchPerfect already has:
- Real-time pitch detection (swiftf0 ONNX model, 388 kB)
- Session history with scoring
- Vocal Analysis tab (spectrum view, weekly scores, streak tracking)
- UVR stem separation (client-side)
- Web Audio API pipeline (`audio-engine.ts` — 1680 LOC)

Gaps to address:
- No formant/vowel analysis
- No timbre classification (breathy, strained, resonant)
- No vibrato measurement
- No reference artist comparison
- No server-side audio processing

---

## Feature Catalog

### Category 1: "Naked Vocal" Match — Artist vs User

| # | Feature | Description | Complexity | Server |
|---|---------|-------------|------------|--------|
| 1.1 | Phase-Aligned Ghosting | Align user audio to artist timing; heatmap of rhythm vs pitch drift | High | Yes |
| 1.2 | Intensity Mirroring | Decibel envelope comparison; score attack energy vs original | Medium | No |
| 1.3 | Vowel Shape Matching | ONNX formant extraction; score vowel match (Ah/Ee/Oo) | High | Yes |
| 1.4 | Aura Overlay | Visual UI: two translucent waves (User vs Artist), overlap = glow | Medium | No |
| 1.5 | Consonant Attack Scoring | Transient detection for P/T/K sounds; diction scoring | High | Yes |
| 1.6 | Micro-Tone Slide Tracking | Score transitions between pitches, not just destinations | Medium | No |
| 1.7 | Dynamic Lead Volume | Auto-mix artist vocal as guide when user score drops | Medium | No |
| 1.8 | Vocal Style Signature | Identify stylistic techniques (growl, breathiness); bonus points | High | Yes |
| 1.9 | AI Mock Audition | Generate report: "85% similar, but attack too soft vs artist" | Low | Yes |
| 1.10 | Global Artist Leaderboards | "Vocal Twin" rankings per artist | Medium | Yes |

### Category 2: Advanced Timbre Analysis

| # | Feature | Description | Complexity | Server |
|---|---------|-------------|------------|--------|
| 2.1 | Vibrato Oscilloscope | Real-time vibrato speed (Hz) + width (semitones) | Medium | No |
| 2.2 | Resonance Heatmap | Detect chest/mask/head resonance; body map visualization | High | Yes |
| 2.3 | Strain/Constriction Warning | ONNX vocal squeeze detection; red alert for unhealthy tension | High | Yes |
| 2.4 | Breathiness Efficiency | Air-to-tone ratio; "wasting air" feedback | Medium | No |
| 2.5 | Vocal Fry/Growl Analysis | Sub-harmonic tracking for rock/jazz; score texture without false off-pitch | High | Yes |
| 2.6 | Formant Shifting Recommendations | Analyze timbre; suggest "drop jaw on high notes", etc. | High | Yes |
| 2.7 | Harmonic Richness Score | Overtone measurement; "rich" vs "thin" voice metric | Medium | No |
| 2.8 | Sibilance (De-Esser) Training | Track S/Sh harshness; gamify reduction | Medium | No |
| 2.9 | Vocal Fatigue Predictor | Track timbre change over 30 min; alert when harmonics drop | Medium | No |
| 2.10 | Mood/Color Mapping | Timbre → color (blue for breathy, yellow for brassy) | Low | No |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Client (Browser)                             │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │  Mic/File     │→ │  Audio Engine │→ │  Real-Time Processors      │ │
│  │  Capture      │  │  (existing)   │  │  • Vibrato detection (WASM) │ │
│  └──────────────┘  └──────────────┘  │  • Intensity envelope        │ │
│                                       │  • Harmonic richness (FFT)   │ │
│                                       │  • Sibilance detection       │ │
│                                       │  • Breathiness estimator     │ │
│                                       └──────────┬─────────────────┘ │
│                                                  │                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Vocal Analysis UI (extended)                                  │   │
│  │  • Vibrato scope  • Resonance map  • Strain alert             │   │
│  │  • Aura overlay  • Harmonic meter  • Fatigue warning          │   │
│  │  • Mood palette  • De-esser score  • Artist leaderboard       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│                              POST /api/vocal/analyze                  │
│                              (audio chunk or pre-computed FFT)        │
│                                       │                               │
└───────────────────────────────────────┼───────────────────────────────┘
                                        │
┌───────────────────────────────────────┴───────────────────────────────┐
│                        Cloudflare Edge                                 │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Worker: /api/vocal/*                                            │ │
│  │  • Receives audio chunks (Opus encoded)                          │ │
│  │  • Routes to Container for heavy models                          │ │
│  │  • Caches results (content-hash keyed, 24h TTL)                  │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                              │                                         │
│  ┌──────────────────────────┴──────────────────────────────────────┐ │
│  │  Container (Cloudflare Containers)                                │ │
│  │  • ONNX inference: formant extraction, strain detection,         │ │
│  │    vowel classification, style signature                         │ │
│  │  • Runs Python or C++ ONNX Runtime                               │ │
│  │  • Returns lightweight JSON diagnostic packet                    │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Diagnostic Packet (from server)

```typescript
interface VocalDiagnostic {
  pitch_accuracy: number        // 0-1
  intensity_match: number       // 0-1 (vs artist reference)
  vibrato_hz: number            // frequency of vibrato oscillation
  vibrato_width_semitones: number // width of vibrato
  strain_detected: boolean
  resonance: 'chest' | 'mask' | 'head' | 'mixed'
  vowel_purity: number          // 0-1
  breathiness_ratio: number     // air/tone, lower = cleaner
  harmonic_richness: number     // active overtone count, normalized
  sibilance_db: number          // peak S/Sh level
  formant_shift_suggestion: string | null  // e.g. "Drop jaw on high notes"
  style_signatures: string[]    // e.g. ["breathy", "growl"]
  color_map: string             // e.g. "#4A90D9" for current timbre color
  fatigue_index: number         // 0-100, rising = fatiguing
}
```

---

## Models & Dependencies

### Client-Side (ONNX Runtime Web — already in use)

| Model | Purpose | Size Est. | Status |
|-------|---------|-----------|--------|
| swiftf0.onnx | Pitch detection | 389 kB | ✅ In use |
| vibrato-classifier | Vibrato detection from pitch contour | ~200 kB | New |
| harmonic-analyzer | Overtone counting from FFT | ~300 kB | New |
| breathiness-estimator | HNR (Harmonics-to-Noise Ratio) | ~500 kB | New |

### Server-Side (ONNX Runtime — Cloudflare Container)

| Model | Purpose | Size Est. | Status |
|-------|---------|-----------|--------|
| formant-extractor | Vowel formant F1/F2/F3 extraction | ~5 MB | New |
| strain-detector | Vocal squeeze/constriction classifier | ~3 MB | New |
| style-classifier | Vocal technique identification | ~8 MB | New |
| resonance-classifier | Chest/mask/head resonance detection | ~4 MB | New |

---

## Phased Implementation

### Phase 1: Client-Side Timbre Basics (Week 1-3)

Real-time, no server needed. Build directly on Web Audio API + existing pitch pipeline.

```
1.1 Vibrato Oscilloscope
     - From pitch contour (already computed), calculate:
       • Vibrato rate: FFT of pitch deviation over 1s windows
       • Vibrato width: max pitch deviation in semitones
     - Visual: oscilloscope-like display in VocalAnalysis

1.2 Harmonic Richness Score
     - From existing AnalyserNode FFT data:
       • Count peaks above noise floor
       • Normalize 0-100 score
     - Visual: spectrum bar with richness indicator

1.3 Breathiness Efficiency Index
     - From HNR (Harmonics-to-Noise Ratio) via autocorrelation
       • High HNR = clean tone, Low HNR = breathy
     - Visual: gauge meter

1.4 Intensity Envelope (Peak/RMS tracking)
     - Existing AudioEngine already computes RMS
     - Add peak envelope tracking
     - Visual: waveform with intensity overlay
```

### Phase 2: Artist Comparison Pipeline (Week 4-7)

Requires reference stems and server-side alignment.

```
2.1 Reference Stem Management
     - Upload artist reference stems (vocal stem from UVR)
     - Store in D1 metadata (reference_id, artist, track, duration)
     - Cache processed feature vectors in R2

2.2 Phase Alignment (MATLAB-style DTW)
     - Dynamic Time Warping on pitch contours
     - Align user audio timeline to artist reference
     - Server-side: receive both pitch contours, return alignment map

2.3 Intensity Mirroring
     - Compare decibel envelopes after alignment
     - Score 0-100 on attack/sustain/release match
     - Client-side: compute from aligned RMS curves

2.4 Micro-Tone Slide Tracking
     - Detect pitch transitions (portamento/scoop)
     - Compare transition shape (linear, exponential, S-curve)
     - Score transition similarity

2.5 Aura Overlay Visualization
     - Canvas-based: two translucent waveforms
     - Overlap area = glow intensity
     - Real-time during playback of both stems
```

### Phase 3: Server-Side Models (Week 8-12)

Deploy ONNX models to Cloudflare Containers.

```
3.1 Cloudflare Container Setup
     - Docker image with ONNX Runtime + Python
     - Endpoint: POST /api/vocal/analyze
     - Caching layer: same audio + same reference → cached result

3.2 Formant Extraction
     - Extract F1, F2, F3 via LPC or pre-trained ONNX model
     - Compare user vs artist formant tracks
     - Generate formant shift suggestions

3.3 Vowel Shape Matching
     - Classify vowel from formant ratios (F1/F2)
     - Timeline: user vowel sequence vs artist vowel sequence
     - Score per vowel and overall

3.4 Strain Detection
     - Input: FFT spectrum + pitch contour
     - Detect: high-frequency noise, irregular harmonics, pitch instability
     - Output: strain_score 0-100 + alert threshold

3.5 Resonance Classification
     - Input: spectrum envelope
     - Classify: chest (low energy peak), mask (mid), head (high)
     - Visual: body map with highlighted resonance zone

3.6 Vocal Style Signature Detection
     - Detect: growl (sub-harmonics), breathiness (noise band), vibrato type
     - Bonus points for matching artist style
```

### Phase 4: Gamification & Social (Week 13-15)

```
4.1 Global Artist Leaderboards
     - Per-artist "Vocal Twin" rankings
     - Aggregate scores: pitch + intensity + vowel + style
     - Weekly reset for active competition

4.2 AI Mock Audition Report
     - Generate text summary from all diagnostic fields
     - Template: "You are {similarity}% similar to {artist}. 
       Your {weakest_dimension} needs work. 
       Your {strongest_dimension} exceeded the original!"
     - Downloadable as shareable image

4.3 Vocal Fatigue Predictor
     - Track all metrics over session duration
     - Detect: harmonic richness decline, pitch accuracy decay, strain increase
     - Alert: "Your vocal harmonics are dropping — consider a break"

4.4 De-Esser Training Mode
     - Isolate S/Sh frequencies (4-8 kHz band)
     - Score sibilance peaks
     - Gamify: "Keep your S sounds under the threshold line"

4.5 Mood/Color Palette
     - Timbre → color mapping:
       • Breathy/soft → Blue (#4A90D9)
       • Brassy/bright → Yellow (#F5A623)
       • Warm/resonant → Orange (#D0021B)
       • Thin/strained → Gray (#9B9B9B)
     - Show palette history over time
```

---

## Files to Create/Modify

### New Files

```
src/
├── lib/
│   ├── vocal/
│   │   ├── vibrato-detector.ts       # Vibrato rate + width from pitch contour
│   │   ├── harmonic-analyzer.ts      # Overtone counting, HNR calculation
│   │   ├── envelope-tracker.ts       # Peak/RMS envelope extraction
│   │   ├── sibilance-detector.ts     # 4-8 kHz band energy tracking
│   │   ├── breathiness-estimator.ts  # Air-to-tone ratio
│   │   ├── slide-tracker.ts          # Micro-tone transition analysis
│   │   ├── fatigue-monitor.ts        # Metric tracking over session time
│   │   ├── vocal-api.ts              # Client for /api/vocal/* endpoints
│   │   └── types.ts                  # VocalDiagnostic, ReferenceStem, etc.
├── components/
│   ├── vocal/
│   │   ├── VibratoScope.tsx          # Real-time oscilloscope display
│   │   ├── ResonanceMap.tsx          # Body resonance visualization
│   │   ├── AuraOverlay.tsx           # User vs Artist waveform overlap
│   │   ├── HarmonicMeter.tsx         # Richness score + spectrum bars
│   │   ├── StrainAlert.tsx           # Red alert for vocal tension
│   │   ├── DeEsserGauge.tsx          # Sibilance tracking gauge
│   │   ├── MoodPalette.tsx           # Timbre color history
│   │   ├── FatigueIndicator.tsx      # Session fatigue progress
│   │   ├── ArtistLeaderboard.tsx     # Per-artist rankings
│   │   └── MockAuditionReport.tsx    # AI-generated report card
├── stores/
│   └── vocal-analysis-store.ts       # Vocal diagnostic state management
server/
├── container/
│   ├── Dockerfile                    # ONNX Runtime + Python
│   ├── main.py                       # Inference server
│   ├── models/
│   │   ├── formant.onnx
│   │   ├── strain.onnx
│   │   ├── resonance.onnx
│   │   └── style.onnx
│   └── requirements.txt
```

### Modified Files

```
src/
├── components/
│   ├── VocalAnalysis.tsx             # Integrate new sub-components
│   ├── AppSidebar.tsx                # New sub-tabs for features
│   └── index.ts                      # Export new components
├── lib/
│   └── audio-engine.ts              # Add HNR, sibilance band, envelope hooks
├── stores/
│   └── index.ts                      # Export vocal-analysis-store
vite.config.ts                        # vocal-analysis chunk in manualChunks
```

---

## Dependencies

### New npm packages

```json
{
  // None required client-side beyond existing ONNX Runtime Web
  // All timbre analysis uses Web Audio API built-ins + bespoke math
}
```

### Server

```
# Python (Cloudflare Container)
onnxruntime>=1.17.0
numpy>=1.26.0
librosa>=0.10.0     # Audio feature extraction
scipy>=1.12.0       # Signal processing
```

---

## Research Questions

Per the issue's framing as [RESEARCH], these need investigation before full implementation:

| # | Question | Approach |
|---|----------|----------|
| 1 | Can vibrato detection run purely on pitch contour (no new model)? | Prototype in Phase 1. FFT of pitch deviation. If insufficient quality, evaluate lightweight ONNX model. |
| 2 | Which formant extraction ONNX model? | Evaluate: WORLD vocoder formants, CREPE-based, or custom trained. Trade-off: accuracy vs model size. |
| 3 | Is Cloudflare Container cold-start acceptable for /api/vocal/analyze? | Benchmark. If >2s cold start, consider keeping container warm (minimum instances = 1, ~$10/mo) or pre-computing on upload. |
| 4 | How to handle reference artist stems legally? | Users upload their own stems (from their own music). Artist reference stems: either user-provided OR we only store pre-computed feature vectors (not audio). |
| 5 | Client-side vs server-side threshold: which features can run entirely client-side? | Intensity, vibrato, harmonic richness, sibilance, breathiness HNR, slide tracking, fatigue monitoring — all feasible client-side. Only formant, strain, resonance, style classification need server. |
| 6 | Can existing swiftf0 ONNX model's intermediate features be reused? | Investigate if swiftf0 encoder layers produce useful embeddings for timbre analysis (multi-task learning opportunity). |

---

## Effort Estimate

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 (Client timbre) | Vibrato, harmonics, breathiness, intensity | 8-12 days |
| Phase 2 (Artist comparison) | Alignment, mirroring, slides, aura UI | 12-18 days |
| Phase 3 (Server models) | Container, formant, strain, resonance, style | 15-22 days |
| Phase 4 (Gamification) | Leaderboards, reports, fatigue, de-esser, palette | 8-12 days |
| **Total** | | **43-64 days** |

---

## Cost Estimate

| Resource | Monthly Cost (1K users) | Monthly Cost (10K users) |
|----------|------------------------|--------------------------|
| Cloudflare Container (1 instance) | $10-15 | $25-40 |
| ONNX model storage (R2) | <$1 | $2-5 |
| API Worker requests | Free tier | $0-5 |
| Reference stem vectors (D1/R2) | <$1 | $5-10 |
| **Total** | **$12-17/mo** | **$32-60/mo** |

---

## Success Criteria

✅ Vibrato rate + width displayed in real-time on Vocal Analysis tab
✅ Harmonic richness score updates during singing
✅ Breathiness gauge shows air/tone ratio
✅ Artist reference stems can be loaded and aligned to user audio
✅ User vs artist comparison produces similarity scores (pitch, intensity, vowel)
✅ Server-side ONNX inference returns diagnostics in <3 seconds
✅ Strain detection alerts fire before user reaches vocal fatigue
✅ Resonance classification (chest/mask/head) is visually displayed
✅ Mock audition report summarizes performance vs artist
✅ All new metrics persist to session history for long-term tracking
