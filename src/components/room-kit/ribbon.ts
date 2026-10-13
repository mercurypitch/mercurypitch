// ============================================================
// The voice ribbon: the shared mark a premium room draws a voice with
// ============================================================
//
// One look in every room (owner, 12 Oct 2026: keep the shared ribbon): a
// cyan core with a bright middle over a violet glow where the voice is on
// its note, and the same widths in amber where it is off. Long note draws
// it along the target line (VoiceTrace.tsx), Echo from the last lit star
// to the note being sung (EchoRibbon.tsx). This module holds the drawing
// rules only: the layers, how the colour crosses over along the ribbon,
// and the strokes. Each room traces its own path.
//
// The glow goes on a canvas of its own at GLOW_RES and is blurred by the
// compositor (one Gaussian of GLOW_BLUR_PX at scale 1), so it falls off
// smoothly and costs the main thread two strokes.

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
export const GLOW_RES = 0.5
/** Half the width the colour takes to cross over, px. */
export const CROSSING_PX = 5

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
export function layerColour(
  layer: RibbonLayer,
  off: number,
  fade: number,
): string {
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

/** Where the ribbon's colour and fade change, with both at each place. */
export interface RibbonStop {
  readonly at: number
  readonly off: number
  readonly fade: number
}

/**
 * The places the ribbon's colour or fade changes, in order, with both at
 * each: every tint, the ends, and where the fade-in at the old end stops
 * (`tailFade`, a share of the ribbon's length; 0 for none). The amber is
 * scaled by `amber` (1, easing to 0 when the line dims).
 */
export function ribbonStops(
  tints: readonly RibbonTint[],
  amber: number,
  tailFade: number,
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
      fade: tailFade > 0 ? Math.min(1, at / tailFade) : 1,
    })
    last = at
  }
  add(0)
  for (const tint of tints) {
    if (tint.at > tailFade) add(tailFade)
    add(tint.at)
  }
  add(tailFade)
  add(1)
  return stops
}

/**
 * Stroke the path just traced once per layer, faded in at its old end, each
 * layer cyan where the light filled and amber where it did not: one
 * gradient per layer along the ribbon, which runs left to right from
 * `fromX` (place 0) to `toX` (place 1).
 */
export function strokeLayers(
  ctx: CanvasRenderingContext2D,
  layers: readonly RibbonLayer[],
  stops: readonly RibbonStop[],
  fromX: number,
  toX: number,
  scale: number,
): void {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const layer of layers) {
    const gradient = ctx.createLinearGradient(fromX, 0, toX, 0)
    for (const stop of stops) {
      gradient.addColorStop(stop.at, layerColour(layer, stop.off, stop.fade))
    }
    ctx.strokeStyle = gradient
    ctx.lineWidth = layer.width * scale
    ctx.stroke()
  }
}
