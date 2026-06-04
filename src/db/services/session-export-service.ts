import * as fflate from 'fflate'
import type { LyricsData } from '@/db/services/lyrics-db-service'
import { loadLyricsFromDb, saveLyricsToDb, } from '@/db/services/lyrics-db-service'
import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import { loadPitchAnalysisFromDb, savePitchAnalysisToDb, } from '@/db/services/session-pitch-analysis-service'
import { getOriginalFileBlob, getStemBlob, saveStemBlob, } from '@/db/services/uvr-service'
import { loadTranscriptionFromDb, saveTranscriptionToDb, } from '@/db/services/whisper-transcription-db-service'
import { IS_DEV } from '@/lib/defaults'
import type { WhisperSegment } from '@/lib/whisper-service'
import type { UvrSession } from '@/stores/app-store'
import { addSessionToGroup, getAllUvrSessions, getGroups, getUvrSession, importUvrSession, } from '@/stores/app-store'

// Types for the JSON payload stored inside the ZIP
interface ExportPayload {
  version: 1
  session: Omit<UvrSession, 'outputs'>
  lyrics: LyricsData | null
  transcription: WhisperSegment[] | null
  pitchAnalysis?: SessionPitchData | null
}

/** Backward-compatible import type */
interface ImportPayload {
  version: 1
  session: UvrSession
  lyrics: LyricsData | null
  transcription?: WhisperSegment[] | null
  pitchAnalysis?: SessionPitchData | null
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
    const safeName = (session.originalFile?.name ?? sessionId).replace(
      /[^a-z0-9_-]/gi,
      '_',
    )
    a.download = `MercuryPitch_Session_${safeName}.zip`
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
      const safeName = (
        session.originalFile?.name ?? session.sessionId
      ).replace(/[^a-z0-9_-]/gi, '_')
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
    a.download = `MercuryPitch_All_Sessions.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('[Export] Failed to export all sessions:', err)
    throw err
  }
}

/**
 * Export all sessions belonging to a specific group as a single ZIP file.
 */
export async function exportGroup(
  groupId: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  try {
    const groups = getGroups()
    const group = groups.find((g) => g.id === groupId)
    if (!group || group.sessionIds.length === 0) return

    const sessions = getAllUvrSessions().filter((s) =>
      group.sessionIds.includes(s.sessionId),
    )
    if (sessions.length === 0) return

    let allZippable: fflate.Zippable = {}
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]
      const safeName = (
        session.originalFile?.name ?? session.sessionId
      ).replace(/[^a-z0-9_-]/gi, '_')
      const prefix = `${safeName}_${session.sessionId.substring(0, 8)}/`

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

    const zipped = await new Promise<Uint8Array>((resolve, reject) => {
      fflate.zip(allZippable, { level: 6 }, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })

    if (onProgress) onProgress(100)

    const safeGroupName = group.name.replace(/[^a-z0-9_-]/gi, '_')
    const blob = new Blob([zipped.buffer as ArrayBuffer], {
      type: 'application/zip',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MercuryPitch_Group_${safeGroupName}.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('[Export] Failed to export group:', err)
    throw err
  }
}

/**
 * Import sessions from a ZIP Blob.
 *
 * @param zipBlob - The ZIP file to import.
 * @param targetGroupId - Optional group ID to assign all imported sessions to.
 * @returns The number of successfully imported sessions.
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

        // 4. Process Whisper Transcription
        if (payload.transcription != null && payload.transcription.length > 0) {
          await saveTranscriptionToDb(newSessionId, payload.transcription)
        }

        // 5. Process Pitch Analysis
        if (payload.pitchAnalysis != null) {
          await savePitchAnalysisToDb(newSessionId, payload.pitchAnalysis)
        }

        // 6. Save session to app-store
        importUvrSession(newSession)

        // 7. Handle group assignment
        if (targetGroupId != null) {
          // User explicitly chose a target group — use it
          await addSessionToGroup(newSessionId, targetGroupId)
        }
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
