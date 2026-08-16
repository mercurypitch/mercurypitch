import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { scoreNoteInRange } from '../exercise-scoring-utils'
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
const GAP_BEFORE_MATCH_MS = 600
/** Singing time PER NOTE, scaled by difficulty in setBase. The old drill gave
 *  3 s for both notes together — and scored both against the same window, so
 *  a correct performance averaged ~span/2 cents of "error" per note and a
 *  perfect Major 2nd scored 0. Per-note slots are what make the instruction
 *  ("sing them back") scoreable at all. */
const BASE_SLOT_MS = 2500
const GAP_BETWEEN_ROUNDS_MS = 600

const INTERVAL_POOL: ReadonlyArray<readonly [number, number]> = [
  [0, 2], // Major 2nd
  [0, 4], // Major 3rd
  [0, 5], // Perfect 4th
  [0, 7], // Perfect 5th
  [0, 9], // Major 6th
  [0, 12], // Octave
]

/** Rounds a run will ask for at this difficulty. The pool is the ceiling —
 *  `slice` used to hide that, and the idle hint promised six regardless. */
export function plannedRounds(difficulty: number): number {
  return Math.min(
    INTERVAL_POOL.length,
    Math.round(ROUNDS * (2 - difficultyFactor(difficulty))),
  )
}

function generateIntervals(
  baseMidi: number,
  rounds: number,
): Array<[number, number]> {
  // Shuffle and pick. The interval named is the interval played: an earlier
  // version added a random extra octave to note2 in a quarter of rounds, so a
  // "Major 2nd" could silently span 14 semitones and leave the singer's range.
  const shuffled = [...INTERVAL_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, rounds).map(([a, b]) => [baseMidi + a, baseMidi + b])
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
  // Per-note singing slot, scaled from difficulty in setBase. Difficulty
  // lives in the clock (shorter slots when harder) and the round count —
  // NOT in the scoring, which is the shared per-slot rule every echo drill
  // uses (scoreNoteInRange, 1.5 points per cent of average deviation).
  let slotMs = BASE_SLOT_MS
  let allNoteScores: number[] = []

  function setBase(baseMidi: number): void {
    _cancelled = false
    // Read effective difficulty at round-setup, centred so 5 == default.
    const d = launchDifficulty(EXERCISE_INTERVAL_TRAINER)
    const rounds = plannedRounds(d)
    slotMs = Math.round(BASE_SLOT_MS * difficultyFactor(d))
    intervals = generateIntervals(baseMidi, rounds)
    roundIndex = 0
    roundScores = []
    intervalSpans = []
    allNoteScores = []
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
        noteIndex: 0,
        phase: 1, // listening
      })
    })

    // The chain is paced by timers, never by playTone's promise — playTone
    // resolves when the oscillators are SCHEDULED, not when the tone ends,
    // so `.then` here used to flip the target to note2 within a frame and
    // note1's line was on screen for exactly one paint.
    void audioEngine.playTone(midiToFreq(note1), NOTE_PLAY_DURATION_MS)
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      base._updateMetrics({ currentMidi: note2, noteIndex: 1 })
      void audioEngine.playTone(midiToFreq(note2), NOTE_PLAY_DURATION_MS)
      phaseTimer = setTimeout(() => {
        if (_cancelled) return
        startMatching()
      }, NOTE_PLAY_DURATION_MS + GAP_BEFORE_MATCH_MS)
    }, NOTE_PLAY_DURATION_MS + GAP_BETWEEN_NOTES_MS)
  }

  // Called only from a timer callback that has just checked `_cancelled` in
  // the same synchronous frame, so it does not re-check.
  function startMatching(): void {
    // Exercise-relative clock — same epoch as pitch sample `.time` seconds.
    const responseStartSec = base._getElapsed() / 1000
    singSlot(0, responseStartSec, [])
  }

  /**
   * One singing slot per note of the interval, in order. The target line and
   * the note label track the slot, and each slot is scored only against its
   * own time range — singing the right notes in the wrong order does not
   * score, and singing them in the right order finally does.
   */
  // Like startMatching: every caller (startMatching itself, and the slot
  // timer below) sits behind a `_cancelled` check in the same frame.
  function singSlot(
    slotIndex: number,
    responseStartSec: number,
    slotScores: number[],
  ): void {
    const pair = intervals[roundIndex]
    if (slotIndex >= pair.length) {
      evaluateRound(slotScores)
      return
    }
    const midi = pair[slotIndex]
    batch(() => {
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({
        phase: 2, // singing
        currentMidi: midi,
        noteIndex: slotIndex,
        matchWindowMs: slotMs,
        // Restamped per slot: the base only stamps phaseStartedMs when the
        // phase CHANGES, and both slots are phase 2 — without this the
        // response-window bar would drain once and sit empty for note two.
        phaseStartedMs: base._getElapsed(),
      })
    })
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      const startSec = responseStartSec + (slotIndex * slotMs) / 1000
      const endSec = startSec + slotMs / 1000
      const noteScore = scoreNoteInRange(
        base.pitchHistory(),
        midi,
        startSec,
        endSec,
      )
      allNoteScores.push(noteScore)
      const runningAvg =
        allNoteScores.reduce((a, b) => a + b, 0) / allNoteScores.length
      batch(() => {
        // Running mean, not the last round: the header score should tell the
        // story of the run so far, the way call-response's does.
        base._updateScore(Math.round(runningAvg))
        base._updateMetrics({
          lastNoteScore: noteScore,
          notesCompleted: allNoteScores.length,
        })
      })
      singSlot(slotIndex + 1, responseStartSec, [...slotScores, noteScore])
    }, slotMs)
  }

  function evaluateRound(slotScores: number[]): void {
    const [target1, target2] = intervals[roundIndex]
    // singSlot recursion hands over exactly one score per note of the pair,
    // so both reads are always present.
    const note1Score = slotScores[0]
    const note2Score = slotScores[1]
    roundScores.push({ note1: note1Score, note2: note2Score })

    const roundAvg = (note1Score + note2Score) / 2
    const span = Math.abs(target2 - target1)
    intervalSpans.push({ span, score: Math.round(roundAvg) })
    batch(() => {
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
    }, GAP_BETWEEN_ROUNDS_MS)
  }

  function finish(): void {
    const result = computeResult()
    base._completeWithResult(result)
  }

  /** Both notes of the round in play, for the tracker's upcoming-target
   *  ladder — the singer sees the SHAPE of the interval the whole round,
   *  which is the difference between remembering two notes and reading them. */
  function getUpcomingMidi(): number[] {
    const pair = intervals[roundIndex]
    return pair === undefined ? [] : [...pair]
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
    getUpcomingMidi,
  }
}
