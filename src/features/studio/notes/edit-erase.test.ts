// Studio note erasing — scripts of sweeps: in any tool a right-button press on a note takes it away, shown going until the release keeps it gone in one commit, sounding nothing and leaving the selection's other notes; held and moved it takes every note its path crosses between two moves, not only where the moves land, and a mouse takes exactly those; Escape, a cancel or a lost release puts them back; the middle button erases nothing, nor the right one on the velocity lane. In Erase a click or a finger's tap takes a note away, a drag or a swipe every note it crosses as one commit, a second finger undoes the swipe and pinches, and the mouse shows what a press would take. On a kit a tap takes a hit and a swipe the hits along its row. A sweep held at an edge takes the notes the roll scrolls under it, and never a note out of sight.
import { describe, expect, it } from 'vitest'
import type { RollViewport } from '@/lib/roll-geometry'
import { studioDrumRows } from '@/lib/studio/midi/drum-rows'
import type { StudioRollRows } from '@/lib/studio/midi/roll-keyboard'
import { studioRollRow } from '@/lib/studio/midi/roll-keyboard'
import { noteEditWantsFrames } from './edit-engine'
import { notesAlong, sweepReach } from './edit-erase'
import type { NoteHost } from './edit-script.fixture'
import { auditionsOf, commitsOf, DESKTOP, drag, finger, key, mouse, note, noteHost, PHONE, play, touchDrag, viewportsOf, } from './edit-script.fixture'
import type { NoteEditInput } from './edit-types'
import { noteEditView } from './edit-view'

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
/** The mouse's right button; a move carries no button of its own. */
const RIGHT = { button: 2 } as const
const MOVE = { button: -1 } as const

const ids = (host: NoteHost) => host.ctx.sequence.notes.map((each) => each.id)
const right = (type: 'down' | 'up', x: number, y: number) =>
  mouse(type, x, y, RIGHT)
const moveTo = (x: number, y: number) => mouse('move', x, y, MOVE)

describe('a right-button press on a note', () => {
  it.each([['select'], ['draw']] as const)(
    'in %s shows it going at once, sounds nothing, and takes it away in one commit when let go',
    (tool) => {
      // Arrange
      const host = noteHost({ notes: NOTES, init: { tool } })

      // Act
      play(host, right('down', ...A))
      const shown = noteEditView(host.state, host.ctx)
      const before = commitsOf(host).length
      play(host, right('up', ...A))

      // Assert
      expect(shown.erasing).toEqual([1])
      expect(shown.notes.map((each) => each.id)).toEqual([2, 3])
      expect(shown.cursor).toBe('erase')
      expect(before).toBe(0)
      expect(commitsOf(host)).toHaveLength(1)
      expect(ids(host)).toEqual([2, 3])
      expect(auditionsOf(host)).toEqual([])
    },
  )

  it('leaves the rest of the selection selected', () => {
    const host = noteHost({ notes: NOTES, init: { selection: [1, 3] } })

    play(host, right('down', ...A), right('up', ...A))

    expect(host.state.selection).toEqual([3])
  })

  it('on empty grid commits nothing and keeps the selection', () => {
    const host = noteHost({ notes: NOTES, init: { selection: [2] } })

    play(host, right('down', 100, 400), right('up', 100, 400))

    expect(commitsOf(host)).toEqual([])
    expect(host.state.selection).toEqual([2])
  })
})

describe('a right-button sweep', () => {
  it('takes every note its path crosses, in one commit, and none it passes', () => {
    // Arrange
    const host = noteHost({ notes: NOTES })

    // Act: from A across B to C, along the rows between.
    play(
      host,
      right('down', ...A),
      moveTo(400, 200),
      moveTo(...B),
      moveTo(650, 120),
      moveTo(...C),
      right('up', ...C),
    )

    // Assert
    expect(commitsOf(host)).toHaveLength(1)
    expect(ids(host)).toEqual([])
  })

  it('takes a note crossed between two moves, however fast, not only where the moves land', () => {
    // Arrange
    const host = noteHost({ notes: NOTES })

    // Act: along E4's row in one move, from bar 1's start to its end.
    play(host, right('down', 20, 150), moveTo(940, 150), right('up', 940, 150))

    // Assert
    expect(ids(host)).toEqual([1, 3])
  })

  it('with a mouse takes exactly the notes under its path, not the row a pixel beside it', () => {
    const host = noteHost({ notes: NOTES })

    // Just over E4's row, the row above it all the way.
    play(host, right('down', 20, 139), moveTo(940, 139), right('up', 940, 139))

    expect(commitsOf(host)).toEqual([])
    expect(ids(host)).toEqual([1, 2, 3])
  })

  it('shows every note swept going until it is let go', () => {
    const host = noteHost({ notes: NOTES })

    play(host, right('down', ...A), moveTo(...B))

    expect(noteEditView(host.state, host.ctx).erasing).toEqual([1, 2])
    expect(commitsOf(host)).toEqual([])
  })

  it.each([
    ['Escape', [key('Escape')]],
    ['a cancel', [mouse('cancel', ...B, { pointerId: 1 })] as NoteEditInput[]],
    ['a press whose release was lost', [mouse('down', 100, 400)]],
  ] as const)(
    'puts the notes back on %s, and its release keeps nothing',
    (_end, ending) => {
      // Arrange
      const host = noteHost({ notes: NOTES, init: { selection: [1] } })
      play(host, right('down', ...A), moveTo(...B))

      // Act
      play(host, ...ending, right('up', ...B))

      // Assert
      expect(commitsOf(host)).toEqual([])
      expect(ids(host)).toEqual([1, 2, 3])
      expect(noteEditView(host.state, host.ctx).erasing).toEqual([])
    },
  )
})

describe('a button that does not erase', () => {
  it('is the middle one: it starts nothing', () => {
    const host = noteHost({ notes: NOTES })

    play(
      host,
      mouse('down', ...A, { button: 1 }),
      mouse('up', ...A, { button: 1 }),
    )

    expect(commitsOf(host)).toEqual([])
    expect(host.state.selection).toEqual([])
  })

  it('is the right one on the velocity lane: it takes no lollipop', () => {
    // A's lollipop stands at x 244.
    const lane = { surface: 'velocity' as const, button: 2 }
    const host = noteHost({ notes: NOTES })

    play(
      host,
      mouse('down', 244, 30, lane),
      mouse('move', 244, 70, { ...lane, button: -1 }),
      mouse('up', 244, 70, lane),
    )

    expect(commitsOf(host)).toEqual([])
  })
})

describe('Erase with a mouse', () => {
  const erase = { init: { tool: 'erase' as const } }

  it('takes away the note a click lands on', () => {
    const host = noteHost({ notes: NOTES, ...erase })

    play(host, mouse('down', ...B), mouse('up', ...B))

    expect(commitsOf(host)).toHaveLength(1)
    expect(ids(host)).toEqual([1, 3])
  })

  it('takes every note a drag crosses, in one commit', () => {
    const host = noteHost({ notes: NOTES, ...erase })

    // From A along its row, then under B and up into C.
    play(
      host,
      mouse('down', ...A),
      mouse('move', 420, 230),
      mouse('move', 600, 200),
      mouse('move', 700, 100),
      mouse('move', ...C),
      mouse('up', ...C),
    )

    expect(commitsOf(host)).toHaveLength(1)
    expect(ids(host)).toEqual([2])
  })

  it('takes nothing on a drag over empty grid, and keeps the selection', () => {
    const host = noteHost({
      notes: NOTES,
      init: { tool: 'erase', selection: [1] },
    })

    play(host, ...drag([100, 400], [900, 400]))

    expect(commitsOf(host)).toEqual([])
    expect(host.state.selection).toEqual([1])
  })

  it('shows the note under the mouse as one a press would take, and the eraser over empty grid', () => {
    const host = noteHost({ notes: NOTES, ...erase })

    play(host, mouse('move', ...C))
    const over = noteEditView(host.state, host.ctx)
    play(host, mouse('move', 100, 400))
    const empty = noteEditView(host.state, host.ctx)

    expect(over.hover).toEqual({ id: 3, zone: 'erase' })
    expect(over.cursor).toBe('erase')
    expect(empty.hover).toBeNull()
    expect(empty.cursor).toBe('erase')
  })
})

describe('Erase with a finger', () => {
  // Two bars across 320 px at 24 ticks a pixel, rows of 20 px from 52 to
  // 72. S: a thirty-second on middle C, 5 px wide (x 80 to 85, y 240 to
  // 260); L: a half note on E4 (x 160 to 240, y 160 to 180); Q: an eighth
  // on D4 (x 40 to 60, y 200 to 220).
  const PHONE_NOTES = [
    note(1, 60, 1920, 120),
    note(2, 64, 3840, 1920),
    note(3, 62, 960, 480),
  ]
  const phone = () =>
    noteHost({
      notes: PHONE_NOTES,
      viewport: PHONE,
      window: { startTick: 0, endTick: 7680 },
      init: { tool: 'erase' },
    })

  it('takes away a note a tap lands just beside, within a finger’s reach', () => {
    const host = phone()

    // 8 px right of the 5 px thirty-second.
    play(host, finger(1, 'down', 93, 250), finger(1, 'up', 93, 250))

    expect(ids(host)).toEqual([2, 3])
  })

  it('takes every note a swipe crosses, in one commit', () => {
    const host = phone()

    // From Q down through S, then up to L.
    play(
      host,
      finger(1, 'down', 50, 210),
      finger(1, 'move', 82, 250),
      finger(1, 'move', 140, 200),
      finger(1, 'move', 200, 170),
      finger(1, 'up', 200, 170),
    )

    expect(commitsOf(host)).toHaveLength(1)
    expect(ids(host)).toEqual([])
  })

  it('takes only the notes on the row a straight swipe runs along', () => {
    const host = phone()

    // From Q along D4's row to bar 2: S, on middle C a row below, stays.
    play(host, ...touchDrag([50, 210], [300, 210]))

    expect(ids(host)).toEqual([1, 2])
  })

  it('lets a second finger undo the swipe and pinch the roll', () => {
    // Arrange: a swipe from Q across S.
    const host = play(
      phone(),
      finger(1, 'down', 50, 210),
      finger(1, 'move', 82, 250),
    )

    // Act
    play(
      host,
      finger(2, 'down', 250, 100),
      finger(2, 'move', 300, 60),
      finger(1, 'move', 40, 280),
      finger(1, 'up', 40, 280),
      finger(2, 'up', 300, 60),
    )

    // Assert
    expect(commitsOf(host)).toEqual([])
    expect(ids(host)).toEqual([1, 2, 3])
    expect(viewportsOf(host).length).toBeGreaterThan(0)
  })
})

describe('Erase on a kit', () => {
  const KICK = 36
  const SNARE = 38
  const CLOSED_HAT = 42
  // A bar of a beat: kicks on 1 and 3, snares on 2 and 4, a hat each eighth.
  const BEAT = [
    note(1, KICK, 0, 240, 0.8),
    note(2, KICK, 1920, 240, 0.8),
    note(3, SNARE, 960, 240, 0.7),
    note(4, SNARE, 2880, 240, 0.7),
    ...[0, 480, 960, 1440, 1920, 2400, 2880, 3360].map((tick, index) =>
      note(5 + index, CLOSED_HAT, tick, 240, 0.6),
    ),
  ]
  const ROWS: StudioRollRows = { kind: 'drums', keys: studioDrumRows(BEAT) }
  /** The kit's eight rows 40 px each across a bar of 960 px. */
  const KIT: RollViewport = {
    start: 0,
    end: 3840,
    minMidi: 0,
    maxMidi: 7,
    width: 960,
    height: 320,
  }
  const x = (tick: number) => tick / 4
  const rowY = (drum: number) => (7 - studioRollRow(ROWS, drum)!) * 40 + 20
  const kit = (viewport = KIT) =>
    noteHost({ notes: BEAT, rows: ROWS, viewport, init: { tool: 'erase' } })

  it('takes away the hit a tap lands on', () => {
    const host = kit()

    play(
      host,
      finger(1, 'down', x(960) + 13, rowY(SNARE)),
      finger(1, 'up', x(960) + 13, rowY(SNARE)),
    )

    expect(ids(host)).not.toContain(3)
    expect(ids(host)).toHaveLength(BEAT.length - 1)
  })

  it('takes the hits a swipe along a row crosses, and none on the rows beside it', () => {
    const host = kit()

    // Along the hats' row, from just past the first hat to beat 3.
    play(
      host,
      ...touchDrag([x(300), rowY(CLOSED_HAT)], [x(2000), rowY(CLOSED_HAT)]),
    )

    expect(commitsOf(host)).toHaveLength(1)
    expect(ids(host)).toEqual([1, 2, 3, 4, 5, 10, 11, 12])
  })
})

describe('a sweep held at an edge', () => {
  it('takes the notes the roll scrolls under it, committed when let go', () => {
    // Arrange: D, past the view's right edge on middle C's row.
    const host = noteHost({
      notes: [...NOTES, note(4, 60, 4400, 240)],
      window: { startTick: 0, endTick: 7680 },
    })
    play(host, right('down', 600, 230), moveTo(700, 230), moveTo(959, 230))
    const wanted = noteEditWantsFrames(host.state)

    // Act: twelve frames 50 ms apart, the longest a frame counts.
    const frames = Array.from({ length: 12 }, (_, index) => ({
      type: 'frame' as const,
      time: host.clock + 50 * (index + 1),
    }))
    play(host, ...frames, right('up', 959, 230))

    // Assert
    expect(wanted).toBe(true)
    expect(host.ctx.viewport.start).toBeGreaterThan(560)
    expect(ids(host)).toEqual([1, 2, 3])
  })

  it('never takes a note out of sight', () => {
    // D sits 140 px past the right edge; the pointer runs past it.
    const host = noteHost({
      notes: [...NOTES, note(4, 60, 4400, 240)],
      window: { startTick: 0, endTick: 7680 },
    })

    play(
      host,
      right('down', 900, 230),
      moveTo(1300, 230),
      right('up', 1300, 230),
    )

    expect(ids(host)).toEqual([1, 2, 3, 4])
  })
})

describe('notesAlong', () => {
  const ctx = noteHost({ notes: NOTES }).ctx

  it('takes the notes a line crosses within its reach, and only over the grid in view', () => {
    expect(notesAlong(ctx, { x: 0, y: 150 }, { x: 960, y: 150 }, 0)).toEqual([
      2,
    ])
    expect(notesAlong(ctx, { x: 0, y: 137 }, { x: 960, y: 137 }, 3)).toEqual([
      2,
    ])
    expect(notesAlong(ctx, { x: 0, y: 137 }, { x: 960, y: 137 }, 2)).toEqual([])
    expect(notesAlong(ctx, { x: -400, y: 150 }, { x: -10, y: 150 }, 0)).toEqual(
      [],
    )
  })
})

describe('sweepReach', () => {
  it('is exact for a mouse, and a quarter row at most for a pen or a finger', () => {
    expect(sweepReach('mouse', DESKTOP)).toBe(0)
    expect(sweepReach('pen', DESKTOP)).toBe(5)
    expect(sweepReach('touch', { ...DESKTOP, minMidi: 60 })).toBe(10)
  })
})
