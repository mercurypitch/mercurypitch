// ============================================================
// Lesson 12 sing guide tests — Merc's notes, Move do's reach, the rows, the path
// ============================================================
//
// WEB-SPEC, Tests 9 (FACTS 59 to 62, 73), apart from the clamp, which is
// the kit's Move do's once it takes a reach for each side: at every
// position from four lower to three higher every note lies at least a
// semitone inside every preset of the chosen voice, against the app's own
// VOCAL_RANGES; a fourth step higher would leave the bass preset none,
// which is why it stops; the readouts, in Lesson 4's names, A♭3 to E♭4
// and A♭4 to E♭5; the chords shift with do. And Toys 6's guide: eight
// rows a semitone apart, four of them named, a path of 10.0 s that falls
// silent after every note, and the breath mark in the gap after la.

import { describe, expect, it } from 'vitest'
// the guide's path helpers load the kit's motion setting, which reads matchMedia
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { inGap, pathLength, pathPieces, pitchAt, } from '@/features/lessons/kit/slide-guide'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import { BREATH_SEC, guideChordsAt, guidePath, guideRows, REACH, readoutAt, singAlongAt, singDo, sungNotes, } from './sing-guide'
import { lengthOf, UNDER_GAIN } from './sounds'

/** Markup as the eye reads it: the signs shown, the spoken words dropped. */
const seen = (html: string): string =>
  html.replace(/<span class="sr">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')
/** Markup as a screen reader reads it: the signs dropped, the words kept. */
const heard = (html: string): string =>
  html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')

/** Each voice's presets, as the spec's table maps them (WEB-SPEC, Toys 6; FACTS 59). */
const PRESETS: Readonly<Record<Voice, readonly VocalRangePreset[]>> = {
  lower: ['bass', 'baritone', 'tenor'],
  higher: ['alto', 'mezzo-soprano', 'soprano'],
}
const VOICES: readonly Voice[] = ['lower', 'higher']
/** Move do's positions, four lower to three higher. */
const REACHED = Array.from(
  { length: REACH.lower + REACH.higher + 1 },
  (_, i) => i - REACH.lower,
)
/** Every position, and some past the reach either way. */
const SHIFTS = Array.from({ length: 15 }, (_, i) => i - 7)

const midis = (notes: readonly { midi: number }[]): number[] =>
  notes.map((n) => n.midi)
const chordsOf = (voice: Voice, shift: number) =>
  singAlongAt(voice, shift).filter((n) => n.kind !== 'merc')

/** Semitones to spare below and above a line in a preset. */
function spare(line: readonly number[], preset: VocalRangePreset): number[] {
  const range = VOCAL_RANGES[preset]
  return [Math.min(...line) - range.lowMidi, range.highMidi - Math.max(...line)]
}

describe("Merc's notes and the chords", () => {
  it('sing do, so, la, fa and do from C4 for the lower voice and C5 for the higher, at Move do 0', () => {
    // Act
    const lower = midis(sungNotes('lower', 0))
    const higher = midis(sungNotes('higher', 0))

    // Assert: FACTS 59, C4 G3 A3 F3 C4, and the spec's table
    expect(lower).toEqual([60, 55, 57, 53, 60])
    expect(higher).toEqual([72, 67, 69, 65, 72])
    expect([singDo('lower', 0), singDo('higher', 0)]).toEqual([60, 72])
  })

  it('hold each root 1.6 s with 0.4 s after it and the last do 2.0 s, each starting with its chord: 10.0 s', () => {
    // Act
    const notes = sungNotes('lower', 0)
    const chordStarts = [...new Set(chordsOf('lower', 0).map((n) => n.t))]

    // Assert: FACTS 61 and 73
    expect(notes.map((n) => n.dur)).toEqual([1.6, 1.6, 1.6, 1.6, 2])
    expect(notes.map((n) => n.t)).toEqual([0, 2, 4, 6, 8])
    expect(chordStarts).toEqual([0, 2, 4, 6, 8])
    expect(lengthOf(singAlongAt('lower', 0))).toBeCloseTo(10, 9)
    expect(lengthOf(guideChordsAt(0))).toBeCloseTo(10, 9)
  })

  it("play the guide the same chords as Merc, at 0.05 a voice, at the loop's own pitch for either voice", () => {
    // Act
    const guide = guideChordsAt(0)

    // Assert: FACTS 73 and 74, I V vi IV and I
    expect(chordsOf('lower', 0)).toEqual(guide)
    expect(chordsOf('higher', 0)).toEqual(guide)
    expect(guide.every((n) => n.gain === UNDER_GAIN)).toBe(true)
    expect(guide.filter((n) => n.t === 0).map((n) => n.midi)).toEqual([
      60, 64, 67,
    ])
  })
})

describe('Move do', () => {
  it('reaches four semitones lower and three higher', () => {
    // Assert: FACTS 60, spec Decisions 8
    expect(REACH).toEqual({ lower: 4, higher: 3 })
    expect(REACHED).toEqual([-4, -3, -2, -1, 0, 1, 2, 3])
  })

  it("moves Merc's notes, the chords, the count-in's do, the rows and the path together, by any shift, never clamping it", () => {
    for (const voice of VOICES)
      for (const shift of SHIFTS) {
        const at = `${voice} ${shift}`
        const up = (ms: readonly number[]): number[] => ms.map((m) => m + shift)
        expect(midis(sungNotes(voice, shift)), at).toEqual(
          up(midis(sungNotes(voice, 0))),
        )
        expect(midis(chordsOf(voice, shift)), at).toEqual(
          up(midis(chordsOf(voice, 0))),
        )
        expect(midis(guideChordsAt(shift)), at).toEqual(
          up(midis(guideChordsAt(0))),
        )
        expect(singDo(voice, shift), at).toBe(singDo(voice, 0) + shift)
        expect(midis(guideRows(voice, shift)), at).toEqual(
          up(midis(guideRows(voice, 0))),
        )
        expect(midis(guidePath(voice, shift)), at).toEqual(
          up(midis(guidePath(voice, 0))),
        )
      }
  })

  it('keeps every note at least a semitone inside every preset of the chosen voice at every position, against VOCAL_RANGES', () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const voice of VOICES)
      for (const shift of REACHED)
        for (const preset of PRESETS[voice]) {
          const room = spare(midis(sungNotes(voice, shift)), preset)
          if (Math.min(...room) < 1) bad.push(`${voice} ${shift} ${preset}`)
        }

    // Assert: FACTS 60
    expect(bad).toEqual([])
  })

  it("leaves each preset FACTS 59's spare semitones at Move do 0", () => {
    // Act
    const room = Object.fromEntries(
      VOICES.flatMap((voice) =>
        PRESETS[voice].map((p) => [p, spare(midis(sungNotes(voice, 0)), p)]),
      ),
    )

    // Assert: FACTS 59, and the spec's table
    expect(room).toEqual({
      bass: [13, 4],
      baritone: [10, 7],
      tenor: [5, 12],
      alto: [12, 5],
      'mezzo-soprano': [8, 9],
      soprano: [5, 12],
    })
  })

  it('stops where one more step would leave a preset no room: the bass at a fourth higher, the tenor and soprano at a fifth lower', () => {
    // Act
    const bassTop = spare(midis(sungNotes('lower', REACH.higher + 1)), 'bass')
    const tenorFoot = spare(
      midis(sungNotes('lower', -REACH.lower - 1)),
      'tenor',
    )
    const sopranoFoot = spare(
      midis(sungNotes('higher', -REACH.lower - 1)),
      'soprano',
    )

    // Assert: FACTS 60, the top do on E4, the bass preset's very top
    expect(singDo('lower', REACH.higher + 1)).toBe(64)
    expect(bassTop[1]).toBe(0)
    expect(tenorFoot[0]).toBe(0)
    expect(sopranoFoot[0]).toBe(0)
  })

  it("reads do and the line in Lesson 4's names at the reach's ends: A♭3 to E♭4, and A♭4 to E♭5", () => {
    // Act
    const ends = VOICES.map((voice) => [
      readoutAt(voice, -REACH.lower),
      readoutAt(voice, REACH.higher),
    ])

    // Assert: FACTS 60
    expect(ends.map((pair) => pair.map((r) => seen(r.html)))).toEqual([
      [
        'do is A♭3: A♭3, E♭3, F3, D♭3, A♭3',
        'do is E♭4: E♭4, B♭3, C4, A♭3, E♭4',
      ],
      [
        'do is A♭4: A♭4, E♭4, F4, D♭4, A♭4',
        'do is E♭5: E♭5, B♭4, C5, A♭4, E♭5',
      ],
    ])
    expect(heard(ends[0][0].html)).toBe(ends[0][0].words)
    expect(ends[0][0].words).toBe(
      'do is A flat 3: A flat 3, E flat 3, F3, D flat 3, A flat 3',
    )
  })

  it('reads "do is C4" for the lower voice and "do is C5" for the higher at the middle position', () => {
    expect(readoutAt('lower', 0).words).toBe('do is C4: C4, G3, A3, F3, C4')
    expect(readoutAt('higher', 0).words).toBe('do is C5: C5, G4, A4, F4, C5')
  })
})

describe('the guide', () => {
  it('has eight rows from fa up to do, a semitone apart, with fa, so, la and do named and the four between faint', () => {
    for (const voice of VOICES)
      for (const shift of REACHED) {
        // Act
        const rows = guideRows(voice, shift)
        const fa = singDo(voice, shift) - 7

        // Assert
        const at = `${voice} ${shift}`
        expect(midis(rows), at).toEqual(
          Array.from({ length: 8 }, (_, k) => fa + k),
        )
        expect(
          rows.map((r) => (r.faint === true ? '' : seen(r.label))),
          at,
        ).toEqual(['fa', '', 'so', '', 'la', '', '', 'do'])
      }
  })

  it('labels the rows with syllables only, never a letter', () => {
    for (const voice of VOICES)
      for (const shift of REACHED)
        for (const r of guideRows(voice, shift))
          expect(seen(r.label)).not.toMatch(/[A-G♯♭]/)
  })

  it("draws Merc's path for 10.0 s, lifting the pen after every note, so each of the five stands alone", () => {
    // Act
    const path = guidePath('lower', 0)

    // Assert: FACTS 61
    expect(path.map((p) => [p.t, p.midi, p.gap === true])).toEqual([
      [0, 60, false],
      [1.6, 60, false],
      [2, 55, true],
      [3.6, 55, false],
      [4, 57, true],
      [5.6, 57, false],
      [6, 53, true],
      [7.6, 53, false],
      [8, 60, true],
      [10, 60, false],
    ])
    expect(pathLength(path)).toBeCloseTo(10, 9)
    expect(pathPieces(path, 0, pathLength(path))).toHaveLength(5)
    expect([1.8, 3.8, 5.8, 7.8].map((t) => inGap(path, t))).toEqual([
      true,
      true,
      true,
      true,
    ])
    expect([0.8, 2.8, 4.8, 6.8, 9].map((t) => inGap(path, t))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ])
  })

  it('puts the breath mark in the gap after la, 5.6 s in', () => {
    // Act
    const path = guidePath('higher', 0)

    // Assert: FACTS 62, 2 x 2.0 + 1.6
    expect(BREATH_SEC).toBeCloseTo(5.6, 9)
    expect(pitchAt(path, BREATH_SEC - 0.01)).toBe(singDo('higher', 0) - 3)
    expect(inGap(path, BREATH_SEC - 0.01)).toBe(false)
    expect(inGap(path, BREATH_SEC + 0.01)).toBe(true)
  })
})
