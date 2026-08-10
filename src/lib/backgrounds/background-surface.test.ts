// ============================================================
// Background surface controller tests
// ============================================================

import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PremiumBackgroundCatalogState, PremiumBackgroundCatalogStore, } from './background-catalog-store'
import type { PremiumBackgroundAsset, ProtectedBackgroundRequest, } from './background-runtime'
import { BackgroundRequestError } from './background-runtime'
import type { BackgroundSelectionStorage } from './background-selection'
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

function pianoAsset(): PremiumBackgroundAsset {
  return {
    id: 'piano-velvet-recital',
    title: 'Velvet Recital',
    description: 'A private piano room',
    surface: 'piano',
    activeVersion: 3,
    variants: [
      {
        name: 'landscape-2k',
        width: 2048,
        height: 1152,
        byteSize: 900,
        sha256: SHA,
      },
      {
        name: 'landscape-4k',
        width: 3840,
        height: 2160,
        byteSize: 1_800,
        sha256: SHA,
      },
      {
        name: 'portrait-2k',
        width: 1152,
        height: 2048,
        byteSize: 950,
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

describe('responsive Piano rooms', () => {
  it('resamples a viewport that changed while the controller had no retainers', () => {
    let orientation: 'portrait' | 'landscape' = 'portrait'
    const catalog = fakeStore(state([], []))
    const controller = createBackgroundSurfaceController('piano', {
      catalogStore: catalog.store,
      storage: memoryStorage(),
      pixelRatio: () => 2,
      orientation: () => orientation,
      loadProtected: vi.fn(),
      revokeObjectURL: vi.fn(),
    })
    const releasePortrait = controller.retain()

    expect(controller.select('piano-morning-conservatory')).toBe(true)
    expect(controller.resolved().url).toBe(
      '/piano-night/morning-conservatory-portrait.webp',
    )
    releasePortrait()

    orientation = 'landscape'
    const releaseLandscape = controller.retain()
    expect(controller.resolved().url).toBe(
      '/piano-night/morning-conservatory-landscape.webp',
    )

    releaseLandscape()
    controller.dispose()
  })

  it('selects authored public portrait art and returns to landscape on rotation', () => {
    const [orientation, setOrientation] = createSignal<
      'portrait' | 'landscape'
    >('portrait')
    const catalog = fakeStore(state([], []))
    const controller = createBackgroundSurfaceController('piano', {
      catalogStore: catalog.store,
      storage: memoryStorage(),
      pixelRatio: () => 2,
      orientation,
      loadProtected: vi.fn(),
      revokeObjectURL: vi.fn(),
    })
    const release = controller.retain()

    expect(controller.resolved()).toMatchObject({
      id: 'piano-afterglow',
      url: '/piano-night/afterglow-studio-portrait.webp',
      treatment: 'dark',
    })
    expect(controller.select('piano-morning-conservatory')).toBe(true)
    expect(controller.resolved()).toMatchObject({
      url: '/piano-night/morning-conservatory-portrait.webp',
      treatment: 'light',
    })

    setOrientation('landscape')
    expect(controller.resolved().url).toBe(
      '/piano-night/morning-conservatory-landscape.webp',
    )

    release()
    controller.dispose()
  })

  it('keeps an identical protected variant load alive across resize noise', async () => {
    const velvet = pianoAsset()
    const catalog = fakeStore(state([velvet], ['piano-velvet-recital']))
    const pending = deferred<string>()
    const requests: ProtectedBackgroundRequest[] = []
    const loadProtected = vi.fn(
      (
        _asset: PremiumBackgroundAsset,
        request?: ProtectedBackgroundRequest,
      ) => {
        if (request !== undefined) requests.push(request)
        return pending.promise
      },
    )
    const controller = createBackgroundSurfaceController('piano', {
      catalogStore: catalog.store,
      storage: memoryStorage(),
      pixelRatio: () => 2,
      orientation: () => 'portrait',
      loadProtected,
      revokeObjectURL: vi.fn(),
    })
    const release = controller.retain()

    try {
      expect(controller.select('piano-velvet-recital')).toBe(true)
      expect(loadProtected).toHaveBeenCalledTimes(1)

      window.dispatchEvent(new Event('resize'))

      expect(loadProtected).toHaveBeenCalledTimes(1)
      expect(requests[0]?.signal?.aborted).toBe(false)

      pending.resolve('blob:portrait-2k')
      await vi.waitFor(() =>
        expect(controller.resolved().url).toBe('blob:portrait-2k'),
      )
    } finally {
      release()
      controller.dispose()
    }
  })

  it('reloads the protected responsive variant and revokes the old object URL', async () => {
    const velvet = pianoAsset()
    const [orientation, setOrientation] = createSignal<
      'portrait' | 'landscape'
    >('portrait')
    const catalog = fakeStore(state([velvet], ['piano-velvet-recital']))
    const loadProtected = vi.fn(
      async (
        _asset: PremiumBackgroundAsset,
        request?: ProtectedBackgroundRequest,
      ) => `blob:${request?.variant}`,
    )
    const revokeObjectURL = vi.fn()
    const controller = createBackgroundSurfaceController('piano', {
      catalogStore: catalog.store,
      storage: memoryStorage(),
      pixelRatio: () => 2,
      orientation,
      loadProtected,
      revokeObjectURL,
    })
    const release = controller.retain()

    expect(controller.select('piano-velvet-recital')).toBe(true)
    await vi.waitFor(() =>
      expect(controller.resolved().url).toBe('blob:portrait-2k'),
    )
    expect(controller.resolved().variant).toBe('portrait-2k')

    setOrientation('landscape')
    await vi.waitFor(() =>
      expect(controller.resolved().url).toBe('blob:landscape-4k'),
    )
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:portrait-2k')

    release()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:landscape-4k')
    controller.dispose()
  })
})
