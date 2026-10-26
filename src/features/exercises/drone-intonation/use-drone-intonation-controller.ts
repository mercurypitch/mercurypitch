import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty, launchIntervals, } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { approximateRichness } from '@/lib/vocal-analyzer'
import { freqToExactMidi, pitchStabilityCents, trailingSamplesByTime, } from '../exercise-scoring-utils'
import { drawIntervalRounds } from '../interval-rounds'
import type { ExerciseResult } from '../types'
import { EXERCISE_DRONE_INTONATION } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

const ROUNDS = 6
const MATCH_WINDOW_MS = 4000
// Cents penalty per cent of average deviation in the round score
// (100 - avgDeviation * SCORE_K). Tightened by difficulty below.
const SCORE_K = 1.5

const INTERVALS: Array<{ semitones: number; label: string }> = [
  { semitones: 0, label: 'Unison' },
  { semitones: 3, label: 'Minor 3rd' },
  { semitones: 4, label: 'Major 3rd' },
  { semitones: 5, label: 'Perfect 4th' },
  { semitones: 7, label: 'Perfect 5th' },
  { semitones: 12, label: 'Octave' },
]

/** Drone's own name for an interval above the drone ("Minor 3rd" for 3),
 *  or undefined for one outside its pool. */
export function droneIntervalLabel(semitones: number): string | undefined {
  return INTERVALS.find((i) => i.semitones === semitones)?.label
}

/**
 * The intervals a launch (a lesson's slug) asked Drone Intonation to drill,
 * read as `launchIntervals` reads them and kept to Drone's own pool: a
 * launch may ask for any semitone up to an octave, and Drone names only its
 * own. Undefined when no launch asked, or asked for none of Drone's, so the
 * run keeps the pool. setBase and the idle hint both read it here.
 */
export function droneLaunchIntervals(): number[] | undefined {
  const named = launchIntervals(EXERCISE_DRONE_INTONATION)?.filter(
    (s) => droneIntervalLabel(s) !== undefined,
  )
  return named !== undefined && named.length > 0 ? named : undefined
}

/** Rounds a run will ask for at this difficulty (d5: 6 * 1 == 6). A run on
 *  the pool plays each interval at most once, so the pool is the ceiling; a
 *  launch's own intervals may come back, so two of them still make a run as
 *  long as the difficulty asks for. */
export function plannedRounds(
  difficulty: number,
  intervals?: readonly number[],
): number {
  // Harder = more intervals/rounds over the drone.
  const asked = Math.max(
    1,
    Math.round(ROUNDS * (2 - difficultyFactor(difficulty))),
  )
  return intervals !== undefined && intervals.length > 0
    ? asked
    : Math.min(INTERVALS.length, asked)
}

/** The idle hint's words for a launch's own intervals, in Drone's names,
 *  narrowest first: "Minor 3rd and Major 3rd". Every one is named, since a
 *  launch's list need not run unbroken through the pool. */
export function droneIntervalNames(intervals: readonly number[]): string {
  const names = [...new Set(intervals)]
    .sort((a, b) => a - b)
    .map((s) => droneIntervalLabel(s) ?? `${s} semitones`)
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function pickIntervals(
  count: number,
  given?: readonly number[],
): Array<{ semitones: number; label: string }> {
  if (given !== undefined && given.length > 0) {
    // The draw Interval Trainer deals a launch's list with: an interval may
    // come back, never twice running.
    return drawIntervalRounds(given, count).map((semitones) => ({
      semitones,
      label: droneIntervalLabel(semitones) ?? `${semitones} semitones`,
    }))
  }
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
  // Per-round pitch steadiness (cents std-dev within each sustained note),
  // averaged for the final stability score — see computeResult().
  let roundStabilities: number[] = []
  // Adaptive knobs, resolved per drone setup (default d5 == originals).
  let scoreK = SCORE_K
  let matchWindowMs = MATCH_WINDOW_MS
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  let _cancelled = false
  base._registerDispose(() => {
    clearTimeout(phaseTimer)
    phaseTimer = undefined
    // reset()/unmount can fire while a playTone().then() continuation is
    // in flight — clearing the pending timer alone cannot stop it from
    // re-arming the chain (Back kept the sequence playing to the end).
    // The flag makes the continuation's own guards bail instead.
    _cancelled = true
  })

  function setBase(baseMidi: number): void {
    _cancelled = false
    droneMidi = baseMidi
    const difficulty = launchDifficulty(EXERCISE_DRONE_INTONATION)
    const factor = difficultyFactor(difficulty)
    // Harder = tighter cents tolerance: penalty grows as 1/factor.
    scoreK = SCORE_K / factor
    // Harder = longer sustain required to match the drone.
    matchWindowMs = Math.round(MATCH_WINDOW_MS * (2 - factor))
    // A launch's own intervals, if it brought any of Drone's, replace the
    // pool, and the difficulty alone sets how many rounds they fill.
    const given = droneLaunchIntervals()
    rounds = pickIntervals(plannedRounds(difficulty, given), given)
    roundIndex = 0
    roundScores = []
    roundStabilities = []
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
    void audioEngine.playTone(midiToFreq(droneMidi), matchWindowMs + 2000)

    // Displayed acceptance window (cents) where the round score stays > 0:
    // 100 - cents * scoreK > 0  ->  |cents| < 100 / scoreK.
    const acceptanceCents = 100 / scoreK

    batch(() => {
      base._setTargetPitch(midiToFreq(targetMidi))
      base._updateMetrics({
        round: roundIndex,
        totalRounds: rounds.length,
        currentMidi: targetMidi,
        droneMidi,
        phase: 2, // matching (drone is already playing)
        intervalSemitones: interval.semitones,
        acceptanceCents,
      })
    })

    // Give user time to match
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      evaluateRound()
    }, matchWindowMs)
  }

  function evaluateRound(): void {
    const interval = rounds[roundIndex]
    const targetMidi = droneMidi + interval.semitones
    const history = base.pitchHistory()
    const recentSamples = trailingSamplesByTime(history, matchWindowMs)

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
        roundScore = Math.round(Math.max(0, 100 - avgDeviation * scoreK))
      }
    }

    roundScores.push(roundScore)

    // Capture how steadily THIS note was held (needs ≥2 voiced samples).
    const roundFreqs = recentSamples
      .filter((p) => p.freq > 0)
      .map((p) => p.freq)
    if (roundFreqs.length >= 2) {
      roundStabilities.push(pitchStabilityCents(roundFreqs))
    }

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
    // Stability is the average of the PER-ROUND steadiness captured in
    // evaluateRound. Measuring it across the whole run would capture the
    // deliberate moves between the different intervals rather than how steadily
    // each note was held — and would punish singing the intervals correctly.
    // No measured rounds → 0 (nothing was actually sustained).
    const stabilityCents =
      roundStabilities.length > 0
        ? Math.round(
            roundStabilities.reduce((a, b) => a + b, 0) /
              roundStabilities.length,
          )
        : 0
    const stabilityScore =
      roundStabilities.length > 0
        ? Math.max(0, Math.min(100, 100 - stabilityCents * 0.8))
        : 0

    const claritySamples = history
      .filter((p) => p.freq > 0 && p.clarity !== undefined)
      .map((p) => ({ freq: p.freq, clarity: p.clarity! }))
    const richness =
      claritySamples.length > 2
        ? approximateRichness(claritySamples).richnessScore
        : 0

    return {
      type: EXERCISE_DRONE_INTONATION,
      // Richness left the grade on 2026-10-25 without a reweighting: it
      // read the detector's 0-1 clarity as 0-100, so it was 0 or 1 and the
      // grade moves by at most 0.2 before rounding. Still recorded in the
      // metrics until the approximation itself is deleted.
      score: Math.round(
        avgAccuracy * 0.4 + bestRound * 0.15 + stabilityScore * 0.25,
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
