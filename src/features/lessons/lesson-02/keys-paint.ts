// ============================================================
// Lesson 2 keys painting — keys and tiles, their names, bars, arrows, the ring
// ============================================================
//
// Every key and tile is painted the kit's way (spiral-keys.ts KEY_LOOK), so
// the keyboard Lesson 2 straightens is Lesson 1's keyboard, A3 blue and A4
// orange. A white key or tile carries its name at its foot; a black key or
// dark tile its names in the page's spelling, the sharp above the flat
// (DECISIONS B21). Names the Sharp and Flat arrows wrote sit above a white
// tile's letter, or in place of a dark tile's own label. Gold marks the fit
// and nothing else: the ring round one key given two names, and the B–C and
// E–F pairs flashing once as the keyboard straightens. Every label is 12 px
// or more, the type scale's floor.

import { clamp, TAU } from '@/features/lessons/kit/dom'
import type { Spelled } from '@/features/lessons/kit/notes'
import { COLOR, isBlack, nameOf, rgba, signName, } from '@/features/lessons/kit/notes'
import { KEY_LOOK, roundedRect } from '@/features/lessons/kit/spiral-keys'
import type { Rect } from './keys-geometry'

/** A3 and A4, Merc's and Tavi's. */
const A3 = 57
const A4 = 69

/** The smallest label on the page. */
const FLOOR = 12

/** Paints one key or tile: its face, and a flash for 0.7 s after it sounds. */
export function paintKey(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  m: number,
  pulse: number,
): void {
  const black = isBlack(m)
  ctx.beginPath()
  roundedRect(ctx, r.x, r.y, r.w, r.h, black ? [0, 0, 3, 3] : [0, 0, 4, 4])
  if (black) {
    ctx.fillStyle = KEY_LOOK.black
    ctx.strokeStyle = KEY_LOOK.blackEdge
    ctx.lineWidth = 1
    ctx.fill()
    ctx.stroke()
  } else {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h)
    g.addColorStop(0, KEY_LOOK.whiteTop)
    g.addColorStop(1, KEY_LOOK.whiteBottom)
    ctx.fillStyle = m === A3 ? KEY_LOOK.a3 : m === A4 ? KEY_LOOK.a4 : g
    ctx.fill()
  }
  if (pulse > 0) {
    ctx.fillStyle = black
      ? rgba(COLOR.chrome, 0.7 * pulse)
      : `rgba(255,255,255,${(0.7 * pulse).toFixed(3)})`
    ctx.fill()
  }
}

/** A label's size for a key `w` px wide: 12 to 13 px, never below the floor. */
export const labelSize = (w: number): number => clamp(w * 0.42, FLOOR, 13)

function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  o: { size: number; color: string; base?: CanvasTextBaseline },
): void {
  ctx.font = `600 ${o.size}px Outfit, sans-serif`
  ctx.fillStyle = o.color
  ctx.textAlign = 'center'
  ctx.textBaseline = o.base ?? 'alphabetic'
  ctx.fillText(s, x, y)
}

/** A white key's or tile's own name at its foot: "C4". */
export function footName(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  m: number,
): void {
  const size = labelSize(r.w)
  text(ctx, nameOf(m) ?? '', r.x + r.w / 2, r.y + r.h - 7, {
    size,
    color: KEY_LOOK.whiteInk,
  })
}

/** A black key's or dark tile's names, stacked sharp above flat, in its lower part. */
export function darkNames(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  names: readonly Spelled[],
  color: string = COLOR.chrome,
): void {
  const size = labelSize(r.w)
  const foot = r.y + r.h - 7
  names.forEach((n, i) => {
    const y = foot - (names.length - 1 - i) * (size + 3)
    text(ctx, signName(n, { octave: false }), r.x + r.w / 2, y, {
      size,
      color,
    })
  })
}

/** The middle of a dark tile's name block, where its gold ring centres. */
export function namesMiddle(r: Rect, count: number): { x: number; y: number } {
  const size = labelSize(r.w)
  const foot = r.y + r.h - 7
  return {
    x: r.x + r.w / 2,
    y: foot - size * 0.35 - ((count - 1) * (size + 3)) / 2,
  }
}

/** Second names above a white tile's letter, the newest nearest the letter. */
export function paintAbove(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  names: readonly Spelled[],
): void {
  const size = labelSize(r.w)
  const foot = r.y + r.h - 7
  names.forEach((n, i) => {
    const y = foot - (i + 1) * (size + 5)
    text(ctx, signName(n, { octave: false }), r.x + r.w / 2, y, {
      size,
      color: KEY_LOOK.whiteInk,
    })
  })
}

/** One gold ring: the fit, one key with two names. `settle` 0 to 1 draws it in from a little larger. */
export function goldRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  settle: number,
): void {
  const r = radius * (1 + 0.35 * (1 - settle))
  const glow = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 1.5)
  glow.addColorStop(0, rgba(COLOR.gold, 0))
  glow.addColorStop(0.45, rgba(COLOR.gold, 0.22 * settle))
  glow.addColorStop(1, rgba(COLOR.gold, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, r * 1.5, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = rgba(COLOR.gold, settle)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.stroke()
}

/** The keyboard's own focus: an aqua outline round the selected key or tile. */
export function focusRing(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.strokeStyle = COLOR.aqua
  ctx.lineWidth = 2.5
  ctx.beginPath()
  roundedRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 3)
  ctx.stroke()
}

/** A small label in the mono style, centred: "1", "tone", "semitone". */
export function smallLabel(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  color: string,
): void {
  ctx.font = `500 ${FLOOR}px "JetBrains Mono", monospace`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(s, x, y)
}

/**
 * A step bar under the keys: a line from one key's centre to the other's,
 * a notch at every semitone on the way (`xs`, the keys' centres in order),
 * and its number of semitones on it.
 */
export function stepBar(
  ctx: CanvasRenderingContext2D,
  xs: readonly number[],
  y: number,
  alpha: number,
): void {
  if (xs.length < 2) return
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  ctx.strokeStyle = rgba(COLOR.chrome, 0.85 * alpha)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.stroke()
  ctx.lineWidth = 1.5
  for (const x of xs) {
    ctx.beginPath()
    ctx.moveTo(x, y - 5)
    ctx.lineTo(x, y + 5)
    ctx.stroke()
  }
  const label = String(xs.length - 1)
  ctx.font = `600 13px Outfit, sans-serif`
  const w = ctx.measureText(label).width + 10
  ctx.fillStyle = rgba(COLOR.card, alpha)
  ctx.fillRect((x0 + x1) / 2 - w / 2, y - 9, w, 18)
  ctx.fillStyle = rgba(COLOR.ink, alpha)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, (x0 + x1) / 2, y + 0.5)
}

/** An arrow's place: its start, its end, and which side of the row it bows to. */
export interface ArrowPath {
  readonly from: { x: number; y: number }
  readonly to: { x: number; y: number }
  /** -1 bows above the row (a sharp, up), 1 below it (a flat, down). */
  readonly side: -1 | 1
}

function bowPoint(a: ArrowPath, t: number): { x: number; y: number } {
  const mx = (a.from.x + a.to.x) / 2
  const my = (a.from.y + a.to.y) / 2 + a.side * 30
  const u = 1 - t
  return {
    x: u * u * a.from.x + 2 * u * t * mx + t * t * a.to.x,
    y: u * u * a.from.y + 2 * u * t * my + t * t * a.to.y,
  }
}

/** Draws an arrow `p` of the way along its bow (0 to 1), with its head once it lands. */
export function stepArrow(
  ctx: CanvasRenderingContext2D,
  a: ArrowPath,
  p: number,
  alpha: number,
  label: string,
): void {
  const steps = Math.max(2, Math.round(24 * p))
  ctx.strokeStyle = rgba(COLOR.ink, 0.9 * alpha)
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const pt = bowPoint(a, (p * i) / steps)
    if (i === 0) ctx.moveTo(pt.x, pt.y)
    else ctx.lineTo(pt.x, pt.y)
  }
  ctx.stroke()
  const tip = bowPoint(a, p)
  const back = bowPoint(a, Math.max(0, p - 0.08))
  const ang = Math.atan2(tip.y - back.y, tip.x - back.x)
  ctx.fillStyle = rgba(COLOR.ink, 0.9 * alpha)
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(tip.x - 8 * Math.cos(ang - 0.45), tip.y - 8 * Math.sin(ang - 0.45))
  ctx.lineTo(tip.x - 8 * Math.cos(ang + 0.45), tip.y - 8 * Math.sin(ang + 0.45))
  ctx.closePath()
  ctx.fill()
  const peak = bowPoint(a, 0.5)
  smallLabel(ctx, label, peak.x, peak.y + a.side * 13, rgba(COLOR.ink2, alpha))
}
