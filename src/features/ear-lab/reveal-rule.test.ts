// Merc's pacing rule, which the native room sets while it is up: a
// right answer moves on after the hold, a wrong one waits for Next
// whatever the rack's switch says, and a touch pauses a hold that was
// counting down. The web keeps the switch (reveal-pacing.test.ts).

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetEarLabStore, setEarAutoAdvance, setEarRevealHoldMs, } from '@/stores/ear-lab-store'
import { createRevealPacer, revealStep, setRevealRule } from './reveal-pacing'

function setUp() {
  const advance = vi.fn()
  let pacer!: ReturnType<typeof createRevealPacer>
  const dispose = createRoot((d) => {
    pacer = createRevealPacer(advance, () => false)
    return d
  })
  return { advance, pacer, dispose }
}

describe('revealStep', () => {
  it("is the switch's on the web", () => {
    expect(revealStep('switch', true, false)).toBe('advance')
    expect(revealStep('switch', false, true)).toBe('park')
  })

  it("is Merc's in the room: right moves on, wrong waits", () => {
    for (const auto of [true, false]) {
      expect(revealStep('merc', auto, true)).toBe('advance')
      expect(revealStep('merc', auto, false)).toBe('park')
      // A round with nothing to judge (a skipped sung take) moves on.
      expect(revealStep('merc', auto, undefined)).toBe('advance')
    }
  })
})

describe("the pacer under Merc's rule", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    resetEarLabStore()
    setRevealRule('merc')
  })
  afterEach(() => {
    setRevealRule('switch')
    vi.useRealTimers()
    resetEarLabStore()
  })

  it('auto-advances a right answer even with the switch off', () => {
    setEarAutoAdvance(false)
    setEarRevealHoldMs(2000)
    const { advance, pacer, dispose } = setUp()
    pacer.hold(true)
    expect(pacer.parked()).toBe(false)
    vi.advanceTimersByTime(2001)
    expect(advance).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('parks a wrong answer even with the switch on, until Next', () => {
    setEarAutoAdvance(true)
    const { advance, pacer, dispose } = setUp()
    pacer.hold(false)
    expect(pacer.parked()).toBe(true)
    vi.advanceTimersByTime(20_000)
    expect(advance).not.toHaveBeenCalled()
    pacer.next()
    expect(advance).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('pauses a hold that was counting down, and waits for Next', () => {
    setEarRevealHoldMs(2000)
    const { advance, pacer, dispose } = setUp()
    pacer.hold(true)
    vi.advanceTimersByTime(1000)
    pacer.pause()
    expect(pacer.parked()).toBe(true)
    vi.advanceTimersByTime(10_000)
    expect(advance).not.toHaveBeenCalled()
    pacer.next()
    expect(advance).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('leaves a parked verdict alone when paused', () => {
    const { advance, pacer, dispose } = setUp()
    pacer.hold(false)
    pacer.pause()
    expect(pacer.parked()).toBe(true)
    pacer.next()
    expect(advance).toHaveBeenCalledTimes(1)
    dispose()
  })
})
