// ============================================================
// Lesson 10 game round tests — what Major or minor? deals from a fixed seed
// ============================================================
//
// The deal half of WEB-SPEC, Tests 7 (FACTS 21, 43, 70a, 78): eight rounds
// on thirds and ten on chords, each answer half of them; roots from C4 to
// G4 and every note from C4 to D5; a thirds round is its root and the note
// 3 or 4 semitones above, 0.6 s and 0.8 s, 0.15 s apart; a chords round is
// its scale's first five notes at 0.32 s, 0.25 s of silence and its triad
// for 1.2 s; and every round's line is WEB-SPEC Toys 5's, starts with no
// "Yes", names no listener and passes the guided-voice claims check as a
// finding, with the kit's own opening before it too.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/features/lessons/kit/dom'
import type { EarRound } from '@/features/lessons/kit/ear-game'
import { slowerBy } from '@/features/lessons/kit/ear-game'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { Quality } from './chords'
import { CHORD_WORDS, chordRoundNotes, CHORDS_ROUNDS, dealChords, dealThirds, halfEach, MISS_SLOWER, ROOT_HI, ROOT_LO, THIRD_WORDS, thirdRoundNotes, THIRDS_ROUNDS, } from './game-rounds'

const SEEDS = [1, 2, 3, 42, 20261024, 987654321]

/** The spec, its lines joined, so a quoted line can be found across a wrap. */
const SPEC = readFileSync(
  resolve(
    process.cwd(),
    'docs/plans/find-your-pitch/lessons/10-major-minor/WEB-SPEC.md',
  ),
  'utf8',
).replace(/\s+/g, ' ')

const midis = (r: EarRound<Quality>): number[] => r.events.map((e) => e.midi)
const fixed = (xs: readonly number[]): string[] => xs.map((x) => x.toFixed(9))
const count = (rounds: readonly EarRound<Quality>[], a: Quality): number =>
  rounds.filter((r) => r.answer === a).length

describe('Major or minor? on thirds', () => {
  it('deals eight rounds, four major and four minor, from every seed', () => {
    for (const seed of SEEDS) {
      // Act
      const rounds = dealThirds(mulberry32(seed))

      // Assert
      expect(rounds).toHaveLength(THIRDS_ROUNDS)
      expect(THIRDS_ROUNDS).toBe(8)
      expect([count(rounds, 'major'), count(rounds, 'minor')]).toEqual([4, 4])
    }
  })

  it('plays a root from C4 to G4, then the note 4 semitones above for major and 3 for minor', () => {
    for (const seed of SEEDS)
      for (const r of dealThirds(mulberry32(seed))) {
        // Act
        const [root, top] = midis(r)

        // Assert: FACTS 78
        expect(root).toBeGreaterThanOrEqual(ROOT_LO)
        expect(root).toBeLessThanOrEqual(ROOT_HI)
        expect(top - root).toBe(r.answer === 'major' ? 4 : 3)
        expect(r.events).toEqual(thirdRoundNotes(root, r.answer))
      }
  })

  it('plays its two notes 0.6 s and 0.8 s long, 0.15 s apart', () => {
    // Act
    const notes = thirdRoundNotes(60, 'minor')

    // Assert: FACTS 78
    expect(notes).toEqual([
      { midi: 60, at: 0, dur: 0.6 },
      { midi: 63, at: 0.75, dur: 0.8 },
    ])
  })
})

describe('Major or minor? on chords', () => {
  it('deals ten rounds, five major and five minor, from every seed', () => {
    for (const seed of SEEDS) {
      // Act
      const rounds = dealChords(mulberry32(seed))

      // Assert
      expect(rounds).toHaveLength(CHORDS_ROUNDS)
      expect(CHORDS_ROUNDS).toBe(10)
      expect([count(rounds, 'major'), count(rounds, 'minor')]).toEqual([5, 5])
    }
  })

  it("plays the scale's first five notes, then the triad whose third the answer names", () => {
    for (const seed of SEEDS)
      for (const r of dealChords(mulberry32(seed))) {
        // Act
        const notes = midis(r)
        const root = notes[0]

        // Assert: FACTS 21 and 43, the syllabus's chord test
        const steps = notes.map((m) => m - root)
        expect(steps).toEqual(
          r.answer === 'major'
            ? [0, 2, 4, 5, 7, 0, 4, 7]
            : [0, 2, 3, 5, 7, 0, 3, 7],
        )
        expect(root).toBeGreaterThanOrEqual(ROOT_LO)
        expect(root).toBeLessThanOrEqual(ROOT_HI)
      }
  })

  it('plays the five at 0.32 s each, then 0.25 s of silence, then the triad together for 1.2 s', () => {
    // Act
    const notes = chordRoundNotes(67, 'major')

    // Assert: FACTS 78
    expect(fixed(notes.map((e) => e.at))).toEqual(
      fixed([0, 0.32, 0.64, 0.96, 1.28, 1.85, 1.85, 1.85]),
    )
    expect(fixed(notes.map((e) => e.dur))).toEqual(
      fixed([0.32, 0.32, 0.32, 0.32, 0.32, 1.2, 1.2, 1.2]),
    )
    expect(notes.map((e) => e.midi)).toEqual([67, 69, 71, 72, 74, 67, 71, 74])
  })
})

describe('both games', () => {
  it('keep every note between C4 and D5', () => {
    // Arrange
    const rounds = SEEDS.flatMap((seed) => [
      ...dealThirds(mulberry32(seed)),
      ...dealChords(mulberry32(seed)),
    ])

    // Act
    const notes = rounds.flatMap(midis)

    // Assert: FACTS 70a, G4's so at the top
    expect(Math.min(...notes)).toBeGreaterThanOrEqual(60)
    expect(Math.max(...notes)).toBeLessThanOrEqual(74)
    expect(
      Math.max(...chordRoundNotes(ROOT_HI, 'minor').map((e) => e.midi)),
    ).toBe(74)
  })

  it('deal the same game from the same seed, and new games from new ones', () => {
    // Act
    const again = dealChords(mulberry32(42))
    const games = SEEDS.map((seed) =>
      JSON.stringify(dealChords(mulberry32(seed))),
    )

    // Assert
    expect(again).toEqual(dealChords(mulberry32(42)))
    expect(new Set(games).size).toBe(SEEDS.length)
  })

  it('shuffle the answers from seed to seed, and move the root from round to round', () => {
    for (const deal of [dealThirds, dealChords]) {
      // Act
      const games = SEEDS.map((seed) => deal(mulberry32(seed)))
      const orders = games.map((g) => g.map((r) => r.answer).join(' '))
      const roots = games.map((g) => new Set(g.map((r) => midis(r)[0])).size)

      // Assert: the halves are shuffled, never dealt in one fixed order, and
      // each round draws its own root
      expect(new Set(orders).size).toBeGreaterThan(1)
      expect(roots.every((n) => n > 1)).toBe(true)
    }
  })

  it('shuffle each answer into half the rounds, even from a generator that always says the same', () => {
    // Act
    const stuck = halfEach(() => 0, 10)
    const high = halfEach(() => 0.999, 8)

    // Assert
    expect(stuck.filter((a) => a === 'major')).toHaveLength(5)
    expect(high.filter((a) => a === 'minor')).toHaveLength(4)
  })

  it("play a missed round again at 1.5 times its lengths, through the kit's slower replay", () => {
    // Act
    const replay = slowerBy(thirdRoundNotes(60, 'major'), MISS_SLOWER)

    // Assert: FACTS 78, as Lesson 6's games replay a missed pair
    expect(MISS_SLOWER).toBe(1.5)
    expect(fixed(replay.map((e) => e.at))).toEqual(fixed([0, 1.125]))
    expect(fixed(replay.map((e) => e.dur))).toEqual(fixed([0.9, 1.2]))
  })
})

describe("the games' lines", () => {
  const LINES = [...Object.values(THIRD_WORDS), ...Object.values(CHORD_WORDS)]

  it("give each round its answer's line, word for word as WEB-SPEC Toys 5 has it", () => {
    // Act
    const rounds = SEEDS.flatMap((seed) => [
      ...dealThirds(mulberry32(seed)).map((r) => [r, THIRD_WORDS] as const),
      ...dealChords(mulberry32(seed)).map((r) => [r, CHORD_WORDS] as const),
    ])

    // Assert
    for (const [r, words] of rounds) expect(r.words).toBe(words[r.answer])
    for (const line of LINES) expect(SPEC, line).toContain(`"${line}"`)
  })

  it('start with no "Yes", name no listener and pass the claims check, with the kit’s opening too', () => {
    for (const line of LINES)
      for (const said of [
        line,
        `Yes. ${line}`,
        `Here it is again, slower. ${line}`,
      ]) {
        // Act
        const result = validateGuidedDynamicClaim({
          surface: 'finding',
          text: said,
        })

        // Assert
        expect(result.violations, said).toEqual([])
        expect(line).not.toMatch(/^yes\b/i)
        expect(line).not.toMatch(/\byou\b/i)
      }
  })
})
