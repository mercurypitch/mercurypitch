// Haptic delivery deadlines when the platform port is still loading.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({ isNativePlatform: vi.fn(() => false) }))
vi.mock('@capacitor/core', () => ({ Capacitor: platform }))

let now = 0
let loaded: () => void
const impact = vi.fn(async (_style: string) => undefined)

beforeEach(() => {
  vi.resetModules()
  impact.mockClear()
  now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const loading = new Promise<void>((resolve) => {
    loaded = resolve
  })
  vi.doMock('@irchiinnuss/mobile-runtime/web', async () => {
    await loading
    return { createWebHapticsPort: () => ({ impact }) }
  })
  vi.doMock('@irchiinnuss/mobile-runtime/capacitor/haptics', async () => {
    await loading
    return { createCapacitorHapticsPort: () => ({ impact }) }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.doUnmock('@irchiinnuss/mobile-runtime/web')
  vi.doUnmock('@irchiinnuss/mobile-runtime/capacitor/haptics')
})

describe.each([false, true])('haptics with native=%s', (native) => {
  it('drops a whole expired break sequence instead of dispatching it together', async () => {
    platform.isNativePlatform.mockReturnValue(native)
    const { tap } = await import('./haptics')
    tap('heavy')
    for (const at of [100, 300, 550]) {
      now = at
      tap('light')
    }
    now = 700
    loaded()
    await vi.dynamicImportSettled()
    expect(impact).not.toHaveBeenCalled()

    // Dropping old requests does not disable the now-ready port.
    tap('heavy')
    await vi.dynamicImportSettled()
    expect(impact).toHaveBeenCalledExactlyOnceWith('heavy')
  })

  it.each([99, 100, 101])(
    'checks the request age at dispatch after %d ms',
    async (delay) => {
      platform.isNativePlatform.mockReturnValue(native)
      const { tap } = await import('./haptics')
      tap('heavy')
      now = delay
      loaded()
      await vi.dynamicImportSettled()
      expect(impact.mock.calls).toEqual(delay <= 100 ? [['heavy']] : [])
    },
  )
})
