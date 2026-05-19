// ============================================================
// Melody Matcher — Multi-feature DTW scoring against fingerprints
// Phase 3 of Shazam Sing
//
// Takes a LivePitchContour (from the live pitch buffer) and
// matches it against all fingerprint sequences using DTW on
// multiple feature representations. Returns ranked results.
// ============================================================

import { distanceToScore, dtwMatch, dtwMatchSubsequence } from './dtw'
import { getFingerprintArray } from './melody-fingerprints'
import type { LivePitchContour, MatchBreakdown, MatchCandidate, MatcherOptions, } from './types'
import { DEFAULT_MATCH_WEIGHTS } from './types'

const DEFAULT_MATCHER_OPTIONS: MatcherOptions = {
  minConfidence: 0,
  maxResults: 5,
}

/**
 * Match a captured pitch contour against all melodies in the fingerprint index.
 *
 * Returns candidates sorted by confidence (highest first).
 * An empty array means no melody matched above the minimum confidence threshold.
 */
export function matchPitchContour(
  contour: LivePitchContour,
  options: MatcherOptions = {},
): MatchCandidate[] {
  const fingerprints = getFingerprintArray()
  if (fingerprints.length === 0) return []

  const opts = { ...DEFAULT_MATCHER_OPTIONS, ...options }
  const weights = { ...DEFAULT_MATCH_WEIGHTS, ...(opts.weights ?? {}) }

  // Cap query note count to keep DTW matrices bounded. 60 notes is
  // enough for a good match (most melodies are 7-30 notes), and keeps
  // the worst-case matrix under Float64Array(60 * 2000) = 960KB per call.
  const MAX_QUERY_NOTES = 60
  let noteSeq = contour.noteSequence
  let ioiSeq = contour.ioiSequence
  if (noteSeq.length > MAX_QUERY_NOTES) {
    noteSeq = sampleEvenly(noteSeq, MAX_QUERY_NOTES)
    // Rebuild IOIs from sampled notes if we have enough data
    if (contour.onsets.length > 0) {
      const iois: number[] = []
      for (let i = 1; i < noteSeq.length; i++) {
        iois.push(contour.durationSec / noteSeq.length)
      }
      ioiSeq = iois
    }
  }

  const candidates: MatchCandidate[] = []

  for (const fp of fingerprints) {
    // ── Source filter ─────────────────────────────────────
    if (opts.sourceFilter) {
      const isStem = fp.melodyId.startsWith('stem:')
      if (opts.sourceFilter === 'stem' && !isStem) continue
      if (opts.sourceFilter === 'melody' && isStem) continue
    }

    // ── Early termination filters ────────────────────────
    // Skip when both sides are short enough that subsequence DTW won't help.
    // When one side is much longer, let subsequence DTW try to find the
    // query within the reference (e.g. 10-note singing in an 800-note stem).
    const shorterLen = Math.min(fp.noteCount, noteSeq.length)
    if (shorterLen > 0) {
      const noteRatio =
        Math.max(fp.noteCount, noteSeq.length) / Math.max(1, shorterLen)
      // Only reject when both are short AND still wildly different —
      // if either side is long enough for subsequence DTW, let it try.
      if (noteRatio > 3 && shorterLen < 20) continue
    }

    // Duration difference by factor > 5
    if (fp.durationSec > 0 && contour.durationSec > 0) {
      const durRatio =
        Math.max(fp.durationSec, contour.durationSec) /
        Math.max(0.1, Math.min(fp.durationSec, contour.durationSec))
      if (durRatio > 5) continue
    }

    // ── Multi-feature DTW matching ──────────────────────

    // 1. Absolute pitch match (MIDI semitones)
    let pitchScore = 0
    if (fp.pitchSequence.length > 0 && noteSeq.length > 0) {
      pitchScore = bestMatch(noteSeq, fp.pitchSequence)
    }

    // 2. Interval match (transposition-invariant)
    let intervalScore = 0
    if (
      fp.intervalSequence.length > 0 &&
      noteSeq.length > 1 // need ≥2 notes for intervals
    ) {
      const contourIntervals: number[] = []
      for (let i = 1; i < noteSeq.length; i++) {
        contourIntervals.push(noteSeq[i] - noteSeq[i - 1])
      }
      if (contourIntervals.length > 0 && fp.intervalSequence.length > 0) {
        intervalScore = bestMatch(contourIntervals, fp.intervalSequence)
      }
    }

    // 3. Chroma match (octave-invariant, for humming)
    let chromaScore = 0
    if (fp.chromaSequence.length > 0 && noteSeq.length > 0) {
      const contourChroma = noteSeq.map((m) => m % 12)
      chromaScore = bestMatch(contourChroma, fp.chromaSequence)
    }

    // 4. Rhythm match (IOI-based, tempo-normalized)
    let rhythmScore = 0
    if (ioiSeq.length > 0 && fp.ioiSequence.length > 0) {
      const contourIOIs = normalizeIOIs(ioiSeq, contour.durationSec)
      const fpIOIs = normalizeIOIs(fp.ioiSequence, fp.durationSec)
      if (contourIOIs.length > 0 && fpIOIs.length > 0) {
        rhythmScore = bestMatch(contourIOIs, fpIOIs)
      }
    }

    // 5. Length bonus — prefer similar note counts
    const lengthBonus = computeLengthBonus(noteSeq.length, fp.noteCount)

    // ── Humming normalization ────────────────────────────
    // When pitch score is low but chroma score is high, the user
    // is likely humming in a different octave. Boost chroma weight
    // and reduce pitch weight to improve octave-invariant matching.
    let effPitchWeight = weights.pitchWeight
    let effChromaWeight = weights.chromaWeight
    let hummingNormalized = false
    if (pitchScore < 0.4 && chromaScore > 0.7) {
      const shift = 0.15
      effPitchWeight = Math.max(0.1, weights.pitchWeight - shift)
      effChromaWeight = Math.min(0.5, weights.chromaWeight + shift)
      hummingNormalized = true
    }

    // ── Weighted confidence ──────────────────────────────
    const confidence = Math.round(
      (effPitchWeight * pitchScore +
        weights.intervalWeight * intervalScore +
        effChromaWeight * chromaScore +
        weights.rhythmWeight * rhythmScore +
        weights.lengthBonusWeight * lengthBonus) *
        100,
    )

    if (confidence < (opts.minConfidence ?? 0)) continue

    const breakdown: MatchBreakdown = {
      pitchScore,
      intervalScore,
      chromaScore,
      rhythmScore,
      lengthBonus,
    }

    const isStem = fp.melodyId.startsWith('stem:')
    candidates.push({
      melodyId: fp.melodyId,
      name: fp.name,
      confidence,
      breakdown,
      source: isStem ? 'stem' : 'melody',
      sessionId: isStem ? fp.melodyId.slice(5) : undefined,
      hummingNormalized,
    })
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence)

  return candidates.slice(0, opts.maxResults ?? 5)
}

/** Like {@link matchPitchContour} but also returns whether humming normalization was applied. */
export function matchPitchContourWithMeta(
  contour: LivePitchContour,
  options: MatcherOptions = {},
): { candidates: MatchCandidate[]; hummingNormalized: boolean } {
  const candidates = matchPitchContour(contour, options)
  const hummingNormalized =
    candidates.length > 0 ? (candidates[0].hummingNormalized ?? false) : false
  return { candidates, hummingNormalized }
}

// ── Internal helpers ─────────────────────────────────────────

/**
 * Try both classic DTW and subsequence DTW, return the better score.
 * Subsequence DTW handles partial matching (user sings only the chorus).
 */
function bestMatch(query: number[], reference: number[]): number {
  const classic = dtwMatch(query, reference)
  const classicScore = distanceToScore(classic.normalizedDistance)

  // Subsequence DTW only makes sense when reference is longer than query
  if (reference.length > query.length) {
    const sub = dtwMatchSubsequence(query, reference)
    const subScore = distanceToScore(sub.normalizedDistance)
    return Math.max(classicScore, subScore)
  }

  return classicScore
}

/** Normalize IOI sequence to [0, 1] range relative to total duration */
function normalizeIOIs(iois: number[], totalDuration: number): number[] {
  if (totalDuration <= 0 || iois.length === 0) return iois
  return iois.map((ioi) => ioi / totalDuration)
}

/** Length bonus: 1.0 when note counts match exactly, decays with ratio */
function computeLengthBonus(queryNotes: number, refNotes: number): number {
  if (queryNotes <= 0 || refNotes <= 0) return 0
  const ratio = Math.min(queryNotes, refNotes) / Math.max(queryNotes, refNotes)
  return ratio
}

/** Downsample an array to at most `targetLen` elements, evenly spaced */
function sampleEvenly(arr: number[], targetLen: number): number[] {
  if (arr.length <= targetLen) return arr
  const result: number[] = []
  const step = (arr.length - 1) / (targetLen - 1)
  for (let i = 0; i < targetLen; i++) {
    result.push(arr[Math.round(i * step)])
  }
  return result
}
