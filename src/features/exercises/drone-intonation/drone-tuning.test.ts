// ============================================================
// Drone tuning: just ratios in cents, and the targets they set
// ============================================================

import { describe, expect, it } from 'vitest'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { droneTargetMidi, JUST_RATIOS, offsetInWords, pureOffsetCents, tuningInWords, } from './drone-tuning'
import { droneIntervalLabel } from './use-drone-intonation-controller'

describe('the pure intervals over the drone', () => {
  it.each([
    [0, 0],
    [3, 15.6413],
    [4, -13.6863],
    [5, -1.955],
    [7, 1.955],
    [12, 0],
  ])(
    'sets the %i-semitone interval %f cents from the piano',
    (semitones, cents) => {
      expect(pureOffsetCents(semitones)).toBeCloseTo(cents, 3)
    },
  )

  it("has a just ratio for every interval in the drill's pool", () => {
    // The pool is what the drill has names for (droneIntervalLabel).
    const pool = Array.from({ length: 13 }, (_, s) => s).filter(
      (s) => droneIntervalLabel(s) !== undefined,
    )

    expect(pool).toEqual([0, 3, 4, 5, 7, 12])
    expect(pool.filter((s) => JUST_RATIOS[s] === undefined)).toEqual([])
  })

  it("keeps the piano's note for an interval it has no ratio for", () => {
    expect(pureOffsetCents(6)).toBe(0)
  })
})

describe('the target a round sets', () => {
  it("is the piano's own note in Piano tuning", () => {
    expect(droneTargetMidi(52, 7, 'piano')).toBe(59)
  })

  it.each([
    [7, 3 / 2],
    [4, 5 / 4],
    [3, 6 / 5],
    [5, 4 / 3],
    [12, 2],
  ])(
    'stands %i semitones over the drone at %f of its frequency in Pure',
    (semitones, ratio) => {
      const drone = 52
      const target = droneTargetMidi(drone, semitones, 'pure')

      expect(midiToFrequency(target) / midiToFrequency(drone)).toBeCloseTo(
        ratio,
        9,
      )
    },
  )
})

describe('the words for a tuning', () => {
  it('names each tuning as the run and its result say it', () => {
    expect(tuningInWords('piano')).toBe('Piano tuning')
    expect(tuningInWords('pure')).toBe('Pure tuning')
  })

  it("says where a pure target sits from the piano's note, to the cent", () => {
    expect(offsetInWords(pureOffsetCents(4))).toBe('14 cents low')
    expect(offsetInWords(pureOffsetCents(7))).toBe('2 cents high')
    expect(offsetInWords(pureOffsetCents(3))).toBe('16 cents high')
    expect(offsetInWords(pureOffsetCents(12))).toBe('')
  })
})
