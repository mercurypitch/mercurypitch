// ============================================================
// Dynamic Time Warping — Sequence alignment for melody matching
// Phase 3 of Shazam Sing
//
// Classic DTW with Sakoe-Chiba band constraint for performance.
// Also includes open-begin/end variant for subsequence matching
// (e.g., user sings only the chorus of a longer melody).
// ============================================================

import type { DtwResult } from './types'

/**
 * Classic DTW with Sakoe-Chiba band constraint.
 *
 * Cost is absolute difference between elements.
 * The band width limits how far the warp path can deviate from the diagonal,
 * reducing the time complexity from O(n×m) to O(bandWidth × max(n,m)).
 */
export function dtwMatch(
  query: number[],
  reference: number[],
  bandWidth?: number,
): DtwResult {
  const n = query.length
  const m = reference.length

  if (n === 0 || m === 0) {
    return { distance: Infinity, normalizedDistance: 1, path: [] }
  }

  const maxLen = Math.max(n, m)
  const band = bandWidth ?? Math.max(1, Math.ceil(maxLen * 0.1))

  // Cost matrix — use Float64Array for numeric stability
  const cost = new Float64Array(n * m)
  cost.fill(Infinity)
  cost[0] = Math.abs(query[0] - reference[0])

  // Back-pointer matrix for path reconstruction
  // 0 = diagonal, 1 = up, 2 = left
  const backptr = new Uint8Array(n * m)

  // Fill cost matrix within the Sakoe-Chiba band
  for (let i = 0; i < n; i++) {
    const bandStart = Math.max(0, i - band)
    const bandEnd = Math.min(m - 1, i + band)

    for (let j = bandStart; j <= bandEnd; j++) {
      if (i === 0 && j === 0) continue

      const d = Math.abs(query[i] - reference[j])
      const idx = i * m + j

      const diag = i > 0 && j > 0 ? cost[(i - 1) * m + (j - 1)] : Infinity
      const up = i > 0 ? cost[(i - 1) * m + j] : Infinity
      const left = j > 0 ? cost[i * m + (j - 1)] : Infinity

      let best = diag
      let bestPtr = 0 // diagonal
      if (up < best) {
        best = up
        bestPtr = 1 // up
      }
      if (left < best) {
        best = left
        bestPtr = 2 // left
      }

      cost[idx] = best + d
      backptr[idx] = bestPtr
    }
  }

  const totalCost = cost[(n - 1) * m + (m - 1)]
  if (!isFinite(totalCost)) {
    return { distance: Infinity, normalizedDistance: 1, path: [] }
  }

  // Reconstruct the warp path
  const path = reconstructPath(backptr, n, m)

  // Normalize by path length so short and long sequences are comparable
  const normalizedDistance = path.length > 0 ? totalCost / path.length : 1

  return {
    distance: totalCost,
    normalizedDistance,
    path,
  }
}

/**
 * Open-end DTW — the query can match any contiguous subsequence of
 * the reference. Useful for partial matching (user sings only part
 * of a melody). Returns the best match region.
 */
export function dtwMatchSubsequence(
  query: number[],
  reference: number[],
  bandWidth?: number,
): DtwResult & { matchEnd: number } {
  const n = query.length
  const m = reference.length

  if (n === 0 || m === 0) {
    return { distance: Infinity, normalizedDistance: 1, path: [], matchEnd: m }
  }

  const band = bandWidth ?? Math.max(1, Math.ceil(Math.max(n, m) * 0.1))

  // Accumulated cost matrix
  const cost = new Float64Array(n * m)
  cost.fill(Infinity)

  // Starting column cost
  const startCost = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    // Open-begin: low cost to start matching at the beginning
    startCost[i] = 0
  }

  // Fill accumulated cost matrix
  for (let i = 0; i < n; i++) {
    const bandStart = Math.max(0, i - band)
    const bandEnd = Math.min(m - 1, i + band)

    for (let j = bandStart; j <= bandEnd; j++) {
      const d = Math.abs(query[i] - reference[j])
      const idx = i * m + j

      let minPrev = Infinity
      if (i > 0 && j > 0) {
        minPrev = Math.min(minPrev, cost[(i - 1) * m + (j - 1)]) // diagonal
      }
      if (i > 0) {
        minPrev = Math.min(minPrev, cost[(i - 1) * m + j]) // up
        minPrev = Math.min(minPrev, startCost[i - 1]) // open-begin
      }
      if (j > 0) {
        minPrev = Math.min(minPrev, cost[i * m + (j - 1)]) // left
      }
      // Open-begin at first query element
      if (i === 0) {
        minPrev = Math.min(minPrev, 0)
      }

      cost[idx] = minPrev + d
    }
  }

  // Open-end: find the best ending position in the last row
  let bestCost = Infinity
  let matchEnd = m - 1
  const lastRow = n - 1
  for (let j = 0; j < m; j++) {
    const idx = lastRow * m + j
    if (cost[idx] < bestCost) {
      bestCost = cost[idx]
      matchEnd = j
    }
  }

  if (!isFinite(bestCost)) {
    return {
      distance: Infinity,
      normalizedDistance: 1,
      path: [],
      matchEnd: m,
    }
  }

  // Backtrace from (n-1, matchEnd) to find the path
  const backptr = computeBackpointers(cost, n, m)
  const path = reconstructPathFrom(backptr, n - 1, matchEnd, m)

  const normalizedDistance = path.length > 0 ? bestCost / path.length : 1

  return {
    distance: bestCost,
    normalizedDistance,
    path,
    matchEnd,
  }
}

/** Convert DTW normalized distance to a 0–1 similarity score (1 = perfect match) */
export function distanceToScore(normalizedDistance: number): number {
  // Exponential decay: score = exp(-k * distance)
  // For MIDI semitone differences, a normalized distance of 2 means
  // average error of ~2 semitones per step — poor match.
  // Score > 0.9 when distance < ~0.1, > 0.5 when distance < ~0.7
  if (normalizedDistance >= 10) return 0
  return Math.exp(-normalizedDistance)
}

// ── Internal helpers ─────────────────────────────────────────

function reconstructPath(
  backptr: Uint8Array,
  n: number,
  m: number,
): [number, number][] {
  const path: [number, number][] = []
  let i = n - 1
  let j = m - 1

  while (i >= 0 && j >= 0) {
    path.unshift([i, j])
    const ptr = backptr[i * m + j]
    if (ptr === 0) {
      i--
      j-- // diagonal
    } else if (ptr === 1) {
      i-- // up
    } else {
      j-- // left
    }
  }

  return path
}

function reconstructPathFrom(
  backptr: Uint8Array,
  startI: number,
  startJ: number,
  m: number,
): [number, number][] {
  const path: [number, number][] = []
  let i = startI
  let j = startJ

  while (i >= 0 && j >= 0) {
    path.unshift([i, j])
    if (i === 0 && j === 0) break

    const ptr = backptr[i * m + j]
    if (ptr === 0) {
      i--
      j--
    } else if (ptr === 1) {
      i--
    } else {
      j--
    }
  }

  return path
}

function computeBackpointers(
  cost: Float64Array,
  n: number,
  m: number,
): Uint8Array {
  const backptr = new Uint8Array(n * m)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const idx = i * m + j
      let best = Infinity
      let bestPtr = 0
      if (i > 0 && j > 0 && cost[(i - 1) * m + (j - 1)] < best) {
        best = cost[(i - 1) * m + (j - 1)]
        bestPtr = 0
      }
      if (i > 0 && cost[(i - 1) * m + j] < best) {
        best = cost[(i - 1) * m + j]
        bestPtr = 1
      }
      if (j > 0 && cost[i * m + (j - 1)] < best) {
        best = cost[i * m + (j - 1)]
        bestPtr = 2
      }
      backptr[idx] = bestPtr
    }
  }
  return backptr
}
