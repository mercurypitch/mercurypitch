// ============================================================
// Lesson spiral drawing — one frame of the helix, its beads and the keyboard
// ============================================================
//
// The beads sit on a helix at 30 degrees per semitone, so every A faces the
// front one turn apart and every C sits on one seam, where the octave number
// goes up. Unrolling moves each bead onto its piano key (spiral-keys.ts),
// the low notes first, while the camera tilts down to the keyboard's plane.
// The helix is drawn back to front by depth, and a frame returns where it
// drew each bead and key, so the toy tests a tap against exactly what the
// viewer saw. The focus ring and the name tag go on top, last.
//
// A black key's bead stays a faint disc with a "?" (Lesson 1's five notes
// with no letter) until its copy of the spiral lights it; a lit bead glows
// and carries its names in the page's spelling (names.ts).
//
// Two things a page may add. Looking down the axis (`top`, 0 to 1) tilts the
// camera over the spiral and flattens its turns, so one turn becomes a ring
// of twelve and the other two fade. And a page may draw the unrolled keys
// itself (`layer`): it says where each note's key is, so the beads unroll
// onto it, draws it, and hands back the tap targets.

import { clamp, easeInOut, lerp, smooth, TAU } from './dom'
import type { Spelling } from './names'
import { namesFor } from './names'
import { COLOR, letterOf, nameOf, noteColor, rgba, signName } from './notes'
import type { KeyboardView, KeyHit } from './spiral-keys'
import { drawKeyboard, keyboardLayout, LO, N, pulseOf, roundedRect, } from './spiral-keys'

/** A tapped bead carries its name tag this long, ms. */
export const TAG_MS = 1800

/** Where a bead was drawn: its semitone from A2, centre, radius and depth. */
export interface BeadHit {
  s: number
  x: number
  y: number
  r: number
  z: number
}

/** Beads with a letter carry it on the bead ('letter'), or their full name beside it ('name'). */
export type BeadLabels = 'letter' | 'name'

/** A page's own drawing of the unrolled keys, in place of the kit's keyboard. */
export interface KeysLayer {
  /** Where note `s` (semitones from A2) sits once unrolled: its bead lands here. */
  keyPos(s: number): { x: number; y: number }
  /** Draws the keys, faded in by `ka`, and returns where each one takes taps. */
  draw(ctx: CanvasRenderingContext2D, ka: number): KeyHit[]
}

/** What one frame needs from the toy. */
export interface SpiralView extends KeyboardView {
  yaw: number
  /** 0 is the spiral, 1 the keyboard. */
  u: number
  labels: BeadLabels
  /** The black keys lit on this copy, by MIDI number. */
  lit: ReadonlySet<number>
  /** 0 looks at the spiral from the side, 1 straight down its axis (default 0). */
  top?: number
  /** The first note of the turn that stays lit from above, semitones from A2 (default 12, A3). */
  ringFrom?: number
  /** The page's own keys; default the kit's keyboard. */
  layer?: KeysLayer
}

/** What the overlays need: the selection, the pointer's hover, the last tap and the tag's text. */
export interface OverlayView {
  u: number
  focused: boolean
  sel: number
  hover: number | null
  tapLabel: { s: number; t: number } | null
  /** A bead's name tag: "A3 · 220 Hz". */
  tag: (midi: number) => string
}

type Point = { x: number; y: number; z: number; p: number }
/** A stretch of the helix line (`sf`, where it starts), the C seam, or the column of As. */
type Line = {
  kind: 'seg' | 'seam' | 'col'
  z: number
  a: Point
  b: Point
  sf?: number
}
type Bead = Point & { kind: 'bead'; s: number; e: number }

/** One frame: the canvas, the toy's state, the helix and the keyboard on it. */
interface Scene {
  ctx: CanvasRenderingContext2D
  now: number
  view: SpiralView
  /** The helix's radius, and how far it has unrolled, eased. */
  R: number
  eu: number
  /** How far the keyboard has faded in. */
  ka: number
  proj: (sf: number) => Point
  /** Where each note's key is, for the beads that unroll onto it. */
  keyPos: (s: number) => { x: number; y: number }
}

/**
 * How much of a part outside the lit turn shows from above: all of it from
 * the side, none from straight down. The turn's twelve beads run from
 * `ringFrom` to 11 semitones above it; its line runs on to close the ring.
 */
function ringFade(view: SpiralView, sf: number, upTo = 11): number {
  const top = view.top ?? 0
  if (top === 0) return 1
  const from = view.ringFrom ?? 12
  return sf >= from - 0.001 && sf <= from + upTo + 0.001 ? 1 : 1 - top
}

/** A bead as drawn this frame. */
interface BeadLook {
  m: number
  x: number
  y: number
  /** Its perspective scale, and its radius. */
  p: number
  r0: number
  pulse: number
  alpha: number
}

/** 30 degrees per semitone; A at 0 (the front), B 60, C 90, D 150, E 210, F 240, G 300. */
const angleOf = (s: number): number => (s * Math.PI) / 6

// helix projection; the camera tilts down towards the keyboard's plane as the spiral unrolls,
// and looking down (`top`) tilts it over the axis while the turns flatten into one ring
function helix(W: number, H: number, yaw: number, eu: number, top = 0) {
  const R = Math.min(W * 0.27, H * 0.29)
  const turnH = H * 0.185 * (1 - top)
  const side = 0.34 + 0.55 * eu
  const tilt = side + (Math.PI / 2 - side) * top
  const fdist = R * 4.2
  const cx = W / 2
  const cy = H * 0.52
  const proj = (sf: number): Point => {
    const a = angleOf(sf) + yaw
    const X = R * Math.sin(a)
    const Z = R * Math.cos(a)
    const Y = ((sf - 18) * turnH) / 12
    const yy = Y * Math.cos(tilt) - Z * Math.sin(tilt)
    const z = Z * Math.cos(tilt) + Y * Math.sin(tilt)
    // never behind the eye, even on a canvas not yet laid out (a sliver wide)
    const p = fdist / Math.max(fdist - z, fdist * 0.2)
    return { x: cx + X * p, y: cy - yy * p, z, p }
  }
  return { R, proj }
}

/** The helix line in short segments, every bead, the column of As and the C seam, back to front. */
function helixItems(sc: Scene, la: number): (Line | Bead)[] {
  const { view, R, eu, proj } = sc
  const items: (Line | Bead)[] = []
  if (la > 0) {
    let prev = proj(0)
    for (let i = 1; i <= 36 * 6; i++) {
      const sf = i / 6
      const p = proj(sf)
      items.push({
        kind: 'seg',
        z: (p.z + prev.z) / 2,
        a: prev,
        b: p,
        sf: (i - 1) / 6,
      })
      prev = p
    }
  }
  for (let s = 0; s < N; s++) {
    const hp = proj(s)
    const lp = clamp(eu * 1.6 - (s / 36) * 0.6, 0, 1)
    const e = easeInOut(lp)
    let x = hp.x
    let y = hp.y
    let p = hp.p
    if (view.u > 0) {
      const kp = sc.keyPos(s)
      x = lerp(hp.x, kp.x, e)
      y = lerp(hp.y, kp.y, e)
      p = lerp(hp.p, 1, e)
    }
    items.push({ kind: 'bead', z: lerp(hp.z, R * 2, e), s, x, y, p, e })
  }
  // the line through every A: they all sit at 0 degrees, stacked one turn apart (chrome: a column, not a fit)
  if (la > 0) {
    items.push({ kind: 'col', z: proj(18).z - 0.01, a: proj(0), b: proj(36) })
  }
  // the C seam: every C sits at 90 degrees, and the octave number goes up there (B3, then C4)
  if (la > 0) {
    items.push({
      kind: 'seam',
      z: proj(15).z - 0.01,
      a: proj(3),
      b: proj(27),
    })
  }
  return items.sort((a, b) => a.z - b.z)
}

/** A stretch of the helix, the C seam or the column of As, fading out by `la`. */
function drawLine(
  ctx: CanvasRenderingContext2D,
  it: Line,
  R: number,
  la: number,
): void {
  if (it.kind === 'seg') {
    const dn = (it.z + R) / (2 * R)
    const a = ((0.12 + 0.4 * dn) * la).toFixed(3)
    ctx.strokeStyle = `rgba(195,204,214,${a})`
    ctx.lineWidth = 1 + 1.8 * dn
    ctx.beginPath()
    ctx.moveTo(it.a.x, it.a.y)
    ctx.lineTo(it.b.x, it.b.y)
    ctx.stroke()
  } else if (it.kind === 'seam') {
    ctx.setLineDash([1.5, 4])
    ctx.strokeStyle = `rgba(195,204,214,${(0.5 * la).toFixed(3)})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(it.a.x, it.a.y + 16)
    ctx.lineTo(it.b.x, it.b.y - 16)
    ctx.stroke()
    ctx.setLineDash([])
  } else {
    ctx.setLineDash([3, 5])
    ctx.strokeStyle = rgba(COLOR.chrome, 0.42 * la)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(it.a.x, it.a.y + 10)
    ctx.lineTo(it.b.x, it.b.y - 14)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

// a C carries its name and number beside a tick: the octave number goes up there
function drawCName(sc: Scene, b: BeadLook): void {
  const { ctx, ka } = sc
  const { m, x, y, r0, alpha } = b
  ctx.globalAlpha = alpha * (1 - ka)
  ctx.strokeStyle = 'rgba(195,204,214,.6)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x - r0 - 9, y)
  ctx.lineTo(x + r0 + 9, y)
  ctx.stroke()
  ctx.font = '500 12px "JetBrains Mono", monospace'
  ctx.fillStyle = COLOR.chrome
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(nameOf(m) ?? '', x + r0 + 12, y)
  ctx.globalAlpha = alpha
}

// the letter sits on the bead, or the full name beside it (a C has its own)
function drawBeadLetter(sc: Scene, b: BeadLook, L: string): void {
  const { ctx, view } = sc
  const { m, x, y, p, r0 } = b
  const beside = view.labels === 'name'
  const lab = beside ? (nameOf(m) ?? '') : L
  ctx.textBaseline = 'middle'
  if (!beside) {
    ctx.font = `600 ${Math.round(11 * p)}px Outfit, sans-serif`
    ctx.fillStyle = '#0d1117'
    ctx.textAlign = 'center'
    ctx.fillText(lab, x, y + 0.5)
  } else if (L !== 'C') {
    ctx.font = `600 ${Math.round(13 * p)}px Outfit, sans-serif`
    ctx.fillStyle = L === 'A' ? noteColor(m) : COLOR.ink
    ctx.textAlign = 'left'
    ctx.fillText(lab, x + r0 + 4, y)
  }
}

// a note with a letter: a glow, a lit sphere, a ring round the chrome As, then its labels
function drawNamedBead(sc: Scene, b: BeadLook, L: string): void {
  const { ctx, ka } = sc
  const { m, x, y, r0, pulse } = b
  const isA = L === 'A'
  const col = noteColor(m)
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r0 * 2.4)
  glow.addColorStop(0, rgba(col, isA ? 0.42 : 0.2 + 0.4 * pulse))
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, r0 * 2.4, 0, TAU)
  ctx.fill()
  const hl = r0 * 0.35
  const g = ctx.createRadialGradient(x - hl, y - hl, r0 * 0.1, x, y, r0)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.45, col)
  g.addColorStop(1, m === 57 ? '#1d4f8f' : m === 69 ? '#8f2d12' : '#4a5563')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r0, 0, TAU)
  ctx.fill()
  if (isA && m !== 57 && m !== 69) {
    ctx.strokeStyle = rgba(COLOR.chrome, 0.8)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(x, y, r0 + 2.5, 0, TAU)
    ctx.stroke()
  }
  if (L === 'C' && ka < 0.6) drawCName(sc, b)
  if (ka < 0.6) drawBeadLetter(sc, b, L)
}

// a note without a letter of its own: a faint disc, and a '?' on the near side before the keys show
function drawPlainBead(sc: Scene, b: BeadLook): void {
  const { ctx, ka } = sc
  const { x, y, p, r0, pulse } = b
  ctx.fillStyle = `rgba(195,204,214,${(0.22 + 0.25 * pulse).toFixed(3)})`
  ctx.strokeStyle = 'rgba(195,204,214,.45)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, r0, 0, TAU)
  ctx.fill()
  ctx.stroke()
  if (ka < 0.4 && p > 0.92) {
    ctx.fillStyle = COLOR.ink3
    ctx.font = `500 ${Math.round(10 * p)}px "JetBrains Mono", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('?', x, y + 0.5)
  }
}

/** A lit black-key bead's names beside it, one per line, in the page's spelling. */
function drawLitNames(sc: Scene, b: BeadLook, spelling: Spelling): void {
  const { ctx } = sc
  const { m, x, y, p, r0 } = b
  const names = namesFor(m, spelling)
  const size = Math.round(12 * p)
  ctx.font = `600 ${size}px Outfit, sans-serif`
  ctx.fillStyle = COLOR.ink
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const top = y - ((names.length - 1) * (size + 1)) / 2
  names.forEach((n, i) => {
    ctx.fillText(
      signName(n, { octave: sc.view.labels === 'name' }),
      x + r0 + 4,
      top + i * (size + 1),
    )
  })
}

// a black key its copy has heard: a chrome sphere with a glow, and its names beside it
function drawLitBead(sc: Scene, b: BeadLook): void {
  const { ctx, ka, view } = sc
  const { x, y, r0, pulse } = b
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r0 * 2.6)
  glow.addColorStop(0, rgba(COLOR.chrome, 0.34 + 0.3 * pulse))
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, r0 * 2.6, 0, TAU)
  ctx.fill()
  const hl = r0 * 0.35
  const g = ctx.createRadialGradient(x - hl, y - hl, r0 * 0.1, x, y, r0)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.45, COLOR.chrome)
  g.addColorStop(1, '#4a5563')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r0, 0, TAU)
  ctx.fill()
  if (ka < 0.4 && b.p > 0.92) drawLitNames(sc, b, view.spelling)
}

/** One bead; null when it has faded out and is neither drawn nor tappable. */
function drawBead(sc: Scene, it: Bead): BeadHit | null {
  const { ctx, now, view, R, ka } = sc
  const { s, x, y, z, p, e } = it
  const m = LO + s
  const L = letterOf(m)
  const isA = L === 'A'
  const dn = clamp((z + R) / (2 * R), 0, 1)
  const depthA = lerp(0.38 + 0.62 * dn, 1, e)
  const fadeOnKeys = isA ? 1 : 1 - ka
  const alpha = depthA * fadeOnKeys * ringFade(view, s)
  if (alpha < 0.02) return null
  const pulse = pulseOf(view.pulses, m, now)
  const grow = 1 + 0.35 * pulse
  const size = L !== null ? 10.5 : 6.5
  const r0 = size * p * lerp(1, isA ? 0.7 : 0.5, ka) * grow
  const look: BeadLook = { m, x, y, p, r0, pulse, alpha }
  ctx.globalAlpha = alpha
  if (L !== null) drawNamedBead(sc, look, L)
  else if (view.lit.has(m)) drawLitBead(sc, look)
  else drawPlainBead(sc, look)
  ctx.globalAlpha = 1
  return { s, x, y, r: r0, z }
}

/** A line's share of the light from above: a helix stretch on the lit turn keeps it, the seam and the column fade. */
function lineFade(view: SpiralView, it: Line): number {
  if (it.kind === 'seg') return ringFade(view, it.sf ?? 0, 11.84)
  return 1 - (view.top ?? 0)
}

function drawHelix(sc: Scene): BeadHit[] {
  // helix line (fades as it unrolls)
  const la = 1 - smooth(0, 0.4, sc.view.u)
  const drawn: BeadHit[] = []
  for (const it of helixItems(sc, la)) {
    if (it.kind !== 'bead') {
      drawLine(sc.ctx, it, sc.R, la * lineFade(sc.view, it))
      continue
    }
    const hit = drawBead(sc, it)
    if (hit !== null) drawn.push(hit)
  }
  return drawn
}

/** Draws one frame, the keyboard under everything, and returns where each bead and key landed. */
export function drawSpiral(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  now: number,
  view: SpiralView,
): { hits: BeadHit[]; keyHits: KeyHit[] } {
  const eu = easeInOut(view.u)
  const { R, proj } = helix(W, H, view.yaw, eu, view.top)
  const layer = view.layer
  const kb = keyboardLayout(W, H, view.narrow, view.pan)
  const ka = smooth(0.45, 1, view.u)
  // draw the keys under everything
  let keyHits: KeyHit[] = []
  if (ka > 0)
    keyHits =
      layer === undefined
        ? drawKeyboard(ctx, kb, view, now, ka)
        : layer.draw(ctx, ka)
  const keyPos =
    layer === undefined ? kb.keyPos : (s: number) => layer.keyPos(s)
  const hits = drawHelix({ ctx, now, view, R, eu, ka, proj, keyPos })
  return { hits, keyHits }
}

// a bead's name and frequency in a pill above it (below it near the top edge)
function drawNameTag(
  ctx: CanvasRenderingContext2D,
  W: number,
  th: BeadHit,
  tag: (midi: number) => string,
): void {
  const m = LO + th.s
  const txt = tag(m)
  ctx.font = '600 14px Outfit, sans-serif'
  const tw = ctx.measureText(txt).width + 20
  let tx = th.x - tw / 2
  let ty = th.y - th.r - 36
  tx = clamp(tx, 6, W - tw - 6)
  if (ty < 6) ty = th.y + th.r + 10
  ctx.fillStyle = 'rgba(13,17,23,.92)'
  ctx.strokeStyle = rgba(noteColor(m), 0.7)
  ctx.lineWidth = 1
  ctx.beginPath()
  roundedRect(ctx, tx, ty, tw, 26, 13)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = m === 57 || m === 69 ? noteColor(m) : COLOR.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(txt, tx + tw / 2, ty + 13.5)
}

/** The focus ring and the name tag, over the spiral only; drawn after everything else. */
export function drawOverlays(
  ctx: CanvasRenderingContext2D,
  W: number,
  now: number,
  hits: BeadHit[],
  o: OverlayView,
): void {
  const { u, focused, sel, hover, tapLabel, tag } = o
  // the keyboard's own focus on the spiral: an aqua ring round the selected bead
  if (focused && u < 0.6) {
    const h = hits.find((b) => b.s === sel)
    if (h) {
      ctx.strokeStyle = COLOR.aqua
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(h.x, h.y, h.r + 5, 0, TAU)
      ctx.stroke()
    }
  }
  // every bead carries its letter and number on hover, on tap, or under the keyboard's selection
  const tipS =
    hover ??
    (tapLabel !== null && now - tapLabel.t < TAG_MS
      ? tapLabel.s
      : focused
        ? sel
        : null)
  const th = hits.find((h) => h.s === tipS)
  if (th && u < 0.6) drawNameTag(ctx, W, th, tag)
}
