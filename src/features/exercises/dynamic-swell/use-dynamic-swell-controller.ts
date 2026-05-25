import { batch } from 'solid-js'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_DYNAMIC_SWELL } from '../types'
import { intensityFromPitchResults } from '@/lib/vocal-analyzer'

const NOTE_PLAY_DURATION_MS = 800
const HOLD_DURATION_MS = 8000

const INTERVALS = [0, 2, 4, 7] // unison, M2, M3, P5

export function useDynamicSwellController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let targetNotes: number[] = []
  let roundIndex = 0
  let roundScores: number[] = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => { clearTimeout(phaseTimer); phaseTimer = undefined })
  let holdStartTime = 0
  let _cancelled = false

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  function setBase(baseMidi: number): void {
    _cancelled = false
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

    void audioEngine.playTone(midiToFreq(midi), NOTE_PLAY_DURATION_MS).then(() => {
      if (_cancelled) return
      startHolding()
    })
  }

  function startHolding(): void {
    if (_cancelled) return
    holdStartTime = performance.now()
    batch(() => base._updateMetrics({ phase: 2 })) // hold phase
    phaseTimer = setTimeout(() => { if (_cancelled) return; evaluateRound() }, HOLD_DURATION_MS)
  }

  function evaluateRound(): void {
    const targetMidi = targetNotes[roundIndex]
    const now = performance.now()
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
          const midi = 12 * Math.log2(p.freq / 440) + 69
          return Math.abs((midi - targetMidi) * 100)
        })
      if (deviations.length > 0) {
        const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length
        roundScore = Math.round(Math.max(0, 100 - avgDeviation * 2.0))
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
    phaseTimer = setTimeout(() => { if (_cancelled) return; playRound() }, 600)
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
        metrics: { roundsCompleted: 0, avgAccuracy: 0, bestRound: 0 },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(roundScores.reduce((a, b) => a + b, 0) / roundScores.length)
    const bestRound = Math.max(...roundScores)

    const history = base.pitchHistory()
    const intensitySamples = history
      .filter((p) => p.freq > 0 && p.clarity !== undefined)
      .map((p) => ({
        time: p.time,
        clarity: p.clarity!,
        midi: p.freq > 0 ? 12 * Math.log2(p.freq / 440) + 69 : 0,
      }))
    const intensity = intensityFromPitchResults(intensitySamples)
    const dynamicRangeDb = Math.round(intensity.dynamicRange * 10) / 10
    const dynamicScore = Math.min(100, dynamicRangeDb * 3)

    return {
      type: EXERCISE_DYNAMIC_SWELL,
      score: Math.round(avgAccuracy * 0.45 + bestRound * 0.2 + dynamicScore * 0.35),
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
