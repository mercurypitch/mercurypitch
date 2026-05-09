// ============================================================
// Practice Session State Tests — appStore session lifecycle
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAYBACK_MODE_SESSION } from '@/features/tabs/constants'
import { advanceSessionItem, appStore, endPracticeSession, getCurrentSessionItem, initSessionHistory, isInSessionMode, recordSessionItemResult, } from '@/stores'
import { createScaleItem } from '@/stores/session-store'
import type { PracticeResult, SessionItem } from '@/types'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// Mock audioEngine for tests
const mockAudioEngine = {
  init: vi.fn(),
  getIsInitialized: vi.fn(() => false),
  stopTone: vi.fn(),
  setBPM: vi.fn(),
  setInstrument: vi.fn(),
  setVolume: vi.fn(),
  getFrequencyData: vi.fn(() => []),
}

// Mock melodyStore - use factory function to avoid hoisting issues
vi.mock('@/stores/melody-store', () => ({
  STORAGE_KEY_SESSION_HIST: 'pitchperfect_session_history',
  melodyStore: {
    items: vi.fn(() => []),
    setItems: vi.fn(),
    currentItems: vi.fn(() => []),
    setCurrentItems: vi.fn(),
    melody: vi.fn(() => ({
      melodies: new Map(),
      library: { melodies: new Map() },
    })),
    updateMelody: vi.fn(),
    setMelody: vi.fn(),
    currentMelody: vi.fn(() => null),
    setCurrentMelody: vi.fn(),
    getCurrentItems: vi.fn(() => []),
    getCurrentScale: vi.fn(() => 'major'),
    setCurrentNoteIndex: vi.fn(),
    getCurrentNoteIndex: vi.fn(() => -1),
    library: vi.fn(() => ({ melodies: new Map() })),
    loadMelody: vi.fn(() => null),
    getCurrentOctave: vi.fn(() => 4),
    setCurrentOctave: vi.fn(),
    setOctave: vi.fn(),
    getSessions: vi.fn(() => []),
    saveSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    getSession: vi.fn(() => null),
    updateUserSession: vi.fn(),
    getSessionCount: vi.fn(() => 0),
    getUserSessionCount: vi.fn(() => 0),
    getDefaultSession: vi.fn(() => null),
    getInternalSession: vi.fn(() => null),
    getActiveSessionId: vi.fn(() => null),
    setActiveSessionId: vi.fn(),
    addItemToSession: vi.fn(),
    updateSessionItem: vi.fn(),
    deleteSessionItem: vi.fn(),
    getSessionItem: vi.fn(() => null),
    getSessionItems: vi.fn(() => []),
    getSessionItemsOrdered: vi.fn(() => []),
    getItemsAtBeat: vi.fn(() => []),
    generateSessionItemId: vi.fn(() => 'test-id'),
    getAllMelodies: vi.fn(() => []),
    getMelodyCount: vi.fn(() => 0),
    getMelody: vi.fn(() => null),
    getMelodyLibrary: vi.fn(() => ({ melodies: new Map() })),
    _setMelodyLibrary: vi.fn(),
    setMelodyLibrary: vi.fn(),
    generateId: vi.fn(() => 'test-id'),
    resetMelodyLibrary: vi.fn(),
    createPlaylist: vi.fn(),
    addMelodyToPlaylist: vi.fn(),
    removeMelodyFromPlaylist: vi.fn(),
    addSessionToPlaylist: vi.fn(),
    updatePlaylist: vi.fn(),
    deletePlaylist: vi.fn(),
    getPlaylists: vi.fn(() => []),
    getPlaylist: vi.fn(() => null),
    getPlaylistCount: vi.fn(() => 0),
    playPlaylist: vi.fn(),
    melodyLibrary: vi.fn(() => ({ melodies: new Map() })),
    _setUnifiedLibrary: vi.fn(),
    refreshScale: vi.fn(),
    setNumOctaves: vi.fn(),
  },
}))

// Mock audio-engine after melody-store
vi.mock('@/lib/audio-engine', () => ({
  AudioEngine: vi.fn().mockImplementation(() => mockAudioEngine),
}))

/** Test session with all required fields for PlaybackSession */
interface TestSession {
  /** Creation timestamp */
  created: number
  id: string
  name: string
  description?: string
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  category:
    | 'warmup'
    | 'scales'
    | 'melodic'
    | 'rhythmic'
    | 'ear_training'
    | 'custom'
    | 'vocal'
  items: SessionItem[]
  /** Can this session be deleted by user? (false for Default/Internal sessions) */
  deletable: boolean
  /** Creator name */
  author?: string
  mode?: 'once' | 'repeat' | 'session'
  cycles?: number
  scale?: { name: string; degrees: number[]; description: string }
  currentCycle?: number
  beatsPerMeasure?: number
  isRecording?: boolean
  score?: number
  duration?: number
  completedAt?: number
  itemsCompleted?: number
}

const makePracticeResult = (
  score: number,
  name: string = 'default',
  noteCount: number = 2,
  avgCents = 10,
  itemsCompleted: number = 1,
): PracticeResult => ({
  /** Overall score (0-100) */
  score: score,
  /** Number of notes completed */
  noteCount: noteCount,
  /** Average cents deviation */
  avgCents: avgCents,
  /** Number of completed items */
  itemsCompleted: itemsCompleted,
  /** Session name */
  name: name,
  /** Practice mode */
  mode: PLAYBACK_MODE_SESSION,
  /** Completed at timestamp */
  completedAt: Date.now(),
  noteResult: [],
})

const makeSession = (id: string, itemCount: number): TestSession => ({
  id,
  name: `${id} name`,
  description: `${id} description`,
  difficulty: 'beginner',
  category: 'vocal',
  mode: PLAYBACK_MODE_SESSION,
  cycles: 1,
  deletable: true,
  scale: { name: 'major', degrees: [0, 2, 4, 5, 7, 9, 11], description: '' },
  currentCycle: 1,
  beatsPerMeasure: 4,
  isRecording: false,
  score: 0,
  duration: 0,
  completedAt: 0,
  itemsCompleted: 0,
  items: Array.from({ length: itemCount }, (_, i) =>
    createScaleItem(`Item ${i + 1}`, 'major', 8, i * 8),
  ),
  created: Date.now(),
})

describe('startPracticeSession', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('marks session mode as active', () => {
    const session = makeSession('test-1', 3)
    appStore.startPracticeSession(session)
    expect(isInSessionMode()).toBe(true)
  })

  it('sets the session on the store', () => {
    const session = makeSession('test-1', 3)
    appStore.startPracticeSession(session)
    const item = getCurrentSessionItem()
    expect(item).toBeDefined()
    expect(item!.label).toBe('Item 1')
  })
})

describe('getCurrentSessionItem', () => {
  beforeEach(() => {
    localStorageMock.clear()
    // Clean any lingering session
    endPracticeSession()
  })

  it('returns null when no session is active', () => {
    expect(getCurrentSessionItem()).toBeNull()
  })

  it('returns the first item after starting a session', () => {
    const session = makeSession('test-1', 4)
    appStore.startPracticeSession(session)
    const item = getCurrentSessionItem()
    expect(item!.label).toBe('Item 1')
  })
})

describe('advanceSessionItem — repeat support', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('repeats the same item when repeat > 1', () => {
    const session: TestSession = {
      id: 'repeat-test',
      name: 'Repeat Test',
      description: 'Test repeat',
      difficulty: 'beginner',
      category: 'vocal',
      items: [
        { ...createScaleItem('Scale A', 'major', 8, 0), repeat: 3 },
        { ...createScaleItem('Scale B', 'major', 8, 8), repeat: 1 },
      ],
      created: Date.now(),
      deletable: true,
    }
    appStore.startPracticeSession(session)
    expect(getCurrentSessionItem()!.label).toBe('Scale A')

    // First advance — still on Scale A (repeat 2nd time)
    advanceSessionItem()
    expect(getCurrentSessionItem()!.label).toBe('Scale A')

    // Second advance — still on Scale A (repeat 3rd time)
    advanceSessionItem()
    expect(getCurrentSessionItem()!.label).toBe('Scale A')

    // Third advance — moves to Scale B
    advanceSessionItem()
    expect(getCurrentSessionItem()!.label).toBe('Scale B')
  })

  it('item with repeat=1 advances immediately', () => {
    const session: TestSession = {
      id: 'no-repeat-test',
      name: 'No Repeat Test',
      description: 'Test no repeat',
      difficulty: 'beginner',
      category: 'vocal',
      items: [
        createScaleItem('First', 'major', 8, 0),
        createScaleItem('Second', 'major', 8, 8),
      ],
      created: Date.now(),
      deletable: true,
    }
    appStore.startPracticeSession(session)
    advanceSessionItem() // repeat=1 → should move to Second
    expect(getCurrentSessionItem()!.label).toBe('Second')
  })
})

describe('recordSessionItemResult', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('records score for the current item', () => {
    const session = makeSession('test-1', 3)
    appStore.startPracticeSession(session)
    recordSessionItemResult(makePracticeResult(85, session.name))
    recordSessionItemResult(makePracticeResult(90, session.name))
    // Scores are stored internally
  })
})

describe('endPracticeSession', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('returns a SessionResult with averaged score', () => {
    const session = makeSession('end-test', 3)
    appStore.startPracticeSession(session)
    recordSessionItemResult(makePracticeResult(80, session.name))
    advanceSessionItem()
    recordSessionItemResult(makePracticeResult(90, session.name))
    advanceSessionItem()
    recordSessionItemResult(makePracticeResult(100, session.name))

    const result = endPracticeSession()
    expect(result).not.toBeNull()
    expect(result!.sessionId).toBe('end-test')
    expect(result!.totalItems).toBe(3)
    expect(result!.itemsCompleted).toBe(3)
    // (80 + 90 + 100) / 3 = 90
    expect(result!.score).toBe(90)
  })

  it('restores session mode to inactive', () => {
    const session = makeSession('end-test', 2)
    appStore.startPracticeSession(session)
    expect(isInSessionMode()).toBe(true)

    endPracticeSession()
    expect(isInSessionMode()).toBe(false)
  })

  it('persists result to localStorage', () => {
    // Snapshot calls before the operation
    const callsBefore = localStorageMock.setItem.mock.calls.length

    const session = makeSession('persist-test', 2)
    appStore.startPracticeSession(session)
    recordSessionItemResult(makePracticeResult(75))
    endPracticeSession()

    // Find the session_results call that happened after our snapshot
    const allCalls = localStorageMock.setItem.mock.calls as unknown[][]
    const sessionCall = allCalls.find(
      (call) =>
        call[0] === 'pitchperfect_session_history' &&
        allCalls.indexOf(call) >= callsBefore,
    )
    expect(sessionCall).toBeDefined()
    const parsed = JSON.parse(sessionCall![1] as string)
    expect(parsed[0].sessionId).toBe('persist-test')
  })

  it('returns null when no session was active', () => {
    const result = endPracticeSession()
    expect(result).toBeNull()
  })

  it('handles zero recorded scores gracefully', () => {
    const session = makeSession('empty-test', 3)
    appStore.startPracticeSession(session)
    // no scores recorded

    const result = endPracticeSession()
    expect(result).not.toBeNull()
    expect(result!.score).toBe(0)
  })
})

describe('isInSessionMode', () => {
  beforeEach(() => {
    localStorageMock.clear()
    endPracticeSession()
  })

  it('returns false initially', () => {
    expect(isInSessionMode()).toBe(false)
  })

  it('returns true when session is active', () => {
    const session = makeSession('mode-test', 2)
    appStore.startPracticeSession(session)
    expect(isInSessionMode()).toBe(true)
  })

  it('returns false after session ends', () => {
    const session = makeSession('mode-test', 2)
    appStore.startPracticeSession(session)
    endPracticeSession()
    expect(isInSessionMode()).toBe(false)
  })
})
