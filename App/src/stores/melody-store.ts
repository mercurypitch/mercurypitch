// ============================================================
// Melody Store — Melody items and scale data (in-memory)
// ============================================================

import { createSignal } from 'solid-js'
import { buildMultiOctaveScale } from '@/lib/scale-data'
import type {
  MelodyData,
  MelodyItem,
  MelodyNote,
  SavedUserSession,
  ScaleDegree,
  UnifiedLibrary,
} from '@/types'
import {
  addItemToSession,
  deleteSession as deleteSessionStore,
  deleteSessionItem,
  generateSessionItemId,
  getDefaultSession,
  getInternalSession,
  getItemsAtBeat,
  getSession as getSessionStore,
  getSessionCount,
  getSessionItem,
  getSessionItems,
  getSessionItemsOrdered,
  getSessions as getSessionStoreSessions,
  getUserSessionCount,
  saveSession as saveSessionStore,
  updateSessionItem,
} from './session-store'

const STORAGE_KEY_LIBRARY = 'pitchperfect_library'
const STORAGE_KEY_SEEDED = 'pitchperfect_seeded'
const STORAGE_KEY_ACTIVE_SESSION_ID = 'pitchperfect_active_session_id'
const STORAGE_KEY_CURRENT_MELODY_ID = 'pitchperfect_current_melody_id'

const DEFAULT_LIBRARY: UnifiedLibrary = {
  meta: {
    author: 'User',
    version: '2.0',
    lastUpdated: Date.now(),
  },
  renderSettings: {
    gridlines: true,
    showLabels: true,
    showNumbers: false,
  },
  melodies: {},
  playlists: {},
  sessions: {
    'default': {
      id: 'default',
      name: 'Default Session',
      author: 'System',
      deletable: false,
      items: [
        {
          id: generateSessionItemId(),
          type: 'melody',
          startBeat: 0,
          label: 'C Major Scale',
          melodyId: 'scale-major-c4', // Reference to pre-built C Major scale melody
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
      ],
      created: Date.now(),
      lastPlayed: undefined,
    },
  },
}

function loadLibrary(): UnifiedLibrary {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LIBRARY)
    if (stored !== null && stored !== '') {
      const parsed = JSON.parse(stored) as unknown
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'melodies' in parsed &&
        'sessions' in parsed
      ) {
        // Ensure default session exists
        const library = parsed as UnifiedLibrary
        if (library.sessions['default'] === null || library.sessions['default'] === undefined) {
          const defaultSession = getDefaultSession()
          if (defaultSession !== null) {
            library.sessions['default'] = defaultSession
          }
        }
        return library
      }
    }
  } catch {
    // Fail silently, use default
  }
  return DEFAULT_LIBRARY
}

function _saveLibraryToStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(melodyLibrarySignal()))
  } catch {
    // Fail silently
  }
}

let _idCounter = 100

function generateMelodyId(): string {
  return `melody-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function generateId(): number {
  return ++_idCounter
}

// Use a signal for the library to maintain SolidJS reactivity
const [melodyLibrarySignal, setMelodyLibrary] = createSignal<UnifiedLibrary>(
  loadLibrary(),
)

// Restore active session and current melody from localStorage
_restoreActiveSessionId()
_restoreCurrentMelodyId()

/** Get the melody library data (reactive) */
export function getMelodyLibrary(): UnifiedLibrary {
  return melodyLibrarySignal()
}

/** Get the melody library signal directly (for internal use) */
export function getMelodyLibrarySignal(): typeof melodyLibrarySignal {
  return melodyLibrarySignal
}

/** Update the melody library (for reactive updates) */
export function _setMelodyLibrary(updates: Partial<UnifiedLibrary>): void {
  setMelodyLibrary((prev) => ({
    ...prev,
    ...updates,
    meta: { ...prev.meta, lastUpdated: Date.now() },
  }))
}

/** Reset the melody library store (used by tests) */
export function resetMelodyLibrary(): void {
  localStorage.removeItem(STORAGE_KEY_LIBRARY)
  localStorage.removeItem(STORAGE_KEY_SEEDED)
  localStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION_ID)
  localStorage.removeItem(STORAGE_KEY_CURRENT_MELODY_ID)
  _idCounter = 100
  const defaultLibrary: UnifiedLibrary = {
    melodies: {},
    playlists: {},
    sessions: {},
    meta: { author: 'User', version: '2.0', lastUpdated: Date.now() },
    renderSettings: { gridlines: true, showLabels: true, showNumbers: false },
  }
  setMelodyLibrary(defaultLibrary)
}

// ============================================================
// Session Operations — Delegate to session-store
// ============================================================

export function getSessions(): SavedUserSession[] {
  return getSessionStoreSessions()
}

/** Get the currently active session by ID */
export function getActiveSession(): SavedUserSession | undefined {
  const sessionId = getActiveSessionId()
  if (sessionId === null) return undefined
  return getSession(sessionId)
}

export function saveSession(session: SavedUserSession): void {
  saveSessionStore(session)
}

export function updateSession(
  id: string,
  updates: Partial<SavedUserSession>,
): void {
  const session = getSessionStore(id)
  if (session) {
    saveSessionStore({ ...session, ...updates })
  }
}

export function deleteSession(id: string): void {
  deleteSessionStore(id)
}

export function updateUserSession(session: SavedUserSession): void {
  saveSessionStore(session)
}

export function getSession(id: string): SavedUserSession | undefined {
  return getSessionStore(id)
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
      freq: midiToFreq(
        60 + semitone + (i > 0 && degrees[i] < degrees[i - 1] ? 12 : 0),
      ),
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
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
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
  // Create pre-built scale melodies
  const scaleConfigs = [
    {
      id: 'scale-major-c4',
      name: 'C Major Scale',
      key: 'C',
      scaleType: 'major',
      octave: 4,
      degrees: SCALE_DEGREES.major,
    },
    {
      id: 'scale-major-g4',
      name: 'G Major Scale',
      key: 'G',
      scaleType: 'major',
      octave: 4,
      degrees: SCALE_DEGREES.major,
    },
    {
      id: 'scale-chromatic-c4',
      name: 'Chromatic Scale',
      key: 'C',
      scaleType: 'chromatic',
      octave: 4,
      degrees: SCALE_DEGREES.chromatic,
    },
    {
      id: 'scale-minor-a4',
      name: 'A Minor Scale',
      key: 'A',
      scaleType: 'natural-minor',
      octave: 4,
      degrees: SCALE_DEGREES['natural-minor'],
    },
    {
      id: 'scale-pentatonic-c4',
      name: 'C Pentatonic',
      key: 'C',
      scaleType: 'pentatonic',
      octave: 4,
      degrees: SCALE_DEGREES.pentatonic,
    },
    {
      id: 'scale-dorian-d4',
      name: 'D Dorian',
      key: 'D',
      scaleType: 'dorian',
      octave: 4,
      degrees: SCALE_DEGREES.dorian,
    },
  ]

  const library = melodyLibrarySignal()
  let hasAddedMelodies = false
  const newMelodies = { ...library.melodies }

  for (const cfg of scaleConfigs) {
    if (newMelodies[cfg.id] === undefined) {
      newMelodies[cfg.id] = buildScaleMelody(
        cfg.id,
        cfg.name,
        cfg.key,
        cfg.scaleType,
        cfg.octave,
        cfg.degrees,
      )
      hasAddedMelodies = true
    }
  }

  // Seed default session if not exists
  const defaultSession = getSessionStore('default')
  if (!defaultSession) {
    const session = getDefaultSession()
    if (session) {
      saveSessionStore(session)
    }
  }

  // Add default session to unified library
  const defaultSessionFromLibrary = getSessionStore('default')
  if (defaultSessionFromLibrary) {
    setMelodyLibrary((prev) => ({
      ...prev,
      melodies: newMelodies, // ensure we use newMelodies
      sessions: {
        ...prev.sessions,
        'default': defaultSessionFromLibrary,
      },
      meta: { ...prev.meta, lastUpdated: Date.now() },
    }))
    _saveLibraryToStorage()
  } else {
    // If we couldn't get it from the store (which shouldn't happen, but just in case)
    // we still need to update the melodies
    setMelodyLibrary((prev) => ({
      ...prev,
      melodies: newMelodies,
      meta: { ...prev.meta, lastUpdated: Date.now() },
    }))
    _saveLibraryToStorage()
  }

  // Persist library to localStorage
  _saveLibraryToStorage()

  if (currentMelody() === null && newMelodies['scale-major-c4'] !== undefined) {
    setCurrentMelody(newMelodies['scale-major-c4'])
  }

  try {
    localStorage.setItem(STORAGE_KEY_SEEDED, 'true')
  } catch {
    // Fail silently
  }

  if (!hasAddedMelodies) return
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
      freq: midiToFreq(
        60 + semitone + (i > 0 && degrees[i] < degrees[i - 1] ? 12 : 0),
      ),
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
  const _library = melodyLibrarySignal()
  setMelodyLibrary((prev) => ({
    ...prev,
    melodies: { ...prev.melodies, [id]: melody },
    meta: { ...prev.meta, lastUpdated: Date.now() },
  }))
  _saveLibraryToStorage()
  return melody
}

// Current melody with localStorage persistence
const [_currentMelodySignal, _setCurrentMelodySignal] =
  createSignal<MelodyData | null>(null)

export const currentMelody = _currentMelodySignal

function _restoreCurrentMelodyId(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CURRENT_MELODY_ID)
    if (saved !== null) {
      const melody = melodyLibrarySignal().melodies[saved]
      if (melody !== undefined && melody !== null) {
        _setCurrentMelodySignal(melody)
        console.info('[melodyStore] Restored currentMelodyId:', saved)
      }
    }
  } catch {
    // Ignore
  }
}

export const setCurrentMelody = (m: MelodyData | null) => {
  _setCurrentMelodySignal(m)
  try {
    if (m !== null && m !== undefined) {
      localStorage.setItem(STORAGE_KEY_CURRENT_MELODY_ID, m.id)
      console.info('[melodyStore] setCurrentMelody:', m.id)
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_MELODY_ID)
    }
  } catch {
    // Ignore
  }
}

// ============================================================
// Melody Operations
// ============================================================

export function createNewMelody(name?: string, author?: string): MelodyData {
  const id = generateMelodyId()
  const library = melodyLibrarySignal()
  const newMelody: MelodyData = {
    id,
    name:
      name ??
      `New Melody ${Object.keys(library.melodies).length + 1}`,
    author: author ?? 'User',
    bpm: DEFAULT_BPM,
    key: DEFAULT_KEY,
    scaleType: DEFAULT_SCALE_TYPE,
    octave: DEFAULT_OCTAVE,
    items: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  setMelodyLibrary((prev) => ({
    ...prev,
    melodies: { ...prev.melodies, [id]: newMelody },
    meta: { ...prev.meta, lastUpdated: Date.now() },
  }))
  _saveLibraryToStorage()
  setCurrentMelody(newMelody)
  return newMelody
}

function getSessionEndBeat(session: SavedUserSession): number {
  if (session.items.length === 0) return 0

  return session.items.reduce((maxBeat, item) => {
    const itemLength =
      item.type === 'rest'
        ? Math.max(1, Math.ceil((item.restMs ?? 4000) / 1000))
        : item.beats ?? 16
    return Math.max(maxBeat, item.startBeat + itemLength)
  }, 0)
}

/**
 * Append a melody reference to the currently active session.
 * If no active session is set, the seeded Default Session becomes active.
 */
export function addMelodyToActiveSession(
  melodyId: string,
  label?: string,
): SavedUserSession | undefined {
  let session = getActiveSession()

  if (session === undefined) {
    session = getDefaultSession() ?? undefined
    if (session !== undefined) {
      setActiveSessionId(session.id)
    }
  }

  if (session === undefined) return undefined

  const melody = getMelody(melodyId)
  return addItemToSession(session.id, {
    type: 'melody',
    label: label ?? melody?.name ?? 'Melody',
    melodyId,
    startBeat: getSessionEndBeat(session),
  })
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

// Octave state - use function wrapper to avoid circular dependencies
let _octave = DEFAULT_OCTAVE

export const getCurrentOctave = (): number => {
  return _octave
}

export const setCurrentOctave = (octave: number): void => {
  _octave = octave
}

export const setOctave = (octave: number): void => {
  _octave = octave
}

const _currentNoteIndex = createSignal<number>(0)
export const currentNoteIndex = _currentNoteIndex[0]
export const setCurrentNoteIndex = _currentNoteIndex[1]

// Active session ID tracking
const _activeSessionId = createSignal<string | null>(null)
export const getActiveSessionId = _activeSessionId[0]

function _restoreActiveSessionId(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_SESSION_ID)
    if (saved !== null) {
      setActiveSessionId(saved)
      console.info('[melodyStore] Restored activeSessionId:', saved)
    }
  } catch {
    // Ignore
  }
}

export const setActiveSessionId = (id: string | null) => {
  _activeSessionId[1](id)
  try {
    if (id !== null) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_SESSION_ID, id)
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION_ID)
    }
    console.info('[melodyStore] setActiveSessionId:', id)
  } catch {
    // Ignore
  }
}

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

  const _library = melodyLibrarySignal()
  setMelodyLibrary((prev) => ({
    ...prev,
    melodies: {
      ...prev.melodies,
      [key]: {
        ...current,
        items: [...items, newItem],
        updatedAt: Date.now(),
      },
    },
    meta: { ...prev.meta, lastUpdated: Date.now() },
  }))
  _saveLibraryToStorage()
  setCurrentMelody({ ...current, items: [...items, newItem] })
  return newItem.id
}

export function removeMelodyNote(id: number): void {
  const current = currentMelody()
  if (current === null || current === undefined) return
  const items = current.items ?? []
  const key = current.id
  const updatedItems = items.filter((item) => item.id !== id)

  setMelodyLibrary((prev) => ({
    ...prev,
    melodies: {
      ...prev.melodies,
      [key]: {
        ...current,
        items: updatedItems,
        updatedAt: Date.now(),
      },
    },
    meta: { ...prev.meta, lastUpdated: Date.now() },
  }))
  _saveLibraryToStorage()
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
  const updatedItems = items.map((item) =>
    item.id === id ? { ...item, ...updates } : item,
  )

  setMelodyLibrary((prev) => ({
    ...prev,
    melodies: {
      ...prev.melodies,
      [key]: {
        ...current,
        items: updatedItems,
        updatedAt: Date.now(),
      },
    },
    meta: { ...prev.meta, lastUpdated: Date.now() },
  }))
  _saveLibraryToStorage()
  setCurrentMelody(
    currentMelody()?.id === key
      ? {
          ...current,
          items: updatedItems,
        }
      : current,
  )
}

export function loadMelody(key: string): MelodyData | null {
  const library = melodyLibrarySignal()
  const melody = library.melodies[key]
  if (melody !== null && melody !== undefined) {
    const playCount = 'playCount' in melody ? melody.playCount : 0
    const updatedMelody = {
      ...melody,
      playCount: (playCount ?? 0) + 1,
      lastPlayed: Date.now(),
    }
    setMelodyLibrary((prev) => ({
      ...prev,
      melodies: {
        ...prev.melodies,
        [key]: updatedMelody,
      },
      meta: { ...prev.meta, lastUpdated: Date.now() },
    }))
    _saveLibraryToStorage()
    setCurrentMelody(updatedMelody)

    return updatedMelody
  }
  return null
}

export function getMelodyFromLibraryByName(name: string): MelodyData | null {
  const library = melodyLibrarySignal()
  for (const key in library.melodies) {
    if (library.melodies[key]?.name === name) {
      return library.melodies[key]
    }
  }
  return null
}

export function updateMelody(
  key: string,
  updates: Partial<MelodyData>,
): MelodyData | undefined {
  const library = melodyLibrarySignal()
  const melody = library.melodies[key]
  if (melody !== undefined) {
    const updatedMelody = { ...melody, ...updates, updatedAt: Date.now() }
    setMelodyLibrary((prev) => ({
      ...prev,
      melodies: {
        ...prev.melodies,
        [key]: updatedMelody,
      },
      meta: { ...prev.meta, lastUpdated: Date.now() },
    }))
    _saveLibraryToStorage()
    return updatedMelody
  }
  return undefined
}

export function deleteMelody(key: string): void {
  const _library = melodyLibrarySignal()
  const { melodies, playlists } = _library
  const { [key]: _removed, ...newMelodies } = melodies
  const newPlaylists: Record<string, { name: string; melodyKeys: string[]; sessionKeys: string[]; created: number }> = {}

  // Filter each playlist to remove references to the deleted melody
  for (const playlistId in playlists) {
    const playlist = playlists[playlistId] as {
      name: string
      melodyKeys: string[]
      sessionKeys?: string[]
      created: number
    }
    newPlaylists[playlistId] = {
      name: playlist.name,
      melodyKeys: playlist.melodyKeys.filter((k2: string) => k2 !== key),
      sessionKeys: playlist.sessionKeys || [],
      created: playlist.created,
    }
  }
  setMelodyLibrary((prev) => ({
    ...prev,
    melodies: newMelodies,
    playlists: newPlaylists,
    meta: { ...prev.meta, lastUpdated: Date.now() },
  }))
  _saveLibraryToStorage()
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
  const _library = melodyLibrarySignal()
  const updatedMelody = { ...melody, name: name ?? melody.name, updatedAt: Date.now() }
  setMelodyLibrary((prev) => ({
    ...prev,
    melodies: {
      ...prev.melodies,
      [key]: updatedMelody,
    },
    meta: { ...prev.meta, lastUpdated: Date.now() },
  }))
  _saveLibraryToStorage()
  return updatedMelody
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
  const _library = melodyLibrarySignal()

  if (existing !== null && existing !== undefined) {
    setMelodyLibrary((prev) => ({
      ...prev,
      melodies: {
        ...prev.melodies,
        [key]: {
          ...existing,
          items: [...items],
          updatedAt: Date.now(),
        },
      },
      meta: { ...prev.meta, lastUpdated: Date.now() },
    }))
    _saveLibraryToStorage()
    setCurrentMelody({ ...existing, items: [...items], updatedAt: Date.now() })
  } else {
    const newMelody = {
      id: key,
      name: `Melody ${Object.keys(_library.melodies).length + 1}`,
      bpm: DEFAULT_BPM,
      key: DEFAULT_KEY,
      scaleType: DEFAULT_SCALE_TYPE,
      octave: DEFAULT_OCTAVE,
      items: [...items],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setMelodyLibrary((prev) => ({
      ...prev,
      melodies: {
        ...prev.melodies,
        [key]: newMelody,
      },
      meta: { ...prev.meta, lastUpdated: Date.now() },
    }))
    _saveLibraryToStorage()
    setCurrentMelody(newMelody)
    if (getActiveSessionId() !== null) {
      addMelodyToActiveSession(newMelody.id, newMelody.name)
    }
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
  setOctave(startOctave)
  setCurrentScale(buildMultiOctaveScale(keyName, startOctave, 2, scaleType))
}

export function setNumOctaves(num: number): void {
  setCurrentScale(
    buildMultiOctaveScale(DEFAULT_KEY, getCurrentOctave(), num, 'major'),
  )
}

// ============================================================
// Playlist Operations
// ============================================================

export function createPlaylist(name: string): string {
  const id = `playlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const _library = melodyLibrarySignal()
  setMelodyLibrary((prev) => ({
    ...prev,
    playlists: {
      ...prev.playlists,
      [id]: {
        name,
        melodyKeys: [],
        sessionKeys: [],
        created: Date.now(),
      },
    },
    meta: { ...prev.meta, lastUpdated: Date.now() },
  }))
  _saveLibraryToStorage()
  return id
}

export function addMelodyToPlaylist(
  playlistId: string,
  melodyKey: string,
): void {
  const _library = melodyLibrarySignal()
  const playlist = _library.playlists[playlistId]
  if (playlist !== undefined) {
    const updatedPlaylists = {
      ..._library.playlists,
      [playlistId]: {
        ...playlist,
        melodyKeys: [...playlist.melodyKeys, melodyKey],
      },
    }
    setMelodyLibrary((prev) => ({
      ...prev,
      playlists: updatedPlaylists,
      meta: { ...prev.meta, lastUpdated: Date.now() },
    }))
    _saveLibraryToStorage()
  }
}

export function removeMelodyFromPlaylist(
  playlistId: string,
  melodyKey: string,
): void {
  const _library = melodyLibrarySignal()
  const playlist = _library.playlists[playlistId]
  if (playlist !== undefined) {
    const updatedPlaylists = {
      ..._library.playlists,
      [playlistId]: {
        ...playlist,
        melodyKeys: playlist.melodyKeys.filter((k) => k !== melodyKey),
      },
    }
    setMelodyLibrary((prev) => ({
      ...prev,
      playlists: updatedPlaylists,
      meta: { ...prev.meta, lastUpdated: Date.now() },
    }))
    _saveLibraryToStorage()
  }
}

export function addSessionToPlaylist(
  playlistId: string,
  sessionId: string,
): void {
  const _library = melodyLibrarySignal()
  const playlist = _library.playlists[playlistId]
  if (playlist !== undefined) {
    const updatedPlaylists = {
      ..._library.playlists,
      [playlistId]: {
        ...playlist,
        sessionKeys: [...playlist.sessionKeys, sessionId],
      },
    }
    setMelodyLibrary((prev) => ({
      ...prev,
      playlists: updatedPlaylists,
      meta: { ...prev.meta, lastUpdated: Date.now() },
    }))
    _saveLibraryToStorage()
  }
}

export function updatePlaylist(playlistId: string, updates: Partial<{ name: string; melodyKeys: string[]; sessionKeys: string[] }>): void {
  const _library = melodyLibrarySignal()
  const playlists = { ..._library.playlists }
  const existing = playlists[playlistId]
  playlists[playlistId] = {
    name: existing?.name ?? '',
    melodyKeys: existing?.melodyKeys ?? [],
    sessionKeys: existing?.sessionKeys ?? [],
    created: existing?.created ?? Date.now(),
    ...updates,
  }
  setMelodyLibrary((prev) => ({
    ...prev,
    playlists,
    meta: { ...prev.meta, lastUpdated: Date.now() },
  }))
  _saveLibraryToStorage()
}

export function deletePlaylist(playlistId: string): void {
  const _library = melodyLibrarySignal()
  const newPlaylists = { ..._library.playlists }
  delete newPlaylists[playlistId]
  setMelodyLibrary((prev) => ({
    ...prev,
    playlists: newPlaylists,
    meta: { ...prev.meta, lastUpdated: Date.now() },
  }))
  _saveLibraryToStorage()
  // If deleted playlist is currently selected, clear it
  if (currentMelody()?.id === playlistId) {
    setCurrentMelody(null)
  }
}

// ============================================================
// Library Accessors
// ============================================================

export function getAllMelodies(): MelodyData[] {
  return Object.values(melodyLibrarySignal().melodies)
}

export function getMelodyCount(): number {
  return Object.keys(melodyLibrarySignal().melodies).length
}

export function getPlaylistCount(): number {
  return Object.keys(melodyLibrarySignal().playlists).length
}

export function getPlaylists(): Record<
  string,
  {
    name: string
    melodyKeys: string[]
    created: number
  }
> {
  return { ...melodyLibrarySignal().playlists }
}

export function getPlaylist(melodyKey: string):
  | {
      name: string
      melodyKeys: string[]
      sessionKeys: string[]
      created: number
    }
  | undefined {
  return melodyLibrarySignal().playlists[melodyKey]
}

export function playPlaylist(playlistId: string): void {
  const playlist = getPlaylist(playlistId)
  if (playlist === null || playlist === undefined) return

  const library = melodyLibrarySignal()
  let currentIndex = 0

  // Play melodies one by one
  const playNextMelody = () => {
    const playlistItem = playlist.melodyKeys[currentIndex]
    const melody = library.melodies[playlistItem]

    if (melody !== null && melody !== undefined) {
      // Load the melody
      melodyStore.loadMelody(melody.id)

      // Update play count for each melody
      const playCount = 'playCount' in melody ? melody.playCount : 0
      const updatedMelody = {
        ...melody,
        playCount: (playCount ?? 0) + 1,
        lastPlayed: Date.now(),
      }
      setMelodyLibrary((prev) => ({
        ...prev,
        melodies: {
          ...prev.melodies,
          [melody.id]: updatedMelody,
        },
        meta: { ...prev.meta, lastUpdated: Date.now() },
      }))
      _saveLibraryToStorage()

      // Increment index and continue to next melody
      currentIndex++
      if (currentIndex < playlist.melodyKeys.length) {
        // Play next melody after current one completes
        setTimeout(playNextMelody, 3000)
      }
    }
  }

  // Start playing from the first melody
  playNextMelody()
}

export function getMelody(id: string): MelodyData | undefined {
  return melodyLibrarySignal().melodies[id]
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
  addMelodyToActiveSession,
  loadMelody,
  saveCurrentMelody,
  updateMelody,
  deleteMelody,
  getAllMelodies,
  getMelodyCount,
  getMelody,
  getMelodyLibrary,
  _setMelodyLibrary,
  setMelodyLibrary,
  generateId,
  resetMelodyLibrary,
  seedDefaultSession,

  // Scale - these are state variables
  currentScale,
  setCurrentScale,
  refreshScale,
  setOctave,
  setNumOctaves,
  getCurrentOctave,

  // Playlist operations
  createPlaylist,
  addMelodyToPlaylist,
  removeMelodyFromPlaylist,
  addSessionToPlaylist,
  updatePlaylist,
  deletePlaylist,
  getPlaylists,
  getPlaylist,
  getPlaylistCount,
  playPlaylist,

  // Export library
  melodyLibrary: getMelodyLibrary,
  unifiedLibrary: () => melodyLibrarySignal() as UnifiedLibrary,
  _setUnifiedLibrary: _setMelodyLibrary,

  // User Sessions
  getSessions,
  saveSession,
  updateSession,
  deleteSession,
  getSession,
  updateUserSession,
  getSessionCount,
  getUserSessionCount,
  getDefaultSession,
  getActiveSession,
  getInternalSession,
  getActiveSessionId,
  setActiveSessionId,

  // Session Item Management (Map-based O(1) operations)
  addItemToSession,
  updateSessionItem,
  deleteSessionItem,
  getSessionItem,
  getSessionItems,
  getSessionItemsOrdered,
  getItemsAtBeat,
  generateSessionItemId,

  // Current Note Index
  currentNoteIndex,
  setCurrentNoteIndex,
}
