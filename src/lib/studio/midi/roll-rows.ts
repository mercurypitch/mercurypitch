// ============================================================
// Studio MIDI roll rows — the pitches the note editor's roll shows, panned and zoomed in fractions of a row and kept between MIDI notes 0 and 127, and the roll's notes cached for pointer moves
// ============================================================
//
// roll.ts fits the rows to a clip's notes and moves time; this moves the
// rows, so the editor reaches every pitch. Rows pan by fractions of a
// semitone, so the roll follows a finger smoothly rather than a row at a
// time: a viewport's minMidi and maxMidi may be fractional. Read the pitch
// under a point with studioRollPitchAt and studioRollRowOf, which allow for
// that, not roll-geometry's yToMidi, which counts whole rows from the top.
// Drawing with midiToY and hit-testing with hitTest are unaffected.
import type { RollViewport } from '@/lib/roll-geometry'
import { rowHeight } from '@/lib/roll-geometry'
import type { StudioNote, StudioSequence } from '../model/types'
import type { StudioRollNote } from './roll'
import { studioRollNotes } from './roll'
import type { StudioTickWindow } from './time'

const LOWEST = 0
const HIGHEST = 127
/** The most rows a roll shows: the whole keyboard. */
const ALL_ROWS = HIGHEST - LOWEST + 1

/** How tall a zoom may make a row, in CSS pixels. */
export interface StudioRollRowLimits {
  readonly minRowHeight: number
  readonly maxRowHeight: number
}

/**
 * The pitch at `y`, unrounded: the top of row `maxMidi` is maxMidi + 1, a
 * semitone a row. A drag moves a note by how far this changes.
 */
export function studioRollPitchAt(y: number, viewport: RollViewport): number {
  const height = rowHeight(viewport)
  return height > 0 ? viewport.maxMidi + 1 - y / height : viewport.maxMidi
}

/** Where unrounded pitch `pitch` stands on screen: studioRollPitchAt's inverse. */
export function studioRollYOf(pitch: number, viewport: RollViewport): number {
  return (viewport.maxMidi + 1 - pitch) * rowHeight(viewport)
}

/** The row an unrounded pitch falls in, on the keyboard: where a press draws a note. */
export function studioRollRowOf(pitch: number): number {
  return Math.min(HIGHEST, Math.max(LOWEST, Math.ceil(pitch - 1 - 1e-9)))
}

/** How many rows `viewport` shows, unrounded. */
function rowsShown(viewport: RollViewport): number {
  return viewport.maxMidi - viewport.minMidi + 1
}

/** `viewport` slid up or down, as little as keeps its rows on the keyboard. */
function onKeyboard(viewport: RollViewport): RollViewport {
  const span = viewport.maxMidi - viewport.minMidi
  const lowest = Math.min(
    Math.max(LOWEST, viewport.minMidi),
    Math.max(LOWEST, HIGHEST - span),
  )
  if (lowest === viewport.minMidi) return viewport
  return { ...viewport, minMidi: lowest, maxMidi: lowest + span }
}

/** The rows `semitones` higher, unrounded, kept on the keyboard. */
export function panStudioRollRows(
  viewport: RollViewport,
  semitones: number,
): RollViewport {
  if (semitones === 0 || !Number.isFinite(semitones)) return viewport
  return onKeyboard({
    ...viewport,
    minMidi: viewport.minMidi + semitones,
    maxMidi: viewport.maxMidi + semitones,
  })
}

/**
 * The rows zoomed by `factor` about `anchorY` (above 1 shows more rows),
 * the pitch under the anchor staying under it. A row stays within the
 * limits' heights, or where it already was past them, and the keyboard's
 * 128 rows are the most shown.
 */
export function zoomStudioRollRows(
  viewport: RollViewport,
  factor: number,
  anchorY: number,
  limits: StudioRollRowLimits,
): RollViewport {
  if (viewport.height <= 0 || !Number.isFinite(factor) || factor <= 0)
    return viewport
  const shown = rowsShown(viewport)
  const current = viewport.height / shown
  const fewest = viewport.height / Math.max(limits.maxRowHeight, current)
  const most = Math.min(
    ALL_ROWS,
    viewport.height / Math.min(limits.minRowHeight, current),
  )
  const rows = Math.min(most, Math.max(fewest, shown * factor))
  if (Math.abs(rows - shown) < 1e-9) return viewport
  const top =
    studioRollPitchAt(anchorY, viewport) -
    1 +
    (anchorY * rows) / viewport.height
  return onKeyboard({ ...viewport, maxMidi: top, minMidi: top - rows + 1 })
}

/**
 * The viewport with as few whole rows as keep each at least `minRowHeight`
 * tall, about the middle of those it showed; as it was when they already
 * are. A host opens a roll on a touch screen with it, so a note is a
 * finger's target before any zoom.
 */
export function fitStudioRollRows(
  viewport: RollViewport,
  minRowHeight: number,
): RollViewport {
  const shown = rowsShown(viewport)
  if (viewport.height <= 0 || viewport.height / shown >= minRowHeight)
    return viewport
  const rows = Math.max(1, Math.floor(viewport.height / minRowHeight))
  const lowest = Math.round(
    (viewport.minMidi + viewport.maxMidi) / 2 - (rows - 1) / 2,
  )
  return onKeyboard({
    ...viewport,
    minMidi: lowest,
    maxMidi: lowest + rows - 1,
  })
}

interface WindowNotes {
  readonly startTick: number
  readonly endTick: number
  readonly notes: readonly StudioRollNote[]
}

/** By a sequence's notes: they are replaced, never changed, so an edit misses the cache. */
const WINDOW_NOTES = new WeakMap<readonly StudioNote[], WindowNotes>()

/**
 * The notes a clip plays, as the roll draws them: those starting inside its
 * window. Worked out once for a sequence's notes and a window, since every
 * pointer move over the roll asks.
 */
export function studioWindowRollNotes(
  sequence: Pick<StudioSequence, 'notes'>,
  window: StudioTickWindow,
): readonly StudioRollNote[] {
  const known = WINDOW_NOTES.get(sequence.notes)
  if (known?.startTick === window.startTick && known.endTick === window.endTick)
    return known.notes
  const notes = studioRollNotes(sequence).filter(
    (note) => note.start >= window.startTick && note.start < window.endTick,
  )
  WINDOW_NOTES.set(sequence.notes, {
    startTick: window.startTick,
    endTick: window.endTick,
    notes,
  })
  return notes
}
