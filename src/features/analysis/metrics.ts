// ============================================================
// Analysis metrics — what each capability tier can honestly report
//
// The old page ran spectral maths (HNR, vibrato rate, resonance) over practice
// *note summaries*, having first fabricated a timeline (`i * 0.01`) and mapped
// cents deviation into a field read as 0-1 clarity. Every number it produced
// from history was decorative.
//
// This module is deliberately narrow: it computes only what the input data
// actually supports. Spectral timbre lives in `vocal-analyzer.ts` and is only
// reachable from takes that carry real audio.
// ============================================================

import { midiToNoteName } from '@/lib/frequency-to-note'
import type { AccuracyRating, SessionResult } from '@/types'

/** Notes within this many cents of target count as in tune. */
const IN_TUNE_CENTS = 25

export interface PracticeMetrics {
  noteCount: number
  score: number
  /**
   * Mean |cents| from target — how far off, ignoring direction.
   *
   * Direction (sharp vs flat) is deliberately absent: the production writer
   * (`practice-engine.finalizeNoteResult`) averages `Math.abs(s.cents)` per
   * note, so stored `avgCents` is an unsigned magnitude. A signed "bias"
   * derived from it would read every imperfect session as sharp.
   */
  avgAbsCents: number
  /** Share of measurable notes within ±25¢ of target. */
  inTunePercent: number
  lowNote: string
  highNote: string
  rangeSemitones: number
  ratings: Record<AccuracyRating, number>
}

const EMPTY_RATINGS = (): Record<AccuracyRating, number> => ({
  perfect: 0,
  excellent: 0,
  good: 0,
  okay: 0,
  off: 0,
})

/**
 * Everything a practice session's stored note results legitimately support.
 *
 * Deliberately excludes timbre, vibrato and anything spectral: a practice
 * record holds per-note scores, not a waveform.
 */
export function buildPracticeMetrics(
  session: SessionResult,
): PracticeMetrics | null {
  // Old records predate today's shape: an item may lack noteResult entirely,
  // and a note may carry a non-finite avgCents or an unknown rating. Skip
  // what a row cannot support instead of crashing or counting it as perfect.
  const notes = session.practiceItemResult.flatMap(
    (item) => item.noteResult ?? [],
  )
  if (notes.length === 0) return null

  let absCentsSum = 0
  let measurable = 0
  let inTune = 0
  let lowMidi = Infinity
  let highMidi = -Infinity
  const ratings = EMPTY_RATINGS()

  for (const note of notes) {
    const cents = note.avgCents
    if (Number.isFinite(cents)) {
      measurable++
      absCentsSum += Math.abs(cents)
      if (Math.abs(cents) <= IN_TUNE_CENTS) inTune++
    }

    const midi = note.item?.note?.midi
    if (Number.isFinite(midi)) {
      lowMidi = Math.min(lowMidi, midi)
      highMidi = Math.max(highMidi, midi)
    }

    if (note.rating in ratings) ratings[note.rating] += 1
  }

  const hasRange = Number.isFinite(lowMidi) && Number.isFinite(highMidi)

  return {
    noteCount: notes.length,
    score: session.score ?? 0,
    avgAbsCents:
      measurable === 0 ? 0 : Math.round((absCentsSum / measurable) * 10) / 10,
    inTunePercent:
      measurable === 0 ? 0 : Math.round((inTune / measurable) * 100),
    lowNote: hasRange ? midiToNoteName(lowMidi) : '—',
    highNote: hasRange ? midiToNoteName(highMidi) : '—',
    rangeSemitones: hasRange ? Math.round(highMidi - lowMidi) : 0,
    ratings,
  }
}

export interface TrendPoint {
  completedAt: number
  score: number
  rangeSemitones: number
  inTunePercent: number
}

/**
 * Per-session progress points, oldest first, for the trends section.
 * Sessions with no usable note results are skipped rather than plotted as 0.
 */
export function buildTrend(sessions: SessionResult[]): TrendPoint[] {
  return sessions
    .map((session) => {
      const metrics = buildPracticeMetrics(session)
      if (metrics === null) return null
      return {
        completedAt: session.completedAt,
        score: metrics.score,
        rangeSemitones: metrics.rangeSemitones,
        inTunePercent: metrics.inTunePercent,
      }
    })
    .filter((point): point is TrendPoint => point !== null)
    .sort((a, b) => a.completedAt - b.completedAt)
}
