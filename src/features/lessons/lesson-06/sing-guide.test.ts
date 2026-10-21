// ============================================================
// Lesson 6 sing guide tests — two versions, ten rows, Move do, the readout
// ============================================================
//
// WEB-SPEC, Tests 6 (FACTS 56 to 58a, 70): each version 9.6 s; the
// count-in 0.8 s and 0.2 s; Move do clamps at four semitones either way and
// keeps the versions three apart; at Move do 0 both versions lie inside
// every preset of the chosen voice, against the app's own VOCAL_RANGES.
// And Tests 10's readout: "do is B♭2, then D♭3" at Move do's lowest.

import { describe, expect, it } from 'vitest'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import { lengthOf } from './examples'
import { BREATH_SEC, COUNT_IN, COUNT_IN_SEC, guidePath, guideRows, MOVE_MAX, readoutHtml, ringLabel, versionDo, versionNotes, } from './sing-guide'

/** Markup as the eye reads it: the signs shown, the spoken words dropped. */
const seen = (html: string): string =>
  html.replace(/<span class="sr">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')
/** Markup as a screen reader reads it: the signs dropped, the words kept. */
const heard = (html: string): string =>
  html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')

const PRESETS: Readonly<
  Record<'lower' | 'higher', readonly VocalRangePreset[]>
> = {
  lower: ['bass', 'baritone', 'tenor'],
  higher: ['alto', 'mezzo-soprano', 'soprano'],
}

describe('the two versions', () => {
  it('sing both lines from D3, then from F3, 9.6 s each', () => {
    // Act
    const first = versionNotes(versionDo('lower', 1, 0))
    const second = versionNotes(versionDo('lower', 2, 0))

    // Assert: FACTS 70
    expect(first.map((e) => e.midi)).toEqual([
      50, 50, 57, 57, 59, 59, 57, 55, 55, 54, 54, 52, 52, 50,
    ])
    expect(second.map((e) => e.midi)).toEqual([
      53, 53, 60, 60, 62, 62, 60, 58, 58, 57, 57, 55, 55, 53,
    ])
    expect(lengthOf(first)).toBeCloseTo(9.6, 9)
    expect(lengthOf(second)).toBeCloseTo(9.6, 9)
    expect(first[6].dur).toBeCloseTo(1.2, 9)
  })

  it('count in for 0.8 s at half a tapped note, then 0.2 s of quiet', () => {
    expect(COUNT_IN.note).toBe(0.8)
    expect(COUNT_IN.quiet).toBe(0.2)
    expect(COUNT_IN.gain).toBe(0.065)
    expect(COUNT_IN_SEC).toBeCloseTo(1, 9)
  })

  it('move do up to four semitones either way, the versions always three apart', () => {
    for (const voice of ['lower', 'higher'] as const)
      for (let shift = -7; shift <= 7; shift++) {
        const one = versionDo(voice, 1, shift)
        const two = versionDo(voice, 2, shift)
        expect(two - one).toBe(3)
        expect(Math.abs(one - versionDo(voice, 1, 0))).toBeLessThanOrEqual(
          MOVE_MAX,
        )
      }
    expect(versionDo('lower', 1, -9)).toBe(46)
    expect(versionDo('higher', 2, 9)).toBe(69)
  })

  it("lie inside every preset of the chosen voice at Move do 0, against the app's VOCAL_RANGES", () => {
    for (const voice of ['lower', 'higher'] as const) {
      const notes = [1, 2].flatMap((v) =>
        versionNotes(versionDo(voice, v as 1 | 2, 0)).map((e) => e.midi),
      )
      for (const preset of PRESETS[voice]) {
        const range = VOCAL_RANGES[preset]
        expect(Math.min(...notes), preset).toBeGreaterThanOrEqual(range.lowMidi)
        expect(Math.max(...notes), preset).toBeLessThanOrEqual(range.highMidi)
      }
    }
  })
})

describe('the guide', () => {
  it('has ten rows, do to la, the six the tune sings named and the four between faint', () => {
    // Act
    const rows = guideRows(50)

    // Assert
    expect(rows.map((r) => r.midi)).toEqual(
      Array.from({ length: 10 }, (_, k) => 50 + k),
    )
    expect(
      rows.filter((r) => r.faint !== true).map((r) => seen(r.label)),
    ).toEqual(['do', 're', 'mi', 'fa', 'so', 'la'])
    expect(
      rows.filter((r) => r.faint === true).map((r) => r.midi - 50),
    ).toEqual([1, 3, 6, 8])
  })

  it("draws Merc's path through every note, 9.6 s, with no rest, and the breath after “star”", () => {
    const path = guidePath(50)
    expect(path[0].t).toBe(0)
    expect(path.at(-1)?.t).toBeCloseTo(9.6, 9)
    expect(path.some((p) => p.gap === true)).toBe(false)
    // "star" ends the first line at 4.8 s, and "How" starts there
    expect(versionNotes(50)[7].at).toBeCloseTo(BREATH_SEC, 9)
  })
})

describe('the readout', () => {
  it('names the two starts as the tune line spells them, signs shown and spoken', () => {
    expect(seen(readoutHtml('lower', 0))).toBe('do is D3, then F3')
    expect(seen(readoutHtml('lower', -4))).toBe('do is B♭2, then D♭3')
    expect(heard(readoutHtml('lower', -4))).toBe(
      'do is B flat 2, then D flat 3',
    )
    expect(seen(readoutHtml('higher', 4))).toBe('do is F♯4, then A4')
    expect(heard(readoutHtml('higher', 4))).toBe('do is F sharp 4, then A4')
  })

  it("labels the ring with do's name and frequency", () => {
    expect(seen(ringLabel(50))).toBe('Do: D3 · 147 Hz')
  })
})
