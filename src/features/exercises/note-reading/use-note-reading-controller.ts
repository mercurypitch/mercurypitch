// ============================================================
// Read the Note: one run, from its first note to its result
// ============================================================
//
// A quiz run (quiz/quiz-run.ts) whose rounds are notes on a staff and whose
// answers are letters. This adds what is the drill's own: the row of notes a
// run draws, the note's own letter beside the answer on show, how long each
// verdict stays up, and the note sounding once it is named.

import { createQuizRun } from '../quiz/quiz-run'
import { EXERCISE_NOTE_READING } from '../types'
import type { ClefChoice, NoteReadingRound } from './note-reading-rounds'
import { answerIsRight, planRounds } from './note-reading-rounds'
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
  const run = createQuizRun<NoteReadingRound, Letter>({
    type: EXERCISE_NOTE_READING,
    isRight: answerIsRight,
    holdMs: (right) => (right ? RIGHT_MS : WRONG_MS),
    onAnswer: (round) => deps.onNote?.(midiOf(round.note)),
    now: deps.now,
  })

  const feedback = (): NoteReadingFeedback | null => {
    const shown = run.feedback()
    const round = run.round()
    if (shown === null || round === null) return null
    return {
      letter: round.note.letter,
      chosen: shown.chosen,
      right: shown.right,
    }
  }

  return {
    status: run.status,
    /** The note that is up, or null outside a run. */
    round: run.round,
    /** The row of this run's notes. */
    rounds: run.rounds,
    index: run.index,
    /** Right or wrong, for each note answered so far. */
    marks: run.marks,
    feedback,
    score: run.score,
    result: run.result,
    start: (options: NoteReadingStart): void =>
      run.start(planRounds({ ...options, random: deps.random })),
    answer: run.answer,
    stop: run.stop,
    reset: run.reset,
  }
}

export type NoteReadingController = ReturnType<typeof useNoteReadingController>
