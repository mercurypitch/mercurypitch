// ============================================================
// Settings HTTP ownership — real adapters keep delayed writes with their account
// ============================================================
import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseAdapter } from '@/db/types'

const state = vi.hoisted(() => ({
  userId: 'a',
  version: 0,
  token: 'token-a',
  db: undefined as DatabaseAdapter | undefined,
}))
vi.mock('@/lib/defaults', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  API_BASE_URL: 'https://settings.test',
}))
vi.mock('@/lib/native-build', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  PREMIUM_EXERCISES: true,
}))
vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => true,
  storedTokenProvider: () => 'password',
  isRegisteredProvider: () => true,
  currentAccountId: () => state.userId,
  requireAuth: async () => true,
}))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => state.userId,
  getDeviceId: () => 'device',
  authVersion: () => state.version,
  getAuthToken: () => state.token,
}))
vi.mock('@/db', () => ({ getDb: async () => state.db }))

const KEY = 'mp_path_progress'
const value = (day: string) => ({
  pathId: 'ascent',
  startedAt: '2026-08-01T00:00:00.000Z',
  currentWeek: 1,
  weekDays: { 1: [day] },
  completedWeeks: [],
})
type Row = { id: string; userId: string; key: string; value: string }
type Mutation = {
  method: string
  owner: string
  body: { key?: string; value: string }
}

function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

function switchToB(): void {
  state.userId = 'b'
  state.token = 'token-b'
  state.version += 1
}
const settle = async () => {
  await vi.advanceTimersByTimeAsync(0)
}
const flush = async () => {
  await vi.advanceTimersByTimeAsync(1500)
}
let dispose: (() => void) | undefined

async function boot(
  options: {
    existing?: boolean
    beforeAuth?: () => Promise<void>
    beforeResponse?: () => Promise<void>
  } = {},
) {
  const rows: Row[] =
    options.existing === true
      ? [{ id: 'a-row', userId: 'a', key: KEY, value: 'null' }]
      : []
  const mutations: Mutation[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      expect(url.origin).toBe('https://settings.test')
      expect(url.pathname.startsWith('/api/userSettings')).toBe(true)
      const authorization = new Headers(init?.headers).get('Authorization')
      expect(['Bearer token-a', 'Bearer token-b']).toContain(authorization)
      const owner = authorization === 'Bearer token-a' ? 'a' : 'b'
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        const key = url.searchParams.get('where[key]')
        return Response.json(
          rows.filter(
            (row) => row.userId === owner && (key === null || row.key === key),
          ),
        )
      }
      const body = JSON.parse(String(init?.body)) as Mutation['body']
      mutations.push({ method, owner, body })
      await options.beforeResponse?.()
      let row: Row
      if (method === 'PATCH') {
        const found = rows.find(
          (candidate) =>
            candidate.id === url.pathname.split('/').at(-1) &&
            candidate.userId === owner,
        )
        if (found === undefined)
          return Response.json({ error: 'foreign row' }, { status: 404 })
        row = found
        row.value = body.value
      } else {
        expect(method).toBe('POST')
        expect(body.key).toBe(KEY)
        row = { id: `${owner}-row`, userId: owner, key: KEY, value: body.value }
        rows.push(row)
      }
      return Response.json(row)
    }),
  )
  const { ServerAdapter } = await import('@/db/adapters/server-adapter')
  const { HybridAdapter } = await import('@/db/adapters/hybrid-adapter')
  const server = new ServerAdapter({
    baseUrl: 'https://settings.test',
    headers: () => ({ Authorization: `Bearer ${state.token}` }),
    writeIdentity: () => state.userId,
    beforeWrite: async () => {
      await options.beforeAuth?.()
      return true
    },
  })
  // Both production wrappers are real. userSettings always selects cloud;
  // the second adapter is unused and ensures no local DB is needed here.
  state.db = new HybridAdapter(
    server,
    server,
    () => true,
    async () => true,
    () => state.userId,
  )
  const sync = await import('./settings-service')
  const { createPersistedSignal } = await import('@/lib/storage')
  const [read, write] = createPersistedSignal(
    KEY,
    null as ReturnType<typeof value> | null,
  )
  createRoot((cleanup) => {
    dispose = cleanup
    sync.initSettingsSync()
  })
  await settle()
  return { ...sync, read, write, rows, mutations }
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  localStorage.clear()
  Object.assign(state, {
    userId: 'a',
    version: 0,
    token: 'token-a',
    db: undefined,
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(async () => {
  dispose?.()
  dispose = undefined
  await settle()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('settings writes across real asynchronous HTTP preparation', () => {
  it.each([false, true])(
    'rejects an A write if authentication awaits a B switch (existing=%s)',
    async (existing) => {
      const gate = deferred()
      const beforeAuth = vi.fn(() => gate.promise)
      const app = await boot({ existing, beforeAuth })
      app.write(value('a-day'))
      await flush()
      expect(beforeAuth).toHaveBeenCalledOnce()
      expect(app.mutations).toEqual([])

      switchToB()
      await app.pullCloudSettings()
      gate.release()
      await settle()
      expect(app.mutations).toEqual([])
      expect(app.read()).toBeNull()
      expect(JSON.parse(localStorage.getItem('mp_sync_pending')!).owner).toBe(
        'a',
      )

      app.write(value('b-day'))
      await flush()
      expect(app.mutations).toEqual([
        {
          method: 'POST',
          owner: 'b',
          // The adapter names a created row's id itself (#998).
          body: {
            id: expect.any(String),
            userId: '',
            key: KEY,
            value: JSON.stringify(value('b-day')),
          },
        },
      ])
      expect(app.rows.find((row) => row.userId === 'b')?.value).not.toContain(
        'a-day',
      )
    },
  )

  it('keeps a dispatched A request on A and cannot clear an equal B pending write', async () => {
    const gate = deferred()
    const app = await boot({ beforeResponse: () => gate.promise })
    app.write(value('same-day'))
    await flush()
    expect(app.mutations).toHaveLength(1)
    expect(app.mutations[0].owner).toBe('a')

    switchToB()
    await app.pullCloudSettings()
    app.write(value('same-day'))
    const pendingB = localStorage.getItem('mp_sync_pending')
    expect(JSON.parse(pendingB!).owner).toBe('b')
    gate.release()
    await settle()

    expect(localStorage.getItem('mp_sync_pending')).toBe(pendingB)
    expect(app.rows).toEqual([
      {
        id: 'a-row',
        userId: 'a',
        key: KEY,
        value: JSON.stringify(value('same-day')),
      },
    ])
    expect(app.read()).toEqual(value('same-day'))
    await flush()
    expect(app.mutations.map(({ owner }) => owner)).toEqual(['a', 'b'])
    expect(localStorage.getItem('mp_sync_pending')).toBeNull()
  })
})
