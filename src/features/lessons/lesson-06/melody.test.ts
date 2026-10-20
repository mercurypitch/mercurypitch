// ============================================================
// Lesson 6 melody tests — the score, the moves, the sizes and the spelling
// ============================================================
//
// WEB-SPEC, Tests 1 to 4 and 10: "Twinkle" and "Auld Lang Syne" as their
// scores have them (FACTS 20, 25); a slide keeps every gap (FACTS 17, 36);
// the swapped version keeps every up and down and five notes, and changes
// two sizes (FACTS 37); same, step and leap (FACTS 14); the interval names
// against the textbook's table and Leap's own labels (FACTS 11, 13); and
// every start spelled as Lesson 4 spells its key (FACTS 24, 38).

import { describe, expect, it } from 'vitest'
import { isBlack, signName, wordName } from '@/features/lessons/kit/notes'
import { LEAP_BANK } from '@/lib/ear/banks'
import { AULD, C4, classify, FS4, gapsOf, intervalName, lineMidis, lineNames, START_HI, START_LO, swapSizes, transpose, tuneMidis, TWINKLE, TWINKLE_GAPS, } from './melody'

const STARTS = Array.from(
  { length: START_HI - START_LO + 1 },
  (_, i) => START_LO + i,
)

const pitchClass = (m: number): number => ((m % 12) + 12) % 12

describe('the melody data', () => {
  it("is 'Twinkle, Twinkle' as the published score has it: fourteen notes, a minim at each line's end", () => {
    // Assert: C4 C4 G4 G4 A4 A4 G4, F4 F4 E4 E4 D4 D4 C4 (FACTS 20)
    expect(tuneMidis(C4)).toEqual([
      60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60,
    ])
    expect(TWINKLE.map((line) => line.map((n) => n.beats))).toEqual([
      [1, 1, 1, 1, 1, 1, 2],
      [1, 1, 1, 1, 1, 1, 2],
    ])
    expect(TWINKLE.flat().map((n) => n.syllable)).toEqual([
      'twin',
      'kle',
      'twin',
      'kle',
      'lit',
      'tle',
      'star',
      'How',
      'I',
      'won',
      'der',
      'what',
      'you',
      'are',
    ])
  })

  it("is 'Should auld ac-quain-tance be for-got' as its score has it, 'Should' to 'auld' a fourth up", () => {
    // Assert: C4 F4 F4 F4 A4 G4 F4 G4, crotchets, dotted crotchets and quavers (FACTS 25)
    expect(AULD.map((n) => n.midi)).toEqual([60, 65, 65, 65, 69, 67, 65, 67])
    expect(AULD.map((n) => n.beats)).toEqual([1, 1.5, 0.5, 1, 1, 1.5, 0.5, 1])
    expect(AULD[1].midi - AULD[0].midi).toBe(5)
  })

  it('makes thirteen moves: one leap, six steps and six repeated notes', () => {
    // Assert: FACTS 22 and 23
    expect(TWINKLE_GAPS).toEqual([0, 7, 0, 2, 0, -2, -2, 0, -1, 0, -2, 0, -2])
    const kinds = TWINKLE_GAPS.map(classify)
    expect(kinds.filter((k) => k === 'leap')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'step')).toHaveLength(6)
    expect(kinds.filter((k) => k === 'same')).toHaveLength(6)
  })
})

describe('transpose', () => {
  it('keeps every gap of the first line from every start, C4 to B4', () => {
    for (const start of STARTS) {
      // Act
      const line = transpose(lineMidis(TWINKLE[0], C4), start - C4)

      // Assert
      expect(gapsOf(line), `from ${start}`).toEqual([0, 7, 0, 2, 0, -2])
      expect(line).toEqual(lineMidis(TWINKLE[0], start))
    }
  })

  it('from F♯4 changes every note: no name shared with the line from C, every one a black key', () => {
    // Act
    const fromC = lineMidis(TWINKLE[0], C4)
    const fromFs = transpose(fromC, FS4 - C4)

    // Assert: FACTS 36
    expect(fromFs).toEqual([66, 66, 73, 73, 75, 75, 73])
    const shared = fromFs.filter((m) =>
      fromC.some((c) => pitchClass(c) === pitchClass(m)),
    )
    expect(shared).toEqual([])
    expect(fromFs.every(isBlack)).toBe(true)
  })
})

describe('swapSizes', () => {
  it('from C plays C4 C4 D4 D4 A4 A4 G4, the two rises swapped', () => {
    // Assert: FACTS 37
    const swapped = swapSizes(lineMidis(TWINKLE[0], C4))
    expect(swapped).toEqual([60, 60, 62, 62, 69, 69, 67])
    expect(gapsOf(swapped)).toEqual([0, 2, 0, 7, 0, -2])
  })

  it('keeps every up and down and notes 1, 2, 5, 6 and 7, and changes exactly two gaps, from every start', () => {
    for (const start of STARTS) {
      // Arrange
      const line = lineMidis(TWINKLE[0], start)

      // Act
      const swapped = swapSizes(line)

      // Assert
      const before = gapsOf(line)
      const after = gapsOf(swapped)
      expect(after.map(Math.sign), `from ${start}`).toEqual(
        before.map(Math.sign),
      )
      expect(after.filter((g, i) => g !== before[i])).toHaveLength(2)
      for (const i of [0, 1, 4, 5, 6]) expect(swapped[i]).toBe(line[i])
    }
  })
})

describe('classify', () => {
  it('calls 0 the same note, 1 and 2 steps, and 3, 4, 5 and 7 leaps, either way', () => {
    // Assert: FACTS 14
    expect(classify(0)).toBe('same')
    for (const s of [1, 2, -1, -2]) expect(classify(s)).toBe('step')
    for (const s of [3, 4, 5, 7, -3, -4, -5, -7])
      expect(classify(s)).toBe('leap')
  })
})

describe('intervalName', () => {
  it('names 1 to 12 semitones as the textbook table does', () => {
    // Assert: Hutchinson § 5.2's table (FACTS 11)
    const labels = Array.from(
      { length: 12 },
      (_, i) => intervalName(i + 1)?.label,
    )
    expect(labels).toEqual([
      'm2',
      'M2',
      'm3',
      'M3',
      'P4',
      'TT',
      'P5',
      'm6',
      'M6',
      'm7',
      'M7',
      'P8',
    ])
    expect(intervalName(7)?.name).toBe('perfect fifth')
    expect(intervalName(-5)?.name).toBe('perfect fourth')
    expect(intervalName(0)).toBeNull()
    expect(intervalName(13)).toBeNull()
  })

  it("gives this lesson's five intervals Leap's own labels and sizes", () => {
    // Assert: src/lib/ear/banks.ts, imported (FACTS 13)
    for (const label of ['m2', 'M2', 'P4', 'P5', 'P8']) {
      const item = LEAP_BANK.find((x) => x.label === label)
      expect(item, label).toBeDefined()
      const semitones = item?.payload[0] ?? 0
      expect(intervalName(semitones)?.label).toBe(label)
    }
  })
})

/** Lesson 6 WEB-SPEC, Toys 1's table, which follows Lesson 4's spelling of each key. */
const TABLE: Readonly<Record<number, readonly [string, string]>> = {
  60: ['C C G G A A G', 'F F E E D D C'],
  61: ['D♭ D♭ A♭ A♭ B♭ B♭ A♭', 'G♭ G♭ F F E♭ E♭ D♭'],
  62: ['D D A A B B A', 'G G F♯ F♯ E E D'],
  63: ['E♭ E♭ B♭ B♭ C C B♭', 'A♭ A♭ G G F F E♭'],
  64: ['E E B B C♯ C♯ B', 'A A G♯ G♯ F♯ F♯ E'],
  65: ['F F C C D D C', 'B♭ B♭ A A G G F'],
  66: ['F♯ F♯ C♯ C♯ D♯ D♯ C♯', 'B B A♯ A♯ G♯ G♯ F♯'],
  67: ['G G D D E E D', 'C C B B A A G'],
  68: ['A♭ A♭ E♭ E♭ F F E♭', 'D♭ D♭ C C B♭ B♭ A♭'],
  69: ['A A E E F♯ F♯ E', 'D D C♯ C♯ B B A'],
  70: ['B♭ B♭ F F G G F', 'E♭ E♭ D D C C B♭'],
  71: ['B B F♯ F♯ G♯ G♯ F♯', 'E E D♯ D♯ C♯ C♯ B'],
}

describe('lineNames', () => {
  const names = (start: number, line: number): string =>
    lineNames(TWINKLE[line], start)
      .map((s) => signName(s, { octave: false }))
      .join(' ')

  it("spells every start as Lesson 4 spells its key, the table's names line for line", () => {
    for (const start of STARTS) {
      expect([names(start, 0), names(start, 1)], `from ${start}`).toEqual(
        TABLE[start],
      )
    }
  })

  it('gives each scale degree one letter, the same degree always the same, six on six letters', () => {
    for (const start of STARTS) {
      const byDegree = new Map<number, Set<string>>()
      for (const line of TWINKLE)
        lineNames(line, start).forEach((s, i) => {
          const letters = byDegree.get(line[i].degree) ?? new Set<string>()
          letters.add(s.letter)
          byDegree.set(line[i].degree, letters)
        })
      const letters = [...byDegree.values()]
      expect(
        letters.map((l) => l.size),
        `from ${start}`,
      ).toEqual([1, 1, 1, 1, 1, 1])
      expect(new Set(letters.flatMap((l) => [...l])).size).toBe(6)
    }
  })

  it("never writes E♯, B♯, C♭ or F♭, nor a double sign; F major's fa is B♭", () => {
    for (const start of STARTS) {
      for (const line of TWINKLE) {
        for (const s of lineNames(line, start)) {
          const name = signName(s, { octave: false })
          expect(['E♯', 'B♯', 'C♭', 'F♭']).not.toContain(name)
          expect(Math.abs(s.alter)).toBeLessThan(2)
        }
      }
    }
    expect(signName(lineNames(TWINKLE[1], 65)[0])).toBe('B♭4')
  })

  it('reads a flat as a word: from B♭4 the line starts "B flat 4"', () => {
    expect(wordName(lineNames(TWINKLE[0], 70)[0])).toBe('B flat 4')
  })
})
