// The door First Light and the plan start a tab's tour through, and the Map
// asks whether a room has one: it uses what App handed in, and before that
// starts nothing and says no room has a tour.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_GUITAR, TAB_SINGING } from '@/features/tabs/constants'
import type * as DoorModule from './room-tour-door'

let door: typeof DoorModule

beforeEach(async () => {
  // Each case starts with a door nothing has been handed to.
  vi.resetModules()
  door = await import('./room-tour-door')
})

describe('the room tour door', () => {
  it('starts nothing, does not throw, and has no tour before App hands it one', () => {
    expect(() => door.startTabTour(TAB_SINGING)).not.toThrow()
    expect(door.hasTabTour(TAB_SINGING)).toBe(false)
  })

  it("starts the tab's tour through the starter App handed in", () => {
    // Arrange
    const start = vi.fn<(tab: string) => void>()
    door.provideRoomTourDoor(start, () => true)

    // Act
    door.startTabTour(TAB_GUITAR)

    // Assert
    expect(start).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledWith(TAB_GUITAR)
  })

  it('answers whether a tab has a tour with the check App handed in, for that tab', () => {
    // Arrange
    const has = vi.fn((tab: string) => tab === TAB_SINGING)
    door.provideRoomTourDoor(vi.fn(), has)

    // Act + Assert
    expect([door.hasTabTour(TAB_SINGING), door.hasTabTour(TAB_GUITAR)]).toEqual(
      [true, false],
    )
    expect(has.mock.calls).toEqual([[TAB_SINGING], [TAB_GUITAR]])
  })

  it('uses what was handed in last', () => {
    // Arrange
    const first = vi.fn<(tab: string) => void>()
    const last = vi.fn<(tab: string) => void>()
    door.provideRoomTourDoor(first, () => true)
    door.provideRoomTourDoor(last, () => false)

    // Act
    door.startTabTour(TAB_SINGING)

    // Assert
    expect(first).not.toHaveBeenCalled()
    expect(last).toHaveBeenCalledWith(TAB_SINGING)
    expect(door.hasTabTour(TAB_SINGING)).toBe(false)
  })
})
