// Studio note roll pointer tests — a press on the grid or the velocity lane is captured and counted from where it went down, its drag off the canvas still counted from there; a press on the keys or the ruler starts nothing; a lost capture before the release is a cancel and after it nothing; a finger the canvas no longer captures is cancelled before the next finger presses; and with no engine every handler leaves the event to the roll.
import { describe, expect, it, vi } from 'vitest'
import type { NoteEditInput } from './edit-types'
import { studioRollRegions } from './note-roll-geometry'
import { createNoteRollPointers } from './note-roll-pointers'
import type { StudioNoteRollEditing } from './useStudioNoteEditing'

// A canvas 840 by 406 at 100, 50 on the page: keys 72 wide, a ruler 26
// high and a velocity lane 80 high, so the grid starts at 172, 76 and the
// lane at 172, 376.
const REGIONS = studioRollRegions({
  width: 840,
  height: 406,
  layout: { keysWidth: 72, rulerHeight: 26, velocityHeight: 80 },
})

function fakeCanvas() {
  const captured = new Set<number>()
  return {
    captured,
    canvas: {
      getBoundingClientRect: () => ({ left: 100, top: 50 }),
      setPointerCapture: (id: number) => captured.add(id),
      hasPointerCapture: (id: number) => captured.has(id),
    } as unknown as HTMLCanvasElement,
  }
}

function fakeEditing(fingers: number[] = []) {
  const sent: NoteEditInput[] = []
  const editing = {
    send: (input: NoteEditInput) => {
      sent.push(input)
      return true
    },
    fingers: () => fingers,
  } as unknown as StudioNoteRollEditing
  return { editing, sent }
}

const pointer = (
  pointerId: number,
  clientX: number,
  clientY: number,
  pointerType = 'mouse',
) =>
  ({
    pointerId,
    pointerType,
    clientX,
    clientY,
    timeStamp: 500,
    button: 0,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault: vi.fn(),
  }) as unknown as PointerEvent

function roll(options: { fingers?: number[]; engine?: boolean } = {}) {
  const { canvas, captured } = fakeCanvas()
  const { editing, sent } = fakeEditing(options.fingers)
  const pointers = createNoteRollPointers({
    editing: () => (options.engine === false ? null : editing),
    canvas: () => canvas,
    regions: () => REGIONS,
  })
  return { pointers, sent, captured }
}

describe('a press', () => {
  it('on the grid is captured, and its drag counts from the grid wherever it goes', () => {
    // Arrange
    const { pointers, sent, captured } = roll()

    // Act: pressed 100, 50 into the grid, then dragged off the canvas.
    pointers.down(pointer(4, 272, 126))
    pointers.move(pointer(4, 1200, 500))

    // Assert
    expect(captured.has(4)).toBe(true)
    expect(sent).toMatchObject([
      { type: 'down', pointerId: 4, surface: 'roll', x: 100, y: 50 },
      { type: 'move', pointerId: 4, surface: 'roll', x: 1028, y: 424 },
    ])
    expect(pointers.active()).toBe(true)
  })

  it('in the velocity lane counts from the lane', () => {
    const { pointers, sent } = roll()

    pointers.down(pointer(5, 200, 396, 'touch'))

    expect(sent).toMatchObject([
      { type: 'down', pointerType: 'touch', surface: 'velocity', x: 28, y: 20 },
    ])
  })

  it('on the keys or the ruler starts nothing, and the browser does nothing with it either', () => {
    const { pointers, sent } = roll()
    const keys = pointer(6, 130, 200)
    const ruler = pointer(7, 400, 60)

    const taken = [pointers.down(keys), pointers.down(ruler)]

    expect(taken).toEqual([true, true])
    expect(sent).toEqual([])
    expect(keys.preventDefault).toHaveBeenCalled()
  })
})

describe('a lost capture', () => {
  it('before the release cancels the gesture, and after it is nothing', () => {
    // Arrange: one pointer lost while down, one lost after its release.
    const { pointers, sent } = roll()
    pointers.down(pointer(1, 300, 200))
    pointers.down(pointer(2, 320, 220))
    pointers.end(pointer(2, 320, 220), 'up')

    // Act
    pointers.end(pointer(1, 300, 200), 'cancel')
    pointers.end(pointer(2, 320, 220), 'cancel')

    // Assert
    expect(sent.map((input) => input.type)).toEqual([
      'down',
      'down',
      'up',
      'cancel',
    ])
    expect(pointers.active()).toBe(false)
  })
})

describe('a forgotten finger', () => {
  it('is cancelled before the next finger presses, so the press is no pinch', () => {
    // The engine still holds finger 9, which the canvas no longer captures.
    const { pointers, sent } = roll({ fingers: [9] })

    pointers.down(pointer(10, 300, 200, 'touch'))

    expect(sent).toMatchObject([
      { type: 'cancel', pointerId: 9 },
      { type: 'down', pointerId: 10 },
    ])
  })
})

describe('a roll the engine does not edit', () => {
  it('has every handler leave the event to the roll', () => {
    const { pointers, sent } = roll({ engine: false })
    const press = pointer(1, 300, 200)

    const answers = [
      pointers.down(press),
      pointers.move(press),
      pointers.end(press, 'up'),
      pointers.wheel(press as unknown as WheelEvent),
    ]

    expect(answers).toEqual([false, false, false, false])
    expect(sent).toEqual([])
  })
})
