// ============================================================
// StemMixer — what the stem download costs, and what it holds on to
// ============================================================
//
// Two things the owner hit on an iPhone on a slow link, both of them in
// this one function:
//
//   * the demo song downloaded in full on every single open. R2 serves it
//     with an ETag and no `Cache-Control` at all, so the browser had
//     nothing to go on and Safari re-fetched all six megabytes. The app
//     keeps its own copy now.
//   * the phone locked its screen mid-download, the OS froze the page,
//     the fetch was torn down, and the session came back dead. A screen
//     wake lock is held for the length of the load.
//
// Every test drives the real `loadStems`, because the interesting parts —
// the phase the bar reports, what is counted as "arrived", when the lock
// is let go — are all in the ordering rather than in any one line.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SONG_AUDIO_CACHE_NAME } from '@/lib/song-audio-cache'
import type { StemMixerAudioDeps } from './useStemMixerAudioController'
import { useStemMixerAudioController } from './useStemMixerAudioController'

const VOCAL = 'https://cdn.example/demo/vocal.m4a'
const INSTRUMENTAL = 'https://cdn.example/demo/instrumental.m4a'

// ── Fakes ──────────────────────────────────────────────────────

class FakeCache {
  readonly entries = new Map<string, Response>()

  async match(key: RequestInfo | URL): Promise<Response | undefined> {
    return Promise.resolve(this.entries.get(String(key))?.clone())
  }

  async put(key: RequestInfo | URL, value: Response): Promise<void> {
    this.entries.set(String(key), value)
    return Promise.resolve()
  }

  async keys(): Promise<Request[]> {
    return Promise.resolve(
      [...this.entries.keys()].map((url) => ({ url }) as unknown as Request),
    )
  }

  async delete(): Promise<boolean> {
    return Promise.resolve(true)
  }
}

function fakeBuffer(duration: number): AudioBuffer {
  return {
    duration,
    length: Math.ceil(duration * 48_000),
    numberOfChannels: 1,
    sampleRate: 48_000,
    getChannelData: () => new Float32Array(8),
  } as unknown as AudioBuffer
}

function fakeAudioContext() {
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  })
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 48_000,
    destination: {},
    resume: vi.fn(async () => Promise.resolve()),
    close: vi.fn(async () => Promise.resolve()),
    createGain: vi.fn(() => ({
      gain: param(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createAnalyser: vi.fn(() => ({
      fftSize: 2048,
      smoothingTimeConstant: 0,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
    })),
    decodeAudioData: vi.fn(async () => Promise.resolve(fakeBuffer(180))),
  }
}

function stemTrack(label: string, url: string) {
  return {
    label,
    url,
    color: '#fff',
    buffer: null,
    gainNode: null,
    analyserNode: null,
    sourceNode: null,
    muted: false,
    soloed: false,
    volume: 1,
  }
}

/** Everything `loadStems` reads, and inert stand-ins for the rest. */
function makeDeps(over: Partial<StemMixerAudioDeps> = {}): {
  deps: StemMixerAudioDeps
  notifications: string[]
} {
  const [vocal, setVocal] = createSignal(stemTrack('Vocal', VOCAL))
  const [instrumental, setInstrumental] = createSignal(
    stemTrack('Instrumental', INSTRUMENTAL),
  )
  const [midi, setMidi] = createSignal(stemTrack('MIDI', ''))
  const [extras, setExtras] = createSignal<ReturnType<typeof stemTrack>[]>([])
  const [midiNotes, setMidiNotes] = createSignal([])
  const notifications: string[] = []

  const noop = (): void => undefined
  const deps = {
    vocal,
    setVocal,
    instrumental,
    setInstrumental,
    midi,
    setMidi,
    extras,
    setExtras,
    tracks: () => [vocal(), instrumental()],
    anySoloed: () => false,
    PITCH_WINDOW_FILL_RATIO: 0.8,
    midiNotes,
    setMidiNotes,
    canvas: {
      syncCanvasSizes: noop,
      drawWaveformOverview: noop,
      drawLiveWaveform: noop,
      drawPitchCanvas: noop,
      drawMidiCanvas: noop,
    },
    updateCurrentLine: noop,
    setCurrentLineIdx: noop,
    setUserScrolled: noop,
    micActive: () => false,
    getMicAnalyserNode: () => null,
    getMicPitchDetector: () => null,
    getMicPitchHistory: () => [],
    setMicPitch: noop,
    comparisonData: () => [],
    pushComparison: noop,
    markLoopIteration: noop,
    clearComparisonData: noop,
    resetMicPitchHistory: noop,
    computeScore: () => ({}),
    setScore: noop,
    setShowScore: noop,
    resetScore: noop,
    stems: { vocal: VOCAL, instrumental: INSTRUMENTAL },
    songTitle: 'Goodbye to Spring',
    showNotification: (message: string) => notifications.push(message),
    ...over,
  } as unknown as StemMixerAudioDeps

  return { deps, notifications }
}

interface Harness {
  controller: ReturnType<typeof useStemMixerAudioController>
  notifications: string[]
  dispose: () => void
}

function harness(over: Partial<StemMixerAudioDeps> = {}): Harness {
  const { deps, notifications } = makeDeps(over)
  let controller!: ReturnType<typeof useStemMixerAudioController>
  const dispose = createRoot((disposeRoot) => {
    controller = useStemMixerAudioController(deps)
    return disposeRoot
  })
  return { controller, notifications, dispose }
}

// ── Environment ────────────────────────────────────────────────

let cache: FakeCache
let openedCaches: string[]
let fetchStub: ReturnType<typeof vi.fn>
let wakeRequests: number
let wakeReleases: number

/**
 * The copy is written without being awaited — the decode must not wait on
 * storage — so a test that checks it right after `loadStems` resolves is
 * looking one microtask too early.
 */
async function settledCacheEntries(expected: number): Promise<string[]> {
  await vi.waitFor(() => expect(cache.entries.size).toBe(expected))
  return [...cache.entries.keys()].sort()
}

function respondWith(bytes: number): Response {
  return new Response(new Uint8Array(bytes), {
    headers: { 'content-length': String(bytes) },
  })
}

beforeEach(() => {
  cache = new FakeCache()
  openedCaches = []
  Object.defineProperty(globalThis, 'caches', {
    value: {
      open: async (name: string) => {
        openedCaches.push(name)
        return Promise.resolve(cache)
      },
    },
    configurable: true,
    writable: true,
  })

  fetchStub = vi.fn(async () => Promise.resolve(respondWith(2048)))
  vi.stubGlobal('fetch', fetchStub)
  // `new AudioContext()` — a constructor, so an arrow-shaped mock cannot
  // stand in for it. A constructor that returns an object hands back that
  // object, which is exactly the seam wanted here.
  vi.stubGlobal('AudioContext', function AudioContextStub(): unknown {
    return fakeAudioContext()
  })

  wakeRequests = 0
  wakeReleases = 0
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    writable: true,
    value: {
      request: async () => {
        wakeRequests += 1
        return Promise.resolve({
          release: async () => {
            wakeReleases += 1
            return Promise.resolve()
          },
          addEventListener: () => undefined,
        })
      },
    },
  })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis as unknown as object, 'caches')
  Reflect.deleteProperty(navigator as unknown as object, 'wakeLock')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────

describe('the stems download once', () => {
  it('keeps each stem and serves the next open from the copy', async () => {
    const first = harness()
    await first.controller.loadStems()

    expect(fetchStub).toHaveBeenCalledTimes(2)
    expect(await settledCacheEntries(2)).toEqual([INSTRUMENTAL, VOCAL].sort())
    expect(new Set(openedCaches)).toEqual(new Set([SONG_AUDIO_CACHE_NAME]))
    expect(first.controller.loadError()).toBe('')
    first.dispose()

    // A second visit to the same song — the whole point of the copy.
    const second = harness()
    await second.controller.loadStems()

    expect(fetchStub).toHaveBeenCalledTimes(2)
    expect(second.controller.duration()).toBe(180)
    expect(second.controller.loadError()).toBe('')
    second.dispose()
  })

  it('shows a cached stem as arrived rather than as never started', async () => {
    const first = harness()
    await first.controller.loadStems()
    await settledCacheEntries(2)
    first.dispose()

    const second = harness()
    await second.controller.loadStems()

    // Bytes are what the bar is measured in; a hit that reported none read
    // as a download stuck at zero for as long as the decode took.
    expect(fetchStub).toHaveBeenCalledTimes(2)
    expect(second.controller.loadedBytes()).toBe(4096)
    expect(second.controller.loadProgress()).toBe(100)
    second.dispose()
  })

  it('keeps no copy of stems that were never remote', async () => {
    const local = harness({
      stems: { vocal: 'blob:local-vocal', instrumental: 'blob:local-inst' },
    })
    await local.controller.loadStems()

    expect(cache.entries.size).toBe(0)
    expect(local.controller.loadError()).toBe('')
    local.dispose()
  })

  it('says so when nothing usable arrived at all', async () => {
    fetchStub.mockRejectedValue(new Error('network gone'))
    const failed = harness()
    await failed.controller.loadStems()

    expect(failed.controller.loadError()).toContain('could not be loaded')
    expect(failed.notifications.join(' ')).toContain('could not be loaded')
    expect(cache.entries.size).toBe(0)
    failed.dispose()
  })

  it('starts over cleanly when the failed load is retried', async () => {
    fetchStub.mockRejectedValueOnce(new Error('network gone'))
    fetchStub.mockRejectedValueOnce(new Error('network gone'))
    const retried = harness()
    await retried.controller.loadStems()
    expect(retried.controller.loadError()).not.toBe('')

    // What the phone's "Try again" does. The bar is reset and the error
    // cleared before the first byte, or the retry looks like the failure.
    await retried.controller.loadStems()
    expect(retried.controller.loadError()).toBe('')
    expect(await settledCacheEntries(2)).toHaveLength(2)
    retried.dispose()
  })
})

describe('the screen stays awake for the download', () => {
  it('holds a lock for the length of the load and lets it go after', async () => {
    const held = harness()
    await held.controller.loadStems()

    expect(wakeRequests).toBe(1)
    expect(wakeReleases).toBe(1)
    held.dispose()
  })

  it('lets the lock go even when the load failed', async () => {
    fetchStub.mockRejectedValue(new Error('network gone'))
    const failed = harness()
    await failed.controller.loadStems()

    // A lock never released is a phone that will not sleep for the rest of
    // the session, which is worse than the problem it was taken for.
    expect(wakeReleases).toBe(wakeRequests)
    failed.dispose()
  })
})
