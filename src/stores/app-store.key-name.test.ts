import { afterEach, describe, expect, it } from 'vitest'
import { keyName, scaleType, setKeyName, setScaleType, } from '@/stores/app-store'

afterEach(() => {
  setKeyName('C')
  setScaleType('major')
})

describe('the key as the app reads it', () => {
  it('reads a key picked from the list as it was written', () => {
    setKeyName('Eb')

    expect(keyName()).toBe('Eb')
  })

  it("reads an old melody's sharp name as the flat key the list has", () => {
    // The library's form listed twelve sharps until the twelve keys landed.
    setKeyName('A#')

    expect(keyName()).toBe('Bb')
  })

  it('renames the same do when the scale turns minor, and back', () => {
    setKeyName('Ab')

    setScaleType('natural-minor')
    expect(keyName()).toBe('G#')

    setScaleType('major')
    expect(keyName()).toBe('Ab')
  })

  it("keeps the do whichever is set first, a melody's key or its scale", () => {
    setScaleType('harmonic-minor')
    setKeyName('Db')
    expect([keyName(), scaleType()]).toEqual(['C#', 'harmonic-minor'])

    setKeyName('A')
    setScaleType('major')
    expect(keyName()).toBe('A')
  })

  it('reads a key no table knows as C', () => {
    setKeyName('X minor')

    expect(keyName()).toBe('C')
  })
})
