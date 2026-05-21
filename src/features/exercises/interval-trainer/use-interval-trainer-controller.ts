import { batch } from 'solid-js'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_INTERVAL_TRAINER } from '../types'

const ROUNDS = 6
const NOTE_PLAY_DURATION_MS = 800
const GAP_BETWEEN_NOTES_MS = 300
const GAP_BEFORE_MATCH_MS = 400
const MATCH_WINDOW_MS = 3000

function generateIntervals(baseMidi: number): Array<[number, number]> {
  const intervals: Array<[number, number]> = [
    [0, 2],  // Major 2nd
    [0, 4],  // Major 3rd
    [0, 5],  // Perfect 4th
    [0, 7],  // Perfect 5th
    [0, 9],  // Major 6th
    [0, 12], // Octave
  ]
  // Shuffle and pick
  const shuffled = [...intervals].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, ROUNDS).map(([a, b]) => {
    const octaveShift = Math.floor(Math.random() * 2) * 12
    return [baseMidi + a, baseMidi + b + (Math.random() > 0.5 ? octaveShift : 0)]
  })
}

export function useIntervalTrainerController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let intervals: Array<[number, number]> = []
  let roundIndex = 0
  let roundScores: Array<{ note1: number; note2: number }> = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  let matchStartTime = 0

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  function setBase(baseMidi: number): void {
    intervals = generateIntervals(baseMidi)
    roundIndex = 0
    roundScores = []
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
    void audioEngine.playTone(midiToFreq(note1), NOTE_PLAY_DURATION_MS).then(() => {
      base._updateMetrics({ currentMidi: note2 })
      setTimeout(() => {
        // Play note2
        void audioEngine.playTone(midiToFreq(note2), NOTE_PLAY_DURATION_MS).then(() => {
          // Gap before user sings
          phaseTimer = setTimeout(() => {
            startMatching()
          }, GAP_BEFORE_MATCH_MS)
        })
      }, GAP_BETWEEN_NOTES_MS)
    })
  }

  function startMatching(): void {
    matchStartTime = performance.now()
    batch(() => {
      base._updateMetrics({ phase: 2 }) // matching phase
    })

    phaseTimer = setTimeout(() => {
      evaluateRound()
    }, MATCH_WINDOW_MS)
  }

  function evaluateRound(): void {
    const [target1, target2] = intervals[roundIndex]
    const history = base.pitchHistory()
    const now = performance.now()
    const recentSamples = history.filter((p) => {
      const t = p.time * 1000
      return t >= matchStartTime - 100 && t <= now
    })

    // Score each note by finding best match for each target
    function scoreNote(target: number): number {
      if (recentSamples.length === 0) return 0
      const best = recentSamples
        .filter((p) => p.freq > 0)
        .reduce(
          (best, p) => {
            const freq = 440 * Math.pow(2, (target - 69) / 12)
            const error = Math.abs(p.freq - freq)
            return error < best.error ? { error, cents: (Math.log2(p.freq / freq)) * 1200 } : best
          },
          { error: Infinity, cents: 0 },
        )
      if (best.error === Infinity) return 0
      return Math.round(Math.max(0, 100 - Math.abs(best.cents) * 1.5))
    }

    const note1Score = scoreNote(target1)
    const note2Score = scoreNote(target2)
    roundScores.push({ note1: note1Score, note2: note2Score })

    const roundAvg = (note1Score + note2Score) / 2
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
    phaseTimer = setTimeout(() => playRound(), 400)
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
        metrics: { roundsCompleted: 0, avgAccuracy: 0, bestRound: 0 },
        completedAt: Date.now(),
      }
    }

    const roundAvgs = roundScores.map((s) => (s.note1 + s.note2) / 2)
    const avgAccuracy = Math.round(roundAvgs.reduce((a, b) => a + b, 0) / roundAvgs.length)
    const bestRound = Math.round(Math.max(...roundAvgs))

    return {
      type: EXERCISE_INTERVAL_TRAINER,
      score: avgAccuracy,
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

  return {
    setBase,
    startRounds,
    stopRounds,
    computeResult,
  }
}
