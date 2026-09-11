// Guitar backing mix storage remembers bounded song-local faders and explicit mutes.
// ============================================================

import { GUITAR_TRACK_MIX_MAX_DB } from './guitar-track-mix'

export const GUITAR_BACKING_MIX_STORAGE_KEY = 'guitar-night-song-mixes-v1'
export const GUITAR_BACKING_MIX_MAX_SESSIONS = 24
const MAX_TRACKS = 32
const MAX_ID_LENGTH = 256
const MAX_STORAGE_LENGTH = 256_000

export type GuitarBackingMixStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface GuitarBackingStoredTrackMix {
  id: string
  levelDb: number
  muted: boolean
}

interface StoredSessionMix {
  sessionId: string
  tracks: GuitarBackingStoredTrackMix[]
}

function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH
  )
}

function browserStorage(): GuitarBackingMixStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readSessions(
  storage: GuitarBackingMixStorage | null,
): StoredSessionMix[] {
  try {
    const raw = storage?.getItem(GUITAR_BACKING_MIX_STORAGE_KEY)
    if (
      raw === undefined ||
      raw === null ||
      raw === '' ||
      raw.length > MAX_STORAGE_LENGTH
    )
      return []
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      parsed.version !== 1 ||
      !('sessions' in parsed) ||
      !Array.isArray(parsed.sessions)
    )
      return []
    const sessions: StoredSessionMix[] = []
    for (const candidate of parsed.sessions.slice(
      -GUITAR_BACKING_MIX_MAX_SESSIONS,
    )) {
      if (
        typeof candidate !== 'object' ||
        candidate === null ||
        !validId(candidate.sessionId) ||
        !Array.isArray(candidate.tracks)
      )
        continue
      const tracks = new Map<string, GuitarBackingStoredTrackMix>()
      for (const track of candidate.tracks.slice(0, MAX_TRACKS)) {
        if (
          typeof track !== 'object' ||
          track === null ||
          !validId(track.id) ||
          typeof track.muted !== 'boolean' ||
          (track.levelDb !== null &&
            (typeof track.levelDb !== 'number' ||
              !Number.isFinite(track.levelDb)))
        )
          continue
        // JSON null encodes the silent fader. Finite legacy source defaults
        // below the new fader floor remain unchanged, including exactly -30.
        const levelDb =
          track.levelDb === null
            ? Number.NEGATIVE_INFINITY
            : Math.min(GUITAR_TRACK_MIX_MAX_DB, track.levelDb)
        tracks.set(track.id, { id: track.id, muted: track.muted, levelDb })
      }
      sessions.push({
        sessionId: candidate.sessionId,
        tracks: [...tracks.values()],
      })
    }
    return sessions
  } catch {
    return []
  }
}

export function readGuitarBackingMix(
  sessionId: string,
  storage: GuitarBackingMixStorage | null = browserStorage(),
): ReadonlyMap<string, GuitarBackingStoredTrackMix> {
  const saved = readSessions(storage).find((mix) => mix.sessionId === sessionId)
  return new Map(saved?.tracks.map((track) => [track.id, track]) ?? [])
}

/** Solo is a temporary audition mask and deliberately never enters storage. */
export function writeGuitarBackingMix(
  sessionId: string,
  tracks: readonly GuitarBackingStoredTrackMix[],
  storage: GuitarBackingMixStorage | null = browserStorage(),
): void {
  if (!validId(sessionId) || storage === null) return
  const savedTracks = tracks
    .filter((track) => validId(track.id))
    .slice(0, MAX_TRACKS)
    .map((track) => {
      const levelDb = Number.isNaN(track.levelDb)
        ? 0
        : Math.min(GUITAR_TRACK_MIX_MAX_DB, track.levelDb)
      return {
        id: track.id,
        muted: track.muted,
        levelDb,
      }
    })
  const sessions = readSessions(storage).filter(
    (mix) => mix.sessionId !== sessionId,
  )
  sessions.push({ sessionId, tracks: savedTracks })
  try {
    storage.setItem(
      GUITAR_BACKING_MIX_STORAGE_KEY,
      JSON.stringify(
        {
          version: 1,
          sessions: sessions.slice(-GUITAR_BACKING_MIX_MAX_SESSIONS),
        },
        (_key, value: unknown) =>
          value === Number.NEGATIVE_INFINITY ? null : value,
      ),
    )
  } catch {
    // Private browsing, revoked storage, and quota failure must not affect sound.
  }
}
