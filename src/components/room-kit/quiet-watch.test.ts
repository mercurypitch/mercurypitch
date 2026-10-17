// ============================================================
// Quiet watch: a quiet minute on the clock each room names
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQuietWatch, secondsClock, WALL_CLOCK } from './quiet-watch'

afterEach(() => {
  vi.useRealTimers()
})

describe('createQuietWatch on the wall clock', () => {
  it('is quiet only once more than the limit has passed since the last voice', () => {
    vi.useFakeTimers({ toFake: ['performance'] })
    const watch = createQuietWatch({ limitSeconds: 60, clock: WALL_CLOCK })
    watch.heard()

    vi.advanceTimersByTime(60_000)
    const atLimit = watch.quiet()
    vi.advanceTimersByTime(1)

    expect([atLimit, watch.quiet()]).toEqual([false, true])
  })

  it('starts the minute again at each voice', () => {
    vi.useFakeTimers({ toFake: ['performance'] })
    const watch = createQuietWatch({ limitSeconds: 60, clock: WALL_CLOCK })
    watch.heard()
    vi.advanceTimersByTime(59_000)

    watch.heard()
    vi.advanceTimersByTime(59_000)

    expect(watch.quiet()).toBe(false)
  })

  it('reads performance.now() at each look, in milliseconds', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1234)

    const read = WALL_CLOCK.now()

    expect([read, WALL_CLOCK.perSecond]).toEqual([1234, 1000])
    now.mockRestore()
  })
})

describe('createQuietWatch on a take clock, in seconds', () => {
  it("counts the minute in the clock's own seconds, from the take's start", () => {
    let takeNow = 0
    const watch = createQuietWatch({
      limitSeconds: 60,
      clock: secondsClock(() => takeNow),
    })
    watch.heard(0)

    takeNow = 60
    const atLimit = watch.quiet()
    takeNow = 60.25

    expect([atLimit, watch.quiet()]).toEqual([false, true])
  })

  it('takes the voice at the clock now when no time is given', () => {
    let takeNow = 30
    const watch = createQuietWatch({
      limitSeconds: 60,
      clock: secondsClock(() => takeNow),
    })

    watch.heard()
    takeNow = 90.5

    expect(watch.quiet()).toBe(true)
  })
})
