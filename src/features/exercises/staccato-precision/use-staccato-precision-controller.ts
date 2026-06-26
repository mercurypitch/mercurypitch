import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { freqToExactMidi, trailingSamplesByTime, } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_STACCATO } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

const ROUNDS = 8
const NOTE_PLAY_DURATION_MS = 200 // short staccato reference
const GAP_BEFORE_MATCH_MS = 300
const MATCH_WINDOW_MS = 1500 // short window for staccato
const SCORE_TOLERANCE_K = 1.5 // cents penalty multiplier (lower = more lenient)

// Generate varied target notes spanning roughly an octave
function generateNotes(baseMidi: number, rounds: number): number[] {
  const intervals = [0, 2, 4, 5, 7, 9, 11, 12]
  const shuffled = [...intervals].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, rounds).map((i) => baseMidi + i)
}

export function useStaccatoPrecisionController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let targetNotes: number[] = []
  let roundIndex = 0
  let roundScores: number[] = []
  let attackPrecisionScores: number[] = []
  // Adaptive params, recomputed from the launch difficulty at each round setup.
  let notePlayDurationMs = NOTE_PLAY_DURATION_MS
  let matchWindowMs = MATCH_WINDOW_MS
  let scoreToleranceK = SCORE_TOLERANCE_K
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => {
    clearTimeout(phaseTimer)
    phaseTimer = undefined
  })
  let _cancelled = false

  function setBase(baseMidi: number): void {
    _cancelled = false
    // Read effective difficulty at round setup (not module load).
    const d = launchDifficulty(EXERCISE_STACCATO)
    const factor = difficultyFactor(d)
    // More rounds when harder (factor < 1 → 2 - factor > 1); == ROUNDS at d5.
    const rounds = Math.round(ROUNDS * (2 - factor))
    // Tighter/faster timing when harder; == base at d5 (factor === 1).
    notePlayDurationMs = NOTE_PLAY_DURATION_MS * factor
    matchWindowMs = MATCH_WINDOW_MS * factor
    // Steeper cents penalty when harder; == SCORE_TOLERANCE_K at d5.
    scoreToleranceK = SCORE_TOLERANCE_K / factor
    targetNotes = generateNotes(baseMidi, rounds)
    roundIndex = 0
    roundScores = []
    attackPrecisionScores = []
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
    void audioEngine.playTone(midiToFreq(midi), notePlayDurationMs).then(() => {
      if (_cancelled) return
      phaseTimer = setTimeout(() => {
        if (_cancelled) return
        startMatching()
      }, GAP_BEFORE_MATCH_MS)
    })
  }

  function startMatching(): void {
    if (_cancelled) return
    const midi = targetNotes[roundIndex]
    batch(() => {
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({ phase: 2 })
    })
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      evaluateRound()
    }, matchWindowMs)
  }

  function evaluateRound(): void {
    const targetMidi = targetNotes[roundIndex]
    const history = base.pitchHistory()
    const recentSamples = trailingSamplesByTime(history, matchWindowMs)

    let roundScore = 0
    let attackPrecision = 0
    if (recentSamples.length > 0) {
      const validSamples = recentSamples.filter((p) => p.freq > 0)
      if (validSamples.length > 0) {
        const deviations = validSamples.map((p) => {
          const midi = freqToExactMidi(p.freq)
          return Math.abs((midi - targetMidi) * 100)
        })
        const avgDeviation =
          deviations.reduce((a, b) => a + b, 0) / deviations.length
        roundScore = Math.round(
          Math.max(0, 100 - avgDeviation * scoreToleranceK),
        )

        // Attack precision: % of early samples within ±25 cents
        const earlyCount = Math.max(1, Math.floor(validSamples.length * 0.3))
        const earlyDeviations = deviations.slice(0, earlyCount)
        const onTarget = earlyDeviations.filter((d) => d <= 25).length
        attackPrecision = Math.round((onTarget / earlyDeviations.length) * 100)
      }
    }

    roundScores.push(roundScore)
    attackPrecisionScores.push(attackPrecision)

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
    }, 400)
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
        metrics: {
          roundsCompleted: 0,
          avgAccuracy: 0,
          bestRound: 0,
          attackPrecision: 0,
        },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(
      roundScores.reduce((a, b) => a + b, 0) / roundScores.length,
    )
    const bestRound = Math.max(...roundScores)
    const attackPrecision =
      attackPrecisionScores.length > 0
        ? Math.round(
            attackPrecisionScores.reduce((a, b) => a + b, 0) /
              attackPrecisionScores.length,
          )
        : 0

    return {
      type: EXERCISE_STACCATO,
      score: Math.round(
        avgAccuracy * 0.45 + bestRound * 0.2 + attackPrecision * 0.35,
      ),
      metrics: {
        roundsCompleted: roundScores.length,
        avgAccuracy,
        bestRound,
        attackPrecision,
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
