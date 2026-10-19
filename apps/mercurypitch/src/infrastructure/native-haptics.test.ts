// ============================================================
// Native haptics: the rooms' ticks reach the device
// ============================================================
//
// The four premium rooms fire their haptics through `@/lib/haptics`, the
// web's `navigator.vibrate`, which iOS WebKit does not have. The app
// installs the device's own in their place at boot, so the same calls tick
// on an iPhone (Warm-up 13f). Each room's own suite counts its moments
// through the same seam (installHaptics); this one holds the seam to the
// platform package, and main.tsx to installing it before the first render.

import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haptics } from '@/lib/haptics'
import { installNativeHaptics } from './native-haptics'

const device = vi.hoisted(() => ({
  hapticTap: vi.fn(async () => undefined),
  hapticSuccess: vi.fn(async () => undefined),
  hapticWarning: vi.fn(async () => undefined),
}))

vi.mock('@irchiinnuss/mobile-runtime/platform', () => device)

const vibrate = vi.fn()
let release: (() => void) | undefined

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'vibrate', {
    value: vibrate,
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  release?.()
  release = undefined
  Reflect.deleteProperty(navigator, 'vibrate')
})

describe('installNativeHaptics', () => {
  it("a room's tick, success and warning are the device's", () => {
    release = installNativeHaptics()
    haptics.tapLight()
    haptics.tapLight()
    haptics.success()
    haptics.warning()
    expect(device.hapticTap).toHaveBeenCalledTimes(2)
    expect(device.hapticSuccess).toHaveBeenCalledTimes(1)
    expect(device.hapticWarning).toHaveBeenCalledTimes(1)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('a device without the plugin costs a room nothing', () => {
    device.hapticTap.mockRejectedValueOnce(new Error('Unimplemented'))
    release = installNativeHaptics()
    expect(() => haptics.tapLight()).not.toThrow()
  })
})

describe('main.tsx', () => {
  it('installs them before the app is first rendered', () => {
    const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
    const install = main.indexOf('\ninstallNativeHaptics()')
    expect(install).toBeGreaterThan(-1)
    expect(install).toBeLessThan(main.indexOf('render('))
  })
})
