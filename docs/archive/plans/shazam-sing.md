# Shazam Sing — Client-Side Melody Matching

**Branch**: `feat/shazam-sing`
**Status**: Planning
**Scope**: Pitch a melody by singing → app matches against local melody library → open in karaoke stem mixer

---

## Overview

The user sings (or hums/whistles) into the microphone. The app captures the pitch contour, compresses it into a melody fingerprint, and matches it against the 32+ seeded melodies in the local library using Dynamic Time Warping (DTW). Matching results are shown in a results list ranked by confidence. The user picks a match (or auto-select if confidence ≥ threshold) and jumps directly to the Stem Mixer view with that melody loaded for karaoke playback.

Everything runs **client-side only**. No server, no API calls.

## Integration Point: UVR/Karaoke Tab

The feature lives as a new view inside the existing UVR/Karaoke panel (`UvrPanel.tsx`). The flow:

```
UPLOAD → PROCESSING → RESULTS → MIXER    (existing views)
                              ↑
                    ┌─────────┘
                    │
              SHOW MATCHES ──→ MIXER (with selected melody)
                    ↑
              SHOW SUGGESTIONS
                    ↑
            ┌─── SHOW LISTENING ───┐
            │                      │
    I sing → app listens → app suggests songs → jump to mixer
```

When no audio file is uploaded (fresh tab load), the UVR panel defaults to showing the **Shazam Sing interface** instead of the upload view. When the user has an audio file loaded, the existing upload → process → results → mixer pipeline runs as before.

---

## Phase 1: Melody Feature Extraction & Indexing

**Goal**: Preprocess every melody in the library into a pitch-feature fingerprint optimized for fast client-side matching.

### 1.1 Fingerprint Generation

For each melody in `melodyStore`, generate a fingerprint:

```ts
interface MelodyFingerprint {
  melodyId: string
  name: string
  /** Normalized pitch sequence (semitones from C0, MIDI-aligned) */
  pitchSequence: number[]
  /** Inter-onset intervals in seconds (or null for single-note melodies) */
  ioiSequence: number[]
  /** Duration of each note in seconds */
  durations: number[]
  /** Total duration in seconds */
  durationSec: number
  /** Number of notes */
  noteCount: number
  /** Octave-invariant pitch contour (mod 12) for octave-agnostic matching */
  chromaSequence: number[]
  /** Interval contour (delta between consecutive notes) for transposition-invariant matching */
  intervalSequence: number[]
}
```

### 1.2 Fingerprint Store

Create `src/lib/melody-fingerprints.ts`:
- `buildFingerprint(melody: MelodyData): MelodyFingerprint` — extract all sequence representations
- `fingerprintIndex: Map<string, MelodyFingerprint>` — in-memory index
- `buildIndex(): void` — iterate all melodies, build fingerprints, populate index
- Called on app init and whenever the melody library changes (save/delete/import)

### 1.3 Storage

Fingerprints are **derived data** — they don't need separate persistence. Rebuild on every app init from the melody library in localStorage. For 32 melodies, this is near-instant (< 10ms).

**Deliverables**:
- `src/lib/melody-fingerprints.ts`
- Unit tests: `src/lib/__tests__/melody-fingerprints.test.ts`

---

## Phase 2: Real-Time Pitch Tracking & Buffering

**Goal**: Capture a continuous pitch contour from the microphone, buffer it, detect when the user has stopped singing, and segment the contour into discrete note events.

### 2.1 Existing Pitch Detection

The codebase already has `src/lib/pitch-detector.ts` with:
- YIN algorithm (good for monophonic singing)
- MPM (faster, less accurate)
- SwiftF0 (ONNX ML, most accurate but heavier)
- Output: `{ frequency, clarity, noteName, octave, cents }`

**What we reuse**: YIN as default (best accuracy/performance tradeoff for singing).

### 2.2 Note Onset Detection (`src/lib/onset-detector.ts`)

**This does NOT exist yet.** We need to build it.

Approach: **Spectral flux onset detection** in the time domain on the pitch contour:
- Track `clarity` from the pitch detector — when clarity drops below a threshold for > 200ms, treat as note boundary
- Track pitch stability — when pitch stabilizes (±50 cents) after a change, treat as a new note
- Track amplitude envelope — when amplitude drops below silence threshold for > 300ms, treat as end of phrase

```ts
interface OnsetEvent {
  time: number           // seconds from start of capture
  type: 'note-start' | 'note-change' | 'silence' | 'end-of-phrase'
  confidence: number     // 0–1
}

function detectOnsets(
  pitchFrames: PitchResult[],  // from continuous pitch detector
  sampleRate: number
): OnsetEvent[]
```

### 2.3 Live Capture Buffer (`src/lib/live-pitch-buffer.ts`)

```ts
interface LivePitchBuffer {
  /** Start capturing pitch from mic */
  start(): void
  /** Stop capturing */
  stop(): LivePitchContour
  /** Current buffer state */
  getState(): 'idle' | 'listening' | 'processing'
  /** Duration captured so far */
  getElapsed(): number
}

interface LivePitchContour {
  frames: PitchResult[]      // raw pitch frames
  onsets: OnsetEvent[]       // detected note boundaries
  durationSec: number
  /** Extracted pitch sequence (after onset segmentation) */
  noteSequence: number[]     // MIDI numbers
  /** Inter-onset intervals */
  ioiSequence: number[]
  noteDurations: number[]
}
```

### 2.4 UI State — Listening View

A new `ShazamListen` component inside UvrPanel:
- Large microphone button (tap to start listening)
- Live pitch visualization (simple scrolling pitch trace)
- Auto-stop after 3 seconds of silence post-singing
- Manual stop button
- Visual feedback: "Listening...", "Processing...", recording duration

**Deliverables**:
- `src/lib/onset-detector.ts`
- `src/lib/live-pitch-buffer.ts`
- `src/components/ShazamListen.tsx` + CSS module
- Unit tests for onset detection

---

## Phase 3: DTW Matching Engine

**Goal**: Match a captured pitch contour against all melody fingerprints and return ranked results.

### 3.1 DTW Implementation (`src/lib/dtw.ts`)

Classic Dynamic Time Warping with Sakoe-Chiba band constraint for performance:

```ts
interface DtwResult {
  /** DTW distance (lower = better match) */
  distance: number
  /** Normalized distance (0–1, 0 = perfect match) */
  normalizedDistance: number
  /** Warp path: array of [queryIndex, referenceIndex] pairs */
  path: [number, number][]
}

function dtwMatch(
  query: number[],
  reference: number[],
  bandWidth?: number   // Sakoe-Chiba constraint, default 10% of max length
): DtwResult
```

### 3.2 Multi-Feature Scoring (`src/lib/melody-matcher.ts`)

Match against multiple feature representations and combine scores:

```ts
interface MatchCandidate {
  melodyId: string
  name: string
  /** 0–100 confidence score */
  confidence: number
  /** Individual feature scores for transparency */
  breakdown: {
    pitchScore: number       // DTW on pitchSequence (semitones)
    intervalScore: number    // DTW on intervalSequence (transposition-invariant)
    chromaScore: number      // DTW on chromaSequence (octave-invariant)
    rhythmScore: number      // DTW on IOI+durations
    lengthBonus: number      // Bonus for similar note count
  }
  /** Best match position (for displaying partial matches) */
  matchStart: number
  matchEnd: number
}

function matchPitchContour(
  contour: LivePitchContour,
  fingerprints: MelodyFingerprint[],
  options?: { minConfidence?: number; maxResults?: number }
): MatchCandidate[]
```

### 3.3 Scoring Weights (Tunable)

```
finalConfidence = 
  0.35 * pitchScore +       // Absolute pitch matters most
  0.25 * intervalScore +    // But also work transposition-invariant
  0.15 * chromaScore +      // Octave-invariant for humming
  0.15 * rhythmScore +      // Rhythm is a decent discriminator
  0.10 * lengthBonus        // Similar-length melodies preferred
```

### 3.4 Early Termination

Skip fingerprints with > 2x note count difference or wildly different total durations (factor > 3).

**Deliverables**:
- `src/lib/dtw.ts`
- `src/lib/melody-matcher.ts`
- Unit tests for DTW and matcher with synthetic contours

---

## Phase 4: UI Integration

**Goal**: Wire the full flow into the UVR/Karaoke tab.

### 4.1 New UvrPanel Views

Add two new views to the `UvrView` type:

```ts
export type UvrView = 
  | 'upload' | 'processing' | 'results' | 'mixer'   // existing
  | 'shazam-listen' | 'shazam-results'                // new
```

### 4.2 ShazamListen Component (`src/components/ShazamListen.tsx`)

**Layout** (reuses the UvrPanel card shell):
```
┌──────────────────────────────────────┐
│         🎤 Shazam Sing               │
│                                      │
│         [Large Mic Button]           │
│                                      │
│    Tap to start singing/humming      │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Live pitch trace (canvas)     │  │
│  │  scrolling right to left       │  │
│  └────────────────────────────────┘  │
│                                      │
│         ⏱ 0:04 elapsed              │
│                                      │
│    [Stop & Match]    [Cancel]        │
└──────────────────────────────────────┘
```

- Mic button: calls `LivePitchBuffer.start()`, animates while listening
- Pitch trace: simple canvas rendering pitch frequency over time
- Stop & Match: calls `LivePitchBuffer.stop()`, passes contour to `matchPitchContour()`, switches to results view
- Cancel: returns to default upload view

### 4.3 ShazamResults Component (`src/components/ShazamResults.tsx`)

```
┌──────────────────────────────────────┐
│  🔍 Matches for your singing         │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ★ 94%  Twinkle Twinkle        │  │  ← auto-highlighted if ≥ threshold
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  │
│  │ [Open in Mixer] [Preview]      │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │   72%  Mary Had a Little Lamb │  │
│  │ ░░░░░░░░░░░░░░░░░░░░░        │  │
│  │ [Open in Mixer] [Preview]      │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │   45%  Happy Birthday          │  │
│  │ ░░░░░░░░░░                     │  │
│  │ [Open in Mixer] [Preview]      │  │
│  └────────────────────────────────┘  │
│                                      │
│  [Try Again]                         │
└──────────────────────────────────────┘
```

### 4.4 Jump to Stem Mixer

When a match is selected:
1. Load the melody into the practice/editor state
2. If the user has no uploaded audio: prompt to upload a track for karaoke, or jump to mixer with "no stems" mode (instrument preview only)
3. If the user already has separated stems: jump directly to mixer view with that melody active
4. Pass the melody as the "active track" context to StemMixer

### 4.5 UvrPanel Tab Default Behavior

When the UVR/Karaoke tab is selected and **no audio file is loaded**:
- Show the Shazam Listen view instead of the upload view
- Add a small "Upload audio instead" link at the bottom to switch to upload view
- When an audio file IS loaded, show the existing upload view as before

**Deliverables**:
- `src/components/ShazamListen.tsx` + `ShazamListen.module.css`
- `src/components/ShazamResults.tsx` + `ShazamResults.module.css`
- Updated `src/components/UvrPanel.tsx` with new views and routing
- E2E tests: `src/e2e/shazam-sing.spec.ts`

---

## Phase 5: Auto-Mode & Confidence Scoring

**Goal**: When auto-mode is enabled, skip the results list and jump directly to the mixer if the top match exceeds the confidence threshold.

### 5.1 Auto-Mode Toggle

A toggle in the Shazam Listen view:
```
[Auto-select best match]  ● ON / ○ OFF
Threshold: [━━━━━●━━━━━] 85%
```

Stored in localStorage: `pitchperfect_shazam_auto` and `pitchperfect_shazam_threshold`.

### 5.2 Confidence Thresholds

| Confidence | Action |
|---|---|
| ≥ 95% | Auto-accept, jump to mixer immediately |
| 85–94% | Auto-accept (if auto-mode on), otherwise show results with top match highlighted |
| 60–84% | Show results list, top match suggested but not auto-selected |
| 40–59% | Show results with "low confidence" warning |
| < 40% | Show "No confident match found" with option to try again |

### 5.3 Confidence Refinement

- **Partial matching**: If the user sings only part of a melody (e.g., the chorus), the DTW subsequence matching should still find it. Use open-begin/end DTW variant.
- **Humming normalization**: Strip octave information and match chroma only when pitchScore is low but chromaScore is high (indicates humming without accurate pitch).
- **Tempo normalization**: Apply simple tempo ratio estimation before DTW to handle faster/slower singing.

**Deliverables**:
- Auto-mode toggle UI in `ShazamListen`
- Subsequence DTW variant in `src/lib/dtw.ts`
- Tempo normalization in `src/lib/melody-matcher.ts`

---

## Technical Constraints (Client-Side Only)

| Constraint | Impact |
|---|---|
| No server | All matching in main thread or Web Worker |
| DTW O(n×m) | With 32 melodies × avg 20 notes, matching is ~640 DTW computations. With Sakoe-Chiba band (10%), each DTW is ~40×40 = 1600 ops. Total: ~1M operations < 50ms on modern hardware. No worker needed. |
| Pitch detection | Already exists (YIN). Reuse directly. |
| Stem separation | Already exists (ONNX worker). No changes needed. |
| Melody library | 32 seeded melodies in localStorage. Fingerprints rebuilt on init. |
| No onset detection | Must build from scratch. |

---

## File Manifest

| File | Status | Phase |
|---|---|---|
| `src/lib/dtw.ts` | NEW | 3 |
| `src/lib/melody-matcher.ts` | NEW | 3 |
| `src/lib/melody-fingerprints.ts` | NEW | 1 |
| `src/lib/onset-detector.ts` | NEW | 2 |
| `src/lib/live-pitch-buffer.ts` | NEW | 2 |
| `src/components/ShazamListen.tsx` | NEW | 4 |
| `src/components/ShazamListen.module.css` | NEW | 4 |
| `src/components/ShazamResults.tsx` | NEW | 4 |
| `src/components/ShazamResults.module.css` | NEW | 4 |
| `src/components/UvrPanel.tsx` | MODIFY | 4 |
| `src/types/index.ts` | MODIFY | 1–3 |
| `src/e2e/shazam-sing.spec.ts` | NEW | 4 |

---

## Execution Order

1. **Phase 1 → Phase 2 → Phase 3**: Foundation (no UI visible yet, all testable in isolation)
2. **Phase 4**: UI integration (makes the feature visible and testable end-to-end)
3. **Phase 5**: Polish (auto-mode, confidence tuning)

Phases 1–3 can be developed and tested independently before any UI work begins.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| DTW too slow for large libraries | Early termination filters, Sakoe-Chiba band constraint, Web Worker fallback |
| Poor match accuracy with humming | Multi-feature scoring with chroma/invariant representations |
| Onset detection unreliable | Fallback: fixed-duration segmentation or manual "tap to mark notes" mode |
| Mic permission denied | Graceful error state with instructions |
| User sings unknown melody | Clear "no match found" UX with try-again flow |
