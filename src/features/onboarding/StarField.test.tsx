// ============================================================
// The star field, kept mounted but asleep while a plate covers it
// ============================================================
//
// Merc's plates paint their own sky, so FirstLight fades the field out
// behind them and keeps it mounted, to come back where it was. Faded out
// is not stopped: the current bead breathes, so the loop asked for a
// frame sixty times a second behind every plate. These tests count the
// frames it asks for. jsdom cannot draw, so the 2D context is a stub that
// accepts every call and draws nothing.

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StarField } from './StarField'

/** Accepts any property read, call or write, and does nothing. */
function inert(): unknown {
  const fn = (): unknown => proxy
  const proxy: unknown = new Proxy(fn, {
    get: () => proxy,
    set: () => true,
    apply: () => proxy,
  })
  return proxy
}

let queued: Map<number, FrameRequestCallback>
let nextId: number

/** Runs the frames asked for so far, as the browser would on a tick. */
function tick(times = 1): void {
  for (let i = 0; i < times; i++) {
    const due = [...queued.values()]
    queued.clear()
    for (const callback of due) callback(performance.now() + 16 * (i + 1))
  }
}

beforeEach(() => {
  queued = new Map()
  nextId = 1
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId++
    queued.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queued.delete(id))
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  )
  // `getContext` is overloaded per context kind; the stub stands in for
  // the 2D one, which is the only kind the field asks for.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => inert() as never,
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the star field behind a plate', () => {
  it('keeps asking for frames while it is on screen: the current bead breathes', () => {
    // Arrange
    render(() => <StarField beads={8} beadIndex={2} />)

    // Act
    tick(5)

    // Assert
    expect(queued.size).toBe(1)
  })

  it('stops asking for frames while it is away, and picks up when it is back', () => {
    // Arrange
    const [away, setAway] = createSignal(false)
    render(() => <StarField beads={8} beadIndex={2} paused={away()} />)
    tick(3)

    // Act
    setAway(true)
    tick(3)

    // Assert
    expect(queued.size).toBe(0)

    // Act
    setAway(false)

    // Assert
    expect(queued.size).toBe(1)
    tick(3)
    expect(queued.size).toBe(1)
  })

  it('does not wake up for a beat change while it is away', () => {
    // Arrange
    const [index, setIndex] = createSignal(2)
    render(() => <StarField beads={8} beadIndex={index()} paused />)
    tick(2)

    // Act
    setIndex(3)
    tick(2)

    // Assert
    expect(queued.size).toBe(0)
  })
})
