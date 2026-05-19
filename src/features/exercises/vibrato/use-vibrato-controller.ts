import { detectVibrato } from '@/lib/vocal-analyzer'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_VIBRATO } from '../types'

const IDEAL_RATE_MIN = 4
const IDEAL_RATE_MAX = 7
const IDEAL_DEPTH_MIN = 10
const IDEAL_DEPTH_MAX = 50
const SCORE_RATE_WEIGHT = 0.4
const SCORE_DEPTH_WEIGHT = 0.3
const SCORE_CONSISTENCY_WEIGHT = 0.3

export function useVibratoController(base: BaseExerciseController) {
  function computeResult(): ExerciseResult {
    const history = base.pitchHistory()

    if (history.length < 10) {
      return {
        type: EXERCISE_VIBRATO,
        score: 0,
        metrics: { rateHz: 0, depthCents: 0, consistency: 0, classification: 0 },
        completedAt: Date.now(),
      }
    }

    const vibSamples = history.map((p) => ({
      time: p.time,
      freq: p.freq,
      midi: p.freq > 0 ? 12 * Math.log2(p.freq / 440) + 69 : 0,
    }))

    const sampleRate = Math.round(history.length / ((history[history.length - 1].time - history[0].time) || 1))
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

    // Rate score: best in 4-7 Hz range, penalty outside
    let rateScore: number
    if (vibResult.rateHz >= IDEAL_RATE_MIN && vibResult.rateHz <= IDEAL_RATE_MAX) {
      rateScore = 100
    } else if (vibResult.rateHz < IDEAL_RATE_MIN) {
      rateScore = Math.max(0, (vibResult.rateHz / IDEAL_RATE_MIN) * 100)
    } else {
      rateScore = Math.max(0, 100 - (vibResult.rateHz - IDEAL_RATE_MAX) * 10)
    }

    // Depth score: best in 10-50 cents range
    let depthScore: number
    if (vibResult.depthCents >= IDEAL_DEPTH_MIN && vibResult.depthCents <= IDEAL_DEPTH_MAX) {
      depthScore = 100
    } else if (vibResult.depthCents < IDEAL_DEPTH_MIN) {
      depthScore = Math.max(0, (vibResult.depthCents / IDEAL_DEPTH_MIN) * 100)
    } else {
      depthScore = Math.max(0, 100 - (vibResult.depthCents - IDEAL_DEPTH_MAX) * 0.8)
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
    base._setRunning(false)
    const result = computeResult()
    base._commitResult(result)
    base._updateScore(result.score)
    base._updateMetrics(result.metrics)
    base.stop()
    return result
  }

  return { computeResult, stopAndCompute }
}
