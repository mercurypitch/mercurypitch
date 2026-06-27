import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { detectSlides } from '@/lib/vocal-analyzer'
import { freqToExactMidi, trailingSamplesByTime, } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_SIREN } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

const ROUNDS = 6
const NOTE_PLAY_DURATION_MS = 600
const GAP_BETWEEN_NOTES_MS = 400
const MATCH_WINDOW_MS = 4000
// Baseline cents-deviation slope: roundScore = 100 - avgBestCents * K.
const SCORE_SLOPE_K = 1.5

interface SirenRound {
  startMidi: number
  endMidi: number
}

/**
 * Build the siren glides centred on `baseMidi`, alternating up/down, keeping
 * BOTH endpoints inside the singer's comfortable range [rangeMin, rangeMax].
 * The whole interval is shifted into range (never clamped end-by-end, which
 * previously distorted spans and could yield sub-audible notes like "G0").
 */
export function generateSirens(
  baseMidi: number,
  difficulty: number,
  rangeMin: number,
  rangeMax: number,
): SirenRound[] {
  // Singable glide spans (semitones), up to roughly an octave.
  const intervals = [3, 5, 7, 9, 12, 7]
  const rounds: SirenRound[] = []
  // Widen the glide a little when harder (1.0 at d5).
  const spanScale = 2 - difficultyFactor(difficulty)
  const span = Math.max(1, rangeMax - rangeMin)

  for (let i = 0; i < ROUNDS; i++) {
    let interval = Math.round(intervals[i % intervals.length] * spanScale)
    interval = Math.max(2, Math.min(12, Math.min(interval, span)))
    const direction = i % 2 === 0 ? 1 : -1
    // Centre the glide on the base note, then shift the pair into range.
    let start =
      direction === 1
        ? baseMidi - Math.floor(interval / 2)
        : baseMidi + Math.ceil(interval / 2)
    let end = start + direction * interval
    const lo = Math.min(start, end)
    const hi = Math.max(start, end)
    const shift =
      lo < rangeMin ? rangeMin - lo : hi > rangeMax ? rangeMax - hi : 0
    start += shift
    end += shift
    rounds.push({ startMidi: start, endMidi: end })
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
  // Effective difficulty for this run; read fresh at setup (not module load).
  let difficulty = 5
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => {
    clearTimeout(phaseTimer)
    phaseTimer = undefined
  })
  let _cancelled = false

  function setBase(baseMidi: number, rangeMin: number, rangeMax: number): void {
    _cancelled = false
    difficulty = launchDifficulty(EXERCISE_SIREN)
    rounds = generateSirens(baseMidi, difficulty, rangeMin, rangeMax)
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
        startMidi: round.startMidi,
        endMidi: round.endMidi,
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
    const recentSamples = trailingSamplesByTime(history, MATCH_WINDOW_MS)

    // Score how close user got to the target end note
    let roundScore = 0
    if (recentSamples.length > 0) {
      const deviations = recentSamples
        .filter((p) => p.freq > 0)
        .map((p) => {
          const midi = freqToExactMidi(p.freq)
          return Math.abs((midi - round.endMidi) * 100)
        })
      if (deviations.length > 0) {
        // Take the best 20% of samples (closest to target)
        const sorted = [...deviations].sort((a, b) => a - b)
        const bestCount = Math.max(1, Math.floor(sorted.length * 0.2))
        const bestDeviations = sorted.slice(0, bestCount)
        const avgBest =
          bestDeviations.reduce((a, b) => a + b, 0) / bestDeviations.length
        // Tighten the cents->score slope when harder: K * (1/factor) is K at
        // d5 (factor 1.0), larger when factor<1 (harder = penalised faster).
        const slopeK = SCORE_SLOPE_K * (1 / difficultyFactor(difficulty))
        roundScore = Math.round(Math.max(0, 100 - avgBest * slopeK))
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
        midi: freqToExactMidi(p.freq),
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
