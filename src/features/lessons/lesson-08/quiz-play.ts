// ============================================================
// Lesson 8 quiz sound — question 2's two bars of three
// ============================================================
//
// Question 2 plays two bars of 3 and the next bar's first beat at 90 BPM,
// seven clicks over 4.0 s, beat 1 on the high click (FACTS 77), on the beat
// clock as Count the bar does. The quiz rebuilds its questions on every
// answer and keeps each slot, so the button is handled by one listener on
// the quiz's host. It is the page's one sound (kit/now-playing.ts): a press
// while a sound plays, here or anywhere on the page, stops it and plays its
// own, so the newest press wins.

import type { EarPlaying } from '@/features/lessons/kit/ear-game'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { Sound } from '@/features/lessons/kit/sound'
import { barClicks } from './bar-rounds'
import { playClicks } from './count-the-bar'

export function bindQuizPlays(host: HTMLElement): void {
  let playing: EarPlaying | null = null
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
        ? e.target.closest<HTMLButtonElement>('[data-quiz-play="bars"]')
        : null
    if (button === null) return
    stop()
    NowPlaying.claim(stop)
    lit = button
    button.classList.add('is-on')
    const run = playClicks(barClicks(3), Sound.canPlay())
    playing = run
    void run.done.then(() => {
      if (playing === run) stop()
    })
  })
}
