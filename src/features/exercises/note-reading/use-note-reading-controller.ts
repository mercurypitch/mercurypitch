// ============================================================
// Read the Note: one run, from its first note to its result
// ============================================================
//
// The one drill with no microphone, so it does not stand on
// use-base-exercise, whose start is the microphone's. A run here is a row of
// notes and an answer to each: this holds which note is up, what was
// answered, the moment the answer is shown before the next note, and the
// result the shell and the history take.

import { createSignal } from 'solid-js'
import type { ExerciseResult, ExerciseStatus } from '../types'
import { EXERCISE_NOTE_READING, stoppedEarlyMark } from '../types'
import type { ClefChoice, NoteReadingRound } from './note-reading-rounds'
import { answerIsRight, planRounds, readingScore } from './note-reading-rounds'
import type { Letter } from './staff-kit'
import { midiOf } from './staff-kit'

/** How long a right answer stays up before the next note. */
export const RIGHT_MS = 700
/** A miss stays longer: Merc names the note and says where it sits. */
export const WRONG_MS = 2000

/** The answer on show: the note's letter, the letter tapped, and the verdict. */
export interface NoteReadingFeedback {
  letter: Letter
  chosen: Letter
  right: boolean
}

export interface NoteReadingDeps {
  /** Called with the note's MIDI number as its answer is shown, to sound it. */
  onNote?: (midi: number) => void
  /** A number in [0, 1), for the run's order; `Math.random` by default. */
  random?: () => number
  /** Milliseconds, for the time an answer took; the page's clock by default. */
  now?: () => number
}

export interface NoteReadingStart {
  clef: ClefChoice
  difficulty: number
  rounds?: number
}

export function useNoteReadingController(deps: NoteReadingDeps = {}) {
  const now = deps.now ?? (() => performance.now())
  const [status, setStatus] = createSignal<ExerciseStatus>('idle')
  const [rounds, setRounds] = createSignal<readonly NoteReadingRound[]>([])
  const [index, setIndex] = createSignal(0)
  const [marks, setMarks] = createSignal<readonly boolean[]>([])
  const [feedback, setFeedback] = createSignal<NoteReadingFeedback | null>(null)
  const [result, setResult] = createSignal<ExerciseResult | null>(null)

  let timer: ReturnType<typeof setTimeout> | undefined
  let shownAt = 0
  let answerMs: number[] = []

  const round = (): NoteReadingRound | null => rounds()[index()] ?? null
  const right = (): number => marks().filter(Boolean).length
  const score = (): number => readingScore(right(), marks().length)

  function clearTimer(): void {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  function start(options: NoteReadingStart): void {
    clearTimer()
    setRounds(planRounds({ ...options, random: deps.random }))
    setIndex(0)
    setMarks([])
    setFeedback(null)
    setResult(null)
    answerMs = []
    shownAt = now()
    setStatus('active')
  }

  /** One answer a note: a second tap while the first is on show is dropped. */
  function answer(letter: Letter): void {
    const current = round()
    if (status() !== 'active' || current === null || feedback() !== null) {
      return
    }
    const isRight = answerIsRight(current, letter)
    answerMs.push(now() - shownAt)
    setMarks((m) => [...m, isRight])
    setFeedback({ letter: current.note.letter, chosen: letter, right: isRight })
    deps.onNote?.(midiOf(current.note))
    timer = setTimeout(next, isRight ? RIGHT_MS : WRONG_MS)
  }

  function next(): void {
    timer = undefined
    setFeedback(null)
    if (index() + 1 >= rounds().length) {
      finish()
      return
    }
    setIndex((i) => i + 1)
    shownAt = now()
  }

  function finish(): void {
    clearTimer()
    const asked = rounds().length
    const answered = marks().length
    const avgMs =
      answerMs.length === 0
        ? 0
        : Math.round(answerMs.reduce((a, b) => a + b, 0) / answerMs.length)
    setResult({
      type: EXERCISE_NOTE_READING,
      // A stopped run is scored on the notes it reached; the history files
      // it as practice either way (`stoppedEarly`).
      score: readingScore(right(), answered),
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

  /** Stop, from the shell's Stop: the run ends on the notes answered so far. */
  function stop(): void {
    if (status() === 'active') finish()
  }

  function reset(): void {
    clearTimer()
    setStatus('idle')
    setResult(null)
    setFeedback(null)
    setMarks([])
    setIndex(0)
  }

  return {
    status,
    /** The note that is up, or null outside a run. */
    round,
    /** The row of this run's notes. */
    rounds,
    index,
    /** Right or wrong, for each note answered so far. */
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

export type NoteReadingController = ReturnType<typeof useNoteReadingController>
