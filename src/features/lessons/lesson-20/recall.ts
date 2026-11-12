// ============================================================
// Lesson 20 recall and quick check — Lessons 9 and 10's questions, then four
// ============================================================
//
// Straight after the hero, the recall asks Lesson 9's question 2 and
// Lesson 10's question 4, the very objects those pages ask, for everyone,
// since both lessons are this one's prerequisites (WEB-SPEC, Toys 8;
// FACTS 7), under its own prefix and keys, marking no lesson done; earlier
// answers are never shown, so the answers measure delayed retrieval. "Try
// Lesson 9, Step 3 again" and "Try Lesson 10, Step 5 again" open that
// lesson's page at the step in a new tab, so the viewer keeps their place
// here. Neither question plays anything.
//
// Before the Wrap, the quick check asks LESSON.md's four, three answers
// each, shuffled from the stored seed; its wrong answers link back to this
// page's steps through the deck, and answering all four marks Lesson 20
// done. Question 4's Play sounds E minor pentatonic, E4, G4, A4, B4, D5
// and E5 in the soft tone, 0.45 s a note with the last 0.9 s, 3.15 s, the
// same for everyone (FACTS 76). It is drawn as nothing, its button lit
// while it sounds, and it is the page's one sound.

import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import { scaleUp } from '@/features/lessons/kit/stairs-plays'
import { MINOR_FIVE } from '@/features/lessons/kit/stairs-scales'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'

/** Question 4's E, E4: E minor pentatonic up to E5 (FACTS 76). */
export const QUESTION_4_DO = 64

/** Question 4's play: E4, G4, A4, B4, D5 and E5, the last held, 3.15 s. */
export const QUESTION_4_NOTES: readonly RunNote[] = scaleUp(
  QUESTION_4_DO,
  1,
  MINOR_FIVE,
).map((e) => ({ t: e.at, midi: e.midi, dur: e.dur }))

/**
 * Handles question 4's Play wherever the quiz `host` renders it: a press
 * plays it from the start, stopping any sound before it, and its button
 * stays lit while it sounds.
 */
export function bindMinorFivePlay(host: HTMLElement): void {
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
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play="e-minor-five"]')
        : null
    if (button === null) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const r = playNotes(QUESTION_4_NOTES, {
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
    lesson: 20,
    keys: QUIZ_KEYS,
    deck,
  })
  bindMinorFivePlay(check.host)
  return { recall, check }
}
