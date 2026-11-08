// ============================================================
// Lesson 16 sounds tests — the steps' notes, timings and staff states
// ============================================================
//
// LESSON.md's timings for the steps (FACTS 68), in each clef's octave, do
// on G3 or G4 (FACTS 8, 16); Hear it inside's beat before each note; the
// staff toy's states; and that no step plays the cold open's line or Sing
// it's second phrase (FACTS 43).

import { describe, expect, it } from 'vitest'
import type { PlayNote } from '@/features/lessons/kit/staff'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { StepPlay } from './sounds'
import { DO, doToSo, inside, playLength, staffState, stairsStaff, stepNotes, stepPlay, } from './sounds'

const midis = (notes: readonly PlayNote[]): number[] =>
  notes.map((n) => midiOf(n.note))
const onsets = (notes: readonly PlayNote[]): number[] => notes.map((n) => n.t)
const length = (notes: readonly PlayNote[]): number =>
  Math.round(playLength({ show: 'score', notes }) * 1000) / 1000

describe('do to so', () => {
  it('sits on G3 in the bass clef and G4 in the treble: G, A, B, C, D', () => {
    // Assert: FACTS 8 and 16
    expect(midiOf(DO.bass)).toBe(55)
    expect(midiOf(DO.treble)).toBe(67)
    expect(doToSo('bass').map(midiOf)).toEqual([55, 57, 59, 60, 62])
    expect(doToSo('treble').map(midiOf)).toEqual([67, 69, 71, 72, 74])
  })
})

describe('the steps’ plays', () => {
  it('plays do for 0.8 s, and do to so at 0.5 s a note with onsets 0.6 s apart, 2.9 s', () => {
    // Arrange
    const one = stepNotes('do', 'bass')
    const run = stepNotes('do-so', 'bass')

    // Assert: FACTS 68
    expect(midis(one)).toEqual([55])
    expect(length(one)).toBe(0.8)
    expect(midis(run)).toEqual([55, 57, 59, 60, 62])
    expect(onsets(run)).toEqual([0, 0.6, 1.2, 1.8, 2.4])
    expect(run.every((n) => n.dur === 0.5)).toBe(true)
    expect(length(run)).toBe(2.9)
  })

  it('plays the triad, do, mi, so, mi, do, in 2.9 s, and its turn, do, mi, then do, so, as 1.1 s, 0.5 s of quiet and 1.1 s', () => {
    // Arrange
    const triad = stepNotes('triad', 'treble')
    const turn = stepNotes('turn', 'treble')

    // Assert: FACTS 68
    expect(midis(triad)).toEqual([67, 71, 74, 71, 67])
    expect(length(triad)).toBe(2.9)
    expect(midis(turn)).toEqual([67, 71, 67, 74])
    expect(onsets(turn)).toEqual([0, 0.6, 1.6, 2.2])
    expect(length(turn)).toBe(2.7)
  })

  it('never plays the cold open’s line or Sing it’s second phrase, in either octave', () => {
    // Arrange: G A B A G and G D B A G, from each do
    const forbidden = (['bass', 'treble'] as const).flatMap((clef) => {
      const [g, a, b, , d] = doToSo(clef).map(midiOf)
      return [
        [g, a, b, a, g],
        [g, d, b, a, g],
      ].map((line) => line.join(' '))
    })
    const plays: StepPlay[] = ['do', 'do-so', 'triad', 'turn']

    // Assert: FACTS 43
    for (const clef of ['bass', 'treble'] as const)
      for (const name of plays)
        expect(forbidden).not.toContain(midis(stepNotes(name, clef)).join(' '))
  })
})

describe('Hear it inside', () => {
  it('lights each note of do to so 1.0 s before it sounds for 0.6 s, 8.0 s in all', () => {
    // Arrange
    const run = inside(stepNotes('do-so', 'bass'))

    // Assert: FACTS 68
    expect(midis(run)).toEqual([55, 57, 59, 60, 62])
    expect(onsets(run)).toEqual([1, 2.6, 4.2, 5.8, 7.4])
    expect(run.every((n) => n.ahead === 1 && n.dur === 0.6)).toBe(true)
    expect(length(run)).toBe(8)
  })

  it('keeps the turn’s half second of quiet between its two pairs, and leaves one note as it is', () => {
    // Arrange
    const turn = inside(stepNotes('turn', 'bass'))
    const one = inside(stepNotes('do', 'bass'))

    // Assert
    expect(onsets(turn)).toEqual([1, 2.6, 4.7, 6.3])
    expect(length(turn)).toBe(6.9)
    expect(one).toEqual(stepNotes('do', 'bass'))
  })

  it('is what a stage play does with the switch on, each note lighting its place on the score', () => {
    // Arrange
    const off = stepPlay('triad', 'bass', false)
    const on = stepPlay('triad', 'bass', true)

    // Assert
    expect(off.show).toBe('score')
    expect(on.show).toBe('score')
    expect(length(off.notes)).toBe(2.9)
    expect(length(on.notes)).toBe(8)
  })
})

describe('the staff’s states', () => {
  it('writes do to so with the house on do and the syllables counted from G, a tap sounding 0.8 s', () => {
    // Arrange
    const s = staffState('bass', true)

    // Assert: WEB-SPEC, Toys 2
    expect(s.clef).toBe('bass')
    expect(s.tap).toBe('place')
    expect(s.tapSec).toBe(0.8)
    expect(s.score?.map((n) => midiOf(n.note))).toEqual([55, 57, 59, 60, 62])
    expect(s.score?.map((n) => n.home === true)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ])
    expect(s.solfa).toEqual(DO.bass)
    expect(s.names).toBe(true)
    expect(s.lead).toBeUndefined()
    expect(staffState('treble', false).names).toBe(false)
  })

  it('gives Step 1’s staff do before each tapped note, bare until the staircase turns into it', () => {
    // Arrange
    const bare = stairsStaff('treble', false)
    const turned = stairsStaff('treble', true)

    // Assert: LESSON.md, Step 1's Try
    expect(bare.score).toBeUndefined()
    expect(bare.lead).toEqual(DO.treble)
    expect(turned.score?.map((n) => midiOf(n.note))).toEqual([
      67, 69, 71, 72, 74,
    ])
    expect(turned.lead).toEqual(DO.treble)
    expect(turned.names).toBe(true)
  })
})
