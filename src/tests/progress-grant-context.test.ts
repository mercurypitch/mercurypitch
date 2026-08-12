// ============================================================
// Progress grant context — availability and identity isolation
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  userId: 'singer-a',
}))

vi.mock('@/lib/defaults', () => ({ API_BASE_URL: 'https://api.test' }))
vi.mock('@/db/seed', () => ({ getUserId: () => state.userId }))
vi.mock('@/db/services/auth-service', () => ({ hasValidToken: () => true }))
vi.mock('@/db/services/user-service', () => ({
  getAuthHeaders: () => ({ Authorization: 'Bearer test' }),
}))
vi.mock('@/db', () => ({ getDb: vi.fn() }))
vi.mock('@/db/services/challenges-service', () => ({
  loadAchievementDefinitions: vi.fn(),
  loadBadgeDefinitions: vi.fn(),
  loadChallengeDefinitions: vi.fn(),
  loadChallengeProgress: vi.fn(),
  loadUserAchievements: vi.fn(),
  loadUserBadges: vi.fn(),
}))
vi.mock('@/db/services/follow-service', () => ({ getFollowing: vi.fn() }))
vi.mock('@/db/services/session-service', () => ({
  loadSessionRecords: vi.fn(),
}))
vi.mock('@/db/services/streak-service', () => ({
  computeStreakState: () => ({ currentStreak: 4 }),
  getCurrentStreak: vi.fn(),
  streakFieldsOf: () => ({}),
  todayDateString: () => '2026-08-12',
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  listVoiceprints: vi.fn(),
}))

import { loadProgressGrantContext } from '@/db/services/grant-context'

function bulkResponse(): Response {
  return {
    ok: true,
    json: async () => ({
      badgeDefinitions: [],
      userBadges: [],
      achievements: [],
      userAchievements: [],
      sessionRecords: [],
      challengeDefinitions: [],
      challengeProgress: [],
      userActivity: [],
      profile: null,
      voiceprintCount: 0,
      followingCount: 0,
      sharesPosted: 0,
    }),
  } as Response
}

beforeEach(() => {
  state.userId = 'singer-a'
  vi.unstubAllGlobals()
})

describe('Progress grant context', () => {
  it('reports the account evidence unavailable when the audited bulk read fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(loadProgressGrantContext()).resolves.toEqual({
      context: null,
      available: false,
    })
  })

  it('discards an in-flight account response after the identity changes', async () => {
    let releaseFetch = (_response: Response): void => undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            releaseFetch = resolve
          }),
      ),
    )

    const loading = loadProgressGrantContext()
    state.userId = 'singer-b'
    releaseFetch(bulkResponse())

    await expect(loading).resolves.toEqual({
      context: null,
      available: false,
    })
  })
})
