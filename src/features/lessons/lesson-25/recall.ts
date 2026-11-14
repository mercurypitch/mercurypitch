// ============================================================
// Lesson 25 recall and quick check — Lessons 10 and 21's questions, then four
// ============================================================
//
// Straight after the hero, the recall asks Lesson 10's question 4 and
// Lesson 21's question 2, the very objects those pages ask, for everyone,
// since both lessons are this one's prerequisites (WEB-SPEC, Toys 7; FACTS
// 7), under its own prefix and keys, marking no lesson done. "Try Lesson
// 10, Step 5 again" and "Try Lesson 21, Step 4 again" open that lesson's
// page at the step in a new tab, so the viewer keeps their place here.
// Neither question has a play.
//
// Before the Wrap, the quick check asks LESSON.md's four, three answers
// each, shuffled from the stored seed; its wrong answers link back to this
// page's steps through the deck, and answering all four marks Lesson 25
// done. Its question 4 plays A melodic minor going up in the learner's
// octave, 3.15 s, the same on every visit (FACTS 65, 69): a press plays it
// from the start, stopping any sound before it, the page's one sound, and
// its button stays lit while it sounds.

import { minorScale } from '@/features/lessons/kit/chords'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { Clef } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'
import { MELODIC, minorDo, SCALE } from './sounds'
import { clefOf } from './steps'

/** Question 4's scale: A melodic minor going up in `clef`'s octave, a note every 0.4 s, each 0.35 s, 3.15 s (FACTS 65). */
export const quizScale = (clef: Clef): RunNote[] =>
  minorScale(minorDo(clef), MELODIC, 'up').map((n, i) => ({
    t: Math.round(i * SCALE.every * 1000) / 1000,
    midi: n.midi,
    dur: SCALE.dur,
  }))

/**
 * Handles question 4's Play wherever the quiz `host` renders it: the scale
 * from the start, in the learner's octave as it stands at the press,
 * stopping any sound before it, its button lit while it sounds.
 */
export function bindScalePlay(host: HTMLElement): void {
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
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play="scale"]')
        : null
    if (button === null) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const r = playNotes(quizScale(clefOf(VoiceChoice.voice)), {
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
    lesson: 25,
    keys: QUIZ_KEYS,
    deck,
  })
  bindScalePlay(check.host)
  return { recall, check }
}
