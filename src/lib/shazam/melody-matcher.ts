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

const isDebug = (): boolean =>
  localStorage.getItem('pitchperfect_shazam_debug') === 'true'

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
  const debug = isDebug()

  if (debug) {
    // eslint-disable-next-line no-console
    console.group('[Shazam Matcher] Matching contour')
    console.log(
      'Query notes:',
      noteSeq.length,
      'IOIs:',
      ioiSeq.length,
      'Duration:',
      `${contour.durationSec.toFixed(2)}s`,
    )
    console.log(
      'Note sequence (MIDI):',
      `${noteSeq
        .slice(0, 20)
        .map((n) => n.toFixed(1))
        .join(', ')}${noteSeq.length > 20 ? '...' : ''}`,
    )
    console.log('Fingerprints to compare:', fingerprints.length)
  }

  for (const fp of fingerprints) {
    // ── Source filter ─────────────────────────────────────
    if (opts.sourceFilter) {
      const isStem = fp.melodyId.startsWith('stem:')
      if (opts.sourceFilter === 'stem' && !isStem) continue
      if (opts.sourceFilter === 'melody' && isStem) continue
    }

    // ── Early termination filters ────────────────────────
    const shorterLen = Math.min(fp.noteCount, noteSeq.length)
    if (shorterLen > 0) {
      const noteRatio =
        Math.max(fp.noteCount, noteSeq.length) / Math.max(1, shorterLen)
      if (noteRatio > 3 && shorterLen < 20) {
        if (debug)
          console.log(
            `  [SKIP] ${fp.name}: note ratio ${noteRatio.toFixed(1)}x (${fp.noteCount} vs ${noteSeq.length})`,
          )
        continue
      }
    }

    // Note: no duration-ratio filter here. Subsequence DTW is designed to find
    // a short query (e.g. 8s of singing) within a long reference (e.g. 60s stem).
    // Filtering by duration ratio would defeat the whole purpose of subsequence DTW.

    // ── Multi-feature DTW matching ──────────────────────

    // 1. Absolute pitch match (MIDI semitones)
    let pitchScore = 0
    let pitchMatchStartIdx = -1
    let pitchMatchPath: [number, number][] = []
    if (fp.pitchSequence.length > 0 && noteSeq.length > 0) {
      const pm = bestMatchWithOffset(noteSeq, fp.pitchSequence)
      pitchScore = pm.score
      pitchMatchStartIdx = pm.startIndex
      pitchMatchPath = pm.path
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
        intervalScore = bestMatchWithOffset(
          contourIntervals,
          fp.intervalSequence,
        ).score
      }
    }

    // 3. Chroma match (octave-invariant, for humming)
    let chromaScore = 0
    if (fp.chromaSequence.length > 0 && noteSeq.length > 0) {
      const contourChroma = noteSeq.map((m) => m % 12)
      chromaScore = bestMatchWithOffset(contourChroma, fp.chromaSequence).score
    }

    // 4. Rhythm match (IOI-based, tempo-normalized)
    let rhythmScore = 0
    if (ioiSeq.length > 0 && fp.ioiSequence.length > 0) {
      const contourIOIs = normalizeIOIs(ioiSeq, contour.durationSec)
      const fpIOIs = normalizeIOIs(fp.ioiSequence, fp.durationSec)
      if (contourIOIs.length > 0 && fpIOIs.length > 0) {
        rhythmScore = bestMatchWithOffset(contourIOIs, fpIOIs).score
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

    if (debug) {
      console.log(
        `  [SCORE] ${fp.name}: pitch=${pitchScore.toFixed(3)} interval=${intervalScore.toFixed(3)} chroma=${chromaScore.toFixed(3)} rhythm=${rhythmScore.toFixed(3)} length=${lengthBonus.toFixed(3)} => ${confidence}%${hummingNormalized ? ' (humming adj)' : ''}`,
      )
    }

    // Compute match time offset from subsequence DTW start index
    let matchOffsetSec: number | undefined
    if (pitchMatchStartIdx >= 0 && fp.ioiSequence.length > 0) {
      // Sum IOIs up to the start index to get the time offset
      let offsetSec = fp.firstNoteStartSec ?? 0
      for (
        let i = 0;
        i < Math.min(pitchMatchStartIdx, fp.ioiSequence.length);
        i++
      ) {
        offsetSec += fp.ioiSequence[i]
      }
      matchOffsetSec = offsetSec

      if (debug) {
        console.log(
          `  [OFFSET] ${fp.name}: matchStartIdx=${pitchMatchStartIdx}, firstNoteStart=${fp.firstNoteStartSec ?? 0}, offsetSec=${offsetSec.toFixed(2)}s`,
        )
        if (pitchMatchPath.length > 0) {
          const NOTE_NAMES = [
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
          const toName = (m: number) =>
            `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`
          const queryNotes = pitchMatchPath.map(([q]) =>
            toName(Math.round(noteSeq[q])),
          )
          const refNotes = pitchMatchPath.map(([, r]) =>
            toName(Math.round(fp.pitchSequence[r])),
          )
          console.log(`  [NOTES] Query: ${queryNotes.join(' ')}`)
          console.log(`  [NOTES] Match: ${refNotes.join(' ')}`)
        }
      }
    }

    candidates.push({
      melodyId: fp.melodyId,
      name: fp.name,
      confidence,
      breakdown,
      source: isStem ? 'stem' : 'melody',
      sessionId: isStem ? fp.melodyId.slice(5) : undefined,
      hummingNormalized,
      matchOffsetSec,
    })
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence)

  const result = candidates.slice(0, opts.maxResults ?? 5)

  if (debug) {
    if (result.length > 0) {
      console.log(
        'Top matches:',
        result.map((c) => `${c.name} (${c.confidence}%)`).join(', '),
      )
    } else {
      console.log('No matches above threshold')
    }
    // eslint-disable-next-line no-console
    console.groupEnd()
  }

  return result
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
 * Try both classic DTW and subsequence DTW, return the better score
 * and the start index into the reference for subsequence matches.
 */
function bestMatchWithOffset(
  query: number[],
  reference: number[],
): { score: number; startIndex: number; path: [number, number][] } {
  const classic = dtwMatch(query, reference)
  const classicScore = distanceToScore(classic.normalizedDistance)

  // Subsequence DTW only makes sense when reference is longer than query
  if (reference.length > query.length) {
    const sub = dtwMatchSubsequence(query, reference)
    const subScore = distanceToScore(sub.normalizedDistance)
    if (subScore > classicScore) {
      // Find the earliest reference index in the path
      const startIdx = sub.path.length > 0 ? sub.path[0][1] : 0
      return { score: subScore, startIndex: startIdx, path: sub.path }
    }
  }

  return { score: classicScore, startIndex: 0, path: classic.path }
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
