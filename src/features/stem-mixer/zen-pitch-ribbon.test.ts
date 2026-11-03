import { describe, expect, it } from 'vitest'
import type { RibbonNote } from '@/features/stem-mixer/zen-pitch-ribbon'
import { judgeSinger, midiToRibbonY, notesInWindow, RIBBON_NOW_RATIO, RIBBON_TOLERANCE_CENTS, ribbonBand, targetNoteAt, timeToX, } from '@/features/stem-mixer/zen-pitch-ribbon'
import { midiToFreq } from '@/lib/scale-data'

const note = (
  startBeat: number,
  endBeat: number,
  midi: number,
): RibbonNote => ({
  startBeat,
  endBeat,
  midi,
})

describe('zen pitch ribbon — window and geometry', () => {
  it('selects only notes overlapping the window', () => {
    const notes = [note(0, 1, 60), note(2, 3, 62), note(10, 11, 64)]
    expect(notesInWindow(notes, 1.5, 4)).toEqual([note(2, 3, 62)])
    expect(notesInWindow(notes, 0.5, 2.5)).toHaveLength(2)
    expect(notesInWindow(notes, 5, 9)).toHaveLength(0)
  })

  it('pads the band and enforces a minimum span', () => {
    const flat = ribbonBand([note(0, 1, 60)])!
    expect(flat.maxMidi - flat.minMidi).toBeGreaterThanOrEqual(10)
    expect(flat.minMidi).toBeLessThan(60)
    expect(flat.maxMidi).toBeGreaterThan(60)

    const wide = ribbonBand([note(0, 1, 50), note(1, 2, 70)])!
    expect(wide.minMidi).toBe(48)
    expect(wide.maxMidi).toBe(72)

    expect(ribbonBand([])).toBeNull()
  })

  it('maps time to x with the now marker at the fixed ratio', () => {
    // window −1.5..+5.5 around now=10 → now sits at RIBBON_NOW_RATIO
    const x = timeToX(10, 8.5, 15.5, 700)
    expect(x / 700).toBeCloseTo(RIBBON_NOW_RATIO, 5)
  })

  it('maps higher midi to higher (smaller y) positions, clamped', () => {
    const band = { minMidi: 50, maxMidi: 70 }
    const low = midiToRibbonY(50, band, 56)
    const high = midiToRibbonY(70, band, 56)
    expect(high).toBeLessThan(low)
    expect(midiToRibbonY(40, band, 56)).toBe(low)
    expect(midiToRibbonY(90, band, 56)).toBe(high)
  })

  it('finds the target note under the playhead (end-exclusive)', () => {
    const notes = [note(0, 1, 60), note(1, 2, 62)]
    expect(targetNoteAt(notes, 0.5)?.midi).toBe(60)
    expect(targetNoteAt(notes, 1)?.midi).toBe(62)
    expect(targetNoteAt(notes, 2)).toBeNull()
  })
})

describe('zen pitch ribbon — singer judgement', () => {
  const target = note(0, 1, 60)

  it('no detected pitch → silent, never judged', () => {
    expect(judgeSinger(0, target).state).toBe('silent')
    expect(judgeSinger(-1, null).state).toBe('silent')
  })

  it('singing with no target → free (violet, not red)', () => {
    const reading = judgeSinger(440, null)
    expect(reading.state).toBe('free')
    expect(reading.displayMidi).toBeCloseTo(69, 5)
    expect(reading.centsOff).toBeNull()
  })

  it('on the note → hit, and exactly at tolerance still counts', () => {
    expect(judgeSinger(midiToFreq(60), target).state).toBe('hit')
    const atEdge = midiToFreq(60) * Math.pow(2, RIBBON_TOLERANCE_CENTS / 1200)
    expect(judgeSinger(atEdge, target).state).toBe('hit')
  })

  it('past tolerance → off', () => {
    const off = midiToFreq(60) * Math.pow(2, 120 / 1200)
    const reading = judgeSinger(off, target)
    expect(reading.state).toBe('off')
    expect(Math.abs(reading.centsOff!)).toBeCloseTo(120, 0)
  })

  it('judges octave-agnostically and folds the display to the target', () => {
    // Singing exactly one octave below the target is a hit (like the score)
    const octaveDown = judgeSinger(midiToFreq(48), target)
    expect(octaveDown.state).toBe('hit')
    expect(octaveDown.displayMidi).toBeCloseTo(60, 5)
    expect(octaveDown.centsOff).toBeCloseTo(0, 5)
  })
})
