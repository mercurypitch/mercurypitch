import { getDb } from '@/db'
import type { OfflinePitchAnalysisRecord } from '@/db/entities'

export async function saveOfflineAnalysis(
  fileHash: string,
  analysisResults: unknown,
  lrcLines?: unknown,
  segmentedNotes?: unknown,
): Promise<string | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<OfflinePitchAnalysisRecord>(
      'offlinePitchAnalysis',
    )

    // Upsert: delete existing entry for this hash
    const existing = await repo.findAll({
      where: { fileHash } as Record<string, unknown>,
    })
    for (const entry of existing) {
      await repo.delete(entry.id)
    }

    const created = await repo.create({
      fileHash,
      analysisResultsJson: JSON.stringify(analysisResults),
      lrcLinesJson: JSON.stringify(lrcLines !== undefined ? lrcLines : null),
      segmentedNotesJson: JSON.stringify(
        segmentedNotes !== undefined ? segmentedNotes : null,
      ),
    })
    return created.id
  } catch {
    return null
  }
}

export async function getOfflineAnalysis(fileHash: string): Promise<{
  analysisResults: unknown
  lrcLines?: unknown
  segmentedNotes?: unknown
} | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<OfflinePitchAnalysisRecord>(
      'offlinePitchAnalysis',
    )
    const results = await repo.findAll({
      where: { fileHash } as Record<string, unknown>,
      limit: 1,
    })
    if (results.length === 0) return null
    const entry = results[0]

    const analysisResults = JSON.parse(entry.analysisResultsJson) as unknown
    const lrcLinesRaw = JSON.parse(entry.lrcLinesJson) as unknown
    const lrcLines = lrcLinesRaw !== null ? lrcLinesRaw : undefined

    const segmentedNotesRaw = JSON.parse(entry.segmentedNotesJson) as unknown
    const segmentedNotes =
      segmentedNotesRaw !== null ? segmentedNotesRaw : undefined

    return { analysisResults, lrcLines, segmentedNotes }
  } catch {
    return null
  }
}

export async function deleteOfflineAnalysis(
  fileHash: string,
): Promise<boolean> {
  try {
    const db = await getDb()
    const repo = db.getRepository<OfflinePitchAnalysisRecord>(
      'offlinePitchAnalysis',
    )
    const existing = await repo.findAll({
      where: { fileHash } as Record<string, unknown>,
    })
    for (const entry of existing) {
      await repo.delete(entry.id)
    }
    return true
  } catch {
    return false
  }
}
