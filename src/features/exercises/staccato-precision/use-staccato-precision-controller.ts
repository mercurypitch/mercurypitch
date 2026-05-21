import { batch } from 'solid-js'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_STACCATO } from '../types'

const ROUNDS = 8
const NOTE_PLAY_DURATION_MS = 200 // short staccato reference
const GAP_BEFORE_MATCH_MS = 300
const MATCH_WINDOW_MS = 1500 // short window for staccato

// Generate varied target notes spanning roughly an octave
function generateNotes(baseMidi: number): number[] {
  const intervals = [0, 2, 4, 5, 7, 9, 11, 12]
  const shuffled = [...intervals].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, ROUNDS).map((i) => baseMidi + i)
}

export function useStaccatoPrecisionController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let targetNotes: number[] = []
  let roundIndex = 0
  let roundScores: number[] = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  function setBase(baseMidi: number): void {
    targetNotes = generateNotes(baseMidi)
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
      base._updateMetrics({
        round: roundIndex,
        totalRounds: targetNotes.length,
        currentMidi: midi,
        phase: 1,
      })
    })

    // Play a short staccato reference
    void audioEngine.playTone(midiToFreq(midi), NOTE_PLAY_DURATION_MS).then(() => {
      phaseTimer = setTimeout(() => startMatching(), GAP_BEFORE_MATCH_MS)
    })
  }

  function startMatching(): void {
    const midi = targetNotes[roundIndex]
    batch(() => {
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({ phase: 2 })
    })
    phaseTimer = setTimeout(() => evaluateRound(), MATCH_WINDOW_MS)
  }

  function evaluateRound(): void {
    const targetMidi = targetNotes[roundIndex]
    const history = base.pitchHistory()
    const recentSamples = history.slice(-Math.max(1, Math.floor(MATCH_WINDOW_MS / 50)))

    let roundScore = 0
    if (recentSamples.length > 0) {
      const deviations = recentSamples
        .filter((p) => p.freq > 0)
        .map((p) => {
          const midi = 12 * Math.log2(p.freq / 440) + 69
          return Math.abs((midi - targetMidi) * 100)
        })
      if (deviations.length > 0) {
        const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length
        roundScore = Math.round(Math.max(0, 100 - avgDeviation * 1.5))
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
    phaseTimer = setTimeout(() => playRound(), 400)
  }

  function finish(): void {
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    if (roundScores.length === 0) {
      return {
        type: EXERCISE_STACCATO,
        score: 0,
        metrics: { roundsCompleted: 0, avgAccuracy: 0, bestRound: 0 },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(roundScores.reduce((a, b) => a + b, 0) / roundScores.length)
    const bestRound = Math.max(...roundScores)

    return {
      type: EXERCISE_STACCATO,
      score: Math.round(avgAccuracy * 0.6 + bestRound * 0.4),
      metrics: {
        roundsCompleted: roundScores.length,
        avgAccuracy,
        bestRound,
      },
      completedAt: Date.now(),
    }
  }

  function stopRounds(): void {
    if (phaseTimer) clearTimeout(phaseTimer)
    base._setRunning(false)
    finish()
  }

  return { setBase, startRounds, stopRounds, computeResult }
}
