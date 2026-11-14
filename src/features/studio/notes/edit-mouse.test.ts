// Studio note editing with a mouse — scripts of presses, moves and releases, and what each leaves: in Select a click selects (Shift, Ctrl or Cmd toggle), a drag moves the selection snapped to the grid and a semitone a row, a note's end resizes it, and empty grid draws a marquee or clears the selection; in Draw a click puts down a sixteenth and a drag sets its length, while a note still moves. Every finished drag is one commit, and none when nothing changed.
import { describe, expect, it } from 'vitest'
import { auditionsOf, commitsOf, drag, mouse, note, noteHost, noteOf, play, } from './edit-script.fixture'

// One bar at 4 ticks a pixel (a sixteenth is 60 px) and rows of 20 px.
// A: middle C from beat 2, an eighth (x 240 to 360, y 220 to 240).
// B: E4 on beat 3, a sixteenth (x 480 to 540, y 140 to 160).
// C: G4 on beat 4, an eighth (x 720 to 840, y 80 to 100).
const NOTES = [
  note(1, 60, 960, 480),
  note(2, 64, 1920, 240),
  note(3, 67, 2880, 480),
]
const A = [300, 230] as const
const B = [510, 150] as const
const C = [780, 90] as const

const click = (x: number, y: number, extra = {}) => [
  mouse('down', x, y, extra),
  mouse('up', x, y, extra),
]

describe('a click in Select', () => {
  it('selects a note alone, sounds it, and commits nothing', () => {
    // Act
    const host = play(noteHost({ notes: NOTES }), ...click(...A))

    // Assert
    expect(host.state.selection).toEqual([1])
    expect(auditionsOf(host)).toEqual([{ pitch: 60, velocity: 0.7874 }])
    expect(commitsOf(host)).toEqual([])
  })

  it.each([['shift'], ['mod']])(
    'toggles a note in the selection with %s',
    (modifier) => {
      // Arrange
      const host = play(noteHost({ notes: NOTES }), ...click(...A))

      // Act
      play(host, ...click(...B, { [modifier]: true }))
      const added = host.state.selection
      play(host, ...click(...A, { [modifier]: true }))

      // Assert
      expect(added).toEqual([1, 2])
      expect(host.state.selection).toEqual([2])
    },
  )

  it('clears the selection on empty grid', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      ...click(...A),
      ...click(100, 400),
    )
    expect(host.state.selection).toEqual([])
  })

  it('is still a click after moving less than 4 px', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      mouse('down', ...A),
      mouse('move', A[0] + 3, A[1]),
      mouse('up', A[0] + 3, A[1]),
    )
    expect(host.state.selection).toEqual([1])
    expect(commitsOf(host)).toEqual([])
  })

  it('takes no button but the first', () => {
    const host = play(noteHost({ notes: NOTES }), ...click(...A, { button: 2 }))
    expect(host.state.selection).toEqual([])
    expect(auditionsOf(host)).toEqual([])
  })
})

describe('a drag on a note in Select', () => {
  it('moves it on both axes, snapped to the grid, in one commit', () => {
    // Act: 75 px right (300 ticks) and two rows up.
    const host = play(noteHost({ notes: NOTES }), ...drag(A, [375, 190]))

    // Assert
    expect(commitsOf(host)).toHaveLength(1)
    expect(noteOf(host, 1)).toMatchObject({ startTick: 1200, pitch: 62 })
    expect(commitsOf(host)[0].selection).toEqual([1])
  })

  it('keeps the time it was played at when it travels less than half a step sideways', () => {
    const host = play(noteHost({ notes: NOTES }), ...drag(A, [325, 190]))
    expect(noteOf(host, 1)).toMatchObject({ startTick: 960, pitch: 62 })
  })

  it('places freely with Alt held', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      ...drag(A, [325, 230], { alt: true }),
    )
    expect(noteOf(host, 1)?.startTick).toBe(1060)
  })

  it('moves the selection with it, the notes keeping their offsets', () => {
    // Arrange: B played 10 ticks late; A and B selected.
    const late = [note(1, 60, 960, 480), note(2, 64, 1930, 240)]
    const host = play(
      noteHost({ notes: late }),
      ...click(...A),
      ...click(512, 150, { shift: true }),
    )

    // Act: B dragged 70 px (280 ticks) right lands on beat 3's next line.
    play(host, ...drag([512, 150], [582, 150]))

    // Assert
    expect(noteOf(host, 2)?.startTick).toBe(2160)
    expect(noteOf(host, 1)?.startTick).toBe(1190)
    expect(commitsOf(host)).toHaveLength(1)
  })

  it("stops the whole selection at the clip window's end", () => {
    // Arrange
    const host = play(
      noteHost({ notes: NOTES }),
      ...click(...A),
      ...click(...C, { shift: true }),
    )

    // Act
    play(host, ...drag(C, [1300, 90]))

    // Assert
    expect(noteOf(host, 3)?.startTick).toBe(3839)
    expect(noteOf(host, 3)!.startTick - noteOf(host, 1)!.startTick).toBe(1920)
  })

  it('commits nothing when it comes back where it started', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      mouse('down', ...A),
      mouse('move', 400, 150),
      mouse('move', ...A),
      mouse('up', ...A),
    )
    expect(commitsOf(host)).toEqual([])
    expect(host.state.selection).toEqual([1])
  })
})

describe("a drag on a note's end", () => {
  it('resizes it, its end on the grid', () => {
    // Act: from 3 px inside its end, a sixteenth to the right.
    const host = play(
      noteHost({ notes: NOTES }),
      ...drag([357, 230], [417, 230]),
    )

    // Assert
    expect(noteOf(host, 1)).toMatchObject({ startTick: 960, lengthTicks: 720 })
    expect(commitsOf(host)).toHaveLength(1)
  })

  it('keeps it at least to the next grid line', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      ...drag([357, 230], [100, 230]),
    )
    expect(noteOf(host, 1)?.lengthTicks).toBe(240)
  })

  it('resizes the selection by as many ticks', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      ...click(...A),
      ...click(...C, { shift: true }),
    )
    play(host, ...drag([357, 230], [417, 230]))
    expect([
      noteOf(host, 1)?.lengthTicks,
      noteOf(host, 3)?.lengthTicks,
    ]).toEqual([720, 720])
  })
})

describe('a drag on empty grid in Select', () => {
  it('selects the notes its marquee covers, and commits nothing', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      ...drag([100, 95], [600, 400]),
    )
    expect(host.state.selection).toEqual([1, 2])
    expect(commitsOf(host)).toEqual([])
  })

  it('adds them to the selection with Shift', () => {
    const host = play(noteHost({ notes: NOTES }), ...click(...C))
    play(host, ...drag([100, 95], [600, 400], { shift: true }))
    expect(host.state.selection).toEqual([3, 1, 2])
  })
})

describe('Draw', () => {
  const draw = { init: { tool: 'draw' as const } }

  it('puts a sixteenth on the grid line before a click, on its row, selected, in one commit', () => {
    // Act: tick 520, on the row of G3 (55).
    const host = play(noteHost({ notes: NOTES, ...draw }), ...click(130, 330))

    // Assert
    expect(commitsOf(host)).toEqual([
      {
        notes: [
          ...NOTES,
          {
            id: 4,
            pitch: 55,
            startTick: 480,
            lengthTicks: 240,
            velocity: 0.7874,
          },
        ],
        nextNoteId: 5,
        selection: [4],
      },
    ])
    expect(auditionsOf(host)).toEqual([{ pitch: 55, velocity: 0.7874 }])
  })

  it('sets the length with a drag, to the grid line past the pointer', () => {
    const host = play(
      noteHost({ notes: NOTES, ...draw }),
      ...drag([130, 330], [400, 330]),
    )
    expect(noteOf(host, 4)).toMatchObject({ startTick: 480, lengthTicks: 1200 })
  })

  it('keeps a step when the drag goes back past the press', () => {
    const host = play(
      noteHost({ notes: NOTES, ...draw }),
      ...drag([130, 330], [20, 330]),
    )
    expect(noteOf(host, 4)?.lengthTicks).toBe(240)
  })

  it("ends a drawn note at the clip window's end", () => {
    const host = play(
      noteHost({ notes: NOTES, ...draw }),
      ...drag([130, 330], [1000, 330]),
    )
    expect(noteOf(host, 4)?.lengthTicks).toBe(3360)
  })

  it('moves a note pressed, as Select does, and draws none', () => {
    const host = play(
      noteHost({ notes: NOTES, ...draw }),
      ...drag(A, [375, 230]),
    )
    expect(noteOf(host, 1)?.startTick).toBe(1200)
    expect(host.ctx.sequence.nextNoteId).toBe(4)
  })

  it("draws nothing outside the clip's window", () => {
    const host = play(
      noteHost({
        notes: NOTES,
        window: { startTick: 960, endTick: 3840 },
        ...draw,
      }),
      ...click(100, 330),
    )
    expect(commitsOf(host)).toEqual([])
  })

  it('gives a drawn note the velocity of the note pressed last', () => {
    const soft = [note(1, 60, 960, 480, 0.5)]
    const host = play(
      noteHost({ notes: soft, ...draw }),
      ...click(...A),
      ...click(500, 330),
    )
    expect(noteOf(host, 2)?.velocity).toBe(0.5)
  })

  it('draws at the tick with snapping off, a sixteenth long', () => {
    const host = play(
      noteHost({ notes: NOTES, init: { tool: 'draw', snap: 'off' } }),
      ...click(130, 330),
    )
    expect(noteOf(host, 4)).toMatchObject({ startTick: 520, lengthTicks: 240 })
  })
})
