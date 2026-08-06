// ============================================================
// Whisper Transcription DB Service -- IndexedDB-backed persistence
// ============================================================

import { getDb } from '@/db'
import type { WhisperTranscriptionRecord } from '@/db/entities'
import { IS_DEV } from '@/lib/defaults'
import type { WhisperSegment } from '@/lib/whisper-service'

/**
 * Save transcription segments, propagating storage and serialization failures.
 */
export async function saveTranscriptionToDbStrict(
  sessionId: string,
  segments: WhisperSegment[],
): Promise<void> {
  const db = await getDb()
  const repo = db.getRepository<WhisperTranscriptionRecord>(
    'whisperTranscriptions',
  )

  // Upsert: delete existing entry for this session
  const existing = await repo.findAll({
    where: { sessionId } as Record<string, unknown>,
    limit: 1,
  })
  for (const entry of existing) {
    await repo.delete(entry.id)
  }

  await repo.create({
    sessionId,
    segmentsJson: JSON.stringify(segments),
    segmentCount: segments.length,
  })
}

/** Save or update whisper transcription segments for a session. */
export async function saveTranscriptionToDb(
  sessionId: string,
  segments: WhisperSegment[],
): Promise<void> {
  try {
    await saveTranscriptionToDbStrict(sessionId, segments)
  } catch (err) {
    if (IS_DEV) console.warn('[WhisperDB] saveTranscriptionToDb failed:', err)
  }
}

/**
 * Load transcription segments, propagating storage and malformed JSON errors.
 * A missing record is represented by `null` rather than an error.
 */
export async function loadTranscriptionFromDbStrict(
  sessionId: string,
): Promise<WhisperSegment[] | null> {
  const db = await getDb()
  const repo = db.getRepository<WhisperTranscriptionRecord>(
    'whisperTranscriptions',
  )
  const results = await repo.findAll({
    where: { sessionId } as Record<string, unknown>,
    limit: 1,
  })
  if (results.length === 0) return null

  const entry = results[0]
  return JSON.parse(entry.segmentsJson) as WhisperSegment[]
}

/** Load whisper transcription segments for a session from IndexedDB. */
export async function loadTranscriptionFromDb(
  sessionId: string,
): Promise<WhisperSegment[] | null> {
  try {
    return await loadTranscriptionFromDbStrict(sessionId)
  } catch (err) {
    if (IS_DEV) console.warn('[WhisperDB] loadTranscriptionFromDb failed:', err)
    return null
  }
}

/** Delete every whisper transcription from IndexedDB (used by data resets). */
export async function deleteAllTranscriptionsFromDb(): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<WhisperTranscriptionRecord>(
      'whisperTranscriptions',
    )
    const all = await repo.findAll({})
    for (const entry of all) {
      await repo.delete(entry.id)
    }
  } catch (err) {
    if (IS_DEV)
      console.warn('[WhisperDB] deleteAllTranscriptionsFromDb failed:', err)
  }
}

/** Delete whisper transcription for a session from IndexedDB. */
export async function deleteTranscriptionFromDb(
  sessionId: string,
): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<WhisperTranscriptionRecord>(
      'whisperTranscriptions',
    )
    const existing = await repo.findAll({
      where: { sessionId } as Record<string, unknown>,
    })
    for (const entry of existing) {
      await repo.delete(entry.id)
    }
  } catch (err) {
    if (IS_DEV)
      console.warn('[WhisperDB] deleteTranscriptionFromDb failed:', err)
  }
}
