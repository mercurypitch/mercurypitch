import { describe, expect, it, vi } from 'vitest'
import type { Achievement, BadgeDefinition, ChallengeDefinition, SessionRecord, UserAchievement, UserBadge, } from '@/db/entities'
import type { GrantContext } from '@/db/services/grant-context'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { exerciseComparabilityKey } from '@/features/exercises/exercise-comparability'
import { EXERCISE_LONG_NOTE } from '@/features/exercises/types'
import type { ProgressModelInput } from './model'
import { buildProgressModel, challengeIdForRecord, PROGRESS_HISTORY_WEEKS, sessionComparisonKey, } from './model'
import type { ProgressDataDependencies } from './progress-data'
import { loadProgressModel } from './progress-data'

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

function voiceprint(
  id: string,
  takenAt: string,
  overrides: Partial<VoiceprintRecord['summary']> = {},
): VoiceprintRecord {
  return {
    id,
    takenAt,
    source: 'mirror',
    twin: null,
    summary: {
      lowMidi: 48,
      highMidi: 72,
      semitones: 24,
      accuracy: 70,
      steadiness: 64,
      ...overrides,
    },
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

describe('Progress read model', () => {
  it('summarizes the loaded record window without inventing duration', () => {
    const records = [
      record('s1', '2026-08-04T10:00:00.000Z', 60),
      record('s2', '2026-08-08T10:00:00.000Z', 70),
      record('s3', '2026-08-10T10:00:00.000Z', 85, {
        source: 'exercise',
        melodyName: 'Pitch hold',
      }),
      record('s4', '2026-08-11T10:00:00.000Z', 90, {
        source: 'challenge',
        melodyName: 'Challenge: Crown line',
      }),
    ]
    const model = buildProgressModel(input({ records }), { now: NOW })

    expect(model.sessions).toMatchObject({
      totalLoaded: 4,
      totalAvailable: 4,
      last7Days: 3,
      last30Days: 4,
      last13Weeks: 4,
      distinctPracticeDays: 4,
      bestScore: 90,
      loadedWindowIsCapped: false,
    })
    expect(model.sourceComposition).toEqual([
      { source: 'practice', count: 2, proportion: 0.5 },
      { source: 'exercise', count: 1, proportion: 0.25 },
      { source: 'challenge', count: 1, proportion: 0.25 },
      { source: 'weekly', count: 0, proportion: 0 },
    ])
    expect(model.activity.weeks).toHaveLength(PROGRESS_HISTORY_WEEKS)
    expect(model.activity.days).toHaveLength(PROGRESS_HISTORY_WEEKS * 7)
    expect(model.activity.fromDate).toBe('2026-05-18')
    expect(model.activity.throughDate).toBe('2026-08-11')
    expect(
      model.activity.days.find((day) => day.date === '2026-08-11'),
    ).toMatchObject({ count: 1, bestScore: 90, sources: ['challenge'] })
    expect(model.coverage.find((item) => item.id === 'duration')).toMatchObject(
      { status: 'unavailable', label: 'Practice minutes not shown' },
    )
  })

  it('calls a score a personal best only after a like-for-like attempt', () => {
    const records = [
      record('first', '2026-08-01T10:00:00.000Z', 60, {
        comparabilityKey: 'voice:practice:warm-up-v1',
      }),
      record('exercise', '2026-08-02T10:00:00.000Z', 95, {
        source: 'exercise',
        comparabilityKey: 'voice:exercise:warm-up-v1',
      }),
      record('lower', '2026-08-03T10:00:00.000Z', 55, {
        comparabilityKey: 'voice:practice:warm-up-v1',
      }),
      record('best', '2026-08-04T10:00:00.000Z', 72, {
        comparabilityKey: 'voice:practice:warm-up-v1',
      }),
      record('other-song', '2026-08-05T10:00:00.000Z', 99, {
        melodyName: 'Another line',
        comparabilityKey: 'voice:practice:another-line-v1',
      }),
    ]
    const model = buildProgressModel(input({ records }), { now: NOW })

    expect(sessionComparisonKey(records[0])).toBe('voice:practice:warm-up-v1')
    expect(
      sessionComparisonKey(record('legacy', NOW.toISOString(), 70)),
    ).toBeNull()
    expect(
      model.scoreTrend.comparablePersonalBests.map((point) => point.recordId),
    ).toEqual(['best'])
    expect(model.scoreTrend.comparablePersonalBests[0]).toMatchObject({
      previousBestScore: 60,
      improvement: 12,
    })
    expect(model.scoreTrend.comparableSeries).toHaveLength(1)
    expect(model.scoreTrend.comparableSeries[0]).toMatchObject({
      comparisonKey: 'voice:practice:warm-up-v1',
      source: 'practice',
    })
    expect(
      model.scoreTrend.comparableSeries[0].points.map(
        (point) => point.recordId,
      ),
    ).toEqual(['first', 'lower', 'best'])
    expect(model.sessions.bestScore).toBe(99)
  })

  it('threads repeated runs of the same drill under the key the funnel now writes (CLAUDE-JOURNEY-007)', () => {
    // The model always threaded records that SHARED a key; plain drill runs
    // simply never carried one, so repeating an exercise never formed a
    // Skill Thread. This pins the two halves together: the funnel's real
    // key, recognised by the model as one comparable series.
    const key = exerciseComparabilityKey(EXERCISE_LONG_NOTE)
    const records = [
      record('run-1', '2026-08-08T10:00:00.000Z', 61, {
        melodyName: 'Exercise: Long Note',
        source: 'exercise',
        comparabilityKey: key,
      }),
      record('run-2', '2026-08-09T10:00:00.000Z', 74, {
        melodyName: 'Exercise: Long Note',
        source: 'exercise',
        comparabilityKey: key,
      }),
    ]
    const model = buildProgressModel(input({ records }), { now: NOW })

    expect(model.scoreTrend.comparableSeries).toHaveLength(1)
    expect(model.scoreTrend.comparableSeries[0]).toMatchObject({
      comparisonKey: key,
      source: 'exercise',
      melodyName: 'Exercise: Long Note',
    })
    expect(
      model.scoreTrend.comparableSeries[0].points.map((p) => p.recordId),
    ).toEqual(['run-1', 'run-2'])
  })

  it('totals measured time only when duration and history coverage are complete', () => {
    const complete = buildProgressModel(
      input({
        records: [
          record('timed-1', '2026-08-10T10:00:00.000Z', 70, {
            durationMs: 60_000,
          }),
          record('timed-2', '2026-08-11T10:00:00.000Z', 80, {
            durationMs: 90_000,
          }),
        ],
        sessionHistory: { complete: true, totalAvailable: 2 },
      }),
      { now: NOW },
    )
    const partial = buildProgressModel(
      input({
        records: [
          record('timed', '2026-08-10T10:00:00.000Z', 70, {
            durationMs: 60_000,
          }),
          record('legacy', '2026-08-11T10:00:00.000Z', 80),
        ],
        sessionHistory: { complete: false, totalAvailable: 10 },
      }),
      { now: NOW },
    )

    expect(complete.duration).toEqual({
      measuredSessions: 2,
      totalLoadedSessions: 2,
      measuredCoverage: 1,
      measuredMs: 150_000,
      completeTotalMs: 150_000,
    })
    expect(partial.duration).toMatchObject({
      measuredSessions: 1,
      measuredCoverage: 0.5,
      measuredMs: 60_000,
      completeTotalMs: null,
    })
    expect(partial.sessions).toMatchObject({
      totalLoaded: 2,
      totalAvailable: 10,
      loadedWindowIsCapped: true,
    })
    expect(partial.coverage.find((item) => item.id === 'sessions')?.label).toBe(
      'Latest 2 of 10 scored sessions',
    )
  })

  it('rejects duration beyond the same one-day boundary as persisted writes', () => {
    const model = buildProgressModel(
      input({
        records: [
          record('boundary', '2026-08-10T10:00:00.000Z', 70, {
            durationMs: 86_400_000,
          }),
          record('corrupt', '2026-08-11T10:00:00.000Z', 80, {
            durationMs: 86_400_001,
          }),
        ],
        sessionHistory: { complete: true, totalAvailable: 2 },
      }),
      { now: NOW },
    )

    expect(model.duration).toMatchObject({
      measuredSessions: 1,
      measuredCoverage: 0.5,
      measuredMs: 86_400_000,
      completeTotalMs: null,
    })
    expect(
      model.recentHistory.find((item) => item.id === 'boundary')?.durationMs,
    ).toBe(86_400_000)
    expect(
      model.recentHistory.find((item) => item.id === 'corrupt')?.durationMs,
    ).toBeNull()
  })

  it('keeps voice growth, streak evidence, recognition and account acts separate', () => {
    const badge: BadgeDefinition = {
      id: 'badge-def',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'First Light',
      description: 'You began.',
      icon: 'first-light',
      tier: 'bronze',
      category: 'basics',
      unlockCondition: 'one run',
      sortOrder: 1,
    }
    const userBadge: UserBadge = {
      id: 'earned-badge',
      createdAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-09T00:00:00.000Z',
      userId: 'user-1',
      badgeId: badge.id,
      earnedAt: '2026-08-09T00:00:00.000Z',
    }
    const achievement: Achievement = {
      id: 'achievement-def',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Regular',
      description: 'Keep showing up.',
      icon: 'regular',
      points: 10,
      condition: 'ten days',
      required: 10,
      sortOrder: 1,
    }
    const userAchievement: UserAchievement = {
      id: 'earned-achievement',
      createdAt: '2026-08-08T00:00:00.000Z',
      updatedAt: '2026-08-08T00:00:00.000Z',
      userId: 'user-1',
      achievementId: achievement.id,
      progress: 100,
      unlocked: true,
      unlockedAt: '2026-08-08T00:00:00.000Z',
    }
    const model = buildProgressModel(
      input({
        records: [
          record('streak', '2026-08-10T10:00:00.000Z', 80, { streak: 7 }),
        ],
        currentStreak: 4,
        voiceprints: [
          voiceprint('old', '2026-06-01T10:00:00.000Z'),
          voiceprint('new', '2026-08-10T10:00:00.000Z', {
            lowMidi: 46,
            highMidi: 75,
            semitones: 29,
            accuracy: 77,
            steadiness: 63,
          }),
        ],
        badgeDefinitions: [badge],
        userBadges: [userBadge],
        achievementDefinitions: [achievement],
        userAchievements: [userAchievement],
        activityRows: [
          { kind: 'melody_created', refId: 'melody-1' },
          { kind: 'melody_created', refId: 'melody-1' },
          { kind: 'song_completed', refId: 'song-1' },
          { kind: 'song_completed', refId: 'song-1' },
        ],
      }),
      { now: NOW },
    )

    expect(model.streak).toEqual({
      current: 4,
      longest: 7,
      longestIsWindowed: false,
    })
    expect(model.voiceprintGrowth).toMatchObject({
      count: 2,
      deltas: {
        lowMidi: -2,
        highMidi: 3,
        semitones: 5,
        accuracy: 7,
        steadiness: -1,
      },
      changedMetrics: 5,
    })
    expect(model.recognition).toMatchObject({
      badges: { earned: 1, total: 1 },
      achievements: { unlocked: 1, inProgress: 0, total: 1 },
    })
    expect(model.activityCounts).toEqual({
      melody_created: 1,
      song_completed: 2,
    })
    expect(model.activityTotal).toBe(3)
    expect(model.oneMoment.kind).toBe('milestone')
    expect(model.oneMoment.headline).toBe('First Light unlocked')
  })
})

describe('One Moment priority', () => {
  it('does not let an old badge or a mutable league standing become the moment', () => {
    const badge: BadgeDefinition = {
      id: 'old-badge-def',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Old Light',
      description: 'Earned earlier.',
      icon: 'old-light',
      tier: 'bronze',
      category: 'basics',
      unlockCondition: 'one run',
      sortOrder: 1,
    }
    const earned: UserBadge = {
      id: 'old-badge-earned',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      userId: 'user-1',
      badgeId: badge.id,
      earnedAt: '2026-08-01T00:00:00.000Z',
    }
    const league = {
      eligible: true,
      weekStart: '2026-08-10T00:00:00.000Z',
      league: {
        id: 'league-1',
        rank: 2,
        name: 'Resonance',
        trophyAsset: null,
        badgeAsset: null,
        isMystery: false,
        promoteCount: 5,
        relegateCount: 3,
      },
      points: 120,
      rank: 4,
      cohortSize: 20,
    }
    const model = buildProgressModel(
      input({
        records: [record('latest', '2026-08-10T10:00:00.000Z', 80)],
        badgeDefinitions: [badge],
        userBadges: [earned],
        league,
      }),
      { now: NOW },
    )

    expect(model.oneMoment.kind).toBe('latest-attempt')
    expect(model.eligibleMoments.map((moment) => moment.kind)).not.toContain(
      'milestone',
    )
    expect(model.eligibleMoments.map((moment) => moment.kind)).not.toContain(
      'league',
    )
    expect(model.league).toBe(league)
  })

  it('requires at least three points before a new best becomes a share story', () => {
    const model = buildProgressModel(
      input({
        records: [
          record('old', '2026-08-09T10:00:00.000Z', 80, {
            comparabilityKey: 'voice:challenge:line-v1',
          }),
          record('plus-one', '2026-08-10T10:00:00.000Z', 81, {
            comparabilityKey: 'voice:challenge:line-v1',
          }),
        ],
      }),
      { now: NOW },
    )

    expect(model.scoreTrend.comparablePersonalBests).toHaveLength(1)
    expect(model.eligibleMoments.map((moment) => moment.kind)).not.toContain(
      'personal-best',
    )
    expect(model.oneMoment.kind).toBe('latest-attempt')
  })

  it('requires a meaningful voiceprint delta before claiming movement', () => {
    const small = buildProgressModel(
      input({
        records: [record('latest', '2026-08-10T10:00:00.000Z', 80)],
        voiceprints: [
          voiceprint('old', '2026-08-01T10:00:00.000Z'),
          voiceprint('small', '2026-08-10T10:00:00.000Z', {
            semitones: 25,
            accuracy: 72,
            steadiness: 62,
          }),
        ],
      }),
      { now: NOW },
    )
    const meaningful = buildProgressModel(
      input({
        records: [record('latest', '2026-08-10T10:00:00.000Z', 80)],
        voiceprints: [
          voiceprint('old', '2026-08-01T10:00:00.000Z'),
          voiceprint('meaningful', '2026-08-10T10:00:00.000Z', {
            semitones: 26,
          }),
        ],
      }),
      { now: NOW },
    )

    expect(small.voiceprintGrowth).toMatchObject({
      changedMetrics: 3,
      hasMeaningfulChange: false,
    })
    expect(small.eligibleMoments.map((moment) => moment.kind)).not.toContain(
      'voiceprint-growth',
    )
    expect(meaningful.voiceprintGrowth.hasMeaningfulChange).toBe(true)
    expect(meaningful.oneMoment.kind).toBe('voiceprint-growth')
  })

  it("does not compare anonymous device voiceprints as one singer's growth", () => {
    const model = buildProgressModel(
      input({
        voiceprints: [
          voiceprint('old', '2026-08-01T10:00:00.000Z'),
          voiceprint('new', '2026-08-10T10:00:00.000Z', {
            semitones: 31,
            accuracy: 90,
          }),
        ],
        voiceprintHistory: {
          complete: true,
          totalAvailable: 2,
          comparable: false,
        },
      }),
      { now: NOW },
    )

    expect(model.voiceprintGrowth.count).toBe(2)
    expect(model.voiceprintGrowth.deltas).toEqual({
      lowMidi: null,
      highMidi: null,
      semitones: null,
      accuracy: null,
      steadiness: null,
    })
    expect(model.voiceprintGrowth.hasMeaningfulChange).toBe(false)
    expect(model.eligibleMoments.map((moment) => moment.kind)).not.toContain(
      'voiceprint-growth',
    )
  })

  it('puts a comparable best ahead of voiceprint growth', () => {
    const model = buildProgressModel(
      input({
        records: [
          record('old', '2026-08-01T10:00:00.000Z', 60, {
            comparabilityKey: 'voice:practice:warm-up-v1',
          }),
          record('pb', '2026-08-10T10:00:00.000Z', 80, {
            comparabilityKey: 'voice:practice:warm-up-v1',
          }),
        ],
        voiceprints: [
          voiceprint('voice-old', '2026-07-01T10:00:00.000Z'),
          voiceprint('voice-new', '2026-08-11T10:00:00.000Z', {
            semitones: 27,
          }),
        ],
      }),
      { now: NOW },
    )

    expect(model.oneMoment).toMatchObject({
      kind: 'personal-best',
      priority: 2,
      recordId: 'pb',
      score: 80,
    })
    expect(model.eligibleMoments.map((moment) => moment.kind)).toEqual([
      'personal-best',
      'voiceprint-growth',
      'return',
      'latest-attempt',
    ])
    expect(model.oneMomentAlternates.map((moment) => moment.kind)).toEqual([
      'voiceprint-growth',
      'return',
      'latest-attempt',
    ])
  })

  it('puts voiceprint movement ahead of consistency', () => {
    const model = buildProgressModel(
      input({
        records: [record('run', '2026-08-10T10:00:00.000Z', 80)],
        currentStreak: 8,
        voiceprints: [
          voiceprint('voice-old', '2026-07-01T10:00:00.000Z'),
          voiceprint('voice-new', '2026-08-11T10:00:00.000Z', {
            accuracy: 75,
          }),
        ],
      }),
      { now: NOW },
    )

    expect(model.oneMoment).toMatchObject({
      kind: 'voiceprint-growth',
      priority: 3,
    })
  })

  it('puts consistency ahead of a challenge, and carries a real trace', () => {
    const challenge: ChallengeDefinition = {
      id: 'challenge-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      category: 'basics',
      title: 'Crown line',
      description: 'Sing the line.',
      difficulty: 'beginner',
      icon: 'crown',
      targetScore: 70,
      isActive: true,
      sortOrder: 1,
    }
    const trace = {
      ownerId: 'user-1',
      score: 88,
      at: Date.parse('2026-08-11T10:02:00.000Z'),
      durationMs: 4_000,
      samples: [[0, 220] as [number, number]],
      targets: [[0, 220] as [number, number]],
    }
    const challengeRun = record(
      'challenge-run',
      '2026-08-11T10:00:00.000Z',
      88,
      {
        source: 'challenge',
        sourceRef: challenge.id,
        melodyName: 'Challenge: renamed display copy',
      },
    )
    const consistent = buildProgressModel(
      input({
        records: [challengeRun],
        currentStreak: 5,
        challengeDefinitions: [challenge],
        challengeTraces: { [challenge.id]: trace },
      }),
      { now: NOW },
    )
    const challengeOnly = buildProgressModel(
      input({
        records: [challengeRun],
        currentStreak: 0,
        challengeDefinitions: [challenge],
        challengeTraces: { [challenge.id]: trace },
      }),
      { now: NOW },
    )
    const staleTrace = { ...trace, at: Date.parse('2026-08-11T09:54:59.000Z') }
    const wrongScoreTrace = { ...trace, score: 87 }
    const challengeWithStaleTrace = buildProgressModel(
      input({
        records: [challengeRun],
        currentStreak: 0,
        challengeDefinitions: [challenge],
        challengeTraces: { [challenge.id]: staleTrace },
      }),
      { now: NOW },
    )
    const challengeWithWrongScoreTrace = buildProgressModel(
      input({
        records: [challengeRun],
        currentStreak: 0,
        challengeDefinitions: [challenge],
        challengeTraces: { [challenge.id]: wrongScoreTrace },
      }),
      { now: NOW },
    )

    expect(consistent.oneMoment.kind).toBe('consistency')
    expect(challengeOnly.oneMoment).toMatchObject({
      kind: 'challenge',
      priority: 5,
      trace,
    })
    expect(challengeWithStaleTrace.oneMoment).not.toHaveProperty('trace')
    expect(challengeWithWrongScoreTrace.oneMoment).not.toHaveProperty('trace')
  })

  it('uses return evidence before the latest-attempt fallback', () => {
    const returning = buildProgressModel(
      input({
        records: [
          record('before', '2026-07-20T10:00:00.000Z', 60, {
            melodyName: 'First line',
          }),
          record('after', '2026-08-10T10:00:00.000Z', 70, {
            melodyName: 'Second line',
          }),
        ],
      }),
      { now: NOW },
    )
    const latestOnly = buildProgressModel(
      input({
        records: [record('only', '2026-08-10T10:00:00.000Z', 70)],
      }),
      { now: NOW },
    )

    expect(returning.oneMoment).toMatchObject({
      kind: 'return',
      priority: 6,
      recordId: 'after',
      returnGapDays: 21,
    })
    expect(latestOnly.oneMoment).toMatchObject({
      kind: 'latest-attempt',
      priority: 7,
      recordId: 'only',
    })
  })

  it('has a truthful empty state', () => {
    const model = buildProgressModel(input(), { now: NOW })
    expect(model.oneMoment).toEqual({
      kind: 'empty',
      priority: null,
      headline: 'Your next moment starts here',
      detail: 'Complete a scored practice run to begin your progress story.',
      occurredAt: null,
    })
    expect(model.eligibleMoments).toEqual([])
    expect(model.oneMomentAlternates).toEqual([])
  })
})

describe('Progress data loader', () => {
  it('keeps the session snapshot when optional account sources fail', async () => {
    const session = record('local-session', '2026-08-10T10:00:00.000Z', 82)
    const dependencies: ProgressDataDependencies = {
      loadProgressGrantContext: vi.fn().mockRejectedValue(new Error('offline')),
      loadProgressSessionRecords: vi.fn().mockResolvedValue({
        records: [session],
        available: true,
        complete: true,
        totalAvailable: 1,
      }),
      loadProgressVoiceprints: vi.fn().mockRejectedValue(new Error('blocked')),
      loadProgressActivityRecords: vi
        .fn()
        .mockRejectedValue(new Error('signed out')),
      fetchLeagueMe: vi.fn().mockRejectedValue(new Error('offline')),
      loadChallengeTrace: vi.fn().mockReturnValue(null),
    }

    const model = await loadProgressModel({ now: NOW, dependencies })

    expect(model.sessions.totalLoaded).toBe(1)
    expect(model.recentHistory[0].id).toBe('local-session')
    expect(model.streak.current).toBeNull()
    expect(model.coverage.find((item) => item.id === 'sessions')?.status).toBe(
      'available',
    )
    expect(
      model.coverage.find((item) => item.id === 'account-activity')?.status,
    ).toBe('unavailable')
    expect(model.recognition.available).toBe(false)
    expect(
      model.coverage.find((item) => item.id === 'recognition')?.status,
    ).toBe('unavailable')
  })

  it('uses the wider session read while reusing grant context metadata', async () => {
    const contextRecord = record('context-only', '2026-08-09T10:00:00.000Z', 70)
    const widerRecord = record('wide-history', '2026-07-01T10:00:00.000Z', 60)
    const context: GrantContext = {
      badges: [],
      userBadges: [],
      achievements: [],
      userAchievements: [],
      records: [contextRecord],
      challengeDefs: [],
      challengeProgress: [],
      activityRows: [],
      currentStreak: 3,
      voiceprintCount: 0,
      followingCount: 0,
      sharesPosted: 0,
    }
    const dependencies: ProgressDataDependencies = {
      loadProgressGrantContext: vi.fn().mockResolvedValue({
        context,
        available: true,
      }),
      loadProgressSessionRecords: vi.fn().mockResolvedValue({
        records: [contextRecord, widerRecord],
        available: true,
        complete: true,
        totalAvailable: 2,
      }),
      loadProgressVoiceprints: vi.fn().mockResolvedValue({
        records: [],
        available: true,
        complete: true,
        totalAvailable: 0,
        comparable: true,
      }),
      loadProgressActivityRecords: vi.fn().mockResolvedValue({
        records: [],
        available: true,
        complete: true,
        totalAvailable: 0,
      }),
      fetchLeagueMe: vi.fn().mockResolvedValue(null),
      loadChallengeTrace: vi.fn().mockReturnValue(null),
    }

    const model = await loadProgressModel({ now: NOW, dependencies })

    expect(model.sessions.totalLoaded).toBe(2)
    expect(model.streak.current).toBe(3)
    expect(dependencies.loadProgressSessionRecords).toHaveBeenCalledWith({
      pageSize: 500,
      maxRecords: 5_000,
    })
    expect(dependencies.loadProgressVoiceprints).toHaveBeenCalledWith({
      pageSize: 500,
      maxRecords: 5_000,
    })
    expect(dependencies.loadProgressActivityRecords).toHaveBeenCalledWith({
      pageSize: 500,
      maxRecords: 5_000,
    })
  })
})

/**
 * Rows written before this release.
 *
 * `0025_sessionRecords_progress.sql` adds the five evidence columns to a table
 * that already had rows, so they are nullable in D1 — and the server adapter
 * hands JSON straight through without normalising. Every record belonging to an
 * account that practised before the Progress tab shipped therefore arrives with
 * literal `null` in those fields, not a missing key.
 *
 * That is not hypothetical: it took the Atlas down on a real signed-in account
 * with `null is not an object (evaluating 'e.sourceRef.trim')`, because
 * `sourceRef !== undefined` is true for `null`.
 */
describe('records from before the Progress migration', () => {
  /** Exactly what D1 returns for a legacy row: present keys, null values. */
  const legacyNulls: Partial<SessionRecord> = {
    instrument: null,
    durationMs: null,
    sourceRef: null,
    sourceVersion: null,
    comparabilityKey: null,
    weeklyChallengeId: null,
  }

  it('builds a model from a record whose evidence columns are all null', () => {
    const records = [
      record('legacy-1', '2026-08-10T10:00:00.000Z', 72, legacyNulls),
    ]

    expect(() =>
      buildProgressModel(input({ records }), { now: NOW }),
    ).not.toThrow()

    const model = buildProgressModel(input({ records }), { now: NOW })
    expect(model.sessions.totalLoaded).toBe(1)
  })

  it.each([
    'instrument',
    'durationMs',
    'sourceRef',
    'sourceVersion',
    'comparabilityKey',
    'weeklyChallengeId',
  ] as const)('survives a null %s on its own', (column) => {
    const records = [
      record('legacy-col', '2026-08-10T10:00:00.000Z', 64, {
        [column]: null,
      } as Partial<SessionRecord>),
    ]

    expect(() =>
      buildProgressModel(input({ records }), { now: NOW }),
    ).not.toThrow()
  })

  it('does not throw resolving a challenge id from a null sourceRef', () => {
    const legacyChallenge = record(
      'legacy-challenge',
      '2026-08-10T10:00:00.000Z',
      88,
      {
        ...legacyNulls,
        source: 'challenge',
        melodyName: 'Challenge: Crown line',
      },
    )

    // The reported crash, at its exact call site.
    expect(() => challengeIdForRecord(legacyChallenge, [])).not.toThrow()
  })

  it('falls back to matching the title when sourceRef is null', () => {
    const legacyChallenge = record(
      'legacy-challenge-2',
      '2026-08-10T10:00:00.000Z',
      91,
      {
        ...legacyNulls,
        source: 'challenge',
        melodyName: 'Challenge: Crown line',
      },
    )
    const definitions = [
      { id: 'crown-line', title: 'Crown line' },
    ] as unknown as ChallengeDefinition[]

    // Null must read as "no reference recorded", not as a reference — a legacy
    // challenge take is still identifiable by its title.
    expect(challengeIdForRecord(legacyChallenge, definitions)).toBe(
      'crown-line',
    )
  })

  it('treats a blank sourceRef the same as an absent one', () => {
    const blank = record('blank-ref', '2026-08-10T10:00:00.000Z', 55, {
      source: 'challenge',
      sourceRef: '   ',
      melodyName: 'Challenge: Nothing matches this',
    })

    expect(challengeIdForRecord(blank, [])).toBeNull()
  })

  it('omits null evidence from history rather than publishing it', () => {
    const records = [
      record('legacy-hist', '2026-08-10T10:00:00.000Z', 77, legacyNulls),
    ]

    const model = buildProgressModel(input({ records }), { now: NOW })
    const item = model.recentHistory.find((h) => h.id === 'legacy-hist')

    // Absent keys, not null values: downstream readers check presence.
    expect(item).toBeDefined()
    expect('sourceRef' in (item ?? {})).toBe(false)
    expect('weeklyChallengeId' in (item ?? {})).toBe(false)
    expect(item?.durationMs).toBeNull()
    expect(item?.instrument).toBe('voice')
  })
})
