// ============================================================
// Chord column — a chord's three beads beside a staircase, on its rows
// ============================================================
//
// Lesson 10's beads (chord-beads-draw.ts) as Lesson 25 draws its chord on
// so (its WEB-SPEC, Toys 1 and 2; Look): three beads in a column at a
// staircase's right, each on its pitch's row of the staircase's own drawing
// (stairs-geometry.ts `yOfRow`), named beside it one letter per chord tone,
// the gaps between them counted, "3" and "4", and the chord's name under
// them, "E minor" or "E major", in JetBrains Mono. It draws in over 0.4 s;
// a bead that moves, as Raise te lifts G to G sharp, slides there in 0.4 s,
// and the names, the counts and the chord's name change as it lands. A
// bead lights while its note sounds. Under reduced motion each lands at
// once. It is drawn, never tapped (Lesson 25's WEB-SPEC, Contract): it
// paints on the staircase's canvas after the stairs, in the room the
// staircase leaves at its right (stairs-core.ts `overlay` and `room`), all
// chrome and ink, with no gold, since nothing there lines up as a fit.

import { BEAD_R, paintBead } from './chord-beads-draw'
import { gapsOf } from './chords'
import { clamp, lerp } from './dom'
import { reducedMotion } from './motion-switch'
import { COLOR, rgba } from './notes'
import type { StairsOverlay } from './stairs-core'
import type { StairsLayout } from './stairs-geometry'

/** The room the column takes at a staircase's right, px: names, beads and counts. */
export const COLUMN_W = 104
/** The column drawing in, and a bead's slide, seconds (Lesson 25's WEB-SPEC, Look). */
export const COLUMN_SEC = 0.4
/** How long a bead stays lit after its note ends, seconds (as the staircase's stairs do). */
const AFTERGLOW_SEC = 0.18

/** A chord as the column shows it. */
export interface ColumnChord {
  /** Its notes, MIDI, from the root up. */
  readonly notes: readonly number[]
  /** Each bead's name, one letter per chord tone: "G♯3". */
  readonly names: readonly string[]
  /** Its name, under the beads: "E major". */
  readonly label: string
}

export interface ChordColumn extends StairsOverlay {
  /** Whether it is drawn, or drawing in. */
  readonly shown: boolean
  /** The chord it shows, or will once a slide lands. */
  readonly chord: ColumnChord | null
  /** Draws the column in (0.4 s), or takes it away at once. */
  show(on: boolean): void
  /** Shows `next`: each bead that moves slides there and the words change as it lands; at once while hidden. */
  set(next: ColumnChord): void
  /** Lights bead `i` from `from` to `to`, seconds on the page's clock. */
  light(i: number, from: number, to: number): void
  /** Puts out every light. */
  clear(): void
}

/** The page's clock, seconds: the staircase's (stairs-core.ts). */
const clock = (): number => performance.now() / 1000

const smoothstep = (u: number): number => u * u * (3 - 2 * u)

/**
 * A column at a staircase's right. `redraw` asks the staircase for a frame
 * when something it shows changes (stairs-core.ts `redraw`).
 */
export function chordColumn(redraw: () => void): ChordColumn {
  let on = false
  let drawnAt = -Infinity
  let from: ColumnChord | null = null
  let to: ColumnChord | null = null
  let slideAt = -Infinity
  let lights: { i: number; from: number; to: number }[] = []

  /** How far the column has drawn in at `t`, 0 to 1. */
  const drawn = (t: number): number =>
    !on ? 0 : reducedMotion() ? 1 : clamp((t - drawnAt) / COLUMN_SEC, 0, 1)
  /** How far a slide has gone at `t`, 0 to 1. */
  const slid = (t: number): number =>
    reducedMotion() ? 1 : clamp((t - slideAt) / COLUMN_SEC, 0, 1)

  function lit(i: number, t: number): number {
    let best = 0
    for (const l of lights) {
      if (l.i !== i || t < l.from) continue
      const amount = t <= l.to ? 1 : 1 - (t - l.to) / AFTERGLOW_SEC
      best = Math.max(best, amount)
    }
    return best
  }

  function paint(
    ctx: CanvasRenderingContext2D,
    L: StairsLayout,
    t: number,
  ): void {
    lights = lights.filter((l) => t < l.to + AFTERGLOW_SEC)
    const amount = drawn(t)
    if (amount <= 0 || to === null) return
    const u = smoothstep(slid(t))
    const landed = u >= 1 || from === null
    const words = landed || from === null ? to : from
    const notes = to.notes.map((m, i) => lerp(from?.notes[i] ?? m, m, u))
    const r = Math.min(BEAD_R, L.rowH * 1.4)
    // the room at the staircase's right, the beads at its middle
    const left = L.x1 + 6
    const beadX = left + 40 + r
    const ys = notes.map((m) => L.yOfRow(m))
    ctx.save()
    ctx.globalAlpha = amount
    // the counts between the beads, then the beads, their names and the chord's
    ctx.font = `500 12px "JetBrains Mono", monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = rgba(COLOR.chrome, 0.9)
    gapsOf(words.notes).forEach((g, i) =>
      ctx.fillText(String(g), beadX + r + 8, (ys[i] + ys[i + 1]) / 2),
    )
    ctx.restore()
    ys.forEach((y, i) =>
      paintBead(ctx, {
        x: beadX,
        y,
        r,
        name: words.names[i],
        nameBox: null,
        gold: false,
        lit: lit(i, t),
        alpha: amount,
      }),
    )
    ctx.save()
    ctx.globalAlpha = amount
    ctx.font = `600 13px Outfit, sans-serif`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ys.forEach((y, i) => {
      ctx.fillStyle = lit(i, t) > 0.3 ? '#ffffff' : COLOR.ink
      ctx.fillText(words.names[i], beadX - r - 6, y + 1)
    })
    ctx.font = `500 12px "JetBrains Mono", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = COLOR.ink
    ctx.fillText(words.label, beadX, Math.max(...ys) + r + 8)
    ctx.restore()
  }

  function moving(t: number): boolean {
    if (!on || to === null) return false
    return (
      drawn(t) < 1 ||
      (from !== null && slid(t) < 1) ||
      lights.some((l) => t < l.to + AFTERGLOW_SEC)
    )
  }

  return {
    get shown() {
      return on
    },
    get chord() {
      return to
    },
    paint,
    moving,
    show(next) {
      if (next === on) return
      on = next
      drawnAt = clock()
      from = null
      if (!next) lights = []
      redraw()
    },
    set(next) {
      const t = clock()
      // a hidden column, or a chord of other notes, takes its words at once
      const slides =
        on &&
        to !== null &&
        to.notes.length === next.notes.length &&
        to.notes.some((m, i) => m !== next.notes[i])
      from = slides && to !== null ? currentOf(to, from, t) : null
      to = next
      slideAt = t
      redraw()
    },
    light(i, start, end) {
      lights.push({ i, from: start, to: end })
      redraw()
    },
    clear() {
      lights = []
      redraw()
    },
  }

  /** Where a slide in flight stands, as a chord to slide on from. */
  function currentOf(
    target: ColumnChord,
    start: ColumnChord | null,
    t: number,
  ): ColumnChord {
    const u = smoothstep(slid(t))
    if (start === null || u >= 1) return target
    return {
      notes: target.notes.map((m, i) => lerp(start.notes[i], m, u)),
      names: u >= 1 ? target.names : start.names,
      label: u >= 1 ? target.label : start.label,
    }
  }
}
