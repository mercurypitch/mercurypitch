import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { detectSlides } from '@/lib/vocal-analyzer'
import { freqToExactMidi } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_SLIDE } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

const SCORE_SMOOTHNESS_WEIGHT = 0.3
const SCORE_ARRIVAL_WEIGHT = 0.3
const SCORE_DEPARTURE_WEIGHT = 0.2
const SCORE_SPEED_WEIGHT = 0.2
const OPTIMAL_SLIDE_MS = 300
// Baseline cents->penalty slope for arrival/departure accuracy (100 - |cents|*K).
const CENTS_PENALTY_K = 0.8
const METRIC_UPDATE_HZ = 10

export function useSlideController(base: BaseExerciseController) {
  let targetStartMidi = 0
  let targetEndMidi = 0
  // Per-round difficulty-scaled knobs (defaults == original at difficulty 5,
  // where difficultyFactor(5) === 1.0). Recomputed each round in setTargets.
  let centsPenaltyK = CENTS_PENALTY_K
  let optimalSlideMs = OPTIMAL_SLIDE_MS
  let metricTimer: ReturnType<typeof setInterval> | undefined
  base._registerDispose(() => {
    clearInterval(metricTimer)
    metricTimer = undefined
  })

  function setTargets(fromMidi: number, toMidi: number): void {
    targetStartMidi = fromMidi
    targetEndMidi = toMidi

    // Scale this controller's own tolerance/timing by adaptive difficulty.
    const difficulty = launchDifficulty(EXERCISE_SLIDE)
    const factor = difficultyFactor(difficulty)
    // Tighter accept window when harder: steeper cents penalty (1/factor).
    centsPenaltyK = CENTS_PENALTY_K / factor
    // Less time allowed when harder: shrink the optimal-slide window.
    optimalSlideMs = OPTIMAL_SLIDE_MS * factor
  }

  function startLoop(): void {
    metricTimer = setInterval(() => {
      if (!base._isRunning()) return
      const history = base.pitchHistory()
      if (history.length < 3) return

      const recent = history.slice(-20)
      const validSamples = recent
        .filter((p) => p.freq > 0)
        .map((p) => ({
          time: p.time,
          midi: freqToExactMidi(p.freq),
        }))
      if (validSamples.length < 2) return

      // Rough smoothness: how linear (low variance from linear regression)
      const n = validSamples.length
      const meanTime = validSamples.reduce((s, v) => s + v.time, 0) / n
      const meanMidi = validSamples.reduce((s, v) => s + v.midi, 0) / n
      let cov = 0
      let varTime = 0
      for (const v of validSamples) {
        cov += (v.time - meanTime) * (v.midi - meanMidi)
        varTime += (v.time - meanTime) ** 2
      }
      const slope = varTime > 0 ? cov / varTime : 0
      const intercept = meanMidi - slope * meanTime
      let totalResidual = 0
      for (const v of validSamples) {
        const predicted = slope * v.time + intercept
        totalResidual += Math.abs(v.midi - predicted)
      }
      const avgResidual = totalResidual / n
      const smoothness = Math.round(Math.max(0, 100 - avgResidual * 100 * 2))

      // Arrival accuracy from latest pitch (difficulty-scaled penalty slope)
      const latest = validSamples[validSamples.length - 1]!
      const arrivalOff = Math.abs(latest.midi - targetEndMidi) * 100
      const arrivalAccuracy = Math.round(
        Math.max(0, 100 - arrivalOff * centsPenaltyK),
      )

      // Departure accuracy from first valid sample (difficulty-scaled slope)
      const first = validSamples[0]!
      const departureOff = Math.abs(first.midi - targetStartMidi) * 100
      const departureAccuracy = Math.round(
        Math.max(0, 100 - departureOff * centsPenaltyK),
      )

      // Elapsed
      const latestTime = validSamples[validSamples.length - 1]!.time
      const firstTime = validSamples[0]!.time
      const elapsedMs = Math.round((latestTime - firstTime) * 1000)

      batch(() => {
        base._updateMetrics({
          smoothness,
          arrivalAccuracy,
          departureAccuracy,
          slideTimeMs: elapsedMs,
        })
        // Live weights match final weights (SMOOTHNESS/ARRIVAL/DEPARTURE)
        // proportionally re-scaled without the SPEED component
        base._updateScore(
          Math.round(
            smoothness * 0.38 +
              arrivalAccuracy * 0.38 +
              departureAccuracy * 0.24,
          ),
        )
      })
    }, 1000 / METRIC_UPDATE_HZ)
  }

  function computeResult(): ExerciseResult {
    const history = base.pitchHistory()

    if (history.length < 5) {
      return {
        type: EXERCISE_SLIDE,
        score: 0,
        metrics: {
          smoothness: 0,
          arrivalAccuracy: 0,
          departureAccuracy: 0,
          slideTimeMs: 0,
          classification: 0,
        },
        completedAt: Date.now(),
      }
    }

    const samples = history.map((p) => ({
      time: p.time,
      midi: freqToExactMidi(p.freq),
      freq: p.freq,
    }))

    const slideResult = detectSlides(samples)

    if (slideResult.slides.length === 0) {
      const score = 0
      return {
        type: EXERCISE_SLIDE,
        score,
        metrics: {
          smoothness: 0,
          arrivalAccuracy: 0,
          departureAccuracy: 0,
          slideTimeMs: 0,
          classification: -1,
        },
        completedAt: Date.now(),
      }
    }

    // Use the most prominent slide
    const primarySlide = slideResult.slides.reduce((best, s) =>
      s.semitoneSpan > best.semitoneSpan ? s : best,
    )

    // Smoothness: directness score from the analyzer
    const smoothnessScore = primarySlide.directness

    // Arrival accuracy: how close the end pitch is to target
    // (difficulty-scaled penalty slope: tighter window when harder)
    let arrivalScore = 0
    if (targetEndMidi > 0) {
      const endCentsOff = Math.abs(primarySlide.endMidi - targetEndMidi) * 100
      arrivalScore = Math.max(0, 100 - endCentsOff * centsPenaltyK)
    } else {
      arrivalScore = primarySlide.score // fallback to analyzer score
    }

    // Departure accuracy: how close the start pitch is to target
    // (difficulty-scaled penalty slope)
    let departureScore = 0
    if (targetStartMidi > 0) {
      const startCentsOff =
        Math.abs(primarySlide.startMidi - targetStartMidi) * 100
      departureScore = Math.max(0, 100 - startCentsOff * centsPenaltyK)
    } else {
      departureScore = 70 // neutral when no start target specified
    }

    // Speed score: faster slides score higher, but not too fast.
    // Optimal window is difficulty-scaled: less time allowed when harder.
    const slideMs = primarySlide.durationMs
    let speedScore: number
    if (slideMs <= 0) {
      speedScore = 0
    } else if (slideMs <= optimalSlideMs) {
      speedScore = 100
    } else {
      speedScore = Math.max(0, 100 - (slideMs - optimalSlideMs) * 0.15)
    }

    const classificationMap: Record<string, number> = {
      clean: 3,
      scoop: 1,
      fall: 1,
      overshoot: 2,
      wobble: 0,
    }

    const score = Math.round(
      smoothnessScore * SCORE_SMOOTHNESS_WEIGHT +
        arrivalScore * SCORE_ARRIVAL_WEIGHT +
        departureScore * SCORE_DEPARTURE_WEIGHT +
        speedScore * SCORE_SPEED_WEIGHT,
    )

    return {
      type: EXERCISE_SLIDE,
      score,
      metrics: {
        smoothness: Math.round(smoothnessScore),
        arrivalAccuracy: Math.round(arrivalScore),
        departureAccuracy: Math.round(departureScore),
        slideTimeMs: Math.round(slideMs),
        classification: classificationMap[primarySlide.type] ?? 0,
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

  return { setTargets, startLoop, computeResult, stopAndCompute }
}
