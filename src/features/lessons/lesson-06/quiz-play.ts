// ============================================================
// Lesson 6 quiz sounds — question 1's two lines, question 3's pair
// ============================================================
//
// Question 1 plays `line-c`, 0.6 s of silence, then `line-fs` in
// Merc's "ooh" (FACTS 63); question 3 plays C4 then F4 in the soft tone
// (FACTS 69). The quiz rebuilds its questions on every answer and keeps
// each slot, so the buttons are handled by one listener on the quiz's host.
// Each is the page's one sound (kit/now-playing.ts): a press while a sound
// plays, here or anywhere on the page, stops it and plays its own, so the
// newest press wins.

import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { Sound } from '@/features/lessons/kit/sound'
import type { Playing } from './examples'
import { playNotes, QUIZ_FOURTH, QUIZ_LINES } from './examples'

export function bindQuizPlays(host: HTMLElement): void {
  let playing: Playing | null = null
  let lit: HTMLButtonElement | null = null

  function stop(): void {
    playing?.stop()
    playing = null
    lit?.classList.remove('is-on')
    lit = null
    NowPlaying.release(stop)
  }

  host.addEventListener('click', (e) => {
    const button =
      e.target instanceof Element
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play]')
        : null
    if (button === null) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const lines = button.dataset.quizPlay === 'lines'
    const run = playNotes(lines ? QUIZ_LINES : QUIZ_FOURTH, {
      audible: Sound.canPlay(),
      kind: lines ? 'merc' : undefined,
    })
    playing = run
    void run.done.then(() => {
      if (playing === run) stop()
    })
  })
}
