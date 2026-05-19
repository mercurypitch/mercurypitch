import { detectSlides } from '@/lib/vocal-analyzer'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_SLIDE } from '../types'

const SCORE_SMOOTHNESS_WEIGHT = 0.4
const SCORE_ARRIVAL_WEIGHT = 0.4
const SCORE_SPEED_WEIGHT = 0.2
const OPTIMAL_SLIDE_MS = 300

export function useSlideController(base: BaseExerciseController) {
  let targetEndMidi = 0

  function setTargets(_fromMidi: number, toMidi: number): void {
    targetEndMidi = toMidi
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
          slideTimeMs: 0,
          classification: 0,
        },
        completedAt: Date.now(),
      }
    }

    const samples = history.map((p) => ({
      time: p.time,
      midi: p.freq > 0 ? 12 * Math.log2(p.freq / 440) + 69 : 0,
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
    let arrivalScore = 0
    if (targetEndMidi > 0) {
      const endCentsOff = Math.abs(primarySlide.endMidi - targetEndMidi) * 100
      arrivalScore = Math.max(0, 100 - endCentsOff * 0.8)
    } else {
      arrivalScore = primarySlide.score // fallback to analyzer score
    }

    // Speed score: faster slides score higher, but not too fast
    const slideMs = primarySlide.durationMs
    let speedScore: number
    if (slideMs <= 0) {
      speedScore = 0
    } else if (slideMs <= OPTIMAL_SLIDE_MS) {
      speedScore = 100
    } else {
      speedScore = Math.max(0, 100 - (slideMs - OPTIMAL_SLIDE_MS) * 0.15)
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
        speedScore * SCORE_SPEED_WEIGHT,
    )

    return {
      type: EXERCISE_SLIDE,
      score,
      metrics: {
        smoothness: Math.round(smoothnessScore),
        arrivalAccuracy: Math.round(arrivalScore),
        slideTimeMs: Math.round(slideMs),
        classification: classificationMap[primarySlide.type] ?? 0,
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

  return { setTargets, computeResult, stopAndCompute }
}
