import { batch } from 'solid-js'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { trailingSamplesByTime } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_WARMUP } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'
import type { WarmupStep } from './warmup-steps'

const NOTE_PLAY_DURATION_MS = 450
const TICK_MS = 250
/** Lenient voiced-frame budget: singing ~half the window scores full marks. */
const EXPECTED_VOICED_PER_SEC = 25

/**
 * Walks the warmup steps: breath steps are guided timers, sing steps play the
 * reference notes then open a sing-back window. Scoring is participation-based
 * (was the singer actually phonating during sing windows?) — a warmup coaches,
 * it doesn't grade accuracy.
 */
export function useWarmupController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let steps: WarmupStep[] = []
  let baseMidi = 60
  let stepIndex = 0
  let singScores: number[] = []
  let stepTimer: ReturnType<typeof setTimeout> | undefined
  let tickTimer: ReturnType<typeof setInterval> | undefined
  let _cancelled = false

  base._registerDispose(() => {
    clearTimeout(stepTimer)
    clearInterval(tickTimer)
    stepTimer = undefined
    tickTimer = undefined
  })

  function setup(midi: number, warmupSteps: WarmupStep[]): void {
    _cancelled = false
    baseMidi = midi
    steps = warmupSteps
    stepIndex = 0
    singScores = []
  }

  function startSteps(): void {
    runStep()
  }

  function runStep(): void {
    if (_cancelled) return
    if (stepIndex >= steps.length) {
      finish()
      return
    }

    const step = steps[stepIndex]
    batch(() => {
      base._updateMetrics({
        stepIndex,
        totalSteps: steps.length,
        // 0 = breath timer, 1 = listening to the reference, 2 = singing back
        phase: step.kind === 'breath' ? 0 : 1,
        stepRemaining: step.seconds,
      })
    })

    if (step.kind === 'breath') {
      startWindow(step.seconds, () => {
        stepIndex++
        runStep()
      })
      return
    }

    void playReference(step.offsets ?? []).then(() => {
      if (_cancelled) return
      base._updateMetrics({ phase: 2, stepRemaining: step.seconds })
      const windowMs = step.seconds * 1000
      startWindow(step.seconds, () => {
        scoreSingWindow(windowMs, step.seconds)
        stepIndex++
        runStep()
      })
    })
  }

  async function playReference(offsets: number[]): Promise<void> {
    for (const offset of offsets) {
      if (_cancelled) return
      const midi = baseMidi + offset
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({ currentMidi: midi })
      await audioEngine.playTone(midiToFreq(midi), NOTE_PLAY_DURATION_MS)
    }
  }

  /** Run a countdown of `seconds`, ticking stepRemaining, then call `done`. */
  function startWindow(seconds: number, done: () => void): void {
    const startedAt = Date.now()
    clearInterval(tickTimer)
    tickTimer = setInterval(() => {
      const left = Math.max(0, seconds - (Date.now() - startedAt) / 1000)
      base._updateMetrics({ stepRemaining: Math.ceil(left) })
    }, TICK_MS)
    stepTimer = setTimeout(() => {
      clearInterval(tickTimer)
      if (_cancelled) return
      done()
    }, seconds * 1000)
  }

  function scoreSingWindow(windowMs: number, seconds: number): void {
    const history = base.pitchHistory()
    const recent = trailingSamplesByTime(history, windowMs)
    const voiced = recent.filter((p) => p.freq > 0).length
    const expected = seconds * EXPECTED_VOICED_PER_SEC
    const score = Math.round(Math.min(1, voiced / expected) * 100)
    singScores.push(score)

    const avg = singScores.reduce((a, b) => a + b, 0) / singScores.length
    batch(() => {
      base._updateScore(Math.round(avg))
      base._updateMetrics({ lastStepScore: score })
    })
  }

  function finish(): void {
    base._completeWithResult(computeResult())
  }

  function computeResult(): ExerciseResult {
    const participation =
      singScores.length > 0
        ? Math.round(singScores.reduce((a, b) => a + b, 0) / singScores.length)
        : 0
    return {
      type: EXERCISE_WARMUP,
      score: participation,
      metrics: {
        stepsCompleted: stepIndex,
        totalSteps: steps.length,
        participation,
      },
      completedAt: Date.now(),
    }
  }

  function stopSteps(): void {
    _cancelled = true
    clearTimeout(stepTimer)
    clearInterval(tickTimer)
    base._setRunning(false)
    finish()
  }

  return { setup, startSteps, stopSteps }
}
