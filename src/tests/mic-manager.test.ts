import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MicManager } from '../lib/mic-manager'

interface MockTrack {
  stop: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
}

interface MockStream {
  getTracks: () => MockTrack[]
  track: MockTrack
}

function makeStream(): MockStream {
  const track: MockTrack = { stop: vi.fn(), addEventListener: vi.fn() }
  return { getTracks: () => [track], track }
}

function domError(name: string): Error {
  const err = new Error(name)
  err.name = name
  return err
}

/** Replace navigator.mediaDevices.getUserMedia with a controllable mock. */
function mockGetUserMedia(
  impl: () => Promise<unknown>,
): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl)
  ;(
    globalThis.navigator as unknown as {
      mediaDevices: { getUserMedia: unknown }
    }
  ).mediaDevices = { getUserMedia: fn }
  return fn
}

describe('MicManager', () => {
  let mgr: MicManager

  beforeEach(() => {
    vi.useFakeTimers()
    mgr = new MicManager()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('opens the device once and shares it across consumers', async () => {
    const stream = makeStream()
    const gum = mockGetUserMedia(() => Promise.resolve(stream))

    const a = await mgr.acquire('a')
    const b = await mgr.acquire('b')

    expect(gum).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(mgr.isActive()).toBe(true)
    expect([...mgr.getConsumers()].sort()).toEqual(['a', 'b'])
  })

  it('is idempotent per consumer id', async () => {
    const gum = mockGetUserMedia(() => Promise.resolve(makeStream()))

    await mgr.acquire('a')
    await mgr.acquire('a')

    expect(gum).toHaveBeenCalledTimes(1)
    expect(mgr.getConsumers()).toEqual(['a'])
  })

  it('keeps the device open while any consumer still holds it', async () => {
    const stream = makeStream()
    mockGetUserMedia(() => Promise.resolve(stream))

    await mgr.acquire('a')
    await mgr.acquire('b')
    mgr.release('a')
    await vi.advanceTimersByTimeAsync(0)

    expect(stream.track.stop).not.toHaveBeenCalled()
    expect(mgr.getStream()).not.toBeNull()
  })

  it('tears the device down after the linger once the last consumer leaves', async () => {
    const stream = makeStream()
    mockGetUserMedia(() => Promise.resolve(stream))

    await mgr.acquire('a')
    mgr.release('a')
    await vi.advanceTimersByTimeAsync(0)

    // Still open during the linger window, but reported inactive (no holders).
    expect(stream.track.stop).not.toHaveBeenCalled()
    expect(mgr.isActive()).toBe(false)

    await vi.advanceTimersByTimeAsync(2000)
    expect(stream.track.stop).toHaveBeenCalledTimes(1)
    expect(mgr.getStream()).toBeNull()
  })

  it('reuses the device when re-acquired within the linger window', async () => {
    const stream = makeStream()
    const gum = mockGetUserMedia(() => Promise.resolve(stream))

    await mgr.acquire('a')
    mgr.release('a')
    await vi.advanceTimersByTimeAsync(500) // within the 2s linger
    await mgr.acquire('b')
    await vi.advanceTimersByTimeAsync(2000) // past the original linger

    expect(gum).toHaveBeenCalledTimes(1)
    expect(stream.track.stop).not.toHaveBeenCalled()
    expect(mgr.isActive()).toBe(true)
  })

  it('classifies a permission denial and holds no consumer', async () => {
    mockGetUserMedia(() => Promise.reject(domError('NotAllowedError')))

    await expect(mgr.acquire('a')).rejects.toMatchObject({
      kind: 'permission-denied',
    })
    expect(mgr.isActive()).toBe(false)
    expect(mgr.getConsumers()).toEqual([])
  })

  it('retries once when the device is briefly busy', async () => {
    const stream = makeStream()
    let calls = 0
    const gum = mockGetUserMedia(() => {
      calls += 1
      return calls === 1
        ? Promise.reject(domError('NotReadableError'))
        : Promise.resolve(stream)
    })

    const acquired = mgr.acquire('a')
    await vi.advanceTimersByTimeAsync(250) // busy-retry delay
    await expect(acquired).resolves.toBe(stream)
    expect(gum).toHaveBeenCalledTimes(2)
    expect(mgr.isActive()).toBe(true)
  })

  it('notifies subscribers on state changes', async () => {
    mockGetUserMedia(() => Promise.resolve(makeStream()))
    const states: boolean[] = []
    const unsubscribe = mgr.subscribe((s) => states.push(s.active))

    await mgr.acquire('a')
    mgr.release('a')
    await vi.advanceTimersByTimeAsync(2000)
    unsubscribe()

    expect(states[0]).toBe(false) // immediate initial snapshot
    expect(states).toContain(true) // after acquire
    expect(states[states.length - 1]).toBe(false) // after teardown
  })
})
