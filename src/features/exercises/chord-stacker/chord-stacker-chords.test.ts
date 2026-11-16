// ============================================================
// Chord Stacker's chords: spellings, inversions, names and a run's deal
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ChordStackerChord } from './chord-stacker-chords'
import { CHORD_SETS, CHORD_STACKER_CHORDS, chordMask, chordName, chordNotes, chordSetFor, chordsInWords, chordsOfMask, chordStackerRecord, dealChordRounds, } from './chord-stacker-chords'

/** A seeded generator, so a deal can be read again (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const C4 = 60

describe('the chords Chord Stacker plays', () => {
  it.each<[ChordStackerChord, number[]]>([
    ['major', [60, 64, 67]],
    ['minor', [60, 63, 67]],
    ['diminished', [60, 63, 66]],
    ['augmented', [60, 64, 68]],
    ['maj7', [60, 64, 67, 71]],
    ['min7', [60, 63, 67, 70]],
    ['dom7', [60, 64, 67, 70]],
    ['dim7', [60, 63, 66, 69]],
    ['maj6', [60, 64, 67, 69]],
  ])('spells %s on C4 as %j in root position', (chord, notes) => {
    expect(chordNotes(C4, chord)).toEqual(notes)
  })

  it('turns a triad over by taking its lowest note up an octave, twice at most', () => {
    // C major: C E G, then E G C, then G C E.
    expect([0, 1, 2].map((p) => chordNotes(C4, 'major', p))).toEqual([
      [60, 64, 67],
      [64, 67, 72],
      [67, 72, 76],
    ])
    // A triad has no third inversion: a fourth turn would be root
    // position an octave up, which the drill never asks for.
    expect(chordNotes(C4, 'major', 3)).toEqual([67, 72, 76])
  })

  it('gives a seventh chord a third inversion, its seventh in the bass', () => {
    // G7 on G3: G B D F, and with F at the bottom, F G B D.
    expect(chordNotes(55, 'dom7', 3)).toEqual([65, 67, 71, 74])
  })

  it('keeps the same notes in every position, only their order and octave move', () => {
    for (const chord of CHORD_STACKER_CHORDS) {
      const rootPosition = chordNotes(C4, chord)
        .map((n) => n % 12)
        .sort()
      for (let p = 1; p < chordNotes(C4, chord).length; p++) {
        const turned = chordNotes(C4, chord, p)
        expect(turned.map((n) => n % 12).sort()).toEqual(rootPosition)
        // Sung bottom to top: each note above the last.
        expect([...turned].sort((a, b) => a - b)).toEqual(turned)
      }
    }
  })
})

describe('what a round calls its chord', () => {
  it('names the root, the quality and the position plainly', () => {
    expect(chordName(C4, 'major', 1)).toBe('C major, first inversion')
    expect(chordName(55, 'dom7', 3)).toBe('G dominant seventh, third inversion')
    expect(chordName(C4, 'min7', 0)).toBe('C minor seventh, root position')
  })

  it('leaves the position unsaid while a run plays root position only', () => {
    expect(chordName(61, 'augmented', null)).toBe('C# augmented')
    expect(chordName(57, 'maj6', null)).toBe('A major sixth')
  })
})

describe('the chords a run deals from, in words', () => {
  it('names a whole set by its name', () => {
    expect(chordsInWords(CHORD_SETS.triads)).toBe('Triads')
    expect(chordsInWords(CHORD_SETS.sevenths)).toBe('Seventh chords')
    expect(chordsInWords(CHORD_SETS.both)).toBe('Triads and seventh chords')
  })

  it("names a launch's own few by theirs, in the picker's order", () => {
    expect(chordsInWords(['minor', 'major'])).toBe('Major and minor triads')
    expect(chordsInWords(['dom7'])).toBe('Dominant seventh')
    expect(chordsInWords(['dom7', 'major', 'maj7'])).toBe(
      'Major, major seventh and dominant seventh',
    )
  })

  it('lights the chip whose set covers them', () => {
    expect(chordSetFor(['major', 'minor'])).toBe('triads')
    expect(chordSetFor(['dom7'])).toBe('sevenths')
    expect(chordSetFor(['major', 'dom7'])).toBe('both')
  })
})

describe("a run's deal", () => {
  it('plays each of the five sevenths once, in root position, as runs always have', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rounds = dealChordRounds(
        CHORD_SETS.sevenths,
        false,
        5,
        seeded(seed),
      )

      expect(rounds.map((r) => r.chord).sort()).toEqual(
        [...CHORD_SETS.sevenths].sort(),
      )
      expect(rounds.every((r) => r.position === 0)).toBe(true)
    }
  })

  it('plays every triad before any comes again, and never one twice running', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const chords = dealChordRounds(
        CHORD_SETS.triads,
        false,
        5,
        seeded(seed),
      ).map((r) => r.chord)

      expect(new Set(chords.slice(0, 4)).size).toBe(4)
      chords.slice(1).forEach((chord, i) => expect(chord).not.toBe(chords[i]))
    }
  })

  it('meets every position of one chord with inversions, root position among them', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rounds = dealChordRounds(['dom7'], true, 5, seeded(seed))

      expect(rounds).toHaveLength(5)
      expect(rounds.every((r) => r.chord === 'dom7')).toBe(true)
      expect(
        rounds
          .slice(0, 4)
          .map((r) => r.position)
          .sort(),
      ).toEqual([0, 1, 2, 3])
    }
  })

  it('turns no chord past its own last inversion', () => {
    const rounds = dealChordRounds(CHORD_SETS.both, true, 200, seeded(7))
    for (const { chord, position } of rounds) {
      expect(position).toBeLessThan(chordNotes(C4, chord).length)
    }
  })

  it('deals nothing from no chords', () => {
    expect(dealChordRounds([], false)).toEqual([])
  })
})

describe('the record a run belongs to', () => {
  it('carries its chords through a number and back', () => {
    const sets: readonly (readonly ChordStackerChord[])[] = [
      CHORD_SETS.triads,
      CHORD_SETS.sevenths,
      ['dom7'],
    ]
    for (const set of sets) {
      expect(chordsOfMask(chordMask(set))).toEqual(
        CHORD_STACKER_CHORDS.filter((c) => set.includes(c)),
      )
    }
  })

  it('keeps the five sevenths in root position on the record every earlier run is on', () => {
    expect(chordStackerRecord(CHORD_SETS.sevenths, false)).toEqual({
      key: '',
      words: '',
    })
  })

  it('keys every other choice apart, and says it in words', () => {
    expect(chordStackerRecord(CHORD_SETS.triads, false)).toEqual({
      key: 'triads',
      words: 'Triads',
    })
    expect(chordStackerRecord(CHORD_SETS.sevenths, true)).toEqual({
      key: 'sevenths-inversions',
      words: 'Seventh chords, with inversions',
    })
    expect(chordStackerRecord(CHORD_SETS.both, false).key).toBe('both')
    expect(chordStackerRecord(['minor', 'major'], false).key).toBe(
      'major+minor',
    )
    expect(chordStackerRecord(['dom7'], true)).toEqual({
      key: 'dom7-inversions',
      words: 'Dominant seventh, with inversions',
    })
  })
})
