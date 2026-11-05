// ============================================================
// Staff places tests — where every note sits, its ledger lines and its words
// ============================================================
//
// Lesson 15's WEB-SPEC, Tests 1 to 3: the treble and bass clefs' lines and
// spaces, the clefs' own lines, the ledger lines out to two each way, the
// grand staff's 21 white keys, a sign on its letter's place, and the clef
// each voice reads (FACTS 12 to 24, 30, 44).

import { describe, expect, it } from 'vitest'
import type { Spelled } from './notes'
import { signName } from './notes'
import type { StaffKind } from './staff-places'
import { BOTTOM, CLEF_NOTE, clefForVoice, clefPlace, diatonicOf, GRAND_WHITE_KEYS, isLine, ledgerCount, ledgersOf, midiOf, noteAt, placeOf, placeRange, placeWords, sayPlace, spelledAt, staffName, writtenOf, } from './staff-places'

/** A note from its name: "G4", "F♯4", "B♭4". */
function n(name: string): Spelled {
  const m = /^([A-G])([♯♭]?)(\d)$/.exec(name)
  if (m === null) throw new Error(name)
  return {
    letter: m[1] as Spelled['letter'],
    alter: m[2] === '♯' ? 1 : m[2] === '♭' ? -1 : 0,
    octave: Number(m[3]),
  }
}

/** The names of the notes at `places` on `staff`. */
const namesAt = (places: readonly number[], staff: StaffKind): string[] =>
  places.map((p) => signName(noteAt(p, staff)))

describe('a place on the staff', () => {
  it("reads the treble staff's lines E, G, B, D, F and its spaces F, A, C, E", () => {
    // Assert: FACTS 14
    expect(namesAt([0, 2, 4, 6, 8], 'treble')).toEqual([
      'E4',
      'G4',
      'B4',
      'D5',
      'F5',
    ])
    expect(namesAt([1, 3, 5, 7], 'treble')).toEqual(['F4', 'A4', 'C5', 'E5'])
    for (const p of [0, 2, 4, 6, 8]) expect(isLine(p)).toBe(true)
    for (const p of [1, 3, 5, 7]) expect(isLine(p)).toBe(false)
  })

  it("reads the bass staff's lines G, B, D, F, A and its spaces A, C, E, G", () => {
    // Assert: FACTS 16
    expect(namesAt([0, 2, 4, 6, 8], 'bass')).toEqual([
      'G2',
      'B2',
      'D3',
      'F3',
      'A3',
    ])
    expect(namesAt([1, 3, 5, 7], 'bass')).toEqual(['A2', 'C3', 'E3', 'G3'])
  })

  it("puts G4 on the treble staff's second line and F3 on the bass staff's fourth", () => {
    // Assert: FACTS 13, 15
    expect(placeOf(CLEF_NOTE.treble, 'treble')).toBe(2)
    expect(clefPlace('treble', 'treble')).toBe(2)
    expect(placeOf(CLEF_NOTE.bass, 'bass')).toBe(6)
    expect(clefPlace('bass', 'bass')).toBe(6)
    expect(clefPlace('treble', 'grand')).toBe(14)
    expect(clefPlace('bass', 'grand')).toBe(6)
  })

  it('counts a place in letters, so a step of one letter is one place whatever its size in sound', () => {
    // Assert: FACTS 12, 22: E to F a semitone and F to G a tone, both one place
    expect(placeOf(n('F4'), 'treble') - placeOf(n('E4'), 'treble')).toBe(1)
    expect(placeOf(n('G4'), 'treble') - placeOf(n('F4'), 'treble')).toBe(1)
    expect(midiOf(n('F4')) - midiOf(n('E4'))).toBe(1)
    expect(midiOf(n('G4')) - midiOf(n('F4'))).toBe(2)
    expect(midiOf(n('C5')) - midiOf(n('B4'))).toBe(1)
    expect(midiOf(n('D5')) - midiOf(n('C5'))).toBe(2)
  })

  it("writes F♯4 on F4's place and B♭4 on B4's, each a semitone from its letter", () => {
    // Assert: FACTS 23
    expect(placeOf(n('F♯4'), 'treble')).toBe(placeOf(n('F4'), 'treble'))
    expect(placeOf(n('B♭4'), 'treble')).toBe(placeOf(n('B4'), 'treble'))
    expect([midiOf(n('F♯4')), midiOf(n('B♭4'))]).toEqual([66, 70])
  })

  it('names a black key by its sharp, as the app does', () => {
    // Assert: FACTS 10, 24
    expect(signName(writtenOf(61))).toBe('C♯4')
    expect(signName(writtenOf(70))).toBe('A♯4')
    expect(signName(writtenOf(60))).toBe('C4')
  })

  it('goes round letter steps and notes, both ways', () => {
    // Assert
    expect(diatonicOf(n('E4'))).toBe(BOTTOM.treble)
    expect(diatonicOf(n('G2'))).toBe(BOTTOM.bass)
    expect(signName(spelledAt(30))).toBe('E4')
    expect(signName(spelledAt(27))).toBe('B3')
    for (let m = 21; m <= 108; m++) expect(midiOf(writtenOf(m))).toBe(m)
  })
})

describe('ledger lines', () => {
  it('give middle C one below the treble staff and one above the bass', () => {
    // Assert: FACTS 18, 20
    expect(ledgersOf(placeOf(n('C4'), 'treble'), 'treble')).toEqual([-2])
    expect(ledgersOf(placeOf(n('C4'), 'bass'), 'bass')).toEqual([10])
  })

  it('give A3 two below the treble staff, C6 two above, D4 and G5 none', () => {
    // Assert: FACTS 18
    expect(ledgerCount(placeOf(n('A3'), 'treble'), 'treble')).toBe(2)
    expect(ledgerCount(placeOf(n('B3'), 'treble'), 'treble')).toBe(1)
    expect(ledgerCount(placeOf(n('C6'), 'treble'), 'treble')).toBe(2)
    expect(ledgerCount(placeOf(n('A5'), 'treble'), 'treble')).toBe(1)
    expect(ledgerCount(placeOf(n('D4'), 'treble'), 'treble')).toBe(0)
    expect(ledgerCount(placeOf(n('G5'), 'treble'), 'treble')).toBe(0)
  })

  it('give E2 one below the bass staff and E4 two above it', () => {
    // Assert: WEB-SPEC, Tests 1
    expect(ledgerCount(placeOf(n('E2'), 'bass'), 'bass')).toBe(1)
    expect(ledgerCount(placeOf(n('E4'), 'bass'), 'bass')).toBe(2)
  })

  it('put B3 in the space above the bass staff and D4 just over its ledger line', () => {
    // Assert: FACTS 16, 55
    expect(placeOf(n('B3'), 'bass')).toBe(9)
    expect(ledgerCount(9, 'bass')).toBe(0)
    expect(placeOf(n('D4'), 'bass')).toBe(11)
    expect(ledgersOf(11, 'bass')).toEqual([10])
  })

  it("put F3 on the treble staff's third ledger line below and G2 on its sixth", () => {
    // Assert: FACTS 16, 30
    expect(ledgerCount(placeOf(n('F3'), 'treble'), 'treble')).toBe(3)
    expect(ledgerCount(placeOf(n('G2'), 'treble'), 'treble')).toBe(6)
  })

  it('are drawn only as far as the note, nearest first', () => {
    // Assert: FACTS 18
    expect(ledgersOf(-4, 'treble')).toEqual([-2, -4])
    expect(ledgersOf(-3, 'treble')).toEqual([-2])
    expect(ledgersOf(12, 'treble')).toEqual([10, 12])
    expect(ledgersOf(5, 'treble')).toEqual([])
  })

  it("give the grand staff middle C's line alone between the staves", () => {
    // Assert: FACTS 21
    expect(ledgersOf(10, 'grand')).toEqual([10])
    expect(ledgersOf(9, 'grand')).toEqual([])
    expect(ledgersOf(11, 'grand')).toEqual([])
    for (let p = 0; p <= 20; p++)
      expect(ledgerCount(p, 'grand'), `place ${p}`).toBe(p === 10 ? 1 : 0)
  })
})

describe("the toy's range", () => {
  it('reaches two ledger lines each way: A3 to C6 on the treble staff, C2 to E4 on the bass', () => {
    // Assert: FACTS 19, 60a
    const [lo, hi] = placeRange('treble')
    expect(namesAt([lo, hi], 'treble')).toEqual(['A3', 'C6'])
    expect(namesAt(placeRange('bass'), 'bass')).toEqual(['C2', 'E4'])
    expect(namesAt(placeRange('grand'), 'grand')).toEqual(['G2', 'F5'])
  })

  it("writes the grand staff's 21 white keys, G2 to F5", () => {
    // Assert: FACTS 21
    expect(GRAND_WHITE_KEYS).toHaveLength(21)
    expect([GRAND_WHITE_KEYS[0], GRAND_WHITE_KEYS[20]]).toEqual([43, 77])
    expect(GRAND_WHITE_KEYS.map((m) => placeOf(writtenOf(m), 'grand'))).toEqual(
      Array.from({ length: 21 }, (_, i) => i),
    )
  })
})

describe('a voice and its clef', () => {
  it('gives the lower voice the bass clef and the higher the treble', () => {
    // Assert: FACTS 8, 51
    expect(clefForVoice('lower')).toBe('bass')
    expect(clefForVoice('higher')).toBe('treble')
  })

  it("keeps the lower sing-along's do on the bass staff and its last three above it, the higher's on the treble staff", () => {
    // Arrange: do, re, mi, fa, so in G (FACTS 55)
    const lower = ['G3', 'A3', 'B3', 'C4', 'D4'].map(n)
    const higher = ['G4', 'A4', 'B4', 'C5', 'D5'].map(n)

    // Act
    const low = lower.map((s) => placeOf(s, 'bass'))
    const high = higher.map((s) => placeOf(s, 'treble'))

    // Assert
    expect(low).toEqual([7, 8, 9, 10, 11])
    expect(high).toEqual([2, 3, 4, 5, 6])
    expect(high.map((p) => ledgerCount(p, 'treble'))).toEqual([0, 0, 0, 0, 0])
  })
})

describe('a place in words', () => {
  it('says each place on a staff with its letter and octave', () => {
    // Assert: WEB-SPEC, Toys 1, taps and keys
    expect(sayPlace(n('G4'), 'treble')).toBe('G4, the second line')
    expect(sayPlace(n('A4'), 'treble')).toBe('A4, the second space')
    expect(sayPlace(n('C4'), 'treble')).toBe('C4, one ledger line below')
    expect(sayPlace(n('B3'), 'treble')).toBe('B3, below one ledger line')
    expect(sayPlace(n('A3'), 'treble')).toBe('A3, two ledger lines below')
    expect(sayPlace(n('D4'), 'treble')).toBe('D4, just below the bottom line')
    expect(sayPlace(n('G5'), 'treble')).toBe('G5, just above the top line')
    expect(sayPlace(n('C6'), 'treble')).toBe('C6, two ledger lines above')
    expect(sayPlace(n('F3'), 'bass')).toBe('F3, the fourth line')
  })

  it('says every sign as a word', () => {
    // Assert: Lesson 2's contract (kit/notes.ts `wordName`)
    expect(sayPlace(n('F♯4'), 'treble')).toBe('F sharp 4, the bottom space')
    expect(sayPlace(n('B♭4'), 'treble')).toBe('B flat 4, the middle line')
  })

  it("names the grand staff's two staves, and middle C's line between them", () => {
    // Assert
    expect(placeWords(0, 'grand')).toBe('the bottom line of the bass staff')
    expect(placeWords(9, 'grand')).toBe(
      'just above the top line of the bass staff',
    )
    expect(placeWords(10, 'grand')).toBe(
      "middle C's ledger line, between the staves",
    )
    expect(placeWords(11, 'grand')).toBe(
      'just below the bottom line of the treble staff',
    )
    expect(placeWords(14, 'grand')).toBe('the second line of the treble staff')
    expect(placeWords(10, 'grand', 'treble')).toBe(
      'one ledger line below the treble staff',
    )
    expect(placeWords(10, 'grand', 'bass')).toBe(
      'one ledger line above the bass staff',
    )
  })

  it('names each staff for its group', () => {
    expect(staffName('treble')).toBe('Treble staff, five lines and four spaces')
    expect(staffName('bass')).toBe('Bass staff, five lines and four spaces')
    expect(staffName('grand')).toMatch(
      /^Grand staff: a treble staff above a bass staff/,
    )
  })
})
