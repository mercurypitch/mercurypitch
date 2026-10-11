// ============================================================
// Credits named by what they buy, one and many
// ============================================================

import { describe, expect, it } from 'vitest'
import { freeSongSeparations, songSeparations } from './song-separations'

describe('credits named as song separations', () => {
  it('says one separation, without "up to", for a single credit', () => {
    expect(songSeparations(1)).toBe('1 song separation')
    expect(freeSongSeparations(1)).toBe('1 free song separation')
  })

  it('keeps "up to" and the plural for more than one', () => {
    // A credit splits one song of up to 12 minutes; a longer song or a full
    // band split costs more, so a count of credits is at most that many songs.
    expect(songSeparations(5)).toBe('up to 5 song separations')
    expect(freeSongSeparations(5)).toBe('up to 5 free song separations')
  })
})
