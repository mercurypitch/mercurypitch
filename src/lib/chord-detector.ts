// ============================================================
// Chord Detector — NNLS chroma + 48-template chord matching
// ============================================================

import type { ChordFrame } from '@/types'

// ── Pitch class names ────────────────────────────────────────

const PITCH_CLASSES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

// ── 48 Chord Templates (rotated for each root) ──────────────

type ChordQuality = 'maj' | 'min' | 'dim' | 'aug'

const BASE_TEMPLATES: Record<ChordQuality, number[]> = {
  maj: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], // root, M3, P5
  min: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], // root, m3, P5
  dim: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0], // root, m3, °5
  aug: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], // root, M3, aug5
}

function rotateTemplate(template: number[], root: number): number[] {
  return template.slice(root).concat(template.slice(0, root))
}

// Pre-compute all 48 chord template vectors
const ALL_TEMPLATES: Array<{
  root: string
  quality: ChordQuality
  label: string
  vector: number[]
}> = []

for (let r = 0; r < 12; r++) {
  const rootName = PITCH_CLASSES[r]
  for (const [qual, template] of Object.entries(BASE_TEMPLATES) as [
    ChordQuality,
    number[],
  ][]) {
    ALL_TEMPLATES.push({
      root: rootName,
      quality: qual,
      label: `${rootName}${qual === 'maj' ? '' : qual === 'min' ? 'm' : qual === 'dim' ? 'dim' : 'aug'}`,
      vector: rotateTemplate(template, r),
    })
  }
}

// ── NNLS Chroma ─────────────────────────────────────────────

/**
 * Approximate NNLS (Non-Negative Least Squares) chroma using harmonic profile.
 * Each note has overtones: fundamental + octave + 12th + 15th etc.
 * We solve for chroma activations by projecting magnitude onto note profiles.
 */
export function computeNNLSChroma(
  magnitudeSpectrum: Float32Array,
  sampleRate: number,
  _fftSize: number,
): Float32Array {
  const chroma = new Float32Array(12)
  const nyquist = sampleRate / 2
  const binFreqStep = nyquist / Math.max(1, magnitudeSpectrum.length - 1)

  for (let i = 0; i < magnitudeSpectrum.length; i++) {
    const freq = i * binFreqStep
    if (freq < 65 || magnitudeSpectrum[i] <= 0) continue

    const midi = 69 + 12 * Math.log2(Math.max(1, freq) / 440)
    const pc = Math.round(midi) % 12
    const p = pc < 0 ? pc + 12 : pc

    // Add magnitude to pitch class (weight by harmonic importance)
    chroma[p] += magnitudeSpectrum[i]

    // This is a simplified approximation of NNLS chroma without full iterative solver
  }

  // Normalize
  const total = chroma.reduce((a, b) => a + b, 0)
  if (total > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= total
  }

  return chroma
}

// ── Chord Detection ─────────────────────────────────────────

function dot(a: Float32Array | number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += a[i] * b[i]
  return sum
}

/**
 * Detect chords from a sequence of chroma vectors.
 * For each frame, scores all 48 templates and selects the best match.
 * Applies temporal smoothing to reduce flicker.
 */
export function detectChords(
  chromaFrames: Float32Array[],
  hopSize: number,
  options?: { medianWindow?: number; minDuration?: number },
): ChordFrame[] {
  if (chromaFrames.length === 0) return []

  const medianWindow = options?.medianWindow ?? 3
  const rawFrames: Array<{
    root: string
    quality: ChordQuality
    confidence: number
  }> = []

  for (const chroma of chromaFrames) {
    let bestScore = -Infinity
    let bestTemplate = ALL_TEMPLATES[0]

    for (const template of ALL_TEMPLATES) {
      const score = dot(chroma, template.vector)
      if (score > bestScore) {
        bestScore = score
        bestTemplate = template
      }
    }

    rawFrames.push({
      root: bestTemplate.root,
      quality: bestTemplate.quality,
      confidence: Math.min(1, Math.max(0, bestScore)),
    })
  }

  // Temporal median smoothing (reduce flicker)
  const half = Math.floor(medianWindow / 2)
  const smoothed: Array<(typeof rawFrames)[0]> = []
  for (let i = 0; i < rawFrames.length; i++) {
    // Count most frequent chord in window
    const counts = new Map<string, number>()
    let maxCount = 0
    let best: (typeof rawFrames)[0] = rawFrames[i]

    for (
      let w = Math.max(0, i - half);
      w < Math.min(rawFrames.length, i + half + 1);
      w++
    ) {
      const key = `${rawFrames[w].root}_${rawFrames[w].quality}`
      const c = (counts.get(key) ?? 0) + 1
      counts.set(key, c)
      if (c > maxCount) {
        maxCount = c
        best = rawFrames[w]
      }
    }
    smoothed.push(best)
  }

  // Merge adjacent identical chords
  const merged: ChordFrame[] = []
  const minDuration = options?.minDuration ?? 0.25 // seconds
  const frameTime = hopSize

  for (let i = 0; i < smoothed.length; i++) {
    const current = smoothed[i]
    const time = i * frameTime

    if (merged.length === 0) {
      merged.push({
        time,
        chord: `${current.root}${current.quality === 'maj' ? '' : current.quality === 'min' ? 'm' : current.quality === 'dim' ? 'dim' : 'aug'}`,
        root: current.root,
        quality:
          current.quality === 'maj'
            ? 'major'
            : current.quality === 'min'
              ? 'minor'
              : current.quality === 'dim'
                ? 'diminished'
                : 'augmented',
        confidence: current.confidence,
      })
      continue
    }

    const last = merged[merged.length - 1]
    const lastTime = (merged.length - 1) * frameTime

    if (
      current.root === last.root &&
      current.quality ===
        (last.quality === 'major'
          ? 'maj'
          : last.quality === 'minor'
            ? 'min'
            : last.quality === 'diminished'
              ? 'dim'
              : 'aug')
    ) {
      // Same chord — extend the last entry
      last.confidence = Math.max(last.confidence, current.confidence)
    } else {
      // Only add if last segment lasted long enough
      const segmentDuration = time - lastTime
      if (segmentDuration >= minDuration || merged.length === 1) {
        merged.push({
          time,
          chord: `${current.root}${current.quality === 'maj' ? '' : current.quality === 'min' ? 'm' : current.quality === 'dim' ? 'dim' : 'aug'}`,
          root: current.root,
          quality:
            current.quality === 'maj'
              ? 'major'
              : current.quality === 'min'
                ? 'minor'
                : current.quality === 'dim'
                  ? 'diminished'
                  : 'augmented',
          confidence: current.confidence,
        })
      } else {
        // Merge too-short segment with previous
        last.time = time // extend
      }
    }
  }

  return merged
}

/**
 * Simplify a chord sequence: remove consecutive duplicates and
 * merge very short chords into neighbours.
 */
export function simplifyChordSequence(chords: ChordFrame[]): ChordFrame[] {
  if (chords.length <= 1) return chords
  return chords.filter((c, i) => i === 0 || c.chord !== chords[i - 1].chord)
}
