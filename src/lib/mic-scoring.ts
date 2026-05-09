// ============================================================
// Mic Scoring — computeScore extracted from StemMixer.tsx
// Tests: src/tests/mic-scoring.test.ts
// ============================================================

export interface ComparisonPoint {
  time: number
  vocalNote: string
  micNote: string
  centsOff: number // positive = mic is sharp
  inTolerance: boolean
}

export interface MicScore {
  totalNotes: number
  matchedNotes: number
  accuracyPct: number
  avgCentsOff: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
}

/**
 * Compute a pitch accuracy score from an array of comparison points.
 *
 * Each ComparisonPoint represents one comparison between a vocal stem note
 * and the user's microphone pitch at that moment.
 *
 * Grading thresholds:
 *   S: >= 95% accuracy
 *   A: >= 85%
 *   B: >= 70%
 *   C: >= 50%
 *   D: < 50%
 */
export function computeScore(data: ComparisonPoint[]): MicScore {
  if (data.length === 0) {
    return {
      totalNotes: 0,
      matchedNotes: 0,
      accuracyPct: 0,
      avgCentsOff: 0,
      grade: 'D',
    }
  }

  const total = data.length
  const matched = data.filter((d) => d.inTolerance).length
  const sumCents = data.reduce((s, d) => s + Math.abs(d.centsOff), 0)
  const accuracy = (matched / total) * 100

  let grade: MicScore['grade']
  if (accuracy >= 95) grade = 'S'
  else if (accuracy >= 85) grade = 'A'
  else if (accuracy >= 70) grade = 'B'
  else if (accuracy >= 50) grade = 'C'
  else grade = 'D'

  return {
    totalNotes: total,
    matchedNotes: matched,
    accuracyPct: Math.round(accuracy),
    avgCentsOff: Math.round(sumCents / total),
    grade,
  }
}
