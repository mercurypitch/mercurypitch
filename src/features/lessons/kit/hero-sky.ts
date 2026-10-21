// ============================================================
// Lesson hero sky — the night stage's stars, the same on every visit
// ============================================================
//
// Seeded stars over the top of the hero stage, twinkling while the stage is
// on screen; the twinkle stops with the page's Pause animations and under
// reduced motion. A hero with nothing else in its sky mounts it as it is
// (`mountSky`). Lesson 1's hero draws its living staff over the stars in the
// same canvas, so it calls `drawStars` inside its own frame instead, with
// the camera its entrance pushes in (the far sky moves least).

import { lerp, mulberry32, q, TAU } from './dom'
import { addDrawer, surface, watch } from './frame-loop'
import { Motion } from './motion-switch'

export interface Star {
  /** Position, 0 to 1 across and down the stage. */
  readonly x: number
  readonly y: number
  /** Radius, px. */
  readonly r: number
  /** Brightness, and the twinkle's speed and phase. */
  readonly a: number
  readonly s: number
  readonly p: number
}

/** The sky's stars: seeded, so they sit in the same places on every visit. */
export function makeStars(seed = 20261016, count = 54): Star[] {
  const rnd = mulberry32(seed)
  return Array.from({ length: count }, () => ({
    x: rnd(),
    y: rnd() ** 1.4 * 0.62,
    r: 0.5 + rnd() * 1.1,
    a: 0.25 + rnd() * 0.6,
    s: 0.4 + rnd() * 1.4,
    p: rnd() * TAU,
  }))
}

export interface SkyFrame {
  /** Milliseconds of twinkle so far (it stands still while animations are paused). */
  readonly idleT: number
  /** 1 to twinkle, 0 to hold every star at its own brightness. */
  readonly twinkle: number
  /** The camera, 0 pushed out to 1 at rest: the sky moves least. */
  readonly cam: number
}

/** Draws the stars onto a W by H canvas. */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  stars: readonly Star[],
  frame: SkyFrame,
): void {
  const { idleT, twinkle, cam } = frame
  const ox = W / 2
  const oy = H * 0.7
  const sSky = lerp(1.025, 1, cam)
  for (const st of stars) {
    const a =
      st.a * (0.75 + 0.25 * Math.sin(idleT * 0.001 * st.s + st.p) * twinkle)
    ctx.fillStyle = `rgba(214,224,240,${a.toFixed(3)})`
    ctx.beginPath()
    ctx.arc(
      ox + (st.x * W - ox) * sSky,
      oy + (st.y * H - oy) * sSky + 5 * (1 - cam),
      st.r,
      0,
      TAU,
    )
    ctx.fill()
  }
}

export interface SkyOptions {
  /** The sky's canvas (default: the stage's `canvas.sky`). */
  readonly canvas?: HTMLCanvasElement
  /** A camera an entrance pushes in (default: at rest). */
  readonly camera?: { readonly cam: number }
}

/**
 * The sky drawn still, once per size: for a page on which only the Mercs'
 * idle loops move by themselves (each WEB-SPEC's Look). Lesson 6 is the
 * first to take it from here; Lessons 3, 4 and 5 keep the copies they were
 * built with (lesson-03/hook.ts, lesson-04/hero.ts, lesson-05/hook.ts).
 */
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

/** The sky alone on a hero stage, drawn while the stage is on screen. */
export function mountSky(stage: HTMLElement, opts: SkyOptions = {}): void {
  const cv = surface(opts.canvas ?? q<HTMLCanvasElement>('canvas.sky', stage))
  const visible = watch(stage)
  const stars = makeStars()
  let idleT = 0
  addDrawer({
    active: visible,
    draw(_now, dt) {
      const { ctx, w, h } = cv.fit()
      if (!Motion.paused) idleT += dt * 1000
      drawStars(ctx, w, h, stars, {
        idleT,
        twinkle: Motion.paused ? 0 : 1,
        cam: opts.camera?.cam ?? 1,
      })
    },
  })
}
