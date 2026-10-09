// ============================================================
// Karaoke key store — the key each song was last sung in
// ============================================================
//
// A per-song key shift (semitones, −6..+6), remembered on this device so a
// song comes back in the key the singer moved it to. A playlist entry's own
// key overrides it (see karaoke-playlist-store's `keyShift`). A song moved
// back to its original key is forgotten rather than stored as 0.
//
// Bounded at MAX_SONGS by recency: setting a song makes it the newest, and
// the oldest drops off, so the map cannot grow without limit.

import { clampKeyShift } from '@/lib/key-shift/key-shift'
import { createPersistedSignal } from '@/lib/storage'

const STORAGE_KEY = 'mp_karaoke_song_keys'
const MAX_SONGS = 500

type SongKeys = Record<string, number>

function isSongKeys(value: unknown): value is SongKeys {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Drops whatever it cannot read; clamps what it can.
function sanitize(raw: SongKeys): SongKeys {
  const clean: SongKeys = {}
  for (const [sessionId, value] of Object.entries(raw)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    const key = clampKeyShift(value)
    if (key !== 0) clean[sessionId] = key
  }
  return clean
}

const [songKeys, setSongKeys] = createPersistedSignal<SongKeys>(
  STORAGE_KEY,
  {},
  {
    validator: isSongKeys,
    deserializer: (raw) => {
      const parsed: unknown = JSON.parse(raw)
      return isSongKeys(parsed) ? sanitize(parsed) : {}
    },
  },
)

/** The key this song was last moved to; undefined when never moved. */
export function songKeyShift(sessionId: string): number | undefined {
  return songKeys()[sessionId]
}

/** Remember a song's key; 0 or undefined forgets it. */
export function setSongKeyShift(
  sessionId: string,
  keyShift: number | undefined,
): void {
  const key = keyShift === undefined ? 0 : clampKeyShift(keyShift)
  setSongKeys((previous) => {
    // Re-inserting moves the song to the end: insertion order is recency.
    // (Session ids are never integer-like, which would sort first instead.)
    const { [sessionId]: _dropped, ...rest } = previous
    if (key === 0) return rest
    const next: SongKeys = { ...rest, [sessionId]: key }
    const ids = Object.keys(next)
    for (const id of ids.slice(0, Math.max(0, ids.length - MAX_SONGS)))
      delete next[id]
    return next
  })
}
