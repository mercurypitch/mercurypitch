// ============================================================
// Geometry for the transcription bench's piano roll
// ============================================================
//
// Kept out of the component because hit-testing is where an edit surface goes
// wrong quietly: a note that picks up two pixels early is not a crash, it is a
// tool that feels broken. Pure functions, so the rules can be pinned.
//
// Times are seconds throughout. The roll never converts to beats — a stem has
// no tempo, and inventing one to draw it would be a claim about the audio.

/** What the roll is currently showing. */
export interface RollViewport {
  startSeconds: number
  endSeconds: number
  /** Lowest MIDI note drawn, at the bottom edge. */
  minMidi: number
  /** Highest MIDI note drawn, at the top edge. */
  maxMidi: number
  width: number
  height: number
}

export interface RollNote {
  id: string
  startSeconds: number
  endSeconds: number
  midi: number
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

export function secondsToX(seconds: number, viewport: RollViewport): number {
  const span = viewport.endSeconds - viewport.startSeconds
  if (span <= 0) return 0
  return ((seconds - viewport.startSeconds) / span) * viewport.width
}

export function xToSeconds(x: number, viewport: RollViewport): number {
  if (viewport.width <= 0) return viewport.startSeconds
  const span = viewport.endSeconds - viewport.startSeconds
  return viewport.startSeconds + (x / viewport.width) * span
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
  const x = secondsToX(note.startSeconds, viewport)
  const end = secondsToX(note.endSeconds, viewport)
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

export interface RollHit {
  note: RollNote
  zone: RollZone
}

/**
 * What is under the cursor. Later notes win ties, matching the draw order, so
 * what a click selects is what the eye sees on top.
 */
export function hitTest(
  notes: readonly RollNote[],
  viewport: RollViewport,
  x: number,
  y: number,
): RollHit | null {
  let found: RollHit | null = null
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
    (note) =>
      note.endSeconds >= viewport.startSeconds &&
      note.startSeconds <= viewport.endSeconds,
  )
}

/**
 * A viewport that fits the notes, with a couple of semitones of air above and
 * below. Empty input gets the four-string bass range rather than a zero-height
 * roll, because an empty roll with no rows drawn looks like a broken tool.
 */
export function fitViewport(
  notes: readonly RollNote[],
  width: number,
  height: number,
  fallback: { minMidi: number; maxMidi: number } = { minMidi: 28, maxMidi: 60 },
): RollViewport {
  if (notes.length === 0) {
    return {
      startSeconds: 0,
      endSeconds: 30,
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
    if (note.endSeconds > last) last = note.endSeconds
  }
  return {
    startSeconds: 0,
    endSeconds: Math.max(1, last),
    minMidi: lowest - 2,
    maxMidi: highest + 2,
    width,
    height,
  }
}

/**
 * Zoom about a fixed point on screen, so the note under the cursor stays under
 * it. Clamped to a floor of 0.2 s across — past that the roll shows one note
 * and no context — and to the full length of the material.
 */
export function zoomViewport(
  viewport: RollViewport,
  factor: number,
  anchorX: number,
  totalSeconds: number,
): RollViewport {
  const anchorSeconds = xToSeconds(anchorX, viewport)
  const span = viewport.endSeconds - viewport.startSeconds
  const wanted = Math.min(
    Math.max(0.2, span * factor),
    Math.max(1, totalSeconds),
  )
  const share = viewport.width > 0 ? anchorX / viewport.width : 0.5
  let start = anchorSeconds - wanted * share
  if (start < 0) start = 0
  if (start + wanted > totalSeconds) {
    start = Math.max(0, totalSeconds - wanted)
  }
  return { ...viewport, startSeconds: start, endSeconds: start + wanted }
}

/** Slide the viewport without changing how much of the song it covers. */
export function panViewport(
  viewport: RollViewport,
  deltaSeconds: number,
  totalSeconds: number,
): RollViewport {
  const span = viewport.endSeconds - viewport.startSeconds
  let start = viewport.startSeconds + deltaSeconds
  if (start < 0) start = 0
  if (start + span > totalSeconds) start = Math.max(0, totalSeconds - span)
  return { ...viewport, startSeconds: start, endSeconds: start + span }
}
