// ============================================================
// Lesson 12 music tests — the chords, the rooms, the loop and the two tunes
// ============================================================
//
// WEB-SPEC, Tests 1 to 4. The numerals are held against the app's own,
// `romanOf` (its `ROMAN` table is not exported), so the page and Ear Lab's
// Cadence cannot drift apart (FACTS 18).

import { describe, expect, it } from 'vitest'
import { signName } from '@/features/lessons/kit/notes'
import { romanOf } from '@/lib/ear/progressions'
import type { KeyName } from './music'
import { chordsOf, KEY, loopOf, numeralOf, qualityOf, roomOf, rootLine, TUNE_IDS, tuneOf, } from './music'

const letters = (name: KeyName): string[] =>
  chordsOf(name).map((c) =>
    c.spelled.map((s) => signName(s, { octave: false })).join(' '),
  )

const pc = (m: number): number => ((m % 12) + 12) % 12

const endOf = (notes: readonly { t: number; dur: number }[]): number =>
  Math.max(...notes.map((n) => n.t + n.dur))

describe('the chords (Tests 1)', () => {
  it("builds C major's seven from its scale, a third and a fifth above each degree", () => {
    // Act
    const chords = chordsOf('C')

    // Assert: FACTS 13 and 16
    expect(letters('C')).toEqual([
      'C E G',
      'D F A',
      'E G B',
      'F A C',
      'G B D',
      'A C E',
      'B D F',
    ])
    expect(chords.map((c) => c.gaps)).toEqual([
      [4, 3],
      [3, 4],
      [3, 4],
      [4, 3],
      [4, 3],
      [3, 4],
      [3, 3],
    ])
    expect(chords.map((c) => c.fifth)).toEqual([7, 7, 7, 7, 7, 7, 6])
  })

  it('makes three major, three minor and one diminished, and none augmented', () => {
    // Act
    const qualities = chordsOf('C').map((c) => c.quality)

    // Assert: FACTS 15 and 16
    expect(qualities).toEqual([
      'major',
      'minor',
      'minor',
      'major',
      'major',
      'minor',
      'diminished',
    ])
    expect(qualities).not.toContain('augmented')
  })

  it("names them I, ii, iii, IV, V, vi and vii°, the app's own numerals", () => {
    // Assert: FACTS 17 and 18
    expect(chordsOf('C').map((c) => c.numeral)).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map(romanOf),
    )
  })

  it("sounds each chip from the key's own octave: C4 up to B4 in C, G3 up to F sharp 4 in G", () => {
    // Act
    const c = chordsOf('C').map((ch) => ch.midis)
    const g = chordsOf('G').map((ch) => ch.midis)

    // Assert: FACTS 69
    expect([c[0], c[6]]).toEqual([
      [60, 64, 67],
      [71, 74, 77],
    ])
    expect([g[0], g[6]]).toEqual([
      [55, 59, 62],
      [66, 69, 72],
    ])
  })

  it('keeps the numerals and the qualities in G major, spelled G B D to F sharp A C, with no flat', () => {
    // Act
    const g = chordsOf('G')

    // Assert: FACTS 19
    expect(letters('G')).toEqual([
      'G B D',
      'A C E',
      'B D F♯',
      'C E G',
      'D F♯ A',
      'E G B',
      'F♯ A C',
    ])
    expect(g.map((c) => c.numeral)).toEqual(chordsOf('C').map((c) => c.numeral))
    expect(g.map((c) => c.quality)).toEqual(chordsOf('C').map((c) => c.quality))
    expect(g.flatMap((c) => c.spelled).every((s) => s.alter >= 0)).toBe(true)
  })

  it('reads 4 and 4 as augmented, upper case with a plus', () => {
    // Act
    const quality = qualityOf([4, 4])

    // Assert: FACTS 15 and 17, the four words' C, E, G sharp
    expect(quality).toBe('augmented')
    expect(numeralOf(2, quality)).toBe('III+')
  })
})

describe('the rooms (Tests 2)', () => {
  it('goes round a major room by 4, 3 and 5, a minor by 3, 4 and 5, the diminished by 3, 3 and 6', () => {
    // Act
    const sides = chordsOf('C').map((c) => [c.quality, roomOf(c).sides])

    // Assert: FACTS 22
    expect(sides).toEqual([
      ['major', [4, 3, 5]],
      ['minor', [3, 4, 5]],
      ['minor', [3, 4, 5]],
      ['major', [4, 3, 5]],
      ['major', [4, 3, 5]],
      ['minor', [3, 4, 5]],
      ['diminished', [3, 3, 6]],
    ])
  })

  it("turns C major's rooms seven semitones round the ring for G major, each keeping its shape", () => {
    // Act
    const c = chordsOf('C').map(roomOf)
    const g = chordsOf('G').map(roomOf)

    // Assert: FACTS 19 and 22
    expect(g.map((r) => r.corners)).toEqual(
      c.map((r) => r.corners.map((x) => (x + 7) % 12)),
    )
    expect(g.map((r) => r.sides)).toEqual(c.map((r) => r.sides))
  })

  it('lets I and vi share C and E, and moves G two semitones round to A', () => {
    // Act
    const [one, six] = [0, 5].map((d) => roomOf(chordsOf('C')[d]).corners)

    // Assert: FACTS 21
    expect(one.filter((x) => six.includes(x))).toEqual([0, 4])
    expect(one.filter((x) => !six.includes(x))).toEqual([7])
    expect(six.filter((x) => !one.includes(x))).toEqual([9])
  })

  it('puts every corner of every room in C on a note of C major, never a black key', () => {
    // Act
    const corners = chordsOf('C').flatMap((c) => roomOf(c).corners)

    // Assert: FACTS 14, Step 1's Notice
    expect(new Set(corners)).toEqual(new Set(KEY.C.pitchClasses))
  })
})

describe('the loop (Tests 3)', () => {
  it('is C, G, A minor and F in C major, built on do, so, la and fa', () => {
    // Act
    const loop = loopOf('C')

    // Assert: FACTS 26
    expect(
      loop.map((c) => [
        c.numeral,
        signName(c.spelled[0], { octave: false }),
        c.quality,
      ]),
    ).toEqual([
      ['I', 'C', 'major'],
      ['V', 'G', 'major'],
      ['vi', 'A', 'minor'],
      ['IV', 'F', 'major'],
    ])
    expect(loop.map((c) => c.degree)).toEqual([0, 4, 5, 3])
  })

  it('voices them C4 E4 G4, G3 B3 D4, A3 C4 E4 and F3 A3 C4', () => {
    // Assert: FACTS 34
    expect(loopOf('C').map((c) => c.midis)).toEqual([
      [60, 64, 67],
      [55, 59, 62],
      [57, 60, 64],
      [53, 57, 60],
    ])
  })

  it('holds all seven notes of C major between its four chords', () => {
    // Act
    const notes = new Set(loopOf('C').flatMap((c) => c.midis.map(pc)))

    // Assert: FACTS 27
    expect(notes).toEqual(new Set(KEY.C.pitchClasses))
  })

  it('moves every note up one or two semitones from V to vi', () => {
    // Act
    const [, five, six] = loopOf('C')
    const moves = six.midis.map((m, i) => m - five.midis[i])

    // Assert: FACTS 27
    expect(moves).toEqual([2, 1, 2])
  })

  it('gives the roots alone as C4, G3, A3 and F3, then C4 again, by a fourth down, a tone up, a third down and a fifth up', () => {
    // Act
    const line = rootLine('C')

    // Assert: FACTS 26 and 59
    expect(line).toEqual([60, 55, 57, 53, 60])
    expect(line.slice(1).map((m, i) => m - line[i])).toEqual([-5, 2, -4, 7])
  })

  it('sits five semitones lower in G: G3 B3 D4, D3 F sharp 3 A3, E3 G3 B3, C3 E3 G3', () => {
    // Act
    const g = loopOf('G').map((c) => c.midis)

    // Assert: FACTS 69a
    expect(g).toEqual([
      [55, 59, 62],
      [50, 54, 57],
      [52, 55, 59],
      [48, 52, 55],
    ])
    expect(rootLine('G')).toEqual(rootLine('C').map((m) => m - 5))
  })
})

describe('the tunes (Tests 4)', () => {
  it('lands tune 1 on a corner with 11 of its 15 notes: D5 over I, C5 over V, B4 over vi and G4 over IV fall between', () => {
    // Act
    const tune = tuneOf('tune-1', 'C')

    // Assert: FACTS 35
    expect(tune.map((n) => n.midi)).toEqual([
      76, 74, 72, 76, 74, 72, 71, 74, 72, 71, 69, 72, 69, 67, 65,
    ])
    expect(tune.filter((n) => n.corner)).toHaveLength(11)
    expect(tune.filter((n) => !n.corner).map((n) => [n.midi, n.bar])).toEqual([
      [74, 0],
      [72, 1],
      [71, 2],
      [67, 3],
    ])
  })

  it('lands tune 2 on a corner with 10 of its 12 notes: C5 over V and D5 over IV fall between', () => {
    // Act
    const tune = tuneOf('tune-2', 'C')

    // Assert: FACTS 36
    expect(tune.map((n) => n.midi)).toEqual([
      67, 72, 76, 72, 71, 67, 69, 72, 76, 77, 74, 72,
    ])
    expect(tune.filter((n) => n.corner)).toHaveLength(10)
    expect(tune.filter((n) => !n.corner).map((n) => [n.midi, n.bar])).toEqual([
      [72, 1],
      [74, 3],
    ])
  })

  it('times tune 1 in crotchets with a closing minim, and tune 2 long-short-long in every bar', () => {
    // Act
    const one = tuneOf('tune-1', 'C').map((n) => n.dur)
    const two = tuneOf('tune-2', 'C').map((n) => n.dur)

    // Assert: FACTS 35 and 36, WEB-SPEC Toys 5
    expect(one).toEqual([...Array<number>(14).fill(0.5), 1])
    expect(two).toEqual([
      0.75, 0.25, 1, 0.75, 0.25, 1, 0.75, 0.25, 1, 0.75, 0.25, 1,
    ])
  })

  it("plays tune 2's notes at 0.667 s each for Even notes, over the same chords, still 10 of 12 on a corner", () => {
    // Act
    const even = tuneOf('even', 'C')
    const two = tuneOf('tune-2', 'C')

    // Assert: FACTS 37
    expect(even.map((n) => n.midi)).toEqual(two.map((n) => n.midi))
    expect(even.map((n) => n.bar)).toEqual(two.map((n) => n.bar))
    for (const n of even) expect(n.dur).toBeCloseTo(0.667, 3)
    expect(even.filter((n) => n.corner)).toHaveLength(10)
  })

  it("lasts 8.0 s for every tune, the loop's four bars", () => {
    for (const id of TUNE_IDS) {
      // Act
      const end = endOf(tuneOf(id, 'C'))

      // Assert: FACTS 37 and 68
      expect(end, id).toBeCloseTo(8, 9)
    }
  })

  it('runs tune 1 from F4 to E5 and tune 2 from G4 to F5', () => {
    // Act
    const span = (id: 'tune-1' | 'tune-2'): number[] => {
      const m = tuneOf(id, 'C').map((n) => n.midi)
      return [Math.min(...m), Math.max(...m)]
    }

    // Assert: FACTS 34 to 36
    expect(span('tune-1')).toEqual([65, 76])
    expect(span('tune-2')).toEqual([67, 77])
  })

  it("puts every sung note above the chord under it but tune 2's first, G4, in unison with I's top", () => {
    // Arrange
    const loop = loopOf('C')

    for (const id of TUNE_IDS) {
      // Act
      const notAbove = tuneOf(id, 'C').filter(
        (n) => n.midi <= Math.max(...loop[n.bar].midis),
      )

      // Assert: FACTS 34
      expect(
        notAbove.map((n) => [n.t, n.midi]),
        id,
      ).toEqual(id === 'tune-1' ? [] : [[0, 67]])
    }
  })

  it('sits five semitones lower in G, every note on the same chord and the same corner', () => {
    for (const id of TUNE_IDS) {
      // Act
      const c = tuneOf(id, 'C')
      const g = tuneOf(id, 'G')

      // Assert: FACTS 69a, the tunes C4 to C5
      expect(g, id).toEqual(c.map((n) => ({ ...n, midi: n.midi - 5 })))
    }
    expect(Math.min(...tuneOf('tune-1', 'G').map((n) => n.midi))).toBe(60)
    expect(Math.max(...tuneOf('tune-2', 'G').map((n) => n.midi))).toBe(72)
  })
})
