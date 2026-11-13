// ============================================================
// Lesson 26 recall and quick check — two questions back, four on this lesson
// ============================================================
//
// The kit's quiz twice (WEB-SPEC, Toys 4): the recall, Lesson 12's question
// and Lesson 24's, each with its way back to its own lesson, opening in a
// new tab; and the quick check, LESSON.md's four questions. Question 2, the
// predict's question asked again, holds its answers, and question 4 its
// Play, until the cold open's choice (`unlock`), since each would state its
// answer (FACTS 1a, 40, 72). Question 4's Play plays do re mi re do on C4
// with the part four semitones up, then, after 1.0 s, with the key's
// thirds, 7.0 s, by ear only: nothing draws (FACTS 73). It is the page's
// one sound: it stops any sound before it, and a newer one stops it.

import { qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { ABOVE5, lengthOf, SHORT_BEAT, timed, TUNE5 } from './parts'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'

/** Question 4's two parts: four semitones up, then the key's thirds, 1.0 s apart (FACTS 73). */
export const QUIZ_PARTS: readonly RunNote[] = (() => {
  const tune = (t0: number): RunNote[] =>
    timed(TUNE5.at, TUNE5.beats, SHORT_BEAT, t0)
  const first = [
    ...tune(0),
    ...timed(
      TUNE5.at.map((a) => a + 4),
      TUNE5.beats,
      SHORT_BEAT,
      0,
    ),
  ]
  const t1 = lengthOf(first) + 1
  const second = [...tune(t1), ...timed(ABOVE5, TUNE5.beats, SHORT_BEAT, t1)]
  return [...first, ...second].sort((a, b) => a.t - b.t || a.midi - b.midi)
})()

/**
 * Handles question 4's Play wherever the quiz `host` renders it: the two
 * parts from the start, stopping any sound before it, its button lit while
 * it sounds.
 */
export function bindPartsPlay(host: HTMLElement): void {
  let run: Run | null = null
  let lit: HTMLButtonElement | null = null

  function stop(): void {
    run?.stop()
    run = null
    lit?.classList.remove('is-on')
    lit = null
    NowPlaying.release(stop)
  }

  host.addEventListener('click', (e) => {
    const button =
      e.target instanceof Element
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play="parts"]')
        : null
    if (button === null || button.disabled) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const r = playNotes(QUIZ_PARTS, {
      audible: Sound.canPlay(),
      kind: 'soft',
    })
    run = r
    void r.done.then(() => {
      if (run === r) stop()
    })
  })
}

export interface Quizzes {
  readonly recall: Quiz
  readonly check: Quiz
  /** The cold open's choice: question 2's answers and question 4's Play open, their lines put away. */
  unlock(): void
}

/** Mounts the recall and the quick check; the quick check's step links use `deck`. */
export function initQuizzes(deck: StepDeck): Quizzes {
  const recall = createQuiz({
    questions: RECALL_QUESTIONS,
    keys: RECALL_KEYS,
    prefix: 'recall-',
    away: { href: recallStepHref },
  })
  const check = createQuiz({
    questions: QUIZ_QUESTIONS,
    lesson: 26,
    keys: QUIZ_KEYS,
    deck,
  })
  bindPartsPlay(check.host)
  return {
    recall,
    check,
    unlock() {
      check.release('l26-q2')
      for (const b of qa<HTMLButtonElement>(
        '[data-quiz-play="parts"]',
        check.host,
      )) {
        b.disabled = false
        b.parentElement
          ?.querySelector<HTMLElement>('[data-quiz-held]')
          ?.setAttribute('hidden', '')
      }
    },
  }
}
