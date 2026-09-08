// ============================================================
// Recorder benchmark runs identical PCM through production analysis and scores final notes.
// ============================================================

import type { GuitarRecordingAnalysisOptions } from './recording-analysis'
import { createGuitarRecordingAnalysis } from './recording-analysis'
import type { GuitarRecordingBenchmarkFixture, GuitarRecordingNoteTruth, } from './recording-benchmark-fixtures'
import type { GuitarPitchEvidence, GuitarRecordedNote } from './recording-types'

export interface GuitarRecordingBenchmarkCase {
  id: string
  analysis: GuitarRecordingAnalysisOptions
}

export const GUITAR_RECORDING_BENCHMARK_CASES: readonly GuitarRecordingBenchmarkCase[] =
  [
    { id: 'recorder-yin', analysis: {} },
    { id: 'rehearsal-mpm', analysis: { pitchProfile: 'rehearsal' } },
    {
      id: 'rehearsal-mpm-unstabilized',
      analysis: {
        pitchProfile: 'rehearsal',
        pitchOverrides: { stabilize: false },
      },
    },
  ]

function percentile(
  values: readonly number[],
  fraction: number,
): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]
}

/**
 * Exact MIDI, ordered one-to-one onset matches within 60 ms; no octave folding.
 * Earliest eligible observations maximize matches when repeated-note windows
 * overlap. Nearest-first can steal the only observation for the next target.
 * Timing percentiles cover matched pairs only; unmatched notes stay visible.
 */
export function scoreGuitarRecordingNotes(
  expected: readonly GuitarRecordingNoteTruth[],
  actual: readonly GuitarRecordedNote[],
  sampleRate: number,
) {
  const unused = new Set(
    actual
      .map((_, index) => index)
      .sort(
        (left, right) => actual[left].startFrame - actual[right].startFrame,
      ),
  )
  const onsetErrors: number[] = []
  const offsetErrors: number[] = []
  for (const target of [...expected].sort(
    (left, right) => left.startSeconds - right.startSeconds,
  )) {
    let match: number | null = null
    let onsetError = 0
    for (const index of unused) {
      const note = actual[index]
      const error = Math.abs(note.startFrame / sampleRate - target.startSeconds)
      if (note.midi !== target.midi || error > 0.06 + Number.EPSILON) continue
      match = index
      onsetError = error
      break
    }
    if (match === null) continue
    unused.delete(match)
    onsetErrors.push(onsetError * 1000)
    offsetErrors.push(
      Math.abs(actual[match].endFrame / sampleRate - target.endSeconds) * 1000,
    )
  }
  return {
    expected: expected.length,
    detected: actual.length,
    matched: onsetErrors.length,
    missed: expected.length - onsetErrors.length,
    falseNotes: actual.length - onsetErrors.length,
    precision: actual.length ? onsetErrors.length / actual.length : null,
    recall: expected.length ? onsetErrors.length / expected.length : null,
    onsetAbsoluteMedianMs: percentile(onsetErrors, 0.5),
    onsetAbsoluteP95Ms: percentile(onsetErrors, 0.95),
    offsetAbsoluteMedianMs: percentile(offsetErrors, 0.5),
  }
}

function scorePitches(
  fixture: GuitarRecordingBenchmarkFixture,
  pitches: readonly GuitarPitchEvidence[],
) {
  if (fixture.midiAt === null) return null
  let expected = 0
  let detected = 0
  let matched = 0
  let falseVoiced = 0
  const centsErrors: number[] = []
  for (const pitch of pitches) {
    const truth = fixture.midiAt(pitch.frame / fixture.sampleRate)
    if (truth !== null) expected++
    if (pitch.midi === null) continue
    detected++
    if (truth === null) {
      falseVoiced++
      continue
    }
    const error = Math.abs(pitch.midi - truth) * 100
    centsErrors.push(error)
    if (error <= 50) matched++
  }
  return {
    expected,
    detected,
    matched,
    falseVoiced,
    precision: detected ? matched / detected : null,
    recall: expected ? matched / expected : null,
    absoluteMedianCents: percentile(centsErrors, 0.5),
    absoluteP95Cents: percentile(centsErrors, 0.95),
  }
}

/** Full streaming path, including attacks, segmentation and PCM encoding. */
export function runGuitarRecordingBenchmark(
  fixture: GuitarRecordingBenchmarkFixture,
  candidate: GuitarRecordingBenchmarkCase,
  chunkFrames = 8192,
) {
  if (!Number.isInteger(chunkFrames) || chunkFrames < 1)
    throw new Error('Benchmark chunk size must be a positive integer.')
  const analysis = createGuitarRecordingAnalysis(
    'benchmark',
    fixture.sampleRate,
    candidate.analysis,
  )
  const pitches: GuitarPitchEvidence[] = []
  let sequence = 0
  let attacks = 0
  const started = performance.now()
  for (let first = 0; first < fixture.samples.length; first += chunkFrames) {
    const block = fixture.samples.subarray(first, first + chunkFrames)
    const chunk = analysis.process(block, block.length, sequence++, first)
    pitches.push(...chunk.pitches)
    attacks += chunk.attacks.length
  }
  const notes = analysis.finish().notes
  const processingMs = performance.now() - started
  const audioSeconds = fixture.samples.length / fixture.sampleRate
  return {
    fixture: fixture.id,
    candidate: candidate.id,
    audioSeconds,
    processingMs,
    // Wall-clock, hardware/load-dependent. Never asserted as a CI threshold.
    realtimeMultiple:
      processingMs > 0 ? (audioSeconds * 1000) / processingMs : null,
    noteMetrics:
      fixture.notes === null
        ? null
        : scoreGuitarRecordingNotes(fixture.notes, notes, fixture.sampleRate),
    pitchMetrics: scorePitches(fixture, pitches),
    emittedNotes: notes,
    detectedAttacks: attacks,
    limitation: fixture.limitation,
  }
}
