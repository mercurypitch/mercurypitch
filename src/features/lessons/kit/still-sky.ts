// ============================================================
// Lesson still sky — the hero stage's stars, drawn once per size
// ============================================================
//
// The kit's seeded stars (hero-sky.ts) drawn still over a hero stage, and
// again when the stage changes size: for a page on which only Merc and Tavi's
// idle loops move by themselves (each WEB-SPEC's Look). It is a module of
// its own because hero-sky.ts is on every lesson page's first paint, and
// only a page that draws a still sky should download one. Lesson 6 is the
// first to take it from here; Lessons 3, 4 and 5 keep the copies they were
// built with (lesson-03/hook.ts, lesson-04/hero.ts, lesson-05/hook.ts).

import { q } from './dom'
import { surface } from './frame-loop'
import { drawStars, makeStars } from './hero-sky'

/** The stage's sky drawn still, once per size. */
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
