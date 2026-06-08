import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
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
    update: vi.fn().mockReturnValue(null),
    setCallbacks: vi.fn(),
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
})
