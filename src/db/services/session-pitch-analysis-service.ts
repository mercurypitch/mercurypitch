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

export interface SessionPitchData {
  /** The original (algorithm) cleaned notes, before user edits. */
  segmentedNotes: MergedNote[]
  mergedNotes: MergedNote[]
  pitchHistory: PitchNote[]
  /** The user's manual edit layer (applied on top of segmentedNotes). */
  editLayer?: PitchEditLayer
  /** Detected per-region keys for the vocal. */
  keyRegions?: KeyRegion[]
}

/** Save pitch analysis results for a session. */
export async function savePitchAnalysisToDb(
  sessionId: string,
  data: SessionPitchData,
): Promise<void> {
  try {
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
        data.editLayer !== undefined
          ? JSON.stringify(data.editLayer)
          : undefined,
      keyRegionsJson:
        data.keyRegions !== undefined
          ? JSON.stringify(data.keyRegions)
          : undefined,
    })

    if (IS_DEV)
      console.log(
        `[PitchDB] Saved pitch analysis for session ${sessionId}: ${data.mergedNotes.length} merged, ${data.segmentedNotes.length} segmented`,
      )
  } catch (err) {
    if (IS_DEV) console.warn('[PitchDB] savePitchAnalysisToDb failed:', err)
  }
}

/** Load pitch analysis results for a session from IndexedDB. */
export async function loadPitchAnalysisFromDb(
  sessionId: string,
): Promise<SessionPitchData | null> {
  try {
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

    if (IS_DEV)
      console.log(
        `[PitchDB] Loaded pitch analysis for session ${sessionId}: ${mergedNotes.length} merged, ${segmentedNotes.length} segmented`,
      )

    return { mergedNotes, segmentedNotes, pitchHistory, editLayer, keyRegions }
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
