// ============================================================
// Voice ribbon — three mirrored lobes that breathe with the voice
// ============================================================
//
// The mic check's main visual: a ribbon of three translucent, mirrored lobes.
// Its height follows the voice's level, and its two halves answer different
// bands — the top the body of the voice (350-2600 Hz), the bottom its low
// end — so a hum and a bright vowel at the same level look different. Each
// layer wanders on a phase of its own, which keeps the ribbon alive on a
// steady note, and while a note is held the lobes lean towards that note's
// key on the strip below, so the shape points at what was sung.
//
// `stepRibbonMotion` turns raw levels into the smoothed numbers the drawing
// reads: fast attack, slower release, so a syllable blooms and settles
// instead of flickering. `drawRibbon` paints one frame. Canvas antialiasing is
// the only softening — no blur and no shadows, which keeps it inside a
// phone's frame budget.

import { SIGNAL_FLOOR_RMS } from '@/lib/input-health'

/** Input gain for the ribbon's size. The capture runs with AGC off, so a
 *  voice at arm's length reads quiet; this puts normal singing mid-height. */
const SENSITIVITY = 2.4
/** 0..1. Higher is slower to rise and to settle. */
const FLUIDITY = 0.7
/** Levels between the noise floor and this far above it fade the ribbon in,
 *  rather than switching it on at the floor. */
const GATE_SPAN_RMS = 0.012
/** How far each lobe layer sits from the others, in ribbon widths. */
const LAYER_SPREAD = 0.13
/** How strongly a held note pulls the lobes towards its key. */
const LEAN_STRENGTH = 0.8
/** Points along each edge of a lobe. */
const EDGE_STEPS = 110
/** Below this the ribbon is drawn as its resting line. */
export const RIBBON_REST_ENERGY = 0.004

const clamp = (n: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, n))

/** Exponential approach, with separate rise and fall time constants. */
const smooth = (
  value: number,
  target: number,
  dt: number,
  rise: number,
  fall: number,
): number =>
  value +
  (target - value) * (1 - Math.exp(-dt / (target > value ? rise : fall)))

export interface RibbonLevels {
  /** Linear RMS of the latest buffer. */
  rms: number
  /** Largest absolute sample in it. */
  peak: number
  /** Band levels, 0..1 (see `bandLevel`). */
  low: number
  mid: number
  high: number
}

export interface RibbonMotion {
  energy: number
  low: number
  mid: number
  high: number
  transient: number
  previousRms: number
  phase: number
  /** Where the lobes lean, -1..1 across the ribbon. */
  lean: number
  /** How much they lean there, 0..1. */
  leanWeight: number
}

export const createRibbonMotion = (): RibbonMotion => ({
  energy: 0,
  low: 0,
  mid: 0,
  high: 0,
  transient: 0,
  previousRms: 0,
  phase: 1.8,
  lean: 0,
  leanWeight: 0,
})

/**
 * Average level of the bins between two frequencies, 0..1, from
 * `AnalyserNode.getByteFrequencyData`.
 */
export function bandLevel(
  spectrum: Uint8Array,
  sampleRate: number,
  fftSize: number,
  lowHz: number,
  highHz: number,
): number {
  if (spectrum.length === 0 || sampleRate <= 0 || fftSize <= 0) return 0
  const binHz = sampleRate / fftSize
  const start = Math.max(1, Math.floor(lowHz / binHz))
  const end = Math.min(spectrum.length - 1, Math.ceil(highHz / binHz))
  if (end < start) return 0
  let sum = 0
  for (let i = start; i <= end; i++) sum += spectrum[i] / 255
  return sum / (end - start + 1)
}

/**
 * Advance the motion by `dt` seconds. `focus` is where a held note sits on
 * the ribbon (-1..1), or null when nothing is held.
 */
export function stepRibbonMotion(
  motion: RibbonMotion,
  levels: RibbonLevels,
  dt: number,
  focus: number | null,
): void {
  const gate = clamp((levels.rms - SIGNAL_FLOOR_RMS) / GATE_SPAN_RMS)
  const target = clamp(
    Math.pow(levels.rms * SENSITIVITY * 4.1, 0.78) * gate +
      Math.min(0.11, levels.peak * 0.09) * gate,
  )
  motion.transient = smooth(
    motion.transient,
    clamp((levels.rms - motion.previousRms) * 8) * gate,
    dt,
    0.018,
    0.14,
  )
  motion.previousRms = levels.rms
  motion.energy = smooth(
    motion.energy,
    target,
    dt,
    0.025 + FLUIDITY * 0.025,
    0.075 + FLUIDITY * 0.15,
  )
  motion.low = smooth(motion.low, levels.low * gate, dt, 0.045, 0.17)
  motion.mid = smooth(motion.mid, levels.mid * gate, dt, 0.035, 0.14)
  motion.high = smooth(motion.high, levels.high * gate, dt, 0.025, 0.12)
  // Unwrapped on purpose: the layers read it at non-integer multiples, so
  // folding it back into one turn would jump every lobe at the fold. At a
  // few radians a second it stays exact for days.
  motion.phase += dt * (1.6 + motion.energy * 1.1) * (1.18 - FLUIDITY * 0.35)
  if (focus !== null) {
    motion.lean = smooth(motion.lean, clamp(focus, -0.95, 0.95), dt, 0.08, 0.08)
    motion.leanWeight = smooth(motion.leanWeight, 1, dt, 0.12, 0.12)
  } else {
    motion.leanWeight = smooth(motion.leanWeight, 0, dt, 0.35, 0.35)
  }
}

export interface RibbonPalette {
  /** Gradient stops, top to bottom. */
  stops: readonly (readonly [offset: number, colour: string])[]
  /** How overlapping lobes combine: `screen` glows on a dark stage. */
  blend: GlobalCompositeOperation
  alpha: number
  /** The resting line and the faint baseline under the ribbon. */
  line: string
}

const RIBBON_STOPS = [
  [0, '#f65a35'],
  [0.4, '#ef5064'],
  [0.55, '#4b8ee9'],
  [1, '#47d4ed'],
] as const

export const DARK_STAGE_RIBBON: RibbonPalette = {
  stops: RIBBON_STOPS,
  blend: 'screen',
  alpha: 0.78,
  line: 'rgba(255, 255, 255, 0.34)',
}

export const LIGHT_STAGE_RIBBON: RibbonPalette = {
  stops: RIBBON_STOPS,
  blend: 'source-over',
  alpha: 0.66,
  line: 'rgba(0, 0, 0, 0.22)',
}

export interface RibbonGeometry {
  centreX: number
  centreY: number
  halfWidth: number
  /** Lobe height at full energy, px. */
  maxAmplitude: number
}

const bell = (x: number, centre: number, width: number): number =>
  Math.exp(-2 * Math.pow((x - centre) / width, 2))

function drawLine(
  ctx: CanvasRenderingContext2D,
  geometry: RibbonGeometry,
  halfLength: number,
  colour: string,
): void {
  const { centreX, centreY } = geometry
  const line = ctx.createLinearGradient(
    centreX - halfLength,
    0,
    centreX + halfLength,
    0,
  )
  line.addColorStop(0, 'rgba(0, 0, 0, 0)')
  line.addColorStop(0.5, colour)
  line.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = line
  ctx.fillRect(centreX - halfLength, centreY - 0.5, halfLength * 2, 1)
}

/** One layer's shape for this frame. */
interface Lobe {
  amplitude: number
  /** The ribbon's shared phase, which moves the spine. */
  phase: number
  /** This layer's own phase. */
  p: number
  centre: number
  breadth: number
  low: number
  mid: number
}

function lobeFor(motion: RibbonMotion, layer: number, amplitude: number): Lobe {
  const weight = motion.leanWeight * LEAN_STRENGTH
  const p = motion.phase * (0.68 + layer * 0.17) + layer * 2.1
  const wander = 0.27 * Math.sin(p * 0.7)
  const spread = (layer - 1) * LAYER_SPREAD * (1 - weight * 0.5)
  return {
    amplitude,
    phase: motion.phase,
    p,
    centre: wander * (1 - weight) + motion.lean * weight + spread,
    breadth: 0.42 + 0.06 * Math.sin(p * 0.61) + motion.low * 0.07,
    low: motion.low,
    mid: motion.mid,
  }
}

/**
 * Offset from the centre line of one edge of a lobe at `x` (-1..1): the top
 * edge for `side` -1, the bottom for 1. `centre` and `gain` are that edge's
 * own; the two halves breathe on different pulses and bands.
 */
function edgeOffset(
  lobe: Lobe,
  x: number,
  side: -1 | 1,
  centre: number,
  gain: number,
): number {
  const taper = Math.pow(Math.max(0, 1 - x * x), 2.2)
  const spine =
    lobe.amplitude * taper * 0.08 * Math.sin(3.3 * x - lobe.phase * 0.65)
  const profile =
    0.05 +
    0.76 * bell(x, centre, lobe.breadth) +
    0.18 * bell(x, centre - side * 0.3, 0.29)
  return spine + side * lobe.amplitude * taper * profile * gain
}

/** Trace one lobe: along the top edge left to right, back along the bottom. */
function traceLobe(
  ctx: CanvasRenderingContext2D,
  lobe: Lobe,
  geometry: RibbonGeometry,
): void {
  const { centreX, centreY, halfWidth } = geometry
  const top = {
    side: -1 as const,
    centre: lobe.centre,
    gain: (0.67 + 0.24 * Math.sin(lobe.p)) * (0.83 + lobe.mid * 0.22),
  }
  const bottom = {
    side: 1 as const,
    centre: lobe.centre - 0.15 * Math.sin(lobe.p * 0.53),
    gain:
      (0.65 + 0.24 * Math.cos(lobe.p * 0.9 + 0.6)) * (0.83 + lobe.low * 0.22),
  }
  ctx.beginPath()
  // Both ends taper to nothing, so the outline starts on the centre line.
  ctx.moveTo(centreX - halfWidth, centreY)
  for (const edge of [top, bottom]) {
    for (let n = 0; n <= EDGE_STEPS * 2; n++) {
      // -1 to 1 along the top, 1 back to -1 along the bottom.
      const x = edge.side * (1 - n / EDGE_STEPS)
      const y = centreY + edgeOffset(lobe, x, edge.side, edge.centre, edge.gain)
      ctx.lineTo(centreX + x * halfWidth, y)
    }
  }
  ctx.closePath()
}

function ribbonGradient(
  ctx: CanvasRenderingContext2D,
  centreY: number,
  amplitude: number,
  palette: RibbonPalette,
): CanvasGradient {
  const gradient = ctx.createLinearGradient(
    0,
    centreY - amplitude * 0.7,
    0,
    centreY + amplitude * 0.7,
  )
  for (const [offset, colour] of palette.stops) {
    gradient.addColorStop(offset, colour)
  }
  return gradient
}

/**
 * Paint one frame of the ribbon, or its resting line when it is quiet. At
 * rest the line is a short dash, the ribbon put away; while the stage is
 * `awake` (listening) it runs the ribbon's whole width, so a quiet room
 * reads as a live line waiting for a voice, not as a stray mark.
 */
export function drawRibbon(
  ctx: CanvasRenderingContext2D,
  motion: RibbonMotion,
  geometry: RibbonGeometry,
  palette: RibbonPalette,
  awake = false,
): void {
  if (motion.energy < RIBBON_REST_ENERGY) {
    const rest = awake ? 1 : 0.08
    drawLine(ctx, geometry, geometry.halfWidth * rest, palette.line)
    return
  }
  drawLine(ctx, geometry, geometry.halfWidth, palette.line)

  const amplitude =
    geometry.maxAmplitude *
    Math.pow(motion.energy, 0.8) *
    (1 + motion.transient * 0.1)
  ctx.save()
  ctx.globalCompositeOperation = palette.blend
  ctx.globalAlpha = palette.alpha
  ctx.fillStyle = ribbonGradient(ctx, geometry.centreY, amplitude, palette)
  for (let layer = 0; layer < 3; layer++) {
    traceLobe(ctx, lobeFor(motion, layer, amplitude), geometry)
    ctx.fill()
  }
  ctx.restore()
}
