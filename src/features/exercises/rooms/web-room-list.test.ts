// ============================================================
// The web's rooms: each one has a card's words and a screen
// ============================================================

import { describe, expect, it } from 'vitest'
import { EXERCISE_FIRST_NOTE_STAGE, EXERCISE_HARMONY_LAKE, EXERCISE_LONG_NOTE, EXERCISE_WARM_UP_PATH, } from '@/lib/domain/exercise-contracts'
import { isWebRoom, WEB_ROOM_IDS } from './web-room-ids'
import { webRoomName, webRooms } from './web-room-list'
import { WEB_ROOM_SCREENS } from './web-room-screens'

describe("the web's rooms", () => {
  it('lists the seven rooms in the order the tab shows them', () => {
    expect(webRooms().map((room) => room.entry.name)).toEqual([
      'Long note',
      'Echo',
      'Lip roll',
      'Ng slides',
      'Home note',
      'Leap',
      'Harmony',
    ])
  })

  it('has a catalogue entry for every id, under that id', () => {
    const rooms = webRooms()

    expect(rooms.map((room) => room.id)).toEqual([...WEB_ROOM_IDS])
    expect(rooms.map((room) => room.entry.id)).toEqual([...WEB_ROOM_IDS])
  })

  it('has a screen for every room', () => {
    const missing = WEB_ROOM_IDS.filter(
      (id) => typeof WEB_ROOM_SCREENS[id] !== 'function',
    )

    expect(missing).toEqual([])
  })

  it("names a room as the catalogue's card does", () => {
    expect(webRoomName(EXERCISE_HARMONY_LAKE)).toBe('Harmony')
  })

  it('opens a room for its own ids only', () => {
    expect(isWebRoom(EXERCISE_HARMONY_LAKE)).toBe(true)
    // The old Long Note drill, and the two rooms the web does not open yet.
    expect(isWebRoom(EXERCISE_LONG_NOTE)).toBe(false)
    expect(isWebRoom(EXERCISE_FIRST_NOTE_STAGE)).toBe(false)
    expect(isWebRoom(EXERCISE_WARM_UP_PATH)).toBe(false)
    expect(isWebRoom(null)).toBe(false)
    expect(isWebRoom(undefined)).toBe(false)
  })
})
