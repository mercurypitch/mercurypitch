// ============================================================
// Structural Segmenter — SSM + novelty detection
// ============================================================

import type { Segment, SegmentationResult } from '@/types'

// ── Timbre Features ──────────────────────────────────────────

/**
 * Compute a compact timbre feature vector from a magnitude spectrum.
 * Extracts: spectral centroid, spread, rolloff, flux proxy, and
 * 12 bandwise energy values → 16 dimensions total.
 */
export function computeTimbreFeatures(
  magnitudeSpectrum: Float32Array,
  _sampleRate: number,
): Float32Array {
  const features = new Float32Array(16)
  if (magnitudeSpectrum.length < 2) return features

  const n = magnitudeSpectrum.length
  const nyquistBin = n - 1

  // 1. Spectral centroid (normalized 0-1)
  let weightedSum = 0
  let totalMag = 0
  for (let i = 0; i < n; i++) {
    weightedSum += i * magnitudeSpectrum[i]
    totalMag += magnitudeSpectrum[i]
  }
  features[0] = totalMag > 0 ? weightedSum / (totalMag * nyquistBin) : 0

  // 2. Spectral spread (variance around centroid)
  let spread = 0
  for (let i = 0; i < n; i++) {
    spread += magnitudeSpectrum[i] * (i / nyquistBin - features[0]) ** 2
  }
  features[1] = totalMag > 0 ? Math.sqrt(spread / totalMag) : 0

  // 3. Spectral rolloff (bin where 85% of energy is below)
  const threshold = totalMag * 0.85
  let cumSum = 0
  let rolloffIdx = 0
  for (let i = 0; i < n; i++) {
    cumSum += magnitudeSpectrum[i]
    if (cumSum >= threshold) {
      rolloffIdx = i
      break
    }
  }
  features[2] = rolloffIdx / nyquistBin

  // 4. Rough flux proxy (energy concentration)
  features[3] = totalMag / Math.max(1, n)

  // 5-16. Bandwise energy (12 frequency bands, log-spaced)
  const bands = 12
  for (let b = 0; b < bands; b++) {
    // Map to FFT bins using proportional spacing (approximate log scale)
    const binLow = Math.floor((b / bands) * n)
    const binHigh = Math.floor(((b + 1) / bands) * n)
    let bandEnergy = 0
    for (let j = binLow; j < binHigh && j < n; j++) {
      bandEnergy += magnitudeSpectrum[j]
    }
    features[4 + b] = bandEnergy / Math.max(1, binHigh - binLow)
  }

  // Normalize features to unit norm
  let norm = 0
  for (let i = 0; i < 16; i++) norm += features[i] * features[i]
  if (norm > 0) {
    const inv = 1 / Math.sqrt(norm)
    for (let i = 0; i < 16; i++) features[i] *= inv
  }

  return features
}

// ── Cosine Similarity ───────────────────────────────────────

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0,
    na = 0,
    nb = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom > 1e-10 ? Math.max(-1, Math.min(1, dot / denom)) : 0
}

// ── Checkerboard Kernel ─────────────────────────────────────

/**
 * Build a 2D Gaussian-tapered checkerboard kernel of the given size.
 * Positive values along the diagonal, negative off-diagonal.
 * Used to detect novelty (change points) in the self-similarity matrix.
 */
function checkerboardKernel(size: number): number[] {
  const kernel: number[] = []
  const half = Math.floor(size / 2)
  const sigma = size / 6 // Gaussian width

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const x = i - half
      const y = j - half
      const gauss = Math.exp(-(x * x + y * y) / (2 * sigma * sigma))
      // Checkerboard sign: positive when x and y are on same side
      const sign = x * y >= 0 ? 1 : -1
      kernel.push(gauss * sign)
    }
  }
  return kernel
}

// ── Self-Similarity Matrix ──────────────────────────────────

function buildSSM(features: Float32Array[]): Float32Array {
  const n = features.length
  const ssm = new Float32Array(n * n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      const sim = cosineSimilarity(features[i], features[j])
      ssm[i * n + j] = sim
      ssm[j * n + i] = sim
    }
  }
  return ssm
}

// ── Novelty Detection ───────────────────────────────────────

function computeNoveltyCurve(
  ssm: Float32Array,
  n: number,
  kernelSize: number,
): Float32Array {
  const kernel = checkerboardKernel(kernelSize)
  const kSize = kernelSize
  const half = Math.floor(kSize / 2)
  const novelty = new Float32Array(n)

  // Convolve kernel along the SSM diagonal
  for (let t = half; t < n - half; t++) {
    let sum = 0
    for (let i = 0; i < kSize; i++) {
      for (let j = 0; j < kSize; j++) {
        const ri = t - half + i
        const rj = t - half + j
        if (ri >= 0 && ri < n && rj >= 0 && rj < n) {
          sum += ssm[ri * n + rj] * kernel[i * kSize + j]
        }
      }
    }
    novelty[t] = Math.max(0, sum)
  }

  // Normalize to 0-1
  let maxVal = 0
  for (let i = 0; i < n; i++) if (novelty[i] > maxVal) maxVal = novelty[i]
  if (maxVal > 0) {
    for (let i = 0; i < n; i++) novelty[i] /= maxVal
  }

  return novelty
}

// ── Peak Detection ──────────────────────────────────────────

function findNoveltyPeaks(novelty: Float32Array, threshold: number): number[] {
  const peaks: number[] = []
  for (let i = 1; i < novelty.length - 1; i++) {
    if (
      novelty[i] > threshold &&
      novelty[i] > novelty[i - 1] &&
      novelty[i] >= novelty[i + 1]
    ) {
      peaks.push(i)
    }
  }
  return peaks
}

// ── Segment Labeling ────────────────────────────────────────

/**
 * Assign labels to segments based on repetition patterns.
 * Heuristic: most frequent segment = "Chorus", before first Chorus = "Verse",
 * first segment if quiet = "Intro", last if distinct = "Outro", others "Bridge".
 */
function labelSegments(
  segments: Array<{ start: number; end: number; features: Float32Array }>,
): Segment[] {
  if (segments.length <= 1) {
    return segments.map((s) => ({
      startTime: s.start,
      endTime: s.end,
      label: 'Verse',
      confidence: 0.3,
    }))
  }

  // Cluster segments by similarity
  const clusters: Map<number, number[]> = new Map()
  const threshold = 0.7

  for (let i = 0; i < segments.length; i++) {
    let assigned = false
    for (let j = 0; j < i; j++) {
      const sim = cosineSimilarity(segments[i].features, segments[j].features)
      if (sim > threshold) {
        // Find which cluster j belongs to
        for (const [, members] of clusters) {
          if (members.includes(j)) {
            members.push(i)
            assigned = true
            break
          }
        }
        if (!assigned) {
          clusters.set(j, [j, i])
          assigned = true
        }
        break
      }
    }
    if (!assigned) {
      clusters.set(i, [i])
    }
  }

  // Find the cluster with most members → Chorus
  let chorusCluster = -1
  let maxMembers = 0
  for (const [cid, members] of clusters) {
    if (members.length > maxMembers) {
      maxMembers = members.length
      chorusCluster = cid
    }
  }

  // Build labels
  const labeled: number[] = new Array(segments.length).fill(-1) // -1 = unlabeled
  if (chorusCluster >= 0) {
    for (const m of clusters.get(chorusCluster) ?? []) {
      labeled[m] = 0 // Chorus
    }
    // Chorus cluster size tracked for future confidence weighting
  }

  // First segment before first chorus → Verse
  const firstChorus = labeled.indexOf(0)
  if (firstChorus > 0) {
    for (let i = 0; i < firstChorus; i++) {
      if (labeled[i] < 0) {
        labeled[i] = 1 // Verse
        // tracked for future confidence weighting
      }
    }
  }

  // Last segment → Outro (if unlabeled and not the only segment)
  if (labeled[labeled.length - 1] < 0 && segments.length > 2) {
    labeled[labeled.length - 1] = 2 // Outro
  }

  // First segment → Intro (if unlabeled)
  if (labeled[0] < 0) {
    labeled[0] = 3 // Intro
  }

  // Remaining → Bridge
  for (let i = 0; i < labeled.length; i++) {
    if (labeled[i] < 0) {
      labeled[i] = 4 // Bridge
      // tracked for future confidence weighting
    }
  }

  const labelNames = ['Chorus', 'Verse', 'Outro', 'Intro', 'Bridge']

  return segments.map((s, i) => ({
    startTime: s.start,
    endTime: s.end,
    label: labelNames[labeled[i]] ?? 'Unknown',
    confidence: 0.5 + 0.3 * (maxMembers / Math.max(1, segments.length)),
  }))
}

// ── Main Segmentation ───────────────────────────────────────

/**
 * Segment audio into structural sections (Verse, Chorus, etc.)
 * using self-similarity matrix and novelty detection.
 */
export function segmentAudio(
  magnitudeSpectra: Float32Array[],
  sampleRate: number,
  hopSize: number,
  options?: { minSegmentDuration?: number; maxSegments?: number },
): SegmentationResult {
  if (magnitudeSpectra.length < 10) {
    return { segments: [], labels: [], noveltyCurve: new Float32Array(0) }
  }

  // 1. Extract timbre features
  const features = magnitudeSpectra.map((s) =>
    computeTimbreFeatures(s, sampleRate),
  )
  const n = features.length

  // 2. Build self-similarity matrix
  const ssm = buildSSM(features)

  // 3. Compute novelty curve
  const kernelSize = Math.min(21, Math.floor(n / 3))
  const oddKernel = kernelSize % 2 === 0 ? kernelSize + 1 : kernelSize
  const novelty = computeNoveltyCurve(ssm, n, Math.max(3, oddKernel))

  // 4. Find peaks (structural boundaries)
  const threshold = Math.max(
    0.15,
    (novelty.reduce((a, b) => a + b, 0) / n) * 1.5,
  )
  const peaks = findNoveltyPeaks(novelty, threshold)

  // 5. Build segments from peaks
  const frameTime = hopSize / sampleRate
  const minDuration = options?.minSegmentDuration ?? 4 // seconds
  const minFrames = Math.max(
    2,
    Math.round((minDuration * sampleRate) / hopSize),
  )

  const rawSegments: Array<{
    start: number
    end: number
    features: Float32Array
  }> = []
  let lastIdx = 0
  for (const peak of peaks) {
    if (peak - lastIdx >= minFrames) {
      rawSegments.push({
        start: lastIdx * frameTime,
        end: peak * frameTime,
        features: features[Math.floor((lastIdx + peak) / 2)],
      })
      lastIdx = peak
    }
  }
  // Final segment
  if (n - lastIdx >= minFrames / 2) {
    rawSegments.push({
      start: lastIdx * frameTime,
      end: (n - 1) * frameTime,
      features: features[Math.floor((lastIdx + n - 1) / 2)],
    })
  }

  // Max segments constraint
  const maxSeg = options?.maxSegments ?? 12
  const trimmed = rawSegments.slice(0, maxSeg)

  // 6. Label segments
  const segments = labelSegments(trimmed)
  const labels = [...new Set(segments.map((s) => s.label))]

  return { segments, labels, noveltyCurve: novelty }
}
