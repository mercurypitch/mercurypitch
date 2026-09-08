// Recorded evidence becomes an explicitly accepted, editable practice revision without rewriting capture times.
import type { InstrumentTuning } from './instrument-tuning'
import { assignStringForMidi, tuningLabels } from './instrument-tuning'
import type { GuitarPracticeNote, GuitarPracticeScore, GuitarRecordedNote, GuitarRecording, } from './recording-types'

export function recordingScoreTuning(
  score: GuitarPracticeScore,
): InstrumentTuning {
  return {
    instrument:
      score.instrument ?? ((score.tuning[0] ?? 64) < 57 ? 'bass' : 'guitar'),
    stringCount: score.tuning.length,
    openMidi: score.tuning,
    labels: tuningLabels(score.tuning),
    capo: score.capo,
  }
}

export function createRecordingScore(
  recording: GuitarRecording,
  notes: readonly GuitarRecordedNote[],
  tuning: InstrumentTuning,
): GuitarPracticeScore {
  tuning = recording.tuning ?? tuning
  const now = new Date().toISOString()
  return {
    id: globalThis.crypto.randomUUID(),
    recordingId: recording.id,
    revision: 1,
    title: recording.title,
    createdAt: now,
    updatedAt: now,
    bpm: 120,
    timeSignature: [4, 4],
    grid: 'display',
    instrument: tuning.instrument,
    tuning: [...tuning.openMidi],
    capo: tuning.capo ?? 0,
    attachment:
      recording.backing === null || notes.length === 0
        ? null
        : {
            backingId: recording.backing.id,
            firstSeconds:
              recording.backing.startSeconds +
              (notes[0].startFrame / recording.sampleRate) *
                recording.backing.rate,
            lastSeconds:
              recording.backing.startSeconds +
              (notes[notes.length - 1].startFrame / recording.sampleRate) *
                recording.backing.rate,
          },
    notes: notes.map((note) => {
      const position = assignStringForMidi(note.midi, tuning)
      return {
        id: note.id,
        evidenceId: note.id,
        midi: note.midi,
        startBeat: (note.startFrame / recording.sampleRate) * 2,
        endBeat: (note.endFrame / recording.sampleRate) * 2,
        string: position === null ? null : position.stringIndex + 1,
        fret: position?.fret ?? null,
      }
    }),
  }
}

/** Changing the display tempo preserves actual seconds, not an invented quantisation. */
export function changeRecordingScoreTempo(
  score: GuitarPracticeScore,
  bpm: number,
): GuitarPracticeScore {
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) return score
  return {
    ...score,
    bpm,
    grid: 'chosen',
    notes: score.notes.map((note) => ({
      ...note,
      startBeat: (note.startBeat * bpm) / score.bpm,
      endBeat: (note.endBeat * bpm) / score.bpm,
    })),
  }
}

export function changeRecordingNote(
  score: GuitarPracticeScore,
  id: string,
  patch: Partial<GuitarPracticeNote>,
): GuitarPracticeScore {
  const tuning = recordingScoreTuning(score)
  return {
    ...score,
    attachment:
      patch.startBeat !== undefined || patch.endBeat !== undefined
        ? null
        : score.attachment,
    notes: score.notes.map((note) => {
      if (note.id !== id) return note
      const updated = {
        ...note,
        ...patch,
        id: note.id,
        evidenceId: note.evidenceId,
      }
      if (patch.midi !== undefined) {
        const fingering = assignStringForMidi(updated.midi, tuning)
        updated.string = fingering === null ? null : fingering.stringIndex + 1
        updated.fret = fingering?.fret ?? null
      } else if (patch.string !== undefined && updated.string !== null) {
        updated.fret =
          updated.midi - (score.tuning[updated.string - 1] ?? NaN) - score.capo
      } else if (
        patch.fret !== undefined &&
        updated.string !== null &&
        updated.fret !== null
      ) {
        updated.midi =
          score.tuning[updated.string - 1] + score.capo + updated.fret
      }
      return updated
    }),
  }
}

/** Musical validity is independent of whether a pitch fits the recorded neck. */
export function recordingMidiProblem(
  score: GuitarPracticeScore,
): string | null {
  if (
    score == null ||
    !Array.isArray(score.notes) ||
    !Array.isArray(score.tuning) ||
    !Array.isArray(score.timeSignature) ||
    typeof score.recordingId !== 'string' ||
    typeof score.title !== 'string' ||
    !Number.isInteger(score.revision) ||
    score.revision < 1
  )
    return 'This practice score is damaged or uses an unsupported format.'
  if (!Number.isFinite(score.bpm) || score.bpm < 20 || score.bpm > 300)
    return 'Choose a tempo between 20 and 300 BPM.'
  if (score.notes.length === 0)
    return 'No stable melody notes yet. You can still keep the audio.'
  if (
    score.notes.length > 10000 ||
    score.tuning.length < 4 ||
    score.tuning.length > 8 ||
    score.tuning.some(
      (midi) => !Number.isInteger(midi) || midi < 0 || midi > 127,
    ) ||
    !Number.isInteger(score.capo) ||
    score.capo < 0 ||
    score.capo > 12
  )
    return 'This practice score has an unsupported size or tuning.'
  if (
    ![2, 3, 4, 5, 6, 7, 9, 12].includes(score.timeSignature[0]) ||
    ![2, 4, 8, 16].includes(score.timeSignature[1])
  )
    return 'Choose a supported time signature.'
  const ids = new Set<string>()
  const pitchEnds = new Map<number, number>()
  if (
    score.notes.some(
      (note) =>
        note == null ||
        typeof note.id !== 'string' ||
        typeof note.evidenceId !== 'string',
    )
  )
    return 'This practice score has damaged notes.'
  for (const note of [...score.notes].sort(
    (a, b) => a.startBeat - b.startBeat,
  )) {
    if (ids.has(note.id)) return 'Two notes have the same identity.'
    ids.add(note.id)
    if (
      !Number.isInteger(note.midi) ||
      note.midi < 0 ||
      note.midi > 127 ||
      !Number.isFinite(note.startBeat) ||
      !Number.isFinite(note.endBeat) ||
      note.startBeat < 0 ||
      note.endBeat <= note.startBeat
    )
      return 'Give each note a valid pitch, start and end.'
    if (note.startBeat < (pitchEnds.get(note.midi) ?? 0) - 0.000001)
      return 'Some notes of the same pitch overlap. Adjust their start/end or merge them before practicing.'
    if ((note.endBeat * 60) / score.bpm > 301)
      return 'This melody exceeds the five-minute recording limit.'
    pitchEnds.set(note.midi, note.endBeat)
  }
  return null
}

export function recordingNoteNeedsFingering(
  score: GuitarPracticeScore,
  note: GuitarPracticeNote,
): boolean {
  return (
    note.string === null ||
    note.fret === null ||
    !Number.isInteger(note.string) ||
    note.string < 1 ||
    note.string > score.tuning.length ||
    !Number.isInteger(note.fret) ||
    note.fret < 0 ||
    note.fret > 24 ||
    score.tuning[note.string - 1] + score.capo + note.fret !== note.midi
  )
}

export function recordingScoreProblem(
  score: GuitarPracticeScore,
): string | null {
  const problem = recordingMidiProblem(score)
  if (problem !== null) return problem
  if (score.notes.some((note) => recordingNoteNeedsFingering(score, note)))
    return 'Some notes do not fit this tuning. Correct their pitch or fingering, or exclude them from the practice notes.'
  const stringEnds = new Map<number, number>()
  for (const note of [...score.notes].sort(
    (a, b) => a.startBeat - b.startBeat,
  )) {
    if (note.startBeat < (stringEnds.get(note.string!) ?? 0) - 0.000001)
      return 'Some notes overlap on the same string. Choose different strings or adjust their start/end before practicing.'
    stringEnds.set(note.string!, note.endBeat)
  }
  return null
}

/** Explicit, undoable quantisation affects notation only; capture frames stay intact. */
export function quantizeRecordingScore(
  score: GuitarPracticeScore,
  division: 2 | 4,
): GuitarPracticeScore {
  const notes = [...score.notes]
    .sort((a, b) => a.startBeat - b.startBeat)
    .map((note) => {
      const startBeat = Math.round(note.startBeat * division) / division
      const endBeat = Math.max(
        startBeat + 1 / division,
        Math.round(note.endBeat * division) / division,
      )
      return { ...note, startBeat, endBeat }
    })
  return { ...score, grid: 'chosen', notes, attachment: null }
}

/** A split changes only this voice; neighbouring chord notes keep their releases. */
export function splitRecordingNote(
  score: GuitarPracticeScore,
  id: string,
  newId: string,
): GuitarPracticeScore {
  const index = score.notes.findIndex((note) => note.id === id)
  if (index < 0 || !newId || score.notes.some((note) => note.id === newId))
    return score
  const source = score.notes[index]
  const middle = (source.startBeat + source.endBeat) / 2
  if (
    !Number.isFinite(middle) ||
    middle <= source.startBeat ||
    middle >= source.endBeat
  )
    return score
  const notes = [...score.notes]
  notes.splice(
    index,
    1,
    { ...source, endBeat: middle },
    { ...source, id: newId, startBeat: middle },
  )
  return { ...score, notes, attachment: null }
}

/** Find the next attack on this string, never a neighbouring chord voice. */
export function recordingMergeTarget(
  score: GuitarPracticeScore,
  id: string,
): GuitarPracticeNote | null {
  const source = score.notes.find((note) => note.id === id)
  if (!source || recordingNoteNeedsFingering(score, source)) return null
  const next = score.notes
    .filter(
      (note) =>
        note.id !== id &&
        note.string === source.string &&
        note.startBeat >= source.startBeat,
    )
    .sort((a, b) => a.startBeat - b.startBeat)
    .at(0)
  if (
    !next ||
    next.midi !== source.midi ||
    next.fret !== source.fret ||
    next.startBeat < source.endBeat - 0.000001 ||
    next.endBeat <= source.endBeat
  )
    return null
  // Do not introduce a same-pitch collision across other strings while filling a gap.
  if (
    score.notes.some(
      (note) =>
        note.id !== id &&
        note.id !== next.id &&
        (note.midi === source.midi || note.string === source.string) &&
        note.startBeat < next.endBeat - 0.000001 &&
        note.endBeat > source.startBeat + 0.000001,
    )
  )
    return null
  return next
}

export function mergeRecordingNote(
  score: GuitarPracticeScore,
  id: string,
): GuitarPracticeScore {
  const next = recordingMergeTarget(score, id)
  if (!next) return score
  return {
    ...score,
    attachment: null,
    notes: score.notes
      .filter((note) => note.id !== next.id)
      .map((note) =>
        note.id === id ? { ...note, endBeat: next.endBeat } : note,
      ),
  }
}

export function acceptRecordingScoreRevision(
  score: GuitarPracticeScore,
  revision: number,
): GuitarPracticeScore {
  const problem = recordingScoreProblem(score)
  if (problem !== null) throw new Error(problem)
  const now = new Date().toISOString()
  return {
    ...structuredClone(score),
    id: `recorded:${score.recordingId}:${globalThis.crypto.randomUUID()}`,
    revision,
    createdAt: now,
    updatedAt: now,
    notes: [...score.notes].sort((a, b) => a.startBeat - b.startBeat),
  }
}
