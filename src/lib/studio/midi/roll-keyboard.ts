// ============================================================
// Studio MIDI roll keyboard — the roll's rows by kind: a piano's semitones or a kit's keys, how many show in the roll's height, and a scroll by whole rows
// ============================================================
//
// The roll's viewport (lib/roll-geometry.ts) counts rows by number, higher
// on screen for a higher number. On a piano a row's number is its pitch; on
// a kit it is its place in the kit's list, counted from the foot, so the
// first row of the list is at the top and the geometry, the hit test
// included, works the same for both. A2's viewport (roll.ts) fits the rows
// to the notes; this keeps a row between a least height, so a note can be
// seen and touched, and a most, so a short phrase does not fill the roll
// with a few bars as tall as keys, and scrolls when more rows are wanted
// than fit. D's editing engine moves a piano's rows in fractions of a
// semitone (roll-rows.ts); the limits on a row's height are its type.
import type { RollViewport } from '@/lib/roll-geometry'
import type { StudioSequence } from '../model/types'
import type { StudioDrumRow } from './drum-rows'
import { studioRollViewport } from './roll'
import type { StudioRollRowLimits } from './roll-rows'
import type { StudioTickWindow } from './time'

/** A roll's rows: every semitone of the keyboard, or a kit's keys from the top. */
export type StudioRollRows =
  | { readonly kind: 'piano' }
  | { readonly kind: 'drums'; readonly keys: readonly StudioDrumRow[] }

/** The highest row number: the keyboard's top note, or the kit's first row. */
export function studioRollTopRow(rows: StudioRollRows): number {
  return rows.kind === 'piano' ? 127 : Math.max(0, rows.keys.length - 1)
}

/** The row `pitch` is drawn on, by number; null on a kit with no row for it. */
export function studioRollRow(
  rows: StudioRollRows,
  pitch: number,
): number | null {
  if (rows.kind === 'piano') return pitch
  const index = rows.keys.findIndex((row) => row.key === pitch)
  return index < 0 ? null : rows.keys.length - 1 - index
}

/** The pitch row `row` plays; null past the keyboard or the kit. */
export function studioRollRowPitch(
  rows: StudioRollRows,
  row: number,
): number | null {
  if (!Number.isInteger(row) || row < 0 || row > studioRollTopRow(rows))
    return null
  return rows.kind === 'piano' ? row : rows.keys[rows.keys.length - 1 - row].key
}

/** Rows a mouse reads and points at, and rows a finger can take, in CSS pixels. */
export const STUDIO_ROLL_ROWS_FINE: StudioRollRowLimits = {
  minRowHeight: 12,
  maxRowHeight: 26,
}
export const STUDIO_ROLL_ROWS_TOUCH: StudioRollRowLimits = {
  minRowHeight: 18,
  maxRowHeight: 34,
}

/** Which rows a roll shows. */
export interface StudioRollRowSpan {
  readonly minMidi: number
  readonly maxMidi: number
}

/**
 * The rows shown in `height`: those `wanted`, as many more as the most
 * height leaves room for, or as many fewer as the least height allows,
 * about `center` (the middle of `wanted` unless given), and kept between
 * row 0 and `top`.
 */
export function studioRollShownRows(
  wanted: StudioRollRowSpan,
  height: number,
  limits: StudioRollRowLimits,
  top: number,
  center = (wanted.minMidi + wanted.maxMidi) / 2,
): StudioRollRowSpan {
  const count = wanted.maxMidi - wanted.minMidi + 1
  const most = Math.max(1, Math.floor(height / limits.minRowHeight))
  const fewest = Math.max(1, Math.ceil(height / limits.maxRowHeight))
  const shown = Math.min(top + 1, Math.max(fewest, Math.min(count, most)))
  const lowest = Math.round(center - (shown - 1) / 2)
  const minMidi = Math.max(0, Math.min(top + 1 - shown, lowest))
  return { minMidi, maxMidi: minMidi + shown - 1 }
}

/** The roll scrolled `deltaRows` whole rows higher (below 0, lower), kept between row 0 and `top`. */
export function scrollStudioRollRows(
  viewport: RollViewport,
  deltaRows: number,
  top: number,
): RollViewport {
  const span = viewport.maxMidi - viewport.minMidi
  const minMidi = Math.max(
    0,
    Math.min(top - span, viewport.minMidi + Math.round(deltaRows)),
  )
  if (minMidi === viewport.minMidi) return viewport
  return { ...viewport, minMidi, maxMidi: minMidi + span }
}

/** The rows a roll wants before its height is known: the notes the window plays with air on a piano, the whole kit on drums. */
export function studioRollWantedRows(
  sequence: Pick<StudioSequence, 'notes'>,
  window: StudioTickWindow,
  rows: StudioRollRows,
): StudioRollRowSpan {
  if (rows.kind === 'drums')
    return { minMidi: 0, maxMidi: studioRollTopRow(rows) }
  const { minMidi, maxMidi } = studioRollViewport(sequence, window, 1, 1)
  return { minMidi, maxMidi }
}

/**
 * The roll as it opens: from the window's start over at most `span` ticks
 * of it (the whole window when shorter), its rows fitted to the notes and
 * the height.
 */
export function studioRollOpening(options: {
  readonly sequence: Pick<StudioSequence, 'notes'>
  readonly window: StudioTickWindow
  readonly rows: StudioRollRows
  readonly width: number
  readonly height: number
  readonly limits: StudioRollRowLimits
  readonly span: number
}): RollViewport {
  const { window } = options
  const wanted = studioRollWantedRows(options.sequence, window, options.rows)
  const shown = studioRollShownRows(
    wanted,
    options.height,
    options.limits,
    studioRollTopRow(options.rows),
  )
  const start = window.startTick
  return {
    start,
    end: Math.min(
      Math.max(window.endTick, start + 1),
      start + Math.max(1, options.span),
    ),
    ...shown,
    width: options.width,
    height: options.height,
  }
}
