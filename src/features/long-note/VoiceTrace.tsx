// ============================================================
// VoiceTrace — the target line and the sung line flowing along it
// ============================================================
//
// The voice enters from the left and runs across the lantern to its head
// past the glass, newest point first, so a held note draws a glowing ribbon
// that lies on the target line with small ripples where it wavers
// (storyboard screen 2): a cyan core in a violet glow.
//
// The room draws it twice, on two canvases with the same geometry (px from
// the stage's top left), each clipped to its side of the chimney's outline:
//
//   outside  over the lantern's frame and the room, as the storyboard has it
//            crossing the frame in front
//   inside   between the liquid and Merc, so in the glass the line passes
//            behind him and never across his face
//
// The tolerance band is not drawn here: it lies still behind the lantern.

import type { JSX } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import { traceChimney } from './lantern-geometry'
import type { VoiceTraceBuffer } from './voice-trace-buffer'

/** Where the lantern's view box sits in the stage: px per unit, offset px. */
export interface TraceLantern {
  k: number
  left: number
  top: number
}

export interface VoiceTraceProps {
  trace: VoiceTraceBuffer
  /** The session clock, seconds. */
  now: () => number
  /** Where the line runs, px from the canvas top. */
  lineY: () => number
  /** Where the newest point lands, px from the canvas left. */
  anchorX: () => number
  /** The lantern's box, for the chimney's outline. */
  lantern: () => TraceLantern
  /** Which side of the chimney's outline this canvas draws. */
  region: 'inside' | 'outside'
  /** Draw while true; a still frame otherwise. */
  active: () => boolean
  class?: string
  style?: JSX.CSSProperties
  testId?: string
}

/** Seconds of voice drawn between the left edge and the head. */
const WINDOW_SEC = 4
/** Vertical scale: how far a cent moves the line. */
export const TRACE_PX_PER_CENT = 0.32
const MAX_CENTS = 160
/** The fade-in at the trace's old end, as a share of its length. */
const TAIL_FADE = 0.12

/**
 * The ribbon, widest stroke first, widths in px for a lantern drawn at one
 * px per view unit: a glow in six steps, violet outside and blue-cyan near
 * the line, then the cyan core and its bright middle. Storyboard 2's ribbon
 * is 9 units across above L 150 and 16 above L 70, and its glow falls off
 * over about 15 units a side.
 */
const RIBBON = [
  { width: 40, color: '120, 96, 255', alpha: 0.05 },
  { width: 32, color: '120, 96, 255', alpha: 0.09 },
  { width: 26, color: '96, 110, 255', alpha: 0.12 },
  { width: 21, color: '96, 110, 255', alpha: 0.2 },
  { width: 16, color: '64, 140, 255', alpha: 0.36 },
  { width: 12, color: '40, 170, 255', alpha: 0.6 },
  { width: 8.5, color: '90, 232, 255', alpha: 0.95 },
  { width: 3, color: '230, 255, 255', alpha: 0.9 },
] as const

/** The ribbon's scale on this lantern, kept readable on a small one. */
const ribbonScale = (k: number): number => Math.min(1.25, Math.max(0.6, k))

/** Clip the context to this canvas's side of the chimney's outline. */
function clipToRegion(
  ctx: CanvasRenderingContext2D,
  region: 'inside' | 'outside',
  lantern: TraceLantern,
  size: { width: number; height: number },
): void {
  ctx.beginPath()
  if (region === 'outside') ctx.rect(0, 0, size.width, size.height)
  ctx.save()
  ctx.translate(lantern.left, lantern.top)
  ctx.scale(lantern.k, lantern.k)
  traceChimney(ctx)
  ctx.restore()
  ctx.clip(region === 'outside' ? 'evenodd' : 'nonzero')
}

/** The voice's path, newest point at the anchor; false when nothing shows. */
function tracePath(
  ctx: CanvasRenderingContext2D,
  props: VoiceTraceProps,
  y0: number,
  anchor: number,
): boolean {
  const now = props.now()
  let pen = false
  let drawn = false
  ctx.beginPath()
  for (const sample of props.trace.all()) {
    const age = now - sample.t
    if (age > WINDOW_SEC || age < 0) continue
    if (sample.cents === null) {
      pen = false
      continue
    }
    const cents = Math.max(-MAX_CENTS, Math.min(MAX_CENTS, sample.cents))
    const x = anchor - (age / WINDOW_SEC) * anchor
    const y = y0 - cents * TRACE_PX_PER_CENT
    if (pen) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
    pen = true
    drawn = true
  }
  return drawn
}

/** The ribbon over the path just traced, faded in at its old end. */
function strokeRibbon(
  ctx: CanvasRenderingContext2D,
  anchor: number,
  scale: number,
): void {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const layer of RIBBON) {
    const gradient = ctx.createLinearGradient(0, 0, anchor, 0)
    gradient.addColorStop(0, `rgba(${layer.color}, 0)`)
    gradient.addColorStop(TAIL_FADE, `rgba(${layer.color}, ${layer.alpha})`)
    gradient.addColorStop(1, `rgba(${layer.color}, ${layer.alpha})`)
    ctx.strokeStyle = gradient
    ctx.lineWidth = layer.width * scale
    ctx.stroke()
  }
}

export function VoiceTrace(props: VoiceTraceProps): JSX.Element {
  let canvas: HTMLCanvasElement | undefined
  let frame = 0
  const size = { width: 0, height: 0 }
  let ratio = 1

  const resize = (): void => {
    if (canvas === undefined) return
    ratio = Math.min(3, window.devicePixelRatio || 1)
    size.width = canvas.clientWidth
    size.height = canvas.clientHeight
    canvas.width = Math.max(1, Math.round(size.width * ratio))
    canvas.height = Math.max(1, Math.round(size.height * ratio))
  }

  const draw = (): void => {
    const ctx = canvas?.getContext('2d')
    if (ctx === null || ctx === undefined) return
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, size.width, size.height)
    const lantern = props.lantern()
    ctx.save()
    clipToRegion(ctx, props.region, lantern, size)
    const y0 = props.lineY()
    ctx.strokeStyle = 'rgba(150, 205, 255, 0.6)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, y0)
    ctx.lineTo(size.width, y0)
    ctx.stroke()
    const anchor = props.anchorX()
    if (anchor > 0 && tracePath(ctx, props, y0, anchor)) {
      strokeRibbon(ctx, anchor, ribbonScale(lantern.k))
    }
    ctx.restore()
  }

  const loop = (): void => {
    draw()
    frame = props.active() ? requestAnimationFrame(loop) : 0
  }

  onMount(() => {
    resize()
    const observer = new ResizeObserver(() => {
      resize()
      draw()
    })
    if (canvas !== undefined) observer.observe(canvas)
    onCleanup(() => {
      observer.disconnect()
    })
  })

  createEffect(() => {
    if (props.active()) {
      if (frame === 0) frame = requestAnimationFrame(loop)
    } else {
      // One last frame, so the line the singer just drew stays put.
      draw()
    }
  })

  onCleanup(() => {
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
  })

  return (
    <canvas
      ref={canvas}
      class={props.class}
      style={props.style}
      aria-hidden="true"
      data-testid={props.testId ?? 'long-note-trace'}
    />
  )
}
