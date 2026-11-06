// ============================================================
// Lesson 23 recall and quick check — Lesson 6's two questions, then four
// ============================================================
//
// Straight after the hero, the recall asks Lesson 6's questions 3 and 4,
// the very objects Lesson 6's page asks, for everyone, since Lesson 6 is
// this lesson's prerequisite (WEB-SPEC, Toys 7; quiz-questions.ts), under
// its own prefix and keys, marking no lesson done; the first's Play is
// Lesson 6's own C4 then F4, played by Lesson 6's quiz plays on this
// quiz's host (FACTS 68). Before the Wrap, the quick check asks LESSON.md's
// four, three answers each, shuffled; its wrong answers link back to this
// page's steps through the deck, and answering all four marks Lesson 23
// done. Its question 4 plays B3 and F4 together for 1.5 s, for everyone
// (FACTS 73, 78): a press plays it from the start, stopping any sound
// before it, the page's one sound, and its button stays lit while it
// sounds.

import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { bindQuizPlays as bindLesson6Plays } from '@/features/lessons/lesson-06/quiz-play'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'
import { QUIZ_TRITONE } from './sounds'

/**
 * Handles question 4's Play wherever the quiz `host` renders it: B3 and F4
 * together, from the start, stopping any sound before it, its button lit
 * while it sounds.
 */
export function bindTritonePlay(host: HTMLElement): void {
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
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play="tritone"]')
        : null
    if (button === null) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const r = playNotes(QUIZ_TRITONE, {
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
  bindLesson6Plays(recall.host)
  const check = createQuiz({
    questions: QUIZ_QUESTIONS,
    lesson: 23,
    keys: QUIZ_KEYS,
    deck,
  })
  bindTritonePlay(check.host)
  return { recall, check }
}
