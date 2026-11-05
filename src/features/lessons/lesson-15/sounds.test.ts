// ============================================================
// Lesson 15 sounds tests — each example's notes, as written, and its length
// ============================================================
//
// The plays LESSON.md's examples give (FACTS 62 to 68): the climb, and each
// step's plays, with their notes written as the staff shows them and their
// lengths in seconds; and the state the staff toy opens each step in.

import { describe, expect, it } from 'vitest'
import { signName } from '@/features/lessons/kit/notes'
import { midiOf, placeOf } from '@/features/lessons/kit/staff-places'
import { CLIMB, evenly, LEDGER_END, note, playLength, STEP_PLAYS, STEP_STATE, } from './sounds'

const names = (id: string): string[] =>
  STEP_PLAYS[id].notes.map((n) => signName(n.note))

describe('the climb', () => {
  it('climbs the treble staff from E4 to F5, 0.5 s notes with onsets 0.6 s apart, 5.3 s', () => {
    // Act
    const notes = evenly(CLIMB, 0.5, 0.6)

    // Assert: FACTS 62
    expect(notes.map((n) => placeOf(n.note, 'treble'))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ])
    expect(playLength({ show: 'run', notes })).toBeCloseTo(5.3, 5)
  })
})

describe("the steps' plays", () => {
  it("Step 1's G4 sounds for a second and lights the treble clef's line", () => {
    // Assert: FACTS 64
    const [g] = STEP_PLAYS.g4.notes
    expect([signName(g.note), g.dur, g.gold]).toEqual(['G4', 1, 'treble'])
  })

  it("Step 2's plays: three letters up twice, 1.7 s each, then a letter and its sign, 1.8 s", () => {
    // Assert: FACTS 65
    expect(names('efg')).toEqual(['E4', 'F4', 'G4'])
    expect(names('bcd')).toEqual(['B4', 'C5', 'D5'])
    expect(names('f-sharp')).toEqual(['F4', 'F♯4'])
    expect(names('b-flat')).toEqual(['B4', 'B♭4'])
    expect(playLength(STEP_PLAYS.efg)).toBeCloseTo(1.7, 5)
    expect(playLength(STEP_PLAYS['f-sharp'])).toBeCloseTo(1.8, 5)
    // each sign on its letter's place, a semitone from it
    for (const id of ['f-sharp', 'b-flat']) {
      const [a, b] = STEP_PLAYS[id].notes
      expect(placeOf(a.note, 'treble')).toBe(placeOf(b.note, 'treble'))
      expect(Math.abs(midiOf(a.note) - midiOf(b.note))).toBe(1)
    }
  })

  it("Step 3's plays jump through two ledger lines each way, 2.0 s", () => {
    // Assert: FACTS 66
    expect(names('above')).toEqual(['G5', 'A5', 'C6'])
    expect(names('below')).toEqual(['D4', 'C4', 'A3'])
    expect(playLength(STEP_PLAYS.above)).toBeCloseTo(2, 5)
    expect(STEP_PLAYS.above.show).toBe('cursor')
  })

  it("Step 4's plays open on the bass clef: Merc's F3, and G2 up past the top line to D4, 7.1 s", () => {
    // Assert: FACTS 67
    const merc = STEP_PLAYS['merc-f']
    expect([merc.clef, merc.kind, names('merc-f'), merc.notes[0].dur]).toEqual([
      'bass',
      'merc',
      ['F3'],
      1.5,
    ])
    expect(merc.notes[0]).toMatchObject({ tone: 'blue', gold: 'bass' })
    expect(names('g2-d4')).toEqual([
      'G2',
      'A2',
      'B2',
      'C3',
      'D3',
      'E3',
      'F3',
      'G3',
      'A3',
      'B3',
      'C4',
      'D4',
    ])
    expect(STEP_PLAYS['g2-d4'].clef).toBe('bass')
    expect(playLength(STEP_PLAYS['g2-d4'])).toBeCloseTo(7.1, 5)
  })

  it("Step 5's plays: one key written on each staff, 2.0 s, and the 21 white keys, 5.22 s", () => {
    // Assert: FACTS 68
    const [t, b] = STEP_PLAYS['middle-c'].notes
    expect([midiOf(t.note), midiOf(b.note)]).toEqual([60, 60])
    expect([t.on, b.on, t.staffLit, b.staffLit]).toEqual([
      'treble',
      'bass',
      'treble',
      'bass',
    ])
    expect(playLength(STEP_PLAYS['middle-c'])).toBeCloseTo(2, 5)
    const keys = STEP_PLAYS['white-keys'].notes
    expect(keys).toHaveLength(21)
    expect(keys.every((n) => n.note.alter === 0)).toBe(true)
    expect([signName(keys[0].note), signName(keys[20].note)]).toEqual([
      'G2',
      'F5',
    ])
    expect(playLength(STEP_PLAYS['white-keys'])).toBeCloseTo(5.22, 5)
  })
})

describe("each step's state", () => {
  it('opens Step 1 on the nine places with each letter kept, and no ledger lines in reach', () => {
    expect(STEP_STATE[1]).toMatchObject({
      staff: 'single',
      clef: 'treble',
      tap: 'place',
      keep: true,
      reach: [0, 8],
    })
  })

  it('opens Step 3 on one note to move from F5, stopping past two ledger lines', () => {
    expect(STEP_STATE[3]).toMatchObject({ tap: 'mover', endLine: LEDGER_END })
    expect(STEP_STATE[3].start).toEqual(note('F5'))
    expect(STEP_STATE[3].reach).toBeUndefined()
  })

  it('opens Step 5 on the grand staff over the key strip, G2 to F5', () => {
    expect(STEP_STATE[5]).toMatchObject({
      staff: 'grand',
      keys: { lo: 43, hi: 77 },
    })
  })
})
