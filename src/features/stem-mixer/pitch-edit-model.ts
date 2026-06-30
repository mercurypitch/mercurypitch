// ============================================================
// Two-stage pitch-edit model for the vocal-pitch edit mode.
//
// Stage 1 (base) = the algorithm output (segmentSecondsContourToMelody at the
// current cleanup amount). Stage 2 (edit layer) = the user's manual edits.
// The effective melody = applyEditLayer(base, layer): manual notes are pinned
// and survive base regeneration, deleted regions stay empty, and everything
// the user hasn't touched keeps tracking the cleanup slider.
//
// All operations are pure and return a NEW layer, so the controller can keep a
// simple snapshot stack for edit undo/redo.
// ============================================================

export interface EditableNote {
  /** Stable id. Base notes use `base-<i>` (regenerated each pass); manual notes
   *  use `m-<n>` (stable across base regeneration). */
  id: string
  startBeat: number
  endBeat: number
  midi: number
}

export interface PitchEditLayer {
  /** User-created / edited notes — pinned; survive base regeneration. */
  manual: EditableNote[]
  /** Beat spans the user deleted from (or moved a note out of) the base. */
  deleted: { startBeat: number; endBeat: number }[]
  /** Monotonic counter for stable manual-note ids. */
  seq: number
}

export const emptyEditLayer = (): PitchEditLayer => ({
  manual: [],
  deleted: [],
  seq: 0,
})

export const isEditLayerEmpty = (layer: PitchEditLayer): boolean =>
  layer.manual.length === 0 && layer.deleted.length === 0

const overlaps = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean => aStart < bEnd && aEnd > bStart

/**
 * Effective melody: base notes minus anything overlapping a manual note or a
 * deleted span, plus all manual notes. Sorted by time then pitch.
 */
export function applyEditLayer(
  base: EditableNote[],
  layer: PitchEditLayer,
): EditableNote[] {
  const kept = base.filter(
    (b) =>
      !layer.manual.some((m) =>
        overlaps(m.startBeat, m.endBeat, b.startBeat, b.endBeat),
      ) &&
      !layer.deleted.some((d) =>
        overlaps(d.startBeat, d.endBeat, b.startBeat, b.endBeat),
      ),
  )
  return [...kept, ...layer.manual].sort(
    (a, b) => a.startBeat - b.startBeat || a.midi - b.midi,
  )
}

const isManual = (layer: PitchEditLayer, id: string): boolean =>
  layer.manual.some((m) => m.id === id)

/**
 * Move / resize / retune a note. The note's original region is suppressed (so a
 * moved base note leaves no ghost at its old position) and a pinned manual note
 * is written at the new region. Idempotent on a manual note's id.
 */
export function editNote(
  layer: PitchEditLayer,
  note: EditableNote,
  patch: Partial<Pick<EditableNote, 'startBeat' | 'endBeat' | 'midi'>>,
): PitchEditLayer {
  const wasManual = isManual(layer, note.id)
  const id = wasManual ? note.id : `m-${layer.seq}`
  const edited: EditableNote = {
    id,
    startBeat: patch.startBeat ?? note.startBeat,
    endBeat: patch.endBeat ?? note.endBeat,
    midi: patch.midi ?? note.midi,
  }
  if (edited.endBeat <= edited.startBeat) return layer
  return {
    manual: [...layer.manual.filter((m) => m.id !== note.id), edited],
    deleted: [
      ...layer.deleted,
      { startBeat: note.startBeat, endBeat: note.endBeat },
    ],
    seq: wasManual ? layer.seq : layer.seq + 1,
  }
}

/** Delete a note: drop it if manual, and suppress its region in the base. */
export function deleteNote(
  layer: PitchEditLayer,
  note: EditableNote,
): PitchEditLayer {
  return {
    ...layer,
    manual: layer.manual.filter((m) => m.id !== note.id),
    deleted: [
      ...layer.deleted,
      { startBeat: note.startBeat, endBeat: note.endBeat },
    ],
  }
}

/** Split a note into two at `atBeat` (same pitch), pinning both halves. */
export function splitNote(
  layer: PitchEditLayer,
  note: EditableNote,
  atBeat: number,
): PitchEditLayer {
  if (atBeat <= note.startBeat || atBeat >= note.endBeat) return layer
  const suppressed = deleteNote(layer, note)
  const idA = `m-${suppressed.seq}`
  const idB = `m-${suppressed.seq + 1}`
  return {
    deleted: suppressed.deleted,
    seq: suppressed.seq + 2,
    manual: [
      ...suppressed.manual,
      { id: idA, startBeat: note.startBeat, endBeat: atBeat, midi: note.midi },
      { id: idB, startBeat: atBeat, endBeat: note.endBeat, midi: note.midi },
    ],
  }
}

/** Merge two notes into one spanning both (pitch of the earlier note). */
export function mergeNotes(
  layer: PitchEditLayer,
  a: EditableNote,
  b: EditableNote,
): PitchEditLayer {
  const lo = a.startBeat <= b.startBeat ? a : b
  const hi = a.startBeat <= b.startBeat ? b : a
  const suppressed = deleteNote(deleteNote(layer, a), b)
  const id = `m-${suppressed.seq}`
  return {
    deleted: suppressed.deleted,
    seq: suppressed.seq + 1,
    manual: [
      ...suppressed.manual,
      {
        id,
        startBeat: lo.startBeat,
        endBeat: hi.endBeat,
        midi: lo.midi,
      },
    ],
  }
}
