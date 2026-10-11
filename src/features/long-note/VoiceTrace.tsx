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

type Rgba = readonly [number, number, number, number]

export interface RibbonLayer {
  readonly width: number
  /** Where the light fills. */
  readonly on: Rgba
  /** Where it does not: the same layer in amber. */
  readonly off: Rgba
}

/**
 * The glow, widths in px for a lantern drawn at one px per view unit, drawn
 * under the core and blurred by GLOW_BLUR_PX: a wide faint violet and a
 * blue-cyan band nearer the line. Fitted to the stepped glow it replaces,
 * within about 7 luma from 4 to 24 px off the line (storyboard 2's ribbon
 * glows out to about 15 units a side). The amber's alphas are set so that
 * its brightness off the line matches the cyan's: the same visible width.
 */
export const GLOW: readonly RibbonLayer[] = [
  { width: 28, on: [115, 100, 255, 0.15], off: [255, 118, 72, 0.12] },
  { width: 14, on: [50, 160, 255, 0.95], off: [255, 150, 72, 0.78] },
]

/**
 * The line itself: the cyan core and its bright middle. Off the band the
 * core is a warm amber, the "Not like this" pill's colour, a little dimmer
 * than the cyan rather than a near-white cream.
 */
export const CORE: readonly RibbonLayer[] = [
  { width: 8.5, on: [90, 232, 255, 0.95], off: [255, 188, 108, 0.92] },
  { width: 3, on: [230, 255, 255, 0.9], off: [255, 228, 178, 0.88] },
]

/** The glow's blur, a Gaussian's standard deviation in px at scale 1. */
export const GLOW_BLUR_PX = 4
/** The glow's canvas resolution, px per CSS px: it is blurred anyway. */
const GLOW_RES = 0.5
/** Half the width the colour takes to cross over, px. */
const CROSSING_PX = 5
/** How long the amber takes to ease back to cyan when the line dims, ms. */
const MUTE_MS = 600

/** A drawn sample: its place along the ribbon, 0 to 1, and its state. */
export interface TraceMark {
  readonly at: number
  readonly filling: boolean
}

/** How amber the ribbon is at a place along it: 0 cyan, 1 amber. */
export interface RibbonTint {
  readonly at: number
  readonly off: number
}

/**
 * The ribbon's colour along its length: at each drawn sample, the share of
 * the samples within `half` either side of it (in places along the ribbon)
 * that were off the band. A single change of state crosses over in twice
 * `half`; a stretch that flickers at the band's edge comes out as a blend
 * rather than stripes. Only the samples where the colour bends are kept:
 * the gradient runs straight between them.
 */
export function ribbonTint(
  marks: readonly TraceMark[],
  half: number,
): RibbonTint[] {
  const offBefore = [0]
  for (const mark of marks) {
    offBefore.push(offBefore[offBefore.length - 1] + (mark.filling ? 0 : 1))
  }
  const tints: RibbonTint[] = []
  let lo = 0
  let hi = 0
  for (const mark of marks) {
    while (marks[lo].at < mark.at - half) lo++
    while (hi < marks.length && marks[hi].at <= mark.at + half) hi++
    tints.push({
      at: mark.at,
      off: (offBefore[hi] - offBefore[lo]) / (hi - lo),
    })
  }
  if (tints.length < 3) return tints
  const kept = [tints[0]]
  keepBends(tints, 0, tints.length - 1, kept)
  kept.push(tints[tints.length - 1])
  return kept
}

/** How far the drawn colour may stray from the computed one, as a tint. */
const TINT_SLACK = 1 / 64

/**
 * Push, in order, the tints strictly between `from` and `to` that the
 * colour needs: the one furthest off the straight line between the two,
 * when it is further than TINT_SLACK, and so on either side of it
 * (Douglas-Peucker).
 */
function keepBends(
  tints: readonly RibbonTint[],
  from: number,
  to: number,
  kept: RibbonTint[],
): void {
  const a = tints[from]
  const b = tints[to]
  const span = b.at - a.at
  let worst = -1
  let worstGap = TINT_SLACK
  for (let i = from + 1; i < to; i++) {
    const t = span > 0 ? (tints[i].at - a.at) / span : 0
    const gap = Math.abs(tints[i].off - (a.off + (b.off - a.off) * t))
    if (gap > worstGap) {
      worst = i
      worstGap = gap
    }
  }
  if (worst < 0) return
  keepBends(tints, from, worst, kept)
  kept.push(tints[worst])
  keepBends(tints, worst, to, kept)
}

/** The tint at a place: tints[i - 1] and tints[i] stand either side of it. */
function tintBetween(
  tints: readonly RibbonTint[],
  i: number,
  at: number,
): number {
  if (i <= 0) return tints[0]?.off ?? 0
  if (i >= tints.length) return tints[tints.length - 1].off
  const a = tints[i - 1]
  const b = tints[i]
  return b.at > a.at
    ? a.off + ((b.off - a.off) * (at - a.at)) / (b.at - a.at)
    : b.off
}

/** Steps a layer's colour is mixed in: finer than the eye tells apart. */
const MIX_STEPS = 64

/** Each layer's colours as CSS, by mix and fade step, made once each. */
const PALETTE = new Map<RibbonLayer, Map<number, string>>()

/** A layer's colour at a tint (0 cyan, 1 amber), alpha scaled by `fade`. */
function layerColour(layer: RibbonLayer, off: number, fade: number): string {
  const step = Math.round(off * MIX_STEPS)
  const fadeStep = Math.round(fade * MIX_STEPS)
  let colours = PALETTE.get(layer)
  if (colours === undefined) {
    colours = new Map()
    PALETTE.set(layer, colours)
  }
  const key = step * (MIX_STEPS + 1) + fadeStep
  const known = colours.get(key)
  if (known !== undefined) return known
  const mix = (i: number): number =>
    layer.on[i] + ((layer.off[i] - layer.on[i]) * step) / MIX_STEPS
  const alpha = ((mix(3) * fadeStep) / MIX_STEPS).toFixed(3)
  const colour = `rgba(${Math.round(mix(0))}, ${Math.round(mix(1))}, ${Math.round(mix(2))}, ${alpha})`
  colours.set(key, colour)
  return colour
}

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

/** Where the ribbon's colour and fade change, with both at each place. */
interface RibbonStop {
  readonly at: number
  readonly off: number
  readonly fade: number
}

/**
 * The places the ribbon's colour or fade changes, in order, with both at
 * each: every tint, the ends, and where the fade-in at the old end stops.
 * The amber is scaled by `amber` (1, easing to 0 when the line dims).
 */
function ribbonStopsFor(
  tints: readonly RibbonTint[],
  amber: number,
): RibbonStop[] {
  const stops: RibbonStop[] = []
  let last = -1
  let i = 0
  const add = (place: number): void => {
    const at = Math.min(1, Math.max(0, place))
    if (at <= last) return
    while (i < tints.length && tints[i].at < at) i++
    stops.push({
      at,
      off: tintBetween(tints, i, at) * amber,
      fade: Math.min(1, at / TAIL_FADE),
    })
    last = at
  }
  add(0)
  for (const tint of tints) {
    if (tint.at > TAIL_FADE) add(TAIL_FADE)
    add(tint.at)
  }
  add(TAIL_FADE)
  add(1)
  return stops
}

/**
 * Stroke the path just traced once per layer, faded in at its old end, each
 * layer cyan where the light filled and amber where it did not: one
 * gradient per layer along the ribbon, since time runs left to right.
 */
function strokeLayers(
  ctx: CanvasRenderingContext2D,
  layers: readonly RibbonLayer[],
  stops: readonly RibbonStop[],
  anchor: number,
  scale: number,
): void {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const layer of layers) {
    const gradient = ctx.createLinearGradient(0, 0, anchor, 0)
    for (const stop of stops) {
      gradient.addColorStop(stop.at, layerColour(layer, stop.off, stop.fade))
    }
    ctx.strokeStyle = gradient
    ctx.lineWidth = layer.width * scale
    ctx.stroke()
  }
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
      const stops = ribbonStopsFor(tints, amber())
      strokeLayers(ctx, CORE, stops, anchor, scale)
      if (glowCtx !== null) {
        tracePath(glowCtx, props, y0, anchor)
        strokeLayers(glowCtx, GLOW, stops, anchor, scale)
      }
    }
    ctx.restore()
    glowCtx?.restore()
  }

  /** Still easing the amber away after the line dimmed. */
  const easing = (): boolean => mutedAt !== null && amber() > 0

  const loop = (): void => {
    draw()
    frame = props.active() || easing() ? requestAnimationFrame(loop) : 0
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
    if (props.active() || easing()) {
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
