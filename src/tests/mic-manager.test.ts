import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { micLockStatus, releaseMicLock } from '../lib/mic-lock'
import { MicManager } from '../lib/mic-manager'

interface MockTrack {
  stop: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  getSettings: () => MediaTrackSettings
}

interface MockStream {
  getTracks: () => MockTrack[]
  getAudioTracks: () => MockTrack[]
  track: MockTrack
}

function makeStream(deviceId = ''): MockStream {
  const track: MockTrack = {
    stop: vi.fn(),
    addEventListener: vi.fn(),
    getSettings: () => ({ deviceId }),
  }
  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
    track,
  }
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
    releaseMicLock()
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

  it('remembers the browser-resolved input after the capture closes', async () => {
    mockGetUserMedia(() => Promise.resolve(makeStream('built-in-input')))

    await mgr.acquire('a')
    expect(mgr.getResolvedDevice()).toBe('built-in-input')
    mgr.release('a')
    await vi.advanceTimersByTimeAsync(2000)

    expect(mgr.getStream()).toBeNull()
    expect(mgr.getResolvedDevice()).toBe('built-in-input')
  })

  it('forgets a resolved route when the requested input changes', async () => {
    mockGetUserMedia(() => Promise.resolve(makeStream('built-in-input')))
    await mgr.acquire('a')

    await mgr.setPreferredDevice('usb-interface')

    expect(mgr.getResolvedDevice()).toBeNull()
    expect(mgr.getPreferredDevice()).toBe('usb-interface')
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
    expect(mgr.getError()).toMatchObject({ kind: 'permission-denied' })
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
    expect(mgr.getError()).toBeNull()
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

  describe('run guards', () => {
    it('reports no run in progress with nothing registered', () => {
      expect(mgr.isRunInProgress()).toBe(false)
    })

    it('reports a run while any guard says so', () => {
      let recording = false
      mgr.registerRunGuard('take', () => recording)
      expect(mgr.isRunInProgress()).toBe(false)
      recording = true
      expect(mgr.isRunInProgress()).toBe(true)
    })

    it('stops consulting a guard once it unregisters', () => {
      const unregister = mgr.registerRunGuard('take', () => true)
      expect(mgr.isRunInProgress()).toBe(true)
      unregister()
      expect(mgr.isRunInProgress()).toBe(false)
    })

    // A broken surface must not become a licence to cut the singer off.
    it('treats a throwing guard as busy', () => {
      mgr.registerRunGuard('broken', () => {
        throw new Error('boom')
      })
      expect(mgr.isRunInProgress()).toBe(true)
    })
  })

  it('forceReleaseAll drops every hold and closes the device now', async () => {
    const stream = makeStream()
    mockGetUserMedia(() => Promise.resolve(stream))

    await mgr.acquire('a')
    await mgr.acquire('b')
    expect(mgr.isActive()).toBe(true)

    void mgr.forceReleaseAll()
    await vi.advanceTimersByTimeAsync(0)

    expect(mgr.isActive()).toBe(false)
    expect(mgr.getConsumers()).toEqual([])
    // No linger: the point of forcing is that we stop capturing immediately.
    expect(stream.track.stop).toHaveBeenCalled()
  })

  it('gives back a completed handoff when no local consumer acquired', async () => {
    expect(await mgr.takeOverFromOtherTab()).toBe(true)
    expect(micLockStatus()).toBe('mine')

    await mgr.releaseTakeoverIfUnused()

    expect(micLockStatus()).toBe('free')
  })

  it('keeps the lock when another local consumer acquired after handoff', async () => {
    mockGetUserMedia(() => Promise.resolve(makeStream()))
    expect(await mgr.takeOverFromOtherTab()).toBe(true)
    await mgr.acquire('next-room')

    await mgr.releaseTakeoverIfUnused()

    expect(micLockStatus()).toBe('mine')
    expect(mgr.getConsumers()).toEqual(['next-room'])
  })

  // What the cross-tab handoff hangs on. mic-lock awaits this before it lets
  // the record say "free", so it has to settle AFTER the device is closed —
  // not after the close is merely queued behind an open that is still in
  // flight. Resolving early would let the other tab open a second handle
  // behind this one, which is the whole failure the lock exists to prevent.
  it('forceReleaseAll resolves only once the device is really closed', async () => {
    const stream = makeStream()
    let openDevice: ((s: typeof stream) => void) | undefined
    mockGetUserMedia(
      () =>
        new Promise<typeof stream>((resolve) => {
          openDevice = resolve
        }),
    )

    const acquiring = mgr.acquire('a')
    const released = mgr.forceReleaseAll()

    let settled = false
    void released.then(() => {
      settled = true
    })

    // The open has not finished, so the release is still queued behind it.
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)

    openDevice?.(stream)
    await acquiring
    await released

    expect(settled).toBe(true)
    expect(mgr.isActive()).toBe(false)
    expect(stream.track.stop).toHaveBeenCalled()
  })
})
