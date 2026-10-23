// ============================================================
// Lesson 4 quiz stop — question 3's sound: Merc climbs to ti and stops
// ============================================================
//
// "Merc climbs a major scale to ti and stops" plays `stop-c` (FACTS 58): C4
// up to B4 at 0.45 s a note, B4 held 1.2 s, then silence, in Merc's
// "ooh". The quiz rebuilds its questions on every answer and keeps the
// slot, so the button is handled by one listener on the quiz's host; a
// press while it plays waits for it.

import { Sound } from '@/features/lessons/kit/sound'
import { playNotes, stopOnTi } from './examples'

export function bindQuizStop(host: HTMLElement): void {
  let playing = false
  host.addEventListener('click', (e) => {
    const button =
      e.target instanceof Element
        ? e.target.closest<HTMLButtonElement>('[data-quiz-stop]')
        : null
    if (button === null || playing) return
    playing = true
    button.classList.add('is-on')
    void playNotes(stopOnTi(60), {
      audible: Sound.canPlay(),
      kind: 'merc',
    }).then(() => {
      playing = false
      button.classList.remove('is-on')
    })
  })
}
