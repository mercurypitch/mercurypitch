// ============================================================
// Premium background runtime tests
// ============================================================

import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPremiumBackgroundCatalogStore } from '@/stores/background-store'
import type { PremiumBackgroundCatalogResponse } from './background-runtime'
import { loadProtectedBackgroundObjectUrl, parsePremiumBackgroundCatalog, } from './background-runtime'

const SHA = 'a'.repeat(64)

function catalog(
  id: 'golden-hour-stage' | 'aurora-stage' = 'golden-hour-stage',
): PremiumBackgroundCatalogResponse {
  return {
    assets: [
      {
        id,
        title:
          id === 'golden-hour-stage' ? 'Golden Hour Stage' : 'Aurora Stage',
        description: 'A private edition',
        surface: 'karaoke',
        activeVersion: 2,
        variants: [
          {
            name: 'landscape-2k',
            width: 2048,
            height: 1152,
            byteSize: 1200,
            sha256: SHA,
          },
        ],
      },
    ],
    access: {
      authenticated: true,
      activeSupporter: true,
      backgroundIds: [id],
      expiresAt: null,
    },
    generatedAt: new Date(0).toISOString(),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parsePremiumBackgroundCatalog', () => {
  it('accepts a server-published known draft id but drops unknown and cross-surface rows', () => {
    const valid = catalog()
    const parsed = parsePremiumBackgroundCatalog({
      ...valid,
      assets: [
        ...valid.assets,
        { ...valid.assets[0], id: 'private-surprise' },
        { ...valid.assets[0], id: 'golden-stage', surface: 'karaoke' },
      ],
      access: {
        ...valid.access,
        backgroundIds: [
          'golden-hour-stage',
          'private-surprise',
          'golden-stage',
        ],
      },
    })

    expect(parsed?.assets.map((asset) => asset.id)).toEqual([
      'golden-hour-stage',
    ])
    expect(parsed?.access.backgroundIds).toEqual(['golden-hour-stage'])
  })
})

describe('loadProtectedBackgroundObjectUrl', () => {
  it('waits for decode before returning the caller-owned object URL', async () => {
    const decode = deferred<undefined>()
    const fetcher = vi.fn().mockResolvedValue(
      new Response(new Blob(['image'], { type: 'image/webp' }), {
        status: 200,
        headers: { 'Content-Type': 'image/webp' },
      }),
    )
    const createObjectURL = vi.fn().mockReturnValue('blob:golden')
    const result = loadProtectedBackgroundObjectUrl(catalog().assets[0], {
      base: 'https://api.example.test',
      fetcher,
      createObjectURL,
      revokeObjectURL: vi.fn(),
      decode: () => decode.promise,
    })

    await vi.waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    let settled = false
    void result.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    decode.resolve(undefined)
    await expect(result).resolves.toBe('blob:golden')
  })
})

describe('premium background catalog account isolation', () => {
  it('clears access synchronously and ignores the previous account request', async () => {
    const [authRevision, setAuthRevision] = createSignal(0)
    const first = deferred<PremiumBackgroundCatalogResponse | null>()
    const stale = deferred<PremiumBackgroundCatalogResponse | null>()
    const current = deferred<PremiumBackgroundCatalogResponse | null>()
    const fetchCatalog = vi
      .fn<
        (
          signal: AbortSignal,
        ) => Promise<PremiumBackgroundCatalogResponse | null>
      >()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => current.promise)
    const store = createPremiumBackgroundCatalogStore({
      authRevision,
      fetchCatalog,
    })
    const release = store.retain()
    await vi.waitFor(() => expect(fetchCatalog).toHaveBeenCalledTimes(1))

    first.resolve(catalog())
    await vi.waitFor(() =>
      expect(store.state().unlockedIds).toEqual(['golden-hour-stage']),
    )

    const staleRefresh = store.refresh()
    await vi.waitFor(() => expect(fetchCatalog).toHaveBeenCalledTimes(2))
    setAuthRevision(1)
    expect(store.state().unlockedIds).toEqual([])
    expect(store.state().assets).toEqual([])
    await vi.waitFor(() => expect(fetchCatalog).toHaveBeenCalledTimes(3))

    stale.resolve(catalog())
    current.resolve(catalog('aurora-stage'))
    await staleRefresh
    await vi.waitFor(() =>
      expect(store.state().unlockedIds).toEqual(['aurora-stage']),
    )
    expect(store.state().assets.map((asset) => asset.id)).toEqual([
      'aurora-stage',
    ])

    release()
    store.dispose()
  })

  it('refreshes at the earliest known access expiry before the periodic bound', async () => {
    const expiring = catalog()
    expiring.access.expiresAt = new Date(130_000).toISOString()
    const setTimer = vi.fn(
      (_callback: () => void, _delay?: number) =>
        1 as unknown as ReturnType<typeof setTimeout>,
    )
    const clearTimer = vi.fn()
    const store = createPremiumBackgroundCatalogStore({
      authRevision: () => 0,
      fetchCatalog: async () => expiring,
      now: () => 100_000,
      setTimer: setTimer as unknown as typeof setTimeout,
      clearTimer,
    })
    const release = store.retain()

    await vi.waitFor(() => expect(store.state().ready).toBe(true))
    expect(setTimer).toHaveBeenLastCalledWith(expect.any(Function), 31_000)

    release()
    store.dispose()
  })
})
