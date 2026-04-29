// ============================================================
// Session Store — Unified session management with localStorage
// ============================================================

import type { MelodyItem, PlaybackSession, UnifiedLibrary } from '@/types'
import type { SessionCategory, SessionDifficulty, SessionItem } from '@/types'
import { melodyStore, STORAGE_KEY_LIBRARY, STORAGE_KEY_SESSION_HIST, } from './melody-store'

/** Generate unique item ID */
export function generateSessionItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/** Get all sessions from localStorage (UnifiedLibrary) */
export function getAllSessions(): Record<string, PlaybackSession> {
  // FIXME: we should just get the melody-store whole library here (this here is duplicate code) and return sessions from there!!
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LIBRARY)
    if (stored !== null) {
      const parsed = JSON.parse(stored) as unknown
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        const lib = parsed as { sessions?: Record<string, PlaybackSession> }
        return lib.sessions ?? {}
      }
    }
  } catch {
    // Fail silently
  }
  return {}
}

/** Save sessions to localStorage (UnifiedLibrary) */
function _saveSessions(sessions: Record<string, PlaybackSession>): void {
  try {
    const library = melodyStore.getMelodyLibrary()
    const updatedLibrary: UnifiedLibrary = {
      ...library,
      sessions: sessions,
      meta: {
        author: library.meta.author,
        version: library.meta.version,
        lastUpdated: Date.now(),
      },
      renderSettings: library.renderSettings,
    }
    melodyStore._setMelodyLibrary({ sessions })
    localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(updatedLibrary))
    // NOTE: keep for log debug for later
    // console.log('[_saveSessions] Saved to localStorage:', result)
    // console.log(
    //   '[_saveSessions] Stored value:',
    //   localStorage.getItem(STORAGE_KEY_LIBRARY),
    // )
  } catch (e) {
    console.log('[_saveSessions] Error:', e)
  }
}

/** Add item to session using Map (O(1) insertion and lookup) */
export function addItemToSession(
  sessionId: string,
  item: Omit<SessionItem, 'id'>,
): PlaybackSession | undefined {
  const session = getSession(sessionId)
  if (!session) return undefined

  const newId = generateSessionItemId()
  const updatedItems = new Map<string, SessionItem>(
    session.items.map((item) => [item.id, item]),
  )
  updatedItems.set(newId, { ...item, id: newId })

  const updatedSession: PlaybackSession = {
    ...session,
    items: Array.from(updatedItems.values()),
  }

  saveSession(updatedSession)
  return updatedSession
}

/** Update item in session by ID */
export function updateSessionItem(
  sessionId: string,
  itemId: string,
  updates: Partial<SessionItem>,
): PlaybackSession | undefined {
  const session = getSession(sessionId)
  if (!session) return undefined

  const updatedItems = new Map<string, SessionItem>(
    session.items.map((item) => [item.id, item]),
  )
  const existingItem = updatedItems.get(itemId)
  if (existingItem) {
    updatedItems.set(itemId, { ...existingItem, ...updates })
  }

  const updatedSession: PlaybackSession = {
    ...session,
    items: Array.from(updatedItems.values()),
  }

  saveSession(updatedSession)
  return updatedSession
}

/** Delete item from session by ID */
export function deleteSessionItem(
  sessionId: string,
  itemId: string,
): PlaybackSession | undefined {
  const session = getSession(sessionId)
  if (!session) return undefined

  const updatedItems = new Map<string, SessionItem>(
    session.items.map((item) => [item.id, item]),
  )
  updatedItems.delete(itemId)

  const updatedSession: PlaybackSession = {
    ...session,
    items: Array.from(updatedItems.values()),
  }

  saveSession(updatedSession)
  return updatedSession
}

/** Get item from session by ID (O(1) lookup) */
export function getSessionItem(
  sessionId: string,
  itemId: string,
): SessionItem | undefined {
  const session = getSession(sessionId)
  return session?.items.find((item) => item.id === itemId)
}

/** Get all items from session */
export function getSessionItems(sessionId: string): SessionItem[] {
  const session = getSession(sessionId)
  return session?.items || []
}

/** Get items in session ordered by startBeat */
export function getSessionItemsOrdered(sessionId: string): SessionItem[] {
  const items = getSessionItems(sessionId)
  return items.sort((a, b) => a.startBeat - b.startBeat)
}

/** Get items at specific beat position */
export function getItemsAtBeat(
  sessionId: string,
  startBeat: number,
): SessionItem[] {
  const items = getSessionItems(sessionId)
  return items.filter((item) => item.startBeat === startBeat)
}

/** Create new user-deletable session */
export function createSession(
  name: string,
  items: SessionItem[] = [],
  difficulty?: SessionDifficulty,
  category?: SessionCategory,
): PlaybackSession {
  return {
    id: generateId(),
    name,
    author: 'User',
    deletable: true,
    items,
    created: Date.now(),
    lastPlayed: undefined,
    difficulty,
    category,
  }
}

/** Create new internal/default session (not deletable) */
export function createInternalSession(
  name: string,
  items: SessionItem[],
): PlaybackSession {
  return {
    id: generateId(),
    name,
    author: 'System',
    deletable: false,
    items,
    created: Date.now(),
    lastPlayed: undefined,
  }
}

/** Get session by ID */
export function getSession(id: string): PlaybackSession | undefined {
  const sessions = getAllSessions()
  return sessions[id]
}

/** Get all sessions (including internal/default) */
export function getAll(): Record<string, PlaybackSession | null> {
  const userSessions = getAllSessions()
  const defaultSession = getDefaultSession()
  const sessions: Record<string, PlaybackSession | null> = {}
  sessions['default'] = defaultSession
  Object.assign(sessions, userSessions)
  return sessions
}

/** Get all user-deletable sessions, sorted by lastPlayed (newest first) */
export function getSessions(): PlaybackSession[] {
  const sessions = getAll()
  const userSessions = Object.values(sessions).filter(
    (s): s is PlaybackSession => s !== null && s.deletable === true,
  )
  return userSessions.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
}

/** Get a specific internal/default session by name or ID */
export function getInternalSession(nameOrId: string): PlaybackSession | null {
  const sessions = getAll()
  for (const session of Object.values(sessions)) {
    if (session === null) continue
    if (session.deletable === false) {
      if (session.id === nameOrId || session.name === nameOrId) {
        return session
      }
    }
  }
  return null
}

/** Get or create default session */
export function getDefaultSession(): PlaybackSession {
  const sessions = getAllSessions()
  const defaultSession = sessions['default']

  if (defaultSession === null || defaultSession === undefined) {
    const session = createDefaultSession()
    _saveSessions({ ...sessions, default: session })
    return session
  }

  return defaultSession
}

/** Create the default session with starter melodies.
 *
 * NOTE: Every non-rest item is a `type:'melody'` reference into a seeded
 * scale-melody (`scale-major-c4`, `scale-major-g4`, …). Sessions never
 * hold raw `type:'scale'` items — those used to be supported but were
 * removed in v3 because the sidebar selection logic was inconsistent
 * between melody-refs and scale-configs (only melody-refs got the
 * `selected` / `melody-pill` styling, draggable behavior, etc.). If you
 * need a scale, generate it as a melody and reference its id here.
 */
function createDefaultSession(): PlaybackSession {
  const defaultSession = createInternalSession('Default Session', [
    {
      id: generateSessionItemId(),
      type: 'melody',
      startBeat: 0,
      label: 'C Major Scale',
      melodyId: 'scale-major-c4',
    },
    {
      id: generateSessionItemId(),
      type: 'melody',
      startBeat: 16,
      label: 'G Major Scale',
      melodyId: 'scale-major-g4',
    },
    {
      id: generateSessionItemId(),
      type: 'rest',
      startBeat: 32,
      label: 'Rest - 4 bars',
      restMs: 8000,
    },
  ])

  // Explicitly set ID to 'default' to match lookup key
  defaultSession.id = 'default'

  _saveSessions({ default: defaultSession })
  return defaultSession
}

/** Save or update a session */
export function saveSession(session: PlaybackSession): void {
  const sessions = getAllSessions()
  sessions[session.id] = session
  _saveSessions(sessions)
}

/** Delete a user-deletable session */
export function deleteSession(id: string): boolean {
  const sessions = getAllSessions()
  const session = sessions[id]
  if (session?.deletable === true) {
    delete sessions[id]
    _saveSessions(sessions)
    return true
  }
  return false
}

// FIXME: These commented out functions should be removed when tests are written for new
// session/session-practice stores
// export function clearSessionHistory() {
//   localStorage.removeItem(STORAGE_KEY_SESSION_HIST)
// }

// /** Get session history from localStorage */
// export function getSessionHistory(): SessionResult[] {
//   try {
//     const stored = localStorage.getItem(STORAGE_KEY_SESSION_HIST)
//     if (stored !== null) {
//       const parsed = JSON.parse(stored) as unknown
//       if (Array.isArray(parsed)) {
//         return parsed as SessionResult[]
//       }
//     }
//   } catch {
//     // Fail silently
//   }
//   return []
// }

// /** Save session result to history */
// export function saveSessionResult(result: SessionResult): void {
//   const history = getSessionHistory()
//   const updated = [result, ...history].slice(0, 50) // Keep max 50
//   try {
//     localStorage.setItem(STORAGE_KEY_SESSION_HIST, JSON.stringify(updated))
//   } catch {
//     // Fail silently
//   }
// }

/** Reset all sessions (clear localStorage) */
export function resetAllSessions(): void {
  // Clear the unified library which will remove sessions
  localStorage.removeItem(STORAGE_KEY_LIBRARY)
  localStorage.removeItem(STORAGE_KEY_SESSION_HIST)
}

/** Generate unique ID */
function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/** Create a scale session item */
export function createScaleItem(
  label: string,
  scaleType: string,
  beats: number,
  startBeat: number,
): SessionItem {
  return {
    id: generateSessionItemId(),
    type: 'scale' as 'rest',
    startBeat,
    label,
    scaleType,
    beats,
  }
}

/** Create a rest session item */
export function createRestItem(
  label: string,
  restMs: number,
  startBeat: number,
): SessionItem {
  return {
    id: generateSessionItemId(),
    type: 'rest',
    startBeat,
    label,
    restMs,
  }
}

/** Create a preset session item */
export function createPresetItem(
  label: string,
  items: MelodyItem[],
  startBeat: number,
): SessionItem {
  return {
    id: generateSessionItemId(),
    type: 'preset' as 'rest',
    startBeat,
    label,
    items,
  }
}

/** Create a melody reference session item */
export function createMelodyItem(
  label: string,
  melodyId: string,
  startBeat: number,
): SessionItem {
  return {
    id: generateSessionItemId(),
    type: 'melody',
    startBeat,
    label,
    melodyId,
  }
}

/** Get session count */
export function getSessionCount(): number {
  return Object.keys(getAll()).length
}

/** Get user session count */
export function getUserSessionCount(): number {
  return getSessions().length
}
