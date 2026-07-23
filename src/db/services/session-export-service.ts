import * as fflate from 'fflate'
import type { KaraokePlaylistItem, KaraokePlaylistRecord, SessionGroupRecord, } from '@/db'
import type { LyricsData } from '@/db/services/lyrics-db-service'
import { loadLyricsFromDb, saveLyricsToDb, } from '@/db/services/lyrics-db-service'
import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import { loadPitchAnalysisFromDb, savePitchAnalysisToDb, } from '@/db/services/session-pitch-analysis-service'
import { getOriginalFileBlob, getStemBlob, saveStemBlob, } from '@/db/services/uvr-service'
import { loadTranscriptionFromDb, saveTranscriptionToDb, } from '@/db/services/whisper-transcription-db-service'
import { IS_DEV } from '@/lib/defaults'
import type { WhisperSegment } from '@/lib/whisper-service'
import type { UvrSession } from '@/stores/app-store'
import { addSessionToGroup, createGroup, getAllUvrSessions, getGroupsReactive, getUvrSession, importUvrSession, } from '@/stores/app-store'
import { createPlaylistWithItems, getPlaylist, } from '@/stores/karaoke-playlist-store'

export function getSafeSessionName(session: {
  originalFile?: { name: string }
  sessionId: string
}): string {
  const rawName = session.originalFile?.name ?? session.sessionId
  const nameWithoutExt = rawName.replace(/\.[^/.]+$/, '')
  // Some browsers/servers replace '.' with '_' for extensions, strip lingering _mp3
  const cleanedName = nameWithoutExt.replace(
    /_(mp3|wav|flac|ogg|m4a|aac)$/i,
    '',
  )
  const safeName = cleanedName.replace(/[^a-z0-9_-]/gi, '_')
  return /[a-z0-9]/i.test(safeName) ? safeName : session.sessionId
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_')
}

// Types for the JSON payload stored inside the ZIP
interface ExportPayload {
  version: 1
  session: Omit<UvrSession, 'outputs'>
  lyrics: LyricsData | null
  transcription: WhisperSegment[] | null
  pitchAnalysis?: SessionPitchData | null
}

/** Backward-compatible import type (old exports may include `outputs`) */
interface ImportPayload {
  version: 1
  session: UvrSession
  lyrics: LyricsData | null
  transcription?: WhisperSegment[] | null
  pitchAnalysis?: SessionPitchData | null
}

/** Karaoke manifest stored at the ZIP root (karaoke.json) for playlist exports. */
interface KaraokeManifest {
  version: 1
  playlists: KaraokePlaylistRecord[]
  groups: { id: string; name: string; sessionIds: string[] }[]
}

/**
 * Loose ZIP detection for drag&drop and file pickers: extension first (drag
 * sources often omit the MIME type), then the common ZIP MIME variants.
 */
export function isZipFile(file: File): boolean {
  if (file.name.toLowerCase().endsWith('.zip')) return true
  const type = file.type.toLowerCase()
  return (
    type === 'application/zip' ||
    type === 'application/x-zip-compressed' ||
    type === 'application/zip-compressed'
  )
}

export interface SessionZipInspection {
  sessionCount: number
  invalidSessionCount: number
  playlistCount: number
  groupCount: number
  hasKaraokeManifest: boolean
  valid: boolean
  error?: string
}

/** Read only the small manifest JSON entries needed to preview an import.
 *
 * The filter is important: session archives can contain hundreds of MB of
 * audio, and a count should not inflate/decompress every stem before the user
 * has even confirmed the import. */
export async function inspectSessionZip(
  zipBlob: Blob,
): Promise<SessionZipInspection> {
  try {
    const buffer = await zipBlob.arrayBuffer()
    const unzipped = fflate.unzipSync(new Uint8Array(buffer), {
      filter: (entry) =>
        entry.name.endsWith('session.json') || entry.name === 'karaoke.json',
    })
    const sessionPaths = Object.keys(unzipped).filter((path) =>
      path.endsWith('session.json'),
    )
    let sessionCount = 0
    let invalidSessionCount = 0
    for (const path of sessionPaths) {
      try {
        const payload = JSON.parse(
          fflate.strFromU8(unzipped[path]),
        ) as Partial<ImportPayload>
        if (
          payload.version === 1 &&
          payload.session !== undefined &&
          payload.session !== null
        ) {
          sessionCount++
        } else {
          invalidSessionCount++
        }
      } catch {
        invalidSessionCount++
      }
    }
    if (sessionCount === 0) {
      return {
        sessionCount: 0,
        invalidSessionCount,
        playlistCount: 0,
        groupCount: 0,
        hasKaraokeManifest: false,
        valid: false,
        error:
          invalidSessionCount > 0
            ? 'No valid MercuryPitch sessions found'
            : 'No MercuryPitch sessions found',
      }
    }

    const invalidSessionWarning =
      invalidSessionCount > 0
        ? `${invalidSessionCount} invalid session ${invalidSessionCount === 1 ? 'entry' : 'entries'} will be skipped`
        : undefined
    const manifestBytes = unzipped['karaoke.json']
    if (manifestBytes === undefined) {
      return {
        sessionCount,
        invalidSessionCount,
        playlistCount: 0,
        groupCount: 0,
        hasKaraokeManifest: false,
        valid: true,
        error: invalidSessionWarning,
      }
    }

    try {
      const manifest = JSON.parse(
        fflate.strFromU8(manifestBytes),
      ) as Partial<KaraokeManifest>
      return {
        sessionCount,
        invalidSessionCount,
        playlistCount: Array.isArray(manifest.playlists)
          ? manifest.playlists.length
          : 0,
        groupCount: Array.isArray(manifest.groups) ? manifest.groups.length : 0,
        hasKaraokeManifest: true,
        valid: true,
        error: invalidSessionWarning,
      }
    } catch {
      return {
        sessionCount,
        invalidSessionCount,
        playlistCount: 0,
        groupCount: 0,
        hasKaraokeManifest: true,
        valid: true,
        error: [
          invalidSessionWarning,
          'Playlist details could not be previewed',
        ]
          .filter((message) => message !== undefined)
          .join(' · '),
      }
    }
  } catch {
    return {
      sessionCount: 0,
      invalidSessionCount: 0,
      playlistCount: 0,
      groupCount: 0,
      hasKaraokeManifest: false,
      valid: false,
      error: 'ZIP could not be read',
    }
  }
}

/**
 * Helper to fetch a Blob as Uint8Array
 */
async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer()
  return new Uint8Array(buffer)
}

/**
 * Prepare a single session's data for ZIP export.
 * Returns an object suitable for fflate.
 *
 * Stem audio is always loaded from IndexedDB rather than from session.outputs
 * URLs, which may be stale blob: URLs or domain-specific paths.  The session
 * JSON is serialised *without* outputs so the exported ZIP is fully
 * domain-agnostic.
 */
async function prepareSessionFilesForZip(
  sessionId: string,
  prefix = '',
  onProgress?: (pct: number) => void,
): Promise<fflate.Zippable> {
  const session = getUvrSession(sessionId)
  if (!session) throw new Error(`Session ${sessionId} not found`)

  const zippable: fflate.Zippable = {}

  // Progress steps: lyrics(10%) -> transcription(20%) -> original(50%) -> stems(90%) -> done(100%)
  onProgress?.(5)

  // 1. Gather Lyrics
  const lyrics = await loadLyricsFromDb(sessionId)
  onProgress?.(10)

  // 2. Gather Whisper Transcription
  const transcription = await loadTranscriptionFromDb(sessionId)
  onProgress?.(15)

  // 3. Gather Pitch Analysis
  const pitchAnalysis = await loadPitchAnalysisFromDb(sessionId)
  onProgress?.(20)

  // 3. Prepare payload -- deliberately omit `outputs` (domain/blob-specific URLs)
  const { outputs: _outputs, ...sessionWithoutOutputs } = session
  const payload: ExportPayload = {
    version: 1,
    session: sessionWithoutOutputs,
    lyrics,
    transcription,
    pitchAnalysis,
  }
  const payloadStr = JSON.stringify(payload, null, 2)
  zippable[`${prefix}session.json`] = fflate.strToU8(payloadStr)

  // 4. Gather Audio Files
  // Original
  const origBlob = await getOriginalFileBlob(sessionId)
  if (origBlob) {
    zippable[`${prefix}original_${session.originalFile?.name ?? 'audio.wav'}`] =
      await blobToUint8Array(origBlob)
  }
  onProgress?.(50)

  // Stems -- read directly from IndexedDB (domain-agnostic, survives page reloads)
  const stemTypes = ['vocal', 'instrumental'] as const
  for (let si = 0; si < stemTypes.length; si++) {
    const stemType = stemTypes[si]
    try {
      const blob = await getStemBlob(sessionId, stemType)
      if (!blob) continue
      const ext =
        blob.type.includes('mpeg') || blob.type.includes('mp3') ? 'mp3' : 'wav'
      zippable[`${prefix}stem_${stemType}.${ext}`] =
        await blobToUint8Array(blob)
    } catch (err) {
      if (IS_DEV)
        console.warn(`[Export] Failed to read stem ${stemType} from DB:`, err)
    }
    onProgress?.(50 + ((si + 1) / stemTypes.length) * 40)
  }

  onProgress?.(95)
  return zippable
}

/**
 * Export a single session as a ZIP file.
 */
export async function exportSession(
  sessionId: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  try {
    const session = getUvrSession(sessionId)
    if (!session) return

    onProgress?.(0)
    const zippable = await prepareSessionFilesForZip(sessionId, '', onProgress)

    const zipped = await new Promise<Uint8Array>((resolve, reject) => {
      fflate.zip(zippable, { level: 6 }, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })

    // Download
    const blob = new Blob([zipped.buffer as ArrayBuffer], {
      type: 'application/zip',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // safe filename
    const safeName = getSafeSessionName(session)
    const hqPrefix = session.processingMode === 'server' ? 'MC_HQ' : 'MC'
    a.download = `${hqPrefix}_Session_${safeName}.zip`
    a.click()
    URL.revokeObjectURL(url)
    onProgress?.(100)
  } catch (err) {
    console.error('[Export] Failed to export session:', err)
    throw err
  }
}

/**
 * Export all sessions as a single ZIP file containing subdirectories.
 */
export async function exportAllSessions(
  onProgress?: (progress: number) => void,
): Promise<void> {
  try {
    const sessions = getAllUvrSessions()
    if (sessions.length === 0) return

    let allZippable: fflate.Zippable = {}
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]
      const safeName = getSafeSessionName(session)
      const prefix = `${safeName}_${session.sessionId.substring(0, 8)}/`

      // Report sub-progress within each session (0-90% range)
      const sessionBase = (i / sessions.length) * 90
      const sessionRange = 90 / sessions.length
      const files = await prepareSessionFilesForZip(
        session.sessionId,
        prefix,
        onProgress
          ? (subPct) => {
              onProgress(
                Math.floor(sessionBase + (subPct / 100) * sessionRange),
              )
            }
          : undefined,
      )
      allZippable = { ...allZippable, ...files }
    }

    // Zip and download
    const zipped = await new Promise<Uint8Array>((resolve, reject) => {
      fflate.zip(allZippable, { level: 6 }, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })

    if (onProgress) {
      onProgress(100)
    }

    // Download
    const blob = new Blob([zipped.buffer as ArrayBuffer], {
      type: 'application/zip',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MC_All_Sessions.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('[Export] Failed to export all sessions:', err)
    throw err
  }
}

/**
 * Export all sessions belonging to a specific group as a ZIP file.
 */
export async function exportGroup(
  groupId: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  try {
    const allSessions = getAllUvrSessions()
    const sessions = allSessions.filter((s) => s.groupId === groupId)
    if (sessions.length === 0) return

    onProgress?.(0)
    const prefix = `${groupId.substring(0, 8)}/`

    let allZippable: fflate.Zippable = {}
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]
      const safeName = getSafeSessionName(session)
      const dirPrefix = `${prefix}${safeName}_${session.sessionId.substring(0, 8)}/`
      const sessionBase = (i / sessions.length) * 90
      const sessionRange = 90 / sessions.length
      const files = await prepareSessionFilesForZip(
        session.sessionId,
        dirPrefix,
        onProgress
          ? (subPct) => onProgress(sessionBase + (subPct / 100) * sessionRange)
          : undefined,
      )
      allZippable = { ...allZippable, ...files }
    }

    const zipped = await new Promise<Uint8Array>((resolve, reject) => {
      fflate.zip(allZippable, { level: 6 }, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })

    onProgress?.(100)

    const blob = new Blob([zipped.buffer as ArrayBuffer], {
      type: 'application/zip',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MC_Group_${groupId.substring(0, 8)}.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('[Export] Failed to export group:', err)
    throw err
  }
}

/**
 * Build the karaoke export as a ZIP Blob: every referenced session
 * (audio/stems/lyrics) plus a karaoke.json manifest holding the playlists
 * (singers, order, shuffle, play-mode) and the groups they use. Returns null
 * when no playlists resolve. Separated from the browser download so the whole
 * set can be round-tripped through import in tests.
 */
export async function buildKaraokePlaylistZip(
  playlistIds: string[],
  onProgress?: (pct: number) => void,
): Promise<Blob | null> {
  const playlists = playlistIds
    .map((id) => getPlaylist(id))
    .filter((p): p is KaraokePlaylistRecord => p !== undefined)
  if (playlists.length === 0) return null

  const allGroups = getGroupsReactive()
  const groupIds = new Set<string>()
  const sessionIds = new Set<string>()

  for (const pl of playlists) {
    for (const item of pl.items) {
      if (item.kind === 'group') {
        groupIds.add(item.refId)
        const g = allGroups.find((gr) => gr.id === item.refId)
        g?.sessionIds.forEach((s) => sessionIds.add(s))
      } else {
        sessionIds.add(item.refId)
      }
    }
  }

  // Resolve sessions; also pull in the group each one belongs to so the
  // "band" label is restored on import.
  const sessionList = [...sessionIds]
    .map((sid) => getUvrSession(sid))
    .filter((s): s is UvrSession => s !== undefined)
  for (const s of sessionList) {
    if (s.groupId !== undefined) groupIds.add(s.groupId)
  }

  const groups = [...groupIds]
    .map((id) => allGroups.find((g) => g.id === id))
    .filter((g): g is SessionGroupRecord => g !== undefined)
    .map((g) => ({
      id: g.id,
      name: g.name,
      sessionIds: g.sessionIds.filter((s) => sessionIds.has(s)),
    }))

  onProgress?.(0)
  let allZippable: fflate.Zippable = {}
  for (let i = 0; i < sessionList.length; i++) {
    const s = sessionList[i]
    const safeName = getSafeSessionName(s)
    const dirPrefix = `sessions/${safeName}_${s.sessionId.substring(0, 8)}/`
    const base = (i / sessionList.length) * 90
    const range = 90 / Math.max(1, sessionList.length)
    const files = await prepareSessionFilesForZip(
      s.sessionId,
      dirPrefix,
      onProgress ? (sub) => onProgress(base + (sub / 100) * range) : undefined,
    )
    allZippable = { ...allZippable, ...files }
  }

  const manifest: KaraokeManifest = { version: 1, playlists, groups }
  allZippable['karaoke.json'] = fflate.strToU8(
    JSON.stringify(manifest, null, 2),
  )

  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    fflate.zip(allZippable, { level: 6 }, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
  onProgress?.(100)

  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' })
}

/**
 * Export one or more karaoke playlists as a downloaded ZIP (contents per
 * {@link buildKaraokePlaylistZip}).
 */
export async function exportKaraokePlaylists(
  playlistIds: string[],
  onProgress?: (pct: number) => void,
): Promise<void> {
  try {
    const blob = await buildKaraokePlaylistZip(playlistIds, onProgress)
    if (blob === null) return

    const playlists = playlistIds
      .map((id) => getPlaylist(id))
      .filter((p): p is KaraokePlaylistRecord => p !== undefined)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const nameSlug =
      playlists.length === 1
        ? sanitizeFilename(playlists[0].name)
        : `${playlists.length}_playlists`
    a.download = `MC_Karaoke_${nameSlug}.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('[Export] Failed to export karaoke playlists:', err)
    throw err
  }
}

/**
 * Import a single session entry (one session.json + its audio files) from an
 * already-unzipped archive. Returns the original sessionId and the freshly
 * generated one so callers can remap references (e.g. karaoke playlists).
 */
async function importOneSession(
  unzipped: fflate.Unzipped,
  prefix: string,
  payload: ImportPayload,
  targetGroupId?: string,
): Promise<{ oldSessionId: string; newSessionId: string }> {
  // Generate a new UUID for the imported session to avoid collisions
  const newSessionId = globalThis.crypto.randomUUID()

  // Strip stale `outputs` from old-format exports that may contain
  // domain-specific or blob: URLs from the source environment
  const { outputs: _importedOutputs, ...sessionData } = payload.session
  const oldSessionId = payload.session.sessionId
  const newSession: UvrSession = {
    ...sessionData,
    sessionId: newSessionId,
    createdAt: Date.now(), // update timestamp to now
    // Drop the source groupId — group membership is re-established by the
    // caller (targetGroupId) or by the karaoke manifest, never the stale id.
    groupId: undefined,
  }

  // 1. Process original file
  const origFilePrefix = `${prefix}original_`
  const origFilePath = Object.keys(unzipped).find((p) =>
    p.startsWith(origFilePrefix),
  )
  if (origFilePath !== undefined) {
    const origName = origFilePath.substring(origFilePrefix.length)
    const mimeType = newSession.originalFile?.mimeType ?? 'audio/wav'
    const origBlob = new Blob([unzipped[origFilePath]], { type: mimeType })
    await saveStemBlob(newSessionId, 'original', origBlob, origName)
  }

  // 2. Process stems — reconstruct the outputs object with new URLs
  const newOutputs: Record<string, string> = {}
  const stemPrefix = `${prefix}stem_`
  const stemPaths = Object.keys(unzipped).filter((p) =>
    p.startsWith(stemPrefix),
  )

  for (const stemPath of stemPaths) {
    // extract stem name e.g. "stem_vocal.wav" -> "vocal"
    const filename = stemPath.substring(stemPrefix.length)
    const dotIdx = filename.lastIndexOf('.')
    const stemName = dotIdx !== -1 ? filename.substring(0, dotIdx) : filename

    const ext = dotIdx !== -1 ? filename.substring(dotIdx + 1) : 'wav'
    const mimeType = ext === 'mp3' ? 'audio/mpeg' : 'audio/wav'
    const stemBlob = new Blob([unzipped[stemPath]], { type: mimeType })

    await saveStemBlob(
      newSessionId,
      stemName as 'vocal' | 'instrumental' | 'original',
      stemBlob,
      filename,
    )
    newOutputs[stemName] = URL.createObjectURL(stemBlob)
  }

  if (Object.keys(newOutputs).length > 0) {
    newSession.outputs = newOutputs
  }

  // 3. Lyrics
  if (payload.lyrics) {
    await saveLyricsToDb(newSessionId, payload.lyrics)
  }
  // 4. Whisper transcription
  if (payload.transcription != null && payload.transcription.length > 0) {
    await saveTranscriptionToDb(newSessionId, payload.transcription)
  }
  // 5. Pitch analysis
  if (payload.pitchAnalysis != null) {
    await savePitchAnalysisToDb(newSessionId, payload.pitchAnalysis)
  }
  // 6. Save session to app-store
  importUvrSession(newSession)
  if (targetGroupId !== undefined) {
    // Keep both sides of the group relationship consistent. Setting groupId on
    // the session alone leaves the group's count/index empty and breaks moves.
    await addSessionToGroup(newSessionId, targetGroupId)
  }

  return { oldSessionId, newSessionId }
}

/**
 * Recreate exported karaoke groups + playlists, remapping all session and
 * group references to the freshly imported ids.
 */
async function importKaraokeManifest(
  manifest: KaraokeManifest,
  sessionIdMap: Map<string, string>,
): Promise<{ groups: number; playlists: number }> {
  const groupIdMap = new Map<string, string>()
  let groupCount = 0
  for (const g of manifest.groups ?? []) {
    const newGroup = await createGroup(g.name)
    groupIdMap.set(g.id, newGroup.id)
    groupCount++
    for (const oldSid of g.sessionIds) {
      const newSid = sessionIdMap.get(oldSid)
      if (newSid !== undefined) await addSessionToGroup(newSid, newGroup.id)
    }
  }

  let playlistCount = 0
  for (const pl of manifest.playlists ?? []) {
    const items: Omit<KaraokePlaylistItem, 'id'>[] = []
    for (const it of pl.items) {
      const newRef =
        it.kind === 'group'
          ? groupIdMap.get(it.refId)
          : sessionIdMap.get(it.refId)
      if (newRef === undefined) continue // referenced session/group missing
      items.push({
        kind: it.kind,
        refId: newRef,
        ...(it.singerName !== undefined ? { singerName: it.singerName } : {}),
        ...(it.shuffleWithinGroup !== undefined
          ? { shuffleWithinGroup: it.shuffleWithinGroup }
          : {}),
      })
    }
    await createPlaylistWithItems(pl.name, items, {
      shuffleOrder: pl.shuffleOrder,
      playMode: pl.playMode,
    })
    playlistCount++
  }

  return { groups: groupCount, playlists: playlistCount }
}

/**
 * Import sessions from a ZIP Blob.
 * Optionally assign imported sessions to a group.
 * If the archive contains a karaoke manifest (karaoke.json), its groups and
 * playlists (with singers) are recreated too, remapped to the new session ids.
 * Returns the number of successfully imported sessions.
 */
export async function importSessionsFromZip(
  zipBlob: Blob,
  targetGroupId?: string,
): Promise<number> {
  try {
    const buffer = await zipBlob.arrayBuffer()
    const uint8 = new Uint8Array(buffer)
    const unzipped = fflate.unzipSync(uint8)

    // Find all session.json files to identify session directories
    const sessionJsonPaths = Object.keys(unzipped).filter((p) =>
      p.endsWith('session.json'),
    )
    if (sessionJsonPaths.length === 0) {
      throw new Error('No session.json found in ZIP')
    }

    const hasKaraokeManifest = unzipped['karaoke.json'] !== undefined
    // A karaoke import owns grouping via its manifest; don't also force every
    // session into a single targetGroupId.
    const perSessionGroupId = hasKaraokeManifest ? undefined : targetGroupId

    const sessionIdMap = new Map<string, string>()
    let importedCount = 0

    for (const jsonPath of sessionJsonPaths) {
      try {
        const prefix = jsonPath.substring(
          0,
          jsonPath.length - 'session.json'.length,
        )
        const jsonContent = fflate.strFromU8(unzipped[jsonPath])
        const payload: ImportPayload = JSON.parse(jsonContent)

        if (
          payload.version !== 1 ||
          payload.session === undefined ||
          payload.session === null
        ) {
          if (IS_DEV)
            console.warn(`[Import] Invalid payload format in ${jsonPath}`)
          continue
        }

        const { oldSessionId, newSessionId } = await importOneSession(
          unzipped,
          prefix,
          payload,
          perSessionGroupId,
        )
        sessionIdMap.set(oldSessionId, newSessionId)
        importedCount++
      } catch (err) {
        if (IS_DEV)
          console.warn(`[Import] Failed to import session at ${jsonPath}:`, err)
      }
    }

    // Recreate karaoke groups + playlists if present
    if (hasKaraokeManifest) {
      try {
        const manifest: KaraokeManifest = JSON.parse(
          fflate.strFromU8(unzipped['karaoke.json']),
        )
        const { groups, playlists } = await importKaraokeManifest(
          manifest,
          sessionIdMap,
        )
        if (IS_DEV)
          console.info(
            `[Import] Restored ${playlists} karaoke playlist(s), ${groups} group(s)`,
          )
      } catch (err) {
        console.error('[Import] Failed to restore karaoke manifest:', err)
      }
    }

    return importedCount
  } catch (err) {
    console.error('[Import] Failed to import ZIP:', err)
    throw err
  }
}
