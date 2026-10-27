import { describe, expect, it } from 'vitest'
import { AUDIBLE_HIGH, AUDIBLE_LOW, pickHome, planRounds, roundWindow, voiceChord, } from './home-note-round'

/** A seeded source, so a run's keys are the same every time. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

describe('Home note rounds', () => {
  it('draws from G3 to G4 when nothing is known of the singer', () => {
    expect(roundWindow(null)).toEqual({ low: 55, high: 67 })
    expect(roundWindow({ low: Number.NaN, high: 60 })).toEqual({
      low: 55,
      high: 67,
    })
  })

  it("keeps the singer's own window inside what a phone carries", () => {
    // A bass, E2 to E4: the low end is cut at D3.
    expect(roundWindow({ low: 40, high: 64 })).toEqual({
      low: AUDIBLE_LOW,
      high: 64,
    })
    // A soprano, C4 to C6: the top is cut at D5.
    expect(roundWindow({ low: 60, high: 84 })).toEqual({
      low: 60,
      high: AUDIBLE_HIGH,
    })
  })

  it('widens a narrow window about its middle, at least five semitones', () => {
    const window = roundWindow({ low: 58, high: 60 })
    expect(window.high - window.low).toBe(5)
    expect(window.low).toBeLessThanOrEqual(59)
    expect(window.high).toBeGreaterThanOrEqual(59)
    // A window wholly under the band lands at its bottom, not below it.
    const low = roundWindow({ low: 30, high: 36 })
    expect(low.low).toBeGreaterThanOrEqual(AUDIBLE_LOW)
    expect(low.high - low.low).toBe(5)
  })

  it('never picks the key before it, and stays in the window', () => {
    const random = seeded(11)
    const window = { low: 55, high: 60 }
    let previous: number | null = null
    for (let i = 0; i < 500; i++) {
      const home = pickHome(window, previous, random)
      expect(home).toBeGreaterThanOrEqual(window.low)
      expect(home).toBeLessThanOrEqual(window.high)
      expect(home).not.toBe(previous)
      previous = home
    }
  })

  it('plans a run of keys, none the same as the one before', () => {
    const rounds = planRounds(6, { low: 55, high: 67 }, seeded(3))
    expect(rounds.map((round) => round.index)).toEqual([0, 1, 2, 3, 4, 5])
    for (let i = 1; i < rounds.length; i++) {
      expect(rounds[i].home).not.toBe(rounds[i - 1].home)
    }
  })

  it('voices I, IV and V close around home, the leading tone under it', () => {
    // C4 is home.
    expect(voiceChord(60, 'I')).toEqual({ bass: 48, triad: [60, 64, 67] })
    // F A C: home stays on top of the bass's F.
    expect(voiceChord(60, 'IV')).toEqual({ bass: 53, triad: [60, 65, 69] })
    // G B D: B, a semitone under home, leads back to it.
    expect(voiceChord(60, 'V')).toEqual({ bass: 55, triad: [59, 62, 67] })
  })

  it('builds every chord of the key from its own scale', () => {
    // The major scale's pitch classes, from home.
    const scale = new Set([0, 2, 4, 5, 7, 9, 11])
    for (const chord of ['I', 'IV', 'V'] as const) {
      const { bass, triad } = voiceChord(62, chord)
      for (const midi of [bass, ...triad]) {
        expect(scale.has((((midi - 62) % 12) + 12) % 12)).toBe(true)
      }
    }
  })
})
