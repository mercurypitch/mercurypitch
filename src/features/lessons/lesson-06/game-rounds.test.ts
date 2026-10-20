// ============================================================
// Lesson 6 game round tests — what each game deals from a fixed seed
// ============================================================
//
// WEB-SPEC, Tests 5 (FACTS 62a, 67): Step or leap? draws only 1, 2, 3, 4, 5
// and 7, first notes from C4 to G4, every note from F3 to D5; Name it plays
// each of 1, 2, 5 and 7 twice, never the same twice running, steps down and
// leaps up. And every line a round says passes the app's claims check.

import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/features/lessons/kit/dom'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { pair } from './examples'
import { dealNameIt, dealStepOrLeap, FIRST_HI, FIRST_LO, NAME_IT_WORDS, nameItOrder, stepLeapWords, } from './game-rounds'

const SEEDS = [1, 2, 3, 42, 20261020, 987654321]

describe('Step or leap?', () => {
  it('deals ten rounds of 1, 2, 3, 4, 5 or 7 semitones, first notes C4 to G4, every note F3 to D5', () => {
    for (const seed of SEEDS) {
      // Act
      const rounds = dealStepOrLeap(mulberry32(seed))

      // Assert
      expect(rounds).toHaveLength(10)
      for (const r of rounds) {
        const [a, b] = r.events.map((e) => e.midi)
        expect(a).toBeGreaterThanOrEqual(FIRST_LO)
        expect(a).toBeLessThanOrEqual(FIRST_HI)
        expect([1, 2, 3, 4, 5, 7]).toContain(Math.abs(b - a))
        for (const m of [a, b]) {
          expect(m).toBeGreaterThanOrEqual(53)
          expect(m).toBeLessThanOrEqual(74)
        }
        expect(r.answer).toBe(Math.abs(b - a) <= 2 ? 'step' : 'leap')
        expect(r.events).toEqual(pair(a, b))
      }
    }
  })

  it('plays both directions and both answers over a few games', () => {
    const rounds = SEEDS.flatMap((seed) => dealStepOrLeap(mulberry32(seed)))
    const moves = rounds.map((r) => r.events[1].midi - r.events[0].midi)
    expect(moves.some((m) => m > 0)).toBe(true)
    expect(moves.some((m) => m < 0)).toBe(true)
    expect(new Set(rounds.map((r) => r.answer))).toEqual(
      new Set(['step', 'leap']),
    )
  })

  it("says each size's line as WEB-SPEC Toys 4 writes it", () => {
    expect(stepLeapWords(1, true)).toBe('A step: a semitone up.')
    expect(stepLeapWords(2, false)).toBe('A step: 2 semitones down, a tone.')
    expect(stepLeapWords(3, false)).toBe('A leap: 3 semitones down.')
    expect(stepLeapWords(4, true)).toBe('A leap: 4 semitones up.')
    expect(stepLeapWords(5, true)).toBe(
      'A leap: 5 semitones up, a perfect fourth.',
    )
    expect(stepLeapWords(7, true)).toBe(
      'A leap: 7 semitones up, a perfect fifth.',
    )
  })
})

describe('Name it', () => {
  it('plays each of 1, 2, 5 and 7 twice, never the same twice running, steps down and leaps up', () => {
    for (const seed of SEEDS) {
      // Act
      const rounds = dealNameIt(mulberry32(seed))

      // Assert
      expect(rounds).toHaveLength(8)
      const moves = rounds.map((r) => r.events[1].midi - r.events[0].midi)
      expect([...moves].sort((x, y) => x - y)).toEqual([
        -2, -2, -1, -1, 5, 5, 7, 7,
      ])
      rounds.forEach((r, i) => {
        if (i > 0) expect(r.answer).not.toBe(rounds[i - 1].answer)
        expect(r.events[0].midi).toBeGreaterThanOrEqual(FIRST_LO)
        expect(r.events[0].midi).toBeLessThanOrEqual(FIRST_HI)
      })
    }
  })

  it('finds an order with no repeat even from a generator that always says the same', () => {
    // Act: a degenerate generator shuffles to the same order every try
    const order = nameItOrder(() => 0)

    // Assert
    expect(order).toHaveLength(8)
    order.forEach((a, i) => {
      if (i > 0) expect(a).not.toBe(order[i - 1])
    })
  })

  it('names each interval by its anchor, in its direction', () => {
    expect(Object.values(NAME_IT_WORDS)).toEqual([
      'A perfect fifth, up: “twin-kle, twin-kle”.',
      'A perfect fourth, up: “Should auld”.',
      'A tone, down: “lit-tle star”.',
      'A semitone, down: “I won-der”.',
    ])
  })
})

describe("the games' lines", () => {
  it('pass the claims check, and name the sound, never the listener', () => {
    const lines = [
      ...[1, 2, 3, 4, 5, 7].flatMap((s) => [
        stepLeapWords(s, true),
        stepLeapWords(s, false),
      ]),
      ...Object.values(NAME_IT_WORDS),
    ]
    for (const line of lines) {
      const result = validateGuidedDynamicClaim({
        surface: 'finding',
        text: line,
      })
      expect(result.violations, line).toEqual([])
      expect(line).not.toMatch(/\byou\b/i)
    }
  })
})
