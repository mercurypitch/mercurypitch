import { batch } from 'solid-js'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { approximateRichness } from '@/lib/vocal-analyzer'
import { freqToExactMidi } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_DRONE_INTONATION } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

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

function pickIntervals(
  count: number,
): Array<{ semitones: number; label: string }> {
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
  base._registerDispose(() => {
    clearTimeout(phaseTimer)
    phaseTimer = undefined
  })
  let _cancelled = false

  function setBase(baseMidi: number): void {
    _cancelled = false
    droneMidi = baseMidi
    rounds = pickIntervals(ROUNDS)
    roundIndex = 0
    roundScores = []
  }

  async function startRounds(): Promise<void> {
    await playRound()
  }

  async function playRound(): Promise<void> {
    if (_cancelled) return
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
      if (_cancelled) return
      evaluateRound()
    }, MATCH_WINDOW_MS)
  }

  function evaluateRound(): void {
    const interval = rounds[roundIndex]
    const targetMidi = droneMidi + interval.semitones
    const history = base.pitchHistory()
    const recentSamples = history.slice(
      -Math.max(1, Math.floor(MATCH_WINDOW_MS / 50)),
    )

    let roundScore = 0
    if (recentSamples.length > 0) {
      const deviations = recentSamples
        .filter((p) => p.freq > 0)
        .map((p) => {
          const midi = freqToExactMidi(p.freq)
          return Math.abs((midi - targetMidi) * 100)
        })
      if (deviations.length > 0) {
        const avgDeviation =
          deviations.reduce((a, b) => a + b, 0) / deviations.length
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
      if (_cancelled) return
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
        metrics: {
          roundsCompleted: 0,
          avgAccuracy: 0,
          bestRound: 0,
          stabilityCents: 0,
          richnessScore: 0,
        },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(
      roundScores.reduce((a, b) => a + b, 0) / roundScores.length,
    )
    const bestRound = Math.max(...roundScores)

    const history = base.pitchHistory()
    const validSamples = history.filter((p) => p.freq > 0)
    const stabilityCents = (() => {
      if (validSamples.length < 2) return 0
      const midis = validSamples.map((p) => freqToExactMidi(p.freq))
      const mean = midis.reduce((a, b) => a + b, 0) / midis.length
      const variance =
        midis.reduce((s, v) => s + (v - mean) ** 2, 0) / midis.length
      return Math.round(Math.sqrt(variance) * 100)
    })()
    const stabilityScore = Math.max(
      0,
      Math.min(100, 100 - stabilityCents * 0.8),
    )

    const claritySamples = history
      .filter((p) => p.freq > 0 && p.clarity !== undefined)
      .map((p) => ({ freq: p.freq, clarity: p.clarity! }))
    const richness =
      claritySamples.length > 2
        ? approximateRichness(claritySamples).richnessScore
        : 0

    return {
      type: EXERCISE_DRONE_INTONATION,
      score: Math.round(
        avgAccuracy * 0.4 +
          bestRound * 0.15 +
          stabilityScore * 0.25 +
          richness * 0.2,
      ),
      metrics: {
        roundsCompleted: roundScores.length,
        avgAccuracy,
        bestRound,
        stabilityCents,
        richnessScore: Math.round(richness),
      },
      completedAt: Date.now(),
    }
  }

  function stopRounds(): void {
    _cancelled = true
    if (phaseTimer) clearTimeout(phaseTimer)
    stopDrone()
    base._setRunning(false)
    finish()
  }

  return { setBase, startRounds, stopRounds, computeResult }
}
