// Studio note editing in the velocity lane — scripts of presses on lollipops: a drag sets the pressed note's velocity, the selection's by the same steps when the note is selected, showing 1 to 127 while it moves and committing once; a chord gives way to its selected note; a finger works as a mouse does; and a tap selects.
import { describe, expect, it } from 'vitest'
import { auditionsOf, commitsOf, drag, finger, mouse, note, noteHost, noteOf, play, } from './edit-script.fixture'
import { noteVelocityValue } from './edit-velocity'
import { noteEditView } from './edit-view'

// A at 64 of 127 on beat 2 (its lollipop at x 240, head at y 39.75 of 80);
// B at 100 and C at 30, a chord on beat 3 (x 480, heads at 21.6 and 56.9).
const NOTES = [
  note(1, 60, 960, 480, 64 / 127),
  note(2, 64, 1920, 240, 100 / 127),
  note(3, 67, 1920, 240, 30 / 127),
]
const lane = { surface: 'velocity' as const }
const valueOf = (velocity: number | undefined) =>
  velocity === undefined ? undefined : noteVelocityValue(velocity)

describe('a drag up a lollipop', () => {
  it('makes its note louder, 127 steps over the lane, shows the value while it moves, and commits once', () => {
    // Arrange: 16 px up a lane whose 0 to 1 spans 64 px is 32 steps.
    const host = play(
      noteHost({ notes: NOTES }),
      mouse('down', 240, 40, lane),
      mouse('move', 240, 30, lane),
      mouse('move', 240, 24, lane),
    )
    const shown = noteEditView(host.state, host.ctx).readout

    // Act
    play(host, mouse('up', 240, 24, lane))

    // Assert
    expect(shown).toEqual({ id: 1, value: 96 })
    expect(valueOf(noteOf(host, 1)?.velocity)).toBe(96)
    expect(commitsOf(host)).toHaveLength(1)
    expect(auditionsOf(host).at(-1)).toEqual({ pitch: 60, velocity: 0.7559 })
  })

  it('moves the selection by the same steps, each note stopping at 127 on its own', () => {
    const host = play(
      noteHost({ notes: NOTES, init: { selection: [1, 2] } }),
      ...drag([240, 40], [240, 24], lane),
    )
    expect(
      NOTES.map((each) => valueOf(noteOf(host, each.id)?.velocity)),
    ).toEqual([96, 127, 30])
  })

  it('stops at 1 at the foot of the lane', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      ...drag([240, 40], [240, 200], lane),
    )
    expect(valueOf(noteOf(host, 1)?.velocity)).toBe(1)
  })
})

describe('a chord in the lane', () => {
  it('gives its selected note to a press nearer another head', () => {
    // Act: on B's head with C selected, 8 px up.
    const host = play(
      noteHost({ notes: NOTES, init: { selection: [3] } }),
      ...drag([480, 22], [480, 14], lane),
    )

    // Assert
    expect(valueOf(noteOf(host, 3)?.velocity)).toBe(46)
    expect(valueOf(noteOf(host, 2)?.velocity)).toBe(100)
  })
})

describe('a finger in the lane', () => {
  it('drags a lollipop from beside it, as a mouse does', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      finger(1, 'down', 252, 40, lane),
      finger(1, 'move', 252, 32, lane),
      finger(1, 'move', 252, 24, lane),
      finger(1, 'up', 252, 24, lane),
    )
    expect(valueOf(noteOf(host, 1)?.velocity)).toBe(96)
  })

  it('selects a note alone with a tap on its lollipop', () => {
    const host = play(
      noteHost({ notes: NOTES, init: { selection: [2] } }),
      finger(1, 'down', 240, 40, lane),
      finger(1, 'up', 240, 40, lane),
    )
    expect(host.state.selection).toEqual([1])
    expect(commitsOf(host)).toEqual([])
  })

  it('keeps the selection with a tap on an empty part of the lane', () => {
    const host = play(
      noteHost({ notes: NOTES, init: { selection: [2] } }),
      finger(1, 'down', 700, 40, lane),
      finger(1, 'up', 700, 40, lane),
    )
    expect(host.state.selection).toEqual([2])
  })
})
