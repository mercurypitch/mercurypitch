import { describe, expect, it } from 'vitest'
import { degreeChordMidis } from '@/lib/ear/progressions'
import type { CadenceRound } from './cadence-rounds'
import { CADENCE_ROUNDS, cadenceIsRight, chordsOf, planCadences, stepsOf, typesFor, typesLabel, } from './cadence-rounds'

/** A repeatable stand-in for Math.random (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("a level's cadences", () => {
  it('asks first only whether a phrase is finished or not', () => {
    for (const level of [1, 2, 3]) {
      expect(typesFor(level)).toEqual(['perfect', 'imperfect'])
    }
  })

  it('adds the plagal cadence, then the interrupted one', () => {
    for (const level of [4, 5, 6]) {
      expect(typesFor(level)).toEqual(['perfect', 'imperfect', 'plagal'])
    }
    for (const level of [7, 10]) {
      expect(typesFor(level)).toEqual([
        'perfect',
        'imperfect',
        'plagal',
        'interrupted',
      ])
    }
  })

  it('names its cadences in a sentence', () => {
    expect(typesLabel(typesFor(1))).toBe('Perfect and Imperfect')
    expect(typesLabel(typesFor(5))).toBe('Perfect, Imperfect and Plagal')
    expect(typesLabel(typesFor(9))).toBe(
      'Perfect, Imperfect, Plagal and Interrupted',
    )
  })
})

describe('the rounds of a run', () => {
  it("asks for eight cadences, each of the level's own", () => {
    const rounds = planCadences({ difficulty: 5, random: seeded(1) })
    expect(rounds).toHaveLength(CADENCE_ROUNDS)
    for (const round of rounds) {
      expect(typesFor(5)).toContain(round.type)
    }
  })

  it('deals the types evenly', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const two = planCadences({ difficulty: 2, random: seeded(seed) })
      expect(two.filter((r) => r.type === 'perfect')).toHaveLength(4)
      expect(two.filter((r) => r.type === 'imperfect')).toHaveLength(4)
      const four = planCadences({ difficulty: 9, random: seeded(seed) })
      for (const type of typesFor(9)) {
        expect(four.filter((r) => r.type === type)).toHaveLength(2)
      }
    }
  })

  it('writes each cadence with its own two chords', () => {
    const seen = new Map<string, Set<string>>()
    for (let seed = 1; seed <= 60; seed++) {
      for (const round of planCadences({
        difficulty: 10,
        random: seeded(seed),
      })) {
        const chords = seen.get(round.type) ?? new Set<string>()
        chords.add(round.degrees.join('-'))
        seen.set(round.type, chords)
      }
    }
    expect(seen.get('perfect')).toEqual(new Set(['5-1']))
    expect(seen.get('plagal')).toEqual(new Set(['4-1']))
    expect(seen.get('interrupted')).toEqual(new Set(['5-6']))
    // Three roads to V.
    expect(seen.get('imperfect')).toEqual(new Set(['1-5', '4-5', '2-5']))
  })

  it('moves to another key for every round, from G to E', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rounds = planCadences({
        difficulty: 10,
        rounds: 30,
        random: seeded(seed),
      })
      for (const [i, round] of rounds.entries()) {
        expect(round.tonicMidi).toBeGreaterThanOrEqual(55)
        expect(round.tonicMidi).toBeLessThanOrEqual(64)
        if (i > 0) expect(round.tonicMidi).not.toBe(rounds[i - 1].tonicMidi)
      }
    }
  })

  it('ends on a number that never changes, without spinning', () => {
    // A stand-in that always says the same thing must still get a new key.
    const rounds = planCadences({ difficulty: 5, random: () => 0 })
    expect(rounds).toHaveLength(CADENCE_ROUNDS)
    for (let i = 1; i < rounds.length; i++) {
      expect(rounds[i].tonicMidi).not.toBe(rounds[i - 1].tonicMidi)
    }
  })
})

describe('what a round plays', () => {
  const round = (
    type: CadenceRound['type'],
    degrees: readonly [number, number],
  ): CadenceRound => ({ type, tonicMidi: 60, degrees })

  it("is the key's own chord, then the ending's two", () => {
    const steps = stepsOf(round('perfect', [5, 1]))
    expect(steps.map((s) => s.role)).toEqual(['home', 'first', 'last'])
    expect(steps.map((s) => s.degree)).toEqual([1, 5, 1])
    expect(steps[1].midis).toEqual(degreeChordMidis(60, 5))
    // C major under a C an octave down: the lib's close voicing.
    expect(steps[0].midis).toEqual([48, 60, 64, 67])
  })

  it("is three chords even where the ending opens on the key's own", () => {
    const steps = stepsOf(round('imperfect', [1, 5]))
    expect(steps.map((s) => s.degree)).toEqual([1, 1, 5])
  })

  it('says its two chords in Roman numerals', () => {
    expect(chordsOf(round('perfect', [5, 1]))).toBe('V to I')
    expect(chordsOf(round('plagal', [4, 1]))).toBe('IV to I')
    expect(chordsOf(round('imperfect', [2, 5]))).toBe('ii to V')
    expect(chordsOf(round('interrupted', [5, 6]))).toBe('V to vi')
  })

  it('is answered by its own name alone', () => {
    const plagal = round('plagal', [4, 1])
    expect(cadenceIsRight(plagal, 'plagal')).toBe(true)
    expect(cadenceIsRight(plagal, 'perfect')).toBe(false)
  })
})
