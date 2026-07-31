// ============================================================
// Trace model — geometry for the take trace, per capability tier
//
// Kept pure and separate from the SVG so the layout rules can be asserted
// directly. The important one is the practice-session case: a practice record
// stores *duration per note*, never timestamps, so notes are laid out by
// cumulative duration. The old page invented a clock (`i * 0.01` across
// concatenated sessions) and measured vibrato on it; nothing here may do that.
// ============================================================

import { frequencyToMidi } from '@/lib/frequency-to-note'
import type { LivePitchSample } from '@/lib/live-pitch-analysis'
import type { MergedNote } from '@/lib/midi-generator'
import type { AccuracyRating, NoteResult } from '@/types'

const RATING_COLOR: Record<AccuracyRating, string> = {
  perfect: 'var(--green, #3fb950)',
  excellent: 'var(--green, #3fb950)',
  good: 'var(--chart-lime, #8dcb41)',
  okay: 'var(--yellow, #d29922)',
  off: 'var(--red, #f85149)',
}

/** Slot given to a note whose duration wasn't recorded. */
const FALLBACK_NOTE_MS = 1000

export interface TraceBar {
  x: number
  y: number
  width: number
  height: number
  color: string
}

export interface TraceModel {
  kind: 'bars' | 'path'
  bars: TraceBar[]
  path: string
  /** Padded MIDI band the plot is scaled to. */
  low: number
  high: number
  /** Seconds the plot spans. */
  span: number
}

/** Pad a MIDI range so a monotone take still gets a readable band. */
export function padRange(
  low: number,
  high: number,
): { low: number; high: number } {
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return { low: 48, high: 72 }
  }
  const span = high - low
  const pad = span < 4 ? 4 : span * 0.15
  return { low: low - pad, high: high + pad }
}

/** Detected notes carry real start/end seconds — plot them on a real clock. */
export function notesToModel(notes: MergedNote[]): TraceModel {
  let start = Infinity
  let end = -Infinity
  let lowMidi = Infinity
  let highMidi = -Infinity
  for (const note of notes) {
    start = Math.min(start, note.startSec)
    end = Math.max(end, note.endSec)
    lowMidi = Math.min(lowMidi, note.midi)
    highMidi = Math.max(highMidi, note.midi)
  }

  const timeSpan = Math.max(0.001, end - start)
  const { low, high } = padRange(lowMidi, highMidi)
  const pitchSpan = Math.max(1, high - low)

  return {
    kind: 'bars',
    path: '',
    low,
    high,
    span: timeSpan,
    bars: notes.map((note) => ({
      x: ((note.startSec - start) / timeSpan) * 100,
      y: 100 - ((note.midi - low) / pitchSpan) * 100,
      width: Math.max(0.3, ((note.endSec - note.startSec) / timeSpan) * 100),
      height: 2.5,
      color: 'var(--accent, #58a6ff)',
    })),
  }
}

/**
 * Practice results have no timestamps — only `time`, the milliseconds spent on
 * each note. Laying them out by cumulative duration is honest (it is measured
 * data); claiming a wall clock would not be. Bars are coloured by rating.
 */
export function resultsToModel(results: NoteResult[]): TraceModel {
  const durations = results.map((r) =>
    Number.isFinite(r.time) && r.time > 0 ? r.time : FALLBACK_NOTE_MS,
  )
  const total = durations.reduce((a, b) => a + b, 0)

  let lowMidi = Infinity
  let highMidi = -Infinity
  for (const r of results) {
    lowMidi = Math.min(lowMidi, r.item.note.midi)
    highMidi = Math.max(highMidi, r.item.note.midi)
  }
  const { low, high } = padRange(lowMidi, highMidi)
  const pitchSpan = Math.max(1, high - low)

  const bars: TraceBar[] = []
  let cursor = 0
  results.forEach((r, i) => {
    const width = (durations[i] / total) * 100
    bars.push({
      x: cursor,
      y: 100 - ((r.item.note.midi - low) / pitchSpan) * 100,
      width: Math.max(0.4, width - 0.3),
      height: 3,
      color: RATING_COLOR[r.rating] ?? RATING_COLOR.okay,
    })
    cursor += width
  })

  return { kind: 'bars', bars, path: '', low, high, span: total / 1000 }
}

/** Live frames carry real timestamps — draw the contour. */
export function samplesToModel(samples: LivePitchSample[]): TraceModel {
  const voiced = samples.filter((s) => s.frequency > 0 && s.clarity > 0.3)
  if (voiced.length < 2) {
    return { kind: 'path', bars: [], path: '', low: 48, high: 72, span: 0 }
  }

  const midis = voiced.map((s) => frequencyToMidi(s.frequency, false))
  const { low, high } = padRange(Math.min(...midis), Math.max(...midis))
  const pitchSpan = Math.max(1, high - low)

  const t0 = voiced[0].timestamp
  const tN = voiced[voiced.length - 1].timestamp
  const timeSpan = Math.max(0.001, tN - t0)

  const path = voiced
    .map((s, i) => {
      const x = ((s.timestamp - t0) / timeSpan) * 100
      const y = 100 - ((midis[i] - low) / pitchSpan) * 100
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  return { kind: 'path', bars: [], path, low, high, span: timeSpan }
}

export interface TraceSources {
  notes?: MergedNote[]
  results?: NoteResult[]
  samples?: LivePitchSample[]
}

/** Pick the strongest available source and build its geometry. */
export function buildTraceModel(sources: TraceSources): TraceModel | null {
  if (sources.notes !== undefined && sources.notes.length > 0) {
    return notesToModel(sources.notes)
  }
  if (sources.results !== undefined && sources.results.length > 0) {
    return resultsToModel(sources.results)
  }
  if (sources.samples !== undefined && sources.samples.length > 0) {
    return samplesToModel(sources.samples)
  }
  return null
}
