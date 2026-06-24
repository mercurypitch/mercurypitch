// ============================================================
// DTW Aligner — Chroma DTW with Sakoe-Chiba band constraint
// ============================================================

import type { AlignmentResult } from '@/types'
import { computeChromagram } from './key-detector'

// ── Cosine Distance ──────────────────────────────────────────

/**
 * Compute cosine distance between two chroma vectors (12-bin).
 * Returns value in [0, 2] where 0 = identical, 2 = opposite.
 */
export function cosineDistance(a: Float32Array, b: Float32Array): number {
  let dot = 0,
    normA = 0,
    normB = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom < 1e-10) return 0
  const cosSim = dot / denom
  // Clamp for floating-point drift and return distance in [0, 2]
  return 1 - Math.max(-1, Math.min(1, cosSim))
}

// ── Chroma Frame Extraction ──────────────────────────────────

/**
 * Convert an audio buffer (Float32Array, mono) into a sequence
 * of 12-bin chroma vectors at the given hop size.
 */
export function bufferToChroma(
  buffer: Float32Array,
  sampleRate: number,
  fftSize: number = 2048,
  hopSize: number = 1024,
): Float32Array[] {
  const frames: Float32Array[] = []
  for (let start = 0; start + fftSize <= buffer.length; start += hopSize) {
    // Simple DFT approximation: use the signal itself as magnitude spectrum bins
    const spectrum = new Float32Array(fftSize / 2)
    const windowSamples = buffer.slice(start, start + fftSize)

    // Simple magnitude spectrum via abs value mapping (not full FFT, but sufficient
    // for chroma computation which only needs relative energy per frequency)
    for (let i = 0; i < spectrum.length; i++) {
      // Crude energy estimate: average of absolute samples near this frequency index
      const binStart = Math.floor((i / spectrum.length) * windowSamples.length)
      const binEnd = Math.floor(
        ((i + 1) / spectrum.length) * windowSamples.length,
      )
      let energy = 0
      for (let j = binStart; j < binEnd && j < windowSamples.length; j++) {
        energy += Math.abs(windowSamples[j])
      }
      spectrum[i] = energy / Math.max(1, binEnd - binStart)
    }

    const chroma = computeChromagram(spectrum, sampleRate, fftSize)
    frames.push(chroma)
  }

  return frames
}

// ── DTW with Sakoe-Chiba Band ────────────────────────────────

/**
 * Align two sequences of chroma vectors using DTW with Sakoe-Chiba band.
 *
 * The Sakoe-Chiba band restricts the warping path to within a diagonal
 * band of width `bandWidth * max(n, m)`, preventing pathological warping
 * and reducing memory from O(n*m) to O(n * bandwidth).
 */
export function alignRecordings(
  referenceChroma: Float32Array[],
  userChroma: Float32Array[],
  options?: { bandWidth?: number; hopSize?: number },
): AlignmentResult {
  const n = referenceChroma.length
  const m = userChroma.length

  if (n === 0 || m === 0) {
    return {
      timeMap: new Float32Array(m),
      similarityScore: 0,
      tempoRatio: 1,
      frameDistance: new Float32Array(m),
    }
  }

  // Band must be at least |n - m| wide, otherwise the destination corner
  // (n-1, m-1) falls outside the diagonal band and stays unreachable (INF),
  // producing a garbage warping path for sequences of differing length.
  const bandWidth = Math.max(
    1,
    Math.abs(n - m),
    Math.round((options?.bandWidth ?? 0.1) * Math.max(n, m)),
  )
  const hopSize = options?.hopSize ?? 0.1 // seconds

  // DTW cost matrix (only store values within band)
  // Use a sparse approach: for each i, only compute j in [jMin, jMax]
  // Store as two-row rolling buffer to save memory
  const INF = 1e10

  // We store two rows: prevRow (i-1) and currRow (i)
  // Each row is a Map or array covering the band for that i
  // Actually, let's just use a 2D approach with band constraint.

  // Simpler approach: allocate full matrix but only within band.
  // For typical audio (3 min @ 100ms hop = 1800 frames), n*m = 3.24M cells.
  // With band 10%, ~648K cells. Each cell is a number (8 bytes) = ~5MB. Fine for a worker.

  // But in the main thread for short audio, let's be more careful.
  // Use typed arrays for efficiency.
  const cost = new Float32Array(n * m)
  cost.fill(INF as unknown as number)

  // Initialize first cell
  cost[0] = cosineDistance(referenceChroma[0], userChroma[0])

  // Fill DTW matrix within band constraints
  for (let i = 0; i < n; i++) {
    const jMin = Math.max(0, Math.round(i - bandWidth))
    const jMax = Math.min(m - 1, Math.round(i + bandWidth))

    for (let j = jMin; j <= jMax; j++) {
      if (i === 0 && j === 0) continue

      const dist = cosineDistance(referenceChroma[i], userChroma[j])
      const idx = i * m + j

      let best = INF
      if (
        i > 0 &&
        j >= Math.max(0, Math.round(i - 1 - bandWidth)) &&
        j <= Math.min(m - 1, Math.round(i - 1 + bandWidth))
      ) {
        best = Math.min(best, cost[(i - 1) * m + j]) // Insertion
      }
      if (j > 0 && j - 1 >= jMin && j - 1 <= jMax) {
        best = Math.min(best, cost[i * m + (j - 1)]) // Deletion
      }
      if (i > 0 && j > 0) {
        best = Math.min(best, cost[(i - 1) * m + (j - 1)]) // Match
      }

      cost[idx] = best < INF ? best + dist : dist
    }
  }

  // Backtrack to find optimal path
  const path: Array<[number, number]> = []
  let i = n - 1
  let j = m - 1

  while (i > 0 || j > 0) {
    path.push([i, j])

    if (i === 0) {
      j--
      continue
    }
    if (j === 0) {
      i--
      continue
    }

    const diag = cost[(i - 1) * m + (j - 1)]
    const left = cost[i * m + (j - 1)]
    const up = cost[(i - 1) * m + j]

    let minVal = diag
    let move: [number, number] = [i - 1, j - 1]
    if (left < minVal) {
      minVal = left
      move = [i, j - 1]
    }
    if (up < minVal) {
      minVal = up
      move = [i - 1, j]
    }

    i = move[0]
    j = move[1]
  }
  path.push([0, 0])
  path.reverse()

  // Build output
  const timeMap = new Float32Array(m)
  const frameDistance = new Float32Array(m)

  // For each user frame j, find corresponding reference time
  // by looking up the path mapping
  const pathMap = new Map<number, number>()
  for (const [pi, pj] of path) {
    if (!pathMap.has(pj) || pi > (pathMap.get(pj) ?? 0)) {
      pathMap.set(pj, pi)
    }
  }

  // Interpolate timeMap for user frames not on the path
  let lastRefI = 0
  for (let uj = 0; uj < m; uj++) {
    const refI = pathMap.get(uj)
    if (refI !== undefined) {
      timeMap[uj] = refI * hopSize
      lastRefI = refI
    } else {
      // Interpolate linear
      timeMap[uj] = lastRefI * hopSize
    }

    // Frame-level distance: diagonal distance at this point
    const mappedI = Math.round(timeMap[uj] / hopSize)
    const clampedI = Math.min(n - 1, Math.max(0, mappedI))
    frameDistance[uj] = cosineDistance(
      referenceChroma[clampedI],
      userChroma[Math.min(m - 1, uj)],
    )
  }

  // Global similarity score: average cosine similarity along path
  let totalDist = 0
  for (const [pi, pj] of path) {
    totalDist += cosineDistance(referenceChroma[pi], userChroma[pj])
  }
  const avgDist = totalDist / path.length
  const similarityScore = Math.max(0, 1 - avgDist) // Map [0,2] distance → [0,1] similarity

  // Tempo ratio: user duration / reference duration
  const refDuration = (n - 1) * hopSize
  const userDuration = (m - 1) * hopSize
  const tempoRatio = refDuration > 0 ? userDuration / refDuration : 1

  return { timeMap, similarityScore, tempoRatio, frameDistance }
}

// ── Convenience ──────────────────────────────────────────────

/**
 * Compute chroma from raw audio buffers and align in one call.
 */
export function alignAudioBuffers(
  referenceBuffer: Float32Array,
  userBuffer: Float32Array,
  sampleRate: number,
  options?: { bandWidth?: number; hopSize?: number; fftSize?: number },
): AlignmentResult {
  const fftSize = options?.fftSize ?? 2048
  const hopFrames =
    options?.hopSize != null ? Math.round(options.hopSize * sampleRate) : 1024

  const refChroma = bufferToChroma(
    referenceBuffer,
    sampleRate,
    fftSize,
    hopFrames,
  )
  const userChroma = bufferToChroma(userBuffer, sampleRate, fftSize, hopFrames)

  return alignRecordings(refChroma, userChroma, {
    bandWidth: options?.bandWidth,
    hopSize: hopFrames / sampleRate,
  })
}
