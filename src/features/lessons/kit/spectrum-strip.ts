// ============================================================
// Spectrum strip — the stats site's LED analyser, under a band chart's plot
// ============================================================
//
// Lesson 13's carrying object (its WEB-SPEC, Look and Toys 1): under Merc's
// band, one LED column for each harmonic of his note, the k-th centred at
// k times the note on a fixed axis from 0 to 4,000 Hz, so A3 draws 18
// columns 220 Hz apart and A4 9 columns twice as far apart. Each column is
// 12 segments lit from the bottom, ramping from aqua to amber a segment at a
// time; an unlit segment is chrome at 8 %. A labelled peak carries the
// motif's white peak-hold cap across its top lit segment and a chevron
// above it, so a peak is marked by shape, never by colour alone. The bar
// numbers sit in a row under it, every bar where columns stand 16 px apart
// or more, else the 1st, every 5th and the peaks, and never two that touch.
// Resonance curves, when the scene has them, are chrome lines over it. The
// caption names what it draws: Merc's model, never the viewer's voice.
//
// It draws only what its scene gives it and takes no audio input: the page
// computes the columns from its own model. A band chart takes it through
// its `under` option (band-chart.ts, `spectrumUnder`), so no lesson without a strip
// downloads it; the chart then lays its plot out as the strip asks: 12 px
// above the plot, the plot 30 % of the figure, 8 px to the strip, the
// strip, the numbers' 18 px row and 8 px under it. Nothing in it is violet,
// mint, rose or gold, so no column reads as the singer, as in tune, as a
// fault or as "the fit". The layout is pure (`stripLayout`), for its tests.

import type { BandScene, Under } from './band-chart'
import type { ChartFrame, SpectrumScene } from './band-chart-draw'
import { TICKS_ROOM } from './band-chart-hold'
import { COLOR, rgba } from './notes'

// the strip's scene lives with the chart's drawing types, which the chart
// reads too: the strip imports the chart, and never the other way round
export type { SpectrumScene } from './band-chart-draw'

/** The axis's top, Hz. */
export const STRIP_TOP_HZ = 4000
/** An LED column's segments, the gap between them, and the share of a column's space it fills. */
export const STRIP_SEGMENTS = 12
export const SEGMENT_GAP = 2
const COLUMN_SHARE = 0.7
/** Room above the plot, between plot and strip, for the numbers and under them, px. */
const ABOVE = 12
const BETWEEN = 8
export const NUMBERS_ROW = 18
const UNDER = 8
/** The strip's inset from each side of the canvas, px. */
export const STRIP_INSET = 14
/** Columns this far apart, or more, each carry their number. */
export const NUMBER_ALL_PX = 16
/** A bar number's advance, a character, in 11 px JetBrains Mono, and the room kept between two. */
const DIGIT_PX = 6.6
const NUMBER_GAP = 2

const NUMBER_FONT = '500 11px "JetBrains Mono", monospace'
const PEAK_FONT = '700 11px "JetBrains Mono", monospace'
const CAPTION_FONT = '500 11px "JetBrains Mono", monospace'

/** The plot's height in a figure `h` px tall: 30 % of it, rounded. */
export const plotHeight = (h: number): number => Math.round(0.3 * h)

/** The strip's height in a figure `h` px tall: the rest, after the plot, the numbers and the insets. */
export const stripHeight = (h: number): number =>
  h - plotHeight(h) - NUMBERS_ROW - (ABOVE + BETWEEN + UNDER)

/** Where everything sits in a `w` by `h` figure for a note of `f0` Hz with `count` columns. */
export interface StripLayout {
  readonly x0: number
  readonly x1: number
  readonly top: number
  readonly height: number
  /** A segment's pitch and its lit height, px. */
  readonly pitch: number
  readonly lit: number
  /** Columns' spacing and width, px. */
  readonly spacing: number
  readonly width: number
  /** Each column's centre, px, the k-th at index k - 1. */
  readonly centres: readonly number[]
  /** The numbers row's top, px. */
  readonly numbersY: number
}

export function stripLayout(
  w: number,
  h: number,
  f0: number,
  count: number,
): StripLayout {
  const x0 = STRIP_INSET
  const x1 = w - STRIP_INSET
  const top = ABOVE + plotHeight(h) + BETWEEN
  const height = stripHeight(h)
  const pitch = height / STRIP_SEGMENTS
  const spacing = ((x1 - x0) * f0) / STRIP_TOP_HZ
  return {
    x0,
    x1,
    top,
    height,
    pitch,
    lit: pitch - SEGMENT_GAP,
    spacing,
    width: spacing * COLUMN_SHARE,
    centres: Array.from({ length: count }, (_, i) => x0 + spacing * (i + 1)),
    numbersY: top + height + 2,
  }
}

/** A bar number's width, px. */
export const numberWidth = (n: number): number => String(n).length * DIGIT_PX

/**
 * The bars that carry a number: every bar where the columns stand 16 px
 * apart or more; closer, the labelled peaks, the 1st and every 5th, in that
 * order of claim, each kept only where it touches none kept before it.
 * The compact figure numbers its peaks alone.
 */
export function numberedBars(
  spacing: number,
  count: number,
  peaks: readonly number[],
  mode: SpectrumScene['numbers'],
): number[] {
  const all = Array.from({ length: count }, (_, i) => i + 1)
  if (mode === 'all' && spacing >= NUMBER_ALL_PX) return all
  const wanted =
    mode === 'peaks'
      ? [...peaks]
      : [...peaks, 1, ...all.filter((n) => n % 5 === 0)]
  const kept: number[] = []
  for (const n of wanted) {
    if (n < 1 || n > count || kept.includes(n)) continue
    const clear = kept.every(
      (m) =>
        Math.abs(m - n) * spacing >=
        (numberWidth(m) + numberWidth(n)) / 2 + NUMBER_GAP,
    )
    if (clear) kept.push(n)
  }
  return kept.sort((a, b) => a - b)
}

/** A lit segment's colour: aqua at the bottom to amber at the top, a segment at a time. */
export function segmentColor(i: number): string {
  const mix = (a: string, b: string, at: number): number =>
    Math.round(parseInt(a, 16) + (parseInt(b, 16) - parseInt(a, 16)) * at)
  const u = i / (STRIP_SEGMENTS - 1)
  const [r, g, b] = [1, 3, 5].map((p) =>
    mix(COLOR.aqua.slice(p, p + 2), COLOR.amber.slice(p, p + 2), u),
  )
  return `rgb(${r},${g},${b})`
}

/** The columns, lit from the bottom, with the peaks' caps and chevrons. */
function drawColumns(
  ctx: CanvasRenderingContext2D,
  l: StripLayout,
  s: SpectrumScene,
): void {
  const unlit = rgba(COLOR.chrome, 0.08)
  l.centres.forEach((x, i) => {
    const lit = Math.max(0, Math.min(STRIP_SEGMENTS, s.columns[i] ?? 0))
    const left = x - l.width / 2
    for (let seg = 0; seg < STRIP_SEGMENTS; seg++) {
      const y = l.top + l.height - (seg + 1) * l.pitch + SEGMENT_GAP / 2
      ctx.fillStyle = seg < lit ? segmentColor(seg) : unlit
      ctx.fillRect(left, y, l.width, l.lit)
    }
    if (!s.peaks.includes(i + 1)) return
    // the peak-hold cap across the top lit segment, and a chevron above it
    const capY = l.top + l.height - Math.max(1, lit) * l.pitch + SEGMENT_GAP / 2
    ctx.fillStyle = COLOR.ink
    ctx.fillRect(left, capY, l.width, 2)
    const c = Math.min(4, l.width / 2)
    ctx.beginPath()
    ctx.moveTo(x - c, capY - 7)
    ctx.lineTo(x, capY - 3)
    ctx.lineTo(x + c, capY - 7)
    ctx.strokeStyle = COLOR.ink
    ctx.lineWidth = 1.5
    ctx.stroke()
  })
}

/** The curves, chrome at 60 %, from the strip's top (a curve's peak) to its foot, 36 dB below. */
function drawCurves(
  ctx: CanvasRenderingContext2D,
  l: StripLayout,
  s: SpectrumScene,
): void {
  ctx.strokeStyle = rgba(COLOR.chrome, 0.6)
  ctx.lineWidth = 1.5
  for (const curve of s.curves) {
    ctx.beginPath()
    curve.forEach((p, i) => {
      const x = l.x0 + ((l.x1 - l.x0) * p.hz) / STRIP_TOP_HZ
      const drop = Math.min(36, Math.max(0, -p.db))
      const y = l.top + (l.height * drop) / 36
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }
}

/** The bar numbers, the labelled peaks' in ink and bold. */
function drawNumbers(
  ctx: CanvasRenderingContext2D,
  l: StripLayout,
  s: SpectrumScene,
): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const n of numberedBars(
    l.spacing,
    l.centres.length,
    s.peaks,
    s.numbers,
  )) {
    const peak = s.peaks.includes(n)
    ctx.font = peak ? PEAK_FONT : NUMBER_FONT
    ctx.fillStyle = peak ? COLOR.ink : COLOR.ink2
    ctx.fillText(String(n), l.centres[n - 1], l.numbersY)
  }
}

/** The captions at the strip's top right, each on a dark plate, so a column never runs through it. */
function drawCaptions(
  ctx: CanvasRenderingContext2D,
  l: StripLayout,
  s: SpectrumScene,
): void {
  ctx.font = CAPTION_FONT
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  const lines = [s.caption]
  if (s.curves.length > 0) lines.push(s.curveCaption ?? '')
  lines
    .filter((text) => text !== '')
    .forEach((text, i) => {
      const y = l.top + 1 + i * 16
      const tw = ctx.measureText(text).width
      ctx.fillStyle = 'rgba(7,10,16,.82)'
      ctx.fillRect(l.x1 - tw - 6, y, tw + 6, 15)
      ctx.fillStyle = COLOR.ink2
      ctx.fillText(text, l.x1 - 3, y + 2)
    })
}

/** Paints the scene's strip under the plot of a frame whose canvas is `f.w` by `f.h`. */
export function drawSpectrum(f: ChartFrame, s: SpectrumScene): void {
  const count = Math.floor(STRIP_TOP_HZ / s.f0 + 1e-9)
  const l = stripLayout(f.w, f.h, s.f0, count)
  drawColumns(f.ctx, l, s)
  drawCurves(f.ctx, l, s)
  drawNumbers(f.ctx, l, s)
  drawCaptions(f.ctx, l, s)
}

/**
 * The band chart's `under` for a strip: the plot laid out as the strip
 * asks, and the strip painted under it. A chart that names its seconds
 * under the plot (a hold's frame, `timeTicks`) gives them the plot's
 * last 18 px, so the strip stays where it is.
 */
export function spectrumUnder(o: { readonly ticks?: boolean } = {}): Under {
  return {
    top: () => ABOVE,
    bottom: (h) => ABOVE + plotHeight(h) - (o.ticks === true ? TICKS_ROOM : 0),
    paint(f: ChartFrame, scene: BandScene) {
      if (scene.spectrum !== undefined) drawSpectrum(f, scene.spectrum)
    },
  }
}
