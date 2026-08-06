import * as fflate from 'fflate'
import type { KaraokePlaylistItem, KaraokePlaylistRecord, SessionGroupRecord, } from '@/db'
import type { UvrStemType } from '@/db/entities'
import type { LyricsData } from '@/db/services/lyrics-db-service'
import { loadLyricsFromDbStrict, saveLyricsToDbStrict, } from '@/db/services/lyrics-db-service'
import type { ParsedKaraokeArchiveManifest, ParsedSessionArchivePayload, SessionArchiveEntry, } from '@/db/services/session-archive-codec'
import { parseKaraokeArchiveManifestJson, parseSessionArchivePayload, parseSessionArchivePayloadJson, readSessionArchiveEntries, SessionArchiveError, } from '@/db/services/session-archive-codec'
import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import { loadPitchAnalysisFromDbStrict, savePitchAnalysisToDbStrict, } from '@/db/services/session-pitch-analysis-service'
import { deleteImportedUvrSessionDataStrict, getOriginalFileBlobStrict, getStemBlobStrict, getStemFingerprintDataStrict, listStemTypesStrict, saveStemBlobDurable, saveStemFingerprintDataStrict, } from '@/db/services/uvr-service'
import { loadTranscriptionFromDbStrict, saveTranscriptionToDbStrict, } from '@/db/services/whisper-transcription-db-service'
import { IS_DEV } from '@/lib/defaults'
import { addStemFingerprint, removeStemFingerprint, } from '@/lib/shazam/melody-fingerprints'
import type { MelodyFingerprint } from '@/lib/shazam/types'
import type { WhisperSegment } from '@/lib/whisper-service'
import type { UvrSession } from '@/stores/app-store'
import { addSessionToGroup, createGroup, deleteGroup, getAllUvrSessions, getGroupsReactive, getUvrSession, importUvrSessionDurable, removeUvrSessionFromCache, } from '@/stores/app-store'
import { createPlaylistWithItems, deletePlaylist, getPlaylist, } from '@/stores/karaoke-playlist-store'

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

/** A ZIP entry is a path, even when it represents one uploaded file. Keep only
 * the basename and remove control/path characters so archives cannot carry a
 * traversal name supplied through imported session metadata. */
export function sanitizeArchiveEntryName(name: string): string {
  const basename = name.replace(/\\/g, '/').split('/').pop() ?? ''
  const withoutControlCharacters = [...basename]
    .map((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127 ? '_' : character
    })
    .join('')
  const safe = withoutControlCharacters
    .replace(/[/\\]/g, '_')
    .replace(/^\.+/, '_')
    .trim()
  return safe !== '' ? safe : 'audio.wav'
}

function downloadArchive(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Safari may not start consuming the object URL until a later task.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export class ArchiveExportBusyError extends Error {
  constructor() {
    super('Another archive export is already running.')
    this.name = 'ArchiveExportBusyError'
  }
}

export class NoRestorableSessionsError extends Error {
  constructor() {
    super(
      'No completed sessions with a Vocal or Instrumental stem are available to export.',
    )
    this.name = 'NoRestorableSessionsError'
  }
}

export interface SessionArchiveExportSummary {
  exportedSessions: number
  skippedSessions: number
}

let archiveDownloadInProgress = false

async function runExclusiveArchiveDownload<T>(
  operation: () => Promise<T>,
): Promise<T> {
  if (archiveDownloadInProgress) throw new ArchiveExportBusyError()
  archiveDownloadInProgress = true
  try {
    return await operation()
  } finally {
    archiveDownloadInProgress = false
  }
}

/** Stable archive order for every audio stem MercuryPitch currently stores.
 * `original` is packaged separately with its source filename, never as a stem. */
export type SessionExportStemType = Exclude<UvrStemType, 'original'>

export const SESSION_EXPORT_STEM_ORDER: readonly SessionExportStemType[] = [
  'vocal',
  'instrumental',
  'drums',
  'bass',
  'guitar',
  'piano',
  'other',
]

const SESSION_EXPORT_STEM_SET = new Set<SessionExportStemType>(
  SESSION_EXPORT_STEM_ORDER,
)

export function isSessionExportStem(
  value: string,
): value is SessionExportStemType {
  return SESSION_EXPORT_STEM_SET.has(value as SessionExportStemType)
}

/** The audio stems actually stored for this session, in a deterministic order.
 * IndexedDB is authoritative because part stems are not copied into outputs. */
export async function listSessionExportStems(
  sessionId: string,
): Promise<SessionExportStemType[]> {
  const stored = new Set(await listStemTypesStrict(sessionId))
  return SESSION_EXPORT_STEM_ORDER.filter((stem) => stored.has(stem))
}

function hasRestorableCoreStem(
  stems: ReadonlySet<SessionExportStemType> | readonly SessionExportStemType[],
): boolean {
  for (const stem of stems) {
    if (stem === 'vocal' || stem === 'instrumental') return true
  }
  return false
}

interface PreparedSessionExport {
  session: UvrSession
  stemTypes: SessionExportStemType[]
}

async function prepareRestorableBatchSessions(
  sessions: readonly UvrSession[],
): Promise<{
  ready: PreparedSessionExport[]
  skippedSessions: number
}> {
  const ready: PreparedSessionExport[] = []
  for (const session of sessions) {
    if (session.status !== 'completed') continue
    const stemTypes = await listSessionExportStems(session.sessionId)
    if (!hasRestorableCoreStem(stemTypes)) continue
    ready.push({ session, stemTypes })
  }
  return { ready, skippedSessions: sessions.length - ready.length }
}

// Types for the JSON payload stored inside the ZIP
interface ExportPayload {
  version: 1
  session: Omit<UvrSession, 'outputs'>
  lyrics: LyricsData | null
  transcription: WhisperSegment[] | null
  pitchAnalysis?: SessionPitchData | null
  fingerprint?: MelodyFingerprint | null
}

function extensionForAudioMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(';', 1)[0]
  const known: Record<string, string> = {
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/x-flac': 'flac',
    'audio/x-m4a': 'm4a',
    'audio/x-wav': 'wav',
  }
  const mapped = known[normalized]
  if (mapped !== undefined) return mapped
  const subtype = normalized.split('/')[1]?.replace(/^x-/, '') ?? ''
  return /^[a-z0-9.+-]+$/.test(subtype) ? subtype : 'audio'
}

function audioMimeForArchiveEntry(extension: string): string {
  const known: Record<string, string> = {
    aac: 'audio/aac',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    webm: 'audio/webm',
  }
  const normalized = extension.toLowerCase()
  if (known[normalized] !== undefined) return known[normalized]
  return /^[a-z0-9.+-]+$/.test(normalized) ? `audio/${normalized}` : 'audio/wav'
}

/** Karaoke manifest stored at the ZIP root (karaoke.json) for playlist exports. */
type KaraokeManifest = ParsedKaraokeArchiveManifest

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

async function archiveEntryText(entry: SessionArchiveEntry): Promise<string> {
  if (typeof entry.blob.text === 'function') return entry.blob.text()
  if (typeof entry.blob.arrayBuffer === 'function') {
    return fflate.strFromU8(new Uint8Array(await entry.blob.arrayBuffer()))
  }
  if (typeof FileReader === 'undefined')
    throw new SessionArchiveError('Archive manifest could not be read')
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () =>
      reject(reader.error ?? new Error('Archive manifest could not be read'))
    reader.readAsText(entry.blob)
  })
}

/** Stream only the small manifest entries needed to preview an import. Audio
 * is discarded at the ZIP decoder, so confirming a full-band archive never
 * materializes its stems on the JS heap. */
export async function inspectSessionZip(
  zipBlob: Blob,
): Promise<SessionZipInspection> {
  try {
    let sessionCount = 0
    let invalidSessionCount = 0
    let hasKaraokeManifest = false
    let playlistCount = 0
    let groupCount = 0
    let manifestWarning: string | undefined
    const validSessionPrefixes = new Set<string>()
    const coreStemPrefixes = new Set<string>()

    await readSessionArchiveEntries(zipBlob, {
      select: (entry) => {
        if (entry.kind === 'json') return true
        const { prefix, basename } = archivePathParts(entry.path)
        if (/^stem_(vocal|instrumental)\.[a-z0-9.+-]+$/i.test(basename)) {
          coreStemPrefixes.add(prefix)
        }
        return false
      },
      onEntry: async (entry) => {
        if (entry.path === 'karaoke.json') {
          hasKaraokeManifest = true
          try {
            const manifest = parseKaraokeArchiveManifestJson(
              await archiveEntryText(entry),
            )
            playlistCount = manifest.playlists.length
            groupCount = manifest.groups.length
          } catch {
            manifestWarning = 'Karaoke manifest is invalid'
          }
          return
        }

        try {
          parseSessionArchivePayloadJson(await archiveEntryText(entry))
          validSessionPrefixes.add(archivePathParts(entry.path).prefix)
        } catch {
          invalidSessionCount++
        }
      },
    })

    sessionCount = [...validSessionPrefixes].filter((prefix) =>
      coreStemPrefixes.has(prefix),
    ).length
    invalidSessionCount += validSessionPrefixes.size - sessionCount

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
    return {
      sessionCount,
      invalidSessionCount,
      playlistCount,
      groupCount,
      hasKaraokeManifest,
      valid: manifestWarning === undefined,
      error:
        [invalidSessionWarning, manifestWarning]
          .filter((message) => message !== undefined)
          .join(' · ') || undefined,
    }
  } catch (error) {
    return {
      sessionCount: 0,
      invalidSessionCount: 0,
      playlistCount: 0,
      groupCount: 0,
      hasKaraokeManifest: false,
      valid: false,
      error:
        error instanceof SessionArchiveError &&
        error.message !== 'Archive contains no readable entries'
          ? error.message
          : 'ZIP could not be read',
    }
  }
}

/** Incremental ZIP writer. Input audio is read and compressed one stream chunk
 * at a time, so a seven-part band export does not retain every source WAV at
 * once. Compressed output chunks remain in memory until they become the final
 * downloadable Blob. */
class StreamingZipArchive {
  private readonly chunks: ArrayBuffer[] = []
  private zip!: fflate.Zip
  private readonly result: Promise<Blob>
  private failure: Error | null = null

  constructor() {
    this.result = new Promise<Blob>((resolve, reject) => {
      this.zip = new fflate.Zip((error, chunk, final) => {
        if (error !== null) {
          this.failure = error
          reject(error)
          return
        }
        if (chunk !== null) {
          const copy = chunk.slice()
          this.chunks.push(copy.buffer as ArrayBuffer)
        }
        if (final) {
          resolve(new Blob(this.chunks, { type: 'application/zip' }))
        }
      })
    })
  }

  private entry(name: string): fflate.ZipDeflate {
    if (this.failure !== null) throw this.failure
    const entry = new fflate.ZipDeflate(name, { level: 6 })
    this.zip.add(entry)
    return entry
  }

  addBytes(name: string, bytes: Uint8Array): void {
    const entry = this.entry(name)
    entry.push(bytes, true)
    if (this.failure !== null) throw this.failure
  }

  async addBlob(name: string, blob: Blob): Promise<void> {
    const entry = this.entry(name)
    if (typeof blob.stream === 'function') {
      const reader = blob.stream().getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        entry.push(value, false)
        if (this.failure !== null) throw this.failure
      }
      entry.push(new Uint8Array(0), true)
    } else {
      // Older test/browser Blob implementations have no stream(). This keeps
      // compatibility while modern browsers take the chunked-input path.
      entry.push(new Uint8Array(await blob.arrayBuffer()), true)
    }
    if (this.failure !== null) throw this.failure
  }

  finish(): Promise<Blob> {
    this.zip.end()
    return this.result
  }
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
async function writeSessionFilesToZip(
  archive: StreamingZipArchive,
  sessionId: string,
  prefix = '',
  onProgress?: (pct: number) => void,
  selectedStemTypes?: readonly SessionExportStemType[],
): Promise<void> {
  const session = getUvrSession(sessionId)
  if (!session) throw new Error(`Session ${sessionId} not found`)

  // A missing selection means every stored audio stem, including full-band
  // parts. Explicit selections preserve their requested order and fail below
  // if a selected row disappeared after the picker was shown.
  const stemTypes =
    selectedStemTypes === undefined
      ? await listSessionExportStems(sessionId)
      : SESSION_EXPORT_STEM_ORDER.filter((stem) =>
          selectedStemTypes.includes(stem),
        )
  if (!hasRestorableCoreStem(stemTypes)) {
    throw new Error(
      'A restorable session archive requires a Vocal or Instrumental stem.',
    )
  }

  // Progress steps: lyrics(10%) -> transcription(20%) -> original(50%) -> stems(90%) -> done(100%)
  onProgress?.(5)

  // 1. Gather Lyrics
  const lyrics = await loadLyricsFromDbStrict(sessionId)
  onProgress?.(10)

  // 2. Gather Whisper Transcription
  const transcription = await loadTranscriptionFromDbStrict(sessionId)
  onProgress?.(15)

  // 3. Gather Pitch Analysis
  const pitchAnalysis = await loadPitchAnalysisFromDbStrict(sessionId)
  onProgress?.(18)

  // 4. Gather the derived melody fingerprint used by song matching.
  const fingerprint = await getStemFingerprintDataStrict(sessionId)
  onProgress?.(20)

  // 3. Prepare payload -- deliberately omit domain/blob-specific URLs and
  // transient server job handles. The latter can address short-lived remote
  // output/status routes and are not part of a portable user archive.
  const {
    outputs: _outputs,
    apiSessionId: _apiSessionId,
    splitApiSessionId: _splitApiSessionId,
    stemMeta: _stemMeta,
    ...portableSession
  } = session
  const portableStemMeta: NonNullable<UvrSession['stemMeta']> = {}
  for (const stemType of stemTypes) {
    const metadata = session.stemMeta?.[stemType]
    if (metadata !== undefined) portableStemMeta[stemType] = { ...metadata }
  }
  const portableOriginal = portableSession.originalFile
  const sessionForArchive: ExportPayload['session'] = {
    ...portableSession,
    ...(Object.keys(portableStemMeta).length > 0
      ? { stemMeta: portableStemMeta }
      : {}),
    ...(portableOriginal !== undefined
      ? {
          originalFile: {
            ...portableOriginal,
            name: sanitizeArchiveEntryName(portableOriginal.name),
          },
        }
      : {}),
  }
  const payload: ExportPayload = {
    version: 1,
    session: sessionForArchive,
    lyrics,
    transcription,
    pitchAnalysis,
    fingerprint,
  }
  // Refuse to download an archive that our own importer cannot validate.
  parseSessionArchivePayload(payload)
  archive.addBytes(
    `${prefix}session.json`,
    fflate.strToU8(JSON.stringify(payload, null, 2)),
  )

  // 4. Gather Audio Files
  // Original
  {
    const originalBlob = await getOriginalFileBlobStrict(sessionId)
    if (originalBlob) {
      const originalName = sanitizeArchiveEntryName(
        session.originalFile?.name ?? originalBlob.name,
      )
      await archive.addBlob(`${prefix}original_${originalName}`, originalBlob)
    } else if (session.originalFile !== undefined) {
      archive.addBytes(
        `${prefix}README_original_unavailable.txt`,
        fflate.strToU8(
          'The original upload was no longer stored on this device when this archive was created. The selected separated stems and session data are included.',
        ),
      )
    }
  }
  onProgress?.(50)

  // Stems are read directly from IndexedDB (domain-agnostic and reload-safe).
  for (let si = 0; si < stemTypes.length; si++) {
    const stemType = stemTypes[si]
    const blob = await getStemBlobStrict(sessionId, stemType)
    if (!blob) {
      throw new Error(
        `The selected ${stemType} stem is no longer available in local storage.`,
      )
    }
    const ext = extensionForAudioMime(blob.type)
    const filename = `stem_${stemType}.${ext}`
    await archive.addBlob(`${prefix}${filename}`, blob)
    onProgress?.(50 + ((si + 1) / Math.max(1, stemTypes.length)) * 40)
  }

  onProgress?.(95)
}

/** Build one restorable session archive without triggering a browser download.
 * Kept separate so selection and import round-trips can be verified directly. */
export async function buildSessionZip(
  sessionId: string,
  onProgress?: (pct: number) => void,
  selectedStemTypes?: readonly SessionExportStemType[],
): Promise<Blob> {
  const session = getUvrSession(sessionId)
  if (!session) throw new Error(`Session ${sessionId} not found`)

  onProgress?.(0)
  const archive = new StreamingZipArchive()
  await writeSessionFilesToZip(
    archive,
    sessionId,
    '',
    onProgress,
    selectedStemTypes,
  )
  const zipped = await archive.finish()
  onProgress?.(100)
  return zipped
}

/**
 * Export a single session as a ZIP file.
 */
async function exportSessionUnlocked(
  sessionId: string,
  onProgress?: (pct: number) => void,
  selectedStemTypes?: readonly SessionExportStemType[],
): Promise<void> {
  try {
    const session = getUvrSession(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)

    const blob = await buildSessionZip(sessionId, onProgress, selectedStemTypes)
    // safe filename
    const safeName = getSafeSessionName(session)
    const hqPrefix = session.processingMode === 'server' ? 'MC_HQ' : 'MC'
    downloadArchive(blob, `${hqPrefix}_Session_${safeName}.zip`)
  } catch (err) {
    console.error('[Export] Failed to export session:', err)
    throw err
  }
}

export function exportSession(
  sessionId: string,
  onProgress?: (pct: number) => void,
  selectedStemTypes?: readonly SessionExportStemType[],
): Promise<void> {
  return runExclusiveArchiveDownload(() =>
    exportSessionUnlocked(sessionId, onProgress, selectedStemTypes),
  )
}

/**
 * Export all sessions as a single ZIP file containing subdirectories.
 */
async function exportAllSessionsUnlocked(
  onProgress?: (progress: number) => void,
): Promise<SessionArchiveExportSummary> {
  try {
    const sessions = getAllUvrSessions()
    const { ready, skippedSessions } =
      await prepareRestorableBatchSessions(sessions)
    if (ready.length === 0) throw new NoRestorableSessionsError()

    const archive = new StreamingZipArchive()
    for (let i = 0; i < ready.length; i++) {
      const { session, stemTypes } = ready[i]
      const safeName = getSafeSessionName(session)
      const prefix = `${safeName}_${session.sessionId.substring(0, 8)}/`

      // Report sub-progress within each session (0-90% range)
      const sessionBase = (i / ready.length) * 90
      const sessionRange = 90 / ready.length
      await writeSessionFilesToZip(
        archive,
        session.sessionId,
        prefix,
        onProgress
          ? (subPct) => {
              onProgress(
                Math.floor(sessionBase + (subPct / 100) * sessionRange),
              )
            }
          : undefined,
        stemTypes,
      )
    }

    const blob = await archive.finish()

    if (onProgress) {
      onProgress(100)
    }

    downloadArchive(blob, 'MC_All_Sessions.zip')
    return { exportedSessions: ready.length, skippedSessions }
  } catch (err) {
    console.error('[Export] Failed to export all sessions:', err)
    throw err
  }
}

export function exportAllSessions(
  onProgress?: (progress: number) => void,
): Promise<SessionArchiveExportSummary> {
  return runExclusiveArchiveDownload(() =>
    exportAllSessionsUnlocked(onProgress),
  )
}

/**
 * Export all sessions belonging to a specific group as a ZIP file.
 */
async function exportGroupUnlocked(
  groupId: string,
  onProgress?: (pct: number) => void,
): Promise<SessionArchiveExportSummary> {
  try {
    const allSessions = getAllUvrSessions()
    const sessions = allSessions.filter((s) => s.groupId === groupId)
    const { ready, skippedSessions } =
      await prepareRestorableBatchSessions(sessions)
    if (ready.length === 0) throw new NoRestorableSessionsError()

    onProgress?.(0)
    const prefix = `${groupId.substring(0, 8)}/`

    const archive = new StreamingZipArchive()
    for (let i = 0; i < ready.length; i++) {
      const { session, stemTypes } = ready[i]
      const safeName = getSafeSessionName(session)
      const dirPrefix = `${prefix}${safeName}_${session.sessionId.substring(0, 8)}/`
      const sessionBase = (i / ready.length) * 90
      const sessionRange = 90 / ready.length
      await writeSessionFilesToZip(
        archive,
        session.sessionId,
        dirPrefix,
        onProgress
          ? (subPct) => onProgress(sessionBase + (subPct / 100) * sessionRange)
          : undefined,
        stemTypes,
      )
    }

    const blob = await archive.finish()

    onProgress?.(100)

    downloadArchive(blob, `MC_Group_${groupId.substring(0, 8)}.zip`)
    return { exportedSessions: ready.length, skippedSessions }
  } catch (err) {
    console.error('[Export] Failed to export group:', err)
    throw err
  }
}

export function exportGroup(
  groupId: string,
  onProgress?: (pct: number) => void,
): Promise<SessionArchiveExportSummary> {
  return runExclusiveArchiveDownload(() =>
    exportGroupUnlocked(groupId, onProgress),
  )
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
  const allSessions = getAllUvrSessions()
  const groupIds = new Set<string>()
  const sessionIds = new Set<string>()

  for (const pl of playlists) {
    for (const item of pl.items) {
      if (item.kind === 'group') {
        groupIds.add(item.refId)
        // A session's groupId is authoritative. The group's sessionIds field
        // is a denormalized index and may briefly be stale after a repaired or
        // interrupted write; trusting it here could omit a real band member or
        // export an unrelated song.
        for (const session of allSessions) {
          if (session.groupId === item.refId) sessionIds.add(session.sessionId)
        }
      } else {
        sessionIds.add(item.refId)
      }
    }
  }

  // Resolve sessions; also pull in the group each one belongs to so the
  // "band" label is restored on import.
  const sessionList = allSessions.filter((session) =>
    sessionIds.has(session.sessionId),
  )
  for (const s of sessionList) {
    if (s.groupId !== undefined) groupIds.add(s.groupId)
  }

  const groups = [...groupIds]
    .map((id) => allGroups.find((g) => g.id === id))
    .filter((g): g is SessionGroupRecord => g !== undefined)
    .map((g) => ({
      id: g.id,
      name: g.name,
      sessionIds: sessionList
        .filter((session) => session.groupId === g.id)
        .map((session) => session.sessionId),
    }))

  onProgress?.(0)
  const archive = new StreamingZipArchive()
  for (let i = 0; i < sessionList.length; i++) {
    const s = sessionList[i]
    const safeName = getSafeSessionName(s)
    const dirPrefix = `sessions/${safeName}_${s.sessionId.substring(0, 8)}/`
    const base = (i / sessionList.length) * 90
    const range = 90 / Math.max(1, sessionList.length)
    await writeSessionFilesToZip(
      archive,
      s.sessionId,
      dirPrefix,
      onProgress ? (sub) => onProgress(base + (sub / 100) * range) : undefined,
    )
  }

  const manifest: KaraokeManifest = { version: 1, playlists, groups }
  archive.addBytes(
    'karaoke.json',
    fflate.strToU8(JSON.stringify(manifest, null, 2)),
  )
  const zipped = await archive.finish()
  onProgress?.(100)

  return zipped
}

/**
 * Export one or more karaoke playlists as a downloaded ZIP (contents per
 * {@link buildKaraokePlaylistZip}).
 */
async function exportKaraokePlaylistsUnlocked(
  playlistIds: string[],
  onProgress?: (pct: number) => void,
): Promise<void> {
  try {
    const blob = await buildKaraokePlaylistZip(playlistIds, onProgress)
    if (blob === null) return

    const playlists = playlistIds
      .map((id) => getPlaylist(id))
      .filter((p): p is KaraokePlaylistRecord => p !== undefined)
    const nameSlug =
      playlists.length === 1
        ? sanitizeFilename(playlists[0].name)
        : `${playlists.length}_playlists`
    downloadArchive(blob, `MC_Karaoke_${nameSlug}.zip`)
  } catch (err) {
    console.error('[Export] Failed to export karaoke playlists:', err)
    throw err
  }
}

export function exportKaraokePlaylists(
  playlistIds: string[],
  onProgress?: (pct: number) => void,
): Promise<void> {
  return runExclusiveArchiveDownload(() =>
    exportKaraokePlaylistsUnlocked(playlistIds, onProgress),
  )
}

/**
 * Import a single session entry (one session.json + its audio files) from an
 * already-unzipped archive. Returns the original sessionId and the freshly
 * generated one so callers can remap references (e.g. karaoke playlists).
 */
async function cleanupImportedSessionData(sessionId: string): Promise<void> {
  await deleteImportedUvrSessionDataStrict(sessionId)
  // Mutate runtime state only after the transaction lands. If storage refuses
  // the rollback, keeping the imported row/index visible is more honest and
  // leaves the user a retriable delete instead of hiding orphaned data.
  removeStemFingerprint(sessionId)
  removeUvrSessionFromCache(sessionId)
}

interface StreamingSessionImport {
  prefix: string
  payload: ParsedSessionArchivePayload
  newSession: UvrSession
  seenStems: Set<SessionExportStemType>
  originalStored: boolean
  failed: boolean
}

function archivePathParts(path: string): { prefix: string; basename: string } {
  const slash = path.lastIndexOf('/')
  return slash === -1
    ? { prefix: '', basename: path }
    : {
        prefix: path.slice(0, slash + 1),
        basename: path.slice(slash + 1),
      }
}

function createStreamingSessionImport(
  prefix: string,
  payload: ParsedSessionArchivePayload,
): StreamingSessionImport {
  const sessionWithoutArchivedStemMeta = { ...payload.session }
  delete sessionWithoutArchivedStemMeta.stemMeta
  return {
    prefix,
    payload,
    newSession: {
      ...sessionWithoutArchivedStemMeta,
      sessionId: globalThis.crypto.randomUUID(),
      createdAt: Date.now(),
      groupId: undefined,
    },
    seenStems: new Set(),
    originalStored: false,
    failed: false,
  }
}

async function failStreamingSessionImport(
  context: StreamingSessionImport,
  error: unknown,
): Promise<void> {
  if (context.failed) return
  context.failed = true
  try {
    await cleanupImportedSessionData(context.newSession.sessionId)
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      `The failed import at ${context.prefix || 'archive root'} could not be completely rolled back.`,
    )
  }
  if (IS_DEV)
    console.warn(
      `[Import] Failed to restore session at ${context.prefix || 'archive root'}:`,
      error,
    )
}

async function importStreamingAudioEntry(
  entry: SessionArchiveEntry,
  contexts: Map<string, StreamingSessionImport>,
  rejectedPrefixes: ReadonlySet<string>,
): Promise<void> {
  const { prefix, basename } = archivePathParts(entry.path)
  const context = contexts.get(prefix)
  if (context === undefined) {
    if (rejectedPrefixes.has(prefix)) return
    throw new SessionArchiveError(
      `Audio entry appears before its session manifest: ${entry.path}`,
    )
  }
  if (context.failed) return

  try {
    if (basename.startsWith('original_')) {
      if (context.originalStored)
        throw new SessionArchiveError('Archive contains duplicate originals')
      const originalName = sanitizeArchiveEntryName(
        basename.slice('original_'.length),
      )
      const extension = originalName.includes('.')
        ? originalName.slice(originalName.lastIndexOf('.') + 1)
        : 'wav'
      const mimeType =
        context.newSession.originalFile?.mimeType ??
        audioMimeForArchiveEntry(extension)
      const originalBlob = new Blob([entry.blob], { type: mimeType })
      const saved = await saveStemBlobDurable(
        context.newSession.sessionId,
        'original',
        originalBlob,
        originalName,
      )
      if (!saved.ok)
        throw new Error(
          'The original audio could not be restored from the ZIP.',
        )
      context.originalStored = true
      context.newSession.originalFile = {
        name: originalName,
        size: entry.size,
        mimeType,
      }
      return
    }

    const match = /^stem_([a-z-]+)\.([a-z0-9.+-]+)$/i.exec(basename)
    if (match === null) return
    const candidateStem = match[1]
    if (!isSessionExportStem(candidateStem)) return
    const stemName = candidateStem
    if (context.seenStems.has(stemName))
      throw new SessionArchiveError(
        `Archive contains duplicate ${stemName} stems`,
      )
    const mimeType = audioMimeForArchiveEntry(match[2])
    const stemBlob = new Blob([entry.blob], { type: mimeType })
    const saved = await saveStemBlobDurable(
      context.newSession.sessionId,
      stemName,
      stemBlob,
      sanitizeArchiveEntryName(basename),
    )
    if (!saved.ok)
      throw new Error(
        `The ${stemName} stem could not be restored from the ZIP.`,
      )
    context.seenStems.add(stemName)
    const archivedMetadata = context.payload.session.stemMeta?.[stemName]
    context.newSession.stemMeta = {
      ...context.newSession.stemMeta,
      [stemName]: {
        ...(archivedMetadata?.duration !== undefined
          ? { duration: archivedMetadata.duration }
          : {}),
        size: entry.size,
      },
    }
  } catch (error) {
    await failStreamingSessionImport(context, error)
  }
}

async function finalizeStreamingSessionImport(
  context: StreamingSessionImport,
  targetGroupId?: string,
): Promise<{ oldSessionId: string; newSessionId: string } | null> {
  if (context.failed) return null

  const { payload, newSession } = context
  try {
    if (!hasRestorableCoreStem(context.seenStems)) {
      throw new Error(
        'The archive does not contain a restorable Vocal or Instrumental stem.',
      )
    }
    // Remote job handles are intentionally excluded from portable archives.
    // Once audio was restored durably, normalize away any stale queued/error
    // state so the imported session opens as a completed stored result.
    newSession.status = 'completed'
    newSession.progress = 100
    newSession.indeterminate = undefined
    newSession.phase = undefined
    newSession.error = undefined
    if (!context.originalStored && newSession.originalFile !== undefined) {
      newSession.originalFile = { ...newSession.originalFile, size: 0 }
    }
    if (payload.lyrics !== null)
      await saveLyricsToDbStrict(newSession.sessionId, payload.lyrics)
    if (payload.transcription !== null && payload.transcription.length > 0)
      await saveTranscriptionToDbStrict(
        newSession.sessionId,
        payload.transcription,
      )
    if (payload.pitchAnalysis !== null)
      await savePitchAnalysisToDbStrict(
        newSession.sessionId,
        payload.pitchAnalysis,
      )
    const restoredFingerprint =
      payload.fingerprint === null
        ? null
        : {
            ...payload.fingerprint,
            melodyId: `stem:${newSession.sessionId}`,
          }
    if (restoredFingerprint !== null) {
      await saveStemFingerprintDataStrict(
        newSession.sessionId,
        restoredFingerprint,
      )
    }

    if (!(await importUvrSessionDurable(newSession))) {
      throw new Error('The imported session record could not be saved.')
    }
    if (targetGroupId !== undefined)
      await addSessionToGroup(newSession.sessionId, targetGroupId)
    if (restoredFingerprint !== null) addStemFingerprint(restoredFingerprint)

    return {
      oldSessionId: payload.session.sessionId,
      newSessionId: newSession.sessionId,
    }
  } catch (error) {
    await failStreamingSessionImport(context, error)
    return null
  }
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
  const createdGroupIds: string[] = []
  const createdPlaylistIds: string[] = []
  let groupCount = 0
  let playlistCount = 0

  try {
    for (const g of manifest.groups) {
      const newGroup = await createGroup(g.name)
      createdGroupIds.push(newGroup.id)
      groupIdMap.set(g.id, newGroup.id)
      groupCount++
      for (const oldSid of g.sessionIds) {
        const newSid = sessionIdMap.get(oldSid)
        if (newSid !== undefined) await addSessionToGroup(newSid, newGroup.id)
      }
    }

    for (const pl of manifest.playlists) {
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
          ...(it.vocalVolume !== undefined
            ? { vocalVolume: it.vocalVolume }
            : {}),
        })
      }
      const playlist = await createPlaylistWithItems(pl.name, items, {
        shuffleOrder: pl.shuffleOrder,
        playMode: pl.playMode,
      })
      createdPlaylistIds.push(playlist.id)
      playlistCount++
    }

    return { groups: groupCount, playlists: playlistCount }
  } catch (error) {
    const rollbackErrors: unknown[] = []
    for (const playlistId of createdPlaylistIds.reverse()) {
      try {
        await deletePlaylist(playlistId)
      } catch (cleanupError) {
        rollbackErrors.push(cleanupError)
        console.error('[Import] Failed to roll back playlist:', cleanupError)
      }
    }
    for (const groupId of createdGroupIds.reverse()) {
      try {
        await deleteGroup(groupId)
      } catch (cleanupError) {
        rollbackErrors.push(cleanupError)
        console.error('[Import] Failed to roll back group:', cleanupError)
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Karaoke manifest creation failed and its records could not be completely rolled back.',
      )
    }
    throw error
  }
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
    const contexts = new Map<string, StreamingSessionImport>()
    const rejectedPrefixes = new Set<string>()
    let sawSessionManifest = false
    let sawKaraokeManifest = false
    let karaokeManifest: KaraokeManifest | null = null

    try {
      await readSessionArchiveEntries(zipBlob, {
        onEntry: async (entry) => {
          if (entry.kind === 'audio') {
            await importStreamingAudioEntry(entry, contexts, rejectedPrefixes)
            return
          }
          if (entry.path === 'karaoke.json') {
            if (sawKaraokeManifest)
              throw new SessionArchiveError(
                'Archive contains duplicate karaoke manifests',
              )
            sawKaraokeManifest = true
            try {
              karaokeManifest = parseKaraokeArchiveManifestJson(
                await archiveEntryText(entry),
              )
            } catch {
              throw new SessionArchiveError('Karaoke manifest is invalid')
            }
            return
          }

          sawSessionManifest = true
          const { prefix } = archivePathParts(entry.path)
          if (contexts.has(prefix)) {
            await failStreamingSessionImport(
              contexts.get(prefix)!,
              new SessionArchiveError(
                'Archive contains duplicate session manifests',
              ),
            )
            return
          }
          try {
            const payload = parseSessionArchivePayloadJson(
              await archiveEntryText(entry),
            )
            contexts.set(prefix, createStreamingSessionImport(prefix, payload))
          } catch (error) {
            rejectedPrefixes.add(prefix)
            if (IS_DEV)
              console.warn(
                `[Import] Invalid session manifest at ${entry.path}:`,
                error,
              )
          }
        },
      })
    } catch (error) {
      for (const context of contexts.values())
        await failStreamingSessionImport(context, error)
      throw error
    }

    if (!sawSessionManifest) throw new Error('No session.json found in ZIP')

    // A karaoke archive owns grouping through its validated manifest. An
    // invalid manifest never causes the caller's unrelated target group to be
    // applied implicitly.
    const perSessionGroupId = sawKaraokeManifest ? undefined : targetGroupId
    const sessionIdMap = new Map<string, string>()
    let importedCount = 0
    for (const context of contexts.values()) {
      if (sessionIdMap.has(context.payload.session.sessionId)) {
        await failStreamingSessionImport(
          context,
          new SessionArchiveError('Archive contains duplicate session ids'),
        )
        continue
      }
      const imported = await finalizeStreamingSessionImport(
        context,
        perSessionGroupId,
      )
      if (imported !== null) {
        const { oldSessionId, newSessionId } = imported
        sessionIdMap.set(oldSessionId, newSessionId)
        importedCount++
      }
    }

    // Recreate karaoke groups + playlists if present
    if (karaokeManifest !== null) {
      try {
        const { groups, playlists } = await importKaraokeManifest(
          karaokeManifest,
          sessionIdMap,
        )
        if (IS_DEV)
          console.info(
            `[Import] Restored ${playlists} karaoke playlist(s), ${groups} group(s)`,
          )
      } catch (err) {
        console.error('[Import] Failed to restore karaoke manifest:', err)
        const cleanupErrors: unknown[] = []
        for (const sessionId of sessionIdMap.values()) {
          try {
            await cleanupImportedSessionData(sessionId)
          } catch (cleanupError) {
            cleanupErrors.push(cleanupError)
          }
        }
        if (cleanupErrors.length > 0) {
          throw new AggregateError(
            [err, ...cleanupErrors],
            'Karaoke manifest restoration failed and imported sessions could not be completely rolled back.',
          )
        }
        throw new SessionArchiveError(
          'Karaoke playlists and groups could not be restored',
        )
      }
    }

    return importedCount
  } catch (err) {
    console.error('[Import] Failed to import ZIP:', err)
    throw err
  }
}
