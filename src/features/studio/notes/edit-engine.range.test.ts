// Studio note editing tests past a clip's end — a finger's pan and Shift with the wheel reach the two bars the roll shows past the clip's end, where a press in Draw still draws nothing, and the window alone bounds the view when the roll gives no range.
import { describe, expect, it } from 'vitest'
import type { NoteHost } from './edit-script.fixture'
import { commitsOf, DESKTOP, mouse, noteHost, play, touchDrag, viewportsOf, } from './edit-script.fixture'

/** One bar's window, 3840 ticks, and the roll's range two bars past its end. */
const WINDOW = { startTick: 0, endTick: 3840 }
const RANGE = { startTick: 0, endTick: 3840 + 7680 }

/** An empty clip's roll, its view on its one bar (4 ticks a pixel), lent the range past its end unless `range` is false. */
function emptyClip(
  range = true,
  init: Parameters<typeof noteHost>[0]['init'] = {},
): NoteHost {
  const host = noteHost({ notes: [], window: WINDOW, viewport: DESKTOP, init })
  if (range) host.ctx = { ...host.ctx, view: RANGE }
  return host
}

describe('the roll past a clip’s end', () => {
  it('pans with a finger into the room past the end', () => {
    // Act: a finger on empty grid drawn 480 px left: 1920 ticks later.
    const host = play(emptyClip(), ...touchDrag([700, 200], [220, 200]))

    // Assert
    expect(viewportsOf(host).at(-1)).toMatchObject({ start: 1920, end: 5760 })
  })

  it('keeps to the window when the roll gives no range', () => {
    // Act
    const host = play(emptyClip(false), ...touchDrag([700, 200], [220, 200]))

    // Assert
    expect(host.ctx.viewport).toMatchObject({ start: 0, end: 3840 })
  })

  it('scrolls time there with Shift and the wheel', () => {
    // Act: a notch's 100 px with Shift, later.
    const host = play(emptyClip(), {
      type: 'wheel',
      x: 480,
      y: 200,
      deltaX: 0,
      deltaY: 100,
      shift: true,
    })

    // Assert
    expect(host.ctx.viewport.start).toBeGreaterThan(0)
    expect(host.ctx.viewport.end).toBeGreaterThan(WINDOW.endTick)
  })

  it('draws nothing where a press in Draw lands past the end, and draws inside it', () => {
    // Arrange: the view on the bar past the end.
    const host = emptyClip(true, { tool: 'draw' })
    host.ctx = {
      ...host.ctx,
      viewport: { ...DESKTOP, start: 1920, end: 5760 },
    }

    // Act: a click at tick 4800, past the end, then one at tick 2880, inside.
    play(host, mouse('down', 720, 200), mouse('up', 720, 200))
    const past = commitsOf(host).length
    play(host, mouse('down', 240, 200), mouse('up', 240, 200))

    // Assert
    expect(past).toBe(0)
    expect(commitsOf(host)).toHaveLength(1)
    expect(commitsOf(host)[0].notes).toEqual([
      expect.objectContaining({ startTick: 2880 }),
    ])
  })
})
