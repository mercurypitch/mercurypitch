// ============================================================
// StemMixer — a song packaged inside the app (K2)
// ============================================================
//
// The Karaoke room's example songs ship inside the native app and are read
// from the WebView's own scheme. On iOS that read answers status 0 and
// `ok: false` with the whole file in the body (see
// `@irchiinnuss/mobile-runtime/asset-fetch`), and every place the mixer
// fetched a stem threw on `!resp.ok` before reading a byte: the bundled
// songs were silent on an iPhone. Each test drives the real controller
// against exactly that response.

import { createRoot, createSignal } from 'solid-js'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StemMixerAudioDeps } from './useStemMixerAudioController'
import { useStemMixerAudioController } from './useStemMixerAudioController'

const VOCAL = '/karaoke/examples/goodbye-to-spring/vocal.m4a'
const INSTRUMENTAL = '/karaoke/examples/goodbye-to-spring/instrumental.m4a'

/** A real Response, reporting itself the way WKWebView reports a packaged file. */
function packaged(bytes: number): Response {
  const real = new Response(new Uint8Array(bytes))
  return new Proxy(real, {
    get(target, prop) {
      if (prop === 'ok') return false
      if (prop === 'status') return 0
      const value: unknown = Reflect.get(target, prop, target)
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value
    },
  })
}

/** What an opaque answer looks like: status 0 as well, and nothing in it. */
function opaque(): Response {
  return packaged(0)
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
    createWaveShaper: vi.fn(() => ({
      curve: null as Float32Array | null,
      oversample: 'none' as OverSampleType,
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
    decodeAudioData: vi.fn(async () => Promise.resolve(fakeBuffer(246))),
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

function harness() {
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
    tracks: () => [vocal(), instrumental(), ...extras()],
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
  } as unknown as StemMixerAudioDeps

  let controller!: ReturnType<typeof useStemMixerAudioController>
  const dispose = createRoot((disposeRoot) => {
    controller = useStemMixerAudioController(deps)
    return disposeRoot
  })
  return { controller, extras, notifications, dispose }
}

let fetchStub: Mock<(...args: unknown[]) => Promise<Response>>

beforeEach(() => {
  fetchStub = vi.fn(async () => Promise.resolve(packaged(2048)))
  vi.stubGlobal('fetch', fetchStub)
  vi.stubGlobal('AudioContext', function AudioContextStub(): unknown {
    return fakeAudioContext()
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('a song packaged inside the app', () => {
  it('loads when every stem answers status 0 with its body', async () => {
    const { controller, dispose } = harness()
    await controller.loadStems()
    expect(controller.loadError()).toBe('')
    expect(controller.duration()).toBe(246)
    expect(fetchStub).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('still fails, naming the file, when the answer is empty', async () => {
    fetchStub.mockImplementation(async () => Promise.resolve(opaque()))
    const { controller, dispose } = harness()
    await controller.loadStems()
    expect(controller.loadError()).not.toBe('')
    dispose()
  })

  it('adds one more stem from the package', async () => {
    const { controller, extras, dispose } = harness()
    const added = await controller.addExtraStem({
      label: 'Drums',
      color: '#f00',
      url: '/karaoke/examples/goodbye-to-spring/drums.m4a',
    })
    expect(added).toBe(true)
    expect(extras()).toHaveLength(1)
    dispose()
  })

  it('hands a packaged stem to the download as its bytes', async () => {
    const made: Blob[] = []
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (blob: Blob) => {
        made.push(blob)
        return 'blob:stem'
      },
      revokeObjectURL: () => undefined,
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    )
    const { controller, dispose } = harness()
    await controller.handleDownload(
      stemTrack('Vocal', VOCAL) as unknown as Parameters<
        typeof controller.handleDownload
      >[0],
    )
    expect(made.map((blob) => blob.size)).toEqual([2048])
    dispose()
  })
})
