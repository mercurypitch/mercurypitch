// ============================================================
// Room names — the seven the mock draws, and nothing generic
// ============================================================
//
// The bug this exists for is not a typo: it is a room header that read "Sing"
// over a photograph of a studio, because the stage handed the shell the tab's
// name instead of the room's (device round 1, P4). So the test that matters
// is the one that fails if a name ever falls back to the activity — which is
// why `ROOM_CATALOGUE`'s generic labels are read off the real module and
// asserted to be absent here, rather than the two maps being kept apart by
// hope.

import { describe, expect, it } from 'vitest'
import { ROOM_CATALOGUE } from './registry'
import type { NamedRoomId } from './room-names'
import { ROOM_NAMES, roomName } from './room-names'

describe('room names', () => {
  it('names every room the mock draws', () => {
    expect(ROOM_NAMES).toEqual({
      sing: 'Retro Analog Studio',
      karaoke: 'Broadway Theater',
      piano: 'Nocturne Studio',
      guitar: 'Alpine Lodge',
      drums: 'Pocket Console',
      'ear-lab': 'Workshop',
      jam: 'Indie Loft',
    })
  })

  it('covers every room in the catalogue, plus Jam', () => {
    const named = Object.keys(ROOM_NAMES).sort()
    const catalogued = Object.keys(ROOM_CATALOGUE)
    for (const id of catalogued) {
      expect(named).toContain(id)
    }
    expect(named).toEqual([...catalogued, 'jam'].sort())
  })

  it('never answers with the activity the tab is called', () => {
    const activities = Object.values(ROOM_CATALOGUE).map((room) => room.label)
    for (const [id, name] of Object.entries(ROOM_NAMES)) {
      expect(activities, `${id} fell back to its tab name`).not.toContain(name)
    }
  })

  it('gives every room a distinct name', () => {
    const names = Object.values(ROOM_NAMES)
    expect(new Set(names).size).toBe(names.length)
  })

  it('reads one out', () => {
    const sing: NamedRoomId = 'sing'
    expect(roomName(sing)).toBe('Retro Analog Studio')
    expect(roomName('jam')).toBe('Indie Loft')
  })
})
