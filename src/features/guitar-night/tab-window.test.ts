// Tab-window tests keep the tab view a moving window, not a dump of the whole score.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { TAB_PLAYHEAD_RATIO, tabWindowEntries } from './GuitarNightStage'

function note(startBeat: number, fret = 0): GuitarNote {
  return {
    id: `note-${startBeat}`,
    midi: 40 + fret,
    noteName: 'E2',
    stringIndex: 5,
    fret,
    startBeat,
    duration: 1,
    targetFreq: 82.4,
  }
}

const WINDOW = 8

describe('tabWindowEntries', () => {
  it('shows only the notes inside the moving window', () => {
    const notes = Array.from({ length: 60 }, (_, index) => note(index))

    const visible = tabWindowEntries(notes, 20, WINDOW)

    expect(visible.length).toBeLessThan(notes.length)
    expect(
      visible.every((entry) => Math.abs(entry.note.startBeat - 20) < WINDOW),
    ).toBe(true)
  })

  it('parks the window at the start of the score before playback', () => {
    const notes = [note(0), note(1), note(40)]

    const visible = tabWindowEntries(notes, null, WINDOW)

    expect(visible.map((entry) => entry.note.startBeat)).toEqual([0, 1])
  })

  it('places the played note on the now-line', () => {
    const visible = tabWindowEntries([note(12)], 12, WINDOW)

    expect(visible[0].offsetPercent).toBeCloseTo(TAB_PLAYHEAD_RATIO * 100, 5)
    expect(visible[0].isActive).toBe(true)
  })

  it('moves a note leftwards as the song advances', () => {
    const early = tabWindowEntries([note(12)], 11, WINDOW)[0]
    const later = tabWindowEntries([note(12)], 13, WINDOW)[0]

    expect(later.offsetPercent).toBeLessThan(early.offsetPercent)
  })

  it('marks a finished note as past rather than dropping it immediately', () => {
    const visible = tabWindowEntries([note(10)], 12, WINDOW)

    expect(visible[0].isPast).toBe(true)
    expect(visible[0].isActive).toBe(false)
  })

  it('keeps a sustained note visible while it is still sounding', () => {
    const sustained: GuitarNote = { ...note(10), duration: 6 }

    const visible = tabWindowEntries([sustained], 14, WINDOW)

    expect(visible).toHaveLength(1)
    expect(visible[0].isActive).toBe(true)
  })
})
