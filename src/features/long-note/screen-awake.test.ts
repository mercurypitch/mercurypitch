import { afterEach, describe, expect, it, vi } from 'vitest'
import { platform } from '@/lib/platform'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { registerNativeDevice } from '@/stores/native-shell-store'
import { createScreenAwake } from './screen-awake'

describe('createScreenAwake', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("flips the phone's own switch, once a change", () => {
    const keepAwake = vi.fn()
    const unregister = registerNativeDevice({
      keepAwake,
    } as unknown as NativeDeviceApi)
    const enable = vi.spyOn(platform.keepAwake, 'enable')
    try {
      const awake = createScreenAwake()
      awake.set(true)
      awake.set(true)
      awake.set(false)
      awake.set(false)
      expect(keepAwake.mock.calls).toEqual([[true], [false]])
      expect(enable).not.toHaveBeenCalled()
    } finally {
      unregister()
    }
  })

  it("takes the platform's wake lock without a native device, and gives it back", () => {
    const enable = vi
      .spyOn(platform.keepAwake, 'enable')
      .mockResolvedValue(undefined)
    const disable = vi
      .spyOn(platform.keepAwake, 'disable')
      .mockResolvedValue(undefined)
    const awake = createScreenAwake()
    awake.set(true)
    awake.set(true)
    expect(enable).toHaveBeenCalledTimes(1)
    awake.set(false)
    awake.set(false)
    expect(disable).toHaveBeenCalledTimes(1)
  })
})
