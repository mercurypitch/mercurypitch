import type { Accessor } from 'solid-js'
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PracticeController } from '@/features/practice/usePracticeController'
import { usePracticeController } from '@/features/practice/usePracticeController'
import type { RecordingController } from '@/features/recording/useRecordingController'
import type { AudioEngine } from '@/lib/audio-engine'
import { onCoachEvent } from '@/lib/coach-events'
import type { MicState } from '@/lib/mic-manager'
import { micManager } from '@/lib/mic-manager'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine, PracticeEngineCallbacks, } from '@/lib/practice-engine'
import { setMicActive } from '@/stores'
import type { PitchResult } from '@/types'

const DETECTED_PITCH: PitchResult = {
  freq: 440,
  midi: 69,
  note: 'A4',
  noteName: 'A',
  targetMidi: 0,
  targetNote: '',
  cents: 0,
  frequency: 440,
  clarity: 0.95,
  octave: 4,
}

interface MountedController {
  controller: PracticeController
  dispose: () => void
  practiceEngine: PracticeEngine
}

describe('usePracticeController frame subscriptions', () => {
  let queuedFrames: FrameRequestCallback[]

  beforeEach(() => {
    queuedFrames = []
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        queuedFrames.push(callback)
        return queuedFrames.length
      }),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    setMicActive(false)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  interface Surroundings {
    singingOnScreen?: Accessor<boolean>
    isPlaying?: Accessor<boolean>
  }

  function mountController(around: Surroundings = {}): MountedController {
    const practiceEngine = {
      addCallbacks: vi.fn().mockReturnValue(() => {}),
      update: vi.fn().mockReturnValue(DETECTED_PITCH),
      calculateScore: vi.fn().mockReturnValue(100),
      isMicActive: vi.fn().mockReturnValue(false),
      getWaveformData: vi.fn().mockReturnValue(new Float32Array(8)),
    } as unknown as PracticeEngine
    const playbackRuntime = {
      on: vi.fn(),
      getCurrentBeat: vi.fn().mockReturnValue(3.5),
    } as unknown as PlaybackRuntime
    const recording = {
      processPitchFrame: vi.fn(),
    } as unknown as RecordingController
    const audioEngine = {
      getFrequencyData: vi.fn().mockReturnValue(new Float32Array(8)),
    } as unknown as AudioEngine

    let controller!: PracticeController
    let dispose!: () => void
    createRoot((rootDispose) => {
      dispose = rootDispose
      controller = usePracticeController({
        audioEngine,
        playbackRuntime,
        practiceEngine,
        recording,
        isPlaying: around.isPlaying ?? (() => false),
        isPaused: () => false,
        editorIsPlaying: () => false,
        singingOnScreen: around.singingOnScreen ?? (() => true),
      })
    })

    return { controller, dispose, practiceEngine }
  }

  function runNextFrame(timestamp = 16): void {
    const frame = queuedFrames.shift()
    expect(frame).toBeDefined()
    frame!(timestamp)
  }

  it('updates the engine once and delivers the same frame to every listener', () => {
    const { controller, dispose, practiceEngine } = mountController()
    const first = vi.fn()
    const throwing = vi.fn(() => {
      throw new Error('listener failed')
    })
    const last = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    controller.subscribeFrames(first)
    controller.subscribeFrames(throwing)
    controller.subscribeFrames(last)

    runNextFrame()

    expect(practiceEngine.update).toHaveBeenCalledOnce()
    expect(first).toHaveBeenCalledOnce()
    expect(throwing).toHaveBeenCalledOnce()
    expect(last).toHaveBeenCalledOnce()
    expect(first.mock.calls[0][0]).toBe(last.mock.calls[0][0])
    expect(first).toHaveBeenCalledWith(
      expect.objectContaining({
        beat: 3.5,
        pitch: DETECTED_PITCH,
        micActive: false,
        atMs: expect.any(Number),
      }),
    )
    expect(consoleError).toHaveBeenCalledOnce()

    dispose()
  })

  it('supports unsubscribe and clears remaining listeners on teardown', () => {
    const { controller, dispose, practiceEngine } = mountController()
    const unsubscribed = vi.fn()
    const remaining = vi.fn()
    const unsubscribe = controller.subscribeFrames(unsubscribed)
    controller.subscribeFrames(remaining)

    unsubscribe()
    runNextFrame()

    expect(practiceEngine.update).toHaveBeenCalledOnce()
    expect(unsubscribed).not.toHaveBeenCalled()
    expect(remaining).toHaveBeenCalledOnce()

    // A cancelled browser callback cannot normally run, but invoking the
    // captured callback proves teardown removed observers from the stream.
    const staleFrame = queuedFrames.shift()
    dispose()
    staleFrame?.(32)

    expect(remaining).toHaveBeenCalledOnce()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  it('tells a waiting Merc tour the mic started, or could not', () => {
    const { dispose, practiceEngine } = mountController()
    const started = vi.fn()
    const failed = vi.fn()
    const offStarted = onCoachEvent('mic-on', started)
    const offFailed = onCoachEvent('mic-failed', failed)
    const callbacks = vi.mocked(practiceEngine.addCallbacks).mock
      .calls[0][0] as PracticeEngineCallbacks

    // Stopping is neither.
    callbacks.onMicStateChange?.(false)
    expect(started).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()

    // The engine's "Mic start failed" path: a refused permission.
    callbacks.onMicStateChange?.(false, 'Permission denied')
    expect(failed).toHaveBeenCalledOnce()
    expect(started).not.toHaveBeenCalled()

    // The engine started the mic.
    callbacks.onMicStateChange?.(true)
    expect(started).toHaveBeenCalledOnce()
    expect(failed).toHaveBeenCalledOnce()

    offStarted()
    offFailed()
    dispose()
  })

  it('tells a waiting Merc tour about a clear note, and not about silence', () => {
    const { dispose, practiceEngine } = mountController()
    const heard = vi.fn()
    const off = onCoachEvent('pitch-detected', heard)
    const callbacks = vi.mocked(practiceEngine.addCallbacks).mock
      .calls[0][0] as PracticeEngineCallbacks

    callbacks.onPitchDetected?.(null)
    callbacks.onPitchDetected?.({ ...DETECTED_PITCH, frequency: 0 })
    callbacks.onPitchDetected?.({ ...DETECTED_PITCH, clarity: 0.1 })
    callbacks.onPitchDetected?.(DETECTED_PITCH)

    expect(heard).toHaveBeenCalledTimes(1)
    off()
    dispose()
  })

  it('asks for no frame with another tab on screen and nothing reading the stream', () => {
    const { dispose, practiceEngine } = mountController({
      singingOnScreen: () => false,
    })
    expect(queuedFrames).toHaveLength(0)
    expect(practiceEngine.update).not.toHaveBeenCalled()
    dispose()
  })

  it('runs for a stage that reads the stream, and stops one frame after it leaves', () => {
    const { controller, dispose, practiceEngine } = mountController({
      singingOnScreen: () => false,
    })
    const stage = vi.fn()
    const leave = controller.subscribeFrames(stage)
    expect(queuedFrames).toHaveLength(1)
    runNextFrame()
    expect(stage).toHaveBeenCalledOnce()
    expect(queuedFrames).toHaveLength(1)

    leave()
    runNextFrame()
    expect(practiceEngine.update).toHaveBeenCalledTimes(2)
    expect(stage).toHaveBeenCalledOnce()
    expect(queuedFrames).toHaveLength(0)
    dispose()
  })

  it('starts again when the Singing tab comes back', () => {
    const [onScreen, setOnScreen] = createSignal(false)
    const { dispose } = mountController({ singingOnScreen: onScreen })
    expect(queuedFrames).toHaveLength(0)
    setOnScreen(true)
    expect(queuedFrames).toHaveLength(1)
    runNextFrame()
    expect(queuedFrames).toHaveLength(1)
    setOnScreen(false)
    runNextFrame()
    expect(queuedFrames).toHaveLength(0)
    dispose()
  })

  it('runs on any tab while the transport rolls', () => {
    const [playing, setPlaying] = createSignal(false)
    const { dispose } = mountController({
      singingOnScreen: () => false,
      isPlaying: playing,
    })
    expect(queuedFrames).toHaveLength(0)
    setPlaying(true)
    expect(queuedFrames).toHaveLength(1)
    setPlaying(false)
    runNextFrame()
    expect(queuedFrames).toHaveLength(0)
    dispose()
  })

  it('runs on any tab while the mic is on, so the engine can settle its mic state', () => {
    const { dispose, practiceEngine } = mountController({
      singingOnScreen: () => false,
    })
    setMicActive(true)
    expect(queuedFrames).toHaveLength(1)
    runNextFrame()
    expect(practiceEngine.isMicActive).toHaveBeenCalledOnce()
    setMicActive(false)
    runNextFrame()
    expect(queuedFrames).toHaveLength(0)
    dispose()
  })

  it('runs on any tab while another feature holds the shared mic open', () => {
    let tell: ((state: MicState) => void) | undefined
    const left = vi.fn()
    vi.spyOn(micManager, 'subscribe').mockImplementation((listener) => {
      tell = listener
      listener({ active: false, error: null, consumers: [], blockedBy: null })
      return left
    })
    const { dispose } = mountController({ singingOnScreen: () => false })
    expect(queuedFrames).toHaveLength(0)
    tell?.({
      active: true,
      error: null,
      consumers: ['ear-lab'],
      blockedBy: null,
    })
    expect(queuedFrames).toHaveLength(1)
    tell?.({ active: false, error: null, consumers: [], blockedBy: null })
    runNextFrame()
    expect(queuedFrames).toHaveLength(0)
    dispose()
    expect(left).toHaveBeenCalledOnce()
  })
})
