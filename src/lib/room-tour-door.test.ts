// The door First Light and the plan start a tab's tour through: it starts
// what App handed in, and nothing before that.

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
  it('starts nothing, and does not throw, before App hands it a starter', () => {
    expect(() => door.startTabTour(TAB_SINGING)).not.toThrow()
  })

  it("starts the tab's tour through the starter App handed in", () => {
    // Arrange
    const start = vi.fn<(tab: string) => void>()
    door.provideRoomTourDoor(start)

    // Act
    door.startTabTour(TAB_GUITAR)

    // Assert
    expect(start).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledWith(TAB_GUITAR)
  })

  it('uses the starter handed in last', () => {
    // Arrange
    const first = vi.fn<(tab: string) => void>()
    const last = vi.fn<(tab: string) => void>()
    door.provideRoomTourDoor(first)
    door.provideRoomTourDoor(last)

    // Act
    door.startTabTour(TAB_SINGING)

    // Assert
    expect(first).not.toHaveBeenCalled()
    expect(last).toHaveBeenCalledWith(TAB_SINGING)
  })
})
