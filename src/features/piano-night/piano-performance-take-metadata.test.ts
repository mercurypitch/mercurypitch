// ============================================================
// Piano performance take metadata tests — comparison and score identity
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PianoPerformanceScoringState } from '@/features/piano/runtime/piano-performance-scoring'
import { PIANO_NIGHT_INCLUDED_SOURCE } from './piano-night-source'
import type { PianoPerformanceTakeCapture } from './piano-performance-take'
import { createPianoPerformanceTakeMetadata } from './piano-performance-take-metadata'

const score: PianoPerformanceScoringState = Object.freeze({
  revision: 8,
  sourceId: PIANO_NIGHT_INCLUDED_SOURCE.id,
  score: 875,
  accuracyPercent: 88,
  combo: 3,
  streak: 9,
  hits: 11,
  misses: 2,
  judgedNotes: 13,
  pendingNotes: 0,
  skippedNotes: 1,
  totalNotes: 14,
  complete: true,
  judgments: Object.freeze([]),
})
const capture: PianoPerformanceTakeCapture = Object.freeze({
  durationMs: 1_200,
  inputKinds: Object.freeze(['midi', 'touch'] as const),
  notes: Object.freeze([
    Object.freeze({
      id: 'one',
      midi: 60,
      velocity: 0.8,
      softPedalValue: 0,
      releaseVelocity: 0,
      inputKind: 'midi' as const,
      startMs: 0,
      endMs: 400,
    }),
  ]),
})

function metadata(speed: number, endBeat = 8) {
  return createPianoPerformanceTakeMetadata({
    source: PIANO_NIGHT_INCLUDED_SOURCE,
    score,
    capture,
    rangeStartBeat: 4,
    rangeEndBeat: endBeat,
    rangeKind: 'loop',
    finalPassNumber: 5,
    repeatCount: 5,
    practiceSpeed: speed,
  })
}

describe('createPianoPerformanceTakeMetadata', () => {
  it('groups by stable source, score lane, and range but not practice speed', () => {
    expect(metadata(0.5).comparisonKey).toBe(metadata(1).comparisonKey)
    expect(metadata(1, 12).comparisonKey).not.toBe(metadata(1).comparisonKey)
    expect(metadata(1).comparisonKey).toContain('piano-night:')
  })

  it('copies exact final-pass score truth and non-identifying input kinds', () => {
    const result = metadata(0.75)

    expect(result.context).toMatchObject({
      kind: 'piano-night',
      rangeKind: 'loop',
      rangeStartBeat: 4,
      rangeEndBeat: 8,
      finalPassNumber: 5,
      repeatCount: 5,
      practiceSpeed: 0.75,
      inputKinds: ['midi', 'touch'],
      replayInstrumentId: 'mercury-felt-synth',
      playerOnly: true,
    })
    expect(result.metrics).toEqual({
      score: 875,
      accuracyPercent: 88,
      bestStreak: 9,
      hits: 11,
      misses: 2,
      judgedNotes: 13,
      skippedNotes: 1,
      totalNotes: 14,
      playedNoteCount: 1,
      capturedDurationMs: 1200,
    })
    expect(JSON.stringify(result)).not.toContain('private-device')
  })
})
