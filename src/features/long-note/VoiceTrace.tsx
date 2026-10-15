// ============================================================
// VoiceTrace — the target line and the sung line flowing along it
// ============================================================
//
// The voice enters from the left and runs across the lantern to its head
// past the glass, newest point first, so a held note draws a glowing ribbon
// that lies on the target line with small ripples where it wavers
// (storyboard screen 2): a cyan core in a violet glow. Where the light was
// not filling, the hold engine's own band state on that frame, the same
// ribbon is a soft amber, so a stretch off the line looks off.
//
// Each ribbon is two canvases with the same geometry (px from the stage's
// top left): the line itself, a core and its bright middle, over its glow,
// which is drawn small and soft on a canvas of its own and blurred by the
// compositor (one Gaussian, so the glow falls off smoothly instead of in
// rings, and costs the main thread two strokes). Amber and cyan share every
// width, and the amber's glow is set to the cyan's brightness, so the off
// stretch is never the loudest thing on screen. The colour crosses over in
// about 10 px, by the share of frames around each point that were off the
// band, so a voice flickering at the band's edge reads as a blend.
//
// The room draws the ribbon twice, each clipped to its side of the
// chimney's outline:
//
//   outside  over the lantern's frame and the room, as the storyboard has it
//            crossing the frame in front
//   inside   between the liquid and Merc, so in the glass the line passes
//            behind him and never across his face
//
// When the result dims the line, its amber eases back to the cyan first: a
// dimmed amber reads as a brown smear. The tolerance band is not drawn
// here: it lies still behind the lantern.

import type { JSX } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import type { TraceMark } from '@/components/room-kit/ribbon'
import { CORE, CROSSING_PX, GLOW, GLOW_BLUR_PX, GLOW_RES, ribbonStops, ribbonTint, strokeLayers, } from '@/components/room-kit/ribbon'
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
  /** The result dims the line: its amber eases back to cyan. */
  muted?: () => boolean
  /**
   * No animation at all (the fixtures): one still frame, redrawn only when
   * what it shows changes, and a dimmed line is cyan at once.
   */
  still?: boolean
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

/** How long the amber takes to ease back to cyan when the line dims, ms. */
const MUTE_MS = 600

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

/**
 * The voice's path, newest point at the anchor, and the place and band
 * state of every sample it drew, from 0 at the canvas's left to 1 at the
 * anchor. No marks when nothing shows.
 */
function tracePath(
  ctx: CanvasRenderingContext2D,
  props: VoiceTraceProps,
  y0: number,
  anchor: number,
): TraceMark[] {
  const now = props.now()
  const marks: TraceMark[] = []
  let pen = false
  ctx.beginPath()
  for (const sample of props.trace.all()) {
    const age = now - sample.t
    if (age > WINDOW_SEC || age < 0) continue
    if (sample.cents === null) {
      pen = false
      continue
    }
    const cents = Math.max(-MAX_CENTS, Math.min(MAX_CENTS, sample.cents))
    const at = 1 - age / WINDOW_SEC
    const y = y0 - cents * TRACE_PX_PER_CENT
    if (pen) ctx.lineTo(at * anchor, y)
    else ctx.moveTo(at * anchor, y)
    pen = true
    marks.push({ at, filling: sample.filling })
  }
  return marks
}

/** A canvas and the px it is drawn in per CSS px. */
interface Surface {
  canvas: HTMLCanvasElement | undefined
  /** Backing px per CSS px. */
  ratio: number
}

function fit(
  surface: Surface,
  density: number,
): { width: number; height: number } {
  const canvas = surface.canvas
  if (canvas === undefined) return { width: 0, height: 0 }
  surface.ratio = density
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = Math.max(1, Math.round(width * density))
  canvas.height = Math.max(1, Math.round(height * density))
  return { width, height }
}

/** A surface cleared and clipped to its region, ready to draw on; or null. */
function begin(
  surface: Surface,
  props: VoiceTraceProps,
  size: { width: number; height: number },
): CanvasRenderingContext2D | null {
  const ctx = surface.canvas?.getContext('2d')
  if (ctx === null || ctx === undefined) return null
  ctx.setTransform(surface.ratio, 0, 0, surface.ratio, 0, 0)
  ctx.clearRect(0, 0, size.width, size.height)
  ctx.save()
  clipToRegion(ctx, props.region, props.lantern(), size)
  return ctx
}

export function VoiceTrace(props: VoiceTraceProps): JSX.Element {
  const line: Surface = { canvas: undefined, ratio: 1 }
  const glow: Surface = { canvas: undefined, ratio: GLOW_RES }
  let frame = 0
  let size = { width: 0, height: 0 }
  /** When the line was dimmed (performance.now), or null. */
  let mutedAt: number | null = null

  const resize = (): void => {
    size = fit(line, Math.min(3, window.devicePixelRatio || 1))
    fit(glow, GLOW_RES)
  }

  /** How much of the amber still shows: 1, easing to 0 once dimmed. */
  const amber = (): number => {
    if (mutedAt === null) return 1
    if (props.still === true) return 0
    return Math.max(0, 1 - (performance.now() - mutedAt) / MUTE_MS)
  }

  const draw = (): void => {
    const ctx = begin(line, props, size)
    if (ctx === null) return
    const y0 = props.lineY()
    ctx.strokeStyle = 'rgba(150, 205, 255, 0.6)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, y0)
    ctx.lineTo(size.width, y0)
    ctx.stroke()
    const anchor = props.anchorX()
    const marks = anchor > 0 ? tracePath(ctx, props, y0, anchor) : []
    const glowCtx = begin(glow, props, size)
    if (marks.length > 0) {
      const scale = ribbonScale(props.lantern().k)
      const tints = ribbonTint(marks, CROSSING_PX / anchor)
      const stops = ribbonStops(tints, amber(), TAIL_FADE)
      strokeLayers(ctx, CORE, stops, 0, anchor, scale)
      if (glowCtx !== null) {
        tracePath(glowCtx, props, y0, anchor)
        strokeLayers(glowCtx, GLOW, stops, 0, anchor, scale)
      }
    }
    ctx.restore()
    glowCtx?.restore()
  }

  /** Still easing the amber away after the line dimmed. */
  const easing = (): boolean => mutedAt !== null && amber() > 0
  /** Drawing frame after frame: the take, or the amber easing away. */
  const running = (): boolean =>
    props.still !== true && (props.active() || easing())

  const loop = (): void => {
    draw()
    frame = running() ? requestAnimationFrame(loop) : 0
  }

  onMount(() => {
    resize()
    const observer = new ResizeObserver(() => {
      resize()
      draw()
    })
    if (line.canvas !== undefined) observer.observe(line.canvas)
    onCleanup(() => {
      observer.disconnect()
    })
  })

  createEffect(() => {
    const dimmed = props.muted?.() === true
    if (dimmed && mutedAt === null) mutedAt = performance.now()
    if (!dimmed) mutedAt = null
    if (running()) {
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

  const testId = (): string => props.testId ?? 'long-note-trace'
  return (
    <>
      <canvas
        ref={(canvas) => {
          glow.canvas = canvas
        }}
        class={props.class}
        style={{
          ...props.style,
          filter: `blur(${(GLOW_BLUR_PX * ribbonScale(props.lantern().k)).toFixed(2)}px)`,
        }}
        aria-hidden="true"
        data-testid={`${testId()}-glow`}
      />
      <canvas
        ref={(canvas) => {
          line.canvas = canvas
        }}
        class={props.class}
        style={props.style}
        aria-hidden="true"
        data-testid={testId()}
      />
    </>
  )
}
