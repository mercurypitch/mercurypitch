import { batch } from 'solid-js'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_SIREN } from '../types'
import { detectSlides } from '@/lib/vocal-analyzer'

const ROUNDS = 6
const NOTE_PLAY_DURATION_MS = 600
const GAP_BETWEEN_NOTES_MS = 400
const MATCH_WINDOW_MS = 4000

interface SirenRound {
  startMidi: number
  endMidi: number
}

function generateSirens(baseMidi: number): SirenRound[] {
  const intervals = [4, 5, 7, 8, 12, 16]
  const rounds: SirenRound[] = []

  for (let i = 0; i < ROUNDS; i++) {
    const interval = intervals[i % intervals.length]
    const direction = i % 2 === 0 ? 1 : -1
    const start = baseMidi - (direction === 1 ? 5 : interval + 5)
    const end = start + direction * interval
    rounds.push({ startMidi: Math.max(36, start), endMidi: Math.min(84, end) })
  }

  return rounds
}

export function useSirenController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let rounds: SirenRound[] = []
  let roundIndex = 0
  let roundScores: number[] = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => {
    clearTimeout(phaseTimer)
    phaseTimer = undefined
  })
  let _cancelled = false

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  function setBase(baseMidi: number): void {
    _cancelled = false
    rounds = generateSirens(baseMidi)
    roundIndex = 0
    roundScores = []
  }

  function startRounds(): void {
    playRound()
  }

  function playRound(): void {
    if (roundIndex >= rounds.length) {
      finish()
      return
    }

    const round = rounds[roundIndex]
    batch(() => {
      base._updateMetrics({
        round: roundIndex,
        totalRounds: rounds.length,
        currentMidi: round.startMidi,
        phase: 1, // listening
      })
    })

    // Play start note
    void audioEngine
      .playTone(midiToFreq(round.startMidi), NOTE_PLAY_DURATION_MS)
      .then(() => {
        if (_cancelled) return
        // Play end note
        base._updateMetrics({ currentMidi: round.endMidi })
        void audioEngine
          .playTone(midiToFreq(round.endMidi), NOTE_PLAY_DURATION_MS)
          .then(() => {
            if (_cancelled) return
            phaseTimer = setTimeout(() => {
              if (_cancelled) return
              startMatching()
            }, GAP_BETWEEN_NOTES_MS)
          })
      })
  }

  function startMatching(): void {
    if (_cancelled) return
    const round = rounds[roundIndex]
    batch(() => {
      base._setTargetPitch(midiToFreq(round.endMidi))
      base._updateMetrics({ phase: 2 }) // siren phase
    })
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      evaluateRound()
    }, MATCH_WINDOW_MS)
  }

  function evaluateRound(): void {
    const round = rounds[roundIndex]
    const history = base.pitchHistory()
    const recentSamples = history.slice(
      -Math.max(1, Math.floor(MATCH_WINDOW_MS / 50)),
    )

    // Score how close user got to the target end note
    let roundScore = 0
    if (recentSamples.length > 0) {
      const deviations = recentSamples
        .filter((p) => p.freq > 0)
        .map((p) => {
          const midi = 12 * Math.log2(p.freq / 440) + 69
          return Math.abs((midi - round.endMidi) * 100)
        })
      if (deviations.length > 0) {
        // Take the best 20% of samples (closest to target)
        const sorted = [...deviations].sort((a, b) => a - b)
        const bestCount = Math.max(1, Math.floor(sorted.length * 0.2))
        const bestDeviations = sorted.slice(0, bestCount)
        const avgBest =
          bestDeviations.reduce((a, b) => a + b, 0) / bestDeviations.length
        roundScore = Math.round(Math.max(0, 100 - avgBest * 1.5))
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
        type: EXERCISE_SIREN,
        score: 0,
        metrics: {
          roundsCompleted: 0,
          avgAccuracy: 0,
          bestRound: 0,
          slideQuality: 0,
          cleanSlides: 0,
          scoopSlides: 0,
        },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(
      roundScores.reduce((a, b) => a + b, 0) / roundScores.length,
    )
    const bestRound = Math.max(...roundScores)

    const history = base.pitchHistory()
    const slideSamples = history
      .filter((p) => p.freq > 0)
      .map((p) => ({
        time: p.time,
        midi: 12 * Math.log2(p.freq / 440) + 69,
        freq: p.freq,
      }))
    const slideResult = detectSlides(slideSamples)
    const slideQuality = slideResult.overallScore
    const cleanSlides = slideResult.cleanCount
    const scoopSlides = slideResult.scoopCount

    return {
      type: EXERCISE_SIREN,
      score: Math.round(
        avgAccuracy * 0.45 + bestRound * 0.25 + slideQuality * 0.3,
      ),
      metrics: {
        roundsCompleted: roundScores.length,
        avgAccuracy,
        bestRound,
        slideQuality,
        cleanSlides,
        scoopSlides,
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
