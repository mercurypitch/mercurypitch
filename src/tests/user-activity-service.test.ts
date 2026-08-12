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

interface ActivityQueryOptions {
  where?: { userId?: string }
  orderBy?: string
  orderDir?: 'asc' | 'desc'
  limit?: number
  offset?: number
  throwOnError?: boolean
}

const state = vi.hoisted(() => ({
  authed: true,
  userId: 'singer-a',
  fail: false,
  dbGate: null as Promise<void> | null,
  afterFindAll: null as (() => void) | null,
  findAllOptions: [] as ActivityQueryOptions[],
  countOptions: [] as ActivityQueryOptions[],
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
  getDb: async () => {
    if (state.dbGate !== null) await state.dbGate
    return {
      getRepository: () => ({
        create: async (row: (typeof state.rows)[number]) => {
          if (state.fail) throw new Error('offline')
          const created = { ...row, id: `row-${state.rows.length}` }
          state.rows.push(created)
          return created
        },
        findAll: async (opts?: ActivityQueryOptions) => {
          state.findAllOptions.push(opts ?? {})
          if (state.fail) throw new Error('offline')
          const rows = state.rows.filter(
            (r) =>
              opts?.where?.userId === undefined ||
              r.userId === opts.where.userId,
          )
          if (opts?.orderBy === 'at') {
            rows.sort((a, b) =>
              opts.orderDir === 'desc'
                ? b.at.localeCompare(a.at)
                : a.at.localeCompare(b.at),
            )
          }
          const page = rows.slice(
            opts?.offset ?? 0,
            (opts?.offset ?? 0) + (opts?.limit ?? rows.length),
          )
          state.afterFindAll?.()
          return page
        },
        count: async (opts?: ActivityQueryOptions) => {
          state.countOptions.push(opts ?? {})
          if (state.fail) throw new Error('offline')
          return state.rows.filter(
            (r) =>
              opts?.where?.userId === undefined ||
              r.userId === opts.where.userId,
          ).length
        },
      }),
    }
  },
}))

import { loadActivityCounts, loadProgressActivityRecords, loadRecentActivity, recordActivity, } from '@/db/services/user-activity-service'

beforeEach(() => {
  state.authed = true
  state.userId = 'singer-a'
  state.fail = false
  state.dbGate = null
  state.afterFindAll = null
  state.findAllOptions = []
  state.countOptions = []
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

  it('drops an in-flight act instead of assigning it to the next account', async () => {
    let releaseDb = (): void => undefined
    state.dbGate = new Promise<void>((resolve) => {
      releaseDb = resolve
    })

    const recording = recordActivity('playlist_completed')
    state.userId = 'singer-b'
    releaseDb()
    await recording

    expect(state.rows).toEqual([])
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

describe('reading audited activity for Progress', () => {
  function seedActivityRows(count: number): void {
    state.rows = Array.from({ length: count }, (_, index) => ({
      id: `row-${index}`,
      userId: 'singer-a',
      kind: 'song_completed',
      at: new Date(Date.UTC(2026, 7, 1, 0, 0, index)).toISOString(),
    }))
  }

  it('pages to the safety cap and reports that more account history exists', async () => {
    seedActivityRows(7)

    const result = await loadProgressActivityRecords({
      pageSize: 2,
      maxRecords: 5,
    })

    expect(result.records.map((record) => record.id)).toEqual([
      'row-6',
      'row-5',
      'row-4',
      'row-3',
      'row-2',
    ])
    expect(result.available).toBe(true)
    expect(result.complete).toBe(false)
    expect(result.totalAvailable).toBe(7)
    expect(state.findAllOptions).toEqual([
      expect.objectContaining({ offset: 0, limit: 2, throwOnError: true }),
      expect.objectContaining({ offset: 2, limit: 2, throwOnError: true }),
      expect.objectContaining({ offset: 4, limit: 1, throwOnError: true }),
    ])
    expect(state.countOptions).toHaveLength(2)
    expect(state.countOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          where: { userId: 'singer-a' },
          throwOnError: true,
        }),
      ]),
    )
  })

  it('returns an unavailable envelope when the audited repository read fails', async () => {
    seedActivityRows(1)
    state.fail = true

    await expect(loadProgressActivityRecords()).resolves.toEqual({
      records: [],
      available: false,
      complete: false,
      totalAvailable: null,
    })
  })

  it('discards an in-flight page when the signed-in identity changes', async () => {
    seedActivityRows(2)
    state.afterFindAll = () => {
      state.afterFindAll = null
      state.userId = 'singer-b'
    }

    await expect(loadProgressActivityRecords({ pageSize: 1 })).resolves.toEqual(
      {
        records: [],
        available: false,
        complete: false,
        totalAvailable: null,
      },
    )
    expect(state.findAllOptions[0]?.where).toEqual({ userId: 'singer-a' })
  })
})
