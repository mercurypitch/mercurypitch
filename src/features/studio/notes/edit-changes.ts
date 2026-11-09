// ============================================================
// Studio note changes — what an edit changed: the commit it makes, if any, whether its new notes start inside the clip's window, and a selection checked against the notes that exist
// ============================================================
//
// A commit is the sequence's notes after the edit and the id it hands out
// next, for one `set-sequence-notes`; an edit that changed nothing makes
// none, so a drag that comes back where it started leaves no undo step.
import type { StudioNoteEdit, StudioNoteSet } from '@/lib/studio/midi/notes'
import type { StudioTickWindow } from '@/lib/studio/midi/time'
import type { StudioNote } from '@/lib/studio/model/types'
import type { NoteEditCommit } from './edit-types'

/** The note with `id`, if the sequence has it. */
export function noteById(
  sequence: Pick<StudioNoteSet, 'notes'>,
  id: number,
): StudioNote | undefined {
  return sequence.notes.find((note) => note.id === id)
}

/** Whether a note starting on `tick` is one the clip plays. */
export function inNoteWindow(tick: number, window: StudioTickWindow): boolean {
  return tick >= window.startTick && tick < window.endTick
}

/** Every field a note has, its defaults left out when it holds them. */
const NOTE_FIELDS = [
  'id',
  'pitch',
  'startTick',
  'lengthTicks',
  'velocity',
  'releaseVelocity',
  'channel',
] as const satisfies readonly (keyof StudioNote)[]

function sameNote(a: StudioNote, b: StudioNote): boolean {
  return a === b || NOTE_FIELDS.every((field) => a[field] === b[field])
}

/** Whether two note lists hold the same notes in the same order. */
export function sameNotes(
  a: readonly StudioNote[],
  b: readonly StudioNote[],
): boolean {
  return (
    a === b ||
    (a.length === b.length &&
      a.every((note, index) => sameNote(note, b[index])))
  )
}

/** The commit an edit of `base` makes, or null when it changed nothing. */
export function noteEditCommit(
  base: StudioNoteSet,
  edit: StudioNoteEdit<StudioNoteSet> | null,
): NoteEditCommit | null {
  if (edit === null) return null
  const after = edit.sequence
  if (
    after.nextNoteId === base.nextNoteId &&
    sameNotes(base.notes, after.notes)
  )
    return null
  return {
    notes: after.notes,
    nextNoteId: after.nextNoteId,
    selection: edit.selection,
  }
}

/** Whether every note an edit of `base` added starts inside the clip's window. */
export function newNotesInWindow(
  base: StudioNoteSet,
  edit: StudioNoteEdit<StudioNoteSet>,
  window: StudioTickWindow,
): boolean {
  return edit.sequence.notes.every(
    (note) => note.id < base.nextNoteId || inNoteWindow(note.startTick, window),
  )
}

/**
 * The ids of `ids` that are notes the clip plays now, in the order given:
 * `ids` itself when all of them are, so an unchanged selection keeps its
 * identity.
 */
export function playedIds(
  ids: readonly number[],
  sequence: Pick<StudioNoteSet, 'notes'>,
  window: StudioTickWindow,
): readonly number[] {
  if (ids.length === 0) return ids
  const played = new Set(
    sequence.notes
      .filter((note) => inNoteWindow(note.startTick, window))
      .map((note) => note.id),
  )
  const kept = ids.filter((id) => played.has(id))
  return kept.length === ids.length ? ids : kept
}
