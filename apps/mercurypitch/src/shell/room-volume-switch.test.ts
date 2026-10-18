// ============================================================
// "One volume in rooms": off until a tester turns it on
// ============================================================
//
// The Developer screen's switch for room-visit.ts. It persists on the phone,
// and a store build, which has no Developer screen, always takes the default.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ONE_VOLUME_KEY, oneVolumeInRooms, reloadOneVolumeForTests, setOneVolumeInRooms, } from './room-volume-switch'

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
  reloadOneVolumeForTests()
})

afterEach(() => {
  vi.unstubAllEnvs()
  localStorage.clear()
  reloadOneVolumeForTests()
})

describe('the switch', () => {
  it('is off until a tester turns it on', () => {
    expect(oneVolumeInRooms()).toBe(false)
    expect(localStorage.getItem(ONE_VOLUME_KEY)).toBeNull()
  })

  it('reads an off left by a build that had it on by default', () => {
    localStorage.setItem(ONE_VOLUME_KEY, '0')
    reloadOneVolumeForTests()
    expect(oneVolumeInRooms()).toBe(false)
  })

  it('keeps an on on the phone, and goes back off', () => {
    setOneVolumeInRooms(true)
    expect(oneVolumeInRooms()).toBe(true)
    expect(localStorage.getItem(ONE_VOLUME_KEY)).toBe('1')

    // A later launch reads it back.
    reloadOneVolumeForTests()
    expect(oneVolumeInRooms()).toBe(true)

    setOneVolumeInRooms(false)
    expect(oneVolumeInRooms()).toBe(false)
    expect(localStorage.getItem(ONE_VOLUME_KEY)).toBeNull()
  })

  it('is off in a store build, whatever a test build left in storage', () => {
    localStorage.setItem(ONE_VOLUME_KEY, '1')
    reloadOneVolumeForTests()
    vi.stubEnv('VITE_PORTABLE_CONSOLE', 'false')
    expect(oneVolumeInRooms()).toBe(false)
  })

  it('holds for the session where storage refuses it', () => {
    const refuse = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Full', 'QuotaExceededError')
      })
    setOneVolumeInRooms(true)
    expect(oneVolumeInRooms()).toBe(true)
    refuse.mockRestore()
  })
})
