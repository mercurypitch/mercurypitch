// ============================================================
// Lesson 27 sounds tests — every chord, play and Turn over at FACTS 72 to 74's pitches and levels
// ============================================================
//
// The WEB-SPEC's Tests 1, 7 and 19: I and V stacked in C major, with and
// without their sevenths, and their thirds; root to seventh 11 for I and 10
// for V; the pair six semitones apart that V7 holds and V and V with F
// sharp do not; every play's notes for each voice, the higher at FACTS
// 72's and the lower an octave down; three-note chords at 0.075 a voice,
// four-note at 0.056, Step 3's two notes at 0.13; the hero the same for
// both voices; and Turn over's every press, which comes back to the first
// pitches and never sounds a note outside G2 to G5.

import { describe, expect, it } from 'vitest'
import type { Spelled } from '@/features/lessons/kit/notes'
import { signName } from '@/features/lessons/kit/notes'
import { CHORD_GAIN, CHORD4_GAIN, NOTE_GAIN, } from '@/features/lessons/kit/sound'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { ChordId, Figure, PlayId } from './sounds'
import { CHECK_CHORD, CHECK_SEC, CHORDS, climbOf, cornersOf, gainOf, heroPlay, lengthOf, playOf, positionsIn, rootToSeventh, } from './sounds'

/** Notes as written, with their octaves: "G3 B3 D4". */
const names = (notes: readonly Spelled[]): string =>
  notes.map((n) => signName(n)).join(' ')

/** A play's figures as written, each with its onset and length. */
const heard = (figures: readonly Figure[]): string[] =>
  figures.map((f) => `${f.at}+${f.dur}: ${names(f.notes)}`)

const CLEFS: readonly Clef[] = ['treble', 'bass']

describe('the chords', () => {
  it('stacks I and V in C major, with and without their sevenths, in thirds (FACTS 15, 16)', () => {
    // Assert
    expect(names(CHORDS.I.notes)).toBe('C4 E4 G4')
    expect(names(CHORDS.I7.notes)).toBe('C4 E4 G4 B4')
    expect(names(CHORDS.V.notes)).toBe('G3 B3 D4')
    expect(names(CHORDS.V7.notes)).toBe('G3 B3 D4 F4')
    // each note a third above the one before: 3 or 4 semitones
    for (const id of ['I', 'I7', 'V', 'V7'] as const) {
      const m = CHORDS[id].notes.map(midiOf)
      m.slice(1).forEach((n, i) => expect([3, 4]).toContain(n - m[i]))
    }
  })

  it('measures root to seventh as 11 for I and 10 for V, and none for a triad (FACTS 13)', () => {
    // Assert
    expect(rootToSeventh(CHORDS.I7)).toBe(11)
    expect(rootToSeventh(CHORDS.V7)).toBe(10)
    expect(rootToSeventh(CHORDS.I)).toBeNull()
  })

  it('finds a pair six semitones apart in V7, B and F, and none in V or in V with F sharp (FACTS 23)', () => {
    // Arrange
    const sixApart = (id: ChordId): string[] => {
      const pcs = cornersOf(CHORDS[id])
      const out: string[] = []
      pcs.forEach((a, i) =>
        pcs.slice(i + 1).forEach((b) => {
          if ((((b - a) % 12) + 12) % 12 === 6) out.push(`${a}-${b}`)
        }),
      )
      return out
    }

    // Assert: B is 11 and F is 5
    expect(sixApart('V7')).toEqual(['11-5'])
    expect(sixApart('V')).toEqual([])
    expect(sixApart('V+F#')).toEqual([])
    // B up to F sharp is a fifth, 7
    expect(midiOf(CHORDS['V+F#'].notes[3]) - midiOf(CHORDS.V.notes[1])).toBe(7)
  })

  it('puts each room’s corners in ring order from its root, whatever octave its notes sound in (FACTS 30, 31)', () => {
    // Assert
    expect(cornersOf(CHORDS.V7)).toEqual([7, 11, 2, 5])
    expect(cornersOf(CHORDS.I7)).toEqual([0, 4, 7, 11])
    // every position keeps the room: its notes' places on the ring
    for (const clef of CLEFS)
      for (const id of ['I', 'I7', 'V', 'V7'] as const)
        for (const p of positionsIn(CHORDS[id], clef))
          expect(new Set(p.map((n) => midiOf(n) % 12))).toEqual(
            new Set(cornersOf(CHORDS[id])),
          )
  })
})

describe('the levels', () => {
  it('plays three notes at 0.075 a voice, four at 0.056 and two or one at 0.13 (FACTS 73)', () => {
    // Assert
    expect(gainOf(3)).toBe(CHORD_GAIN)
    expect(CHORD_GAIN).toBe(0.075)
    expect(gainOf(4)).toBe(CHORD4_GAIN)
    expect(CHORD4_GAIN).toBe(0.056)
    expect(gainOf(2)).toBe(NOTE_GAIN)
    expect(gainOf(1)).toBe(0.13)
    // a seventh adds a note, not loudness
    expect(4 * CHORD4_GAIN).toBeLessThan(3 * CHORD_GAIN)
  })
})

describe('the plays', () => {
  it('plays each step’s chords for the higher voice at FACTS 72’s pitches (FACTS 42 to 44, 48)', () => {
    // Arrange
    const plays: Readonly<Record<PlayId, string[]>> = {
      'i-seventh': ['0+1.2: C4 E4 G4', '1.2+1.2: C4 E4 G4 B4'],
      'v-seventh': ['0+1.2: G3 B3 D4', '1.2+1.2: G3 B3 D4 F4'],
      sevenths: ['0+1.5: C4 E4 G4 B4', '1.5+1.5: G3 B3 D4 F4'],
      'dom-home': ['0+1.5: G3 B3 D4 F4', '1.5+1.5: C4 E4 G4'],
      tritone: ['0+1.5: B3 F4', '1.5+1.5: C4 E4'],
      'v7-home': ['0+1.5: G3 B3 D4 F4', '1.5+1.5: C4 E4 G4'],
      turn: ['0+1.2: C4 E4 G4', '1.2+1.2: E4 G4 C5'],
      eminor: ['0+1.2: E4 G4 C5', '1.2+1.2: E4 G4 B4'],
    }

    // Assert
    for (const [id, want] of Object.entries(plays))
      expect(heard(playOf(id as PlayId, 'treble')), id).toEqual(want)
    expect(lengthOf(playOf('turn', 'treble'))).toBe(2.4)
    expect(lengthOf(playOf('sevenths', 'treble'))).toBe(3)
  })

  it('plays every step’s chords an octave lower for the lower voice, G2 its lowest (FACTS 72, 74)', () => {
    // Assert
    const ids: PlayId[] = [
      'i-seventh',
      'v-seventh',
      'sevenths',
      'dom-home',
      'tritone',
      'v7-home',
      'turn',
      'eminor',
    ]
    for (const id of ids) {
      const hi = playOf(id, 'treble').flatMap((f) => f.notes.map(midiOf))
      const lo = playOf(id, 'bass').flatMap((f) => f.notes.map(midiOf))
      expect(lo).toEqual(hi.map((m) => m - 12))
    }
    expect(heard(playOf('v-seventh', 'bass'))[0]).toBe('0+1.2: G2 B2 D3')
  })

  it('climbs C up an octave in Step 4’s first play, and turns no note in its second', () => {
    // Act
    const [, turned] = playOf('turn', 'treble')
    const [, minor] = playOf('eminor', 'treble')

    // Assert
    expect(turned.climb && names([turned.climb.from, turned.climb.to])).toBe(
      'C4 C5',
    )
    expect(minor.climb).toBeUndefined()
    // the arrows as I sounds after V7, and as C and E sound after B and F
    expect(playOf('v7-home', 'treble').map((f) => f.arrows === true)).toEqual([
      false,
      true,
    ])
    expect(playOf('tritone', 'treble').map((f) => f.arrows === true)).toEqual([
      false,
      true,
    ])
  })

  it('plays the hero’s chords in Merc’s register for everyone, 1.5 s each (FACTS 32, 37, 74)', () => {
    // Assert
    expect(heard(heroPlay('vi'))).toEqual([
      '0+1.5: G3 B3 D4',
      '1.5+1.5: C4 E4 G4',
    ])
    expect(heard(heroPlay('f'))[0]).toBe('0+1.5: G3 B3 D4 F4')
    expect(heard(heroPlay('fsharp'))[0]).toBe('0+1.5: G3 B3 D4 F♯4')
    expect(heard(heroPlay('fsharp'))[1]).toBe('1.5+1.5: C4 E4 G4')
    // quick check 4: G3, B3, D4 and F4, 1.5 s
    expect(CHECK_CHORD).toEqual([55, 59, 62, 65])
    expect(CHECK_SEC).toBe(1.5)
  })
})

describe('Turn over', () => {
  it('gives each chord’s positions in each voice as FACTS 50 and 72 have them', () => {
    // Assert
    const of = (id: ChordId, clef: Clef): string[] =>
      positionsIn(CHORDS[id], clef).map(names)
    expect(of('I', 'treble')).toEqual(['C4 E4 G4', 'E4 G4 C5', 'G4 C5 E5'])
    expect(of('V7', 'treble')).toEqual([
      'G3 B3 D4 F4',
      'B3 D4 F4 G4',
      'D4 F4 G4 B4',
      'F4 G4 B4 D5',
    ])
    expect(of('V', 'treble')).toEqual(['G3 B3 D4', 'B3 D4 G4', 'D4 G4 B4'])
    expect(of('I7', 'treble')).toEqual([
      'C4 E4 G4 B4',
      'E4 G4 B4 C5',
      'G4 B4 C5 E5',
      'B4 C5 E5 G5',
    ])
    expect(of('V7', 'bass')[0]).toBe('G2 B2 D3 F3')
    expect(of('I7', 'bass')[3]).toBe('B3 C4 E4 G4')
  })

  it('never sounds a note outside G2 to G5, however many presses (FACTS 50, 72)', () => {
    // Arrange
    const all = new Set<number>()

    // Act: every chord's positions, in both voices
    for (const clef of CLEFS)
      for (const id of ['I', 'I7', 'V', 'V7'] as const)
        for (const p of positionsIn(CHORDS[id], clef))
          p.forEach((n) => all.add(midiOf(n)))

    // Assert
    expect(Math.min(...all)).toBe(43)
    expect(Math.max(...all)).toBe(79)
  })

  it('climbs the lowest note an octave as a chord turns over', () => {
    // Act
    const climb = climbOf(positionsIn(CHORDS.V7, 'treble')[0])

    // Assert: G3 up to G4
    expect(names([climb.from, climb.to])).toBe('G3 G4')
  })
})
