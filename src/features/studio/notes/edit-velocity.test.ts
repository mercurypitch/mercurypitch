// Studio note velocity tests — a velocity reads from 1 to 127; a drag moves it in 127 steps, the value read being the value kept; a group moves by the same steps, each note stopping at 1 and 127 on its own; and a press takes a selected note's lollipop first, then the nearest head, within the pointer's reach of where the lane draws it.
import { describe, expect, it } from 'vitest'
import type { RollViewport } from '@/lib/roll-geometry'
import type { StudioNote } from '@/lib/studio/model/types'
import { noteVelocityValue, pickLollipop, stepStudioNoteVelocities, } from './edit-velocity'
import { velocityLaneY } from './velocity-lane'

/** One bar across 960 px: 4 ticks a pixel. */
const VIEW: RollViewport = {
  start: 0,
  end: 3840,
  minMidi: 48,
  maxMidi: 71,
  width: 960,
  height: 480,
}
/** A lane 82 px tall: 64 px from velocity 0 to 1. */
const LANE = 82

const note = (
  id: number,
  startTick: number,
  velocity: number,
  pitch = 60,
): StudioNote => ({ id, pitch, startTick, lengthTicks: 240, velocity })

describe('a velocity', () => {
  it('reads a velocity from 1 to 127, as a musician does', () => {
    expect([
      noteVelocityValue(0.7874),
      noteVelocityValue(1),
      noteVelocityValue(0.0001),
    ]).toEqual([100, 127, 1])
  })
})

describe('stepStudioNoteVelocities', () => {
  const sequence = {
    notes: [
      note(1, 0, 100 / 127),
      note(2, 240, 120 / 127),
      note(3, 480, 10 / 127),
    ],
    nextNoteId: 4,
  }

  it('moves every note it is given by the same steps, each stopping at 127 on its own', () => {
    // Act
    const edit = stepStudioNoteVelocities(sequence, [1, 2], 20)

    // Assert
    expect(
      edit.sequence.notes.map((each) => noteVelocityValue(each.velocity)),
    ).toEqual([120, 127, 10])
    expect(edit.selection).toEqual([1, 2])
  })

  it('keeps the value it shows: a step of 127, to 4 decimals', () => {
    const edit = stepStudioNoteVelocities(sequence, [3], -9)
    expect(edit.sequence.notes[2].velocity).toBe(0.0079)
    expect(noteVelocityValue(edit.sequence.notes[2].velocity)).toBe(1)
  })

  it('gives the same sequence back when nothing moves', () => {
    const loud = { notes: [note(1, 0, 1)], nextNoteId: 2 }
    expect(stepStudioNoteVelocities(sequence, [1], 0).sequence).toBe(sequence)
    expect(stepStudioNoteVelocities(sequence, [9], 5).sequence).toBe(sequence)
    expect(stepStudioNoteVelocities(loud, [1], 5).sequence).toBe(loud)
  })

  it('changes nothing it is given', () => {
    // Arrange
    const frozen = Object.freeze({
      ...sequence,
      notes: Object.freeze(
        sequence.notes.map((each) => Object.freeze({ ...each })),
      ),
    })
    const copy = structuredClone(frozen)

    // Act
    stepStudioNoteVelocities(frozen, [1, 2, 3], 5)

    // Assert
    expect(frozen).toEqual(copy)
  })
})

describe('pickLollipop', () => {
  // A chord on beat 2 (its lollipops at x 244), soft, loud and between, and a note on beat 3 (x 484).
  const notes = [
    note(1, 960, 0.3, 60),
    note(2, 960, 0.9, 64),
    note(3, 960, 0.6, 67),
    note(4, 1920, 0.5),
  ]
  const at = (
    x: number,
    y: number,
    selection: number[] = [],
    pointerType: 'mouse' | 'touch' = 'mouse',
  ) =>
    pickLollipop({
      notes,
      viewport: VIEW,
      height: LANE,
      selection: new Set(selection),
      x,
      y,
      pointerType,
    })

  it("takes the head nearest the press among a chord's lollipops", () => {
    expect(at(240, velocityLaneY(0.9, LANE))).toBe(2)
    expect(at(240, velocityLaneY(0.35, LANE))).toBe(1)
  })

  it("takes a selected note's lollipop before a nearer head", () => {
    expect(at(240, velocityLaneY(0.9, LANE), [3])).toBe(3)
  })

  it('reaches 7 px sideways for a mouse and 16 px for a finger', () => {
    const soft = velocityLaneY(0.3, LANE)
    expect([at(251, soft), at(252, soft)]).toEqual([1, null])
    expect([at(260, soft, [], 'touch'), at(261, soft, [], 'touch')]).toEqual([
      1,
      null,
    ])
  })
})
