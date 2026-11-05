// ============================================================
// Rhythm layout — where a figure's rows, beats and symbols fall
// ============================================================
//
// Pure: the scene the rhythm drawing takes (kit/rhythm-draw.ts), and where
// it puts each row, beat and symbol in the figure's own pixels (Lesson 17
// WEB-SPEC, Toys 1 and Look). One row takes the height Lesson 8's figure
// has and two share it, as Play both's do, each with its pads, counts and
// stopwatch strip; every beat of a row is as wide as the next, so two rows
// at different tempi share one time axis, and a note's head sits a little
// into its beat. Step 5's lift reads the same layout for its two drawings
// (lesson-17/lift.ts).

import type { Spelled } from './notes'
import type { Bar, PlacedSymbol } from './rhythm-model'
import { BAR_BEATS, placeBars } from './rhythm-model'
import type { Clef } from './staff-places'

/** What the bars sit on: one line, or a five-line staff in its clef. */
export type RhythmStaff = 'line' | Clef

/** One row of the figure: its bars and the tempo it plays at. */
export interface RhythmRow {
  readonly bars: readonly Bar[]
  /** Beats per minute, for the strip's readings. */
  readonly bpm: number
  /** Beats across the row; by default its bars', so a figure ending on the next bar's first note can keep its room. */
  readonly beats?: number
  /** Each sound's note on a staff, in order; by default every one on A3 on the bass staff and A4 on the treble (FACTS 29). */
  readonly notes?: readonly Spelled[]
  /** Which strip cells read, by index; every one by default. */
  readonly reads?: (index: number) => boolean
  /** Each bar's first beat, by default four beats after the last's, so a bare figure's groups can sit a pause apart. */
  readonly starts?: readonly number[]
}

export interface RhythmScene {
  readonly staff: RhythmStaff
  readonly rows: readonly RhythmRow[]
  /** The pitch-line view in place of the notation. */
  readonly lanes?: boolean
  /** Numbered pads under each row's beats, or none. */
  readonly pads?: boolean
  /** Each note's count under it. */
  readonly counts?: boolean
  /** The stopwatch strip under each row. */
  readonly strip?: boolean
  /** The hero's size: smaller type and a shorter figure. */
  readonly compact?: boolean
  /**
   * A short rhythm on its own, as the four words' tickets show one (Lesson
   * 17 WEB-SPEC, Toys 4): no 4/4 and no bar line, no room kept for the
   * 4/4, and only its first beat knocking higher, so it need not fill a bar.
   */
  readonly bare?: boolean
}

/** A row in the figure's pixels. */
export interface RowLayout {
  /** Beat 0's left edge and the last beat's right edge. */
  readonly x0: number
  readonly x1: number
  readonly beats: number
  /** The line, or the staff's middle line. */
  readonly y: number
  /** The staff's space, the unit every glyph is drawn to. */
  readonly space: number
  /** The pads' box. */
  readonly top: number
  readonly bottom: number
  readonly numberY: number
  readonly countY: number
  readonly stripTop: number
  readonly stripH: number
  /** The strip's second row of readings: its baseline. */
  readonly read2Y: number
}

export interface RhythmLayout {
  readonly w: number
  readonly h: number
  readonly rows: readonly RowLayout[]
}

/** Where a beat falls in a row. */
export const xOf = (row: RowLayout, beat: number): number =>
  row.x0 + (beat / row.beats) * (row.x1 - row.x0)

/** A row's beats: its own, or its bars'. */
const beatsOf = (row: RhythmRow): number =>
  row.beats ?? row.bars.length * BAR_BEATS

/** A row's symbols in place, each bar from its own first beat. */
export const placeRow = (row: RhythmRow): PlacedSymbol[] =>
  placeBars(row.bars, BAR_BEATS, row.starts)

/** The figure's margin either side, px. */
export const SIDE = 4

/**
 * Lays the rows out in a figure `w` by `h`: one row uses the height
 * Lesson 8's figure has, two share it (Play both), each with its pads,
 * counts and strip.
 */
export function layoutRhythm(
  w: number,
  h: number,
  scene: RhythmScene,
): RhythmLayout {
  const n = scene.rows.length
  const space = scene.compact === true ? 7 : n > 1 ? 8 : 10
  const staffed = scene.staff !== 'line' && scene.lanes !== true
  const left = SIDE + space * (staffed ? 6.2 : scene.bare === true ? 0.6 : 2.6)
  const strip = scene.strip !== false
  const stripH = scene.compact === true ? 18 : 22
  // one row's parts, top to bottom, from the room its stems and ties take
  const above = space * (staffed ? 4.2 : 4.4)
  const below = space * (scene.counts === true ? 5.2 : 3.4)
  const padsH = scene.pads === false ? 0 : space * 1.9
  const stripRoom = strip ? stripH + 26 : 0
  const rowH = above + below + padsH + stripRoom
  const offset = Math.max(0, (h - rowH * n) / (n + 1))
  const rows = scene.rows.map((row, i): RowLayout => {
    const top = offset + i * (rowH + offset)
    const y = top + above
    const bottom = y + below + padsH
    const stripTop = bottom + 8
    return {
      x0: left,
      x1: w - SIDE,
      beats: beatsOf(row),
      y,
      space,
      top: top + 2,
      bottom,
      numberY: bottom - space * 0.7,
      countY: y + space * 4.1,
      stripTop,
      stripH,
      read2Y: stripTop + stripH + 15,
    }
  })
  return { w, h, rows }
}

/** How far into its slot a note's head sits: half a short note's slot, at most a set inset. */
export const headInset = (row: RowLayout, beats: number): number =>
  Math.min(((xOf(row, beats) - xOf(row, 0)) / 2) * 0.9, row.space * 1.3)

/** A symbol's anchor: its head's centre, or a rest's. */
export const symbolX = (row: RowLayout, p: PlacedSymbol): number =>
  xOf(row, p.beat) + headInset(row, Math.min(p.beats, 1))

/** The note every sound plays on a staff when the row names none: A3 on the bass, A4 on the treble (FACTS 29). */
export const STAFF_A: Readonly<Record<Clef, Spelled>> = {
  bass: { letter: 'A', alter: 0, octave: 3 },
  treble: { letter: 'A', alter: 0, octave: 4 },
}
