// ============================================================
// Settings sync — the pull that must not eat someone's climb
// ============================================================
//
// Preferences are last-write-wins, and that is fine: the newest device
// is the best guess for what someone wants. Progress is not a
// preference. If a phone practised offline for three days and then the
// account's staler copy landed on top, those days would be gone with no
// way to get them back.
//
// So the Ascent key is pulled through a merge, and the merged value is
// pushed straight back so both sides agree afterwards.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  authed: true,
  userId: 'singer-a',
  failReads: false,
  failWrites: false,
  rows: [] as Array<{ id: string; userId: string; key: string; value: string }>,
  updates: [] as Array<{ id: string; value: string }>,
  creates: [] as Array<{ key: string; value: string }>,
}))

// Partial: path-progress reads IS_DEV/IS_TEST from the same module.
vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  API_BASE_URL: 'https://api.test',
}))
vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => state.authed,
}))
vi.mock('@/db/services/user-service', () => ({
  authVersion: () => 0,
  getUserId: () => state.userId,
}))
vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({
      findAll: async (opts?: { where?: { key?: string } }) => {
        if (state.failReads) throw new Error('offline')
        return state.rows.filter(
          (r) => opts?.where?.key === undefined || r.key === opts.where.key,
        )
      },
      update: async (id: string, patch: { value: string }) => {
        if (state.failWrites) throw new Error('offline')
        state.updates.push({ id, value: patch.value })
        const row = state.rows.find((r) => r.id === id)
        if (row !== undefined) row.value = patch.value
      },
      create: async (row: { key: string; value: string }) => {
        if (state.failWrites) throw new Error('offline')
        state.creates.push({ key: row.key, value: row.value })
        const created = { ...row, userId: '', id: `srv-${state.rows.length}` }
        state.rows.push(created)
        return created
      },
    }),
  }),
}))

import { pullCloudSettings } from '@/db/services/settings-service'
import { PATH_PROGRESS_KEY } from '@/features/path/path-progress'

const KEY = PATH_PROGRESS_KEY

const climb = (days: string[], over: Record<string, unknown> = {}): string =>
  JSON.stringify({
    pathId: 'ascent',
    startedAt: '2026-08-01T00:00:00.000Z',
    currentWeek: 1,
    weekDays: { 1: days },
    completedWeeks: [],
    ...over,
  })

/** Wait out the un-awaited pushes the pull fires. */
const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  localStorage.clear()
  state.authed = true
  state.userId = 'singer-a'
  state.rows = []
  state.updates = []
  state.creates = []
  state.failReads = false
  state.failWrites = false
})

describe('pulling the Ascent from an account', () => {
  it('keeps days that only the device knows about', async () => {
    localStorage.setItem(KEY, climb(['2026-08-01', '2026-08-02']))
    state.rows = [
      { id: 'r1', userId: 'u', key: KEY, value: climb(['2026-08-03']) },
    ]

    await pullCloudSettings()
    await settle()

    const local = JSON.parse(localStorage.getItem(KEY)!) as {
      weekDays: Record<number, string[]>
    }
    expect(local.weekDays[1]).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ])
    // …and the account is brought up to date, not left behind.
    expect(state.updates.at(-1)?.value).toContain('2026-08-01')
  })

  it('does not overwrite a further climb with a staler one', async () => {
    localStorage.setItem(
      KEY,
      climb(['2026-08-01'], { currentWeek: 4, completedWeeks: [1, 2, 3] }),
    )
    state.rows = [{ id: 'r1', userId: 'u', key: KEY, value: climb([]) }]

    await pullCloudSettings()
    await settle()

    const local = JSON.parse(localStorage.getItem(KEY)!) as {
      currentWeek: number
      completedWeeks: number[]
    }
    expect(local.currentWeek).toBe(4)
    expect(local.completedWeeks).toEqual([1, 2, 3])
  })

  it('uploads a climb the account has never seen', async () => {
    localStorage.setItem(KEY, climb(['2026-08-01']))
    state.rows = [] // fresh account, first sign-in on this device

    await pullCloudSettings()
    await settle()

    expect(state.creates).toHaveLength(1)
    expect(state.creates[0]!.key).toBe(KEY)
    expect(state.creates[0]!.value).toContain('2026-08-01')
  })

  it('takes the account copy when the device has none', async () => {
    state.rows = [
      { id: 'r1', userId: 'u', key: KEY, value: climb(['2026-08-05']) },
    ]

    await pullCloudSettings()
    await settle()

    expect(localStorage.getItem(KEY)).toContain('2026-08-05')
    expect(state.updates).toHaveLength(0) // nothing to push back
  })

  it('prefers the account copy over unparseable local data', async () => {
    localStorage.setItem(KEY, 'not json')
    state.rows = [
      { id: 'r1', userId: 'u', key: KEY, value: climb(['2026-08-05']) },
    ]

    await pullCloudSettings()
    await settle()

    expect(localStorage.getItem(KEY)).toContain('2026-08-05')
  })

  it('leaves ordinary preferences on last-write-wins', async () => {
    localStorage.setItem('pitchperfect_theme', '"midnight"')
    state.rows = [
      { id: 'r1', userId: 'u', key: 'pitchperfect_theme', value: '"dawn"' },
    ]

    await pullCloudSettings()
    await settle()

    expect(localStorage.getItem('pitchperfect_theme')).toBe('"dawn"')
    expect(state.updates).toHaveLength(0)
  })
})

// ── The shared computer ──────────────────────────────────────────
// One household, one laptop, two singers. Logout does not clear
// localStorage, so the previous singer's progress is still sitting there
// when the next one signs in — and a union cannot be undone.

describe('a second account on the same device', () => {
  const OWNER_KEY = 'mp_sync_owner'

  it('does not give one singer the other singer practice days', async () => {
    // Singer A practised here and the device now belongs to them.
    localStorage.setItem(KEY, climb(['2026-08-01', '2026-08-02']))
    localStorage.setItem(OWNER_KEY, 'singer-a')

    // Singer B signs in on the same laptop.
    state.userId = 'singer-b'
    state.rows = [
      { id: 'r1', userId: 'singer-b', key: KEY, value: climb(['2026-08-09']) },
    ]

    await pullCloudSettings()
    await settle()

    const local = JSON.parse(localStorage.getItem(KEY)!) as {
      weekDays: Record<number, string[]>
    }
    // B sees B's climb only — A's days are not absorbed.
    expect(local.weekDays[1]).toEqual(['2026-08-09'])
    // …and nothing of A's was uploaded to B's account.
    expect(state.updates).toHaveLength(0)
    expect(state.creates).toHaveLength(0)
  })

  it('does not upload one singer progress to an account that has none', async () => {
    localStorage.setItem(KEY, climb(['2026-08-01']))
    localStorage.setItem(OWNER_KEY, 'singer-a')
    state.userId = 'singer-b'
    state.rows = [] // B has never climbed

    await pullCloudSettings()
    await settle()

    expect(state.creates).toHaveLength(0)
  })

  it('still merges the signed-out climb of the person signing in', async () => {
    // No owner recorded: this device has only ever been used signed out,
    // so the local climb belongs to whoever is signing in now.
    localStorage.setItem(KEY, climb(['2026-08-01']))
    state.rows = [
      { id: 'r1', userId: 'singer-a', key: KEY, value: climb(['2026-08-05']) },
    ]

    await pullCloudSettings()
    await settle()

    const local = JSON.parse(localStorage.getItem(KEY)!) as {
      weekDays: Record<number, string[]>
    }
    expect(local.weekDays[1]).toEqual(['2026-08-01', '2026-08-05'])
  })

  it('claims the device for the account that just pulled', async () => {
    state.rows = [
      { id: 'r1', userId: 'singer-a', key: KEY, value: climb(['2026-08-05']) },
    ]

    await pullCloudSettings()
    await settle()

    expect(localStorage.getItem(OWNER_KEY)).toBe('singer-a')
  })
})

// ── The rest of the migration matrix ─────────────────────────────
// Device-to-account migration is the moment a local-first app can lose
// someone's work, so the failure modes get named tests rather than a
// hope that the happy path generalises.

describe('when the network or the data misbehaves', () => {
  it('leaves the device untouched when the pull cannot reach the account', async () => {
    localStorage.setItem(KEY, climb(['2026-08-01']))
    state.failReads = true

    await pullCloudSettings()
    await settle()

    // Still exactly what the device had — not cleared, not half-applied.
    const local = JSON.parse(localStorage.getItem(KEY)!) as {
      weekDays: Record<number, string[]>
    }
    expect(local.weekDays[1]).toEqual(['2026-08-01'])
  })

  it('keeps the local copy when the push back fails', async () => {
    localStorage.setItem(KEY, climb(['2026-08-01', '2026-08-02']))
    state.rows = [
      { id: 'r1', userId: 'singer-a', key: KEY, value: climb(['2026-08-03']) },
    ]
    state.failWrites = true

    await pullCloudSettings()
    await settle()

    // The merge still landed on the device: a failed upload must never
    // cost days, and the next pull will carry them up.
    const local = JSON.parse(localStorage.getItem(KEY)!) as {
      weekDays: Record<number, string[]>
    }
    expect(local.weekDays[1]).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ])
  })

  it('does not upload a value too large to be a setting', async () => {
    // A climb cannot really reach 8 KB, but the guard is what stops an
    // unbounded key being added later and quietly filling the table.
    const huge = JSON.stringify({
      pathId: 'ascent',
      startedAt: '2026-08-01T00:00:00.000Z',
      currentWeek: 1,
      weekDays: { 1: Array.from({ length: 2000 }, (_, i) => `pad-${i}`) },
      completedWeeks: [],
    })
    expect(huge.length).toBeGreaterThan(8 * 1024)
    localStorage.setItem(KEY, huge)
    state.rows = []

    await pullCloudSettings()
    await settle()

    expect(state.creates).toHaveLength(0)
  })

  it('counts a day once when both sides already know it', async () => {
    // Two devices that practised the same day must not produce two days.
    localStorage.setItem(KEY, climb(['2026-08-01', '2026-08-02']))
    state.rows = [
      {
        id: 'r1',
        userId: 'singer-a',
        key: KEY,
        value: climb(['2026-08-02', '2026-08-03']),
      },
    ]

    await pullCloudSettings()
    await settle()

    const local = JSON.parse(localStorage.getItem(KEY)!) as {
      weekDays: Record<number, string[]>
    }
    expect(local.weekDays[1]).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ])
  })
})
