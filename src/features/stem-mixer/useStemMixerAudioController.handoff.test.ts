// ============================================================
// Another app taking the sound: the song pauses with the clock, and a press
// of play that iOS answers with a silent clock is tried once more, then
// stopped with a word (docs/plans/mobile-native/ios-audio-handoff.md)
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audioDiagnosticEntries, resetAudioDiagnosticsForTests, } from '@/lib/audio-diagnostics'
import { START_CHECK_MS } from './playback-return-watch'
import type { StemMixerAudioDeps } from './useStemMixerAudioController'
import { SILENT_START_NOTICE, useStemMixerAudioController, } from './useStemMixerAudioController'

/** An audio context whose state and clock the test moves, as iOS would. */
class FakeClock extends EventTarget {
  state: string
  currentTime = 0
  sampleRate = 48_000
  destination = {}
  resume = vi.fn(async () => {
    this.state = 'running'
    return Promise.resolve()
  })
  suspend = vi.fn(async () => {
    this.state = 'suspended'
    return Promise.resolve()
  })
  close = vi.fn(async () => Promise.resolve())
  createGain = vi.fn(() => ({ ...node(), gain: param() }))
  createWaveShaper = vi.fn(() => ({ ...node(), curve: null, oversample: '' }))
  createAnalyser = vi.fn(() => ({
    ...node(),
    fftSize: 2048,
    smoothingTimeConstant: 0,
    getFloatTimeDomainData: vi.fn(),
  }))

  constructor(state = 'running') {
    super()
    this.state = state
  }

  /** iOS changing the state, and saying so. */
  goes(state: string): void {
    this.state = state
    this.dispatchEvent(new Event('statechange'))
  }
}

function node() {
  return { connect: vi.fn(), disconnect: vi.fn() }
}

function param() {
  return {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
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

function harness(over: Partial<StemMixerAudioDeps> = {}) {
  const clock = new FakeClock()
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
    audioLease: {
      ensure: () => clock as unknown as AudioContext,
      unlock: vi.fn(async () => clock.resume().then(() => true)),
    },
    ...over,
  } as unknown as StemMixerAudioDeps
  let controller!: ReturnType<typeof useStemMixerAudioController>
  const dispose = createRoot((disposeRoot) => {
    controller = useStemMixerAudioController(deps)
    return disposeRoot
  })
  return { clock, controller, notifications, dispose }
}

const recorded = (event: string) =>
  audioDiagnosticEntries().filter((entry) => entry.event === event)

beforeEach(() => {
  resetAudioDiagnosticsForTests()
  // No frames: the song here has no length, and a frame would end it.
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  // The unlock clip a press of play starts (audio-unlock.ts).
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('another app taking the sound', () => {
  it('pauses the song with the clock and says the system did it', () => {
    const { clock, controller, dispose } = harness()
    controller.handlePlay()
    expect(controller.playing()).toBe(true)
    const resumes = clock.resume.mock.calls.length

    clock.goes('interrupted')

    expect(controller.playing()).toBe(false)
    expect(controller.interrupted()).toBe(true)
    // Nothing takes the sound back from the app that has it.
    expect(clock.resume).toHaveBeenCalledTimes(resumes)
    expect(recorded('statechange')[0]?.detail).toMatchObject({
      state: 'interrupted',
      playing: true,
    })
    dispose()
  })

  it('takes the sound back on the next press of play, and the mark goes', () => {
    const { clock, controller, dispose } = harness()
    controller.handlePlay()
    clock.goes('interrupted')

    controller.handlePlay()

    expect(clock.resume).toHaveBeenCalled()
    expect(controller.playing()).toBe(true)
    expect(controller.interrupted()).toBe(false)
    dispose()
  })

  it('leaves a paused song paused and unmarked', () => {
    const { clock, controller, dispose } = harness()
    controller.ensureAudioCtx()

    clock.goes('interrupted')

    expect(controller.playing()).toBe(false)
    expect(controller.interrupted()).toBe(false)
    dispose()
  })

  it('clears the mark when the singer pauses or stops', () => {
    const { clock, controller, dispose } = harness()
    controller.handlePlay()
    clock.goes('interrupted')
    expect(controller.interrupted()).toBe(true)

    controller.handleStop()

    expect(controller.interrupted()).toBe(false)
    dispose()
  })

  it('stops listening to a clock it has let go', () => {
    const { clock, controller, dispose } = harness()
    controller.handlePlay()
    controller.detachGraph()

    clock.goes('interrupted')

    expect(recorded('statechange')).toHaveLength(0)
    dispose()
  })
})

describe('a press of play in the room', () => {
  const inTheRoom = {
    followEndWhileHidden: true,
  } as Partial<StemMixerAudioDeps>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  it('leaves a song alone whose clock moves', async () => {
    const { clock, controller, notifications, dispose } = harness(inTheRoom)
    controller.handlePlay()

    clock.currentTime += START_CHECK_MS / 1000
    await vi.advanceTimersByTimeAsync(START_CHECK_MS)

    expect(clock.suspend).not.toHaveBeenCalled()
    expect(controller.playing()).toBe(true)
    expect(notifications).toEqual([])
    dispose()
  })

  it('restarts a clock that says it runs and does not move', async () => {
    const { clock, controller, dispose } = harness(inTheRoom)
    controller.handlePlay()

    await vi.advanceTimersByTimeAsync(START_CHECK_MS)

    expect(clock.suspend).toHaveBeenCalledTimes(1)
    expect(clock.resume).toHaveBeenCalled()
    expect(clock.state).toBe('running')
    expect(recorded('clock-restart')).toHaveLength(1)
    // It came back: the second look finds it moving.
    clock.currentTime += START_CHECK_MS / 1000
    await vi.advanceTimersByTimeAsync(START_CHECK_MS)
    expect(controller.playing()).toBe(true)
    dispose()
  })

  it('stops a song that still makes no sound, and says so', async () => {
    const { clock, controller, notifications, dispose } = harness(inTheRoom)
    controller.handlePlay()

    await vi.advanceTimersByTimeAsync(START_CHECK_MS * 2)

    expect(controller.playing()).toBe(false)
    expect(notifications).toEqual([SILENT_START_NOTICE])
    // Parked, so the next press starts the clock for real.
    expect(clock.state).toBe('suspended')
    expect(
      recorded('clock-stuck').map((entry) => entry.detail.attempt),
    ).toEqual([1, 2])
    dispose()
  })

  it('forgets the check when the singer pauses first', async () => {
    const { clock, controller, notifications, dispose } = harness(inTheRoom)
    controller.handlePlay()
    controller.handlePause()

    await vi.advanceTimersByTimeAsync(START_CHECK_MS * 2)

    expect(clock.suspend).not.toHaveBeenCalled()
    expect(notifications).toEqual([])
    dispose()
  })

  it('does not check outside the room', async () => {
    const { clock, controller, dispose } = harness()
    controller.handlePlay()

    await vi.advanceTimersByTimeAsync(START_CHECK_MS * 2)

    expect(clock.suspend).not.toHaveBeenCalled()
    expect(controller.playing()).toBe(true)
    dispose()
  })
})
