// ============================================================
// "One volume in rooms": on until a tester turns it off
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
  it('is on until a tester turns it off', () => {
    expect(oneVolumeInRooms()).toBe(true)
    expect(localStorage.getItem(ONE_VOLUME_KEY)).toBeNull()
  })

  it('keeps an off on the phone, and comes back on', () => {
    setOneVolumeInRooms(false)
    expect(oneVolumeInRooms()).toBe(false)
    expect(localStorage.getItem(ONE_VOLUME_KEY)).toBe('0')

    // A later launch reads it back.
    reloadOneVolumeForTests()
    expect(oneVolumeInRooms()).toBe(false)

    setOneVolumeInRooms(true)
    expect(oneVolumeInRooms()).toBe(true)
    expect(localStorage.getItem(ONE_VOLUME_KEY)).toBeNull()
  })

  it('is on in a store build, whatever a test build left in storage', () => {
    localStorage.setItem(ONE_VOLUME_KEY, '0')
    reloadOneVolumeForTests()
    vi.stubEnv('VITE_PORTABLE_CONSOLE', 'false')
    expect(oneVolumeInRooms()).toBe(true)
  })

  it('holds for the session where storage refuses it', () => {
    const refuse = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Full', 'QuotaExceededError')
      })
    setOneVolumeInRooms(false)
    expect(oneVolumeInRooms()).toBe(false)
    refuse.mockRestore()
  })
})
