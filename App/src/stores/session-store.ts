// ============================================================
// Session Store — Unified session management with localStorage
// ============================================================

import type {
  MelodyItem,
  SavedUserSession,
  SessionResult,
} from '@/types'
import type { SessionCategory, SessionDifficulty, SessionItem } from '@/types'

const STORAGE_KEY = 'pitchperfect_sessions'

/** Generate unique item ID */
export function generateSessionItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/** Get all sessions from localStorage */
export function getAllSessions(): Record<string, SavedUserSession> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as unknown
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, SavedUserSession>
      }
    }
  } catch {
    // Fail silently
  }
  return {}
}

/** Save sessions to localStorage */
function _saveSessions(sessions: Record<string, SavedUserSession>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // Fail silently
  }
}

/** Add item to session using Map (O(1) insertion and lookup) */
export function addItemToSession(
  sessionId: string,
  item: Omit<SessionItem, 'id'>,
): void {
  const session = getSession(sessionId)
  if (!session) return

  const newId = generateSessionItemId()
  const updatedItems = new Map<string, SessionItem>(session.items.map(item => [item.id, item]))
  updatedItems.set(newId, { ...item, id: newId })

  const updatedSession: SavedUserSession = {
    ...session,
    items: Array.from(updatedItems.values()),
  }

  saveSession(updatedSession)
}

/** Update item in session by ID */
export function updateSessionItem(
  sessionId: string,
  itemId: string,
  updates: Partial<SessionItem>,
): void {
  const session = getSession(sessionId)
  if (!session) return

  const updatedItems = new Map<string, SessionItem>(session.items.map(item => [item.id, item]))
  const existingItem = updatedItems.get(itemId)
  if (existingItem) {
    updatedItems.set(itemId, { ...existingItem, ...updates })
  }

  const updatedSession: SavedUserSession = {
    ...session,
    items: Array.from(updatedItems.values()),
  }

  saveSession(updatedSession)
}

/** Delete item from session by ID */
export function deleteSessionItem(sessionId: string, itemId: string): void {
  const session = getSession(sessionId)
  if (!session) return

  const updatedItems = new Map<string, SessionItem>(session.items.map(item => [item.id, item]))
  updatedItems.delete(itemId)

  const updatedSession: SavedUserSession = {
    ...session,
    items: Array.from(updatedItems.values()),
  }

  saveSession(updatedSession)
}

/** Get item from session by ID (O(1) lookup) */
export function getSessionItem(sessionId: string, itemId: string): SessionItem | undefined {
  const session = getSession(sessionId)
  return session?.items.find(item => item.id === itemId)
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
export function getItemsAtBeat(sessionId: string, startBeat: number): SessionItem[] {
  const items = getSessionItems(sessionId)
  return items.filter(item => item.startBeat === startBeat)
}

/** Create new user-deletable session */
export function createSession(
  name: string,
  items: SessionItem[] = [],
  difficulty?: SessionDifficulty,
  category?: SessionCategory,
): SavedUserSession {
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
): SavedUserSession {
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
export function getSession(id: string): SavedUserSession | undefined {
  const sessions = getAllSessions()
  return sessions[id]
}

/** Alias for compatibility */
export function getSessionStore(id: string): SavedUserSession | undefined {
  return getSession(id)
}

/** Get all sessions (including internal/default) */
export function getAll(): Record<string, SavedUserSession | null> {
  const userSessions = getAllSessions()
  const defaultSession = getDefaultSession()
  const sessions: Record<string, SavedUserSession | null> = {}
  if (defaultSession) {
    sessions['default'] = defaultSession
  }
  Object.assign(sessions, userSessions)
  return sessions
}

/** Get all user-deletable sessions, sorted by lastPlayed (newest first) */
export function getSessions(): SavedUserSession[] {
  const sessions = getAll()
  const userSessions = Object.values(sessions).filter((s): s is SavedUserSession =>
    s !== null && s.deletable === true
  )
  return userSessions.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
}

/** Get a specific internal/default session by name or ID */
export function getInternalSession(nameOrId: string): SavedUserSession | null {
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
export function getDefaultSession(): SavedUserSession | null {
  const sessions = getAllSessions()
  const defaultSession = sessions['default']

  if (defaultSession === null || defaultSession === undefined) {
    return createDefaultSession()
  }

  return defaultSession
}

/** Create the default session with starter melodies */
function createDefaultSession(): SavedUserSession {
  const defaultSession = createInternalSession('Default Session', [
    {
      id: generateSessionItemId(),
      type: 'scale',
      startBeat: 0,
      label: 'C Major Scale (Octave 3-4)',
      scaleType: 'major',
      beats: 16,
    },
    {
      id: generateSessionItemId(),
      type: 'scale',
      startBeat: 16,
      label: 'G Major Scale (Octave 3-4)',
      scaleType: 'major',
      beats: 16,
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
export function saveSession(session: SavedUserSession): void {
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

/** Get session history from localStorage */
export function getSessionHistory(): SessionResult[] {
  try {
    const stored = localStorage.getItem('pitchperfect_session_history')
    if (stored !== null) {
      const parsed = JSON.parse(stored) as unknown
      if (Array.isArray(parsed)) {
        return parsed as SessionResult[]
      }
    }
  } catch {
    // Fail silently
  }
  return []
}

/** Save session result to history */
export function saveSessionResult(result: SessionResult): void {
  const history = getSessionHistory()
  const updated = [result, ...history].slice(0, 50) // Keep max 50
  try {
    localStorage.setItem('pitchperfect_session_history', JSON.stringify(updated))
  } catch {
    // Fail silently
  }
}

/** Reset all sessions and history (clear localStorage) */
export function resetAllSessions(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('pitchperfect_session_history')
}

/** Generate unique ID */
function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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
    type: 'scale',
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
    type: 'preset',
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