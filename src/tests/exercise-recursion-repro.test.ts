import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { useBaseExercise } from '@/features/exercises/use-base-exercise'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'

/**
 * Tests for the exercise stop/complete/reset flow.
 *
 * SolidJS effects do not fire inside createRoot in vitest/jsdom (runUpdates
 * init=true defers effect processing). These tests verify correctness through
 * signal values and re-entrancy guard depths rather than effect callbacks.
 */

function createMockAudioEngine(
  overrides: Partial<AudioEngine> = {},
): AudioEngine {
  return {
    init: () => Promise.resolve(),
    resume: () => Promise.resolve(),
    startMic: () => Promise.resolve(true),
    stopMic: () => {},
    isMicActive: () => false,
    getFrequencyData: () => new Float32Array(1024),
    getTimeData: () => new Float32Array(1024),
    getSampleRate: () => 44100,
    getBufferSize: () => 2048,
    stopTone: () => {},
    ...overrides,
  } as unknown as AudioEngine
}

function createMockPracticeEngine(
  overrides: Partial<PracticeEngine> = {},
): PracticeEngine {
  return {
    startMic: () => Promise.resolve(true),
    stopMic: () => {},
    isMicActive: () => false,
    update: () => null,
    setCallbacks: () => {},
    getWaveformData: () => new Float32Array(1024),
    detectPitch: () => null,
    setAlgorithm: () => {},
    setSensitivity: () => {},
    setBands: () => {},
    ...overrides,
  } as unknown as PracticeEngine
}

function makeResult(score = 85) {
  return {
    type: 'vibrato' as const,
    score,
    metrics: {
      rateHz: 5.5,
      depthCents: 30,
      consistency: 80,
      classification: 2,
    },
    completedAt: Date.now(),
  }
}

describe('exercise stop flow - signal state verification', () => {
  it('completeWithResult sets state to complete and result to the exercise result', () => {
    createRoot((dispose) => {
      const base = useBaseExercise({
        audioEngine: createMockAudioEngine(),
        practiceEngine: createMockPracticeEngine(),
        config: { type: 'vibrato', targetNote: 'A3' },
      })

      const result = makeResult(85)
      base._completeWithResult(result)

      expect(base.state().status).toBe('complete')
      expect(base.state().currentScore).toBe(85)
      expect(base.result()?.score).toBe(85)
      expect(base.result()?.type).toBe('vibrato')

      dispose()
    })
  })

  it('reset() returns state to idle and clears result', () => {
    createRoot((dispose) => {
      const base = useBaseExercise({
        audioEngine: createMockAudioEngine(),
        practiceEngine: createMockPracticeEngine(),
        config: { type: 'vibrato', targetNote: 'A3' },
      })

      base._completeWithResult(makeResult(85))
      expect(base.state().status).toBe('complete')
      expect(base.result()).not.toBeNull()

      base.reset()
      expect(base.state().status).toBe('idle')
      expect(base.state().currentScore).toBe(0)
      expect(base.result()).toBeNull()

      dispose()
    })
  })

  it('rapid complete-reset-complete cycle yields correct final state', () => {
    createRoot((dispose) => {
      const base = useBaseExercise({
        audioEngine: createMockAudioEngine(),
        practiceEngine: createMockPracticeEngine(),
        config: { type: 'vibrato', targetNote: 'A3' },
      })

      base._completeWithResult(makeResult(80))
      expect(base.state().status).toBe('complete')

      base.reset()
      expect(base.state().status).toBe('idle')

      base._completeWithResult(makeResult(90))
      expect(base.state().status).toBe('complete')
      expect(base.result()?.score).toBe(90)

      base.reset()
      expect(base.state().status).toBe('idle')

      base._completeWithResult(makeResult(70))
      expect(base.state().status).toBe('complete')
      expect(base.result()?.score).toBe(70)

      dispose()
    })
  })

  it('reset → complete transition works correctly', () => {
    createRoot((dispose) => {
      const base = useBaseExercise({
        audioEngine: createMockAudioEngine(),
        practiceEngine: createMockPracticeEngine(),
        config: { type: 'vibrato', targetNote: 'A3' },
      })

      base._completeWithResult(makeResult(85))
      base.reset()
      base._completeWithResult(makeResult(92))

      expect(base.state().status).toBe('complete')
      expect(base.result()?.score).toBe(92)

      dispose()
    })
  })
})

describe('re-entrancy guards', () => {
  it('depths are zero after single completeWithResult', () => {
    createRoot((dispose) => {
      const base = useBaseExercise({
        audioEngine: createMockAudioEngine(),
        practiceEngine: createMockPracticeEngine(),
        config: { type: 'vibrato', targetNote: 'A3' },
      })

      base._completeWithResult(makeResult(80))
      const depths = base._getDepths()
      expect(depths.completeDepth).toBe(0)
      expect(depths.resetDepth).toBe(0)
      expect(depths.startDepth).toBe(0)

      dispose()
    })
  })

  it('depths are zero after single reset', () => {
    createRoot((dispose) => {
      const base = useBaseExercise({
        audioEngine: createMockAudioEngine(),
        practiceEngine: createMockPracticeEngine(),
        config: { type: 'vibrato', targetNote: 'A3' },
      })

      base.reset()
      const depths = base._getDepths()
      expect(depths.resetDepth).toBe(0)

      dispose()
    })
  })

  it('depths remain zero after rapid cycle', () => {
    createRoot((dispose) => {
      const base = useBaseExercise({
        audioEngine: createMockAudioEngine(),
        practiceEngine: createMockPracticeEngine(),
        config: { type: 'vibrato', targetNote: 'A3' },
      })

      for (let i = 0; i < 5; i++) {
        base._completeWithResult(makeResult(80 + i))
        base.reset()
      }

      const depths = base._getDepths()
      expect(depths.completeDepth).toBe(0)
      expect(depths.resetDepth).toBe(0)
      expect(depths.startDepth).toBe(0)

      dispose()
    })
  })
})

describe('batch atomicity', () => {
  it('completeWithResult sets result and state together', () => {
    createRoot((dispose) => {
      const base = useBaseExercise({
        audioEngine: createMockAudioEngine(),
        practiceEngine: createMockPracticeEngine(),
        config: { type: 'vibrato', targetNote: 'A3' },
      })

      base._completeWithResult(makeResult(85))

      // Both result and state should reflect the completion atomically
      expect(base.result()?.score).toBe(85)
      expect(base.state().status).toBe('complete')
      expect(base.state().currentScore).toBe(85)

      dispose()
    })
  })

  it('reset clears all signals atomically', () => {
    createRoot((dispose) => {
      const base = useBaseExercise({
        audioEngine: createMockAudioEngine(),
        practiceEngine: createMockPracticeEngine(),
        config: { type: 'vibrato', targetNote: 'A3' },
      })

      base._completeWithResult(makeResult(85))
      base.reset()

      // All signals should be back to idle state
      expect(base.state().status).toBe('idle')
      expect(base.state().currentScore).toBe(0)
      expect(base.result()).toBeNull()

      dispose()
    })
  })
})

describe('commitResult vs completeWithResult', () => {
  it('commitResult sets result without changing state', () => {
    createRoot((dispose) => {
      const base = useBaseExercise({
        audioEngine: createMockAudioEngine(),
        practiceEngine: createMockPracticeEngine(),
        config: { type: 'vibrato', targetNote: 'A3' },
      })

      const result = makeResult(75)
      base._commitResult(result)

      expect(base.result()?.score).toBe(75)
      // commitResult does NOT change state status
      expect(base.state().status).toBe('idle')

      dispose()
    })
  })
})
