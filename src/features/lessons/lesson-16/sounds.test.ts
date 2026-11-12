// ============================================================
// Lesson 16 sounds tests — the steps' notes, timings and staff states
// ============================================================
//
// LESSON.md's timings for the steps (FACTS 68), in each clef's octave, do
// on G3 or G4 (FACTS 8, 16); where do to so sit on each staff, and their
// steps (FACTS 12 to 14); the range against the app's own presets (FACTS
// 44); Hear it inside's beat before each note; the staff toy's states; and
// that nothing the learner hears before the second take, but Merc's
// phrases once the singing has ended, plays the cold open's line or Sing
// it's second phrase (FACTS 43; WEB-SPEC, Tests 1, 3, 4 and 9).

import { describe, expect, it } from 'vitest'
import type { PlayNote } from '@/features/lessons/kit/staff'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { isLine, ledgerCount, midiOf, placeOf, } from '@/features/lessons/kit/staff-places'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import type { StepPlay } from './sounds'
import { DO, doToSo, inside, mercPhrases, phraseOf, playLength, quizDoRe, runOf, staffState, stairsStaff, START_SEC, startNotes, stepNotes, stepPlay, sungLength, } from './sounds'

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

describe('do to so on the staff', () => {
  /** Each note of do to so on `clef`'s staff: line or space, its place, its ledger lines. */
  const where = (clef: Clef) =>
    doToSo(clef).map((n) => {
      const p = placeOf(n, clef)
      return [isLine(p) ? 'line' : 'space', p, ledgerCount(p, clef)] as const
    })

  it('puts G4 on the treble staff’s second line, A4 in its second space, B4 on the middle line, C5 in the third space and D5 on the fourth line', () => {
    // Assert: FACTS 12 and 13
    expect(where('treble')).toEqual([
      ['line', 2, 0],
      ['space', 3, 0],
      ['line', 4, 0],
      ['space', 5, 0],
      ['line', 6, 0],
    ])
  })

  it('puts G3 in the bass staff’s top space, A3 on its top line, B3 in the space above, C4 on one ledger line and D4 in the space over it', () => {
    // Assert: FACTS 12 and 13
    expect(where('bass')).toEqual([
      ['space', 7, 0],
      ['line', 8, 0],
      ['space', 9, 0],
      ['line', 10, 1],
      ['space', 11, 1],
    ])
  })

  it('writes do, mi and so on three lines in a row in the treble and three spaces in a row in the bass', () => {
    // Act
    const triad = (clef: Clef) =>
      [0, 2, 4].map((i) => where(clef)[i]).map(([kind, place]) => [kind, place])

    // Assert: FACTS 14
    expect(triad('treble')).toEqual([
      ['line', 2],
      ['line', 4],
      ['line', 6],
    ])
    expect(triad('bass')).toEqual([
      ['space', 7],
      ['space', 9],
      ['space', 11],
    ])
  })

  it('steps G to A and A to B by a tone and B to C by a semitone, G to B 4 semitones, B to D 3 and G to D 7', () => {
    for (const clef of ['bass', 'treble'] as const) {
      // Act
      const [g, a, b, c, d] = doToSo(clef).map(midiOf)

      // Assert: FACTS 14
      expect([a - g, b - a, c - b, b - g, d - b, d - g]).toEqual([
        2, 2, 1, 4, 3, 7,
      ])
    }
  })
})

describe('the range', () => {
  /** The app's presets for each voice (src/stores/settings-store.ts). */
  const PRESETS: Readonly<
    Record<'lower' | 'higher', readonly VocalRangePreset[]>
  > = {
    lower: ['bass', 'baritone', 'tenor'],
    higher: ['alto', 'mezzo-soprano', 'soprano'],
  }
  const CLEF = { lower: 'bass', higher: 'treble' } as const
  /** The notes a voice sings on this page: do to so in its clef's octave. */
  const sung = (voice: 'lower' | 'higher'): number[] =>
    doToSo(CLEF[voice]).map(midiOf)

  it('keeps every note of G3 to D4, and of G4 to D5, at least two semitones inside every preset of its voice, each line’s middle within 6.5 semitones of each preset’s', () => {
    for (const voice of ['lower', 'higher'] as const) {
      // Arrange
      const notes = sung(voice)
      const middle = (Math.min(...notes) + Math.max(...notes)) / 2

      for (const preset of PRESETS[voice]) {
        // Act
        const r = VOCAL_RANGES[preset]

        // Assert: FACTS 44
        expect(Math.min(...notes) - r.lowMidi, preset).toBeGreaterThanOrEqual(2)
        expect(r.highMidi - Math.max(...notes), preset).toBeGreaterThanOrEqual(
          2,
        )
        expect(
          Math.abs(middle - (r.lowMidi + r.highMidi) / 2),
          preset,
        ).toBeLessThanOrEqual(6.5)
      }
    }
  })

  it('leaves the least room at the top for the bass preset, D4 against E4, and the alto, D5 against F5', () => {
    // Assert: FACTS 44
    expect(VOCAL_RANGES.bass.highMidi - Math.max(...sung('lower'))).toBe(2)
    expect(VOCAL_RANGES.alto.highMidi - Math.max(...sung('higher'))).toBe(3)
  })

  it('would start on or below the floor of four of the six presets an octave lower, and leave the bass preset 1 semitone at its top on G sharp', () => {
    // Act
    const floored = (['lower', 'higher'] as const).flatMap((voice) =>
      PRESETS[voice].filter(
        (p) => Math.min(...sung(voice)) - 12 <= VOCAL_RANGES[p].lowMidi,
      ),
    )

    // Assert: FACTS 44, so the page moves no do and names no octave
    expect(floored).toEqual(['baritone', 'tenor', 'mezzo-soprano', 'soprano'])
    expect(VOCAL_RANGES.bass.highMidi - (Math.max(...sung('lower')) + 1)).toBe(
      1,
    )
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

describe('the second phrase, heard only once read', () => {
  /** Whether `notes` (MIDI) sound `line` in a row, in any octave. */
  const sounds = (notes: readonly number[], line: readonly number[]) =>
    [-24, -12, 0, 12, 24].some((shift) =>
      notes
        .map((_, i) => notes.slice(i, i + line.length).join(' '))
        .includes(line.map((m) => m + shift).join(' ')),
    )

  it('sounds G, D, B, A, G in no step, no start, and not in the quick check’s do and re: only in Merc’s phrases, once the singing has ended', () => {
    for (const clef of ['bass', 'treble'] as const) {
      // Arrange
      const second = phraseOf(2, clef).map(midiOf)
      const heard = [
        ...(['do', 'do-so', 'triad', 'turn'] as const).map((name) =>
          midis(stepNotes(name, clef)),
        ),
        ...([1, 2] as const).map((next) =>
          runOf(startNotes(clef, next)).map((n) => n.midi),
        ),
        quizDoRe(clef).map((n) => n.midi),
      ]

      // Assert: FACTS 43, WEB-SPEC Tests 9 (the flow offers Merc's phrases
      // only once the singing has ended: sing-flow.test.ts)
      for (const notes of heard) expect(sounds(notes, second), clef).toBe(false)
      expect(
        sounds(
          runOf(mercPhrases(clef)).map((n) => n.midi),
          second,
        ),
      ).toBe(true)
    }
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

describe('Sing it’s notes', () => {
  /** Notes as [onset, MIDI note, length, the columns they light]. */
  const heard = (notes: ReturnType<typeof startNotes>) =>
    notes.map((n) => [
      n.t,
      midiOf(n.note),
      n.dur,
      n.lights === null
        ? null
        : `${n.lights.phrase}:${n.lights.cols.join(',')}`,
    ])

  it('writes the two phrases in each clef’s octave: do, re, mi, re, do and do, so, mi, re, do', () => {
    // Assert: WEB-SPEC, Toys 6
    expect(phraseOf(1, 'bass').map(midiOf)).toEqual([55, 57, 59, 57, 55])
    expect(phraseOf(2, 'bass').map(midiOf)).toEqual([55, 62, 59, 57, 55])
    expect(phraseOf(2, 'treble').map(midiOf)).toEqual([67, 74, 71, 69, 67])
  })

  it('gives the start do for 1.0 s, 0.4 s of quiet, then do, mi, so, mi, do, 4.4 s, lighting only the written do’s', () => {
    // Assert: FACTS 42
    expect(heard(startNotes('bass', 1))).toEqual([
      [0, 55, 1, '1:0,4'],
      [1.4, 55, 0.6, '1:0,4'],
      [2, 59, 0.6, null],
      [2.6, 62, 0.6, null],
      [3.2, 59, 0.6, null],
      [3.8, 55, 0.6, '1:0,4'],
    ])
    expect([START_SEC, sungLength(startNotes('treble', 2))]).toEqual([4.4, 4.4])
    expect(runOf(startNotes('treble', 2)).map((n) => n.midi)).toEqual([
      67, 67, 71, 74, 71, 67,
    ])
  })

  it('plays Merc’s phrases as the start, 0.6 s of quiet, phrase 1, 1.0 s of quiet and phrase 2, 12.0 s', () => {
    // Act
    const notes = mercPhrases('bass')

    // Assert: FACTS 70
    expect(sungLength(notes)).toBe(12)
    expect(heard(notes.slice(6))).toEqual([
      [5, 55, 0.6, '1:0'],
      [5.6, 57, 0.6, '1:1'],
      [6.2, 59, 0.6, '1:2'],
      [6.8, 57, 0.6, '1:3'],
      [7.4, 55, 0.6, '1:4'],
      [9, 55, 0.6, '2:0'],
      [9.6, 62, 0.6, '2:1'],
      [10.2, 59, 0.6, '2:2'],
      [10.8, 57, 0.6, '2:3'],
      [11.4, 55, 0.6, '2:4'],
    ])
  })
})
