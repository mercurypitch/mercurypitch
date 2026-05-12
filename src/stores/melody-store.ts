// ============================================================
// Melody Store — Melody items and scale data (in-memory)
// ============================================================

import { createSignal } from 'solid-js'
import { buildMultiOctaveScale } from '@/lib/scale-data'
import type { MelodyData, MelodyItem, MelodyNote, PlaybackSession, ScaleDegree, SessionItem, UnifiedLibrary, } from '@/types'
import { addItemToSession, deleteSession as deleteSessionStore, deleteSessionItem, generateSessionItemId, getDefaultSession, getInternalSession, getItemsAtBeat, getSession, getSessionCount, getSessionItem, getSessionItems, getSessionItemsOrdered, getUserSessionCount, saveSession as saveSessionStore, updateSessionItem, } from './session-store'

export const STORAGE_KEY_LIBRARY = 'pitchperfect_library'
const STORAGE_KEY_SEEDED = 'pitchperfect_seeded'
export const STORAGE_KEY_SESSION_HIST = 'pitchperfect_session_history'
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
    default: {
      id: 'default',
      name: 'Default Session',
      author: 'System',
      // Per UX request: the seeded "Default Session" is now user-deletable.
      // If they reset all data we recreate it via getDefaultSession().
      deletable: true,
      items: [
        // NOTE: every non-rest item in the default session is a melody
        // reference so they all behave consistently in the sidebar
        // (clickable, selectable, draggable, can show "active" state).
        // Previously G Major was a `type:'scale'` item, which made the
        // sidebar's selection logic treat it differently from C Major
        // and skip the `selected` CSS class. Use the pre-built scale
        // melodies (`scale-major-c3`, `scale-major-g3`) seeded by
        // seedDefaultSession() instead.
        {
          id: generateSessionItemId(),
          type: 'melody',
          startBeat: 0,
          label: 'C Major Scale',
          melodyId: 'scale-major-c3',
        },
        {
          id: generateSessionItemId(),
          type: 'melody',
          startBeat: 16,
          label: 'G Major Scale',
          melodyId: 'scale-major-g3',
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
        // NOTE: we used to resurrect the default session on every load if
        // it was missing. That meant a user who deleted "Default Session"
        // saw it reappear after every reload. Now we only resurrect when
        // the entire library reset happens (`resetMelodyLibrary` /
        // `resetAllSessions`), and `seedDefaultSession()` re-runs
        // explicitly. Mid-session deletion is sticky.
        if (library.sessions['default']?.deletable === false) {
          // Migration: legacy storage had `deletable: false`. Flip it so the
          // user can delete the default session (and so it actually shows
          // up in the SessionLibraryModal, which filters by deletable).
          library.sessions['default'] = {
            ...library.sessions['default'],
            deletable: true,
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
    localStorage.setItem(
      STORAGE_KEY_LIBRARY,
      JSON.stringify(melodyLibrarySignal()),
    )
  } catch {
    // Fail silently
  }
}

let _idCounter = 100

function generateMelodyId(): string {
  return `melody-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function generateId(): number {
  return ++_idCounter
}

// Use a signal for the library to maintain SolidJS reactivity
const [melodyLibrarySignal, setMelodyLibrary] =
  createSignal<UnifiedLibrary>(loadLibrary())

// Restore calls deferred to end-of-file to avoid TDZ:
// _restoreActiveSessionId references the (later-declared) `_activeSessionId`
// signal at line ~565 and the `setActiveSessionId` export at line ~580.
// Calling here would throw `ReferenceError: can't access lexical declaration
// 'setActiveSessionId' before initialization` on page load with the
// debugger enabled (TDZ for `const` and `let` is enforced).

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

/** Reload library from localStorage without wiping (used by tests) */
export function _reloadLibraryFromStorage(): void {
  _idCounter = 100
  setMelodyLibrary(loadLibrary())
}

// ============================================================
// Session Operations — Delegate to session-store
// ============================================================

/**
 * REACTIVE list of all sessions (default + user-created).
 *
 * BUGFIX: previously this delegated to `getSessionStoreSessions()` which
 * reads `localStorage` directly and is NOT reactive — so the
 * SessionLibraryModal's `createMemo(() => melodyStore.getSessions())`
 * never re-ran after a delete and the trash icon appeared "broken".
 *
 * We now derive sessions from the reactive `melodyLibrarySignal`. We
 * also stop filtering by `deletable === true`: the user wants the
 * built-in "Default Session" to show up alongside their own (and to be
 * deletable — see `createDefaultSession` in session-store.ts where the
 * flag was flipped to `true`). On reset-all-data the default is
 * regenerated automatically by `getDefaultSession()`.
 */
export function getSessions(): PlaybackSession[] {
  const lib = melodyLibrarySignal()
  return Object.values(lib.sessions ?? {})
    .filter((s): s is PlaybackSession => s != null)
    .sort(
      (a, b) =>
        (b.lastPlayed ?? b.created ?? 0) - (a.lastPlayed ?? a.created ?? 0),
    )
}

/** Get the currently active session by ID */
export function getActiveSession(): PlaybackSession | undefined {
  const sessionId = getActiveSessionId()
  if (sessionId === null) return undefined
  return getSession(sessionId)
}

export function saveSession(session: PlaybackSession): void {
  saveSessionStore(session)
}

export function updateSession(
  id: string,
  updates: Partial<PlaybackSession>,
): void {
  const session = getSession(id)
  if (session !== undefined) {
    saveSessionStore({ ...session, ...updates })
  }
}

export function deleteSession(id: string): void {
  deleteSessionStore(id)
}

export function updateUserSession(session: PlaybackSession): void {
  saveSessionStore(session)
}

// ============================================================
// Default Session — seeded on first launch
// ============================================================

/**
 * Build a scale melody starting from the given (key, octave) tonic.
 *
 * BUGFIX (v3): previously this hardcoded `60 + semitone` (C4 root) for
 * every key — so "G Major Scale" produced the same notes as "C Major
 * Scale". Now we compute the proper root MIDI from `key` (semitone offset
 * from C: G→7, A→9, etc.) plus `octave`, then add the scale degree.
 *
 * E.g. G major octave 4: rootMidi = 12*(4+1) + 7 = 67 (G4), notes are
 * G4 A4 B4 C5 D5 E5 F#5  G5  — different from C major.
 */
function buildScaleMelody(
  id: string,
  name: string,
  key: string,
  scaleType: string,
  octave: number,
  degrees: number[],
): MelodyData {
  const keyIndex = Math.max(0, NOTE_NAMES.indexOf(key))
  const rootMidi = 12 * (octave + 1) + keyIndex

  const items: MelodyItem[] = degrees.map((semitone, i) => {
    // Wrap into next octave once degrees decrease (covers descending
    // chromatic-like scales). For ascending scales `degrees` is monotonic
    // so the wrap term is 0.
    const wrap = i > 0 && degrees[i] < degrees[i - 1] ? 12 : 0
    const midi = rootMidi + semitone + wrap
    const name = NOTE_NAMES[midi % 12] as MelodyNote['name']
    const noteOctave = Math.floor(midi / 12) - 1
    return {
      id: generateId(),
      note: { midi, name, octave: noteOctave, freq: midiToFreq(midi) },
      duration: 1,
      startBeat: i,
    }
  })

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
  // Generate scale-melody seed configs.
  //
  // ID convention:
  //   scale-{scaleType}-{key.toLowerCase()}{octave}        — full scale
  //   scale-{scaleType}-{key.toLowerCase()}{octave}-{N}b   — first N notes
  //
  // The unsuffixed ID is the "full" preset (used by the default session
  // and the sidebar). The `-Nb` suffixes match what `src/data/sessions.ts`
  // PRACTICE_SESSIONS items reference, so each session item resolves to
  // its own length-specific melody (e.g. "G Major Scale (8 beats)" →
  // `scale-major-c4-8b` plays 8 notes; "(12 beats)" → 12, etc.).
  type ScaleSeedBase = {
    scaleType: string
    key: string
    octave: number
    name: string
    degrees: number[]
  }
  const baseConfigs: ScaleSeedBase[] = [
    {
      scaleType: 'major',
      key: 'C',
      octave: 4,
      name: 'C Major Scale (C4)',
      degrees: SCALE_DEGREES.major,
    },
    {
      scaleType: 'major',
      key: 'G',
      octave: 4,
      name: 'G Major Scale (G4)',
      degrees: SCALE_DEGREES.major,
    },
    {
      scaleType: 'major',
      key: 'C',
      octave: 3,
      name: 'C Major Scale',
      degrees: SCALE_DEGREES.major,
    },
    {
      scaleType: 'major',
      key: 'G',
      octave: 3,
      name: 'G Major Scale',
      degrees: SCALE_DEGREES.major,
    },
    {
      scaleType: 'chromatic',
      key: 'C',
      octave: 4,
      name: 'Chromatic Scale',
      degrees: SCALE_DEGREES.chromatic,
    },
    {
      scaleType: 'natural-minor',
      key: 'A',
      octave: 4,
      name: 'A Minor Scale',
      degrees: SCALE_DEGREES['natural-minor'],
    },
    {
      scaleType: 'pentatonic',
      key: 'C',
      octave: 4,
      name: 'C Pentatonic',
      degrees: SCALE_DEGREES.pentatonic,
    },
    {
      scaleType: 'dorian',
      key: 'D',
      octave: 4,
      name: 'D Dorian',
      degrees: SCALE_DEGREES.dorian,
    },
  ]

  // Beat-length variants we want pre-seeded (matches PRACTICE_SESSIONS).
  const lengthVariants = [8, 12, 16]

  const scaleConfigs: Array<ScaleSeedBase & { id: string; beats?: number }> = []
  for (const base of baseConfigs) {
    // Full / "unsuffixed" config (used by default session pills + sidebar)
    scaleConfigs.push({
      ...base,
      id: `scale-${base.scaleType}-${base.key.toLowerCase()}${base.octave}`,
    })
    // Length variants for PRACTICE_SESSIONS references
    for (const beats of lengthVariants) {
      // Cap beats by the available scale degrees so we don't generate
      // empty notes for short scales like pentatonic (5 degrees).
      const truncatedDegrees = base.degrees.slice(
        0,
        Math.min(beats, base.degrees.length),
      )
      scaleConfigs.push({
        ...base,
        id: `scale-${base.scaleType}-${base.key.toLowerCase()}${base.octave}-${beats}b`,
        name: `${base.name} (${beats} beats)`,
        beats,
        degrees: truncatedDegrees,
      })
    }
  }

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

  // Seed default session ONLY on first launch (or after a hard reset
  // that cleared STORAGE_KEY_SEEDED). Once the user has run the app
  // they're allowed to delete the default session permanently — we
  // must not resurrect it on every reload.
  const alreadySeeded =
    typeof localStorage !== 'undefined' &&
    localStorage.getItem(STORAGE_KEY_SEEDED) === 'true'
  const defaultSession = getSession('default')
  if (!defaultSession && !alreadySeeded) {
    const session = getDefaultSession()
    saveSession(session)
  }

  // Add default session to unified library
  const defaultSessionFromLibrary = getSession('default')
  if (defaultSessionFromLibrary) {
    setMelodyLibrary((prev) => ({
      ...prev,
      melodies: newMelodies, // ensure we use newMelodies
      sessions: {
        ...prev.sessions,
        default: defaultSessionFromLibrary,
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

  if (currentMelody() === null && newMelodies['scale-major-c3'] !== undefined) {
    setCurrentMelody(newMelodies['scale-major-c3'])
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
      if (melody != null) {
        _setCurrentMelodySignal(melody)
      }
    }
  } catch {
    // Ignore
  }
}

export const setCurrentMelody = (m: MelodyData | null) => {
  _setCurrentMelodySignal(m)
  try {
    if (m != null) {
      localStorage.setItem(STORAGE_KEY_CURRENT_MELODY_ID, m.id)
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
    name: name ?? `New Melody ${Object.keys(library.melodies).length + 1}`,
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

function getSessionEndBeat(session: PlaybackSession): number {
  if (session.items.length === 0) return 0

  return session.items.reduce((maxBeat, item) => {
    const itemLength =
      item.type === 'rest'
        ? Math.max(1, Math.ceil((item.restMs ?? 4000) / 1000))
        : (item.beats ?? 16)
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
): PlaybackSession | undefined {
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
const DEFAULT_OCTAVE = 3
const DEFAULT_BPM = 80

// ============================================================
// Scale - SolidJS Signals
// ============================================================

export const [currentScale, setCurrentScale] = createSignal<ScaleDegree[]>(
  buildMultiOctaveScale(DEFAULT_KEY, DEFAULT_OCTAVE, 2, DEFAULT_SCALE_TYPE),
)

// Octave state - use function wrapper to avoid circular dependencies
let _octave = DEFAULT_OCTAVE
// Number of octave rows shown in the piano roll. Tracked in this store
// so refreshScale / setOctave / setNumOctaves can rebuild the scale at
// a consistent height. Previously this was implicit (refreshScale
// hardcoded `2`, setNumOctaves was the only path that varied it), so
// changing the start-octave reset numOctaves back to 2 and changing
// numOctaves reset the scale type back to 'major'. Both bugs visible
// to the user as "octaves are wrong, melody disappears off-grid".
let _numOctaves = 2
// Last-known key and scale type used to (re)build the rendered scale.
// refreshScale() is the canonical write site (called whenever the user
// switches key or scale type via the toolbar/sidebar). setOctave and
// setNumOctaves use these as the input to buildMultiOctaveScale so the
// scale stays consistent across octave / row-count changes.
let _scaleKey: string = DEFAULT_KEY
let _scaleType: string = DEFAULT_SCALE_TYPE

export const getCurrentOctave = (): number => {
  return _octave
}

export const getNumOctaves = (): number => {
  return _numOctaves
}

export const setCurrentOctave = (octave: number): void => {
  _octave = octave
}

/**
 * Update the start octave AND rebuild the scale at the current
 * numOctaves / key / scaleType. Previously this was a write-only helper
 * — it stored the new octave but never rebuilt the scale, so the piano
 * roll's row labels stayed pinned to the old octave while the underlying
 * MIDI numbers shifted, producing the "notes are off the grid" effect.
 */
export const setOctave = (octave: number): void => {
  _octave = octave
  setCurrentScale(
    buildMultiOctaveScale(_scaleKey, octave, _numOctaves, _scaleType),
  )
}

export const [currentNoteIndex, setCurrentNoteIndex] = createSignal<number>(0)

export const [getActiveSessionId, _setActiveSessionId] = createSignal<
  string | null
>(null)

function _restoreActiveSessionId(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_SESSION_ID)
    if (saved !== null) {
      setActiveSessionId(saved)
    }
  } catch {
    // Ignore
  }
}

export const setActiveSessionId = (id: string | null) => {
  _setActiveSessionId(id)
  try {
    if (id !== null) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_SESSION_ID, id)
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION_ID)
    }
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
  if (current == null) return 0
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
  if (current == null) return
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
  if (current == null) return
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
  if (melody != null) {
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
  const newPlaylists: Record<
    string,
    {
      name: string
      melodyKeys: string[]
      sessionKeys: string[]
      created: number
    }
  > = {}

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
  const updatedMelody = {
    ...melody,
    name: name ?? melody.name,
    updatedAt: Date.now(),
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

  if (existing != null) {
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

/**
 * Canonical scale-rebuild entry point. Stores the new key/scaleType
 * (so subsequent setOctave / setNumOctaves rebuild against the
 * correct scale) and rebuilds at the current `_numOctaves`.
 *
 * BUGFIX: previously this hardcoded `numOctaves=2`, ignoring whatever
 * the user had set via the +/- octave-row buttons. Switching key or
 * scale type would silently snap the row count back to 2.
 */
export function refreshScale(
  keyName: string,
  startOctave: number,
  scaleType: string,
): void {
  _octave = startOctave
  _scaleKey = keyName
  _scaleType = scaleType
  setCurrentScale(
    buildMultiOctaveScale(keyName, startOctave, _numOctaves, scaleType),
  )
}

/**
 * Update the number of octave rows AND rebuild the scale.
 *
 * BUGFIX: previously rebuilt with `DEFAULT_KEY` ('C') and hardcoded
 * 'major' regardless of the user's current selection — so clicking
 * +/- octaves on a non-C / non-major scale silently reverted the row
 * labels to C major while the underlying melody MIDI numbers stayed
 * unchanged, causing notes to render off the displayed grid. Now we
 * rebuild against the tracked `_scaleKey` / `_scaleType`.
 */
export function setNumOctaves(num: number): void {
  _numOctaves = Math.max(1, Math.min(3, Math.round(num)))
  setCurrentScale(
    buildMultiOctaveScale(_scaleKey, _octave, _numOctaves, _scaleType),
  )
}

// ============================================================
// Playlist Operations
// ============================================================

export function createPlaylist(name: string): string {
  const id = `playlist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
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

export function removeSessionFromPlaylist(
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
        sessionKeys: playlist.sessionKeys.filter((id) => id !== sessionId),
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

export function updatePlaylist(
  playlistId: string,
  updates: Partial<{
    name: string
    melodyKeys: string[]
    sessionKeys: string[]
  }>,
): void {
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

/**
 * Build an in-memory PlaybackSession from a playlist so it can flow through
 * the existing session UI / playSessionSequence machinery.
 *
 * The synthetic session:
 *   - Has id `playlist:<playlistId>` so it round-trips through the sidebar
 *     dropdown without colliding with real sessions.
 *   - Is `deletable: false` (the user manages playlists separately, not via
 *     "delete session").
 *   - Flattens included sub-sessions: any `sessionKeys` entry contributes its
 *     own melody items (in order) so the user hears the full playlist
 *     sequentially, just like a top-level session.
 *
 * Returns `null` if the playlist doesn't exist.
 */
export function buildPlaylistAsSession(
  playlistId: string,
): PlaybackSession | null {
  const playlist = getPlaylist(playlistId)
  if (playlist == null) return null

  const lib = melodyLibrarySignal()
  const items: SessionItem[] = []
  let beat = 0

  const pushMelody = (melodyId: string, label: string): void => {
    items.push({
      id: `${playlistId}-m-${items.length}`,
      type: 'melody',
      startBeat: beat,
      label,
      melodyId,
    })
    beat += 4
  }

  for (const melodyId of playlist.melodyKeys) {
    const m = lib.melodies[melodyId]
    if (m !== undefined) pushMelody(melodyId, m.name)
  }

  for (const sessionId of playlist.sessionKeys ?? []) {
    const sess = lib.sessions[sessionId]
    if (sess === undefined) continue
    for (const it of sess.items) {
      if (
        it.type === 'melody' &&
        it.melodyId !== undefined &&
        it.melodyId !== null
      ) {
        const m = lib.melodies[it.melodyId]
        pushMelody(it.melodyId, m?.name ?? it.label)
      }
    }
  }

  return {
    id: `playlist:${playlistId}`,
    name: playlist.name,
    deletable: false,
    items,
    created: playlist.created,
    description: 'Playlist',
  }
}

/**
 * Get the melody IDs that a playlist would play, in order. Convenience for
 * triggering window.__pp.playSessionSequence(...) without rebuilding the
 * synthetic session.
 */
export function getPlaylistMelodyIds(playlistId: string): string[] {
  const synth = buildPlaylistAsSession(playlistId)
  if (synth === null) return []
  return synth.items
    .filter((i) => i.type === 'melody' && i.melodyId !== undefined)
    .map((i) => i.melodyId as string)
}

export function playPlaylist(playlistId: string): void {
  const playlist = getPlaylist(playlistId)
  if (playlist == null) return

  const library = melodyLibrarySignal()
  let currentIndex = 0

  // Play melodies one by one
  const playNextMelody = () => {
    const playlistItem = playlist.melodyKeys[currentIndex]
    const melody = library.melodies[playlistItem]

    if (melody != null) {
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
  getNumOctaves,

  // Playlist operations
  createPlaylist,
  addMelodyToPlaylist,
  removeMelodyFromPlaylist,
  addSessionToPlaylist,
  removeSessionFromPlaylist,
  updatePlaylist,
  deletePlaylist,
  getPlaylists,
  getPlaylist,
  getPlaylistCount,
  playPlaylist,
  buildPlaylistAsSession,
  getPlaylistMelodyIds,

  // Export library
  melodyLibrary: getMelodyLibrary,
  unifiedLibrary: () => melodyLibrarySignal() as UnifiedLibrary,
  _setUnifiedLibrary: _setMelodyLibrary,
  saveLibrary: _saveLibraryToStorage,

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

// ============================================================
// Deferred init: restore persisted state once all signal bindings
// are declared. (See comment near line ~120 for TDZ explanation.)
// ============================================================
_restoreActiveSessionId()
// eslint-disable-next-line solid/reactivity
_restoreCurrentMelodyId()
