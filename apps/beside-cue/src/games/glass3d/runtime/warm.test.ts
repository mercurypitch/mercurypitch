import { describe, expect, it, vi } from 'vitest'
import type { IdleHost } from './warm'
import { isWarmEnabled, WARM_TIMINGS, whenIdleAfterPaint } from './warm'

/** A page whose frames, idle moments and timers move only when the test
 * says so. `paint()` is a frame: its rAF callbacks run, then it is on
 * screen, which is when anything they queued becomes runnable. */
const fakeHost = (withIdle: boolean) => {
  let next = 1
  const frames = new Map<number, FrameRequestCallback>()
  const idles = new Map<number, IdleRequestCallback>()
  const timers = new Map<number, { cb: () => void; ms: number }>()
  const idleOptions: (IdleRequestOptions | undefined)[] = []
  const host: IdleHost = {
    requestAnimationFrame: vi.fn((cb: FrameRequestCallback) => {
      frames.set(next, cb)
      return next++
    }),
    cancelAnimationFrame: vi.fn((id: number) => {
      frames.delete(id)
    }),
    setTimeout: vi.fn((cb: () => void, ms: number) => {
      timers.set(next, { cb, ms })
      return next++
    }),
    clearTimeout: vi.fn((id: number) => {
      timers.delete(id)
    }),
    ...(withIdle && {
      requestIdleCallback: vi.fn(
        (cb: IdleRequestCallback, opts?: IdleRequestOptions) => {
          idles.set(next, cb)
          idleOptions.push(opts)
          return next++
        },
      ),
      cancelIdleCallback: vi.fn((id: number) => {
        idles.delete(id)
      }),
    }),
  }
  return {
    host,
    idleOptions,
    timers,
    paint(): void {
      const due = [...frames.values()]
      frames.clear()
      for (const cb of due) cb(0)
    },
    idle(): void {
      const due = [...idles.values()]
      idles.clear()
      for (const cb of due)
        cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline)
    },
    fire(): void {
      const due = [...timers.values()]
      timers.clear()
      for (const t of due) t.cb()
    },
  }
}

describe('whenIdleAfterPaint', () => {
  it('waits for the paint, then for an idle moment, then runs once', () => {
    const page = fakeHost(true)
    const work = vi.fn()
    whenIdleAfterPaint(work, page.host)
    // Nothing on the call itself: the list has not reached the screen.
    expect(work).not.toHaveBeenCalled()
    page.paint()
    // Nor in the frame's own rAF, which runs before its paint.
    expect(work).not.toHaveBeenCalled()
    expect(page.idleOptions).toEqual([{ timeout: WARM_TIMINGS.idleTimeoutMs }])
    page.idle()
    expect(work).toHaveBeenCalledTimes(1)
    page.paint()
    page.idle()
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('without requestIdleCallback (Safari), a short timeout after the paint', () => {
    const page = fakeHost(false)
    const work = vi.fn()
    whenIdleAfterPaint(work, page.host)
    expect(page.timers.size).toBe(0)
    page.paint()
    expect(work).not.toHaveBeenCalled()
    expect([...page.timers.values()].map((t) => t.ms)).toEqual([
      WARM_TIMINGS.fallbackMs,
    ])
    page.fire()
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('cancelled before the paint: nothing runs, the frame is let go', () => {
    const page = fakeHost(true)
    const work = vi.fn()
    const cancel = whenIdleAfterPaint(work, page.host)
    cancel()
    expect(page.host.cancelAnimationFrame).toHaveBeenCalledTimes(1)
    page.paint()
    page.idle()
    expect(work).not.toHaveBeenCalled()
  })

  it('cancelled between the paint and the idle moment: nothing runs', () => {
    for (const withIdle of [true, false]) {
      const page = fakeHost(withIdle)
      const work = vi.fn()
      const cancel = whenIdleAfterPaint(work, page.host)
      page.paint()
      cancel()
      if (withIdle) expect(page.host.cancelIdleCallback).toHaveBeenCalled()
      else expect(page.host.clearTimeout).toHaveBeenCalled()
      page.idle()
      page.fire()
      expect(work).not.toHaveBeenCalled()
    }
  })

  it('a cancel after the work ran, or twice, changes nothing', () => {
    const page = fakeHost(true)
    const work = vi.fn()
    const cancel = whenIdleAfterPaint(work, page.host)
    page.paint()
    page.idle()
    cancel()
    cancel()
    expect(work).toHaveBeenCalledTimes(1)
    expect(page.host.cancelIdleCallback).not.toHaveBeenCalled()
  })
})

describe('isWarmEnabled', () => {
  it('warms unless the address says ?cold', () => {
    expect(isWarmEnabled('')).toBe(true)
    expect(isWarmEnabled('?perf')).toBe(true)
    expect(isWarmEnabled('?cold')).toBe(false)
    expect(isWarmEnabled('?perf&cold')).toBe(false)
  })
})
