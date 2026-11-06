// ============================================================
// Lesson 22 recall and quick check — Lessons 5 and 14's questions, then four
// ============================================================
//
// Straight after the hero, the recall asks Lesson 5's question 3 and Lesson
// 14's question 3, the very objects those pages ask, for everyone, since
// both lessons come before this one (WEB-SPEC, Toys 5; quiz-questions.ts),
// under its own prefix and keys, marking no lesson done. Before the Wrap,
// the quick check asks LESSON.md's four, three answers each, shuffled; its
// wrong answers link back to this page's steps through the deck, and
// answering all four marks Lesson 22 done. Its question 3 plays Step 3's
// slow wave, ±50 cents at two swings a second on A3 for 3.0 s, drawing
// nothing (FACTS 71): disabled under its lock line until Step 3's choice
// (`unlockSlow`, which the steps' `onHeld` calls), since it would answer
// Step 3's predict; then a press plays it from the start, stopping any
// sound before it, the page's one sound, and its button stays lit while it
// sounds. Its answers stay open throughout.

import { qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import type { Run } from '@/features/lessons/kit/run'
import { playLine } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'
import { contourOfPlay, TWO } from './sounds'

/**
 * Handles question 3's Play wherever the quiz `host` renders it: Step 3's
 * slow wave, from the start, stopping any sound before it, its button lit
 * while it sounds.
 */
export function bindSlowPlay(host: HTMLElement): void {
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
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play="slow"]')
        : null
    if (button === null) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const r = playLine(contourOfPlay(TWO), {
      audible: Sound.canPlay(),
      vibrato: TWO.vibrato,
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
  /** Step 3's choice: question 3's play sounds from now on, and its lock line goes. */
  unlockSlow(): void
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
    lesson: 22,
    keys: QUIZ_KEYS,
    deck,
  })
  bindSlowPlay(check.host)
  return {
    recall,
    check,
    unlockSlow() {
      for (const b of qa<HTMLButtonElement>(
        '[data-quiz-play="slow"]',
        check.host,
      ))
        b.disabled = false
      for (const line of qa('[data-quiz-held]', check.host)) line.hidden = true
    },
  }
}
