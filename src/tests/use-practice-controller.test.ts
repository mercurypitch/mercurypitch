import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PracticeController } from '@/features/practice/usePracticeController'
import { usePracticeController } from '@/features/practice/usePracticeController'
import type { RecordingController } from '@/features/recording/useRecordingController'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
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
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function mountController(): MountedController {
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
        isPlaying: () => false,
        isPaused: () => false,
        editorIsPlaying: () => false,
        activeTab: () => 'singing',
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
})
