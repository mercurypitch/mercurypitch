// ============================================================
// Lesson 1 predict — commit to a guess, then hear 220 and 440 Hz
// ============================================================
//
// The play buttons stay locked until a guess is in (a committed guess helps
// even when it is wrong). "Play both" plays them one after the other, then
// together; the reveal appears only once that has actually been heard, so it
// never describes a sound that sound-off visitors did not hear.

import { q, qa, wait } from '@/features/lessons/kit/dom'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercCelebrate, mercSing } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { playTone, Sound } from '@/features/lessons/kit/sound'

const PLAY = '<svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>'
const SPEAKER =
  '<svg class="ico" aria-hidden="true"><use href="#i-speaker"/></svg>'
const CHECK = '<svg class="ico" aria-hidden="true"><use href="#i-check"/></svg>'

export function initPredict(): void {
  const box = q('#predict')
  const choices = qa<HTMLButtonElement>('.choice', box)
  const plays = qa<HTMLButtonElement>('[data-play]', box)
  const hint = q('#lockHint')
  const reveal = q('#reveal')
  let guess: string | null = null
  let busy = false
  let revealed = false

  choices.forEach((b) =>
    b.addEventListener('click', () => {
      if (guess !== null) return
      guess = b.dataset.choice ?? null
      choices.forEach((c) => {
        c.setAttribute('aria-pressed', String(c === b))
        c.disabled = true
      })
      plays.forEach((p) => {
        p.disabled = false
      })
      hint.innerHTML = `${PLAY}Locked in. Play both plays them one after the other, then together.`
      plays[0].focus({ preventScroll: true })
    }),
  )

  async function sing(
    which: Which,
    audible: boolean,
    dur = 1.7,
  ): Promise<void> {
    const midi = which === 'blue' ? A3 : A4
    mercSing(which, midi, true)
    await playTone(hz(midi), dur, { kind: 'merc', audible })
    mercSing(which, midi, false)
  }

  plays.forEach((p) =>
    p.addEventListener('click', () => {
      void (async () => {
        if (busy || guess === null) return
        busy = true
        plays.forEach((x) => x.classList.toggle('is-on', x === p))
        const what = p.dataset.play
        const audible = Sound.canPlay()
        if (what === 'both') {
          await sing('blue', audible, 1.1)
          await wait(0.2)
          await sing('orange', audible, 1.1)
          await wait(0.3)
          mercSing('blue', A3, true)
          mercSing('orange', A4, true)
          await Promise.all([
            playTone(hz(A3), 2, { kind: 'merc', audible, gain: 0.16 }),
            playTone(hz(A4), 2, { kind: 'merc', audible, gain: 0.13 }),
          ])
          mercSing('blue', A3, false)
          mercSing('orange', A4, false)
        } else {
          await sing(what === '220' ? 'blue' : 'orange', audible)
        }
        plays.forEach((x) => x.classList.remove('is-on'))
        busy = false
        // the reveal describes what was heard
        if (!audible || Sound.state !== 'on') {
          if (!revealed) {
            hint.innerHTML = `${SPEAKER}Sound is off, so nothing played. Turn sound on to hear them, then press Play both.`
          }
          return
        }
        if (what !== 'both') {
          if (!revealed) {
            hint.innerHTML = `${PLAY}Now press Play both: one after the other, then together.`
          }
          return
        }
        if (revealed) return
        revealed = true
        q('#revealGuess').textContent =
          guess === 'same'
            ? 'You said: the same note · you heard something real'
            : 'You said: two different notes · you heard something real'
        hint.innerHTML = `${CHECK}Play them again, one at a time or together.`
        reveal.hidden = false
        mercCelebrate('orange', 1600)
        if (!reducedMotion()) {
          reveal.animate(
            [{ transform: 'translateY(10px)' }, { transform: 'none' }],
            { duration: 700, easing: 'cubic-bezier(.16, 1, .3, 1)' },
          )
        }
      })()
    }),
  )
}
