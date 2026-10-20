// ============================================================
// Lesson 1 predict — commit to a guess, then hear 220 and 440 Hz
// ============================================================
//
// The kit's predict widget (kit/predict.ts) with Lesson 1's sounds and
// lines. "Play both" plays them one after the other, then together; only
// that reveals, once it has actually been heard.

import { q, wait } from '@/features/lessons/kit/dom'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercCelebrate, mercSing } from '@/features/lessons/kit/merc-duo'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import { mountPredict } from '@/features/lessons/kit/predict'
import { playTone } from '@/features/lessons/kit/sound'

async function sing(which: Which, audible: boolean, dur = 1.7): Promise<void> {
  const midi = which === 'blue' ? A3 : A4
  mercSing(which, midi, true)
  await playTone(hz(midi), dur, { kind: 'merc', audible })
  mercSing(which, midi, false)
}

async function playBoth(audible: boolean): Promise<void> {
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
}

export function initPredict(): void {
  mountPredict(q('#predict'), {
    play: (what, audible) =>
      what === 'both'
        ? playBoth(audible)
        : sing(what === '220' ? 'blue' : 'orange', audible),
    revealOn: ['both'],
    hints: {
      chosen:
        'Locked in. Play both plays them one after the other, then together.',
      silent:
        'Sound is off, so nothing played. Turn sound on to hear them, then press Play both.',
      next: 'Now press Play both: one after the other, then together.',
      again: 'Play them again, one at a time or together.',
    },
    guess: (choice) =>
      choice === 'same'
        ? 'You said: the same note · they do share one name'
        : 'You said: two different notes · 440 does sound higher',
    onReveal: () => mercCelebrate('orange', 1600),
  })
}
