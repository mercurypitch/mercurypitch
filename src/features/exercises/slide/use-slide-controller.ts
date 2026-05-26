import { batch } from 'solid-js'
import { detectSlides } from '@/lib/vocal-analyzer'
import type { ExerciseResult } from '../types'
import { EXERCISE_SLIDE } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

const SCORE_SMOOTHNESS_WEIGHT = 0.3
const SCORE_ARRIVAL_WEIGHT = 0.3
const SCORE_DEPARTURE_WEIGHT = 0.2
const SCORE_SPEED_WEIGHT = 0.2
const OPTIMAL_SLIDE_MS = 300
const METRIC_UPDATE_HZ = 10

export function useSlideController(base: BaseExerciseController) {
  let targetStartMidi = 0
  let targetEndMidi = 0
  let metricTimer: ReturnType<typeof setInterval> | undefined
  base._registerDispose(() => {
    clearInterval(metricTimer)
    metricTimer = undefined
  })

  function setTargets(fromMidi: number, toMidi: number): void {
    targetStartMidi = fromMidi
    targetEndMidi = toMidi
  }

  function startLoop(): void {
    metricTimer = setInterval(() => {
      if (!base._isRunning()) return
      const history = base.pitchHistory()
      if (history.length < 3) return

      const recent = history.slice(-20)
      const validSamples = recent.filter((p) => p.freq > 0).map((p) => ({
        time: p.time,
        midi: 12 * Math.log2(p.freq / 440) + 69,
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

      // Progress: how far between start and end based on latest pitch
      const latest = validSamples[validSamples.length - 1]!
      const span = targetEndMidi - targetStartMidi
      const progress =
        span !== 0
          ? Math.round(
              Math.max(0, Math.min(100, ((latest.midi - targetStartMidi) / span) * 100)),
            )
          : 0

      // Arrival accuracy from latest pitch
      const arrivalOff = Math.abs(latest.midi - targetEndMidi) * 100
      const arrivalAccuracy = Math.round(Math.max(0, 100 - arrivalOff * 0.8))

      // Departure accuracy from first valid sample
      const first = validSamples[0]!
      const departureOff = Math.abs(first.midi - targetStartMidi) * 100
      const departureAccuracy = Math.round(Math.max(0, 100 - departureOff * 0.8))

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
        base._updateScore(
          Math.round(smoothness * 0.4 + arrivalAccuracy * 0.4 + departureAccuracy * 0.2),
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
    let arrivalScore = 0
    if (targetEndMidi > 0) {
      const endCentsOff = Math.abs(primarySlide.endMidi - targetEndMidi) * 100
      arrivalScore = Math.max(0, 100 - endCentsOff * 0.8)
    } else {
      arrivalScore = primarySlide.score // fallback to analyzer score
    }

    // Departure accuracy: how close the start pitch is to target
    let departureScore = 0
    if (targetStartMidi > 0) {
      const startCentsOff =
        Math.abs(primarySlide.startMidi - targetStartMidi) * 100
      departureScore = Math.max(0, 100 - startCentsOff * 0.8)
    } else {
      departureScore = 70 // neutral when no start target specified
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
