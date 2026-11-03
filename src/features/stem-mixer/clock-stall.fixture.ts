// ============================================================
// The stall suites' harness: a hosted controller on a clock the test moves
// ============================================================
//
// What useStemMixerAudioController.stall.test.ts plays a song on: the app's
// one clock as a fake whose suspend and resume run in order, as a real
// AudioContext's control messages do (each waits for the one before it),
// with a suspend that can be made slow, as a wedged output's is. The review
// of 2 Nov found the late resume of a slow restart running a clock the song
// had parked; this clock is how that is reproduced.
//
// The test file keeps the module mocks (the phone's device class, the
// stream source), which Vitest only hoists from a test file, and hands the
// controller in, so nothing here loads it before they are in place.

import { createRoot, createSignal } from 'solid-js'
import { vi } from 'vitest'
import type { AudioDiagnosticEntry } from '@/lib/audio-diagnostics'
import { audioDiagnosticEntries } from '@/lib/audio-diagnostics'
import type { StemMixerAudioDeps, useStemMixerAudioController, } from './useStemMixerAudioController'

/** The app's one clock: control messages in order, a suspend that can be slow. */
export class OrderedClock extends EventTarget {
  state = 'running'
  currentTime = 0
  sampleRate = 48_000
  destination = {}
  /** Makes the NEXT suspend take this long, in ms. */
  slowSuspendMs = 0
  /** Every control message, asked and done, with the state it left. */
  readonly log: string[] = []
  private queue: Promise<void> = Promise.resolve()

  resume = vi.fn(async () =>
    this.control('resume', () => this.goes('running'), 0),
  )
  suspend = vi.fn(async () => {
    const delay = this.slowSuspendMs
    this.slowSuspendMs = 0
    return this.control('suspend', () => this.goes('suspended'), delay)
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

  /** iOS, or a control message, changing the state, and saying so. */
  goes(state: string): void {
    if (this.state === state) return
    this.state = state
    this.dispatchEvent(new Event('statechange'))
  }

  private control(op: string, run: () => void, delayMs: number) {
    this.log.push(`${op} asked`)
    const done = this.queue.then(
      async () =>
        new Promise<void>((resolve) => {
          const finish = (): void => {
            run()
            this.log.push(`${op} done -> ${this.state}`)
            resolve()
          }
          if (delayMs > 0) setTimeout(finish, delayMs)
          else finish()
        }),
    )
    this.queue = done
    return done
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

type UseController = typeof useStemMixerAudioController

/** A controller as the room hosts it (or not), on its own ordered clock. */
export function stallHarness(
  use: UseController,
  inTheRoom = true,
  over: Partial<StemMixerAudioDeps> = {},
) {
  const clock = new OrderedClock()
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
    ...over,
  } as unknown as StemMixerAudioDeps
  let controller!: ReturnType<UseController>
  const dispose = createRoot((disposeRoot) => {
    controller = use(deps)
    return disposeRoot
  })
  return { clock, controller, notifications, dispose }
}

/**
 * Loads the song, then plays it on fake timers with its streams filled.
 * Timers and the clocks only: the frames stay off, as on a page that is not
 * drawing, so nothing but the watches can notice anything (MISTAKES.md,
 * "Name the timers to fake").
 */
export async function playingIn(
  use: UseController,
  inTheRoom = true,
  over: Partial<StemMixerAudioDeps> = {},
) {
  const h = stallHarness(use, inTheRoom, over)
  await h.controller.loadStems()
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
      'performance',
    ],
  })
  h.controller.handlePlay()
  await vi.advanceTimersByTimeAsync(0)
  /** Time passes; a running clock moves `rate` seconds a second. */
  const pass = async (ms: number, rate: number): Promise<void> => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      if (h.clock.state === 'running') {
        h.clock.currentTime += (rate * 50) / 1000
      }
      await vi.advanceTimersByTimeAsync(50)
    }
  }
  return {
    ...h,
    running: async (ms: number) => pass(ms, 1),
    standing: async (ms: number) => pass(ms, 0),
  }
}

/** The audio record's entries for one event. */
export const recorded = (event: string): AudioDiagnosticEntry[] =>
  audioDiagnosticEntries().filter((entry) => entry.event === event)

/** The page going behind another app, or coming back, and saying so. */
export function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}
