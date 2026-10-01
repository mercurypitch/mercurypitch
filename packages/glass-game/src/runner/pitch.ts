// ============================================================
// Song runner pitch — one contour sampler for judge and presentation.
// ============================================================

import type { CompiledRunnerNote } from './contracts'

export function runnerNoteOffsetAt(
  note: CompiledRunnerNote,
  courseSeconds: number,
): number {
  if (note.connection === 'separate') return note.endOffsetSemitones
  const duration = note.endCourseSeconds - note.startCourseSeconds
  const progress =
    duration <= 0
      ? 1
      : Math.max(
          0,
          Math.min(1, (courseSeconds - note.startCourseSeconds) / duration),
        )
  return (
    note.startOffsetSemitones +
    (note.endOffsetSemitones - note.startOffsetSemitones) * progress
  )
}

export function runnerNoteMidiAt(
  note: CompiledRunnerNote,
  courseSeconds: number,
  rootMidi: number,
): number {
  return rootMidi + runnerNoteOffsetAt(note, courseSeconds)
}

export function runnerTargetNoteAt(
  notes: readonly CompiledRunnerNote[],
  courseSeconds: number,
): CompiledRunnerNote | undefined {
  return notes.find(
    (note) =>
      courseSeconds >= note.startCourseSeconds &&
      courseSeconds < note.endCourseSeconds,
  )
}

export function runnerTargetMidiAt(
  notes: readonly CompiledRunnerNote[],
  courseSeconds: number,
  rootMidi: number,
): number {
  if (notes.length === 0) throw new Error('Runner target has no notes.')
  const note =
    runnerTargetNoteAt(notes, courseSeconds) ??
    (courseSeconds < notes[0]!.startCourseSeconds ? notes[0]! : notes.at(-1)!)
  return runnerNoteMidiAt(note, courseSeconds, rootMidi)
}
