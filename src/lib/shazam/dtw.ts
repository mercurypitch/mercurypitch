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

  // Nothing to align. A normalized distance of 1 would have read as
  // "about a semitone out" — a decent match — so empty input used to be
  // worth exp(-1) = 0.37 of a recognition for free.
  if (n === 0 || m === 0) {
    return { distance: Infinity, normalizedDistance: Infinity, path: [] }
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
  // The band never reached the far corner, so these two sequences have no
  // alignment under this constraint. Same trap as the empty case: scoring
  // an impossible alignment at 0.37 handed every over-long reference a
  // third of a match it had not earned.
  if (!isFinite(totalCost)) {
    return { distance: Infinity, normalizedDistance: Infinity, path: [] }
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
 * Subsequence DTW — the query aligns to any contiguous stretch of the
 * reference, so someone can sing eight seconds of a chorus and still be
 * found inside a three-minute stem.
 *
 * "Open" applies to the REFERENCE axis only: matching may begin and end
 * at any column, but every query note must be consumed. Freeing the
 * query axis as well is what broke this — see the loop below.
 */
export function dtwMatchSubsequence(
  query: number[],
  reference: number[],
  bandWidth?: number,
): DtwResult & { matchEnd: number } {
  const n = query.length
  const m = reference.length

  if (n === 0 || m === 0) {
    return {
      distance: Infinity,
      normalizedDistance: Infinity,
      path: [],
      matchEnd: m,
    }
  }

  // Subsequence DTW needs no band constraint — the query must be
  // able to match anywhere in the reference sequence.
  const band = bandWidth ?? m

  // Accumulated cost matrix, and the step each cell was reached by.
  // Recording the step here rather than re-deriving it afterwards keeps
  // the backtrace honest: a second pass over the finished matrix does
  // not know about the band or the open-begin row, so it could point at
  // cells the forward pass never filled.
  const cost = new Float64Array(n * m)
  cost.fill(Infinity)
  // 0 = diagonal, 1 = up, 2 = left
  const backptr = new Uint8Array(n * m)

  // Fill accumulated cost matrix.
  //
  // Open-begin belongs to the FIRST QUERY NOTE only: row 0 costs just its
  // own local distance, which is what lets the match start at any column.
  // Every later row must pay for the row above it.
  //
  // The bug this replaced offered that same free start on every row
  // (`minPrev = min(minPrev, startCost[i - 1])`, where startCost was
  // all zeros). With a zero floor available at every step the matrix
  // stopped accumulating altogether: each cell held nothing but its own
  // local distance, and the reported distance collapsed to the gap
  // between the LAST query note and its nearest neighbour anywhere in
  // the reference. On a reference of any length that gap is essentially
  // always zero — so unrelated songs came back at 100%, and the ranking
  // fell through to whatever the length bonus happened to say.
  for (let i = 0; i < n; i++) {
    const bandStart = Math.max(0, i - band)
    const bandEnd = Math.min(m - 1, i + band)

    for (let j = bandStart; j <= bandEnd; j++) {
      const d = Math.abs(query[i] - reference[j])
      const idx = i * m + j

      if (i === 0) {
        // Free to begin anywhere along the reference.
        cost[idx] = d
        continue
      }

      let minPrev = cost[(i - 1) * m + j] // up
      let bestPtr = 1
      if (j > 0) {
        const diag = cost[(i - 1) * m + (j - 1)]
        if (diag < minPrev) {
          minPrev = diag
          bestPtr = 0
        }
        const left = cost[i * m + (j - 1)]
        if (left < minPrev) {
          minPrev = left
          bestPtr = 2
        }
      }

      cost[idx] = minPrev + d
      backptr[idx] = bestPtr
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
      normalizedDistance: Infinity,
      path: [],
      matchEnd: m,
    }
  }

  // Backtrace from (n-1, matchEnd) to find the path
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
  // Guard against infinite loops from uninitialized backpointers
  const maxIter = n + m
  let iter = 0

  while (i >= 0 && j >= 0 && iter++ < maxIter) {
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
  // Guard against infinite loops from uninitialized backpointers
  const maxIter = startI + startJ + 2
  let iter = 0

  while (i >= 0 && j >= 0 && iter++ < maxIter) {
    path.unshift([i, j])
    if (i === 0) break

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
