// ============================================================
// Studio MIDI preview — a MIDI clip's notes as its lane draws them: the notes its window plays, in order, each on a row of the clip's height
// ============================================================
//
// Worked out once per sequence, window and sound, and kept until the
// sequence changes (a sequence is never changed in place, so an edit makes a
// new one and the old entry goes with it). A lane redraws a clip on every
// zoom step and every 512 px of scrolling, and a song can hold many clips of
// a 10,000-note sequence: a draw then only finds its first note by a binary
// search and walks the notes its span shows.
//
// A piano clip fits its rows to the pitches its window plays, a semitone of
// air above and below, never fewer than seven rows so one note does not
// fill the clip. A drum clip draws a row per part of the kit its window
// plays, cymbals at the top and the kick at the foot, as a kit is read.
import { GM_PERCUSSION_KEY_GLYPHS } from '../instruments/import-sources'
import type { StudioSequence } from '../model/types'
import type { StudioMidiSoundKind } from './render-key'
import type { StudioTickWindow } from './time'

/** One note as a clip draws it: from its start to its end in ticks, on a row counted from the top, at its velocity. */
export interface StudioPreviewNote {
  readonly start: number
  readonly end: number
  readonly row: number
  readonly velocity: number
}

/** What a clip draws of its sequence. */
export interface StudioNotePreview {
  /** The notes the clip plays, by start. */
  readonly notes: readonly StudioPreviewNote[]
  /** How many rows the clip's height is split into. */
  readonly rows: number
  /** The longest note in ticks: a draw searching from a tick steps back this far for notes still sounding. */
  readonly longest: number
}

/** The fewest rows a piano clip shows, so one note or a close pair does not fill the clip. */
const MIN_PIANO_ROWS = 7

/** The kit's parts from the top of a drum clip down. Keys outside General MIDI join the percussion. */
type KitPart = 'cymbals' | 'percussion' | 'snares' | 'kicks'
const KIT_PARTS: readonly KitPart[] = [
  'cymbals',
  'percussion',
  'snares',
  'kicks',
]

function kitPart(key: number): KitPart {
  const glyph = GM_PERCUSSION_KEY_GLYPHS.get(key)
  if (glyph === 'cymbal' || glyph === 'hi-hat') return 'cymbals'
  if (glyph === 'snare' || glyph === 'clap') return 'snares'
  if (glyph === 'kick') return 'kicks'
  return 'percussion'
}

type WindowNotes = StudioSequence['notes']

function inWindow(
  sequence: Pick<StudioSequence, 'notes'>,
  window: StudioTickWindow,
): WindowNotes {
  return sequence.notes
    .filter(
      (note) =>
        note.startTick >= window.startTick && note.startTick < window.endTick,
    )
    .sort((a, b) => a.startTick - b.startTick || b.pitch - a.pitch)
}

/** A row from the top for each pitch: the window's pitch range, with air, on a piano. */
function pianoRows(notes: WindowNotes): {
  rows: number
  rowOf: (pitch: number) => number
} {
  if (notes.length === 0) return { rows: MIN_PIANO_ROWS, rowOf: () => 0 }
  let low = 127
  let high = 0
  for (const note of notes) {
    low = Math.min(low, note.pitch)
    high = Math.max(high, note.pitch)
  }
  const spare = Math.max(0, MIN_PIANO_ROWS - (high - low + 3))
  const top = high + 1 + Math.ceil(spare / 2)
  return {
    rows: high - low + 3 + spare,
    rowOf: (pitch) => top - pitch,
  }
}

/** A row from the top for each part of the kit the window plays. */
function drumRows(notes: WindowNotes): {
  rows: number
  rowOf: (pitch: number) => number
} {
  const played = new Set(notes.map((note) => kitPart(note.pitch)))
  const parts = KIT_PARTS.filter((part) => played.has(part))
  const shown = parts.length === 0 ? KIT_PARTS : parts
  return {
    rows: shown.length,
    rowOf: (pitch) => shown.indexOf(kitPart(pitch)),
  }
}

function buildPreview(
  sequence: Pick<StudioSequence, 'notes'>,
  window: StudioTickWindow,
  sound: StudioMidiSoundKind,
): StudioNotePreview {
  const notes = inWindow(sequence, window)
  const { rows, rowOf } = sound === 'drums' ? drumRows(notes) : pianoRows(notes)
  let longest = 0
  const drawn = notes.map((note) => {
    longest = Math.max(longest, note.lengthTicks)
    return {
      start: note.startTick,
      end: note.startTick + note.lengthTicks,
      row: rowOf(note.pitch),
      velocity: note.velocity,
    }
  })
  return { notes: drawn, rows, longest }
}

const previews = new WeakMap<object, Map<string, StudioNotePreview>>()

/**
 * Windows kept per sequence: the clips sharing it, and a trim's last few
 * steps. A trim asks for a new window on every move; the oldest goes first.
 */
const WINDOWS_KEPT = 8

/** What a clip on window `window` of `sequence` draws, on a lane that sounds as `sound`; the same object while the sequence stays the same. */
export function studioNotePreview(
  sequence: Pick<StudioSequence, 'notes'>,
  window: StudioTickWindow,
  sound: StudioMidiSoundKind,
): StudioNotePreview {
  let kept = previews.get(sequence)
  if (kept === undefined) {
    kept = new Map()
    previews.set(sequence, kept)
  }
  const key = `${window.startTick}:${window.endTick}:${sound}`
  let preview = kept.get(key)
  if (preview === undefined) {
    preview = buildPreview(sequence, window, sound)
    kept.set(key, preview)
    if (kept.size > WINDOWS_KEPT) kept.delete(kept.keys().next().value!)
  }
  return preview
}

/** The first note a draw from tick `tick` can show: the first that starts late enough to still sound there. */
export function studioPreviewFirst(
  preview: StudioNotePreview,
  tick: number,
): number {
  const from = tick - preview.longest
  let low = 0
  let high = preview.notes.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (preview.notes[middle].start < from) low = middle + 1
    else high = middle
  }
  return low
}
