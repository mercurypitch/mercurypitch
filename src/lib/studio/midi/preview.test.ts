// Studio MIDI preview tests — a clip draws only the notes its window plays, by start; a piano clip's rows fit its pitches with a semitone of air, seven rows at the fewest; a drum clip draws a row per part of the kit it plays, cymbals on top and the kick at the foot; the same sequence and window give the same object; and a draw finds the first note still sounding at a tick.
import { describe, expect, it } from 'vitest'
import type { StudioNote, StudioSequence } from '../model/types'
import { studioNotePreview, studioPreviewFirst } from './preview'

const note = (
  id: number,
  pitch: number,
  startTick: number,
  lengthTicks = 240,
  velocity = 0.8,
): StudioNote => ({ id, pitch, startTick, lengthTicks, velocity })

const sequence = (notes: StudioNote[]): Pick<StudioSequence, 'notes'> => ({
  notes,
})

const WINDOW = { startTick: 960, endTick: 4800 }

describe('studioNotePreview on a piano lane', () => {
  it('draws only the notes the window plays, in the order they start', () => {
    // Arrange: one before the window, one on its end, two inside out of order.
    const preview = studioNotePreview(
      sequence([
        note(1, 60, 480),
        note(2, 64, 2000),
        note(3, 62, 960),
        note(4, 65, 4800),
      ]),
      WINDOW,
      'piano',
    )

    // Assert
    expect(preview.notes.map((each) => each.start)).toEqual([960, 2000])
  })

  it('fits its rows to the pitches it plays, a semitone of air above and below', () => {
    // Arrange: an octave and a half, C4 to F5.
    const preview = studioNotePreview(
      sequence([note(1, 60, 1000), note(2, 77, 1200, 480, 0.5)]),
      WINDOW,
      'piano',
    )

    // Assert: rows F#5 down to B3; F5 on the second row, C4 one above the foot.
    expect(preview.rows).toBe(20)
    expect(preview.notes.map((each) => each.row).sort()).toEqual([1, 18])
    expect(preview.notes[1]).toEqual({
      start: 1200,
      end: 1680,
      row: 1,
      velocity: 0.5,
    })
  })

  it('shows seven rows at the fewest, the note in the middle', () => {
    const preview = studioNotePreview(
      sequence([note(1, 60, 1000)]),
      WINDOW,
      'piano',
    )

    expect(preview.rows).toBe(7)
    expect(preview.notes[0].row).toBe(3)
  })
})

describe('studioNotePreview on a drum lane', () => {
  it('draws a row per part of the kit it plays: hats on top, then the snare, the kick at the foot', () => {
    // Arrange: closed hat 42, snare 38 and kick 36; no tom or other percussion.
    const preview = studioNotePreview(
      sequence([note(1, 36, 1000), note(2, 42, 1000), note(3, 38, 1480)]),
      WINDOW,
      'drums',
    )

    // Assert
    expect(preview.rows).toBe(3)
    const rowOf = (start: number, row: number) =>
      preview.notes.some((each) => each.start === start && each.row === row)
    expect(rowOf(1000, 0)).toBe(true)
    expect(rowOf(1000, 2)).toBe(true)
    expect(rowOf(1480, 1)).toBe(true)
  })

  it('puts a tom, and a key outside General MIDI, on the percussion row between the cymbals and the snare', () => {
    const preview = studioNotePreview(
      sequence([
        note(1, 49, 1000),
        note(2, 45, 1100),
        note(3, 20, 1200),
        note(4, 38, 1300),
      ]),
      WINDOW,
      'drums',
    )

    expect(preview.rows).toBe(3)
    expect(preview.notes.map((each) => each.row)).toEqual([0, 1, 1, 2])
  })
})

describe('the preview kept', () => {
  it('gives the same object for the same sequence, window and sound, and a new one for an edited sequence', () => {
    // Arrange
    const first = sequence([note(1, 60, 1000)])
    const edited = sequence([note(1, 61, 1000)])

    // Act
    const once = studioNotePreview(first, WINDOW, 'piano')
    const again = studioNotePreview(first, { ...WINDOW }, 'piano')
    const asDrums = studioNotePreview(first, WINDOW, 'drums')
    const afterEdit = studioNotePreview(edited, WINDOW, 'piano')

    // Assert
    expect(again).toBe(once)
    expect(asDrums).not.toBe(once)
    expect(afterEdit).not.toBe(once)
  })
})

describe('studioPreviewFirst', () => {
  it('finds the first note that can still sound at a tick, stepping back by the longest note', () => {
    // Arrange: notes every 100 ticks from 1000, the longest 350 ticks.
    const preview = studioNotePreview(
      sequence([
        note(1, 60, 1000, 100),
        note(2, 60, 1100, 350),
        note(3, 60, 1200, 100),
        note(4, 60, 1300, 100),
        note(5, 60, 1400, 100),
      ]),
      WINDOW,
      'piano',
    )

    // Act + Assert: from 1500, a note from 1150 on may sound: index 2.
    expect(studioPreviewFirst(preview, 1500)).toBe(2)
    expect(studioPreviewFirst(preview, 0)).toBe(0)
    expect(studioPreviewFirst(preview, 9000)).toBe(5)
  })
})
