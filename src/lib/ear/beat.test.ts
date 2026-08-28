import { describe, expect, it } from 'vitest'
import { beatRateHz, beatWord, detuneHz, driftOnsetsMs, pickDriftWay, } from './beat'

describe('beat — detune and beat rate', () => {
  it('detunes by cents and beats at the frequency difference', () => {
    expect(detuneHz(440, 1200)).toBeCloseTo(880)
    expect(detuneHz(440, 0)).toBe(440)
    expect(beatRateHz(220, 40)).toBeCloseTo(5.12, 1)
    expect(beatRateHz(220, -40)).toBeCloseTo(5.06, 1)
    expect(beatRateHz(110, 0.5)).toBeCloseTo(0.032, 2)
  })

  it('says the rate in beats a second, or one beat every so many seconds', () => {
    expect(beatWord(5.12)).toBe('5.1 beats a second')
    expect(beatWord(1)).toBe('1 beat a second')
    expect(beatWord(12.4)).toBe('12 beats a second')
    expect(beatWord(0.25)).toBe('a beat every 4 s')
    expect(beatWord(0)).toBe('no beating')
  })
})

describe('beat — drift onsets', () => {
  it('holds the period for the steady clicks, then plays the new tempo', () => {
    const steady = driftOnsetsMs(500, 10, 'steady', 5, 6)
    expect(steady).toHaveLength(11)
    expect(steady).toEqual([
      0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000,
    ])

    const faster = driftOnsetsMs(500, 10, 'faster', 5, 6)
    expect(faster.slice(0, 5)).toEqual([0, 500, 1000, 1500, 2000])
    // Tempo × 1.1 → period 500 / 1.1.
    expect(faster[5] - faster[4]).toBeCloseTo(454.5, 1)
    expect(faster[10] - faster[9]).toBeCloseTo(454.5, 1)

    const slower = driftOnsetsMs(500, 10, 'slower', 5, 6)
    // Tempo × 0.9 → period 500 / 0.9.
    expect(slower[5] - slower[4]).toBeCloseTo(555.6, 1)
    expect(slower[10]).toBeGreaterThan(steady[10])
  })

  it('draws the three ways a third each', () => {
    expect(pickDriftWay(() => 0)).toBe('steady')
    expect(pickDriftWay(() => 0.34)).toBe('faster')
    expect(pickDriftWay(() => 0.67)).toBe('slower')
    expect(pickDriftWay(() => 0.999)).toBe('slower')
  })
})
