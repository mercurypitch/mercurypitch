import * as fflate from 'fflate'
import type { LyricsData } from '@/db/services/lyrics-db-service'
import { loadLyricsFromDb, saveLyricsToDb, } from '@/db/services/lyrics-db-service'
import { getOriginalFileBlob, getStemBlob, saveStemBlob, } from '@/db/services/uvr-service'
import { IS_DEV } from '@/lib/defaults'
import type { UvrSession } from '@/stores/app-store'
import { getAllUvrSessions, getUvrSession, importUvrSession, } from '@/stores/app-store'

// Types for the JSON payload stored inside the ZIP
interface ExportPayload {
  version: 1
  session: Omit<UvrSession, 'outputs'>
  lyrics: LyricsData | null
}

/** Backward-compatible import type (old exports may include `outputs`) */
interface ImportPayload {
  version: 1
  session: UvrSession
  lyrics: LyricsData | null
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
): Promise<fflate.Zippable> {
  const session = getUvrSession(sessionId)
  if (!session) throw new Error(`Session ${sessionId} not found`)

  const zippable: fflate.Zippable = {}

  // 1. Gather Lyrics
  const lyrics = await loadLyricsFromDb(sessionId)

  // 2. Prepare payload — deliberately omit `outputs` (domain/blob-specific URLs)
  const { outputs: _outputs, ...sessionWithoutOutputs } = session
  const payload: ExportPayload = {
    version: 1,
    session: sessionWithoutOutputs,
    lyrics,
  }
  const payloadStr = JSON.stringify(payload, null, 2)
  zippable[`${prefix}session.json`] = fflate.strToU8(payloadStr)

  // 3. Gather Audio Files
  // Original
  const origBlob = await getOriginalFileBlob(sessionId)
  if (origBlob) {
    zippable[`${prefix}original_${session.originalFile?.name ?? 'audio.wav'}`] =
      await blobToUint8Array(origBlob)
  }

  // Stems — read directly from IndexedDB (domain-agnostic, survives page reloads)
  const stemTypes = ['vocal', 'instrumental'] as const
  for (const stemType of stemTypes) {
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
  }

  return zippable
}

/**
 * Export a single session as a ZIP file.
 */
export async function exportSession(sessionId: string): Promise<void> {
  try {
    const session = getUvrSession(sessionId)
    if (!session) return

    const zippable = await prepareSessionFilesForZip(sessionId)
    const zipped = fflate.zipSync(zippable, { level: 6 })

    // Download
    const blob = new Blob([zipped], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // safe filename
    const safeName = (session.originalFile?.name ?? sessionId).replace(
      /[^a-z0-9_-]/gi,
      '_',
    )
    a.download = `MercuryPitch_Session_${safeName}.zip`
    a.click()
    URL.revokeObjectURL(url)
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
      const safeName = (
        session.originalFile?.name ?? session.sessionId
      ).replace(/[^a-z0-9_-]/gi, '_')
      const prefix = `${safeName}_${session.sessionId.substring(0, 8)}/`
      const files = await prepareSessionFilesForZip(session.sessionId, prefix)
      allZippable = { ...allZippable, ...files }

      if (onProgress) {
        // Dedicate 90% of the progress to fetching files from DB
        onProgress(Math.floor(((i + 1) / sessions.length) * 90))
      }
    }

    // Zip and download
    const zipped = fflate.zipSync(allZippable, { level: 6 })

    if (onProgress) {
      onProgress(100)
    }

    // Download
    const blob = new Blob([zipped], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MercuryPitch_All_Sessions.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('[Export] Failed to export all sessions:', err)
    throw err
  }
}

/**
 * Import sessions from a ZIP Blob.
 * Returns the number of successfully imported sessions.
 */
export async function importSessionsFromZip(zipBlob: Blob): Promise<number> {
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

        // Generate a new UUID for the imported session to avoid collisions
        const newSessionId = globalThis.crypto.randomUUID()

        // Strip stale `outputs` from old-format exports that may contain
        // domain-specific or blob: URLs from the source environment
        const { outputs: _importedOutputs, ...sessionData } = payload.session
        const newSession: UvrSession = {
          ...sessionData,
          sessionId: newSessionId,
          createdAt: Date.now(), // update timestamp to now
        }

        // 1. Process original file
        const origFilePrefix = `${prefix}original_`
        const origFilePath = Object.keys(unzipped).find((p) =>
          p.startsWith(origFilePrefix),
        )
        if (origFilePath !== undefined) {
          const origName = origFilePath.substring(origFilePrefix.length)
          const mimeType = newSession.originalFile?.mimeType ?? 'audio/wav'
          const origBlob = new Blob([unzipped[origFilePath]], {
            type: mimeType,
          })
          await saveStemBlob(newSessionId, 'original', origBlob, origName)
        }

        // 2. Process stems
        // To reconstruct the outputs object with new URLs
        const newOutputs: Record<string, string> = {}
        const stemPrefix = `${prefix}stem_`
        const stemPaths = Object.keys(unzipped).filter((p) =>
          p.startsWith(stemPrefix),
        )

        for (const stemPath of stemPaths) {
          // extract stem name e.g. "stem_vocal.wav" -> "vocal"
          const filename = stemPath.substring(stemPrefix.length)
          const dotIdx = filename.lastIndexOf('.')
          const stemName =
            dotIdx !== -1 ? filename.substring(0, dotIdx) : filename

          const ext = dotIdx !== -1 ? filename.substring(dotIdx + 1) : 'wav'
          const mimeType = ext === 'mp3' ? 'audio/mpeg' : 'audio/wav'
          const stemBlob = new Blob([unzipped[stemPath]], { type: mimeType })

          await saveStemBlob(
            newSessionId,
            stemName as 'vocal' | 'instrumental' | 'original',
            stemBlob,
            filename,
          )
          // Just set a placeholder; hydrateStemUrls is used to load them anyway
          // But we can generate a local blob URL for immediate use
          newOutputs[stemName] = URL.createObjectURL(stemBlob)
        }

        if (Object.keys(newOutputs).length > 0) {
          newSession.outputs = newOutputs
        }

        // 3. Process Lyrics
        if (payload.lyrics) {
          await saveLyricsToDb(newSessionId, payload.lyrics)
        }

        // 4. Save session to app-store
        importUvrSession(newSession)
        importedCount++
      } catch (err) {
        if (IS_DEV)
          console.warn(`[Import] Failed to import session at ${jsonPath}:`, err)
      }
    }

    return importedCount
  } catch (err) {
    console.error('[Import] Failed to import ZIP:', err)
    throw err
  }
}
