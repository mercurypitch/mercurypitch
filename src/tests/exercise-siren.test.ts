import { describe, expect, it } from 'vitest'
import { generateSirens } from '@/features/exercises/siren/use-siren-controller'

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
