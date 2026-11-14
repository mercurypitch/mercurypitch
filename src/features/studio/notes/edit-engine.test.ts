// Studio note editing engine tests — the selection survives a commit and an undo while its notes exist and the clip plays them; a gesture whose notes change under it is undone; nothing given is ever changed; a dragged note sounds without machine-gunning and where it lands; a drag held at an edge scrolls on each frame and carries its note; the wheel moves the roll; an abort lets go; and the view draws drafts, grips, a marquee and the cursor.
import { describe, expect, it } from 'vitest'
import { createNoteEditState, noteEditWantsFrames } from './edit-engine'
import { auditionsOf, commitsOf, DESKTOP, finger, mouse, note, noteHost, noteOf, play, viewportsOf, } from './edit-script.fixture'
import { noteEditView } from './edit-view'

const NOTES = [
  note(1, 60, 960, 480),
  note(2, 64, 1920, 240),
  note(3, 67, 2880, 480),
]
const A = [300, 230] as const

describe('the selection', () => {
  it('survives a commit and an undo while its notes exist', () => {
    // Arrange: A dragged up a row and committed.
    const host = play(
      noteHost({ notes: NOTES }),
      mouse('down', ...A),
      mouse('move', 300, 210),
      mouse('up', 300, 210),
    )
    const original = { notes: NOTES, nextNoteId: 4 }

    // Act: the Studio's undo puts the notes back.
    host.ctx = { ...host.ctx, sequence: original }
    play(host, { type: 'sync' })

    // Assert
    expect(host.state.selection).toEqual([1])
  })

  it('drops a note an undo takes away', () => {
    // Arrange: a note drawn, and selected.
    const host = play(
      noteHost({ notes: NOTES, init: { tool: 'draw' } }),
      mouse('down', 130, 330),
      mouse('up', 130, 330),
    )
    const drawn = host.state.selection

    // Act
    host.ctx = { ...host.ctx, sequence: { notes: NOTES, nextNoteId: 4 } }
    play(host, { type: 'sync' })

    // Assert
    expect(drawn).toEqual([4])
    expect(host.state.selection).toEqual([])
  })

  it("never holds a note outside the clip's window, nor picks one", () => {
    // Arrange: the clip plays from beat 3; A starts before it.
    const host = noteHost({
      notes: NOTES,
      window: { startTick: 1920, endTick: 3840 },
      init: { selection: [1, 2] },
    })

    // Act
    play(host, { type: 'sync' })
    const kept = host.state.selection
    play(host, mouse('down', ...A), mouse('up', ...A))

    // Assert
    expect(kept).toEqual([2])
    expect(host.state.selection).toEqual([])
  })
})

describe('a gesture whose notes change under it', () => {
  it('is undone, and its release commits nothing', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      mouse('down', ...A),
      mouse('move', 400, 190),
    )
    host.ctx = {
      ...host.ctx,
      sequence: { notes: NOTES.slice(1), nextNoteId: 4 },
    }
    play(host, { type: 'sync' }, mouse('up', 400, 190))
    expect(commitsOf(host)).toEqual([])
    expect(host.state.gesture).toBeNull()
  })
})

describe('the engine', () => {
  it('changes nothing it is given', () => {
    // Arrange: a frozen context and state.
    const freeze = <T>(value: T): T => {
      if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(freeze)
        Object.freeze(value)
      }
      return value
    }
    const host = noteHost({ notes: NOTES, init: { selection: [2] } })
    const context = structuredClone(host.ctx)
    const given = freeze(host.ctx)
    const state = structuredClone(host.state)
    const first = freeze(host.state)

    // Act: a drag, a marquee, keys, a pinch and a draw.
    play(
      host,
      mouse('down', ...A),
      mouse('move', 400, 190),
      mouse('up', 400, 190),
      mouse('down', 100, 95),
      mouse('move', 600, 400),
      mouse('up', 600, 400),
      { type: 'key', key: 'ArrowRight' },
      { type: 'key', key: 'd', mod: true },
      finger(1, 'down', 100, 300),
      finger(2, 'down', 200, 300),
      finger(2, 'move', 260, 300),
      finger(1, 'up', 100, 300),
      finger(2, 'up', 260, 300),
    )

    // Assert: what it was given is as it was, though the host moved on through commits.
    expect(given).toEqual(context)
    expect(first).toEqual(state)
    expect(commitsOf(host).length).toBeGreaterThan(1)
  })
})

describe('sounds', () => {
  it('sound a pressed note, a new pitch at most every 100 ms, and the pitch it lands on', () => {
    // Act: A dragged up six rows, an event every 16 ms.
    const host = play(
      noteHost({ notes: NOTES }),
      mouse('down', ...A),
      ...[1, 2, 3, 4, 5, 6].map((rows) => mouse('move', 300, 230 - rows * 20)),
      mouse('up', 300, 110),
    )

    // Assert
    const pitches = auditionsOf(host).map((each) => each.pitch)
    expect(pitches[0]).toBe(60)
    expect(pitches.at(-1)).toBe(66)
    expect(pitches.length).toBeLessThan(5)
  })

  it('sound nothing more when a drag lands where it last sounded', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      mouse('down', ...A),
      mouse('move', 400, 230),
      mouse('up', 400, 230),
    )
    expect(auditionsOf(host)).toEqual([{ pitch: 60, velocity: 0.7874 }])
  })
})

describe('a drag held at an edge', () => {
  // Zoomed in on the first half of a two-bar clip: 2 ticks a pixel.
  const zoomed = { ...DESKTOP, start: 0, end: 1920 }

  it('scrolls the roll on each frame and carries its note, committed where it was let go', () => {
    // Arrange: A (x 480 to 720 here) dragged to 10 px from the right edge.
    const host = play(
      noteHost({
        notes: NOTES,
        viewport: zoomed,
        window: { startTick: 0, endTick: 7680 },
      }),
      mouse('down', 600, 230),
      mouse('move', 700, 230),
      mouse('move', 950, 230),
    )
    const wanted = noteEditWantsFrames(host.state)

    // Act: ten frames, 16 ms apart.
    const frames = Array.from({ length: 10 }, (_, index) => ({
      type: 'frame' as const,
      time: host.clock + 16 * (index + 1),
    }))
    play(host, ...frames, mouse('up', 950, 230))

    // Assert
    expect(wanted).toBe(true)
    expect(host.ctx.viewport.start).toBeGreaterThan(0)
    expect(noteOf(host, 1)!.startTick).toBeGreaterThan(960 + 700)
    expect(commitsOf(host)).toHaveLength(1)
  })

  it('wants no frames while nothing is dragged', () => {
    expect(noteEditWantsFrames(createNoteEditState())).toBe(false)
  })
})

describe('the wheel', () => {
  it('moves the roll and keeps the event from the page', () => {
    const host = play(noteHost({ notes: NOTES }), {
      type: 'wheel',
      x: 0,
      y: 0,
      deltaX: 0,
      deltaY: 40,
    })
    expect(viewportsOf(host)).toEqual([
      { ...DESKTOP, minMidi: 46, maxMidi: 69 },
    ])
    expect(host.handled).toEqual([true])
  })
})

describe('the wheel at an edge', () => {
  it('moves nothing and gives no viewport, but still keeps the event from the page', () => {
    // Arrange: the roll shows the whole clip, so time cannot scroll.
    const host = noteHost({ notes: NOTES })

    // Act
    play(host, {
      type: 'wheel',
      x: 0,
      y: 0,
      deltaX: 0,
      deltaY: 100,
      shift: true,
    })

    // Assert
    expect(viewportsOf(host)).toEqual([])
    expect(host.handled).toEqual([true])
  })
})

describe('an abort', () => {
  it('undoes a gesture and forgets every finger', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      finger(1, 'down', ...A),
      finger(1, 'move', 300, 190),
      { type: 'abort' },
      finger(1, 'up', 300, 190),
    )
    expect(commitsOf(host)).toEqual([])
    expect(host.state.touches).toEqual([])
  })
})

describe('a mouse whose release was lost', () => {
  it('undoes its old drag when it presses again, and starts afresh', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      mouse('down', ...A),
      mouse('move', 400, 190),
      mouse('down', 510, 150),
      mouse('up', 510, 150),
    )
    expect(commitsOf(host)).toEqual([])
    expect(host.state.selection).toEqual([2])
  })
})

describe('the view', () => {
  it('draws the draft while a drag is under way, the selection with its grips', () => {
    const host = play(
      noteHost({ notes: NOTES }),
      mouse('down', ...A),
      mouse('move', 375, 230),
    )
    const view = noteEditView(host.state, host.ctx)
    expect(view.drafting).toBe(true)
    expect(view.notes.find((each) => each.id === 1)?.startTick).toBe(1200)
    expect(view.selection).toEqual([1])
    expect(view.grips).toHaveLength(1)
    expect(view.cursor).toBe('grabbing')
  })

  it("draws a marquee in the roll's pixels", () => {
    const host = play(
      noteHost({ notes: NOTES }),
      mouse('down', 100, 95),
      mouse('move', 600, 400),
    )
    expect(noteEditView(host.state, host.ctx).marquee).toEqual({
      x: 100,
      y: 95,
      width: 500,
      height: 305,
    })
  })

  it('shows what is under the mouse, and nothing once it leaves', () => {
    const host = play(noteHost({ notes: NOTES }), mouse('move', 357, 230))
    const over = noteEditView(host.state, host.ctx)
    play(host, { type: 'leave' })
    expect([over.hover, over.cursor]).toEqual([
      { id: 1, zone: 'end' },
      'ew-resize',
    ])
    expect(noteEditView(host.state, host.ctx).hover).toBeNull()
  })

  it('crosses the empty grid in Draw', () => {
    const host = noteHost({ notes: NOTES, init: { tool: 'draw' } })
    expect(noteEditView(host.state, host.ctx).cursor).toBe('crosshair')
  })
})
