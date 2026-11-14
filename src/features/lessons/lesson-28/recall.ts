// ============================================================
// Lesson 28 recall and quick check — two questions back, four on this lesson
// ============================================================
//
// The kit's quiz twice (WEB-SPEC, Toys 5): the recall, Lesson 18's
// question 2 and Lesson 26's, each with its way back to its own lesson,
// opening in a new tab; and the quick check, LESSON.md's four questions.
// Question 4 holds its answers and its Play until the cold open's choice
// (`unlock`), since its answer names the cadence the song kept going on.
// Its Play is bars 5 to 8 of the song as it kept going, both parts on
// "ooh", 13.33 s, stopping on bar 8's vi, by ear only: nothing draws
// (FACTS 80). It is the page's one sound: it stops any sound before it,
// and a newer one stops it.

import { qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'
import { barsOf, bothNotes, GOING } from './song'

/** Question 4's phrase: bars 5 to 8 of the song as it kept going, ending on vi (FACTS 80). */
export const QUIZ_PHRASE: readonly RunNote[] = bothNotes(barsOf(GOING, 5, 8))

/**
 * Handles question 4's Play wherever the quiz `host` renders it: the
 * phrase from the start, stopping any sound before it, its button lit
 * while it sounds.
 */
export function bindPhrasePlay(host: HTMLElement): void {
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
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play="phrase"]')
        : null
    if (button === null || button.disabled) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const r = playNotes(QUIZ_PHRASE, { audible: Sound.canPlay() })
    run = r
    void r.done.then(() => {
      if (run === r) stop()
    })
  })
}

export interface Quizzes {
  readonly recall: Quiz
  readonly check: Quiz
  /** The cold open's choice: question 4's answers and Play open, its line put away. */
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
    lesson: 28,
    keys: QUIZ_KEYS,
    deck,
  })
  bindPhrasePlay(check.host)
  return {
    recall,
    check,
    unlock() {
      check.release('l28-q4')
      for (const b of qa<HTMLButtonElement>(
        '[data-quiz-play="phrase"]',
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
