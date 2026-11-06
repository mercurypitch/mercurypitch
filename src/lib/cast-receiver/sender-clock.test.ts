// ============================================================
// Sender clock tests — a phone's moments on the TV's clock
// ============================================================

import { describe, expect, it } from 'vitest'
import { createSenderClock, SENDER_CLOCK_WINDOW_MS, } from '@/lib/cast-receiver/sender-clock'

describe('the sender clock', () => {
  it('moves a moment by the skew between the two clocks', () => {
    const clock = createSenderClock()
    // The phone reads 10 000 ms; its frame lands 3 s later by the TV's
    // clock, 40 ms of it in transit.
    expect(clock.toLocal(10_000, 13_040)).toBe(13_040)
    // A quicker frame shows the transit was shorter: the skew is 3 010 ms.
    expect(clock.toLocal(10_050, 13_060)).toBe(13_060)
    // A slow frame does not drag the clock: the quickest one still holds.
    expect(clock.toLocal(10_100, 13_190)).toBe(13_110)
  })

  it('follows a sender clock set back once its old readings roll out', () => {
    const clock = createSenderClock(1_000)
    expect(clock.toLocal(10_000, 13_000)).toBe(13_000)
    // The phone's clock is set back a whole second.
    expect(clock.toLocal(9_100, 13_100)).toBe(12_100)
    // Past the window, only the new skew is left.
    expect(clock.toLocal(9_100 + 1_200, 13_100 + 1_200)).toBe(14_300)
  })

  it('forgets every reading on reset, for the next sender', () => {
    const clock = createSenderClock()
    clock.toLocal(10_000, 13_000)
    clock.reset()
    // A new phone with a different clock is taken as it is.
    expect(clock.toLocal(50_000, 13_500)).toBe(13_500)
  })

  it('keeps five seconds of readings by default', () => {
    expect(SENDER_CLOCK_WINDOW_MS).toBe(5_000)
  })
})
