import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePitchPursuitController } from '@/features/exercises/pitch-pursuit/use-pitch-pursuit-controller'
import type { ExerciseResult } from '@/features/exercises/types'
import { EXERCISE_PITCH_PURSUIT, runStoppedEarly, } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { typicalRunSec } from '@/features/routines/segment-reps'

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
    const base = createMockBase({
      _completeWithResult: (r) => committed.push(r),
    })
    const ctrl = usePitchPursuitController(base)

    ctrl.startGame()
    ctrl.stopGame()

    expect(committed.length).toBe(1)
  })
})

describe('a Pitch Pursuit run', () => {
  // Its card promises 12 notes, and the game is meant to end once they
  // have all reached the line. The spawn cap counted the notes on screen
  // instead of the notes spawned, so the notes never ran out: three
  // minutes in, eighty had fallen and the game was still going.
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
        'Date',
      ],
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    clearLaunchOverride()
  })

  it('ends by itself once its 12 notes have reached the line, and is a whole run', async () => {
    const results: ExerciseResult[] = []
    let running = true
    let runSec = 0
    const t0 = performance.now()
    const ctrl = usePitchPursuitController(
      createMockBase({
        _isRunning: () => running,
        _completeWithResult: (r) => {
          running = false
          runSec = (performance.now() - t0) / 1000
          results.push(r)
        },
      }),
    )

    ctrl.startGame()
    // Twelve notes, one every 2.2 s, each 5 s to fall and a second to
    // clear: about half a minute.
    await vi.advanceTimersByTimeAsync(40_000)

    expect(results).toHaveLength(1)
    const { metrics } = results[0]!
    expect(metrics.hits + metrics.misses).toBe(12)
    expect(runStoppedEarly(metrics)).toBe(false)
    expect(ctrl.getNotes()).toEqual([])
    // A routine budgets for the run: no less than it takes, and no more
    // than one of the budget table's 15 s steps over (segment-reps.ts).
    expect(runSec).toBeGreaterThan(29)
    expect(runSec).toBeLessThan(32)
    expect(typicalRunSec(EXERCISE_PITCH_PURSUIT)).toBeGreaterThanOrEqual(runSec)
    expect(typicalRunSec(EXERCISE_PITCH_PURSUIT)).toBeLessThan(runSec + 15)
  })

  it('plays and counts the 17 notes difficulty 10 plans, and is a whole run', async () => {
    // The counter beside the falling notes reads plannedNotes, so the
    // number it counts to is the number the run plays.
    setLaunchOverride(EXERCISE_PITCH_PURSUIT, {
      type: EXERCISE_PITCH_PURSUIT,
      difficulty: 10,
    })
    const results: ExerciseResult[] = []
    const planned = new Set<number>()
    let running = true
    let runSec = 0
    const t0 = performance.now()
    const ctrl = usePitchPursuitController(
      createMockBase({
        _isRunning: () => running,
        _updateMetrics: (m) => {
          if (m.plannedNotes !== undefined) planned.add(m.plannedNotes)
        },
        _completeWithResult: (r) => {
          running = false
          runSec = (performance.now() - t0) / 1000
          results.push(r)
        },
      }),
    )

    ctrl.startGame()
    // Seventeen notes, one every 2.2 s, each 3 s to fall at this level and
    // a second to clear: about forty seconds.
    await vi.advanceTimersByTimeAsync(60_000)

    expect([...planned]).toEqual([17])
    expect(results).toHaveLength(1)
    const { metrics } = results[0]!
    expect(metrics.hits + metrics.misses).toBe(17)
    expect(runStoppedEarly(metrics)).toBe(false)
    // The hardest level's run still fits what a routine budgets for one.
    expect(typicalRunSec(EXERCISE_PITCH_PURSUIT)).toBeGreaterThanOrEqual(runSec)
  })
})
