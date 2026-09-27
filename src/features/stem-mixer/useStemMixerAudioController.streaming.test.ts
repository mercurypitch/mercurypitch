// ============================================================
// A phone plays the song without ever holding it
// ============================================================
//
// The failure this guards against does not raise an error, so no test can
// catch it directly: iOS killed the WKWebView content process during
// `decodeAudioData` and the tab reloaded on its own. What *is* testable is
// the cause, which the dev-log relay pinned exactly —
// `.dev-logs/run3-ios-kill-180mb.log.keep`:
//
//   instrumental.m4a decoded 246.3s @ 48000Hz x2 = 90MB · 90MB resident
//   vocal.m4a        decoded 246.3s @ 48000Hz x2 = 90MB · 180MB resident
//   === (a fresh document, seven seconds later)
//
// So the assertion is that on a phone the mixer no longer decodes a whole
// stem at all: it streams, and what it keeps is a peak envelope for the
// waveform. On a desktop, where 180 MB is unremarkable and raw samples are
// worth having, nothing changes.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DeviceTier from '@/lib/device-tier'
import type { DeviceClass } from '@/lib/device-tier'

let deviceClass: DeviceClass = 'mobile'

vi.mock('@/lib/device-tier', async (importOriginal) => {
  const actual = await importOriginal<typeof DeviceTier>()
  return {
    ...actual,
    // The controller asks the session for its verdict rather than
    // re-classifying, so that `?device=mobile` reaches this path — which
    // means a test that wants a phone has to answer here.
    deviceClass: () => deviceClass,
    classifyDevice: () => deviceClass,
    readDeviceProbe: () => ({
      ...actual.readDeviceProbe(),
      deviceMemoryGb: null,
    }),
  }
})

vi.mock('@/lib/song-audio-cache', () => ({
  readCachedSongAudio: vi.fn(async () => null),
  writeCachedSongAudio: vi.fn(async () => undefined),
}))

const SONG_SECONDS = 246.3
const STEM_RATE = 48_000
const STEM_CHANNELS = 2
/** Chunks the size of an AAC packet, so the stream behaves like a real one. */
const CHUNK_SECONDS = 1024 / STEM_RATE

let openedStreams = 0
let disposedStreams = 0
let chunkIterations = 0

/** False for a WKWebView with no WebCodecs AudioDecoder: nothing streams. */
let decoderPresent = true
/** False for a file this decoder cannot stream (a codec it lacks). */
let streamable = true

vi.mock('./stem-stream-source', () => ({
  canStreamStems: () => decoderPresent,
  openStemStream: vi.fn(async () => {
    if (!decoderPresent || !streamable) return null
    openedStreams++
    return {
      sampleRate: STEM_RATE,
      channelCount: STEM_CHANNELS,
      durationSeconds: SONG_SECONDS,
      chunks: async function* (fromSeconds: number) {
        chunkIterations++
        for (let t = fromSeconds; t < SONG_SECONDS; t += CHUNK_SECONDS) {
          yield {
            buffer: fakeChunkBuffer(Math.min(CHUNK_SECONDS, SONG_SECONDS - t)),
            timestamp: t,
          }
        }
      },
      dispose: () => {
        disposedStreams++
      },
    }
  }),
}))

import type { StemMixerAudioDeps } from './useStemMixerAudioController'
import { useStemMixerAudioController } from './useStemMixerAudioController'

const VOCAL = 'https://cdn.example/song/vocal.m4a'
const INSTRUMENTAL = 'https://cdn.example/song/instrumental.m4a'

function fakeChunkBuffer(seconds: number): AudioBuffer {
  const length = Math.max(1, Math.round(seconds * STEM_RATE))
  const channel = new Float32Array(length).fill(0.5)
  return {
    duration: seconds,
    length,
    numberOfChannels: STEM_CHANNELS,
    sampleRate: STEM_RATE,
    getChannelData: () => channel,
  } as unknown as AudioBuffer
}

/** What `decodeAudioData` would have produced: the whole song, resident. */
function fullyDecodedBuffer(): AudioBuffer {
  return {
    duration: SONG_SECONDS,
    length: Math.round(SONG_SECONDS * STEM_RATE),
    numberOfChannels: STEM_CHANNELS,
    sampleRate: STEM_RATE,
    getChannelData: () => new Float32Array(8),
  } as unknown as AudioBuffer
}

let decodeCalls = 0

function fakeAudioContext(): unknown {
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  })
  const node = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: param(),
  })
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: STEM_RATE,
    destination: {},
    close: vi.fn(async () => Promise.resolve()),
    resume: vi.fn(async () => Promise.resolve()),
    createGain: vi.fn(node),
    createBuffer: vi.fn(
      (channels: number, frames: number, sampleRate: number) => {
        const data = Array.from(
          { length: channels },
          () => new Float32Array(frames),
        )
        return {
          numberOfChannels: channels,
          length: frames,
          sampleRate,
          duration: frames / sampleRate,
          getChannelData: (c: number) => data[c],
          copyToChannel: (src: Float32Array, c: number, offset = 0) => {
            data[c].set(src, offset)
          },
        } as unknown as AudioBuffer
      },
    ),
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
    decodeAudioData: vi.fn(async () => {
      decodeCalls++
      return fullyDecodedBuffer()
    }),
  }
}

function stemTrack(label: string, url: string) {
  return {
    label,
    url,
    color: '#fff',
    buffer: null as AudioBuffer | null,
    stream: null,
    streamVoice: null,
    gainNode: null,
    analyserNode: null,
    sourceNode: null,
    muted: false,
    soloed: false,
    volume: 1,
  }
}

function harness(overrides: Partial<StemMixerAudioDeps> = {}) {
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
    songTitle: 'A long one',
    showNotification: (message: string) => notifications.push(message),
    ...overrides,
  } as unknown as StemMixerAudioDeps

  let controller!: ReturnType<typeof useStemMixerAudioController>
  const disposeRoot = createRoot((dispose) => {
    controller = useStemMixerAudioController(deps)
    return dispose
  })
  return {
    controller,
    notifications,
    vocal,
    instrumental,
    dispose: disposeRoot,
  }
}

/** Every stem the fetch answers is this big. */
let stemBytes = 10 * 1024 * 1024

beforeEach(() => {
  decodeCalls = 0
  openedStreams = 0
  disposedStreams = 0
  chunkIterations = 0
  decoderPresent = true
  streamable = true
  stemBytes = 10 * 1024 * 1024
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(new Uint8Array(stemBytes), {
          headers: { 'content-length': String(stemBytes) },
        }),
    ),
  )
  vi.stubGlobal('AudioContext', function AudioContextStub(): unknown {
    return fakeAudioContext()
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('opening a song on a phone', () => {
  it('never decodes a whole stem', async () => {
    deviceClass = 'mobile'
    const h = harness()
    await h.controller.loadStems()

    // The line that used to read "180MB resident" is not written any more,
    // because the call that wrote it is not made.
    expect(decodeCalls).toBe(0)
    expect(openedStreams).toBe(2)
    h.dispose()
  })

  it('decodes nothing at all while loading', async () => {
    deviceClass = 'mobile'
    const h = harness()
    await h.controller.loadStems()

    // Loading once walked the whole song to draw its waveform. Firefox iOS
    // died inside that pass; Safari finished it, said 13 MB resident, and was
    // killed five seconds later while idle. Nothing is decoded until play.
    expect(chunkIterations).toBe(0)
    h.dispose()
  })

  it('keeps a waveform small enough that the size stops mattering', async () => {
    deviceClass = 'mobile'
    const h = harness()
    await h.controller.loadStems()

    const buffer = h.vocal().buffer
    expect(buffer).not.toBeNull()
    // Mono, a few kilohertz: what the canvas needs and nothing else.
    expect(buffer!.numberOfChannels).toBe(1)
    expect(buffer!.sampleRate).toBeLessThanOrEqual(8000)
    expect(buffer!.duration).toBeCloseTo(SONG_SECONDS, 1)

    const heldBytes =
      buffer!.length * buffer!.numberOfChannels * 4 * /* both stems */ 2
    const decodedBytes = SONG_SECONDS * STEM_RATE * STEM_CHANNELS * 4 * 2
    expect(decodedBytes).toBeGreaterThan(180 * 1024 * 1024)
    expect(heldBytes).toBeLessThan(16 * 1024 * 1024)
    h.dispose()
  })

  it('reports the song’s real length, not the envelope’s bucket count', async () => {
    deviceClass = 'mobile'
    const h = harness()
    await h.controller.loadStems()

    expect(h.controller.duration()).toBeCloseTo(SONG_SECONDS, 1)
    h.dispose()
  })

  it('hands the track a stream to play from', async () => {
    deviceClass = 'mobile'
    const h = harness()
    await h.controller.loadStems()

    expect(h.vocal().stream).not.toBeNull()
    expect(h.instrumental().stream).not.toBeNull()
    h.dispose()
  })

  it('closes its decoders when the room is left', async () => {
    deviceClass = 'mobile'
    const h = harness()
    await h.controller.loadStems()
    expect(disposedStreams).toBe(0)

    h.dispose()
    // A demuxer and a WebCodecs decoder per stem, released with the room.
    expect(disposedStreams).toBe(2)
  })
})

describe('asking a phone for the MIDI practice track', () => {
  it('says why it cannot, instead of an empty silent mixer', async () => {
    // The vocal loads, so the "could not be loaded" error never fired; the
    // MIDI track needs samples a streamed vocal does not have, and the
    // only trace of that was a diagnostic log.
    deviceClass = 'mobile'
    const h = harness({ practiceMode: 'midi' })
    await h.controller.loadStems()

    expect(h.notifications.some((m) => /MIDI practice track/.test(m))).toBe(
      true,
    )
    expect(h.controller.loadError()).toMatch(/MIDI practice track/)
    // Loading again would stream both stems and land here: no Retry.
    expect(h.controller.loadErrorRetryable()).toBe(false)
    h.dispose()
  })
})

describe('opening the same song on a desktop', () => {
  it('still decodes it whole, because it can and the samples are useful', async () => {
    deviceClass = 'desktop'
    const h = harness()
    await h.controller.loadStems()

    expect(decodeCalls).toBe(2)
    expect(openedStreams).toBe(0)
    expect(h.vocal().buffer?.numberOfChannels).toBe(STEM_CHANNELS)
    expect(h.vocal().stream ?? null).toBeNull()
    h.dispose()
  })
})

describe('the Karaoke room, whatever the device says it is (K9)', () => {
  // An Android tablet's user agent reads as a desktop, and a wide phone on
  // its side is not narrow: both were handed a full decode, which is the
  // 180 MB that kills a phone. The room asks for the stream outright.
  it('streams on a device classed desktop when its host asks', async () => {
    deviceClass = 'desktop'
    const h = harness({ forceStream: true } as Partial<StemMixerAudioDeps>)
    await h.controller.loadStems()

    expect(decodeCalls).toBe(0)
    expect(openedStreams).toBe(2)
    expect(h.vocal().stream ?? null).not.toBeNull()
    h.dispose()
  })
})

describe('the Karaoke room on a phone that cannot stream (no AudioDecoder)', () => {
  // Streaming needs WebCodecs' AudioDecoder, and a WKWebView before it
  // arrived has none. The mixer then decoded the song whole ("better a whole
  // decode than no song"), which for a song is the ~180 MiB that killed iOS.
  // The room asked for the stream, so it refuses a song it would have to
  // decode whole, and says why (review item 3, plan S8 §7 rule 2).
  it('refuses a song it would have to decode whole, and says why', async () => {
    deviceClass = 'mobile'
    decoderPresent = false
    const h = harness({ forceStream: true } as Partial<StemMixerAudioDeps>)
    await h.controller.loadStems()

    expect(decodeCalls).toBe(0)
    expect(h.controller.loadError()).toBe(
      "This song needs a newer version of this phone's software to play here. Update it, then open the song again.",
    )
    // Loading it again cannot stream either.
    expect(h.controller.loadErrorRetryable()).toBe(false)
    expect(h.notifications.some((m) => /could not be loaded/u.test(m))).toBe(
      false,
    )
    h.dispose()
  })

  it('still plays a stem small enough to hold whole', async () => {
    deviceClass = 'mobile'
    decoderPresent = false
    stemBytes = 1024 * 1024
    const h = harness({ forceStream: true } as Partial<StemMixerAudioDeps>)
    await h.controller.loadStems()

    expect(decodeCalls).toBe(2)
    expect(h.controller.loadError()).toBe('')
    h.dispose()
  })

  it('refuses the song once a stem is past the line, not before', async () => {
    deviceClass = 'mobile'
    decoderPresent = false
    stemBytes = 2 * 1024 * 1024 + 1
    const h = harness({ forceStream: true } as Partial<StemMixerAudioDeps>)
    await h.controller.loadStems()

    expect(decodeCalls).toBe(0)
    expect(h.controller.loadErrorRetryable()).toBe(false)
    h.dispose()
  })

  it('is about a missing AudioDecoder only: a file the decoder cannot stream is decoded as before', async () => {
    // The room's stems are AAC, which every AudioDecoder streams. The
    // refusal is for the phone that has none (the brief's scope); a codec
    // the decoder lacks still falls back to a whole decode.
    deviceClass = 'mobile'
    streamable = false
    const h = harness({ forceStream: true } as Partial<StemMixerAudioDeps>)
    await h.controller.loadStems()

    expect(decodeCalls).toBe(2)
    expect(h.controller.loadError()).toBe('')
    h.dispose()
  })

  it('leaves the web mixer as it was: it decodes the song whole', async () => {
    deviceClass = 'mobile'
    decoderPresent = false
    const h = harness()
    await h.controller.loadStems()

    expect(decodeCalls).toBe(2)
    expect(h.controller.loadError()).toBe('')
    h.dispose()
  })
})
