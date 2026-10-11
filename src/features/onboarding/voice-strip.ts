// ============================================================
// The voice strip: the singer's two glides as one gold ridge
// ============================================================
//
// The twin's stat card draws the singer's own glides, up and back down,
// as one gold line (owner testing, 11 Oct 2026: one branded card in place
// of three loose stats). This turns the raw glide frames into a short list
// of pitches, evenly spaced in time, and lays them out in the pixel box the
// card measures for its ridge. Pure: no DOM, no audio.
//
// What the line may claim is pinned in voice-strip.test.ts: it is the
// take itself, a silent stretch is skipped rather than drawn as a drop,
// it never runs past the two notes the card names, and a narrow range
// is drawn as a low hill rather than stretched into a peak.

import type { F0Frame, RangeResult } from '@/lib/mirror/metrics'
import { median, preprocess } from '@/lib/mirror/metrics'

/** Points per glide: enough for the voice's wobbles, few enough to keep. */
export const STRIP_POINTS_PER_GLIDE = 24

/** A drawing box, in CSS pixels. */
export interface RidgeBox {
  width: number
  height: number
}

/**
 * The phone card's ridge, used until the card has measured its own (and
 * in tests, where nothing is laid out).
 */
export const RIDGE_BOX: RidgeBox = { width: 280, height: 64 }

/** Room above the peak and under the lowest point for the line's glow. */
const EDGE = 7

/**
 * The fewest semitones the box is tall for. A range narrower than this
 * is drawn as a low hill at the bottom, not stretched to the full height:
 * three semitones must not look like two octaves.
 */
const MIN_SPAN_SEMITONES = 12

type Range = Pick<RangeResult, 'lowMidi' | 'highMidi'>

const round2 = (n: number): number => Math.round(n * 100) / 100
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n))

/**
 * The singer's glides, in order, as MIDI pitches evenly spaced in time.
 * Each point is the median of the voiced frames in its slice of a glide.
 * A slice with no voice is skipped, so a breath is a shortcut in the
 * line, never a drop to zero. A pitch outside the measured range is held
 * to its edge, so the line never runs past the notes the card names.
 * Null without a range, or with too little voice to draw.
 */
export function glideStrip(
  glides: readonly (readonly F0Frame[])[],
  range: Range | null,
  perGlide = STRIP_POINTS_PER_GLIDE,
): number[] | null {
  if (range === null) return null
  const points: number[] = []
  for (const glide of glides) {
    const voiced = preprocess(glide)
    if (voiced.length < 2) continue
    const start = voiced[0].t
    const span = voiced[voiced.length - 1].t - start
    if (span <= 0) continue
    const slices: number[][] = Array.from({ length: perGlide }, () => [])
    for (const frame of voiced) {
      const at = Math.floor(((frame.t - start) / span) * perGlide)
      slices[Math.min(perGlide - 1, at)].push(frame.cents / 100)
    }
    for (const slice of slices) {
      if (slice.length === 0) continue
      points.push(round2(clamp(median(slice), range.lowMidi, range.highMidi)))
    }
  }
  return points.length >= 4 ? points : null
}

/**
 * A smooth rise from the low note to the high note and back, for a
 * voiceprint that arrived without its glides. Only a seeded result does
 * that: a real run always hands the twin its glides.
 */
export function idealStrip(
  range: Range,
  points = 2 * STRIP_POINTS_PER_GLIDE,
): number[] {
  const span = range.highMidi - range.lowMidi
  return Array.from({ length: points }, (_, i) =>
    round2(range.lowMidi + span * Math.sin((Math.PI * i) / (points - 1))),
  )
}

/** A point on the ridge, in percent of the box from its top-left corner. */
export interface RidgeMark {
  x: number
  y: number
}

export interface RidgeShape {
  /** Every point, in box units. */
  points: [number, number][]
  /** The line itself, smoothed, as an SVG path. */
  line: string
  /** The line closed down to the bottom of the box, for the haze under it. */
  area: string
  /** The highest point: the high note's name sits level with it. */
  high: RidgeMark
  /** The lowest point: the low note's name sits level with it. */
  low: RidgeMark
}

const fmt = ([x, y]: [number, number]): string =>
  `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`

/** Through every point's neighbourhood with quadratic curves. */
function smoothPath(points: [number, number][]): string {
  if (points.length < 3) return `M${points.map(fmt).join(' L')}`
  let d = `M${fmt(points[0])}`
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]
    const [nx, ny] = points[i + 1]
    d += ` Q${fmt([x, y])} ${fmt([(x + nx) / 2, (y + ny) / 2])}`
  }
  return `${d} L${fmt(points[points.length - 1])}`
}

/**
 * Lay a strip out in a box: time runs left to right across the full width,
 * the low note sits on the bottom line, and the box is tall for the range,
 * or for MIN_SPAN_SEMITONES when the range is narrower.
 */
export function ridgeShape(
  strip: readonly number[],
  range: Range,
  box: RidgeBox = RIDGE_BOX,
): RidgeShape {
  const { width, height } = box
  const bottom = height - EDGE
  const tall = Math.max(1, bottom - EDGE)
  const span = Math.max(range.highMidi - range.lowMidi, MIN_SPAN_SEMITONES)
  const last = Math.max(1, strip.length - 1)
  const points = strip.map((midi, i): [number, number] => [
    (i / last) * width,
    bottom -
      ((clamp(midi, range.lowMidi, range.highMidi) - range.lowMidi) / span) *
        tall,
  ])

  let hi = 0
  let lo = 0
  points.forEach(([, y], i) => {
    if (y < points[hi][1]) hi = i
    if (y > points[lo][1]) lo = i
  })
  const mark = (i: number): RidgeMark => ({
    x: (points[i][0] / width) * 100,
    y: (points[i][1] / height) * 100,
  })

  const line = smoothPath(points)
  const first = points[0]
  const end = points[points.length - 1]
  return {
    points,
    line,
    area: `${line} L${fmt([end[0], height])} L${fmt([first[0], height])} Z`,
    high: mark(hi),
    low: mark(lo),
  }
}
