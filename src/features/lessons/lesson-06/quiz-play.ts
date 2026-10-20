// ============================================================
// Lesson 6 quiz sounds — question 1's two lines, question 3's pair
// ============================================================
//
// Question 1 plays `line-c`, 0.6 s of silence, then `line-fs` in blue
// Merc's "ooh" (FACTS 63); question 3 plays C4 then F4 in the soft tone
// (FACTS 69). The quiz rebuilds its questions on every answer and keeps
// each slot, so the buttons are handled by one listener on the quiz's host;
// one sound plays at a time, and a press while one plays waits for it.

import { Sound } from '@/features/lessons/kit/sound'
import { playNotes, QUIZ_FOURTH, QUIZ_LINES } from './examples'

export function bindQuizPlays(host: HTMLElement): void {
  let playing = false
  host.addEventListener('click', (e) => {
    const button =
      e.target instanceof Element
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play]')
        : null
    if (button === null || playing) return
    playing = true
    button.classList.add('is-on')
    const lines = button.dataset.quizPlay === 'lines'
    void playNotes(lines ? QUIZ_LINES : QUIZ_FOURTH, {
      audible: Sound.canPlay(),
      kind: lines ? 'merc' : undefined,
    }).done.then(() => {
      playing = false
      button.classList.remove('is-on')
    })
  })
}
