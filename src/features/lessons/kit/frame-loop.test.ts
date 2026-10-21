// ============================================================
// Frame loop tests — a loop that rests once its drawers have settled
// ============================================================
//
// The page's one requestAnimationFrame loop, each test on a fresh copy and
// on frames it runs by hand: a drawer that says whether it wants a frame
// draws only then, and once every drawer has settled the loop asks for no
// frames until one wakes it; a drawer that never says keeps the loop
// asking every frame, on screen or off, as every drawer always has. A wake
// during a frame gets the next one, and the first frame after a rest steps
// from the wake, not from the frame before the rest.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type * as FrameLoop from './frame-loop'

interface Loop {
  readonly loop: typeof FrameLoop
  /** The frames the loop has asked for and the test has not yet run. */
  readonly asked: FrameRequestCallback[]
  /** Runs the frame asked for, 16 ms after the last; false when none was. */
  frame(): boolean
}

/** A fresh copy of the loop, on frames the test runs by hand. */
async function freshLoop(): Promise<Loop> {
  vi.resetModules()
  const asked: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) =>
    asked.push(cb),
  )
  const loop = await import('./frame-loop')
  let t = 0
  return {
    loop,
    asked,
    frame() {
      const next = asked.shift()
      if (next === undefined) return false
      t += 16
      next(t)
      return true
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the frame loop', () => {
  it('draws a drawer that wants a frame, then asks for none until it is woken', async () => {
    // Arrange: a drawer with one frame to draw
    const { loop, asked, frame } = await freshLoop()
    let wants = true
    let draws = 0
    loop.addDrawer({
      active: () => true,
      wants: () => wants,
      draw: () => {
        draws += 1
        wants = false
      },
    })
    loop.startFrameLoop()
    frame()
    const resting = asked.length

    // Act: something new to draw
    wants = true
    loop.wake()
    const woken = asked.length
    frame()

    // Assert
    expect(resting).toBe(0)
    expect(woken).toBe(1)
    expect(draws).toBe(2)
    expect(asked).toHaveLength(0)
  })

  it('keeps asking for every frame while a drawer that never says is registered, drawing it only on screen', async () => {
    // Arrange: a drawer with no `wants`, off screen
    const { loop, asked, frame } = await freshLoop()
    let draws = 0
    loop.addDrawer({
      active: () => false,
      draw: () => {
        draws += 1
      },
    })
    loop.startFrameLoop()

    // Act
    for (let i = 0; i < 5; i += 1) frame()

    // Assert
    expect(asked).toHaveLength(1)
    expect(draws).toBe(0)
  })

  it('gives the next frame to a drawer woken during a frame, even one that frame had already passed', async () => {
    // Arrange: an idle drawer first, then one whose frame wakes it
    const { loop, asked, frame } = await freshLoop()
    let firstWants = false
    let firstDraws = 0
    loop.addDrawer({
      active: () => true,
      wants: () => firstWants,
      draw: () => {
        firstDraws += 1
        firstWants = false
      },
    })
    let secondWants = true
    loop.addDrawer({
      active: () => true,
      wants: () => secondWants,
      draw: () => {
        secondWants = false
        firstWants = true
        loop.wake()
      },
    })
    loop.startFrameLoop()

    // Act
    frame()
    const next = asked.length
    frame()

    // Assert
    expect(next).toBe(1)
    expect(firstDraws).toBe(1)
    expect(asked).toHaveLength(0)
  })

  it('steps the first frame after a rest from the wake, not from the frame before the rest', async () => {
    // Arrange: a drawer that settles after every frame it draws, on a clock the test turns
    vi.useFakeTimers({ toFake: ['performance'] })
    const { loop, asked } = await freshLoop()
    const steps: number[] = []
    let wants = true
    loop.addDrawer({
      active: () => true,
      wants: () => wants,
      draw: (_now, dt) => {
        steps.push(dt)
        wants = false
      },
    })
    loop.startFrameLoop()
    vi.advanceTimersByTime(16)
    asked.shift()?.(performance.now())

    // Act: two seconds at rest, then a wake, and its frame 10 ms after it
    vi.advanceTimersByTime(2000)
    wants = true
    loop.wake()
    vi.advanceTimersByTime(10)
    asked.shift()?.(performance.now())

    // Assert
    expect(steps).toHaveLength(2)
    expect(steps[1]).toBeCloseTo(0.01, 5)
  })
})
