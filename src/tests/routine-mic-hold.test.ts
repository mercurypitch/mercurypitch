// The routine-scoped mic hold that bridges the gap between segments.
//
// Two rules carry the whole design: it may never OPEN the device (or a singer
// reading a drill description gets a recording indicator they did not ask
// for), and it must let go on its own (or a hold nobody released is a mic left
// on). Everything below is one of those two.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listeners: Array<(state: { active: boolean }) => void> = []
const mic = {
  active: false,
  acquire: vi.fn(async () => ({}) as MediaStream),
  release: vi.fn(),
  isActive: vi.fn(() => mic.active),
  subscribe: vi.fn((fn: (state: { active: boolean }) => void) => {
    listeners.push(fn)
    return () => {}
  }),
}

vi.mock('@/lib/mic-manager', () => ({
  micManager: mic,
  BACKGROUND_HOLD_IDS: ['routine'],
}))

const { HOLD_MS, holdMicForRoutine, isRoutineMicHeld, releaseRoutineMicHold } =
  await import('@/features/routines/routine-mic-hold')

/** Push a device-state change the way MicManager's subscribe would. */
function emitMicState(active: boolean): void {
  mic.active = active
  for (const fn of listeners) fn({ active })
}

describe('routine mic hold', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mic.active = false
    mic.acquire.mockClear()
    mic.release.mockClear()
  })

  afterEach(() => {
    releaseRoutineMicHold()
    vi.useRealTimers()
  })

  it('does nothing when the mic is not already open', () => {
    holdMicForRoutine()

    expect(mic.acquire).not.toHaveBeenCalled()
    expect(isRoutineMicHeld()).toBe(false)
  })

  it('takes a hold when the mic is live', async () => {
    mic.active = true
    holdMicForRoutine()
    await vi.advanceTimersByTimeAsync(0)

    expect(mic.acquire).toHaveBeenCalledWith('routine')
    expect(isRoutineMicHeld()).toBe(true)
  })

  it('holds once across several segments', async () => {
    mic.active = true
    holdMicForRoutine()
    holdMicForRoutine()
    holdMicForRoutine()
    await vi.advanceTimersByTimeAsync(0)

    expect(mic.acquire).toHaveBeenCalledTimes(1)
  })

  it('lets go on its own if nothing refreshes it', async () => {
    mic.active = true
    holdMicForRoutine()
    await vi.advanceTimersByTimeAsync(HOLD_MS - 1)
    expect(isRoutineMicHeld()).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    expect(mic.release).toHaveBeenCalledWith('routine')
    expect(isRoutineMicHeld()).toBe(false)
  })

  // Each segment refreshes the clock, so a long routine keeps the device
  // instead of losing it to the timeout halfway through.
  it('a later segment pushes the expiry back', async () => {
    mic.active = true
    holdMicForRoutine()
    await vi.advanceTimersByTimeAsync(HOLD_MS - 1000)
    holdMicForRoutine()
    await vi.advanceTimersByTimeAsync(2000)

    expect(isRoutineMicHeld()).toBe(true)
    expect(mic.release).not.toHaveBeenCalled()
  })

  it('releasing twice releases once', async () => {
    mic.active = true
    holdMicForRoutine()
    await vi.advanceTimersByTimeAsync(0)
    releaseRoutineMicHold()
    releaseRoutineMicHold()

    expect(mic.release).toHaveBeenCalledTimes(1)
  })

  // forceReleaseAll (another tab took the mic, or this one went to the
  // background) clears every consumer without telling them. If the flag stayed
  // true the next segment would believe in a hold that no longer exists.
  it('drops the flag when the device closes underneath it', async () => {
    mic.active = true
    holdMicForRoutine()
    await vi.advanceTimersByTimeAsync(0)

    emitMicState(false)
    expect(isRoutineMicHeld()).toBe(false)

    emitMicState(true)
    holdMicForRoutine()
    await vi.advanceTimersByTimeAsync(0)
    expect(mic.acquire).toHaveBeenCalledTimes(2)
  })
})
