import { describe, expect, it } from 'vitest'
import { PROGRESSIONS } from '@/lib/guitar/chord-progression'
import { BASSLINE_BANK, bassRootMidi, CADENCE_BANK, degreeChordMidis, progressionName, romanOf, } from './progressions'

describe('progressions — names and voicings', () => {
  it('says degrees in numerals, minor in lower case, the seventh diminished', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(romanOf)).toEqual([
      'I',
      'ii',
      'iii',
      'IV',
      'V',
      'vi',
      'vii°',
    ])
    expect(progressionName([1, 5, 6, 4])).toBe('I–V–vi–IV')
  })

  it('voices a degree chord close over the tonic with its root doubled below', () => {
    expect(degreeChordMidis(60, 1)).toEqual([48, 60, 64, 67])
    expect(degreeChordMidis(60, 4)).toEqual([53, 65, 69, 72])
    // vi is minor, vii° diminished.
    expect(degreeChordMidis(60, 6)).toEqual([57, 69, 72, 76])
    expect(degreeChordMidis(60, 7)).toEqual([59, 71, 74, 77])
    expect(bassRootMidi(60, 1)).toBe(48)
    expect(bassRootMidi(60, 5)).toBe(55)
  })
})

describe('CADENCE_BANK and BASSLINE_BANK', () => {
  it('banks every progression the guitar room knows, plainest first', () => {
    expect(CADENCE_BANK).toHaveLength(PROGRESSIONS.length)
    expect(CADENCE_BANK[0].name).toBe('I–IV–V')
    expect(CADENCE_BANK[0].label).toBe('I–IV–V')
    const ids = new Set(CADENCE_BANK.map((item) => item.itemId))
    expect(ids.size).toBe(CADENCE_BANK.length)
    for (const item of CADENCE_BANK) {
      expect(item.payload.length).toBeGreaterThanOrEqual(3)
      expect(item.payload.length).toBeLessThanOrEqual(4)
      expect(item.seed).toBeGreaterThanOrEqual(900)
    }
    expect(CADENCE_BANK[CADENCE_BANK.length - 1].seed).toBeGreaterThan(
      CADENCE_BANK[0].seed,
    )
  })

  it('banks four-root lines that start on the tonic', () => {
    expect(BASSLINE_BANK.length).toBeGreaterThanOrEqual(12)
    const ids = new Set(BASSLINE_BANK.map((item) => item.itemId))
    expect(ids.size).toBe(BASSLINE_BANK.length)
    for (const item of BASSLINE_BANK) {
      expect(item.payload).toHaveLength(4)
      expect(item.payload[0]).toBe(1)
      for (const degree of item.payload) {
        expect(degree).toBeGreaterThanOrEqual(1)
        expect(degree).toBeLessThanOrEqual(7)
      }
      expect(item.name).toBe(progressionName(item.payload))
    }
  })
})
