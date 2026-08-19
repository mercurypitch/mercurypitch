// ============================================================
// Guitar Night's rooms are catalog rooms now
// ============================================================
//
// Reported while looking for somewhere to put the supporter art: "I can
// switch rooms in guitar night, but I guess they are available and in repo
// images? … wire it up to an index for these rooms so I can control them
// from admin and have premium ones."
//
// That was exactly right. Guitar Night shipped its own `backdrops.ts` — four
// hardcoded `/guitar-night/*.webp` behind its own storage key and its own
// `<select>` — while Karaoke Night, Jam and Piano Night all resolved rooms
// through `background-catalog.ts`. Nothing about Guitar Night could reach the
// admin panel, the supporter checks, or the protected-asset endpoint, because
// it never asked the catalog anything.
//
// This file pins the join: the four rooms are the same four rooms, they still
// point at files that ship, and the surface behaves like every other surface.
// The migration of an already-chosen room is in
// `src/lib/backgrounds/background-selection.test.ts`.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BACKGROUND_CATALOG, DEFAULT_BACKGROUND_IDS, defaultBackground, isBackgroundSurface, listBackgrounds, } from '@/lib/backgrounds/background-catalog'
import { BACKGROUND_SELECTION_KEYS } from '@/lib/backgrounds/background-selection'
import { guitarRoomLabel } from './guitar-rooms'

const guitarRooms = listBackgrounds('guitar')

describe('the guitar surface', () => {
  it('is a surface the rest of the app recognises', () => {
    expect(isBackgroundSurface('guitar')).toBe(true)
  })

  it('still leads with the four rooms that used to live in backdrops.ts', () => {
    // The identifiers are deliberately unchanged: they are what is already in
    // people's browsers, so keeping them is what makes the migration a
    // storage-key change rather than a reset to the default room. Rooms added
    // since follow them; these four have to stay, and stay first.
    expect(guitarRooms.slice(0, 4).map((room) => room.id)).toEqual([
      'velvet-rehearsal',
      'valve-corner',
      'blue-hour-roof',
      'daylight-loft',
    ])
  })

  it('offers a real file for every room', () => {
    // A room that 404s leaves the page on the CSS fallback with a name that
    // lies about which room you are in.
    for (const room of guitarRooms) {
      expect(room.assetSource.kind).toBe('public')
      if (room.assetSource.kind !== 'public') continue
      expect(room.assetSource.landscape.startsWith('/guitar-night/')).toBe(true)
      expect(() =>
        readFileSync(
          `public${room.assetSource.kind === 'public' ? room.assetSource.landscape : ''}`,
        ),
      ).not.toThrow()
    }
  })

  it('keeps every one of them free', () => {
    // They ship in the repo and always have. A migration that quietly made a
    // room people already use into a supporter room would be a takeaway.
    for (const room of guitarRooms) {
      expect(room.access.kind).toBe('free')
    }
  })

  it('opens on the room it always opened on', () => {
    expect(DEFAULT_BACKGROUND_IDS.guitar).toBe('velvet-rehearsal')
    expect(defaultBackground('guitar').surface).toBe('guitar')
  })

  it('names each room once, across the whole catalog', () => {
    // Ids are global here, not per surface — `getBackgroundDefinition` looks
    // them up in one map — so a collision with a jam or piano room would
    // silently hand the wrong surface's art to whoever asked second.
    const ids = BACKGROUND_CATALOG.map((background) => background.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has somewhere of its own to remember the choice', () => {
    expect(BACKGROUND_SELECTION_KEYS.guitar).toBe(
      'pitchperfect_guitar_background',
    )
    const keys = Object.values(BACKGROUND_SELECTION_KEYS)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('describes each room, so a picker has something to say', () => {
    // The old `<select>` had one line of text per room and put the detail in
    // a title attribute nobody on a phone can see. The picker shows both.
    for (const room of guitarRooms) {
      expect(room.label.length).toBeGreaterThan(0)
      expect(room.description ?? '').not.toBe('')
    }
  })
})

describe('the name the rail shows', () => {
  it("is the room's own label", () => {
    expect(guitarRoomLabel('valve-corner')).toBe('Valve Corner')
  })

  it('is still a word for an id the catalog has never heard of', () => {
    // The types rule this out and the controller cannot produce it, but the
    // rail is a live string in a header: "undefined" written across the top
    // of Guitar Night is a worse failure than a generic word.
    expect(guitarRoomLabel('retired-room')).toBe('Guitar Night room')
  })
})
