// ============================================================
// Chord Stacker — the demo plays each note of the chord in full
// ============================================================
//
// playTone settles when the tone is scheduled, not when it ends, and the
// next playTone releases the one before it. The demo waited only the gap
// after each tone, 300 ms after a 600 ms note, so every note but the last
// was cut to half, and the last still sounded into the singing. The
// controller runs on fake timers here, and each tone and phase is logged
// at the moment it starts. The scoring keeps its tests in
// src/tests/exercise-chord-stacker.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BaseExerciseController } from '../use-base-exercise'
import { useChordStackerController } from './use-chord-stacker-controller'

/** The demo's lengths at difficulty 5, where every one is its baseline. */
const TONE_MS = 600
const GAP_MS = 300
const BEFORE_SINGING_MS = 400

function createMockBase(
  overrides: Partial<BaseExerciseController> = {},
): BaseExerciseController {
  return {
    pitchHistory: () => [],
    _setTargetPitch: ((
      _v: number | null,
    ) => {}) as BaseExerciseController['_setTargetPitch'],
    _getElapsed: () => 0,
    _isRunning: () => true,
    _setRunning: () => {},
    _commitResult: () => {},
    _updateScore: () => {},
    _updateMetrics: () => {},
    _completeWithResult: () => {},
    _registerDispose: () => {},
    _getDepths: () => ({ completeDepth: 0, resetDepth: 0, startDepth: 0 }),
    state: () => ({
      status: 'active',
      currentScore: 0,
      elapsedMs: 0,
      metrics: {},
    }),
    start: async () => true,
    stop: () => {},
    reset: () => {},
    result: () => null,
    currentPitch: () => null,
    frequencyData: () => null,
    targetPitch: () => null,
    error: () => null,
    ...overrides,
  }
}

/** Start a run on C4, logging when each tone and each phase begins. */
function startRun() {
  const t0 = Date.now()
  const tones: Array<{ at: number; ms: number | undefined }> = []
  const singing: number[] = []
  const base = createMockBase({
    _updateMetrics: (m) => {
      if (m.phase === 2) singing.push(Date.now() - t0)
    },
  })
  const ctrl = useChordStackerController(base, {
    playTone: async (_freq, ms) => {
      tones.push({ at: Date.now() - t0, ms })
    },
  })
  ctrl.setBase(60)
  ctrl.startRounds()
  return { ctrl, tones, singing }
}

describe('Chord Stacker plays its chord one whole note at a time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts the next note only after the tone length and the gap', async () => {
    // Arrange
    const { tones } = startRun()

    // Act: up to a moment before the second note is due
    await vi.advanceTimersByTimeAsync(TONE_MS + GAP_MS - 1)

    // Assert
    expect(tones).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(tones).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(2 * (TONE_MS + GAP_MS))
    expect(tones).toEqual(
      [0, 1, 2, 3].map((i) => ({ at: i * (TONE_MS + GAP_MS), ms: TONE_MS })),
    )
  })

  it('lets the last note end before the singing starts', async () => {
    // Arrange
    const { tones, singing } = startRun()

    // Act
    await vi.advanceTimersByTimeAsync(4 * TONE_MS + 3 * GAP_MS + 1000)

    // Assert
    expect(tones).toHaveLength(4)
    expect(singing[0] - tones[3].at).toBe(TONE_MS + BEFORE_SINGING_MS)
  })

  it('lets Stop cancel the wait for a tone to end', async () => {
    // Arrange: a third of the way through the first tone
    const { ctrl, tones, singing } = startRun()
    await vi.advanceTimersByTimeAsync(TONE_MS / 3)

    // Act
    ctrl.stopRounds()

    // Assert: the wait was the controller's own timer, so nothing is left
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(tones).toHaveLength(1)
    expect(singing).toEqual([])
  })
})
