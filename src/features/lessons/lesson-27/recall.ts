// ============================================================
// Lesson 27 recall and quick check — Lessons 12 and 23's questions, then four
// ============================================================
//
// Straight after the hero, the recall asks Lesson 12's question 3 and
// Lesson 23's question 1, the very objects those pages ask, for everyone,
// since both lessons are this one's prerequisites (WEB-SPEC, Toys 7; FACTS
// 7), under its own prefix and keys, marking no lesson done. "Try Lesson
// 12, Step 4 again" and the like open that lesson's page at the step in a
// new tab, so the viewer keeps their place here. Neither question has a
// play.
//
// Before the Wrap, the quick check asks LESSON.md's four, three answers
// each, shuffled from the stored seed; its wrong answers link back to this
// page's steps through the deck, and answering all four marks Lesson 27
// done. Its question 4 plays G3, B3, D4 and F4 together, 1.5 s, for
// everyone, the same on every visit (FACTS 72, 78): a press plays it from
// the start, stopping any sound before it, the page's one sound, and its
// button stays lit while it sounds.

import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'
import { CHECK_CHORD, CHECK_SEC, gainOf } from './sounds'

/** Question 4's chord: G3, B3, D4 and F4 together, 1.5 s, at 0.056 a voice (FACTS 72, 73, 78). */
export const QUIZ_CHORD: readonly RunNote[] = CHECK_CHORD.map((midi) => ({
  t: 0,
  midi,
  dur: CHECK_SEC,
  gain: gainOf(CHECK_CHORD.length),
}))

/**
 * Handles question 4's Play wherever the quiz `host` renders it: the chord
 * from the start, stopping any sound before it, its button lit while it
 * sounds.
 */
export function bindChordPlay(host: HTMLElement): void {
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
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play="chord"]')
        : null
    if (button === null) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const r = playNotes(QUIZ_CHORD, {
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
    lesson: 27,
    keys: QUIZ_KEYS,
    deck,
  })
  bindChordPlay(check.host)
  return { recall, check }
}
