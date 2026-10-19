// ============================================================
// Lesson 3 recall — two questions from Lesson 2, asked afresh
// ============================================================
//
// Open only for a viewer who has marked Lesson 2 done (`Done.has(2)`); anyone
// else sees the closed line "Done Lesson 2? Two questions from it", which
// opens the same two questions (WEB-SPEC, Toys 8). The kit's quiz runs it
// under its own id prefix and storage keys, with a seed of its own, and
// marks no lesson done. Question 2's Play the two steps plays A4 to B4,
// then B4 to C5 (FACTS 46a), the only sound in the page's questions.

import { q, wait } from '@/features/lessons/kit/dom'
import { hz } from '@/features/lessons/kit/notes'
import { Done } from '@/features/lessons/kit/progress'
import { createQuiz } from '@/features/lessons/kit/quiz'
import { playTone, Sound } from '@/features/lessons/kit/sound'
import { RECALL_QUESTIONS, recallStepHref } from './quiz-questions'

const A4 = 69
const B4 = 71
const C5 = 72
const NOTE_SEC = 0.6

async function twoSteps(): Promise<void> {
  const audible = Sound.canPlay()
  for (const [from, to] of [
    [A4, B4],
    [B4, C5],
  ]) {
    await playTone(hz(from), NOTE_SEC, { audible })
    await playTone(hz(to), NOTE_SEC, { audible })
    await wait(0.45)
  }
}

export function initRecall(): void {
  const box = q<HTMLDetailsElement>('#recallBox')
  box.open = Done.has(2)
  Done.subscribe(() => {
    if (Done.has(2)) box.open = true
  })
  const quiz = createQuiz({
    questions: RECALL_QUESTIONS,
    keys: { seed: 'fyp-l03-recall-seed', record: 'fyp-l03-recall-v1' },
    prefix: 'rc-',
    // "Try Lesson 2, Step 3 again" opens Lesson 2's page at Step 3
    away: { href: recallStepHref },
  })
  let playing = false
  quiz.host.addEventListener('click', (e) => {
    const b =
      e.target instanceof Element
        ? e.target.closest<HTMLButtonElement>('[data-recall-play]')
        : null
    if (b === null || playing) return
    playing = true
    b.classList.add('is-on')
    void twoSteps().then(() => {
      playing = false
      b.classList.remove('is-on')
    })
  })
}
