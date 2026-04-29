// ============================================================
// Session History / Practice Session Store Tests
// Rewritten for the v3 store split:
//   - practiceSession state lives in practice-session-store
//   - session history is persisted via createPersistedSignal
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock localStorage before importing modules that rely on it.
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

// Imports must come AFTER localStorage mock (createPersistedSignal reads it).
import { advanceSessionItem, endPracticeSession, getCurrentSessionItem, getCurrentSessionItemIndex, getSessionHistory, practiceSession, recordSessionItemResult, sessionActive, sessionItemIndex, setPracticeSession, setSessionActive, setSessionItemIndex, setSessionItemRepeat, setSessionResults, } from '@/stores/practice-session-store'
import type { PlaybackSession, PracticeResult, SessionItem } from '@/types'

const makeMelodyItem = (): SessionItem => ({
  id: 'mi-1',
  type: 'melody',
  startBeat: 0,
  label: 'Test Melody',
  melodyId: 'melody-1',
})

const makeScaleItem = (): SessionItem => ({
  id: 'si-1',
  type: 'scale',
  startBeat: 16,
  label: 'C Major',
  scaleType: 'major',
  beats: 8,
})

const makeRestItem = (): SessionItem => ({
  id: 'ri-1',
  type: 'rest',
  startBeat: 24,
  label: 'Rest',
  restMs: 2000,
})

const makeSession = (items?: SessionItem[]): PlaybackSession => ({
  id: 'test-session',
  name: 'Test Session',
  items: items ?? [makeMelodyItem(), makeScaleItem(), makeRestItem()],
  created: Date.now(),
  deletable: true,
})

const resetState = () => {
  setPracticeSession(null)
  setSessionItemIndex(0)
  setSessionItemRepeat(0)
  setSessionActive(false)
  setSessionResults([])
  localStorageMock.clear()
}

describe('practice-session-store: getCurrentSessionItem', () => {
  beforeEach(resetState)

  it('returns null when no practice session is active', () => {
    expect(getCurrentSessionItem()).toBeNull()
  })

  it('returns the first item by default once a session is loaded', () => {
    setPracticeSession(makeSession())
    const item = getCurrentSessionItem()
    expect(item).not.toBeNull()
    expect(item?.type).toBe('melody')
    expect(item?.label).toBe('Test Melody')
  })

  it('returns null when the index is out of range', () => {
    setPracticeSession(makeSession())
    setSessionItemIndex(99)
    expect(getCurrentSessionItem()).toBeNull()
  })
})

describe('practice-session-store: advanceSessionItem', () => {
  beforeEach(resetState)

  it('advances through items in order', () => {
    setPracticeSession(makeSession())

    expect(getCurrentSessionItemIndex()).toBe(0)
    expect(getCurrentSessionItem()?.type).toBe('melody')

    advanceSessionItem()
    expect(getCurrentSessionItemIndex()).toBe(1)
    expect(getCurrentSessionItem()?.type).toBe('scale')

    advanceSessionItem()
    expect(getCurrentSessionItemIndex()).toBe(2)
    expect(getCurrentSessionItem()?.type).toBe('rest')
  })

  it('returns null after the last item', () => {
    setPracticeSession(makeSession([makeMelodyItem()]))
    const result = advanceSessionItem()
    expect(result).toBeNull()
  })

  it('respects per-item repeat count before advancing index', () => {
    const repeated: SessionItem = { ...makeMelodyItem(), repeat: 3 }
    setPracticeSession(makeSession([repeated, makeScaleItem()]))

    // Two repeats should keep us on the first item.
    advanceSessionItem()
    expect(getCurrentSessionItemIndex()).toBe(0)
    advanceSessionItem()
    expect(getCurrentSessionItemIndex()).toBe(0)
    // Third advance moves to the next index.
    advanceSessionItem()
    expect(getCurrentSessionItemIndex()).toBe(1)
  })
})

describe('practice-session-store: recordSessionItemResult', () => {
  beforeEach(resetState)

  it('endPracticeSession returns null when no session is active', () => {
    expect(endPracticeSession()).toBeNull()
  })

  it('endPracticeSession produces a SessionResult and clears state', () => {
    setPracticeSession(makeSession())
    setSessionActive(true)

    const fakeResult: PracticeResult = {
      score: 88,
      noteCount: 4,
      avgCents: 5.2,
      noteResult: [],
    } as unknown as PracticeResult
    recordSessionItemResult(fakeResult)

    const summary = endPracticeSession()
    expect(summary).not.toBeNull()
    expect(summary?.sessionId).toBe('test-session')
    expect(summary?.sessionName).toBe('Test Session')
    expect(summary?.totalItems).toBe(3)

    // Side effects: state cleared.
    expect(practiceSession()).toBeNull()
    expect(sessionActive()).toBe(false)
    expect(sessionItemIndex()).toBe(0)
  })

  it('endPracticeSession appends the SessionResult to history', () => {
    setPracticeSession(makeSession())
    endPracticeSession()
    expect(getSessionHistory()).toHaveLength(1)
    expect(getSessionHistory()[0].sessionId).toBe('test-session')
  })

  it('history is capped at 50 entries', () => {
    // Pre-fill 50 fake results.
    const seed = Array.from({ length: 50 }, (_, i) => ({
      sessionId: `s-${i}`,
      name: `S${i}`,
      sessionName: `S${i}`,
      completedAt: i,
      itemsCompleted: 0,
      practiceItemResult: [],
      totalItems: 1,
      score: 0,
    }))
    setSessionResults(seed)
    expect(getSessionHistory()).toHaveLength(50)

    setPracticeSession(makeSession())
    endPracticeSession()

    const history = getSessionHistory()
    expect(history).toHaveLength(50)
    // Newest first
    expect(history[0].sessionId).toBe('test-session')
  })
})
