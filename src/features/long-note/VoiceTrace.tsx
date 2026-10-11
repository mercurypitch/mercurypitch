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

type Rgba = readonly [number, number, number, number]

interface RibbonLayer {
  readonly width: number
  /** Where the light fills. */
  readonly on: Rgba
  /** Where it does not: the same layer in amber. */
  readonly off: Rgba
}

/**
 * The ribbon, widest stroke first, widths in px for a lantern drawn at one
 * px per view unit: a glow in six steps, violet outside and blue-cyan near
 * the line, then the cyan core and its bright middle. Storyboard 2's ribbon
 * is 9 units across above L 150 and 16 above L 70, and its glow falls off
 * over about 15 units a side. Off the line every layer turns a soft amber,
 * the "Not like this" pill's colour, its glow a little fainter.
 */
const RIBBON: readonly RibbonLayer[] = [
  { width: 40, on: [120, 96, 255, 0.05], off: [255, 128, 64, 0.04] },
  { width: 32, on: [120, 96, 255, 0.09], off: [255, 128, 64, 0.07] },
  { width: 26, on: [96, 110, 255, 0.12], off: [255, 146, 72, 0.1] },
  { width: 21, on: [96, 110, 255, 0.2], off: [255, 146, 72, 0.16] },
  { width: 16, on: [64, 140, 255, 0.36], off: [255, 166, 84, 0.3] },
  { width: 12, on: [40, 170, 255, 0.6], off: [255, 184, 100, 0.52] },
  { width: 8.5, on: [90, 232, 255, 0.95], off: [255, 207, 133, 0.9] },
  { width: 3, on: [230, 255, 255, 0.9], off: [255, 244, 222, 0.85] },
]

/** How far the colour takes to cross over at a change of band state, px. */
const CROSSING_PX = 5

/**
 * A stretch of the ribbon in one band state: the places along it, 0 to 1,
 * of its first and last drawn samples.
 */
export interface TraceRun {
  readonly first: number
  readonly last: number
  readonly filling: boolean
}

/** How amber the ribbon is at a place along it: 0 cyan, 1 amber. */
export interface RibbonTint {
  readonly at: number
  readonly off: number
}

/**
 * The ribbon's colour along its length: each run of one band state holds its
 * colour to `crossing` short of where it meets the next run, the change half
 * way between their samples, so the colour crosses over in `crossing` either
 * side of it. The ends of the ribbon keep their runs' colours.
 */
export function ribbonTint(
  runs: readonly TraceRun[],
  crossing: number,
): RibbonTint[] {
  return runs.flatMap((run, i) => {
    const from = i === 0 ? 0 : (runs[i - 1].last + run.first) / 2
    const to = i === runs.length - 1 ? 1 : (run.last + runs[i + 1].first) / 2
    const inset = Math.min(crossing, (to - from) / 2)
    const off = run.filling ? 0 : 1
    return [
      { at: from + inset, off },
      { at: to - inset, off },
    ]
  })
}

/** The tint at a place, between the tints either side of it. */
function tintAt(tints: readonly RibbonTint[], at: number): number {
  if (tints.length === 0 || at <= tints[0].at) return tints[0]?.off ?? 0
  for (let i = 1; i < tints.length; i++) {
    const b = tints[i]
    if (at > b.at) continue
    const a = tints[i - 1]
    return b.at > a.at
      ? a.off + ((b.off - a.off) * (at - a.at)) / (b.at - a.at)
      : b.off
  }
  return tints[tints.length - 1].off
}

/** Every place the ribbon's colour or fade changes, in order. */
function ribbonStops(tints: readonly RibbonTint[]): number[] {
  const at = [0, TAIL_FADE, 1, ...tints.map((tint) => tint.at)]
  return [...new Set(at.map((x) => Math.min(1, Math.max(0, x))))].sort(
    (a, b) => a - b,
  )
}

/** A colour as CSS, its alpha scaled by `fade`. */
function css(colour: Rgba, fade: number): string {
  const [r, g, b, a] = colour
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${(a * fade).toFixed(3)})`
}

/** Each layer in cyan and in amber at full strength: most stops are these. */
const SOLID = RIBBON.map((layer) => [css(layer.on, 1), css(layer.off, 1)])

/** One layer's colour at a tint, as a CSS colour faded by `fade`. */
function layerColour(index: number, off: number, fade: number): string {
  if (fade === 1 && (off === 0 || off === 1)) return SOLID[index][off]
  const { on, off: amber } = RIBBON[index]
  const mix = (i: number): number => on[i] + (amber[i] - on[i]) * off
  return css([mix(0), mix(1), mix(2), mix(3)], fade)
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

/** A drawn sample joins the last run, or starts one at a change of state. */
function extendRuns(
  runs: { first: number; last: number; readonly filling: boolean }[],
  at: number,
  filling: boolean,
): void {
  const run = runs.at(-1)
  if (run?.filling === filling) run.last = at
  else runs.push({ first: at, last: at, filling })
}

/**
 * The voice's path, newest point at the anchor, and its runs of one band
 * state, placed along it from 0 at the canvas's left to 1 at the anchor.
 * No runs when nothing shows.
 */
function tracePath(
  ctx: CanvasRenderingContext2D,
  props: VoiceTraceProps,
  y0: number,
  anchor: number,
): TraceRun[] {
  const now = props.now()
  const runs: { first: number; last: number; readonly filling: boolean }[] = []
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
    extendRuns(runs, at, sample.filling)
  }
  return runs
}

/**
 * The ribbon over the path just traced, faded in at its old end, cyan where
 * the light filled and amber where it did not: one gradient per layer along
 * the ribbon, since time runs left to right across it.
 */
function strokeRibbon(
  ctx: CanvasRenderingContext2D,
  anchor: number,
  scale: number,
  runs: readonly TraceRun[],
): void {
  const tints = ribbonTint(runs, CROSSING_PX / anchor)
  // The first and last tints stand where the colour holds still already.
  const stops = ribbonStops(tints.slice(1, -1)).map((at) => ({
    at,
    off: tintAt(tints, at),
    fade: Math.min(1, at / TAIL_FADE),
  }))
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  RIBBON.forEach((layer, index) => {
    const gradient = ctx.createLinearGradient(0, 0, anchor, 0)
    for (const stop of stops) {
      gradient.addColorStop(stop.at, layerColour(index, stop.off, stop.fade))
    }
    ctx.strokeStyle = gradient
    ctx.lineWidth = layer.width * scale
    ctx.stroke()
  })
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
    const runs = anchor > 0 ? tracePath(ctx, props, y0, anchor) : []
    if (runs.length > 0) {
      strokeRibbon(ctx, anchor, ribbonScale(lantern.k), runs)
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
