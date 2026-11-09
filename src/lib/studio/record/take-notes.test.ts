// Studio take notes tests — a take's notes land in ticks from its first sample at the song's tempo, only those it captured and none past its end; the log keeps each note's sound as it started and stopped, its velocity as the port gave it to 4 decimals; and a take's sequence covers its whole audio, its next id past its notes'.
import { describe, expect, it } from 'vitest'
import { validateStudioSequence } from '../model/validation'
import { createStudioNoteLog, studioNoteVelocity, studioTakeNotes, studioTakeSequence, } from './take-notes'

/** A take whose first sample was captured at 1.1 s, and which ran 2 s. */
const TAKE = { capturedFrom: 1.1, seconds: 2 }
/** 120 bpm: 1920 ticks a second at 960 PPQ. */
const BPM = 120

describe('studioTakeNotes', () => {
  it("places each note in ticks from the take's first sample, numbered from 1", () => {
    // Arrange
    const played = [
      { midi: 60, velocity: 0.7874, start: 1.6, end: 1.85 },
      { midi: 64, velocity: 0.5, start: 1.7, end: 1.8 },
    ]

    // Act
    const notes = studioTakeNotes(played, TAKE, BPM)

    // Assert: half a second in is tick 960, a quarter second 480 ticks long.
    expect(notes).toEqual([
      { id: 1, pitch: 60, startTick: 960, lengthTicks: 480, velocity: 0.7874 },
      { id: 2, pitch: 64, startTick: 1152, lengthTicks: 192, velocity: 0.5 },
    ])
  })

  it('keeps only the notes the take captured, and ends a held one with the take', () => {
    // Arrange
    const played = [
      { midi: 59, velocity: 0.7, start: 1.0, end: 1.3 },
      { midi: 62, velocity: 0.6, start: 2.9, end: null },
      { midi: 64, velocity: 0.5, start: 3.1, end: 3.2 },
    ]

    // Act
    const notes = studioTakeNotes(played, TAKE, BPM)

    // Assert: from 1.8 s in to the take's end at 2 s.
    expect(notes).toEqual([
      {
        id: 1,
        pitch: 62,
        startTick: Math.round(1.8 * 1920),
        lengthTicks: 2 * 1920 - Math.round(1.8 * 1920),
        velocity: 0.6,
      },
    ])
  })

  it('gives a note shorter than a tick one tick', () => {
    // Act
    const [note] = studioTakeNotes(
      [{ midi: 60, velocity: 1, start: 1.5, end: 1.5 }],
      TAKE,
      BPM,
    )

    // Assert
    expect(note.lengthTicks).toBe(1)
  })
})

describe('createStudioNoteLog', () => {
  it('logs each voice as it starts and stops, with its velocity as the port gave it', () => {
    // Arrange
    const log = createStudioNoteLog()

    // Act
    log.started('a', 60, 1, 2)
    log.started('b', 64, 100 / 127, 2.1)
    log.stopped('a', 2.4)
    log.stopped('unknown', 2.5)

    // Assert
    expect(log.notes()).toEqual([
      { midi: 60, velocity: 1, start: 2, end: 2.4 },
      { midi: 64, velocity: 0.7874, start: 2.1, end: null },
    ])
  })
})

describe('studioNoteVelocity', () => {
  it('keeps 4 decimals, above 0 and up to 1, and makes a broken value full', () => {
    expect(studioNoteVelocity(0.123456)).toBe(0.1235)
    expect(studioNoteVelocity(0)).toBe(0.0001)
    expect(studioNoteVelocity(1.2)).toBe(1)
    expect(studioNoteVelocity(Number.NaN)).toBe(1)
  })
})

describe('studioTakeSequence', () => {
  it("covers the take's whole audio and hands out ids past its notes'", () => {
    // Arrange
    const notes = studioTakeNotes(
      [{ midi: 60, velocity: 0.5, start: 1.6, end: 1.85 }],
      TAKE,
      BPM,
    )

    // Act: 96001 frames are two seconds and a frame, so 3841 ticks hold them.
    const sequence = studioTakeSequence({
      id: 'sequence-1',
      notes,
      tempoBpm: BPM,
      frames: 96_001,
    })

    // Assert
    expect(sequence).toEqual({
      id: 'sequence-1',
      ppq: 960,
      tempoBpm: BPM,
      lengthTicks: 3841,
      nextNoteId: 2,
      notes,
    })
    expect(validateStudioSequence(sequence)).toEqual(sequence)
  })

  it('makes an empty take a valid empty sequence', () => {
    // Act
    const sequence = studioTakeSequence({
      id: 'sequence-1',
      notes: [],
      tempoBpm: BPM,
      frames: 48_000,
    })

    // Assert
    expect(sequence).toMatchObject({ lengthTicks: 1920, nextNoteId: 1 })
    expect(validateStudioSequence(sequence)).toEqual(sequence)
  })
})
