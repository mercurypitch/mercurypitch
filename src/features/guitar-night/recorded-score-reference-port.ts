// Recorded melodies join the existing score chooser only as accepted, immutable practice revisions.
import { createGuitarRecordingStore } from '@/db/services/guitar-recording-service'
import { createGuitarScoreAttachmentStore } from '@/db/services/guitar-score-attachment-service'
import { recordingScoreProblem, recordingScoreTuning, } from '@/lib/guitar/recording-score'
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import type { GuitarNightReferencePort, GuitarNightReferenceSource, } from './reference-port'
import { openGuitarNightReference, suggestReferenceInstrument, } from './reference-port'

export function recordedScoreSource(
  score: GuitarPracticeScore,
): GuitarNightReferenceSource {
  return {
    id: score.id,
    name: `${score.title} · recorded melody`,
    bpm: score.bpm,
    scoreTrackId: 'melody',
    tempoChanges: [{ beat: 0, usPerBeat: 60_000_000 / score.bpm }],
    timeSignatures: [
      {
        beat: 0,
        numerator: score.timeSignature[0],
        denominator: score.timeSignature[1],
      },
    ],
    tracks: [
      {
        id: 'melody',
        kind: 'pitched',
        name: `Your melody · revision ${score.revision}`,
        instrumentName: recordingScoreTuning(score).instrument,
        sourceProgram:
          recordingScoreTuning(score).instrument === 'bass' ? 33 : 27,
        sourceTuning: score.tuning,
        sourceCapo: score.capo,
        noteCount: score.notes.length,
        notes: score.notes.map((note) => ({
          id: note.id,
          midi: note.midi,
          startBeat: note.startBeat,
          duration: note.endBeat - note.startBeat,
          velocity: 85,
          stringIndex: note.string === null ? undefined : note.string - 1,
          fret: note.fret ?? undefined,
          authoredFingering: true,
        })),
      },
    ],
  }
}

export async function withRecordedGuitarScores(
  imported: GuitarNightReferencePort,
): Promise<GuitarNightReferencePort> {
  let scores = new Map<string, GuitarPracticeScore>()
  let currentIds = new Set<string>()
  let placementWrites = Promise.resolve()
  const refresh = async (): Promise<void> => {
    const store = createGuitarRecordingStore()
    const [rows, recordings] = await Promise.all([store.scores(), store.list()])
    scores = new Map(
      rows
        .filter((score) => recordingScoreProblem(score) === null)
        .map((score) => [score.id, score]),
    )
    currentIds = new Set(
      recordings.flatMap((row) => (row.scoreId === null ? [] : [row.scoreId])),
    )
  }
  await refresh()
  const source = (id: string): GuitarNightReferenceSource | null => {
    const score = scores.get(id)
    return score === undefined ? null : recordedScoreSource(score)
  }
  return {
    refresh,
    readRecordedPlacement: async (id, backingId) => {
      const score = scores.get(id)
      return score === undefined
        ? null
        : createGuitarScoreAttachmentStore().read(score, backingId)
    },
    saveRecordedPlacement: (id, backingId, alignment) => {
      if (!scores.has(id)) return Promise.resolve()
      const next = placementWrites
        .catch(() => undefined)
        .then(() =>
          createGuitarScoreAttachmentStore().save(id, backingId, alignment),
        )
      placementWrites = next
      return next
    },
    listReferences: () => [
      ...[...scores.values()]
        .filter((score) => currentIds.has(score.id))
        .map((score) => ({
          songId: score.id,
          title: `${score.title} · recorded melody`,
          trackCount: 1,
          importedAt: Date.parse(score.createdAt),
        })),
      ...imported.listReferences(),
    ],
    readSource: (id) => source(id) ?? imported.readSource(id),
    openReference: (id, track, tuning) => {
      const recorded = source(id)
      return recorded === null
        ? imported.openReference(id, track, tuning)
        : openGuitarNightReference(recorded, track, tuning)
    },
    suggestInstrument: (id, track) => {
      const recorded = source(id)
      return recorded === null
        ? imported.suggestInstrument(id, track)
        : suggestReferenceInstrument(recorded, track)
    },
    rememberTrack: (id, track) => {
      if (!scores.has(id)) imported.rememberTrack(id, track)
    },
    importReference: (file) => imported.importReference(file),
  }
}
