import { batch } from 'solid-js'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_DRONE_INTONATION } from '../types'

const ROUNDS = 6
const MATCH_WINDOW_MS = 4000

const INTERVALS: Array<{ semitones: number; label: string }> = [
  { semitones: 0, label: 'Unison' },
  { semitones: 3, label: 'Minor 3rd' },
  { semitones: 4, label: 'Major 3rd' },
  { semitones: 5, label: 'Perfect 4th' },
  { semitones: 7, label: 'Perfect 5th' },
  { semitones: 12, label: 'Octave' },
]

function pickIntervals(count: number): Array<{ semitones: number; label: string }> {
  const shuffled = [...INTERVALS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function useDroneIntonationController(
  base: BaseExerciseController,
  audioEngine: {
    playTone: (freq: number, duration?: number) => Promise<void>
    stopTone?: (fadeMs?: number) => void
  },
) {
  let droneMidi = 60
  let rounds: Array<{ semitones: number; label: string }> = []
  let roundIndex = 0
  let roundScores: number[] = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => { clearTimeout(phaseTimer); phaseTimer = undefined })

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  function setBase(baseMidi: number): void {
    droneMidi = baseMidi
    rounds = pickIntervals(ROUNDS)
    roundIndex = 0
    roundScores = []
  }

  async function startRounds(): Promise<void> {
    await playRound()
  }

  async function playRound(): Promise<void> {
    if (roundIndex >= rounds.length) {
      stopDrone()
      finish()
      return
    }

    const interval = rounds[roundIndex]
    const targetMidi = droneMidi + interval.semitones

    // Start drone
    void audioEngine.playTone(midiToFreq(droneMidi), MATCH_WINDOW_MS + 2000)

    batch(() => {
      base._setTargetPitch(midiToFreq(targetMidi))
      base._updateMetrics({
        round: roundIndex,
        totalRounds: rounds.length,
        currentMidi: targetMidi,
        droneMidi,
        phase: 2, // matching (drone is already playing)
        intervalSemitones: interval.semitones,
      })
    })

    // Give user time to match
    phaseTimer = setTimeout(() => {
      evaluateRound()
    }, MATCH_WINDOW_MS)
  }

  function evaluateRound(): void {
    const interval = rounds[roundIndex]
    const targetMidi = droneMidi + interval.semitones
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
    phaseTimer = setTimeout(() => {
      void playRound()
    }, 600)
  }

  function stopDrone(): void {
    audioEngine.stopTone?.(100)
  }

  function finish(): void {
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    if (roundScores.length === 0) {
      return {
        type: EXERCISE_DRONE_INTONATION,
        score: 0,
        metrics: { roundsCompleted: 0, avgAccuracy: 0, bestRound: 0 },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(roundScores.reduce((a, b) => a + b, 0) / roundScores.length)
    const bestRound = Math.max(...roundScores)

    return {
      type: EXERCISE_DRONE_INTONATION,
      score: Math.round(avgAccuracy * 0.7 + bestRound * 0.3),
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
    stopDrone()
    base._setRunning(false)
    finish()
  }

  return { setBase, startRounds, stopRounds, computeResult }
}
