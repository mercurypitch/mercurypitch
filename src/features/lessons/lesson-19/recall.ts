// ============================================================
// Lesson 19 recall and quick check — Lesson 17's two questions, then four
// ============================================================
//
// Straight after the hero, the recall asks Lesson 17's questions 3 and 2,
// the very objects Lesson 17's page asks, for everyone (WEB-SPEC, Toys 9;
// quiz-questions.ts); neither plays. Before the Wrap, the quick check asks
// LESSON.md's four, three answers each, shuffled; its wrong answers link
// back to this page's steps through the deck. Its question 2 plays
// Subdivide's second bar of 6/8 twice, on the drums at this page's speed,
// an eighth a third of a second, 4 s (FACTS 68, 69), through the beat
// clock: a press plays it from the start, stopping any sound before it,
// and its button stays lit while it sounds.

import type { Hit, Run } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import type { DrumHit } from '@/features/lessons/kit/drum-hits'
import { bookDrum } from '@/features/lessons/kit/drum-hits'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Quiz } from '@/features/lessons/kit/quiz'
import { createQuiz, recallStepHref } from '@/features/lessons/kit/quiz'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { QUIZ_KEYS, QUIZ_QUESTIONS, RECALL_KEYS, RECALL_QUESTIONS, } from './quiz-questions'
import { SECOND_SIX_EIGHT, SIX_BPM } from './rhythm-views'

/** Question 2's bar: Subdivide's second 6/8, a hit on each eighth (FACTS 68). */
export const QUIZ_BAR: readonly Hit<DrumHit>[] = SECOND_SIX_EIGHT.map(
  (data, k) => ({ beat: k * 0.5, data }),
)

/**
 * Handles the quick check's Play wherever the quiz `host` renders it: the
 * bar twice, from the start, stopping any sound before it, its button lit
 * while it sounds.
 */
export function bindBarsPlay(host: HTMLElement): void {
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
        ? e.target.closest<HTMLButtonElement>('[data-quiz-bars]')
        : null
    if (button === null) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const bar = { beats: 3, hits: QUIZ_BAR }
    const r = BeatClock.start<DrumHit>({
      bar: bars([bar, bar]),
      bpm: () => SIX_BPM,
      audible: Sound.canPlay(),
      book: bookDrum,
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
    lesson: 19,
    keys: QUIZ_KEYS,
    deck,
  })
  bindBarsPlay(check.host)
  return { recall, check }
}
