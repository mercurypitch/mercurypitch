// Studio note roll navigation tests — Ctrl or Cmd with the wheel zooms about the pointer; the wheel scrolls the rows when they can scroll and moves through the clip when they cannot; Shift and a sideways swipe move through the clip; a pan stays in the clip's window and moves the rows by whole rows, carrying the rest; one finger pans, two zoom about the point between them, and a mouse is left alone.
import { describe, expect, it } from 'vitest'
import type { StudioRollMove } from './roll-navigation'
import { createStudioRollTouch, moveStudioRoll, studioRollWheelMove, } from './roll-navigation'

const wheel = (init: Partial<WheelEvent>) => ({
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  deltaX: 0,
  deltaY: 0,
  deltaMode: 0,
  ...init,
})

describe('studioRollWheelMove', () => {
  it('zooms about the pointer with Ctrl or Cmd: a notch up closes in', () => {
    const move = studioRollWheelMove(
      wheel({ ctrlKey: true, deltaY: -100 }),
      300,
      true,
      400,
    )

    expect(move).toMatchObject({ kind: 'zoom', anchorX: 300 })
    expect((move as { factor: number }).factor).toBeLessThan(1)
  })

  it('scrolls the rows with the wheel when they can scroll, a notch at least 100 px', () => {
    expect(studioRollWheelMove(wheel({ deltaY: 50 }), 0, true, 400)).toEqual({
      kind: 'pan',
      x: 0,
      y: 100,
    })
  })

  it('moves through the clip with the wheel when every row shows, and with Shift', () => {
    expect(studioRollWheelMove(wheel({ deltaY: 120 }), 0, false, 400)).toEqual({
      kind: 'pan',
      x: 120,
      y: 0,
    })
    expect(
      studioRollWheelMove(
        wheel({ deltaY: -120, shiftKey: true }),
        0,
        true,
        400,
      ),
    ).toEqual({ kind: 'pan', x: -120, y: 0 })
  })

  it('takes a trackpad’s two axes as they come', () => {
    expect(
      studioRollWheelMove(wheel({ deltaX: 12, deltaY: -4 }), 0, true, 400),
    ).toEqual({ kind: 'pan', x: 12, y: -4 })
  })
})

describe('moveStudioRoll', () => {
  const window = { startTick: 960, endTick: 9600 }
  const viewport = {
    start: 960,
    end: 4800,
    minMidi: 55,
    maxMidi: 66,
    width: 768,
    height: 300,
  }

  it('pans through the clip by the pixels moved, and stops at the window’s end', () => {
    // 3840 ticks over 768 px: 5 ticks a pixel.
    const near = moveStudioRoll(
      viewport,
      { kind: 'pan', x: 96, y: 0 },
      window,
      127,
    )
    const far = moveStudioRoll(
      viewport,
      { kind: 'pan', x: 9000, y: 0 },
      window,
      127,
    )

    expect([near.viewport.start, near.viewport.end]).toEqual([1440, 5280])
    expect([far.viewport.start, far.viewport.end]).toEqual([5760, 9600])
  })

  it('moves the rows by whole rows, the other way to the drag, and carries the rest', () => {
    // 25 px a row: dragging up 60 px shows two rows higher, half a row left over.
    const first = moveStudioRoll(
      viewport,
      { kind: 'pan', x: 0, y: 60 },
      window,
      127,
    )
    const second = moveStudioRoll(
      first.viewport,
      { kind: 'pan', x: 0, y: 15 },
      window,
      127,
      first.carryRows,
    )

    expect([first.viewport.minMidi, first.viewport.maxMidi]).toEqual([53, 64])
    expect(first.carryRows).toBeCloseTo(-0.4, 6)
    expect(second.viewport.minMidi).toBe(52)
  })

  it('zooms inside the window', () => {
    const { viewport: zoomed } = moveStudioRoll(
      viewport,
      { kind: 'zoom', factor: 4, anchorX: 0 },
      window,
      127,
    )

    expect([zoomed.start, zoomed.end]).toEqual([960, 9600])
  })
})

describe('createStudioRollTouch', () => {
  const pointer = (
    pointerId: number,
    clientX: number,
    clientY: number,
    pointerType = 'touch',
  ) => ({ pointerId, clientX, clientY, pointerType }) as PointerEvent

  function touch() {
    const moves: StudioRollMove[] = []
    const roll = createStudioRollTouch({
      apply: (move) => moves.push(move),
      origin: () => 100,
    })
    return { moves, roll }
  }

  it('pans with one finger, the roll following it', () => {
    const { moves, roll } = touch()

    roll.down(pointer(1, 300, 200))
    roll.move(pointer(1, 280, 230))

    expect(moves).toEqual([{ kind: 'pan', x: 20, y: -30 }])
  })

  it('zooms with two fingers about the point between them, in the grid', () => {
    // Arrange
    const { moves, roll } = touch()
    roll.down(pointer(1, 300, 200))
    roll.down(pointer(2, 400, 200))

    // Act: the fingers spread from 100 px apart to 200.
    roll.move(pointer(2, 500, 200))

    // Assert: the middle moved from 350 to 400, 300 px into the grid.
    expect(moves[0]).toEqual({ kind: 'zoom', factor: 0.5, anchorX: 300 })
    expect(moves[1]).toEqual({ kind: 'pan', x: -50, y: 0 })
  })

  it('leaves a mouse alone, and forgets a finger once it lifts', () => {
    const { moves, roll } = touch()

    expect(roll.down(pointer(1, 300, 200, 'mouse'))).toBe(false)
    roll.move(pointer(1, 200, 200, 'mouse'))
    roll.down(pointer(2, 300, 200))
    roll.up(pointer(2, 300, 200))
    roll.move(pointer(2, 250, 200))

    expect(moves).toEqual([])
    expect(roll.active()).toBe(false)
  })
})
