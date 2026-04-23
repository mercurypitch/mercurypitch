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
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.melodies = {}
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.playlists = {}
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.meta = {
    author: 'User',
    version: '1.0',
    lastUpdated: Date.now(),
  }
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
    name: name ?? `New Melody ${Object.keys(melodyLibrary.melodies).length + 1}`,
    author: author ?? 'User',
    bpm: DEFAULT_BPM,
    key: DEFAULT_KEY,
    scaleType: DEFAULT_SCALE_TYPE,
    octave: DEFAULT_OCTAVE,
    items: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.melodies[id] = newMelody
  setCurrentMelody(newMelody)
  return newMelody
}

const DEFAULT_KEY = 'C'
const DEFAULT_SCALE_TYPE = 'major'
const DEFAULT_OCTAVE = 4
const DEFAULT_BPM = 80

export const currentScale = createSignal<ScaleDegree[]>(
  buildMultiOctaveScale(DEFAULT_KEY, DEFAULT_OCTAVE, 2, DEFAULT_SCALE_TYPE),
)
export const currentOctave = createSignal<number>(DEFAULT_OCTAVE)

// ============================================================
// Melody Note Operations
// ============================================================

export function addMelodyNote(note: MelodyNote, startBeat: number, duration: number): void {
  const current = currentMelody()
  if (current === null || current === undefined) return
  const items = current.items ?? []
  const key = current.id
  const updatedMelody = {
    ...current,
    items: [...items, { id: generateId(), note, startBeat, duration }],
    updatedAt: Date.now(),
  }
  const updatedMelodies = {
    ...melodyLibrary.melodies.melodies,
    [key]: updatedMelody,
  }
  const updatedMeta = {
    ...melodyLibrary.melodies.meta,
    lastUpdated: Date.now(),
  }
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.melodies = updatedMelodies
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.meta = updatedMeta
  setCurrentMelody(updatedMelodies[key])
}

export function removeMelodyNote(id: number): void {
  const current = currentMelody()
  if (current === null || current === undefined) return
  const items = current.items ?? []
  const key = current.id
  const updatedMelody = {
    ...current,
    items: items.filter((item) => item.id !== id),
    updatedAt: Date.now(),
  }
  const updatedMelodies = {
    ...melodyLibrary.melodies.melodies,
    [key]: updatedMelody,
  }
  const updatedMeta = {
    ...melodyLibrary.melodies.meta,
    lastUpdated: Date.now(),
  }
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.melodies = updatedMelodies
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.meta = updatedMeta
  setCurrentMelody(updatedMelodies[key])
}

export function updateMelodyNote(
  id: number,
  updates: Partial<Pick<MelodyItem, 'startBeat' | 'duration' | 'note'>>,
): void {
  const current = currentMelody()
  if (current === null || current === undefined) return
  const items = current.items ?? []
  const key = current.id
  const updatedMelody = {
    ...current,
    items: items.map((item) =>
      item.id === id ? { ...item, ...updates } : item,
    ),
    updatedAt: Date.now(),
  }
  const updatedMelodies = {
    ...melodyLibrary.melodies.melodies,
    [key]: updatedMelody,
  }
  const updatedMeta = {
    ...melodyLibrary.melodies.meta,
    lastUpdated: Date.now(),
  }
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.melodies = updatedMelodies
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.meta = updatedMeta
  setCurrentMelody(updatedMelodies[key])
}

export function loadMelody(key: string): MelodyData | null {
  const melody = melodyLibrary.melodies.melodies[key]
  if (melody !== null && melody !== undefined) {
    setCurrentMelody(melody)
    // Increment play count
    const playCount = 'playCount' in melody ? melody.playCount : 0
    const updatedMelody = {
      ...melody,
      playCount: playCount + 1,
    }
    // @ts-expect-error - SolidJS store mutation
    melodyLibrary.melodies.melodies[key] = updatedMelody
    // @ts-expect-error - SolidJS store mutation
    melodyLibrary.melodies.meta.lastUpdated = Date.now()
    return melody
  }
  return null
}

export function updateMelody(key: string, updates: Partial<MelodyData>): void {
  const existing = melodyLibrary.melodies.melodies[key]
  if (existing === null || existing === undefined) return
  const updated = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  }
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.melodies[key] = updated
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.meta.lastUpdated = Date.now()
}

export function deleteMelody(key: string): void {
  const { [key]: _removed, ...rest } = melodyLibrary.melodies.melodies
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.melodies = rest
  // Remove from any playlists
  for (const playlistId in melodyLibrary.melodies.playlists) {
    // @ts-expect-error - SolidJS store mutation
    melodyLibrary.melodies.playlists[playlistId].melodyKeys = melodyLibrary.melodies.playlists[
      playlistId
    ].melodyKeys.filter((k) => k !== key)
  }
  // If deleted melody is currently selected, clear it
  if (currentMelody()?.id === key) {
    setCurrentMelody(null)
  }
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.meta.lastUpdated = Date.now()
}

export function saveCurrentMelody(name?: string): MelodyData {
  const melody = currentMelody()
  if (melody === null) {
    return createNewMelody(name)
  }
  const key = melody.id
  const updated = {
    ...melody,
    name: name ?? melody.name,
    updatedAt: Date.now(),
  }
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.melodies[key] = updated
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.meta.lastUpdated = Date.now()
  return { ...melodyLibrary.melodies.melodies[key] } as MelodyData
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
  const updatedMelody = {
    ...existing ?? {
      id: key,
      name: `Melody ${Object.keys(melodyLibrary.melodies.melodies).length + 1}`,
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
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.melodies[key] = updatedMelody
  if (existing !== null && existing !== undefined) {
    setCurrentMelody(melodyLibrary.melodies.melodies[key] as MelodyData)
  }
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.meta.lastUpdated = Date.now()
}

// ============================================================
// Scale Operations
// ============================================================

export function refreshScale(
  keyName: string,
  startOctave: number,
  scaleType: string,
): void {
  currentOctave.set(startOctave)
  currentScale.set(buildMultiOctaveScale(keyName, startOctave, 2, scaleType))
}

export function setOctave(octave: number): void {
  currentOctave.set(octave)
}

export function setCurrentOctave(octave: number): void {
  currentOctave.set(octave)
}

export function setNumOctaves(num: number): void {
  currentScale.set(
    buildMultiOctaveScale(DEFAULT_KEY, currentOctave(), num, appStore.scaleType()),
  )
}

// ============================================================
// Playlist Operations
// ============================================================

export function createPlaylist(name: string): string {
  const id = `playlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.playlists[id] = {
    name,
    melodyKeys: [],
    created: Date.now(),
  }
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.meta.lastUpdated = Date.now()
  return id
}

export function addMelodyToPlaylist(playlistId: string, melodyKey: string): void {
  const playlist = melodyLibrary.melodies.playlists[playlistId]
  if (playlist === undefined) return

  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.playlists[playlistId].melodyKeys = [
    ...playlist.melodyKeys,
    melodyKey,
  ]
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.meta.lastUpdated = Date.now()
}

export function removeMelodyFromPlaylist(playlistId: string, melodyKey: string): void {
  const playlist = melodyLibrary.melodies.playlists[playlistId]
  if (playlist === null) return

  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.playlists[playlistId].melodyKeys = playlist.melodyKeys.filter(
    (k) => k !== melodyKey,
  )
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.meta.lastUpdated = Date.now()
}

export function deletePlaylist(playlistId: string): void {
  const { [playlistId]: _, ...rest } = melodyLibrary.melodies.playlists
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.playlists = rest
  // @ts-expect-error - SolidJS store mutation
  melodyLibrary.melodies.meta.lastUpdated = Date.now()
}

// ============================================================
// Library Accessors
// ============================================================

export function getMelodyLibrary(): MelodyLibrary {
  return {
    meta: melodyLibrary.melodies.meta,
    renderSettings: melodyLibrary.melodies.renderSettings,
    melodies: melodyLibrary.melodies.melodies,
    playlists: melodyLibrary.melodies.playlists,
  }
}

export function getAllMelodies(): MelodyData[] {
  return Object.values(melodyLibrary.melodies.melodies)
}

export function getMelodyCount(): number {
  return Object.keys(melodyLibrary.melodies.melodies).length
}

export function getPlaylistCount(): number {
  return Object.keys(melodyLibrary.melodies.playlists).length
}

export function getPlaylists(): Record<string, {
  name: string
  melodyKeys: string[]
  created: number
}> {
  return { ...melodyLibrary.melodies.playlists }
}

export function getPlaylist(melodyKey: string): {
  name: string
  melodyKeys: string[]
  created: number
} | undefined {
  return melodyLibrary.melodies.playlists[melodyKey]
}

export function getMelody(id: string): MelodyData | undefined {
  return melodyLibrary.melodies.melodies[id]
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

  // Scale
  currentScale,
  refreshScale,
  setOctave,
  setNumOctaves,
  currentOctave,
  setCurrentOctave,

  // Playlist operations
  createPlaylist,
  addMelodyToPlaylist,
  removeMelodyFromPlaylist,
  deletePlaylist,
  getPlaylists,
  getPlaylist,

  // Export library for access - need raw store for direct mutation
  melodyLibrary,
}