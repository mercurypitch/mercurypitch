// Studio MIDI notes tests — each edit returns a new sequence and the notes then selected, never changing what it was given: a note added takes the next id and a deleted one's id stays spent; a move keeps the selection inside the clip's window and on the keyboard as a group; resize keeps a tick at least; velocities stay above 0 and to 4 decimals; transpose keeps a chord's shape at the keyboard's edge; quantize snaps starts to the grid and its offset, kept in the window; duplicate lands right after the selection; copy and paste keep the notes' shape from any tick; a full sequence takes no more; and the selection helpers find a window's notes, a marquee's and their bounds.
import { describe, expect, it } from 'vitest'
import type { StudioNote, StudioSequence } from '../model/types'
import { validateStudioSequence } from '../model/validation'
import { STUDIO_MAX_SEQUENCE_NOTES } from '../model/validation-midi'
import { addStudioNote, copyStudioNotes, deleteStudioNotes, duplicateStudioNotes, moveStudioNotes, pasteStudioNotes, quantizeStudioNotes, resizeStudioNotes, scaleStudioNoteVelocity, setStudioNoteVelocity, studioNotesInRange, studioNotesInWindow, studioNoteVelocity, studioSelectionBounds, transposeStudioNotes, } from './notes'

/** C, E and G: a chord on beat 2, and a G a beat later, at 120 bpm's 960 ticks a beat. */
const NOTES: readonly StudioNote[] = [
  { id: 1, pitch: 60, startTick: 960, lengthTicks: 480, velocity: 0.8 },
  { id: 2, pitch: 64, startTick: 960, lengthTicks: 480, velocity: 0.6 },
  { id: 3, pitch: 67, startTick: 960, lengthTicks: 480, velocity: 0.5 },
  { id: 4, pitch: 67, startTick: 1920, lengthTicks: 960, velocity: 0.7 },
]

function sequence(): StudioSequence {
  return Object.freeze({
    id: 'sequence-1',
    ppq: 960,
    tempoBpm: 120,
    lengthTicks: 3840,
    nextNoteId: 6,
    notes: Object.freeze(NOTES.map((note) => Object.freeze({ ...note }))),
  }) as StudioSequence
}

/** The window of a clip over the sequence's second to fourth beat. */
const WINDOW = { startTick: 480, endTick: 3360 }

const byId = (seq: StudioSequence, id: number) =>
  seq.notes.find((note) => note.id === id)

describe('addStudioNote', () => {
  it('gives a drawn note the next id, selects it alone, and keeps it as a sequence does', () => {
    // Act
    const added = addStudioNote(sequence(), {
      pitch: 72,
      startTick: 100.4,
      lengthTicks: 0,
      velocity: 0.123456,
      releaseVelocity: 0.5,
      channel: 0,
    })!

    // Assert
    expect(added.selection).toEqual([6])
    expect(added.sequence.nextNoteId).toBe(7)
    expect(byId(added.sequence, 6)).toEqual({
      id: 6,
      pitch: 72,
      startTick: 100,
      lengthTicks: 1,
      velocity: 0.1235,
    })
    expect(validateStudioSequence(added.sequence)).toEqual(added.sequence)
  })

  it('takes no note into a full sequence', () => {
    // Arrange
    const full = {
      ...sequence(),
      nextNoteId: STUDIO_MAX_SEQUENCE_NOTES + 1,
      notes: Array.from({ length: STUDIO_MAX_SEQUENCE_NOTES }, (_, index) => ({
        id: index + 1,
        pitch: 60,
        startTick: index,
        lengthTicks: 1,
        velocity: 0.5,
      })),
    }

    // Act, Assert
    expect(
      addStudioNote(full, {
        pitch: 60,
        startTick: 0,
        lengthTicks: 1,
        velocity: 0.5,
      }),
    ).toBeNull()
  })
})

describe('moveStudioNotes', () => {
  it('moves the selection later and higher, and nothing else', () => {
    // Act
    const moved = moveStudioNotes(sequence(), [1, 2], 240, 2, WINDOW)

    // Assert
    expect(moved.selection).toEqual([1, 2])
    expect(
      moved.sequence.notes.map((note) => [note.startTick, note.pitch]),
    ).toEqual([
      [1200, 62],
      [1200, 66],
      [960, 67],
      [1920, 67],
    ])
  })

  it("stops the whole selection at the window's edges, keeping its shape", () => {
    // Act: far earlier, and far later.
    const early = moveStudioNotes(sequence(), [1, 4], -5000, 0, WINDOW)
    const late = moveStudioNotes(sequence(), [1, 4], 5000, 0, WINDOW)

    // Assert: the earliest starts on the window's first tick, the latest on its last.
    expect([
      byId(early.sequence, 1)?.startTick,
      byId(early.sequence, 4)?.startTick,
    ]).toEqual([480, 1440])
    expect([
      byId(late.sequence, 1)?.startTick,
      byId(late.sequence, 4)?.startTick,
    ]).toEqual([2399, 3359])
  })

  it('stops the whole selection at the ends of the keyboard', () => {
    // Act
    const high = moveStudioNotes(sequence(), [1, 3], 0, 100, WINDOW)
    const low = moveStudioNotes(sequence(), [1, 3], 0, -100, WINDOW)

    // Assert
    expect([
      byId(high.sequence, 1)?.pitch,
      byId(high.sequence, 3)?.pitch,
    ]).toEqual([120, 127])
    expect([
      byId(low.sequence, 1)?.pitch,
      byId(low.sequence, 3)?.pitch,
    ]).toEqual([0, 7])
  })

  it('hands the sequence back as it is for a move that goes nowhere, or no selection', () => {
    // Arrange
    const start = sequence()

    // Act, Assert
    expect(moveStudioNotes(start, [1], 0, 0, WINDOW).sequence).toBe(start)
    expect(moveStudioNotes(start, [99], 240, 1, WINDOW)).toEqual({
      sequence: start,
      selection: [],
    })
  })
})

describe('resizeStudioNotes', () => {
  it('lengthens and shortens each selected note, to a tick at the least', () => {
    // Act
    const longer = resizeStudioNotes(sequence(), [1, 4], 120)
    const shorter = resizeStudioNotes(sequence(), [1, 4], -600)

    // Assert
    expect([
      byId(longer.sequence, 1)?.lengthTicks,
      byId(longer.sequence, 4)?.lengthTicks,
    ]).toEqual([600, 1080])
    expect([
      byId(shorter.sequence, 1)?.lengthTicks,
      byId(shorter.sequence, 4)?.lengthTicks,
    ]).toEqual([1, 360])
  })
})

describe('deleteStudioNotes', () => {
  it('removes the selected notes and keeps their ids spent', () => {
    // Act
    const deleted = deleteStudioNotes(sequence(), [2, 3])
    const added = addStudioNote(deleted.sequence, {
      pitch: 60,
      startTick: 0,
      lengthTicks: 10,
      velocity: 0.5,
    })!

    // Assert
    expect(deleted.selection).toEqual([])
    expect(deleted.sequence.notes.map((note) => note.id)).toEqual([1, 4])
    expect(added.selection).toEqual([6])
  })
})

describe('velocity', () => {
  it('sets each selected note to one velocity, kept above 0 and to 4 decimals', () => {
    // Act
    const set = setStudioNoteVelocity(sequence(), [1, 2], 0.33333)
    const silent = setStudioNoteVelocity(sequence(), [1], 0)

    // Assert
    expect([
      byId(set.sequence, 1)?.velocity,
      byId(set.sequence, 2)?.velocity,
    ]).toEqual([0.3333, 0.3333])
    expect(byId(silent.sequence, 1)?.velocity).toBe(0.0001)
  })

  it('scales each selected velocity, up to 1 at the most', () => {
    // Act
    const louder = scaleStudioNoteVelocity(sequence(), [1, 3], 1.5)

    // Assert: 0.8 reaches the top; 0.5 goes to 0.75.
    expect([
      byId(louder.sequence, 1)?.velocity,
      byId(louder.sequence, 3)?.velocity,
    ]).toEqual([1, 0.75])
  })

  it('keeps a velocity as a sequence does', () => {
    expect(studioNoteVelocity(0.123456)).toBe(0.1235)
    expect(studioNoteVelocity(-1)).toBe(0.0001)
    expect(studioNoteVelocity(Number.NaN)).toBe(1)
  })
})

describe('transposeStudioNotes', () => {
  it('moves the selection by semitones and octaves, a chord keeping its shape at the top of the keyboard', () => {
    // Act
    const up = transposeStudioNotes(sequence(), [1, 2, 3], 1)
    const octaveDown = transposeStudioNotes(sequence(), [1, 2, 3], -12)
    const pastTheTop = transposeStudioNotes(sequence(), [1, 2, 3], 72)

    // Assert
    expect(up.sequence.notes.slice(0, 3).map((note) => note.pitch)).toEqual([
      61, 65, 68,
    ])
    expect(
      octaveDown.sequence.notes.slice(0, 3).map((note) => note.pitch),
    ).toEqual([48, 52, 55])
    expect(
      pastTheTop.sequence.notes.slice(0, 3).map((note) => note.pitch),
    ).toEqual([120, 124, 127])
  })
})

describe('quantizeStudioNotes', () => {
  it("snaps each selected start to the grid's nearest line, its lines on the offset given", () => {
    // Arrange: starts a little off the eighth-note grid.
    const loose = {
      ...sequence(),
      notes: [
        { id: 1, pitch: 60, startTick: 1000, lengthTicks: 100, velocity: 0.5 },
        { id: 2, pitch: 62, startTick: 1250, lengthTicks: 100, velocity: 0.5 },
      ],
    }

    // Act
    const plain = quantizeStudioNotes(loose, [1, 2], { ticks: 480 })
    const shifted = quantizeStudioNotes(loose, [1, 2], {
      ticks: 480,
      offset: 100,
    })

    // Assert
    expect(plain.sequence.notes.map((note) => note.startTick)).toEqual([
      960, 1440,
    ])
    expect(shifted.sequence.notes.map((note) => note.startTick)).toEqual([
      1060, 1060,
    ])
    expect(plain.sequence.notes.map((note) => note.lengthTicks)).toEqual([
      100, 100,
    ])
  })

  it('keeps a snapped start inside the window', () => {
    // Arrange: a note just inside a window that opens on tick 300, nearer
    // the grid's line on tick 0 than the one on 960.
    const edge = {
      ...sequence(),
      notes: [
        { id: 1, pitch: 60, startTick: 310, lengthTicks: 100, velocity: 0.5 },
      ],
    }

    // Act
    const snapped = quantizeStudioNotes(
      edge,
      [1],
      { ticks: 960 },
      {
        startTick: 300,
        endTick: 3360,
      },
    )

    // Assert
    expect(snapped.sequence.notes[0].startTick).toBe(300)
  })
})

describe('duplicateStudioNotes', () => {
  it('puts copies right after the selection, by the time it spans, with new ids, selected', () => {
    // Act: the chord and the G span ticks 960 to 2880.
    const duplicated = duplicateStudioNotes(sequence(), [1, 4])!

    // Assert
    expect(duplicated.selection).toEqual([6, 7])
    expect(duplicated.sequence.nextNoteId).toBe(8)
    expect(duplicated.sequence.notes.slice(4)).toEqual([
      { ...NOTES[0], id: 6, startTick: 960 + 1920 },
      { ...NOTES[3], id: 7, startTick: 1920 + 1920 },
    ])
  })
})

describe('copyStudioNotes and pasteStudioNotes', () => {
  it('pastes copied notes from any tick with their shape and new ids, selected', () => {
    // Arrange
    const clipboard = copyStudioNotes(sequence(), [4, 2])

    // Act
    const pasted = pasteStudioNotes(sequence(), clipboard, 2400)!

    // Assert
    expect(clipboard.notes.map((note) => [note.startTick, note.pitch])).toEqual(
      [
        [0, 64],
        [960, 67],
      ],
    )
    expect(pasted.selection).toEqual([6, 7])
    expect(pasted.sequence.notes.slice(4)).toEqual([
      { ...NOTES[1], id: 6, startTick: 2400 },
      { ...NOTES[3], id: 7, startTick: 3360 },
    ])
    expect(validateStudioSequence(pasted.sequence)).toEqual(pasted.sequence)
  })
})

describe('selection helpers', () => {
  it('finds the notes a window plays, a marquee holds, and where a selection sits', () => {
    // Arrange
    const narrow = { startTick: 1000, endTick: 3000 }

    // Act, Assert: a window or a marquee ends before its last tick.
    expect(studioNotesInWindow(sequence(), narrow)).toEqual([4])
    expect(
      studioNotesInWindow(sequence(), { startTick: 960, endTick: 1920 }),
    ).toEqual([1, 2, 3])
    expect(
      studioNotesInRange(sequence(), {
        startTick: 1300,
        endTick: 2000,
        lowPitch: 62,
        highPitch: 67,
      }),
    ).toEqual([2, 3, 4])
    expect(
      studioNotesInRange(sequence(), {
        startTick: 0,
        endTick: 960,
        lowPitch: 0,
        highPitch: 127,
      }),
    ).toEqual([])
    expect(studioSelectionBounds(sequence(), [1, 4])).toEqual({
      startTick: 960,
      endTick: 2880,
      lowPitch: 60,
      highPitch: 67,
    })
    expect(studioSelectionBounds(sequence(), [])).toBeNull()
  })
})
