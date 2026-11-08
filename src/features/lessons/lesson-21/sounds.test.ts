// ============================================================
// Lesson 21 sounds tests — the scales, the keys' octaves, the white keys and Find do's rounds
// ============================================================
//
// What the steps play and write (FACTS 13, 26, 60 to 63; WEB-SPEC, Toys 1
// to 4): every scale spelled one letter a degree, within two ledger lines
// of its staff in each clef; the white keys from G and F; a key's scale
// under the signature it shares with the key before, its new signs ringed;
// F major spelled with A sharp; Find do's six rounds in order, with their
// lines; and the answer, do, mi and so from the house.

import { describe, expect, it } from 'vitest'
import { PARTS, seatsOf } from '@/features/lessons/kit/circle-geometry'
import { signName } from '@/features/lessons/kit/notes'
import { midiOf } from '@/features/lessons/kit/staff-places'
import { answerOf, doOf, keyRun, note, PACE, ROUNDS, runLength, runOf, scaleOf, sharedKey, STEP1_DO, whiteKeysOf, withASharp, } from './sounds'

const names = (
  notes: readonly { letter: string; alter: number; octave: number }[],
): string =>
  notes
    .map((n) =>
      signName({ letter: n.letter as 'C', alter: n.alter, octave: n.octave }),
    )
    .join(' ')

/** Each clef's range, two ledger lines each way (FACTS 63, 64). */
const RANGE = {
  bass: [midiOf(note('F2')), midiOf(note('E♭4'))],
  treble: [midiOf(note('B♭3')), midiOf(note('A5'))],
} as const

describe('the scales', () => {
  it('plays at a note every 0.4 s, each 0.35 s long, 3.15 s a scale, and the circle at 0.3 s and 0.27 s, 2.37 s', () => {
    // Act
    const step = runOf(scaleOf(note('G2')), PACE.step)
    const circle = runOf(scaleOf(note('C3')), PACE.circle)

    // Assert: FACTS 61 and 63
    expect(runLength(step)).toBeCloseTo(3.15, 6)
    expect(runLength(circle)).toBeCloseTo(2.37, 6)
    expect(step.map((n) => n.t)).toEqual([0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8])
  })

  it('starts Step 1 on G2 for the lower voice and G4 for the higher, G major with F sharp', () => {
    // Assert
    expect(names(scaleOf(STEP1_DO.bass))).toBe('G2 A2 B2 C3 D3 E3 F♯3 G3')
    expect(names(scaleOf(STEP1_DO.treble))).toBe('G4 A4 B4 C5 D5 E5 F♯5 G5')
  })

  it('keeps every key the house can reach within two ledger lines of its staff, in each clef', () => {
    for (const clef of ['bass', 'treble'] as const) {
      for (const seat of seatsOf(PARTS.all)) {
        // Act
        const midis = scaleOf(doOf(seat, clef)).map(midiOf)

        // Assert
        expect(Math.min(...midis)).toBeGreaterThanOrEqual(RANGE[clef][0])
        expect(Math.max(...midis)).toBeLessThanOrEqual(RANGE[clef][1])
      }
    }
  })

  it('plays Step 2 on C3, G2, D3 and A2 for the lower voice and C4, G4, D4 and A4 for the higher', () => {
    // Assert: FACTS 63
    expect([0, 1, 2, 3].map((s) => signName(doOf(s, 'bass')))).toEqual([
      'C3',
      'G2',
      'D3',
      'A2',
    ])
    expect([0, 1, 2, 3].map((s) => signName(doOf(s, 'treble')))).toEqual([
      'C4',
      'G4',
      'D4',
      'A4',
    ])
    expect([11, 10, 9].map((s) => signName(doOf(s, 'bass')))).toEqual([
      'F2',
      'B♭2',
      'E♭3',
    ])
    expect([11, 10, 9].map((s) => signName(doOf(s, 'treble')))).toEqual([
      'F4',
      'B♭3',
      'E♭4',
    ])
  })

  it('plays the white keys from G and from F, a semitone and a tone the wrong way round', () => {
    // Assert: FACTS 13
    expect(names(whiteKeysOf(note('G2')))).toBe('G2 A2 B2 C3 D3 E3 F3 G3')
    expect(names(whiteKeysOf(note('F4')))).toBe('F4 G4 A4 B4 C5 D5 E5 F5')
  })

  it('spells F major with A sharp as two notes on A and none on B, the same sounds', () => {
    // Arrange
    const fMajor = scaleOf(note('F4'))

    // Act
    const sharp = withASharp(fMajor)

    // Assert
    expect(names(sharp)).toBe('F4 G4 A4 A♯4 C5 D5 E5 F5')
    expect(sharp.map(midiOf)).toEqual(fMajor.map(midiOf))
  })
})

describe('a key as the house reaches it', () => {
  it("plays under the signature the two keys share, rings the notes whose sign joins, and takes the key's own at the end", () => {
    // Act: from G major to D major
    const run = keyRun(
      scaleOf(note('D3')),
      { sign: 'sharp', count: 1 },
      { sign: 'sharp', count: 2 },
      PACE.circle,
    )

    // Assert: F sharp is in the signature; C sharp joins it
    expect(run.under).toEqual({ sign: 'sharp', count: 1 })
    expect(run.after).toEqual({ sign: 'sharp', count: 2 })
    expect(
      run.notes.filter((n) => n.outline === true).map((n) => signName(n.note)),
    ).toEqual(['C♯4'])
  })

  it('plays a key of the other kind under no signature, every sign ringed', () => {
    // Act: from A major to E flat major, in free play
    const run = keyRun(
      scaleOf(note('E♭3')),
      { sign: 'sharp', count: 3 },
      { sign: 'flat', count: 3 },
      PACE.circle,
    )

    // Assert
    expect(run.under).toBeNull()
    expect(run.notes.filter((n) => n.outline === true)).toHaveLength(4)
    expect(
      sharedKey({ sign: 'flat', count: 2 }, { sign: 'flat', count: 1 }),
    ).toEqual({ sign: 'flat', count: 1 })
    expect(sharedKey(null, { sign: 'flat', count: 1 })).toBeNull()
  })

  it('rings nothing as the house goes back to a key with fewer signs, which drop at the start', () => {
    // Act: from D major back to G major
    const run = keyRun(
      scaleOf(note('G2')),
      { sign: 'sharp', count: 2 },
      { sign: 'sharp', count: 1 },
      PACE.circle,
    )

    // Assert
    expect(run.under).toEqual({ sign: 'sharp', count: 1 })
    expect(run.notes.some((n) => n.outline === true)).toBe(false)
  })
})

describe("Find do's rounds", () => {
  it('runs one, two and three sharps, then one, two and three flats', () => {
    // Assert: FACTS 26
    expect(ROUNDS.map((r) => `${r.key.count}${r.key.sign} ${r.do}`)).toEqual([
      '1sharp G',
      '2sharp D',
      '3sharp A',
      '1flat F',
      '2flat B',
      '3flat E',
    ])
  })

  it('answers a right tap with do, mi and so from the house, 0.5 s each, onsets 0.6 s apart', () => {
    // Act: B flat major, from the middle line of the treble staff
    const notes = answerOf(note('B♭4'))

    // Assert: FACTS 63
    expect(notes.map((n) => signName(n.note))).toEqual(['B♭4', 'D5', 'F5'])
    expect(notes.map((n) => n.t)).toEqual([0, 0.6, 1.2])
    expect(notes.every((n) => n.dur === 0.5)).toBe(true)
    expect(notes[0].home).toBe(true)
  })
})
