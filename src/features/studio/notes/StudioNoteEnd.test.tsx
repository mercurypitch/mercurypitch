// Studio note End handle tests — the handle stands on the ruler where the clip ends, named with the bar it ends in; a drag drafts the end on the grid, the view following it, and keeps it once when let go; the end moves with the pointer from where it took the handle; Escape and a lost capture put it back; the arrows move it a grid step and Shift a bar, each press one commit; a song that cannot be edited moves nothing; and an end out of view shows no handle.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RollViewport } from '@/lib/roll-geometry'
import type { StudioNoteEndProps } from './StudioNoteEnd'
import { StudioNoteEnd } from './StudioNoteEnd'

// jsdom has no PointerEvent; without one the events lose button and clientX.
if (typeof window.PointerEvent === 'undefined')
  window.PointerEvent = class extends MouseEvent {
    readonly pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
    }
  } as unknown as typeof PointerEvent

afterEach(cleanup)

/** Ten ticks a pixel from tick 0, the grid starting 72 px in, as a roll's keys leave it. */
const VIEW: RollViewport = {
  start: 0,
  end: 8000,
  minMidi: 48,
  maxMidi: 72,
  width: 800,
  height: 300,
}

/** The handle over a clip ending on bar 2's line, tick 3840, on a grid of sixteenths. */
function renderEnd(change: Partial<StudioNoteEndProps> = {}) {
  const calls = {
    drafts: [] as (number | null)[],
    commits: [] as number[],
    reveals: [] as number[],
  }
  render(() => (
    <div>
      <StudioNoteEnd
        viewport={VIEW}
        left={72}
        width={872}
        window={{ startTick: 0, endTick: 3840 }}
        meter={{ beatTicks: 960, originTick: 0, beatsPerBar: 4 }}
        grid={{ ticks: 240, offset: 0 }}
        mostTick={100_000}
        writable
        onDraft={(tick) => calls.drafts.push(tick)}
        onCommit={(tick) => calls.commits.push(tick)}
        onReveal={(tick) => calls.reveals.push(tick)}
        {...change}
      />
    </div>
  ))
  const handle = screen.queryByRole('slider', { name: 'Clip end' })
  if (handle !== null) {
    let captured: number | null = null
    handle.setPointerCapture = (id: number) => {
      captured = id
    }
    handle.hasPointerCapture = (id: number) => captured === id
    handle.releasePointerCapture = () => {
      captured = null
    }
    vi.spyOn(handle.parentElement!, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 872, 400),
    )
  }
  return { handle, calls }
}

describe('the End handle', () => {
  it('stands where the clip ends, named with the bar it ends in', () => {
    // Act
    const { handle } = renderEnd()

    // Assert: 72 px in, and 3840 ticks at ten a pixel.
    expect(handle).toHaveStyle({ left: '456px' })
    expect(handle).toHaveAttribute('aria-valuetext', 'bar 2')
    expect(handle).toHaveAttribute('data-studio-note-end', '3840')
  })

  it('drafts the end on the grid as it is dragged, the view following, and keeps it once when let go', () => {
    // Arrange
    const { handle, calls } = renderEnd()

    // Act: to tick 5200, nearest the sixteenth on 5280.
    fireEvent.pointerDown(handle!, { button: 0, pointerId: 3, clientX: 456 })
    fireEvent.pointerMove(handle!, { pointerId: 3, clientX: 72 + 520 })
    fireEvent.pointerUp(handle!, { pointerId: 3, clientX: 72 + 520 })

    // Assert
    expect(calls.drafts).toEqual([3840, 5280, null])
    expect(calls.reveals).toEqual([5280])
    expect(calls.commits).toEqual([5280])
  })

  it('moves the end with the pointer from where it took the handle, never jumping', () => {
    // Arrange
    const { handle, calls } = renderEnd()

    // Act: taken 15 px right of the end's line, then 100 px on: 1000 ticks.
    fireEvent.pointerDown(handle!, { button: 0, pointerId: 3, clientX: 471 })
    fireEvent.pointerMove(handle!, { pointerId: 3, clientX: 471 })
    fireEvent.pointerMove(handle!, { pointerId: 3, clientX: 571 })
    fireEvent.pointerUp(handle!, { pointerId: 3, clientX: 571 })

    // Assert: on 3840 where it was taken, then nearest the sixteenth on 4800.
    expect(calls.drafts).toEqual([3840, 4800, null])
    expect(calls.commits).toEqual([4800])
  })

  it('shortens the clip to a grid line past its start at the least', () => {
    // Arrange
    const { handle, calls } = renderEnd()

    // Act
    fireEvent.pointerDown(handle!, { button: 0, pointerId: 3, clientX: 456 })
    fireEvent.pointerMove(handle!, { pointerId: 3, clientX: 0 })
    fireEvent.pointerUp(handle!, { pointerId: 3, clientX: 0 })

    // Assert
    expect(calls.commits).toEqual([240])
  })

  it('puts the end back on Escape and on a lost capture, keeping nothing', () => {
    // Arrange
    const { handle, calls } = renderEnd()

    // Act
    fireEvent.pointerDown(handle!, { button: 0, pointerId: 3, clientX: 456 })
    fireEvent.pointerMove(handle!, { pointerId: 3, clientX: 700 })
    fireEvent.keyDown(handle!, { key: 'Escape' })
    fireEvent.pointerDown(handle!, { button: 0, pointerId: 4, clientX: 456 })
    fireEvent.pointerMove(handle!, { pointerId: 4, clientX: 700 })
    fireEvent(handle!, new Event('lostpointercapture'))

    // Assert
    expect(calls.drafts.at(-1)).toBeNull()
    expect(calls.commits).toEqual([])
  })

  it('moves a grid step with an arrow and a bar with Shift, each press one commit', () => {
    // Arrange
    const { handle, calls } = renderEnd()

    // Act
    fireEvent.keyDown(handle!, { key: 'ArrowRight' })
    fireEvent.keyDown(handle!, { key: 'ArrowLeft', shiftKey: true })

    // Assert
    expect(calls.commits).toEqual([4080, 240])
  })

  it('moves nothing while the song cannot be edited', () => {
    // Arrange
    const { handle, calls } = renderEnd({ writable: false })

    // Act
    fireEvent.pointerDown(handle!, { button: 0, pointerId: 3, clientX: 456 })
    fireEvent.pointerMove(handle!, { pointerId: 3, clientX: 700 })
    fireEvent.pointerUp(handle!, { pointerId: 3, clientX: 700 })
    fireEvent.keyDown(handle!, { key: 'ArrowRight' })

    // Assert
    expect(handle).toHaveAttribute('aria-disabled', 'true')
    expect(calls.drafts).toEqual([])
    expect(calls.commits).toEqual([])
  })

  it('shows no handle while the clip’s end is out of view', () => {
    // Act
    const { handle } = renderEnd({ window: { startTick: 0, endTick: 20_000 } })

    // Assert
    expect(handle).toBeNull()
  })
})
