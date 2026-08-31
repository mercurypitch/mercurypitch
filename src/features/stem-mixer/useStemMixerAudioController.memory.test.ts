// ============================================================
// A phone loads the band one stem at a time
// ============================================================
//
// The unit half of this lives in stem-memory.test.ts, which fixes the sizes
// and the budget. This half is about the ordering, which is the part that
// actually killed the tab: `Promise.allSettled(extras.map(loadOne))` had
// every stem's compressed download AND its decoded buffer resident at the
// same moment, so the peak was the whole band at once rather than the whole
// band one at a time. Both totals are too big for an iPhone, but only the
// peak is reached before the trim can do anything about it.
//
// Device detection is mocked rather than driven through jsdom's navigator:
// `classifyDevice` reads a user agent, touch points, screen size and
// hardwareConcurrency together, and a test that stubbed all four would be
// asserting on that function instead of on this one.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DeviceTier from '@/lib/device-tier'
import type { DeviceClass } from '@/lib/device-tier'

let deviceClass: DeviceClass = 'mobile'

vi.mock('@/lib/device-tier', async (importOriginal) => {
  const actual = await importOriginal<typeof DeviceTier>()
  return {
    ...actual,
    classifyDevice: () => deviceClass,
    readDeviceProbe: () => ({
      ...actual.readDeviceProbe(),
      deviceMemoryGb: null,
    }),
  }
})

import type { StemMixerAudioDeps } from './useStemMixerAudioController'
import { useStemMixerAudioController } from './useStemMixerAudioController'

const VOCAL = 'https://cdn.example/song/vocal.m4a'
const INSTRUMENTAL = 'https://cdn.example/song/instrumental.m4a'
const PARTS = ['drums', 'bass', 'guitar', 'piano', 'other'] as const

/** Long enough that five stereo stems cannot fit a phone's budget. */
const SONG_SECONDS = 210

function fakeBuffer(): AudioBuffer {
  return {
    duration: SONG_SECONDS,
    length: SONG_SECONDS * 44_100,
    numberOfChannels: 2,
    sampleRate: 44_100,
    getChannelData: () => new Float32Array(8),
  } as unknown as AudioBuffer
}

/** Peak overlap of in-flight downloads — the number that had to come down. */
let inFlight = 0
let peakInFlight = 0
let releaseFetch: Array<() => void> = []

function fakeAudioContext(): unknown {
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  })
  const node = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: param(),
  })
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 44_100,
    destination: {},
    close: vi.fn(async () => Promise.resolve()),
    resume: vi.fn(async () => Promise.resolve()),
    createGain: vi.fn(node),
    createBufferSource: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
      playbackRate: param(),
    })),
    createWaveShaper: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createDynamicsCompressor: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
    })),
    createAnalyser: vi.fn(() => ({
      fftSize: 2048,
      smoothingTimeConstant: 0,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
    })),
    decodeAudioData: vi.fn(async () => Promise.resolve(fakeBuffer())),
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

function harness(): {
  controller: ReturnType<typeof useStemMixerAudioController>
  notifications: string[]
  dispose: () => void
} {
  const [vocal, setVocal] = createSignal(stemTrack('Vocal', VOCAL))
  const [instrumental, setInstrumental] = createSignal(
    stemTrack('Instrumental', INSTRUMENTAL),
  )
  const [midi, setMidi] = createSignal(stemTrack('MIDI', ''))
  const [extras, setExtras] = createSignal(
    PARTS.map((p) => stemTrack(p, `https://cdn.example/song/${p}.m4a`)),
  )
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
    songTitle: 'Full band',
    showNotification: (message: string) => notifications.push(message),
  } as unknown as StemMixerAudioDeps

  let controller!: ReturnType<typeof useStemMixerAudioController>
  const disposeRoot = createRoot((dispose) => {
    controller = useStemMixerAudioController(deps)
    return dispose
  })
  return { controller, notifications, dispose: disposeRoot }
}

beforeEach(() => {
  inFlight = 0
  peakInFlight = 0
  releaseFetch = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      inFlight += 1
      peakInFlight = Math.max(peakInFlight, inFlight)
      // Held open for a turn so genuinely parallel loads overlap here rather
      // than each resolving before the next is even issued — otherwise the
      // peak reads 1 whatever the code does.
      await new Promise<void>((resolve) => {
        releaseFetch.push(resolve)
        setTimeout(resolve, 0)
      })
      inFlight -= 1
      return new Response(new Uint8Array(2048), {
        headers: { 'content-length': '2048' },
      })
    }),
  )
  vi.stubGlobal('AudioContext', function AudioContextStub(): unknown {
    return fakeAudioContext()
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('loading a full band on a phone', () => {
  it('never has more than one stem in flight', async () => {
    deviceClass = 'mobile'
    const h = harness()
    await h.controller.loadStems()

    // The named pair still loads together — that is the two-stem path
    // Karaoke Night uses and it was never the problem. The extras, which
    // are what a play-along preset adds, go one at a time.
    expect(peakInFlight).toBeLessThanOrEqual(2)
    h.dispose()
  })

  it('says which stems it left out rather than dying silently', async () => {
    deviceClass = 'mobile'
    const h = harness()
    await h.controller.loadStems()

    // Seven stems of a 3.5-minute stereo song is ~500MB decoded. The tab
    // used to be killed for asking; now the mixer opens and explains.
    const said = h.notifications.join(' ')
    expect(said).toMatch(/cannot hold all/i)
    expect(said).toMatch(/stems/i)
    h.dispose()
  })
})

describe('loading the same band on a desktop', () => {
  it('still loads the extras together', async () => {
    deviceClass = 'desktop'
    const h = harness()
    await h.controller.loadStems()

    expect(peakInFlight).toBeGreaterThan(2)
    h.dispose()
  })

  it('leaves the mix complete and says nothing about memory', async () => {
    deviceClass = 'desktop'
    const h = harness()
    await h.controller.loadStems()

    expect(h.notifications.join(' ')).not.toMatch(/cannot hold all/i)
    h.dispose()
  })
})
