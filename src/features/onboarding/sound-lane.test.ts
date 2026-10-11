// ============================================================
// The sound lane: one sound at a time, and saying when it is busy
// ============================================================
//
// Owner testing, 11 Oct 2026: on the hold step a note played on arrival and
// "Hear a note" played a different one over it. The lane is the rule that
// makes that impossible: a new sound stops the one before it, and `busy`
// is what keeps the button disabled while anything sounds.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LaneSound } from './sound-lane'
import { createSoundLane } from './sound-lane'

/** A sound that records its own life: started, stopped early, or ran out. */
function fakeSound(seconds: number): LaneSound & {
  stopped: () => boolean
} {
  let stopped = false
  let finish: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    finish = resolve
  })
  setTimeout(() => finish(), seconds * 1000)
  return {
    stop: () => {
      stopped = true
      finish()
    },
    done,
    stopped: () => stopped,
  }
}

describe('the sound lane', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('stops the sound already playing before it starts the next one', () => {
    // Arrange
    const lane = createSoundLane()
    const first = fakeSound(3)
    void lane.play(() => first, 3)

    // Act
    const second = fakeSound(1)
    void lane.play(() => second, 1)

    // Assert
    expect(first.stopped()).toBe(true)
    expect(second.stopped()).toBe(false)
  })

  it('is busy from the start of a sound until it has run out', async () => {
    // Arrange
    const lane = createSoundLane()
    void lane.play(() => fakeSound(2), 2)
    const during = lane.busy()

    // Act
    await vi.advanceTimersByTimeAsync(2000)

    // Assert
    expect(during).toBe(true)
    expect(lane.busy()).toBe(false)
  })

  it('clears busy on its own timer when a sound never reports its end', async () => {
    // Arrange: a demo cue's handle can only be stopped, never awaited.
    const lane = createSoundLane()
    void lane.play(() => ({ stop: () => {} }), 1.5)
    await vi.advanceTimersByTimeAsync(1500)
    const atItsLength = lane.busy()

    // Act: past the length and the release tail the lane allows for.
    await vi.advanceTimersByTimeAsync(500)

    // Assert
    expect(atItsLength).toBe(true)
    expect(lane.busy()).toBe(false)
  })

  it('resolves the play when its sound ends, and at once when it is stopped', async () => {
    // Arrange
    const lane = createSoundLane()
    const ended = vi.fn()
    void lane.play(() => fakeSound(5), 5).then(ended)

    // Act
    lane.stop()
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(ended).toHaveBeenCalledOnce()
    expect(lane.busy()).toBe(false)
  })

  it('stays free when nothing could start', async () => {
    // Arrange
    const lane = createSoundLane()

    // Act
    const played = lane.play(() => null, 2)
    await played

    // Assert
    expect(lane.busy()).toBe(false)
  })

  it('stops a sound when its time runs out without its end, so a frozen clock cannot keep it armed', async () => {
    // Arrange: a sound that never reports its end, on a context whose clock
    // is frozen (iOS 'interrupted'). It has not played; it would on resume.
    const lane = createSoundLane()
    const frozen = { stop: vi.fn() }
    void lane.play(() => frozen, 1)

    // Act: past its length and the lane's tail allowance.
    await vi.advanceTimersByTimeAsync(1200)

    // Assert
    expect(frozen.stop).toHaveBeenCalled()
    expect(lane.busy()).toBe(false)
  })

  it('stops a sound that reported its end, in case the end came from a wall-clock fallback', async () => {
    // Arrange: `done` resolves on a timer while the sound itself may still
    // be scheduled on a clock that has not moved.
    const lane = createSoundLane()
    const early = fakeSound(1)
    void lane.play(() => early, 3)

    // Act
    await vi.advanceTimersByTimeAsync(1000)

    // Assert
    expect(early.stopped()).toBe(true)
    expect(lane.busy()).toBe(false)
  })
})
