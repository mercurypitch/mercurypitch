import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { freqToExactMidi } from '../exercise-scoring-utils'
import { activeTimerSeconds } from '../timer-preference'
import type { ExerciseResult } from '../types'
import { EXERCISE_PITCH_HOLD } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

const INITIAL_ZONE_CENTS = 50
const MIN_ZONE_CENTS = 10
const SHRINK_INTERVAL_MS = 5000
const SHRINK_AMOUNT = 5
const SCORE_UPDATE_HZ = 10
const SCORE_ZONE_WEIGHT = 0.6
const SCORE_DURATION_WEIGHT = 0.4
const TARGET_DURATION_SEC = 60
// No fresh voiced sample for this long ⇒ the singer has gone silent.
const VOICE_GAP_SEC = 0.2

interface PitchHoldControllerOptions {
  /** Reviewed task zone; unlike adaptive practice, it never shrinks. */
  fixedZoneCents?: number
  /** Reviewed hold duration used by the guided score denominator. */
  fixedTargetDurationSeconds?: number
}

export function usePitchHoldController(
  base: BaseExerciseController,
  options: PitchHoldControllerOptions = {},
) {
  let targetMidi = 0
  let zoneRadius = INITIAL_ZONE_CENTS
  let lastShrinkTime = 0
  let inZoneFrames = 0
  let totalFrames = 0
  // Set once the singer first makes sound, so leading reaction-time silence
  // isn't counted against them (silence after they start still is).
  let hasPhonated = false
  let scoreUpdateTimer: ReturnType<typeof setInterval> | undefined
  base._registerDispose(() => {
    clearInterval(scoreUpdateTimer)
    scoreUpdateTimer = undefined
  })

  function setTarget(midi: number): void {
    targetMidi = midi
    base._setTargetPitch(midiToFrequency(midi))
  }

  function startLoop(): void {
    // Ordinary practice adapts to the stored difficulty. A guided route uses
    // the reviewed assessment tolerance verbatim for every repetition.
    zoneRadius =
      options.fixedZoneCents ??
      INITIAL_ZONE_CENTS *
        difficultyFactor(launchDifficulty(EXERCISE_PITCH_HOLD))
    inZoneFrames = 0
    totalFrames = 0
    hasPhonated = false
    lastShrinkTime = performance.now()

    scoreUpdateTimer = setInterval(() => {
      if (!base._isRunning()) return
      const now = performance.now()
      const elapsed = base._getElapsed()

      // Shrink zone over time
      if (
        options.fixedZoneCents === undefined &&
        now - lastShrinkTime > SHRINK_INTERVAL_MS
      ) {
        zoneRadius = Math.max(MIN_ZONE_CENTS, zoneRadius - SHRINK_AMOUNT)
        lastShrinkTime = now
      }

      // Detect real silence by the freshness of the last history sample (only
      // voiced frames are appended). base.currentPitch() is NOT cleared between
      // voiced frames, so it reads stale during a gap — using it let a singer
      // hit the note briefly, go silent, and hold zonePct at 100.
      const history = base.pitchHistory()
      const latest = history[history.length - 1]
      const voiced =
        latest !== undefined && elapsed / 1000 - latest.time <= VOICE_GAP_SEC
      if (voiced) hasPhonated = true

      // Once singing has started, every frame counts — silence in the middle or
      // at the end now dilutes the in-zone percentage instead of being ignored.
      if (hasPhonated) {
        totalFrames++
        if (voiced) {
          const cents = (freqToExactMidi(latest.freq) - targetMidi) * 100
          if (Math.abs(cents) <= zoneRadius) inZoneFrames++
        }
      }

      const zonePct = totalFrames > 0 ? (inZoneFrames / totalFrames) * 100 : 0
      batch(() => {
        base._updateScore(Math.round(zonePct))
        base._updateMetrics({
          zoneRadius,
          zonePct: Math.round(zonePct),
          elapsedMs: Math.round(elapsed),
        })
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
        metrics: {
          durationSec: 0,
          zonePct: 0,
          minZoneCents: options.fixedZoneCents ?? INITIAL_ZONE_CENTS,
          survivedSec: 0,
        },
        completedAt: Date.now(),
      }
    }

    // Ordinary practice grades held frames against its selected timer.
    // Guided practice keeps its reviewed duration authoritative, while its
    // public score remains the single direct pitch-in-zone measurement.
    const targetDurationSec =
      options.fixedTargetDurationSeconds ??
      activeTimerSeconds() ??
      TARGET_DURATION_SEC *
        (2 - difficultyFactor(launchDifficulty(EXERCISE_PITCH_HOLD)))
    const heldSec = totalFrames / SCORE_UPDATE_HZ
    const durationScore = Math.min(100, (heldSec / targetDurationSec) * 100)
    const score =
      options.fixedTargetDurationSeconds === undefined
        ? Math.round(
            zonePct * SCORE_ZONE_WEIGHT + durationScore * SCORE_DURATION_WEIGHT,
          )
        : Math.round(zonePct)

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
    base._completeWithResult(result)
    return result
  }

  return {
    setTarget,
    startLoop,
    computeResult,
    stopAndCompute,
  }
}
