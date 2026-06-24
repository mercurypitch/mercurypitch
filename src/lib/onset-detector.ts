// ============================================================
// Onset Detector — Spectral flux onset detection + beat tracking
// ============================================================

import type { OnsetResult } from '@/types'

// ── Spectral Flux ──────────────────────────────────────────────

/**
 * Compute spectral flux: sum of positive magnitude differences between
 * consecutive STFT frames.
 */
export function spectralFlux(prev: Float32Array, curr: Float32Array): number {
  let flux = 0
  const len = Math.min(prev.length, curr.length)
  for (let i = 0; i < len; i++) {
    const diff = curr[i] - prev[i]
    if (diff > 0) flux += diff
  }
  return flux
}

/**
 * Compute spectral flux for a sequence of magnitude spectra.
 * Returns a Float32Array of flux values (length = spectra.length - 1).
 */
export function computeFluxCurve(
  magnitudeSpectra: Float32Array[],
): Float32Array {
  if (magnitudeSpectra.length < 2) return new Float32Array(0)
  const flux = new Float32Array(magnitudeSpectra.length - 1)
  for (let i = 1; i < magnitudeSpectra.length; i++) {
    flux[i - 1] = spectralFlux(magnitudeSpectra[i - 1], magnitudeSpectra[i])
  }
  return flux
}

// ── Adaptive Peak Picking ─────────────────────────────────────

/**
 * Detect onsets from a spectral flux curve using adaptive thresholding.
 *
 * Algorithm: for each frame, compute local median over a window.
 * A frame is an onset if flux[t] > windowMedian + threshold * windowStd.
 * Then merge onsets closer than minInterval seconds.
 */
export function detectOnsets(
  magnitudeSpectra: Float32Array[],
  sampleRate: number,
  hopSize: number,
  options?: { threshold?: number; minInterval?: number },
): OnsetResult[] {
  if (magnitudeSpectra.length < 2) return []

  const flux = computeFluxCurve(magnitudeSpectra)
  const threshold = options?.threshold ?? 2.5
  const minInterval = options?.minInterval ?? 0.05 // 50ms
  const minFrames = Math.max(
    1,
    Math.round((minInterval * sampleRate) / hopSize),
  )
  const windowHalf = Math.max(4, Math.round((sampleRate / hopSize) * 0.05)) // ~50ms half-window

  // Compute global stats for initial filtering
  const globalMean = flux.reduce((a, b) => a + b, 0) / flux.length
  const globalStd = Math.sqrt(
    flux.reduce((s, v) => s + (v - globalMean) ** 2, 0) / flux.length,
  )
  const globalThresh = globalMean + threshold * globalStd

  // First pass: collect candidate peaks
  const candidates: Array<{ idx: number; strength: number }> = []

  for (let i = 1; i < flux.length - 1; i++) {
    // Must be a local maximum
    if (flux[i] <= flux[i - 1] || flux[i] <= flux[i + 1]) continue

    // Local adaptive threshold
    const start = Math.max(0, i - windowHalf)
    const end = Math.min(flux.length, i + windowHalf)
    let localSum = 0
    let localCount = 0
    for (let j = start; j < end; j++) {
      localSum += flux[j]
      localCount++
    }
    const localMean = localSum / localCount
    let localVarSum = 0
    for (let j = start; j < end; j++) {
      localVarSum += (flux[j] - localMean) ** 2
    }
    const localStd = Math.sqrt(localVarSum / localCount)

    const localThresh = localMean + threshold * Math.max(localStd, 0.01)
    const adaptiveThresh = Math.max(localThresh, globalThresh * 0.5)

    if (flux[i] > adaptiveThresh) {
      // Strength: how far above threshold (0-1)
      const strength = Math.min(
        1,
        (flux[i] - adaptiveThresh) / (adaptiveThresh + 0.01),
      )
      candidates.push({ idx: i, strength })
    }
  }

  // Merge close onsets (keep strongest in each cluster)
  candidates.sort((a, b) => a.idx - b.idx)
  const merged: Array<{ idx: number; strength: number }> = []
  for (const c of candidates) {
    if (
      merged.length === 0 ||
      c.idx - merged[merged.length - 1].idx >= minFrames
    ) {
      merged.push(c)
    } else {
      // Merge: keep the one with higher strength
      const last = merged[merged.length - 1]
      if (c.strength > last.strength) {
        merged[merged.length - 1] = c
      }
    }
  }

  // Convert frame indices to times
  const frameTime = hopSize / sampleRate
  return merged.map((c) => ({
    time: c.idx * frameTime,
    strength: c.strength,
    isBeat: false,
  }))
}

// ── Tempo Detection ──────────────────────────────────────────

/**
 * Detect tempo (BPM) from onset times using autocorrelation of the
 * inter-onset interval (IOI) histogram.
 */
export function detectTempo(
  onsets: OnsetResult[],
  options?: { minBpm?: number; maxBpm?: number },
): { bpm: number; confidence: number } {
  if (onsets.length < 3) return { bpm: 120, confidence: 0 }

  const minBpm = options?.minBpm ?? 40
  const maxBpm = options?.maxBpm ?? 240

  // Compute inter-onset intervals
  const iois: number[] = []
  for (let i = 1; i < onsets.length; i++) {
    const ioi = onsets[i].time - onsets[i - 1].time
    if (ioi > 0 && ioi < 2) {
      // Up to 2-second gaps (30 BPM)
      iois.push(ioi)
    }
  }

  if (iois.length < 2) return { bpm: 120, confidence: 0 }

  // Build histogram of IOIs at candidate BPMs
  const bpmCandidates: Map<number, number> = new Map()
  const step = 1 // 1 BPM resolution
  for (let bpm = minBpm; bpm <= maxBpm; bpm += step) {
    const targetIoi = 60 / bpm
    let score = 0
    for (const ioi of iois) {
      // Check if this IOI matches the target (or multiples/subdivisions)
      const ratio = ioi / targetIoi
      // Allow ±5% tolerance
      for (const mul of [0.5, 1, 2]) {
        if (Math.abs(ratio - mul) < 0.05) {
          score += onsets.length > 0 ? 1 : 0
        }
      }
    }
    bpmCandidates.set(bpm, score)
  }

  // Find BPM with highest score, preferring BPM closer to 120 on ties
  let bestBpm = 120
  let bestScore = 0
  for (const [bpm, score] of bpmCandidates) {
    if (
      score > bestScore ||
      (score === bestScore && Math.abs(bpm - 120) < Math.abs(bestBpm - 120))
    ) {
      bestScore = score
      bestBpm = bpm
    }
  }

  // Confidence: normalize by max possible score
  const maxScore = iois.length
  const confidence =
    maxScore > 0 ? Math.min(1, bestScore / (maxScore * 1.5)) : 0

  return { bpm: bestBpm, confidence }
}

// ── Beat Assignment ──────────────────────────────────────────

/**
 * Assign beat positions to onsets based on tempo.
 * Uses a simple phase-lock: align the first strong onset to beat 1,
 * then assign subsequent beats at tempo intervals.
 */
export function assignBeats(onsets: OnsetResult[], bpm: number): OnsetResult[] {
  if (onsets.length === 0) return onsets

  const beatInterval = 60 / bpm // seconds per beat

  // Find the strongest onset to use as beat 1 anchor
  let anchorIdx = 0
  let maxStrength = 0
  for (let i = 0; i < onsets.length; i++) {
    if (onsets[i].strength > maxStrength) {
      maxStrength = onsets[i].strength
      anchorIdx = i
    }
  }

  const anchorTime = onsets[anchorIdx].time

  return onsets.map((onset) => {
    // Distance from anchor in beats
    const distBeats = (onset.time - anchorTime) / beatInterval
    const nearestBeat = Math.round(distBeats)

    // Tolerance: within ±15% of a beat position
    const tolerance = 0.15
    const isBeat =
      Math.abs(distBeats - nearestBeat) < tolerance && onset.strength > 0.3

    return {
      ...onset,
      isBeat,
      beatPosition: isBeat
        ? (((nearestBeat % 4) + 4) % 4) + 1 // 1-4
        : undefined,
    }
  })
}

// ── Convenience ──────────────────────────────────────────────

/**
 * Full pipeline: detect onsets → detect tempo → assign beats.
 */
export function analyzeOnsetsAndBeats(
  magnitudeSpectra: Float32Array[],
  sampleRate: number,
  hopSize: number,
  options?: { threshold?: number; minInterval?: number },
): { onsets: OnsetResult[]; bpm: number; confidence: number } {
  const onsets = detectOnsets(magnitudeSpectra, sampleRate, hopSize, options)
  const { bpm, confidence } = detectTempo(onsets)
  const assigned = assignBeats(onsets, bpm)
  return { onsets: assigned, bpm, confidence }
}
