// ============================================================
// A room chosen in the old build survives the move to the catalog
// ============================================================
//
// Guitar Night stored the chosen room under
// `pitchperfect_guitar_night_backdrop` for as long as it had rooms. Joining
// the shared catalog moved that to `pitchperfect_guitar_background`, and a
// build that simply started reading the new key would put every existing
// player back in the default room without saying so.
//
// Asserted against the controller rather than the mounted app for one
// mechanical reason: the surface controllers are app-lifetime singletons
// built when the module is first imported, so by the time a test body could
// seed storage the singleton has already read it. The reader itself is
// covered in `src/lib/backgrounds/background-selection.test.ts`; this is the
// wiring — a Guitar Night controller, a browser that only knows the old key.

import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { PremiumBackgroundCatalogState, PremiumBackgroundCatalogStore, } from '@/lib/backgrounds/background-catalog-store'
import type { BackgroundSelectionStorage } from '@/lib/backgrounds/background-selection'
import { createBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'

const LEGACY_KEY = 'pitchperfect_guitar_night_backdrop'
const CURRENT_KEY = 'pitchperfect_guitar_background'

function keyedStorage(
  initial: Record<string, string> = {},
): BackgroundSelectionStorage & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

/** No supporter art exists for this surface yet; the rooms are all public. */
function emptyCatalogStore(): PremiumBackgroundCatalogStore {
  const [catalogState] = createSignal<PremiumBackgroundCatalogState>({
    assets: [],
    unlockedIds: [],
    authenticated: false,
    activeSupporter: false,
    accessExpiresAt: null,
    loading: false,
    ready: true,
    lastCheckedAt: 0,
    error: null,
    revision: 0,
  })
  return {
    state: catalogState,
    retain: () => vi.fn(),
    refresh: async () => undefined,
    invalidate: vi.fn(),
    assetById: () => null,
    dispose: vi.fn(),
  }
}

function guitarController(storage: BackgroundSelectionStorage) {
  return createBackgroundSurfaceController('guitar', {
    catalogStore: emptyCatalogStore(),
    storage,
  })
}

describe('a room chosen before the catalog', () => {
  it('is still the room Guitar Night opens in', () => {
    const controller = guitarController(
      keyedStorage({ [LEGACY_KEY]: 'daylight-loft' }),
    )
    const release = controller.retain()

    expect(controller.requestedId()).toBe('daylight-loft')
    expect(controller.resolved().id).toBe('daylight-loft')
    expect(controller.resolved().url).toBe('/guitar-night/daylight-loft.webp')

    release()
  })

  it('gives way to anything chosen since', () => {
    const controller = guitarController(
      keyedStorage({
        [LEGACY_KEY]: 'daylight-loft',
        [CURRENT_KEY]: 'valve-corner',
      }),
    )
    const release = controller.retain()

    expect(controller.resolved().id).toBe('valve-corner')

    release()
  })

  it('writes the next choice under the catalog key', () => {
    // The old key is left where it is: nothing reads it any more, and
    // clearing it would strand anyone who rolls back to the previous build.
    const storage = keyedStorage({ [LEGACY_KEY]: 'daylight-loft' })
    const controller = guitarController(storage)
    const release = controller.retain()

    expect(controller.select('blue-hour-roof')).toBe(true)
    expect(storage.values.get(CURRENT_KEY)).toBe('blue-hour-roof')
    expect(storage.values.get(LEGACY_KEY)).toBe('daylight-loft')

    release()
  })

  it('falls back to the default room for a room that no longer ships', () => {
    const controller = guitarController(
      keyedStorage({ [LEGACY_KEY]: 'retired-room' }),
    )
    const release = controller.retain()

    expect(controller.resolved().id).toBe('velvet-rehearsal')

    release()
  })
})
