// The one pacing rule every drill obeys: auto-advance on, the verdict
// holds for the rack's setting and the run moves on by itself; off,
// it parks until next(). Flipping the switch on mid-park resumes.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REVEAL_HOLD } from '@/lib/ear/timing'
import { resetEarLabStore, setEarAutoAdvance, setEarRevealHoldMs, } from '@/stores/ear-lab-store'
import { createRevealPacer, formatRevealHold } from './reveal-pacing'

function setUp(cancelled: () => boolean = () => false) {
  const advance = vi.fn()
  let pacer!: ReturnType<typeof createRevealPacer>
  const dispose = createRoot((d) => {
    pacer = createRevealPacer(advance, cancelled)
    return d
  })
  return { advance, pacer, dispose }
}

describe('createRevealPacer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    resetEarLabStore()
  })
  afterEach(() => {
    vi.useRealTimers()
    resetEarLabStore()
  })

  it('holds for the rack setting, then advances once', () => {
    setEarRevealHoldMs(3000)
    const { advance, pacer, dispose } = setUp()
    pacer.hold()
    expect(pacer.parked()).toBe(false)
    vi.advanceTimersByTime(2995)
    expect(advance).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10)
    expect(advance).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(REVEAL_HOLD.max)
    expect(advance).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('parks with auto-advance off until next(), which fires once', () => {
    setEarAutoAdvance(false)
    const { advance, pacer, dispose } = setUp()
    pacer.hold()
    expect(pacer.parked()).toBe(true)
    vi.advanceTimersByTime(REVEAL_HOLD.max + 1000)
    expect(advance).not.toHaveBeenCalled()
    pacer.next()
    expect(advance).toHaveBeenCalledTimes(1)
    expect(pacer.parked()).toBe(false)
    pacer.next()
    expect(advance).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('next() does nothing while the run is not parked', () => {
    const { advance, pacer, dispose } = setUp()
    pacer.next()
    pacer.hold()
    pacer.next()
    expect(advance).not.toHaveBeenCalled()
    dispose()
  })

  it('resumes after one hold when the switch flips on mid-park', () => {
    setEarAutoAdvance(false)
    const { advance, pacer, dispose } = setUp()
    pacer.hold()
    expect(pacer.parked()).toBe(true)
    setEarAutoAdvance(true)
    expect(pacer.parked()).toBe(false)
    vi.advanceTimersByTime(REVEAL_HOLD.defaultMs - 5)
    expect(advance).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10)
    expect(advance).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('cancel drops the timer and the parked state', () => {
    const { advance, pacer, dispose } = setUp()
    pacer.hold()
    pacer.cancel()
    vi.advanceTimersByTime(REVEAL_HOLD.max)
    expect(advance).not.toHaveBeenCalled()

    setEarAutoAdvance(false)
    pacer.hold()
    expect(pacer.parked()).toBe(true)
    pacer.cancel()
    expect(pacer.parked()).toBe(false)
    pacer.next()
    expect(advance).not.toHaveBeenCalled()
    dispose()
  })

  it('a cancelled run never advances, timer or Next', () => {
    let cancelled = false
    const { advance, pacer, dispose } = setUp(() => cancelled)
    pacer.hold()
    cancelled = true
    vi.advanceTimersByTime(REVEAL_HOLD.defaultMs + 5)
    expect(advance).not.toHaveBeenCalled()

    cancelled = false
    setEarAutoAdvance(false)
    pacer.hold()
    cancelled = true
    pacer.next()
    expect(advance).not.toHaveBeenCalled()
    dispose()
  })
})

describe('formatRevealHold', () => {
  it('reads in seconds, whole where it can', () => {
    expect(formatRevealHold(1500)).toBe('1.5 s')
    expect(formatRevealHold(2000)).toBe('2 s')
    expect(formatRevealHold(10000)).toBe('10 s')
  })
})
