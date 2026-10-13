// ============================================================
// EchoRibbon: the voice, from the last lit star to the note being sung
// ============================================================
//
// The shared ribbon (src/components/room-kit/ribbon.ts: one look in every
// room): a cyan core with a bright middle over a violet glow where the
// voice is on the note it is reaching for, amber where it is off. In Echo
// it runs from the last star that lit to the column of the note being
// sung, its head at the voice's height, so the stretch between two stars
// is the path the voice took (DESIGN-echo.md 1).
//
// Two canvases over the sky's phrase band: the core at the screen's DPR,
// and the glow small and blurred by the compositor (GLOW_RES, GLOW_BLUR_PX),
// as Long note draws it. The controller hands a path in on every frame it
// changes (`draw`); nothing here keeps time.

import type { JSX } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import type { TraceMark } from '@/components/room-kit/ribbon'
import { CORE, CROSSING_PX, GLOW, GLOW_BLUR_PX, GLOW_RES, ribbonStops, ribbonTint, strokeLayers, } from '@/components/room-kit/ribbon'
import styles from './EchoRibbon.module.css'

/** The room's width the shared widths were matched at (storyboard 2). */
export const RIBBON_REFERENCE_W = 390

export interface RibbonPoint {
  /** px in the room's box. */
  readonly x: number
  readonly y: number
  /** The voice was on the note here. */
  readonly filling: boolean
}

export interface RibbonPath {
  /** Oldest first, left to right. */
  readonly points: readonly RibbonPoint[]
  /** The widths' scale: 1 at the storyboard's width and size. */
  readonly scale: number
}

export interface RibbonBox {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface EchoRibbonApi {
  /** Draw this path, or clear the ribbon with null. */
  draw: (path: RibbonPath | null) => void
}

export interface EchoRibbonProps {
  /** Where the canvases sit in the room's box, px. */
  box: RibbonBox
  /** The scale the glow is blurred at: the paths' own. */
  scale: number
  onReady: (api: EchoRibbonApi) => void
}

/** Each point's place along the path, 0 to 1, by length. */
function places(points: readonly RibbonPoint[]): {
  marks: TraceMark[]
  length: number
} {
  const lengths = [0]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    lengths.push(lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const length = lengths[lengths.length - 1]
  return {
    marks: points.map((p, i) => ({
      at: length > 0 ? lengths[i] / length : 0,
      filling: p.filling,
    })),
    length,
  }
}

/** The path through the points, smoothed through their midpoints. */
function trace(
  ctx: CanvasRenderingContext2D,
  points: readonly RibbonPoint[],
): void {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const next = points[i + 1]
    ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2)
  }
  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
}

export function EchoRibbon(props: EchoRibbonProps): JSX.Element {
  let core: HTMLCanvasElement | undefined
  let glow: HTMLCanvasElement | undefined
  let sized = ''

  const size = (): { dpr: number } => {
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const { width, height } = props.box
    const key = `${width}x${height}@${dpr}`
    if (key !== sized && core !== undefined && glow !== undefined) {
      sized = key
      core.width = Math.max(1, Math.round(width * dpr))
      core.height = Math.max(1, Math.round(height * dpr))
      glow.width = Math.max(1, Math.round(width * GLOW_RES))
      glow.height = Math.max(1, Math.round(height * GLOW_RES))
    }
    return { dpr }
  }

  const paint = (
    canvas: HTMLCanvasElement | undefined,
    res: number,
    path: RibbonPath | null,
    layers: typeof CORE,
  ): void => {
    const ctx = canvas?.getContext('2d')
    if (canvas === undefined || ctx === null || ctx === undefined) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (path === null || path.points.length < 2) return
    const { marks, length } = places(path.points)
    if (length <= 0) return
    const tints = ribbonTint(marks, CROSSING_PX / length)
    const stops = ribbonStops(tints, 1, 0)
    ctx.setTransform(
      res,
      0,
      0,
      res,
      -props.box.left * res,
      -props.box.top * res,
    )
    trace(ctx, path.points)
    const first = path.points[0].x
    const last = path.points[path.points.length - 1].x
    strokeLayers(
      ctx,
      layers,
      stops,
      first,
      last > first ? last : first + 1,
      path.scale,
    )
  }

  const api: EchoRibbonApi = {
    draw: (path) => {
      const { dpr } = size()
      paint(core, dpr, path, CORE)
      paint(glow, GLOW_RES, path, GLOW)
    },
  }

  onMount(() => {
    size()
    props.onReady(api)
  })

  onCleanup(() => {
    sized = ''
  })

  const place = (): JSX.CSSProperties => ({
    left: `${props.box.left}px`,
    top: `${props.box.top}px`,
    width: `${props.box.width}px`,
    height: `${props.box.height}px`,
  })

  return (
    <>
      <canvas
        ref={glow}
        class={styles.canvas}
        style={{
          ...place(),
          filter: `blur(${(GLOW_BLUR_PX * props.scale).toFixed(2)}px)`,
        }}
        aria-hidden="true"
        data-testid="echo-ribbon-glow"
      />
      <canvas
        ref={core}
        class={styles.canvas}
        style={place()}
        aria-hidden="true"
        data-testid="echo-ribbon"
      />
    </>
  )
}
