// ============================================================
// The web's rooms: each one has a card's words and a screen
// ============================================================

import { describe, expect, it } from 'vitest'
import { catalogueEntry } from '@/features/premium-exercises/catalogue'
import { EXERCISE_FIRST_NOTE_STAGE, EXERCISE_HARMONY_LAKE, EXERCISE_LONG_NOTE, EXERCISE_WARM_UP_PATH, } from '@/lib/domain/exercise-contracts'
import { isWebRoom, WEB_ROOM_IDS } from './web-room-ids'
import { WEB_WARM_UP_LINE, webRoomName, webRooms } from './web-room-list'
import { WEB_ROOM_SCREENS } from './web-room-screens'

describe("the web's rooms", () => {
  it("lists the eight rooms in the order the tab shows them, the catalogue's", () => {
    expect(webRooms().map((room) => room.entry.name)).toEqual([
      'Long note',
      'Echo',
      'Warm-up',
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

  it("says the catalogue's line of each room but the Warm-up, whose web routine is shorter", () => {
    const lines = webRooms().map((room) => [room.id, room.entry.line])

    expect(lines).toEqual(
      WEB_ROOM_IDS.map((id) => [
        id,
        id === EXERCISE_WARM_UP_PATH
          ? WEB_WARM_UP_LINE
          : catalogueEntry(id)?.line,
      ]),
    )
    expect(catalogueEntry(EXERCISE_WARM_UP_PATH)?.line).not.toBe(
      WEB_WARM_UP_LINE,
    )
  })

  it("names a room as the catalogue's card does", () => {
    expect(webRoomName(EXERCISE_HARMONY_LAKE)).toBe('Harmony')
  })

  it('opens a room for its own ids only', () => {
    expect(isWebRoom(EXERCISE_HARMONY_LAKE)).toBe(true)
    expect(isWebRoom(EXERCISE_WARM_UP_PATH)).toBe(true)
    // The old Long Note drill, and the room the web does not open yet.
    expect(isWebRoom(EXERCISE_LONG_NOTE)).toBe(false)
    expect(isWebRoom(EXERCISE_FIRST_NOTE_STAGE)).toBe(false)
    expect(isWebRoom(null)).toBe(false)
    expect(isWebRoom(undefined)).toBe(false)
  })
})
