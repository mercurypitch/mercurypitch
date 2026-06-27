import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { intensityFromPitchResults } from '@/lib/vocal-analyzer'
import { freqToExactMidi } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_DYNAMIC_SWELL } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

const NOTE_PLAY_DURATION_MS = 800
const HOLD_DURATION_MS = 8000
// Cents-deviation penalty for the steadiness score (`100 - avgDeviation * K`).
const DEVIATION_PENALTY = 2.0

const INTERVALS = [0, 2, 4, 7] // unison, M2, M3, P5

export function useDynamicSwellController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let targetNotes: number[] = []
  let roundIndex = 0
  let roundScores: number[] = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => {
    clearTimeout(phaseTimer)
    phaseTimer = undefined
  })
  let holdStartTime = 0
  let _cancelled = false
  // Adaptive constants resolved per round set; default level 5 == originals.
  let holdDurationMs = HOLD_DURATION_MS
  let deviationPenalty = DEVIATION_PENALTY

  function setBase(baseMidi: number): void {
    _cancelled = false
    // Scale steadiness tolerance + swell duration by adaptive difficulty.
    const difficulty = launchDifficulty(EXERCISE_DYNAMIC_SWELL)
    const f = difficultyFactor(difficulty)
    // Harder = longer hold: base * (2 - factor). At d5, f=1 -> 8000ms.
    holdDurationMs = Math.round(HOLD_DURATION_MS * (2 - f))
    // Harder = tighter window: penalty / factor. At d5, f=1 -> 2.0.
    deviationPenalty = DEVIATION_PENALTY / f
    targetNotes = INTERVALS.map((i) => baseMidi + i)
    // Shuffle for variety
    targetNotes.sort(() => Math.random() - 0.5)
    roundIndex = 0
    roundScores = []
  }

  function startRounds(): void {
    playRound()
  }

  function playRound(): void {
    if (roundIndex >= targetNotes.length) {
      finish()
      return
    }

    const midi = targetNotes[roundIndex]
    batch(() => {
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({
        round: roundIndex,
        totalRounds: targetNotes.length,
        currentMidi: midi,
        phase: 1, // listening
      })
    })

    void audioEngine
      .playTone(midiToFreq(midi), NOTE_PLAY_DURATION_MS)
      .then(() => {
        if (_cancelled) return
        startHolding()
      })
  }

  function startHolding(): void {
    if (_cancelled) return
    // Exercise-relative clock (same epoch as pitch sample `.time`). Using
    // absolute performance.now() here would make the hold window below select
    // zero samples → every round scores 0.
    holdStartTime = base._getElapsed()
    batch(() => base._updateMetrics({ phase: 2 })) // hold phase
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      evaluateRound()
    }, holdDurationMs)
  }

  function evaluateRound(): void {
    const targetMidi = targetNotes[roundIndex]
    const now = base._getElapsed()
    const history = base.pitchHistory()
    const holdSamples = history.filter((p) => {
      const t = p.time * 1000
      return t >= holdStartTime - 100 && t <= now
    })

    let roundScore = 0
    if (holdSamples.length > 0) {
      const deviations = holdSamples
        .filter((p) => p.freq > 0)
        .map((p) => {
          const midi = freqToExactMidi(p.freq)
          return Math.abs((midi - targetMidi) * 100)
        })
      if (deviations.length > 0) {
        const avgDeviation =
          deviations.reduce((a, b) => a + b, 0) / deviations.length
        roundScore = Math.round(
          Math.max(0, 100 - avgDeviation * deviationPenalty),
        )
      }
    }

    roundScores.push(roundScore)

    const avg = roundScores.reduce((a, b) => a + b, 0) / roundScores.length
    batch(() => {
      base._updateScore(Math.round(avg))
      base._updateMetrics({
        lastRoundScore: roundScore,
        roundsCompleted: roundScores.length,
      })
    })

    roundIndex++
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      playRound()
    }, 600)
  }

  function finish(): void {
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    if (roundScores.length === 0) {
      return {
        type: EXERCISE_DYNAMIC_SWELL,
        score: 0,
        metrics: {
          roundsCompleted: 0,
          avgAccuracy: 0,
          bestRound: 0,
          dynamicRangeDb: 0,
          avgDb: 0,
          peakDb: 0,
        },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(
      roundScores.reduce((a, b) => a + b, 0) / roundScores.length,
    )
    const bestRound = Math.max(...roundScores)

    const history = base.pitchHistory()
    const intensitySamples = history
      .filter((p) => p.freq > 0 && p.clarity !== undefined)
      .map((p) => ({
        time: p.time,
        clarity: p.clarity!,
        midi: freqToExactMidi(p.freq),
      }))
    const intensity = intensityFromPitchResults(intensitySamples)
    const dynamicRangeDb = Math.round(intensity.dynamicRange * 10) / 10
    const dynamicScore = Math.min(100, dynamicRangeDb * 3)

    return {
      type: EXERCISE_DYNAMIC_SWELL,
      score: Math.round(
        avgAccuracy * 0.45 + bestRound * 0.2 + dynamicScore * 0.35,
      ),
      metrics: {
        roundsCompleted: roundScores.length,
        avgAccuracy,
        bestRound,
        dynamicRangeDb,
        avgDb: Math.round(intensity.avgDb * 10) / 10,
        peakDb: Math.round(intensity.peakDb * 10) / 10,
      },
      completedAt: Date.now(),
    }
  }

  function stopRounds(): void {
    _cancelled = true
    if (phaseTimer) clearTimeout(phaseTimer)
    base._setRunning(false)
    finish()
  }

  return { setBase, startRounds, stopRounds, computeResult }
}
