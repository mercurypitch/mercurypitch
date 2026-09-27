// ============================================================
// Storage facts — what MercuryPitch keeps on this phone
// ============================================================
//
// Four categories (S6 mock 6a), each read from the place that owns it:
//
//   takes        the voice store's own snapshot: every take's audio and
//                contour, which exist only on this phone
//   voiceprints  the device's own list (the account's copies are not here)
//   models       the pitch engine's wasm pair and model, measured when the
//                app was built: they go only with the app, so no Clear
//   cachedRooms  nothing, in a build where every room ships inside the app
//   importedSongs  the singer's own Karaoke songs, their voice and music
//                (plan S8 §9); only in a build that imports them
//
// A category that cannot be read is null, never zero: "0 MB" for a store
// that did not answer would be the same lie as "0 sessions" was.

import { createSignal } from 'solid-js'
import { getVoiceStorageSnapshot } from '@/db/services/voice-take-service'
import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import type { ImportedSongs } from '@/features/karaoke-room/karaoke-imported-songs'
import { importedSongs } from '@/features/karaoke-room/karaoke-imported-songs'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import { whenSessionStoreReady } from '@/stores/uvr-store'

export interface StorageFacts {
  takes: { count: number; bytes: number } | null
  voiceprints: { count: number; bytes: number }
  models: { bytes: number }
  cachedRooms: { bytes: number }
  /** Absent in a build that cannot import songs. A size never recorded is
   *  null and adds nothing to the total. */
  importedSongs?: ImportedSongs
  /** Everything that could be read, added up. */
  total: number
}

/** The singer's own songs, once the session store has read them. */
async function readThem(): Promise<ImportedSongs> {
  await whenSessionStoreReady()
  return importedSongs()
}

/** None to read in a build that cannot import them: one conditional on the
 *  constant, which a store build folds away with `readThem`. */
async function readImportedSongs(): Promise<ImportedSongs | undefined> {
  return KARAOKE_IMPORT ? readThem() : undefined
}

const [total, setTotal] = createSignal<number | null>(null)

/** The last total read, for the Settings row. Reactive; null before one. */
export const storageTotal = total

/** Read every category. Never throws. */
export async function loadStorageFacts(): Promise<StorageFacts> {
  let takes: StorageFacts['takes'] = null
  try {
    const snapshot = await getVoiceStorageSnapshot()
    takes = { count: snapshot.takeCount, bytes: snapshot.voiceBytes }
  } catch {
    // Named as unreadable on the screen, not as empty.
  }
  const prints = loadLocalVoiceprints()
  const voiceprints = {
    count: prints.length,
    bytes: prints.length === 0 ? 0 : new Blob([JSON.stringify(prints)]).size,
  }
  const models = { bytes: __PITCH_ENGINE_BYTES__ }
  const cachedRooms = { bytes: 0 }
  const songs = await readImportedSongs()
  const sum =
    (takes?.bytes ?? 0) +
    voiceprints.bytes +
    models.bytes +
    cachedRooms.bytes +
    (songs?.bytes ?? 0)
  setTotal(sum)
  return {
    takes,
    voiceprints,
    models,
    cachedRooms,
    ...(songs === undefined ? {} : { importedSongs: songs }),
    total: sum,
  }
}

/** "186 MB", "1.4 MB", "18.4 GB": decimal units, as the phone's own Settings. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB'
  const mb = bytes / 1_000_000
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`
  if (mb >= 100) return `${Math.round(mb)} MB`
  if (mb >= 0.1) return `${mb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} KB`
}
