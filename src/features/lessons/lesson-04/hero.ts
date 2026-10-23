// ============================================================
// Lesson 4 hero — Merc and Tavi either side of the staircase on C
// ============================================================
//
// The night stage's floor holds Merc, the compact staircase on C with
// do marked home, and Tavi. Play the scale sings C4 up to C5 (FACTS
// 57) in Merc's "ooh", blue lighting each stair as it sounds, and the
// top stair's house lights as the scale lands home. The sky's stars are
// drawn once and never twinkle: on this page only Merc and Tavi's idle loops
// move by themselves (WEB-SPEC, Look).

import { q } from '@/features/lessons/kit/dom'
import { surface, watch } from '@/features/lessons/kit/frame-loop'
import { drawStars, makeStars } from '@/features/lessons/kit/hero-sky'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercSing, mercsReady } from '@/features/lessons/kit/merc-duo'
import { COLOR } from '@/features/lessons/kit/notes'
import { Sound } from '@/features/lessons/kit/sound'
import type { NoteEvent } from './examples'
import { scaleUp } from './examples'
import type { StairsCore } from './stairs-core'
import { mountStairs } from './stairs-core'

/** The stars, painted once per size. */
export function stillSky(stage: HTMLElement): void {
  const cv = surface(q<HTMLCanvasElement>('canvas.sky', stage))
  const stars = makeStars()
  const paint = (): void => {
    const { ctx, w, h } = cv.fit()
    drawStars(ctx, w, h, stars, { idleT: 0, twinkle: 0, cam: 1 })
  }
  paint()
  new ResizeObserver(paint).observe(stage)
}

/** A Merc sings along with a run: each note as it starts, quiet once the last has ended. */
export function singAlong(
  which: Which,
): (e: NoteEvent, i: number, count: number) => void {
  return (e, i, count) => {
    mercSing(which, e.midi, true)
    if (i === count - 1)
      window.setTimeout(() => mercSing(which, e.midi, false), e.dur * 1000)
  }
}

export function initHero(): StairsCore {
  const stage = q('#heroStage')
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))
  const stairs = mountStairs({
    canvas: q<HTMLCanvasElement>('#heroStairs canvas'),
    compact: true,
    active: watch(stage),
  })
  const play = q<HTMLButtonElement>('#heroPlay')
  play.addEventListener('click', () => {
    if (stairs.busy) return
    const events = scaleUp(60)
    const sing = singAlong('blue')
    play.classList.add('is-on')
    stairs.set({ home: false })
    void stairs
      .play(events, Sound.canPlay(), {
        kind: 'merc',
        color: COLOR.blue,
        onNote: (e, i) => {
          sing(e, i, events.length)
          if (i === events.length - 1) stairs.set({ home: true })
        },
      })
      .then(() => play.classList.remove('is-on'))
  })
  return stairs
}
