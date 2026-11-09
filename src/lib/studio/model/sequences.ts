// Studio sequences — the song's MIDI content as its clips name it: finding a sequence, which clips share it, and dropping the ones no clip names.
import type { StudioClip, StudioProject, StudioSequence } from './types'

/** The sequence `id` in `project`, or undefined when it has none by that id. */
export function studioSequence(
  project: Pick<StudioProject, 'sequences'>,
  id: string,
): StudioSequence | undefined {
  return project.sequences?.find((sequence) => sequence.id === id)
}

/** The clips that play sequence `id`. */
export function studioClipsOnSequence(
  project: Pick<StudioProject, 'clips'>,
  id: string,
): StudioClip[] {
  return project.clips.filter((clip) => clip.midi?.sequenceId === id)
}

const SEQUENCE_FIELDS = [
  'ppq',
  'tempoBpm',
  'lengthTicks',
  'nextNoteId',
] as const

const NOTE_FIELDS = [
  'id',
  'pitch',
  'startTick',
  'lengthTicks',
  'velocity',
  'releaseVelocity',
  'channel',
] as const

/** Whether two sequences hold the same notes, in the same order, on the same time, whatever their own ids. */
export function sameStudioSequence(
  a: StudioSequence,
  b: StudioSequence,
): boolean {
  if (SEQUENCE_FIELDS.some((field) => a[field] !== b[field])) return false
  return (
    a.notes.length === b.notes.length &&
    a.notes.every((note, index) =>
      NOTE_FIELDS.every((field) => note[field] === b.notes[index][field]),
    )
  )
}

/**
 * `project` without the sequences no clip names, and without `sequences`
 * at all once none is left, or when it holds none or undefined, so a song
 * with no MIDI looks as one from before there was any. The same object when
 * there is nothing to drop.
 */
export function pruneStudioSequences(project: StudioProject): StudioProject {
  if (!Object.hasOwn(project, 'sequences')) return project
  const named = new Set(
    project.clips.flatMap((clip) =>
      clip.midi === undefined ? [] : [clip.midi.sequenceId],
    ),
  )
  const all = project.sequences ?? []
  const kept = all.filter((sequence) => named.has(sequence.id))
  if (kept.length > 0 && kept.length === all.length) return project
  const next: { -readonly [K in keyof StudioProject]: StudioProject[K] } = {
    ...project,
  }
  if (kept.length > 0) next.sequences = kept
  else delete next.sequences
  return next
}
