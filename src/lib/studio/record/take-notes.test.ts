// Studio take notes tests — a take's notes land on the song as its audio does, only those it captured and none past its end; the log keeps each note's sound as it started and stopped, its velocity as MIDI's; and notes read back from storage keep only whole ones.
import { describe, expect, it } from 'vitest'
import { createStudioNoteLog, sanitizeStudioTakeNotes, studioTakeNotes, } from './take-notes'

const RATE = 48000
/** A take whose first sample, captured at 1.1 s, lands on song frame 96000, and ran 2 s. */
const TAKE = { heardFirst: 96_000, capturedFrom: 1.1, seconds: 2 }

describe('studioTakeNotes', () => {
  it('places each note on the song as the take places its audio', () => {
    // Arrange
    const played = [{ midi: 60, velocity: 100, start: 1.6, end: 1.85 }]

    // Act
    const notes = studioTakeNotes(played, TAKE)

    // Assert: half a second into the take is half a second past heardFirst.
    expect(notes).toEqual([
      {
        midi: 60,
        velocity: 100,
        startFrame: 96_000 + 0.5 * RATE,
        endFrame: 96_000 + 0.75 * RATE,
      },
    ])
  })

  it('keeps only the notes the take captured, and ends a held one with the take', () => {
    // Arrange
    const played = [
      { midi: 59, velocity: 90, start: 1.0, end: 1.3 },
      { midi: 62, velocity: 80, start: 2.9, end: null },
      { midi: 64, velocity: 70, start: 3.1, end: 3.2 },
    ]

    // Act
    const notes = studioTakeNotes(played, TAKE)

    // Assert
    expect(notes).toEqual([
      {
        midi: 62,
        velocity: 80,
        startFrame: 96_000 + Math.round(1.8 * RATE),
        endFrame: 96_000 + 2 * RATE,
      },
    ])
  })
})

describe('createStudioNoteLog', () => {
  it('logs each voice as it starts and stops, with its velocity as MIDI gives it', () => {
    // Arrange
    const log = createStudioNoteLog()

    // Act
    log.started('a', 60, 1, 2)
    log.started('b', 64, 0.5, 2.1)
    log.stopped('a', 2.4)
    log.stopped('unknown', 2.5)

    // Assert
    expect(log.notes()).toEqual([
      { midi: 60, velocity: 127, start: 2, end: 2.4 },
      { midi: 64, velocity: 64, start: 2.1, end: null },
    ])
  })
})

describe('sanitizeStudioTakeNotes', () => {
  it('keeps whole notes and leaves out the rest', () => {
    // Arrange
    const stored = [
      { midi: 60, velocity: 100, startFrame: 10, endFrame: 20 },
      { midi: 128, velocity: 100, startFrame: 10, endFrame: 20 },
      { midi: 61, velocity: 0, startFrame: 10, endFrame: 20 },
      { midi: 62, velocity: 90, startFrame: 30, endFrame: 30 },
      'not a note',
    ]

    // Act, Assert
    expect(sanitizeStudioTakeNotes(stored)).toEqual([
      { midi: 60, velocity: 100, startFrame: 10, endFrame: 20 },
    ])
    expect(sanitizeStudioTakeNotes(null)).toEqual([])
  })
})
