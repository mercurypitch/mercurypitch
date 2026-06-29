import { createSignal } from 'solid-js'
import type { FeatureFlag, SessionGroupRecord, UvrSessionRecord } from '@/db'
import { getDb } from '@/db'
import { getUserId } from '@/db/seed'
import { deleteAllLyricsFromDb, deleteLyricsFromDb, } from '@/db/services/lyrics-db-service'
import { deleteAllUvrSessionsFromDb } from '@/db/services/uvr-service'
import { deleteAllTranscriptionsFromDb } from '@/db/services/whisper-transcription-db-service'
import { TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMMUNITY, TAB_COMPOSE, TAB_EXERCISES, TAB_GUITAR, TAB_JAM, TAB_KARAOKE, TAB_LEADERBOARD, TAB_PIANO, TAB_SETTINGS, TAB_SINGING, } from '@/features/tabs/constants'
import type { InstrumentType } from '@/lib/audio-engine'
import { AudioEngine } from '@/lib/audio-engine'
import { getUvrApiBase, IS_DEV } from '@/lib/defaults'
import { getCompletedCount, getRemainingWalkthroughs, } from '@/stores/walkthrough-store'
import type { ActiveTab } from './ui-store'

// ── Key / Scale / Presets ──────────────────────────────────

export const [keyName, setKeyName] = createSignal<string>('C')
export const [scaleType, setScaleType] = createSignal<string>('major')
export const [instrument, setInstrument] = createSignal<InstrumentType>('sine')

export type { InstrumentType } from '@/lib/audio-engine'

// ── UVR (Vocal Separation) ─────────────────────────────────────

export type UvrMode = 'separate' | 'instrumental' | 'vocal' | 'duo'

export type UvrProcessingMode = 'server' | 'local'

export interface UvrSettings {
  mode: UvrMode
  vocalIntensity: number // 0-100%
  instrumentalIntensity: number // 0-100%
  smoothing: number // 0-1
}

const DEFAULT_UVR_SETTINGS: UvrSettings = {
  mode: 'separate',
  vocalIntensity: 70,
  instrumentalIntensity: 70,
  smoothing: 0.3,
}

export function getUvrSettings(): UvrSettings {
  const saved = localStorage.getItem('pitchperfect_uvr-settings')
  if (saved !== null) {
    try {
      return { ...DEFAULT_UVR_SETTINGS, ...JSON.parse(saved) }
    } catch {
      // Return defaults on parse error
    }
  }
  return DEFAULT_UVR_SETTINGS
}

export function setUvrSettings(settings: Partial<UvrSettings>): void {
  const current = getUvrSettings()
  const newSettings: UvrSettings = {
    ...current,
    ...settings,
  }
  localStorage.setItem('pitchperfect_uvr-settings', JSON.stringify(newSettings))
}

export const [uvrMode, setUvrMode] = createSignal<UvrMode>('separate')
export const [uvrVocalIntensity, _setUvrVocalIntensity] = createSignal(70)
export const [uvrInstrumentalIntensity, _setUvrInstrumentalIntensity] =
  createSignal(70)
export const [uvrSmoothing, _setUvrSmoothing] = createSignal(0.3)

// Processing mode (server vs local/browser)
const DEFAULT_PROCESSING_MODE: UvrProcessingMode = 'local'

export function getUvrProcessingMode(): UvrProcessingMode {
  const saved = localStorage.getItem('pitchperfect_uvr-processing-mode')
  if (saved === 'local') return 'local'
  return DEFAULT_PROCESSING_MODE
}

export function setUvrProcessingMode(mode: UvrProcessingMode): void {
  localStorage.setItem('pitchperfect_uvr-processing-mode', mode)
  _setUvrProcessingMode(mode)
}

export const [uvrProcessingMode, _setUvrProcessingMode] =
  createSignal<UvrProcessingMode>(getUvrProcessingMode())

// Force WebGPU override for local (browser) processing mode
function getDefaultUvrWebGpu(): boolean {
  if (typeof navigator === 'undefined') return true
  const isLinuxFirefox =
    /Firefox/i.test(navigator.userAgent) &&
    /Linux/i.test(navigator.platform || navigator.userAgent)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uaData = (navigator as any).userAgentData
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) ||
    uaData?.mobile === true
  return !(isLinuxFirefox || isMobile)
}

export function getUvrForceWebGpu(): boolean {
  const stored = localStorage.getItem('pitchperfect_uvr-force-webgpu')
  if (stored !== null) return stored === 'true'
  return getDefaultUvrWebGpu()
}

export function setUvrForceWebGpu(force: boolean): void {
  localStorage.setItem(
    'pitchperfect_uvr-force-webgpu',
    force ? 'true' : 'false',
  )
  _setUvrForceWebGpu(force)
}

export const [uvrForceWebGpu, _setUvrForceWebGpu] =
  createSignal<boolean>(getUvrForceWebGpu())

// UVR Model status (persists across tab navigation)
export type UvrModelStatus = 'unloaded' | 'loading' | 'ready' | 'error'
export const [uvrModelStatus, setUvrModelStatus] =
  createSignal<UvrModelStatus>('unloaded')
export const [uvrModelError, setUvrModelError] = createSignal('')

// Export for direct usage in components (internal setters that also persist)
export const setUvrVocalIntensity = (intensity: number): void => {
  _setUvrVocalIntensity(intensity)
  setUvrSettings({ vocalIntensity: intensity })
}

export const setUvrInstrumentalIntensity = (intensity: number): void => {
  _setUvrInstrumentalIntensity(intensity)
  setUvrSettings({ instrumentalIntensity: intensity })
}

export const setUvrSmoothing = (value: number): void => {
  _setUvrSmoothing(value)
  setUvrSettings({ smoothing: value })
}

// Getters for UVR settings
export const getUvrMode = (): UvrMode => uvrMode()
export const getUvrVocalIntensity = (): number => uvrVocalIntensity()
export const getUvrInstrumentalIntensity = (): number =>
  uvrInstrumentalIntensity()
export const getUvrSmoothing = (): number => uvrSmoothing()

// ── UVR Session Management (Full Workflow) ─────────────────────────

/** UVR processing status */
export type UvrStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'error'
  | 'cancelled'

/** UVR session interface */
export interface UvrSession {
  sessionId: string
  apiSessionId?: string
  status: UvrStatus
  progress: number
  indeterminate?: boolean
  processingTime?: number
  error?: string
  fileHash?: string
  originalFile?: {
    name: string
    size: number
    mimeType: string
  }
  outputs?: {
    vocal?: string
    instrumental?: string
    vocalMidi?: string
    instrumentalMidi?: string
  }
  stemMeta?: Record<string, { duration?: number; size?: number }>
  processingMode?: UvrProcessingMode
  provider?: string
  numChunks?: number
  createdAt: number
  groupId?: string
}

/** Current UVR session state */
export const [currentUvrSession, setCurrentUvrSession] =
  createSignal<UvrSession | null>(null)

// ── In-memory signal cache (source of truth for synchronous reads) ──

const [_sessionsCache, _setSessionsCache] = createSignal<UvrSession[]>([])

/** Reactive version counter -- bumped on every session mutation */
const [sessionsVersion, setSessionsVersion] = createSignal(0)

function bumpSessions() {
  setSessionsVersion((v) => v + 1)
}

// ── Group state ─────────────────────────────────────────────────────

const [_groupsCache, _setGroupsCache] = createSignal<SessionGroupRecord[]>([])

const [groupsVersion, setGroupsVersion] = createSignal(0)

function bumpGroups() {
  setGroupsVersion((v) => v + 1)
}

/** Create a new session group. Returns the persisted record (async -- DB generates the ID). */
export async function createGroup(name: string): Promise<SessionGroupRecord> {
  const db = await getDb()
  const repo = db.getRepository<SessionGroupRecord>('sessionGroups')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group = await repo.create({ name, sessionIds: [] } as any)
  _setGroupsCache((prev) => [...prev, group])
  bumpGroups()
  return group
}

/** Delete a group. Sessions that belonged to it become ungrouped. */
export async function deleteGroup(groupId: string): Promise<void> {
  const db = await getDb()
  const repo = db.getRepository<SessionGroupRecord>('sessionGroups')
  await repo.delete(groupId)

  // Clear groupId from sessions that belonged to this group
  const cache = _groupsCache()
  const group = cache.find((g) => g.id === groupId)
  if (group) {
    for (const sid of group.sessionIds) {
      const session = getUvrSession(sid)
      if (session) {
        upsertSessionInCache({ ...session, groupId: undefined })
      }
    }
  }

  _setGroupsCache((prev) => prev.filter((g) => g.id !== groupId))
  bumpGroups()
}

/** Delete a group and all sessions within it. */
export async function deleteGroupWithSessions(groupId: string): Promise<void> {
  const cache = _groupsCache()
  const group = cache.find((g) => g.id === groupId)
  const sessionIds = group?.sessionIds ?? []

  // Delete each session in the group
  for (const sid of sessionIds) {
    deleteUvrSession(sid)
  }

  // Delete the group itself
  const db = await getDb()
  const repo = db.getRepository<SessionGroupRecord>('sessionGroups')
  await repo.delete(groupId)

  _setGroupsCache((prev) => prev.filter((g) => g.id !== groupId))
  bumpGroups()
}

/** Rename a group. */
export async function renameGroup(
  groupId: string,
  name: string,
): Promise<void> {
  const db = await getDb()
  const repo = db.getRepository<SessionGroupRecord>('sessionGroups')
  const updated = await repo.update(groupId, {
    name,
  } as Partial<SessionGroupRecord>)
  _setGroupsCache((prev) => prev.map((g) => (g.id === groupId ? updated : g)))
  bumpGroups()
}

/** Add a session to a group. Updates both the group and the session's groupId. */
export async function addSessionToGroup(
  sessionId: string,
  groupId: string,
): Promise<void> {
  const db = await getDb()
  const repo = db.getRepository<SessionGroupRecord>('sessionGroups')
  const group = await repo.findById(groupId)
  if (!group || group.sessionIds.includes(sessionId)) return

  const updated = await repo.update(groupId, {
    sessionIds: [...group.sessionIds, sessionId],
  } as Partial<SessionGroupRecord>)
  _setGroupsCache((prev) => prev.map((g) => (g.id === groupId ? updated : g)))
  bumpGroups()

  const session = getUvrSession(sessionId)
  if (session) {
    upsertSessionInCache({ ...session, groupId })
  }
}

/** Remove a session from whichever group it belongs to. */
export function removeSessionFromGroup(sessionId: string): void {
  const groups = _groupsCache()
  let changed = false
  const updated = groups.map((g) => {
    if (g.sessionIds.includes(sessionId)) {
      changed = true
      return {
        ...g,
        sessionIds: g.sessionIds.filter((id) => id !== sessionId),
        updatedAt: new Date().toISOString(),
      }
    }
    return g
  })
  if (!changed) return

  _setGroupsCache(updated)
  bumpGroups()

  // Fire-and-forget persist each changed group
  void (async () => {
    const db = await getDb()
    const repo = db.getRepository<SessionGroupRecord>('sessionGroups')
    for (const g of updated) {
      if (groups.find((og) => og.id === g.id)?.sessionIds !== g.sessionIds) {
        await repo.update(g.id, {
          sessionIds: g.sessionIds,
        } as Partial<SessionGroupRecord>)
      }
    }
  })()

  const session = getUvrSession(sessionId)
  if (session?.groupId != null) {
    upsertSessionInCache({ ...session, groupId: undefined })
  }
}

/** Get all groups (non-reactive). */
export function getGroups(): SessionGroupRecord[] {
  return _groupsCache()
}

/** Get all groups reactively (tracks groupsVersion). */
export function getGroupsReactive(): SessionGroupRecord[] {
  groupsVersion()
  return _groupsCache()
}

let _groupStoreReady = false

/** Load groups from IndexedDB into the in-memory cache. Call once at startup. */
export async function initGroupStore(): Promise<void> {
  if (_groupStoreReady) return
  try {
    const db = await getDb()
    const repo = db.getRepository<SessionGroupRecord>('sessionGroups')
    const all = await repo.findAll({})
    _setGroupsCache(all)
  } catch (err) {
    if (IS_DEV) console.warn('[SessionStore] initGroupStore failed:', err)
    _setGroupsCache([])
  }
  _groupStoreReady = true
}

// ── DB helpers ──────────────────────────────────────────────────────

/** Convert a UvrSession (in-memory) to a DB record shape for persistence. */
function sessionToDbRecord(
  session: UvrSession,
): Omit<UvrSessionRecord, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    appSessionId: session.sessionId,
    userId: getUserId(),
    status: session.status,
    progress: session.progress,
    indeterminate: session.indeterminate,
    fileHash: session.fileHash,
    originalFileName: session.originalFile?.name ?? '',
    originalFileSize: session.originalFile?.size ?? 0,
    originalFileType: session.originalFile?.mimeType ?? '',
    processingMode: session.processingMode ?? 'local',
    provider: session.provider,
    numChunks: session.numChunks,
    processingTime: session.processingTime,
    error: session.error,
    stemMetaJson:
      session.stemMeta !== undefined
        ? JSON.stringify(session.stemMeta)
        : undefined,
    appCreatedAt: session.createdAt,
    groupId: session.groupId,
  }
}

/** Convert a DB record back to a UvrSession (in-memory). */
function dbRecordToSession(rec: UvrSessionRecord): UvrSession {
  let stemMeta: UvrSession['stemMeta']
  if (rec.stemMetaJson !== undefined) {
    try {
      stemMeta = JSON.parse(rec.stemMetaJson)
    } catch (err) {
      if (IS_DEV) console.warn('[SessionStore] corrupt stemMetaJson:', err)
    }
  }
  return {
    sessionId: rec.appSessionId,
    status: rec.status as UvrStatus,
    progress: rec.progress,
    indeterminate: rec.indeterminate,
    fileHash: rec.fileHash,
    originalFile: {
      name: rec.originalFileName,
      size: rec.originalFileSize,
      mimeType: rec.originalFileType,
    },
    stemMeta,
    processingMode: (rec.processingMode as UvrProcessingMode) ?? 'local',
    provider: rec.provider,
    numChunks: rec.numChunks,
    processingTime: rec.processingTime,
    error: rec.error,
    createdAt: rec.appCreatedAt ?? Date.parse(rec.createdAt),
    groupId: rec.groupId,
  }
}

function persistSessionToDb(session: UvrSession): void {
  void (async () => {
    try {
      const db = await getDb()
      const repo = db.getRepository<UvrSessionRecord>('uvrSessions')

      // Upsert: find existing by appSessionId
      const existing = await repo.findAll({
        where: { appSessionId: session.sessionId } as Record<string, unknown>,
        limit: 1,
      })
      if (existing.length > 0) {
        await repo.update(existing[0].id, sessionToDbRecord(session))
      } else {
        await repo.create(sessionToDbRecord(session))
      }
    } catch (err) {
      if (IS_DEV) console.warn('[SessionStore] persistSessionToDb failed:', err)
    }
  })()
}

/** Persist the entire sessions list to DB (replaces all). */
function persistAllSessionsToDb(sessions: UvrSession[]): void {
  void (async () => {
    try {
      const db = await getDb()
      const repo = db.getRepository<UvrSessionRecord>('uvrSessions')

      // Get all existing records
      const existing = await repo.findAll({})
      const existingByAppId = new Map<string, UvrSessionRecord[]>()

      for (const rec of existing) {
        const arr = existingByAppId.get(rec.appSessionId) || []
        arr.push(rec)
        existingByAppId.set(rec.appSessionId, arr)
      }

      const activeIds = new Set(sessions.map((s) => s.sessionId))

      // Delete records not in the new list
      for (const rec of existing) {
        if (!activeIds.has(rec.appSessionId)) {
          await repo.delete(rec.id)
        }
      }

      // Upsert each session
      for (const session of sessions) {
        const recs = existingByAppId.get(session.sessionId)
        if (recs && recs.length > 0) {
          // Update the first one
          await repo.update(recs[0].id, sessionToDbRecord(session))
          // Delete any duplicates
          for (let i = 1; i < recs.length; i++) {
            await repo.delete(recs[i].id)
          }
        } else {
          await repo.create(sessionToDbRecord(session))
        }
      }
    } catch (err) {
      if (IS_DEV)
        console.warn('[SessionStore] persistAllSessionsToDb failed:', err)
    }
  })()
}

// ── Update the cache + persist ──────────────────────────────────────

function updateCacheAndPersist(sessions: UvrSession[]): void {
  _setSessionsCache(sessions)
  bumpSessions()
  persistAllSessionsToDb(sessions)
}

function upsertSessionInCache(session: UvrSession): void {
  _setSessionsCache((prev) => {
    const idx = prev.findIndex((s) => s.sessionId === session.sessionId)
    if (idx >= 0) {
      const next = [...prev]
      next[idx] = session
      return next
    }
    return [...prev, session]
  })
  bumpSessions()
  persistSessionToDb(session)
}

const [sessionStoreReady, setSessionStoreReady] = createSignal(false)
export const isSessionStoreReady = sessionStoreReady

// ── Initialization (must be called at app boot) ─────────────────────

let _sessionStoreReady = false

/**
 * Initialize the session store: load from IndexedDB and populate the
 * in-memory cache.
 *
 * Must be called once at app startup (e.g. in the root component or
 * before any UVR panel renders).
 */
export async function initSessionStore(): Promise<void> {
  if (_sessionStoreReady) return

  try {
    const db = await getDb()
    const repo = db.getRepository<UvrSessionRecord>('uvrSessions')

    // Load all sessions from DB into cache
    const allRecords = await repo.findAll({})

    // Deduplicate records by appSessionId (keep latest by id if duplicates exist)
    const dedupedMap = new Map<string, UvrSessionRecord>()
    for (const rec of allRecords) {
      const existing = dedupedMap.get(rec.appSessionId)
      if (!existing || rec.id > existing.id) {
        dedupedMap.set(rec.appSessionId, rec)
      }
    }

    const sessions = Array.from(dedupedMap.values()).map(dbRecordToSession)
    _setSessionsCache(sessions)
  } catch (err) {
    if (IS_DEV) console.warn('[SessionStore] initSessionStore failed:', err)
    _setSessionsCache([])
  }

  _sessionStoreReady = true
  setSessionStoreReady(true)

  // Run stale-session cleanup on the loaded cache
  cleanupStaleUvrSessions()
}

// ── Public API (synchronous reads, fire-and-forget DB writes) ──────

/** Get all sessions (reactive -- reads sessionsVersion to track dependency) */
export function getAllUvrSessionsReactive(): UvrSession[] {
  sessionsVersion() // track signal dependency
  return getAllUvrSessions()
}

/** Get session by ID */
export function getUvrSession(sessionId: string): UvrSession | undefined {
  const sessions = getAllUvrSessions()
  return sessions.find((s) => s.sessionId === sessionId)
}

/** Find a completed session by file hash */
export function getUvrSessionByHash(fileHash: string): UvrSession | undefined {
  const sessions = getAllUvrSessions()
  return sessions.find(
    (s) => s.fileHash === fileHash && s.status === 'completed',
  )
}

/** Get all sessions (synchronous read from in-memory cache) */
export function getAllUvrSessions(): UvrSession[] {
  return _sessionsCache()
}

/** Save all sessions (replaces the entire list) */
export function saveAllUvrSessions(sessions: UvrSession[]): void {
  updateCacheAndPersist(sessions)
}

/** Start a new UVR session */
export function startUvrSession(
  fileName: string,
  fileSize: number,
  mimeType: string,
  _mode: UvrMode = 'separate',
  processingMode?: UvrProcessingMode,
  fileHash?: string,
): string {
  const sessionId = `uvr-session-${Date.now()}`
  const now = Date.now()

  const newSession: UvrSession = {
    sessionId,
    status: 'idle',
    progress: 0,
    fileHash,
    originalFile: { name: fileName, size: fileSize, mimeType },
    processingMode: processingMode ?? getUvrProcessingMode(),
    createdAt: now,
  }

  upsertSessionInCache(newSession)
  setCurrentUvrSession(newSession)
  return sessionId
}

/** Update UVR session progress */
export function updateUvrSessionProgress(
  sessionId: string,
  progress: number,
  processingTime?: number,
  indeterminate?: boolean,
): void {
  const session = getUvrSession(sessionId)
  if (session) {
    const updated: UvrSession = {
      ...session,
      progress,
      indeterminate: indeterminate ?? false,
      processingTime:
        processingTime !== undefined ? processingTime : session.processingTime,
    }
    upsertSessionInCache(updated)
    setCurrentUvrSession(updated)
  }
}

/** Set the API session ID on a local session */
export function setUvrSessionApiId(
  sessionId: string,
  apiSessionId: string,
): void {
  const session = getUvrSession(sessionId)
  if (session) {
    const updated = { ...session, apiSessionId }
    upsertSessionInCache(updated)
    setCurrentUvrSession(updated)
  }
}

/** Set the provider (WebGPU/WASM) on a local session */
export function setUvrSessionProvider(
  sessionId: string,
  provider: string,
): void {
  const session = getUvrSession(sessionId)
  if (session) {
    const updated = { ...session, provider }
    upsertSessionInCache(updated)
    setCurrentUvrSession(updated)
  }
}

/** Complete UVR session with results */
export function completeUvrSession(
  sessionId: string,
  outputs: UvrSession['outputs'],
  stemMeta?: UvrSession['stemMeta'],
): void {
  const session = getUvrSession(sessionId)
  if (session) {
    const updated: UvrSession = {
      ...session,
      status: 'completed',
      outputs,
      stemMeta,
      progress: 100,
      processingTime: Date.now() - session.createdAt,
    }
    upsertSessionInCache(updated)
    setCurrentUvrSession(updated)
  }
}

/** Set UVR session error */
export function setErrorUvrSession(sessionId: string, error: string): void {
  const session = getUvrSession(sessionId)
  if (session) {
    const updated: UvrSession = { ...session, status: 'error', error }
    upsertSessionInCache(updated)
    setCurrentUvrSession(updated)
  }
}

/** Cancel UVR session */
export function cancelUvrSession(sessionId: string): void {
  const session = getUvrSession(sessionId)
  if (session) {
    const updated: UvrSession = { ...session, status: 'cancelled' }
    upsertSessionInCache(updated)
    setCurrentUvrSession(updated)
  }
}

/** Reset a failed/cancelled session for retry */
export function retryUvrSession(sessionId: string): void {
  const session = getUvrSession(sessionId)
  if (!session) return
  const updated: UvrSession = {
    ...session,
    status: 'processing',
    progress: 0,
    error: undefined,
    processingTime: 0,
    indeterminate: true,
    apiSessionId: undefined,
  }
  upsertSessionInCache(updated)
  setCurrentUvrSession(updated)
}

/** Delete UVR session */
export function deleteUvrSession(sessionId: string): void {
  const sessions = getAllUvrSessions().filter((s) => s.sessionId !== sessionId)
  updateCacheAndPersist(sessions)
  // Clean up associated lyrics from DB
  void deleteLyricsFromDb(sessionId)
  // Remove from any group
  removeSessionFromGroup(sessionId)
  if (currentUvrSession()?.sessionId === sessionId) {
    setCurrentUvrSession(null)
  }
}

/**
 * Delete all UVR sessions and their dependent data (cache + DB).
 *
 * Removes the session records AND everything keyed off them — stem audio
 * blobs, stem fingerprints, lyrics, and whisper transcriptions — so no
 * orphaned rows are left behind in IndexedDB. Session *groups* are kept but
 * emptied (use deleteAllSessionGroups to remove the groups themselves).
 */
export function deleteAllUvrSessions(): void {
  _setSessionsCache([])
  bumpSessions()
  setCurrentUvrSession(null)
  // Empty every group in the cache (the records stay; their members are gone).
  const clearedGroups = _groupsCache().map((g) => ({
    ...g,
    sessionIds: [] as string[],
  }))
  _setGroupsCache(clearedGroups)
  bumpGroups()
  // Fire-and-forget: wipe all session-scoped data from IndexedDB.
  // deleteAllUvrSessionsFromDb also empties each group's sessionIds in the DB.
  void (async () => {
    await deleteAllUvrSessionsFromDb()
    await deleteAllLyricsFromDb()
    await deleteAllTranscriptionsFromDb()
  })()
}

/** Delete every session group itself (cache + DB). Used by the karaoke reset. */
export async function deleteAllSessionGroups(): Promise<void> {
  const groups = _groupsCache()
  _setGroupsCache([])
  bumpGroups()
  try {
    const db = await getDb()
    const repo = db.getRepository<SessionGroupRecord>('sessionGroups')
    for (const g of groups) {
      await repo.delete(g.id)
    }
  } catch (err) {
    if (IS_DEV)
      console.warn('[SessionStore] deleteAllSessionGroups failed:', err)
  }
}

/** Get UVR session stats */
export function getUvrSessionStats(): {
  totalSessions: number
  completedSessions: number
  failedSessions: number
  totalProcessingTime: number
} {
  const sessions = getAllUvrSessions()
  return {
    totalSessions: sessions.length,
    completedSessions: sessions.filter((s) => s.status === 'completed').length,
    failedSessions: sessions.filter((s) => s.status === 'error').length,
    totalProcessingTime: sessions
      .filter((s) => s.processingTime !== undefined)
      .reduce((sum, s) => sum + (s.processingTime ?? 0), 0),
  }
}

// Auto-cleanup stale sessions
export function cleanupStaleUvrSessions(): void {
  if (typeof window === 'undefined') return
  const sessions = getAllUvrSessions()
  let changed = false
  const updated = sessions.map((session) => {
    if (session.status === 'processing' || session.status === 'uploading') {
      changed = true
      return {
        ...session,
        status: 'error' as UvrStatus,
        error: 'Session interrupted by page reload or closure.',
      }
    }
    return session
  })
  if (changed) {
    updateCacheAndPersist(updated)
  }
}

// Note: cleanupStaleUvrSessions() is now called inside initSessionStore()
// after the cache is loaded from DB. It is NOT run at module load anymore.
/** Import an existing session (e.g. from ZIP) */
export function importUvrSession(session: UvrSession): void {
  const currentSessions = getAllUvrSessions()
  // Ensure we don't accidentally duplicate
  const exists = currentSessions.some((s) => s.sessionId === session.sessionId)
  if (!exists) {
    updateCacheAndPersist([session, ...currentSessions])
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const sessions = getAllUvrSessions()
    const API_BASE = getUvrApiBase()

    for (const session of sessions) {
      if (
        (session.status === 'processing' || session.status === 'uploading') &&
        session.apiSessionId !== undefined &&
        session.apiSessionId !== ''
      ) {
        fetch(`${API_BASE}/session/${session.apiSessionId}`, {
          method: 'DELETE',
          keepalive: true,
        }).catch(() => {})
      }
    }
  })
}

/** Refresh session output files from API data */
export function updateUvrSessionOutputs(
  sessionId: string,
  files: { stem: string; path: string; duration?: number; size?: number }[],
): void {
  const session = getUvrSession(sessionId)
  if (!session) return

  const outputs: UvrSession['outputs'] = {
    vocal: session.outputs?.vocal ?? '',
    instrumental: session.outputs?.instrumental ?? '',
    vocalMidi: session.outputs?.vocalMidi ?? '',
  }
  const meta: Record<string, { duration?: number; size?: number }> = {}

  for (const f of files) {
    if (f.stem === 'vocal') {
      outputs.vocal = f.path
      meta.vocal = { duration: f.duration, size: f.size }
    } else if (f.stem === 'instrumental') {
      outputs.instrumental = f.path
      meta.instrumental = { duration: f.duration, size: f.size }
    }
  }

  const updated: UvrSession = { ...session, outputs, stemMeta: meta }
  upsertSessionInCache(updated)
  if (currentUvrSession()?.sessionId === sessionId) {
    setCurrentUvrSession(updated)
  }
}

// ── Audio Engine (single instance) ─────────────────────────────

let _audioEngineInstance: AudioEngine | null = null

export async function initAudioEngine(): Promise<AudioEngine> {
  if (_audioEngineInstance != null) {
    return _audioEngineInstance
  }

  _audioEngineInstance = new AudioEngine()
  return _audioEngineInstance
}

/** Apply current UVR settings to the audio engine */
export async function applyUvrSettings(): Promise<void> {
  const engine = _audioEngineInstance
  if (!engine) return

  const mode = getUvrMode()
  const vocalIntensity = getUvrVocalIntensity()
  const instrumentalIntensity = getUvrInstrumentalIntensity()
  const smoothing = getUvrSmoothing()

  engine.setUvrSettings({
    mode,
    vocalIntensity,
    instrumentalIntensity,
    smoothing,
  })

  // Enable UVR processing
  engine.enableUvr()
}

// ── Walkthrough Tutorial (GH #140, GH #199) ────────────────────
export interface WalkthroughStep {
  title: string
  targetSelector: string
  description: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Section this step belongs to (for grouping/skipping) */
  section?: string
  /** If set, switch to this tab before showing the step */
  requiredTab?: ActiveTab
  /**
   * Selectors to click, in order, to reveal the target before highlighting it —
   * e.g. switch a sub-tab, open a sub-view, expand a panel, open a dropdown.
   * Each is polled until present, clicked, then the next runs. Lets a single
   * tour walk through nested UI to reach any element seamlessly.
   */
  navigate?: string[]
  /**
   * Ensure the (mobile, off-canvas) sidebar drawer is open for this step, so
   * sidebar-anchored targets are on-screen. No-op on desktop.
   */
  inSidebar?: boolean
}
export interface WalkthroughSection {
  id: string
  title: string
  description: string
}

/** Check if there are remaining walkthroughs (not yet completed) */
export function hasRemainingWalkthroughs(): boolean {
  const remaining = getRemainingWalkthroughs()
  return remaining.length > 0
}

/** Check how many walkthroughs are completed */
export function getCompletedWalkthroughCount(): number {
  return getCompletedCount()
}

export const GUIDE_SECTIONS: WalkthroughSection[] = [
  {
    id: 'practice',
    title: 'Singing',
    description: 'Mic, playback controls, pitch display, and scoring',
  },
  {
    id: 'toolbar',
    title: 'Toolbar',
    description: 'BPM, volume, play modes, and more',
  },
  {
    id: 'editor',
    title: 'Compose',
    description: 'Build and edit melodies note by note',
  },
  {
    id: 'effects',
    title: 'Effects & Slides',
    description: 'Create slides, vibrato, and note transitions',
  },
  {
    id: 'settings',
    title: 'Settings Tab',
    description: 'Pitch detection, accuracy bands, and theme',
  },
]

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  // ── Practice Section ──
  {
    title: 'Welcome to MercuryPitch',
    targetSelector: '#app-title',
    description:
      "MercuryPitch helps you practice and improve your musical pitch. Let's take a quick tour of the main features!",
    placement: 'bottom',
    section: 'practice',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Choose your character!',
    targetSelector: '#character-icons',
    description:
      'Connect with your inner singer by choosing what suites you best!',
    placement: 'right',
    section: 'practice',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Scale & Key',
    targetSelector: '[data-tour="singing.key-scale"]',
    description:
      'Choose your musical key and scale type here. The piano roll updates to match your selection automatically.',
    placement: 'right',
    section: 'practice',
    requiredTab: TAB_SINGING,
    inSidebar: true,
  },
  {
    title: 'Load a Melody',
    targetSelector: '[data-tour="singing.library"]',
    description:
      'Load a preset melody from the library, import a MIDI file, or record your own. Presets give you a great head start.',
    placement: 'right',
    section: 'practice',
    requiredTab: TAB_SINGING,
    inSidebar: true,
  },
  {
    title: 'Mic Button',
    targetSelector: '#btn-mic',
    description:
      'Tap to activate your microphone. The app detects your pitch in real time as you sing.',
    placement: 'bottom',
    section: 'practice',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Play / Pause / Stop',
    targetSelector: '[data-tour="transport.essential"]',
    description:
      'Play starts the backing track, Pause halts it temporarily, and Stop returns to the beginning.',
    placement: 'bottom',
    section: 'practice',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Practice Mode',
    targetSelector: '#practice-panel',
    description:
      'In Practice mode, play a melody and sing along. The app detects your pitch in real time and scores your accuracy.',
    placement: 'right',
    section: 'practice',
    requiredTab: TAB_SINGING,
  },

  // ── Toolbar Section ──
  {
    title: 'BPM Control',
    targetSelector: '#bpm-input',
    description:
      'Adjust the tempo with the number input or slider. Faster or slower practice speeds suit different comfort levels.',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Volume & Speed',
    targetSelector: '#volume',
    description:
      'Control the backing track volume and playback speed. Slower speeds help with difficult passages.',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Play Modes',
    targetSelector: '#btn-once',
    description:
      'Spaced plays a single cycle with modifiable rests between the notes',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Play Modes',
    targetSelector: '#btn-repeat',
    description: 'Repeat loops through set number of cycles',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Play Modes',
    targetSelector: '#btn-session',
    description: 'Practice runs your session in sequence.',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: TAB_SINGING,
  },
  // {
  //   title: 'Count-In & Cycles',
  //   targetSelector: '#countin-display',
  //   description:
  //     'Set how many beats of count-in you want before playback starts, and how many cycles to run in Practice mode.',
  //   placement: 'bottom',
  //   section: 'toolbar',
  //   requiredTab: TAB_SINGING,
  // },

  // ── Editor Section ──
  {
    title: 'Compose tab',
    targetSelector: '[data-tour="compose.editor"]',
    description:
      'The Compose tab lets you build and modify melodies. Click to switch here to explore.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: TAB_COMPOSE,
  },
  {
    title: 'Piano Roll',
    targetSelector: '[data-tour="compose.piano-roll"]',
    description:
      'Click on the grid to add notes. Drag them to adjust pitch or timing. Right-click a note to delete it.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: TAB_COMPOSE,
  },
  {
    title: 'Record to Piano Roll',
    targetSelector: '#record-btn',
    description:
      'Hit Record, sing into your mic, and your pitch gets captured as notes on the piano roll.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: TAB_COMPOSE,
  },
  {
    title: 'Editor Toolbar',
    targetSelector: '#key-select',
    description:
      'Change key, scale, BPM, and sensitivity directly from the editor toolbar before recording or editing.',
    placement: 'right',
    section: 'editor',
    requiredTab: TAB_COMPOSE,
    inSidebar: true,
  },

  // ── Effects & Slides Section ──
  {
    title: 'Effect Tools',
    targetSelector: '.roll-group[data-name="Effects"]',
    description:
      'Use effect buttons to add slides, ease, and vibrato to your notes. Hover over any button for a quick hint.',
    placement: 'left',
    section: 'effects',
    requiredTab: TAB_COMPOSE,
  },
  {
    title: 'How Effects Work',
    targetSelector: '#roll-note-info',
    description:
      'The status bar hints guide you. Select 2 notes for slides/ease, or 1+ notes for vibrato. Press S, E, or V keys as shortcuts.',
    placement: 'top',
    section: 'effects',
    requiredTab: TAB_COMPOSE,
  },
  {
    title: 'Multi-Select for Effects',
    targetSelector: '.roll-tool-btn[data-tool="select"]',
    description:
      'Click the Select tool, then click a note and Shift+click a second note to select both. Slides and ease effects work with exactly 2 selected notes.',
    placement: 'bottom',
    section: 'effects',
    requiredTab: TAB_COMPOSE,
  },

  // ── Settings Section ──
  {
    title: 'Settings Tab',
    targetSelector: '#settings-panel',
    description:
      'Fine-tune pitch detection, accuracy scoring, and the app appearance. Click to switch to Settings.',
    placement: 'bottom',
    section: 'settings',
    requiredTab: TAB_SETTINGS,
  },
  {
    title: 'Pitch Detection',
    targetSelector: '#set-sensitivity',
    description:
      'Adjust sensitivity, threshold, and confidence to match your voice and environment. Lower sensitivity reduces false triggers.',
    placement: 'left',
    section: 'settings',
    requiredTab: TAB_SETTINGS,
    // Pitch-detection controls live on the Settings "Practice" sub-tab; open it
    // first so the target exists (the panel defaults to the General sub-tab).
    navigate: ['[data-testid="settings-tab-singing"]'],
  },
  {
    title: 'Practice Aids',
    targetSelector: '[data-tour="settings.practice-aids"]',
    description:
      'Tonic anchor gives a reference tone before singing, helping you stay in key.',
    placement: 'left',
    section: 'settings',
    requiredTab: TAB_SETTINGS,
    navigate: ['[data-testid="settings-tab-singing"]'],
  },
  {
    title: 'Accuracy Bands',
    targetSelector: '#band-perfect',
    description:
      'Customize the cent-threshold for each accuracy band. Tighter bands are more challenging.',
    placement: 'left',
    section: 'settings',
    requiredTab: TAB_SETTINGS,
    navigate: ['[data-testid="settings-tab-singing"]'],
  },
  {
    title: 'Theme & Appearance',
    targetSelector: '#vis-theme',
    description:
      'Switch between light and dark themes, toggle grid lines, and adjust the visual style.',
    placement: 'left',
    section: 'settings',
    requiredTab: TAB_SETTINGS,
    // Theme + appearance toggles live on the "Display & Controls" sub-tab.
    navigate: ['[data-testid="settings-tab-display"]'],
  },
  {
    title: 'Reverb & ADSR',
    targetSelector: '#reverb-type',
    description:
      'Add reverb for a richer sound, or tweak ADSR envelope for more natural-sounding notes.',
    placement: 'left',
    section: 'settings',
    requiredTab: TAB_SETTINGS,
    navigate: ['[data-testid="settings-tab-singing"]'],
  },
]

const WALKTHROUGH_KEY = 'pitchperfect_walkthrough_done'
const GUIDE_SECTIONS_KEY = 'pitchperfect_guide_sections'
export const [showSelection, setShowSelection] = createSignal(false)
export const [selectedWalkthrough, setSelectedWalkthrough] = createSignal<
  string | null
>(null)

/** Whether the WalkthroughModal (reading a specific chapter) is open */
export const [walkthroughModalOpen, setWalkthroughModalOpen] =
  createSignal(false)

/** Close the walkthrough chapter modal */
export function closeWalkthroughChapter(): void {
  setWalkthroughModalOpen(false)
  setSelectedWalkthrough(null)
}

/** Open a specific walkthrough chapter by ID (for hash-based deep linking) */
export function openWalkthroughChapter(chapterId: string): void {
  setSelectedWalkthrough(chapterId)
  setShowSelection(false)
  setWalkthroughModalOpen(true)
}

export const openLearningWalkthrough = () => {
  setShowSelection(true)
  setSelectedWalkthrough(null)
}
export const [walkthroughActive, setWalkthroughActive] = createSignal(false)
export const [walkthroughStep, setWalkthroughStep] = createSignal(0)

/** Loaded steps for the current tour (may be all or a subset) */
export const [tourSteps, setTourSteps] =
  createSignal<WalkthroughStep[]>(WALKTHROUGH_STEPS)

/** Which sections have been completed */
function loadGuideSections(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(GUIDE_SECTIONS_KEY)
    if (stored !== null) return JSON.parse(stored)
  } catch {
    /* */
  }
  return {}
}

function saveGuideSections(secs: Record<string, boolean>): void {
  try {
    localStorage.setItem(GUIDE_SECTIONS_KEY, JSON.stringify(secs))
  } catch {
    /* */
  }
}

export function isGuideSectionCompleted(sectionId: string): boolean {
  return loadGuideSections()[sectionId] || false
}

export function getIncompleteGuideSections(): WalkthroughSection[] {
  const completed = loadGuideSections()
  return GUIDE_SECTIONS.filter((s) => !completed[s.id])
}

function markGuideSectionCompleted(sectionId: string): void {
  const completed = loadGuideSections()
  completed[sectionId] = true
  saveGuideSections(completed)
}

/** Build step list from given section IDs */
function buildStepsFromSections(sectionIds: string[]): WalkthroughStep[] {
  return WALKTHROUGH_STEPS.filter((step) =>
    sectionIds.includes(step.section ?? ''),
  )
}

/** Start full guide tour or specific sections */
export function startWalkthrough(sectionIds?: string[]): void {
  const sections = sectionIds ?? GUIDE_SECTIONS.map((s) => s.id)
  const steps = buildStepsFromSections(sections)
  if (steps.length === 0) return
  setTourSteps(steps)
  setWalkthroughActive(true)
  setWalkthroughStep(0)
}

// Focused "practice modes" tour for the Singing toolbar — distinct from the
// broader Toolbar tour. Launched from the "Understanding Practice Modes" Learn
// tutorial's "Take the tour" bridge.
export const PRACTICE_MODES_TOUR_STEPS: WalkthroughStep[] = [
  {
    title: 'Once',
    targetSelector: '#btn-once',
    description:
      'Play the melody through a single time — best for first learning and memorizing it.',
    placement: 'bottom',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Repeat',
    targetSelector: '#btn-repeat',
    description:
      'Loop the melody for a set number of cycles (set the count beside it) — great for drilling a tricky passage.',
    placement: 'bottom',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Practice session',
    targetSelector: '#btn-session',
    description:
      'Run your saved session in sequence. In this mode a sub-mode selector appears so you can choose how the notes are ordered.',
    placement: 'bottom',
    requiredTab: TAB_SINGING,
  },
]

// ── Per-page spotlight tours ─────────────────────────────────────────
// Page-scoped tours that target stable [data-tour="<page>.<thing>"] hooks
// (decoupled from CSS/test ids so refactors don't break them). Started via
// startPageTour(tab); offered per page by usePageTourOffer.

const GUITAR_TOUR_STEPS: WalkthroughStep[] = [
  {
    title: 'Two ways to play',
    description:
      'Switch between Practice (play along with falling notes) and Fretboard (interactive learning).',
    targetSelector: '[data-tour="guitar.view-toggle"]',
    placement: 'bottom',
    requiredTab: TAB_GUITAR,
  },
  {
    title: 'Pick your sound',
    description:
      'Choose acoustic, electric, or bass — the guitar synth switches instantly.',
    targetSelector: '[data-tour="guitar.instruments"]',
    placement: 'bottom',
    requiredTab: TAB_GUITAR,
  },
  {
    title: 'Load a song',
    description:
      'Load a MIDI song to play along with, mute or solo tracks, and seek the timeline.',
    targetSelector: '[data-tour="guitar.song-picker"]',
    placement: 'bottom',
    requiredTab: TAB_GUITAR,
  },
  {
    title: 'The fretboard',
    description:
      'Play notes on the interactive neck (or your real guitar via mic / MIDI).',
    targetSelector: '[data-tour="guitar.fretboard"]',
    placement: 'top',
    requiredTab: TAB_GUITAR,
    // Make sure we're in Fretboard view (not Practice) before pointing at it.
    navigate: ['[data-tour="guitar.view-fretboard"]'],
  },
  {
    title: 'Practice modes',
    description:
      'Switch the Mode dropdown to turn the fretboard into a focused drill — note quiz, ear training, CAGED and more.',
    targetSelector: '[data-tour="guitar.mode-select"]',
    placement: 'bottom',
    requiredTab: TAB_GUITAR,
    navigate: ['[data-tour="guitar.view-fretboard"]'],
  },
]

const PIANO_TOUR_STEPS: WalkthroughStep[] = [
  {
    title: 'Load a song',
    description:
      'Pick a MIDI song; mute or solo tracks and seek along the timeline.',
    targetSelector: '[data-tour="piano.song-picker"]',
    placement: 'bottom',
    requiredTab: TAB_PIANO,
  },
  {
    title: 'Play the falling notes',
    description:
      'Notes fall toward the keyboard — sing or play them in time. Your pitch (via mic) is matched against each note for scoring.',
    targetSelector: '[data-tour="piano.canvas"]',
    placement: 'top',
    requiredTab: TAB_PIANO,
  },
]

// Karaoke stem-mixer tour. Contextual (not tab-keyed): the targets only exist
// while a session is loaded in the mixer, so it is offered from StemMixer itself
// (auto-once on mount + a manual "Tour" button) rather than via PAGE_TOURS.
export const STEM_MIXER_TOUR_STEPS: WalkthroughStep[] = [
  {
    title: 'Mix the stems',
    description:
      'Separate vocal and instrumental tracks. Drag a fader to balance them, or mute / solo a stem to isolate it.',
    targetSelector: '[data-tour="mixer.stems"]',
    placement: 'left',
    requiredTab: TAB_KARAOKE,
  },
  {
    title: 'Transport & seek',
    description:
      'Play / pause (or hit Space) and scrub the timeline. Set an A–B loop with the A and B keys to drill a tricky phrase.',
    targetSelector: '[data-tour="mixer.transport"]',
    placement: 'top',
    requiredTab: TAB_KARAOKE,
  },
  {
    title: 'Synced lyrics',
    description:
      'Lyrics scroll and highlight in time with the song. Click any line to jump there.',
    targetSelector: '[data-tour="mixer.lyrics"]',
    placement: 'right',
    requiredTab: TAB_KARAOKE,
  },
  {
    title: 'Get lyrics in',
    description:
      'Start here to get lyrics: search online, or load an .lrc/.txt file (you can also paste from the clipboard).',
    targetSelector: '[data-tour="mixer.lyric-source"]',
    placement: 'bottom',
    requiredTab: TAB_KARAOKE,
  },
  {
    title: 'Sync the timing',
    description:
      'Generate an LRC live by tapping along as the song plays (the pencil beside it edits word timings by hand).',
    targetSelector: '[data-tour="mixer.lyric-sync"]',
    placement: 'bottom',
    requiredTab: TAB_KARAOKE,
  },
  {
    title: 'Organize & export',
    description:
      'Download the finished .lrc file (use the list icon beside it to mark repeat blocks like chorus/verse and reuse their timings).',
    targetSelector: '[data-tour="mixer.lyric-export"]',
    placement: 'bottom',
    requiredTab: TAB_KARAOKE,
  },
  {
    title: 'See your pitch',
    description:
      'The vocal pitch contour is drawn here. Enable the mic to overlay your live pitch and get a sung-accuracy score.',
    targetSelector: '[data-tour="mixer.pitch"]',
    placement: 'top',
    requiredTab: TAB_KARAOKE,
  },
  {
    title: 'Karaoke playlist',
    description: 'Queue up a set of songs to sing back-to-back, party style.',
    targetSelector: '[data-tour="mixer.playlist"]',
    placement: 'bottom',
    requiredTab: TAB_KARAOKE,
  },
  {
    title: 'Pitch analysis',
    description:
      'Open denoising and pitch-detection settings to fine-tune how your singing is scored.',
    targetSelector: '.sm-pitch-debug-btn',
    placement: 'bottom',
    requiredTab: TAB_KARAOKE,
  },
  {
    title: 'Full-screen focus',
    description:
      'Enter a distraction-free, full-screen karaoke view — just the lyrics and your pitch. Press Esc to exit.',
    targetSelector: '[data-tour="mixer.focus"]',
    placement: 'bottom',
    requiredTab: TAB_KARAOKE,
  },
]

const ANALYSIS_TOUR_STEPS: WalkthroughStep[] = [
  {
    title: 'Three analysis tools',
    description:
      'Switch between Vocal Analysis, Pitch Detection, and Pitch Algorithms — the tour will visit each.',
    targetSelector: '[data-tour="analysis.subtabs"]',
    placement: 'bottom',
    requiredTab: TAB_ANALYSIS,
  },
  {
    title: 'Vocal Analysis',
    description:
      'Deep-dive a recording or your session history: pitch accuracy, range, vibrato and trends over time.',
    targetSelector: '[data-tour="analysis.vocal"]',
    placement: 'top',
    requiredTab: TAB_ANALYSIS,
    navigate: ['[aria-label="Vocal Analysis"]'],
  },
  {
    title: 'Pitch Detection',
    description:
      'Test the real-time detector against audio files, your mic, or generated tones to see how it tracks pitch.',
    targetSelector: '[data-tour="analysis.detection"]',
    placement: 'top',
    requiredTab: TAB_ANALYSIS,
    navigate: ['[aria-label="Pitch Detection"]'],
  },
  {
    title: 'Pitch Algorithms',
    description:
      'Benchmark the detection algorithms head-to-head on the same signal to compare accuracy and latency.',
    targetSelector: '[data-tour="analysis.algorithms"]',
    placement: 'top',
    requiredTab: TAB_ANALYSIS,
    navigate: ['[aria-label="Pitch Algorithms"]'],
  },
]

const EXERCISES_TOUR_STEPS: WalkthroughStep[] = [
  {
    title: 'Singing exercises',
    description:
      'Focused drills for breath control, intervals, agility, range and more — each builds a specific skill.',
    targetSelector: '.exercises-header',
    placement: 'bottom',
    requiredTab: TAB_EXERCISES,
  },
  {
    title: 'Pick a drill',
    description:
      'Browse the exercise library. Cards are grouped by skill — tap one to start.',
    targetSelector: '.exercises-grid',
    placement: 'top',
    requiredTab: TAB_EXERCISES,
  },
  {
    title: 'Start an exercise',
    description:
      'Each card explains the drill and its difficulty. Hit Start to jump straight into guided practice with live pitch feedback.',
    targetSelector: '.exercise-card',
    placement: 'bottom',
    requiredTab: TAB_EXERCISES,
  },
]

const JAM_TOUR_STEPS: WalkthroughStep[] = [
  {
    title: 'Pick a name',
    description:
      'Set the display name other singers will see when you jam together in real time.',
    targetSelector: '#jam-display-name',
    placement: 'bottom',
    requiredTab: TAB_JAM,
  },
  {
    title: 'Create a room',
    description:
      'Start a new jam room and share the code, then practice or perform together with synced playback.',
    targetSelector: '.jam-actions',
    placement: 'bottom',
    requiredTab: TAB_JAM,
  },
  {
    title: 'Join a room',
    description:
      'Already have a room code from a friend? Enter it here to hop into their session.',
    targetSelector: '#jam-room-id',
    placement: 'bottom',
    requiredTab: TAB_JAM,
  },
]

const COMMUNITY_TOUR_STEPS: WalkthroughStep[] = [
  {
    title: 'Share your work',
    description:
      'Publish a melody, session or exercise so other singers can try it — these buttons start a share.',
    targetSelector: '.community-header',
    placement: 'bottom',
    requiredTab: TAB_COMMUNITY,
  },
  {
    title: 'Browse the community',
    description:
      'Switch between shared melodies, practice sessions, and your public profile.',
    targetSelector: '.community-tabs',
    placement: 'bottom',
    requiredTab: TAB_COMMUNITY,
  },
  {
    title: 'The feed',
    description:
      'Load and play what others have shared, or open a melody straight into practice.',
    targetSelector: '.community-content',
    placement: 'top',
    requiredTab: TAB_COMMUNITY,
  },
]

const LEADERBOARD_TOUR_STEPS: WalkthroughStep[] = [
  {
    title: 'Global, friends, weekly',
    description:
      "Compare yourself against everyone, just your friends, or this week's climbers.",
    targetSelector: '.leaderboard-tabs',
    placement: 'bottom',
    requiredTab: TAB_LEADERBOARD,
  },
  {
    title: 'Rank by metric',
    description:
      'Sort the board by overall score, best score, accuracy, streak or sessions.',
    targetSelector: '.category-tabs',
    placement: 'bottom',
    requiredTab: TAB_LEADERBOARD,
  },
  {
    title: 'Top of the board',
    description: 'The current top three singers for the selected metric.',
    targetSelector: '.podium-section',
    placement: 'bottom',
    requiredTab: TAB_LEADERBOARD,
  },
  {
    title: 'Full rankings',
    description:
      'The complete table — find your row and see what it takes to climb.',
    targetSelector: '.leaderboard-table',
    placement: 'top',
    requiredTab: TAB_LEADERBOARD,
  },
]

const CHALLENGES_TOUR_STEPS: WalkthroughStep[] = [
  {
    title: 'Challenge categories',
    description:
      'High notes, low notes, speed, perfect pitch, scales and more — each category has its own set.',
    targetSelector: '.category-tabs',
    placement: 'bottom',
    requiredTab: TAB_CHALLENGES,
  },
  {
    title: 'Take on a challenge',
    description:
      'Pick a challenge card to attempt it. Your progress and status are tracked per challenge.',
    targetSelector: '.challenges-grid',
    placement: 'top',
    requiredTab: TAB_CHALLENGES,
  },
  {
    title: 'Earn badges',
    description:
      'Completing challenges unlocks badges that show up here — collect them all.',
    targetSelector: '.badges-section',
    placement: 'top',
    requiredTab: TAB_CHALLENGES,
  },
]

export const PAGE_TOURS: Partial<Record<ActiveTab, WalkthroughStep[]>> = {
  [TAB_GUITAR]: GUITAR_TOUR_STEPS,
  [TAB_PIANO]: PIANO_TOUR_STEPS,
  [TAB_ANALYSIS]: ANALYSIS_TOUR_STEPS,
  [TAB_EXERCISES]: EXERCISES_TOUR_STEPS,
  [TAB_JAM]: JAM_TOUR_STEPS,
  [TAB_COMMUNITY]: COMMUNITY_TOUR_STEPS,
  [TAB_LEADERBOARD]: LEADERBOARD_TOUR_STEPS,
  [TAB_CHALLENGES]: CHALLENGES_TOUR_STEPS,
}

/**
 * Catalog of page tours for the Guide modal — title + one-line blurb per tab.
 * Order matches PAGE_TOURS; the modal launches each via startPageTour(tab).
 */
export const PAGE_TOUR_CATALOG: {
  tab: ActiveTab
  title: string
  description: string
}[] = [
  {
    tab: TAB_GUITAR,
    title: 'Guitar',
    description:
      'Practice & Fretboard views, instruments, song play-along, and training modes',
  },
  {
    tab: TAB_PIANO,
    title: 'Piano',
    description:
      'Falling-notes play-along: load a song, sing or play, and get scored',
  },
  {
    tab: TAB_ANALYSIS,
    title: 'Analysis',
    description: 'Vocal analysis, pitch detection, and algorithm benchmarking',
  },
  {
    tab: TAB_EXERCISES,
    title: 'Exercises',
    description: 'Targeted singing drills with live pitch feedback',
  },
  {
    tab: TAB_JAM,
    title: 'Jam',
    description: 'Create or join a real-time jam room and sing together',
  },
  {
    tab: TAB_COMMUNITY,
    title: 'Community',
    description: 'Share your work and browse the community feed',
  },
  {
    tab: TAB_LEADERBOARD,
    title: 'Leaderboard',
    description: 'Global, friends, and weekly rankings by metric',
  },
  {
    tab: TAB_CHALLENGES,
    title: 'Challenges',
    description: 'Vocal challenges and the badges you earn',
  },
]

export function hasPageTour(tab: ActiveTab): boolean {
  return (PAGE_TOURS[tab]?.length ?? 0) > 0
}

/** Start an arbitrary spotlight tour from a list of steps (no-op if empty). */
export function startTour(steps: WalkthroughStep[]): void {
  if (steps.length === 0) return
  setTourSteps(steps)
  setWalkthroughActive(true)
  setWalkthroughStep(0)
}

/** Start the spotlight tour for a given tab (no-op if it has none). */
export function startPageTour(tab: ActiveTab): void {
  const steps = PAGE_TOURS[tab]
  if (steps === undefined) return
  startTour(steps)
}

export function nextWalkthroughStep(): void {
  const steps = tourSteps()
  if (walkthroughStep() < steps.length - 1) {
    setWalkthroughStep((s) => s + 1)
  } else {
    endWalkthrough()
  }
}

/** Skip to the next section, or end if last */
export function skipSection(): void {
  const steps = tourSteps()
  const current = steps[walkthroughStep()]
  if (current == null) {
    endWalkthrough()
    return
  }
  const currentSection = current.section
  if (
    currentSection === null ||
    currentSection === undefined ||
    currentSection === ''
  ) {
    endWalkthrough()
    return
  }
  markGuideSectionCompleted(currentSection)
  // Find first step in a later section
  const nextIdx = steps.findIndex(
    (s, i) => i > walkthroughStep() && s.section !== currentSection,
  )
  if (nextIdx >= 0) {
    setWalkthroughStep(nextIdx)
  } else {
    endWalkthrough()
  }
}

export function prevWalkthroughStep(): void {
  if (walkthroughStep() > 0) {
    setWalkthroughStep((s) => s - 1)
  }
}

export function endWalkthrough(): void {
  // Mark all remaining sections as completed when finishing the tour
  const steps = tourSteps()
  if (steps.length > 0 && walkthroughStep() >= 0) {
    const current = steps[walkthroughStep()]
    const sec = current?.section
    if (sec !== undefined && sec !== '') {
      markGuideSectionCompleted(sec)
    }
  }
  setWalkthroughActive(false)
  setWalkthroughStep(0)
  setTourSteps(WALKTHROUGH_STEPS)
  try {
    localStorage.setItem(WALKTHROUGH_KEY, '1')
  } catch {
    /* empty */
  }
}

// ── Feature Flags ───────────────────────────────────────────────────

const ADVANCED_FEATURES_KEY = 'pitchperfect_advanced_features'
const DEV_FEATURES_KEY = 'pitchperfect_dev_features'

// Initialize to IS_DEV defaults — initFeatureFlagsFromDb() overrides
// with persisted DB values on startup, eliminating the localStorage race.
// Also check localStorage so E2E tests can pre-seed flags via addInitScript.
const initialAdvanced =
  IS_DEV ||
  (typeof localStorage !== 'undefined' &&
    localStorage.getItem(ADVANCED_FEATURES_KEY) === 'true')
const initialDev =
  IS_DEV ||
  (typeof localStorage !== 'undefined' &&
    localStorage.getItem(DEV_FEATURES_KEY) === 'true')

const [advancedFeaturesEnabledState, setAdvancedFeaturesEnabledState] =
  createSignal(initialAdvanced)
const [devFeaturesEnabledState, setDevFeaturesEnabledState] =
  createSignal(initialDev)

export const advancedFeaturesEnabled = (): boolean =>
  advancedFeaturesEnabledState()

export const devFeaturesEnabled = (): boolean => devFeaturesEnabledState()

/** Persist a feature flag to the database layer (falls back to localStorage). */
async function persistFeatureFlag(key: string, value: boolean): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<FeatureFlag>('featureFlags')
    const existing = await repo.findAll({
      where: { key } as Partial<FeatureFlag>,
    })
    if (existing.length > 0) {
      await repo.update(existing[0].id, { value })
    } else {
      await repo.create({ key, value })
    }
  } catch {
    try {
      localStorage.setItem(key, String(value))
    } catch {
      /* empty */
    }
  }
}

export const setAdvancedFeaturesEnabled = (enabled: boolean): void => {
  setAdvancedFeaturesEnabledState(enabled)
  persistFeatureFlag(ADVANCED_FEATURES_KEY, enabled)
}

export const setDevFeaturesEnabled = (enabled: boolean): void => {
  setDevFeaturesEnabledState(enabled)
  persistFeatureFlag(DEV_FEATURES_KEY, enabled)
}

/** Sync feature flags from DB on startup. Call once after DB is ready. */
export async function initFeatureFlagsFromDb(): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<FeatureFlag>('featureFlags')
    const flags = await repo.findAll()
    for (const flag of flags) {
      if (flag.key === ADVANCED_FEATURES_KEY)
        setAdvancedFeaturesEnabledState(flag.value)
      if (flag.key === DEV_FEATURES_KEY) setDevFeaturesEnabledState(flag.value)
    }
  } catch {
    // DB not available, keep current signal values
  }
}

// ── App Crash / Error Handling ────────────────────────────────────────
export interface AppError {
  error: Error
  time: number
}

export const [appError, setAppError] = createSignal<AppError | null>(null)

export function setError(err: AppError | null): void {
  setAppError(err)
}
