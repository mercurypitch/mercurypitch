// ============================================================
// The haptics seam: the web's vibrate, or what a native build installs
// ============================================================
//
// Every room fires its haptics through `@/lib/haptics` (this seam). On the
// web they are `navigator.vibrate`, which iOS WebKit does not have; the
// native app installs the device's own at boot (installHaptics), so the
// same calls tick on an iPhone (Warm-up 13f).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { haptics as Haptics } from '@/lib/haptics'
import type { installHaptics as InstallHaptics, platform as Platform, } from './index'

const vibrate = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vibrate.mockClear()
  Object.defineProperty(navigator, 'vibrate', {
    value: vibrate,
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
})

/** The seam as a fresh import sees it, with this test's navigator. */
async function seam(): Promise<{
  platform: typeof Platform
  installHaptics: typeof InstallHaptics
  haptics: typeof Haptics
}> {
  const { platform, installHaptics } = await import('./index')
  const { haptics } = await import('@/lib/haptics')
  return { platform, installHaptics, haptics }
}

function counter(): {
  calls: string[]
  service: { tapLight(): void; success(): void; warning(): void }
} {
  const calls: string[] = []
  return {
    calls,
    service: {
      tapLight: () => calls.push('tapLight'),
      success: () => calls.push('success'),
      warning: () => calls.push('warning'),
    },
  }
}

describe('the web, with nothing installed', () => {
  it('vibrates the patterns the rooms have always felt', async () => {
    const { haptics } = await seam()
    haptics.tapLight()
    haptics.success()
    haptics.warning()
    expect(vibrate.mock.calls).toEqual([[10], [[15, 30, 40]], [[30, 40, 30]]])
  })
})

describe('a native build', () => {
  it('routes every call to the installed haptics, and none to vibrate', async () => {
    const { haptics, installHaptics } = await seam()
    const device = counter()
    installHaptics(device.service)
    haptics.tapLight()
    haptics.success()
    haptics.warning()
    expect(device.calls).toEqual(['tapLight', 'success', 'warning'])
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('reaches a room that took the alias before the install', async () => {
    // Rooms import `haptics` at module scope, long before main.tsx runs
    // its installs: the alias must follow the install, not copy the web's.
    const { haptics, installHaptics, platform } = await seam()
    const held = platform.haptics
    const device = counter()
    installHaptics(device.service)
    held.tapLight()
    haptics.success()
    expect(device.calls).toEqual(['tapLight', 'success'])
  })

  it("the release puts the web's vibrate back", async () => {
    const { haptics, installHaptics } = await seam()
    const device = counter()
    const release = installHaptics(device.service)
    release()
    haptics.tapLight()
    expect(device.calls).toEqual([])
    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('a stale release leaves a newer install in place', async () => {
    const { haptics, installHaptics } = await seam()
    const first = counter()
    const second = counter()
    const releaseFirst = installHaptics(first.service)
    installHaptics(second.service)
    releaseFirst()
    haptics.tapLight()
    expect(second.calls).toEqual(['tapLight'])
    expect(first.calls).toEqual([])
  })
})
