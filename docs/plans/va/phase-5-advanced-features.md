# Phase 5: Advanced Features

**Plan Date:** 2026-06-10  
**Parent:** [VA Enhancement Plans](README.md)  
**Effort:** 10-14 days  
**Dependencies:** Phases 1-4 (builds on spectrogram, annotations, multi-pane, and analysis tools)

---

## Goal

Port Sonic Visualiser's most advanced features: chord detection, structural segmentation, and a Web Worker-based transform interface modeled after SV's Vamp plugin architecture.

---

## 1. Chord Detection

### What
Detect musical chords from audio using chroma features and template matching. Similar to SV's Chordino and NNLS Chroma Vamp plugins.

### Why
- Show chord labels synced to audio during practice (like a karaoke chord chart)
- Chord-aware pitch scoring (singing the 3rd of a chord vs the root)
- Export chord charts for songs

### Algorithm: Chroma Template Matching

1. **Compute NNLS Chroma** (Non-Negative Least Squares):
   - Sharper, more harmonic-aware chromagram than simple pitch folding.
   - Uses a dictionary of harmonic profiles (note + overtones) to decompose each spectrum frame into note activations.
   - Result: 12-bin chroma where each bin represents the strength of that pitch class.

2. **Chord Template Matching:**
   - Pre-define 24 chord templates (12 roots × 2 qualities: major/minor) + 12 diminished + 12 augmented = 48 total.
   - Each template is a binary 12-bin vector (e.g., C major = [1,0,0,0,1,0,0,1,0,0,0,0] for C, E, G).
   - For each chroma frame, compute dot product with all 48 templates.
   - Highest score → detected chord.

3. **Temporal Smoothing:**
   - Chords typically last at least 250ms. Apply median filter (window ~3 frames) to reduce flicker.
   - Merge adjacent frames with same chord.

4. **Bass Note Detection:**
   - The lowest strong frequency in each frame determines the bass note (may differ from chord root for inversions).
   - Output: "C/E" (C major with E in bass).

### Implementation

**File: `src/lib/chord-detector.ts`** (new)

```ts
export interface ChordFrame {
  time: number           // seconds
  chord: string          // e.g. "Cmaj", "Gmin", "Ddim"
  root: string           // e.g. "C", "G"
  quality: 'major' | 'minor' | 'diminished' | 'augmented' | 'unknown'
  bass?: string          // bass note for inversions (e.g. "E" for C/E)
  confidence: number     // 0-1
}

export function computeNNLSChroma(
  magnitudeSpectrum: Float32Array,
  sampleRate: number,
  fftSize: number
): Float32Array  // 12-bin clean chroma

export function detectChords(
  chromaFrames: Float32Array[],  // sequence of 12-bin chroma
  hopSize: number,               // seconds between frames
  options?: { medianWindow?: number; minDuration?: number }
): ChordFrame[]

export function simplifyChordSequence(chords: ChordFrame[]): ChordFrame[]
```

**Chord templates (48 total):**
```ts
const CHORD_TEMPLATES: Record<string, number[]> = {
  'maj':  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],  // root, major 3rd, perfect 5th
  'min':  [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],  // root, minor 3rd, perfect 5th
  'dim':  [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],  // root, minor 3rd, diminished 5th
  'aug':  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],  // root, major 3rd, augmented 5th
}
// Rotate for each of 12 roots
```

**Integration:**
- `VocalAnalysis.tsx`: "Detect Chords" button on reference audio.
- Chord labels overlaid as a strip above/below the spectrogram.
- Click a chord → shows all candidates with scores.
- Export chord sequence as text/chordpro format.

**Effort:** 3-4 days

---

## 2. Structural Segmentation

### What
Auto-detect musical structure (verse, chorus, bridge, etc.) using self-similarity analysis. Similar to SV's QM Segmenter Vamp plugin.

### Why
- "Skip to chorus" navigation in practice mode
- Structure-aware looping (loop the chorus, not the whole song)
- Song structure visualization

### Algorithm: Self-Similarity Matrix + Novelty Detection

1. **Feature extraction:** Compute timbral features per beat (MFCC-like: spectral centroid, rolloff, flux, 13 MFCCs → 16-dim vector per beat).
2. **Self-Similarity Matrix (SSM):** Compute pairwise cosine similarity between all beat-level feature vectors. Result: N×N matrix where SSM[i][j] = similarity between beat i and beat j.
3. **Novelty detection:** Convolve the SSM with a checkerboard kernel along the diagonal. Peaks in the novelty function indicate structural boundaries.
4. **Segment labeling:** Cluster segments by their feature vectors. Assign labels: "A", "B", "C" or "Verse", "Chorus", "Bridge" based on repetition patterns (most repeated = chorus).
5. **Refinement:** Merge segments shorter than 4 seconds with neighbours.

### Implementation

**File: `src/lib/segmenter.ts`** (new)

```ts
export interface Segment {
  startTime: number
  endTime: number
  label: string          // "Verse", "Chorus", "Bridge", "Intro", "Outro", or "A", "B", "C"
  confidence: number
  color?: string         // consistent colour for same section type
}

export interface SegmentationResult {
  segments: Segment[]
  labels: string[]       // unique labels in order
  noveltyCurve: Float32Array  // for visualization
}

export function computeTimbreFeatures(
  magnitudeSpectrum: Float32Array,
  sampleRate: number
): Float32Array  // 16-dim feature vector

export function segmentAudio(
  magnitudeSpectra: Float32Array[],  // sequence of STFT frames
  sampleRate: number,
  hopSize: number,
  options?: { minSegmentDuration?: number; maxSegments?: number }
): SegmentationResult
```

**Checkerboard kernel:**
```
A 2D Gaussian-tapered checkerboard pattern correlated along the SSM diagonal
to detect points of maximal novelty (structural change).
```

**Labeling heuristic:**
- Find the most frequently repeated segment → label as "Chorus"
- The segment before the first chorus → "Verse"
- Low-energy segment at start → "Intro"
- Final segment if distinct → "Outro"
- Others → "Bridge" or "A", "B", "C"

**Integration:**
- `VocalAnalysis.tsx`: "Segment Song" button on reference audio.
- Segments rendered as Regions on the annotation layer (Phase 2).
- Segment colours consistent (all choruses same colour).
- Click segment → jump playback to that section.
- Segment labels shown on time ruler.

**Visualization:**
- Show the SSM as a small thumbnail heatmap.
- Novelty curve overlaid below the SSM with detected boundaries as vertical lines.

**Effort:** 4-5 days

---

## 3. Web Worker Transform Interface

### What
A standardized interface for audio analysis transforms running in Web Workers. Modeled after SV's Vamp plugin architecture but adapted for the web. Allows new analysis algorithms to be added without modifying the core app.

### Why
- Extensibility: community can contribute analysis algorithms
- Isolation: each transform runs in its own Worker (crash-safe, non-blocking)
- Standardization: common input/output format makes transforms composable

### Architecture

```
Transform Worker
┌─────────────────────────────────────────────┐
│ onmessage({ type: 'CONFIGURE', config })     │  ← configure (sample rate, params)
│ onmessage({ type: 'PROCESS', audio })        │  ← process audio buffer
│                                              │
│ // Transform implementation                  │
│ function initialise(channels, rate, ...)     │
│ function process(frame: Float32Array)        │
│ function getRemainingFeatures()              │
│                                              │
│ // Output                                    │
│ postMessage({ type: 'FEATURE', data })       │  → feature data to main thread
│ postMessage({ type: 'COMPLETE' })            │  → done
└─────────────────────────────────────────────┘
```

### Transform Interface (`src/lib/transform-interface.ts`)

```ts
/** Output descriptor — what kind of data the transform produces */
export interface TransformOutput {
  id: string
  name: string
  /** Which annotation type the output maps to */
  annotationType: 'instant' | 'value' | 'region'
  /** Unit of Y-axis values (if value type) */
  unit?: string
  /** Min/max for normalization */
  valueRange?: [number, number]
}

/** Transform metadata for the UI */
export interface TransformDescriptor {
  id: string
  name: string
  description: string
  category: 'pitch' | 'time' | 'spectral' | 'key' | 'structure'
  version: string
  outputs: TransformOutput[]
  /** Parameters the user can configure */
  parameters?: TransformParameter[]
  /** Minimum audio duration required (seconds) */
  minDuration?: number
}

export interface TransformParameter {
  id: string
  label: string
  type: 'number' | 'selection' | 'boolean'
  default: number | string | boolean
  min?: number
  max?: number
  options?: string[]  // for selection type
}

/** What the transform receives */
export interface TransformInput {
  audio: Float32Array
  sampleRate: number
  channels: number
  parameters: Record<string, number | string | boolean>
}

/** What the transform returns (via Worker postMessage) */
export interface TransformOutputData {
  outputId: string
  annotations: Array<{
    time: number
    duration?: number
    value?: number
    label?: string
    confidence?: number
  }>
}
```

### Transform Registry (`src/lib/transform-registry.ts`)

```ts
/** Register a transform worker */
export function registerTransform(descriptor: TransformDescriptor, workerFactory: () => Worker): void

/** Get all registered transforms */
export function getTransforms(category?: string): TransformDescriptor[]

/** Run a transform */
export function runTransform(
  transformId: string,
  input: TransformInput,
  onFeature: (outputId: string, data: TransformOutputData) => void,
  onComplete: () => void,
  onError: (error: string) => void
): { abort: () => void }
```

### Built-in Transforms (port existing analysis to this interface)

| Transform | Category | Output Type | Existing Code |
|---|---|---|---|
| YIN Pitch Detector | pitch | value | `pitch-detector.ts` |
| HNR Estimator | spectral | value | `vocal-analyzer.ts:computeHNR()` |
| Vibrato Detector | pitch | region | `vocal-analyzer.ts:detectVibrato()` |
| Onset Detector | time | instant | Phase 4.1 |
| Key Detector | key | instant | Phase 4.2 |
| MATCH Aligner | time | value (warp) | Phase 4.3 |
| Chord Detector | key | instant | Phase 5.1 |
| Segmenter | structure | region | Phase 5.2 |
| Vocal Fatigue Tracker | spectral | value | `vocal-analyzer.ts:analyzeFatigue()` |

### UI: Transform Runner

**File: `src/components/TransformRunner.tsx`** (new)

- Modal/dialog listing available transforms by category.
- Search/filter transforms.
- Configure parameters before running.
- Progress bar during execution.
- Results piped to annotation layer.
- Transform output selector (which annotation layer to send results to).

### Why This Matters

This is the most architecturally significant Phase 5 feature. It:
- Decouples analysis from visualization.
- Allows parallel development (one person works on a new transform without touching the UI).
- Creates a plugin-like ecosystem in the browser.
- Mirrors SV's Vamp plugin model (the key to SV's 20-year longevity).

**Effort:** 4-5 days

---

## Files Changed

| File | Operation | Description |
|---|---|---|
| `src/lib/chord-detector.ts` | **New** | NNLS chroma + chord template matching |
| `src/lib/segmenter.ts` | **New** | SSM + novelty detection segmentation |
| `src/lib/transform-interface.ts` | **New** | Transform types and interfaces |
| `src/lib/transform-registry.ts` | **New** | Transform registration and execution |
| `src/components/TransformRunner.tsx` | **New** | Transform launcher UI |
| `src/workers/chord-worker.ts` | **New** | Chord detection worker |
| `src/workers/segment-worker.ts` | **New** | Segmentation worker |
| `src/components/VocalAnalysis.tsx` | Modify | Chord, segment, transform buttons |
| `src/types/index.ts` | Modify | Transform types |

### Refactored to Transform Interface

| File | Operation | Description |
|---|---|---|
| `src/workers/spectral.worker.ts` | Modify | Register as transform |
| `src/workers/onset-worker.ts` | Modify | Register as transform |
| `src/workers/align-worker.ts` | Modify | Register as transform |

---

## Deliverables

- [ ] NNLS chroma computation + 48 chord templates
- [ ] Chord sequence output with temporal smoothing + bass detection
- [ ] Chord labels overlay on spectrogram
- [ ] Timbre feature extraction (16-dim per beat)
- [ ] Self-similarity matrix + novelty curve + checkerboard kernel
- [ ] Segment labeling (Verse/Chorus/Bridge/Intro/Outro)
- [ ] Segments rendered as colored Regions on annotation layer
- [ ] SSM thumbnail + novelty curve visualization
- [ ] Transform interface types + registry
- [ ] TransformRunner UI (search, configure, run, progress)
- [ ] 9 built-in transforms registered
- [ ] Tests: chord detector on synth chords, segmenter on known structures, transform interface

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Chord detection accuracy is inherently limited without deep learning | Label as "experimental"; show confidence; let users correct |
| Segmentation may over-segment complex songs | Min segment duration constraint; user-adjustable sensitivity |
| SSM computation is O(n²) for n beats | Subsample beats for songs >5 minutes; process in worker |
| Transform interface adds abstraction overhead | Keep lightweight; transforms are just Worker wrappers, minimal boilerplate |
| Adoption of transform interface | Ship 9 useful transforms at launch so the interface has immediate value |
