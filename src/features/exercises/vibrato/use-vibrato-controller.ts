import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { detectVibrato } from '@/lib/vocal-analyzer'
import { freqToExactMidi } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_VIBRATO } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'
import type { VibratoStyle, VibratoStyleId } from './vibrato-styles'
import { DEFAULT_VIBRATO_STYLE, VIBRATO_STYLES } from './vibrato-styles'

const SCORE_RATE_WEIGHT = 0.4
const SCORE_DEPTH_WEIGHT = 0.3
const SCORE_CONSISTENCY_WEIGHT = 0.3
const METRIC_UPDATE_MS = 1500
/** Analyze only the most recent few seconds so a vibrato that starts mid-note
 *  isn't diluted by the steady onset that precedes it. */
const ANALYSIS_WINDOW_SEC = 4

type PitchSample = { freq: number; time: number; cents: number }

/** Keep the trailing `windowSec` of samples (by their time field). */
function trailingWindow(
  history: readonly PitchSample[],
  windowSec: number,
): PitchSample[] {
  if (history.length === 0) return []
  const cutoff = history[history.length - 1]!.time - windowSec
  const start = history.findIndex((p) => p.time >= cutoff)
  return start <= 0 ? [...history] : history.slice(start)
}

function toVibSamples(history: readonly PitchSample[]) {
  return history.map((p) => ({
    time: p.time,
    freq: p.freq,
    midi: freqToExactMidi(p.freq),
  }))
}

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
  // The selected practice style sets the accepted rate/depth windows.
  let style: VibratoStyle = VIBRATO_STYLES[DEFAULT_VIBRATO_STYLE]

  function setStyle(id: VibratoStyleId): void {
    style = VIBRATO_STYLES[id]
  }
  base._registerDispose(() => {
    clearInterval(metricTimer)
    metricTimer = undefined
  })

  function startLoop(): void {
    metricTimer = setInterval(() => {
      if (!base._isRunning()) return
      const history = trailingWindow(base.pitchHistory(), ANALYSIS_WINDOW_SEC)
      if (history.length < 10) return

      // detectVibrato resamples onto a uniform grid internally, so the
      // sample-rate hint is unused; pass a nominal value.
      const vibResult = detectVibrato(toVibSamples(history), 100)

      if (!vibResult.detected) return

      // Tighten acceptance windows with adaptive difficulty (harder = narrower).
      const difficulty = launchDifficulty(EXERCISE_VIBRATO)
      const rateWin = scaleWindow(style.rateMin, style.rateMax, difficulty)
      const depthWin = scaleWindow(style.depthMin, style.depthMax, difficulty)

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
    const history = trailingWindow(base.pitchHistory(), ANALYSIS_WINDOW_SEC)

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

    const vibResult = detectVibrato(toVibSamples(history), 100)

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
    const rateWin = scaleWindow(style.rateMin, style.rateMax, difficulty)
    const depthWin = scaleWindow(style.depthMin, style.depthMax, difficulty)

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

  return { startLoop, computeResult, stopAndCompute, setStyle }
}
