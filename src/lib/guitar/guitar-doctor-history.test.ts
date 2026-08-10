// Guitar Doctor history tests protect bounded storage and honest comparisons.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { GuitarDoctorHistoryContext, GuitarDoctorHistorySummary, } from './guitar-doctor-history'
import { compareGuitarDoctorSummaries, compareGuitarDoctorWithHistory, GUITAR_DOCTOR_HISTORY_LIMIT, GUITAR_DOCTOR_HISTORY_STORAGE_KEY, loadGuitarDoctorHistory, saveGuitarDoctorHistory, summarizeGuitarDoctorReview, } from './guitar-doctor-history'
import type { GuitarPhraseReview } from './guitar-phrase-review'

const CONTEXT: GuitarDoctorHistoryContext = {
  tempoBpm: 84,
  playbackRate: 1,
  completed: true,
  nonTruncated: true,
  sampleRate: 48_000,
  attackPrecision: 'sample-exact',
  latencyProvenance: 'stored-round-trip',
}

const REVIEW: GuitarPhraseReview = {
  schemaVersion: 1,
  windowId: 'window-secret',
  takeId: 'take-secret',
  referenceId: 'reference-velvet',
  trackId: 'lead-guitar',
  range: { startBeat: 4, endBeat: 8 },
  targetCount: 4,
  eventCount: 5,
  attackCount: 4,
  metrics: {
    timingConsistency: {
      status: 'available',
      confidence: 'supported',
      evidence: {
        eventIds: ['event-a', 'event-b', 'event-c', 'event-d'],
        targetIds: ['target-a', 'target-b', 'target-c', 'target-d'],
      },
      value: { matchedAttacks: 4, medianAbsoluteDeviationMs: 14 },
    },
    calibratedOffset: {
      status: 'available',
      confidence: 'supported',
      evidence: {
        eventIds: ['event-a', 'event-b', 'event-c', 'event-d'],
        targetIds: ['target-a', 'target-b', 'target-c', 'target-d'],
      },
      value: { matchedAttacks: 4, medianOffsetMs: -54, direction: 'early' },
    },
    pitchRelationship: {
      status: 'available',
      confidence: 'supported',
      evidence: {
        eventIds: ['event-a', 'event-b', 'event-c', 'event-d'],
        targetIds: ['target-a', 'target-b', 'target-c', 'target-d'],
      },
      value: {
        comparedEvents: 4,
        exactMidiMatches: 3,
        differentMidiEvents: 1,
        exactMatchRatio: 0.75,
        medianClarity: 0.91,
      },
    },
    attackCompleteness: {
      status: 'unavailable',
      reason: 'reference-lacks-articulation',
      detail: 'Unavailable detail that must not be persisted.',
    },
    sustain: {
      status: 'unavailable',
      reason: 'release-evidence-unavailable',
      detail: 'No release evidence.',
    },
    pitchCenter: {
      status: 'unavailable',
      reason: 'continuous-pitch-unavailable',
      detail: 'No continuous pitch.',
    },
    pitchStability: {
      status: 'unavailable',
      reason: 'continuous-pitch-unavailable',
      detail: 'No continuous pitch.',
    },
  },
  recovery: {
    kind: 'replay',
    label: 'Private recovery copy',
    range: { startBeat: 4, endBeat: 8 },
    countInBeats: 4,
  },
}

function summary(
  changes: Partial<GuitarDoctorHistorySummary> = {},
): GuitarDoctorHistorySummary {
  const base = summarizeGuitarDoctorReview(REVIEW, CONTEXT, 100)
  if (base === null) throw new Error('Expected a valid fixture summary.')
  return { ...base, ...changes }
}

describe('Guitar Doctor history', () => {
  beforeEach(() => localStorage.clear())

  it('persists at most eight scalar-only v1 summaries', () => {
    for (let index = 0; index < 10; index += 1) {
      expect(
        saveGuitarDoctorHistory(localStorage, REVIEW, CONTEXT, index + 1),
      ).not.toBeNull()
    }

    const loaded = loadGuitarDoctorHistory(localStorage)
    expect(loaded).toHaveLength(GUITAR_DOCTOR_HISTORY_LIMIT)
    expect(loaded[0]?.savedAt).toBe(3)
    expect(loaded.at(-1)?.savedAt).toBe(10)
    expect(loaded[0]).toMatchObject({
      schemaVersion: 1,
      referenceId: 'reference-velvet',
      trackId: 'lead-guitar',
      range: { startBeat: 4, endBeat: 8 },
      tempoBpm: 84,
      playbackRate: 1,
      provenance: { completed: true, nonTruncated: true },
      counts: { targets: 4, events: 5, attacks: 4 },
      metrics: {
        calibratedOffset: {
          confidence: 'supported',
          eventCount: 4,
          targetCount: 4,
          matchedAttacks: 4,
          medianOffsetMs: -54,
        },
      },
    })

    const stored = localStorage.getItem(GUITAR_DOCTOR_HISTORY_STORAGE_KEY) ?? ''
    expect(stored).not.toContain('window-secret')
    expect(stored).not.toContain('take-secret')
    expect(stored).not.toContain('event-a')
    expect(stored).not.toContain('target-a')
    expect(stored).not.toContain('eventIds')
    expect(stored).not.toContain('targetIds')
    expect(stored).not.toContain('Private recovery copy')
    expect(stored).not.toContain('Unavailable detail')
  })

  it('drops metrics that do not have complete, compatible provenance', () => {
    const incomplete = summarizeGuitarDoctorReview(REVIEW, {
      ...CONTEXT,
      completed: false,
    })
    const coarse = summarizeGuitarDoctorReview(REVIEW, {
      ...CONTEXT,
      attackPrecision: 'coarse-frame-loop',
      latencyProvenance: 'none',
    })

    expect(incomplete?.metrics).toEqual({})
    expect(coarse?.metrics.timingConsistency).toBeUndefined()
    expect(coarse?.metrics.calibratedOffset).toBeUndefined()
    expect(coarse?.metrics.pitchRelationship).toBeDefined()
  })

  it('treats missing, corrupt, oversized, and unavailable storage as empty', () => {
    expect(loadGuitarDoctorHistory(localStorage)).toEqual([])
    localStorage.setItem(GUITAR_DOCTOR_HISTORY_STORAGE_KEY, '{broken')
    expect(loadGuitarDoctorHistory(localStorage)).toEqual([])
    localStorage.setItem(GUITAR_DOCTOR_HISTORY_STORAGE_KEY, '{}')
    expect(loadGuitarDoctorHistory(localStorage)).toEqual([])
    localStorage.setItem(
      GUITAR_DOCTOR_HISTORY_STORAGE_KEY,
      JSON.stringify(['x'.repeat(33_000)]),
    )
    expect(loadGuitarDoctorHistory(localStorage)).toEqual([])

    const blocked = {
      getItem(): string | null {
        throw new Error('blocked')
      },
      setItem(): void {
        throw new Error('blocked')
      },
    }
    expect(loadGuitarDoctorHistory(blocked)).toEqual([])
    expect(saveGuitarDoctorHistory(blocked, REVIEW, CONTEXT)).toBeNull()
  })

  it('reconstructs canonical summaries and strips unexpected payloads', () => {
    const safe = summary()
    localStorage.setItem(
      GUITAR_DOCTOR_HISTORY_STORAGE_KEY,
      JSON.stringify([
        {
          ...safe,
          rawAudio: 'not allowed',
          events: [{ id: 'event-secret' }],
          metrics: {
            ...safe.metrics,
            calibratedOffset: {
              ...safe.metrics.calibratedOffset,
              eventIds: ['event-secret'],
              targetIds: ['target-secret'],
            },
          },
        },
      ]),
    )

    const loaded = loadGuitarDoctorHistory(localStorage)
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toEqual(safe)
    expect('rawAudio' in (loaded[0] as object)).toBe(false)
    expect('events' in (loaded[0] as object)).toBe(false)
  })

  it('compares the same exact range with compatible evidence', () => {
    const previous = summary()
    const current = summary({
      savedAt: 200,
      metrics: {
        ...previous.metrics,
        calibratedOffset: {
          ...previous.metrics.calibratedOffset!,
          medianOffsetMs: -36,
        },
      },
    })

    expect(compareGuitarDoctorSummaries(previous, current)).toBe(
      'Timing center moved 18 ms closer to the beat.',
    )
  })

  it('refuses comparisons across musical, transport, or evidence boundaries', () => {
    const previous = summary()
    const variants: GuitarDoctorHistorySummary[] = [
      summary({ referenceId: 'another-reference' }),
      summary({ trackId: 'rhythm-guitar' }),
      summary({ range: { startBeat: 5, endBeat: 8 } }),
      summary({ tempoBpm: 85 }),
      summary({ playbackRate: 0.85 }),
      summary({
        provenance: { ...previous.provenance, completed: false },
      }),
      summary({
        provenance: { ...previous.provenance, nonTruncated: false },
      }),
      summary({
        provenance: { ...previous.provenance, sampleRate: 44_100 },
      }),
      summary({
        metrics: {
          ...previous.metrics,
          calibratedOffset: {
            ...previous.metrics.calibratedOffset!,
            confidence: 'limited',
          },
        },
      }),
    ]

    for (const current of variants) {
      expect(compareGuitarDoctorSummaries(previous, current)).toBeNull()
    }
  })

  it('uses the newest compatible history entry and falls back to other metrics', () => {
    const old = summary({ savedAt: 1 })
    const unrelated = summary({ savedAt: 2, referenceId: 'other' })
    const current = summary({
      savedAt: 3,
      metrics: {
        timingConsistency: {
          ...old.metrics.timingConsistency!,
          medianAbsoluteDeviationMs: 9,
        },
      },
    })

    expect(compareGuitarDoctorWithHistory([old, unrelated], current)).toBe(
      'Timing spread narrowed by 5 ms.',
    )
  })
})
