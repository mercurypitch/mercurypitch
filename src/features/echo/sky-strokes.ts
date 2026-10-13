// ============================================================
// Sky strokes: Echo's rings and lines as gradients, from their measured profiles
// ============================================================
//
// A0 measured each ring and line on the storyboard as layers (STROKES in
// echo-geometry.ts): a thin core, a wide soft glow, and for a ring a light
// that falls off inward from its edge. Each layer is a stroke blurred by a
// Gaussian, composited over the sky in sRGB (A0's tools/a0lib.py
// stroke_cov). A blur filter on every ring and line would cost a filter
// pass each time the sky repaints, so the soft layers are drawn as
// gradients instead: a ring's glow and inner light depend only on the
// distance from its centre (one radial gradient), a line's glow only on the
// distance across it (one linear gradient across a band). The cores go into
// the same gradients, sampled finely across their width: drawn as plain
// strokes, the browser's hard edge made them brighter and thinner than the
// storyboard's (the PR 3 fixtures: ring peaks 3 to 4 dE00 over, half-height
// widths 5 % under), and the rings and finished lines failed the measures
// the art's own mock passes.
//
// Pure: widths in px come in, gradient stops go out.

import type { StrokeLayer, StrokeStyle } from './echo-geometry'

export interface GradientStop {
  /** 0 to 1 along the gradient. */
  readonly offset: number
  /** CSS colour, alpha included. */
  readonly colour: string
}

/** Abramowitz and Stegun 7.1.26: erf within 1.5e-7. */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const poly =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return sign * (1 - poly * Math.exp(-a * a))
}

/**
 * How much of a stroke `width` wide, blurred by a Gaussian of `sigma`,
 * covers a point `d` from its centre line (a box convolved with the
 * Gaussian, as A0 measured it).
 */
export function strokeCoverage(
  d: number,
  width: number,
  sigma: number,
): number {
  const s = Math.max(sigma, 1e-3) * Math.SQRT2
  const half = width / 2
  const c = 0.5 * (erf((half - d) / s) + erf((half + d) / s))
  return Math.min(1, Math.max(0, c))
}

/** A layer's colour, sRGB 0 to 255, and its alpha. */
interface Paint {
  readonly rgb: readonly number[]
  readonly alpha: number
}

/** `top` over `bottom`, as the browser composites them. */
function over(top: Paint, bottom: Paint): Paint {
  const alpha = top.alpha + bottom.alpha * (1 - top.alpha)
  if (alpha <= 0) return { rgb: top.rgb, alpha: 0 }
  const rgb = [0, 1, 2].map(
    (i) =>
      (top.rgb[i] * top.alpha +
        bottom.rgb[i] * bottom.alpha * (1 - top.alpha)) /
      alpha,
  )
  return { rgb, alpha }
}

function css(paint: Paint): string {
  const [r, g, b] = paint.rgb.map((c) =>
    Math.round(Math.min(255, Math.max(0, c))),
  )
  return `rgba(${r}, ${g}, ${b}, ${paint.alpha.toFixed(4)})`
}

/** Samples across a gradient's soft layers: a smooth fall-off to the eye. */
const SAMPLES = 40
/** Across a core, a sample every this many px: a core is 1 to 2 px wide. */
export const CORE_STEP_PX = 0.1
/** How far a core reaches past its half width, in its sigmas. */
const CORE_REACH_SIGMAS = 4
/**
 * The least blur a core is drawn with, px: a gradient is read at each
 * device pixel's centre, so a sharper profile would bead at DPR 2.
 */
export const CORE_SIGMA_MIN_PX = 0.3

/** A layer's px widths, from W units at `unit` px per W. */
function layerPx(layer: StrokeLayer, unit: number) {
  return { width: layer.widthW * unit, sigma: layer.sigmaW * unit }
}

/** A core's px widths: its blur kept at CORE_SIGMA_MIN_PX or more. */
function corePx(layer: StrokeLayer, unit: number) {
  const px = layerPx(layer, unit)
  return { width: px.width, sigma: Math.max(CORE_SIGMA_MIN_PX, px.sigma) }
}

/**
 * Where a gradient samples, px from its start, `length` long: evenly over
 * the whole length, and every CORE_STEP_PX across the core centred at
 * `centre`.
 */
function samplePoints(
  length: number,
  centre: number,
  core: { readonly width: number; readonly sigma: number },
): number[] {
  const even = Array.from(
    { length: SAMPLES + 1 },
    (_, i) => (length * i) / SAMPLES,
  )
  const reach = core.width / 2 + CORE_REACH_SIGMAS * core.sigma
  const from = Math.max(0, centre - reach)
  const to = Math.min(length, centre + reach)
  const fine: number[] = []
  for (let x = from; x <= to; x += CORE_STEP_PX) fine.push(x)
  return [...even, ...fine]
    .sort((a, b) => a - b)
    .filter((x, i, all) => i === 0 || x - all[i - 1] > 1e-6)
}

/** A layer `d` px from its centre line: its colour and its coverage there. */
function layerAt(
  layer: StrokeLayer,
  px: { readonly width: number; readonly sigma: number },
  d: number,
): Paint {
  return {
    rgb: layer.rgb,
    alpha: layer.opacity * strokeCoverage(d, px.width, px.sigma),
  }
}

export interface RingGradient {
  /** The gradient's circle: the ring's radius plus its glow's reach, px. */
  readonly outer: number
  /** From the centre (0) to `outer` (1). */
  readonly stops: readonly GradientStop[]
}

/**
 * A ring of `radius` px as one radial gradient: its inner light, its glow
 * over that, and its core over both.
 */
export function ringGradient(
  style: StrokeStyle,
  radius: number,
  unit: number,
): RingGradient {
  const glow = layerPx(style.glow, unit)
  const core = corePx(style.core, unit)
  const outer = Math.max(
    radius + glow.width / 2 + 3 * glow.sigma,
    radius + core.width / 2 + CORE_REACH_SIGMAS * core.sigma,
  )
  const fill = style.fill
  const stops = samplePoints(outer, radius, core).map((r) => {
    const d = r - radius
    const inner: Paint =
      fill === null || d > 0
        ? { rgb: [0, 0, 0], alpha: 0 }
        : {
            rgb: fill.rgb,
            alpha: fill.opacity * Math.exp(d / (fill.lambdaW * unit)),
          }
    const lit = over(
      layerAt(style.core, core, d),
      over(layerAt(style.glow, glow, d), inner),
    )
    return { offset: r / outer, colour: css(lit) }
  })
  return { outer, stops }
}

export interface LineGradient {
  /** Half the band's height, px: the glow reaches this far either side. */
  readonly half: number
  /** Across the band, top (0) to bottom (1). */
  readonly stops: readonly GradientStop[]
}

/** A line as a band across it: its glow, and its core over that. */
export function lineGradient(style: StrokeStyle, unit: number): LineGradient {
  const glow = layerPx(style.glow, unit)
  const core = corePx(style.core, unit)
  const half = Math.max(
    glow.width / 2 + 3 * glow.sigma,
    core.width / 2 + CORE_REACH_SIGMAS * core.sigma,
  )
  const stops = samplePoints(2 * half, half, core).map((x) => {
    const d = x - half
    const lit = over(layerAt(style.core, core, d), layerAt(style.glow, glow, d))
    return { offset: x / (2 * half), colour: css(lit) }
  })
  return { half, stops }
}
