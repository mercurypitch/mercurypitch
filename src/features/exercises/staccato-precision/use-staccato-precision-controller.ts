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
  let attackPrecisionScores: number[] = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => { clearTimeout(phaseTimer); phaseTimer = undefined })
  let _cancelled = false

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  function setBase(baseMidi: number): void {
    _cancelled = false
    targetNotes = generateNotes(baseMidi)
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
    void audioEngine.playTone(midiToFreq(midi), NOTE_PLAY_DURATION_MS).then(() => {
      if (_cancelled) return
      phaseTimer = setTimeout(() => { if (_cancelled) return; startMatching() }, GAP_BEFORE_MATCH_MS)
    })
  }

  function startMatching(): void {
    if (_cancelled) return
    const midi = targetNotes[roundIndex]
    batch(() => {
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({ phase: 2 })
    })
    phaseTimer = setTimeout(() => { if (_cancelled) return; evaluateRound() }, MATCH_WINDOW_MS)
  }

  function evaluateRound(): void {
    const targetMidi = targetNotes[roundIndex]
    const history = base.pitchHistory()
    const recentSamples = history.slice(-Math.max(1, Math.floor(MATCH_WINDOW_MS / 50)))

    let roundScore = 0
    let attackPrecision = 0
    if (recentSamples.length > 0) {
      const validSamples = recentSamples.filter((p) => p.freq > 0)
      if (validSamples.length > 0) {
        const deviations = validSamples.map((p) => {
          const midi = 12 * Math.log2(p.freq / 440) + 69
          return Math.abs((midi - targetMidi) * 100)
        })
        const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length
        roundScore = Math.round(Math.max(0, 100 - avgDeviation * 1.5))

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
    phaseTimer = setTimeout(() => { if (_cancelled) return; playRound() }, 400)
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
        metrics: { roundsCompleted: 0, avgAccuracy: 0, bestRound: 0, attackPrecision: 0 },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(roundScores.reduce((a, b) => a + b, 0) / roundScores.length)
    const bestRound = Math.max(...roundScores)
    const attackPrecision = attackPrecisionScores.length > 0
      ? Math.round(attackPrecisionScores.reduce((a, b) => a + b, 0) / attackPrecisionScores.length)
      : 0

    return {
      type: EXERCISE_STACCATO,
      score: Math.round(avgAccuracy * 0.45 + bestRound * 0.2 + attackPrecision * 0.35),
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
