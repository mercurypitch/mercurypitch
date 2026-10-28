// ============================================================
// Lesson 12 ring marks — the syllables on the ring and the roots' line, over the rooms
// ============================================================
//
// Two things the page draws over the rooms itself, in the spiral's overlay
// after the painter (rooms-draw.ts), from where the lit turn's beads landed
// (WEB-SPEC, Toys 1):
// - under Do-re-mi, the key's seven scale notes carry their syllables
//   beside their beads, do on the key's tonic: on C in C major, on G in G
//   major, where F♯ is ti and C♯, D♯, F, G♯ and A♯ carry none (FACTS 8;
//   Edge cases). Each sits just past its bead's halo, away from the ring's
//   centre, so no room's edge runs through it; C's, whose bead the kit
//   names on its right ("C4"), goes under that name. The compact layout
//   draws none: there the chips alone carry them;
// - Step 4's Play the roots: each root's bead pulses in ink as it sounds,
//   on the kit's bead pulse (steady under reduced motion), and a chrome
//   line joins it to the root before, each stretch whole as its root
//   starts. Once the play ends or is stopped the line turns faint, and
//   stays until the next play.
//
// Pure apart from the drawing: `marksAnimating` says whether a root still
// sounds, so the page's overlay can let the frame loop rest.

import { TAU } from '@/features/lessons/kit/dom'
import { MAJOR_SOLFEGE } from '@/features/lessons/kit/names-modes'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import type { SpiralFrame } from '@/features/lessons/kit/spiral'
import { pulseOf } from '@/features/lessons/kit/spiral-keys'
import type { KeyName } from './music'
import { KEY } from './music'
import type { Point, Ring } from './rooms-draw'
import { ringOf } from './rooms-draw'

/** A syllable beside one of the key's scale notes: its pitch class, C = 0, and its syllable. */
export interface SyllableMark {
  readonly pc: number
  readonly text: string
}

/** A root the roots' play has sounded: its note, and when it started and stops sounding, ms on the frame's clock. */
export interface RootMark {
  readonly midi: number
  readonly from: number
  readonly to: number
}

/** What the page draws over the rooms. */
export interface RingMarks {
  /** The syllables beside the beads: none under Letters, and none in the compact layout. */
  readonly syllables: readonly SyllableMark[]
  /** The roots heard so far, in the order they sounded. */
  readonly roots: readonly RootMark[]
  /** Whether the roots' play still runs: the line full while it does, faint once it has ended. */
  readonly rootsPlaying: boolean
  readonly reduced: boolean
}

/** The roots' line while its play runs, and once it has ended. */
const LINE_FULL = 0.8
const LINE_FAINT = 0.3
/** How far past a bead's halo a syllable starts, px; the halo is the painter's, 1.6 beads. */
const HALO = 1.6
const GAP = 4

/** The key's seven scale notes and their syllables, do on its tonic (FACTS 8). */
export const syllablesOf = (key: KeyName): SyllableMark[] =>
  KEY[key].pitchClasses.map((pc, degree) => ({
    pc,
    text: MAJOR_SOLFEGE[degree],
  }))

/** Whether a root still sounds at `now`, its bead pulsing: the frame loop keeps drawing until it ends. */
export const marksAnimating = (marks: RingMarks, now: number): boolean =>
  marks.roots.some((r) => now < r.to)

/** Where a syllable goes beside `b`: past its halo, away from the centre, its text growing outward. */
function syllableAt(
  ring: Ring,
  b: Point & { readonly r: number },
  pc: number,
): { at: Point; align: CanvasTextAlign; base: CanvasTextBaseline } {
  // C's bead carries the kit's own name on its right, "C4": under it
  if (pc === 0)
    return { at: { x: b.x + b.r + 12, y: b.y + 8 }, align: 'left', base: 'top' }
  const d = Math.hypot(b.x - ring.c.x, b.y - ring.c.y) || 1
  const ux = (b.x - ring.c.x) / d
  const uy = (b.y - ring.c.y) / d
  const out = b.r * HALO + GAP
  return {
    at: { x: b.x + ux * out, y: b.y + uy * out },
    align: ux > 0.35 ? 'left' : ux < -0.35 ? 'right' : 'center',
    base: uy > 0.35 ? 'top' : uy < -0.35 ? 'bottom' : 'middle',
  }
}

function drawSyllables(
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  syllables: readonly SyllableMark[],
): void {
  ctx.font = '600 12px Outfit, sans-serif'
  ctx.fillStyle = COLOR.ink
  for (const s of syllables) {
    const b = ring.beadAt(s.pc)
    if (b === undefined) continue
    const { at, align, base } = syllableAt(ring, b, s.pc)
    ctx.textAlign = align
    ctx.textBaseline = base
    ctx.fillText(s.text, at.x, at.y)
  }
}

/** The roots' line, bead to bead, each stretch stopping at the beads' edges. */
function drawRootLine(
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  marks: RingMarks,
): void {
  const beads = marks.roots.map((r) => ring.beadAt(r.midi))
  const trim = ring.bead + 2
  ctx.strokeStyle = rgba(
    COLOR.chrome,
    marks.rootsPlaying ? LINE_FULL : LINE_FAINT,
  )
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i + 1 < beads.length; i++) {
    const a = beads[i]
    const b = beads[i + 1]
    if (a === undefined || b === undefined) continue
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    if (d <= 2 * trim) continue
    const ux = (b.x - a.x) / d
    const uy = (b.y - a.y) / d
    ctx.moveTo(a.x + ux * trim, a.y + uy * trim)
    ctx.lineTo(b.x - ux * trim, b.y - uy * trim)
  }
  ctx.stroke()
}

/** The sounding root's bead: an ink glow, pulsing as it starts, steady under reduced motion. */
function drawRootPulse(
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  root: RootMark,
  now: number,
  reduced: boolean,
): void {
  const b = ring.beadAt(root.midi)
  if (b === undefined) return
  const pulse = pulseOf(new Map([[root.midi, root.from]]), root.midi, now)
  const light = reduced ? 1 : 0.4 + 0.6 * pulse
  const r = ring.bead * 2.6
  const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r)
  glow.addColorStop(0, rgba(COLOR.ink, 0.55 * light))
  glow.addColorStop(1, rgba(COLOR.ink, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(b.x, b.y, r, 0, TAU)
  ctx.fill()
}

/** Draws the page's marks over one frame of the rooms: the syllables, then the roots' line and the sounding root. */
export function drawMarks(
  ctx: CanvasRenderingContext2D,
  frame: SpiralFrame,
  marks: RingMarks,
): void {
  const ring = ringOf(frame.beads)
  if (ring === null || frame.u > 0.05) return
  if (marks.syllables.length > 0) drawSyllables(ctx, ring, marks.syllables)
  if (marks.roots.length === 0) return
  drawRootLine(ctx, ring, marks)
  const sounding = marks.roots.find((r) => frame.now < r.to)
  if (sounding !== undefined)
    drawRootPulse(ctx, ring, sounding, frame.now, marks.reduced)
}
