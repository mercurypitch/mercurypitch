import { describe, expect, it } from 'vitest'
import { usePitchPursuitController } from '@/features/exercises/pitch-pursuit/use-pitch-pursuit-controller'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'
import { EXERCISE_PITCH_PURSUIT } from '@/features/exercises/types'

function createMockBase(
  overrides: Partial<BaseExerciseController> = {},
): BaseExerciseController {
  const mock: BaseExerciseController = {
    pitchHistory: () => [],
    _setTargetPitch: () => {},
    _getElapsed: () => 0,
    _isRunning: () => true,
    _setRunning: () => {},
    _commitResult: () => {},
    _updateScore: () => {},
    _updateMetrics: () => {},
    state: () => ({
      status: 'active',
      currentScore: 0,
      elapsedMs: 0,
      metrics: {},
    }),
    start: async () => {},
    stop: () => {},
    reset: () => {},
    result: () => null,
    currentPitch: () => null,
    frequencyData: () => null,
    targetPitch: () => null,
    error: () => null,
    ...overrides,
  }
  return mock
}

describe('usePitchPursuitController', () => {
  it('computeResult returns zero for no notes', () => {
    const base = createMockBase()
    const ctrl = usePitchPursuitController(base)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_PITCH_PURSUIT)
    expect(result.score).toBe(0)
    expect(result.metrics.hits).toBe(0)
    expect(result.metrics.misses).toBe(0)
  })

  it('getNotes returns empty array before game starts', () => {
    const base = createMockBase()
    const ctrl = usePitchPursuitController(base)
    expect(ctrl.getNotes()).toEqual([])
  })

  it('startGame spawns initial notes', () => {
    const base = createMockBase()
    const ctrl = usePitchPursuitController(base)

    ctrl.startGame()
    const notes = ctrl.getNotes()
    expect(notes.length).toBeGreaterThan(0)
    expect(notes[0].active).toBe(true)
    expect(notes[0].scored).toBe(false)
  })

  it('notes have valid MIDI values from the note pool', () => {
    const base = createMockBase()
    const ctrl = usePitchPursuitController(base)

    ctrl.startGame()
    const notes = ctrl.getNotes()

    const validMidi = [60, 62, 64, 65, 67, 69, 71, 72, 55, 57, 59]
    for (const note of notes) {
      expect(validMidi).toContain(note.midi)
    }
  })

  it('stopGame commits result and stops', () => {
    const committed: unknown[] = []
    let stopped = false
    const base = createMockBase({
      _commitResult: (r) => committed.push(r),
      stop: () => {
        stopped = true
      },
    })
    const ctrl = usePitchPursuitController(base)

    ctrl.startGame()
    ctrl.stopGame()

    expect(committed.length).toBe(1)
    expect(stopped).toBe(true)
  })
})
