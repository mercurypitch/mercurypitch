// ============================================================
// Lyrics DB Service -- IndexedDB-backed lyrics persistence
// ============================================================

import { getDb } from '@/db'
import type { UvrSessionLyrics } from '@/db/entities'
import { IS_DEV } from '@/lib/defaults'
import type { LyricsVersion, LyricsVersionKind } from '@/lib/lyrics-versions'

export interface LyricsData {
  text: string
  format: 'txt' | 'lrc'
  filename: string
  wordTimings?: Record<number, (number | undefined)[]>
  originalText?: string
  blocks?: unknown[]
  blockInstances?: Record<string, unknown>
  fontSize?: number
  versions?: LyricsVersion[]
  activeVersionKind?: LyricsVersionKind
}

/** Writes under way, by session id -- see `inTurn`. */
const writesInFlight = new Map<string, Promise<unknown>>()

/**
 * One write per session at a time.
 *
 * A save is create-then-delete: it reads the rows that exist, writes the
 * new one, and removes the ones it read. Two saves that overlap each read
 * the same old row, so each leaves its own new row behind -- and a read
 * then took whichever of the two came first, which is how a record with
 * its versions and one without could take turns being "the lyrics". The
 * mixer's saves are fire-and-forget and the example seeder writes on its
 * own schedule, so overlapping is the ordinary case, not the rare one.
 *
 * This tab only. Two tabs can still overlap, which `newestOf` keeps
 * readable and the next save tidies up.
 */
function inTurn<T>(sessionId: string, write: () => Promise<T>): Promise<T> {
  const before = writesInFlight.get(sessionId) ?? Promise.resolve()
  // A failed write must not wedge the ones queued behind it.
  const mine = before.then(write, write)
  const settled = mine.catch(() => {})
  writesInFlight.set(sessionId, settled)
  void settled.then(() => {
    if (writesInFlight.get(sessionId) === settled)
      writesInFlight.delete(sessionId)
  })
  return mine
}

/** The row to believe when a session has more than one: the last written. */
function newestOf(rows: UvrSessionLyrics[]): UvrSessionLyrics | undefined {
  return rows.reduce<UvrSessionLyrics | undefined>(
    (newest, row) =>
      newest === undefined || row.createdAt > newest.createdAt ? row : newest,
    undefined,
  )
}

/**
 * Save or update lyrics, propagating storage and serialization failures.
 * Use this variant when the caller must know whether persistence succeeded.
 */
export function saveLyricsToDbStrict(
  sessionId: string,
  data: LyricsData,
): Promise<void> {
  return inTurn(sessionId, () => replaceLyrics(sessionId, data))
}

async function replaceLyrics(
  sessionId: string,
  data: LyricsData,
): Promise<void> {
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
      data.wordTimings !== undefined && Object.keys(data.wordTimings).length > 0
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
    versionsJson:
      data.versions !== undefined && data.versions.length > 0
        ? JSON.stringify(data.versions)
        : undefined,
    activeVersionKind: data.activeVersionKind,
  })
  for (const entry of existing) {
    if (entry.id !== created.id) await repo.delete(entry.id)
  }
}

/** Save or update lyrics for a session in IndexedDB. */
export async function saveLyricsToDb(
  sessionId: string,
  data: LyricsData,
): Promise<void> {
  try {
    await saveLyricsToDbStrict(sessionId, data)
  } catch (err) {
    console.error('[LyricsDB] saveLyricsToDb failed:', err)
  }
}

/**
 * Load lyrics, propagating storage failures and malformed persisted JSON.
 * A missing record is represented by `null` rather than an error.
 */
export async function loadLyricsFromDbStrict(
  sessionId: string,
): Promise<LyricsData | null> {
  const db = await getDb()
  const repo = db.getRepository<UvrSessionLyrics>('uvrSessionLyrics')
  const entry = newestOf(
    await repo.findAll({ where: { sessionId } as Record<string, unknown> }),
  )
  if (entry === undefined) return null

  const data: LyricsData = {
    text: entry.text,
    format: entry.format,
    filename: entry.filename,
  }
  if (entry.wordTimingsJson !== undefined) {
    data.wordTimings = JSON.parse(entry.wordTimingsJson)
  }
  if (entry.originalText !== undefined) data.originalText = entry.originalText
  if (entry.blocksJson !== undefined) {
    data.blocks = JSON.parse(entry.blocksJson)
  }
  if (entry.blockInstancesJson !== undefined) {
    data.blockInstances = JSON.parse(entry.blockInstancesJson)
  }
  if (entry.fontSize !== undefined) data.fontSize = entry.fontSize
  if (entry.versionsJson !== undefined) {
    data.versions = JSON.parse(entry.versionsJson)
  }
  if (entry.activeVersionKind !== undefined) {
    data.activeVersionKind = entry.activeVersionKind as LyricsVersionKind
  }
  return data
}

/** Load lyrics for a session from IndexedDB. */
export async function loadLyricsFromDb(
  sessionId: string,
): Promise<LyricsData | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrSessionLyrics>('uvrSessionLyrics')
    // Every row, not the first: see `inTurn` for how a session comes to
    // have two, and why "the first" was not a stable answer.
    const entry = newestOf(
      await repo.findAll({ where: { sessionId } as Record<string, unknown> }),
    )
    if (entry === undefined) return null

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
    if (entry.versionsJson !== undefined) {
      try {
        data.versions = JSON.parse(entry.versionsJson)
      } catch (err) {
        if (IS_DEV) console.warn('[LyricsDB] corrupt versionsJson:', err)
      }
    }
    if (entry.activeVersionKind !== undefined) {
      data.activeVersionKind = entry.activeVersionKind as LyricsVersionKind
    }
    return data
  } catch (err) {
    if (IS_DEV) console.warn('[LyricsDB] loadLyricsFromDb failed:', err)
    return null
  }
}

/**
 * Rename a session's stored copy, touching nothing else.
 *
 * A patch to the row, in turn with the saves. Re-saving a copy read earlier
 * would do the same job and put back whatever that copy held -- a rename
 * decided a moment before the mixer stored a new Edited version would take
 * the version away again.
 */
export async function renameLyricsInDb(
  sessionId: string,
  filename: string,
): Promise<void> {
  try {
    await inTurn(sessionId, async () => {
      const db = await getDb()
      const repo = db.getRepository<UvrSessionLyrics>('uvrSessionLyrics')
      const entry = newestOf(
        await repo.findAll({ where: { sessionId } as Record<string, unknown> }),
      )
      if (entry === undefined || entry.filename === filename) return
      await repo.update(entry.id, { filename })
    })
  } catch (err) {
    console.error('[LyricsDB] renameLyricsInDb failed:', err)
  }
}

/** Delete lyrics for a session from IndexedDB. */
export async function deleteLyricsFromDb(sessionId: string): Promise<void> {
  try {
    // In turn, or a save still on its way would land after the delete and
    // the lyrics somebody just removed would be back.
    await inTurn(sessionId, async () => {
      const db = await getDb()
      const repo = db.getRepository<UvrSessionLyrics>('uvrSessionLyrics')
      const existing = await repo.findAll({
        where: { sessionId } as Record<string, unknown>,
      })
      for (const entry of existing) {
        await repo.delete(entry.id)
      }
    })
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
