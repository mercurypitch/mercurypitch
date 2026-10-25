// ============================================================
// Lesson 10 sing guide tests — Merc's notes, Move do, the rows, the readout
// ============================================================
//
// WEB-SPEC, Tests 9 (FACTS 63 to 66, 80): do on E3 or E4; Move do clamps at
// four semitones either way; at every position both chords lie inside
// every preset of the chosen voice, against the app's own VOCAL_RANGES
// with Lesson 6's voice-to-preset mapping; the readouts, in Lesson 4's
// names, signs shown and spoken. And Toys 6's guide: eight rows, four of
// them named, a path of 10.0 s that falls silent for the gap, and the
// breath mark at its start.

import { describe, expect, it } from 'vitest'
// the guide's path helpers load the kit's motion setting, which reads matchMedia
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { MOVE_MAX } from '@/features/lessons/kit/move-do'
import { inGap, pathLength, pathPieces, } from '@/features/lessons/kit/slide-guide'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import { BREATH_SEC, guidePath, guideRows, readoutHtml, SING_SEC, singDo, singNotes, } from './sing-guide'
import { lengthOf } from './sounds'

/** Markup as the eye reads it: the signs shown, the spoken words dropped. */
const seen = (html: string): string =>
  html.replace(/<span class="sr">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')
/** Markup as a screen reader reads it: the signs dropped, the words kept. */
const heard = (html: string): string =>
  html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')

/** Each voice's presets, as Lesson 6's guide test maps them (FACTS 63). */
const PRESETS: Readonly<Record<Voice, readonly VocalRangePreset[]>> = {
  lower: ['bass', 'baritone', 'tenor'],
  higher: ['alto', 'mezzo-soprano', 'soprano'],
}
const VOICES: readonly Voice[] = ['lower', 'higher']
/** Every Move do position, and some past its reach either way. */
const SHIFTS = Array.from({ length: 15 }, (_, i) => i - 7)

describe("Merc's notes", () => {
  it('sing do-mi-so, then do-me-so, from E3, or E4 for the higher voice', () => {
    // Act
    const lower = singNotes(singDo('lower', 0)).map((n) => n.midi)
    const higher = singNotes(singDo('higher', 0)).map((n) => n.midi)

    // Assert: FACTS 80, E3 G♯3 B3, then E3 G3 B3
    expect(lower).toEqual([52, 56, 59, 52, 55, 59])
    expect(higher).toEqual([64, 68, 71, 64, 67, 71])
  })

  it('take 1.2 s a note and 1.8 s for the top one, 1.6 s apart: 10.0 s in all', () => {
    // Act
    const notes = singNotes(52)

    // Assert: FACTS 65
    expect(notes.map((n) => n.dur)).toEqual([1.2, 1.2, 1.8, 1.2, 1.2, 1.8])
    expect(notes[3].t - (notes[2].t + notes[2].dur)).toBeCloseTo(1.6, 9)
    expect(lengthOf(notes)).toBeCloseTo(10, 9)
    expect(SING_SEC).toBeCloseTo(10, 9)
  })

  it("carry no tone or level of their own, so the kit's run sings them in Merc's ooh", () => {
    for (const n of singNotes(52)) {
      expect(n.kind).toBeUndefined()
      expect(n.gain).toBeUndefined()
    }
  })
})

describe('Move do', () => {
  it('moves do a semitone at a time, up to four either way, and no further', () => {
    for (const voice of VOICES)
      for (const shift of SHIFTS) {
        const moved = singDo(voice, shift) - singDo(voice, 0)
        expect(moved, `${voice} ${shift}`).toBe(
          Math.max(-MOVE_MAX, Math.min(MOVE_MAX, shift)),
        )
      }
    expect(MOVE_MAX).toBe(4)
    expect([singDo('lower', -9), singDo('lower', 9)]).toEqual([48, 56])
    expect([singDo('higher', -5), singDo('higher', 5)]).toEqual([60, 68])
  })

  it("keeps both chords inside every preset of the chosen voice at every position, against the app's VOCAL_RANGES", () => {
    for (const voice of VOICES)
      for (const shift of SHIFTS) {
        const notes = singNotes(singDo(voice, shift)).map((n) => n.midi)
        for (const preset of PRESETS[voice]) {
          const range = VOCAL_RANGES[preset]
          const at = `${voice} ${shift} ${preset}`
          expect(Math.min(...notes), at).toBeGreaterThanOrEqual(range.lowMidi)
          expect(Math.max(...notes), at).toBeLessThanOrEqual(range.highMidi)
        }
      }
  })

  it("moves Merc's notes, the guide and the readout together", () => {
    for (const voice of VOICES)
      for (const shift of SHIFTS) {
        const d = singDo(voice, shift)
        expect(singNotes(d)[0].midi).toBe(d)
        expect(guideRows(d)[0].midi).toBe(d)
        expect(guidePath(d)[0].midi).toBe(d)
      }
  })
})

describe('the guide', () => {
  it('has eight rows, do up to so, with do, me, mi and so named and the four between faint', () => {
    // Act
    const rows = guideRows(52)

    // Assert
    expect(rows.map((r) => r.midi)).toEqual([52, 53, 54, 55, 56, 57, 58, 59])
    expect(rows.map((r) => (r.faint === true ? '' : seen(r.label)))).toEqual([
      'do',
      '',
      '',
      'me',
      'mi',
      '',
      '',
      'so',
    ])
  })

  it('labels the rows with syllables only, never a letter', () => {
    for (const r of guideRows(48)) expect(seen(r.label)).not.toMatch(/[A-G]/)
  })

  it("draws Merc's path through every note for 10.0 s, lifting the pen over the gap", () => {
    // Act
    const path = guidePath(52)
    const gaps = path.filter((p) => p.gap === true)

    // Assert
    expect(path[0].t).toBe(0)
    expect(pathLength(path)).toBeCloseTo(10, 9)
    expect(gaps.map((p) => [p.t, p.midi])).toEqual([
      [expect.closeTo(5.8, 9), 52],
    ])
    expect(pathPieces(path, 0, pathLength(path))).toHaveLength(2)
    expect(inGap(path, 5)).toBe(true)
    expect(inGap(path, 4.1)).toBe(false)
  })

  it('holds each note at its own row, gliding into the next only within a chord', () => {
    // Act
    const path = guidePath(52)

    // Assert: each note's two points, at its start and near its end
    expect(path.map((p) => p.midi)).toEqual([
      52, 52, 56, 56, 59, 59, 52, 52, 55, 55, 59, 59,
    ])
    expect(path[1].t).toBeCloseTo(1.15, 9)
    expect(path[5].t).toBeCloseTo(4.2, 9)
  })

  it('puts the breath mark at the start of the gap, 4.2 s in', () => {
    // Act
    const path = guidePath(52)

    // Assert: FACTS 66
    expect(BREATH_SEC).toBeCloseTo(4.2, 9)
    expect(inGap(path, BREATH_SEC - 0.01)).toBe(false)
    expect(inGap(path, BREATH_SEC + 0.01)).toBe(true)
  })
})

describe('the readout', () => {
  it("names do in Lesson 4's names at every position, from C3 to A♭3, or C4 to A♭4", () => {
    // Arrange: FACTS 64; Lesson 4's keys D♭, E♭, F♯ and A♭
    const names = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭']
    const words = [
      'C',
      'D flat ',
      'D',
      'E flat ',
      'E',
      'F',
      'F sharp ',
      'G',
      'A flat ',
    ]

    for (const [voice, octave] of [
      ['lower', 3],
      ['higher', 4],
    ] as const)
      for (let shift = -MOVE_MAX; shift <= MOVE_MAX; shift++) {
        // Act
        const html = readoutHtml(voice, shift)

        // Assert
        const i = shift + MOVE_MAX
        expect(seen(html)).toBe(`do is ${names[i]}${octave}`)
        expect(heard(html)).toBe(`do is ${words[i]}${octave}`)
      }
  })

  it('reads "do is E3" at the start, and "do is A flat 3" at the top', () => {
    expect(seen(readoutHtml('lower', 0))).toBe('do is E3')
    expect(heard(readoutHtml('lower', 4))).toBe('do is A flat 3')
  })
})
