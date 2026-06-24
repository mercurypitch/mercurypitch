# Phase 4: Analysis Tools

**Plan Date:** 2026-06-10  
**Parent:** [VA Enhancement Plans](README.md)  
**Effort:** 7-10 days  
**Dependencies:** Independent (feeds data to Phase 2 annotations, but doesn't need them)

---

## Goal

Port three core Sonic Visualiser analysis capabilities to MercuryPitch: beat/onset detection, automatic key detection, and MATCH-style timeline alignment between user recording and reference track.

---

## 1. Beat & Onset Detection

### What
Detect note onsets and beat positions from audio. Similar to SV's Vamp onset detector plugins. Outputs a list of time positions usable for rhythmic feedback, metronome sync, and annotation snapping.

### Why
- Rhythmic accuracy feedback in practice mode ("you rushed beat 3")
- Automatic metronome tempo detection from a reference track
- Snap annotations to detected onsets (SV's "Snap to Feature")

### Algorithm: Spectral Flux Onset Detection

Simplest reliable onset detector, runs in real-time in a Web Worker.

1. Take STFT frames (already have from spectral worker).
2. Compute spectral flux: sum of positive differences in magnitude spectrum between consecutive frames.
   ```
   flux[t] = sum(max(0, |X[t][k]| - |X[t-1][k]|)) for all frequency bins k
   ```
3. Peak-pick the flux function:
   - A frame is an onset if `flux[t] > mean(flux) + threshold * std(flux)` in a local window.
   - Adaptive threshold (3x local median for robustness).
4. Post-process: merge onsets within 50ms (no double-detection).
5. Optionally run a beat-tracking stage: autocorrelation of onset envelope to find tempo, then phase-lock to find downbeats.

### Implementation

**File: `src/lib/onset-detector.ts`** (new)

```ts
export interface OnsetResult {
  time: number           // seconds
  strength: number       // 0-1, higher = clearer onset
  isBeat: boolean        // true if this is a beat (not just any onset)
  beatPosition?: number  // 1, 2, 3, 4 within bar (if tempo known)
}

export function detectOnsets(
  magnitudeSpectra: Float32Array[],  // sequence of STFT frames
  sampleRate: number,
  hopSize: number,
  options?: { threshold?: number; minInterval?: number }
): OnsetResult[]

export function detectTempo(onsets: OnsetResult[]): { bpm: number; confidence: number }

export function assignBeats(
  onsets: OnsetResult[],
  bpm: number,
  sampleRate: number,
  hopSize: number
): OnsetResult[]
```

**File: `src/workers/onset-worker.ts`** (new)

Offload onset detection from main thread. Message interface:
```ts
{ type: 'DETECT_ONSETS', spectra: Float32Array[], sampleRate: number, hopSize: number }
→ { type: 'ONSET_RESULT', onsets: OnsetResult[] }
```

**Integration:**
- `VocalAnalysis.tsx`: "Detect Beats" button in analysis mode.
- Results overlaid as Time Instants on the annotation layer (Phase 2).
- Tempo shown in transport bar when detected.
- Snap-to-onset: when dragging annotation/selection, magnet to nearest onset.

**Effort:** 2-3 days

---

## 2. Automatic Key Detection

### What
Detect the musical key of the audio using the Krumhansl-Schmuckler key-finding algorithm. Similar to SV's QM Key Detector Vamp plugin.

### Why
- "What key is this song?" — useful for singers choosing a comfortable key
- Automatic scale/key setup for practice mode
- Transposition suggestions ("this song is in D, you might prefer C")

### Algorithm: Krumhansl-Schmuckler

1. Compute a **chromagram** from the STFT magnitude spectra:
   - Map each frequency bin to a pitch class (C, C#, D, ..., B) by folding at octave boundaries.
   - Sum magnitude for each pitch class across all octaves.
   - Result: 12-bin chroma vector per time frame.

2. Average chroma vectors over the entire audio (or a user-selected segment).

3. Correlate the averaged chroma vector with 24 key profiles (12 major + 12 minor).
   - Use Krumhansl-Kessler probe tone profiles (empirically derived from music psychology).
   - The key profile with the highest correlation is the detected key.

4. Return key name, confidence, and alternative candidates.

### Implementation

**File: `src/lib/key-detector.ts`** (new)

```ts
export interface KeyResult {
  key: string           // e.g. "D major", "Bb minor"
  tonic: string         // e.g. "D", "Bb"
  mode: 'major' | 'minor'
  confidence: number    // 0-1
  alternatives: Array<{ key: string; score: number }>  // top 3
}

export function computeChromagram(
  magnitudeSpectrum: Float32Array,
  sampleRate: number,
  fftSize: number
): Float32Array  // 12 bins

export function detectKey(chromagram: Float32Array): KeyResult

export function detectKeyFromSpectra(
  magnitudeSpectra: Float32Array[],  // sequence of STFT frames
  sampleRate: number,
  fftSize: number
): KeyResult
```

### Krumhansl-Kessler Profiles (hardcoded)

```ts
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
```

**Integration:**
- `VocalAnalysis.tsx`: "Detect Key" button.
- Results shown as a card: "Detected: D major (85% confidence). Alternatives: B minor (72%), G major (65%)."
- "Set as Practice Key" button → updates `keyName` and `scaleType` in settings.

**Effort:** 2-3 days

---

## 3. MATCH Timeline Alignment

### What
Align two audio recordings (e.g., user's practice recording and a reference track) in time using Dynamic Time Warping (DTW) on chroma features. This is the foundation for "The Naked Vocal Match" (Phase 3.1 of the vocal analysis roadmap).

### Why
- Align user recording to original track for frame-by-frame comparison
- Compensate for tempo differences (user singing faster/slower)
- Enable per-note accuracy scoring against a reference performance
- This is the single most valuable analysis feature to port from SV

### Algorithm: Chroma DTW

SV uses Simon Dixon's MATCH algorithm (Vamp plugin). We'll implement a simplified but effective version:

1. **Feature extraction:** Compute chroma vectors for both audio signals at regular intervals (~100ms hop).
2. **Distance matrix:** For each pair of frames (i from reference, j from user), compute cosine distance between chroma vectors.
3. **DTW path:** Find the optimal alignment path through the distance matrix using standard DTW with Sakoe-Chiba band constraint (limit warp to ±10% of duration).
4. **Warping function:** The DTW path defines a time-mapping: `t_user → t_reference`.
5. **Alignment output:** For each frame in the user recording, provide the corresponding reference frame time.

### Implementation

**File: `src/lib/dtw-aligner.ts`** (new)

```ts
export interface AlignmentResult {
  /** For each user time point, the corresponding reference time */
  timeMap: Float32Array    // timeMap[i] = reference time for user frame i
  /** Global similarity score (0-1) */
  similarityScore: number
  /** Total time stretch factor (1.0 = same tempo, >1 = user slower, <1 = user faster) */
  tempoRatio: number
  /** Frame-level distance (for visualization) */
  frameDistance: Float32Array
}

export function alignRecordings(
  referenceChroma: Float32Array[],  // reference track chroma frames
  userChroma: Float32Array[],        // user recording chroma frames
  options?: {
    bandWidth?: number     // Sakoe-Chiba band (default: 10% of duration)
    hopSize?: number       // frame hop in seconds (default: 0.1)
  }
): AlignmentResult

/** Convenience: compute chroma + align in one call */
export function alignAudioBuffers(
  referenceBuffer: Float32Array,
  userBuffer: Float32Array,
  sampleRate: number,
): AlignmentResult
```

**File: `src/workers/align-worker.ts`** (new)

DTW on long recordings (>1 minute) can be expensive. Offload to Web Worker.

```ts
{ type: 'ALIGN', referenceChroma: Float32Array[], userChroma: Float32Array[] }
→ { type: 'ALIGN_RESULT', result: AlignmentResult }
```

**Performance considerations:**
- For a 3-minute song at 100ms hop: 1800 frames each → distance matrix is 1800×1800 = 3.24M cells.
- With Sakoe-Chiba band (10%): ~648K cells → computable in <1 second in a worker.
- For longer audio, downsample to 200ms hop or process in overlapping windows.

**Integration:**
- `VocalAnalysis.tsx`: "Align to Reference" button.
- User loads a reference track (via UVR stem separation, already have).
- User records or loads their practice recording.
- Click align → worker processes → shows alignment score and overlay.
- Aligned time map stored for use by Phase 3.1 comparison engine.

**Visualization:**
- Show the DTW path as a line on a 2D plot (reference time vs user time).
- Diagonal line = perfect alignment, deviations show tempo differences.
- Colour-code the path by local distance (green = good match, red = poor).

**Effort:** 3-4 days

---

## Files Changed

| File | Operation | Description |
|---|---|---|
| `src/lib/onset-detector.ts` | **New** | Spectral flux onset detection + beat tracking |
| `src/workers/onset-worker.ts` | **New** | Web Worker for onset detection |
| `src/lib/key-detector.ts` | **New** | Chromagram + K-S key finding |
| `src/lib/dtw-aligner.ts` | **New** | Chroma DTW alignment engine |
| `src/workers/align-worker.ts` | **New** | Web Worker for DTW alignment |
| `src/components/VocalAnalysis.tsx` | Modify | Add "Detect Beats", "Detect Key", "Align" buttons + results |
| `src/types/index.ts` | Modify | OnsetResult, KeyResult, AlignmentResult types |

---

## Deliverables

- [ ] Spectral flux onset detector + adaptive peak picking
- [ ] Beat tracking (tempo detection + beat assignment)
- [ ] Krumhansl-Schmuckler key detection (chromagram + KK profiles)
- [ ] Chroma DTW alignment engine with Sakoe-Chiba band
- [ ] Web Workers for onset and alignment (non-blocking)
- [ ] UI: "Detect Beats", "Detect Key", "Align to Reference" buttons
- [ ] Visualization: DTW alignment path, onset overlay, key card
- [ ] Tests: onset detector on synthetic clicks, key detector on known keys, DTW on shifted audio

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| DTW memory for long recordings | Sakoe-Chiba band limits complexity; downsample hop for long files |
| Onset detector false positives on noisy audio | Adaptive threshold, minimum interval filtering, confidence scoring |
| Key detection wrong on atonal/percussive audio | Show confidence + alternatives; let user override |
| Worker message size for spectra arrays | Transfer Float32Array buffers (zero-copy) |
