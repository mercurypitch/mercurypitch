// ============================================================
// Vocal folds — the two folds seen from above, as the voice lessons draw them
// ============================================================
//
// A schematic, not anatomy to scale (Lesson 3 FACTS, Illustrations): two
// folds in a V, the front at the top, opening at the back, chrome on the
// dark room with ink labels. Lesson 3's Fig. 1 draws them breathing and
// singing as Stretch rises; Lesson 5's three starts draw them apart with
// air between them, pressed shut, and closing to a slit as a note begins.
// Promoted from Lesson 3's toy (WEB-SPEC: "promoted into the kit, never
// copied"), which draws through it unchanged.
//
// A figure owns its geometry per frame: a `FoldShape` (where the folds sit,
// how long and thick they are, how far apart at the back, how far they part
// along their middle in a cycle), and these painters draw it.

import { COLOR, rgba } from './notes'

/** One fold set's geometry: apex at the front (top), its back `len` below. */
export interface FoldShape {
  cx: number
  y0: number
  len: number
  /** Thickness at the back. */
  th: number
  /** Half the gap at the back: wide apart for breathing, about 1 when together. */
  gap: number
  /** How far the folds part along their middle in a vibration cycle. */
  bulge: number
}

/** A fold's outline: Lesson 3's chrome hairline, or a heavier one for folds pressed shut. */
export interface FoldStroke {
  readonly width: number
  readonly alpha: number
}

const HAIRLINE: FoldStroke = { width: 1, alpha: 0.5 }

const MONO = '500 12px "JetBrains Mono", monospace'

/** Where a fold's edge sits, `l` of the way from front to back, on `side` (−1 left, 1 right). */
export function foldEdgeX(
  s: FoldShape,
  l: number,
  side: number,
  outer: boolean,
): number {
  const g = 1 + (s.gap - 1) * l + s.bulge * Math.sin(Math.PI * l)
  const w = outer ? s.th * (0.35 + 0.65 * l) + 2 : 0
  return s.cx + side * (g + w)
}

/** One fold: its edge to the glottis, then its outer edge back to the front. */
function drawFold(
  ctx: CanvasRenderingContext2D,
  s: FoldShape,
  side: number,
  alpha: number,
  stroke: FoldStroke,
): void {
  ctx.beginPath()
  for (let i = 0; i <= 24; i++) {
    const l = i / 24
    ctx.lineTo(foldEdgeX(s, l, side, false), s.y0 + l * s.len)
  }
  for (let i = 24; i >= 0; i--) {
    const l = i / 24
    ctx.lineTo(foldEdgeX(s, l, side, true), s.y0 + l * s.len)
  }
  ctx.closePath()
  const g = ctx.createLinearGradient(
    s.cx - side * 4,
    0,
    s.cx + side * s.th * 2,
    0,
  )
  g.addColorStop(0, '#f4f8fd')
  g.addColorStop(0.45, COLOR.chrome)
  g.addColorStop(1, '#5b6b7b')
  ctx.globalAlpha = alpha
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = rgba(COLOR.chrome, stroke.alpha)
  ctx.lineWidth = stroke.width
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** Both folds of a shape. */
export function drawFoldPair(
  ctx: CanvasRenderingContext2D,
  s: FoldShape,
  alpha = 1,
  stroke: FoldStroke = HAIRLINE,
): void {
  drawFold(ctx, s, -1, alpha, stroke)
  drawFold(ctx, s, 1, alpha, stroke)
}

/** A mono label in ink, as every figure's labels are. */
export function drawFoldText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
): void {
  ctx.font = MONO
  ctx.fillStyle = COLOR.ink3
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

/** Front, back and the folds' name, around one fold set; the name only where it fits beside them. */
export function drawFoldLabels(
  ctx: CanvasRenderingContext2D,
  s: FoldShape,
): void {
  drawFoldText(ctx, 'FRONT', s.cx, s.y0 - 12, 'center')
  drawFoldText(ctx, 'BACK', s.cx, s.y0 + s.len + 16, 'center')
  const y = s.y0 + s.len * 0.62
  const x = foldEdgeX(s, 0.62, -1, true)
  ctx.font = MONO
  if (x - 22 - ctx.measureText('VOCAL FOLDS').width < 8) return
  ctx.strokeStyle = 'rgba(195,204,214,.3)'
  ctx.beginPath()
  ctx.moveTo(x - 4, y)
  ctx.lineTo(x - 18, y)
  ctx.stroke()
  drawFoldText(ctx, 'VOCAL FOLDS', x - 22, y, 'right')
}

/** The geometry at stretch `s` (0 slack to 1 tight) in a plot `h` high, centred on `cx`. */
export function foldShapeAt(h: number, s: number, cx: number): FoldShape {
  const len = h * (0.5 + 0.16 * s)
  return {
    cx,
    y0: h * 0.5 - len / 2,
    len,
    th: 22 - 10 * s,
    gap: 1,
    bulge: 0,
  }
}
