import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { freqToExactMidi } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_INTERVAL_TRAINER } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

/** Span-weighted mean of the per-round scores (larger intervals weigh more),
 *  on a 0-100 scale. It must NOT be scaled by the round count — an earlier
 *  `* intervalSpans.length` turned this weighted mean into an inflated sum
 *  that saturated the final score (a ~40% run graded as ~70). */
export function difficultyWeightedRoundScore(
  rounds: readonly { score: number; span: number }[],
): number {
  const totalSpans = rounds.reduce((s, v) => s + v.span, 0)
  if (rounds.length === 0 || totalSpans === 0) return 0
  return Math.round(
    rounds.reduce((s, v) => s + v.score * (v.span / totalSpans), 0),
  )
}

const ROUNDS = 6
const NOTE_PLAY_DURATION_MS = 800
const GAP_BETWEEN_NOTES_MS = 300
const GAP_BEFORE_MATCH_MS = 400
const MATCH_WINDOW_MS = 3000

function generateIntervals(
  baseMidi: number,
  rounds: number,
): Array<[number, number]> {
  const intervals: Array<[number, number]> = [
    [0, 2], // Major 2nd
    [0, 4], // Major 3rd
    [0, 5], // Perfect 4th
    [0, 7], // Perfect 5th
    [0, 9], // Major 6th
    [0, 12], // Octave
  ]
  // Shuffle and pick
  const shuffled = [...intervals].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, rounds).map(([a, b]) => {
    const octaveShift = Math.floor(Math.random() * 2) * 12
    return [
      baseMidi + a,
      baseMidi + b + (Math.random() > 0.5 ? octaveShift : 0),
    ]
  })
}

export function useIntervalTrainerController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let intervals: Array<[number, number]> = []
  let roundIndex = 0
  let roundScores: Array<{ note1: number; note2: number }> = []
  let intervalSpans: Array<{ span: number; score: number }> = []
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
  let matchStartTime = 0
  // Scaling-penalty per cent of pitch error; set from difficulty in setBase.
  // 1.5 at difficulty 5 (default) reproduces the original scoring formula.
  let centsPenalty = 1.5

  function setBase(baseMidi: number): void {
    _cancelled = false
    // Read effective difficulty at round-setup, centred so 5 == original.
    const d = launchDifficulty(EXERCISE_INTERVAL_TRAINER)
    // More rounds when harder: round(6 * (2 - factor)); == 6 at d5.
    const rounds = Math.round(ROUNDS * (2 - difficultyFactor(d)))
    // Harsher cents penalty when harder: 1.5 / factor; == 1.5 at d5.
    centsPenalty = 1.5 / difficultyFactor(d)
    intervals = generateIntervals(baseMidi, rounds)
    roundIndex = 0
    roundScores = []
    intervalSpans = []
    base._setTargetPitch(0)
  }

  function startRounds(): void {
    playRound()
  }

  function playRound(): void {
    if (roundIndex >= intervals.length) {
      finish()
      return
    }

    const [note1, note2] = intervals[roundIndex]
    batch(() => {
      base._updateMetrics({
        round: roundIndex,
        totalRounds: intervals.length,
        currentMidi: note1,
        phase: 1, // listening
      })
    })

    // Play note1
    void audioEngine
      .playTone(midiToFreq(note1), NOTE_PLAY_DURATION_MS)
      .then(() => {
        if (_cancelled) return
        base._updateMetrics({ currentMidi: note2 })
        setTimeout(() => {
          if (_cancelled) return
          // Play note2
          void audioEngine
            .playTone(midiToFreq(note2), NOTE_PLAY_DURATION_MS)
            .then(() => {
              if (_cancelled) return
              // Gap before user sings
              phaseTimer = setTimeout(() => {
                if (_cancelled) return
                startMatching()
              }, GAP_BEFORE_MATCH_MS)
            })
        }, GAP_BETWEEN_NOTES_MS)
      })
  }

  function startMatching(): void {
    if (_cancelled) return
    // Use the exercise-relative clock (same epoch as pitch sample `.time`,
    // which is `elapsed/1000`). Mixing absolute performance.now() here would
    // make the evaluateRound() window never match any samples → always 0.
    matchStartTime = base._getElapsed()
    batch(() => {
      base._updateMetrics({ phase: 2 }) // matching phase
    })

    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      evaluateRound()
    }, MATCH_WINDOW_MS)
  }

  function evaluateRound(): void {
    const [target1, target2] = intervals[roundIndex]
    const history = base.pitchHistory()
    const now = base._getElapsed()
    const recentSamples = history.filter((p) => {
      const t = p.time * 1000
      return t >= matchStartTime - 100 && t <= now
    })

    // Score each note by the average cents deviation across the window.
    // Averaging (rather than taking the single best sample) keeps the score
    // stable when only a few samples land in the window.
    function scoreNote(target: number): number {
      const valid = recentSamples.filter((p) => p.freq > 0)
      if (valid.length < 3) return 0
      const deviations = valid.map((p) =>
        Math.abs((freqToExactMidi(p.freq) - target) * 100),
      )
      const avg = deviations.reduce((a, b) => a + b, 0) / deviations.length
      return Math.round(Math.max(0, 100 - avg * centsPenalty))
    }

    const note1Score = scoreNote(target1)
    const note2Score = scoreNote(target2)
    roundScores.push({ note1: note1Score, note2: note2Score })

    const roundAvg = (note1Score + note2Score) / 2
    const span = Math.abs(target2 - target1)
    intervalSpans.push({ span, score: Math.round(roundAvg) })
    batch(() => {
      base._updateScore(Math.round(roundAvg))
      base._updateMetrics({
        lastRoundScore: Math.round(roundAvg),
        lastNote1Score: note1Score,
        lastNote2Score: note2Score,
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
        type: EXERCISE_INTERVAL_TRAINER,
        score: 0,
        metrics: {
          roundsCompleted: 0,
          avgAccuracy: 0,
          bestRound: 0,
          smallIntervalAvg: 0,
          mediumIntervalAvg: 0,
          largeIntervalAvg: 0,
        },
        completedAt: Date.now(),
      }
    }

    const roundAvgs = roundScores.map((s) => (s.note1 + s.note2) / 2)
    const avgAccuracy = Math.round(
      roundAvgs.reduce((a, b) => a + b, 0) / roundAvgs.length,
    )
    const bestRound = Math.round(Math.max(...roundAvgs))

    // Per-interval-size breakdown
    const small = intervalSpans.filter((s) => s.span <= 4)
    const medium = intervalSpans.filter((s) => s.span > 4 && s.span <= 8)
    const large = intervalSpans.filter((s) => s.span > 8)
    const smallAvg =
      small.length > 0
        ? Math.round(small.reduce((a, b) => a + b.score, 0) / small.length)
        : 0
    const mediumAvg =
      medium.length > 0
        ? Math.round(medium.reduce((a, b) => a + b.score, 0) / medium.length)
        : 0
    const largeAvg =
      large.length > 0
        ? Math.round(large.reduce((a, b) => a + b.score, 0) / large.length)
        : 0

    // Difficulty-weighted: larger intervals are harder, weight accordingly.
    const difficultyWeightedScore = difficultyWeightedRoundScore(intervalSpans)

    return {
      type: EXERCISE_INTERVAL_TRAINER,
      score: Math.round(
        avgAccuracy * 0.5 + Math.min(100, difficultyWeightedScore) * 0.5,
      ),
      metrics: {
        roundsCompleted: roundScores.length,
        avgAccuracy,
        bestRound,
        smallIntervalAvg: smallAvg,
        mediumIntervalAvg: mediumAvg,
        largeIntervalAvg: largeAvg,
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

  return {
    setBase,
    startRounds,
    stopRounds,
    computeResult,
  }
}
