import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBaseExercise } from '@/features/exercises/use-base-exercise'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'

function createMockAudioEngine(): AudioEngine {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    startMic: vi.fn().mockResolvedValue(true),
    stopMic: vi.fn(),
    isMicActive: vi.fn().mockReturnValue(false),
    getFrequencyData: vi.fn().mockReturnValue(new Float32Array(1024)),
    getTimeData: vi.fn().mockReturnValue(new Float32Array(1024)),
    getSampleRate: vi.fn().mockReturnValue(44100),
    getBufferSize: vi.fn().mockReturnValue(2048),
    getMicStream: vi.fn().mockReturnValue(null),
    getAudioContext: vi.fn().mockReturnValue(null),
    stopTone: vi.fn(),
  } as unknown as AudioEngine
}

function createMockPracticeEngine(
  overrides: Partial<PracticeEngine> = {},
): PracticeEngine {
  const mock = {
    startMic: vi.fn().mockResolvedValue(true),
    stopMic: vi.fn(),
    isMicActive: vi.fn().mockReturnValue(false),
    getInputLevel: vi.fn().mockReturnValue(0),
    update: vi.fn().mockReturnValue(null),
    addCallbacks: vi.fn().mockReturnValue(() => {}),
    getWaveformData: vi.fn().mockReturnValue(new Float32Array(1024)),
    detectPitch: vi.fn().mockReturnValue(null),
    setAlgorithm: vi.fn(),
    setSensitivity: vi.fn(),
    setBands: vi.fn(),
    ...overrides,
  } as unknown as PracticeEngine

  return mock
}

describe('useBaseExercise', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reset() stops the microphone', () => {
    createRoot((dispose) => {
      const audioEngine = createMockAudioEngine()
      const practiceEngine = createMockPracticeEngine()
      const base = useBaseExercise({
        audioEngine,
        practiceEngine,
        config: { type: 'long-note', targetNote: 'A3' },
      })

      base.reset()

      expect(practiceEngine.stopMic).toHaveBeenCalledOnce()

      dispose()
    })
  })

  it('reset() restores idle state', () => {
    createRoot((dispose) => {
      const audioEngine = createMockAudioEngine()
      const practiceEngine = createMockPracticeEngine()
      const base = useBaseExercise({
        audioEngine,
        practiceEngine,
        config: { type: 'long-note', targetNote: 'A3' },
      })

      base.reset()

      expect(base.state().status).toBe('idle')
      expect(base.state().currentScore).toBe(0)
      expect(base.state().elapsedMs).toBe(0)
      expect(base.result()).toBeNull()
      expect(base.error()).toBeNull()
      expect(base.currentPitch()).toBeNull()
      expect(base.pitchHistory()).toEqual([])

      dispose()
    })
  })

  it('reset() clears target pitch', () => {
    createRoot((dispose) => {
      const audioEngine = createMockAudioEngine()
      const practiceEngine = createMockPracticeEngine()
      const base = useBaseExercise({
        audioEngine,
        practiceEngine,
        config: { type: 'long-note', targetNote: 'A3' },
      })

      // Set target before reset
      base._setTargetPitch(69)
      expect(base.targetPitch()).toBe(69)

      base.reset()
      expect(base.targetPitch()).toBeNull()

      dispose()
    })
  })

  it('stop() sets status to complete without stopping mic', () => {
    createRoot((dispose) => {
      const audioEngine = createMockAudioEngine()
      const practiceEngine = createMockPracticeEngine()
      const base = useBaseExercise({
        audioEngine,
        practiceEngine,
        config: { type: 'long-note', targetNote: 'A3' },
      })

      base.stop()

      expect(base.state().status).toBe('complete')
      // stop() should NOT stop the mic (only reset does)
      expect(practiceEngine.stopMic).not.toHaveBeenCalled()

      dispose()
    })
  })

  it('stop() disposes controller timers registered via _registerDispose', () => {
    // Previously stop() skipped disposeFns entirely (unlike reset() and
    // _setRunning(false)), so a controller's setInterval/setTimeout chain
    // would keep running/leak if a caller ever used stop() instead of
    // reset() to end the exercise.
    createRoot((dispose) => {
      const audioEngine = createMockAudioEngine()
      const practiceEngine = createMockPracticeEngine()
      const base = useBaseExercise({
        audioEngine,
        practiceEngine,
        config: { type: 'long-note', targetNote: 'A3' },
      })

      const cleanup = vi.fn()
      base._registerDispose(cleanup)

      base.stop()

      expect(cleanup).toHaveBeenCalledOnce()

      dispose()
    })
  })

  it('dispose registrations persist across runs (stop, reset, unmount)', () => {
    // Controllers register their cleanup once at creation. The list used to
    // be emptied after its first run, so the second stop/reset — and the
    // final unmount — no longer cleared controller timers (zombie
    // setTimeout/setInterval chains after Try Again).
    createRoot((dispose) => {
      const audioEngine = createMockAudioEngine()
      const practiceEngine = createMockPracticeEngine()
      const base = useBaseExercise({
        audioEngine,
        practiceEngine,
        config: { type: 'long-note', targetNote: 'A3' },
      })

      const cleanup = vi.fn()
      base._registerDispose(cleanup)

      base.stop() // run 1 ends
      base.reset() // back to idle for run 2
      base.stop() // run 2 ends — previously a no-op for the controller
      expect(cleanup).toHaveBeenCalledTimes(3)

      dispose() // unmount — must still clear controller timers
      expect(cleanup).toHaveBeenCalledTimes(4)
    })
  })

  it('start() reports failure so controllers are not started without a mic', async () => {
    const audioEngine = createMockAudioEngine()
    const practiceEngine = createMockPracticeEngine({
      startMic: vi.fn().mockResolvedValue(false),
    } as unknown as Partial<PracticeEngine>)

    await createRoot(async (dispose) => {
      const base = useBaseExercise({
        audioEngine,
        practiceEngine,
        config: { type: 'long-note', targetNote: 'A3' },
      })

      await expect(base.start()).resolves.toBe(false)
      expect(base.state().status).toBe('idle')
      expect(base.error()).toMatch(/microphone/i)

      dispose()
    })
  })

  it('start() resolves true when the mic is granted', async () => {
    const audioEngine = createMockAudioEngine()
    const practiceEngine = createMockPracticeEngine()

    await createRoot(async (dispose) => {
      const base = useBaseExercise({
        audioEngine,
        practiceEngine,
        config: { type: 'long-note', targetNote: 'A3' },
      })

      await expect(base.start()).resolves.toBe(true)
      expect(base.state().status).toBe('active')

      // A concurrent second start (already active) must report failure too.
      await expect(base.start()).resolves.toBe(false)

      dispose()
    })
  })

  it('start() aborts if reset() runs during mic acquisition (Back mid-acquire)', async () => {
    const audioEngine = createMockAudioEngine()
    let openMicGate!: () => void
    const micGate = new Promise<void>((resolve) => {
      openMicGate = resolve
    })
    let micActive = false
    const practiceEngine = createMockPracticeEngine({
      isMicActive: vi.fn(() => micActive),
      // Resolves only once we open the gate — mimics a slow getUserMedia /
      // permission prompt. The engine flips micActive on only once acquired.
      startMic: vi.fn(async () => {
        await micGate
        micActive = true
        return true
      }),
      stopMic: vi.fn(() => {
        micActive = false
      }),
    } as unknown as Partial<PracticeEngine>)

    await createRoot(async (dispose) => {
      const base = useBaseExercise({
        audioEngine,
        practiceEngine,
        config: { type: 'long-note', targetNote: 'A3' },
      })

      const startPromise = base.start() // enters count-in, awaits the mic
      expect(base.state().status).toBe('count-in')

      base.reset() // singer hits Back while the mic is still being acquired
      expect(base.state().status).toBe('idle')

      openMicGate() // the mic finally resolves, after the abort
      await expect(startPromise).resolves.toBe(false)

      // Must not resurrect the run into 'active', and must release the mic it
      // just acquired (otherwise a ghost rAF loop runs and the mic sticks on).
      expect(base.state().status).toBe('idle')
      expect(micActive).toBe(false)

      dispose()
    })
  })

  it('captures a completed run in memory with the configuration from start', async () => {
    class MockMediaRecorder {
      static isTypeSupported = vi.fn().mockReturnValue(true)
      state: RecordingState = 'inactive'
      ondataavailable: ((event: BlobEvent) => void) | null = null
      onstop: (() => void) | null = null

      start(): void {
        this.state = 'recording'
      }

      stop(): void {
        this.state = 'inactive'
        this.ondataavailable?.({
          data: new Blob(['voice'], { type: 'audio/webm' }),
        } as BlobEvent)
        this.onstop?.()
      }
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)

    const audioEngine = createMockAudioEngine()
    vi.mocked(audioEngine.getMicStream).mockReturnValue({} as MediaStream)
    const practiceEngine = createMockPracticeEngine()
    let targetNote = 'A3'

    await createRoot(async (dispose) => {
      const base = useBaseExercise({
        audioEngine,
        practiceEngine,
        config: () => ({ type: 'long-note', targetNote }),
      })

      await expect(base.start()).resolves.toBe(true)
      expect(base.voiceCapture.state()).toBe('recording')

      // A setting changed after Start belongs to the next run, not this take.
      targetNote = 'B3'
      base._completeWithResult({
        type: 'long-note',
        score: 82,
        metrics: { steadyZonePct: 76 },
        completedAt: Date.UTC(2026, 7, 1, 12),
      })

      await vi.waitFor(() => expect(base.voiceCapture.state()).toBe('ready'))
      expect(base.voiceCapture.take()?.config.targetNote).toBe('A3')
      expect(base.voiceCapture.take()?.blob.size).toBeGreaterThan(0)
      expect(base.voiceCapture.take()?.result.score).toBe(82)

      base.voiceCapture.discard()
      expect(base.voiceCapture.state()).toBe('idle')
      expect(base.voiceCapture.take()).toBeNull()

      dispose()
    })
  })
})
