// ============================================================
// User activity — what the profile is allowed to claim
// ============================================================
//
// Two rules matter more than the counting. Recording must never surface
// to the singer or interrupt what they were doing: every call site is in
// the middle of something they care about. And signed out it must do
// nothing at all — there is no account to attribute an act to, and
// guessing later whose acts these were is the shared-PC problem the
// voiceprints already had to solve the hard way.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  authed: true,
  userId: 'singer-a',
  fail: false,
  rows: [] as Array<{
    id: string
    userId: string
    kind: string
    refId?: string
    metaJson?: string
    at: string
  }>,
}))

vi.mock('@/lib/defaults', () => ({ API_BASE_URL: 'https://api.test' }))
vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => state.authed,
}))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => state.userId,
}))
vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({
      create: async (row: (typeof state.rows)[number]) => {
        if (state.fail) throw new Error('offline')
        const created = { ...row, id: `row-${state.rows.length}` }
        state.rows.push(created)
        return created
      },
      findAll: async (opts?: { where?: { userId?: string } }) => {
        if (state.fail) throw new Error('offline')
        return state.rows.filter(
          (r) =>
            opts?.where?.userId === undefined || r.userId === opts.where.userId,
        )
      },
    }),
  }),
}))

import { loadActivityCounts, loadRecentActivity, recordActivity, } from '@/db/services/user-activity-service'

beforeEach(() => {
  state.authed = true
  state.userId = 'singer-a'
  state.fail = false
  state.rows = []
  vi.restoreAllMocks()
})

describe('recording an act', () => {
  it('stores it against the signed-in singer', async () => {
    await recordActivity('playlist_created', {
      refId: 'pl-1',
      meta: { songs: 4 },
    })

    expect(state.rows).toHaveLength(1)
    expect(state.rows[0]!.kind).toBe('playlist_created')
    expect(state.rows[0]!.userId).toBe('singer-a')
    expect(state.rows[0]!.refId).toBe('pl-1')
    expect(JSON.parse(state.rows[0]!.metaJson!)).toEqual({ songs: 4 })
  })

  it('does nothing at all when signed out', async () => {
    state.authed = false
    await recordActivity('playlist_completed')
    expect(state.rows).toEqual([])
  })

  it('never throws when the write fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    state.fail = true
    // The caller is mid-celebration; a lost metric is not their problem.
    await expect(recordActivity('song_completed')).resolves.toBeUndefined()
  })

  it('keeps the time it happened, not the time it synced', async () => {
    await recordActivity('ascent_week_completed', {
      at: '2026-08-01T09:00:00.000Z',
    })
    expect(state.rows[0]!.at).toBe('2026-08-01T09:00:00.000Z')
  })
})

describe('reading it back for the profile', () => {
  it('counts by kind', async () => {
    await recordActivity('playlist_created')
    await recordActivity('playlist_created')
    await recordActivity('playlist_completed')

    expect(await loadActivityCounts()).toEqual({
      playlist_created: 2,
      playlist_completed: 1,
    })
  })

  it('shows nothing rather than failing when the account is unreachable', async () => {
    await recordActivity('playlist_created')
    state.fail = true

    expect(await loadActivityCounts()).toEqual({})
    expect(await loadRecentActivity()).toEqual([])
  })

  it('is empty signed out', async () => {
    await recordActivity('playlist_created')
    state.authed = false

    expect(await loadActivityCounts()).toEqual({})
    expect(await loadRecentActivity()).toEqual([])
  })

  it('returns the newest acts first', async () => {
    await recordActivity('playlist_created', { at: '2026-08-01T00:00:00.000Z' })
    await recordActivity('song_completed', { at: '2026-08-03T00:00:00.000Z' })
    await recordActivity('melody_created', { at: '2026-08-02T00:00:00.000Z' })

    expect((await loadRecentActivity()).map((r) => r.kind)).toEqual([
      'song_completed',
      'melody_created',
      'playlist_created',
    ])
  })

  it('does not count another singer acts', async () => {
    await recordActivity('playlist_created')
    state.userId = 'singer-b'

    expect(await loadActivityCounts()).toEqual({})
  })
})
