// Studio sequence commands — MIDI content added in the batch that adds its clip, and a clip's notes set on its sequence, which becomes the clip's own copy first when other clips share it.
//
// Duplicates, pastes and split halves share their sequence until one of
// them is edited, and then behave as independent: the edit gives that clip a
// copy under the id the caller hands over, inside the same command, so one
// undo takes it back. The clip keeps its render key, which no longer names
// its notes: its audio is due a render (midi/render-key.ts).
import { studioClipsOnSequence, studioSequence } from './sequences'
import type { StudioClip, StudioClipMidi, StudioNote, StudioProject, StudioSequence, } from './types'
import { requireValue } from './validation-values'

export type StudioSequenceEdit =
  | {
      /** A sequence for a clip added in the same batch: alone, it is dropped again as no clip names it. */
      readonly type: 'add-sequence'
      readonly sequence: StudioSequence
    }
  | {
      readonly type: 'set-sequence-notes'
      readonly clipId: string
      readonly notes: readonly StudioNote[]
      readonly nextNoteId: number
      /** The id of the clip's own copy, used only when other clips share its sequence. */
      readonly forkSequenceId: string
    }

export function isStudioSequenceEdit(edit: {
  type: string
}): edit is StudioSequenceEdit {
  return edit.type === 'add-sequence' || edit.type === 'set-sequence-notes'
}

function addSequence(
  project: StudioProject,
  sequence: StudioSequence,
): StudioProject {
  requireValue(
    studioSequence(project, sequence.id) === undefined,
    `sequence.${sequence.id}`,
    'Sequence already exists',
  )
  return { ...project, sequences: [...(project.sequences ?? []), sequence] }
}

function midiClip(
  project: StudioProject,
  clipId: string,
): { clip: StudioClip; midi: StudioClipMidi; sequence: StudioSequence } {
  const clip = project.clips.find((item) => item.id === clipId)
  requireValue(clip !== undefined, `clip.${clipId}`, 'Clip does not exist')
  requireValue(
    clip.midi !== undefined,
    `clip.${clip.id}.midi`,
    'Clip plays no notes',
  )
  const sequence = studioSequence(project, clip.midi.sequenceId)
  requireValue(
    sequence !== undefined,
    `clip.${clip.id}.midi.sequenceId`,
    'Sequence does not exist',
  )
  return { clip, midi: clip.midi, sequence }
}

function setSequenceNotes(
  project: StudioProject,
  edit: Extract<StudioSequenceEdit, { type: 'set-sequence-notes' }>,
): StudioProject {
  const { clip, midi, sequence } = midiClip(project, edit.clipId)
  // A note new to the sequence takes an id it has never handed out.
  const before = new Set(sequence.notes.map((note) => note.id))
  requireValue(
    edit.nextNoteId >= sequence.nextNoteId &&
      edit.notes.every(
        (note) => before.has(note.id) || note.id >= sequence.nextNoteId,
      ),
    `sequence.${sequence.id}.notes`,
    'Note ids are never reused',
  )
  if (
    edit.nextNoteId === sequence.nextNoteId &&
    JSON.stringify(edit.notes) === JSON.stringify(sequence.notes)
  )
    return project
  const edited = { ...sequence, notes: edit.notes, nextNoteId: edit.nextNoteId }
  const sequences = project.sequences ?? []
  if (studioClipsOnSequence(project, sequence.id).length === 1)
    return {
      ...project,
      sequences: sequences.map((each) =>
        each.id === sequence.id ? edited : each,
      ),
    }
  requireValue(
    studioSequence(project, edit.forkSequenceId) === undefined,
    `sequence.${edit.forkSequenceId}`,
    'Sequence already exists',
  )
  const own = { ...clip, midi: { ...midi, sequenceId: edit.forkSequenceId } }
  return {
    ...project,
    sequences: [...sequences, { ...edited, id: edit.forkSequenceId }],
    clips: project.clips.map((item) => (item.id === clip.id ? own : item)),
  }
}

export function applyStudioSequenceEdit(
  project: StudioProject,
  edit: StudioSequenceEdit,
): StudioProject {
  return edit.type === 'add-sequence'
    ? addSequence(project, edit.sequence)
    : setSequenceNotes(project, edit)
}
