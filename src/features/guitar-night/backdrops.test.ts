// Backdrop tests keep every offered room to an image that really ships.
// ============================================================

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_BACKDROP_ID, GUITAR_NIGHT_BACKDROPS, isBackdropId, resolveBackdrop, } from './backdrops'

describe('GUITAR_NIGHT_BACKDROPS', () => {
  it('offers a real file for every room', () => {
    for (const room of GUITAR_NIGHT_BACKDROPS) {
      expect(room.url.startsWith('/guitar-night/')).toBe(true)
      // A room that 404s would leave the page on the CSS fallback with a name
      // that lies about which room you are in.
      expect(() => readFileSync(`public${room.url}`)).not.toThrow()
    }
  })

  it('names each room once', () => {
    const ids = GUITAR_NIGHT_BACKDROPS.map((room) => room.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps the default room in the list', () => {
    expect(isBackdropId(DEFAULT_BACKDROP_ID)).toBe(true)
  })
})

describe('resolveBackdrop', () => {
  it('returns the named room', () => {
    expect(resolveBackdrop('daylight-loft').name).toBe('Daylight Loft')
  })

  it('falls back to the first room for an id that no longer ships', () => {
    expect(resolveBackdrop('retired-room').id).toBe(DEFAULT_BACKDROP_ID)
    expect(resolveBackdrop(null).id).toBe(DEFAULT_BACKDROP_ID)
  })

  it('rejects a stored value that is not a room id', () => {
    expect(isBackdropId('retired-room')).toBe(false)
    expect(isBackdropId(4)).toBe(false)
  })
})
