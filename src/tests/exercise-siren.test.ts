import { describe, expect, it } from 'vitest'
import { generateSirens, SIREN_GUIDE_PERIOD_MS, sirenGuideMidi, } from '@/features/exercises/siren/use-siren-controller'

describe('generateSirens', () => {
  // Regression: glides used to clamp endpoints one-sidedly and could emit
  // sub-audible notes (e.g. "G0"). Every endpoint must stay inside the
  // comfortable range and each glide must span two distinct notes.
  it('keeps both endpoints within the comfortable range', () => {
    const min = 48 // C3
    const max = 72 // C5
    for (const baseMidi of [48, 55, 60, 67, 72]) {
      for (const difficulty of [1, 5, 10]) {
        const rounds = generateSirens(baseMidi, difficulty, min, max)
        expect(rounds.length).toBe(6)
        for (const r of rounds) {
          expect(r.startMidi).toBeGreaterThanOrEqual(min)
          expect(r.startMidi).toBeLessThanOrEqual(max)
          expect(r.endMidi).toBeGreaterThanOrEqual(min)
          expect(r.endMidi).toBeLessThanOrEqual(max)
          expect(r.startMidi).not.toBe(r.endMidi)
        }
      }
    }
  })

  it('alternates ascending and descending glides', () => {
    const rounds = generateSirens(60, 5, 48, 72)
    expect(rounds[0]!.endMidi).toBeGreaterThan(rounds[0]!.startMidi) // up
    expect(rounds[1]!.endMidi).toBeLessThan(rounds[1]!.startMidi) // down
  })
})

describe('sirenGuideMidi', () => {
  const P = SIREN_GUIDE_PERIOD_MS

  // Regression: the dot used to be drawn off the run's elapsed clock, so a
  // round could open with the dot already at the far end, or travelling
  // backwards, under a caption reading "follow the dot". Measured from the
  // window opening, it must always leave from the start note.
  it('leaves from the start note and returns to it each period', () => {
    expect(sirenGuideMidi(60, 67, 0)).toBeCloseTo(60)
    expect(sirenGuideMidi(60, 67, P / 2)).toBeCloseTo(67)
    expect(sirenGuideMidi(60, 67, P)).toBeCloseTo(60)
    // Every later round starts from the same place, not mid-travel.
    expect(sirenGuideMidi(60, 67, P * 4)).toBeCloseTo(60)
    expect(sirenGuideMidi(60, 67, P * 4.5)).toBeCloseTo(67)
  })

  it('travels the same way for a descending glide', () => {
    expect(sirenGuideMidi(67, 60, 0)).toBeCloseTo(67)
    expect(sirenGuideMidi(67, 60, P / 2)).toBeCloseTo(60)
    expect(sirenGuideMidi(67, 60, P)).toBeCloseTo(67)
  })

  it('never leaves the interval, and never goes negative in time', () => {
    for (const [from, to] of [
      [60, 72],
      [72, 60],
    ]) {
      const lo = Math.min(from!, to!)
      const hi = Math.max(from!, to!)
      for (let t = -500; t <= P * 2; t += 25) {
        const m = sirenGuideMidi(from!, to!, t)
        expect(m).toBeGreaterThanOrEqual(lo)
        expect(m).toBeLessThanOrEqual(hi)
      }
    }
    // A negative offset (a stale anchor from a previous round) parks the
    // dot on the start note rather than throwing it somewhere arbitrary.
    expect(sirenGuideMidi(60, 67, -1000)).toBeCloseTo(60)
  })
})
