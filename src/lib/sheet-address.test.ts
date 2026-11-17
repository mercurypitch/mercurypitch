import { describe, expect, it } from 'vitest'
import { sheetKeyOf } from '@/lib/sheet-address'

describe('sheetKeyOf', () => {
  it('reads a key with no scale as a major key', () => {
    expect(sheetKeyOf('G', null)).toEqual({ key: 'G', scale: 'major' })
    expect(sheetKeyOf('Bb', null)).toEqual({ key: 'Bb', scale: 'major' })
    expect(sheetKeyOf('F#', null)).toEqual({ key: 'F#', scale: 'major' })
  })

  it('reads a key by any of its spellings, and holds it in ASCII', () => {
    expect(sheetKeyOf('B♭', null).key).toBe('Bb')
    expect(sheetKeyOf('bb', null).key).toBe('Bb')
    expect(sheetKeyOf('A#', null).key).toBe('Bb')
    expect(sheetKeyOf('Gb', null).key).toBe('F#')
  })

  it('reads a key with a minor scale as that minor key, by its own name', () => {
    expect(sheetKeyOf('A', 'harmonic-minor')).toEqual({
      key: 'A',
      scale: 'harmonic-minor',
    })
    expect(sheetKeyOf('Ab', 'natural-minor')).toEqual({
      key: 'G#',
      scale: 'natural-minor',
    })
    expect(sheetKeyOf('C', 'minor')).toEqual({
      key: 'C',
      scale: 'natural-minor',
    })
  })

  it('reads a scale alone and leaves the key to the tab', () => {
    expect(sheetKeyOf(null, 'dorian')).toEqual({ key: null, scale: 'dorian' })
  })

  it('names nothing for an address with no key and no scale', () => {
    expect(sheetKeyOf(null, null)).toEqual({ key: null, scale: null })
  })

  it('drops a key it cannot read, and reads the rest', () => {
    expect(sheetKeyOf('H', null)).toEqual({ key: null, scale: null })
    expect(sheetKeyOf('G major', 'melodic-minor')).toEqual({
      key: null,
      scale: 'melodic-minor',
    })
  })

  it('drops a scale it cannot read, so the key is a major key', () => {
    expect(sheetKeyOf('D', 'wholetone')).toEqual({ key: 'D', scale: 'major' })
    // A name every object has is not a scale.
    expect(sheetKeyOf('D', 'constructor')).toEqual({ key: 'D', scale: 'major' })
  })
})
