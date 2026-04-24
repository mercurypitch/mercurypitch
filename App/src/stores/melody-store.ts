// ============================================================
// Melody Store — Melody items and scale data (in-memory)
// ============================================================

import { createSignal } from 'solid-js'
import { buildMultiOctaveScale } from '@/lib/scale-data'
import type { MelodyData, MelodyItem, MelodyLibrary, MelodyNote, SavedUserSession, ScaleDegree, UserSession, } from '@/types'

const STORAGE_KEY_MELODY_LIBRARY = 'pitchperfect_melody_library'
const STORAGE_KEY_USER_SESSIONS = 'pitchperfect_user_sessions'
const STORAGE_KEY_NEW_SESSIONS = 'pitchperfect_sessions'
const STORAGE_KEY_DEFAULT_SESSION = 'pitchperfect_default_session'
const STORAGE_KEY_SEEDED = 'pitchperfect_seeded'

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

// ============================================================
// New Session Model (playlist of melody IDs)
// ============================================================

function loadNewSessions(): Record<string, UserSession> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_NEW_SESSIONS)
    if (stored !== null && stored !== '') {
      const parsed = JSON.parse(stored)
      if (parsed !== null && typeof parsed === 'object') return parsed
    }
  } catch {
    // Fail silently
  }
  return {}
}

function saveNewSessions(sessions: Record<string, UserSession>): void {
  try {
    localStorage.setItem(STORAGE_KEY_NEW_SESSIONS, JSON.stringify(sessions))
  } catch {
    // Fail silently
  }
}

export function getNewSessions(): Record<string, UserSession> {
  return loadNewSessions()
}

export function getNewSession(id: string): UserSession | undefined {
  return loadNewSessions()[id]
}

export function saveNewSession(session: UserSession): void {
  const sessions = loadNewSessions()
  sessions[session.id] = session
  saveNewSessions(sessions)
}

export function deleteNewSession(id: string): void {
  const sessions = loadNewSessions()
  delete sessions[id]
  saveNewSessions(sessions)
}

export function addMelodyToSession(sessionId: string, melodyId: string): void {
  const sessions = loadNewSessions()
  const session = sessions[sessionId]
  if (session !== undefined && !session.melodyIds.includes(melodyId)) {
    sessions[sessionId] = {
      ...session,
      melodyIds: [...session.melodyIds, melodyId],
    }
    saveNewSessions(sessions)
  }
}

export function removeMelodyFromSession(
  sessionId: string,
  melodyId: string,
): void {
  const sessions = loadNewSessions()
  const session = sessions[sessionId]
  if (session !== undefined) {
    sessions[sessionId] = {
      ...session,
      melodyIds: session.melodyIds.filter((id) => id !== melodyId),
    }
    saveNewSessions(sessions)
  }
}

export function reorderSessionMelodies(
  sessionId: string,
  melodyIds: string[],
): void {
  const sessions = loadNewSessions()
  const session = sessions[sessionId]
  if (session !== undefined) {
    sessions[sessionId] = { ...session, melodyIds }
    saveNewSessions(sessions)
  }
}

export function getActiveSessionId(): string {
  return localStorage.getItem(STORAGE_KEY_DEFAULT_SESSION) ?? 'default'
}

export function setActiveSessionId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_DEFAULT_SESSION, id)
  } catch {
    // Fail silently
  }
}

// ============================================================
// Default Session — seeded on first launch
// ============================================================

function buildScaleMelody(
  id: string,
  name: string,
  key: string,
  scaleType: string,
  octave: number,
  degrees: number[],
): MelodyData {
  const items: MelodyItem[] = degrees.map((semitone, i) => ({
    id: generateId(),
    note: {
      midi: 60 + semitone + (i > 0 && degrees[i] < degrees[i - 1] ? 12 : 0),
      name: NOTE_NAMES[(60 + semitone) % 12] as MelodyNote['name'],
      octave: 4 + (i > 0 && degrees[i] < degrees[i - 1] ? 1 : 0),
      freq: midiToFreq(60 + semitone + (i > 0 && degrees[i] < degrees[i - 1] ? 12 : 0)),
    },
    duration: 1,
    startBeat: i,
  }))
  return {
    id,
    name,
    author: 'System',
    bpm: 80,
    key,
    scaleType,
    octave,
    items,
    createdAt: 0,
    updatedAt: 0,
  }
}

const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

const SCALE_DEGREES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  'natural-minor': [0, 2, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
}

export function seedDefaultSession(): void {
  try {
    const seeded = localStorage.getItem(STORAGE_KEY_SEEDED)
    if (seeded === 'true') return
  } catch {
    // Continue
  }

  // Create pre-built scale melodies
  const scaleConfigs = [
    { id: 'scale-major-c4', name: 'C Major Scale', key: 'C', scaleType: 'major', octave: 4, degrees: SCALE_DEGREES.major },
    { id: 'scale-major-g4', name: 'G Major Scale', key: 'G', scaleType: 'major', octave: 4, degrees: SCALE_DEGREES.major },
    { id: 'scale-chromatic-c4', name: 'Chromatic Scale', key: 'C', scaleType: 'chromatic', octave: 4, degrees: SCALE_DEGREES.chromatic },
    { id: 'scale-minor-a4', name: 'A Minor Scale', key: 'A', scaleType: 'natural-minor', octave: 4, degrees: SCALE_DEGREES['natural-minor'] },
    { id: 'scale-pentatonic-c4', name: 'C Pentatonic', key: 'C', scaleType: 'pentatonic', octave: 4, degrees: SCALE_DEGREES.pentatonic },
    { id: 'scale-dorian-d4', name: 'D Dorian', key: 'D', scaleType: 'dorian', octave: 4, degrees: SCALE_DEGREES.dorian },
  ]

  for (const cfg of scaleConfigs) {
    if (_melodyLibraryData.melodies[cfg.id] === undefined) {
      _melodyLibraryData.melodies[cfg.id] = buildScaleMelody(
        cfg.id, cfg.name, cfg.key, cfg.scaleType, cfg.octave, cfg.degrees,
      )
    }
  }

  // Create default session
  const defaultSession: UserSession = {
    id: 'default',
    name: 'Default',
    melodyIds: ['scale-major-c4', 'scale-chromatic-c4'],
    created: 0,
  }
  const sessions = loadNewSessions()
  if (sessions['default'] === undefined) {
    sessions['default'] = defaultSession
  }
  saveNewSessions(sessions)

  try {
    localStorage.setItem(STORAGE_KEY_SEEDED, 'true')
  } catch {
    // Fail silently
  }
}

export function createMelodyFromScale(
  name: string,
  key: string,
  scaleType: string,
  octave: number,
  bpm: number,
  degrees: number[],
): MelodyData {
  const id = generateMelodyId()
  const items: MelodyItem[] = degrees.map((semitone, i) => ({
    id: generateId(),
    note: {
      midi: 60 + semitone + (i > 0 && degrees[i] < degrees[i - 1] ? 12 : 0),
      name: NOTE_NAMES[(60 + semitone) % 12] as MelodyNote['name'],
      octave: 4 + (i > 0 && degrees[i] < degrees[i - 1] ? 1 : 0),
      freq: midiToFreq(60 + semitone + (i > 0 && degrees[i] < degrees[i - 1] ? 12 : 0)),
    },
    duration: 1,
    startBeat: i,
  }))
  const melody: MelodyData = {
    id,
    name,
    author: 'User',
    bpm,
    key,
    scaleType,
    octave,
    items,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  _melodyLibraryData.melodies[id] = melody
  _melodyLibraryData.meta.lastUpdated = Date.now()
  return melody
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
  items: getCurrentItems,

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

  // New Session Model (melody IDs)
  getNewSessions,
  getNewSession,
  saveNewSession,
  deleteNewSession,
  addMelodyToSession,
  removeMelodyFromSession,
  reorderSessionMelodies,
  getActiveSessionId,
  setActiveSessionId,
  seedDefaultSession,
  createMelodyFromScale,

  // Current Note Index
  currentNoteIndex,
  setCurrentNoteIndex,
}
