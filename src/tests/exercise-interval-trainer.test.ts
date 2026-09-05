import { afterEach, describe, expect, it, vi } from 'vitest'
import { difficultyWeightedRoundScore, plannedRounds, useIntervalTrainerController, } from '@/features/exercises/interval-trainer/use-interval-trainer-controller'
import { EXERCISE_INTERVAL_TRAINER } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'

// MIDI -> Hz, matching the controller's internal conversion.
function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

function createMockBase(
  overrides: Partial<BaseExerciseController> = {},
): BaseExerciseController {
  const mock: BaseExerciseController = {
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
  return mock
}

const audioEngine = {
  playTone: async () => {},
  playChord: vi.fn().mockResolvedValue(undefined),
}

describe('difficultyWeightedRoundScore', () => {
  it('is a span-weighted mean in 0-100, not an inflated sum', () => {
    // Two equal-span rounds at 40 → mean 40. The `* rounds.length` bug
    // returned 80 here (and the final score inflated to grade B).
    expect(
      difficultyWeightedRoundScore([
        { score: 40, span: 2 },
        { score: 40, span: 2 },
      ]),
    ).toBe(40)
  })

  it('weights larger intervals more heavily', () => {
    // (100*1 + 0*3) / 4 = 25
    expect(
      difficultyWeightedRoundScore([
        { score: 100, span: 1 },
        { score: 0, span: 3 },
      ]),
    ).toBe(25)
  })

  it('caps at 100 even for six perfect rounds (regression for the ×rounds bug)', () => {
    const rounds = Array.from({ length: 6 }, (_unused, i) => ({
      score: 100,
      span: i + 1,
    }))
    expect(difficultyWeightedRoundScore(rounds)).toBe(100)
  })

  it('returns 0 for no rounds', () => {
    expect(difficultyWeightedRoundScore([])).toBe(0)
  })
})

describe('useIntervalTrainerController', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('computeResult returns zero and real metric keys for empty history', () => {
    const base = createMockBase()
    const ctrl = useIntervalTrainerController(base, audioEngine)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_INTERVAL_TRAINER)
    expect(result.score).toBe(0)
    expect(result.metrics.roundsCompleted).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestRound).toBe(0)
    expect(result.metrics.smallIntervalAvg).toBe(0)
    expect(result.metrics.mediumIntervalAvg).toBe(0)
    expect(result.metrics.largeIntervalAvg).toBe(0)
  })

  it('setBase resets target pitch to zero (listening sentinel)', () => {
    const targetCalls: Array<number | null> = []
    const base = createMockBase({
      _setTargetPitch: ((v: number | null) => {
        targetCalls.push(v)
        return v
      }) as BaseExerciseController['_setTargetPitch'],
    })
    const ctrl = useIntervalTrainerController(base, audioEngine)
    ctrl.setBase(60) // C4

    // setBase clears the target to 0 until the first round plays a tone.
    expect(targetCalls).toContain(0)
  })

  it('stopRounds commits a result and stops running', () => {
    const committed: unknown[] = []
    let runningSet: boolean | undefined
    const base = createMockBase({
      _completeWithResult: (r) => committed.push(r),
      _setRunning: (v) => {
        runningSet = v
      },
    })
    const ctrl = useIntervalTrainerController(base, audioEngine)
    ctrl.setBase(60)
    ctrl.stopRounds()

    expect(committed.length).toBe(1)
    expect(runningSet).toBe(false)
  })

  it('scores a driven happy path within 0-100 (match window uses the relative clock)', async () => {
    // Regression lock for the epoch bug: evaluateRound() filters samples by
    // p.time*1000 against the exercise-relative clock (_getElapsed). When that
    // was mixed with absolute performance.now(), the window selected ZERO
    // samples and every round scored 0. Driving the loop with in-tune samples
    // must now produce a non-zero accuracy.
    vi.useFakeTimers()
    vi.setSystemTime(0)

    let lastMidi = 60
    const base = createMockBase({
      // Under fake timers performance.now() is the relative clock; mirror it.
      _getElapsed: () => performance.now(),
      _updateMetrics: (m) => {
        if (typeof m.currentMidi === 'number') lastMidi = m.currentMidi
      },
      // The singer sustains the note currently being matched, in tune, with
      // timestamps ending at "now" so they land inside the match window.
      pitchHistory: () => {
        const nowMs = performance.now()
        const f = midiToFreq(lastMidi)
        return Array.from({ length: 16 }, (_unused, i) => ({
          freq: f,
          time: (nowMs - i * 60) / 1000,
          cents: 0,
          clarity: 80,
        }))
      },
    })
    const ctrl = useIntervalTrainerController(base, audioEngine)

    ctrl.setBase(60)
    ctrl.startRounds()
    await vi.runAllTimersAsync()

    const result = ctrl.computeResult()
    expect(result.metrics.roundsCompleted).toBeGreaterThan(0)
    expect(result.metrics.avgAccuracy).toBeGreaterThan(0)
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('dispose cancels an in-flight round chain (Back / unmount mid-run)', async () => {
    // Navigating away runs base.reset(), which fires the registered dispose
    // callbacks. The dispose must also flip the controller's cancellation
    // flag: clearing the pending timer alone can't stop a playTone().then()
    // continuation that is in flight — the exercise used to keep playing its
    // whole note sequence after the component was gone.
    vi.useFakeTimers()
    const disposers: Array<() => void> = []
    const playTone = vi.fn().mockResolvedValue(undefined)
    const base = createMockBase({
      _registerDispose: (fn: () => void) => {
        disposers.push(fn)
      },
    })
    const ctrl = useIntervalTrainerController(base, { playTone })

    ctrl.setBase(60)
    ctrl.startRounds()
    // Let the chain get going (first notes + gap timers).
    await vi.advanceTimersByTimeAsync(3000)
    const callsBefore = playTone.mock.calls.length
    expect(callsBefore).toBeGreaterThan(0)

    // What unmount/reset does.
    for (const fn of disposers) fn()

    // Nothing further may play, no matter how long the clock runs.
    await vi.advanceTimersByTimeAsync(120_000)
    expect(playTone.mock.calls.length).toBe(callsBefore)
  })
})

// ── The redesign: per-note slots, honest intervals, running mean ─────
//
// The old round scored BOTH notes against the average deviation of one
// shared 3-second window. A singer doing exactly what the phase line said
// ("sing both notes back") split the window between two pitches, so each
// target saw roughly half the samples ~span cents away — any average above
// ~67 cents scored 0, a PERFECT Major 2nd scored 0, and the ceiling of the
// drill as written was 50 (hold one note, ignore the other). The seven-day
// run's 0% was a correct performance.
describe('per-slot scoring', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /**
   * A singer who does what the drill asks: whenever the matching phase shows
   * a note, they sing THAT note, in tune. The log records which note was
   * current from which elapsed second, and pitchHistory replays it, so slot
   * scoring sees note1 samples in slot one and note2 samples in slot two.
   */
  function createHonestSinger() {
    const log: Array<{ midi: number; fromSec: number }> = []
    let phase = 0
    const base = createMockBase({
      _getElapsed: () => performance.now(),
      _updateMetrics: (m) => {
        if (typeof m.phase === 'number') phase = m.phase
        if (typeof m.currentMidi === 'number' && phase === 2) {
          log.push({ midi: m.currentMidi, fromSec: performance.now() / 1000 })
        }
      },
      pitchHistory: () => {
        const nowSec = performance.now() / 1000
        const samples: Array<{
          freq: number
          time: number
          cents: number
          clarity: number
        }> = []
        for (let t = 0; t < nowSec; t += 0.1) {
          const entry = [...log].reverse().find((e) => e.fromSec <= t)
          if (entry === undefined) continue
          samples.push({
            freq: midiToFreq(entry.midi),
            time: t,
            cents: 0,
            clarity: 90,
          })
        }
        return samples
      },
    })
    return base
  }

  it('scores a correct performance as correct', async () => {
    // The regression lock for the whole-window averaging bug: under the old
    // evaluateRound this run scores ~0 for any span above ~1.3 semitones.
    vi.useFakeTimers()
    vi.setSystemTime(0)

    const base = createHonestSinger()
    const ctrl = useIntervalTrainerController(base, audioEngine)
    ctrl.setBase(60)
    ctrl.startRounds()
    await vi.runAllTimersAsync()

    const result = ctrl.computeResult()
    expect(result.metrics.roundsCompleted).toBeGreaterThan(0)
    expect(result.metrics.avgAccuracy).toBeGreaterThan(80)
    expect(result.score).toBeGreaterThan(80)
  })

  it('gives silence a zero, not a participation grade', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    const base = createMockBase({
      _getElapsed: () => performance.now(),
      pitchHistory: () => [],
    })
    const ctrl = useIntervalTrainerController(base, audioEngine)
    ctrl.setBase(60)
    ctrl.startRounds()
    await vi.runAllTimersAsync()

    expect(ctrl.computeResult().score).toBe(0)
  })

  it('plays the interval it names — no hidden octave', async () => {
    // A quarter of rounds used to add a random +12 to note2, so a round
    // labelled Major 2nd could span 14 semitones and leave the singer's
    // range. Math.random is pinned to the branch that always shifted.
    vi.useFakeTimers()
    vi.setSystemTime(0)
    vi.spyOn(Math, 'random').mockReturnValue(0.9)

    const seen: number[] = []
    const base = createMockBase({
      _getElapsed: () => performance.now(),
      _updateMetrics: (m) => {
        if (typeof m.currentMidi === 'number') seen.push(m.currentMidi)
      },
    })
    const ctrl = useIntervalTrainerController(base, audioEngine)
    ctrl.setBase(60)
    ctrl.startRounds()
    await vi.runAllTimersAsync()

    expect(seen.length).toBeGreaterThan(0)
    expect(Math.max(...seen)).toBeLessThanOrEqual(72)
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(60)
  })

  it('publishes the running mean, not the last round', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    const scores: number[] = []
    const base = createHonestSinger()
    const orig = base._updateScore
    base._updateScore = (v) => {
      scores.push(v)
      orig(v)
    }
    const ctrl = useIntervalTrainerController(base, audioEngine)
    ctrl.setBase(60)
    ctrl.startRounds()
    await vi.runAllTimersAsync()

    // One publish per singing slot, two slots per round.
    const rounds = ctrl.computeResult().metrics.roundsCompleted
    expect(scores).toHaveLength(rounds * 2)
    expect(scores.at(-1)).toBe(ctrl.computeResult().metrics.avgAccuracy)
  })

  it('offers both notes of the round to the tracker ladder', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    const base = createMockBase({ _getElapsed: () => performance.now() })
    const ctrl = useIntervalTrainerController(base, audioEngine)
    ctrl.setBase(60)
    ctrl.startRounds()

    const pair = ctrl.getUpcomingMidi()
    expect(pair).toHaveLength(2)
    expect(pair[0]).toBe(60)
    expect(pair[1]).toBeGreaterThan(60)
    expect(pair[1]).toBeLessThanOrEqual(72)

    await vi.runAllTimersAsync()
    expect(ctrl.getUpcomingMidi()).toHaveLength(0)
  })
})

describe('plannedRounds', () => {
  it('asks for six at the default difficulty', () => {
    expect(plannedRounds(5)).toBe(6)
  })

  it('asks for fewer when easier', () => {
    expect(plannedRounds(1)).toBeLessThan(6)
    expect(plannedRounds(1)).toBeGreaterThanOrEqual(3)
  })

  it('is capped by the interval pool, so the hint never overpromises', () => {
    // round(6 * (2 - factor(10))) is 8; the pool holds 6, and `slice` used
    // to hide the difference while the idle hint promised the bigger number.
    expect(plannedRounds(10)).toBe(6)
  })
})

// ── Cancellation races and early stops ───────────────────────────────
//
// clearTimeout cannot un-queue a timer callback the event loop has already
// dequeued (the HTML spec race the `_cancelled` flag exists for). These
// cases simulate that race by making clearTimeout a no-op before disposing,
// so every pending callback still fires — and must then do nothing.
describe('cancellation and early stop', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Default difficulty timeline: note1 0-800, note2 at 1100, matching from
  // 2500, slot two from 5000, round evaluated at 7500, next round at 8100.
  it.each([
    ['while note two is still queued', 500],
    ['between the notes and the matching phase', 1500],
    ['during a singing slot', 3000],
    ['in the gap before the next round', 7700],
  ])(
    'a callback that outraces clearTimeout does nothing %s',
    async (_label, cancelAtMs) => {
      vi.useFakeTimers()
      const disposers: Array<() => void> = []
      const playTone = vi.fn().mockResolvedValue(undefined)
      let metricUpdates = 0
      const base = createMockBase({
        _registerDispose: (fn: () => void) => {
          disposers.push(fn)
        },
        _updateMetrics: () => {
          metricUpdates += 1
        },
      })
      const ctrl = useIntervalTrainerController(base, { playTone })
      ctrl.setBase(60)
      ctrl.startRounds()
      await vi.advanceTimersByTimeAsync(cancelAtMs)

      // The race: the pending callback survives clearTimeout and still runs.
      vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {})
      for (const fn of disposers) fn()
      const tonesAtCancel = playTone.mock.calls.length
      const metricsAtCancel = metricUpdates

      await vi.advanceTimersByTimeAsync(120_000)

      expect(playTone.mock.calls.length).toBe(tonesAtCancel)
      expect(metricUpdates).toBe(metricsAtCancel)
    },
  )

  /** The in-tune singer from the happy path, packaged for reuse. */
  function singingBase(committed: unknown[]): BaseExerciseController {
    let lastMidi = 60
    return createMockBase({
      _getElapsed: () => performance.now(),
      _completeWithResult: (r) => committed.push(r),
      _updateMetrics: (m) => {
        if (typeof m.currentMidi === 'number') lastMidi = m.currentMidi
      },
      pitchHistory: () => {
        const nowMs = performance.now()
        const f = midiToFreq(lastMidi)
        return Array.from({ length: 16 }, (_unused, i) => ({
          freq: f,
          time: (nowMs - i * 60) / 1000,
          cents: 0,
          clarity: 80,
        }))
      },
    })
  }

  it('stopping after one small round leaves the unplayed sizes at zero', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    // Constant 0.9 keeps the shuffle in pool order: round one is the Major
    // 2nd (span 2, "small").
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const committed: Array<{
      metrics: Record<string, number>
    }> = []
    const ctrl = useIntervalTrainerController(
      singingBase(committed as unknown[]),
      audioEngine,
    )
    ctrl.setBase(60)
    ctrl.startRounds()
    await vi.advanceTimersByTimeAsync(7_500)
    ctrl.stopRounds()

    const result = committed[0]
    expect(result.metrics.roundsCompleted).toBe(1)
    // The one round that played scored; the sizes that never played must
    // report zero, not an invented average.
    expect(result.metrics.smallIntervalAvg).toBeGreaterThan(0)
    expect(result.metrics.mediumIntervalAvg).toBe(0)
    expect(result.metrics.largeIntervalAvg).toBe(0)
  })

  it('stopping after one large round leaves small and medium at zero', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    // Constant 0.1 reverses the shuffle: round one is the Octave (span 12).
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    const committed: Array<{
      metrics: Record<string, number>
    }> = []
    const ctrl = useIntervalTrainerController(
      singingBase(committed as unknown[]),
      audioEngine,
    )
    ctrl.setBase(60)
    ctrl.startRounds()
    await vi.advanceTimersByTimeAsync(7_500)
    ctrl.stopRounds()

    const result = committed[0]
    expect(result.metrics.roundsCompleted).toBe(1)
    expect(result.metrics.largeIntervalAvg).toBeGreaterThan(0)
    expect(result.metrics.smallIntervalAvg).toBe(0)
    expect(result.metrics.mediumIntervalAvg).toBe(0)
  })
})
