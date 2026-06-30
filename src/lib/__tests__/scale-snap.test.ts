import { describe, expect, it } from 'vitest'
import { scaleDegreeSet, snapMidiToScale } from '../scale-data'

describe('scaleDegreeSet', () => {
  it('returns C major pitch classes', () => {
    expect([...scaleDegreeSet('C', 'major')].sort((a, b) => a - b)).toEqual([
      0, 2, 4, 5, 7, 9, 11,
    ])
  })

  it('returns A natural-minor pitch classes', () => {
    expect(
      [...scaleDegreeSet('A', 'natural-minor')].sort((a, b) => a - b),
    ).toEqual([0, 2, 4, 5, 7, 9, 11])
  })

  it('chromatic contains all twelve pitch classes', () => {
    expect(scaleDegreeSet('C', 'chromatic').size).toBe(12)
  })

  it('falls back to major for an unknown scale type', () => {
    expect([...scaleDegreeSet('C', 'nonsense')].sort((a, b) => a - b)).toEqual([
      0, 2, 4, 5, 7, 9, 11,
    ])
  })
})

describe('snapMidiToScale', () => {
  it('leaves an in-scale note within the band unchanged', () => {
    const r = snapMidiToScale(60.4, 'C', 'major')
    expect(r.midi).toBe(60)
    expect(r.snapped).toBe(false)
    expect(r.flagged).toBe(false)
  })

  it('snaps an out-of-scale note to the nearest degree within the band', () => {
    // 60.55 rounds to C# (out of C major); nearest degree C is 55 cents away.
    const r = snapMidiToScale(60.55, 'C', 'major')
    expect(r.midi).toBe(60)
    expect(r.snapped).toBe(true)
    expect(r.flagged).toBe(true)
  })

  it('leaves a note outside the guard band raw, but flags it', () => {
    // C# is 100 cents from both C and D — outside the default 60-cent band.
    const r = snapMidiToScale(61, 'C', 'major')
    expect(r.midi).toBe(61)
    expect(r.snapped).toBe(false)
    expect(r.flagged).toBe(true)
  })

  it('respects a tighter guard band', () => {
    const r = snapMidiToScale(60.55, 'C', 'major', 40)
    expect(r.midi).toBe(61)
    expect(r.snapped).toBe(false)
  })

  it('is identity on the chromatic scale', () => {
    const r = snapMidiToScale(60.4, 'C', 'chromatic')
    expect(r.midi).toBe(60)
    expect(r.snapped).toBe(false)
    expect(r.flagged).toBe(false)
  })
})
