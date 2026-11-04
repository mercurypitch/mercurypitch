// ============================================================
// Session Pitch Analysis DB Service -- IndexedDB-backed persistence
// ============================================================
//
// Persists denoised pitch analysis results per session so they
// auto-load when the user reopens the StemMixer.

import { getDb } from '@/db'
import type { OfflinePitchAnalysisRecord } from '@/db/entities'
import type { PitchEditLayer } from '@/features/stem-mixer/pitch-edit-model'
import type { PitchNote } from '@/features/stem-mixer/types'
import { IS_DEV } from '@/lib/defaults'
import type { KeyRegion } from '@/lib/key-detection'
import type { MergedNote } from '@/lib/midi-generator'
import type { SongTempoRecord } from '@/lib/song-tempo-record'
import { parseSongTempoRecord } from '@/lib/song-tempo-record'

export interface SessionPitchData {
  /** The original (algorithm) cleaned notes, before user edits. */
  segmentedNotes: MergedNote[]
  mergedNotes: MergedNote[]
  pitchHistory: PitchNote[]
  /** The user's manual edit layer (applied on top of segmentedNotes). */
  editLayer?: PitchEditLayer
  /** Detected per-region keys for the vocal. */
  keyRegions?: KeyRegion[]
  /** The song's tempo: the estimate and what the singer typed. */
  tempo?: SongTempoRecord
}

/**
 * Save pitch analysis, propagating storage and serialization failures.
 */
export async function savePitchAnalysisToDbStrict(
  sessionId: string,
  data: SessionPitchData,
): Promise<void> {
  const db = await getDb()
  const repo = db.getRepository<OfflinePitchAnalysisRecord>(
    'offlinePitchAnalysis',
  )

  // Upsert: delete existing entries for this session key
  const key = `session:${sessionId}`
  const existing = await repo.findAll({
    where: { fileHash: key } as Record<string, unknown>,
  })
  for (const entry of existing) {
    await repo.delete(entry.id)
  }

  await repo.create({
    fileHash: key,
    analysisResultsJson: JSON.stringify(data.mergedNotes),
    lrcLinesJson: JSON.stringify(data.pitchHistory),
    segmentedNotesJson: JSON.stringify(data.segmentedNotes),
    editLayerJson:
      data.editLayer !== undefined ? JSON.stringify(data.editLayer) : undefined,
    keyRegionsJson:
      data.keyRegions !== undefined
        ? JSON.stringify(data.keyRegions)
        : undefined,
    tempoJson:
      data.tempo !== undefined ? JSON.stringify(data.tempo) : undefined,
  })

  if (IS_DEV)
    console.log(
      `[PitchDB] Saved pitch analysis for session ${sessionId}: ${data.mergedNotes.length} merged, ${data.segmentedNotes.length} segmented`,
    )
}

/** Save pitch analysis results for a session. */
export async function savePitchAnalysisToDb(
  sessionId: string,
  data: SessionPitchData,
): Promise<void> {
  try {
    await savePitchAnalysisToDbStrict(sessionId, data)
  } catch (err) {
    if (IS_DEV) console.warn('[PitchDB] savePitchAnalysisToDb failed:', err)
  }
}

/**
 * The stored tempo. A tempo that does not read is dropped rather than thrown:
 * the notes matter more, and the song can estimate its tempo again.
 */
function readTempo(json: string | undefined): SongTempoRecord | undefined {
  if (json === undefined || json === '') return undefined
  try {
    return parseSongTempoRecord(JSON.parse(json))
  } catch {
    return undefined
  }
}

/**
 * Load pitch analysis, propagating storage and malformed JSON errors.
 * A missing record is represented by `null` rather than an error.
 */
export async function loadPitchAnalysisFromDbStrict(
  sessionId: string,
): Promise<SessionPitchData | null> {
  const db = await getDb()
  const repo = db.getRepository<OfflinePitchAnalysisRecord>(
    'offlinePitchAnalysis',
  )

  const key = `session:${sessionId}`
  const results = await repo.findAll({
    where: { fileHash: key } as Record<string, unknown>,
    limit: 1,
  })
  if (results.length === 0) return null

  const entry = results[0]
  const mergedNotes = JSON.parse(entry.analysisResultsJson) as MergedNote[]
  const pitchHistory = JSON.parse(entry.lrcLinesJson) as PitchNote[]
  const segmentedNotes = JSON.parse(entry.segmentedNotesJson) as MergedNote[]
  const editLayer =
    entry.editLayerJson !== undefined && entry.editLayerJson !== ''
      ? (JSON.parse(entry.editLayerJson) as PitchEditLayer)
      : undefined
  const keyRegions =
    entry.keyRegionsJson !== undefined && entry.keyRegionsJson !== ''
      ? (JSON.parse(entry.keyRegionsJson) as KeyRegion[])
      : undefined

  const tempo = readTempo(entry.tempoJson)

  if (IS_DEV)
    console.log(
      `[PitchDB] Loaded pitch analysis for session ${sessionId}: ${mergedNotes.length} merged, ${segmentedNotes.length} segmented`,
    )

  return {
    mergedNotes,
    segmentedNotes,
    pitchHistory,
    editLayer,
    keyRegions,
    tempo,
  }
}

/**
 * Whether a session has a stored pitch analysis, read without parsing it:
 * the Karaoke room asks this of each song it might read at rest, and most
 * have their notes. Propagates storage failures.
 */
export async function hasPitchAnalysisInDbStrict(
  sessionId: string,
): Promise<boolean> {
  const db = await getDb()
  const repo = db.getRepository<OfflinePitchAnalysisRecord>(
    'offlinePitchAnalysis',
  )
  const results = await repo.findAll({
    where: { fileHash: `session:${sessionId}` } as Record<string, unknown>,
    limit: 1,
  })
  return results.length > 0
}

/** Load pitch analysis results for a session from IndexedDB. */
export async function loadPitchAnalysisFromDb(
  sessionId: string,
): Promise<SessionPitchData | null> {
  try {
    return await loadPitchAnalysisFromDbStrict(sessionId)
  } catch (err) {
    if (IS_DEV) console.warn('[PitchDB] loadPitchAnalysisFromDb failed:', err)
    return null
  }
}

/** Delete pitch analysis for a session from IndexedDB. */
export async function deletePitchAnalysisFromDb(
  sessionId: string,
): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<OfflinePitchAnalysisRecord>(
      'offlinePitchAnalysis',
    )

    const key = `session:${sessionId}`
    const existing = await repo.findAll({
      where: { fileHash: key } as Record<string, unknown>,
    })
    for (const entry of existing) {
      await repo.delete(entry.id)
    }
  } catch (err) {
    if (IS_DEV) console.warn('[PitchDB] deletePitchAnalysisFromDb failed:', err)
  }
}
