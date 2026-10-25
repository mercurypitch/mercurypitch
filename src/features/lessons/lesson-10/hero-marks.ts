// ============================================================
// Lesson 10 hero marks — the cold open's halos, triangle and bead slide on the ring
// ============================================================
//
// The hero's spiral is the kit's, seen from above, so one turn is a ring of
// twelve and do, mi and so, C4, E4 and G4, sit on it (WEB-SPEC, Toys 2).
// These are the page's marks, drawn each frame in the spiral's overlay from
// where its beads landed (`SpiralFrame.beads`): a chrome halo round each of
// the three carrying its syllable, and a thin chrome triangle joining them.
//
// Before the reveal nothing is gold and no chord is named, and the three
// look alike, so the figure cannot answer the predict over it (FACTS 1a;
// FACTS, Illustrations without claims). From the reveal mi's halo is gold,
// glowing once, and the chord's name sits in the ring's centre; as a move
// lands it names what the move made, "C minor" for mi's, and for so's the
// triangle turns dashed ink-2 with a "?", the contrast case, and the name
// reads "C, E, G♭: neither major nor minor" (FACTS 40, 41b).
//
// The bead slide (FACTS 73): in a move the moving note's halo and bead stay
// on its own bead for 1.2 s, travel along the ring to the bead a semitone
// below over the 0.4 s its pitch glides, hold there until the sound ends at
// 3.1 s, then slide home, silently, in 0.4 s; the triangle's corner follows.
// The glide is even in semitones, as the pitch's exponential glide is.
// Under reduced motion the bead lands at once as the glide begins and
// returns at once as the sound ends. `slideAt` is the time's place, pure.
//
// While the chord sounds, the three halos light alike, the moving one where
// its slide has it, so the light follows mi's or so's glide down and back,
// and no light marks one note over the others.

import { clamp, lerp, TAU } from '@/features/lessons/kit/dom'
import { MAJOR_SOLFEGE } from '@/features/lessons/kit/names-modes'
import { COLOR, rgba, signName } from '@/features/lessons/kit/notes'
import type { SpiralFrame } from '@/features/lessons/kit/spiral'
import type { BeadHit } from '@/features/lessons/kit/spiral-draw'
import { LO } from '@/features/lessons/kit/spiral-keys'
import { GLOW_RISE_SEC, GLOW_SEC, lightAt, } from '@/features/lessons/kit/tune-line-motion'
import type { ChordTone } from './chords'
import { qualityOf, tone, triad } from './chords'
import { chordName } from './lines'
import type { MoveId } from './sounds'
import { MOVE, MOVE_SEC, moveSound } from './sounds'

/** The bead's slide home once the sound ends, silent (FACTS 73). */
export const SLIDE_HOME_SEC = 0.4
/** Seconds from a move's start until its bead is home: 3.5. */
export const SLIDE_END_SEC = MOVE_SEC + SLIDE_HOME_SEC

/** The cold open's chord, do, mi and so on C4 (FACTS 41). */
const CHORD: readonly ChordTone[] = triad(60, 'major')
/** Their syllables, the major scale's degrees 1, 3 and 5, as the halos carry them (FACTS 8). */
const SYLLABLES = [MAJOR_SOLFEGE[0], MAJOR_SOLFEGE[2], MAJOR_SOLFEGE[4]]
/** mi, the chord's third: its halo is the one that turns gold (Look). */
const THIRD = 1

/** The ring the hero's spiral lights from above starts on C4 (WEB-SPEC, Toys 2, `ring: 60`). */
const RING_FROM = 60

/** A halo's radius, against its bead's; the triangle's edges stop at it. */
const HALO = 1.6
/** How strongly a halo lights while its note sounds. */
const LIT_ALPHA = 0.22

/** Where a move's bead is at one moment. */
export interface SlidePlace {
  /** How far along: 0 on the moving note's own bead, 1 on the bead a semitone below. */
  readonly k: number
  /** The moving note before and after, MIDI: E4 and E♭4, or G4 and G♭4. */
  readonly from: number
  readonly to: number
  /** Where along the ring, as a MIDI number from `from` to `to`. */
  readonly at: number
}

/**
 * The moving bead's place `t` seconds into a move (FACTS 73): on its own
 * bead until 1.2 s, gliding to the bead a semitone below by 1.6 s, held
 * there until 3.1 s and home by 3.5 s; under reduced motion it lands at
 * 1.2 s and is home at 3.1 s, with no travel.
 */
export function slideAt(t: number, move: MoveId, reduced: boolean): SlidePlace {
  const { from, to } = moveSound(move)
  const glideEnd = MOVE.hold + MOVE.glide
  let k: number
  if (t < MOVE.hold || t >= SLIDE_END_SEC) k = 0
  else if (t < glideEnd) k = reduced ? 1 : (t - MOVE.hold) / MOVE.glide
  else if (t < MOVE_SEC) k = 1
  else k = reduced ? 0 : 1 - (t - MOVE_SEC) / SLIDE_HOME_SEC
  return { k, from, to, at: lerp(from, to, k) }
}

/** What the marks show. Times are on the frame's clock, `SpiralFrame.now`, in ms. */
export interface MarksState {
  /** When the reveal showed, or null before it. */
  readonly revealedAt: number | null
  /** The last move played and when it began, or null. */
  readonly move: { readonly id: MoveId; readonly at: number } | null
  readonly reduced: boolean
  /** When the chord last began and ended sounding, or null (or left out) when it has not. */
  readonly sounding?: { readonly from: number; readonly to: number } | null
}

interface Point {
  readonly x: number
  readonly y: number
}

const beadOf = (beads: readonly BeadHit[], midi: number): BeadHit | undefined =>
  beads.find((b) => b.s === midi - LO)

/** The ring's centre: the middle of the lit turn's beads drawn this frame; null with fewer than three. */
function ringCentre(beads: readonly BeadHit[]): Point | null {
  const ring = beads.filter(
    (b) => b.s >= RING_FROM - LO && b.s < RING_FROM - LO + 12,
  )
  if (ring.length < 3) return null
  const sum = ring.reduce((p, b) => ({ x: p.x + b.x, y: p.y + b.y }), {
    x: 0,
    y: 0,
  })
  return { x: sum.x / ring.length, y: sum.y / ring.length }
}

/** A fractional pitch's place on the ring: round the centre between its two beads, the short way. */
function onRing(
  beads: readonly BeadHit[],
  c: Point,
  at: number,
): Point | undefined {
  const lo = beadOf(beads, Math.floor(at))
  const hi = beadOf(beads, Math.ceil(at))
  if (lo === undefined || hi === undefined) return undefined
  const f = at - Math.floor(at)
  if (f === 0) return lo
  const a0 = Math.atan2(lo.y - c.y, lo.x - c.x)
  const a1 = Math.atan2(hi.y - c.y, hi.x - c.x)
  const turn = ((((a1 - a0) % TAU) + TAU + Math.PI) % TAU) - Math.PI
  const a = a0 + turn * f
  const r = lerp(
    Math.hypot(lo.x - c.x, lo.y - c.y),
    Math.hypot(hi.x - c.x, hi.y - c.y),
    f,
  )
  return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }
}

/** The name the ring's centre shows once a move has landed: what its three notes make (FACTS 41b). */
function nameAfter(move: MoveId): string {
  const { from } = moveSound(move)
  const notes = CHORD.map((n) =>
    n.midi === from ? tone(n.midi - 1, n.spelled.letter) : n,
  )
  const quality = qualityOf(notes)
  if (quality !== 'neither') return chordName(60, quality)
  const letters = notes.map((n) => signName(n.spelled, { octave: false }))
  return `${letters.join(', ')}: neither major nor minor`
}

/** The glow once mi's halo turns gold: the kit's tune line's glow once, which the spec does not time. */
function glowAt(since: number): number {
  if (since < 0) return 0
  if (since < GLOW_RISE_SEC) return since / GLOW_RISE_SEC
  return 1 - clamp((since - GLOW_RISE_SEC) / GLOW_SEC, 0, 1)
}

/** The triangle joining the three halos, each edge stopping at them: thin chrome, or dashed ink-2. */
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  corners: readonly Point[],
  radius: number,
  contrast: boolean,
): void {
  ctx.strokeStyle = contrast ? COLOR.ink2 : rgba(COLOR.chrome, 0.6)
  ctx.lineWidth = 1
  ctx.setLineDash(contrast ? [5, 4] : [])
  ctx.beginPath()
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length]
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    if (d <= 2 * radius) return
    const ux = (b.x - a.x) / d
    const uy = (b.y - a.y) / d
    ctx.moveTo(a.x + ux * radius, a.y + uy * radius)
    ctx.lineTo(b.x - ux * radius, b.y - uy * radius)
  })
  ctx.stroke()
  ctx.setLineDash([])
}

/** The moving note's bead as it travels: a lit chrome sphere, as the kit draws a bead. */
function drawBead(ctx: CanvasRenderingContext2D, p: Point, r: number): void {
  const hl = r * 0.35
  const g = ctx.createRadialGradient(p.x - hl, p.y - hl, r * 0.1, p.x, p.y, r)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.45, COLOR.chrome)
  g.addColorStop(1, '#4a5563')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, TAU)
  ctx.fill()
}

/** A halo round a bead: chrome, or gold for mi from the reveal, lit while its note sounds, with its glow ring while the glow lasts. */
function drawHalo(
  ctx: CanvasRenderingContext2D,
  p: Point,
  radius: number,
  gold: boolean,
  { glow, lit }: { readonly glow: number; readonly lit: number },
): void {
  if (lit > 0) {
    ctx.fillStyle = rgba(COLOR.chrome, LIT_ALPHA * lit)
    ctx.beginPath()
    ctx.arc(p.x, p.y, radius, 0, TAU)
    ctx.fill()
  }
  if (glow > 0) {
    ctx.strokeStyle = rgba(COLOR.gold, 0.45 * glow)
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(p.x, p.y, radius + 2, 0, TAU)
    ctx.stroke()
  }
  ctx.strokeStyle = gold ? COLOR.gold : rgba(COLOR.chrome, 0.85)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(p.x, p.y, radius, 0, TAU)
  ctx.stroke()
}

/** A halo's syllable, outside the ring and above, clear of the names the kit draws beside a bead. */
function drawSyllable(
  ctx: CanvasRenderingContext2D,
  c: Point,
  p: Point,
  radius: number,
  text: string,
): void {
  const ox = p.x - c.x
  const oy = p.y - c.y
  const d = Math.hypot(ox, oy) || 1
  const dx = ox / d
  const dy = oy / d - 0.9
  const n = Math.hypot(dx, dy) || 1
  const at = radius + 12
  ctx.font = '600 12px Outfit, sans-serif'
  ctx.fillStyle = COLOR.chrome
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, p.x + (dx / n) * at, p.y + (dy / n) * at)
}

/** The chord's name in the ring's centre, on two lines after its colon where one is wider than the ring. */
function drawName(
  ctx: CanvasRenderingContext2D,
  c: Point,
  ringR: number,
  name: string,
): void {
  ctx.font = '600 14px Outfit, sans-serif'
  ctx.fillStyle = COLOR.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const colon = name.indexOf(': ')
  if (colon < 0 || ctx.measureText(name).width <= 1.6 * ringR) {
    ctx.fillText(name, c.x, c.y)
    return
  }
  ctx.fillText(name.slice(0, colon + 1), c.x, c.y - 9)
  ctx.fillText(name.slice(colon + 2), c.x, c.y + 9)
}

/**
 * Draws the cold open's marks over one frame of the hero's spiral: the
 * halos, their syllables and the triangle, the bead slide, and from the
 * reveal mi's gold and the chord's name. Draws nothing until the frame has
 * drawn the ring's beads.
 */
export function drawMarks(
  ctx: CanvasRenderingContext2D,
  frame: SpiralFrame,
  state: MarksState,
): void {
  const c = ringCentre(frame.beads)
  if (c === null) return
  const slide =
    state.move === null
      ? null
      : slideAt(
          (frame.now - state.move.at) / 1000,
          state.move.id,
          state.reduced,
        )
  const beads = CHORD.map((n) => beadOf(frame.beads, n.midi))
  const corners = CHORD.map((n) =>
    slide !== null && n.midi === slide.from
      ? onRing(frame.beads, c, slide.at)
      : beadOf(frame.beads, n.midi),
  )
  if (
    beads.some((b) => b === undefined) ||
    corners.some((p) => p === undefined)
  )
    return
  const drawn = beads as BeadHit[]
  const at = corners as Point[]
  const r = Math.max(...drawn.map((b) => b.r))
  const radius = r * HALO
  const revealed = state.revealedAt !== null
  const landed = revealed && slide !== null && slide.k === 1
  const contrast = landed && state.move?.id === 'so'

  drawTriangle(ctx, at, radius, contrast)
  if (slide !== null && slide.k > 0) {
    const k = CHORD.findIndex((n) => n.midi === slide.from)
    drawBead(ctx, at[k], drawn[k].r)
  }
  const glow =
    revealed && !state.reduced
      ? glowAt((frame.now - (state.revealedAt ?? 0)) / 1000)
      : 0
  const lit =
    state.sounding == null
      ? 0
      : lightAt(
          state.sounding.from / 1000,
          state.sounding.to / 1000,
          frame.now / 1000,
        )
  at.forEach((p, i) => {
    const gold = revealed && i === THIRD
    drawHalo(ctx, p, radius, gold, { glow: gold ? glow : 0, lit })
    drawSyllable(ctx, c, p, radius, SYLLABLES[i])
  })
  if (!revealed) return
  const ringR = Math.hypot(drawn[0].x - c.x, drawn[0].y - c.y)
  drawName(
    ctx,
    c,
    ringR,
    landed && state.move !== null
      ? nameAfter(state.move.id)
      : chordName(60, 'major'),
  )
  if (contrast) {
    // the contrast case's "?", inside the triangle by the corner that moved
    const k = CHORD.findIndex((n) => n.midi === slide?.from)
    const mid = {
      x: (at[0].x + at[1].x + at[2].x) / 3,
      y: (at[0].y + at[1].y + at[2].y) / 3,
    }
    ctx.font = '600 14px Outfit, sans-serif'
    ctx.fillStyle = COLOR.ink2
    ctx.fillText('?', lerp(at[k].x, mid.x, 0.45), lerp(at[k].y, mid.y, 0.45))
  }
}
