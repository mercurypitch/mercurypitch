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
//
// A category that cannot be read is null, never zero: "0 MB" for a store
// that did not answer would be the same lie as "0 sessions" was.

import { createSignal } from 'solid-js'
import { getVoiceStorageSnapshot } from '@/db/services/voice-take-service'
import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'

export interface StorageFacts {
  takes: { count: number; bytes: number } | null
  voiceprints: { count: number; bytes: number }
  models: { bytes: number }
  cachedRooms: { bytes: number }
  /** Everything that could be read, added up. */
  total: number
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
  const sum =
    (takes?.bytes ?? 0) + voiceprints.bytes + models.bytes + cachedRooms.bytes
  setTotal(sum)
  return { takes, voiceprints, models, cachedRooms, total: sum }
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
