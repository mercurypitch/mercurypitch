// ============================================================
// Lesson 10 quiz sound — question 2's chord, D minor
// ============================================================
//
// The quick check's question 2 plays D4, F4 and A4 together for 1.4 s, a
// D minor triad, each voice at a chord's level, in the soft tone (FACTS 79,
// 81). The quiz rebuilds its questions on every answer and keeps each
// slot, so the button is handled by one listener on the quiz's host, as
// Lesson 6's quiz plays are (lesson-06/quiz-play.ts). The play is the
// page's one sound (kit/now-playing.ts): a press while a sound plays, here
// or anywhere on the page, stops it and plays its own, so the newest press
// wins. Lesson 12's recall asks this question again and binds these plays
// on its own quiz's host.

import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import { QUIZ_CHORD } from './sounds'

/** Plays question 2's chord from its slot's button on `host`, a quiz's host. */
export function bindQuizPlays(host: HTMLElement): void {
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
    const r = playNotes(QUIZ_CHORD, { audible: Sound.canPlay(), kind: 'soft' })
    run = r
    void r.done.then(() => {
      if (run === r) stop()
    })
  })
}
