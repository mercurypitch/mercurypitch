// Studio MIDI notes — the note editor's edits as pure operations over a sequence and a selection of note ids: add, move, resize, delete, velocity, transpose, quantize, duplicate, and copy and paste.
//
// Each takes a sequence (its notes and the id it hands out next) and the ids
// of the notes selected, and returns a new sequence, with the notes selected
// after the edit. None changes what it is given or reuses an id: a note made
// here takes the sequence's `nextNoteId`, and a deleted note's id stays
// spent. A move keeps the selection inside the clip's window and on the
// keyboard as a group, so a chord or a run keeps its shape against an edge.
// Notes are kept as a sequence keeps them: whole ticks, velocities to 4
// decimals, and defaults left out (validation-midi.ts).
import type { StudioNote, StudioSequence } from '../model/types'
import { STUDIO_MAX_SEQUENCE_NOTES } from '../model/validation-midi'
import type { StudioTickWindow } from './time'

/** The part of a sequence an edit reads and writes. */
export type StudioNoteSet = Pick<StudioSequence, 'notes' | 'nextNoteId'>

/** What an edit leaves: the sequence after it, and the notes then selected, by id. */
export interface StudioNoteEdit<S extends StudioNoteSet> {
  readonly sequence: S
  readonly selection: readonly number[]
}

/** A note before it has an id: drawn, or held on the clipboard. */
export type StudioNoteDraft = Omit<StudioNote, 'id'>

/** Notes copied: their starts counted from the earliest of them, in the order they sound. */
export interface StudioNoteClipboard {
  readonly notes: readonly StudioNoteDraft[]
}

/** A grid in ticks: lines `ticks` apart, one of them on tick `offset`. */
export interface StudioNoteGrid {
  readonly ticks: number
  readonly offset?: number
}

const HIGHEST_PITCH = 127

/** A velocity as a sequence keeps it: above 0, up to 1, to 4 decimals. */
export function studioNoteVelocity(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0.0001, Math.round(value * 10_000) / 10_000))
}

/** `value` rounded, from `low` to `high`. */
function whole(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, Math.round(value)))
}

/** `note` as a sequence keeps it: whole ticks, a pitch on the keyboard, levels to 4 decimals, and its defaults left out. */
function kept(note: StudioNote): StudioNote {
  const { releaseVelocity = 0.5, channel = 0, ...rest } = note
  const release = whole(releaseVelocity * 10_000, 0, 10_000) / 10_000
  const midiChannel = whole(channel, 0, 15)
  return {
    ...rest,
    pitch: whole(note.pitch, 0, HIGHEST_PITCH),
    startTick: whole(note.startTick, 0, Number.MAX_SAFE_INTEGER),
    lengthTicks: whole(note.lengthTicks, 1, Number.MAX_SAFE_INTEGER),
    velocity: studioNoteVelocity(note.velocity),
    ...(release !== 0.5 && { releaseVelocity: release }),
    ...(midiChannel !== 0 && { channel: midiChannel }),
  }
}

function withNotes<S extends StudioNoteSet>(
  sequence: S,
  notes: readonly StudioNote[],
  nextNoteId = sequence.nextNoteId,
): S {
  return { ...sequence, notes, nextNoteId }
}

/** The selected notes, in the sequence's order. */
function chosen(sequence: StudioNoteSet, ids: Iterable<number>): StudioNote[] {
  const wanted = new Set(ids)
  return sequence.notes.filter((note) => wanted.has(note.id))
}

/** The ids of `notes`. */
const idsOf = (notes: readonly StudioNote[]) => notes.map((note) => note.id)

/** `delta`, kept from `lowest` to `highest`; none when nothing fits between. */
function clampDelta(delta: number, lowest: number, highest: number): number {
  if (lowest > highest) return 0
  return Math.min(highest, Math.max(lowest, Math.round(delta)))
}

/** Each selected note changed by `change`; the same sequence when none is selected. */
function edit<S extends StudioNoteSet>(
  sequence: S,
  ids: Iterable<number>,
  change: (note: StudioNote) => StudioNote,
): StudioNoteEdit<S> {
  const wanted = new Set(ids)
  const selection = idsOf(sequence.notes.filter((n) => wanted.has(n.id)))
  if (selection.length === 0) return { sequence, selection }
  const notes = sequence.notes.map((note) =>
    wanted.has(note.id) ? kept(change(note)) : note,
  )
  return { sequence: withNotes(sequence, notes), selection }
}

/** Whether `count` more notes fit in the sequence. */
export function studioNotesFit(
  sequence: StudioNoteSet,
  count: number,
): boolean {
  return sequence.notes.length + count <= STUDIO_MAX_SEQUENCE_NOTES
}

/** `drafts` added as new notes, ids from `nextNoteId`; null when the sequence has no room. */
function addDrafts<S extends StudioNoteSet>(
  sequence: S,
  drafts: readonly StudioNoteDraft[],
): StudioNoteEdit<S> | null {
  if (!studioNotesFit(sequence, drafts.length)) return null
  const added = drafts.map((draft, index) =>
    kept({ ...draft, id: sequence.nextNoteId + index }),
  )
  return {
    sequence: withNotes(
      sequence,
      [...sequence.notes, ...added],
      sequence.nextNoteId + added.length,
    ),
    selection: idsOf(added),
  }
}

/** A note drawn: it takes the next id and is selected alone; null when the sequence is full. */
export function addStudioNote<S extends StudioNoteSet>(
  sequence: S,
  draft: StudioNoteDraft,
): StudioNoteEdit<S> | null {
  return addDrafts(sequence, [draft])
}

/**
 * The selection moved `dTick` later and `dPitch` higher, both kept so every
 * selected note starts inside `window` and sits from 0 to 127: a drag past
 * an edge stops the whole selection there.
 */
export function moveStudioNotes<S extends StudioNoteSet>(
  sequence: S,
  ids: Iterable<number>,
  dTick: number,
  dPitch: number,
  window: StudioTickWindow,
): StudioNoteEdit<S> {
  const notes = chosen(sequence, ids)
  if (notes.length === 0) return { sequence, selection: [] }
  const starts = notes.map((note) => note.startTick)
  const pitches = notes.map((note) => note.pitch)
  const tick = clampDelta(
    dTick,
    window.startTick - Math.min(...starts),
    window.endTick - 1 - Math.max(...starts),
  )
  const pitch = clampDelta(
    dPitch,
    -Math.min(...pitches),
    HIGHEST_PITCH - Math.max(...pitches),
  )
  if (tick === 0 && pitch === 0) return { sequence, selection: idsOf(notes) }
  return edit(sequence, idsOf(notes), (note) => ({
    ...note,
    startTick: note.startTick + tick,
    pitch: note.pitch + pitch,
  }))
}

/** Each selected note `dLength` ticks longer, a tick long at the least. */
export function resizeStudioNotes<S extends StudioNoteSet>(
  sequence: S,
  ids: Iterable<number>,
  dLength: number,
): StudioNoteEdit<S> {
  return edit(sequence, ids, (note) => ({
    ...note,
    lengthTicks: note.lengthTicks + dLength,
  }))
}

/** The selected notes gone; their ids stay spent. */
export function deleteStudioNotes<S extends StudioNoteSet>(
  sequence: S,
  ids: Iterable<number>,
): StudioNoteEdit<S> {
  const wanted = new Set(ids)
  const notes = sequence.notes.filter((note) => !wanted.has(note.id))
  if (notes.length === sequence.notes.length) return { sequence, selection: [] }
  return { sequence: withNotes(sequence, notes), selection: [] }
}

/** Every selected note at `velocity`, 0 to 1. */
export function setStudioNoteVelocity<S extends StudioNoteSet>(
  sequence: S,
  ids: Iterable<number>,
  velocity: number,
): StudioNoteEdit<S> {
  return edit(sequence, ids, (note) => ({ ...note, velocity }))
}

/** Every selected note's velocity times `factor`, kept above 0 and up to 1. */
export function scaleStudioNoteVelocity<S extends StudioNoteSet>(
  sequence: S,
  ids: Iterable<number>,
  factor: number,
): StudioNoteEdit<S> {
  return edit(sequence, ids, (note) => ({
    ...note,
    velocity: note.velocity * factor,
  }))
}

/** The selection `semitones` higher (a step is 1, an octave 12), kept on the keyboard as a group. */
export function transposeStudioNotes<S extends StudioNoteSet>(
  sequence: S,
  ids: Iterable<number>,
  semitones: number,
): StudioNoteEdit<S> {
  const notes = chosen(sequence, ids)
  if (notes.length === 0) return { sequence, selection: [] }
  const pitches = notes.map((note) => note.pitch)
  const shift = clampDelta(
    semitones,
    -Math.min(...pitches),
    HIGHEST_PITCH - Math.max(...pitches),
  )
  if (shift === 0) return { sequence, selection: idsOf(notes) }
  return edit(sequence, idsOf(notes), (note) => ({
    ...note,
    pitch: note.pitch + shift,
  }))
}

/**
 * Each selected note's start on the nearest line of `grid`, kept inside
 * `window` when one is given; lengths are left as they are.
 */
export function quantizeStudioNotes<S extends StudioNoteSet>(
  sequence: S,
  ids: Iterable<number>,
  grid: StudioNoteGrid,
  window?: StudioTickWindow,
): StudioNoteEdit<S> {
  const step = Math.max(1, Math.round(grid.ticks))
  const offset = grid.offset ?? 0
  return edit(sequence, ids, (note) => {
    const snapped = offset + Math.round((note.startTick - offset) / step) * step
    const start =
      window === undefined
        ? snapped
        : Math.min(window.endTick - 1, Math.max(window.startTick, snapped))
    return { ...note, startTick: start }
  })
}

/** The selection's copies right after it, by the time it spans, selected in its place; null when they do not fit. */
export function duplicateStudioNotes<S extends StudioNoteSet>(
  sequence: S,
  ids: Iterable<number>,
): StudioNoteEdit<S> | null {
  const notes = chosen(sequence, ids)
  if (notes.length === 0) return { sequence, selection: [] }
  const bounds = studioNoteBounds(notes)!
  const span = bounds.endTick - bounds.startTick
  return addDrafts(
    sequence,
    notes.map(({ id: _id, ...draft }) => ({
      ...draft,
      startTick: draft.startTick + span,
    })),
  )
}

/** The selected notes for the clipboard, their starts counted from the earliest. */
export function copyStudioNotes(
  sequence: StudioNoteSet,
  ids: Iterable<number>,
): StudioNoteClipboard {
  const notes = chosen(sequence, ids).sort(
    (a, b) => a.startTick - b.startTick || a.pitch - b.pitch || a.id - b.id,
  )
  const from = notes[0]?.startTick ?? 0
  return {
    notes: notes.map(({ id: _id, ...draft }) => ({
      ...draft,
      startTick: draft.startTick - from,
    })),
  }
}

/** The clipboard's notes from tick `atTick`, as new notes, selected; null when they do not fit. */
export function pasteStudioNotes<S extends StudioNoteSet>(
  sequence: S,
  clipboard: StudioNoteClipboard,
  atTick: number,
): StudioNoteEdit<S> | null {
  return addDrafts(
    sequence,
    clipboard.notes.map((draft) => ({
      ...draft,
      startTick: draft.startTick + atTick,
    })),
  )
}

/** Where some notes sit: from the earliest start to the latest end, and the lowest and highest pitch. */
export interface StudioNoteBounds {
  readonly startTick: number
  readonly endTick: number
  readonly lowPitch: number
  readonly highPitch: number
}

/** The bounds of `notes`; null for none. */
export function studioNoteBounds(
  notes: readonly StudioNote[],
): StudioNoteBounds | null {
  if (notes.length === 0) return null
  let startTick = Infinity
  let endTick = -Infinity
  let lowPitch = Infinity
  let highPitch = -Infinity
  for (const note of notes) {
    startTick = Math.min(startTick, note.startTick)
    endTick = Math.max(endTick, note.startTick + note.lengthTicks)
    lowPitch = Math.min(lowPitch, note.pitch)
    highPitch = Math.max(highPitch, note.pitch)
  }
  return { startTick, endTick, lowPitch, highPitch }
}

/** The bounds of the selected notes; null for none. */
export function studioSelectionBounds(
  sequence: StudioNoteSet,
  ids: Iterable<number>,
): StudioNoteBounds | null {
  return studioNoteBounds(chosen(sequence, ids))
}

/** The notes a clip plays and the editor can select: those starting inside its window. */
export function studioNotesInWindow(
  sequence: StudioNoteSet,
  window: StudioTickWindow,
): number[] {
  return idsOf(
    sequence.notes.filter(
      (note) =>
        note.startTick >= window.startTick && note.startTick < window.endTick,
    ),
  )
}

/** A marquee's notes: those sounding anywhere from `fromTick` up to `toTick`, from `lowPitch` to `highPitch`. */
export function studioNotesInRange(
  sequence: StudioNoteSet,
  range: StudioNoteBounds,
): number[] {
  return idsOf(
    sequence.notes.filter(
      (note) =>
        note.startTick < range.endTick &&
        note.startTick + note.lengthTicks > range.startTick &&
        note.pitch >= range.lowPitch &&
        note.pitch <= range.highPitch,
    ),
  )
}
