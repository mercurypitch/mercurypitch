import { describe, expect, it } from 'vitest'
import { buildChordToneMidis, getChordToneRole, isChordTone, } from '@/lib/guitar/chord-utils'

describe('getChordToneRole', () => {
  it('labels a major triad correctly', () => {
    expect(getChordToneRole(60, 60, 'maj')).toBe('root')
    expect(getChordToneRole(64, 60, 'maj')).toBe('third')
    expect(getChordToneRole(67, 60, 'maj')).toBe('fifth')
  })

  it('labels a dominant 7th correctly', () => {
    expect(getChordToneRole(70, 60, 'dom7')).toBe('seventh')
  })

  it('labels sus2 by interval, not position — the 2nd is not a "third"', () => {
    // sus2 degrees: [0, 2, 7]. The middle degree (index 1) is a major 2nd,
    // not a 3rd — it used to be mislabeled 'third' via a dead
    // `? 'third' : 'third'` ternary.
    expect(getChordToneRole(60, 60, 'sus2')).toBe('root')
    expect(getChordToneRole(62, 60, 'sus2')).toBe('second')
    expect(getChordToneRole(67, 60, 'sus2')).toBe('fifth')
  })

  it('labels sus4 by interval, not position — the 4th is not a "third"', () => {
    // sus4 degrees: [0, 5, 7].
    expect(getChordToneRole(60, 60, 'sus4')).toBe('root')
    expect(getChordToneRole(65, 60, 'sus4')).toBe('fourth')
    expect(getChordToneRole(67, 60, 'sus4')).toBe('fifth')
  })

  it('returns null for a note outside the chord', () => {
    expect(getChordToneRole(61, 60, 'maj')).toBeNull()
  })

  it('returns null for an unknown chord name', () => {
    expect(getChordToneRole(60, 60, 'not-a-chord')).toBeNull()
  })
})

describe('isChordTone / buildChordToneMidis', () => {
  it('agrees with getChordToneRole on chord membership', () => {
    expect(isChordTone(62, 60, 'sus2')).toBe(true)
    expect(isChordTone(61, 60, 'sus2')).toBe(false)
  })

  it('includes the sus2 second across octaves', () => {
    const midis = buildChordToneMidis(60, 'sus2')
    expect(midis.has(62)).toBe(true)
    expect(midis.has(74)).toBe(true) // 62 + 12
  })
})
