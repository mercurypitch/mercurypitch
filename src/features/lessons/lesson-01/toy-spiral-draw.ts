// ============================================================
// Lesson 1 spiral drawing — one frame of the helix, its beads and the keyboard
// ============================================================
//
// The beads sit on a helix at 30 degrees per semitone, so every A faces the
// front one turn apart and every C sits on one seam, where the octave number
// goes up. Unrolling moves each bead onto its piano key, the low notes first,
// while the camera tilts down to the keyboard's plane. The helix is drawn
// back to front by depth, and a frame returns where it drew each bead and
// key, so the toy tests a tap against exactly what the viewer saw. The focus
// ring and the name tag over the spiral are the toy's own (toy-spiral.ts).

import { clamp, easeInOut, lerp, smooth, TAU } from '@/features/lessons/kit/dom'
import { COLOR, letterOf, nameOf, rgba } from '@/features/lessons/kit/notes'

/** A2, the lowest bead. */
export const LO = 45
/** A2 to A5: 37 notes, three turns. */
export const N = 37

/** The notes with a letter of their own (the white keys), as semitones from A2. */
export const WHITE: number[] = []
for (let s = 0; s < N; s++) if (letterOf(LO + s) !== null) WHITE.push(s)

/** 30 degrees per semitone; A at 0 (the front), B 60, C 90, D 150, E 210, F 240, G 300. */
const angleOf = (s: number): number => (s * Math.PI) / 6

/** Where a bead was drawn: its semitone from A2, centre, radius and depth. */
export interface BeadHit {
  s: number
  x: number
  y: number
  r: number
  z: number
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

/** What one frame needs from the toy. */
export interface SpiralView {
  yaw: number
  /** 0 is the spiral, 1 the keyboard. */
  u: number
  narrow: boolean
  /** The phone keyboard's left edge, in white keys. */
  pan: number
  focused: boolean
  sel: number
  step6: boolean
  /** When each note last played, by MIDI number. */
  pulses: ReadonlyMap<number, number>
}

type Point = { x: number; y: number; z: number; p: number }
type Line = { kind: 'seg' | 'seam' | 'col'; z: number; a: Point; b: Point }
type Bead = Point & { kind: 'bead'; s: number; e: number }
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

/** Draws one frame, the keyboard under everything, and returns where each bead and key landed. */
export function drawSpiral(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  now: number,
  view: SpiralView,
): { hits: BeadHit[]; keyHits: KeyHit[] } {
  const { yaw, u, narrow, pan, focused, sel, step6, pulses } = view
  const eu = easeInOut(u)
  // helix projection; the camera tilts down towards the keyboard's plane as the spiral unrolls
  const R = Math.min(W * 0.27, H * 0.29)
  const turnH = H * 0.185
  const tilt = 0.34 + 0.55 * eu
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
    const p = fdist / (fdist - z)
    return { x: cx + X * p, y: cy - yy * p, z, p }
  }
  // keyboard layout: A2..A5, low notes left; on a phone one octave fills the width (white keys about 40 px, black about 25)
  const km = narrow ? 6 : 12
  const kbW = W - 2 * km
  const vis = narrow ? 8 : WHITE.length
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
  const ka = smooth(0.45, 1, u)
  // a key or bead flashes for 0.7 s after its note plays
  const pulseOf = (m: number): number => {
    const t = pulses.get(m)
    return t !== undefined ? Math.max(0, 1 - (now - t) / 700) : 0
  }

  function drawKeyboard(): KeyHit[] {
    const drawn: KeyHit[] = []
    ctx.save()
    ctx.beginPath()
    ctx.rect(km - 1, 0, kbW + 2, H)
    ctx.clip()
    ctx.globalAlpha = ka
    const visible = (x: number, w: number): boolean =>
      x + w > km && x < km + kbW
    for (let i = 0; i < WHITE.length; i++) {
      const s = WHITE[i]
      const m = LO + s
      const x = xOfW(i)
      if (!visible(x, ww)) continue
      const pulse = pulseOf(m)
      const g = ctx.createLinearGradient(0, kbTop, 0, kbTop + kbH)
      g.addColorStop(0, '#dfe6ee')
      g.addColorStop(1, '#b9c3ce')
      ctx.fillStyle = m === 57 ? '#9cc8ff' : m === 69 ? '#ffb196' : g
      ctx.beginPath()
      roundedRect(ctx, x + 0.75, kbTop, ww - 1.5, kbH, [0, 0, 4, 4])
      ctx.fill()
      if (pulse > 0) {
        ctx.fillStyle = `rgba(255,255,255,${(0.7 * pulse).toFixed(3)})`
        ctx.fill()
      }
      const x0 = Math.max(km, x)
      const x1 = Math.min(km + kbW, x + ww)
      drawn.push({ s, x: x0, y: kbTop, w: x1 - x0, h: kbH, white: true })
      if (m === 48 || m === 60 || m === 72 || m === 57 || m === 69) {
        const size = Math.max(10, Math.min(13, ww * 0.42))
        ctx.fillStyle = '#0d1117'
        ctx.font = `600 ${size}px Outfit, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(nameOf(m) ?? '', x + ww / 2, kbTop + kbH - 7)
      }
    }
    for (let s = 0; s < N; s++) {
      if (letterOf(LO + s) !== null) continue
      const k = keyPos(s)
      const m = LO + s
      const x = k.x - bW / 2
      if (!visible(x, bW)) continue
      const pulse = pulseOf(m)
      ctx.fillStyle = '#0d1117'
      ctx.strokeStyle = 'rgba(195,204,214,.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      roundedRect(ctx, x, kbTop, bW, bH, [0, 0, 3, 3])
      ctx.fill()
      ctx.stroke()
      if (pulse > 0) {
        ctx.fillStyle = rgba(COLOR.chrome, 0.7 * pulse)
        ctx.fill()
      }
      drawn.unshift({ s, x, y: kbTop, w: bW, h: bH, white: false })
    }
    // the keyboard's own focus: the selected key carries an aqua outline
    if (focused && ka > 0.5) {
      const k = keyPos(sel)
      const x = k.white ? xOfW(k.wi) + 0.75 : k.x - bW / 2
      const w = k.white ? ww - 1.5 : bW
      const h = k.white ? kbH : bH
      ctx.strokeStyle = COLOR.aqua
      ctx.lineWidth = 2.5
      ctx.beginPath()
      roundedRect(ctx, x + 1, kbTop + 1, w - 2, h - 2, 3)
      ctx.stroke()
    }
    // octave numbers change at C
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
    // A3 to A4: seven white keys (a chrome hairline: it is a distance, not a fit)
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
      ctx.fillText('A3 to A4: seven white keys', (a3.x + a4.x) / 2, ay - 9)
    }
    ctx.globalAlpha = 1
    ctx.restore()
    return drawn
  }

  /** One bead; null when it has faded out and is neither drawn nor tappable. */
  function drawBead(it: Bead): BeadHit | null {
    const { s, x, y, z, p, e } = it
    const m = LO + s
    const L = letterOf(m)
    const named = L !== null
    const isA = L === 'A'
    const dn = clamp((z + R) / (2 * R), 0, 1)
    const depthA = lerp(0.38 + 0.62 * dn, 1, e)
    const fadeOnKeys = isA ? 1 : 1 - ka
    const alpha = depthA * fadeOnKeys
    if (alpha < 0.02) return null
    const pulse = pulseOf(m)
    const grow = 1 + 0.35 * pulse
    const r0 = (named ? 10.5 : 6.5) * p * lerp(1, isA ? 0.7 : 0.5, ka) * grow
    const col = m === 57 ? COLOR.blue : m === 69 ? COLOR.orange : COLOR.chrome
    ctx.globalAlpha = alpha
    if (named) {
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
      if (L === 'C' && ka < 0.6) {
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
      if (ka < 0.6) {
        const lab = step6 ? (nameOf(m) ?? '') : L
        ctx.textBaseline = 'middle'
        if (!step6) {
          ctx.font = `600 ${Math.round(11 * p)}px Outfit, sans-serif`
          ctx.fillStyle = '#0d1117'
          ctx.textAlign = 'center'
          ctx.fillText(lab, x, y + 0.5)
        } else if (L !== 'C') {
          ctx.font = `600 ${Math.round(13 * p)}px Outfit, sans-serif`
          ctx.fillStyle = isA ? col : COLOR.ink
          ctx.textAlign = 'left'
          ctx.fillText(lab, x + r0 + 4, y)
        }
      }
    } else {
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
    ctx.globalAlpha = 1
    return { s, x, y, r: r0, z }
  }

  function drawHelix(): BeadHit[] {
    // helix line (fades as it unrolls)
    const la = 1 - smooth(0, 0.4, u)
    const items: (Line | Bead)[] = []
    if (la > 0) {
      let prev = proj(0)
      for (let i = 1; i <= 36 * 6; i++) {
        const sf = i / 6
        const p = proj(sf)
        items.push({ kind: 'seg', z: (p.z + prev.z) / 2, a: prev, b: p })
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
      if (u > 0) {
        const kp = keyPos(s)
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
    items.sort((a, b) => a.z - b.z)
    const drawn: BeadHit[] = []
    for (const it of items) {
      if (it.kind === 'bead') {
        const hit = drawBead(it)
        if (hit !== null) drawn.push(hit)
      } else if (it.kind === 'seg') {
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
    return drawn
  }
  // draw the keyboard under everything
  const keyHits = ka > 0 ? drawKeyboard() : []
  const hits = drawHelix()
  return { hits, keyHits }
}
