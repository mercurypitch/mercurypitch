// Studio note velocity tests — a lollipop stands from the lane's foot to its velocity, inside the lane's padding; a drag moves velocity in 127 steps, the value read being the value kept; a group moves by the same steps, each note stopping at 1 and 127 on its own; and a press takes a selected note's lollipop first, then the nearest head.
import { describe, expect, it } from 'vitest'
import type { RollViewport } from '@/lib/roll-geometry'
import type { StudioNote } from '@/lib/studio/model/types'
import { noteVelocityValue, pickLollipop, stepStudioNoteVelocities, VELOCITY_LANE_PAD, velocityLaneY, velocitySteps, } from './edit-velocity'

/** One bar across 960 px: 4 ticks a pixel. */
const VIEW: RollViewport = {
  start: 0,
  end: 3840,
  minMidi: 48,
  maxMidi: 71,
  width: 960,
  height: 480,
}
/** A lane 80 px tall: 64 px from velocity 0 to 1. */
const LANE = 80

const note = (
  id: number,
  startTick: number,
  velocity: number,
  pitch = 60,
): StudioNote => ({ id, pitch, startTick, lengthTicks: 240, velocity })

describe('the lane', () => {
  it('stands the loudest head at the top padding and the softest at the foot', () => {
    expect(velocityLaneY(1, LANE)).toBe(VELOCITY_LANE_PAD)
    expect(velocityLaneY(0, LANE)).toBe(LANE - VELOCITY_LANE_PAD)
    expect(velocityLaneY(0.5, LANE)).toBe(40)
  })

  it("moves 127 steps over the lane's span, so 64 px up is the whole range", () => {
    expect([
      velocitySteps(64, LANE),
      velocitySteps(-16, LANE),
      velocitySteps(1, LANE),
    ]).toEqual([127, -32, 2])
  })

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
  // A chord on beat 2 (x 240), soft, loud and between, and a note on beat 3 (x 480).
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
    expect([at(247, soft), at(248, soft)]).toEqual([1, null])
    expect([at(256, soft, [], 'touch'), at(257, soft, [], 'touch')]).toEqual([
      1,
      null,
    ])
  })
})
