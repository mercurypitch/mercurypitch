// ============================================================
// Band chart song — a phrase or a whole song, its words and its breaths
// ============================================================
//
// Lesson 14's song line (WEB-SPEC, Toys 1): the kit's band chart on a notes
// axis, each of Merc's notes a band over its own time, with what a sung
// phrase needs beside it. Under the plot, the words strip: each syllable
// centred under its note in the chart's mono at 11 px, the sounding one in
// ink and the rest softer; under that, on a chart that plays chords, the
// chord strip, each numeral centred under its minim. Over the line, breath
// marks (kit/breath-mark.ts), each over the gap it stands for, with its
// word centred over its tick and moved left only as far as it must to stay
// inside the plot, or with no word where the marks stand too close (the
// whole song). Over a window, its label ("the swell"); in the plot's top
// left corner, the name of what it shows ("take 1").
//
// Loudness is light, never height (playbook rule 20): a band brightens by
// the level of its note along its own length (`light`), as far as the note
// has sounded (`upTo`), and keeps that light once sounded, so a still holds
// a take's shape in light: a swell grows and fades along its band while
// Merc's line stays at its centre. A planned swell is the same light, faint
// (`plan`). Level as height appears only in the strip under the plot, where
// a figure asks for it (`level`, band-chart-hold.ts), as Lesson 5 draws it.
//
// A chart paints a song scene in place of its one band (`paintRungs`) and
// lays its plot out over the strips (`under`), so a chart with neither is
// the kit's band chart as it was, and no lesson without a song downloads
// this module.

import type { Under } from './band-chart'
import type { ChartFrame } from './band-chart-draw'
import { BAND_COLOR, drawBand, drawTrace, MONO, xOf, yOf, } from './band-chart-draw'
import type { LevelPoint } from './band-chart-hold'
import { drawLevelStrip, STRIP_GAP, stripHeight } from './band-chart-hold'
import type { SongBand, SongBreath, SongScene, SongTrace, SongWord, } from './band-chart-song-scene'
import { HIT_TOLERANCE_CENTS } from './band-words'
import { BREATH_FONT, BREATHE, drawBreath } from './breath-mark'
import { COLOR, rgba } from './notes'

/** The song line's words, at 11 px, so the tightest pair of syllables clears at 344 px (FACTS 91). */
export const WORDS_FONT = '500 11px "JetBrains Mono", monospace'
/** Each strip under the plot, px. */
export const STRIP_ROW = 18
/** Room above the plot, and under the strips, px, as the band chart's. */
const PAD = 14

/** The scene's room under the plot, px, in a figure `h` high. */
export function songRoom(s: SongScene | undefined, h: number): number {
  if (s === undefined) return 0
  if (s.level !== null) return STRIP_GAP + stripHeight(h)
  return STRIP_ROW * (s.chords.length > 0 ? 2 : 1)
}

/** The level at `t` along a curve of points, linear between them, held past its ends. */
export function levelAt(points: readonly LevelPoint[], t: number): number {
  if (points.length === 0) return 0
  if (t <= points[0].t) return points[0].level
  for (let i = 1; i < points.length; i++) {
    const b = points[i]
    if (t > b.t) continue
    const a = points[i - 1]
    const u = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t)
    return a.level + (b.level - a.level) * u
  }
  return points[points.length - 1].level
}

/** Slices of light along a band, px. */
const SLICE = 2

/** The light along a band from its start to `upTo`, as bright as `points` say, times `strength`. */
function drawLight(
  f: ChartFrame,
  b: SongBand,
  points: readonly LevelPoint[],
  upTo: number,
  strength: number,
): void {
  const { ctx } = f
  const yTop = yOf(f, b.c + HIT_TOLERANCE_CENTS)
  const yBot = yOf(f, b.c - HIT_TOLERANCE_CENTS)
  const y = yOf(f, b.c)
  const x0 = xOf(f, b.from)
  const x1 = xOf(f, Math.min(b.to, upTo))
  const perSec = (xOf(f, b.to) - x0) / Math.max(1e-9, b.to - b.from)
  for (let x = x0; x < x1; x += SLICE) {
    const w = Math.min(SLICE, x1 - x)
    const t = b.from + (x + w / 2 - x0) / perSec
    const l = Math.min(1, Math.max(0, levelAt(points, t))) * strength
    if (l <= 0) continue
    ctx.fillStyle = rgba(BAND_COLOR.target, 0.26 * l)
    ctx.fillRect(x, yTop, w, yBot - yTop)
    // the halo and the brighter line of a note sounding at that level
    ctx.fillStyle = rgba(BAND_COLOR.target, 0.16 * l)
    ctx.fillRect(x, y - 6, w, 12)
    ctx.fillStyle = rgba(BAND_COLOR.target, 0.6 * l)
    ctx.fillRect(x, y - 1.5, w, 3)
  }
}

/** The bands either side of `t`: the one that ends at or before it, the one that starts at or after. */
function bandsBeside(
  bands: readonly SongBand[],
  t: number,
): readonly SongBand[] {
  const before = bands
    .filter((b) => b.to <= t + 1e-6)
    .sort((a, b) => b.to - a.to)[0]
  const after = bands
    .filter((b) => b.from >= t - 1e-6)
    .sort((a, b) => a.from - b.from)[0]
  return [before, after].filter((b): b is SongBand => b !== undefined)
}

/** Where a breath mark at `t` stands: over the higher band beside it, its word kept inside the plot. */
export function breathPlace(
  f: ChartFrame,
  ctx: CanvasRenderingContext2D,
  bands: readonly SongBand[],
  m: SongBreath,
): {
  x: number
  y: number
  word: { x: number; y: number; beside: boolean } | null
} {
  const x = xOf(f, m.t)
  const beside = bandsBeside(bands, m.t)
  const c = beside.length === 0 ? f.hi : Math.max(...beside.map((b) => b.c))
  const y = Math.max(10, yOf(f, Math.min(f.hi, c + HIT_TOLERANCE_CENTS)) - 4)
  if (!m.word) return { x, y, word: null }
  ctx.font = BREATH_FONT
  const half = ctx.measureText(BREATHE).width / 2
  const wx = Math.max(f.x0 + half, Math.min(x, f.x1 - half))
  return { x, y, word: { x: wx, y: Math.max(11, y - 10), beside: false } }
}

/** A word centred on its time, kept inside the canvas. */
function centred(
  f: ChartFrame,
  ctx: CanvasRenderingContext2D,
  w: SongWord,
  y: number,
): void {
  const half = ctx.measureText(w.text).width / 2
  const x = Math.max(half, Math.min(xOf(f, w.t), f.w - half))
  ctx.fillText(w.text, x, y)
}

/**
 * Paints a song scene's bands, their light, its breath marks, its labels
 * and its name, in place of the chart's one band; false for a scene with no
 * song, which keeps the band (kit/band-chart.ts `paintRungs`).
 */
export function paintSong(
  f: ChartFrame,
  scene: { readonly song?: SongScene },
): boolean {
  const s = scene.song
  if (s === undefined) return false
  const { ctx } = f
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'miter'
  for (const b of s.bands) {
    drawBand(f, {
      c: b.c,
      half: HIT_TOLERANCE_CENTS,
      glow: b.glow,
      x0: xOf(f, b.from),
      x1: xOf(f, b.to),
    })
    if (b.plan !== undefined) drawLight(f, b, b.plan, b.to, 0.4)
    if (b.light !== undefined && b.upTo !== undefined)
      drawLight(f, b, b.light, b.upTo, 1)
  }
  ctx.setLineDash([])
  for (const m of s.breaths)
    drawBreath(ctx, breathPlace(f, ctx, s.bands, m), BAND_COLOR.target, m.lit)
  for (const k of s.traces ?? []) drawKept(f, k)
  ctx.font = MONO
  ctx.fillStyle = COLOR.ink2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const l of s.labels) centred(f, ctx, l, f.top + 2)
  if (s.name !== null) {
    ctx.textAlign = 'left'
    ctx.fillText(s.name, f.x0 + 4, f.top + 2)
  }
  return true
}

/** How faint a kept take is behind a newer one. */
export const KEPT_FADE = 0.35

/** A take kept on the chart: its line, faint behind a newer one, and its name just after its last voiced point. */
function drawKept(f: ChartFrame, k: SongTrace): void {
  const { ctx } = f
  drawTrace(f, k.line, k.faint ? KEPT_FADE : 1)
  const last = [...k.line].reverse().find((p) => p.c !== null)
  if (last?.c === undefined || last.c === null) return
  ctx.font = WORDS_FONT
  ctx.fillStyle = BAND_COLOR.singer
  ctx.globalAlpha = k.faint ? KEPT_FADE : 1
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const x = Math.min(xOf(f, last.t) + 6, f.x1 - ctx.measureText(k.name).width)
  ctx.fillText(k.name, x, yOf(f, Math.min(Math.max(last.c, f.lo), f.hi)))
  ctx.globalAlpha = 1
}

/**
 * The strips under a song line's plot: the words, the chords under them,
 * or the level strip in their place, laid out for the scene `read` gives,
 * the chart's own (kit/band-chart.ts `under`).
 */
export function songUnder(read: () => SongScene | undefined): Under {
  return {
    top: () => PAD,
    bottom: (h) => h - PAD - songRoom(read(), h),
    paint(f, scene) {
      const s = (scene as { song?: SongScene }).song
      if (s === undefined) return
      const { ctx } = f
      if (s.level !== null) {
        drawLevelStrip(f, f.bottom + STRIP_GAP, stripHeight(f.h), s.level)
        return
      }
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = WORDS_FONT
      for (const w of s.words) {
        ctx.fillStyle = w.on === true ? COLOR.ink : COLOR.ink2
        centred(f, ctx, w, f.bottom + STRIP_ROW / 2)
      }
      ctx.font = MONO
      ctx.fillStyle = COLOR.ink2
      for (const c of s.chords) centred(f, ctx, c, f.bottom + STRIP_ROW * 1.5)
    },
  }
}
