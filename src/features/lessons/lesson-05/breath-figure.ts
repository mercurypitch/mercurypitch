// ============================================================
// Lesson 5 breath figure — the diaphragm's dome and the belly, from the side
// ============================================================
//
// A schematic side view, not anatomy to scale (FACTS, Illustrations): the
// chest and the belly in chrome on the dark room, the lungs, the
// diaphragm's dome under them and the belly wall, labelled "diaphragm" and
// "belly". Breathing in, the dome flattens and lowers and the belly moves
// out (FACTS 14, 29); breathing out on the "sss", both return.
//
// Breathe in is one tap, never a press and hold (FACTS 33, 65): a fixed 2 s
// in-breath and then at once a 5 s out-breath, so nothing the viewer does
// can keep the dome flat, and no breath is ever held between the two. Pure
// timing and geometry here (breath-figure.test.ts); toy-figure.ts runs it,
// with the breathing ring counting the "sss".
//
// The geometry is SVG path data (`figurePaths`), so the figure on the stage
// (a canvas, through Path2D) and the four words' small stub (an SVG) are one
// drawing at two sizes.

import { clamp, smooth } from '@/features/lessons/kit/dom'
import { COLOR, rgba } from '@/features/lessons/kit/notes'

/** Seconds of the in-breath and of the "sss". */
export const IN_SEC = 2
export const OUT_SEC = 5

export type BreathPhase = 'rest' | 'in' | 'out'

/** Where a breath is `t` seconds after Breathe in: its phase, and how full the breath is, 0 to 1. */
export function breathAt(t: number | null): { phase: BreathPhase; u: number } {
  if (t === null || t < 0 || t >= IN_SEC + OUT_SEC)
    return { phase: 'rest', u: 0 }
  if (t < IN_SEC) return { phase: 'in', u: smooth(0, IN_SEC, t) }
  return { phase: 'out', u: 1 - smooth(IN_SEC, IN_SEC + OUT_SEC, t) }
}

/** What the live line says as each phase begins. */
export const PHASE_WORDS: Readonly<Record<BreathPhase, string>> = {
  rest: 'At rest.',
  in: 'Breathing in: the diaphragm flattens and the belly moves out.',
  out: 'Breathing out on sss.',
}

/** Where a figure sits: its box, in canvas or SVG units. */
export interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** The figure's parts as SVG path data. */
export interface FigurePaths {
  /** The back, shoulders to hips. */
  readonly back: string
  /** The chest to the lower ribs, then the belly wall. */
  readonly front: string
  /** The lungs, sitting on the dome. */
  readonly lungs: string
  /** The diaphragm's dome, back to front. */
  readonly dome: string
}

/** The dome breathed `u` in: its two edges and its arch's control point, as fractions of the box. */
export function domeOf(u: number): {
  back: number
  front: number
  arch: number
} {
  const v = clamp(u, 0, 1)
  return { back: 0.6 + 0.04 * v, front: 0.54 + 0.04 * v, arch: 0.18 + 0.24 * v }
}

/** The figure in box `b`, breathed `u` in (0 at rest, 1 full): high and round at rest, lower and flatter, the belly out, breathed in. */
export function figurePaths(b: Box, u: number): FigurePaths {
  const v = clamp(u, 0, 1)
  const x = (f: number): string => (b.x + f * b.w).toFixed(1)
  const y = (f: number): string => (b.y + f * b.h).toFixed(1)
  const p = (fx: number, fy: number): string => `${x(fx)} ${y(fy)}`
  const out = 0.07 * v
  const d = domeOf(v)
  // the lungs' floor is the dome's arch, a little above it
  const lift = 0.025
  return {
    back: `M${p(0.26, 0)} C${p(0.18, 0.18)} ${p(0.17, 0.5)} ${p(0.2, 0.72)} C${p(0.22, 0.86)} ${p(0.26, 0.94)} ${p(0.28, 1)}`,
    front: `M${p(0.58, 0)} C${p(0.74, 0.08)} ${p(0.8, 0.28)} ${p(0.76, 0.5)} C${p(0.8 + out, 0.62)} ${p(0.84 + out, 0.82)} ${p(0.7, 1)}`,
    lungs: `M${p(0.42, 0.06)} C${p(0.6, 0.07)} ${p(0.71, 0.26)} ${p(0.72, d.front - lift - 0.005)} Q${p(0.47, d.arch - lift)} ${p(0.22, d.back - lift)} C${p(0.23, 0.32)} ${p(0.28, 0.1)} ${p(0.42, 0.06)} Z`,
    dome: `M${p(0.22, d.back)} Q${p(0.47, d.arch)} ${p(0.74, d.front)}`,
  }
}

const MONO = '500 12px "JetBrains Mono", monospace'

function label(
  ctx: CanvasRenderingContext2D,
  words: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
): void {
  ctx.font = MONO
  ctx.fillStyle = COLOR.ink3
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(words, x, y)
}

/** A label's leader line from the figure out to its words. */
function leader(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
): void {
  ctx.strokeStyle = 'rgba(195,204,214,.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y0)
  ctx.stroke()
}

export interface FigureOptions {
  /** A line under the figure: a still's name under reduced motion. */
  readonly caption?: string
}

/** One figure in box `b`, breathed `u` in (0 at rest, 1 full), with its two labels. */
export function drawFigure(
  ctx: CanvasRenderingContext2D,
  b: Box,
  u: number,
  o: FigureOptions = {},
): void {
  const v = clamp(u, 0, 1)
  const paths = figurePaths(b, v)
  const lungs = new Path2D(paths.lungs)
  ctx.fillStyle = rgba(COLOR.chrome, 0.08 + 0.07 * v)
  ctx.fill(lungs)
  ctx.strokeStyle = rgba(COLOR.chrome, 0.42)
  ctx.lineWidth = 1
  ctx.stroke(lungs)
  ctx.strokeStyle = COLOR.chrome
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.stroke(new Path2D(paths.dome))
  ctx.strokeStyle = rgba(COLOR.chrome, 0.75)
  ctx.lineWidth = 2
  ctx.stroke(new Path2D(paths.back))
  ctx.stroke(new Path2D(paths.front))
  const px = (f: number): number => b.x + f * b.w
  const py = (f: number): number => b.y + f * b.h
  // the diaphragm's label at its front edge, the belly's beside the wall
  const domeY = py(domeOf(v).front - 0.02)
  leader(ctx, px(0.8), domeY, px(0.9))
  label(ctx, 'DIAPHRAGM', px(0.92), domeY, 'left')
  const bellyY = py(0.76)
  leader(ctx, px(0.86 + 0.07 * v), bellyY, px(0.97))
  label(ctx, 'BELLY', px(0.99), bellyY, 'left')
  if (o.caption !== undefined)
    label(ctx, o.caption, px(0.48), py(1) + 16, 'center')
}

/** Room the labels take to the right of a figure, as a share of its width. */
const LABEL_ROOM = 0.62

/**
 * The figure's box inside a slot `width` wide from `left` in a canvas `h`
 * high: as tall as the slot allows, centred with its labels' room beside it,
 * and with room under it for a caption.
 */
export function figureBox(
  h: number,
  left: number,
  width: number,
  caption = false,
): Box {
  const room = caption ? 44 : 22
  const bh = Math.max(40, h - 14 - room)
  const bw = Math.min(bh * 0.72, width / (1 + LABEL_ROOM))
  return {
    x: left + (width - bw * (1 + LABEL_ROOM)) / 2,
    y: 14,
    w: bw,
    h: Math.min(bh, bw / 0.72),
  }
}
