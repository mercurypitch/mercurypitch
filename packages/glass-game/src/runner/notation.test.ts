// ============================================================
// Runner notation tests — pitch, rhythm, glide, and fill geometry stay shared.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { RunnerNotationNote } from './notation'
import { clampRunnerNotationFill, layoutRunnerNotation, runnerLedgerSteps, runnerMidiName, runnerRhythm, runnerStaffStep, } from './notation'

function note(overrides: Partial<RunnerNotationNote> = {}): RunnerNotationNote {
  return {
    index: 0,
    startBeat: 0,
    endBeat: 1,
    startMidi: 60,
    endMidi: 60,
    connection: 'separate',
    fillProgress: 0,
    state: 'hollow',
    ...overrides,
  }
}

describe('runner notation pitch geometry', () => {
  it('names natural notes and sharps with scientific octaves', () => {
    expect(runnerMidiName(60).text).toBe('C4')
    expect(runnerMidiName(61)).toMatchObject({
      letter: 'C',
      accidental: 'sharp',
      octave: 4,
      text: 'C#4',
    })
    expect(runnerMidiName(71).text).toBe('B4')
    expect(runnerMidiName(72).text).toBe('C5')
  })

  it('moves monotonically up the staff while sharps retain the natural step', () => {
    expect(runnerStaffStep(60)).toBe(0)
    expect(runnerStaffStep(61)).toBe(0)
    expect(runnerStaffStep(62)).toBe(1)
    expect(runnerStaffStep(64)).toBe(2)
    expect(runnerStaffStep(72)).toBe(7)
  })

  it('returns ledger lines from the staff outwards', () => {
    expect(runnerLedgerSteps(60)).toEqual([0])
    expect(runnerLedgerSteps(59)).toEqual([0])
    expect(runnerLedgerSteps(57)).toEqual([0, -2])
    expect(runnerLedgerSteps(77)).toEqual([])
    expect(runnerLedgerSteps(81)).toEqual([12])
  })
})

describe('runner notation rhythm and layout', () => {
  it.each([
    [4, 'whole'],
    [3, 'dotted-half'],
    [2, 'half'],
    [1.5, 'dotted-quarter'],
    [1, 'quarter'],
    [0.5, 'eighth'],
    [8, 'sustained'],
    [0.75, 'custom'],
  ] as const)('maps %s beats to %s', (beats, glyph) => {
    expect(runnerRhythm(beats)).toBe(glyph)
  })

  it('lays a glide from its resolved start to end pitch', () => {
    const layout = layoutRunnerNotation([
      note({
        connection: 'glide',
        startMidi: 60,
        endMidi: 64,
        endBeat: 2,
        fillProgress: 0.65,
        state: 'filling',
      }),
    ])
    const glyph = layout.notes[0]

    expect(glyph.label).toBe('C4 to E4')
    expect(glyph.endY).toBeLessThan(glyph.startY)
    expect(glyph.x).toBe(glyph.endX)
    expect(glyph.fillProgress).toBe(0.65)
  })

  it('keeps note geometry inside a small shared view box', () => {
    const layout = layoutRunnerNotation(
      [
        note({ index: 0, startBeat: 8, endBeat: 10 }),
        note({ index: 1, startBeat: 10, endBeat: 12, endMidi: 67 }),
      ],
      { width: 320, height: 128, activeNoteIndex: 1 },
    )

    expect(layout.width).toBe(320)
    expect(layout.height).toBe(128)
    expect(layout.notes.every((glyph) => glyph.x > 0 && glyph.x < 320)).toBe(
      true,
    )
    expect(layout.notes[1].active).toBe(true)
  })

  it.each([
    [36, -2, '15vb'],
    [48, -1, '8vb'],
    [60, 0, null],
    [84, 1, '8va'],
  ] as const)(
    'uses an annotated octave clef to keep MIDI %s legible',
    (midi, octaveShift, octaveLabel) => {
      const layout = layoutRunnerNotation([
        note({ startMidi: midi, endMidi: midi }),
      ])

      expect(layout.staff.octaveShift).toBe(octaveShift)
      expect(layout.staff.octaveLabel).toBe(octaveLabel)
      expect(layout.notes[0].writtenEndStep).toBeGreaterThanOrEqual(-1)
      expect(layout.notes[0].writtenEndStep).toBeLessThanOrEqual(13)
    },
  )

  it('fits the supported pitch span above the label at every shared size', () => {
    for (const height of [128, 184, 256]) {
      for (let midi = 36; midi <= 84; midi += 1) {
        const layout = layoutRunnerNotation(
          [note({ startMidi: midi, endMidi: midi })],
          { width: height === 256 ? 512 : 320, height },
        )
        const glyph = layout.notes[0]
        const inkYs = [glyph.startY, glyph.endY, ...glyph.ledgerLineYs]

        expect(Math.min(...inkYs), `${midi} at ${height}px`).toBeGreaterThan(7)
        expect(Math.max(...inkYs), `${midi} at ${height}px`).toBeLessThan(
          layout.labelY - 16,
        )
      }
    }
  })

  it('clamps fill without letting nonfinite progress into render geometry', () => {
    expect(clampRunnerNotationFill(-1)).toBe(0)
    expect(clampRunnerNotationFill(0.4)).toBe(0.4)
    expect(clampRunnerNotationFill(2)).toBe(1)
    expect(clampRunnerNotationFill(Number.NaN)).toBe(0)
  })
})
