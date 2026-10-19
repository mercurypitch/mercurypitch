// ============================================================
// Key strip — a keyboard of any range, in Lesson 1's key look
// ============================================================
//
// The spiral's keyboard (spiral-keys.ts) is A2 to A5, laid out for the
// spiral it unrolls from. A toy that needs a plain keyboard under its
// drawing (Lesson 4's staircase: C4 to C6 on a wide stage, one octave at
// full width on a phone) lays out a strip of any white-key range here and
// paints it with the same KEY_LOOK. A strip can show all of its range or a
// window of it, `from` white keys in, which a toy pans by moving `from`.
//
// Every key drawn is a tap zone, clipped to the window: a black key's zone
// is as wide as it can be without meeting its neighbour's (44 px wherever
// the white keys are wider than that), and it is tried before the white
// key under it. A key the window cuts to under `minZone` px takes no taps,
// so every key that answers a tap is a full-size target.

import type { Spelled } from './notes'
import { COLOR, isBlack, rgba, signName } from './notes'
import { KEY_LOOK, roundedRect } from './spiral-keys'

/** A strip's range, and where it sits on its canvas. */
export interface StripSpec {
  /** The lowest and highest notes, both white keys. */
  readonly lo: number
  readonly hi: number
  /** The strip's left and right edges, px. */
  readonly x0: number
  readonly x1: number
  /** The keys' top and the white keys' height, px. */
  readonly top: number
  readonly height: number
  /**
   * A window instead of the whole range: `keys` white keys fill the width,
   * the first `from` white keys in (fractional while it pans).
   */
  readonly window?: { readonly from: number; readonly keys: number }
}

/** One key as drawn: its rectangle and the zone that takes its taps. */
export interface StripKey {
  readonly midi: number
  readonly white: boolean
  /** The key's centre, px. */
  readonly cx: number
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  /** Its tap zone, clipped to the strip; null where it is too narrow to take a tap. */
  readonly zone: {
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
  } | null
}

export interface Strip {
  readonly spec: StripSpec
  /** One white key's width, px. */
  readonly ww: number
  /** Every key with any part on the strip, white keys first. */
  readonly keys: readonly StripKey[]
  /** Where a note's key is, or null for a note off the strip. */
  key(midi: number): StripKey | null
}

/** Narrower than this, a key the window cuts takes no taps. */
const MIN_ZONE = 40
/** The widest a black key's zone needs to be. */
const BLACK_ZONE = 44

/** The white keys from `lo` to `hi`, as MIDI numbers. */
export function whiteRange(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) out.push(m)
  return out
}

function clipZone(
  x: number,
  w: number,
  spec: StripSpec,
  y: number,
  h: number,
): StripKey['zone'] {
  const left = Math.max(spec.x0, x)
  const right = Math.min(spec.x1, x + w)
  const width = right - left
  return width >= Math.min(MIN_ZONE, w) - 0.001
    ? { x: left, y, w: width, h }
    : null
}

/** Lays the strip out: white keys edge to edge, the black keys over their joins. */
export function stripLayout(spec: StripSpec): Strip {
  const whites = whiteRange(spec.lo, spec.hi)
  const span = spec.x1 - spec.x0
  const count = spec.window?.keys ?? whites.length
  const from = spec.window?.from ?? 0
  const ww = span / count
  const bW = ww * 0.62
  const bH = spec.height * 0.62
  const xOfWhite = (i: number): number => spec.x0 + (i - from) * ww
  const onStrip = (x: number, w: number): boolean =>
    x + w > spec.x0 + 0.001 && x < spec.x1 - 0.001
  const keys: StripKey[] = []
  whites.forEach((midi, i) => {
    const x = xOfWhite(i)
    if (!onStrip(x, ww)) return
    keys.push({
      midi,
      white: true,
      cx: x + ww / 2,
      x,
      y: spec.top,
      w: ww,
      h: spec.height,
      zone: clipZone(x, ww, spec, spec.top, spec.height),
    })
  })
  const zoneW = Math.max(bW, Math.min(BLACK_ZONE, ww - 0.5))
  whites.forEach((midi, i) => {
    const black = midi + 1
    if (!isBlack(black) || black > spec.hi) return
    const cx = xOfWhite(i + 1)
    const x = cx - bW / 2
    if (!onStrip(x, bW)) return
    keys.push({
      midi: black,
      white: false,
      cx,
      x,
      y: spec.top,
      w: bW,
      h: bH,
      zone: clipZone(cx - zoneW / 2, zoneW, spec, spec.top, bH),
    })
  })
  return {
    spec,
    ww,
    keys,
    key: (midi) => keys.find((k) => k.midi === midi) ?? null,
  }
}

/** The note a tap at (x, y) lands on: a black key before the white key under it. */
export function stripHit(strip: Strip, x: number, y: number): number | null {
  const inside = (k: StripKey): boolean =>
    k.zone !== null &&
    x >= k.zone.x &&
    x < k.zone.x + k.zone.w &&
    y >= k.zone.y &&
    y < k.zone.y + k.zone.h
  const black = strip.keys.find((k) => !k.white && inside(k))
  if (black !== undefined) return black.midi
  return strip.keys.find((k) => k.white && inside(k))?.midi ?? null
}

/** How the toy wants each key painted. */
export interface StripLook {
  /** Lit keys: the scale's notes. Unlit keys stand back. */
  readonly lit: (midi: number) => boolean
  /** A key's name, or null for none. */
  readonly label: (midi: number) => Spelled | null
  /** 0 to 1: how strongly the key flashes now (it sounds). */
  readonly pulse: (midi: number) => number
  /** A ring round the key the keyboard focus is on, or none. */
  readonly focus?: number | null
}

function paintWhite(
  ctx: CanvasRenderingContext2D,
  k: StripKey,
  look: StripLook,
): void {
  const lit = look.lit(k.midi)
  const g = ctx.createLinearGradient(0, k.y, 0, k.y + k.h)
  g.addColorStop(0, lit ? KEY_LOOK.whiteTop : '#5d6874')
  g.addColorStop(1, lit ? KEY_LOOK.whiteBottom : '#465059')
  ctx.fillStyle = g
  ctx.beginPath()
  roundedRect(ctx, k.x + 0.75, k.y, k.w - 1.5, k.h, [0, 0, 4, 4])
  ctx.fill()
  const pulse = look.pulse(k.midi)
  if (pulse > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(0.75 * pulse).toFixed(3)})`
    ctx.fill()
  }
  const name = look.label(k.midi)
  if (name === null) return
  ctx.fillStyle = KEY_LOOK.whiteInk
  ctx.font = `600 ${Math.max(11, Math.min(14, k.w * 0.34))}px Outfit, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(signName(name, { octave: false }), k.cx, k.y + k.h - 8)
}

function paintBlack(
  ctx: CanvasRenderingContext2D,
  k: StripKey,
  look: StripLook,
): void {
  const lit = look.lit(k.midi)
  ctx.fillStyle = lit ? COLOR.chrome : KEY_LOOK.black
  ctx.strokeStyle = KEY_LOOK.blackEdge
  ctx.lineWidth = 1
  ctx.beginPath()
  roundedRect(ctx, k.x, k.y, k.w, k.h, [0, 0, 3, 3])
  ctx.fill()
  ctx.stroke()
  const pulse = look.pulse(k.midi)
  if (pulse > 0) {
    ctx.fillStyle = rgba('#ffffff', 0.7 * pulse)
    ctx.fill()
  }
  const name = look.label(k.midi)
  if (name === null) return
  ctx.fillStyle = lit ? COLOR.bg : COLOR.chrome
  ctx.font = `600 ${Math.max(10, Math.min(13, k.w * 0.42))}px Outfit, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(signName(name, { octave: false }), k.cx, k.y + k.h - 6)
}

/** Paints the strip, clipped to its edges: white keys, then black keys, then the focus ring. */
export function drawStrip(
  ctx: CanvasRenderingContext2D,
  strip: Strip,
  look: StripLook,
): void {
  const { spec } = strip
  ctx.save()
  ctx.beginPath()
  ctx.rect(spec.x0, spec.top - 1, spec.x1 - spec.x0, spec.height + 2)
  ctx.clip()
  for (const k of strip.keys) if (k.white) paintWhite(ctx, k, look)
  for (const k of strip.keys) if (!k.white) paintBlack(ctx, k, look)
  const focused = look.focus == null ? null : strip.key(look.focus)
  if (focused !== null) {
    ctx.strokeStyle = COLOR.aqua
    ctx.lineWidth = 2.5
    ctx.beginPath()
    roundedRect(
      ctx,
      focused.x + 2,
      focused.y + 2,
      focused.w - 4,
      focused.h - 4,
      3,
    )
    ctx.stroke()
  }
  ctx.restore()
}
