// Local guitar drafts checkpoint incrementally and publish audio plus evidence in one transaction.
import { guitarWavHeader, recoverGuitarMelody, } from '@/lib/guitar/recording-evidence'
import { createRecordingPreview } from '@/lib/guitar/recording-gallery'
import { recordingScoreProblem } from '@/lib/guitar/recording-score'
import type { GuitarPracticeScore, GuitarRecordedNote, GuitarRecording, GuitarRecordingChunk, GuitarRecordingSummary, GuitarRefinementBackup, } from '@/lib/guitar/recording-types'
import { GUITAR_RECORDING_LIMIT_SECONDS } from '@/lib/guitar/recording-types'
import type { DexieAdapter } from '../adapters/dexie-adapter'
import { durableWrite, hasRoomFor } from '../durable-write'
import type { VoiceTakeAudioRecord, VoiceTakeRecord } from '../entities'
import { getLocalDatabase } from '../local-database'
import { createGuitarRecordingRefinementStore } from './guitar-recording-refinement'

export interface GuitarRecordingDraft {
  recording: GuitarRecording
  notes: GuitarRecordedNote[]
  blob: Blob | null
  peaks: number[]
  editableScore?: GuitarPracticeScore
  acceptedScore?: GuitarPracticeScore
  refinementBackup?: GuitarRefinementBackup
}

function validateRecording(row: GuitarRecording): void {
  if (
    row == null ||
    typeof row.id !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.createdAt !== 'string' ||
    row.version !== 1 ||
    !Number.isFinite(row.sampleRate) ||
    row.sampleRate < 8000 ||
    row.sampleRate > 192000 ||
    !Number.isInteger(row.chunks) ||
    row.chunks < 0 ||
    row.chunks > 10000 ||
    !Number.isInteger(row.frames) ||
    row.frames < 0 ||
    row.frames > row.sampleRate * GUITAR_RECORDING_LIMIT_SECONDS ||
    !['capturing', 'draft', 'kept'].includes(row.state)
  )
    throw new Error('This recording is damaged or uses a newer format.')
  if (
    row.tuning !== undefined &&
    (!Array.isArray(row.tuning.openMidi) ||
      row.tuning.openMidi.length < 4 ||
      row.tuning.openMidi.length > 8 ||
      row.tuning.openMidi.some(
        (note) => !Number.isInteger(note) || note < 0 || note > 127,
      ) ||
      !Number.isInteger(row.tuning.capo ?? 0) ||
      (row.tuning.capo ?? 0) < 0 ||
      (row.tuning.capo ?? 0) > 12)
  )
    throw new Error('This recording has damaged tuning information.')
}

/** Inject only the database boundary; tests use real transactions and IndexedDB. */
export function createGuitarRecordingStore(
  db: DexieAdapter = getLocalDatabase(),
) {
  const read = async (id: string): Promise<GuitarRecording> => {
    const row = await db.readByIdStrict<GuitarRecording>('guitarRecordings', id)
    if (row === undefined)
      throw new Error('This recording is no longer on this device.')
    validateRecording(row)
    return row
  }
  const chunks = async (id: string): Promise<GuitarRecordingChunk[]> => {
    const rows = await db.readByIndexStrict<GuitarRecordingChunk>(
      'guitarRecordingChunks',
      'recordingId',
      id,
    )
    return rows.sort((a, b) => a.sequence - b.sequence)
  }
  const addRevision = async (
    row: GuitarRecording,
    score: GuitarPracticeScore,
  ): Promise<void> => {
    const existing = await db.readByIdStrict<GuitarPracticeScore>(
      'guitarPracticeScores',
      score.id,
    )
    if (existing !== undefined) {
      if (existing.recordingId !== row.id)
        throw new Error('These notes belong to another recording.')
      if (
        row.scoreId !== score.id ||
        JSON.stringify(existing) !== JSON.stringify(score)
      )
        throw new Error(
          'These notes changed in another tab. Reopen the melody before accepting another revision.',
        )
      return
    }
    const current =
      row.scoreId === null
        ? null
        : await db.readByIdStrict<GuitarPracticeScore>(
            'guitarPracticeScores',
            row.scoreId,
          )
    if (
      score.recordingId !== row.id ||
      score.revision !== (current?.revision ?? 0) + 1
    )
      throw new Error(
        'These notes changed in another tab. Reopen the melody before accepting another revision.',
      )
    await db.addStrict('guitarPracticeScores', score)
  }
  return {
    ...createGuitarRecordingRefinementStore(db, read),
    read,
    async preview(id: string) {
      const row = await read(id)
      // Every finalized draft has one note-only ending record. Do not fetch
      // all PCM chunks or Hear Yourself blobs just to paint the gallery.
      const ending = await db.readByIdStrict<GuitarRecordingChunk>(
        'guitarRecordingChunks',
        `${id}:ending`,
      )
      if (ending === undefined) return null
      return createRecordingPreview(ending.notes, row.frames)
    },
    async list(): Promise<GuitarRecording[]> {
      const rows = await db.readAllStrict<GuitarRecording>('guitarRecordings')
      for (const row of rows) validateRecording(row)
      return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async begin(recording: GuitarRecording): Promise<void> {
      validateRecording(recording)
      if (
        !(await hasRoomFor(
          recording.sampleRate * GUITAR_RECORDING_LIMIT_SECONDS * 6,
        ))
      )
        throw new Error(
          'Not enough device storage for a recording. Free some space and try again.',
        )
      await db.addStrict('guitarRecordings', recording)
    },
    async checkpoint(chunk: GuitarRecordingChunk): Promise<void> {
      const result = await durableWrite('checkpoint guitar recording', () =>
        db.transaction(async () => {
          const row = await read(chunk.recordingId)
          if (row.state !== 'capturing')
            throw new Error('This recording is no longer capturing.')
          // Retrying an already-committed chunk must not double its duration.
          if (chunk.sequence < row.chunks) return
          if (
            chunk.kind !== 'audio' ||
            chunk.sequence !== row.chunks ||
            chunk.firstFrame !== row.frames ||
            chunk.pcm === null ||
            chunk.frames < 1 ||
            chunk.pcm.byteLength !== chunk.frames * 2 ||
            row.frames + chunk.frames >
              row.sampleRate * GUITAR_RECORDING_LIMIT_SECONDS
          )
            throw new Error('Recording audio arrived out of order.')
          const now = new Date().toISOString()
          await db.addStrict('guitarRecordingChunks', {
            ...chunk,
            createdAt: now,
            updatedAt: now,
          })
          await db.putStrict('guitarRecordings', {
            ...row,
            frames: row.frames + chunk.frames,
            chunks: row.chunks + 1,
            updatedAt: now,
          })
        }),
      )
      if (!result.ok)
        throw (
          result.error ?? new Error('The recording draft could not be saved.')
        )
    },
    async started(
      id: string,
      audioStartFrame: number,
      backing: GuitarRecording['backing'],
    ): Promise<void> {
      await db.transaction(async () => {
        const row = await read(id)
        if (row.state === 'capturing')
          await db.putStrict('guitarRecordings', {
            ...row,
            audioStartFrame,
            backing,
          })
      })
    },
    async finish(
      id: string,
      summary: GuitarRecordingSummary,
      audioStartFrame: number | null,
    ): Promise<void> {
      await db.transaction(async () => {
        const row = await read(id)
        if (row.state !== 'capturing') return
        const now = new Date().toISOString()
        // Complete notes live in an ending evidence chunk, never in catalogue
        // metadata. Live audio chunks also retain their partial/recovery notes.
        const ending: GuitarRecordingChunk = {
          id: `${id}:ending`,
          recordingId: id,
          sequence: row.chunks,
          kind: 'ending',
          createdAt: now,
          updatedAt: now,
          firstFrame: row.frames,
          frames: 0,
          pcm: null,
          pitches: [],
          attacks: [],
          notes:
            summary.frames === row.frames
              ? summary.notes.filter((note) => note.endFrame <= row.frames)
              : recoverGuitarMelody(
                  await chunks(id),
                  row.sampleRate,
                  row.frames,
                ),
          peak: 0,
        }
        await db.putStrict('guitarRecordingChunks', ending)
        await db.putStrict('guitarRecordings', {
          ...row,
          state: 'draft',
          updatedAt: now,
          audioStartFrame,
          clockAnomalies: summary.clockAnomalies,
          interruption:
            summary.frames !== row.frames
              ? 'Only the durably saved part could be recovered.'
              : summary.interruption,
        })
      })
    },
    async load(id: string): Promise<GuitarRecordingDraft> {
      return db.transaction(async () => {
        const row = await read(id)
        const parts = await chunks(id)
        let frames = 0
        let sequence = 0
        const audio: ArrayBuffer[] = []
        const peaks: number[] = []
        let notes: GuitarRecordedNote[] = []
        let editableScore: GuitarPracticeScore | undefined
        let refinementBackup: GuitarRefinementBackup | undefined
        let hasEnding = false
        for (const part of parts) {
          if (
            !Array.isArray(part.notes) ||
            !Array.isArray(part.pitches) ||
            !Array.isArray(part.attacks) ||
            part.notes.length > 10000 ||
            part.pitches.length > 512 ||
            part.attacks.length > 8192 ||
            part.notes.some(
              (note) =>
                note == null ||
                !Number.isInteger(note.midi) ||
                note.midi < 0 ||
                note.midi > 127 ||
                !Number.isFinite(note.startFrame) ||
                !Number.isFinite(note.endFrame) ||
                note.startFrame < 0 ||
                note.endFrame <= note.startFrame ||
                note.endFrame > row.frames,
            ) ||
            part.pitches.some(
              (pitch) =>
                !Number.isFinite(pitch.frame) ||
                pitch.frame < 0 ||
                pitch.frame > row.frames ||
                (pitch.midi !== null && !Number.isFinite(pitch.midi)) ||
                !Number.isFinite(pitch.clarity),
            ) ||
            part.attacks.some(
              (frame) =>
                !Number.isFinite(frame) || frame < 0 || frame > row.frames,
            )
          )
            throw new Error('This recording has damaged note evidence.')
          if (part.kind === 'ending') {
            if (
              hasEnding ||
              part.sequence !== row.chunks ||
              part.firstFrame !== row.frames ||
              part.frames !== 0
            )
              throw new Error('This recording has a damaged ending.')
            hasEnding = true
            notes = part.notes
            editableScore = part.editableScore
            refinementBackup = part.refinementBackup
            continue
          }
          if (
            part.sequence !== sequence++ ||
            part.firstFrame !== frames ||
            part.frames < 1 ||
            (part.pcm !== null && part.pcm.byteLength !== part.frames * 2)
          )
            throw new Error(
              'This recording has a missing or damaged audio chunk.',
            )
          frames += part.frames
          if (part.pcm !== null) audio.push(part.pcm)
          peaks.push(part.peak)
          notes.push(...part.notes)
        }
        if (frames !== row.frames || sequence !== row.chunks)
          throw new Error('This recording is incomplete.')
        if (!hasEnding)
          notes = recoverGuitarMelody(parts, row.sampleRate, row.frames)
        if (
          editableScore !== undefined &&
          (!Array.isArray(editableScore.notes) ||
            !Array.isArray(editableScore.tuning) ||
            !Array.isArray(editableScore.timeSignature) ||
            editableScore.recordingId !== id)
        )
          throw new Error(
            'Saved corrections are damaged; the original evidence is still on this device.',
          )
        let blob: Blob | null = null
        if (row.takeId !== null) {
          const payload = await db.readByIdStrict<VoiceTakeAudioRecord>(
            'voiceTakeAudio',
            `guitar-audio:${id}`,
          )
          if (payload !== undefined)
            blob = new Blob([payload.data], { type: payload.mimeType })
        } else if (audio.length === row.chunks && frames > 0) {
          blob = new Blob([guitarWavHeader(frames, row.sampleRate), ...audio], {
            type: 'audio/wav',
          })
        }
        const acceptedScore =
          row.scoreId === null
            ? undefined
            : await db.readByIdStrict<GuitarPracticeScore>(
                'guitarPracticeScores',
                row.scoreId,
              )
        return {
          recording: row,
          notes,
          blob,
          peaks,
          editableScore,
          acceptedScore,
          refinementBackup,
        }
      })
    },
    async keep(
      draft: GuitarRecordingDraft,
      score?: GuitarPracticeScore,
      corrections?: GuitarPracticeScore,
    ): Promise<VoiceTakeRecord> {
      if (score !== undefined) {
        const problem = recordingScoreProblem(score)
        if (problem !== null || score.recordingId !== draft.recording.id)
          throw new Error(
            problem ?? 'These notes belong to a different recording.',
          )
      }
      const bytes = await draft.blob?.arrayBuffer()
      if (bytes === undefined || draft.recording.frames === 0)
        throw new Error('There is no recorded audio to keep.')
      if (!(await hasRoomFor(bytes.byteLength)))
        throw new Error(
          'Not enough device storage to keep this take. The draft is still here.',
        )
      const id = draft.recording.id
      const result = await durableWrite('keep guitar recording', () =>
        db.transaction(async () => {
          const row = await read(id)
          const takeId = `guitar-take:${id}`
          const existing = await db.readByIdStrict<VoiceTakeRecord>(
            'voiceTakes',
            takeId,
          )
          if (existing !== undefined) {
            // A concurrent plain Keep may win before Keep-and-practice. Its audio
            // is already durable, but the other tab's accepted target still must
            // be published before that tab opens it.
            if (score !== undefined) {
              await addRevision(row, score)
              const ending = await db.readByIdStrict<GuitarRecordingChunk>(
                'guitarRecordingChunks',
                `${id}:ending`,
              )
              if (ending !== undefined)
                await db.putStrict('guitarRecordingChunks', {
                  ...ending,
                  editableScore: corrections ?? score,
                })
              await db.putStrict('guitarRecordings', {
                ...row,
                scoreId: score.id,
                updatedAt: score.updatedAt,
              })
            }
            return existing
          }
          if (row.state !== 'draft' || row.frames !== draft.recording.frames)
            throw new Error(
              'Finish or recover this recording before keeping it.',
            )
          const now = new Date().toISOString()
          const take: VoiceTakeRecord = {
            id: takeId,
            createdAt: now,
            updatedAt: now,
            source: 'guitar-night',
            comparisonKey: `guitar-recording:${id}`,
            contextVersion: 1,
            capturedAt: row.createdAt,
            durationMs: Math.round((row.frames / row.sampleRate) * 1000),
            mimeType: 'audio/wav',
            sizeBytes: bytes.byteLength,
            peaks: draft.peaks,
            title: draft.recording.title.trim() || 'Recorded melody',
            favorite: false,
            contextJson: JSON.stringify({
              kind: 'guitar-recording',
              version: 1,
              recordingId: id,
              recordingLabel: 'Dry input',
              scoreId: score?.id ?? null,
            }),
            metricsVersion: 1,
            metricsJson: JSON.stringify({
              notesIdentified: draft.notes.length,
            }),
          }
          await db.addStrict('voiceTakes', take)
          await db.addStrict<VoiceTakeAudioRecord>('voiceTakeAudio', {
            id: `guitar-audio:${id}`,
            takeId,
            createdAt: now,
            updatedAt: now,
            mimeType: 'audio/wav',
            size: bytes.byteLength,
            data: bytes,
          })
          if (score !== undefined) await addRevision(row, score)
          await db.putStrict('guitarRecordings', {
            ...row,
            title: take.title,
            state: 'kept',
            takeId,
            scoreId: score?.id ?? row.scoreId,
            updatedAt: now,
          })
          for (const part of await chunks(id)) {
            if (
              part.pcm !== null ||
              (part.kind === 'ending' && corrections !== undefined)
            )
              await db.putStrict('guitarRecordingChunks', {
                ...part,
                pcm: null,
                ...(part.kind === 'ending' && corrections !== undefined
                  ? { editableScore: corrections }
                  : {}),
              })
          }
          return take
        }),
      )
      if (!result.ok || result.value === undefined)
        throw (
          result.error ??
          new Error('Could not keep this take. Your draft is still available.')
        )
      if (typeof navigator.storage?.persist === 'function')
        void navigator.storage.persist().catch(() => false)
      return result.value
    },
    async accept(score: GuitarPracticeScore): Promise<void> {
      const problem = recordingScoreProblem(score)
      if (problem !== null) throw new Error(problem)
      await db.transaction(async () => {
        const row = await read(score.recordingId)
        if (row.state !== 'kept')
          throw new Error(
            'Keep this recording before accepting its practice notes.',
          )
        await addRevision(row, score)
        const ending = await db.readByIdStrict<GuitarRecordingChunk>(
          'guitarRecordingChunks',
          `${row.id}:ending`,
        )
        if (ending !== undefined)
          await db.putStrict('guitarRecordingChunks', {
            ...ending,
            editableScore: score,
          })
        await db.putStrict('guitarRecordings', {
          ...row,
          scoreId: score.id,
          updatedAt: score.updatedAt,
        })
      })
    },
    async saveCorrections(score: GuitarPracticeScore): Promise<void> {
      if (!Array.isArray(score.notes) || score.notes.length > 10000)
        throw new Error('This melody is too large to save.')
      await db.transaction(async () => {
        const row = await read(score.recordingId)
        if (row.state === 'capturing')
          throw new Error('Stop recording before editing notes.')
        const ending = await db.readByIdStrict<GuitarRecordingChunk>(
          'guitarRecordingChunks',
          `${row.id}:ending`,
        )
        if (ending === undefined)
          throw new Error('The recording evidence is missing.')
        await db.putStrict('guitarRecordingChunks', {
          ...ending,
          editableScore: score,
          updatedAt: new Date().toISOString(),
        })
      })
    },
    async score(id: string): Promise<GuitarPracticeScore | null> {
      return (
        (await db.readByIdStrict<GuitarPracticeScore>(
          'guitarPracticeScores',
          id,
        )) ?? null
      )
    },
    async scores(): Promise<GuitarPracticeScore[]> {
      return db.readAllStrict<GuitarPracticeScore>('guitarPracticeScores')
    },
    async discard(id: string): Promise<void> {
      await db.transaction(async () => {
        const row = await read(id)
        if (row.state === 'kept')
          throw new Error(
            'Remove kept audio in Hear Yourself; its practice notes are preserved.',
          )
        await db.deleteByIndexStrict('guitarRecordingChunks', 'recordingId', id)
        await db.deleteByIdStrict('guitarRecordings', id)
      })
    },
    async remove(id: string): Promise<void> {
      await db.transaction(async () => {
        const row = await read(id)
        if (row.state === 'capturing')
          throw new Error('Stop or recover the recording before removing it.')
        const scores = await db.readByIndexStrict<GuitarPracticeScore>(
          'guitarPracticeScores',
          'recordingId',
          id,
        )
        for (const score of scores)
          await db.deleteByIndexStrict(
            'guitarScoreAttachments',
            'scoreId',
            score.id,
          )
        await db.deleteByIndexStrict('guitarPracticeScores', 'recordingId', id)
        await db.deleteByIndexStrict('guitarRecordingChunks', 'recordingId', id)
        await db.deleteByIndexStrict(
          'voiceTakeAudio',
          'takeId',
          `guitar-take:${id}`,
        )
        await db.deleteByIdStrict('voiceTakes', `guitar-take:${id}`)
        await db.deleteByIdStrict('guitarRecordings', id)
      })
    },
  }
}
export type GuitarRecordingStore = ReturnType<typeof createGuitarRecordingStore>
