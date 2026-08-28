import { describe, expect, it } from 'vitest'
import { METRE_BANK, METRE_PATTERNS, metreName, METRES, patternOf, stepMs, } from './metre'

describe('metre', () => {
  it('names the five metres and banks two patterns of each, the accent on one', () => {
    expect(METRES.map(metreName)).toEqual(['3/4', '4/4', '5/4', '6/8', '7/8'])
    expect(METRE_PATTERNS).toHaveLength(10)
    for (const metre of METRES) {
      const ofMetre = METRE_PATTERNS.filter(
        (p) => metreName(p.metre) === metreName(metre),
      )
      expect(ofMetre).toHaveLength(2)
    }
    for (const pattern of METRE_PATTERNS) {
      expect(pattern.steps).toHaveLength(pattern.metre.beats)
      expect(pattern.steps[0].accent).toBe(true)
      expect(pattern.steps[0].voice).toBe('kick')
      expect(pattern.steps.slice(1).every((s) => s.accent !== true)).toBe(true)
      expect(pattern.steps.map((s) => s.step)).toEqual(
        pattern.steps.map((_, i) => i),
      )
    }
  })

  it('exposes the bank with beats and unit as the payload, seeds easy to odd', () => {
    expect(METRE_BANK).toHaveLength(METRE_PATTERNS.length)
    expect(METRE_BANK[0]).toMatchObject({ name: '4/4', payload: [4, 4] })
    expect(METRE_BANK[METRE_BANK.length - 1].name).toBe('7/8')
    expect(patternOf('metre:6-8:a')?.metre).toEqual({ beats: 6, unit: 8 })
    expect(patternOf('nope')).toBeUndefined()
    expect(stepMs({ beats: 4, unit: 4 }, 500)).toBe(500)
    expect(stepMs({ beats: 7, unit: 8 }, 500)).toBe(250)
  })
})
