// ============================================================
// Lesson 9 folds strip — Step 1's vocal folds, slowed 220 times, under the chart
// ============================================================
//
// Step 1's second figure (WEB-SPEC, Toys 1, "Step"): the kit's folds, seen
// from above, in the bottom 64 px of the ladder chart's figure, so the stage
// fit sizes the two as one (kit/stage-fit.ts). While a note of Step or Leap
// sounds, the folds come together and open and close at that note's rate
// slowed 220 times (kit/slow-motion.ts): 0.67 a second at D3, 1.12 times
// that at E3, 1.50 times at A3 (FACTS 30). When nothing sounds they rest
// apart, still, and the strip asks for no frame (the page rests, as Lessons
// 6 to 8 do). Under reduced motion a sounding note is Lesson 3's two stills,
// OPEN and CLOSED, each word beside its pair, and the status line under the
// chart gives the ratio in words.
//
// Lesson 3's folds were drawn for a figure 180 px tall and up, so the
// strip draws them thinner in proportion and leaves their vibration in
// fixed pixels; FRONT, BACK and VOCAL FOLDS clip in 64 px, so it draws no
// labels (kit/folds.ts's `drawFoldLabels`): the figure's label names the
// folds. A schematic, not anatomy to scale (FACTS 100).

import { clamp, lerp } from '@/features/lessons/kit/dom'
import type { FoldShape } from '@/features/lessons/kit/folds'
import { drawFoldPair, drawFoldText, foldEdgeX, foldShapeAt, } from '@/features/lessons/kit/folds'
import { foldBulge, foldStretch, foldVibration, } from '@/features/lessons/kit/folds-sing'
import { addDrawer, surface, wake, watchPixelRatio, } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { createSlowClock } from '@/features/lessons/kit/slow-motion'

/** The figure height Lesson 3's folds were drawn for: thinner in proportion below it. */
const DRAWN_FOR = 180

/** The folds in a strip `h` high at stretch `s`, centred on `cx`: Lesson 3's shape, its thickness in proportion. */
export function stripShape(h: number, s: number, cx: number): FoldShape {
  const shape = foldShapeAt(h, s, cx)
  return { ...shape, th: shape.th * Math.min(1, h / DRAWN_FOR) }
}

/** Half the gap at the back, the folds resting apart, as Lesson 3's breathing draws them. */
const apartGap = (shape: FoldShape): number => shape.len * 0.3

/** What the strip draws: the folds resting apart, singing slowed, or the two stills. */
export type StripMode = 'apart' | 'singing' | 'stills'

/** The mode for a note sounding at `hz` (null for none), under reduced motion or not. */
export function stripMode(hz: number | null, reduced: boolean): StripMode {
  if (hz === null) return 'apart'
  return reduced ? 'stills' : 'singing'
}

/** Draws the two stills at stretch `s`, OPEN and CLOSED, each word beside its pair. */
function drawStills(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: number,
): void {
  for (const [i, word] of ['OPEN', 'CLOSED'].entries()) {
    const shape = stripShape(h, s, w * (0.3 + 0.34 * i))
    shape.bulge = i === 0 ? foldVibration(s) : 0
    drawFoldPair(ctx, shape)
    const y = shape.y0 + shape.len * 0.62
    drawFoldText(ctx, word, foldEdgeX(shape, 0.62, 1, true) + 10, y, 'left')
  }
}

export interface FoldsStripOptions {
  /** When it draws: Step 1 showing on a stage on screen. */
  readonly active: () => boolean
  /** The pitch the folds rest at, Hz: do's, the note a step or a leap starts from. */
  readonly restHz: () => number
}

export interface FoldsStrip {
  /** A note starts: the folds sing at `hz`, slowed, until the next note or `rest`. */
  sing(hz: number): void
  /** Nothing sounds: the folds rest apart. */
  rest(): void
  /** The pitch singing now, Hz, or null at rest. */
  readonly hz: number | null
  /** What a frame draws now. */
  readonly mode: StripMode
}

export function mountFoldsStrip(
  canvas: HTMLCanvasElement,
  opts: FoldsStripOptions,
): FoldsStrip {
  const cv = surface(canvas)
  const clock = createSlowClock()
  let singing: number | null = null
  // how far apart the folds stand, 0 together to 1 apart: they ease between
  let open = 1

  const mode = (): StripMode => stripMode(singing, reducedMotion())
  const target = (): number => (singing === null ? 1 : 0)
  const easing = (): boolean =>
    !reducedMotion() && Math.abs(open - target()) > 0.01

  // what a frame shows, as one string, and what the last frame drew: the
  // strip draws only when they differ, or while the folds move
  let drawn = ''
  const showing = (): string =>
    JSON.stringify([
      mode(),
      singing ?? opts.restHz(),
      canvas.clientWidth,
      canvas.clientHeight,
      globalThis.devicePixelRatio,
    ])

  function draw(dt: number): void {
    drawn = showing()
    const { ctx, w, h } = cv.fit()
    const hz = singing ?? opts.restHz()
    const s = foldStretch(hz)
    if (mode() === 'stills') {
      drawStills(ctx, w, h, s)
      return
    }
    open = reducedMotion()
      ? target()
      : open + (target() - open) * (1 - Math.exp(-dt * 9))
    const shape = stripShape(h, s, w / 2)
    shape.gap = lerp(1, apartGap(shape), clamp(open, 0, 1))
    if (singing !== null) {
      clock.advance(dt, singing)
      shape.bulge = foldBulge(s, clock.phase)
    }
    drawFoldPair(ctx, shape)
  }

  addDrawer({
    active: opts.active,
    wants: () => mode() === 'singing' || easing() || showing() !== drawn,
    draw: (_now, dt) => draw(dt),
  })
  // a new size or pixel ratio wakes a resting loop
  new ResizeObserver(wake).observe(canvas)
  watchPixelRatio(wake)

  return {
    sing(hz) {
      if (singing === null) clock.reset()
      singing = hz
      wake()
    },
    rest() {
      if (singing === null) return
      singing = null
      wake()
    },
    get hz() {
      return singing
    },
    get mode() {
      return mode()
    },
  }
}
