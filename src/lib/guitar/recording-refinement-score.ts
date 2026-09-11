// Offline polyphonic candidates become editable notes without altering captured audio or inventing pitches.
import type { PolyphonicNote } from '../transcription/basic-pitch-decoder'
import type { GuitarPracticeNote, GuitarPracticeScore } from './recording-types'
import { GUITAR_RECORDING_LIMIT_SECONDS } from './recording-types'

interface Position {
  string: number
  fret: number
}

/** Model confidence is separate from the live detector's clarity measurement. */
export interface RefinedRecordingScore {
  score: GuitarPracticeScore
  unassignedNoteIds: string[]
  confidenceByNoteId: Record<string, number>
}

export function createRefinedRecordingScore(
  base: GuitarPracticeScore,
  candidate: readonly PolyphonicNote[],
  candidateId: string,
): RefinedRecordingScore {
  if (
    !candidateId ||
    !Number.isFinite(base.bpm) ||
    base.bpm < 20 ||
    base.bpm > 300 ||
    base.tuning.length < 4 ||
    base.tuning.length > 8 ||
    base.tuning.some(
      (midi) => !Number.isInteger(midi) || midi < 0 || midi > 127,
    ) ||
    !Number.isInteger(base.capo) ||
    base.capo < 0 ||
    base.capo > 12
  )
    throw new Error(
      'Choose a supported recording tempo and tuning before refining notes.',
    )
  if (candidate.length === 0 || candidate.length > 10000)
    throw new Error('Refinement must contain between one and 10,000 notes.')
  if (
    candidate.some(
      (note) =>
        !Number.isInteger(note.midi) ||
        note.midi < 0 ||
        note.midi > 127 ||
        !Number.isFinite(note.startSeconds) ||
        !Number.isFinite(note.endSeconds) ||
        note.startSeconds < 0 ||
        note.endSeconds <= note.startSeconds ||
        note.endSeconds > GUITAR_RECORDING_LIMIT_SECONDS ||
        !Number.isFinite(note.confidence) ||
        note.confidence < 0 ||
        note.confidence > 1,
    )
  )
    throw new Error(
      'The refinement contains invalid pitches, timing or model confidence.',
    )

  const confidenceByNoteId: Record<string, number> = {}
  const notes: GuitarPracticeNote[] = candidate
    .map((note, index) => {
      const id = `${candidateId}:note:${index}`
      confidenceByNoteId[id] = note.confidence
      return {
        id,
        evidenceId: id,
        midi: note.midi,
        startBeat: (note.startSeconds * base.bpm) / 60,
        endBeat: (note.endSeconds * base.bpm) / 60,
        string: null,
        fret: null,
      }
    })
    .sort(
      (a, b) =>
        a.startBeat - b.startBeat ||
        a.midi - b.midi ||
        a.id.localeCompare(b.id),
    )
  assignChordFingering(notes, base.tuning, base.capo)
  return {
    score: { ...base, notes, attachment: null },
    unassignedNoteIds: notes
      .filter((note) => note.string === null)
      .map((note) => note.id),
    confidenceByNoteId,
  }
}

/** Shared live/offline fingering; mutates freshly created, time-sorted notes only. */
export function assignChordFingering(
  notes: GuitarPracticeNote[],
  tuning: readonly number[],
  capo: number,
) {
  const occupiedUntil = tuning.map(() => 0)
  let first = 0
  while (first < notes.length) {
    let last = first + 1
    while (
      last < notes.length &&
      notes[last].startBeat === notes[first].startBeat
    )
      last++
    const positions = new Map<GuitarPracticeNote, Position[]>()
    for (const note of notes.slice(first, last)) {
      positions.set(
        note,
        tuning
          .flatMap((open, index) => {
            const fret = note.midi - open - capo
            return fret >= 0 &&
              fret <= 24 &&
              occupiedUntil[index] <= note.startBeat
              ? [{ string: index + 1, fret }]
              : []
          })
          .sort((a, b) => a.fret - b.fret || a.string - b.string),
      )
    }
    const owners = new Map<number, GuitarPracticeNote>()
    // Maximum matching across this attack group avoids greedy allocations that
    // strand a playable bass note. Held strings remain fixed until their release.
    const assign = (
      note: GuitarPracticeNote,
      visited: Set<number>,
    ): boolean => {
      for (const position of positions.get(note)!) {
        if (visited.has(position.string)) continue
        visited.add(position.string)
        const previous = owners.get(position.string)
        if (!previous || assign(previous, visited)) {
          owners.set(position.string, note)
          return true
        }
      }
      return false
    }
    for (const note of notes
      .slice(first, last)
      .sort((a, b) => positions.get(a)!.length - positions.get(b)!.length))
      assign(note, new Set())
    for (const [string, note] of owners) {
      note.string = string
      note.fret = note.midi - tuning[string - 1] - capo
      occupiedUntil[string - 1] = note.endBeat
    }
    first = last
  }
}
