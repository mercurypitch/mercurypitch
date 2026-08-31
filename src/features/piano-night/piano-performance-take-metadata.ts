// ============================================================
// Piano performance take metadata — stable History identity and score truth
// ============================================================
//
// The completed scoring snapshot and capture are copied synchronously before
// replay rendering. Async persistence therefore cannot observe a later pass,
// source, range, or practice-speed mutation.

import type { PianoPerformanceScoringState } from '@/features/piano/runtime/piano-performance-scoring'
import type { PianoNightSource } from './piano-night-source'
import type { PianoPerformanceTakeCapture } from './piano-performance-take'

export interface PianoPerformanceTakeMetadata {
  readonly comparisonKey: string
  readonly title: string
  readonly context: Record<string, unknown>
  readonly metrics: Record<string, number | string | boolean | null>
}

export interface PianoPerformanceTakeMetadataInput {
  readonly source: PianoNightSource
  readonly score: PianoPerformanceScoringState
  readonly capture: PianoPerformanceTakeCapture
  readonly rangeStartBeat: number
  readonly rangeEndBeat: number
  readonly rangeKind: 'full' | 'loop'
  readonly finalPassNumber: number
  readonly repeatCount: number
  readonly practiceSpeed: number
}

function canonicalBeat(beat: number): string {
  const rounded = Math.round(Math.max(0, beat) * 1_000_000) / 1_000_000
  return String(rounded)
}

function scoreTrackId(source: PianoNightSource): string {
  return (
    source.project?.scoreTrackId ??
    source.stage.notes.find((note) => note.trackId !== undefined)?.trackId ??
    'score'
  )
}

/** Build the immutable storage identity for one finalized Piano Night pass. */
export function createPianoPerformanceTakeMetadata(
  input: PianoPerformanceTakeMetadataInput,
): PianoPerformanceTakeMetadata {
  const trackId = scoreTrackId(input.source)
  const startBeat = Math.max(0, input.rangeStartBeat)
  const endBeat = Math.max(startBeat, input.rangeEndBeat)
  const comparisonKey = [
    'piano-night',
    encodeURIComponent(input.source.id),
    encodeURIComponent(trackId),
    `${canonicalBeat(startBeat)}-${canonicalBeat(endBeat)}`,
    'v1',
  ].join(':')

  return Object.freeze({
    comparisonKey,
    title: input.source.stage.title,
    context: Object.freeze({
      kind: 'piano-night',
      sourceId: input.source.id,
      sourceProvenance: input.source.provenance,
      scoreTrackId: trackId,
      practiceTrackLabel: input.source.practiceTrackLabel,
      rangeKind: input.rangeKind,
      rangeStartBeat: startBeat,
      rangeEndBeat: endBeat,
      finalPassNumber: Math.max(1, Math.round(input.finalPassNumber)),
      repeatCount: Math.max(1, Math.round(input.repeatCount)),
      practiceSpeed: input.practiceSpeed,
      inputKinds: Object.freeze([...input.capture.inputKinds]),
      replayInstrumentId: 'mercury-felt-synth',
      playerOnly: true,
    }),
    metrics: Object.freeze({
      score: input.score.score,
      accuracyPercent: input.score.accuracyPercent,
      bestStreak: input.score.streak,
      hits: input.score.hits,
      misses: input.score.misses,
      judgedNotes: input.score.judgedNotes,
      skippedNotes: input.score.skippedNotes,
      totalNotes: input.score.totalNotes,
      playedNoteCount: input.capture.notes.length,
      capturedDurationMs: Math.round(input.capture.durationMs),
    }),
  })
}
