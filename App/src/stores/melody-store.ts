// ============================================================
// Melody Store — Melody items and scale data (in-memory)
// ============================================================

import { createSignal } from 'solid-js'
import { buildMultiOctaveScale } from '@/lib/scale-data'
import type { MelodyData, MelodyItem, MelodyLibrary, MelodyNote, SavedUserSession, ScaleDegree, } from '@/types'

const STORAGE_KEY_MELODY_LIBRARY = 'pitchperfect_melody_library'
const STORAGE_KEY_USER_SESSIONS = 'pitchperfect_user_sessions'

const DEFAULT_LIBRARY: MelodyLibrary = {
  meta: {
    author: 'User',
    version: '1.0',
    lastUpdated: Date.now(),
  },
  renderSettings: {
    gridlines: true,
    showLabels: true,
    showNumbers: false,
  },
  melodies: {},
  playlists: {},
}

function loadLibrary(): MelodyLibrary {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MELODY_LIBRARY)
    if (stored !== null && stored !== '') {
      const parsed = JSON.parse(stored)
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'melodies' in parsed
      ) {
        return parsed
      }
    }
  } catch {
    // Fail silently, use default
  }
  return DEFAULT_LIBRARY
}

let _idCounter = 100

function generateMelodyId(): string {
  return `melody-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function generateId(): number {
  return ++_idCounter
}

// Create store with explicit access functions
const _melodyLibraryData = loadLibrary()
const _melodyLibrarySetter: (
  fn: (lib: MelodyLibrary) => MelodyLibrary,
) => void = (fn) => {
  Object.assign(_melodyLibraryData, fn(_melodyLibraryData))
}

/** Get the melody library data */
export function getMelodyLibrary(): MelodyLibrary {
  return _melodyLibraryData
}

/** Reset the melody library store (used by tests) */
export function resetMelodyLibrary(): void {
  localStorage.removeItem(STORAGE_KEY_MELODY_LIBRARY)
  localStorage.removeItem(STORAGE_KEY_USER_SESSIONS)
  _idCounter = 100
  Object.assign(_melodyLibraryData, {
    melodies: {},
    playlists: {},
    meta: { author: 'User', version: '1.0', lastUpdated: Date.now() },
    renderSettings: { gridlines: true, showLabels: true, showNumbers: false },
  })
  userSessions() // Access the signal to force reactivity
  setUserSessions([])
}

function loadUserSessions(): SavedUserSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_USER_SESSIONS)
    if (stored !== null && stored !== '') {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // Fail silently, use empty array
  }
  return []
}

function saveUserSessions(sessions: SavedUserSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER_SESSIONS, JSON.stringify(sessions))
  } catch {
    // Fail silently
  }
}

const [userSessions, setUserSessions] =
  createSignal<SavedUserSession[]>(loadUserSessions())

export function getSessions(): SavedUserSession[] {
  return userSessions()
}

export function saveSession(session: SavedUserSession): void {
  const updated = [...userSessions(), session].sort(
    (a, b) => b.created - a.created,
  )
  setUserSessions(updated)
  saveUserSessions(updated)
}

export function updateSession(
  id: string,
  updates: Partial<SavedUserSession>,
): void {
  setUserSessions((sessions) =>
    sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
  )
  saveUserSessions(userSessions())
}

export function deleteSession(id: string): void {
  setUserSessions((sessions) => sessions.filter((s) => s.id !== id))
  saveUserSessions(userSessions())
}

export function updateUserSession(session: SavedUserSession): void {
  const sessions = userSessions()
  const updated = [...sessions, session]
  updated.sort(
    (a: SavedUserSession, b: SavedUserSession) =>
      (b.lastPlayed ?? b.created) - (a.lastPlayed ?? a.created),
  )
  setUserSessions(updated)
  saveUserSessions(updated)
}

export function getSession(id: string): SavedUserSession | undefined {
  return userSessions().find((s) => s.id === id)
}

export const [currentMelody, setCurrentMelody] =
  createSignal<MelodyData | null>(null)

// ============================================================
// Melody Operations
// ============================================================

export function createNewMelody(name?: string, author?: string): MelodyData {
  const id = generateMelodyId()
  const newMelody: MelodyData = {
    id,
    name:
      name ??
      `New Melody ${Object.keys(_melodyLibraryData.melodies).length + 1}`,
    author: author ?? 'User',
    bpm: DEFAULT_BPM,
    key: DEFAULT_KEY,
    scaleType: DEFAULT_SCALE_TYPE,
    octave: DEFAULT_OCTAVE,
    items: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  _melodyLibraryData.melodies[id] = newMelody
  _melodyLibraryData.meta.lastUpdated = Date.now()
  setCurrentMelody(newMelody)
  return newMelody
}

const DEFAULT_KEY = 'C'
const DEFAULT_SCALE_TYPE = 'major'
const DEFAULT_OCTAVE = 4
const DEFAULT_BPM = 80

// ============================================================
// Scale - SolidJS Signals
// ============================================================

const _currentScale = createSignal<ScaleDegree[]>(
  buildMultiOctaveScale(DEFAULT_KEY, DEFAULT_OCTAVE, 2, DEFAULT_SCALE_TYPE),
)
export const currentScale = _currentScale[0]
export const setCurrentScale = _currentScale[1]

const _currentOctave = createSignal<number>(DEFAULT_OCTAVE)
export const currentOctave = _currentOctave[0]
const _setOctave = _currentOctave[1]

const _currentNoteIndex = createSignal<number>(0)
export const currentNoteIndex = _currentNoteIndex[0]
export const setCurrentNoteIndex = _currentNoteIndex[1]

// ============================================================
// Melody Note Operations
// ============================================================

export function addMelodyNote(
  note: MelodyNote,
  startBeat: number,
  duration: number,
): number {
  const current = currentMelody()
  if (current === null || current === undefined) return 0
  const items = current.items ?? []
  const key = current.id
  const newItem = { id: generateId(), note, startBeat, duration }
  _melodyLibraryData.melodies[key] = {
    ...current,
    items: [...items, newItem],
    updatedAt: Date.now(),
  }
  _melodyLibraryData.meta.lastUpdated = Date.now()
  setCurrentMelody({ ...current, items: [...items, newItem] })
  return newItem.id
}

export function removeMelodyNote(id: number): void {
  const current = currentMelody()
  if (current === null || current === undefined) return
  const items = current.items ?? []
  const key = current.id
  const updatedItems = items.filter((item) => item.id !== id)
  _melodyLibraryData.melodies[key] = {
    ...current,
    items: updatedItems,
    updatedAt: Date.now(),
  }
  _melodyLibraryData.meta.lastUpdated = Date.now()
  setCurrentMelody({ ...current, items: updatedItems })
}

export function updateMelodyNote(
  id: number,
  updates: Partial<Pick<MelodyItem, 'startBeat' | 'duration' | 'note'>>,
): void {
  const current = currentMelody()
  if (current === null || current === undefined) return
  const items = current.items ?? []
  const key = current.id
  _melodyLibraryData.melodies[key] = {
    ...current,
    items: items.map((item) =>
      item.id === id ? { ...item, ...updates } : item,
    ),
    updatedAt: Date.now(),
  }
  _melodyLibraryData.meta.lastUpdated = Date.now()
  setCurrentMelody(
    currentMelody()?.id === key
      ? {
          ...current,
          items: items.map((item) =>
            item.id === id ? { ...item, ...updates } : item,
          ),
        }
      : current,
  )
}

export function loadMelody(key: string): MelodyData | null {
  const melody = _melodyLibraryData.melodies[key]
  if (melody !== null && melody !== undefined) {
    const playCount = 'playCount' in melody ? melody.playCount : 0
    _melodyLibraryData.melodies[key] = {
      ...melody,
      playCount: (playCount ?? 0) + 1,
      lastPlayed: Date.now(),
    }
    _melodyLibraryData.meta.lastUpdated = Date.now()
    setCurrentMelody(_melodyLibraryData.melodies[key])
    return _melodyLibraryData.melodies[key]
  }
  return null
}

export function updateMelody(
  key: string,
  updates: Partial<MelodyData>,
): MelodyData | undefined {
  const melody = _melodyLibraryData.melodies[key]
  if (melody !== undefined) {
    _melodyLibraryData.melodies[key] = {
      ...melody,
      ...updates,
      updatedAt: Date.now(),
    }
    _melodyLibraryData.meta.lastUpdated = Date.now()
    return _melodyLibraryData.melodies[key]
  }
  return undefined
}

export function deleteMelody(key: string): void {
  const { melodies, playlists } = _melodyLibraryData
  const { [key]: _removed, ...newMelodies } = melodies
  const newPlaylists: Record<
    string,
    {
      name: string
      melodyKeys: string[]
      created: number
    }
  > = { ...playlists }
  // Filter each playlist to remove references to the deleted melody
  for (const k in playlists) {
    newPlaylists[k as string] = {
      ...playlists[k as string],
      melodyKeys: playlists[k as string].melodyKeys.filter(
        (k2: string) => k2 !== key,
      ),
    }
  }
  Object.assign(_melodyLibraryData, {
    melodies: newMelodies,
    playlists: newPlaylists,
    meta: { ..._melodyLibraryData.meta, lastUpdated: Date.now() },
  })
  // If deleted melody is currently selected, clear it
  if (currentMelody()?.id === key) {
    setCurrentMelody(null)
  }
}

export function saveCurrentMelody(name?: string): MelodyData {
  const melody = currentMelody()
  if (melody === null) {
    return createNewMelody(name)
  }
  const key = melody.id
  _melodyLibraryData.melodies[key] = {
    ...melody,
    name: name ?? melody.name,
    updatedAt: Date.now(),
  }
  _melodyLibraryData.meta.lastUpdated = Date.now()
  return _melodyLibraryData.melodies[key]
}

export function getCurrentMelody(): MelodyData | null {
  return currentMelody()
}

export function getCurrentItems(): MelodyItem[] {
  return currentMelody()?.items ?? []
}

export function setMelody(items: MelodyItem[]): void {
  const key = currentMelody()?.id ?? createNewMelody().id
  const existing = currentMelody()
  if (existing !== null && existing !== undefined) {
    _melodyLibraryData.melodies[key] = {
      ...existing,
      items: [...items],
      updatedAt: Date.now(),
    }
    _melodyLibraryData.meta.lastUpdated = Date.now()
    setCurrentMelody({ ...existing, items: [...items], updatedAt: Date.now() })
  } else {
    const newMelody = {
      id: key,
      name: `Melody ${Object.keys(_melodyLibraryData.melodies).length + 1}`,
      bpm: DEFAULT_BPM,
      key: DEFAULT_KEY,
      scaleType: DEFAULT_SCALE_TYPE,
      octave: DEFAULT_OCTAVE,
      items: [...items],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    _melodyLibraryData.melodies[key] = newMelody
    _melodyLibraryData.meta.lastUpdated = Date.now()
    setCurrentMelody(newMelody)
  }
}

// ============================================================
// Scale Operations
// ============================================================

export function refreshScale(
  keyName: string,
  startOctave: number,
  scaleType: string,
): void {
  _setOctave(startOctave)
  setCurrentScale(buildMultiOctaveScale(keyName, startOctave, 2, scaleType))
}

export function setOctave(octave: number): void {
  _setOctave(octave)
}

export function setNumOctaves(num: number): void {
  setCurrentScale(
    buildMultiOctaveScale(DEFAULT_KEY, currentOctave(), num, 'major'),
  )
}

// ============================================================
// Playlist Operations
// ============================================================

export function createPlaylist(name: string): string {
  const id = `playlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  _melodyLibraryData.playlists[id] = {
    name,
    melodyKeys: [],
    created: Date.now(),
  }
  _melodyLibraryData.meta.lastUpdated = Date.now()
  return id
}

export function addMelodyToPlaylist(
  playlistId: string,
  melodyKey: string,
): void {
  const playlist = _melodyLibraryData.playlists[playlistId]
  if (playlist !== undefined) {
    playlist.melodyKeys.push(melodyKey)
    _melodyLibraryData.meta.lastUpdated = Date.now()
  }
}

export function removeMelodyFromPlaylist(
  playlistId: string,
  melodyKey: string,
): void {
  const playlist = _melodyLibraryData.playlists[playlistId]
  if (playlist !== undefined) {
    playlist.melodyKeys = playlist.melodyKeys.filter((k) => k !== melodyKey)
    _melodyLibraryData.meta.lastUpdated = Date.now()
  }
}

export function deletePlaylist(playlistId: string): void {
  delete _melodyLibraryData.playlists[playlistId]
  // If deleted playlist is currently selected, clear it
  if (currentMelody()?.id === playlistId) {
    setCurrentMelody(null)
  }
  _melodyLibraryData.meta.lastUpdated = Date.now()
}

// ============================================================
// Library Accessors
// ============================================================

export function getAllMelodies(): MelodyData[] {
  return Object.values(_melodyLibraryData.melodies)
}

export function getMelodyCount(): number {
  return Object.keys(_melodyLibraryData.melodies).length
}

export function getPlaylistCount(): number {
  return Object.keys(_melodyLibraryData.playlists).length
}

export function getPlaylists(): Record<
  string,
  {
    name: string
    melodyKeys: string[]
    created: number
  }
> {
  return { ..._melodyLibraryData.playlists }
}

export function getPlaylist(melodyKey: string):
  | {
      name: string
      melodyKeys: string[]
      created: number
    }
  | undefined {
  return _melodyLibraryData.playlists[melodyKey]
}

export function getMelody(id: string): MelodyData | undefined {
  return _melodyLibraryData.melodies[id]
}

// ============================================================
// Export Store
// ============================================================

export const melodyStore = {
  // Current melody operations
  currentMelody: getCurrentMelody,
  getCurrentMelody,
  setCurrentMelody,
  setMelody,
  getCurrentItems,

  // Melody note operations
  addMelodyNote,
  removeMelodyNote,
  updateMelodyNote,

  // Library operations
  createNewMelody,
  loadMelody,
  saveCurrentMelody,
  updateMelody,
  deleteMelody,
  getAllMelodies,
  getMelodyCount,
  getMelody,
  getMelodyLibrary,
  generateId,
  resetMelodyLibrary,

  // Scale - these are Signals
  currentScale,
  setCurrentScale,
  refreshScale,
  setOctave,
  setNumOctaves,
  currentOctave,

  // Playlist operations
  createPlaylist,
  addMelodyToPlaylist,
  removeMelodyFromPlaylist,
  deletePlaylist,
  getPlaylists,
  getPlaylist,
  getPlaylistCount,

  // Export library
  melodyLibrary: getMelodyLibrary,

  // User Sessions
  getSessions,
  saveSession,
  updateSession,
  deleteSession,
  getSession,
  updateUserSession,

  // Current Note Index
  currentNoteIndex,
  setCurrentNoteIndex,
}
