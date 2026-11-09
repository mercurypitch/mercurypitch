// Studio MIDI validation — sequences, their notes and the clips that play them, refused whole when any field is out of its range.
import type { StudioClip, StudioClipMidi, StudioNote, StudioSequence, } from './types'
import { STUDIO_PPQ } from './types'
import { arrayValue, enumValue, frameValue, idValue, numberValue, record, requireValue, textValue, uniqueValue, } from './validation-values'

/** The most notes one sequence holds, as a piano performance take does. */
export const STUDIO_MAX_SEQUENCE_NOTES = 10_000

/** A velocity kept to 4 decimals, from `min` to 1. */
function levelValue(value: unknown, path: string, min: number): number {
  const level = numberValue(value, path, min, 1)
  requireValue(
    Math.round(level * 10_000) / 10_000 === level,
    path,
    'Expected at most 4 decimals',
  )
  return level
}

function validateStudioNote(raw: unknown, path: string): StudioNote {
  const value = record(
    raw,
    path,
    ['id', 'pitch', 'startTick', 'lengthTicks', 'velocity'],
    ['releaseVelocity', 'channel'],
  )
  frameValue(value.id, `${path}.id`, 1)
  const pitch = frameValue(value.pitch, `${path}.pitch`)
  requireValue(pitch <= 127, `${path}.pitch`, 'Expected 0 to 127')
  frameValue(value.startTick, `${path}.startTick`)
  frameValue(value.lengthTicks, `${path}.lengthTicks`, 1)
  requireValue(
    levelValue(value.velocity, `${path}.velocity`, 0) > 0,
    `${path}.velocity`,
    'Expected above 0',
  )
  // A field holding its default is left out, so one song has one spelling.
  if (Object.hasOwn(value, 'releaseVelocity'))
    requireValue(
      levelValue(value.releaseVelocity, `${path}.releaseVelocity`, 0) !== 0.5,
      `${path}.releaseVelocity`,
      'The default is left out',
    )
  if (Object.hasOwn(value, 'channel')) {
    const channel = frameValue(value.channel, `${path}.channel`)
    requireValue(channel <= 15, `${path}.channel`, 'Expected 0 to 15')
    requireValue(channel !== 0, `${path}.channel`, 'The default is left out')
  }
  return raw as StudioNote
}

/** One sequence: its own fields, every note, ids unique and below `nextNoteId`. */
export function validateStudioSequence(
  raw: unknown,
  path = 'sequence',
): StudioSequence {
  const value = record(raw, path, [
    'id',
    'ppq',
    'tempoBpm',
    'lengthTicks',
    'nextNoteId',
    'notes',
  ])
  idValue(value.id, `${path}.id`)
  enumValue(value.ppq, [STUDIO_PPQ], `${path}.ppq`)
  numberValue(value.tempoBpm, `${path}.tempoBpm`, 20, 300)
  frameValue(value.lengthTicks, `${path}.lengthTicks`, 1)
  const nextNoteId = frameValue(value.nextNoteId, `${path}.nextNoteId`, 1)
  const notes = arrayValue(value.notes, `${path}.notes`)
  requireValue(
    notes.length <= STUDIO_MAX_SEQUENCE_NOTES,
    `${path}.notes`,
    `A sequence holds at most ${STUDIO_MAX_SEQUENCE_NOTES} notes`,
  )
  const ids = new Set<string | number>()
  notes.forEach((each, index) => {
    const note = validateStudioNote(each, `${path}.notes[${index}]`)
    uniqueValue(note.id, ids, `${path}.notes[${index}].id`)
    requireValue(
      note.id < nextNoteId,
      `${path}.notes[${index}].id`,
      'Note ids are below nextNoteId',
    )
  })
  return raw as StudioSequence
}

/** A clip's `midi`: the sequence it names and its render key. */
export function validateStudioClipMidi(
  raw: unknown,
  path: string,
): StudioClipMidi {
  const value = record(raw, path, ['sequenceId', 'renderKey'])
  idValue(value.sequenceId, `${path}.sequenceId`)
  textValue(value.renderKey, `${path}.renderKey`, 128)
  return raw as StudioClipMidi
}

/** The song's sequences, ids unique, and every one a clip names among them. */
export function validateStudioSequences(
  raw: unknown,
  clips: readonly StudioClip[],
): StudioSequence[] {
  const sequences = (
    raw === undefined ? [] : arrayValue(raw, 'project.sequences')
  ).map((sequence, index) =>
    validateStudioSequence(sequence, `project.sequences[${index}]`),
  )
  const ids = new Set<string | number>()
  for (const sequence of sequences)
    uniqueValue(sequence.id, ids, `sequence.${sequence.id}`)
  for (const clip of clips)
    if (clip.midi !== undefined)
      requireValue(
        ids.has(clip.midi.sequenceId),
        `clip.${clip.id}.midi.sequenceId`,
        'Sequence does not exist',
      )
  return sequences
}
