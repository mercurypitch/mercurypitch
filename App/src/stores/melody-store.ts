// ============================================================
// Melody Store — Melody items and scale data (in-memory)
// ============================================================

import { createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import { buildMultiOctaveScale } from '@/lib/scale-data'
import type {
  MelodyData,
  MelodyItem,
  MelodyLibrary,
  MelodyNote,
  SavedUserSession,
  ScaleDegree,
} from '@/types'
import { appStore } from './app-store'

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
      if (parsed !== null && typeof parsed === 'object' && 'melodies' in parsed) {
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

export const melodyLibrary = createStore<MelodyLibrary>(loadLibrary())

/** Reset the melody library store (used by tests) */
export function resetMelodyLibrary(): void {
  localStorage.removeItem(STORAGE_KEY_MELODY_LIBRARY)
  _idCounter = 100
  melodyLibrary({ melodies: {}, playlists: {}, meta: { author: 'User', version: '1.0', lastUpdated: Date.now() } })
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

const [userSessions, setUserSessions] = createSignal<SavedUserSession[]>(
  loadUserSessions(),
)

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

export function updateSession(id: string, updates: Partial<SavedUserSession>): void {
  setUserSessions((sessions) =>
    sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
  )
  saveUserSessions(userSessions())
}

export function deleteSession(id: string): void {
  setUserSessions((sessions) => sessions.filter((s) => s.id !== id))
  saveUserSessions(userSessions())
}

export function getSession(id: string): SavedUserSession | undefined {
  return userSessions().find((s) => s.id === id)
}

export const [currentMelody, setCurrentMelody] = createSignal<MelodyData | null>(
  null,
)

// ============================================================
// Melody Operations
// ============================================================

export function createNewMelody(name?: string, author?: string): MelodyData {
  const id = generateMelodyId()
  const newMelody: MelodyData = {
    id,
    name: name ?? `New Melody ${Object.keys(melodyLibrary().melodies).length + 1}`,
    author: author ?? 'User',
    bpm: DEFAULT_BPM,
    key: DEFAULT_KEY,
    scaleType: DEFAULT_SCALE_TYPE,
    octave: DEFAULT_OCTAVE,
    items: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  melodyLibrary.melodies[id] = newMelody
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

// ============================================================
// Melody Note Operations
// ============================================================

export function addMelodyNote(note: MelodyNote, startBeat: number, duration: number): void {
  const current = currentMelody()
  if (current === null || current === undefined) return
  const items = current.items ?? []
  const key = current.id
  melodyLibrary.melodies[key] = {
    ...current,
    items: [...items, { id: generateId(), note, startBeat, duration }],
    updatedAt: Date.now(),
  }
  melodyLibrary.meta.lastUpdated = Date.now()
  setCurrentMelody(melodyLibrary.melodies[key])
}

export function removeMelodyNote(id: number): void {
  const current = currentMelody()
  if (current === null || current === undefined) return
  const items = current.items ?? []
  const key = current.id
  melodyLibrary.melodies[key] = {
    ...current,
    items: items.filter((item) => item.id !== id),
    updatedAt: Date.now(),
  }
  melodyLibrary.meta.lastUpdated = Date.now()
  setCurrentMelody(melodyLibrary.melodies[key])
}

export function updateMelodyNote(
  id: number,
  updates: Partial<Pick<MelodyItem, 'startBeat' | 'duration' | 'note'>>,
): void {
  const current = currentMelody()
  if (current === null || current === undefined) return
  const items = current.items ?? []
  const key = current.id
  melodyLibrary.melodies[key] = {
    ...current,
    items: items.map((item) =>
      item.id === id ? { ...item, ...updates } : item,
    ),
    updatedAt: Date.now(),
  }
  melodyLibrary.meta.lastUpdated = Date.now()
  setCurrentMelody(melodyLibrary.melodies[key])
}

export function loadMelody(key: string): MelodyData | null {
  const melody = melodyLibrary.melodies[key]
  if (melody !== null && melody !== undefined) {
    setCurrentMelody(melody)
    // Increment play count
    const playCount = 'playCount' in melody ? melody.playCount : 0
    melodyLibrary.melodies[key] = {
      ...melody,
      playCount: playCount + 1,
    }
    melodyLibrary.meta.lastUpdated = Date.now()
    return melody
  }
  return null
}

export function updateMelody(key: string, updates: Partial<MelodyData>): void {
  melodyLibrary.melodies[key] = {
    ...melodyLibrary.melodies[key],
    ...updates,
    updatedAt: Date.now(),
  }
  melodyLibrary.meta.lastUpdated = Date.now()
}

export function deleteMelody(key: string): void {
  const { [key]: _removed, ...rest } = melodyLibrary.melodies
  melodyLibrary.melodies = rest
  // Remove from any playlists
  for (const playlistId in melodyLibrary.playlists) {
    melodyLibrary.playlists[playlistId].melodyKeys = melodyLibrary.playlists[
      playlistId
    ].melodyKeys.filter((k) => k !== key)
  }
  // If deleted melody is currently selected, clear it
  if (currentMelody()?.id === key) {
    setCurrentMelody(null)
  }
  melodyLibrary.meta.lastUpdated = Date.now()
}

export function saveCurrentMelody(name?: string): MelodyData {
  const melody = currentMelody()
  if (melody === null) {
    return createNewMelody(name)
  }
  const key = melody.id
  melodyLibrary.melodies[key] = {
    ...melody,
    name: name ?? melody.name,
    updatedAt: Date.now(),
  }
  melodyLibrary.meta.lastUpdated = Date.now()
  return { ...melodyLibrary.melodies[key] } as MelodyData
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
  melodyLibrary.melodies[key] = {
    ...existing ?? {
      id: key,
      name: `Melody ${Object.keys(melodyLibrary.melodies).length + 1}`,
      bpm: DEFAULT_BPM,
      key: DEFAULT_KEY,
      scaleType: DEFAULT_SCALE_TYPE,
      octave: DEFAULT_OCTAVE,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    items,
    updatedAt: Date.now(),
  }
  if (existing !== null && existing !== undefined) {
    setCurrentMelody(melodyLibrary.melodies[key])
  }
  melodyLibrary.meta.lastUpdated = Date.now()
}

// ============================================================
// Scale Operations
// ============================================================

export function refreshScale(
  keyName: string,
  startOctave: number,
  scaleType: string,
): void {
  setCurrentOctave(startOctave)
  setCurrentScale(buildMultiOctaveScale(keyName, startOctave, 2, scaleType))
}

export function setOctave(octave: number): void {
  setCurrentOctave(octave)
}

export function setNumOctaves(num: number): void {
  setCurrentScale(
    buildMultiOctaveScale(DEFAULT_KEY, currentOctave, num, appStore.scaleType()),
  )
}

// ============================================================
// Playlist Operations
// ============================================================

export function createPlaylist(name: string): string {
  const id = `playlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  melodyLibrary.playlists[id] = {
    name,
    melodyKeys: [],
    created: Date.now(),
  }
  melodyLibrary.meta.lastUpdated = Date.now()
  return id
}

export function addMelodyToPlaylist(playlistId: string, melodyKey: string): void {
  const playlist = melodyLibrary.playlists[playlistId]
  if (playlist === undefined) return

  melodyLibrary.playlists[playlistId].melodyKeys = [
    ...playlist.melodyKeys,
    melodyKey,
  ]
  melodyLibrary.meta.lastUpdated = Date.now()
}

export function removeMelodyFromPlaylist(playlistId: string, melodyKey: string): void {
  const playlist = melodyLibrary.playlists[playlistId]
  if (playlist === null) return

  melodyLibrary.playlists[playlistId].melodyKeys = playlist.melodyKeys.filter(
    (k) => k !== melodyKey,
  )
  melodyLibrary.meta.lastUpdated = Date.now()
}

export function deletePlaylist(playlistId: string): void {
  const { [playlistId]: _, ...rest } = melodyLibrary.playlists
  melodyLibrary.playlists = rest
  melodyLibrary.meta.lastUpdated = Date.now()
}

// ============================================================
// Library Accessors
// ============================================================

export function getMelodyLibrary(): MelodyLibrary {
  return melodyLibrary()
}

export function getAllMelodies(): MelodyData[] {
  return Object.values(melodyLibrary().melodies)
}

export function getMelodyCount(): number {
  return Object.keys(melodyLibrary().melodies).length
}

export function getPlaylistCount(): number {
  return Object.keys(melodyLibrary().playlists).length
}

export function getPlaylists(): Record<string, {
  name: string
  melodyKeys: string[]
  created: number
}> {
  return { ...melodyLibrary().playlists }
}

export function getPlaylist(melodyKey: string): {
  name: string
  melodyKeys: string[]
  created: number
} | undefined {
  return melodyLibrary().playlists[melodyKey]
}

export function getMelody(id: string): MelodyData | undefined {
  return melodyLibrary().melodies[id]
}

// ============================================================
// Export Store
// ============================================================

export const melodyStore = {
  // Current melody operations
  currentMelody: getCurrentMelody,
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

  // Export library
  melodyLibrary: getMelodyLibrary,
}