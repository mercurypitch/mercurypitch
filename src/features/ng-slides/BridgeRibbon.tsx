// ============================================================
// BridgeRibbon: the voice, flowing in from the left to the playhead
// ============================================================
//
// The shared ribbon (src/components/room-kit/ribbon.ts: one look in every
// room): a cyan core with a bright middle over a violet glow where the
// voice is on the path, amber where it is off (DESIGN-ng-slides.md 1).
// On the bridge it is drawn where the voice was sung, so it scrolls away
// with the bridge, and it breaks where the voice stopped.
//
// Two canvases over the room, fixed to the screen: the core at the
// screen's DPR, the glow small and blurred by the compositor (GLOW_RES,
// GLOW_BLUR_PX), as Echo and Long note draw it. The scene hands in the
// strokes on screen each frame (`draw`); nothing here keeps time.

import type { JSX } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import type { TraceMark } from '@/components/room-kit/ribbon'
import { CORE, CROSSING_PX, GLOW, GLOW_BLUR_PX, GLOW_RES, ribbonStops, ribbonTint, strokeLayers, } from '@/components/room-kit/ribbon'
import styles from './NgSlidesRoom.module.css'

/** One point of a stroke, px in the room's box. */
export interface StrokePoint {
  readonly x: number
  readonly y: number
  readonly filling: boolean
}

export interface BridgeRibbonApi {
  /** Draw these strokes (each one unbroken voice), or clear with []. */
  draw: (strokes: readonly (readonly StrokePoint[])[], scale: number) => void
}

export interface BridgeRibbonProps {
  width: number
  height: number
  /** The glow's blur scale: the room's width over the storyboard's. */
  scale: number
  onReady: (api: BridgeRibbonApi) => void
}

/** Each point's place along its stroke, 0 to 1, by length. */
function places(points: readonly StrokePoint[]): {
  marks: TraceMark[]
  length: number
} {
  let length = 0
  const lengths = [0]
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    )
    lengths.push(length)
  }
  return {
    marks: points.map((p, i) => ({
      at: length > 0 ? lengths[i] / length : 0,
      filling: p.filling,
    })),
    length,
  }
}

/** The stroke through its points, smoothed through their midpoints. */
function trace(
  ctx: CanvasRenderingContext2D,
  points: readonly StrokePoint[],
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

function paint(
  canvas: HTMLCanvasElement | undefined,
  res: number,
  strokes: readonly (readonly StrokePoint[])[],
  layers: typeof CORE,
  scale: number,
): void {
  const ctx = canvas?.getContext('2d')
  if (canvas === undefined || ctx === null || ctx === undefined) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.setTransform(res, 0, 0, res, 0, 0)
  for (const points of strokes) {
    if (points.length < 2) continue
    const { marks, length } = places(points)
    if (length <= 0) continue
    const stops = ribbonStops(ribbonTint(marks, CROSSING_PX / length), 1, 0)
    trace(ctx, points)
    const first = points[0].x
    const last = points[points.length - 1].x
    strokeLayers(
      ctx,
      layers,
      stops,
      first,
      last > first ? last : first + 1,
      scale,
    )
  }
}

export function BridgeRibbon(props: BridgeRibbonProps): JSX.Element {
  let core: HTMLCanvasElement | undefined
  let glow: HTMLCanvasElement | undefined
  let sized = ''

  const size = (): number => {
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const key = `${props.width}x${props.height}@${dpr}`
    if (key !== sized && core !== undefined && glow !== undefined) {
      sized = key
      core.width = Math.max(1, Math.round(props.width * dpr))
      core.height = Math.max(1, Math.round(props.height * dpr))
      glow.width = Math.max(1, Math.round(props.width * GLOW_RES))
      glow.height = Math.max(1, Math.round(props.height * GLOW_RES))
    }
    return dpr
  }

  const api: BridgeRibbonApi = {
    draw: (strokes, scale) => {
      const dpr = size()
      paint(core, dpr, strokes, CORE, scale)
      paint(glow, GLOW_RES, strokes, GLOW, scale)
    },
  }

  onMount(() => {
    size()
    props.onReady(api)
  })
  onCleanup(() => {
    sized = ''
  })

  const box = (): JSX.CSSProperties => ({
    width: `${props.width}px`,
    height: `${props.height}px`,
  })

  return (
    <>
      <canvas
        ref={glow}
        class={styles.ribbon}
        style={{
          ...box(),
          filter: `blur(${(GLOW_BLUR_PX * props.scale).toFixed(2)}px)`,
        }}
        aria-hidden="true"
        data-testid="ng-ribbon-glow"
      />
      <canvas
        ref={core}
        class={styles.ribbon}
        style={box()}
        aria-hidden="true"
        data-testid="ng-ribbon"
      />
    </>
  )
}
