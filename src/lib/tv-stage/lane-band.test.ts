// ============================================================
// TV stage lane band tests — the notes in view, and the band they sit in
// ============================================================
//
// The lane shows what the phone's ribbon shows, so its window and its band
// are held to the ribbon's own functions (stem-mixer/zen-pitch-ribbon.ts) on
// the same notes; the ease is checked as the ribbon's would move, a tenth of
// the way each sixtieth of a second, never a jump.

import { describe, expect, it } from 'vitest'
import { notesInWindow, RIBBON_AHEAD_SEC, RIBBON_BAND_EASE, RIBBON_BEHIND_SEC, RIBBON_NOW_RATIO, ribbonBand, } from '@/features/stem-mixer/zen-pitch-ribbon'
import type { LaneBand } from '@/lib/tv-stage/lane-band'
import { BAND_EASE, heldBand, LANE_AHEAD_SEC, LANE_BEHIND_SEC, LANE_NOW_RATIO, laneBand, noteAt, noteBand, notesInView, sortedNotes, } from '@/lib/tv-stage/lane-band'
import type { TvStageNote } from '@/lib/tv-stage/protocol'

const note = (t0: number, t1: number, midi: number): TvStageNote => ({
  t0,
  t1,
  midi,
})

/** A phrase of quarter-second notes from `from`, one for each MIDI number. */
const phrase = (from: number, midis: readonly number[]): TvStageNote[] =>
  midis.map((midi, index) =>
    note(from + index * 0.25, from + index * 0.25 + 0.2, midi),
  )

/** A band to within a millionth of a semitone: the ease is a weighted sum. */
const expectBand = (
  band: LaneBand | null,
  expected: { readonly low: number; readonly high: number },
): void => {
  expect(band?.low).toBeCloseTo(expected.low, 6)
  expect(band?.high).toBeCloseTo(expected.high, 6)
}

const asRibbon = (notes: readonly TvStageNote[]) =>
  notes.map((n) => ({ startBeat: n.t0, endBeat: n.t1, midi: n.midi }))

describe('the window', () => {
  it('is the ribbon’s: 1.5 s behind the now marker and 5.5 s ahead', () => {
    expect([LANE_BEHIND_SEC, LANE_AHEAD_SEC]).toEqual([
      RIBBON_BEHIND_SEC,
      RIBBON_AHEAD_SEC,
    ])
    expect(LANE_NOW_RATIO).toBe(RIBBON_NOW_RATIO)
  })

  it('shows the notes the ribbon shows, at every moment of a song', () => {
    const notes = [
      ...phrase(2, [60, 62, 64, 65]),
      note(4, 9.5, 67),
      ...phrase(12, [72, 71, 69]),
      note(20, 20.05, 60),
    ]
    const sorted = sortedNotes([...notes].reverse())

    for (let position = 0; position < 26; position += 0.1) {
      const shown = notesInView(sorted, position).map((n) => n.midi)
      const ribbon = notesInWindow(
        asRibbon(notes),
        position - RIBBON_BEHIND_SEC,
        position + RIBBON_AHEAD_SEC,
      ).map((n) => n.midi)
      expect(shown, `at ${position.toFixed(1)} s`).toEqual(ribbon)
    }
  })

  it('finds a long note that began before the window', () => {
    const sorted = sortedNotes([note(0, 30, 55), note(31, 32, 57)])

    expect(notesInView(sorted, 20).map((n) => n.midi)).toEqual([55])
  })

  it('finds the note sounding, ends excluded', () => {
    const sorted = sortedNotes([note(0, 1, 60), note(1, 2, 62)])

    expect(noteAt(sorted, 0.5)?.midi).toBe(60)
    expect(noteAt(sorted, 1)?.midi).toBe(62)
    expect(noteAt(sorted, 2)).toBeNull()
  })
})

describe('the band', () => {
  it('pads the notes’ range by two semitones, and widens a narrow one to ten, as the ribbon does', () => {
    const narrow = [note(0, 1, 60), note(1, 2, 62)]
    const wide = [note(0, 1, 50), note(1, 2, 70)]

    expect(noteBand(narrow)).toEqual({ low: 56, high: 66 })
    expect(noteBand(wide)).toEqual({ low: 48, high: 72 })
    for (const notes of [narrow, wide]) {
      const ribbon = ribbonBand(asRibbon(notes))
      expect(noteBand(notes)).toEqual({
        low: ribbon?.minMidi,
        high: ribbon?.maxMidi,
      })
    }
    expect(noteBand([])).toBeNull()
  })

  it('holds the last phrase’s band through a rest, as the ribbon does', () => {
    const sorted = sortedNotes([note(8, 10, 50), note(30, 31, 70)])

    expect(heldBand(sorted, 20)).toEqual({ low: 45, high: 55 })
    expectBand(laneBand(sorted.notes, 20), { low: 45, high: 55 })
  })

  it('starts the intro on the band the first phrase brings', () => {
    const band = laneBand([note(20, 21, 64)], 0)

    expect(band?.low).toBeCloseTo(59, 6)
    expect(band?.high).toBeCloseTo(69, 6)
  })

  it('eases at the ribbon’s rate', () => {
    expect(BAND_EASE).toBe(RIBBON_BAND_EASE)
  })

  it('eases into a new phrase a tenth of the way each sixtieth of a second, never jumping', () => {
    // A low phrase, then a high one: the high note comes into the window at
    // 5 s, 5.5 s before it starts, and the band moves from 16-26 to 19-42.
    const notes = [
      ...phrase(0, [20, 21, 22]),
      note(4, 9.9, 21),
      note(10.5, 11, 40),
    ]
    const before = laneBand(notes, 4.99)
    const target = noteBand([note(0, 1, 21), note(10.5, 11, 40)])

    let previous = before!
    let biggest = 0
    for (let step = 1; step <= 60; step += 1) {
      const band = laneBand(notes, 4.99 + step / 60)!
      biggest = Math.max(biggest, Math.abs(band.high - previous.high))
      previous = band
    }

    // About a tenth (the sum is cut off after 0.8 s, which leaves it a hair
    // over), and all the way there once 0.8 s have gone by.
    expectBand(before, { low: 16, high: 26 })
    expect(biggest).toBeGreaterThan(0)
    expect(biggest).toBeLessThanOrEqual(0.105 * (target!.high - 26))
    expectBand(previous, target!)
  })

  it('is none for a song with no notes', () => {
    expect(laneBand([], 3)).toBeNull()
  })
})
