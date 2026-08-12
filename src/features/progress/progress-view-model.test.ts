import { describe, expect, it } from 'vitest'
import type { BadgeDefinition, SessionRecord, UserActivity, UserBadge, } from '@/db/entities'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import type { ProgressMilestone, ProgressModel, ProgressModelInput, } from './model'
import { buildProgressModel } from './model'
import { buildProgressPageSnapshot, findProgressMoment, progressMomentId, } from './progress-view-model'

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
    melodyName: 'Long Note',
    startedAt: at,
    endedAt: at,
    score,
    accuracy: score - 2,
    notesHit: score,
    notesTotal: 100,
    streak: 1,
    source: 'exercise',
    results: [],
    ...overrides,
  }
}

function voiceprint(
  id: string,
  takenAt: string,
  summary: VoiceprintRecord['summary'],
  twin: string | null = null,
): VoiceprintRecord {
  return { id, takenAt, source: 'mirror', twin, summary }
}

function activity(
  id: string,
  kind: UserActivity['kind'],
  at: string,
): UserActivity {
  return {
    id,
    createdAt: at,
    updatedAt: at,
    userId: 'user-1',
    kind,
    refId: id,
    at,
  }
}

function fixture(): ProgressModel {
  const oldBadge: BadgeDefinition = {
    id: 'old-mark',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    name: 'First Light',
    description: 'An earned mark from before the visible chart.',
    icon: 'star',
    tier: 'gold',
    category: 'practice',
    unlockCondition: 'first-session',
    sortOrder: 1,
  }
  const earnedBadge: UserBadge = {
    id: 'earned-old-mark',
    createdAt: '2025-01-02T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
    userId: 'user-1',
    badgeId: oldBadge.id,
    earnedAt: '2025-01-02T00:00:00.000Z',
  }
  const accountActs = [
    activity('song', 'song_completed', '2026-08-07T18:00:00.000Z'),
    activity('playlist-made', 'playlist_created', '2026-08-08T18:00:00.000Z'),
    activity(
      'playlist-finished',
      'playlist_completed',
      '2026-08-09T18:00:00.000Z',
    ),
    activity('stems', 'stems_separated', '2026-08-10T18:00:00.000Z'),
    activity('ascent', 'ascent_week_completed', '2026-08-10T19:00:00.000Z'),
    activity('melody', 'melody_created', '2026-08-11T18:00:00.000Z'),
  ]
  const input: ProgressModelInput = {
    records: [
      record('thread-old', '2026-04-01T10:00:00.000Z', 52, {
        comparabilityKey: 'voice:exercise:long-note-v1',
      }),
      record('thread-a', '2026-07-01T10:00:00.000Z', 61, {
        comparabilityKey: 'voice:exercise:long-note-v1',
      }),
      record('thread-b', '2026-08-09T10:00:00.000Z', 82, {
        comparabilityKey: 'voice:exercise:long-note-v1',
        durationMs: 75_000,
      }),
      record('raw-only', '2026-08-09T11:00:00.000Z', 97, {
        melodyName: 'Crown line',
        source: 'challenge',
        comparabilityKey: undefined,
      }),
    ],
    sessionHistory: { complete: false, totalAvailable: 42 },
    currentStreak: 4,
    voiceprints: [
      voiceprint('voice-old', '2026-01-01T10:00:00.000Z', {
        lowMidi: 36,
        highMidi: 60,
        semitones: 24,
        accuracy: 55,
        steadiness: 50,
      }),
      voiceprint(
        'voice-latest',
        '2026-08-08T10:00:00.000Z',
        {
          lowMidi: 48,
          highMidi: 69,
          semitones: 21,
          accuracy: 88,
          steadiness: 77,
        },
        'Freddie Mercury',
      ),
    ],
    badgeDefinitions: [oldBadge],
    userBadges: [earnedBadge],
    achievementDefinitions: [],
    userAchievements: [],
    challengeDefinitions: [],
    activityRows: accountActs,
    recentActivity: accountActs,
    league: {
      eligible: true,
      weekStart: '2026-08-10',
      points: 124,
      rank: 2,
      cohortSize: 20,
      league: {
        id: 'silver',
        rank: 2,
        name: 'Silver League',
        trophyAsset: '/leagues/silver.webp',
        badgeAsset: null,
        isMystery: false,
        promoteCount: 3,
        relegateCount: 3,
      },
    },
  }
  return buildProgressModel(input, { now: NOW })
}

describe('progress page view model', () => {
  it('keeps the Atlas to one normalized 13-week window and labels capped history honestly', () => {
    const model = fixture()
    const snapshot = buildProgressPageSnapshot(model, { accountHeld: true })

    expect(snapshot.periodOptions).toEqual([
      { id: '13-weeks', label: '13 weeks' },
    ])
    expect(snapshot.periodContext).toBe('Scored voice practice')
    expect(snapshot.weeks).toHaveLength(13)
    expect(Math.max(...snapshot.weeks.map((week) => week.activityLevel))).toBe(
      1,
    )
    expect(snapshot.weeks.every((week) => week.coverage === 'partial')).toBe(
      true,
    )
    expect(
      snapshot.weeks.find((week) => week.attemptsLabel === '0 attempts')
        ?.summary,
    ).toContain('appears in the loaded history')
    expect(snapshot.milestones.map((milestone) => milestone.title)).toContain(
      'First Light',
    )

    const milestones: ProgressMilestone[] = Array.from(
      { length: 9 },
      (_, index) => ({
        id: `mark-${index}`,
        kind: 'achievement',
        name: `Mark ${index}`,
        description: 'Earned evidence',
        icon: 'star',
        occurredAt: `2025-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      }),
    )
    const bounded = buildProgressPageSnapshot(
      {
        ...model,
        recognition: { ...model.recognition, milestones },
      },
      { accountHeld: true },
    )
    expect(bounded.milestones.map((milestone) => milestone.id)).toEqual(
      milestones.slice(0, 8).map((milestone) => milestone.id),
    )
  })

  it('connects only explicit comparable scores and uses only the latest voiceprint metrics', () => {
    const model = fixture()
    const personalBest = model.eligibleMoments.find(
      (moment) => moment.kind === 'personal-best',
    )
    expect(personalBest).toBeDefined()
    if (personalBest === undefined) return

    const selectedId = progressMomentId(personalBest)
    const snapshot = buildProgressPageSnapshot(model, {
      accountHeld: true,
      selectedMomentId: selectedId,
      historyFilterId: 'exercise',
    })

    expect(findProgressMoment(model, selectedId)).toBe(personalBest)
    expect(snapshot.moment.id).toBe(selectedId)
    expect(snapshot.skillThreads).toHaveLength(1)
    expect(snapshot.skillThreads[0].points.map((point) => point.id)).toEqual([
      'thread-a',
      'thread-b',
    ])
    expect(
      snapshot.skillThreads.flatMap((thread) =>
        thread.points.map((point) => point.id),
      ),
    ).not.toContain('raw-only')
    expect(
      Object.fromEntries(
        snapshot.voice?.metrics.map((metric) => [metric.id, metric.value]) ??
          [],
      ),
    ).toEqual({
      range: 'C3–A4',
      span: '21 semitones',
      accuracy: '88%',
      steadiness: '77%',
    })
    expect(
      snapshot.history.items.every((item) => item.source === 'exercise'),
    ).toBe(true)
  })

  it('adds real account acts to Practice Paths without treating them as 13-week scores', () => {
    const snapshot = buildProgressPageSnapshot(fixture(), {
      accountHeld: false,
    })
    const accountPaths = snapshot.paths.segments.filter((segment) =>
      segment.id.startsWith('path:account:'),
    )

    expect(accountPaths.map((segment) => segment.label)).toEqual([
      'Karaoke performances',
      'Playlists made',
      'Playlists completed',
      'Stems separated',
      'Melodies created',
      'Ascent weeks',
    ])
    expect(
      accountPaths.every(
        (segment) =>
          segment.source === undefined &&
          segment.detail.endsWith('recorded overall'),
      ),
    ).toBe(true)
    expect(snapshot.paths.summary).toContain(
      'account acts are recorded overall',
    )
    expect(snapshot.paths.recommendation).toMatchObject({
      label: 'Open Compose',
      href: '#/compose',
    })
    expect(
      accountPaths.find((segment) => segment.label === 'Melodies created')
        ?.status,
    ).toBe('current')
    expect(snapshot.league).toMatchObject({
      title: 'Silver League',
      rankLabel: 'Rank 2 of 20',
      zoneLabel: 'Promotion zone',
    })
    expect(snapshot.coverage).toMatchObject({
      scopeLabel: 'On this device',
      status: 'device-only',
    })
    expect(snapshot.coverage.continuityAction).toBeDefined()
  })
})
