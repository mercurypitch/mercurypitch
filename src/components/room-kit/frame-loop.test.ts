// ============================================================
// Frame loop: one loop a screen frame, and only one
// ============================================================
//
// Screen frames are a queue flushed by hand, as the room tests flush them.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFrameLoop } from './frame-loop'

let queue: { id: number; callback: FrameRequestCallback }[] = []
let nextId = 0
const cancelled: number[] = []

/** Runs the screen frames asked for so far (not the ones they ask for). */
function flush(): void {
  const due = queue
  queue = []
  for (const { callback } of due) callback(performance.now())
}

beforeEach(() => {
  queue = []
  nextId = 0
  cancelled.length = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextId += 1
    queue.push({ id: nextId, callback })
    return nextId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelled.push(id)
    queue = queue.filter((frame) => frame.id !== id)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A loop over `frame`, with the gate's switches in hand. */
function loopOf(frame: () => void) {
  const gate = { alive: true, running: true }
  const loop = createFrameLoop(frame, {
    alive: () => gate.alive,
    running: () => gate.running,
  })
  return { loop, gate }
}

describe('createFrameLoop', () => {
  it('asks for one screen frame however often it is started', () => {
    const { loop } = loopOf(() => undefined)

    loop.start()
    loop.start()

    expect(queue).toHaveLength(1)
  })

  it('runs the frame and asks for the next while the room runs', () => {
    const frame = vi.fn()
    const { loop } = loopOf(frame)
    loop.start()

    flush()
    flush()

    expect(frame).toHaveBeenCalledTimes(2)
    expect(queue).toHaveLength(1)
  })

  it('runs no frame, and asks for none, once the room stops running', () => {
    const frame = vi.fn()
    const { loop, gate } = loopOf(frame)
    loop.start()
    gate.running = false

    flush()

    expect(frame).not.toHaveBeenCalled()
    expect(queue).toHaveLength(0)
  })

  it('asks for no next frame when the frame itself ends the run', () => {
    const { loop, gate } = loopOf(() => {
      gate.running = false
    })
    loop.start()

    flush()

    expect(queue).toHaveLength(0)
  })

  it('stays one loop when the frame starts the loop again (a false start)', () => {
    const frames: number[] = []
    const { loop } = loopOf(() => {
      frames.push(frames.length)
      loop.start()
    })
    loop.start()

    flush()

    expect(frames).toEqual([0])
    expect(queue).toHaveLength(1)
  })

  it('takes back the frame asked for when stopped', () => {
    const frame = vi.fn()
    const { loop } = loopOf(frame)
    loop.start()
    const asked = queue[0].id

    loop.stop()
    flush()

    expect(cancelled).toEqual([asked])
    expect(frame).not.toHaveBeenCalled()
  })

  it('asks again when started after a stop', () => {
    const { loop } = loopOf(() => undefined)
    loop.start()
    loop.stop()

    loop.start()

    expect(queue).toHaveLength(1)
  })

  it('cancels nothing when stopped with no frame asked for', () => {
    const { loop } = loopOf(() => undefined)

    loop.stop()

    expect(cancelled).toEqual([])
  })

  it('runs nothing once the screen has gone, and asks for nothing more', () => {
    const frame = vi.fn()
    const { loop, gate } = loopOf(frame)
    loop.start()
    gate.alive = false

    flush()

    expect(frame).not.toHaveBeenCalled()
    expect(queue).toHaveLength(0)
  })

  it('asks for no next frame when the screen goes during the frame', () => {
    const { loop, gate } = loopOf(() => {
      gate.alive = false
    })
    loop.start()

    flush()

    expect(queue).toHaveLength(0)
  })

  it("hands requestAnimationFrame a function named tick (Long note's tests count them)", () => {
    const { loop } = loopOf(() => undefined)

    loop.start()

    expect(queue[0].callback.name).toBe('tick')
  })
})
