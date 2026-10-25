// ============================================================
// Lesson 10 chord layout — where the chord beads' targets, names, bracket and strip sit
// ============================================================
//
// The chord beads (WEB-SPEC, Toys 1) draw pitch as height, each note a bead
// on faint semitone rows 15 px apart, so the closest two beads, a minor
// third apart, sit 45 px apart and their 44 px targets never overlap; the
// two gap buttons' centres sit 3.5 rows, 52.5 px, apart in either quality
// (FACTS 82). This file only measures, from the figure's size, the toy's
// state and the notes it shows; the toy draws and plays.
//
// - Full, from 340 px tall: the window from C4 to F♯5, every note a slide
//   reaches, 18 semitones, 270 px, with 22 px above and below for the
//   targets and the 26 px name strip along the foot: 340 px.
// - Compact, below 340 px (a phone held sideways, down to the kit's 150 px
//   floor): the chord's own window, root to fifth, 105 px, with 22 px above
//   and below, 149 px, every row and target at its full size. The window
//   follows the chord, so a slide renames the rows and keeps the beads in
//   place, and the strip moves into the top-left corner.
// - Spread into a scale, no stair is a target: the eight stairs share the
//   figure's width, and the octave sits on the window's lowest 12 rows, 180
//   px, root to top do whatever the root; compact, the rows close to 9 px,
//   108 px with 20 px above and below, 148 px.
//
// Across the figure, left to right: the fifth's bracket (60 px), the names
// (56 px), the beads' 44 px targets and the gap buttons (120 px), with their
// spaces 300 px, which the narrowest figure, 310 px on a 344 px page, holds
// (FACTS 82). The row is centred on a wider figure.

import type { Rect } from '@/features/lessons/kit/tune-line-layout'
import { MIN_TARGET } from '@/features/lessons/kit/tune-line-layout'
import { FIFTH, WINDOW } from './chords'

/** The toy's states (WEB-SPEC, Toys 1, States): Steps 1 to 5, and free play in the Wrap. */
export type BeadState =
  | 'thirds'
  | 'stack'
  | 'slide'
  | 'pattern'
  | 'scale'
  | 'free'

/** Full from 340 px tall; compact below it (FACTS 82). */
export type LayoutMode = 'full' | 'compact'

/** A semitone's row, px (FACTS 82). */
export const ROW = 15
/** Above the top row and below the lowest, for the targets (FACTS 82). */
export const MARGIN = 22
/** The name strip along the full figure's foot (FACTS 82). */
export const STRIP_H = 26
/** The full figure: 22 + 270 + 22 + 26 (FACTS 82). */
export const FULL_H = MARGIN + (WINDOW.hi - WINDOW.lo) * ROW + MARGIN + STRIP_H

/** Spread into a scale, the octave on its lowest 12 rows (FACTS 82). */
export const OCTAVE = 12
/** The compact scale's rows close up, with less above and below: 9 px, 20 px (FACTS 82). */
export const SCALE_ROW = 9
export const SCALE_MARGIN = 20
/** The eight stairs of a spread scale, do to do. */
export const STAIRS = 8

/** The parts across the figure, px (FACTS 82). */
export const BRACKET_W = 60
export const NAMES_W = 56
export const GAPS_W = 120
/** All four with their spaces: the narrowest figure the layout fits (FACTS 82). */
export const PARTS_W = 300
const SPACE = (PARTS_W - BRACKET_W - NAMES_W - MIN_TARGET - GAPS_W) / 3

/** The parts each state shows (WEB-SPEC, Toys 1, Drawing). */
const GAPS_IN: ReadonlySet<BeadState> = new Set<BeadState>([
  // Steps 1 to 3, and free play
  'thirds',
  'stack',
  'slide',
  'free',
])
const BRACKET_IN: ReadonlySet<BeadState> = new Set<BeadState>([
  // Steps 2 to 4, and free play
  'stack',
  'slide',
  'pattern',
  'free',
])
const STRIP_IN: ReadonlySet<BeadState> = new Set<BeadState>([
  // the third in Step 1, the chord in Steps 2 to 4
  'thirds',
  'stack',
  'slide',
  'pattern',
])
/** Where the toy shows two notes: Step 1, and Step 2 before Stack a third. */
const PAIR_IN: ReadonlySet<BeadState> = new Set<BeadState>(['thirds', 'stack'])
/** Where the toy shows a spread scale's eight: Step 5, and free play. */
const SCALE_IN: ReadonlySet<BeadState> = new Set<BeadState>(['scale', 'free'])

export interface ChordLayoutSpec {
  /** The figure's size, px. */
  readonly width: number
  readonly height: number
  readonly state: BeadState
  /**
   * The notes shown, MIDI, from the root up: a third's two, a triad's
   * three, or a spread scale's eight, do to do.
   */
  readonly notes: readonly number[]
}

export interface ChordLayout {
  readonly mode: LayoutMode
  readonly width: number
  readonly height: number
  /** Where the drawing starts, centred in the figure, and how tall it is: 340, 149 or 148 px. */
  readonly top: number
  readonly used: number
  /** A semitone's row, px. */
  readonly row: number
  /** The pitches on the lowest and the highest row drawn. */
  readonly lo: number
  readonly hi: number
  /** A pitch's row, its centre's y; fractional while a bead slides. */
  yOf(midi: number): number
  /** The beads' column, its centre; null for a spread scale. */
  readonly columnX: number | null
  /** Each bead's target, from the root up; none in a scale. */
  readonly beads: readonly Rect[]
  /** Each gap button, from the lowest gap up; none where the state shows none. */
  readonly gaps: readonly Rect[]
  /** Each bead's name beside it, one row tall, from the root up. */
  readonly names: readonly Rect[]
  /** The fifth's bracket, from the fifth's row to the root's, or null. */
  readonly bracket: Rect | null
  /** The name strip, or null where the state shows none. */
  readonly strip: Rect | null
  /** A spread scale's stairs, do to do: each a column from its tread to the window's foot. */
  readonly stairs: readonly Rect[]
}

/** The mode a figure `height` px tall draws: compact below 340 px. */
export const modeFor = (height: number): LayoutMode =>
  height < FULL_H ? 'compact' : 'full'

/** The drawing's height in a mode: 340 px, or the compact 149 px, 148 for a scale. */
function usedOf(mode: LayoutMode, scale: boolean): number {
  if (mode === 'full') return FULL_H
  return scale
    ? SCALE_MARGIN + OCTAVE * SCALE_ROW + SCALE_MARGIN
    : MARGIN + FIFTH * ROW + MARGIN
}

function check(spec: ChordLayoutSpec): void {
  const n = spec.notes.length
  const ok =
    n === 3 ||
    (n === 2 && PAIR_IN.has(spec.state)) ||
    (n === STAIRS && SCALE_IN.has(spec.state))
  if (!ok)
    throw new Error(
      `lesson 10: ${n} notes are not shown in the ${spec.state} state`,
    )
}

/** The rows a mode draws for what is shown: each row's height, the pitches on the lowest and highest, and the margin over the top one. */
function rowsOf(
  mode: LayoutMode,
  root: number,
  scale: boolean,
): { row: number; lo: number; hi: number; margin: number } {
  if (scale && mode === 'compact')
    return { row: SCALE_ROW, lo: root, hi: root + OCTAVE, margin: SCALE_MARGIN }
  // the octave on the full window's lowest rows, the root on the lowest whatever the root
  if (scale)
    return {
      row: ROW,
      lo: root,
      hi: root + WINDOW.hi - WINDOW.lo,
      margin: MARGIN,
    }
  if (mode === 'compact')
    return { row: ROW, lo: root, hi: root + FIFTH, margin: MARGIN }
  return { row: ROW, lo: WINDOW.lo, hi: WINDOW.hi, margin: MARGIN }
}

/** Lays the chord beads out on a `width` by `height` figure. */
export function chordLayout(spec: ChordLayoutSpec): ChordLayout {
  check(spec)
  const { width, height, state, notes } = spec
  const scale = notes.length === STAIRS
  const mode = modeFor(height)
  const used = usedOf(mode, scale)
  const top = Math.max(0, (height - used) / 2)
  const root = notes[0]
  const { row, lo, hi, margin } = rowsOf(mode, root, scale)
  const yOf = (m: number): number => top + margin + (hi - m) * row
  const base = { mode, width, height, top, used, row, lo, hi, yOf }

  if (scale) {
    const w = width / STAIRS
    const foot = yOf(root) + margin
    return {
      ...base,
      columnX: null,
      beads: [],
      gaps: [],
      names: [],
      bracket: null,
      strip: null,
      stairs: notes.map((m, i) => ({
        x: i * w,
        y: yOf(m),
        w,
        h: foot - yOf(m),
      })),
    }
  }

  const x0 = (width - PARTS_W) / 2
  const namesX = x0 + BRACKET_W + SPACE
  const beadX = namesX + NAMES_W + SPACE
  const gapsX = beadX + MIN_TARGET + SPACE
  const half = MIN_TARGET / 2
  const beads = notes.map((m) => ({
    x: beadX,
    y: yOf(m) - half,
    w: MIN_TARGET,
    h: MIN_TARGET,
  }))
  // each gap button centred between its two beads' rows
  const gaps = GAPS_IN.has(state)
    ? notes.slice(1).map((m, i) => ({
        x: gapsX,
        y: (yOf(notes[i]) + yOf(m)) / 2 - half,
        w: GAPS_W,
        h: MIN_TARGET,
      }))
    : []
  const names = notes.map((m) => ({
    x: namesX,
    y: yOf(m) - ROW / 2,
    w: NAMES_W,
    h: ROW,
  }))
  const bracket =
    BRACKET_IN.has(state) && notes.length === 3
      ? {
          x: x0,
          y: yOf(notes[2]),
          w: BRACKET_W,
          h: yOf(notes[0]) - yOf(notes[2]),
        }
      : null
  // full: along the foot; compact: the top-left corner, above the top row's name, left of the beads
  const strip = !STRIP_IN.has(state)
    ? null
    : mode === 'full'
      ? { x: 0, y: top + used - STRIP_H, w: width, h: STRIP_H }
      : { x: 0, y: top, w: beadX - SPACE, h: MARGIN - ROW / 2 }
  return {
    ...base,
    columnX: beadX + half,
    beads,
    gaps,
    names,
    bracket,
    strip,
    stairs: [],
  }
}

/** Every target a layout lays over the drawing: the beads, then the gap buttons. */
export const targetsOf = (L: ChordLayout): Rect[] => [...L.beads, ...L.gaps]
