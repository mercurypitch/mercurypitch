// ============================================================
// Studio take notes store — the notes played into a MIDI lane's takes, on this device, by the take's id
// ============================================================
//
// One row per take (take-notes.ts says what a note is), keyed by the take's
// id, which is its stored audio's id too. The row goes with its audio: when
// the song lets the audio go and when the song is deleted
// (studio-service.ts). Device-only; never a cloud entity, never in the song.
import type { DbEntity } from '@/db/types'
import type { StudioTakeNote } from '@/lib/studio/record/take-notes'
import { sanitizeStudioTakeNotes } from '@/lib/studio/record/take-notes'
import type { DexieAdapter } from '../adapters/dexie-adapter'
import { getLocalDatabase } from '../local-database'
import { STUDIO_STORES } from './studio-storage-types'

export interface StudioTakeNotesRecord extends DbEntity {
  /** The take's id, which its stored audio has too. */
  id: string
  projectId: string
  notes: readonly StudioTakeNote[]
}

export interface StudioTakeNotesDependencies {
  database?: () => DexieAdapter
  now?: () => Date
}

export function createStudioTakeNotesStore(
  dependencies: StudioTakeNotesDependencies = {},
) {
  const database = dependencies.database ?? getLocalDatabase
  const now = () => (dependencies.now ?? (() => new Date()))().toISOString()
  return {
    /** Keep the notes played into take `takeId` of song `projectId`. */
    async keep(
      projectId: string,
      takeId: string,
      notes: readonly StudioTakeNote[],
    ): Promise<void> {
      const at = now()
      const record: StudioTakeNotesRecord = {
        id: takeId,
        projectId,
        notes,
        createdAt: at,
        updatedAt: at,
      }
      await database().putStrict(STUDIO_STORES.notes, record)
    },
    /** The notes kept for take `takeId`; none when it has none. */
    async read(takeId: string): Promise<StudioTakeNote[]> {
      const row = await database().readByIdStrict<StudioTakeNotesRecord>(
        STUDIO_STORES.notes,
        takeId,
      )
      return row === null || row === undefined
        ? []
        : sanitizeStudioTakeNotes(row.notes)
    },
  }
}
