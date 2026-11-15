// ============================================================
// Name the Cadence: one run, and the sound of each round
// ============================================================
//
// A quiz run (quiz/quiz-run.ts) whose rounds are cadences and whose answers
// are their names. This adds what is the drill's own: each round is played,
// chord by chord, when it goes up; it can be heard again; an answer is taken
// only once the last chord has sounded; and after a miss the cadence plays
// once more under its name before the next round.

import { createSignal } from 'solid-js'
import { createQuizRun } from '../quiz/quiz-run'
import { EXERCISE_CADENCE } from '../types'
import type { CadenceRound, CadenceStep, CadenceType } from './cadence-rounds'
import { cadenceIsRight, planCadences, stepsOf } from './cadence-rounds'

/** How long each chord sounds; the last one of a cadence rings longer. */
export const CHORD_MS = 850
export const LAST_CHORD_MS = 1500
/** The silence between two chords. */
export const GAP_MS = 110
/** A right answer stays up this long before the next cadence. */
export const RIGHT_MS = 1300
/** After a miss the cadence plays again; this is the pause after it. */
export const AFTER_REPLAY_MS = 700

/** How long a round's playback lasts, start to the end of its last chord. */
export function playbackMs(round: CadenceRound): number {
  const steps = stepsOf(round)
  return (steps.length - 1) * (CHORD_MS + GAP_MS) + LAST_CHORD_MS
}

export interface CadenceDeps {
  /** Sound a chord: its notes as MIDI numbers, for this many ms. */
  playChord: (midis: readonly number[], ms: number) => void
  /** Cut whatever is sounding. */
  stopSound?: () => void
  /** A number in [0, 1), for the run's order; `Math.random` by default. */
  random?: () => number
  now?: () => number
}

export interface CadenceStart {
  difficulty: number
  rounds?: number
}

export function useCadenceController(deps: CadenceDeps) {
  /** The chord sounding now, as its place in the round's steps; -1 for none. */
  const [sounding, setSounding] = createSignal(-1)
  /** True once the round's last chord has started: an answer can be taken. */
  const [heard, setHeard] = createSignal(false)
  let timers: ReturnType<typeof setTimeout>[] = []

  function silence(): void {
    for (const timer of timers) clearTimeout(timer)
    timers = []
    setSounding(-1)
    deps.stopSound?.()
  }

  /** Play a round's chords in order, lighting each as it sounds. */
  function play(round: CadenceRound): void {
    silence()
    const steps: CadenceStep[] = stepsOf(round)
    let at = 0
    steps.forEach((step, i) => {
      const last = i === steps.length - 1
      const ms = last ? LAST_CHORD_MS : CHORD_MS
      const strike = (): void => {
        setSounding(i)
        if (last) setHeard(true)
        deps.playChord(step.midis, ms)
      }
      // The first chord is struck here and now, not on a timer: a run
      // starts from a tap, and a browser lets a page make its first sound
      // only from inside one.
      if (at === 0) strike()
      else timers.push(setTimeout(strike, at))
      at += ms + (last ? 0 : GAP_MS)
    })
    timers.push(setTimeout(() => setSounding(-1), at))
  }

  const run = createQuizRun<CadenceRound, CadenceType>({
    type: EXERCISE_CADENCE,
    isRight: cadenceIsRight,
    // A miss is held for the length of the cadence played again.
    holdMs: (right, round) =>
      right ? RIGHT_MS : playbackMs(round) + AFTER_REPLAY_MS,
    onRound: (round) => {
      setHeard(false)
      play(round)
    },
    onAnswer: (round, right) => {
      if (!right) play(round)
    },
    onEnd: silence,
    now: deps.now,
  })

  /** Take an answer, once the cadence has been heard to its last chord. */
  function answer(type: CadenceType): void {
    if (!heard()) return
    run.answer(type)
  }

  /** Hear the round again, as often as wanted: listening is the drill. */
  function replay(): void {
    const round = run.round()
    if (run.status() !== 'active' || round === null) return
    if (run.feedback() !== null) return
    play(round)
  }

  return {
    status: run.status,
    /** The cadence that is up, or null outside a run. */
    round: run.round,
    rounds: run.rounds,
    index: run.index,
    marks: run.marks,
    feedback: run.feedback,
    score: run.score,
    result: run.result,
    sounding,
    heard,
    start: (options: CadenceStart): void =>
      run.start(planCadences({ ...options, random: deps.random })),
    answer,
    replay,
    stop: run.stop,
    reset: run.reset,
  }
}

export type CadenceController = ReturnType<typeof useCadenceController>
