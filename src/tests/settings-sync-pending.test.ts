// ============================================================
// Settings sync — a choice you watched take effect must not revert
// ============================================================
//
// Reported 2026-09-10: switch the theme, reload, and the old theme is back.
//
// Two defects, and only fixing both closes it. A push is debounced 1500 ms,
// so a reload inside that window kills the timer and the upload never
// happens; and the pull applies the account's row unconditionally, so the
// value it writes back over the top is the STALE one. Being faster only
// narrows the first — the same loss happens on a crash, a closed laptop, or
// a push that fails offline — so the pull has to be able to tell that the
// local value is the newer one.
//
// It tells by a ledger in localStorage, written synchronously before the
// debounce. localStorage, because the page that is about to upload the value
// is the page that is going away.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  authed: true,
  upgraded: true,
  userId: 'singer-a',
  failWrites: false,
  rows: [] as Array<{ id: string; userId: string; key: string; value: string }>,
  updates: [] as Array<{ id: string; value: string }>,
  creates: [] as Array<{ key: string; value: string }>,
}))

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  API_BASE_URL: 'https://api.test',
}))
vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => state.authed,
  hasUpgradedAccount: () => state.authed && state.upgraded,
}))
vi.mock('@/db/services/user-service', () => ({
  authVersion: () => 0,
  getUserId: () => state.userId,
  getDeviceId: () => 'device-1',
}))
vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({
      findAll: async (opts?: { where?: { key?: string } }) =>
        state.rows.filter(
          (r) => opts?.where?.key === undefined || r.key === opts.where.key,
        ),
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

import { createRoot } from 'solid-js'
import { initSettingsSync, pullCloudSettings, } from '@/db/services/settings-service'
import { createPersistedSignal, onPersistedWrite } from '@/lib/storage'

const THEME = 'pitchperfect_theme'
const PENDING = 'mp_sync_pending'

/** Wait out the un-awaited pushes the pull fires. */
const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

/** What the page that went away would have left behind. */
function leaveUnsent(owner: string, values: Record<string, string>): void {
  localStorage.setItem(PENDING, JSON.stringify({ owner, values }))
}

const ledger = (): Record<string, string> | null => {
  const raw = localStorage.getItem(PENDING)
  return raw === null
    ? null
    : (JSON.parse(raw) as { values: Record<string, string> }).values
}

beforeEach(() => {
  localStorage.clear()
  state.authed = true
  state.upgraded = true
  state.userId = 'singer-a'
  state.failWrites = false
  state.rows = []
  state.updates = []
  state.creates = []
})

describe('a local write the account has not seen yet', () => {
  it('survives the pull instead of being overwritten by the older row', async () => {
    // The reload the bug report describes: dawn was chosen and written
    // locally, the debounce never fired, the account still holds midnight.
    localStorage.setItem(THEME, '"dawn"')
    leaveUnsent('singer-a', { [THEME]: '"dawn"' })
    state.rows = [{ id: 'r1', userId: 'u', key: THEME, value: '"midnight"' }]

    await pullCloudSettings()
    await settle()

    expect(localStorage.getItem(THEME)).toBe('"dawn"')
  })

  it('is uploaded, so the account stops being stale', async () => {
    localStorage.setItem(THEME, '"dawn"')
    leaveUnsent('singer-a', { [THEME]: '"dawn"' })
    state.rows = [{ id: 'r1', userId: 'u', key: THEME, value: '"midnight"' }]

    await pullCloudSettings()
    await settle()

    expect(state.updates).toEqual([{ id: 'r1', value: '"dawn"' }])
    // Sent once. The pull loop deliberately leaves the upload to the flush
    // that follows it rather than racing a second push of its own.
    expect(state.updates).toHaveLength(1)
  })

  it('stops being defended once the account agrees', async () => {
    localStorage.setItem(THEME, '"dawn"')
    leaveUnsent('singer-a', { [THEME]: '"dawn"' })
    state.rows = [{ id: 'r1', userId: 'u', key: THEME, value: '"dawn"' }]

    await pullCloudSettings()
    await settle()

    expect(ledger()).toBeNull()
    expect(state.updates).toHaveLength(0)
  })

  it('stays in the ledger when the upload fails, for the next pull to retry', async () => {
    localStorage.setItem(THEME, '"dawn"')
    leaveUnsent('singer-a', { [THEME]: '"dawn"' })
    state.rows = [{ id: 'r1', userId: 'u', key: THEME, value: '"midnight"' }]
    state.failWrites = true

    await pullCloudSettings()
    await settle()

    expect(localStorage.getItem(THEME)).toBe('"dawn"')
    expect(ledger()).toEqual({ [THEME]: '"dawn"' })
  })

  it('reaches a key the account has no row for at all', async () => {
    localStorage.setItem(THEME, '"dawn"')
    leaveUnsent('singer-a', { [THEME]: '"dawn"' })

    await pullCloudSettings()
    await settle()

    expect(state.creates).toEqual([{ key: THEME, value: '"dawn"' }])
  })
})

describe('without an unsent write, the account still wins', () => {
  it('applies the account row over a device value', async () => {
    // The documented rule, and the reason the guard is a ledger rather than
    // "local always wins": a second device's newer choice must still land.
    localStorage.setItem(THEME, '"midnight"')
    state.rows = [{ id: 'r1', userId: 'u', key: THEME, value: '"dawn"' }]

    await pullCloudSettings()
    await settle()

    expect(localStorage.getItem(THEME)).toBe('"dawn"')
    expect(state.updates).toHaveLength(0)
  })
})

describe('recording the write', () => {
  it('lands in the ledger before the debounce, not after it', async () => {
    // The guarantee the whole fix rests on. If this were written when the
    // timer fires, the reload that kills the timer would take the record
    // with it and there would be nothing for the next pull to defend.
    const dispose = createRoot((d) => {
      initSettingsSync()
      return d
    })
    try {
      const [, setTheme] = createPersistedSignal(THEME, 'midnight')
      setTheme('dawn')

      // No timers advanced, nothing awaited. The ledger holds exactly what
      // went to localStorage, whatever this signal's serializer made of it.
      expect(ledger()).toEqual({ [THEME]: localStorage.getItem(THEME) })
      expect(state.updates).toHaveLength(0)
      expect(state.creates).toHaveLength(0)
    } finally {
      onPersistedWrite(null)
      dispose()
    }
    await settle()
  })
})

describe('a ledger left by somebody else', () => {
  it('is ignored, so a shared computer cannot push one singer onto another', async () => {
    // logout does not clear localStorage, so singer-a's unsent theme is still
    // sitting here when singer-b signs in. Defending it would keep a's theme
    // AND write it to b's account.
    localStorage.setItem(THEME, '"dawn"')
    leaveUnsent('singer-a', { [THEME]: '"dawn"' })
    state.userId = 'singer-b'
    state.rows = [{ id: 'r1', userId: 'b', key: THEME, value: '"midnight"' }]

    await pullCloudSettings()
    await settle()

    expect(localStorage.getItem(THEME)).toBe('"midnight"')
    expect(state.updates).toHaveLength(0)
  })
})

describe('the in-app developer console is device-local', () => {
  const CONSOLE_KEY = 'pitchperfect_developer_console'

  it('is not applied from the account, whatever another device stored', async () => {
    // It shares the synced prefix by accident of naming, not by intent: the
    // console is switched on to read what THIS device is saying, usually a
    // phone that cannot be plugged in. Without the exclusion, turning it on
    // there grew a debug panel on the laptop and the tablet too.
    state.rows = [
      { id: 'r1', userId: 'u', key: CONSOLE_KEY, value: 'true' },
      { id: 'r2', userId: 'u', key: THEME, value: '"midnight"' },
    ]

    await pullCloudSettings()
    await settle()

    expect(localStorage.getItem(CONSOLE_KEY)).toBeNull()
    // The control: an ordinary preference on the same pull still lands, so
    // this is the exclusion working and not the pull failing.
    expect(localStorage.getItem(THEME)).toBe('"midnight"')
  })

  it('is never uploaded, so it writes no row for a debugging affordance', async () => {
    leaveUnsent('singer-a', { [CONSOLE_KEY]: 'true' })

    await pullCloudSettings()
    await settle()

    expect(state.creates).toHaveLength(0)
    expect(state.updates).toHaveLength(0)
  })
})
