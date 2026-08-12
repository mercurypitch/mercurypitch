import { describe, expect, it } from 'vitest'
import type { ProgressModel } from './model'
import { buildProgressModel } from './model'
import { hasProgressLoadFailure, isProgressEmpty, progressModelForKey, progressResourceKey, } from './ProgressRoute'

function emptyModel(): ProgressModel {
  return buildProgressModel(
    {
      records: [],
      voiceprints: [],
      badgeDefinitions: [],
      userBadges: [],
      achievementDefinitions: [],
      userAchievements: [],
      challengeDefinitions: [],
      activityRows: [],
      recentActivity: [],
      league: null,
    },
    { now: new Date('2026-08-11T12:00:00.000Z') },
  )
}

describe('ProgressRoute identity and state helpers', () => {
  it('keys progress reads to both identity and new session writes', () => {
    expect(progressResourceKey(4, 9)).toBe('auth:4:sessions:9')
    expect(progressResourceKey(5, 9)).not.toBe(progressResourceKey(4, 9))
    expect(progressResourceKey(4, 10)).not.toBe(progressResourceKey(4, 9))
  })

  it('never exposes a retained model under a different identity key', () => {
    const model = emptyModel()
    const resolved = {
      status: 'success' as const,
      key: 'auth:1:sessions:2',
      model,
    }

    expect(progressModelForKey(resolved, 'auth:1:sessions:2')).toBe(model)
    expect(progressModelForKey(resolved, 'auth:2:sessions:2')).toBeUndefined()
  })

  it('uses a teaching empty state only when every real progress source is quiet', () => {
    const model = emptyModel()
    expect(isProgressEmpty(model)).toBe(true)
    expect(
      isProgressEmpty({
        ...model,
        voiceprintGrowth: { ...model.voiceprintGrowth, count: 1 },
      }),
    ).toBe(false)
    expect(isProgressEmpty({ ...model, league: { eligible: true } })).toBe(
      false,
    )
    expect(
      isProgressEmpty({
        ...model,
        coverage: model.coverage.map((item) =>
          item.id === 'recognition'
            ? { ...item, status: 'unavailable' as const }
            : item,
        ),
      }),
    ).toBe(false)
  })

  it('does not mistake absent legacy measurements for a load failure', () => {
    const model = emptyModel()
    expect(model.coverage.find((item) => item.id === 'duration')?.status).toBe(
      'unavailable',
    )
    expect(hasProgressLoadFailure(model)).toBe(false)

    expect(
      hasProgressLoadFailure({
        ...model,
        coverage: model.coverage.map((item) =>
          item.id === 'sessions'
            ? { ...item, status: 'unavailable' as const }
            : item,
        ),
      }),
    ).toBe(true)

    expect(
      hasProgressLoadFailure({
        ...model,
        coverage: model.coverage.map((item) =>
          item.id === 'recognition'
            ? { ...item, status: 'unavailable' as const }
            : item,
        ),
      }),
    ).toBe(true)
  })
})
