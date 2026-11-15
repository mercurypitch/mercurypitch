// ============================================================
// A quiz run: a row of rounds, one answer to each, and a result
// ============================================================
//
// The drills nothing listens to (Read the Note, Name the Cadence) are
// quizzes: a round goes up, one answer is taken, the answer is held on show
// for a moment, and the next round goes up, to a result the shell and the
// history take. They do not stand on use-base-exercise, whose start is the
// microphone's, so the run they share is here: which round is up, what was
// answered, the hold, the time each answer took, and the result.
//
// What a round is, what answers it and what the drill does while the answer
// is on show are the drill's own.

import { createSignal } from 'solid-js'
import type { ExerciseResult, ExerciseStatus, ExerciseType } from '../types'
import { stoppedEarlyMark } from '../types'

/** The answer on show: what was given, and whether it was right. */
export interface QuizFeedback<TAnswer> {
  chosen: TAnswer
  right: boolean
}

export interface QuizRunOptions<TRound, TAnswer> {
  /** The drill the result is filed under. */
  type: ExerciseType
  isRight: (round: TRound, answer: TAnswer) => boolean
  /** How long an answer stays on show before the next round, in ms. */
  holdMs: (right: boolean, round: TRound) => number
  /** A round has gone up: the first of a run, and each one after it. */
  onRound?: (round: TRound) => void
  /** An answer was taken, and is now on show. */
  onAnswer?: (round: TRound, right: boolean) => void
  /** The run has ended or been reset: stop whatever a round started. */
  onEnd?: () => void
  /** Milliseconds, for the time an answer took; the page's clock by default. */
  now?: () => number
}

/** The share of a run's rounds answered right, as the score: 0 to 100. */
export const quizScore = (right: number, answered: number): number =>
  answered <= 0 ? 0 : Math.round((100 * right) / answered)

export function createQuizRun<TRound, TAnswer>(
  options: QuizRunOptions<TRound, TAnswer>,
) {
  const now = options.now ?? (() => performance.now())
  const [status, setStatus] = createSignal<ExerciseStatus>('idle')
  const [rounds, setRounds] = createSignal<readonly TRound[]>([])
  const [index, setIndex] = createSignal(0)
  const [marks, setMarks] = createSignal<readonly boolean[]>([])
  const [feedback, setFeedback] = createSignal<QuizFeedback<TAnswer> | null>(
    null,
  )
  const [result, setResult] = createSignal<ExerciseResult | null>(null)

  let timer: ReturnType<typeof setTimeout> | undefined
  let shownAt = 0
  let answerMs: number[] = []

  const round = (): TRound | null => rounds()[index()] ?? null
  const right = (): number => marks().filter(Boolean).length
  const score = (): number => quizScore(right(), marks().length)

  function clearTimer(): void {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  function show(): void {
    shownAt = now()
    const current = round()
    if (current !== null) options.onRound?.(current)
  }

  function start(row: readonly TRound[]): void {
    clearTimer()
    setRounds(row)
    setIndex(0)
    setMarks([])
    setFeedback(null)
    setResult(null)
    answerMs = []
    setStatus('active')
    show()
  }

  /** One answer a round: a second while the first is on show is dropped. */
  function answer(given: TAnswer): void {
    const current = round()
    if (status() !== 'active' || current === null || feedback() !== null) {
      return
    }
    const isRight = options.isRight(current, given)
    answerMs.push(now() - shownAt)
    setMarks((m) => [...m, isRight])
    setFeedback({ chosen: given, right: isRight })
    options.onAnswer?.(current, isRight)
    timer = setTimeout(next, options.holdMs(isRight, current))
  }

  function next(): void {
    timer = undefined
    setFeedback(null)
    if (index() + 1 >= rounds().length) {
      finish()
      return
    }
    setIndex((i) => i + 1)
    show()
  }

  function finish(): void {
    clearTimer()
    options.onEnd?.()
    const asked = rounds().length
    const answered = marks().length
    const avgMs =
      answerMs.length === 0
        ? 0
        : Math.round(answerMs.reduce((a, b) => a + b, 0) / answerMs.length)
    setResult({
      type: options.type,
      // A stopped run is scored on the rounds it reached; the history files
      // it as practice either way (`stoppedEarly`).
      score: quizScore(right(), answered),
      metrics: {
        correct: right(),
        total: asked,
        answered,
        avgMs,
        ...stoppedEarlyMark(answered < asked),
      },
      completedAt: Date.now(),
    })
    setFeedback(null)
    setStatus('complete')
  }

  /** Stop, from the shell's Stop: the run ends on the rounds answered. */
  function stop(): void {
    if (status() === 'active') finish()
  }

  function reset(): void {
    clearTimer()
    options.onEnd?.()
    setStatus('idle')
    setResult(null)
    setFeedback(null)
    setMarks([])
    setIndex(0)
  }

  return {
    status,
    /** The round that is up, or null outside a run. */
    round,
    /** The row of this run's rounds. */
    rounds,
    index,
    /** Right or wrong, for each round answered so far. */
    marks,
    feedback,
    score,
    result,
    start,
    answer,
    stop,
    reset,
  }
}

export type QuizRun<TRound, TAnswer> = ReturnType<
  typeof createQuizRun<TRound, TAnswer>
>
