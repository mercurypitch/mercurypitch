import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { detectVibrato } from '@/lib/vocal-analyzer'
import { freqToExactMidi } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_VIBRATO } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

const IDEAL_RATE_MIN = 4
const IDEAL_RATE_MAX = 7
const IDEAL_DEPTH_MIN = 10
const IDEAL_DEPTH_MAX = 50
const SCORE_RATE_WEIGHT = 0.4
const SCORE_DEPTH_WEIGHT = 0.3
const SCORE_CONSISTENCY_WEIGHT = 0.3
const METRIC_UPDATE_MS = 1500

/**
 * Tighten an acceptance window around its center by the difficulty factor.
 * Harder (factor < 1) shrinks the half-width; difficultyFactor(5) === 1.0,
 * so at the default level the returned bounds equal [min, max] exactly.
 */
function scaleWindow(
  min: number,
  max: number,
  difficulty: number,
): { min: number; max: number } {
  const center = (min + max) / 2
  const half = ((max - min) / 2) * difficultyFactor(difficulty)
  return { min: center - half, max: center + half }
}

export function useVibratoController(base: BaseExerciseController) {
  let metricTimer: ReturnType<typeof setInterval> | undefined
  base._registerDispose(() => {
    clearInterval(metricTimer)
    metricTimer = undefined
  })

  function startLoop(): void {
    metricTimer = setInterval(() => {
      if (!base._isRunning()) return
      const history = base.pitchHistory()
      if (history.length < 10) return

      const vibSamples = history.map((p) => ({
        time: p.time,
        freq: p.freq,
        midi: freqToExactMidi(p.freq),
      }))

      const lastTime = vibSamples[vibSamples.length - 1]!.time
      const firstTime = vibSamples[0]!.time
      const durationSec = lastTime - firstTime
      if (durationSec <= 0) return

      const sampleRate = Math.round(history.length / durationSec)
      const vibResult = detectVibrato(vibSamples, sampleRate)

      if (!vibResult.detected) return

      // Tighten acceptance windows with adaptive difficulty (harder = narrower).
      const difficulty = launchDifficulty(EXERCISE_VIBRATO)
      const rateWin = scaleWindow(IDEAL_RATE_MIN, IDEAL_RATE_MAX, difficulty)
      const depthWin = scaleWindow(IDEAL_DEPTH_MIN, IDEAL_DEPTH_MAX, difficulty)

      // Rate score
      let rateScore: number
      if (vibResult.rateHz >= rateWin.min && vibResult.rateHz <= rateWin.max) {
        rateScore = 100
      } else if (vibResult.rateHz < rateWin.min) {
        rateScore = Math.max(0, (vibResult.rateHz / rateWin.min) * 100)
      } else {
        rateScore = Math.max(0, 100 - (vibResult.rateHz - rateWin.max) * 10)
      }

      // Depth score
      let depthScore: number
      if (
        vibResult.depthCents >= depthWin.min &&
        vibResult.depthCents <= depthWin.max
      ) {
        depthScore = 100
      } else if (vibResult.depthCents < depthWin.min) {
        depthScore = Math.max(0, (vibResult.depthCents / depthWin.min) * 100)
      } else {
        depthScore = Math.max(
          0,
          100 - (vibResult.depthCents - depthWin.max) * 0.8,
        )
      }

      const currentScore = Math.round(
        rateScore * SCORE_RATE_WEIGHT +
          depthScore * SCORE_DEPTH_WEIGHT +
          vibResult.confidence * SCORE_CONSISTENCY_WEIGHT,
      )

      batch(() => {
        base._updateMetrics({
          rateHz: Math.round(vibResult.rateHz * 10) / 10,
          depthCents: Math.round(vibResult.depthCents),
          consistency: vibResult.confidence,
        })
        base._updateScore(currentScore)
      })
    }, METRIC_UPDATE_MS)
  }

  function computeResult(): ExerciseResult {
    const history = base.pitchHistory()

    if (history.length < 10) {
      return {
        type: EXERCISE_VIBRATO,
        score: 0,
        metrics: {
          rateHz: 0,
          depthCents: 0,
          consistency: 0,
          classification: 0,
        },
        completedAt: Date.now(),
      }
    }

    const vibSamples = history.map((p) => ({
      time: p.time,
      freq: p.freq,
      midi: freqToExactMidi(p.freq),
    }))

    const sampleRate = Math.round(
      history.length /
        (history[history.length - 1].time - history[0].time || 1),
    )
    const vibResult = detectVibrato(vibSamples, sampleRate)

    if (!vibResult.detected) {
      return {
        type: EXERCISE_VIBRATO,
        score: 10,
        metrics: {
          rateHz: Math.round(vibResult.rateHz * 10) / 10,
          depthCents: Math.round(vibResult.depthCents),
          consistency: vibResult.confidence,
          classification: 0,
        },
        completedAt: Date.now(),
      }
    }

    // Tighten acceptance windows with adaptive difficulty (harder = narrower).
    const difficulty = launchDifficulty(EXERCISE_VIBRATO)
    const rateWin = scaleWindow(IDEAL_RATE_MIN, IDEAL_RATE_MAX, difficulty)
    const depthWin = scaleWindow(IDEAL_DEPTH_MIN, IDEAL_DEPTH_MAX, difficulty)

    // Rate score: best inside the (scaled) rate window, penalty outside
    let rateScore: number
    if (vibResult.rateHz >= rateWin.min && vibResult.rateHz <= rateWin.max) {
      rateScore = 100
    } else if (vibResult.rateHz < rateWin.min) {
      rateScore = Math.max(0, (vibResult.rateHz / rateWin.min) * 100)
    } else {
      rateScore = Math.max(0, 100 - (vibResult.rateHz - rateWin.max) * 10)
    }

    // Depth score: best inside the (scaled) depth window
    let depthScore: number
    if (
      vibResult.depthCents >= depthWin.min &&
      vibResult.depthCents <= depthWin.max
    ) {
      depthScore = 100
    } else if (vibResult.depthCents < depthWin.min) {
      depthScore = Math.max(0, (vibResult.depthCents / depthWin.min) * 100)
    } else {
      depthScore = Math.max(
        0,
        100 - (vibResult.depthCents - depthWin.max) * 0.8,
      )
    }

    // Consistency = confidence from the detection
    const consistencyScore = vibResult.confidence

    const score = Math.round(
      rateScore * SCORE_RATE_WEIGHT +
        depthScore * SCORE_DEPTH_WEIGHT +
        consistencyScore * SCORE_CONSISTENCY_WEIGHT,
    )

    // Map classification to numeric for metrics
    const classificationMap: Record<string, number> = {
      none: 0,
      'slow-operatic': 1,
      natural: 2,
      nervous: 3,
      wide: 4,
    }

    return {
      type: EXERCISE_VIBRATO,
      score,
      metrics: {
        rateHz: Math.round(vibResult.rateHz * 10) / 10,
        depthCents: Math.round(vibResult.depthCents),
        consistency: vibResult.confidence,
        classification: classificationMap[vibResult.classification] ?? 0,
      },
      completedAt: Date.now(),
    }
  }

  function stopAndCompute(): ExerciseResult {
    if (metricTimer) clearInterval(metricTimer)
    base._setRunning(false)
    const result = computeResult()
    base._completeWithResult(result)
    return result
  }

  return { startLoop, computeResult, stopAndCompute }
}
