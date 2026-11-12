// ============================================================
// Lesson 16 recall and quick check — Lessons 9 and 15's questions, then four
// ============================================================
//
// Straight after the hero, the recall asks Lesson 9's question 2 and
// Lesson 15's question 1, the very objects those pages ask, for everyone,
// since both lessons are this one's prerequisites (WEB-SPEC, Toys 5;
// FACTS 7), under its own prefix and keys, marking no lesson done; earlier
// answers are never shown, so the answers measure delayed retrieval. "Try
// Lesson 9, Step 3 again" and "Try Lesson 15, Step 1 again" open that
// lesson's page at the step in a new tab, so the viewer keeps their place
// here. Neither question plays anything.
//
// Before the Wrap, the quick check asks LESSON.md's four, three answers
// each, shuffled from the stored seed; its wrong answers link back to this
// page's steps through the deck, and answering all four marks Lesson 16
// done. Question 4's Play sounds do, a second of quiet, then re, in the
// learner's octave at the moment of the tap, in the soft tone, its button
// lit while it sounds, the page's one sound (FACTS 69).

import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'
import { quizDoRe } from './sounds'
import { learnerClef } from './steps'

/**
 * Handles question 4's Play wherever the quiz `host` renders it: do, a
 * second of quiet, then re, from the start, stopping any sound before it,
 * its button lit while it sounds.
 */
export function bindDoRePlay(host: HTMLElement): void {
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
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play="do-re"]')
        : null
    if (button === null) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const r = playNotes(quizDoRe(learnerClef()), {
      audible: Sound.canPlay(),
      kind: 'soft',
    })
    run = r
    void r.done.then(() => {
      if (run === r) stop()
    })
  })
}

/** Mounts the recall and the quick check; the quick check's step links use `deck`. */
export function initQuizzes(deck: StepDeck): { recall: Quiz; check: Quiz } {
  const recall = createQuiz({
    questions: RECALL_QUESTIONS,
    keys: RECALL_KEYS,
    prefix: 'recall-',
    away: { href: recallStepHref },
  })
  const check = createQuiz({
    questions: QUIZ_QUESTIONS,
    lesson: 16,
    keys: QUIZ_KEYS,
    deck,
  })
  bindDoRePlay(check.host)
  return { recall, check }
}
