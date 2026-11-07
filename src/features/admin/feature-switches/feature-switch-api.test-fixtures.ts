// ============================================================
// Feature switch doubles — the db-worker's switch routes, at `fetch`
// ============================================================
//
// The Features page talks to one thing: the db-worker's admin routes for
// experimental feature switches. They are stubbed at `fetch`, the true edge,
// by a double that keeps state as the worker does: a save changes what the
// next read answers, moves a switch's time only when its value changes, and
// clears the row for null. A body is checked with the contract's own
// parseFeatureSwitch, so a test cannot pass with a body the worker refuses.

import { vi } from 'vitest'
import { ADMIN_FEATURES_PATH, EXPERIMENTAL_FEATURES, parseFeatureSwitch, } from '@/lib/experimental-features'

/** The key the page is handed, and the only one the double accepts. */
export const ADMIN_KEY = 'test-admin-key'

/** Oct 20, 2:02 PM wherever the test runs, as the page prints it. */
export const AT = new Date(2026, 9, 20, 14, 2).toISOString()

/** Nov 3, 9:15 AM wherever the test runs: when a save in a test lands. */
export const LATER = new Date(2026, 10, 3, 9, 15).toISOString()

/** A planned answer in place of the real one: a response, or a request that never lands. */
export type Failure = { status: number; body?: unknown } | 'offline'

export interface FakeFeatureApi {
  /** The features the worker lists, in its order. */
  readonly listed: string[]
  /** The switches that are set, by name. */
  readonly switches: Record<string, { enabled: boolean; updatedAt: string }>
  /** When a save is stored: LATER unless a test moves it. */
  now: string
  /** Answer the next read of the list with this instead. */
  failNextRead: Failure | null
  /** Answer the next save with this instead of storing it. */
  failNextSave: Failure | null
  /** Hold the next read's answer until this settles. */
  holdNextRead: Promise<void> | null
  /** Hold the next save's answer until this settles. */
  holdNextSave: Promise<void> | null
  /** How many times the list was read. */
  reads: number
  /** Every save the page sent, in order, with the key it carried. */
  readonly saves: { name: string; body: unknown; key: string | null }[]
}

export function fakeFeatureApi(
  seed: {
    listed?: string[]
    switches?: Record<string, { enabled: boolean; updatedAt?: string }>
  } = {},
): FakeFeatureApi {
  const switches: FakeFeatureApi['switches'] = {}
  for (const [name, set] of Object.entries(seed.switches ?? {})) {
    switches[name] = { enabled: set.enabled, updatedAt: set.updatedAt ?? AT }
  }
  return {
    listed: [...(seed.listed ?? EXPERIMENTAL_FEATURES)],
    switches,
    now: LATER,
    failNextRead: null,
    failNextSave: null,
    holdNextRead: null,
    holdNextSave: null,
    reads: 0,
    saves: [],
  }
}

/** A promise the test settles when it likes. */
export function held(): { promise: Promise<void>; release: () => void } {
  let release: () => void = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function failure(fail: Failure): Response {
  if (fail === 'offline') throw new TypeError('Failed to fetch')
  return json(fail.body ?? {}, fail.status)
}

function rowOf(api: FakeFeatureApi, name: string) {
  const set = api.switches[name]
  return {
    name,
    enabled: set?.enabled ?? null,
    updatedAt: set?.updatedAt ?? null,
  }
}

/** Store a switch as the worker does: a time moves only with a value. */
function store(
  api: FakeFeatureApi,
  name: string,
  enabled: boolean | null,
): boolean {
  const before = api.switches[name]
  if (enabled === null) {
    delete api.switches[name]
    return before !== undefined
  }
  if (before?.enabled === enabled) return false
  api.switches[name] = { enabled, updatedAt: api.now }
  return true
}

function save(
  api: FakeFeatureApi,
  name: string,
  init: RequestInit | undefined,
  key: string | null,
): Response {
  const body = JSON.parse(String(init?.body)) as unknown
  api.saves.push({ name, body, key })
  const fail = api.failNextSave
  api.failNextSave = null
  if (fail !== null) return failure(fail)
  if (!api.listed.includes(name)) {
    return json(
      { error: `Unknown feature: expected one of ${api.listed.join(', ')}` },
      400,
    )
  }
  const parsed = parseFeatureSwitch(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  const changed = store(api, name, parsed.enabled)
  return json({ row: rowOf(api, name), changed })
}

async function answer(
  api: FakeFeatureApi,
  url: string,
  init: RequestInit | undefined,
): Promise<Response> {
  const { pathname } = new URL(url, 'https://site.test')
  const key = new Headers(init?.headers).get('X-Admin-Key')
  if (pathname === ADMIN_FEATURES_PATH) {
    api.reads += 1
    const hold = api.holdNextRead
    api.holdNextRead = null
    await hold
    const fail = api.failNextRead
    api.failNextRead = null
    if (fail !== null) return failure(fail)
    if (key !== ADMIN_KEY) return json({ error: 'Admin key required' }, 403)
    return json({ features: api.listed.map((name) => rowOf(api, name)) })
  }
  const name = decodeURIComponent(pathname.split('/').at(-1) ?? '')
  const hold = api.holdNextSave
  api.holdNextSave = null
  await hold
  if (key !== ADMIN_KEY) {
    api.saves.push({ name, body: JSON.parse(String(init?.body)), key })
    return json({ error: 'Admin key required' }, 403)
  }
  return save(api, name, init, key)
}

/** Stub `fetch` with the switch routes. Anything else the page asks for is a test bug. */
export function stubFeatureApi(api: FakeFeatureApi = fakeFeatureApi()) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (!url.startsWith(ADMIN_FEATURES_PATH)) {
        throw new Error(`Unexpected request: ${url}`)
      }
      return answer(api, url, init)
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
