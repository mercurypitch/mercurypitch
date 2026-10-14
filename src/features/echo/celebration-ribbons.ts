// ============================================================
// The celebration's ribbons: their canvas, their fields and their clock
// ============================================================
//
// Three thin wispy strokes whose alpha varies along each curve (the wisp,
// the tapers, each link's gain), painted into a canvas from per-pixel
// fields (celebration-paint.ts). The fields are the expensive part, so
// while the celebration plays they are built a slice at a time between
// frames (round 6: the result's first frame had carried all of them), long
// before the ribbons first draw on at timing.ribbons.fromMs. A paint that
// needs them sooner (a fixture, reduced motion, a new layout) builds the
// rest at once. Either way they are the same fields, to the bit.

import { createEffect, createMemo } from 'solid-js'
import type { RibbonField, RibbonFrame, RibbonScratch, } from './celebration-paint'
import { catmullRom, finish, paintRibbons, ribbonFieldSteps, ribbonFrames, ribbonPixels, ribbonPlan, sigmaOf, } from './celebration-paint'
import { CELEBRATION } from './echo-celebration'
import type { SkyLayout } from './sky-layout'
import { onPlate } from './sky-layout'

/** The ribbons' drift is slow (about a px a second): five paints a second. */
const WISP_FRAME_MS = 200

/**
 * How long one slice of the fields may run, ms: well inside a frame, so
 * building them never holds one up.
 */
const FIELD_SLICE_MS = 4

/** The ribbons' fields for a layout, and the buffers their paints share. */
interface PaintedRibbons {
  readonly fields: RibbonField[]
  readonly scratch: RibbonScratch
}

/** The ribbons' canvas box, CSS px, and its pixel size at `dpr`. */
export interface RibbonBox {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
  readonly dpr: number
}

export interface CelebrationRibbons {
  /** The canvas's box: the curves', out to their reach. */
  readonly box: () => RibbonBox
  /** The canvas, once it is up. */
  readonly setCanvas: (el: HTMLCanvasElement) => void
  /** Build the fields a slice per task, the first after this one. */
  readonly buildInSlices: () => void
  /** Draw them on from `start` (performance.now() ms), then drift. */
  readonly run: (start: number) => void
  readonly stop: () => void
}

/**
 * The ribbons for a layout. `animated` false: they stand whole at their
 * end state from the first paint (a fixture, reduced motion).
 */
export function createCelebrationRibbons(
  layout: () => SkyLayout,
  animated: boolean,
): CelebrationRibbons {
  const { timing } = CELEBRATION
  const unit = (): number => layout().unit
  const plan = ribbonPlan()
  const sigma = (): number =>
    Math.max(...CELEBRATION.ribbons.map((r) => sigmaOf(r.fwhmW * unit())))
  const curves = createMemo(() =>
    CELEBRATION.ribbons.map((r) =>
      catmullRom(
        r.points.map((p) => {
          const at = onPlate(layout(), { u: p[0], v: p[1] })
          return [at.x, at.y] as const
        }),
      ),
    ),
  )
  const box = createMemo((): RibbonBox => {
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const pad = 4 * sigma() + 2
    const all = curves().flat()
    const left = Math.min(...all.map((p) => p[0])) - pad
    const top = Math.min(...all.map((p) => p[1])) - pad
    const width = Math.ceil(
      (Math.max(...all.map((p) => p[0])) + pad - left) * dpr,
    )
    const height = Math.ceil(
      (Math.max(...all.map((p) => p[1])) + pad - top) * dpr,
    )
    return { left, top, width, height, dpr }
  })

  /** The fields for this layout, and the pixels they light, as steps. */
  const job = createMemo(() => {
    const b = box()
    const ribbons = curves().map((curve) =>
      curve.map(([x, y]) => [x - b.left, y - b.top] as const),
    )
    const scale = unit()

    function* steps(): Generator<void, PaintedRibbons> {
      const fields: RibbonField[] = []
      for (const [i, r] of CELEBRATION.ribbons.entries()) {
        const look = {
          fwhm: r.fwhmW * scale,
          taper: r.taperW * scale,
          alpha: r.alpha,
          fromStart: plan[i].fromStart,
          segmentGain: r.segmentGain,
        }
        fields.push(yield* ribbonFieldSteps(ribbons[i], look, b))
      }
      yield
      const n = b.width * b.height
      const lit = ribbonPixels(fields, n)
      return { fields, scratch: { lit, acc: new Float32Array(n * 4) } }
    }
    return { steps: steps(), done: null as PaintedRibbons | null }
  })
  const built = (): PaintedRibbons => {
    const now = job()
    now.done ??= finish(now.steps)
    return now.done
  }
  let slice = 0
  const buildSlice = (): void => {
    const now = job()
    const until = performance.now() + FIELD_SLICE_MS
    while (now.done === null) {
      const next = now.steps.next()
      if (next.done === true) now.done = next.value
      else if (performance.now() >= until) {
        slice = window.setTimeout(buildSlice, 0)
        return
      }
    }
  }

  let canvas: HTMLCanvasElement | undefined
  /** The canvas's pixels, kept between paints (the scratch's partner). */
  let image: ImageData | undefined
  /** Their state now: undrawn while they play, else their end state. */
  let frames: RibbonFrame[] = ribbonFrames(animated ? 0 : null)
  const paint = (): void => {
    // Not up yet: nothing to paint, and the curves are left for then.
    if (canvas === undefined) return
    const b = box()
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    if (canvas.width !== b.width) canvas.width = b.width
    if (canvas.height !== b.height) canvas.height = b.height
    if (frames.every((f) => f.drawn <= 0)) {
      // Nothing drawn yet: a clear canvas, and no fields needed.
      ctx.clearRect(0, 0, b.width, b.height)
      return
    }
    const { fields, scratch } = built()
    if (image?.width !== b.width || image.height !== b.height) {
      image = ctx.createImageData(b.width, b.height)
    }
    paintRibbons(
      image.data,
      fields,
      frames,
      CELEBRATION.ribbons.map((r) => ({
        depth: r.wisp.depth,
        periodPx: r.wisp.periodW * unit(),
      })),
      CELEBRATION.ribbons.map((r) => r.rgb),
      scratch,
    )
    ctx.putImageData(image, 0, 0)
  }
  // Repaint whenever the layout moves them (the fields follow it).
  createEffect(paint)

  let frame = 0
  const run = (start: number): void => {
    const { durationMs, fromMs } = timing.ribbons
    const drawnBy = Math.max(...plan.map((p) => p.revealAt)) + durationMs
    let painted = -Infinity
    const tick = (now: number): void => {
      const elapsed = now - start
      // One frame past the end, so the last paint is the whole ribbon.
      const drawing = elapsed >= fromMs && elapsed < drawnBy + 50
      const drifting = elapsed >= timing.idleFromMs
      if (drawing || (drifting && now - painted >= WISP_FRAME_MS)) {
        frames = ribbonFrames(elapsed)
        paint()
        painted = now
      }
      frame = requestAnimationFrame(tick)
    }
    frames = ribbonFrames(0)
    paint()
    frame = requestAnimationFrame(tick)
  }

  return {
    box,
    // The effect above paints a canvas that is up from the start.
    setCanvas: (el) => {
      canvas = el
    },
    buildInSlices: () => {
      slice = window.setTimeout(buildSlice, 0)
    },
    run,
    stop: () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(slice)
    },
  }
}
