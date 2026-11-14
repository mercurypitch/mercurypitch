// Studio note editing by touch — scripts of fingers on a phone-sized roll: a tap selects a note alone; a note pressed, selected or not, drags at once, up, down, left and right; a selected note's grip resizes it without ever taking a short note's body; one finger on empty grid pans in Select and draws in Draw; a second finger undoes a drag and pinches; a cancel undoes; and a pen's drag survives a palm.
import { describe, expect, it } from 'vitest'
import { xToTime } from '@/lib/roll-geometry'
import { auditionsOf, commitsOf, finger, note, noteHost, noteOf, PHONE, play, touchDrag, viewportsOf, } from './edit-script.fixture'
import { noteEditView } from './edit-view'

// Two bars across 320 px at 24 ticks a pixel, rows of 20 px from 52 to 72.
// S: a thirty-second on middle C, 5 px wide (x 80 to 85, y 240 to 260).
// L: a half note on E4 (x 160 to 240, y 160 to 180).
// Q: an eighth on D4 (x 40 to 60, y 200 to 220).
const NOTES = [
  note(1, 60, 1920, 120),
  note(2, 64, 3840, 1920),
  note(3, 62, 960, 480),
]
const S = [82, 250] as const
const L = [200, 170] as const
/** The phone zoomed in on beat 3 to 5: 6 ticks a pixel. */
const ZOOMED = { ...PHONE, start: 1920, end: 3840 }

/** The clip's window is both bars, whatever the roll shows. */
const WINDOW = { startTick: 0, endTick: 7680 }
const phone = (selection: number[] = [], extra = {}) =>
  noteHost({
    notes: NOTES,
    viewport: PHONE,
    window: WINDOW,
    init: { selection },
    ...extra,
  })
const tap = (x: number, y: number, id = 1) => [
  finger(id, 'down', x, y),
  finger(id, 'up', x, y),
]

describe('a tap', () => {
  it('selects a note alone, whatever was selected', () => {
    const host = play(phone([2, 3]), ...tap(...S))
    expect(host.state.selection).toEqual([1])
    expect(commitsOf(host)).toEqual([])
  })

  it('clears the selection on empty grid', () => {
    const host = play(phone([1]), ...tap(300, 100))
    expect(host.state.selection).toEqual([])
  })
})

describe('a tap, then a press and a drag', () => {
  it.each([
    ['up', [0, -40], { pitch: 62, startTick: 1920 }],
    ['down', [0, 40], { pitch: 58, startTick: 1920 }],
    ['right', [30, 0], { pitch: 60, startTick: 2640 }],
    ['left', [-30, 0], { pitch: 60, startTick: 1200 }],
  ] as const)('drags the note %s in one commit', (_way, [dx, dy], moved) => {
    // Arrange
    const host = play(phone(), ...tap(...S))

    // Act
    play(host, ...touchDrag(S, [S[0] + dx, S[1] + dy]))

    // Assert
    expect(noteOf(host, 1)).toMatchObject({ ...moved, lengthTicks: 120 })
    expect(commitsOf(host)).toHaveLength(1)
    expect(host.state.selection).toEqual([1])
  })
})

describe('a press on a note and a drag at once', () => {
  it('drags an unselected note alone, and selects it, with no long press', () => {
    // Arrange: Q selected; a finger on L travels past the slop.
    const host = play(
      phone([3]),
      finger(1, 'down', ...L),
      finger(1, 'move', 200, 150),
    )
    const drafting = noteEditView(host.state, host.ctx).drafting

    // Act
    play(host, finger(1, 'move', 200, 130), finger(1, 'up', 200, 130))

    // Assert
    expect(drafting).toBe(true)
    expect(noteOf(host, 2)?.pitch).toBe(66)
    expect(noteOf(host, 3)?.pitch).toBe(62)
    expect(host.state.selection).toEqual([2])
  })

  it('drags the rest of the selection with a selected note', () => {
    const host = play(phone([1, 2]), ...touchDrag(S, [S[0], S[1] - 40]))
    expect([noteOf(host, 1)?.pitch, noteOf(host, 2)?.pitch]).toEqual([62, 66])
  })
})

describe('the grip of a selected thirty-second at phone zoom', () => {
  it('resizes the note from beside it', () => {
    const host = play(phone([1]), ...touchDrag([95, 250], [115, 250]))
    expect(noteOf(host, 1)).toMatchObject({ startTick: 1920, lengthTicks: 720 })
  })

  it('never takes its body, which still moves it', () => {
    const host = play(phone([1]), ...touchDrag([83, 250], [113, 250]))
    expect(noteOf(host, 1)).toMatchObject({ startTick: 2640, lengthTicks: 120 })
  })
})

describe("a finger's reach", () => {
  // Rows 4 px tall: 88 of them in 352 px; S's row is y 192 to 196.
  const thin = { ...PHONE, minMidi: 21, maxMidi: 108, height: 352 }

  it('picks a note 4 px tall from 12 px above it, and nothing from 13', () => {
    const near = play(phone([], { viewport: thin }), ...tap(82, 180))
    const far = play(phone([], { viewport: thin }), ...tap(82, 179))
    expect(near.state.selection).toEqual([1])
    expect(far.state.selection).toEqual([])
  })
})

describe('one finger on empty grid', () => {
  it('pans the roll both ways in Select, and edits nothing', () => {
    // Act: 50 px left and 40 px up, zoomed in.
    const host = play(
      phone([1], { viewport: ZOOMED }),
      ...touchDrag([300, 100], [250, 60]),
    )

    // Assert
    expect(host.ctx.viewport).toMatchObject({
      start: 2220,
      end: 4140,
      minMidi: 50,
      maxMidi: 70,
    })
    expect(commitsOf(host)).toEqual([])
    expect(host.state.selection).toEqual([1])
  })

  it('draws in Draw', () => {
    const host = play(
      noteHost({ notes: NOTES, viewport: PHONE, init: { tool: 'draw' } }),
      ...touchDrag([300, 100], [310, 100]),
    )
    expect(noteOf(host, 4)).toMatchObject({
      pitch: 67,
      startTick: 7200,
      lengthTicks: 240,
    })
  })
})

describe('a second finger', () => {
  it('undoes a note drag and pinches: nothing is committed', () => {
    // Act: a finger drags L up two rows; a second lands, both spread, both lift.
    const host = play(
      phone(),
      finger(1, 'down', ...L),
      finger(1, 'move', 200, 130),
      finger(2, 'down', 300, 300),
      finger(2, 'move', 310, 340),
      finger(1, 'up', 200, 130),
      finger(2, 'up', 310, 340),
    )

    // Assert
    expect(commitsOf(host)).toEqual([])
    expect(noteOf(host, 2)?.pitch).toBe(64)
    expect(host.state.selection).toEqual([])
    expect(viewportsOf(host).length).toBeGreaterThan(0)
  })

  it('puts back the selection a press on an unselected note showed', () => {
    const host = play(
      phone([3]),
      finger(1, 'down', ...L),
      finger(2, 'down', 300, 300),
    )
    expect(noteEditView(host.state, host.ctx).selection).toEqual([3])
  })
})

describe('a cancel', () => {
  it('undoes a drag: nothing is committed, the selection is as it was', () => {
    const host = play(
      phone([3]),
      finger(1, 'down', ...L),
      finger(1, 'move', 200, 130),
      finger(1, 'cancel', 200, 130),
    )
    expect(commitsOf(host)).toEqual([])
    expect(host.state.selection).toEqual([3])
    expect(host.state.gesture).toBeNull()
  })
})

describe('a pinch', () => {
  it('zooms time about the point between the fingers', () => {
    // Act: 100 px apart, then 180, about x 150.
    const host = play(
      phone([], { viewport: ZOOMED }),
      finger(1, 'down', 100, 300),
      finger(2, 'down', 200, 300),
      finger(1, 'move', 60, 300),
      finger(2, 'move', 240, 300),
    )

    // Assert
    const viewport = host.ctx.viewport
    expect(viewport.end - viewport.start).toBeLessThan(1920)
    expect(xToTime(150, viewport)).toBeCloseTo(xToTime(150, ZOOMED), 6)
  })

  it('zooms the rows apart up and down, never below 14 px a row', () => {
    const host = play(
      phone(),
      finger(1, 'down', 150, 100),
      finger(2, 'down', 150, 300),
      finger(1, 'move', 150, 150),
      finger(2, 'move', 150, 250),
    )
    const viewport = host.ctx.viewport
    expect(
      viewport.height / (viewport.maxMidi - viewport.minMidi + 1),
    ).toBeCloseTo(14, 6)
  })

  it('goes on panning with the finger that stays when the other lifts', () => {
    // Arrange: a pinch, then one finger up.
    const host = play(
      phone([1], { viewport: ZOOMED }),
      finger(1, 'down', 100, 300),
      finger(2, 'down', 200, 300),
      finger(1, 'up', 100, 300),
    )
    const before = host.ctx.viewport.start

    // Act
    play(host, finger(2, 'move', 150, 300), finger(2, 'up', 150, 300))

    // Assert
    expect(host.ctx.viewport.start).toBe(before + 300)
    expect(host.state.selection).toEqual([1])
    expect(host.state.gesture).toBeNull()
  })
})

describe('a pen', () => {
  it('keeps its drag when a palm touches down', () => {
    const pen = { pointerId: 7, pointerType: 'pen' as const }
    const host = play(
      phone(),
      finger(7, 'down', ...L, pen),
      finger(7, 'move', 200, 150, pen),
      finger(1, 'down', 20, 400),
      finger(7, 'move', 200, 130, pen),
      finger(7, 'up', 200, 130, pen),
    )
    expect(noteOf(host, 2)?.pitch).toBe(66)
    expect(commitsOf(host)).toHaveLength(1)
    expect(auditionsOf(host)[0]).toEqual({ pitch: 64, velocity: 0.7874 })
  })
})
