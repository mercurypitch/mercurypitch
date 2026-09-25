// ── MicManager lifecycle and acquisition errors ──────────────────────
// Guards the package microphone owner at the browser boundary: capture must
// close before a page publishes the cross-tab lock as free, and browser start
// failures must retain their original diagnostic without guessing contention.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MicLockNamespace from './mic-lock'
import type * as MicManagerNamespace from './mic-manager'

class TestDocument extends EventTarget {
  hidden = false
  title = 'Mic manager test'
}

class TestStorage implements Storage {
  private readonly values = new Map<string, string>()

  constructor(private readonly events: string[]) {}

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.events.push(`storage-remove:${key}`)
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

interface TestTrack {
  addEventListener: ReturnType<typeof vi.fn>
  getSettings: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

interface TestStream {
  getAudioTracks: () => TestTrack[]
  getTracks: () => TestTrack[]
}

type MicManagerModule = typeof MicManagerNamespace
type MicLockModule = typeof MicLockNamespace

const LOCK_KEY = 'mercurypitch_mic_holder'

let managerModule: MicManagerModule | null = null
let lockModule: MicLockModule | null = null
let browserWindow: EventTarget
let getUserMedia: ReturnType<typeof vi.fn>
let lifecycleEvents: string[]

function makeStream(): { stream: TestStream; track: TestTrack } {
  const track: TestTrack = {
    addEventListener: vi.fn(),
    getSettings: vi.fn(() => ({})),
    stop: vi.fn(() => {
      lifecycleEvents.push('track-stop')
    }),
  }
  return {
    stream: {
      getAudioTracks: () => [track],
      getTracks: () => [track],
    },
    track,
  }
}

async function importMicModules(): Promise<{
  manager: MicManagerModule
  lock: MicLockModule
}> {
  managerModule = await import('./mic-manager')
  lockModule = await import('./mic-lock')
  return { manager: managerModule, lock: lockModule }
}

beforeEach(() => {
  vi.resetModules()
  lifecycleEvents = []
  browserWindow = new EventTarget()
  getUserMedia = vi.fn()
  vi.stubGlobal('window', browserWindow)
  vi.stubGlobal('document', new TestDocument())
  vi.stubGlobal('localStorage', new TestStorage(lifecycleEvents))
  vi.stubGlobal('BroadcastChannel', undefined)
  vi.stubGlobal('navigator', {
    mediaDevices: {
      enumerateDevices: vi.fn(async () => []),
      getUserMedia,
    },
  })
})

afterEach(async () => {
  await managerModule?.micManager.forceReleaseAll()
  managerModule = null
  lockModule = null
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('capture startup failures', () => {
  it.each(['NotReadableError', 'AbortError', 'TrackStartError'])(
    'keeps the %s browser diagnostic while using neutral guidance',
    async (name) => {
      vi.useFakeTimers()
      const original = new Error('Browser could not initialize the input')
      original.name = name
      getUserMedia.mockRejectedValue(original)
      const { manager } = await importMicModules()
      const micManager = new manager.MicManager()

      const acquisition = micManager.acquire('startup-failure-test')
      const expected = {
        kind: 'device-busy',
        message:
          'The microphone could not start. Check the selected input and try again.',
        diagnostic: {
          name,
          message: 'Browser could not initialize the input',
        },
      }
      const rejection = acquisition.catch((error: unknown) => error)

      await vi.advanceTimersByTimeAsync(250)

      expect(await rejection).toEqual(expected)
      expect(getUserMedia).toHaveBeenCalledTimes(2)
      expect(micManager.getError()).toEqual(expected)
    },
  )

  it('keeps a newer preferred route when an older exact-device request falls back', async () => {
    let rejectMissingDevice: ((error: unknown) => void) | undefined
    const missingDevice = new Promise<MediaStream>((_resolve, reject) => {
      rejectMissingDevice = reject
    })
    const fallback = makeStream()
    const newer = makeStream()
    getUserMedia
      .mockReturnValueOnce(missingDevice)
      .mockResolvedValueOnce(fallback.stream)
      .mockResolvedValueOnce(newer.stream)
    const { manager } = await importMicModules()
    await manager.micManager.setPreferredDevice('missing-a')

    const oldAcquisition = manager.micManager.acquire('old-route')
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
    const newerPreference = manager.micManager.setPreferredDevice('newer-b')
    const missing = new Error('Requested device is unavailable')
    missing.name = 'OverconstrainedError'
    rejectMissingDevice?.(missing)

    await oldAcquisition
    await newerPreference
    await manager.micManager.acquire('new-route')

    expect(getUserMedia).toHaveBeenCalledTimes(3)
    expect(getUserMedia.mock.calls[2]?.[0]).toMatchObject({
      audio: { deviceId: { exact: 'newer-b' } },
    })
    expect(manager.micManager.getPreferredDevice()).toBe('newer-b')
  })
})

describe('pagehide capture teardown', () => {
  it('does not release a newer claim created while teardown settles', async () => {
    const { lock } = await importMicModules()
    expect(lock.claimMicLock().outcome).toBe('granted')
    let markHandlerComplete: (() => void) | undefined
    const handlerComplete = new Promise<void>((resolve) => {
      markHandlerComplete = resolve
    })
    lock.setMicYieldHandler(() => {
      lock.releaseMicLock()
      expect(lock.claimMicLock().outcome).toBe('granted')
      markHandlerComplete?.()
    })

    browserWindow.dispatchEvent(new Event('pagehide'))
    await handlerComplete
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(lock.micLockStatus()).toBe('mine')
  })

  it('releases the original claim after a custom handler only stops capture', async () => {
    const { lock } = await importMicModules()
    expect(lock.claimMicLock().outcome).toBe('granted')
    const stopCapture = vi.fn()
    lock.setMicYieldHandler(stopCapture)

    browserWindow.dispatchEvent(new Event('pagehide'))

    await vi.waitFor(() => expect(stopCapture).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(lock.micLockStatus()).toBe('free'))
  })

  it('stops a live BFCache capture before publishing the lock as free', async () => {
    const { stream, track } = makeStream()
    getUserMedia.mockResolvedValue(stream)
    const { manager, lock } = await importMicModules()

    await manager.micManager.acquire('pagehide-live-test')
    expect(lock.micLockStatus()).toBe('mine')

    browserWindow.dispatchEvent(
      Object.assign(new Event('pagehide'), { persisted: true }),
    )

    await vi.waitFor(() => expect(track.stop).toHaveBeenCalledOnce())
    expect(manager.micManager.getStream()).toBeNull()
    expect(manager.micManager.getConsumers()).toEqual([])
    expect(lock.micLockStatus()).toBe('free')
    expect(lifecycleEvents.indexOf('track-stop')).toBeLessThan(
      lifecycleEvents.indexOf(`storage-remove:${LOCK_KEY}`),
    )
  })

  it('queues teardown behind an acquire pending before the lock is claimed', async () => {
    let resolveCapture: ((stream: TestStream) => void) | undefined
    const capture = new Promise<TestStream>((resolve) => {
      resolveCapture = resolve
    })
    const { stream, track } = makeStream()
    getUserMedia.mockReturnValue(capture)
    const { manager, lock } = await importMicModules()

    const acquisition = manager.micManager.acquire('pagehide-pending-test')
    browserWindow.dispatchEvent(
      Object.assign(new Event('pagehide'), { persisted: true }),
    )

    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
    expect(lock.micLockStatus()).toBe('mine')
    expect(track.stop).not.toHaveBeenCalled()

    resolveCapture?.(stream)
    await acquisition
    await vi.waitFor(() => expect(track.stop).toHaveBeenCalledOnce())

    expect(manager.micManager.getStream()).toBeNull()
    expect(manager.micManager.getConsumers()).toEqual([])
    expect(lock.micLockStatus()).toBe('free')
    expect(lifecycleEvents.indexOf('track-stop')).toBeLessThan(
      lifecycleEvents.indexOf(`storage-remove:${LOCK_KEY}`),
    )
  })
})
