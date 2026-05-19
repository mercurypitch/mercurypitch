import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_PITCH_HOLD } from '../types'

const INITIAL_ZONE_CENTS = 50
const MIN_ZONE_CENTS = 10
const SHRINK_INTERVAL_MS = 5000
const SHRINK_AMOUNT = 5
const SCORE_UPDATE_HZ = 10

export function usePitchHoldController(base: BaseExerciseController) {
  let targetMidi = 0
  let zoneRadius = INITIAL_ZONE_CENTS
  let lastShrinkTime = 0
  let inZoneFrames = 0
  let totalFrames = 0
  let scoreUpdateTimer: ReturnType<typeof setInterval> | undefined

  function setTarget(midi: number): void {
    targetMidi = midi
    base._setTargetPitch(midi)
  }

  function startLoop(): void {
    zoneRadius = INITIAL_ZONE_CENTS
    inZoneFrames = 0
    totalFrames = 0
    lastShrinkTime = performance.now()

    scoreUpdateTimer = setInterval(() => {
      if (!base._isRunning()) return
      const now = performance.now()
      const elapsed = base._getElapsed()

      // Shrink zone over time
      if (now - lastShrinkTime > SHRINK_INTERVAL_MS) {
        zoneRadius = Math.max(MIN_ZONE_CENTS, zoneRadius - SHRINK_AMOUNT)
        lastShrinkTime = now
      }

      const pitch = base.currentPitch()
      if (pitch && pitch.freq > 0) {
        totalFrames++
        const midi = 12 * Math.log2(pitch.freq / 440) + 69
        const cents = (midi - targetMidi) * 100
        if (Math.abs(cents) <= zoneRadius) {
          inZoneFrames++
        }
      }

      const zonePct = totalFrames > 0 ? (inZoneFrames / totalFrames) * 100 : 0
      base._updateScore(Math.round(zonePct))
      base._updateMetrics({
        zoneRadius,
        zonePct: Math.round(zonePct),
        elapsedMs: Math.round(elapsed),
      })
    }, 1000 / SCORE_UPDATE_HZ)
  }

  function computeResult(): ExerciseResult {
    const elapsed = base._getElapsed()
    const durationSec = elapsed / 1000
    const zonePct = totalFrames > 0 ? (inZoneFrames / totalFrames) * 100 : 0

    if (totalFrames < 10) {
      return {
        type: EXERCISE_PITCH_HOLD,
        score: 0,
        metrics: { durationSec: 0, zonePct: 0, minZoneCents: INITIAL_ZONE_CENTS, survivedSec: 0 },
        completedAt: Date.now(),
      }
    }

    // Score: zone percentage weighted by duration
    const durationScore = Math.min(100, (durationSec / 60) * 100) // 60s = 100
    const score = Math.round(zonePct * 0.6 + durationScore * 0.4)

    return {
      type: EXERCISE_PITCH_HOLD,
      score,
      metrics: {
        durationSec: Math.round(durationSec * 10) / 10,
        zonePct: Math.round(zonePct),
        minZoneCents: zoneRadius,
        survivedSec: Math.round(durationSec),
      },
      completedAt: Date.now(),
    }
  }

  function stopAndCompute(): ExerciseResult {
    if (scoreUpdateTimer) clearInterval(scoreUpdateTimer)
    base._setRunning(false)
    const result = computeResult()
    base._commitResult(result)
    base._updateScore(result.score)
    base._updateMetrics(result.metrics)
    base.stop()
    return result
  }

  return {
    setTarget,
    startLoop,
    computeResult,
    stopAndCompute,
  }
}
