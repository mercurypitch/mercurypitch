// ============================================================
// Background surface controller tests
// ============================================================

import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PremiumBackgroundCatalogState, PremiumBackgroundCatalogStore, } from '@/stores/background-store'
import type { BackgroundSelectionStorage } from './background-access'
import type { PremiumBackgroundAsset } from './background-runtime'
import { BackgroundRequestError } from './background-runtime'
import { createBackgroundSurfaceController } from './background-surface'

const SHA = 'b'.repeat(64)

function asset(
  id: 'golden-hour-stage' | 'aurora-stage',
): PremiumBackgroundAsset {
  return {
    id,
    title: id === 'golden-hour-stage' ? 'Golden Hour Stage' : 'Aurora Stage',
    description: 'Private stage',
    surface: 'karaoke',
    activeVersion: 1,
    variants: [
      {
        name: 'landscape-2k',
        width: 2048,
        height: 1152,
        byteSize: 900,
        sha256: SHA,
      },
    ],
  }
}

function state(
  assets: readonly PremiumBackgroundAsset[],
  unlockedIds: PremiumBackgroundCatalogState['unlockedIds'],
  revision = 0,
): PremiumBackgroundCatalogState {
  return {
    assets,
    unlockedIds,
    authenticated: unlockedIds.length > 0,
    activeSupporter: unlockedIds.length > 0,
    accessExpiresAt: null,
    loading: false,
    ready: true,
    lastCheckedAt: 0,
    error: null,
    revision,
  }
}

function fakeStore(initial: PremiumBackgroundCatalogState) {
  const [catalogState, setCatalogState] = createSignal(initial)
  const invalidate = vi.fn()
  const store: PremiumBackgroundCatalogStore = {
    state: catalogState,
    retain: () => vi.fn(),
    refresh: async () => undefined,
    invalidate,
    assetById: (id) =>
      catalogState().assets.find((entry) => entry.id === id) ?? null,
    dispose: vi.fn(),
  }
  return { store, setCatalogState, invalidate }
}

function memoryStorage(value: string | null = null) {
  let stored = value
  const storage: BackgroundSelectionStorage = {
    getItem: vi.fn(() => stored),
    setItem: vi.fn((_key, next) => {
      stored = next
    }),
  }
  return storage
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

afterEach(() => vi.restoreAllMocks())

describe('background preference authorization', () => {
  it('keeps a known preference inert until the current account unlocks it', async () => {
    const golden = asset('golden-hour-stage')
    const catalog = fakeStore(state([golden], [], 0))
    const storage = memoryStorage('golden-hour-stage')
    const loadProtected = vi.fn().mockResolvedValue('blob:golden')
    const revokeObjectURL = vi.fn()
    const controller = createBackgroundSurfaceController('karaoke', {
      catalogStore: catalog.store,
      storage,
      loadProtected,
      revokeObjectURL,
    })
    const release = controller.retain()

    expect(controller.requestedId()).toBe('golden-hour-stage')
    expect(controller.resolved().id).toBe('karaoke-theatre')
    expect(loadProtected).not.toHaveBeenCalled()

    catalog.setCatalogState(state([golden], ['golden-hour-stage'], 1))
    await vi.waitFor(() =>
      expect(controller.resolved().id).toBe('golden-hour-stage'),
    )
    expect(controller.resolved().url).toBe('blob:golden')

    catalog.setCatalogState(state([golden], [], 2))
    expect(controller.resolved().id).toBe('karaoke-theatre')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:golden')

    release()
    controller.dispose()
  })
})

describe('protected background lifecycle', () => {
  it('ignores stale loads, swaps atomically, and revokes on final release', async () => {
    const golden = asset('golden-hour-stage')
    const aurora = asset('aurora-stage')
    const catalog = fakeStore(
      state([golden, aurora], ['golden-hour-stage', 'aurora-stage']),
    )
    const loads = new Map<string, ReturnType<typeof deferred<string>>>()
    const loadProtected = vi.fn((entry: PremiumBackgroundAsset) => {
      const pending = deferred<string>()
      loads.set(entry.id, pending)
      return pending.promise
    })
    const revokeObjectURL = vi.fn()
    const controller = createBackgroundSurfaceController('karaoke', {
      catalogStore: catalog.store,
      storage: memoryStorage(),
      loadProtected,
      revokeObjectURL,
    })
    const release = controller.retain()

    expect(controller.select('golden-hour-stage')).toBe(true)
    expect(controller.resolved().id).toBe('karaoke-theatre')
    expect(controller.select('aurora-stage')).toBe(true)

    loads.get('golden-hour-stage')!.resolve('blob:stale-golden')
    await vi.waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:stale-golden'),
    )
    expect(controller.resolved().id).toBe('karaoke-theatre')

    loads.get('aurora-stage')!.resolve('blob:aurora')
    await vi.waitFor(() =>
      expect(controller.resolved().id).toBe('aurora-stage'),
    )
    expect(controller.resolved().url).toBe('blob:aurora')

    release()
    expect(controller.resolved().id).toBe('karaoke-theatre')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:aurora')
    controller.dispose()
  })

  it('invalidates denied bytes and returns to the public fallback', async () => {
    const golden = asset('golden-hour-stage')
    const catalog = fakeStore(state([golden], ['golden-hour-stage']))
    const controller = createBackgroundSurfaceController('karaoke', {
      catalogStore: catalog.store,
      storage: memoryStorage(),
      loadProtected: vi
        .fn()
        .mockRejectedValue(
          new BackgroundRequestError(403, 'This stage is no longer unlocked.'),
        ),
      revokeObjectURL: vi.fn(),
    })
    const release = controller.retain()
    expect(controller.select('golden-hour-stage')).toBe(true)

    await vi.waitFor(() =>
      expect(catalog.invalidate).toHaveBeenCalledWith('golden-hour-stage', 403),
    )
    expect(controller.resolved().id).toBe('karaoke-theatre')
    expect(controller.error()).toContain('no longer unlocked')

    release()
    controller.dispose()
  })
})

describe('background selection persistence', () => {
  it('persists only a selectable known id', () => {
    const golden = asset('golden-hour-stage')
    const catalog = fakeStore(state([golden], []))
    const storage = memoryStorage()
    const controller = createBackgroundSurfaceController('karaoke', {
      catalogStore: catalog.store,
      storage,
      loadProtected: vi.fn(),
      revokeObjectURL: vi.fn(),
    })
    const release = controller.retain()

    expect(controller.select('golden-hour-stage')).toBe(false)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(controller.select('karaoke-theatre')).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(
      'pitchperfect_karaoke_background',
      'karaoke-theatre',
    )

    release()
    controller.dispose()
  })
})
