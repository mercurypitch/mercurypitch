// ============================================================
// Lesson 24 recall and quick check — Lessons 10 and 23's questions, then four
// ============================================================
//
// Straight after the hero, the recall asks Lesson 10's question 1 and
// Lesson 23's question 3, the very objects those pages ask, for everyone,
// since both lessons come before this one (WEB-SPEC, Toys 5;
// quiz-questions.ts), under its own prefix and keys, marking no lesson
// done. Before the Wrap, the quick check asks LESSON.md's four, three
// answers each, shuffled; its wrong answers link back to this page's steps
// through the deck, and answering all four marks Lesson 24 done. Its
// question 4 plays A3 with E4 at exactly 330 Hz, a pure fifth, for 4.0 s,
// the same for everyone (FACTS 70, 77): disabled under its lock line until
// the cold open's choice (`unlockPure`, which the cold open's `onChoice`
// calls), since a still pair heard before it says what in tune sounds
// like; then a press plays it from the start, stopping any sound before
// it, the page's one sound, and its button stays lit while it sounds. Its
// answers stay open throughout.

import { qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import type { Run } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'
import { QUIZ_PURE, startPlay } from './sounds'

/**
 * Handles question 4's Play wherever the quiz `host` renders it: the pure
 * fifth over A3, from the start, stopping any sound before it, its button
 * lit while it sounds.
 */
export function bindPurePlay(host: HTMLElement): void {
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
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play="pure"]')
        : null
    if (button === null) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const r = startPlay(QUIZ_PURE, Sound.canPlay())
    run = r
    void r.done.then(() => {
      if (run === r) stop()
    })
  })
}

export interface Quizzes {
  readonly recall: Quiz
  readonly check: Quiz
  /** The cold open's choice: question 4's play sounds from now on, and its lock line goes. */
  unlockPure(): void
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
    lesson: 24,
    keys: QUIZ_KEYS,
    deck,
  })
  bindPurePlay(check.host)
  return {
    recall,
    check,
    unlockPure() {
      for (const b of qa<HTMLButtonElement>(
        '[data-quiz-play="pure"]',
        check.host,
      ))
        b.disabled = false
      for (const line of qa('[data-quiz-held]', check.host)) line.hidden = true
    },
  }
}
