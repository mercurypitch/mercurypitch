// ============================================================
// Playback grid follows the melody — load alignment + octave shift
// ============================================================
//
// Regression for the singing-stage bug where loading a library melody
// changed only the notes: the reference grid kept the sidebar's previous
// key/octave, so a G4 scale melody over a C3 grid left the top half of the
// stage without note rows, and the octave buttons rebuilt the grid from
// stale UI signals.

import { beforeEach, describe, expect, it } from 'vitest'
import { currentScale, getCurrentItems, getCurrentOctave, loadMelody, refreshScale, restoreMelody, shiftMelodyOctave, } from '@/stores/melody-store'
import type { MelodyData, MelodyItem, MelodyNote } from '@/types'

const item = (midi: number, startBeat: number): MelodyItem => ({
  id: startBeat,
  note: {
    midi,
    name: 'C',
    octave: Math.floor(midi / 12) - 1,
    freq: 440 * Math.pow(2, (midi - 69) / 12),
  } as MelodyNote,
  duration: 1,
  startBeat,
})

const melody = (overrides: Partial<MelodyData>): MelodyData => ({
  id: 'grid-sync-test',
  name: 'Grid sync test',
  bpm: 80,
  key: 'G',
  scaleType: 'major',
  octave: 4,
  items: [item(67, 0), item(69, 1)],
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
})

const rootRow = () => currentScale()[currentScale().length - 1]

const load = (data: MelodyData): void => {
  restoreMelody(data)
  const loaded = loadMelody(data.id)
  expect(loaded).not.toBeNull()
}

describe('loading a melody aligns the reference grid', () => {
  beforeEach(() => {
    // A deliberately mismatched grid, as after browsing with the sidebar.
    refreshScale('C', 3, 'major')
  })

  it('rebuilds the grid at the melody key, octave and scale type', () => {
    load(melody({ id: 'grid-sync-g4' }))
    const root = rootRow()
    expect(`${root.name}${root.octave}`).toBe('G4')
    expect(getCurrentOctave()).toBe(4)
    // G major carries F# — the type moved with the key.
    expect(currentScale().some((d) => d.name === 'F#')).toBe(true)
  })

  it('keeps the grid octave for melodies saved without one', () => {
    load(melody({ id: 'grid-sync-no-octave', key: 'D', octave: undefined }))
    const root = rootRow()
    expect(root.name).toBe('D')
    expect(getCurrentOctave()).toBe(3)
  })

  it('leaves the grid alone when the melody has no key metadata', () => {
    load(melody({ id: 'grid-sync-no-key', key: '', octave: 5 }))
    const root = rootRow()
    expect(`${root.name}${root.octave}`).toBe('C3')
  })
})

describe('shiftMelodyOctave', () => {
  beforeEach(() => {
    refreshScale('C', 3, 'major')
  })

  it('moves melody and grid together', () => {
    load(
      melody({
        id: 'grid-shift-up',
        key: 'C',
        octave: 3,
        items: [item(48, 0)],
      }),
    )
    expect(shiftMelodyOctave(1)).toBe(true)
    expect(getCurrentItems()[0].note.midi).toBe(60)
    expect(getCurrentItems()[0].note.octave).toBe(4)
    expect(getCurrentItems()[0].note.freq).toBeCloseTo(261.63, 1)
    expect(getCurrentOctave()).toBe(4)
  })

  it('rebuilds the grid from the tracked key and scale type, not UI state', () => {
    load(
      melody({
        id: 'grid-shift-key',
        key: 'G',
        scaleType: 'natural-minor',
        octave: 3,
        items: [item(55, 0)],
      }),
    )
    expect(shiftMelodyOctave(1)).toBe(true)
    const root = rootRow()
    expect(`${root.name}${root.octave}`).toBe('G4')
    // G natural minor includes A# — the type survived the shift.
    expect(currentScale().some((d) => d.name === 'A#')).toBe(true)
  })

  it('refuses to shift below the lowest allowed octave', () => {
    load(
      melody({
        id: 'grid-shift-low',
        key: 'C',
        octave: 1,
        items: [item(24, 0)],
      }),
    )
    expect(shiftMelodyOctave(-1)).toBe(false)
    expect(getCurrentItems()[0].note.midi).toBe(24)
    expect(getCurrentOctave()).toBe(1)
  })

  it('refuses to shift above the highest allowed octave', () => {
    load(
      melody({
        id: 'grid-shift-high',
        key: 'C',
        octave: 6,
        items: [item(84, 0)],
      }),
    )
    expect(shiftMelodyOctave(1)).toBe(false)
    expect(getCurrentItems()[0].note.midi).toBe(84)
    expect(getCurrentOctave()).toBe(6)
  })

  it('still moves the grid when the melody has no notes', () => {
    load(melody({ id: 'grid-shift-empty', key: 'C', octave: 3, items: [] }))
    expect(shiftMelodyOctave(1)).toBe(true)
    expect(getCurrentOctave()).toBe(4)
    expect(getCurrentItems()).toEqual([])
  })
})
