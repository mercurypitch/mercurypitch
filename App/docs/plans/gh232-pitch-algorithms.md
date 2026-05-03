# Issue #232: Pitch Detection Algorithms

**Status:** Planned
**Branch:** feature/gh232-pitch-algorithms

## Overview

Implement a framework for comparing and evaluating pitch detection algorithms to help users understand accuracy trade-offs between different methods.

## Requirements

1. Devise a way to estimate accuracy of pitch detection algorithm
2. List all issues with each algorithm
3. Create a sample dataset which will be tested on each algorithm
4. Measure offsets from ground truth and give each one a score
5. Summarize results and provide final list of best to worst algorithms
6. Make sure to also consider computation cost, performance, realtime use
7. Make a framework for easily testing / plugging in new pitch detection algorithm
8. Dedicated developer feature/tab page which provides debug information about pitches detected, allows for loading a sample and running an algorithm through matching it with a waveform/or mic input etc.

## Implementation Plan

### Phase 1: Algorithm Framework & Benchmarking

1. **Create base interfaces** (`src/types/pitch-algorithms.ts`)
   - `IPitchDetector` - base interface for all algorithms
   - `PitchDetectionResult` - result from detection
   - `PitchDetectionMetrics` - accuracy metrics
   - `TestFrequency` - test case with ground truth

2. **Port existing YIN algorithm** (`src/lib/pitch-algorithms/yin-detector.ts`)
   - Wrap current `PitchDetector` class in interface
   - Expose metrics and timing

3. **Create benchmarking framework** (`src/lib/pitch-algorithms/benchmarks.ts`)
   - Compare multiple algorithms on test dataset
   - Calculate metrics: MAE (Hz), MAE (cents), accuracy thresholds
   - Measure computation time
   - Generate comparison report

4. **Create test dataset** (`src/lib/pitch-algorithms/test-data.ts`)
   - Well-known frequencies (C3-C6, MIDI 48-84)
   - Include harmonics and overtones
   - Include sustained tones and transients

### Phase 2: Algorithm Implementations

5. **FFT-based detector** (`src/lib/pitch-algorithms/fft-detector.ts`)
   - Simple frequency bin with max amplitude
   - Zero-crossing fallback

6. **Autocorrelation detector** (`src/lib/pitch-algorithms/autocorr-detector.ts`)
   - Classic AMDF/YIN preprocessing approach

### Phase 3: Debugging/Developer Tab

7. **Create PitchTestingTab** (`src/components/PitchTestingTab.tsx`)
   - Visual comparison of detected pitches
   - Algorithm selector dropdown
   - File upload for audio samples
   - Real-time microphone input comparison
   - Show waveform and detected frequency over time
   - Display computation metrics in real-time

8. **Integrate into app** (`src/App.tsx`)
   - Add "Debug" tab
   - Wire up pitch detector instances
   - Expose window API for E2E testing

### Phase 4: Documentation & Comparison

9. **Create comparison report** (`docs/pitch-algorithm-comparison.md`)
   - Summary table of all algorithms
   - Accuracy benchmarks
   - Performance analysis
   - Recommendations

## File Structure

```
src/
├── types/
│   └── pitch-algorithms.ts          # Type definitions
├── lib/pitch-algorithms/
│   ├── pitch-detector-base.ts       # Base interface
│   ├── yin-detector.ts              # YIN implementation
│   ├── fft-detector.ts              # FFT implementation
│   ├── autocorr-detector.ts         # Autocorrelation implementation
│   └── benchmarks.ts                # Benchmark utilities
└── components/
    └── PitchTestingTab.tsx          # Debugging UI

docs/
└── plans/
    └── gh232-pitch-algorithms.md    # This plan
└── pitch-algorithm-comparison.md    # Final comparison report
```

## Test Dataset (TODO)

Include frequencies for:
- MIDI 48-84 (C3-C6)
- Well-tuned guitar strings
- Common musical intervals (perfect fifth, perfect fourth, etc.)
- Sustained tones and transients

## Metrics to Calculate

1. **Absolute Error in Hz** - `|detected - expected|`
2. **Absolute Error in cents** - `|cents(detected) - cents(expected)|`
3. **Accuracy thresholds:**
   - 5 cents (very good)
   - 10 cents (good)
   - 50 cents (acceptable)
4. **False positive rate** - detection when no signal present
5. **Computation time** - milliseconds per detection
6. **CPU usage** - estimation based on processing time

## Execution Order

1. Create type definitions and base interface
2. Port YIN algorithm to new framework
3. Create benchmarking utilities
4. Create test dataset
5. Implement FFT detector
6. Implement Autocorrelation detector
7. Create PitchTestingTab component
8. Add Debug tab to App
9. Run benchmarks and document results
10. Create comparison report
