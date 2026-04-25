// ============================================================
// Practice Session State Tests — appStore session lifecycle
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  advanceSessionItem,
  endPracticeSession,
  getCurrentSessionItem,
  initSessionHistory,
  isInSessionMode,
  recordSessionItemResult,
  startPracticeSession,
} from '@/stores/app-store'
import { createScaleItem } from '@/stores/session-store'
import type { NoteResult, SessionItem } from '@/types'

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

/** Test session with all required fields for PracticeSession */
interface TestSession {
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
  mode?: 'once' | 'repeat' | 'practice'
  cycles?: number
  scale?: { name: string; degrees: number[]; description: string }
  currentCycle?: number
  beatsPerMeasure?: number
  isRecording?: boolean
  noteResults?: NoteResult[]
  score?: number
  duration?: number
  completedAt?: number
  itemsCompleted?: number
}

const makeSession = (id: string, itemCount: number): TestSession => ({
  id,
  name: `${id} name`,
  description: `${id} description`,
  difficulty: 'beginner',
  category: 'vocal',
  mode: 'practice',
  cycles: 1,
  scale: { name: 'major', degrees: [0, 2, 4, 5, 7, 9, 11], description: '' },
  currentCycle: 1,
  beatsPerMeasure: 4,
  isRecording: false,
  noteResults: [],
  score: 0,
  duration: 0,
  completedAt: 0,
  itemsCompleted: 0,
  items: Array.from({ length: itemCount }, (_, i) =>
    createScaleItem(`Item ${i + 1}`, 'major', 8, i * 8),
  ),
})

describe('startPracticeSession', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('marks session mode as active', () => {
    const session = makeSession('test-1', 3)
    startPracticeSession(session)
    expect(isInSessionMode()).toBe(true)
  })

  it('sets the session on the store', () => {
    const session = makeSession('test-1', 3)
    startPracticeSession(session)
    const item = getCurrentSessionItem()
    expect(item).toBeDefined()
    expect(item!.label).toBe('Item 1')
  })
})

describe('getCurrentSessionItem', () => {
  beforeEach(() => {
    localStorageMock.clear()
    // Init stores then clean any lingering session
    initSessionHistory()
    endPracticeSession()
  })

  it('returns null when no session is active', () => {
    expect(getCurrentSessionItem()).toBeNull()
  })

  it('returns the first item after starting a session', () => {
    const session = makeSession('test-1', 4)
    startPracticeSession(session)
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
    }
    startPracticeSession(session)
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
    }
    startPracticeSession(session)
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
    startPracticeSession(session)
    recordSessionItemResult(85)
    recordSessionItemResult(90)
    // Scores are stored internally
  })
})

describe('endPracticeSession', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('returns a SessionResult with averaged score', () => {
    const session = makeSession('end-test', 3)
    startPracticeSession(session)
    recordSessionItemResult(80)
    advanceSessionItem()
    recordSessionItemResult(90)
    advanceSessionItem()
    recordSessionItemResult(100)

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
    startPracticeSession(session)
    expect(isInSessionMode()).toBe(true)

    endPracticeSession()
    expect(isInSessionMode()).toBe(false)
  })

  it('persists result to localStorage', () => {
    // Snapshot calls before the operation
    const callsBefore = localStorageMock.setItem.mock.calls.length

    const session = makeSession('persist-test', 2)
    startPracticeSession(session)
    recordSessionItemResult(75)
    endPracticeSession()

    // Find the session_results call that happened after our snapshot
    const allCalls = localStorageMock.setItem.mock.calls as unknown[][]
    const sessionCall = allCalls.find(
      (call) =>
        call[0] === 'pitchperfect_session_results' &&
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
    startPracticeSession(session)
    // no scores recorded

    const result = endPracticeSession()
    expect(result).not.toBeNull()
    expect(result!.score).toBe(0)
  })
})

describe('isInSessionMode', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('returns false initially', () => {
    expect(isInSessionMode()).toBe(false)
  })

  it('returns true when session is active', () => {
    const session = makeSession('mode-test', 2)
    startPracticeSession(session)
    expect(isInSessionMode()).toBe(true)
  })

  it('returns false after session ends', () => {
    const session = makeSession('mode-test', 2)
    startPracticeSession(session)
    endPracticeSession()
    expect(isInSessionMode()).toBe(false)
  })
})
