// Tab-window tests keep the tab view a moving window, not a dump of the whole score.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { buildStageNoteIndex, buildStageTabWindowIndex, guidePreviewBeat, neckWindow, stageEventContext, TAB_PLAYHEAD_RATIO, tabWindowEntries, } from './GuitarNightStage'

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
  const windowEntries = (
    notes: readonly GuitarNote[],
    playheadBeat: number | null,
  ) => tabWindowEntries(buildStageTabWindowIndex(notes), playheadBeat, WINDOW)

  it('shows only the notes inside the moving window', () => {
    const notes = Array.from({ length: 60 }, (_, index) => note(index))

    const visible = windowEntries(notes, 20)

    expect(visible.length).toBeLessThan(notes.length)
    expect(
      visible.every((entry) => Math.abs(entry.note.startBeat - 20) < WINDOW),
    ).toBe(true)
  })

  it('parks the window at the start of the score before playback', () => {
    const notes = [note(0), note(1), note(40)]

    const visible = windowEntries(notes, null)

    expect(visible.map((entry) => entry.note.startBeat)).toEqual([0, 1])
  })

  it('places the played note on the now-line', () => {
    const visible = windowEntries([note(12)], 12)

    expect(visible[0].offsetPercent).toBeCloseTo(TAB_PLAYHEAD_RATIO * 100, 5)
    expect(visible[0].isActive).toBe(true)
  })

  it('moves a note leftwards as the song advances', () => {
    const early = windowEntries([note(12)], 11)[0]
    const later = windowEntries([note(12)], 13)[0]

    expect(later.offsetPercent).toBeLessThan(early.offsetPercent)
  })

  it('marks a finished note as past rather than dropping it immediately', () => {
    const visible = windowEntries([note(10)], 12)

    expect(visible[0].isPast).toBe(true)
    expect(visible[0].isActive).toBe(false)
  })

  it('keeps a sustained note visible while it is still sounding', () => {
    const sustained: GuitarNote = { ...note(10), duration: 6 }

    const visible = windowEntries([sustained], 14)

    expect(visible).toHaveLength(1)
    expect(visible[0].isActive).toBe(true)
  })

  it('skips expired score regions even when one early note sustains throughout', () => {
    const score = [
      { ...note(0), id: 'whole-score-sustain', duration: 10_000 },
      ...Array.from({ length: 10_000 }, (_, index) => ({
        ...note(index),
        id: `short-${index}`,
        duration: 0.25,
      })),
    ]
    const compiled = buildStageTabWindowIndex(score)
    let indexedReads = 0
    const notes = new Proxy(compiled.notes, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property)) {
          indexedReads += 1
        }
        return Reflect.get(target, property, receiver)
      },
    })

    const visible = tabWindowEntries({ ...compiled, notes }, 9_500, WINDOW)

    expect(visible.map((entry) => entry.note.id)).toEqual([
      'whole-score-sustain',
      'short-9499',
      'short-9500',
      'short-9501',
      'short-9502',
      'short-9503',
      'short-9504',
      'short-9505',
      'short-9506',
    ])
    expect(indexedReads).toBeLessThan(100)
  })
})

describe('guidePreviewBeat', () => {
  it('rests just before a late first note instead of showing an empty runway', () => {
    expect(guidePreviewBeat([note(40), note(44)], null)).toBe(37.5)
  })

  it('keeps beat-zero notes in front of the visual now-line on a phone', () => {
    expect(guidePreviewBeat([note(0), note(4)], null)).toBe(-2.5)
  })

  it('never replaces the live musical playhead', () => {
    expect(guidePreviewBeat([note(40)], 12.5)).toBe(12.5)
  })

  it('has no preview without authored notes', () => {
    expect(guidePreviewBeat([], null)).toBeNull()
  })
})

describe('neckWindow', () => {
  it('centres its thirteen frets on the authored position instead of truncating the neck', () => {
    const visible = neckWindow([note(4, 21)], 2, 24)

    expect(visible.frets).toHaveLength(13)
    expect(visible.frets[0]).toBe(12)
    expect(visible.frets.at(-1)).toBe(24)
    expect(visible.nextNotes.map((item) => item.fret)).toEqual([21])
  })

  it('keeps every simultaneous active and upcoming target', () => {
    const activeA = { ...note(4, 17), id: 'active-a', duration: 2 }
    const activeB = {
      ...note(4.02, 19),
      id: 'active-b',
      stringIndex: 4,
      duration: 2,
    }
    const nextA = { ...note(8, 21), id: 'next-a' }
    const nextB = {
      ...note(8.03, 24),
      id: 'next-b',
      stringIndex: 3,
    }

    const current = neckWindow([activeA, activeB, nextA, nextB], 5, 24)
    const upcoming = neckWindow([activeA, activeB, nextA, nextB], 7, 24)

    expect(current.activeNotes.map((item) => item.id)).toEqual([
      'active-a',
      'active-b',
    ])
    expect(upcoming.nextNotes.map((item) => item.id)).toEqual([
      'next-a',
      'next-b',
    ])
  })
})

describe('stage note index', () => {
  it('groups authored chords while excluding backing notes', () => {
    const root = note(8, 3)
    const third = { ...note(8.03, 5), id: 'third', stringIndex: 4 }
    const backing = { ...note(8.01, 7), id: 'backing', isBacking: true }

    const index = buildStageNoteIndex([backing, third, root])
    const context = stageEventContext(index, 7)

    expect(index.events).toHaveLength(1)
    expect(context.nextNotes.map((item) => item.id)).toEqual([
      root.id,
      third.id,
    ])
  })

  it('finds every overlapping active note without rescanning a long score', () => {
    const sustained = { ...note(1, 7), id: 'sustained', duration: 10_000 }
    const score = [
      sustained,
      ...Array.from({ length: 10_000 }, (_, index) => note(index + 2, 3)),
    ]

    const context = stageEventContext(buildStageNoteIndex(score), 9_500.5)

    expect(context.activeNotes.map((item) => item.id)).toEqual([
      'sustained',
      'note-9500',
    ])
    expect(context.nextNotes.map((item) => item.id)).toEqual(['note-9501'])
  })
})
