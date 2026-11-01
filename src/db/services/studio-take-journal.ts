// ============================================================
// Studio take journal — a take kept on the device while it records, so a closed tab or a lost save still leaves it to keep
// ============================================================
//
// The recorder writes one row of 16-bit audio about every second
// (take-journal-feed.ts) and a header naming where the take sits in the
// song. When the take is stored like an imported file, its rows go. If the
// tab closes first, or the store refuses the take, the rows stay, and the
// Studio offers the take the next time the song opens.
//
// Reading back keeps every row up to the first one missing or damaged: a
// tab that died mid-write loses at most its last second. Each write is its
// own single-store transaction, so a recording never holds the project's
// stores while it runs. Rows go with their project (studio-service.ts).
import type { StudioTakeJournalHeader, StudioTakeJournalWriter, } from '@/lib/studio/record/recorder-types'
import type { DexieAdapter } from '../adapters/dexie-adapter'
import { getLocalDatabase } from '../local-database'
import { STUDIO_STORES } from './studio-storage-types'

export interface StudioTakeJournalRecord extends StudioTakeJournalHeader {
  readonly projectId: string
  /** Frames journaled so far, for the words that offer the take back. */
  readonly frames: number
  readonly createdAt: string
  readonly updatedAt: string
}

interface StudioTakeChunkRecord {
  readonly id: string
  readonly takeId: string
  readonly projectId: string
  readonly sequence: number
  readonly firstFrame: number
  readonly frames: number
  /** Little-endian signed 16-bit samples. */
  readonly pcm: ArrayBuffer
  readonly createdAt: string
  readonly updatedAt: string
}

export interface StudioTakeJournalDependencies {
  database?: () => DexieAdapter
  now?: () => Date
}

export function createStudioTakeJournal(
  dependencies: StudioTakeJournalDependencies = {},
) {
  const database = dependencies.database ?? getLocalDatabase
  const now = () => (dependencies.now ?? (() => new Date()))().toISOString()

  const header = (id: string) =>
    database().readByIdStrict<StudioTakeJournalRecord & { id: string }>(
      STUDIO_STORES.takes,
      id,
    )

  async function discard(id: string): Promise<void> {
    const db = database()
    await db.deleteByIndexStrict(STUDIO_STORES.takeChunks, 'takeId', id)
    await db.deleteByIdStrict(STUDIO_STORES.takes, id)
  }

  /** Writes for one song's takes, as the recorder makes them. */
  function writer(projectId: string): StudioTakeJournalWriter {
    // Each take's header as last written, so a row adds no read.
    const headers = new Map<string, StudioTakeJournalRecord>()
    const put = async (record: StudioTakeJournalRecord) => {
      headers.set(record.id, record)
      await database().putStrict(STUDIO_STORES.takes, record)
    }
    const current = async (id: string) =>
      headers.get(id) ?? (await header(id)) ?? null
    return {
      async begin(take) {
        const at = now()
        await put({
          ...take,
          projectId,
          frames: 0,
          createdAt: at,
          updatedAt: at,
        })
      },
      async place(id, heardFirst) {
        const record = await current(id)
        if (record !== null)
          await put({ ...record, heardFirst, updatedAt: now() })
      },
      async append(id, sequence, firstFrame, pcm) {
        const at = now()
        const row: StudioTakeChunkRecord = {
          id: `${id}:${sequence}`,
          takeId: id,
          projectId,
          sequence,
          firstFrame,
          frames: pcm.length,
          pcm: pcm.slice().buffer,
          createdAt: at,
          updatedAt: at,
        }
        await database().putStrict(STUDIO_STORES.takeChunks, row)
        const record = await current(id)
        if (record !== null)
          await put({
            ...record,
            frames: Math.max(record.frames, firstFrame + pcm.length),
            updatedAt: at,
          })
      },
      async discard(id) {
        headers.delete(id)
        await discard(id)
      },
    }
  }

  return {
    writer,
    /** The takes still journaled for a song, oldest first. */
    async list(projectId: string): Promise<StudioTakeJournalRecord[]> {
      const rows = await database().readByIndexStrict<
        StudioTakeJournalRecord & { id: string }
      >(STUDIO_STORES.takes, 'projectId', projectId)
      return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },
    /** A take's header and its audio up to the first row missing; null when it is gone. */
    async read(
      id: string,
    ): Promise<{ header: StudioTakeJournalRecord; pcm: Int16Array } | null> {
      const record = await header(id)
      if (record === undefined) return null
      const rows = (
        await database().readByIndexStrict<StudioTakeChunkRecord>(
          STUDIO_STORES.takeChunks,
          'takeId',
          id,
        )
      ).sort((a, b) => a.sequence - b.sequence)
      const parts: Int16Array[] = []
      let frames = 0
      for (const row of rows) {
        const whole =
          row.sequence === parts.length &&
          row.firstFrame === frames &&
          row.pcm.byteLength === row.frames * 2
        if (!whole) break
        parts.push(new Int16Array(row.pcm))
        frames += row.frames
      }
      const pcm = new Int16Array(frames)
      let at = 0
      for (const part of parts) {
        pcm.set(part, at)
        at += part.length
      }
      return { header: record, pcm }
    },
    discard,
  }
}

export type StudioTakeJournal = ReturnType<typeof createStudioTakeJournal>
