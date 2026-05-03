# EARL - Evaluation and Analysis Real-time Language

**Version:** 1.0
**Status:** Draft
**Issue:** GH-234 (Pitch Detection Algorithm Framework)

## Overview

The EARL specification defines the evaluation and analysis framework for pitch detection algorithms. It establishes the rules, metrics, and procedures used to assess algorithm performance across multiple dimensions: accuracy, speed, stability, and compatibility.

## Core Principles

1. **Ground Truth Independence** - Test results must be comparable across all algorithms
2. **Reproducibility** - All test conditions and parameters must be explicit
3. **Comprehensive Coverage** - Tests must cover the full spectrum of pitch detection scenarios
4. **Metric Transparency** - All evaluation metrics must be clearly defined and measurable

---

## Test Scenarios

### Scenario 1: Perfect Root Notes
**Description:** Detection of precise musical notes (no intentional deviation)

| Test Case | Frequency (Hz) | Expected Note | Cents Deviation | Priority |
|-----------|----------------|---------------|----------------|----------|
| T001 | 261.63 | C4 | 0 | High |
| T002 | 277.18 | C#4 | 0 | High |
| T003 | 293.66 | D4 | 0 | High |
| T004 | 329.63 | E4 | 0 | High |
| T005 | 349.23 | F4 | 0 | High |
| T006 | 392.00 | G4 | 0 | High |
| T007 | 440.00 | A4 | 0 | Critical |
| T008 | 493.88 | B4 | 0 | High |
| T009 | 523.25 | C5 | 0 | High |
| T010 | 659.25 | E5 | 0 | Medium |

**Success Criteria:**
- All detected frequencies within ±0.1 cents of expected
- Note name matches expected
- Detection confidence ≥ 0.5 (if applicable)

---

### Scenario 2: Musical Intervals
**Description:** Detection of non-root pitches separated by specific intervals from a reference

| Test Case | Frequency (Hz) | Reference Note | Interval | Cents Deviation | Priority |
|-----------|----------------|----------------|----------|----------------|----------|
| I001 | 261.63 | C4 | Unison | 0 | High |
| I002 | 277.18 | C4 | Minor 2nd | 0 | High |
| I003 | 293.66 | C4 | Major 2nd | 0 | High |
| I004 | 329.63 | C4 | Major 3rd | 0 | High |
| I005 | 349.23 | C4 | Perfect 4th | 0 | High |
| I006 | 392.00 | C4 | Perfect 5th | 0 | High |
| I007 | 440.00 | C4 | Major 6th | 0 | High |
| I008 | 466.16 | C4 | Minor 7th | 0 | High |
| I009 | 493.88 | C4 | Major 7th | 0 | High |
| I010 | 523.25 | C4 | Perfect 8th | 0 | High |

**Success Criteria:**
- All detected frequencies within ±0.1 cents of expected
- Note name matches expected
- Detection confidence ≥ 0.5 (if applicable)

---

### Scenario 3: Pitch Deviations (Cents)
**Description:** Detection of intentionally out-of-tune pitches

| Test Case | Frequency (Hz) | Note | Deviation (Cents) | Direction | Priority |
|-----------|----------------|------|-------------------|-----------|----------|
| D001 | 445.00 | A4 | +50 | Sharp | High |
| D002 | 435.00 | A4 | -50 | Flat | High |
| D003 | 466.16 | A4 | +90 | Sharp | Medium |
| D004 | 415.30 | A4 | -90 | Flat | Medium |
| D005 | 466.16 | A4 | +100 | Sharp | Medium |
| D006 | 415.30 | A4 | -100 | Flat | Medium |

**Success Criteria:**
- Absolute deviation within ±10 cents for High priority
- Absolute deviation within ±25 cents for Medium priority
- Note name matches expected (even if out of tune)
- Detection confidence ≥ 0.5 (if applicable)

---

### Scenario 4: Low Amplitude / High Noise
**Description:** Detection of weak signals with added background noise

| Test Case | Frequency (Hz) | Expected Note | Description | Priority |
|-----------|----------------|---------------|-------------|----------|
| N001 | 261.63 | C4 | 15% amplitude, white noise | High |
| N002 | 440.00 | A4 | 10% amplitude, pink noise | Critical |
| N003 | 523.25 | C5 | 8% amplitude, mixed noise | High |
| N004 | 261.63 | C4 | 5% amplitude, tonal noise | Medium |

**Success Criteria:**
- Detection confidence ≥ 0.3 (if applicable)
- If detection occurs, error within ±50 cents
- If no detection, indicates "no signal detected" rather than false positive

---

### Scenario 5: Frequency Transitions
**Description:** Rapid changes between frequencies (test algorithm stability)

| Test Case | Frequency (Hz) | Description | Priority |
|-----------|----------------|-------------|----------|
| T001 | 261.63 → 329.63 | C4 to E4 (ascending) | Medium |
| T002 | 523.25 → 392.00 | C5 to G4 (descending) | Medium |
| T003 | 440.00 → 261.63 | A4 to C4 (descending) | Medium |
| T004 | 261.63 → 261.63 (hold) | Stable C4 (hold for 2s) | High |

**Success Criteria:**
- Transition detection window ≤ 200ms
- Stable hold detection confirms consistent reading
- No phantom detections during transition

---

### Scenario 6: Out of Range Frequencies
**Description:** Detection attempts outside valid musical range

| Test Case | Frequency (Hz) | Expected Result | Priority |
|-----------|----------------|-----------------|----------|
| R001 | 40 | Too low | Critical |
| R002 | 2000 | Too high | Critical |
| R003 | 0 | Silence/No input | Critical |

**Success Criteria:**
- Returns "no signal detected" or null
- No false positive pitch detection
- No runtime errors or crashes

---

## Accuracy Metrics

### 1. Cent Accuracy (primary metric)

```typescript
errorInCents(detected: number, expected: number): number {
  return 1200 * Math.log2(detected / expected)
}
```

**Acceptance Ranges:**
| Priority | Cent Accuracy | Classification |
|----------|--------------|----------------|
| Critical | ≤ 5 cents | Excellent |
| High | ≤ 10 cents | Good |
| Medium | ≤ 25 cents | Fair |
| Low | ≤ 50 cents | Poor |

### 2. Pass/Fail Thresholds

| Threshold | Description | Required Rate |
|-----------|-------------|---------------|
| 5-cent | Perfectly in tune | ≥ 90% (Critical) |
| 10-cent | Good tuning | ≥ 85% (Critical) |
| 25-cent | Acceptable tuning | ≥ 70% (High) |
| 50-cent | Tolerable tuning | ≥ 50% (Medium) |

### 3. Error Distribution

```typescript
interface ErrorDistribution {
  minError: number      // Smallest error (cents)
  maxError: number      // Largest error (cents)
  avgError: number      // Average error (cents)
  medianError: number   // Median error (cents)
  stdDev: number        // Standard deviation (cents)
}
```

---

## Performance Metrics

### 1. Execution Time

| Metric | Description | Target |
|--------|-------------|--------|
| avgComputationTime | Average time per detection | ≤ 20ms (realtime) |
| computationTimeMin | Minimum detection time | ≤ 5ms |
| computationTimeMax | Maximum detection time | ≤ 50ms |
| realtimeCapability | Can detect 20Hz (50ms window) | Yes/No |

### 2. Frame Rate Requirements

For real-time applications:

| Application Type | Required FPS | Max Latency |
|------------------|--------------|-------------|
| Live performance | ≥ 30 FPS | ≤ 33ms |
| Recording with feedback | ≥ 15 FPS | ≤ 66ms |
| Analysis only | ≥ 5 FPS | ≤ 200ms |

### 3. Memory Usage

| Metric | Target |
|--------|--------|
| Heap usage (per detector) | ≤ 1MB |
| Wasm memory limit | ≤ 16MB (SwiftF0) |

---

## Compatibility Requirements

### 1. Browser Support

| Browser | Minimum Version | Notes |
|---------|-----------------|-------|
| Chrome | 90+ | Full support |
| Firefox | 88+ | Full support |
| Safari | 14+ | Full support |
| Edge | 90+ | Full support |

### 2. Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Desktop (Chrome/Firefox/Safari) | ✓ | Full support |
| Mobile (iOS Safari) | ✓ | Full support |
| Mobile (Android Chrome) | ✓ | Full support |
| Safari on iOS (low-power) | ? | Needs testing |

### 3. Sample Rate Support

| Sample Rate | Status | Notes |
|-------------|--------|-------|
| 44100 Hz | ✓ | Default for most browsers |
| 48000 Hz | ✓ | Windows/Web Audio |
| 16000 Hz | ✓ | Required by SwiftF0 |

---

## Algorithm-Specific Requirements

### SwiftF0 (ML-Based)

| Requirement | Value | Notes |
|-------------|-------|-------|
| Sample Rate | 16000 Hz (required) | Enforced at initialization |
| Model Path | `/models/swiftf0.onnx` | Default, configurable |
| Frequency Bin Range | 3-134 | Input tensor shape |
| Expected Fallback Bin | 91 | Corresponds to A4 (440 Hz) |
| Probability Threshold | 0.1 (default) | Configurable |
| Inference Provider | WASM | CPU execution only |

**ML-Specific Metrics:**
- Probability output confidence
- Model initialization time
- Fallback pitch confidence

### Traditional Algorithms (YIN, MPM, FFT)

| Requirement | Value | Notes |
|-------------|-------|-------|
| Fallback Threshold | 0.15 (YIN) | Configurable |
| Zero Crossing Detection | ✓ | For octave discrimination (MPM) |
| FFT Resolution | SampleDependent | 2048 buffer recommended |
| Min Frequency | 65 Hz (C2) | Default |
| Max Frequency | 2100 Hz (A7) | Default |

---

## Test Execution Framework

### 1. Test Structure

```typescript
interface TestRun {
  algorithm: PitchAlgorithm
  testCases: TestResult[]
  summary: TestSummary
  distribution: ErrorDistribution
}

interface TestResult {
  testCase: TestIdentifier
  detectedFrequency: number
  detectedNote: string
  detectedCents: number
  confidence?: number
  passed: boolean
  error: number
}

interface TestSummary {
  totalTests: number
  passedTests: number
  failedTests: number
  passRate: number
  avgErrorCents: number
  minErrorCents: number
  maxErrorCents: number
}
```

### 2. Test Execution Flow

```
1. Load Test Samples
2. Initialize Detector
3. For each test case:
   a. Generate synthetic waveform
   b. Run detector
   c. Record results
4. Calculate metrics
5. Generate report
```

### 3. Regression Testing

- Test suite must pass with >95% pass rate
- Any regression above 5% error rate triggers alert
- Failed tests must be documented with stack trace

---

## Reporting Requirements

### 1. Test Report Structure

```typescript
interface PitchDetectionReport {
  algorithm: PitchAlgorithm
  algorithmName: string
  timestamp: Date
  testConfiguration: TestConfiguration
  accuracy: AccuracyMetrics
  performance: PerformanceMetrics
  compatibility: CompatibilitySummary
  recommendations: string[]
}
```

### 2. Visual Output

- Error histogram
- Accuracy bands color-coded
- Comparative bar chart
- Detailed results table

---

## Success Criteria

### Final Acceptance Criteria

1. **Accuracy:** ≥ 85% of tests within ±10 cents (Critical tests)
2. **Performance:** ≤ 20ms average computation time for real-time algorithms
3. **Compatibility:** Works on all supported browsers and platforms
4. **Stability:** No memory leaks or crashes during extended testing
5. **Documentation:** All algorithms properly documented with usage examples

### Rejection Criteria

1. Any critical test failure rate >10%
2. Average error >15 cents on root notes
3. SwiftF0 fails to initialize or returns inconsistent results
4. YIN algorithm detection rate <95% on root notes
5. MPM octave discrimination fails on common intervals

---

## Future Enhancements

1. **Dynamic Calibration** - Auto-adjust detection thresholds based on environment
2. **Adaptive Buffer Size** - Optimize buffer size based on performance requirements
3. **Machine Learning Tuning** - Fine-tune ML models based on user feedback
4. **Real-time Comparison** - Live comparison of multiple algorithms
5. **Audio File Testing** - Test with actual audio recordings, not just synthetic waveforms
