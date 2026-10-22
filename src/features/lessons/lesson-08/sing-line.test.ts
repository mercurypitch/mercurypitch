// ============================================================
// Lesson 8 sung line tests — its do, Move do and the readout
// ============================================================
//
// WEB-SPEC, Tests 9 (FACTS 67, 79): Move do clamps at four semitones either
// way; at 0 the line lies inside every preset of the chosen voice, checked
// against the app's own VOCAL_RANGES; the readout names semitones, never a
// note's letter, so it holds no sharp or flat sign.

import { describe, expect, it } from 'vitest'
import { clampMove, MOVE_MAX } from '@/features/lessons/kit/move-do'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import { doReadout, LINE_DO, lineDo, lineFrom } from './sing-line'

const PRESETS: Readonly<
  Record<'lower' | 'higher', readonly VocalRangePreset[]>
> = {
  lower: ['bass', 'baritone', 'tenor'],
  higher: ['alto', 'mezzo-soprano', 'soprano'],
}

describe('the line', () => {
  it('sings D3 D3 A3 A3 B3 B3 A3 for the lower voice, an octave up for the higher', () => {
    // Assert: FACTS 79
    expect(LINE_DO).toEqual({ lower: 50, higher: 62 })
    expect(lineFrom(lineDo('lower', 0)).map((s) => s.midi)).toEqual([
      50, 50, 57, 57, 59, 59, 57,
    ])
    expect(lineFrom(lineDo('higher', 0)).map((s) => s.midi)).toEqual([
      62, 62, 69, 69, 71, 71, 69,
    ])
  })

  it("lies inside every preset of the chosen voice at Move do 0, against the app's VOCAL_RANGES", () => {
    for (const voice of ['lower', 'higher'] as const) {
      // Act
      const notes = lineFrom(lineDo(voice, 0)).map((s) => s.midi)

      // Assert: FACTS 67
      for (const preset of PRESETS[voice]) {
        const range = VOCAL_RANGES[preset]
        expect(Math.min(...notes), preset).toBeGreaterThanOrEqual(range.lowMidi)
        expect(Math.max(...notes), preset).toBeLessThanOrEqual(range.highMidi)
      }
    }
  })
})

describe('Move do', () => {
  it('moves do a whole semitone at a time, four at most either way', () => {
    // Assert
    expect(MOVE_MAX).toBe(4)
    expect([-9, -4, -1.4, 0, 2.6, 4, 9].map(clampMove)).toEqual([
      -4, -4, -1, 0, 3, 4, 4,
    ])
    expect(lineDo('lower', -9)).toBe(46)
    expect(lineDo('higher', 9)).toBe(66)
  })

  it('reads in semitones, naming its ends, with no letter and no sign', () => {
    // Act
    const readouts = [-4, -3, -1, 0, 1, 2, 4].map(doReadout)

    // Assert
    expect(readouts).toEqual([
      'do: 4 semitones lower, the lowest',
      'do: 3 semitones lower',
      'do: 1 semitone lower',
      'do: as written',
      'do: 1 semitone higher',
      'do: 2 semitones higher',
      'do: 4 semitones higher, the highest',
    ])
    for (const r of readouts) expect(r).not.toMatch(/[♯♭#]|\b[A-G]\d\b/)
  })
})
