import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { micLockStatus, releaseMicLock } from '../lib/mic-lock'
import type { MicState } from '../lib/mic-manager'
import { MicManager } from '../lib/mic-manager'

interface MockTrack {
  stop: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  getSettings: () => MediaTrackSettings
  muted?: boolean
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
  impl: (constraints: MediaStreamConstraints) => Promise<unknown>,
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

  it('names a browser that offers no microphone, not its TypeError', async () => {
    // An insecure origin, an embedded view or a television's browser can
    // expose no navigator.mediaDevices at all. Reaching through it threw a
    // TypeError, and "Cannot read properties of undefined" was the copy the
    // singer got.
    ;(
      globalThis.navigator as unknown as { mediaDevices: unknown }
    ).mediaDevices = undefined

    await expect(mgr.acquire('a')).rejects.toMatchObject({
      kind: 'no-device',
      message: 'This browser cannot use a microphone.',
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

describe('MicManager input for one hold', () => {
  let mgr: MicManager
  /** The input each getUserMedia call asked for; undefined for the default. */
  const askedFor = (gum: ReturnType<typeof vi.fn>) =>
    gum.mock.calls.map(([constraints]) => deviceOf(constraints))
  const deviceOf = (constraints: unknown) =>
    (
      (constraints as MediaStreamConstraints).audio as {
        deviceId?: { exact: string }
      }
    ).deviceId?.exact
  /** A browser that opens a stream on whichever input is asked for. */
  const openEach = (before?: (device: string | undefined) => void) =>
    mockGetUserMedia((constraints) => {
      const device = deviceOf(constraints)
      before?.(device)
      return Promise.resolve(makeStream(device ?? 'default'))
    })
  const asMock = (stream: MediaStream | null) => stream as unknown as MockStream
  /** The browser fires `type` at a stream's track. */
  const fire = (stream: MockStream, type: string) => {
    for (const [name, listener] of stream.track.addEventListener.mock.calls)
      if (name === type) (listener as () => void)()
  }
  /** The browser ends a stream's track, as an unplug or a second capture does. */
  const endTrack = (stream: MockStream) => fire(stream, 'ended')

  beforeEach(() => {
    vi.useFakeTimers()
    mgr = new MicManager()
  })

  afterEach(() => {
    releaseMicLock()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("opens the input picked on a stream of its own, and leaves the app's input to its consumers", async () => {
    const gum = openEach()
    await mgr.setPreferredDevice('app-in')
    const voice = asMock(await mgr.acquire('voice'))

    const held = await mgr.acquireFrom('studio', 'usb-1')
    const studio = asMock(held.stream)
    expect(held.missing).toBe(false)
    expect(studio).not.toBe(voice)
    expect(studio.track.getSettings().deviceId).toBe('usb-1')
    expect(voice.track.stop).not.toHaveBeenCalled()
    expect(mgr.getStream()).toBe(voice)
    expect(mgr.getConsumers()).toEqual(['voice'])
    expect(mgr.getScopedHold()?.consumerId).toBe('studio')

    held.release()
    await vi.advanceTimersByTimeAsync(0)
    expect(studio.track.stop).toHaveBeenCalled()
    expect(voice.track.stop).not.toHaveBeenCalled()
    expect(mgr.getStream()).toBe(voice)
    expect(mgr.getScopedHold()).toBeNull()
    expect(askedFor(gum)).toEqual(['app-in', 'usb-1'])
  })

  it('ends only the hold a release was called for, so a re-arm on another input opens that input', async () => {
    const gum = openEach()
    await mgr.setPreferredDevice('app-in')
    const held = await mgr.acquireFrom('studio', 'usb-1')
    const first = asMock(held.stream)

    // A re-arm: the release is queued, the next open asked for in the same task.
    held.release()
    const second = await mgr.acquireFrom('studio', 'usb-2')
    await vi.advanceTimersByTimeAsync(0)

    const stream = asMock(second.stream)
    expect(stream.track.getSettings().deviceId).toBe('usb-2')
    expect(stream.track.stop).not.toHaveBeenCalled()
    expect(first.track.stop).toHaveBeenCalled()
    expect(mgr.getScopedHold()?.stream).toBe(second.stream)
    expect(askedFor(gum)).toEqual(['usb-1', 'usb-2'])
  })

  it('leaves the newer hold open when a hold it replaced lets go late', async () => {
    openEach()
    const stale = await mgr.acquireFrom('studio', 'usb-1')
    // A newer hold asked for, then the one it replaces released after it.
    const pending = mgr.acquireFrom('studio', 'usb-2')
    stale.release()
    const newer = await pending
    await vi.advanceTimersByTimeAsync(0)

    expect(asMock(stale.stream).track.stop).toHaveBeenCalled()
    expect(asMock(newer.stream).track.stop).not.toHaveBeenCalled()
    expect(mgr.getScopedHold()?.stream).toBe(newer.stream)
    // Late again, after the newer hold opened: still only its own.
    stale.release()
    await vi.advanceTimersByTimeAsync(0)
    expect(mgr.getScopedHold()?.stream).toBe(newer.stream)
  })

  it("ends an input of its own only through its hold, not by the consumer's id", async () => {
    openEach()
    const held = await mgr.acquireFrom('studio', 'usb-1')

    mgr.release('studio')
    await vi.advanceTimersByTimeAsync(0)

    expect(asMock(held.stream).track.stop).not.toHaveBeenCalled()
    expect(mgr.getScopedHold()?.stream).toBe(held.stream)
  })

  it('records from the default input when asked, whatever the app picked', async () => {
    const gum = openEach()
    await mgr.setPreferredDevice('guitar-in')

    await mgr.acquireFrom('studio', null)

    expect(askedFor(gum)).toEqual([undefined])
  })

  it("opens the default input and says so when its input is gone, keeping the app's", async () => {
    let calls = 0
    const gum = mockGetUserMedia(() =>
      ++calls === 1
        ? Promise.reject(domError('OverconstrainedError'))
        : Promise.resolve(makeStream()),
    )
    await mgr.setPreferredDevice('guitar-in')

    const held = await mgr.acquireFrom('studio', 'unplugged-mic')

    expect(held.missing).toBe(true)
    expect(askedFor(gum)).toEqual(['unplugged-mic', undefined])
    expect(mgr.getPreferredDevice()).toBe('guitar-in')
  })

  it("keeps its input while the app picks another, and the app's consumers open the app's", async () => {
    const gum = openEach()
    const held = await mgr.acquireFrom('studio', 'usb-1')

    await mgr.setPreferredDevice('guitar-in')
    const guitar = asMock(await mgr.acquire('guitar'))

    expect(asMock(held.stream).track.stop).not.toHaveBeenCalled()
    expect(guitar.track.getSettings().deviceId).toBe('guitar-in')
    expect(mgr.getScopedHold()?.stream).toBe(held.stream)
    expect(askedFor(gum)).toEqual(['usb-1', 'guitar-in'])
  })

  it('tells the consumers of a stream the browser ends as the input of its own opens, rather than leave them deaf', async () => {
    let voice: MockStream | null = null
    // A browser that keeps one capture at a time ends the other as this opens.
    openEach((device) => {
      if (device === 'usb-1' && voice !== null) endTrack(voice)
    })
    voice = asMock(await mgr.acquire('voice'))
    const states: MicState[] = []
    mgr.subscribe((state) => states.push(state))

    await mgr.acquireFrom('studio', 'usb-1')

    expect(voice.track.stop).toHaveBeenCalled()
    expect(mgr.getStream()).toBeNull()
    // The voice consumer's own lost-microphone path reads this.
    expect(states.at(-1)).toMatchObject({ active: false, scoped: 'studio' })
  })

  it('tells its consumer when the input of its own goes, by an unplug or a hand-over to another tab', async () => {
    openEach()
    const states: MicState[] = []
    mgr.subscribe((state) => states.push(state))

    endTrack(asMock((await mgr.acquireFrom('studio', 'usb-1')).stream))
    expect(states.at(-1)?.scoped).toBeNull()
    expect(mgr.getScopedHold()).toBeNull()

    const again = asMock((await mgr.acquireFrom('studio', 'usb-1')).stream)
    expect(states.at(-1)?.scoped).toBe('studio')
    await mgr.forceReleaseAll()
    expect(again.track.stop).toHaveBeenCalled()
    expect(states.at(-1)?.scoped).toBeNull()
  })

  it('lets go of the input and the lock after a failed open', async () => {
    let refuse = true
    const gum = mockGetUserMedia((constraints) =>
      refuse
        ? Promise.reject(domError('NotAllowedError'))
        : Promise.resolve(makeStream(deviceOf(constraints) ?? 'default')),
    )
    await expect(mgr.acquireFrom('studio', 'usb-1')).rejects.toMatchObject({
      kind: 'permission-denied',
    })
    expect(mgr.getScopedHold()).toBeNull()
    expect(micLockStatus()).toBe('free')

    refuse = false
    await mgr.acquire('guitar')
    expect(askedFor(gum)).toEqual(['usb-1', undefined])
  })

  describe("on the app's own input", () => {
    it('records from the shared stream when both ask for the default, opening no second capture', async () => {
      const gum = openEach()
      const voice = asMock(await mgr.acquire('voice'))
      const states: MicState[] = []
      mgr.subscribe((state) => states.push(state))

      const held = await mgr.acquireFrom('studio', null)

      expect(asMock(held.stream)).toBe(voice)
      expect(askedFor(gum)).toEqual([undefined])
      expect(states.at(-1)).toMatchObject({
        active: true,
        consumers: ['voice'],
        scoped: 'studio',
      })
      held.release()
      await vi.advanceTimersByTimeAsync(0)
      expect(voice.track.stop).not.toHaveBeenCalled()
      expect(mgr.getStream()).toBe(voice)
      expect(mgr.getScopedHold()).toBeNull()
    })

    it("shares the input the app's stream is on, or asks for, and opens it for consumers that come later", async () => {
      // The app asks for the default, and the browser opens the desk mic for it.
      const gum = mockGetUserMedia((constraints) =>
        Promise.resolve(makeStream(deviceOf(constraints) ?? 'desk-mic')),
      )
      const voice = asMock(await mgr.acquire('voice'))
      const desk = await mgr.acquireFrom('studio', 'desk-mic')
      expect(asMock(desk.stream)).toBe(voice)
      desk.release()
      mgr.release('voice')
      await vi.advanceTimersByTimeAsync(2000)

      // Both ask for the guitar input; the Studio asks first.
      await mgr.setPreferredDevice('guitar-in')
      const guitar = await mgr.acquireFrom('studio', 'guitar-in')
      const tuner = await mgr.acquire('tuner')
      expect(tuner).toBe(guitar.stream)
      expect(askedFor(gum)).toEqual([undefined, 'guitar-in'])
    })

    it('keeps the shared stream open while it records from it, past the last consumer and the linger', async () => {
      openEach()
      const voice = asMock(await mgr.acquire('voice'))
      const held = await mgr.acquireFrom('studio', null)

      mgr.release('voice')
      await vi.advanceTimersByTimeAsync(5000)
      expect(voice.track.stop).not.toHaveBeenCalled()
      expect(mgr.getScopedHold()?.stream).toBe(held.stream)

      held.release()
      await vi.advanceTimersByTimeAsync(2000)
      expect(voice.track.stop).toHaveBeenCalled()
      expect(mgr.getStream()).toBeNull()
    })

    it("keeps its input when the app picks another, and the app's consumers open the app's", async () => {
      const gum = openEach()
      const held = await mgr.acquireFrom('studio', null)

      await mgr.setPreferredDevice('guitar-in')
      const guitar = asMock(await mgr.acquire('guitar'))

      expect(asMock(held.stream).track.stop).not.toHaveBeenCalled()
      expect(mgr.getScopedHold()?.stream).toBe(held.stream)
      expect(guitar.track.getSettings().deviceId).toBe('guitar-in')
      expect(askedFor(gum)).toEqual([undefined, 'guitar-in'])
      held.release()
      await vi.advanceTimersByTimeAsync(0)
      expect(asMock(held.stream).track.stop).toHaveBeenCalled()
      expect(guitar.track.stop).not.toHaveBeenCalled()
    })

    it('tells its consumer when the browser ends the shared stream under it', async () => {
      openEach()
      const voice = asMock(await mgr.acquire('voice'))
      await mgr.acquireFrom('studio', null)
      const states: MicState[] = []
      mgr.subscribe((state) => states.push(state))

      endTrack(voice)

      expect(states.at(-1)).toMatchObject({ active: false, scoped: null })
      expect(mgr.getScopedHold()).toBeNull()
    })

    it("opens the input it asks for, not the app's old one, when the app switches to that input as it arms", async () => {
      const gum = openEach()
      await mgr.setPreferredDevice('app-in')
      const voice = asMock(await mgr.acquire('voice'))

      // The Studio arms on the default in the moment the app's input changes to it.
      const arming = mgr.acquireFrom('studio', null)
      const switching = mgr.setPreferredDevice(null)
      const held = asMock((await arming).stream)
      await switching

      expect(held.track.getSettings().deviceId).toBe('default')
      expect(held).not.toBe(voice)
      expect(askedFor(gum)).toEqual(['app-in', undefined])
      expect(voice.track.stop).toHaveBeenCalled()
    })
  })

  describe('a muted input', () => {
    it('counts a mute on its own track that lasts half a second as a lost input, and a shorter one as nothing', async () => {
      openEach()
      const states: MicState[] = []
      mgr.subscribe((state) => states.push(state))
      const studio = asMock((await mgr.acquireFrom('studio', 'usb-1')).stream)

      fire(studio, 'mute')
      await vi.advanceTimersByTimeAsync(499)
      fire(studio, 'unmute')
      await vi.advanceTimersByTimeAsync(1000)
      expect(states.at(-1)?.scoped).toBe('studio')

      // A browser that keeps one capture at a time mutes this one as another opens.
      fire(studio, 'mute')
      await vi.advanceTimersByTimeAsync(500)
      expect(states.at(-1)?.scoped).toBeNull()
      expect(mgr.getScopedHold()).toBeNull()
      expect(studio.track.stop).toHaveBeenCalled()
    })

    it("lets the shared stream's consumers keep it when its track stays muted under the Studio", async () => {
      openEach()
      const voice = asMock(await mgr.acquire('voice'))
      await mgr.acquireFrom('studio', null)

      fire(voice, 'mute')
      await vi.advanceTimersByTimeAsync(500)

      expect(mgr.getScopedHold()).toBeNull()
      expect(voice.track.stop).not.toHaveBeenCalled()
      expect(mgr.getStream()).toBe(voice)
    })

    it('times a mute already under way when the hold starts, as on a shared stream an earlier capture muted', async () => {
      openEach()
      const voice = asMock(await mgr.acquire('voice'))
      // Muted before the Studio arms, so no 'mute' reaches its hold.
      voice.track.muted = true

      await mgr.acquireFrom('studio', null)
      await vi.advanceTimersByTimeAsync(500)

      expect(mgr.getScopedHold()).toBeNull()
      expect(voice.track.stop).not.toHaveBeenCalled()
      expect(mgr.getStream()).toBe(voice)
    })
  })
})
