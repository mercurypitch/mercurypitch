// ============================================================
// Roll geometry — a piano roll's viewport, coordinates and hit tests, in whatever time its notes are kept in
// ============================================================
//
// Kept out of the components because hit-testing is where an edit surface
// goes wrong quietly: a note that picks up two pixels early is not a crash,
// it is a tool that feels broken. Pure functions, so the rules can be pinned.
//
// Time is the caller's unit throughout: seconds in the Lab's transcription
// bench, where a stem has no tempo and inventing one to draw it would be a
// claim about the audio; ticks in the Studio's note editor
// (lib/studio/midi/roll.ts). What depends on the unit (how far a zoom may
// close in, what an empty roll shows) comes in a `RollScale`.

/** What the roll is currently showing. */
export interface RollViewport {
  /** The time at the left edge, in the roll's unit. */
  start: number
  /** The time at the right edge. */
  end: number
  /** Lowest MIDI note drawn, at the bottom edge. */
  minMidi: number
  /** Highest MIDI note drawn, at the top edge. */
  maxMidi: number
  width: number
  height: number
}

/** A note as the roll draws it: from `start` to `end` in the roll's unit, on row `midi`. */
export interface RollNote {
  start: number
  end: number
  midi: number
}

/** The spans a roll keeps to, in its unit. */
export interface RollScale {
  /** The narrowest span a zoom closes in to: past it the roll shows one note and no context. */
  minSpan: number
  /** What an empty roll shows. */
  emptySpan: number
  /** The least a fitted roll shows, however short its notes. */
  minFitSpan: number
}

export interface RollRect {
  x: number
  y: number
  width: number
  height: number
}

/** Pixels within which a drag near a note's end resizes rather than moves. */
export const EDGE_GRAB_PX = 6

/** How tall one semitone is at the current viewport. */
export function rowHeight(viewport: RollViewport): number {
  const rows = viewport.maxMidi - viewport.minMidi + 1
  return rows > 0 ? viewport.height / rows : 0
}

export function timeToX(time: number, viewport: RollViewport): number {
  const span = viewport.end - viewport.start
  if (span <= 0) return 0
  return ((time - viewport.start) / span) * viewport.width
}

export function xToTime(x: number, viewport: RollViewport): number {
  if (viewport.width <= 0) return viewport.start
  const span = viewport.end - viewport.start
  return viewport.start + (x / viewport.width) * span
}

/** Top edge of a note's row. Higher pitches are higher on screen. */
export function midiToY(midi: number, viewport: RollViewport): number {
  return (viewport.maxMidi - midi) * rowHeight(viewport)
}

export function yToMidi(y: number, viewport: RollViewport): number {
  const height = rowHeight(viewport)
  if (height <= 0) return viewport.minMidi
  return viewport.maxMidi - Math.floor(y / height)
}

export function noteRect(note: RollNote, viewport: RollViewport): RollRect {
  const x = timeToX(note.start, viewport)
  const end = timeToX(note.end, viewport)
  return {
    x,
    // A note shorter than a pixel still has to be clickable, or the fast
    // passages — the ones worth inspecting — become unreachable.
    width: Math.max(2, end - x),
    y: midiToY(note.midi, viewport),
    height: rowHeight(viewport),
  }
}

export type RollZone = 'body' | 'end'

export interface RollHit<T extends RollNote = RollNote> {
  note: T
  zone: RollZone
}

/**
 * What is under the cursor. Later notes win ties, matching the draw order, so
 * what a click selects is what the eye sees on top.
 */
export function hitTest<T extends RollNote>(
  notes: readonly T[],
  viewport: RollViewport,
  x: number,
  y: number,
): RollHit<T> | null {
  let found: RollHit<T> | null = null
  for (const note of notes) {
    const rect = noteRect(note, viewport)
    if (x < rect.x || x > rect.x + rect.width) continue
    if (y < rect.y || y > rect.y + rect.height) continue
    // A grab zone wider than the note itself would leave no way to move it.
    const edge = Math.min(EDGE_GRAB_PX, rect.width / 2)
    found = { note, zone: x >= rect.x + rect.width - edge ? 'end' : 'body' }
  }
  return found
}

/** Every note that overlaps the visible span, so drawing can skip the rest. */
export function visibleNotes<T extends RollNote>(
  notes: readonly T[],
  viewport: RollViewport,
): T[] {
  return notes.filter(
    (note) => note.end >= viewport.start && note.start <= viewport.end,
  )
}

/**
 * A viewport that fits the notes from time 0, with a couple of semitones of
 * air above and below. Empty input gets `scale.emptySpan` and the fallback
 * rows (the four-string bass range unless told otherwise) rather than a
 * zero-height roll, because an empty roll with no rows drawn looks like a
 * broken tool.
 */
export function fitViewport(
  notes: readonly RollNote[],
  width: number,
  height: number,
  scale: Pick<RollScale, 'emptySpan' | 'minFitSpan'>,
  fallback: { minMidi: number; maxMidi: number } = { minMidi: 28, maxMidi: 60 },
): RollViewport {
  if (notes.length === 0) {
    return {
      start: 0,
      end: scale.emptySpan,
      minMidi: fallback.minMidi,
      maxMidi: fallback.maxMidi,
      width,
      height,
    }
  }
  let lowest = Infinity
  let highest = -Infinity
  let last = 0
  for (const note of notes) {
    if (note.midi < lowest) lowest = note.midi
    if (note.midi > highest) highest = note.midi
    if (note.end > last) last = note.end
  }
  return {
    start: 0,
    end: Math.max(scale.minFitSpan, last),
    minMidi: lowest - 2,
    maxMidi: highest + 2,
    width,
    height,
  }
}

/**
 * Zoom about a fixed point on screen, so the note under the cursor stays under
 * it. Clamped to a floor of `minSpan` across and to the full length of the
 * material, `total`.
 */
export function zoomViewport(
  viewport: RollViewport,
  factor: number,
  anchorX: number,
  total: number,
  scale: Pick<RollScale, 'minSpan' | 'minFitSpan'>,
): RollViewport {
  const anchor = xToTime(anchorX, viewport)
  const span = viewport.end - viewport.start
  const wanted = Math.min(
    Math.max(scale.minSpan, span * factor),
    Math.max(scale.minFitSpan, total),
  )
  const share = viewport.width > 0 ? anchorX / viewport.width : 0.5
  let start = anchor - wanted * share
  if (start < 0) start = 0
  if (start + wanted > total) start = Math.max(0, total - wanted)
  return { ...viewport, start, end: start + wanted }
}

/** Slide the viewport without changing how much of the material it covers. */
export function panViewport(
  viewport: RollViewport,
  delta: number,
  total: number,
): RollViewport {
  const span = viewport.end - viewport.start
  let start = viewport.start + delta
  if (start < 0) start = 0
  if (start + span > total) start = Math.max(0, total - span)
  return { ...viewport, start, end: start + span }
}
