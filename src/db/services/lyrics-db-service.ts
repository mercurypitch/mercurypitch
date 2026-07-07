// ============================================================
// Lyrics DB Service -- IndexedDB-backed lyrics persistence
// ============================================================

import { getDb } from '@/db'
import type { UvrSessionLyrics } from '@/db/entities'
import { IS_DEV } from '@/lib/defaults'

export interface LyricsData {
  text: string
  format: 'txt' | 'lrc'
  filename: string
  wordTimings?: Record<number, (number | undefined)[]>
  originalText?: string
  blocks?: unknown[]
  blockInstances?: Record<string, unknown>
  fontSize?: number
}

/** Save or update lyrics for a session in IndexedDB. */
export async function saveLyricsToDb(
  sessionId: string,
  data: LyricsData,
): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrSessionLyrics>('uvrSessionLyrics')

    // Upsert as create-then-delete so a failed write never wipes existing
    // lyrics (delete-then-create loses them if the create throws).
    const existing = await repo.findAll({
      where: { sessionId } as Record<string, unknown>,
    })
    const created = await repo.create({
      sessionId,
      text: data.text,
      format: data.format,
      filename: data.filename,
      wordTimingsJson:
        data.wordTimings !== undefined &&
        Object.keys(data.wordTimings).length > 0
          ? JSON.stringify(data.wordTimings)
          : undefined,
      originalText: data.originalText,
      blocksJson:
        data.blocks !== undefined && data.blocks.length > 0
          ? JSON.stringify(data.blocks)
          : undefined,
      blockInstancesJson:
        data.blockInstances !== undefined &&
        Object.keys(data.blockInstances).length > 0
          ? JSON.stringify(data.blockInstances)
          : undefined,
      fontSize: data.fontSize,
    })
    for (const entry of existing) {
      if (entry.id !== created.id) await repo.delete(entry.id)
    }
  } catch (err) {
    console.error('[LyricsDB] saveLyricsToDb failed:', err)
  }
}

/** Load lyrics for a session from IndexedDB. */
export async function loadLyricsFromDb(
  sessionId: string,
): Promise<LyricsData | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrSessionLyrics>('uvrSessionLyrics')
    const results = await repo.findAll({
      where: { sessionId } as Record<string, unknown>,
      limit: 1,
    })
    if (results.length === 0) return null

    const entry = results[0]
    const data: LyricsData = {
      text: entry.text,
      format: entry.format,
      filename: entry.filename,
    }
    if (entry.wordTimingsJson !== undefined) {
      try {
        data.wordTimings = JSON.parse(entry.wordTimingsJson)
      } catch (err) {
        if (IS_DEV) console.warn('[LyricsDB] corrupt wordTimingsJson:', err)
      }
    }
    if (entry.originalText !== undefined) data.originalText = entry.originalText
    if (entry.blocksJson !== undefined) {
      try {
        data.blocks = JSON.parse(entry.blocksJson)
      } catch (err) {
        if (IS_DEV) console.warn('[LyricsDB] corrupt blocksJson:', err)
      }
    }
    if (entry.blockInstancesJson !== undefined) {
      try {
        data.blockInstances = JSON.parse(entry.blockInstancesJson)
      } catch (err) {
        if (IS_DEV) console.warn('[LyricsDB] corrupt blockInstancesJson:', err)
      }
    }
    if (entry.fontSize !== undefined) data.fontSize = entry.fontSize
    return data
  } catch (err) {
    if (IS_DEV) console.warn('[LyricsDB] loadLyricsFromDb failed:', err)
    return null
  }
}

/** Delete lyrics for a session from IndexedDB. */
export async function deleteLyricsFromDb(sessionId: string): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrSessionLyrics>('uvrSessionLyrics')
    const existing = await repo.findAll({
      where: { sessionId } as Record<string, unknown>,
    })
    for (const entry of existing) {
      await repo.delete(entry.id)
    }
  } catch (err) {
    if (IS_DEV) console.warn('[LyricsDB] deleteLyricsFromDb failed:', err)
  }
}

/** Delete all lyrics entries from IndexedDB. */
export async function deleteAllLyricsFromDb(): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrSessionLyrics>('uvrSessionLyrics')
    const all = await repo.findAll({})
    for (const entry of all) {
      await repo.delete(entry.id)
    }
  } catch (err) {
    if (IS_DEV) console.warn('[LyricsDB] deleteAllLyricsFromDb failed:', err)
  }
}

/** Retrieve all LRC format lyrics for Shazam catalog building */
export async function getAllLrcLyricsFromDb(): Promise<
  { sessionId: string; text: string; filename: string }[]
> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrSessionLyrics>('uvrSessionLyrics')
    const all = await repo.findAll({
      where: { format: 'lrc' } as Record<string, unknown>,
    })

    return all
      .filter((entry) => entry.text.length >= 20)
      .map((entry) => ({
        sessionId: entry.sessionId,
        text: entry.text,
        filename: entry.filename,
      }))
  } catch (err) {
    if (IS_DEV) console.warn('[LyricsDB] getAllLrcLyricsFromDb failed:', err)
    return []
  }
}
