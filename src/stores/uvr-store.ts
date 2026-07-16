import { createSignal } from 'solid-js'
import type { SessionGroupRecord, UvrSessionRecord } from '@/db'
import { getDb } from '@/db'
import { durableWrite } from '@/db/durable-write'
import { getUserId } from '@/db/seed'
import { deleteAllLyricsFromDb, deleteLyricsFromDb, } from '@/db/services/lyrics-db-service'
import { deleteAllUvrSessionsFromDb, deleteUvrSessionFromDb, sessionHasPlayableStems, } from '@/db/services/uvr-service'
import { deleteAllTranscriptionsFromDb } from '@/db/services/whisper-transcription-db-service'
import { IS_DEV } from '@/lib/defaults'

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
  if (saved === 'local' || saved === 'server') return saved
  return DEFAULT_PROCESSING_MODE
}

export function setUvrProcessingMode(mode: UvrProcessingMode): void {
  localStorage.setItem('pitchperfect_uvr-processing-mode', mode)
  _setUvrProcessingMode(mode)
}

export const [uvrProcessingMode, _setUvrProcessingMode] =
  createSignal<UvrProcessingMode>(getUvrProcessingMode())

// Server-side separation runs a single quality — BS-RoFormer, the
// pipeline's default model. Measured 2026-07-06: better, faster AND
// cheaper than the MDX alternative on the GPU, so the Basic/HQ selector
// was removed and the per-song price collapsed to the tier base
// (1 credit). The `model` option on runUvrPipeline remains for future
// tiers (karaoke, ensemble).

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
  // Stems are separated but still being written to IndexedDB. The session is
  // NOT safe to reload until this reaches 'completed' — the pipeline awaits the
  // saves before flipping it, and a beforeunload guard warns during this window.
  | 'finalizing'
  | 'completed'
  | 'error'
  | 'cancelled'
  // An in-progress job whose client polling was lost to a reload. Set by
  // reconcileInterruptedSessions() on the next load; retryable.
  | 'interrupted'

/** UVR session interface */
export interface UvrSession {
  sessionId: string
  apiSessionId?: string
  status: UvrStatus
  progress: number
  indeterminate?: boolean
  /** Server-job phase while processing: queued = waiting for a GPU worker
   *  (cold start / image pull), processing = actually separating. */
  phase?: 'queued' | 'processing'
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
    apiSessionId: session.apiSessionId,
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
    apiSessionId: rec.apiSessionId,
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

// Per-session write chain so a fire-and-forget progress write can't race a
// durable completion write and create a DUPLICATE record (both findAll → 0 →
// create). Serializing per session id keeps upsert genuinely idempotent.
const sessionWriteChains = new Map<string, Promise<void>>()

/** Raw upsert of one session record — throws on failure. Serialized per
 *  session id so concurrent writes for the same session run in order. */
function upsertSessionRecord(session: UvrSession): Promise<void> {
  const run = async (): Promise<void> => {
    const db = await getDb()
    const repo = db.getRepository<UvrSessionRecord>('uvrSessions')
    const existing = await repo.findAll({
      where: { appSessionId: session.sessionId } as Record<string, unknown>,
      limit: 1,
    })
    if (existing.length > 0) {
      await repo.update(existing[0].id, sessionToDbRecord(session))
    } else {
      await repo.create(sessionToDbRecord(session))
    }
  }
  // Run after whatever is already queued for this session (success or failure).
  const prev = sessionWriteChains.get(session.sessionId) ?? Promise.resolve()
  const next = prev.then(run, run)
  sessionWriteChains.set(
    session.sessionId,
    next.then(
      () => undefined,
      () => undefined,
    ),
  )
  return next
}

/** Best-effort persist (fire-and-forget) — for frequent, non-critical updates
 *  like progress ticks. Terminal states use persistSessionDurable instead. */
function persistSessionToDb(session: UvrSession): void {
  void upsertSessionRecord(session).catch((err) => {
    if (IS_DEV) console.warn('[SessionStore] persistSessionToDb failed:', err)
  })
}

/** Durable persist — awaited + retried. Returns whether the record actually
 *  reached IndexedDB, so the completion flow can refuse to report "done" until
 *  it has. This is the fix for "completed session vanishes on reload". */
export async function persistSessionDurable(
  session: UvrSession,
): Promise<boolean> {
  const res = await durableWrite('persist session record', () =>
    upsertSessionRecord(session),
  )
  return res.ok
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

/** Update just the in-memory cache + reactive signal (no DB write). */
function updateSessionCache(session: UvrSession): void {
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
}

function upsertSessionInCache(session: UvrSession): void {
  updateSessionCache(session)
  persistSessionToDb(session)
}

/** Remove a session from the in-memory cache (DB delete is separate). */
function removeSessionFromCache(sessionId: string): void {
  _setSessionsCache((prev) => prev.filter((s) => s.sessionId !== sessionId))
  bumpSessions()
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

  // Repair sessions the previous run left in a wrong state, and prune ones whose
  // paid stems were lost before the durable-write fix. Async so init isn't
  // blocked, but every write inside is durable.
  void reconcileInterruptedSessions()
  void pruneOrphanedCompletedSessions()
}

/**
 * Repair sessions left non-terminal by an interrupted job or a completion
 * persist that failed. Runs once on load:
 *  - in-progress (processing/uploading/finalizing) WITH stems on disk → the job
 *    actually finished but its completion write was lost → mark 'completed'.
 *  - in-progress WITHOUT stems → client polling died on a reload → 'interrupted'
 *    (retryable). A server job whose `apiSessionId` we persisted is RECOVERABLE:
 *    the auto-resume (see resumableServerSessions) re-attaches to the RunPod job
 *    and re-fetches its stems for free, so its message invites a fetch rather
 *    than a re-run. Local jobs (no apiSessionId) are simply gone.
 */
export async function reconcileInterruptedSessions(): Promise<void> {
  const inFlight = getAllUvrSessions().filter(
    (s) =>
      s.status === 'processing' ||
      s.status === 'uploading' ||
      s.status === 'finalizing',
  )
  for (const s of inFlight) {
    const hasStems = await sessionHasPlayableStems(s.sessionId)
    const recoverable =
      s.processingMode === 'server' &&
      s.apiSessionId !== undefined &&
      s.apiSessionId !== ''
    let fixed: UvrSession
    if (hasStems) {
      // The job finished but its completion write was lost — promote it.
      fixed = { ...s, status: 'completed', progress: 100 }
    } else if (recoverable) {
      // A server job whose RunPod id we persisted: leave it in-flight (reset to
      // a clean indeterminate "reconnecting" bar) so the UI's auto-resume
      // re-attaches and re-fetches its stems for free — no orphaning, no
      // re-charge. Owned by resumableServerSessions from here.
      fixed = {
        ...s,
        status: 'processing',
        indeterminate: true,
        phase: 'queued',
        error: undefined,
      }
    } else {
      // Local job (or a server job with no id we can recover) — it's gone.
      fixed = {
        ...s,
        status: 'interrupted',
        error: 'Interrupted — the app was reloaded while this was processing.',
      }
    }
    updateSessionCache(fixed)
    await persistSessionDurable(fixed)
  }
}

/**
 * Server sessions that can be re-attached to their RunPod job on this load:
 * an `apiSessionId` we persisted, no playable stems yet, and a non-terminal or
 * interrupted status. The UI resumes polling these (re-fetching stems for free,
 * within RunPod's ~30 min result / R2's ~24 h window) instead of orphaning them
 * and re-charging a fresh separation.
 */
export async function resumableServerSessions(): Promise<UvrSession[]> {
  const candidates = getAllUvrSessions().filter(
    (s) =>
      s.processingMode === 'server' &&
      s.apiSessionId !== undefined &&
      s.apiSessionId !== '' &&
      (s.status === 'interrupted' ||
        s.status === 'processing' ||
        s.status === 'uploading' ||
        s.status === 'finalizing'),
  )
  const out: UvrSession[] = []
  for (const s of candidates) {
    if (!(await sessionHasPlayableStems(s.sessionId))) out.push(s)
  }
  return out
}

/**
 * Remove 'completed' sessions whose playable stems are missing — the pre-fix
 * data loss. They can never open, so pruning them clears the confusing
 * "processed but can't open / retry" entries. Returns how many were pruned.
 */
export async function pruneOrphanedCompletedSessions(): Promise<number> {
  const completed = getAllUvrSessions().filter((s) => s.status === 'completed')
  let pruned = 0
  for (const s of completed) {
    if (!(await sessionHasPlayableStems(s.sessionId))) {
      const ok = await deleteUvrSessionFromDb(s.sessionId)
      if (ok) {
        removeSessionFromCache(s.sessionId)
        pruned++
      }
    }
  }
  if (pruned > 0) {
    console.info(`[SessionStore] pruned ${pruned} orphaned session(s)`)
  }
  return pruned
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

/** Update the live `currentUvrSession` signal ONLY when this session is the one
 *  the user is viewing. A background auto-resume (see resumableServerSessions)
 *  polls sessions the user may not be looking at; its progress/terminal updates
 *  must refresh the session's card (via the cache) without yanking the current
 *  view onto it. Foreground flows set `current` to the session before polling,
 *  so this stays a no-op there. */
function setCurrentSessionIfActive(updated: UvrSession): void {
  if (currentUvrSession()?.sessionId === updated.sessionId) {
    setCurrentUvrSession(updated)
  }
}

/** Update UVR session progress */
export function updateUvrSessionProgress(
  sessionId: string,
  progress: number,
  processingTime?: number,
  indeterminate?: boolean,
  phase?: 'queued' | 'processing',
): void {
  const session = getUvrSession(sessionId)
  if (session) {
    const updated: UvrSession = {
      ...session,
      progress,
      indeterminate: indeterminate ?? false,
      phase: phase ?? session.phase,
      processingTime:
        processingTime !== undefined ? processingTime : session.processingTime,
    }
    upsertSessionInCache(updated)
    setCurrentSessionIfActive(updated)
  }
}

/** Drop a session's persisted RunPod job id. Called when a job reaches a
 *  server-confirmed terminal state (failed / expired), so the recovery
 *  affordances that key off `apiSessionId` (the "Fetch my stems" button, the
 *  re-attach on re-upload) disappear and the user is steered to "Separate
 *  again". NOT called on a transient/network error or a local-save failure —
 *  those may still be recoverable, so the id is kept. */
export function clearUvrSessionApiId(sessionId: string): void {
  const session = getUvrSession(sessionId)
  if (session && session.apiSessionId !== undefined) {
    const updated: UvrSession = { ...session, apiSessionId: undefined }
    upsertSessionInCache(updated)
    setCurrentSessionIfActive(updated)
    persistSessionToDb(updated)
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

/** Flip a server session back into the processing state when re-attaching to
 *  an in-flight RunPod job on load / foreground. No new job is submitted and no
 *  credit is charged — the existing apiSessionId is re-polled. Starts
 *  indeterminate/queued so the bar reads "reconnecting" until the first poll
 *  returns real progress. */
export function setUvrSessionResuming(sessionId: string): void {
  const session = getUvrSession(sessionId)
  if (session) {
    const updated: UvrSession = {
      ...session,
      status: 'processing',
      indeterminate: true,
      phase: 'queued',
      error: undefined,
    }
    updateSessionCache(updated)
    setCurrentSessionIfActive(updated)
    persistSessionToDb(updated)
  }
}

/** Mark a session as finalizing — stems separated, now being written to disk.
 *  Shown to the user as "Saving…"; the flow must not report success until the
 *  writes land (see completeUvrSession). */
export function setFinalizingUvrSession(sessionId: string): void {
  const session = getUvrSession(sessionId)
  if (session) {
    const updated: UvrSession = {
      ...session,
      status: 'finalizing',
      progress: 100,
    }
    updateSessionCache(updated)
    setCurrentSessionIfActive(updated)
    persistSessionToDb(updated) // best-effort; the durable write is on complete
  }
}

/**
 * Complete a UVR session and DURABLY persist the record before resolving.
 * Returns whether the record reached IndexedDB — callers keep the session in
 * 'finalizing'/'error' (not 'completed') until this resolves true, so a
 * "completed" session always has a durable record on the next load.
 */
export async function completeUvrSession(
  sessionId: string,
  outputs: UvrSession['outputs'],
  stemMeta?: UvrSession['stemMeta'],
): Promise<boolean> {
  const session = getUvrSession(sessionId)
  if (!session) return false
  const updated: UvrSession = {
    ...session,
    status: 'completed',
    outputs,
    stemMeta,
    progress: 100,
    // Prefer the elapsed time tracked during polling
    // (updateUvrSessionProgress). Recomputing from createdAt inflates it when
    // a session is reused by file hash (stale createdAt) — e.g. a sub-minute
    // job reporting ~3272 s.
    processingTime: session.processingTime ?? Date.now() - session.createdAt,
  }
  updateSessionCache(updated)
  setCurrentSessionIfActive(updated)
  return persistSessionDurable(updated)
}

/** Set UVR session error */
export function setErrorUvrSession(sessionId: string, error: string): void {
  const session = getUvrSession(sessionId)
  if (session) {
    const updated: UvrSession = { ...session, status: 'error', error }
    upsertSessionInCache(updated)
    setCurrentSessionIfActive(updated)
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
    // A server job whose RunPod id we persisted is RECOVERABLE — leave it for
    // reconcileInterruptedSessions() + the UI auto-resume to re-attach and
    // re-fetch (no re-charge). Erroring it here (before those run) is what made
    // a reload look "interrupted" and unrecoverable. Only local jobs, or a
    // server job with no id to recover, are errored.
    const recoverable =
      session.processingMode === 'server' &&
      session.apiSessionId !== undefined &&
      session.apiSessionId !== ''
    if (
      (session.status === 'processing' || session.status === 'uploading') &&
      !recoverable
    ) {
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

// Intentionally NO cancel-on-unload for in-flight server jobs. Cancelling a
// RUNNING job on reload/close wastes GPU time the user already paid for (the
// debit is taken at submit and is only refunded for a never-started IN_QUEUE
// job), and — worse — it destroyed the job the next load now re-attaches to,
// forcing a re-run and a second charge. Keeping the job alive lets the app
// re-attach on the next load / foreground and re-fetch the stems for free
// (RunPod ~30 min result, R2 ~24 h). Explicit user cancel still goes through
// the Cancel button (cancelUvrPipeline).

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
    instrumentalMidi: session.outputs?.instrumentalMidi ?? '',
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
