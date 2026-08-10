// Phrase-review presentation tests protect honest copy and compact hierarchy.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarPhraseReview } from '@/lib/guitar/guitar-phrase-review'
import type { GuitarTakeSnapshot } from '@/lib/guitar/guitar-take-recorder'
import { guitarPhraseDoctorView, retainedTakeHealth, } from './guitar-phrase-doctor-view'

function unavailable(
  reason: 'continuous-pitch-unavailable' | 'reference-lacks-articulation',
) {
  return {
    status: 'unavailable' as const,
    reason,
    detail:
      reason === 'reference-lacks-articulation'
        ? 'The tab does not identify every picked attack.'
        : 'Continuous pitch evidence is unavailable.',
  }
}

function review(): GuitarPhraseReview {
  return {
    schemaVersion: 1,
    windowId: 'window-1',
    takeId: 'take-1',
    referenceId: 'song-1',
    trackId: 'lead',
    range: { startBeat: 4, endBeat: 8 },
    targetCount: 4,
    eventCount: 4,
    attackCount: 4,
    metrics: {
      calibratedOffset: {
        status: 'available',
        value: { matchedAttacks: 4, medianOffsetMs: -54, direction: 'early' },
        confidence: 'supported',
        evidence: { eventIds: ['e1'], targetIds: ['n1'] },
      },
      timingConsistency: {
        status: 'available',
        value: { matchedAttacks: 4, medianAbsoluteDeviationMs: 12 },
        confidence: 'supported',
        evidence: { eventIds: ['e1'], targetIds: ['n1'] },
      },
      pitchRelationship: {
        status: 'available',
        value: {
          comparedEvents: 4,
          exactMidiMatches: 4,
          differentMidiEvents: 0,
          exactMatchRatio: 1,
          medianClarity: 0.9,
        },
        confidence: 'supported',
        evidence: { eventIds: ['e1'], targetIds: ['n1'] },
      },
      attackCompleteness: unavailable('reference-lacks-articulation'),
      sustain: unavailable('continuous-pitch-unavailable'),
      pitchCenter: unavailable('continuous-pitch-unavailable'),
      pitchStability: unavailable('continuous-pitch-unavailable'),
    },
    recovery: {
      kind: 'replay',
      label: 'Replay this range',
      range: { startBeat: 4, endBeat: 8 },
      countInBeats: 4,
    },
  }
}

describe('guitarPhraseDoctorView', () => {
  it('leads with one evidence-backed issue and no invented score', () => {
    const view = guitarPhraseDoctorView(review(), 84)

    expect(view.anchorLabel).toBe('Beat 5 · 4 beats · 84 BPM')
    expect(view.headline).toBe('The phrase lands 54 ms early.')
    expect(view.evidence.map((row) => row.label)).toEqual([
      'Note starts',
      'Median timing',
      'Timing spread',
      'Clear pitches',
    ])
    expect(view.recoveryLabel).toBe('Replay this range')
    expect(JSON.stringify(view)).not.toContain('% accuracy')
  })

  it('describes the same bounded tempo the recovery action will apply', () => {
    const slowReview: GuitarPhraseReview = {
      ...review(),
      recovery: {
        kind: 'slow-down',
        label: 'Slow down this range',
        range: { startBeat: 4, endBeat: 8 },
        tempoScale: 0.85,
      },
    }

    expect(guitarPhraseDoctorView(slowReview, 40).recoveryDetail).toBe(
      '40 BPM · same range',
    )
  })

  it('collapses take health conservatively without storing samples', () => {
    const take = {
      events: [],
      inputHealth: {
        readings: 10,
        states: {
          silent: 3,
          quiet: 4,
          good: 2,
          hot: 0,
          clipping: 1,
          noisy: 0,
        },
      },
    } as unknown as GuitarTakeSnapshot

    expect(retainedTakeHealth(take)?.state).toBe('clipping')
  })
})
