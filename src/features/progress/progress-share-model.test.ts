import { describe, expect, it } from 'vitest'
import type { SessionRecord } from '@/db/entities'
import type { StoredChallengeTrace } from '@/features/challenges/challenge-trace'
import type { ProgressModel, ProgressModelInput, ProgressOneMoment, ProgressVoiceprintGrowth, } from './model'
import { buildProgressModel } from './model'
import { buildProgressShareMoment } from './progress-share-model'

const NOW = new Date('2026-08-11T12:00:00.000Z')

function record(
  id: string,
  at: string,
  score: number,
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    id,
    createdAt: at,
    updatedAt: at,
    userId: 'user-1',
    melodyName: 'Warm-up line',
    startedAt: at,
    endedAt: at,
    score,
    accuracy: score,
    notesHit: score,
    notesTotal: 100,
    streak: 1,
    source: 'practice',
    results: [],
    ...overrides,
  }
}

function input(
  overrides: Partial<ProgressModelInput> = {},
): ProgressModelInput {
  return {
    records: [],
    currentStreak: 0,
    voiceprints: [],
    badgeDefinitions: [],
    userBadges: [],
    achievementDefinitions: [],
    userAchievements: [],
    challengeDefinitions: [],
    activityRows: [],
    recentActivity: [],
    league: null,
    ...overrides,
  }
}

function model(overrides: Partial<ProgressModelInput> = {}): ProgressModel {
  return buildProgressModel(input(overrides), { now: NOW })
}

describe('buildProgressShareMoment', () => {
  it('preserves the selected claim and context without exposing identity', () => {
    const run = record('latest', '2026-08-11T10:00:00.000Z', 84, {
      accuracy: 91,
      notesHit: 18,
      notesTotal: 20,
      source: 'exercise',
    })
    const progress = model({ records: [run] })
    const selected: ProgressOneMoment = {
      kind: 'latest-attempt',
      priority: 7,
      headline: 'Latest practice: 84%',
      detail: 'Long Note',
      occurredAt: run.endedAt,
      recordId: run.id,
      score: run.score,
      source: run.source,
    }

    expect(buildProgressShareMoment(selected, progress)).toEqual({
      claim: 'Latest practice: 84%',
      context: 'Long Note',
      period: 'Aug 11, 2026',
      handle: null,
      facts: [
        { value: '84%', label: 'score' },
        { value: '91%', label: 'pitch accuracy' },
        { value: '18 / 20', label: 'notes hit' },
      ],
      trace: undefined,
    })
  })

  it('adds only persisted like-for-like personal-best evidence', () => {
    const records = [
      record('first', '2026-08-01T10:00:00.000Z', 60, {
        comparabilityKey: 'voice:practice:long-note-v1',
      }),
      record('best', '2026-08-10T10:00:00.000Z', 74, {
        comparabilityKey: 'voice:practice:long-note-v1',
      }),
    ]
    const progress = model({ records })
    const selected: ProgressOneMoment = {
      kind: 'personal-best',
      priority: 2,
      headline: 'A new best on Long Note',
      detail: 'Up 14 points from your previous best.',
      occurredAt: records[1].endedAt,
      recordId: 'best',
      score: 74,
      source: 'practice',
    }

    expect(buildProgressShareMoment(selected, progress).facts).toEqual([
      { value: '74%', label: 'new comparable best' },
      { value: '60%', label: 'previous comparable best' },
      { value: '+14', label: 'points vs prior best' },
    ])

    expect(
      buildProgressShareMoment({ ...selected, recordId: 'unknown' }, progress)
        .facts,
    ).toEqual([{ value: '74%', label: 'new comparable best' }])
  })

  it('includes only measured voiceprint deltas and dates the comparison', () => {
    const progress = model()
    const growth: ProgressVoiceprintGrowth = {
      count: 2,
      first: {
        id: 'first',
        takenAt: '2026-06-01T10:00:00.000Z',
        source: 'mirror',
        twin: null,
        summary: {
          lowMidi: 48,
          highMidi: 72,
          semitones: 24,
          accuracy: 70,
          steadiness: null,
        },
      },
      latest: {
        id: 'latest',
        takenAt: '2026-08-11T10:00:00.000Z',
        source: 'mirror',
        twin: null,
        summary: {
          lowMidi: 48,
          highMidi: 75,
          semitones: 27,
          accuracy: 74,
          steadiness: null,
        },
      },
      deltas: {
        lowMidi: 0,
        highMidi: 3,
        semitones: 3,
        accuracy: 4,
        steadiness: null,
      },
      changedMetrics: 3,
      hasMeaningfulChange: true,
    }
    const selected: ProgressOneMoment = {
      kind: 'voiceprint-growth',
      priority: 3,
      headline: 'Your voiceprint moved',
      detail: '+3 semitones of range, +4 accuracy',
      occurredAt: growth.latest?.takenAt ?? null,
      voiceprintGrowth: growth,
    }

    const shared = buildProgressShareMoment(selected, progress)
    expect(shared.facts).toEqual([
      { value: '+3 st', label: 'range span change' },
      { value: '+4 pts', label: 'accuracy change' },
      { value: '2', label: 'measured voiceprints' },
    ])
    expect(shared.period).toBe('Jun 1, 2026 – Aug 11, 2026')
  })

  it('maps only valid voiced challenge samples to MIDI and leaves bounding to the renderer', () => {
    const samples: StoredChallengeTrace['samples'] = Array.from(
      { length: 1_000 },
      (_, index) => [index / 100, 440 * 2 ** ((index % 12) / 12)],
    )
    samples.splice(
      2,
      0,
      [0.01, 0],
      [Number.NaN, 220],
      [0.02, Number.POSITIVE_INFINITY],
      [-1, 220],
    )
    const trace: StoredChallengeTrace = {
      ownerId: 'user-1',
      score: 88,
      at: NOW.getTime(),
      durationMs: 10_000,
      samples,
      targets: [],
    }
    const selected: ProgressOneMoment = {
      kind: 'challenge',
      priority: 5,
      headline: '88% on Weekly Legend: The Show Must Go On',
      detail: 'Your latest weekly Legend attempt.',
      occurredAt: NOW.toISOString(),
      recordId: 'weekly-run',
      score: 88,
      source: 'weekly',
      trace,
    }

    const shared = buildProgressShareMoment(selected, model())
    expect(shared.trace?.points).toHaveLength(1_000)
    expect(shared.trace?.points[0]).toEqual({ time: 0, pitch: 69 })
    expect(shared.trace?.points[1].pitch).toBeCloseTo(70)
    expect(shared.trace?.description).toBe(
      'Best saved pitch contour for this Weekly Legend',
    )
    expect(
      shared.trace?.points.every(
        (point) =>
          Number.isFinite(point.time) &&
          point.time >= 0 &&
          point.pitch !== null &&
          Number.isFinite(point.pitch),
      ),
    ).toBe(true)
  })

  it('omits a trace that cannot form a real contour', () => {
    const selected: ProgressOneMoment = {
      kind: 'challenge',
      priority: 5,
      headline: 'Challenge complete',
      detail: 'Your latest challenge attempt.',
      occurredAt: NOW.toISOString(),
      source: 'challenge',
      trace: {
        ownerId: 'user-1',
        score: 80,
        at: NOW.getTime(),
        durationMs: 1_000,
        samples: [
          [0, 0],
          [1, 440],
        ],
        targets: [],
      },
    }

    expect(buildProgressShareMoment(selected, model()).trace).toBeUndefined()
  })

  it('never pads sparse evidence with unrelated dashboard totals', () => {
    const selected: ProgressOneMoment = {
      kind: 'return',
      priority: 6,
      headline: 'You came back',
      detail: 'This practice followed a 12-day gap.',
      occurredAt: '2026-08-11T10:00:00.000Z',
      returnGapDays: 12,
    }
    const progress = model({
      records: [record('unrelated', '2026-08-10T10:00:00.000Z', 99)],
      currentStreak: 9,
    })

    const shared = buildProgressShareMoment(selected, progress)
    expect(shared.facts).toEqual([
      { value: '12', label: 'days between practices' },
    ])
    expect(shared.facts).toHaveLength(1)
  })
})
