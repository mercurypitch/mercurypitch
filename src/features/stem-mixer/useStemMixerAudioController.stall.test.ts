// ============================================================
// A song whose clock stops while it plays, in the room that hosts it
// ============================================================
//
// The owner's song stuck on a TV over AirPlay with no error (2 Nov 2026).
// Here the whole controller plays a streamed song on a clock the test
// moves by hand: a clock that stops is warned of with the route and the
// stream, asked back once, and a song whose clock still stands is paused,
// its clock parked and the room told, where it used to sit "playing" at a
// fixed place. The watchdog's own rules are in clock-watchdog.test.ts.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DeviceTier from '@/lib/device-tier'

vi.mock('@/lib/device-tier', async (importOriginal) => {
  const actual = await importOriginal<typeof DeviceTier>()
  // A phone: the stems stream, which is what the room plays on one.
  return {
    ...actual,
    deviceClass: () => 'mobile',
    classifyDevice: () => 'mobile',
    readDeviceProbe: () => ({
      ...actual.readDeviceProbe(),
      deviceMemoryGb: null,
    }),
  }
})
vi.mock('./stream-switches', () => ({
  decodePastGuard: () => false,
  noStreamForced: () => false,
}))
vi.mock('@/lib/song-audio-cache', () => ({
  readCachedSongAudio: vi.fn(async () => null),
  writeCachedSongAudio: vi.fn(async () => undefined),
}))

const SONG_SECONDS = 246.3
const RATE = 48_000
/** Chunks the size of an AAC packet, as a real stream yields them. */
const CHUNK_SECONDS = 1024 / RATE

function chunkBuffer(seconds: number): AudioBuffer {
  const length = Math.max(1, Math.round(seconds * RATE))
  const channel = new Float32Array(length).fill(0.5)
  return {
    duration: seconds,
    length,
    numberOfChannels: 2,
    sampleRate: RATE,
    getChannelData: () => channel,
  } as unknown as AudioBuffer
}

vi.mock('./stem-stream-source', () => ({
  canStreamStems: () => true,
  openStemStream: vi.fn(async () => ({
    sampleRate: RATE,
    channelCount: 2,
    durationSeconds: SONG_SECONDS,
    chunks: async function* (fromSeconds: number) {
      for (let t = fromSeconds; t < SONG_SECONDS; t += CHUNK_SECONDS) {
        yield { buffer: chunkBuffer(CHUNK_SECONDS), timestamp: t }
      }
    },
    dispose: () => undefined,
  })),
  readStemShape: vi.fn(async () => null),
}))

import { audioDiagnosticEntries, resetAudioDiagnosticsForTests, } from '@/lib/audio-diagnostics'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { STALL_MS } from './clock-watchdog'
import type { StemMixerAudioDeps } from './useStemMixerAudioController'
import { useStemMixerAudioController } from './useStemMixerAudioController'

/** The app's one clock, which the test moves as the audio thread would. */
class Clock extends EventTarget {
  state = 'running'
  currentTime = 0
  sampleRate = RATE
  destination = {}
  resume = vi.fn(async () => {
    this.goes('running')
    return Promise.resolve()
  })
  suspend = vi.fn(async () => {
    this.goes('suspended')
    return Promise.resolve()
  })
  close = vi.fn(async () => Promise.resolve())
  createGain = () => node({ gain: param() })
  createWaveShaper = () => node({ curve: null, oversample: '' })
  createAnalyser = () =>
    node({
      fftSize: 2048,
      smoothingTimeConstant: 0,
      getFloatTimeDomainData() {},
    })
  createDynamicsCompressor = () =>
    node({
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
    })
  createBufferSource = () =>
    node({ buffer: null, playbackRate: param(), start() {}, stop() {} })
  createBuffer = (channels: number, frames: number, sampleRate: number) => {
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
    }
  }

  goes(state: string): void {
    this.state = state
    this.dispatchEvent(new Event('statechange'))
  }
}

function param() {
  return {
    value: 1,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
  }
}

function node<T extends object>(extra: T) {
  return { connect: (to: unknown) => to, disconnect() {}, ...extra }
}

function stemTrack(label: string, url: string) {
  return {
    label,
    url,
    color: '#fff',
    buffer: null,
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

function harness(inTheRoom = true) {
  const clock = new Clock()
  const [vocal, setVocal] = createSignal(stemTrack('Vocal', '/v.m4a'))
  const [instrumental, setInstrumental] = createSignal(
    stemTrack('Instrumental', '/i.m4a'),
  )
  const [midi, setMidi] = createSignal(stemTrack('MIDI', ''))
  const [extras, setExtras] = createSignal([])
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
    stems: { vocal: '/v.m4a', instrumental: '/i.m4a' },
    songTitle: 'Goodbye to Spring',
    showNotification: (message: string) => notifications.push(message),
    forceStream: true,
    followEndWhileHidden: inTheRoom,
    audioLease: {
      ensure: () => clock as unknown as AudioContext,
      unlock: vi.fn(async () => clock.resume().then(() => true)),
    },
  } as unknown as StemMixerAudioDeps
  let controller!: ReturnType<typeof useStemMixerAudioController>
  const dispose = createRoot((disposeRoot) => {
    controller = useStemMixerAudioController(deps)
    return disposeRoot
  })
  return { clock, controller, notifications, dispose }
}

/** Loads the song, then plays it on fake timers, its streams filled. */
async function playing(inTheRoom = true) {
  const h = harness(inTheRoom)
  await h.controller.loadStems()
  // Timers and the wall clock only: the frames stay off, as on a page that
  // is not drawing, so nothing but the watch can notice the song's end.
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
    ],
  })
  h.controller.handlePlay()
  await vi.advanceTimersByTimeAsync(0)
  /** Wall time passes; the clock moves `rate` seconds a second. */
  const pass = async (ms: number, rate: number): Promise<void> => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      h.clock.currentTime += (rate * 50) / 1000
      await vi.advanceTimersByTimeAsync(50)
    }
  }
  return {
    ...h,
    running: async (ms: number) => pass(ms, 1),
    standing: async (ms: number) => pass(ms, 0),
  }
}

const recorded = (event: string) =>
  audioDiagnosticEntries().filter((entry) => entry.event === event)

beforeEach(() => {
  resetAudioDiagnosticsForTests()
  setAudioRouteForTests('airplay', 'LG C2')
  // No frames: what moves the song here is the clock alone.
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array(4096))),
  )
  // The unlock clip a press of play starts (audio-unlock.ts).
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setAudioRouteForTests(null)
})

describe('a clock that stops while the song plays', () => {
  it('warns with the clock’s state, the route and the stream, and asks the clock back once', async () => {
    const h = await playing()
    await h.running(1000)

    await h.standing(STALL_MS + 250)

    const [stall] = recorded('clock-stall')
    expect(recorded('clock-stall')).toHaveLength(1)
    expect(stall).toMatchObject({
      source: 'karaoke',
      failed: true,
      detail: {
        state: 'running',
        route: 'airplay',
        port: 'LG C2',
        feeding: 'yes',
      },
    })
    // The stream had its windows ready: the clock stopped on its own.
    expect(stall.detail.queued).toBeGreaterThan(0)
    expect(stall.detail.position).toBeCloseTo(1, 1)
    expect(recorded('clock-restart')).toHaveLength(1)
    expect(h.clock.suspend).toHaveBeenCalledTimes(1)
    expect(h.controller.playing()).toBe(true)
    h.dispose()
  })

  it('says so in a warning line the console shows by default', async () => {
    const h = await playing()
    await h.running(1000)

    await h.standing(STALL_MS + 250)

    const warned = vi.mocked(console.warn).mock.calls.map(([line]) => line)
    expect(warned).toContainEqual(
      expect.stringMatching(
        /^\[audio\] \d\d:\d\d:\d\d\.\d{3} karaoke clock-stall state=running route=airplay port=LG C2 feeding=yes queued=[\d.]+ position=[\d.]+ clock=[\d.]+ stoodMs=\d+$/,
      ),
    )
    h.dispose()
  })

  it('plays on, and says so once more, when the clock moves again', async () => {
    const h = await playing()
    await h.running(1000)
    await h.standing(STALL_MS + 250)

    await h.running(1000)

    const moving = recorded('clock-moving')
    expect(moving).toHaveLength(1)
    expect(moving[0].failed).toBe(false)
    expect(moving[0].detail.stoodMs).toBeGreaterThanOrEqual(STALL_MS)
    const said = vi.mocked(console.info).mock.calls.map(([line]) => line)
    expect(said).toContainEqual(
      expect.stringMatching(/ karaoke clock-moving .*stoodMs=\d+$/),
    )
    expect(h.controller.playing()).toBe(true)
    expect(h.controller.stalled()).toBe(false)
    h.dispose()
  })

  it('stops the song where it was, parks the clock and marks it, when it still stands', async () => {
    const h = await playing()
    await h.running(1000)
    await h.standing(STALL_MS + 250)

    await h.standing(STALL_MS + 250)

    expect(recorded('clock-stall-stop')).toHaveLength(1)
    expect(recorded('clock-stall-stop')[0].failed).toBe(true)
    // No more "playing" at a fixed time: the transport says paused.
    expect(h.controller.playing()).toBe(false)
    expect(h.controller.stalled()).toBe(true)
    expect(h.controller.elapsed()).toBeCloseTo(1, 1)
    // Parked, so the next press of play starts the clock for real.
    expect(h.clock.state).toBe('suspended')
    // The room says why; no toast over it.
    expect(h.notifications).toEqual([])
    // Asked back once, and only once.
    expect(recorded('clock-restart')).toHaveLength(1)
    h.dispose()
  })

  it('clears the mark on the next press of play', async () => {
    const h = await playing()
    await h.running(1000)
    await h.standing((STALL_MS + 250) * 2)
    expect(h.controller.stalled()).toBe(true)

    h.controller.handlePlay()

    expect(h.controller.stalled()).toBe(false)
    expect(h.controller.playing()).toBe(true)
    h.dispose()
  })
})

describe('no false alarm', () => {
  it('across a seek while the song plays', async () => {
    const h = await playing()
    await h.running(1000)

    h.controller.seekTo(120)
    await h.running(5000)

    expect(recorded('clock-stall')).toHaveLength(0)
    expect(h.controller.playing()).toBe(true)
    h.dispose()
  })

  it('while the song is paused', async () => {
    const h = await playing()
    await h.running(1000)

    h.controller.handlePause()
    await h.standing(10_000)

    expect(recorded('clock-stall')).toHaveLength(0)
    h.dispose()
  })

  it('at the song’s end', async () => {
    const h = await playing()
    await h.running(1000)

    h.clock.currentTime += SONG_SECONDS
    await h.standing(10_000)

    expect(recorded('clock-stall')).toHaveLength(0)
    h.dispose()
  })

  it('outside a room that hosts the mixer, where nothing watches', async () => {
    const h = await playing(false)
    await h.running(1000)

    await h.standing(10_000)

    expect(recorded('clock-stall')).toHaveLength(0)
    expect(h.controller.playing()).toBe(true)
    h.dispose()
  })
})
