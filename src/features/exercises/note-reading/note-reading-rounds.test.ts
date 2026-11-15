import { describe, expect, it } from 'vitest'
import { answerIsRight, NOTE_READING_ROUNDS, placeOfRound, planRounds, readingScore, spanFor, spanLabel, } from './note-reading-rounds'

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

describe("a level's span on the staff", () => {
  it('keeps to the staff up to the level every singer starts on', () => {
    for (const level of [1, 3, 5]) {
      expect(spanFor(level)).toEqual({ lowest: 0, highest: 8 })
    }
  })

  it('adds one ledger line each way, then two', () => {
    expect(spanFor(6)).toEqual({ lowest: -2, highest: 10 })
    expect(spanFor(7)).toEqual({ lowest: -2, highest: 10 })
    expect(spanFor(8)).toEqual({ lowest: -4, highest: 12 })
    expect(spanFor(10)).toEqual({ lowest: -4, highest: 12 })
  })

  it("says each span in the setup screen's words", () => {
    expect(spanLabel(spanFor(5))).toBe('lines and spaces')
    expect(spanLabel(spanFor(6))).toBe('up to one ledger line')
    expect(spanLabel(spanFor(9))).toBe('up to two ledger lines')
  })
})

describe('the notes of a run', () => {
  it("asks for ten notes, each inside the level's span on the chosen staff", () => {
    const rounds = planRounds({
      clef: 'treble',
      difficulty: 5,
      random: seeded(1),
    })
    expect(rounds).toHaveLength(NOTE_READING_ROUNDS)
    for (const round of rounds) {
      expect(round.clef).toBe('treble')
      expect(round.place).toBeGreaterThanOrEqual(0)
      expect(round.place).toBeLessThanOrEqual(8)
    }
  })

  it('writes the note that sits at each place of each clef', () => {
    // Seventeen notes at the top level is the whole of one staff, once each.
    const names = new Map<string, string>()
    for (const clef of ['treble', 'bass'] as const) {
      const rounds = planRounds({
        clef,
        difficulty: 10,
        rounds: 17,
        random: seeded(2),
      })
      expect(new Set(rounds.map((r) => r.place)).size).toBe(17)
      for (const r of rounds) {
        names.set(`${clef}:${r.place}`, `${r.note.letter}${r.note.octave}`)
      }
    }
    expect(names.get('treble:0')).toBe('E4')
    expect(names.get('treble:8')).toBe('F5')
    expect(names.get('treble:-2')).toBe('C4')
    expect(names.get('treble:12')).toBe('C6')
    expect(names.get('bass:0')).toBe('G2')
    expect(names.get('bass:8')).toBe('A3')
    expect(names.get('bass:10')).toBe('C4')
    expect(names.get('bass:-4')).toBe('C2')
  })

  it('covers the staff before it repeats a place', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const rounds = planRounds({
        clef: 'treble',
        difficulty: 5,
        random: seeded(seed),
      })
      const firstNine = new Set(rounds.slice(0, 9).map((r) => r.place))
      expect(firstNine.size).toBe(9)
    }
  })

  it('never asks for the same note twice running', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rounds = planRounds({
        clef: seed % 2 === 0 ? 'treble' : 'both',
        difficulty: 5,
        rounds: 40,
        random: seeded(seed),
      })
      for (let i = 1; i < rounds.length; i++) {
        const same =
          rounds[i].clef === rounds[i - 1].clef &&
          rounds[i].place === rounds[i - 1].place
        expect(same, `seed ${seed}, note ${i}`).toBe(false)
      }
    }
  })

  it('draws from both staves when both are asked for', () => {
    const rounds = planRounds({
      clef: 'both',
      difficulty: 5,
      rounds: 18,
      random: seeded(7),
    })
    const clefs = new Set(rounds.map((r) => r.clef))
    expect(clefs).toEqual(new Set(['treble', 'bass']))
  })
})

describe('an answer', () => {
  const [round] = planRounds({
    clef: 'treble',
    difficulty: 5,
    rounds: 1,
    random: () => 0,
  })

  it("is right on the note's letter, whatever its octave", () => {
    expect(answerIsRight(round, round.note.letter)).toBe(true)
    const other = round.note.letter === 'C' ? 'D' : 'C'
    expect(answerIsRight(round, other)).toBe(false)
  })

  it('has words for where the note sits that never name it', () => {
    const words = planRounds({
      clef: 'treble',
      difficulty: 10,
      rounds: 17,
      random: seeded(3),
    }).map((r) => ({ place: r.place, words: placeOfRound(r) }))
    const of = (place: number) => words.find((w) => w.place === place)?.words
    expect(of(0)).toBe('the bottom line')
    expect(of(4)).toBe('the middle line')
    expect(of(7)).toBe('the top space')
    expect(of(-2)).toBe('one ledger line below')
    expect(of(-1)).toBe('just below the bottom line')
    expect(of(12)).toBe('two ledger lines above')
    for (const w of words) expect(w.words).not.toMatch(/\b[A-G]\d?\b/)
  })
})

describe('the score', () => {
  it('is the share read right, to the nearest whole number', () => {
    expect(readingScore(10, 10)).toBe(100)
    expect(readingScore(7, 10)).toBe(70)
    expect(readingScore(2, 3)).toBe(67)
    expect(readingScore(0, 10)).toBe(0)
  })

  it('is nothing for a run with no note answered', () => {
    expect(readingScore(0, 0)).toBe(0)
  })
})
