// Explicit refinement commits preserve raw evidence and one reloadable, concurrency-checked undo.
import type { DexieAdapter } from '@/db/adapters/dexie-adapter'
import type { VoiceTakeAudioRecord } from '@/db/entities'
import { recordingMidiProblem } from '@/lib/guitar/recording-score'
import type { GuitarPracticeScore, GuitarRecording, GuitarRecordingChunk, GuitarRefinementBackup, } from '@/lib/guitar/recording-types'

export interface GuitarRecordingRefinementState {
  editableScore: GuitarPracticeScore | null
  acceptedScoreId: string | null
  /** Older kept takes can have an accepted target but no saved correction draft. */
  acceptedScore?: GuitarPracticeScore
  refinementBackup?: GuitarRefinementBackup
}

export interface ApplyGuitarRefinement {
  candidate: GuitarPracticeScore
  /** Current UI notes, including unsaved corrections, restored by explicit undo. */
  previousScore: GuitarPracticeScore
  /** The durable snapshot at analysis start, not the possibly edited UI score. */
  expectedEditableScore: GuitarPracticeScore | null
  expectedAcceptedScoreId: string | null
  expectedFrames: number
}

const STALE_NOTES =
  'These notes changed in another tab. Reopen the melody before applying or restoring a refinement.'

function sameScore(
  left: GuitarPracticeScore | null | undefined,
  right: GuitarPracticeScore | null | undefined,
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function checkSnapshot(score: GuitarPracticeScore, recordingId: string): void {
  if (
    score == null ||
    score.recordingId !== recordingId ||
    !Array.isArray(score.notes) ||
    score.notes.length > 10000 ||
    !Array.isArray(score.tuning) ||
    !Array.isArray(score.timeSignature)
  )
    throw new Error(
      'These saved notes are damaged or belong to another recording.',
    )
}

function checkCandidate(score: GuitarPracticeScore): void {
  const problem = recordingMidiProblem(score)
  if (problem !== null) throw new Error(problem)
  const metadata = score.refinement
  if (
    metadata == null ||
    metadata.version !== 1 ||
    metadata.model !== 'basic-pitch' ||
    metadata.source !== 'recorded-audio' ||
    typeof metadata.modelSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(metadata.modelSha256) ||
    typeof metadata.decoderVersion !== 'string' ||
    metadata.decoderVersion.length === 0 ||
    metadata.decoderVersion.length > 128 ||
    !Number.isFinite(Date.parse(metadata.createdAt)) ||
    metadata.confidenceByNoteId == null ||
    typeof metadata.confidenceByNoteId !== 'object' ||
    Array.isArray(metadata.confidenceByNoteId)
  )
    throw new Error('This refinement is missing its model provenance.')
  const ids = new Set(score.notes.map((note) => note.id))
  if (
    Object.keys(metadata.confidenceByNoteId).length !== ids.size ||
    Object.entries(metadata.confidenceByNoteId).some(
      ([id, confidence]) =>
        !ids.has(id) ||
        !Number.isFinite(confidence) ||
        confidence < 0 ||
        confidence > 1,
    )
  )
    throw new Error('This refinement has damaged note confidence evidence.')
}

/** Only the local database is used; no model result is saved until Apply is called. */
export function createGuitarRecordingRefinementStore(
  db: DexieAdapter,
  read: (id: string) => Promise<GuitarRecording>,
) {
  const stoppedSource = async (
    row: GuitarRecording,
  ): Promise<GuitarRecordingChunk> => {
    if (row.state === 'capturing')
      throw new Error(
        'Stop recording before applying or restoring refined notes.',
      )
    const ending = await db.readByIdStrict<GuitarRecordingChunk>(
      'guitarRecordingChunks',
      `${row.id}:ending`,
    )
    if (ending === undefined || ending.kind !== 'ending')
      throw new Error('The recording evidence is missing.')
    if (row.frames === 0) throw new Error('This recording has no source audio.')
    if (row.takeId !== null) {
      const audio = await db.readByIdStrict<VoiceTakeAudioRecord>(
        'voiceTakeAudio',
        `guitar-audio:${row.id}`,
      )
      if (
        audio === undefined ||
        audio.takeId !== row.takeId ||
        audio.size === 0
      )
        throw new Error(
          'The source recording audio is no longer on this device.',
        )
    } else {
      const parts = (
        await db.readByIndexStrict<GuitarRecordingChunk>(
          'guitarRecordingChunks',
          'recordingId',
          row.id,
        )
      )
        .filter((part) => part.kind === 'audio')
        .sort((a, b) => a.sequence - b.sequence)
      let frames = 0
      if (
        parts.length !== row.chunks ||
        parts.some((part, sequence) => {
          if (
            part.sequence !== sequence ||
            part.firstFrame !== frames ||
            part.frames <= 0 ||
            part.pcm === null ||
            part.pcm.byteLength !== part.frames * 2
          )
            return true
          frames += part.frames
          return false
        }) ||
        frames !== row.frames
      )
        throw new Error('The source recording audio is missing or incomplete.')
    }
    return ending
  }
  return {
    async readRefinementState(
      id: string,
    ): Promise<GuitarRecordingRefinementState> {
      return db.transaction(async () => {
        const row = await read(id)
        const ending = await db.readByIdStrict<GuitarRecordingChunk>(
          'guitarRecordingChunks',
          `${id}:ending`,
        )
        if (ending === undefined || ending.kind !== 'ending')
          throw new Error('The recording evidence is missing.')
        return {
          editableScore: ending.editableScore ?? null,
          acceptedScoreId: row.scoreId,
          acceptedScore:
            ending.editableScore === undefined && row.scoreId !== null
              ? await db.readByIdStrict<GuitarPracticeScore>(
                  'guitarPracticeScores',
                  row.scoreId,
                )
              : undefined,
          refinementBackup: ending.refinementBackup,
        }
      })
    },
    async applyRefinement(
      input: ApplyGuitarRefinement,
    ): Promise<GuitarPracticeScore> {
      // Snapshot before awaiting the transaction: caller edits cannot mutate its intent.
      const request = structuredClone(input)
      const id = request.candidate.recordingId
      checkCandidate(request.candidate)
      checkSnapshot(request.previousScore, id)
      if (request.expectedEditableScore !== null)
        checkSnapshot(request.expectedEditableScore, id)
      return db.transaction(async () => {
        const row = await read(id)
        const ending = await stoppedSource(row)
        if (
          row.frames !== request.expectedFrames ||
          row.scoreId !== request.expectedAcceptedScoreId ||
          !sameScore(ending.editableScore, request.expectedEditableScore)
        )
          throw new Error(STALE_NOTES)
        const now = new Date().toISOString()
        await db.putStrict('guitarRecordingChunks', {
          ...ending,
          editableScore: request.candidate,
          refinementBackup: {
            version: 1,
            createdAt: now,
            previousScore: request.previousScore,
            appliedScore: request.candidate,
            acceptedScoreId: row.scoreId,
            frames: row.frames,
          },
          updatedAt: now,
        })
        await db.putStrict('guitarRecordings', { ...row, updatedAt: now })
        return request.candidate
      })
    },
    async restoreRefinement(
      expectedCurrentScore: GuitarPracticeScore,
    ): Promise<GuitarPracticeScore> {
      const expected = structuredClone(expectedCurrentScore)
      return db.transaction(async () => {
        const row = await read(expected.recordingId)
        const ending = await stoppedSource(row)
        const backup = ending.refinementBackup
        if (backup === undefined)
          throw new Error('There is no previous refinement to restore.')
        if (
          backup.version !== 1 ||
          row.frames !== backup.frames ||
          row.scoreId !== backup.acceptedScoreId ||
          !sameScore(ending.editableScore, expected) ||
          !sameScore(backup.appliedScore, expected)
        )
          throw new Error(STALE_NOTES)
        checkSnapshot(backup.previousScore, row.id)
        const now = new Date().toISOString()
        const restored = {
          ...ending,
          editableScore: backup.previousScore,
          updatedAt: now,
        }
        delete restored.refinementBackup
        await db.putStrict('guitarRecordingChunks', restored)
        await db.putStrict('guitarRecordings', { ...row, updatedAt: now })
        return backup.previousScore
      })
    },
  }
}
