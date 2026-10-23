// ============================================================
// Lesson spiral keyboard — the piano the spiral unrolls into
// ============================================================
//
// A2 to A5 as keys, low notes left. On a wide canvas all 22 white keys fit;
// on a phone one octave fills the width and the toy pans between octaves.
// The same layout tells each bead where its key is as the spiral unrolls
// (spiral-draw.ts), and every key drawn is recorded, clipped to the visible
// keyboard, so a tap lands on the key the viewer saw. Lesson 1 names only
// the landmarks (the Cs, A3 and A4); a page can name every key, the black
// ones by the page's sharps-or-flats choice (names.ts).
//
// A page can fit the phone keyboard its own way (`KeyboardFit`): Lesson 2's
// runs edge to edge, so eight white keys of 44.5 px fill a 356 px figure.

import { clamp } from './dom'
import type { Spelling } from './names'
import { namesFor } from './names'
import { COLOR, letterOf, nameOf, rgba, signName } from './notes'

/** A2, the lowest bead. */
export const LO = 45
/** A2 to A5: 37 notes, three turns. */
export const N = 37

/** How far past a key's drawn edge, above and below, a tap still lands on it. */
export const KEY_SLOP = 10

/** How a key is painted, shared by every page that draws keys or tiles. */
export const KEY_LOOK = {
  /** A white key's face, top to bottom. */
  whiteTop: '#dfe6ee',
  whiteBottom: '#b9c3ce',
  /** Merc's A3 and Tavi's A4. */
  a3: '#9cc8ff',
  a4: '#ffb196',
  black: '#0d1117',
  blackEdge: 'rgba(195,204,214,.4)',
  /** A white key's name. */
  whiteInk: '#0d1117',
} as const

/** The notes with a letter of their own (the white keys), as semitones from A2. */
export const WHITE: number[] = []
for (let s = 0; s < N; s++) if (letterOf(LO + s) !== null) WHITE.push(s)

/** A note's place counted in white keys; a black key sits half a key past the white below it. */
export function wIndex(s: number): number {
  const wi = WHITE.indexOf(s)
  return wi >= 0 ? wi : WHITE.indexOf(s - 1) + 0.5
}

/** Where a key was drawn, clipped to the visible keyboard. */
export interface KeyHit {
  s: number
  x: number
  y: number
  w: number
  h: number
  white: boolean
}

/** Which keys carry their names: the landmarks (the Cs, A3 and A4), or every key. */
export type KeyLabels = 'landmarks' | 'all'

/** What the keyboard needs from the toy. */
export interface KeyboardView {
  narrow: boolean
  /** The phone keyboard's left edge, in white keys. */
  pan: number
  focused: boolean
  sel: number
  /** When each note last played, by MIDI number. */
  pulses: ReadonlyMap<number, number>
  keyLabels: KeyLabels
  /** The arc over A3 to A4, with its label; null for none. */
  span: string | null
  /** How the black keys are named, when every key carries its name. */
  spelling: Spelling
}

/** How the phone keyboard fills its canvas; each field defaults to Lesson 1's. */
export interface KeyboardFit {
  /** Px between the canvas edge and the keys (6 on a phone, 12 on a wide canvas). */
  readonly margin?: number
  /** White keys the phone keyboard shows at once (8, an octave). */
  readonly visible?: number
}

type KeyPos = { x: number; y: number; white: boolean; wi: number }

/** A rounded rectangle path, or a square one on a canvas without roundRect. */
export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: number | number[],
): void {
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, radii)
  else ctx.rect(x, y, w, h)
}

/** A key or bead flashes for 0.7 s after its note plays. */
export function pulseOf(
  pulses: ReadonlyMap<number, number>,
  m: number,
  now: number,
): number {
  const t = pulses.get(m)
  return t !== undefined ? Math.max(0, 1 - (now - t) / 700) : 0
}

/**
 * The keyboard on a W x H canvas: A2..A5, low notes left; on a phone one
 * octave fills the width (white keys about 40 px, black about 25).
 */
export function keyboardLayout(
  W: number,
  H: number,
  narrow: boolean,
  pan: number,
  fit: KeyboardFit = {},
) {
  const km = fit.margin ?? (narrow ? 6 : 12)
  const kbW = W - 2 * km
  const vis = narrow ? (fit.visible ?? 8) : WHITE.length
  const off = narrow ? pan : 0
  const ww = kbW / vis
  const kbTop = H * 0.36
  const kbH = Math.min(H * 0.44, ww * 6.2)
  const bH = kbH * 0.62
  const bW = ww * 0.62
  const xOfW = (wi: number): number => km + (wi - off) * ww
  const keyPos = (s: number): KeyPos => {
    const wi = WHITE.indexOf(s)
    if (wi >= 0) {
      return { x: xOfW(wi + 0.5), y: kbTop + kbH * 0.8, white: true, wi }
    }
    const left = WHITE.indexOf(s - 1)
    return { x: xOfW(left + 1), y: kbTop + bH * 0.72, white: false, wi: left }
  }
  return { H, km, kbW, ww, kbTop, kbH, bH, bW, xOfW, keyPos }
}

export type Keyboard = ReturnType<typeof keyboardLayout>

/** One keyboard frame: the canvas, the layout, the toy's state and the time. */
interface KeyFrame {
  ctx: CanvasRenderingContext2D
  kb: Keyboard
  view: KeyboardView
  now: number
}

const visible = (kb: Keyboard, x: number, w: number): boolean =>
  x + w > kb.km && x < kb.km + kb.kbW

function drawWhiteKeys(k: KeyFrame, hits: KeyHit[]): void {
  const { ctx, kb, view, now } = k
  const { km, kbW, ww, kbTop, kbH, xOfW } = kb
  for (let i = 0; i < WHITE.length; i++) {
    const s = WHITE[i]
    const m = LO + s
    const x = xOfW(i)
    if (!visible(kb, x, ww)) continue
    const pulse = pulseOf(view.pulses, m, now)
    const g = ctx.createLinearGradient(0, kbTop, 0, kbTop + kbH)
    g.addColorStop(0, KEY_LOOK.whiteTop)
    g.addColorStop(1, KEY_LOOK.whiteBottom)
    ctx.fillStyle = m === 57 ? KEY_LOOK.a3 : m === 69 ? KEY_LOOK.a4 : g
    ctx.beginPath()
    roundedRect(ctx, x + 0.75, kbTop, ww - 1.5, kbH, [0, 0, 4, 4])
    ctx.fill()
    if (pulse > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(0.7 * pulse).toFixed(3)})`
      ctx.fill()
    }
    const x0 = Math.max(km, x)
    const x1 = Math.min(km + kbW, x + ww)
    hits.push({ s, x: x0, y: kbTop, w: x1 - x0, h: kbH, white: true })
    const landmark = m === 48 || m === 60 || m === 72 || m === 57 || m === 69
    if (landmark || view.keyLabels === 'all') {
      const size = Math.max(10, Math.min(13, ww * 0.42))
      ctx.fillStyle = KEY_LOOK.whiteInk
      ctx.font = `600 ${size}px Outfit, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(nameOf(m) ?? '', x + ww / 2, kbTop + kbH - 7)
    }
  }
}

/** A black key's names in its lower half, one per line, the sharp above the flat. */
function drawBlackKeyNames(k: KeyFrame, m: number, x: number): void {
  const { ctx, kb, view } = k
  const names = namesFor(m, view.spelling)
  const size = Math.max(9, Math.min(12, kb.bW * 0.44))
  ctx.font = `600 ${size}px Outfit, sans-serif`
  ctx.fillStyle = COLOR.chrome
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  names.forEach((n, i) => {
    const y = kb.kbTop + kb.bH - 6 - (names.length - 1 - i) * (size + 2)
    ctx.fillText(signName(n, { octave: false }), x + kb.bW / 2, y)
  })
}

// the black keys go to the front of the hit list, so a tap tries them first
function drawBlackKeys(k: KeyFrame, hits: KeyHit[]): void {
  const { ctx, kb, view, now } = k
  const { kbTop, bH, bW, keyPos } = kb
  for (let s = 0; s < N; s++) {
    if (letterOf(LO + s) !== null) continue
    const kp = keyPos(s)
    const m = LO + s
    const x = kp.x - bW / 2
    if (!visible(kb, x, bW)) continue
    const pulse = pulseOf(view.pulses, m, now)
    ctx.fillStyle = KEY_LOOK.black
    ctx.strokeStyle = KEY_LOOK.blackEdge
    ctx.lineWidth = 1
    ctx.beginPath()
    roundedRect(ctx, x, kbTop, bW, bH, [0, 0, 3, 3])
    ctx.fill()
    ctx.stroke()
    if (pulse > 0) {
      ctx.fillStyle = rgba(COLOR.chrome, 0.7 * pulse)
      ctx.fill()
    }
    if (view.keyLabels === 'all') drawBlackKeyNames(k, m, x)
    hits.unshift({ s, x, y: kbTop, w: bW, h: bH, white: false })
  }
}

// the keyboard's own focus: the selected key carries an aqua outline
function drawKeyFocus(k: KeyFrame): void {
  const { ctx, kb, view } = k
  const { ww, kbTop, kbH, bH, bW, xOfW, keyPos } = kb
  const kp = keyPos(view.sel)
  const x = kp.white ? xOfW(kp.wi) + 0.75 : kp.x - bW / 2
  const w = kp.white ? ww - 1.5 : bW
  const h = kp.white ? kbH : bH
  ctx.strokeStyle = COLOR.aqua
  ctx.lineWidth = 2.5
  ctx.beginPath()
  roundedRect(ctx, x + 1, kbTop + 1, w - 2, h - 2, 3)
  ctx.stroke()
}

// octave numbers change at C
function drawOctaveNumbers(k: KeyFrame): void {
  const { ctx, kb } = k
  const { km, kbW, kbTop, kbH, xOfW } = kb
  const by = kbTop + kbH + 18
  ctx.font = '500 12px "JetBrains Mono", monospace'
  ctx.textBaseline = 'middle'
  const cs = [0, 3, 15, 27, 37] // A2 | C3 | C4 | C5 | end (semitones from A2)
  cs.slice(0, -1).forEach((s, i) => {
    const next = cs[i + 1]
    const xa = clamp(xOfW(s === 0 ? 0 : WHITE.indexOf(s)), km, km + kbW)
    const xb = clamp(
      xOfW(next === 37 ? WHITE.length : WHITE.indexOf(next)),
      km,
      km + kbW,
    )
    if (xb - xa < 24) return
    ctx.strokeStyle = 'rgba(195,204,214,.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(xa + 2, by - 5)
    ctx.lineTo(xa + 2, by)
    ctx.lineTo(xb - 2, by)
    ctx.lineTo(xb - 2, by - 5)
    ctx.stroke()
    const lbl = xb - xa > 96 ? `OCTAVE ${2 + i}` : String(2 + i)
    ctx.fillStyle = COLOR.card
    const tw = ctx.measureText(lbl).width + 12
    ctx.fillRect((xa + xb) / 2 - tw / 2, by - 7, tw, 14)
    ctx.fillStyle = COLOR.ink3
    ctx.textAlign = 'center'
    ctx.fillText(lbl, (xa + xb) / 2, by)
  })
}

// A3 to A4, labelled (a chrome hairline: it is a distance, not a fit)
function drawOctaveSpan(k: KeyFrame, label: string): void {
  const { ctx, kb } = k
  const { km, kbW, kbTop, keyPos } = kb
  const a3 = keyPos(12)
  const a4 = keyPos(24)
  const ay = kbTop - 16
  if (a3.x > km && a4.x < km + kbW) {
    ctx.strokeStyle = rgba(COLOR.chrome, 0.7)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(a3.x, kbTop - 4)
    ctx.bezierCurveTo(a3.x, ay - 10, a4.x, ay - 10, a4.x, kbTop - 4)
    ctx.stroke()
    ctx.fillStyle = COLOR.chrome
    ctx.font = '600 14px Outfit, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(label, (a3.x + a4.x) / 2, ay - 9)
  }
}

/** Draws the keyboard, faded in by `ka`, and returns where each key landed. */
export function drawKeyboard(
  ctx: CanvasRenderingContext2D,
  kb: Keyboard,
  view: KeyboardView,
  now: number,
  ka: number,
): KeyHit[] {
  const k: KeyFrame = { ctx, kb, view, now }
  const hits: KeyHit[] = []
  ctx.save()
  ctx.beginPath()
  ctx.rect(kb.km - 1, 0, kb.kbW + 2, kb.H)
  ctx.clip()
  ctx.globalAlpha = ka
  drawWhiteKeys(k, hits)
  drawBlackKeys(k, hits)
  if (view.focused && ka > 0.5) drawKeyFocus(k)
  drawOctaveNumbers(k)
  if (view.span !== null) drawOctaveSpan(k, view.span)
  ctx.globalAlpha = 1
  ctx.restore()
  return hits
}
