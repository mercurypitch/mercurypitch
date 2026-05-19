import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_LONG_NOTE } from '../types'

const STEADY_ZONE_THRESHOLD_CENTS = 15
const SCORE_WINDOW_MS = 3000
const SCORE_STABILITY_WEIGHT = 0.35
const SCORE_DRIFT_WEIGHT = 0.2
const SCORE_STEADY_WEIGHT = 0.3
const SCORE_DURATION_WEIGHT = 0.15
const TARGET_DURATION_SEC = 30

export function useLongNoteController(base: BaseExerciseController) {
  let targetMidi = 0

  function setTarget(midi: number): void {
    targetMidi = midi
    base._setTargetPitch(midi)
  }

  function computeResult(): ExerciseResult {
    const history = base.pitchHistory()
    const elapsed = base._getElapsed()
    const durationSec = elapsed / 1000

    if (history.length < 2) {
      return {
        type: EXERCISE_LONG_NOTE,
        score: 0,
        metrics: { durationSec: 0, pitchStabilityCents: 0, maxDriftCents: 0, steadyZonePct: 0, volumeConsistency: 100 },
        completedAt: Date.now(),
      }
    }

    // Compute cents deviation from target for each sample
    const deviations: number[] = []
    for (const p of history) {
      if (p.freq > 0) {
        const midi = 12 * Math.log2(p.freq / 440) + 69
        deviations.push((midi - targetMidi) * 100)
      }
    }

    if (deviations.length === 0) {
      return {
        type: EXERCISE_LONG_NOTE,
        score: 0,
        metrics: { durationSec, pitchStabilityCents: 0, maxDriftCents: 0, steadyZonePct: 0, volumeConsistency: 100 },
        completedAt: Date.now(),
      }
    }

    // Stability: standard deviation of cents
    const mean = deviations.reduce((a, b) => a + b, 0) / deviations.length
    const variance =
      deviations.reduce((sum, d) => sum + (d - mean) ** 2, 0) / deviations.length
    const stabilityCents = Math.sqrt(variance)

    // Max drift
    const absDeviations = deviations.map((d) => Math.abs(d))
    const maxDrift = Math.max(...absDeviations)

    // Steady zone: % of samples within ±15 cents
    const steadyCount = absDeviations.filter((d) => d <= STEADY_ZONE_THRESHOLD_CENTS).length
    const steadyPct = (steadyCount / deviations.length) * 100

    // Volume consistency requires RMS data from the audio engine
    const volumeConsistency = 0

    // Scoring
    const stabilityScore = Math.max(0, 100 - stabilityCents * 2) // 0¢ = 100, 50¢ = 0
    const driftScore = Math.max(0, 100 - maxDrift * 1.5) // 0¢ = 100, ~67¢ = 0
    const steadyScore = steadyPct // already 0-100
    const durationScore = Math.min(100, (durationSec / TARGET_DURATION_SEC) * 100)

    const score = Math.round(
      stabilityScore * SCORE_STABILITY_WEIGHT +
        driftScore * SCORE_DRIFT_WEIGHT +
        steadyScore * SCORE_STEADY_WEIGHT +
        durationScore * SCORE_DURATION_WEIGHT,
    )

    // Best window: sliding 3-second window with lowest deviation
    let bestWindowScore = 0
    let bestWindowStart = 0
    const samplesPerWindow = Math.floor((SCORE_WINDOW_MS / 1000) * (deviations.length / durationSec))
    if (samplesPerWindow > 0 && deviations.length > samplesPerWindow) {
      for (let i = 0; i <= deviations.length - samplesPerWindow; i++) {
        const windowDeviations = deviations.slice(i, i + samplesPerWindow)
        const windowMean = windowDeviations.reduce((a, b) => a + b, 0) / windowDeviations.length
        const windowVar = windowDeviations.reduce((s, d) => s + (d - windowMean) ** 2, 0) / windowDeviations.length
        const windowStability = Math.sqrt(windowVar)
        const windowScore = Math.max(0, 100 - windowStability * 2)
        if (windowScore > bestWindowScore) {
          bestWindowScore = windowScore
          bestWindowStart = history[i]?.time ? i : 0
        }
      }
      bestWindowStart = Math.floor(
        (bestWindowStart / deviations.length) * durationSec * 1000,
      )
    }

    return {
      type: EXERCISE_LONG_NOTE,
      score,
      metrics: {
        durationSec: Math.round(durationSec * 10) / 10,
        pitchStabilityCents: Math.round(stabilityCents),
        maxDriftCents: Math.round(maxDrift),
        steadyZonePct: Math.round(steadyPct),
        volumeConsistency: Math.round(volumeConsistency),
      },
      completedAt: Date.now(),
      bestWindow: bestWindowScore > 0
        ? {
            startMs: bestWindowStart,
            endMs: bestWindowStart + SCORE_WINDOW_MS,
            score: Math.round(bestWindowScore),
          }
        : undefined,
    }
  }

  function stopAndCompute(): ExerciseResult {
    base._setRunning(false)
    const result = computeResult()
    base._commitResult(result)
    base._updateScore(result.score)
    base._updateMetrics(result.metrics)
    // Signal complete
    base.stop()
    return result
  }

  return {
    setTarget,
    computeResult,
    stopAndCompute,
  }
}
