// ============================================================
// Song manifests — the library list, without the audio
// ============================================================
//
// A separated song lives on the device that separated it: stems, lyrics,
// analysis, hundreds of megabytes of it, and none of that is ever going to
// our servers. What travels is the LIST — title, duration, which stems
// exist and how big they are. Kilobytes per song.
//
// That is enough for the thing people actually notice: sign in on a phone
// and the whole library is there, every song named, greyed out until its
// audio arrives by a transport that is not this file. It is also the
// manifest every later transport diffs against, so this is the first piece
// of cross-device sync and the only one that needs no bytes to move.
//
// See docs/plans/device-sync.md (Phase 3).

import { getDb } from '@/db'
import type { SongAudioQuality, SongManifest } from '@/db/entities'
import { hasValidToken } from '@/db/services/auth-service'
import { getUserId } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import type { UvrSession } from '@/stores/uvr-store'

/**
 * Whether there is an account to sync a library to.
 *
 * Signed out, everything here is inert. The device's own sessions are the
 * library, and inventing a local queue would mean deciding later whose
 * songs these were — the shared-computer problem voiceprints already had
 * to solve the hard way.
 */
function cloudActive(): boolean {
  try {
    return API_BASE_URL != null && API_BASE_URL !== '' && hasValidToken()
  } catch {
    return false
  }
}

async function manifestRepo() {
  const db = await getDb()
  return db.getRepository<SongManifest>('songManifests')
}

/** What a manifest says about one stem. No URL: this side has no audio. */
export interface ManifestStem {
  bytes?: number
}

export function parseManifestStems(
  manifest: Pick<SongManifest, 'stemsJson'>,
): Record<string, ManifestStem> {
  if (manifest.stemsJson === undefined || manifest.stemsJson === '') return {}
  try {
    const parsed: unknown = JSON.parse(manifest.stemsJson)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, ManifestStem>)
      : {}
  } catch {
    // A manifest written by a newer client is still a song worth listing.
    return {}
  }
}

/** Total download size a manifest implies, or undefined if it cannot say. */
export function manifestBytes(manifest: SongManifest): number | undefined {
  const sizes = Object.values(parseManifestStems(manifest))
    .map((s) => s.bytes)
    .filter((b): b is number => typeof b === 'number')
  return sizes.length === 0
    ? undefined
    : sizes.reduce((total, b) => total + b, 0)
}

/**
 * The manifest a local session would publish.
 *
 * Exported for its own sake: it is pure, and the mapping from "what this
 * device has" to "what the account is told" is the part worth pinning in
 * a test.
 */
export function manifestFromSession(
  session: UvrSession,
  opts: { userId: string; hasLyrics?: boolean; quality?: SongAudioQuality } = {
    userId: '',
  },
): Omit<SongManifest, 'id' | 'createdAt' | 'updatedAt'> | null {
  // No hash, no identity: the same song separated on two devices has to
  // land on one row, and the hash is the only thing that makes that true.
  if (session.fileHash === undefined || session.fileHash === '') return null
  if (session.status !== 'completed') return null

  const stems: Record<string, ManifestStem> = {}
  for (const [stem, meta] of Object.entries(session.stemMeta ?? {})) {
    // The original file is deliberately not advertised. A portable bundle
    // omits it, so promising it here would describe a download nobody can
    // fulfil (see D12 in the plan).
    if (stem === 'original') continue
    stems[stem] = { bytes: meta.size }
  }

  const durations = Object.values(session.stemMeta ?? {})
    .map((m) => m.duration)
    .filter((d): d is number => typeof d === 'number' && d > 0)

  return {
    userId: opts.userId,
    fileHash: session.fileHash,
    title: session.originalFile?.name ?? 'Unknown',
    durationSec: durations[0],
    // Separated here, so it is the real thing here. Only a synced copy is
    // ever anything less, and that is set by whoever wrote the bundle.
    quality: opts.quality ?? 'lossless',
    stemsJson:
      Object.keys(stems).length > 0 ? JSON.stringify(stems) : undefined,
    hasLyrics: opts.hasLyrics ?? false,
  }
}

/**
 * Tell the account about the songs this device has.
 *
 * Upserts by `(userId, fileHash)` so re-publishing is idempotent — the
 * library is republished on load, and a separation that ran twice must not
 * become two songs.
 *
 * Never throws. Publishing is bookkeeping that happens behind somebody
 * doing something else; a failed write means the second device sees the
 * library a bit later, not that anything here breaks.
 */
export async function publishLibraryManifests(
  sessions: readonly UvrSession[],
): Promise<number> {
  if (!cloudActive()) return 0
  const userId = getUserId()
  if (userId === '') return 0

  try {
    const repo = await manifestRepo()
    const existing = await repo.findAll({ where: { userId } })
    const byHash = new Map(existing.map((m) => [m.fileHash, m]))

    let written = 0
    for (const session of sessions) {
      const next = manifestFromSession(session, { userId })
      if (next === null) continue
      const prior = byHash.get(next.fileHash)
      if (prior === undefined) {
        await repo.create(next)
        written += 1
        continue
      }
      // Only write when something a reader would notice has changed.
      // Republishing an unchanged library on every load would be a write
      // per song per app start, for no new information.
      if (
        prior.title === next.title &&
        prior.durationSec === next.durationSec &&
        prior.stemsJson === next.stemsJson &&
        prior.hasLyrics === next.hasLyrics
      ) {
        continue
      }
      await repo.update(prior.id, next)
      written += 1
    }
    return written
  } catch (error) {
    console.warn('[library] could not publish the song list:', error)
    return 0
  }
}

/** Every song the account knows about, including ones this device lacks. */
export async function readLibraryManifests(): Promise<SongManifest[]> {
  if (!cloudActive()) return []
  const userId = getUserId()
  if (userId === '') return []
  try {
    const repo = await manifestRepo()
    return await repo.findAll({ where: { userId } })
  } catch (error) {
    console.warn('[library] could not read the song list:', error)
    return []
  }
}

/**
 * Songs the account has that this device cannot play.
 *
 * The subtraction the library UI needs: what to show greyed out. Matching
 * is by hash, so a song separated independently on both devices is one
 * song, not a duplicate with a download prompt on it.
 */
export function manifestsMissingHere(
  manifests: readonly SongManifest[],
  localSessions: readonly UvrSession[],
): SongManifest[] {
  const here = new Set(
    localSessions
      .filter((s) => s.status === 'completed')
      .map((s) => s.fileHash)
      .filter((h): h is string => h !== undefined && h !== ''),
  )
  return manifests.filter((m) => !here.has(m.fileHash))
}

/**
 * Bring the account's list up to date and answer what is missing here.
 *
 * Publish before reading, deliberately: the two devices write to one
 * table, so a device that reads first would show a list it is itself
 * absent from and look like it had lost its own songs.
 */
export async function syncLibraryList(
  localSessions: readonly UvrSession[],
): Promise<SongManifest[]> {
  await publishLibraryManifests(localSessions)
  const all = await readLibraryManifests()
  return manifestsMissingHere(all, localSessions)
}

/** Forget a song across the account — used when it is deleted everywhere. */
export async function forgetLibraryManifest(fileHash: string): Promise<void> {
  if (!cloudActive()) return
  const userId = getUserId()
  if (userId === '') return
  try {
    const repo = await manifestRepo()
    const rows = await repo.findAll({ where: { userId, fileHash } })
    for (const row of rows) await repo.delete(row.id)
  } catch (error) {
    console.warn('[library] could not forget a song:', error)
  }
}
